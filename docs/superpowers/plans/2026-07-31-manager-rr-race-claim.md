# Manager RR Race Claim — Implementation Plan

> **For agentic workers:** Implement per `docs/superpowers/specs/2026-07-31-manager-rr-race-claim-design.md`. User requested code + push in this session.

**Goal:** Race mode offers one manager at a time (RR), 5m claim → 10m feedback → keep or fall to team.

**Files:** `server/index.js`, `src/App.jsx`, rebuild `dist/`, bump `BUILD_VERSION`.

## Tasks
1. DB + constants: `manager_feedback` stage, `MANAGER_FEEDBACK_MS`, `race_manager_cursor`
2. Sync offer: RR soft-assign one manager + notify only them
3. Claim → `manager_feedback`; timeout both stages → team; feedback → `claimed`
4. UI banners + visibility; build + commit + push
