import assert from "assert";
import { planSheetLeadMatches } from "./sheetLeadMatch.js";

const normPhone = (p) => String(p || "").replace(/\D/g, "").replace(/^84/, "0");
const parseDate = (s) => {
  const m = String(s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) : null;
};
const plan = (rows, existing) => planSheetLeadMatches(rows, existing, { normPhone, parseDate });

// Khách đăng ký lại cùng SĐT với mã lead mới → lead mới, không đè lead cũ
{
  const existing = [{ id: 10, name: "Lâm Thiệt", phone: "+84938727489", ads_id: "l:A", created_at: "01/09/2026 10:00", status: "called", manager_name: "QL" }];
  const p = plan([
    { name: "Lâm Thiệt", phone: "+84938727489", adsId: "l:A", createdAt: "01/09/2026 10:00" },
    { name: "Lâm Thiệt", phone: "+84938727489", adsId: "l:B", createdAt: "30/09/2026 11:11" },
  ], existing);
  assert.strictEqual(p[0].prev.id, 10);
  assert.strictEqual(p[0].via, "adsId");
  assert.strictEqual(p[1].prev, null);
  assert.strictEqual(p[1].repair, false, "lần đăng ký mới hơn là lead mới thật");
  assert.strictEqual(p[1].source.id, 10);
}

// Lead đã bị gộp (giữ mã lead mới nhất) → dòng cũ được tạo lại dạng khôi phục
{
  const existing = [{ id: 10, name: "Lâm Thiệt", phone: "+84938727489", ads_id: "l:B", created_at: "30/09/2026 11:11", status: "called", manager_name: "QL" }];
  const p = plan([
    { name: "Lâm Thiệt", phone: "+84938727489", adsId: "l:A", createdAt: "01/09/2026 10:00" },
    { name: "Lâm Thiệt", phone: "+84938727489", adsId: "l:B", createdAt: "30/09/2026 11:11" },
  ], existing);
  assert.strictEqual(p[1].prev.id, 10);
  assert.strictEqual(p[0].prev, null, "lead 10 đã thuộc dòng l:B");
  assert.strictEqual(p[0].repair, true);
  assert.strictEqual(p[0].source.id, 10);
}

// Trùng tên nhưng khác SĐT không bao giờ ghép vào nhau
{
  const existing = [{ id: 20, name: "Nguyễn Thảo", phone: "0901111111", ads_id: "", created_at: "01/09/2026 10:00" }];
  const p = plan([{ name: "Nguyễn Thảo", phone: "0902222222", adsId: "", createdAt: "05/09/2026 10:00" }], existing);
  assert.strictEqual(p[0].prev, null);
  assert.strictEqual(p[0].repair, false);
}

// Chỉ ghép theo tên khi một bên không có SĐT
{
  const existing = [{ id: 21, name: "Hiện", phone: "", ads_id: "", created_at: "01/09/2026 10:00" }];
  const p = plan([{ name: "Hiện", phone: "0903333333", adsId: "", createdAt: "01/09/2026 10:00" }], existing);
  assert.strictEqual(p[0].prev.id, 21);
  assert.strictEqual(p[0].via, "name");
}

// Sheet không có mã lead: 2 dòng giống hệt nhau giữ 2 lead ổn định qua các lần sync
{
  const rows = [
    { name: "A. Tường", phone: "0904444444", adsId: "", createdAt: "10/09/2026 09:00" },
    { name: "A. Tường", phone: "0904444444", adsId: "", createdAt: "10/09/2026 09:05" },
  ];
  const first = plan(rows, [{ id: 30, name: "A. Tường", phone: "0904444444", ads_id: "", created_at: "10/09/2026 09:05" }]);
  assert.strictEqual(first.filter((x) => x.prev).length, 1);
  assert.strictEqual(first.filter((x) => !x.prev).length, 1);
  const second = plan(rows, [
    { id: 30, name: "A. Tường", phone: "0904444444", ads_id: "", created_at: "10/09/2026 09:05" },
    { id: 31, name: "A. Tường", phone: "0904444444", ads_id: "", created_at: "10/09/2026 09:00" },
  ]);
  assert.deepStrictEqual(second.map((x) => x.prev && x.prev.id).sort(), [30, 31]);
}

// Dòng lặp y nguyên cùng mã lead chỉ ra 1 lead
{
  const rows = [
    { name: "Bích Ngọc", phone: "0905555555", adsId: "l:X", createdAt: "10/09/2026 09:00" },
    { name: "Bích Ngọc", phone: "0905555555", adsId: "l:X", createdAt: "10/09/2026 09:00" },
  ];
  const fresh = plan(rows, []);
  assert.strictEqual(fresh[0].skip, false);
  assert.strictEqual(fresh[1].skip, true);
  const synced = plan(rows, [{ id: 40, name: "Bích Ngọc", phone: "0905555555", ads_id: "l:X", created_at: "10/09/2026 09:00" }]);
  assert.strictEqual(synced[0].prev.id, 40);
  assert.strictEqual(synced[1].skip, true);
}

// Lead cũ mất mã (dữ liệu trước khi có ads_id) vẫn được nhận lại theo SĐT + tên
{
  const existing = [{ id: 50, name: "Hoàng Thông", phone: "+84984250849", ads_id: "", created_at: "27/09/2026 15:55", manager_name: "QL" }];
  const p = plan([{ name: "Hoàng Thông", phone: "+84984250849", adsId: "l:Z", createdAt: "27/09/2026 15:55" }], existing);
  assert.strictEqual(p[0].prev.id, 50);
  assert.strictEqual(p[0].via, "phoneName");
}

// Lead copy từ dự án khác (MKT xáo) không bị dòng sheet trùng SĐT chiếm
{
  const existing = [{ id: 60, name: "Tien Tran", phone: "0906666666", ads_id: "mktxao:9", created_at: "01/09/2026 10:00" }];
  const p = planSheetLeadMatches(
    [{ name: "Tien Tran", phone: "0906666666", adsId: "l:N", createdAt: "20/09/2026 10:00" }],
    existing,
    { normPhone, parseDate, canFallback: (e) => !String(e.ads_id).startsWith("mktxao:") }
  );
  assert.strictEqual(p[0].prev, null);
  assert.strictEqual(p[0].repair, false);
}

console.log("sheetLeadMatch.test.js: ok");
