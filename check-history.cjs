const { createClient } = require("@libsql/client");
const db = createClient({ url: "file:data/crm.db" });

(async () => {
  // Current history entries for project 2
  const hist = await db.execute({
    sql: `SELECT lh.source, lh.action, count(*) as cnt 
          FROM lead_history lh JOIN leads l ON lh.lead_id = l.id 
          WHERE l.project_id = 2 
          GROUP BY lh.source, lh.action 
          ORDER BY cnt DESC`,
    args: []
  });
  console.log("Project 2 history by source+action:");
  hist.rows.forEach(r => console.log(`  ${r.source} | ${r.action} | ${r.cnt}`));

  // Check total leads  
  const totalLeads = await db.execute({ sql: "SELECT count(*) as cnt FROM leads WHERE project_id = 2", args: [] });
  console.log(`\nTotal leads project 2: ${totalLeads.rows[0].cnt}`);

  // Check how many leads have "Cập nhật" entries from sale  
  const withFeedback = await db.execute({
    sql: `SELECT count(DISTINCT lh.lead_id) as cnt FROM lead_history lh JOIN leads l ON lh.lead_id = l.id 
          WHERE l.project_id = 2 AND lh.action = 'Cập nhật' AND lh.source IN ('sale','admin','crm')`,
    args: []
  });
  console.log(`Leads with sale feedback in history: ${withFeedback.rows[0].cnt}`);

  // Sample: leads that are "new" but have "Cập nhật" history  
  const newWithHist = await db.execute({
    sql: `SELECT l.id, l.name, l.phone, l.sale_name, l.status, lh.action, lh.status as hist_status, lh.sale_name as hist_sale, lh.source, lh.contact_date
          FROM leads l JOIN lead_history lh ON lh.lead_id = l.id 
          WHERE l.project_id = 2 AND l.status = 'new' AND lh.action = 'Cập nhật' AND lh.source IN ('sale','admin','crm')
          LIMIT 10`,
    args: []
  });
  console.log(`\nSample "new" leads WITH feedback history:`);
  newWithHist.rows.forEach(r => console.log(`  lead#${r.id} "${r.name}" sale="${r.sale_name}" status="${r.status}" hist: "${r.hist_status}" by ${r.hist_sale} (${r.source}) at ${r.contact_date}`));

  // Check if leads with non-new status lost their feedback history
  const nonNewNoHist = await db.execute({
    sql: `SELECT l.id, l.name, l.sale_name, l.status FROM leads l 
          WHERE l.project_id = 2 AND l.status != 'new' 
          AND NOT EXISTS (SELECT 1 FROM lead_history lh WHERE lh.lead_id = l.id AND lh.action = 'Cập nhật')
          LIMIT 10`,
    args: []
  });
  console.log(`\nSample non-new leads WITHOUT any "Cập nhật" history:`);
  nonNewNoHist.rows.forEach(r => console.log(`  lead#${r.id} "${r.name}" sale="${r.sale_name}" status="${r.status}"`));

  process.exit(0);
})();
