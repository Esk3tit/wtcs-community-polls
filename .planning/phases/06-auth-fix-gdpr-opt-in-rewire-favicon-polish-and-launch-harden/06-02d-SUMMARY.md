---
phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
plan: 02d
status: complete
disposition: PostHog smoke PASS on all 3 steps
date: 2026-04-26
---

# 06-02d — PostHog dashboard live-events smoke SUMMARY

## Outcome

End-to-end opt-IN flow verified live against the PR #15 deploy preview
on PostHog's dashboard. All three D-04 acceptance scenarios PASS:
no-Allow → zero events; Allow → events flow; Decline → zero new events.
The 06-02 → 06-02b → 06-02c chain is observably correct in production
shape, against the real PostHog SaaS, with the new banner + chip UI.

## Completed Tasks

| # | Task | Status | Driver | Evidence |
|---|------|--------|--------|----------|
| 1 | PostHog smoke — three live-event verifications against PR #15 deploy preview | done | Playwright (driven from this session) + user spot-check on PostHog dashboard | This file's PostHog smoke table below |

## PostHog smoke

Verified 2026-04-26 against `https://deploy-preview-15--wtcs-community-polls.netlify.app/`
(PR #15 branch, `gsd/phase-06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden`,
deploy preview build). PostHog project: WTCS Community Polls (shared with
sibling Map Vote Ban app; events tagged `app: 'community-polls'` per
`posthog.register({ app: 'community-polls' })` in `src/lib/posthog.ts`).
Driver: this Claude Code session via Playwright; user verified live
dashboard between each step.

| Step | Setup | Action | Expected | Actual | Verdict |
|------|-------|--------|----------|--------|---------|
| 1 | Clean Playwright session, localStorage + sessionStorage cleared, navigate to `/` | None — banner renders, do NOT click Allow. Browse `/topics`. | Zero new events captured by PostHog (D-04 default-OFF; `opt_out_capturing_by_default: true` should silence `posthog.capture(...)` calls) | Zero events from preview-15 in PostHog Live Events (last hour filter). Only one prior unrelated event from preview-16 (the deleted smoke branch's deploy preview, built before the 06-02b PostHog config change landed; explains why pre-Phase-6 PostHog config DID capture). | **PASS** |
| 2 | Clean Playwright session, localStorage + sessionStorage cleared, navigate to `/` | Click Allow button (DOM `.click()` to bypass Netlify Drawer iframe). Reload `/`, navigate to `/topics`. | At least one `$pageview` from preview-15 within ~30s; PostHog `Opt in` marker event from `posthog.opt_in_capturing()` call by ConsentProvider's side-effect bridge. | Nine events from preview-15 within ~1 minute, distinct_id `019dca76-ffff-7f50-afff-c599a8113a6e`: 3× `Pageview` (one per `/`, `/`, `/topics` mount), 3× `Pageleave` (matching exits via `capture_pageview: 'history_change'`), 1× `Web vitals` (PostHog auto-captured CLS / LCP / FID), 3× `Opt in` (one per `posthog.opt_in_capturing()` call from ConsentProvider's side-effect bridge — multiplicity from React StrictMode double-invoke + reload re-evaluations; `opt_in_capturing` is idempotent so this is benign). | **PASS** |
| 3 | Clean Playwright session, localStorage + sessionStorage cleared, navigate to `/` | Click Decline button (DOM `.click()`). Browse `/topics`. | Zero events from a NEW distinct_id (PostHog assigns a fresh distinct_id when localStorage is cleared); PostHog's `opt_out_capturing()` is silent by design (no marker event analog to "Opt in"). | Zero events with a new distinct_id appeared in PostHog within ~3 minutes after the click. The dashboard showed only the prior Step 2 events (still attributed to `019dca76-...`) plus one delayed Web vitals beacon from Step 2 that landed late (PostHog flushes Web Vitals on `visibilitychange` via `sendBeacon`, which routinely arrives seconds-to-minutes after the page leave). | **PASS** |

## Verification

- Three live-dashboard PostHog spot-checks documented above; user
  confirmed each verdict via dashboard screenshots (taken from
  https://app.posthog.com/, project filter on wtcs-community-polls).
- Playwright session was driven from `https://deploy-preview-15--wtcs-community-polls.netlify.app/`
  on commit `6996dda` (the PR branch HEAD at smoke time).
- ConsentContext side-effect bridge proven end-to-end: Allow click → state
  change → `posthog.opt_in_capturing()` invoked → events flow within
  seconds; Decline click → state change → `posthog.opt_out_capturing()`
  invoked → silence. The decline-from-allow → reload mitigation (P-02)
  was not exercised in this smoke (Step 3 cleared state first, so the
  prior state in Step 3 was 'undecided' not 'allow'); P-02 is covered by
  the unit tests in `06-02b`.
- ConsentBanner DOM behavior verified by Playwright snapshot inspection
  in Step 1 (verbatim copy + Allow + Decline buttons present, ConsentChip
  copy ABSENT — banner takes over for undecided state) and after each
  click (banner removed, chip copy appears with the right state-aware
  label).

## Deviations from Plan

**[Rule 1 — Driver substitution] Smoke driven by Playwright instead of by the user manually opening incognito windows**
- **Found during:** smoke planning.
- **Issue:** Plan's expected driver was the user manually opening a fresh
  Discord-incognito window per step + checking PostHog. User explicitly
  asked me to drive the in-page actions via Playwright + only spot-check
  PostHog manually between steps.
- **Fix:** Drove `localStorage.clear()` + `navigate()` + DOM `.click()`
  via Playwright between steps. PostHog dashboard checks stayed manual.
- **Verification impact:** none — the events PostHog receives are tied to
  the JS engine's calls, not the input source. Playwright clicks fire
  the same React event handler that a real click does.
- **Files modified:** none.
- **Commit hash:** N/A (procedural deviation, not source change).

**[Rule 2 — Step 3 distinct_id verification path]**
- **Found during:** Step 3 verification.
- **Issue:** Plan called for "ZERO events post-Decline" via dashboard
  Live-Events filter. But `localStorage.clear()` between Step 2 and
  Step 3 also clears PostHog's distinct_id, AND Step 2's Web Vitals
  event arrives at PostHog late (visibility-change `sendBeacon` flush).
  So a naive "is there ONE event in the last 30 seconds" check might
  see the delayed Web Vitals beacon and falsely flag a leak.
- **Fix:** the verification rubric became "no events with a NEW
  distinct_id from preview-15". The same Step 2 distinct_id
  `019dca76-...` showing up with delayed Web vitals is consistent with
  Step 2's session; only a new distinct_id would indicate Step 3 leakage.
  Confirmed via the user's screenshot — all post-Decline events still
  carry Step 2's distinct_id.
- **Verification impact:** none — interpretation tightened, not loosened.
- **Files modified:** none.

**Total deviations:** 2 procedural / interpretive. **Impact:** none on
shipped behavior; both improve verification fidelity.

## Issues Encountered

- **Netlify Drawer iframe blocks Playwright `browser_click`** — same
  issue as the smoke branch testing earlier in this session. Worked
  around by using `page.evaluate(() => button.click())` to invoke the
  React onClick handler directly. The user-facing UI is unaffected;
  this is purely a test-driver inconvenience that goes away once the PR
  is merged and Netlify stops injecting the deploy-preview drawer.
- **PostHog Web Vitals events arrive late** — `sendBeacon` on
  `visibilitychange` is the spec-compliant transport; but it surfaces in
  PostHog's Live Events with a few-second-to-few-minute delay. This is
  by design (browser may queue the beacon until the next idle window).
  Worth noting in any future smoke that uses tight time windows: filter
  by distinct_id, not by timestamp alone.
- **Pre-Phase-6 PostHog config still active on the deleted preview-16
  branch's cached deploy** — the smoke branch (deleted) had the
  pre-06-02b posthog.ts (without `opt_out_capturing_by_default: true`),
  so its earlier Playwright navigation captured one `Pageleave` event.
  This is a positive signal: it confirms the BEFORE/AFTER contrast of
  Phase 6's wiring change. The preview-16 deploy itself is now stale
  (branch deleted) and will not produce new events.

## Carry-forward

- **For phase verification (Phase 6 close):** all D-04 / D-05 / D-06
  must_haves are observably satisfied. Verifier should mark this row
  CLOSED.
- **For Phase 7:** consider adding a Lighthouse / Web Vitals dashboard
  in PostHog for production monitoring once consent is meaningfully on.
  The data is already flowing for opted-in users.
- **For README:** the PostHog dashboard URL should be added to the
  observability section so future maintainers know where to verify
  consent semantics in production. (Not a Phase 6 deliverable; flag for
  future doc pass.)
- **Sentry React SDK v10 + React 19 ErrorBoundary fix (issue #17):**
  unchanged from prior plans. Independent of this smoke.

## Authentication Gates

None encountered.
