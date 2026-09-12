import assert from "assert";
import {
  leadFromPushPayload,
  leadKey,
  shouldAddLeadAlert,
  shouldPlayLeadAlert,
} from "./leadNotify.js";

const seen = new Set(["id:77"]);
const existing = new Set(["id:88"]);

const fresh = { id: 99, name: "Khách mới" };
assert.strictEqual(shouldPlayLeadAlert(fresh, { seenKeys: seen, existingKeys: existing }), true);
assert.strictEqual(shouldAddLeadAlert(fresh, { seenKeys: seen, existingKeys: existing }), true);

const alreadySeen = { id: 77, name: "Đã xem" };
assert.strictEqual(shouldPlayLeadAlert(alreadySeen, { seenKeys: seen, existingKeys: existing }), false);
assert.strictEqual(shouldAddLeadAlert(alreadySeen, { seenKeys: seen, existingKeys: existing }), false);

const pushAgain = leadFromPushPayload({
  title: "Bạn có lead mới",
  body: "CSJ Tower: Nga Nguyen • 0123",
  leadId: 77,
  sound: "sale",
});
assert.strictEqual(pushAgain.fromPush, true);
assert.strictEqual(leadKey(pushAgain), "id:77");
assert.strictEqual(
  shouldPlayLeadAlert(pushAgain, { seenKeys: seen, existingKeys: existing }),
  true,
  "chia lead new/lại phải kêu dù lead đã seen"
);
assert.strictEqual(
  shouldAddLeadAlert(pushAgain, { seenKeys: seen, existingKeys: existing }),
  false,
  "không nhân đôi banner nếu đã seen"
);

console.log("leadNotify.test.js: ok");
