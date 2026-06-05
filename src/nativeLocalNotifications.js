function isCapacitorNative() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

export function isNativeLocalNotificationSupported() {
  return isCapacitorNative();
}

export async function getNativeLocalPermissionState() {
  if (!isNativeLocalNotificationSupported()) return "unsupported";
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const perm = await LocalNotifications.checkPermissions();
    return perm.display === "granted" ? "granted" : perm.display === "denied" ? "denied" : "default";
  } catch {
    return "unsupported";
  }
}

export async function requestNativeLocalNotificationPermission() {
  if (!isNativeLocalNotificationSupported()) return { ok: false, permission: "unsupported" };
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return { ok: false, permission: perm.display };

  try {
    await LocalNotifications.createChannel({
      id: "lead_notifications",
      name: "Lead mới",
      description: "Thông báo khi có lead mới trong CRM",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
    });
  } catch (_) {}

  return { ok: true, permission: "granted" };
}

export async function showNativeLeadNotification({ title, body, leadId, sound = "default" }) {
  if (!isNativeLocalNotificationSupported()) return;
  const permission = await getNativeLocalPermissionState();
  if (permission !== "granted") return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.schedule({
    notifications: [{
      id: Math.floor(Date.now() % 2147483647),
      title: title || "LUX IQI CRM",
      body: body || "Bạn có lead mới",
      channelId: "lead_notifications",
      sound,
      extra: { leadId },
      schedule: { at: new Date(Date.now() + 100) },
    }],
  });
}
