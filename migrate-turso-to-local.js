import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- CẤU HÌNH ----
const DB_DIR = path.join(__dirname, "server", "data");
const DB_PATH = path.join(DB_DIR, "crm.db");

// Đọc từ Turso cloud
const TURSO_URL = process.env.TURSO_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("❌ Thiếu TURSO_URL hoặc TURSO_AUTH_TOKEN");
  console.error("Chạy:");
  console.error('  $env:TURSO_URL="libsql://..."; $env:TURSO_AUTH_TOKEN="..."; node migrate-turso-to-local.js');
  process.exit(1);
}

const tursoDb = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

// Ghi về local SQLite
fs.mkdirSync(DB_DIR, { recursive: true });
const localDb = createClient({ url: `file:${DB_PATH}` });

// Danh sách tất cả các bảng cần migrate
const TABLES = [
  "settings",
  "projects",
  "users",
  "user_projects",
  "campaigns",
  "leads",
  "lead_history",
  "lead_status_log",
  "lead_schedules",
  "telegram_bots",
  "telegram_pending",
  "telegram_chat_users",
  "fb_pages",
  "fb_posts",
  "fb_ad_accounts",
  "sheet_configs",
  "chat_messages",
  "market_intel_cache",
  "marketing_guidelines",
];

async function migrate() {
  console.log("📦 Migrate dữ liệu từ Turso cloud → SQLite local");
  console.log(`   Turso: ${TURSO_URL}`);
  console.log(`   Local: ${DB_PATH}\n`);

  // Bước 1: Khởi tạo schema trên local (chạy server 1 lần sẽ tạo schema)
  // Nhưng ở đây ta tự tạo schema từ Turso
  console.log("🔧 Đọc schema từ Turso...");
  const schemaRows = (
    await tursoDb.execute(
      "SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name"
    )
  ).rows;

  for (const row of schemaRows) {
    const ddl = row.sql.replace(/CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS ");
    try {
      await localDb.execute(ddl);
    } catch (e) {
      console.warn(`  ⚠️ Schema skip: ${e.message.substring(0, 80)}`);
    }
  }
  console.log(`  ✅ ${schemaRows.length} bảng schema đã tạo\n`);

  // Bước 2: Migrate dữ liệu từng bảng
  let totalRows = 0;
  for (const table of TABLES) {
    try {
      const rows = (await tursoDb.execute(`SELECT * FROM ${table}`)).rows;
      if (rows.length === 0) {
        console.log(`  ⏭️  ${table}: 0 rows (bỏ qua)`);
        continue;
      }

      // Xóa dữ liệu cũ trong local (nếu có)
      await localDb.execute(`DELETE FROM ${table}`);

      // Insert từng batch 50 rows
      const columns = Object.keys(rows[0]);
      const batchSize = 50;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const stmts = batch.map((row) => ({
          sql: `INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`,
          args: columns.map((c) => row[c] ?? null),
        }));
        await localDb.batch(stmts, "write");
        inserted += batch.length;
      }

      console.log(`  ✅ ${table}: ${inserted} rows`);
      totalRows += inserted;
    } catch (e) {
      console.error(`  ❌ ${table}: ${e.message}`);
    }
  }

  console.log(`\n✨ Migration hoàn tất! Tổng: ${totalRows} rows đã chuyển về local.`);
  console.log("\n📋 Bước tiếp theo:");
  console.log("   1. Xóa/comment TURSO_URL và TURSO_AUTH_TOKEN trong file .env");
  console.log("   2. Restart server → app sẽ tự dùng SQLite local");
  console.log("   3. Kiểm tra /api/health → dbType phải là 'sqlite-local'");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
