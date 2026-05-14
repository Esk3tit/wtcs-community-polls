---
phase: 11-schema-rls-ef-foundations
plan: 04
subsystem: testing
tags:
  - testing
  - integration
  - vitest
  - rls
  - audit
  - supabase

# Dependency graph
requires:
  - phase: 11-schema-rls-ef-foundations
    provides: "Plan 00 (e2e/integration/helpers.ts + scaffolds), Plan 01 (migration 10 — applied by Plan 05), Plan 02 (toggle-results-visibility EF — deployed by Plan 05), Plan 03b (create-poll results_hidden extension — deployed by Plan 05)"
provides:
  - "TEST-11 12-cell vote_counts RLS invariant matrix (no it.todo / it.skip / it.only) — primary P0 merge-blocker defense against pre-aggregated-vote-count leakage"
  - "Admin-JWT direct-read regression sentinel for vote_counts (REVIEW-FIX-M7/C2-H5) — provably fails if a regression re-introduces `is_current_user_admin() OR ...` in the SELECT policy"
  - "TEST-12 toggle-results-visibility EF authz + audit suite (7 cases): 403 with no side effect, 200 with ISO-parseable timestamp, audit row on state change, NO audit row on no-op (REVIEW-FIX-H4 conditional UPDATE), 400 for malformed body and invalid UUID, 404 for non-existent poll"
  - "Order-independent test design — fresh poll per case via beforeEach/afterEach (REVIEW-FIX-M6) eliminates inter-case dependency"
  - "create-poll results_hidden runtime evidence — 4 cases verifying response shape `{ success, id }`, choices string[] contract, 2-audit-row vs 1-audit-row split, strict-boolean 400 rejection, action-string lock on `results_hidden_set_at_create`"
affects:
  - "Plan 11-05 (deploy gate) — runs these three suites against a live Supabase target post-migration-10-apply + post-EF-deploy; the green run is the merge gate evidence"
  - "Future phases that touch vote_counts policy or create-poll EF — the suites here trip on any regression"

# Tech tracking
tech-stack:
  added: []  # Plan 00 already added vitest.config.integration.ts + helpers; no new tooling
  patterns:
    - "Order-independent integration test pattern: clients minted once in beforeAll (stateless), state-bearing fixtures (poll, audit_log rows) created per-case in beforeEach and torn down in afterEach"
    - "Regression-sentinel pattern: seed test state by a non-admin actor, read via admin JWT, assert 0-rows return — provably fails if an admin-OR-bypass regresses into a row-level security policy"
    - "Live-EF contract-locking via assertion: response shape `{ success: true, id: pollId }` (not `{ poll: <row> }`) and choices `string[]` (not `{text}[]`) are enforced by the typecasts — any future drift trips these tests"

key-files:
  created:
    - "e2e/integration/create-poll-results-hidden.test.ts — 4 cases covering Plan 11-03b's results_hidden=true/false/omitted/string-coercion paths"
  modified:
    - "e2e/integration/vote-counts-rls.test.ts — 12 it.todo → 12 real it bodies (describe.each matrix) + 1 admin-JWT direct-read regression sentinel"
    - "e2e/integration/toggle-results-visibility.test.ts — 4 it.todo → 7 real it blocks (4 happy + 3 negative); beforeEach/afterEach fresh-poll-per-case"

key-decisions:
  - "TEST-11 matrix cells use seedBaseline=true (default) so service-role cells observe real vote_counts rows — without the seed those 4 cells would silently return 0 from an empty source (false-green resolution per REVIEW-FIX-H2)"
  - "Admin-JWT sentinel uses seedBaseline=false paired with explicit castVote keyed on memberUser.id — without that pairing vote_counts would be empty and the assertion would trivially pass (REVIEW-FIX-C2-H5 false-negative resolution)"
  - "TEST-12 uses beforeEach/afterEach instead of beforeAll/afterAll — eliminates implicit case ordering dependency (REVIEW-FIX-M6); audit_log rows DELETEd explicitly in afterEach because audit_log.target_id has no FK to polls.id (no cascade)"
  - "TEST-12 Case 4 (no-op) seeds the hidden=true precondition via a service-role direct UPDATE rather than running the EF first — keeps the no-op audit-row assertion noise-free"
  - "create-poll test reads result.data.id (NOT result.data.poll.id) and verifies the resulting row via service-role SELECT — locks the live EF response shape per supabase/functions/create-poll/index.ts:189 (REVIEW-FIX-C2-H6)"
  - "create-poll test sends choices: ['option-a', 'option-b'] (string[]) — locks the live EF choices contract per supabase/functions/create-poll/index.ts:88-97 (REVIEW-FIX-C2-H6)"

patterns-established:
  - "Order-independent suite isolation: stateless clients minted in beforeAll, per-case state created in beforeEach and torn down in afterEach (including audit_log rows that don't cascade with their target poll)"
  - "Regression-sentinel test design: assert a false outcome on data seeded by a non-privileged actor while reading as a privileged one — failure case proves any future bypass would surface"
  - "Live-contract assertion via typecast: cast result.data to the exact shape the live EF returns; drift trips the type-narrowed property access at runtime"

requirements-completed: [VIS-05, TEST-11, TEST-12]

# Metrics
duration: ~25min
completed: 2026-05-11
---

# Phase 11 Plan 04: Integration Test Bodies Summary

**TEST-11 12-cell vote_counts RLS matrix + admin-JWT regression sentinel + TEST-12 toggle-results-visibility 7-case authz/audit suite + create-poll results_hidden 4-case audit-row suite — all bodies wired (no it.todo / it.skip / it.only), parsing/typecheck/lint green, runtime PASS gated to Plan 05's live-target deploy.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-11
- **Completed:** 2026-05-11
- **Tasks:** 3
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- **TEST-11 12-cell matrix wired** — `describe.each` produces 12 named cells; each runs a per-cell fresh poll → optional memberUser-keyed vote on option-b → role-scoped SELECT on `vote_counts`. Service-role cells observe baseline vote_counts rows (REVIEW-FIX-H2). Only `authed × hidden=false × voted=true` returns >0 rows.
- **Admin-JWT regression sentinel added** — seeds a vote_counts row keyed on memberUser.id and reads via an admin JWT; admin sees 0 rows in green. If a future regression adds `is_current_user_admin() OR ...` to the policy, admin would see memberUser's row and the assertion FAILS — REVIEW-FIX-H3 enforcement is now a real test, not a code-review artifact.
- **TEST-12 wired with 7 cases** — 4 happy-path (403 with no side effect, 200 with ISO-parseable `results_hidden_changed_at`, audit row on state change, NO audit row on no-op) + 3 negative (400 missing poll_id, 400 invalid UUID, 404 non-existent poll). Cases are order-independent (fresh poll per case via beforeEach/afterEach).
- **create-poll results_hidden suite created** — Plan 11-03b's `results_hidden=true` post-RPC UPDATE + dual-audit path now has runtime evidence: Case A (true → 2 rows), Case B (false → 1 row), Case C (omitted → DEFAULT false + 1 row), Case D (string 'true' → 400). The action-string `results_hidden_set_at_create` is locked.
- **No `it.todo` / `it.skip` / `it.only` remain in any of the 3 files** (verified via grep across all three files).

## Task Commits

Each task was committed atomically. No worktree (working directly on `gsd/phase-11-schema-rls-ef-foundations`).

1. **Task 04-01: TEST-11 12-cell RLS matrix + admin-JWT sentinel** — `2da285f` (test)
2. **Task 04-02: TEST-12 toggle-results-visibility 7 cases** — `43a35ee` (test)
3. **Task 04-03: create-poll results_hidden 4 cases (new file)** — `030558c` (test)

## Files Created/Modified

- **Created** `e2e/integration/create-poll-results-hidden.test.ts` — 4 it blocks covering Plan 11-03b's results_hidden EF path (true/false/omitted/string)
- **Modified** `e2e/integration/vote-counts-rls.test.ts` — replaced 12 `it.todo` with real `describe.each` bodies; added 1 admin-JWT direct-read sentinel `it` block outside the matrix
- **Modified** `e2e/integration/toggle-results-visibility.test.ts` — replaced 4 `it.todo` with 7 real `it` blocks (4 happy + 3 negative) using beforeEach/afterEach fresh-poll-per-case isolation

## Decisions Made

- **TEST-11 cells use seedBaseline=true (default).** Service-role cells expecting `>0` rows need a baseline vote_counts row that exists independent of the cell's voted state. Plan 00's `createFreshPoll` seeds adminUser → option-a; the cell-level `castVote` targets option-b (memberUser) so there's no collision. Without the baseline seed the 4 service-role cells would silently return 0 (REVIEW-FIX-H2 prior cycle finding).
- **Admin-JWT sentinel uses seedBaseline=false + explicit memberUser castVote.** The earlier draft used seedBaseline=false alone, which left vote_counts empty and made the assertion a false negative. The corrected pairing — service-role insert keyed on memberUser.id, then admin JWT reads vote_counts — produces a row that admin would see IF the policy regressed (REVIEW-FIX-C2-H5).
- **TEST-12 fresh poll per case via beforeEach.** Earlier plan drafts used a single shared poll from beforeAll; Case 3 (audit-row assertion) implicitly depended on Case 2 (toggle) having run. The new design is order-independent (REVIEW-FIX-M6).
- **TEST-12 Case 4 seeds hidden=true via service-role direct UPDATE.** Routing through the EF first would add a `results_hidden_toggled` audit row that the no-op assertion would then have to subtract from. The direct UPDATE keeps the no-op assertion clean: 0 audit rows means 0, not 0 = 1 - 1.
- **create-poll test asserts `result.data.id` (not `result.data.poll.id`).** The live EF returns `{ success: true, id: pollId }` per `supabase/functions/create-poll/index.ts:189`. The earlier plan draft assumed `{ poll: <row> }` and would have failed at runtime (REVIEW-FIX-C2-H6).
- **create-poll test sends `choices: string[]`.** Per the live RPC contract (`supabase/functions/create-poll/index.ts:88-97`); the earlier draft used `{ text }[]` which would 400 at the EF (REVIEW-FIX-C2-H6).

## Deviations from Plan

None — plan executed exactly as written. All three tasks landed with the exact case shapes, helper signatures, and assertions the plan body specified. The plan body anticipated runtime PASS would be gated to Plan 05 (which applies migration 10 and deploys EFs), so the "compile + enumerate + structural-grep" verification path used here matches the plan's verification contract.

## Issues Encountered

- **Local Supabase stack is running, but `audit_log` table does not exist yet (migration 10 unapplied) and Edge Functions runtime is stopped.** Verified via REST probe: `GET /rest/v1/audit_log?limit=0` returns PGRST205 "Could not find the table". This is expected — Plan 05's deploy gate applies migration 10 and starts the EF runtime. Runtime PASS deferred per the plan body's explicit gate: "runtime PASS may be deferred to Plan 05 / live link."
- **Acceptance-criterion grep for `from('polls').select(...results_hidden...)` uses single-line matching.** The actual code wraps query chains across lines (consistent with `helpers.ts` style). The intent — verify each create-poll case fetches `polls.results_hidden` via service-role SELECT — is satisfied: an awk multi-line check finds all 3 occurrences (Cases 1, 2, 3). The single-line grep variant would require an unusual single-line query chain that does not match the project's existing query-chain style. Recommend the verifier use the multi-line-aware check or accept this style consistency.

## User Setup Required

None — these are integration test files. Plan 05 handles the local-target setup (migration apply + EF deploy + `npm run test:integration` execution).

## Next Phase Readiness

- **Plan 05 (deploy gate)** can now run `npm run test:integration` against a live local Supabase target with migration 10 applied + EFs deployed. The suites compile and enumerate cleanly; the 24 test cases (12 + 1 + 7 + 4) are all primed.
- **Manual fault-injection deferred:** REVIEW-FIX-H5 (compensating DELETE on results_hidden=true post-RPC UPDATE failure) is hard to test without injecting an UPDATE failure. Documented inline in `create-poll-results-hidden.test.ts` as a known deferred item.
- **No blockers** — Phase 11 is execution-complete pending Plan 05's deploy gate.

## Self-Check: PASSED

- File `e2e/integration/vote-counts-rls.test.ts` — exists, modified, in commit `2da285f`
- File `e2e/integration/toggle-results-visibility.test.ts` — exists, modified, in commit `43a35ee`
- File `e2e/integration/create-poll-results-hidden.test.ts` — exists, created, in commit `030558c`
- `npm run lint` — exits 0
- `tsc -b` — exits 0
- `npx vitest list --config vitest.config.integration.ts` enumerates 24 cases (12 + 1 + 7 + 4)
- `grep -c "it\.todo"` across all 3 files: 0 / 0 / 0
- `grep -c "it\.skip"` across all 3 files: 0 / 0 / 0
- `grep -c "it\.only"` across all 3 files: 0 / 0 / 0

---
*Phase: 11-schema-rls-ef-foundations*
*Completed: 2026-05-11*
