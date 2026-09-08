from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.branch import Branch
from app.models.business import Business
from app.schemas.branch import BranchCreate, BranchResponse


router = APIRouter(
    prefix="/branches",
    tags=["Branches"],
)


@router.post(
    "",
    response_model=BranchResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_branch(
    data: BranchCreate,
    db: Session = Depends(get_db),
):
    business = db.get(Business, data.business_id)

    if business is None:
        raise HTTPException(
            status_code=404,
            detail="Business not found",
        )

    branch = Branch(
        business_id=data.business_id,
        name=data.name,
        address=data.address,
        latitude=data.latitude,
        longitude=data.longitude,
        opening_time=data.opening_time,
        closing_time=data.closing_time,
    )

    db.add(branch)
    db.commit()
    db.refresh(branch)

    return branch


@router.get(
    "",
    response_model=list[BranchResponse],
)
def get_branches(
    db: Session = Depends(get_db),
):
    result = db.execute(
        select(Branch).order_by(Branch.created_at.desc())
    )

    return result.scalars().all()


@router.get(
    "/{branch_id}",
    response_model=BranchResponse,
)
def get_branch(
    branch_id: UUID,
    db: Session = Depends(get_db),
):
    branch = db.get(Branch, branch_id)

    if branch is None:
        raise HTTPException(
            status_code=404,
            detail="Branch not found",
        )

    return branch
