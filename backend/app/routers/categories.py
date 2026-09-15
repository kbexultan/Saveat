from fastapi import APIRouter

from app.categories import PRODUCT_CATEGORIES
from app.schemas.category import CategoryResponse


router = APIRouter(
    prefix="/categories",
    tags=["Categories"],
)


@router.get(
    "",
    response_model=list[CategoryResponse],
)
def get_categories():
    """
    Справочник категорий для фронта: подписи кнопок на главной и
    выпадающий список в форме товара берутся отсюда, а не из
    локальных копий на каждой странице.
    """
    return [
        CategoryResponse(
            slug=slug,
            label=label,
        )
        for slug, label in PRODUCT_CATEGORIES
    ]
