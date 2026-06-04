let serviceWorkerRegistrationPromise = null;

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    serviceWorkerRegistrationPromise = navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[PWA] Service worker registration failed:", err);
      return null;
    });
  });
}

export function isPushNotificationSupported() {
  return import.meta.env.PROD
    && typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export function getPushPermissionState() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

async function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) throw new Error("Thiết bị không hỗ trợ service worker");
  if (serviceWorkerRegistrationPromise) {
    const reg = await serviceWorkerRegistrationPromise;
    if (reg) return reg;
  }
  return navigator.serviceWorker.ready;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function getCurrentPushSubscription() {
  if (!isPushNotificationSupported()) return null;
  const reg = await getServiceWorkerRegistration();
  return reg.pushManager.getSubscription();
}

export async function subscribeToPushNotifications(apiFetch, apiBase = "/api") {
  if (!isPushNotificationSupported()) throw new Error("Trình duyệt này chưa hỗ trợ thông báo nền");

  const keyRes = await apiFetch(`${apiBase}/push/public-key`);
  const keyData = await keyRes.json().catch(() => ({}));
  if (!keyRes.ok || !keyData.enabled || !keyData.publicKey) {
    throw new Error(keyData.error || "Server chưa sẵn sàng cho push notification");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, permission };

  const reg = await getServiceWorkerRegistration();
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });
  }

  const saveRes = await apiFetch(`${apiBase}/push/subscribe`, {
    method: "POST",
    body: JSON.stringify({ subscription, userAgent: navigator.userAgent }),
  });
  if (!saveRes.ok) {
    const err = await saveRes.json().catch(() => ({}));
    throw new Error(err.error || "Không lưu được thiết bị nhận thông báo");
  }

  return { ok: true, permission, subscription };
}
