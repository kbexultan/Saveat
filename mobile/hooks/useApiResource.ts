import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { isAbortError, toErrorMessage } from "@/lib/api";

type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

type Options = {
  /** Пока false — запрос не уходит (например, ждём выбранный бизнес). */
  enabled?: boolean;
  /** Перезагружать данные при каждом возврате на экран. */
  reloadOnFocus?: boolean;
};

/**
 * Загрузка данных API с готовыми loading / error / refreshing.
 *
 * `loader` обязан быть стабильным (useCallback) — его изменение
 * и есть сигнал «перезапросить».
 */
export function useApiResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  { enabled = true, reloadOnFocus = false }: Options = {},
) {
  const [state, setState] = useState<ResourceState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // Сменился loader — значит, запрашиваем уже другие данные
  // (другой бизнес, другой заказ, другой pickup-код).
  // Старый результат показывать нельзя, возвращаемся в загрузку.
  const [trackedLoader, setTrackedLoader] = useState(() => loader);

  if (trackedLoader !== loader) {
    setTrackedLoader(() => loader);
    setState({ data: null, loading: true, error: null });
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    loader(controller.signal)
      .then((data) => {
        if (active) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) {
          return;
        }

        setState({
          data: null,
          loading: false,
          error: toErrorMessage(error),
        });
      })
      .finally(() => {
        if (active) {
          setRefreshing(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [loader, enabled, reloadToken]);

  // Вызывается из обработчиков («Повторить», «Обновить»),
  // поэтому можно сразу показать индикатор загрузки.
  const reload = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    setReloadToken((current) => current + 1);
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setReloadToken((current) => current + 1);
  }, []);

  const setData = useCallback((data: T) => {
    setState({ data, loading: false, error: null });
  }, []);

  const skipFirstFocusRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (!reloadOnFocus) {
        return;
      }

      // Первый фокус совпадает с первичной загрузкой.
      if (skipFirstFocusRef.current) {
        skipFirstFocusRef.current = false;
        return;
      }

      setReloadToken((current) => current + 1);
    }, [reloadOnFocus]),
  );

  return {
    // Пока ресурс выключен, у него нет ни данных, ни состояния
    // загрузки: показывать нечего и ждать нечего.
    data: enabled ? state.data : null,
    loading: enabled ? state.loading : false,
    error: enabled ? state.error : null,
    refreshing,
    reload,
    refresh,
    setData,
  };
}
