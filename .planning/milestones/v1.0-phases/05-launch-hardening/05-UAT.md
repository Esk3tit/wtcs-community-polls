---
status: complete
phase: 05-launch-hardening
source:
  - 05-01-SUMMARY.md
  - 05-02-SUMMARY.md
  - 05-03-SUMMARY.md
  - 05-04-SUMMARY.md
  - 05-05-SUMMARY.md
  - 05-06-SUMMARY.md
  - 05-07-SUMMARY.md
  - 05-08-SUMMARY.md
  - 05-09-SUMMARY.md
  - 05-10-SUMMARY.md
started: 2026-04-21T00:00:00Z
updated: 2026-04-24T08:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test (Production)
expected: Fresh incognito tab at https://polls.wtcsmapban.com loads cleanly — Topics list renders, valid HTTPS cert, zero console errors.
result: pass

### 2. ConsentChip appears + dismisses (05-03)
expected: On /topics or / as a logged-in member, a ConsentChip appears (bottom-right) with "Opt out" + "×" close buttons. Clicking × dismisses it; reloading the page keeps it dismissed (localStorage-persisted). On /admin routes it does NOT appear.
result: pass

### 3. SuggestionSkeleton renders during load (05-04)
expected: With DevTools Network throttled to Slow 3G (or Fast 3G), navigate to /topics. Before real cards render you see 3 skeleton silhouettes matching card shape — rounded border, card padding, 3 shimmer rows. Layout does not shift when real data arrives.
result: pass

### 4. Preload on hover: Topics/Archive warm, Admin cold (05-04)
expected: From / with DevTools Network open, hover over the "Topics" link in the navbar — you see a loader prefetch request fire within ~50ms. Same for "Archive". Hovering over the "Admin" link fires NO prefetch (protected route stays cold). Also verify prefetch fires from NON-home routes (e.g. on /topics, hover /archive).
result: pass
verified_via: |
  Playwright MCP against https://polls.wtcsmapban.com/topics (authed session, 2026-04-23).
  - Hover Archive → archive-CH64s8Nl.js chunk fetched (prefetch fires from non-home route).
  - Hover Admin → no admin chunk fetched (stays cold per AdminGuard avoidance).
  - Code inspection: Navbar.tsx lines 29/45/53 preload="intent" on logo/Topics/Archive; line 60 Admin has no preload; main.tsx lines 11-15 no app-wide default.

### 5. Sentry + PostHog initialize on production (05-03, 05-08)
expected: On https://polls.wtcsmapban.com with DevTools Network tab open, you see requests to a sentry.io envelope endpoint (on errors/init) AND to the PostHog endpoint (capture) after consent. Console shows no Sentry/PostHog init errors. No VITE_SENTRY_AUTH_TOKEN leaks into the bundled JS (confirm by grepping bundle source for "SENTRY_AUTH_TOKEN" — should not appear).
result: pass
verified_via: |
  Playwright MCP confirmed posthog-recorder.js, dead-clicks-autocapture.js, surveys.js,
  and phc_ config.js loaded from us-assets.i.posthog.com (PostHog SDK live) during test 4.
  sentry-replay-*.js chunk loaded. User confirmed live behavior.

### 6. CI workflow runs green on PR (05-06)
expected: Open the GitHub repo's Actions tab. The "CI" workflow has recent successful runs on main and/or a recent PR — both jobs (lint-and-unit, e2e) show green checkmarks. E2E job ran Playwright @smoke tests against a local Supabase stack.
result: issue
reported: "Post-merge CI run 24825500181 on main (commit 385ed52) FAILED. lint-and-unit job failed with 'Missing Supabase environment variables' in 4 admin-shell tests (src/__tests__/admin/admin-shell.test.tsx: useCategoryMutations, usePromoteAdmin, useDemoteAdmin, useSearchAdminTargets). e2e job was SKIPPED due to lint-and-unit failure (needs: dependency). Root: tests dynamically import admin hook modules which eagerly evaluate src/lib/supabase.ts (lines 7-10) and throw if VITE_SUPABASE_URL/ANON_KEY env vars are missing in the CI job env. 353 other tests pass. Also: all recent dependabot PRs fail CI with the same env-var error (consistent pattern across main + 5 dep bump branches in the last hour)."
severity: blocker
resolution: |
  lint-and-unit: FIXED in commit e421455 on main (2026-04-24). Stubbed
  dummy VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in vite.config.ts
  `test.env` so vitest-time imports of src/lib/supabase.ts don't throw.
  357/357 unit tests now pass in CI without .env.local.

  e2e job: fixed across 5 commits on PR #10 (fix/seed-auth-users-fk):
    1. 2271bf1 — auth.users shim INSERT before profiles (FK violation
       was blocking `supabase start`)
    2. 3c17734 — curl-based REST readiness probe (old grep for 'API URL'
       didn't match CLI 2.92.1's 'Project URL' label)
    3. 2727664 — '' defaults for confirmation_token / recovery_token /
       email_change_token_new / email_change (GoTrue v2.188.1 can't
       scan NULL → Go string)
    4. 8b0cd81 — DO UPDATE (not DO NOTHING) on e2e fixture profiles so
       handle_new_user trigger's is_admin=false defaults get overridden
    5. c32e958 — remove temporary GoTrue diagnostic step

  After all 5 fixes the e2e job reaches Playwright and runs 8 tests;
  2 pass (auth-errors), 3 fail with test-authoring bugs that are NOT
  CI infra (see Gaps below).

### 7. Cron-sweep workflow dispatchable (05-07)
expected: In GitHub Actions, the "Cron Sweep" workflow is listed. Click "Run workflow" → "Run workflow" from main. After ~30s the run completes green and the log shows an HTTP 200 response with a JSON body like `{"success":true,"swept":N}`. (This is the deferred post-merge dry-run from 05-08.)
result: pass
verified_via: |
  Triggered run 24841958954 on main via `gh workflow run cron-sweep.yml`.
  Run completed success in ~10s. Log shows: "HTTP 200: {"success":true,"swept":5,"ids":[...]}"
  (Note: display name is "Daily close-expired-polls sweep", file is cron-sweep.yml.)

### 8. README renders with screenshots + badges on GitHub (05-09, 05-10)
expected: Visit the repo README at github.com/<owner>/wtcs-community-polls. WTCS logo renders at the top, 4 shields.io badges render (build, license, Netlify, Supabase), and 4 screenshots render inline: topics-list, suggestion-with-results, admin-shell, mobile-view. All 13 D-15 sections present with correct headers.
result: pass
verified_via: "User confirmed on 2026-04-24 after Phase 5 merge (385ed52) made the new README the default-branch README on github.com."

## Summary

total: 8
passed: 7
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "CI workflow (lint-and-unit + e2e) runs green on main and PRs after Phase 5 merge"
  status: failed
  reason: "User reported: Post-merge CI run on main (commit 385ed52, run 24825500181) failed. lint-and-unit errored with 'Missing Supabase environment variables' in 4 admin-shell tests; e2e skipped due to lint-and-unit failure. Same env-var error reproduces on 5+ dependabot PRs. Root: tests dynamically import admin hooks → src/lib/supabase.ts eagerly throws when VITE_SUPABASE_URL/ANON_KEY are absent from the CI job env."
  severity: blocker
  test: 6
  artifacts:
    - path: "src/lib/supabase.ts"
      issue: "throws on import when env vars missing — fails tests that only need the module present, not a live client"
    - path: "src/__tests__/admin/admin-shell.test.tsx"
      issue: "dynamic imports of admin hooks transitively hit supabase.ts"
    - path: ".github/workflows/ci.yml"
      issue: "lint-and-unit job likely missing VITE_SUPABASE_URL/ANON_KEY env or test setup shim"
  missing:
    - "Either stub VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in CI job env (simplest fix)"
    - "OR add a vitest setup file that sets these vars before any import"
    - "OR refactor supabase.ts to defer the env-var check until first use (lazy client creation)"
  debug_session: ""

- truth: "e2e/tests/admin-create.spec.ts smoke test passes in CI"
  status: failed
  reason: "Test fills only the Title field, then clicks the suggestion-form-submit button. Page stays on /admin/suggestions/new because <SuggestionForm> validates that both Choice 1 and Choice 2 are non-empty (see the form comment 'Each choice must be between 1 and 200 characters'). Submit is blocked, no navigation, and the subsequent `toHaveURL(/\\/admin(?:\\/suggestions)?\\/?(?:\\?.*)?$/)` times out after 14 polls."
  severity: major
  test: 6-followup
  artifacts:
    - path: "e2e/tests/admin-create.spec.ts"
      issue: "lines 30-42 miss a step to populate Choice 1/2 textboxes (or click the 'Yes/No' preset button)"
  missing:
    - "Before clicking suggestion-form-submit, click the 'Yes/No' preset button OR fill Choice 1 and Choice 2 with minimal strings"
  debug_session: "Diagnosed via Playwright report artifact from CI run 24877484418 — page snapshot shows form still on /admin/suggestions/new with Title filled but Choice 1 / Choice 2 textboxes empty"

- truth: "e2e/tests/browse-respond.spec.ts smoke test passes in CI"
  status: failed
  reason: "Test asserts firstCard.getByText(/\\d+\\s+total response/i) visible, but the fixture polls seeded by e2e/fixtures/seed.sql have zero votes — so no '<N> total response' text renders. Test needs either: (a) seed some votes before running, (b) loosen the selector, (c) accept '0 total responses' as valid initial state."
  severity: major
  test: 6-followup
  artifacts:
    - path: "e2e/tests/browse-respond.spec.ts"
      issue: "line 45 expect ignores the zero-vote initial state — never satisfied on fresh fixture data"
    - path: "e2e/fixtures/seed.sql"
      issue: "no votes seeded (only polls + choices), so the UI correctly renders no vote counts"
  missing:
    - "Either seed votes in e2e/fixtures/seed.sql for fixture polls, or rewrite the test to (1) cast a vote first then (2) assert the count becomes N>0, or (3) loosen the selector to accept '0 total'"
  debug_session: "Diagnosed from CI run 24877484418 Playwright report + seed file inspection"

- truth: "e2e/tests/filter-search.spec.ts smoke test passes in CI"
  status: failed
  reason: "Test uses `toHaveCount(expected)` on a category-filtered list. Expected count likely assumes a specific seed state that does not match what supabase/seed.sql + e2e/fixtures/seed.sql actually produces (b0000000-* polls + d0000000-* fixture polls both contribute). Needs an assertion that is resilient to both seed layers present, or an env flag to suppress the base seed when e2e fixtures are active."
  severity: major
  test: 6-followup
  artifacts:
    - path: "e2e/tests/filter-search.spec.ts"
      issue: "expected count assumes one seed layer; the real CI env has two (supabase/seed.sql + e2e/fixtures/seed.sql)"
  missing:
    - "Recompute the expected count against the combined seed OR assert `toHaveCount` with a dynamic lower bound OR disambiguate via the '[E2E]' title prefix used by fixture polls"
  debug_session: "Inferred from CI run 24877484418 failure pattern + dual-seed architecture in .github/workflows/ci.yml"
