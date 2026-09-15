"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";

/**
 * VAPID-ключ приходит base64url, а pushManager ждёт Uint8Array.
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4,
  );

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}

function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

type Status =
  | "unsupported"
  | "disabled"
  | "idle"
  | "subscribed"
  | "denied";

export function usePushSubscription() {
  const { user } = useAuth();
  const toast = useToast();

  const [status, setStatus] = useState<Status>("idle");
  const [busy, setBusy] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (!pushSupported()) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/push/public-key`,
        );

        if (!response.ok) {
          if (!cancelled) setStatus("disabled");
          return;
        }

        const data: {
          enabled: boolean;
          public_key: string | null;
        } = await response.json();

        if (cancelled) return;

        // Сервер без VAPID-ключей push отправить не сможет, поэтому
        // и предлагать подписку незачем.
        if (!data.enabled || !data.public_key) {
          setStatus("disabled");
          return;
        }

        setPublicKey(data.public_key);

        if (Notification.permission === "denied") {
          setStatus("denied");
          return;
        }

        const registration =
          await navigator.serviceWorker.getRegistration();

        const existing =
          await registration?.pushManager.getSubscription();

        if (!cancelled) {
          setStatus(existing ? "subscribed" : "idle");
        }
      } catch (error) {
        console.error("Push detection failed:", error);
        if (!cancelled) setStatus("disabled");
      }
    }

    void detect();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const subscribe = useCallback(async () => {
    if (!publicKey || busy) {
      return;
    }

    setBusy(true);

    try {
      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus(
          permission === "denied" ? "denied" : "idle",
        );

        toast.error(
          "Уведомления отключены",
          "Разрешите показ уведомлений в настройках браузера.",
        );

        return;
      }

      const registration =
        await navigator.serviceWorker.register("/sw.js");

      // Без ready подписка может уйти раньше, чем воркер активен,
      // и pushManager отдаст ошибку.
      await navigator.serviceWorker.ready;

      const subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(publicKey),
        });

      const json = subscription.toJSON();

      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `${API_URL}/push/subscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            p256dh: json.keys?.p256dh ?? null,
            auth: json.keys?.auth ?? null,
            platform: "web",
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Subscribe failed: ${response.status}`,
        );
      }

      setStatus("subscribed");

      toast.success(
        "Push-уведомления включены",
        "Сообщим о заказах, даже если вкладка закрыта.",
      );
    } catch (error) {
      console.error("Push subscribe failed:", error);

      toast.error(
        "Не удалось включить push",
        "Попробуйте ещё раз позже.",
      );
    } finally {
      setBusy(false);
    }
  }, [publicKey, busy, toast]);

  const unsubscribe = useCallback(async () => {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      const registration =
        await navigator.serviceWorker.getRegistration();

      const subscription =
        await registration?.pushManager.getSubscription();

      if (subscription) {
        const token =
          localStorage.getItem("access_token");

        // Сначала снимаем на сервере: если сделать наоборот и запрос
        // упадёт, в базе останется мёртвая подписка, на которую мы
        // будем безуспешно слать push.
        await fetch(`${API_URL}/push/unsubscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        });

        await subscription.unsubscribe();
      }

      setStatus("idle");

      toast.success("Push-уведомления выключены");
    } catch (error) {
      console.error("Push unsubscribe failed:", error);

      toast.error("Не удалось выключить push");
    } finally {
      setBusy(false);
    }
  }, [busy, toast]);

  return {
    status,
    busy,
    subscribe,
    unsubscribe,
  };
}
