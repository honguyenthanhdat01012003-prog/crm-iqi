import { createClient } from "@libsql/client";

// ---- CẤU HÌNH ----
// Đọc từ local DB
const localDb = createClient({ url: "file:server/data/crm.db" });

// Ghi lên Turso - lấy từ Vercel env vars
const TURSO_URL = process.env.TURSO_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("❌ Thiếu TURSO_URL hoặc TURSO_AUTH_TOKEN");
  console.error("Chạy: $env:TURSO_URL='libsql://...'; $env:TURSO_AUTH_TOKEN='...'; node migrate.js");
  process.exit(1);
}

const tursoDb = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

async function migrate() {
  console.log("📦 Đọc dữ liệu từ local DB...");

  // Read local projects
  const projects = (await localDb.execute("SELECT * FROM projects ORDER BY id")).rows;
  console.log(`  → ${projects.length} dự án`);

  // Read local users
  const users = (await localDb.execute("SELECT * FROM users ORDER BY id")).rows;
  console.log(`  → ${users.length} users`);

  console.log("\n🚀 Ghi lên Turso cloud...");

  // Insert projects (skip id=1 default that initDb creates, update it instead)
  for (const p of projects) {
    const existing = (await tursoDb.execute({ sql: "SELECT id FROM projects WHERE id = ?", args: [p.id] })).rows;
    if (existing.length) {
      await tursoDb.execute({
        sql: "UPDATE projects SET name = ?, lead_url = ?, cost_url = ?, cost_data = ? WHERE id = ?",
        args: [p.name, p.lead_url, p.cost_url, p.cost_data || "{}", p.id],
      });
      console.log(`  ✅ Updated project #${p.id}: ${p.name}`);
    } else {
      await tursoDb.execute({
        sql: "INSERT INTO projects(id, name, lead_url, cost_url, cost_data) VALUES(?, ?, ?, ?, ?)",
        args: [p.id, p.name, p.lead_url, p.cost_url, p.cost_data || "{}"],
      });
      console.log(`  ✅ Inserted project #${p.id}: ${p.name}`);
    }
  }

  // Insert users (skip if already exists)
  for (const u of users) {
    const existing = (await tursoDb.execute({ sql: "SELECT id FROM users WHERE username = ?", args: [u.username] })).rows;
    if (existing.length) {
      await tursoDb.execute({
        sql: "UPDATE users SET password_hash = ?, salt = ?, role = ?, display_name = ? WHERE username = ?",
        args: [u.password_hash, u.salt, u.role, u.display_name, u.username],
      });
      console.log(`  ✅ Updated user: ${u.username} (${u.role})`);
    } else {
      await tursoDb.execute({
        sql: "INSERT INTO users(username, password_hash, salt, role, display_name) VALUES(?, ?, ?, ?, ?)",
        args: [u.username, u.password_hash, u.salt, u.role, u.display_name],
      });
      console.log(`  ✅ Inserted user: ${u.username} (${u.role})`);
    }
  }

  console.log("\n✨ Migration hoàn tất! Bây giờ cần Sync data từ Google Sheets...");
  console.log("→ Truy cập CRM trên Vercel → đăng nhập admin → nhấn nút 🔄 Sync");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
