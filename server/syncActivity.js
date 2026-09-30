/** Chọn dự án cho đồng bộ tự động: bỏ dự án lâu không có lead để lead mới của dự án đang chạy lên CRM nhanh hơn. */

export const SYNC_MODES = ["auto", "always", "off"];
export const SYNC_ACTIVE_DAYS = 30;

export function normalizeSyncMode(value) {
  const v = String(value || "").trim().toLowerCase();
  return SYNC_MODES.includes(v) ? v : "auto";
}

/**
 * lastLeadAtByProject: Map projectId → timestamp lead mới nhất (ms).
 * Không có key = dự án chưa có lead (mới tạo) → vẫn quét. Giá trị null = không đọc được ngày → vẫn quét.
 */
export function isProjectAutoSyncActive(project, lastLeadAtByProject, now = Date.now(), days = SYNC_ACTIVE_DAYS) {
  const mode = normalizeSyncMode(project?.sync_mode);
  if (mode === "off") return false;
  if (mode === "always") return true;
  const id = Number(project?.id);
  if (!lastLeadAtByProject.has(id)) return true;
  const at = lastLeadAtByProject.get(id);
  if (at == null || !Number.isFinite(at)) return true;
  return at >= now - days * 24 * 60 * 60 * 1000;
}

export function selectAutoSyncProjects(projects, lastLeadAtByProject, now = Date.now(), days = SYNC_ACTIVE_DAYS) {
  const active = [];
  const idle = [];
  for (const p of Array.isArray(projects) ? projects : []) {
    if (isProjectAutoSyncActive(p, lastLeadAtByProject, now, days)) active.push(p);
    else idle.push(p);
  }
  return { active, idle };
}
