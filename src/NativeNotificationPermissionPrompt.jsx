import React, { useState } from "react";
import { Bell } from "lucide-react";
import {
  NATIVE_PUSH_SETUP_KEY,
  openAppNotificationSettings,
  requestNativeNotificationPermissionWithContext,
} from "./nativeNotificationPermission.js";
import { isNativePushSupported, obtainNativePushDeviceToken } from "./nativePush.js";

export function NativeNotificationPermissionPrompt({ onDone, onLater }) {
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");

  const handleActivate = async () => {
    setBusy(true);
    setDenied(false);
    setError("");
    try {
      const perm = await requestNativeNotificationPermissionWithContext();
      if (!perm.ok) {
        if (perm.permission === "denied" || perm.systemEnabled === false) {
          setDenied(true);
          return;
        }
        setError(perm.error || "Chưa cấp quyền thông báo");
        return;
      }

      if (isNativePushSupported()) {
        const fcm = await obtainNativePushDeviceToken();
        if (!fcm.ok) {
          setError(fcm.error || "Không lấy được FCM token. Kiểm tra Google Play Services và build có google-services.json.");
          if (fcm.permission === "denied") setDenied(true);
          return;
        }
      }

      localStorage.setItem(NATIVE_PUSH_SETUP_KEY, "1");
      onDone?.({ granted: true });
    } finally {
      setBusy(false);
    }
  };

  const handleOpenSettings = async () => {
    setBusy(true);
    try {
      await openAppNotificationSettings();
    } finally {
      setBusy(false);
    }
  };

  const handleLater = () => {
    localStorage.setItem(NATIVE_PUSH_SETUP_KEY, "1");
    onLater?.();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10030, background: "rgba(15,23,42,.5)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
    }}>
      <div style={{
        width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, padding: 22,
        boxShadow: "0 24px 60px rgba(15,23,42,.28)", border: "1px solid #e2e8f0",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, background: "#f0faf1", color: "#0f3d1e",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
        }}>
          <Bell size={24} />
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#0f172a", fontWeight: 850 }}>
          Nhận lead khi tắt app
        </h2>
        <p style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.6, color: "#475569" }}>
          Để nhận thông báo + tiếng khi <strong>vuốt tắt app</strong>, cần kích hoạt FCM (Firebase).
          Chỉ bật trong Cài đặt Android là chưa đủ — app phải đăng ký token với Google.
        </p>
        <p style={{ margin: "0 0 18px", fontSize: 12, lineHeight: 1.5, color: "#64748b" }}>
          Bấm <strong>Kích hoạt</strong>. Nếu Android hỏi quyền, chọn <strong>Cho phép</strong>.
        </p>
        {denied && (
          <div style={{
            marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "#fef2f2",
            border: "1px solid #fecaca", color: "#b91c1c", fontSize: 12, lineHeight: 1.5,
          }}>
            Quyền thông báo đang bị chặn. Mở Cài đặt → Apps → LUX IQI CRM → Notifications → bật Show notifications.
          </div>
        )}
        {error && !denied && (
          <div style={{
            marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "#fff7ed",
            border: "1px solid #fed7aa", color: "#9a3412", fontSize: 12, lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}
        <div style={{ display: "grid", gap: 10 }}>
          <button
            type="button"
            onClick={handleActivate}
            disabled={busy}
            style={{
              border: "1px solid #0f3d1e", background: "#0f3d1e", color: "#fff", borderRadius: 10,
              padding: "12px 14px", fontSize: 14, fontWeight: 850, cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.75 : 1,
            }}
          >
            {busy ? "Đang kích hoạt FCM..." : "Kích hoạt thông báo nền"}
          </button>
          {denied && (
            <button
              type="button"
              onClick={handleOpenSettings}
              disabled={busy}
              style={{
                border: "1px solid #d97706", background: "#fffbeb", color: "#92400e", borderRadius: 10,
                padding: "11px 14px", fontSize: 13, fontWeight: 800, cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Mở cài đặt thông báo
            </button>
          )}
          <button
            type="button"
            onClick={handleLater}
            disabled={busy}
            style={{
              border: "1px solid #d9e2dc", background: "#fff", color: "#64748b", borderRadius: 10,
              padding: "11px 14px", fontSize: 13, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Để sau
          </button>
        </div>
      </div>
    </div>
  );
}
