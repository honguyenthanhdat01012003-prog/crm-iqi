import { areSystemNotificationsEnabled } from "./crmNotifications.js";

function isCapacitorNative() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function isNativePushSupported() {
  return isCapacitorNative() && import.meta.env.VITE_NATIVE_PUSH_ENABLED === "true";
}

export function getNativePushDeviceId() {
  const key = "crm_native_push_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

/** "Android"/"iPhone" để câu thông báo trên máy nào ra đúng máy đó. */
export function getNativePushPlatformLabel() {
  const platform = typeof window !== "undefined" ? (window.Capacitor?.getPlatform?.() || "") : "";
  if (platform === "ios") return "iPhone";
  if (platform === "android") return "Android";
  return "điện thoại";
}

/**
 * MÁY NÀY đã có token trên server chưa.
 * `tokenCount` đếm theo tài khoản nên máy khác / lần cài trước cũng làm nó > 0,
 * khiến máy chưa đăng ký được vẫn bị coi là "đang đồng bộ" và treo mãi ở đó.
 */
export function isDeviceTokenRegistered(status) {
  if (!status?.ok) return false;
  const tokens = Array.isArray(status.tokens) ? status.tokens : [];
  if (!tokens.length) return false;
  const withDeviceId = tokens.filter((t) => String(t?.device_id || t?.deviceId || "").trim());
  // Token cũ lưu trước khi có device_id → không phân biệt được, giữ cách đếm cũ
  if (!withDeviceId.length) return true;
  const deviceId = getNativePushDeviceId();
  return withDeviceId.some((t) => String(t.device_id || t.deviceId || "") === deviceId);
}

export async function getNativePushPermissionState() {
  if (!isNativePushSupported()) return "unsupported";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    // Máy cũ (iPhone X…) mở app lần đầu sau khi cài rất nặng; hết 4 giây là hàm này
    // trả "unsupported" — không phải granted mà cũng không phải denied, nên giao diện
    // rơi vào nhánh không có đường ra.
    const perm = await withTimeout(
      PushNotifications.checkPermissions(),
      12000,
      "Không kiểm tra được quyền thông báo native"
    );
    if (perm.receive !== "granted") {
      return perm.receive === "denied" ? "denied" : "default";
    }
    const systemEnabled = await areSystemNotificationsEnabled();
    return systemEnabled ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}

async function ensureNativePushChannels(PushNotifications) {
  if (typeof PushNotifications.createChannel !== "function") return;
  // channelId phải khớp server getNativeNotificationSound + LeadFirebaseMessagingService
  const channels = [
    { id: "lead_notifications_manager_v6", name: "Lead moi quan ly", sound: "lead_manager" },
    { id: "lead_notifications_sale_v6", name: "Lead moi sale", sound: "lead_sale" },
    { id: "lead_notifications_update_v3", name: "Nhac cap nhat lead", sound: "lead_update" },
    { id: "lead_notifications_recall_v2", name: "Thu hoi lead", sound: "lead_manager" },
    { id: "lead_notifications", name: "Lead moi", sound: "default" },
  ];
  for (const channel of channels) {
    await PushNotifications.createChannel({
      id: channel.id,
      name: channel.name,
      description: "Thong bao khi co lead moi hoac lead duoc chia",
      importance: 5,
      visibility: 1,
      sound: channel.sound,
      vibration: true,
    }).catch(() => {});
  }
}

let nativePushListenersBound = false;
let latestNativePushToken = "";
let latestNativePushError = "";
const nativePushWaiters = new Set();

function resolveNativePushWaiters(token) {
  for (const waiter of nativePushWaiters) waiter.resolve(token);
  nativePushWaiters.clear();
}

function rejectNativePushWaiters(err) {
  for (const waiter of nativePushWaiters) waiter.reject(err);
  nativePushWaiters.clear();
}

/** Gắn listener 1 lần cho cả vòng đời app — không gỡ khi hết giờ chờ. */
export async function ensureNativePushTokenListeners(PushNotifications) {
  if (nativePushListenersBound || !PushNotifications) return;
  nativePushListenersBound = true;
  latestNativePushToken = localStorage.getItem("crm_native_push_token") || "";
  await PushNotifications.addListener("registration", (result) => {
    const value = result?.value || "";
    if (!value) return;
    latestNativePushToken = value;
    latestNativePushError = "";
    localStorage.setItem("crm_native_push_token", value);
    resolveNativePushWaiters(value);
  });
  await PushNotifications.addListener("registrationError", (error) => {
    latestNativePushError = error?.error || "Đăng ký FCM thất bại";
    rejectNativePushWaiters(new Error(latestNativePushError));
  });
}

export async function waitForNativePushToken(PushNotifications, timeoutMs = 30000) {
  await ensureNativePushTokenListeners(PushNotifications);
  const existing = latestNativePushToken || localStorage.getItem("crm_native_push_token") || "";

  try {
    await PushNotifications.register();
  } catch (err) {
    throw new Error(err?.message || "Đăng ký FCM thất bại");
  }

  if (latestNativePushToken.length > 20) return latestNativePushToken;

  return new Promise((resolve, reject) => {
    const waiter = {
      resolve: (token) => {
        clearTimeout(timer);
        nativePushWaiters.delete(waiter);
        resolve(token);
      },
      reject: (err) => {
        clearTimeout(timer);
        nativePushWaiters.delete(waiter);
        reject(err);
      },
    };
    nativePushWaiters.add(waiter);
    const timer = setTimeout(() => {
      nativePushWaiters.delete(waiter);
      const cached = latestNativePushToken || existing;
      if (cached.length > 20) resolve(cached);
      else reject(new Error("Apple/Google không trả token trong " + Math.round(timeoutMs / 1000) + "s"));
    }, timeoutMs);
  });
}

/** Xin quyền + lấy FCM token (chưa cần login). */
export async function obtainNativePushDeviceToken() {
  if (!isNativePushSupported()) return { ok: false, reason: "unsupported" };
  const { PushNotifications } = await import("@capacitor/push-notifications");

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive !== "granted") {
    perm = await withTimeout(
      PushNotifications.requestPermissions(),
      10000,
      "Không mở được hộp thoại xin quyền thông báo"
    );
  }
  if (perm.receive !== "granted") return { ok: false, permission: perm.receive };

  const systemEnabled = await areSystemNotificationsEnabled();
  if (!systemEnabled) return { ok: false, permission: "denied", reason: "system-disabled" };

  await ensureNativePushChannels(PushNotifications);
  await ensureNativePushTokenListeners(PushNotifications);

  // iOS: token có thể về sau lần register đầu (Firebase MessagingDelegate).
  // Listener gắn 1 lần và không gỡ — lần bấm Đăng ký lại vẫn nhận được token trễ.
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2500));
    try {
      const token = await waitForNativePushToken(PushNotifications, attempt === 0 ? 45000 : 20000);
      if (!token || token.length < 20) {
        lastError = "FCM token rỗng";
        continue;
      }
      // APNs device token thường chỉ hex ~64 ký tự — FCM token dài hơn và có ký tự khác
      const looksLikeApnsHex = /^[0-9a-fA-F]{64}$/.test(token);
      if (looksLikeApnsHex) {
        return {
          ok: false,
          error: "Đang lấy APNs token thay vì FCM. Cập nhật AppDelegate (Messaging.messaging().token) rồi build lại.",
        };
      }
      return { ok: true, permission: "granted", token };
    } catch (err) {
      lastError = err?.message || String(err);
    }
  }
  return { ok: false, error: lastError || "Không lấy được FCM token" };
}

export async function syncNativePushTokenToServer(apiFetch, apiBase = "/api") {
  if (!isNativePushSupported()) return { ok: false, skipped: true };
  let token = localStorage.getItem("crm_native_push_token") || "";
  if (!token || token.length < 20) {
    const obtained = await obtainNativePushDeviceToken();
    if (!obtained.ok) return obtained;
    token = obtained.token;
  }
  const platform = window.Capacitor?.getPlatform?.() || "unknown";
  const deviceId = getNativePushDeviceId();
  // Server có thể đang restart — thử tối đa 3 lần, backoff tăng dần
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));
    try {
      const res = await apiFetch(`${apiBase}/native-push/register`, {
        method: "POST",
        timeoutMs: 15000,
        body: JSON.stringify({ token, platform, deviceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        localStorage.setItem("crm_native_push_token", token);
        return { ok: true, token, deviceId, fcmConfigured: data.fcmConfigured };
      }
      lastError = data.error || `Server trả lỗi ${res.status}`;
    } catch (err) {
      lastError = err?.message || String(err);
    }
  }
  return { ok: false, error: lastError || "Không lưu được FCM token lên server" };
}

export async function subscribeToNativePushNotifications(apiFetch, apiBase = "/api") {
  if (!isNativePushSupported()) throw new Error("Native push chỉ hỗ trợ trong app Capacitor");
  const obtained = await obtainNativePushDeviceToken();
  if (!obtained.ok) {
    return {
      ok: false,
      permission: obtained.permission || "denied",
      reason: obtained.reason,
      error: obtained.error,
    };
  }
  const synced = await syncNativePushTokenToServer(apiFetch, apiBase);
  if (!synced.ok) throw new Error(synced.error || "Không lưu được native push token");
  return { ok: true, permission: "granted", token: synced.token, deviceId: synced.deviceId };
}

export async function unregisterNativePushNotifications(apiFetch, apiBase = "/api") {
  if (!isNativePushSupported()) return { ok: true, skipped: true };
  const token = localStorage.getItem("crm_native_push_token") || "";
  if (!token) return { ok: true, skipped: true };
  const res = await apiFetch(`${apiBase}/native-push/unregister`, {
    method: "POST",
    body: JSON.stringify({ token, deviceId: getNativePushDeviceId() }),
  });
  if (res.ok) localStorage.removeItem("crm_native_push_token");
  return { ok: res.ok };
}

export async function getNativePushServerStatus(apiFetch, apiBase = "/api") {
  if (!isNativePushSupported()) return { ok: false, supported: false };
  try {
    const res = await apiFetch(`${apiBase}/native-push/status`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "Không kiểm tra được trạng thái push" };
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function setupNativePushListeners({ onNotification, onAction } = {}) {
  if (!isNativePushSupported()) return () => {};
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const handles = [];
  handles.push(await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    onNotification?.(notification);
  }));
  handles.push(await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
    onAction?.(event);
  }));
  return () => handles.forEach((h) => h?.remove?.());
}

/** Đồng bộ badge icon với server (+ silent APNs). count=0 khi đã xem hết lead. */
export async function syncNativeAppBadge(apiFetch, apiBase = "/api", count = 0) {
  const n = Math.max(0, Math.min(99, Number(count) || 0));
  try {
    const { setNativeAppIconBadge } = await import("./nativeLocalNotifications.js");
    await setNativeAppIconBadge(n);
  } catch { /* ignore */ }
  if (!isNativePushSupported() || typeof apiFetch !== "function") return { ok: true, count: n, localOnly: true };
  try {
    const res = await apiFetch(`${apiBase}/native-push/badge`, {
      method: "POST",
      body: JSON.stringify({ count: n }),
      timeoutMs: 8000,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, count: n, ...data };
  } catch (err) {
    return { ok: false, count: n, error: err?.message };
  }
}
