from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BusinessCreate(BaseModel):
    name: str
    description: str | None = None
    logo_url: str | None = None


class BusinessResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    logo_url: str | None
    status: str
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class BusinessCatalogResponse(BaseModel):
    """
    Заведение в каталоге поиска.

    Помимо самого заведения отдаём счётчики: без них каталог —
    просто набор названий, по которому непонятно, есть ли смысл
    заходить. Счётчик предложений считается тем же условием, что
    и витрина, иначе в каталоге светились бы просроченные.
    """

    id: UUID
    name: str
    description: str | None
    logo_url: str | None
    active_offers: int
    branches: int
