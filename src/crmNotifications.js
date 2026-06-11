import { registerPlugin } from "@capacitor/core";

const CrmNotifications = registerPlugin("CrmNotifications");

export async function areSystemNotificationsEnabled() {
  try {
    const result = await CrmNotifications.areNotificationsEnabled();
    return !!result?.enabled;
  } catch {
    return true;
  }
}

export async function openAppNotificationSettings() {
  try {
    await CrmNotifications.openNotificationSettings();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
