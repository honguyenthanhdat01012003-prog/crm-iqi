/**
 * Build req.user / socket.user from a live DB users row.
 * Role and displayName always come from DB so demotion/promotion takes effect
 * without waiting for the 30d JWT to expire.
 */
export function buildAuthUserFromRow(row) {
  if (!row || row.id == null) return null;
  return {
    userId: row.id,
    username: row.username,
    role: row.role,
    displayName: row.display_name,
    mustChangePassword: !!row.must_change_password,
  };
}

/**
 * JWT still carries role from login time. If it disagrees with DB, session is stale
 * (e.g. manager demoted to sale) — caller must reject and force re-login.
 */
export function isJwtRoleStale(jwtPayload, dbRole) {
  const claimed = jwtPayload?.role;
  if (claimed == null || claimed === "") return false;
  return String(claimed) !== String(dbRole || "");
}
