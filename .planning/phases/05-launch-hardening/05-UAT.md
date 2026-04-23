---
status: partial
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
updated: 2026-04-21T00:30:00Z
---

## Current Test

[testing paused — 7 items blocked on merge-to-main; resume with /gsd-verify-work 5 after Phase 5 PR merges]

## Tests

### 1. Cold Start Smoke Test (Production)
expected: Fresh incognito tab at https://polls.wtcsmapban.com loads cleanly — Topics list renders, valid HTTPS cert, zero console errors.
result: pass

### 2. ConsentChip appears + dismisses (05-03)
expected: On /topics or / as a logged-in member, a ConsentChip appears (bottom-right) with "Opt out" + "×" close buttons. Clicking × dismisses it; reloading the page keeps it dismissed (localStorage-persisted). On /admin routes it does NOT appear.
result: blocked
blocked_by: prior-phase
reason: "Initially reported as issue on polls.wtcsmapban.com but user clarified Phase 5 is not yet merged to main; production deploy is pre-Phase-5 so ConsentChip code isn't live. Re-test after merge or against local dev / preview deploy. User's original verbatim response: 'I don't see the consent chip at all after login, this is a fresh incognito session so it should appear again no?'"

### 3. SuggestionSkeleton renders during load (05-04)
expected: With DevTools Network throttled to Slow 3G (or Fast 3G), navigate to /topics. Before real cards render you see 3 skeleton silhouettes matching card shape — rounded border, card padding, 3 shimmer rows. Layout does not shift when real data arrives.
result: blocked
blocked_by: prior-phase
reason: "Initially reported as cosmetic issue on polls.wtcsmapban.com but user clarified Phase 5 is not yet merged; prod skeleton may be the pre-Phase-5 flat-bars version, not the 05-04 card-silhouette update. Re-test after merge or against local dev. User's original verbatim response: 'yes, but the skeleton is not visible in light mode (way too hard to see given its color, I think its still there but just blends in)' — NOTE: low-contrast concern may or may not apply to the new silhouette variant; worth re-checking after merge."

### 4. Preload on hover: Topics/Archive warm, Admin cold (05-04)
expected: From / with DevTools Network open, hover over the "Topics" link in the navbar — you see a loader prefetch request fire within ~50ms. Same for "Archive". Hovering over the "Admin" link fires NO prefetch (protected route stays cold).
result: blocked
blocked_by: prior-phase
reason: "Initially reported as minor issue on polls.wtcsmapban.com but user clarified Phase 5 is not yet merged; the preload='intent' attributes from 05-04 are not live in prod. Re-test after merge or against local dev. User's original verbatim response: 'clicking topics archive is still a bit sluggish since things are still loading... Also why does this only work if you are on home route? If we are on topics and hover over archive or admin it should prefetch for them too (not on home route /?) Whats stopping us from doing it on intent rather than from the home route for presumably just the first time?' — NOTE: post-merge retest should explicitly verify prefetch fires from NON-home routes too."

### 5. Sentry + PostHog initialize on production (05-03, 05-08)
expected: On https://polls.wtcsmapban.com with DevTools Network tab open, you see requests to a sentry.io envelope endpoint (on errors/init) AND to the PostHog endpoint (capture) after consent. Console shows no Sentry/PostHog init errors. No VITE_SENTRY_AUTH_TOKEN leaks into the bundled JS (confirm by grepping bundle source for "SENTRY_AUTH_TOKEN" — should not appear).
result: blocked
blocked_by: prior-phase
reason: "User noted: well our code is not merged yet so sentry and posthog won't be there right? — Phase 5 branch has not been merged to main, so production deploy is still pre-Phase-5. Re-test after merge, or test against local dev / preview deploy."

### 6. CI workflow runs green on PR (05-06)
expected: Open the GitHub repo's Actions tab. The "CI" workflow has recent successful runs on main and/or a recent PR — both jobs (lint-and-unit, e2e) show green checkmarks. E2E job ran Playwright @smoke tests against a local Supabase stack.
result: blocked
blocked_by: prior-phase
reason: "User reported: nothing there did we deploy this action yet? Honestly we should probably merge the PR and then do this again — .github/workflows/ci.yml not yet on main (or no PR triggered yet); workflow is push-to-main + PR gated. Re-test after opening PR and/or merging."

### 7. Cron-sweep workflow dispatchable (05-07)
expected: In GitHub Actions, the "Cron Sweep" workflow is listed. Click "Run workflow" → "Run workflow" from main. After ~30s the run completes green and the log shows an HTTP 200 response with a JSON body like `{"success":true,"swept":N}`. (This is the deferred post-merge dry-run from 05-08.)
result: blocked
blocked_by: prior-phase
reason: "Scheduled/dispatchable workflows only register once the workflow file is on the default branch (main). Phase 5 branch not yet merged, so cron-sweep.yml is not yet discoverable in the Actions UI. Re-test post-merge."

### 8. README renders with screenshots + badges on GitHub (05-09, 05-10)
expected: Visit the repo README at github.com/<owner>/wtcs-community-polls. WTCS logo renders at the top, 4 shields.io badges render (build, license, Netlify, Supabase), and 4 screenshots render inline: topics-list, suggestion-with-results, admin-shell, mobile-view. All 13 D-15 sections present with correct headers.
result: blocked
blocked_by: prior-phase
reason: "Repo homepage renders the README of the default branch. Phase 5 branch (with new README + screenshots) not yet merged to main, so github.com repo root still shows pre-Phase-5 README. Re-test post-merge."

## Summary

total: 8
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 7

## Gaps

[none — tests 2/3/4/5 reclassified as blocked: Phase 5 branch not yet merged to main/prod at time of test; retest after merge against polls.wtcsmapban.com, or earlier against local dev / Netlify preview]
