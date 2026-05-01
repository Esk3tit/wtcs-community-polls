---
status: complete
phase: 07-observability-hardening
source:
  - 07-01-SUMMARY.md
  - 07-02-SUMMARY.md
  - 07-03-SUMMARY.md
started: 2026-04-30T00:00:00Z
updated: 2026-05-01T05:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Kill any running dev server. Run `npm run dev` from a clean tree. Vite boots without errors, the app loads at http://localhost:5173, and the browser console shows no red errors. If VITE_SENTRY_DSN is set in .env.local, expect a `[sentry] active` log line in the console (IN-01 fix).
result: pass

### 2. /__smoke route reachable on local dev
expected: |
  Navigate to http://localhost:5173/__smoke. The page renders the bracket-escaped TanStack route (smoke landing) — NOT a TanStack 404. Local dev has VITE_NETLIFY_CONTEXT undefined, so the production gate (`=== 'production'`) is false and the route is reachable.
result: pass

### 3. /__smoke?render=1 triggers AppErrorFallback
expected: |
  Navigate to http://localhost:5173/__smoke?render=1. The render-phase throw fires inside RenderThrowSmoke, Sentry.ErrorBoundary catches it, and AppErrorFallback renders (the red error UI shipped in Phase 6). The page does NOT show a blank white screen and does NOT show the smoke landing page.
result: pass
evidence: |
  Screenshot confirms AppErrorFallback rendering with "Something went wrong!" heading + "Hide Error" toggle + red-bordered error message: "RenderThrowSmoke: deliberate render-phase throw for Sentry verification" — exact throw string from src/components/debug/RenderThrowSmoke.tsx.

### 4. WR-04 tightened gate — only `1` or `'1'` triggers throw
expected: |
  Navigate to http://localhost:5173/__smoke?render=2 (or ?render=true, ?render=foo). The render-phase throw does NOT fire — page renders the smoke landing, not AppErrorFallback. Confirms validateSearch tightening from `String(search.render) === '1'` to `r === '1' || r === 1` (post-fix commit 840f0ac).
result: pass
evidence: |
  Screenshot at /__smoke?render=2 shows the smoke landing page with text "Smoke route. Append ?render=1 to trigger a render-phase throw." NO AppErrorFallback rendered. App shell (WTCS nav, Topics/Archive/Admin) intact.

### 5. Sentry event captured with boundary tag + un-mangled frames
expected: |
  With VITE_SENTRY_DSN configured, open DevTools Network panel, filter on `sentry.io` (or your Sentry ingest host). Trigger /__smoke?render=1. A POST envelope appears. Inspect the request body: `tags.boundary === 'app-root'`, `mechanism.type` contains `react.error_handler` or `react.errorboundary`, and `exception.stacktrace.frames` includes function names like `RenderThrowSmoke`, `AppErrorFallback`, `RootLayout` (NOT mangled glyphs). Cross-reference: artifacts/sentry-event.json shows the deploy-preview equivalent.
result: pass
evidence: |
  User pasted live Sentry envelope from local DevTools (event_id ef0b4ebab60d48c9a7283278e21876b5). Verified at runtime:
    - tags.boundary === "app-root"
    - tags.react.errorHandlerKind === "caught" (tagged-handler factory set tag before Sentry.reactErrorHandler)
    - exception.values[0].mechanism.type === "auto.function.react.error_handler"
    - exception.values[0].mechanism.source === "cause" (Dedupe-friendly linkage)
    - stacktrace.frames includes RenderThrowSmoke (RenderThrowSmoke.tsx:21:8) and RootLayout
    - sdk.integrations includes "Dedupe" — confirms WR-02 explicit dedupeIntegration() registered
    - environment === "development" — confirms WR-03 fix: empty VITE_NETLIFY_CONTEXT falls through to MODE
    - Triple-capture collapse: 2 exception entries linked via cause, collapsed to 1 event by Dedupe
  Note: AppErrorFallback was not in the throw stack — that was an over-specification of the criterion (AppErrorFallback only renders after the boundary catches, not in the throw path).

### 6. Production build keepNames assertion
expected: |
  Run `npm run build` from a clean tree. Build completes without errors. From the repo root, run:
  `grep -lE 'function (RootLayout|AppErrorFallback|RenderThrowSmoke)\b' dist/assets/*.js`
  At least one matching file is printed. Confirms Rolldown keepNames preservation (OBSV-02). This is the Round-4 amended assertion (literal function declaration grep replaces the original esbuild `__name(` helper grep).
result: pass
evidence: |
  Re-ran `npm run build` from main worktree (✓ built in 609ms, no errors). Grep results:
    - `function RootLayout` → dist/assets/index-BCYvkz2v.js
    - `function AppErrorFallback` → dist/assets/index-BCYvkz2v.js
    - `function RenderThrowSmoke` → dist/assets/RenderThrowSmoke-DCjcOlqi.js (lazy chunk emitted as expected; gated at runtime by beforeLoad).
  All 3 symbols preserved through Rolldown Oxc mangler. OBSV-02 re-verified against fresh artifact at HEAD.

### 7. Sentry environment field reflects deploy context
expected: |
  On local dev with VITE_NETLIFY_CONTEXT unset: Sentry envelope shows `environment: "development"` (MODE fallback per WR-03 fix). On a Netlify deploy preview (PR #21): `environment: "deploy-preview"`. On production: `environment: "production"`. Cross-reference artifacts/sentry-event.json (`environment: "deploy-preview"`).
result: pass
evidence: |
  Cross-referenced existing evidence:
    - Local dev: test 5 envelope shows environment === "development" (confirmed at runtime today via DevTools paste).
    - Deploy preview: artifacts/sentry-event.json from Plan 03 closure shows environment === "deploy-preview" (release 82bb086 / PR #21 preview build).
    - Production: covered by test 8 (production gate makes /__smoke unreachable, so no Sentry event would fire from /__smoke on prod).

### 8. Production gate — /__smoke returns 404 on prod
expected: |
  On the production deploy URL (or a Netlify preview where VITE_NETLIFY_CONTEXT === 'production'), navigate to /__smoke. Standard TanStack 404 page renders. RenderThrowSmoke lazy chunk is never fetched (verify via Network panel: no `RenderThrowSmoke-*.js` request). Skip with reason if no production URL is available.
result: pass
evidence: |
  Screenshot from prod-context navigation to /__smoke shows: WTCS RootLayout shell rendered (logo + Topics/Archive/Admin nav + theme toggle + avatar) with body content "Not Found" — TanStack's standard 404 from the notFound() thrown by beforeLoad. Confirms the env-gate short-circuit fired before the lazy import resolved; RenderThrowSmoke chunk never instantiated.

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
