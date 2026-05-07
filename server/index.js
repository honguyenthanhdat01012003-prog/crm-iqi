import { createClient } from "@libsql/client";
import cors from "cors";
import crypto from "crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import fs from "fs";
import helmet from "helmet";
import http from "http";
import jwt from "jsonwebtoken";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build version — used to verify deployment
const BUILD_VERSION = "2026-03-20-v1";

const PORT = Number(process.env.PORT || 4000);
const DB_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DB_DIR, "crm.db");
const JWT_SECRET = process.env.JWT_SECRET || "lux-iqi-crm-jwt-2026-xK9mZpQ4vR7wNcE3bY6hT1sA8fJ5gL0d";
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim()) : [];
const TELEGRAM_WEBHOOK_SECRET = crypto.createHash("sha256").update("tg-webhook-" + JWT_SECRET).digest("hex").slice(0, 64);

// Escape Telegram Markdown V1 special chars in user-provided content (_*`[)
const escMd = (s) => String(s || "").replace(/[_*`[\]\\]/g, "\\$&");

// Global Socket.IO instance — set up when server starts
let io = null;

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

// Robust phone normalization: strips formatting AND normalizes +84/84 → 0 prefix
// Used for matching overrides, phoneMap lookups, etc.
function normalizePhoneKey(phone) {
  let s = (phone || "").replace(/[\s.\-()]/g, "").trim();
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (/^84\d{9,}$/.test(s)) s = "0" + s.slice(2);
  return s;
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

const DB_VERSION = 22; // Bump this when adding new DDL/migrations

async function initDb() {
  const dbUrl = process.env.TURSO_URL || `file:${DB_PATH}`;
  const isLocal = dbUrl.startsWith("file:");
  if (isLocal) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    console.log(`[DB] Using LOCAL SQLite: ${DB_PATH}`);
  } else {
    console.log(`[DB] Using REMOTE Turso: ${dbUrl}`);
  }
  const db = createClient({
    url: dbUrl,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  // Fast path: check if DB is already fully initialized (1 network call)
  let dbVersion = 0;
  try {
    const v = await get(db, "SELECT value FROM settings WHERE key = 'db_version'");
    dbVersion = v ? Number(v.value) : 0;
  } catch {
    // settings table doesn't exist yet — need full init
    dbVersion = 0;
  }

  if (dbVersion >= DB_VERSION) {
    console.log(`[DB] Already at version ${dbVersion}, skipping migrations`);
    return db;
  }

  console.log(`[DB] Running migrations (current=${dbVersion}, target=${DB_VERSION})...`);

  // Create all tables
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
    `CREATE TABLE IF NOT EXISTS campaigns (id INTEGER PRIMARY KEY, name TEXT NOT NULL, project_id INTEGER NOT NULL, channel TEXT, budget REAL DEFAULT 0, spent REAL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT,
      ads_id TEXT DEFAULT '', campaign TEXT, campaign_id INTEGER, adset_name TEXT DEFAULT '-', ad_name TEXT DEFAULT '-',
      form_name TEXT DEFAULT '-', product TEXT, raw_status TEXT, status TEXT, created_at TEXT,
      inbox_url TEXT, is_hot INTEGER DEFAULT 0, sale_id INTEGER, sale_name TEXT DEFAULT '',
      manager_name TEXT DEFAULT '', source TEXT, budget TEXT, sync_at TEXT, notes TEXT,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id))`,
    `CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, lead_url TEXT DEFAULT '',
      cost_url TEXT DEFAULT '', cost_data TEXT DEFAULT '{}', fb_code TEXT DEFAULT '', fb_person TEXT DEFAULT '',
      mgr_assign_idx INTEGER DEFAULT 0, manual_assign INTEGER DEFAULT 0)`,

    `CREATE TABLE IF NOT EXISTS lead_history (
      id INTEGER PRIMARY KEY, lead_id INTEGER NOT NULL, sale_name TEXT NOT NULL,
      action TEXT DEFAULT '', contact_date TEXT DEFAULT '', status TEXT DEFAULT '',
      feedback TEXT DEFAULT '', seq INTEGER DEFAULT 0, source TEXT DEFAULT '')`,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'sale',
      display_name TEXT NOT NULL DEFAULT '', telegram_id TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS telegram_bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '',
      token TEXT NOT NULL DEFAULT '', is_active INTEGER NOT NULL DEFAULT 1,
      project_id INTEGER DEFAULT NULL, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS user_projects (
      user_id INTEGER NOT NULL, project_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, project_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS telegram_pending (
      telegram_id TEXT PRIMARY KEY, lead_id INTEGER NOT NULL, status TEXT DEFAULT '',
      message_id INTEGER, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS telegram_chat_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id INTEGER NOT NULL,
      telegram_id TEXT NOT NULL, first_name TEXT DEFAULT '', last_name TEXT DEFAULT '',
      username TEXT DEFAULT '', full_name TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(bot_id, telegram_id), FOREIGN KEY (bot_id) REFERENCES telegram_bots(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS fb_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, page_id TEXT NOT NULL DEFAULT '',
      access_token TEXT NOT NULL DEFAULT '', avatar_url TEXT DEFAULT '', is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS fb_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
      images TEXT DEFAULT '[]', project_id INTEGER, page_ids TEXT DEFAULT '[]', status TEXT DEFAULT 'draft',
      schedule_at TEXT DEFAULT '', link TEXT DEFAULT '', fb_post_id TEXT DEFAULT '', error_msg TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS sheet_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, project_name TEXT NOT NULL DEFAULT '',
      script_url TEXT NOT NULL DEFAULT '', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER NOT NULL, receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL, read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS fb_ad_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '', account_id TEXT NOT NULL DEFAULT '',
      access_token TEXT NOT NULL DEFAULT '', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS lead_status_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL,
      old_status TEXT DEFAULT '', new_status TEXT NOT NULL, changed_by TEXT NOT NULL,
      changed_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS capi_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER, event_name TEXT NOT NULL,
      lead_name TEXT DEFAULT '', lead_phone TEXT DEFAULT '', project TEXT DEFAULT '',
      status TEXT DEFAULT '', result TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS lead_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, status_filter TEXT DEFAULT 'all',
      start_date TEXT NOT NULL DEFAULT '', end_date TEXT NOT NULL, leads_per_day INTEGER DEFAULT 5,
      sale_names TEXT NOT NULL DEFAULT '[]', lead_ids TEXT NOT NULL DEFAULT '[]',
      assigned_index INTEGER DEFAULT 0, total_count INTEGER DEFAULT 0, created_by TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')), is_active INTEGER DEFAULT 1,
      last_processed_date TEXT DEFAULT '', assignment_log TEXT DEFAULT '[]',
      distribute_time TEXT DEFAULT '08:00', current_tour INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS market_intel_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_name TEXT NOT NULL, location TEXT DEFAULT '',
      ad_count INTEGER DEFAULT 0, active_ad_count INTEGER DEFAULT 0, avg_ad_longevity_days REAL DEFAULT 0,
      top_ad_durations TEXT DEFAULT '[]', avg_price_m2 REAL DEFAULT 0, new_listings_7d INTEGER DEFAULT 0,
      estimated_cpl_min REAL DEFAULT 0, estimated_cpl_max REAL DEFAULT 0, estimated_cpl_avg REAL DEFAULT 0,
      district_avg_cpl REAL DEFAULT 0, market_heat_level TEXT DEFAULT 'warm', heat_index INTEGER DEFAULT 50,
      opportunity_score INTEGER DEFAULT 50, competitor_count INTEGER DEFAULT 0, winning_pages TEXT DEFAULT '[]',
      ad_trend_30d TEXT DEFAULT '[]', cpl_trend_30d TEXT DEFAULT '[]', segment TEXT DEFAULT 'standard',
      scraped_at TEXT DEFAULT (datetime('now')), UNIQUE(project_name))`,
    `CREATE TABLE IF NOT EXISTS daily_news (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL DEFAULT '',
      news_summary TEXT DEFAULT '[]', market_trend TEXT DEFAULT '',
      marketing_lesson TEXT DEFAULT '', vocabulary TEXT DEFAULT '',
      source_links TEXT DEFAULT '[]', raw_response TEXT DEFAULT '',
      spotlight TEXT DEFAULT '{}', market_indicators TEXT DEFAULT '{}',
      expert_quotes TEXT DEFAULT '[]', market_sentiment INTEGER DEFAULT 50,
      market_cycle TEXT DEFAULT '', sales_script TEXT DEFAULT '',
      big_picture TEXT DEFAULT '',
      editorial_comment TEXT DEFAULT '', action_items TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS marketing_guidelines (
      id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, rule_name TEXT NOT NULL,
      content TEXT NOT NULL, keywords TEXT DEFAULT '', priority INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL,
      is_active INTEGER DEFAULT 1, created_by TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')))`,
  ];
  for (const sql of ddlStatements) {
    await run(db, sql);
  }

  // ALTER TABLE migrations
  const migrations = [
    "ALTER TABLE leads ADD COLUMN sale_name TEXT DEFAULT ''",
    "ALTER TABLE leads ADD COLUMN adset_name TEXT DEFAULT '-'",
    "ALTER TABLE leads ADD COLUMN ad_name TEXT DEFAULT '-'",
    "ALTER TABLE leads ADD COLUMN form_name TEXT DEFAULT '-'",
    "ALTER TABLE leads ADD COLUMN manager_name TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN telegram_id TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN last_active TEXT DEFAULT ''",
    "ALTER TABLE telegram_bots ADD COLUMN project_id INTEGER DEFAULT NULL",
    "ALTER TABLE telegram_pending ADD COLUMN message_id INTEGER",
    "ALTER TABLE sheet_configs ADD COLUMN project_name TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE sheet_configs ADD COLUMN is_active INTEGER DEFAULT 1",
    "ALTER TABLE lead_schedules ADD COLUMN start_date TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE lead_schedules ADD COLUMN assignment_log TEXT DEFAULT '[]'",
    "ALTER TABLE lead_schedules ADD COLUMN distribute_time TEXT DEFAULT '08:00'",
    "ALTER TABLE lead_schedules ADD COLUMN current_tour INTEGER DEFAULT 0",
    "ALTER TABLE projects ADD COLUMN fb_code TEXT DEFAULT ''",
    "ALTER TABLE projects ADD COLUMN fb_person TEXT DEFAULT ''",
    "ALTER TABLE lead_history ADD COLUMN source TEXT DEFAULT ''",
    "ALTER TABLE projects ADD COLUMN mgr_assign_idx INTEGER DEFAULT 0",
    "ALTER TABLE leads ADD COLUMN ads_id TEXT DEFAULT ''",
    "ALTER TABLE lead_schedules ADD COLUMN last_processed_slot INTEGER DEFAULT 0",
    "ALTER TABLE daily_news ADD COLUMN spotlight TEXT DEFAULT '{}'",
    "ALTER TABLE daily_news ADD COLUMN market_indicators TEXT DEFAULT '{}'",
    "ALTER TABLE daily_news ADD COLUMN expert_quotes TEXT DEFAULT '[]'",
    "ALTER TABLE daily_news ADD COLUMN market_sentiment INTEGER DEFAULT 50",
    "ALTER TABLE daily_news ADD COLUMN market_cycle TEXT DEFAULT ''",
    "ALTER TABLE daily_news ADD COLUMN sales_script TEXT DEFAULT ''",
    "ALTER TABLE daily_news ADD COLUMN big_picture TEXT DEFAULT ''",
    "ALTER TABLE daily_news ADD COLUMN editorial_comment TEXT DEFAULT ''",
    "ALTER TABLE daily_news ADD COLUMN action_items TEXT DEFAULT '[]'",
    "ALTER TABLE telegram_pending ADD COLUMN phone TEXT DEFAULT ''",
    "ALTER TABLE telegram_bots ADD COLUMN group_chat_id TEXT DEFAULT ''",
    "ALTER TABLE leads ADD COLUMN deal_value REAL DEFAULT 0",
    "ALTER TABLE leads ADD COLUMN is_locked INTEGER DEFAULT 0",
    "ALTER TABLE projects ADD COLUMN manual_assign INTEGER DEFAULT 0",
    `CREATE TABLE IF NOT EXISTS telegram_lead_msgs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      lead_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tlm_tg_lead ON telegram_lead_msgs(telegram_id, lead_id)`,
    // v19: personal_leads table
    `CREATE TABLE IF NOT EXISTS personal_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      product TEXT DEFAULT '',
      status TEXT DEFAULT 'new',
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pl_user ON personal_leads(user_id, is_deleted)`,
    // v20: personal_lead_history table
    `CREATE TABLE IF NOT EXISTS personal_lead_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      sale_name TEXT NOT NULL DEFAULT '',
      status TEXT DEFAULT '',
      feedback TEXT DEFAULT '',
      seq INTEGER DEFAULT 0,
      contact_date TEXT DEFAULT '',
      FOREIGN KEY (lead_id) REFERENCES personal_leads(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_plh_lead ON personal_lead_history(lead_id)`,
    // v21: hot_lead flag on user_projects
    "ALTER TABLE user_projects ADD COLUMN hot_lead INTEGER DEFAULT 0",
  ];
  for (const sql of migrations) {
    try { await run(db, sql); } catch (_) { /* column already exists */ }
  }

  // Migrate legacy sheet_script_url
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

  // Create default project from legacy settings if none exist
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

  // --- v3+v4: Add indexes + cleanup excessive history ---
  if (dbVersion < 4) {
    console.log("[DB] v3 migration: adding indexes...");
    try { await run(db, "CREATE INDEX IF NOT EXISTS idx_lh_lead_seq ON lead_history(lead_id, seq)"); } catch (_) {}
    try { await run(db, "CREATE INDEX IF NOT EXISTS idx_leads_project ON leads(project_id)"); } catch (_) {}
    try { await run(db, "CREATE INDEX IF NOT EXISTS idx_lh_source ON lead_history(source)"); } catch (_) {}

    // Cleanup: keep only last 30 history entries per lead (old sheet duplicates bloat DB)
    console.log("[DB] v3 migration: cleaning up excessive history...");
    try {
      const beforeCount = await get(db, "SELECT COUNT(*) as c FROM lead_history");
      // Process per-lead to avoid memory issues with huge datasets
      const bloated = await all(db, "SELECT lead_id, COUNT(*) as cnt FROM lead_history GROUP BY lead_id HAVING cnt > 30");
      for (const { lead_id } of bloated) {
        const toDelete = await all(db, { sql: "SELECT id FROM lead_history WHERE lead_id = ? ORDER BY seq DESC LIMIT -1 OFFSET 30", args: [lead_id] });
        if (toDelete.length > 0) {
          for (let j = 0; j < toDelete.length; j += 200) {
            const batch = toDelete.slice(j, j + 200);
            const placeholders = batch.map(() => "?").join(",");
            await run(db, `DELETE FROM lead_history WHERE id IN (${placeholders})`, batch.map(r => r.id));
          }
        }
      }
      const afterCount = await get(db, "SELECT COUNT(*) as c FROM lead_history");
      console.log(`[DB] v3 cleanup: ${beforeCount?.c || 0} -> ${afterCount?.c || 0} history rows (${bloated.length} leads cleaned)`);
    } catch (e) { console.error("[DB] v3 cleanup error:", e.message); }
  }

  // --- v6+v7: Fix lead statuses from latest history entry ---
  if (dbVersion < 7) {
    console.log("[DB] v7 migration: syncing ALL lead statuses from latest history...");
    try {
      // For each lead that has history with a non-empty status, use the latest one
      const leadsWithHistory = await all(db, `
        SELECT l.id, l.status, lh.status as hist_status
        FROM leads l
        INNER JOIN lead_history lh ON lh.id = (
          SELECT id FROM lead_history
          WHERE lead_id = l.id AND status != ''
          ORDER BY seq DESC LIMIT 1
        )
      `);
      let fixed = 0;
      for (const row of leadsWithHistory) {
        const newStatus = normalizeStatus(row.hist_status);
        if (newStatus !== row.status) {
          await run(db, "UPDATE leads SET status = ?, raw_status = ? WHERE id = ?", [newStatus, row.hist_status, row.id]);
          fixed++;
        }
      }
      console.log(`[DB] v7 migration: fixed ${fixed}/${leadsWithHistory.length} leads`);
    } catch (e) { console.error("[DB] v7 migration error:", e.message); }
  }

  // Mark DB version so next cold start skips all this
  // --- v8: Add is_legacy flag to projects ---
  if (dbVersion < 8) {
    console.log("[DB] v8 migration: adding is_legacy column to projects...");
    try { await run(db, "ALTER TABLE projects ADD COLUMN is_legacy INTEGER DEFAULT 0"); } catch (_) {}
  }

  // --- v9: Multi time slot support for lead schedules ---
  if (dbVersion < 9) {
    console.log("[DB] v9 migration: multi time slot support...");
    // Convert old single distribute_time to JSON array format
    try {
      const scheds = await all(db, "SELECT id, distribute_time FROM lead_schedules");
      for (const s of scheds) {
        if (s.distribute_time && !s.distribute_time.startsWith('[')) {
          await run(db, "UPDATE lead_schedules SET distribute_time = ? WHERE id = ?", [JSON.stringify([s.distribute_time]), s.id]);
        }
      }
    } catch (_) {}
  }

  // --- v22: manual_assign flag on projects ---
  if (dbVersion < 22) {
    console.log("[DB] v22 migration: adding manual_assign column to projects...");
    try { await run(db, "ALTER TABLE projects ADD COLUMN manual_assign INTEGER DEFAULT 0"); } catch (_) {}
  }

  await run(db, `INSERT INTO settings(key, value) VALUES('db_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [String(DB_VERSION)]);
  console.log(`[DB] Migrations complete, version=${DB_VERSION}`);

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
  // SSRF protection: only allow Google Sheets URLs
  try {
    const parsed = new URL(csvUrl);
    if (!parsed.hostname.endsWith("google.com") && !parsed.hostname.endsWith("googleapis.com")) {
      throw new Error("Only Google Sheets URLs are allowed");
    }
    if (parsed.protocol !== "https:") throw new Error("Only HTTPS URLs allowed");
  } catch (e) {
    if (e.message.includes("allowed")) throw e;
    throw new Error("Invalid URL format");
  }
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

const VALID_STATUS_KEYS = new Set([
  "new", "called", "interested", "low_interest", "other_project", "consulting", "appointment",
  "booked", "booking_other", "closed", "not_interested", "spam", "sale",
  "weak_finance", "unreachable", "callback", "wrong_phone", "wrong_number",
  "hung_up", "blocked", "has_sale", "lost",
]);

const STATUS_LABELS_VI = {
  new: "Chưa feedback", called: "Đã gọi", interested: "Quan tâm", low_interest: "QT hời hợt",
  other_project: "QT DA khác", consulting: "Đang tư vấn", appointment: "Hẹn xem", booked: "Booking/Cọc", booking_other: "Booking sản khác",
  closed: "Chốt", not_interested: "Không QT", spam: "Phá/rác", sale: "Sale",
  weak_finance: "TC yếu", unreachable: "Chưa LLĐ",
  callback: "Gọi lại sau", wrong_phone: "Thuê bao", wrong_number: "Sai số",
  hung_up: "Tắt máy ngang", blocked: "Chặn", has_sale: "Có sale khác", lost: "Mất",
};

// Build reverse map: Vietnamese label → status key
const LABEL_TO_KEY = {};
for (const [k, v] of Object.entries(STATUS_LABELS_VI)) {
  LABEL_TO_KEY[v] = k;
  LABEL_TO_KEY[v.toLowerCase()] = k;
}

function normalizeStatus(raw = "") {
  if (VALID_STATUS_KEYS.has(raw)) return raw;
  // Check exact label match (handles abbreviated labels like "Không QT")
  if (LABEL_TO_KEY[raw]) return LABEL_TO_KEY[raw];
  if (LABEL_TO_KEY[raw.trim()]) return LABEL_TO_KEY[raw.trim()];
  const v = foldText(raw);
  if (!v || v === "created" || v === "duplicate" || v.includes("chua xu ly")) return "new";
  if (v.includes("chot") || v.includes("mua") || v.includes("closed")) return "closed";
  if (v.includes("booking san khac") || v.includes("book san khac") || v.includes("booking sp khac")) return "booking_other";
  if (v.includes("giu cho") || v.includes("coc") || v.includes("book")) return "booked";
  if (v.includes("hen") || v.includes("di xem") || v.includes("xem nha") || v.includes("hen gap") || v.includes("hen xem") || v.includes("xem du an")) return "appointment";
  if (v.includes("pha") || v.includes("rac") || v.includes("spam")) return "spam";
  if (v.includes("tai chinh yeu") || v.includes("tai chinh") || v === "tcy") return "weak_finance";
  if (v.includes("thue bao")) return "wrong_phone";
  if (v.includes("sai so") || v.includes("sai")) return "wrong_number";
  if (v.includes("tat may ngang") || v.includes("tat may")) return "hung_up";
  if (v.includes("chua lien lac") || v.includes("khong lien lac") || v.includes("khong nghe") || v.includes("unreachable") || v === "kll") return "unreachable";
  if (v.includes("lien lac lai") || v.includes("goi lai")) return "callback";
  if (v.includes("chan kb") || v.includes("chan zalo") || (v.includes("chan") && !v.includes("chien"))) return "blocked";
  if (v.includes("khong quan") || v.includes("tu choi") || v.includes("not_interested") || v === "kqt") return "not_interested";
  if (v.includes("quan tam hoi hot") || v.includes("hoi hot") || v === "qthh") return "low_interest";
  if (v.includes("quan tam du an khac") || v.includes("du an khac") || v === "qtdak") return "other_project";
  if (v.includes("dang co sale") || v.includes("sale khac cham") || v.includes("co sale")) return "has_sale";
  if (v === "sale" || (v.includes("sale") && !v.includes("khac") && !v.includes("cham"))) return "sale";
  if (v.includes("quan tam") || v.includes("tu van") || v.includes("interested") || v === "qt") return "interested";
  if (v.includes("goi") || v.includes("lien he") || v.includes("called") || v.includes("zalo") || v.includes("nhan") || v.includes("da lien")) return "called";
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
    // Fallback: only use blocks that have a proper "Nhận Lead" column.
    // Blocks without nhanLeadIdx rely on feedback col alone which can false-match.
    for (let i = saleBlocks.length - 1; i >= 0; i--) {
      const b = saleBlocks[i];
      if (b.nhanLeadIdx < 0) continue;
      const v = (rawCols[b.nhanLeadIdx] || "").trim();
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
  // hh:mm:ss dd/mm/yyyy (Vietnamese locale output)
  const m2 = createdAt.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) {
    const dt = new Date(Number(m2[6]), Number(m2[5]) - 1, Number(m2[4]),
      Number(m2[1]), Number(m2[2]), Number(m2[3] || 0));
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

  const lsIdx = rawHeaders ? rawHeaders.findIndex((h) => foldText(h).includes("lead status")) : -1;
  // Find "Thời gian lead về" column — ONLY accepted source for lead timestamp
  const tgLeadVeIdx = rawHeaders ? rawHeaders.findIndex((h) => foldText(h).includes("thoi gian lead ve")) : -1;
  const dateColIdx = tgLeadVeIdx >= 0 ? tgLeadVeIdx : -1;

  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: foldText(h) }));

  const foldedRawHeaders = rawHeaders ? rawHeaders.map((h) => foldText(h)) : [];
  const findHeaderIndex = (aliases) => {
    if (!rawHeaders || !rawHeaders.length) return -1;
    const aliasFolded = aliases.map((a) => foldText(a));
    for (const a of aliasFolded) {
      const exactIdx = foldedRawHeaders.findIndex((h) => h === a);
      if (exactIdx >= 0) return exactIdx;
    }
    for (const a of aliasFolded) {
      const softIdx = foldedRawHeaders.findIndex((h) => h && (h.startsWith(a) || a.startsWith(h)));
      if (softIdx >= 0) return softIdx;
    }
    return -1;
  };

  // Anchor mapping by stable form fields, avoid positional drift when questions change.
  const nameHeaderIdx = findHeaderIndex(["full_name", "full name", "ho ten", "ten day du"]);
  const phoneHeaderIdx = findHeaderIndex(["phone_number", "phone number", "phone", "so dien thoai", "sdt"]);

  // Detect "nhu cầu khách" (question) columns.
  // Anchor: questions are BETWEEN phone_number col and "Thời gian lead về" col.
  // Skip inbox_url and lead_status which sit in between.
  // Fallback: old structure where questions are BEFORE full_name/phone_number (after platform).
  const questionColIndices = [];
  const _skipExactTokens = new Set(["lead status", "inbox url", "inbox", "inbox_url"]);

  if (phoneHeaderIdx >= 0 && tgLeadVeIdx > phoneHeaderIdx && rawHeaders) {
    for (let _ci = phoneHeaderIdx + 1; _ci < tgLeadVeIdx; _ci++) {
      const hn = foldedRawHeaders[_ci] || "";
      if (!hn) continue;
      // Skip exact-matched system cols that sit between phone and questions
      if (_skipExactTokens.has(hn)) continue;
      if (hn === foldText("lead_status") || hn === "lead status") continue;
      questionColIndices.push(_ci);
    }
  }

  if (questionColIndices.length === 0 && rawHeaders) {
    // Fallback: old structure where questions are BEFORE full_name/phone_number (after platform)
    const _platformIdx = rawHeaders.findIndex((h) => foldText(h) === "platform");
    const _qStop = (nameHeaderIdx >= 0 && phoneHeaderIdx >= 0)
      ? Math.min(nameHeaderIdx, phoneHeaderIdx)
      : rawHeaders.length;
    const _qStart = _platformIdx >= 0 ? _platformIdx + 1 : 0;
    // Use word-boundary safe tokens (no short substrings that can false-match)
    const _sysExact = new Set([
      "id", "lead id", "ads id", "campaign name", "adset name", "ad name", "form name",
      "lead status", "thoi gian", "created time", "inbox url", "source", "platform",
      "budget", "sale", "feedback khach", "nhan lead",
    ]);
    for (let _ci = _qStart; _ci < _qStop; _ci++) {
      const hn = foldedRawHeaders[_ci] || "";
      if (!hn || _sysExact.has(hn)) continue;
      questionColIndices.push(_ci);
    }
  }

  // Standard header-based mapping
  const standardResult = rows
    .map((r, i) => {
      const _rawRow = rawRows?.[i] ?? [];
      const name = nameHeaderIdx >= 0
        ? ((_rawRow[nameHeaderIdx] || "").trim())
        : findVal(r, ["full name", "full_name", "ho ten", "ten day du"]);
      if (!name) return null;

      const adsId = findVal(r, ["id", "lead_id", "ads_id", "id_ads", "ma_lead", "id lead"]);
      let phone = phoneHeaderIdx >= 0
        ? ((_rawRow[phoneHeaderIdx] || "").trim())
        : findVal(r, ["phone_number", "phone number", "phone", "so dien thoai", "sdt", "dien thoai", "mobile", "di dong", "so dt"]);
      if (phone.startsWith("p:")) phone = phone.slice(2);
      const campaign = findVal(r, ["campaign_name", "campaign name", "chien dich", "ten chien dich"]);
      const adsetName = findVal(r, ["adset_name", "adset name", "nhom quang cao", "ten nhom"]);
      const adName = findVal(r, ["ad_name", "ad name", "noi dung", "ten quang cao"]);
      const formName = findVal(r, ["form_name", "form name", "ten form"]);
      const product = questionColIndices.length > 0
        ? questionColIndices.map(ci => (_rawRow[ci] || "").trim()).filter(Boolean).join(" | ")
        : findVal(r, ["product", "loai"]);
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
      // If sale gave feedback but normalizeStatus can't categorize it, default to "called"
      let status = normalizeStatus(rawStatus);
      if (status === "new" && saleStatus) status = "called";

      return {
        id: i + 1,
        projectId: 1,
        name,
        phone,
        adsId: adsId || "",
        campaign: campaign || "Khac",
        campaignId: null,
        adsetName: adsetName || "-",
        adName: adName || "-",
        formName: formName || "-",
        product: product || "-",
        rawStatus,
        saleStatus: saleStatus || "",
        status,
        createdAt: createdAt || "-",
        inboxUrl,
        isHot: calcIsHot(createdAt, saleName),
        saleId: 0,
        saleName: saleName || "Chưa chia",
        saleHistory,
        source: "Facebook",
        budget: budget || "-",
        syncAt: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
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
      let status = normalizeStatus(rawStatus);
      if (status === "new" && saleStatus) status = "called";

      // fallback: try to get adset/ad from raw columns 3 and 5
      const adName = rawCols[3] ? rawCols[3].trim() : "-";
      const adsetName = rawCols[5] ? rawCols[5].trim() : "-";
      const formName = rawCols[9] ? rawCols[9].trim() : "-";

      return {
        id: i + 1,
        projectId: 1,
        name,
        phone,
        adsId: "",
        campaign: campaign || "Khac",
        campaignId: null,
        adsetName,
        adName,
        formName,
        product: product || "-",
        rawStatus,
        saleStatus: saleStatus || "",
        status,
        createdAt: createdAt || "-",
        inboxUrl,
        isHot: calcIsHot(createdAt, saleName),
        saleId: 0,
        saleName: saleName || "Chưa chia",
        saleHistory,
        source: "Facebook",
        budget: "-",
        syncAt: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
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
  const daily = [];

  for (const cols of rawRows) {
    const dateVal = dateIdx >= 0 ? (cols[dateIdx] || "").trim() : "";
    const dm = dateVal.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dm) continue;

    const daySpent = parseVnNumber(spentIdx >= 0 ? cols[spentIdx] : "");
    const dayLeads = Math.round(parseVnNumber(leadsIdx >= 0 ? cols[leadsIdx] : ""));
    const dayBooking = Math.round(parseVnNumber(bookingIdx >= 0 ? cols[bookingIdx] : ""));

    totalSpent += daySpent;
    totalLeads += dayLeads;
    totalBooking += dayBooking;

    // Store ISO date (yyyy-mm-dd) for easy range filtering
    const isoDate = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
    daily.push({ date: isoDate, spent: daySpent, leads: dayLeads, booking: dayBooking });
  }

  return {
    totalSpent,
    totalLeads,
    totalBooking,
    cpLead: totalLeads > 0 ? Math.round(totalSpent / totalLeads) : 0,
    daily,
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
  // Helper: normalize phone for matching (uses robust +84/0 normalization)
  const normPhone = normalizePhoneKey;

  // Read project flags (resilient: column may not exist on old DBs)
  let isManualAssign = false;
  try {
    const projectRow = await get(db, "SELECT manual_assign FROM projects WHERE id = ?", [projectId]);
    isManualAssign = !!(projectRow && projectRow.manual_assign);
  } catch (_) {}

  // 0. BACKUP: Save sale assignments + history before destructive sync
  try {
    const backupLeads = await all(db,
      "SELECT id, name, phone, sale_name, manager_name, status, raw_status FROM leads WHERE project_id = ? AND sale_name != '' AND sale_name != 'Chưa chia'",
      [projectId]
    );
    const backupHistory = await all(db,
      "SELECT lh.lead_id, lh.action, lh.status, lh.sale_name, lh.feedback, lh.contact_date, lh.note, lh.source, lh.user_name, lh.created_at, l.phone, l.name as lead_name FROM lead_history lh JOIN leads l ON lh.lead_id = l.id WHERE l.project_id = ?",
      [projectId]
    );
    if (backupLeads.length > 0 || backupHistory.length > 0) {
      const backupData = JSON.stringify({ ts: new Date().toISOString(), projectId, leads: backupLeads, history: backupHistory });
      await run(db,
        "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [`backup_project_${projectId}`, backupData]
      );
      console.log(`[replaceProjectData] Backup saved: ${backupLeads.length} sale assignments, ${backupHistory.length} history entries`);
    }
  } catch (e) { console.warn("[replaceProjectData] Backup failed:", e.message); }

  // 1. Load existing leads for status/sale preservation (match by name)
  const existing = await all(
    db,
    "SELECT id, name, phone, ads_id, status, raw_status, notes, sale_id, sale_name, is_hot, manager_name, deal_value, is_locked FROM leads WHERE project_id = ?",
    [projectId]
  );
  
  // Helper: compare two leads, return true if newLead should replace prevLead
  // Priority: 1) non-empty manager_name, 2) non-"new" status, 3) higher ID (more recent)
  const shouldReplace = (prevLead, newLead) => {
    // Prefer lead with non-empty manager_name
    const prevHasMgr = !!(prevLead.manager_name && prevLead.manager_name.trim());
    const newHasMgr = !!(newLead.manager_name && newLead.manager_name.trim());
    if (newHasMgr && !prevHasMgr) return true;
    if (prevHasMgr && !newHasMgr) return false;
    // Both have or both don't have manager - prefer meaningful status
    if (prevLead.status === "new" && newLead.status !== "new") return true;
    if (prevLead.status !== "new" && newLead.status === "new") return false;
    // Same status category - prefer higher ID (more recent)
    return newLead.id > prevLead.id;
  };
  
  // Build 4-tier matching: ads_id (best) → phone+name (specific) → phone → name (fallback)
  const adsIdMap = new Map();
  const phoneNameMap = new Map(); // composite phone+name key
  const phoneMap = new Map();
  const nameMap = new Map();
  for (const e of existing) {
    // Tier 1: ads_id (unique per lead from ad platform)
    const aid = (e.ads_id || "").trim();
    if (aid) {
      const prevAid = adsIdMap.get(aid);
      if (!prevAid || shouldReplace(prevAid, e)) {
        adsIdMap.set(aid, e);
      }
    }
    // Tier 2: phone+name composite (most specific non-ads match)
    const np = normPhone(e.phone);
    const nName = (e.name || "").trim().toLowerCase();
    if (np && nName) {
      const pnKey = `${np}||${nName}`;
      const prevPN = phoneNameMap.get(pnKey);
      if (!prevPN || shouldReplace(prevPN, e)) {
        phoneNameMap.set(pnKey, e);
      }
    }
    // Tier 3: phone only
    if (np) {
      const prevP = phoneMap.get(np);
      if (!prevP || shouldReplace(prevP, e)) {
        phoneMap.set(np, e);
      }
    }
    // Tier 4: name only
    if (nName) {
      const prevN = nameMap.get(nName);
      if (!prevN || shouldReplace(prevN, e)) {
        nameMap.set(nName, e);
      }
    }
  }
  console.log(`[replaceProjectData] Maps: adsIdMap=${adsIdMap.size}, phoneNameMap=${phoneNameMap.size}, phoneMap=${phoneMap.size}, nameMap=${nameMap.size}`);
  // Debug: log all leads with their manager_name for tracing
  const mgrCounts = {};
  for (const e of existing) {
    const mgr = e.manager_name || "(empty)";
    mgrCounts[mgr] = (mgrCounts[mgr] || 0) + 1;
  }
  console.log(`[replaceProjectData] Existing leads manager distribution:`, JSON.stringify(mgrCounts));

  // 2. Save CRM-added history per phone (non-sheet entries)
  // Keep ALL feedback entries + only latest "Chia lead" per sale to prevent bloat
  let allHistory = [];
  if (existing.length > 0) {
    allHistory = await all(db,
      "SELECT lh.*, l.phone FROM lead_history lh JOIN leads l ON lh.lead_id = l.id WHERE l.project_id = ? ORDER BY lh.seq DESC",
      [projectId]
    );
  }
  const phoneHistMap = new Map();
  for (const h of allHistory) {
    // Direction B: keep sheet-source entries that have real sale feedback (non-empty status/feedback).
    // Pure "Chia lead" sheet entries (no status, no feedback) are dropped — they'll be re-added from new sheet.
    if (h.source === "sheet" && !h.status && !h.feedback) continue;
    const np = normPhone(h.phone);
    if (!np) continue;
    if (!phoneHistMap.has(np)) phoneHistMap.set(np, []);
    phoneHistMap.get(np).push(h);
  }
  // Deduplicate + trim: keep ALL feedback/update entries, only latest "Chia lead" per sale
  for (const [np, arr] of phoneHistMap) {
    const feedback = [];
    const chiaPerSale = new Map();
    const seenFeedback = new Set();
    for (const h of arr) {
      if (h.action === "Chia lead") {
        const key = h.sale_name || "";
        if (!chiaPerSale.has(key) || h.seq > chiaPerSale.get(key).seq) {
          chiaPerSale.set(key, h);
        }
      } else {
        // Deduplicate feedback entries (same sale+action+date+status)
        const dk = `${h.sale_name}|${h.action}|${h.contact_date}|${h.status}`;
        if (!seenFeedback.has(dk)) {
          seenFeedback.add(dk);
          feedback.push(h);
        }
      }
    }
    phoneHistMap.set(np, [...feedback, ...chiaPerSale.values()]);
  }

  const stmts = [];

  // 3. Delete ALL existing data for this project (clean slate)
  stmts.push({ sql: "UPDATE leads SET campaign_id = NULL WHERE project_id = ?", args: [projectId] });
  stmts.push({ sql: "DELETE FROM lead_history WHERE lead_id IN (SELECT id FROM leads WHERE project_id = ?)", args: [projectId] });
  stmts.push({ sql: "DELETE FROM leads WHERE project_id = ?", args: [projectId] });
  stmts.push({ sql: "DELETE FROM campaigns WHERE project_id = ?", args: [projectId] });

  // 4. Insert campaigns
  for (const c of campaigns) {
    stmts.push({
      sql: "INSERT INTO campaigns(name, project_id, channel, budget, spent) VALUES(?, ?, ?, ?, ?)",
      args: [c.name, projectId, c.channel, c.budget, c.spent],
    });
  }

  // 5. Insert all leads from new sheet, restoring status/sale from old data where name matches
  let matchByAdsId = 0, matchByPhoneName = 0, matchByPhone = 0, matchByName = 0, noMatch = 0;
  for (const l of leads) {
    const np = normPhone(l.phone);
    const nName = (l.name || "").trim().toLowerCase();
    const lAdsId = (l.adsId || "").trim();
    const pnKey = np && nName ? `${np}||${nName}` : "";
    // 4-tier matching: ads_id → phone+name → phone → name
    const prev = (lAdsId && adsIdMap.get(lAdsId)) 
              || (pnKey && phoneNameMap.get(pnKey))
              || (np && phoneMap.get(np)) 
              || (nName && nameMap.get(nName)) 
              || undefined;
    if (prev) {
      if (lAdsId && adsIdMap.has(lAdsId)) matchByAdsId++;
      else if (pnKey && phoneNameMap.has(pnKey)) matchByPhoneName++;
      else if (np && phoneMap.has(np)) matchByPhone++;
      else matchByName++;
    } else { noMatch++; }

    // Start with sheet values
    let status = l.status;
    let rawStatus = l.rawStatus || "";
    let notes = l.notes || "";
    let saleId = l.saleId;
    let saleName = l.saleName || "";
    let isHot = l.isHot ? 1 : 0;
    let managerName = "";
    let dealValue = 0;
    let isLockedVal = 0;

    // Manual-assign project: new leads (no prev DB record) must NOT be auto-assigned from sheet
    if (isManualAssign && !prev && saleName) {
      console.log(`[replaceProjectData] MANUAL_ASSIGN: new lead "${l.name}" blocked from auto-assign (was "${saleName}")`);
      saleName = "";
      saleId = null;
    }

    if (prev) {
      // ALWAYS preserve CRM status if user has changed it from "new"
      if (prev.status && prev.status !== "new") {
        status = prev.status;
        rawStatus = prev.raw_status || rawStatus;
      }
      // Restore sale assignment - CRM always wins over sheet
      if (prev.sale_name && prev.sale_name !== "Chưa chia") {
        saleName = prev.sale_name;
        saleId = prev.sale_id || saleId;
      }
      // Restore notes, hot status, and manager_name
      if (prev.notes) notes = prev.notes;
      if (prev.is_hot) isHot = prev.is_hot;
      managerName = prev.manager_name || "";
      if (prev.deal_value) dealValue = prev.deal_value;
      if (prev.is_locked) isLockedVal = prev.is_locked;
      // Debug: log manager restoration for leads with specific managers
      if (prev.manager_name && prev.manager_name !== "Trần Văn Quyết") {
        console.log(`[replaceProjectData] RESTORE: "${l.name}" prev.id=${prev.id} manager="${prev.manager_name}" (matched by ${lAdsId && adsIdMap.has(lAdsId) ? 'adsId' : pnKey && phoneNameMap.has(pnKey) ? 'phoneName' : np && phoneMap.has(np) ? 'phone' : 'name'})`);
      }
    } else {
      // No previous lead found - log for debugging
      if (matchByAdsId + matchByPhoneName + matchByPhone + matchByName + noMatch <= 5) {
        console.log(`[replaceProjectData] NO_MATCH: "${l.name}" phone="${l.phone}" adsId="${lAdsId}" - will have empty manager`);
      }
    }

    // Determine correct status from CRM history by DATE (most reliable, seq can be wrong)
    // Only consider entries AFTER the most recent "Chia lead" for current sale (respect assignment boundary)
    const crmHist = phoneHistMap.get(np);
    if (crmHist && crmHist.length) {
      // Sort by date DESC to find the most recent "Chia lead" for current sale
      const sortedHist = [...crmHist].sort((a, b) => {
        const da = parseLeadDate(a.contact_date);
        const db2 = parseLeadDate(b.contact_date);
        if (da && db2) return db2.getTime() - da.getTime();
        return b.seq - a.seq;
      });
      // Find the boundary: most recent "Chia lead" for current sale
      let boundaryDate = null;
      for (const h of sortedHist) {
        if (h.action === "Chia lead" && h.sale_name === saleName) {
          boundaryDate = parseLeadDate(h.contact_date);
          break;
        }
      }
      let latestDate = null;
      let latestStatus = null;
      let latestRaw = null;
      for (const h of crmHist) {
        if (h.action === "Chia lead") continue;
        if (!h.status || !h.status.trim()) continue;
        // Only consider entries by current sale, AFTER the Chia lead boundary
        if (h.sale_name && h.sale_name !== saleName) continue;
        const d = parseLeadDate(h.contact_date);
        if (boundaryDate && d && d.getTime() < boundaryDate.getTime()) continue;
        if (d && (!latestDate || d.getTime() > latestDate.getTime())) {
          latestDate = d;
          latestStatus = normalizeStatus(h.status);
          latestRaw = h.status;
        }
      }
      if (latestStatus && latestStatus !== "new") {
        if (status !== latestStatus) {
          console.log(`[replaceProjectData] DATE-FIX: "${l.name}" status "${status}" → "${latestStatus}" (raw="${latestRaw}", date=${latestDate?.toISOString()}, sale=${saleName})`);
        }
        status = latestStatus;
        rawStatus = latestRaw;
      }
    }

    stmts.push({
      sql: `INSERT INTO leads(
        project_id, name, phone, ads_id, campaign, campaign_id, adset_name, ad_name, form_name,
        product, raw_status, status,
        created_at, inbox_url, is_hot, sale_id, sale_name, manager_name, source, budget, sync_at, notes, deal_value, is_locked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        projectId, l.name, l.phone, lAdsId || "", l.campaign, null,
        l.adsetName || "-", l.adName || "-", l.formName || "-",
        l.product, rawStatus, status, l.createdAt, l.inboxUrl, isHot, saleId, saleName, managerName,
        l.source, l.budget, l.syncAt, notes, dealValue, isLockedVal,
      ],
    });

    // Insert sheet history FIRST (lower seq) so CRM entries always have higher priority
    // crmHist already defined above for DATE-FIX
    let seqCounter = 0;
    if (l.saleHistory && l.saleHistory.length) {
      const crmHistEntries = crmHist || [];
      for (let si = 0; si < l.saleHistory.length; si++) {
        const sh = l.saleHistory[si];
        const isDup = crmHistEntries.some(h =>
          h.sale_name === sh.saleName && h.action === sh.action && h.contact_date === sh.date
        );
        if (!isDup) {
          stmts.push({
            sql: "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES((SELECT MAX(id) FROM leads), ?, ?, ?, ?, ?, ?, ?)",
            args: [sh.saleName, sh.action, sh.date, sh.status, sh.feedback, seqCounter, "sheet"],
          });
          seqCounter++;
        }
      }
    }

    // Then restore CRM history (higher seq = higher priority in post-sync fix)
    // IMPORTANT: crmHist is ordered by seq DESC (newest first) from the backup query,
    // so we must reverse it to restore correct chronological order (oldest = lowest seq)
    if (crmHist && crmHist.length) {
      const crmHistAsc = [...crmHist].reverse();
      for (let si = 0; si < crmHistAsc.length; si++) {
        const h = crmHistAsc[si];
        stmts.push({
          sql: "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES((SELECT MAX(id) FROM leads), ?, ?, ?, ?, ?, ?, ?)",
          args: [h.sale_name, h.action, h.contact_date, h.status, h.feedback, seqCounter + si, h.source || "crm"],
        });
      }
    }
  }

  // Detect truly new leads: use Tier 1-3 only (ads_id, phone+name, phone).
  // Tier 4 (name-only) is too broad — common names would suppress notifications.
  const newPhones = leads.filter(l => {
    const aid = (l.adsId || "").trim();
    const np = normPhone(l.phone);
    const nName = (l.name || "").trim().toLowerCase();
    const pnKey = np && nName ? `${np}||${nName}` : "";
    return !(aid && adsIdMap.has(aid)) && !(pnKey && phoneNameMap.has(pnKey)) && !(np && phoneMap.has(np));
  }).map(l => normPhone(l.phone));
  console.log(`[replaceProjectData] project=${projectId} stmts=${stmts.length} total=${leads.length} old=${existing.length} matchByAdsId=${matchByAdsId} matchByPhoneName=${matchByPhoneName} matchByPhone=${matchByPhone} matchByName=${matchByName} noMatch=${noMatch} newPhones=${newPhones.length}`);
  await db.batch(stmts, "write");
  console.log(`[replaceProjectData] batch done for project=${projectId}`);

  // Post-sync: re-sync lead statuses from history (use contact_date for correct ordering)
  try {
    const leadsInProject = await all(db, "SELECT id, status, name FROM leads WHERE project_id = ?", [projectId]);
    const allHistory = await all(db, `
      SELECT lead_id, action, status, seq, source, sale_name, contact_date
      FROM lead_history
      WHERE lead_id IN (SELECT id FROM leads WHERE project_id = ?)
      ORDER BY lead_id, seq DESC`, [projectId]);

    // Parse Vietnamese/ISO date string to Date object
    function parseContactDate(s) {
      if (!s) return null;
      // Format: dd/mm/yyyy hh:mm[:ss]
      const vn = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (vn) return new Date(+vn[3], +vn[2]-1, +vn[1], +vn[4], +vn[5], +(vn[6]||0));
      // Format: hh:mm:ss dd/mm/yyyy (Vietnamese locale output)
      const vn2 = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (vn2) return new Date(+vn2[6], +vn2[5]-1, +vn2[4], +vn2[1], +vn2[2], +(vn2[3]||0));
      const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return new Date(s);
      return null;
    }

    // Group history by lead_id
    const histByLead = new Map();
    for (const h of allHistory) {
      if (!histByLead.has(h.lead_id)) histByLead.set(h.lead_id, []);
      histByLead.get(h.lead_id).push(h);
    }

    const fixStmts = [];
    for (const lead of leadsInProject) {
      const entries = histByLead.get(lead.id) || [];
      let correctHistStatus = null;
      let foundSource = "";

      // Sort entries by contact_date DESC (most recent first), fallback to seq DESC
      // This fixes cases where seq order got corrupted during previous sync cycles
      entries.sort((a, b) => {
        const da = parseContactDate(a.contact_date);
        const db = parseContactDate(b.contact_date);
        if (da && db && da.getTime() !== db.getTime()) return db.getTime() - da.getTime();
        return b.seq - a.seq; // fallback to seq
      });

      // Debug: log all entries for leads with "minh" in name
      const isDebug = (lead.name || "").toLowerCase().includes("minh th");
      if (isDebug) {
        console.log(`[post-sync DEBUG] Lead#${lead.id} "${lead.name}" currentStatus="${lead.status}" entries=${entries.length}`);
        for (const e of entries) {
          console.log(`  seq=${e.seq} date="${e.contact_date}" action="${e.action}" status="${e.status}" source="${e.source}" sale="${e.sale_name}"`);
        }
      }

      // Walk from newest to oldest entry, STOP at "Chia lead" boundary
      for (const h of entries) {
        if (h.action === "Chia lead") break; // Stop at assignment boundary — don't use old sale's status
        if (h.status && h.status.trim()) {
          correctHistStatus = h.status;
          foundSource = h.source || "unknown";
          break;
        }
      }

      if (isDebug) {
        console.log(`  → found="${correctHistStatus}" norm="${correctHistStatus ? normalizeStatus(correctHistStatus) : 'N/A'}" leadStatus="${lead.status}" match=${correctHistStatus ? normalizeStatus(correctHistStatus) === lead.status : 'no-hist'}`);
      }

      if (correctHistStatus) {
        const correctStatus = normalizeStatus(correctHistStatus);
        if (correctStatus !== lead.status) {
          fixStmts.push({ sql: "UPDATE leads SET status = ?, raw_status = ? WHERE id = ?", args: [correctStatus, correctHistStatus, lead.id] });
          console.log(`[post-sync] FIX lead#${lead.id}: "${lead.status}" → "${correctStatus}" (raw="${correctHistStatus}", source=${foundSource})`);
        }
      }
    }
    if (fixStmts.length) {
      await db.batch(fixStmts, "write");
      console.log(`[replaceProjectData] Re-synced ${fixStmts.length}/${leadsInProject.length} lead statuses from history`);
    } else {
      console.log(`[replaceProjectData] Post-sync: all ${leadsInProject.length} lead statuses already correct`);
    }
  } catch (e) { console.error("[replaceProjectData] Post-sync status fix error:", e.message); }

  return { newPhones };
}

async function readData(db) {
  const leads = await all(db, "SELECT * FROM leads ORDER BY id ASC");

  const historyRows = await all(db, "SELECT * FROM lead_history ORDER BY lead_id, seq");
  const historyMap = {};
  for (const h of historyRows) {
    if (!historyMap[h.lead_id]) historyMap[h.lead_id] = [];
    // Backfill source for old records without source
    let source = h.source || "";
    if (!source) {
      const act = (h.action || "").toLowerCase();
      const fb = (h.feedback || "").toLowerCase();
      if (act.includes("telegram")) source = "telegram";
      else if (fb.includes("lịch chia tự động") || fb.includes("lich chia tu dong")) source = "schedule";
      else if (fb.includes("admin") || fb.includes("xáo lead")) source = "admin";
      else if (act.includes("cập nhật")) source = "admin";
      else source = "sheet";
    }
    historyMap[h.lead_id].push({ id: h.id, saleName: h.sale_name, action: h.action, date: h.contact_date, status: h.status, feedback: h.feedback, source });
  }
  // Sort each lead's history by date (oldest first) so last entry = newest
  for (const lid in historyMap) {
    historyMap[lid].sort((a, b) => {
      const da = parseLeadDate(a.date);
      const db2 = parseLeadDate(b.date);
      if (da && db2) return da - db2;
      if (da) return 1;
      if (db2) return -1;
      return 0;
    });
  }
  const campaigns = await all(db, "SELECT * FROM campaigns ORDER BY id ASC");
  const projectRows = await all(db, "SELECT * FROM projects ORDER BY id ASC");
  const projectMap = {};
  for (const p of projectRows) { projectMap[p.id] = p.name; }

  // Build phone-based registration map for re-registration detection
  const phoneRegMap = {};
  for (const l of leads) {
    const phone = (l.phone || "").replace(/[^0-9+]/g, "");
    if (!phone) continue;
    if (!phoneRegMap[phone]) phoneRegMap[phone] = [];
    phoneRegMap[phone].push({
      leadId: l.id,
      name: l.name,
      projectId: l.project_id,
      projectName: projectMap[l.project_id] || "-",
      campaign: l.campaign || "-",
      adsetName: l.adset_name || "-",
      adName: l.ad_name || "-",
      createdAt: l.created_at || "",
    });
  }
  // Sort each phone's registrations by date
  for (const phone in phoneRegMap) {
    phoneRegMap[phone].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  }

  return {
    leads: leads.map((l) => {
      const phone = (l.phone || "").replace(/[^0-9+]/g, "");
      const allRegs = phone ? (phoneRegMap[phone] || []) : [];
      const regIndex = allRegs.findIndex(r => r.leadId === l.id);
      return {
      id: l.id,
      projectId: l.project_id,
      name: l.name,
      phone: l.phone,
      campaign: l.campaign,
      campaignId: l.campaign_id,
      adsId: l.ads_id || "",
      adsetName: l.adset_name || "-",
      adName: l.ad_name || "-",
      formName: l.form_name || "-",
      product: l.product,
      rawStatus: l.raw_status,
      status: l.status,
      createdAt: l.created_at,
      inboxUrl: l.inbox_url,
      isHot: Boolean(l.is_hot),
      isLocked: Boolean(l.is_locked),
      saleId: l.sale_id,
      saleName: l.sale_name || "",
      managerName: l.manager_name || "",
      saleHistory: historyMap[l.id] || [],
      source: l.source,
      budget: l.budget,
      syncAt: l.sync_at,
      notes: l.notes,
      dealValue: l.deal_value || 0,
      regCount: allRegs.length,
      regIndex: regIndex >= 0 ? regIndex + 1 : 1,
      registrations: allRegs,
      };
    }),
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
      isLegacy: Boolean(p.is_legacy),
    })),
  };
}

async function syncProject(db, projectId) {
  const project = await get(db, "SELECT * FROM projects WHERE id = ?", [projectId]);
  if (!project) throw new Error("Project not found: " + projectId);

  // Skip legacy (old data) projects — they don't sync from sheets
  if (project.is_legacy) return;

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

  const { newPhones } = await replaceProjectData(db, projectId, mappedLeads, campaigns);
  await run(db, "UPDATE projects SET cost_data = ? WHERE id = ?", [
    JSON.stringify(projectCost),
    projectId,
  ]);

  // === Round-robin: assign manager_name to ALL unassigned leads ===
  try {
    const managers = await all(db,
      `SELECT DISTINCT u.id, u.display_name, u.telegram_id FROM users u
       JOIN user_projects up ON u.id = up.user_id
       WHERE up.project_id = ? AND u.role IN ('manager', 'admin')
       ORDER BY u.id ASC`, [projectId]);
    console.log(`[syncProject] project=${projectId} managers=[${managers.map(m => `${m.display_name}(id=${m.id})`).join(', ')}]`);

    if (managers.length === 0) {
      console.warn(`[syncProject] ⚠️ project=${projectId} has NO managers in user_projects! New leads will NOT be auto-assigned. Add managers via Quản lý tài khoản → Projects.`);
    }

    if (managers.length > 0) {
      // Step 1: Assign manager to all unassigned leads via round-robin
      const unassigned = await all(db,
        "SELECT id FROM leads WHERE project_id = ? AND (manager_name IS NULL OR manager_name = '') ORDER BY id ASC",
        [projectId]);
      if (unassigned.length > 0) {
        const projRow = await get(db, "SELECT mgr_assign_idx FROM projects WHERE id = ?", [projectId]);
        let idx = (projRow && projRow.mgr_assign_idx) || 0;
        const startIdx = idx;
        const stmts = [];
        for (let i = 0; i < unassigned.length; i++) {
          const mgr = managers[idx % managers.length];
          stmts.push({ sql: "UPDATE leads SET manager_name = ? WHERE id = ?", args: [mgr.display_name, unassigned[i].id] });
          idx++;
        }
        await db.batch(stmts, "write");
        await run(db, "UPDATE projects SET mgr_assign_idx = ? WHERE id = ?", [idx, projectId]);
        const sample = unassigned.slice(0, Math.min(6, unassigned.length));
        const sampleAssign = sample.map((u, i) => `lead#${u.id}->${managers[(startIdx + i) % managers.length].display_name}`);
        console.log(`[syncProject] project=${projectId} assigned ${unassigned.length} leads to ${managers.length} managers, idxBefore=${startIdx} idxAfter=${idx}, sample: [${sampleAssign.join(', ')}]`);
      }

      // Step 2: Apply manual manager overrides (bulletproof: survives any sync)
      try {
        const normPhone = (p) => (p || "").replace(/[\s.\-()]/g, "").trim();
        const overrides = await all(db, "SELECT norm_phone, manager_name FROM manager_overrides WHERE project_id = ?", [projectId]);
        if (overrides.length) {
          const leadsAfterSync = await all(db, "SELECT id, phone FROM leads WHERE project_id = ?", [projectId]);
          const oStmts = [];
          const cleanStmts = [];
          for (const o of overrides) {
            const matched = leadsAfterSync.find(l => normPhone(l.phone) === o.norm_phone);
            if (matched) {
              oStmts.push({ sql: "UPDATE leads SET manager_name = ? WHERE id = ?", args: [o.manager_name, matched.id] });
            } else {
              cleanStmts.push({ sql: "DELETE FROM manager_overrides WHERE norm_phone = ? AND project_id = ?", args: [o.norm_phone, projectId] });
            }
          }
          if (oStmts.length) {
            await db.batch(oStmts, "write");
            console.log(`[syncProject] project=${projectId} applied ${oStmts.length} manual manager overrides`);
          }
          if (cleanStmts.length) await db.batch(cleanStmts, "write");
        }
      } catch (oErr) {
        console.error(`[syncProject] Manager override error:`, oErr.message);
      }

      // Step 3: Notify managers about NEW leads via Telegram
      // Notify about NEW leads
      if (newPhones && newPhones.length > 0) {
        console.log(`[syncProject] 🔔 project=${projectId} newPhones=${newPhones.length}: [${newPhones.slice(0, 5).join(', ')}${newPhones.length > 5 ? '...' : ''}]`);
        const normPhone = normalizePhoneKey;
        const allLeads = await all(db, "SELECT * FROM leads WHERE project_id = ?", [projectId]);
        const newLeads = allLeads.filter(l => newPhones.includes(normPhone(l.phone)));
        console.log(`[syncProject] newLeads matched from DB: ${newLeads.length}`);

        if (newLeads.length > 0) {
          const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
          const projectRow = await get(db, "SELECT name FROM projects WHERE id = ?", [projectId]);
          const projectName = projectRow ? projectRow.name : "-";
          const activeBot = await getBotForProject(projectId);

          if (!activeBot || !activeBot.token) {
            console.warn(`[syncProject] ⚠️ project=${projectId} NO active Telegram bot! Skipping notification.`);
          } else {
            // Group new leads by their ACTUAL assigned manager_name (from DB)
            const mgrLeadMap = new Map();
            for (const lead of newLeads) {
              const mgr = managers.find(m => m.display_name === lead.manager_name);
              if (!mgr) {
                console.warn(`[syncProject] ⚠️ Lead "${lead.name}" manager_name="${lead.manager_name}" not matched to any manager`);
                continue;
              }
              if (!mgrLeadMap.has(mgr.id)) mgrLeadMap.set(mgr.id, { mgr, leads: [] });
              mgrLeadMap.get(mgr.id).leads.push(lead);
            }
            for (const { mgr, leads: mgrNewLeads } of mgrLeadMap.values()) {
              if (!mgr.telegram_id) {
                console.warn(`[syncProject] ⚠️ Manager "${mgr.display_name}" has NO telegram_id, skip notify`);
                continue;
              }
              const leadLines = mgrNewLeads.map((l, i) => {
                const prod = l.product && l.product !== "-" ? ` - ${escMd(l.product)}` : "";
                return `${i + 1}. 👤 *${escMd(l.name || "N/A")}* - 📞 \`${l.phone || "-"}\`` + prod;
              }).join("\n");
              const msg = [
                `🚨 *CÓ ${mgrNewLeads.length} LEAD MỚI*`,
                `📋 Dự án: *${escMd(projectName)}*`,
                `🕒 ${now}`,
                `----------------------------------------------`,
                leadLines,
                `----------------------------------------------`,
                `⚡ Vui lòng vào CRM chia lead cho Sale ngay!`,
              ].join("\n");
              try {
                const tgRes = await fetch(`https://api.telegram.org/bot${activeBot.token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: mgr.telegram_id, text: msg, parse_mode: "Markdown" }),
                });
                const tgData = await tgRes.json();
                if (tgData.ok) {
                  console.log(`[syncProject] ✅ Telegram sent to ${mgr.display_name} (chat_id=${mgr.telegram_id}): ${mgrNewLeads.length} leads`);
                } else {
                  console.error(`[syncProject] ❌ Telegram API error for ${mgr.display_name}: ${JSON.stringify(tgData)}`);
                }
              } catch (tErr) {
                console.error(`[sync] Telegram notify manager ${mgr.display_name} failed:`, tErr.message);
              }
            }
          }
        }
      }
    }
  } catch (notifyErr) {
    console.error(`[syncProject] Manager assign/notify error for project ${projectId}:`, notifyErr.message);
  }

}

async function syncAllProjects(db) {
  syncInProgress = true;
  try {
  const projects = await all(db, "SELECT * FROM projects ORDER BY id ASC");
  const errors = [];
  // Sync all projects in parallel for speed
  await Promise.allSettled(projects.map(async (p) => {
    try {
      await syncProject(db, p.id);
    } catch (e) {
      console.error("Sync project", p.id, "failed:", e.message, e.stack);
      errors.push(`${p.name}: ${e.message}`);
    }
  }));
  if (errors.length) console.error("Sync errors:", errors);
  const lastSync = new Date().toISOString();
  await upsertSetting(db, "lastSync", lastSync);
  // Update global hash so poll clients detect the change
  try {
    const lc = await get(db, "SELECT COUNT(*) as c FROM leads");
    const lastLead = await get(db, "SELECT id FROM leads ORDER BY id DESC LIMIT 1");
    const hashSrc = `${lc?.c || 0}|${lastLead?.id || 0}|${lastSync}`;
    lastSyncHash = crypto.createHash("md5").update(hashSrc).digest("hex").slice(0, 12);
  } catch {}
  emitDataChanged("sync");
  return { lastSync, syncErrors: errors };
  } finally {
    syncInProgress = false;
  }
}

const app = express();

// --- Security headers ---
app.set("trust proxy", 1); // behind Nginx reverse proxy
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(ALLOWED_ORIGINS.length > 0 ? { origin: ALLOWED_ORIGINS, credentials: true } : undefined));
app.use(express.json({ limit: "10mb" }));

// Rate limiters
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: { error: "Quá nhiều lần đăng nhập. Vui lòng thử lại sau 15 phút." }, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false });
app.use("/api/", apiLimiter);

// --- Serve static build ---
const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Version endpoint — no auth required, used to verify deployment
app.get("/api/version", (req, res) => {
  res.json({ version: BUILD_VERSION, uptime: process.uptime(), pid: process.pid });
});

// Debug endpoint — check manager distribution in DB (no auth for easy testing)
app.get("/api/debug/managers", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "DB not ready" });
    const projectId = Number(req.query.projectId) || 1;
    
    // Get manager distribution
    const mgrDist = await all(db, 
      `SELECT manager_name, COUNT(*) as cnt FROM leads WHERE project_id = ? GROUP BY manager_name ORDER BY cnt DESC`,
      [projectId]
    );
    
    // Get sample leads for specific phone (if provided)
    const phone = req.query.phone || "";
    let phoneSamples = [];
    if (phone) {
      phoneSamples = await all(db,
        `SELECT id, name, phone, manager_name, status, created_at FROM leads WHERE project_id = ? AND phone LIKE ? ORDER BY id DESC LIMIT 10`,
        [projectId, `%${phone}%`]
      );
    }
    
    // Get sample leads for specific name (if provided)
    const name = req.query.name || "";
    let nameSamples = [];
    if (name) {
      nameSamples = await all(db,
        `SELECT id, name, phone, manager_name, status, created_at FROM leads WHERE project_id = ? AND LOWER(name) LIKE LOWER(?) ORDER BY id DESC LIMIT 10`,
        [projectId, `%${name}%`]
      );
    }
    
    // Get recently updated leads (if any have non-default manager)
    const recentNonDefault = await all(db,
      `SELECT id, name, phone, manager_name, status FROM leads 
       WHERE project_id = ? AND manager_name != '' AND manager_name != 'Trần Văn Quyết' 
       ORDER BY id DESC LIMIT 20`,
      [projectId]
    );
    
    res.json({
      projectId,
      totalLeads: mgrDist.reduce((s, r) => s + r.cnt, 0),
      managerDistribution: mgrDist,
      recentNonDefaultManagers: recentNonDefault,
      phoneSamples,
      nameSamples,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
  if (!db) return res.status(503).json({ error: "Database not ready", dbError: dbInitError });
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
app.post("/api/login", loginLimiter, async (req, res) => {
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

/* ---------- Pending leads for sale users (not updated in 2+ days) ---------- */
app.get("/api/pending-leads", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "sale") return res.json({ pendingLeads: [], totalPending: 0 });
    const displayName = req.user.displayName;
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Get all leads assigned to this sale (not locked statuses)
    const leads = await all(db,
      `SELECT l.id, l.name, l.phone, l.status, l.project_id FROM leads l
       WHERE (l.sale_name = ? OR l.sale_name = ?)
         AND l.status NOT IN ('booked','booking_other','closed','not_interested','spam','wrong_number','blocked','lost','cancelled_deposit')
       ORDER BY l.id`,
      [displayName, displayName.toLowerCase()]
    );

    const pending = [];
    for (const lead of leads) {
      // Find last non-"Chia lead" history entry from this sale
      const lastUpdate = await get(db,
        `SELECT contact_date, status, feedback, action FROM lead_history
         WHERE lead_id = ? AND sale_name = ? AND action != 'Chia lead'
         ORDER BY seq DESC LIMIT 1`,
        [lead.id, displayName]
      );

      let daysSinceUpdate = null;
      if (!lastUpdate) {
        // Never updated — check "Chia lead" date as fallback
        const chiaEntry = await get(db,
          `SELECT contact_date FROM lead_history WHERE lead_id = ? AND sale_name = ? AND action = 'Chia lead' ORDER BY seq DESC LIMIT 1`,
          [lead.id, displayName]
        );
        if (chiaEntry) {
          const d = parseLeadDate(chiaEntry.contact_date);
          if (d) daysSinceUpdate = Math.floor((now - d.getTime()) / (24*60*60*1000));
        }
        if (daysSinceUpdate === null || daysSinceUpdate < 2) continue;
        const proj = await get(db, "SELECT name FROM projects WHERE id = ?", [lead.project_id]);
        pending.push({ id: lead.id, name: lead.name, phone: lead.phone, status: lead.status, projectName: proj?.name || "-", daysSinceUpdate, lastFeedback: null });
      } else {
        const d = parseLeadDate(lastUpdate.contact_date);
        if (!d) continue;
        daysSinceUpdate = Math.floor((now - d.getTime()) / (24*60*60*1000));
        if (daysSinceUpdate < 2) continue;
        const proj = await get(db, "SELECT name FROM projects WHERE id = ?", [lead.project_id]);
        pending.push({ id: lead.id, name: lead.name, phone: lead.phone, status: lead.status, projectName: proj?.name || "-", daysSinceUpdate, lastFeedback: lastUpdate.feedback || lastUpdate.status || null, lastDate: lastUpdate.contact_date });
      }
    }

    res.json({ pendingLeads: pending.slice(0, 50), totalPending: pending.length });
  } catch (err) {
    console.error("[pending-leads] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ---------- User management (admin only) ---------- */
const mapUser = (u, projectIds, hotLeadProjectIds) => ({ id: u.id, username: u.username, role: u.role, displayName: u.display_name, telegramId: u.telegram_id || "", avatarUrl: u.avatar_url || "", email: u.email || "", phone: u.phone || "", mustChangePassword: !!u.must_change_password, lastActive: u.last_active || "", createdAt: u.created_at, projectIds: projectIds || [], hotLeadProjectIds: hotLeadProjectIds || [] });
const selectUsers = () => all(db, "SELECT id, username, role, display_name, telegram_id, avatar_url, email, phone, must_change_password, last_active, created_at FROM users ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END, id");
const getUserProjectIds = async (userId) => {
  const rows = await all(db, "SELECT project_id FROM user_projects WHERE user_id = ? ORDER BY project_id", [userId]);
  return rows.map(r => r.project_id);
};
const getAllUserProjects = async () => {
  const rows = await all(db, "SELECT user_id, project_id, hot_lead FROM user_projects ORDER BY user_id, project_id");
  const map = {};
  const hotMap = {};
  for (const r of rows) {
    if (!map[r.user_id]) map[r.user_id] = [];
    map[r.user_id].push(r.project_id);
    if (r.hot_lead) {
      if (!hotMap[r.user_id]) hotMap[r.user_id] = [];
      hotMap[r.user_id].push(r.project_id);
    }
  }
  return { map, hotMap };
};
const mapUsersWithProjects = async (users) => {
  const { map: upMap, hotMap } = await getAllUserProjects();
  return users.map(u => mapUser(u, upMap[u.id] || [], hotMap[u.id] || []));
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
      const hotPids = new Set((req.body.hotLeadProjectIds || []).map(Number));
      for (const pid of req.body.projectIds) {
        await run(db, "INSERT OR IGNORE INTO user_projects(user_id, project_id, hot_lead) VALUES(?, ?, ?)", [result.lastID, Number(pid), hotPids.has(Number(pid)) ? 1 : 0]);
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
      // Get old project IDs before update to detect removed projects
      const oldProjects = await all(db, "SELECT project_id FROM user_projects WHERE user_id = ?", [id]);
      const oldPids = oldProjects.map(r => r.project_id);
      const newPids = req.body.projectIds.map(Number);

      await run(db, "DELETE FROM user_projects WHERE user_id = ?", [id]);
      const hotPids = new Set((req.body.hotLeadProjectIds || []).map(Number));
      for (const pid of req.body.projectIds) {
        await run(db, "INSERT OR IGNORE INTO user_projects(user_id, project_id, hot_lead) VALUES(?, ?, ?)", [id, Number(pid), hotPids.has(Number(pid)) ? 1 : 0]);
      }

      // Find removed projects and sync active schedules
      const removedPids = oldPids.filter(p => !newPids.includes(p));
      if (removedPids.length) {
        await syncSchedulesAfterProjectChange(db, id, removedPids);
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

/* ---------- Bulk create sale accounts from a list of names ---------- */
app.post("/api/users/bulk-create-sales", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { names } = req.body;
    if (!names || !Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: "Danh sách tên không hợp lệ" });
    }
    if (names.length > 200) {
      return res.status(400).json({ error: "Tối đa 200 tài khoản mỗi lần" });
    }

    const existingUsers = await all(db, "SELECT username, display_name FROM users");
    const existingDisplayNames = new Set(existingUsers.map(u => foldText(u.display_name)));
    const existingUsernames = new Set(existingUsers.map(u => u.username));

    let created = 0;
    const createdList = [];
    const skippedList = [];

    for (const rawName of names) {
      const saleName = String(rawName).trim();
      if (!saleName) continue;

      if (existingDisplayNames.has(foldText(saleName))) {
        skippedList.push({ name: saleName, reason: "Đã tồn tại" });
        continue;
      }

      const words = saleName.split(/\s+/).filter(Boolean);
      if (words.length < 2) {
        skippedList.push({ name: saleName, reason: "Tên phải có ít nhất 2 từ" });
        continue;
      }

      const lastTwo = words.slice(-2).map(w =>
        w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase()
      ).join("");

      let username = lastTwo;
      if (existingUsernames.has(username)) {
        let suffix = 2;
        while (existingUsernames.has(username + suffix)) suffix++;
        username = username + suffix;
      }

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
    res.json({ created, createdList, skippedList, users: await mapUsersWithProjects(users) });
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
const mapBot = b => {
  let projectIds = [];
  if (b.project_id) {
    try {
      const parsed = JSON.parse(b.project_id);
      projectIds = Array.isArray(parsed) ? parsed : [Number(parsed)].filter(Boolean);
    } catch { projectIds = [Number(b.project_id)].filter(Boolean); }
  }
  return { id: b.id, name: b.name, token: b.token, isActive: !!b.is_active, projectIds, groupChatId: b.group_chat_id || "", createdAt: b.created_at };
};

// Helper: get bot token for a lead's project (fallback to any active bot)
async function getBotForProject(projectId) {
  if (projectId) {
    const bots = await all(db, "SELECT token, project_id FROM telegram_bots WHERE is_active = 1");
    for (const bot of bots) {
      if (!bot.project_id) continue;
      let ids = [];
      try {
        const parsed = JSON.parse(bot.project_id);
        ids = Array.isArray(parsed) ? parsed : [Number(parsed)].filter(Boolean);
      } catch { ids = [Number(bot.project_id)].filter(Boolean); }
      if (ids.includes(projectId)) return bot;
    }
  }
  return await get(db, "SELECT token FROM telegram_bots WHERE is_active = 1 LIMIT 1");
}

app.get("/api/telegram-bots", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const bots = await all(db, "SELECT * FROM telegram_bots ORDER BY id");
    res.json(bots.map(mapBot));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/telegram-bots", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const { name, token, projectIds } = req.body;
    if (!name || !token) return res.status(400).json({ error: "Tên bot và token bắt buộc" });
    const pids = Array.isArray(projectIds) && projectIds.length > 0 ? JSON.stringify(projectIds) : null;
    await run(db, "INSERT INTO telegram_bots(name, token, project_id) VALUES(?, ?, ?)", [String(name).trim(), String(token).trim(), pids]);
    const bots = await all(db, "SELECT * FROM telegram_bots ORDER BY id");
    res.json(bots.map(mapBot));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/telegram-bots/:id", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, token, isActive, projectIds, groupChatId } = req.body;
    if (name !== undefined) await run(db, "UPDATE telegram_bots SET name = ? WHERE id = ?", [String(name).trim(), id]);
    if (token !== undefined) await run(db, "UPDATE telegram_bots SET token = ? WHERE id = ?", [String(token).trim(), id]);
    if (isActive !== undefined) await run(db, "UPDATE telegram_bots SET is_active = ? WHERE id = ?", [isActive ? 1 : 0, id]);
    if (groupChatId !== undefined) await run(db, "UPDATE telegram_bots SET group_chat_id = ? WHERE id = ?", [String(groupChatId).trim(), id]);
    if (projectIds !== undefined) {
      const pids = Array.isArray(projectIds) && projectIds.length > 0 ? JSON.stringify(projectIds) : null;
      await run(db, "UPDATE telegram_bots SET project_id = ? WHERE id = ?", [pids, id]);
    }
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

/* ---------- Auto-assign bots to projects by name matching ---------- */
app.post("/api/telegram-bots/auto-assign", requireAuth, requireAdminOnly, async (_req, res) => {
  try {
    const bots = await all(db, "SELECT id, name FROM telegram_bots WHERE project_id IS NULL");
    const projects = await all(db, "SELECT id, name FROM projects");
    if (!bots.length) return res.json({ msg: "Tất cả bot đã được gắn dự án", assigned: 0 });

    let assigned = 0;
    for (const bot of bots) {
      const botNameLower = bot.name.toLowerCase();
      // Find project whose name is contained in bot name or vice versa
      const match = projects.find(p => {
        const pLower = p.name.toLowerCase();
        return botNameLower.includes(pLower) || pLower.includes(botNameLower);
      });
      if (match) {
        await run(db, "UPDATE telegram_bots SET project_id = ? WHERE id = ?", [JSON.stringify([match.id]), bot.id]);
        assigned++;
      }
    }
    const allBots = await all(db, "SELECT * FROM telegram_bots ORDER BY id");
    res.json({ msg: `Đã gắn ${assigned}/${bots.length} bot vào dự án`, assigned, bots: allBots.map(mapBot) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ---------- Get users who chatted with a specific bot ---------- */
app.get("/api/telegram-bots/:id/chat-users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const botId = Number(req.params.id);
    const bot = await get(db, "SELECT * FROM telegram_bots WHERE id = ?", [botId]);
    if (!bot) return res.status(404).json({ error: "Bot không tồn tại" });

    // 1. Try fetching fresh data from Telegram and save to DB
    let newFromTg = 0;
    try {
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const tgRes = await fetch(`https://api.telegram.org/bot${bot.token}/getUpdates?offset=${offset}&limit=100`);
        const tgData = await tgRes.json();
        if (!tgData.ok) break;
        const results = tgData.result || [];
        if (results.length === 0) { hasMore = false; break; }

        for (const update of results) {
          const sources = [
            update.message?.from,
            update.callback_query?.from,
            update.edited_message?.from,
            update.channel_post?.from,
          ].filter(Boolean);

          for (const from of sources) {
            if (from.is_bot) continue;
            const tgId = String(from.id);
            const firstName = from.first_name || "";
            const lastName = from.last_name || "";
            const uname = from.username || "";
            const fullName = [firstName, lastName].filter(Boolean).join(" ");
            try {
              await run(db,
                `INSERT INTO telegram_chat_users(bot_id, telegram_id, first_name, last_name, username, full_name)
                 VALUES(?, ?, ?, ?, ?, ?)
                 ON CONFLICT(bot_id, telegram_id) DO UPDATE SET
                   first_name = excluded.first_name,
                   last_name = excluded.last_name,
                   username = excluded.username,
                   full_name = excluded.full_name`,
                [botId, tgId, firstName, lastName, uname, fullName]
              );
              newFromTg++;
            } catch (_) {}
          }
        }
        offset = results[results.length - 1].update_id + 1;
      }
    } catch (_) { /* Telegram fetch failed, fall back to DB only */ }

    // 2. Always return full list from DB
    const dbUsers = await all(db, "SELECT telegram_id, first_name, last_name, username, full_name FROM telegram_chat_users WHERE bot_id = ? ORDER BY full_name", [botId]);
    const users = dbUsers.map(u => ({
      telegramId: u.telegram_id,
      firstName: u.first_name,
      lastName: u.last_name,
      username: u.username,
      fullName: u.full_name,
    }));

    res.json({ botName: bot.name, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// ========== LEAD QUALITY REPORT ==========
app.get("/api/lead-report", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { projectId, startDate, endDate } = req.query;
    if (!projectId) return res.status(400).json({ error: "Thiếu projectId" });

    // Manager: check access
    if (req.user.role === "manager") {
      const pids = await getUserProjectIds(req.user.userId);
      if (!pids.includes(Number(projectId))) return res.status(403).json({ error: "Không có quyền" });
    }

    // Fetch ALL leads then filter in JS (created_at is dd/mm/yyyy from Sheets, can't compare in SQL)
    const allLeads = await all(db, "SELECT * FROM leads WHERE project_id = ?", [Number(projectId)]);

    const sdTime = startDate ? new Date(startDate + "T00:00:00").getTime() : null;
    const edTime = endDate ? new Date(endDate + "T23:59:59").getTime() : null;

    const leads = allLeads.filter(l => {
      const dt = parseLeadDate(l.created_at);
      if (!dt) return false;
      const t = dt.getTime();
      if (sdTime && t < sdTime) return false;
      if (edTime && t > edTime) return false;
      return true;
    });

    // Groupings based on user's requirement
    const interested = leads.filter(l => ["interested", "low_interest", "appointment"].includes(l.status));
    const notInterested = leads.filter(l => ["not_interested", "spam", "sale", "callback"].includes(l.status));
    const noFeedback = leads.filter(l => l.status === "new" || !l.status);
    const booked = leads.filter(l => ["booked", "booking_other", "closed"].includes(l.status));
    const other = leads.filter(l => !["interested", "low_interest", "appointment", "not_interested", "spam", "sale", "callback", "new", "booked", "booking_other", "closed", null, undefined, ""].includes(l.status));

    const total = leads.length;
    const pct = (n) => total > 0 ? Number(((n / total) * 100).toFixed(1)) : 0;

    // Cost: fetch cost sheet CSV directly and sum by selected date range
    const project = await get(db, "SELECT name, cost_url, cost_data FROM projects WHERE id = ?", [Number(projectId)]);

    let totalSpent = 0;
    if (project && project.cost_url) {
      try {
        const rawCost = await fetchCsvText(project.cost_url);
        const { rawHeaders: costRH, rawRows: costRR } = parseCSV(rawCost);
        const foldedH = costRH.map(h => foldText(h));
        let dateIdx = -1, spentIdx = -1;
        for (let i = 0; i < foldedH.length; i++) {
          if (dateIdx < 0 && foldedH[i] === "ngay") dateIdx = i;
          if (spentIdx < 0 && foldedH[i].includes("tong tien chi tieu")) spentIdx = i;
        }
        for (const cols of costRR) {
          const dateVal = dateIdx >= 0 ? (cols[dateIdx] || "").trim() : "";
          const dm = dateVal.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (!dm) continue;
          const isoDate = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
          if (startDate && isoDate < startDate) continue;
          if (endDate && isoDate > endDate) continue;
          totalSpent += parseVnNumber(spentIdx >= 0 ? cols[spentIdx] : "");
        }
      } catch (e) {
        // Fallback to stored cost_data
        const costData = project ? JSON.parse(project.cost_data || "{}") : {};
        totalSpent = costData.totalSpent || 0;
      }
    }

    const cpLead = total > 0 ? Math.round(totalSpent / total) : 0;

    res.json({
      projectName: project?.name || "",
      startDate: startDate || null,
      endDate: endDate || null,
      total,
      groups: {
        interested: { count: interested.length, pct: pct(interested.length), label: "Quan tâm (Quan tâm + QT hời hợt + Hẹn xem)" },
        notInterested: { count: notInterested.length, pct: pct(notInterested.length), label: "Không quan tâm (Bấm nhầm/Rác/Sale/Gọi lại KQT)" },
        noFeedback: { count: noFeedback.length, pct: pct(noFeedback.length), label: "Chưa nhập feedback (Mới)" },
        booked: { count: booked.length, pct: pct(booked.length), label: "Booking/Cọc/Chốt" },
        other: { count: other.length, pct: pct(other.length), label: "Trạng thái khác (thuê bao, tài chính yếu, trùng sale, chưa liên lạc...)" },
      },
      totalSpent,
      cpLead,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ---------- Public health ---------- */
app.get("/api/health", async (_req, res) => {
  let counts = {};
  try {
    const lc = await get(db, "SELECT COUNT(*) as c FROM leads");
    const uc = await get(db, "SELECT COUNT(*) as c FROM users");
    const pc = await get(db, "SELECT COUNT(*) as c FROM projects");
    const hc = await get(db, "SELECT COUNT(*) as c FROM lead_history");
    counts = { leads: lc?.c || 0, users: uc?.c || 0, projects: pc?.c || 0, history: hc?.c || 0 };
  } catch (e) { counts = { error: e.message }; }
  res.json({
    ok: !dbInitError,
    dbReady: !!db,
    dbError: dbInitError,
    dbType: process.env.TURSO_URL ? 'turso' : 'sqlite-local',
    tursoConfigured: !!process.env.TURSO_URL,
    nodeVersion: process.version,
    build: "2026-03-19-v8",
    counts,
  });
});

// Debug endpoint: check managers linked to a project
app.get("/api/debug/project-managers/:projectId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const managers = await all(db,
      `SELECT DISTINCT u.id, u.display_name, u.role, u.username FROM users u
       JOIN user_projects up ON u.id = up.user_id
       WHERE up.project_id = ? AND u.role IN ('manager', 'admin')
       ORDER BY u.id ASC`, [projectId]);
    const projRow = await get(db, "SELECT id, name, mgr_assign_idx FROM projects WHERE id = ?", [projectId]);
    const leadCounts = await all(db,
      `SELECT manager_name, COUNT(*) as cnt FROM leads WHERE project_id = ? GROUP BY manager_name ORDER BY cnt DESC`, [projectId]);
    res.json({ project: projRow, managers, leadCounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: redistribute ALL leads of a project evenly across all managers (round-robin reset)
app.post("/api/admin/redistribute-managers/:projectId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const managers = await all(db,
      `SELECT DISTINCT u.id, u.display_name FROM users u
       JOIN user_projects up ON u.id = up.user_id
       WHERE up.project_id = ? AND u.role IN ('manager', 'admin')
       ORDER BY u.id ASC`, [projectId]);
    if (managers.length === 0) return res.status(400).json({ error: "Không có quản lý nào được gán cho dự án này" });

    const allLeads = await all(db, "SELECT id, phone FROM leads WHERE project_id = ? ORDER BY id ASC", [projectId]);
    if (allLeads.length === 0) return res.status(400).json({ error: "Dự án chưa có lead nào" });

    const stmts = [];
    for (let i = 0; i < allLeads.length; i++) {
      const mgr = managers[i % managers.length];
      stmts.push({ sql: "UPDATE leads SET manager_name = ? WHERE id = ?", args: [mgr.display_name, allLeads[i].id] });
    }
    await db.batch(stmts, "write");
    // Save mgr_assign_idx atomically
    await run(db, "UPDATE projects SET mgr_assign_idx = ? WHERE id = ?", [allLeads.length, projectId]);
    // Invalidate sync hash so clients pick up changes
    lastSyncHash = "";
    emitDataChanged("redistribute");

    // Count distribution
    const dist = {};
    for (let i = 0; i < allLeads.length; i++) {
      const name = managers[i % managers.length].display_name;
      dist[name] = (dist[name] || 0) + 1;
    }
    console.log(`[redistribute] project=${projectId} total=${allLeads.length} managers=${managers.length} distribution:`, dist);
    res.json({ success: true, total: allLeads.length, managers: managers.length, distribution: dist });
  } catch (err) {
    console.error("[redistribute] error:", err.message);
    res.status(500).json({ error: err.message });
  }
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
    // Wait for any running sync to finish to avoid reading inconsistent data
    if (syncInProgress) {
      const t0 = Date.now();
      while (syncInProgress && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 200));
    }
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
    // Include hash so client can track changes
    if (!lastSyncHash) {
      try {
        const lc = await get(db, "SELECT COUNT(*) as c FROM leads");
        const lastLead = await get(db, "SELECT id FROM leads ORDER BY id DESC LIMIT 1");
        const lastSync2 = (await get(db, "SELECT value FROM settings WHERE key = 'lastSync'"))?.value || "";
        const hashSrc = `${lc?.c || 0}|${lastLead?.id || 0}|${lastSync2}`;
        lastSyncHash = crypto.createHash("md5").update(hashSrc).digest("hex").slice(0, 12);
      } catch {}
    }
    // Include per-project auto-rotate status
    const autoRotateRows = await all(db, "SELECT key, value FROM settings WHERE key LIKE 'auto_rotate_project_%'");
    const autoRotateProjects = {};
    for (const r of autoRotateRows) {
      const pid = r.key.replace('auto_rotate_project_', '');
      autoRotateProjects[pid] = r.value === "1";
    }
    // Include per-project sprint-rotate status
    const sprintRows = await all(db, "SELECT key, value FROM settings WHERE key LIKE 'sprint_rotate_project_%'");
    const sprintRotateProjects = {};
    for (const r of sprintRows) {
      const pid = r.key.replace('sprint_rotate_project_', '');
      sprintRotateProjects[pid] = r.value === "1";
    }
    res.json({ ...config, ...data, schedules, hash: lastSyncHash, autoRotateProjects, sprintRotateProjects });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not read data" });
  }
});

// Global sync hash — updated after each sync
let lastSyncHash = "";
let syncInProgress = false; // Lock to prevent PUT/sync race condition

// Helper: notify all connected clients that data changed
function emitDataChanged(reason) {
  if (io) {
    io.emit("data-changed", { reason, ts: Date.now() });
  }
}

// Lightweight poll endpoint — returns hash only (no DB query if hash unchanged)
app.get("/api/data/poll", requireAuth, async (req, res) => {
  const clientHash = req.query.hash || "";
  // If no hash computed yet, compute it now
  if (!lastSyncHash) {
    try {
      const lc = await get(db, "SELECT COUNT(*) as c FROM leads");
      const lastLead = await get(db, "SELECT id FROM leads ORDER BY id DESC LIMIT 1");
      const lastSync = (await get(db, "SELECT value FROM settings WHERE key = 'lastSync'"))?.value || "";
      const hashSrc = `${lc?.c || 0}|${lastLead?.id || 0}|${lastSync}`;
      lastSyncHash = crypto.createHash("md5").update(hashSrc).digest("hex").slice(0, 12);
    } catch { lastSyncHash = "init"; }
  }
  res.json({ hash: lastSyncHash, changed: clientHash !== lastSyncHash });
});

/* ===== Recovery: Restore sale assignments + status from lead_history ===== */
app.post("/api/recover-sales", requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log("[recover-sales] Starting recovery...");
    const projectId = Number(req.body?.projectId) || 0;
    const whereClause = projectId ? "WHERE l.project_id = ?" : "";
    const whereArgs = projectId ? [projectId] : [];

    // Find leads that have no sale assigned but DO have "Chia lead" history
    const leads = await all(db,
      `SELECT l.id, l.name, l.phone, l.sale_name, l.status, l.project_id FROM leads l ${whereClause}`,
      whereArgs
    );

    let fixedSale = 0;
    let fixedStatus = 0;
    const details = [];

    for (const lead of leads) {
      let changed = false;
      let newSale = lead.sale_name;
      let newStatus = lead.status;

      // 1. Restore sale_name from latest "Chia lead" history entry
      if (!lead.sale_name || lead.sale_name === "Chưa chia") {
        const chiaLead = await get(db,
          "SELECT sale_name FROM lead_history WHERE lead_id = ? AND action = 'Chia lead' ORDER BY seq DESC LIMIT 1",
          [lead.id]
        );
        if (chiaLead && chiaLead.sale_name) {
          newSale = chiaLead.sale_name;
          changed = true;
          fixedSale++;
        }
      }

      // 2. Restore status from latest history entry with non-empty status
      const latestHist = await get(db,
        "SELECT status FROM lead_history WHERE lead_id = ? AND status != '' ORDER BY seq DESC LIMIT 1",
        [lead.id]
      );
      if (latestHist && latestHist.status) {
        const histStatus = normalizeStatus(latestHist.status);
        if (histStatus !== lead.status) {
          newStatus = histStatus;
          changed = true;
          fixedStatus++;
        }
      }

      if (changed) {
        await run(db, "UPDATE leads SET sale_name = ?, status = ? WHERE id = ?",
          [newSale, newStatus, lead.id]);
        details.push({ id: lead.id, name: lead.name, phone: lead.phone, oldSale: lead.sale_name, newSale, oldStatus: lead.status, newStatus });
      }
    }

    lastSyncHash = "";
    emitDataChanged("recover-sales");
    console.log(`[recover-sales] Done: ${fixedSale} sales restored, ${fixedStatus} statuses fixed out of ${leads.length} leads`);
    res.json({ total: leads.length, fixedSale, fixedStatus, details });
  } catch (err) {
    console.error("[recover-sales] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Recover from backup saved in settings table (created automatically before each sync)
app.post("/api/recover-from-backup", requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log("[recover-from-backup] Starting backup recovery...");
    const projectId = Number(req.body?.projectId) || 0;

    // Find all backup keys
    const backupRows = projectId
      ? [await get(db, "SELECT key, value FROM settings WHERE key = ?", [`backup_project_${projectId}`])]
      : await all(db, "SELECT key, value FROM settings WHERE key LIKE 'backup_project_%'");

    const validBackups = backupRows.filter(Boolean);
    if (!validBackups.length) {
      return res.json({ error: "Không tìm thấy bản backup nào", total: 0, fixedSale: 0, fixedStatus: 0, fixedHistory: 0 });
    }

    let fixedSale = 0, fixedStatus = 0, fixedHistory = 0, totalLeads = 0;

    for (const row of validBackups) {
      const backup = JSON.parse(row.value);
      console.log(`[recover-from-backup] Found backup from ${backup.ts}: ${backup.leads?.length || 0} sale assignments, ${backup.history?.length || 0} history entries`);

      // Build phone → backup lead map for matching
      const phoneMap = new Map();
      for (const bl of (backup.leads || [])) {
        const key = normalizePhoneKey(bl.phone);
        if (key) phoneMap.set(key, bl);
      }

      // Get current leads
      const currentLeads = await all(db,
        "SELECT id, name, phone, sale_name, status FROM leads WHERE project_id = ?",
        [backup.projectId]
      );
      totalLeads += currentLeads.length;

      // Match by phone and restore sale_name + status
      for (const cl of currentLeads) {
        const key = normalizePhoneKey(cl.phone);
        const bl = phoneMap.get(key);
        if (!bl) continue;

        let changed = false;
        let newSale = cl.sale_name;
        let newStatus = cl.status;

        if ((!cl.sale_name || cl.sale_name === "Chưa chia") && bl.sale_name && bl.sale_name !== "Chưa chia") {
          newSale = bl.sale_name;
          changed = true;
          fixedSale++;
        }

        if ((!cl.status || cl.status === "new") && bl.status && bl.status !== "new") {
          newStatus = bl.status;
          changed = true;
          fixedStatus++;
        }

        if (changed) {
          await run(db, "UPDATE leads SET sale_name = ?, status = ? WHERE id = ?",
            [newSale, newStatus, cl.id]);
        }
      }

      // Restore history entries
      const phoneToNewId = new Map();
      for (const cl of currentLeads) {
        const key = normalizePhoneKey(cl.phone);
        if (key) phoneToNewId.set(key, cl.id);
      }

      for (const h of (backup.history || [])) {
        const key = normalizePhoneKey(h.phone);
        const newLeadId = phoneToNewId.get(key);
        if (!newLeadId) continue;

        const hAction = h.action ?? "";
        const hCreatedAt = h.created_at ?? "";
        if (!hAction) continue;

        // Check if this history entry already exists (avoid duplicates)
        const exists = await get(db,
          "SELECT 1 FROM lead_history WHERE lead_id = ? AND action = ? AND created_at = ?",
          [newLeadId, hAction, hCreatedAt]
        );
        if (exists) continue;

        await run(db,
          `INSERT INTO lead_history(lead_id, action, status, sale_name, feedback, contact_date, note, source, user_name, created_at)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newLeadId, hAction, h.status ?? "", h.sale_name ?? "", h.feedback ?? "", h.contact_date ?? "", h.note ?? "", h.source ?? "backup-restore", h.user_name ?? "", hCreatedAt || new Date().toISOString()]
        );
        fixedHistory++;
      }
    }

    lastSyncHash = "";
    emitDataChanged("recover-from-backup");
    console.log(`[recover-from-backup] Done: ${fixedSale} sale, ${fixedStatus} status, ${fixedHistory} history restored (${totalLeads} leads)`);
    res.json({ total: totalLeads, fixedSale, fixedStatus, fixedHistory, backupCount: validBackups.length });
  } catch (err) {
    console.error("[recover-from-backup] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Recover sale_name + status + history from crm.db.backup file
app.post("/api/recover-sale-from-dbbackup", requireAuth, requireAdmin, async (req, res) => {
  try {
    const backupPath = path.join(DB_DIR, "crm.db.backup");
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: "Không tìm thấy file crm.db.backup" });
    }

    console.log("[recover-dbbackup] Opening backup database...");
    const backupDb = createClient({ url: `file:${backupPath}` });

    // Read ALL leads from backup that have sale assigned
    const backupLeads = await all(backupDb,
      "SELECT id, phone, name, sale_name, manager_name, status, raw_status FROM leads WHERE sale_name != '' AND sale_name != 'Chưa chia'"
    );
    console.log(`[recover-dbbackup] Found ${backupLeads.length} leads with sale in backup`);

    if (!backupLeads.length) {
      return res.json({ total: 0, fixedSale: 0, fixedStatus: 0, fixedHistory: 0, message: "Backup không có lead nào có sale" });
    }

    // Read ALL history entries from backup
    let backupHistory = [];
    try {
      backupHistory = await all(backupDb,
        "SELECT lh.lead_id, lh.action, lh.status, lh.sale_name, lh.feedback, lh.contact_date, lh.note, lh.source, lh.user_name, lh.created_at, l.phone as lead_phone FROM lead_history lh JOIN leads l ON lh.lead_id = l.id"
      );
    } catch (e) {
      console.warn("[recover-dbbackup] Could not read history from backup:", e.message);
    }
    console.log(`[recover-dbbackup] Found ${backupHistory.length} history entries in backup`);
    // Filter out sheet-generated entries
    backupHistory = backupHistory.filter(h => (h.source ?? "") !== "sheet");
    console.log(`[recover-dbbackup] ${backupHistory.length} non-sheet history entries`);

    // Build phone → backup lead map
    const phoneMap = new Map();
    for (const bl of backupLeads) {
      const key = normalizePhoneKey(bl.phone);
      if (key) phoneMap.set(key, bl);
    }

    // Build backup lead_id → phone map (for history matching)
    const backupIdToPhone = new Map();
    for (const bl of backupLeads) {
      backupIdToPhone.set(bl.id, normalizePhoneKey(bl.phone));
    }

    // Also map phones for leads NOT in backupLeads (history might reference them)
    const allBackupLeads = await all(backupDb, "SELECT id, phone FROM leads");
    for (const bl of allBackupLeads) {
      if (!backupIdToPhone.has(bl.id)) {
        backupIdToPhone.set(bl.id, normalizePhoneKey(bl.phone));
      }
    }

    // Group history by phone
    const phoneHistoryMap = new Map();
    for (const h of backupHistory) {
      const key = normalizePhoneKey(h.lead_phone);
      if (!key) continue;
      if (!phoneHistoryMap.has(key)) phoneHistoryMap.set(key, []);
      phoneHistoryMap.get(key).push(h);
    }

    // Get ALL current leads (not just Chưa chia - we need phone→id mapping for history)
    const currentLeads = await all(db,
      "SELECT id, phone, name, sale_name, manager_name, status FROM leads"
    );

    // Build phone → current lead id
    const phoneToCurrentId = new Map();
    for (const cl of currentLeads) {
      const key = normalizePhoneKey(cl.phone);
      if (key) phoneToCurrentId.set(key, cl);
    }

    let fixedSale = 0, fixedStatus = 0, fixedManager = 0, fixedHistory = 0;
    const details = [];

    // 1. Restore sale_name + status + manager
    for (const cl of currentLeads) {
      const key = normalizePhoneKey(cl.phone);
      const bl = phoneMap.get(key);
      if (!bl) continue;

      const updates = [];
      const params = [];
      let newSale = cl.sale_name, newManager = cl.manager_name, newStatus = cl.status;

      // Restore sale_name if currently empty
      if ((!cl.sale_name || cl.sale_name === "Chưa chia") && bl.sale_name && bl.sale_name !== "Chưa chia") {
        updates.push("sale_name = ?");
        params.push(bl.sale_name);
        newSale = bl.sale_name;
        fixedSale++;
      }

      // Restore manager_name if currently empty
      if ((!cl.manager_name || cl.manager_name === "") && bl.manager_name) {
        updates.push("manager_name = ?");
        params.push(bl.manager_name);
        newManager = bl.manager_name;
        fixedManager++;
      }

      // Restore status if currently new/empty and backup has real status
      if ((!cl.status || cl.status === "new") && bl.status && bl.status !== "new") {
        updates.push("status = ?");
        params.push(bl.status);
        newStatus = bl.status;
        fixedStatus++;
      }

      if (updates.length) {
        params.push(cl.id);
        await run(db, `UPDATE leads SET ${updates.join(", ")} WHERE id = ?`, params);
        details.push({ id: cl.id, name: cl.name, phone: cl.phone, sale: newSale, manager: newManager, status: newStatus });
      }
    }

    // 2. Restore history entries by phone matching
    for (const [phoneKey, histEntries] of phoneHistoryMap) {
      const currentLead = phoneToCurrentId.get(phoneKey);
      if (!currentLead) continue;

      for (const h of histEntries) {
        const hAction = h.action ?? "";
        const hCreatedAt = h.created_at ?? "";
        if (!hAction) continue;

        // Check duplicate by action + created_at
        const exists = await get(db,
          "SELECT 1 FROM lead_history WHERE lead_id = ? AND action = ? AND created_at = ?",
          [currentLead.id, hAction, hCreatedAt]
        );
        if (exists) continue;

        await run(db,
          `INSERT INTO lead_history(lead_id, action, status, sale_name, feedback, contact_date, note, source, user_name, created_at)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [currentLead.id, hAction, h.status ?? "", h.sale_name ?? "", h.feedback ?? "", h.contact_date ?? "", h.note ?? "", h.source ?? "db-backup", h.user_name ?? "", hCreatedAt || new Date().toISOString()]
        );
        fixedHistory++;
      }
    }

    lastSyncHash = "";
    emitDataChanged("recover-dbbackup");
    console.log(`[recover-dbbackup] Done: ${fixedSale} sale, ${fixedStatus} status, ${fixedManager} manager, ${fixedHistory} history`);
    res.json({ total: currentLeads.length, fixedSale, fixedStatus, fixedManager, fixedHistory, backupLeads: backupLeads.length, details });
  } catch (err) {
    console.error("[recover-dbbackup] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Selective recovery: choose backup file + project, restore only status + feedback
app.post("/api/recover-selective", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const { filename, projectId } = req.body || {};
    if (!filename || !projectId) return res.status(400).json({ error: "Cần chọn file backup và dự án" });
    if (!String(filename).startsWith("crm_") || !String(filename).endsWith(".db")) {
      return res.status(400).json({ error: "Tên file không hợp lệ" });
    }
    const backupPath = path.join(BACKUP_DIR, path.basename(String(filename)));
    if (!fs.existsSync(backupPath)) return res.status(404).json({ error: "File backup không tồn tại" });

    console.log(`[recover-selective] Opening ${filename} for project ${projectId}...`);
    const backupDb = createClient({ url: `file:${backupPath}` });

    // Read leads from backup for this project
    const backupLeads = await all(backupDb,
      "SELECT id, phone, name, sale_name, manager_name, status, raw_status FROM leads WHERE project_id = ?",
      [projectId]
    );
    if (!backupLeads.length) {
      return res.json({ total: 0, fixedSale: 0, fixedStatus: 0, fixedHistory: 0, message: "Backup không có lead nào cho dự án này" });
    }

    // Read history entries for this project from backup
    let backupHistory = [];
    try {
      backupHistory = await all(backupDb,
        `SELECT lh.lead_id, lh.action, lh.status, lh.sale_name, lh.feedback, lh.contact_date, lh.note, lh.source, lh.user_name, lh.created_at, l.phone as lead_phone
         FROM lead_history lh JOIN leads l ON lh.lead_id = l.id WHERE l.project_id = ?`,
        [projectId]
      );
    } catch (e) { console.warn("[recover-selective] History read error:", e.message); }
    backupHistory = backupHistory.filter(h => (h.source ?? "") !== "sheet");

    // Build phone map from backup
    const phoneMap = new Map();
    for (const bl of backupLeads) {
      const key = normalizePhoneKey(bl.phone);
      if (key) phoneMap.set(key, bl);
    }

    // Group history by phone
    const phoneHistoryMap = new Map();
    for (const h of backupHistory) {
      const key = normalizePhoneKey(h.lead_phone);
      if (!key) continue;
      if (!phoneHistoryMap.has(key)) phoneHistoryMap.set(key, []);
      phoneHistoryMap.get(key).push(h);
    }

    // Get current leads for this project
    const currentLeads = await all(db,
      "SELECT id, phone, name, sale_name, manager_name, status FROM leads WHERE project_id = ?",
      [projectId]
    );

    const phoneToCurrentId = new Map();
    for (const cl of currentLeads) {
      const key = normalizePhoneKey(cl.phone);
      if (key) phoneToCurrentId.set(key, cl);
    }

    let fixedSale = 0, fixedStatus = 0, fixedManager = 0, fixedHistory = 0;

    // Restore sale_name + status + manager
    for (const cl of currentLeads) {
      const key = normalizePhoneKey(cl.phone);
      const bl = phoneMap.get(key);
      if (!bl) continue;

      const updates = [];
      const params = [];

      if ((!cl.sale_name || cl.sale_name === "Chưa chia") && bl.sale_name && bl.sale_name !== "Chưa chia") {
        updates.push("sale_name = ?"); params.push(bl.sale_name); fixedSale++;
      }
      if ((!cl.manager_name || cl.manager_name === "") && bl.manager_name) {
        updates.push("manager_name = ?"); params.push(bl.manager_name); fixedManager++;
      }
      if ((!cl.status || cl.status === "new") && bl.status && bl.status !== "new") {
        updates.push("status = ?"); params.push(bl.status); fixedStatus++;
      }

      if (updates.length) {
        params.push(cl.id);
        await run(db, `UPDATE leads SET ${updates.join(", ")} WHERE id = ?`, params);
      }
    }

    // Restore history entries
    for (const [phoneKey, histEntries] of phoneHistoryMap) {
      const currentLead = phoneToCurrentId.get(phoneKey);
      if (!currentLead) continue;

      for (const h of histEntries) {
        const hAction = h.action ?? "";
        const hCreatedAt = h.created_at ?? "";
        if (!hAction) continue;

        const exists = await get(db,
          "SELECT 1 FROM lead_history WHERE lead_id = ? AND action = ? AND created_at = ?",
          [currentLead.id, hAction, hCreatedAt]
        );
        if (exists) continue;

        await run(db,
          `INSERT INTO lead_history(lead_id, action, status, sale_name, feedback, contact_date, note, source, user_name, created_at)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [currentLead.id, hAction, h.status ?? "", h.sale_name ?? "", h.feedback ?? "", h.contact_date ?? "", h.note ?? "", h.source ?? "selective-restore", h.user_name ?? "", hCreatedAt || new Date().toISOString()]
        );
        fixedHistory++;
      }
    }

    lastSyncHash = "";
    emitDataChanged("recover-selective");
    console.log(`[recover-selective] Done: ${fixedSale} sale, ${fixedStatus} status, ${fixedManager} manager, ${fixedHistory} history for project ${projectId}`);
    res.json({ total: currentLeads.length, backupLeads: backupLeads.length, fixedSale, fixedStatus, fixedManager, fixedHistory });
  } catch (err) {
    console.error("[recover-selective] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== DATABASE BACKUP SYSTEM ====================
const BACKUP_DIR = path.join(DB_DIR, "backups");
const BACKUP_KEEP_DAYS = 7;

function performBackup(label = "auto") {
  try {
    if (!fs.existsSync(DB_PATH)) return null;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19); // 2026-03-23T08-00-00
    const filename = `crm_${label}_${ts}.db`;
    const dest = path.join(BACKUP_DIR, filename);
    fs.copyFileSync(DB_PATH, dest);
    const sizeMB = (fs.statSync(dest).size / 1024 / 1024).toFixed(1);
    console.log(`[backup] ${filename} (${sizeMB}MB)`);

    // Cleanup: remove backups older than BACKUP_KEEP_DAYS
    const cutoff = Date.now() - BACKUP_KEEP_DAYS * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const f of fs.readdirSync(BACKUP_DIR)) {
      if (!f.startsWith("crm_") || !f.endsWith(".db")) continue;
      const fPath = path.join(BACKUP_DIR, f);
      if (fs.statSync(fPath).mtimeMs < cutoff) {
        fs.unlinkSync(fPath);
        removed++;
      }
    }
    if (removed) console.log(`[backup] Cleaned ${removed} old backup(s)`);

    return { filename, sizeMB, removed };
  } catch (e) {
    console.error("[backup] Error:", e.message);
    return null;
  }
}

// Manual backup
app.post("/api/backup-now", requireAuth, requireAdmin, (req, res) => {
  const result = performBackup("manual");
  if (!result) return res.status(500).json({ error: "Backup failed" });
  res.json({ success: true, ...result });
});

// List available backups
app.get("/api/backups", requireAuth, requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json({ backups: [] });
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("crm_") && f.endsWith(".db"))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, sizeMB: (stat.size / 1024 / 1024).toFixed(1), date: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    res.json({ backups: files, total: files.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Restore from a backup file (replaces crm.db)
app.post("/api/restore-backup", requireAuth, requireAdmin, async (req, res) => {
  const { filename } = req.body || {};
  if (!filename || !filename.startsWith("crm_") || !filename.endsWith(".db")) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const srcPath = path.join(BACKUP_DIR, path.basename(filename));
  if (!fs.existsSync(srcPath)) return res.status(404).json({ error: "Backup file not found" });

  try {
    // Safety: backup current DB before restore
    performBackup("pre-restore");
    fs.copyFileSync(srcPath, DB_PATH);
    console.log(`[restore] Restored from ${filename}`);
    res.json({ success: true, message: `Đã khôi phục từ ${filename}. Cần restart server.` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/sync", requireAuth, async (req, res) => {
  try {
    const clientHash = req.body?.hash || "";
    console.log("[sync] Starting sync...");
    const { lastSync, syncErrors } = await syncAllProjects(db);
    const data = await readData(db);
    await filterDataForRole(data, req.user);
    // Compute hash from lead count + last lead id + lastSync
    const hashSrc = `${data.leads.length}|${data.leads[data.leads.length - 1]?.id || 0}|${lastSync}|${data.leads.reduce((s, l) => s + (l.status || ""), "")}`;
    const hash = crypto.createHash("md5").update(hashSrc).digest("hex").slice(0, 12);
    lastSyncHash = hash;
    // If client already has this hash, return minimal response
    if (clientHash && clientHash === hash) {
      return res.json({ noChange: true, hash, lastSync });
    }
    console.log(`[sync] Done. leads=${data.leads.length} campaigns=${data.campaigns.length} errors=${syncErrors.length} hash=${hash}`);
    res.json({ lastSync, syncErrors, hash, ...data });
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

// Import legacy/old data from a simple Google Sheet (STT, Họ tên, SĐT, Nhu cầu, Status, Feedback)
app.post("/api/projects/import-legacy", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const { name, sheetUrl } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Tên dự án không được trống" });
    if (!sheetUrl) return res.status(400).json({ error: "Sheet URL không được trống" });

    const existing = await get(db, "SELECT id FROM projects WHERE name = ?", [String(name).trim()]);
    if (existing) return res.status(409).json({ error: "Dự án đã tồn tại" });

    const cleanUrl = sanitizeSheetUrl(sheetUrl);
    const csvText = await fetchCsvText(cleanUrl);
    const { headers, rows } = parseCSV(csvText);

    if (rows.length === 0) return res.status(400).json({ error: "Sheet không có dữ liệu" });

    // Create project with is_legacy = 1
    const projResult = await run(db,
      "INSERT INTO projects(name, lead_url, cost_url, fb_code, fb_person, is_legacy) VALUES(?, '', '', '', '', 1)",
      [String(name).trim()]
    );
    const projectId = projResult.lastInsertRowid ?? projResult.lastID;

    // Map legacy columns: STT, Họ tên khách, SĐT, Nhu cầu, Status, Feedback khách
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    let imported = 0;
    const stmts = [];

    for (const r of rows) {
      const customerName = findVal(r, ["ho ten khach", "ho ten", "ten khach", "full name", "ten", "name", "ho va ten"]);
      if (!customerName) continue;

      let phone = findVal(r, ["sdt", "so dien thoai", "phone", "dien thoai", "so dt", "mobile"]);
      if (phone.startsWith("p:")) phone = phone.slice(2);

      const product = findVal(r, ["nhu cau", "nhu_cau", "san pham", "loai hinh", "product"]);
      const rawStatus = findVal(r, ["status", "trang thai", "tinh trang"]);
      const feedback = findVal(r, ["feedback khach", "feedback", "phan hoi", "ghi chu", "note"]);

      const status = rawStatus ? normalizeStatus(rawStatus) : "new";

      stmts.push({
        sql: `INSERT INTO leads(project_id, name, phone, product, raw_status, status, created_at, sale_name, manager_name, campaign, source, budget, ads_id, adset_name, ad_name, form_name, sync_at)
              VALUES(?, ?, ?, ?, ?, ?, ?, '', '', 'Data cũ', 'Legacy', '-', '', '-', '-', '-', ?)`,
        args: [projectId, customerName, phone || "", product || "-", rawStatus || "", status, now, now]
      });

      // If there's feedback, create a history entry
      if (feedback) {
        stmts.push({
          sql: `INSERT INTO lead_history(lead_id, action, status, sale_name, feedback, contact_date, note, source, user_name, created_at)
                VALUES((SELECT MAX(id) FROM leads WHERE project_id = ? AND phone = ? AND name = ?), 'Import data cũ', ?, '', ?, '', '', 'legacy-import', ?)`,
          args: [projectId, phone || "", customerName, status, feedback, now]
        });
      }
      imported++;
    }

    if (stmts.length > 0) {
      // Batch in chunks to avoid oversized batches
      for (let i = 0; i < stmts.length; i += 200) {
        await db.batch(stmts.slice(i, i + 200), "write");
      }
    }

    lastSyncHash = "";
    emitDataChanged("import-legacy");
    const data = await readData(db);
    console.log(`[import-legacy] Created project "${name}" (id=${projectId}) with ${imported} legacy leads`);
    res.json({ ...data, newProjectId: projectId, imported });
  } catch (err) {
    console.error("[import-legacy] Error:", err.message);
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

/* POST /api/projects/:id/toggle-manual-assign - Toggle manual_assign flag for hot projects */
app.post("/api/projects/:id/toggle-manual-assign", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const proj = await get(db, "SELECT id, name, manual_assign FROM projects WHERE id = ?", [id]);
    if (!proj) return res.status(404).json({ error: "Dự án không tồn tại" });
    const newVal = proj.manual_assign ? 0 : 1;
    await run(db, "UPDATE projects SET manual_assign = ? WHERE id = ?", [newVal, id]);
    console.log(`[toggle-manual-assign] Project "${proj.name}" (id=${id}) manual_assign=${newVal} by ${req.user.displayName}`);
    const data = await readData(db);
    res.json({ manual_assign: newVal, projectName: proj.name, ...data });
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
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const stmts = [];
    for (const lid of leadIds) {
      stmts.push({ sql: "UPDATE leads SET sale_name = ?, status = 'new' WHERE id = ?", args: [saleName, lid] });
      // Add history
      const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [lid]);
      const nextSeq = (maxSeq?.m ?? -1) + 1;
      stmts.push({
        sql: "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
        args: [lid, saleName, "Chia lead", now, "", `Admin ${req.user.displayName} chia lead`, nextSeq, "admin"],
      });
    }
    await db.batch(stmts, "write");

    // Send Telegram for each lead
    try {
      const saleUser = await get(db, "SELECT telegram_id FROM users WHERE display_name = ? AND telegram_id != ''", [saleName]);
      if (saleUser && saleUser.telegram_id) {
        for (const lid of leadIds) {
          const lead = await get(db, "SELECT * FROM leads WHERE id = ?", [lid]);
          if (!lead) continue;
          const activeBot = await getBotForProject(lead.project_id);
          if (!activeBot || !activeBot.token) continue;
          const projectRow = await get(db, "SELECT name FROM projects WHERE id = ?", [lead.project_id]);
          const msg = [
            `🔔 *BẠN CÓ LEAD MỚI*`,
            `Dự án: *${escMd(projectRow ? projectRow.name : "-")}*`,
            `----------------------------------------------`,
            `👤 Khách: *${escMd(lead.name || "N/A")}*`,
            `📞 SĐT: \`${lead.phone || "-"}\``,
            `🔗 Nhu cầu: ${escMd(lead.product || "-")}`,
            `🕒 Nhận lúc: ${now}`,
            `--------------------------`,
            `📝 *FEEDBACK:*`,
            `Bấm nút bên dưới để cập nhật trạng thái.`,
          ].join("\n");
          const statusList = [
            ["interested", "Quan tâm"], ["low_interest", "QT hời hợt"], ["other_project", "QT DA khác"],
            ["consulting", "Đang tư vấn"], ["appointment", "Hẹn xem"], ["booked", "Giữ chỗ"],
            ["closed", "Chốt"], ["not_interested", "Không QT"], ["spam", "Phá/rác"],
            ["weak_finance", "TC yếu"], ["unreachable", "Chưa LLĐ"], ["callback", "Gọi lại sau"],
            ["wrong_number", "Sai số"], ["has_sale", "Có sale khác"],
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
          await run(db, "INSERT OR REPLACE INTO telegram_pending(telegram_id, lead_id, status, message_id, phone) VALUES(?, ?, '', ?, ?)", [saleUser.telegram_id, lid, sentMsgId, lead.phone || ""]);
          if (sentMsgId) await run(db, "INSERT INTO telegram_lead_msgs(telegram_id, lead_id, message_id) VALUES(?, ?, ?)", [saleUser.telegram_id, lid, sentMsgId]);
        }
      }
    } catch (teleErr) {
      console.error("[Telegram bulk] Send failed:", teleErr.message);
    }

    lastSyncHash = ""; // invalidate so next poll re-fetches
    emitDataChanged("chia-lead");
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
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const stmts = [];
    for (let i = 0; i < leads.length; i++) {
      const l = leads[i];
      const assignedSale = saleNames[i % saleNames.length];
      stmts.push({ sql: "UPDATE leads SET sale_name = ? WHERE id = ?", args: [assignedSale, l.id] });
      const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [l.id]);
      const nextSeq = (maxSeq?.m ?? -1) + 1;
      stmts.push({
        sql: "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
        args: [l.id, assignedSale, "Chia lead", now, "", `Admin ${req.user.displayName} xáo lead`, nextSeq, "admin"],
      });
    }
    await db.batch(stmts, "write");

    lastSyncHash = "";
    emitDataChanged("shuffle-leads");

    const data = await readData(db);
    await filterDataForRole(data, req.user);
    res.json({ msg: `Đã xáo ${leads.length} lead cho ${saleNames.length} sale`, assigned: leads.length, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Shuffle failed" });
  }
});

/* ===== Auto-rotate leads (3 days no update → reassign) ===== */
const LOCKED_STATUSES = new Set(["booked", "booking_other"]);

// Get auto-rotate setting for a project
app.get("/api/auto-rotate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const projectId = req.query.projectId;
    if (projectId) {
      const row = await get(db, "SELECT value FROM settings WHERE key = ?", [`auto_rotate_project_${projectId}`]);
      return res.json({ enabled: row?.value === "1", projectId: Number(projectId) });
    }
    // Return all per-project settings
    const rows = await all(db, "SELECT key, value FROM settings WHERE key LIKE 'auto_rotate_project_%'");
    const map = {};
    for (const r of rows) {
      const pid = r.key.replace('auto_rotate_project_', '');
      map[pid] = r.value === "1";
    }
    res.json({ projects: map });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle sprint-rotate (nước rút) on/off for a specific project
app.post("/api/sprint-rotate/toggle", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: "Cần chọn dự án" });
    const key = `sprint_rotate_project_${projectId}`;
    const current = await get(db, "SELECT value FROM settings WHERE key = ?", [key]);
    const newVal = current?.value === "1" ? "0" : "1";
    await upsertSetting(db, key, newVal);
    console.log(`[sprint-rotate] Project ${projectId} toggled to ${newVal === "1" ? "ON" : "OFF"} by ${req.user.displayName}`);
    res.json({ enabled: newVal === "1", projectId: Number(projectId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle auto-rotate on/off for a specific project
app.post("/api/auto-rotate/toggle", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: "Cần chọn dự án" });
    const key = `auto_rotate_project_${projectId}`;
    const current = await get(db, "SELECT value FROM settings WHERE key = ?", [key]);
    const newVal = current?.value === "1" ? "0" : "1";
    await upsertSetting(db, key, newVal);
    console.log(`[auto-rotate] Project ${projectId} toggled to ${newVal === "1" ? "ON" : "OFF"} by ${req.user.displayName}`);
    res.json({ enabled: newVal === "1", projectId: Number(projectId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===== Auto-rotate history (calendar) ===== */
app.get("/api/auto-rotate/history", requireAuth, requireAdmin, async (req, res) => {
  try {
    const source = req.query.source === "sprint" ? "sprint-rotate" : "auto-rotate";
    const rows = await all(db,
      `SELECT lh.id, lh.lead_id, lh.sale_name, lh.contact_date, lh.feedback, l.name as lead_name, l.phone as lead_phone, l.project_id
       FROM lead_history lh
       JOIN leads l ON lh.lead_id = l.id
       WHERE lh.source = ?
       ORDER BY lh.id DESC
       LIMIT 500`,
      [source]
    );
    const history = rows.map(r => {
      const oldSaleMatch = (r.feedback || "").match(/sale\s+(.+?)\s+không (?:cập nhật|chốt)/);
      return {
        id: r.id,
        leadId: r.lead_id,
        leadName: r.lead_name || "",
        leadPhone: r.lead_phone || "",
        projectId: r.project_id,
        fromSale: oldSaleMatch ? oldSaleMatch[1] : "",
        toSale: r.sale_name || "",
        date: r.contact_date || "",
      };
    });
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process auto-rotate: unified flow — hot sales (24h) first, then normal sales (2 days), sprint mode (12h)
async function processAutoRotate(db) {
  const enabledRows = await all(db, "SELECT key, value FROM settings WHERE key LIKE 'auto_rotate_project_%' AND value = '1'");
  if (!enabledRows.length) return 0;
  const enabledProjectIds = new Set(enabledRows.map(r => Number(r.key.replace('auto_rotate_project_', ''))));

  // Sprint mode per project
  const sprintRows = await all(db, "SELECT key, value FROM settings WHERE key LIKE 'sprint_rotate_project_%' AND value = '1'");
  const sprintProjectIds = new Set(sprintRows.map(r => Number(r.key.replace('sprint_rotate_project_', ''))));

  const now = new Date();
  const nowStr = now.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  // Pre-fetch hot lead sales per project: { projectId: Set<saleName> }
  const hotLeadRows = await all(db,
    `SELECT u.display_name, up.project_id FROM user_projects up
     INNER JOIN users u ON u.id = up.user_id
     WHERE up.hot_lead = 1 AND u.role = 'sale'`
  );
  const hotSalesByProject = {};
  for (const r of hotLeadRows) {
    if (!hotSalesByProject[r.project_id]) hotSalesByProject[r.project_id] = new Set();
    hotSalesByProject[r.project_id].add(r.display_name);
  }

  // Get candidate leads (assigned, not locked/booked)
  const candidates = await all(db,
    `SELECT l.id, l.sale_name, l.status, l.project_id
     FROM leads l
     WHERE l.sale_name != '' AND l.sale_name != 'Chưa chia' AND l.sale_name IS NOT NULL
       AND l.status NOT IN ('booked', 'booking_other', 'closed')
       AND l.is_locked = 0
     ORDER BY l.id ASC`
  );
  const filtered = candidates.filter(l => enabledProjectIds.has(l.project_id));

  let rotated = 0;
  const stmts = [];

  // Helper: parse date from VN or ISO format (includes time)
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (isoMatch) return new Date(dateStr);
    // VN format: "HH:MM:SS DD/MM/YYYY" or "DD/MM/YYYY HH:MM:SS"
    const vnTimeBefore = dateStr.match(/(\d{1,2}):(\d{2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (vnTimeBefore) return new Date(Number(vnTimeBefore[6]), Number(vnTimeBefore[5]) - 1, Number(vnTimeBefore[4]), Number(vnTimeBefore[1]), Number(vnTimeBefore[2]), Number(vnTimeBefore[3]));
    const vnTimeAfter = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (vnTimeAfter) return new Date(Number(vnTimeAfter[3]), Number(vnTimeAfter[2]) - 1, Number(vnTimeAfter[1]), Number(vnTimeAfter[4]), Number(vnTimeAfter[5]), Number(vnTimeAfter[6] || 0));
    const vnDateOnly = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (vnDateOnly) return new Date(Number(vnDateOnly[3]), Number(vnDateOnly[2]) - 1, Number(vnDateOnly[1]));
    return null;
  };

  for (const lead of filtered) {
    const isSprint = sprintProjectIds.has(lead.project_id);
    const projectHotSales = hotSalesByProject[lead.project_id];
    const hasHotConfig = projectHotSales && projectHotSales.size > 0;
    const currentSaleIsHot = hasHotConfig && projectHotSales.has(lead.sale_name);

    // Skip rotating trash leads (pha/rac and related unreachable contacts)
    const normalizedLeadStatus = normalizeStatus(lead.status || "");
    if (["spam", "wrong_phone", "wrong_number", "blocked"].includes(normalizedLeadStatus)) continue;

    // Skip rotating leads that have >3 distinct sales marking "khong quan tam"
    const feedbackRows = await all(db,
      `SELECT DISTINCT sale_name, status
       FROM lead_history
       WHERE lead_id = ? AND action != 'Chia lead' AND sale_name != '' AND status != ''`,
      [lead.id]
    );
    const notInterestedSales = new Set(
      feedbackRows
        .filter(r => normalizeStatus(r.status || "") === "not_interested")
        .map(r => (r.sale_name || "").trim().toLowerCase())
        .filter(Boolean)
    );
    if (notInterestedSales.size > 3) continue;

    // --- Determine threshold & check date source ---
    let thresholdMs;

    if (isSprint) {
      // Sprint mode: 12h for ALL sales, count from "Chia lead" date
      thresholdMs = 12 * 60 * 60 * 1000;
    } else if (hasHotConfig && currentSaleIsHot) {
      const henStatuses = ["hen_gap", "hen_xem", "hẹn gặp", "hẹn xem"];
      if (henStatuses.some(s => (lead.status || "").toLowerCase() === s)) {
        thresholdMs = 48 * 60 * 60 * 1000; // 48h
      } else {
        thresholdMs = 24 * 60 * 60 * 1000; // 24h
      }
    } else {
      thresholdMs = 2 * 24 * 60 * 60 * 1000; // 2 days
    }

    // --- Get the relevant date to check ---
    let checkDate = null;

    if (isSprint) {
      // Sprint: count from the last "Chia lead" action for this sale
      const chiaEntry = await get(db,
        `SELECT contact_date FROM lead_history
         WHERE lead_id = ? AND sale_name = ? AND action = 'Chia lead'
         ORDER BY seq DESC LIMIT 1`,
        [lead.id, lead.sale_name]
      );
      if (chiaEntry) checkDate = parseDate(chiaEntry.contact_date);
      if (!checkDate || isNaN(checkDate.getTime())) continue;
    } else {
      // Normal: count from last update/status change
      const latestUpdate = await get(db,
        `SELECT contact_date, action FROM lead_history
         WHERE lead_id = ? AND sale_name = ?
         ORDER BY seq DESC LIMIT 1`,
        [lead.id, lead.sale_name]
      );
      if (!latestUpdate) continue;

      checkDate = parseDate(latestUpdate.contact_date);
      if (!checkDate || isNaN(checkDate.getTime())) continue;

      // Use latest status change date if exists (not just "Chia lead")
      const latestStatusChange = await get(db,
        `SELECT contact_date FROM lead_history
         WHERE lead_id = ? AND sale_name = ? AND action != 'Chia lead' AND status != ''
         ORDER BY seq DESC LIMIT 1`,
        [lead.id, lead.sale_name]
      );
      if (latestStatusChange) {
        const d = parseDate(latestStatusChange.contact_date);
        if (d && !isNaN(d.getTime())) checkDate = d;
      }
    }

    if (now.getTime() - checkDate.getTime() < thresholdMs) continue;

    // --- Find next sale (unified flow) ---
    let nextSale = null;

    if (hasHotConfig) {
      const pastSales = await all(db,
        `SELECT DISTINCT sale_name FROM lead_history WHERE lead_id = ? AND action = 'Chia lead'`,
        [lead.id]
      );
      const pastSaleNames = new Set(pastSales.map(r => r.sale_name));
      pastSaleNames.add(lead.sale_name);

      // Try hot sales first
      const allHotNames = [...projectHotSales];
      const unreceivedHot = allHotNames.filter(s => !pastSaleNames.has(s));
      if (unreceivedHot.length > 0) {
        nextSale = unreceivedHot[lead.id % unreceivedHot.length];
      } else {
        // Hot exhausted → normal sales
        const nonHotSales = await all(db,
          `SELECT DISTINCT u.display_name FROM users u
           INNER JOIN user_projects up ON up.user_id = u.id
           WHERE up.project_id = ? AND (up.hot_lead = 0 OR up.hot_lead IS NULL) AND u.role = 'sale'`,
          [lead.project_id]
        );
        const nonHotNames = nonHotSales.map(r => r.display_name);
        const unreceivedNormal = nonHotNames.filter(s => !pastSaleNames.has(s));
        if (unreceivedNormal.length > 0) {
          nextSale = unreceivedNormal[lead.id % unreceivedNormal.length];
        } else if (nonHotNames.length > 0) {
          const available = nonHotNames.filter(s => s !== lead.sale_name);
          if (available.length > 0) nextSale = available[lead.id % available.length];
        }
        if (!nextSale) {
          const otherHot = allHotNames.filter(s => s !== lead.sale_name);
          if (otherHot.length > 0) nextSale = otherHot[lead.id % otherHot.length];
        }
      }
    } else {
      const pastSales = await all(db,
        `SELECT DISTINCT sale_name FROM lead_history WHERE lead_id = ? AND action = 'Chia lead'`,
        [lead.id]
      );
      const pastSaleNames = new Set(pastSales.map(r => r.sale_name));
      pastSaleNames.add(lead.sale_name);

      const projectSales = await all(db,
        `SELECT DISTINCT u.display_name FROM users u
         INNER JOIN user_projects up ON up.user_id = u.id
         WHERE up.project_id = ? AND u.role = 'sale'`,
        [lead.project_id]
      );
      const allNames = projectSales.map(r => r.display_name);
      const unreceived = allNames.filter(s => !pastSaleNames.has(s));
      if (unreceived.length > 0) {
        nextSale = unreceived[lead.id % unreceived.length];
      } else {
        const available = allNames.filter(s => s !== lead.sale_name);
        if (available.length > 0) nextSale = available[lead.id % available.length];
      }
    }

    if (!nextSale) continue;

    // --- Apply rotation (restore previous feedback if sale had this lead before) ---
    const prevFeedback = await get(db,
      `SELECT status FROM lead_history WHERE lead_id = ? AND sale_name = ? AND status != '' ORDER BY seq DESC LIMIT 1`,
      [lead.id, nextSale]
    );
    if (prevFeedback && prevFeedback.status) {
      stmts.push({ sql: "UPDATE leads SET sale_name = ?, status = ?, raw_status = ? WHERE id = ?", args: [nextSale, normalizeStatus(prevFeedback.status), prevFeedback.status, lead.id] });
    } else {
      stmts.push({ sql: "UPDATE leads SET sale_name = ?, status = 'new', raw_status = '' WHERE id = ?", args: [nextSale, lead.id] });
    }
    const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [lead.id]);
    const nextSeq = (maxSeq?.m ?? -1) + 1;
    const thresholdLabel = thresholdMs < 86400000 ? `${thresholdMs / 3600000}h` : `${thresholdMs / 86400000} ngày`;
    const source = isSprint ? "sprint-rotate" : "auto-rotate";
    const reason = isSprint
      ? `Nước rút: sale ${lead.sale_name} không chốt trong 12h`
      : `Tự động xáo (sale ${lead.sale_name} không cập nhật >${thresholdLabel})`;
    stmts.push({
      sql: "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
      args: [lead.id, nextSale, "Chia lead", nowStr, "", reason, nextSeq, source],
    });
    rotated++;
  }

  if (stmts.length > 0) {
    await db.batch(stmts, "write");
    lastSyncHash = "";
    emitDataChanged("auto-rotate");
    console.log(`[auto-rotate] Rotated ${rotated} leads`);
  }

  return rotated;
}

/* ===== Scheduled lead distribution (round-robin 5 lead/day/person) ===== */

// Get today's date string YYYY-MM-DD in Vietnam timezone
function getTodayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

// Get current HH:MM in Vietnam timezone
function getNowHHMM() {
  return new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });
}

// Sync active schedules after a sale is removed from project(s)
async function syncSchedulesAfterProjectChange(db, userId, removedProjectIds) {
  if (!removedProjectIds || !removedProjectIds.length) return;
  const user = await get(db, "SELECT display_name FROM users WHERE id = ?", [userId]);
  if (!user) return;
  const saleName = user.display_name;

  for (const projId of removedProjectIds) {
    const schedules = await all(db, "SELECT * FROM lead_schedules WHERE is_active = 1 AND project_id = ?", [projId]);
    for (const sch of schedules) {
      let saleList;
      try { saleList = JSON.parse(sch.sale_names || "[]"); } catch { continue; }
      const idx = saleList.indexOf(saleName);
      if (idx === -1) continue; // sale not in this schedule

      saleList.splice(idx, 1);
      if (!saleList.length) {
        // No sales left → deactivate schedule
        await run(db, "UPDATE lead_schedules SET is_active = 0, sale_names = '[]' WHERE id = ?", [sch.id]);
        console.log(`[syncSchedules] Deactivated schedule #${sch.id} (no sales left after removing ${saleName})`);
      } else {
        // Adjust assigned_index if needed (was pointing beyond removed sale)
        // current_tour also wraps based on new saleList length
        let newTour = (sch.current_tour || 0) % saleList.length;
        await run(db, "UPDATE lead_schedules SET sale_names = ?, current_tour = ? WHERE id = ?",
          [JSON.stringify(saleList), newTour, sch.id]);
        console.log(`[syncSchedules] Removed ${saleName} from schedule #${sch.id}, remaining: ${saleList.join(", ")}`);
      }
    }
  }
}

// Process all active schedules - assign leads that are due today at the scheduled time
async function processSchedules(db, triggerUser) {
  const today = getTodayStr();
  const nowHHMM = getNowHHMM();
  const schedules = await all(db, "SELECT * FROM lead_schedules WHERE is_active = 1");
  let totalAssigned = 0;

  for (const sch of schedules) {
    // Parse distribute times (array or legacy single string)
    let distTimes = [];
    try { distTimes = JSON.parse(sch.distribute_time || '["08:00"]'); } catch { distTimes = [sch.distribute_time || '08:00']; }
    if (!Array.isArray(distTimes)) distTimes = [String(distTimes)];
    const numSlots = distTimes.length;

    // Determine which slot to process next
    let lastSlot = sch.last_processed_slot || 0;
    if (sch.last_processed_date !== today) lastSlot = 0; // new day → reset slot counter

    // Find next unprocessed slot whose time has passed
    let slotToProcess = -1;
    for (let s = lastSlot; s < numSlots; s++) {
      const slotTime = (distTimes[s] || '08:00').slice(0, 5);
      if (nowHHMM >= slotTime) slotToProcess = s;
    }
    if (slotToProcess < 0) continue; // no slot ready yet
    // If already processed this slot today, skip
    if (sch.last_processed_date === today && slotToProcess < lastSlot) continue;
    if (sch.last_processed_date === today && slotToProcess === lastSlot - 1) continue;

    let saleList = JSON.parse(sch.sale_names || "[]");
    const leadIdList = [...new Set(JSON.parse(sch.lead_ids || "[]"))];

    // Guard: filter out sales no longer in the project
    if (saleList.length && sch.project_id) {
      const activeSales = await all(db,
        `SELECT u.display_name FROM users u INNER JOIN user_projects up ON up.user_id = u.id
         WHERE up.project_id = ? AND u.role = 'sale'`, [sch.project_id]);
      const activeNames = new Set(activeSales.map(r => r.display_name));
      const filtered = saleList.filter(s => activeNames.has(s));
      if (filtered.length < saleList.length) {
        const removed = saleList.filter(s => !activeNames.has(s));
        console.log(`[processSchedules] Schedule #${sch.id}: removed stale sales: ${removed.join(", ")}`);
        saleList = filtered;
        if (!saleList.length) {
          await run(db, "UPDATE lead_schedules SET is_active = 0, sale_names = '[]' WHERE id = ?", [sch.id]);
          continue;
        }
        const newTour = (sch.current_tour || 0) % saleList.length;
        await run(db, "UPDATE lead_schedules SET sale_names = ?, current_tour = ? WHERE id = ?",
          [JSON.stringify(saleList), newTour, sch.id]);
      }
    }

    if (!saleList.length || !leadIdList.length) continue;

    const currentTour = sch.current_tour || 0;
    const totalTours = saleList.length;

    const remaining = leadIdList.slice(sch.assigned_index);
    if (!remaining.length) {
      const nextTour = currentTour + 1;
      if (nextTour >= totalTours) {
        await run(db, "UPDATE lead_schedules SET is_active = 0 WHERE id = ?", [sch.id]);
      } else {
        await run(db, "UPDATE lead_schedules SET assigned_index = 0, current_tour = ? WHERE id = ?", [nextTour, sch.id]);
      }
      continue;
    }

    // Calculate leads for this slot: total perDay split EXACTLY across slots
    const perDay = sch.leads_per_day || 5;
    const slotsProcessedSoFar = sch.last_processed_date === today ? lastSlot : 0;
    // Exact distribution: first (perDay % numSlots) slots get floor+1, rest get floor
    const basePerSlot = Math.floor(perDay / numSlots);
    const extraSlots = perDay % numSlots;
    // Sum exact leads per person for slots [slotsProcessedSoFar..slotToProcess]
    let leadsPerPersonThisBatch = 0;
    for (let s = slotsProcessedSoFar; s <= slotToProcess; s++) {
      leadsPerPersonThisBatch += (s < extraSlots) ? basePerSlot + 1 : basePerSlot;
    }
    if (leadsPerPersonThisBatch <= 0) continue; // no leads for these slots
    const idealBatch = leadsPerPersonThisBatch * saleList.length;
    const batch = remaining.slice(0, Math.min(idealBatch, remaining.length));

    // Build per-sale assignment count: distribute evenly, max diff = 1 lead
    const numSales = saleList.length;
    const actualPerPerson = Math.floor(batch.length / numSales);
    const extraLeads = batch.length % numSales;
    // saleQuota[i] = how many leads sale i gets this batch
    const saleQuota = saleList.map((_, idx) => actualPerPerson + (idx < extraLeads ? 1 : 0));

    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const stmts = [];
    const assignedLeads = []; // {leadId, saleName} for Telegram
    const logEntries = []; // for assignment_log

    // Distribute leads: round-robin 1-by-1 across all sales (with tour offset)
    // Skip leads already assigned to the target sale (avoid duplicate from parallel schedules)
    const processedLids = new Set();
    const saleCounts = new Array(numSales).fill(0);
    let batchIdx = 0;
    let roundCounter = 0;
    while (batchIdx < batch.length) {
      const lid = batch[batchIdx];
      batchIdx++;
      if (processedLids.has(lid)) continue;

      // Skip locked leads (booking/cọc) — they should not be auto-redistributed
      const lockCheck = await get(db, "SELECT status FROM leads WHERE id = ?", [lid]);
      if (lockCheck && (lockCheck.status === "booked" || lockCheck.status === "booking_other")) {
        processedLids.add(lid);
        continue;
      }

      // Find next sale that still has quota, rotating with tour offset
      const roundIdx = roundCounter % numSales;
      const saleIdx = (roundIdx + currentTour) % numSales;
      let assignedIdx = saleIdx;
      if (saleCounts[assignedIdx] >= saleQuota[assignedIdx]) {
        let found = false;
        for (let j = 1; j < numSales; j++) {
          const tryIdx = (saleIdx + j) % numSales;
          if (saleCounts[tryIdx] < saleQuota[tryIdx]) { assignedIdx = tryIdx; found = true; break; }
        }
        if (!found) break; // all quotas filled
      }
      const saleName = saleList[assignedIdx];

      // Check if this sale already has this lead (from another schedule or manual assign)
      const existingLead = await get(db, "SELECT sale_name FROM leads WHERE id = ?", [lid]);
      if (existingLead && existingLead.sale_name === saleName) {
        // Same sale already has this lead → skip, don't re-assign or duplicate history
        processedLids.add(lid);
        logEntries.push({ leadId: lid, saleName, date: today, tour: currentTour, skipped: true });
        continue;
      }

      processedLids.add(lid);
      roundCounter++;
      saleCounts[assignedIdx]++;

      // Only set manager if lead has no manager yet
      const schLead = await get(db, "SELECT manager_name, status FROM leads WHERE id = ?", [lid]);
      if (schLead?.manager_name) {
        // Preserve existing status if sale already gave feedback, only reset to 'new' for unprocessed leads
        if (schLead.status && schLead.status !== "new") {
          stmts.push({ sql: "UPDATE leads SET sale_name = ? WHERE id = ?", args: [saleName, lid] });
        } else {
          stmts.push({ sql: "UPDATE leads SET sale_name = ?, status = 'new', raw_status = '' WHERE id = ?", args: [saleName, lid] });
        }
      } else {
        if (schLead?.status && schLead.status !== "new") {
          stmts.push({ sql: "UPDATE leads SET sale_name = ? WHERE id = ?", args: [saleName, lid] });
        } else {
          stmts.push({ sql: "UPDATE leads SET sale_name = ?, status = 'new', raw_status = '' WHERE id = ?", args: [saleName, lid] });
        }
      }
      // Only create 'Chia lead' history if this sale doesn't already have one for this lead
      const existingChia = await get(db, "SELECT id FROM lead_history WHERE lead_id = ? AND action = 'Chia lead' AND sale_name = ? LIMIT 1", [lid, saleName]);
      if (!existingChia) {
        const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [lid]);
        const nextSeq = (maxSeq?.m ?? -1) + 1;
        stmts.push({
          sql: "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
          args: [lid, saleName, "Chia lead", now, "", `Lịch chia tự động #${sch.id} (Tour ${currentTour + 1}/${totalTours})`, nextSeq, "schedule"],
        });
      }
      assignedLeads.push({ leadId: lid, saleName });
      logEntries.push({ leadId: lid, saleName, date: today, tour: currentTour });
    }

    // Append to assignment_log
    const existingLog = JSON.parse(sch.assignment_log || "[]");
    const updatedLog = [...existingLog, ...logEntries];

    const newIndex = sch.assigned_index + batch.length;
    let isDone = false;
    let newTour = currentTour;
    if (newIndex >= leadIdList.length) {
      const nextTour = currentTour + 1;
      if (nextTour >= totalTours) {
        isDone = true;
      } else {
        newTour = nextTour;
      }
    }
    const newSlot = slotToProcess + 1; // next slot to process
    stmts.push({
      sql: "UPDATE lead_schedules SET assigned_index = ?, last_processed_date = ?, last_processed_slot = ?, is_active = ?, assignment_log = ?, current_tour = ? WHERE id = ?",
      args: [isDone ? newIndex : (newIndex >= leadIdList.length ? 0 : newIndex), today, newSlot, isDone ? 0 : 1, JSON.stringify(updatedLog), newTour, sch.id],
    });

    await db.batch(stmts, "write");
    totalAssigned += batch.length;

    // Send Telegram notifications
    try {
      for (const { leadId, saleName } of assignedLeads) {
          const saleUser = await get(db, "SELECT telegram_id FROM users WHERE display_name = ? AND telegram_id != ''", [saleName]);
          if (!saleUser || !saleUser.telegram_id) continue;
          const lead = await get(db, "SELECT * FROM leads WHERE id = ?", [leadId]);
          if (!lead) continue;
          const activeBot = await getBotForProject(lead.project_id);
          if (!activeBot || !activeBot.token) continue;
          const projectRow = await get(db, "SELECT name FROM projects WHERE id = ?", [lead.project_id]);
          const msg = [
            `🔔 *BẠN CÓ LEAD MỚI*`,
            `Dự án: *${escMd(projectRow ? projectRow.name : "-")}*`,
            `----------------------------------------------`,
            `👤 Khách: *${escMd(lead.name || "N/A")}*`,
            `📞 SĐT: \`${lead.phone || "-"}\``,
            `🔗 Nhu cầu: ${escMd(lead.product || "-")}`,
            `🕒 Nhận lúc: ${now}`,
            `📋 Lịch chia tự động #${sch.id} (Tour ${currentTour + 1}/${totalTours})`,
            `--------------------------`,
            `📝 *FEEDBACK:*`,
            `Bấm nút bên dưới để cập nhật trạng thái.`,
          ].join("\n");
          const statusList = [
            ["interested", "Quan tâm"], ["low_interest", "QT hời hợt"], ["other_project", "QT DA khác"],
            ["consulting", "Đang tư vấn"], ["appointment", "Hẹn xem"], ["booked", "Giữ chỗ"],
            ["closed", "Chốt"], ["not_interested", "Không QT"], ["spam", "Phá/rác"],
            ["weak_finance", "TC yếu"], ["unreachable", "Chưa LLĐ"], ["callback", "Gọi lại sau"],
            ["wrong_number", "Sai số"], ["has_sale", "Có sale khác"],
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
            await run(db, "INSERT OR REPLACE INTO telegram_pending(telegram_id, lead_id, status, message_id, phone) VALUES(?, ?, '', ?, ?)", [saleUser.telegram_id, leadId, sentMsgId, lead.phone || ""]);
            if (sentMsgId) await run(db, "INSERT INTO telegram_lead_msgs(telegram_id, lead_id, message_id) VALUES(?, ?, ?)", [saleUser.telegram_id, leadId, sentMsgId]);
          } catch (teleErr) {
            console.error("[Telegram schedule] Send failed:", teleErr.message);
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
    const { projectId, saleNames: sNames, statusFilter, startDate, endDate, leadsPerDay, leadIds, distributeTimes } = req.body;
    if (!sNames || !sNames.length) return res.status(400).json({ error: "Cần chọn ít nhất 1 sale" });
    if (!leadIds || !leadIds.length) return res.status(400).json({ error: "Cần chọn ít nhất 1 lead" });
    if (!startDate || !endDate) return res.status(400).json({ error: "Cần chọn ngày bắt đầu và ngày kết thúc" });
    const distTimesArr = Array.isArray(distributeTimes) && distributeTimes.length > 0
      ? distributeTimes.map(t => String(t).slice(0, 5))
      : ['08:00'];
    const distTimeStr = JSON.stringify(distTimesArr);

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
      `INSERT INTO lead_schedules(project_id, status_filter, start_date, end_date, leads_per_day, sale_names, lead_ids, assigned_index, total_count, created_by, is_active, last_processed_date, assignment_log, distribute_time, last_processed_slot)
       VALUES(?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, '', ?, ?, 0)`,
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
        distTimeStr,
      ]
    );

    // Don't process immediately - let the scheduled time control when leads are distributed
    // processSchedules will run on next API call when the time is right

    const data = await readData(db);
    await filterDataForRole(data, req.user);
    const allSchedules = await all(db, "SELECT * FROM lead_schedules ORDER BY id DESC");
    res.json({
      msg: `Đã tạo lịch chia ${uniqueLeadIds.length} lead cho ${sNames.length} sale (${perDay} lead/ngày/người, ${distTimesArr.length} khung giờ: ${distTimesArr.join(', ')}). Giai đoạn: ${startDate} → ${endDate}`,
      schedules: allSchedules.map(formatSchedule),
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

/* PATCH /api/leads/schedules/:id - Update leads_per_day and distribute_time for active schedule */
app.patch("/api/leads/schedules/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const sch = await get(db, "SELECT * FROM lead_schedules WHERE id = ?", [req.params.id]);
    if (!sch) return res.status(404).json({ error: "Schedule not found" });
    if (!sch.is_active) return res.status(400).json({ error: "Chỉ có thể cập nhật lịch đang chạy" });
    const { leadsPerDay, distributeTimes } = req.body;
    const updates = [];
    const params = [];
    if (leadsPerDay !== undefined) {
      const v = Math.max(1, Math.min(100, Number(leadsPerDay) || 5));
      updates.push("leads_per_day = ?");
      params.push(v);
    }
    if (Array.isArray(distributeTimes) && distributeTimes.length > 0) {
      const arr = distributeTimes.map(t => String(t).slice(0, 5));
      updates.push("distribute_time = ?");
      params.push(JSON.stringify(arr));
      // Reset last_processed_slot so new slots take effect from now
      updates.push("last_processed_slot = 0");
    }
    if (!updates.length) return res.status(400).json({ error: "Không có gì để cập nhật" });
    params.push(req.params.id);
    await run(db, `UPDATE lead_schedules SET ${updates.join(", ")} WHERE id = ?`, params);
    const allSchedules = await all(db, "SELECT * FROM lead_schedules ORDER BY id DESC");
    res.json({ msg: "Đã cập nhật lịch chia lead", schedules: allSchedules.map(formatSchedule) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update schedule" });
  }
});

/* DELETE /api/leads/schedules/:id - Cancel a schedule */
app.delete("/api/leads/schedules/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await run(db, "UPDATE lead_schedules SET is_active = 0 WHERE id = ?", [req.params.id]);
    const schedules = await all(db, "SELECT * FROM lead_schedules ORDER BY id DESC");
    res.json({ msg: "Đã hủy lịch chia lead (lead đã chia giữ nguyên)", schedules: schedules.map(formatSchedule) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to cancel schedule" });
  }
});

/* POST /api/leads/schedules/:id/revoke - Revoke all assigned leads from this schedule */
app.post("/api/leads/schedules/:id/revoke", requireAuth, requireAdmin, async (req, res) => {
  try {
    const sch = await get(db, "SELECT * FROM lead_schedules WHERE id = ?", [req.params.id]);
    if (!sch) return res.status(404).json({ error: "Không tìm thấy lịch chia" });

    const assignmentLog = JSON.parse(sch.assignment_log || "[]");
    const assignedEntries = assignmentLog.filter(e => !e.skipped);
    if (!assignedEntries.length) return res.json({ msg: "Không có lead nào để thu hồi", schedules: (await all(db, "SELECT * FROM lead_schedules ORDER BY id DESC")).map(formatSchedule) });

    const stmts = [];
    let revokedCount = 0;

    for (const entry of assignedEntries) {
      const lid = entry.leadId;
      // Delete the "Chia lead" history entry for this schedule
      const hist = await get(db, "SELECT id FROM lead_history WHERE lead_id = ? AND action = 'Chia lead' AND feedback LIKE ? ORDER BY seq DESC LIMIT 1",
        [lid, `%#${sch.id}%`]);
      if (hist) {
        stmts.push({ sql: "DELETE FROM lead_history WHERE id = ?", args: [hist.id] });
      }
      // Check if this lead still has the sale from this schedule
      const lead = await get(db, "SELECT sale_name, project_id FROM leads WHERE id = ?", [lid]);
      if (lead && lead.sale_name === entry.saleName) {
        // Delete Telegram notification messages for this lead
        try {
          const saleUser = await get(db, "SELECT telegram_id FROM users WHERE display_name = ? AND telegram_id != ''", [entry.saleName]);
          if (saleUser && saleUser.telegram_id) {
            const activeBot = await getBotForProject(lead.project_id);
            if (activeBot && activeBot.token) {
              const trackedMsgs = await all(db, "SELECT message_id FROM telegram_lead_msgs WHERE telegram_id = ? AND lead_id = ?", [saleUser.telegram_id, lid]);
              for (const tm of trackedMsgs) {
                try {
                  await fetch(`https://api.telegram.org/bot${activeBot.token}/deleteMessage`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: saleUser.telegram_id, message_id: tm.message_id }),
                  });
                } catch (_) {}
              }
              await run(db, "DELETE FROM telegram_lead_msgs WHERE telegram_id = ? AND lead_id = ?", [saleUser.telegram_id, lid]);

              // Send recall notice
              const projectRow = await get(db, "SELECT name FROM projects WHERE id = ?", [lead.project_id]);
              const leadRow = await get(db, "SELECT name FROM leads WHERE id = ?", [lid]);
              await fetch(`https://api.telegram.org/bot${activeBot.token}/sendMessage`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: saleUser.telegram_id,
                  text: `🚫 *LEAD ĐÃ BỊ THU HỒI*\nDự án: *${escMd(projectRow ? projectRow.name : "-")}*\n----------------------------------------------\n👤 Khách: *${escMd(leadRow ? leadRow.name : "N/A")}*\n\n❌ _Lead này đã được Admin thu hồi._\n_Bạn không cần liên hệ khách hàng này nữa._`,
                  parse_mode: "Markdown",
                }),
              });
            }
          }
        } catch (teleErr) {
          console.error("[Telegram] Schedule revoke message failed:", teleErr.message);
        }

        // Revert to previous sale or clear
        const prev = await get(db, "SELECT sale_name FROM lead_history WHERE lead_id = ? AND action = 'Chia lead' AND feedback NOT LIKE ? ORDER BY seq DESC LIMIT 1",
          [lid, `%#${sch.id}%`]);
        if (prev) {
          stmts.push({ sql: "UPDATE leads SET sale_name = ? WHERE id = ?", args: [prev.sale_name, lid] });
        } else {
          stmts.push({ sql: "UPDATE leads SET sale_name = '', sale_id = NULL WHERE id = ?", args: [lid] });
        }
        revokedCount++;
      }
    }

    // Deactivate schedule and clear log
    stmts.push({ sql: "UPDATE lead_schedules SET is_active = 0, assignment_log = '[]', assigned_index = 0 WHERE id = ?", args: [sch.id] });

    if (stmts.length > 0) await db.batch(stmts, "write");

    const schedules = await all(db, "SELECT * FROM lead_schedules ORDER BY id DESC");
    res.json({ msg: `Thu hồi thành công ${revokedCount} lead từ lịch #${sch.id}`, schedules: schedules.map(formatSchedule) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to revoke schedule" });
  }
});

/* POST /api/leads/schedules/:id/restore - Restore leads to sales that had feedback history */
app.post("/api/leads/schedules/:id/restore", requireAuth, requireAdmin, async (req, res) => {
  try {
    const sch = await get(db, "SELECT * FROM lead_schedules WHERE id = ?", [req.params.id]);
    if (!sch) return res.status(404).json({ error: "Không tìm thấy lịch chia" });

    const assignmentLog = JSON.parse(sch.assignment_log || "[]");
    const leadIds = [...new Set(JSON.parse(sch.lead_ids || "[]"))];
    // Collect all lead IDs from assignment log + lead_ids
    const allLids = [...new Set([...assignmentLog.filter(e => !e.skipped).map(e => e.leadId), ...leadIds])];
    if (!allLids.length) return res.json({ msg: "Không có lead nào để khôi phục", schedules: (await all(db, "SELECT * FROM lead_schedules ORDER BY id DESC")).map(formatSchedule) });

    const stmts = [];
    let restoredCount = 0;
    let chiaEntriesAdded = 0;
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    for (const lid of allLids) {
      const lead = await get(db, "SELECT sale_name FROM leads WHERE id = ?", [lid]);
      if (!lead) continue;
      // Only restore if lead currently has no sale
      if (lead.sale_name && lead.sale_name !== '' && lead.sale_name !== 'Chưa chia') continue;

      // Find ALL distinct sales from history
      const allSales = await all(db,
        "SELECT DISTINCT sale_name FROM lead_history WHERE lead_id = ? AND sale_name != '' ORDER BY seq ASC",
        [lid]
      );
      if (!allSales.length) continue;

      // Set primary sale_name
      const lastFeedback = await get(db,
        "SELECT sale_name FROM lead_history WHERE lead_id = ? AND action != 'Chia lead' AND action NOT LIKE '%thu h%' AND sale_name != '' ORDER BY seq DESC LIMIT 1",
        [lid]
      );
      const lastChia = await get(db,
        "SELECT sale_name FROM lead_history WHERE lead_id = ? AND action = 'Chia lead' AND sale_name != '' ORDER BY seq DESC LIMIT 1",
        [lid]
      );
      const primarySale = (lastFeedback && lastFeedback.sale_name) || (lastChia && lastChia.sale_name);
      if (!primarySale) continue;

      stmts.push({ sql: "UPDATE leads SET sale_name = ? WHERE id = ?", args: [primarySale, lid] });
      restoredCount++;

      // Ensure 'Chia lead' entries for all other sales
      for (const row of allSales) {
        if (row.sale_name === primarySale) continue;
        const existing = await get(db,
          "SELECT id FROM lead_history WHERE lead_id = ? AND action = 'Chia lead' AND sale_name = ? LIMIT 1",
          [lid, row.sale_name]
        );
        if (!existing) {
          const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [lid]);
          const nextSeq = (maxSeq?.m ?? -1) + 1;
          stmts.push({
            sql: "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
            args: [lid, row.sale_name, "Chia lead", now, "", "Khôi phục từ lịch sử", nextSeq, "restore"],
          });
          chiaEntriesAdded++;
        }
      }
    }

    if (stmts.length > 0) await db.batch(stmts, "write");

    const schedules = await all(db, "SELECT * FROM lead_schedules ORDER BY id DESC");
    res.json({ msg: `Khôi phục ${restoredCount} lead về sale cũ từ lịch #${sch.id} (thêm ${chiaEntriesAdded} lượt chia)`, schedules: schedules.map(formatSchedule) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to restore schedule" });
  }
});

/* POST /api/leads/restore-by-project - Restore unassigned leads to ALL sales from history */
app.post("/api/leads/restore-by-project", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { projectId } = req.body || {};
    if (!projectId) return res.status(400).json({ error: "Thiếu projectId" });

    const unassigned = await all(db,
      "SELECT id FROM leads WHERE project_id = ? AND (sale_name = '' OR sale_name = 'Chưa chia' OR sale_name IS NULL)",
      [projectId]
    );
    if (!unassigned.length) return res.json({ msg: "Không có lead nào cần khôi phục (tất cả đã có sale)", restored: 0, salesRestored: 0 });

    const stmts = [];
    let restoredCount = 0;
    let chiaEntriesAdded = 0;
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    for (const { id: lid } of unassigned) {
      // Find ALL distinct sales that ever interacted with this lead
      const allSales = await all(db,
        "SELECT DISTINCT sale_name FROM lead_history WHERE lead_id = ? AND sale_name != '' ORDER BY seq ASC",
        [lid]
      );
      if (!allSales.length) continue;

      // Set sale_name to the last sale that gave feedback (primary)
      const lastFeedback = await get(db,
        "SELECT sale_name FROM lead_history WHERE lead_id = ? AND action != 'Chia lead' AND action NOT LIKE '%thu h%' AND sale_name != '' ORDER BY seq DESC LIMIT 1",
        [lid]
      );
      const lastChia = await get(db,
        "SELECT sale_name FROM lead_history WHERE lead_id = ? AND action = 'Chia lead' AND sale_name != '' ORDER BY seq DESC LIMIT 1",
        [lid]
      );
      const primarySale = (lastFeedback && lastFeedback.sale_name) || (lastChia && lastChia.sale_name);
      if (!primarySale) continue;

      stmts.push({ sql: "UPDATE leads SET sale_name = ? WHERE id = ?", args: [primarySale, lid] });
      restoredCount++;

      // For each OTHER sale, ensure a 'Chia lead' history entry exists so they can see this lead
      for (const row of allSales) {
        if (row.sale_name === primarySale) continue;
        const existing = await get(db,
          "SELECT id FROM lead_history WHERE lead_id = ? AND action = 'Chia lead' AND sale_name = ? LIMIT 1",
          [lid, row.sale_name]
        );
        if (!existing) {
          const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [lid]);
          const nextSeq = (maxSeq?.m ?? -1) + 1;
          stmts.push({
            sql: "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
            args: [lid, row.sale_name, "Chia lead", now, "", "Khôi phục từ lịch sử", nextSeq, "restore"],
          });
          chiaEntriesAdded++;
        }
      }
    }

    if (stmts.length > 0) await db.batch(stmts, "write");

    const salesSet = new Set();
    for (const { id: lid } of unassigned) {
      const sales = await all(db, "SELECT DISTINCT sale_name FROM lead_history WHERE lead_id = ? AND sale_name != ''", [lid]);
      sales.forEach(s => salesSet.add(s.sale_name));
    }

    res.json({
      msg: `Khôi phục ${restoredCount} lead về ${salesSet.size} sale (thêm ${chiaEntriesAdded} lượt chia để sale cũ thấy lead)`,
      restored: restoredCount,
      salesRestored: salesSet.size,
      chiaEntriesAdded,
      total: unassigned.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to restore by project" });
  }
});

/* GET /api/leads/restore-preview/:projectId - Preview how many leads can be restored */
app.get("/api/leads/restore-preview/:projectId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const unassigned = await all(db,
      "SELECT id FROM leads WHERE project_id = ? AND (sale_name = '' OR sale_name = 'Chưa chia' OR sale_name IS NULL)",
      [projectId]
    );
    let restorable = 0;
    const salesMap = {};
    for (const { id: lid } of unassigned) {
      const sales = await all(db,
        "SELECT DISTINCT sale_name FROM lead_history WHERE lead_id = ? AND sale_name != ''",
        [lid]
      );
      if (sales.length > 0) {
        restorable++;
        sales.forEach(s => { salesMap[s.sale_name] = (salesMap[s.sale_name] || 0) + 1; });
      }
    }
    res.json({ totalUnassigned: unassigned.length, restorable, salesBreakdown: salesMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function formatSchedule(s) {
  const saleNames = JSON.parse(s.sale_names || "[]");
  let distributeTimes = [];
  try { distributeTimes = JSON.parse(s.distribute_time || '["08:00"]'); } catch { distributeTimes = [s.distribute_time || '08:00']; }
  if (!Array.isArray(distributeTimes)) distributeTimes = [String(distributeTimes)];
  return {
    id: s.id,
    projectId: s.project_id,
    statusFilter: s.status_filter,
    startDate: s.start_date || "",
    endDate: s.end_date,
    leadsPerDay: s.leads_per_day,
    saleNames,
    leadIds: JSON.parse(s.lead_ids || "[]"),
    assignedIndex: s.assigned_index,
    totalCount: s.total_count,
    createdBy: s.created_by,
    createdAt: s.created_at,
    isActive: Boolean(s.is_active),
    lastProcessedDate: s.last_processed_date || "",
    assignmentLog: JSON.parse(s.assignment_log || "[]"),
    distributeTimes,
    currentTour: s.current_tour || 0,
    totalTours: saleNames.length,
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
    (l.saleHistory && l.saleHistory.some(h => matchSaleName(h.saleName, displayName)))
  );
  // Override status: show the sale's own latest feedback status instead of global
  // If this sale has never given feedback on a lead assigned to them → show "Chưa feedback" (new)
  for (const l of data.leads) {
    let foundOwnStatus = false;
    let lastSaleUpdate = null;
    if (l.saleHistory && l.saleHistory.length) {
      // Walk from newest to oldest, skip "Chia lead" entries (don't break at them)
      // This handles re-assignment: sale may have feedback BEFORE a later "Chia lead" to same sale
      for (let i = l.saleHistory.length - 1; i >= 0; i--) {
        const h = l.saleHistory[i];
        if (h.action === "Chia lead") continue; // Skip assignment entries
        if (matchSaleName(h.saleName, displayName)) {
          if (!lastSaleUpdate) {
            lastSaleUpdate = { date: h.date, status: h.status ? normalizeStatus(h.status) : null, feedback: h.feedback, action: h.action, source: h.source };
          }
          if (h.status && !foundOwnStatus) {
            l.status = normalizeStatus(h.status);
            l.rawStatus = h.status;
            foundOwnStatus = true;
          }
          if (foundOwnStatus && lastSaleUpdate) break;
        }
      }
    }
    l.lastSaleUpdate = lastSaleUpdate;
    // Only force "new" if lead was assigned to this sale via CRM (has a non-sheet "Chia lead" entry)
    // Leads only assigned via Google Sheets keep their existing status
    if (!foundOwnStatus && matchSaleName(l.saleName, displayName)) {
      const hasCrmAssignment = l.saleHistory && l.saleHistory.some(h =>
        h.action === "Chia lead" && h.source !== "sheet" && matchSaleName(h.saleName, displayName)
      );
      if (hasCrmAssignment) {
        l.status = "new";
        l.rawStatus = "";
      }
    }
  }
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

/* ===== Dedicated Manager Change endpoint (clean, verified write) ===== */
app.post("/api/leads/:id/manager", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Wait for sync to finish to avoid race condition (max 15s)
    if (syncInProgress) {
      const t0 = Date.now();
      while (syncInProgress && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 200));
    }
    const leadId = Number(req.params.id);
    const { managerName, phone, name } = req.body || {};
    console.log(`[POST /api/leads/${leadId}/manager] managerName=${managerName} name=${name} phone=${phone} user=${req.user.displayName} role=${req.user.role}`);

    if (!managerName) return res.status(400).json({ error: "managerName is required" });

    // Find the lead by ID first, fallback to name+phone
    let actualId = leadId;
    let lead = await get(db, "SELECT id, phone, manager_name FROM leads WHERE id = ?", [leadId]);
    if (!lead && name && phone) {
      lead = await get(db, "SELECT id, phone, manager_name FROM leads WHERE name = ? AND phone = ? ORDER BY id DESC LIMIT 1", [name, phone]);
      if (lead) {
        actualId = lead.id;
        console.log(`[PATCH manager] ID ${leadId} not found, resolved by name+phone ${name}/${phone} -> ID ${actualId}`);
      }
    }
    if (!lead) return res.status(404).json({ error: `Lead not found (ID=${leadId}, name=${name})` });

    const oldManager = lead.manager_name;
    console.log(`[PATCH manager] lead#${actualId} old_manager=${oldManager} new_manager=${managerName}`);

    // Direct UPDATE
    const result = await run(db, "UPDATE leads SET manager_name = ? WHERE id = ?", [managerName, actualId]);
    console.log(`[PATCH manager] UPDATE result: ${result.changes} rows affected`);

    if (result.changes === 0) {
      return res.status(500).json({ error: `UPDATE affected 0 rows for lead#${actualId}` });
    }

    // Verify the write by reading back
    const verified = await get(db, "SELECT id, phone, manager_name FROM leads WHERE id = ?", [actualId]);
    console.log(`[PATCH manager] VERIFY read-back: manager_name=${verified?.manager_name}`);

    if (!verified || verified.manager_name !== managerName) {
      return res.status(500).json({ error: `Write verification failed: wrote "${managerName}", read back "${verified?.manager_name}"` });
    }

    lastSyncHash = ""; // invalidate so next poll re-fetches
    emitDataChanged("patch-manager");
    res.json({ ok: true, updatedLead: { id: actualId, phone: verified.phone, managerName: verified.manager_name } });
  } catch (err) {
    console.error(`[POST manager] ERROR:`, err);
    res.status(500).json({ error: err.message || "Manager update failed" });
  }
});

app.put("/api/leads/:id", requireAuth, async (req, res) => {
  try {
    console.log(`[PUT /api/leads] version=${BUILD_VERSION} body=${JSON.stringify(req.body)} user=${req.user?.displayName} role=${req.user?.role}`);
    // Wait for sync to finish to avoid race condition (max 15s)
    if (syncInProgress) {
      console.log(`[PUT /api/leads] Waiting for sync to finish...`);
      const t0 = Date.now();
      while (syncInProgress && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 200));
      console.log(`[PUT /api/leads] Sync wait done (${Date.now() - t0}ms)`);
    }
    const leadId = Number(req.params.id);
    const phone = req.body?.phone;
    const name = req.body?.name;
    console.log(`[PUT /api/leads/${leadId}] body:`, JSON.stringify(req.body), `user: ${req.user.displayName} role: ${req.user.role}`);

    // Verify lead exists; if ID stale (after sync), try finding by name+phone
    let actualLeadId = leadId;
    const existCheck = await get(db, "SELECT id, phone, manager_name, sale_name FROM leads WHERE id = ?", [leadId]);
    if (!existCheck && name && phone) {
      const byNamePhone = await get(db, "SELECT id, phone, manager_name, sale_name FROM leads WHERE name = ? AND phone = ? ORDER BY id DESC LIMIT 1", [name, phone]);
      if (byNamePhone) {
        actualLeadId = byNamePhone.id;
        console.log(`[PUT /api/leads] ID ${leadId} not found, resolved by name+phone ${name}/${phone} -> ID ${actualLeadId}`);
      } else {
        return res.status(404).json({ error: `Lead không tồn tại (ID=${leadId}, name=${name})` });
      }
    } else if (!existCheck) {
      return res.status(404).json({ error: `Lead không tồn tại (ID=${leadId})` });
    }

    // Sale can only update leads assigned to them (current or ever assigned via history)
    if (req.user.role === "sale") {
      const lead = existCheck || await get(db, "SELECT sale_name FROM leads WHERE id = ?", [actualLeadId]);
      const currentMatch = lead && matchSaleName(lead.sale_name, req.user.displayName);
      let historyMatch = false;
      if (!currentMatch) {
        const hist = await get(db, "SELECT id FROM lead_history WHERE lead_id = ? AND action = 'Chia lead' AND LOWER(TRIM(sale_name)) = LOWER(TRIM(?)) LIMIT 1", [actualLeadId, req.user.displayName]);
        historyMatch = !!hist;
      }
      if (!currentMatch && !historyMatch) {
        return res.status(403).json({ error: "You can only update your own leads" });
      }
    }

    // Block status changes on locked leads for non-admin
    if (req.body.status !== undefined) {
      const lockCheck = await get(db, "SELECT is_locked FROM leads WHERE id = ?", [actualLeadId]);
      if (lockCheck && lockCheck.is_locked && req.user.role !== "admin") {
        return res.status(403).json({ error: "Lead đã bị khóa, không thể thay đổi trạng thái. Liên hệ Admin để mở khóa." });
      }
    }

    const { status, notes, saleId, saleName, isHot, managerName } = req.body;
    const sets = [];
    const params = [];

    // Admin/Manager can change sale assignment and isHot
    let reassigning = false;
    let managerChangeRequested = managerName !== undefined && saleName === undefined;
    let managerChangeApplied = false;
    if (req.user.role === "admin" || req.user.role === "manager") {
      if (saleId !== undefined) { sets.push("sale_id = ?"); params.push(saleId); }
      if (saleName !== undefined) {
        sets.push("sale_name = ?"); params.push(saleName);
        // Reset status to "new" (Chưa feedback) when reassigning to a new sale
        if (status === undefined) { reassigning = true; sets.push("status = ?"); params.push("new"); }
      }
      // Admin can directly reassign manager (without changing sale)
      if (managerChangeRequested) {
        sets.push("manager_name = ?"); params.push(managerName);
        managerChangeApplied = true;
        console.log(`[PUT /api/leads/${actualLeadId}] Reassigning manager to: ${managerName} by ${req.user.displayName}`);
      }
      if (isHot !== undefined) { sets.push("is_hot = ?"); params.push(isHot ? 1 : 0); }
    }
    // Block: if manager change was requested but role prevented it
    if (managerChangeRequested && !managerChangeApplied) {
      console.log(`[PUT /api/leads/${actualLeadId}] BLOCKED: manager change requested by role=${req.user.role}, only admin/manager allowed`);
      return res.status(403).json({ error: `Chỉ admin/manager mới được đổi quản lý (role hiện tại: ${req.user.role})` });
    }
    if (status !== undefined) { sets.push("status = ?"); params.push(status); }
    if (status === "closed") { sets.push("is_locked = ?"); params.push(1); }
    if (notes !== undefined) { sets.push("notes = ?"); params.push(notes); }

    if (sets.length) {
      // Log status change
      if (status !== undefined || reassigning) {
        const oldLead = await get(db, "SELECT status FROM leads WHERE id = ?", [actualLeadId]);
        const oldStatus = oldLead?.status || "new";
        const newStatus = status !== undefined ? status : "new";
        if (oldStatus !== newStatus) {
          await run(db, "INSERT INTO lead_status_log(lead_id, old_status, new_status, changed_by, changed_at) VALUES(?, ?, ?, ?, ?)",
            [actualLeadId, oldStatus, newStatus, req.user.displayName, new Date().toISOString()]);

          // Record status change in lead_history so it's visible in the timeline
          if (status !== undefined) {
            const statusLabel = STATUS_LABELS_VI[newStatus] || newStatus;
            const maxSeqH = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [actualLeadId]);
            const nextSeqH = (maxSeqH?.m ?? -1) + 1;
            const nowH = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
            const roleLabel = req.user.role === "admin" ? "Admin" : "Quản lý";
            await run(db,
              "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
              [actualLeadId, req.user.displayName, `${roleLabel} cập nhật trạng thái`, nowH, statusLabel, `Đổi trạng thái từ "${STATUS_LABELS_VI[oldStatus] || oldStatus}" sang "${statusLabel}"`, nextSeqH, req.user.role]
            );
          }
        }
      }
      params.push(actualLeadId);
      const result = await run(db, `UPDATE leads SET ${sets.join(", ")} WHERE id = ?`, params);
      console.log(`[PUT /api/leads/${actualLeadId}] UPDATE result: ${result.changes} rows affected, sets=[${sets.join(', ')}]`);
      if (result.changes === 0) {
        return res.status(404).json({ error: `Không thể cập nhật lead (ID=${actualLeadId}, 0 rows affected)` });
      }

      // Fire CAPI event if status changed to a trigger status
      if (status !== undefined && !reassigning) {
        try {
          const eventsJson = (await get(db, "SELECT value FROM settings WHERE key='capi_events'"))?.value;
          const eventMap = eventsJson ? JSON.parse(eventsJson) : CAPI_EVENT_MAP;
          const eventName = eventMap[status];
          if (eventName) {
            const updatedLead = await get(db, "SELECT * FROM leads WHERE id = ?", [actualLeadId]);
            const capiResult = await sendCapiEvent(db, updatedLead, eventName);
            await run(db, "INSERT INTO capi_log(lead_id, event_name, lead_name, lead_phone, project, status, result) VALUES(?,?,?,?,?,?,?)",
              [actualLeadId, eventName, updatedLead?.name || "", updatedLead?.phone || "", updatedLead?.product || "", status, JSON.stringify(capiResult || {})]);
          }
        } catch (capiErr) { console.error("[CAPI] Hook error:", capiErr.message); }
      }
    }

    // When admin/manager assigns lead to a sale: save history + send Telegram
    if ((req.user.role === "admin" || req.user.role === "manager") && saleName) {
      const lead = await get(db, "SELECT * FROM leads WHERE id = ?", [actualLeadId]);
      const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [actualLeadId]);
      const nextSeq = (maxSeq?.m ?? -1) + 1;
      await run(
        db,
        "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
        [actualLeadId, saleName, "Chia lead", now, "", `Admin ${req.user.displayName} chia lead`, nextSeq, "admin"]
      );

      // Send Telegram notification with inline keyboard
      try {
        const activeBot = lead ? await getBotForProject(lead.project_id) : await get(db, "SELECT token FROM telegram_bots WHERE is_active = 1 LIMIT 1");
        const saleUser = await get(db, "SELECT telegram_id FROM users WHERE display_name = ? AND telegram_id != ''", [saleName]);
        if (activeBot && activeBot.token && saleUser && saleUser.telegram_id) {
          const projectRow = lead ? await get(db, "SELECT name FROM projects WHERE id = ?", [lead.project_id]) : null;
          const msg = [
            `🔔 *BẠN CÓ LEAD MỚI*`,
            `Dự án: *${escMd(projectRow ? projectRow.name : "-")}*`,
            `----------------------------------------------`,
            `👤 Khách: *${escMd(lead ? lead.name : "N/A")}*`,
            `📞 SĐT: \`${lead ? lead.phone || "-" : "-"}\``,
            `🔗 Nhu cầu: ${escMd(lead ? lead.product || "-" : "-")}`,
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
            ["interested", "Quan tâm"], ["low_interest", "QT hời hợt"], ["other_project", "QT DA khác"],
            ["consulting", "Đang tư vấn"], ["appointment", "Hẹn xem"], ["booked", "Giữ chỗ"],
            ["closed", "Chốt"], ["not_interested", "Không QT"], ["spam", "Phá/rác"],
            ["weak_finance", "TC yếu"], ["unreachable", "Chưa LLĐ"], ["callback", "Gọi lại sau"],
            ["wrong_number", "Sai số"], ["has_sale", "Có sale khác"],
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

          // Save pending state for this user (include message_id and phone for recall/fallback)
          await run(db, "INSERT OR REPLACE INTO telegram_pending(telegram_id, lead_id, status, message_id, phone) VALUES(?, ?, '', ?, ?)", [saleUser.telegram_id, actualLeadId, sentMsgId, lead ? lead.phone || "" : ""]);
          if (sentMsgId) await run(db, "INSERT INTO telegram_lead_msgs(telegram_id, lead_id, message_id) VALUES(?, ?, ?)", [saleUser.telegram_id, actualLeadId, sentMsgId]);
        }
      } catch (teleErr) {
        console.error("[Telegram] Send failed:", teleErr.message);
      }
    }

    // For manager-only changes, return targeted update (avoids race with sync)
    if (managerName !== undefined && saleName === undefined && status === undefined && notes === undefined && isHot === undefined) {
      const updated = await get(db, "SELECT id, phone, manager_name, project_id FROM leads WHERE id = ?", [actualLeadId]);
      console.log(`[PUT /api/leads/${actualLeadId}] Verify after update: manager_name="${updated?.manager_name}" (expected="${managerName}")`);
      // Verify the write actually happened
      if (!updated || updated.manager_name !== managerName) {
        console.error(`[PUT /api/leads/${actualLeadId}] WRITE VERIFICATION FAILED: DB has "${updated?.manager_name}" but expected "${managerName}"`);
        return res.status(500).json({ error: `Ghi DB thất bại: DB="${updated?.manager_name}" nhưng cần="${managerName}"` });
      }
      lastSyncHash = ""; // invalidate so next poll re-fetches
      emitDataChanged("update-manager");
      return res.json({ updatedLead: { id: actualLeadId, phone: updated.phone, managerName: updated.manager_name } });
    }

    lastSyncHash = ""; // invalidate hash after any lead change
    emitDataChanged("update-lead");
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
    // Wait for any running sync to finish to avoid race condition (sync overwrites status)
    if (syncInProgress) {
      const t0 = Date.now();
      while (syncInProgress && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 200));
    }
    const leadId = Number(req.params.id);
    const lead = await get(db, "SELECT * FROM leads WHERE id = ?", [leadId]);
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    // Sale can only add history to their own leads (current or ever assigned)
    if (req.user.role === "sale" && !matchSaleName(lead.sale_name, req.user.displayName)) {
      const hist = await get(db, "SELECT id FROM lead_history WHERE lead_id = ? AND action = 'Chia lead' AND LOWER(TRIM(sale_name)) = LOWER(TRIM(?)) LIMIT 1", [leadId, req.user.displayName]);
      if (!hist) return res.status(403).json({ error: "You can only update your own leads" });
    }

    // Block locked leads for non-admin
    if (lead.is_locked && req.user.role !== "admin") {
      return res.status(403).json({ error: "Lead đã bị khóa. Liên hệ Admin để mở khóa." });
    }

    const { status, feedback } = req.body;
    const saleName = req.user.displayName;
    const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [leadId]);
    const nextSeq = (maxSeq?.m ?? -1) + 1;
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    await run(
      db,
      "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
      [leadId, saleName, "Cập nhật", now, status || "", feedback || "", nextSeq, req.user.role === "sale" ? "sale" : "admin"]
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

      // Fire CAPI event if status triggers it
      try {
        const eventsJson = (await get(db, "SELECT value FROM settings WHERE key='capi_events'"))?.value;
        const eventMap = eventsJson ? JSON.parse(eventsJson) : CAPI_EVENT_MAP;
        const eventName = eventMap[newNorm];
        if (eventName) {
          const updatedLead = await get(db, "SELECT * FROM leads WHERE id = ?", [leadId]);
          const capiResult = await sendCapiEvent(db, updatedLead, eventName);
          await run(db, "INSERT INTO capi_log(lead_id, event_name, lead_name, lead_phone, project, status, result) VALUES(?,?,?,?,?,?,?)",
            [leadId, eventName, lead.name || "", lead.phone || "", updatedLead.product || "", newNorm, JSON.stringify(capiResult || {})]);
        }
      } catch (capiErr) { console.error("[CAPI] Hook error:", capiErr.message); }
    }

    lastSyncHash = "";
    emitDataChanged("lead-history-update");

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
        const activeBot = lead ? await getBotForProject(lead.project_id) : await get(db, "SELECT token FROM telegram_bots WHERE is_active = 1 LIMIT 1");
        const saleUser = await get(db, "SELECT telegram_id FROM users WHERE display_name = ? AND telegram_id != ''", [hist.sale_name]);
        if (activeBot && activeBot.token && saleUser && saleUser.telegram_id) {
          // Delete ALL tracked notification messages for this lead from this sale
          const trackedMsgs = await all(db, "SELECT message_id FROM telegram_lead_msgs WHERE telegram_id = ? AND lead_id = ?", [saleUser.telegram_id, leadId]);
          for (const tm of trackedMsgs) {
            try {
              await fetch(`https://api.telegram.org/bot${activeBot.token}/deleteMessage`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: saleUser.telegram_id, message_id: tm.message_id }),
              });
            } catch (_) {}
          }
          await run(db, "DELETE FROM telegram_lead_msgs WHERE telegram_id = ? AND lead_id = ?", [saleUser.telegram_id, leadId]);

          // Also try deleting from legacy pending
          const pending = await get(db, "SELECT message_id FROM telegram_pending WHERE telegram_id = ?", [saleUser.telegram_id]);
          if (pending && pending.message_id) {
            try {
              await fetch(`https://api.telegram.org/bot${activeBot.token}/deleteMessage`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: saleUser.telegram_id, message_id: pending.message_id }),
              });
            } catch (_) {}
          }

          // Send recall notification
          const projectRow = lead ? await get(db, "SELECT name FROM projects WHERE id = ?", [lead.project_id]) : null;
          const recallMsg = [
            `🚫 *LEAD ĐÃ BỊ THU HỒI*`,
            `Dự án: *${escMd(projectRow ? projectRow.name : "-")}*`,
            `----------------------------------------------`,
            `👤 Khách: *${escMd(lead ? lead.name : "N/A")}*`,
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

    lastSyncHash = "";
    emitDataChanged("lead-history-delete");

    const data = await readData(db);
    await filterDataForRole(data, req.user);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===== Deal Value (admin sets value for closed leads) ===== */
app.put("/api/leads/:id/deal-value", requireAuth, requireAdmin, async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const { dealValue } = req.body;
    if (dealValue === undefined || dealValue === null || isNaN(Number(dealValue)) || Number(dealValue) < 0) {
      return res.status(400).json({ error: "Giá trị deal không hợp lệ" });
    }
    const lead = await get(db, "SELECT id, status, name, sale_name FROM leads WHERE id = ?", [leadId]);
    if (!lead) return res.status(404).json({ error: "Lead không tồn tại" });
    if (lead.status !== "closed") return res.status(400).json({ error: "Chỉ có thể nhập giá trị cho lead đã Chốt" });

    await run(db, "UPDATE leads SET deal_value = ?, is_locked = 1 WHERE id = ?", [Number(dealValue), leadId]);

    // Log in history
    const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [leadId]);
    const nextSeq = (maxSeq?.m ?? -1) + 1;
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const fmtValue = Number(dealValue).toLocaleString("vi-VN") + " ₫";
    await run(db,
      "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
      [leadId, req.user.displayName, "Nhập giá trị deal", now, "Chốt", `Giá trị: ${fmtValue} — Lead đã khóa`, nextSeq, "admin"]
    );

    lastSyncHash = "";
    emitDataChanged("deal-value-update");
    const data = await readData(db);
    await filterDataForRole(data, req.user);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || "Update deal value failed" });
  }
});

/* ===== Admin Lock/Unlock Lead ===== */
app.put("/api/leads/:id/lock", requireAuth, requireAdmin, async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const { locked } = req.body; // true = lock, false = unlock
    const lead = await get(db, "SELECT id, name, sale_name, is_locked FROM leads WHERE id = ?", [leadId]);
    if (!lead) return res.status(404).json({ error: "Lead không tồn tại" });

    const newLocked = locked ? 1 : 0;
    await run(db, "UPDATE leads SET is_locked = ? WHERE id = ?", [newLocked, leadId]);

    // Log in history
    const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [leadId]);
    const nextSeq = (maxSeq?.m ?? -1) + 1;
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    await run(db,
      "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
      [leadId, req.user.displayName, locked ? "Khóa lead" : "Mở khóa lead", now, "", locked ? "Admin khóa lead" : "Admin mở khóa lead", nextSeq, "admin"]
    );

    lastSyncHash = "";
    emitDataChanged("lock-lead");
    const data = await readData(db);
    await filterDataForRole(data, req.user);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || "Lock/unlock failed" });
  }
});

/* ===== Telegram Bot Webhook ===== */
const TELE_STATUS_LABELS = STATUS_LABELS_VI; // alias for backward compat

/* ===== Setup Telegram webhook ===== */
app.post("/api/telegram-webhook/setup", requireAuth, requireAdmin, async (req, res) => {
  try {
    const activeBots = await all(db, "SELECT id, name, token FROM telegram_bots WHERE is_active = 1");
    if (!activeBots || activeBots.length === 0) return res.status(400).json({ error: "Không có bot nào đang hoạt động" });

    // Use the request's host to build webhook URL (auto-detect domain)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = host ? `https://${host.replace(/:\d+$/, '')}` : 'https://crm-iqi.id.vn';

    const results = [];
    for (const bot of activeBots) {
      const webhookUrl = `${baseUrl}/api/telegram-webhook/${bot.id}`;
      console.log(`[telegram-webhook/setup] Setting webhook for bot "${bot.name}" → ${webhookUrl}`);
      try {
        const r = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: webhookUrl, secret_token: TELEGRAM_WEBHOOK_SECRET }),
        });
        const data = await r.json();
        console.log(`[telegram-webhook/setup] Bot "${bot.name}" result:`, JSON.stringify(data));
        results.push({ name: bot.name, webhookUrl, ok: data.ok, error: data.ok ? null : data.description });
      } catch (e) {
        console.error(`[telegram-webhook/setup] Bot "${bot.name}" failed:`, e.message);
        results.push({ name: bot.name, webhookUrl, ok: false, error: e.message });
      }
    }

    const successCount = results.filter(r => r.ok).length;
    const failList = results.filter(r => !r.ok).map(r => `${r.name}: ${r.error}`);
    if (successCount === activeBots.length) {
      res.json({ ok: true, msg: `Webhook đã cài đặt cho ${successCount} bot thành công!` });
    } else {
      res.json({ ok: successCount > 0, msg: `${successCount}/${activeBots.length} bot OK.${failList.length ? " Lỗi: " + failList.join("; ") : ""}` });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===== Telegram Webhook Handler ===== */
async function handleTelegramWebhook(req, res) {
  try {
    // Verify webhook secret to ensure request comes from Telegram
    const secretHeader = req.headers["x-telegram-bot-api-secret-token"] || "";
    if (secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
      console.warn(`[telegram-webhook] Invalid secret token from ${req.ip}`);
      return res.status(403).json({ ok: false });
    }

    const { callback_query, message } = req.body || {};
    console.log(`[telegram-webhook] Received: callback_query=${!!callback_query}, message=${!!message}, botId=${req.params.botId || 'none'}`);

    // Determine which bot this webhook is for
    let bot;
    if (req.params.botId) {
      bot = await get(db, "SELECT id, token FROM telegram_bots WHERE id = ? AND is_active = 1", [Number(req.params.botId)]);
    }
    if (!bot) {
      bot = await get(db, "SELECT id, token FROM telegram_bots WHERE is_active = 1 LIMIT 1");
    }
    if (!bot) {
      console.warn(`[telegram-webhook] No active bot found!`);
      return res.json({ ok: true });
    }
    const botToken = bot.token;
    const botId = bot.id;

    // Auto-save chat user to DB from any interaction
    const saveChatUser = (from) => {
      if (!from || from.is_bot) return;
      const tgId = String(from.id);
      const firstName = from.first_name || "";
      const lastName = from.last_name || "";
      const uname = from.username || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      run(db,
        `INSERT INTO telegram_chat_users(bot_id, telegram_id, first_name, last_name, username, full_name)
         VALUES(?, ?, ?, ?, ?, ?)
         ON CONFLICT(bot_id, telegram_id) DO UPDATE SET
           first_name = excluded.first_name, last_name = excluded.last_name,
           username = excluded.username, full_name = excluded.full_name`,
        [botId, tgId, firstName, lastName, uname, fullName]
      ).catch(() => {});
    };

    if (callback_query?.from) saveChatUser(callback_query.from);
    if (message?.from) saveChatUser(message.from);

    const sendTg = async (chatId, text, extra = {}) => {
      const doSend = async (txt, useMd) => {
        const payload = { chat_id: chatId, text: txt, ...extra };
        if (useMd) payload.parse_mode = "Markdown";
        const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return r;
      };
      const stripMd = (s) => s.replace(/[_*`\[\]()~>#+=|{}.!\\-]/g, "");
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await doSend(text, true);
          const data = await r.json();
          if (data.ok) return r;
          console.warn(`[telegram-webhook] sendTg failed (Markdown): ${data.description}`);
          const r2 = await doSend(stripMd(text), false);
          const d2 = await r2.json();
          if (d2.ok) return r2;
          console.warn(`[telegram-webhook] sendTg retry plain also failed: ${d2.description}`);
          return r2;
        } catch (e) {
          console.error(`[telegram-webhook] sendTg attempt ${attempt + 1}/3 error: ${e.message}`);
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      // Last resort after all retries
      try { return await doSend(stripMd(text), false); } catch (_) {}
    };

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
        console.log(`[telegram-webhook] Callback: chatId=${chatId}, leadId=${leadId}, status=${statusKey} (${statusLabel})`);

        // Update pending with chosen status
        // Preserve message_id and phone from original notification
        const existingPending = await get(db, "SELECT message_id, phone FROM telegram_pending WHERE telegram_id = ?", [chatId]);
        await run(db, "INSERT OR REPLACE INTO telegram_pending(telegram_id, lead_id, status, message_id, phone) VALUES(?, ?, ?, ?, ?)", [chatId, leadId, statusKey, existingPending?.message_id || null, existingPending?.phone || ""]);

        await answerCb(callback_query.id, `✅ Đã chọn: ${statusLabel}`);
        await sendTg(chatId, [
          `✅ Trạng thái: *${statusLabel}*`,
          ``,
          `💬 Bây giờ hãy nhắn tin feedback về khách hàng này.`,
          `VD: _"Khách quan tâm căn 2PN, hẹn xem thứ 7"_`,
        ].join("\n"));
      } else {
        console.warn(`[telegram-webhook] Unknown callback_data: "${cbData}"`);
      }
      return res.json({ ok: true });
    }

    // Handle text message (feedback)
    if (message && message.text) {
      const chatId = String(message.from?.id || "");
      const feedbackText = message.text.trim();

      // Ignore bot commands
      if (feedbackText.startsWith("/")) return res.json({ ok: true });

      const pending = await get(db, "SELECT lead_id, status, phone FROM telegram_pending WHERE telegram_id = ?", [chatId]);
      console.log(`[telegram-webhook] Message from ${chatId}: "${feedbackText.slice(0, 50)}", pending=${JSON.stringify(pending)}`);

      if (!pending) {
        await sendTg(chatId, "⚠️ Không có lead nào đang chờ feedback.\nHãy bấm nút trạng thái từ thông báo lead trước.");
        return res.json({ ok: true });
      }

      if (!pending.status) {
        await sendTg(chatId, "⚠️ Bạn chưa chọn trạng thái.\nHãy bấm nút trạng thái từ thông báo lead trước, sau đó nhắn feedback.");
        return res.json({ ok: true });
      }

      try {
        let leadId = pending.lead_id;
        const statusKey = pending.status;
        const statusLabel = TELE_STATUS_LABELS[statusKey] || statusKey;

        // Get lead info — fallback by phone if lead_id is stale (sync may have re-created lead with new ID)
        let lead = await get(db, "SELECT id, name, phone, sale_name FROM leads WHERE id = ?", [leadId]);
        if (!lead && pending.phone) {
          lead = await get(db, "SELECT id, name, phone, sale_name FROM leads WHERE phone = ? ORDER BY id DESC LIMIT 1", [pending.phone]);
          if (lead) {
            console.log(`[telegram-webhook] Lead#${leadId} not found, fallback by phone "${pending.phone}" → Lead#${lead.id}`);
            leadId = lead.id;
          }
        }

        // Attribute feedback to the lead's assigned sale, not the Telegram sender
        let saleName = lead?.sale_name || "";
        if (!saleName) {
          const saleUser = await get(db, "SELECT display_name FROM users WHERE telegram_id = ?", [chatId]);
          saleName = saleUser ? saleUser.display_name : "Sale";
        }
        console.log(`[telegram-webhook] Saving feedback: leadId=${leadId}, saleName="${saleName}", status=${statusKey}, feedback="${feedbackText.slice(0, 50)}"`);

        // Save to lead_history
        const maxSeq = await get(db, "SELECT MAX(seq) as m FROM lead_history WHERE lead_id = ?", [leadId]);
        const nextSeq = (maxSeq?.m ?? -1) + 1;
        const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
        await run(
          db,
          "INSERT INTO lead_history(lead_id, sale_name, action, contact_date, status, feedback, seq, source) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
          [leadId, saleName, "Cập nhật (Telegram)", now, statusLabel, feedbackText, nextSeq, "telegram"]
        );

        // Update lead status + raw_status
        const statusLabel2 = TELE_STATUS_LABELS[statusKey] || statusKey;
        await run(db, "UPDATE leads SET status = ?, raw_status = ? WHERE id = ?", [statusKey, statusLabel2, leadId]);

        // Clear pending
        await run(db, "DELETE FROM telegram_pending WHERE telegram_id = ?", [chatId]);

        // Notify web clients about the change
        lastSyncHash = "";
        emitDataChanged("telegram-feedback");
        const escMd = (s) => String(s || "").replace(/([_*`\[\]])/g, "\\$1");
        await sendTg(chatId, [
          `✅ *Đã lưu feedback thành công!*`,
          ``,
          `👤 Khách: *${escMd(lead ? lead.name : "N/A")}*`,
          `📊 Trạng thái: *${escMd(statusLabel)}*`,
          `💬 Feedback: _${escMd(feedbackText)}_`,
          `⏰ Lúc: ${now}`,
          ``,
          `📋 Feedback đã được lưu vào lịch sử liên hệ trên CRM.`,
        ].join("\n"));
        console.log(`[telegram-webhook] Feedback saved OK for leadId=${leadId}`);
      } catch (feedbackErr) {
        console.error(`[telegram-webhook] Feedback save ERROR for chatId=${chatId}:`, feedbackErr.message, feedbackErr.stack);
        await sendTg(chatId, `❌ Lỗi khi lưu feedback: ${feedbackErr.message}\nVui lòng thử lại hoặc liên hệ Admin.`);
      }

      return res.json({ ok: true });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[Telegram Webhook] Error:", err.message);
    res.json({ ok: true });
  }
}
app.post("/api/telegram-webhook/:botId", handleTelegramWebhook);
app.post("/api/telegram-webhook", handleTelegramWebhook);

// Debug: Check webhook status for all bots
app.get("/api/telegram-webhook/status", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const bots = await all(db, "SELECT id, name, token FROM telegram_bots WHERE is_active = 1");
    const results = [];
    for (const bot of bots) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${bot.token}/getWebhookInfo`);
        const data = await r.json();
        results.push({ name: bot.name, id: bot.id, ...data.result });
      } catch (e) {
        results.push({ name: bot.name, id: bot.id, error: e.message });
      }
    }
    res.json(results);
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

/* ===== Facebook Messenger Inbox (Admin) ===== */

// GET /api/fb-messenger/conversations?pageId=<fb_pages.id>&after=<cursor>
// List conversations from a Facebook Page
app.get("/api/fb-messenger/conversations", requireAuth, requireAdmin, async (req, res) => {
  try {
    const pageDbId = Number(req.query.pageId);
    if (!pageDbId) return res.status(400).json({ error: "pageId là bắt buộc" });
    const page = await get(db, "SELECT * FROM fb_pages WHERE id = ? AND is_active = 1", [pageDbId]);
    if (!page) return res.status(404).json({ error: "Page không tồn tại hoặc đã tắt" });
    if (!page.access_token) return res.status(400).json({ error: "Page chưa có Access Token" });

    let url = `https://graph.facebook.com/v22.0/${page.page_id}/conversations?fields=id,snippet,updated_time,unread_count,senders,message_count&limit=25&access_token=${page.access_token}`;
    const after = req.query.after;
    if (after) url += `&after=${encodeURIComponent(after)}`;

    const fbRes = await fetch(url);
    const data = await fbRes.json();
    if (data.error) return res.status(400).json({ error: data.error.message || "Facebook API error" });

    const convs = (data.data || []).map(c => ({
      id: c.id,
      snippet: c.snippet || "",
      updatedTime: c.updated_time,
      unreadCount: c.unread_count || 0,
      messageCount: c.message_count || 0,
      senders: (c.senders?.data || []).map(s => ({ id: s.id, name: s.name, email: s.email })),
    }));

    // Resolve profile links for unique customer PSIDs
    const psids = new Set();
    for (const c of convs) { for (const s of c.senders) { if (s.id !== page.page_id) psids.add(s.id); } }
    const linkMap = new Map();
    await Promise.all([...psids].map(async (psid) => {
      try {
        const pRes = await fetch(`https://graph.facebook.com/v22.0/${encodeURIComponent(psid)}?fields=link&access_token=${page.access_token}`);
        const pData = await pRes.json();
        if (pData.link) linkMap.set(psid, pData.link);
      } catch {}
    }));
    for (const c of convs) { for (const s of c.senders) { if (linkMap.has(s.id)) s.link = linkMap.get(s.id); } }

    res.json({
      conversations: convs,
      paging: data.paging || null,
      pageInfo: { id: page.id, name: page.name, pageId: page.page_id, avatarUrl: page.avatar_url },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/fb-messenger/messages?pageId=<fb_pages.id>&conversationId=<conv_id>&after=<cursor>
// Get messages in a conversation
app.get("/api/fb-messenger/messages", requireAuth, async (req, res) => {
  try {
    const pageDbId = Number(req.query.pageId);
    const conversationId = req.query.conversationId;
    if (!pageDbId || !conversationId) return res.status(400).json({ error: "pageId và conversationId là bắt buộc" });

    const page = await get(db, "SELECT * FROM fb_pages WHERE id = ? AND is_active = 1", [pageDbId]);
    if (!page) return res.status(404).json({ error: "Page không tồn tại" });

    let url = `https://graph.facebook.com/v22.0/${conversationId}/messages?fields=id,message,from,to,created_time,attachments&limit=25&access_token=${page.access_token}`;
    const after = req.query.after;
    if (after) url += `&after=${encodeURIComponent(after)}`;

    const fbRes = await fetch(url);
    const data = await fbRes.json();
    if (data.error) return res.status(400).json({ error: data.error.message || "Facebook API error" });

    res.json({
      messages: (data.data || []).map(m => ({
        id: m.id,
        message: m.message || "",
        from: m.from ? { id: m.from.id, name: m.from.name } : null,
        to: (m.to?.data || []).map(t => ({ id: t.id, name: t.name })),
        createdTime: m.created_time,
        attachments: (m.attachments?.data || []).map(a => ({
          type: a.mime_type || a.type || "",
          url: a.image_data?.url || a.video_data?.url || a.file_url || "",
          name: a.name || "",
        })),
      })),
      paging: data.paging || null,
      pageId: page.page_id,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/fb-messenger/reply
// Send a reply in a conversation (Admin only)
app.post("/api/fb-messenger/reply", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { pageId, recipientId, message } = req.body;
    if (!pageId || !recipientId || !message) return res.status(400).json({ error: "pageId, recipientId và message là bắt buộc" });

    const page = await get(db, "SELECT * FROM fb_pages WHERE id = ? AND is_active = 1", [Number(pageId)]);
    if (!page) return res.status(404).json({ error: "Page không tồn tại" });
    if (!page.access_token) return res.status(400).json({ error: "Page chưa có Access Token" });

    const text = String(message).trim().slice(0, 2000);
    if (!text) return res.status(400).json({ error: "Nội dung tin nhắn không được trống" });

    const fbRes = await fetch(`https://graph.facebook.com/v22.0/${page.page_id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        messaging_type: "RESPONSE",
        access_token: page.access_token,
      }),
    });
    const data = await fbRes.json();
    if (data.error) return res.status(400).json({ error: data.error.message || "Gửi tin nhắn thất bại" });

    res.json({ success: true, messageId: data.message_id, recipientId: data.recipient_id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/fb-messenger/participant?pageId=<fb_pages.id>&userId=<psid>
// Get participant profile info
app.get("/api/fb-messenger/participant", requireAuth, async (req, res) => {
  try {
    const pageDbId = Number(req.query.pageId);
    const userId = req.query.userId;
    if (!pageDbId || !userId) return res.status(400).json({ error: "pageId và userId là bắt buộc" });

    const page = await get(db, "SELECT * FROM fb_pages WHERE id = ? AND is_active = 1", [pageDbId]);
    if (!page) return res.status(404).json({ error: "Page không tồn tại" });

    const fbRes = await fetch(`https://graph.facebook.com/v22.0/${encodeURIComponent(userId)}?fields=name,profile_pic,link&access_token=${page.access_token}`);
    const data = await fbRes.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    res.json({ id: data.id, name: data.name || "Người dùng Facebook", profilePic: data.profile_pic || "", link: data.link || "" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/fb-messenger/lead-conversations?leadName=<name>
// Find Messenger conversations matching a lead's name across all active pages
app.get("/api/fb-messenger/lead-conversations", requireAuth, async (req, res) => {
  try {
    const leadName = (req.query.leadName || "").trim().toLowerCase();
    if (!leadName) return res.status(400).json({ error: "leadName là bắt buộc" });

    const activePages = await all(db, "SELECT * FROM fb_pages WHERE is_active = 1 AND access_token != '' AND page_id != ''");
    if (!activePages.length) {
      const totalPages = await get(db, "SELECT COUNT(*) as cnt FROM fb_pages");
      return res.json({ conversations: [], pages: [], noPages: true, message: totalPages?.cnt ? "Không có Page nào đang hoạt động. Kiểm tra Quản lý Page và bật Page lên." : "Chưa thêm Page Facebook nào. Vào Quản lý Page để thêm Page và nhập Page Access Token." });
    }

    const results = [];
    const pageInfos = [];

    for (const page of activePages) {
      try {
        const url = `https://graph.facebook.com/v22.0/${page.page_id}/conversations?fields=id,snippet,updated_time,unread_count,senders,message_count&limit=50&access_token=${page.access_token}`;
        const fbRes = await fetch(url);
        const data = await fbRes.json();
        if (data.error) continue;

        const pInfo = { id: page.id, name: page.name, pageId: page.page_id, avatarUrl: page.avatar_url };
        let added = false;

        for (const c of (data.data || [])) {
          const senders = (c.senders?.data || []);
          const customer = senders.find(s => s.id !== page.page_id);
          if (!customer) continue;
          const customerName = (customer.name || "").toLowerCase();
          // Match if lead name contains customer name or vice versa
          if (customerName.includes(leadName) || leadName.includes(customerName)) {
            results.push({
              id: c.id,
              snippet: c.snippet || "",
              updatedTime: c.updated_time,
              unreadCount: c.unread_count || 0,
              messageCount: c.message_count || 0,
              senders: senders.map(s => ({ id: s.id, name: s.name, email: s.email })),
              pageDbId: page.id,
              pageName: page.name,
              pageId: page.page_id,
              pageToken: page.access_token,
            });
            if (!added) { pageInfos.push(pInfo); added = true; }
          }
        }
      } catch { /* skip page on error */ }
    }

    // Sort by updated time desc
    results.sort((a, b) => (b.updatedTime || "").localeCompare(a.updatedTime || ""));

    // Resolve profile links for all unique customer PSIDs
    const psidMap = new Map();
    for (const r of results) {
      const cust = r.senders.find(s => s.id !== r.pageId);
      if (cust && !psidMap.has(cust.id)) psidMap.set(cust.id, { psid: cust.id, token: r.pageToken });
    }
    const linkMap = new Map();
    await Promise.all([...psidMap.values()].map(async ({ psid, token }) => {
      try {
        const pRes = await fetch(`https://graph.facebook.com/v22.0/${encodeURIComponent(psid)}?fields=link&access_token=${token}`);
        const pData = await pRes.json();
        if (pData.link) linkMap.set(psid, pData.link);
      } catch {}
    }));
    // Attach links to senders & remove token from response
    for (const r of results) {
      for (const s of r.senders) { if (linkMap.has(s.id)) s.link = linkMap.get(s.id); }
      delete r.pageToken;
    }

    res.json({ conversations: results, pages: pageInfos });
  } catch (err) { res.status(500).json({ error: err.message }); }
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

// --- Facebook Ad Preview by ad name ---
app.get("/api/fb-ads/ad-preview", requireAuth, async (req, res) => {
  try {
    const { adName } = req.query;
    if (!adName) return res.status(400).json({ error: "adName is required" });

    const accounts = await all(db, "SELECT account_id, access_token FROM fb_ad_accounts WHERE is_active = 1 AND access_token != ''");
    if (!accounts.length) return res.status(400).json({ error: "Chưa cấu hình tài khoản Facebook Ads" });

    for (const acct of accounts) {
      try {
        // Search for the ad by name
        const filtering = JSON.stringify([{ field: "name", operator: "CONTAIN", value: adName }]);
        const fields = "id,name,status,effective_status,creative{id,name,thumbnail_url,image_url,object_story_spec,asset_feed_spec}";
        const searchUrl = `https://graph.facebook.com/v22.0/act_${acct.account_id}/ads?filtering=${encodeURIComponent(filtering)}&fields=${encodeURIComponent(fields)}&limit=5&access_token=${acct.access_token}`;
        const fbRes = await fetch(searchUrl);
        const data = await fbRes.json();
        if (data.error) continue;
        if (!data.data || !data.data.length) continue;

        // Get ad previews for the first matching ad
        const ad = data.data[0];
        const previews = [];
        const formats = ["DESKTOP_FEED_STANDARD", "MOBILE_FEED_STANDARD"];
        for (const fmt of formats) {
          try {
            const prevUrl = `https://graph.facebook.com/v22.0/${ad.id}/previews?ad_format=${fmt}&access_token=${acct.access_token}`;
            const prevRes = await fetch(prevUrl);
            const prevData = await prevRes.json();
            if (prevData.data && prevData.data.length) {
              previews.push({ format: fmt, html: prevData.data[0].body });
            }
          } catch {}
        }

        // Also get the creative images directly
        let imageUrl = ad.creative?.image_url || ad.creative?.thumbnail_url || "";
        // Try object_story_spec for image
        if (!imageUrl && ad.creative?.object_story_spec) {
          const spec = ad.creative.object_story_spec;
          if (spec.link_data?.image_hash || spec.link_data?.picture) imageUrl = spec.link_data.picture || "";
          if (spec.video_data?.image_url) imageUrl = spec.video_data.image_url;
        }

        return res.json({
          adId: ad.id,
          adName: ad.name,
          status: ad.effective_status || ad.status,
          imageUrl,
          previews,
          allAds: data.data.map(a => ({ id: a.id, name: a.name, status: a.effective_status || a.status })),
        });
      } catch { continue; }
    }

    return res.json({ adId: null, adName, error: "Không tìm thấy quảng cáo với tên này" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Fetch all adsets + ads + creatives for a specific campaign ---
app.get("/api/fb-ads/campaign-detail/:accountId/:campaignId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const acct = await get(db, "SELECT * FROM fb_ad_accounts WHERE account_id=? AND is_active=1", [req.params.accountId]);
    if (!acct || !acct.access_token) return res.status(400).json({ error: "Ad account not found or no token" });

    const { campaignId } = req.params;
    const { dateFrom, dateTo } = req.query;
    const today = new Date().toISOString().slice(0, 10);
    const since = dateFrom || today;
    const until = dateTo || today;

    // Fetch adsets under this campaign
    const adsetFilter = JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: campaignId }]);
    const adsetFields = "id,name,status,effective_status,daily_budget,lifetime_budget,targeting,optimization_goal";
    const adsetUrl = `https://graph.facebook.com/v22.0/act_${acct.account_id}/adsets?filtering=${encodeURIComponent(adsetFilter)}&fields=${encodeURIComponent(adsetFields)}&limit=100&access_token=${acct.access_token}`;

    // Fetch ads under this campaign with creative content
    const adFilter = JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: campaignId }]);
    const adFields = "id,name,status,effective_status,adset_id,creative{id,name,body,title,thumbnail_url,image_url,object_story_spec,asset_feed_spec,link_url}";
    const adUrl = `https://graph.facebook.com/v22.0/act_${acct.account_id}/ads?filtering=${encodeURIComponent(adFilter)}&fields=${encodeURIComponent(adFields)}&limit=100&access_token=${acct.access_token}`;

    // Fetch ad-level insights
    const insightFields = "ad_id,ad_name,adset_id,adset_name,spend,impressions,reach,clicks,cpm,cpc,ctr,actions,inline_link_clicks,inline_link_click_ctr";
    const insightUrl = `https://graph.facebook.com/v22.0/act_${acct.account_id}/insights?fields=${insightFields}&time_range={"since":"${since}","until":"${until}"}&level=ad&filtering=${encodeURIComponent(adFilter)}&limit=100&access_token=${acct.access_token}`;

    const [adsetRes, adRes, insightRes] = await Promise.all([
      fetch(adsetUrl), fetch(adUrl), fetch(insightUrl)
    ]);
    const [adsetData, adData, insightData] = await Promise.all([
      adsetRes.json(), adRes.json(), insightRes.json()
    ]);

    // Extract ad content from creative
    const ads = (adData.data || []).map(ad => {
      const c = ad.creative || {};
      const spec = c.object_story_spec || {};
      const linkData = spec.link_data || {};
      const videoData = spec.video_data || {};
      // Get the actual ad text content
      const adText = linkData.message || videoData.message || c.body || "";
      const headline = linkData.name || videoData.title || c.title || "";
      const description = linkData.description || "";
      const cta = linkData.call_to_action?.type || videoData.call_to_action?.type || "";
      const imageUrl = linkData.picture || videoData.image_url || c.image_url || c.thumbnail_url || "";
      const linkUrl = linkData.link || c.link_url || "";

      return {
        id: ad.id, name: ad.name, adsetId: ad.adset_id,
        status: ad.effective_status || ad.status,
        content: { text: adText, headline, description, cta, imageUrl, linkUrl }
      };
    });

    // Build insight map by ad_id
    const insightMap = {};
    (insightData.data || []).forEach(i => { insightMap[i.ad_id] = i; });

    // Merge ads with insights
    const adsWithInsights = ads.map(ad => ({
      ...ad,
      insights: insightMap[ad.id] || null
    }));

    // Adsets
    const adsets = (adsetData.data || []).map(as => ({
      id: as.id, name: as.name,
      status: as.effective_status || as.status,
      dailyBudget: as.daily_budget || 0,
      lifetimeBudget: as.lifetime_budget || 0,
      optimizationGoal: as.optimization_goal || "",
      targeting: as.targeting || {}
    }));

    res.json({ adsets, ads: adsWithInsights });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== Announcements (scrolling banner) ===== */
const ensureAnnouncementsTable = async () => {
  await run(db, `CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL,
    is_active INTEGER DEFAULT 1, created_by TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')))`);
  // Add sort_order if missing (existing installs)
  try { await run(db, "ALTER TABLE announcements ADD COLUMN sort_order INTEGER DEFAULT 0"); } catch {}
};

app.get("/api/announcements", requireAuth, async (_req, res) => {
  try {
    await ensureAnnouncementsTable();
    const rows = await all(db, "SELECT * FROM announcements WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/announcements/all", requireAuth, requireAdmin, async (_req, res) => {
  try {
    await ensureAnnouncementsTable();
    const rows = await all(db, "SELECT * FROM announcements ORDER BY sort_order ASC, created_at DESC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/announcements", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    await ensureAnnouncementsTable();
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: "Chưa nhập nội dung thông báo" });
    const maxOrder = await get(db, "SELECT MAX(sort_order) as m FROM announcements WHERE is_active = 1");
    const nextOrder = (maxOrder?.m ?? -1) + 1;
    await run(db, "INSERT INTO announcements (content, created_by, sort_order) VALUES (?, ?, ?)", [content.trim(), req.user.display_name || req.user.username, nextOrder]);
    if (io) io.emit("announcement-changed");
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/announcements/:id", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const { content, is_active } = req.body;
    if (content !== undefined) await run(db, "UPDATE announcements SET content = ? WHERE id = ?", [content.trim(), req.params.id]);
    if (is_active !== undefined) await run(db, "UPDATE announcements SET is_active = ? WHERE id = ?", [is_active ? 1 : 0, req.params.id]);
    if (io) io.emit("announcement-changed");
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/announcements/:id", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    await run(db, "DELETE FROM announcements WHERE id = ?", [req.params.id]);
    if (io) io.emit("announcement-changed");
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reorder announcements
app.post("/api/announcements/reorder", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const { ids } = req.body; // array of announcement IDs in desired order
    if (!Array.isArray(ids)) return res.status(400).json({ error: "Invalid ids array" });
    for (let i = 0; i < ids.length; i++) {
      await run(db, "UPDATE announcements SET sort_order = ? WHERE id = ?", [i, ids[i]]);
    }
    if (io) io.emit("announcement-changed");
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== Personal Leads (Sale's individual customers) ===== */
// GET: Sale sees own leads; Admin/Manager sees all
app.get("/api/personal-leads", requireAuth, async (req, res) => {
  try {
    const isSale = req.user.role === "sale";
    let rows;
    if (isSale) {
      rows = await all(db, `SELECT pl.*, u.display_name as sale_name FROM personal_leads pl
        JOIN users u ON u.id = pl.user_id
        WHERE pl.user_id = ? AND pl.is_deleted = 0 ORDER BY pl.created_at DESC`, [req.user.userId]);
    } else {
      // Admin/Manager: show all (including soft-deleted)
      rows = await all(db, `SELECT pl.*, u.display_name as sale_name FROM personal_leads pl
        JOIN users u ON u.id = pl.user_id
        ORDER BY pl.is_deleted ASC, pl.created_at DESC`);
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST: Any authenticated user can add personal leads
app.post("/api/personal-leads", requireAuth, async (req, res) => {
  try {
    const { name, phone, product, status, note } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Chưa nhập tên khách" });
    if (!phone || !phone.trim()) return res.status(400).json({ error: "Chưa nhập số điện thoại" });
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    await run(db, `INSERT INTO personal_leads (user_id, name, phone, product, status, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.userId, name.trim(), phone.trim(), (product || "").trim(), status || "new", (note || "").trim(), now, now]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT: Sale can update own leads; Admin can update any
app.put("/api/personal-leads/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const lead = await get(db, "SELECT * FROM personal_leads WHERE id = ?", [id]);
    if (!lead) return res.status(404).json({ error: "Không tìm thấy" });
    if (req.user.role === "sale" && lead.user_id !== req.user.userId) {
      return res.status(403).json({ error: "Không có quyền chỉnh sửa" });
    }
    const { name, phone, product, status, note } = req.body;
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const sets = ["updated_at = ?"];
    const params = [now];
    if (name !== undefined) { sets.push("name = ?"); params.push(name.trim()); }
    if (phone !== undefined) { sets.push("phone = ?"); params.push(phone.trim()); }
    if (product !== undefined) { sets.push("product = ?"); params.push(product.trim()); }
    if (status !== undefined) { sets.push("status = ?"); params.push(status); }
    if (note !== undefined) { sets.push("note = ?"); params.push(note.trim()); }
    params.push(id);
    await run(db, `UPDATE personal_leads SET ${sets.join(", ")} WHERE id = ?`, params);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE: Sale soft-deletes own leads; Admin hard-deletes
app.delete("/api/personal-leads/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const lead = await get(db, "SELECT * FROM personal_leads WHERE id = ?", [id]);
    if (!lead) return res.status(404).json({ error: "Không tìm thấy" });
    const isAdmin = req.user.role === "admin" || req.user.role === "manager";
    if (req.user.role === "sale" && lead.user_id !== req.user.userId) {
      return res.status(403).json({ error: "Không có quyền xóa" });
    }
    if (isAdmin) {
      // Admin/Manager: hard delete
      await run(db, "DELETE FROM personal_leads WHERE id = ?", [id]);
    } else {
      // Sale: soft delete (admin still sees it)
      await run(db, "UPDATE personal_leads SET is_deleted = 1 WHERE id = ?", [id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET history for a personal lead
app.get("/api/personal-leads/:id/history", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const lead = await get(db, "SELECT * FROM personal_leads WHERE id = ?", [id]);
    if (!lead) return res.status(404).json({ error: "Không tìm thấy" });
    if (req.user.role === "sale" && lead.user_id !== req.user.userId) {
      return res.status(403).json({ error: "Không có quyền" });
    }
    const rows = await all(db, "SELECT * FROM personal_lead_history WHERE lead_id = ? ORDER BY seq ASC", [id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST: Add a call/contact entry for personal lead
app.post("/api/personal-leads/:id/history", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const lead = await get(db, "SELECT * FROM personal_leads WHERE id = ?", [id]);
    if (!lead) return res.status(404).json({ error: "Không tìm thấy" });
    if (req.user.role === "sale" && lead.user_id !== req.user.userId) {
      return res.status(403).json({ error: "Không có quyền" });
    }
    const { status, feedback } = req.body;
    if (!status && !feedback) return res.status(400).json({ error: "Chưa nhập trạng thái hoặc ghi chú" });
    const saleName = req.user.displayName;
    const maxSeq = await get(db, "SELECT MAX(seq) as m FROM personal_lead_history WHERE lead_id = ?", [id]);
    const nextSeq = (maxSeq?.m ?? -1) + 1;
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    await run(db, "INSERT INTO personal_lead_history(lead_id, sale_name, status, feedback, seq, contact_date) VALUES(?, ?, ?, ?, ?, ?)",
      [id, saleName, status || "", feedback || "", nextSeq, now]);
    // Also update lead status if provided
    if (status) {
      await run(db, "UPDATE personal_leads SET status = ?, updated_at = ? WHERE id = ?", [status, now, id]);
    }
    // Return updated history
    const rows = await all(db, "SELECT * FROM personal_lead_history WHERE lead_id = ? ORDER BY seq ASC", [id]);
    res.json({ success: true, history: rows, newStatus: status || lead.status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE: Remove a history entry for personal lead
app.delete("/api/personal-leads/:id/history/:histId", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const histId = Number(req.params.histId);
    const lead = await get(db, "SELECT * FROM personal_leads WHERE id = ?", [id]);
    if (!lead) return res.status(404).json({ error: "Không tìm thấy" });
    const isAdmin = req.user.role === "admin" || req.user.role === "manager";
    if (req.user.role === "sale" && lead.user_id !== req.user.userId) {
      return res.status(403).json({ error: "Không có quyền" });
    }
    await run(db, "DELETE FROM personal_lead_history WHERE id = ? AND lead_id = ?", [histId, id]);
    const rows = await all(db, "SELECT * FROM personal_lead_history WHERE lead_id = ? ORDER BY seq ASC", [id]);
    res.json({ success: true, history: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== Content Review (AI Editorial Workflow) ===== */
app.post("/api/content-review", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const { content, projectName, category, target, psychology, adType, how, eventHistory, eventPerks } = req.body;
    if (!projectName || !projectName.trim()) return res.status(400).json({ error: "Chưa nhập tên dự án" });

    const apiKey = await get(db, "SELECT value FROM settings WHERE key = 'openai_api_key'");
    if (!apiKey?.value) return res.status(400).json({ error: "Chưa cấu hình OpenAI API key. Vào Cài đặt tài khoản để thêm." });

    const guidelines = await all(db, "SELECT * FROM marketing_guidelines WHERE category IN ('Nội dung', 'Chiến lược', 'Tối ưu chi phí', 'Targeting') ORDER BY priority DESC");
    const guidelinesText = guidelines.length > 0
      ? guidelines.map(g => `[${g.category}] ${g.rule_name}: ${g.content}`).join("\n")
      : MARKETING_KNOWLEDGE.filter(g => ["Nội dung", "Chiến lược", "Tối ưu chi phí", "Targeting"].includes(g.category)).map(g => `[${g.category}] ${g.rule_name}: ${g.content}`).join("\n");

    // Build filter-based prompt sections
    const categoryLabel = { can_ho: "Căn hộ chung cư", nha_pho: "Nhà phố", biet_thu: "Biệt thự", shophouse: "Shophouse" }[category] || "Căn hộ";
    const targetLabel = target === "dau_tu" ? "Khách ĐẦU TƯ (quan tâm ROI, tăng giá, dòng tiền, lãi vốn)" : "Khách MUA Ở (quan tâm tiện ích, môi trường sống, trường học, an ninh)";
    const psychLabel = { mat_tien: "NỖI SỢ MẤT TIỀN — Tiền gửi ngân hàng mất giá, lạm phát ăn mòn tiết kiệm", loi_nhuan: "LÒNG THAM LỢI NHUẬN — Lãi vốn 20-30%, cho thuê ổn định, tài sản tăng giá", fomo: "FOMO — Sợ mất cơ hội, hết hàng, giá tăng, người khác mua hết", dang_cap: "THỂ HIỆN ĐẲNG CẤP — Vị thế gia chủ, thương hiệu sống, khẳng định đẳng cấp" }[psychology] || "FOMO";
    const adTypeLabel = { event: "ĐĂNG KÝ EVENT — Mời tham quan dự án, sự kiện mở bán, cần tạo social proof từ sự kiện trước", bao_gia: "BÁO GIÁ CĐT — Show giá thẳng, lọc khách bằng con số tài chính thực", khan_hiem: "CHÀO HÀNG KHAN HIẾM — Suất nội bộ, giá F0, đợt cuối, số lượng giới hạn", tiec_nuoi: "KHƠI GỢI TIẾC NUỐI — Nhắc đợt mở bán trước đã tăng giá, ai mua đã lời bao nhiêu %" }[adType] || "BÁO GIÁ";

    // Dynamic rules based on selections
    let filterRules = "";
    if (adType === "event") {
      filterRules += `\n=== BỘ KHUNG SỰ KIỆN (BẮT BUỘC KHI VIẾT CONTENT EVENT) ===
CẤU TRÚC BÀI VIẾT: "Nuối tiếc + Cơ hội"

1. MỞ BÀI — SOCIAL PROOF TỪ SỰ KIỆN TRƯỚC:
${eventHistory ? `   - SỰ THẬT: "${eventHistory}" — BẮT BUỘC nhắc ngay dòng đầu tiên để khách thấy mình đã bỏ lỡ thứ rất giá trị.` : '   - Nhắc sự kiện trước bùng nổ, nhiều khách bỏ lỡ vì hết chỗ.'}
   - Mẫu câu: "Bạn đã hụt mất suất ưu đãi?", "600+ khách vây kín sự kiện", "Thật đáng tiếc nếu bạn bỏ lỡ..."
   - TUYỆT ĐỐI KHÔNG mở bài bằng "Chào mừng bạn đến với..." — ĐI THẲNG VÀO VẤN ĐỀ!

2. THÂN BÀI — GIẢI PHÁP "CÁNH CỬA CUỐI CÙNG":
${eventPerks ? `   - ĐẶC QUYỀN SỰ KIỆN: "${eventPerks}" — Dùng làm mồi nhử chính.` : '   - Thông báo sự kiện lần này là cơ hội cuối cùng.'}
   - Nhấn mạnh: "Đừng để kịch bản đó lặp lại", "Cánh cửa cuối cùng"

3. KEY CHỐT — SHOW CON SỐ HOW:
   - Đưa ngay vốn ban đầu, chính sách ân hạn, chiết khấu (từ thông số Giá/Vốn)

4. CTA — ÉP ĐĂNG KÝ:
   - "Nhấn ĐĂNG KÝ để nhận thiệp mời VIP"
   - "Số lượng ghế ngồi tại [địa điểm] CỰC KỲ GIỚI HẠN"
   - Gây áp lực: con số chỗ ngồi có hạn, deadline đăng ký`;
    }
    if (adType === "tiec_nuoi") {
      filterRules += `\n- BẮT BUỘC nhắc đợt mở bán trước: ai mua đã lời bao nhiêu %, giá đã tăng bao nhiêu.
${eventHistory ? `- SOCIAL PROOF TỪ ĐỢT TRƯỚC: "${eventHistory}" — Dùng dữ liệu này làm đòn bẩy tâm lý, khách phải thấy mình đã bỏ lỡ cơ hội thật.` : ''}
- Mẫu câu: "Khách mua đợt 1 đã lời 25% sau 18 tháng", "Giá đã tăng từ X lên Y", "Lần này là cơ hội cuối...".`;
    }
    if (target === "dau_tu") {
      filterRules += `\n- Áp dụng tỷ lệ 80% nói về lợi nhuận, lãi vốn, hạ tầng, pháp lý — 20% nói về sản phẩm.
- BẮT BUỘC đưa con số vốn ban đầu (How) và lợi nhuận kỳ vọng.
- Mẫu: "Vốn ban đầu chỉ 800tr", "Lấy được căn là thắng", "Ra 06 suất nội bộ giá F0".`;
    }
    if (adType === "khan_hiem") {
      filterRules += `\n- BẮT BUỘC có con số khan hiếm: "Chỉ còn 3 căn cuối", "06 suất nội bộ giá F0".
- Gây áp lực thời gian: "Giá này chỉ đến 15/04", "Hết suất không có đợt tiếp".`;
    }
    if (category === "nha_pho" || category === "biet_thu") {
      filterRules += `\n- Dùng ngôn từ KHẲNG ĐỊNH VỊ THẾ GIA CHỦ: "Dành cho gia chủ sành", "Không phải ai cũng sở hữu được", "1 trong 50 căn biệt thự cuối cùng".
- KHÔNG dùng mỹ từ sáo rỗng về "đẳng cấp thượng lưu" — thay bằng con số và sự thật.`;
    }

    const systemPrompt = `Bạn là BIÊN TẬP VIÊN CAO CẤP & CHUYÊN GIA CONTENT BĐS THỰC CHIẾN với 10 năm kinh nghiệm.

=== NHIỆM VỤ ===
Viết 3 PHIÊN BẢN quảng cáo cho cùng 1 dự án, mỗi bản có phong cách khác nhau:
1. BẢN "GẮT" (gat): Đánh mạnh FOMO, số liệu chạy, tạo áp lực mua ngay.
2. BẢN "KỂ CHUYỆN" (ke_chuyen): Khơi gợi tiếc nuối từ đợt mở bán trước, storytelling sâu.  
3. BẢN "TRỰC DIỆN" (truc_dien): Show thẳng giá và chính sách ưu đãi, phân tích rõ ràng.

=== YÊU CẦU ĐỘ DÀI & ĐỘ SÂU (BẮT BUỘC) ===
- Mỗi bản phải TỐI THIỂU 300-400 chữ (khoảng 1.5 màn hình điện thoại). TUYỆT ĐỐI KHÔNG viết ngắn hơn!
- Mỗi bản phải có TỐI THIỂU 4-5 đoạn văn riêng biệt, mỗi đoạn ít nhất 3 câu.
- CẤU TRÚC BẮT BUỘC cho mỗi bản:
  a) TIÊU ĐỀ gây sốc (1-2 dòng)
  b) MỞ BÀI — Hook tâm lý, kéo khách đọc tiếp (2-3 câu)
  c) PHÂN TÍCH SÂU — Tại sao mua lúc này lại thắng? Con số lợi nhuận từ đâu? (2 đoạn văn)
  d) 3 KEY CHỐT con số biết nói (bullet points)
  e) CTA khan hiếm + FOMO mạnh

- Với bài "Khơi gợi tiếc nuối" hoặc "Event":
  + PHẢI có ÍT NHẤT 2 đoạn văn phân tích tâm lý đám đông tại sự kiện cũ.
  + PHẢI có mục SO SÁNH: "Tại sao mua lúc này lại thắng?" (Lợi nhuận X% từ đâu mà có?)
  + Bài viết phải đủ "ĐỘ NGẤM" để khách sành sỏi cũng phải suy nghĩ
  + KHÔNG viết dạng bullet list khô khan — phải là đoạn văn có chiều sâu cảm xúc

=== NGUYÊN TẮC CỨNG (BẮT BUỘC CHO CẢ 3 BẢN) ===
1. KHÔNG chạy truyền thông cho CĐT — phải chạy BÁN HÀNG. Content phải lọc được khách thật.
2. Tiêu đề PHẢI chứa giá/vốn hoặc con số gây sốc. Tiêu đề = bộ lọc đầu tiên.
3. Tỷ lệ BẮT BUỘC: 80% Insight (nỗi đau + mong muốn + con số biết nói) — 20% Sản phẩm.
4. LOẠI BỎ 100% MỸ TỪ SÁO RỖNG: "nơi bắt đầu chuẩn sống", "không gian mơ ước", "đẳng cấp thượng lưu", "cuộc sống xanh", "thiên đường nghỉ dưỡng", "kiến trúc sang trọng", "phong cách sống đỉnh cao", "an cư lạc nghiệp", "tọa lạc tại vị trí đắc địa", "hệ sinh thái tiện ích đẳng cấp", "không gian sống hoàn hảo", "cơ hội vàng", "siêu phẩm", "đáng sống nhất", "sống đẳng cấp" — TẤT CẢ ĐỀU BỊ CẤM.
5. CTA phải tạo FOMO CỰC MẠNH bằng CON SỐ: "Chỉ còn 3 căn cuối", "23 người đang xem tin này".
6. Social proof phải là CON SỐ BIẾT NÓI: "87% căn đã bán trong 2 tuần", "Tăng 23% sau 18 tháng".

=== QUY TẮC FILTER THEO LỰA CHỌN ===${filterRules}

=== QUY TẮC MARKETING THỰC CHIẾN ===
${guidelinesText}`;

    const hasOriginalContent = content && content.trim();
    const userPrompt = `=== THÔNG SỐ ĐẦU VÀO ===
- Tên dự án: ${projectName.trim()}
- Loại hình: ${categoryLabel}
- Tệp khách: ${targetLabel}
- Tâm lý nhắm tới: ${psychLabel}
- Thể loại Content Ads: ${adTypeLabel}
- Giá/Vốn thực (How): ${how || "CHƯA CÓ — hãy dùng giả định hợp lý và ghi rõ [cần cập nhật giá thật]"}
${eventHistory ? `- 🔥 LỊCH SỬ SỰ KIỆN / THÀNH CÔNG ĐỢT TRƯỚC: "${eventHistory}" — BẮT BUỘC dùng làm Social Proof ngay dòng đầu tiên!` : ""}
${eventPerks ? `- 🎁 ĐẶC QUYỀN SỰ KIỆN LẦN NÀY: "${eventPerks}" — Dùng làm mồi nhử chính để khách đăng ký!` : ""}
${hasOriginalContent ? `\n=== BÀI VIẾT GỐC (Cần đánh giá + viết lại) ===\n${content.trim()}\n` : ""}
=== YÊU CẦU ===
${hasOriginalContent ? "1. Phân tích bài viết gốc (analysis + errors)\n2. Viết 3 phiên bản mới dựa trên thông số đầu vào\n3. Chấm điểm bản GẮT" : "1. Viết 3 phiên bản mới hoàn toàn dựa trên thông số đầu vào\n2. Chấm điểm bản GẮT"}

Mỗi bản phải có: Tiêu đề lọc khách → Mở bài hook tâm lý (2-3 câu) → Phân tích sâu "Tại sao mua lúc này thắng?" (2 đoạn văn) → 3 Key con số biết nói → CTA khan hiếm.
ĐỘ DÀI TỐI THIỂU: 300-400 chữ mỗi bản. KHÔNG ĐƯỢC viết ngắn!

=== OUTPUT FORMAT (JSON thuần, KHÔNG markdown, KHÔNG \`\`\`json) ===
{
  ${hasOriginalContent ? `"analysis": {
    "what": "<Sản phẩm gì>",
    "where": "<Vị trí>",
    "how": "<Giá/Vốn — hoặc 'THIẾU'>",
    "why": "<Lý do mua>"
  },
  "errors": [
    { "severity": "high|medium|low", "issue": "<lỗi>", "fix": "<cách sửa>" }
  ],` : ""}
  "versions": {
    "gat": {
      "content": "<BÀI VIẾT HOÀN CHỈNH bản GẮT — FOMO + số liệu mạnh>",
      "strategy": "<Giải thích chiến lược: tại sao chọn cách viết này>"
    },
    "ke_chuyen": {
      "content": "<BÀI VIẾT HOÀN CHỈNH bản Kể chuyện — storytelling + tiếc nuối>",
      "strategy": "<Giải thích chiến lược>"
    },
    "truc_dien": {
      "content": "<BÀI VIẾT HOÀN CHỈNH bản Trực diện — giá + chính sách rõ ràng>",
      "strategy": "<Giải thích chiến lược>"
    }
  },
  "scoring": {
    "tieu_de": { "score": 0-10, "comment": "<nhận xét>" },
    "insight_vs_sp": { "score": 0-10, "comment": "<tỷ lệ insight/sản phẩm>" },
    "con_so_cu_the": { "score": 0-10, "comment": "<có con số thật không>" },
    "cta_fomo": { "score": 0-10, "comment": "<CTA có urgency không>" },
    "social_proof": { "score": 0-10, "comment": "<bằng chứng xã hội>" },
    "cam_tu_sao_rong": { "score": 0-10, "comment": "<còn mỹ từ sáo rỗng?>" },
    "total": "<tổng /60>",
    "verdict": "<Thực chiến|Khá tốt|Trung bình|Cần sửa nhiều>"
  }
}`;

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 60000);

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.value}` },
      body: JSON.stringify({
        model: "gpt-4.1-nano",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    if (!gptRes.ok) {
      const errData = await gptRes.json().catch(() => ({}));
      return res.status(502).json({ error: `OpenAI API lỗi: ${errData.error?.message || gptRes.status}` });
    }

    const gptData = await gptRes.json();
    const raw = (gptData.choices?.[0]?.message?.content || "").trim();
    let result;
    try {
      const jsonStr = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
      result = JSON.parse(jsonStr);
    } catch {
      return res.status(502).json({ error: "AI trả về không đúng format", raw });
    }

    res.json(result);
  } catch (err) {
    if (err.name === "AbortError") return res.status(504).json({ error: "AI xử lý quá lâu (>60s), thử lại" });
    res.status(500).json({ error: err.message });
  }
});

// ========== MARKET INTELLIGENCE ENGINE ==========

// ========== MARKETING GUIDELINES (AI Marketing Advisor) ==========

const MARKETING_KNOWLEDGE = [
  { category: "Tài khoản QC", rule_name: "Facebook thích tính ổn định", content: "Nên dùng cố định thiết bị và địa chỉ IP thường xuyên đăng nhập. Ở 1 thời điểm không nên dùng quá nhiều tài khoản cùng lúc trên cùng 1 thiết bị. Mỗi 1 trình duyệt nên dùng 1 tài khoản Facebook.", keywords: "ổn định,ip,thiết bị,tài khoản,trình duyệt", priority: 1 },
  { category: "Tài khoản QC", rule_name: "3 yếu tố chạy quảng cáo", content: "Để chạy được quảng cáo cần 3 yếu tố: Tài khoản Facebook + Tài khoản quảng cáo + Trang bán hàng (Fanpage). Nếu TK Facebook bị hạn chế thì TKQC và Fanpage không dùng được. Nếu TKQC bị vô hiệu hóa thì dùng TKQC khác. Nếu Fanpage bị hạn chế thì dùng Fanpage khác.", keywords: "tài khoản,fanpage,hạn chế,vô hiệu", priority: 2 },
  { category: "Tài khoản QC", rule_name: "Lưu ý tài khoản mới", content: "1) TKQC mới chỉ lên 1 campaign. 2) TKQC mới nên chạy campaign đó cố gắng duy trì cho cắn được tầm 1 triệu. 3) TKQC mới nên lên campaign 2 nhưng vẫn chạy bài viết cũ của campaign 1. 4) Sau khi TKQC đã chi tiêu tầm trên 2 triệu thì có thể lên campaign tiếp theo cho bài viết mới. 5) Ngân sách tối đa cho 1 chiến dịch nên là 1 triệu. 6) Số nhóm quảng cáo trong 1 chiến dịch không quá 2.", keywords: "tài khoản mới,campaign,ngân sách,chiến dịch,nhóm", priority: 3 },
  { category: "Fanpage", rule_name: "Tạo Fanpage chuẩn SEO", content: "Tên Fanpage phải chứa từ khóa chính và từ khóa phụ. Username (URL) nên tối ưu. Mô tả chứa từ khóa. Có website. Hạng mục phù hợp ngành nghề. Lượt checkin giúp tăng trust. Page được tạo từ BM agency hoặc BM đã xác minh sẽ khỏe hơn page thông thường.", keywords: "fanpage,seo,từ khóa,page,bm", priority: 2 },
  { category: "Cấu trúc chiến dịch", rule_name: "3 tầng quảng cáo (Campaign > Ad Set > Ad)", content: "Tầng 1 - Chiến dịch: Đặt tên, mục tiêu, tối ưu ngân sách CBO. Tầng 2 - Nhóm QC: Trang Facebook, ngân sách & lịch chạy, đối tượng target, vị trí quảng cáo. Tầng 3 - Quảng cáo: Sử dụng bài viết có sẵn hoặc tạo QC mới, mẫu tin nhắn.", keywords: "chiến dịch,nhóm,quảng cáo,cấu trúc,tầng,cbo", priority: 3 },
  { category: "Targeting", rule_name: "Phân tích đối tượng khách hàng BĐS cao cấp", content: "Phân tích khách hàng theo 3 câu hỏi: 1) Họ là ai? (bác sỹ, doanh nhân, chủ DN, quản lý cao cấp, luật sư, Việt kiều). 2) Họ thường làm gì? (du lịch, hạng thương gia, resort cao cấp, golf, tennis). 3) Họ quan tâm gì? (BĐS, tài chính, cổ phiếu, thương hiệu cao cấp: kim cương, vàng, Audi, Bentley, Chanel). Target theo nhóm: hành chính, quản lý, y tế, pháp lý, tài chính, BĐS, đầu tư, luxury, du lịch, golf.", keywords: "target,đối tượng,khách hàng,sở thích,nhóm,bđs,cao cấp", priority: 3 },
  { category: "Targeting", rule_name: "Mẹo targeting nâng cao", content: "Một người có nhiều sở thích → ưu tiên sở thích bổ sung. Nên loại trừ các tệp đối tượng clone. Chạy location thì chọn dòng và có thể không cần target nếu tệp đối tượng nhỏ. Gõ từ khóa bằng tiếng Anh cho kết quả tốt hơn. Brand (thương hiệu) và thú vui giới siêu giàu là target hiệu quả.", keywords: "target,loại trừ,location,tiếng anh,brand,clone", priority: 2 },
  { category: "Test & Tối ưu", rule_name: "Xử lý sau AB Test", content: "TH1 - Chỉ có 1 nhóm hiệu quả: Bước 1: Tắt nhóm không hiệu quả, giữ nhóm hiệu quả. Bước 2: Nhân ra 1 chiến dịch mới, tạo khoảng 3 nhóm QC giống nhau. TH2 - Có từ 2 nhóm hiệu quả trở lên: Cách 1: Làm như TH1; Cách 2: Gom chung các nhóm hiệu quả vào 1 nhóm rồi nhân ra nhiều nhóm.", keywords: "test,ab,hiệu quả,nhân bản,nhóm,tối ưu,tắt", priority: 3 },
  { category: "Test & Tối ưu", rule_name: "Giai đoạn máy học Facebook", content: "Facebook cần 50 sự kiện chuyển đổi trong 7 ngày để hoàn tất giai đoạn máy học. Ví dụ: 1 tin nhắn = 100 nghìn → 50 sự kiện = 5 triệu → 7 ngày = 5 triệu → 1 ngày cần ~714 nghìn ngân sách. Trong giai đoạn máy học, KHÔNG nên chỉnh sửa chiến dịch.", keywords: "máy học,50 sự kiện,7 ngày,ngân sách,chuyển đổi,learning", priority: 3 },
  { category: "Ngân sách", rule_name: "Quy tắc tăng ngân sách", content: "Tăng ngân sách KHÔNG quá 30% mỗi lần. 1 ngày chỉ tăng không quá 2 lần. Vi phạm quy tắc này sẽ khiến chiến dịch reset giai đoạn máy học.", keywords: "ngân sách,tăng,30%,máy học,budget", priority: 3 },
  { category: "Ngân sách", rule_name: "Ngân sách tối đa chiến dịch", content: "Ngân sách tối đa cho 1 chiến dịch nên là 1 triệu đồng/ngày. Số nhóm quảng cáo trong 1 chiến dịch không nên quá 2. Với TKQC mới, cắn được 1 triệu chi tiêu trước khi lên campaign mới.", keywords: "ngân sách,chiến dịch,nhóm,tối đa,1 triệu", priority: 2 },
  { category: "Đối tượng", rule_name: "Đối tượng tùy chỉnh (Custom Audience)", content: "Đối tượng tùy chỉnh là đối tượng mà chúng ta sở hữu, gồm: Trang web (pixel), Danh sách khách hàng (email/phone), Video (người xem), Trang Facebook (người tương tác). Đây là tệp đối tượng mạnh nhất vì đã biết về thương hiệu.", keywords: "custom audience,tùy chỉnh,pixel,danh sách,video,tương tác", priority: 2 },
  { category: "Đối tượng", rule_name: "Đối tượng tương tự (Lookalike Audience)", content: "Đối tượng tương tự được tạo ra từ đối tượng tùy chỉnh. Facebook sẽ tìm người có hành vi, sở thích tương tự với tệp nguồn. Lookalike 1% là chính xác nhất, tệp càng lớn thì lookalike càng kém chính xác.", keywords: "lookalike,tương tự,tùy chỉnh,1%,tệp", priority: 2 },
  { category: "Chiến lược", rule_name: "7 chiến lược chạy quảng cáo", content: "1) Chạy target đối tượng khách hàng - cơ bản nhất. 2) Chạy full target - phù hợp khi tệp nhỏ. 3) Chạy loại trừ - tìm kiếm đối tượng mới tinh. 4) Chạy remarketing + đối tượng tương tự. 5) Chạy tăng like page. 6) Chạy tương tác bài viết. 7) Chạy bids thầu - nâng cao.", keywords: "chiến lược,target,remarketing,lookalike,like,tương tác,bids", priority: 3 },
  { category: "Tối ưu chi phí", rule_name: "Chạy quảng cáo rẻ", content: "Để chi phí rẻ: Tối ưu theo vị trí, tuổi, giới tính, thiết bị, vị trí hiển thị. Xem báo cáo phân tích để biết segment nào cho kết quả tốt nhất rồi tập trung ngân sách vào đó. Tắt các segment kém hiệu quả. Mỗi nick Facebook tạo được 2 tài khoản doanh nghiệp (BM1 và BM2).", keywords: "chi phí,tối ưu,rẻ,vị trí,tuổi,giới tính,segment,bm", priority: 3 },
  { category: "Nội dung", rule_name: "Cấu trúc bài viết chuẩn Facebook Ads", content: "Bài viết quảng cáo cần: Hook mạnh (câu đầu gây tò mò), nêu pain point, giải pháp (dự án), social proof (số liệu, khách hàng), CTA rõ ràng. Spy content đối thủ để học hỏi. Tránh nội dung vi phạm chính sách Facebook (thuốc, rượu, vũ khí, phân biệt...).", keywords: "nội dung,bài viết,content,hook,cta,spy,vi phạm", priority: 3 },
];

// Seed marketing guidelines
app.post("/api/marketing-guidelines/seed", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const existing = await get(db, "SELECT COUNT(*) as cnt FROM marketing_guidelines");
    if (existing.cnt > 0) {
      return res.json({ message: "Đã có dữ liệu", count: existing.cnt });
    }
    for (const g of MARKETING_KNOWLEDGE) {
      await run(db, "INSERT INTO marketing_guidelines(category, rule_name, content, keywords, priority) VALUES(?, ?, ?, ?, ?)", 
        [g.category, g.rule_name, g.content, g.keywords, g.priority]);
    }
    res.json({ message: "Đã nạp kiến thức marketing", count: MARKETING_KNOWLEDGE.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/marketing-guidelines", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await all(db, "SELECT * FROM marketing_guidelines ORDER BY priority DESC, category");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI Campaign Advisor
app.post("/api/campaign-advisor", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { campaigns: campData } = req.body;
    if (!campData || !campData.length) return res.status(400).json({ error: "Không có dữ liệu chiến dịch" });

    const guidelines = await all(db, "SELECT * FROM marketing_guidelines ORDER BY priority DESC");
    if (!guidelines.length) return res.status(400).json({ error: "Chưa nạp kiến thức marketing. Bấm 'Nạp kiến thức' trước." });

    const apiKey = await get(db, "SELECT value FROM settings WHERE key = 'perplexity_api_key'");
    if (!apiKey?.value) return res.status(400).json({ error: "Chưa cấu hình API key Perplexity" });

    const guidelinesText = guidelines.map(g => `[${g.category}] ${g.rule_name}: ${g.content}`).join("\n");
    const campSummary = campData.map(c => 
      `- ${c.name}: Chi ${Number(c.spend||0).toLocaleString("vi-VN")}đ, ${c.fbLeads||0} lead FB, ${c.crmLeads||0} lead CRM, ${c.interested||0} quan tâm (${c.interestPct||0}%), CPL=${c.cpl?Number(c.cpl).toLocaleString("vi-VN")+"đ":"N/A"}, CPM=${c.cpm?Number(c.cpm).toLocaleString("vi-VN")+"đ":"N/A"}, CTR=${c.ctr||"N/A"}%, NS/ngày=${c.dailyBudget?Number(c.dailyBudget).toLocaleString("vi-VN")+"đ":"N/A"}, trạng thái=${c.status||"?"}`
    ).join("\n");

    const prompt = `Bạn là GIÁM ĐỐC MARKETING với 10 năm kinh nghiệm chạy Facebook Ads BĐS. 

ĐÂY LÀ BỘ QUY TẮC VÀNG CỦA BẠN (học từ kinh nghiệm thực chiến):
${guidelinesText}

DỮ LIỆU CHIẾN DỊCH HIỆN TẠI:
${campSummary}

PHÂN TÍCH VÀ ĐƯA RA LỜI KHUYÊN. Quy tắc:
1. SOI từng chiến dịch: CPL bao nhiêu? So với mức nào là tốt cho BĐS (200-500k)? 
2. % Quan tâm < 15% → nội dung có vấn đề, trích quy tắc nào cần áp dụng
3. CPM quá cao (> 80k) → đối tượng bị hẹp hoặc content kém
4. Chiến dịch nào nên TẮT, chiến dịch nào nên TĂNG ngân sách (nhớ quy tắc 30%)
5. Ngân sách/ngày có hợp lý không? (max 1 triệu/chiến dịch theo quy tắc)
6. ĐỀ XUẤT: 3 gợi ý content mới dựa trên chiến dịch hiệu quả nhất

KHÔNG chung chung. PHẢI trích quy tắc cụ thể. PHẢI nêu CON SỐ.

Trả về ĐÚNG JSON thuần (KHÔNG markdown):
{
  "overall_verdict": "Tốt|Trung bình|Cần cải thiện|Đang có vấn đề",
  "overall_score": 75,
  "summary": "1-2 câu tổng kết tình hình chiến dịch, thẳng thắn",
  "campaign_reviews": [
    {
      "name": "tên chiến dịch",
      "verdict": "Tốt|TB|Kém",
      "diagnosis": "Chẩn đoán ngắn gọn: vấn đề chính",
      "rules_violated": ["Tên quy tắc bị vi phạm"],
      "advice": "Lời khuyên cụ thể, có con số",
      "action": "TĂNG ngân sách 20%|TẮT ngay|GIỮ nguyên|GIẢM 30%"
    }
  ],
  "budget_suggestions": [
    "Đề xuất phân bổ ngân sách cụ thể giữa các chiến dịch"
  ],
  "content_ideas": [
    {
      "title": "Ý tưởng bài viết",
      "hook": "Câu hook mở đầu gợi ý",
      "target": "Đối tượng nên nhắm",
      "reason": "Tại sao ý tưởng này sẽ hiệu quả (trích quy tắc)"
    }
  ]
}`;

    const ppxRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.value}` },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "Bạn là Giám đốc Marketing BĐS 10 năm kinh nghiệm. Luôn trả lời bằng JSON thuần, không markdown." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });
    if (!ppxRes.ok) { const e = await ppxRes.text(); return res.status(500).json({ error: `Perplexity error: ${e}` }); }
    const ppxData = await ppxRes.json();
    const raw = (ppxData.choices?.[0]?.message?.content || "").trim();
    let parsed;
    try {
      const jsonStr = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch { parsed = { overall_verdict: "Lỗi", summary: raw, campaign_reviews: [], budget_suggestions: [], content_ideas: [] }; }
    res.json(parsed);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Single campaign deep analysis
app.post("/api/campaign-advisor/single", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { campaign, ads } = req.body;
    if (!campaign) return res.status(400).json({ error: "Không có dữ liệu chiến dịch" });

    const guidelines = await all(db, "SELECT * FROM marketing_guidelines ORDER BY priority DESC");
    if (!guidelines.length) return res.status(400).json({ error: "Chưa nạp kiến thức marketing. Bấm 'Nạp kiến thức' trước." });

    const apiKey = await get(db, "SELECT value FROM settings WHERE key = 'perplexity_api_key'");
    if (!apiKey?.value) return res.status(400).json({ error: "Chưa cấu hình API key Perplexity" });

    const guidelinesText = guidelines.map(g => `[${g.category}] ${g.rule_name}: ${g.content}`).join("\n");
    const c = campaign;
    const campDetail = `Tên: ${c.name}
Chi tiêu: ${Number(c.spend||0).toLocaleString("vi-VN")}đ
Leads Facebook: ${c.fbLeads||0}
Leads CRM: ${c.crmLeads||0}
Quan tâm: ${c.interested||0} (${c.interestPct||0}%)
Không quan tâm: ${c.notInterested||0} (${c.notInterestedPct||0}%)
Spam: ${c.spam||0} (${c.spamPct||0}%)
Chưa xử lý: ${c.newLead||0}
CPL: ${c.cpl?Number(c.cpl).toLocaleString("vi-VN")+"đ":"Chưa có lead"}
CPM: ${c.cpm?Number(c.cpm).toLocaleString("vi-VN")+"đ":"N/A"}
CTR liên kết: ${c.ctr||"N/A"}%
CPC: ${c.cpc?Number(c.cpc).toLocaleString("vi-VN")+"đ":"N/A"}
Ngân sách/ngày: ${c.dailyBudget?Number(c.dailyBudget).toLocaleString("vi-VN")+"đ":"N/A"}
Lượt tiếp cận: ${c.reach?Number(c.reach).toLocaleString("vi-VN"):"N/A"}
Lượt hiển thị: ${c.impressions?Number(c.impressions).toLocaleString("vi-VN"):"N/A"}
Click liên kết: ${c.linkClicks||"N/A"}
Trạng thái: ${c.status||"?"}`;

    // Build real ads content section
    const realAds = (ads || []).filter(a => a.content?.text || a.content?.headline);
    let adsContent = "";
    if (realAds.length > 0) {
      adsContent = "\n\nCÁC BÀI QUẢNG CÁO THỰC TẾ ĐANG CHẠY:\n" + realAds.map((ad, i) => {
        const ins = ad.insights;
        const metrics = ins ? `  Metrics: Spend ${Number(ins.spend||0).toLocaleString("vi-VN")}đ | Impressions ${Number(ins.impressions||0).toLocaleString("vi-VN")} | Clicks ${ins.inline_link_clicks||0} | CTR ${ins.inline_link_click_ctr||ins.ctr||"N/A"}% | CPM ${Number(ins.cpm||0).toLocaleString("vi-VN")}đ` : "";
        return `--- Bài QC #${i+1}: "${ad.name}" (${ad.status}) ---
  Nhóm QC: ${ad.adsetName||"N/A"}
  Nội dung bài viết: ${ad.content.text || "(trống)"}
  Headline: ${ad.content.headline || "(trống)"}
  Mô tả: ${ad.content.description || "(trống)"}
  CTA button: ${ad.content.cta || "(không có)"}
  Link: ${ad.content.linkUrl || "N/A"}${metrics}`;
      }).join("\n\n");
    }

    const hasRealContent = realAds.length > 0;
    const contentInstruction = hasRealContent
      ? `2. SOI CONTENT - DÙNG NỘI DUNG THỰC TẾ:
   Dưới đây là NỘI DUNG THỰC TẾ các bài QC đang chạy. Hãy SOI KỸ TỪNG BÀI:
   - Phân tích TỪNG bài QC: nội dung đang sai ở đâu? Hook yếu? Thiếu social proof? CTA không rõ? Không urgency?
   - Nêu rõ TỪNG lỗi cụ thể (đánh dấu severity: high/medium/low)
   
   QUAN TRỌNG - VIẾT LẠI BÀI HOÀN CHỈNH:
   - improved.text phải là BÀI VIẾT ĐẦY ĐỦ dạng Facebook Post, KHÔNG PHẢI đoạn tóm tắt ngắn
   - Giữ nguyên CẤU TRÚC và ĐỘ DÀI tương tự bài gốc (nếu bài gốc 10 dòng thì bài mới cũng ~10 dòng)
   - Copy bài gốc làm nền, chỉ SỬA ĐÚNG CHỖ SAI: hook yếu → viết hook mạnh hơn, thiếu social proof → thêm social proof, CTA mờ nhạt → CTA rõ ràng
   - Dùng emoji, xuống dòng, format giống bài Facebook Ads BĐS thật
   - Bài cải thiện phải SẴN SÀNG COPY-PASTE chạy quảng cáo luôn
   - improved.description: mô tả link mới nếu cần sửa
   
   Phân tích metrics:
   - % Quan tâm: ${c.interestPct}% ${Number(c.interestPct||0) < 15 ? "→ CONTENT CÓ VẤN ĐỀ" : ""}
   - CTR: ${c.ctr||"N/A"}% ${Number(c.ctr||0) < 1 ? "→ headline/hình ảnh kém" : ""}  
   - CPM: ${c.cpm?Number(c.cpm).toLocaleString("vi-VN")+"đ":"N/A"} ${Number(c.cpm||0) > 80000 ? "→ FB đánh giá content kém" : ""}`
      : `2. SOI CONTENT (không có nội dung thực tế):
   Đoán content dựa trên tên chiến dịch "${c.name}"`;

    const adsReviewJson = hasRealContent
      ? `"ads_review": [
    {
      "ad_name": "Tên bài QC",
      "current": { "text": "Copy nguyên văn nội dung gốc từ bài QC thực tế", "headline": "Headline gốc", "description": "Mô tả gốc", "cta": "CTA gốc" },
      "errors": [
        {"part": "text|headline|cta|description", "issue": "Mô tả lỗi cụ thể", "severity": "high|medium|low", "original_text": "đoạn text gốc bị lỗi", "fixed_text": "đoạn text đã sửa"}
      ],
      "improved": {
        "text": "BÀI VIẾT ĐẦY ĐỦ dạng Facebook Post — cùng độ dài bài gốc, giữ cấu trúc, chỉ sửa chỗ sai. Dùng emoji + xuống dòng. Sẵn sàng copy-paste chạy QC luôn.",
        "headline": "Headline MỚI hấp dẫn hơn",
        "description": "Mô tả link mới nếu cần",
        "cta": "CTA MỚI"
      },
      "improvements": ["Dòng 1: Đã sửa [chỗ cụ thể] từ '...' thành '...'", "Dòng 2: Thêm [social proof/urgency/benefit]"]
    }
  ],`
      : `"ads_review": [],`;

    const prompt = `Bạn là GIÁM ĐỐC MARKETING với 10 năm kinh nghiệm chạy Facebook Ads BĐS.

BỘ QUY TẮC VÀNG:
${guidelinesText}

CHIẾN DỊCH CẦN PHÂN TÍCH CHI TIẾT:
${campDetail}${adsContent}

HÃY SOI KỸ chiến dịch này. PHÂN TÍCH SÂU:

1. CHẨN ĐOÁN TỔNG QUAN: Điểm mạnh, điểm yếu?

${contentInstruction}

3. SOI TARGETING:
   - Frequency: reach ${c.reach||"?"} vs impressions ${c.impressions||"?"} → frequency có > 3?
   - CPM cho thấy target phù hợp không?

4. SOI NGÂN SÁCH:
   - Ngân sách/ngày có hợp lý? (max 1 triệu/ngày)
   - Giai đoạn máy học? (cần 50 events/7 ngày)
   - Quy tắc 30%

5. HÀNH ĐỘNG: 3-5 việc cần làm NGAY

KHÔNG chung chung. PHẢI trích CON SỐ cụ thể từ data.

Trả về ĐÚNG JSON thuần (KHÔNG markdown, KHÔNG \`\`\`):
{
  "score": 75,
  "verdict": "Tốt|Trung bình|Cần cải thiện|Đang có vấn đề",
  "summary": "1-2 câu tổng kết nhanh",
  ${adsReviewJson}
  "targeting_analysis": {
    "status": "Tốt|Cần điều chỉnh|Có vấn đề",
    "frequency_warning": true,
    "detail": "Phân tích targeting chi tiết"
  },
  "budget_analysis": {
    "status": "Hợp lý|Cần điều chỉnh|Quá cao|Quá thấp",
    "in_learning": false,
    "recommendation": "Tăng 20%|Giảm 30%|Giữ nguyên|TẮT ngay",
    "detail": "Chi tiết lý do"
  },
  "actions": ["Việc cần làm 1", "Việc cần làm 2"],
  "rules_applied": ["Tên quy tắc đã áp dụng"]
}`;

    const ppxRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.value}` },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "Bạn là Giám đốc Marketing BĐS 10 năm kinh nghiệm. Phân tích CHI TIẾT 1 chiến dịch duy nhất. Luôn trả lời bằng JSON thuần, không markdown." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });
    if (!ppxRes.ok) { const e = await ppxRes.text(); return res.status(500).json({ error: `Perplexity error: ${e}` }); }
    const ppxData = await ppxRes.json();
    const raw = (ppxData.choices?.[0]?.message?.content || "").trim();
    let parsed;
    try {
      const jsonStr = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch { parsed = { score: 0, verdict: "Lỗi", summary: raw, ads_review: [], targeting_analysis: {}, budget_analysis: {}, actions: [], rules_applied: [] }; }
    res.json(parsed);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== FACEBOOK CONVERSIONS API (CAPI) ==========
async function sendCapiEvent(db, lead, eventName) {
  try {
    const pixelId = (await get(db, "SELECT value FROM settings WHERE key='capi_pixel_id'"))?.value;
    const token = (await get(db, "SELECT value FROM settings WHERE key='capi_access_token'"))?.value;
    if (!pixelId || !token) return;

    const phone = (lead.phone || "").replace(/[^0-9]/g, "");
    const hashedPhone = phone ? await hashSHA256(phone.startsWith("0") ? "84" + phone.slice(1) : phone) : undefined;
    const hashedName = lead.name ? await hashSHA256(lead.name.toLowerCase().trim()) : undefined;

    const eventData = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "system_generated",
      user_data: {},
      custom_data: {
        content_name: lead.project || "",
        content_category: "real_estate",
        status: lead.status || "",
      },
    };
    if (hashedPhone) eventData.user_data.ph = [hashedPhone];
    if (hashedName) eventData.user_data.fn = [hashedName];

    const url = `https://graph.facebook.com/v22.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
    const fbRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [eventData] }),
    });
    const result = await fbRes.json();
    if (result.error) console.error("[CAPI] Error:", result.error.message);
    else console.log(`[CAPI] Sent ${eventName} for lead #${lead.id} → events_received: ${result.events_received}`);
    return result;
  } catch (err) {
    console.error("[CAPI] Exception:", err.message);
  }
}

async function hashSHA256(value) {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(value).digest("hex");
}

// CAPI trigger status mapping
const CAPI_EVENT_MAP = {
  closed: "Purchase",
  booked: "InitiateCheckout",
  booking_other: "InitiateCheckout",
  appointment: "Schedule",
  interested: "Lead",
};

// CAPI Settings endpoints
app.get("/api/capi-settings", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const pixelId = (await get(db, "SELECT value FROM settings WHERE key='capi_pixel_id'"))?.value || "";
    const token = (await get(db, "SELECT value FROM settings WHERE key='capi_access_token'"))?.value || "";
    const events = (await get(db, "SELECT value FROM settings WHERE key='capi_events'"))?.value || JSON.stringify(CAPI_EVENT_MAP);
    res.json({ pixelId, hasToken: !!token, events: JSON.parse(events) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/capi-settings", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const { pixelId, accessToken, events } = req.body;
    if (pixelId !== undefined) {
      await run(db, "INSERT INTO settings(key, value) VALUES('capi_pixel_id', ?) ON CONFLICT(key) DO UPDATE SET value = ?", [pixelId, pixelId]);
    }
    if (accessToken !== undefined) {
      await run(db, "INSERT INTO settings(key, value) VALUES('capi_access_token', ?) ON CONFLICT(key) DO UPDATE SET value = ?", [accessToken, accessToken]);
    }
    if (events !== undefined) {
      const val = JSON.stringify(events);
      await run(db, "INSERT INTO settings(key, value) VALUES('capi_events', ?) ON CONFLICT(key) DO UPDATE SET value = ?", [val, val]);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Test CAPI connection
app.post("/api/capi-test", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const pixelId = (await get(db, "SELECT value FROM settings WHERE key='capi_pixel_id'"))?.value;
    const token = (await get(db, "SELECT value FROM settings WHERE key='capi_access_token'"))?.value;
    if (!pixelId || !token) return res.status(400).json({ error: "Chưa cấu hình Pixel ID hoặc Access Token" });

    const testEvent = {
      event_name: "Lead",
      event_time: Math.floor(Date.now() / 1000),
      action_source: "system_generated",
      user_data: { fn: [await hashSHA256("test")] },
      custom_data: { content_name: "CRM Test Event", content_category: "test" },
    };
    const url = `https://graph.facebook.com/v22.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
    const fbRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [testEvent], test_event_code: req.body.testCode || "" }),
    });
    const result = await fbRes.json();
    if (result.error) return res.status(400).json({ error: result.error.message });
    res.json({ ok: true, events_received: result.events_received });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CAPI event log
app.get("/api/capi-log", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await all(db, "SELECT * FROM capi_log ORDER BY id DESC LIMIT 100");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// =================================================

// Module 1: Ad Library Scraper — Headless Browser (Puppeteer + Stealth)
async function scrapeAdLibrary(projectName, _adAccountRows) {
  const startTime = Date.now();
  // Safety limit: must return before Vercel kills at 60s
  const elapsed = () => Date.now() - startTime;
  const mustStop = () => elapsed() > 45000; // 45s max for ad scraping, leave 15s for price+AI+response
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

    const puppeteer = (await import("puppeteer-core")).default;

    // Try @sparticuz/chromium first (Vercel/Lambda), then system Chromium (VPS)
    let execPath;
    let launchArgs = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--single-process"];
    let headlessMode = "new";
    try {
      const chromium = (await import("@sparticuz/chromium")).default;
      execPath = await chromium.executablePath();
      launchArgs = [...chromium.args, ...launchArgs];
      headlessMode = chromium.headless ?? "new";
    } catch {
      // Fallback: find system Chromium/Chrome on VPS
      const candidates = [
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/snap/bin/chromium",
        process.env.CHROMIUM_PATH || "",
      ];
      execPath = candidates.find(p => p && fs.existsSync(p));
      if (!execPath) throw new Error("Chromium not found on VPS. Install: apt install -y chromium-browser");
      console.log(`[MI] Using system Chromium: ${execPath}`);
    }

    browser = await puppeteer.launch({
      args: launchArgs,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: execPath,
      headless: headlessMode,
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
    activityLog.push(`Đang xác thực dữ liệu từ ${browserUnresolved.length} Fanpage chủ chốt của dự án...`);
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

// ═══════════════════════════════════════════════════════════════════
// AI Module — Perplexity Sonar for real-time project verification
// ═══════════════════════════════════════════════════════════════════
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || "";

async function callPerplexityAI(prompt, maxTokens = 800) {
  if (!PERPLEXITY_API_KEY) return null;
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "Bạn là chuyên gia phân tích dự án bất động sản Việt Nam. Luôn tìm kiếm thông tin thực tế trên internet để xác minh dữ liệu. Trả lời bằng JSON thuần, không markdown." },
          { role: "user", content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

// AI verification: search internet to confirm project type, location, products
async function aiVerifyProject(projectName, priceData, adData, cplResult, districtAvgCpl) {
  // Pre-calculate villa CPL (2.2x multiplier) so Perplexity gets the right numbers
  const villaCplAvg = Math.round(cplResult.cplAvg * 2.2 / 1000) * 1000;
  const prompt = `Tìm kiếm thông tin thực tế về dự án bất động sản "${projectName}" tại Việt Nam.

DỮ LIỆU HỆ THỐNG ĐÃ CÀO (cần thẩm định):
- Loại dự án crawler phát hiện: ${priceData.projectType}
- Giá cao tầng: ${priceData.highRisePrice ? (priceData.highRisePrice / 1e6).toFixed(1) + " triệu/m²" : "không có dữ liệu"}
- Giá thấp tầng: ${priceData.lowRisePrice ? (priceData.lowRisePrice / 1e6).toFixed(1) + " triệu/m²" : "không có dữ liệu"}
- Số tin cao tầng: ${priceData.highRiseCount}, thấp tầng: ${priceData.lowRiseCount}
- Vị trí phát hiện: ${priceData.detectedLocation || "chưa rõ"}
- CPL ước tính căn hộ (cao tầng): ${cplResult.cplAvg / 1000}K
- CPL ước tính nhà phố/biệt thự (thấp tầng): ${villaCplAvg / 1000}K
- TB khu vực: ${districtAvgCpl / 1000}K
- Số quảng cáo: ${adData.activeAds}, Phân khúc: ${cplResult.segment}

LƯU Ý QUAN TRỌNG VỀ CPL:
- Nếu dự án chỉ bán CAO TẦNG → dùng CPL căn hộ: ${cplResult.cplAvg / 1000}K trong marketInsight
- Nếu dự án chỉ bán THẤP TẦNG → dùng CPL nhà phố/biệt thự: ${villaCplAvg / 1000}K trong marketInsight
- Nếu dự án bán CẢ HAI → đề cập cả 2 mức CPL

HÃY TRẢ LỜI JSON THUẦN (không backtick, không markdown):
{
  "confirmedType": "cao_tang" hoặc "thap_tang" hoặc "both",
  "confirmedTypeReason": "lý do ngắn gọn dựa trên thông tin thực tế",
  "location": "Quận/Huyện, Tỉnh/TP chính xác" hoặc null,
  "productTypes": ["chỉ liệt kê sản phẩm THỰC SỰ CÓ tại dự án"],
  "filteredPriceNote": "ghi chú nếu crawler lấy nhầm dữ liệu" hoặc null,
  "marketInsight": "1-2 câu nhận xét chuyên nghiệp tiếng Việt về cơ hội quảng cáo, dùng đúng CPL tương ứng loại dự án"
}

QUY TẮC BẮT BUỘC:
- confirmedType: Xác minh thực tế. VD: "Lapura" nếu chỉ có căn hộ thì là "cao_tang", nếu chỉ có villas thì là "thap_tang".
- productTypes: CHỈ CÁC LOẠI THẬT SỰ TỒN TẠI. Chọn từ: Studio, 1PN, 2PN, 3PN, Penthouse, Nhà phố, Song lập, Biệt thự đơn lập, Shophouse.
- location: Vị trí chính xác nhất. VD: "Nhơn Trạch, Đồng Nai" hoặc "Phú Mỹ, Bà Rịa - Vũng Tàu".
- filteredPriceNote: Nếu crawler lấy nhầm tin chung cư vào dự án villas (hoặc ngược lại), ghi rõ.
- marketInsight: Phân tích giá trị cho nhà quảng cáo BĐS. PHẢI dùng đúng CPL tương ứng loại dự án (không dùng CPL căn hộ cho dự án villa).`;

  const raw = await callPerplexityAI(prompt, 600);
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    // Find the JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch { return null; }
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
  let detectedLocation = ""; // Tỉnh/thành phố cào được từ HTML
  let scrapedHtml = ""; // Raw HTML for AI analysis

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

  // Helper: extract location (tỉnh/thành phố) from HTML
  const extractLocation = (html) => {
    // Pattern: "tại Quận X, TP Y" or "Phường X, Quận Y, Thành phố Z"
    const m1 = html.match(/(?:tại|thuộc|ở)\s+([^,<]{2,30}),\s*([^,<]{2,40})/i);
    if (m1) {
      const district = m1[1].trim();
      const city = m1[2].trim().replace(/^(Thành phố|TP\.?|Tỉnh)\s*/i, "");
      if (city && !/javascript|function|var |const |let /i.test(city)) return `${district}, ${city}`;
    }
    // Breadcrumb pattern: "Hồ Chí Minh" or province names
    const provinces = ["Hồ Chí Minh","Hà Nội","Đà Nẵng","Bình Dương","Đồng Nai","Long An","Bà Rịa - Vũng Tàu","Bà Rịa Vũng Tàu","Khánh Hòa","Quảng Ninh","Hải Phòng","Cần Thơ","Lâm Đồng","Thanh Hóa","Nghệ An","Bắc Ninh","Hưng Yên","Thừa Thiên Huế"];
    for (const prov of provinces) {
      const re = new RegExp(prov.replace(/[-]/g, "[\\s-]*"), "i");
      if (re.test(html)) {
        // Try to find district before province
        const m2 = html.match(new RegExp("([^,<>]{2,25}),\\s*" + prov.replace(/[-]/g, "[\\s-]*"), "i"));
        if (m2) {
          const dist = m2[1].trim();
          if (dist.length > 1 && !/javascript|function|var\s/i.test(dist)) return `${dist}, ${prov}`;
        }
        return prov;
      }
    }
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
      scrapedHtml = html; // Capture for AI analysis
      // Extract project info
      if (!projectPhase) projectPhase = extractPhase(html);
      if (!projectStatus) projectStatus = extractStatus(html);
      if (!officialPrice) officialPrice = extractOfficialPrice(html);
      if (!detectedLocation) detectedLocation = extractLocation(html);

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
    lowRisePrice = Math.round(highRisePrice * 1.4);
  }
  if (!projectType) {
    if (highRiseCount > 0 && lowRiseCount > 0) projectType = "both";
    else if (highRiseCount > 0) projectType = "cao_tang";
    else if (lowRiseCount > 0) projectType = "thap_tang";
    else projectType = "both";
  }
  if (newListings7d === 0) newListings7d = 5 + Math.floor(Math.random() * 30);

  const avgPriceM2 = highRiseCount > 0 ? highRisePrice : lowRiseCount > 0 ? lowRisePrice : highRisePrice;

  // Build product types detail list
  const productTypes = [];
  const round1 = (n) => Math.round(n * 10) / 10;
  if (projectType !== "thap_tang" && highRisePrice > 0) {
    const pm2 = highRisePrice;
    productTypes.push({ name: "Studio", category: "cao_tang", priceM2: pm2, typicalArea: 30, totalPrice: round1(pm2 * 30 / 1e9) });
    productTypes.push({ name: "1PN", category: "cao_tang", priceM2: pm2, typicalArea: 50, totalPrice: round1(pm2 * 50 / 1e9) });
    productTypes.push({ name: "2PN", category: "cao_tang", priceM2: pm2, typicalArea: 70, totalPrice: round1(pm2 * 70 / 1e9) });
    productTypes.push({ name: "3PN", category: "cao_tang", priceM2: pm2, typicalArea: 100, totalPrice: round1(pm2 * 100 / 1e9) });
    productTypes.push({ name: "Penthouse", category: "cao_tang", priceM2: Math.round(pm2 * 1.15), typicalArea: 180, totalPrice: round1(pm2 * 1.15 * 180 / 1e9) });
  }
  if (projectType !== "cao_tang" && lowRisePrice > 0) {
    const pm2L = lowRisePrice;
    productTypes.push({ name: "Nhà phố", category: "thap_tang", priceM2: pm2L, typicalArea: 100, totalPrice: round1(pm2L * 100 / 1e9) });
    productTypes.push({ name: "Song lập", category: "thap_tang", priceM2: Math.round(pm2L * 1.05), typicalArea: 150, totalPrice: round1(pm2L * 1.05 * 150 / 1e9) });
    productTypes.push({ name: "Biệt thự đơn lập", category: "thap_tang", priceM2: Math.round(pm2L * 1.12), typicalArea: 250, totalPrice: round1(pm2L * 1.12 * 250 / 1e9) });
    productTypes.push({ name: "Shophouse", category: "thap_tang", priceM2: Math.round(pm2L * 1.08), typicalArea: 120, totalPrice: round1(pm2L * 1.08 * 120 / 1e9) });
  }

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
    detectedLocation,
    productTypes,
    scrapedHtml,
  };
}

// Module 3: Calculation Engine — CPL Pro 2026 formula
// CPL = Base_CPL × Segment_Factor × Location_Factor × Competition_Multiplier
function estimateCpl(adCount, pricePerM2, location) {
  const baseCpl = 250000; // 250K VND base
  const priceInTrieu = pricePerM2 / 1000000;

  // Segment Factor — based on price tier
  let segmentFactor = 1.0;
  let segment = "standard";
  if (priceInTrieu > 150)      { segmentFactor = 2.8; segment = "ultra_luxury"; }
  else if (priceInTrieu > 80)  { segmentFactor = 1.6; segment = "luxury"; }
  else if (priceInTrieu > 45)  { segmentFactor = 1.2; segment = "mid_high"; }
  else if (priceInTrieu > 30)  { segmentFactor = 1.0; segment = "mid"; }
  else                         { segmentFactor = 0.85; segment = "affordable"; }

  // Location Factor — center/suburban/remote
  let locationFactor = 1.0;
  let locationTier = "suburban";
  const loc = (location || "").toUpperCase();
  if (/QU[ẬA]N\s*1|QU[ẬA]N\s*3|PH[ÚU]\s*NHU[ẬA]N|QU[ẬA]N\s*4/i.test(loc)) {
    locationFactor = 1.25; locationTier = "center";
  } else if (/QU[ẬA]N\s*7|QU[ẬA]N\s*2|TH[ỦU]\s*[ĐD][ỨU]C|B[ÌI]NH\s*TH[ẠA]NH|T[ÂA]N\s*B[ÌI]NH|G[ÒO]\s*V[ẤA]P/i.test(loc)) {
    locationFactor = 1.0; locationTier = "suburban";
  } else if (/NH[ÀA]\s*B[ÈE]|B[ÌI]NH\s*T[ÂA]N|QU[ẬA]N\s*12|H[ÓO]C\s*M[ÔO]N|C[ỦU]\s*CHI|LONG\s*AN|B[ÌI]NH\s*D[ƯU][ƠO]NG|[ĐD][ỒÔ]NG\s*NAI/i.test(loc)) {
    locationFactor = 0.8; locationTier = "remote";
  }

  // Competition Multiplier — based on active ad count
  let competitionMultiplier = 1.0;
  let competitionLevel = "low";
  if (adCount > 150)      { competitionMultiplier = 1.5; competitionLevel = "high"; }
  else if (adCount > 50)  { competitionMultiplier = 1.2; competitionLevel = "medium"; }
  else                    { competitionMultiplier = 1.0; competitionLevel = "low"; }

  const cplAvg = Math.round((baseCpl * segmentFactor * locationFactor * competitionMultiplier) / 1000) * 1000;
  const cplMin = Math.round(cplAvg * 0.8 / 1000) * 1000;
  const cplMax = Math.round(cplAvg * 1.2 / 1000) * 1000;

  return { cplMin, cplMax, cplAvg, segment, locationFactor, locationTier, segmentFactor, competitionMultiplier, competitionLevel };
}

// Calculate heat index and opportunity score — calibrated for BĐS Pro 2026
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

  // Opportunity Score — Pro 2026 logic
  // High score (80-100): CPL < district avg AND low competition
  // Low score (<40): hot market AND CPL > 500K
  let opp = 50;
  const reasons = [];

  if (districtAvgCpl > 0 && cplAvg > 0) {
    const ratio = cplAvg / districtAvgCpl;
    if (ratio < 0.7) { opp += 30; reasons.push("CPL thấp hơn TB khu vực 30%+"); }
    else if (ratio < 0.9) { opp += 15; reasons.push("CPL thấp hơn TB khu vực"); }
    else if (ratio > 1.3) { opp -= 20; reasons.push("CPL cao hơn TB khu vực 30%+"); }
    else if (ratio > 1.1) { opp -= 10; reasons.push("CPL cao hơn TB khu vực"); }
  }

  // Competition impact
  if (adCount < 30) { opp += 20; reasons.push("Ít cạnh tranh (<30 QC)"); }
  else if (adCount < 50) { opp += 10; reasons.push("Cạnh tranh vừa phải (<50 QC)"); }
  else if (adCount > 300) { opp -= 25; reasons.push("Cạnh tranh rất cao (>300 QC)"); }
  else if (adCount > 150) { opp -= 15; reasons.push("Cạnh tranh cao (>150 QC)"); }

  // CPL threshold penalty
  if (cplAvg > 500000) { opp -= 15; reasons.push("CPL >500K — chi phí quá cao"); }
  else if (cplAvg > 0 && cplAvg < 200000) { opp += 10; reasons.push("CPL <200K — chi phí rất tốt"); }

  // Ad longevity bonus (experienced market)
  if (avgLongevity > 60) { opp += 5; reasons.push("Thị trường ổn định (QC chạy lâu)"); }

  const opportunityScore = Math.min(99, Math.max(5, Math.round(opp)));

  // Generate reasoning text
  let oppLabel;
  if (opportunityScore >= 80) oppLabel = "Cơ hội rất tốt";
  else if (opportunityScore >= 60) oppLabel = "Cơ hội khá";
  else if (opportunityScore >= 40) oppLabel = "Cơ hội trung bình";
  else oppLabel = "Cơ hội thấp";

  return {
    heatIndex: Math.min(99, Math.max(5, Math.round(heat))),
    heatLevel,
    opportunityScore,
    opportunityLabel: oppLabel,
    opportunityReasons: reasons,
    opportunitySummary: reasons.length > 0 ? `Lý do: ${reasons.slice(0, 2).join(" & ")}` : "",
  };
}

// Generate trend data (30 days) — dates use Vietnam timezone
function generateTrend30d(baseValue, volatility = 0.1, trend = "stable") {
  const data = [];
  let val = baseValue * (0.8 + Math.random() * 0.2);
  // Use Vietnam timezone for accurate date display
  const vnStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }); // YYYY-MM-DD
  const now = new Date(vnStr + "T12:00:00"); // noon to avoid DST edge cases
  for (let i = 0; i < 30; i++) {
    const change = val * volatility * (Math.random() - 0.45);
    const trendFactor = trend === "up" ? val * 0.008 : trend === "down" ? -val * 0.005 : 0;
    val = Math.max(baseValue * 0.3, val + change + trendFactor);
    const d = new Date(now);
    d.setDate(d.getDate() - (29 - i));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    data.push({ value: Math.round(val), date: `${yyyy}-${mm}-${dd}`, label: `${d.getDate()}/${d.getMonth() + 1}` });
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

    // Module 1 + Module 2: Run Ad Library scraping and Market Price scraping IN PARALLEL
    const [adData, priceData] = await Promise.all([
      scrapeAdLibrary(projectName, adAccounts),
      scrapeMarketPrice(projectName, location),
    ]);

    // Use scraped location if user didn't provide one
    const effectiveLocation = location || priceData.detectedLocation || "";

    // Module 3: CPL Calculation (preliminary — will be refined after AI)
    const districtInfo = getDistrictAvgCpl(effectiveLocation);
    const districtAvgCpl = districtInfo.cpl;
    const districtName = districtInfo.district;
    const cplResult = estimateCpl(adData.activeAds, priceData.avgPriceM2, effectiveLocation);

    // ═══════════════════════════════════════════════════════════════
    // Module 4: AI VERIFICATION — Perplexity searches internet FIRST
    // before we decide what CPL/prices to show
    // ═══════════════════════════════════════════════════════════════
    let aiResult = null;
    try {
      aiResult = PERPLEXITY_API_KEY
        ? await Promise.race([
            aiVerifyProject(projectName, priceData, adData, cplResult, districtAvgCpl),
            new Promise(r => setTimeout(() => r(null), 10000)) // 10s max for AI
          ])
        : null;
    } catch { aiResult = null; }

    // Determine verified project type
    let verifiedType = priceData.projectType; // crawler's guess as fallback
    let verifiedLocation = effectiveLocation;
    let aiInsight = "";
    let aiFilteredNote = "";
    let aiConfirmedProducts = null;
    const aiVerified = !!aiResult;

    if (aiResult) {
      // AI-confirmed project type overrides crawler
      if (aiResult.confirmedType && ["cao_tang", "thap_tang", "both"].includes(aiResult.confirmedType)) {
        verifiedType = aiResult.confirmedType;
      }
      // AI-detected location overrides crawler
      if (aiResult.location && aiResult.location.length > 3) {
        verifiedLocation = aiResult.location;
      }
      if (aiResult.marketInsight) aiInsight = aiResult.marketInsight;
      if (aiResult.filteredPriceNote) aiFilteredNote = aiResult.filteredPriceNote;
      if (aiResult.productTypes && Array.isArray(aiResult.productTypes) && aiResult.productTypes.length > 0) {
        aiConfirmedProducts = aiResult.productTypes;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // Module 5: BUILD FINAL DATA — only for verified categories
    // ═══════════════════════════════════════════════════════════════

    // Recalculate CPL with verified location
    const finalCplResult = (verifiedLocation !== effectiveLocation && verifiedLocation)
      ? estimateCpl(adData.activeAds, priceData.avgPriceM2, verifiedLocation)
      : cplResult;

    // District info with verified location
    const finalDistrictInfo = (verifiedLocation !== effectiveLocation) ? getDistrictAvgCpl(verifiedLocation) : districtInfo;
    const finalDistrictAvg = finalDistrictInfo.cpl;
    const finalDistrictName = finalDistrictInfo.district;

    // CPL by type — ONLY for verified categories
    const cplByType = [];
    const hasCaoTang = verifiedType !== "thap_tang";
    const hasThapTang = verifiedType !== "cao_tang";
    if (hasCaoTang) {
      cplByType.push({ type: "Căn hộ", category: "cao_tang", cplAvg: finalCplResult.cplAvg, cplMin: finalCplResult.cplMin, cplMax: finalCplResult.cplMax, note: "Dành cho Căn hộ" });
    }
    if (hasThapTang) {
      const ltCpl = Math.round(finalCplResult.cplAvg * 2.2 / 1000) * 1000;
      cplByType.push({ type: "Nhà phố / Biệt thự", category: "thap_tang", cplAvg: ltCpl, cplMin: Math.round(ltCpl * 0.8 / 1000) * 1000, cplMax: Math.round(ltCpl * 1.2 / 1000) * 1000, note: "Dành cho Villas" });
    }

    // Product types — ONLY for verified categories + AI-confirmed products
    let finalProductTypes = priceData.productTypes || [];
    // First: filter by verified type
    if (verifiedType === "cao_tang") finalProductTypes = finalProductTypes.filter(pt => pt.category === "cao_tang");
    else if (verifiedType === "thap_tang") finalProductTypes = finalProductTypes.filter(pt => pt.category === "thap_tang");
    // Second: filter by AI-confirmed product list
    if (aiConfirmedProducts) {
      finalProductTypes = finalProductTypes.filter(pt => aiConfirmedProducts.includes(pt.name));
    }

    // Prices — zero out categories that don't exist
    const finalHighRisePrice = hasCaoTang ? priceData.highRisePrice : 0;
    const finalLowRisePrice = hasThapTang ? priceData.lowRisePrice : 0;

    // Metrics
    const metrics = calcMarketMetrics(adData.activeAds, adData.avgLongevity, priceData.avgPriceM2, finalCplResult.cplAvg, finalDistrictAvg);

    // Primary CPL: use segment-appropriate value (thấp tầng CPL for villa projects)
    const primaryCpl = (verifiedType === "thap_tang" && cplByType.find(c => c.category === "thap_tang"))
      ? cplByType.find(c => c.category === "thap_tang").cplAvg
      : finalCplResult.cplAvg;

    // Benchmark comparisons — use primaryCpl so villa projects compare with villa CPL
    const regionBenchmark = compareWithRegion(primaryCpl, verifiedLocation);
    const centerBenchmark = compareWithCenter(primaryCpl);

    // Trends
    const adTrend = generateTrend30d(adData.activeAds, 0.08, adData.activeAds > 80 ? "up" : "stable");
    const cplTrend = generateTrend30d(finalCplResult.cplAvg / 1000, 0.06, finalCplResult.cplAvg < finalDistrictAvg ? "down" : "up");

    // Winning pages - real page data
    const winningPages = buildWinningPages(adData.pagesInfo || []);

    // Build activity feed
    const activityFeed = (adData.activityLog || []).map(msg => ({ time: new Date().toISOString(), msg }));
    if (aiVerified) {
      activityFeed.push({ time: new Date().toISOString(), msg: `🔍 Perplexity đang xác minh dự án "${projectName}" trên internet...` });
      activityFeed.push({ time: new Date().toISOString(), msg: `✅ Xác nhận: ${verifiedType === "cao_tang" ? "Chỉ bán Cao tầng (Căn hộ)" : verifiedType === "thap_tang" ? "Chỉ bán Thấp tầng (Villas)" : "Phức hợp (Cả Cao tầng + Thấp tầng)"}${aiResult.confirmedTypeReason ? " — " + aiResult.confirmedTypeReason : ""}` });
      if (aiFilteredNote) activityFeed.push({ time: new Date().toISOString(), msg: `⚠️ Lọc dữ liệu: ${aiFilteredNote}` });
    }
    activityFeed.push(
      { time: new Date().toISOString(), msg: `Giá sàn ${finalDistrictName}: ${hasCaoTang ? "cao tầng " + Math.round(finalHighRisePrice / 1e6) + "tr/m²" : ""}${hasCaoTang && hasThapTang ? ", " : ""}${hasThapTang ? "thấp tầng " + Math.round(finalLowRisePrice / 1e6) + "tr/m²" : ""}` },
      { time: new Date().toISOString(), msg: `CPL ${(finalCplResult.cplAvg / 1000).toFixed(0)}K — TB Quận: ${(finalDistrictAvg / 1000).toFixed(0)}K` },
    );
    if (priceData.leadPriceSources.length > 0) {
      priceData.leadPriceSources.forEach(s => {
        activityFeed.push({ time: new Date().toISOString(), msg: `${s.source}: ${s.count} tin đăng, giá TB ${(s.avgPrice / 1e9).toFixed(1)} tỷ` });
      });
    }

    res.json({
      project_name: projectName,
      location: verifiedLocation || priceData.detectedLocation || location,
      estimated_cpl_range: { min: finalCplResult.cplMin, max: finalCplResult.cplMax, avg: finalCplResult.cplAvg },
      district_avg_cpl: finalDistrictAvg,
      district_name: finalDistrictName,
      market_heat_level: metrics.heatLevel,
      heat_index: metrics.heatIndex,
      competitor_count: adData.totalAds,
      active_ad_count: adData.activeAds,
      unique_ad_count: adData.uniqueAds || adData.activeAds,
      total_ad_count: adData.totalAds,
      page_count: adData.pagesInfo?.length || 0,
      avg_ad_longevity_days: Math.round(adData.avgLongevity),
      avg_price_m2: priceData.avgPriceM2,
      high_rise_price: finalHighRisePrice,
      low_rise_price: finalLowRisePrice,
      high_rise_count: hasCaoTang ? priceData.highRiseCount : 0,
      low_rise_count: hasThapTang ? priceData.lowRiseCount : 0,
      new_listings_7d: priceData.newListings7d,
      lead_price_sources: priceData.leadPriceSources,
      opportunity_score: metrics.opportunityScore,
      segment: finalCplResult.segment,
      location_factor: finalCplResult.locationFactor,
      location_tier: finalCplResult.locationTier,
      segment_factor: finalCplResult.segmentFactor,
      competition_multiplier: finalCplResult.competitionMultiplier,
      competition_level: finalCplResult.competitionLevel,
      cpl_by_type: cplByType,
      product_types: finalProductTypes,
      opportunity_label: metrics.opportunityLabel,
      opportunity_reasons: metrics.opportunityReasons,
      opportunity_summary: metrics.opportunitySummary,
      ai_insight: aiInsight,
      ai_confirmed_type: aiVerified ? verifiedType : null,
      ai_confirmed_type_reason: aiResult?.confirmedTypeReason || "",
      ai_filtered_note: aiFilteredNote,
      ai_location: aiResult?.location || null,
      ai_verified: aiVerified,
      ai_enabled: !!PERPLEXITY_API_KEY,
      winning_pages: winningPages,
      ad_trend_30d: adTrend,
      cpl_trend_30d: cplTrend,
      top_ad_durations: adData.topAdDurations.slice(0, 10),
      activity_feed: activityFeed,
      search_term: adData.searchTerm || projectName,
      official_price: priceData.officialPrice || "",
      project_phase: priceData.projectPhase || "",
      project_type: verifiedType || priceData.projectType || "both",
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

// ============================================================
// ===== Điểm tin BĐS & Học tập (Perplexity AI) =====
// ============================================================

async function fetchDailyRealEstateNews() {
  const apiKey = await get(db, "SELECT value FROM settings WHERE key = 'perplexity_api_key'");
  if (!apiKey?.value) {
    console.log("[daily-news] No Perplexity API key configured, skipping");
    return { error: "Chưa cấu hình API key Perplexity. Vào tab Cài đặt để thêm." };
  }

  const today = new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const prompt = `Hôm nay là ${today}.

Bạn là cố vấn BĐS lão luyện 10+ năm. Đội Sale cần bản briefing thực chiến, KHÔNG cần bài báo đẹp.

NHIỆM VỤ: Quét tin BĐS Việt Nam 24h qua từ VnExpress, CafeF, Batdongsan.com.vn, Cafeland, Dân trí, Thanh Niên. Chọn 5-7 tin NÓNG NHẤT và phán xét từng tin.

KHÔNG LÀM:
- Giải thích khái niệm cơ bản (dân 10 năm kinh nghiệm không cần)
- Tóm tắt chung chung kiểu AI
- Dùng ngôn ngữ hoa mỹ, sáo rỗng
- Bịa số liệu hoặc link

CẦN LÀM:
- Mỗi tin phải có link báo gốc THẬT (URL đầy đủ), tên báo
- Phán xét thẳng: tin này "thơm" (có lợi) hay "độc" (bất lợi) cho dân sale BĐS, kèm lý do sắc gọn
- SỐ LIỆU: Mỗi tin PHẢI trích ít nhất 2-3 con số CỤ THỂ từ bài báo gốc. Ghi rõ nguồn và ngày. Ví dụ: "Lãi suất cho vay VCB giảm còn 6.8%/năm từ 01/04 (VnExpress, 31/03)". KHÔNG ghi kiểu mơ hồ đại khái.
- Phân tích MỖI tin: ảnh hưởng thế nào đến khách mua, nhà đầu tư, đội sale

VỀ DỰ BÁO NGÀY MAI:
- KHÔNG viết chung chung kiểu "thị trường tiếp tục ấm lên"
- PHẢI chỉ ra: SỰ KIỆN cụ thể nào sẽ xảy ra ngày mai/tuần tới (đấu giá, cuộc họp, chính sách có hiệu lực, dự án mở bán...)
- Nêu rõ: "Điều này sẽ khiến [segment khách hàng cụ thể] làm [hành động cụ thể]"
- Kịch bản marketing dựa trên sự kiện cụ thể đó, không chung chung

VỀ VIỆC CẦN LÀM:
- Mỗi mục phải có: AI làm + Làm GÌ + TẠI SAO phải làm hôm nay (không để ngày mai được)
- Ví dụ: "Sale khu vực Long An: Gọi lại 5 khách đã hỏi giá tuần trước, dẫn tin quy hoạch cao tốc mới được duyệt hôm nay để tạo urgency"
- KHÔNG viết chung chung kiểu "đăng bài lên Facebook", "cập nhật khách hàng"

Trả về ĐÚNG JSON thuần (KHÔNG markdown, KHÔNG \`\`\`json):
{
  "headline": "Briefing ngắn gọn cho ngày — kiểu giao ban",
  "market_pulse": "1-2 câu thẳng thắn: thị trường đang ở trạng thái gì, đà nào",
  "market_sentiment": 65,
  "news_items": [
    {
      "title": "Tiêu đề tin gốc hoặc tóm lược sát nghĩa",
      "source_name": "VnExpress",
      "source_url": "https://vnexpress.net/...",
      "verdict": "thơm",
      "verdict_reason": "1-2 câu: Tại sao thơm/độc cho sale BĐS",
      "insight": "Phân tích 3-5 câu: ảnh hưởng thực tế đến khách mua, nhà đầu tư, đội sale. Trích số liệu cụ thể từ bài báo.",
      "data_citations": [
        "Lãi suất cho vay mua nhà VCB giảm còn 6.8%/năm từ 01/04 (VnExpress, 31/03/2026)",
        "Giá căn hộ Quận 9 trung bình 45 triệu/m2, tăng 8% so với Q4/2025 (Batdongsan.com.vn, 30/03/2026)"
      ]
    }
  ],
  "tomorrow_forecast": "Dự báo 2-3 ngày tới dựa trên SỰ KIỆN cụ thể sắp xảy ra (đấu giá, chính sách có hiệu lực, dự án mở bán, cuộc họp NHNN...). Chỉ rõ segment khách nào sẽ bị tác động và sale cần chuẩn bị kịch bản gì.",
  "action_brief": [
    "[Ai làm]: [Làm gì cụ thể] — vì [lý do urgency từ tin hôm nay]"
  ],
  "sources": ["link1", "link2"]
}

CHÚ Ý:
- verdict CHỈ dùng: "thơm", "độc", hoặc "trung_tinh"
- market_sentiment: 0-100 (0=đóng băng, 50=chờ đợi, 100=sôi động)
- news_items: 5-7 tin, sắp xếp tin QUAN TRỌNG NHẤT lên đầu
- source_url: URL đầy đủ của bài báo gốc, PHẢI là link thật
- data_citations: MỖI con số phải ghi rõ: CON SỐ + ĐƠN VỊ + NGUỒN BÁO + NGÀY ĐĂNG. Nếu không tìm thấy số liệu cụ thể, để mảng rỗng
- tomorrow_forecast: PHẢI dựa trên sự kiện cụ thể sắp xảy ra, KHÔNG lặp lại nội dung đã phân tích ở trên
- action_brief: Mỗi mục phải khác nhau, gắn với TIN CỤ THỂ đã nêu, chỉ rõ AI làm + LÀM GÌ + VÌ SAO
- Chỉ trả JSON thuần, không kèm text nào khác`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.value}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "Bạn là cố vấn BĐS lão luyện với 10+ năm kinh nghiệm. Phong cách: thẳng thắn, thực chiến, không hoa mỹ. Bạn đang brief cho đội sale trước giờ làm việc. Trả lời bằng tiếng Việt. CHỈ trả về JSON thuần túy." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[daily-news] Perplexity API error:", response.status, errText);
      return { error: `Perplexity API lỗi (${response.status}): ${errText.slice(0, 200)}` };
    }

    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content || "";

    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    // sonar-reasoning may wrap output in <think>...</think> tags
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const data = JSON.parse(cleaned);

    await run(db, `INSERT INTO daily_news (title, news_summary, market_trend, marketing_lesson, vocabulary, source_links, raw_response, spotlight, market_indicators, expert_quotes, market_sentiment, market_cycle, sales_script, big_picture, editorial_comment, action_items, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`, [
      data.headline || `Briefing BĐS ${new Date().toLocaleDateString("vi-VN")}`,
      JSON.stringify(data.news_items || []),
      "",
      data.market_pulse || "",
      "null",
      JSON.stringify(data.sources || []),
      raw,
      "{}",
      "[]",
      "[]",
      typeof data.market_sentiment === "number" ? data.market_sentiment : 50,
      "",
      "",
      "",
      data.tomorrow_forecast || "",
      JSON.stringify(data.action_brief || []),
    ]);

    console.log("[daily-news] Saved daily news:", data.headline);
    return data;
  } catch (err) {
    console.error("[daily-news] Error fetching news:", err.message);
    return { error: `Lỗi: ${err.message}` };
  }
}

// GET /api/daily-news - List news (paginated)
app.get("/api/daily-news", requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const total = await get(db, "SELECT COUNT(*) as cnt FROM daily_news");
    const rows = await all(db, "SELECT * FROM daily_news ORDER BY created_at DESC LIMIT ? OFFSET ?", [limit, offset]);

    const parseJSON = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
    res.json({
      items: rows.map(r => ({
        ...r,
        news_summary: parseJSON(r.news_summary, []),
        vocabulary: parseJSON(r.vocabulary, r.vocabulary),
        source_links: parseJSON(r.source_links, []),
        spotlight: parseJSON(r.spotlight, {}),
        market_indicators: parseJSON(r.market_indicators, []),
        expert_quotes: parseJSON(r.expert_quotes, []),
        action_items: parseJSON(r.action_items, []),
      })),
      total: total.cnt,
      page,
      totalPages: Math.ceil(total.cnt / limit),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/daily-news/latest - Get latest news entry
app.get("/api/daily-news/latest", requireAuth, async (_req, res) => {
  try {
    const row = await get(db, "SELECT * FROM daily_news ORDER BY created_at DESC LIMIT 1");
    if (!row) return res.json({ item: null });
    const parseJSON = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
    res.json({
      item: {
        ...row,
        news_summary: parseJSON(row.news_summary, []),
        vocabulary: parseJSON(row.vocabulary, row.vocabulary),
        source_links: parseJSON(row.source_links, []),
        spotlight: parseJSON(row.spotlight, {}),
        market_indicators: parseJSON(row.market_indicators, []),
        expert_quotes: parseJSON(row.expert_quotes, []),
        action_items: parseJSON(row.action_items, []),
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/daily-news/fetch - Manually trigger news fetch (admin only)
app.post("/api/daily-news/fetch", requireAuth, requireAdminOnly, async (_req, res) => {
  try {
    const result = await fetchDailyRealEstateNews();
    if (result?.error) return res.status(400).json({ error: result.error });
    if (!result) return res.status(400).json({ error: "Không thể lấy tin. Kiểm tra API key Perplexity trong cài đặt." });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/daily-news/settings - Get Perplexity settings
app.get("/api/daily-news/settings", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const apiKey = await get(db, "SELECT value FROM settings WHERE key = 'perplexity_api_key'");
    const autoFetchTime = await get(db, "SELECT value FROM settings WHERE key = 'news_auto_fetch_time'");
    const openaiKey = await get(db, "SELECT value FROM settings WHERE key = 'openai_api_key'");
    res.json({
      hasApiKey: !!apiKey?.value,
      hasOpenaiKey: !!openaiKey?.value,
      autoFetchTime: autoFetchTime?.value || "07:00",
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/daily-news/settings - Save Perplexity settings
app.post("/api/daily-news/settings", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const { apiKey, autoFetchTime, openaiKey } = req.body;
    if (apiKey !== undefined) {
      await run(db, "INSERT INTO settings(key, value) VALUES('perplexity_api_key', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [apiKey]);
    }
    if (openaiKey !== undefined) {
      await run(db, "INSERT INTO settings(key, value) VALUES('openai_api_key', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [openaiKey]);
    }
    if (autoFetchTime !== undefined) {
      await run(db, "INSERT INTO settings(key, value) VALUES('news_auto_fetch_time', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [autoFetchTime]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/daily-news/:id - Delete a news entry (admin only)
app.delete("/api/daily-news/:id", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    await run(db, "DELETE FROM daily_news WHERE id = ?", [req.params.id]);
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
  const server = http.createServer(app);
  io = new SocketIOServer(server, { cors: ALLOWED_ORIGINS.length > 0 ? { origin: ALLOWED_ORIGINS, credentials: true } : { origin: "*" } });

  io.on("connection", (socket) => {
    console.log(`[socket.io] Client connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`[socket.io] Client disconnected: ${socket.id}`);
    });
  });

  server.listen(PORT, () => {
    console.log(`CRM API running at http://localhost:${PORT} [BUILD ${BUILD_VERSION}]`);

    // Auto-register Telegram webhooks on startup (ensures secret always matches after restart)
    setTimeout(async () => {
      try {
        const activeBots = await all(db, "SELECT id, name, token FROM telegram_bots WHERE is_active = 1");
        if (!activeBots || activeBots.length === 0) { console.log("[telegram-webhook/auto] No active bots, skipping"); return; }
        const baseUrl = process.env.BASE_URL || "https://crm-iqi.id.vn";
        for (const bot of activeBots) {
          const webhookUrl = `${baseUrl}/api/telegram-webhook/${bot.id}`;
          const r = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: webhookUrl, secret_token: TELEGRAM_WEBHOOK_SECRET }),
          });
          const data = await r.json();
          console.log(`[telegram-webhook/auto] Bot "${bot.name}" → ${webhookUrl}: ${data.ok ? "OK" : data.description}`);
        }
      } catch (e) {
        console.error("[telegram-webhook/auto] Error:", e.message);
      }
    }, 3000);
  });

  // Auto-sync Google Sheets every 3 minutes (configurable via SYNC_INTERVAL_MS env)
  const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL_MS) || 3 * 60 * 1000; // default 3 min
  let isSyncing = false;
  setInterval(async () => {
    if (isSyncing || !db) return;
    isSyncing = true;
    try {
      console.log("[auto-sync] Starting...");
      await syncAllProjects(db);
      console.log("[auto-sync] Done");
    } catch (e) {
      console.error("[auto-sync] Error:", e.message);
    } finally {
      isSyncing = false;
    }
  }, SYNC_INTERVAL);
  console.log(`[auto-sync] Enabled, interval=${SYNC_INTERVAL / 1000}s`);

  // Auto-backup every 8 hours (00:00, 08:00, 16:00)
  const BACKUP_INTERVAL = 8 * 60 * 60 * 1000;
  performBackup("startup"); // Backup on server start
  setInterval(() => performBackup("auto"), BACKUP_INTERVAL);
  console.log(`[auto-backup] Enabled, interval=8h, keep=${BACKUP_KEEP_DAYS} days`);

  // Auto-rotate leads every 30 minutes (checks 3-day inactivity)
  const AUTO_ROTATE_INTERVAL = 30 * 60 * 1000; // 30 min
  setInterval(async () => {
    if (!db) return;
    try {
      const rotated = await processAutoRotate(db);
      if (rotated > 0) console.log(`[auto-rotate] Processed: ${rotated} leads rotated`);
    } catch (e) {
      console.error("[auto-rotate] Error:", e.message);
    }
  }, AUTO_ROTATE_INTERVAL);
  console.log(`[auto-rotate] Enabled, interval=30min`);

  // Auto-fetch daily BĐS news (check every 10 min, run once per day at configured time)
  let lastNewsFetchDate = "";
  setInterval(async () => {
    if (!db) return;
    try {
      const setting = await get(db, "SELECT value FROM settings WHERE key = 'news_auto_fetch_time'");
      const targetTime = setting?.value || "07:00";
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      if (todayStr !== lastNewsFetchDate && currentTime >= targetTime) {
        // Check if already fetched today
        const existing = await get(db, "SELECT id FROM daily_news WHERE date(created_at) = date('now')");
        if (!existing) {
          console.log("[daily-news] Auto-fetching daily news...");
          await fetchDailyRealEstateNews();
          lastNewsFetchDate = todayStr;
        } else {
          lastNewsFetchDate = todayStr;
        }
      }
    } catch (e) {
      console.error("[daily-news] Auto-fetch error:", e.message);
    }
  }, 10 * 60 * 1000); // Check every 10 minutes
  console.log("[daily-news] Auto-fetch enabled, checks every 10 min");

  // Daily sale reminder + group report (check every 10 min, run once per day at configured time)
  let lastDailyReminderDate = "";
  setInterval(async () => {
    if (!db) return;
    try {
      const setting = await get(db, "SELECT value FROM settings WHERE key = 'daily_reminder_time'");
      const targetTime = setting?.value || "08:30";
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
      const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      if (todayStr !== lastDailyReminderDate && currentTime >= targetTime) {
        lastDailyReminderDate = todayStr;
        console.log("[daily-reminder] Running daily sale reminder & group report...");
        await processDailySaleReminder(db, now);
      }
    } catch (e) {
      console.error("[daily-reminder] Error:", e.message);
    }
  }, 10 * 60 * 1000);
  console.log("[daily-reminder] Enabled, checks every 10 min");
}

/* ===== Daily Sale Reminder + Group Report ===== */
async function processDailySaleReminder(db, now) {
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();
  const nowStr = now.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  // Get all sales
  const sales = await all(db, "SELECT id, display_name, telegram_id FROM users WHERE role = 'sale'");
  // Get all projects
  const projects = await all(db, "SELECT id, name FROM projects WHERE is_legacy = 0 OR is_legacy IS NULL");
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));

  // Get all active bots
  const bots = await all(db, "SELECT id, name, token, project_id, group_chat_id FROM telegram_bots WHERE is_active = 1");

  // Collect report data per project
  const projectReports = {}; // projectId -> { projectName, sales: { saleName: { total, pending, updated } } }

  for (const sale of sales) {
    const displayName = sale.display_name;

    // Get all active leads for this sale
    const leads = await all(db,
      `SELECT l.id, l.name, l.phone, l.status, l.project_id FROM leads l
       WHERE (l.sale_name = ? OR l.sale_name = ?)
         AND l.status NOT IN ('booked','booking_other','closed','not_interested','spam','wrong_number','blocked','lost','cancelled_deposit')
       ORDER BY l.id`,
      [displayName, displayName.toLowerCase()]
    );

    let pendingLeads = [];
    for (const lead of leads) {
      // Track per project report
      const pid = lead.project_id;
      if (!projectReports[pid]) projectReports[pid] = { projectName: projectMap[pid] || "-", sales: {} };
      if (!projectReports[pid].sales[displayName]) projectReports[pid].sales[displayName] = { total: 0, pending: 0, updated: 0 };
      projectReports[pid].sales[displayName].total++;

      const lastUpdate = await get(db,
        `SELECT contact_date, status, feedback FROM lead_history
         WHERE lead_id = ? AND sale_name = ? AND action != 'Chia lead'
         ORDER BY seq DESC LIMIT 1`,
        [lead.id, displayName]
      );

      let daysSince = null;
      if (!lastUpdate) {
        const chiaEntry = await get(db,
          `SELECT contact_date FROM lead_history WHERE lead_id = ? AND sale_name = ? AND action = 'Chia lead' ORDER BY seq DESC LIMIT 1`,
          [lead.id, displayName]
        );
        if (chiaEntry) {
          const d = parseLeadDate(chiaEntry.contact_date);
          if (d) daysSince = Math.floor((nowMs - d.getTime()) / (24*60*60*1000));
        }
      } else {
        const d = parseLeadDate(lastUpdate.contact_date);
        if (d) daysSince = Math.floor((nowMs - d.getTime()) / (24*60*60*1000));
      }

      if (daysSince !== null && daysSince >= 2) {
        pendingLeads.push({ name: lead.name, phone: lead.phone, days: daysSince, project: projectMap[lead.project_id] || "-" });
        projectReports[pid].sales[displayName].pending++;
      } else {
        projectReports[pid].sales[displayName].updated++;
      }
    }

    // Send individual Telegram reminder to this sale
    if (!sale.telegram_id) continue;

    // Find a bot that covers this sale's projects
    let botToken = null;
    for (const bot of bots) {
      if (bot.token) { botToken = bot.token; break; }
    }
    if (!botToken) continue;

    let msg;
    if (pendingLeads.length > 0) {
      const leadLines = pendingLeads.slice(0, 15).map((l, i) =>
        `${i+1}. 👤 *${l.name}* (${l.project}) — ${l.days} ngày chưa cập nhật`
      ).join("\n");
      msg = [
        `⏰ *NHẮC NHỞ CẬP NHẬT KHÁCH HÀNG*`,
        `Xin chào *${displayName}*! 👋`,
        ``,
        `📋 Bạn có *${pendingLeads.length} khách hàng* chưa cập nhật trạng thái trên *2 ngày*:`,
        ``,
        leadLines,
        pendingLeads.length > 15 ? `\n... và ${pendingLeads.length - 15} khách khác` : "",
        ``,
        `⚡ Vui lòng vào CRM cập nhật tình trạng khách ngay nhé!`,
        `🔗 https://crm-iqi.id.vn`,
      ].filter(Boolean).join("\n");
    } else {
      msg = [
        `✅ *BÁO CÁO HÀNG NGÀY*`,
        `Xin chào *${displayName}*! 👋`,
        ``,
        `🎉 Hôm nay bạn không có khách hàng nào cần cập nhật tình trạng.`,
        `Tất cả khách đã được cập nhật đầy đủ! 👍`,
      ].join("\n");
    }

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: sale.telegram_id, text: msg, parse_mode: "Markdown" }),
      });
      console.log(`[daily-reminder] Sent to ${displayName} (${pendingLeads.length} pending)`);
    } catch (e) {
      console.error(`[daily-reminder] Failed to send to ${displayName}:`, e.message);
    }
  }

  // Send group report to each bot's group_chat_id
  for (const bot of bots) {
    if (!bot.token || !bot.group_chat_id) continue;

    // Find which projects this bot covers
    let botProjectIds = [];
    if (bot.project_id) {
      try {
        const parsed = JSON.parse(bot.project_id);
        botProjectIds = Array.isArray(parsed) ? parsed : [Number(parsed)].filter(Boolean);
      } catch { botProjectIds = [Number(bot.project_id)].filter(Boolean); }
    }

    // Build report for this bot's projects
    const relevantProjects = botProjectIds.length > 0
      ? botProjectIds.filter(pid => projectReports[pid])
      : Object.keys(projectReports).map(Number);

    if (relevantProjects.length === 0) continue;

    let totalLeads = 0, totalPending = 0, totalUpdated = 0;
    const saleLines = [];

    for (const pid of relevantProjects) {
      const pr = projectReports[pid];
      if (!pr) continue;
      saleLines.push(`\n📋 *${pr.projectName}*:`);
      for (const [saleName, stats] of Object.entries(pr.sales)) {
        totalLeads += stats.total;
        totalPending += stats.pending;
        totalUpdated += stats.updated;
        const statusIcon = stats.pending > 0 ? "⚠️" : "✅";
        saleLines.push(`  ${statusIcon} ${saleName}: ${stats.total} lead (✅ ${stats.updated} đã CN | ⏳ ${stats.pending} chưa CN)`);
      }
    }

    const groupMsg = [
      `📊 *BÁO CÁO TỔNG HỢP HÀNG NGÀY*`,
      `🗓 ${nowStr}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📈 Tổng lead đang xử lý: *${totalLeads}*`,
      `✅ Đã cập nhật: *${totalUpdated}*`,
      `⏳ Chưa cập nhật (>2 ngày): *${totalPending}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👥 *CHI TIẾT THEO SALE:*`,
      ...saleLines,
      ``,
      totalPending > 0
        ? `⚡ Có *${totalPending}* khách cần được cập nhật tình trạng!`
        : `🎉 Tất cả sale đã cập nhật đầy đủ!`,
    ].join("\n");

    try {
      await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: bot.group_chat_id, text: groupMsg, parse_mode: "Markdown" }),
      });
      console.log(`[daily-reminder] Group report sent to chat ${bot.group_chat_id} (bot: ${bot.name})`);
    } catch (e) {
      console.error(`[daily-reminder] Group report failed for ${bot.name}:`, e.message);
    }
  }
}

export default app;
