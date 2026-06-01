---
phase: 18-test-environment-repair
plan: 03
subsystem: testing
tags: [fault-injection, integration-tests, postgres-triggers, vitest, ci, seed-sql]
dependency_graph:
  requires:
    - phase: 18-01
      provides: local-gotrue-email-provider-enabled
    - phase: 18-02
      provides: four-way-cli-version-alignment
  provides:
    - fault-injection-ddl-title-scoped
    - integration-runner-serialized
    - create-poll-fault-branches-covered
  affects: [e2e/integration, supabase/functions/create-poll, ci]
tech_stack:
  added: []
  patterns:
    - title-scoped-db-fault-injection (test_fault_config keyed on poll title, not global UUID)
    - try-finally-disarm-plus-unconditional-afterEach-clear (two-layer fault cleanup)
    - audit-only-poll-id-resolution (target_id from poll_created row, not polls table)
key_files:
  created: []
  modified:
    - e2e/fixtures/seed.sql
    - e2e/integration/create-poll-results-hidden.test.ts
    - vitest.config.integration.ts
    - .github/workflows/ci.yml
key_decisions:
  - "Title-scoped fault rows (fault_title = poll title token) instead of global wildcard poll UUID — concurrent files with different titles are unaffected"
  - "Audit-only poll-id resolution in branch (a): poll_created row's target_id is the id, no polls lookup needed since the poll is absent after compensating DELETE"
  - "fileParallelism: false in vitest config — defense-in-depth alongside title-scoping; removes race window even if scoping were later relaxed"
  - "DROP TABLE IF EXISTS before CREATE TABLE — convergent re-seed replacing stale wildcard-shaped tables, not just idempotent"
  - "\\set ON_ERROR_STOP on in seed.sql + -v ON_ERROR_STOP=1 in both CI psql steps — fail-closed guard hardening per PostgreSQL psql semantics"
patterns-established:
  - "title-scoped-fault-injection: arm test_fault_config with unique poll title, trigger fires only for that title"
  - "two-layer-disarm: try/finally in test + unconditional afterEach clear, first statement before poll cleanup"
  - "audit-only-id-resolution: poll_created audit row target_id = pollId, filter by after->>'title' + created_at >= startedAt"
requirements-completed:
  - TEST-19
duration: ~25min
completed: "2026-06-01"
---

# Phase 18 Plan 03: Fault-Injection Test Coverage for create-poll UPDATE/DELETE Failures Summary

**Title-scoped BEFORE UPDATE/DELETE triggers on polls with try/finally disarm + audit-only poll-id resolution — create-poll-results-hidden.test.ts now reports 6 passed (0 failed), closing the fault-injection test gap.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-01T22:25:00Z
- **Completed:** 2026-06-01T22:40:00Z
- **Tasks:** 3 auto + 1 gate
- **Files modified:** 4

## Accomplishments

- Added `test_fault_config` table + BEFORE UPDATE/DELETE triggers on `polls` to `e2e/fixtures/seed.sql`, title-scoped so concurrent integration files with different titles are unaffected, with `DROP TABLE IF EXISTS` for convergent re-seed and `TRUNCATE` for stale-sentinel clearing
- Hardened `seed.sql` guard to fail-closed: `\set ON_ERROR_STOP on` as first line + `-v ON_ERROR_STOP=1` on both CI fixture-seed psql steps, so the `RAISE EXCEPTION` guard actually aborts the file instead of letting psql continue past it
- Added `fileParallelism: false` to `vitest.config.integration.ts` — integration suite is now single-threaded, removing the race window for concurrent file interference
- Replaced deferral comment with two executable fault-injection `it()` cases: branch (a) UPDATE-fails/DELETE-succeeds = 500 + only `poll_created` audit row + poll absent; branch (b) UPDATE+DELETE-both-fail = 500 + `poll_created` + `poll_created_orphaned` audit rows + poll orphaned with `results_hidden=false`
- Hardened shared `afterEach`: unconditionally clears `test_fault_config` as first statement before poll cleanup, so thrown assertions can never leave an armed fault row for subsequent tests
- Full integration suite: 26 passed / 0 failed / 0 skipped

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fail-closed, title-scoped fault-injection DDL to seed.sql + harden CI psql** - `3ced3dc` (feat)
2. **Task 2: Serialize the integration runner** - `e3ea31d` (chore)
3. **Task 3: Implement fail-safe, title-scoped fault-injection test cases** - `8eaa532` (test)

## Files Created/Modified

- `e2e/fixtures/seed.sql` — Added `\set ON_ERROR_STOP on` at top; appended `test_fault_config` table DDL + BEFORE UPDATE/DELETE trigger functions/triggers on `polls`
- `e2e/integration/create-poll-results-hidden.test.ts` — Hardened `afterEach` with unconditional `test_fault_config` clear; removed deferral comment; added 2 fault-injection `it()` test cases
- `vitest.config.integration.ts` — Added `fileParallelism: false` to `test` block
- `.github/workflows/ci.yml` — Added `-v ON_ERROR_STOP=1` to both fixture-seed psql steps (test-integration job at line ~107, e2e job at line ~207)

## Decisions Made

- **Audit-only poll-id resolution (REVIEWS H-NEW-1):** In branch (a), the poll is absent after the compensating DELETE succeeds, so resolving `actualPollId` via `from('polls').select().eq('title', faultTitle)` would return null and produce a false-green. Instead, `target_id` from the `poll_created` audit row is used directly — the EF writes the audit row BEFORE the UPDATE attempt, carrying both `target_id = pollId` and `after: { title }`. This is used symmetrically in branch (b) as well.
- **Two-layer disarm architecture (REVIEWS HIGH-3):** `try/finally` in each test handles normal test flow; the hardened `afterEach` is the backstop if a test threw before `finally` was reached. Both layers are needed because an armed delete-sentinel blocks `cleanupPoll`'s DELETE on the orphaned poll.
- **`DROP TABLE IF EXISTS` before `CREATE TABLE` (Codex MEDIUM):** A `CREATE TABLE IF NOT EXISTS` would leave a stale `(poll_id, fail_operation)` table in place on re-seed; `DROP` first guarantees the current `(fault_title, fail_operation)` shape on every apply.

## Deviations from Plan

None — plan executed exactly as written. All design decisions (title-scoping, audit-only resolution, two-layer disarm, fail-closed guard) were specified in the plan and implemented as documented.

## Issues Encountered

- `psql` binary not installed locally — used `docker exec -i supabase_db_wtcs-community-polls sh -c "PGOPTIONS='-c app.e2e_seed_allowed=true' psql -U postgres -v ON_ERROR_STOP=1"` with stdin redirect to apply the seed. This is equivalent to the CI pattern and the seed applied cleanly.
- CI will only trigger when a PR is opened against `main` (the workflow `on:` block only fires for `pull_request: branches: [main]` and `push: branches: [main]`). The branch was pushed to remote; CI gate requires PR creation or a branch merge. All local acceptance criteria confirmed; CI confirmation deferred to PR creation.

## Verification Results

| Check | Result |
|-------|--------|
| `create-poll-results-hidden.test.ts` | 6 passed / 0 failed / 0 skipped |
| Full integration suite | 26 passed / 0 failed / 0 skipped |
| `grep -r "test_fault_config" supabase/migrations/` | 0 matches (production safe) |
| `grep -c "ON_ERROR_STOP=1" .github/workflows/ci.yml` | 2 |
| `grep -q "fileParallelism" vitest.config.integration.ts` | PASS |
| `test_fault_config` rows after suite | 0 (no leaked sentinels) |
| Both trigger functions match `fault_title` / no UUID wildcard | PASS |
| `[FAULT-INJECT]` prefix in RAISE EXCEPTION messages | PASS |

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes to production paths. The `test_fault_config` table and triggers are:
- In `e2e/fixtures/seed.sql` only (never a migration)
- Guarded by `app.e2e_seed_allowed=true` — absent from production
- Fail-closed via `\set ON_ERROR_STOP on` + `-v ON_ERROR_STOP=1` in CI
- T-18-06 (Tampering — DDL applied to production) mitigated as specified in plan threat model
- T-18-07 (DoS — armed fault row not disarmed) mitigated: try/finally + unconditional afterEach clear

## Self-Check: PASSED

- e2e/fixtures/seed.sql modified: FOUND (first line `\set ON_ERROR_STOP on`, fault DDL at end)
- e2e/integration/create-poll-results-hidden.test.ts modified: FOUND (6 tests, afterEach hardened)
- vitest.config.integration.ts modified: FOUND (`fileParallelism: false`)
- .github/workflows/ci.yml modified: FOUND (2 `-v ON_ERROR_STOP=1` occurrences)
- Commit 3ced3dc (Task 1): FOUND
- Commit e3ea31d (Task 2): FOUND
- Commit 8eaa532 (Task 3): FOUND
- 26 tests passed: VERIFIED
- 0 test_fault_config rows after run: VERIFIED
- test_fault_config absent from migrations: VERIFIED
