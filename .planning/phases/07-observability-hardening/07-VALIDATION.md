---
phase: 7
slug: observability-hardening
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-29
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit, if used) + manual deploy-preview verification (primary) |
| **Config file** | `vitest.config.ts` if present; otherwise "none — manual flow" |
| **Quick run command** | `npx tsc -b --noEmit && npm run build` |
| **Full suite command** | `npm run build` (production build — proves keepNames + sourcemap shape) |
| **Estimated runtime** | ~30–60 seconds for build; manual Sentry verify ~5 minutes per cycle |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc -b --noEmit` (fast — catches React 19 createRoot signature issues, verbatimModuleSyntax type-import drift, Rolldown option shape)
- **After every plan wave:** Run `npm run build` (proves keepNames mechanically takes effect via `__name(` annotations + `names[]` in sourcemap)
- **Before `/gsd-verify-work`:** Full Netlify deploy-preview verification per D-08 (4 evidence artifacts in 07-VERIFICATION.md)
- **Max feedback latency:** ~60 seconds for code changes; ~5 minutes for Sentry-event verification

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-T1 | 01 | 1 | OBSV-01 | T-07-02, T-07-03 | React 19 createRoot routes render-phase errors via Sentry.reactErrorHandler + ErrorBoundary beforeCapture/onError belt with boundary='app-root' | typecheck + grep | `npx tsc -b --noEmit; grep -c 'Sentry\.reactErrorHandler(' src/main.tsx` (>= 3) | ✅ existing | ⬜ pending |
| 07-01-T2 | 01 | 1 | OBSV-02 | T-07-01, T-07-04 | Rolldown emits `__name(` calls + sourcemap `names[]` includes real identifiers (`RenderThrowSmoke`, `RootLayout`, `AppErrorFallback`); `VITE_NETLIFY_CONTEXT=$CONTEXT` shell-substituted in netlify.toml | build + grep | `SENTRY_AUTH_TOKEN= npx vite build && grep -l '__name(' dist/assets/*.js \| wc -l` (>= 1) | ✅ existing | ⬜ pending |
| 07-02-T1 | 02 | 2 | OBSV-01 | — | RenderThrowSmoke is a render-phase throw with deterministic Sentry-search message; named export only; no Sentry calls | typecheck + grep | `npx tsc -b --noEmit; grep -c 'export function RenderThrowSmoke' src/components/debug/RenderThrowSmoke.tsx` (== 1) | ✅ existing | ⬜ pending |
| 07-02-T2 | 02 | 2 | OBSV-01 | T-07-05, T-07-06 | `/__smoke?render=1` throws in render phase on non-prod; returns 404 on production via `beforeLoad` env-gate; route file is `src/routes/[__smoke].tsx` (bracket-escaped) | build + grep | `npm run build; grep -c "VITE_NETLIFY_CONTEXT === 'production'" 'src/routes/[__smoke].tsx'` (== 1) AND `grep -c "fullPath: '/__smoke'" src/routeTree.gen.ts` (>= 1) | ✅ existing | ⬜ pending |
| 07-03-T1 | 03 | 3 | OBSV-01, OBSV-02 | — | Sentry event mechanism.type ∈ {auto.function.react.error_handler, auto.function.react.error_boundary, generic} (NOT auto.browser.global_handlers.onerror); top frames un-mangled; D-08 evidence captured | manual deploy-preview | (manual — see Manual-Only Verifications table below + 07-VERIFICATION.md) | ✅ existing | ⬜ pending |
| 07-03-T2 | 03 | 3 | OBSV-01, OBSV-02 | T-07-13 | 07-VERIFICATION.md follows 06-VERIFICATION.md 12-section template; 5/5 SC pass; no `<placeholder>` tokens remain | grep | `grep -c '## Goal Achievement\|## Required Artifacts\|## Human Verification Required' .planning/phases/07-observability-hardening/07-VERIFICATION.md` (== 3) | ✅ existing | ⬜ pending |
| 07-03-T3 | 03 | 3 | OBSV-02 | T-07-11 | OBSV-02-bundle-delta.md exists with same-session main-vs-phase-7 measurement; total + per-chunk gzip table; D-14 policy applied | grep | `grep -c '## Total gzip delta\|## Per-chunk gzip table\|## Target check' .planning/closure/OBSV-02-bundle-delta.md` (== 3) | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs above match the finalized PLAN.md files (07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md). Refined 2026-04-29.*

---

## Wave 0 Requirements

*No new test infrastructure required.* The existing build pipeline (`npm run build`) is the deterministic verification layer for OBSV-02 (sourcemap + chunk inspection), and the manual Netlify deploy-preview flow per D-07/D-08 is the verification layer for OBSV-01 (Sentry mechanism.type + componentStack + un-mangled stack frames).

If a Phase 8 Playwright fixture organically covers the smoke flow later, it lands there — not as a Phase 7 dependency.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sentry event for `/__smoke?render=1` shows populated `componentStack` and `tags.boundary === 'app-root'` | OBSV-01 | Requires a real Sentry event in the project's Sentry org — automating a Sentry-UI screenshot scrape is out of scope for $0/mo budget | Trigger smoke on Phase 7 PR's Netlify deploy preview → open Sentry event → screenshot the populated `componentStack` panel + the `tags` panel showing `boundary: 'app-root'`. Save as `.planning/phases/07-observability-hardening/artifacts/sentry-componentstack.png` |
| Sentry event top stack frames show un-mangled function/component names | OBSV-02 | Sentry symbolicates from the uploaded sourcemap at event-render time — only visible by opening the actual event in Sentry's UI | Same event as above → expand the top frame → screenshot showing `App`, `RenderThrowSmoke`, route component names (NOT `xR`, `$M`, etc.). Save as `.planning/phases/07-observability-hardening/artifacts/sentry-unmangled-frames.png` |
| Sentry event permalink + release SHA pinned in VERIFICATION.md | OBSV-01, OBSV-02 | Permalink is generated by Sentry server at event creation; release SHA is determined by the deploy-preview build that produced the event | Copy permalink from Sentry event URL bar; copy release SHA from event's release tag. Paste both into `07-VERIFICATION.md` |
| Sentry event `mechanism.type` is `auto.function.react.error_handler`, `auto.function.react.error_boundary`, or `generic` (NOT `auto.browser.global_handlers.onerror`) | OBSV-01 | Mechanism type is set by Sentry's transport based on which integration captured the error — only inspectable in event JSON view | Open Sentry event → "JSON" tab → `exception.values[0].mechanism.type` field → screenshot. Failure mode: if value is `auto.browser.global_handlers.onerror`, the React 19 hooks did NOT route the error and the global handler is masking the real problem |

---

## Validation Sign-Off

- [x] All planner-emitted tasks have `<automated>` verify (typecheck/build/grep) or are listed in the Manual-Only table above
- [x] Sampling continuity: every PLAN has at least one automated check (typecheck or build)
- [x] Wave 0 covers all MISSING references — N/A (no Wave 0 needed; existing build pipeline suffices)
- [x] No watch-mode flags in any automated command
- [x] Feedback latency < 60s for code changes; < 5min for Sentry verify cycles
- [x] `nyquist_compliant: true` set in frontmatter after planner verifies the per-task map matches PLAN frontmatter

**Approval:** approved 2026-04-29
