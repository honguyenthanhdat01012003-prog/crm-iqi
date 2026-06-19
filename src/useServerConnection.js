import { useCallback, useEffect, useRef, useState } from "react";

const VERSION_TIMEOUT_MS = 15000;
const HEALTH_INTERVAL_MS = 30000;
const FAILURES_BEFORE_DOWN = 2;
/** No banner if any API call succeeded within this window. */
const RECENT_API_OK_MS = 45000;

/**
 * Tracks server reachability without flashing false alarms on a single slow /version.
 * Banner/maintenance only after consecutive health failures AND no recent successful API traffic.
 */
export function useServerConnection(apiBase) {
  const [serverDown, setServerDown] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  const failStreakRef = useRef(0);
  const lastApiOkRef = useRef(0);
  const socketConnectedRef = useRef(false);

  const evaluateServerDown = useCallback(() => {
    const noRecentApi = Date.now() - lastApiOkRef.current > RECENT_API_OK_MS;
    const shouldDown =
      failStreakRef.current >= FAILURES_BEFORE_DOWN &&
      noRecentApi &&
      !socketConnectedRef.current;
    setServerDown(shouldDown);
  }, []);

  const markApiOk = useCallback(() => {
    lastApiOkRef.current = Date.now();
    failStreakRef.current = 0;
    setServerDown(false);
  }, []);

  const markInitialDataLoaded = useCallback(() => {
    setInitialDataLoaded(true);
    markApiOk();
  }, [markApiOk]);

  const markApiFailure = useCallback(() => {
    failStreakRef.current += 1;
    evaluateServerDown();
  }, [evaluateServerDown]);

  const markSocketConnected = useCallback(() => {
    socketConnectedRef.current = true;
    failStreakRef.current = 0;
    setServerDown(false);
  }, []);

  const markSocketDisconnected = useCallback(() => {
    socketConnectedRef.current = false;
    evaluateServerDown();
  }, [evaluateServerDown]);

  const pingVersion = useCallback(() => {
    return fetch(`${apiBase}/version`, {
      signal: AbortSignal.timeout(VERSION_TIMEOUT_MS),
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((v) => {
        failStreakRef.current = 0;
        const noRecentApi = Date.now() - lastApiOkRef.current > RECENT_API_OK_MS;
        if (!noRecentApi || socketConnectedRef.current) setServerDown(false);
        return v;
      })
      .catch(() => {
        failStreakRef.current += 1;
        evaluateServerDown();
        throw new Error("version ping failed");
      });
  }, [apiBase, evaluateServerDown]);

  useEffect(() => {
    pingVersion()
      .then((v) => console.log(`[CRM] Server version: ${v.version} uptime: ${Math.round(v.uptime)}s`))
      .catch(() => {});
    const iv = setInterval(() => {
      pingVersion().catch(() => {});
    }, HEALTH_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [pingVersion]);

  return {
    serverDown,
    initialDataLoaded,
    markApiOk,
    markInitialDataLoaded,
    markApiFailure,
    markSocketConnected,
    markSocketDisconnected,
  };
}
