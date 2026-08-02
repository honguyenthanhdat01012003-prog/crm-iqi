# Multi-team rotate keep Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Auto-rotate keeps feedback teams as co-holders, newest team is primary; team-scoped history; XÁO vs NEW tags.

**Architecture:** `lead_team_holders` table; primary = `leads.team_id`/`sale_name`; pure helpers in `server/leadTeamHolders.js` + wire `processAutoRotate` / filters / history.

**Tech Stack:** Node ESM, SQLite/libsql, React App.jsx tag helpers.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-multi-team-rotate-keep-design.md`
- NEW-path re-arms SLA; multi-hold keeps `leads.status`; v1 = team/race rotate only
- DB_VERSION → 45

---

### Task 1: Pure helpers + tests

- [ ] `server/leadTeamHolders.js` + `server/leadTeamHolders.test.js`
- [ ] `npm run test:lead-team-holders`

### Task 2: Migration + holder CRUD in index.js

- [ ] v45 `lead_team_holders` + backfill from `leads.team_id`
- [ ] helpers: list/upsert/setPrimary/revoke/getActiveTeamIds

### Task 3: Permissions + list visibility

- [ ] `saleCanUpdateLead` + `buildLeadsSqlFilters` include co-holder teams

### Task 4: History team-scope

- [ ] GET `/api/leads/:id/history` — sale sees teammate history, not other teams
- [ ] `applySaleLeadView` — for team holders, include teammate feedback in summary when possible

### Task 5: processAutoRotate multi-hold / NEW path

- [ ] Feedback → keep holders + primary next + `rotate` (XÁO)
- [ ] No feedback → revoke old + `rotate_new` (NEW) + reset assign clocks
- [ ] Log with team names

### Task 6: Client tags

- [ ] `isNewTaggedLead` / SLA client treat `rotate_new` as NEW
- [ ] `isShuffleTaggedLead` still XÁO for `rotate`

### Task 7: Verify

- [ ] Unit tests pass; smoke syntax-check `server/index.js`
