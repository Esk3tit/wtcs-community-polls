---
phase: 07-observability-hardening
verified: 2026-04-30T09:42:27Z
status: passed
score: 5/5 roadmap success criteria verified
overrides_applied: 0
---

# Phase 7: Observability Hardening — Verification Report

Production Sentry receives every render-phase React error with un-mangled, human-readable stack frames so launch-time error triage is reliable. This phase wired `Sentry.reactErrorHandler()` into React 19's `createRoot` error hooks via tagged-handler factories that set `boundary='app-root'` on the active scope before delegating (OBSV-01, with the boundary tag surviving `Sentry.Dedupe` per Round-2 MEDIUM-5), set Rolldown's `keepNames: true` flag to preserve original function/component names through Oxc minify (OBSV-02), coalesced `VITE_NETLIFY_CONTEXT` into `Sentry.init`'s `environment` field so deploy-preview events report the correct environment (Round-2 HIGH-1), and shipped a permanent `/__smoke` render-phase throw canary (`src/routes/[__smoke].tsx` + `src/components/debug/RenderThrowSmoke.tsx`) so future regressions can be re-detected with one deploy-preview click.

**Verified:** 2026-04-30T09:42:27Z on Phase 7 PR #21 Netlify deploy preview at `https://deploy-preview-21--wtcs-community-polls.netlify.app` (release SHA `b9afb999...` after Round-4 hotfix; original D-08 capture at release SHA `72481f065...` is the long-lived event reference). Sentry event timestamp: `2026-04-30T09:20:52.792Z` (canonical capture). Event environment: `deploy-preview` (Round-2 HIGH-1 fix coalesces `VITE_NETLIFY_CONTEXT` into `Sentry.init`).
**Status:** passed
**Re-verification:** `/__smoke?render=1` on any future deploy preview re-exercises the entire chain. The Round-4 hotfix (validateSearch String-coerce in `src/routes/[__smoke].tsx`) means the bare `?render=1` URL the docs cite now triggers the throw — TanStack Router auto-canonicalizes it to `?render=%221%22` after `validateSearch` produces a typed value.

## Goal Achievement — Roadmap Success Criteria

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | Render-phase throw on Netlify deploy preview produces a Sentry event with populated React `componentStack` AND `error.value` present (OBSV-01 capture path) | ✅ pass | Sentry event `5100cc65e9b94bc5b5906ab11ab79d3b` (release `72481f0`) — `componentStack` populated (30+ frames starting `at RenderThrowSmoke ... at ErrorBoundary`); `tags.boundary === 'app-root'`; `exception.values[0].value === 'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'` (Round-2 LOW-2 verified). Re-verified on release `b9afb99` (event ids `47c70019d804491a9bbae46514faf4f2` + `b0b2a882f1344f139ab8ad88222c93d8`) post-validateSearch hotfix. See `## Human Verification Required` rows 1 + 5. |
| 2 | Same event's top stack frames show original function/component names (`RootLayout`, `RenderThrowSmoke`, `SmokePage`, route components) — not `xR`/`$M` (OBSV-02 symbolication) | ✅ pass | First exception (mechanism `auto.function.react.error_handler`) top frames: `ErrorBoundary` → `PostHogProvider` → `ConsentProvider` → `RouterProvider` → ... → `RootLayout` → `AuthProvider` → `ThemeProvider` → ... → `SmokePage` → `RenderThrowSmoke` (all un-mangled). Second exception (belt mechanism `generic`) top frames: `RenderThrowSmoke` → `renderWithHooks` → `beginWork` → `performUnitOfWork` → `workLoopSync` → `renderRootSync` → `performWorkOnRoot` → `performWorkOnRootViaSchedulerTask` → `performWorkUntilDeadline` (all un-mangled). See screenshot at `artifacts/sentry-componentstack.png` and `## Human Verification Required` row 2. |
| 3 | Built `dist/assets/*.js.map` `names[]` contains entries for kept identifiers AND chunks contain literal preserved function declarations (Round-4 amended: Rolldown does NOT use esbuild's `__name(...)` helper, instead preserves names by leaving literal `function Name(...)` in the output) | ✅ pass | At release SHA `72481f0` inspection build (`npx vite build --mode development`): `jq -r '.names[]' dist/assets/*.js.map \| grep -E '^(RenderThrowSmoke\|RootLayout\|AppErrorFallback\|SmokePage)$'` returns `RenderThrowSmoke,SmokePage` from the smoke chunk's `___smoke_-DYnw_MRs.js.map` (Round-2 MEDIUM-4 JSON-aware extraction; Round-3 LOW-2 inspection ran in main worktree because tree was clean at release SHA — temp-worktree pattern from the plan was unnecessary). 59 unique 5+-char PascalCase identifiers across all sourcemap `names[]` arrays. Rolldown-correct mechanical proof: `grep -lE 'function (RootLayout\|AppErrorFallback\|RenderThrowSmoke\|SmokePage)\b' dist/assets/*.js \| wc -l` returns 4 (one chunk per identifier). 48 unique `function PascalCase(...)` declarations in main bundle. **Round-4 Plan Amendment:** the original criterion expected `__name(fn,'orig')` helper calls (esbuild idiom); Rolldown empirically returns `grep -c '__name(' dist/assets/*.js → 0` despite working symbolication. Plan body + ROADMAP SC #3 + 07-CONTEXT D-08 + 07-VALIDATION 07-01-T2 + 07-PATTERNS + 07-RESEARCH + v1.1-VITE-SOURCEMAPS all amended 2026-04-30. See `## Human Verification Required` row 4 + artifacts `__name-grep.txt` and `sourcemap-names-excerpt.txt`. |
| 4 | Bundle-size delta from `keepNames` documented (≤1.5% gzip target) | ✅ pass | Captured at `.planning/closure/OBSV-02-bundle-delta.md`: keepNames-isolated delta + total Phase 7 delta (Round-2 MEDIUM-3 — clean per-flag attribution from 3-way comparison: main / phase-7-without-keepNames / phase-7-with-keepNames). Round-3 LOW-4: gzip values sourced from Vite's printed per-chunk gzip column (single source of truth per D-13). |
| 5 | Verification performed on Netlify deploy preview (NOT dev / NOT Vitest — StrictMode masks render-phase capture) | ✅ pass | Deploy preview URL `https://deploy-preview-21--wtcs-community-polls.netlify.app` pinned. **Round-2 MEDIUM-1 PRIMARY pass:** event mechanism.type `auto.function.react.error_handler` observed (the React 19 `onCaughtError` hook captured the throw via the tagged-handler factory). Additional companion event with `mechanism.type === 'generic'` from the manual `onError` belt is the EXPECTED defense-in-depth fallback, not a standalone pass. Capture method: Playwright MCP intercepted the Sentry envelope POST in flight; envelope HTTP status `200`. |

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main.tsx` | createRoot called with three taggedHandler factories (each calling `Sentry.withScope` + `scope.setTag('boundary','app-root')` + `Sentry.reactErrorHandler` — Round-2 MEDIUM-5; Round-3 confirmed `reactErrorHandler` is ADDITIVE per `node_modules/@sentry/react/build/esm/error.js:90-105`); ErrorBoundary `beforeCapture` (scope.setTag boundary='app-root') + `onError` belt; `Sentry.init` `environment: VITE_NETLIFY_CONTEXT ?? MODE` (Round-2 HIGH-1) | ✅ exists | Plan 01 Task 1 (commit `e4b979f`); verified by grep counts in `07-01-SUMMARY.md` acceptance criteria including `scope.setTag('boundary', 'app-root')` count >= 2. Sentry event `tags.boundary === 'app-root'` proves the chain works end-to-end. |
| `vite.config.ts` | `rolldownOptions.output.keepNames: true` under existing `build` block (`sourcemap: 'hidden'` preserved; `sentryVitePlugin` untouched; `disable: mode !== 'production'` unchanged for Round-2 HIGH-2 inspection build) | ✅ exists | Plan 01 Task 2 (commit `bfbf5a1`); verified `grep -c 'keepNames: true' vite.config.ts` returns 1. Round-4 amended the explanatory comment to clarify Rolldown preserves names via literal `function Name(...)` declarations rather than `__name(...)` helper calls. |
| `netlify.toml` | `[build].command` shell-exports `VITE_NETLIFY_CONTEXT=$CONTEXT` (D-05; also feeds `Sentry.init.environment` per Round-2 HIGH-1) | ✅ exists | Plan 01 Task 2 (commit `bfbf5a1`); verified `grep -c 'VITE_NETLIFY_CONTEXT=\$CONTEXT' netlify.toml` returns 1. Sentry event `environment === 'deploy-preview'` proves the substitution works end-to-end. |
| `src/components/debug/RenderThrowSmoke.tsx` | Named-export render-phase throw with deterministic message (D-01) | ✅ exists | Plan 02 Task 1 (commit `e2f5a74`). Sentry event `exception.values[0].value === 'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'` confirms the deterministic message string is preserved through the build. |
| `src/routes/[__smoke].tsx` | Bracket-escaped TanStack route file with `createFileRoute('/__smoke')`, `validateSearch`, `beforeLoad` env-gate, lazy-loaded throw component (D-02..D-06) | ✅ exists | Plan 02 Task 2 (commit `78e063c`). **Round-4 hotfix:** `validateSearch` now uses `String(search.render) === '1'` instead of strict `=== '1'` — TanStack Router's default search parser uses `parseSearchWith(JSON.parse)` and coerces the URL `1` to a number, so the strict compare was always false and bare `?render=1` silently fell through to the inert hint paragraph. Verified end-to-end on deploy preview `b9afb99`: bare `?render=1` triggers the throw (TanStack auto-canonicalizes the URL to `?render=%221%22` after validateSearch returns a typed value). |
| `src/routeTree.gen.ts` | Auto-regenerated to register the `__smoke` route (`fullPath: '/__smoke'`); committed alongside the route file (Round-2 Gemini suggestion) | ✅ updated | Plan 02 Task 2 ran `npm run build` which re-ran `tsr generate`; verified `grep -c "fullPath.*'/__smoke'" src/routeTree.gen.ts` returns 1. |
| `.planning/closure/OBSV-02-bundle-delta.md` | Total + per-chunk gzip table comparing main vs phase-7-without-keepNames vs phase-7-with-keepNames builds (Round-2 MEDIUM-3 3-way comparison), with target check rationale (D-11..D-14); gzip values sourced from Vite's printed per-chunk column per Round-3 LOW-4 single-source-of-truth | ✅ created | This plan, Task 3. See cross-reference below. |

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/main.tsx` createRoot | `@sentry/react` `reactErrorHandler` | options object: `{ onUncaughtError, onCaughtError, onRecoverableError }` each through `taggedHandler` factory | ✅ wired | All three hooks present, each setting `boundary='app-root'` on the active scope before delegating (Plan 01 Task 1 Round-2 MEDIUM-5 fix). Round-3 confirmed `reactErrorHandler` is ADDITIVE — inner callback runs after default capture (`error.js:90-105` + JSDoc). |
| `src/main.tsx` `Sentry.ErrorBoundary` | `@sentry/react` `beforeCapture` + `captureException` | `beforeCapture={(scope) => scope.setTag('boundary','app-root')}` + `onError` belt | ✅ wired | `tags.boundary === 'app-root'` guaranteed on SDK event via beforeCapture; belt as fallback (Plan 01 Task 1). Live event confirms the tag is present. |
| `src/main.tsx` `Sentry.init` `environment` | Netlify `$CONTEXT` (via `VITE_NETLIFY_CONTEXT`) | `environment: import.meta.env.VITE_NETLIFY_CONTEXT ?? import.meta.env.MODE` | ✅ wired | Sentry event `environment` field reports `'deploy-preview'` per Round-2 HIGH-1. |
| `src/routes/[__smoke].tsx` | `src/components/debug/RenderThrowSmoke` | `lazy(() => import(...).then(m => ({ default: m.RenderThrowSmoke })))` | ✅ wired | `RenderThrowSmoke-*.js` chunk loads on `/__smoke?render=1`; Sentry event stack frames show `at RenderThrowSmoke (...assets/RenderThrowSmoke-mdJn2e0C.js:1:478)` (Plan 02 Task 2). |
| `vite.config.ts` build | Rolldown literal `function Name(...)` preservation (Round-4 amended from `__name(fn,'orig')` helper assumption) | `rolldownOptions.output.keepNames: true` | ✅ wired | `grep -lE 'function (RootLayout\|AppErrorFallback\|RenderThrowSmoke)\b' dist/assets/*.js \| wc -l` >= 1 (release `72481f0` inspection build); Sentry event un-mangled stack frames confirm end-to-end (Plan 01 Task 2). |
| `netlify.toml` `[build].command` | `import.meta.env.VITE_NETLIFY_CONTEXT` in route AND in `Sentry.init` | shell substitution `VITE_NETLIFY_CONTEXT=$CONTEXT` | ✅ wired | Deploy preview behaved correctly (`/__smoke?render=1` reachable; Sentry event `environment === 'deploy-preview'`); live prod behavior to be re-confirmed post-merge by `gh pr checks` once #21 lands on `main`. |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck passes after createRoot rewrite | `npx tsc -b --noEmit` | exit 0 | ✅ pass |
| Production build succeeds | `npm run build` | exit 0 | ✅ pass |
| keepNames helper present in built chunks (Round-4 amended — Rolldown-correct literal-function-declaration check) | `grep -lE 'function (RootLayout\|AppErrorFallback\|RenderThrowSmoke\|SmokePage)\b' dist/assets/*.js \| wc -l` | 4 | ✅ pass |
| Real project identifier in sourcemap names[] (Round-2 MEDIUM-4 — JSON-aware) | `jq -r '.names[]' dist/assets/*.js.map \| grep -cE '^(RenderThrowSmoke\|RootLayout\|AppErrorFallback\|SmokePage)$'` (inspection build via Round-2 HIGH-2: `npx vite build --mode development`; Round-3 LOW-2 ran in main worktree because release SHA == HEAD with clean tree) | 2 (RenderThrowSmoke, SmokePage; RootLayout + AppErrorFallback are preserved literally and don't need a names[] mapping entry — see plan amendment in artifacts/sourcemap-names-excerpt.txt) | ✅ pass |
| RenderThrowSmoke chunk lazy-split | `grep -l 'RenderThrowSmoke' dist/assets/*.js \| wc -l` | 2 (lazy chunk + route chunk) | ✅ pass |
| Smoke route reaches Sentry on deploy preview | manual: open `/__smoke?render=1` (Playwright MCP intercept) | event landed (HTTP 200 envelope POST) | ✅ pass |
| Sentry mechanism.type primary path (Round-2 MEDIUM-1) | manual: event JSON tab — at least one event must have `auto.function.react.*` | `auto.function.react.error_handler` observed on first exception of the captured envelope | ✅ pass |
| Sentry environment tag (Round-2 HIGH-1) | manual: event JSON tab → `environment` field | `deploy-preview` | ✅ pass |
| `exception.values[0].value` matches deterministic smoke message (Round-2 LOW-2) | manual: event JSON tab → `exception.values[0].value` | `'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'` | ✅ pass |
| `/__smoke?render=1` (bare URL) triggers throw on deploy preview (Round-4 hotfix verification) | Playwright MCP nav to bare `?render=1` URL on deploy-preview-21 | TanStack canonicalized to `?render=%221%22`; AppErrorFallback rendered; fresh Sentry envelope POST 200 with release `b9afb99` | ✅ pass |

## Anti-Patterns Found

None. Phase 7 is config + wiring + permanent debug-route work — no business-logic surface to over-engineer. Two findings emerged from Plan 03 Task 1 verification — both treated as Round-4 amendments (validateSearch hotfix + Rolldown keepNames doc correction) rather than anti-patterns; neither indicated implementation gaps in the substantive Phase 7 goals.

## Requirements Coverage

| REQ-ID | Pre-Phase-7 | Post-Phase-7 | Gate | Status |
|--------|-------------|--------------|------|--------|
| OBSV-01 | Render-phase errors swallowed by React (only `setTimeout`/`onerror` events landed at Sentry per Phase 6 baseline) | createRoot taggedHandler factories + ErrorBoundary `beforeCapture` + `onError` belt route every render-phase error to Sentry; PRIMARY mechanism.type ∈ {`auto.function.react.error_handler`, `auto.function.react.error_boundary`} (Round-2 MEDIUM-1; Round-3 LOW-5 rename escalation available); generic belt events expected; `componentStack` populated; `tags.boundary === 'app-root'` set on whichever event survives dedupe (Round-2 MEDIUM-5); `exception.values[0].value` matches smoke message (Round-2 LOW-2); environment tag is `deploy-preview` not `production` (Round-2 HIGH-1) | Sentry event from `/__smoke?render=1` on deploy preview shows correct mechanism + tags + stack + environment + value | ✅ pass |
| OBSV-02 | Top stack frames mangled as `xR`/`$M`-style identifiers; symbolication useless for triage | Rolldown `keepNames: true` preserves literal `function Name(...)` declarations through Oxc minify (Round-4 amended from the original `__name(fn,'orig')` helper-injection assumption — Rolldown does not emit that helper, see plan amendment); `Function.prototype.name` preserved; Sentry surfaces original `RootLayout`/`RenderThrowSmoke`/`SmokePage`/route names | Same Sentry event's top frames show un-mangled names AND `dist/assets/*.js.map` `names[]` (via jq, Round-2 MEDIUM-4; Round-3 LOW-1 corrected Node fallback) contains kept identifiers AND chunks contain literal `function Name(...)` declarations matching real project component names. Round-2 MEDIUM-3: keepNames-isolated bundle delta documented in `.planning/closure/OBSV-02-bundle-delta.md` (Round-3 LOW-4: gzip values from Vite's printed column only). | ✅ pass |

## Human Verification Required

The four D-08 evidence items (CONTEXT.md), with Round-2 review fixes for two-tier mechanism criteria + error.value verification + environment tag verification, plus Round-3 LOW-5 escalation rule for Sentry-string-rename ambiguity, plus Round-4 amendments for the validateSearch hotfix and Rolldown keepNames mechanism correction:

| # | Evidence | Method | Location | Status |
|---|----------|--------|----------|--------|
| 1 | Sentry event screenshot showing populated `componentStack` + `tags.boundary === 'app-root'` (proves OBSV-01 capture path) | Open Sentry event → Tags panel + React Component Stack panel → screenshot. Capture method this run: Playwright MCP intercepted the Sentry envelope POST in flight on the deploy preview, then took a full-page screenshot of the rendered AppErrorFallback. The full envelope JSON (with the React component stack at `contexts.react.componentStack` and `tags.boundary === 'app-root'`) is committed alongside as `artifacts/sentry-event.json` for the same long-lived value. | `.planning/phases/07-observability-hardening/artifacts/sentry-componentstack.png` (live AppErrorFallback render) + `artifacts/sentry-event.json` (full envelope with componentStack field) | ✅ captured |
| 2 | Sentry event screenshot showing top stack frames with un-mangled names (`RootLayout`, `RenderThrowSmoke`, `SmokePage` — NOT `xR`/`$M`) (proves OBSV-02 symbolication) | Same envelope intercept — both `exception.values[0].stacktrace.frames` (boundary path: ErrorBoundary → PostHogProvider → ConsentProvider → RouterProvider → ... → RootLayout → AuthProvider → ThemeProvider → ... → SmokePage → RenderThrowSmoke) and `exception.values[1].stacktrace.frames` (belt path: RenderThrowSmoke → renderWithHooks → beginWork → performUnitOfWork → workLoopSync → renderRootSync → performWorkOnRoot → performWorkOnRootViaSchedulerTask → performWorkUntilDeadline) are stored in `artifacts/sentry-event.json` under the `frames_unmangled_identifiers` index annotations. | `artifacts/sentry-event.json` (full stack frames with un-mangled identifiers indexed) + `artifacts/sentry-componentstack.png` | ✅ captured |
| 3 | Sentry event permalink + release SHA + event timestamp + environment tag pinned in this doc | Copy URL from Sentry event view; copy release SHA from event tags; record event ISO timestamp and environment | Permalink: `https://khai-phan.sentry.io/issues/7451487881/events/5100cc65e9b94bc5b5906ab11ab79d3b/` · Release SHA: `72481f065dbaa08edd4c74a51953765923b31262` (canonical D-08 evidence — also re-verified at `b9afb9991efbaaae91050c8d25b3d34ac7575b4a` post-validateSearch hotfix with event ids `47c70019d804491a9bbae46514faf4f2` + `b0b2a882f1344f139ab8ad88222c93d8`) · Event timestamp: `2026-04-30T09:20:52.792Z` · Environment: `deploy-preview` (NOT `production` per Round-2 HIGH-1) · Org slug: `khai-phan` · Sentry issue id: `7451487881` · Sentry org id: `4510971582349312` · Sentry project id: `4511250886164480` | ✅ pinned |
| 4 | Built `dist/assets/*.js.map` `names[]` excerpt (Round-2 MEDIUM-4: via jq, NOT raw grep; Round-3 LOW-1: Node fallback uses `JSON.parse(fs.readFileSync)` not `require()`) + Rolldown-correct literal-function-declaration grep (Round-4 amended from the original `grep '__name('` esbuild-idiom check; Rolldown's Oxc minifier preserves names by leaving `function Name(...)` literally instead of emitting helper calls) | At release SHA `72481f0` → main worktree was already at this SHA with a clean tree (Round-3 LOW-2 temp-worktree pattern was unnecessary — recorded as in-tolerance deviation) → `npm run generate && npx tsc -b --noEmit && npx vite build --mode development` (Round-2 HIGH-2 plugin-disabled inspection build) → `jq -r '.names[]' dist/assets/*.js.map \| grep -E '^(RenderThrowSmoke\|RootLayout\|AppErrorFallback\|SmokePage)$'` → `grep -lE 'function (RootLayout\|AppErrorFallback\|RenderThrowSmoke\|SmokePage)\b' dist/assets/*.js` → copy outputs back to main worktree's artifacts directory → `rm -rf dist && npm run build` to restore canonical dist/ | See `artifacts/sourcemap-names-excerpt.txt` + `artifacts/__name-grep.txt` (with full Round-4 plan-amendment context inline). Fenced blocks reproduced below. | ✅ captured |
| 5 | `exception.values[0].value` matches deterministic smoke message (Round-2 LOW-2 explicit verification — ROADMAP SC #1 "error.value present") | Event JSON tab → `exception.values[0].value` (extracted from intercepted Sentry envelope) | Observed value: `RenderThrowSmoke: deliberate render-phase throw for Sentry verification` (exact match with the message string from `src/components/debug/RenderThrowSmoke.tsx`) | ✅ verified |

**Round-2 MEDIUM-1 + Round-3 LOW-5 — Mechanism type two-tier sanity check + rename-escalation (CONTEXT `<specifics>`):**

PRIMARY pass — observed value(s) on at least one event: `auto.function.react.error_handler` (on the first exception of the captured envelope, with `mechanism.handled === true` and `mechanism.source === 'cause'`). This proves the React 19 root hooks (taggedHandler factory in Plan 01 Task 1) caught the render-phase throw via `Sentry.reactErrorHandler()`.

SECONDARY observation — the second exception in the same envelope has `mechanism.type === 'generic'` with `mechanism.handled === true`. This is the EXPECTED companion from the manual `onError` belt in `src/main.tsx` which fires `Sentry.captureException` directly. Both exception entries share the same `event_id` (Sentry's `LinkedErrors` integration grouped them into one event), so this is one Sentry event with two cause-linked exception entries — exactly the defense-in-depth design Plan 01 Task 1 documented.

Solo `'generic'` (no `auto.function.react.*` companion) would have been a PARTIAL pass — sign-off would have been blocked pending investigation of Plan 01 Task 1 hook wiring. Confirmed: this scenario was NOT observed.

Any browser-global handler mechanism (`auto.browser.global_handlers.onerror`, etc.) would have been a Phase 7 failure (RESEARCH Pitfall 1). Confirmed: this scenario was NOT observed.

**Round-3 LOW-5 — Sentry-string-rename escalation:** if observed mechanism strings differed from the literal allowlist due to a Sentry patch-release rename but clearly mapped to a PRIMARY path, the override decision would be recorded HERE in the form: "Override granted: observed `<actual>`, semantically maps to PRIMARY path because `<reason>`. Khai, `<date>`." Confirmed: no override applied (observed mechanism matched the literal allowlist exactly).

### Evidence #4 — sourcemap names[] excerpt (Round-2 MEDIUM-4 jq extraction; Round-3 LOW-1 Node fallback corrected; Round-3 LOW-2 worktree pattern context)

```text
# From dist/assets/*.js.map (post-inspection-build `npx vite build --mode development` at release SHA 72481f065dbaa08edd4c74a51953765923b31262):
# Generated via: jq -r '.names[]' dist/assets/*.js.map | grep -E '^(RenderThrowSmoke|RootLayout|AppErrorFallback|SmokePage)$'
# (Round-3 LOW-1 Node fallback if jq unavailable: `node -e "const fs=require('fs'); for (const f of process.argv.slice(1)) { const m=JSON.parse(fs.readFileSync(f,'utf8')); for (const n of m.names || []) if (/^(RenderThrowSmoke|RootLayout|AppErrorFallback|SmokePage)$/.test(n)) console.log(n + '  ↳ in ' + f) }" dist/assets/*.js.map`)
# (Round-3 LOW-2 main-worktree path used because release SHA == HEAD with clean tree — temp-worktree was unnecessary)

# Strict allowlist hits:
  ___smoke_-DYnw_MRs.js.map                           → RenderThrowSmoke,SmokePage

# Note on missing RootLayout/AppErrorFallback in names[]:
# Sourcemap names[] is the list of original identifiers that needed a mapping back from
# a different minified token. When keepNames preserves the literal name (no rename), the
# identifier may not be added to names[] — there's nothing to map from a different shape.
# The ground truth for Rolldown is the literal function declarations in the JS chunks.

# Wider sample of un-mangled identifiers across all sourcemap names[] arrays (top 50, sorted):
# total unique 5+-char PascalCase identifiers in names[]: 59
  AdminFilter, AdminGuard, AdminPage, AdminSearch, AdminTab, AdminTabs, ArchivePage,
  ArchiveSearch, Arrow, AuthCallbackPage, AuthErrorPage, AuthErrorRoute, AuthGuard,
  Collapsible, CollapsibleContent, Collection, Content, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, EditSuggestionPage,
  ErrorReason, Fragment, IndexPage, Label, LandingPage, LoaderCircle, Navigate,
  NewSuggestionPage, Portal, PortalPrimitive, PortalProvider, React, RemoveScroll,
  RenderThrowSmoke, Route, Select, SelectContent, SelectItem, SelectScrollDownButton,
  SelectScrollUpButton, SelectTrigger, SelectValue, Sentry, SideCar, SmokePage, String,
  SuggestionForm
```

### Evidence #4 — Rolldown literal-function-declaration presence (Round-4 amended from `__name(` helper grep)

```text
# Original (esbuild-style) check — kept for plan-traceability:
$ grep -o '__name(' dist/assets/*.js | wc -l
0   # Rolldown does NOT emit this helper

# Rolldown-correct mechanical evidence — literal function declarations preserved:
$ grep -lE 'function (RootLayout|AppErrorFallback|RenderThrowSmoke|SmokePage)\b' dist/assets/*.js | wc -l
4

  function RenderThrowSmoke           → present in 1 chunk(s)  (e.g., RenderThrowSmoke-XCbSANRV.js)
  function SmokePage                  → present in 1 chunk(s)  (e.g., ___smoke_-DYnw_MRs.js)
  function RootLayout                 → present in 1 chunk(s)  (e.g., index-B_e1sr_E.js)
  function AppErrorFallback           → present in 1 chunk(s)  (e.g., index-B_e1sr_E.js)
  function ConsentChip                → present in 1 chunk(s)  (e.g., index-B_e1sr_E.js)
  function ConsentBanner              → present in 1 chunk(s)  (e.g., index-B_e1sr_E.js)
  function LandingPage                → present in 1 chunk(s)  (e.g., LandingPage-Bym6UGzO.js)
  function AdminPage                  → present in 1 chunk(s)  (e.g., admin-BUzFcT9l.js)
  function AuthProvider               → present in 1 chunk(s)  (e.g., index-B_e1sr_E.js)
  function ThemeProvider              → present in 1 chunk(s)  (e.g., index-B_e1sr_E.js)

# Sample of all top-level un-mangled function declarations in main bundle (proves at-scale preservation):
# total unique 'function PascalCase(' declarations in main bundle: 48
# first 30 alphabetically:
    function AppErrorFallback, function AuthProvider, function CatchBoundary,
    function CatchNotFound, function ConsentBanner, function ConsentChip,
    function ConsentProvider, function DefaultGlobalNotFound, function DropdownMenu,
    function DropdownMenuContent, function DropdownMenuItem, function DropdownMenuSeparator,
    function DropdownMenuTrigger, function ErrorComponent, function FiberNode,
    function FiberRootNode, function ItoI, function Matches, function MatchesInner,
    function MatchImpl, function MatchInnerImpl, function MatchView, function MobileNav,
    function Navbar, function OnRendered, function OutletImpl, function PostHogErrorBoundary,
    function PostHogProvider, function ReactDOMHydrationRoot, function ReactDOMRoot
```

Empty output here would be a Phase 7 failure mode — keepNames did not take effect. If observed in conjunction with mangled stack frames in the Sentry event, run the Round-2 Cursor rollback path (Task 1 step E in 07-03-PLAN.md) to disambiguate keepNames-broken vs upload-pipeline-broken before filing.

## Round-4 Amendments — empirical findings from PR #21 deploy-preview verification

Two findings emerged during Plan 03 Task 1 evidence capture; both resolved within this PR:

| Finding | Severity | Resolution | Where |
|---------|----------|------------|-------|
| `/__smoke?render=1` (bare URL) hit the inert hint instead of triggering the throw | HIGH (route bug) | TanStack Router's default search parser uses `parseSearchWith(JSON.parse)`, coercing URL `1` to JS number `1`. The route's `validateSearch` strict `=== '1'` (string) compare was always false. **Fixed:** changed to `String(search.render) === '1'`. End-to-end re-verified on deploy preview `b9afb99` — bare `?render=1` now triggers the throw (TanStack auto-canonicalizes URL to `?render=%221%22` post-validate). | `src/routes/[__smoke].tsx`, commit `b9afb99` |
| Plan's `grep '__name(' >= 1` keepNames assertion was based on esbuild's helper idiom | HIGH (assertion semantics) | Rolldown's Oxc minifier preserves names by leaving literal `function Name(...)` declarations (NOT by emitting `__name(fn,'orig')` helper calls). Empirically `grep -c '__name('` returned `0` despite working symbolication. **Fixed:** replaced assertion across 8 docs with `grep -lE 'function (RootLayout\|AppErrorFallback\|RenderThrowSmoke)\b' dist/assets/*.js \| wc -l >= 1`. Sourcemap `names[]` jq check retained (still works for Rolldown — confirms names not mangled away). | ROADMAP.md SC #3 + 07-03-PLAN.md (Round-4 amendments table at top + inline updates) + 07-CONTEXT.md D-08 + 07-VALIDATION.md 07-01-T2 + 07-PATTERNS.md (2 spots) + 07-RESEARCH.md banner + v1.1-VITE-SOURCEMAPS.md banner + vite.config.ts comment, commit `b9afb99` |

Both findings are documentation/route-code corrections, not implementation gaps. The Sentry capture path (OBSV-01) and symbolication mechanism (OBSV-02) both work correctly on the deploy preview — the live event captured at 2026-04-30T09:20:52Z is the canonical end-to-end proof.

## Gaps Summary

None. All five ROADMAP success criteria pass; both REQ rows flip from Pending → ✅ pass; no anti-patterns introduced. The `.planning/closure/OBSV-02-bundle-delta.md` doc carries the full bundle-size delta with Round-2 MEDIUM-3 3-way comparison (main / phase-7-without-keepNames / phase-7-with-keepNames) and target check rationale; if the keepNames-only delta exceeded 1.5% gzip, the doc applies the D-14 overage policy (document + ship). Round-3 LOW-4: gzip values are sourced from Vite's printed per-chunk column only (single source of truth per D-13). Round-4 amendments cover the two empirical findings (validateSearch hotfix + Rolldown keepNames doc correction) — both resolved within PR #21 commits `b9afb99`+.

Disposition: PASSED.

---
_Verified: 2026-04-30T09:42:27Z_
_Verifier: Khai (solo sign-off per D-09 — OBSV-01/02 are config + wiring, not security/auth gates; the Sentry event is independently re-openable via the permalink at `https://khai-phan.sentry.io/issues/7451487881/events/5100cc65e9b94bc5b5906ab11ab79d3b/`)_
_Round-2 review concerns addressed: HIGH-1 (Sentry environment tag), HIGH-2 (plugin-disabled inspection build), MEDIUM-1 (two-tier mechanism criteria), MEDIUM-2 (dropped contradictory grep), MEDIUM-3 (3-way bundle comparison), MEDIUM-4 (jq-based names[] extraction), MEDIUM-5 (dedupe-resilient boundary tagging), LOW-1 (informational), LOW-2 (error.value verified)_
_Round-3 review concerns addressed: consensus HIGH (Plan 02 Task 3 curl→manual / further Playwright MCP), consensus MEDIUM (07-VALIDATION.md drift refreshed), single-reviewer MEDIUM (`reactErrorHandler` ADDITIVE confirmed by source), LOW-1 (Node fallback `JSON.parse` fix), LOW-2 (`git worktree` not `git checkout` — main worktree path used because release SHA == HEAD with clean tree, recorded in Evidence #4 row), LOW-3 (ErrorInfo prose corrected), LOW-4 (Vite gzip column single-source-of-truth), LOW-5 (Sentry-rename escalation rule available, not invoked)_
_Round-4 amendments: validateSearch String-coerce hotfix (`src/routes/[__smoke].tsx`); Rolldown keepNames doc amendment across 8 files (`__name(` esbuild-idiom assertion replaced with literal-function-declaration grep)_
