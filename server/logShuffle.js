/** Log-mode auto shuffle: rank by care/performance, or random among project sales. */

export const LOG_SHUFFLE_MODES = {
  rank: "rank",
  random: "random",
};

export function normalizeLogShuffleMode(value = "") {
  return String(value || "").trim().toLowerCase() === LOG_SHUFFLE_MODES.random
    ? LOG_SHUFFLE_MODES.random
    : LOG_SHUFFLE_MODES.rank;
}

export function pickSaleFromCandidates(names, mode, rng = Math.random) {
  const list = Array.isArray(names) ? names.filter((n) => String(n || "").trim()) : [];
  if (!list.length) return null;
  if (normalizeLogShuffleMode(mode) === LOG_SHUFFLE_MODES.random) {
    const i = Math.floor(Number(rng()) * list.length);
    const idx = Number.isFinite(i) ? Math.min(Math.max(i, 0), list.length - 1) : 0;
    return list[idx] || null;
  }
  return list[0];
}

export function orderCandidatesByRank(candidates, rankedNames = []) {
  const cand = Array.isArray(candidates) ? candidates.filter((n) => String(n || "").trim()) : [];
  if (!cand.length) return [];
  const byKey = new Map();
  for (const name of cand) {
    const key = String(name).trim().toLowerCase();
    if (!byKey.has(key)) byKey.set(key, name);
  }
  const ordered = [];
  const seen = new Set();
  for (const name of rankedNames || []) {
    const key = String(name || "").trim().toLowerCase();
    if (!key || seen.has(key) || !byKey.has(key)) continue;
    seen.add(key);
    ordered.push(byKey.get(key));
  }
  for (const [key, name] of byKey) {
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(name);
  }
  return ordered;
}

export function pickLogShuffleSale(candidates, rankedNames, mode, rng = Math.random) {
  return pickSaleFromCandidates(orderCandidatesByRank(candidates, rankedNames), mode, rng);
}
