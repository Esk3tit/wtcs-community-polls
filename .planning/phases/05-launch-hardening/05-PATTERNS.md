# Phase 5: Launch Hardening - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 36 (new + modified)
**Analogs found:** 24 with codebase analogs / 12 greenfield (flagged "use RESEARCH.md")

---

## File Classification

### Greenfield (no direct codebase analog — use RESEARCH.md code excerpts)

| New File | Role | Data Flow | Fallback Source |
|----------|------|-----------|-----------------|
| `.github/workflows/ci.yml` | config (CI pipeline) | event-driven (PR/push) | RESEARCH Pattern 3 |
| `.github/workflows/deploy-edge-functions.yml` | config (CD pipeline) | event-driven (push-to-main) | RESEARCH Pattern 2 |
| `.github/workflows/cron-sweep.yml` | config (scheduler) | event-driven (cron) | RESEARCH Pattern 1 |
| `.github/dependabot.yml` | config (supply-chain) | event-driven (weekly schedule) | RESEARCH Pattern 10 |
| `netlify.toml` | config (deploy) | static/build | RESEARCH (Runtime State Inventory) |
| `e2e/playwright.config.ts` | config (test runner) | request-response | RESEARCH Pattern 3/4 |
| `e2e/helpers/auth.ts` | utility (test harness) | request-response | RESEARCH Pattern 4 |
| `e2e/fixtures/seed.sql` | config (test data) | batch | `supabase/seed.sql` (loose analog) |
| `e2e/fixtures/test-users.ts` | utility (test data) | static | RESEARCH Wave 0 Gaps |
| `e2e/tests/*.spec.ts` (4 files) | test | request-response | RESEARCH §D-08 |
| `src/lib/posthog.ts` | utility (analytics init) | event-driven | RESEARCH Pattern 8 |
| `docs/screenshots/*.png` | asset (docs images) | static binary | n/a (new assets) |

### Has Codebase Analog

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|-------------------|------|-----------|----------------|-------|
| `src/components/AppErrorFallback.tsx` | component | request-response | `src/components/auth/AuthGuard.tsx` | role-match (centered status screen) |
| `src/components/ConsentChip.tsx` | component | event-driven (user consent) | `src/components/suggestions/PinnedBanner.tsx` + shadcn Button patterns | role-match (small informational surface) |
| `src/components/suggestions/SuggestionSkeleton.tsx` (upgrade) | component | streaming/loading | `src/components/suggestions/SuggestionCard.tsx` (silhouette to match) | exact (upgrade-in-place) |
| `src/main.tsx` (modify) | bootstrap | app-init | current `src/main.tsx` (extend, keep StrictMode) | exact |
| `src/contexts/AuthContext.tsx` (modify) | context provider | event-driven (auth state) | current `AuthContext.tsx` onAuthStateChange branch | exact (add `posthog.identify` / `posthog.reset`) |
| `src/components/suggestions/SuggestionList.tsx` (verify) | component | CRUD fetch | current `SuggestionList.tsx` `loading` branch | exact (already wires skeleton — verify silhouette) |
| `src/routes/topics.tsx` (modify) | route | request-response | current `topics.tsx` | exact (Navbar Link `preload="intent"`) |
| `src/routes/archive.tsx` (modify) | route | request-response | current `archive.tsx` | exact |
| `src/components/layout/Navbar.tsx` (modify) | component | request-response | current `Navbar.tsx` Link elements | exact (add `preload="intent"`) |
| `vite.config.ts` (modify) | config (build) | static | current `vite.config.ts` (insert Sentry plugin LAST) | exact |
| `package.json` (modify) | config (deps) | static | current `package.json` | exact (strip `^`/`~` sweep) |
| `.env.example` (modify) | config (env) | static | current `.env.example` (extend) | exact |
| `supabase/functions/*/index.ts` (15 files — pin sweep + optional Sentry wrap) | service | request-response | `supabase/functions/submit-vote/index.ts` | exact (pattern sweep) |
| `README.md` (full rewrite) | documentation | static | current `README.md` + `CLAUDE.md` (project tone) | no direct analog — treat as new-file scale |

---

## Pattern Assignments

### `supabase/functions/*/index.ts` — `esm.sh` pin sweep (D-16 §3) + optional Sentry wrap

**Analog:** `supabase/functions/submit-vote/index.ts` (representative EF)
**Secondary:** `supabase/functions/close-expired-polls/index.ts` (cron target itself)
**Shared modules:** `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/admin-auth.ts`

**Canonical import header to replace in ALL 15 EFs** (lines 1-4 of `submit-vote/index.ts`):

```typescript
// BEFORE (current — all 15 EFs use "@<major>" floating pins)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Ratelimit } from 'https://esm.sh/@upstash/ratelimit@2'
import { Redis } from 'https://esm.sh/@upstash/redis@1'
import { getCorsHeaders } from '../_shared/cors.ts'

// AFTER (D-16 §3 — exact 3-digit pins)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'
import { Ratelimit } from 'https://esm.sh/@upstash/ratelimit@2.x.y'   // executor: look up current x.y
import { Redis } from 'https://esm.sh/@upstash/redis@1.x.y'
import { getCorsHeaders } from '../_shared/cors.ts'
```

**Every EF to sweep (15 files + 1 shared type file):**

- `_shared/admin-auth.ts` (line 1: `import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'`)
- `close-expired-polls/index.ts` (line 21)
- `close-poll/index.ts` (line 6)
- `create-category/index.ts` (line 6)
- `create-poll/index.ts` (line 3)
- `delete-category/index.ts` (line 7)
- `delete-poll/index.ts` (line 7)
- `demote-admin/index.ts` (line 6)
- `get-upload-url/index.ts` (line 9)
- `pin-poll/index.ts` (line 5)
- `promote-admin/index.ts` (line 11)
- `rename-category/index.ts` (line 6)
- `search-admin-targets/index.ts` (line 7)
- `set-resolution/index.ts` (line 6)
- `submit-vote/index.ts` (lines 1-3 — three imports including upstash)
- `update-poll/index.ts` (line 3)

**Canonical EF handler structure** (from `submit-vote/index.ts` lines 14-30, 156-163):

```typescript
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // ... handler body ...
  } catch (err) {
    console.error('<function-name> error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

**Sentry wrap pattern (D-13, optional per-EF roll-out):** see RESEARCH §Pattern 7 — `Sentry.init({ defaultIntegrations: false })` at module scope + `Sentry.withScope` wrapping the entire handler body. Insert `Sentry.captureException(err, scope)` BEFORE the existing `console.error(...)` inside the outer catch.

---

### `supabase/functions/close-expired-polls/index.ts` — cron target (already hardened; only needs pin sweep + optional Sentry)

**Analog:** itself (no other cron-style EF).

**Existing secret-gate pattern** (lines 31-45, DO NOT MODIFY — planner references this for the cron-sweep workflow):

```typescript
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders)

  const expectedSecret = Deno.env.get('CLOSE_SWEEPER_SECRET')
  if (!expectedSecret) {
    console.warn('close-expired-polls invoked but CLOSE_SWEEPER_SECRET not set (Phase 5 will provision)')
    return json({ error: 'Sweeper not configured' }, 503, corsHeaders)
  }

  const providedSecret = req.headers.get('X-Cron-Secret')
  if (!providedSecret || providedSecret !== expectedSecret) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders)
  }
  // ... sweep body ...
})
```

**Key invariants the `cron-sweep.yml` workflow MUST respect:**
- POST (not GET) — line 34
- Header name is `X-Cron-Secret` (exact casing) — line 42
- 503 when secret unset = "cron is blind"; 401 = "cron has wrong secret"; 200 = success
- Response body on success: `{ success: true, swept: <n>, ids: [...] }` — line 63-71

---

### `src/main.tsx` — Sentry init + PostHog provider (D-13)

**Analog:** current `src/main.tsx` (19 lines) — keep structure, insert.

**Current structure (lines 1-19):**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
```

**Target structure (merge RESEARCH Pattern 5 + Pattern 8):**
- Add `Sentry.init({...})` BEFORE `createRoot` (module side effect — runs once)
- Add `initPostHog()` call BEFORE `createRoot`
- Wrap `<RouterProvider>` with `<Sentry.ErrorBoundary fallback={<AppErrorFallback />}>` and `<PostHogProvider client={posthog}>`
- Keep `StrictMode` as the outermost wrapper (Pattern 8 landmine — PostHog init must be pre-mount to avoid StrictMode double-init)
- Router config upgrade (D-14 prefetch): `createRouter({ routeTree, defaultPreload: 'intent', defaultPreloadStaleTime: 30_000 })`

---

### `src/contexts/AuthContext.tsx` — PostHog identify hook (D-13)

**Analog:** itself — extend existing `onAuthStateChange` branches.

**Insertion points** (current file lines 80-116):

```typescript
// Line 83 — in the SIGNED_IN success branch, AFTER handleAuthCallback() succeeds,
// AFTER setSession/setUser on lines 107-108:
if (newSession?.user?.user_metadata?.provider_id) {
  // provider_id = Discord snowflake (per RESEARCH Assumption A5 — verify once via console.log)
  // NEVER identify with email/username/discriminator
  posthog.identify(newSession.user.user_metadata.provider_id)
}

// Inside signOut() (current lines 121-132) — ADD before supabase.auth.signOut():
posthog.reset()
```

**Existing guard pattern to preserve** (lines 84-106):
```typescript
if (event === 'SIGNED_IN' && newSession?.provider_token) {
  verifyingRef.current = true
  try {
    const result = await handleAuthCallback()
    if (!result.success) {
      window.location.href = `/auth/error?reason=${result.reason}`
      return  // do NOT identify on auth failure
    }
  } catch {
    window.location.href = '/auth/error?reason=auth-failed'
    return  // do NOT identify on auth exception
  } finally {
    verifyingRef.current = false
  }
}
```
`posthog.identify()` MUST be placed AFTER the auth gate (after `setSession(newSession)`) so failed-verification users never get identified.

---

### `src/components/AppErrorFallback.tsx` — Sentry ErrorBoundary fallback (NEW)

**Analog:** `src/components/auth/AuthGuard.tsx` (centered status screen)
**Secondary:** UI-SPEC Contract 2 (exact layout)

**Centered-page pattern from `AuthGuard.tsx` lines 9-14:**

```tsx
if (loading) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <LoaderCircle className="h-8 w-8 text-muted-foreground animate-spin" />
    </div>
  )
}
```

**Copy wording (UI-SPEC Contract 2, lines 98-103):**
- Heading: `Something went wrong.` — `text-lg font-medium`
- Body: `The page hit an unexpected error. Reloading usually helps. If this keeps happening, let us know.` — `text-sm text-muted-foreground leading-relaxed`
- Primary button: `Reload page` — shadcn `<Button>` default variant, `onClick={() => window.location.reload()}`
- Secondary button: `Report issue` — `<Button variant="link">` → GitHub Issues URL

**Container primitives (UI-SPEC lines 165-187):**
- Outer: `min-h-dvh flex items-center justify-center p-6`
- Card: `bg-card rounded-xl border p-6 max-w-md w-full`
- Optional icon: `AlertCircle` from `lucide-react`, `size-5 text-muted-foreground` (NOT destructive)

**Button import (established pattern):**
```tsx
import { Button } from '@/components/ui/button'
```
Confirmed available — see `src/components/layout/Navbar.tsx` line 3.

---

### `src/components/ConsentChip.tsx` — PostHog consent indicator (NEW)

**Analog:** `src/components/suggestions/PinnedBanner.tsx` (small informational surface; 634 bytes — same scale)
**Secondary:** `src/components/layout/Navbar.tsx` Dropdown/Button pattern (lines 66-88)

**Fixed-position card primitives (UI-SPEC Contract 3, lines 212-216):**

```tsx
<div className="fixed bottom-4 right-4 z-40 max-w-xs rounded-lg border bg-card shadow-md p-3 max-w-[calc(100vw-2rem)] transition-opacity">
  <p className="text-xs text-muted-foreground leading-relaxed">
    Anonymous usage data helps us improve this.
  </p>
  <Button variant="link" size="sm" onClick={handleOptOut}>Opt out</Button>
  <Button variant="ghost" size="icon" onClick={handleDismiss} aria-label="Dismiss">
    <X className="size-3" />
  </Button>
</div>
```

**State persistence pattern** (RESEARCH Pattern 8 consent snippet):
```typescript
// Opt-out:
posthog.opt_out_capturing()
localStorage.setItem('posthog_consent_chip_dismissed', 'true')
// Opt-in:
posthog.opt_in_capturing()
localStorage.removeItem('posthog_consent_chip_dismissed')
```

**Visibility gating:**
- Read `localStorage.getItem('posthog_consent_chip_dismissed')` in a `useEffect` → `useState(true/false)` for first-render.
- Do NOT render on `/admin/*` routes (UI-SPEC line 198 — use TanStack Router `useMatchRoute` or equivalent).

---

### `src/components/suggestions/SuggestionSkeleton.tsx` — upgrade silhouette (D-14)

**Analog:** `src/components/suggestions/SuggestionCard.tsx` (silhouette MUST match)
**Current file:** `src/components/suggestions/SuggestionSkeleton.tsx` (12 lines — the "incorrect silhouette" flagged by UI-SPEC)

**Current silhouette** (too coarse — just 3 flat `h-24` bars):
```tsx
<div aria-busy="true" aria-label="Loading topics" className="space-y-3">
  {Array.from({ length: 3 }, (_, i) => (
    <div key={i} className="bg-muted rounded-xl h-24 animate-pulse" />
  ))}
</div>
```

**Target silhouette (UI-SPEC lines 134-141 + SuggestionCard.tsx lines 78-171):**
```tsx
// Match SuggestionCard outer: bg-card rounded-xl border p-5 + space-y-3 list gap
<div aria-busy="true" aria-label="Loading topics" className="space-y-3">
  {Array.from({ length: 3 }, (_, i) => (
    <div key={i} className="bg-card rounded-xl border p-5">
      {/* Row 1: category badge + time meta */}
      <div className="flex items-center justify-between gap-2">
        <div className="bg-muted rounded h-4 w-20 animate-pulse" />
        <div className="bg-muted rounded h-4 w-16 animate-pulse" />
      </div>
      {/* Row 2: title */}
      <div className="bg-muted rounded h-5 w-3/4 mt-2 animate-pulse" />
      {/* Row 3: avatar + meta + responses */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-muted rounded-full h-6 w-6 animate-pulse" />
          <div className="bg-muted rounded h-4 w-24 animate-pulse" />
        </div>
        <div className="bg-muted rounded h-4 w-16 animate-pulse" />
      </div>
    </div>
  ))}
</div>
```

**Card-silhouette reference** (from `SuggestionCard.tsx` lines 78-83, 100, 109, 127, 147-170):
- Outer: `bg-card rounded-xl border shadow-sm` + inner `p-5`
- Title row: `h3.text-lg.font-medium.mt-2`
- Footer row: `mt-3 flex items-center justify-between` with `w-6 h-6 rounded-full bg-muted` avatar
- List gap (from `SuggestionList.tsx` line 127): `space-y-3`

**Accessibility:** keep `aria-busy="true"` + `aria-label="Loading topics"` (already correct).

---

### `src/components/layout/Navbar.tsx` — `preload="intent"` on nav Links (D-14)

**Analog:** itself — modify Link elements only.

**Insertion** (current lines 38-60, add `preload="intent"` to Topics + Archive; EXCLUDE Admin):

```tsx
<Link to="/topics" preload="intent" className="..." activeProps={...}>Topics</Link>
<Link to="/archive" preload="intent" className="..." activeProps={...}>Archive</Link>
{/* Admin link: NO preload — avoids beforeLoad redirect-on-hover (RESEARCH Pitfall 6) */}
{isAdmin && <Link to="/admin" className="..." activeProps={...}>Admin</Link>}
```

**Alternative (per RESEARCH Pattern 9):** set `defaultPreload: 'intent'` in `createRouter` (in `src/main.tsx`) so all Links inherit — BUT this would apply to Admin too, triggering Pitfall 6. Explicit per-Link is safer for v1.

**`MobileNav` equivalent:** `src/components/layout/MobileNav.tsx` — apply the same rule. (Not read in detail; planner should verify.)

---

### `src/routes/topics.tsx`, `src/routes/archive.tsx` — ROUTE verification

**Analog:** themselves.

**Current `topics.tsx` (28 lines) + `archive.tsx` (38 lines)** already use `AuthGuard` + `SuggestionList` — no direct prefetch config required in the route file. Prefetch lives on `<Link>` elements (Navbar). Planner may optionally add a route-level `loader` to pre-fetch suggestions data on intent, but `useSuggestions` hook is client-only today; wiring a loader is out-of-scope polish unless the planner sees value.

---

### `vite.config.ts` — Sentry Vite plugin LAST (D-13)

**Analog:** current `vite.config.ts` (29 lines) — insert `sentryVitePlugin` as the final plugin, add `build.sourcemap: 'hidden'`.

**Current plugin order (lines 7-15):**

```typescript
plugins: [
  tanstackRouter({ target: 'react', autoCodeSplitting: true }),
  react(),
  tailwindcss(),
],
```

**Target (RESEARCH Pattern 6):**

```typescript
plugins: [
  tanstackRouter({ target: 'react', autoCodeSplitting: true }),
  react(),
  tailwindcss(),
  sentryVitePlugin({                               // MUST be LAST
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    sourcemaps: { filesToDeleteAfterUpload: './dist/**/*.map' },
    disable: process.env.NODE_ENV !== 'production',
  }),
],
build: { sourcemap: 'hidden' },
```

**Landmine (RESEARCH Pitfall 3):** Plugin LAST in array, `SENTRY_AUTH_TOKEN` in Netlify build env (NOT `VITE_` prefix).

---

### `package.json` — strip `^`/`~` pins (D-16 §1)

**Analog:** current `package.json` (63 lines) — every dep has `^`, one dev-dep has `~`.

**Sweep target** (every entry in `dependencies` + `devDependencies`, lines 17-56). Use currently-installed versions from `package-lock.json` (do NOT bump, D-16 §1).

Grep proof (from file, lines 18-55):
```
"@supabase/supabase-js": "^2.101.1",    →  "@supabase/supabase-js": "2.101.1",
"@tanstack/react-router": "^1.168.10",  →  "@tanstack/react-router": "1.168.10",
"supabase": "^2.85.0",                  →  "supabase": "2.85.0",
"typescript": "~6.0.2",                  →  "typescript": "6.0.2",
... 30 more ...
```

**Also add** `--save-exact` for the 4 new phase-5 devDeps (RESEARCH Installation one-liner). See RESEARCH §Standard Stack for exact versions.

---

### `.env.example` — extend with D-12 layout

**Analog:** current `.env.example` (not directly readable via tool — inferred from `src/lib/supabase.ts` lines 4-5 which reference `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).

**Target variables to ensure documented** (CONTEXT D-12 split + new D-13 keys):

```bash
# Client build-time (VITE_* prefix — exposed to browser bundle)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SENTRY_DSN=
VITE_POSTHOG_KEY=
VITE_COMMIT_SHA=                 # optional — Netlify provides COMMIT_REF

# Build-time only (NOT VITE_ prefix — server/build-runner only)
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=

# Supabase Edge Function runtime (set via `supabase secrets set`, not .env)
# CLOSE_SWEEPER_SECRET=
# UPSTASH_REDIS_URL=
# UPSTASH_REDIS_TOKEN=
# DISCORD_GUILD_ID=

# GitHub Actions repo secrets (set in GitHub repo settings, not .env)
# SUPABASE_ACCESS_TOKEN=
# SUPABASE_PROJECT_REF=
# CLOSE_SWEEPER_SECRET=
```

---

### `e2e/fixtures/seed.sql` — test fixtures

**Analog:** `supabase/seed.sql` (existing admin + categories seed — 30+ lines shown above).

**Pattern to follow** (from `supabase/seed.sql` lines 16-28):
```sql
INSERT INTO public.admin_discord_ids (discord_id) VALUES
  ('FIXTURE_ADMIN_DISCORD_ID')
ON CONFLICT (discord_id) DO NOTHING;

INSERT INTO public.categories (id, name, slug, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Lineup Changes', 'lineup-changes', 1)
ON CONFLICT (id) DO NOTHING;
```

Extend with fixture `auth.users` rows, `profiles` rows (guild_member=true, mfa_verified=true for happy-path; false variants for auth-error spec D-08 #4), and a minimal `polls` + `choices` set.

---

## Shared Patterns

### Path Alias
**Source:** `vite.config.ts` lines 16-20, used throughout `src/` (e.g. `AuthContext.tsx` lines 4-5, `Navbar.tsx` lines 3-13)
**Apply to:** all new components + lib files
```typescript
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
```

### `verbatimModuleSyntax` — `import type` for types
**Source:** `tsconfig.app.json` rule + pattern in `src/contexts/AuthContext.tsx` lines 2-3
**Apply to:** ALL new TS files (Sentry/PostHog types MUST be imported via `import type`)
```typescript
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
```

### ESLint `--max-warnings 0`
**Source:** `package.json` line 60 (lint-staged config)
**Apply to:** all new source code; pre-commit hook `.husky/pre-commit` runs `lint-staged`.
**Watch out for:** unused `_` imports; Sentry SDK re-exports that may trigger `react-refresh/only-export-components` (see `topics.tsx` line 1 for the existing escape hatch: `/* eslint-disable react-refresh/only-export-components */`).

### CORS headers — pattern for any new EF or change
**Source:** `supabase/functions/_shared/cors.ts` (18 lines total — multi-origin, Vary: Origin)
**Apply to:** any EF header block.
**Production surface must include:** `https://polls.wtcsmapvote.com` (line 2) — already present.

### Admin gate in EFs
**Source:** `supabase/functions/_shared/admin-auth.ts` `requireAdmin()` (lines 19-42)
**Apply to:** unchanged in this phase — do NOT remove or bypass the admin gate during pin-sweep edits. Every EF that uses it must keep using it.

### React Component file shape
**Source:** `src/components/suggestions/PinnedBanner.tsx` (634 bytes; simple named export), `src/components/auth/AuthGuard.tsx` (22 lines; named export, typed props via inline interface)
**Apply to:** `AppErrorFallback.tsx`, `ConsentChip.tsx`
- Named export (`export function ComponentName(...)`)
- Props typed inline: `{ children }: { children: ReactNode }`
- Tailwind utility classes; no CSS modules, no styled-components
- `cn()` helper from `@/lib/utils` if combining conditional classes

### Navbar-style Link with active state
**Source:** `src/components/layout/Navbar.tsx` lines 38-60
**Apply to:** any new nav entry (e.g. Privacy link for re-opening the consent chip, UI-SPEC line 222)
```tsx
<Link
  to="/topics"
  preload="intent"
  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
  activeProps={{ className: 'text-foreground' }}
>
  Topics
</Link>
```

---

## No Analog Found

Files where the planner should pull directly from `05-RESEARCH.md`:

| File | Why | RESEARCH Section |
|------|-----|------------------|
| `.github/workflows/ci.yml` | `.github/` directory doesn't exist | Pattern 3 |
| `.github/workflows/deploy-edge-functions.yml` | same | Pattern 2 |
| `.github/workflows/cron-sweep.yml` | same | Pattern 1 |
| `.github/dependabot.yml` | same | Pattern 10 |
| `netlify.toml` | no current `netlify.toml` | Runtime State Inventory |
| `e2e/playwright.config.ts` | no existing Playwright config | Wave 0 Gaps + Pattern 3 |
| `e2e/helpers/auth.ts` | no existing test harness for session mint | Pattern 4 |
| `e2e/tests/*.spec.ts` (4) | no existing E2E specs | CONTEXT D-08 + RESEARCH Wave 0 Gaps |
| `e2e/fixtures/test-users.ts` | no existing fixture data module | Wave 0 Gaps |
| `src/lib/posthog.ts` | no existing analytics lib module | Pattern 8 |
| `docs/screenshots/*.png` | new asset directory | n/a |
| `README.md` (full rewrite) | current is Vite scaffold cruft; wholesale replace | CONTEXT D-15 — 13 sections |

---

## Metadata

**Analog search scope:** `supabase/functions/` (17 entries), `src/` (components, contexts, hooks, lib, routes), root-level configs (`package.json`, `vite.config.ts`, `.husky/`, `components.json`)
**Files scanned:** ~30 (representative; stopped at 3-5 strong analogs per new file per agent policy)
**Pattern extraction date:** 2026-04-19
**Primary reuse driver:** `supabase/functions/submit-vote/index.ts` (EF template), `src/main.tsx` (bootstrap), `src/contexts/AuthContext.tsx` (auth lifecycle), `src/components/suggestions/SuggestionCard.tsx` (skeleton silhouette), `src/components/auth/AuthGuard.tsx` (centered-screen fallback).
