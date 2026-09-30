import assert from "assert";
import { normalizeSyncMode, isProjectAutoSyncActive, selectAutoSyncProjects } from "./syncActivity.js";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 30, 4, 0, 0);
const last = new Map([
  [1, now - 2 * DAY],   // đang chạy
  [2, now - 45 * DAY],  // cũ
  [3, now - 45 * DAY],  // cũ nhưng admin bật Luôn đồng bộ
  [4, now - 1 * DAY],   // đang chạy nhưng admin ngừng
  [6, null],            // không đọc được ngày
]);

assert.strictEqual(normalizeSyncMode(""), "auto");
assert.strictEqual(normalizeSyncMode("ALWAYS"), "always");
assert.strictEqual(normalizeSyncMode("xx"), "auto");

assert.strictEqual(isProjectAutoSyncActive({ id: 1 }, last, now), true);
assert.strictEqual(isProjectAutoSyncActive({ id: 2 }, last, now), false);
assert.strictEqual(isProjectAutoSyncActive({ id: 3, sync_mode: "always" }, last, now), true);
assert.strictEqual(isProjectAutoSyncActive({ id: 4, sync_mode: "off" }, last, now), false);
// Dự án mới tạo chưa có lead nào vẫn phải quét
assert.strictEqual(isProjectAutoSyncActive({ id: 5 }, last, now), true);
assert.strictEqual(isProjectAutoSyncActive({ id: 6 }, last, now), true);
// Đúng mốc 30 ngày vẫn tính đang chạy
assert.strictEqual(isProjectAutoSyncActive({ id: 7 }, new Map([[7, now - 30 * DAY]]), now), true);

const { active, idle } = selectAutoSyncProjects(
  [{ id: 1 }, { id: 2 }, { id: 3, sync_mode: "always" }, { id: 4, sync_mode: "off" }, { id: 5 }],
  last,
  now
);
assert.deepStrictEqual(active.map((p) => p.id), [1, 3, 5]);
assert.deepStrictEqual(idle.map((p) => p.id), [2, 4]);

console.log("syncActivity.test.js: ok");
