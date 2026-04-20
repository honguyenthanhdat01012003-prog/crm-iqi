const { createClient } = require("@libsql/client");
const db = createClient({ url: "file:data/crm.db" });

(async () => {
  // Check per-phone history count (to see if 20-limit is the issue)
  const phoneCounts = await db.execute({
    sql: `SELECT l.phone, count(*) as total,
            sum(CASE WHEN lh.action = 'Chia lead' THEN 1 ELSE 0 END) as chia_count,
            sum(CASE WHEN lh.action != 'Chia lead' THEN 1 ELSE 0 END) as other_count
          FROM lead_history lh JOIN leads l ON lh.lead_id = l.id 
          WHERE l.project_id = 2
          GROUP BY l.phone
          ORDER BY total DESC
          LIMIT 15`,
    args: []
  });
  console.log("Top phones by history count:");
  phoneCounts.rows.forEach(r => console.log(`  ${r.phone}: total=${r.total} (Chia lead=${r.chia_count}, other=${r.other_count})`));

  // Check a specific phone - see what entries survive after sync
  if (phoneCounts.rows.length > 0) {
    const topPhone = phoneCounts.rows[0].phone;
    const entries = await db.execute({
      sql: `SELECT lh.action, lh.sale_name, lh.status, lh.source, lh.seq, lh.contact_date
            FROM lead_history lh JOIN leads l ON lh.lead_id = l.id
            WHERE l.phone = ? AND l.project_id = 2
            ORDER BY lh.seq DESC
            LIMIT 30`,
      args: [topPhone]
    });
    console.log(`\nSample history for phone ${topPhone}:`);
    entries.rows.forEach(r => console.log(`  seq=${r.seq} ${r.action} sale="${r.sale_name}" status="${r.status}" source=${r.source} date="${r.contact_date}"`));
  }

  process.exit(0);
})();
