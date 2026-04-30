---
phase: 07-observability-hardening
plan: 01
subsystem: infra
tags: [sentry, react-19, vite, rolldown, netlify, observability, error-boundary]

# Dependency graph
requires:
  - phase: 06-launch-prep
    provides: "Sentry.init wired with DSN/release/integrations + sentryVitePlugin sourcemap upload contract; ConsentProvider gating Replay opt-in; AppErrorFallback component"
provides:
  - "React 19 createRoot capture path: onUncaughtError / onCaughtError / onRecoverableError each routed through tagged-handler factory that sets boundary='app-root' before delegating to Sentry.reactErrorHandler — guarantees tag survives Sentry.Dedupe regardless of which path's event is kept (Round-2 MEDIUM-5)"
  - "Sentry.ErrorBoundary defense-in-depth: beforeCapture (boundary tag on SDK event) + onError belt (manual Sentry.captureException with tags + contexts.react.componentStack)"
  - "Sentry.init environment field coalesces VITE_NETLIFY_CONTEXT ?? MODE so deploy-preview events report environment='deploy-preview' (Round-2 HIGH-1)"
  - "Rolldown keepNames flag preserving Function.prototype.name through Oxc mangler — Sentry stack frames now show RootLayout, AppErrorFallback, ConsentChip, ConsentBanner, LandingPage, etc. instead of mangled glyphs (OBSV-02)"
  - "VITE_NETLIFY_CONTEXT exposed at build time via netlify.toml shell substitution of $CONTEXT (D-05 prerequisite for Plan 02 smoke gate AND for Sentry.init environment)"
affects: [07-observability-hardening:plan-02 (smoke route consumes VITE_NETLIFY_CONTEXT), 07-observability-hardening:plan-03 (deploy-preview evidence capture validates this capture path end-to-end), future debugging triage]

# Tech tracking
tech-stack:
  added: []  # No new deps — surgical config/wiring only
  patterns:
    - "React 19 createRoot error hook tagged-handler factory pattern: factory closes over kind ('uncaught'|'caught'|'recoverable') and returns a handler that opens Sentry.withScope, sets two tags (boundary, react.errorHandlerKind), then delegates to Sentry.reactErrorHandler — guarantees tag presence on the SDK event from the hook path so Sentry.Dedupe collapses safely"
    - "Sentry.ErrorBoundary defense-in-depth pattern: beforeCapture (scope.setTag) tags the SDK's auto-capture event, plus onError belt explicitly captures via Sentry.captureException as fallback in case dedup removes the SDK event (Pitfall 5)"
    - "Build-time env-var re-export pattern: Netlify built-in shell vars ($COMMIT_REF, $CONTEXT) re-exported as VITE_*-prefixed vars in netlify.toml [build].command shell substitution — static [build.environment] block would set the literal string '$CONTEXT'"
    - "Inspection build pattern: npx vite build --mode development triggers vite.config.ts disable: mode !== 'production' guard, deterministically skipping sentryVitePlugin (including its filesToDeleteAfterUpload hook) so sourcemap names[] can be inspected post-build (Round-2 HIGH-2 fix replacing the untested SENTRY_AUTH_TOKEN= empty-token assumption)"

key-files:
  created: []
  modified:
    - "src/main.tsx — createRoot now passes options object with all three React 19 error hooks each wired through the taggedHandler factory; Sentry.ErrorBoundary now carries beforeCapture + onError props; Sentry.init environment field uses VITE_NETLIFY_CONTEXT ?? MODE coalesce; ErrorInfo type imported from 'react'"
    - "vite.config.ts — build block extended with rolldownOptions.output.keepNames: true (sourcemap: 'hidden' and the sentryVitePlugin disable: mode !== 'production' guard preserved verbatim)"
    - "netlify.toml — [build].command shell substitution extended to also re-export $CONTEXT as VITE_NETLIFY_CONTEXT alongside the existing VITE_COMMIT_SHA=$COMMIT_REF; explanatory comments updated to cite both consumers (smoke route gate D-05 + Sentry.init environment Round-2 HIGH-1)"

key-decisions:
  - "Tagged-handler factory wraps all three React 19 createRoot error hooks (Round-2 MEDIUM-5): every hook event lands in Sentry with boundary='app-root' set BEFORE Sentry.reactErrorHandler runs, so when Sentry.Dedupe collapses the hook event with the ErrorBoundary's beforeCapture-tagged event the surviving event is guaranteed to carry the tag"
  - "Sentry.init environment now coalesces VITE_NETLIFY_CONTEXT ?? MODE (Round-2 HIGH-1, intentional in-scope addition): deploy-preview events no longer mislabel as environment='production'; falls back to MODE on local dev/test where the var is undefined"
  - "Round-3 confirmed Sentry.reactErrorHandler(callback) is ADDITIVE per node_modules/@sentry/react/build/esm/error.js:90-105 — captureReactException always runs first, the inner callback is a post-capture hook. The empty inner callbacks for caught/recoverable paths therefore do NOT silence default capture. No code change required from Round-3."
  - "Inspection build switched from `SENTRY_AUTH_TOKEN= npx vite build` (Round-1, untested empty-token assumption) to `npx vite build --mode development` (Round-2 HIGH-2): the plugin-documented disable: mode !== 'production' guard at vite.config.ts:30 deterministically short-circuits the plugin including its filesToDeleteAfterUpload hook, leaving .map files in dist/ for symbol inspection"
  - "Plan does NOT mark OBSV-01/OBSV-02 as completed — only addressed (capture path + symbolication mechanically wired). Plan 03 captures the live deploy-preview Sentry event evidence that closes both requirements."

patterns-established:
  - "Tagged-handler factory for React 19 createRoot error hooks (boundary tag + kind tag set on active scope BEFORE delegating to Sentry.reactErrorHandler, guaranteeing tag presence on every hook-path event)"
  - "Sentry.ErrorBoundary defense-in-depth (beforeCapture + onError belt — neither alone is sufficient because Sentry.Dedupe may keep either path's event)"
  - "Build-time env-var re-export via netlify.toml [build].command shell substitution (NOT [build.environment] static block, which would set literal '$CONTEXT')"
  - "Sentry.init environment coalesce honors deploy context (VITE_NETLIFY_CONTEXT ?? MODE) so triage can filter by environment=deploy-preview separately from environment=production"
  - "Inspection build via `npx vite build --mode development` for sourcemap symbol verification when the production build's sentryVitePlugin would delete maps post-upload"

requirements-completed: [OBSV-01, OBSV-02]
requirements-addressed: [OBSV-01, OBSV-02]

# Metrics
duration: ~12min
completed: 2026-04-30
---

# Phase 07 Plan 01: Capture-Path + Symbolication Wiring Summary

**React 19 createRoot tagged-handler factories route render-phase errors into Sentry with dedupe-resilient boundary tagging, plus Rolldown keepNames preserves source identifiers (RootLayout, AppErrorFallback, ConsentChip, etc.) through Oxc mangling, plus VITE_NETLIFY_CONTEXT shell-export coalesces into Sentry.init environment so deploy-preview events stop mislabeling as production.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-30T07:08:00Z (approx)
- **Completed:** 2026-04-30T07:21:00Z
- **Tasks:** 2
- **Files modified:** 3 (src/main.tsx, vite.config.ts, netlify.toml)

## Accomplishments

- React 19 createRoot capture path wired with Round-2 MEDIUM-5 dedupe-resilient boundary tagging via taggedHandler factory closing over hook kind
- Sentry.ErrorBoundary defense-in-depth (beforeCapture scope.setTag + onError belt with manual Sentry.captureException carrying tags.boundary='app-root' and contexts.react.componentStack)
- Sentry.init environment field now coalesces VITE_NETLIFY_CONTEXT ?? MODE (Round-2 HIGH-1) — deploy-preview events report environment='deploy-preview' instead of misleading 'production'
- Rolldown keepNames mechanically verified: real component identifiers (RootLayout, AppErrorFallback, ConsentChip, ConsentBanner, LandingPage, SuggestionList) present in dist/assets/index-*.js AND in dist/assets/*.js.map names[] (inspection build)
- VITE_NETLIFY_CONTEXT now flows from Netlify CI shell ($CONTEXT) → netlify.toml [build].command shell substitution → Vite import.meta.env → consumed by both Sentry.init environment field and (in Plan 02) the smoke route gate

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire React 19 createRoot tagged-handler factories + ErrorBoundary onError belt + beforeCapture + Sentry.init environment coalesce in src/main.tsx** — `e4b979f` (feat)
2. **Task 2: Add Rolldown keepNames + re-export VITE_NETLIFY_CONTEXT in vite.config.ts and netlify.toml** — `bfbf5a1` (feat)

**Plan metadata commit:** _to be added when SUMMARY.md is committed_

## Files Created/Modified

- `src/main.tsx` — createRoot now passes a container variable + options object with onUncaughtError/onCaughtError/onRecoverableError each wired through `taggedHandler(kind)` factory that sets `boundary='app-root'` and `react.errorHandlerKind=<kind>` on the active scope before delegating to `Sentry.reactErrorHandler`. Sentry.ErrorBoundary now carries `beforeCapture={(scope) => scope.setTag('boundary','app-root')}` AND an `onError` belt calling `Sentry.captureException(error, { tags: { boundary: 'app-root', eventId }, contexts: { react: { componentStack } } })`. `Sentry.init` `environment` field is now `import.meta.env.VITE_NETLIFY_CONTEXT ?? import.meta.env.MODE`. `ErrorInfo` type imported from `'react'` per Sentry's canonical TS guidance (Round-3 LOW-3 prose-only correction; verbatimModuleSyntax requires the explicit `type` keyword).
- `vite.config.ts` — `build` block extended from a single-line `{ sourcemap: 'hidden' }` to a multi-line block that adds `rolldownOptions: { output: { keepNames: true } }` while preserving `sourcemap: 'hidden'`. The `sentryVitePlugin({...})` block (including the `disable: mode !== 'production'` guard at line 30) is unchanged.
- `netlify.toml` — `[build].command` extended from `"npm ci && VITE_COMMIT_SHA=$COMMIT_REF npm run build"` to `"npm ci && VITE_COMMIT_SHA=$COMMIT_REF VITE_NETLIFY_CONTEXT=$CONTEXT npm run build"`. Explanatory comments above the command document both consumers (smoke gate + Sentry environment) and the rationale for shell substitution over a static build-environment block. `[build.environment]` and `[[headers]]` blocks unchanged.

## Decisions Made

- **Tagged-handler factory closure over `kind`** — preferred a single factory that closes over `'uncaught' | 'caught' | 'recoverable'` over three near-identical handler functions because (a) it keeps the boundary-tag setting in one place (DRY across the three React 19 hooks), (b) preserves the per-kind `react.errorHandlerKind` tag for triage even though `mechanism.handled = !!callback` (Sentry SDK error.js:97-99) marks all three paths as handled, and (c) allows the dev-only `console.warn` to fire only on the `uncaught` kind without conditional branching at every call site.
- **Inspection build via `--mode development`** rather than `SENTRY_AUTH_TOKEN= npx vite build` — Round-2 HIGH-2 fix. The plugin's documented `disable: mode !== 'production'` guard is the deterministic disable path; the empty-token assumption was untested per Codex round-2 review.
- **`ErrorInfo` imported from `react`** even though Round-3 LOW-3 confirmed `react-dom/client` also exports the type — Sentry's canonical TS examples use the `react` import, both modules export the same type, and the plan-cited canonical guidance keeps the import surface aligned with Sentry's docs.
- **No `Sentry.setTag({ smoke: true })` and no try/catch** — RESEARCH Pattern 5 line 415-417 + "Don't Hand-Roll" line 460. Deterministic message strings + boundary tag are sufficient for Sentry UI search; try/catch wrappers around React rendering would mask the very errors the hooks are designed to capture.

## Deviations from Plan

### Acceptance-criterion regex artifacts (NOT code deviations)

**1. [Pattern artifact] `grep -c "import.meta.env.MODE," src/main.tsx` returns 1 instead of the criterion's expected 0**
- **Found during:** Task 1 verify
- **Issue:** The acceptance criterion expected the bare `import.meta.env.MODE,` substring to be absent. The new coalesce expression `VITE_NETLIFY_CONTEXT ?? import.meta.env.MODE,` legitimately contains that substring as the right-hand operand of `??`. The criterion's pattern was overly literal.
- **Substantive intent:** "no bare uncoalesced `environment: import.meta.env.MODE,` line" — satisfied. The line now reads `environment: import.meta.env.VITE_NETLIFY_CONTEXT ?? import.meta.env.MODE,` which is the Round-2 HIGH-1 fix.
- **Resolution:** No code change; documenting the criterion-pattern artifact. The complementary criterion `grep -c "VITE_NETLIFY_CONTEXT.*MODE" src/main.tsx >= 1` passes (returns 1).

**2. [Pattern artifact, then fixed] `awk '/\[build\.environment\]/...' netlify.toml | grep -c VITE_NETLIFY_CONTEXT` initially returned 1 instead of 0**
- **Found during:** Task 2 verify
- **Issue:** The acceptance criterion's awk regex `/\[build\.environment\]/` (unanchored) matched the substring `[build.environment]` inside an explanatory comment within `[build]` ("a static `[build.environment]` block would set the literal string '$CONTEXT'"). This caused awk to start capturing from inside the `[build]` section, where the `command =` line legitimately mentions `VITE_NETLIFY_CONTEXT`.
- **Substantive intent:** "VITE_NETLIFY_CONTEXT must NOT appear inside the actual `[build.environment]` section" — satisfied throughout. An anchored awk `/^\[build\.environment\]/` returns 0.
- **Resolution:** Reworded the comment from "a static [build.environment] block" to "a static build-environment block" (no semantic change — comment still cites the rationale). Both unanchored and anchored awk now return 0.

### Auto-fixed Issues

None — no Rule 1/2/3 deviations. The two artifacts above are acceptance-criterion regex looseness, not code issues.

---

**Total deviations:** 0 code deviations; 2 acceptance-pattern artifacts documented.
**Impact on plan:** All Round-2 fixes (HIGH-1, HIGH-2, MEDIUM-5) and Round-3 (reactErrorHandler ADDITIVE confirmation; LOW-3 ErrorInfo prose) implemented exactly as planned. No scope creep, no missing items.

## Issues Encountered

None — both task verifies passed cleanly. Sourcemap inspection confirmed real component identifiers in `names[]` for `RootLayout`, `AppErrorFallback`, `ConsentChip`, `ConsentBanner`, `LandingPage`, `SuggestionList`. `RenderThrowSmoke` correctly absent (component is created in Plan 02; the OR-pattern in the criterion handles this).

## Threat Flags

None — Phase 7's threat register (T-07-01 through T-07-04) covers the surface introduced. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## User Setup Required

None — no external service configuration required. Plan 03 will require manual Netlify deploy-preview interaction to capture the Sentry-event evidence (separate USER-SETUP step).

## Self-Check: PASSED

**Files verified to exist:**
- src/main.tsx (modified) — FOUND
- vite.config.ts (modified) — FOUND
- netlify.toml (modified) — FOUND
- .planning/phases/07-observability-hardening/07-01-SUMMARY.md (this file) — FOUND

**Commits verified to exist (git log --oneline -5):**
- e4b979f (Task 1) — FOUND
- bfbf5a1 (Task 2) — FOUND

**Verification commands run during execution:**
- `npx tsc -b --noEmit` → exit 0
- `npm run build` → exit 0; dist/ produced; component identifiers preserved across chunks
- `npx vite build --mode development` → exit 0; sentryVitePlugin deterministically disabled; .map files retained; names[] contains RootLayout, AppErrorFallback, ConsentChip, ConsentBanner, LandingPage, SuggestionList

## Next Plan Readiness

- Plan 02 (smoke route + RenderThrowSmoke component): all prerequisites in place. `VITE_NETLIFY_CONTEXT` is available at build time (netlify.toml shell substitution); Sentry capture path is wired so a render-phase throw from `<RenderThrowSmoke />` will land in Sentry with `mechanism.type` of `react.errorboundary` (preferred) or `generic` (from `reactErrorHandler`), tagged `boundary='app-root'`.
- Plan 03 (deploy-preview evidence capture): Sentry.init environment will report `environment='deploy-preview'` on the Phase 7 PR's preview build, allowing D-08 evidence to be filtered cleanly without polluting the production environment view.

## TDD Gate Compliance

N/A — plan is `tdd="false"` per frontmatter. OBSV-01/OBSV-02 verification is mechanical (grep + build inspection) for Plan 01 and live deploy-preview evidence for Plan 03.

---
*Phase: 07-observability-hardening*
*Completed: 2026-04-30*
