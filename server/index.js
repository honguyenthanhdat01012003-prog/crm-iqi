import { createClient } from "@libsql/client";
import cors from "cors";
import crypto from "crypto";
import express from "express";
import fs from "fs";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 4000);
const DB_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DB_DIR, "crm.db");
const JWT_SECRET = process.env.JWT_SECRET || "crm-dev-secret-change-in-production";

const PUBLISH_BASE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR768IcRYeqkD4K4tuy78f8C_Bpue7VB_VZ4GRhVVm_N-JiR-PnIfUz9Tm1EyLXIER2XojzoYrNBGgA/pub";
const DEFAULT_LEAD_GID = "0";
const DEFAULT_COST_GID = "371649615";
const buildCsvUrl = (gid) => `${PUBLISH_BASE}?gid=${gid}&single=true&output=csv`;

/* ---------- Auth helpers ---------- */

function hashPassword(plain, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plain, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(plain, storedHash, storedSalt) {
  const { hash } = hashPassword(plain, storedSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
}

function foldText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function run(client, sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return { lastID: Number(result.lastInsertRowid), changes: result.rowsAffected };
}

async function all(client, sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return result.rows.map((r) => ({ ...r }));
}

async function get(client, sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return result.rows[0] ? { ...result.rows[0] } : undefined;
}

async function initDb() {
  const dbUrl = process.env.TURSO_URL || `file:${DB_PATH}`;
  if (dbUrl.startsWith("file:")) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  const db = createClient({
    url: dbUrl,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      project_id INTEGER NOT NULL,
      channel TEXT,
      budget REAL DEFAULT 0,
      spent REAL DEFAULT 0
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      campaign TEXT,
      campaign_id INTEGER,
      adset_name TEXT DEFAULT '-',
      ad_name TEXT DEFAULT '-',
      form_name TEXT DEFAULT '-',
      product TEXT,
      raw_status TEXT,
      status TEXT,
      created_at TEXT,
      inbox_url TEXT,
      is_hot INTEGER DEFAULT 0,
      sale_id INTEGER,
      sale_name TEXT DEFAULT '',
      source TEXT,
      budget TEXT,
      sync_at TEXT,
      notes TEXT,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    )`
  );

  // Migration: add sale_name if table existed before this column was added
  try { await run(db, "ALTER TABLE leads ADD COLUMN sale_name TEXT DEFAULT ''"); } catch { /* already exists */ }
  try { await run(db, "ALTER TABLE leads ADD COLUMN adset_name TEXT DEFAULT '-'"); } catch { /* already exists */ }
  try { await run(db, "ALTER TABLE leads ADD COLUMN ad_name TEXT DEFAULT '-'"); } catch { /* already exists */ }
  try { await run(db, "ALTER TABLE leads ADD COLUMN form_name TEXT DEFAULT '-'"); } catch { /* already exists */ }

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lead_url TEXT DEFAULT '',
      cost_url TEXT DEFAULT '',
      cost_data TEXT DEFAULT '{}'
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS lead_history (
      id INTEGER PRIMARY KEY,
      lead_id INTEGER NOT NULL,
      sale_name TEXT NOT NULL,
      action TEXT DEFAULT '',
      contact_date TEXT DEFAULT '',
      status TEXT DEFAULT '',
      feedback TEXT DEFAULT '',
      seq INTEGER DEFAULT 0
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'sale',
      display_name TEXT NOT NULL DEFAULT '',
      telegram_id TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`
  );

  // Migration: add telegram_id if missing
  try { await run(db, "ALTER TABLE users ADD COLUMN telegram_id TEXT NOT NULL DEFAULT ''"); } catch (_) {}

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS telegram_bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      token TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  );

  // Create default admin if no users exist
  const userCount = await get(db, "SELECT COUNT(*) as cnt FROM users");
  if (userCount.cnt === 0) {
    const { hash, salt } = hashPassword("admin123");
    await run(
      db,
      "INSERT INTO users(username, password_hash, salt, role, display_name) VALUES(?, ?, ?, ?, ?)",
      ["admin", hash, salt, "admin", "Administrator"]
    );
  }

  // Migration: create default project from legacy settings if none exist
  const projCount = await get(db, "SELECT COUNT(*) as cnt FROM projects");
  if (projCount.cnt === 0) {
    const sRows = await all(db, "SELECT key, value FROM settings");
    const sMap = Object.fromEntries(sRows.map((r) => [r.key, r.value]));
    await run(
      db,
      "INSERT INTO projects(name, lead_url, cost_url, cost_data) VALUES(?, ?, ?, ?)",
      [
        sMap.projectName || "RealCRM",
        sMap.leadUrl || buildCsvUrl(DEFAULT_LEAD_GID),
        sMap.costUrl || buildCsvUrl(DEFAULT_COST_GID),
        sMap.projectCost || "{}",
      ]
    );
  }

  return db;
}

async function upsertSetting(db, key, value) {
  await run(
    db,
    `INSERT INTO settings(key, value) VALUES(?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value ?? ""]
  );
}

async function getConfig(db) {
  const rows = await all(db, "SELECT key, value FROM settings");
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    leadUrl: map.leadUrl || buildCsvUrl(DEFAULT_LEAD_GID),
    costUrl: map.costUrl || buildCsvUrl(DEFAULT_COST_GID),
    projectName: map.projectName || "RealCRM",
    lastSync: map.lastSync || null,
  };
}

async function fetchCsvText(csvUrl) {
  const response = await fetch(csvUrl);
  if (!response.ok) throw new Error(`Sheet request failed: ${response.status}`);
  return response.text();
}

function extractProjectName(csvText) {
  if (!csvText) return "RealCRM";
  const lines = csvText.split(/\r?\n/).filter((l) => l.replace(/\s+/g, ""));

  for (let i = 0; i < Math.min(5, lines.length); i += 1) {
    const match = lines[i].match(/\(([^)]+)\)/);
    if (match && match[1] && match[1].trim()) return match[1].trim();
  }

  const matchAll = csvText.match(/\(([^)]+)\)/);
  if (matchAll && matchAll[1] && matchAll[1].trim()) return matchAll[1].trim();

  const firstLine = lines[0] || "";
  const firstCell = firstLine.split(",")[0].replace(/^"|"$/g, "").trim();
  if (firstCell && firstCell.length < 80) return firstCell;

  return "RealCRM";
}

function parseCSV(text) {
  const allLines = text.trim().split(/\r?\n/);
  const lines = allLines.filter((l) => l.replace(/,/g, "").trim());
  if (lines.length < 2) return { headers: [], rawHeaders: [], rows: [], rawRows: [] };

  const splitRow = (line) => {
    const cols = [];
    let cur = "";
    let inQ = false;

    for (const ch of line) {
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === "," && !inQ) {
        cols.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }

    cols.push(cur.trim());
    return cols;
  };

  const rawHeaderCols = splitRow(lines[0]);
  const rawHeaders = rawHeaderCols.map((h) => h.trim());
  const headers = rawHeaders.map((h) => h.toLowerCase());

  const rawRows = [];
  const rows = lines.slice(1).map((line) => {
    const cols = splitRow(line);
    rawRows.push(cols.map((c) => c.trim()));
    const obj = {};

    headers.forEach((h, i) => {
      obj[h] = (cols[i] ?? "").trim();
    });

    return obj;
  });

  return { headers, rawHeaders, rows, rawRows };
}

function findVal(obj, candidates) {
  const keys = Object.keys(obj);
  const normalized = keys.map((key) => ({ raw: key, norm: foldText(key) }));

  for (const c of candidates) {
    const needle = foldText(c);
    const found = normalized.find((entry) => entry.norm === needle || entry.norm.includes(needle));
    if (found) return obj[found.raw] ?? "";
  }

  return "";
}

function normalizeStatus(raw = "") {
  const v = foldText(raw);
  if (!v || v === "created" || v.includes("chua xu ly")) return "new";
  if (v.includes("chot") || v.includes("mua") || v.includes("closed")) return "closed";
  if (v.includes("giu cho") || v.includes("coc") || v.includes("book")) return "booked";
  if (v.includes("hen") || v.includes("di xem") || v.includes("xem nha") || v.includes("hen gap") || v.includes("hen xem")) return "appointment";
  if (v.includes("pha") || v.includes("rac") || v.includes("spam")) return "spam";
  if (v.includes("tai chinh yeu") || v.includes("tai chinh")) return "weak_finance";
  if (v.includes("thue bao") || v.includes("sai so") || v.includes("sai")) return "wrong_number";
  if (v.includes("chua lien lac") || v.includes("khong lien lac") || v.includes("khong nghe") || v.includes("tat may") || v.includes("unreachable")) return "unreachable";
  if (v.includes("lien lac lai") || v.includes("goi lai")) return "callback";
  if (v.includes("chan kb") || v.includes("chan zalo") || (v.includes("chan") && !v.includes("chien"))) return "blocked";
  if (v.includes("khong quan") || v.includes("tu choi") || v.includes("not_interested")) return "not_interested";
  if (v.includes("quan tam hoi hot") || v.includes("hoi hot")) return "low_interest";
  if (v.includes("quan tam du an khac") || v.includes("du an khac")) return "other_project";
  if (v.includes("sale khac") || v.includes("co sale")) return "has_sale";
  if (v.includes("quan tam") || v.includes("tu van") || v.includes("interested")) return "interested";
  if (v.includes("goi") || v.includes("lien he") || v.includes("called") || v.includes("zalo")) return "called";
  if (v.includes("mat") || v.includes("lost") || v.includes("huy")) return "lost";
  return "new";
}

function extractSaleBlocks(rawHeaders) {
  const blocks = [];
  const foldedH = rawHeaders.map((h) => foldText(h));
  const usedNhanLead = new Set();

  for (let i = 0; i < rawHeaders.length; i++) {
    // Pattern 1: "Tên Sale Feedback Khách"
    const m = foldedH[i].match(/^(.+?)\s*feedback\s*khach/);
    // Pattern 2: "Feedback Khách Tên Sale"
    const m2 = !m ? foldedH[i].match(/^feedback\s*khach\s+(.+)/) : null;
    if (!m && !m2) continue;
    const nameNorm = (m ? m[1] : m2[1]).trim();
    if (!nameNorm || ["status", "ngay", "nhan lead"].includes(nameNorm)) continue;

    const origName = m
      ? rawHeaders[i].replace(/\s*[Ff]eedback\s*[Kk]h[áa]ch.*$/i, "").trim()
      : rawHeaders[i].replace(/^.*?[Ff]eedback\s*[Kk]h[áa]ch\s*/i, "").trim();
    if (!origName) continue;

    let nhanLeadIdx = -1;
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      if (foldedH[j].includes("nhan lead") && !usedNhanLead.has(j)) { nhanLeadIdx = j; break; }
    }
    if (nhanLeadIdx >= 0) usedNhanLead.add(nhanLeadIdx);

    const middleCols = nhanLeadIdx >= 0
      ? Array.from({ length: i - nhanLeadIdx - 1 }, (_, k) => nhanLeadIdx + 1 + k)
      : [];

    blocks.push({ name: origName, nhanLeadIdx, feedbackIdx: i, middleCols });
  }
  return blocks;
}

function pickSaleInfo(rawCols, saleBlocks) {
  let currentSale = "";
  let bestStatus = "";

  for (const block of saleBlocks) {
    if (block.nhanLeadIdx >= 0) {
      const nhanVal = (rawCols[block.nhanLeadIdx] || "").trim();
      if (!nhanVal) continue;

      let statusText = "";
      for (const ci of block.middleCols) {
        const val = (rawCols[ci] || "").trim();
        if (val && !/^\d{1,2}\/\d{1,2}/.test(val)) statusText = val;
      }
      if (!statusText) {
        const fb = (rawCols[block.feedbackIdx] || "").trim();
        if (fb) statusText = fb;
      }
      if (statusText) bestStatus = statusText;

      const isRecalled = foldText(nhanVal).includes("thu hoi");
      if (!isRecalled) {
        currentSale = block.name;
        if (statusText) bestStatus = statusText;
      }
    } else {
      // Block without Nhận Lead column — check feedback column for data
      const fb = (rawCols[block.feedbackIdx] || "").trim();
      if (fb) {
        currentSale = block.name;
        bestStatus = fb;
      }
    }
  }

  if (!currentSale) {
    for (let i = saleBlocks.length - 1; i >= 0; i--) {
      const b = saleBlocks[i];
      const v = b.nhanLeadIdx >= 0
        ? (rawCols[b.nhanLeadIdx] || "").trim()
        : (rawCols[b.feedbackIdx] || "").trim();
      if (v) { currentSale = b.name; break; }
    }
  }

  return { saleName: currentSale, saleStatus: bestStatus };
}

function extractSaleHistory(rawCols, saleBlocks) {
  const history = [];
  for (const block of saleBlocks) {
    if (block.nhanLeadIdx >= 0) {
      const action = (rawCols[block.nhanLeadIdx] || "").trim();
      if (!action) continue;
      let dateText = "";
      let statusText = "";
      for (const ci of block.middleCols) {
        const val = (rawCols[ci] || "").trim();
        if (!val) continue;
        if (/^\d{1,2}\/\d{1,2}/.test(val)) dateText = val;
        else statusText = val;
      }
      const feedback = (rawCols[block.feedbackIdx] || "").trim();
      history.push({ saleName: block.name, action, date: dateText, status: statusText, feedback });
    } else {
      // Block without Nhận Lead — use feedback column only
      const feedback = (rawCols[block.feedbackIdx] || "").trim();
      if (feedback) {
        history.push({ saleName: block.name, action: "Chia lead", date: "", status: "", feedback });
      }
    }
  }
  return history;
}

function parseLeadDate(createdAt) {
  if (!createdAt || createdAt === "-") return null;
  // dd/mm/yyyy HH:MM:SS or dd/mm/yyyy
  const m = createdAt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);  if (m) {
    const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]),
      Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
    if (!isNaN(dt.getTime())) return dt;
  }
  const iso = new Date(createdAt);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

function calcIsHot(createdAt, saleName) {
  // Hot = ≤7 days AND not assigned to any sale
  // Cold = assigned to sale OR >7 days old
  const hasSale = saleName && saleName !== "Chưa chia" && saleName.trim() !== "";
  if (hasSale) return false;
  const dt = parseLeadDate(createdAt);
  if (!dt) return false;
  return (Date.now() - dt.getTime()) / 864e5 <= 7;
}

function guessChannel(campaignName = "") {
  const v = foldText(campaignName);
  if (v.includes("facebook") || v.includes("fb")) return "Facebook";
  if (v.includes("google") || v.includes("gg")) return "Google";
  if (v.includes("zalo")) return "Zalo";
  if (v.includes("hotline")) return "Hotline";
  if (v.includes("landing")) return "Google";
  return "Khac";
}

function guessSource(row, campaignName = "") {
  const source = findVal(row, ["source", "nguon", "platform", "kenh", "kenh"]);
  if (source) return source;
  return guessChannel(campaignName);
}

/**
 * When CSV headers are broken (#REF!, empty), detect column positions
 * by scanning row data for recognizable value patterns.
 */
function detectColumnIndices(rawRows) {
  for (let ri = rawRows.length - 1; ri >= 0; ri--) {
    const row = rawRows[ri];
    const filled = row.filter((v) => (v || "").trim()).length;
    if (filled < 5) continue;

    let phoneIdx = -1, inboxIdx = -1, statusIdx = -1, sourceIdx = -1;

    for (let ci = 0; ci < row.length; ci++) {
      const v = (row[ci] || "").trim();
      if (!v) continue;
      if (phoneIdx < 0 && /^p:\+?\d/.test(v)) phoneIdx = ci;
      if (inboxIdx < 0 && /^https?:\/\//.test(v)) inboxIdx = ci;
      if (sourceIdx < 0 && /^(fb|gg|zalo|google|facebook)$/i.test(v)) sourceIdx = ci;
      if (statusIdx < 0 && /^(CREATED|DUPLICATE)$/i.test(v)) statusIdx = ci;
    }

    if (phoneIdx >= 2) {
      return {
        nameIdx: phoneIdx - 1,
        phoneIdx,
        campaignIdx: 3,
        productIdx: phoneIdx - 2,
        statusIdx,
        dateIdx: statusIdx >= 0 ? statusIdx + 1 : -1,
        inboxIdx,
        sourceIdx,
        createdTimeIdx: 1,
      };
    }
  }
  return null;
}

function mapLeads(rows, headers, rawRows, rawHeaders) {
  const saleBlocks = rawHeaders ? extractSaleBlocks(rawHeaders) : [];

  // Column R: system-recorded date — right after lead_status, often has empty header
  const lsIdx = rawHeaders ? rawHeaders.findIndex((h) => foldText(h).includes("lead_status")) : -1;
  const dateColIdx = lsIdx >= 0 ? lsIdx + 1 : -1;

  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: foldText(h) }));
  const productKey =
    normalizedHeaders.find(
      (entry) =>
        entry.norm.includes("loai hinh") ||
        entry.norm.includes("quan_tam") ||
        entry.norm.includes("quan tam") ||
        entry.norm.includes("can ho")
    )?.raw ?? "";

  // Standard header-based mapping
  const standardResult = rows
    .map((r, i) => {
      const name = findVal(r, ["full name", "full_name", "ho ten", "ten", "name"]);
      if (!name) return null;

      let phone = findVal(r, ["phone", "so dien thoai", "sdt"]);
      if (phone.startsWith("p:")) phone = phone.slice(2);
      const campaign = findVal(r, ["campaign_name", "campaign name", "chien dich", "ten chien dich"]);
      const adsetName = findVal(r, ["adset_name", "adset name", "nhom quang cao", "ten nhom"]);
      const adName = findVal(r, ["ad_name", "ad name", "noi dung", "ten quang cao"]);
      const formName = findVal(r, ["form_name", "form name", "ten form"]);
      const product = productKey ? r[productKey] ?? "" : findVal(r, ["product", "loai"]);
      const fbStatus = findVal(r, ["lead_status"]);
      // Prefer column R (system date right after lead_status) over header-based lookup
      const colRDate = dateColIdx >= 0 && rawRows && rawRows[i] ? (rawRows[i][dateColIdx] || "").trim() : "";
      const createdAt = colRDate || findVal(r, ["thoi gian hien tai", "thoi gian", "ngay nhan lead", "created_time", "ngay tao", "date"]);
      const inboxUrl = findVal(r, ["inbox_url", "inbox url", "link", "url"]);
      const budget = findVal(r, ["budget", "ngan sach", "muc gia", "khoang gia"]);
      const source = guessSource(r, campaign);

      const { saleName, saleStatus } = rawRows && rawRows[i]
        ? pickSaleInfo(rawRows[i], saleBlocks)
        : { saleName: "", saleStatus: "" };

      const saleHistory = rawRows && rawRows[i]
        ? extractSaleHistory(rawRows[i], saleBlocks)
        : [];

      const rawStatus = saleStatus || fbStatus;

      return {
        id: i + 1,
        projectId: 1,
        name,
        phone,
        campaign: campaign || "Khac",
        campaignId: null,
        adsetName: adsetName || "-",
        adName: adName || "-",
        formName: formName || "-",
        product: product || "-",
        rawStatus,
        status: normalizeStatus(rawStatus),
        createdAt: createdAt || "-",
        inboxUrl,
        isHot: calcIsHot(createdAt, saleName),
        saleId: 0,
        saleName: saleName || "Chưa chia",
        saleHistory,
        source: "Facebook",
        budget: budget || "-",
        syncAt: new Date().toLocaleString("vi-VN"),
        notes: "",
      };
    })
    .filter(Boolean);

  if (standardResult.length > 0) return standardResult;

  // Fallback: headers may be broken (#REF!, empty), detect columns from data
  if (!rawRows || !rawRows.length) return standardResult;
  const colMap = detectColumnIndices(rawRows);
  if (!colMap) return standardResult;

  console.log("mapLeads: using fallback column detection", colMap);

  return rawRows
    .map((rawCols, i) => {
      const name = colMap.nameIdx >= 0 ? (rawCols[colMap.nameIdx] || "").trim() : "";
      if (!name) return null;

      let phone = colMap.phoneIdx >= 0 ? (rawCols[colMap.phoneIdx] || "").trim() : "";
      if (phone.startsWith("p:")) phone = phone.slice(2);

      const campaign = colMap.campaignIdx >= 0 ? (rawCols[colMap.campaignIdx] || "").trim() : "";
      const product = colMap.productIdx >= 0 ? (rawCols[colMap.productIdx] || "").trim() : "";
      const fbStatus = colMap.statusIdx >= 0 ? (rawCols[colMap.statusIdx] || "").trim() : "";
      const createdAt =
        colMap.dateIdx >= 0
          ? (rawCols[colMap.dateIdx] || "").trim()
          : colMap.createdTimeIdx >= 0
            ? (rawCols[colMap.createdTimeIdx] || "").trim()
            : "-";
      const inboxUrl = colMap.inboxIdx >= 0 ? (rawCols[colMap.inboxIdx] || "").trim() : "";
      const source =
        colMap.sourceIdx >= 0
          ? (rawCols[colMap.sourceIdx] || "").trim()
          : guessChannel(campaign);

      const { saleName, saleStatus } = pickSaleInfo(rawCols, saleBlocks);
      const saleHistory = extractSaleHistory(rawCols, saleBlocks);
      const rawStatus = saleStatus || fbStatus;

      // fallback: try to get adset/ad from raw columns 3 and 5
      const adName = rawCols[3] ? rawCols[3].trim() : "-";
      const adsetName = rawCols[5] ? rawCols[5].trim() : "-";
      const formName = rawCols[9] ? rawCols[9].trim() : "-";

      return {
        id: i + 1,
        projectId: 1,
        name,
        phone,
        campaign: campaign || "Khac",
        campaignId: null,
        adsetName,
        adName,
        formName,
        product: product || "-",
        rawStatus,
        status: normalizeStatus(rawStatus),
        createdAt: createdAt || "-",
        inboxUrl,
        isHot: calcIsHot(createdAt, saleName),
        saleId: 0,
        saleName: saleName || "Chưa chia",
        saleHistory,
        source: "Facebook",
        budget: "-",
        syncAt: new Date().toLocaleString("vi-VN"),
        notes: "",
      };
    })
    .filter(Boolean);
}

function parseVnNumber(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/\./g, "").replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseCostSheet(rawHeaders, rawRows) {
  if (!rawHeaders || !rawRows || !rawRows.length) return { totalSpent: 0, totalLeads: 0, totalBooking: 0, cpLead: 0 };

  const foldedH = rawHeaders.map((h) => foldText(h));
  let spentIdx = -1, leadsIdx = -1, bookingIdx = -1, dateIdx = -1;

  for (let i = 0; i < foldedH.length; i++) {
    if (dateIdx < 0 && foldedH[i] === "ngay") dateIdx = i;
    if (spentIdx < 0 && foldedH[i].includes("tong tien chi tieu")) spentIdx = i;
    if (leadsIdx < 0 && foldedH[i].includes("tong so lead") && !foldedH[i].includes("verify") && !foldedH[i].includes("pha")) leadsIdx = i;
    if (bookingIdx < 0 && foldedH[i].includes("booking")) bookingIdx = i;
  }

  let totalSpent = 0, totalLeads = 0, totalBooking = 0;

  for (const cols of rawRows) {
    const dateVal = dateIdx >= 0 ? (cols[dateIdx] || "").trim() : "";
    if (!dateVal || !/\d{1,2}\/\d{1,2}\/\d{4}/.test(dateVal)) continue;

    totalSpent += parseVnNumber(spentIdx >= 0 ? cols[spentIdx] : "");
    totalLeads += Math.round(parseVnNumber(leadsIdx >= 0 ? cols[leadsIdx] : ""));
    totalBooking += Math.round(parseVnNumber(bookingIdx >= 0 ? cols[bookingIdx] : ""));
  }

  return {
    totalSpent,
    totalLeads,
    totalBooking,
    cpLead: totalLeads > 0 ? Math.round(totalSpent / totalLeads) : 0,
  };
}

/**
 * Normalise any Google Sheets URL the user pastes.
 * Handles pubhtml links, &amp; entities, missing output=csv, edit URLs etc.
 */
function sanitizeSheetUrl(raw) {
  if (!raw) return "";
  let url = String(raw).trim();
  // decode HTML entities
  url = url.replace(/&amp;/g, "&");
  // convert /pubhtml → /pub
  url = url.replace(/\/pubhtml\b/, "/pub");
  // convert /edit urls → /pub
  url = url.replace(/\/edit(#.*)?$/, "/pub");
  // strip widget / headers params
  url = url.replace(/[?&]widget=[^&]*/g, "").replace(/[?&]headers=[^&]*/g, "");
  // make sure output=csv is present (only when it's a Google Sheets pub URL)
  if (url.includes("/pub") && !url.includes("output=csv")) {
    url += (url.includes("?") ? "&" : "?") + "output=csv";
  }
  // ensure single=true
  if (url.includes("/pub") && !url.includes("single=true")) {
    url += "&single=true";
  }
  // fix double ? or dangling &
  url = url.replace(/\?&/, "?").replace(/&&+/g, "&");
  return url;
}

async function replaceProjectData(db, projectId, leads, campaigns) {
  // Preserve user-edited fields for this project
  const existing = await all(
    db,
    "SELECT name, phone, status, raw_status, notes, sale_id, sale_name, is_hot FROM leads WHERE project_id = ?",
    [projectId]
  );
  const editMap = new Map();
  for (const e of existing) {
    editMap.set(`${e.name}||${e.phone}`, e);
  }

  // Build all SQL statements as a batch (single HTTP request to Turso)
  const stmts = [];

  // Delete old data
  stmts.push({ sql: "DELETE FROM lead_history WHERE lead_id IN (SELECT id FROM leads WHERE project_id = ?)", args: [projectId] });
  stmts.push({ sql: "DELETE FROM leads WHERE project_id = ?", args: [projectId] });
  stmts.push({ sql: "DELETE FROM campaigns WHERE project_id = ?", args: [projectId] });

  // Insert campaigns
  for (const c of campaigns) {
    stmts.push({
      sql: "INSERT INTO campaigns(name, project_id, channel, budget, spent) VALUES(?, ?, ?, ?, ?)",
      args: [c.name, projectId, c.channel, c.budget, c.spent],
    });
  }

  // Insert leads (without campaign_id for now — not critical)
  for (const l of leads) {
    const prev = editMap.get(`${l.name}||${l.phone}`);
    const status = prev ? prev.status : l.status;
    const rawStatus = prev ? prev.raw_status : l.rawStatus;
    const notes = prev && prev.notes ? prev.notes : l.notes || "";
    const saleId = prev ? prev.sale_id : l.saleId;
    const saleName = l.saleName || (prev ? prev.sale_name : "") || "";
    const isHot = prev ? prev.is_hot : l.isHot ? 1 : 0;

    stmts.push({
      sql: `INSERT INTO leads(
        project_id, name, phone, campaign, campaign_id, adset_name, ad_name, form_name,
        product, raw_status, status,
        created_at, inbox_url, is_hot, sale_id, sale_name, source, budget, sync_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        projectId, l.name, l.phone, l.campaign, null,
        l.adsetName || "-", l.adName || "-", l.formName || "-",
        l.product,
        rawStatus, status, l.createdAt, l.inboxUrl, isHot, saleId, saleName,
        l.source, l.budget, l.syncAt, notes,
      ],
    });

    if (l.saleHistory && l.saleHistory.length) {
      for (let si = 0; si < l.saleHistory.length; si++) {
        const sh = l.saleHistory[si];
        stmts.push({
          sql: "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq) VALUES((SELECT MAX(id) FROM leads), ?, ?, ?, ?, ?, ?)",
          args: [sh.saleName, sh.action, sh.date, sh.status, sh.feedback, si],
        });
      }
    }
  }

  // Send all in one batch (single HTTP round-trip)
  console.log(`[replaceProjectData] project=${projectId} stmts=${stmts.length} leads=${leads.length} campaigns=${campaigns.length}`);
  await db.batch(stmts, "write");
  console.log(`[replaceProjectData] batch done for project=${projectId}`);
}

async function readData(db) {
  const leads = await all(db, "SELECT * FROM leads ORDER BY id ASC");
  const historyRows = await all(db, "SELECT * FROM lead_history ORDER BY lead_id, seq");
  const historyMap = {};
  for (const h of historyRows) {
    if (!historyMap[h.lead_id]) historyMap[h.lead_id] = [];
    historyMap[h.lead_id].push({ saleName: h.sale_name, action: h.action, date: h.contact_date, status: h.status, feedback: h.feedback });
  }
  const campaigns = await all(db, "SELECT * FROM campaigns ORDER BY id ASC");
  const projectRows = await all(db, "SELECT * FROM projects ORDER BY id ASC");

  return {
    leads: leads.map((l) => ({
      id: l.id,
      projectId: l.project_id,
      name: l.name,
      phone: l.phone,
      campaign: l.campaign,
      campaignId: l.campaign_id,
      adsetName: l.adset_name || "-",
      adName: l.ad_name || "-",
      formName: l.form_name || "-",
      product: l.product,
      rawStatus: l.raw_status,
      status: l.status,
      createdAt: l.created_at,
      inboxUrl: l.inbox_url,
      isHot: Boolean(l.is_hot),
      saleId: l.sale_id,
      saleName: l.sale_name || "",
      saleHistory: historyMap[l.id] || [],
      source: l.source,
      budget: l.budget,
      syncAt: l.sync_at,
      notes: l.notes,
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      projectId: c.project_id,
      channel: c.channel,
      budget: c.budget,
      spent: c.spent,
    })),
    projects: projectRows.map((p) => ({
      id: p.id,
      name: p.name,
      leadUrl: p.lead_url || "",
      costUrl: p.cost_url || "",
      costData: JSON.parse(p.cost_data || "{}"),
    })),
  };
}

async function syncProject(db, projectId) {
  const project = await get(db, "SELECT * FROM projects WHERE id = ?", [projectId]);
  if (!project) throw new Error("Project not found: " + projectId);

  const leadUrl = project.lead_url;
  const costUrl = project.cost_url;
  if (!leadUrl) return;

  const rawLead = await fetchCsvText(leadUrl);

  let cleanLeadCsv = rawLead;
  const firstLine = rawLead.split(/\r?\n/)[0] || "";
  if (!firstLine.includes(",")) {
    cleanLeadCsv = rawLead.split(/\r?\n/).slice(1).join("\n");
  }

  const { headers, rawHeaders, rows, rawRows } = parseCSV(cleanLeadCsv);
  const mappedLeads = mapLeads(rows, headers, rawRows, rawHeaders);
  mappedLeads.forEach((l) => {
    l.projectId = projectId;
  });

  let projectCost = { totalSpent: 0, totalLeads: 0, totalBooking: 0, cpLead: 0 };
  if (costUrl) {
    try {
      const rawCost = await fetchCsvText(costUrl);
      const { rawHeaders: costRH, rawRows: costRR } = parseCSV(rawCost);
      projectCost = parseCostSheet(costRH, costRR);
    } catch {
      /* keep defaults */
    }
  }

  const campaignMap = new Map();
  mappedLeads.forEach((lead) => {
    if (!campaignMap.has(lead.campaign)) {
      campaignMap.set(lead.campaign, {
        name: lead.campaign,
        projectId,
        channel: guessChannel(lead.campaign),
        budget: 0,
        spent: 0,
      });
    }
  });
  const campaigns = Array.from(campaignMap.values());

  await replaceProjectData(db, projectId, mappedLeads, campaigns);
  await run(db, "UPDATE projects SET cost_data = ? WHERE id = ?", [
    JSON.stringify(projectCost),
    projectId,
  ]);
}

async function syncAllProjects(db) {
  const projects = await all(db, "SELECT * FROM projects ORDER BY id ASC");
  const errors = [];
  for (const p of projects) {
    try {
      await syncProject(db, p.id);
    } catch (e) {
      console.error("Sync project", p.id, "failed:", e.message, e.stack);
      errors.push(`${p.name}: ${e.message}`);
    }
  }
  if (errors.length) console.error("Sync errors:", errors);
  const lastSync = new Date().toISOString();
  await upsertSetting(db, "lastSync", lastSync);
  return { lastSync, syncErrors: errors };
}

const app = express();

// --- Security headers ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// --- Serve static build ---
const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

const db = await initDb();

/* ---------- Auth middleware ---------- */
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
}

/* ---------- Auth endpoints ---------- */
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const user = await get(db, "SELECT * FROM users WHERE username = ?", [String(username).trim()]);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (!verifyPassword(String(password), user.password_hash, user.salt)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const payload = { userId: user.id, username: user.username, role: user.role, displayName: user.display_name };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, user: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/logout", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/* ---------- User management (admin only) ---------- */
const mapUser = u => ({ id: u.id, username: u.username, role: u.role, displayName: u.display_name, telegramId: u.telegram_id || "", createdAt: u.created_at });
const selectUsers = () => all(db, "SELECT id, username, role, display_name, telegram_id, created_at FROM users ORDER BY id");

app.get("/api/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await selectUsers();
    res.json(users.map(mapUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, role, displayName, telegramId } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const validRole = ["admin", "sale"].includes(role) ? role : "sale";
    const { hash, salt } = hashPassword(String(password));
    await run(
      db,
      "INSERT INTO users(username, password_hash, salt, role, display_name, telegram_id) VALUES(?, ?, ?, ?, ?, ?)",
      [String(username).trim(), hash, salt, validRole, String(displayName || username).trim(), String(telegramId || "").trim()]
    );
    const users = await selectUsers();
    res.json(users.map(mapUser));
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return res.status(400).json({ error: "Username already exists" });
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { password, role, displayName, telegramId } = req.body;
    if (password) {
      const { hash, salt } = hashPassword(String(password));
      await run(db, "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?", [hash, salt, id]);
    }
    if (role && ["admin", "sale"].includes(role)) {
      await run(db, "UPDATE users SET role = ? WHERE id = ?", [role, id]);
    }
    if (displayName !== undefined) {
      await run(db, "UPDATE users SET display_name = ? WHERE id = ?", [String(displayName).trim(), id]);
    }
    if (telegramId !== undefined) {
      await run(db, "UPDATE users SET telegram_id = ? WHERE id = ?", [String(telegramId).trim(), id]);
    }
    const users = await selectUsers();
    res.json(users.map(mapUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user.userId === id) return res.status(400).json({ error: "Cannot delete yourself" });
    await run(db, "DELETE FROM users WHERE id = ?", [id]);
    const users = await selectUsers();
    res.json(users.map(mapUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- Telegram Bots CRUD ---------- */
const mapBot = b => ({ id: b.id, name: b.name, token: b.token, isActive: !!b.is_active, createdAt: b.created_at });

app.get("/api/telegram-bots", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const bots = await all(db, "SELECT * FROM telegram_bots ORDER BY id");
    res.json(bots.map(mapBot));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/telegram-bots", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, token } = req.body;
    if (!name || !token) return res.status(400).json({ error: "Tên bot và token bắt buộc" });
    await run(db, "INSERT INTO telegram_bots(name, token) VALUES(?, ?)", [String(name).trim(), String(token).trim()]);
    const bots = await all(db, "SELECT * FROM telegram_bots ORDER BY id");
    res.json(bots.map(mapBot));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/telegram-bots/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, token, isActive } = req.body;
    if (name !== undefined) await run(db, "UPDATE telegram_bots SET name = ? WHERE id = ?", [String(name).trim(), id]);
    if (token !== undefined) await run(db, "UPDATE telegram_bots SET token = ? WHERE id = ?", [String(token).trim(), id]);
    if (isActive !== undefined) await run(db, "UPDATE telegram_bots SET is_active = ? WHERE id = ?", [isActive ? 1 : 0, id]);
    const bots = await all(db, "SELECT * FROM telegram_bots ORDER BY id");
    res.json(bots.map(mapBot));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/telegram-bots/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await run(db, "DELETE FROM telegram_bots WHERE id = ?", [Number(req.params.id)]);
    const bots = await all(db, "SELECT * FROM telegram_bots ORDER BY id");
    res.json(bots.map(mapBot));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ---------- Public health ---------- */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, dbPath: DB_PATH });
});

app.get("/api/config", requireAuth, async (_req, res) => {
  try {
    const config = await getConfig(db);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not read config" });
  }
});

app.get("/api/data", requireAuth, async (req, res) => {
  try {
    const config = await getConfig(db);
    const data = await readData(db);
    // Sale users can only see leads assigned to them (flexible name matching)
    if (req.user.role === "sale") {
      filterLeadsForSale(data, req.user.displayName);
    }
    res.json({ ...config, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not read data" });
  }
});

app.post("/api/sync", requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log("[sync] Starting sync...");
    const { lastSync, syncErrors } = await syncAllProjects(db);
    const data = await readData(db);
    console.log(`[sync] Done. leads=${data.leads.length} campaigns=${data.campaigns.length} errors=${syncErrors.length}`);
    res.json({ lastSync, syncErrors, ...data });
  } catch (err) {
    console.error("[sync] Top-level error:", err.message, err.stack);
    res.status(500).json({ error: err.message || "Sync failed" });
  }
});

/* ===== Project CRUD ===== */
app.get("/api/projects", requireAuth, async (_req, res) => {
  try {
    const data = await readData(db);
    res.json(data.projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/projects", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, leadUrl, costUrl } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Name required" });
    const existing = await get(db, "SELECT id FROM projects WHERE name = ?", [String(name).trim()]);
    if (existing) return res.status(409).json({ error: "Dự án đã tồn tại" });
    const cleanLead = sanitizeSheetUrl(leadUrl);
    const cleanCost = sanitizeSheetUrl(costUrl);
    const result = await run(
      db,
      "INSERT INTO projects(name, lead_url, cost_url) VALUES(?, ?, ?)",
      [String(name).trim(), cleanLead, cleanCost]
    );
    const data = await readData(db);
    res.json({ ...data, newProjectId: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/projects/:id/sync", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await syncProject(db, id);
    const data = await readData(db);
    res.json(data);
  } catch (err) {
    console.error("[syncProject] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/projects/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, leadUrl, costUrl } = req.body;
    const cleanLead = sanitizeSheetUrl(leadUrl);
    const cleanCost = sanitizeSheetUrl(costUrl);
    await run(
      db,
      "UPDATE projects SET name = ?, lead_url = ?, cost_url = ? WHERE id = ?",
      [String(name || "").trim(), cleanLead, cleanCost, id]
    );
    const data = await readData(db);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/projects/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await run(db, "DELETE FROM lead_history WHERE lead_id IN (SELECT id FROM leads WHERE project_id = ?)", [id]);
    await run(db, "DELETE FROM leads WHERE project_id = ?", [id]);
    await run(db, "DELETE FROM campaigns WHERE project_id = ?", [id]);
    await run(db, "DELETE FROM projects WHERE id = ?", [id]);
    const data = await readData(db);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===== Lead shuffle (round-robin) — Admin only ===== */
app.post("/api/leads/shuffle", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { projectId, saleNames } = req.body;
    if (!saleNames || !saleNames.length) return res.status(400).json({ error: "Cần chọn ít nhất 1 sale" });
    const pid = Number(projectId) || 1;
    // Get unassigned leads (sale_name is empty or 'Chưa chia')
    const leads = await all(db,
      "SELECT id FROM leads WHERE project_id = ? AND (sale_name = '' OR sale_name = 'Chưa chia' OR sale_name IS NULL) ORDER BY id ASC",
      [pid]
    );
    if (!leads.length) return res.json({ msg: "Không có lead nào cần xáo", assigned: 0 });
    const stmts = leads.map((l, i) => ({
      sql: "UPDATE leads SET sale_name = ? WHERE id = ?",
      args: [saleNames[i % saleNames.length], l.id],
    }));
    await db.batch(stmts, "write");
    const data = await readData(db);
    res.json({ msg: `Đã xáo ${leads.length} lead cho ${saleNames.length} sale`, assigned: leads.length, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Shuffle failed" });
  }
});

/* ===== Lead updates ===== */
function matchSaleName(leadSaleName, userDisplayName) {
  const sn = (leadSaleName || "").toLowerCase().trim();
  const dn = (userDisplayName || "").toLowerCase().trim();
  if (!sn || sn === "chưa chia") return false;
  if (sn === dn) return true;
  const dnWords = dn.split(/\s+/).filter(Boolean);
  return dnWords.every(w => sn.includes(w));
}

function filterLeadsForSale(data, displayName) {
  data.leads = data.leads.filter(l => matchSaleName(l.saleName, displayName));
  return data;
}

app.put("/api/leads/:id", requireAuth, async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    // Sale can only update leads assigned to them
    if (req.user.role === "sale") {
      const lead = await get(db, "SELECT sale_name FROM leads WHERE id = ?", [leadId]);
      if (!lead || !matchSaleName(lead.sale_name, req.user.displayName)) {
        return res.status(403).json({ error: "You can only update your own leads" });
      }
    }
    const { status, notes, saleId, saleName, isHot } = req.body;
    const sets = [];
    const params = [];

    // Only admin can change sale assignment and isHot
    if (req.user.role === "admin") {
      if (saleId !== undefined) { sets.push("sale_id = ?"); params.push(saleId); }
      if (saleName !== undefined) { sets.push("sale_name = ?"); params.push(saleName); }
      if (isHot !== undefined) { sets.push("is_hot = ?"); params.push(isHot ? 1 : 0); }
    }
    if (status !== undefined) { sets.push("status = ?"); params.push(status); }
    if (notes !== undefined) { sets.push("notes = ?"); params.push(notes); }

    if (sets.length) {
      params.push(leadId);
      await run(db, `UPDATE leads SET ${sets.join(", ")} WHERE id = ?`, params);
    }

    const data = await readData(db);
    if (req.user.role === "sale") {
      filterLeadsForSale(data, req.user.displayName);
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || "Update failed" });
  }
});

/* ===== Lead history (manual entry) ===== */
app.post("/api/leads/:id/history", requireAuth, async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const lead = await get(db, "SELECT * FROM leads WHERE id = ?", [leadId]);
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    // Sale can only add history to their own leads
    if (req.user.role === "sale" && !matchSaleName(lead.sale_name, req.user.displayName)) {
      return res.status(403).json({ error: "You can only update your own leads" });
    }

    const { status, feedback } = req.body;
    const saleName = req.user.displayName;
    const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [leadId]);
    const nextSeq = (maxSeq?.m ?? -1) + 1;
    const now = new Date().toLocaleString("vi-VN");

    await run(
      db,
      "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq) VALUES(?, ?, ?, ?, ?, ?, ?)",
      [leadId, saleName, "Cập nhật", now, status || "", feedback || "", nextSeq]
    );

    // Also update lead status if provided
    if (status) {
      await run(db, "UPDATE leads SET status = ?, raw_status = ? WHERE id = ?", [normalizeStatus(status), status, leadId]);
    }

    const data = await readData(db);
    if (req.user.role === "sale") {
      filterLeadsForSale(data, req.user.displayName);
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SPA fallback: serve index.html for non-API routes ---
if (fs.existsSync(distPath)) {
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Only listen when running directly (not on Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`CRM API running at http://localhost:${PORT}`);
  });
}

export default app;
