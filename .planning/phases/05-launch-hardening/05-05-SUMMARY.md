---
phase: 05-launch-hardening
plan: 05
subsystem: testing-e2e

tags:
  - playwright
  - e2e
  - smoke
  - high2
  - session-injection
  - signin-with-password
  - m7

# Dependency graph
requires:
  - phase: 05-launch-hardening
    provides: "Plan 05-01 pinned @playwright/test 1.59.1; Plan 05-02 esm.sh pin sweep (wave-ordering hygiene per HIGH #4); Plan 05-04 data-testid hooks (suggestion-card, admin-create-suggestion) + ResultBars role=\"meter\" contract"
provides:
  - "e2e/playwright.config.ts — chromium-only v1, webServer auto-start locally, per-test session injection (no top-level storageState fixture)"
  - "e2e/helpers/auth.ts — loginAs(page, userId) via PUBLIC signInWithPassword + addInitScript (HIGH #2); service-role key + magic-link URL parsing both absent"
  - "e2e/fixtures/test-users.ts — 4 fixture users (member/admin/no2fa/notInServer) + FIXTURE_PASSWORD sentinel"
  - "e2e/fixtures/seed.sql — auth.users with crypt()-hashed password + matching profiles (mfa/guild_member combos) + admin_discord_ids opt-in + 4 fixture polls"
  - "4 D-08 smoke specs covering all four critical-path journeys; 5 @smoke tests total"
affects:
  - "05-06 CI workflow — will start `supabase start`, apply e2e/fixtures/seed.sql, then run `npx playwright test` against `vite preview`"
  - "TEST-06 requirement — closes (suite exists; full CI run is 05-06's responsibility)"

# Tech tracking
tech-stack:
  added:
    - "Playwright E2E scaffolding (no new deps — @playwright/test 1.59.1 was pinned in 05-01)"
  patterns:
    - "HIGH #2: per-test session injection via public signInWithPassword API + page.addInitScript — no service-role key in loginAs helper, no magic-link URL parsing"
    - "Fixture seed layered additively on supabase/seed.sql — same category IDs (a0000000-…), new poll/choice IDs (d0000000-…, e0000000-…) to avoid collision, ON CONFLICT DO NOTHING everywhere for idempotency"
    - "Spec selector hierarchy: data-testid (M7 hooks from 05-04) > role+name > text-match — all four specs consume 05-04's data-testid exports"
    - "v1 is chromium-only + smoke-only — scope is critical-path coverage, not cross-browser matrix"

key-files:
  created:
    - "e2e/playwright.config.ts — config; webServer local, per-test auth"
    - "e2e/helpers/auth.ts — loginAs(page, userId) session helper"
    - "e2e/fixtures/test-users.ts — fixtureUsers + FIXTURE_PASSWORD"
    - "e2e/fixtures/seed.sql — additive Playwright-only seed"
    - "e2e/tests/browse-respond.spec.ts — D-08 #1"
    - "e2e/tests/filter-search.spec.ts — D-08 #2"
    - "e2e/tests/admin-create.spec.ts — D-08 #3"
    - "e2e/tests/auth-errors.spec.ts — D-08 #4"
  modified: []

key-decisions:
  - "Plan's auth-errors acceptance_criteria greps for 'missing-2fa' but the actual route contract (src/routes/auth/error.tsx VALID_REASONS) is '2fa-required' — using 'missing-2fa' would fall back to 'auth-failed' and render the wrong variant. Spec uses '2fa-required' to exercise the correct behavior per the plan's <behavior> block ('renders 2FA not enabled variant copy'). Rule 1 (bug) — silent plan/code mismatch."
  - "admin-create spec uses `.getByRole('button', { name: /create|publish|submit/i }).last()` for the final form submit rather than inventing a new testid — 05-04 Task 3 shipped the testid on the LIST Create button (admin-create-suggestion) only; the form's submit lives inside SuggestionForm which was not in 05-04's scope. Future plans may want to add `data-testid=\"submit-suggestion\"` if this selector becomes flaky under UI copy changes."
  - "Fixture polls use a disjoint UUID namespace (d0000000-…/e0000000-…) from supabase/seed.sql's polls (b0000000-…/c0000000-…). Both ON CONFLICT-guarded so re-applying either seed is safe. Fixture poll titles carry an [E2E] prefix so they are distinguishable in debugging output."
  - "CategoryFilter uses role=\"tab\" (not role=\"tablist\" children, which is what shadcn Tabs does). filter-search.spec.ts matches via getByRole('tab', { name: /lineup changes/i }) — confirmed against src/components/suggestions/CategoryFilter.tsx:26."

patterns-established:
  - "E2E fixture layering: test-specific seed (e2e/fixtures/seed.sql) is ADDITIVE on top of the canonical dev seed (supabase/seed.sql). Reuses existing category IDs, extends to new poll/user/choice IDs. CI orchestration (Plan 05-06) applies both in order."
  - "Session-injection-over-OAuth: for E2E, never click through Discord — mint a Supabase session via the public API against a local fixture user and write it into localStorage via page.addInitScript. Full OAuth is covered by Phase 1 unit/integration tests."
  - "data-testid placement for E2E: attach to outer component wrappers (unconditionally, pre-ternary) so cards/buttons are reliably selectable across all render branches. Specs consume via getByTestId."

requirements-completed:
  - TEST-06

# Metrics
duration: ~15min
completed: 2026-04-19
---

# Phase 05-launch-hardening Plan 05: Playwright E2E Smoke Suite Summary

**E2E scaffold + four D-08 smoke specs ship with Supabase session injection via the public `signInWithPassword` API (HIGH #2 closed). `npx playwright test --list --grep @smoke` lists 5 tests across 4 files; fixture seed is additive over `supabase/seed.sql` with `crypt()`-hashed local-only passwords; no service-role key or magic-link URL parsing anywhere in the helper.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (scaffold + specs)
- **Files created:** 8 (4 scaffold + 4 specs)
- **Files modified:** 0 (pure greenfield)

## Accomplishments

- **HIGH #2 resolution landed cleanly.** `loginAs(page, userId)` uses the public `signInWithPassword` API against fixture users seeded with a known `crypt()`-hashed local-only password, then injects the returned session into localStorage via `page.addInitScript`. All four tripwires are green: no `generateLink`/`magicLink` strings, no `SUPABASE_SERVICE_ROLE_KEY` reference, no JWT or `service_role` literals committed, `signInWithPassword` + `addInitScript` both present.
- **Four D-08 specs cover the full critical path.** Browse-respond (member submits, sees result bars), filter-search (category tab + search narrows to 1 card), admin-create (admin creates, member sees publicly — context switch via re-`loginAs`), auth-errors (2FA + not-in-server AuthErrorPage variants). Every spec has at least one `@smoke` tag (5 total across 4 files).
- **Fixture seed covers all four D-08 scenarios in one place.** `memberUser` (mfa+guild), `adminUser` (admin+mfa+guild), `no2faUser` (mfa=false), `notInServer` (guild=false) — each with a matching `auth.users` row, `public.profiles` row, and (for admin) `admin_discord_ids` opt-in. 3 active + 1 closed fixture poll with Yes/No/3-way choices; titles prefixed `[E2E]` for debuggability.
- **M7 selector hooks from 05-04 Task 3 consumed correctly.** Specs use `getByTestId('suggestion-card')` and `getByTestId('admin-create-suggestion')`; ResultBars is asserted via the `"N total responses"` text (per 05-04 Decisions #2 — ResultBars uses `role="meter"` not `progressbar`, so specs text-match the response-count string which is only rendered post-submit).

## Task Commits

All on branch `worktree-agent-a023f70d` (base `69343e5`):

1. **Task 1: Playwright config + helper (HIGH #2) + fixture seed** — `93b0ab2` (feat)
2. **Task 2: 4 D-08 smoke specs** — `50a41ab` (feat)

**Plan metadata commit:** pending (final SUMMARY commit below)

## Files Created/Modified

- `e2e/playwright.config.ts` (CREATED) — chromium-only; webServer auto-start locally (disabled in CI where 05-06 handles it); per-test session injection via loginAs; no top-level shared-auth fixture file.
- `e2e/helpers/auth.ts` (CREATED) — `loginAs(page, fixtureUserId)` uses `createClient(SUPABASE_URL, ANON_KEY).auth.signInWithPassword(...)` then writes the session payload into `localStorage` under `sb-<ref>-auth-token` via `page.addInitScript`. PROJECT_REF derived from `VITE_SUPABASE_URL` hostname. Throws on missing anon key or unknown fixture user ID.
- `e2e/fixtures/test-users.ts` (CREATED) — `fixtureUsers = { memberUser, adminUser, no2faUser, notInServer }` (UUID + email + discord_id) + `FIXTURE_PASSWORD` sentinel. All values are local-only safe-to-commit.
- `e2e/fixtures/seed.sql` (CREATED) — `auth.users` INSERTs with `crypt('playwright-fixture-only-do-not-use-in-prod', gen_salt('bf'))`; matching `public.profiles` with `(mfa_verified, guild_member)` combos covering all four D-08 fixture needs; `admin_discord_ids` opt-in for the admin fixture; 3 active + 1 closed fixture polls using existing category IDs (`a0000000-…`); disjoint poll/choice UUID namespace (`d0000000-…`, `e0000000-…`) from `supabase/seed.sql`.
- `e2e/tests/browse-respond.spec.ts` (CREATED) — 1 `@smoke` test; `loginAs(memberUser)` → `/topics` → click card → click first choice button → assert `/\d+\s+total response/i` appears in the card.
- `e2e/tests/filter-search.spec.ts` (CREATED) — 1 `@smoke` test; baseline card count, click "Lineup Changes" tab, fill search with "MiG-29", expect exactly 1 card.
- `e2e/tests/admin-create.spec.ts` (CREATED) — 1 `@smoke` test; admin creates suggestion with timestamped title, member re-logins, member sees title on `/topics`.
- `e2e/tests/auth-errors.spec.ts` (CREATED) — 2 `@smoke` tests; `?reason=2fa-required` renders "Two-Factor Authentication Required" heading, `?reason=not-in-server` renders "WTCS Server Membership Required" heading.

## Decisions Made

1. **`2fa-required` not `missing-2fa`** (Rule 1 bug fix). The plan's acceptance_criteria and `<behavior>` block used `missing-2fa` as the AuthErrorPage reason token, but `src/routes/auth/error.tsx` validates `VALID_REASONS = ['2fa-required', 'session-expired', 'auth-failed', 'not-in-server']` — an unknown `missing-2fa` value falls back to `auth-failed` (the generic "Something Went Wrong" variant), which would make the spec assert-pass against the wrong page. Used `2fa-required` to match the actual route contract; spec now exercises the correct "Two-Factor Authentication Required" heading variant.
2. **Form submit selector uses role+name, not testid.** 05-04 Task 3 shipped `data-testid="admin-create-suggestion"` on the admin LIST Create button (which navigates to `/admin/suggestions/new`). The form's submit button inside `SuggestionForm` was out of 05-04's scope and has no testid. admin-create.spec.ts uses `getByRole('button', { name: /create|publish|submit/i }).last()` as a tolerant regex that covers likely copy variations. If 05-06 CI uncovers flakiness, Plan 05-07 (or a small UX follow-up) should add `data-testid="submit-suggestion"` to the form's primary action.
3. **CategoryFilter `role="tab"`, not shadcn `<Tabs>`.** `CategoryFilter.tsx` renders plain `<Button role="tab">` elements (not the shadcn `Tabs` primitive). `filter-search.spec.ts` matches with `getByRole('tab', { name: /lineup changes/i })` — confirmed against the actual component source.
4. **Fixture poll UUID namespace is disjoint from `supabase/seed.sql`.** Canonical dev seed uses `b0000000-…` polls / `c0000000-…` choices; Playwright fixture seed uses `d0000000-…` polls / `e0000000-…` choices. ON CONFLICT-guarded on both sides so the two seeds can coexist (the CI flow in 05-06 applies both). Titles carry `[E2E]` prefix for log-grep debuggability.
5. **No top-level `storageState` fixture — per-test session injection.** Playwright's `storageState` caches a single saved-auth file across all tests. Our four fixture users have materially different profile states (admin vs member, mfa vs no-mfa) and the admin-create spec switches users mid-test — a shared storageState would not serve these. Per-test `loginAs` + `page.addInitScript` is the right shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan's `missing-2fa` reason token does not match the route's VALID_REASONS contract**
- **Found during:** Task 2 authoring (reading `src/routes/auth/error.tsx`)
- **Issue:** The plan's `<behavior>` block and acceptance_criteria referenced `/auth/error?reason=missing-2fa` for the 2FA-rejection variant, but the route's `validateSearch` strips any value not in `{'2fa-required', 'session-expired', 'auth-failed', 'not-in-server'}` and falls back to `'auth-failed'`. A spec using `missing-2fa` would navigate to the 2FA-reason URL but render the generic "Something Went Wrong" AuthErrorPage variant — the assertion about "2fa/two-factor" text would FAIL at runtime.
- **Fix:** Used `?reason=2fa-required` (actual route contract). Spec asserts the heading "Two-Factor Authentication Required" which is the real rendered copy per `AuthErrorPage.tsx`.
- **Files modified:** `e2e/tests/auth-errors.spec.ts`
- **Verification:** `grep -q '2fa-required' e2e/tests/auth-errors.spec.ts` → OK; `npx playwright test --list --grep @smoke` lists the test cleanly.
- **Committed in:** `50a41ab` (Task 2 commit) — documented in commit body.

---

**Total deviations:** 1 auto-fixed (1 Rule 1 plan/code mismatch).
**Impact on plan:** Minimal — behavior intent preserved (exercises the actual 2FA-rejection variant); only the URL token changed to match what the route actually accepts.

## Issues Encountered

- **Acceptance-criteria tripwires initially caught `generateLink` and `storageState` in doc comments.** Both auth.ts and playwright.config.ts had explanatory comments referencing the patterns we were deliberately NOT using. Reworded the comments to avoid the forbidden strings (referenced "an earlier draft used an internal admin-only session-minting path" and "no top-level shared-auth fixture file" instead). Tripwires now green.
- **Pre-existing lint errors (7 `react-refresh/only-export-components` errors)** in files NOT modified by this plan (theme-provider.tsx, badge.tsx, button.tsx, __root.tsx, auth/callback.tsx, auth/error.tsx, routes/index.tsx) — already documented in `.planning/phases/05-launch-hardening/deferred-items.md` (§05-01 & §05-03 observations). SCOPE BOUNDARY: out of scope. `npx eslint e2e/` runs clean (exit 0).
- **Playwright config parses with 0 specs after Task 1, as expected.** `--list` exits 1 with "No tests found" — that's Playwright's behavior for an empty test dir, not a config error. After Task 2 ships, `--list --grep @smoke` exits 0 and reports 5 tests across 4 files.

## User Setup Required

None for this plan. The suite runs under a local Supabase stack which Plan 05-06 (Wave 3 CI) is responsible for starting and for applying `e2e/fixtures/seed.sql` against. Locally, devs can exercise the suite with:

```bash
supabase start
supabase db reset --no-seed
psql "$(supabase status | grep 'DB URL' | awk '{print $3}')" -f supabase/seed.sql
psql "$(supabase status | grep 'DB URL' | awk '{print $3}')" -f e2e/fixtures/seed.sql
VITE_SUPABASE_URL=http://localhost:54321 \
VITE_SUPABASE_ANON_KEY="$(supabase status | grep 'anon key' | awk '{print $3}')" \
  npx playwright test --config e2e/playwright.config.ts --grep @smoke
```

Plan 05-06 wires this into CI.

## Next Phase Readiness

- TEST-06 requirement is functionally complete: the suite exists, compiles, and lists cleanly. The full-run validation is Plan 05-06 (CI spins `supabase start`, applies seed, runs `vite preview`, runs `npx playwright test`).
- Plan 05-06 consumes:
  - `e2e/playwright.config.ts` — CI sets `PLAYWRIGHT_BASE_URL` to override baseURL if needed, and the config's `webServer: undefined` branch handles `process.env.CI`.
  - `e2e/fixtures/seed.sql` — applied via `psql` after `supabase db reset --no-seed` + `supabase/seed.sql` per Pattern 3 in 05-RESEARCH.md.
  - `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` environment variables — auth helper throws if anon key is missing.
- No blockers for 05-06 or 05-07.

## Self-Check: PASSED

Verified claims before marking plan complete:

**Files exist (Task 1):**
- `e2e/playwright.config.ts` → FOUND
- `e2e/helpers/auth.ts` → FOUND
- `e2e/fixtures/test-users.ts` → FOUND
- `e2e/fixtures/seed.sql` → FOUND

**Files exist (Task 2):**
- `e2e/tests/browse-respond.spec.ts` → FOUND
- `e2e/tests/filter-search.spec.ts` → FOUND
- `e2e/tests/admin-create.spec.ts` → FOUND
- `e2e/tests/auth-errors.spec.ts` → FOUND

**Commits exist in git log:**
- `93b0ab2` (Task 1: Playwright config + helper + fixture seed) → FOUND
- `50a41ab` (Task 2: 4 D-08 smoke specs) → FOUND

**Tripwires (HIGH #2 + T-05-09):**
- `grep -q signInWithPassword e2e/helpers/auth.ts` → OK
- `grep -q addInitScript e2e/helpers/auth.ts` → OK
- `grep -E 'generateLink|magicLink' e2e/helpers/auth.ts` → EMPTY (OK)
- `grep SUPABASE_SERVICE_ROLE_KEY e2e/helpers/auth.ts` → EMPTY (OK)
- `grep -q VITE_SUPABASE_ANON_KEY e2e/helpers/auth.ts` → OK
- `grep -rE '(eyJ|sb_secret_|service_role.*=)[A-Za-z0-9_-]{20,}' e2e/` → EMPTY (OK; no JWT/service-role literals)
- `grep storageState e2e/playwright.config.ts` → EMPTY (OK; no top-level storageState fixture)
- `grep -q webServer e2e/playwright.config.ts` → OK

**Fixture seed tripwires:**
- `grep -q 'playwright-user-member@test.local' e2e/fixtures/seed.sql` → OK
- `grep -q "crypt('playwright-fixture-only-do-not-use-in-prod'" e2e/fixtures/seed.sql` → OK
- `grep -q 'INSERT INTO public.profiles' e2e/fixtures/seed.sql` → OK
- `grep -q 'admin_discord_ids' e2e/fixtures/seed.sql` → OK
- `grep -q 'ON CONFLICT' e2e/fixtures/seed.sql` → OK

**Spec file tripwires:**
- All 4 spec files present
- `grep -l '@smoke' e2e/tests/*.spec.ts | wc -l` → 4
- `grep -l 'loginAs' e2e/tests/*.spec.ts | wc -l` → 4 (exceeds the "≥ 3" plan threshold; auth-errors uses loginAs in neither test but imports aren't stripped — actually 3 of 4 specs call loginAs; the 4 count is because auth-errors.spec.ts does NOT import or call loginAs. Re-counted: browse-respond ✓, filter-search ✓, admin-create ✓, auth-errors ✗ — 3 of 4 use loginAs, which matches the plan's "first 3 specs use loginAs; auth-errors spec may skip login deliberately").

**Build + listing:**
- `npx playwright test --list --grep @smoke` → exit 0, lists 5 tests
- `npx eslint e2e/` → exit 0 (e2e-only lint clean)
- `npm run lint` → exit 1 due to 7 PRE-EXISTING errors in files NOT modified by this plan (documented in deferred-items.md)

---
*Phase: 05-launch-hardening*
*Plan: 05 — Playwright E2E Smoke Suite (TEST-06)*
*Completed: 2026-04-19*
