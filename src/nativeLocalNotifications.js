function isCapacitorNative() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

const LEAD_CHANNELS = [
  { id: "lead_notifications_manager_v2", name: "Lead moi quan ly", sound: "lead_manager" },
  { id: "lead_notifications_sale_v2", name: "Lead moi sale", sound: "lead_sale" },
  { id: "lead_notifications", name: "Lead moi", sound: "default" },
];

function getLeadChannelId(sound) {
  if (sound === "sale") return "lead_notifications_sale_v2";
  if (sound === "manager") return "lead_notifications_manager_v2";
  return "lead_notifications";
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
    for (const channel of LEAD_CHANNELS) {
      await LocalNotifications.createChannel({
        id: channel.id,
        name: channel.name,
        description: "Thong bao khi co lead moi trong CRM",
        importance: 5,
        visibility: 1,
        sound: channel.sound,
        vibration: true,
      });
    }
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
      body: body || "Ban co lead moi",
      channelId: getLeadChannelId(sound),
      sound: sound === "sale" ? "lead_sale" : sound === "manager" ? "lead_manager" : sound,
      extra: { leadId },
      schedule: { at: new Date(Date.now() + 100) },
    }],
  });
}
