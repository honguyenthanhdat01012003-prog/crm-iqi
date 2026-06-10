export function normalizePersonName(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isSamePersonName(a, b) {
  return normalizePersonName(a) === normalizePersonName(b);
}

export function leadKey(lead) {
  return `${lead?.name || ""}||${lead?.phone || ""}`;
}

export function detectLeadNotifications(prevLeads, nextLeads, { role, displayName, seenLeadKeys }) {
  const prevArr = Array.isArray(prevLeads) ? prevLeads : [];
  const nextArr = Array.isArray(nextLeads) ? nextLeads : [];
  const prevKeys = new Set(prevArr.map(leadKey));
  const seen = seenLeadKeys instanceof Set ? seenLeadKeys : new Set();

  const newLeads = nextArr.filter((l) => {
    const key = leadKey(l);
    return !prevKeys.has(key) && !seen.has(key);
  });

  const newlyAssigned = role === "sale"
    ? nextArr.filter((l) => {
      const key = leadKey(l);
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
  const body = payload.body || "";
  const nameMatch = body.match(/:\s*([^•]+)/);
  return {
    id: Number(payload.leadId || 0) || Date.now(),
    name: nameMatch ? nameMatch[1].trim() : (payload.title || "Lead mới"),
    phone: "",
    notifTime: Date.now(),
    fromPush: true,
  };
}
