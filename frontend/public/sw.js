/*
  Service worker для web-push.

  Работает при закрытой вкладке — именно ради этого он и нужен.
  Регистрируется из components/PushSubscription.tsx.
*/

self.addEventListener("install", () => {
  // Не ждём закрытия старых вкладок: иначе после обновления
  // новый воркер простаивает, пока пользователь не закроет всё.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "SAVEAT",
    body: "Новое уведомление",
    order_id: null,
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      // tag по заказу: повторные события одного заказа заменяют
      // друг друга, а не копятся стопкой в шторке.
      tag: payload.order_id
        ? `order-${payload.order_id}`
        : undefined,
      data: {
        order_id: payload.order_id,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const orderId = event.notification.data?.order_id;
  const target = orderId ? `/orders/${orderId}` : "/notifications";

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Если вкладка приложения уже открыта — переиспользуем её,
        // а не плодим новую на каждый клик по уведомлению.
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }

        return self.clients.openWindow(target);
      }),
  );
});
