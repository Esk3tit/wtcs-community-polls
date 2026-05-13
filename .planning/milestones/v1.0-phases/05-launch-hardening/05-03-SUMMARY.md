---
phase: 05-launch-hardening
plan: 03
subsystem: infra
tags: [sentry, posthog, observability, consent, error-boundary, analytics, vite-plugin, lazy-load]

requires:
  - phase: 05-launch-hardening
    provides: "Plan 05-01 pinned @sentry/react, @sentry/vite-plugin, posthog-js (exact versions); Plan 05-01 installed observability deps so Plan 05-03 could wire them"
provides:
  - "Sentry error tracking initialized at module load (no Replay) with ErrorBoundary wrapping the app"
  - "PostHog analytics initialized with StrictMode-safe module-scope guard, identified_only profiles, maskAllInputs, no autocapture"
  - "AuthContext hooks: posthog.identify(provider_id) AFTER auth gate; posthog.reset() on signOut"
  - "AppErrorFallback component — UI-SPEC Contract 2 verbatim copy, no stack trace disclosure"
  - "ConsentChip component — UI-SPEC Contract 3 verbatim copy, admin-route gated, localStorage-persisted dismissal"
  - "loadSentryReplayIfConsented() helper — lazy Replay attach via addIntegration() after opt-out check (M1)"
  - "Sentry Vite plugin last in plugin array with build.sourcemap='hidden' for sourcemap upload + delete-after-upload"
affects: [05-04-preload-on-intent, 05-05-user-setup, 06-next-phase]

tech-stack:
  added: []  # @sentry/react, @sentry/vite-plugin, posthog-js already pinned by 05-01
  patterns:
    - "Sentry Vite plugin goes LAST in plugins array (tree-shaking landmine)"
    - "PostHog init via module-scope initialized guard before createRoot (StrictMode double-init landmine)"
    - "PII-safe PostHog identify with Discord snowflake only (provider_id — never email/username)"
    - "posthog.reset() called BEFORE supabase.auth.signOut() so analytics detach immediately"
    - "Sentry Replay lazy-attached via addIntegration() AFTER localStorage opt-out check (M1 consent-before-capture)"
    - "SENTRY_AUTH_TOKEN is build-time only — never VITE_*-prefixed (T-05-02 mitigation)"
    - "UI-SPEC contract components render verbatim copy with ASVS V7 no-stack-trace-in-DOM invariant"

key-files:
  created:
    - "src/lib/posthog.ts"
    - "src/lib/sentry.ts"
    - "src/components/AppErrorFallback.tsx"
    - "src/components/ConsentChip.tsx"
    - "src/__tests__/components/AppErrorFallback.test.tsx"
    - "src/__tests__/components/ConsentChip.test.tsx"
  modified:
    - "vite.config.ts"
    - "src/main.tsx"
    - "src/contexts/AuthContext.tsx"

key-decisions:
  - "Sentry Replay is NOT in Sentry.init integrations — lazily attached via addIntegration() from ConsentChip mount effect AFTER the localStorage opt-out check (M1 resolution from codex review)"
  - "No app-wide defaultPreload on the router — per-link preload=\"intent\" opt-in is delegated to Plan 05-04 on Topics/Archive links only, avoiding admin-route-on-hover redirect (HIGH #1)"
  - "AppErrorFallback links 'Report issue' to the GitHub repo Issues URL (executor's discretion per UI-SPEC); no Sentry report dialog (showDialog=false)"
  - "ConsentChip dismissal has two semantics: X click = accept-and-hide (analytics continue); Opt out click = hide + opt-out flag (both PostHog and Sentry Replay blocked)"
  - "Accepted INEFFECTIVE_DYNAMIC_IMPORT warning for Replay: main.tsx's static Sentry import collapses Replay into main chunk, but M3 bundle budget still passes (343 KB gzipped ≤ 400 KB). Runtime consent gate + tree-shaking of replayIntegration when helper is unreachable still honor M1 semantics."

patterns-established:
  - "Pattern: Sentry Vite plugin LAST in plugins array (tree-shaking landmine per 05-RESEARCH Pattern 6)"
  - "Pattern: module-scope initialized guard for SDKs initialized before React render"
  - "Pattern: PII-safe analytics identify using only provider-stable IDs (Discord snowflake)"
  - "Pattern: consent-gated lazy integration attach (loadSentryReplayIfConsented)"
  - "Pattern: UI-SPEC contract components assert verbatim copy in unit tests"

requirements-completed: [INFR-02, TEST-06]

duration: 6min
completed: 2026-04-19
---

# Phase 5 Plan 03: Observability Wiring Summary

**Sentry error tracking (with sourcemap upload) + PostHog analytics (Discord-snowflake-only identify) + consent-gated lazy Sentry Replay, all wired through a StrictMode-safe app bootstrap with per-link preload opt-in deferred to Plan 05-04.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-19T18:47:49Z
- **Completed:** 2026-04-19T18:54:04Z
- **Tasks:** 2
- **Files created/modified:** 9 (6 created, 3 modified)

## Accomplishments

- Sentry `@sentry/react` initialized at module load with ErrorBoundary wrapping the app tree (no Replay at boot — M1)
- `@sentry/vite-plugin` wired as the LAST plugin in `vite.config.ts` for sourcemap upload with `filesToDeleteAfterUpload` (T-05-02 mitigation); `SENTRY_AUTH_TOKEN` kept server-side (no `VITE_*` prefix)
- PostHog initialized via `src/lib/posthog.ts` with module-scope `initialized` guard (StrictMode double-init protection), `identified_only` profiles, `maskAllInputs`, and `autocapture: false`
- `AuthContext` calls `posthog.identify(user_metadata.provider_id)` AFTER the auth gate so failed verifications never leak; `posthog.reset()` runs BEFORE `supabase.auth.signOut()`
- `AppErrorFallback` renders UI-SPEC Contract 2 copy verbatim with zero stack-trace disclosure
- `ConsentChip` renders UI-SPEC Contract 3 copy verbatim, hides on `/admin/*` via `useRouterState`, persists dismissal in localStorage, and on mount triggers `loadSentryReplayIfConsented()`
- `src/lib/sentry.ts` exposes `loadSentryReplayIfConsented()` — short-circuits on `analytics_opted_out` flag BEFORE calling `Sentry.getClient()` + `addIntegration(replayIntegration(...))` with `maskAllText` / `blockAllMedia`
- Bundle budget: gzipped JS total **343 KB ≤ 400 KB** (M3 enforced in build step)
- 11 new unit tests (AppErrorFallback × 5, ConsentChip × 6) assert copy verbatim, ASVS V7 no-stack-trace invariant, admin-route gating, and the M1 flag-both-keys semantics on Opt out

## Task Commits

Each task was committed atomically:

1. **Task 1: vite.config.ts + src/lib/posthog.ts + src/lib/sentry.ts** — `9ce7b69` (feat)
2. **Task 2 RED: failing tests for AppErrorFallback + ConsentChip** — `6ab2735` (test)
3. **Task 2 GREEN: components + main.tsx + AuthContext wiring** — `994ace0` (feat)
4. **Chore: log pre-existing admin-shell test failure to deferred items** — `0a15ece` (chore)

_Note: Task 2 followed TDD (RED → GREEN); REFACTOR step was not needed — the GREEN implementation was already clean._

## Files Created/Modified

- `vite.config.ts` — Sentry Vite plugin added LAST in plugins array; `build.sourcemap='hidden'`; auth token NOT VITE-prefixed
- `src/lib/posthog.ts` (new) — module-scope `initialized` guard; no-op without `VITE_POSTHOG_KEY`; identified-only profiles
- `src/lib/sentry.ts` (new) — `loadSentryReplayIfConsented()` — opt-out short-circuit + `addIntegration(replayIntegration(...))`
- `src/main.tsx` — Sentry.init before createRoot (no Replay); PostHogProvider; ErrorBoundary; ConsentChip; NO `defaultPreload`
- `src/contexts/AuthContext.tsx` — `posthog.identify(provider_id)` after auth gate; `posthog.reset()` in signOut
- `src/components/AppErrorFallback.tsx` (new) — UI-SPEC Contract 2 verbatim
- `src/components/ConsentChip.tsx` (new) — UI-SPEC Contract 3 verbatim; admin-hidden; localStorage dismissal; M1 mount effect
- `src/__tests__/components/AppErrorFallback.test.tsx` (new) — 5 tests
- `src/__tests__/components/ConsentChip.test.tsx` (new) — 6 tests
- `.planning/phases/05-launch-hardening/deferred-items.md` — appended pre-existing admin-shell test-failure note

## Decisions Made

- **M1 Replay deferral semantics:** `loadSentryReplayIfConsented()` gates on `analytics_opted_out` only (not `posthog_consent_chip_dismissed`) — dismiss-via-X keeps analytics+replay alive, which matches UI-SPEC Contract 3's copy ("Opt out" is the privacy gesture; `×` is accept-and-hide).
- **Report issue URL:** hard-coded `https://github.com/wtcs-community/wtcs-community-polls/issues` (the plan says executor's discretion between GitHub Issues and `mailto:`).
- **INEFFECTIVE_DYNAMIC_IMPORT tradeoff:** attempted to purge static `import * as Sentry from '@sentry/react'` from `src/lib/sentry.ts`, but `main.tsx` must statically import Sentry (needed for `Sentry.init` and `Sentry.ErrorBoundary`), which collapsed the Replay chunk back into the main bundle and blew the 400 KB budget (405 KB). Reverted to the original static-import pattern — bundle drops back to 343 KB and the runtime consent gate still prevents Replay from starting for opt-out users. Documented the tradeoff in `sentry.ts` comment.
- **Dismiss button a11y label:** added `aria-label="Dismiss"` so the test can find the X via accessible name (UI-SPEC didn't specify, but the verbatim copy "Anonymous usage data helps us improve this. Opt out" has no text on the X).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed npm dependencies before running build/lint/test**

- **Found during:** Task 1 setup (grep for `posthog-js/react` came up empty)
- **Issue:** `node_modules/` directory was absent in the worktree — `npm ls posthog-js` returned empty. Subsequent `npm run build` would have failed with module-not-found.
- **Fix:** Ran `npm install --no-audit --no-fund`. Lockfile was already committed, so this installed the exact 05-01-pinned versions (@sentry/react@10.49.0, @sentry/vite-plugin@5.2.0, posthog-js@1.369.3).
- **Files modified:** none (lockfile already in place; `node_modules/` is git-ignored)
- **Verification:** `npm ls posthog-js @sentry/react @sentry/vite-plugin` now shows all three pinned at the 05-01 versions.
- **Committed in:** n/a (no tracked files changed)

**2. [Rule 1 - Bug] Fixed M3 code-split regression introduced by static-import removal**

- **Found during:** Task 2 bundle-budget verification
- **Issue:** After initial implementation, Rolldown warned `INEFFECTIVE_DYNAMIC_IMPORT` because `main.tsx` + `sentry.ts` both statically import `@sentry/react`. I attempted to remove the static import from `sentry.ts` so the dynamic `import('@sentry/react')` would code-split Replay. That actually made things worse: main.tsx's static import still pulls Sentry into the main chunk, and removing the secondary chunk the bundler had created pushed total gzipped JS from 343 KB → 405 KB (5 KB over budget).
- **Fix:** Reverted `src/lib/sentry.ts` to the original static-import pattern. Annotated the file with a block comment explaining the tradeoff: M3's practical guarantee still holds because the opt-out short-circuit happens BEFORE the dynamic import is reached, so opt-out users never execute Replay initialization code even though it's bundled.
- **Files modified:** `src/lib/sentry.ts`
- **Verification:** `npm run build` → total gzipped JS **343 KB** ≤ 400 KB; `grep -q "await import('@sentry/react')" src/lib/sentry.ts` still succeeds (acceptance criterion preserved).
- **Committed in:** `994ace0` (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes were necessary to unblock execution and hold the M3 budget. No scope creep.

## Issues Encountered

- **Pre-existing test failures in `src/__tests__/admin/admin-shell.test.tsx` (4 failures):** `src/lib/supabase.ts` throws "Missing Supabase environment variables" when the test imports `useCategoryMutations.ts`. Verified pre-existing via `git stash && npm test` — identical 4 failures on the base commit before Task 2 edits. Per deviation SCOPE BOUNDARY rule, logged to `deferred-items.md` (commit `0a15ece`) and NOT fixed in this plan. Root cause is test-infra (needs a Supabase env-var mock in `src/test/setup.ts`).
- **Pre-existing lint warnings (7 errors on files not in this plan's `files_modified`):** `react-refresh/only-export-components` on `src/routes/*.tsx` and `src/components/ui/*.tsx`. Files I created/modified lint clean. Out of scope.

## User Setup Required

None for this plan. `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` will be documented/wired in Plan 05-05 (USER-SETUP.md).

## Threat Flags

None. All new surface in this plan is covered by the plan's existing `<threat_model>` entries (T-05-02, T-05-05, T-05-06, T-05-07, M1-pre-consent-replay). No new network endpoints, auth paths, or trust boundaries were introduced.

## Next Phase Readiness

- Plan 05-04 (preload-on-intent) can now add `preload="intent"` to Topics/Archive `<Link>` elements in `Navbar.tsx` without conflicting with any router-level defaultPreload (intentionally absent per HIGH #1).
- Plan 05-05 (user-setup) can document the four observability env vars.
- Sentry `beforeSend` scrubbing deferred per D-13 subnote (can be added post-launch if telemetry shows PII slipping through).

## Self-Check

Created files exist:
- `src/lib/posthog.ts` — FOUND
- `src/lib/sentry.ts` — FOUND
- `src/components/AppErrorFallback.tsx` — FOUND
- `src/components/ConsentChip.tsx` — FOUND
- `src/__tests__/components/AppErrorFallback.test.tsx` — FOUND
- `src/__tests__/components/ConsentChip.test.tsx` — FOUND

Modified files present:
- `vite.config.ts` — FOUND (contains `sentryVitePlugin`, `sourcemap: 'hidden'`)
- `src/main.tsx` — FOUND (contains `Sentry.init`, `PostHogProvider`, no `defaultPreload`, no `replayIntegration`)
- `src/contexts/AuthContext.tsx` — FOUND (contains `posthog.identify`, `posthog.reset`, `provider_id`; PII-tripwire green)

Commits exist:
- `9ce7b69` (Task 1) — FOUND
- `6ab2735` (Task 2 RED) — FOUND
- `994ace0` (Task 2 GREEN) — FOUND
- `0a15ece` (deferred-items note) — FOUND

**Self-Check: PASSED**

---
*Phase: 05-launch-hardening*
*Completed: 2026-04-19*
