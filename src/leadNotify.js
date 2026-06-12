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
  if (lead?.notifKey) return String(lead.notifKey);
  const id = lead?.leadId || lead?.id;
  if (id && !String(id).startsWith("push:")) return `id:${id}`;
  const name = String(lead?.name || "").trim();
  const phone = String(lead?.phone || "").trim();
  return name || phone ? `${name}||${phone}` : "";
}

export function detectLeadNotifications(prevLeads, nextLeads, { role, displayName, seenLeadKeys }) {
  const prevArr = Array.isArray(prevLeads) ? prevLeads : [];
  const nextArr = Array.isArray(nextLeads) ? nextLeads : [];
  const prevKeys = new Set(prevArr.map(leadKey).filter(Boolean));
  const seen = seenLeadKeys instanceof Set ? seenLeadKeys : new Set();

  const newLeads = nextArr.filter((l) => {
    const key = leadKey(l);
    return key && !prevKeys.has(key) && !seen.has(key);
  });

  const newlyAssigned = role === "sale"
    ? nextArr.filter((l) => {
      const key = leadKey(l);
      if (!key || seen.has(key)) return false;
      const prevLead = prevArr.find((p) => leadKey(p) === key);
      if (!prevLead) return false;
      return !isSamePersonName(prevLead.saleName, displayName)
        && isSamePersonName(l.saleName, displayName);
    })
    : [];

  const notifyLeads = [
    ...newLeads,
    ...newlyAssigned.filter((l) => !newLeads.some((n) => leadKey(n) === leadKey(l))),
  ];

  return { notifyLeads, soundKind: role === "sale" ? "sale" : "manager" };
}

export function leadFromPushPayload(payload = {}) {
  const body = String(payload.body || "");
  const leadId = Number(payload.leadId || payload.id || 0) || 0;
  const fallbackKey = payload.tag || payload.title || body || String(Date.now());
  const nameFromBody = body.split("-")[0]?.replace(/^.*?:/, "").trim();
  return {
    id: leadId || `push:${fallbackKey}`,
    leadId,
    notifKey: leadId ? `id:${leadId}` : `push:${fallbackKey}`,
    name: nameFromBody || payload.title || "Lead moi",
    phone: payload.phone || "",
    notifTime: Date.now(),
    fromPush: true,
  };
}
