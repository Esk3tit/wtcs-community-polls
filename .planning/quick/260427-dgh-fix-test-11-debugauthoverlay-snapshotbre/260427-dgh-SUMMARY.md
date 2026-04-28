---
quick_id: 260427-dgh
description: fix Test #11 — DebugAuthOverlay snapshotBreadcrumbs reads only currentScope; merge isolation+current+global
status: complete
date: 2026-04-27
commits:
  - 9ede900
  - fe5603c
---

# 260427-dgh — Fix DebugAuthOverlay scope-source bug — SUMMARY

## Outcome

Phase 6 UAT Test #11 closed. The DebugAuthOverlay's "Recent Sentry breadcrumbs" section now displays breadcrumbs added via `Sentry.addBreadcrumb()` in addition to whatever lands in the current scope. Test #11 passed live verification: the AuthErrorPage breadcrumb appears in the overlay within ~1s of navigation.

## Changes

| Task | File | Commit | Status |
|------|------|--------|--------|
| 1 | `src/components/debug/DebugAuthOverlay.tsx` | `9ede900` | done |
| 2 | `src/__tests__/components/DebugAuthOverlay.breadcrumbs.test.ts` (new) | `fe5603c` | done |

## Diff Summary

### Task 1 — `DebugAuthOverlay.tsx`

`snapshotBreadcrumbs()` now merges all three Sentry scopes (global + isolation + current), sorts by timestamp ascending, and returns the most recent 5. Function exported for direct unit testing.

```ts
export function snapshotBreadcrumbs(): unknown[] {
  const all = [
    ...(Sentry.getGlobalScope().getScopeData().breadcrumbs ?? []),
    ...(Sentry.getIsolationScope().getScopeData().breadcrumbs ?? []),
    ...(Sentry.getCurrentScope().getScopeData().breadcrumbs ?? []),
  ]
  all.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
  return all.slice(-5).map((b) => ({
    category: b.category, message: b.message, level: b.level,
    timestamp: b.timestamp, data: b.data,
  }))
}
```

### Task 2 — `DebugAuthOverlay.breadcrumbs.test.ts`

Three regression-guard cases:
1. Breadcrumb only in isolation scope → snapshot returns it (the actual Test #11 fix path).
2. Breadcrumbs across all three scopes → snapshot merges, sorts by timestamp, returns most-recent 5.
3. Empty scopes → snapshot returns `[]` without throwing.

## Verification

- `npx vitest run` → **389/389 pass** (40 → 41 test files; 386 → 389 tests; +3 new)
- `npx tsc -b --noEmit` → clean
- Live Playwright verification on `/auth/error?reason=auth-failed&debug=auth`:
  - Overlay's "Recent Sentry breadcrumbs (last 5)" section displays:
    - `{category:"auth", message:"AuthErrorPage rendered", level:"warning", data:{reason:"auth-failed"}}`
    - `{category:"auth", message:"AuthContext mounted", ...}`
    - `{category:"auth", message:"getSession() resolved", ...}` (×2)
    - `{category:"auth", message:"onAuthStateChange: INITIAL_SESSION", ...}`
  - Screenshot: `.playwright-mcp/phase6-test11-breadcrumbs-after-scope-fix.png`

## Why this matters

The overlay was the canonical way to verify auth lifecycle observability — that's its entire purpose. With `snapshotBreadcrumbs()` reading only the current scope, it silently missed everything `Sentry.addBreadcrumb()` emitted (which is most of the auth instrumentation, since v10's default scope target is isolation). A debug tool that lies is worse than no debug tool: it cost a UAT cycle.

Production Sentry capture was never affected — the SDK merges scopes at event-send time. This fix only restores fidelity for the dev/operator overlay path.

## Files

- Modified: `src/components/debug/DebugAuthOverlay.tsx`
- Created: `src/__tests__/components/DebugAuthOverlay.breadcrumbs.test.ts`
