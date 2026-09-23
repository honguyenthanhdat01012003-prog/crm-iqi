import assert from "assert";
import {
  resolvePagedLeadsTotal,
  shouldReplaceScopeCache,
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

console.log("leadScopeClient.test.js: ok");
