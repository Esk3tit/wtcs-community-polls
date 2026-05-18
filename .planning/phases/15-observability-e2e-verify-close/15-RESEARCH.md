# Phase 15: Observability + E2E Verify & Close - Research

**Researched:** 2026-05-17
**Domain:** Verification & evidence capture (Sentry React 19 capture path + Vite/Rolldown sourcemap names + Playwright E2E pass-on-main)
**Confidence:** HIGH

## Summary

Phase 15 is a verify-and-close phase. Every underlying behavioral fix already lives on `main`:

- `Sentry.reactErrorHandler` + `onCaughtError`/`onUncaughtError`/`onRecoverableError` factories + `Sentry.dedupeIntegration()` pinning — wired in `src/main.tsx` lines 22-102 (commits `e4b979f` … `c2e5277`).
- `keepNames: true` in `vite.config.ts` line 34, plus the Sentry Vite plugin in last position (commit `bfbf5a1`).
- Render-throw canary `src/components/debug/RenderThrowSmoke.tsx` and prod-gated `/__smoke?render=1` route in `src/routes/[__smoke].tsx` (commits `e2f5a74`, `b9afb99`).
- Yes/No-preset click fix in `e2e/tests/admin-create.spec.ts` line 53 (commit `7ef6c82`).
- `freshPoll` fixture + `[1-9]\d*` non-zero regex in `e2e/tests/browse-respond.spec.ts` line 56 (commit `184b8f5`).
- `E2E_TITLE = /\[E2E[\] ]/` prefix filter on `toHaveCount(1)` in `e2e/tests/filter-search.spec.ts` lines 9-10, 78-80 (commits `308c578`, `a6d2f8e`, `5d63a06`).

What Phase 15 must add is the *evidence layer*: a two-button smoke harness (render-throw + dedupe-check) under the existing `/__smoke` route, a `scripts/verify-sourcemap-names.mjs` allowlist check wired into CI's `lint-and-unit` job, a single `15-EVIDENCE.md` correlating Sentry event IDs / CI run URLs / sentry-cli output to each requirement, committed PNG screenshots under `artifacts/`, and a PR that auto-closes #11/#12/#13/#17/#19 via GitHub keywords with per-issue follow-up comments.

**Primary recommendation:** Mount two distinct error triggers under `/__smoke` (D-02), wire `verify-sourcemap-names.mjs` after the existing build step in CI (D-08), fire smokes on the Phase-15-PR Netlify preview (D-13), capture evidence in `15-EVIDENCE.md` with permanent `artifacts/*.png` screenshots, and use `Closes #11, #12, #13, #17, #19` keywords in the PR body (D-16).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Smoke harness wiring**

- **D-01:** Mount `RenderThrowSmoke.tsx` on the existing `/[__smoke]` route. The route is already prod-gated via `VITE_NETLIFY_CONTEXT` — reuse that gate instead of introducing a new `?debug=sentry-test` query-param gate or admin-scoped panel.
- **D-02:** Provide two distinct triggers on `/[__smoke]` so OBSV-05's Dedupe smoke can use DISTINCT error messages per scenario:
  - `/__smoke/render-throw` (or equivalent sub-button) fires `new Error('OBSV-03 render')`.
  - `/__smoke/dedupe-check` (or equivalent sub-button) fires `new Error('OBSV-05 dedupe')` and asserts `Sentry.lastEventId()` advanced relative to the previous call.
- **D-03:** Surface `Sentry.lastEventId()` two ways: `console.log` AND `document.body.dataset.sentryEventId = <id>`. Lets a human verifier read the DevTools console and lets a future Playwright check (if ever wired) read the DOM attribute without UI changes.
- **D-04:** Reframe accepted: the smoke harness is *new code* in this phase. It's verification scaffolding, not a behavioral fix to OBSV-03/04/05 themselves. The "all code fixes already on `main`" framing from REQUIREMENTS.md remains accurate for the *fixes*; the *verifiers* land here.

**verify-sourcemap-names script**

- **D-05:** Create `scripts/verify-sourcemap-names.mjs`. The script assumes a prior `npm run build`, then greps `dist/assets/*.js` for literal `function X(` declarations and exits non-zero if absent.
- **D-06:** Pass criteria = allowlist of known component names. The allowlist must include at least: `ConsentProvider`, `AuthGate`, `AdminGuard`, `RenderThrowSmoke`, `App` (and any other top-level shell components the planner identifies). Every entry must appear as a literal `function X(` in `dist/assets/*.js`. Threshold counts and `$M`-absence checks are weaker and were rejected.
- **D-07:** OBSV-04(b) Sentry Artifacts evidence form = `sentry-cli releases files <release> list` output, where `<release>` is the current `VITE_COMMIT_SHA` (the same value Netlify exports during build). Requires `SENTRY_AUTH_TOKEN` available locally for the verifier. The raw CLI output gets pasted verbatim into `15-EVIDENCE.md`.
- **D-08:** Wire `verify-sourcemap-names.mjs` into `ci.yml`'s `lint-and-unit` job, running after a build step (or adding one if not present in that job — the planner will confirm). Becomes a permanent regression guard for the `keepNames: true` contract.

**E2E CI verification surface**

- **D-09:** TEST-14/15/16 evidence source = latest green CI run on `main`. `ci.yml` already runs the `e2e` job on every `push` to `main` (lines 11–14), so no new CI mechanism is needed.
- **D-10:** Per-spec evidence is mandatory — capture explicit PASS lines for `admin-create.spec.ts`, `browse-respond.spec.ts`, and `filter-search.spec.ts` from the Playwright report (HTML reporter artifact or `--reporter list` output). Maps 1:1 to TEST-14, TEST-15, TEST-16 and survives future skip/`.only`/fixture-only regressions.
- **D-11:** No changes to `e2e/tests/*` or `playwright.config.*` in this phase. Verify-and-cite only. Tagging the three specs `@verify` was rejected to keep scope tight; a CI summary step was rejected as cosmetic overhead.
- **D-12:** Freshness = re-run after Phase 15 PR merges to `main`. The post-merge CI run URL is the single source of truth for TEST-14/15/16 evidence; it implicitly proves the smoke harness commit did not destabilize the specs. Pre-merge run URL is not cited.

**Evidence + issue closure + preview source**

- **D-13:** Deploy-preview source = the Phase 15 PR itself. The PR contains the smoke harness + verify-sourcemap script + draft evidence; Netlify auto-builds a preview from the PR branch. Verifier fires the smokes on THAT preview, finalizes evidence, then merges. Single PR, single preview, single evidence trail.
- **D-14:** Evidence artifact = single `15-EVIDENCE.md` file in the phase directory. Lists each requirement (OBSV-03..05, TEST-14..16) with: trigger steps, Sentry event ID / CI run URL / sentry-cli output, and links to screenshot artifacts.
- **D-15:** Screenshots get committed to `.planning/phases/15-observability-e2e-verify-close/artifacts/`. Suggested names: `sentry-obsv-03-event.png`, `sentry-obsv-04-stack.png`, `sentry-obsv-05-dedupe.png`, `ci-test-14-pass.png`, etc. Small (<200KB) PNGs preferred. External hosting + text-only evidence were both rejected to avoid link-rot.
- **D-16:** Issue closure mechanism = PR body uses GitHub auto-close keywords (`Closes #11, Closes #12, Closes #13, Closes #17, Closes #19`). After merge, post a closure comment on each issue linking to `15-EVIDENCE.md` and the specific evidence anchor (Sentry event ID or CI run URL). Auto-close on merge gives a clean trail; per-issue comment gives a permanent evidence pointer.

### Claude's Discretion

- Naming of the two `/[__smoke]` sub-triggers (sub-routes vs query-params vs in-page buttons) — D-02 picks the shape but leaves the exact mechanism to the planner; whatever is shortest under TanStack Router file-based routing.
- Exact allowlist contents in D-06 — user picked the *form* (allowlist), planner picks the *contents*. Suggested seed: `ConsentProvider`, `AuthGate`, `AdminGuard`, `RenderThrowSmoke`, `App` — planner is free to add/trim based on what's actually emitted today.
- Whether `scripts/verify-sourcemap-names.mjs` runs `npm run build` itself or assumes the caller has built — planner decides; CI already builds, so the script can probably be build-agnostic.
- Whether `sentry-cli` is added as a devDependency or invoked via `npx`.

### Deferred Ideas (OUT OF SCOPE)

- Playwright spec that fires `/[__smoke]/render-throw` and `/[__smoke]/dedupe-check` automatically and asserts Sentry capture (needs network mocking or a Sentry-staging DSN).
- `sentry-cli` as a devDependency vs `npx` invocation — left to planner's discretion.
- `@verify` Playwright tag on the three target specs — rejected to keep Phase 15 scope tight.
- CI summary step printing "Phase 15 verify summary" — rejected as cosmetic.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim from REQUIREMENTS.md / ROADMAP §Phase 15) | Research Support |
|----|------------------------------------------------------------------|------------------|
| OBSV-03 | Sentry React 19 ErrorBoundary render-phase throw smoke-verified on Netlify deploy preview. Trigger render-phase throw via `?debug=sentry-test` overlay (D-01 reframed it onto `/__smoke`); confirm Sentry dashboard receives event with `boundary: app-root` tag and real stack frame names present. Close #17. | Sentry init in `src/main.tsx` already tags `boundary: app-root` in both `taggedHandler` (line 61) and `ErrorBoundary.beforeCapture` (line 81-82). `RenderThrowSmoke` already throws from render. Smoke harness needs ONE new button/sub-route to fire `new Error('OBSV-03 render')` so the captured event has a recognizable, OBSV-03-specific message. |
| OBSV-04 | Vite/Rolldown sourcemap function-name preservation verified end-to-end: (a) `verify-sourcemap-names.mjs` confirms literal `function Name(...)` in dist; (b) Sentry Artifacts API shows uploaded source maps for current release; (c) smoke-test event stack frames show real names. Close #19. | (a) New script per D-05/D-06 — allowlist-grep against `dist/assets/*.js`. (b) `sentry-cli releases files <VITE_COMMIT_SHA> list` per D-07 — paste output verbatim. (c) Inspect the OBSV-03 event from the same preview release. `keepNames: true` is already set in `vite.config.ts` line 34; the Phase 7 baseline artifact confirms it works (`RenderThrowSmoke,SmokePage` literally appear in `___smoke_-DYnw_MRs.js.map`). |
| OBSV-05 | `Sentry.dedupeIntegration()` collapses triple-handler path to one event per error, verified with DISTINCT messages per scenario; `Sentry.lastEventId()` confirms capture independent of transport flush. | Dedupe is pinned in `src/main.tsx` line 34. The "triple-handler path" = (i) `Sentry.ErrorBoundary` auto-capture, (ii) explicit `onError` callback inside ErrorBoundary calling `Sentry.captureException`, (iii) `onCaughtError` factory calling `Sentry.reactErrorHandler`. Dedupe compares stacktrace + fingerprint + message — using DISTINCT messages per smoke scenario prevents the *second* smoke event from being suppressed as a Dedupe-duplicate of the first. D-02 enforces this via the two-button design. |
| TEST-14 | `admin-create.spec.ts` passes in CI on `main`. Close #11. | Spec is already fixed — line 53 clicks `Yes/No` preset to auto-fill choices, line 60 uses `getByTestId('suggestion-form-submit')` (commits `7ef6c82`, `efcbd4c`). Spec has `[@smoke]` tag (line 23), so the existing `--grep @smoke` CI invocation runs it. Evidence = post-merge CI run URL + per-spec PASS line. |
| TEST-15 | `browse-respond.spec.ts` passes in CI on `main`. Close #12. | Spec is already fixed — uses `freshPoll` fixture (line 22 imports from `e2e/fixtures/poll-fixture.ts`), asserts non-zero count via `[1-9]\d*\s+total response` regex (line 56) (commit `184b8f5`). Spec has `[@smoke]` tag (line 22). Evidence = post-merge CI run URL + per-spec PASS line. |
| TEST-16 | `filter-search.spec.ts` passes in CI on `main`. Close #13. | Spec is already fixed — `E2E_TITLE = /\[E2E[\] ]/` constant (lines 9-10), filter applied before every `toHaveCount` (lines 79-80) (commits `308c578`, `a6d2f8e`, `5d63a06`). Spec has `[@smoke]` tag (line 28). Evidence = post-merge CI run URL + per-spec PASS line. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | Where it applies in Phase 15 |
|-----------|------------------------------|
| `noUnusedLocals: true`, `noUnusedParameters: true`, `erasableSyntaxOnly: true`, `verbatimModuleSyntax: true` | New smoke harness code in `src/routes/[__smoke].tsx` must compile under these flags. `import type` is required for type-only imports. |
| ESM only (`"type": "module"` in package.json) | `scripts/verify-sourcemap-names.mjs` uses `.mjs` extension explicitly — Node treats it as ESM regardless of package.json. Use `import { readdir, readFile } from 'node:fs/promises'` etc. |
| File naming: kebab-case for route files; PascalCase for component files | New script: `scripts/verify-sourcemap-names.mjs` (kebab-case, matches D-05). Existing component file: `RenderThrowSmoke.tsx` (PascalCase). |
| Indentation: 2 spaces | All new files. |
| Tailwind utility classes inline in JSX, no CSS-in-JS, no CSS modules | New buttons in `/__smoke` route — class names inline, lean on existing `src/components/ui/button.tsx`. |
| Single primary named export per file (no default exports for components) | Smoke trigger components export named `function FooBar`. |
| **WHY-only comments, no review-round/plan/phase IDs in `src/`** (memory + CLAUDE.md) | Smoke harness comments must NOT cite "Phase 15", "OBSV-03/04/05", "D-02", etc. Explain WHY ("two distinct messages so Dedupe doesn't collapse the second event" — not "OBSV-05 D-02"). Plan IDs belong in commit messages and PR body, never in `src/`. |
| Empty `catch` blocks forbidden | If the `verify-sourcemap-names.mjs` script catches file-read errors, it must log and rethrow or exit non-zero. |
| No `console.log` left in committed app code (lint discourages) | Exception per D-03: `console.log(Sentry.lastEventId())` from the smoke harness is intentional. Suppress with an inline ESLint disable if necessary; comment the WHY. |
| GSD workflow enforcement: route work through `/gsd-execute-phase` (not direct edits) | This research is the upstream of `/gsd:plan-phase` for Phase 15; downstream execution uses `/gsd-execute-phase`. |
| Two completely separate user surfaces: public + admin (`/admin/*`) | `/__smoke` is a third, prod-gated surface — keep it separate from `/admin/*` (which has AdminGuard). The existing `beforeLoad` gate on `VITE_NETLIFY_CONTEXT === 'production'` is the correct boundary. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Smoke-trigger UI (two buttons / two routes) | Browser/Client | Frontend (TanStack Router) | Triggers must fire INSIDE the React render tree so the ErrorBoundary catches them. Route is prod-gated client-side via `beforeLoad`. |
| Render-phase `throw` capture path | Browser/Client | — | `Sentry.ErrorBoundary` + `createRoot.onCaughtError` are SDK-side, not server-side. No backend involvement. |
| Sentry event capture + dedupe | Browser/Client → Sentry SaaS | — | SDK sends to ingest; Dedupe runs SDK-side BEFORE network egress. |
| Sourcemap upload (build artifact) | CI / Build | Sentry SaaS | `sentryVitePlugin` runs at `vite build` time, ships maps to Sentry, then deletes them from `dist/` per `filesToDeleteAfterUpload`. |
| `verify-sourcemap-names.mjs` (function-name regression guard) | CI (Node) | — | Static analysis of `dist/assets/*.js`. Runs after `npm run build`, fails CI on missing literals. |
| `sentry-cli releases files <release> list` (Artifacts API verification) | Local CLI (Verifier) | Sentry API | One-shot human-run command. Output pasted into evidence file. Not automated in CI. |
| Playwright E2E spec execution | CI (Ubuntu) | Local Supabase stack (Docker) | Already wired in `.github/workflows/ci.yml` job `e2e`. `--grep @smoke` filter covers all three target specs. |
| GitHub issue closure | Git/PR layer | GitHub UI | Auto-close via `Closes #N` keywords in PR body; per-issue evidence comment after merge. |

## Standard Stack

### Already-installed dependencies the phase reuses

| Package | Version | Purpose | Already wired |
|---------|---------|---------|---------------|
| `@sentry/react` | 10.49.0 [VERIFIED: package.json] | `Sentry.ErrorBoundary`, `reactErrorHandler`, `dedupeIntegration`, `lastEventId` | `src/main.tsx` |
| `@sentry/vite-plugin` | 5.2.0 [VERIFIED: package.json] | Sourcemap upload to Sentry during build | `vite.config.ts` line 21-27 |
| `@tanstack/react-router` | 1.168.10 [VERIFIED: package.json] | File-based routing for `/__smoke` route | `src/routes/[__smoke].tsx` |
| `vite` (Rolldown) | 8.0.4 [VERIFIED: package.json] | Build + `rolldownOptions.output.keepNames: true` | `vite.config.ts` line 34 |
| `@playwright/test` | 1.59.1 [VERIFIED: package.json] | E2E spec execution | `.github/workflows/ci.yml` job `e2e` |

### New tooling the phase MAY introduce (planner picks one of two paths per D's discretion)

| Tool | Form | Tradeoff |
|------|------|----------|
| `@sentry/cli` | devDependency (`npm install -D @sentry/cli`) | Reproducible version; one extra ~30 MB binary in `node_modules`. |
| `@sentry/cli` via `npx` (one-shot) | No package commit; verifier-only invocation | Zero install footprint; relies on registry availability at evidence time. |

**Recommendation:** `npx @sentry/cli@latest releases files "$VITE_COMMIT_SHA" list` for the verifier's local run. It's a one-shot evidence-capture step, not a recurring CI step. No need to lock a version in `package.json`. [ASSUMED]

### Version verification

```bash
node -e 'const p=require("./package.json"); console.log(JSON.stringify(p.scripts,null,2))'
```
Confirmed scripts:
- `dev: vite`
- `e2e: playwright test --config e2e/playwright.config.ts`
- `build: tsr generate && tsc -b && vite build`
- `lint: eslint .`
- `test: vitest run`

**No `test:e2e` script exists today.** ROADMAP/REQUIREMENTS call it `npm run test:e2e (or equivalent CI invocation)` — the equivalent is `npm run e2e` locally and `npx playwright test --config e2e/playwright.config.ts --grep @smoke` in CI. Phase 15 does **not** introduce a `test:e2e` alias (D-11: no E2E surface changes).

## Package Legitimacy Audit

| Package | Registry | Disposition |
|---------|----------|-------------|
| `@sentry/cli` | npm | Approved — `@sentry/cli` is the canonical Sentry CLI npm package (~5M weekly DLs, GitHub `getsentry/sentry-cli`, source repo well-known). If invoked via `npx`, no dependency commit; if as devDependency, version-pin to current `latest`. [VERIFIED: @sentry/vite-plugin already transitively uses sentry-cli internals] |

No other new packages required. All other tooling (Playwright, Vite, Sentry React SDK) already in `package.json`.

## Architecture Patterns

### System architecture diagram (Phase 15 evidence flow)

```
                          ┌─────────────────────────────┐
                          │  Phase 15 PR (branch)       │
                          │  ├─ smoke harness commits   │
                          │  ├─ verify-sourcemap script │
                          │  └─ draft 15-EVIDENCE.md    │
                          └──────────────┬──────────────┘
                                         │ git push
                                         ▼
        ┌───────────────────────────┐  ┌─────────────────────────────────┐
        │  Netlify (auto-build)     │  │  GitHub Actions CI              │
        │  deploy preview URL        │  │  - lint-and-unit (adds         │
        │  inherits $COMMIT_REF →     │  │    verify-sourcemap step)      │
        │  VITE_COMMIT_SHA →          │  │  - e2e (existing @smoke filter)│
        │  Sentry `release` field    │  │    runs admin-create,           │
        └─────────┬─────────────────┘  │    browse-respond, filter-search│
                  │                    └────────────┬────────────────────┘
                  │ verifier fires smoke triggers     │
                  ▼                                  │
        ┌───────────────────────────┐                │
        │  Sentry SaaS (dashboard)  │                │
        │  - OBSV-03 event           │               │
        │    (boundary:app-root tag) │               │
        │  - OBSV-05 dedupe event    │               │
        │    (distinct message)      │               │
        │  - real stack frame names  │               │
        └─────────┬─────────────────┘                │
                  │  evidence: event IDs              │
                  │           + screenshots            │
                  ▼                                   ▼
        ┌──────────────────────────────────────────────────────────┐
        │  15-EVIDENCE.md (single file under phase dir)            │
        │  - OBSV-03/04/05: Sentry event IDs + sentry-cli output   │
        │  - TEST-14/15/16: CI run URL + per-spec PASS lines        │
        │  - artifacts/*.png screenshots committed alongside       │
        └─────────────────────┬────────────────────────────────────┘
                              │ PR merges to main
                              ▼
        ┌──────────────────────────────────────────────────────────┐
        │  GitHub auto-close: #11, #12, #13, #17, #19              │
        │  + per-issue closure comment linking to 15-EVIDENCE.md    │
        └──────────────────────────────────────────────────────────┘
```

### Recommended project structure

```
.planning/phases/15-observability-e2e-verify-close/
├── 15-CONTEXT.md          # existing
├── 15-DISCUSSION-LOG.md   # existing
├── 15-RESEARCH.md         # this file
├── 15-PLAN-*.md           # planner output (TBD)
├── 15-EVIDENCE.md         # NEW — single evidence file (D-14)
└── artifacts/             # NEW — committed PNG screenshots (D-15)
    ├── sentry-obsv-03-event.png
    ├── sentry-obsv-04-stack.png
    ├── sentry-obsv-05-dedupe.png
    ├── ci-test-14-pass.png
    ├── ci-test-15-pass.png
    └── ci-test-16-pass.png

scripts/                            # NEW — top-level directory
└── verify-sourcemap-names.mjs      # NEW — D-05 allowlist check

src/routes/
└── [__smoke].tsx                   # EXISTING — extend with two triggers

src/components/debug/
├── RenderThrowSmoke.tsx            # EXISTING — reuse
└── (planner picks: DedupeSmoke.tsx or inlined) # for the second trigger
```

### Pattern 1: Sub-route vs in-page button for the two D-02 triggers

**What:** D-02 requires two DISTINCT trigger surfaces with DISTINCT error messages.
**When to use which form:**
- **Sub-route** (`/__smoke/render-throw`, `/__smoke/dedupe-check`): cleaner URL-as-evidence (an evidence screenshot URL bar shows exactly which scenario fired). Requires two more route files under TanStack Router file-based routing (`src/routes/[__smoke]/render-throw.tsx` and `.../dedupe-check.tsx`), each with its own `beforeLoad` prod gate. Higher boilerplate.
- **Query parameter discrimination** (`/__smoke?fire=render` / `/__smoke?fire=dedupe`): single route file, extend the existing `validateSearch`. Lower boilerplate; URL-as-evidence still works. **This is the shortest path** and matches the existing `?render=1` pattern already in `src/routes/[__smoke].tsx` lines 5-22.
- **In-page buttons** (two `<button>` elements on `/__smoke`): smallest surface, but URL-as-evidence is lost — the screenshot doesn't disambiguate. Worst form for evidence.

**Recommendation:** Extend `SmokeSearch` to `{ render?: '1' | 'dedupe' }` (or `fire?: 'render' | 'dedupe'` for clearer semantics) and branch the render. Keeps it one file, prod-gated once, URL-discriminated.

**Example (sketch, NOT final):**
```typescript
// src/routes/[__smoke].tsx
// Two distinct trigger surfaces so Sentry.dedupeIntegration() doesn't collapse
// the second smoke event as a duplicate of the first (Dedupe compares
// stacktrace + message).
interface SmokeSearch {
  fire?: 'render' | 'dedupe'
}

export const Route = createFileRoute('/__smoke')({
  validateSearch: (search): SmokeSearch => {
    const f = search.fire
    if (f === 'render' || f === 'dedupe') return { fire: f }
    return {}
  },
  beforeLoad: () => {
    if (import.meta.env.VITE_NETLIFY_CONTEXT === 'production') {
      throw notFound()
    }
  },
  component: SmokePage,
})
```

### Pattern 2: Surfacing `Sentry.lastEventId()` via DOM dataset (D-03)

Sentry's `lastEventId()` returns the last captured event ID. Two surfaces:
- `console.log` — human-readable in DevTools.
- `document.body.dataset.sentryEventId = id` — machine-readable; survives without UI changes; future Playwright assertion can read it via `await page.locator('body').getAttribute('data-sentry-event-id')`.

The `useEffect` that writes the dataset attribute must run AFTER capture has happened. Easiest path: write it inside the `onError` callback of `Sentry.ErrorBoundary` in `src/main.tsx` (it receives `eventId` as the third arg — see `src/main.tsx` line 83), OR inside the smoke-trigger component AFTER the throw is caught (next render cycle).

**Recommendation:** Add a small useEffect on the smoke page that reads `Sentry.lastEventId()` after the throw is caught and the ErrorBoundary re-renders the fallback. ALTERNATIVELY, surface it from the existing `onError` callback in `src/main.tsx` — that fires synchronously inside the boundary's catch path. The latter is more surgical (one site, not two), but spreads smoke-test concerns into the production error path.

### Pattern 3: `verify-sourcemap-names.mjs` script shape

```javascript
// scripts/verify-sourcemap-names.mjs
// Permanent regression guard for vite.config.ts `rolldownOptions.output.keepNames: true`.
// Without this flag, Sentry stack frames show mangled glyphs (`$M`) instead of
// real component names. The cost is +6.24% gzip; the value is debuggable stack frames.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const ALLOWLIST = ['ConsentProvider', 'AuthGate', 'AdminGuard', 'RenderThrowSmoke', 'App']
const DIST_ASSETS = 'dist/assets'

const files = (await readdir(DIST_ASSETS)).filter(f => f.endsWith('.js'))
const allContent = (await Promise.all(
  files.map(f => readFile(join(DIST_ASSETS, f), 'utf8'))
)).join('\n')

const missing = ALLOWLIST.filter(name => !new RegExp(`function ${name}\\s*\\(`).test(allContent))

if (missing.length > 0) {
  console.error(`[verify-sourcemap-names] FAIL: missing literal function declarations: ${missing.join(', ')}`)
  console.error('This means rolldownOptions.output.keepNames may have regressed.')
  process.exit(1)
}

console.log(`[verify-sourcemap-names] OK: all ${ALLOWLIST.length} names present as literal function declarations.`)
```

Per Phase 7 baseline (`sourcemap-names-excerpt.txt`): "Rolldown's Oxc minifier does NOT emit `__name()` calls; instead, it preserves the literal function declaration (e.g., 'function RootLayout(...)' stays in the bundle as-is)." So the grep is for `function X(`, not `__name(X, ...)`. [CITED: .planning/milestones/v1.1-phases/07-observability-hardening/artifacts/sourcemap-names-excerpt.txt]

### Pattern 4: CI wiring for `verify-sourcemap-names.mjs` (D-08)

The current `lint-and-unit` job in `.github/workflows/ci.yml` does NOT run `npm run build`. The job runs:
1. `npm ci`
2. `npm run lint`
3. `npm test -- --run`
4. `npm audit --audit-level=high || true`

Per D-08: "Wire `verify-sourcemap-names.mjs` into `ci.yml`'s `lint-and-unit` job, running after a build step (or adding one if not present in that job — the planner will confirm)."

Confirmed: a build step is NOT present in `lint-and-unit`. The planner must EITHER:
- (a) Add `npm run build` to `lint-and-unit` (adds ~30s-60s to that job; provides full coverage).
- (b) Move the verify step into the `e2e` job (which already does `npm run build` at line 206). This keeps `lint-and-unit` fast but couples the regression guard to the slower E2E job.

**Recommendation:** option (a) — add a `Build for sourcemap verification` step and a `Verify sourcemap names` step in `lint-and-unit`. The build is needed for the verify, but does NOT need to set `SENTRY_AUTH_TOKEN` (sourcemap upload is skipped when the token is absent — see `vite.config.ts` line 27 `disable: mode !== 'production'` and the Sentry plugin's own absent-token short-circuit). The build doesn't even need to be in `production` mode for the literal-function-declaration check — Rolldown emits the same declarations regardless of `production`/`development`. [ASSUMED — verify by running the script locally against both `vite build` and `vite build --mode development` outputs during plan execution]

### Anti-Patterns to Avoid

- **Using the same error message for both D-02 triggers.** `Sentry.dedupeIntegration()` compares message + stacktrace + fingerprint — same-message throws will be silently collapsed, masking whether the second handler actually fired. The "DISTINCT messages" rule from REQUIREMENTS.md OBSV-05 exists precisely to prevent this false-pass. [CITED: https://docs.sentry.io/platforms/javascript/configuration/integrations/dedupe/]
- **Citing phase/plan IDs in source comments.** Comments on the smoke harness must explain WHY in domain terms ("two distinct messages so Dedupe doesn't collapse the second event"), never WHY-via-phase-archaeology ("OBSV-05 D-02"). Plan refs belong in commit messages and PR body. [CITED: ./CLAUDE.md + memory `feedback_no_review_archaeology_in_source`]
- **Adding `?debug=sentry-test` as a new global query-param gate.** D-01 explicitly rejects this in favor of the existing `/__smoke` prod gate. The literal `?debug=sentry-test` phrasing in REQUIREMENTS.md is a *description of the requirement intent*, not a directive on the URL syntax. D-01 supersedes it.
- **Editing `e2e/tests/*` or `playwright.config.*` in this phase.** D-11 forbids it. If a target spec is observed to fail, the fix lives in a SEPARATE phase, not Phase 15.
- **Closing GitHub issues manually before the PR merges.** D-16: PR auto-close keywords drive the close; per-issue closure comments come AFTER merge. Closing early breaks the audit trail.
- **Triggering smokes more than ~3 times per minute on the deploy preview.** Sentry free-tier spike protection drops events once an hourly average is exceeded. [CITED: https://docs.sentry.io/pricing/quotas/spike-protection/] Two captures (one render-throw + one dedupe-check) are well within limits; firing them in a tight loop to "double-check" risks the second capture being dropped, which would be misread as a Dedupe success.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Listing source maps uploaded to Sentry for a release | Custom REST client against `/api/0/organizations/{org}/releases/{version}/files/` | `npx @sentry/cli@latest releases files "$VITE_COMMIT_SHA" list` | sentry-cli handles auth-token scoping, pagination, JSON output, error retries. D-07 requires this exact tool. |
| Deduplicating Sentry events on the client | Custom event fingerprinting | `Sentry.dedupeIntegration()` (already pinned in `src/main.tsx` line 34) | The SDK's Dedupe compares stacktrace + fingerprint + message; rolling your own duplicates existing logic and risks divergent behavior across SDK versions. [CITED: https://docs.sentry.io/platforms/javascript/configuration/integrations/dedupe/] |
| React 19 error capture | Custom `componentDidCatch` + `getDerivedStateFromError` boundary | `Sentry.ErrorBoundary` + `createRoot.onUncaughtError`/`onCaughtError`/`onRecoverableError` factories | Sentry's React SDK natively integrates with React 19's three new root-level hooks via `reactErrorHandler`. [CITED: https://docs.sentry.io/platforms/javascript/guides/react/features/error-boundary/] |
| Sourcemap upload | Custom sentry-cli wrapper | `@sentry/vite-plugin` (already wired in `vite.config.ts` line 21-27) | Handles release tagging, file matching, artifact dedup, and delete-after-upload. |
| Playwright + Supabase local-stack orchestration | Custom Docker scripts | `supabase/setup-cli@v2` action + `supabase start` + `e2e/fixtures/seed.sql` (already wired in `ci.yml`) | The two-step seed flow (M4) is already tuned and stable. |

**Key insight:** Phase 15 builds essentially zero new infrastructure. Two small additions (smoke harness, verify script) and a lot of evidence capture. Resist scope creep into "while we're here, let's also …" — the LOW risk rating depends on this discipline.

## Runtime State Inventory

**Skip rationale:** Phase 15 is not a rename/refactor/migration phase. No stored data, live service config, OS-registered state, secrets, or build artifacts are renamed.

The closest analog — Sentry's `release` field — is already correctly wired via `VITE_COMMIT_SHA = $COMMIT_REF` in `netlify.toml`, and is per-commit (no stored state to migrate). The deploy preview's release ID is whatever commit SHA the Phase 15 PR's HEAD happens to have at preview-build time.

**Nothing found in any category** — confirmed by inspection of:
- `netlify.toml` (build env)
- `src/main.tsx` Sentry init (no hardcoded release)
- `vite.config.ts` Sentry plugin (no hardcoded release)
- `.github/workflows/ci.yml` (no hardcoded release env)

## Common Pitfalls

### Pitfall 1: Sentry release SHA mismatch between preview and source-map upload

**What goes wrong:** The deploy preview's Sentry events are tagged with `release = VITE_COMMIT_SHA = $COMMIT_REF`. The source maps uploaded by `@sentry/vite-plugin` during the Netlify build use the same release. If the verifier accidentally queries `sentry-cli releases files <wrong-sha> list`, the response is empty — false negative.
**Why it happens:** `$COMMIT_REF` is the EXACT SHA of the commit that built; if the verifier types `main`'s HEAD or the PR's HEAD-as-of-research-time, it can drift if more commits land on the PR branch.
**How to avoid:** Read the SHA off the deploy preview's deploy log (Netlify shows `COMMIT_REF` literally), or — better — copy it directly from a Sentry event's `release` tag in the dashboard once the smoke fires. Use THAT SHA for the sentry-cli query.
**Warning signs:** `sentry-cli releases files <sha> list` returns "Release not found" or an empty list while you can see the event in the dashboard.

### Pitfall 2: Dedupe false-pass via same-message smokes (the OBSV-05 trap)

**What goes wrong:** Verifier fires the render-throw twice (e.g., refreshes the page once to "double-check") and concludes "Dedupe is working — only one event appeared." But that's an UNRELATED dedupe — two same-message events from the same stacktrace. The actual OBSV-05 contract is: a SINGLE throw fans out to THREE handlers (ErrorBoundary auto-capture + `onError` belt + `onCaughtError` reactErrorHandler), and Dedupe must collapse the THREE outputs into ONE event.
**Why it happens:** "Triple-handler" is a non-obvious concept; the surface symptom (one event) is the same whether you fired one click or one click + a refresh.
**How to avoid:** D-02 enforces DISTINCT messages per scenario. The render-throw scenario uses `'OBSV-03 render'`. The dedupe-check scenario uses `'OBSV-05 dedupe'`. The verifier:
1. Fires render-throw → observes ONE event in Sentry with message `OBSV-03 render`. `Sentry.lastEventId()` returns ID1.
2. Fires dedupe-check → observes ONE event in Sentry with message `OBSV-05 dedupe`. `Sentry.lastEventId()` returns ID2, where ID2 ≠ ID1.

If Sentry shows TWO events with the same `OBSV-03 render` message → Dedupe is broken (the triple-handler split is no longer being collapsed).
If Sentry shows only the `OBSV-03 render` event after firing the dedupe scenario → the dedupe path was masking distinct messages (catastrophic SDK bug).

### Pitfall 3: Sentry free-tier spike protection drops smoke events

**What goes wrong:** Verifier hammers the smoke triggers rapidly, hits Sentry's per-minute rate cap, the second or third event is silently dropped, verifier concludes the SDK is broken.
**Why it happens:** Sentry uses minute-based spike protection to prevent quota burn. [CITED: https://docs.sentry.io/pricing/quotas/spike-protection/]
**How to avoid:** Fire each smoke ONCE with at least 10s between triggers. Verify the event appears in the Sentry dashboard before firing the next. Don't loop / don't auto-fire from a Playwright spec without rate-limiting awareness.
**Warning signs:** First smoke event arrives; second smoke event doesn't appear after ~30s; no Dedupe-collapse signal in Sentry's "Discarded Events" panel.

### Pitfall 4: `verify-sourcemap-names.mjs` runs against a stale `dist/`

**What goes wrong:** Local verifier runs `node scripts/verify-sourcemap-names.mjs` against a `dist/` from a previous build that predates the `keepNames` change. False positive (script passes against an old, correctly-keepNames-built bundle even though the current source removed the flag).
**Why it happens:** Script is build-agnostic per D-discretion; if the caller forgets to rebuild, the check is meaningless.
**How to avoid:** Either (a) script calls `node:child_process` to invoke `npm run build` first, OR (b) the planner adds a CI step that ALWAYS builds-then-verifies. CI is the canonical run site (D-08) — don't rely on local verifier discipline.
**Warning signs:** Script passes locally but fails in CI (or vice versa).

### Pitfall 5: TanStack Router file-based routing requires `tsr generate` after route changes

**What goes wrong:** Planner adds new sub-routes under `src/routes/[__smoke]/` but forgets `tsr generate`, so `routeTree.gen.ts` doesn't include the new files. `npm run build` does run `tsr generate` first, so CI is safe — but `npm run dev` and `npm test` against locally-staged code can produce confusing TypeScript errors until regenerated.
**Why it happens:** The route tree is generated, not source-of-truth.
**How to avoid:** Always run `npm run generate` after adding/renaming/deleting route files. If using the query-param approach instead of sub-routes (the recommended path), this pitfall is moot — one file, no tree change.

### Pitfall 6: `import.meta.env.VITE_NETLIFY_CONTEXT` may be undefined locally

**What goes wrong:** Verifier wants to test the smoke harness LOCALLY before pushing to the preview. `import.meta.env.VITE_NETLIFY_CONTEXT` is unset → the prod gate's `!== 'production'` check passes → smoke route IS reachable locally. Good. But if the verifier wants to test the gate itself, they need to manually set `VITE_NETLIFY_CONTEXT=production npm run dev` and confirm the route 404s.
**Why it happens:** Netlify-injected env vars are only set on Netlify; local builds inherit `undefined`.
**How to avoid:** Test the route's gate by running `VITE_NETLIFY_CONTEXT=production npm run preview` once and confirming `404` at `/__smoke`. Document this in 15-EVIDENCE.md if the verifier wants to certify the gate's contract.

### Pitfall 7: Playwright `--grep @smoke` already covers target specs — but `--grep` is a SUBSTRING regex

**What goes wrong:** All three target specs use the literal `[@smoke]` tag inside the test name (e.g., `test('[@smoke] admin creates suggestion …', …)`). The CI invocation is `--grep @smoke`. If a future spec is named `[@smoke-disabled]` or `[@smoke-skip]`, `--grep @smoke` will match it and run it.
**Why it happens:** Playwright's `--grep` is a regex test against the full test title; `@smoke` matches `@smoke`, `@smoke-foo`, `@smokestorm`, etc.
**How to avoid:** Phase 15 does NOT change this (D-11). But evidence capture (D-10) needs to list which specs ran by NAME, not just by tag — `--reporter list` output names every spec explicitly. The HTML reporter's `results.html` is uploaded only on failure (line 240-244 of `ci.yml`) — on a green run, the list-reporter stdout in the action log is the per-spec PASS evidence.

### Pitfall 8: Sentry `replaysSessionSampleRate: 0.1` and `tracesSampleRate: 0.1` do NOT affect error captures

**What goes wrong:** Verifier worries that the 10% sample rate will drop smoke captures.
**Why it happens:** Misunderstanding the sample-rate API.
**How to avoid:** Errors captured via `Sentry.captureException` / ErrorBoundary are NOT subject to `tracesSampleRate` (that's transactions/spans). Replay is sampled separately and won't affect error event delivery. Smoke captures are guaranteed (subject only to spike protection per Pitfall 3). [CITED: https://docs.sentry.io/platforms/javascript/configuration/integrations/dedupe/ and SDK semantics]

## Code Examples

### Verifier playbook (NOT app code — runs locally, on the verifier's machine)

```bash
# 1. Get the deploy-preview SHA from Netlify's build log or by clicking the preview URL
#    and inspecting any Sentry event's `release` tag.
PREVIEW_SHA=<the-exact-COMMIT_REF-from-netlify>

# 2. Fire the smokes from the deploy preview in a browser (NOT local dev — must be the
#    same release SHA that uploaded source maps).
#    URL pattern (assuming query-param shape): https://<preview-url>/__smoke?fire=render
#                                               https://<preview-url>/__smoke?fire=dedupe
#    DevTools console will log the lastEventId for each.
#    DOM body.dataset.sentryEventId will hold the same ID.

# 3. Confirm both events arrived in Sentry dashboard with:
#    - boundary: app-root tag
#    - distinct messages ('OBSV-03 render' vs 'OBSV-05 dedupe')
#    - real function names in the stack frames (RenderThrowSmoke, SmokePage, etc)

# 4. List uploaded source maps for the release (D-07).
export SENTRY_AUTH_TOKEN=<token-with-project:read-scope-or-broader>
export SENTRY_ORG=<org-slug>
export SENTRY_PROJECT=<project-slug>
npx @sentry/cli@latest releases files "$PREVIEW_SHA" list

#    Expected output: a table of artifact filenames (e.g., `~/assets/index-XXXX.js`,
#    `~/assets/index-XXXX.js.map`, `~/assets/___smoke_-YYYY.js`, `.../___smoke_-YYYY.js.map`)
#    Paste this output VERBATIM into 15-EVIDENCE.md OBSV-04(b).

# 5. Take screenshots of the Sentry event detail panels — both for OBSV-03 (boundary tag +
#    stack frames) and OBSV-05 (single-event-per-throw confirmation). Crop to <200KB PNG.

# 6. After PR merges to main, wait for the post-merge CI run to complete. Capture the
#    Playwright list-reporter stdout for the three target specs from the action log:
#      ✓ [@smoke] admin creates suggestion and it appears for users (...)
#      ✓ [@smoke] user browses topics, responds, sees live results (...)
#      ✓ [@smoke] user filters by category and searches (...)
#    Take a screenshot or paste the lines into 15-EVIDENCE.md TEST-14/15/16.
```

### App-side smoke harness sketch (planner to finalize shape)

```typescript
// src/routes/[__smoke].tsx — EXTEND existing file (do not duplicate)
// (see existing file for `Route`, `validateSearch`, `beforeLoad`, `SmokePage`)

// Distinct trigger components so Sentry.dedupeIntegration() doesn't collapse
// the second smoke event as a duplicate of the first; Dedupe compares
// stacktrace + message, and the two components have different stack frames
// and different message strings.
function RenderThrowTrigger(): never {
  throw new Error('OBSV-03 render')
}

function DedupeCheckTrigger(): never {
  throw new Error('OBSV-05 dedupe')
}
```

The existing `RenderThrowSmoke.tsx` already throws `'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'`. The planner must decide: rewrite that message to `'OBSV-03 render'`, OR add new components with the canonical messages and reserve the existing component for a third (currently unused) entry point.

**Recommendation:** Add the two new components alongside `RenderThrowSmoke`. The existing component is the BASE canary and may be referenced from other paths (the existing `/__smoke?render=1` route uses it); leaving it intact preserves the v1.0 contract. New components carry the canonical OBSV-03/OBSV-05 messages. **WHY-only comments** on the new components, no phase/plan IDs.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React 16-18: `componentDidCatch` + `getDerivedStateFromError` only | React 19: root-level `onUncaughtError` / `onCaughtError` / `onRecoverableError` hooks on `createRoot` | React 19 (late 2025) | Sentry's `reactErrorHandler` integrates with both APIs; the project already uses both — `Sentry.ErrorBoundary` for scoped fallback + `createRoot.onCaughtError` for root-level capture. The "triple-handler" path emerges from this dual API surface. [CITED: https://docs.sentry.io/platforms/javascript/guides/react/features/error-boundary/] |
| esbuild's `keepNames` (emits `__name(fn, 'orig')` helpers) | Rolldown's Oxc minifier (preserves literal `function X(...)` declarations) | Vite 8 / Rolldown adoption | The `verify-sourcemap-names.mjs` script greps for `function X(`, not `__name(X, ...)`. Phase 7 baseline already documents this. [CITED: .planning/milestones/v1.1-phases/07-observability-hardening/artifacts/sourcemap-names-excerpt.txt] |
| Sentry CLI legacy auth (`SENTRY_API_KEY`) | Sentry CLI auth tokens only (`SENTRY_AUTH_TOKEN` with `project:read` or `project:releases` scope) | sentry-cli 2.x | D-07 requires `SENTRY_AUTH_TOKEN` set locally. The token can be a Personal Auth Token (PAT) with read scope — does NOT need write/release scope for the `files list` operation. [CITED: https://docs.sentry.io/cli/configuration/ and https://docs.sentry.io/api/permissions/] |

**Deprecated/outdated:**
- The `?debug=sentry-test` overlay phrasing in REQUIREMENTS.md OBSV-03 is a placeholder, not a directive. D-01 supersedes it with the existing `/__smoke` prod-gated route.
- Phase 7's `sourcemap-names-excerpt.txt` is a baseline reference only (D-canonical_refs). The v1.3 evidence file (`15-EVIDENCE.md`) replaces it as the current source of truth for OBSV-04(a).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Using `npx @sentry/cli@latest` (one-shot) rather than committing it as a devDependency. | Standard Stack | LOW — the verifier's local environment might not allow `npx` against the registry. Mitigation: add `@sentry/cli` as devDependency if the verifier reports the npx path is blocked. |
| A2 | `lint-and-unit` job currently does NOT build → planner must add a build step OR move verify into the `e2e` job. The build-once-verify approach is faster than coupling to E2E. | Architecture Patterns / Pattern 4 | LOW — confirmed by direct read of `.github/workflows/ci.yml` lines 21-39; if a future commit adds a build step before Phase 15 lands, the planner just appends the verify step without a new build. |
| A3 | `vite build` without `--mode production` still emits literal `function X(` declarations (Rolldown's Oxc minifier is active in both modes per Vite defaults). | Architecture Patterns / Pattern 4 | MEDIUM — if Rolldown skips minification in development mode, the verify script's grep is meaningless against a dev build. Mitigation: planner runs the script against both `vite build` and `vite build --mode development` outputs locally during plan execution to confirm. If development-mode output lacks the literals, the build step in `lint-and-unit` must explicitly use `--mode production`. |
| A4 | The query-parameter discrimination approach (`/__smoke?fire=render` / `/__smoke?fire=dedupe`) is the shortest-path interpretation of D-02's "or equivalent sub-button". | Architecture Patterns / Pattern 1 | LOW — D-02 explicitly leaves the mechanism to the planner. If sub-routes are preferred for URL-as-evidence clarity, both forms are inside the locked-decision envelope. |
| A5 | Sentry free-tier spike protection cap is "minute-based ~500 events" (general guidance, not project-specific). | Common Pitfalls / Pitfall 3 | LOW — the smoke playbook fires ~2 events total; well below any plausible threshold. Mitigation: don't loop. |
| A6 | The `release` field on Sentry events matches `VITE_COMMIT_SHA` matches `$COMMIT_REF` from Netlify — these are all the same SHA per netlify.toml line 9. | Common Pitfalls / Pitfall 1 | LOW — directly confirmed by reading `netlify.toml` and `src/main.tsx` line 27. |
| A7 | Sentry `tracesSampleRate: 0.1` does NOT affect error captures (only transactions/spans). | Common Pitfalls / Pitfall 8 | LOW — this is standard Sentry SDK semantics, but the planner may want to confirm against the current `@sentry/react` 10.49.0 changelog during plan execution. |
| A8 | The planner has discretion on whether to repurpose `RenderThrowSmoke.tsx` for the OBSV-03 message or add new components. | Code Examples | LOW — both forms satisfy D-02. Recommendation favors adding new components to preserve the existing canary's v1.0 contract. |

## Open Questions

1. **Should the verify-sourcemap-names.mjs allowlist include component names from generated route modules (e.g., `IndexPage`, `LandingPage`, `AdminTab`)?**
   - What we know: Phase 7 baseline lists 59 unique 5+-char PascalCase identifiers in names[], including `IndexPage`, `LandingPage`, `AdminTab` etc.
   - What's unclear: whether locking the allowlist to top-level shell components (`App`, `ConsentProvider`, `AuthGate`, `AdminGuard`, `RenderThrowSmoke`) is sufficient regression coverage, or whether broader coverage adds value.
   - Recommendation: start with D-06's seed list of five. Broader coverage can be added later if a regression slips through.

2. **If `sentry-cli releases files <release> list` returns an empty list, is that an OBSV-04 fail, or a verifier-environment fail (auth token / org / project slug wrong)?**
   - What we know: empty list could mean (a) source-map upload didn't run on the preview build (token absent, plugin disabled), or (b) wrong SHA queried, or (c) wrong org/project.
   - What's unclear: how to disambiguate quickly.
   - Recommendation: the planner's evidence step should include a "smoke-check the auth" sub-step: `npx @sentry/cli@latest info` (lists configured org/project) BEFORE the `files list` call. Document the disambiguation tree in 15-EVIDENCE.md.

3. **Does the deploy-preview Netlify environment set `SENTRY_AUTH_TOKEN` correctly so sourcemap upload actually runs?**
   - What we know: `vite.config.ts` passes `authToken: process.env.SENTRY_AUTH_TOKEN` to the plugin. If unset, the plugin's `bundler-plugin-core` short-circuits the upload silently.
   - What's unclear: whether Netlify's deploy-preview context inherits the production-context env vars (Netlify treats preview, branch, and production contexts separately).
   - Recommendation: planner adds a pre-flight check to the playbook: confirm in Netlify UI that `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` are set for "Deploy previews" context (not just "Production"). If they are NOT, the deploy-preview build will skip sourcemap upload and OBSV-04(b) cannot be proved.

4. **Does the `e2e` CI job's `--grep @smoke` regex have any false positives that would inflate the per-spec evidence?**
   - What we know: as of `main` HEAD, only the three target specs + any other `[@smoke]`-tagged specs run. `e2e/tests/` count: planner can confirm with `grep -l '@smoke' e2e/tests/`.
   - What's unclear: whether the post-merge CI run will pick up additional `@smoke` specs that didn't exist at research time.
   - Recommendation: D-10 mandates capturing PASS lines BY NAME for the three target specs. Other `@smoke` specs running alongside is fine — Phase 15 only certifies these three.

5. **What's the canonical syntax for the per-issue closure comment (D-16) — does the project have a style precedent?**
   - What we know: closure directory (`.planning/closure/`) contains `OBSV-02-bundle-delta.md`, `UIDN-02-mobile-evidence.md`, `UIDN-03-shadcn-audit.md` — these are evidence files, not issue-close-comment templates.
   - What's unclear: whether existing closed issues have a recurring comment shape.
   - Recommendation: planner runs `gh issue list --state closed --limit 10` and inspects the most-recent close comments for style. Likely shape: `Closed by Phase 15 (PR #N). Evidence: <link to 15-EVIDENCE.md#anchor>.` Short and link-driven.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 | `verify-sourcemap-names.mjs` runtime + CI | ✓ | NODE_VERSION=22 set in netlify.toml line 13, ci.yml uses node-version: '22' | — |
| `@sentry/cli` | OBSV-04(b) Artifacts API list | Via `npx` ✓ | latest at evidence time | Add as devDependency if `npx` blocked |
| `SENTRY_AUTH_TOKEN` (verifier-local) | OBSV-04(b) `files list` call | Verifier must obtain | PAT with `project:read` scope minimum | If absent, cannot satisfy OBSV-04(b) — blocking |
| `SENTRY_AUTH_TOKEN` (Netlify deploy-preview build context) | OBSV-04(b) — sourcemap upload to Sentry from the preview build | UNKNOWN — needs verification | — | If absent for preview context, set it via Netlify UI before triggering the preview build (Open Question #3) |
| Playwright browsers (Chromium) | E2E job | ✓ | Installed in CI via `npx playwright install --with-deps chromium` (ci.yml line 201) | — |
| Local Supabase stack | E2E job | ✓ | `supabase/setup-cli@v2` action, version 2.92.1 (ci.yml line 122) | — |
| Netlify deploy-preview builds | D-13 evidence source | Assumed ✓ | Netlify default for PRs against `main` | If disabled, switch to a no-op evidence PR after merge (rejected in Q1 above) — actual fallback: enable preview builds in Netlify UI |
| GitHub `gh` CLI | D-16 per-issue closure comments | ✓ | Already used by `gh issue view` calls during research | — |

**Missing dependencies with no fallback:**
- `SENTRY_AUTH_TOKEN` for the verifier's local sentry-cli invocation. If the verifier (the person running Phase 15) does not have a Sentry account with the right project access, OBSV-04(b) cannot be evidenced. **The planner must surface this as a pre-flight requirement in the plan.**

**Missing dependencies with fallback:**
- `@sentry/cli` install — fallback is committing as devDependency. Both forms satisfy D-07.

## Validation Architecture

Phase 15 is a verify-and-close phase. Its "test plan" is the evidence playbook itself — there is no new behavioral surface to unit-test. The smoke harness IS the test. However, the existing Vitest unit-test suite and Playwright `@smoke` suite must continue to pass on the Phase 15 PR's HEAD.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 1.6.x (peer of `@vitest/coverage-v8`) + Playwright 1.59.1 |
| Config files | `vite.config.ts` (vitest section, lines 42-56) + `e2e/playwright.config.ts` |
| Quick run command | `npm test -- --run` (unit) |
| Full E2E command | `npm run e2e` (locally) / `npx playwright test --config e2e/playwright.config.ts --grep @smoke` (CI) |
| Phase gate | Unit suite green + E2E `@smoke` suite green on Phase 15 PR head; post-merge CI run on `main` green |

### Phase Requirements → Test/Evidence Map

| Req ID | Behavior to evidence | Evidence type | How captured | Already on `main`? |
|--------|----------------------|---------------|--------------|---------------------|
| OBSV-03 | Render-phase throw on `/__smoke` triggers Sentry capture with `boundary: app-root` tag | Manual smoke + Sentry dashboard screenshot | Verifier fires render-throw on preview → captures event ID + screenshot | Behavioral fix YES; smoke harness NO |
| OBSV-04(a) | `dist/assets/*.js` contains literal `function <name>(` declarations for allowlist | Automated script + CI run | `node scripts/verify-sourcemap-names.mjs` exits 0 in `lint-and-unit` job | `keepNames` flag YES; script NO |
| OBSV-04(b) | Sentry release `$VITE_COMMIT_SHA` has uploaded source maps | Manual `sentry-cli` invocation | Paste `sentry-cli releases files <sha> list` output into evidence file | Upload wiring YES; evidence capture NO |
| OBSV-04(c) | Smoke-test Sentry event stack frames show real function names | Manual Sentry dashboard inspection + screenshot | Verifier opens event detail → screenshots stack frame panel | Mechanism YES; evidence NO |
| OBSV-05 | Triple-handler path collapses to one event per DISTINCT-message throw | Manual smoke (two clicks) + Sentry dashboard | Verifier fires both `/__smoke?fire=render` and `?fire=dedupe` → confirms TWO events with TWO distinct messages, each event represents ONE collapsed throw | Dedupe pin YES; harness NO |
| TEST-14 | `admin-create.spec.ts` passes in CI on main | Automated (CI run on push to main) | Capture per-spec PASS line from Playwright list-reporter stdout in post-merge action log | YES (fix committed) |
| TEST-15 | `browse-respond.spec.ts` passes in CI on main | Automated (CI run on push to main) | Capture per-spec PASS line from Playwright list-reporter stdout in post-merge action log | YES (fix committed) |
| TEST-16 | `filter-search.spec.ts` passes in CI on main | Automated (CI run on push to main) | Capture per-spec PASS line from Playwright list-reporter stdout in post-merge action log | YES (fix committed) |

### Sampling Rate

- **Per task commit on Phase 15 branch:** `npm test -- --run` (unit), `npm run lint` (lint), `node scripts/verify-sourcemap-names.mjs` (after build) — fast feedback.
- **Pre-PR-open:** `npm run build` locally, then `node scripts/verify-sourcemap-names.mjs` to confirm allowlist resolves. `npm run e2e` against a local Supabase stack to confirm the three target specs still pass.
- **PR-open:** GitHub Actions runs all three jobs (`lint-and-unit`, `test-integration`, `e2e`). The new verify step must pass in `lint-and-unit`.
- **Post-merge:** CI re-runs on `main` push. THIS run's URL is the evidence cited for TEST-14/15/16 (D-12).
- **Phase gate:** All evidence rows in 15-EVIDENCE.md filled with concrete artifacts (event IDs / run URLs / sentry-cli output / screenshot links) before issues are closed.

### Wave 0 Gaps

- [ ] `scripts/verify-sourcemap-names.mjs` — does not exist; planner authors per Pattern 3 sketch.
- [ ] CI step in `.github/workflows/ci.yml` `lint-and-unit` job — adds `npm run build` + verify-sourcemap-names invocation per D-08.
- [ ] Smoke triggers under `src/routes/[__smoke].tsx` — extend existing route per Pattern 1.
- [ ] `15-EVIDENCE.md` template scaffolded — single file with one section per requirement, anchors for closure-comment links.
- [ ] `artifacts/` directory created under phase dir; `.gitignore` (if any) does NOT exclude `*.png` under this path — sanity-check.

*Existing test infrastructure (Vitest + Playwright + Supabase local stack) is reused unchanged.*

## Security Domain

> `security_enforcement` is not explicitly set to `false` in `.planning/config.json`, so this section is included. Phase 15 has minimal security surface — the smoke harness is prod-gated, the verify script is dev-tooling, evidence files contain no secrets.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth flow changes. |
| V3 Session Management | no | No session changes. |
| V4 Access Control | yes (minor) | `/__smoke` route's `beforeLoad` prod gate via `VITE_NETLIFY_CONTEXT === 'production'` is the access boundary; verify it survives the new sub-trigger extension. |
| V5 Input Validation | yes (minor) | `validateSearch` on `/__smoke` route accepts only `render` / `fire` enum values. Reject anything else (existing pattern at line 18-22). |
| V6 Cryptography | no | No cryptographic operations. |
| V7 Error Handling | yes | Smoke harness intentionally throws; verify that `AppErrorFallback` does NOT leak `props.error.message` to the DOM (already documented in `src/components/AppErrorFallback.tsx` line 4 — "Never surface props.error.* to the DOM (info leak)"). The smoke messages `'OBSV-03 render'` etc are non-sensitive but the contract still applies. |
| V8 Data Protection | no | No data flow changes. |
| V12 Files & Resources | yes (minor) | `verify-sourcemap-names.mjs` reads `dist/assets/*.js` — script must not follow symlinks outside `dist/` (use `node:path` `resolve` + boundary check if extending). For the simple `readdir` shape sketched in Pattern 3, this is non-issue. |
| V14 Configuration | yes | Verify `SENTRY_AUTH_TOKEN` is set ONLY in Netlify's secret env, NEVER in committed code or `.env` checked into git. Current state (per `vite.config.ts`) is correct (no VITE_*-prefix means it never reaches the browser bundle). |

### Known Threat Patterns for this phase's tech stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Production smoke route reachable in prod due to misconfigured gate | EoP (elevation of privilege via debug surface) | `beforeLoad` throws `notFound()` when `VITE_NETLIFY_CONTEXT === 'production'`; existing pattern, do not remove or weaken. |
| Sentry-event leaking secrets via error message | Info disclosure | Smoke messages are hardcoded `'OBSV-03 render'` etc — no user input embedded. Adheres to `AppErrorFallback` contract of never surfacing `props.error.*`. |
| Source-map leak via Sentry plugin's `filesToDeleteAfterUpload: './dist/**/*.map'` not running | Info disclosure | Pattern already present (`vite.config.ts` line 25); verify the `dist/` deployed to Netlify does NOT contain `.map` files at preview time. The Sentry vite plugin handles this in `closeBundle`. |
| sentry-cli auth token exposure in logs | Info disclosure | Verifier sets `SENTRY_AUTH_TOKEN` as a shell env (one-shot), not in committed files. Do NOT echo or `set -x` around the sentry-cli invocation. |

## Sources

### Primary (HIGH confidence)

- `.planning/REQUIREMENTS.md` lines 31-46 (OBSV-03..05, TEST-14..16 acceptance criteria) [VERIFIED: direct read]
- `.planning/ROADMAP.md` §Phase 15 (goal, success criteria, requirement summaries) [VERIFIED: direct read]
- `.planning/STATE.md` tail (Phase 14 complete, Phase 15 next) [VERIFIED: direct read]
- `.planning/phases/15-observability-e2e-verify-close/15-CONTEXT.md` (locked decisions D-01..D-16) [VERIFIED: direct read]
- `.planning/phases/15-observability-e2e-verify-close/15-DISCUSSION-LOG.md` (alternatives considered) [VERIFIED: direct read]
- `src/main.tsx` lines 22-102 (Sentry init, `taggedHandler`, `Sentry.ErrorBoundary` with `onError` + `beforeCapture`) [VERIFIED: direct read]
- `src/routes/[__smoke].tsx` (existing prod-gated route, `validateSearch`, `beforeLoad`) [VERIFIED: direct read]
- `src/components/debug/RenderThrowSmoke.tsx` (existing render-throw canary) [VERIFIED: direct read]
- `src/components/AppErrorFallback.tsx` (no `props.error.*` to DOM contract) [VERIFIED: direct read]
- `vite.config.ts` (`keepNames: true`, sentry plugin last position) [VERIFIED: direct read]
- `netlify.toml` (`$COMMIT_REF` → `VITE_COMMIT_SHA` → Sentry release) [VERIFIED: direct read]
- `.github/workflows/ci.yml` (`lint-and-unit`, `e2e` jobs; `--grep @smoke` filter) [VERIFIED: direct read]
- `e2e/tests/admin-create.spec.ts` (Yes/No preset click at line 53, `[@smoke]` tag at line 23) [VERIFIED: direct read]
- `e2e/tests/browse-respond.spec.ts` (`freshPoll` fixture import line 1, `[1-9]\d*` regex line 56, `[@smoke]` tag line 22) [VERIFIED: direct read]
- `e2e/tests/filter-search.spec.ts` (`E2E_TITLE` constant lines 9-10, `toHaveCount(1)` line 86, `[@smoke]` tag line 28) [VERIFIED: direct read]
- `e2e/playwright.config.ts` (list + html reporters) [VERIFIED: direct read]
- `e2e/global-setup.ts` (`freshPoll` fixture cleanup, marker `description='freshPoll fixture row'`) [VERIFIED: direct read]
- `.planning/milestones/v1.1-phases/07-observability-hardening/artifacts/sourcemap-names-excerpt.txt` (Rolldown literal-declaration baseline) [VERIFIED: direct read]
- `package.json` scripts + `@sentry/react@10.49.0`, `@sentry/vite-plugin@5.2.0`, `@playwright/test@1.59.1` [VERIFIED: direct read]
- `gh issue view 11/12/13/17/19` (all confirmed OPEN at research time) [VERIFIED: gh CLI]
- `git log` on `e2e/tests/*.spec.ts`, `src/main.tsx`, `vite.config.ts`, `src/components/debug/RenderThrowSmoke.tsx` (fix-landing commits) [VERIFIED: git CLI]

### Secondary (MEDIUM confidence — WebSearch results)

- [Sentry Dedupe Integration docs](https://docs.sentry.io/platforms/javascript/configuration/integrations/dedupe/) — Dedupe compares stacktrace + fingerprint + message.
- [Sentry React Error Boundary docs](https://docs.sentry.io/platforms/javascript/guides/react/features/error-boundary/) — React 19 root-level hooks (`onUncaughtError`/`onCaughtError`/`onRecoverableError`) integrate with `Sentry.reactErrorHandler`.
- [Sentry React 19 Support changelog](https://sentry.io/changelog/react-19-support/) — confirms React 19 capture path semantics.
- [Sentry Spike Protection docs](https://docs.sentry.io/pricing/quotas/spike-protection/) — minute-based rate cap behavior.
- [Sentry CLI Configuration docs](https://docs.sentry.io/cli/configuration/) — `SENTRY_AUTH_TOKEN` requirement.
- [Sentry API Permissions & Scopes](https://docs.sentry.io/api/permissions/) — `project:read` / `project:releases` / `org:read` scope guidance.

### Tertiary (LOW confidence)

None — no claims in this research rest exclusively on unverified WebSearch hits without official-doc cross-reference.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version verified against `package.json`.
- Architecture (smoke harness shape): HIGH — existing route file inspected; query-param extension is the established pattern.
- Architecture (CI wiring): HIGH — `ci.yml` read in full; lack of build step in `lint-and-unit` is direct observation.
- Pitfalls: HIGH for Pitfalls 1/2/4/5/7/8 (all derived from project files or canonical Sentry docs); MEDIUM for Pitfall 3 (spike-protection thresholds are general, not per-project) and Pitfall 6 (env-var behavior derived from `import.meta.env` semantics).
- Sentry CLI auth-token scope: MEDIUM — WebSearch consensus; planner should verify with `sentry-cli info` during plan execution if a scope error appears.
- Netlify deploy-preview env-var inheritance: LOW — flagged as Open Question #3; planner must confirm in Netlify UI before relying on it.

**Research date:** 2026-05-17
**Valid until:** 2026-06-16 (30 days — stable verify-and-close domain, no upstream Sentry SDK major release imminent)
