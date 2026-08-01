import assert from "assert";
import {
  slimCostData,
  slimScheduleForList,
  slimSchedulesForList,
} from "./payload-slim.js";

function testSlimCostDataDropsDaily() {
  const slim = slimCostData({
    totalSpent: 1_000_000,
    totalLeads: 50,
    totalBooking: 3,
    cpLead: 20000,
    daily: Array.from({ length: 365 }, (_, i) => ({
      date: `2026-01-${i + 1}`,
      spent: 1000,
      leads: 1,
    })),
  });
  assert.strictEqual(slim.totalSpent, 1_000_000);
  assert.strictEqual(slim.totalLeads, 50);
  assert.strictEqual(slim.totalBooking, 3);
  assert.strictEqual(slim.cpLead, 20000);
  assert.strictEqual(slim.daily, undefined);
  assert.ok(JSON.stringify(slim).length < 200);
}

function testSlimScheduleDropsHeavyFields() {
  const heavy = {
    id: 9,
    projectId: 1,
    saleNames: ["A", "B"],
    totalCount: 500,
    progress: { assigned: 100, feedback: 40, pending: 60, distributePct: 20, feedbackPct: 40 },
    leadIds: Array.from({ length: 500 }, (_, i) => i + 1),
    assignmentLog: [
      ...Array.from({ length: 400 }, (_, i) => ({ type: "assigned", leadId: i + 1 })),
      ...Array.from({ length: 50 }, () => ({ skipped: true, type: "skipped" })),
      { stopped: true, type: "schedule_stopped" },
    ],
  };
  const slim = slimScheduleForList(heavy);
  assert.strictEqual(slim.id, 9);
  assert.deepStrictEqual(slim.leadIds, []);
  assert.deepStrictEqual(slim.assignmentLog, []);
  assert.strictEqual(slim.skippedCount, 51);
  assert.strictEqual(slim.progress.assigned, 100);
  assert.ok(JSON.stringify(slim).length < JSON.stringify(heavy).length / 5);
}

function testSlimSchedulesForList() {
  const out = slimSchedulesForList([
    { id: 1, assignmentLog: [{ skipped: true }], leadIds: [1, 2] },
    null,
  ]);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0].skippedCount, 1);
  assert.strictEqual(out[1], null);
}

testSlimCostDataDropsDaily();
testSlimScheduleDropsHeavyFields();
testSlimSchedulesForList();
console.log("payload-slim.test.js: ok");
