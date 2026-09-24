import assert from "assert";
import {
  resolvePagedLeadsTotal,
  shouldReplaceScopeCache,
  isPartialLeadPage,
  shouldShowLeadPager,
  shouldKeepExistingLeadList,
  mergeLeadsPreserveFullList,
} from "./leadScopeClient.js";

assert.strictEqual(
  resolvePagedLeadsTotal({ leadsScopeMode: true, scopedCount: 80, leadsTotal: 15 }),
  80
);
assert.strictEqual(
  resolvePagedLeadsTotal({ leadsScopeMode: false, leadsTotal: 0, tabCountAll: 42, loadedCount: 15 }),
  42
);
assert.strictEqual(
  resolvePagedLeadsTotal({ leadsScopeMode: false, leadsTotal: 96, tabCountAll: 10, loadedCount: 15 }),
  96
);
assert.strictEqual(
  resolvePagedLeadsTotal({ leadsScopeMode: false, projectCount: 120, loadedCount: 15 }),
  120
);

assert.strictEqual(
  shouldReplaceScopeCache({ leads: new Array(80), paginated: false }, { leads: new Array(15), paginated: true }),
  false
);
assert.strictEqual(
  shouldReplaceScopeCache({ leads: new Array(15), paginated: true }, { leads: new Array(15), paginated: true, leadsTotal: 90 }),
  true
);
assert.strictEqual(
  shouldReplaceScopeCache(null, { leads: new Array(15), paginated: true }),
  true
);

assert.strictEqual(isPartialLeadPage({ leads: new Array(15) }), true);
assert.strictEqual(isPartialLeadPage({ leads: new Array(15), paginated: true }), true);
assert.strictEqual(isPartialLeadPage({ leads: new Array(80), scope: true, leadsTotal: 80 }), false);
assert.strictEqual(shouldShowLeadPager({ totalPages: 1, loadedCount: 15, pageSize: 15, leadsScopeMode: false }), true);
assert.strictEqual(shouldShowLeadPager({ totalPages: 1, loadedCount: 15, pageSize: 15, leadsScopeMode: true }), false);
assert.strictEqual(shouldShowLeadPager({ totalPages: 4, loadedCount: 15, pageSize: 15, leadsScopeMode: false }), true);

// Feedback / lead xáo trên list đủ 146: trang lite (15 hoặc tab 8) không được thay list
assert.strictEqual(
  shouldKeepExistingLeadList(new Array(146), { leads: new Array(15), paginated: true, leadsTotal: 146 }, { hasFullList: true }),
  true
);
assert.strictEqual(
  shouldKeepExistingLeadList(new Array(146), { leads: new Array(8), paginated: true, leadsTotal: 8 }, { hasFullList: true }),
  true
);
// Vừa đổi dự án (chưa có list đủ): trang 15 của dự án mới phải thay list cũ
assert.strictEqual(
  shouldKeepExistingLeadList(new Array(146), { leads: new Array(15), paginated: true, leadsTotal: 90 }, { hasFullList: false }),
  false
);
// Scope đủ mới (1 lead bị thu hồi) phải thay list
assert.strictEqual(
  shouldKeepExistingLeadList(new Array(146), { leads: new Array(145), scope: true, leadsTotal: 145 }, { hasFullList: true }),
  false
);
// Server phân trang: trang 2 thay trang 1
assert.strictEqual(
  shouldKeepExistingLeadList(new Array(15), { leads: new Array(15), paginated: true, leadsTotal: 146 }, { hasFullList: false }),
  false
);

const merged = mergeLeadsPreserveFullList(
  [{ id: 1, status: "new" }, { id: 2, status: "care" }],
  [{ id: 2, status: "done" }, { id: 3, status: "new" }]
);
assert.strictEqual(merged[0].id, 3);
assert.strictEqual(merged.find((l) => l.id === 2).status, "done");
assert.strictEqual(merged.length, 3);

assert.strictEqual(
  shouldReplaceScopeCache({ leads: new Array(146) }, { leads: new Array(15), paginated: true }),
  false
);

// Tab Chưa feedback trên list đủ: số trang theo số khách của tab, không theo 146
assert.strictEqual(
  resolvePagedLeadsTotal({ leadsScopeMode: true, scopedCount: 9, leadsTotal: 146, tabCountAll: 146 }),
  9
);
// Server phân trang, tab rỗng: không được hiện nhiều trang trống
assert.strictEqual(
  resolvePagedLeadsTotal({ leadsScopeMode: false, leadsTotal: 0, tabCountAll: 0, projectCount: 0, loadedCount: 0 }),
  0
);
assert.strictEqual(
  resolvePagedLeadsTotal({ leadsScopeMode: false, leadsTotal: 8, tabCountAll: 8, projectCount: 0, loadedCount: 8 }),
  8
);

console.log("leadScopeClient.test.js: ok");
