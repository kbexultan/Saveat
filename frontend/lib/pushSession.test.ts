import assert from "node:assert/strict";
import { test } from "node:test";
import { closePushSession, registerPushSession } from "./pushSession.ts";

test("failed logout request still unsubscribes the browser; next login registers its own session", async () => {
  const calls: string[] = [];
  let token: string | null = "A";
  const originalFetch = globalThis.fetch;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const subscription = { endpoint: "https://fcm.googleapis.com/test", toJSON: () => ({ keys: { p256dh: "key", auth: "key" } }),
    unsubscribe: async () => { calls.push("unsubscribe"); return true; } } as unknown as PushSubscription;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    serviceWorker: { getRegistration: async () => ({ pushManager: { getSubscription: async () => subscription }, getNotifications: async () => [] }) },
  } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => token } });
  globalThis.fetch = async (url, init) => {
    calls.push(`${String(url).split("/").at(-1)}:${(init?.headers as Record<string, string>).Authorization}`);
    if (String(url).endsWith("logout")) throw new TypeError("offline");
    return new Response(null, { status: 204 });
  };
  try {
    const logout = closePushSession("A");
    token = "B";
    const login = registerPushSession(subscription, "B");
    await Promise.all([logout, login]);
    assert.deepEqual(calls, ["logout:Bearer A", "unsubscribe", "subscribe:Bearer B"]);
    await registerPushSession(subscription, "A");
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
    if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
