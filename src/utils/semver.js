/** So sánh version kiểu 1.3 / 1.3.0 / 1.4.2 — trả -1 | 0 | 1 */
export function compareSemver(a, b) {
  const parse = (v) =>
    String(v || "0")
      .trim()
      .replace(/^v/i, "")
      .split(/[^\d]+/)
      .filter(Boolean)
      .map((n) => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d < 0) return -1;
    if (d > 0) return 1;
  }
  return 0;
}

export function isVersionBelow(current, minimum) {
  const min = String(minimum || "").trim();
  if (!min) return false;
  const cur = String(current || "").trim();
  if (!cur) return true;
  return compareSemver(cur, min) < 0;
}
