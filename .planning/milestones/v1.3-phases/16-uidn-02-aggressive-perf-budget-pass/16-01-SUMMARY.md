---
phase: 16
plan: 01
subsystem: build-tooling
requirements-completed: [PERF-01]
tags: [bundle-analysis, vite-config, security-hardening, d09-trap, sourcemap-upload]
dependency_graph:
  requires: []
  provides: [PERF-01, build:analyze script, D-09 config-load throw, ANALYZE env-gate]
  affects: [vite.config.ts, package.json, downstream plans PERF-02 through PERF-07]
tech_stack:
  added: [rollup-plugin-visualizer@7.0.1]
  patterns: [env-gated plugin mutex, module-scope throw guard, visualizer treemap]
key_files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - vite.config.ts
decisions:
  - D-09 throw keys on CONTEXT (Netlify-native) AND NETLIFY_CONTEXT (legacy defense-in-depth) — keying only on NETLIFY_CONTEXT would make the trap inert in real Netlify CI
  - build:analyze uses ANALYZE=true npm run build (wrapper form) — inline ANALYZE=true tsr generate && tsc -b && vite build scopes the env var only to tsr generate, not vite build
  - visualizer uses open:false — no auto-browser-launch in CI or headless shells
metrics:
  duration: ~15m
  completed: 2026-05-28
  tasks_completed: 4
  files_changed: 3
---

# Phase 16 Plan 01: Bundle Visualizer + D-09 Sentry Mutex Summary

**One-liner:** `rollup-plugin-visualizer@7.0.1` added as exact-pinned devDep with `ANALYZE=true` env-gate, visualizer/sentryVitePlugin mutex, and config-load throw protecting the Phase 15 OBSV-04 sourcemap-upload chain.

## What Was Built

### Task 2: Package install + build:analyze script
- `npm install --save-dev --save-exact rollup-plugin-visualizer@7.0.1` — exact pin (no `^`/`~`), T-16-SC legitimacy verified by operator before install
- `"build:analyze": "ANALYZE=true npm run build"` added to `package.json` scripts immediately after `"build"` — wrapper form propagates `ANALYZE` to the entire `tsr generate && tsc -b && vite build` chain

### Task 3: vite.config.ts — D-09 throw + visualizer/sentry mutex
- `import { visualizer } from 'rollup-plugin-visualizer'` added
- Module-scope guard fires at config-load if `ANALYZE=true && (CONTEXT=production || NETLIFY_CONTEXT=production)`; kills the build before any artifact is written
- D-09 error message: `[OBSV-04] Cannot run bundle analysis in a Netlify production deploy. rollup-plugin-visualizer and sentryVitePlugin are mutually exclusive at the last-plugin position — running both would skip the Phase 15 sourcemap-upload chain and break Sentry stack-frame resolution. Unset ANALYZE or run bundle analysis locally only.`
- `if (process.env.ANALYZE === 'true') { plugins.push(visualizer({...})) } else { plugins.push(sentryVitePlugin({...})) }` — never both at last-plugin position
- `rolldownOptions.output.keepNames: true` preserved byte-for-byte (Phase 15 invariant)
- No `rollupOptions` key introduced (Pitfall 8 anti-regression)
- `defineConfig` factory converted from implicit-return arrow to explicit-return braced arrow to allow `const plugins = [...]` construction

### Task 4: End-to-end verification (verification only, no file changes)

## Verification Results

| Check | Invocation | Expected | Actual |
|-------|-----------|---------|--------|
| Vanilla build | `npm run build` | exit 0, no stats.html | PASS |
| Phase 15 keepNames | `node scripts/verify-sourcemap-names.mjs` | 7/7 found | PASS — `7/7 allowlisted names found` |
| Analyze build | `ANALYZE=true npm run build` | exit 0, stats.html emitted | PASS — 945KB treemap |
| D-09 Netlify-native | `CONTEXT=production ANALYZE=true npm run build` | exit ≠ 0, OBSV-04 in output | PASS (rc=1) |
| D-09 legacy guard | `NETLIFY_CONTEXT=production ANALYZE=true npm run build` | exit ≠ 0, OBSV-04 in output | PASS (rc=1) |

`dist/stats.html` size from analyze run: **945431 bytes** (treemap showing pre-PERF-03 chunk graph with posthog-js in main entry chunk — PERF-02 baseline artifact).

## Deviations from Plan

### Pre-existing issues discovered (out-of-scope, logged)

**Lint: 728 ESLint errors** — confirmed pre-existing by reverting `vite.config.ts` and re-running lint (same 728 errors). Not caused by plan changes. Logged to `deferred-items.md` per scope-boundary rule.

**Tests: 24 Vitest test files failing** — confirmed pre-existing by reverting `vite.config.ts` and re-running tests (same 24 failures). Not caused by plan changes. Logged to `deferred-items.md`.

### Correct deviations

None — plan executed exactly as written.

## Known Stubs

None — this plan adds build tooling only (no UI rendering, no data stubs).

## Threat Flags

None — this plan is a hardening pass that protects an existing trust boundary (OBSV-04 sourcemap-upload integrity). No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] `package.json` contains `"rollup-plugin-visualizer": "7.0.1"` (exact pin) and `"build:analyze": "ANALYZE=true npm run build"`
- [x] `vite.config.ts` contains: visualizer import, D-09 module-scope throw, env-gated mutex, keepNames unchanged, no rollupOptions key
- [x] Commits e6e6230 (Task 2), 2b0987e (Task 3), 6c726fd (Task 4) all present in git log
- [x] `dist/stats.html` emitted by `ANALYZE=true npm run build` (945KB)
- [x] 7/7 Phase 15 keepNames names found in vanilla build
- [x] D-09 trap fires on both CONTEXT=production and NETLIFY_CONTEXT=production
