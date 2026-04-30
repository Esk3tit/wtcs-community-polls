---
phase: 7
slug: observability-hardening
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-29
last_realigned: 2026-04-30
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Round-3 Refresh Note

This file was originally signed off on 2026-04-29 against the Round-1 plan text. After Round-2 cross-AI review (07-REVIEWS-v2.md) and Round-3 cross-AI review (07-REVIEWS.md), the per-task verification map and Manual-Only table drifted relative to the revised plans. Codex (Round-3 MEDIUM) and Cursor (Round-3 MEDIUM) both flagged the drift. This is a documentation-alignment refresh — no strategy changes — so the original sign-off below remains valid; a Round-3 alignment note is appended at the bottom rather than re-signing.

Lines that changed in this refresh:
- Per-task verification map row for `07-01-T2` — replaced `SENTRY_AUTH_TOKEN= npx vite build` with `npx vite build --mode development` (matches Plan 01 Task 2 + Plan 03 Task 1 step F as revised in Round-2 HIGH-2).
- Per-task verification map row for `07-01-T1` — adjusted Sentry.reactErrorHandler invocation-count assertion to reflect the `taggedHandler` factory pattern. The factory body contains ONE `Sentry.reactErrorHandler(` call; the factory is invoked three times via the createRoot options (`onUncaughtError`, `onCaughtError`, `onRecoverableError`). Express the assertion in terms of `grep -c "scope.setTag('boundary', 'app-root')" src/main.tsx >= 2` (factory body + ErrorBoundary `beforeCapture`) instead of the old "`Sentry.reactErrorHandler` count >= 3" which no longer holds with the factory pattern (Round-2 MEDIUM-5 fix; Round-3 confirmed reactErrorHandler is ADDITIVE per `node_modules/@sentry/react/build/esm/error.js:90-105`).
- Manual-Only Verifications row for mechanism.type — replaced the 3-value flat allowlist `{auto.function.react.error_handler, auto.function.react.error_boundary, generic}` with the two-tier criterion (PRIMARY = at least one event in `{auto.function.react.error_handler, auto.function.react.error_boundary}`; solo `generic` = PARTIAL pass blocked pending investigation; `auto.browser.*` = FAIL). Added Round-3 LOW-5 rename-escalation rule: a Sentry patch-release rename of these mechanism strings can be sign-off-overridden by the CONTEXT owner (Khai) with the actual observed string + override decision recorded in `07-VERIFICATION.md`.
- Per-task verification map row for `07-03-T1` — added Round-3 LOW-2 note that local sourcemap re-inspection at the deploy-preview release SHA uses `git worktree add` (not `git checkout`) to avoid colliding with the dirty Phase 7 working tree.

Cross-reference: `07-REVIEWS.md` Round-3 consensus MEDIUM ("07-VALIDATION.md drift relative to revised plans") and the Disposition Recommendation item #2.

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
| 07-01-T1 | 01 | 1 | OBSV-01 | T-07-02, T-07-03 | React 19 createRoot routes render-phase errors via the `taggedHandler` factory wrapping Sentry.reactErrorHandler + ErrorBoundary beforeCapture/onError belt with boundary='app-root' (Round-2 MEDIUM-5; Round-3 confirmed reactErrorHandler is ADDITIVE per node_modules/@sentry/react/build/esm/error.js:90-105) | typecheck + grep | `npx tsc -b --noEmit; grep -c "scope.setTag('boundary', 'app-root')" src/main.tsx` (>= 2 — factory body + ErrorBoundary beforeCapture; this replaces the prior "Sentry.reactErrorHandler count >= 3" assertion which no longer holds with the factory pattern) | ✅ existing | ⬜ pending |
| 07-01-T2 | 01 | 1 | OBSV-02 | T-07-01, T-07-04 | Rolldown emits `__name(` calls + sourcemap `names[]` includes real identifiers (`RenderThrowSmoke`, `RootLayout`, `AppErrorFallback`); `VITE_NETLIFY_CONTEXT=$CONTEXT` shell-substituted in netlify.toml | build + grep | `npx vite build --mode development && grep -l '__name(' dist/assets/*.js \| wc -l` (>= 1) — the `--mode development` flag triggers `disable: mode !== 'production'` at vite.config.ts:30, deterministically skipping the Sentry plugin's upload AND its `filesToDeleteAfterUpload` hook (Round-2 HIGH-2 fix; replaces the prior `SENTRY_AUTH_TOKEN= npx vite build` Round-1 pattern which depended on an untested empty-token assumption) | ✅ existing | ⬜ pending |
| 07-02-T1 | 02 | 2 | OBSV-01 | — | RenderThrowSmoke is a render-phase throw with deterministic Sentry-search message; named export only; no Sentry calls | typecheck + grep | `npx tsc -b --noEmit; grep -c 'export function RenderThrowSmoke' src/components/debug/RenderThrowSmoke.tsx` (== 1) | ✅ existing | ⬜ pending |
| 07-02-T2 | 02 | 2 | OBSV-01 | T-07-05, T-07-06 | `/__smoke?render=1` throws in render phase on non-prod; returns 404 on production via `beforeLoad` env-gate; route file is `src/routes/[__smoke].tsx` (bracket-escaped) | build + grep | `npm run build; grep -c "VITE_NETLIFY_CONTEXT === 'production'" 'src/routes/[__smoke].tsx'` (== 1) AND `grep -c "fullPath: '/__smoke'" src/routeTree.gen.ts` (>= 1) | ✅ existing | ⬜ pending |
| 07-02-T3 | 02 | 2 | OBSV-01 | T-07-05, T-07-06 | Local production-context smoke gate verified by manual browser checkpoint at `/__smoke?render=1` with `VITE_NETLIFY_CONTEXT=production` prod build: TanStack not-found UI rendered, AppErrorFallback NOT rendered, RenderThrowSmoke chunk NOT fetched (DevTools Network tab), no Sentry capture event for smoke message (Round-3 consensus HIGH fix — the prior Round-2 curl-based auto check was vacuous for SPA route gates) | manual browser checkpoint | (manual — see Manual-Only Verifications table below; build + preview commands ARE automated, the assertion is manual DOM/Network inspection) | ✅ existing | ⬜ pending |
| 07-03-T1 | 03 | 3 | OBSV-01, OBSV-02 | — | Sentry event mechanism.type two-tier criterion (Round-2 MEDIUM-1; Round-3 LOW-5 escalation): PRIMARY = ≥1 event in {auto.function.react.error_handler, auto.function.react.error_boundary}; solo `generic` = PARTIAL (sign-off blocked); `auto.browser.*` = FAIL. Top frames un-mangled; D-08 evidence captured. Local sourcemap re-inspection uses `git worktree` not `git checkout` (Round-3 LOW-2). Node fallback for jq uses `JSON.parse(fs.readFileSync)` not `require()` (Round-3 LOW-1). | manual deploy-preview | (manual — see Manual-Only Verifications table below + 07-VERIFICATION.md) | ✅ existing | ⬜ pending |
| 07-03-T2 | 03 | 3 | OBSV-01, OBSV-02 | T-07-13 | 07-VERIFICATION.md follows 06-VERIFICATION.md 12-section template; 5/5 SC pass; no `<placeholder>` tokens remain | grep | `grep -c '## Goal Achievement\|## Required Artifacts\|## Human Verification Required' .planning/phases/07-observability-hardening/07-VERIFICATION.md` (== 3) | ✅ existing | ⬜ pending |
| 07-03-T3 | 03 | 3 | OBSV-02 | T-07-11 | OBSV-02-bundle-delta.md exists with same-session 3-way main-vs-phase-7-without-keepNames-vs-phase-7-with-keepNames measurement (Round-2 MEDIUM-3); total + per-chunk gzip table sourced from Vite's printed gzip column (Round-3 LOW-4 — single source of truth per D-13; alternative `find ... \| xargs gzip` method removed); D-14 policy applied to keepNames-isolated delta | grep | `grep -c '## Total gzip delta\|## Per-chunk gzip table\|## Target check' .planning/closure/OBSV-02-bundle-delta.md` (== 3) AND `grep -c '^gzip_source: vite-printed-gzip-column$' .planning/closure/OBSV-02-bundle-delta.md` (== 1) | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs above match the finalized PLAN.md files (07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md). Refined 2026-04-29; realigned 2026-04-30 against Round-2 + Round-3 revisions.*

---

## Wave 0 Requirements

*No new test infrastructure required.* The existing build pipeline (`npm run build`) is the deterministic verification layer for OBSV-02 (sourcemap + chunk inspection), and the manual Netlify deploy-preview flow per D-07/D-08 is the verification layer for OBSV-01 (Sentry mechanism.type + componentStack + un-mangled stack frames).

If a Phase 8 Playwright fixture organically covers the smoke flow later, it lands there — not as a Phase 7 dependency. (Round-3 reviewers raised Playwright as the more robust automation for the local prod-context gate check; this was deliberately deferred to Phase 8 = E2E test hygiene per ROADMAP. Phase 7 uses a manual browser checkpoint instead — see 07-02-T3 above.)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Local production-context smoke gate verified by manual browser checkpoint at `/__smoke?render=1` with `VITE_NETLIFY_CONTEXT=production` prod build (Round-3 consensus HIGH fix — Plan 02 Task 3) | OBSV-01 | `vite preview` is a static-file server that returns the same `index.html` for every URL; TanStack `beforeLoad` runs only AFTER the browser executes the JS bundle, so curl can't exercise the gate. The Round-2 curl-based auto check was a false-positive generator (all three Round-3 reviewers flagged it independently). Playwright would automate this but is Phase 8 scope per ROADMAP — manual checkpoint is the correct call for Phase 7. | Build with prod-context env: `VITE_NETLIFY_CONTEXT=production npm run generate && npx tsc -b --noEmit && VITE_NETLIFY_CONTEXT=production npx vite build --mode development`. Start preview: `npx vite preview --port 4173 &`. Open `http://localhost:4173/__smoke?render=1` in a real browser with DevTools open BEFORE navigating. Confirm all four visual assertions: (a) TanStack default not-found UI rendered, (b) AppErrorFallback NOT rendered, (c) `RenderThrowSmoke` chunk NOT fetched per DevTools Network tab (hard-reload to defeat cache), (d) no Sentry capture event for the smoke message in Console/Network. Type "gate verified" once all four confirmed; "FAILED: <reason>" otherwise. Cleanup: `kill $PREVIEW_PID && rm -rf dist && npm run build`. |
| Sentry event for `/__smoke?render=1` shows populated `componentStack` and `tags.boundary === 'app-root'` | OBSV-01 | Requires a real Sentry event in the project's Sentry org — automating a Sentry-UI screenshot scrape is out of scope for $0/mo budget | Trigger smoke on Phase 7 PR's Netlify deploy preview → open Sentry event → screenshot the populated `componentStack` panel + the `tags` panel showing `boundary: 'app-root'`. Save as `.planning/phases/07-observability-hardening/artifacts/sentry-componentstack.png` |
| Sentry event top stack frames show un-mangled function/component names | OBSV-02 | Sentry symbolicates from the uploaded sourcemap at event-render time — only visible by opening the actual event in Sentry's UI | Same event as above → expand the top frame → screenshot showing `App`, `RenderThrowSmoke`, route component names (NOT `xR`, `$M`, etc.). Save as `.planning/phases/07-observability-hardening/artifacts/sentry-unmangled-frames.png` |
| Sentry event permalink + release SHA + event timestamp + environment tag pinned in VERIFICATION.md (Round-2 HIGH-1: environment must be `'deploy-preview'` or `'branch-deploy'`, NEVER `'production'`) | OBSV-01, OBSV-02 | Permalink is generated by Sentry server at event creation; release SHA is determined by the deploy-preview build that produced the event; environment tag is set by `Sentry.init` from `import.meta.env.VITE_NETLIFY_CONTEXT ?? import.meta.env.MODE` per Plan 01 Task 1 Round-2 HIGH-1 fix | Copy permalink from Sentry event URL bar; copy release SHA from event's release tag; record event ISO timestamp and environment tag value. Paste all four into `07-VERIFICATION.md ## Human Verification Required` row 3. If environment shows `'production'`, the HIGH-1 fix did not ship — STOP. |
| Sentry event `mechanism.type` two-tier criterion (Round-2 MEDIUM-1; Round-3 LOW-5 rename-escalation) | OBSV-01 | Mechanism type is set by Sentry's transport based on which integration captured the error — only inspectable in event JSON view | Open Sentry event → "JSON" tab → `exception.values[0].mechanism.type` field for EACH event matching the smoke message. **PRIMARY pass:** at least one event has `mechanism.type` ∈ `{auto.function.react.error_handler, auto.function.react.error_boundary}`. Additional `'generic'` events are EXPECTED companions (the manual onError belt fires `Sentry.captureException` directly → produces `'generic'`). **PARTIAL — solo `'generic'`** (no `auto.function.react.*` companion) = sign-off blocked pending investigation of Plan 01 Task 1 hook wiring. **FAILURE — any `auto.browser.*`** (e.g. `auto.browser.global_handlers.onerror`) = the React 19 hooks did NOT route the error and a global handler is masking the real problem; STOP and investigate. **Round-3 LOW-5 escalation** — if observed string differs from the literal allowlist due to a Sentry patch-release rename but clearly maps semantically to a PRIMARY path (e.g. `react.errorboundary`), CONTEXT owner (Khai) may grant a one-off override; record both the actual observed string AND the override decision verbatim in `07-VERIFICATION.md ## Human Verification Required` row 3 ("Override granted: observed `<actual>`, semantically maps to PRIMARY path because `<reason>`. Khai, `<date>`."). Without explicit recorded override, the literal-allowlist criterion still applies. |
| Sentry event `exception.values[0].value` matches deterministic smoke message (Round-2 LOW-2 — explicit verification of ROADMAP SC #1 "error.value present") | OBSV-01 | Same event-level inspection as mechanism.type; the value field can be truncated by Sentry server-side and only the JSON tab shows the actual stored value | Open Sentry event → "JSON" tab → `exception.values[0].value`. MUST equal `'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'` verbatim. Paste observed value into `07-VERIFICATION.md ## Human Verification Required` row 5. Discrepancy → check Plan 02 Task 1 message string + check whether Sentry truncated; note in 07-VERIFICATION.md if observed. |

---

## Validation Sign-Off

- [x] All planner-emitted tasks have `<automated>` verify (typecheck/build/grep) or are listed in the Manual-Only table above
- [x] Sampling continuity: every PLAN has at least one automated check (typecheck or build)
- [x] Wave 0 covers all MISSING references — N/A (no Wave 0 needed; existing build pipeline suffices)
- [x] No watch-mode flags in any automated command
- [x] Feedback latency < 60s for code changes; < 5min for Sentry verify cycles
- [x] `nyquist_compliant: true` set in frontmatter after planner verifies the per-task map matches PLAN frontmatter

**Approval:** approved 2026-04-29

**Round-3 alignment:** 2026-04-30 — re-aligned per-task map and Manual-Only table to match plans 07-01-PLAN, 07-02-PLAN, 07-03-PLAN as revised in commits ea40bea (Round 1), 7e76b13 (Round 2), and {round-3 commit SHA — leave placeholder; will be filled when this revision is committed}. No strategy changes; documentation alignment only. Original 2026-04-29 sign-off remains valid because Round-2 and Round-3 changes are within-strategy. Cross-reference: `07-REVIEWS.md` consensus MEDIUM ("07-VALIDATION.md drift relative to revised plans").
