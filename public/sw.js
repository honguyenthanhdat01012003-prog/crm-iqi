const CACHE_NAME = "lux-iqi-crm-pwa-v2";
const APP_SHELL = ["/", "/logo-iqi.svg", "/site.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/socket.io")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/") || caches.match("/index.html"))
    );
    return;
  }

  const staticDestinations = new Set(["script", "style", "image", "font", "manifest"]);
  if (!staticDestinations.has(request.destination)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "LUX IQI CRM";
  const sound = payload.sound || payload.data?.sound || "";
  const options = {
    body: payload.body || "Bạn có thông báo mới",
    icon: "/logo-iqi.svg",
    badge: "/logo-iqi.svg",
    tag: payload.tag || "lux-iqi-crm",
    renotify: true,
    requireInteraction: !!payload.requireInteraction,
    vibrate: [180, 80, 180],
    data: payload.data || { url: "/" },
  };

  const tasks = [self.registration.showNotification(title, options)];
  if (sound) {
    tasks.push(clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => client.postMessage({ type: "CRM_PUSH_SOUND", sound }));
    }));
  }

  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const absoluteUrl = new URL(targetUrl, self.location.origin).href;
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin) {
          if ("navigate" in client) return client.navigate(absoluteUrl).then(() => client.focus());
          return client.focus();
        }
      }
      return clients.openWindow(absoluteUrl);
    })
  );
});
