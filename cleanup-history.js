import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "server", "data", "crm.db");

const db = createClient({ url: `file:${DB_PATH}` });

const MAX_HISTORY_PER_LEAD = 30;

async function cleanup() {
  console.log("🧹 Cleanup lead_history — giữ lại", MAX_HISTORY_PER_LEAD, "entries gần nhất/lead");

  const before = (await db.execute("SELECT COUNT(*) as c FROM lead_history")).rows[0].c;
  console.log(`   Trước: ${before} rows`);

  // Lấy danh sách lead có quá nhiều history
  const bloated = (await db.execute(`
    SELECT lead_id, COUNT(*) as cnt FROM lead_history
    GROUP BY lead_id HAVING cnt > ${MAX_HISTORY_PER_LEAD}
  `)).rows;

  console.log(`   ${bloated.length} leads có > ${MAX_HISTORY_PER_LEAD} history entries`);

  let totalDeleted = 0;
  for (let i = 0; i < bloated.length; i++) {
    const { lead_id, cnt } = bloated[i];
    // Lấy ID của các entries cần xóa (giữ lại 30 entries mới nhất theo seq)
    const toDelete = (await db.execute({
      sql: `SELECT id FROM lead_history WHERE lead_id = ? ORDER BY seq DESC LIMIT -1 OFFSET ?`,
      args: [lead_id, MAX_HISTORY_PER_LEAD],
    })).rows;

    if (toDelete.length > 0) {
      // Xóa theo batch 500
      for (let j = 0; j < toDelete.length; j += 500) {
        const batch = toDelete.slice(j, j + 500);
        const ids = batch.map((r) => r.id).join(",");
        await db.execute(`DELETE FROM lead_history WHERE id IN (${ids})`);
      }
      totalDeleted += toDelete.length;
    }

    if ((i + 1) % 50 === 0 || i === bloated.length - 1) {
      console.log(`   Tiến độ: ${i + 1}/${bloated.length} leads, đã xóa ${totalDeleted} rows`);
    }
  }

  const after = (await db.execute("SELECT COUNT(*) as c FROM lead_history")).rows[0].c;
  console.log(`\n✅ Hoàn tất! ${before} → ${after} rows (xóa ${totalDeleted} rows thừa)`);
  console.log("   Bây giờ hãy Restart server trong Node Project");
}

cleanup().catch((err) => {
  console.error("❌ Lỗi:", err.message);
  process.exit(1);
});
