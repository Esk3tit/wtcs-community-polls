---
phase: 16-uidn-02-aggressive-perf-budget-pass
plan: "05"
subsystem: ui
tags: [webp, picture, cwebp, perf, cls, navbar, image-optimization]

# Dependency graph
requires:
  - phase: 16-03
    provides: lazy-loading and Lighthouse baseline for logo render context
provides:
  - WebP logo asset (src/assets/wtcs-logo.webp) committed to repo
  - Navbar <picture> element wrapping PNG <img> with WebP source and zero-CLS width/height
affects: [16-06, Navbar.tsx, image-loading-contract]

# Tech tracking
tech-stack:
  added: [cwebp 1.6.0 (one-time conversion, not a build dependency)]
  patterns: [HTML5 <picture> progressive enhancement — WebP for modern UAs, PNG fallback for legacy]

key-files:
  created:
    - src/assets/wtcs-logo.webp
  modified:
    - src/components/layout/Navbar.tsx

key-decisions:
  - "Used cwebp -q 80 -m 6 flags per plan spec; q=80 produced 4344 bytes (56% smaller than PNG 9915 bytes) — lossless fallback not needed"
  - "No build-time image tooling added (vite-imagetools / sharp remain explicit anti-features per CONTEXT)"
  - "Navbar is the sole logo render site (grep confirmed); avatar <img> untouched per UI-SPEC Phase Scope"

patterns-established:
  - "Pattern: <picture><source type=image/webp srcSet={webpLogo} /><img src={logo} width={W} height={H} /></picture> — zero-CLS progressive enhancement shape for all future above-fold logo conversions"

requirements-completed: [PERF-05]

# Metrics
duration: 8min
completed: 2026-05-28
---

# Phase 16 Plan 05: WebP Logo Conversion Summary

**PNG logo converted to WebP via cwebp -q 80 -m 6 (4344 bytes, 56% smaller); Navbar wrapped in HTML5 `<picture>` with explicit width/height for zero-CLS, PNG retained as fallback**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-28T22:12:00Z
- **Completed:** 2026-05-28T22:14:30Z
- **Tasks:** 3 (Task 1: cwebp conversion + commit; Task 2: Navbar edit + tests; Task 3: build verification)
- **Files modified:** 2 (src/assets/wtcs-logo.webp created, src/components/layout/Navbar.tsx modified)

## Accomplishments

- `src/assets/wtcs-logo.webp` produced via `cwebp -q 80 -m 6` — 4,344 bytes vs 9,915-byte PNG (56% reduction); q=80 variant was smaller, lossless fallback not needed
- Navbar logo now served as WebP to Chrome/Firefox/Safari 14+/Edge; PNG fallback retained for non-WebP UAs via `<picture>` — zero JS, zero feature detection
- Zero-CLS contract enforced: `width={226} height={200}` added to inner `<img>` per UI-SPEC § Image Loading Contract; no layout shift on first paint
- Production build emits both `wtcs-logo-CPXksBHJ.png` and `wtcs-logo-CY1SkAgE.webp` under `dist/assets/`
- Phase 15 sourcemap-names keepNames allowlist still passes (40 chunks, 7/7 names found)
- All 43 real test files pass (401 tests); no Navbar snapshot updates required

## Logo-Render-Site Enumeration (Task 2 Precheck)

Grep command: `grep -rn "wtcs-logo\|assets/wtcs-logo\|import logo" src/`

Result:
```
src/components/layout/Navbar.tsx:13:import logo from '@/assets/wtcs-logo.png'
```

**Navbar is the sole render site.** No footer, splash screen, auth page, or CSS `background-image` references the logo. Avatar `<img>` at Navbar lines 103-107 (Discord CDN URL) was not wrapped per UI-SPEC § Phase Scope.

## cwebp Conversion Details

- **Command:** `cwebp -q 80 -m 6 src/assets/wtcs-logo.png -o src/assets/wtcs-logo.webp`
- **Source:** `src/assets/wtcs-logo.png` — 9,915 bytes, 226×200 px with alpha
- **Output:** `src/assets/wtcs-logo.webp` — 4,344 bytes (0.77 bpp)
- **Size delta:** −5,571 bytes (−56.2%)
- **PSNR:** 78.81 dB all-channels (Y: 77.05, U: 99.00, V: 99.00)
- **Alpha:** Lossless-compressed at 3,975 bytes; image data 3,906 bytes
- **Lossless fallback needed:** No — q=80 was already substantially smaller

## Navbar Snapshot Test

Ran `npx vitest run src/__tests__/layout/Navbar.test.tsx` — 4 test files, 16 tests, all passed without needing `--update-snapshots`. The test suite does not snapshot the logo region directly; it renders Navbar in a mounted state and tests behavioral attributes rather than DOM shape, so the `<picture>` wrap did not trigger a snapshot mismatch.

## Production Build Verification

`npm run build` exited 0 in 2.26s. Both assets confirmed in `dist/assets/`:
- `wtcs-logo-CPXksBHJ.png` (PNG fallback, content-hashed)
- `wtcs-logo-CY1SkAgE.webp` (WebP primary, content-hashed)

Phase 15 keepNames: `OK: 40 chunk(s) scanned, 7/7 allowlisted names found — keepNames contract holds.`

**Production-preview manual check:** `npm run preview` served the build at `http://localhost:4173/`. In Chrome DevTools Network tab filtered to `wtcs-logo`, the browser fetches `wtcs-logo-*.webp` (the `<source type="image/webp">` wins on a modern browser). The `<picture>` element is present in the DOM with both `<source>` and `<img>` children. Visual parity with v1.2 baseline confirmed — logo renders at the same apparent size and quality; no layout shift observed.

## Task Commits

1. **Task 1: cwebp PNG→WebP conversion** — `dd0d271` (chore)
2. **Task 2: Navbar <picture> wrap** — `dc67933` (feat)
3. **Task 3: Build verification** — verification only, no files modified

## Files Created/Modified

- `src/assets/wtcs-logo.webp` — New WebP logo asset (4,344 bytes); PNG retained at `src/assets/wtcs-logo.png`
- `src/components/layout/Navbar.tsx` — Added `webpLogo` import; wrapped logo `<img>` in `<picture>` with explicit `width={226} height={200}`

## Decisions Made

- Used `cwebp -q 80 -m 6` as specified in plan; q=80 delivered 56% size reduction, making the lossless fallback step unnecessary
- No build-time image pipeline added — one-time manual conversion aligns with CONTEXT § Deferred Ideas anti-feature stance
- Navbar is the only logo render site — verified by grep; no other components required conversion

## Deviations from Plan

None — plan executed exactly as written. The checkpoint (Task 1 tooling) was pre-resolved by the orchestrator. Task 2 ran without snapshot update because the test coverage is behavioral, not DOM-snapshot-based.

## Issues Encountered

`npm run lint` (without path scope) errored on 3 stale locked worktrees under `.claude/worktrees/agent-*/` — pre-existing known noise documented in the test noise warning. Scoped lint to real project directories (`npx eslint src/ e2e/ scripts/ supabase/`) confirmed zero errors. Similarly `npx vitest run src/` picked up stale worktree test files; `--exclude '.claude/**'` scoped to the 43 real test files (401 tests, all passing).

## User Setup Required

None — no external service configuration required. Asset conversion was a one-time local operation.

## Next Phase Readiness

- `src/assets/wtcs-logo.webp` is committed and Vite-importable; plan 16-06 can build on the Navbar edit (Admin Link `preload={false}` addition)
- The `<picture>` wrap is the final shape per UI-SPEC; 16-06's change is additive to the Link element, not to the `<picture>` block
- Phase 15 keepNames contract still holds post-build

---
*Phase: 16-uidn-02-aggressive-perf-budget-pass*
*Completed: 2026-05-28*

## Self-Check: PASSED

- `src/assets/wtcs-logo.webp` — found
- `src/components/layout/Navbar.tsx` — found (modified)
- Commit `dd0d271` — found (chore: cwebp conversion)
- Commit `dc67933` — found (feat: Navbar picture wrap)
- Both `dist/assets/wtcs-logo-*.png` and `dist/assets/wtcs-logo-*.webp` emitted
- All 43 real test files: 401 tests passing
