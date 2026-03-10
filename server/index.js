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
    .replace(/[đĐ]/g, "d")
    .replace(/_/g, " ")
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
  // Migration: add profile fields
  try { await run(db, "ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''"); } catch (_) {}
  try { await run(db, "ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''"); } catch (_) {}
  try { await run(db, "ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''"); } catch (_) {}
  try { await run(db, "ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0"); } catch (_) {}
  try { await run(db, "ALTER TABLE users ADD COLUMN last_active TEXT DEFAULT ''"); } catch (_) {}

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

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS user_projects (
      user_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, project_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS telegram_pending (
      telegram_id TEXT PRIMARY KEY,
      lead_id INTEGER NOT NULL,
      status TEXT DEFAULT '',
      message_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  );
  // Add message_id column if missing (migration)
  try { await run(db, "ALTER TABLE telegram_pending ADD COLUMN message_id INTEGER"); } catch (_) {}

  /* ---------- Facebook Pages & Posts tables ---------- */
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS fb_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      page_id TEXT NOT NULL DEFAULT '',
      access_token TEXT NOT NULL DEFAULT '',
      avatar_url TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS fb_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      images TEXT DEFAULT '[]',
      project_id INTEGER,
      page_ids TEXT DEFAULT '[]',
      status TEXT DEFAULT 'draft',
      schedule_at TEXT DEFAULT '',
      link TEXT DEFAULT '',
      fb_post_id TEXT DEFAULT '',
      error_msg TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sheet_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      project_name TEXT NOT NULL DEFAULT '',
      script_url TEXT NOT NULL DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  );
  // Migration: add columns that may be missing on older DBs
  try { await run(db, "ALTER TABLE sheet_configs ADD COLUMN project_name TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
  try { await run(db, "ALTER TABLE sheet_configs ADD COLUMN is_active INTEGER DEFAULT 1"); } catch { /* already exists */ }

  /* ---------- Chat messages table ---------- */
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  /* ---------- Lead status log for time-in-stage tracking ---------- */
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS lead_status_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      old_status TEXT DEFAULT '',
      new_status TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      changed_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    )`
  );

  // Migrate legacy single sheet_script_url into sheet_configs
  {
    const scCount = await get(db, "SELECT COUNT(*) as cnt FROM sheet_configs");
    if (scCount.cnt === 0) {
      const legacy = await get(db, "SELECT value FROM settings WHERE key='sheet_script_url'");
      if (legacy?.value) {
        await run(db, "INSERT INTO sheet_configs(name, script_url) VALUES(?, ?)", ["Mặc định", legacy.value]);
      }
    }
  }

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
  const lsIdx = rawHeaders ? rawHeaders.findIndex((h) => foldText(h).includes("lead status")) : -1;
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
      const name = findVal(r, ["full name", "full_name", "ho ten", "ten", "name", "ten day du"]);
      if (!name) return null;

      let phone = findVal(r, ["phone", "so dien thoai", "sdt", "dien thoai", "phone number", "mobile", "di dong", "so dt"]);
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
  // Fetch existing leads for this project (keyed by name+phone for stable matching)
  const existing = await all(
    db,
    "SELECT id, name, phone, status, raw_status, notes, sale_id, sale_name, is_hot FROM leads WHERE project_id = ?",
    [projectId]
  );
  const existingMap = new Map();
  for (const e of existing) {
    existingMap.set(`${e.name}||${e.phone}`, e);
  }

  const stmts = [];

  // Nullify campaign_id on leads first to avoid FK violation when deleting campaigns
  stmts.push({ sql: "UPDATE leads SET campaign_id = NULL WHERE project_id = ?", args: [projectId] });

  // Replace campaigns (these have no IDs we need to preserve)
  stmts.push({ sql: "DELETE FROM campaigns WHERE project_id = ?", args: [projectId] });
  for (const c of campaigns) {
    stmts.push({
      sql: "INSERT INTO campaigns(name, project_id, channel, budget, spent) VALUES(?, ?, ?, ?, ?)",
      args: [c.name, projectId, c.channel, c.budget, c.spent],
    });
  }

  // Track which existing leads are still in the sheet
  const incomingKeys = new Set();

  for (const l of leads) {
    const key = `${l.name}||${l.phone}`;
    incomingKeys.add(key);
    const prev = existingMap.get(key);

    if (prev) {
      // Lead exists — UPDATE non-editable fields + sync status/sale from sheet
      const sheetStatus = normalizeStatus(l.rawStatus);
      const sheetSale = l.saleName || "";
      // Update status from sheet (sheet is source of truth for status)
      // Update sale_name from sheet only if DB has no assignment (empty or "Chưa chia")
      const newSale = (!prev.sale_name || prev.sale_name === "Chưa chia") && sheetSale && sheetSale !== "Chưa chia"
        ? sheetSale : prev.sale_name;
      stmts.push({
        sql: `UPDATE leads SET campaign = ?, adset_name = ?, ad_name = ?, form_name = ?,
              product = ?, created_at = ?, inbox_url = ?, source = ?, budget = ?, sync_at = ?,
              raw_status = ?, status = ?, sale_name = ?
              WHERE id = ?`,
        args: [
          l.campaign, l.adsetName || "-", l.adName || "-", l.formName || "-",
          l.product, l.createdAt, l.inboxUrl, l.source, l.budget, l.syncAt,
          l.rawStatus || prev.raw_status, sheetStatus || prev.status, newSale,
          prev.id,
        ],
      });
    } else {
      // New lead — INSERT
      const status = l.status;
      const rawStatus = l.rawStatus;
      const notes = l.notes || "";
      const saleId = l.saleId;
      const saleName = l.saleName || "";
      const isHot = l.isHot ? 1 : 0;

      stmts.push({
        sql: `INSERT INTO leads(
          project_id, name, phone, campaign, campaign_id, adset_name, ad_name, form_name,
          product, raw_status, status,
          created_at, inbox_url, is_hot, sale_id, sale_name, source, budget, sync_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          projectId, l.name, l.phone, l.campaign, null,
          l.adsetName || "-", l.adName || "-", l.formName || "-",
          l.product, rawStatus, status, l.createdAt, l.inboxUrl, isHot, saleId, saleName,
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
  }

  // Remove leads that no longer exist in the sheet (but keep user-assigned ones)
  for (const [key, e] of existingMap) {
    if (!incomingKeys.has(key)) {
      stmts.push({ sql: "DELETE FROM lead_history WHERE lead_id = ?", args: [e.id] });
      stmts.push({ sql: "DELETE FROM leads WHERE id = ?", args: [e.id] });
    }
  }

  console.log(`[replaceProjectData] project=${projectId} stmts=${stmts.length} leads=${leads.length} existing=${existing.length} new=${leads.length - incomingKeys.size + (leads.length - [...incomingKeys].filter(k => existingMap.has(k)).length)}`);
  // Re-enable FK checks after batch
  await db.batch(stmts, "write");
  console.log(`[replaceProjectData] batch done for project=${projectId}`);
}

async function readData(db) {
  const leads = await all(db, "SELECT * FROM leads ORDER BY id ASC");
  const historyRows = await all(db, "SELECT * FROM lead_history ORDER BY lead_id, seq");
  const historyMap = {};
  for (const h of historyRows) {
    if (!historyMap[h.lead_id]) historyMap[h.lead_id] = [];
    historyMap[h.lead_id].push({ id: h.id, saleName: h.sale_name, action: h.action, date: h.contact_date, status: h.status, feedback: h.feedback });
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

  // Safety: if Google Sheets returned 0 leads, skip to prevent wiping existing data
  if (mappedLeads.length === 0) {
    console.log(`[syncProject] project=${projectId} got 0 leads from Google Sheets, skipping to preserve data`);
    return;
  }

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
app.use(express.json({ limit: "10mb" }));

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
    const payload = { userId: user.id, username: user.username, role: user.role, displayName: user.display_name, mustChangePassword: !!user.must_change_password };
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
const mapUser = (u, projectIds) => ({ id: u.id, username: u.username, role: u.role, displayName: u.display_name, telegramId: u.telegram_id || "", avatarUrl: u.avatar_url || "", email: u.email || "", phone: u.phone || "", mustChangePassword: !!u.must_change_password, lastActive: u.last_active || "", createdAt: u.created_at, projectIds: projectIds || [] });
const selectUsers = () => all(db, "SELECT id, username, role, display_name, telegram_id, avatar_url, email, phone, must_change_password, last_active, created_at FROM users ORDER BY id");
const getUserProjectIds = async (userId) => {
  const rows = await all(db, "SELECT project_id FROM user_projects WHERE user_id = ? ORDER BY project_id", [userId]);
  return rows.map(r => r.project_id);
};
const getAllUserProjects = async () => {
  const rows = await all(db, "SELECT user_id, project_id FROM user_projects ORDER BY user_id, project_id");
  const map = {};
  for (const r of rows) {
    if (!map[r.user_id]) map[r.user_id] = [];
    map[r.user_id].push(r.project_id);
  }
  return map;
};
const mapUsersWithProjects = async (users) => {
  const upMap = await getAllUserProjects();
  return users.map(u => mapUser(u, upMap[u.id] || []));
};

app.get("/api/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await selectUsers();
    res.json(await mapUsersWithProjects(users));
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
    const result = await run(
      db,
      "INSERT INTO users(username, password_hash, salt, role, display_name, telegram_id) VALUES(?, ?, ?, ?, ?, ?)",
      [String(username).trim(), hash, salt, validRole, String(displayName || username).trim(), String(telegramId || "").trim()]
    );
    if (req.body.projectIds && Array.isArray(req.body.projectIds)) {
      for (const pid of req.body.projectIds) {
        await run(db, "INSERT OR IGNORE INTO user_projects(user_id, project_id) VALUES(?, ?)", [result.lastID, Number(pid)]);
      }
    }
    const users = await selectUsers();
    res.json(await mapUsersWithProjects(users));
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return res.status(400).json({ error: "Username already exists" });
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { password, role, displayName, telegramId, avatarUrl, email, phone } = req.body;
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
    if (avatarUrl !== undefined) {
      await run(db, "UPDATE users SET avatar_url = ? WHERE id = ?", [String(avatarUrl || "").trim(), id]);
    }
    if (email !== undefined) {
      await run(db, "UPDATE users SET email = ? WHERE id = ?", [String(email || "").trim(), id]);
    }
    if (phone !== undefined) {
      await run(db, "UPDATE users SET phone = ? WHERE id = ?", [String(phone || "").trim(), id]);
    }
    if (req.body.projectIds !== undefined && Array.isArray(req.body.projectIds)) {
      await run(db, "DELETE FROM user_projects WHERE user_id = ?", [id]);
      for (const pid of req.body.projectIds) {
        await run(db, "INSERT OR IGNORE INTO user_projects(user_id, project_id) VALUES(?, ?)", [id, Number(pid)]);
      }
    }
    const users = await selectUsers();
    res.json(await mapUsersWithProjects(users));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user.userId === id) return res.status(400).json({ error: "Cannot delete yourself" });
    await run(db, "DELETE FROM user_projects WHERE user_id = ?", [id]);
    await run(db, "DELETE FROM users WHERE id = ?", [id]);
    const users = await selectUsers();
    res.json(await mapUsersWithProjects(users));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- Auto-create sale accounts from lead data ---------- */
app.post("/api/users/auto-create-sales", requireAuth, requireAdmin, async (req, res) => {
  try {
    const leadsRows = await all(db, "SELECT DISTINCT sale_name FROM leads WHERE sale_name IS NOT NULL AND sale_name != '' AND sale_name != 'Chưa chia'");
    const existingUsers = await all(db, "SELECT username, display_name FROM users");
    const existingDisplayNames = new Set(existingUsers.map(u => foldText(u.display_name)));
    const existingUsernames = new Set(existingUsers.map(u => u.username));

    let created = 0;
    const createdList = [];
    for (const row of leadsRows) {
      const saleName = row.sale_name.trim();
      if (!saleName) continue;
      // Skip if display name already matches
      if (existingDisplayNames.has(foldText(saleName))) continue;

      // Generate username from last 2 words of the name
      const words = saleName.split(/\s+/).filter(Boolean);
      if (words.length < 2) continue; // Skip single-word names

      const lastTwo = words.slice(-2).map(w =>
        w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase()
      ).join("");

      // Skip if username already exists
      let username = lastTwo;
      if (existingUsernames.has(username)) continue;

      // Default password = last word (no diacritics) + 123
      const lastWord = words[words.length - 1]
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
      const defaultPwd = lastWord + "123";

      const { hash, salt } = hashPassword(defaultPwd);
      await run(
        db,
        "INSERT INTO users(username, password_hash, salt, role, display_name, must_change_password) VALUES(?, ?, ?, ?, ?, ?)",
        [username, hash, salt, "sale", saleName, 1]
      );
      existingUsernames.add(username);
      existingDisplayNames.add(foldText(saleName));
      created++;
      createdList.push({ username, displayName: saleName, defaultPassword: defaultPwd });
    }

    const users = await selectUsers();
    res.json({ created, createdList, users: await mapUsersWithProjects(users) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- Self-profile endpoints (any authenticated user) ---------- */
app.get("/api/profile", requireAuth, async (req, res) => {
  try {
    const user = await get(db, "SELECT id, username, role, display_name, telegram_id, avatar_url, email, phone, must_change_password, last_active, created_at FROM users WHERE id = ?", [req.user.userId]);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(mapUser(user, []));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/profile", requireAuth, async (req, res) => {
  try {
    const id = req.user.userId;
    const { avatarUrl, email, phone, telegramId } = req.body;
    if (avatarUrl !== undefined) await run(db, "UPDATE users SET avatar_url = ? WHERE id = ?", [String(avatarUrl || "").trim(), id]);
    if (email !== undefined) await run(db, "UPDATE users SET email = ? WHERE id = ?", [String(email || "").trim(), id]);
    if (phone !== undefined) await run(db, "UPDATE users SET phone = ? WHERE id = ?", [String(phone || "").trim(), id]);
    if (telegramId !== undefined) await run(db, "UPDATE users SET telegram_id = ? WHERE id = ?", [String(telegramId || "").trim(), id]);
    const user = await get(db, "SELECT id, username, role, display_name, telegram_id, avatar_url, email, phone, must_change_password, last_active, created_at FROM users WHERE id = ?", [id]);
    res.json(mapUser(user, []));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/change-password", requireAuth, async (req, res) => {
  try {
    const id = req.user.userId;
    const { currentPassword, newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: "New password required" });

    // Validate password strength
    const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!pwdRegex.test(newPassword)) {
      return res.status(400).json({ error: "Mật khẩu phải có ít nhất 8 ký tự, bao gồm: chữ hoa, chữ thường, số và ký tự đặc biệt" });
    }

    const user = await get(db, "SELECT * FROM users WHERE id = ?", [id]);
    if (!user) return res.status(404).json({ error: "User not found" });

    // If not first-time change, verify current password
    if (!user.must_change_password) {
      if (!currentPassword) return res.status(400).json({ error: "Current password required" });
      if (!verifyPassword(String(currentPassword), user.password_hash, user.salt)) {
        return res.status(400).json({ error: "Mật khẩu hiện tại không đúng" });
      }
    }

    const { hash, salt } = hashPassword(String(newPassword));
    await run(db, "UPDATE users SET password_hash = ?, salt = ?, must_change_password = 0 WHERE id = ?", [hash, salt, id]);

    // Generate new token with updated info
    const updated = await get(db, "SELECT * FROM users WHERE id = ?", [id]);
    const payload = { userId: updated.id, username: updated.username, role: updated.role, displayName: updated.display_name, mustChangePassword: false };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });

    res.json({ ok: true, token, user: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- Admin update user profile fields ---------- */
app.put("/api/users/:id/profile", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { avatarUrl, email, phone, telegramId } = req.body;
    if (avatarUrl !== undefined) await run(db, "UPDATE users SET avatar_url = ? WHERE id = ?", [String(avatarUrl || "").trim(), id]);
    if (email !== undefined) await run(db, "UPDATE users SET email = ? WHERE id = ?", [String(email || "").trim(), id]);
    if (phone !== undefined) await run(db, "UPDATE users SET phone = ? WHERE id = ?", [String(phone || "").trim(), id]);
    if (telegramId !== undefined) await run(db, "UPDATE users SET telegram_id = ? WHERE id = ?", [String(telegramId || "").trim(), id]);
    const users = await selectUsers();
    res.json(await mapUsersWithProjects(users));
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

/* ---------- Sales analytics ---------- */
app.get("/api/sales/analytics", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const logs = await all(db, "SELECT * FROM lead_status_log ORDER BY changed_at ASC");
    const hRows = await all(db, "SELECT * FROM lead_history ORDER BY id ASC");
    const leadRows = await all(db, "SELECT * FROM leads");
    const users = await all(db, "SELECT display_name FROM users WHERE role = 'sale'");

    // Per-agent stats
    const agents = {};
    for (const u of users) {
      agents[u.display_name] = { name: u.display_name, totalLeads: 0, closed: 0, avgResponseMs: null, responseTimes: [] };
    }
    for (const l of leadRows) {
      const sn = l.sale_name;
      if (!sn) continue;
      if (!agents[sn]) agents[sn] = { name: sn, totalLeads: 0, closed: 0, avgResponseMs: null, responseTimes: [] };
      agents[sn].totalLeads++;
      if (l.status === "closed") agents[sn].closed++;
      // Response time: time from lead created_at to first history entry by this sale
      const firstAction = hRows.find(h => String(h.lead_id) === String(l.id));
      if (firstAction && l.created_at && firstAction.contact_date) {
        const diff = new Date(firstAction.contact_date).getTime() - new Date(l.created_at).getTime();
        if (diff > 0) agents[sn].responseTimes.push(diff);
      }
    }
    const agentList = Object.values(agents).map(a => {
      const rt = a.responseTimes;
      return {
        name: a.name,
        totalLeads: a.totalLeads,
        closed: a.closed,
        conversionRate: a.totalLeads ? +(a.closed / a.totalLeads * 100).toFixed(1) : 0,
        avgResponseMs: rt.length ? Math.round(rt.reduce((s, v) => s + v, 0) / rt.length) : null,
      };
    });

    // Time-in-stage from logs
    const stageTime = {};
    for (const log of logs) {
      const key = log.new_status;
      if (!stageTime[key]) stageTime[key] = [];
      // Find next log for this lead
      const next = logs.find(l2 => l2.lead_id === log.lead_id && new Date(l2.changed_at) > new Date(log.changed_at));
      if (next) {
        stageTime[key].push(new Date(next.changed_at).getTime() - new Date(log.changed_at).getTime());
      }
    }
    const avgStageTime = {};
    for (const [k, arr] of Object.entries(stageTime)) {
      avgStageTime[k] = Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
    }

    res.json({ agents: agentList, avgStageTime, totalLogs: logs.length });
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

/* ===== Bulk assign leads to a sale — Admin only ===== */
app.post("/api/leads/assign-bulk", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { saleName, leadIds } = req.body;
    if (!saleName) return res.status(400).json({ error: "Cần chọn sale" });
    if (!leadIds || !leadIds.length) return res.status(400).json({ error: "Cần chọn ít nhất 1 lead" });
    const now = new Date().toLocaleString("vi-VN");
    const stmts = [];
    for (const lid of leadIds) {
      stmts.push({ sql: "UPDATE leads SET sale_name = ? WHERE id = ?", args: [saleName, lid] });
      // Add history
      const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [lid]);
      const nextSeq = (maxSeq?.m ?? -1) + 1;
      stmts.push({
        sql: "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq) VALUES(?, ?, ?, ?, ?, ?, ?)",
        args: [lid, saleName, "Chia lead", now, "", `Admin ${req.user.displayName} chia lead`, nextSeq],
      });
    }
    await db.batch(stmts, "write");

    // Send Telegram for each lead
    try {
      const activeBot = await get(db, "SELECT token FROM telegram_bots WHERE is_active = 1 LIMIT 1");
      const saleUser = await get(db, "SELECT telegram_id FROM users WHERE display_name = ? AND telegram_id != ''", [saleName]);
      if (activeBot && activeBot.token && saleUser && saleUser.telegram_id) {
        for (const lid of leadIds) {
          const lead = await get(db, "SELECT * FROM leads WHERE id = ?", [lid]);
          if (!lead) continue;
          const projectRow = await get(db, "SELECT name FROM projects WHERE id = ?", [lead.project_id]);
          const msg = [
            `🔔 *BẠN CÓ LEAD MỚI*`,
            `Dự án: *${projectRow ? projectRow.name : "-"}*`,
            `----------------------------------------------`,
            `👤 Khách: *${lead.name || "N/A"}*`,
            `📞 SĐT: \`${lead.phone || "-"}\``,
            `🔗 Nhu cầu: ${lead.product || "-"}`,
            `🕒 Nhận lúc: ${now}`,
            `--------------------------`,
            `📝 *FEEDBACK:*`,
            `Bấm nút bên dưới để cập nhật trạng thái.`,
          ].join("\n");
          const statusList = [
            ["called", "Đã gọi"], ["interested", "Quan tâm"], ["low_interest", "QT hời hợt"],
            ["other_project", "QT DA khác"], ["appointment", "Hẹn xem"], ["booked", "Giữ chỗ"],
            ["closed", "Chốt"], ["not_interested", "Không QT"], ["spam", "Phá/rác"],
            ["weak_finance", "TC yếu"], ["unreachable", "Chưa LLĐ"], ["callback", "Gọi lại sau"],
            ["wrong_number", "Sai số"], ["blocked", "Chặn"], ["has_sale", "Có sale khác"],
            ["lost", "Mất"],
          ];
          const keyboard = [];
          for (let i = 0; i < statusList.length; i += 3) {
            keyboard.push(statusList.slice(i, i + 3).map(([key, label]) => ({ text: label, callback_data: `st:${lid}:${key}` })));
          }
          const teleRes = await fetch(`https://api.telegram.org/bot${activeBot.token}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: saleUser.telegram_id, text: msg, parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } }),
          });
          const teleJson = await teleRes.json();
          const sentMsgId = teleJson.ok ? teleJson.result.message_id : null;
          await run(db, "INSERT OR REPLACE INTO telegram_pending(telegram_id, lead_id, status, message_id) VALUES(?, ?, '', ?)", [saleUser.telegram_id, lid, sentMsgId]);
        }
      }
    } catch (teleErr) {
      console.error("[Telegram bulk] Send failed:", teleErr.message);
    }

    const data = await readData(db);
    res.json({ msg: `Đã chia ${leadIds.length} lead cho ${saleName}`, assigned: leadIds.length, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Assign failed" });
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
      // Log status change
      if (status !== undefined) {
        const oldLead = await get(db, "SELECT status FROM leads WHERE id = ?", [leadId]);
        const oldStatus = oldLead?.status || "new";
        if (oldStatus !== status) {
          await run(db, "INSERT INTO lead_status_log(lead_id, old_status, new_status, changed_by, changed_at) VALUES(?, ?, ?, ?, ?)",
            [leadId, oldStatus, status, req.user.displayName, new Date().toISOString()]);
        }
      }
      params.push(leadId);
      await run(db, `UPDATE leads SET ${sets.join(", ")} WHERE id = ?`, params);
    }

    // When admin assigns lead to a sale: save history + send Telegram
    if (req.user.role === "admin" && saleName) {
      const lead = await get(db, "SELECT * FROM leads WHERE id = ?", [leadId]);
      const now = new Date().toLocaleString("vi-VN");
      const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [leadId]);
      const nextSeq = (maxSeq?.m ?? -1) + 1;
      await run(
        db,
        "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq) VALUES(?, ?, ?, ?, ?, ?, ?)",
        [leadId, saleName, "Chia lead", now, "", `Admin ${req.user.displayName} chia lead`, nextSeq]
      );

      // Send Telegram notification with inline keyboard
      try {
        const activeBot = await get(db, "SELECT token FROM telegram_bots WHERE is_active = 1 LIMIT 1");
        const saleUser = await get(db, "SELECT telegram_id FROM users WHERE display_name = ? AND telegram_id != ''", [saleName]);
        if (activeBot && activeBot.token && saleUser && saleUser.telegram_id) {
          const projectRow = lead ? await get(db, "SELECT name FROM projects WHERE id = ?", [lead.project_id]) : null;
          const msg = [
            `🔔 *BẠN CÓ LEAD MỚI*`,
            `Dự án: *${projectRow ? projectRow.name : "-"}*`,
            `----------------------------------------------`,
            `👤 Khách: *${lead ? lead.name : "N/A"}*`,
            `📞 SĐT: \`${lead ? lead.phone || "-" : "-"}\``,
            `🔗 Nhu cầu: ${lead ? lead.product || "-" : "-"}`,
            `🕒 Nhận lúc: ${now}`,
            `--------------------------`,
            `📝 *FEEDBACK:*`,
            `Bấm nút bên dưới để cập nhật trạng thái.`,
            `Sau đó nhắn tin feedback cho bot.`,
            ``,
            `⏳ _Lưu ý: Bạn có 30 phút để cập nhật trạng thái!_`,
          ].join("\n");

          // Build inline keyboard with status buttons (3 per row)
          const statusList = [
            ["called", "Đã gọi"], ["interested", "Quan tâm"], ["low_interest", "QT hời hợt"],
            ["other_project", "QT DA khác"], ["appointment", "Hẹn xem"], ["booked", "Giữ chỗ"],
            ["closed", "Chốt"], ["not_interested", "Không QT"], ["spam", "Phá/rác"],
            ["weak_finance", "TC yếu"], ["unreachable", "Chưa LLĐ"], ["callback", "Gọi lại sau"],
            ["wrong_number", "Sai số"], ["blocked", "Chặn"], ["has_sale", "Có sale khác"],
            ["lost", "Mất"],
          ];
          const keyboard = [];
          for (let i = 0; i < statusList.length; i += 3) {
            keyboard.push(
              statusList.slice(i, i + 3).map(([key, label]) => ({
                text: label,
                callback_data: `st:${leadId}:${key}`,
              }))
            );
          }

          const teleRes = await fetch(`https://api.telegram.org/bot${activeBot.token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: saleUser.telegram_id,
              text: msg,
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: keyboard },
            }),
          });
          const teleJson = await teleRes.json();
          const sentMsgId = teleJson.ok ? teleJson.result.message_id : null;

          // Save pending state for this user (include message_id for recall)
          await run(db, "INSERT OR REPLACE INTO telegram_pending(telegram_id, lead_id, status, message_id) VALUES(?, ?, '', ?)", [saleUser.telegram_id, leadId, sentMsgId]);
        }
      } catch (teleErr) {
        console.error("[Telegram] Send failed:", teleErr.message);
      }
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
      const oldStatus = lead.status || "new";
      const newNorm = normalizeStatus(status);
      if (oldStatus !== newNorm) {
        await run(db, "INSERT INTO lead_status_log(lead_id, old_status, new_status, changed_by, changed_at) VALUES(?, ?, ?, ?, ?)",
          [leadId, oldStatus, newNorm, req.user.displayName, new Date().toISOString()]);
      }
      await run(db, "UPDATE leads SET status = ?, raw_status = ? WHERE id = ?", [newNorm, status, leadId]);
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

/* ===== Delete history entry (admin only) ===== */
app.delete("/api/leads/:id/history/:histId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const histId = Number(req.params.histId);

    // Check if this was a "Chia lead" entry — if so, also undo the sale assignment
    const hist = await get(db, "SELECT action, sale_name FROM lead_history WHERE id = ? AND lead_id = ?", [histId, leadId]);
    if (hist && hist.action === "Chia lead") {
      const lead = await get(db, "SELECT * FROM leads WHERE id = ?", [leadId]);

      // Send Telegram recall message to the sale being removed
      try {
        const activeBot = await get(db, "SELECT token FROM telegram_bots WHERE is_active = 1 LIMIT 1");
        const saleUser = await get(db, "SELECT telegram_id FROM users WHERE display_name = ? AND telegram_id != ''", [hist.sale_name]);
        if (activeBot && activeBot.token && saleUser && saleUser.telegram_id) {
          // Delete the original notification message (with inline keyboard)
          const pending = await get(db, "SELECT message_id FROM telegram_pending WHERE telegram_id = ?", [saleUser.telegram_id]);
          if (pending && pending.message_id) {
            await fetch(`https://api.telegram.org/bot${activeBot.token}/deleteMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: saleUser.telegram_id, message_id: pending.message_id }),
            });
          }

          // Send recall notification
          const projectRow = lead ? await get(db, "SELECT name FROM projects WHERE id = ?", [lead.project_id]) : null;
          const recallMsg = [
            `🚫 *LEAD ĐÃ BỊ THU HỒI*`,
            `Dự án: *${projectRow ? projectRow.name : "-"}*`,
            `----------------------------------------------`,
            `👤 Khách: *${lead ? lead.name : "N/A"}*`,
            ``,
            `❌ _Lead này đã được Admin thu hồi._`,
            `_Bạn không cần liên hệ khách hàng này nữa._`,
          ].join("\n");

          await fetch(`https://api.telegram.org/bot${activeBot.token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: saleUser.telegram_id,
              text: recallMsg,
              parse_mode: "Markdown",
            }),
          });

          // Clear telegram pending for this sale
          await run(db, "DELETE FROM telegram_pending WHERE telegram_id = ?", [saleUser.telegram_id]);
        }
      } catch (teleErr) {
        console.error("[Telegram] Recall message failed:", teleErr.message);
      }

      // Check if there's an older "Chia lead" entry for a different sale
      const prev = await get(db, "SELECT sale_name FROM lead_history WHERE lead_id = ? AND id != ? AND action = 'Chia lead' ORDER BY seq DESC LIMIT 1", [leadId, histId]);
      if (prev) {
        // Revert to previous sale
        await run(db, "UPDATE leads SET sale_name = ? WHERE id = ?", [prev.sale_name, leadId]);
      } else {
        // No prior assignment — clear sale
        await run(db, "UPDATE leads SET sale_name = '', sale_id = NULL WHERE id = ?", [leadId]);
      }

      // Revert lead status to the most recent history entry's status (excluding the one being deleted)
      const prevHist = await get(db, "SELECT status FROM lead_history WHERE lead_id = ? AND id != ? AND status != '' ORDER BY seq DESC LIMIT 1", [leadId, histId]);
      if (prevHist && prevHist.status) {
        await run(db, "UPDATE leads SET status = ?, raw_status = ? WHERE id = ?", [normalizeStatus(prevHist.status), prevHist.status, leadId]);
      } else {
        // No previous status — reset to empty
        await run(db, "UPDATE leads SET status = '', raw_status = '' WHERE id = ?", [leadId]);
      }
    }

    await run(db, "DELETE FROM lead_history WHERE id = ? AND lead_id = ?", [histId, leadId]);
    const data = await readData(db);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===== Telegram Bot Webhook ===== */
const TELE_STATUS_LABELS = {
  new: "Chưa feedback", called: "Đã gọi", interested: "Quan tâm", low_interest: "QT hời hợt",
  other_project: "QT DA khác", appointment: "Hẹn xem", booked: "Giữ chỗ", closed: "Chốt",
  not_interested: "Không QT", spam: "Phá/rác", weak_finance: "TC yếu", unreachable: "Chưa LLĐ",
  callback: "Gọi lại sau", wrong_number: "Sai số", blocked: "Chặn", has_sale: "Có sale khác", lost: "Mất",
};

app.post("/api/telegram-webhook", async (req, res) => {
  try {
    const { callback_query, message } = req.body || {};
    const activeBot = await get(db, "SELECT token FROM telegram_bots WHERE is_active = 1 LIMIT 1");
    if (!activeBot) return res.json({ ok: true });
    const botToken = activeBot.token;

    const sendTg = (chatId, text, extra = {}) =>
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
      });

    const answerCb = (cbId, text) =>
      fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cbId, text }),
      });

    // Handle status button click
    if (callback_query) {
      const cbData = callback_query.data || "";
      const chatId = String(callback_query.from?.id || "");
      const parts = cbData.split(":");

      if (parts[0] === "st" && parts.length === 3) {
        const leadId = Number(parts[1]);
        const statusKey = parts[2];
        const statusLabel = TELE_STATUS_LABELS[statusKey] || statusKey;

        // Update pending with chosen status
        await run(db, "INSERT OR REPLACE INTO telegram_pending(telegram_id, lead_id, status) VALUES(?, ?, ?)", [chatId, leadId, statusKey]);

        await answerCb(callback_query.id, `✅ Đã chọn: ${statusLabel}`);
        await sendTg(chatId, [
          `✅ Trạng thái: *${statusLabel}*`,
          ``,
          `💬 Bây giờ hãy nhắn tin feedback về khách hàng này.`,
          `VD: _"Khách quan tâm căn 2PN, hẹn xem thứ 7"_`,
        ].join("\n"));
      }
      return res.json({ ok: true });
    }

    // Handle text message (feedback)
    if (message && message.text) {
      const chatId = String(message.from?.id || "");
      const feedbackText = message.text.trim();

      // Ignore bot commands
      if (feedbackText.startsWith("/")) return res.json({ ok: true });

      const pending = await get(db, "SELECT lead_id, status FROM telegram_pending WHERE telegram_id = ?", [chatId]);
      if (!pending) {
        await sendTg(chatId, "⚠️ Không có lead nào đang chờ feedback.\nHãy bấm nút trạng thái từ thông báo lead trước.");
        return res.json({ ok: true });
      }

      if (!pending.status) {
        await sendTg(chatId, "⚠️ Bạn chưa chọn trạng thái.\nHãy bấm nút trạng thái từ thông báo lead trước, sau đó nhắn feedback.");
        return res.json({ ok: true });
      }

      const leadId = pending.lead_id;
      const statusKey = pending.status;
      const statusLabel = TELE_STATUS_LABELS[statusKey] || statusKey;

      // Find sale user
      const saleUser = await get(db, "SELECT display_name FROM users WHERE telegram_id = ?", [chatId]);
      const saleName = saleUser ? saleUser.display_name : "Sale";

      // Save to lead_history
      const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [leadId]);
      const nextSeq = (maxSeq?.m ?? -1) + 1;
      const now = new Date().toLocaleString("vi-VN");
      await run(
        db,
        "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq) VALUES(?, ?, ?, ?, ?, ?, ?)",
        [leadId, saleName, "Cập nhật (Telegram)", now, statusLabel, feedbackText, nextSeq]
      );

      // Update lead status
      await run(db, "UPDATE leads SET status = ? WHERE id = ?", [statusKey, leadId]);

      // Clear pending
      await run(db, "DELETE FROM telegram_pending WHERE telegram_id = ?", [chatId]);

      // Get lead info for confirmation
      const lead = await get(db, "SELECT name, phone FROM leads WHERE id = ?", [leadId]);
      await sendTg(chatId, [
        `✅ *Đã lưu feedback thành công!*`,
        ``,
        `👤 Khách: *${lead ? lead.name : "N/A"}*`,
        `📊 Trạng thái: *${statusLabel}*`,
        `💬 Feedback: _${feedbackText}_`,
        `⏰ Lúc: ${now}`,
        ``,
        `📋 Feedback đã được lưu vào lịch sử liên hệ trên CRM.`,
      ].join("\n"));

      return res.json({ ok: true });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[Telegram Webhook] Error:", err.message);
    res.json({ ok: true });
  }
});

/* ===== Setup Telegram webhook ===== */
app.post("/api/telegram-webhook/setup", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const activeBot = await get(db, "SELECT token FROM telegram_bots WHERE is_active = 1 LIMIT 1");
    if (!activeBot) return res.status(400).json({ error: "Không có bot nào đang hoạt động" });
    const webhookUrl = `https://crm-iqi.id.vn/api/telegram-webhook`;
    const r = await fetch(`https://api.telegram.org/bot${activeBot.token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await r.json();
    if (data.ok) {
      res.json({ ok: true, msg: `Webhook đã được cài đặt: ${webhookUrl}` });
    } else {
      res.status(400).json({ error: data.description || "Cài đặt webhook thất bại" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===== Google Sheet Integration (Multi-sheet) ===== */

// List all sheet configs
app.get("/api/sheet/configs", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await all(db, "SELECT * FROM sheet_configs ORDER BY id ASC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add a sheet config
app.post("/api/sheet/configs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { projectName, scriptUrl } = req.body;
    if (!projectName || !scriptUrl) return res.status(400).json({ error: "Thiếu tên dự án hoặc URL" });
    await run(db, "INSERT INTO sheet_configs(name, script_url) VALUES(?, ?)", [String(projectName), String(scriptUrl)]);
    const rows = await all(db, "SELECT * FROM sheet_configs ORDER BY id ASC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete a sheet config
app.delete("/api/sheet/configs/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await run(db, "DELETE FROM sheet_configs WHERE id = ?", [Number(req.params.id)]);
    const rows = await all(db, "SELECT * FROM sheet_configs ORDER BY id ASC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Test a single sheet config
app.get("/api/sheet/test/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const cfg = await get(db, "SELECT * FROM sheet_configs WHERE id = ?", [Number(req.params.id)]);
    if (!cfg) return res.status(404).json({ error: "Không tìm thấy cấu hình" });
    const r = await fetch(cfg.script_url, { redirect: "follow" });
    if (!r.ok) {
      if (r.status === 403) return res.status(502).json({ error: "Google Sheet từ chối truy cập (403). Hãy mở Apps Script → chọn hàm doGet → bấm ▶ Chạy → Cấp quyền." });
      return res.status(502).json({ error: `Google Sheet trả về lỗi ${r.status}` });
    }
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { return res.status(502).json({ error: "Apps Script trả về dữ liệu không hợp lệ" }); }
    if (!data.success) return res.status(502).json({ error: data.error || "Lỗi từ Google Sheet" });
    res.json({ ok: true, count: (data.data || []).length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Fetch posts from all sheets (or a specific one via ?configId=)
app.get("/api/sheet/posts", requireAuth, async (req, res) => {
  try {
    let configs;
    if (req.query.configId) {
      const cfg = await get(db, "SELECT * FROM sheet_configs WHERE id = ?", [Number(req.query.configId)]);
      configs = cfg ? [cfg] : [];
    } else {
      configs = await all(db, "SELECT * FROM sheet_configs ORDER BY id ASC");
    }
    if (configs.length === 0) return res.status(400).json({ error: "Chưa cấu hình Google Sheet. Vào Cấu hình Sheet để thiết lập." });

    let allPosts = [];
    let allHeaders = [];
    for (const cfg of configs) {
      try {
        const r = await fetch(cfg.script_url, { redirect: "follow" });
        if (!r.ok) continue;
        const text = await r.text();
        let data;
        try { data = JSON.parse(text); } catch { continue; }
        if (!data.success) continue;
        const posts = (data.data || []).map(p => ({ ...p, _sheetProject: cfg.name, _configId: cfg.id }));
        allPosts = allPosts.concat(posts);
        if (data.headers && allHeaders.length === 0) allHeaders = data.headers;
      } catch { /* skip failed sheet */ }
    }
    res.json({ success: true, data: allPosts, headers: allHeaders });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update status on a specific sheet
app.post("/api/sheet/posts/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { row, status, configId } = req.body;
    if (!row || !status) return res.status(400).json({ error: "Thiếu row hoặc status" });
    let scriptUrl;
    if (configId) {
      const cfg = await get(db, "SELECT * FROM sheet_configs WHERE id = ?", [Number(configId)]);
      scriptUrl = cfg?.script_url;
    }
    if (!scriptUrl) {
      // Fallback to first config
      const cfg = await get(db, "SELECT * FROM sheet_configs ORDER BY id ASC LIMIT 1");
      scriptUrl = cfg?.script_url;
    }
    if (!scriptUrl) return res.status(400).json({ error: "Chưa cấu hình Google Sheet" });
    // Google Apps Script 302 redirect converts POST→GET, so use redirect:"manual" and follow manually
    const r1 = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateStatus", row: Number(row), status: String(status) }),
      redirect: "manual",
    });
    let r;
    if (r1.status >= 300 && r1.status < 400) {
      const loc = r1.headers.get("location");
      if (!loc) return res.status(502).json({ error: "Google Apps Script redirect thiếu location" });
      r = await fetch(loc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateStatus", row: Number(row), status: String(status) }),
        redirect: "follow",
      });
    } else {
      r = r1;
    }
    if (!r.ok) return res.status(502).json({ error: `Không cập nhật được Google Sheet (${r.status})` });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { return res.status(502).json({ error: "Phản hồi không hợp lệ từ Apps Script" }); }
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== Facebook Pages CRUD ===== */
app.get("/api/fb-pages", requireAuth, async (_req, res) => {
  try {
    const pages = await all(db, "SELECT * FROM fb_pages ORDER BY id ASC");
    res.json(pages.map(p => ({
      id: p.id, name: p.name, pageId: p.page_id, accessToken: p.access_token,
      avatarUrl: p.avatar_url, isActive: Boolean(p.is_active), createdAt: p.created_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/fb-pages", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, pageId, accessToken, avatarUrl } = req.body;
    if (!name) return res.status(400).json({ error: "Tên Page là bắt buộc" });
    await run(db, "INSERT INTO fb_pages(name, page_id, access_token, avatar_url) VALUES(?,?,?,?)",
      [name, pageId || "", accessToken || "", avatarUrl || ""]);
    const pages = await all(db, "SELECT * FROM fb_pages ORDER BY id ASC");
    res.json(pages.map(p => ({
      id: p.id, name: p.name, pageId: p.page_id, accessToken: p.access_token,
      avatarUrl: p.avatar_url, isActive: Boolean(p.is_active), createdAt: p.created_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/fb-pages/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, pageId, accessToken, avatarUrl, isActive } = req.body;
    await run(db,
      "UPDATE fb_pages SET name=?, page_id=?, access_token=?, avatar_url=?, is_active=? WHERE id=?",
      [name || "", pageId || "", accessToken || "", avatarUrl || "", isActive !== false ? 1 : 0, id]);
    const pages = await all(db, "SELECT * FROM fb_pages ORDER BY id ASC");
    res.json(pages.map(p => ({
      id: p.id, name: p.name, pageId: p.page_id, accessToken: p.access_token,
      avatarUrl: p.avatar_url, isActive: Boolean(p.is_active), createdAt: p.created_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/fb-pages/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await run(db, "DELETE FROM fb_pages WHERE id=?", [id]);
    const pages = await all(db, "SELECT * FROM fb_pages ORDER BY id ASC");
    res.json(pages.map(p => ({
      id: p.id, name: p.name, pageId: p.page_id, accessToken: p.access_token,
      avatarUrl: p.avatar_url, isActive: Boolean(p.is_active), createdAt: p.created_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== Facebook Posts CRUD ===== */
app.get("/api/fb-posts", requireAuth, async (req, res) => {
  try {
    const posts = await all(db, "SELECT * FROM fb_posts ORDER BY id DESC");
    res.json(posts.map(p => ({
      id: p.id, title: p.title, content: p.content,
      images: JSON.parse(p.images || "[]"),
      projectId: p.project_id, pageIds: JSON.parse(p.page_ids || "[]"),
      status: p.status, scheduleAt: p.schedule_at, link: p.link,
      fbPostId: p.fb_post_id, errorMsg: p.error_msg,
      createdAt: p.created_at, updatedAt: p.updated_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/fb-posts", requireAuth, async (req, res) => {
  try {
    const { title, content, images, projectId, pageIds, status, scheduleAt, link } = req.body;
    if (!content && !title) return res.status(400).json({ error: "Tiêu đề hoặc nội dung là bắt buộc" });
    const now = new Date().toISOString();
    await run(db,
      `INSERT INTO fb_posts(title, content, images, project_id, page_ids, status, schedule_at, link, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [title || "", content || "", JSON.stringify(images || []), projectId || null,
       JSON.stringify(pageIds || []), status || "draft", scheduleAt || "", link || "", now, now]);
    const posts = await all(db, "SELECT * FROM fb_posts ORDER BY id DESC");
    res.json(posts.map(p => ({
      id: p.id, title: p.title, content: p.content,
      images: JSON.parse(p.images || "[]"),
      projectId: p.project_id, pageIds: JSON.parse(p.page_ids || "[]"),
      status: p.status, scheduleAt: p.schedule_at, link: p.link,
      fbPostId: p.fb_post_id, errorMsg: p.error_msg,
      createdAt: p.created_at, updatedAt: p.updated_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/fb-posts/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, content, images, projectId, pageIds, status, scheduleAt, link } = req.body;
    const now = new Date().toISOString();
    await run(db,
      `UPDATE fb_posts SET title=?, content=?, images=?, project_id=?, page_ids=?, status=?, schedule_at=?, link=?, updated_at=? WHERE id=?`,
      [title || "", content || "", JSON.stringify(images || []), projectId || null,
       JSON.stringify(pageIds || []), status || "draft", scheduleAt || "", link || "", now, id]);
    const posts = await all(db, "SELECT * FROM fb_posts ORDER BY id DESC");
    res.json(posts.map(p => ({
      id: p.id, title: p.title, content: p.content,
      images: JSON.parse(p.images || "[]"),
      projectId: p.project_id, pageIds: JSON.parse(p.page_ids || "[]"),
      status: p.status, scheduleAt: p.schedule_at, link: p.link,
      fbPostId: p.fb_post_id, errorMsg: p.error_msg,
      createdAt: p.created_at, updatedAt: p.updated_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/fb-posts/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await run(db, "DELETE FROM fb_posts WHERE id=?", [id]);
    const posts = await all(db, "SELECT * FROM fb_posts ORDER BY id DESC");
    res.json(posts.map(p => ({
      id: p.id, title: p.title, content: p.content,
      images: JSON.parse(p.images || "[]"),
      projectId: p.project_id, pageIds: JSON.parse(p.page_ids || "[]"),
      status: p.status, scheduleAt: p.schedule_at, link: p.link,
      fbPostId: p.fb_post_id, errorMsg: p.error_msg,
      createdAt: p.created_at, updatedAt: p.updated_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== Publish post to Facebook ===== */
app.post("/api/fb-posts/:id/publish", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const post = await get(db, "SELECT * FROM fb_posts WHERE id=?", [id]);
    if (!post) return res.status(404).json({ error: "Bài đăng không tồn tại" });

    const pageIds = JSON.parse(post.page_ids || "[]");
    const pages = await all(db, "SELECT * FROM fb_pages WHERE id IN (" + pageIds.map(() => "?").join(",") + ")", pageIds);

    const errors = [];
    let firstFbPostId = "";

    for (const page of pages) {
      if (!page.access_token) { errors.push(`${page.name}: Thiếu Access Token`); continue; }
      try {
        const images = JSON.parse(post.images || "[]");
        let fbRes;
        if (images.length > 0) {
          // Post with photos - upload each as unpublished then create multi-photo post
          const photoIds = [];
          for (const imgUrl of images) {
            const photoRes = await fetch(`https://graph.facebook.com/${page.page_id}/photos`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: imgUrl, published: false, access_token: page.access_token }),
            });
            const photoData = await photoRes.json();
            if (photoData.id) photoIds.push(photoData.id);
            else errors.push(`${page.name}: Lỗi upload ảnh - ${photoData.error?.message || "Unknown"}`);
          }
          if (photoIds.length > 0) {
            const body = { message: post.content || "", access_token: page.access_token };
            photoIds.forEach((pid, i) => { body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: pid }); });
            fbRes = await fetch(`https://graph.facebook.com/${page.page_id}/feed`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
          }
        } else {
          // Text-only post
          fbRes = await fetch(`https://graph.facebook.com/${page.page_id}/feed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: post.content || "", link: post.link || undefined, access_token: page.access_token }),
          });
        }
        if (fbRes) {
          const fbData = await fbRes.json();
          if (fbData.id) { if (!firstFbPostId) firstFbPostId = fbData.id; }
          else errors.push(`${page.name}: ${fbData.error?.message || "Đăng thất bại"}`);
        }
      } catch (e) { errors.push(`${page.name}: ${e.message}`); }
    }

    const now = new Date().toISOString();
    if (errors.length === 0) {
      await run(db, "UPDATE fb_posts SET status='posted', fb_post_id=?, error_msg='', updated_at=? WHERE id=?", [firstFbPostId, now, id]);
    } else if (firstFbPostId) {
      await run(db, "UPDATE fb_posts SET status='posted', fb_post_id=?, error_msg=?, updated_at=? WHERE id=?",
        [firstFbPostId, errors.join("; "), now, id]);
    } else {
      await run(db, "UPDATE fb_posts SET status='error', error_msg=?, updated_at=? WHERE id=?",
        [errors.join("; "), now, id]);
    }

    const posts = await all(db, "SELECT * FROM fb_posts ORDER BY id DESC");
    res.json(posts.map(p => ({
      id: p.id, title: p.title, content: p.content,
      images: JSON.parse(p.images || "[]"),
      projectId: p.project_id, pageIds: JSON.parse(p.page_ids || "[]"),
      status: p.status, scheduleAt: p.schedule_at, link: p.link,
      fbPostId: p.fb_post_id, errorMsg: p.error_msg,
      createdAt: p.created_at, updatedAt: p.updated_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ========== Heartbeat / Online Status ========== */
app.post("/api/heartbeat", requireAuth, async (req, res) => {
  try {
    const now = new Date().toISOString();
    await run(db, "UPDATE users SET last_active = ? WHERE id = ?", [now, req.user.userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/chat/users", requireAuth, async (req, res) => {
  try {
    const users = await all(db, "SELECT id, username, display_name, role, avatar_url, last_active FROM users WHERE id != ? ORDER BY display_name", [req.user.userId]);
    // Get unread counts per sender
    const unread = await all(db, "SELECT sender_id, COUNT(*) as cnt FROM chat_messages WHERE receiver_id = ? AND read = 0 GROUP BY sender_id", [req.user.userId]);
    const unreadMap = {};
    for (const u of unread) unreadMap[u.sender_id] = u.cnt;
    // Get last message per conversation
    const lastMsgs = await all(db, `SELECT m.* FROM chat_messages m INNER JOIN (SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_id, MAX(id) as max_id FROM chat_messages WHERE sender_id = ? OR receiver_id = ? GROUP BY other_id) sub ON m.id = sub.max_id`, [req.user.userId, req.user.userId, req.user.userId]);
    const lastMsgMap = {};
    for (const m of lastMsgs) {
      const otherId = m.sender_id === req.user.userId ? m.receiver_id : m.sender_id;
      lastMsgMap[otherId] = { content: m.content, createdAt: m.created_at, senderId: m.sender_id };
    }
    res.json(users.map(u => ({
      id: u.id, username: u.username, displayName: u.display_name, role: u.role, avatarUrl: u.avatar_url || "",
      lastActive: u.last_active || "", unread: unreadMap[u.id] || 0,
      lastMessage: lastMsgMap[u.id] || null,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/chat/messages/:userId", requireAuth, async (req, res) => {
  try {
    const otherId = Number(req.params.userId);
    const myId = req.user.userId;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const before = req.query.before ? Number(req.query.before) : null;
    let q = "SELECT * FROM chat_messages WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))";
    const params = [myId, otherId, otherId, myId];
    if (before) { q += " AND id < ?"; params.push(before); }
    q += " ORDER BY id DESC LIMIT ?";
    params.push(limit);
    const msgs = await all(db, q, params);
    // Mark as read
    await run(db, "UPDATE chat_messages SET read = 1 WHERE sender_id = ? AND receiver_id = ? AND read = 0", [otherId, myId]);
    res.json(msgs.reverse().map(m => ({ id: m.id, senderId: m.sender_id, receiverId: m.receiver_id, content: m.content, read: !!m.read, createdAt: m.created_at })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chat/send", requireAuth, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    if (!receiverId || !content || !String(content).trim()) return res.status(400).json({ error: "Missing receiverId or content" });
    const text = String(content).trim().slice(0, 2000);
    const now = new Date().toISOString();
    await run(db, "INSERT INTO chat_messages (sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, ?)", [req.user.userId, Number(receiverId), text, now]);
    await run(db, "UPDATE users SET last_active = ? WHERE id = ?", [now, req.user.userId]);
    const msg = await get(db, "SELECT * FROM chat_messages WHERE sender_id = ? AND receiver_id = ? ORDER BY id DESC LIMIT 1", [req.user.userId, Number(receiverId)]);
    res.json({ id: msg.id, senderId: msg.sender_id, receiverId: msg.receiver_id, content: msg.content, read: false, createdAt: msg.created_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/chat/new/:userId", requireAuth, async (req, res) => {
  try {
    const otherId = Number(req.params.userId);
    const myId = req.user.userId;
    const after = Number(req.query.after) || 0;
    const msgs = await all(db, "SELECT * FROM chat_messages WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND id > ? ORDER BY id", [myId, otherId, otherId, myId, after]);
    if (msgs.length > 0) await run(db, "UPDATE chat_messages SET read = 1 WHERE sender_id = ? AND receiver_id = ? AND read = 0 AND id > ?", [otherId, myId, after]);
    res.json(msgs.map(m => ({ id: m.id, senderId: m.sender_id, receiverId: m.receiver_id, content: m.content, read: !!m.read, createdAt: m.created_at })));
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
