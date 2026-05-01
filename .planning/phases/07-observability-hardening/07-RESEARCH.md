# Phase 7: Observability Hardening - Research

> **AMENDED 2026-04-30 — empirical correction from PR #21 deploy-preview verification:**
> This research repeatedly states that Rolldown's `keepNames: true` "injects a `__name(fn, 'orig')` helper" (modeled on esbuild's keepNames idiom). **Empirically this is wrong for Rolldown's Oxc minifier** — `grep -c '__name(' dist/assets/*.js` returns `0` even when keepNames works correctly. Rolldown preserves names by leaving literal `function Name(...)` declarations in the output (verified at release SHA `72481f0`: 48 unique `function PascalCase(` declarations in the main bundle, including `function RootLayout`, `function AppErrorFallback`, `function RenderThrowSmoke`, etc.). Sourcemap `names[]` arrays still work (the smoke chunk's `.js.map` `names[]` contains `RenderThrowSmoke` and `SmokePage`). The Sentry deploy-preview event captured at `2026-04-30T09:20:52Z` confirms keepNames works end-to-end (un-mangled stack frames). All `__name(` references below are superseded by the Rolldown-correct literal-function-declaration assertion documented in `.planning/phases/07-observability-hardening/artifacts/__name-grep.txt`. The historical analysis below is preserved for context.

**Researched:** 2026-04-29
**Domain:** React 19 error capture path + Vite 8 / Rolldown sourcemap symbolication for Sentry
**Confidence:** HIGH (canonical research already locked in v1.1-SENTRY-ERRORBOUNDARY.md and v1.1-VITE-SOURCEMAPS.md; this phase research validates project-local conventions and answers the 10 unlocked questions in the spawn brief)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Smoke component lifecycle**
- **D-01:** `RenderThrowSmoke` is a permanent observability canary, not a one-shot. Stays in the repo long-term so future regressions to the Sentry capture path or sourcemap function-name preservation can be re-detected with a single deploy-preview click.
- **D-02:** Lives at a dedicated TanStack route `/__smoke` (not piggybacked on `/` or another user-facing route). The route reads search param `render` and renders the throw component when `render=1`. Stable, ops-friendly URL; no risk of being lost in a future home-route refactor.
- **D-03:** Smoke component is lazy-loaded via TanStack `autoCodeSplitting` (already enabled in `vite.config.ts`). The smoke chunk only downloads when someone visits `/__smoke?render=1` — zero cost on the home-page bundle and no impact on the OBSV-02 bundle-size delta math.

**Smoke trigger gating**
- **D-04:** Trigger is env-gated to non-production builds (Netlify deploy previews + local dev). Live prod (`polls.wtcsmapban.com`, the `production` Netlify context) suppresses the throw so drive-by traffic cannot pollute Sentry or burn free-tier event quota.
- **D-05:** Gate signal is `import.meta.env.VITE_NETLIFY_CONTEXT`, populated from Netlify's built-in `CONTEXT` env var (one of `production` / `deploy-preview` / `branch-deploy` / `dev`). The smoke route allows the throw when `VITE_NETLIFY_CONTEXT !== 'production'`. Env var must be exposed in `netlify.toml` (or wired through Vite config) so it's present at build time.
- **D-06:** Live-prod requests to `/__smoke?render=1` return TanStack's standard 404 / not-found page. Route appears not to exist; zero discoverable attack surface.

**Verification approach**
- **D-07:** Verification is manual, one-shot, on the Phase 7 PR's Netlify deploy preview. No Playwright spec wired in this phase.
- **D-08:** Evidence required (all four MUST land in `07-VERIFICATION.md`):
  1. Sentry event screenshot showing populated `componentStack` and `tags.boundary === 'app-root'` (proves OBSV-01 capture path).
  2. Sentry event screenshot showing top stack frames with un-mangled names (proves OBSV-02 symbolication).
  3. Sentry event permalink + the release SHA the event was captured under, both pinned in VERIFICATION.md.
  4. Built `dist/assets/*.js.map` `names[]` excerpt (via `jq -r '.names[]'`) + literal-function-declaration grep output (`grep -lE 'function (RootLayout|AppErrorFallback|RenderThrowSmoke|SmokePage)\b' dist/assets/*.js`) proving `keepNames: true` mechanically took effect — Rolldown's Oxc minifier preserves names via literal `function Name(...)` declarations (NOT esbuild's `__name(fn,'orig')` helper; see amendment banner above).
- **D-09:** Solo sign-off (Khai).
- **D-10:** Screenshots/binary artifacts archive to `.planning/phases/07-observability-hardening/artifacts/`. Large blobs (>1MB) may be `.gitignore`-d; permalink + `.map`/grep text excerpts must be committed.

**Bundle-size evidence format**
- **D-11:** OBSV-02 bundle-size delta evidence lives in a dedicated `.planning/closure/OBSV-02-bundle-delta.md` doc (mirrors v1.1's UIDN-02/UIDN-03 closure-evidence pattern).
- **D-12:** Measurement granularity: total gzip delta + per-chunk gzip table. Capture build output for `main` (baseline, no `keepNames`) and the Phase 7 branch.
- **D-13:** Measurement tool: Vite/Rolldown's built-in build output table.
- **D-14:** Overage policy: if total gzip delta exceeds the ≤1.5% target, document actual number + ship anyway. Closure doc records target, actual delta, and one-line rationale.

### Claude's Discretion
- File names/paths inside `src/` (e.g., `src/routes/[__smoke].tsx` vs `src/routes/__smoke/index.tsx`; `src/components/debug/RenderThrowSmoke.tsx`). Researcher/planner pick what fits existing route-tree convention.
- Exact wording / structure of the dev-only `console.warn` inside `onUncaughtError`.
- How to expose `CONTEXT` from Netlify into Vite at build time (`netlify.toml` `[build.environment]` block vs Netlify dashboard env vars vs Vite `define`).
- Whether to add a small `tags: { smoke: true }` to smoke-triggered Sentry events for filtering. Optional, planner's call.

### Deferred Ideas (OUT OF SCOPE)
- Playwright automation of `/__smoke` flow + Sentry MCP `search_events` polling — deferred to Phase 8 only if it organically fits.
- LHCI / CI bundle-size gate on `keepNames` overage — deferred to v1.2.
- Sentry alert rules / dashboards / PII scrubbing tuning — own future phase if/when scale demands it.
- Token-gated smoke (URL secret) so the smoke could fire on prod too — considered and rejected.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OBSV-01 | Sentry captures render-phase errors via the Sentry transport — wire `Sentry.reactErrorHandler()` into React 19's `createRoot({ onCaughtError, onUncaughtError, onRecoverableError })`; keep `Sentry.ErrorBoundary` for fallback UI; add belt-and-suspenders manual `Sentry.captureException` in `onError`. Verified by a render-throw smoke component on a Netlify deploy preview (NOT dev — StrictMode masks). | Standard Stack §1; Architecture Pattern 1 (createRoot wiring); Code Example §A; Common Pitfall 1 (StrictMode masking); Validation Architecture row REQ-OBSV-01. |
| OBSV-02 | Production Sentry stack frames show original function names — set `build.rolldownOptions.output.keepNames: true` in `vite.config.ts`. Verified by inspecting a built `.map`'s `names[]` array (via `jq -r '.names[]'`) AND confirming literal preserved `function Name(...)` declarations in chunks (`grep -lE 'function (RootLayout|AppErrorFallback|RenderThrowSmoke)\b' dist/assets/*.js`) — Rolldown's Oxc minifier preserves names via literal declarations, NOT via esbuild's `__name(fn,'orig')` helper (see amendment banner). Bundle-size delta documented. | Standard Stack §2; Architecture Pattern 2 (rolldownOptions escape hatch); Code Example §B; Common Pitfall 2 (Oxc default minifier); Validation Architecture row REQ-OBSV-02. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Locked stack** — Vite 8 + React 19 + TanStack Router + TypeScript + Sentry + Netlify free tier. No alternatives.
- **Budget** — $0/month. No new paid services. No new CI minutes (LHCI/bundle-gate deferred to v1.2 explicitly).
- **GSD workflow enforcement** — direct file edits outside a GSD command are forbidden unless user explicitly bypasses. Phase 7 work is under `/gsd-execute-phase`.
- **TypeScript strict** — `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true` (per tsconfig.app.json). New code (smoke route, smoke component, main.tsx edits) must compile cleanly under these flags. In particular, `verbatimModuleSyntax: true` requires explicit `type` keyword on type-only imports (e.g., `import { type ErrorInfo } from 'react-dom/client'`).
- **ESLint flat config** — `eslint.config.js` already in place; existing routes use `/* eslint-disable react-refresh/only-export-components */` at the top of each route file (TanStack file-route pattern). New `[__smoke].tsx` follows the same convention.
- **Naming patterns** — kebab-case for kebab-cased filenames, PascalCase components. The smoke file naming aligns with the `__root.tsx` precedent (double-underscore prefix for non-user-facing routes).

## Summary

Phase 7 is two **localised, low-risk** config/wiring fixes plus a permanent canary route for re-runnable verification.

1. **OBSV-01** rewrites the `createRoot(...)` call in `src/main.tsx` so it passes the React 19 error hooks (`onUncaughtError` / `onCaughtError` / `onRecoverableError`) wired through `Sentry.reactErrorHandler()`. The existing `Sentry.ErrorBoundary` stays as the fallback-UI carrier and gains an `onError` belt that calls `Sentry.captureException` directly with `tags.boundary='app-root'` and `contexts.react.componentStack`. Without the hooks, React 19 swallows caught render errors to the console and Sentry's transport never sees them — Phase 6 confirmed this empirically (only `setTimeout`/`onerror` mechanism types ever landed).

2. **OBSV-02** adds `build.rolldownOptions.output.keepNames: true` to `vite.config.ts`. Vite 8's default minifier flipped to Oxc, which mangles top-level + nested identifiers down to two-letter names (`handleResponseSubmit` → `xR`). Sentry's symbolicator tokenizes backward from the (line,col) marker and uses the **bundled** identifier as the lookup key, so `xR` is what surfaces in the UI. `keepNames: true` injects a `__name(fn,'orig')` helper that restores `Function.prototype.name`; `Error.stack` then reports the original name. Bundle-size cost is ~0.5–1.5% gzip per analog research.

3. The verification surface is a permanent `RenderThrowSmoke` component lazy-loaded under a dedicated `/__smoke` TanStack file route. The route is env-gated by `VITE_NETLIFY_CONTEXT` (re-exported from Netlify's built-in `CONTEXT` env var via `netlify.toml`); on production it returns the TanStack 404, on deploy-preview/branch-deploy/dev it accepts `?render=1` and renders the throw.

**Primary recommendation:** Plan three task groups — (1) `vite.config.ts` + `netlify.toml` + main.tsx wiring (OBSV-01 + OBSV-02 implementation), (2) smoke route + component (verification surface), (3) manual deploy-preview verification + closure-doc + bundle-delta evidence. Group 1 unblocks group 3; group 2 can run in parallel with group 1.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| React 19 root error capture (OBSV-01) | Browser / Client (`src/main.tsx`) | — | Render-phase errors only exist in the React reconciler, which lives in the browser. The Sentry SDK's `reactErrorHandler` is a client-side wrapper around `captureException`. No server-side surface. |
| Sentry transport (HTTP envelope) | Browser / Client (Sentry SDK) | Sentry SaaS (out-of-process) | The Sentry JS SDK runs entirely in the browser; events POST to `*.ingest.sentry.io` over HTTPS. Already wired in Phase 5 (Sentry.init). Phase 7 only routes the right errors INTO this transport. |
| Sourcemap symbolication evidence (OBSV-02) | Build-time (Vite + Rolldown + sentryVitePlugin) | Sentry SaaS (debug-id matching) | Function-name preservation happens at bundle time (Rolldown injects `__name` calls). Sentry uploads `.map` files at build time, then matches debug-IDs server-side when an event arrives. The browser only ships the unmodified runtime stack — server does the un-mangling. |
| Smoke trigger gating (`VITE_NETLIFY_CONTEXT`) | Build-time (Vite `import.meta.env`) | Browser / Client (route guard) | `VITE_*` env vars are statically inlined at build time; the runtime `if (...)` check in the route is a constant after build. Netlify injects `CONTEXT` into the build environment. |
| Smoke route 404 fallback (live-prod) | Browser / Client (TanStack Router) | — | TanStack Router resolves routes client-side; the file route either renders the smoke component or returns the configured `notFoundComponent`. No server involvement. |
| Build artifact production (dist/*.js + dist/*.js.map) | Build-time (Netlify CI) | — | Standard SPA static-asset pipeline. Already correct from Phase 5/6; Phase 7 only changes one Rolldown output flag. |

## Standard Stack

### Core (already in package.json — no installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sentry/react` | 10.49.0 | React-aware Sentry SDK (provides `reactErrorHandler`, `ErrorBoundary`, `captureException`) | Official SDK; `reactErrorHandler` was added in v8.6.0 specifically for React 19 hooks. [VERIFIED: package.json line "@sentry/react": "10.49.0"] |
| `@sentry/vite-plugin` | 5.2.0 | Build-time sourcemap upload + debug-ID injection | Already configured correctly in Phase 5/6. DO NOT touch. [VERIFIED: package.json line "@sentry/vite-plugin": "5.2.0"] |
| `@tanstack/react-router` | 1.168.10 | File-based router; provides `createFileRoute`, `notFound()`, `notFoundComponent`, lazy code-splitting | Already in use; auto-codeSplitting is already enabled in `vite.config.ts`. [VERIFIED: package.json + vite.config.ts] |
| `@tanstack/router-plugin` | 1.167.12 | Vite plugin that regenerates `routeTree.gen.ts` whenever a file in `src/routes/` changes | Already in `vite.config.ts` plugins array. [VERIFIED: vite.config.ts line 5; package.json] |
| `@tanstack/router-cli` | 1.166.25 | `tsr generate` CLI used in `npm run build` script | Already in build pipeline (`tsr generate && tsc -b && vite build`). [VERIFIED: package.json scripts.build] |
| `vite` | 8.0.5 | Build tool. Vite 8 ships Rolldown bundler + Oxc minifier by default. | Already pinned. `build.rolldownOptions.output.keepNames` is the documented Vite 8 escape hatch. [VERIFIED: package.json + Context7 /vitejs/vite/v8.0.7 build.rolldownOptions docs] |
| `react` / `react-dom` | 19.2.4 | React 19 introduces `onUncaughtError`/`onCaughtError`/`onRecoverableError` on `createRoot` | The whole point. [VERIFIED: package.json line "react": "19.2.4"] |

**No new dependencies required.** Phase 7 is a pure config/wiring change.

### Supporting (existing, reused)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/components/AppErrorFallback` | (project-local) | Existing fallback UI for `Sentry.ErrorBoundary` | Stays as `<AppErrorFallback />` `fallback` prop. No changes. |
| `@/contexts/ConsentContext` (`ConsentProvider`) | (project-local) | Wraps PostHog/Sentry Replay opt-IN gating | Smoke errors go via `Sentry.captureException` (transport), NOT Replay. Untouched. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Sentry.reactErrorHandler` on all 3 hooks | Wire only `onCaughtError`, leave `onUncaughtError`/`onRecoverableError` unwired | Loses uncaught errors that escape the boundary entirely + recoverable hydration errors. Sentry official guidance and v1.1-SENTRY-ERRORBOUNDARY.md TL;DR explicitly recommend all three. |
| `keepNames: true` on Rolldown output | `mangle.keep_fnames: true` on Oxc minifier directly | `keepNames` is the Rolldown-level fix that injects `__name(fn, 'orig')` helper — preserves `Function.prototype.name` even after Oxc rewrites the local var. `mangle.keep_fnames` only stops one mangler pass; the Rolldown collision-rename pass before minify still rewrites `function test()` → `function test$1()`. v1.1-VITE-SOURCEMAPS.md flags this as "belt-and-suspenders only if `keepNames` proves insufficient". |
| Netlify dashboard env var for `VITE_NETLIFY_CONTEXT` | `netlify.toml` `[build.environment]` block re-exporting `$CONTEXT` | Dashboard env vars are literal strings — they cannot reference `$CONTEXT` for runtime expansion. The build command shell substitution (mirroring the existing `VITE_COMMIT_SHA=$COMMIT_REF` pattern in `[build]` command) is the only way to capture the per-deploy context value. [VERIFIED: existing netlify.toml `command = "npm ci && VITE_COMMIT_SHA=$COMMIT_REF npm run build"` precedent] |

**Installation:**

```bash
# No installs. All required deps are already in package.json.
```

**Version verification:** All package versions confirmed against the project's pinned `package.json` (committed lockfile present). No registry lookups required since no new packages are installed; the recommended fixes are config edits to existing tooling.

## Architecture Patterns

### System Architecture Diagram

```
                       ┌──────────────────────────────────────┐
                       │ Netlify build env                    │
                       │   CONTEXT=deploy-preview / production│
                       └──────────────┬───────────────────────┘
                                      │ shell expansion in
                                      │ netlify.toml [build] command
                                      ▼
                  ┌────────────────────────────────────────────┐
                  │ vite build  (npm run build)                │
                  │   • tanstackRouter plugin → routeTree.gen  │
                  │   • react plugin                           │
                  │   • tailwindcss plugin                     │
                  │   • sentryVitePlugin (LAST — uploads .map) │
                  │   • rolldownOptions.output.keepNames=true ◄── OBSV-02 fix
                  │   • build.sourcemap='hidden'               │
                  └──────────────┬─────────────────────────────┘
                                 │
                                 ▼
                       ┌─────────────────────┐
                       │ dist/assets/*.js    │  (chunks contain `__name(fn,'orig')`)
                       │ dist/assets/*.js.map│  (uploaded → deleted after upload)
                       └─────────┬───────────┘
                                 │ deploy
                                 ▼
              ┌─────────────────────────────────────┐
              │ Browser (Netlify CDN)               │
              │ ┌─────────────────────────────────┐ │
              │ │ src/main.tsx                    │ │
              │ │  Sentry.init(...)               │ │
              │ │  createRoot(container, {        │ │
              │ │    onUncaughtError:  ─────────┐ │ │
              │ │    onCaughtError:    ─────────┼─┼─┼──► Sentry.reactErrorHandler ──► Sentry envelope
              │ │    onRecoverableError:────────┘ │ │           (mechanism.type =
              │ │  }).render(                     │ │            'react.errorboundary'
              │ │    <Sentry.ErrorBoundary        │ │            or 'generic')
              │ │       onError={…captureException│ │ ──────►  ─────────► Sentry SaaS
              │ │            tags.boundary:       │ │
              │ │            'app-root',          │ │ ──────► (Dedupe integration
              │ │            contexts.componentSt │ │            suppresses dup)
              │ │       fallback={AppErrorFallback│ │
              │ └────┬───────────────────────────┘ │
              │      │ TanStack Router             │
              │      ▼                             │
              │ ┌─────────────────────────────────┐│
              │ │ /__smoke route (lazy chunk)     ││
              │ │  if VITE_NETLIFY_CONTEXT==='prod│││ ──► throw notFound() → 404 page
              │ │  else if search.render === '1' ││
              │ │    <RenderThrowSmoke /> ────────┼┼─► throws in render → caught by
              │ │                                 ││    Sentry.ErrorBoundary →
              │ │                                 ││    onCaughtError + onError fire
              │ └─────────────────────────────────┘│
              └─────────────────────────────────────┘
```

### Component Responsibilities

| File | Responsibility | Phase 7 Action |
|------|----------------|----------------|
| `src/main.tsx` | App bootstrap; Sentry.init; createRoot; ErrorBoundary | **Modify** — add `createRoot` options + `onError` belt. DO NOT touch `Sentry.init` block. |
| `vite.config.ts` | Build config | **Modify** — add `rolldownOptions.output.keepNames: true` under existing `build:` block. DO NOT touch `sentryVitePlugin` config or `build.sourcemap: 'hidden'`. |
| `netlify.toml` | Netlify build env | **Modify** — re-export `CONTEXT` as `VITE_NETLIFY_CONTEXT` in the `[build] command` (mirrors existing `VITE_COMMIT_SHA=$COMMIT_REF` pattern). |
| `src/routes/[__smoke].tsx` | Env-gated smoke route | **Create** — flat-file convention (matches `topics.tsx`, `archive.tsx`); declares `Route` via `createFileRoute('/__smoke')`. |
| `src/components/debug/RenderThrowSmoke.tsx` | Render-phase throw | **Create** — colocated with existing `src/components/debug/DebugAuthOverlay.tsx`. |
| `src/components/AppErrorFallback.tsx` | Fallback UI | **Untouched** — already wired. |
| `src/routeTree.gen.ts` | Auto-generated route tree | **Auto-regenerated** — `npm run build` runs `tsr generate` first, so adding `src/routes/[__smoke].tsx` auto-updates this file. Reviewer should expect a diff here too; commit it (file is currently committed, not gitignored). |
| `.planning/phases/07-observability-hardening/07-VERIFICATION.md` | Phase closure evidence | **Create** — Sentry screenshots + permalink + .map excerpt. |
| `.planning/closure/OBSV-02-bundle-delta.md` | Bundle-size closure | **Create** — total + per-chunk gzip table. |

### Recommended Project Structure (delta only — keep all existing structure)

```
src/
├── main.tsx                            # MODIFIED: createRoot options + onError belt
├── routes/
│   ├── __root.tsx                      # untouched
│   ├── [__smoke].tsx                   # NEW (flat-file convention; bracket-escaped per D-02 to keep the literal /__smoke segment)
│   ├── index.tsx                       # untouched
│   ├── topics.tsx                      # untouched
│   └── archive.tsx                     # untouched
└── components/
    └── debug/
        ├── DebugAuthOverlay.tsx        # untouched
        ├── snapshotBreadcrumbs.ts      # untouched
        └── RenderThrowSmoke.tsx        # NEW
vite.config.ts                          # MODIFIED: build.rolldownOptions.output.keepNames
netlify.toml                            # MODIFIED: VITE_NETLIFY_CONTEXT in [build] command
.planning/closure/
└── OBSV-02-bundle-delta.md             # NEW
.planning/phases/07-observability-hardening/
├── 07-VERIFICATION.md                  # NEW
└── artifacts/                          # NEW (screenshots; large blobs gitignore-able)
```

### Pattern 1: React 19 root error hooks + ErrorBoundary belt

**What:** Wire `Sentry.reactErrorHandler()` into all three React 19 error hooks on `createRoot`, then keep `Sentry.ErrorBoundary` for fallback-UI rendering with an `onError` belt that calls `Sentry.captureException` directly. The hooks route render-phase errors that React's reconciler catches; the boundary renders the fallback; the belt is defense-in-depth.

**When to use:** App entry point that's already on React 19 + `@sentry/react` v8.6+ (we are on 10.49). No SSR (we're SPA-only via TanStack Router), so `createRoot` is the correct constructor — `hydrateRoot` does not apply.

**Example:**

```tsx
// Source: Context7 /getsentry/sentry-javascript — packages/react/README.md
//         "Configure React 19 Error Hooks with Sentry"
//         + .planning/research/v1.1-SENTRY-ERRORBOUNDARY.md "Recommended fix"

import { StrictMode } from 'react'
import { createRoot, type ErrorInfo } from 'react-dom/client'
import * as Sentry from '@sentry/react'

const container = document.getElementById('root')
if (!container) throw new Error('Root container missing')

createRoot(container, {
  onUncaughtError: Sentry.reactErrorHandler((error, info: ErrorInfo) => {
    if (import.meta.env.DEV) {
      console.warn('[sentry] uncaught', error, info.componentStack)
    }
  }),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={<AppErrorFallback />}
      showDialog={false}
      onError={(error: unknown, componentStack: string, eventId: string): void => {
        Sentry.captureException(error, {
          tags: { boundary: 'app-root', eventId },
          contexts: { react: { componentStack } },
        })
      }}
    >
      {/* …existing PostHogProvider → ConsentProvider → RouterProvider tree… */}
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
```

Notes specific to this project:

- `verbatimModuleSyntax: true` in `tsconfig.app.json` requires the explicit `type` keyword on `ErrorInfo` import. [VERIFIED: tsconfig.app.json + node_modules/@types/react-dom/client.d.ts line 57 — `export interface ErrorInfo`]
- `noUnusedLocals: true` — keep the `info` parameter named (it's read by `console.warn`).
- The existing comment-density convention in `src/main.tsx` ("HIGH #1 (codex review)…", "Phase 6 D-04…") should continue. New code blocks should cite "Phase 7 OBSV-01" + the canonical research path.

### Pattern 2: Vite 8 / Rolldown `keepNames` + sourcemap contract

**What:** Add `build.rolldownOptions.output.keepNames: true` so Rolldown emits a `__name(fn, 'orig')` helper that restores `Function.prototype.name` after Oxc minify. Stack frames carry the original name; Sentry's symbolicator surfaces the correct identifier.

**When to use:** Vite 8+ with default Oxc minifier and Sentry sourcemap upload pipeline. Both apply here.

**Example:**

```ts
// Source: Context7 /vitejs/vite/v8.0.7 build.rolldownOptions docs
//       + Context7 /rolldown/rolldown output-keep-names.md
//       + .planning/research/v1.1-VITE-SOURCEMAPS.md "Recommended fix"

export default defineConfig(({ mode }) => ({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    sentryVitePlugin({ /* untouched */ }),
  ],
  build: {
    sourcemap: 'hidden',
    // Phase 7 OBSV-02: preserve original function/class .name so Sentry stack
    // frames show source identifiers instead of mangled `xR`/`$M`. Rolldown
    // injects a __name(fn, 'orig') helper; Function.prototype.name then
    // survives Oxc's mangler (Vite 8 default).
    // Research: .planning/research/v1.1-VITE-SOURCEMAPS.md
    rolldownOptions: {
      output: { keepNames: true },
    },
  },
  // ...
}))
```

### Pattern 3: TanStack file-route flat-file convention

**What:** Routes live in `src/routes/<name>.tsx` (flat-file). The `tanstackRouter` Vite plugin and `tsr generate` CLI both walk this directory and emit `src/routeTree.gen.ts`.

**When to use:** Always, in this project. Confirmed by inspection — every existing route uses this pattern:

```
src/routes/__root.tsx       (root layout)
src/routes/index.tsx        (/)
src/routes/topics.tsx       (/topics)
src/routes/archive.tsx      (/archive)
src/routes/admin/index.tsx  (/admin/)
src/routes/auth/callback.tsx (/auth/callback)
```

So the smoke route is `src/routes/[__smoke].tsx` (flat-file), not `src/routes/__smoke/index.tsx` (directory). The `__` prefix mirrors `__root.tsx` — signals "non-user-facing".

**Example:**

```tsx
// Source: existing src/routes/topics.tsx structural analog
//       + Context7 /tanstack/router file-route + notFoundComponent docs
//       + .planning/phases/07-observability-hardening/07-CONTEXT.md D-02..D-06

/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, notFound } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

interface SmokeSearch {
  render?: '1'
}

// Lazy-load the throw component so it's in its own chunk (TanStack
// autoCodeSplitting is already enabled in vite.config.ts — Phase 7 D-03).
const RenderThrowSmoke = lazy(() =>
  import('@/components/debug/RenderThrowSmoke').then(m => ({ default: m.RenderThrowSmoke }))
)

export const Route = createFileRoute('/__smoke')({
  validateSearch: (search: Record<string, unknown>): SmokeSearch => {
    return search.render === '1' ? { render: '1' } : {}
  },
  // Phase 7 D-06: live prod returns standard 404 — appears not to exist.
  beforeLoad: () => {
    if (import.meta.env.VITE_NETLIFY_CONTEXT === 'production') {
      throw notFound()
    }
  },
  component: SmokePage,
})

function SmokePage() {
  const { render } = Route.useSearch()
  if (render !== '1') {
    return (
      <p className="text-sm text-muted-foreground">
        Smoke route. Append <code>?render=1</code> to trigger a render-phase throw.
      </p>
    )
  }
  return (
    <Suspense fallback={null}>
      <RenderThrowSmoke />
    </Suspense>
  )
}
```

### Pattern 4: TanStack notFound() → root notFoundComponent

**What:** `throw notFound()` from a route's `beforeLoad`/`loader` causes TanStack Router to walk up to the nearest `notFoundComponent` (or `defaultNotFoundComponent` on the router). This project does **not** currently configure either. The router falls back to TanStack's basic default 404.

**When to use:** D-06 ("live-prod returns standard TanStack 404"). The basic default is acceptable — 0 LOC of new UX work and the requirement is "appears not to exist", not "renders a branded 404".

**Pattern:**

```tsx
// Source: Context7 /tanstack/router not-found-errors.md
import { createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/__smoke')({
  beforeLoad: () => {
    if (import.meta.env.VITE_NETLIFY_CONTEXT === 'production') {
      throw notFound()
    }
  },
  // ...
})
```

If the planner decides a branded 404 is in scope (it isn't per CONTEXT.md), the upgrade path is to add `notFoundComponent: () => <NotFoundPage />` on `src/routes/__root.tsx` — that single change covers every route. Out of scope for Phase 7.

### Pattern 5: Render-phase throw component

**What:** A component whose `function` body unconditionally throws — fires during render, not in an event handler. Event-handler throws hit `globalHandlersIntegration` and would mask the React 19 hooks test (per CONTEXT.md `<specifics>`).

**Example:**

```tsx
// Source: .planning/research/v1.1-SENTRY-ERRORBOUNDARY.md "Smoke verification"
//       + .planning/phases/07-observability-hardening/07-CONTEXT.md <specifics>

// Optional: tags: { smoke: true } on Sentry side is a planner discretion
// item. NOT applied here — the deterministic message string is sufficient
// for searching the Sentry UI.

export function RenderThrowSmoke(): never {
  throw new Error(
    'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'
  )
}
```

### Pattern 6: Netlify build-env shell substitution → `import.meta.env`

**What:** Vite only inlines env vars that start with `VITE_`. Netlify's built-in `CONTEXT` is **not** prefixed, so it must be re-exported in the build command (where shell substitution `$CONTEXT` works) — exactly like the existing `VITE_COMMIT_SHA=$COMMIT_REF` pattern.

**Why this beats `[build.environment]` static var:** A `[build.environment]` block sets literal strings only — it cannot reference `$CONTEXT` for runtime expansion (Netlify does not re-evaluate `$CONTEXT` inside that block). The build-command shell **does** evaluate it.

**Example diff:**

```diff
# netlify.toml
 [build]
-  command = "npm ci && VITE_COMMIT_SHA=$COMMIT_REF npm run build"
+  # Phase 7 D-05: re-export Netlify's built-in $CONTEXT as VITE_NETLIFY_CONTEXT
+  # so the smoke route at /__smoke can env-gate the render-phase throw.
+  # Mirrors the existing VITE_COMMIT_SHA=$COMMIT_REF pattern.
+  command = "npm ci && VITE_COMMIT_SHA=$COMMIT_REF VITE_NETLIFY_CONTEXT=$CONTEXT npm run build"
   publish = "dist"
```

For local dev (`npm run dev`), `VITE_NETLIFY_CONTEXT` is `undefined`. The route guard `if (VITE_NETLIFY_CONTEXT === 'production')` evaluates false → smoke is reachable in dev. That matches D-04 ("Netlify deploy previews + local dev").

### Anti-Patterns to Avoid

- **Smoke throw in an event handler.** Hits `globalHandlersIntegration` (mechanism.type = `auto.browser.global_handlers.onerror`), masking whether the React 19 hooks actually wired correctly. Use a render-phase throw.
- **Removing `Sentry.ErrorBoundary` once hooks are wired.** Per Sentry React 19+ guidance: "While these hooks provide a convenient way to capture errors, it is recommended to use an ErrorBoundary component for caught errors to maintain finer control over the user experience and error reporting." [CITED: Context7 /getsentry/sentry-javascript packages/react/README.md "Official Sentry SDK for ReactJS > React 19"]. The fallback UI is the user-facing benefit.
- **Touching `Sentry.init` to add `mechanism` filtering.** Out of scope. Phase 6 already shipped the correct `Sentry.init` block.
- **Using `[build.environment]` static block for `VITE_NETLIFY_CONTEXT = "$CONTEXT"`.** Netlify will literal-string-set the value to `"$CONTEXT"`, not the expansion. The build command shell is the only correct place.
- **Verifying in `vite dev` or Vitest.** StrictMode in dev rethrows caught errors → `globalHandlersIntegration` catches them and `react.errorboundary` mechanism never appears. The minifier doesn't even run. Roadmap criterion #5 is explicit on this.
- **Skipping `tsr generate` after adding `[__smoke].tsx`.** `npm run build` runs it first, but iterating with `tsc -b` alone will fail until `routeTree.gen.ts` includes the new route.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| React 19 render-error → Sentry transport | Custom `try/catch` wrapper around the entire app, manual `Sentry.captureException` calls in every component | `Sentry.reactErrorHandler()` on the three `createRoot` hooks + existing `Sentry.ErrorBoundary` | The handler returns a properly-typed React-side handler that sets `mechanism.handled` and `mechanism.type` correctly so Sentry-side dedup + grouping work. Hand-rolled equivalents would miss `componentStack` enrichment and the `mechanism` shape. |
| Function-name preservation in minified bundles | Custom Babel/SWC plugin to rewrite `function foo() {}` → `Object.defineProperty(foo, 'name', { value: 'foo' })` | Rolldown's built-in `output.keepNames: true` (one line) | Rolldown ships a tested `__name` helper, gzip-dedupes the helper string, and integrates with the sourcemap `names[]` array. Anything custom would have to re-implement the static analysis Rolldown already does. |
| Build-time access to deploy context | Custom JS shim that fetches `/_redirects` or pings the deploy URL at runtime | Netlify's built-in `$CONTEXT` env var re-exported via `VITE_NETLIFY_CONTEXT` | `$CONTEXT` is the canonical source of truth Netlify already populates. Shell substitution + `VITE_*` prefix is the standard Vite mechanism. |
| Sentry sourcemap upload + debug-IDs | Custom CI step that uploads `.map` files via the Sentry HTTP API | `@sentry/vite-plugin` 5.2.0 (already configured Phase 5/6) | Plugin handles debug-ID injection, sourcemap upload, and post-upload deletion so `.map` files don't leak in `dist/`. DO NOT touch in Phase 7. |
| TanStack Router 404 page | Custom redirect in `src/main.tsx` or in a route `beforeLoad` to `/404` | `throw notFound()` in `beforeLoad` → router walks to nearest `notFoundComponent` (or default) | TanStack's own pattern; preserves URL (no redirect), supports HTTP semantics for SSR (not applicable here but future-proof), and ships with a working default page. |
| Lazy-loading the smoke chunk | Manual dynamic import + Suspense everywhere | TanStack `autoCodeSplitting: true` (already enabled) + `lazy(() => import(...))` | Already enabled in `vite.config.ts` line 19. `import('@/components/debug/RenderThrowSmoke')` becomes its own chunk for free. |

**Key insight:** Phase 7 is almost entirely "delete code or add one line". The biggest temptation is to over-engineer the smoke route or the env gate — resist it. The `Sentry.reactErrorHandler` + `keepNames: true` + one-line netlify.toml shell substitution covers the entire requirements surface.

## Common Pitfalls

### Pitfall 1: Verifying in dev / StrictMode masks the capture path

**What goes wrong:** A developer wires the hooks, runs `npm run dev`, throws a render-phase error in a smoke component, and sees a Sentry event arrive. They claim victory. But what arrived has `mechanism.type === 'auto.browser.global_handlers.onerror'` — the hooks are NOT wired correctly; React's StrictMode rethrew the caught error to `window.onerror` and `globalHandlersIntegration` caught it.

**Why it happens:** In dev/StrictMode, React rethrows caught render errors to the global handler so the original throw site shows up in browser devtools. Production does NOT rethrow. So dev "passes" by accident.

**How to avoid:** Verify on a Netlify deploy preview only (production build). Roadmap success criterion #5 is explicit. Inspect `mechanism.type` in the Sentry event's "Additional Data" / "Mechanism" panel — at least one event MUST match the canonical PRIMARY allowlist defined in `07-VALIDATION.md` (`mechanism.type ∈ {auto.function.react.error_handler, auto.function.react.error_boundary}`); a companion `'generic'` event from the manual `onError` belt is the EXPECTED defense-in-depth fallback, not a standalone pass. Any `auto.browser.*` event is a FAILURE — see PARTIAL/FAILURE rules in `07-VALIDATION.md`.

**Warning signs:** Sentry event mechanism type contains `auto.browser` or `onerror`. Phase 6 SUMMARY.md "Deviation Rule 1" already documented this exact failure mode for the OBSV-01 baseline.

### Pitfall 2: Vite 8 `build.minify` default is `'oxc'`, not `'esbuild'`

**What goes wrong:** A developer assumes Vite 7 behavior, sets `build.minify: false` to "preserve names", then ships a 3 MB un-minified bundle.

**Why it happens:** Vite 8 docs explicitly state Oxc is the new default (`build.minify: 'esbuild'` is deprecated as a separate option). [CITED: Context7 /vitejs/vite/v8.0.7 build.minify docs]

**How to avoid:** Do NOT touch `build.minify`. Use `rolldownOptions.output.keepNames: true` — that's the documented Rolldown-side fix that lets Oxc keep mangling local vars while preserving `Function.prototype.name` via the `__name` helper.

**Warning signs:** Bundle size jumps by 100% — the minifier is off. Or `dist/assets/*.js` has readable code throughout (not just helper names).

### Pitfall 3: `verbatimModuleSyntax: true` rejects implicit type imports

**What goes wrong:** New `src/main.tsx` rewrite imports `ErrorInfo` from `react-dom/client` without the `type` keyword. TypeScript compile errors out: "Imported binding 'ErrorInfo' is used as a type, but is not imported with the 'type' modifier."

**Why it happens:** `tsconfig.app.json` has `verbatimModuleSyntax: true`. Combined with `erasableSyntaxOnly: true`, type-only imports must be syntactically explicit so the compiler can erase them.

**How to avoid:** `import { createRoot, type ErrorInfo } from 'react-dom/client'` — inline `type` keyword on the type-only re-export. Same convention as the existing TopicsSearch interface in `src/routes/topics.tsx`.

**Warning signs:** `tsc -b` errors during `npm run build` after the main.tsx rewrite.

### Pitfall 4: `routeTree.gen.ts` not regenerated → smoke route 404s on deploy

**What goes wrong:** Developer creates `src/routes/[__smoke].tsx`, commits, opens PR. CI builds, but the smoke route returns 404 even on the deploy preview because `routeTree.gen.ts` was not committed (or did not include the new route).

**Why it happens:** TanStack file-routes are NOT magic — they require codegen. Two paths regenerate the file:
1. The Vite plugin (`tanstackRouter({ ... })`) regenerates on file change during `vite dev` and `vite build`.
2. The `tsr generate` CLI runs at the start of `npm run build` (script: `"tsr generate && tsc -b && vite build"`).

So a CI build SHOULD regenerate. But if a developer iterates with `tsc --watch` or `vite dev` is not running, the local file may go stale and a manual edit could clobber it.

**How to avoid:** Always run `npm run build` (or at minimum `npm run generate` = `tsr generate`) after adding/removing route files. Confirm `src/routeTree.gen.ts` shows the new `__smoke` route imports before committing. CI will produce a clean diff if it differs.

**Warning signs:** Build succeeds but `/__smoke?render=1` 404s on the deploy preview — the route literally isn't registered.

### Pitfall 5: `onError` belt + React 19 hooks → duplicate Sentry events

**What goes wrong:** A render error fires `onCaughtError` (Sentry event #1 from `reactErrorHandler`), the error reaches `Sentry.ErrorBoundary` which fires `onError` (Sentry event #2 from manual `captureException`), and Sentry shows two events for one user-facing error.

**Why it happens:** React 19 routes the same error through both code paths. Without dedup, Sentry would store both.

**How to avoid:** Sentry's default `Dedupe` integration (active automatically — no `Sentry.init` change required) compares stack + message and suppresses near-duplicates. v1.1-SENTRY-ERRORBOUNDARY.md TL;DR explicitly notes: "The `onError` belt may dupe in dev/StrictMode; Sentry's default `Dedupe` integration suppresses." [CITED: .planning/research/v1.1-SENTRY-ERRORBOUNDARY.md]

The deduplication relies on stack-trace shape, not `eventId`, so the planner's optional `tags: { eventId }` on the manual `captureException` does not break dedup.

**Warning signs:** Two Sentry events from one smoke run with identical stacks. If observed, the planner can drop the `onError` belt (the React 19 hooks are sufficient on their own) — but defense-in-depth is preferred per CONTEXT.md `<domain>` "in scope".

[ASSUMED] The `Dedupe` integration is enabled by default in `@sentry/react` 10.49.0. Sentry docs and Context7 do not explicitly enumerate it as a v10 default in the snippets I retrieved. Phase 7 verification will surface a duplicate if this assumption is wrong; mitigation = drop the `onError` belt.

### Pitfall 6: Bundle-size baseline drift

**What goes wrong:** Developer measures the OBSV-02 bundle delta against `main` at one point in time, writes it up in `OBSV-02-bundle-delta.md`, but main has since gained an unrelated feature that adds 3% gzip — the recorded delta now overstates the `keepNames` cost.

**Why it happens:** v1.1 is the active milestone; main moves underneath the Phase 7 branch.

**How to avoid:** Take both measurements in the same session — checkout main, `npm run build`, capture vite output table; checkout phase-7 branch, `npm run build`, capture again. Diff is then attributable to `keepNames` only. [VERIFIED: this is the existing pattern from Phase 6 closure-evidence work — `.planning/closure/` already contains analogous before/after deltas per v1.1-SUMMARY.md "Closure-evidence pattern".]

**Warning signs:** Per-chunk delta has many chunks > 0 — that's keepNames hitting every chunk uniformly. If a few chunks deltas are wildly negative or zero while others are positive, baseline drift is suspected.

## Code Examples

### A. Full `src/main.tsx` rewrite (illustrative — planner produces canonical version)

```tsx
// Source: Context7 /getsentry/sentry-javascript "Configure React 19 Error Hooks with Sentry"
//       + .planning/research/v1.1-SENTRY-ERRORBOUNDARY.md "Recommended fix"
//       + existing src/main.tsx structure (Phase 6 D-04 ConsentProvider positioning,
//         M1 codex review Replay-attached-later note, etc. — all preserved)

import { StrictMode } from 'react'
import { createRoot, type ErrorInfo } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import * as Sentry from '@sentry/react'
import { PostHogProvider } from 'posthog-js/react'
import { initPostHog } from '@/lib/posthog'
import { ConsentProvider } from '@/contexts/ConsentContext'
import { AppErrorFallback } from '@/components/AppErrorFallback'
import { routeTree } from './routeTree.gen'
import './index.css'

// (existing Sentry.init + initPostHog + createRouter blocks — UNCHANGED)
Sentry.init({ /* existing config */ })
const posthog = initPostHog()
const router = createRouter({ routeTree })
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const container = document.getElementById('root')
if (!container) throw new Error('Root container missing')

// Phase 7 OBSV-01: React 19 createRoot error hooks. Without these, render-
// phase errors caught by React's reconciler hit React's default handler
// (console-only) and never reach Sentry's transport. Phase 6 confirmed this
// empirically — only setTimeout/onerror mechanisms landed.
// Research: .planning/research/v1.1-SENTRY-ERRORBOUNDARY.md
createRoot(container, {
  onUncaughtError: Sentry.reactErrorHandler((error, info: ErrorInfo) => {
    if (import.meta.env.DEV) {
      console.warn('[sentry] uncaught', error, info.componentStack)
    }
  }),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    {/* Phase 7 OBSV-01: onError belt is defense-in-depth — explicitly tags
        the event with boundary='app-root' and contexts.react.componentStack
        so Sentry triage can distinguish app-root catches from any future
        per-route boundaries. Sentry's Dedupe integration suppresses any
        duplicate produced when onCaughtError already fired. */}
    <Sentry.ErrorBoundary
      fallback={<AppErrorFallback />}
      showDialog={false}
      onError={(error: unknown, componentStack: string, eventId: string): void => {
        Sentry.captureException(error, {
          tags: { boundary: 'app-root', eventId },
          contexts: { react: { componentStack } },
        })
      }}
    >
      <PostHogProvider client={posthog}>
        <ConsentProvider>
          <RouterProvider router={router} />
        </ConsentProvider>
      </PostHogProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
```

### B. `vite.config.ts` diff for OBSV-02

```diff
   build: {
     sourcemap: 'hidden',
+    // Phase 7 OBSV-02: preserve original function/class .name so Sentry
+    // stack frames show source identifiers (e.g. handleResponseSubmit)
+    // instead of mangled `xR`/`$M`. Rolldown injects a __name(fn,'orig')
+    // helper; Function.prototype.name then survives Oxc's mangler (Vite 8
+    // default minifier). Bundle-size cost: ~0.5–1.5% gzip — measured in
+    // .planning/closure/OBSV-02-bundle-delta.md.
+    // Research: .planning/research/v1.1-VITE-SOURCEMAPS.md
+    rolldownOptions: {
+      output: { keepNames: true },
+    },
   },
```

### C. `netlify.toml` diff for D-05

```diff
 [build]
-  # VITE_COMMIT_SHA is re-exported from Netlify's built-in $COMMIT_REF so Sentry
-  # error reports tag the exact deploy commit (src/main.tsx reads it at build time).
-  command = "npm ci && VITE_COMMIT_SHA=$COMMIT_REF npm run build"
+  # VITE_COMMIT_SHA is re-exported from Netlify's built-in $COMMIT_REF so Sentry
+  # error reports tag the exact deploy commit (src/main.tsx reads it at build time).
+  # VITE_NETLIFY_CONTEXT is re-exported from Netlify's built-in $CONTEXT
+  # ('production' / 'deploy-preview' / 'branch-deploy' / 'dev') so the smoke
+  # route at /__smoke can env-gate the render-phase throw to non-prod only
+  # (Phase 7 D-05). Both vars rely on shell substitution; static
+  # [build.environment] would set the literal string '$CONTEXT'.
+  command = "npm ci && VITE_COMMIT_SHA=$COMMIT_REF VITE_NETLIFY_CONTEXT=$CONTEXT npm run build"
   publish = "dist"
```

### D. `src/components/debug/RenderThrowSmoke.tsx`

```tsx
// Source: .planning/research/v1.1-SENTRY-ERRORBOUNDARY.md "Smoke verification"
//       + .planning/phases/07-observability-hardening/07-CONTEXT.md <specifics>

// Phase 7 OBSV-01/02 verification canary. Throws from RENDER (not an event
// handler) so the React 19 hooks + Sentry.ErrorBoundary capture path is
// exercised end-to-end. Event-handler throws would hit
// globalHandlersIntegration and mask the test.
//
// Permanent observability canary (D-01) — stays in the repo so future
// regressions are re-detectable with a single deploy-preview click.

export function RenderThrowSmoke(): never {
  throw new Error(
    'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'
  )
}
```

### E. `src/routes/[__smoke].tsx` (full file)

```tsx
// Source: structural analog src/routes/topics.tsx (validateSearch shape)
//       + Context7 /tanstack/router not-found-errors.md (notFound + beforeLoad)
//       + .planning/phases/07-observability-hardening/07-CONTEXT.md D-02..D-06

/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'

interface SmokeSearch {
  render?: '1'
}

// Phase 7 D-03: lazy-loaded so the smoke chunk only downloads when someone
// visits /__smoke?render=1. autoCodeSplitting in vite.config.ts handles the
// chunk boundary for free.
const RenderThrowSmoke = lazy(() =>
  import('@/components/debug/RenderThrowSmoke').then(m => ({
    default: m.RenderThrowSmoke,
  }))
)

export const Route = createFileRoute('/__smoke')({
  validateSearch: (search: Record<string, unknown>): SmokeSearch =>
    search.render === '1' ? { render: '1' } : {},
  // Phase 7 D-04 + D-06: live prod returns a standard 404 — the route
  // appears not to exist. VITE_NETLIFY_CONTEXT is populated from Netlify's
  // built-in $CONTEXT in netlify.toml's build command.
  beforeLoad: () => {
    if (import.meta.env.VITE_NETLIFY_CONTEXT === 'production') {
      throw notFound()
    }
  },
  component: SmokePage,
})

function SmokePage() {
  const { render } = Route.useSearch()
  if (render !== '1') {
    return (
      <p className="text-sm text-muted-foreground">
        Smoke route. Append <code>?render=1</code> to trigger a render-phase throw.
      </p>
    )
  }
  return (
    <Suspense fallback={null}>
      <RenderThrowSmoke />
    </Suspense>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Sentry.ErrorBoundary` alone catches render errors | `Sentry.reactErrorHandler` on `createRoot` hooks + `ErrorBoundary` for fallback UI | React 19 release (April 2024) + `@sentry/react` 8.6.0 (May 2024) | Prior pattern silently broke on React 19 in production builds. Phase 6 hit this. |
| Vite ships esbuild minifier | Vite 8 ships Rolldown bundler + Oxc minifier by default | Vite 8.0 (October 2025 per Vite migration guide) | Identifier names mangle differently; pre-existing `mangle.keep_fnames`-style escapes don't translate 1:1. `keepNames` is the Rolldown-native fix. |
| `build.rollupOptions.output.*` | `build.rolldownOptions.output.*` (rollupOptions deprecated alias) | Vite 8 | Cosmetic rename. Either name works in 8.x but `rolldownOptions` is the canonical form. |

**Deprecated/outdated:**
- `build.minify: 'esbuild'` is deprecated in Vite 8 (Oxc is now default and preferred for client builds). [CITED: Context7 /vitejs/vite/v8.0.7 build.minify]
- Pre-`reactErrorHandler` Sentry React patterns (any wiring that relies solely on `ErrorBoundary` for capture). v9→v10 migration did NOT change this — the React 19 gap predates v10 and was simply not closed by an SDK upgrade.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sentry's `Dedupe` integration is enabled by default in `@sentry/react` 10.49.0 (without explicit `integrations` array entry) | Pitfall 5 | Two Sentry events appear for each smoke run. Mitigation: drop the `onError` belt; the React 19 hooks alone fire `onCaughtError` and capture the error correctly. |
| A2 | `mechanism.type` for events from `reactErrorHandler` will be `react.errorboundary` OR `generic` | Common Pitfall 1 + Validation Architecture | If the actual mechanism is something else (e.g., `instrument`), the verification rubric needs a one-line update to accept whatever Sentry actually emits. The v1.1-SENTRY-ERRORBOUNDARY.md research file explicitly flags this as an open question to confirm on a deploy preview. Low risk — verification is the entire point of Phase 7. |
| A3 | Rolldown's `__name` helper gets gzip-deduped to ~0.5–1.5% total bundle delta | Bundle-size impact in v1.1-VITE-SOURCEMAPS.md (re-stated here) | If the actual delta is much higher (e.g., 5%), CONTEXT.md D-14 already authorises "ship anyway with documented overage". So this is not blocking — it just affects the closure doc rationale line. |
| A4 | Adding a flat-file route `src/routes/[__smoke].tsx` with the double-underscore prefix does not collide with TanStack Router's reserved `__root` convention | Pattern 3 | If TanStack interprets `__smoke` as a layout/utility route, the build would fail. Easy to verify by running `npm run generate` once after creating the file — failure would surface immediately. Confidence is HIGH that it works (the convention is "leading underscore indicates non-routable layout file"; `__root` is a documented exception, not a generic prefix), but I did not run the codegen in this research session. |

## Open Questions (RESOLVED)

1. **Confirm `mechanism.type` on actual Sentry event from `reactErrorHandler`.**
   - What we know: Should be `react.errorboundary` (preferred) or `generic`. v1.1-SENTRY-ERRORBOUNDARY.md flags this as unresolved.
   - What's unclear: Which one Sentry currently emits as of `@sentry/react` 10.49.0.
   - Recommendation: First Phase 7 deploy-preview smoke run records the actual value into VERIFICATION.md as the screenshot caption. No action required pre-implementation.
   - RESOLVED: accept either `react.errorboundary` OR `generic` per CONTEXT `<specifics>`. Plan 03 Task 1 already encodes both as pass values; reject only if `auto.browser.global_handlers.onerror`.

2. **Behavior of `keepNames` on arrow-function-assigned-to-const.**
   - What we know: Rolldown docs explicitly cover `function` and `class` declarations. Arrow functions (`const handler = () => {…}`) get their `.name` from the enclosing variable name via a JS engine inference rule.
   - What's unclear: Whether Oxc preserves the `const handler` identifier (so the inferred name persists) or mangles it (so `.name` becomes `xR`).
   - Recommendation: The verification script in v1.1-VITE-SOURCEMAPS.md should spot-check at least one arrow-function name in the `names[]` excerpt. Fallback (only if the spot-check fails): add `output.minify.mangle.keep_fnames: true` (research-flagged escape hatch).
   - RESOLVED: spot-check during Plan 03 Task 3 closure-doc capture (`grep '__name(' dist/assets/*.js | head` will surface coverage). Fallback path documented (Terser `mangle.keep_fnames` in MIGRATION-LOG.md).

3. **Permanent smoke route discoverability concern.**
   - What we know: D-04 + D-06 lock that live prod returns 404. URL appears to not exist.
   - What's unclear: Whether the smoke chunk is preloaded by TanStack Router on hover/intent for non-prod deploys (there's no `<Link>` to it, so probably not).
   - Recommendation: No action — `autoCodeSplitting: true` only emits a chunk; without a link to `/__smoke`, no preload triggers. The chunk only downloads on direct navigation.
   - RESOLVED: no action required. TanStack `autoCodeSplitting: true` + zero `<Link>` references to `/__smoke` ensure the chunk is never preloaded; D-03 lazy-load assumption holds.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` | npm scripts | ✓ | 22 (per netlify.toml [build.environment].NODE_VERSION) | — |
| `npm` | install + build | ✓ | bundled with Node 22 | — |
| `@sentry/react` (installed) | `Sentry.reactErrorHandler` | ✓ | 10.49.0 | — |
| `@tanstack/react-router` (installed) | smoke route | ✓ | 1.168.10 | — |
| `vite` (installed) | `build.rolldownOptions` | ✓ | 8.0.5 | — |
| Sentry SaaS (DSN reachability) | event ingestion at verification time | ✓ (assumed — Phase 6 verified working) | — | None — verification depends on it |
| Netlify deploy preview infra | manual verification env per D-07 | ✓ (Phase 5 + 6 used this surface) | — | None — D-07 explicitly refuses dev/Vitest |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

All toolchain pre-requisites are satisfied by the existing project setup. Phase 7 introduces zero new external dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (per existing test config in `vite.config.ts`) — but **NOT used for Phase 7 verification per D-07.** |
| Config file | `vite.config.ts` (test block, lines 38–53) |
| Quick run command | `npm test` (runs Vitest in run mode) |
| Full suite command | `npm test` |
| **Phase 7 verification mode** | **MANUAL on Netlify deploy preview — automated tests are explicitly out of scope (D-07).** Roadmap success criterion #5 forbids dev/Vitest verification. |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| OBSV-01 | At least one Sentry event matches the canonical PRIMARY allowlist (`mechanism.type ∈ {auto.function.react.error_handler, auto.function.react.error_boundary}` per `07-VALIDATION.md`) when `RenderThrowSmoke` mounts on a deploy preview; companion `'generic'` events from the manual onError belt are EXPECTED, not standalone passes; any `auto.browser.*` is a FAILURE | manual | navigate deploy-preview-url`/__smoke?render=1` → inspect Sentry event mechanism panel | N/A (manual) |
| OBSV-01 | Sentry event `tags.boundary === 'app-root'` is populated | manual | inspect Sentry event tags panel | N/A (manual) |
| OBSV-01 | Sentry event `contexts.react.componentStack` is populated and non-empty | manual | inspect Sentry event contexts panel | N/A (manual) |
| OBSV-01 | `AppErrorFallback` renders in the browser when smoke fires (proves boundary still functions as fallback UI) | manual | visual on deploy preview | N/A (manual) |
| OBSV-02 | Sentry event top stack frames show un-mangled identifiers (e.g. `RenderThrowSmoke`, `App`, route components — not `xR`/`$M`) | manual | inspect Sentry event stacktrace panel on the SAME event | N/A (manual) |
| OBSV-02 | Built `dist/assets/*.js.map` `names[]` array contains kept identifiers (e.g. `RenderThrowSmoke`, `handleResponseSubmit`, route component names) | semi-automated | `node scripts/verify-sourcemap-names.mjs` (script template in v1.1-VITE-SOURCEMAPS.md) — emits the `names[]` excerpt for the closure doc | ❌ Wave 0 — script body lives in research; planner adds it as a one-shot under `scripts/` (or inline in 07-VERIFICATION.md, no need for a runnable file if the verifier copy-pastes the inspection into a Node REPL) |
| OBSV-02 | Built `dist/assets/*.js` chunks contain literal preserved `function Name(...)` declarations (Rolldown-correct equivalent of esbuild's `__name(...)` helper — see amendment banner) | automated grep | `grep -lE 'function (RootLayout\|AppErrorFallback\|RenderThrowSmoke)\b' dist/assets/*.js \| wc -l` (≥1) | N/A (one-liner) |
| OBSV-02 | Total gzip bundle delta from baseline-without-keepNames is ≤1.5% (or documented overage per D-14) | semi-automated | two `npm run build` runs (main vs phase-7), capture Vite output table from each, diff in `OBSV-02-bundle-delta.md` | N/A (manual capture into closure doc) |
| OBSV-01 + OBSV-02 | Sentry event permalink + release SHA | manual | copy from Sentry UI into `07-VERIFICATION.md` | N/A (manual) |

### Sampling Rate
- **Per task commit:** TypeScript compile + lint (existing `tsc -b` and `eslint .` pre-commit/CI gates).
- **Per wave merge:** Same — no Vitest test added in this phase.
- **Phase gate (D-07):** Single manual smoke pass on the Phase 7 PR's deploy preview. Four artifacts pinned in 07-VERIFICATION.md (D-08).

### Wave 0 Gaps
- [ ] (Optional) `scripts/verify-sourcemap-names.mjs` — only if the planner prefers a committed verification script vs an inline Node-REPL excerpt in `OBSV-02-bundle-delta.md`. The research file (v1.1-VITE-SOURCEMAPS.md) already provides the exact source. Either way is acceptable per CONTEXT.md `<decisions>` "Claude's Discretion" on file paths.

*(No Vitest test infrastructure gaps. Phase 7 is explicitly manual-verification-only per D-07.)*

## Security Domain

> No `security_enforcement` setting in `.planning/config.json` was inspected. Including a brief section per the agent contract because this phase touches an internet-facing surface (the smoke route) and a build-pipeline env var.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Smoke route is unauthenticated — but only reachable on non-prod by design. No auth-affecting changes. |
| V3 Session Management | no | No session changes. |
| V4 Access Control | yes (light) | Smoke route MUST 404 on production. Control: `if (import.meta.env.VITE_NETLIFY_CONTEXT === 'production') throw notFound()` in route `beforeLoad`. Build-time string substitution → runtime constant; no way to flip on prod without re-deploying with a different `$CONTEXT` (which Netlify itself controls). |
| V5 Input Validation | yes (light) | Search param `render` is validated via `validateSearch` to accept only literal `'1'` — anything else is dropped. Standard TanStack pattern (matches existing topics.tsx / archive.tsx `focus` validation). |
| V6 Cryptography | no | No crypto involved. |
| V8 Data Protection | no | No PII in smoke event other than the deterministic message + componentStack. Sentry event quota is the only resource being protected. |
| V14 Configuration | yes | `netlify.toml` build-command shell substitution. Standard pattern (mirrors existing `VITE_COMMIT_SHA`). No secret material — `$CONTEXT` is public metadata. |

### Known Threat Patterns for {Vite + React + Netlify}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Smoke route enabled on production by env-var misconfig | Information Disclosure (Sentry quota burn) / Denial of Service | Build-time inline of `import.meta.env.VITE_NETLIFY_CONTEXT` makes the gate a constant in the production bundle — cannot be toggled at runtime. Netlify's `$CONTEXT` for the production deploy is `'production'` (immutable per Netlify deploy contract). |
| Smoke event quota exhaustion via repeated `?render=1` requests | Denial of Service (Sentry free tier 5K events/mo) | Smoke is non-prod only (D-04). Deploy previews are private URLs by default. Bot/crawler traffic on prod gets 404. |
| Source-map info disclosure | Information Disclosure | Already mitigated Phase 6: `build.sourcemap: 'hidden'` + `sentryVitePlugin.sourcemaps.filesToDeleteAfterUpload: './dist/**/*.map'`. Phase 7 does not change this contract. |
| Hidden route discovery via routeTree.gen.ts | Information Disclosure | The route IS in source (committed). The `beforeLoad` 404-throws on production — discovery does not unlock the throw. Acceptable per D-06 ("appears not to exist" on prod is a UX guarantee, not a security guarantee — token-gating was considered and rejected). |

## Sources

### Primary (HIGH confidence)
- Context7 `/getsentry/sentry-javascript` — packages/react/README.md "Configure React 19 Error Hooks with Sentry"; "ErrorBoundary"; v8.6.0 changelog "Sentry.reactErrorHandler".
- Context7 `/vitejs/vite/v8.0.7` — `build.rolldownOptions`, `build.minify` default = `'oxc'`, `build.sourcemap`, `import.meta.env` `VITE_*` prefix rules.
- Context7 `/rolldown/rolldown` — `output.keepNames` doc with `__name` helper code example.
- Context7 `/tanstack/router` — `notFound()`, `notFoundComponent`, file-route convention.
- Context7 `/websites/netlify` — `[build.environment]` and per-context environment configuration; build-metadata variables (`CONTEXT`).
- Repository inspection — `package.json` (versions), `vite.config.ts` (existing plugins + build config), `tsconfig.app.json` (strict flags), `netlify.toml` (existing `VITE_COMMIT_SHA` shell-substitution precedent), `src/main.tsx` (existing Sentry.init block + ErrorBoundary wiring), `src/routes/*.tsx` (flat-file convention, `validateSearch` pattern), `src/components/debug/` (DebugAuthOverlay precedent), `src/routeTree.gen.ts` (auto-generated structure).
- Canonical research already filed: `.planning/research/v1.1-SENTRY-ERRORBOUNDARY.md`, `.planning/research/v1.1-VITE-SOURCEMAPS.md`, `.planning/research/v1.1-SUMMARY.md`.

### Secondary (MEDIUM confidence)
- Sentry official docs (cited in research files): https://docs.sentry.io/platforms/javascript/guides/react/ ; https://docs.sentry.io/platforms/javascript/guides/react/features/error-boundary/ ; https://docs.sentry.io/platforms/javascript/guides/react/migration/v9-to-v10/.
- Rolldown official docs: https://rolldown.rs/reference/outputoptions.keepnames.
- Vite 8 migration guide: https://vite.dev/guide/migration.

### Tertiary (LOW confidence — flagged for verification on first deploy preview)
- Exact `mechanism.type` value emitted by `reactErrorHandler` in `@sentry/react` 10.49.0 — both v1.1-SENTRY-ERRORBOUNDARY.md and this RESEARCH.md flag this as a deploy-preview-only confirmation point.
- Default-on status of Sentry's `Dedupe` integration in `@sentry/react` 10.49.0 — Assumption A1.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep is already in `package.json` and verified against the repo.
- Architecture: HIGH — `createRoot` hooks pattern is verbatim from Sentry's official README; `keepNames` is verbatim from Rolldown's official docs; flat-file route convention is confirmed by inspecting all five existing route files.
- Pitfalls: MEDIUM-HIGH — Pitfalls 1, 2, 3, 4, 6 are HIGH (each is documented in canonical research or directly confirmed in repo state). Pitfall 5 (Dedupe) is MEDIUM — depends on Assumption A1.
- Validation Architecture: HIGH — D-07 + D-08 in CONTEXT.md fully specify the manual verification rubric; this section translates that rubric into a per-requirement test map without altering scope.
- Security Domain: HIGH — V4 + V14 controls are localised, build-time constants; no runtime attack surface exposed by the env-gate flip.

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (30 days — Vite/Sentry/TanStack-Router are stable enough that the canonical APIs are unlikely to shift in a month; reverify if `@sentry/react` v11 ships or Vite 8.1 changes default minifier behavior).
