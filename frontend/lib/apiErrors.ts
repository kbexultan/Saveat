/**
 * Перевод ответов бэкенда в человеческие сообщения.
 *
 * FastAPI отдаёт `detail` в двух разных формах:
 *  - строка для HTTPException (409 «Email already registered» и т.п.);
 *  - массив объектов для 422, когда не прошла валидация Pydantic.
 *
 * Без разбора второго случая пользователь видел просто
 * «Не удалось создать аккаунт» и не понимал, что именно исправить.
 */

type ValidationIssue = {
  loc?: unknown[];
  msg?: string;
  type?: string;
};

/** Сообщения, которые бэкенд возвращает строкой. */
const knownMessages: Record<string, string> = {
  "Email already registered": "Пользователь с таким email уже существует.",
  "Phone already registered": "Этот номер телефона уже привязан к другому аккаунту.",
  "Invalid credentials": "Неверный email или пароль.",
  "Incorrect email or password": "Неверный email или пароль.",
};

/** Человеческие названия полей формы. */
const fieldNames: Record<string, string> = {
  full_name: "Имя",
  phone: "Телефон",
  email: "Email",
  password: "Пароль",
  name: "Название",
  address: "Адрес",
};

function describeIssue(issue: ValidationIssue): string {
  const field = issue.loc?.[issue.loc.length - 1];
  const label = typeof field === "string" ? (fieldNames[field] ?? field) : "Поле";

  switch (issue.type) {
    case "string_too_short":
      return `${label}: слишком короткое значение.`;

    case "string_too_long":
      return `${label}: слишком длинное значение.`;

    case "missing":
      return `${label}: заполните это поле.`;

    case "value_error":
      return `${label}: некорректное значение.`;

    default:
      return issue.msg ? `${label}: ${issue.msg}` : `${label}: некорректное значение.`;
  }
}

/** Превращает `detail` из ответа бэкенда в текст для пользователя. */
export function describeApiError(detail: unknown, fallback: string): string {
  if (typeof detail === "string") {
    return knownMessages[detail] ?? detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .slice(0, 3)
      .map((issue) => describeIssue(issue as ValidationIssue))
      .join(" ");
  }

  return fallback;
}

/**
 * Отличает «сервер не ответил» от «сервер ответил ошибкой».
 * fetch бросает TypeError, когда бэкенд не поднят или недоступен
 * по сети — пользователю это надо показать иначе.
 */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

export const NETWORK_ERROR_MESSAGE =
  "Не удалось связаться с сервером. Проверьте, что backend запущен, и попробуйте ещё раз.";
