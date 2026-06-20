import { STATUS_LABELS } from "../constants/leadStatus.js";

export const STATUS_LABEL_TO_KEY = {};
Object.entries(STATUS_LABELS).forEach(([k, v]) => {
  STATUS_LABEL_TO_KEY[v] = k;
  STATUS_LABEL_TO_KEY[v.toLowerCase()] = k;
  STATUS_LABEL_TO_KEY[k] = k;
});

export function foldStatusText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function normalizeLeadStatusKey(status) {
  const raw = String(status || "").trim();
  if (!raw) return "new";
  const direct = STATUS_LABEL_TO_KEY[raw] || STATUS_LABEL_TO_KEY[raw.toLowerCase()];
  if (direct) return direct;
  const v = foldStatusText(raw);
  if (!v || v === "created" || v === "duplicate" || v.includes("chua xu ly")) return "new";
  if (v.includes("chot") || v.includes("mua") || v.includes("closed")) return "closed";
  if (v.includes("booking san khac") || v.includes("book san khac") || v.includes("booking sp khac")) return "booking_other";
  if (v.includes("giu cho") || v.includes("coc") || v.includes("book")) return "booked";
  if (v.includes("hen") || v.includes("di xem") || v.includes("xem nha") || v.includes("hen gap") || v.includes("hen xem") || v.includes("xem du an")) return "appointment";
  if (v.includes("pha") || v.includes("rac") || v.includes("spam")) return "spam";
  if (v.includes("tai chinh yeu") || v.includes("tai chinh") || v === "tcy") return "weak_finance";
  if (v.includes("thue bao")) return "wrong_phone";
  if (v.includes("sai so") || v.includes("sai")) return "wrong_number";
  if (v.includes("tat may ngang") || v.includes("tat may")) return "hung_up";
  if (v.includes("chua lien lac") || v.includes("khong lien lac") || v.includes("khong nghe") || v.includes("unreachable") || v === "kll") return "unreachable";
  if (v.includes("lien lac lai") || v.includes("goi lai")) return "callback";
  if (v.includes("chan kb") || v.includes("chan zalo") || (v.includes("chan") && !v.includes("chien"))) return "blocked";
  if (v.includes("khong quan") || v.includes("tu choi") || v.includes("not_interested") || v === "kqt") return "not_interested";
  if (v.includes("quan tam hoi hot") || v.includes("hoi hot") || v === "qthh") return "low_interest";
  if (v.includes("quan tam du an khac") || v.includes("du an khac") || v === "qtdak") return "other_project";
  if (v.includes("dang co sale") || v.includes("sale khac cham") || v.includes("co sale")) return "has_sale";
  if (v === "sale" || (v.includes("sale") && !v.includes("khac") && !v.includes("cham"))) return "sale";
  if (v.includes("quan tam") || v.includes("tu van") || v.includes("interested") || v === "qt") return "interested";
  if (v.includes("goi") || v.includes("lien he") || v.includes("called") || v.includes("zalo") || v.includes("nhan") || v.includes("da lien")) return "called";
  if (v.includes("mat") || v.includes("lost") || v.includes("huy")) return "lost";
  return "new";
}

export function labelToStatusKey(status) {
  const raw = String(status || "").trim();
  if (!raw) return "new";
  return STATUS_LABEL_TO_KEY[raw] || STATUS_LABEL_TO_KEY[raw.toLowerCase()] || raw;
}

export function isFeedbackStatusHistoryItem(h) {
  if (!h || h.action === "Chia lead" || !h.status) return false;
  const src = String(h.source || "").toLowerCase();
  const validSources = new Set(["sale", "telegram", "admin", "manager"]);
  return validSources.has(src) || (!src && h.saleName);
}

export function getFirstUpdaterInfo(lead) {
  const history = Array.isArray(lead?.saleHistory) ? lead.saleHistory : [];
  let firstUpdater = "";
  let latestStatus = "";
  for (const h of history) {
    if (!isFeedbackStatusHistoryItem(h)) continue;
    firstUpdater = h.saleName || h.source || "";
    latestStatus = h.status;
    break;
  }
  if (!firstUpdater) return { updater: "", status: normalizeLeadStatusKey(lead?.status || "new") };
  for (const h of history) {
    const updater = h?.saleName || h?.source || "";
    if (!isFeedbackStatusHistoryItem(h) || updater !== firstUpdater) continue;
    latestStatus = h.status;
  }
  return { updater: firstUpdater, status: normalizeLeadStatusKey(latestStatus || lead?.status || "new") };
}

export function getLeadReportStatus(lead) {
  const history = Array.isArray(lead?.saleHistory) ? lead.saleHistory : [];
  let hasInterested = false;
  let hasLowInterest = false;
  for (const h of history) {
    if (!isFeedbackStatusHistoryItem(h)) continue;
    const key = normalizeLeadStatusKey(h.status);
    if (key === "appointment") return "appointment";
    if (key === "interested") hasInterested = true;
    if (key === "low_interest") hasLowInterest = true;
  }
  if (hasInterested) return "interested";
  if (hasLowInterest) return "low_interest";
  return getFirstUpdaterInfo(lead).status || "new";
}

export function getLeadTabStatus(lead, isSale) {
  if (isSale) return normalizeLeadStatusKey(lead?.status || "new");
  return getLeadReportStatus(lead);
}
