import assert from "assert";
import {
  shouldMultiHoldOnRotate,
  formatTeamRotateLabel,
  filterHistoryForTeamMembers,
  rotateDistributionKind,
  isRotateNewKind,
} from "./leadTeamHolders.js";

assert.strictEqual(shouldMultiHoldOnRotate(true), true);
assert.strictEqual(shouldMultiHoldOnRotate(false), false);

assert.strictEqual(formatTeamRotateLabel({ id: 5, name: "T2" }), "team T2 (#5)");
assert.strictEqual(formatTeamRotateLabel({ id: 5 }), "team#5");

assert.strictEqual(rotateDistributionKind(true), "rotate");
assert.strictEqual(rotateDistributionKind(false), "rotate_new");
assert.strictEqual(isRotateNewKind("rotate_new"), true);
assert.strictEqual(isRotateNewKind("rotate"), false);

const history = [
  { action: "Chia lead", saleName: "Nguyễn Thị Kim Lời", feedback: "Admin chia team T2" },
  { action: "Cập nhật", saleName: "duybao", status: "Đang tư vấn", feedback: "Add Zalo" },
  { action: "Cập nhật", saleName: "Other Team Sale", status: "Đã gọi", feedback: "secret" },
  { action: "Cập nhật", saleName: "Nguyễn Văn Tiến", status: "Quan tâm", feedback: "teammate note" },
];
const teamA = ["duybao", "Nguyễn Thị Kim Lời", "Nguyễn Văn Tiến"];
const filtered = filterHistoryForTeamMembers(history, teamA);
assert.strictEqual(filtered.length, 3);
assert.ok(filtered.every((h) => h.saleName !== "Other Team Sale"));
assert.ok(filtered.some((h) => h.saleName === "duybao"));
assert.ok(filtered.some((h) => h.saleName === "Nguyễn Văn Tiến"));

console.log("leadTeamHolders.test.js: ok");
