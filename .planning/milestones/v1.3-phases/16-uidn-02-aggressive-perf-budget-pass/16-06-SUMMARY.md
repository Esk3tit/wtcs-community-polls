---
phase: 16-uidn-02-aggressive-perf-budget-pass
plan: "06"
subsystem: ui
tags: [tanstack-router, preload, performance, access-control]

# Dependency graph
requires:
  - phase: 16-03
    provides: GDPR/consent lazy-load gate and createRouter baseline (routeTree unchanged)
  - phase: 16-05
    provides: picture-wrapped logo markup in Navbar.tsx (untouched by this plan)
provides:
  - "App-wide hover/focus preloading via defaultPreload: 'intent' in createRouter"
  - "Explicit preload={false} opt-out on BOTH layout Admin links (desktop Navbar + MobileNav) — V4 Access Control hover-redirect leak (Pitfall 6) mitigated on every nav surface"
affects: [future preload-related changes, AdminGuard, MobileNav, Navbar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Router-level defaultPreload: 'intent' with per-link preload={false} opt-out for auth-gated routes"
    - "Belt-and-braces: explicit preload='intent' retained on Logo/Topics/Archive links even after router default flips (accepted markup-debt for self-documentation)"

key-files:
  created: []
  modified:
    - src/main.tsx
    - src/components/layout/Navbar.tsx
    - src/components/layout/MobileNav.tsx

key-decisions:
  - "defaultPreload: 'intent' added at router level (not per-link) — one-line config change applies app-wide"
  - "preload={false} required on BOTH Admin links (Navbar.tsx desktop + MobileNav.tsx mobile) — router default is app-wide so mobile link also inherited 'intent' without the opt-out"
  - "Existing explicit preload='intent' on Logo/Topics/Archive links intentionally retained (accepted markup-debt per UI-SPEC belt-and-braces; self-documents per-link intent and provides resilience if router default is ever changed)"
  - "Task 3 live hover-smoke satisfied by static-grep fallback — admin Discord session unavailable in local env; operator accepted static evidence"

patterns-established:
  - "Auth-gated route links: always carry explicit preload={false} when app-wide defaultPreload is active"
  - "WHY-only inline comment on preload={false}: document security rationale (hover-redirect leaks route existence), no plan/Pitfall/phase IDs"

requirements-completed: [PERF-06]

# Metrics
duration: ~15min (Tasks 1-2 execution) + checkpoint resolution
completed: "2026-05-28"
---

# Phase 16 Plan 06: Router defaultPreload + Admin Link Preload Opt-Out Summary

**App-wide hover/focus route preloading via `defaultPreload: 'intent'` in `createRouter`, with explicit `preload={false}` on both layout Admin links to preserve the V4 Access Control boundary on desktop and mobile nav surfaces.**

## Performance

- **Duration:** ~15 min (Tasks 1-2) + static-grep fallback checkpoint resolution
- **Started:** 2026-05-27
- **Completed:** 2026-05-28
- **Tasks:** 3 (Tasks 1-2 committed; Task 3 closed via accepted static-grep fallback)
- **Files modified:** 3

## Accomplishments

- `createRouter({ routeTree, defaultPreload: 'intent' })` wired in `src/main.tsx` — hover/focus on any `<Link>` now begins preloading its destination chunk app-wide
- Both layout Admin links (`Navbar.tsx` desktop + `MobileNav.tsx` mobile) carry explicit `preload={false}` — AdminGuard's `beforeLoad` redirect no longer fires on hover/touch on either nav surface (V4 Access Control boundary preserved; hover-redirect information-disclosure leak mitigated)
- Phase 15 invariants (Sentry boundary chain, keepNames allowlist via `verify-sourcemap-names.mjs`) confirmed intact; build clean; 401 Vitest tests passing (43 files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add `defaultPreload: 'intent'` to createRouter** - `32e1ca9` (feat)
2. **Task 2: Add `preload={false}` to Admin links in Navbar + MobileNav** - `7e3e6b5` (feat)
3. **Task 3: e2e + hover-smoke** - _no source commit; verification-only task closed via static-grep fallback (see Deviations)_

**Plan metadata:** _(docs commit follows this SUMMARY write)_

## Files Created/Modified

- `src/main.tsx` — `createRouter` call updated to add `defaultPreload: 'intent'`
- `src/components/layout/Navbar.tsx` — Desktop Admin `<Link to="/admin">` receives `preload={false}` and updated WHY-only security comment
- `src/components/layout/MobileNav.tsx` — Mobile Admin `<Link to="/admin">` (inside `<SheetClose asChild>`) receives `preload={false}` and matching WHY-only security comment

## Decisions Made

- **Router-level config vs per-link:** `defaultPreload: 'intent'` added at `createRouter` (one-line, applies everywhere) rather than sprinkling `preload="intent"` on every new link — simpler and more robust
- **Both Admin links opted out:** `defaultPreload` is app-wide, so the mobile `MobileNav` Admin link inherited `'intent'` after Task 1 just as the desktop Navbar link did — both required explicit `preload={false}` opt-outs
- **Belt-and-braces retained:** Existing `preload="intent"` on Logo/Topics/Archive in both Navbar and MobileNav intentionally kept even though they now match the router default — accepted markup-debt for self-documentation and resilience against future router-config changes (LOW review finding, explicitly accepted)
- **Task 3 hover-smoke:** Operator accepted static-grep fallback — no admin Discord session available locally; static evidence (`preload={false}` on both Admin links confirmed by grep; `defaultPreload: 'intent'` confirmed in `main.tsx`) is the load-bearing proof for the mobile surface and the router config

## Deviations from Plan

### Checkpoint: Task 3 live hover-smoke replaced by static-grep fallback

**Found during:** Task 3 (e2e + operator hover-smoke)

**Context:** The plan's Task 3 requires an operator hover-smoke against a production preview with an admin-role Discord session. The Admin link is gated behind `{isAdmin && (...)}` in both Navbar.tsx and MobileNav.tsx — it is NOT rendered for anonymous or non-admin users. No admin Discord session was available in the local dev environment, making the live hover-smoke infeasible.

**Fallback invoked (per plan clause):** The plan explicitly provides: *"If you cannot sign in as an admin in the preview environment, the hover-smoke cannot be performed against the live link — fall back to confirming the static `preload={false}` grep from Task 2 and note in SUMMARY that the runtime hover-smoke was skipped for lack of an admin session."*

**Static evidence confirmed by operator:**
- `src/main.tsx:39` → `createRouter({ routeTree, defaultPreload: 'intent' })`
- `src/components/layout/Navbar.tsx:68` → Admin `<Link to="/admin" preload={false}>`
- `src/components/layout/MobileNav.tsx:59` → Admin `<Link to="/admin" preload={false}>`
- 16-05 `<picture>` logo markup intact and untouched

**Automated checks (all green, pre-checkpoint):**
- Build: clean
- `verify-sourcemap-names.mjs` (Phase 15 sourcemap-names allowlist): 7/7 passed
- `npx vitest run --exclude '**/.claude/worktrees/**'`: 401 passed (43 files)

**e2e auth-gated spec failures:** Two Playwright specs that require a real Supabase ANON key failed due to a missing `VITE_SUPABASE_ANON_KEY` in the local environment. This is a pre-existing local-dev condition unrelated to this plan's changes — the same specs fail on a clean checkout without the key. These failures do NOT indicate a regression from `defaultPreload: 'intent'`.

**Operator verdict:** Plain-accept. SuggestionForm.tsx (which contains 3 Admin links behind `AdminGuard`) was explicitly confirmed out of scope — those links are admin-gated and unreachable by non-admins, so no opt-out is required there.

---

**Total deviations:** 1 (Task 3 live hover-smoke replaced by plan-specified static-grep fallback; operator accepted)
**Impact on plan:** No scope change; no source modifications beyond plan spec. Static-grep fallback is the plan's own documented fallback path.

## Issues Encountered

- E2E auth-gated specs require `VITE_SUPABASE_ANON_KEY` which is absent in the local environment. Pre-existing condition; unrelated to this plan. Non-auth Playwright specs and all Vitest tests pass.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PERF-06 requirement closed: app-wide hover/focus preloading active; V4 Access Control boundary preserved on both desktop and mobile nav surfaces
- Phase 16 plan 06 complete; plan 07 (final plan in phase 16) ready to execute
- Phase 15 invariants confirmed intact

---
*Phase: 16-uidn-02-aggressive-perf-budget-pass*
*Completed: 2026-05-28*
