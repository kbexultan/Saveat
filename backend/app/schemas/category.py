from pydantic import BaseModel


class CategoryResponse(BaseModel):
    slug: str
    label: str
