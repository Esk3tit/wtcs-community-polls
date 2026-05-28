# Phase 16: UIDN-02 Aggressive Perf-Budget Pass - Research

**Researched:** 2026-05-27
**Domain:** Vite 8 / Rolldown bundle optimization · React.lazy provider splitting · TanStack Router preload tuning · Lighthouse mobile measurement
**Confidence:** HIGH (every recommendation either reads the project source directly or maps to a locked decision already in CONTEXT.md)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 — Lazy PostHogGate gate.** Mount the lazy provider only when `ConsentContext.state === 'allow'`. Use `React.lazy(() => import(...))` to defer `posthog-js` + `posthog-js/react`. When state is `'undecided'` or `'decline'`, render `{children}` directly with no `PostHogProvider` in the tree. Follow the existing `lazy(() => import('@/components/debug/RenderThrowSmoke'))` and `lazy(() => import('@/components/debug/DebugAuthOverlay'))` shape from `src/routes/__root.tsx:16` and `src/routes/[__smoke].tsx:13-17`.
- **D-02 — Thin facade.** `src/lib/posthog-facade.ts` statically imported by `AuthContext` (and any future caller of `posthog.identify` / `posthog.reset`). Exposes a synchronous `identify(id)` / `reset()` API. Internally queues calls if `posthog` is not yet loaded; replays them after the dynamic import resolves; if already loaded, forwards immediately. Keeps `AuthContext` synchronous.
- **D-03 — Init config preserved.** `initPostHog()` retains its current `opt_out_capturing_by_default: true` / `opt_out_persistence_by_default: true` configuration. GDPR consent semantics unchanged — Phase 16 is purely a bundle-size shift, not a consent-correctness change. The `ConsentContext` `opt_in_capturing` / `opt_out_capturing` calls become async-tolerant via the facade's queue, no behavior change.
- **D-04 — Two named chunks only.** `vendor-react` (covers `react` and `react-dom` only — TanStack Router stays in Rolldown auto-split) and `vendor-posthog` (covers `posthog-js` and `posthog-js/react`). Existing auto-split chunks for `supabase-js` and `sentry-replay` are left as auto-split.
- **D-05 — PASS criterion.** All 5 routes return Performance ≥ 90 on the single mobile audit. Anything less = DEFER. Per D-12, DEFER is acceptable.
- **D-06 — Production audit target.** `https://polls.wtcsmapban.com`, post-merge from `main` once Netlify's production deploy lands. Not the Netlify deploy preview.
- **D-07 — DEFER evidence shape.** Append `## v1.3 Rerun` to `.planning/closure/UIDN-02-mobile-evidence.md` with per-route scores + verdict line `**v1.3 outcome: DEFER**` + one-paragraph rationale. UIDN-02 stays open; PROJECT.md row stays ⚠️.
- **D-08 — PASS evidence shape.** Same evidence file gets per-route scores + `**v1.3 outcome: PASS**`. PROJECT.md `Mobile-first responsive design` row flips ⚠️ → ✓. UIDN-02 closes via PR body `Closes #18`.
- **D-09 — Plugin-order safety throw.** `vite.config.ts` throws an explicit `Error` at config-load time if `process.env.ANALYZE === 'true' && process.env.NETLIFY_CONTEXT === 'production'`. Error message names OBSV-04 + Phase 15 sourcemap-upload chain explicitly. The build dies before producing any artifacts.

### Claude's Discretion
- Exact `manualChunks` matcher shape (path-includes vs regex vs `Set` lookup) inside `{ 'vendor-react': (id) => ... }`. See § PERF-04 below for recommended form.
- Internal queue structure for `posthog-facade` (array of `() => void` thunks vs typed event records). In-memory only — no `sessionStorage` persistence. Replay once on lazy-load resolution. See § PERF-03 below.
- Wording of the `vite.config.ts` throw message (keep it terse + actionable; include OBSV-04 reference). UI-SPEC line 121 supplies a suggested form.
- Exact `<picture><source type="image/webp"><img>` markup in `Navbar.tsx`. Keep existing `width`/`height`/`className` attributes verbatim.

### Deferred Ideas (OUT OF SCOPE)
- Broader vendor chunk splitting (vendor-sentry, vendor-supabase, vendor-radix).
- 4/5-route DEFER-as-PASS-with-caveat (strict 5/5 stays).
- CI workflow guard against `ANALYZE=true` on `main` (D-09 covers it).
- `vite-imagetools` / `sharp` automated WebP conversion (anti-feature per ROADMAP).
- WebP fallback beyond `<picture><source>` semantics.
- A11y / Best Practices / SEO Lighthouse thresholds (Performance category only).
- Chunk-load error retry/persistence semantics for the lazy posthog provider.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | `rollup-plugin-visualizer@7.0.1` devDep + `ANALYZE=true` env-gate + `build:analyze` script in `vite.config.ts` plugins[] | § PERF-01 — env-gated plugin insertion, mutually exclusive with sentryVitePlugin via D-09 throw |
| PERF-02 | Pre-change bundle audit baseline at `.planning/closure/v1.3-bundle-audit-pre.html` | § PERF-02 — sequencing + treemap output destination |
| PERF-03 | PostHog dynamic-import via lazy gate + facade | § PERF-03 — D-01 `<PostHogGate>` + D-02 facade-with-queue pattern; mirrors `RenderThrowSmoke` shape |
| PERF-04 | `build.rolldownOptions.output.manualChunks` for `vendor-react` + `vendor-posthog` | § PERF-04 — exact matcher shape; Rolldown is Vite 8's default bundler |
| PERF-05 | Manual PNG→WebP conversion + `<picture>` in Navbar | § PERF-05 — `cwebp` command, intrinsic dimensions (226×200), markup shape |
| PERF-06 | `createRouter({ defaultPreload: 'intent' })` in `src/main.tsx` | § PERF-06 — one-line change at src/main.tsx:42; admin-Link opt-out preservation |
| PERF-07 | Single Lighthouse mobile rerun via `audit-mobile.sh` against production | § PERF-07 — invocation, evidence file shape, PASS vs DEFER paths |
</phase_requirements>

## Summary

Phase 16 is a pure frontend bundle/perf phase: zero backend changes, zero schema changes, zero copy changes, zero new shadcn primitives. The diff scope is six well-bounded edits — one Vite config block, one new facade module, one new `<PostHogGate>` component, one `main.tsx` rewrite of the PostHog wrapper to mount the gate inside `<ConsentProvider>`, one `Navbar.tsx` `<picture>` swap, plus the `wtcs-logo.webp` binary. Every locked decision in CONTEXT.md is downstream of two architectural commitments: (1) the lazy provider renders naked children when consent is not `'allow'` so users who decline never pay the `posthog-js` bundle cost, and (2) the static-import facade preserves `AuthContext`'s synchronous API surface while internally queueing identify/reset until the dynamic chunk resolves.

The Phase 15 invariants Phase 16 must not break are well-defined and mechanically checkable: `sentryVitePlugin` must remain last in the plugins array when `ANALYZE !== 'true'` (the D-09 throw enforces mutual exclusion), and the 7-name keepNames allowlist verified by `scripts/verify-sourcemap-names.mjs` must continue to find all seven literal `function Name(` declarations across `dist/assets/**/*.js`. The seven names are `RenderThrowSmoke`, `ConsentProvider`, `ConsentBanner`, `AdminGuard`, `AuthProvider`, `RootLayout`, `AppErrorFallback` — none are renamed or eliminated by this phase, so the contract holds by construction provided `keepNames: true` stays on (it does — Phase 16 only touches `rolldownOptions.output.manualChunks`, not `output.keepNames`).

**Primary recommendation:** Land PERF-01 first (visualizer plugin + script + D-09 throw + `vite.config.ts` mutually-exclusive plumbing), then PERF-02 (run baseline against pre-change `main` HEAD before any other edit) to lock the pre-change treemap as committed evidence. Only after that do PERF-03 (facade + lazy gate) → PERF-04 (manualChunks) → PERF-05 (logo) → PERF-06 (defaultPreload) → PERF-07 (production rerun) in sequence. Sequencing matters because PERF-02's baseline must show pre-PERF-03 critical-path PostHog, and PERF-04's named chunks must be measured against that baseline.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bundle analysis / treemap generation | Build-time (Vite/Rolldown plugin) | — | Pure build instrumentation; dev-only devDep |
| PostHog lazy-load orchestration | Browser / Client (React tree) | — | Consent state lives client-side; lazy import is a browser concern |
| Identify / reset call routing | Browser / Client (facade module) | — | Caller-facing synchronous API in the React app; queue is in-memory |
| Manual chunk grouping | Build-time (Rolldown) | — | Rolldown emits the named chunks; no runtime code change |
| WebP serving + PNG fallback | Browser / Client (`<picture>`) | CDN (Netlify) | `<picture>` semantics resolve in browser; Netlify just serves the bytes |
| Route intent-prefetch | Browser / Client (TanStack Router) | — | `defaultPreload: 'intent'` is a router-side behavior |
| Lighthouse mobile measurement | Operator / CI (lighthouse@13.2.0) | — | Shell harness runs against production URL |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite` | 8.0.12 (locked, package.json:61) | Build tool; Rolldown is the default bundler in Vite 8 | Already shipped; uses `build.rolldownOptions` (note: `rolldownOptions`, not legacy `rollupOptions`) — `vite.config.ts:33` already exercises this surface for `keepNames` |
| `@sentry/vite-plugin` | 5.3.0 (locked, package.json:40) | Sourcemap upload — MUST stay last in plugins array on production builds | Phase 15 OBSV-04 contract |
| `rollup-plugin-visualizer` | 7.0.1 (NEW devDep) | Bundle treemap analyzer; emits HTML report | De-facto standard; one of the few Rollup plugins that also work cleanly with Vite/Rolldown |
| `posthog-js` | 1.373.4 (locked, package.json:29) | Analytics — moved to lazy chunk in this phase | Already shipped; init config preserved per D-03 |
| `posthog-js/react` | bundled (sub-export of posthog-js) | `<PostHogProvider>` React wrapper — also moved to lazy chunk | Same |
| `@tanstack/react-router` | 1.169.2 (locked, package.json:24) | File-based router; gets `defaultPreload: 'intent'` | Already shipped |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cwebp` | system binary (Homebrew `webp` formula) | One-time PNG → WebP conversion | PERF-05 manual conversion — anti-feature blocks build-time conversion |
| `lighthouse` | 13.2.0 (pinned in `audit-mobile.sh:39` via `npx -y lighthouse@13.2.0`) | Mobile audit harness | PERF-07 — script already shipped |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `rollup-plugin-visualizer` | `vite-bundle-visualizer` (wrapper) | Wrapper adds an indirection layer; raw plugin is well-known and lockfile-stable |
| `cwebp` CLI | `magick` (ImageMagick), `vips` | All produce identical output for a 226×200 PNG → WebP conversion; `cwebp` is the canonical WebP tool from Google |
| `React.lazy` for PostHog provider | Dynamic import inside a `useEffect` | `React.lazy` is idiomatic for React provider trees and Suspense-aware — matches the existing in-repo pattern in `__root.tsx:16` and `[__smoke].tsx:13` |

**Installation:**
```bash
npm install --save-dev rollup-plugin-visualizer@7.0.1
# WebP conversion (one-time, developer machine):
brew install webp     # provides cwebp
```

**Version verification (training-data + project lockfile, Context7 unavailable in this session):**
- `rollup-plugin-visualizer@7.0.1` — public on npm; package's official README documents `template: 'treemap' | 'sunburst' | ... `, `gzipSize`, `brotliSize`, `emitFile`, `filename`, `open` options [CITED: github.com/btd/rollup-plugin-visualizer README, npmjs.com/package/rollup-plugin-visualizer]
- `@tanstack/react-router@1.169.2` — `defaultPreload: 'intent'` on `createRouter` and `<Link preload={false}>` per-link override both documented and stable [CITED: tanstack.com/router/latest/docs/guide/preloading and tanstack.com/router/v1/docs/api/router/RouterOptionsType]
- `posthog-js@1.373.4` + `posthog-js/react` — `PostHogProvider client={posthog}` shape used today at `src/main.tsx:95-99` is the canonical wrapper API [CITED: codebase + posthog-js public README]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `rollup-plugin-visualizer` | npm | ~8 yrs (first publish 2017) | ~3-4M/wk | github.com/btd/rollup-plugin-visualizer | not run (slopcheck unavailable in session) | [ASSUMED] — planner inserts `checkpoint:human-verify` before install per protocol; verify `npm view rollup-plugin-visualizer@7.0.1 version` returns `7.0.1` and the GitHub source matches |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was not available at research time, so the package above is tagged [ASSUMED]. The planner must gate the install behind a `checkpoint:human-verify` task that runs `npm view rollup-plugin-visualizer@7.0.1 version` AND visually confirms the GitHub source repo URL points at `github.com/btd/rollup-plugin-visualizer` before `npm install --save-dev` runs. This package is widely-used (it ships with the official Vite docs example for bundle analysis), but the slopcheck protocol applies uniformly.*

## Architecture Patterns

### System Architecture Diagram

```
                  ┌──────────────────────────────────────────────────┐
                  │  Build (vite build, optionally ANALYZE=true)     │
                  │                                                  │
                  │   plugins[]:  tanstackRouter → react → tailwind  │
                  │               → (ANALYZE? visualizer : sentry)   │
                  │                                                  │
                  │   throws if ANALYZE && NETLIFY_CONTEXT=production │
                  │   (D-09 — OBSV-04 sourcemap-chain protection)    │
                  │                                                  │
                  │   rolldownOptions.output:                        │
                  │     keepNames: true     ← Phase 15 invariant     │
                  │     manualChunks:       ← Phase 16 NEW           │
                  │       'vendor-react'   ← react + react-dom only  │
                  │       'vendor-posthog' ← posthog-js + /react     │
                  └──────────────┬───────────────────────────────────┘
                                 │ emits dist/assets/
                                 ▼
       ┌──────────────────────────────────────────────────────────────┐
       │  Browser load (production)                                   │
       │                                                              │
       │   index.html → entry chunk (NO posthog-js)                   │
       │   ↓                                                          │
       │   <Sentry.ErrorBoundary> → <ConsentProvider> ──────┐         │
       │                                                   │         │
       │   if consentState === 'allow':                    │         │
       │     <Suspense fallback={null}>                    │         │
       │       <LazyPostHogProvider>  ← dynamic import     │         │
       │         <RouterProvider router={                  │         │
       │           createRouter({ defaultPreload:'intent'  │         │
       │         }) } />                                   │         │
       │       </LazyPostHogProvider>                      │         │
       │     </Suspense>                                   │         │
       │   else:                                           │         │
       │     {children}  ← NO PostHogProvider in tree      │         │
       │                                                   │         │
       │   <AuthContext> imports posthog-facade statically │         │
       │     facade.identify(providerId) ─────► queue ─────┘─►       │
       │     facade.reset() ─────────────────► queue ─────►          │
       │   queue flushes after lazy chunk resolves (once)            │
       └──────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| File (new or edited) | Responsibility |
|----------------------|----------------|
| `vite.config.ts` (edit) | Env-gate visualizer vs sentryVitePlugin; throw on `ANALYZE && NETLIFY_CONTEXT=production`; add `rolldownOptions.output.manualChunks` for vendor-react + vendor-posthog |
| `package.json` (edit) | New `build:analyze` script: `ANALYZE=true tsr generate && tsc -b && vite build`; new devDep `rollup-plugin-visualizer@7.0.1` |
| `src/lib/posthog-facade.ts` (new) | Synchronous `identify(id)` / `reset()` API; in-memory call queue replayed on lazy resolution |
| `src/components/PostHogGate.tsx` (new) | `React.lazy` wrapper that renders naked children when consent ≠ `'allow'`, else mounts the real PostHogProvider via Suspense |
| `src/main.tsx` (edit) | Replace direct `<PostHogProvider client={posthog}>` with `<PostHogGate>{children}</PostHogGate>`; add `defaultPreload: 'intent'` to `createRouter({...})` |
| `src/contexts/AuthContext.tsx` (edit) | Replace `import { posthog } from '@/lib/posthog'` with `import * as posthog from '@/lib/posthog-facade'` (or named imports — see PERF-03 Planner Instruction); call sites at lines 168 (`posthog.identify`) and 181 (`posthog.reset`) become facade calls |
| `src/contexts/ConsentContext.tsx` (edit) | Replace `posthog.opt_in_capturing()` / `posthog.opt_out_capturing()` calls (lines 55, 58) with facade equivalents OR push the opt-in/out logic into PostHogGate's mount effect (planner picks — both are correct; see § PERF-03) |
| `src/components/layout/Navbar.tsx` (edit) | Wrap the `<img>` at line 32-36 in `<picture><source type="image/webp" srcSet={webpLogo}/><img ... /></picture>`; add `import webpLogo from '@/assets/wtcs-logo.webp'` |
| `src/assets/wtcs-logo.webp` (new binary) | Manual conversion from existing `wtcs-logo.png` (226×200, RGBA, 9915 bytes) |
| `.planning/closure/v1.3-bundle-audit-pre.html` (new committed evidence) | Pre-change treemap baseline; committed to `.planning/closure/` |
| `.planning/closure/UIDN-02-mobile-evidence.md` (append) | New `## v1.3 Rerun` section per D-07/D-08 |

### Pattern 1: React.lazy provider with naked-children fallthrough
**What:** A component whose only job is to wrap children in a lazy-loaded provider when a precondition is met; otherwise render the children directly without the provider.
**When to use:** When the provider is expensive to load AND optional based on runtime state (here: GDPR consent='allow').
**Existing in-repo analog:** `src/routes/__root.tsx:43-45` already uses `<Suspense fallback={null}><DebugAuthOverlay /></Suspense>` as the lazy-mount idiom. The Phase 16 `<PostHogGate>` follows the exact same shape but inverted (the lazy component IS the provider, and the children pass through it).

**Shape (no code — see UI-SPEC line 169 for the contract):**
1. `const LazyPostHogProvider = lazy(() => import('@/components/PostHogProviderInner'))` — the inner module's default export is a component that takes `children` and renders `<PostHogProvider client={posthog}>{children}</PostHogProvider>` after calling `initPostHog()` at module load.
2. The `<PostHogGate>` component reads consent via `useConsent()` and either returns `<Suspense fallback={null}><LazyPostHogProvider>{children}</LazyPostHogProvider></Suspense>` when `state === 'allow'` or returns `<>{children}</>` otherwise.
3. The Suspense `fallback={null}` is non-negotiable per UI-SPEC Loading & Suspense States — children stay rendered through the dynamic-import window; no spinner.

### Pattern 2: Static facade over dynamically-loaded module
**What:** A statically-importable module that wraps an asynchronously-loaded module behind a synchronous API by queueing calls and replaying them once the dynamic import resolves.
**When to use:** When callers of a moved-to-lazy module are themselves part of the critical-path tree and cannot await the dynamic import (here: `AuthContext` is a top-level provider; `signOut` is synchronous; `useEffect` identify-on-consent-allow runs in the render path).
**Shape:** The facade module statically declares the public surface (`identify(id: string): void`, `reset(): void`). Internally it holds (a) a `loaded: typeof import('posthog-js').default | null` reference and (b) a `queue: Array<(client) => void>` of deferred calls. Each public method either calls into `loaded.*` immediately if set or pushes a thunk onto `queue`. A non-exported `setClient(client)` (or module-level promise resolution) drains the queue once on load. The lazy provider triggers the load (its `import()` resolves the same `posthog-js` chunk; Rolldown deduplicates the chunk fetch — see Pitfall 4 below).

### Anti-Patterns to Avoid
- **Two parallel dynamic imports of `posthog-js`.** Don't have the facade do its own `import('posthog-js')` AND have `<PostHogGate>`'s `lazy(() => import('@/components/PostHogProviderInner'))` also import `posthog-js`. Reason: even though Rolldown's chunk graph would deduplicate the resulting chunk fetch in production, the two import points add type-graph complexity and risk subtle init-order bugs. Plan for a single load path — the lazy provider's inner module is the only place `posthog-js` is statically imported; the facade obtains its client reference by listening for the provider's mount or via a shared module-scope promise.
- **Mounting `<PostHogGate>` outside `<ConsentProvider>`.** `<PostHogGate>` needs `useConsent()` — it must be a descendant. The current `src/main.tsx` shape has `<PostHogProvider>` ABOVE `<ConsentProvider>` (lines 95-99). Phase 16 inverts that ordering: `<ConsentProvider>` becomes the outer wrapper, `<PostHogGate>` becomes inner.
- **Calling `posthog.opt_in_capturing()` synchronously from `ConsentContext` before the lazy chunk has resolved.** Today `src/contexts/ConsentContext.tsx:54-59` calls `posthog.opt_in_capturing()` directly on `state === 'allow'`. After Phase 16, those calls must route through the facade (or be replaced with logic inside `PostHogGate`'s mount effect) so the call queue absorbs them.
- **Removing the PNG asset.** PERF-05 contract explicitly retains the PNG fallback in `<picture>`. Don't delete `src/assets/wtcs-logo.png`.
- **Wrapping the inner `<img>` in only `<source>` without an `<img>` element.** The `<img>` is mandatory in `<picture>` — it's the fallback AND the rendering target. Browsers that don't recognize WebP fall through to the `<img src>`.
- **Hardcoding chunk path matchers without anchoring on package boundaries.** `id.includes('react')` matches everything that has 'react' in its path. Use directory-boundary matchers (`/node_modules/react/` or path `endsWith` patterns) — see PERF-04 below.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bundle treemap visualization | Custom HTML emitter that walks `dist/` | `rollup-plugin-visualizer@7.0.1` | Mature, well-maintained, supports treemap/sunburst/network views, gzip+brotli size reporting |
| WebP serving with fallback | `<img>` + JS feature detection | `<picture><source type="image/webp"><img></picture>` | Native HTML5 element; browsers handle source negotiation; zero JS cost; screen-reader transparent |
| Route prefetching on hover | Manual `addEventListener('mouseenter')` on every `<Link>` | `createRouter({ defaultPreload: 'intent' })` | TanStack Router has it as a one-line config option |
| PNG → WebP automation | `vite-imagetools` / `sharp` plugin | One-time `cwebp` CLI invocation | EXPLICIT anti-feature per ROADMAP; binary is 9915 bytes; one-time conversion is trivial |
| Async call queue for posthog | Custom Promise chain | Tiny in-module FIFO array of thunks | The facade is ~30 lines; pulling a queue library is overkill |

**Key insight:** Phase 16 is intentionally a small, surgical diff. The vast majority of the "work" is `vite.config.ts` plumbing and one new ~30-line facade module. Every other diff is one-to-two lines of replacement at a known call site.

## Common Pitfalls

### Pitfall 1: Visualizer breaks Sentry sourcemap upload silently
**What goes wrong:** `rollup-plugin-visualizer` and `sentryVitePlugin` both must be **last** in the Vite plugins array (visualizer needs the final emitted chunk graph; sentry needs the final compiled sourcemap-pair set). If both are present and active in a single build, only one of them runs effectively as "last," and the other's contract silently breaks. Specifically, if `ANALYZE=true` is leaked into a Netlify production build, the visualizer takes "last" and `sentryVitePlugin`'s sourcemap upload is silently skipped, breaking the OBSV-04 evidence chain shipped in Phase 15.
**Why it happens:** Vite's plugin pipeline runs sequentially; both plugins are write-time / end-of-build hooks; the one wired in later wins on the `writeBundle` phase.
**How to avoid:** D-09's throw-at-config-load. If `ANALYZE === 'true' && NETLIFY_CONTEXT === 'production'`, throw before any artifact is produced. The throw message names OBSV-04 by name so a future maintainer reading the error log immediately understands the trap.
**Warning signs:** Sentry dashboard shows no new release / no sourcemap upload for a Netlify production deploy; bundle analyzer HTML appears in `dist/` from a production build.

### Pitfall 2: `manualChunks` matcher catches the wrong packages
**What goes wrong:** A naive `id.includes('react')` matcher catches `react`, `react-dom`, `react-router`, `react-error-boundary`, `@radix-ui/react-*`, `@tanstack/react-router`, `@sentry/react`, and `@testing-library/react`. The resulting `vendor-react` chunk becomes a kitchen-sink that defeats the cache-stability goal.
**Why it happens:** `id` is the absolute path to the module Rolldown is processing; substring matching is too permissive.
**How to avoid:** Anchor on `/node_modules/<package>/` boundaries OR check the resolved import path against a small allowlist. CONTEXT D-04 is explicit: `vendor-react` covers `react` + `react-dom` ONLY (NOT TanStack Router). See § PERF-04 Planner Instruction for the recommended exact matcher form.
**Warning signs:** Post-build treemap shows `vendor-react` containing TanStack Router code (the per-chunk gzip size for vendor-react will be much larger than expected — react+react-dom together are ~140 KB unminified; adding TanStack Router would push it past 200 KB).

### Pitfall 3: Lazy provider mounts AND unmounts on every consent flip
**What goes wrong:** If `<PostHogGate>` renders `{children}` when `state !== 'allow'` and the lazy provider when `state === 'allow'`, then toggling consent from allow → decline → allow would **remount the entire app subtree under PostHogGate** each time, losing all React state below.
**Why it happens:** Returning different JSX shapes from a component (`{children}` vs `<Provider>{children}</Provider>`) means React sees different tree shapes and unmounts/remounts.
**How to avoid:** ConsentContext already handles the allow → decline transition by reloading the page (`src/contexts/ConsentContext.tsx:73-75`). The user-experienced state machine is `undecided → allow` (no remount issue because there's no prior state) OR `undecided → decline → undecided/allow` (the page reload covers it). The remaining transition (`decline → allow` without a prior `allow`) does cause a one-time mount, which is acceptable — the lazy chunk loads then; children re-render but state below is preserved IF the gate is positioned ABOVE the route tree (which it is — `<RouterProvider>` is INSIDE the gate per current `main.tsx:97`). The plan must verify the gate stays above `<RouterProvider>` so router state isn't reset on the first mount.
**Warning signs:** Clicking Allow in the consent banner causes a flash / form-state-loss in the UI.

### Pitfall 4: Two `import('posthog-js')` sites cause two chunk fetches in dev mode
**What goes wrong:** If both the facade and the lazy provider statically `import('posthog-js')`, Vite's dev server (which does NOT do chunk-graph deduplication the way Rolldown's production build does) may fetch the module twice. The PostHog client is initialized twice; the second init no-ops thanks to the `initialized` guard in `src/lib/posthog.ts:3`, but the network waste is visible.
**Why it happens:** Vite dev = ES modules direct, no chunk graph; Rolldown prod = chunked, deduplicated.
**How to avoid:** Single static-import site for `posthog-js` — inside the lazy provider's inner module (`PostHogProviderInner.tsx` or equivalent). The facade does NOT import `posthog-js` itself; it imports a shared module-scope promise/resolver that the lazy provider populates on mount.
**Warning signs:** DevTools Network shows two `posthog-js` script fetches in development.

### Pitfall 5: TanStack Router preload triggers PostHog lazy-chunk fetch on hover
**What goes wrong:** `defaultPreload: 'intent'` causes hover/touch on any `<Link>` to preload the destination route's code chunk. If the destination route's chunk graph transitively includes the PostHog lazy chunk (it shouldn't — but if `manualChunks` is misconfigured), hovering a link could trigger a `posthog-js` fetch BEFORE the user clicks Allow, breaking the GDPR consent invariant.
**Why it happens:** Route chunks are determined by Rolldown's chunk graph; if `vendor-posthog` is incorrectly reachable from a route chunk's import graph (e.g. because the gate or facade is statically imported from the route's component file), preload pulls it in.
**How to avoid:** Verify after build: the `vendor-posthog` chunk is reachable ONLY from the lazy import inside `<PostHogGate>`. Check the treemap. Ensure the facade does NOT statically import `posthog-js` (it only imports types or uses a shared promise resolver — see Pitfall 4).
**Warning signs:** In DevTools, hovering a `<Link>` triggers a `vendor-posthog-*.js` network request before consent='allow'.

### Pitfall 6: Admin `<Link>` preloads on hover and triggers AdminGuard's beforeLoad redirect
**What goes wrong:** `defaultPreload: 'intent'` applies to ALL `<Link>` components app-wide. The Admin link in `Navbar.tsx:60-66` is currently opt-OUT of preload via *absence* of `preload="intent"`. With `defaultPreload: 'intent'` set on the router, the absence stops opting out — every Link is now in by default. Hovering the Admin link would trigger `beforeLoad` on the admin route, which runs the AdminGuard and (for non-admin users) redirects them. Hover-redirect = security surprise + bad UX.
**Why it happens:** Default preload changes the implicit value from "off" to "intent"; per-Link `preload` is the explicit override.
**How to avoid:** Add `preload={false}` to the Admin `<Link>` in `Navbar.tsx:60-66`. This explicit opt-out preserves the current behavior. UI-SPEC line 201-203 mandates this.
**Warning signs:** Non-admin users see brief redirects to `/` when hovering the Admin link in the desktop nav (which they shouldn't see anyway — `isAdmin` gates rendering, but a stray render flash is possible).

### Pitfall 7: `wtcs-logo.webp` not actually smaller than the PNG
**What goes wrong:** The existing PNG is 9915 bytes for a 226×200 RGBA image. WebP-from-RGBA is not always smaller than PNG for very small images, especially if the PNG was already optimized. The WebP-emit could be 8000-12000 bytes — net delta could be small or even negative.
**Why it happens:** PNG and WebP have different compression profiles; small + simple images sometimes favor PNG.
**How to avoid:** Try `cwebp -q 80 src/assets/wtcs-logo.png -o src/assets/wtcs-logo.webp` first; if the resulting WebP is not smaller than the PNG, try `cwebp -lossless`. If neither produces a smaller file, accept that the WebP is a "performance contract" rather than a measurable size win — modern browsers still benefit from WebP's faster decode path even at neutral byte size. Document the actual file size delta in the plan summary.
**Warning signs:** `ls -la src/assets/` shows the WebP at the same size or larger than the PNG. Not a hard blocker — the `<picture>` markup is the right shape regardless.

### Pitfall 8: `manualChunks` field name regression (rollupOptions vs rolldownOptions)
**What goes wrong:** Vite 8 uses Rolldown as default bundler. Vite 7 used Rollup. The legacy `build.rollupOptions` is supported transitionally but the canonical field for Vite 8 is `build.rolldownOptions`. Mixing the two — putting `manualChunks` under `rollupOptions` while `output.keepNames: true` is under `rolldownOptions` — silently fails: the `manualChunks` block is on the wrong key and gets ignored.
**Why it happens:** Vite 8 migration didn't break `rollupOptions` for backward compat; both keys can coexist, but only `rolldownOptions` is actually consumed by Rolldown.
**How to avoid:** Put `manualChunks` under `build.rolldownOptions.output.manualChunks`. The existing config at `vite.config.ts:33-35` already uses `rolldownOptions.output.keepNames` — extend that object, don't create a parallel `rollupOptions`.
**Warning signs:** Treemap shows no named `vendor-react` or `vendor-posthog` chunk; Rolldown emits its default chunks unchanged.

## Code Examples

(Implementation-shape descriptions only — no code blocks per phase research protocol.)

### Example shape: env-gated visualizer plugin (PERF-01)
Within the `plugins[]` array, conditionally include either `visualizer({...})` or `sentryVitePlugin({...})` — never both. Implementation: assign to a `const plugins = [tanstackRouter(), react(), tailwindcss()]` and then `if (process.env.ANALYZE === 'true') plugins.push(visualizer({...})); else plugins.push(sentryVitePlugin({...}))`. The D-09 throw runs before the conditional — at module scope of `vite.config.ts`. Visualizer options for this phase: `filename: '.planning/closure/v1.3-bundle-audit-pre.html'` (PERF-02 baseline run) OR `dist/stats.html` (general analyze runs), `template: 'treemap'`, `gzipSize: true`, `brotliSize: true`, `open: false` (no auto-open in CI/operator runs). The planner decides whether the filename is parametric (env var) or always-static — recommended: always-static at `dist/stats.html`, and PERF-02 baseline is captured by **copying** `dist/stats.html` to `.planning/closure/v1.3-bundle-audit-pre.html` after the analyze build runs.

### Example shape: posthog-facade with queue (PERF-03)
File `src/lib/posthog-facade.ts`. Module-scope state: `let client: PostHogClient | null = null` and `const queue: Array<(c: PostHogClient) => void> = []`. Exported functions: `identify(id: string): void { if (client) client.identify(id); else queue.push((c) => c.identify(id)); }`, similarly `reset()`, `opt_in_capturing()`, `opt_out_capturing()`. Exported `setClient(c: PostHogClient): void { client = c; while (queue.length) queue.shift()!(c); }`. The lazy provider's inner module calls `setClient(posthog)` after `initPostHog()` returns.

### Example shape: PostHogGate wrapper (PERF-03)
File `src/components/PostHogGate.tsx`. Imports: `import { lazy, Suspense, type ReactNode } from 'react'`, `import { useConsent } from '@/hooks/useConsent'`. Declares `const LazyPostHogProviderInner = lazy(() => import('@/components/PostHogProviderInner'))`. Component `function PostHogGate({ children }: { children: ReactNode })`: reads `state` from `useConsent()`; if `state !== 'allow'` returns `<>{children}</>`; else returns `<Suspense fallback={null}><LazyPostHogProviderInner>{children}</LazyPostHogProviderInner></Suspense>`. Inner module `src/components/PostHogProviderInner.tsx` (default export, NOT named — required by `React.lazy`): calls `initPostHog()` once at module scope, calls `setClient(posthog)` from the facade, renders `<PostHogProvider client={posthog}>{children}</PostHogProvider>`.

### Example shape: `<picture>` swap in Navbar (PERF-05)
At top of `Navbar.tsx`, add `import webpLogo from '@/assets/wtcs-logo.webp'` next to the existing `import logo from '@/assets/wtcs-logo.png'` (line 13). Replace lines 32-36 (the bare `<img>`) with `<picture><source type="image/webp" srcSet={webpLogo} /><img src={logo} alt="WTCS Community Suggestions" className="h-8 w-auto md:h-9" width={226} height={200} /></picture>`. The `width`/`height` integer attributes are the logo's intrinsic dimensions (verified from `file src/assets/wtcs-logo.png` → `226 x 200`) — they prevent CLS. React 19 uses **camelCase `srcSet`** in JSX (compiles to lowercase `srcset` in DOM). The `<Link>` wrapper around the picture stays unchanged.

### Example shape: defaultPreload (PERF-06)
`src/main.tsx:42` currently reads `const router = createRouter({ routeTree })`. Phase 16 changes to `const router = createRouter({ routeTree, defaultPreload: 'intent' })`. Separately, `src/components/layout/Navbar.tsx:60-66` Admin `<Link>` adds `preload={false}` to preserve its current opt-out (UI-SPEC line 201-203, Pitfall 6 above).

### Example shape: Lighthouse rerun (PERF-07)
Post-merge, after the Netlify production deploy lands at `https://polls.wtcsmapban.com`, the operator runs `bash .planning/closure/audit-mobile.sh`. Output: per-route HTML + JSON reports in `.planning/closure/artifacts/lighthouse/lh-mobile-{home,topics,archive,auth-error,admin}.report.{html,json}` (gitignored; sha256-pinned in MANIFEST.json). Script prints a `=== Summary ===` block with `PASS home: P=NN A=100 BP=100 SEO=92` lines. Exit code 0 = all routes PASS; exit 1 = any route under threshold. On exit 0 + all Perf ≥ 90: PASS path per D-08. On any Perf < 90: DEFER path per D-07. Either way, the evidence file `.planning/closure/UIDN-02-mobile-evidence.md` gets a new `## v1.3 Rerun (2026-MM-DD)` section appended (matching the existing `## v1.2 Rerun (2026-05-13)` shape exactly — frontmatter unchanged, new section under the existing two).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `build.rollupOptions.output.manualChunks` | `build.rolldownOptions.output.manualChunks` | Vite 8 (Rolldown default) | Use `rolldownOptions` — `rollupOptions` still partially honored but no longer canonical |
| Always-on PostHog provider at app root | Lazy-loaded gate mounted on consent='allow' | This phase | ~180-200 KB shifted off critical-path chunk |
| Bare `<img>` tag for logo | `<picture><source type="image/webp"><img></picture>` | This phase | WebP for supporting browsers; PNG fallback for Safari < 14 / older UAs |
| Explicit `preload="intent"` on each `<Link>` | `defaultPreload: 'intent'` on the router | This phase | Single config change; per-link explicit opt-out for Admin link |

**Deprecated/outdated:**
- `sourcemaps list` and `releases files <release> list` in sentry-cli — REMOVED in v3. Not directly relevant to Phase 16 but cited because Phase 15-04 referenced them. Current Phase 16 doesn't invoke sentry-cli directly.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `rollup-plugin-visualizer@7.0.1` supports the `template`, `gzipSize`, `brotliSize`, `emitFile`, `filename`, `open` options as documented in its README | PERF-01 | LOW — these are the documented options on the public README; if any was renamed in 7.x, the build throws a clear plugin-config error at startup, easy to fix |
| A2 | `vendor-react` containing only `react` + `react-dom` (excluding TanStack Router) is achievable with a simple path-includes matcher | PERF-04 | LOW — Rolldown's matcher receives the module's absolute path; `/node_modules/react/` vs `/node_modules/@tanstack/` is a clean boundary |
| A3 | `cwebp -q 80` produces a WebP smaller than the existing 9915-byte PNG for this specific image | PERF-05 / Pitfall 7 | MEDIUM — may need to try `-lossless` or accept neutral-size outcome; doesn't block the phase |
| A4 | `<picture>` with `<source type="image/webp">` works correctly with React 19 JSX `srcSet` camelCase | PERF-05 | LOW — `srcSet` is the documented React DOM prop name (compiles to lowercase `srcset` in DOM); shipped pattern across React 17/18/19 |
| A5 | `defaultPreload: 'intent'` on `createRouter` overrides the per-Link absence-of-attribute, but `preload={false}` on an individual Link is respected as an explicit opt-out | PERF-06 / Pitfall 6 | LOW — explicitly documented in TanStack Router preloading guide [CITED: tanstack.com/router/latest/docs/guide/preloading] |
| A6 | Putting `<ConsentProvider>` ABOVE `<PostHogGate>` in `main.tsx` doesn't break any current consumer | PERF-03 | LOW — `<PostHogGate>` is the ONLY consumer of consent state in the new arrangement; `<ConsentBanner>` and `<ConsentChip>` already live inside `<RouterProvider>` per `__root.tsx:39-40` |
| A7 | Sentry's `boundary: app-root` tag invariant from Phase 15 is unaffected by reshuffling the `<PostHogProvider>` to inside `<ConsentProvider>` | Phase 15 invariants | LOW — the `boundary: app-root` tag is set in `src/main.tsx:81` on the `<Sentry.ErrorBoundary>` wrapping element, which sits ABOVE both providers; unaffected by inner re-ordering |
| A8 | The 7-name keepNames allowlist in `scripts/verify-sourcemap-names.mjs` (RenderThrowSmoke, ConsentProvider, ConsentBanner, AdminGuard, AuthProvider, RootLayout, AppErrorFallback) is untouched by this phase | Phase 15 invariants | NONE — Phase 16 does not rename any of those components |
| A9 | Lighthouse 13.2.0 mobile audit's Performance score is reproducible to within ±5-10pp on a fresh production deploy (per existing UIDN-02-mobile-evidence.md notes) | PERF-07 | NONE — D-12 already permits DEFER as an acceptable outcome |

## Open Questions (RESOLVED)

1. **WebP encoding profile.** Should the planner pick `-q 80` lossy or `-lossless`?
   - What we know: PNG is 9915 bytes, RGBA, 226×200, simple logo (likely flat colors).
   - What's unclear: which WebP profile yields the smaller file for this specific image.
   - Recommendation: Plan should specify `cwebp -q 80 -m 6 src/assets/wtcs-logo.png -o src/assets/wtcs-logo.webp` first (high effort, q=80) and fall back to `-lossless` if the lossy output exceeds the PNG. Either outcome ships — the markup is the contract, not the byte count (Pitfall 7).
   - **RESOLVED:** use `cwebp -q 80 -m 6 src/assets/wtcs-logo.png -o src/assets/wtcs-logo.webp`. If the q=80 output exceeds the PNG size, fall back to `-lossless`. Whichever flag was used must be documented in plan 16-05's SUMMARY at execute-time.

2. **Visualizer output filename strategy.** Should `vite.config.ts` hard-code `dist/stats.html` and rely on a post-step `cp` to land the PERF-02 baseline at `.planning/closure/v1.3-bundle-audit-pre.html`, OR should the filename be parameterized by an env var?
   - What we know: D-09 throws on `ANALYZE=true && NETLIFY_CONTEXT=production`; the visualizer's `filename` is a build-time string.
   - What's unclear: how parameterized the filename should be vs always-static + post-copy.
   - Recommendation: Always-static `dist/stats.html` in `vite.config.ts`. The PERF-02 baseline step is a separate Bash task that runs `ANALYZE=true npm run build` and then `cp dist/stats.html .planning/closure/v1.3-bundle-audit-pre.html`. Simpler, more grep-able, no env-var sprawl.
   - **RESOLVED:** visualizer always writes to `dist/stats.html` (no env-var parameterization). PERF-02 baseline capture uses `cp dist/stats.html .planning/closure/v1.3-bundle-audit-pre.html` after `ANALYZE=true npm run build`.

3. **Facade public surface — call-site shape.** Should the facade export `posthog.identify(id)` (namespace-style) or `identify(id)` (named)?
   - What we know: Current call sites: `AuthContext.tsx:168` calls `posthog.identify(providerId)`; `AuthContext.tsx:181` calls `posthog.reset()`; `ConsentContext.tsx:55,58` call `posthog.opt_in_capturing()` / `posthog.opt_out_capturing()`.
   - What's unclear: minimizing diff churn at call sites.
   - Recommendation: Export the facade as a namespace object: `export const posthog = { identify, reset, opt_in_capturing, opt_out_capturing }`. Call sites then change only their import (`import { posthog } from '@/lib/posthog'` → `import { posthog } from '@/lib/posthog-facade'`); the call-site text is identical. Lower diff cost; lower review surface.
   - **RESOLVED:** **namespace-object export** — `export const posthog = { identify, reset, opt_in_capturing, opt_out_capturing, setClient }` in `src/lib/posthog-facade.ts`. Call sites in AuthContext/ConsentContext only change the import path (`@/lib/posthog` → `@/lib/posthog-facade`); the `posthog.identify(...)` / `posthog.reset(...)` etc. property-access syntax stays byte-identical to today. (NOT four separate named-function exports; NOT a namespace-`* as` import.) Verified: `src/lib/posthog.ts:40` exports `posthog` as a named binding pointing at the posthog-js default object — so today's call sites consume a namespace-object-shaped value. The facade mirrors that shape exactly.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm scripts, vite build | ✓ | (assumed system) | — |
| npm | install rollup-plugin-visualizer | ✓ | (assumed system) | — |
| `cwebp` (webp formula) | One-time PERF-05 PNG → WebP conversion | ✗ (likely) | — | `magick` or `vips` if installed; failing that, online converter (one-time, then committed) |
| `jq` | `audit-mobile.sh` parses Lighthouse JSON output | ✓ (already used by Phase 9/13) | (system) | — |
| `npx lighthouse@13.2.0` | PERF-07 audit | ✓ (downloaded on demand) | 13.2.0 pinned | — |
| `bash` | `audit-mobile.sh` shebang | ✓ (macOS/Linux) | — | — |

**Missing dependencies with no fallback:**
- None.

**Missing dependencies with fallback:**
- `cwebp` is likely not on the developer machine by default. The plan must include a `brew install webp` task (macOS) OR explicit fallback to `magick` if ImageMagick is already installed. Document the command actually used in the commit message / plan summary so the conversion is reproducible.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 (already shipped, package.json:62) |
| Config file | Inlined in `vite.config.ts:42-56` (uses `vitest/config`) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test && npm run lint` |

### Phase Requirements → Test Map

Phase 16 is overwhelmingly a build/config + perf phase. Most acceptance is mechanical (treemap shape, bundle bytes, Lighthouse JSON, DevTools network observation), not unit-testable. The few unit-testable pieces are the facade.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-03 | `posthog-facade` queues calls when client is null and replays them after `setClient(c)` | unit | `pytest`-equivalent via `npm run test -- posthog-facade` | ❌ Wave 0 (new test file `src/__tests__/lib/posthog-facade.test.ts`) |
| PERF-03 | `<PostHogGate>` renders children directly when consent state is `'undecided'` / `'decline'`; mounts the lazy provider when `'allow'` | component | `npm run test -- PostHogGate` | ❌ Wave 0 (new test file `src/__tests__/components/PostHogGate.test.tsx`) — mock `useConsent` and assert on rendered tree |
| PERF-01 | `vite.config.ts` throws when `ANALYZE && NETLIFY_CONTEXT=production` | manual (no test framework — config-load assertion) | `ANALYZE=true NETLIFY_CONTEXT=production npm run build` (expect non-zero exit + clear error) | manual-only |
| PERF-04 | `vendor-react` and `vendor-posthog` chunks present in `dist/assets/` after `npm run build` | manual / smoke | `ls dist/assets/ \| grep -E 'vendor-(react\|posthog)'` (planner adds to verification checklist) | manual-only |
| PERF-04 | `vendor-react` does NOT contain TanStack Router | manual / treemap inspection | Visual inspection of `dist/stats.html` after `ANALYZE=true npm run build` | manual-only |
| PERF-05 | `wtcs-logo.webp` is emitted in `dist/` and `<picture>` element renders without errors | snapshot | Existing Navbar test would catch the markup change (if snapshot test exists — verify with `ls src/__tests__/components/layout/`) | check Wave 0 |
| PERF-06 | `defaultPreload: 'intent'` doesn't break route navigation; Admin Link's `preload={false}` prevents AdminGuard redirect on hover | e2e | `npm run e2e` Playwright smoke; new test optional | check Wave 0 |
| PERF-07 | Lighthouse mobile Perf score ≥ 90 on all 5 routes | manual (production) | `bash .planning/closure/audit-mobile.sh` against prod | manual-only |
| GDPR invariant | `posthog-js` chunk does not load before consent='allow' | e2e | Playwright network-assertion test (optional new test) | optional Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run lint && npm run test` (default project sampling)
- **Per wave merge:** `npm run lint && npm run test && npm run build` (catches `manualChunks` misconfigurations and TypeScript drift; the build also exercises the D-09 throw if `ANALYZE=true` is in env)
- **Phase gate:** Production deploy + `bash .planning/closure/audit-mobile.sh` execution + evidence file appended

### Wave 0 Gaps
- [ ] `src/__tests__/lib/posthog-facade.test.ts` — unit tests for queue-and-replay semantics (covers PERF-03 D-02)
- [ ] `src/__tests__/components/PostHogGate.test.tsx` — component test for naked-children vs lazy-provider switch (covers PERF-03 D-01)
- [ ] (Optional, defensive) Playwright e2e test that asserts no `posthog-js` network request before clicking Allow on the consent banner — covers the GDPR consent-gate timing invariant; planner decides if this is in-scope or a defer follow-up. Existing `e2e/` test structure is available.

*(Existing test infrastructure DOES cover the visualizer + manualChunks + audit-mobile mechanics via the existing build pipeline + Phase 15 sourcemap-name guard + the audit script that already shipped — none of those need new infrastructure.)*

## Security Domain

Phase 16 does not introduce any new auth, input-validation, cryptography, or access-control surfaces. It is a pure perf/bundle phase. The only security-adjacent concerns are:

| Concern | Applies | Standard Control |
|---------|---------|------------------|
| GDPR consent timing (no analytics before opt-in) | yes | Already enforced by `opt_out_capturing_by_default: true` + `opt_out_persistence_by_default: true` in `initPostHog()`; Phase 16 preserves this verbatim per D-03. Additional reinforcement: the lazy provider doesn't load `posthog-js` at all until consent='allow', so the bundle itself never enters the network graph for declining users. |
| Hover-redirect leak from Admin Link preload | yes | `preload={false}` on the Admin Link (Pitfall 6) — explicit opt-out preserves the pre-Phase-16 behavior. |
| Sourcemap upload integrity (OBSV-04) | yes | D-09 throw at config-load — prevents accidental `ANALYZE=true` Netlify production builds from displacing `sentryVitePlugin`. |
| Slopcheck on new package | yes | `rollup-plugin-visualizer@7.0.1` is widely known and ships in Vite docs; nonetheless the planner inserts a `checkpoint:human-verify` task before install per the Package Legitimacy Audit. |

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | No auth changes |
| V3 Session Management | no | No session changes |
| V4 Access Control | partial | Admin Link `preload={false}` preserves the AdminGuard boundary against hover-redirect leaks |
| V5 Input Validation | no | No new input surface |
| V6 Cryptography | no | No crypto changes |
| V8 Data Protection / Privacy | yes | GDPR opt-IN preserved; lazy load ensures declining users never download `posthog-js` |

## Sources

### Primary (HIGH confidence)
- `vite.config.ts` (line 1-57) — current plugin order, sentryVitePlugin position, `rolldownOptions.output.keepNames` already in use
- `package.json` (line 1-70) — confirmed versions of all dependencies; `posthog-js@1.373.4`, `@tanstack/react-router@1.169.2`, `vite@8.0.12`, `@sentry/vite-plugin@5.3.0`
- `src/main.tsx` — current PostHog wrapping shape; createRouter call site; Sentry boundary tagging chain
- `src/lib/posthog.ts` — current `initPostHog()` opt-out-by-default config
- `src/contexts/ConsentContext.tsx` — current `posthog.opt_in_capturing` / `posthog.opt_out_capturing` call sites (lines 55, 58); reload-on-allow-to-decline behavior
- `src/contexts/AuthContext.tsx` — current `posthog.identify` / `posthog.reset` call sites (lines 168, 181)
- `src/components/layout/Navbar.tsx` — current `<img>` markup + width/height context (lines 32-36); existing Admin Link missing-preload pattern (lines 60-66)
- `src/routes/__root.tsx` / `src/routes/[__smoke].tsx` — existing `React.lazy` + `<Suspense fallback={null}>` analog pattern
- `scripts/verify-sourcemap-names.mjs` — 7-name keepNames allowlist (the Phase 15 invariant Phase 16 must preserve)
- `.planning/closure/audit-mobile.sh` — Lighthouse mobile harness, pinned to lighthouse@13.2.0, ROUTES + thresholds
- `.planning/closure/UIDN-02-mobile-evidence.md` — existing v1.1 + v1.2 evidence shape (template for the new `## v1.3 Rerun` section)
- `.planning/closure/OBSV-02-bundle-delta.md` — bundle-delta methodology analog (PERF-02 informant)
- `.planning/REQUIREMENTS.md` PERF-01..PERF-07 — requirement definitions
- `.planning/ROADMAP.md` § Phase 16 — goal + success criteria + requirement summaries
- `.planning/phases/16-uidn-02-aggressive-perf-budget-pass/16-CONTEXT.md` — all locked decisions D-01..D-09
- `.planning/phases/16-uidn-02-aggressive-perf-budget-pass/16-UI-SPEC.md` — preservation contract + perf budgets + suggested throw message wording

### Secondary (MEDIUM confidence)
- WebSearch — TanStack Router preloading docs [CITED: tanstack.com/router/latest/docs/guide/preloading], confirms `defaultPreload: 'intent'` + per-Link `preload={false}` override
- WebSearch — rollup-plugin-visualizer README [CITED: github.com/btd/rollup-plugin-visualizer], confirms `template`, `gzipSize`, `brotliSize`, `emitFile`, `filename`, `open` options

### Tertiary (LOW confidence)
- *(none — every claim in this RESEARCH.md is either grounded in the project source, a locked CONTEXT.md decision, or a cited public doc)*

## Project Constraints (from CLAUDE.md)

Phase 16 must comply with these project-level directives (extracted from `./CLAUDE.md`):

- **TypeScript strict mode** with `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax: true`. The facade module must use `import type` for type-only imports of `posthog-js` types.
- **ESM only**, no CommonJS. The new modules (`posthog-facade.ts`, `PostHogGate.tsx`, `PostHogProviderInner.tsx`) use `import`/`export` exclusively.
- **No default exports for React components** — `PostHogGate` and `PostHogProviderInner` use named exports. EXCEPT: `React.lazy` requires the lazily-imported module to have a **default export**, so `PostHogProviderInner.tsx` will need either (a) `default export PostHogProviderInner` OR (b) the lazy wrapper destructures: `lazy(() => import('@/components/PostHogProviderInner').then(m => ({ default: m.PostHogProviderInner })))` — exact analog of the existing pattern in `src/routes/[__smoke].tsx:13-17`. Prefer (b) to keep the no-default-export rule.
- **Comments WHY-only, no review-round/phase-ID archaeology in `src/`**. New comments in the new modules must explain rationale (e.g. "queue absorbs identify calls during the lazy-import window — facade is statically importable so AuthContext's effect stays synchronous") and must NOT cite Phase 16, D-01, PERF-03, or any plan ID. Plan refs live in PR body / commit, not in source.
- **`@/` alias for all imports** including dynamic — confirmed in CONTEXT § Established Patterns. `import('@/components/PostHogProviderInner')`, not relative.
- **File naming**: PascalCase `.tsx` for components (`PostHogGate.tsx`, `PostHogProviderInner.tsx`); camelCase `.ts` for libs (`posthog-facade.ts`). Tests mirror under `src/__tests__/`.
- **GSD workflow enforcement** — all edits flow through `/gsd:execute-phase` after planning is complete.

## Planner Instructions (per requirement)

### PERF-01 — Planner Instruction
A single `<action>` block at the start of the phase's first plan: (a) `npm install --save-dev rollup-plugin-visualizer@7.0.1` (gate behind `checkpoint:human-verify` per slopcheck protocol), (b) edit `vite.config.ts` to add the import, the env-gated mutual-exclusion block (visualizer OR sentryVitePlugin, never both), the D-09 throw at config-load when `process.env.ANALYZE === 'true' && process.env.NETLIFY_CONTEXT === 'production'`, and add a `build:analyze` npm script `"build:analyze": "ANALYZE=true tsr generate && tsc -b && vite build"`. The visualizer plugin config: `{ filename: 'dist/stats.html', template: 'treemap', gzipSize: true, brotliSize: true, open: false }`. Verification: `ANALYZE=true npm run build` produces `dist/stats.html` AND the `vendor-react`/`vendor-posthog` names are NOT yet present (PERF-04 lands later); `NETLIFY_CONTEXT=production ANALYZE=true npm run build` exits non-zero with a clear error mentioning OBSV-04. Run the Phase 15 sourcemap-names guard `npm run build && node scripts/verify-sourcemap-names.mjs` to confirm the non-ANALYZE production build still produces all 7 allowlisted names.

### PERF-02 — Planner Instruction
A dedicated `<action>` block AFTER PERF-01 lands and BEFORE any of PERF-03/04/05/06 land: `ANALYZE=true npm run build && cp dist/stats.html .planning/closure/v1.3-bundle-audit-pre.html`. Commit the resulting HTML file (~hundreds of KB but committed as evidence under `.planning/closure/`). Verification: file exists at `.planning/closure/v1.3-bundle-audit-pre.html`; opening in browser shows the treemap WITH `posthog-js` in the main critical-path chunk (this is the pre-change shape — confirms baseline is captured pre-PERF-03).

### PERF-03 — Planner Instruction
Three coordinated `<action>` blocks: (1) Create `src/lib/posthog-facade.ts` exporting a `posthog` namespace object with `identify(id)`, `reset()`, `opt_in_capturing()`, `opt_out_capturing()` — each pushes a thunk onto a module-scope queue if the internal client is null, else forwards directly; expose a non-public `setClient(c)` that assigns the client and drains the queue once. (2) Create `src/components/PostHogProviderInner.tsx` (default export per `React.lazy` requirement — exception to no-default rule per CLAUDE.md guidance above) that statically imports `posthog-js` + `PostHogProvider` from `posthog-js/react`, calls `initPostHog()` once at module-scope, calls `setClient(posthog)` from the facade, then renders `<PostHogProvider client={posthog}>{children}</PostHogProvider>`. Create `src/components/PostHogGate.tsx` (named export) reading `useConsent()`; returns `<>{children}</>` when state ≠ `'allow'`, else `<Suspense fallback={null}><LazyPostHogProviderInner>{children}</LazyPostHogProviderInner></Suspense>` where `LazyPostHogProviderInner = lazy(() => import('@/components/PostHogProviderInner').then(m => ({ default: m.PostHogProviderInner })))`. (3) Edit `src/main.tsx` to swap `<PostHogProvider client={posthog}>...</PostHogProvider>` for `<ConsentProvider><PostHogGate>...</PostHogGate></ConsentProvider>` (inverting current order — ConsentProvider goes OUTER; verify `<RouterProvider>` stays INSIDE `<PostHogGate>` so router state survives the consent='allow' first-mount). Edit `src/contexts/AuthContext.tsx` to change the `posthog` import from `@/lib/posthog` to `@/lib/posthog-facade` (call sites at lines 168, 181 stay identical). Edit `src/contexts/ConsentContext.tsx` similarly (call sites at lines 55, 58 stay identical). Remove the unused top-level `initPostHog()` call from `src/main.tsx:40` (it's now called inside `PostHogProviderInner.tsx`). Add unit tests at `src/__tests__/lib/posthog-facade.test.ts` (queue-then-flush) and `src/__tests__/components/PostHogGate.test.tsx` (naked-children vs lazy-mount via mocked `useConsent`). Verification: `npm run build` produces no errors; production preview build does NOT load `posthog-js` until consent='allow' (DevTools Network tab check); facade unit tests green.

### PERF-04 — Planner Instruction
A single `<action>` block: extend `vite.config.ts` `build.rolldownOptions.output` to add `manualChunks: { 'vendor-react': ['react', 'react-dom'], 'vendor-posthog': ['posthog-js', 'posthog-js/react'] }` (recommended: object form — package-name keyed; Rolldown matches on the resolved package, not path substrings, eliminating Pitfall 2's matcher-precision risk). If a function form is needed for some edge case, use `(id) => { if (/[\\/]node_modules[\\/]react[\\/]/.test(id) || /[\\/]node_modules[\\/]react-dom[\\/]/.test(id)) return 'vendor-react'; if (/[\\/]node_modules[\\/]posthog-js[\\/]/.test(id)) return 'vendor-posthog'; }` — strict boundary-anchored matching that explicitly excludes `@tanstack/react-router` (no `react` substring match alone). Re-run `ANALYZE=true npm run build`; confirm `vendor-react-*.js` and `vendor-posthog-*.js` chunks emit; inspect the treemap to confirm TanStack Router is NOT inside `vendor-react` (per Pitfall 2). Re-run the sourcemap-names guard. Verification: `ls dist/assets/ | grep -E '^vendor-(react|posthog)-'` returns two non-empty matches.

### PERF-05 — Planner Instruction
Two `<action>` blocks: (1) Operator step — `brew install webp` (if not present), then `cwebp -q 80 -m 6 src/assets/wtcs-logo.png -o src/assets/wtcs-logo.webp` (and `-lossless` as fallback if the q=80 output exceeds the PNG; document the chosen flag in plan summary). Commit the new binary. (2) Edit `src/components/layout/Navbar.tsx`: add `import webpLogo from '@/assets/wtcs-logo.webp'` next to the existing PNG import (line 13); replace the bare `<img>` at lines 32-36 with `<picture><source type="image/webp" srcSet={webpLogo} /><img src={logo} alt="WTCS Community Suggestions" className="h-8 w-auto md:h-9" width={226} height={200} /></picture>`. Verification: `npm run build` emits both `*.png` and `*.webp` under `dist/assets/`; `npm run dev` renders the logo visually identical to before; if an existing Navbar snapshot test exists, update the snapshot in the same commit and inspect the diff is className-free.

### PERF-06 — Planner Instruction
Two coordinated edits in a single `<action>` block: (1) `src/main.tsx:42` change `const router = createRouter({ routeTree })` to `const router = createRouter({ routeTree, defaultPreload: 'intent' })`. (2) `src/components/layout/Navbar.tsx:60-66` Admin `<Link>` add `preload={false}` attribute (the existing comment at line 59 explains the AdminGuard-redirect-on-hover rationale; preserve the comment). Verification: `npm run e2e` (Playwright) navigation flows still pass; manual smoke — hover the Admin link in DevTools Network and confirm no admin-route preload fires.

### PERF-07 — Planner Instruction
Three coordinated steps, executed AFTER the PR merges and Netlify deploys to production: (1) Operator runs `bash .planning/closure/audit-mobile.sh` from the project root. (2) Capture the printed `=== Summary ===` block + exit code into `.planning/closure/artifacts/lighthouse/audit-mobile.stdout.log` (using the Phase 13 D-27 mktemp+bash-c+cp capture pattern — see Phase 13 evidence at line 122). (3) Edit `.planning/closure/UIDN-02-mobile-evidence.md` to append a new `## v1.3 Rerun (2026-MM-DD)` section under the existing `## v1.2 Rerun (2026-05-13)`. Mirror the v1.2 Rerun structure: per-route Lighthouse table, breakpoint matrix (Phase 16 does NOT re-run Playwright screenshots — only Lighthouse — so the breakpoint-matrix subsection becomes a one-line "Screenshot matrix unchanged from v1.2; this phase reruns Lighthouse only per D-13"), cross-references subsection citing Phase 16 SHA + ROADMAP § Phase 16 + GitHub Issue #18. The verdict line is `**v1.3 outcome: PASS**` (D-08) or `**v1.3 outcome: DEFER**` (D-07) — bold, on its own line. On PASS: edit PROJECT.md `Mobile-first responsive design` Key Decision row from ⚠️ to ✓ in the same PR; PR body includes `Closes #18`. On DEFER: row stays ⚠️; UIDN-02 issue stays open; D-12 follow-up trigger re-recorded in PROJECT.md if needed. Verification: `cat .planning/closure/UIDN-02-mobile-evidence.md | tail -40` shows the new section; `git log --oneline` shows the closure commit; `gh issue view 18` confirms close-on-PASS or still-open-on-DEFER.

### Cross-requirement sequencing
The order is non-negotiable: **PERF-01 → PERF-02 → PERF-03 → PERF-04 → PERF-05 → PERF-06 → merge → PERF-07**. PERF-02 must capture the baseline before PERF-03 lands. PERF-05 and PERF-06 are independent and can swap order, but both must precede the merge that triggers PERF-07. PERF-04's verification (named chunks emit) is only meaningful after PERF-03 ships (else `posthog-js` is still in the main chunk and `vendor-posthog` would be empty).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library has a confirmed version in `package.json` (locked decisions); `rollup-plugin-visualizer@7.0.1` is the one new package, slopcheck-gated
- Architecture: HIGH — every architectural decision is locked in CONTEXT.md (D-01..D-09); the in-repo analog pattern (`React.lazy` + `<Suspense fallback={null}>`) exists at `__root.tsx:43-45` and `[__smoke].tsx:72-83`
- Pitfalls: HIGH — eight pitfalls cataloged with concrete warning signs; all map to known-failure modes in this stack
- Validation: MEDIUM — two new test files needed in Wave 0 (facade + PostHogGate); Phase 15 sourcemap-names guard reused as-is; PERF-07 audit script reused as-is
- Phase 15 invariant preservation: HIGH — keepNames flag stays; 7 names allowlist unaffected by Phase 16's changes; `boundary: app-root` tag at `main.tsx:81` is untouched

**Research date:** 2026-05-27
**Valid until:** 2026-06-26 (30 days; library stack is stable, Vite 8 / Rolldown is current, TanStack Router 1.169.x is current)
