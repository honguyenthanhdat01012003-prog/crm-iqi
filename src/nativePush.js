function isCapacitorNative() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

export function isNativePushSupported() {
  return isCapacitorNative();
}

export async function getNativePushPermissionState() {
  if (!isNativePushSupported()) return "unsupported";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.checkPermissions();
    return perm.receive === "granted" ? "granted" : perm.receive === "denied" ? "denied" : "default";
  } catch {
    return "unsupported";
  }
}

export async function subscribeToNativePushNotifications(apiFetch, apiBase = "/api") {
  if (!isNativePushSupported()) throw new Error("Native push chỉ hỗ trợ trong app Capacitor");
  const { PushNotifications } = await import("@capacitor/push-notifications");

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive !== "granted") perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return { ok: false, permission: perm.receive };

  const token = await new Promise((resolve, reject) => {
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
      reject(new Error("Không nhận được native push token"));
    }, 15000);

    PushNotifications.addListener("registration", (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      resolve(result.value);
    }).then((handle) => { removeRegistration = handle; });

    PushNotifications.addListener("registrationError", (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error(error?.error || "Đăng ký native push thất bại"));
    }).then((handle) => { removeError = handle; });

    PushNotifications.register();
  });

  const platform = window.Capacitor?.getPlatform?.() || "unknown";
  const res = await apiFetch(`${apiBase}/native-push/register`, {
    method: "POST",
    body: JSON.stringify({ token, platform }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Không lưu được native push token");
  return { ok: true, permission: "granted", token };
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
