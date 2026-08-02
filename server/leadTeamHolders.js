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
 * Sale history filter: keep rows from teammate names + chia/system rows for this team.
 * Cross-team "Cập nhật" / feedback rows are hidden.
 */
export function filterHistoryForTeamMembers(history, memberNames = [], options = {}) {
  const list = Array.isArray(history) ? history : [];
  const names = new Set(
    (memberNames || [])
      .map((n) => String(n || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const includeAllChia = options.includeAllChia === true;
  const normalize = typeof options.normalizeName === "function"
    ? options.normalizeName
    : (s) => String(s || "").trim().toLowerCase();

  return list.filter((h) => {
    if (!h) return false;
    const action = String(h.action || "").trim();
    const sale = normalize(h.saleName || h.sale_name || "");
    if (names.has(sale)) return true;
    // Keep assign / race / recall system rows so the team sees how they got the lead
    if (
      action === "Chia lead" ||
      action === "Thu hồi SLA" ||
      action === "Race claim team" ||
      action === "Race team offer" ||
      action === "Race claim quản lý" ||
      action === "Nhận lead"
    ) {
      if (includeAllChia) return true;
      // Prefer chia rows that mention a teammate as assignee, else keep all chia (team context)
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
