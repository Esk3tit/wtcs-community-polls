---
phase: 18-test-environment-repair
verified: 2026-06-02T03:00:00Z
status: passed
score: 3/3
overrides_applied: 0
human_verification:
  - test: "Confirm CI test-integration job passes on the Phase 18 branch"
    expected: "GitHub Actions CI test-integration job exits 0 with 26 passed / 0 failed / 0 skipped after a PR is opened against main from gsd/phase-18-test-environment-repair"
    why_human: "CI only triggers on pull_request targeting main or push to main. 18-03-SUMMARY deferred CI confirmation to PR creation. Cannot verify programmatically."
    result: passed
    evidence: "PR #43 — test-integration passed (26/26, 2m4s) on commit 1bea270; full CI green, CodeRabbit APPROVED. Resolved via 18-HUMAN-UAT.md."
---

# Phase 18: Test-Environment Repair — Verification Report

**Phase Goal:** Fix the two broken local test harnesses (ES256 edge-runtime bug, gotrue email config) and implement the deferred fault-injection test.
**Verified:** 2026-06-01T23:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm run test:integration` completes with 0 skips and 0 failures on the local stack after the edge-runtime upgrade/pin (TEST-17) | VERIFIED | All 4 CLI pins set to 2.102.0 (ci.yml ×2, deploy-edge-functions.yml, package.json). docker ps confirmed edge-runtime:v1.74.0 running. 18-02-SUMMARY reports 24 passed / 0 failed / 0 skipped. |
| 2 | The TEST-11 12-cell RLS invariant vitest matrix runs 12 PASS / 0 FAIL locally and in CI — no xfail, no skip — after the gotrue email_provider_disabled config is resolved (TEST-18) | VERIFIED | `[auth.email]` section present in supabase/config.toml (exactly 1 instance). `enable_signup = true` and `enable_confirmations = false` present. 18-01-SUMMARY reports 13 PASS / 0 FAIL (12 RLS cells + 1 admin JWT regression). No `AuthApiError: Email logins are disabled` in output. |
| 3 | The fault-injection branch in `create-poll-results-hidden.test.ts` (post-RPC UPDATE failure path, previously a comment-only deferral at ~line 156) is implemented as an executable test case and passes green (TEST-19) | VERIFIED | 6 test cases confirmed in file (4 existing + 2 new). Deferral comment removed. `try/finally` disarm present in both new tests. `afterEach` unconditionally clears `test_fault_config` first. seed.sql has title-scoped fault DDL with `\set ON_ERROR_STOP on`. `fileParallelism: false` in vitest config. 18-03-SUMMARY reports 26 passed / 0 failed / 0 skipped. |

**Score:** 3/3 truths verified locally

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/config.toml` | `[auth.email]` section with `enable_signup = true`, `enable_confirmations = false` | VERIFIED | Present at line 24; exactly 1 instance confirmed via grep; `[functions.*] verify_jwt = false` blocks for 13 functions intact |
| `.github/workflows/ci.yml` | Both supabase/setup-cli@v2 steps pinned to resolved stable version | VERIFIED | Both at version: 2.102.0 (lines 62, 130); both fixture-seed psql steps include `-v ON_ERROR_STOP=1` (lines 107, 207) |
| `.github/workflows/deploy-edge-functions.yml` | supabase/setup-cli@v2 pinned to same version | VERIFIED | version: 2.102.0 at line 31 |
| `package.json` | devDependencies.supabase at same version as CI pins | VERIFIED | `"supabase": "2.102.0"` at line 60 |
| `e2e/fixtures/seed.sql` | Fail-closed guard, title-scoped fault DDL, TRUNCATE on re-seed | VERIFIED | `\set ON_ERROR_STOP on` as first non-comment line (line 5); `DROP TABLE IF EXISTS public.test_fault_config` → `CREATE TABLE` → `TRUNCATE` sequence present; triggers key on `NEW.title`/`OLD.title` (no wildcard UUID); `[FAULT-INJECT]` prefix in RAISE EXCEPTION messages |
| `e2e/integration/create-poll-results-hidden.test.ts` | 6 tests (4 existing + 2 new), deferral comment removed, try/finally disarm, unconditional afterEach clear | VERIFIED | 6 `it()` calls confirmed; `finally` blocks present in both new tests; afterEach first statement clears `test_fault_config` via `.delete().neq('fault_title', '')` |
| `vitest.config.integration.ts` | `fileParallelism: false` in test block | VERIFIED | `fileParallelism: false,` at line 24 |
| fault DDL absent from migrations | `test_fault_config` must NOT appear in any migration file | VERIFIED | `grep -r "test_fault_config" supabase/migrations/` returns 0 matches |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `supabase/config.toml [auth.email]` | GOTRUE container `GOTRUE_EXTERNAL_EMAIL_ENABLED=true` | CLI start.go env-var mapping at `enable_signup = true` | VERIFIED | `enable_signup = true` and `enable_confirmations = false` present in config; 18-01-SUMMARY confirms restart + fixture re-seed succeeded and `signInWithPassword` worked |
| All 4 CLI pins | Same edge-runtime v1.74.0 locally and in CI | Single resolved stable semver 2.102.0 applied byte-identical to all 4 locations | VERIFIED | `grep` confirms no stale `2.92.1` or `2.98.2` remaining; docker ps evidence of `edge-runtime:v1.74.0` in 18-02-SUMMARY |
| `seed.sql test_fault_config` | `polls` BEFORE UPDATE/DELETE triggers | `fault_inject_polls_before_update` / `fault_inject_polls_before_delete` functions | VERIFIED | Trigger functions and CREATE TRIGGER statements present; key on `NEW.title`/`OLD.title` matching `fault_title` column |
| `create-poll-results-hidden.test.ts` title-scoped arm/disarm | `test_fault_config` table | `serviceRole.from('test_fault_config').insert / .delete` keyed on `faultTitle` | VERIFIED | Both insert and delete calls use `fault_title` key; no global wildcard UUID in fault test logic |
| `vitest.config.integration.ts fileParallelism: false` | Single-threaded integration runner | vitest pool config | VERIFIED | `fileParallelism: false` confirmed at line 24 |
| `.github/workflows/ci.yml psql -f e2e/fixtures/seed.sql` | Fail-closed `app.e2e_seed_allowed` guard | `-v ON_ERROR_STOP=1` on both psql calls | VERIFIED | 2 occurrences confirmed at lines 107 and 207 |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces test infrastructure (config, seed SQL, test files, workflow YAML), not UI components or data-rendering artifacts.

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| `[auth.email]` section is unique | `grep -c '^\[auth.email\]' supabase/config.toml` = 1 | PASS |
| No stale 2.92.1 or 2.98.2 pins | `grep -rE 'version: 2\.92\.1\|"supabase": "2\.98\.2"'` returns no matches | PASS |
| All 4 pins at 2.102.0 | ci.yml ×2 = 2.102.0; deploy-edge-functions.yml = 2.102.0; package.json = 2.102.0 | PASS |
| `\set ON_ERROR_STOP on` is first non-comment line in seed.sql | Lines 1-5 of seed.sql confirmed | PASS |
| `-v ON_ERROR_STOP=1` on both CI psql steps | Lines 107 and 207 of ci.yml confirmed | PASS |
| `fileParallelism: false` present | vitest.config.integration.ts line 24 confirmed | PASS |
| Fault DDL absent from migrations | grep returns 0 matches | PASS |
| 6 test cases in create-poll-results-hidden.test.ts | 6 `it()` calls confirmed | PASS |
| `try/finally` in both fault tests | `finally` blocks confirmed at lines 178 and 242 | PASS |
| Deferral comment removed | No "Manual fault-injection deferred" text in test file | PASS |
| `test_fault_config` INSERT error unchecked (WR-02) | Lines 169-170 and 229-236: `.insert()` return value discarded | WARNING |

### Probe Execution

No probe scripts declared or present for this phase. Step 7c: SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TEST-17 | 18-02-PLAN.md | ES256 edge-runtime bug fixed via CLI pin bump to version bundling edge-runtime >= v1.74.0 | SATISFIED | All 4 pins at 2.102.0; docker ps confirmed edge-runtime:v1.74.0; no 401 Unauthorized in suite output |
| TEST-18 | 18-01-PLAN.md | gotrue email_provider_disabled fixed; 12-cell RLS matrix runs green | SATISFIED | `[auth.email]` section present with correct keys; 13 PASS / 0 FAIL (includes all 12 RLS cells); REQUIREMENTS.md traceability table still shows "Pending" — tracking state discrepancy, not a code failure |
| TEST-19 | 18-03-PLAN.md | Fault-injection branch implemented as executable test cases | SATISFIED | 2 new test cases (branch a and b) verified in file; 26 passed / 0 failed full suite |

**Note on REQUIREMENTS.md state:** The traceability table shows TEST-18 as "Pending" with `[ ]` unchecked, while TEST-17 and TEST-19 are marked `[x]` Complete. The code evidence satisfies TEST-18's definition (email provider enabled, matrix passing). The REQUIREMENTS.md was not updated when 18-01 completed — this is a documentation tracking gap, not a code gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `e2e/integration/create-poll-results-hidden.test.ts` | 170, 229-234 | `.insert()` return value discarded — supabase-js DB errors silently dropped | WARNING | If arm INSERT fails (RLS unexpectedly enabled, schema change, transient error), the trigger never arms, the EF's UPDATE succeeds, and `expect(result.status).toBe(500)` fails with a confusing message pointing at the EF rather than the un-armed fault row (CR-WR-02 from 18-REVIEW.md) |
| `vitest.config.integration.ts` | 19-24 | Comment overstates safety of re-enabling parallelism: "title-scoping provides correctness even if parallelism is later re-enabled" — this is inaccurate because `afterEach` does a global `.delete().neq('fault_title', '')` wipe of `test_fault_config`, which would delete sentinels armed by concurrently-running files | WARNING | If `fileParallelism` is ever set back to `true`, the global afterEach delete would cause cross-file interference. The comment should state serialization is required, not optional (IN-03/WR-04 from 18-REVIEW.md) |

**No TBD / FIXME / XXX debt markers** found in any of the 7 phase-modified files.

### Pre-Existing Gap Assessment (CR-01 from 18-REVIEW.md)

The code review identified that `config.toml` is missing `verify_jwt = false` blocks for three deployed Edge Functions: `submit-vote`, `get-upload-url`, and `search-admin-targets`. 13 functions have the block; 3 do not (out of 16 total).

**Orchestrator fact-check conclusion (carried forward here):** These three functions are NOT invoked by any current integration test. The helpers.ts seeds votes directly via service-role, deliberately bypassing `submit-vote`. The `verify_jwt` blocks were NOT modified by phase 18 — only the `[auth.email]` section was added in 18-01. The missing blocks predate phase 18 and are not the cause of any currently-failing test. The integration suite runs 26 PASS / 0 FAIL with the current config.

**Classification:** Pre-existing latent fidelity gap. Not a regression introduced by phase 18. Does not affect the phase goal ("fix two broken harnesses, implement fault-injection test"). Legitimate follow-up item for a future phase (when `submit-vote` integration tests are written).

**This gap does not block phase 18 goal achievement.** It should be tracked as a known gap in `supabase/config.toml` for resolution before `submit-vote`, `get-upload-url`, or `search-admin-targets` integration tests are added.

### Human Verification Required

#### 1. CI test-integration job confirmation

**Test:** Open a pull request from `gsd/phase-18-test-environment-repair` targeting `main`, or trigger CI by another means. Confirm the `test-integration` job passes.
**Expected:** CI `test-integration` job exits 0 with 26 passed / 0 failed / 0 skipped. No `401 Unauthorized` errors. No `email_provider_disabled` errors. No `-v ON_ERROR_STOP=1` guard failures.
**Why human:** CI only triggers on `pull_request: branches: [main]` or `push: branches: [main]`. The phase branch `gsd/phase-18-test-environment-repair` has been pushed but no PR has been opened (noted in 18-03-SUMMARY: "CI gate requires PR creation or a branch merge"). All three plans' acceptance criteria require CI confirmation. This cannot be verified by code inspection alone.

---

## Gaps Summary

No automated-verification gaps. All 3 roadmap success criteria and all 7 required artifacts pass code-level verification.

One item requires human action before phase 18 can be declared fully complete: CI confirmation of the test-integration job on the phase branch. All local acceptance criteria are met; CI has not yet been exercised with the phase 18 changes because no PR has been opened.

**Carry-forward recommendations (non-blocking for phase 18 goal, follow-up in a future phase):**
1. Add `verify_jwt = false` blocks for `submit-vote`, `get-upload-url`, `search-admin-targets` in `supabase/config.toml` (pre-existing gap, latent fidelity risk when those functions gain integration tests)
2. Add `expect(armErr).toBeNull()` checks after fault-row INSERT calls in both branch (a) and branch (b) test cases (WR-02: silent arm failure produces confusing test output)
3. Correct `vitest.config.integration.ts` comment to state `fileParallelism: false` is required (not just defense-in-depth) given the global `afterEach` delete pattern (WR-04/IN-03)

---

_Verified: 2026-06-01T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
