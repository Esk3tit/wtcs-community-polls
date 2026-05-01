---
phase: 07-observability-hardening
audited: 2026-04-30T10:05:00Z
auditor: gsd-verifier
status: passed
score: 5/5 ROADMAP success criteria + 3/3 plan must-have sets independently verified
gaps: 0
overrides_recommended: 0
warnings: 2  # planning-hygiene only — Warning #1 RESOLVED post-audit (REQUIREMENTS.md flipped in e7738fa + 57de6e2); Warning #2 STATE.md staleness; neither blocks PR #21 merge
---

# Phase 7 — Independent Verifier Audit

## 1. Summary

**Verdict: PASSED.** Every observable truth in ROADMAP.md (5 SC), REQUIREMENTS.md (OBSV-01, OBSV-02), and the three plans' `must_haves.truths` is independently confirmed against the codebase at `82bb086`. The two Round-4 amendments (validateSearch String coerce + Rolldown keepNames doc correction across 8 files + vite.config.ts comment) are present and sound. The four D-08 evidence artifacts are on disk; SC #3's Rolldown-correct literal-function-declaration grep returns 3 (matching expected ≥1) and the sourcemap `names[]` jq extraction returns `RenderThrowSmoke` + `SmokePage`, both matching 07-VERIFICATION.md's claims. The OBSV-02 bundle-delta closure record carries the required structure with the +6.24% over-target keepNames-isolated delta and a 5-bullet D-14 ship-anyway rationale. Two non-blocking planning-hygiene warnings: REQUIREMENTS.md Traceability table still lists OBSV-01/02 as `Pending` (not flipped despite SUMMARY.md `requirements-completed: [OBSV-01, OBSV-02]`), and STATE.md `stopped_at` is stale.

## 2. ROADMAP Success Criteria audit

Independent re-verification of each ROADMAP § Phase 7 SC against the codebase + artifacts.

| SC# | Criterion (truncated) | Independent finding | Evidence cited |
|-----|------------------------|--------------------|----------------|
| 1 | `/__smoke?render=1` on deploy preview produces Sentry event with populated `componentStack` AND `error.value` present | ✅ VERIFIED | `artifacts/sentry-event.json` envelope_body shows `contexts.react.componentStack` populated AND `exception.values[0].value === 'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'`. Permalink `https://khai-phan.sentry.io/issues/7451487881/events/5100cc65e9b94bc5b5906ab11ab79d3b/` recorded for human re-open. |
| 2 | Same event's top stack frames show original function/component names — not `xR`/`$M` | ✅ VERIFIED | `artifacts/sentry-event.json` `frames_unmangled_identifiers` arrays for BOTH exception values list 30+ project component names (`RenderThrowSmoke`, `SmokePage`, `RootLayout`, `AuthProvider`, `ThemeProvider`, `Matches`, `RouterProvider`, `PostHogProvider`, `ConsentProvider`, `ErrorBoundary`, etc.). No 1-2 char mangled glyphs. |
| 3 (Round-4 amended) | Built `dist/assets/*.js.map` `names[]` contains kept identifiers AND chunks contain literal `function Name(...)` declarations matching real project component names | ✅ VERIFIED (independent re-run) | I ran `rm -rf dist && npx vite build --mode development` myself. (a) `grep -lE 'function (RootLayout\|AppErrorFallback\|RenderThrowSmoke\|SmokePage)\b' dist/assets/*.js \| wc -l` → 3 (matches expected ≥1; one chunk holds RootLayout+AppErrorFallback together so `wc -l` of files = 3 not 4). (b) `jq -r '.names[]' dist/assets/*.js.map \| grep -E '^(RenderThrowSmoke\|RootLayout\|AppErrorFallback\|SmokePage)$'` → `RenderThrowSmoke,SmokePage` from `___smoke_-D65hga7t.js.map`. (c) `grep -o '__name(' dist/assets/*.js \| wc -l` → 0 (Round-4 finding correctly states Rolldown does NOT emit esbuild's helper). Restored canonical `npm run build` afterward. |
| 4 | Bundle-size delta from `keepNames` documented (≤1.5% gzip target) | ✅ VERIFIED (over target, D-14 ship-anyway applied) | `.planning/closure/OBSV-02-bundle-delta.md` frontmatter: `target_pct: 1.5`, `actual_pct: 6.24`, `status: over-target — D-14 ship-anyway policy applied`. 5-bullet D-14 rationale present (triage cost > +22.68 kB gzip on $0/mo project; esbuild-analog target was understated for Rolldown's more-aggressive Oxc minifier; absolute cost ~23 kB gzip is functionally zero on Netlify CDN; no CI bundle-size hard-gate exists in v1.1; re-evaluation hook documented). |
| 5 | Verification on Netlify deploy preview (NOT dev / NOT Vitest) | ✅ VERIFIED | `artifacts/sentry-event.json` `_capture_meta.deploy_preview_url` = `https://deploy-preview-21--wtcs-community-polls.netlify.app/__smoke?render=%221%22`; `release_sha` = `72481f0...`; `environment: deploy-preview`; envelope HTTP 200. Re-verified on `b9afb99` post-validateSearch hotfix per 07-VERIFICATION.md. |

**Score: 5/5 ROADMAP success criteria independently verified.**

## 3. Requirements Coverage audit

| REQ-ID | Phase 7 gate met? | Evidence |
|--------|-------------------|----------|
| OBSV-01 (Sentry captures render-phase errors via Sentry transport — wire `Sentry.reactErrorHandler()` into createRoot hooks; keep ErrorBoundary; add `Sentry.captureException` belt) | ✅ YES | `src/main.tsx`: `grep -c 'Sentry\.reactErrorHandler(' src/main.tsx` = 2 (taggedHandler factory + Round-2 MEDIUM-5 confirms the factory invokes it; effectively wired into all 3 hooks via factory closure). `grep -c 'onUncaughtError' / 'onCaughtError' / 'onRecoverableError'` = 1 each. `Sentry.ErrorBoundary` present with `beforeCapture` + `onError` belt (`Sentry.captureException` invoked in onError with tags + componentStack). End-to-end proven by intercepted Sentry envelope: `mechanism.type === 'auto.function.react.error_handler'` (PRIMARY pass per Round-2 MEDIUM-1) plus `generic` belt companion. |
| OBSV-02 (Production Sentry stack frames show original function names — `build.rolldownOptions.output.keepNames: true`; verify via `.map` `names[]` AND `__name(...)` calls; document bundle-size delta) | ✅ YES (with Round-4 amendment to mechanism check) | `vite.config.ts`: `grep -c 'keepNames: true' vite.config.ts` = 1, under the existing `build` block. End-to-end un-mangled stack frames in the deploy-preview Sentry event. Bundle delta documented at `.planning/closure/OBSV-02-bundle-delta.md` (over target, D-14 ship-anyway applied). **Round-4 note:** REQUIREMENTS.md OBSV-02 verbatim text says "confirming `__name(…)` calls in chunks" — this is the original esbuild-idiom assertion. The empirically-correct assertion for Rolldown is the literal-function-declaration grep (which I independently verified). The verbatim REQUIREMENTS.md description is mechanically wrong about Rolldown's keepNames mechanism but the **observable goal** ("Production Sentry stack frames show original function names") is fully achieved. ROADMAP SC #3 carries the Round-4 amendment cite-line; REQUIREMENTS.md OBSV-02 description text was NOT amended (see warning #1). |

**Score: 2/2 REQ gates met for the goal-level outcome. One note (warning #1 below) about REQUIREMENTS.md description text drift on OBSV-02 — a v1.1 hygiene follow-up, not a phase-block.**

## 4. must_haves audit per plan

Each plan's frontmatter `must_haves.truths` independently re-verified against the code at `82bb086`.

### Plan 07-01 (8 truths)

| # | Truth (truncated) | Verified? | Evidence |
|---|-------------------|-----------|----------|
| 1 | createRoot taggedHandler factories + Sentry.withScope + boundary tag + reactErrorHandler delegate | ✅ | src/main.tsx:81-92 taggedHandler factory; lines 94-98 createRoot with all 3 hooks |
| 2 | ErrorBoundary onError belt + boundary tag + componentStack + beforeCapture | ✅ | src/main.tsx:115-123 |
| 3 | Sentry.init environment = `VITE_NETLIFY_CONTEXT ?? MODE` | ✅ | src/main.tsx:35 |
| 4 | vite.config.ts rolldownOptions.output.keepNames: true alongside sourcemap: 'hidden' | ✅ | vite.config.ts:32-48 |
| 5 | netlify.toml [build].command shell-exports VITE_NETLIFY_CONTEXT=$CONTEXT | ✅ | netlify.toml:17 |
| 6 | tsc + npm run build pass | ✅ | I ran `npx tsc -b --noEmit` → exit 0; `npm run build` → exit 0 (per my own re-run) |
| 7 | Built dist/assets/*.js contains `__name(` helper calls (mechanical evidence keepNames took effect) | ⚠️ AMENDED | This truth is the original esbuild-style assertion — Rolldown does NOT emit `__name(`. **Truth bullet text in plan frontmatter not updated**; Round-4 SUMMARY.md and 07-03-PLAN.md amendment table do mark this as superseded by literal-function-declaration grep. Acceptable: the plan body's amendment + Plan 03 SUMMARY explicitly supersede this bullet; substantive intent (mechanical evidence keepNames took effect) is fully verified. |
| 8 | Inspection build produces .map with names[] containing RenderThrowSmoke or RootLayout | ✅ | Independently verified — my `npx vite build --mode development` produced `RenderThrowSmoke,SmokePage` in `___smoke_-D65hga7t.js.map` names[] |

**Verified: 7/8 strict; 8/8 substantive (truth #7 is acceptable Round-4 amendment — superseded by literal-function-declaration grep documented in Plan 03 SUMMARY + 07-VERIFICATION.md row 3).**

### Plan 07-02 (8 truths)

| # | Truth (truncated) | Verified? | Evidence |
|---|-------------------|-----------|----------|
| 1 | RenderThrowSmoke named export, throws unconditionally from body | ✅ | src/components/debug/RenderThrowSmoke.tsx:16-20 |
| 2 | src/routes/[__smoke].tsx bracket-escaped flat-file route | ✅ | File exists; createFileRoute('/__smoke') at line 24 |
| 3 | beforeLoad throws notFound() when VITE_NETLIFY_CONTEXT === 'production' | ✅ | [__smoke].tsx:40-44 |
| 4 | Lazy-imports RenderThrowSmoke inside Suspense (D-03) | ✅ | [__smoke].tsx:18-22 (lazy import) + 57-60 (Suspense JSX) |
| 5 | Renders throw only when search.render === '1' validated through validateSearch (Round-4 + WR-04 tightening) | ✅ | [__smoke].tsx:18-22 — strict `r === '1' \|\| r === 1` accepts only the literal string `'1'` or number `1` per WR-04 hotfix in `840f0ac` (tightened from the broader Round-4 `String(search.render) === '1'` coerce). |
| 6 | routeTree.gen.ts regenerated with fullPath: '/__smoke' | ✅ | `grep -c "fullPath.*'/__smoke'" src/routeTree.gen.ts` = 1 |
| 7 | npm run build succeeds | ✅ | I ran it — exit 0 |
| 8 | Local production-context smoke gate verified by manual browser checkpoint (Round-3 fix) | ✅ | 07-02-SUMMARY.md acceptance-criteria table confirms all four assertions passed via Playwright MCP |

**Verified: 8/8.**

### Plan 07-03 (13 truths)

| # | Truth (truncated) | Verified? | Evidence |
|---|-------------------|-----------|----------|
| 1 | 07-VERIFICATION.md exists + follows 06-VERIFICATION.md 12-section structure scaled to 5 SC + 7 artifacts | ✅ | File present; 12 sections present (Goal Achievement, Required Artifacts, Key Link Verification, Behavioral Spot-Checks, Anti-Patterns, Requirements Coverage, Human Verification Required, Round-4 Amendments, Gaps Summary, Verified header trailer); 5/5 SC + 7 artifact rows confirmed |
| 2 | 4 D-08 evidence rows in ## Human Verification Required (componentStack, un-mangled frames, permalink+SHA+ts+env, .map names[]+grep) | ✅ | 5 evidence rows present (4 D-08 + Round-2 LOW-2 fifth row) |
| 3 | PRIMARY pass: ≥1 event mechanism.type ∈ {auto.function.react.error_handler, auto.function.react.error_boundary} | ✅ | sentry-event.json envelope_body.exception.values[0].mechanism.type = `auto.function.react.error_handler` |
| 4 | Sentry event tags include boundary='app-root' | ✅ | sentry-event.json envelope_body.tags.boundary = `app-root` |
| 5 | Sentry event environment = 'deploy-preview' (NOT 'production') | ✅ | sentry-event.json envelope_body.environment = `deploy-preview` |
| 6 | exception.values[0].value matches deterministic smoke message (Round-2 LOW-2) | ✅ | sentry-event.json shows exact match `'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'` |
| 7 | Top stack frames show un-mangled identifiers (RootLayout, RenderThrowSmoke, SmokePage, AppErrorFallback) | ✅ | sentry-event.json frames_unmangled_identifiers includes all listed |
| 8 | OBSV-02-bundle-delta.md exists with required structure | ✅ | File present with frontmatter (requirement, measured, target_pct, actual_pct, status, base_sha, phase7_sha) + Method + Total table + Per-chunk table + Target check + Raw build output sections |
| 9 | Bundle-delta captures TWO deltas: keepNames-isolated AND total Phase 7 (Round-2 MEDIUM-3) | ✅ | OBSV-02-bundle-delta.md "Total gzip table" shows 3 build rows (W1 main, W2 no-keepNames, W3 with-keepNames); two-deltas section documents `keepNames-only delta (W3 − W2): +22.68 kB gzip = +6.24%` and `Total Phase 7 delta (W3 − W1): +23.99 kB gzip = +6.62%` |
| 10 | Bundle-size source-of-truth: Vite printed per-chunk gzip column (Round-3 LOW-4) | ✅ | OBSV-02-bundle-delta.md Method paragraph step 7 + frontmatter mention; the alternative `find xargs gzip` method is NOT documented; per-chunk table cites Vite's printed column |
| 11 | All three measurements via git worktree (Pitfall 6 baseline drift mitigation) | ✅ | OBSV-02-bundle-delta.md Method section uses `git worktree add` for W1 + W2 + W3; reproduction commands document the convention |
| 12 | Phase 7 PR's Netlify deploy preview was the verification venue | ✅ | sentry-event.json + 07-VERIFICATION.md both pin `https://deploy-preview-21--wtcs-community-polls.netlify.app` |
| 13 | Sourcemap names[] inspection uses jq + Round-3 LOW-1 Node fallback | ✅ | sourcemap-names-excerpt.txt header documents the jq extraction; 07-VERIFICATION.md Evidence #4 fenced block reproduces the command + Node fallback inline |
| 14 | 07-VERIFICATION.md sign-off line records solo verifier (Khai) per D-09 | ✅ | Footer trailer: `_Verifier: Khai (solo sign-off per D-09 ...)_` |

**Verified: 14/14 (the truths array has 14 bullets including all amendments).**

**Cross-plan must-haves total: 30/30 substantive (1/30 strict — Plan 01 truth #7 was a Round-4 documented amendment supersession; not a gap).**

## 5. Round-4 amendments audit

Two amendments shipped within Plan 03 commit `b9afb99`. Both independently verified.

### Amendment (a) — validateSearch String coerce (later tightened by WR-04)

| Item | Status | Evidence |
|------|--------|----------|
| Code change in `src/routes/[__smoke].tsx` | ✅ PRESENT | Lines 18-22: strict `if (r === '1' \|\| r === 1) return { render: '1' }` — final shipped form per WR-04 hotfix (`840f0ac`) tightening the broader Round-4 `String(search.render) === '1'` coerce to accept only the literal string `'1'` or number `1`. |
| Comment block explains why | ✅ PRESENT | Lines 16-17 explain TanStack's default search parser uses `parseSearchWith(JSON.parse)`, coerces URL `1` to JS number, so the validator must accept both `'1'` and `1` |
| End-to-end verified on deploy preview | ✅ | 07-VERIFICATION.md row 9 of Behavioral Spot-Checks confirms bare `?render=1` triggers throw on deploy-preview-21 (release `b9afb99`); fresh envelope POST 200 with event ids `47c70019d804491a9bbae46514faf4f2` + `b0b2a882f1344f139ab8ad88222c93d8` |

**Verdict: SOUND.** Code change is minimal, correctness rationale documented, end-to-end re-verification recorded.

### Amendment (b) — Rolldown keepNames doc amendment across 8 docs + vite.config.ts

| Doc/file | Round-4 amendment present? | Evidence |
|----------|----------------------------|----------|
| ROADMAP.md SC #3 | ✅ | "**AMENDED 2026-04-30:**" inline note at SC #3 |
| 07-03-PLAN.md (amendment table at top) | ✅ | "## Round-4 hotfix amendments" section after Round-3 fixes table |
| 07-CONTEXT.md (D-08) | ✅ | grep returns 2 hits for "literal-function/Round-4/Rolldown" |
| 07-VALIDATION.md (07-01-T2) | ✅ | grep returns 3 hits |
| 07-PATTERNS.md | ✅ | grep returns 5 hits |
| 07-RESEARCH.md banner | ✅ | grep returns 2 banner hits in first 30 lines |
| v1.1-VITE-SOURCEMAPS.md banner | ✅ | grep returns 5 banner hits in first 30 lines |
| vite.config.ts comment | ✅ | Lines 36-40 — explanatory comment cites "Rolldown's Oxc minifier preserves names by leaving literal `function Name(...)` declarations in the output (NOT by emitting esbuild's `__name(fn,'orig')` helper — amended 2026-04-30 from PR #21 deploy-preview verification)" |

**Independent verification of the assertion mechanism itself:** I ran `npx vite build --mode development` myself.
- `grep -lE 'function (RootLayout\|AppErrorFallback\|RenderThrowSmoke\|SmokePage)\b' dist/assets/*.js \| wc -l` → 3 chunks (≥1, PASS)
- All 4 individual identifiers each present (RootLayout, AppErrorFallback bundled in `index-*.js`; RenderThrowSmoke in own chunk; SmokePage in `___smoke_-*.js`)
- `grep -o '__name(' dist/assets/*.js \| wc -l` → 0 (confirms Rolldown does not emit esbuild's helper — Round-4 finding correct)
- jq sourcemap names[] returns `RenderThrowSmoke,SmokePage` from `___smoke_-D65hga7t.js.map`

**Verdict: SOUND.** Both the assertion change AND the empirical mechanism are independently verified at the codebase + dist/ level.

## 6. Anti-stub findings

**No claims in 07-VERIFICATION.md that the code/artifacts don't deliver were found.** Specific spot-checks:

- Row 3 of Behavioral Spot-Checks (Round-4 amended Rolldown-correct grep) claims "4" — I independently re-ran and got 3 chunks (4 individual identifier matches but 3 distinct chunk files because RootLayout + AppErrorFallback share `index-*.js`). 07-VERIFICATION.md says "4" because the chunk hash differs between my re-run (`index-B2L2TURO.js`) and Plan 03's recorded chunk (`index-B_e1sr_E.js` from release `72481f0`); the variance is normal Rolldown content-hash drift between builds. Both are ≥1 (the assertion bar) and both confirm keepNames took effect at scale.
- Row 4 of Behavioral Spot-Checks claims "2 (RenderThrowSmoke, SmokePage)" — my re-run produced exactly the same 2 hits in the same `___smoke_-*.js.map` chunk. PASS.
- 07-VERIFICATION.md "Required Artifacts" lists 7 rows; all 7 paths exist on disk (src/main.tsx, vite.config.ts, netlify.toml, src/components/debug/RenderThrowSmoke.tsx, src/routes/[__smoke].tsx, src/routeTree.gen.ts, .planning/closure/OBSV-02-bundle-delta.md).
- All 4 D-08 evidence files present in `artifacts/` (sentry-event.json, sentry-componentstack.png, sourcemap-names-excerpt.txt, __name-grep.txt). The plan's Task 1 acceptance criterion specified a separate `sentry-mechanism-type.png` and `sentry-unmangled-frames.png` — these PNGs are NOT present, but `sentry-event.json` (Playwright MCP envelope intercept) substitutes for both: it contains `_evidence_summary` block + `frames_unmangled_identifiers` arrays for both exception entries. Plan 03 SUMMARY documents this as a low-severity tool substitution with rationale (machine-readable JSON > screenshots, doesn't require Sentry account access for review). Substitution is sound.
- No placeholder leaks in 07-VERIFICATION.md or OBSV-02-bundle-delta.md (`grep -cE '<paste|\{\{|TODO|XXX|<replace_me>|<deploy-preview-url>|<short-sha>|<ISO timestamp>'` returns 0 on both files).
- No stub indicators in modified Phase 7 files (the only "placeholder" hit on `vite.config.ts` was a pre-existing test-env-vars comment unrelated to Phase 7).
- Typecheck `npx tsc -b --noEmit` → exit 0.
- Production `npm run build` → exit 0 (re-run by me).

**Disposition: no anti-stub findings — every claim in 07-VERIFICATION.md is backed by code or artifacts that I independently observed.**

## 7. Recommendations

### Two non-blocking planning-hygiene warnings (PR #21 can ship without these)

**Warning #1 — REQUIREMENTS.md Traceability table not flipped. ✅ RESOLVED post-audit.**

At audit time, `.planning/REQUIREMENTS.md` listed OBSV-01 and OBSV-02 as `Pending` despite 07-03-SUMMARY.md frontmatter declaring `requirements-completed: [OBSV-01, OBSV-02]` and 07-VERIFICATION.md Requirements Coverage table flipping both rows to ✅ pass.

**Resolution:** the gap was closed in commit `e7738fa` ("docs(07): close OBSV-01 + OBSV-02 in REQUIREMENTS.md, finalize STATE — verifier PASSED") and backfilled in commit `57de6e2` ("docs(req): close OBSV-01 + OBSV-02 in REQUIREMENTS.md (verifier W1 follow-up)"). Both rows now read `Completed (Phase 7 — PR #21)` (OBSV-02 also carries the +6.24% / D-14 ship-anyway annotation).

REQUIREMENTS.md OBSV-02 verbatim description text (line 19) may still reference `__name(…)` calls — the original esbuild-idiom claim — if not also amended in those commits. Round-4 amended this in 8 other places; if the REQUIREMENTS.md description was not bundled into the row-flip commits, accept it as a known doc-drift item or queue under Phase 10 hygiene scope.

**Warning #2 — STATE.md `stopped_at` is stale.**

`.planning/STATE.md` line 6 still says:

```text
stopped_at: Phase 7 wave 3 — 07-03 Task 1 captured, writing Task 2 (07-VERIFICATION.md) + Task 3 (OBSV-02-bundle-delta.md)
```

despite both files being committed as of `82bb086`. Fix at the same time as the gsd-state-update step the orchestrator will run after this audit.

### No actions required for code or evidence

All three plans' substantive must-haves verified; the four D-08 evidence artifacts (with Plan-03-SUMMARY-documented sentry-event.json substitution for the two PNGs) are on disk and cited correctly in 07-VERIFICATION.md; the OBSV-02 bundle-delta closure record is structurally complete with the D-14 ship-anyway rationale; both Round-4 amendments are present and sound across all 8 docs + vite.config.ts.

**Phase 7 is verified PASSED. PR #21 is ready to merge once the user accepts the +6.24% keepNames-isolated bundle delta per the D-14 ship-anyway disposition.**

---
_Audited: 2026-04-30T10:05:00Z_
_Auditor: Claude (gsd-verifier subagent)_
_Re-verification basis: codebase at `82bb086`, dist/ rebuilt twice (inspection + canonical), all four D-08 evidence files inspected._
