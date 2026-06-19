export {
  isCapacitorNativeApp,
  ensureNativeNotificationChannels,
  getNativeNotificationPermissionSnapshot,
  requestNativeNotificationPermissionWithContext,
  shouldShowNativeNotificationPrompt,
  openAppNotificationSettings,
  NATIVE_PERM_PROMPT_KEY,
} from "./nativeNotificationPermission.js";

/** @deprecated use requestNativeNotificationPermissionWithContext */
export async function requestNativeNotificationPermissionOnStartup() {
  const { requestNativeNotificationPermissionWithContext } = await import("./nativeNotificationPermission.js");
  return requestNativeNotificationPermissionWithContext();
}
