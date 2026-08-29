import { App as CapApp } from "@capacitor/app";
import { apiFetch, getApiBase, isNativePlatform } from "./httpClient.js";
import { isVersionBelow } from "./utils/semver.js";

/** Fallback nếu App.getInfo() lỗi — nên khớp Version trên Xcode khi Archive. */
export const FALLBACK_NATIVE_APP_VERSION = "1.3.0";

export async function getInstalledAppVersion() {
  if (!isNativePlatform()) return { version: "", build: "", platform: "web" };
  try {
    const info = await CapApp.getInfo();
    return {
      version: String(info?.version || FALLBACK_NATIVE_APP_VERSION).trim(),
      build: String(info?.build || "").trim(),
      platform: window.Capacitor?.getPlatform?.() || "native",
      name: info?.name || "",
    };
  } catch {
    return {
      version: FALLBACK_NATIVE_APP_VERSION,
      build: "",
      platform: window.Capacitor?.getPlatform?.() || "native",
    };
  }
}

export async function checkForceAppUpdate() {
  if (!isNativePlatform()) {
    return { required: false, skipped: true };
  }
  const installed = await getInstalledAppVersion();
  const platform = (window.Capacitor?.getPlatform?.() || installed.platform || "").toLowerCase();
  let policy = null;
  try {
    const r = await apiFetch(`${getApiBase()}/version`, { skipAuth: true, timeoutMs: 8000 });
    if (r.ok) {
      const data = await r.json();
      policy = data?.appUpdate || null;
    }
  } catch {
    // Không chặn khi mất mạng — user vẫn vào được
    return { required: false, offline: true, installed };
  }
  if (!policy || policy.force === false) {
    return { required: false, installed, policy };
  }
  const platformPolicy =
    platform === "ios" ? policy.ios : platform === "android" ? policy.android : null;
  const minVersion = String(platformPolicy?.minVersion || policy.minVersion || "").trim();
  if (!minVersion) {
    return { required: false, installed, policy };
  }
  const required = isVersionBelow(installed.version, minVersion);
  return {
    required,
    installed,
    policy,
    minVersion,
    storeUrl: String(platformPolicy?.storeUrl || policy.storeUrl || "").trim(),
    message:
      String(policy.message || "").trim() ||
      "Phiên bản ứng dụng đã cũ. Vui lòng cập nhật để tiếp tục sử dụng CRM.",
    platform,
  };
}

export function openStoreUrl(url) {
  const href = String(url || "").trim();
  if (!href) return;
  try {
    window.location.href = href;
  } catch {
    window.open(href, "_blank", "noopener,noreferrer");
  }
}
