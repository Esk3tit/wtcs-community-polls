---
phase: 08-e2e-test-hygiene
verified: 2026-05-03T00:30:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run full Playwright smoke suite against canonical two-layer seed and verify zero fixture leak"
    expected: "npx playwright test --grep @smoke exits 0; specs all pass; leak query returns 0; push branch and confirm CI green"
    result: pass
    verified: 2026-05-03T00:30:00Z
    evidence: "Local smoke 5/5 in 7.4s parallel; leak count 0; CI run 25273571093 success on PR #22 (https://github.com/Esk3tit/wtcs-community-polls/actions/runs/25273571093). Three gap fixes (commit 308c578) — see .planning/debug/phase-8-smoke-failures.md (resolved)."
  - test: "Second-human Phase 03 UAT Tests 2 + 3 (Non-Member Login Rejection, Error Page Invite Link)"
    expected: "Qualified tester (2FA-enabled Discord account, not WTCS server member, not original executor) runs 08-UAT-10-SCRIPT.md and pastes filled evidence under ## Second-Human Verification in 03-UAT.md — result: pass for both tests"
    result: deferred
    why_deferred: "Per D-11, the actual second-human session runs asynchronously. The runbook + template artifact is the Phase 8 synchronous deliverable. Phase 8 closure does NOT block on the placeholder fields being filled in. Tracked in 08-HUMAN-UAT.md item 2 (status: pending)."
---

# Phase 8: E2E Test Hygiene — Verification Report

**Phase Goal:** Playwright E2E suite is honest under the canonical two-layer seed — every shared-DB list locator is `[E2E]`-scoped, the convention is lint-enforced, per-test mutable state lives in a fixture, and the two second-human-gated Phase 03 UAT cases have evidence on file.
**Verified:** 2026-05-03T00:30:00Z (initial 2026-05-02; re-verified after smoke gap closure)
**Status:** passed
**Re-verification:** Yes — initial verifier returned `human_needed` (7/8); local smoke run revealed 2 gap bugs documented in `.planning/debug/phase-8-smoke-failures.md`; fixed in commit 308c578; local 5/5 + CI green confirmed; status now `passed` (8/8). The async second-human Phase 03 UAT (item 2) is explicitly deferred per D-11 and does not block Phase 8 closure.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `getAdminClient()` lazy service-role getter exported from `e2e/helpers/auth.ts`; throws only on call without `SUPABASE_SERVICE_ROLE_KEY`; does not throw at module-load | VERIFIED | L112–126 of auth.ts: `export function getAdminClient()` with `if (_adminClient) return _adminClient`; key checked inside the function body, not at module scope. Module-load throw exists only for `ANON_KEY` (L29-35). |
| 2 | `e2e/fixtures/poll-fixture.ts` exports Playwright `test.extend<{freshPoll}>` with insert + 2-choice insert + `provide` (renamed from `use`) + single-statement DELETE cleanup; partial-setup leak guard via try/catch/finally; AggregateError test-error-first capture | VERIFIED | poll-fixture.ts L31-88: `base.extend<PollFixtures>`, choices insert, `await provide(...)` (orchestrator-noted rename), try/catch/finally block, AggregateError at L83, single DELETE at L76. Functional semantics identical to plan spec. |
| 3 | ESLint `no-restricted-syntax` rule in `eslint.config.js` scoped to `e2e/tests/**/*.spec.ts` fires on list locators without `.filter()` in chain | VERIFIED | eslint.config.js L39-60: flat-config block with `:has()` walk selector. Synthetic canary confirms: unfiltered `.first()` fires the rule (exit 1). `npx eslint e2e/tests/` exits 0 on all 4 spec files. |
| 4 | `browse-respond.spec.ts` imports from `../fixtures/poll-fixture`, destructures `freshPoll`, binds `firstCard` via `.filter({ hasText: freshPoll.title }).first()`, has 2 DOM-scoped eslint-disable comments, uses tightened `/[1-9]\d*/` regex | VERIFIED | All 6 edits confirmed: import from poll-fixture (L1), `freshPoll` destructure (L19), filter by title (L25-27), 2 disable comments (L35+L44), `[1-9]\d*` regex (L50). Old `@playwright/test` import gone. |
| 5 | `filter-search.spec.ts` uses inline `.filter({ hasText: /\[E2E\]/ })` on every list-locator call expression; no `const cards` alias | VERIFIED | 4 occurrences of `.filter({ hasText: /\[E2E\]/ })`. `const cards` alias removed. E2E-SCOPE-1 WHY comment present. Sinai filter and SMOKE search token unchanged. `npx eslint e2e/tests/filter-search.spec.ts` exits 0. |
| 6 | `admin-create.spec.ts` and `auth-errors.spec.ts` unchanged and lint-clean against E2E-SCOPE-1 | VERIFIED | `npx eslint e2e/tests/admin-create.spec.ts e2e/tests/auth-errors.spec.ts` exits 0. git log shows last modification predates Phase 8 for both files. |
| 7 | `e2e/README.md` exists (139 lines), contains E2E-SCOPE-1 section, Locator.filter, freshPoll fixture usage, two-layer seed explainer, run-locally, gotchas, cites `npm run e2e` | VERIFIED | File exists (139 lines, within 80-200 target). All grep gates pass: E2E-SCOPE-1, Locator.filter, freshPoll, Two-layer seed, npm run e2e, eslint-disable escape-hatch. |
| 8 | All four Playwright `@smoke` specs pass green against canonical two-layer seed; zero fixture leak under `description = 'freshPoll fixture row'` marker; CI green | UNCERTAIN — human_needed | Plan 08-03 Task 4 is an unrun human checkpoint. Playwright runs were deferred per orchestrator D-11 (local Supabase stack unavailable in execution worktree). Lint-level evidence is complete; runtime proof requires human execution of the full Task 4 sequence. |

**Score:** 7/8 truths verified (1 pending human confirmation)

---

### Roadmap Success Criteria Coverage

| SC | Text | Status | Evidence |
|----|------|--------|----------|
| SC-1 | Three previously-failing specs pass green against two-layer seed in CI, list locators filtered via `Locator.filter({ hasText: /\[E2E\]/ })` | UNCERTAIN — human_needed | Spec migrations complete and lint-clean. Runtime green requires Task 4 human checkpoint + CI run. |
| SC-2 | ESLint `no-restricted-syntax` rule fails build on unscoped locators; documented in `e2e/README.md` (E2E-SCOPE-1) | VERIFIED | Rule present in eslint.config.js; fires on synthetic canary; README documents E2E-SCOPE-1 with escape-hatch. |
| SC-3 | Playwright test-scoped `freshPoll` fixture exists, provides per-test mutable poll/vote state via `await use(...)`, cleans up; at least one spec consumes it | VERIFIED | poll-fixture.ts exports `test.extend<{freshPoll}>` with `provide` (functional `use` equivalent per orchestrator D-11 note). browse-respond.spec.ts imports and destructures `freshPoll`. Cleanup via try/finally DELETE confirmed. |
| SC-4 | Phase 03 UAT tests 2 + 3 have second-human evidence appended to 03-UAT.md with timestamp, executor handle, and pass/fail | UNCERTAIN — human_needed | Runbook (08-UAT-10-SCRIPT.md) and template (## Second-Human Verification in 03-UAT.md) both exist. Evidence fields currently show `<placeholder>` — actual session not yet run. Per D-11, Phase 8 closure does NOT block on this. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `e2e/helpers/auth.ts` | Lazy `getAdminClient()` + unchanged `loginAs()` | VERIFIED | L105-126: _adminClient singleton, getAdminClient() export, SUPABASE_SERVICE_ROLE_KEY guard. loginAs() L63-103 byte-identical. |
| `e2e/fixtures/poll-fixture.ts` | Playwright test.extend<{freshPoll}> with try/catch/finally + AggregateError | VERIFIED | 90-line file. All content markers present: base.extend, freshPoll fixture type, insert, choices insert, provide call, try/catch/finally, AggregateError, single DELETE, leak-detection description. |
| `eslint.config.js` | no-restricted-syntax flat-config block scoped to e2e/tests/**/*.spec.ts | VERIFIED | L38-61: files scoped, :has() walk selector, E2E-SCOPE-1 message, JS syntax valid. |
| `e2e/README.md` | 80-200 lines, E2E-SCOPE-1 + Locator.filter + freshPoll + Two-layer seed + run-locally + gotchas | VERIFIED | 139 lines. All required strings present. |
| `package.json` `e2e` script | `playwright test --config e2e/playwright.config.ts` | VERIFIED | scripts.e2e = "playwright test --config e2e/playwright.config.ts" confirmed. |
| `e2e/tests/browse-respond.spec.ts` | Fixture import, freshPoll destructure, filter by title, 2 disables, tightened regex | VERIFIED | All 6 edits applied per Plan 03 Task 1. ESLint exits 0. |
| `e2e/tests/filter-search.spec.ts` | Inline-filter migration (≥3 .filter calls), no cards alias, E2E-SCOPE-1 comment | VERIFIED | 4 inline filters, no alias, comment present, Sinai + SMOKE unchanged. ESLint exits 0. |
| `.planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md` | Second-human runbook, 100-250 lines, all content gates | VERIFIED | 161 lines. Prerequisites, Test 2 + Test 3 steps, evidence template, ExampleTester#0001 example, cross-ref to 03-UAT.md. |
| `.planning/phases/03-response-integrity/03-UAT.md` | `## Second-Human Verification` H2 appended; original L1-51 preserved | VERIFIED | New H2 present (5 total H2 sections). Original `result: skipped`, `Burner account lacks 2FA`, `### 2.` / `### 3.` headings preserved. Evidence fields are placeholders per D-11. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `e2e/fixtures/poll-fixture.ts` | `e2e/helpers/auth.ts::getAdminClient` | `import { getAdminClient } from '../helpers/auth'` | VERIFIED | L3 of poll-fixture.ts; `getAdminClient()` called at L34. |
| `e2e/fixtures/poll-fixture.ts` | `e2e/fixtures/test-users.ts::fixtureUsers.adminUser.id` | `import { fixtureUsers }` + `created_by: fixtureUsers.adminUser.id` | VERIFIED | L2 + L50 of poll-fixture.ts. |
| `e2e/tests/browse-respond.spec.ts` | `e2e/fixtures/poll-fixture.ts` | `import { test, expect } from '../fixtures/poll-fixture'` | VERIFIED | L1 of browse-respond.spec.ts. |
| `e2e/tests/browse-respond.spec.ts` | freshPoll title binding | `.filter({ hasText: freshPoll.title })` | VERIFIED | L26 of browse-respond.spec.ts. |
| `eslint.config.js` | `e2e/tests/**/*.spec.ts` | `files: ['e2e/tests/**/*.spec.ts']` flat-config | VERIFIED | L39 of eslint.config.js. |
| `.planning/phases/03-response-integrity/03-UAT.md` | `08-UAT-10-SCRIPT.md` | Cross-reference in Second-Human section intro | VERIFIED | 03-UAT.md L57: `Runbook: .planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md` |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| TEST-07 | 08-03 | Three failing specs pass green under two-layer seed (list locators [E2E]-scoped) | UNCERTAIN — human_needed | Spec migrations lint-clean. Runtime green requires Plan 08-03 Task 4 human checkpoint. |
| TEST-08 | 08-02, 08-03 | ESLint rule prevents unscoped locators; documented in e2e/README.md | VERIFIED | Rule in eslint.config.js; synthetic canary fires; `npx eslint e2e/tests/` exits 0; README documents E2E-SCOPE-1. |
| TEST-09 | 08-01, 08-03 | freshPoll test-scoped fixture with cleanup around await use(); spec consumes it | VERIFIED (runtime human_needed) | Fixture exists with try/catch/finally + AggregateError + single-statement DELETE. browse-respond.spec.ts is the proof-of-contract consumer. Fixture cleanup runtime behavior requires Task 4 human verification. |
| TEST-10 | 08-04 | Phase 03 UAT Tests 2 + 3 with second-human evidence in 03-UAT.md | UNCERTAIN — human_needed | Runbook + template artifacts complete per D-11. Evidence fields are placeholders pending qualified tester. Per D-11 and orchestrator context, Phase 8 closure does NOT block on this. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `e2e/fixtures/poll-fixture.ts` | 33 | `freshPoll: async ({}, provide, ...)` — parameter renamed from plan's `use` to `provide` | INFO | Intentional deviation to satisfy `react-hooks/rules-of-hooks` (any param starting with `use` triggers the hook rule). Functional semantics identical. Accepted per orchestrator context. |
| `e2e/fixtures/poll-fixture.ts` | 57-87 | AggregateError throws moved post-finally (not inside finally) | INFO | Intentional deviation to satisfy `no-unsafe-finally` ESLint rule. Semantics preserved: `testErr` and `deleteErr` accumulated during try/catch/finally, re-thrown after. Accepted per orchestrator context. |

No blocking anti-patterns found. No stub indicators. No placeholder returns. No rot-tags in source files (grep returns no matches for `Phase 8|D-0x|TEST-0x|issue #|PR #|Round` in e2e/helpers/auth.ts, e2e/fixtures/poll-fixture.ts, or eslint.config.js).

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| ESLint rule fires on unscoped `.first()` | synthetic canary: `printf ... > _lint-canary.spec.ts && npx eslint ...; rm` | exit 1 — error fired with E2E-SCOPE-1 message | PASS |
| ESLint rule quiet on all 4 spec files | `npx eslint e2e/tests/` | exit 0 | PASS |
| TypeScript build (src/) clean | `npx tsc -b` | exit 0 | PASS |
| Unit test cases (local) | `npm test` — 1167 cases that ran | 1167 passed, 0 failed | PASS |
| Unit test files — env-gated | `npm test` (local, no service-role env) | 8 test files did not load due to missing local env (no code failures); same suite is green in CI on commit `3207f8f` (run 25286405258, lint-and-unit 55s) where env is provided | PASS (CI-green) |
| Full repo lint | `npx eslint .` | exit 0 | PASS |
| Playwright @smoke suite against live Supabase | `npm run e2e -- --grep @smoke` (requires supabase start + seed) | NOT RUN — deferred to human Task 4 | SKIP |
| Fixture leak check post-suite | `psql ... select count(*) from polls where description = 'freshPoll fixture row' ...` | NOT RUN | SKIP |
| CI green confirmation | Push branch + GitHub Actions e2e job | NOT RUN — per D-11 orchestrator deferral | SKIP |

---

### Human Verification Required

#### 1. Plan 08-03 Task 4 — Full Playwright smoke suite + fixture leak check + CI confirmation

**Test:** Run the following sequence with a live local Supabase stack:

```bash
supabase stop || true
supabase start

PGOPTIONS='-c app.e2e_seed_allowed=true' \
  psql "$(supabase status --output json | jq -r '.DB_URL')" \
  -f e2e/fixtures/seed.sql

export VITE_SUPABASE_URL="$(supabase status --output json | jq -r '.API_URL')"
export VITE_SUPABASE_ANON_KEY="$(supabase status --output json | jq -r '.ANON_KEY')"
export SUPABASE_SERVICE_ROLE_KEY="$(supabase status --output json | jq -r '.SERVICE_ROLE_KEY')"

npm run lint
npm run e2e -- --grep @smoke

psql "$(supabase status --output json | jq -r '.DB_URL')" \
  -c "select count(*) from polls where description = 'freshPoll fixture row' and created_at > now() - interval '5 minutes'"
```

Then push branch and confirm GitHub Actions CI run with the e2e job green. Capture the CI run URL.

**Expected:** `npm run lint` exits 0; Playwright reports 4 specs / 4 passed; leak count = 0; CI e2e job green.

**Why human:** Requires a live local Supabase stack that was not available in the execution worktree. Per orchestrator D-11 and Plan 08-03 Task 4 `checkpoint:human-verify` gate. Local-only pass is NOT sufficient — CI confirmation required per ROADMAP Success Criterion 1.

**Reply with:** `approved <CI_RUN_URL>` if all conditions hold, or `fail: <details>` if any spec fails, fixture leaks, or CI is red.

#### 2. Phase 03 UAT Tests 2 + 3 — Second-human Discord OAuth verification

**Test:** Recruit a tester meeting all prerequisites in `08-UAT-10-SCRIPT.md` (2FA-enabled Discord account, not WTCS server member, not original Phase 03 executor, fresh browser session) and have them execute the runbook end-to-end. The tester pastes filled evidence into `.planning/phases/03-response-integrity/03-UAT.md` under `## Second-Human Verification`.

**Expected:** Both `result: pass` with executor handle, UTC timestamp, and observation notes filled in.

**Why human:** ROADMAP SC-4 requires "second-human evidence appended to 03-UAT.md with timestamp, executor handle, and pass/fail." The evidence fields are currently placeholders per D-11 design decision. Requires a real Discord account that is not a WTCS server member.

---

### Gaps Summary

No gaps blocking immediate phase goal achievement. The two human verification items are:

1. **Task 4 Playwright runtime** — artifact-level evidence is complete and lint-clean. The runtime proof (4 specs green + zero leak + CI confirmation) is the remaining unconfirmed truth. Per orchestrator instruction, this is classified as `human_needed` rather than `gaps_found` because all code artifacts exist, are substantive, and are wired correctly — only execution proof is missing.

2. **TEST-10 second-human session** — the deliverable per D-11 is the runbook + template artifact, which is complete. The actual session evidence is explicitly deferred. Per orchestrator context: "Phase 8 closure does NOT block on the placeholder fields being filled in."

Both items are addressed by the human verification section above. No code changes are needed — phase is ready for human sign-off.

---

_Verified: 2026-05-02T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
