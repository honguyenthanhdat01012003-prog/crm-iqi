import { isNativePushSupported } from "./nativePush.js";
import { isNativeLocalNotificationSupported, requestNativeLocalNotificationPermission } from "./nativeLocalNotifications.js";

export function isCapacitorNativeApp() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

export async function requestNativeNotificationPermissionOnStartup() {
  if (!isCapacitorNativeApp()) return { ok: false, reason: "not-native" };

  try {
    if (isNativePushSupported()) {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive !== "granted") {
        perm = await PushNotifications.requestPermissions();
      }
      return { ok: perm.receive === "granted", permission: perm.receive, mode: "push" };
    }

    if (isNativeLocalNotificationSupported()) {
      const result = await requestNativeLocalNotificationPermission();
      return { ...result, mode: "local" };
    }

    return { ok: false, reason: "unsupported" };
  } catch (err) {
    console.warn("[NativeStartup] Permission request failed:", err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}
