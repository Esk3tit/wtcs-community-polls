# Phase 7: Observability Hardening — Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 7 (3 MOD code/config, 2 NEW code, 2 NEW planning docs)
**Analogs found:** 7 / 7 (with one "no-precedent" caveat for `.planning/closure/`)

---

## File Classification

| File | Status | Role | Data Flow | Closest Analog | Match |
|------|--------|------|-----------|----------------|-------|
| `src/main.tsx` | MOD | entry-point / bootstrap | request-response (mount-time) | self (incremental wiring on existing `createRoot` + `Sentry.ErrorBoundary`) | exact |
| `vite.config.ts` | MOD | build-config | build-time | self (existing `build:` block) | exact |
| `netlify.toml` | MOD | deploy-config | build-time (shell substitution) | self (existing `[build].command` `VITE_COMMIT_SHA=$COMMIT_REF` shell-export pattern) | exact |
| `src/routes/__smoke.tsx` | NEW | route-component (env-gated) | request-response (search-param read + conditional render) | `src/routes/topics.tsx` (flat-file `createFileRoute` + `validateSearch` + search param body) | exact (structural) |
| `src/components/debug/RenderThrowSmoke.tsx` | NEW | component (debug, render-phase throw) | none (unconditional throw) | `src/components/debug/DebugAuthOverlay.tsx` (same `src/components/debug/` neighborhood) — but the throw shape itself has **no analog** in repo | role-only (location); behaviour: research-derived |
| `.planning/phases/07-observability-hardening/07-VERIFICATION.md` | NEW | doc / phase closure evidence | n/a | `.planning/phases/06-auth-fix-…/06-VERIFICATION.md` | exact (structural) |
| `.planning/closure/OBSV-02-bundle-delta.md` | NEW | doc / requirement closure evidence | n/a | **No precedent** — `.planning/closure/` does not yet exist on this branch. RESEARCH.md D-11 calls it the "v1.1 closure-evidence pattern", but in practice the only existing analog of "before/after measurement table + rationale" is the **Behavioral Spot-Checks + Goal Achievement table** style from `06-VERIFICATION.md`. Use that as the structural analog; first-instance for the path. | role-derived |

---

## Pattern Assignments

### `src/main.tsx` (MOD — wire React 19 root error hooks + ErrorBoundary `onError` belt)

**Analog:** self. `createRoot(...).render(...)` already exists; we add an options object and one prop on `Sentry.ErrorBoundary`. `Sentry.init` block stays untouched (Phase 6 D-04 already correct).

**Existing imports (lines 1-10) — extend with `type ErrorInfo`:**
```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import * as Sentry from '@sentry/react'
import { PostHogProvider } from 'posthog-js/react'
import { initPostHog } from '@/lib/posthog'
import { ConsentProvider } from '@/contexts/ConsentContext'
import { AppErrorFallback } from '@/components/AppErrorFallback'
import { routeTree } from './routeTree.gen'
import './index.css'
```

**Existing `createRoot` + `Sentry.ErrorBoundary` (lines 51-77) — current shape:**
```typescript
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppErrorFallback />} showDialog={false}>
      <PostHogProvider client={posthog}>
        <ConsentProvider>
          <RouterProvider router={router} />
        </ConsentProvider>
      </PostHogProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
```

**Divergence (Phase 7 OBSV-01 — RESEARCH.md Pattern 1, lines 226-269):**
- Add `type ErrorInfo` import: `import { createRoot, type ErrorInfo } from 'react-dom/client'` (`verbatimModuleSyntax: true` requires the explicit `type` keyword — RESEARCH.md line 274).
- Replace the bare `document.getElementById('root')!` with a typed null-check: `const container = document.getElementById('root'); if (!container) throw new Error('Root container missing')` (RESEARCH.md line 243-244).
- Pass `createRoot(container, { onUncaughtError, onCaughtError, onRecoverableError })` — three React 19 hooks, each wrapped with `Sentry.reactErrorHandler()`. Only `onUncaughtError` carries a callback (DEV `console.warn`); the other two pass `Sentry.reactErrorHandler()` with no second arg.
- On `Sentry.ErrorBoundary`, add an `onError={(error, componentStack, eventId) => Sentry.captureException(error, { tags: { boundary: 'app-root', eventId }, contexts: { react: { componentStack } } })}` belt — defence-in-depth per CONTEXT D-01 / RESEARCH.md `<integration_points>`.
- Comment-density convention: cite "Phase 7 OBSV-01" + research path on each new block, matching existing convention in `src/main.tsx` ("HIGH #1 (codex review)…", "Phase 6 D-04…", "M1 (codex review)…") (RESEARCH.md line 276; PATTERNS-style established by `06-PATTERNS.md`).
- DO NOT touch lines 24-39 (the `Sentry.init` block). DO NOT touch the `if (!import.meta.env.VITE_SENTRY_DSN && import.meta.env.DEV)` warning. DO NOT touch the provider tree composition (`PostHogProvider` → `ConsentProvider` → `RouterProvider`) — Phase 6 D-04 already correct.

---

### `vite.config.ts` (MOD — `build.rolldownOptions.output.keepNames: true`)

**Analog:** self. Existing `build: { sourcemap: 'hidden' }` block expands; everything else stays.

**Existing `build:` block (line 32):**
```typescript
build: { sourcemap: 'hidden' },
```

**Existing `sentryVitePlugin` block (lines 24-30) — DO NOT TOUCH:**
```typescript
sentryVitePlugin({
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { filesToDeleteAfterUpload: './dist/**/*.map' },
  disable: mode !== 'production',
}),
```

**Divergence (Phase 7 OBSV-02 — RESEARCH.md Pattern 2, lines 278-311; Code Example §B, lines 613-630):**
- Replace the single-line `build:` with a multi-line block that retains `sourcemap: 'hidden'` and adds `rolldownOptions: { output: { keepNames: true } }`.
- Add a comment block above `rolldownOptions` citing "Phase 7 OBSV-02" + the research path (`.planning/research/v1.1-VITE-SOURCEMAPS.md`) and the closure doc path (`.planning/closure/OBSV-02-bundle-delta.md`) so future maintainers can trace bundle-size cost.
- DO NOT modify `plugins`, `resolve.alias`, `test`, or the `sentryVitePlugin` block. RESEARCH.md `<integration_points>` is explicit: `keepNames` is a Rolldown-output option; the Sentry plugin is a Vite plugin; the two are orthogonal but they MUST coexist (Pattern 6 of `05-RESEARCH.md`: Sentry plugin LAST in `plugins` array — already correct).
- DO NOT touch `mode` evaluation, `disable: mode !== 'production'`, or `build.sourcemap: 'hidden'`. RESEARCH.md anti-pattern (line 451): "Touching `Sentry.init` to add `mechanism` filtering" — same spirit applies to the upload pipeline; OBSV-02 is purely a name-preservation change.

**Reference target shape (RESEARCH.md Pattern 2, lines 298-308):**
```typescript
build: {
  sourcemap: 'hidden',
  // Phase 7 OBSV-02: preserve original function/class .name so Sentry stack
  // frames show source identifiers instead of mangled `xR`/`$M`. Rolldown
  // injects a __name(fn, 'orig') helper; Function.prototype.name then
  // survives Oxc's mangler (Vite 8 default minifier).
  // Research: .planning/research/v1.1-VITE-SOURCEMAPS.md
  // Bundle-size delta: .planning/closure/OBSV-02-bundle-delta.md
  rolldownOptions: {
    output: { keepNames: true },
  },
},
```

---

### `netlify.toml` (MOD — re-export `$CONTEXT` as `VITE_NETLIFY_CONTEXT` in build command)

**Analog:** self. The existing `[build].command` already shell-substitutes `VITE_COMMIT_SHA=$COMMIT_REF` — exactly the pattern Phase 7 needs.

**Existing `[build].command` block (lines 7-12):**
```toml
[build]
  # VITE_COMMIT_SHA is re-exported from Netlify's built-in $COMMIT_REF so Sentry
  # error reports tag the exact deploy commit (src/main.tsx reads it at build time).
  # Keep this in the build command — Netlify UI env vars are literal strings and
  # don't expand $COMMIT_REF.
  command = "npm ci && VITE_COMMIT_SHA=$COMMIT_REF npm run build"
  publish = "dist"
```

**Divergence (Phase 7 D-05 — RESEARCH.md Pattern 6, lines 426-445):**
- Append a second shell-export pair to the same one-liner: `VITE_NETLIFY_CONTEXT=$CONTEXT`. Final command:
  ```toml
  command = "npm ci && VITE_COMMIT_SHA=$COMMIT_REF VITE_NETLIFY_CONTEXT=$CONTEXT npm run build"
  ```
- Extend the existing comment block with one line citing "Phase 7 D-05" and naming the consumer file (`src/routes/__smoke.tsx`).
- DO NOT add `[build.environment]` entries for `VITE_NETLIFY_CONTEXT` — RESEARCH.md anti-pattern (line 452) and Pattern 6 explanation (line 430): a `[build.environment]` static block sets literal strings; only the build-command shell evaluates `$CONTEXT`.
- DO NOT touch the `[[headers]]` blocks, the existing comments about CSP-as-follow-up, or `NODE_VERSION`. Out of scope.

---

### `src/routes/__smoke.tsx` (NEW — flat-file route, env-gated, lazy throw)

**Analog:** `src/routes/topics.tsx` (closest by role + data flow: flat-file `createFileRoute` route with `validateSearch` for an optional string search param + small body component reading `Route.useSearch()`).

**Imports + route-shape pattern from analog (`src/routes/topics.tsx:1-18`):**
```typescript
/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { SuggestionList } from '@/components/suggestions/SuggestionList'

interface TopicsSearch {
  focus?: string
}

export const Route = createFileRoute('/topics')({
  component: TopicsPage,
  validateSearch: (search: Record<string, unknown>): TopicsSearch => {
    const focus = typeof search.focus === 'string' ? search.focus : undefined
    return focus ? { focus } : {}
  },
})
```

**Body pattern from analog (`src/routes/topics.tsx:20-27`):**
```typescript
function TopicsPage() {
  const { focus } = Route.useSearch()
  return (
    <AuthGuard>
      <SuggestionList status="active" focusId={focus} />
    </AuthGuard>
  )
}
```

**Divergence (Phase 7 D-02..D-06 — RESEARCH.md Pattern 3, lines 313-379 + Pattern 4, lines 381-403):**
- Keep the `/* eslint-disable react-refresh/only-export-components */` pragma (every existing route uses it; required because `createFileRoute` exports a non-component `Route` const alongside the component function — `06-PATTERNS.md` "Lint-driven hook split" pattern).
- File path: `src/routes/__smoke.tsx` (flat-file, NOT directory `__smoke/index.tsx`). The `__` prefix mirrors `__root.tsx` and signals "non-user-facing" — RESEARCH.md line 328.
- Drop the `AuthGuard` import — smoke is intentionally unauthenticated (a verifier on a deploy preview must reach it without Discord OAuth).
- Add `notFound` to the `@tanstack/react-router` import: `import { createFileRoute, notFound } from '@tanstack/react-router'` — RESEARCH.md Pattern 4.
- Add `lazy` + `Suspense` from `react`. Lazy-load `RenderThrowSmoke` so the throw component lives in its own chunk (D-03 — TanStack `autoCodeSplitting: true` is already enabled in `vite.config.ts:20`):
  ```typescript
  const RenderThrowSmoke = lazy(() =>
    import('@/components/debug/RenderThrowSmoke').then(m => ({ default: m.RenderThrowSmoke }))
  )
  ```
- `validateSearch` returns a tiny `SmokeSearch { render?: '1' }` shape — narrower than topics.tsx's `string` (only the literal `'1'` is meaningful):
  ```typescript
  validateSearch: (search: Record<string, unknown>): SmokeSearch => {
    return search.render === '1' ? { render: '1' } : {}
  },
  ```
- Add `beforeLoad` env-gate (D-04 / D-06): on production Netlify, throw `notFound()` so live-prod returns the standard 404. RESEARCH.md Pattern 4 lines 391-401:
  ```typescript
  beforeLoad: () => {
    if (import.meta.env.VITE_NETLIFY_CONTEXT === 'production') {
      throw notFound()
    }
  },
  ```
- Body component reads `render` and either prints a hint paragraph (when missing) or renders `<RenderThrowSmoke />` inside a `<Suspense fallback={null}>` (when `render === '1'`). RESEARCH.md Pattern 3 lines 364-378.
- DO NOT add a `notFoundComponent` to this route (D-06 wants TanStack's standard default, not a custom 404). DO NOT mount any side effects (no `useEffect`, no breadcrumbs) — the route is purely dispatch logic.
- Optional planner discretion (CONTEXT.md `Claude's Discretion`, item 4): a `tags: { smoke: true }` on the Sentry side. RESEARCH.md Pattern 5 line 415-417 explicitly leaves this out: "the deterministic message string is sufficient for searching the Sentry UI." Recommend SKIPPING.

---

### `src/components/debug/RenderThrowSmoke.tsx` (NEW — render-phase throw)

**Analog (location only):** `src/components/debug/DebugAuthOverlay.tsx` lives in the same `src/components/debug/` neighborhood and uses `export default function DebugAuthOverlay() { ... }` shape with no props. Use that file as the placement + naming-convention anchor; the **behaviour** has no in-repo precedent (no other component throws unconditionally).

**Imports pattern from neighborhood (`src/components/debug/DebugAuthOverlay.tsx:1-7`):**
```typescript
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { snapshotBreadcrumbs } from '@/components/debug/snapshotBreadcrumbs'
```

**Divergence (Phase 7 — RESEARCH.md Pattern 5, lines 405-424 + CONTEXT.md `<specifics>`):**
- Component is **far simpler** than `DebugAuthOverlay`. No imports beyond what is strictly needed; no props; no hooks; no JSX (the function body throws before returning).
- Final shape (RESEARCH.md Pattern 5 lines 419-423):
  ```typescript
  // Phase 7 OBSV-01 verification surface. Lazy-loaded by src/routes/__smoke.tsx
  // when env-gated to non-production. Throws from the RENDER phase (NOT an
  // event handler — event-handler throws hit globalHandlersIntegration and
  // would mask the React 19 hooks test).
  // Research: .planning/research/v1.1-SENTRY-ERRORBOUNDARY.md "Smoke verification"
  // Message string is deterministic so Sentry UI search finds the event by
  // exact message match.
  export function RenderThrowSmoke(): never {
    throw new Error(
      'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'
    )
  }
  ```
- Use **named export** (`export function RenderThrowSmoke`), NOT default export — matches the Phase 7 lazy-import shape in `__smoke.tsx`: `lazy(() => import(...).then(m => ({ default: m.RenderThrowSmoke })))`. This deviates from the `DebugAuthOverlay` neighbour (which uses `export default`); pick named-export because RESEARCH.md Pattern 5 uses it explicitly and the lazy-loader's `.then(m => ({ default: m.X }))` shape is the documented TanStack/React lazy adapter for named exports.
- Return type: `never` — TS infers the throw, but `: never` is explicit and matches RESEARCH.md Pattern 5 line 419.
- DO NOT call `Sentry.captureException` directly. The whole point is to verify React 19 root hooks and `Sentry.ErrorBoundary` `onError` belt route the error. A direct `captureException` would mask the test (CONTEXT.md `<specifics>` mechanism-type note).
- DO NOT add `Sentry.setTag({ smoke: true })`. CONTEXT.md `Claude's Discretion` allows it; RESEARCH.md Pattern 5 line 415-417 recommends against. Skip.
- Comment-density convention: same plan-cite + research-cite pattern as the rest of `src/main.tsx` and `src/routes/__root.tsx`.

---

### `.planning/phases/07-observability-hardening/07-VERIFICATION.md` (NEW)

**Analog:** `.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-VERIFICATION.md` (the most recent phase verification doc; structural shape verified to match Phase-5 / Phase-4 conventions).

**Frontmatter pattern from analog (`06-VERIFICATION.md:1-7`):**
```yaml
---
phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
verified: 2026-04-26T08:56:00Z
status: passed
score: 7/7 roadmap success criteria verified (plus all 7 plan must-have sets)
overrides_applied: 0
---
```

**Section structure from analog (top-level headings, lines 9-181):**
1. Top heading: `# Phase NN: <Name> — Verification Report`
2. **Phase Goal** prose paragraph (1-3 sentences pulled from CONTEXT `<domain>`).
3. `**Verified:**` / `**Status:**` / `**Re-verification:**` triplet.
4. `## Goal Achievement — Roadmap Success Criteria` — markdown table with columns `# | Success Criterion | Status | Evidence`. One row per ROADMAP.md Phase 7 success criterion (CONTEXT.md `<canonical_refs>` cites `ROADMAP.md § Phase 7 — five Success Criteria`).
5. `## Required Artifacts` — table with columns `Artifact | Expected | Status | Details`. One row per file in `<canonical_refs>` "Files to modify/create".
6. `## Key Link Verification` — table with columns `From | To | Via | Status | Details`. Pin: `main.tsx` → `@sentry/react` (3 hooks); `main.tsx` → `Sentry.ErrorBoundary onError`; `__smoke.tsx` → `RenderThrowSmoke` (lazy import); `vite.config.ts` → `rolldownOptions.output.keepNames`; `netlify.toml` → `VITE_NETLIFY_CONTEXT`.
7. `## Behavioral Spot-Checks` — table with columns `Behavior | Command | Result | Status`. Phase 7 examples: `npm run build` succeeds; `grep -lE 'function (RootLayout|AppErrorFallback|RenderThrowSmoke)\b' dist/assets/*.js | wc -l` >= 1 (literal-function-declaration evidence — Rolldown's keepNames mechanism, **amended 2026-04-30** from the original `__name(` esbuild-idiom check); built `dist/assets/*.js.map` `names[]` contains `RenderThrowSmoke`.
8. `## Anti-Patterns Found` — table; expected to be empty for Phase 7 (config-only changes).
9. `## Requirements Coverage` — REQUIREMENTS.md OBSV-01 + OBSV-02 status flips, with inline evidence citations.
10. `## Human Verification Required` — list of any open human gates. Phase 7: closes on D-09 solo sign-off; the **four mandatory evidence items from D-08** belong here as PASS rows:
    1. Sentry event screenshot — `componentStack` populated + `tags.boundary === 'app-root'`.
    2. Sentry event screenshot — top stack frames un-mangled (`App`, `RenderThrowSmoke`, route components).
    3. Sentry event permalink + release SHA pinned in this doc.
    4. Built `dist/assets/*.js.map` `names[]` excerpt (via `jq -r '.names[]'`) + literal-function-declaration grep output (`grep -lE 'function (RootLayout|AppErrorFallback|RenderThrowSmoke)\b' dist/assets/*.js` — **amended 2026-04-30** from the original `grep '__name('` esbuild-idiom check; Rolldown preserves names literally instead of emitting helper calls).
11. `## Gaps Summary` — disposition prose; closes with "Disposition: PASSED" line.
12. Footer trailer (italicised): `_Verified: <ISO-timestamp>_` + `_Verifier: <name>_`.

**Divergence (Phase 7 specifics):**
- `phase:` frontmatter value: `07-observability-hardening`.
- Score gate: 5/5 roadmap criteria (per CONTEXT.md `<canonical_refs>` "ROADMAP.md § Phase 7 — five Success Criteria"), NOT 7/7 like Phase 6.
- `## Required Artifacts` table is shorter — only 7 rows (the files in `<canonical_refs>`).
- Phase 7 has **no plan must-have sets** equivalent to Phase 6's "plus all 7 plan must-have sets" frontmatter clause; the planner's plan-set count for Phase 7 will be smaller (RESEARCH.md `<primary_recommendation>` line 79: three task groups). Frontmatter score line should reflect actual count.
- `## Anti-Patterns Found` is expected to be empty (config-only phase + lazy-loaded debug component).
- `## Human Verification Required` is the **most-loaded section** for Phase 7 — the four D-08 evidence items live there. CONTEXT.md D-10 directs binary artifacts to `.planning/phases/07-observability-hardening/artifacts/` (large blobs gitignore-able at planner discretion); the permalink + `.map` text excerpts MUST be committed. Surface those file paths in the table rows.
- Do NOT add a Husky hook advisory row (Phase 6 chmod gap). If still un-fixed, mention briefly under `## Gaps Summary`; if fixed by Phase 7 close, omit. Either way, NOT a Phase 7 SC.

---

### `.planning/closure/OBSV-02-bundle-delta.md` (NEW)

**Analog:** **No precedent on this branch.** RESEARCH.md D-11 calls this the "v1.1 closure-evidence pattern" mirroring "UIDN-02/UIDN-03 closure-evidence", but `find .planning -name 'UIDN-*.md' -o -name '*bundle*.md'` returns nothing AND `.planning/closure/` does not exist. The pattern is **described** in RESEARCH.md but **not yet instantiated** in the repo. First-instance.

**Closest in-repo structural analogs for the *measurement table style*:**
- `.planning/phases/06-auth-fix-…/06-VERIFICATION.md` `## Behavioral Spot-Checks` table (`Behavior | Command | Result | Status`) — pattern for "show the command, show the captured output".
- `.planning/phases/06-auth-fix-…/06-VERIFICATION.md` `## Requirements Coverage` table (`Metric | Pre-Phase-6 baseline | Post-Phase-6 | Gate | Status`) — pattern for "before/after/gate/status".

**Recommended structure (synthesis of RESEARCH.md D-11..D-14 + the two analog tables):**

1. Top heading: `# OBSV-02: keepNames bundle-size delta`.
2. Frontmatter (matching VERIFICATION style):
   ```yaml
   ---
   requirement: OBSV-02
   measured: <ISO-timestamp>
   target_pct: 1.5
   actual_pct: <number>
   status: within-target | over-target-accepted
   ---
   ```
3. Short prose: "Compares total + per-chunk gzipped output of `dist/` between `main` (no `keepNames`) and the Phase 7 branch (with `rolldownOptions.output.keepNames: true`). Both builds run in the same session to eliminate baseline drift (RESEARCH.md Pitfall 5)."
4. `## Method` — single paragraph: same hardware, same Node version, same lockfile state, both builds via `npm run build`. Capture Vite/Rolldown's printed output table (per-chunk gzip column) verbatim from each run (D-13 — no new tooling).
5. `## Total gzip delta` — small table:
   ```
   | Build       | Total gzip (bytes) | Delta vs main | Delta % |
   |-------------|--------------------|---------------|---------|
   | main        | <baseline>         | —             | —       |
   | phase-7     | <new>              | +<n>          | +<x>%   |
   ```
6. `## Per-chunk gzip table` — wider table with one row per chunk in the `dist/assets/` output:
   ```
   | Chunk              | main (gzip B) | phase-7 (gzip B) | Delta B | Delta % |
   |--------------------|---------------|-------------------|---------|---------|
   | index-<hash>.js    | …             | …                 | …       | …       |
   | <vendor-hash>.js   | …             | …                 | …       | …       |
   | <route-hash>.js    | …             | …                 | …       | …       |
   ```
   Pin row order from baseline; show new chunks (e.g., the `RenderThrowSmoke` chunk created by D-03 lazy split) at the bottom with a `(new)` annotation in the chunk column.
7. `## Target check` — one-paragraph rationale closing on a single line per D-14:
   - If delta ≤ 1.5%: `"<actual>% — within ≤1.5% target."`
   - If delta > 1.5%: `"<actual>% — over target by <delta-pp> pp; observability gain accepted, revisit if Netlify caching costs become a concern."`
8. `## Raw build output` — two fenced ```` ``` ```` blocks pasted verbatim from `npm run build` stdout (one for main, one for phase-7 branch). RESEARCH.md D-13: "numbers are authoritative because they come from the actual build the deploy uploads."
9. Footer: `_Measured: <ISO-timestamp>_` + `_Measurer: <name>_` + `_Build commands: npm run build (twice, same session)_`.

**Divergence vs. behavior of phase-VERIFICATION docs:**
- This doc is **requirement-scoped**, not phase-scoped. It survives PR squash (D-11), so it gets its own path under `.planning/closure/`. Phase 7's `07-VERIFICATION.md` cross-references this doc by path.
- Numbers are **point-in-time**. RESEARCH.md Pitfall 5 (line 533) is explicit: take both measurements in the same session. Don't measure phase-7 on Tuesday and `main` on Thursday — `main` may have moved.
- This doc may be the **first ever** under `.planning/closure/`. If so, the planner must `mkdir .planning/closure` (or a `mkdir -p` equivalent). RESEARCH.md `<recommended_structure>` lines 219-220 declares the directory.

---

## Shared Patterns (cross-cutting)

### Imports — `@/` path alias is universal
**Source:** `tsconfig.app.json` + `vite.config.ts:35` (`'@': path.resolve(__dirname, './src')`); confirmed across every existing file in `src/`.
**Apply to:** every NEW Phase 7 source file (`src/routes/__smoke.tsx`, `src/components/debug/RenderThrowSmoke.tsx`). Use `@/components/debug/RenderThrowSmoke` for the lazy import; never `../components/...`. Matches `06-PATTERNS.md` Shared-Patterns §1.

### Lint-driven hook split / route-file pragma (`react-refresh/only-export-components`)
**Source:** Every existing route file (e.g. `src/routes/topics.tsx:1`, `src/routes/archive.tsx:1`, `src/routes/index.tsx:1`).
```typescript
/* eslint-disable react-refresh/only-export-components */
```
**Apply to:** `src/routes/__smoke.tsx`. Required because `createFileRoute` exports a non-component `Route` const alongside the component function.
**Do NOT apply to:** `src/components/debug/RenderThrowSmoke.tsx` — single named export, no non-component sibling.

### Comment-density / plan-citation convention
**Source:** `src/main.tsx:12-23, 19-23, 55-70` ("HIGH #1 (codex review)…", "M1 (codex review)…", "HI-01 (Phase 5 review):", "Phase 6 D-04:"); CONTEXT.md `<established_patterns>` ("All explanatory comments in `src/main.tsx` are dense, plan-cited"); `06-PATTERNS.md` reaffirms.
**Pattern:** every non-trivial new code block carries a 1-3 line comment that:
1. Cites the plan/decision ID (`Phase 7 OBSV-01`, `Phase 7 D-05`, etc.).
2. Names the canonical research path (`.planning/research/v1.1-SENTRY-ERRORBOUNDARY.md`, `.planning/research/v1.1-VITE-SOURCEMAPS.md`).
3. Explains *why* (pitfall avoided, behaviour secured) — not *what* (the code is the what).
**Apply to:** every Phase 7 new code block in `src/main.tsx`, `vite.config.ts`, `netlify.toml`, `src/routes/__smoke.tsx`, `src/components/debug/RenderThrowSmoke.tsx`.

### Build-time env-var re-export pattern
**Source:** `netlify.toml:7-12` (`VITE_COMMIT_SHA=$COMMIT_REF` shell substitution in `[build].command`).
```toml
command = "npm ci && VITE_COMMIT_SHA=$COMMIT_REF npm run build"
```
**Apply to:** `VITE_NETLIFY_CONTEXT=$CONTEXT` — same one-liner addition. RESEARCH.md Pattern 6 anti-pattern (line 452): NEVER use `[build.environment]` for `$`-substituting vars; only `[build].command` shell evaluates.

### TanStack file-route shape (flat-file)
**Source:** every existing route file. `src/routes/topics.tsx`, `src/routes/archive.tsx`, `src/routes/index.tsx`, `src/routes/admin/index.tsx`, `src/routes/auth/callback.tsx`. RESEARCH.md Pattern 3 lines 313-329.
**Pattern:**
```typescript
/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
// ...
interface RouteSearch { /* optional, narrow types */ }
export const Route = createFileRoute('<path>')({
  component: PageFn,
  validateSearch: (search) => { /* narrow */ },
  // optional: beforeLoad, loader, notFoundComponent
})
function PageFn() { /* component body using Route.useSearch() etc. */ }
```
**Apply to:** `src/routes/__smoke.tsx`. Diverge ONLY by adding `notFound` to imports + `beforeLoad` env-gate.

### Sentry import convention
**Source:** `src/main.tsx:4` (`import * as Sentry from '@sentry/react'`); `src/contexts/AuthContext.tsx`, `src/lib/auth-helpers.ts`, `src/routes/auth/callback.tsx`, `src/components/auth/AuthErrorPage.tsx`.
```typescript
import * as Sentry from '@sentry/react'
```
**Apply to:** any Phase 7 file that calls Sentry APIs — only `src/main.tsx` does, and the import is already present. No new files import Sentry directly (the `RenderThrowSmoke` component throws and lets the chain — root hooks → ErrorBoundary onError — capture it).

### Phase-VERIFICATION doc structure
**Source:** `.planning/phases/06-auth-fix-…/06-VERIFICATION.md`. See "Pattern Assignments → 07-VERIFICATION.md" above for exhaustive section list.
**Apply to:** `07-VERIFICATION.md`. Use the 12-section template verbatim, scaled to 5 SC rows + 7 artifact rows.

---

## No Analog Found

| File / Pattern | Reason | Mitigation |
|----------------|--------|------------|
| `src/components/debug/RenderThrowSmoke.tsx` (behaviour: unconditional render-phase throw) | Repo has no precedent for an intentionally-broken component. Closest neighbour `DebugAuthOverlay.tsx` is a richly-rendering diagnostic panel, not a throwing one. | Use RESEARCH.md Pattern 5 (lines 405-424) verbatim — 7-line file, named export, deterministic message string, no JSX. Place under `src/components/debug/` to inherit the existing "this directory is for development/diagnostic surfaces" convention. |
| `.planning/closure/` directory | Does not exist on this branch. RESEARCH.md D-11 + v1.1-SUMMARY.md describe the convention, but no instance has shipped yet. | Planner creates the directory; this Phase 7 file is first instance. Use the synthesis structure above (frontmatter + total table + per-chunk table + target check + raw build output). Future closure docs (UIDN-02, UIDN-03 carry-forward — `06-VERIFICATION.md` Requirements-Coverage row marks them "Pending intentional") can adopt this as their analog. |
| Sentry event verification UI screenshots | Phase 6 D-08 produced one Sentry symbolication screenshot (cited in `05-VERIFICATION.md ## Phase 6 Update`), but the Phase 7 evidence set demands **two screenshots + permalink + `.map` excerpt** — a richer evidence bundle. | Screenshots stored under `.planning/phases/07-observability-hardening/artifacts/` (CONTEXT D-10). Permalink + `.map` text excerpts committed inline in `07-VERIFICATION.md ## Human Verification Required`. Large binaries `.gitignore`-able at planner discretion. |

---

## Metadata

**Analog search scope:**
- `src/main.tsx` (existing entry-point — exhaustive read)
- `vite.config.ts` (full read)
- `netlify.toml` (full read)
- `src/routes/__root.tsx`, `src/routes/topics.tsx`, `src/routes/archive.tsx`, `src/routes/index.tsx` listings (route-file convention)
- `src/components/AppErrorFallback.tsx` (existing fallback for ErrorBoundary)
- `src/components/debug/DebugAuthOverlay.tsx` (debug-component neighbour)
- `.planning/phases/06-auth-fix-…/06-PATTERNS.md` (immediate prior PATTERNS analog — section conventions)
- `.planning/phases/06-auth-fix-…/06-VERIFICATION.md` (verification doc analog)
- `.planning/phases/07-observability-hardening/07-CONTEXT.md` (decision authority)
- `.planning/phases/07-observability-hardening/07-RESEARCH.md` (technical pattern source — Patterns 1-6, anti-patterns, Don't-Hand-Roll)

**Files scanned (Read):** 9 source/config files + 4 planning docs (07-CONTEXT, 07-RESEARCH partial, 06-PATTERNS, 06-VERIFICATION). Plus directory listings for `.planning/`, `.planning/research/`, `src/routes/`, `src/components/`, `src/components/debug/`.

**Pattern extraction date:** 2026-04-29.

**Analog ranking signal:** every Phase 7 file has a same-role analog already in repo EXCEPT (a) the `RenderThrowSmoke` behaviour (no in-repo precedent — RESEARCH.md Pattern 5 is the source of truth) and (b) the `.planning/closure/` doc path (first-instance — synthesis structure derived from VERIFICATION-doc table conventions + RESEARCH.md D-11..D-14). Both gaps are documented above with explicit mitigations.
