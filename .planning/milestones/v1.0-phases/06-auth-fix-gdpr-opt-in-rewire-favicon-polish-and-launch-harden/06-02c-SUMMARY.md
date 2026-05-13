---
phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
plan: 02c
status: complete
disposition: GDPR opt-IN UI shipped
date: 2026-04-26
---

# 06-02c — GDPR opt-IN UI SUMMARY

## Outcome

Visible UI surface for the opt-IN flow shipped. ConsentBanner renders on
first visit with verbatim UI-SPEC Surface 1 copy + Allow/Decline buttons
(both with min-h-11 for the WCAG 2.5.5 / Apple HIG 44px mobile touch
target). ConsentChip refactored to the inverted opt-IN state machine —
shows "Anonymous usage analytics are on. Turn off" / "Anonymous usage
analytics are off. Turn on" depending on consent state, null when
undecided (banner takes over). Both mounted in `__root.tsx` and mutually
exclusive by render guard.

## Completed Tasks

| # | Task | Status | Commit | Files |
|---|------|--------|--------|-------|
| 1 | Create ConsentBanner; refactor ConsentChip; mount both in __root.tsx | done | `e0d5b9e` | `src/components/ConsentBanner.tsx` (NEW), `src/components/ConsentChip.tsx` (rewrite), `src/routes/__root.tsx` |
| 2 | Update ConsentChip tests (inverted state machine) and add ConsentBanner tests | done | `e0d5b9e` | `src/__tests__/components/ConsentChip.test.tsx` (rewrite), `src/__tests__/components/ConsentBanner.test.tsx` (NEW) |

## What was built

**`src/components/ConsentBanner.tsx`** — first-visit non-blocking banner
fixed bottom-4 right-4 z-40 with bg-card border + shadow-md p-4. Renders
ONLY when:
- `consent.state === 'undecided'` AND
- pathname does NOT start with `/admin` AND
- session-dismissed flag (`sessionStorage.wtcs_consent_banner_dismissed_session`)
  is NOT set.

Body lines copied verbatim from UI-SPEC Surface 1: "We can record
anonymous usage to help us improve this site." + "No tracking starts until
you choose." Buttons: `<Button onClick={allow}>Allow</Button>` (default
primary variant) + `<Button variant="outline" onClick={decline}>Decline</Button>`.
Both carry `className="min-h-11"` for the 44px WCAG touch-target minimum
(P-05 — REVIEWS.md). NO destructive coloring on Decline. NO exclamation
marks. NO emojis. Dismiss X uses `sessionStorage` (re-shows on next page
load).

**`src/components/ConsentChip.tsx`** (refactor) — now consumes
`useConsent()` directly. Renders null when state is 'undecided' (banner
is in charge). On 'allow': "Anonymous usage analytics are on. Turn off"
+ link button to `decline()`. On 'decline': "Anonymous usage analytics
are off. Turn on" + link button to `allow()`. Dismiss X writes
`localStorage.posthog_consent_chip_dismissed=true` (persistent dismissal
of the chip itself; does NOT change the consent decision). Direct
`posthog.opt_out_capturing` call + `loadSentryReplayIfConsented` mount
effect REMOVED — both responsibilities live in ConsentProvider per 06-02b.
Legacy `OPT_OUT_KEY` constant + every `analytics_opted_out` reference
fully removed from this file.

**`src/routes/__root.tsx`** — `<ConsentBanner />` mounted as a sibling of
`<ConsentChip />` in the same router-tree position. Mutually exclusive by
render guard (banner only renders on undecided; chip only renders on
allow/decline) so they never visually collide.

**`src/__tests__/components/ConsentChip.test.tsx`** (rewrite) — 7 tests
covering the new flipped state machine: undecided → null, allow → "on"
copy, decline → "off" copy, Turn off click → state flip, Turn on click
→ state flip, /admin/* → null, Dismiss X → only chip key written.
Old assertions for `posthog.opt_out_capturing` direct call +
`loadSentryReplayIfConsented` mount effect dropped (those responsibilities
moved to ConsentContext).

**`src/__tests__/components/ConsentBanner.test.tsx`** (NEW) — 8 tests:
verbatim copy on first visit, no-render on allow / decline / /admin,
Allow/Decline button clicks write the right localStorage value AND
remove banner from DOM, Dismiss X is session-only and does not flip
consent, legacy `analytics_opted_out=true` migration triggers the
ConsentProvider one-shot to flip consent to 'decline'.

## Verification

- `npm run lint` exits 0.
- `npm run test -- --run` exits 0; **378/378 tests pass** (was 369 + 9
  net-new = 7 ConsentChip rewrites + 8 ConsentBanner).
- All Task 1 grep AC pass: banner copy ×1, "No tracking starts" copy ×1,
  Allow + Decline buttons present, no `variant="destructive"`, `min-h-11`
  ×3 (covers both Allow + Decline + extra in dismiss-button section);
  chip "on" copy ×2, "off" copy ×2, Turn off|Turn on ×3, no
  `opt_out_capturing|loadSentryReplay`, no `OPT_OUT_KEY|analytics_opted_out`;
  `<ConsentBanner` ×1 + `<ConsentChip` ×1 in __root.tsx.
- All Task 2 grep AC pass: banner copy in test ×2, no `analytics_opted_out`
  in chip test, ConsentChip test reports 7 passing, ConsentBanner test
  reports 8 passing.

## Deviations from Plan

**[Rule 1 — AC coherence] `loadSentryReplayIfConsented` mock declaration in ConsentChip test trips strict grep**
- **Found during:** Task 2 verification.
- **Issue:** Plan AC required `grep -c "loadSentryReplayIfConsented" src/__tests__/components/ConsentChip.test.tsx` to return 0 ("legacy assertion removed; tested in ConsentContext.test.tsx instead"). Actual count is 1 because the test file declares `vi.mock('@/lib/sentry', () => ({ loadSentryReplayIfConsented: vi.fn() }))` — defensive mock infrastructure, NOT a legacy assertion.
- **Why the mock is required:** ConsentChip now consumes `useConsent()`,
  which hooks into ConsentProvider, which contains a side-effect bridge
  that calls `loadSentryReplayIfConsented()` on the 'allow' transition.
  Tests that pre-set `wtcs_consent='allow'` would, without this mock,
  invoke the real Sentry helper, which calls `Sentry.getClient()` →
  returns null in jsdom (no Sentry.init in tests) → safe but noisy.
- **Fix (interpretation):** treat the AC as "no legacy ASSERTION" rather
  than "no literal mention." All assertions on `loadSentryReplayIfConsented`
  call counts have been removed (the file's prior `expect(mockLoadReplay).toHaveBeenCalledTimes(1)`
  is gone). The remaining occurrence is a property name in the mock
  factory.
- **Files modified:** none beyond plan intent.
- **Verification:** `grep -c 'loadSentryReplayIfConsented' src/__tests__/components/ConsentChip.test.tsx`
  returns 1 (mock declaration only, no assertion).
- **Commit hash:** `e0d5b9e`.

**Total deviations:** 1 documented (AC-coherence on grep vs. assertion
distinction). **Impact:** none on behavior; both the chip's behavior and
the test's coverage match the plan's intent.

## Issues Encountered

None — both tasks landed clean on first run after the source/test files
were written. Vitest's `Not implemented: navigation to another Document`
warning fires from the existing P-02 reload tests in
`ConsentContext.test.tsx` (jsdom can't actually navigate; the
`Object.defineProperty` mock pattern handles it). Pre-existing, not
introduced by this plan.

## Carry-forward

- **For 06-02d (PostHog smoke):** the visible UI is now wired end-to-end.
  06-02d verifies the live-event behavior on PostHog dashboard:
  - clean profile, no Allow click → zero events captured
  - clean profile, click Allow + reload → pageview event arrives within 30s
  - clean profile, click Decline → zero events captured
  All three assertions are out-of-repo verifications against PostHog's
  dashboard (require user action; no code change).
- **For phase verification:** the 06-02 → 06-02b → 06-02c chain is now
  complete. ConsentContext is the source of truth, posthog/sentry/main
  are wired, the UI surfaces let users actually flip consent, and 25 new
  test assertions across 4 test files cover the state machine end-to-end
  (10 ConsentContext + 2 AuthContext + 7 ConsentChip rewrites + 8
  ConsentBanner = 27 new + 0 legacy assertions; net +25 new beyond what
  ConsentChip used to assert).

## Authentication Gates

None encountered.
