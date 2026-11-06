export function pickupErrorMessage(detail: unknown): string {
  const messages: Record<string, string> = {
    "Order has already been picked up": "Этот заказ уже выдан. Обновите данные заказа.",
    "Cancelled order cannot be picked up": "Отменённый заказ нельзя выдать.",
    "Order cannot be picked up": "Этот заказ нельзя выдать.",
    "Order with this pickup code was not found": "Заказ с таким кодом не найден в вашем заведении.",
    "You do not have access to this business": "Нет доступа к этому заведению.",
    "Invalid or expired token": "Сессия истекла. Войдите снова.",
  };
  return typeof detail === "string" && Object.hasOwn(messages, detail)
    ? messages[detail] : "Не удалось проверить выдачу. Обновите заказ и попробуйте снова.";
}
