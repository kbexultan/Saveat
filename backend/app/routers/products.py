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

from app.models.business_member import (
    BusinessMember,
)
from app.models.product import Product
from app.models.user import User

from app.schemas.product import (
    ProductCreate,
    ProductResponse,
)


router = APIRouter(
    prefix="/products",
    tags=["Products"],
)


@router.post(
    "",
    response_model=ProductResponse,
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def create_product(
    data: ProductCreate,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    get_business_membership_or_403(
        db=db,
        user_id=current_user.id,
        business_id=data.business_id,
        allowed_roles=(
            MANAGE_BUSINESS_ROLES
        ),
    )

    product = Product(
        business_id=(
            data.business_id
        ),

        name=data.name.strip(),
        description=(
            data.description
        ),

        category=(
            data.category
        ),

        image_url=(
            data.image_url
        ),

        base_price=(
            data.base_price
        ),
    )

    db.add(product)

    try:
        db.commit()
        db.refresh(product)

    except Exception:
        db.rollback()
        raise

    return product


# PRIVATE список для dashboard.
@router.get(
    "/business/{business_id}",
    response_model=list[
        ProductResponse
    ],
)
def get_business_products(
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
        select(Product)
        .where(
            Product.business_id
            == business_id
        )
        .order_by(
            Product.created_at.desc()
        )
    )

    return result.scalars().all()


@router.get(
    "",
    response_model=list[
        ProductResponse
    ],
)
def get_products(
    db: Session = Depends(
        get_db
    ),
):
    result = db.execute(
        select(Product)
        .order_by(
            Product.created_at.desc()
        )
    )

    return result.scalars().all()


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
)
def get_product(
    product_id: UUID,
    db: Session = Depends(
        get_db
    ),
):
    product = db.get(
        Product,
        product_id,
    )

    if product is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Product not found"
            ),
        )

    return product