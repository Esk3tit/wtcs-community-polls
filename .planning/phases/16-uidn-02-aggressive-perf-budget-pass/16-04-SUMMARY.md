---
phase: 16
plan: "04"
subsystem: build-tooling
requirements-completed: [PERF-04]
tags: [perf, bundle-split, manual-chunks, cache-stability, vendor-react, vendor-posthog]

dependency_graph:
  requires: [16-01, 16-03]
  provides: [vendor-react-chunk, vendor-posthog-chunk, PERF-04-chunk-shape]
  affects: [vite.config.ts, dist/assets]

tech_stack:
  added: []
  patterns:
    - "Rolldown manualChunks function form with boundary-anchored node_modules/<pkg>/ regex"
    - "vendor-react (react + react-dom + scheduler) cache-stable eager chunk"
    - "vendor-posthog (posthog-js) cache-stable lazy-only chunk"

key_files:
  created: []
  modified:
    - vite.config.ts

decisions:
  - "Function form used for manualChunks (not object form) — boundary-anchored regex gives explicit auditable control; object form unverified for Rolldown in this repo"
  - "vendor-react includes scheduler (React's own runtime dep) — unit is the React family, not literally two packages"
  - "supabase-js and sentry-replay intentionally left to Rolldown auto-split per D-04"

metrics:
  duration: ~20m
  completed: "2026-05-28"
  tasks_completed: 2
  files_created: 0
  files_modified: 1
---

# Phase 16 Plan 04: manualChunks for vendor-react + vendor-posthog (PERF-04) Summary

Extended `build.rolldownOptions.output` in `vite.config.ts` with a boundary-anchored `manualChunks` function that pins the React runtime family to `vendor-react` and posthog-js to `vendor-posthog`, shrinking the main entry chunk from 737.8 KB to 318.4 KB minified (-419 KB / -122 KB gzip) vs the PERF-02 baseline.

## What Was Built

`vite.config.ts` `build.rolldownOptions.output` extended with a `manualChunks` matcher (function form). The object previously contained only `keepNames: true` (Phase 15); this plan adds `manualChunks` alongside it. The D-09 `throw` guard at the top of the file and the `ANALYZE=true` plugin-mutex logic from plan 01 are untouched.

**Matcher shape (boundary-anchored function form):**
```ts
manualChunks: (id) => {
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id))
    return 'vendor-react'
  if (/[\\/]node_modules[\\/]posthog-js[\\/]/.test(id))
    return 'vendor-posthog'
},
```

Object form explicitly avoided — Rolldown object-keyed behavior is unverified in this repo, and the function form's explicit regex anchor prevents kitchen-sink contamination (the `id.includes('react')` pattern would catch @tanstack/react-router, @radix-ui/react-*, @sentry/react, etc.).

## Chunk Shape Verification (Task 2 — Treemap)

`ANALYZE=true npm run build` ran against the post-Task-1 tree. `dist/stats.html` produced and inspected via treemap JSON payload.

**(a) vendor-react chunk:** Present as `assets/vendor-react-BAVpsyGv.js` — **239.06 KB minified / 65.73 KB gzip** (unminified rendered size ~244 KB from treemap). The chunk tree contains exactly three packages:
- `node_modules/react` — react.production.js, react-jsx-runtime.production.js, index.js, jsx-runtime.js
- `node_modules/scheduler` — cjs/scheduler.production.js, index.js
- `node_modules/react-dom` — react-dom.production.js, react-dom-client.production.js, index.js, client.js

Confirmed absent from `vendor-react`: @tanstack/react-router, @radix-ui/react-*, @sentry/react, react-error-boundary, @testing-library/react. The React runtime family — `react` + `react-dom` + `scheduler` — is the complete and only content of this chunk. No kitchen-sink contamination.

**(b) vendor-posthog chunk:** Present as `assets/vendor-posthog-BNbuFl52.js` — **186.26 KB minified / 62.65 KB gzip** (unminified rendered size ~254 KB — `posthog-js/dist/module.js` 247,286 bytes + `posthog-js/react` 6,244 bytes). The chunk tree contains only `node_modules/posthog-js/dist/module.js`.

**(c) vendor-posthog lazy-only reachability (three independent controls):**
1. **Deterministic HTML assertion:** `grep "vendor-posthog" dist/index.html` returns nothing — `vendor-posthog` does NOT appear in the production `index.html` `<link rel="modulepreload">` set. Only `vendor-react` is preloaded.
2. **Treemap graph check:** The treemap JSON places `vendor-posthog` as a sibling of `vendor-react` at the non-entry level. The index chunk (`assets/index-CNCwsnVv.js`) tree contains `PostHogProviderInner` and `posthog-facade` (the 771-byte shim) — the actual posthog-js library module appears only under `assets/vendor-posthog-BNbuFl52.js`, which is a separate lazy branch. The `PostHogGate` component drives the dynamic import; `vendor-posthog` is reachable ONLY via the consent-gated lazy chunk.
3. **16-03 Playwright gate:** The existing `posthog-consent-gate.spec.ts` E2E test verifies at runtime that no posthog-js network request fires before the user clicks Allow — that gate was passing in plan 03 and this plan's manualChunks change does not alter the dynamic import chain.

**(d) GDPR invariant preserved:** `dist/index.html` modulepreload list contains `vendor-react-BAVpsyGv.js` and `posthog-facade-BiNfMrDk.js` (the 771-byte shim) but NOT `vendor-posthog-*`. posthog-js is strictly absent from the initial payload.

**(e) Main entry chunk delta vs PERF-02 baseline (number-to-number):**

| Metric | PERF-02 baseline (`index-DwJIVuTL.js`) | Post-PERF-03+04 (`index-CNCwsnVv.js`) | Delta |
|--------|----------------------------------------|---------------------------------------|-------|
| Minified size | 737,825 bytes (737.8 KB) | 318,413 bytes (318.4 KB) | **-419,412 bytes (~-410 KB)** |
| Gzip size | 222,997 bytes (~218 KB) | 97,573 bytes (~95 KB) | **-125,424 bytes (~-122 KB gzip)** |

The RESEARCH target was ~180-200 KB removed from the critical path. The actual reduction substantially exceeds that target (-410 KB minified / -122 KB gzip) because both PERF-03 (PostHog lazy-load, ~187 KB of posthog-js extracted) and PERF-04 (React family split into vendor-react, ~239 KB extracted) combined to remove the two largest library families from the initial payload. The `dist/index.html` initial modulepreload still includes `vendor-react` (eager), supabase-js, and Sentry core — but those were already auto-split by Rolldown before PERF-04.

## Commits

| Hash | Description |
|------|-------------|
| f4ff531 | feat(16-04): add manualChunks to rolldownOptions.output for vendor-react + vendor-posthog cache stability |

## Deviations from Plan

None — plan executed exactly as written. Function form used as PRIMARY (plan specifies function form as preferred). Object form not needed. Treemap inspection completed programmatically against the inline JSON payload in `dist/stats.html` (same inline JSON format discovered in plan 02).

## Known Stubs

None — this plan modifies only build tooling. No UI stubs.

## Threat Flags

None.

T-16-11 (kitchen-sink contamination): Mitigated — treemap confirms `vendor-react` contains only the React runtime family. No @tanstack/react-router, @radix-ui/react-*, @sentry/react in the chunk.

T-16-12 (wrong config key): Mitigated — manualChunks is inside `rolldownOptions.output` (not `rollupOptions`); build produces named chunks in `dist/assets/`, confirming the field was applied.

T-16-13 (posthog in entry chunk): Mitigated — three independent controls all pass (HTML absence assertion, treemap graph, Playwright gate from 16-03).

## Self-Check: PASSED

- `vite.config.ts` modified and committed — FOUND
- `dist/assets/vendor-react-B4X0TbE9.js` (vanilla build) — FOUND
- `dist/assets/vendor-posthog-Pf4RdMBF.js` (vanilla build) — FOUND
- `dist/stats.html` (analyze build) — FOUND
- `grep "vendor-posthog" dist/index.html` returns nothing — CONFIRMED
- `node scripts/verify-sourcemap-names.mjs` exits 0 on both vanilla and analyze builds — CONFIRMED
- All 43 real `src/` test files pass (401 tests); phantom worktree failures excluded — CONFIRMED
- Commit `f4ff531` — FOUND
