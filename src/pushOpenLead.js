/** Parse Capacitor / FCM / APNs tap payload → leadId + projectId. */

function asObject(value) {
  if (!value) return {};
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstDefined(sources, keys) {
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const key of keys) {
      if (src[key] != null && src[key] !== "") return src[key];
    }
  }
  return "";
}

function parseLeadId(value, leadIdsValue) {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) return direct;
  if (leadIdsValue == null || leadIdsValue === "") return 0;
  const ids = String(leadIdsValue)
    .split(",")
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length === 1 ? ids[0] : 0;
}

export function parsePushNotificationData(input = {}) {
  const notification = asObject(input.notification || input);
  let data = asObject(notification.data || input.data);
  if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) {
    data = { ...asObject(data.data), ...data };
  }
  const sources = [data, notification, asObject(input)];
  const leadId = parseLeadId(
    firstDefined(sources, ["leadId", "lead_id"]),
    firstDefined(sources, ["leadIds", "lead_ids"])
  );
  const projectId = Number(firstDefined(sources, ["projectId", "project_id"])) || 0;
  return {
    leadId,
    projectId,
    type: String(firstDefined(sources, ["type"]) || ""),
  };
}

export function samePushOpen(a, b) {
  if (!a || !b) return false;
  return Number(a.leadId || 0) === Number(b.leadId || 0)
    && Number(a.projectId || 0) === Number(b.projectId || 0)
    && String(a.type || "") === String(b.type || "");
}
