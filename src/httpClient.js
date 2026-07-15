/**
 * HTTP client dùng chung web + Capacitor native.
 * Native: CapacitorHttp (tránh CORS/WKWebView cookie).
 * Web: fetch bình thường.
 */
import { Capacitor, CapacitorHttp } from "@capacitor/core";

const PROD_API_FALLBACK = "https://crm-iqi.id.vn/api";
const PROD_SOCKET_FALLBACK = "https://crm-iqi.id.vn";

export function isNativePlatform() {
  try {
    return typeof window !== "undefined" && !!Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export function getApiBase() {
  const fromEnv = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (isNativePlatform()) return PROD_API_FALLBACK;
  return "/api";
}

export function getSocketUrl() {
  const fromEnv = String(import.meta.env.VITE_SOCKET_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (isNativePlatform()) return PROD_SOCKET_FALLBACK;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Không gắn Content-Type trên GET (native HTTP dễ lỗi silent). */
export function authHeaders(opts = {}) {
  const method = String(opts.method || "GET").toUpperCase();
  const token = localStorage.getItem("crm_token");
  const headers = { ...(opts.headers || {}) };
  if (token && opts.skipAuth !== true) {
    headers.Authorization = `Bearer ${token}`;
  }
  const hasBody = opts.body != null && opts.body !== "";
  if (hasBody || method === "POST" || method === "PUT" || method === "PATCH") {
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
  }
  return headers;
}

function toFetchLikeResponse(status, data, headersObj = {}) {
  const headerMap = new Headers();
  Object.entries(headersObj || {}).forEach(([k, v]) => {
    if (v != null) headerMap.set(k, String(v));
  });

  const isHtml =
    typeof data === "string" &&
    (/^\s*</.test(data) || /<html/i.test(data));

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headerMap,
    url: "",
    async json() {
      if (isHtml) {
        throw new Error("Nhận HTML thay vì JSON — sai API base / rewrite Nginx");
      }
      if (data == null || data === "") return {};
      if (typeof data === "object") return data;
      try {
        return JSON.parse(data);
      } catch {
        throw new Error("JSON không hợp lệ từ API");
      }
    },
    async text() {
      if (typeof data === "string") return data;
      if (data == null) return "";
      return JSON.stringify(data);
    },
    async blob() {
      const text = typeof data === "string" ? data : JSON.stringify(data ?? {});
      return new Blob([text]);
    },
  };
}

function resolveUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) {
    const base = getApiBase();
    // "/api/xxx" khi base đã là ".../api" → tránh /api/api
    if (base.endsWith("/api") && url.startsWith("/api/")) {
      return `${base}${url.slice(4)}`;
    }
    if (base.startsWith("http") && url.startsWith("/api")) {
      return `${base.replace(/\/api$/, "")}${url}`;
    }
    if (base.startsWith("http")) return `${base.replace(/\/$/, "")}${url}`;
  }
  return url;
}

/**
 * Fetch tương thích Response — trên Capacitor dùng CapacitorHttp.
 */
export async function apiFetch(url, opts = {}) {
  const method = String(opts.method || "GET").toUpperCase();
  const headers = authHeaders({
    method,
    body: opts.body,
    skipAuth: opts.skipAuth === true,
    headers: opts.headers,
  });
  const fullUrl = resolveUrl(url);

  if (isNativePlatform()) {
    let data;
    if (opts.body != null && opts.body !== "") {
      try {
        data = typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body;
      } catch {
        data = opts.body;
      }
    }
    const resp = await CapacitorHttp.request({
      url: fullUrl,
      method,
      headers,
      data,
      connectTimeout: opts.timeoutMs || 60000,
      readTimeout: opts.timeoutMs || 60000,
    });
    const out = toFetchLikeResponse(resp.status || 0, resp.data, resp.headers);
    if (out.status === 401 && opts.skipAuth !== true) {
      localStorage.removeItem("crm_token");
      localStorage.removeItem("crm_user");
      window.location.reload();
      throw new Error("Unauthorized");
    }
    return out;
  }

  const res = await fetch(fullUrl, {
    ...opts,
    method,
    headers,
  });
  if (res.status === 401 && opts.skipAuth !== true) {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    window.location.reload();
    throw new Error("Unauthorized");
  }
  return res;
}
