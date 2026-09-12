import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { MAX_QUANTITY_PER_OFFER } from "@/constants/theme";
import { toNumber } from "@/lib/format";
import { readJson, removeKey, STORAGE_KEYS, writeJson } from "@/lib/storage";
import type { PublicOffer } from "@/types/api";

export type CartItem = {
  offer: PublicOffer;
  quantity: number;
};

export type CartActionResult = {
  success: boolean;
  message: string;
};

type CartContextValue = {
  items: CartItem[];
  /** true, пока корзина ещё читается из хранилища. */
  loading: boolean;

  totalItems: number;
  totalPrice: number;

  /** Все позиции корзины принадлежат одному филиалу. */
  branchId: string | null;
  branchName: string | null;
  businessName: string | null;
  address: string | null;

  addItem: (offer: PublicOffer, quantity: number) => CartActionResult;
  updateQuantity: (offerId: string, quantity: number) => void;
  increment: (offerId: string) => void;
  decrement: (offerId: string) => void;
  removeItem: (offerId: string) => void;
  clearCart: () => void;
  /** Обновляет снимки offer свежими данными витрины. */
  syncWithOffers: (offers: PublicOffer[]) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function maxQuantityFor(offer: PublicOffer): number {
  return Math.min(offer.quantity_remaining, MAX_QUANTITY_PER_OFFER);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Корзина — не секрет, поэтому обычное хранилище устройства.
  useEffect(() => {
    let active = true;

    async function restore() {
      const saved = await readJson<CartItem[]>(STORAGE_KEYS.cart);

      if (!active) {
        return;
      }

      if (Array.isArray(saved)) {
        setItems(
          saved.filter(
            (item) =>
              item &&
              typeof item.quantity === "number" &&
              item.quantity > 0 &&
              item.offer &&
              typeof item.offer.id === "string",
          ),
        );
      }

      setLoading(false);
    }

    void restore();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (items.length === 0) {
      void removeKey(STORAGE_KEYS.cart);
      return;
    }

    void writeJson(STORAGE_KEYS.cart, items);
  }, [items, loading]);

  const addItem = useCallback(
    (offer: PublicOffer, quantity: number): CartActionResult => {
      if (quantity < 1) {
        return { success: false, message: "Выберите количество." };
      }

      if (offer.quantity_remaining <= 0) {
        return { success: false, message: "Это предложение распродано." };
      }

      if (quantity > maxQuantityFor(offer)) {
        return {
          success: false,
          message: `Доступно только ${maxQuantityFor(offer)} шт.`,
        };
      }

      // Бизнес-правило backend: одна корзина = один филиал.
      if (
        items.length > 0 &&
        items[0].offer.branch_id !== offer.branch_id
      ) {
        return {
          success: false,
          message:
            "В одной корзине можно заказать товары только из одного филиала.",
        };
      }

      const existing = items.find((item) => item.offer.id === offer.id);

      if (existing) {
        const nextQuantity = existing.quantity + quantity;

        if (nextQuantity > maxQuantityFor(offer)) {
          return {
            success: false,
            message: `Доступно только ${maxQuantityFor(offer)} шт.`,
          };
        }

        setItems((current) =>
          current.map((item) =>
            item.offer.id === offer.id
              ? { offer, quantity: nextQuantity }
              : item,
          ),
        );

        return {
          success: true,
          message: "Количество обновлено в корзине.",
        };
      }

      setItems((current) => [...current, { offer, quantity }]);

      return { success: true, message: "Добавлено в корзину." };
    },
    [items],
  );

  const updateQuantity = useCallback(
    (offerId: string, quantity: number) => {
      setItems((current) =>
        current.map((item) => {
          if (item.offer.id !== offerId) {
            return item;
          }

          const limit = maxQuantityFor(item.offer);

          return {
            ...item,
            quantity: Math.max(1, Math.min(quantity, Math.max(1, limit))),
          };
        }),
      );
    },
    [],
  );

  const increment = useCallback(
    (offerId: string) => {
      setItems((current) =>
        current.map((item) => {
          if (item.offer.id !== offerId) {
            return item;
          }

          const limit = maxQuantityFor(item.offer);

          return {
            ...item,
            quantity: Math.min(item.quantity + 1, Math.max(1, limit)),
          };
        }),
      );
    },
    [],
  );

  const decrement = useCallback((offerId: string) => {
    setItems((current) =>
      current.map((item) =>
        item.offer.id === offerId
          ? { ...item, quantity: Math.max(1, item.quantity - 1) }
          : item,
      ),
    );
  }, []);

  const removeItem = useCallback((offerId: string) => {
    setItems((current) =>
      current.filter((item) => item.offer.id !== offerId),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  /**
   * Витрина обновилась — подтягиваем актуальные цены и остатки,
   * а пропавшие или распроданные позиции убираем из корзины.
   */
  const syncWithOffers = useCallback((offers: PublicOffer[]) => {
    if (offers.length === 0) {
      return;
    }

    const byId = new Map(offers.map((offer) => [offer.id, offer]));

    setItems((current) => {
      let changed = false;

      const next: CartItem[] = [];

      for (const item of current) {
        const fresh = byId.get(item.offer.id);

        if (!fresh) {
          // Оффера больше нет в публичной выдаче — оставляем
          // как есть, checkout сам вернёт понятную ошибку.
          next.push(item);
          continue;
        }

        const limit = Math.max(1, maxQuantityFor(fresh));
        const quantity = Math.min(item.quantity, limit);

        if (
          fresh !== item.offer ||
          quantity !== item.quantity
        ) {
          changed = true;
        }

        next.push({ offer: fresh, quantity });
      }

      return changed ? next : current;
    });
  }, []);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const totalPrice = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + toNumber(item.offer.sale_price) * item.quantity,
        0,
      ),
    [items],
  );

  const first = items[0] ?? null;

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      loading,
      totalItems,
      totalPrice,
      branchId: first?.offer.branch_id ?? null,
      branchName: first?.offer.branch_name ?? null,
      businessName: first?.offer.business_name ?? null,
      address: first?.offer.address ?? null,
      addItem,
      updateQuantity,
      increment,
      decrement,
      removeItem,
      clearCart,
      syncWithOffers,
    }),
    [
      items,
      loading,
      totalItems,
      totalPrice,
      first,
      addItem,
      updateQuantity,
      increment,
      decrement,
      removeItem,
      clearCart,
      syncWithOffers,
    ],
  );

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
