/**
 * Русские склонения счётчиков.
 *
 * «1 предложение», «2 предложения», «5 предложений» — три формы,
 * которые Intl.PluralRules сам по себе не даёт: он возвращает
 * категорию ("one" / "few" / "many"), а слова всё равно наши.
 */

export function pluralize(
  count: number,
  one: string,
  few: string,
  many: string,
) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  if (
    mod10 >= 2 &&
    mod10 <= 4 &&
    (mod100 < 12 || mod100 > 14)
  ) {
    return few;
  }

  return many;
}

/** «1 предложение», «2 предложения», «5 предложений». */
export function formatOfferCount(count: number) {
  return `${count} ${pluralize(
    count,
    "предложение",
    "предложения",
    "предложений",
  )}`;
}

/** «1 филиал», «2 филиала», «5 филиалов». */
export function formatBranchCount(count: number) {
  return `${count} ${pluralize(
    count,
    "филиал",
    "филиала",
    "филиалов",
  )}`;
}

/** «1 заведение», «2 заведения», «5 заведений». */
export function formatBusinessCount(count: number) {
  return `${count} ${pluralize(
    count,
    "заведение",
    "заведения",
    "заведений",
  )}`;
}
