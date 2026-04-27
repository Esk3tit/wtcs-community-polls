---
quick_id: 260427-dgh
description: fix Test #11 — DebugAuthOverlay snapshotBreadcrumbs reads only currentScope; merge isolation+current+global
created: 2026-04-27
mode: quick
---

# 260427-dgh — Fix DebugAuthOverlay scope-source bug for Sentry breadcrumbs

## Why

Phase 6 UAT Test #11 ("Sentry breadcrumb fires on AuthErrorPage") presented as a bug: the overlay's "Recent Sentry breadcrumbs" section showed `(none)` even though `AuthErrorPage.tsx:52-59` was correctly calling `Sentry.addBreadcrumb(...)`.

Playwright re-verification proved the breadcrumb DOES land — but in the **isolation scope**, not the current scope:

```js
__SENTRY__["10.49.0"].defaultIsolationScope._breadcrumbs
// → [{category:"auth", message:"AuthErrorPage rendered"}, ...7 entries]

__SENTRY__["10.49.0"].defaultCurrentScope._breadcrumbs
// → []
```

`Sentry.addBreadcrumb()` writes to the isolation scope by default in Sentry v10. The overlay's `snapshotBreadcrumbs()` at `src/components/debug/DebugAuthOverlay.tsx:92-93` reads only `getCurrentScope().getScopeData().breadcrumbs`, so it always shows empty even when breadcrumbs are present.

This is a **debug-tool display bug only** — production Sentry capture is unaffected because the SDK merges all three scopes (current + isolation + global) at event-send time.

## Tasks

### Task 1 — merge all three scopes in snapshotBreadcrumbs

**Files:** `src/components/debug/DebugAuthOverlay.tsx`

**Action:** Replace `snapshotBreadcrumbs()` to read from current + isolation + global scopes, sort by timestamp ascending, and return the last 5 (most recent). Export the function for direct unit testing.

```ts
export function snapshotBreadcrumbs(): unknown[] {
  // Sentry v10: Sentry.addBreadcrumb writes to the isolation scope by
  // default. Reading only getCurrentScope() misses everything the SDK
  // emits via addBreadcrumb. Mirror what the client does on event-send:
  // merge current + isolation + global, sort by timestamp, take the
  // most recent 5.
  const all = [
    ...(Sentry.getGlobalScope().getScopeData().breadcrumbs ?? []),
    ...(Sentry.getIsolationScope().getScopeData().breadcrumbs ?? []),
    ...(Sentry.getCurrentScope().getScopeData().breadcrumbs ?? []),
  ]
  all.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
  return all.slice(-5).map((b) => ({
    category: b.category,
    message: b.message,
    level: b.level,
    timestamp: b.timestamp,
    data: b.data,
  }))
}
```

**Verify:**
- `npx tsc -b --noEmit` clean
- 386/386 existing tests still pass
- Manual probe via Playwright: navigate to `/auth/error?reason=auth-failed&debug=auth`, wait 1.5s for the live-refresh tick (260427-cdi), confirm overlay's "Recent Sentry breadcrumbs (last 5)" shows the `AuthErrorPage rendered` entry.

**Done when:** atomic commit `fix(260427-dgh):` with the scope-merge.

### Task 2 — unit test asserting the fix

**Files:** `src/__tests__/components/DebugAuthOverlay.breadcrumbs.test.ts` (new)

**Action:** Import `snapshotBreadcrumbs` directly. Mock `@sentry/react` so `getCurrentScope`/`getIsolationScope`/`getGlobalScope` each return a stub with a `getScopeData` method returning a controllable breadcrumbs array. Write three test cases:

1. Breadcrumb only in isolation scope → snapshot returns it (regression guard for Test #11).
2. Breadcrumbs across all three scopes → snapshot merges, sorts by timestamp, returns most-recent 5.
3. No breadcrumbs anywhere → snapshot returns empty array (no throw).

**Verify:**
- `npx vitest run src/__tests__/components/DebugAuthOverlay.breadcrumbs.test.ts` → 3/3 pass
- Total test count: 386 → 389
- `tsc -b --noEmit` clean

**Done when:** atomic commit `test(260427-dgh):` with the new test file.

## Constraints

- DO NOT change the rest of `DebugAuthOverlay.tsx` (PKCE, cookies, sb-* localStorage, console errors, X dismiss). Only `snapshotBreadcrumbs()` and its export.
- Production bundle: this change lives in the debug overlay code, which is already gated by `?debug=auth` in `__root.tsx`, so no impact on regular users.
- Keep the live-refresh tick from `260427-cdi` intact — the new merged snapshot will be called on the same 1s interval.
- Don't dedupe across scopes. If the same breadcrumb appears in two scopes (rare but possible during scope transitions), Sentry SDK doesn't dedupe either — match its behavior.
