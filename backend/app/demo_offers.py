"""
Keeps seeded demo offers on the storefront without touching real ones.

Every read path (storefront, business pages, favorites, checkout, the
business cabinet) decides "expired" from offers.pickup_end, and that rule
must stay exactly as it is for real offers. So instead of teaching each
query about demo data, the renewal moves the *stored* window of demo
offers forward by whole days once it is about to close. Everything that
reads offers keeps working unchanged and sees an ordinary, current offer.

What renewal does and does not do:

- Only rows with offers.is_demo = true are updated. Offers created by
  businesses through the API are never demo offers.
- The time of day and the length of the window are kept: an 18:00-22:00
  demo offer is still 18:00-22:00, just on a later day.
- Stock, status and orders are left alone. Bookings made during testing
  stay booked; orders keep the pickup window copied at checkout. Restoring
  stock is a separate, manual command (scripts.demo_env reset).
"""

import asyncio
import logging

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal

logger = logging.getLogger(__name__)

# Renew a little before the window closes, so a demo offer never drops
# off the storefront between two worker runs.
RENEW_LEAD = "10 minutes"
WORKER_INTERVAL_SECONDS = 300

_RENEW_SQL = text(
    f"""
    UPDATE offers
       SET pickup_start = pickup_start + make_interval(days => shift.days),
           pickup_end   = pickup_end   + make_interval(days => shift.days)
      FROM (
            SELECT id,
                   floor(
                       extract(epoch FROM (now() + interval '{RENEW_LEAD}' - pickup_end))
                       / 86400
                   )::int + 1 AS days
              FROM offers
             WHERE is_demo
               AND pickup_end <= now() + interval '{RENEW_LEAD}'
           ) AS shift
     WHERE offers.id = shift.id
    """
)


def renew_demo_offers(db: Session) -> int:
    """
    Moves every demo offer whose window closes within RENEW_LEAD to the
    nearest later day on which it is still open. Returns the number of
    renewed offers. The caller owns the transaction.
    """
    return db.execute(_RENEW_SQL).rowcount or 0


def renew_demo_offers_once() -> int:
    db = SessionLocal()

    try:
        renewed = renew_demo_offers(db)
        db.commit()
        return renewed
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def run_demo_offer_worker(stop: asyncio.Event) -> None:
    """Runs at startup and then every WORKER_INTERVAL_SECONDS."""
    while not stop.is_set():
        try:
            renewed = await asyncio.to_thread(renew_demo_offers_once)
            if renewed:
                logger.info("Renewed %s demo offers", renewed)
        except Exception:
            logger.exception("Demo offer renewal failed; retrying later")

        try:
            await asyncio.wait_for(stop.wait(), timeout=WORKER_INTERVAL_SECONDS)
        except TimeoutError:
            pass
