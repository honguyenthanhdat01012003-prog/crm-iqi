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

export async function getNativePushPermissionState() {
  if (!isNativePushSupported()) return "unsupported";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await withTimeout(
      PushNotifications.checkPermissions(),
      4000,
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
  const channels = [
    { id: "lead_notifications_manager_v4", name: "Lead moi quan ly", sound: "default" },
    { id: "lead_notifications_sale_v4", name: "Lead moi sale", sound: "default" },
    { id: "lead_notifications_recall_v2", name: "Thu hoi lead", sound: "lead_recall" },
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

async function waitForNativePushToken(PushNotifications, timeoutMs = 30000) {
  // LUÔN xin token mới từ FCM thay vì tin cache — token cache có thể đã chết
  // sau khi update/cài lại app (FCM vẫn trả OK nhưng Apple không giao nữa).
  // Cache chỉ dùng làm fallback nếu FCM không phản hồi kịp.
  const existing = localStorage.getItem("crm_native_push_token") || "";
  const fallbackMs = existing.length > 20 ? 8000 : timeoutMs;

  return new Promise((resolve, reject) => {
    let done = false;
    let removeRegistration = null;
    let removeError = null;
    const cleanup = () => {
      removeRegistration?.remove?.();
      removeError?.remove?.();
    };
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      if (existing.length > 20) resolve(existing);
      else reject(new Error("Không nhận được FCM token từ Google"));
    }, fallbackMs);

    PushNotifications.addListener("registration", (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      const value = result?.value || "";
      if (value) localStorage.setItem("crm_native_push_token", value);
      resolve(value);
    }).then((handle) => { removeRegistration = handle; });

    PushNotifications.addListener("registrationError", (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error(error?.error || "Đăng ký FCM thất bại"));
    }).then((handle) => { removeError = handle; });

    try {
      PushNotifications.register();
    } catch (err) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error(err?.message || "Đăng ký FCM thất bại"));
    }
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

  try {
    const token = await waitForNativePushToken(PushNotifications);
    if (!token || token.length < 20) return { ok: false, error: "FCM token rỗng" };
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
    return { ok: false, error: err?.message || String(err) };
  }
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
