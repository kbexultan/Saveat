from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SubscribedBusinessResponse(BaseModel):
    """
    Заведение в списке подписок.

    Помимо самого заведения отдаём, сколько у него сейчас доступных
    предложений: без этого список подписок — просто набор названий,
    по которому непонятно, есть ли смысл заходить.
    """

    id: UUID
    name: str
    description: str | None
    logo_url: str | None
    active_offers: int
    subscribed_at: datetime
