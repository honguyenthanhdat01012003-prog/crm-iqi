import { useCallback, useEffect, useRef, useState } from "react";

/** Số lần poll/heartbeat fail liên tiếp trước khi hiện banner (~50–100 giây). */
const FAILURES_BEFORE_BANNER = 5;
/** Có API OK trong khoảng này → không bao giờ hiện banner. */
const RECENT_OK_MS = 120000;

/**
 * Chỉ theo dõi kết nối qua API thực tế (poll, heartbeat, /data).
 * KHÔNG dùng /api/version hay socket disconnect để bật banner — tránh báo giả trên mobile/PWA.
 */
export function useServerConnection() {
  const [serverDown, setServerDown] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [bootFailed, setBootFailed] = useState(false);

  const failStreakRef = useRef(0);
  const lastOkRef = useRef(0);

  const markApiOk = useCallback(() => {
    lastOkRef.current = Date.now();
    failStreakRef.current = 0;
    setServerDown(false);
  }, []);

  const markConnectivityFailure = useCallback(() => {
    // Tab/app nền: trình duyệt throttle request → bỏ qua, tránh banner giả
    if (typeof document !== "undefined" && document.hidden) return;

    failStreakRef.current += 1;
    const stale = Date.now() - lastOkRef.current > RECENT_OK_MS;
    if (failStreakRef.current >= FAILURES_BEFORE_BANNER && stale) {
      setServerDown(true);
    }
  }, []);

  const markInitialDataLoaded = useCallback(() => {
    setInitialDataLoaded(true);
    setBootFailed(false);
    markApiOk();
  }, [markApiOk]);

  /** Load /data lần đầu thất bại hết retry → trang bảo trì. */
  const markBootFailed = useCallback(() => {
    setBootFailed(true);
    setServerDown(true);
  }, []);

  const clearBootFailed = useCallback(() => {
    setBootFailed(false);
  }, []);

  /** Socket connect = server sống; chỉ dùng để gỡ banner, không dùng disconnect để bật. */
  const markSocketConnected = useCallback(() => {
    markApiOk();
  }, [markApiOk]);

  const markSocketDisconnected = useCallback(() => {
    // Cố ý không làm gì — socket hay ngắt tạm trên mobile, poll vẫn OK
  }, []);

  // Quay lại app → gỡ banner nếu vừa có API OK gần đây
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      if (lastOkRef.current && Date.now() - lastOkRef.current < RECENT_OK_MS) {
        failStreakRef.current = 0;
        setServerDown(false);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return {
    serverDown,
    initialDataLoaded,
    bootFailed,
    markApiOk,
    markInitialDataLoaded,
    markBootFailed,
    clearBootFailed,
    markConnectivityFailure,
    markSocketConnected,
    markSocketDisconnected,
  };
}
