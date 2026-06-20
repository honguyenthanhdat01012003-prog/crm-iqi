const CACHE_NAME = "lux-iqi-crm-pwa-v3";
const OFFLINE_ASSETS = ["/logo-iqi.svg", "/site.webmanifest"];
const RECENT_PUSH_TTL = 10 * 60 * 1000;
const recentPushKeys = new Map();

function getPushKey(payload = {}) {
  const data = payload.data || {};
  const leadIds = Array.isArray(data.leadIds) ? data.leadIds.join(",") : "";
  return String(
    data.leadId ||
    payload.leadId ||
    payload.id ||
    leadIds ||
    payload.tag ||
    `${payload.title || ""}|${payload.body || ""}`
  ).trim();
}

function isRecentDuplicatePush(key) {
  if (!key) return false;
  const now = Date.now();
  for (const [cachedKey, at] of recentPushKeys.entries()) {
    if (now - at > RECENT_PUSH_TTL) recentPushKeys.delete(cachedKey);
  }
  if (recentPushKeys.has(key)) return true;
  recentPushKeys.set(key, now);
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
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

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirst(request, { cacheNav = false } = {}) {
  try {
    const response = await fetch(request);
    if (response?.ok && cacheNav && request.mode === "navigate") {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      return new Response(
        `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>CRM offline</title></head><body style="font-family:Inter,sans-serif;text-align:center;padding:48px 24px;background:#f8fafc;color:#1f2937"><img src="/logo-iqi.svg" width="64" height="64" alt=""/><h1 style="margin:16px 0 8px;font-size:18px">Không có mạng</h1><p style="color:#64748b;font-size:14px">CRM cần kết nối internet. Vuốt xuống để tải lại.</p></body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then((response) => {
    if (response?.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || networkPromise || fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/socket.io")) return;

  // HTML + JS/CSS bundle: luôn ưu tiên mạng (tránh white screen sau deploy)
  if (
    request.mode === "navigate" ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".html") ||
    url.pathname === "/sw.js"
  ) {
    event.respondWith(networkFirst(request, { cacheNav: true }));
    return;
  }

  if (OFFLINE_ASSETS.some((p) => url.pathname === p)) {
    event.respondWith(staleWhileRevalidate(request));
  }
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
  const pushKey = getPushKey(payload);
  if (isRecentDuplicatePush(pushKey)) {
    event.waitUntil(Promise.resolve());
    return;
  }

  const data = {
    ...(payload.data || {}),
    url: payload.data?.url || "/",
    leadId: payload.data?.leadId || payload.leadId || payload.id || null,
    pushKey,
  };
  const options = {
    body: payload.body || "Bạn có thông báo mới",
    icon: "/logo-iqi.svg",
    badge: "/logo-iqi.svg",
    tag: payload.tag || (pushKey ? `lux-iqi-${pushKey}` : "lux-iqi-crm"),
    renotify: false,
    requireInteraction: !!payload.requireInteraction,
    vibrate: [180, 80, 180],
    data,
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
