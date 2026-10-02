/** Luồng xuất lead ra file: khách nét (ưu tiên trạng thái qua mọi sale) và khách phá/rác (trạng thái hiện tại). */

export const EXPORT_FLOWS = ["good", "junk"];

export const GOOD_EXPORT_DEFAULT_STATUSES = [
  "interested", "low_interest", "other_project", "consulting",
  "appointment", "booked", "booking_other", "closed",
];

/** Cao → thấp theo phễu. Trạng thái không có trong list xếp sau, giữ thứ tự admin chọn. */
export const EXPORT_STATUS_RANK = [
  "closed", "booked", "booking_other", "appointment", "consulting",
  "interested", "other_project", "low_interest",
  "callback", "unreachable", "called", "weak_finance", "has_sale",
  "not_interested", "sale", "spam", "wrong_phone", "wrong_number", "hung_up", "blocked", "lost", "new",
];

export const POSITIVE_EXPORT_STATUSES = new Set(GOOD_EXPORT_DEFAULT_STATUSES);

export function normalizeExportFlow(value) {
  return String(value || "").trim() === "good" ? "good" : "junk";
}

/** Lọc theo chữ trong tên chiến dịch (vd. "... | BLC | Thấp tầng | NS 1M | ..."). */
export const EXPORT_CAMPAIGN_TYPES = [
  { key: "low_floor", label: "Thấp tầng", compact: "thaptang" },
  { key: "high_floor", label: "Cao tầng", compact: "caotang" },
  { key: "event", label: "Event", compact: "event" },
];

const EXPORT_CAMPAIGN_TYPE_KEYS = new Set(EXPORT_CAMPAIGN_TYPES.map((t) => t.key));

function foldCampaignText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

function compactCampaignText(value = "") {
  return foldCampaignText(value).replace(/[^a-z0-9]+/g, "");
}

export function normalizeExportCampaignTypes(raw) {
  const list = Array.isArray(raw) ? raw : (raw == null || raw === "" ? [] : [raw]);
  return [...new Set(list.map((v) => String(v || "").trim()).filter((k) => EXPORT_CAMPAIGN_TYPE_KEYS.has(k)))];
}

/** Không chọn loại nào = mọi chiến dịch. Nhiều loại = khớp bất kỳ loại đã tick. */
export function campaignMatchesExportTypes(campaign, types) {
  const selected = normalizeExportCampaignTypes(types);
  if (!selected.length) return true;
  const compact = compactCampaignText(campaign);
  if (!compact) return false;
  return selected.some((key) => {
    const def = EXPORT_CAMPAIGN_TYPES.find((t) => t.key === key);
    return def ? compact.includes(def.compact) : false;
  });
}

function statusRank(status, selected) {
  const idx = EXPORT_STATUS_RANK.indexOf(status);
  if (idx >= 0) return idx;
  const sel = selected.indexOf(status);
  return EXPORT_STATUS_RANK.length + (sel >= 0 ? sel : selected.length);
}

function historySortKey(h) {
  return [Number(h.seq) || 0, Number(h.id) || 0];
}

function sortHistory(history) {
  return [...(Array.isArray(history) ? history : [])].sort((a, b) => {
    const [sa, ia] = historySortKey(a);
    const [sb, ib] = historySortKey(b);
    return sa - sb || ia - ib;
  });
}

/**
 * Lấy trạng thái ưu tiên cao nhất trong các trạng thái admin chọn, xét feedback của mọi sale + trạng thái hiện tại.
 * Trả null khi khách chưa từng có trạng thái nào trong list.
 */
export function pickPriorityExportStatus(lead, history, selectedStatuses, { normalizeStatus, isFeedback }) {
  const selected = Array.isArray(selectedStatuses) ? selectedStatuses : [];
  const selectedSet = new Set(selected);
  const hits = [];
  for (const h of sortHistory(history)) {
    if (!isFeedback(h)) continue;
    const status = normalizeStatus(h.status || "");
    if (!selectedSet.has(status)) continue;
    hits.push({ status, saleName: h.sale_name || h.saleName || "", date: h.contact_date || h.date || "" });
  }
  const current = normalizeStatus(lead?.admin_tab_status || lead?.status || "");
  if (selectedSet.has(current) && !hits.some((x) => x.status === current)) {
    hits.push({ status: current, saleName: lead?.sale_name || "", date: "" });
  }
  if (!hits.length) return null;
  let best = hits[0];
  for (const hit of hits) {
    // Cùng hạng: lấy lần feedback sau cùng (hits đã theo thứ tự thời gian)
    if (statusRank(hit.status, selected) <= statusRank(best.status, selected)) best = hit;
  }
  return best;
}

/** Khách đã từng được feedback nét (trừ các trạng thái admin đang chọn xuất rác). */
export function hadPositiveFeedback(lead, history, { normalizeStatus, isFeedback, ignore = [] }) {
  const ignoreSet = new Set(ignore);
  const isPositive = (s) => POSITIVE_EXPORT_STATUSES.has(s) && !ignoreSet.has(s);
  for (const h of Array.isArray(history) ? history : []) {
    if (!isFeedback(h)) continue;
    if (isPositive(normalizeStatus(h.status || ""))) return true;
  }
  return false;
}

/** "Sale A: Quan tâm — nội dung (ngày) | Sale B: Không quan tâm" — feedback cuối của từng sale. */
export function buildSaleFeedbackSummary(history, { normalizeStatus, isFeedback, statusLabel }) {
  const bySale = new Map();
  for (const h of sortHistory(history)) {
    if (!isFeedback(h)) continue;
    const name = String(h.sale_name || h.saleName || "").trim();
    if (!name) continue;
    bySale.set(name, h);
  }
  const parts = [];
  for (const [name, h] of bySale) {
    const st = normalizeStatus(h.status || "");
    const label = statusLabel(st) || h.status || "";
    const fb = String(h.feedback || "").replace(/\s+/g, " ").trim();
    const date = String(h.contact_date || h.date || "").trim();
    let text = `${name}: ${label}`;
    if (fb) text += ` — ${fb}`;
    if (date) text += ` (${date})`;
    parts.push(text);
  }
  return parts.join(" | ");
}
