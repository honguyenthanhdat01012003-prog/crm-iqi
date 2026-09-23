import assert from "assert";
import { parsePushNotificationData } from "./pushOpenLead.js";

assert.deepStrictEqual(
  parsePushNotificationData({
    notification: { data: { leadId: "88", projectId: "12", type: "sale_assign" } },
  }),
  { leadId: 88, projectId: 12, type: "sale_assign" }
);

assert.deepStrictEqual(
  parsePushNotificationData({
    notification: { data: JSON.stringify({ leadId: 91, projectId: 3 }) },
  }),
  { leadId: 91, projectId: 3, type: "" }
);

assert.deepStrictEqual(
  parsePushNotificationData({
    notification: { data: { leadIds: "155", projectId: "7" } },
  }),
  { leadId: 155, projectId: 7, type: "" }
);

assert.strictEqual(
  parsePushNotificationData({
    notification: { data: { leadIds: "1,2,3", projectId: "7" } },
  }).leadId,
  0
);

assert.deepStrictEqual(
  parsePushNotificationData({
    notification: { data: { data: { leadId: "44", projectId: "9" } } },
  }),
  { leadId: 44, projectId: 9, type: "" }
);

assert.deepStrictEqual(
  parsePushNotificationData({
    notification: { title: "Lead mới", data: {} },
  }),
  { leadId: 0, projectId: 0, type: "" }
);

console.log("pushOpenLead.test.js: ok");
