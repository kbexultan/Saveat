/** Требования backend: RegisterRequest (password min_length=8) + EmailStr. */
export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export type RegistrationValues = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
};

/** Возвращает текст ошибки или null, если данные корректны. */
export function validateRegistration(
  values: RegistrationValues,
): string | null {
  if (values.fullName.trim().length < 2) {
    return "Укажите имя.";
  }

  if (values.phone.trim().length < 5) {
    return "Укажите номер телефона.";
  }

  if (!isValidEmail(values.email)) {
    return "Проверьте адрес электронной почты.";
  }

  if (values.password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов.`;
  }

  if (values.password !== values.confirmPassword) {
    return "Пароли не совпадают.";
  }

  return null;
}

/** Число из поля ввода: пустая строка и мусор дают null. */
export function parseDecimalInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

/** "43.238949" → число широты, иначе null. */
export function parseCoordinate(
  value: string,
  kind: "latitude" | "longitude",
): number | null {
  const parsed = parseDecimalInput(value);

  if (parsed === null) {
    return null;
  }

  const limit = kind === "latitude" ? 90 : 180;

  if (Math.abs(parsed) > limit) {
    return null;
  }

  return parsed;
}

/** "9:00" / "09:00" → "09:00:00" для Pydantic `time`. */
export function toBackendTime(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  const paddedHours = String(hours).padStart(2, "0");

  return `${paddedHours}:${match[2]}:00`;
}

/**
 * "12.05.2026 18:30" или "18:30" → ISO со смещением Алматы (+05:00).
 *
 * Без даты подставляется сегодняшний день по времени Алматы —
 * так сотруднику достаточно ввести только время окна выдачи.
 */
export function toAlmatyIso(
  dateInput: string,
  timeInput: string,
): string | null {
  const time = /^(\d{1,2}):(\d{2})$/.exec(timeInput.trim());

  if (!time) {
    return null;
  }

  const hours = Number(time[1]);
  const minutes = Number(time[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  const date = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(dateInput.trim());

  if (!date) {
    return null;
  }

  const day = date[1].padStart(2, "0");
  const month = date[2].padStart(2, "0");
  const year = date[3];

  const paddedHours = String(hours).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");

  return `${year}-${month}-${day}T${paddedHours}:${paddedMinutes}:00+05:00`;
}

/** Сегодняшняя дата в Алматы как "ДД.ММ.ГГГГ". */
export function todayInAlmaty(): string {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

  return parts;
}

/** ISO из backend → "ДД.ММ.ГГГГ" и "ЧЧ:ММ" по времени Алматы. */
export function splitAlmatyDateTime(iso: string): {
  date: string;
  time: string;
} {
  const value = new Date(iso);

  if (Number.isNaN(value.getTime())) {
    return { date: "", time: "" };
  }

  const date = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);

  const time = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);

  return { date, time };
}
