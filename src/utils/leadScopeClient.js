import { getLeadTabStatus, normalizeLeadStatusKey } from "./leadStatusUtils.js";

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
    managerFilter = "all",
    saleFilter = "all",
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

  if (managerFilter && managerFilter !== "all") {
    list = list.filter((l) => (l.managerName || "") === managerFilter);
  }

  if (saleFilter && saleFilter !== "all") {
    const saleKey = normalizePersonName(saleFilter);
    list = list.filter(
      (l) =>
        normalizePersonName(l.saleName) === saleKey ||
        (l.pastSaleNames || []).some((n) => normalizePersonName(n) === saleKey)
    );
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

export function buildScopeCacheKey({ selectedProject, managerFilter, saleFilter, userRole }) {
  return [userRole || "", selectedProject || "", managerFilter || "all", saleFilter || "all"].join("|");
}
