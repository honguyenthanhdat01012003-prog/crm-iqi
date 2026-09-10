/**
 * Pure helpers for multi-team auto-rotate keep + team-scoped history.
 * @see docs/superpowers/specs/2026-08-02-multi-team-rotate-keep-design.md
 */

/** Prior primary had meaningful feedback → multi-hold (keep + add). Else full revoke + NEW. */
export function shouldMultiHoldOnRotate(priorPrimaryHadFeedback) {
  return !!priorPrimaryHadFeedback;
}

export function formatTeamRotateLabel(team) {
  if (!team) return "team?";
  const id = Number(team.id) || 0;
  const name = String(team.name || "").trim();
  if (name && id) return `team ${name} (#${id})`;
  if (name) return `team ${name}`;
  if (id) return `team#${id}`;
  return "team?";
}

/**
 * Sale history filter: keep rows from member names.
 * System rows (chia / nhận / race / thu hồi) are kept unless ownRowsOnly.
 * Cross-team "Cập nhật" / feedback rows are hidden.
 */
export function filterHistoryForTeamMembers(history, memberNames = [], options = {}) {
  const list = Array.isArray(history) ? history : [];
  const normalize = typeof options.normalizeName === "function"
    ? options.normalizeName
    : (s) => String(s || "").trim().toLowerCase();
  const names = new Set(
    (memberNames || [])
      .map((n) => normalize(n))
      .filter(Boolean)
  );
  const includeAllChia = options.includeAllChia === true;
  const ownRowsOnly = options.ownRowsOnly === true;

  return list.filter((h) => {
    if (!h) return false;
    const action = String(h.action || "").trim();
    const sale = normalize(h.saleName || h.sale_name || "");
    if (sale && names.has(sale)) return true;
    if (ownRowsOnly) return false;
    // Keep assign / race / recall system rows so the team sees how they got the lead
    if (
      action === "Chia lead" ||
      action === "Thu hồi SLA" ||
      action === "Race claim team" ||
      action === "Race team offer" ||
      action === "Nhận lead"
    ) {
      if (includeAllChia) return true;
      return true;
    }
    return false;
  });
}

/** Distribution kind for next primary after rotate. */
export function rotateDistributionKind(priorPrimaryHadFeedback) {
  return priorPrimaryHadFeedback ? "rotate" : "rotate_new";
}

export function isRotateNewKind(kind) {
  return String(kind || "").trim() === "rotate_new";
}

/**
 * Who a sale may see in lead history: always themselves.
 * Sale A and sale B on the same lead must not see each other's feedback.
 */
export function resolveSaleHistoryMemberNames({ displayName } = {}) {
  const self = String(displayName || "").trim();
  return self ? [self] : [];
}

/** Distinct sales currently holding a lead (active teams, else assigned sale). */
export function countActiveHolderSales({ teamIds = [], membersByTeam = {}, saleName = "" } = {}) {
  const names = new Set();
  for (const tid of teamIds || []) {
    const list = membersByTeam[tid] || membersByTeam[String(tid)] || [];
    for (const n of list) {
      const k = String(n || "").trim().toLowerCase();
      if (k) names.add(k);
    }
  }
  if (names.size) return names.size;
  const sn = String(saleName || "").trim().toLowerCase();
  if (sn && sn !== "chưa chia") return 1;
  return 0;
}
