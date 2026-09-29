import assert from "assert";
import {
  pickPriorityExportStatus,
  hadPositiveFeedback,
  buildSaleFeedbackSummary,
  normalizeExportFlow,
  GOOD_EXPORT_DEFAULT_STATUSES,
} from "./leadExport.js";

const normalizeStatus = (s) => String(s || "").trim().toLowerCase();
const isFeedback = (h) => !!h && h.action !== "Chia lead" && !!h.status;
const statusLabel = (s) => ({ interested: "Quan tâm", appointment: "Hẹn gặp", not_interested: "Không quan tâm" }[s] || s);
const deps = { normalizeStatus, isFeedback };

// Sale A Quan tâm, sale B Hẹn gặp, sale C Không QT → lấy Hẹn gặp (cao nhất) của sale B
const history = [
  { seq: 1, sale_name: "A", status: "interested", contact_date: "01/09/2026 10:00:00", feedback: "ok" },
  { seq: 2, sale_name: "A", action: "Chia lead", status: "" },
  { seq: 3, sale_name: "B", status: "appointment", contact_date: "03/09/2026 09:00:00", feedback: "hẹn T7" },
  { seq: 4, sale_name: "C", status: "not_interested", contact_date: "05/09/2026 09:00:00" },
];
const lead = { status: "not_interested", sale_name: "C" };

const best = pickPriorityExportStatus(lead, history, GOOD_EXPORT_DEFAULT_STATUSES, deps);
assert.strictEqual(best.status, "appointment");
assert.strictEqual(best.saleName, "B");
assert.strictEqual(best.date, "03/09/2026 09:00:00");

// Chỉ chọn Quan tâm → vẫn xuất khách này với Quan tâm của sale A
const onlyInterested = pickPriorityExportStatus(lead, history, ["interested"], deps);
assert.strictEqual(onlyInterested.status, "interested");
assert.strictEqual(onlyInterested.saleName, "A");

// Không có trạng thái nào được chọn → không xuất
assert.strictEqual(pickPriorityExportStatus(lead, history, ["booked", "closed"], deps), null);

// Trạng thái hiện tại tính luôn khi không có trong lịch sử
const bookedNow = pickPriorityExportStatus({ status: "booked", sale_name: "D" }, [], GOOD_EXPORT_DEFAULT_STATUSES, deps);
assert.strictEqual(bookedNow.status, "booked");
assert.strictEqual(bookedNow.saleName, "D");

// Cùng trạng thái 2 lần → lấy lần sau cùng
const twice = pickPriorityExportStatus({ status: "new" }, [
  { seq: 1, sale_name: "A", status: "interested", contact_date: "d1" },
  { seq: 2, sale_name: "B", status: "interested", contact_date: "d2" },
], ["interested"], deps);
assert.strictEqual(twice.saleName, "B");

// Luồng rác: khách từng được Quan tâm thì loại
assert.strictEqual(hadPositiveFeedback(lead, history, deps), true);
assert.strictEqual(hadPositiveFeedback(lead, [{ sale_name: "C", status: "not_interested" }], deps), false);
// Admin chủ động chọn Quan tâm trong luồng rác thì không loại vì trạng thái đó
assert.strictEqual(
  hadPositiveFeedback(lead, [{ sale_name: "A", status: "interested" }], { ...deps, ignore: ["interested"] }),
  false
);

const summary = buildSaleFeedbackSummary(history, { ...deps, statusLabel });
assert.strictEqual(
  summary,
  "A: Quan tâm — ok (01/09/2026 10:00:00) | B: Hẹn gặp — hẹn T7 (03/09/2026 09:00:00) | C: Không quan tâm (05/09/2026 09:00:00)"
);

assert.strictEqual(normalizeExportFlow("good"), "good");
assert.strictEqual(normalizeExportFlow(""), "junk");

console.log("leadExport.test.js: ok");
