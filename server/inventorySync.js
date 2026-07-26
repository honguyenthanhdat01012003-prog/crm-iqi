/**
 * Sync / parse Google Sheet → inventory_units
 */

export function normalizeInventoryHeader(h = "") {
  return String(h || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function pickInventoryCol(headers, ...needles) {
  const normalized = headers.map((h) => ({ raw: h, n: normalizeInventoryHeader(h) }));
  for (const needle of needles) {
    const n = normalizeInventoryHeader(needle);
    const hit = normalized.find((h) => h.n === n);
    if (hit) return hit.raw;
  }
  for (const needle of needles) {
    const n = normalizeInventoryHeader(needle);
    if (n.length < 3) continue;
    const hit = normalized.find((h) => h.n.includes(n));
    if (hit) return hit.raw;
  }
  for (const needle of needles) {
    const n = normalizeInventoryHeader(needle);
    const hit = normalized.find((h) => {
      if (h.n.startsWith(n + " ") || h.n.endsWith(" " + n)) return true;
      return h.n.split(" ").includes(n);
    });
    if (hit) return hit.raw;
  }
  return null;
}

export function parseInventoryPrice(raw) {
  if (raw == null) return 0;
  const s = String(raw).replace(/[^\d.,]/g, "").trim();
  if (!s) return 0;
  if (s.includes(".") && s.includes(",")) {
    return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if ((s.match(/\./g) || []).length > 1) return Number(s.replace(/\./g, "")) || 0;
  if ((s.match(/,/g) || []).length > 1) return Number(s.replace(/,/g, "")) || 0;
  return Number(s.replace(/,/g, "")) || 0;
}

/** CSV không mang màu ô → map từ cột Tình trạng */
export function normalizeInventoryStatus(raw = "") {
  const s = normalizeInventoryHeader(raw);
  if (!s) return "available";
  if (/da ban|sold|het hang|closed|dong/.test(s)) return "sold";
  if (/booking|dat coc|cho coc|giu cho|hold|pending/.test(s)) return "booking";
  if (/con hang|con trong|available|trong|mo ban|open/.test(s)) return "available";
  return s.slice(0, 40) || "available";
}

function looksLikeInventoryHeaderRow(cols) {
  const joined = cols.map((c) => normalizeInventoryHeader(c)).join(" | ");
  if (!joined) return false;
  if (/\bma can\b/.test(joined)) return true;
  const hasToa = /\btoa\b/.test(joined);
  const hasTang = /\btang\b/.test(joined);
  const hasCan = /(^|\| )can( \||$)/.test(joined) || /\bloai can\b/.test(joined);
  return hasToa && hasTang && hasCan;
}

function splitCsvRow(line) {
  const cols = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

/** Header thường không ở dòng 1 (có tiêu đề phía trên) */
export function parseInventoryCsv(text) {
  const allLines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const lines = allLines.filter((l) => l.replace(/,/g, "").trim());
  if (!lines.length) return { headers: [], rawHeaders: [], rows: [], headerRowIndex: 0 };

  let headerIdx = 0;
  const scanMax = Math.min(lines.length, 25);
  for (let i = 0; i < scanMax; i++) {
    if (looksLikeInventoryHeaderRow(splitCsvRow(lines[i]))) {
      headerIdx = i;
      break;
    }
  }

  const rawHeaders = splitCsvRow(lines[headerIdx]).map((h) => h.trim());
  const headers = rawHeaders.map((h, i) => {
    const t = String(h || "").trim().toLowerCase();
    return t || `__col_${i}`;
  });

  const rows = [];
  for (let li = headerIdx + 1; li < lines.length; li++) {
    const cols = splitCsvRow(lines[li]);
    if (!cols.some((c) => String(c || "").trim())) continue;
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] ?? "").trim(); });
    rows.push(obj);
  }
  return { headers, rawHeaders, rows, headerRowIndex: headerIdx };
}

export function mapInventoryRow(row, headers) {
  const getL = (...needles) => {
    const key = pickInventoryCol(headers, ...needles);
    if (!key) return "";
    const v = row[key] ?? row[String(key).toLowerCase()] ?? "";
    return String(v).trim();
  };

  let unitCode = getL("ma can ho", "ma can", "macan", "unit code", "unitcode");
  if (unitCode && /gio hang|blanca|beacon|doc quyen|^stt$/i.test(unitCode)) unitCode = "";

  const building = getL("toa", "building", "block");
  const floor = getL("tang", "floor");
  let unitNo = "";
  {
    const key = headers.find((h) => {
      const n = normalizeInventoryHeader(h);
      return n === "can" || n === "so can" || n === "can so";
    });
    if (key) unitNo = String(row[key] ?? row[String(key).toLowerCase()] ?? "").trim();
  }

  if (!unitCode && building && (floor || unitNo)) {
    unitCode = `${building}${floor || ""}${unitNo || ""}`.replace(/\s+/g, "");
  }
  if (!unitCode) return null;
  if (!/[A-Za-z]/.test(unitCode) || !/\d/.test(unitCode)) return null;

  const priceCandidates = [
    getL(
      "tong gia ban can ho da gom vat kpbt",
      "tong gia ban can ho",
      "tong gia bao gom vat kpbt",
      "tong gia ban gom vat",
      "tong gia ban gom vat kpbt",
      "tong gia",
      "gia ban",
      "gia gom vat",
      "price"
    ),
    getL("co vay sau lb", "gia vay"),
    getL("tt som", "thanh toan som"),
  ].filter(Boolean);
  let price = 0;
  let priceLabel = "";
  for (const p of priceCandidates) {
    const n = parseInventoryPrice(p);
    if (n > price) { price = n; priceLabel = p; }
  }

  let driveUrl = getL("link ptg ve can", "link ptg", "ptg chi can", "link drive", "drive", "ptg");
  if (driveUrl && !/^https?:\/\//i.test(driveUrl)) {
    if (/drive\.google|docs\.google/i.test(driveUrl)) driveUrl = "https://" + driveUrl.replace(/^\/+/, "");
    else driveUrl = "";
  }

  const statusRaw = getL("tinh trang", "trang thai", "status");
  const status = normalizeInventoryStatus(statusRaw);

  return {
    unitCode,
    building,
    floor,
    unitNo,
    unitType: getL("loai hinh can ho", "loai hinh"),
    layout: getL("loai can", "layout"),
    direction: getL("huong", "direction"),
    viewText: getL("view"),
    areaNet: parseInventoryPrice(getL("dt thong thuy", "dien tich thong thuy", "thong thuy", "net")),
    areaGross: parseInventoryPrice(getL("dt tim tuong", "dien tich tim tuong", "tim tuong", "gross")),
    price,
    priceLabel,
    driveUrl,
    status,
    statusRaw,
  };
}

export async function syncInventorySource(db, { get, run, fetchCsvText, sanitizeSheetUrl }, sourceId) {
  const source = await get(db, "SELECT * FROM inventory_sources WHERE id = ?", [sourceId]);
  if (!source) throw new Error("Nguồn giỏ hàng không tồn tại");
  const sheetUrl = sanitizeSheetUrl(source.sheet_url);
  if (!sheetUrl) throw new Error("Thiếu link Google Sheet");

  const fetchUrl = sheetUrl.includes("?")
    ? `${sheetUrl}&crm_inv_ts=${Date.now()}`
    : `${sheetUrl}?crm_inv_ts=${Date.now()}`;

  let raw;
  try {
    raw = await fetchCsvText(fetchUrl, { timeoutMs: 45000, retries: 2 });
  } catch (e) {
    const msg = String(e.message || e);
    if (/401|403|permission|unauthorized/i.test(msg)) {
      throw new Error("Sheet chưa cho phép đọc (401). Share: Anyone with the link → Viewer, hoặc File → Share → Publish to web (CSV). Nhớ đúng gid tab sheet.");
    }
    throw e;
  }

  let csvText = raw;
  const firstLine = raw.split(/\r?\n/)[0] || "";
  if (!firstLine.includes(",")) csvText = raw.split(/\r?\n/).slice(1).join("\n");
  if (/<!DOCTYPE|<html/i.test(csvText.slice(0, 200))) {
    throw new Error("Google trả HTML (sheet chưa public). Share Anyone with the link (Viewer).");
  }

  const { headers, rows, headerRowIndex } = parseInventoryCsv(csvText);
  const mapped = [];
  for (const row of rows) {
    const m = mapInventoryRow(row, headers);
    if (m) mapped.push(m);
  }
  if (!mapped.length) {
    throw new Error(
      `Không đọc được căn nào (header ~dòng ${(headerRowIndex || 0) + 1}). Cần cột "Mã căn"/"Mã Căn Hộ". Kiểm tra đúng tab (gid) + quyền xem.`
    );
  }

  const nowStr = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  await run(db, "DELETE FROM inventory_units WHERE source_id = ?", [sourceId]);

  const stmts = mapped.map((u) => ({
    sql: `INSERT INTO inventory_units(
      project_id, source_id, source_code, unit_code, building, floor, unit_no,
      unit_type, layout, direction, view_text, area_net, area_gross,
      price, price_label, drive_url, status, raw_json, updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      source.project_id, sourceId, source.code || "", u.unitCode, u.building, u.floor, u.unitNo,
      u.unitType, u.layout, u.direction, u.viewText, u.areaNet, u.areaGross,
      u.price, u.priceLabel, u.driveUrl, u.status, u.statusRaw || "", nowStr,
    ],
  }));
  const chunk = 80;
  for (let i = 0; i < stmts.length; i += chunk) {
    await db.batch(stmts.slice(i, i + chunk), "write");
  }

  const available = mapped.filter((u) => u.status === "available").length;
  const booking = mapped.filter((u) => u.status === "booking").length;
  const sold = mapped.filter((u) => u.status === "sold").length;

  await run(db,
    "UPDATE inventory_sources SET last_sync_at = ?, last_sync_count = ?, last_sync_error = '' WHERE id = ?",
    [nowStr, mapped.length, sourceId]
  );
  return {
    ok: true,
    count: mapped.length,
    available,
    booking,
    sold,
    sourceId,
    projectId: source.project_id,
    code: source.code,
  };
}
