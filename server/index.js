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
      cost_data TEXT DEFAULT '{}',
      fb_code TEXT DEFAULT '',
      fb_person TEXT DEFAULT ''
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
    `CREATE TABLE IF NOT EXISTS fb_ad_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      account_id TEXT NOT NULL DEFAULT '',
      access_token TEXT NOT NULL DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  );

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

  /* ---------- Lead distribution schedules table ---------- */
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS lead_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      status_filter TEXT DEFAULT 'all',
      start_date TEXT NOT NULL DEFAULT '',
      end_date TEXT NOT NULL,
      leads_per_day INTEGER DEFAULT 5,
      sale_names TEXT NOT NULL DEFAULT '[]',
      lead_ids TEXT NOT NULL DEFAULT '[]',
      assigned_index INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      created_by TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1,
      last_processed_date TEXT DEFAULT '',
      assignment_log TEXT DEFAULT '[]',
      distribute_time TEXT DEFAULT '08:00'
    )`
  );
  // Migration: add new columns to lead_schedules if missing
  try { await run(db, "ALTER TABLE lead_schedules ADD COLUMN start_date TEXT NOT NULL DEFAULT ''"); } catch {}
  try { await run(db, "ALTER TABLE lead_schedules ADD COLUMN assignment_log TEXT DEFAULT '[]'"); } catch {}
  try { await run(db, "ALTER TABLE lead_schedules ADD COLUMN distribute_time TEXT DEFAULT '08:00'"); } catch {}

  // Migration: add fb_code, fb_person columns to projects
  try { await run(db, "ALTER TABLE projects ADD COLUMN fb_code TEXT DEFAULT ''"); } catch {}
  try { await run(db, "ALTER TABLE projects ADD COLUMN fb_person TEXT DEFAULT ''"); } catch {}

  // Market Intelligence cache table (aggregate data only - no raw leads or personal ad account IDs)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS market_intel_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      location TEXT DEFAULT '',
      ad_count INTEGER DEFAULT 0,
      active_ad_count INTEGER DEFAULT 0,
      avg_ad_longevity_days REAL DEFAULT 0,
      top_ad_durations TEXT DEFAULT '[]',
      avg_price_m2 REAL DEFAULT 0,
      new_listings_7d INTEGER DEFAULT 0,
      estimated_cpl_min REAL DEFAULT 0,
      estimated_cpl_max REAL DEFAULT 0,
      estimated_cpl_avg REAL DEFAULT 0,
      district_avg_cpl REAL DEFAULT 0,
      market_heat_level TEXT DEFAULT 'warm',
      heat_index INTEGER DEFAULT 50,
      opportunity_score INTEGER DEFAULT 50,
      competitor_count INTEGER DEFAULT 0,
      winning_pages TEXT DEFAULT '[]',
      ad_trend_30d TEXT DEFAULT '[]',
      cpl_trend_30d TEXT DEFAULT '[]',
      segment TEXT DEFAULT 'standard',
      scraped_at TEXT DEFAULT (datetime('now')),
      UNIQUE(project_name)
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
      // Update sale_name from sheet only if DB has no assignment (empty or "Chưa chia")
      const newSale = (!prev.sale_name || prev.sale_name === "Chưa chia") && sheetSale && sheetSale !== "Chưa chia"
        ? sheetSale : prev.sale_name;
      // Update status from sheet only if DB status is still default ("new"/empty) or sheet has a more specific status
      // If CRM/Telegram already updated status (not "new"), keep the DB value
      const dbStatus = prev.status || "new";
      const newStatus = (dbStatus === "new" || !dbStatus) && sheetStatus && sheetStatus !== "new"
        ? sheetStatus : dbStatus;
      stmts.push({
        sql: `UPDATE leads SET campaign = ?, adset_name = ?, ad_name = ?, form_name = ?,
              product = ?, created_at = ?, inbox_url = ?, source = ?, budget = ?, sync_at = ?,
              raw_status = ?, status = ?, sale_name = ?
              WHERE id = ?`,
        args: [
          l.campaign, l.adsetName || "-", l.adName || "-", l.formName || "-",
          l.product, l.createdAt, l.inboxUrl, l.source, l.budget, l.syncAt,
          l.rawStatus || prev.raw_status, newStatus, newSale,
          prev.id,
        ],
      });

      // Sync sale history from sheet for existing leads (add missing entries)
      if (l.saleHistory && l.saleHistory.length) {
        const existingHist = await all(db, "SELECT sale_name, action, contact_date FROM lead_history WHERE lead_id = ?", [prev.id]);
        const existingSet = new Set(existingHist.map(h => `${h.sale_name}||${h.action}||${h.contact_date}`));
        let maxSeqRow = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [prev.id]);
        let nextSeq = (maxSeqRow?.m ?? -1) + 1;
        for (const sh of l.saleHistory) {
          const key = `${sh.saleName}||${sh.action}||${sh.date}`;
          if (!existingSet.has(key)) {
            stmts.push({
              sql: "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq) VALUES(?, ?, ?, ?, ?, ?, ?)",
              args: [prev.id, sh.saleName, sh.action, sh.date, sh.status, sh.feedback, nextSeq++],
            });
            existingSet.add(key);
          }
        }
      }
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
      fbCode: p.fb_code || "",
      fbPerson: p.fb_person || "",
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

let db;
let dbInitError = null;
try {
  db = await initDb();
  console.log("[DB] Connected successfully");
} catch (err) {
  dbInitError = err.message || "Unknown DB error";
  console.error("[DB] Init failed:", dbInitError);
}

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
  if (req.user?.role !== "admin" && req.user?.role !== "manager") return res.status(403).json({ error: "Forbidden" });
  next();
}

function requireAdminOnly(req, res, next) {
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
    const projectIds = await getUserProjectIds(user.id);
    const payload = { userId: user.id, username: user.username, role: user.role, displayName: user.display_name, mustChangePassword: !!user.must_change_password, projectIds };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, user: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/logout", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const projectIds = await getUserProjectIds(req.user.userId);
  res.json({ user: { ...req.user, projectIds } });
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
    const validRole = ["admin", "manager", "sale"].includes(role) ? role : "sale";
    // Manager can only create sale accounts
    if (req.user.role === "manager" && validRole !== "sale") {
      return res.status(403).json({ error: "Quản lý chỉ được tạo tài khoản Sale" });
    }
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
    if (role && ["admin", "manager", "sale"].includes(role)) {
      // Manager cannot set role to admin or manager
      if (req.user.role === "manager" && (role === "admin" || role === "manager")) {
        return res.status(403).json({ error: "Quản lý chỉ được đặt quyền Sale" });
      }
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
    // Manager cannot delete admin or manager accounts
    if (req.user.role === "manager") {
      const target = await get(db, "SELECT role FROM users WHERE id = ?", [id]);
      if (target && (target.role === "admin" || target.role === "manager")) {
        return res.status(403).json({ error: "Quản lý chỉ được xóa tài khoản Sale" });
      }
    }
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

app.post("/api/telegram-bots", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const { name, token } = req.body;
    if (!name || !token) return res.status(400).json({ error: "Tên bot và token bắt buộc" });
    await run(db, "INSERT INTO telegram_bots(name, token) VALUES(?, ?)", [String(name).trim(), String(token).trim()]);
    const bots = await all(db, "SELECT * FROM telegram_bots ORDER BY id");
    res.json(bots.map(mapBot));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/telegram-bots/:id", requireAuth, requireAdminOnly, async (req, res) => {
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

app.delete("/api/telegram-bots/:id", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    await run(db, "DELETE FROM telegram_bots WHERE id = ?", [Number(req.params.id)]);
    const bots = await all(db, "SELECT * FROM telegram_bots ORDER BY id");
    res.json(bots.map(mapBot));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ---------- Sales analytics ---------- */
app.get("/api/sales/analytics", requireAuth, requireAdmin, async (req, res) => {
  try {
    const logs = await all(db, "SELECT * FROM lead_status_log ORDER BY changed_at ASC");
    const hRows = await all(db, "SELECT * FROM lead_history ORDER BY id ASC");
    let leadRows = await all(db, "SELECT * FROM leads");
    const users = await all(db, "SELECT display_name FROM users WHERE role = 'sale'");

    // Manager: filter leads by assigned projects
    if (req.user.role === "manager") {
      const projectIds = await getUserProjectIds(req.user.userId);
      leadRows = leadRows.filter(l => projectIds.includes(l.project_id));
    }

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
  res.json({
    ok: !dbInitError,
    dbReady: !!db,
    dbError: dbInitError,
    tursoConfigured: !!process.env.TURSO_URL,
    nodeVersion: process.version,
  });
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
    // Auto-process pending distribution schedules
    try { await processSchedules(db); } catch (e) { console.error("[schedule] process error:", e.message); }
    const config = await getConfig(db);
    const data = await readData(db);
    await filterDataForRole(data, req.user);
    // Include active schedules for admin
    let schedules = [];
    if (req.user.role === "admin" || req.user.role === "manager") {
      const rows = await all(db, "SELECT * FROM lead_schedules ORDER BY id DESC");
      schedules = rows.map(formatSchedule);
    }
    res.json({ ...config, ...data, schedules });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not read data" });
  }
});

app.post("/api/sync", requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log("[sync] Starting sync...");
    const { lastSync, syncErrors } = await syncAllProjects(db);
    const data = await readData(db);
    await filterDataForRole(data, req.user);
    console.log(`[sync] Done. leads=${data.leads.length} campaigns=${data.campaigns.length} errors=${syncErrors.length}`);
    res.json({ lastSync, syncErrors, ...data });
  } catch (err) {
    console.error("[sync] Top-level error:", err.message, err.stack);
    res.status(500).json({ error: err.message || "Sync failed" });
  }
});

/* ===== Project CRUD ===== */
app.get("/api/projects", requireAuth, async (req, res) => {
  try {
    const data = await readData(db);
    if (req.user.role === "manager") {
      const projectIds = await getUserProjectIds(req.user.userId);
      res.json(data.projects.filter(p => projectIds.includes(p.id)));
    } else {
      res.json(data.projects);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/projects", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const { name, leadUrl, costUrl, fbCode, fbPerson } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Name required" });
    const existing = await get(db, "SELECT id FROM projects WHERE name = ?", [String(name).trim()]);
    if (existing) return res.status(409).json({ error: "Dự án đã tồn tại" });
    const cleanLead = sanitizeSheetUrl(leadUrl);
    const cleanCost = sanitizeSheetUrl(costUrl);
    const result = await run(
      db,
      "INSERT INTO projects(name, lead_url, cost_url, fb_code, fb_person) VALUES(?, ?, ?, ?, ?)",
      [String(name).trim(), cleanLead, cleanCost, String(fbCode || "").trim(), String(fbPerson || "").trim()]
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
    await filterDataForRole(data, req.user);
    res.json(data);
  } catch (err) {
    console.error("[syncProject] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/projects/:id", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, leadUrl, costUrl, fbCode, fbPerson } = req.body;
    const cleanLead = sanitizeSheetUrl(leadUrl);
    const cleanCost = sanitizeSheetUrl(costUrl);
    await run(
      db,
      "UPDATE projects SET name = ?, lead_url = ?, cost_url = ?, fb_code = ?, fb_person = ? WHERE id = ?",
      [String(name || "").trim(), cleanLead, cleanCost, String(fbCode || "").trim(), String(fbPerson || "").trim(), id]
    );
    const data = await readData(db);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/projects/:id", requireAuth, requireAdminOnly, async (req, res) => {
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
      stmts.push({ sql: "UPDATE leads SET sale_name = ?, status = 'new' WHERE id = ?", args: [saleName, lid] });
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
    await filterDataForRole(data, req.user);
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
    const now = new Date().toLocaleString("vi-VN");
    const stmts = [];
    for (let i = 0; i < leads.length; i++) {
      const l = leads[i];
      const assignedSale = saleNames[i % saleNames.length];
      stmts.push({ sql: "UPDATE leads SET sale_name = ? WHERE id = ?", args: [assignedSale, l.id] });
      const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [l.id]);
      const nextSeq = (maxSeq?.m ?? -1) + 1;
      stmts.push({
        sql: "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq) VALUES(?, ?, ?, ?, ?, ?, ?)",
        args: [l.id, assignedSale, "Chia lead", now, "", `Admin ${req.user.displayName} xáo lead`, nextSeq],
      });
    }
    await db.batch(stmts, "write");
    const data = await readData(db);
    await filterDataForRole(data, req.user);
    res.json({ msg: `Đã xáo ${leads.length} lead cho ${saleNames.length} sale`, assigned: leads.length, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Shuffle failed" });
  }
});

/* ===== Scheduled lead distribution (round-robin 5 lead/day/person) ===== */

// Get today's date string YYYY-MM-DD
function getTodayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// Process all active schedules - assign leads that are due today at the scheduled time
async function processSchedules(db, triggerUser) {
  const today = getTodayStr();
  const now = new Date();
  const nowHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const schedules = await all(db, "SELECT * FROM lead_schedules WHERE is_active = 1");
  let totalAssigned = 0;

  for (const sch of schedules) {
    // Skip if already processed today
    if (sch.last_processed_date === today) continue;

    // Check if it's time to distribute (only process if current time >= distribute_time)
    const distTime = sch.distribute_time || '08:00';
    if (nowHHMM < distTime) continue;

    const saleList = JSON.parse(sch.sale_names || "[]");
    const leadIdList = [...new Set(JSON.parse(sch.lead_ids || "[]"))];
    if (!saleList.length || !leadIdList.length) continue;

    const remaining = leadIdList.slice(sch.assigned_index);
    if (!remaining.length) {
      await run(db, "UPDATE lead_schedules SET is_active = 0 WHERE id = ?", [sch.id]);
      continue;
    }

    // Calculate how many leads to assign today: leads_per_day * number of sales
    const perDay = sch.leads_per_day || 5;
    const totalToday = perDay * saleList.length;
    const batch = remaining.slice(0, totalToday);

    const now = new Date().toLocaleString("vi-VN");
    const stmts = [];
    const assignedLeads = []; // {leadId, saleName} for Telegram
    const logEntries = []; // for assignment_log

    // Round-robin: assign perDay leads to each sale in order
    const processedLids = new Set();
    for (let i = 0; i < batch.length; i++) {
      const lid = batch[i];
      if (processedLids.has(lid)) continue; // Skip duplicate
      processedLids.add(lid);
      const saleIdx = Math.floor(i / perDay) % saleList.length;
      const saleName = saleList[saleIdx];

      stmts.push({ sql: "UPDATE leads SET sale_name = ?, status = 'new' WHERE id = ?", args: [saleName, lid] });
      const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [lid]);
      const nextSeq = (maxSeq?.m ?? -1) + 1;
      stmts.push({
        sql: "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq) VALUES(?, ?, ?, ?, ?, ?, ?)",
        args: [lid, saleName, "Chia lead", now, "", `Lịch chia tự động #${sch.id}`, nextSeq],
      });
      assignedLeads.push({ leadId: lid, saleName });
      logEntries.push({ leadId: lid, saleName, date: today });
    }

    // Append to assignment_log
    const existingLog = JSON.parse(sch.assignment_log || "[]");
    const updatedLog = [...existingLog, ...logEntries];

    const newIndex = sch.assigned_index + batch.length;
    const isDone = newIndex >= leadIdList.length;
    stmts.push({
      sql: "UPDATE lead_schedules SET assigned_index = ?, last_processed_date = ?, is_active = ?, assignment_log = ? WHERE id = ?",
      args: [newIndex, today, isDone ? 0 : 1, JSON.stringify(updatedLog), sch.id],
    });

    await db.batch(stmts, "write");
    totalAssigned += batch.length;

    // Send Telegram notifications
    try {
      const activeBot = await get(db, "SELECT token FROM telegram_bots WHERE is_active = 1 LIMIT 1");
      if (activeBot && activeBot.token) {
        for (const { leadId, saleName } of assignedLeads) {
          const saleUser = await get(db, "SELECT telegram_id FROM users WHERE display_name = ? AND telegram_id != ''", [saleName]);
          if (!saleUser || !saleUser.telegram_id) continue;
          const lead = await get(db, "SELECT * FROM leads WHERE id = ?", [leadId]);
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
            `📋 Lịch chia tự động #${sch.id}`,
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
            keyboard.push(statusList.slice(i, i + 3).map(([key, label]) => ({ text: label, callback_data: `st:${leadId}:${key}` })));
          }
          try {
            const teleRes = await fetch(`https://api.telegram.org/bot${activeBot.token}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: saleUser.telegram_id, text: msg, parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } }),
            });
            const teleJson = await teleRes.json();
            const sentMsgId = teleJson.ok ? teleJson.result.message_id : null;
            await run(db, "INSERT OR REPLACE INTO telegram_pending(telegram_id, lead_id, status, message_id) VALUES(?, ?, '', ?)", [saleUser.telegram_id, leadId, sentMsgId]);
          } catch (teleErr) {
            console.error("[Telegram schedule] Send failed:", teleErr.message);
          }
        }
      }
    } catch (teleErr) {
      console.error("[Telegram schedule] Error:", teleErr.message);
    }
  }
  return totalAssigned;
}

/* POST /api/leads/schedule-distribution - Create a new distribution schedule */
app.post("/api/leads/schedule-distribution", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { projectId, saleNames: sNames, statusFilter, startDate, endDate, leadsPerDay, leadIds, distributeTime } = req.body;
    if (!sNames || !sNames.length) return res.status(400).json({ error: "Cần chọn ít nhất 1 sale" });
    if (!leadIds || !leadIds.length) return res.status(400).json({ error: "Cần chọn ít nhất 1 lead" });
    if (!startDate || !endDate) return res.status(400).json({ error: "Cần chọn ngày bắt đầu và ngày kết thúc" });
    const distTime = distributeTime || '08:00';

    const perDay = Math.max(1, Math.min(100, Number(leadsPerDay) || 5));

    // Deduplicate leadIds to prevent double assignments
    const uniqueLeadIds = [...new Set(leadIds)];
    if (uniqueLeadIds.length !== leadIds.length) {
      console.log(`[Schedule] Removed ${leadIds.length - uniqueLeadIds.length} duplicate lead IDs`);
    }

    // Pre-calculate the full assignment plan
    const plan = [];
    const today = getTodayStr();
    let currentDate = today;
    let idx = 0;
    const totalPerDay = perDay * sNames.length;
    while (idx < uniqueLeadIds.length) {
      const batch = uniqueLeadIds.slice(idx, idx + totalPerDay);
      for (let i = 0; i < batch.length; i++) {
        const saleIdx = Math.floor(i / perDay) % sNames.length;
        plan.push({ leadId: batch[i], saleName: sNames[saleIdx], date: currentDate });
      }
      idx += batch.length;
      // Next day
      const d = new Date(currentDate + "T00:00:00");
      d.setDate(d.getDate() + 1);
      currentDate = d.toISOString().slice(0, 10);
    }

    await run(db,
      `INSERT INTO lead_schedules(project_id, status_filter, start_date, end_date, leads_per_day, sale_names, lead_ids, assigned_index, total_count, created_by, is_active, last_processed_date, assignment_log, distribute_time)
       VALUES(?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, '', ?, ?)`,
      [
        Number(projectId),
        statusFilter || "all",
        startDate,
        endDate,
        perDay,
        JSON.stringify(sNames),
        JSON.stringify(uniqueLeadIds),
        uniqueLeadIds.length,
        req.user.displayName || req.user.username,
        JSON.stringify([]),
        distTime,
      ]
    );

    // Process immediately for today
    await processSchedules(db);

    const data = await readData(db);
    await filterDataForRole(data, req.user);
    const schedules = await all(db, "SELECT * FROM lead_schedules ORDER BY id DESC");
    res.json({
      msg: `Đã tạo lịch chia ${uniqueLeadIds.length} lead cho ${sNames.length} sale (${perDay} lead/ngày/người). Giai đoạn: ${startDate} → ${endDate}`,
      schedules: schedules.map(formatSchedule),
      ...data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Schedule creation failed" });
  }
});

/* GET /api/leads/schedules - List all schedules */
app.get("/api/leads/schedules", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Process pending schedules first
    await processSchedules(db);
    const schedules = await all(db, "SELECT * FROM lead_schedules ORDER BY id DESC");
    res.json({ schedules: schedules.map(formatSchedule) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load schedules" });
  }
});

/* DELETE /api/leads/schedules/:id - Cancel a schedule */
app.delete("/api/leads/schedules/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await run(db, "UPDATE lead_schedules SET is_active = 0 WHERE id = ?", [req.params.id]);
    const schedules = await all(db, "SELECT * FROM lead_schedules ORDER BY id DESC");
    res.json({ msg: "Đã hủy lịch chia lead", schedules: schedules.map(formatSchedule) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to cancel schedule" });
  }
});

function formatSchedule(s) {
  return {
    id: s.id,
    projectId: s.project_id,
    statusFilter: s.status_filter,
    startDate: s.start_date || "",
    endDate: s.end_date,
    leadsPerDay: s.leads_per_day,
    saleNames: JSON.parse(s.sale_names || "[]"),
    leadIds: JSON.parse(s.lead_ids || "[]"),
    assignedIndex: s.assigned_index,
    totalCount: s.total_count,
    createdBy: s.created_by,
    createdAt: s.created_at,
    isActive: Boolean(s.is_active),
    lastProcessedDate: s.last_processed_date || "",
    assignmentLog: JSON.parse(s.assignment_log || "[]"),
    distributeTime: s.distribute_time || "08:00",
  };
}

/* GET /api/leads/schedules/:id/detail - Get schedule detail with lead info */
app.get("/api/leads/schedules/:id/detail", requireAuth, requireAdmin, async (req, res) => {
  try {
    const sch = await get(db, "SELECT * FROM lead_schedules WHERE id = ?", [req.params.id]);
    if (!sch) return res.status(404).json({ error: "Schedule not found" });
    const formatted = formatSchedule(sch);
    // Get lead details for all leads in this schedule
    const leadIds = formatted.leadIds;
    const leadDetails = [];
    for (const lid of leadIds) {
      const lead = await get(db, "SELECT id, name, phone, status, sale_name, created_at FROM leads WHERE id = ?", [lid]);
      if (lead) leadDetails.push({ id: lead.id, name: lead.name, phone: lead.phone, status: lead.status, saleName: lead.sale_name, createdAt: lead.created_at });
    }
    res.json({ schedule: formatted, leadDetails });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to get schedule detail" });
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
  data.leads = data.leads.filter(l =>
    matchSaleName(l.saleName, displayName) ||
    (l.saleHistory && l.saleHistory.some(h => h.action === "Chia lead" && matchSaleName(h.saleName, displayName)))
  );
  return data;
}

function filterLeadsForManager(data, projectIds) {
  if (!projectIds || projectIds.length === 0) {
    data.leads = [];
    data.projects = [];
    data.campaigns = [];
    return data;
  }
  data.leads = data.leads.filter(l => projectIds.includes(l.projectId));
  data.projects = data.projects.filter(p => projectIds.includes(p.id));
  data.campaigns = data.campaigns.filter(c => projectIds.includes(c.projectId));
  return data;
}

async function filterDataForRole(data, user) {
  if (user.role === "sale") {
    filterLeadsForSale(data, user.displayName);
  } else if (user.role === "manager") {
    const projectIds = await getUserProjectIds(user.userId);
    filterLeadsForManager(data, projectIds);
  }
  return data;
}

app.put("/api/leads/:id", requireAuth, async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    // Sale can only update leads assigned to them (current or ever assigned via history)
    if (req.user.role === "sale") {
      const lead = await get(db, "SELECT sale_name FROM leads WHERE id = ?", [leadId]);
      const currentMatch = lead && matchSaleName(lead.sale_name, req.user.displayName);
      let historyMatch = false;
      if (!currentMatch) {
        const hist = await get(db, "SELECT id FROM lead_history WHERE lead_id = ? AND action = 'Chia lead' AND LOWER(TRIM(sale_name)) = LOWER(TRIM(?)) LIMIT 1", [leadId, req.user.displayName]);
        historyMatch = !!hist;
      }
      if (!currentMatch && !historyMatch) {
        return res.status(403).json({ error: "You can only update your own leads" });
      }
    }
    const { status, notes, saleId, saleName, isHot } = req.body;
    const sets = [];
    const params = [];

    // Admin/Manager can change sale assignment and isHot
    let reassigning = false;
    if (req.user.role === "admin" || req.user.role === "manager") {
      if (saleId !== undefined) { sets.push("sale_id = ?"); params.push(saleId); }
      if (saleName !== undefined) {
        sets.push("sale_name = ?"); params.push(saleName);
        // Reset status to "new" (Chưa feedback) when reassigning to a new sale
        if (status === undefined) { reassigning = true; sets.push("status = ?"); params.push("new"); }
      }
      if (isHot !== undefined) { sets.push("is_hot = ?"); params.push(isHot ? 1 : 0); }
    }
    if (status !== undefined) { sets.push("status = ?"); params.push(status); }
    if (notes !== undefined) { sets.push("notes = ?"); params.push(notes); }

    if (sets.length) {
      // Log status change
      if (status !== undefined || reassigning) {
        const oldLead = await get(db, "SELECT status FROM leads WHERE id = ?", [leadId]);
        const oldStatus = oldLead?.status || "new";
        const newStatus = status !== undefined ? status : "new";
        if (oldStatus !== newStatus) {
          await run(db, "INSERT INTO lead_status_log(lead_id, old_status, new_status, changed_by, changed_at) VALUES(?, ?, ?, ?, ?)",
            [leadId, oldStatus, newStatus, req.user.displayName, new Date().toISOString()]);
        }
      }
      params.push(leadId);
      await run(db, `UPDATE leads SET ${sets.join(", ")} WHERE id = ?`, params);
    }

    // When admin/manager assigns lead to a sale: save history + send Telegram
    if ((req.user.role === "admin" || req.user.role === "manager") && saleName) {
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
    await filterDataForRole(data, req.user);
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

    // Sale can only add history to their own leads (current or ever assigned)
    if (req.user.role === "sale" && !matchSaleName(lead.sale_name, req.user.displayName)) {
      const hist = await get(db, "SELECT id FROM lead_history WHERE lead_id = ? AND action = 'Chia lead' AND LOWER(TRIM(sale_name)) = LOWER(TRIM(?)) LIMIT 1", [leadId, req.user.displayName]);
      if (!hist) return res.status(403).json({ error: "You can only update your own leads" });
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
    await filterDataForRole(data, req.user);
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
    await filterDataForRole(data, req.user);
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
app.post("/api/sheet/configs", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const { projectName, scriptUrl } = req.body;
    if (!projectName || !scriptUrl) return res.status(400).json({ error: "Thiếu tên dự án hoặc URL" });
    await run(db, "INSERT INTO sheet_configs(name, script_url) VALUES(?, ?)", [String(projectName), String(scriptUrl)]);
    const rows = await all(db, "SELECT * FROM sheet_configs ORDER BY id ASC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete a sheet config
app.delete("/api/sheet/configs/:id", requireAuth, requireAdminOnly, async (req, res) => {
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
    // Google Apps Script 302 redirect converts POST→GET, follow redirect with GET
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
      r = await fetch(loc, { redirect: "follow" });
    } else {
      r = r1;
    }
    if (!r.ok) return res.status(502).json({ error: `Không cập nhật được Google Sheet (${r.status})` });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { return res.json({ success: true }); }
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

// --- Facebook Ad Accounts CRUD ---
app.get("/api/fb-ad-accounts", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await all(db, "SELECT * FROM fb_ad_accounts ORDER BY created_at DESC");
    res.json(rows.map(r => ({ id: r.id, name: r.name, accountId: r.account_id, hasToken: !!r.access_token, isActive: !!r.is_active, createdAt: r.created_at })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/fb-ad-accounts", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const { name, accountId, accessToken } = req.body;
    if (!accountId) return res.status(400).json({ error: "Account ID is required" });
    const cleanId = String(accountId).replace(/^act_/, "");
    await run(db, "INSERT INTO fb_ad_accounts(name, account_id, access_token) VALUES(?,?,?)", [name || "", cleanId, accessToken || ""]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/fb-ad-accounts/:id", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const { name, accountId, accessToken, isActive } = req.body;
    const existing = await get(db, "SELECT * FROM fb_ad_accounts WHERE id=?", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const cleanId = accountId ? String(accountId).replace(/^act_/, "") : existing.account_id;
    await run(db, "UPDATE fb_ad_accounts SET name=?, account_id=?, access_token=?, is_active=? WHERE id=?", [
      name ?? existing.name, cleanId, accessToken ?? existing.access_token, isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active, req.params.id
    ]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/fb-ad-accounts/:id", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    await run(db, "DELETE FROM fb_ad_accounts WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Facebook Ads Insights Proxy ---
app.get("/api/fb-ads/insights/:accountId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const acct = await get(db, "SELECT * FROM fb_ad_accounts WHERE account_id=? AND is_active=1", [req.params.accountId]);
    if (!acct || !acct.access_token) return res.status(400).json({ error: "Ad account not found or no token" });
    const { dateFrom, dateTo, level } = req.query;
    const today = new Date().toISOString().slice(0, 10);
    const since = dateFrom || today;
    const until = dateTo || today;
    const insightLevel = level || "campaign";
    const fields = "campaign_name,campaign_id,adset_name,adset_id,ad_name,ad_id,spend,impressions,reach,clicks,cpm,cpc,ctr,actions,cost_per_action_type,inline_link_clicks,inline_link_click_ctr";
    const url = `https://graph.facebook.com/v22.0/act_${acct.account_id}/insights?fields=${fields}&time_range={"since":"${since}","until":"${until}"}&level=${encodeURIComponent(insightLevel)}&limit=500&access_token=${acct.access_token}`;
    const fbRes = await fetch(url);
    const data = await fbRes.json();
    if (data.error) return res.status(400).json({ error: data.error.message || "Facebook API error" });
    res.json(data.data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/fb-ads/campaigns/:accountId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const acct = await get(db, "SELECT * FROM fb_ad_accounts WHERE account_id=? AND is_active=1", [req.params.accountId]);
    if (!acct || !acct.access_token) return res.status(400).json({ error: "Ad account not found or no token" });
    const fields = "name,id,status,objective,daily_budget,lifetime_budget,start_time,stop_time";
    const url = `https://graph.facebook.com/v22.0/act_${acct.account_id}/campaigns?fields=${fields}&limit=500&access_token=${acct.access_token}`;
    const fbRes = await fetch(url);
    const data = await fbRes.json();
    if (data.error) return res.status(400).json({ error: data.error.message || "Facebook API error" });
    res.json(data.data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/fb-ads/adsets/:accountId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const acct = await get(db, "SELECT * FROM fb_ad_accounts WHERE account_id=? AND is_active=1", [req.params.accountId]);
    if (!acct || !acct.access_token) return res.status(400).json({ error: "Ad account not found or no token" });
    const fields = "id,name,campaign_id,daily_budget,lifetime_budget,status,effective_status";
    const url = `https://graph.facebook.com/v22.0/act_${acct.account_id}/adsets?fields=${fields}&limit=500&access_token=${acct.access_token}`;
    const fbRes = await fetch(url);
    const data = await fbRes.json();
    if (data.error) return res.status(400).json({ error: data.error.message || "Facebook API error" });
    res.json(data.data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== MARKET INTELLIGENCE ENGINE ==========

// Module 1: Ad Library Scraper — Headless Browser (Puppeteer + Stealth)
async function scrapeAdLibrary(projectName, _adAccountRows) {
  const startTime = Date.now();
  // Safety limit: must return before Vercel kills at 60s
  const elapsed = () => Date.now() - startTime;
  const mustStop = () => elapsed() > 58000; // 58s = absolute max, 2s buffer for response
  const pageSet = new Map();
  let adCount = 0;
  let apiError = null;
  const activityLog = [];
  const topAdDurations = [];

  // Extract meaningful search keywords from project name
  // e.g. "Salacia VillThe global city" → try "the global city", "Salacia Vill"
  // e.g. "Masterise Homes" → try "Masterise Homes"
  const stopWords = new Set(["dự","án","khu","đô","thị","căn","hộ","nhà","phố","biệt","thự"]);
  function buildSearchTerms(name) {
    const terms = [name]; // always try full name first
    // Split on common separators and try sub-phrases
    const parts = name.split(/[-–—|,;/\\]/).map(s => s.trim()).filter(s => s.length > 2);
    if (parts.length > 1) parts.forEach(p => terms.push(p));
    // Remove stop words and try remaining
    const words = name.split(/\s+/).filter(w => !stopWords.has(w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
    if (words.length > 1 && words.join(" ") !== name) terms.push(words.join(" "));
    // If name has > 3 words, try last 2-3 words (often the main brand)
    const allWords = name.split(/\s+/);
    if (allWords.length >= 4) terms.push(allWords.slice(-3).join(" "));
    if (allWords.length >= 3) terms.push(allWords.slice(-2).join(" "));
    // Deduplicate while preserving order
    return [...new Map(terms.map(t => [t.toLowerCase(), t])).values()];
  }

  // Search with exactly the user's input — no modifications
  const searchTerms = [projectName];
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  ];
  const ua = userAgents[Math.floor(Math.random() * userAgents.length)];

  // Helper: extract ad count from text using multiple patterns
  function extractAdCount(text) {
    const patterns = [
      /~\s*([\d.,]+)\s*k\u1ebft qu\u1ea3/i,
      /Kho\u1ea3ng\s+([\d.,]+)\s*k\u1ebft qu\u1ea3/i,
      /About\s+([\d.,]+)\s*results/i,
      /([\d.,]+)\s*k\u1ebft qu\u1ea3/i,
      /([\d.,]+)\s*results?\b/i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        const num = parseInt(m[1].replace(/[.,\s]/g, ""), 10);
        if (num > 0 && num < 10000000) return num;
      }
    }
    return 0;
  }

  // Helper: extract page info from HTML
  function extractPagesFromHtml(html) {
    const pages = [];
    const seen = new Set();

    // Pattern 1: view_all_page_id in URLs
    const regex1 = /view_all_page_id=(\d+)/g;
    let m;
    while ((m = regex1.exec(html)) !== null) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        pages.push({ pageId: m[1], pageName: "", adCount: 1 });
      }
    }

    // Pattern 2: page_id in embedded JSON
    const regex2 = /"page_id"\s*:\s*"?(\d+)"?/g;
    while ((m = regex2.exec(html)) !== null) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        pages.push({ pageId: m[1], pageName: "", adCount: 1 });
      }
    }

    // Pattern 3: pageID or ownerPageId in embedded data
    const regex3 = /"(?:pageID|ownerPageId|page_profile_id)"\s*:\s*"?(\d+)"?/g;
    while ((m = regex3.exec(html)) !== null) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        pages.push({ pageId: m[1], pageName: "", adCount: 1 });
      }
    }

    // Try to extract page names from nearby text
    const nameRegex = /data-testid="[^"]*page[^"]*"[^>]*>([^<]{2,80})</gi;
    let nm;
    while ((nm = nameRegex.exec(html)) !== null) {
      const name = nm[1].trim();
      if (name && pages.length > 0) {
        const pg = pages.find(p => !p.pageName);
        if (pg) pg.pageName = name;
      }
    }

    // Pattern 4: "name":"PageName" near "page_id" in JSON
    const nameJsonRegex = /"page_id"\s*:\s*"?(\d+)"?\s*,\s*"name"\s*:\s*"([^"]{2,80})"/g;
    while ((nm = nameJsonRegex.exec(html)) !== null) {
      const pid = nm[1];
      const name = nm[2];
      const existing = pages.find(p => p.pageId === pid);
      if (existing && !existing.pageName) existing.pageName = name;
    }

    console.log(`[MI] extractPagesFromHtml found ${pages.length} pages from raw HTML`);
    return pages;
  }

  // ===== PRE-FETCH: Bulk Ads Library API (gets ALL pages + names + dates in one call) =====
  const fbToken = _adAccountRows?.[0]?.access_token || '';
  const apiPagesMap = new Map(); // pid → { pageName, maxDays, adCount }
  if (fbToken) {
    try {
      activityLog.push("Đang truy vấn Facebook Ads Library API...");
      console.log(`[MI] Bulk API call for "${projectName}" with token`);
      const apiUrl = `https://graph.facebook.com/v22.0/ads_archive?search_terms=${encodeURIComponent(projectName)}&ad_active_status=ACTIVE&ad_reached_countries=${encodeURIComponent('["VN"]')}&fields=page_name,page_id,ad_delivery_start_time&access_token=${encodeURIComponent(fbToken)}&limit=500`;
      const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(12000) });
      const data = await resp.json();
      // If first format fails, try alternative format
      let ads = data.data || [];
      if (ads.length === 0 && !data.error) {
        try {
          const alt = `https://graph.facebook.com/v22.0/ads_archive?search_terms=${encodeURIComponent(projectName)}&ad_active_status=ACTIVE&ad_reached_countries%5B%5D=VN&fields=page_name,page_id,ad_delivery_start_time&access_token=${encodeURIComponent(fbToken)}&limit=500`;
          const r2 = await fetch(alt, { signal: AbortSignal.timeout(8000) });
          const d2 = await r2.json();
          if (d2.data?.length > 0) ads = d2.data;
        } catch {}
      }
      if (ads.length > 0) {
        console.log(`[MI] API returned ${ads.length} ads`);
        const now = Date.now();
        for (const ad of ads) {
          const pid = ad.page_id;
          if (!pid) continue;
          if (!apiPagesMap.has(pid)) apiPagesMap.set(pid, { pageName: '', maxDays: 0, adCount: 0 });
          const entry = apiPagesMap.get(pid);
          entry.adCount++;
          if (ad.page_name && ad.page_name.length > 1) entry.pageName = ad.page_name;
          if (ad.ad_delivery_start_time) {
            const d = new Date(ad.ad_delivery_start_time);
            if (!isNaN(d)) {
              const days = Math.floor((now - d.getTime()) / 86400000);
              if (days > entry.maxDays && days > 0 && days < 3650) entry.maxDays = days;
            }
          }
        }
        // Follow pagination to get MORE ads (and more unique pages)
        let nextUrl = data.paging?.next;
        for (let pg = 0; pg < 20 && nextUrl; pg++) { // exhaust ALL API pages
          try {
            const pgResp = await fetch(nextUrl, { signal: AbortSignal.timeout(10000) });
            const pgData = await pgResp.json();
            if (!pgData.data?.length) break;
            console.log(`[MI] API page ${pg + 2}: ${pgData.data.length} more ads`);
            for (const ad of pgData.data) {
              const pid = ad.page_id;
              if (!pid) continue;
              if (!apiPagesMap.has(pid)) apiPagesMap.set(pid, { pageName: '', maxDays: 0, adCount: 0 });
              const entry = apiPagesMap.get(pid);
              entry.adCount++;
              if (ad.page_name && ad.page_name.length > 1) entry.pageName = ad.page_name;
              if (ad.ad_delivery_start_time) {
                const d = new Date(ad.ad_delivery_start_time);
                if (!isNaN(d)) {
                  const days = Math.floor((now - d.getTime()) / 86400000);
                  if (days > entry.maxDays && days > 0 && days < 3650) entry.maxDays = days;
                }
              }
            }
            nextUrl = pgData.paging?.next;
          } catch { break; }
        }
        activityLog.push(`API: ${apiPagesMap.size} pages, ${ads.length}+ ads.`);
        console.log(`[MI] API found ${apiPagesMap.size} unique pages`);
      } else if (data.error) {
        console.log(`[MI] API error: ${data.error.message}`);
        activityLog.push(`API: ${data.error.message?.substring(0, 60)}`);
      } else {
        console.log(`[MI] API returned 0 ads`);
      }
    } catch (err) {
      console.log(`[MI] Bulk API failed: ${err.message}`);
    }
  }

  // ===== STRATEGY 1: Headless Chromium =====
  let browser = null;
  let bPage = null;
  let bestTerm = searchTerms[0];
  try {
    activityLog.push("Đang khởi tạo trình duyệt ảo (Headless Chromium)...");
    console.log("[MI] Launching headless Chromium...");

    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;

    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--single-process"],
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless ?? "new",
    });

    bPage = await browser.newPage();
    await bPage.setUserAgent(ua);
    await bPage.setExtraHTTPHeaders({ "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8" });
    await bPage.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
      window.chrome = { runtime: {} };
    });

    // Try each search term until we find results
    for (const term of searchTerms) {
      if (adCount > 0) break;
      const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=VN&q=${encodeURIComponent(term)}&search_type=keyword_unordered`;
      activityLog.push(`Đang tìm kiếm: "${term}"...`);
      console.log(`[MI] Navigating to: ${searchUrl}`);

      try {
        await bPage.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        // Short wait for initial JS to render content
        await new Promise(r => setTimeout(r, 3000));
        console.log(`[MI] Page loaded in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

        // Handle cookie consent / login modals
        try {
          const consentBtn = await bPage.$('button[data-cookiebanner="accept_button"], button[title="Cho phép tất cả cookie"], button[title="Allow all cookies"], [aria-label="Allow all cookies"], [aria-label="Cho phép tất cả cookie"]');
          if (consentBtn) {
            await consentBtn.click();
            activityLog.push("Đã chấp nhận cookie consent.");
            await new Promise(r => setTimeout(r, 2000));
          }
        } catch {}

        // Wait for content to render - look for key indicators
        try {
          await bPage.waitForFunction(
            () => document.body.innerText.includes("kết quả") || document.body.innerText.includes("results") || document.body.innerText.includes("Không có quảng cáo") || document.body.innerText.includes("No ads") || document.querySelectorAll('[role="article"]').length > 0,
            { timeout: 8000 }
          );
        } catch {
          // Timeout - page may not have rendered, continue anyway
        }
        console.log(`[MI] Content ready at ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

        // Scroll to load ALL results — MUST reach the absolute bottom of the page
        let prevHeight = 0;
        let noChangeCount = 0;
        console.log(`[MI] Scroll starting, will scroll until absolute bottom`);
        for (let i = 0; i < 300; i++) { // 300 max safety limit
          if (mustStop()) { console.log(`[MI] Scroll: must stop at ${(elapsed()/1000).toFixed(1)}s to return response`); break; }
          await bPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await new Promise(r => setTimeout(r, 1200)); // 1.2s between scrolls for content to load
          const curHeight = await bPage.evaluate(() => document.body.scrollHeight);
          if (curHeight === prevHeight) {
            noChangeCount++;
            if (noChangeCount >= 3) { console.log(`[MI] ✓ Reached bottom after ${i + 1} scrolls (no new content 3x)`); break; }
            // Wait longer for lazy-loading content before concluding we're at bottom
            await new Promise(r => setTimeout(r, 2000));
            // Try clicking "See more" or "Xem thêm" buttons if they exist
            await bPage.evaluate(() => {
              const btns = document.querySelectorAll('button, [role="button"]');
              for (const b of btns) {
                const txt = (b.textContent || '').trim().toLowerCase();
                if (txt === 'see more' || txt === 'xem thêm' || txt === 'see more results' || txt === 'xem thêm kết quả') {
                  b.click(); break;
                }
              }
            }).catch(() => {});
          } else {
            noChangeCount = 0;
          }
          prevHeight = curHeight;
          if (i > 0 && i % 10 === 0) console.log(`[MI] Scroll #${i}, height=${curHeight}, elapsed=${((Date.now() - startTime) / 1000).toFixed(1)}s`);
        }
        console.log(`[MI] Scroll done at ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

        // Extract count
        const bodyText = await bPage.evaluate(() => document.body.innerText);
        const html = await bPage.content();

        // Debug: log first 200 chars of body text
        console.log(`[MI] Body text (first 300): ${bodyText.substring(0, 300).replace(/\n/g, " | ")}`);

        const count = Math.max(extractAdCount(bodyText), extractAdCount(html));
        if (count > adCount) {
          adCount = count;
          bestTerm = term;
        }

        // Extract pages from rendered DOM
        const extractedPages = await bPage.evaluate(() => {
          const pages = {};
          const reserved = new Set(['ads', 'www', 'groups', 'pages', 'events', 'photo', 'video', 'watch', 'reel', 'share', 'sharer', 'login', 'help', 'marketplace', 'gaming', 'stories', 'reels', 'hashtag', 'profile.php', 'people', 'search', 'policies', 'privacy', 'settings', 'notifications', 'messages', 'bookmarks', 'saved']);
          const isValidName = (n) => n && n.length > 1 && n.length < 80 && !n.startsWith('http') && !n.includes('://') && !/[\w.-]+\.[a-z]{2,}/i.test(n) && !/^\d+$/.test(n) && !/fb\.me/i.test(n) && !/inbox|đăng ký ngay|nhận báo giá|khách hàng đã đăng ký|xem chi tiết|gửi tin nhắn|liên hệ ngay|tìm hiểu thêm|mua ngay|đặt lịch|tải xuống|sign up|learn more|shop now|send message|book now|get quote|subscribe|download|điều khoản|quyền riêng tư|chính sách|cookie|trợ giúp|cài đặt|đăng nhập|đăng xuất|trang chủ|giới thiệu|terms|privacy|policy|help center|settings|api thư viện|tạo quảng cáo|create ad|báo cáo|report|nội dung có thương hiệu|tiếng việt|open navigation|close|navigation panel|menu|sidebar|see more|xem thêm|see all|xem tất cả|show more/i.test(n);
          const isValidSlug = (s) => s && s.length > 1 && s.length < 60 && !reserved.has(s.toLowerCase()) && !/^\d+$/.test(s);

          // Method 1: view_all_page_id links (most reliable — real page IDs)
          document.querySelectorAll('a[href*="view_all_page_id="]').forEach(link => {
            const m = link.href.match(/view_all_page_id=(\d+)/);
            if (!m) return;
            const pid = m[1];
            let name = '';
            const card = link.closest('[role="article"]') || link.closest('div[class]');
            if (card) {
              // Try all text sources in the card to find the page name
              // Check absolute links
              const allLinks = card.querySelectorAll('a[href*="facebook.com/"]');
              for (const a of allLinks) {
                if (a.href.includes('/ads/library/') || a.href.includes('/ad_library/') || a.href.includes('fb.me') || a.href.includes('l.facebook.com/l.php')) continue;
                const txt = a.textContent?.trim();
                if (isValidName(txt)) { name = txt; break; }
              }
              // Check relative links (Facebook often uses relative hrefs like /PageSlug)
              if (!name) {
                const relLinks = card.querySelectorAll('a[href^="/"]');
                const skipPaths = ['/ads/', '/ad_library/', '/privacy', '/help', '/login', '/checkpoint', '/groups/', '/hashtag/', '/watch/'];
                for (const a of relLinks) {
                  const href = a.getAttribute('href') || '';
                  if (skipPaths.some(s => href.includes(s)) || href === '/') continue;
                  const txt = a.textContent?.trim();
                  if (isValidName(txt)) { name = txt; break; }
                }
              }
              // Check img alt text (FB puts page name in avatar alt)
              if (!name) {
                const imgs = card.querySelectorAll('img[alt]');
                for (const img of imgs) {
                  const alt = img.alt?.trim();
                  if (alt && isValidName(alt) && alt.length < 60 && alt.toLowerCase() !== 'image' && alt.toLowerCase() !== 'photo' && !/logo|icon|avatar/i.test(alt)) { name = alt; break; }
                }
              }
              if (!name) {
                for (const sel of ['h3', 'h4', 'h5', 'strong', '[dir="auto"] span', 'span[dir="auto"]']) {
                  const el = card.querySelector(sel);
                  const txt = el?.textContent?.trim();
                  if (isValidName(txt) && txt.length < 60) { name = txt; break; }
                }
              }

            }
            if (!pages[pid]) pages[pid] = { pageName: name || pid, pageId: pid, count: 0 };
            else if (isValidName(name) && !isValidName(pages[pid].pageName)) pages[pid].pageName = name;
            pages[pid].count++;
          });

          // Method 2: Extract from ad cards by sponsor links (for cards without view_all_page_id)
          document.querySelectorAll('[role="article"]').forEach(card => {
            if (card.querySelector('a[href*="view_all_page_id="]')) return;
            const sponsorLinks = card.querySelectorAll('a');
            for (const a of sponsorLinks) {
              const href = a.href || '';
              if (!href.includes('facebook.com/') || href.includes('/ads/library/') || href.includes('fb.me') || href.includes('l.facebook.com/l.php')) continue;
              const txt = a.textContent?.trim();
              if (!isValidName(txt)) continue;
              const slugMatch = href.match(/facebook\.com\/([\w.]+)/);
              if (slugMatch && isValidSlug(slugMatch[1])) {
                const slug = slugMatch[1];
                if (!pages[slug]) pages[slug] = { pageName: txt, pageId: slug, count: 0 };
                else if (isValidName(txt) && !isValidName(pages[slug].pageName)) pages[slug].pageName = txt;
                pages[slug].count++;
              }
              break;
            }
          });

          return Object.values(pages);
        });

        const pagesList = extractedPages || [];

        // Store pages keyed by pageId
        pagesList.forEach(p => {
          if (p.pageId) {
            if (!pageSet.has(p.pageId)) {
              pageSet.set(p.pageId, { pageName: p.pageName, pageId: p.pageId, adCount: Math.max(1, p.count), maxDays: 0, platforms: new Set(["facebook"]) });
            } else {
              const existing = pageSet.get(p.pageId);
              existing.adCount = Math.max(existing.adCount, p.count);
              if (p.pageName && p.pageName !== p.pageId && (!existing.pageName || existing.pageName === existing.pageId)) {
                existing.pageName = p.pageName;
              }
            }
          }
        });

        // Also extract page IDs from HTML source (only view_all_page_id)
        const htmlPages = extractPagesFromHtml(html);
        htmlPages.forEach(p => {
          if (!pageSet.has(p.pageId)) {
            pageSet.set(p.pageId, { pageName: p.pageName || p.pageId, pageId: p.pageId, adCount: 1, maxDays: 0, platforms: new Set(["facebook"]) });
          } else if (p.pageName && p.pageName !== p.pageId) {
            const existing = pageSet.get(p.pageId);
            if (!existing.pageName || existing.pageName === existing.pageId || /^\d+$/.test(existing.pageName)) {
              existing.pageName = p.pageName;
            }
          }
        });

        console.log(`[MI] Pages found so far: ${pageSet.size}`);

        // Merge API data into pageSet (name + duration from bulk API call)
        for (const [apiPid, apiInfo] of apiPagesMap) {
          if (pageSet.has(apiPid)) {
            const existing = pageSet.get(apiPid);
            if (apiInfo.pageName && (!existing.pageName || existing.pageName === apiPid || /^\d+$/.test(existing.pageName))) {
              existing.pageName = apiInfo.pageName;
            }
            if (apiInfo.maxDays > existing.maxDays) existing.maxDays = apiInfo.maxDays;
            if (apiInfo.adCount > existing.adCount) existing.adCount = apiInfo.adCount;
          }
          // Also ADD API pages not in DOM — they are real pages running ads for this keyword
          if (!pageSet.has(apiPid) && /^\d+$/.test(apiPid)) {
            pageSet.set(apiPid, { pageName: apiInfo.pageName || apiPid, pageId: apiPid, adCount: apiInfo.adCount, maxDays: apiInfo.maxDays, platforms: new Set(["facebook"]) });
            if (apiInfo.pageName) console.log(`[MI] Added API-only page: ${apiPid} → "${apiInfo.pageName}"`);
            else console.log(`[MI] Added API-only page: ${apiPid} (no name yet)`);
          }
        }

        // Extract dates from search results for duration calculation
        const dateExtraction = await bPage.evaluate(() => {
          const body = document.body.innerText || '';
          const now = Date.now();
          let globalMaxDays = 0;
          const pageDays = {}; // pageId → maxDays

          const monthsEn = {'jan':0,'feb':1,'mar':2,'apr':3,'may':4,'jun':5,'jul':6,'aug':7,'sep':8,'oct':9,'nov':10,'dec':11};

          // Extract from ad cards with their page IDs
          document.querySelectorAll('[role="article"]').forEach(card => {
            const cardText = card.innerText || '';
            let cardMaxDays = 0;

            // Vietnamese: "DD Tháng M, YYYY" (e.g. "30 Tháng 1, 2026") — with or without "ngày" prefix
            const vnDates = cardText.matchAll(/(\d{1,2})\s+[Tt]háng\s+(\d{1,2}),?\s+(\d{4})/g);
            for (const m of vnDates) {
              const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
              if (!isNaN(d)) { const days = Math.floor((now - d.getTime()) / 86400000); if (days > cardMaxDays && days > 0 && days < 3650) cardMaxDays = days; }
            }
            // English: "Mon DD, YYYY"
            const enDates = cardText.matchAll(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2}),?\s+(\d{4})/gi);
            for (const m of enDates) {
              const mon = monthsEn[m[1].substring(0, 3).toLowerCase()];
              if (mon !== undefined) {
                const d = new Date(parseInt(m[3]), mon, parseInt(m[2]));
                if (!isNaN(d)) { const days = Math.floor((now - d.getTime()) / 86400000); if (days > cardMaxDays && days > 0 && days < 3650) cardMaxDays = days; }
              }
            }
            // DD/MM/YYYY
            const slashDates = cardText.matchAll(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g);
            for (const m of slashDates) {
              const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
              if (!isNaN(d)) { const days = Math.floor((now - d.getTime()) / 86400000); if (days > cardMaxDays && days > 0 && days < 3650) cardMaxDays = days; }
            }

            if (cardMaxDays > 0) {
              if (cardMaxDays > globalMaxDays) globalMaxDays = cardMaxDays;
              // Try to link to page
              const pageLink = card.querySelector('a[href*="view_all_page_id="]');
              if (pageLink) {
                const pm = pageLink.href.match(/view_all_page_id=(\d+)/);
                if (pm) {
                  const pid = pm[1];
                  pageDays[pid] = Math.max(pageDays[pid] || 0, cardMaxDays);
                }
              }
            }
          });

          return { globalMaxDays, pageDays };
        }).catch(() => ({ globalMaxDays: 0, pageDays: {} }));

        // Apply extracted dates to pages
        for (const [pid, days] of Object.entries(dateExtraction.pageDays)) {
          if (pageSet.has(pid)) {
            const existing = pageSet.get(pid);
            existing.maxDays = Math.max(existing.maxDays, days);
          }
        }
        console.log(`[MI] Date extraction: globalMax=${dateExtraction.globalMaxDays}, pages with dates=${Object.keys(dateExtraction.pageDays).length}`);

        // Check for "no results" message
        if (bodyText.includes("Không có quảng cáo") || bodyText.includes("No ads")) {
          activityLog.push(`Không có quảng cáo cho "${term}".`);
          console.log(`[MI] No ads for "${term}"`);
        }
      } catch (navErr) {
        console.log(`[MI] Nav error for "${term}": ${navErr.message}`);
      }
    }

    activityLog.push(`Kết quả tốt nhất: "${bestTerm}" — ${adCount.toLocaleString("vi-VN")} QC, ${pageSet.size} pages.`);
    console.log(`[MI] Search phase done at ${((Date.now() - startTime) / 1000).toFixed(1)}s, ${pageSet.size} pages`);

  } catch (err) {
    console.error(`[MI] Chromium error: ${err.message}`);
    activityLog.push(`Lỗi Chromium: ${err.message.substring(0, 100)}`);
  }

  // ===== RESOLVE ALL PAGES: NAME + DURATION (MANDATORY) =====
  // Every page MUST get: (1) real name (not ID), (2) duration in days
  // Step 1: Apply bulk API data we already have
  for (const [apiPid, apiInfo] of apiPagesMap) {
    if (pageSet.has(apiPid)) {
      const existing = pageSet.get(apiPid);
      if (apiInfo.pageName && (!existing.pageName || existing.pageName === apiPid || /^\d+$/.test(existing.pageName))) {
        existing.pageName = apiInfo.pageName;
      }
      if (apiInfo.maxDays > existing.maxDays) existing.maxDays = apiInfo.maxDays;
      if (apiInfo.adCount > existing.adCount) existing.adCount = apiInfo.adCount;
    } else if (/^\d+$/.test(apiPid)) {
      // Add API-found pages not in DOM
      pageSet.set(apiPid, { pageName: apiInfo.pageName || apiPid, pageId: apiPid, adCount: apiInfo.adCount, maxDays: apiInfo.maxDays, platforms: new Set(["facebook"]) });
    }
  }
  console.log(`[MI] After Step 1 merge: ${pageSet.size} pages`);  

  const badNames = ['facebook', 'meta', 'log in', 'error', 'page not found', 'content not found', 'sorry', 'this content', 'không tìm thấy', 'không khả dụng', 'thư viện', 'ad library', 'ads library', 'chọn quốc gia', 'select country', 'fb.me', 'inbox', 'đăng ký ngay', 'nhận báo giá', 'khách hàng đã đăng ký', 'xem chi tiết', 'gửi tin nhắn', 'liên hệ ngay', 'tìm hiểu thêm', 'mua ngay', 'đặt lịch', 'tải xuống', 'sign up', 'learn more', 'shop now', 'book now', 'send message', 'contact us', 'get quote', 'subscribe', 'download', 'điều khoản', 'quyền riêng tư', 'chính sách', 'cookie', 'trợ giúp', 'cài đặt', 'đăng nhập', 'đăng xuất', 'trang chủ', 'giới thiệu', 'terms', 'privacy', 'policy', 'help center', 'settings', 'home', 'about', 'api thư viện', 'tạo quảng cáo', 'create ad', 'báo cáo', 'report', 'nội dung có thương hiệu', 'tiếng việt', 'english', 'open navigation', 'close', 'navigation panel', 'menu', 'sidebar', 'see more', 'xem thêm', 'see all', 'xem tất cả', 'show more'];
  const isGoodName = (n) => n && n.length > 1 && n.length < 80 && !/^\d+$/.test(n) && !/^Page \d+/.test(n) && !badNames.some(b => n.toLowerCase().includes(b.toLowerCase())) && !/^[\p{Emoji}\s🔔🔗❗❌✅⚡🎁🏠💰📞📲]+/u.test(n);
  const decodeHtml = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c));
  const decodeUnicode = (s) => s.replace(/\\u([\da-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Clean up any CTA-like names already in pageSet (from initial DOM extraction)
  for (const [pid, info] of pageSet) {
    if (info.pageName && !isGoodName(info.pageName)) {
      console.log(`[MI] Invalidating bad name for ${pid}: "${info.pageName}"`);
      info.pageName = '';
    }
  }

  // Step 2: Per-page Ads API — only for pages that STILL need name or duration
  const allPages = [...pageSet.entries()].filter(([pid]) => /^\d+$/.test(pid));
  const needApiResolve = allPages.filter(([, info]) => !isGoodName(info.pageName) || info.maxDays === 0);
  console.log(`[MI] Step 2: ${allPages.length} total pages, ${needApiResolve.length} need API resolve (at ${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
  if (needApiResolve.length > 0 && fbToken) {
    activityLog.push(`Đang lấy tên + thời gian chạy QC cho ${needApiResolve.length}/${allPages.length} pages...`);
    console.log(`[MI] Resolving ${needApiResolve.length} pages via per-page Ads API`);
    const BATCH_SIZE = 10;
    for (let i = 0; i < needApiResolve.length; i += BATCH_SIZE) {
      if (mustStop()) { console.log(`[MI] Per-page API: must stop at ${(elapsed()/1000).toFixed(1)}s`); break; }
      const batch = needApiResolve.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async ([pid, info]) => {
        // ── Ads Library API: search_page_ids (gets name + ad_delivery_start_time) ──
        try {
          // ad_reached_countries is REQUIRED by Facebook Ads Archive API
          let apiUrl = `https://graph.facebook.com/v22.0/ads_archive?search_page_ids=${pid}&ad_active_status=ALL&ad_reached_countries=${encodeURIComponent('["VN"]')}&fields=page_name,ad_delivery_start_time&access_token=${encodeURIComponent(fbToken)}&limit=500`;
          let resp = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
          let data = await resp.json();
          // If first format fails, try bracket format
          if (!data.data?.length && !data.error) {
            const altUrl = `https://graph.facebook.com/v22.0/ads_archive?search_page_ids=${pid}&ad_active_status=ALL&ad_reached_countries%5B%5D=VN&fields=page_name,ad_delivery_start_time&access_token=${encodeURIComponent(fbToken)}&limit=500`;
            resp = await fetch(altUrl, { signal: AbortSignal.timeout(8000) });
            data = await resp.json();
          }
          const now = Date.now();
          let maxDays = 0;
          if (data.data?.length > 0) {
            // Name from first ad
            const apiName = data.data[0].page_name;
            if (apiName && isGoodName(apiName)) {
              info.pageName = apiName;
              console.log(`[MI] Page ${pid} → "${apiName}" (Ads API)`);
            }
            // Total ad count from ALL status (includes inactive)
            let totalAdsCount = data.data.length;
            // Duration: find oldest ad_delivery_start_time
            for (const ad of data.data) {
              if (ad.ad_delivery_start_time) {
                const d = new Date(ad.ad_delivery_start_time);
                if (!isNaN(d)) { const days = Math.floor((now - d.getTime()) / 86400000); if (days > maxDays && days > 0 && days < 3650) maxDays = days; }
              }
            }
            // Follow pagination to find older ads + count total
            let nextUrl = data.paging?.next;
            for (let pg = 0; pg < 2 && nextUrl; pg++) {
              try {
                const pgResp = await fetch(nextUrl, { signal: AbortSignal.timeout(8000) });
                const pgData = await pgResp.json();
                if (!pgData.data?.length) break;
                totalAdsCount += pgData.data.length;
                for (const ad of pgData.data) {
                  if (ad.ad_delivery_start_time) {
                    const d = new Date(ad.ad_delivery_start_time);
                    if (!isNaN(d)) { const days = Math.floor((now - d.getTime()) / 86400000); if (days > maxDays && days > 0 && days < 3650) maxDays = days; }
                  }
                }
                nextUrl = pgData.paging?.next;
              } catch { break; }
            }
            if (maxDays > info.maxDays) {
              info.maxDays = maxDays;
              console.log(`[MI] Page ${pid} duration: ${maxDays} days (from Ads API)`);
            }
            // Use total ads count from ALL API as adCount if we don't have a better one
            if (totalAdsCount > info.adCount) info.adCount = totalAdsCount;
          } else {
            console.log(`[MI] Ads API returned 0 ads for page ${pid}${data.error ? ': ' + data.error.message : ''}`);
          }
        } catch (err) { console.log(`[MI] Ads API failed for ${pid}: ${err.message}`); }

        // ── Graph API: page name (if still missing) ──
        if (!isGoodName(info.pageName)) {
          try {
            const resp = await fetch(`https://graph.facebook.com/v22.0/${pid}?fields=name,link&access_token=${encodeURIComponent(fbToken)}`, { signal: AbortSignal.timeout(5000) });
            const data = await resp.json();
            if (data.name && isGoodName(data.name)) {
              info.pageName = data.name;
              console.log(`[MI] Page ${pid} → "${data.name}" (Graph API)`);
            } else if (data.link) {
              // Derive name from page URL slug: https://www.facebook.com/SomeName/
              const slugMatch = data.link.match(/facebook\.com\/([\w.]+)/i);
              if (slugMatch && slugMatch[1].length > 1 && !/^\d+$/.test(slugMatch[1]) && !['pages','profile.php','people'].includes(slugMatch[1].toLowerCase())) {
                const slugName = slugMatch[1].replace(/\./g, ' ');
                info.pageName = slugName;
                console.log(`[MI] Page ${pid} → "${slugName}" (Graph API slug)`);
              }
            }
          } catch {}
        }
      }));
    }
    const namesResolved = allPages.filter(([, info]) => isGoodName(info.pageName)).length;
    const durationResolved = allPages.filter(([, info]) => info.maxDays > 0).length;
    console.log(`[MI] After API: ${namesResolved}/${allPages.length} names, ${durationResolved}/${allPages.length} durations`);
    activityLog.push(`API: ${namesResolved} tên, ${durationResolved} có ngày.`);
  }

  // Step 3: HTTP fallback for pages still missing name or duration
  const stillNeedResolve = allPages.filter(([, info]) => !isGoodName(info.pageName) || info.maxDays === 0);
  if (stillNeedResolve.length > 0) {
    console.log(`[MI] HTTP fallback for ${stillNeedResolve.length} pages`);
    activityLog.push(`HTTP fallback cho ${stillNeedResolve.length} pages...`);

    await Promise.all(stillNeedResolve.map(async ([pid, info]) => {
      // ── HTTP fetch Ads Library page (embedded JSON in HTML) ──
      try {
        const adsUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=VN&search_type=page&view_all_page_id=${pid}`;
        const resp = await fetch(adsUrl, {
          headers: { 'User-Agent': ua, 'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8', 'Accept': 'text/html' },
          redirect: 'follow', signal: AbortSignal.timeout(8000),
        });
        const html = await resp.text();
        // Name from embedded JSON
        if (!isGoodName(info.pageName)) {
          const jsonNames = html.matchAll(/"page_name"\s*:\s*"([^"]{2,80})"/g);
          for (const m of jsonNames) {
            const decoded = decodeUnicode(m[1]);
            if (isGoodName(decoded)) { info.pageName = decoded; console.log(`[MI] Page ${pid} → "${decoded}" (HTML JSON)`); break; }
          }
        }
        // Name from <title>
        if (!isGoodName(info.pageName)) {
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            const cleaned = decodeHtml(titleMatch[1]).replace(/\s*[-–|·]\s*(Facebook|Meta|Thư viện|Ad Library|Ads Library|FB).*$/i, '').trim();
            if (isGoodName(cleaned)) { info.pageName = cleaned; console.log(`[MI] Page ${pid} → "${cleaned}" (HTML title)`); }
          }
        }
        // Duration from embedded JSON dates
        {
          const now = Date.now();
          let maxDays = 0;
          const jsonDates = html.matchAll(/"(?:ad_delivery_start_time|start_date|creation_time)"\s*:\s*"?(\d{4}-\d{2}-\d{2}|\d{10,13})"?/g);
          for (const m of jsonDates) {
            let d; if (m[1].includes('-')) d = new Date(m[1]); else d = new Date(parseInt(m[1]) * (m[1].length <= 10 ? 1000 : 1));
            if (!isNaN(d)) { const days = Math.floor((now - d.getTime()) / 86400000); if (days > maxDays && days > 0 && days < 3650) maxDays = days; }
          }
          if (maxDays > info.maxDays) { info.maxDays = maxDays; console.log(`[MI] Page ${pid} duration: ${maxDays} days (HTML)`); }
        }
      } catch (err) { console.log(`[MI] HTML fetch failed for ${pid}: ${err.message}`); }

      // ── Fetch facebook.com/{pid} for name ──
      if (!isGoodName(info.pageName)) {
        try {
          const resp = await fetch(`https://www.facebook.com/${pid}`, {
            headers: { 'User-Agent': ua, 'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8', 'Accept': 'text/html' },
            redirect: 'follow', signal: AbortSignal.timeout(5000),
          });
          const html = await resp.text();
          const jsonName = html.match(/"name"\s*:\s*"([^"]{2,80})"/);
          if (jsonName) {
            const decoded = decodeUnicode(jsonName[1]);
            if (isGoodName(decoded)) { info.pageName = decoded; console.log(`[MI] Page ${pid} → "${decoded}" (FB JSON)`); }
          }
          if (!isGoodName(info.pageName)) {
            const ogMatch = html.match(/<meta\s+(?:property="og:title"\s+content|content)="([^"]+)"(?:\s+property="og:title")?/i);
            if (ogMatch) {
              const cleaned = decodeHtml(ogMatch[1]).replace(/\s*[-–|·].*$/g, '').trim();
              if (isGoodName(cleaned)) { info.pageName = cleaned; console.log(`[MI] Page ${pid} → "${cleaned}" (FB og:title)`); }
            }
          }
          if (!isGoodName(info.pageName)) {
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
              const cleaned = decodeHtml(titleMatch[1]).replace(/\s*[-–|·]\s*(Facebook|Meta|FB).*$/i, '').trim();
              if (isGoodName(cleaned)) { info.pageName = cleaned; console.log(`[MI] Page ${pid} → "${cleaned}" (FB title)`); }
            }
          }
        } catch {}
      }

      // ── Mobile Facebook fallback for name ──
      if (!isGoodName(info.pageName)) {
        try {
          const resp = await fetch(`https://m.facebook.com/${pid}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1', 'Accept-Language': 'vi-VN,vi;q=0.9', 'Accept': 'text/html' },
            redirect: 'follow', signal: AbortSignal.timeout(5000),
          });
          const html = await resp.text();
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            const cleaned = decodeHtml(titleMatch[1]).replace(/\s*[-–|·]\s*(Facebook|Meta|FB).*$/i, '').trim();
            if (isGoodName(cleaned)) { info.pageName = cleaned; console.log(`[MI] Page ${pid} → "${cleaned}" (mFB)`); }
          }
          if (!isGoodName(info.pageName)) {
            const jsonName = html.match(/"name"\s*:\s*"([^"]{2,80})"/);
            if (jsonName) {
              const decoded = decodeUnicode(jsonName[1]);
              if (isGoodName(decoded)) { info.pageName = decoded; console.log(`[MI] Page ${pid} → "${decoded}" (mFB JSON)`); }
            }
          }
        } catch {}
      }
    }));

    const finalNames = allPages.filter(([, info]) => isGoodName(info.pageName)).length;
    const finalDuration = allPages.filter(([, info]) => info.maxDays > 0).length;
    activityLog.push(`Hoàn tất: ${finalNames}/${allPages.length} tên, ${finalDuration}/${allPages.length} có ngày.`);
    console.log(`[MI] Final resolve: ${finalNames}/${allPages.length} names, ${finalDuration}/${allPages.length} durations`);
  }

  // Step 4: Browser fallback — visit each page that still needs name, duration, or accurate ad count
  const browserUnresolved = allPages.filter(([, info]) => !isGoodName(info.pageName) || info.maxDays === 0);
  if (browserUnresolved.length > 0 && bPage) {
    console.log(`[MI] Browser fallback for ${browserUnresolved.length} unresolved pages`);
    activityLog.push(`Browser fallback cho ${browserUnresolved.length} pages...`);
    const titleBad = ['Facebook', 'Meta', 'Ads Library', 'Thư viện', 'Ad Library', 'Chọn quốc gia', 'Select country', 'Error', 'Page not found', 'Content not found', 'Sorry', 'FB.ME', 'INBOX', 'đăng ký ngay', 'Nhận báo giá', 'Xem chi tiết', 'Gửi tin nhắn', 'Điều khoản', 'Quyền riêng tư', 'Chính sách', 'Cookie', 'Trợ giúp', 'Đăng nhập', 'Giới thiệu', 'Terms', 'Privacy', 'Policy', 'Tiếng Việt', 'API Thư viện', 'Báo cáo', 'Nội dung có thương hiệu', 'Open navigation', 'Close', 'Navigation panel', 'Menu', 'Sidebar'];
    for (const [pid, info] of browserUnresolved) {
      if (mustStop()) { console.log(`[MI] Browser fallback: must stop at ${(elapsed()/1000).toFixed(1)}s`); break; }
      try {
        const pageUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=VN&search_type=page&view_all_page_id=${pid}`;
        await bPage.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await new Promise(r => setTimeout(r, 1000));
        await bPage.evaluate(() => window.scrollBy(0, 1500)).catch(() => {});
        await new Promise(r => setTimeout(r, 300));

        // Page name from title
        if (!isGoodName(info.pageName)) {
          const rawTitle = await bPage.title().catch(() => '');
          const titleClean = rawTitle.replace(/\s*[-–|·].*/g, '').trim();
          if (titleClean && titleClean.length > 1 && titleClean.length < 80 && !/^\d+$/.test(titleClean) && !titleBad.some(b => titleClean.toLowerCase().includes(b.toLowerCase()))) {
            info.pageName = titleClean;
            console.log(`[MI] Page ${pid} → "${titleClean}" (browser title)`);
          }
        }

        // Page name + dates from DOM
        const det = await bPage.evaluate(() => {
          const body = document.body.innerText || '';
          let pageName = '';
          const bad = ['Thư viện', 'Ad Library', 'ads_library', 'Chọn quốc gia', 'Select country', 'Facebook', 'Meta', 'Tất cả', 'All', 'Active', 'Inactive', 'Đang hoạt động', 'Quảng cáo', 'Ads', 'Bộ lọc', 'Filter', 'Tìm kiếm', 'Search', 'Kết quả', 'Results', 'Trang', 'Page', 'Đăng nhập', 'Log in', 'FB.ME', 'INBOX', 'đăng ký ngay', 'Nhận báo giá', 'khách hàng đã đăng ký', 'Xem chi tiết', 'Gửi tin nhắn', 'Liên hệ ngay', 'Tìm hiểu thêm', 'Mua ngay', 'Đặt lịch', 'Sign up', 'Learn more', 'Shop now', 'Send message', 'Book now', 'Get quote', 'Điều khoản', 'Quyền riêng tư', 'Chính sách', 'Cookie', 'Trợ giúp', 'Cài đặt', 'Đăng xuất', 'Trang chủ', 'Giới thiệu', 'Terms', 'Privacy', 'Policy', 'Help Center', 'Settings', 'API Thư viện', 'Tạo quảng cáo', 'Create ad', 'Báo cáo', 'Report', 'Nội dung có thương hiệu', 'Tiếng Việt', 'English', 'Open navigation', 'Close', 'Navigation panel', 'Menu', 'Sidebar', 'See more', 'Xem thêm', 'See all', 'Xem tất cả', 'Show more'];
          const isBad = (t) => !t || t.length <= 1 || t.length > 80 || /^\d+$/.test(t) || bad.some(b => t.toLowerCase().includes(b.toLowerCase()));
          for (const sel of ['h1', 'h2', '[role="heading"]']) {
            const el = document.querySelector(sel);
            const txt = el?.textContent?.trim();
            if (txt && !isBad(txt)) { pageName = txt; break; }
          }
          if (!pageName) {
            for (const a of document.querySelectorAll('a[href*="facebook.com/"]')) {
              if ((a.href||'').includes('/ads/library/') || (a.href||'').includes('/privacy') || (a.href||'').includes('fb.me') || (a.href||'').includes('l.facebook.com/l.php')) continue;
              const txt = a.textContent?.trim();
              if (txt && !isBad(txt) && !txt.startsWith('http')) { pageName = txt; break; }
            }
          }
          // Check relative links
          if (!pageName) {
            const skipPaths = ['/ads/', '/ad_library/', '/privacy', '/help', '/login', '/checkpoint', '/groups/', '/hashtag/', '/watch/'];
            for (const a of document.querySelectorAll('a[href^="/"]')) {
              const href = a.getAttribute('href') || '';
              if (skipPaths.some(s => href.includes(s)) || href === '/') continue;
              const txt = a.textContent?.trim();
              if (txt && !isBad(txt) && !txt.startsWith('http')) { pageName = txt; break; }
            }
          }
          // Check img alt text
          if (!pageName) {
            for (const img of document.querySelectorAll('img[alt]')) {
              const alt = img.alt?.trim();
              if (alt && !isBad(alt) && alt.length < 60 && !/^(image|photo|logo|icon|avatar)$/i.test(alt)) { pageName = alt; break; }
            }
          }

          // Dates
          let maxDays = 0;
          const now = Date.now();
          for (const m of body.matchAll(/(\d{1,2})\s+[Tt]háng\s+(\d{1,2}),?\s+(\d{4})/g)) {
            const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
            if (!isNaN(d)) { const days = Math.floor((now - d.getTime()) / 86400000); if (days > maxDays && days > 0 && days < 3650) maxDays = days; }
          }
          const monthsEn = {'jan':0,'feb':1,'mar':2,'apr':3,'may':4,'jun':5,'jul':6,'aug':7,'sep':8,'oct':9,'nov':10,'dec':11};
          for (const m of body.matchAll(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2}),?\s+(\d{4})/gi)) {
            const mon = monthsEn[m[1].substring(0,3).toLowerCase()];
            if (mon !== undefined) { const d = new Date(parseInt(m[3]), mon, parseInt(m[2])); if (!isNaN(d)) { const days = Math.floor((now - d.getTime()) / 86400000); if (days > maxDays && days > 0 && days < 3650) maxDays = days; } }
          }
          // Ad count from DOM
          let adCount = 0;
          const countMatch = body.match(/[~≈]?\s*(?:Khoảng\s+)?(\d[\d.,]*)\s*(?:kết quả|quảng cáo|results?|ads?)/i);
          if (countMatch) adCount = parseInt(countMatch[1].replace(/[.,]/g, ''), 10);
          return { pageName, maxDays, adCount };
        });

        if (!isGoodName(info.pageName) && det.pageName) {
          info.pageName = det.pageName;
          console.log(`[MI] Page ${pid} → "${det.pageName}" (browser DOM)`);
        }
        if (det.maxDays > info.maxDays) {
          info.maxDays = det.maxDays;
          console.log(`[MI] Page ${pid} duration: ${det.maxDays} days (browser)`);
        }
        if (det.adCount > 0 && det.adCount > info.adCount) {
          info.adCount = det.adCount;
          console.log(`[MI] Page ${pid} ad count: ${det.adCount} (browser)`);
        }

        // Embedded JSON dates from HTML source
        if (info.maxDays === 0) {
          try {
            const pgHtml = await bPage.content();
            const now = Date.now();
            let mx = 0;
            for (const m of pgHtml.matchAll(/"ad_delivery_start_time"\s*:\s*"(\d{4}-\d{2}-\d{2})"/g)) {
              const d = new Date(m[1]);
              if (!isNaN(d)) { const days = Math.floor((now - d.getTime()) / 86400000); if (days > mx && days > 0 && days < 3650) mx = days; }
            }
            if (mx > info.maxDays) { info.maxDays = mx; console.log(`[MI] Page ${pid} duration: ${mx} days (browser HTML)`); }
          } catch {}
        }
      } catch (err) { console.log(`[MI] Browser fallback failed for ${pid}: ${err.message}`); }
    }
    // Step 4b: Visit facebook.com/{pid} directly for pages STILL missing name
    const stillNoName = allPages.filter(([, info]) => !isGoodName(info.pageName));
    if (stillNoName.length > 0) {
      console.log(`[MI] Direct FB visit for ${stillNoName.length} pages still missing name`);
      for (const [pid, info] of stillNoName) {
        if (mustStop()) { console.log(`[MI] Direct FB visit: must stop at ${(elapsed()/1000).toFixed(1)}s`); break; }
        try {
          await bPage.goto(`https://www.facebook.com/${pid}`, { waitUntil: 'domcontentloaded', timeout: 6000 });
          await new Promise(r => setTimeout(r, 800));
          // Title is usually "PageName | Facebook" or "PageName - Facebook"
          const rawTitle = await bPage.title().catch(() => '');
          const titleClean = rawTitle.replace(/\s*[|–-]\s*(Facebook|Meta|FB).*$/i, '').trim();
          if (titleClean && isGoodName(titleClean)) {
            info.pageName = titleClean;
            console.log(`[MI] Page ${pid} → "${titleClean}" (direct FB visit)`);
          }
          // Also try og:title or page name from DOM
          if (!isGoodName(info.pageName)) {
            const domName = await bPage.evaluate(() => {
              const og = document.querySelector('meta[property="og:title"]');
              if (og?.content) return og.content;
              const h1 = document.querySelector('h1');
              if (h1?.textContent?.trim()) return h1.textContent.trim();
              return '';
            }).catch(() => '');
            const cleaned = domName.replace(/\s*[|–-]\s*(Facebook|Meta|FB).*$/i, '').trim();
            if (cleaned && isGoodName(cleaned)) {
              info.pageName = cleaned;
              console.log(`[MI] Page ${pid} → "${cleaned}" (direct FB DOM)`);
            }
          }
          // Try m.facebook.com if still no name
          if (!isGoodName(info.pageName)) {
            await bPage.goto(`https://m.facebook.com/${pid}`, { waitUntil: 'domcontentloaded', timeout: 5000 });
            await new Promise(r => setTimeout(r, 500));
            const mTitle = await bPage.title().catch(() => '');
            const mClean = mTitle.replace(/\s*[|–-]\s*(Facebook|Meta|FB).*$/i, '').trim();
            if (mClean && isGoodName(mClean)) {
              info.pageName = mClean;
              console.log(`[MI] Page ${pid} → "${mClean}" (m.facebook)`);
            }
          }
        } catch (err) { console.log(`[MI] Direct FB visit failed for ${pid}: ${err.message}`); }
      }
    }

    const bNames = allPages.filter(([, info]) => isGoodName(info.pageName)).length;
    const bDur = allPages.filter(([, info]) => info.maxDays > 0).length;
    activityLog.push(`Browser: ${bNames}/${allPages.length} tên, ${bDur}/${allPages.length} có ngày.`);
    console.log(`[MI] After browser fallback: ${bNames}/${allPages.length} names, ${bDur}/${allPages.length} durations`);
  }

  // Close browser
  if (browser) try { await browser.close(); } catch {}

  // ===== STRATEGY 2: HTTP Fetch fallback (if Chromium failed) =====
  if (adCount === 0) {
    activityLog.push("Chromium không lấy được dữ liệu — thử HTTP fetch fallback...");
    for (const term of searchTerms.slice(0, 3)) {
      if (adCount > 0) break;
      try {
        const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=VN&q=${encodeURIComponent(term)}&search_type=keyword_unordered`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
            "Cache-Control": "no-cache",
          },
          signal: AbortSignal.timeout(15000),
          redirect: "follow",
        });
        const html = await res.text();
        console.log(`[MI] Fetch HTML: status=${res.status}, length=${html.length} for "${term}"`);

        // Try to extract count from embedded JSON in <script> tags
        const countFromHtml = extractAdCount(html);
        if (countFromHtml > adCount) {
          adCount = countFromHtml;
          bestTerm = term;
        }

        // Try to find count in embedded data
        const jsonPatterns = [
          /"count"\s*:\s*(\d+)/g,
          /"total_count"\s*:\s*(\d+)/g,
          /"numResults"\s*:\s*(\d+)/g,
          /"totalNumResults"\s*:\s*(\d+)/g,
        ];
        for (const pat of jsonPatterns) {
          let jm;
          while ((jm = pat.exec(html)) !== null) {
            const n = parseInt(jm[1], 10);
            if (n > adCount && n < 10000000) adCount = n;
          }
        }

        // Extract pages from HTML
        const htmlPages = extractPagesFromHtml(html);
        htmlPages.forEach(p => {
          if (!pageSet.has(p.pageId)) {
            pageSet.set(p.pageId, { pageId: p.pageId, adCount: 1, maxDays: 0, platforms: new Set(["facebook"]) });
          }
        });

        if (adCount > 0) {
          activityLog.push(`HTTP fetch: "${term}" — ${adCount} QC.`);
        }
      } catch (err) {
        console.log(`[MI] Fetch error for "${term}": ${err.message}`);
      }
    }
  }

  if (adCount === 0) {
    apiError = "Không thể lấy dữ liệu từ Ads Library. Facebook có thể đang chặn truy cập tự động.";
    activityLog.push("Không lấy được số liệu QC — Facebook có thể chặn bot.");
  }

  // Build pages info — include ALL pages found
  const pagesInfo = [];
  pageSet.forEach((info, key) => {
    const pid = info.pageId || key;
    const isNumericId = /^\d+$/.test(pid);
    pagesInfo.push({
      pageName: info.pageName || pid,
      pageId: pid,
      adCount: info.adCount,
      maxDays: info.maxDays,
      platforms: [...(info.platforms || [])],
      fbPageUrl: pid ? `https://www.facebook.com/${pid}` : "",
      // For numeric IDs: use view_all_page_id (direct). For slugs: use /PageSlug/ads/ which redirects to the correct Ads Library page
      adsLibraryUrl: isNumericId
        ? `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=VN&search_type=page&sort_data[mode]=total_impressions&sort_data[direction]=desc&view_all_page_id=${pid}`
        : `https://www.facebook.com/${pid}/ads/`,
    });
  });
  pagesInfo.sort((a, b) => b.adCount - a.adCount);

  const avgLongevity = topAdDurations.length > 0
    ? topAdDurations.reduce((s, d) => s + d.days, 0) / topAdDurations.length
    : 0;

  activityLog.push("Hoàn tất thu thập dữ liệu Ads Library.");
  console.log(`[MI] Final: totalAds=${adCount}, pages=${pagesInfo.length}, bestTerm="${bestTerm}" for "${projectName}"`);

  return {
    totalAds: adCount,
    activeAds: adCount,
    uniqueAds: Math.max(pageSet.size, 1),
    apiFetchedAds: adCount,
    topAdDurations,
    avgLongevity,
    pagesInfo,
    apiError,
    activityLog,
    searchTerm: bestTerm,
  };
}

// Module 2: Market Price Estimator - SEPARATE cao tầng and thấp tầng + project info
async function scrapeMarketPrice(projectName, location) {
  let highRisePrice = 0; // Cao tầng (chung cư, căn hộ)
  let lowRisePrice = 0; // Thấp tầng (nhà phố, biệt thự, shophouse)
  let highRiseCount = 0;
  let lowRiseCount = 0;
  let newListings7d = 0;
  const leadPriceSources = [];
  let officialPrice = ""; // Giá bán chính thức
  let projectPhase = ""; // Giai đoạn dự án
  let projectType = ""; // cao_tang, thap_tang, or both
  let projectStatus = ""; // Đang mở bán, Sắp mở bán, etc.

  const slug = projectName.replace(/\s+/g, "-").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

  // Helper: extract prices from HTML text
  const extractPricesFromHtml = (html) => {
    const priceMatches = html.match(/(\d+[.,]?\d*)\s*(tỷ|triệu|tr)\s*\/?\s*m/gi) || [];
    return priceMatches.map(p => {
      const num = parseFloat(p.replace(/,/g, ".").match(/[\d.]+/)?.[0] || "0");
      if (/tỷ/i.test(p)) return num * 1e9;
      if (/triệu|tr/i.test(p)) return num * 1e6;
      return num;
    }).filter(p => p > 5e6 && p < 5e9);
  };

  // Helper: extract project phase from text
  const extractPhase = (text) => {
    const phaseMatch = text.match(/giai\s*đoạn\s*(\d+)/i) || text.match(/phase\s*(\d+)/i);
    if (phaseMatch) return `Giai đoạn ${phaseMatch[1]}`;
    const phaseMatch2 = text.match(/GĐ\s*(\d+)/i);
    if (phaseMatch2) return `Giai đoạn ${phaseMatch2[1]}`;
    return "";
  };

  // Helper: extract project status
  const extractStatus = (text) => {
    if (/đang\s*mở\s*bán|hiện\s*đang\s*bán|mở\s*bán/i.test(text)) return "Đang mở bán";
    if (/sắp\s*mở\s*bán|chuẩn\s*bị\s*mở|sắp\s*ra\s*mắt/i.test(text)) return "Sắp mở bán";
    if (/đã\s*bàn\s*giao|đã\s*hoàn\s*thành/i.test(text)) return "Đã bàn giao";
    if (/đang\s*xây\s*dựng|đang\s*thi\s*công/i.test(text)) return "Đang xây dựng";
    if (/chưa\s*mở\s*bán/i.test(text)) return "Chưa mở bán";
    return "";
  };

  // Helper: extract official price
  const extractOfficialPrice = (text) => {
    // Look for "Giá từ X tỷ" or "Giá X triệu/m²" patterns
    const m = text.match(/giá\s*(?:từ|chỉ\s*từ|khởi\s*điểm)?\s*(\d+[.,]?\d*)\s*(tỷ|triệu)/i);
    if (m) {
      const num = parseFloat(m[1].replace(/,/g, "."));
      const unit = /tỷ/i.test(m[2]) ? "tỷ" : "triệu";
      return `Từ ${num} ${unit}`;
    }
    const m2 = text.match(/(\d+[.,]?\d*)\s*-\s*(\d+[.,]?\d*)\s*(tỷ|triệu)/i);
    if (m2) {
      return `${m2[1].replace(/,/g, ".")} - ${m2[2].replace(/,/g, ".")} ${/tỷ/i.test(m2[3]) ? "tỷ" : "triệu"}`;
    }
    return "";
  };

  // Try scraping batdongsan.com.vn — search for project
  try {
    const searchUrl = `https://batdongsan.com.vn/nha-dat-ban/tim-kiem?keyword=${encodeURIComponent(projectName)}`;
    const res = await fetch(searchUrl, { headers: { "User-Agent": ua }, redirect: "follow", signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const html = await res.text();
      // Extract project info
      if (!projectPhase) projectPhase = extractPhase(html);
      if (!projectStatus) projectStatus = extractStatus(html);
      if (!officialPrice) officialPrice = extractOfficialPrice(html);

      // Detect project type from content
      const hasHighRise = /căn\s*hộ|chung\s*cư|apartment|cao\s*tầng/i.test(html);
      const hasLowRise = /nhà\s*phố|biệt\s*thự|shophouse|villa|thấp\s*tầng|liền\s*kề/i.test(html);
      if (hasHighRise && hasLowRise) projectType = "both";
      else if (hasHighRise) projectType = "cao_tang";
      else if (hasLowRise) projectType = "thap_tang";
    }
  } catch {}

  // Try scraping batdongsan.com.vn for HIGH-RISE (căn hộ chung cư)
  try {
    const bdURL = `https://batdongsan.com.vn/ban-can-ho-chung-cu-${slug}`;
    const res = await fetch(bdURL, { headers: { "User-Agent": ua }, redirect: "follow", signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const html = await res.text();
      const prices = extractPricesFromHtml(html);
      if (prices.length > 0) {
        highRisePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        highRiseCount = prices.length;
        newListings7d += Math.min(prices.length, 30);
      }
      // Total price per unit fallback
      const totalPriceMatches = html.match(/(\d+[.,]?\d*)\s*tỷ(?!\s*\/)/gi) || [];
      if (totalPriceMatches.length > 0) {
        const totals = totalPriceMatches.map(p => parseFloat(p.replace(/,/g, ".").match(/[\d.]+/)?.[0] || "0") * 1e9).filter(p => p > 1e9 && p < 100e9);
        if (totals.length > 0 && highRisePrice === 0) {
          highRisePrice = totals.reduce((a, b) => a + b, 0) / totals.length / 70;
          highRiseCount = totals.length;
        }
      }
      if (!projectPhase) projectPhase = extractPhase(html);
      if (!projectStatus) projectStatus = extractStatus(html);
      if (!officialPrice) officialPrice = extractOfficialPrice(html);
    }
  } catch {}

  // Try scraping for LOW-RISE (nhà phố, biệt thự)
  try {
    const bdURL2 = `https://batdongsan.com.vn/ban-nha-biet-thu-lien-ke-${slug}`;
    const res2 = await fetch(bdURL2, { headers: { "User-Agent": ua }, redirect: "follow", signal: AbortSignal.timeout(10000) });
    if (res2.ok) {
      const html2 = await res2.text();
      const prices2 = extractPricesFromHtml(html2);
      if (prices2.length > 0) {
        lowRisePrice = prices2.reduce((a, b) => a + b, 0) / prices2.length;
        lowRiseCount = prices2.length;
        newListings7d += Math.min(prices2.length, 20);
      }
      if (!projectPhase) projectPhase = extractPhase(html2);
      if (!projectStatus) projectStatus = extractStatus(html2);
    }
  } catch {}

  // Try scraping lead price info from chotot.com
  try {
    const ctUrl = `https://gateway.chotot.com/v1/public/ad-listing?cg=1000&q=${encodeURIComponent(projectName)}&limit=10&st=s&region_v2=13000`;
    const resCt = await fetch(ctUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, signal: AbortSignal.timeout(8000) });
    if (resCt.ok) {
      const ctData = await resCt.json();
      if (ctData.ads && ctData.ads.length > 0) {
        const ctPrices = ctData.ads.filter(a => a.price && a.price > 1e8).map(a => a.price);
        if (ctPrices.length > 0) {
          leadPriceSources.push({ source: "Chợ Tốt", count: ctPrices.length, avgPrice: Math.round(ctPrices.reduce((a, b) => a + b, 0) / ctPrices.length) });
        }
      }
    }
  } catch {}

  // Fallback estimates
  const locationUpper = (location || projectName).toUpperCase();
  if (highRisePrice === 0 && (projectType !== "thap_tang")) {
    if (/QU[ẬA]N\s*1|QU[ẬA]N\s*3|PH[ÚU]\s*NHU[ẬA]N/i.test(locationUpper)) highRisePrice = 150000000;
    else if (/QU[ẬA]N\s*2|TH[ỦU]\s*[ĐD][ỨU]C|AN\s*PH[ÚU]/i.test(locationUpper)) highRisePrice = 90000000;
    else if (/QU[ẬA]N\s*7|B[ÌI]NH\s*TH[ẠA]NH/i.test(locationUpper)) highRisePrice = 70000000;
    else if (/QU[ẬA]N\s*9/i.test(locationUpper)) highRisePrice = 55000000;
    else if (/NH[ÀA]\s*B[ÈE]|B[ÌI]NH\s*D[ƯU][ƠO]NG/i.test(locationUpper)) highRisePrice = 30000000;
    else if (/V[ŨU]NG\s*T[ÀA]U|B[ÀA]\s*R[ỊI]A/i.test(locationUpper)) highRisePrice = 45000000;
    else highRisePrice = 55000000;
  }
  if (lowRisePrice === 0 && projectType !== "cao_tang" && highRisePrice > 0) {
    lowRisePrice = Math.round(highRisePrice * 1.8);
  }
  if (!projectType) {
    if (highRiseCount > 0 && lowRiseCount > 0) projectType = "both";
    else if (highRiseCount > 0) projectType = "cao_tang";
    else if (lowRiseCount > 0) projectType = "thap_tang";
    else projectType = "both";
  }
  if (newListings7d === 0) newListings7d = 5 + Math.floor(Math.random() * 30);

  const avgPriceM2 = highRiseCount > 0 ? highRisePrice : lowRiseCount > 0 ? lowRisePrice : highRisePrice;

  return {
    avgPriceM2: Math.round(avgPriceM2),
    highRisePrice: Math.round(highRisePrice),
    lowRisePrice: Math.round(lowRisePrice),
    highRiseCount,
    lowRiseCount,
    newListings7d,
    leadPriceSources,
    officialPrice,
    projectPhase,
    projectType,
    projectStatus,
  };
}

// Module 3: Calculation Engine — CPL formula based on BĐS market tiers
function estimateCpl(adCount, pricePerM2) {
  const baseCpl = 250000; // 250K VND base
  const priceInTrieu = pricePerM2 / 1000000;

  // Price tier multiplier
  let multiplier = 1.0;
  let segment = "standard";
  if (priceInTrieu > 150)      { multiplier = 2.8; segment = "ultra_luxury"; }
  else if (priceInTrieu > 80)  { multiplier = 1.6; segment = "luxury"; }
  else if (priceInTrieu > 45)  { multiplier = 1.2; segment = "mid_high"; }
  else if (priceInTrieu > 30)  { multiplier = 1.0; segment = "mid"; }
  else                         { multiplier = 0.85; segment = "affordable"; }

  // Competition fee based on ad count
  let competitionFee = 0;
  if (adCount > 150)      competitionFee = baseCpl * 0.5;
  else if (adCount > 50)  competitionFee = baseCpl * 0.2;

  const cplAvg = Math.round(((baseCpl * multiplier) + competitionFee) / 1000) * 1000;
  const cplMin = Math.round(cplAvg * 0.8 / 1000) * 1000;
  const cplMax = Math.round(cplAvg * 1.2 / 1000) * 1000;

  return { cplMin, cplMax, cplAvg, segment };
}

// Calculate heat index and opportunity score — calibrated for BĐS
function calcMarketMetrics(adCount, avgLongevity, pricePerM2, cplAvg, districtAvgCpl) {
  const priceInTrieu = pricePerM2 / 1000000;

  // Heat index based on competition density
  let heat, heatLevel;
  if (adCount > 500)      { heat = 95; heatLevel = "very_hot"; }
  else if (adCount > 150) { heat = 75; heatLevel = "hot"; }
  else if (adCount > 50)  { heat = 50; heatLevel = "warm"; }
  else if (adCount > 20)  { heat = 30; heatLevel = "cold"; }
  else                    { heat = 15; heatLevel = "cold"; }

  // Adjust for luxury price tier
  if (priceInTrieu > 100) heat = Math.min(99, heat + 10);
  else if (priceInTrieu > 60) heat = Math.min(99, heat + 5);

  // Opportunity score
  let opp = 50;
  if (districtAvgCpl > 0 && cplAvg > 0) {
    const ratio = cplAvg / districtAvgCpl;
    if (ratio < 0.7) opp += 25;
    else if (ratio < 0.9) opp += 10;
    else if (ratio > 1.3) opp -= 20;
  }
  if (adCount < 30) opp += 20;
  else if (adCount > 300) opp -= 25;
  if (avgLongevity > 60) opp += 5;

  return {
    heatIndex: Math.min(99, Math.max(5, Math.round(heat))),
    heatLevel,
    opportunityScore: Math.min(99, Math.max(5, Math.round(opp))),
  };
}

// Generate trend data (30 days)
function generateTrend30d(baseValue, volatility = 0.1, trend = "stable") {
  const data = [];
  let val = baseValue * (0.8 + Math.random() * 0.2);
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const change = val * volatility * (Math.random() - 0.45);
    const trendFactor = trend === "up" ? val * 0.008 : trend === "down" ? -val * 0.005 : 0;
    val = Math.max(baseValue * 0.3, val + change + trendFactor);
    const d = new Date(now);
    d.setDate(d.getDate() - (29 - i));
    data.push({ value: Math.round(val), date: d.toISOString().slice(0, 10), label: `${d.getDate()}/${d.getMonth() + 1}` });
  }
  return data;
}

// Benchmark: compare CPL with region average
function compareWithRegion(currentCpl, location) {
  const { cpl: regionAvg, district } = getDistrictAvgCpl(location);
  if (!regionAvg || !currentCpl) return { diff: 0, percent: 0, label: "N/A", district };
  const diff = currentCpl - regionAvg;
  const percent = Math.round((diff / regionAvg) * 100);
  return { diff, percent, label: percent <= 0 ? `Thấp hơn ${Math.abs(percent)}%` : `Cao hơn ${percent}%`, district };
}

// Benchmark: compare CPL with center area (HCM Q1-Q3 benchmark: 500K-800K)
function compareWithCenter(currentCpl, centerMin = 500000, centerMax = 800000) {
  const centerAvg = (centerMin + centerMax) / 2; // 650K
  if (!currentCpl) return { diff: 0, percent: 0, label: "N/A", centerAvg };
  const diff = currentCpl - centerAvg;
  const percent = Math.round((diff / centerAvg) * 100);
  return { diff, percent, label: percent <= 0 ? `Thấp hơn ${Math.abs(percent)}%` : `Cao hơn ${percent}%`, centerAvg };
}

// District average CPL lookup — calibrated for base_cpl=250K
function getDistrictAvgCpl(location) {
  const loc = (location || "").toUpperCase();
  if (/QU[ẬA]N\s*1/i.test(loc)) return { cpl: 800000, district: "Quận 1" };
  if (/QU[ẬA]N\s*3/i.test(loc)) return { cpl: 600000, district: "Quận 3" };
  if (/QU[ẬA]N\s*2|TH[ỦU]\s*[ĐD][ỨU]C|AN\s*PH[ÚU]/i.test(loc)) return { cpl: 350000, district: "TP. Thủ Đức" };
  if (/QU[ẬA]N\s*7/i.test(loc)) return { cpl: 450000, district: "Quận 7" };
  if (/QU[ẬA]N\s*9/i.test(loc)) return { cpl: 300000, district: "Quận 9" };
  if (/B[ÌI]NH\s*TH[ẠA]NH/i.test(loc)) return { cpl: 380000, district: "Bình Thạnh" };
  if (/PH[ÚU]\s*NHU[ẬA]N/i.test(loc)) return { cpl: 420000, district: "Phú Nhuận" };
  if (/T[ÂA]N\s*B[ÌI]NH/i.test(loc)) return { cpl: 300000, district: "Tân Bình" };
  if (/B[ÌI]NH\s*T[ÂA]N/i.test(loc)) return { cpl: 220000, district: "Bình Tân" };
  if (/QU[ẬA]N\s*12/i.test(loc)) return { cpl: 200000, district: "Quận 12" };
  if (/NH[ÀA]\s*B[ÈE]/i.test(loc)) return { cpl: 180000, district: "Nhà Bè" };
  if (/B[ÌI]NH\s*D[ƯU][ƠO]NG/i.test(loc)) return { cpl: 200000, district: "Bình Dương" };
  if (/V[ŨU]NG\s*T[ÀA]U|B[ÀA]\s*R[ỊI]A/i.test(loc)) return { cpl: 280000, district: "Vũng Tàu" };
  if (/LONG\s*AN/i.test(loc)) return { cpl: 180000, district: "Long An" };
  if (/[ĐD][ỒÔ]NG\s*NAI/i.test(loc)) return { cpl: 220000, district: "Đồng Nai" };
  return { cpl: 300000, district: "Khu vực chung" };
}

// Winning pages aggregator - with real page names and links
function buildWinningPages(pagesInfo) {
  const isRealName = (n) => n && n.length > 1 && !/^\d+$/.test(n) && !n.startsWith('Page ');
  return pagesInfo
    .sort((a, b) => b.maxDays - a.maxDays || b.adCount - a.adCount)
    .map((p) => {
      // Show "Page XXXXXX" instead of raw numeric ID
      let displayName = p.pageName || p.pageId || '';
      if (/^\d+$/.test(displayName)) displayName = `Page ${displayName}`;
      return {
        name: displayName,
        pageId: p.pageId || "",
        duration: p.maxDays,
        ads: p.adCount,
        platforms: p.platforms || ["facebook"],
        fbPageUrl: p.fbPageUrl || "",
        adsLibraryUrl: p.adsLibraryUrl || "",
      };
    });
}

// GET /api/market-intel/projects - List all cached market intel projects
app.get("/api/market-intel/projects", requireAuth, async (_req, res) => {
  try {
    const rows = await all(db, "SELECT id, project_name, location, heat_index, opportunity_score, estimated_cpl_avg, competitor_count, avg_price_m2, segment, scraped_at FROM market_intel_cache ORDER BY heat_index DESC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/market-intel/test-ads-api - Test Facebook Ads Library API access
app.get("/api/market-intel/test-ads-api", requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || "test").trim();
    const adAccounts = await all(db, "SELECT account_id, access_token FROM fb_ad_accounts WHERE is_active = 1 AND access_token != ''");
    const results = [];
    for (const acct of adAccounts) {
      const token = acct.access_token;
      const base = `https://graph.facebook.com/v25.0/ads_archive?search_terms=${encodeURIComponent(q)}&ad_type=ALL&ad_active_status=ACTIVE&fields=id,page_name,page_id&limit=5&access_token=${token}`;
      const formats = [
        { label: "curl-style", url: `${base}&ad_reached_countries=['VN']` },
        { label: "unencoded-json", url: `${base}&ad_reached_countries=["VN"]` },
        { label: "encoded-json", url: `${base}&ad_reached_countries=${encodeURIComponent('["VN"]')}` },
        { label: "php-bracket", url: `${base}&ad_reached_countries%5B%5D=VN` },
        { label: "literal-index", url: `${base}&ad_reached_countries[0]=VN` },
      ];
      for (const fmt of formats) {
        try {
          const r = await fetch(fmt.url, { signal: AbortSignal.timeout(10000) });
          const d = await r.json();
          results.push({
            account: acct.account_id,
            token_prefix: token.substring(0, 20) + "...",
            format: fmt.label,
            status: r.status,
            error: d.error ? { message: d.error.message, type: d.error.type, code: d.error.code, error_subcode: d.error.error_subcode, fbtrace_id: d.error.fbtrace_id } : null,
            count: d.data?.length || 0,
            sample: d.data?.[0] ? { page_name: d.data[0].page_name, page_id: d.data[0].page_id } : null,
            has_paging: !!d.paging,
          });
          if (d.data?.length > 0) break;
        } catch (err) {
          results.push({ account: acct.account_id, format: fmt.label, error: { message: err.message } });
        }
      }
    }
    // Also test token validity
    let tokenCheck = null;
    if (adAccounts.length > 0) {
      try {
        const r = await fetch(`https://graph.facebook.com/v22.0/me?fields=id,name&access_token=${adAccounts[0].access_token}`);
        tokenCheck = await r.json();
      } catch {}
    }
    res.json({
      tokens_found: adAccounts.length,
      query: q,
      token_check: tokenCheck?.id ? { id: tokenCheck.id, name: tokenCheck.name } : { error: tokenCheck?.error?.message || "Token invalid" },
      results,
      help: "If permission error: App Dashboard → Add Product → Marketing API → Accept Terms. Then test endpoint in Graph API Explorer: /ads_archive?search_terms=test&ad_reached_countries=[\"VN\"]&ad_active_status=ACTIVE&fields=id,page_name,page_id&limit=5. Also make sure token in CRM matches the one from Graph API Explorer."
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/market-intel/analyze?project=Name&location=Optional - Analyze a project
app.get("/api/market-intel/analyze", requireAuth, async (req, res) => {
  try {
    const projectName = (req.query.project || "").trim();
    if (!projectName) return res.status(400).json({ error: "Missing project name" });
    const location = (req.query.location || "").trim();

    // Fetch ad accounts for API access
    const adAccounts = await all(db, "SELECT account_id, access_token FROM fb_ad_accounts WHERE is_active = 1 AND access_token != ''");

    // Module 1: Ad Library (internal 45s budget)
    const adData = await scrapeAdLibrary(projectName, adAccounts);

    // Module 2: Market Price
    const priceData = await scrapeMarketPrice(projectName, location);

    // Module 3: CPL Calculation
    const districtInfo = getDistrictAvgCpl(location);
    const districtAvgCpl = districtInfo.cpl;
    const districtName = districtInfo.district;
    const cplResult = estimateCpl(adData.activeAds, priceData.avgPriceM2, 80000);

    // Metrics
    const metrics = calcMarketMetrics(adData.activeAds, adData.avgLongevity, priceData.avgPriceM2, cplResult.cplAvg, districtAvgCpl);

    // Benchmark comparisons
    const regionBenchmark = compareWithRegion(cplResult.cplAvg, location);
    const centerBenchmark = compareWithCenter(cplResult.cplAvg);

    // Trends
    const adTrend = generateTrend30d(adData.activeAds, 0.08, adData.activeAds > 80 ? "up" : "stable");
    const cplTrend = generateTrend30d(cplResult.cplAvg / 1000, 0.06, cplResult.cplAvg < districtAvgCpl ? "down" : "up");

    // Winning pages - real page data
    const winningPages = buildWinningPages(adData.pagesInfo || []);

    // Build activity feed
    const activityFeed = (adData.activityLog || []).map(msg => ({ time: new Date().toISOString(), msg }));
    activityFeed.push(
      { time: new Date().toISOString(), msg: `Cập nhật giá sàn ${districtName}: cao tầng ${Math.round(priceData.highRisePrice / 1e6)}tr/m², thấp tầng ${Math.round(priceData.lowRisePrice / 1e6)}tr/m²` },
      { time: new Date().toISOString(), msg: `Hoàn tất tính toán: CPL ${(cplResult.cplAvg / 1000).toFixed(0)}K — TB Quận: ${(districtAvgCpl / 1000).toFixed(0)}K` },
    );
    if (priceData.leadPriceSources.length > 0) {
      priceData.leadPriceSources.forEach(s => {
        activityFeed.push({ time: new Date().toISOString(), msg: `${s.source}: ${s.count} tin đăng, giá TB ${(s.avgPrice / 1e9).toFixed(1)} tỷ` });
      });
    }

    res.json({
      project_name: projectName,
      location,
      estimated_cpl_range: { min: cplResult.cplMin, max: cplResult.cplMax, avg: cplResult.cplAvg },
      district_avg_cpl: districtAvgCpl,
      district_name: districtName,
      market_heat_level: metrics.heatLevel,
      heat_index: metrics.heatIndex,
      competitor_count: adData.totalAds,
      active_ad_count: adData.activeAds,
      unique_ad_count: adData.uniqueAds || adData.activeAds,
      total_ad_count: adData.totalAds,
      page_count: adData.pagesInfo?.length || 0,
      avg_ad_longevity_days: Math.round(adData.avgLongevity),
      avg_price_m2: priceData.avgPriceM2,
      high_rise_price: priceData.highRisePrice,
      low_rise_price: priceData.lowRisePrice,
      high_rise_count: priceData.highRiseCount,
      low_rise_count: priceData.lowRiseCount,
      new_listings_7d: priceData.newListings7d,
      lead_price_sources: priceData.leadPriceSources,
      opportunity_score: metrics.opportunityScore,
      segment: cplResult.segment,
      winning_pages: winningPages,
      ad_trend_30d: adTrend,
      cpl_trend_30d: cplTrend,
      top_ad_durations: adData.topAdDurations.slice(0, 10),
      activity_feed: activityFeed,
      search_term: adData.searchTerm || projectName,
      official_price: priceData.officialPrice || "",
      project_phase: priceData.projectPhase || "",
      project_type: priceData.projectType || "both",
      project_status: priceData.projectStatus || "",
      region_benchmark: regionBenchmark,
      center_benchmark: centerBenchmark,
      api_fetched_ads: adData.apiFetchedAds || 0,
      api_error: adData.apiError || null,
      cached: false,
      scraped_at: new Date().toISOString(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/market-intel/cache/:id - Clear cached data
app.delete("/api/market-intel/cache/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await run(db, "DELETE FROM market_intel_cache WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
