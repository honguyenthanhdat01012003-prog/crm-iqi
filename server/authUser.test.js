import assert from "assert";
import { buildAuthUserFromRow, isJwtRoleStale } from "./authUser.js";

assert.strictEqual(buildAuthUserFromRow(null), null);
assert.strictEqual(buildAuthUserFromRow({}), null);

const user = buildAuthUserFromRow({
  id: 5,
  username: "vandinh",
  role: "sale",
  display_name: "Nguyễn Văn Đình",
  must_change_password: 0,
});
assert.deepStrictEqual(user, {
  userId: 5,
  username: "vandinh",
  role: "sale",
  displayName: "Nguyễn Văn Đình",
  mustChangePassword: false,
});
assert.strictEqual(user.role, "sale");

assert.strictEqual(isJwtRoleStale({ role: "manager" }, "sale"), true);
assert.strictEqual(isJwtRoleStale({ role: "admin" }, "sale"), true);
assert.strictEqual(isJwtRoleStale({ role: "sale" }, "sale"), false);
assert.strictEqual(isJwtRoleStale({ role: "manager" }, "manager"), false);
assert.strictEqual(isJwtRoleStale({}, "sale"), false);
assert.strictEqual(isJwtRoleStale(null, "sale"), false);

console.log("authUser.test.js OK");
