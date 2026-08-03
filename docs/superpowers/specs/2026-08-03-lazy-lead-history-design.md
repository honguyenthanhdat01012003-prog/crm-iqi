# Lazy lead history (Mở xem) — design

**Date:** 2026-08-03  
**Scope:** Web + Capacitor iOS (shared `App.jsx` bundle)

## Goal
Opening lead detail must not call `GET /api/leads/:id/history` until the user expands history (same UX pattern as Chat Messenger “Mở xem”).

## UI
- Detail form / team / status unchanged.
- History block: collapsed header + badge from `lead.historyCount` + **Mở xem ▼ / Thu gọn ▲**.
- First expand → fetch history; cache while same lead open; refetch if `historyCount` changes while open (e.g. after save).
- Per-sale “Xem chi tiết ▼” cards unchanged (client expand only).

## Permissions (GET history)
| Role | Project `distribution_mode` | Visible rows |
|------|----------------------------|--------------|
| admin / manager | any | full timeline |
| sale | `log` | only that sale’s rows (+ system/chia rows via existing filter) |
| sale | `race` | all members of **their** team only |

## Out of scope
- List/lite payload already skips full history — unchanged.
- Native Swift UI rewrite — not needed; iOS uses bundled web.
