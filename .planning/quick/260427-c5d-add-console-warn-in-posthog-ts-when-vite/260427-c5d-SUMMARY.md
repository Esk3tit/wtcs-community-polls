---
quick_id: 260427-c5d
description: add console.warn in posthog.ts when VITE_POSTHOG_KEY missing in dev
status: complete
date: 2026-04-27
commit: 414ffe5
---

# 260427-c5d — Dev-mode warning when VITE_POSTHOG_KEY missing — SUMMARY

## Outcome

Phase 6 UAT Test 4 surfaced a silent failure: `initPostHog()` was
short-circuiting when `VITE_POSTHOG_KEY` was unset, returning the
uninitialized `posthog` stub with zero feedback. Added a one-line
`console.warn` gated on `import.meta.env.DEV` so the trap is now loud.

## Changes

| Task | File | Commit | Status |
|------|------|--------|--------|
| 1 | `src/lib/posthog.ts` | `414ffe5` | done |

## Diff Summary

`src/lib/posthog.ts:14-22` — replaced the bare `if (!key) return posthog`
with a block that emits a `console.warn` in dev before returning the stub:

```ts
if (!key) {
  if (import.meta.env.DEV) {
    console.warn(
      '[posthog] VITE_POSTHOG_KEY not set — analytics disabled. Set it in .env.local to enable PostHog in dev.'
    )
  }
  return posthog
}
```

## Verification

- `npx vitest run` → **386/386 pass** (40 test files, 4.35s)
- `npx tsc -b --noEmit` → clean
- Production bundle unchanged: `import.meta.env.DEV` is `false` in
  build, so the warn is dead-code-eliminated by Vite.

## Why this matters

Phase 6 UAT Test 4 was a wasted cycle: user reported "PostHog network
requests not firing after Allow" as a bug; diagnosis revealed it was
just a missing dev env var. This change makes that scenario visible in
the browser console on first dev load — the next person sees the
warning and adds the key without filing a bug.

No production behavior change. No test changes (DEV is false in
vitest by default; the warn doesn't surface in CI logs either).

## Files

- Modified: `src/lib/posthog.ts`
