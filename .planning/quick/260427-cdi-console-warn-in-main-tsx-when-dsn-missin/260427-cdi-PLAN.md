---
quick_id: 260427-cdi
description: console.warn in main.tsx when DSN missing in dev + refresh DebugAuthOverlay breadcrumbs live
created: 2026-04-27
mode: quick
---

# 260427-cdi — Dev-quality follow-ups from Phase 6 UAT Playwright verification

## Why

Two follow-ups surfaced from Playwright-verified UAT diagnoses (commit 4294038):

1. **Mirror posthog warn** — `260427-c5d` added a `console.warn` in `posthog.ts` when `VITE_POSTHOG_KEY` is missing in dev. Phase 6 UAT Test 11 then surfaced the same silent-failure pattern for Sentry: `Sentry.init({dsn: undefined})` produces a no-op client with zero feedback. Same pattern, same fix.

2. **Live-refresh breadcrumbs in DebugAuthOverlay** — `DebugAuthOverlay.tsx:109` snapshots Sentry breadcrumbs via `useState(snapshotBreadcrumbs)` which runs ONCE at mount (render-phase, before useEffects commit). The component already has a 1s `setInterval` tick (`setNow` at line 134) for re-rendering — piggyback on it to refresh breadcrumbs live so the overlay shows what's currently in scope, not a stale render-time snapshot.

## Tasks

### Task 1 — warn in main.tsx when VITE_SENTRY_DSN missing

**Files:** `src/main.tsx`

**Action:** Before the `Sentry.init(...)` call at line 24, add a dev-only guard:

```ts
if (!import.meta.env.VITE_SENTRY_DSN && import.meta.env.DEV) {
  console.warn(
    '[sentry] VITE_SENTRY_DSN not set — error monitoring disabled. Set it in .env.local to enable Sentry in dev.'
  )
}
Sentry.init({ ... })  // unchanged
```

**Verify:**
- Start `npm run dev` with `VITE_SENTRY_DSN` unset → warning visible in browser console once on first load
- Start with DSN set → no warning
- `npm run build` (production) → no warning emitted (DEV is false; Vite dead-code-eliminates)
- 386/386 tests still pass

**Done when:** atomic commit `fix(260427-cdi):` with the warn.

### Task 2 — refresh DebugAuthOverlay breadcrumbs live

**Files:** `src/components/debug/DebugAuthOverlay.tsx`

**Action:**
- Change line 109 from `const [breadcrumbs] = useState<unknown[]>(snapshotBreadcrumbs)` to `const [breadcrumbs, setBreadcrumbs] = useState<unknown[]>(snapshotBreadcrumbs)`.
- Inside the existing `useEffect` (around line 134 where `setNow` ticks every 1s), call `setBreadcrumbs(snapshotBreadcrumbs())` on the same interval. Reuse the same tick — don't add a second timer.

```ts
const tick = window.setInterval(() => {
  setNow(Date.now())
  setBreadcrumbs(snapshotBreadcrumbs())
}, 1000)
```

**Verify:**
- 386/386 tests pass (the existing `ConsentMutualExclusion.test.tsx` and any DebugAuthOverlay tests still green)
- `tsc -b --noEmit` clean
- Manual probe via Playwright on `/auth/error?reason=auth-failed&debug=auth` (with DSN set) → breadcrumb appears in overlay within ~1s of navigation

**Done when:** atomic commit `refactor(260427-cdi):` with the live-refresh.

## Constraints

- DO NOT change the `setNow` semantics — it exists for a reason (re-render trigger for the original render-time consoleErrors filter; even if that filter is now state-bound after `260426-cty`, leave it for safety).
- DO NOT add a second `setInterval` — piggyback on the existing 1s tick.
- DO NOT deep-snapshot breadcrumbs every tick if it allocates excessively — the current `snapshotBreadcrumbs()` slices to last 5 + maps shallow, so the cost is negligible. Just keep the per-tick allocation as-is.
- Production bundle MUST NOT change shape — both fixes are dev/debug-only paths.
