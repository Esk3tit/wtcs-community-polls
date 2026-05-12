---
phase: 11-schema-rls-ef-foundations
plan: 00
subsystem: testing
tags: [vitest, integration-tests, ci, supabase, rls, audit-log]

# Dependency graph
requires:
  - phase: 05-launch-hardening
    provides: e2e fixture seed + supabase status key derivation pattern (test-integration CI job reuses this verbatim)
provides:
  - vitest.config.integration.ts (node env, scoped to e2e/integration/, no env placeholders)
  - npm run test:integration script
  - GitHub Actions test-integration job parallel to e2e (both needs lint-and-unit)
  - e2e/integration/helpers.ts — mintClients / createFreshPoll / castVote / seedBaselineVote / invokeEF / readAuditLog / cleanupPoll + AuditRow type
  - e2e/integration/vote-counts-rls.test.ts — TEST-11 12-cell describe.each scaffold (12 it.todo)
  - e2e/integration/toggle-results-visibility.test.ts — TEST-12 admin EF authz scaffold (4 it.todo)
affects: [11-01 (migration 10 unblocks createFreshPoll(hidden:…) path), 11-02 (toggle-results-visibility EF + audit retrofit), 11-04 (Wave 3 fills the it.todo bodies), 11-05 (deploy)]

# Tech tracking
tech-stack:
  added: [no new dependencies — reuses vitest 4.1.2 + @supabase/supabase-js 2.101.1 already in package.json]
  patterns:
    - "Integration vitest config separate from unit config (node env, no env placeholders, passWithNoTests: false)"
    - "Service-role test-setup writes (votes table has no INSERT RLS; production submit-vote EF uses service-role; setup mirrors prod write path)"
    - "EF invocation via fetch (not client.functions.invoke) to recover literal HTTP status for 403/200 assertions"
    - "Conditional INSERT payload spread to avoid PostgREST unknown-column 400 when schema column doesn't exist yet"
    - "Deterministic title prefix [TEST-11] + Date.now() + 4-char random suffix for cross-worker collision safety"

key-files:
  created:
    - vitest.config.integration.ts
    - e2e/integration/helpers.ts
    - e2e/integration/vote-counts-rls.test.ts
    - e2e/integration/toggle-results-visibility.test.ts
  modified:
    - package.json (added test:integration script)
    - .github/workflows/ci.yml (added test-integration job)

key-decisions:
  - "Integration vitest config is a separate file from vite.config.ts (unit suite stays scoped to src/__tests__/); env vars come from the shell — no placeholders so missing SERVICE_ROLE_KEY fails loud rather than producing false-green RLS results"
  - "test-integration CI job placed parallel to e2e (both needs lint-and-unit); reuses supabase start + Derive local Supabase keys + Apply fixture seed steps verbatim from the e2e job for minimum drift"
  - "createFreshPoll inserts TWO choices (option-a + option-b) so castVote() can target option-b without colliding with the adminUser baseline vote seeded on option-a"
  - "castVote + seedBaselineVote both write via service-role (votes has no INSERT RLS policy; production goes through submit-vote EF which is service-role)"
  - "invokeEF goes through fetch against /functions/v1/<name> so the literal HTTP status is recoverable (TEST-12 asserts 403 vs 200; client.functions.invoke would collapse non-2xx into a generic FunctionsHttpError)"
  - "createFreshPoll conditionally spreads results_hidden into the INSERT payload (only when opts.hidden is explicitly set) so the helper compiles + works pre-migration AND post-migration without a code change"

patterns-established:
  - "Lazy module-scope singleton for service-role client (lifted from e2e/helpers/auth.ts:122-138 minus the Playwright dependency)"
  - "Try/catch rollback on createFreshPoll partial-setup failure (delete orphan poll before rethrowing — cascade handles choices/votes/vote_counts)"
  - "normalizeError() utility for coercing PostgrestError shapes / strings / null into proper Error instances for the test reporter"
  - "Vitest scaffold pattern: describe.each over a const cases tuple + it.todo bodies — locks contract names in CI summaries before bodies land"

requirements-completed: [TEST-11, TEST-12]
wave_0_complete: true

# Metrics
duration: 30min
started: 2026-05-11T22:00:00Z
completed: 2026-05-11T22:29:56Z
---

# Phase 11 Plan 00: Integration Test Infrastructure Summary

**Vitest-based integration test scaffolding (config + npm script + CI job + 7 helpers + 2 it.todo scaffolds) so Wave 1+ work can be tested against a real `npm run test:integration` runner with zero new dependencies.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-11T22:00:00Z
- **Completed:** 2026-05-11T22:29:56Z
- **Tasks:** 3
- **Files created:** 4
- **Files modified:** 2

## Accomplishments
- Integration vitest config in place — node env, scoped to `e2e/integration/`, no placeholder env vars (a missing `SUPABASE_SERVICE_ROLE_KEY` fails loud instead of producing a false-green RLS test).
- `npm run test:integration` script wired; existing `npm run test` unit suite unaffected (still 41 files / 389 passing).
- CI `test-integration` job runs parallel to `e2e` (both `needs: lint-and-unit`), reusing the proven `supabase start` + key-derivation + fixture-seed bootstrap from the existing `e2e` job.
- `e2e/integration/helpers.ts` exports the full Wave 3 contract: `mintClients`, `createFreshPoll`, `castVote`, `seedBaselineVote`, `invokeEF`, `readAuditLog`, `cleanupPoll`, plus the `AuditRow` type — zero Playwright imports.
- TEST-11 12-cell matrix scaffold and TEST-12 4-case scaffold parse cleanly; `npm run test:integration` reports 16 todos / exit 0.

## Task Commits

1. **Task 00-01: vitest config + package script + CI job** — `bb767fb` (chore)
2. **Task 00-02: e2e/integration/helpers.ts** — `084893b` (test)
3. **Task 00-03: TEST-11 + TEST-12 scaffolds** — `c4f9ada` (test)

**Plan metadata commit:** to be added after this SUMMARY is written.

## Files Created/Modified

- `vitest.config.integration.ts` — Integration vitest config (node env, `e2e/integration/**/*.test.ts` scope, `passWithNoTests: false`, `testTimeout: 30_000`)
- `e2e/integration/helpers.ts` — All 7 helper exports + `AuditRow` type; service-role lazy singleton; fetch-based EF invocation for status recovery; rollback on createFreshPoll partial-setup failure
- `e2e/integration/vote-counts-rls.test.ts` — TEST-11 scaffold: `describe.each` over 12-cell `[role, hidden, voted, expectRows]` matrix, 12 `it.todo`
- `e2e/integration/toggle-results-visibility.test.ts` — TEST-12 scaffold: 4 `it.todo` (non-admin 403, admin 200 + non-null `results_hidden_changed_at`, audit on state change, no audit on no-op)
- `package.json` — Added `"test:integration": "vitest run --config vitest.config.integration.ts"` after the existing `"test"` line (unit suite unchanged)
- `.github/workflows/ci.yml` — New `test-integration` job parallel to `e2e`: checkout → node 22 → npm ci → supabase/setup-cli@v1 (2.92.1) → supabase start → wait for stack ready → derive keys → apply fixture seed → `npm run test:integration` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` env

## Decisions Made

- **Integration config is fully separate from `vite.config.ts`** — keeps unit + integration suites cleanly disjoint (unit excludes `e2e/**`, integration scopes to `e2e/integration/**`). Means there's no path where the unit job accidentally hits Supabase.
- **No env placeholders in the integration config** (per threat model T-11-W0-01) — placeholders would mask broken RLS in CI as a green test. Real shell env vars or loud failure.
- **CI job placement: parallel to `e2e`, both `needs: lint-and-unit`** — adds ~2 min wall time on top of the existing 10-min `e2e` job; total wall time unchanged. Avoids serial chain.
- **`castVote` + `seedBaselineVote` write via service-role, not the authed client** — the `votes` table has no INSERT RLS policy; production writes go through the `submit-vote` EF (service-role). Test setup mirroring prod is more deterministic than coupling every test to the `submit-vote` rate-limit + validation surface.
- **`invokeEF` uses `fetch`, not `client.functions.invoke`** — supabase-js collapses non-2xx into a generic `FunctionsHttpError`; TEST-12 needs the literal status code (403 vs 200), so we go direct to `/functions/v1/<name>` with the session's `access_token` (or anon key fallback for the unauthenticated path).
- **`createFreshPoll` conditionally spreads `results_hidden`** — until migration 10 ships, the column doesn't exist on `polls` and PostgREST returns 400 on unknown columns. Conditional spread lets the helper work both before and after the migration with no code change.
- **`createFreshPoll` inserts TWO choices, defaults to seeding a baseline vote** — guarantees every poll has ≥1 `vote_counts` row before any test assertion, so the `serviceRole × *` cells and the `authed × hidden=false × voted` cell observe real data. The second choice (`option-b`) gives `castVote()` a non-colliding target.

## Deviations from Plan

None — plan executed exactly as written. All REVIEW-FIX-* requirements (H1, H2, M1, M2, C2-H1, L1) from the multi-round cross-AI review were implemented to spec:

- **REVIEW-FIX-H1** — `castVote` accepts optional `userId`, inserts via service-role.
- **REVIEW-FIX-H2** — `createFreshPoll` seeds a baseline vote by default; `seedBaselineVote` is a top-level export.
- **REVIEW-FIX-M1** — `createFreshPoll` returns `choiceIds: [string, string]` (always two choices).
- **REVIEW-FIX-M2** — `results_hidden` is conditionally spread; not passed pre-migration.
- **REVIEW-FIX-C2-H1** — Choices INSERT uses `label` (not `text`); partial-setup rollback wired.
- **REVIEW-FIX-L1** — Type sanity gated by `vitest run` (not `tsc -p tsconfig.app.json`, which excludes `e2e/`); vitest reports 16 todos / 0 failed.

## Issues Encountered

- **Vitest `basic` reporter alias not valid in vitest 4.1.2** — discovered while sanity-checking the unit suite; switched to the default reporter. No code change required (vitest 4.1.2 is the project pin; the test-integration CI step doesn't use `--reporter`).
- **Standalone `tsc --noEmit` on `e2e/integration/helpers.ts` flagged `process` missing** — expected (per REVIEW-FIX-L1, `tsconfig.app.json` only includes `src/`). The acceptance gate is `vitest run --config vitest.config.integration.ts`, which exercises full module resolution via esbuild and uses `@types/node` from the project. Verified clean via a temporary smoke-import test that imported every export by name (then deleted before commit).

## Verification Summary

| Gate | Result |
|------|--------|
| `npm run lint` | pass |
| `npx tsc -b` | pass |
| `npm run build` | pass (no errors; pre-existing >500 kB chunk warning is unrelated) |
| `npm run test` (unit) | pass — 41 files / 389 tests / 0 failed (unchanged from pre-plan baseline) |
| `npm run test:integration` | pass — 2 files / 16 todo / exit 0 |
| Husky lint-staged on every commit | pass — `eslint --max-warnings 0` + `tsc -b --noEmit` ran clean on all three commits |

## Self-Check: PASSED

- vitest.config.integration.ts — FOUND
- e2e/integration/helpers.ts — FOUND
- e2e/integration/vote-counts-rls.test.ts — FOUND
- e2e/integration/toggle-results-visibility.test.ts — FOUND
- package.json contains `"test:integration"` — FOUND
- .github/workflows/ci.yml contains `test-integration:` job — FOUND
- Commit bb767fb — FOUND
- Commit 084893b — FOUND
- Commit c4f9ada — FOUND

## User Setup Required

None — this plan introduces no new external service configuration. Developers wishing to run `npm run test:integration` locally need to:

1. Run `supabase start` to bring up the local stack (already required for `npm run e2e`).
2. Export `SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from `supabase status` output.
3. Apply `e2e/fixtures/seed.sql` (already wired into CI; locally, run `psql "$(supabase status -o json | jq -r '.DB.URL')" -c "SET app.e2e_seed_allowed=true;" -f e2e/fixtures/seed.sql` once after `supabase db reset`).

No new env vars, no new accounts, no new dashboards.

## Next Phase Readiness

- **Wave 1 (Plan 11-01)** can land migration 10 with confidence: the integration runner is wired and Plan 04's vitest scaffolds will detect any RLS regression in the `vote_counts` policy rewrite or the `polls_effective` view re-projection the moment they're filled in.
- **Plan 11-04** (Wave 3 — fills the `it.todo` bodies) is now unblocked. The helper contract is locked; Plan 04 imports `mintClients`, `createFreshPoll`, `castVote`, `invokeEF`, `readAuditLog`, `cleanupPoll` and writes the matrix bodies.
- **Plan 11-02** (toggle-results-visibility EF + 12 audit retrofits) is independent of this plan but its test surface (TEST-12) is already scaffolded — the contract for the EF response shape (200 with the updated poll row + non-null `results_hidden_changed_at`) is referenced in this plan's test scaffold so any drift will surface as a Plan 04 failure.
- **No blockers.** Wave 0 success criterion satisfied: integration runner is installable before any Wave 1+ test bodies need to land.

---
*Phase: 11-schema-rls-ef-foundations*
*Completed: 2026-05-11*
