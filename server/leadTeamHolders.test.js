import assert from "assert";
import {
  shouldMultiHoldOnRotate,
  formatTeamRotateLabel,
  filterHistoryForTeamMembers,
  rotateDistributionKind,
  isRotateNewKind,
  resolveSaleHistoryMemberNames,
  countActiveHolderSales,
} from "./leadTeamHolders.js";

function stripAccents(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

assert.strictEqual(shouldMultiHoldOnRotate(true), true);
assert.strictEqual(shouldMultiHoldOnRotate(false), false);

assert.strictEqual(formatTeamRotateLabel({ id: 5, name: "T2" }), "team T2 (#5)");
assert.strictEqual(formatTeamRotateLabel({ id: 5 }), "team#5");

assert.strictEqual(rotateDistributionKind(true), "rotate");
assert.strictEqual(rotateDistributionKind(false), "rotate_new");
assert.strictEqual(isRotateNewKind("rotate_new"), true);
assert.strictEqual(isRotateNewKind("rotate"), false);

assert.deepStrictEqual(
  resolveSaleHistoryMemberNames({ mode: "log", displayName: "duybao", teamMemberNames: ["a", "b"] }),
  ["duybao"]
);
assert.deepStrictEqual(
  resolveSaleHistoryMemberNames({ mode: "race", displayName: "duybao", teamMemberNames: ["duybao", "tiến"] }),
  ["duybao"]
);
assert.deepStrictEqual(
  resolveSaleHistoryMemberNames({ mode: "race", displayName: "duybao", teamMemberNames: [] }),
  ["duybao"]
);

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

const accentHistory = [
  { action: "Cập nhật", saleName: "Đạt test 1", status: "Đang tư vấn", feedback: "Gọi khách" },
  { action: "Cập nhật", saleName: "Đạt test tồi", status: "Quan tâm", feedback: "của teammate" },
  { action: "Nhận lead", saleName: "Admin", feedback: "Xác nhận đã nhận lead" },
];
const accentFiltered = filterHistoryForTeamMembers(accentHistory, ["Đạt test 1"], {
  normalizeName: stripAccents,
});
assert.ok(
  accentFiltered.some((h) => h.action === "Cập nhật" && h.saleName === "Đạt test 1"),
  "sale own update must remain when names differ only by accent fold"
);

const ownOnly = filterHistoryForTeamMembers(accentHistory, ["Đạt test 1"], {
  normalizeName: stripAccents,
  ownRowsOnly: true,
});
assert.deepStrictEqual(ownOnly.map((h) => h.saleName), ["Đạt test 1"]);
assert.strictEqual(ownOnly[0].action, "Cập nhật");

assert.strictEqual(
  countActiveHolderSales({
    teamIds: [10],
    membersByTeam: { 10: ["Đạt test 1", "Đạt test tồi"] },
  }),
  2
);
assert.strictEqual(
  countActiveHolderSales({
    teamIds: [10, 11],
    membersByTeam: { 10: ["A", "B"], 11: ["B", "C"] },
  }),
  3
);
assert.strictEqual(
  countActiveHolderSales({ teamIds: [], membersByTeam: {}, saleName: "Nga Nguyen" }),
  1
);
assert.strictEqual(
  countActiveHolderSales({ teamIds: [], membersByTeam: {}, saleName: "Chưa chia" }),
  0
);

console.log("leadTeamHolders.test.js: ok");
