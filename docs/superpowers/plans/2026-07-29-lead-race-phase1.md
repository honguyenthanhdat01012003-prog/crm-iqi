# Lead Race Distribution Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-level `race` distribution mode with manager claim (5m), team round-robin claim (10m), and fallback to manual pool while preserving existing `log` behavior.

**Architecture:** Extend existing `server/index.js` state-machine patterns (instant SLA + background processors) by adding race fields on projects/leads, project-team mapping, claim endpoint, and periodic race processor. Reuse current Socket + push + Telegram notification channels and existing UI modal/list patterns.

**Tech Stack:** Node.js (Express), SQLite/libsql, React, Socket.IO, Capacitor mobile webview.

## Global Constraints

- Existing projects default to `log` mode.
- `race` projects must have at least one assigned team.
- Manager claim sets `manager_name` only (sale assignment stays manual).
- Team claim sets `team_id` and `sale_name = leader`.
- If all teams timeout, lead moves to manual pool (`sale_name=''`, `team_id=NULL`).
- Case 3 (feedback-performance weighting) is out of scope.

---

### Task 1: DB schema + mapping primitives

**Files:**
- Modify: `server/index.js`

**Interfaces:**
- Produces: project fields `distributionMode`, `raceTeamCursor`, lead fields `raceStage`, `raceDeadlineAt`, etc., and helper accessors for project-team mapping.

- [ ] Add DB migration for:
  - `projects.distribution_mode TEXT DEFAULT 'log'`
  - `projects.race_team_cursor INTEGER DEFAULT 0`
  - `project_teams(project_id, team_id, sort_order, PRIMARY KEY(project_id, team_id))`
  - lead race columns (`race_stage`, `race_started_at`, `race_deadline_at`, `race_team_id`, `race_claimed_by`, `race_claimed_at`, `race_team_index`).
- [ ] Expose these fields in server mapping outputs (`readData`, bootstrap payload, `mapLeadFromRow`).
- [ ] Ensure `project_teams` is deleted with project deletion.

### Task 2: Project CRUD with distribution mode + assigned teams

**Files:**
- Modify: `server/index.js`, `src/App.jsx`

**Interfaces:**
- Consumes: new project schema from Task 1.
- Produces: project create/edit API contract including `distributionMode` and `teamIdsOrdered`.

- [ ] Extend `POST /api/projects` and `PUT /api/projects/:id` to accept:
  - `distributionMode` (`log`|`race`)
  - `teamIdsOrdered` (array)
- [ ] Validate race mode requires at least 1 team and persist `project_teams` order.
- [ ] Update project modal UI in `App.jsx`:
  - mode selector (log/race)
  - team checklist + order controls for race mode.
- [ ] Keep existing behavior unchanged when mode is `log`.

### Task 3: Sync entry flow for race projects

**Files:**
- Modify: `server/index.js`

**Interfaces:**
- Consumes: project distribution mode.
- Produces: initial race stage assignment for new leads.

- [ ] In sync path (`syncProject`/`replaceProjectData` and manager auto-assignment section), branch by project mode:
  - `log`: keep current manager round-robin.
  - `race`: do not auto-set `manager_name`; initialize new leads into `manager_race` with 5-minute deadline.
- [ ] Add helper to emit manager-race notifications (push + telegram) for project managers.
- [ ] Preserve race fields during sync overwrite logic.

### Task 4: Claim API + visibility filtering

**Files:**
- Modify: `server/index.js`, `src/App.jsx`

**Interfaces:**
- Produces endpoint: `POST /api/leads/:id/race-claim`.

- [ ] Implement `POST /api/leads/:id/race-claim`:
  - Manager claim only when `race_stage='manager_race'`.
  - Sale claim only when `race_stage='team_offer'` and sale is member of offered team.
  - Atomic update guard (`WHERE race_stage=...`) for first-wins behavior.
- [ ] On manager claim: set `manager_name`, `race_stage='claimed'`, notify other managers.
- [ ] On team claim: set `team_id`, `sale_name=leader`, `race_stage='claimed'`.
- [ ] Update lead SQL filters so visibility follows race-stage rules for managers/sales.
- [ ] Add client-side claim action UI (button/banner) for race-eligible users.

### Task 5: Background race processor + fallback handling

**Files:**
- Modify: `server/index.js`

**Interfaces:**
- Produces periodic processor function `processLeadRace()` integrated into startup scheduler.

- [ ] Implement `processLeadRace` interval job (30–60s):
  - Expired `manager_race` → first team offer by `race_team_cursor`, set 10-minute deadline.
  - Expired `team_offer` → next team in project order.
  - Last team timeout → set `race_stage='manual_pool'`, clear sale/team, notify admin/managers.
- [ ] Insert `lead_history` entries for each transition.
- [ ] Emit `data-changed` after state transitions.

### Task 6: Telegram callback integration for race claim

**Files:**
- Modify: `server/index.js`

**Interfaces:**
- Consumes: claim logic from Task 4.

- [ ] Add race inline button payload in race notifications.
- [ ] Handle callback (`raceclaim:<leadId>`) via shared claim service.
- [ ] Return user-friendly callback responses (claimed / already claimed / no permission).

### Task 7: Verification

**Files:**
- Modify if needed: `src/App.jsx`, `server/index.js`, `scripts/vps-update.sh`

- [ ] Run local build: `npm run build`.
- [ ] Manual API verification checklist:
  - Create race project with ordered teams.
  - Verify manager race claim and manager visibility updates.
  - Verify team offer + team claim path.
  - Verify full timeout fallback to manual pool.
- [ ] Ensure legacy `log` mode project behavior remains unchanged.
- [ ] Update deploy/version marker if needed.
