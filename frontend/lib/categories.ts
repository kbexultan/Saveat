const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";

export type Category = {
  slug: string;
  label: string;
};

/**
 * Справочник категорий приходит с бэкенда (GET /categories).
 *
 * Раньше список был захардкожен в двух местах — на главной и в форме
 * товара — и значения в них не совпадали: форма сохраняла desserts и
 * ready_meals, а фильтр на главной искал dessert и meal. Поэтому
 * единственный источник правды теперь один, в backend/app/categories.py.
 */
export async function fetchCategories(
  init?: RequestInit,
): Promise<Category[]> {
  try {
    const response = await fetch(
      `${API_URL}/categories`,
      init,
    );

    if (!response.ok) {
      console.error(
        "Failed to load categories:",
        response.status,
      );

      return [];
    }

    return await response.json();
  } catch (error) {
    console.error(
      "Failed to load categories:",
      error,
    );

    return [];
  }
}
