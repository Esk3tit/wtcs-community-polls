---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Admin Visibility Controls
status: Wave 2 landed; _shared/audit.ts helper + toggle-results-visibility EF written and committed; deploy gate deferred to Plan 11-05
stopped_at: Phase 11 Plan 02 complete (Wave 2 — audit helper + toggle EF landed)
last_updated: "2026-05-11T22:41:15Z"
last_activity: 2026-05-11 -- Phase 11 Plan 02 complete (_shared/audit.ts + toggle-results-visibility EF; VIS-02 + VIS-03 implementation done, deploy in Plan 05)
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 7
  completed_plans: 4
  percent: 57
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-11 after v1.1 milestone)

**Core value:** Community members can share opinions on competitive scene proposals with confidence that results are authentic
**Current focus:** v1.2 — Admin Visibility Controls — Phase 11 Waves 0+1+2 complete; Wave 3 (Plan 11-03: 12-EF audit retrofit) next

## Current Position

Phase: 11 — Schema + RLS + EF Foundations
Plan: 02 complete — Wave 3 (Plan 11-03: 12-EF audit retrofit via writeAudit) ready next
Status: Wave 2 landed; `_shared/audit.ts` helper (Promise<void> fail-open contract) + `toggle-results-visibility` EF (race-safe conditional UPDATE, audit-on-state-change) committed; deploy gate deferred to Plan 11-05
Last activity: 2026-05-11 -- Phase 11 Plan 02 complete (_shared/audit.ts + toggle-results-visibility EF; VIS-02 + VIS-03 implementation)

```
v1.2 progress:  [██████░░░░░░░░░░░░░░] 17% (Phase 11: 3/5 plans complete)
```

## Accumulated Context

Decisions and project history are now logged in PROJECT.md Key Decisions and MILESTONES.md.
v1.1 phase-level context lives in:

- `.planning/MILESTONES.md` — shipped accomplishments + key decision outcomes
- `.planning/milestones/v1.1-ROADMAP.md` — phase-by-phase scope and plans
- `.planning/milestones/v1.1-REQUIREMENTS.md` — v1.1 requirement set with traceability
- `.planning/milestones/v1.1-MILESTONE-AUDIT.md` — cross-phase integration verification + tech debt log
- `.planning/phases/0[7-a]-*/` — raw execution history per v1.1 phase

### Decisions

Recent decisions are in PROJECT.md Key Decisions table with outcomes (✓ Good / ⚠️ Revisit / — Pending).

Two Key Decision rows remain ⚠️ pending v1.2 closure:

- `Mobile-first responsive design` — UIDN-02 closure (Phase 13)
- `shadcn/ui new-york + Tailwind CSS v4` — UIDN-03 closure (Phase 12)

### v1.2 Open Questions (resolve before Phase 11 plan-phase)

Per research SUMMARY gaps section:

1. Does the anon role (unauthenticated visitors) see results when `results_hidden = false`, or only authenticated voters? REQUIREMENTS.md VIS-04 specifies voters-only — the `vote_counts` RLS policy grants SELECT iff `auth.uid()` has cast a vote AND `results_hidden = false`. Non-voters never see results regardless of state. **Resolved 2026-05-11 (Plan 11-01):** new policy is scoped `TO authenticated`, anon has no granting policy → 0 rows by absence. Plan 11-04 12-cell matrix verifies.
2. Does `requireAdmin` in `_shared/admin-auth.ts` call the updated `is_current_user_admin()` (migration 9 guild_member gate)? Read at Phase 11 start; flag if stale.
3. Does `polls_effective` in the current migration use explicit columns or `SELECT *`? Read migration DDL at Phase 11 start before writing migration 10. **Resolved 2026-05-11 (Plan 11-01):** migration 5 uses explicit 15-column form (verified at `supabase/migrations/00000000000005_admin_phase4.sql:12-31`). Migration 10 preserves that form and appends `results_hidden, results_hidden_changed_at` at the end.

### Plan 11-01 Decisions Landed (2026-05-11)

- **REVIEW-FIX-H3:** vote_counts policy has no `is_current_user_admin()` OR-branch — VIS-04 mandates service-role bypass only. PATTERNS.md skeleton (with OR-branch) was superseded by the plan body's strict reading.
- **REVIEW-FIX-C3-H1:** `audit_log.target_id` declared `TEXT` (not `uuid`) — admits Discord snowflakes for `promote-admin` Branch 2; avoids `writeAudit` fail-open silent drop.
- **Pitfall 2:** `ALTER VIEW … SET (security_invoker = on)` re-applied 23 lines after `CREATE OR REPLACE VIEW` in the same migration file.
- **Pitfall 6:** `audit_log` indexes cover `(target_type, target_id)` + `(actor_id, created_at DESC)` — no JSONB indexes.

### Plan 11-02 Decisions Landed (2026-05-11)

- **REVIEW-FIX-H4:** chose race-safe conditional UPDATE (`.not('results_hidden','is',hidden)`) over read-then-update. Postgres row-locking serializes concurrent flips; loser sees 0 rows and writes no audit row. Eliminates Codex HIGH phantom-audit race.
- **D-13 refinement:** `results_hidden_changed_at` updated only on actual state changes (guarded by conditional UPDATE's WHERE clause). Per Gemini review — original "update every call" obscured the actual last-change time.
- **Pitfall 3 enforced:** `writeAudit` is NEVER wrapped in try/catch at call site. Helper's fail-open contract (console.error + return on insert failure) is the contract; wrapping would silence what the helper deliberately surfaces.
- **VIS-03 + ROADMAP SC-3:** response shape is `{poll: <full row>}` on both state-change and no-op paths — admin UI can refresh card state without a follow-up SELECT.

### Blockers/Concerns

None. All three v1.2 phases have sufficient research detail to proceed directly to plan-phase without additional `/gsd-research-phase` runs (confirmed by all 4 research agents).

**P0 callout for Phase 11:** The 12-cell RLS invariant matrix test suite is a hard merge blocker. No room for "fix in Phase 12." RLS leakage at the `vote_counts` layer would expose pre-aggregated vote counts to non-voters through the Supabase anon key.

## Session Continuity

Last session: 2026-05-11T22:41:15Z
Stopped at: Phase 11 Plan 02 complete (Wave 2 — _shared/audit.ts + toggle-results-visibility EF landed; commits 5d53301, 1772fe8)
Resume action: `/gsd-execute-phase 11` to continue Phase 11 (Wave 3: Plan 11-03 12-EF audit retrofit)
