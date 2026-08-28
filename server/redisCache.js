/**
 * Redis L2 cache — optional, fallback to RAM-only if Redis chưa cài / lỗi kết nối.
 * Invalidation: mỗi payload gắn dataVersion; emitDataChanged() tăng version → cache cũ miss.
 */
import { createClient } from "redis";

let client = null;
let ready = false;
let lastError = "";

const DEFAULT_TTL_SEC = Math.max(15, Number(process.env.REDIS_CACHE_TTL_SEC) || 60);

export function redisDefaultTtlSec() {
  return DEFAULT_TTL_SEC;
}

export function redisCacheKey(prefix, keyPart) {
  const safe = String(keyPart || "").replace(/[^\w|.-]/g, "_").slice(0, 220);
  return `crm:${prefix}:${safe}`;
}

export function isRedisReady() {
  return ready && client?.isOpen;
}

export function getRedisStatus() {
  return {
    ready: isRedisReady(),
    ttlSec: DEFAULT_TTL_SEC,
    url: process.env.REDIS_URL ? "(configured)" : "(default localhost)",
    lastError: lastError || null,
  };
}

export async function initRedisCache() {
  const explicitOff = String(process.env.REDIS_ENABLED || "").trim() === "0";
  if (explicitOff) {
    console.log("[redis] disabled (REDIS_ENABLED=0)");
    return { ok: false, reason: "disabled" };
  }

  const url = (process.env.REDIS_URL || "").trim() || "redis://127.0.0.1:6379";
  try {
    client = createClient({ url });
    client.on("error", (err) => {
      lastError = err?.message || String(err);
    });
    await client.connect();
    ready = true;
    lastError = "";
    const masked = url.replace(/:([^:@/]+)@/, ":***@");
    console.log(`[redis] connected ${masked} ttl=${DEFAULT_TTL_SEC}s`);
    return { ok: true };
  } catch (err) {
    ready = false;
    client = null;
    lastError = err?.message || String(err);
    console.warn(`[redis] connect failed — RAM cache only: ${lastError}`);
    return { ok: false, reason: lastError };
  }
}

export async function redisGetCached(key, expectedVersion) {
  if (!isRedisReady() || !key) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (expectedVersion != null && Number(parsed?.v) !== Number(expectedVersion)) return null;
    if (!parsed?.data) return null;
    return parsed.data;
  } catch (err) {
    lastError = err?.message || String(err);
    console.warn("[redis] get failed:", lastError);
    return null;
  }
}

export async function redisSetCached(key, data, { version, ttlSec = DEFAULT_TTL_SEC } = {}) {
  if (!isRedisReady() || !key || data == null) return false;
  try {
    const payload = JSON.stringify({ v: version, data, at: Date.now() });
    await client.set(key, payload, { EX: Math.max(15, ttlSec) });
    return true;
  } catch (err) {
    lastError = err?.message || String(err);
    console.warn("[redis] set failed:", lastError);
    return false;
  }
}

export async function closeRedisCache() {
  if (client?.isOpen) {
    try {
      await client.quit();
    } catch (_) { /* ignore */ }
  }
  client = null;
  ready = false;
}
