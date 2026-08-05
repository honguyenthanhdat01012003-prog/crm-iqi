# Admin junk-lead CSV export

**Date:** 2026-08-05  
**Status:** Approved for implementation  
**Audience:** Admin only

## Problem

Admin cần xuất danh sách lead “tệ / không dùng được” theo dự án để xử lý ngoài CRM (chặn ads, đối soát MKT, lưu hồ sơ chết). Hiện chưa có nút xuất theo bộ trạng thái này.

## Goal

Từ trang **Khách hàng**, Admin chọn dự án + trạng thái → tải **CSV** gồm tên, SĐT, nhu cầu, trạng thái, **nguồn dự án**.

## Non-goals

- Không cho Manager / Sale dùng tính năng này.
- Không xuất Excel `.xlsx` (phase 1 chỉ CSV).
- Không job nền / email — tải ngay trong phiên.
- Không đổi rule phân lead / race / giờ hành chính.

## Defaults

### Default statuses (pre-ticked, editable)

| Key | Label VN |
|---|---|
| `spam` | Phá/rác |
| `wrong_phone` | Thuê bao |
| `hung_up` | Tắt máy ngang |
| `not_interested` | Không quan tâm |
| `sale` | Sale |

Admin có thể tick thêm / bỏ bất kỳ status hợp lệ khác trước khi xuất.

### Default projects

Prefill theo filter dự án đang chọn trên trang Khách hàng. Admin chọn thêm / bớt nhiều dự án trong popup.

## UX

**Entry:** toolbar trang Khách hàng (admin only) → nút **“Xuất lead tệ”**.

**Popup fields:**

1. **Dự án** — multi-select (bắt buộc ≥ 1).
2. **Trạng thái** — multi-select, mặc định bộ trên.
3. **Kiểu xuất**
   - `single` — 1 file CSV chung (mọi dự án), luôn có cột **Dự án**.
   - `per_project` — mỗi dự án 1 file CSV; nếu > 1 file thì gói **ZIP**.
4. Nút **Xuất** → download; hiện số dòng sẽ xuất (preview count) nếu làm được nhẹ.

## CSV columns (phase 1)

| Column header (VN) | Source |
|---|---|
| Dự án | `projects.name` |
| Tên khách | `leads.name` |
| Số điện thoại | `leads.phone` |
| Nhu cầu | `leads.product` |
| Trạng thái | Vietnamese label from `STATUS_LABELS` |

Encoding: UTF-8 with BOM (Excel VN mở đúng).  
Filename examples:

- Single: `lead-te-YYYYMMDD-HHmm.csv`
- Per project: `lead-te-<slug-du-an>-YYYYMMDD-HHmm.csv` inside `lead-te-YYYYMMDD-HHmm.zip`

## API

`POST /api/leads/export-junk`  
Auth: `requireAuth` + **admin only** (`requireAdmin`).

Request body:

```json
{
  "projectIds": [1, 2],
  "statuses": ["spam", "wrong_phone", "hung_up", "not_interested", "sale"],
  "mode": "single"
}
```

`mode`: `"single"` | `"per_project"`.

Behavior:

- Validate `projectIds` non-empty, `statuses` non-empty and known keys.
- Query leads where `project_id IN (...)` AND normalized status IN selected set.
- Status matching uses the same normalize/tab-status rules as admin lead tabs (so history-denorm / `admin_tab_status` stays consistent if that is what list uses).
- `single` → `Content-Type: text/csv; charset=utf-8` + attachment.
- `per_project` with 1 project → one CSV; with 2+ → `application/zip`.
- Empty result → `200` with header-only CSV (or zip of empty per-project CSVs) + clear UI toast “Không có lead khớp”.

Optional helper: `POST /api/leads/export-junk/count` returning `{ total, byProject }` for preview — nice-to-have, not blocking.

## Security

- Reject non-admin with 403.
- Do not expose sale-only fields beyond the columns above.
- Cap row count (e.g. 50_000) with 413 / friendly error if exceeded — force narrower project/status filter.

## Approaches considered

| Option | Notes |
|---|---|
| A. Client-only export from loaded list | Rejected — incomplete for large projects |
| **B. Server CSV/ZIP export** | **Chosen** — complete, admin-gated, matches existing SLA audit CSV pattern |
| C. Background job + email | Overkill for current volume |

## Out of scope / later

- Extra columns: sale, manager, last update date, campaign.
- Excel `.xlsx`.
- Entry point on Dự án page.
- Scheduling / auto email weekly junk dump.

## Acceptance

1. Non-admin never sees the button / API returns 403.
2. Default ticks include phá/rác, thuê bao, tắt máy ngang, không quan tâm, sale.
3. CSV always includes project source column (single mode) or filename+content scoped per project (per_project mode).
4. Choosing 2+ projects + `per_project` downloads a ZIP.
5. Choosing statuses/projects with zero matches shows empty-friendly UX, no crash.
