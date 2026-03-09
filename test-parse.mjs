function foldText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/_/g, ' ').toLowerCase();
}

function findVal(obj, candidates) {
  const keys = Object.keys(obj);
  const normalized = keys.map((key) => ({ raw: key, norm: foldText(key) }));
  for (const c of candidates) {
    const needle = foldText(c);
    const found = normalized.find((entry) => entry.norm === needle || entry.norm.includes(needle));
    if (found) return obj[found.raw] ?? '';
  }
  return '';
}

const splitRow = (line) => {
  const cols = []; let cur = ''; let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cols.push(cur.trim()); return cols;
};

// Salacia
const url5 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQCjdNP_ohsmEFlmA0g8jd3b62JMSXZIAuVIwsEMr4qLhJPpzsV6BqKZvONIMZNXH2_0v5Di_3h4XSR/pub?gid=0&single=true&output=csv';
const text5 = await (await fetch(url5)).text();
const lines5 = text5.trim().split(/\r?\n/).filter(l => l.replace(/,/g, '').trim());

const rawHeaders = splitRow(lines5[0]).map(h => h.trim());
const headers = rawHeaders.map(h => h.toLowerCase());

console.log('=== SALACIA VILLAS ===');
console.log('Headers count:', headers.length);
for (let i = 0; i < headers.length; i++) {
  console.log(`  [${i}] raw: "${rawHeaders[i]}" → folded: "${foldText(rawHeaders[i])}"`);
}

// Find lead_status column
const lsIdx = rawHeaders.findIndex(h => foldText(h).includes("lead status"));
console.log('\nlead_status index:', lsIdx, '→ Column R (index 17) would be:', lsIdx + 1);

// Parse data rows
for (let ri = 1; ri < lines5.length; ri++) {
  const cols = splitRow(lines5[ri]);
  const row = {};
  headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim(); });

  const name = findVal(row, ["full name", "full_name", "ho ten", "ten", "name", "ten day du"]);
  const phone = findVal(row, ["phone", "so dien thoai", "sdt", "dien thoai", "phone number", "mobile", "di dong", "so dt"]);
  const colRDate = (lsIdx >= 0 && cols[lsIdx + 1]) ? cols[lsIdx + 1].trim() : '';
  const createdAt = colRDate || findVal(row, ["thoi gian hien tai", "thoi gian", "ngay nhan lead", "created_time", "ngay tao", "date"]);

  console.log(`\nRow ${ri}: name="${name}" phone="${phone}" colRDate="${colRDate}" createdAt="${createdAt}"`);
  console.log('  raw col[14]:', cols[14], '  raw col[17]:', cols[17]);
}
