"""One bounded, durable outbox poller per API process (or standalone worker)."""
import asyncio
import logging
from app.push import process_push_batch

logger = logging.getLogger(__name__)


async def run_worker(stop: asyncio.Event) -> None:
    while not stop.is_set():
        try:
            await asyncio.to_thread(process_push_batch)
        except Exception:
            logger.error("Push worker batch failed; retrying later")
        try:
            await asyncio.wait_for(stop.wait(), timeout=2)
        except TimeoutError:
            pass


if __name__ == "__main__":
    asyncio.run(run_worker(asyncio.Event()))
