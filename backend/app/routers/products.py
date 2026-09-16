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
    ProductUpdate,
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


# Здесь был GET /products без авторизации, отдававший товары всех
# заведений разом, включая отключённые (is_active = false). Его никто
# не вызывал: кабинету хватает /products/business/{business_id},
# а покупателю товары приходят внутри предложений.


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
)
def get_product(
    product_id: UUID,

    current_user: User = Depends(
        get_current_user
    ),

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

    # Как /offers/{offer_id}: этот эндпоинт дёргает только кабинет
    # заведения (карточка товара), покупателю товар виден внутри
    # предложения. base_price и is_active — внутренняя кухня, доступ
    # проверяем по членству в бизнесе, а не только по факту логина.
    get_business_membership_or_403(
        db=db,
        user_id=current_user.id,
        business_id=product.business_id,
        allowed_roles=BUSINESS_ROLES,
    )

    return product

# --------------------------------
# ОБНОВЛЕНИЕ ТОВАРА
# --------------------------------
#
# Сюда же входит включение
# и отключение товара (is_active).

@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
)
def update_product(
    product_id: UUID,
    data: ProductUpdate,

    current_user: User = Depends(
        get_current_user
    ),

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

    get_business_membership_or_403(
        db=db,
        user_id=current_user.id,
        business_id=(
            product.business_id
        ),
        allowed_roles=(
            MANAGE_BUSINESS_ROLES
        ),
    )

    changes = data.model_dump(
        exclude_unset=True,
    )

    if not changes:
        return product

    for field, value in changes.items():
        setattr(
            product,
            field,
            value,
        )

    try:
        db.commit()
        db.refresh(product)

    except Exception:
        db.rollback()
        raise

    return product
