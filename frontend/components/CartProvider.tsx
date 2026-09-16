"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/components/AuthProvider";
import type { Offer } from "@/components/OfferCard";

export type CartItem = {
  offer: Offer;
  quantity: number;
};

type AddItemResult = {
  success: boolean;
  message?: string;
};

type CartContextType = {
  items: CartItem[];
  totalItems: number;

  addItem: (
    offer: Offer,
    quantity: number,
  ) => AddItemResult;

  updateQuantity: (
    offerId: string,
    quantity: number,
  ) => void;

  removeItem: (
    offerId: string,
  ) => void;

  clearCart: () => void;
};

const CartContext =
  createContext<CartContextType | null>(
    null,
  );

const STORAGE_KEY = "saveat_cart";

type StoredCart = {
  ownerId: string | null;
  items: CartItem[];
};

/**
 * Читает корзину, принадлежащую текущему пользователю.
 *
 * Раньше корзина лежала в localStorage без владельца, поэтому на общем
 * компьютере её видел следующий вошедший: человек логинился и находил
 * в корзине чужие товары.
 *
 * Анонимная корзина (ownerId === null) достаётся тому, кто вошёл, —
 * это обычный сценарий «набрал товары, потом залогинился при оформлении».
 */
function readStoredCart(
  userId: string | null,
): CartItem[] {
  try {
    const saved =
      localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return [];
    }

    const parsed: unknown = JSON.parse(saved);

    // Старый формат — просто массив позиций, без владельца.
    if (Array.isArray(parsed)) {
      return parsed as CartItem[];
    }

    const stored = parsed as StoredCart;

    if (!Array.isArray(stored?.items)) {
      return [];
    }

    if (
      stored.ownerId === null ||
      stored.ownerId === userId
    ) {
      return stored.items;
    }

    return [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [items, setItems] = useState<
    CartItem[]
  >([]);

  const [loaded, setLoaded] =
    useState(false);

  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  // undefined — корзину ещё ни разу не читали для этой сессии.
  const ownerId = useRef<
    string | null | undefined
  >(undefined);

  useEffect(() => {
    /*
      Пока AuthProvider не ответил, userId ещё null. Сравнивать
      владельца в этот момент нельзя — иначе корзина залогиненного
      человека стёрлась бы при каждой перезагрузке страницы.
    */
    if (authLoading) {
      return;
    }

    if (ownerId.current === userId) {
      return;
    }

    ownerId.current = userId;

    // Через таймер, чтобы не дёргать setState синхронно в теле эффекта.
    const timer = setTimeout(() => {
      setItems(readStoredCart(userId));
      setLoaded(true);
    }, 0);

    return () => clearTimeout(timer);
  }, [authLoading, userId]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    // userId в зависимостях, чтобы анонимная корзина после входа
    // перештамповалась на владельца, а не осталась ничьей.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ownerId: userId,
        items,
      }),
    );
  }, [items, loaded, userId]);

  function addItem(
    offer: Offer,
    quantity: number,
  ): AddItemResult {
    if (quantity < 1) {
      return {
        success: false,
        message:
          "Выберите количество.",
      };
    }

    if (
      quantity >
      offer.quantity_remaining
    ) {
      return {
        success: false,
        message:
          "Такого количества нет в наличии.",
      };
    }

    // Для MVP одна корзина =
    // товары одного филиала.
    if (
      items.length > 0 &&
      items[0].offer.branch_id !==
        offer.branch_id
    ) {
      return {
        success: false,
        message:
          "Сейчас в одной корзине можно заказать товары только из одного филиала.",
      };
    }

    const existing =
      items.find(
        (item) =>
          item.offer.id ===
          offer.id,
      );

    if (existing) {
      const newQuantity =
        existing.quantity +
        quantity;

      if (
        newQuantity >
        offer.quantity_remaining
      ) {
        return {
          success: false,
          message: `В наличии только ${offer.quantity_remaining} шт.`,
        };
      }

      setItems((current) =>
        current.map((item) =>
          item.offer.id ===
          offer.id
            ? {
                ...item,
                quantity:
                  newQuantity,
              }
            : item,
        ),
      );

      return {
        success: true,
        message:
          "Количество обновлено в корзине.",
      };
    }

    setItems((current) => [
      ...current,
      {
        offer,
        quantity,
      },
    ]);

    return {
      success: true,
      message:
        "Добавлено в корзину.",
    };
  }

  function updateQuantity(
    offerId: string,
    quantity: number,
  ) {
    setItems((current) =>
      current.map((item) => {
        if (
          item.offer.id !==
          offerId
        ) {
          return item;
        }

        const maxQuantity =
          Math.min(
            item.offer
              .quantity_remaining,
            20,
          );

        return {
          ...item,

          quantity: Math.max(
            1,
            Math.min(
              quantity,
              maxQuantity,
            ),
          ),
        };
      }),
    );
  }

  function removeItem(
    offerId: string,
  ) {
    setItems((current) =>
      current.filter(
        (item) =>
          item.offer.id !==
          offerId,
      ),
    );
  }

  function clearCart() {
    setItems([]);
  }

  const totalItems =
    items.reduce(
      (sum, item) =>
        sum + item.quantity,
      0,
    );

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context =
    useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used inside CartProvider",
    );
  }

  return context;
}