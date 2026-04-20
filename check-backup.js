const { createClient } = require("@libsql/client");
const db = createClient({ url: "file:data/crm.db" });

(async () => {
  // Check backup availability
  const backups = await db.execute({
    sql: "SELECT key, length(value) as len FROM settings WHERE key LIKE 'backup_project_%'",
    args: []
  });
  console.log("Backups:", JSON.stringify(backups.rows));

  // Check project 2 (SUN VUNG TAU) backup details
  const backup = await db.execute({
    sql: "SELECT value FROM settings WHERE key = 'backup_project_2'",
    args: []
  });
  if (backup.rows[0]) {
    const data = JSON.parse(backup.rows[0].value);
    console.log(`\nBackup ts: ${data.ts}`);
    console.log(`Leads with sale: ${data.leads.length}`);
    console.log(`History entries: ${data.history.length}`);
    // Sample statuses
    const statuses = {};
    data.leads.forEach(l => { statuses[l.status] = (statuses[l.status] || 0) + 1; });
    console.log("Status distribution:", JSON.stringify(statuses));
    // Check if "Cập nhật" entries exist
    const updateEntries = data.history.filter(h => h.action === "Cập nhật");
    console.log(`"Cập nhật" history entries: ${updateEntries.length}`);
    // Sample
    if (updateEntries.length > 0) {
      console.log("Sample:", JSON.stringify(updateEntries.slice(0, 3)));
    }
  }

  // Also check current lead statuses for project 2
  const current = await db.execute({
    sql: "SELECT status, count(*) as cnt FROM leads WHERE project_id = 2 GROUP BY status",
    args: []
  });
  console.log("\nCurrent status distribution:", JSON.stringify(current.rows));

  process.exit(0);
})();
