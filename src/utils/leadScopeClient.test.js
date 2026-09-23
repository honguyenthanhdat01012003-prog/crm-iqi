import assert from "assert";
import {
  resolvePagedLeadsTotal,
  shouldReplaceScopeCache,
  isPartialLeadPage,
  shouldShowLeadPager,
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

console.log("leadScopeClient.test.js: ok");
