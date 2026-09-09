from collections.abc import Callable
from uuid import UUID

from fastapi import (
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.business import Business
from app.models.business_member import (
    BusinessMember,
)
from app.models.user import User


BUSINESS_ROLES = {
    "owner",
    "manager",
    "staff",
}

MANAGE_BUSINESS_ROLES = {
    "owner",
    "manager",
}

OWNER_ONLY_ROLES = {
    "owner",
}

ORDER_ROLES = {
    "owner",
    "manager",
    "staff",
}


def get_business_membership_or_403(
    *,
    db: Session,
    user_id: UUID,
    business_id: UUID,
    allowed_roles: set[str] | None = None,
) -> BusinessMember:
    row = db.execute(
        select(
            BusinessMember,
            Business,
        )
        .join(
            Business,
            BusinessMember.business_id
            == Business.id,
        )
        .where(
            BusinessMember.user_id
            == user_id,
            BusinessMember.business_id
            == business_id,
        )
    ).one_or_none()

    if row is None:
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "You do not have access "
                "to this business"
            ),
        )

    membership, business = row

    if membership.status != "active":
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Business membership "
                "is not active"
            ),
        )

    if business.status != "active":
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Business is not active"
            ),
        )

    if (
        allowed_roles is not None
        and membership.role
        not in allowed_roles
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "You do not have "
                "permission for this action"
            ),
        )

    return membership


def require_business_access(
    *roles: str,
) -> Callable:
    allowed_roles = set(roles)

    if not allowed_roles:
        allowed_roles = (
            BUSINESS_ROLES.copy()
        )

    invalid_roles = (
        allowed_roles
        - BUSINESS_ROLES
    )

    if invalid_roles:
        raise ValueError(
            "Unknown business roles: "
            + ", ".join(
                sorted(
                    invalid_roles
                )
            )
        )

    def dependency(
        business_id: UUID,
        current_user: User = Depends(
            get_current_user
        ),
        db: Session = Depends(
            get_db
        ),
    ) -> BusinessMember:
        return (
            get_business_membership_or_403(
                db=db,
                user_id=current_user.id,
                business_id=business_id,
                allowed_roles=allowed_roles,
            )
        )

    return dependency