function getVnCalendarDay(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
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

export function isSamePersonName(a, b) {
  return normalizePersonName(a) === normalizePersonName(b);
}

export function leadKey(lead) {
  const id = Number(lead?.leadId || lead?.id);
  if (id && !Number.isNaN(id) && id > 0) return `id:${id}`;
  if (lead?.notifKey) return String(lead.notifKey);
  const name = String(lead?.name || "").trim();
  const phone = String(lead?.phone || "").trim();
  return name || phone ? `${name}||${phone}` : "";
}

function parseLeadCreatedAt(createdAt) {
  if (!createdAt) return null;
  const raw = String(createdAt).trim();
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) return new Date(raw);
  const vnTimeBefore = raw.match(/(\d{1,2}):(\d{2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (vnTimeBefore) {
    return new Date(
      Number(vnTimeBefore[6]),
      Number(vnTimeBefore[5]) - 1,
      Number(vnTimeBefore[4]),
      Number(vnTimeBefore[1]),
      Number(vnTimeBefore[2]),
      Number(vnTimeBefore[3])
    );
  }
  const vnTimeAfter = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (vnTimeAfter) {
    return new Date(
      Number(vnTimeAfter[3]),
      Number(vnTimeAfter[2]) - 1,
      Number(vnTimeAfter[1]),
      Number(vnTimeAfter[4] || 0),
      Number(vnTimeAfter[5] || 0),
      Number(vnTimeAfter[6] || 0)
    );
  }
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Khớp tag NEW — lead nhận trong ngày (VN), không theo cửa sổ 2h/7 ngày. */
export function isRecentLead(lead) {
  const dt = parseLeadCreatedAt(lead?.createdAt);
  if (!dt) return false;
  return getVnCalendarDay(dt) === getVnCalendarDay(new Date());
}

export function registerKnownLeadIds(leads, knownLeadIds) {
  const known = knownLeadIds instanceof Set ? knownLeadIds : new Set();
  for (const lead of Array.isArray(leads) ? leads : []) {
    const id = Number(lead?.id);
    if (id) known.add(id);
  }
  return known;
}

export function detectLeadNotifications(prevLeads, nextLeads, { role, displayName, seenLeadKeys, knownLeadIds }) {
  const prevArr = Array.isArray(prevLeads) ? prevLeads : [];
  const nextArr = Array.isArray(nextLeads) ? nextLeads : [];
  const seen = seenLeadKeys instanceof Set ? seenLeadKeys : new Set();
  const known = knownLeadIds instanceof Set ? knownLeadIds : new Set();

  const brandNew = nextArr.filter((l) => {
    const id = Number(l?.id);
    const key = leadKey(l);
    if (!id || !key || known.has(id) || seen.has(key)) return false;
    if (role === "sale") {
      if (!isSamePersonName(l.saleName, displayName)) return false;
      return isRecentLead(l);
    }
    return isRecentLead(l);
  });

  // Lead vừa vào list của sale (chia mới / chia lại) — không yêu cầu known/recent.
  // Chỉ dùng khi refresh sau boot (không suppress), tránh flood lúc load lần đầu.
  const newlyAssigned = role === "sale"
    ? nextArr.filter((l) => {
      const id = Number(l?.id);
      const key = leadKey(l);
      if (!id || !key || seen.has(key)) return false;
      if (!isSamePersonName(l.saleName, displayName)) return false;
      const prevLead = prevArr.find((p) => Number(p.id) === id);
      if (prevLead && isSamePersonName(prevLead.saleName, displayName)) return false;
      return true;
    })
    : [];

  const notifyLeads = [
    ...brandNew,
    ...newlyAssigned.filter((l) => !brandNew.some((n) => leadKey(n) === leadKey(l))),
  ];

  return { notifyLeads, soundKind: role === "sale" ? "sale" : "manager" };
}

export function leadFromPushPayload(payload = {}) {
  const body = String(payload.body || "");
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const leadId = Number(payload.leadId || data.leadId || payload.id || 0) || 0;
  const ts = payload.ts || Date.now();
  const fallbackKey = payload.tag || payload.title || body || String(ts);
  const nameFromBody = body.split("-")[0]?.replace(/^.*?:/, "").trim();
  // Unique theo từng lần push — chia lại cùng lead không bị crm_seen_keys nuốt
  return {
    id: leadId || `push:${fallbackKey}`,
    leadId,
    notifKey: leadId ? `id:${leadId}` : `push:${fallbackKey}`,
    name: nameFromBody || payload.title || "Lead moi",
    phone: payload.phone || data.phone || "",
    notifTime: Date.now(),
    fromPush: true,
  };
}
