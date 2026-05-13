---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: — Admin Visibility Controls
status: "Phase 12 shipped — PR #28"
stopped_at: Phase 12 UI-SPEC approved
last_updated: "2026-05-13T05:37:54.270Z"
last_activity: "2026-05-12 -- Phase 12 shipped (PR #28)"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 15
  completed_plans: 15
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-11 after v1.1 milestone)

**Core value:** Community members can share opinions on competitive scene proposals with confidence that results are authentic
**Current focus:** Phase 12 — admin-ui-user-ui-uidn-03-sweep

## Current Position

Phase: 12 — COMPLETE (Phase 13 next)
Plan: 8 of 8 (complete)
Status: Phase 12 shipped — PR #28
Last activity: 2026-05-12 -- Phase 12 shipped (PR #28)

```
v1.2 progress:  [█████████████░░░░░░░] 67% (Phase 11 ✅ Shipped, Phase 12 ✅ Shipped, Phase 13 next)
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

### Phase 11 — Decisions Landed (2026-05-11)

(Summary across all 7 plans; full details in each `11-NN-SUMMARY.md`.)

- **REVIEW-FIX-H3:** `vote_counts` policy has no `is_current_user_admin()` OR-branch — VIS-04 mandates service-role bypass only. Confirmed on prod via `execute_sql` qual check.
- **REVIEW-FIX-H4:** toggle-results-visibility uses race-safe conditional UPDATE (`.not('results_hidden','is',hidden)`). Postgres row-locking serializes concurrent flips; loser writes no audit row. Eliminates phantom-audit race.
- **REVIEW-FIX-H7:** Plan 05's local pre-merge gate uses `supabase db reset` ONLY (not `db push`). Production push runs in Task 05-02 step 2 after local-green.
- **REVIEW-FIX-H8:** All 13 EFs deploy with `verify_jwt: false` (matches existing prod pattern; EFs verify JWTs themselves via `requireAdmin`).
- **REVIEW-FIX-C3-H1:** `audit_log.target_id` declared `TEXT` (not `uuid`) — admits Discord snowflakes for `promote-admin` Branch 2; avoids `writeAudit` fail-open silent drop.
- **Pitfall 2:** `ALTER VIEW … SET (security_invoker = on)` re-applied in the same migration file immediately after `CREATE OR REPLACE VIEW`.
- **Migration version drift:** prod stamps via MCP-assigned timestamp; local file keeps sequential `00000000000010_results_hidden_audit.sql`. Matches the pre-existing migrations 5-9 pattern (local sequential vs prod timestamp).
- **Plan 05 deploy routing:** routed prod deploy through Supabase MCP (`apply_migration` + `deploy_edge_function`) rather than local `supabase` CLI. Eliminated `SUPABASE_ACCESS_TOKEN` and project-link prep steps.

### Tech Debt Surfaced (Not Phase 11 Caused)

- **Local supabase-edge-runtime ES256 verification bug** — 1.73.x rejects auth-service-issued ES256 JWTs ("Legacy token type detected, attempting HS256 verification"). Affects `npm run test:integration` against the local stack. Production runtime is unaffected (JWKS discovery). Plan 05 task 05-01 ran with partial pass; full Plan 04 test suite runs against prod via Phase 12 UAT.
- **7 pre-Phase-11 SECURITY DEFINER advisor warnings** on `update_profile_after_auth`, `handle_new_user`, `validate_vote_choice`, `increment_vote_count`, `is_current_user_admin`, `profile_self_update_allowed`, `rls_auto_enable`. WARN-level, predates v1.0. Track for v1.3+ hygiene phase.
- **PATTERNS.md drift:** `11-PATTERNS.md` still carries the legacy admin-OR-bypass form for the `vote_counts` policy skeleton. Plan body's REVIEW-FIX-H3 form is what shipped. Align in a future cleanup.

### Blockers/Concerns

None. Phase 12 is unblocked: the EF and audit_log surface needed for the admin UI is now live in prod.

## Session Continuity

Last session: 2026-05-12T09:09:57.593Z
Stopped at: Phase 12 UI-SPEC approved
Resume action: `/gsd-plan-phase 12` to begin Phase 12 (Admin UI + User UI + UIDN-03 Sweep) planning. Requirements: VIS-06, VIS-07, VIS-08, UIDN-03, TEST-13.
