---
phase: 16
slug: uidn-02-aggressive-perf-budget-pass
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-27
validated: 2026-05-31
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from `16-RESEARCH.md § Validation Architecture` (line 351–387).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.6 (already shipped, `package.json:62`) |
| **Config file** | Inlined in `vite.config.ts:42-56` (uses `vitest/config`) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run lint && npm run test && npm run build` |
| **Estimated runtime** | ~60s (test ~12s + lint ~6s + build ~40s) |

E2E (Playwright) under `e2e/` — `npm run e2e` — used for the optional GDPR-no-network smoke (Wave 0 gap, see below).

---

## Sampling Rate

- **After every task commit:** Run `npm run lint && npm run test`
- **After every plan wave:** Run `npm run lint && npm run test && npm run build` (catches `manualChunks` misconfigurations, TypeScript drift, and exercises the D-09 throw if `ANALYZE=true` leaks into env)
- **Before `/gsd:verify-work`:** Full suite green AND `bash .planning/closure/audit-mobile.sh` executed against production deploy with results appended to `.planning/closure/UIDN-02-mobile-evidence.md § v1.3 Rerun`
- **Max feedback latency:** ~60s

---

## Per-Task Verification Map

> Task IDs are placeholders — actual IDs are assigned by the planner. Plans should reference this map by `Requirement` column.

| Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01 (PERF-01) | 1 | PERF-01 | `vite.config.ts` throws at config-load when `ANALYZE && (CONTEXT=production OR NETLIFY_CONTEXT=production)` (prevents OBSV-04 sourcemap-upload regression). Guard keys ONLY on Netlify deploy context — a plain local `ANALYZE=true npm run build` (production-mode, no CONTEXT) does NOT throw and emits `dist/stats.html`. | manual / config-load assertion | `CONTEXT=production ANALYZE=true npm run build` AND `NETLIFY_CONTEXT=production ANALYZE=true npm run build` (each: expect non-zero exit + error citing OBSV-04); `ANALYZE=true npm run build` (expect exit 0 + `dist/stats.html` emitted) | manual-only (verified `vite.config.ts:25-36`) | ⬛ manual-only |
| 16-01 (PERF-01) | 1 | PERF-01 | Phase 15 sourcemap-name allowlist (7 names) still passes for production builds | automated / sourcemap guard | `npm run build && node scripts/verify-sourcemap-names.mjs` | ✅ shipped (Phase 15); runs in CI `lint-and-unit` | ✅ green |
| 16-02 (PERF-02) | 1 | PERF-02 | Pre-change bundle baseline captured | manual / file existence | `test -f .planning/closure/v1.3-bundle-audit-pre.html` | ✅ present (945 KB) | ⬛ manual-only (artifact present) |
| 16-03 (PERF-03) | 2 | PERF-03 | Facade queues calls when client is null, replays them after `setClient(c)` is invoked | unit | `npx vitest run src/__tests__/lib/posthog-facade.test.ts` | ✅ `src/__tests__/lib/posthog-facade.test.ts` | ✅ green |
| 16-03 (PERF-03) | 2 | PERF-03 | `<PostHogGate>` renders children directly when consent ≠ `'allow'`; mounts lazy provider when `'allow'` | component | `npx vitest run src/__tests__/components/PostHogGate.test.tsx` | ✅ `src/__tests__/components/PostHogGate.test.tsx` | ✅ green |
| 16-03 (PERF-03) | 2 | PERF-03 / GDPR invariant | Zero `posthog-js` network request before consent='allow' | e2e | `npm run e2e -- posthog-consent-gate` | ✅ `e2e/tests/posthog-consent-gate.spec.ts` | ✅ green (1/1, run in 16-VERIFICATION session) |
| 16-04 (PERF-04) | 3 | PERF-04 | `vendor-react` + `vendor-posthog` chunks present in `dist/assets/`; `vendor-react` does NOT contain TanStack Router | manual / smoke + treemap inspect | `ls dist/assets/ \| grep -E '^vendor-(react\|posthog)-'`; visual treemap check via `ANALYZE=true npm run build` | manual-only (chunks emitted; `vite.config.ts:93-100`) | ⬛ manual-only (artifact verified) |
| 16-05 (PERF-05) | 3 | PERF-05 | `wtcs-logo.webp` emitted to `dist/`; `<picture>` markup renders identically to PNG-only baseline (zero-CLS preserved) | manual / visual | `ls dist/assets/ \| grep wtcs-logo.webp`; visual eye-check | manual-only (`Navbar.tsx:33-42` + dist webp emitted) | ⬛ manual-only (visual; not asserted by Navbar.test.tsx) |
| 16-06 (PERF-06) | 3 | PERF-06 | `defaultPreload: 'intent'` works app-wide; Admin Link `preload={false}` prevents AdminGuard hover-redirect | manual smoke | manual hover on Admin link in DevTools Network (needs admin Discord session) | manual-only (`main.tsx:39`, `Navbar.tsx:73`, `MobileNav.tsx:64`); operator-accepted static-grep fallback | ⬛ manual-only (live interaction) |
| 16-07 (PERF-07) | 4 (post-merge) | PERF-07 | Lighthouse mobile Performance ≥ 90 on all 5 routes (PASS) OR documented DEFER | manual (production) | `bash .planning/closure/audit-mobile.sh` against prod URL | ✅ executed; stdout EXIT_CODE=0, 5/5 PASS | ⬛ manual-only (production single-run; artifact present) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ⬛ manual-only*

---

## Wave 0 Requirements

- [x] `src/__tests__/lib/posthog-facade.test.ts` — unit tests for queue-and-replay semantics (covers PERF-03 D-02) — **shipped, green**
- [x] `src/__tests__/components/PostHogGate.test.tsx` — component test for naked-children vs lazy-provider switch (covers PERF-03 D-01); mock `useConsent` — **shipped, green**
- [x] Playwright e2e `e2e/tests/posthog-consent-gate.spec.ts` asserting no `posthog-js` network request before clicking Allow on the consent banner — covers the GDPR consent-gate timing invariant — **shipped, green (1/1)**. The optional/defensive spec was promoted to a mandatory runtime gate.
- [x] Snapshot check: `src/__tests__/layout/Navbar.test.tsx` exists but is an admin-link-visibility regression guard, not a `<picture>`-markup snapshot. The WebP markup is visual/manual-only (verified at `Navbar.tsx:33-42` + dist webp emitted) — no new automated test required per the draft's own classification.

*Existing infrastructure covers visualizer + manualChunks + audit-mobile mechanics via the existing build pipeline + Phase 15 sourcemap-names guard + the `.planning/closure/audit-mobile.sh` script — none of those need new infrastructure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `vite.config.ts` throws at config-load on Netlify-production + ANALYZE collision | PERF-01 (D-09) | Config-load assertion runs before any test framework; exercised by running the build with the trap env-vars set. Both Netlify-native signals must be validated. | `CONTEXT=production ANALYZE=true npm run build` AND `NETLIFY_CONTEXT=production ANALYZE=true npm run build` — each expects non-zero exit and error message naming OBSV-04 |
| `vite.config.ts` does NOT throw on local production-mode `build:analyze` | PERF-01 (D-09) | The guard fires ONLY on Netlify production context, NOT on local production-mode analyze; a local `build:analyze` legitimately needs the production bundle and uploads no sourcemaps | `ANALYZE=true npm run build` (no CONTEXT) — expect exit 0 AND `dist/stats.html` emitted |
| Bundle baseline HTML | PERF-02 | Treemap is an HTML artifact for human inspection, not a programmatic assertion | `ANALYZE=true npm run build && cp dist/stats.html .planning/closure/v1.3-bundle-audit-pre.html`; open in browser; confirm `posthog-js` in main chunk |
| `vendor-react`/`vendor-posthog` chunk shape | PERF-04 | Treemap inspection — confirms TanStack Router is NOT inside `vendor-react` (Pitfall 2 in RESEARCH.md) | `ANALYZE=true npm run build` after PERF-04 lands; open `dist/stats.html`; inspect `vendor-react` and `vendor-posthog` chunk contents |
| Visual logo parity post-WebP swap | PERF-05 | Image rendering is visual, not testable; manual eye-check on dev server | `npm run dev` → load `/` → compare Navbar logo to v1.2 baseline screenshot |
| `defaultPreload: 'intent'` Admin Link safety | PERF-06 | Hover-redirect leak (Pitfall 6) is interaction-based; DevTools confirmation | DevTools Network tab → hover Admin link → confirm no admin-route preload fires |
| Lighthouse mobile rerun | PERF-07 (D-13) | Production-only, single-run policy; against deployed Netlify URL | `bash .planning/closure/audit-mobile.sh` after Phase 16 PR merges and Netlify ships; capture stdout per Phase 13 D-27 pattern |
| GDPR consent-gate timing | PERF-03 / cross-cutting | Network-graph assertion — covered automatically by lazy chunk + facade, manually re-verified on preview | DevTools Network on Netlify preview → load `/` → no `posthog-js` requests until user clicks Allow in consent banner |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (or are intrinsically manual-only with artifact evidence)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (PERF-01/02 sequence is config/baseline only — counts as 2; PERF-03 brings unit + component + e2e tests; sampling continuous)
- [x] Wave 0 covers all ❌ references: `posthog-facade.test.ts` + `PostHogGate.test.tsx` + GDPR-no-network e2e — all shipped and green
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-05-31 (Nyquist-compliant)

---

## Validation Audit 2026-05-31

State A audit of a planning-time draft that was never promoted after Phase 16 shipped (2026-05-29). All `❌ W0 pending` test references resolved to shipped, green files; no new tests generated. The one privacy/security-critical behavior — the GDPR "zero posthog-js before consent='allow'" invariant — has automated runtime coverage (`posthog-consent-gate.spec.ts`). Remaining PERF requirements are intrinsically manual-only (build-config assertions, treemap inspection, visual logo parity, production Lighthouse single-run, live admin-session hover) and are all artifact-verified in `16-VERIFICATION.md`.

| Metric | Count |
|--------|-------|
| Gaps found | 0 (all draft `❌`/`⬜` markers were stale, not gaps) |
| Resolved | 0 (no test generation needed) |
| Escalated | 0 |
| Automated coverage | PERF-01 (sourcemap guard, CI) · PERF-03 (3 tests: facade unit + gate component + GDPR e2e) |
| Manual-only (by nature) | PERF-01 (D-09 throw) · PERF-02 · PERF-04 · PERF-05 · PERF-06 · PERF-07 |

Verification this session: `npx vitest run` on the 3 phase-16 test files → **3 files / 12 tests passed**.
