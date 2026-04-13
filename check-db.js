import { createClient } from "@libsql/client";
const db = createClient({ url: "file:server/data/crm.db" });
(async () => {
  try {
    const r = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='personal_leads'");
    console.log("Table exists:", r.rows.length > 0);
    if (r.rows.length > 0) {
      const r2 = await db.execute("SELECT COUNT(*) as cnt FROM personal_leads");
      console.log("Row count:", r2.rows[0].cnt);
    }
    const v = await db.execute("SELECT value FROM settings WHERE key='db_version'");
    console.log("DB version:", v.rows[0]?.value);
  } catch(e) { console.error(e.message); }
})();
