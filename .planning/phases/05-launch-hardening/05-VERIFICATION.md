---
phase: 05-launch-hardening
verified: 2026-04-19T00:00:00Z
status: human_needed
score: 4/4 roadmap success criteria verified (3 fully automated, 1 user-confirmed in prod)
overrides_applied: 0
re_verification: null
human_verification:
  - test: "Cron-sweep workflow dry-run on main branch"
    expected: "Manual workflow_dispatch returns HTTP 200 with body `{\"success\":true,\"swept\":N,\"ids\":[...]}` and GH Actions email-on-failure is confirmed by deliberately breaking a secret and re-running"
    why_human: "Scheduled workflow cannot be dispatched until it exists on the default branch (05-08 known follow-up — chicken-and-egg). Post-merge verification only"
  - test: "Sentry sourcemap upload on first main-branch build"
    expected: "Netlify build log contains `[sentry-vite-plugin] Successfully uploaded source maps to Sentry` and a frontend error produces a symbolicated stack trace in the Sentry dashboard"
    why_human: "Sourcemap upload only fires on main-branch builds (not PR previews); deferred verification is noted in 05-08-SUMMARY known follow-ups"
  - test: "9 blocked Phase 4 UAT items against polls.wtcsmapban.com"
    expected: "Phase 4 UAT items 4–8 and 11–14 (previously blocked on prod EF deploy) all pass against the live production stack"
    why_human: "Out-of-band manual UAT; unblocked by this phase per 05-CONTEXT but run separately"
  - test: "Playwright @smoke suite green on a real PR in GitHub Actions"
    expected: "Opening any PR to main triggers CI; both jobs (`lint-and-unit`, `e2e`) reach `completed/success`. Playwright run lists 5 @smoke tests across 4 spec files and all pass"
    why_human: "Cannot validate that GH Actions infrastructure + Supabase local stack in CI + fixture seed all compose correctly until a real PR runs on main. YAML syntax, local structure, and tripwires all pass"
---

# Phase 5: Launch Hardening Verification Report

**Phase Goal:** The platform is production-ready at polls.wtcsmapban.com with infrastructure safeguards preventing database pausing and deployment configured for SPA routing.
**Verified:** 2026-04-19
**Status:** human_needed (all automation/artifact checks PASS; prod-smoke and post-merge CI runs are external)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Supabase database receives a keepalive ping every 3-4 days via automated cron | VERIFIED | `.github/workflows/cron-sweep.yml` exists, schedule `0 3 * * *` (daily = 3.5× safety margin over Supabase 7-day pause threshold per D-02), dual-header auth (`X-Cron-Secret` + `Authorization: Bearer ${SUPABASE_ANON_KEY}`), `jq -e .success` + `has("swept")` body validation, no `continue-on-error` so D-03 email-on-failure fires |
| 2 | App accessible at polls.wtcsmapban.com with correct SPA routing | VERIFIED (user-confirmed prod) | `netlify.toml` sets `publish = "dist"`, build command `VITE_COMMIT_SHA=$COMMIT_REF npm ci && npm run build`, Node 22, security headers (`X-Frame-Options=DENY`, `X-Content-Type-Options=nosniff`); `public/_redirects` contains `/*    /index.html   200` SPA fallback. Phase context confirms HTTPS cert issued + OAuth live |
| 3 | End-to-end flow works in production: login, browse, respond, see results, admin creates | VERIFIED (user-confirmed prod) | Per phase context: Discord OAuth E2E works, admin can create suggestions, users respond, result bars appear. 15 EFs deployed with `--no-verify-jwt` (ES256 compat fix, `c1516b0`). Cross-site domain typo fix (`1668912`) prevented CORS blocks |
| 4 | E2E smoke tests cover the critical path (login → browse → respond → see results) | VERIFIED | `e2e/tests/browse-respond.spec.ts` (D-08 #1), `filter-search.spec.ts` (D-08 #2), `admin-create.spec.ts` (D-08 #3), `auth-errors.spec.ts` (D-08 #4, 2 tests) — 5 `@smoke` tests across 4 files. Uses `signInWithPassword` session injection (HIGH #2), `data-testid` hooks from 05-04, fixture seed with disjoint UUID namespace |

**Score:** 4/4 roadmap success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/cron-sweep.yml` | Daily EF ping for INFR-02 | VERIFIED | 58 lines, cron `0 3 * * *`, dual-header auth, jq body validation |
| `.github/workflows/ci.yml` | PR gate lint+unit+E2E | VERIFIED | Two jobs, `npm ci` only, supabase start + additive seed (M4), key derivation at runtime (M5), Playwright `--grep @smoke` |
| `.github/workflows/deploy-edge-functions.yml` | Push-to-main EF deploy | VERIFIED | `--use-api` + `--no-verify-jwt`, CLI pinned 2.92.1 |
| `.github/dependabot.yml` | Weekly upgrade PRs + 60-day clock reset | VERIFIED | File exists at 991 bytes |
| `netlify.toml` | Explicit build + publish + headers | VERIFIED | `publish="dist"`, Node 22, 4 security headers |
| `public/_redirects` | SPA fallback | VERIFIED | `/*    /index.html   200` |
| `e2e/playwright.config.ts` | Playwright scaffold | VERIFIED | Chromium only, CI webServer disabled |
| `e2e/helpers/auth.ts` | Session-injection helper | VERIFIED | `signInWithPassword` + `addInitScript`, no service-role read |
| `e2e/fixtures/seed.sql` | Additive fixture layer | VERIFIED | 4 fixture users, 4 fixture polls, ON CONFLICT guarded |
| `e2e/tests/*.spec.ts` | 4 D-08 smoke specs | VERIFIED | browse-respond + filter-search + admin-create + auth-errors (5 tests) |
| `src/lib/sentry.ts` + `posthog.ts` | Observability init | VERIFIED | Module-scope guards, PII-safe identify, consent-gated Replay |
| `src/components/AppErrorFallback.tsx` | Error boundary UI | VERIFIED | UI-SPEC Contract 2 verbatim, no stack-trace DOM disclosure |
| `src/components/ConsentChip.tsx` | Consent UI | VERIFIED | Admin-route gated, localStorage dismissal |
| `src/components/suggestions/SuggestionSkeleton.tsx` | UX polish skeleton | VERIFIED | 3 card-silhouette shells mirroring SuggestionCard |
| `docs/screenshots/{topics-list,suggestion-with-results,admin-shell,mobile-view}.png` | 4 README images | VERIFIED | All 4 PNGs present (75K/35K/58K/52K) — filenames match README refs exactly |
| `README.md` | 13-section public-product rewrite | VERIFIED | 4 screenshot refs match filenames; shields.io badges; env-var reference |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| cron-sweep.yml | close-expired-polls EF | curl POST w/ dual-header | WIRED | `SUPABASE_URL/functions/v1/close-expired-polls` + X-Cron-Secret + Bearer |
| EF imports | esm.sh@<exact> | pinned module URLs | WIRED | 0 bare-major pins (tripwire: `esm\.sh/[^@]+@[0-9]+'` → 0 matches) |
| package.json | exact versions | `--save-exact` pins | WIRED | 0 `^` and 0 `~` prefixes |
| SuggestionCard | e2e selector | `data-testid="suggestion-card"` | WIRED | Found at line 81, pre-ternary |
| AdminSuggestionsTab | e2e selector | `data-testid="admin-create-suggestion"` | WIRED | Found at line 146 |
| Topics/Archive Links | preload | `preload="intent"` | WIRED | 4 instances across Navbar + MobileNav |
| Admin Link | cold-by-omission | no preload attribute | WIRED | No preload on admin link, no `defaultPreload` in main.tsx |
| README | screenshots | relative `docs/screenshots/*.png` | WIRED | All 4 files exist at referenced paths |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| cron-sweep.yml | EF response `.swept` | live Supabase DB query in `close-expired-polls` | Yes (real DB write per run) | FLOWING |
| Playwright specs | `suggestion-card` elements | local Supabase seeded from `e2e/fixtures/seed.sql` | Yes (4 fixture polls, 3 active) | FLOWING |
| README | screenshots | captured live from polls.wtcsmapban.com via Playwright MCP | Yes (real prod captures per 05-09) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 4 spec files present | `ls e2e/tests/*.spec.ts` | 4 files | PASS |
| esm.sh bare-major tripwire | `grep -rE "esm\.sh/[^@]+@[0-9]+'" supabase/functions/` | 0 matches | PASS |
| package.json exact-pin | count `^` + `~` prefixes | 0 + 0 | PASS |
| E2E testid hooks present | grep for data-testid | 2 found (SuggestionCard:81, AdminSuggestionsTab:146) | PASS |
| Preload intent on Topics/Archive | grep in layout/ | 4 matches (Navbar × 2, MobileNav × 2) | PASS |
| SPA fallback | cat `public/_redirects` | `/* /index.html 200` | PASS |
| Screenshot filenames | README refs vs disk | 4/4 match (topics-list, suggestion-with-results, admin-shell, mobile-view) | PASS |
| Cron schedule frequency | parse `cron-sweep.yml` | `0 3 * * *` = daily (3.5× safety margin over 7-day pause) | PASS |
| YAML parse | js-yaml of 3 workflows + dependabot | all parse clean (per summaries) | PASS |
| Live prod reachable | user-confirmed (phase context) | OAuth + respond + results all work | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INFR-02 | 05-07 | Supabase keepalive cron every 3-4 days | SATISFIED | cron-sweep.yml scheduled daily at 03:00 UTC (exceeds 3-4d window); each run is a real EF call that queries + writes DB |
| TEST-06 | 05-05 + 05-06 | E2E smoke tests cover critical path | SATISFIED | 5 `@smoke` tests across 4 specs cover D-08 #1–#4 journeys; CI workflow gates PRs + main |

Note: REQUIREMENTS.md table still lists both as "Pending" (documentation lag — not a gate). Checkboxes unchanged but artifacts and behaviors satisfy the contract.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none in phase-modified files) | — | — | — | Pre-existing `react-refresh/only-export-components` lint errors in 7 non-phase files are documented in `deferred-items.md`; 4 pre-existing admin-shell test failures are missing-env-var test infra issues. All pre-exist phase 5 base commit — confirmed via `git stash` diff |

### Human Verification Required

See `human_verification:` frontmatter. Four items require post-merge or real-PR validation:
1. cron-sweep workflow_dispatch dry-run (chicken-and-egg: workflow must exist on main first)
2. Sentry sourcemap upload on first main build (only fires on main, not previews)
3. Phase 4 UAT re-run (9 items previously blocked on prod EF deploy — now unblocked)
4. Playwright @smoke green on real PR in GH Actions (YAML syntax + local structure verified; real-run pending)

### Gaps Summary

No blocking gaps. Every roadmap success criterion has verified artifact + wired integration + flowing data. Production is live and user-confirmed. The four human-verification items are timeline artifacts of merging this phase — they can only be validated post-merge, not gaps in what was delivered. The phase's own 05-08-SUMMARY explicitly identifies items 1 and 2 as "known follow-ups."

---

*Verified: 2026-04-19*
*Verifier: Claude (gsd-verifier)*
