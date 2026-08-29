function isCapacitorNative() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

const LEAD_CHANNELS = [
  { id: "lead_notifications_manager_v6", name: "Lead moi quan ly", sound: "lead_manager" },
  { id: "lead_notifications_sale_v6", name: "Lead moi sale", sound: "lead_sale" },
  { id: "lead_notifications_update_v3", name: "Nhac cap nhat lead", sound: "lead_update" },
  { id: "lead_notifications", name: "Lead moi", sound: "default" },
];

function getLeadChannelId(sound) {
  if (sound === "sale") return "lead_notifications_sale_v6";
  if (sound === "manager") return "lead_notifications_manager_v6";
  if (sound === "update") return "lead_notifications_update_v3";
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
        sound: "default",
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
      sound: "default",
      extra: { leadId },
      schedule: { at: new Date(Date.now() + 100) },
    }],
  });
}

/** Cập nhật số trên icon app (iOS LocalNotifications.badge + clear delivered khi = 0). */
export async function setNativeAppIconBadge(count = 0) {
  if (!isNativeLocalNotificationSupported()) return { ok: false };
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const n = Math.max(0, Math.min(99, Number(count) || 0));
    const badgeId = 88001442;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: badgeId }] });
    } catch { /* ignore */ }
    if (n <= 0) {
      try {
        await LocalNotifications.removeAllDeliveredNotifications();
      } catch { /* ignore */ }
    }
    // iOS: schedule ephemeral notif để gán badge, rồi huỷ khỏi notification center
    await LocalNotifications.schedule({
      notifications: [{
        id: badgeId,
        title: n > 0 ? "LUX IQI CRM" : " ",
        body: n > 0 ? `Bạn có ${n} lead mới` : " ",
        badge: n,
        channelId: "lead_notifications",
        extra: { silentBadge: true },
        schedule: { at: new Date(Date.now() + 80) },
      }],
    });
    if (n <= 0) {
      setTimeout(() => {
        LocalNotifications.cancel({ notifications: [{ id: badgeId }] }).catch(() => {});
        LocalNotifications.removeAllDeliveredNotifications?.().catch(() => {});
      }, 400);
    }
    return { ok: true, count: n };
  } catch (err) {
    console.warn("[badge] setNativeAppIconBadge:", err?.message || err);
    return { ok: false, error: err?.message };
  }
}
