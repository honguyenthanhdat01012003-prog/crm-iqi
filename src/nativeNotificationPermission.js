import { areSystemNotificationsEnabled, openAppNotificationSettings } from "./crmNotifications.js";
import { isNativePushSupported, getNativePushPermissionState } from "./nativePush.js";
import { isNativeLocalNotificationSupported, getNativeLocalPermissionState, requestNativeLocalNotificationPermission } from "./nativeLocalNotifications.js";

export const NATIVE_PERM_PROMPT_KEY = "crm_native_perm_rationale_seen";
export const NATIVE_PUSH_SETUP_KEY = "crm_native_push_setup_v2";

export function isCapacitorNativeApp() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

const LEAD_PUSH_CHANNELS = [
  { id: "lead_notifications_manager_v4", name: "Lead moi quan ly", sound: "default" },
  { id: "lead_notifications_sale_v4", name: "Lead moi sale", sound: "default" },
  { id: "lead_notifications", name: "Lead moi", sound: "default" },
];

export async function ensureNativeNotificationChannels() {
  if (!isCapacitorNativeApp()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    if (typeof PushNotifications.createChannel !== "function") return;
    for (const channel of LEAD_PUSH_CHANNELS) {
      await PushNotifications.createChannel({
        id: channel.id,
        name: channel.name,
        description: "Thong bao lead moi ngay ca khi tat app",
        importance: 5,
        visibility: 1,
        sound: channel.sound,
        vibration: true,
      }).catch(() => {});
    }
  } catch {
    // Channels are also created natively in MainActivity.onCreate
  }
}

export async function getNativeNotificationPermissionSnapshot() {
  if (!isCapacitorNativeApp()) {
    return { supported: false, permission: "unsupported", systemEnabled: false, ready: false };
  }

  const pushSupported = isNativePushSupported();
  const localSupported = isNativeLocalNotificationSupported();
  const permission = pushSupported
    ? await getNativePushPermissionState()
    : localSupported
      ? await getNativeLocalPermissionState()
      : "unsupported";
  const systemEnabled = await areSystemNotificationsEnabled();
  const ready = permission === "granted" && systemEnabled;

  return {
    supported: pushSupported || localSupported,
    pushSupported,
    localSupported,
    permission,
    systemEnabled,
    ready,
  };
}

/**
 * Android 13+ flow (per Google docs):
 * 1. Create notification channels first
 * 2. Show in-app rationale (handled by caller UI)
 * 3. Request POST_NOTIFICATIONS via Capacitor
 * 4. Verify areNotificationsEnabled() before sending/registering FCM
 */
export async function requestNativeNotificationPermissionWithContext() {
  if (!isCapacitorNativeApp()) return { ok: false, reason: "not-native" };

  await ensureNativeNotificationChannels();

  try {
    if (isNativePushSupported()) {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive !== "granted") {
        perm = await PushNotifications.requestPermissions();
      }
      const systemEnabled = await areSystemNotificationsEnabled();
      const granted = perm.receive === "granted" && systemEnabled;
      return {
        ok: granted,
        permission: perm.receive === "granted" && !systemEnabled ? "denied" : perm.receive,
        systemEnabled,
        mode: "push",
      };
    }

    if (isNativeLocalNotificationSupported()) {
      const result = await requestNativeLocalNotificationPermission();
      const systemEnabled = await areSystemNotificationsEnabled();
      return {
        ...result,
        ok: !!result.ok && systemEnabled,
        systemEnabled,
        mode: "local",
      };
    }

    return { ok: false, reason: "unsupported" };
  } catch (err) {
    console.warn("[NativeNotificationPermission] Request failed:", err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function shouldShowNativeNotificationPrompt() {
  if (!isCapacitorNativeApp()) return false;
  const pushSupported = isNativePushSupported();
  const localSupported = isNativeLocalNotificationSupported();
  if (!pushSupported && !localSupported) return false;
  if (localStorage.getItem(NATIVE_PUSH_SETUP_KEY) === "1") return false;
  if (pushSupported) {
    const cachedToken = localStorage.getItem("crm_native_push_token") || "";
    if (cachedToken.length > 20) return false;
  }
  return true;
}

export { openAppNotificationSettings };
