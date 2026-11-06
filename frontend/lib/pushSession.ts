const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";
let pending: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = pending.then(operation, operation);
  pending = next.catch(() => undefined);
  return next;
}

export async function registerPushSession(subscription: PushSubscription, token: string): Promise<void> {
  return serialize(async () => {
  if (localStorage.getItem("access_token") !== token) return;
  const json = subscription.toJSON();
  const response = await fetch(`${API_URL}/push/subscribe`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint: subscription.endpoint, p256dh: json.keys?.p256dh,
      auth: json.keys?.auth, platform: "web" }),
  });
  if (!response.ok) throw new Error("Push registration failed");
  });
}

export async function closePushSession(token: string | null): Promise<void> {
  return serialize(async () => {
  // Revoke while the captured credential is still available, even if the UI is logged out.
  const revoke = token ? fetch(`${API_URL}/auth/logout`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000),
  }).catch(() => undefined) : Promise.resolve();
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();
      const notifications = await registration?.getNotifications();
      notifications?.forEach((notification) => notification.close());
    }
  } finally {
    await revoke;
  }
  });
}
