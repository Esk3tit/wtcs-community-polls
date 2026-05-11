---
phase: 11-schema-rls-ef-foundations
plan: 02
subsystem: api
tags: [edge-function, audit, supabase, admin, deno, results-hidden]

# Dependency graph
requires:
  - phase: 11-schema-rls-ef-foundations
    provides: "Plan 11-01 — audit_log table + polls.results_hidden columns + vote_counts RLS rewrite (migration 10)"
provides:
  - "_shared/audit.ts — writeAudit helper used by 13 admin emitter EFs in Plan 11-03 retrofit"
  - "toggle-results-visibility EF — admin-gated, race-safe results_hidden flipper with audit"
affects:
  - 11-03-retrofit-existing-efs   # 12 EFs gain a one-line writeAudit call
  - 11-04-integration-tests       # TEST-12 asserts EF response + audit row
  - 11-05-deploy-and-verify       # supabase functions deploy toggle-results-visibility
  - 12-admin-ui                   # admin UI consumes 200 {poll: ...} response shape

# Tech tracking
tech-stack:
  added: []  # no new packages — reuses pinned @supabase/supabase-js@2.101.1
  patterns:
    - "writeAudit(supabaseAdmin, entry): Promise<void> — fail-open audit helper"
    - "Race-safe conditional UPDATE via supabase-js .not('col','is',value) — replaces read-then-update for idempotent state-flip endpoints"

key-files:
  created:
    - supabase/functions/_shared/audit.ts
    - supabase/functions/toggle-results-visibility/index.ts
  modified: []

key-decisions:
  - "REVIEW-FIX-H4: chose race-safe conditional UPDATE (.not('results_hidden','is',hidden)) over the originally-planned read-then-update sequence — eliminates the Codex HIGH race where two concurrent same-direction toggles could both audit a phantom 'false → true'. Postgres row-locking serializes the conditional UPDATEs; the second writer matches 0 rows and emits no audit row."
  - "D-13 refinement: results_hidden_changed_at is now updated ONLY on actual state changes (guarded by the conditional UPDATE's WHERE clause). The original plan said 'update on every call'; Gemini's review correctly noted that obscured the actual last-change moment. New behavior matches what an admin UI wants to display."
  - "writeAudit is intentionally never wrapped in try/catch (Pitfall 3). The helper's fail-open contract (console.error + return on insert failure) is the audit-write contract — wrapping at the call site would silence what the helper deliberately surfaces."

patterns-established:
  - "Shared audit helper pattern: Promise<void> contract, console.error on failure, NEVER throws — callers MUST NOT wrap. Codified for Plan 11-03's 12-EF retrofit."
  - "Race-safe state-flip pattern: condition UPDATE on (current_value != target) + RETURNING + maybeSingle() for the change branch; follow-up SELECT only when 0 rows matched, to disambiguate no-op from 404."

requirements-completed: [VIS-02, VIS-03]

# Metrics
duration: 18min
completed: 2026-05-11
---

# Phase 11 Plan 02: _shared/audit.ts + toggle-results-visibility EF Summary

**Shared audit helper (Promise<void> fail-open contract) plus an admin-gated, race-safe `toggle-results-visibility` Edge Function that flips polls.results_hidden via a conditional UPDATE and emits an audit row only on actual state change.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-11T22:23Z (approx)
- **Completed:** 2026-05-11T22:41Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 0

## Accomplishments
- `supabase/functions/_shared/audit.ts` — 37-line helper, exports `writeAudit` + `AuditEntry`, never throws (logs to console.error on INSERT failure), pinned esm.sh @supabase/supabase-js@2.101.1 import matching admin-auth.ts.
- `supabase/functions/toggle-results-visibility/index.ts` — 120-line EF, mirrors pin-poll skeleton with four deltas: (1) race-safe conditional UPDATE via `.not('results_hidden','is',hidden)`, (2) 0-row distinguishes no-op-200 from missing-404 via follow-up SELECT, (3) audit row written only on state change, (4) full poll row returned in `{poll: ...}` response.
- Admin gate via existing `requireAdmin` + `adminCheckResponse` — no signature change.
- Strict input validation: UUID regex for poll_id, `typeof === 'boolean'` for hidden (no truthy coercion).
- WHY-only source comments — no review-round / plan-ID / D-XX archaeology in either file.

## Task Commits

1. **Task 02-01: Shared audit helper (_shared/audit.ts)** — `5d53301` (feat)
2. **Task 02-02: toggle-results-visibility Edge Function** — `1772fe8` (feat)

_Plan-metadata commit will follow this SUMMARY._

## Files Created/Modified
- `supabase/functions/_shared/audit.ts` — Shared audit helper (writeAudit + AuditEntry); fail-open contract; 37 lines.
- `supabase/functions/toggle-results-visibility/index.ts` — Admin-gated EF; race-safe conditional UPDATE; audit-on-state-change; 120 lines.

## Decisions Made
- **REVIEW-FIX-H4 default:** chose the PostgREST `.not('results_hidden','is',hidden)` form over an RPC SECURITY DEFINER fallback. `polls.results_hidden` is `NOT NULL DEFAULT false` in migration 10 so `NOT (col IS hidden)` and `col IS DISTINCT FROM hidden` produce identical results. If a future supabase-js version changes `.not()` semantics, Plan 01 will gain a `toggle_results_hidden_if_changed` SQL function and this EF will switch to `rpc()` — current behavior covered by Plan 04 TEST-12 integration test.
- **Audit `before` synthesized from `!hidden`:** the conditional UPDATE only matches rows where `results_hidden != hidden`, so the prior value is guaranteed to be `!hidden`. No pre-read needed to populate the `before` field.
- **Response shape `{poll: ...}` on both success paths** (state-change and no-op) — deliberate deviation from pin-poll's `{success: true}` minimal response. The full poll row lets the Phase 12 admin UI refresh card state without a follow-up SELECT.

## Deviations from Plan

**None directly executed against the plan body** — both tasks landed exactly as specified. One in-process adjustment worth noting:

- **Line count trim (Task 02-02):** initial draft was 121 lines; acceptance criteria caps at `≤120`. Collapsed one comment line (race-safe UPDATE rationale) from 4 lines to 3 without information loss. Final file is exactly 120 lines.

## Issues Encountered
- `ugrep` (the system's `grep` alias) rejected the escaped underscore `\_` in one of the plan's automated verification regexes. The import is present (`import { writeAudit } from '../_shared/audit.ts'`) and was verified with a simpler grep. No code change required; only the verification command changed for the local re-check.

## Open Follow-ups
- **Deploy gate (Plan 11-05):** VIS-02 is implementation-complete but not yet deploy-complete. `supabase functions deploy toggle-results-visibility` is owned by Plan 05, not this plan.
- **Runtime assertion (Plan 11-04):** the EF body is unit-test-free in this plan by design. Plan 04 TEST-12 (Vitest integration) asserts the 200 / 403 / 404 / 400 paths, the audit row presence on state-change, and the audit row ABSENCE on no-op (D-11). No assertions live in Plan 02 itself.
- **Plan 11-03 retrofit:** 12 existing admin EFs (close-poll, create-poll, pin-poll, etc.) gain a `writeAudit` call after their UPDATE / INSERT / DELETE success path. The helper is ready; the call-site retrofits are Plan 03's scope.

## User Setup Required
None — no new env vars, no new external services. Deploy to production is gated on Plan 11-05.

## Next Phase Readiness
- Wave 2 (this plan) complete; the shared audit helper unblocks Plan 11-03's 12-EF retrofit in Wave 3.
- The race-safe state-flip pattern documented in `key-decisions` is reusable: any future EF that needs an idempotent boolean flip can copy this skeleton.
- ROADMAP SC-3 + SC-5: foundation laid (EF body correct; deploy + runtime verification remain in Plans 04 + 05).

## Self-Check

- [x] `supabase/functions/_shared/audit.ts` exists (37 lines, ≤50 cap)
- [x] `supabase/functions/toggle-results-visibility/index.ts` exists (120 lines, ≤120 cap)
- [x] Commit `5d53301` (Task 02-01) present on branch
- [x] Commit `1772fe8` (Task 02-02) present on branch
- [x] `npm run lint` clean
- [x] `npm run test` — 389/389 passing
- [x] Pre-commit `tsc -b --noEmit` clean on both commits
- [x] No review-round / D-XX / plan-ID archaeology in either source file
- [x] writeAudit call in EF is NOT wrapped in try/catch
- [x] Audit gated on `changed !== null` (state actually changed)

## Self-Check: PASSED

---
*Phase: 11-schema-rls-ef-foundations*
*Completed: 2026-05-11*
