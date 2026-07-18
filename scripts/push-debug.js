/**
 * Chẩn đoán push: node scripts/push-debug.js "Đạt test"
 * In ra: tài khoản trùng tên, token FCM của từng tài khoản, lỗi gửi gần nhất.
 */
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "server", "data", "crm.db");
const db = createClient({ url: `file:${dbPath}` });

const name = process.argv[2] || "";

console.log("=== 1. Tài khoản khớp tên ===");
if (name) {
  const users = await db.execute({
    sql: "SELECT id, username, display_name, role FROM users WHERE LOWER(TRIM(display_name)) = LOWER(TRIM(?))",
    args: [name],
  });
  if (!users.rows.length) {
    console.log(`KHÔNG có user nào display_name = "${name}" — đây là lý do push không gửi!`);
    const similar = await db.execute({
      sql: "SELECT id, username, display_name, role FROM users WHERE display_name LIKE ? LIMIT 10",
      args: [`%${name.split(" ")[0]}%`],
    });
    console.log("Tên gần giống:", JSON.stringify(similar.rows, null, 2));
  } else {
    console.log(JSON.stringify(users.rows, null, 2));
    if (users.rows.length > 1) console.log(`⚠️ CÓ ${users.rows.length} TÀI KHOẢN TRÙNG TÊN!`);
  }
} else {
  console.log("(không truyền tên — bỏ qua)");
}

console.log("\n=== 2. Toàn bộ FCM token đang đăng ký ===");
const tokens = await db.execute(`
  SELECT t.id, t.user_id, u.username, u.display_name, t.platform, t.device_id,
         substr(t.token, 1, 16) AS token_prefix, t.last_error, t.updated_at
  FROM native_push_tokens t
  LEFT JOIN users u ON u.id = t.user_id
  ORDER BY t.updated_at DESC
`);
if (!tokens.rows.length) {
  console.log("KHÔNG có token nào trong bảng native_push_tokens — app chưa đăng ký được!");
} else {
  console.log(JSON.stringify(tokens.rows, null, 2));
}

console.log("\n=== 3. Web push subscriptions ===");
const subs = await db.execute(`
  SELECT s.id, s.user_id, u.display_name, substr(s.last_error, 1, 80) AS last_error, s.updated_at
  FROM push_subscriptions s
  LEFT JOIN users u ON u.id = s.user_id
  ORDER BY s.updated_at DESC LIMIT 10
`);
console.log(JSON.stringify(subs.rows, null, 2));
