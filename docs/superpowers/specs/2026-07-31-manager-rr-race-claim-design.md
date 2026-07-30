# Manager Round-Robin Race Claim — Design

**Date:** 2026-07-31  
**Status:** Approved for implementation planning  
**Approach:** Evolve existing `race` mode (Approach 1)  
**Parent:** [Lead Race Distribution design](./2026-07-29-lead-race-distribution-design.md)

## Summary

Change the **manager step** of project `race` mode from “notify all managers, first claim wins” to **round-robin offer to one manager at a time**, with two timers:

1. **5 minutes** to confirm receive (`manager_race`)
2. After confirm: **10 minutes** to leave meaningful customer feedback (`manager_feedback`)

| Outcome | Next step |
|---------|-----------|
| No confirm in 5m | Fall through to **team offer** (existing team RR) |
| Confirmed, no feedback in 10m | Fall through to **team offer** |
| Confirmed + meaningful feedback | Stay with that manager (`claimed`); manager assigns sales manually |

Mode `log` and the team RR / manual pool stages are unchanged.

## Goals / Non-goals

### Goals
- Distribute new race leads to project managers in order (A → B → C → A…).
- Give the offered manager ~5 minutes to claim.
- After claim, give ~10 minutes to feedback; feedback locks the lead to that manager.
- On miss (no claim or no feedback): hand off to teams like today’s timeout path.
- Notify only the offered manager during the manager offer window.
- Strip stale Telegram claim buttons when the stage advances.

### Non-goals
- Changing team offer duration (still 10 minutes per team) or team claim semantics.
- Changing `log` mode manager assignment.
- Auto-assigning sales under a manager after they keep the lead.
- Feedback-rate ranking between teams (still Phase 2 of original race design).

## Decisions locked with product

1. **Approach:** Evolve existing `race` mode (not a new mode).
2. **No claim in 5m → team** (same fallthrough as today’s manager timeout).
3. **Claimed but no feedback in 10m → team** (product choice A).
4. **After feedback:** manager keeps lead and **manually assigns sales** (product choice A).
5. **Offer target:** exactly one manager per lead at a time, via project cursor.

## Flow

```
Sync new lead (distribution_mode = race)
    │
    ▼
Soft-assign manager_name = next manager (race_manager_cursor++)
race_stage = manager_race
deadline = now + 5m
Notify ONLY that manager (app + Telegram)
    │
    ├─ timeout / no claim ──────────────────────────────► team_offer (existing)
    │
    └─ manager claims
           race_stage = manager_feedback
           deadline = now + 10m
           race_claimed_by / claimed_at set
           Notify: “còn 10 phút feedback”
                │
                ├─ meaningful feedback from that manager
                │     race_stage = claimed
                │     clear race_deadline
                │     manager keeps lead; assigns sale manually
                │
                └─ timeout no feedback ─────────────────► team_offer (existing)
                     clear / move off exclusive manager hold as needed
```

Background job (same cadence as current `processLeadRace` / instant SLA):

- Expire `manager_race` → `transitionLeadToTeamOffer`
- Expire `manager_feedback` → `transitionLeadToTeamOffer` (and notify manager recall / strip Telegram msgs)

Claim remains available immediately via API / Telegram (does not wait for the job).

## Data model

### `projects` (new)
| Column | Type | Notes |
|--------|------|-------|
| `race_manager_cursor` | INTEGER DEFAULT 0 | Next manager index for RR offers |

Reuse existing `mgr_assign_idx` only for `log` mode — keep cursors separate to avoid cross-mode interference.

### `leads` (stage values)
| `race_stage` | Meaning |
|--------------|---------|
| `manager_race` | Waiting for offered manager to confirm (5m) |
| `manager_feedback` | **New** — manager claimed; waiting for feedback (10m) |
| `team_offer` | Existing team RR |
| `claimed` | Held (manager after feedback, or team after team claim) |
| `manual_pool` | Existing |

Existing columns reused: `manager_name`, `race_started_at`, `race_deadline_at`, `race_claimed_by`, `race_claimed_at`, `instant_sla_accepted_at`.

No new lead columns required if deadlines stay on `race_deadline_at` and stage encodes which timer applies.

## Behavior details

### Manager list
Same query as today: project users with role `manager` or `admin` on `user_projects`, ordered stably (e.g. by `u.id ASC`). Empty list → skip manager step and go straight to team offer (or manual pool if no teams).

### Soft-assign on offer
On entering `manager_race`:
- Set `manager_name` to the offered manager’s `display_name`
- Clear `sale_name` / `team_id` as today for new race leads
- Advance `projects.race_manager_cursor`

Visibility: only that manager (plus admin) should act on the claim banner; other managers must not see an actionable “claim this race lead” for leads not offered to them.

### Claim (`manager_race` → `manager_feedback`)
- Caller must be the offered manager (or admin)
- Set `race_stage = manager_feedback`
- Set `race_claimed_by`, `race_claimed_at`, refresh `race_started_at` / `race_deadline_at = now+10m`
- Set `instant_sla_accepted_at` (receive confirmed)
- History: e.g. `Race claim quản lý`
- Notify claimer: 10 minutes to feedback

### Meaningful feedback
Reuse `isMeaningfulFeedbackHistoryRow` / team-aware feedback helpers where possible, scoped to the claiming manager’s `display_name` after claim time / min seq after claim history row.

On success:
- `race_stage = claimed`
- Clear `race_deadline_at` (no further race fallthrough)
- Keep `manager_name`
- Do **not** auto-set `sale_name` (manager assigns later)

### Timeout → team
Both manager timeouts call the existing team transition:
- Delete tracked Telegram lead messages for the manager offer
- Notify manager that lead moved to team race
- `transitionLeadToTeamOffer` (team cursor, 10m, member notifications)

If no teams configured → existing `manual_pool` path.

### Instant SLA interaction
- While `manager_race` or `manager_feedback`, exclude from sale/team instant SLA recall (extend today’s “skip open race stages” list to include `manager_feedback`).
- After `claimed` by manager with feedback, normal assignment/SLA rules apply only once a sale/team is assigned (unchanged product: manager holds until they chia sale).

### Telegram / push
- Offer: only offered manager (not blast all managers).
- After claim: confirmation + 10m feedback reminder (claimer only).
- On team fallthrough: strip buttons / delete tracked msgs; short notice to manager; team members get existing team offer messages.
- Late click on old claim button: friendly “đã chuyển team / hết hạn” (same spirit as team teammate notify).

## API / UI

### API
- Extend `POST /api/leads/:id/race-claim` (and Telegram `raceclaim` / `ack` when stage is open):
  - `manager_race`: claim → enter `manager_feedback`
  - `manager_feedback`: not a second claim; optional no-op or point user to update status
- Ensure feedback endpoints (app history + Telegram status) detect manager_feedback completion and flip to `claimed`.

### UI
- Manager banner on offer: “Xác nhận nhận lead · còn Xm” (5m window)
- After claim: banner “Còn Xm để cập nhật trạng thái” **without** requiring a second receive button
- Other managers: no claim CTA for this lead
- Team banners unchanged

## Migration / rollout
- DB: add `race_manager_cursor` (default 0) on `projects`.
- Existing leads stuck in old all-managers `manager_race`: on deploy, either leave until deadline then team-offer as today, or one-time job soft-assign using cursor — prefer **leave until natural timeout** to avoid surprising reassignment mid-window.
- Document for ops: race mode behavior change for managers (no more free-for-all claim).

## Testing (acceptance)

1. Project with managers A,B and teams: lead1 → A only notified; lead2 → B only.
2. A ignores 5m → team offer starts; A’s Telegram claim UI removed/disabled.
3. A claims within 5m → stage `manager_feedback`, 10m deadline; A can update status.
4. A feedbacks within 10m → `claimed`, stays on A; no team offer; A can chia sale.
5. A claims then no feedback 10m → team offer.
6. `log` mode projects unchanged.
7. No managers on project → team offer (or manual pool) without hanging in `manager_race`.

## Implementation notes (for plan)

- Touch primarily `server/index.js` (`syncProject` race branch, `processLeadRace`, `claimLeadRace`, feedback save paths, Telegram webhook) and manager banners in `src/App.jsx`.
- Constants: keep `MANAGER_RACE_MS = 5m`; add `MANAGER_FEEDBACK_MS = 10m`.
- Bump `BUILD_VERSION` on ship.
