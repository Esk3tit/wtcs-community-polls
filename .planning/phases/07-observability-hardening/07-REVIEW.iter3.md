---
phase: 07-observability-hardening
reviewed: 2026-04-30T00:00:00Z
depth: deep
iteration: 2
files_reviewed: 6
files_reviewed_list:
  - netlify.toml
  - src/components/debug/RenderThrowSmoke.tsx
  - src/main.tsx
  - src/routeTree.gen.ts
  - src/routes/[__smoke].tsx
  - vite.config.ts
findings:
  blocker: 0
  warning: 0
  info: 4
  total: 4
status: clean
---

# Phase 7: Code Review Report (Iteration 2 — Post-Fix Re-Review)

**Reviewed:** 2026-04-30
**Depth:** deep
**Files Reviewed:** 6
**Status:** clean (all four prior warnings resolved; only carry-over Info items remain)

## Summary

Re-review of Phase 7 after fix iteration 1 (commits `5960565`, `f80336e`, `c9475b8`, `840f0ac`). All four warnings raised in iteration 1 have been fixed correctly with no observed regressions. SDK-level cross-checks were performed against the installed `@sentry/react@build/esm/error.js`, `@sentry/core/build/esm/integrations/dedupe.js`, `@sentry/core/build/esm/integration.js` (filterDuplicates), and `@sentry/browser/build/npm/esm/prod/sdk.js` (getDefaultIntegrations) to confirm the fixes hold against the actual library code, not just the documented contract.

Highlights:

1. **WR-01 closed.** `taggedHandler` now passes `undefined` to `Sentry.reactErrorHandler` for the `uncaught` kind so `mechanism.handled=false`. Dev-warn was correctly moved out of the inner callback into the `withScope` body so it still fires. Verified against `@sentry/react/build/esm/error.js:96-100`: `hasCallback = !!callback` → false → mechanism `{ handled: false }`. Caught/recoverable correctly retain `mechanism.handled=true` via the no-op `() => {}` callback.
2. **WR-02 closed.** `Sentry.dedupeIntegration()` is now explicit in `integrations:`. Cross-check with `@sentry/browser/build/npm/esm/prod/sdk.js:31` confirms Dedupe is in `getDefaultIntegrations()`, AND `@sentry/core/build/esm/integration.js:15-32` (`filterDuplicates`) confirms duplicates are filtered by integration `name` — so adding it explicitly does NOT cause double-registration. The fix is purely additive (auditability + future-proofing).
3. **WR-03 closed.** `import.meta.env.VITE_NETLIFY_CONTEXT || import.meta.env.MODE` correctly falls through empty strings. Edge case: a Netlify deploy-preview where `$CONTEXT` is unexpectedly empty will now fall back to `MODE='production'` (because the build itself runs with `NODE_ENV=production`), which is misleading but degrades cleanly to the legacy behavior — and the comment correctly documents this trade-off.
4. **WR-04 closed.** Validator now uses `r === '1' || r === 1` instead of `String(r) === '1'`. Tightening rejects `[1]`, `{ toString: () => '1' }`, and other coerce-to-`'1'` inputs. Type-aligned with `SmokeSearch.render?: '1'`. Default-search-parser path (`?render=1` → number) and JSON-string path (`?render=%221%22` → string) both still pass.

**Cross-file dedup contract (deep-mode check):** Confirmed sound. Both the `Sentry.ErrorBoundary` auto-capture path and the `createRoot.onCaughtError → reactErrorHandler` path set `boundary='app-root'` on the active scope BEFORE the underlying `withScope`/`captureException` call. Whichever event survives `Dedupe`, the surviving event carries the boundary tag. The `onError` belt's manual `captureException` is now the only path that does NOT use `setCause` (different cause-chain), but it still sets `boundary='app-root'` via its `tags:` option, so worst-case Sentry shows two issues — both correctly labeled.

**Cross-file `reactErrorHandler(undefined)` safety:** Verified in `@sentry/react/build/esm/error.js`: when `callback` is `undefined`, `hasCallback=false` and the `if (hasCallback) callback(...)` branch is skipped — no null-deref. The mechanism flag is the only side effect.

No new BLOCKER or WARNING issues introduced by the fixes.

## Info (carry-over from iteration 1)

The following Info items were noted in iteration 1 but were not in scope for the fix iteration. Three carry over verbatim; one (IN-03) is now resolved by the WR-01 fix and removed.

### IN-01: Sentry-DSN missing-warning runs at module load only — no positive confirmation when DSN IS set

**File:** `src/main.tsx:24-28`
**Issue:** Unchanged — the `console.warn` for missing `VITE_SENTRY_DSN` fires once at module import, but there's no positive confirmation that Sentry IS active when the DSN is set. Triage cost: a developer wondering "is Sentry on?" has to inspect the Network tab.
**Fix:** Add a counterpart `console.info` when DSN is present in DEV:
```ts
if (import.meta.env.DEV) {
  if (!import.meta.env.VITE_SENTRY_DSN) console.warn('[sentry] disabled (no DSN)')
  else console.info('[sentry] active', { env: import.meta.env.VITE_NETLIFY_CONTEXT || import.meta.env.MODE })
}
```

### IN-02: `eventId` as Sentry tag is non-idiomatic

**File:** `src/main.tsx:154` (was `:120` pre-fix; line shifted because WR-02 added one comment block)
**Issue:** Unchanged — `tags: { boundary: 'app-root', eventId }` places an event ID (high-cardinality) into Sentry's tag dimension. Sentry tag indexing is bounded; high-cardinality values can blow past free-tier limits over time. Move to `contexts.linked_event = { eventId }`.
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

### IN-04: `RenderThrowSmoke`'s `: never` return type is correct but visually surprising in JSX position

**File:** `src/components/debug/RenderThrowSmoke.tsx:16`
**Issue:** Unchanged — `: never` is technically correct (`never <: ReactNode`) but readers expect components to return JSX. A one-line note clarifying the JSX-position rationale would help.
**Fix:** Inline comment:
```ts
// Returns `never` — the throw is unreachable downstream. JSX-position usage
// is fine because `never` is a subtype of ReactNode.
export function RenderThrowSmoke(): never { … }
```

### IN-05: `routeTree.gen.ts` is auto-generated — confirmed no manual edits

**File:** `src/routeTree.gen.ts:1-9`
**Issue:** Unchanged — auto-generated file with `@ts-nocheck` header. `Char91__smokeChar93Route` symbol confirms the bracketed `[__smoke].tsx` filename was processed correctly. Listed for completeness of the deep-mode review (cross-file: confirms `[__smoke].tsx` is wired into the route tree).
**Fix:** None — auto-generated.

## Resolved (no longer applicable)

- **IN-03 (iteration 1):** Inner-callback `errInfo: ErrorInfo` annotation. Resolved as a side-effect of WR-01: the inner callback is now either `undefined` (uncaught) or an empty no-op `() => {}` (caught/recoverable), eliminating the redundant annotation entirely.

---

_Reviewed: 2026-04-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Iteration: 2 (post-fix re-review)_
