---
plan: 15-01
phase: 15-observability-e2e-verify-close
status: complete
commit: 79acd86
---

# 15-01 Summary

## Objective

Extended the prod-gated `/__smoke` route with two distinct render-phase throw triggers (`?fire=render` and `?fire=dedupe`), a LOCAL `Sentry.ErrorBoundary` wrapping the throw component, and synchronous event ID surfacing via `console.log` and `document.body.dataset.sentryEventId`.

## Tasks Completed

### Task 1: Extend SmokeSearch + branch render to two distinct throw messages

**`src/components/debug/RenderThrowSmoke.tsx`**
- Extended signature from `(): never` to `({ message }: { message?: string } = {}): never`
- Default message (original canary string) preserved for `?render=1` backward compat
- Error message now reads: `message ?? 'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'`

**`src/routes/[__smoke].tsx`**
- Added `fire?: 'render' | 'dedupe'` field to `SmokeSearch` interface
- Extended `validateSearch` to admit `'render'` and `'dedupe'` alongside existing `render: '1'`
- Added `fire` branch in `SmokePage` routing to two literal error messages:
  - `'OBSV-03 render'` (for `?fire=render`)
  - `'OBSV-05 dedupe'` (for `?fire=dedupe`)
- Existing `?render=1` canary path preserved and unchanged (still escalates to `AppErrorFallback`)
- Production gate (`VITE_NETLIFY_CONTEXT === 'production'` → `throw notFound()`) unchanged verbatim

### Task 2: Surface Sentry event ID via LOCAL Sentry.ErrorBoundary

**`src/routes/[__smoke].tsx`** (continued)
- Imported `* as Sentry from '@sentry/react'`
- `SmokeFallback` component declared outside `SmokePage` (avoids `react-hooks/static-components` rule)
- `fire === 'render' | 'dedupe'` branch wraps throw component in `<Sentry.ErrorBoundary>` with:
  - `fallback={<SmokeFallback />}` — keeps `SmokePage` mounted, shows "Smoke throw captured." locally
  - `beforeCapture={(scope) => scope.setTag('boundary', 'app-root')}` — cycle-3 HIGH fix: canonical tag mirrors `src/main.tsx` root boundary so whichever event `Sentry.dedupeIntegration()` keeps still carries `boundary: app-root`
  - `onError={surfaceEventId}` — synchronous callback writes `document.body.dataset.sentryEventId = eventId` and logs `[smoke] sentry.eventId <hex>` to console
- `surfaceEventId` is a `useCallback(() => [...], [])` — stable reference, runs synchronously in boundary `onError`
- `eslint-disable-next-line no-console -- intentional eventId surface for smoke verifier` directive present with WHY reason

**`eslint.config.js`** (supporting change)
- Added file-scoped `no-console: warn` override for `src/routes/\\[__smoke\\].tsx` (bracket-escaped glob)
- Required so the intentional `eslint-disable-next-line` directive is not flagged unused under `--max-warnings 0` in the pre-commit hook
- The `\\[` escaping is necessary because ESLint globs treat `[__smoke]` as a character class otherwise

## Validation Evidence

| Check | Result |
|-------|--------|
| `npm run lint` | Exit 0 (0 errors, 0 warnings) |
| Pre-commit hook `eslint --max-warnings 0 --no-warn-ignored` | Pass |
| `tsc -b` (pre-commit hook) | Pass |
| `npm run build` (`tsr generate && tsc -b && vite build`) | Exit 0 |
| `npm run test` | 393/393 tests pass |
| `fire?: 'render' \| 'dedupe'` field in SmokeSearch | Line 10 |
| `'OBSV-03 render'` AND `'OBSV-05 dedupe'` literals in src/ | Line 63 |
| `import * as Sentry from '@sentry/react'` | Line 4 |
| `<Sentry.ErrorBoundary` JSX element | Line 65 |
| `document.body.dataset.sentryEventId` | Line 55 |
| `beforeCapture=` with `scope.setTag('boundary', 'app-root')` | Line 69 |
| `eslint-disable-next-line no-console -- intentional eventId surface...` | Line 53 |
| Comment-archaeology check (ZERO matches after literal exclusion) | PASS |
| Production gate unchanged | Line 37 |

## Deviations

One deviation from the plan's suggested approach: the plan noted "If `npm run lint` ever exits non-zero solely because of this unused directive, the fix is to enable `no-console` in `eslint.config.js`." The pre-commit hook uses `--max-warnings 0`, stricter than `npm run lint`. Rather than enabling `no-console` globally (which would produce ~78 warnings across the codebase), a file-scoped override was added for `[__smoke].tsx` only. This satisfies the plan's intent (directive is valid, not unused) with minimal surface impact.

## Manual Verification Required

The following checks require a running dev server and are deferred to the operator:

1. `npm run dev`, visit `/__smoke?fire=render`:
   - Page shows `Smoke throw captured.` (local boundary fallback), NOT `Something went wrong.` from `AppErrorFallback`
   - DevTools console: `[smoke] sentry.eventId <hex-string>`
   - `<body>` element: `data-sentry-event-id="<same-hex-string>"`

2. Visit `/__smoke?fire=dedupe`: same surface with a DIFFERENT event ID

3. Visit `/__smoke?render=1`: still escalates to `AppErrorFallback` (unchanged canary contract)

The dashboard `event_id == dataset ID` cross-check is deferred to Plan 04 Task 3 (post-deploy on the Netlify preview).
