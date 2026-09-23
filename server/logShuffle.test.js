import assert from "assert";
import {
  LOG_SHUFFLE_MODES,
  normalizeLogShuffleMode,
  pickSaleFromCandidates,
  orderCandidatesByRank,
  pickLogShuffleSale,
} from "./logShuffle.js";

assert.strictEqual(normalizeLogShuffleMode(""), LOG_SHUFFLE_MODES.rank);
assert.strictEqual(normalizeLogShuffleMode("rank"), LOG_SHUFFLE_MODES.rank);
assert.strictEqual(normalizeLogShuffleMode("RANDOM"), LOG_SHUFFLE_MODES.random);

assert.strictEqual(pickSaleFromCandidates(["An", "Binh", "Chi"], "rank"), "An");
assert.strictEqual(pickSaleFromCandidates(["An", "Binh", "Chi"], "random", () => 0), "An");
assert.strictEqual(pickSaleFromCandidates(["An", "Binh", "Chi"], "random", () => 0.99), "Chi");
assert.strictEqual(pickSaleFromCandidates([], "random"), null);

assert.deepStrictEqual(
  orderCandidatesByRank(["Chi", "An"], ["Binh", "An", "Chi"]),
  ["An", "Chi"]
);

assert.strictEqual(
  pickLogShuffleSale(["Chi", "An"], ["Binh", "An", "Chi"], "rank"),
  "An"
);
assert.strictEqual(
  pickLogShuffleSale(["Chi", "An"], ["Binh", "An", "Chi"], "random", () => 0.6),
  "Chi"
);

console.log("logShuffle.test.js: ok");
