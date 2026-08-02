# Multi-team auto-rotate keep + team-scoped history — Design

**Date:** 2026-08-02  
**Status:** Approved for implementation (2026-08-02)  
**Approach:** `lead_team_holders` table (Approach 1)  
**Related case:** Hoa Tran / `duybao` — auto-rotate took lead from team that already feedbacked

## Summary

Change **auto-rotate (xáo tự động)** on race/team projects so that:

1. If the **primary team already left meaningful feedback**, rotating adds the **next team** as a co-holder. The previous team **keeps** view + update rights. Primary switches to the newest team. UI tag for the new primary assign: **XÁO**.
2. If the **primary team never confirmed / never feedbacked**, rotate **fully revokes** them and assigns the next team only. UI tag: **NEW** (fresh assign semantics for the receiving team).
3. Within a holding team, members see **each other’s** feedback on that lead. **Different teams do not** see each other’s notes/history.

Telegram / “lead mới–xáo” notifications go only to the **primary (newest)** team.

## Goals / Non-goals

### Goals

- Multi-hold: prior feedback teams keep the lead; newest team becomes primary.
- Timer “>2 days no update” measured only on the **primary** team.
- XÁO vs NEW tagging as above.
- Team-scoped history: teammates share; cross-team history hidden for sale role.
- Clearer rotate log text (team **name** + id), e.g. `team T2 (#5)` instead of only `team#5`.

### Non-goals

- Changing SLA 10m / team 2h / race offer windows (except where NEW-path assign reuses existing assign+SLA hooks).
- Letting team B read team A’s private notes.
- Multi-primary Telegram blast to all co-holders on rotate.
- Per-team independent 2-day clocks (rejected in product chat).
- Admin/manager full history visibility change (admins still see everything).

## Decisions locked with product

| Topic | Decision |
|-------|----------|
| Keep model | **A** — co-holding teams all **see + update** the same lead |
| Primary | **Newest** team; Telegram assign/xáo → primary only |
| 2-day clock | Only **primary** team’s last update by its members |
| Tags | Prior feedback → **XÁO** + keep; no feedback → **NEW** + full revoke |
| History | **B** — sale sees only history from **their team’s members** on that lead |

### Defaults documented for NEW-path (confirm in review)

When previous primary had **no** meaningful feedback:

- Receiving team gets UI **NEW** (not XÁO), even if `created_at` is older than today.
- Assign semantics: reset `assigned_at`, `distribution_kind` suitable for “fresh” handoff (`manual` or dedicated kind — see Implementation notes).
- Apply the **same confirm + feedback SLA** the receiving team would get on a normal new team assign (team 2h after ack / overnight-to-10:00 rules unchanged).

If product wants NEW **badge only** without re-arming SLA, say so before implementation.

## Current behavior (problem)

`processAutoRotate` on race projects:

- Picks next team via `pickNextTeamForRotate`.
- Calls `buildLeadAssignTeamUpdateStmt` → **single** `team_id` / `sale_name`, **resets `status = new`**, drops previous team.
- Reason string uses `team#${id}` only → confusing (“team#5” vs display name “T2”).
- Having feedback earlier does **not** exempt the lead; only “last update by holder names older than threshold” matters, then **exclusive** reassignment.

Sale update permission (`saleCanUpdateLead`) is only current `team_id` / `sale_name` → previous team loses update after rotate.

## Target behavior

### Holders model

```
leads.team_id / sale_name / assigned_at / distribution_kind  → PRIMARY (newest)
lead_team_holders(lead_id, team_id, is_primary, joined_at, join_kind, ...)
```

- On multi-hold rotate (prior had feedback):  
  - Upsert next team as primary.  
  - Keep previous team rows with `is_primary = 0`.  
  - Do **not** wipe previous team’s right to see/update.  
  - Do **not** require resetting global lead `status` to `new` if the lead already has real status (prefer keep latest customer status; new primary still must ack/feedback per SLA rules for **their** cycle).
- On silent rotate (prior no feedback):  
  - Delete/disable previous holder rows for that lead.  
  - Primary = next team only.  
  - Tag/SLA as NEW-path above.

### Who can see the lead (sale list)

Sale sees lead if **any** of:

- `leads.sale_name` matches, or  
- `leads.team_id` is their team, or  
- their `team_id` ∈ `lead_team_holders` for that lead, or  
- existing race-offer / personal `lead_sale_summary` rules (unchanged where still relevant).

### Who can update

`saleCanUpdateLead`: allow if sale’s team is **primary or co-holder** on that lead (or name match / race manager rules as today).

### History visibility (sale)

When building history / detail for `role=sale`:

- Resolve viewer’s `team_id`.
- Include history rows whose `sale_name` matches a **member of that team** (and optionally system rows needed for UX: e.g. “Chia lead” that assigned **their** team).
- Exclude other teams’ “Cập nhật” / notes / statuses.
- Admin / manager: full history.

### Auto-rotate algorithm (race + team projects)

For each candidate lead (same exclusions as today: not booked/closed/locked/scheduled-kind, etc.):

1. Resolve **primary** team (from `leads.team_id` / holders).
2. Compute last update among **primary team member names** only (not co-holders).
3. If age < threshold → skip.
4. `hasMeaningfulFeedback` for primary team in current primary cycle?  
   - **Yes** → multi-hold add next team; `distribution_kind = rotate` (XÁO); notify **new** primary only; log with team **names**.  
   - **No** → revoke primary (+ clear holders); assign next only; NEW-path; notify new primary; log clearly.

Non-race / sale-only rotate path: out of scope unless same product rule is requested later; this spec focuses on **team** rotate (the Hoa Tran case).

### UI tags

| Situation | Badge |
|-----------|--------|
| Multi-hold rotate to new primary (prior had feedback) | **XÁO** (`distribution_kind = rotate`, existing `isShuffleTaggedLead`) |
| Silent revoke → new primary | **NEW** — extend client `isNewTaggedLead` (and server SLA eligibility) so this assign counts as NEW for the receiving team |
| Created today (unchanged) | **NEW** |

### Logging

Replace `team#5` with e.g. `team T2 (#5) không cập nhật >2 ngày → team T4 (Quang/…)`.

## Data model

```sql
CREATE TABLE IF NOT EXISTS lead_team_holders (
  lead_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT '',
  join_kind TEXT NOT NULL DEFAULT '',  -- rotate | manual | race | ...
  revoked_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (lead_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_lth_team ON lead_team_holders(team_id);
CREATE INDEX IF NOT EXISTS idx_lth_lead_primary ON lead_team_holders(lead_id, is_primary);
```

Backfill: for each lead with `team_id > 0`, insert one primary holder row.

## API / payload

- Lead JSON may include `holderTeamIds: number[]` and `primaryTeamId` for UI (“đang giữ cùng team …”) — optional phase 1 if list already works via filters.
- No change to public URL shape beyond existing lite/extras work.

## Risks / edge cases

- **Status column is single:** last writer wins on `leads.status`; history remains source of truth per team (filtered). Acceptable for v1.
- **All teams already held:** `pickNextTeamForRotate` already falls back to “others” / null — keep; if null, skip rotate.
- **Sale left team:** holders keyed by `team_id`; membership checked live via `users.team_id`.
- **Performance:** holder checks in SQL filters must stay indexed; avoid N+1 on list pages (join or `EXISTS`).

## Test plan (acceptance)

1. Team A feedbacks; wait/simulate >2d primary silence → Team B added; A still lists + can update; B is primary; badge **XÁO**; Telegram to B only.  
2. Team A never feedbacks; >2d → A gone from holders; B only; badge **NEW**; A cannot update.  
3. Within Team A, member 2 sees member 1’s notes; Team B does not see Team A’s notes.  
4. Admin sees full history.  
5. Rotate log shows team **names**.  
6. Primary B silence >2d → add C; A and B remain co-holders; clock based on B only.

## Implementation notes (for plan later)

- Touch: `processAutoRotate`, `buildLeadAssignTeamUpdateStmt` (or new multi-hold helper), `saleCanUpdateLead`, `buildLeadsSqlFilters`, history GET/format for sale, UI tag helpers, migration in `server/index.js`.
- Do not implement until this spec is reviewed OK and an implementation plan is written.

## Open confirmations for reviewer

- [x] NEW-path **re-arms** team/personal SLA for receiving team (default in this doc): OK  
- [x] On multi-hold rotate, **keep** existing `leads.status` (do not force `new`): OK  
- [x] Scope = **team/race auto-rotate only** in v1 (sale-only rotate unchanged): OK
