---
phase: 07-observability-hardening
reviewed: 2026-04-30T00:00:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - netlify.toml
  - src/components/debug/RenderThrowSmoke.tsx
  - src/main.tsx
  - src/routeTree.gen.ts
  - src/routes/[__smoke].tsx
  - vite.config.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-04-30
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 7 wires the OBSV-01 capture path (React 19 createRoot tagged-handler factories + `Sentry.ErrorBoundary` defense-in-depth) and OBSV-02 sourcemap symbolication (Rolldown `keepNames`), gates the `/__smoke` canary on `VITE_NETLIFY_CONTEXT`, and exposes the Netlify build context via `netlify.toml` shell substitution.

The capture flow is functional — events will reach Sentry, the boundary tag survives `Dedupe`, and the smoke route is correctly hidden in production. However, deep cross-file analysis surfaces four warnings:

1. `mechanism.handled` is uniformly `true` for all three React error kinds (uncaught/caught/recoverable) because every taggedHandler invocation passes a non-null callback to `Sentry.reactErrorHandler`. This collapses release-health crash-free-session accuracy — uncaught errors are mis-tagged as handled.
2. Three independent captures fire for one render-phase throw inside `Sentry.ErrorBoundary`'s subtree (boundary auto-capture + boundary `onError` manual capture + `onCaughtError` hook capture). All rely on `Dedupe` which is best-effort; any structural divergence (cause-chain mutation by `captureReactException`'s `setCause`) can let duplicates through and inflate quota.
3. `Sentry.init`'s `environment` falls back via `??` (nullish coalesce). If Netlify shell substitution produces an empty string (`VITE_NETLIFY_CONTEXT=` when `$CONTEXT` is unset on a misconfigured branch deploy or non-Netlify CI), the empty string passes the nullish check and Sentry receives `environment: ""`.
4. `validateSearch` in `[__smoke].tsx` accepts `String(search.render) === '1'` — this matches truthy non-string values (numeric `1`, single-element array `[1]`, objects with `toString() => '1'`) due to JS coercion. Low security impact (debug-only route, prod-gated) but the validator is laxer than the `SmokeSearch` interface implies.

Plus five Info-level items (naming, redundant guards, route-file naming pedantics).

## Warnings

### WR-01: `mechanism.handled` mis-tagged for uncaught React errors

**File:** `src/main.tsx:81-92`
**Issue:** The taggedHandler factory always passes a non-null callback to `Sentry.reactErrorHandler`, regardless of `kind`. Per `node_modules/@sentry/react/build/esm/error.js:96-100`, `reactErrorHandler(callback)` sets `mechanism.handled = !!callback`. With every kind getting a callback, all three React error categories (uncaught, caught, recoverable) flag `handled=true` on the Sentry event.

This contradicts the `mechanism.handled` semantic (`node_modules/@sentry/core/build/types-ts3.8/types-hoist/mechanism.d.ts:11-14`): uncaught errors that escape every boundary are by definition unhandled. The Phase 7 OBSV-01 contract differentiates the kinds via the `react.errorHandlerKind` custom tag, but `mechanism.handled` also drives:
- Sentry UI's "handled" / "unhandled" badge
- Issue grouping rules
- Release-health crash-free-sessions metric (unhandled events count against the metric)

The Round-3 comment at `src/main.tsx:74-78` confirms `reactErrorHandler` is "additive" — true, but additive doesn't imply correct mechanism flagging.

**Fix:** Pass `undefined` (no callback) for the uncaught kind so `hasCallback=false` → `mechanism.handled=false`. Keep the dev-warn outside `reactErrorHandler` to preserve logging:
```ts
const taggedHandler = (kind: 'uncaught' | 'caught' | 'recoverable') =>
  (error: unknown, info: ErrorInfo) => {
    Sentry.withScope((scope) => {
      scope.setTag('boundary', 'app-root')
      scope.setTag('react.errorHandlerKind', kind)
      if (import.meta.env.DEV && kind === 'uncaught') {
        console.warn('[sentry] uncaught', error, info.componentStack)
      }
      // Pass undefined for uncaught so mechanism.handled=false.
      const cb = kind === 'uncaught'
        ? undefined
        : (_err: unknown, _errInfo: ErrorInfo) => { /* additive no-op */ }
      Sentry.reactErrorHandler(cb)(error, info)
    })
  }
```

### WR-02: Triple-capture for one render-phase throw — Dedupe is the only line of defense

**File:** `src/main.tsx:94-148`
**Issue:** When `RenderThrowSmoke` throws under `Sentry.ErrorBoundary`, three capture paths fire synchronously for the same error:

1. `Sentry.ErrorBoundary.componentDidCatch` → internal `captureReactException` (event A, with `boundary='app-root'` from `beforeCapture`).
2. `ErrorBoundary` props `onError` → manual `Sentry.captureException(error, { tags: { boundary, eventId } })` (event B).
3. `createRoot.onCaughtError` → `taggedHandler('caught')` → `reactErrorHandler` → `captureReactException` (event C, with `boundary` from outer `withScope`).

The Phase comment at `src/main.tsx:104-111` claims `Sentry.Dedupe` collapses these. Cross-checking `node_modules/@sentry/react/build/esm/error.js:57-64`: `captureReactException` calls `setCause(error, errorBoundaryError)` which **mutates** the same `Error` object across captures A and C. The first capture creates `errorBoundaryError` and assigns it as `error.cause`; the second capture sees the cause already present and walks down the chain to set a new cause on `errorBoundaryError`. By the time event C is built, the linked error chain differs from event A. Sentry's `Dedupe` integration compares stack traces and message; with mutated cause chains, dedup may keep BOTH events. (Actually B uses `Sentry.captureException` directly without `setCause` — different fingerprint from A and C.)

Risk: under bursty errors, what looks like one issue can produce 2-3 Sentry issue records, inflating quota and noise.

**Fix:** Either:
1. Drop the `ErrorBoundary` `onError` belt entirely (the boundary's auto-capture already runs `beforeCapture` which sets the tag — the belt is redundant unless dedup actively drops the auto event, which the comment admits is unverified). Keep only `createRoot` hooks + `Sentry.ErrorBoundary` auto-capture.
2. Or set `mechanism.handled` consistently on all three paths AND assert the `Dedupe` integration is enabled in `integrations: []`. Currently `integrations: [Sentry.browserTracingIntegration()]` does NOT explicitly add Dedupe — it relies on Sentry's `defaultIntegrations` which includes `dedupeIntegration` by default, but a future SDK upgrade could change this implicitly.

Add an explicit smoke assertion in dev: log a warning if more than 1 event is captured for the smoke throw within 100ms.

### WR-03: Empty-string `VITE_NETLIFY_CONTEXT` defeats the nullish-coalesce fallback

**File:** `src/main.tsx:35`, `netlify.toml:17`
**Issue:** `environment: import.meta.env.VITE_NETLIFY_CONTEXT ?? import.meta.env.MODE` uses `??` which only falls back on `null`/`undefined`. If shell substitution produces an empty assignment — e.g. `VITE_NETLIFY_CONTEXT=$CONTEXT` when `$CONTEXT` is unset (returns ``) — bash sets the var to literal empty string. Vite then exposes `import.meta.env.VITE_NETLIFY_CONTEXT === ""`, which passes `??` and lands as `environment: ""` in Sentry.

This won't happen on properly-configured Netlify (where `$CONTEXT` is always set), but:
- Forked deploys without Netlify env wiring (e.g., a contributor running `netlify deploy --build` locally without the Netlify CLI populating `$CONTEXT`).
- Non-Netlify CI accidentally re-using `netlify.toml` build commands.
- A future netlify.toml edit that mistypes the var name.

**Fix:** Use `||` (truthy fallback) or explicit empty-string guard:
```ts
environment: import.meta.env.VITE_NETLIFY_CONTEXT || import.meta.env.MODE,
```
Or harden the netlify.toml command to fail fast:
```toml
command = "npm ci && [ -n \"$CONTEXT\" ] && [ -n \"$COMMIT_REF\" ] && VITE_COMMIT_SHA=$COMMIT_REF VITE_NETLIFY_CONTEXT=$CONTEXT npm run build"
```

### WR-04: `validateSearch` uses lossy `String()` coerce — accepts non-string `render` values

**File:** `src/routes/[__smoke].tsx:32-33`
**Issue:** `String(search.render) === '1'` matches more inputs than the `SmokeSearch` interface (`render?: '1'`) implies:
- `search.render = 1` (number) → `'1'` ✓ (intentional per hotfix comment).
- `search.render = [1]` (array) → `'1'` ✓ (unintentional — `Array.prototype.toString` joins).
- `search.render = { toString: () => '1' }` → `'1'` ✓ (unintentional).
- `search.render = true` → `'true'` ✗ (correctly rejected).
- `search.render = '01'` → `'01'` ✗ (correctly rejected).

Security impact is negligible (debug-only route, prod-gated), but the validator is laxer than its declared type. If the route ever gains side-effects beyond the throw, this gap could matter.

**Fix:** Tighten to accept only the documented inputs:
```ts
validateSearch: (search: Record<string, unknown>): SmokeSearch => {
  const r = search.render
  if (r === '1' || r === 1) return { render: '1' }
  return {}
},
```

## Info

### IN-01: Sentry-DSN missing-warning runs at module load only — no runtime feedback

**File:** `src/main.tsx:24-28`
**Issue:** The `console.warn` for missing `VITE_SENTRY_DSN` fires once at module import. If a developer toggles their `.env.local` mid-session (HMR reloads the module), the warn fires again — fine. But there's no positive confirmation that Sentry IS active when the DSN is set. Triage cost: a developer wondering "is Sentry on?" has to inspect Network tab.

**Fix:** Add a counterpart `console.info` when DSN is present in DEV:
```ts
if (import.meta.env.DEV) {
  if (!import.meta.env.VITE_SENTRY_DSN) console.warn('[sentry] disabled (no DSN)')
  else console.info('[sentry] active', { env: import.meta.env.VITE_NETLIFY_CONTEXT ?? import.meta.env.MODE })
}
```

### IN-02: `eventId` as Sentry tag is non-idiomatic

**File:** `src/main.tsx:120`
**Issue:** `tags: { boundary: 'app-root', eventId }` places event A's ID as a tag on event B. Tags are intended for cardinality-bounded labels (env, release, route). Sentry event IDs are 32-char hex with cardinality = N events; shoving them in the tag dimension can blow up project tag indexing once the `eventId` distinct-value count crosses Sentry's free-tier tag limits. `contexts.linked_event = { eventId }` would carry the same information without polluting the tag namespace.

**Fix:**
```ts
Sentry.captureException(error, {
  tags: { boundary: 'app-root' },
  contexts: {
    react: { componentStack },
    linked_event: { eventId },
  },
})
```

### IN-03: Inner callback's `errInfo: ErrorInfo` annotation is redundant

**File:** `src/main.tsx:86`
**Issue:** `Sentry.reactErrorHandler((err, errInfo: ErrorInfo) => {…})` re-annotates `errInfo` even though Sentry's overload already types the callback as `(error: any, errorInfo: ErrorInfo, eventId: string) => void` (`node_modules/@sentry/react/build/types-ts3.8/error.d.ts:40`). The inline annotation adds no safety and clutters the closure. With `verbatimModuleSyntax: true`, the `import { type ErrorInfo }` at line 1 is needed for the OUTER taggedHandler signature, so the import stays — but the inner annotation can drop.

**Fix:**
```ts
Sentry.reactErrorHandler((err, errInfo) => {
  if (import.meta.env.DEV && kind === 'uncaught') {
    console.warn('[sentry] uncaught', err, errInfo.componentStack)
  }
})(error, info)
```

### IN-04: `RenderThrowSmoke`'s `: never` return type is decorative — TS doesn't narrow throw-only functions in JSX position

**File:** `src/components/debug/RenderThrowSmoke.tsx:16`
**Issue:** `function RenderThrowSmoke(): never` correctly types an unreachable return, but when used as a JSX component (`<RenderThrowSmoke />`), TanStack Router / React expect a `ReactNode`-returning component. TS happily accepts `never` as a subtype of `ReactNode` (`never` is bottom). No bug, but readers may wonder why a "component" returns `never`. A doc comment line clarifying the JSX use-case would help.

**Fix:** Add inline note:
```ts
// Returns `never` — the throw is unreachable downstream. JSX-position usage
// is fine because `never` is a subtype of ReactNode.
export function RenderThrowSmoke(): never { … }
```

### IN-05: `routeTree.gen.ts` is auto-generated — confirmed no manual edits

**File:** `src/routeTree.gen.ts:1-9`
**Issue:** File has the standard `/* eslint-disable */` + `@ts-nocheck` + "do not edit" header. The `Char91__smokeChar93Route` symbol confirms the bracketed file path was processed correctly. Nothing actionable; flagged for completeness of the deep-mode review (cross-file: confirms `[__smoke].tsx` is wired into the route tree).

**Fix:** None — auto-generated.

---

_Reviewed: 2026-04-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
