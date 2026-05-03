---
phase: 8
slug: e2e-test-hygiene
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Lift requirements verbatim into PLAN frontmatter `must_haves` and execute-phase verification commands.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright `1.59.1` (`package.json` L36) + ESLint 9.39.4 flat config |
| **Config file** | `e2e/playwright.config.ts`, `eslint.config.js` |
| **Quick run command** | `npm run lint && npx playwright test --config e2e/playwright.config.ts e2e/tests/<changed-spec>.spec.ts --grep @smoke` |
| **Full suite command** | `npm run lint && npx playwright test --config e2e/playwright.config.ts --grep @smoke` |
| **Estimated runtime** | ~30s lint + ~60s full e2e suite (4 specs) |

---

## Sampling Rate

- **After every task commit:** `npm run lint` + Playwright run scoped to the spec(s) touched in this commit
- **After every plan wave:** Full lint + full Playwright suite (4 specs)
- **Before `/gsd-verify-work`:** Full suite green in CI on the PR (both `lint-and-unit` and `e2e` jobs in `.github/workflows/ci.yml`)
- **Max feedback latency:** ~90s per task; ~3min per wave

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| TEST-07 | All 3 previously-failing specs pass green under two-layer seed | e2e | `npx playwright test --config e2e/playwright.config.ts --grep @smoke` (after `supabase start` + `psql -f e2e/fixtures/seed.sql`) | ✅ files exist; assertions need patching |
| TEST-08-rule-fires | ESLint flags `cards.first()` w/o `.filter()` | unit (synthetic canary) | `printf "import { test } from '@playwright/test'\ntest('x', async ({ page }) => { await page.getByTestId('y').first() })\n" > e2e/tests/_lint-canary.spec.ts && npx eslint e2e/tests/_lint-canary.spec.ts; STATUS=$?; rm e2e/tests/_lint-canary.spec.ts; test "$STATUS" -ne 0` | ❌ Wave 0 — generated/torn down per run |
| TEST-08-rule-quiet | ESLint passes on the four updated specs | unit | `npx eslint e2e/tests/` (expect zero exit) | ✅ post-Wave 1 |
| TEST-08-readme | `e2e/README.md` ≥80 lines, contains `E2E-SCOPE-1` and `Locator.filter` | docs | `[ -f e2e/README.md ] && [ "$(wc -l < e2e/README.md)" -ge 80 ] && grep -q 'E2E-SCOPE-1' e2e/README.md && grep -q 'Locator.filter' e2e/README.md` | ❌ Wave 0 |
| TEST-09-cleanup | Fixture inserts +1 then deletes -1 row per test (no leak) | integration | `psql "$DB_URL" -c "select count(*) from polls where description = 'freshPoll fixture row' and created_at > now() - interval '5 minutes'"` (expect 0 after suite — narrowed to fixture-specific marker so static `b0000…*` seed rows do not false-positive) | ❌ Wave 0 — fixture file new |
| TEST-09-consumer | `browse-respond.spec.ts` passes via `freshPoll` fixture | e2e | `npx playwright test --config e2e/playwright.config.ts e2e/tests/browse-respond.spec.ts --grep @smoke` | ✅ file exists; needs migration |
| TEST-10-artifacts | Runbook exists, 03-UAT.md has Second-Human Verification section | docs | `[ -f .planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md ] && grep -q '^## Second-Human Verification' .planning/phases/03-response-integrity/03-UAT.md` | ❌ Wave 0 |
| TEST-10-readonly | TEST-10 task touches no `src/**` or `supabase/**` files | git diff | `git diff --name-only $(git merge-base HEAD main)..HEAD -- 'src/**' 'supabase/**' \| wc -l` should be 0 for the TEST-10 plan task | ✅ enforceable via task scoping |

---

## Wave 0 Requirements

- [ ] `e2e/fixtures/poll-fixture.ts` — `freshPoll` test-scoped fixture (TEST-09)
- [ ] `e2e/README.md` — convention + freshPoll usage + seed explainer + run-locally + gotchas (TEST-08)
- [ ] `.planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md` — second-human runbook (TEST-10 D-13)
- [ ] `eslint.config.js` — append `no-restricted-syntax` flat-config block scoped to `e2e/tests/**/*.spec.ts` (TEST-08 enforcement)
- [ ] `e2e/helpers/auth.ts` — add lazy `getAdminClient()` service-role getter (prerequisite for fixture; corrects CONTEXT L119)

*Existing infrastructure (Playwright 1.59.1, ESLint 9.39.4 flat config, CI lint+e2e jobs) is in place — no framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Second-human session for Phase 03 UAT Tests 2 + 3 | TEST-10 evidence | Requires a live non-2FA-blocked, non-WTCS-member Discord tester | Tester runs `08-UAT-10-SCRIPT.md` end-to-end; pastes filled evidence sub-block into `.planning/phases/03-response-integrity/03-UAT.md` under `## Second-Human Verification`. Phase 8 verification does NOT block on this evidence appearing — D-11 explicitly defers it. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 items above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s per task
- [ ] `nyquist_compliant: true` set in frontmatter (after planner confirms each plan task maps to a row in the verification table above)

**Approval:** pending
