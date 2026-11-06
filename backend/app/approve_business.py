"""Operator-only CLI: no public admin endpoint and no automatic approvals."""
import argparse
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.business import Business


def approve_business(db: Session, business_id: UUID, expected_name: str) -> None:
    business = db.scalar(select(Business).where(Business.id == business_id).with_for_update())
    if business is None or business.name != expected_name:
        raise ValueError("Business ID/name do not match")
    if business.status != "pending":
        raise ValueError("Only pending businesses can be approved")
    business.status = "active"


def main():
    parser = argparse.ArgumentParser(description="Approve a manually verified SAVEAT business")
    parser.add_argument("business_id", type=UUID)
    parser.add_argument("--expected-name", required=True)
    args = parser.parse_args()
    from app.database import SessionLocal
    with SessionLocal.begin() as db:
        approve_business(db, args.business_id, args.expected_name)
    print("Business approved")


if __name__ == "__main__":
    main()
