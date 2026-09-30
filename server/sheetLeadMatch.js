/**
 * Ghép dòng sheet với lead đã có trong CRM của cùng dự án.
 *
 * Mỗi lead CRM chỉ nhận tối đa một dòng sheet: khách đăng ký lại (mã lead Facebook mới)
 * thành lead riêng, không đè lên lần đăng ký trước. Dòng không nhận được lead nào mà vẫn
 * cùng SĐT/tên với một lead có ngày nhận mới hơn hoặc bằng là lần đăng ký cũ từng bị gộp
 * → `repair` (tạo lại im lặng, kế thừa sale/trạng thái).
 */

/** Ưu tiên: có quản lý → trạng thái khác "new" → id lớn hơn. */
function compareCandidates(a, b) {
  const aMgr = !!String(a.manager_name || "").trim();
  const bMgr = !!String(b.manager_name || "").trim();
  if (aMgr !== bMgr) return aMgr ? -1 : 1;
  const aNew = (a.status || "new") === "new";
  const bNew = (b.status || "new") === "new";
  if (aNew !== bNew) return aNew ? 1 : -1;
  return Number(b.id) - Number(a.id);
}

function pushTo(map, key, lead) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(lead);
}

export function planSheetLeadMatches(sheetLeads, existing, { normPhone, parseDate, canFallback = () => true }) {
  const byAds = new Map();
  const byPhoneName = new Map();
  const byPhone = new Map();
  const byName = new Map();
  for (const e of existing || []) {
    const np = normPhone(e.phone);
    const nName = String(e.name || "").trim().toLowerCase();
    pushTo(byAds, String(e.ads_id || "").trim(), e);
    if (!canFallback(e)) continue;
    if (np && nName) pushTo(byPhoneName, `${np}||${nName}`, e);
    pushTo(byPhone, np, e);
    pushTo(byName, nName, e);
  }
  for (const m of [byAds, byPhoneName, byPhone, byName]) {
    for (const list of m.values()) list.sort(compareCandidates);
  }

  const claimed = new Set();
  const takeUnclaimed = (list, accept = () => true) => {
    for (const e of list || []) {
      if (!claimed.has(e.id) && accept(e)) {
        claimed.add(e.id);
        return e;
      }
    }
    return null;
  };

  const rows = (sheetLeads || []).map((l) => {
    const np = normPhone(l.phone);
    const nName = String(l.name || "").trim().toLowerCase();
    return { l, np, nName, adsId: String(l.adsId || "").trim(), pnKey: np && nName ? `${np}||${nName}` : "" };
  });
  const plans = rows.map(() => ({ prev: null, via: null, source: null, repair: false, skip: false }));

  // Lượt 1: mã lead Facebook — khoá lead trước để lượt dò SĐT/tên không cướp mất.
  const seenAds = new Set();
  rows.forEach((r, i) => {
    if (!r.adsId) return;
    const dup = seenAds.has(r.adsId);
    seenAds.add(r.adsId);
    const candidates = byAds.get(r.adsId);
    const prev = takeUnclaimed(candidates);
    if (prev) {
      plans[i].prev = prev;
      plans[i].via = "adsId";
    } else if (dup) {
      plans[i].skip = true;
    }
  });

  // Lượt 2: dòng chưa có lead — SĐT + tên → SĐT → tên (tên chỉ khi một bên thiếu SĐT).
  rows.forEach((r, i) => {
    const p = plans[i];
    if (p.prev || p.skip) return;
    const tiers = [
      ["phoneName", r.pnKey && byPhoneName.get(r.pnKey)],
      ["phone", r.np && byPhone.get(r.np)],
      ["name", r.nName && byName.get(r.nName), (e) => !r.np || !normPhone(e.phone)],
    ];
    for (const [via, list, accept] of tiers) {
      const prev = list ? takeUnclaimed(list, accept) : null;
      if (prev) {
        p.prev = prev;
        p.via = via;
        return;
      }
    }
    const source = (r.pnKey && byPhoneName.get(r.pnKey)?.[0])
      || (r.np && byPhone.get(r.np)?.[0])
      || (r.nName && byName.get(r.nName)?.[0])
      || null;
    p.source = source;
    if (source) {
      const rowTs = parseDate(r.l.createdAt)?.getTime();
      const srcTs = parseDate(source.created_at)?.getTime();
      p.repair = Number.isFinite(rowTs) && Number.isFinite(srcTs) && rowTs <= srcTs;
    }
  });

  return plans;
}
