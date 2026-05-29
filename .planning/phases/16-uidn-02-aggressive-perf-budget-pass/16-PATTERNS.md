# Phase 16: UIDN-02 Aggressive Perf-Budget Pass — Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 14 (5 new code + 1 new binary + 1 new evidence HTML + 7 modified)
**Analogs found:** 13 / 14 (the new binary `wtcs-logo.webp` is a `cwebp` shell output, no code analog)

> **AUTHORITATIVE-SOURCE NOTE (folds cross-AI review cycle 2).** Where this pattern map and the corresponding `16-NN-PLAN.md` disagree, **the PLAN is authoritative.** Two corrections were folded into this doc but some prose may still echo the superseded design — defer to the PLANs:
> 1. **PostHog Suspense pattern is SIBLING-loader, NOT child-wrapping.** `PostHogGate` ALWAYS renders `{children}` directly and mounts a null-rendering side-effect loader as a SIBLING inside `<Suspense fallback={null}>`. `PostHogProviderInner` renders `null` (it is NOT a `<PostHogProvider client={posthog}>{children}</PostHogProvider>` wrapper). The old child-wrapping shape was a verified HIGH bug (blanks/remounts the router during the lazy-import window). Authoritative source: `16-03-PLAN.md`.
> 2. **`vendor-react` is the React runtime family (`react` + `react-dom` + `scheduler`), via the FUNCTION-form matcher as primary.** Authoritative source: `16-04-PLAN.md`.
> 3. **Facade-only analytics client.** No component consumes `usePostHog()`, so there is no React context provider in the tree once consent resolves. Authoritative source: `16-03-PLAN.md` consumer audit.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/posthog-facade.ts` (new) | utility / module-scope state | event-driven (queue + flush-on-load) | `src/lib/posthog.ts` (module-scope `initialized` guard pattern) | role-match |
| `src/components/PostHogProviderInner.tsx` (new) | component (named-export, lazy target, side-effect loader) | side-effect on lazy-chunk load (init + bridge); renders `null` (NOT a Provider wrapping children) | `src/components/debug/RenderThrowSmoke` (inner module loaded via `React.lazy`) | role-match |
| `src/components/PostHogGate.tsx` (new) | component (named-export, consent gate) | request-response (conditional render) | `src/routes/[__smoke].tsx:13-17` (lazy + Suspense pattern) and `src/routes/__root.tsx:16, 43-45` (lazy + conditional `<Suspense fallback={null}>`) | exact |
| `src/__tests__/lib/posthog-facade.test.ts` (new) | test (pure unit) | n/a | `src/__tests__/setup/smoke.test.ts` (minimal vitest shape) + `src/__tests__/contexts/ConsentContext.test.tsx:9-17` (posthog-mock pattern) | role-match |
| `src/__tests__/components/PostHogGate.test.tsx` (new) | test (component) | n/a | `src/__tests__/layout/Navbar.test.tsx:4-23` (mock-`useAuth`-style consumer test) — adapted for `useConsent` | role-match |
| `src/assets/wtcs-logo.webp` (new binary) | asset | n/a | `src/assets/wtcs-logo.png` (sibling asset) | n/a — binary |
| `.planning/closure/v1.3-bundle-audit-pre.html` (new evidence) | build-time evidence | n/a | `.planning/closure/OBSV-02-bundle-delta.md` (delta-evidence format) | partial — evidence kind |
| `vite.config.ts` (modified) | config | n/a | existing `vite.config.ts:13-28` plugin array (extend, don't replace) + `vite.config.ts:33-35` `rolldownOptions.output` (extend with `manualChunks`) | exact (self-analog) |
| `package.json` (modified) | config | n/a | existing `package.json:11` `"build"` script (mirror with `ANALYZE=true` prefix) | exact (self-analog) |
| `src/main.tsx` (modified) | entry point | n/a | self — three localized edits to lines 5-7, 40, 42, 95-99 | exact (self-analog) |
| `src/contexts/AuthContext.tsx` (modified) | context provider | n/a | self — one-line import swap at line 6; call sites at lines 168, 181 unchanged | exact (self-analog) |
| `src/contexts/ConsentContext.tsx` (modified) | context provider | n/a | self — one-line import swap at line 4; call sites at lines 55, 58 unchanged | exact (self-analog) |
| `src/components/layout/Navbar.tsx` (modified) | component (layout) | n/a | self — `<img>` wrap at lines 32-36; admin `<Link>` `preload={false}` at lines 60-66 | exact (self-analog) |
| `.planning/closure/UIDN-02-mobile-evidence.md` (append) | closure evidence | n/a | existing `## v1.2 Rerun (2026-05-13)` section in same file (mirror shape) | exact (self-analog) |
| `PROJECT.md` (modified, conditional on PASS) | docs | n/a | existing Key Decision table row format | exact (self-analog) |

---

## Pattern Assignments

### `src/lib/posthog-facade.ts` (new — utility, event-driven queue+flush)

**Analogs:**
- `src/lib/posthog.ts` (module-scope state + singleton-init guard)
- `src/contexts/ConsentContext.tsx:54-59` (consumer call sites that must keep working)

**Imports pattern** (mirror style from `src/lib/posthog.ts:1`):
```typescript
import type posthog from 'posthog-js'
```
- Use `import type` for the `posthog-js` symbol so the facade contributes ZERO bytes to the critical-path chunk (only types — erased at build time per `verbatimModuleSyntax: true`). This is the load-bearing constraint for Pitfall 4 in RESEARCH.md (single static-import site for `posthog-js` lives ONLY in `PostHogProviderInner.tsx`).

**Module-scope state pattern** (analog `src/lib/posthog.ts:3-4`):
```typescript
// src/lib/posthog.ts
let initialized = false
```
- Same shape for the facade: `let client: typeof posthog | null = null` plus `const queue: Array<(c: typeof posthog) => void> = []`. Module-scope — lives across React tree re-renders, single instance per page-load.

**Public API surface** (must mirror what `ConsentContext.tsx:55, 58` and `AuthContext.tsx:168, 181` already call so the import swap is one-line):
```typescript
// What ConsentContext.tsx:55, 58 calls today:
posthog.opt_in_capturing()
posthog.opt_out_capturing()
// What AuthContext.tsx:168, 181 calls today:
posthog.identify(providerId)
posthog.reset()
```
- Facade MUST export exactly these four named functions: `identify(id: string): void`, `reset(): void`, `opt_in_capturing(): void`, `opt_out_capturing(): void`. The caller import becomes `import * as posthog from '@/lib/posthog-facade'` and every call site stays byte-identical.

**Flush pattern** (the only new shape — no direct in-repo analog, but the queue-thunk-array is the discretion item from CONTEXT D-02):
- Non-exported helper `setClient(c: typeof posthog): void` assigns `client = c` then drains `queue` via `while (queue.length) queue.shift()!(c)`. Called once from `PostHogProviderInner.tsx` after `initPostHog()` returns.

**Comments — WHY-only** (project rule per CLAUDE.md):
- OK: `// import type ONLY — keeps posthog-js out of the critical-path chunk`
- NOT OK: `// Phase 16 PERF-03 facade for D-02` (rot tag; archaeology lives in PR/commit, not src/)

**Gotchas:**
- The queue is in-memory only (no `sessionStorage`) per Claude's Discretion in CONTEXT.
- Replay drains exactly once on first `setClient(c)` call. A second `setClient(c)` call (defensive) should overwrite `client` but is not expected — guard with `if (client) return` if conservative.
- The facade must NOT do its own `import('posthog-js')` (Pitfall 1 + Pitfall 4 in RESEARCH.md). Type-only import is mandatory.

---

### `src/components/PostHogProviderInner.tsx` (new — component, default export required by React.lazy)

**Analogs:**
- `src/routes/[__smoke].tsx:13-17` — the `.then(m => ({ default: m.RenderThrowSmoke }))` destructure that lets `React.lazy` consume a named export.
- `src/main.tsx:5, 40, 95` — the current static-import + init + `<PostHogProvider client={posthog}>` shape that is being relocated into this new inner module.

> CORRECTION (folds cross-AI review): `PostHogProviderInner` is a SIDE-EFFECT-ONLY loader that renders `null` — NOT a `<PostHogProvider>` wrapper. It does NOT import `posthog-js/react` and does NOT take `children`. This is because the consumer audit (`grep -rn "usePostHog" src/`) confirms NO component consumes `usePostHog()` — the app is a facade-only analytics client. The old "wraps children in `<PostHogProvider client={posthog}>`" shape below is superseded; it is what caused the verified HIGH blanking bug. Use the corrected shape.

**Imports pattern** (the static `posthog-js` runtime import now lives ONLY in this lazily-loaded module, transitively via `@/lib/posthog`):
```typescript
import { initPostHog } from '@/lib/posthog'
import { posthog } from '@/lib/posthog-facade'
```
- New inner module imports `initPostHog` (which transitively pulls `posthog-js` into the lazy chunk) and the facade `posthog` namespace object. It does NOT import `PostHogProvider` from `posthog-js/react` — there are no `usePostHog()` consumers, so the React context provider is unnecessary and importing it would needlessly bloat the lazy chunk.

**Module-scope init + bridge pattern:**
```typescript
const client = initPostHog()
posthog.setClient(client)   // bridge → drains the facade queue into the real posthog-js instance
```
- These run at MODULE SCOPE (not inside the component body), exactly once per page-load when the lazy chunk first resolves. `initialized` guard in `src/lib/posthog.ts:3` makes `initPostHog()` idempotent (StrictMode-safe), and module evaluation runs once regardless of StrictMode.

**Component shape (side-effect-only loader — renders nothing):**
```typescript
export function PostHogProviderInner() { return null }
```
- The component renders `null`. Its entire job is the module-scope side effect (init + setClient) that fires when the lazy chunk loads. Rendering `null` is what makes it safe to mount inside a `<Suspense fallback={null}>` boundary without affecting any visible UI.

**Default export exception** (the ONE acceptable default-export in `src/` per CLAUDE.md — React.lazy requires it OR consume a named export via the `.then()` destructure):
- Two equally-correct options:
  - **(A)** `export default PostHogProviderInner` and `lazy(() => import('@/components/PostHogProviderInner'))` in PostHogGate. Simplest.
  - **(B)** Named-export `export function PostHogProviderInner(...)` + the `.then(m => ({ default: m.PostHogProviderInner }))` destructure in PostHogGate, mirroring `src/routes/[__smoke].tsx:13-17` exactly. Preserves the no-default-export project rule.
- **Recommendation:** Option (B) for consistency with the existing repo pattern; pattern-mapper notes that (A) is the documented exception in the upstream prompt and either is acceptable.

**setClient call site** (no in-repo analog — this is the new wiring):
- After `const posthog = initPostHog()` at module scope, call `setClient(posthog)`. Module-scope (not inside the component function) so React StrictMode's double-invoke does not double-flush.

**Gotchas:**
- Do NOT call `setClient` inside the component body — it would fire on every render. Module scope only.
- The inner module is what `React.lazy(() => import(...))` resolves to; its module-load side effects (init + setClient) happen exactly once per page-load.

---

### `src/components/PostHogGate.tsx` (new — component, consent-gated lazy wrapper)

**Analog (exact match):** `src/routes/[__smoke].tsx:1-17, 72-83` — lazy + Suspense + conditional-render combination.

**Imports pattern** (copy `src/routes/[__smoke].tsx:1-3` shape):
```typescript
// src/routes/[__smoke].tsx:1-3
/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, useCallback } from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'
```
- New `PostHogGate.tsx` imports: `import { lazy, Suspense, type ReactNode } from 'react'` and `import { useConsent } from '@/hooks/useConsent'`. The `react-refresh/only-export-components` disable comment is NOT needed here — PostHogGate exports only its component.

**Lazy pattern** (exact analog `src/routes/[__smoke].tsx:13-17` for named-export consumption OR `src/routes/__root.tsx:16` for default-export):

```typescript
// src/routes/[__smoke].tsx:13-17 (named-export form — RECOMMENDED for PostHogGate)
const RenderThrowSmoke = lazy(() =>
  import('@/components/debug/RenderThrowSmoke').then(m => ({
    default: m.RenderThrowSmoke,
  }))
)
```

```typescript
// src/routes/__root.tsx:16 (default-export form — alternative if PostHogProviderInner uses Option A)
const DebugAuthOverlay = lazy(() => import('@/components/debug/DebugAuthOverlay'))
```
- Module-scope `const LazyPostHogLoader = lazy(() => import('@/components/PostHogProviderInner').then(m => ({ default: m.PostHogProviderInner })))`. The dynamic `import('@/components/PostHogProviderInner')` is the ONE site that triggers the lazy chunk fetch; that chunk transitively pulls in `posthog-js` (via `@/lib/posthog`), which Rolldown groups into the `vendor-posthog` named chunk per `manualChunks` (PERF-04). NOTE: `PostHogProviderInner` is a side-effect-only loader that renders `null` (NOT a `<PostHogProvider>` wrapper) — it does not import `posthog-js/react`, because no component consumes `usePostHog()` (facade-only analytics client).

**Conditional Suspense pattern** (exact analog `src/routes/__root.tsx:39-46`):

```typescript
// src/routes/__root.tsx:39-46
{typeof window !== 'undefined' &&
  (window.localStorage.getItem('wtcs_debug_auth') === '1' ||
    import.meta.env.DEV) &&
  new URLSearchParams(window.location.search).get('debug') === 'auth' && (
  <Suspense fallback={null}>
    <DebugAuthOverlay />
  </Suspense>
)}
```
- For PostHogGate: read `const { state } = useConsent()`; ALWAYS render `{children}` directly, and — only when `state === 'allow'` — ALSO render `<Suspense fallback={null}><LazyPostHogLoader /></Suspense>` as a SIBLING of `{children}` (children are NEVER nested inside the suspending component). The `LazyPostHogLoader` renders `null` (side-effect-only loader — see below), so `fallback={null}` has no visible effect. The `fallback={null}` is non-negotiable per UI-SPEC § Loading & Suspense States (`undecided` / `decline` / `allow` table).

**Component shape (CRITICAL — children are a sibling of `<Suspense>`, never a descendant):**
```typescript
export function PostHogGate({ children }: { children: ReactNode }) {
  const { state } = useConsent()
  return (
    <>
      {children}
      {state === 'allow' && (
        <Suspense fallback={null}>
          <LazyPostHogLoader />
        </Suspense>
      )}
    </>
  )
}
```

**Gotchas:**
- `PostHogGate` MUST live INSIDE `<ConsentProvider>` (it calls `useConsent`). The current `main.tsx:95-98` has `<PostHogProvider>` ABOVE `<ConsentProvider>` — Phase 16 inverts that ordering per Anti-Pattern #2 in RESEARCH.md.
- CRITICAL — DO NOT nest `{children}` inside the `<Suspense>` boundary (i.e. NEVER `<Suspense fallback={null}><LazyPostHogProviderInner>{children}</LazyPostHogProviderInner></Suspense>`). The earlier child-wrapping design was a verified HIGH bug: while the lazy chunk is in-flight, Suspense replaces the ENTIRE suspending subtree with the `null` fallback, so the router (the `{children}`) BLANKS and remounts during the consent='allow' import window. The correct design renders `{children}` unconditionally as a sibling and mounts a side-effect-only loader (`LazyPostHogLoader`, which renders `null`) inside the Suspense boundary — so the only thing Suspense can replace is `null`, making the import window visually invisible. There is no React-context provider (`PostHogProviderInner` renders `null`, not `<PostHogProvider>{children}</PostHogProvider>`) because no component in the app consumes `usePostHog()` — this is a facade-only analytics client, verified by the Task 5 consumer audit.

---

### `src/__tests__/lib/posthog-facade.test.ts` (new — pure unit test)

**Analogs:**
- `src/__tests__/setup/smoke.test.ts` (minimal vitest skeleton)
- `src/__tests__/contexts/ConsentContext.test.tsx:1-25` (mock + reset pattern; adapt the mock-target from `@/lib/posthog` to `posthog-js`)

**Skeleton pattern** (analog `src/__tests__/setup/smoke.test.ts:1-15`):
```typescript
// src/__tests__/setup/smoke.test.ts:1-3
import { describe, it, expect } from 'vitest'

describe('Test Infrastructure', () => {
  it('vitest runs successfully', () => {
    expect(true).toBe(true)
  })
```

**Mock + reset pattern** (analog `src/__tests__/contexts/ConsentContext.test.tsx:9-25`):
```typescript
// src/__tests__/contexts/ConsentContext.test.tsx:9-25
vi.mock('@/lib/posthog', () => ({
  posthog: {
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
  initPostHog: vi.fn(),
}))
// ...
beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
})
```
- For the facade test: build a plain object with the 4 methods (no `vi.mock` of `posthog-js` needed if you exercise the facade directly with a stub client passed to `setClient`). Two test cases minimum per Wave 0 brief:
  1. **Queue-before-load:** call `identify('x')` + `reset()` BEFORE `setClient(stub)`; then call `setClient(stub)`; assert stub.identify called once with `'x'`, stub.reset called once.
  2. **Forward-after-load:** call `setClient(stub)`; then call `identify('y')`; assert stub.identify called once with `'y'`, queue length zero.

**Gotcha:** facade is module-scope state — between test cases you need to reset the module via `vi.resetModules()` in `beforeEach` OR export a test-only `__reset()` helper. Recommended: `vi.resetModules()` + dynamic `await import('@/lib/posthog-facade')` per test.

---

### `src/__tests__/components/PostHogGate.test.tsx` (new — component test)

**Analog:** `src/__tests__/layout/Navbar.test.tsx:1-50` — mock-hook-via-vi.fn() pattern adapted for `useConsent`.

**Mock pattern** (analog `src/__tests__/layout/Navbar.test.tsx:4-7`):
```typescript
// src/__tests__/layout/Navbar.test.tsx:4-7
const mockUseAuth = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))
```
- Adapt for PostHogGate: `const mockUseConsent = vi.fn(); vi.mock('@/hooks/useConsent', () => ({ useConsent: () => mockUseConsent() }))`. Mock `@/components/PostHogProviderInner` as a SIDE-EFFECT spy that renders `null` (it does NOT wrap children — it is a null-rendering loader): `const loaderSpy = vi.fn(); vi.mock('@/components/PostHogProviderInner', () => ({ PostHogProviderInner: () => { loaderSpy(); return null } }))`. The loader's PROOF-OF-MOUNT is the spy call count, not a DOM node (it renders `null`).

**Test cases minimum:**
1. `state: 'undecided'` → renders `{children}` directly (`screen.getByTestId('children')` present); `loaderSpy` NOT called (loader not mounted).
2. `state: 'decline'` → same as undecided.
3. `state: 'allow'` → `{children}` present SYNCHRONOUSLY on the first render (regression guard for the HIGH blanking finding — children are a sibling of Suspense, never blanked), then `await vi.waitFor(() => expect(loaderSpy).toHaveBeenCalled())` because the lazy import resolves async even when mocked.

**Gotcha:** The Navbar test mocks `@tanstack/react-router` (lines 9-15) because Navbar uses `<Link>`. PostHogGate does NOT use `<Link>` — no router mock needed.

---

### `src/assets/wtcs-logo.webp` (new binary)

**Analog:** sibling `src/assets/wtcs-logo.png` (9915 bytes, 226×200 RGBA — verified via `file` and `ls -la` 2026-05-27).

**No code excerpt** — produced by a one-time shell command on the developer machine:
```bash
# Per RESEARCH.md § Common Pitfalls > Pitfall 7
cwebp -q 80 src/assets/wtcs-logo.png -o src/assets/wtcs-logo.webp
# Fallback if -q 80 is not smaller:
cwebp -lossless src/assets/wtcs-logo.png -o src/assets/wtcs-logo.webp
```

**Gotcha:** PNG retained (`src/assets/wtcs-logo.png` is the `<picture><img>` fallback per UI-SPEC § Image Loading Contract). Do not delete the PNG.

---

### `.planning/closure/v1.3-bundle-audit-pre.html` (new evidence)

**Analog:** `.planning/closure/OBSV-02-bundle-delta.md` (sibling evidence file in the same directory; analog for **placement** and **commit-policy**, not for content — this new file is a build-tool emit, not a hand-written delta report).

**Production pattern:**
- After PERF-01 lands (visualizer plugin + `build:analyze` script), run `npm run build:analyze` against the pre-PERF-03 tree (i.e., before the facade and lazy gate are added).
- `rollup-plugin-visualizer` emits to `dist/stats.html` (recommended static path per RESEARCH.md § Code Examples > Example shape PERF-01).
- Copy: `cp dist/stats.html .planning/closure/v1.3-bundle-audit-pre.html`.
- Commit the HTML so the PERF-02 baseline is reproducible from history.

**Gotcha:** HTML can be large (~500 KB-2 MB). Acceptable for closure-evidence per existing `.planning/closure/` convention. Don't gzip — the value is being grep-able / open-able from a fresh clone.

---

### `vite.config.ts` (modified — config, self-analog)

**Current shape** (lines 1-58, read 2026-05-27):

**Imports pattern** (lines 1-6):
```typescript
import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
```
- Phase 16 adds: `import { visualizer } from 'rollup-plugin-visualizer'`. The existing `// Sentry plugin must be LAST — tree-shaking landmine.` comment (line 8) is load-bearing context for D-09.

**Plugin array pattern** (lines 13-28):
```typescript
export default defineConfig(({ mode }) => ({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { filesToDeleteAfterUpload: './dist/**/*.map' },
      disable: mode !== 'production',
    }),
  ],
```
- Phase 16 swaps the trailing `sentryVitePlugin({...})` for an env-gated conditional. Recommended shape (RESEARCH.md § Code Examples > Example shape PERF-01): build `const plugins = [tanstackRouter(...), react(), tailwindcss()]` then `if (process.env.ANALYZE === 'true') plugins.push(visualizer({...})); else plugins.push(sentryVitePlugin({...}))`. **Both plugins must remain mutually exclusive** — never both in the array simultaneously.

**D-09 throw pattern** (no in-repo analog; new code at module scope of `vite.config.ts`):
- Insert at the top of the file (BEFORE `defineConfig`), so it fires at config-load time regardless of `mode`:
```typescript
// CORRECTED (cycle 2): guard CONTEXT (Netlify-native, verified netlify.toml:9) AND legacy NETLIFY_CONTEXT.
// Keying only on NETLIFY_CONTEXT makes the trap inert in real Netlify CI.
if (process.env.ANALYZE === 'true' && (process.env.CONTEXT === 'production' || process.env.NETLIFY_CONTEXT === 'production')) {
  throw new Error(
    'Refusing production build with ANALYZE=true: rollup-plugin-visualizer and ' +
    'sentryVitePlugin both require last-position in the Vite plugins array, so ' +
    'ANALYZE=true on a production build skips sourcemap upload and silently ' +
    'breaks the OBSV-04 evidence chain shipped in Phase 15. Unset ANALYZE or ' +
    'run analyze locally only.'
  )
}
```
- Wording is from UI-SPEC line 121 (planner may refine); the OBSV-04 + Phase 15 references are non-negotiable per UI-SPEC § Copywriting Contract.

**`rolldownOptions` extend pattern** (current lines 33-35):
```typescript
rolldownOptions: {
  output: { keepNames: true },
},
```
- Phase 16 extends the same `output` object — **does NOT create a parallel `rollupOptions`** (Pitfall 8 in RESEARCH.md):
```typescript
rolldownOptions: {
  output: {
    keepNames: true,
    // Function form PRIMARY — boundary-anchored /node_modules/<pkg>/ regex gives explicit,
    // auditable control over exactly which package dirs land in each chunk, and includes
    // React's own runtime dep `scheduler` in the React family. The object form's Rolldown
    // behavior is unverified in this repo; the boundary anchor (not `id.includes('react')`)
    // is what sidesteps Pitfall 2 (`@tanstack/react-router`, `@radix-ui/react-*`,
    // `@sentry/react`, `react-error-boundary` all contain the literal `react`).
    manualChunks: (id) => {
      if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react'
      if (/[\\/]node_modules[\\/]posthog-js[\\/]/.test(id)) return 'vendor-posthog'
    },
  },
},
```

**Fallback to object form** — only if the function form proves problematic AND the object form is then empirically verified against the treemap in this repo (do not assume object-form behavior; Rolldown may resolve object-keyed package strings differently than Rollup):

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-posthog': ['posthog-js', 'posthog-js/react'],
},
```
- The cache-stable unit for `vendor-react` is the React RUNTIME FAMILY — `react` + `react-dom` + `scheduler` (React's own internal dep) — not literally two packages. The function-form regex's `react|react-dom|scheduler` alternation captures the family; if the object form is used, `scheduler` is typically pulled in transitively but should be confirmed in the treemap. The `posthog-js` package directory contains both `posthog-js` (main) and `posthog-js/react` (sub-export); the `/node_modules/posthog-js/` regex covers both. Pitfall 2 (naive `id.includes('react')`) is sidestepped by the boundary-anchored regex.

**Gotchas:**
- `keepNames: true` MUST stay. The 7-name allowlist in `scripts/verify-sourcemap-names.mjs:22-30` (`RenderThrowSmoke`, `ConsentProvider`, `ConsentBanner`, `AdminGuard`, `AuthProvider`, `RootLayout`, `AppErrorFallback`) is checked post-build; any of those mangling is a CI failure.
- The new `PostHogGate` / `PostHogProviderInner` names are NOT in the allowlist. They do not need to be — only those 7 are contract-binding.
- Visualizer filename should be `dist/stats.html` (static) so multiple runs are reproducible; the PERF-02 baseline is captured by copying to `.planning/closure/v1.3-bundle-audit-pre.html` after the build.

---

### `package.json` (modified — config, self-analog)

**Analog (exact, self):** existing `package.json:11` `"build": "tsr generate && tsc -b && vite build"`.

**Script addition pattern:**
- New script: `"build:analyze": "ANALYZE=true npm run build"`. CRITICAL — wrap the WHOLE build in `npm run build`; do NOT use the inline form `ANALYZE=true tsr generate && tsc -b && vite build`, which scopes `ANALYZE` only to `tsr generate` so `vite build` never sees the flag and `dist/stats.html` is never emitted. Re-exporting via `npm run build` propagates `ANALYZE=true` to the entire child process.
- D-09 throw protects against Netlify production co-presence — it guards `CONTEXT=production` (the var Netlify natively sets, verified netlify.toml:9) AND legacy `NETLIFY_CONTEXT=production`; no separate npm-level guard needed.

**DevDep addition pattern** (analog: existing `package.json:37-62` `devDependencies` block — sorted alphabetically; insert `rollup-plugin-visualizer` between `globals` and `husky` ordering by ASCII):
```json
"rollup-plugin-visualizer": "7.0.1"
```
- Pinned version per RESEARCH.md § Standard Stack. Per § Package Legitimacy Audit, a `checkpoint:human-verify` gate runs `npm view rollup-plugin-visualizer@7.0.1 version` + visually confirms `github.com/btd/rollup-plugin-visualizer` before `npm install --save-dev`.

---

### `src/main.tsx` (modified — entry point, self-analog)

**Analog (exact, self):** current `src/main.tsx:1-102`.

**Import swap pattern** (lines 5-7 currently):
```typescript
import { PostHogProvider } from 'posthog-js/react'
import { initPostHog } from '@/lib/posthog'
import { ConsentProvider } from '@/contexts/ConsentContext'
```
- Phase 16 REMOVES lines 5 and 6 (PostHogProvider + initPostHog imports moved into `PostHogProviderInner.tsx`). Phase 16 ADDS: `import { PostHogGate } from '@/components/PostHogGate'`. The `ConsentProvider` import (line 7) stays.

**Init call removal** (line 40 currently `const posthog = initPostHog()`):
- DELETE this line. The `initPostHog()` call relocates to `PostHogProviderInner.tsx` module scope.

**Router config addition** (line 42 currently):
```typescript
const router = createRouter({ routeTree })
```
- Change to:
```typescript
const router = createRouter({ routeTree, defaultPreload: 'intent' })
```

**Provider tree inversion** (lines 95-99 currently):
```typescript
<PostHogProvider client={posthog}>
  <ConsentProvider>
    <RouterProvider router={router} />
  </ConsentProvider>
</PostHogProvider>
```
- Change to (ConsentProvider becomes outer; PostHogGate becomes inner per Anti-Pattern #2 in RESEARCH.md):
```typescript
<ConsentProvider>
  <PostHogGate>
    <RouterProvider router={router} />
  </PostHogGate>
</ConsentProvider>
```
- `PostHogGate` MUST be a descendant of `ConsentProvider` (it calls `useConsent`).

**Gotcha:** the `Sentry.ErrorBoundary` wrapper at lines 77-100 wraps the whole tree — KEEP it as the outermost. Don't reorder Sentry init (lines 22-38), `Sentry.ErrorBoundary` placement (lines 77-100), or `createRoot` handlers (lines 71-75) — these are the Phase 15 invariants (`boundary: app-root` tag survival across React 19's `onUncaughtError`/`onCaughtError`/`onRecoverableError` + dedupe).

---

### `src/contexts/AuthContext.tsx` (modified — context provider, self-analog)

**Analog (exact, self):** current `src/contexts/AuthContext.tsx:1-218`.

**One-line import swap** (line 6 currently):
```typescript
import { posthog } from '@/lib/posthog'
```
- Change to:
```typescript
import * as posthog from '@/lib/posthog-facade'
```
- This is the only edit. Both call sites (`posthog.identify(providerId)` at line 168, `posthog.reset()` at line 181) work byte-identical because the facade's exported function names match the methods on the `posthog` object.

**Existing call sites — DO NOT TOUCH** (lines 165-170 and 172-186):
```typescript
// AuthContext.tsx:165-170 (identify effect — unchanged)
useEffect(() => {
  if (consentState !== 'allow') return
  if (providerId) {
    posthog.identify(providerId)
  }
}, [consentState, user?.id, providerId])
```
```typescript
// AuthContext.tsx:179-181 (signOut reset — unchanged)
// Reset PostHog BEFORE the API call so analytics stop attributing
// events to the signed-out user even if the server call is slow/fails.
posthog.reset()
```

**Gotcha:** `import * as posthog` (namespace import) is the simplest form; alternatively `import { identify, reset } from '@/lib/posthog-facade'` with caller-side adjustments (more invasive — pattern-mapper recommends namespace import).

---

### `src/contexts/ConsentContext.tsx` (modified — context provider, self-analog)

**Analog (exact, self):** current `src/contexts/ConsentContext.tsx:1-83`.

**One-line import swap** (line 4 currently):
```typescript
import { posthog } from '@/lib/posthog'
```
- Change to:
```typescript
import * as posthog from '@/lib/posthog-facade'
```

**Existing call sites — DO NOT TOUCH** (lines 53-60):
```typescript
useEffect(() => {
  if (state === 'allow') {
    posthog.opt_in_capturing()
    void loadSentryReplayIfConsented()
  } else if (state === 'decline') {
    posthog.opt_out_capturing()
  }
}, [state])
```
- The facade's `opt_in_capturing()` / `opt_out_capturing()` queue if `client` is null (i.e., if `PostHogGate` hasn't mounted the lazy inner yet — happens when `state` transitions to `'allow'` for the first time, because the lazy chunk is just starting to load). Queue drains on `setClient(...)` in the inner. Behavior preserved.

**Gotcha:** the `loadSentryReplayIfConsented` call (line 56) stays as-is — Phase 16 does not touch Sentry Replay lazy-loading (already shipped).

---

### `src/components/layout/Navbar.tsx` (modified — component, self-analog)

**Analog (exact, self):** current `src/components/layout/Navbar.tsx:1-140`.

**Asset import addition** (line 13 currently `import logo from '@/assets/wtcs-logo.png'`):
- ADD a second line: `import webpLogo from '@/assets/wtcs-logo.webp'`.

**`<picture>` wrap pattern** (lines 32-36 currently):
```typescript
<img
  src={logo}
  alt="WTCS Community Suggestions"
  className="h-8 w-auto md:h-9"
/>
```
- Change to:
```typescript
<picture>
  <source type="image/webp" srcSet={webpLogo} />
  <img
    src={logo}
    alt="WTCS Community Suggestions"
    className="h-8 w-auto md:h-9"
    width={226}
    height={200}
  />
</picture>
```
- `width={226}` and `height={200}` are the intrinsic pixel dimensions of `wtcs-logo.png` (verified via `ls -la src/assets/` 2026-05-27). They are mandatory per UI-SPEC § Image Loading Contract (zero-CLS contract).
- React 19 JSX uses `srcSet` (camelCase); it compiles to lowercase `srcset` in DOM.
- `alt`, `className`, the outer `<Link>` (lines 26-37) all preserved verbatim per UI-SPEC § Copywriting Contract + § Accessibility Preservation.

**Admin Link `preload={false}` addition** (lines 58-67 currently):
```typescript
{isAdmin && (
  // No preload — AdminGuard beforeLoad would redirect non-admins on hover. Per-link opt-in only.
  <Link
    to="/admin"
    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    activeProps={{ className: 'text-foreground' }}
  >
    Admin
  </Link>
)}
```
- Add `preload={false}` to the `<Link to="/admin">` props. With `defaultPreload: 'intent'` on the router (set in `main.tsx` per PERF-06), every `<Link>` opts INTO preload by default — the existing comment-only opt-out stops working. Pitfall 6 in RESEARCH.md is explicit. The existing inline comment stays (it documents WHY) but may be tightened to mention the explicit `preload={false}` override.

**Gotchas:**
- The Topics + Archive `<Link>` elements (lines 42-57) currently have explicit `preload="intent"` — these become redundant after the router-level default but are NOT removed per UI-SPEC § Route Lazy-Load Behavior (`Existing explicit preload="intent" on individual <Link> ... NOT removed — defensive belt-and-braces; no harm`).
- The avatar `<img>` at lines 103-107 is NOT wrapped in `<picture>` — only the WTCS logo gets WebP. Avatar URLs are external (Discord CDN), not bundled assets.
- The home `<Link to="/" preload="intent">` at lines 26-37 has explicit `preload="intent"` — keep it (defensive).

---

### `.planning/closure/UIDN-02-mobile-evidence.md` (append — closure evidence)

**Analog (exact, self):** existing `## v1.2 Rerun (2026-05-13)` section in the same file.

**Section shape per CONTEXT D-07 (DEFER) / D-08 (PASS):**
- Heading: `## v1.3 Rerun (2026-MM-DD)`
- Body: per-route Lighthouse Performance scores for all 5 audited routes (mirror v1.2 table format from the same file).
- Verdict line: `**v1.3 outcome: PASS**` (PASS path) OR `**v1.3 outcome: DEFER**` + one-paragraph rationale (DEFER path).
- Frontmatter at top of file is UNCHANGED.

**Gotcha:** The audit is run AGAINST PRODUCTION (`https://polls.wtcsmapban.com`) AFTER merge AND AFTER Netlify production deploy lands per D-06. Not against the Netlify deploy preview. Per D-13, single run — no retries.

---

### `PROJECT.md` (modified, conditional on PASS — docs, self-analog)

**Analog (exact, self):** existing Key Decision table in `PROJECT.md`.

**PASS path** (per D-08): flip `Mobile-first responsive design` row status from `⚠️` to `✓`. Single-character edit.
**DEFER path** (per D-07): NO edit. Row stays `⚠️`.

---

## Shared Patterns

### Authentication / Authorization
**Not applicable.** Phase 16 is pure frontend bundle work. No new admin gates, no new auth boundaries. The existing `AdminGuard` + `AuthContext` are untouched (only the AuthContext import line swaps from `@/lib/posthog` to `@/lib/posthog-facade`).

### Error Handling
**Not applicable** to the new code surface — PostHogGate has no error state (lazy chunk-load failure is the only path; per RESEARCH.md user constraints, chunk-load error retry/persistence is OUT OF SCOPE). Sentry's existing app-root `ErrorBoundary` (in `src/main.tsx:77-100`) catches any unhandled chunk-load error and renders `AppErrorFallback`.

### Validation
**Not applicable.** No new input surfaces.

### Logging
**Existing pattern preserved:**
- `vite.config.ts`'s D-09 throw uses `throw new Error(...)` (build-time, surfaces in `npm run build` stderr).
- No `console.log` additions in `src/`.

### Comments (project rule from CLAUDE.md)
**Apply to:** every new `src/` file (`posthog-facade.ts`, `PostHogGate.tsx`, `PostHogProviderInner.tsx`).
- WHY-only — explain rationale, not what the code does.
- NEVER cite plan IDs, phase numbers, PERF-NN, D-NN, round numbers, OBSV-NN inside `src/` files (the no-archaeology rule). Plan refs live in PR/commit, not src/.
- The `vite.config.ts` D-09 throw MESSAGE is the one exception — it explicitly references OBSV-04 + Phase 15 per UI-SPEC § Copywriting Contract requirement (the maintainer reading the error log needs the trap named).

### Import discipline (project rule from CLAUDE.md + CONTEXT.md):
**Apply to:** every new `src/` file.
- Use `@/` alias for all in-project imports (272 hits in `src/` per CONTEXT § Established Patterns; zero `from '..'`).
- Use `import type` for type-only imports per `verbatimModuleSyntax: true` — load-bearing for `posthog-facade.ts` (the type-only import of `posthog` keeps `posthog-js` out of the critical-path chunk).
- ESM only.

### Default-export discipline (project rule, with one exception):
- `PostHogProviderInner.tsx` is the ONLY new file that may use `export default` (because `React.lazy()` requires it OR the `.then(m => ({ default: m.X }))` destructure).
- **Recommended:** named export + `.then()` destructure (per `src/routes/[__smoke].tsx:13-17` analog) so the no-default-export rule holds uniformly.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/assets/wtcs-logo.webp` | binary asset | n/a | One-shot `cwebp` shell output; no code analog. Sibling `wtcs-logo.png` is the placement+naming reference. |

---

## Metadata

**Analog search scope:**
- `src/routes/` (lazy + Suspense patterns)
- `src/components/` (PostHog provider current usage)
- `src/lib/` (module-scope state patterns, posthog init)
- `src/contexts/` (consent + auth current callers of `posthog.*`)
- `src/__tests__/` (vitest + testing-library shapes)
- `src/assets/` (asset placement)
- `vite.config.ts` + `package.json` + `scripts/verify-sourcemap-names.mjs` (build pipeline + Phase 15 keepNames invariant)
- `.planning/closure/` (evidence file conventions)

**Files scanned (read in full or targeted-section):**
- `src/routes/__root.tsx` (50 lines)
- `src/routes/[__smoke].tsx` (95 lines)
- `src/main.tsx` (102 lines)
- `src/contexts/ConsentContext.tsx` (83 lines)
- `src/contexts/AuthContext.tsx` (218 lines)
- `src/lib/posthog.ts` (40 lines)
- `src/hooks/useConsent.ts` (12 lines)
- `src/components/layout/Navbar.tsx` (140 lines)
- `vite.config.ts` (58 lines)
- `package.json` (70 lines)
- `scripts/verify-sourcemap-names.mjs` (77 lines)
- `src/__tests__/contexts/ConsentContext.test.tsx` (140 lines)
- `src/__tests__/layout/Navbar.test.tsx` (lines 1-60)
- `src/__tests__/setup/smoke.test.ts` (15 lines)
- `src/__tests__/admin/category-crud-edge.test.ts` (lines 1-40)
- `src/test/setup.ts` (10 lines)
- `.planning/phases/16-uidn-02-aggressive-perf-budget-pass/16-CONTEXT.md`
- `.planning/phases/16-uidn-02-aggressive-perf-budget-pass/16-RESEARCH.md` (lines 1-300)
- `.planning/phases/16-uidn-02-aggressive-perf-budget-pass/16-UI-SPEC.md`

**Pattern extraction date:** 2026-05-27
