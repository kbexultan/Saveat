from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.business_access import (
    BUSINESS_ROLES,
    MANAGE_BUSINESS_ROLES,
    get_business_membership_or_403,
    require_business_access,
)
from app.database import get_db

from app.models.branch import Branch
from app.models.business_member import (
    BusinessMember,
)
from app.models.user import User

from app.schemas.branch import (
    BranchCreate,
    BranchResponse,
)


router = APIRouter(
    prefix="/branches",
    tags=["Branches"],
)


@router.post(
    "",
    response_model=BranchResponse,
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def create_branch(
    data: BranchCreate,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    # Только owner/manager именно
    # этого бизнеса.
    get_business_membership_or_403(
        db=db,
        user_id=current_user.id,
        business_id=data.business_id,
        allowed_roles=(
            MANAGE_BUSINESS_ROLES
        ),
    )

    branch = Branch(
        business_id=(
            data.business_id
        ),

        name=data.name.strip(),
        address=data.address.strip(),

        latitude=data.latitude,
        longitude=data.longitude,

        opening_time=(
            data.opening_time
        ),

        closing_time=(
            data.closing_time
        ),
    )

    db.add(branch)

    try:
        db.commit()
        db.refresh(branch)

    except Exception:
        db.rollback()
        raise

    return branch


# PRIVATE:
# филиалы конкретного бизнеса.
@router.get(
    "/business/{business_id}",
    response_model=list[
        BranchResponse
    ],
)
def get_business_branches(
    business_id: UUID,

    _membership: BusinessMember = Depends(
        require_business_access(
            *BUSINESS_ROLES
        )
    ),

    db: Session = Depends(
        get_db
    ),
):
    result = db.execute(
        select(Branch)
        .where(
            Branch.business_id
            == business_id
        )
        .order_by(
            Branch.created_at.desc()
        )
    )

    return result.scalars().all()


# Пока оставляем публичный список,
# чтобы не сломать существующий frontend/API.
@router.get(
    "",
    response_model=list[
        BranchResponse
    ],
)
def get_branches(
    db: Session = Depends(
        get_db
    ),
):
    result = db.execute(
        select(Branch)
        .order_by(
            Branch.created_at.desc()
        )
    )

    return result.scalars().all()


@router.get(
    "/{branch_id}",
    response_model=BranchResponse,
)
def get_branch(
    branch_id: UUID,
    db: Session = Depends(
        get_db
    ),
):
    branch = db.get(
        Branch,
        branch_id,
    )

    if branch is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Branch not found"
            ),
        )

    return branch