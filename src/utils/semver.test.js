import assert from "assert";
import { compareSemver, isVersionBelow } from "./semver.js";

assert.strictEqual(compareSemver("1.3", "1.3.0"), 0);
assert.strictEqual(compareSemver("1.3.0", "1.4.0"), -1);
assert.strictEqual(compareSemver("1.4.0", "1.3.9"), 1);
assert.strictEqual(compareSemver("2.0", "1.9.9"), 1);
assert.strictEqual(isVersionBelow("1.3.0", "1.4.0"), true);
assert.strictEqual(isVersionBelow("1.4.0", "1.4.0"), false);
assert.strictEqual(isVersionBelow("1.4.1", "1.4.0"), false);
assert.strictEqual(isVersionBelow("1.3", ""), false);
console.log("semver.test.js: ok");
