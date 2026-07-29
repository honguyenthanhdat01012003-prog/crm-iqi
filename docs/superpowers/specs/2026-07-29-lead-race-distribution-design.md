# Lead Race Distribution (Điều hướng chia lead) — Design

**Date:** 2026-07-29  
**Status:** Approved for Phase 1  
**Approach:** State machine on lead + background job (Approach 1)

## Summary

Add a second project-level lead distribution mode alongside the existing “chia lead log” flow.

| Mode | Behavior |
|------|----------|
| `log` (default) | Current flow: round-robin assign `manager_name` on sync; managers manually assign sales. |
| `race` (new) | New leads enter a manager claim race (5 min), then team round-robin offers (10 min each), then fall back to manual pool. |

Existing projects stay on `log` unless an admin explicitly switches them.

**Out of scope for Phase 1:** Case 3 (prefer teams by feedback speed/stability). That becomes Phase 2 after Phase 1 ships.

## Goals / Non-goals

### Goals
- Let admin choose distribution mode when creating/editing a project.
- Let admin attach ordered teams to a `race` project.
- Race new leads among project managers for 5 minutes; first claim wins.
- If no manager claims, offer lead to teams in order; each team has 10 minutes.
- Team claim sets `team_id` + `sale_name` = team leader; team members still see the lead per existing team visibility rules.
- If all teams fail to claim, put lead in unassigned/`manual_pool` and notify admin/managers.
- Notify via CRM app (web/iOS) and Telegram.

### Non-goals (Phase 1)
- Feedback-rate ranking between teams (Case 3).
- Changing the existing `log` round-robin manager assignment algorithm.
- Auto-assigning sales under a manager after manager claim (manager still assigns manually — option A).

## Decisions locked with product

1. **MVP scope:** Phase 1 = mode picker + project teams + manager race + team RR (no Case 3).
2. **Manager claim outcome:** Set `manager_name` to claimer; manager assigns sales later (like today).
3. **Team claim outcome:** Set `team_id` + `sale_name` = team **leader**; other members still see lead via current team rules.
4. **All teams timeout:** Move to unassigned/`manual_pool` for admin/manager manual handling + notifications.
5. **Existing projects:** Keep `log` by default.
6. **Architecture:** Lead race state machine + periodic server job (same pattern as instant SLA).

## Architecture

```
Sync new lead
    │
    ├─ project.distribution_mode = log  → existing manager RR
    │
    └─ project.distribution_mode = race
           → race_stage = manager_race
           → deadline = now + 5m
           → notify all project managers
                    │
         ┌──────────┴──────────┐
         │ claim by manager A  │ timeout
         ▼                     ▼
   claimed (manager A)   next team offer (RR)
                         race_stage = team_offer
                         deadline = now + 10m
                         notify team members
                              │
                   ┌──────────┴──────────┐
                   │ sale claims         │ timeout
                   ▼                     ▼
             claimed (team +        next team /
             leader as sale_name)   if last → manual_pool
```

Background job runs every ~30–60s (same style as `instant-sla`):
- Find leads where `race_deadline_at` ≤ now and stage is open.
- Advance stage / rotate team / enter `manual_pool`.
- Emit push + Telegram + `data-changed`.

Claim is also possible immediately via API / Telegram callback (does not wait for the job).

## Data model

### `projects`
- `distribution_mode TEXT NOT NULL DEFAULT 'log'` — values: `log` | `race`

### `project_teams` (new)
| Column | Type | Notes |
|--------|------|-------|
| `project_id` | INTEGER NOT NULL | FK projects |
| `team_id` | INTEGER NOT NULL | FK teams |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | RR order (0-based or 1-based, consistent in code) |
| PRIMARY KEY | `(project_id, team_id)` | |

Saving a project in `race` mode requires ≥ 1 row in `project_teams`.

### `leads` (new race columns)
| Column | Type | Notes |
|--------|------|-------|
| `race_stage` | TEXT DEFAULT '' | `manager_race` \| `team_offer` \| `claimed` \| `manual_pool` \| `''` |
| `race_started_at` | TEXT DEFAULT '' | VN/ISO timestamp when current stage started |
| `race_deadline_at` | TEXT DEFAULT '' | When stage expires |
| `race_team_id` | INTEGER | Team currently offered (`team_offer` only) |
| `race_claimed_by` | TEXT DEFAULT '' | Display name of claimer (audit) |
| `race_claimed_at` | TEXT DEFAULT '' | Claim timestamp |
| `race_team_index` | INTEGER DEFAULT 0 | Index into project_teams for current offer |

Project-level RR cursor for “next new lead starts at which team” lives on `projects` (recommended):

- `race_team_cursor INTEGER DEFAULT 0` — advances when a lead **enters** team_offer for the first time after manager timeout (so lead1→team1, lead2→team2, …).

### Sync preservation
Race columns and assignments must survive Google Sheets sync the same way `sale_name` / `manager_name` are protected (do not wipe mid-race state).

## Visibility rules

| Stage | Admin | Managers of project | Sales |
|-------|-------|---------------------|-------|
| `manager_race` | See | All see | Hidden |
| `claimed` (by manager) | See | Only assigned manager | Hidden until manager assigns sale/team |
| `team_offer` (team X) | See | All project managers can see (oversight only; cannot claim as manager in this stage) | Only members of team X |
| `claimed` (by team) | See | If `manager_name` set, that manager; else managers of project for oversight | Team members via `team_id` (existing rule); `sale_name` = leader |
| `manual_pool` | See | All project managers | Hidden |

**Important:** After manager A claims, managers B/C/D must not see the lead in their CRM list / iOS / Telegram offer UI. They receive a “another manager claimed” notification.

## Claim APIs (Phase 1)

- `POST /api/leads/:id/race-claim` — auth required.
  - Manager in `manager_race` → claim as manager.
  - Sale in offered team during `team_offer` → claim as team (sets leader as `sale_name`).
  - Idempotent failure if already claimed / wrong role / wrong stage.
- Telegram inline callback (e.g. `raceclaim:<leadId>`) mirrors the same server logic.

Response should return updated lead payload + clear error messages in Vietnamese.

## Notifications

| Event | Recipients | Channels |
|-------|------------|----------|
| Enter `manager_race` | All project managers | Push + Telegram |
| Manager claimed | Other managers | Push + Telegram (“Quản lý X đã nhận lead”) |
| Enter `team_offer` | Members of offered team | Push + Telegram |
| Team claimed | (optional) other teams / managers — keep minimal in Phase 1 | Push optional |
| Enter `manual_pool` | Admin + project managers | Push + Telegram |

## UI

### Project create/edit (admin)
- Radio / segmented control: **Chia lead log** | **Điều hướng race**
- If `race`: panel **Team tham gia luân chuyển**
  - Multi-select existing teams
  - Reorder (up/down)
  - Block save if zero teams

### Lead list / detail
- Banner with countdown + **Xác nhận nhận lead** when user is eligible claimer.
- After claim: show claimed badge (manager name or team + leader).

Reuse UX patterns from instant SLA “Đã nhận lead”.

## Background job details

- Interval: 30–60 seconds (align with existing timers; prefer ~30s for 5/10 minute SLAs).
- Query: leads with `race_stage IN ('manager_race','team_offer')` and `race_deadline_at` not empty and past now.
- Transitions:
  1. `manager_race` expired → pick team at `projects.race_team_cursor`, set `team_offer`, bump cursor, notify team.
  2. `team_offer` expired → next team by `sort_order`; if none left → `manual_pool`, clear sale/team assignment, notify admin/managers.
- Skip locked / booked leads.
- Log transitions to `lead_history` for audit (`action` such as `Race: manager timeout`, `Race: team offer`, `Race: claim`, `Race: manual pool`).

## Edge cases

- Project has zero managers: skip `manager_race`, go straight to `team_offer` (or `manual_pool` if no teams).
- Project has zero teams while mode=`race`: prevent save in UI; if data corrupted, new leads go to `manual_pool` + warn in logs.
- Concurrent claims: first successful DB update wins (`UPDATE ... WHERE race_stage=?`); loser gets friendly error.
- Sync during race: preserve race fields and empty `manager_name` until claimed (do not auto RR-assign managers for `race` projects).
- Switching project from `race` → `log`: new leads use log; in-flight race leads keep running until claimed/manual_pool (do not cancel mid-flight in Phase 1 unless admin forces — keep simple: leave in-flight as-is).

## Testing (Phase 1)

1. Create project `race` with 2 managers + 2 teams ordered.
2. Sync/inject lead → both managers notified; both see lead; sales do not.
3. Manager A claims → B loses visibility; B gets notify; `manager_name=A`.
4. Timeout manager race (or test with shortened deadline) → team 1 offered; team 1 sales see lead.
5. Sale in team 1 claims → `team_id` set, `sale_name=leader`; team 2 does not see.
6. Full timeout through both teams → `manual_pool`, unassigned, admin/managers notified.
7. Project on `log` unchanged from current behavior.
8. Cannot save `race` project without teams.

## Phase 2 (later)

Case 3: when rotating teams after timeouts, order by feedback speed/stability metrics instead of (or as a weighted overlay on) fixed `sort_order`.

## Implementation notes

- Prefer extending `server/index.js` patterns already used for instant SLA / Telegram callbacks rather than a new microservice.
- Keep filter changes in `buildLeadsSqlFilters` explicit for `race_stage` so sale/manager scopes stay correct.
- Bump `DB_VERSION` and `BUILD_VERSION` with migration for new columns/tables.
