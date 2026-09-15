"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "success" | "error" | "info";

export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
};

type ToastInput = {
  tone?: ToastTone;
  title: string;
  description?: string;
  /** Через сколько миллисекунд убрать. 0 — не убирать автоматически. */
  duration?: number;
};

type ToastContextType = {
  show: (input: ToastInput) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<
  ToastContextType | undefined
>(undefined);

const DEFAULT_DURATION = 4500;

/** Ошибку держим дольше: её нужно успеть прочитать, а не поймать взглядом. */
const ERROR_DURATION = 7000;

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-[#BFD9B8] bg-[#F2F8EF] text-[#3F6138]",
  error: "border-[#E8BDBD] bg-[#FDF1F1] text-[#9C4A4F]",
  info: "border-[#E2C8B5] bg-[#FFFDF9] text-[#5C4949]",
};

const TONE_ICONS: Record<ToastTone, string> = {
  success: "✓",
  error: "!",
  info: "•",
};

export function ToastProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Таймеры держим в ref, чтобы снимать их при ручном закрытии:
  // иначе уже убранный тост через несколько секунд ещё раз дёргает
  // setState и вызывает лишний ререндер.
  const timers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);

    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    setToasts((previous) =>
      previous.filter((toast) => toast.id !== id),
    );
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const tone = input.tone ?? "info";

      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      setToasts((previous) => {
        const next = [
          ...previous,
          {
            id,
            tone,
            title: input.title,
            description: input.description,
          },
        ];

        // Больше трёх плашек одновременно — это уже стена текста
        // поверх интерфейса, самые старые убираем.
        return next.slice(-3);
      });

      const duration =
        input.duration ??
        (tone === "error"
          ? ERROR_DURATION
          : DEFAULT_DURATION);

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }

      return id;
    },
    [dismiss],
  );

  const success = useCallback(
    (title: string, description?: string) =>
      show({ tone: "success", title, description }),
    [show],
  );

  const error = useCallback(
    (title: string, description?: string) =>
      show({ tone: "error", title, description }),
    [show],
  );

  const value = useMemo(
    () => ({ show, success, error, dismiss }),
    [show, success, error, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/*
        Снизу справа на десктопе, сверху на мобильном: внизу экрана
        на телефоне висит плавающая навигация, и тосты бы её накрывали.
      */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 top-4 z-[2000] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg ${TONE_STYLES[toast.tone]}`}
          >
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-bold"
            >
              {TONE_ICONS[toast.tone]}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {toast.title}
              </p>

              {toast.description ? (
                <p className="mt-0.5 text-xs leading-5 opacity-80">
                  {toast.description}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Закрыть уведомление"
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg leading-none opacity-60 transition hover:bg-white/60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (context === undefined) {
    throw new Error(
      "useToast must be used inside ToastProvider",
    );
  }

  return context;
}
