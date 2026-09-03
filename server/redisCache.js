/**
 * Redis L2 cache — OPT-IN only (REDIS_ENABLED=1).
 * Single-process CRM already has RAM cache; Redis on the same VPS often slows
 * SQLite/Node (memory + huge JSON GET/SET) more than it helps.
 * Fail-fast: connect/command timeouts + cooldown so a hung Redis never blocks APIs.
 */
let createClientFn = null;
let client = null;
let ready = false;
let lastError = "";
let cooldownUntil = 0;

const DEFAULT_TTL_SEC = Math.max(15, Number(process.env.REDIS_CACHE_TTL_SEC) || 60);
const CMD_TIMEOUT_MS = Math.max(30, Number(process.env.REDIS_CMD_TIMEOUT_MS) || 80);
const MAX_VALUE_BYTES = Math.max(8_000, Number(process.env.REDIS_MAX_VALUE_BYTES) || 80_000);
const COOLDOWN_MS = 30_000;

async function loadRedisModule() {
  if (createClientFn) return createClientFn;
  try {
    const mod = await import("redis");
    createClientFn = mod.createClient;
    return createClientFn;
  } catch (err) {
    lastError = err?.message || String(err);
    return null;
  }
}

function tripCooldown(reason) {
  lastError = reason || lastError;
  cooldownUntil = Date.now() + COOLDOWN_MS;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label || "redis"} timeout ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function redisDefaultTtlSec() {
  return DEFAULT_TTL_SEC;
}

export function redisCacheKey(prefix, keyPart) {
  const safe = String(keyPart || "").replace(/[^\w|.-]/g, "_").slice(0, 220);
  return `crm:${prefix}:${safe}`;
}

export function isRedisReady() {
  if (Date.now() < cooldownUntil) return false;
  return ready && !!client?.isOpen;
}

export function getRedisStatus() {
  const enabled = String(process.env.REDIS_ENABLED || "").trim() === "1";
  return {
    ready: isRedisReady(),
    enabled,
    ttlSec: DEFAULT_TTL_SEC,
    url: process.env.REDIS_URL ? "(configured)" : "(default localhost)",
    lastError: lastError || null,
    cooldownMs: Math.max(0, cooldownUntil - Date.now()),
  };
}

export async function initRedisCache() {
  const enabled = String(process.env.REDIS_ENABLED || "").trim() === "1";
  if (!enabled) {
    console.log("[redis] off (set REDIS_ENABLED=1 to use Redis L2 — default RAM cache only)");
    return { ok: false, reason: "disabled" };
  }

  const url = (process.env.REDIS_URL || "").trim() || "redis://127.0.0.1:6379";
  try {
    const createClient = await loadRedisModule();
    if (!createClient) {
      console.warn("[redis] package chưa cài — chạy: npm install (CRM vẫn dùng RAM cache)");
      return { ok: false, reason: "no_package" };
    }
    client = createClient({
      url,
      socket: {
        connectTimeout: 1500,
        reconnectStrategy: (retries) => {
          if (retries > 4) return false;
          return Math.min(200 * retries, 1500);
        },
      },
    });
    client.on("error", (err) => {
      lastError = err?.message || String(err);
      tripCooldown(`[redis] error: ${lastError}`);
    });
    await withTimeout(client.connect(), 2000, "redis connect");
    ready = true;
    lastError = "";
    cooldownUntil = 0;
    const masked = url.replace(/:([^:@/]+)@/, ":***@");
    console.log(`[redis] connected ${masked} ttl=${DEFAULT_TTL_SEC}s cmdTimeout=${CMD_TIMEOUT_MS}ms`);
    return { ok: true };
  } catch (err) {
    ready = false;
    try { await client?.quit?.(); } catch (_) { /* ignore */ }
    client = null;
    lastError = err?.message || String(err);
    console.warn(`[redis] connect failed — RAM cache only: ${lastError}`);
    return { ok: false, reason: lastError };
  }
}

export async function redisGetCached(key, expectedVersion) {
  if (!isRedisReady() || !key) return null;
  try {
    const raw = await withTimeout(client.get(key), CMD_TIMEOUT_MS, "redis get");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (expectedVersion != null && Number(parsed?.v) !== Number(expectedVersion)) return null;
    if (!parsed?.data) return null;
    return parsed.data;
  } catch (err) {
    lastError = err?.message || String(err);
    if (/timeout/i.test(lastError)) tripCooldown(lastError);
    console.warn("[redis] get failed:", lastError);
    return null;
  }
}

export async function redisSetCached(key, data, { version, ttlSec = DEFAULT_TTL_SEC } = {}) {
  if (!isRedisReady() || !key || data == null) return false;
  try {
    const payload = JSON.stringify({ v: version, data, at: Date.now() });
    if (payload.length > MAX_VALUE_BYTES) return false;
    await withTimeout(
      client.set(key, payload, { EX: Math.max(15, ttlSec) }),
      CMD_TIMEOUT_MS,
      "redis set"
    );
    return true;
  } catch (err) {
    lastError = err?.message || String(err);
    if (/timeout/i.test(lastError)) tripCooldown(lastError);
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
