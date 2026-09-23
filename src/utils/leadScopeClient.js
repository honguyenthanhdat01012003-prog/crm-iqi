import { getLeadTabStatus } from "./leadStatusUtils.js";

export function getScopeTabStatus(lead, isSale) {
  if (lead?.tabStatus) return lead.tabStatus;
  return getLeadTabStatus(lead, isSale);
}

export function normalizePersonName(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseLeadDateLocal(createdAt) {
  if (!createdAt) return null;
  const str = String(createdAt).trim();
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6]));
  const iso = new Date(str);
  return isNaN(iso.getTime()) ? null : iso;
}

export function filterLeadsScope(leads, opts = {}) {
  const {
    selectedProject,
    searchText = "",
    statusFilter = "all",
    // managerFilter / saleFilter: server lọc trên scope/lite — không lọc lại client
    // (team:ID còn khớp lead_team_holders; pastSaleNames=[] trên lite → lọc client = 0 khách)
    activeTab = "all",
    productFilter = [],
    dateFrom = "",
    dateTo = "",
    isSale = false,
  } = opts;

  let list = Array.isArray(leads) ? leads : [];

  if (selectedProject && selectedProject !== "all" && selectedProject !== "personal") {
    const pid = Number(selectedProject);
    if (pid) list = list.filter((l) => Number(l.projectId) === pid);
  }

  if (statusFilter !== "all") {
    list = list.filter((l) => l.status === statusFilter);
  }

  const q = searchText.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (l) =>
        (l.name || "").toLowerCase().includes(q) ||
        (l.phone || "").includes(q) ||
        (l.campaign || "").toLowerCase().includes(q) ||
        (l.saleName || "").toLowerCase().includes(q) ||
        (l.product || "").toLowerCase().includes(q)
    );
  }

  if (dateFrom) {
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    list = list.filter((l) => {
      const d = parseLeadDateLocal(l.createdAt);
      return d && d >= from;
    });
  }
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    list = list.filter((l) => {
      const d = parseLeadDateLocal(l.createdAt);
      return d && d <= to;
    });
  }

  if (productFilter.length) {
    const set = new Set(productFilter);
    list = list.filter((l) => l.product && set.has(l.product));
  }

  if (activeTab && activeTab !== "all") {
    list = list.filter((l) => getScopeTabStatus(l, isSale) === activeTab);
  }

  return list;
}

export function computeTabCountsFromLeads(leads, isSale) {
  const counts = { all: 0 };
  for (const l of Array.isArray(leads) ? leads : []) {
    counts.all += 1;
    const st = getScopeTabStatus(l, isSale) || "new";
    counts[st] = (counts[st] || 0) + 1;
  }
  return counts;
}

export function sortLeadsScope(leads, sortConfig = {}) {
  const { key, direction } = sortConfig || {};
  if (!key || !direction) return [...leads];
  const dir = direction === "asc" ? 1 : -1;
  return [...leads].sort((a, b) => {
    if (key === "id") return (Number(a.id) - Number(b.id)) * dir;
    if (key === "createdAt") {
      const ta = parseLeadDateLocal(a.createdAt)?.getTime() || 0;
      const tb = parseLeadDateLocal(b.createdAt)?.getTime() || 0;
      return (ta - tb) * dir;
    }
    const va = String(a[key] ?? "").toLowerCase();
    const vb = String(b[key] ?? "").toLowerCase();
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return Number(a.id) - Number(b.id);
  });
}

export function paginateLeadsScope(leads, page, pageSize) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || 15);
  const offset = (p - 1) * size;
  return leads.slice(offset, offset + size);
}

/** Tổng lead để hiện phân trang — cache lite 15 dòng không được coi là cả dự án. */
export function resolvePagedLeadsTotal({
  leadsScopeMode = false,
  scopedCount = 0,
  leadsTotal = 0,
  tabCountAll = 0,
  projectCount = 0,
  loadedCount = 0,
} = {}) {
  if (leadsScopeMode) return Math.max(0, Number(scopedCount) || 0);
  for (const raw of [leadsTotal, tabCountAll, projectCount]) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return Math.max(0, Number(loadedCount) || 0);
}

export function isPartialScopeCache(data) {
  return !!(data && (data.paginated === true || data.scope === false || data.scopeTooLarge));
}

/** Cache/list đúng 1 trang (mặc định 15) thì không được coi là đủ cả dự án. */
export function isPartialLeadPage(data, pageSize = 15) {
  const list = Array.isArray(data?.leads) ? data.leads : [];
  if (!list.length) return false;
  if (isPartialScopeCache(data)) return true;
  const total = Number(data?.leadsTotal);
  if (Number.isFinite(total) && total > list.length) return true;
  const size = Math.max(1, Number(pageSize) || 15);
  return list.length <= size && data?.scope !== true;
}

export function shouldShowLeadPager({ totalPages = 1, loadedCount = 0, pageSize = 15, leadsScopeMode = false } = {}) {
  if (Number(totalPages) > 1) return true;
  return !leadsScopeMode && Number(loadedCount) >= Math.max(1, Number(pageSize) || 15);
}

/** Không ghi đè cache đủ dự án bằng 1 trang lite 15 lead. */
export function shouldReplaceScopeCache(existing, incoming) {
  const oldList = Array.isArray(existing?.leads) ? existing.leads : [];
  const nextList = Array.isArray(incoming?.leads) ? incoming.leads : [];
  if (!nextList.length) return false;
  if (!oldList.length) return true;
  if (!isPartialScopeCache(existing) && isPartialScopeCache(incoming) && oldList.length > nextList.length) {
    return false;
  }
  return true;
}

export function scopeUserKey(user) {
  return String(user?.userId || user?.username || user?.displayName || "anon");
}

export function buildScopeCacheKey({ selectedProject, managerFilter, saleFilter, userRole, userId }) {
  return [
    userId || "",
    userRole || "",
    selectedProject || "",
    managerFilter || "all",
    saleFilter || "all",
  ].join("|");
}

/** Client-side scope cache — hiện data ngay khi đổi dự án đã xem, refresh nền. */
export const CLIENT_SCOPE_CACHE_MS = 10 * 60 * 1000;
export const CLIENT_SCOPE_CACHE_MAX = 15;
export const CLIENT_SCOPE_FRESH_MS = 45_000;

/** Disk cache: mở app vẫn hiện được data lần trước (stale-while-revalidate). */
export const DISK_SCOPE_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const DISK_SCOPE_MAX = 12;
const DISK_SCOPE_MAX_BYTES = 6 * 1024 * 1024;
const DISK_DB_NAME = "crm-iqi-cache";
const DISK_DB_VERSION = 1;
const DISK_STORE = "scope";

export function getClientScopeCacheEntry(cache, cacheKey, opts = {}) {
  if (!cache || !cacheKey) return null;
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  const stale = Date.now() - entry.at > CLIENT_SCOPE_CACHE_MS;
  if (stale && !opts.allowStale) {
    cache.delete(cacheKey);
    return null;
  }
  // Cache rỗng không dùng — tránh sale mở dự án thấy 0 vì prefetch lúc chưa có lead
  if (!Array.isArray(entry.data?.leads) || entry.data.leads.length === 0) {
    cache.delete(cacheKey);
    return null;
  }
  return entry;
}

export function setClientScopeCacheEntry(cache, cacheKey, data, opts = {}) {
  if (!cache || !cacheKey || !data) return;
  // Không persist/cache scope trống
  if (!Array.isArray(data.leads) || data.leads.length === 0) {
    cache.delete(cacheKey);
    if (opts.userKey) void deleteScopeDiskCache(opts.userKey, cacheKey);
    return;
  }
  cache.set(cacheKey, { at: Date.now(), data });
  if (cache.size > CLIENT_SCOPE_CACHE_MAX) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  if (opts.persist !== false && opts.userKey) {
    void writeScopeDiskCache(opts.userKey, cacheKey, data);
  }
}

export function invalidateClientScopeCache(cache, cacheKey = null) {
  if (!cache) return;
  if (cacheKey) cache.delete(cacheKey);
  else cache.clear();
}

function openScopeDiskDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DISK_DB_NAME, DISK_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DISK_STORE)) {
        const store = db.createObjectStore(DISK_STORE, { keyPath: "id" });
        store.createIndex("userKey", "userKey", { unique: false });
        store.createIndex("at", "at", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb open failed"));
  });
}

function diskEntryId(userKey, cacheKey) {
  return `${userKey}::${cacheKey}`;
}

async function pruneScopeDiskCache(db, userKey) {
  const rows = await new Promise((resolve, reject) => {
    const tx = db.transaction(DISK_STORE, "readonly");
    const idx = tx.objectStore(DISK_STORE).index("userKey");
    const req = idx.getAll(userKey);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  if (rows.length <= DISK_SCOPE_MAX) return;
  const sorted = [...rows].sort((a, b) => (a.at || 0) - (b.at || 0));
  const remove = sorted.slice(0, Math.max(0, sorted.length - DISK_SCOPE_MAX));
  if (!remove.length) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DISK_STORE, "readwrite");
    const store = tx.objectStore(DISK_STORE);
    for (const row of remove) store.delete(row.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function readScopeDiskCache(userKey, cacheKey) {
  if (!userKey || !cacheKey) return null;
  try {
    const db = await openScopeDiskDb();
    const entry = await new Promise((resolve, reject) => {
      const tx = db.transaction(DISK_STORE, "readonly");
      const req = tx.objectStore(DISK_STORE).get(diskEntryId(userKey, cacheKey));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (!entry?.data) return null;
    if (Date.now() - (entry.at || 0) > DISK_SCOPE_CACHE_MS) {
      void deleteScopeDiskCache(userKey, cacheKey);
      return null;
    }
    // Bỏ qua cache rỗng đã lưu trước đó
    if (!Array.isArray(entry.data.leads) || entry.data.leads.length === 0) {
      void deleteScopeDiskCache(userKey, cacheKey);
      return null;
    }
    return { at: entry.at, data: entry.data };
  } catch {
    return null;
  }
}

export async function writeScopeDiskCache(userKey, cacheKey, data) {
  if (!userKey || !cacheKey || !data || !Array.isArray(data.leads) || data.leads.length === 0) return;
  try {
    let size = 0;
    try {
      size = JSON.stringify(data).length;
    } catch {
      return;
    }
    if (size > DISK_SCOPE_MAX_BYTES) return;

    const db = await openScopeDiskDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DISK_STORE, "readwrite");
      tx.objectStore(DISK_STORE).put({
        id: diskEntryId(userKey, cacheKey),
        userKey,
        cacheKey,
        at: Date.now(),
        data,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await pruneScopeDiskCache(db, userKey);
  } catch (err) {
    console.warn("[scope-disk] write failed:", err?.message || err);
  }
}

export async function deleteScopeDiskCache(userKey, cacheKey = null) {
  try {
    const db = await openScopeDiskDb();
    if (cacheKey) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DISK_STORE, "readwrite");
        tx.objectStore(DISK_STORE).delete(diskEntryId(userKey, cacheKey));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    }
    if (!userKey) {
      await clearAllScopeDiskCache();
      return;
    }
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(DISK_STORE, "readonly");
      const req = tx.objectStore(DISK_STORE).index("userKey").getAllKeys(userKey);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (!rows.length) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DISK_STORE, "readwrite");
      const store = tx.objectStore(DISK_STORE);
      for (const id of rows) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function clearAllScopeDiskCache() {
  try {
    const db = await openScopeDiskDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DISK_STORE, "readwrite");
      tx.objectStore(DISK_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}
