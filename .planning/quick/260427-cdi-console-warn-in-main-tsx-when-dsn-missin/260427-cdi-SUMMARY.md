---
quick_id: 260427-cdi
description: console.warn in main.tsx when DSN missing in dev + refresh DebugAuthOverlay breadcrumbs live
status: complete
date: 2026-04-27
commits:
  - 68b9c17
  - 6552bad
---

# 260427-cdi — Sentry DSN warn + live breadcrumb refresh — SUMMARY

## Outcome

Two dev-quality follow-ups from Phase 6 UAT Playwright verification (commit `4294038`) shipped:

1. **`fix(260427-cdi): warn in dev when VITE_SENTRY_DSN missing`** (`68b9c17`) — mirrors the posthog warn from `260427-c5d`. Same silent-failure pattern: `Sentry.init({dsn: undefined})` short-circuits, `addBreadcrumb()` becomes a no-op, no signal in console.
2. **`refactor(260427-cdi): refresh DebugAuthOverlay breadcrumbs live`** (`6552bad`) — `breadcrumbs` was captured via `useState(snapshotBreadcrumbs)` (run-once at render); now refreshes every 1s by piggybacking on the existing `setNow` ticker.

## Changes

| Task | File | Commit | Status |
|------|------|--------|--------|
| 1 | `src/main.tsx` | `68b9c17` | done |
| 2 | `src/components/debug/DebugAuthOverlay.tsx` | `6552bad` | done |

## Diff Summary

### Task 1 — `src/main.tsx` (5 lines added before `Sentry.init`)
```ts
if (!import.meta.env.VITE_SENTRY_DSN && import.meta.env.DEV) {
  console.warn(
    '[sentry] VITE_SENTRY_DSN not set — error monitoring disabled. Set it in .env.local to enable Sentry in dev.'
  )
}
```
Production bundle unchanged: `import.meta.env.DEV` is `false` in build → Vite dead-code-eliminates the entire block.

### Task 2 — `src/components/debug/DebugAuthOverlay.tsx`
Two minimal edits, both within the existing component (no new timer, no new dependency):
- Line 109: `const [breadcrumbs] = useState(...)` → `const [breadcrumbs, setBreadcrumbs] = useState(...)`
- Line 134-137: existing `setInterval(() => setNow(Date.now()), 1000)` extended to also call `setBreadcrumbs(snapshotBreadcrumbs())` on the same tick.

Cost per tick: one shallow-mapped 5-element array allocation. Negligible.

## Verification

- `npx vitest run` → **386/386 pass** (40 test files, 4.66s)
- `npx tsc -b --noEmit` → clean
- No new lint warnings
- Production bundle unchanged for Task 1 (DEV-gated). Task 2 changes only the debug-overlay code path that's already production-gated by the `?debug=auth` query param — no impact on regular users.

## Why this matters

Phase 6 UAT cost two cycles to silent-failure dev env vars (PostHog Test 4, Sentry Test 11). Both warns now make these traps loud. The breadcrumb live-refresh fixes a real diagnostic gap: the overlay was the canonical way to verify Test 11 ("Sentry breadcrumb fires"), but its render-time snapshot meant the answer was always "(none)" regardless of whether the breadcrumb actually fired.

Both changes are dev/debug-only paths — zero production blast radius.

## Files

- Modified: `src/main.tsx`
- Modified: `src/components/debug/DebugAuthOverlay.tsx`
