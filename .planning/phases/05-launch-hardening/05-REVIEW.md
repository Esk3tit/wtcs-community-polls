---
phase: 05-launch-hardening
reviewed: 2026-04-19T00:00:00Z
depth: deep
files_reviewed: 45
files_reviewed_list:
  - .github/dependabot.yml
  - .github/workflows/ci.yml
  - .github/workflows/cron-sweep.yml
  - .github/workflows/deploy-edge-functions.yml
  - e2e/fixtures/seed.sql
  - e2e/fixtures/test-users.ts
  - e2e/helpers/auth.ts
  - e2e/playwright.config.ts
  - e2e/tests/admin-create.spec.ts
  - e2e/tests/auth-errors.spec.ts
  - e2e/tests/browse-respond.spec.ts
  - e2e/tests/filter-search.spec.ts
  - netlify.toml
  - src/__tests__/components/AppErrorFallback.test.tsx
  - src/__tests__/components/ConsentChip.test.tsx
  - src/__tests__/components/SuggestionSkeleton.test.tsx
  - src/components/AppErrorFallback.tsx
  - src/components/ConsentChip.tsx
  - src/components/admin/AdminSuggestionsTab.tsx
  - src/components/layout/MobileNav.tsx
  - src/components/layout/Navbar.tsx
  - src/components/suggestions/SuggestionCard.tsx
  - src/components/suggestions/SuggestionSkeleton.tsx
  - src/contexts/AuthContext.tsx
  - src/lib/posthog.ts
  - src/lib/sentry.ts
  - src/main.tsx
  - supabase/functions/_shared/admin-auth.ts
  - supabase/functions/_shared/cors.ts
  - supabase/functions/close-expired-polls/index.ts
  - supabase/functions/close-poll/index.ts
  - supabase/functions/create-category/index.ts
  - supabase/functions/create-poll/index.ts
  - supabase/functions/delete-category/index.ts
  - supabase/functions/delete-poll/index.ts
  - supabase/functions/demote-admin/index.ts
  - supabase/functions/get-upload-url/index.ts
  - supabase/functions/pin-poll/index.ts
  - supabase/functions/promote-admin/index.ts
  - supabase/functions/rename-category/index.ts
  - supabase/functions/search-admin-targets/index.ts
  - supabase/functions/set-resolution/index.ts
  - supabase/functions/submit-vote/index.ts
  - supabase/functions/update-poll/index.ts
  - vite.config.ts
findings:
  critical: 0
  high: 1
  medium: 2
  low: 3
  advisory: 4
  total: 10
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-04-19
**Depth:** deep (cross-file / import-graph analysis)
**Files Reviewed:** 45 source files (workflows, EFs, src/, e2e/)
**Status:** issues_found (1 High, 2 Medium, 3 Low, 4 Advisory)

## Summary Table

| Severity | Count | Examples |
|----------|------:|----------|
| Critical |     0 | — |
| High     |     1 | HI-01 ConsentChip calls `useRouterState` as sibling of `<RouterProvider>` — potential TypeError on first render |
| Medium   |     2 | ME-01 CORS fallback echoes `ALLOWED_ORIGINS[0]` to non-allowed origins; ME-02 `@sentry/react` static+dynamic import collapses Replay into main chunk |
| Low      |     3 | LO-01 Supabase status `jq` path fallback order fragile; LO-02 `loginAs` re-login per test adds init-script but prior session may persist in memory; LO-03 15-char auth helper race if page navigates before addInitScript |
| Advisory |     4 | AD-01 Defense-in-depth: admin-create timeout tight; AD-02 CORS `Vary` missing `Access-Control-Request-Method`; AD-03 `sentry.ts` M3 comment drift; AD-04 Non-exhaustive NODE_VERSION pin |

### Verdict

**Overall: Ship-safe with one High to validate in browser.** The Phase 5 launch-hardening changes are well-executed — CORS allowlist, PostHog PII minimization, consent-gated Replay lazy-load, cron dual-header auth, npm-ci enforcement, exact-pin esm.sh imports, and all 15 Edge Functions admin-gated or equivalently defended. The one concerning find is HI-01: `ConsentChip` is rendered as a sibling of `<RouterProvider>` in `src/main.tsx`, but calls `useRouterState()` — which reads from the router React context. In TanStack Router 1.168.10 `routerContext` defaults to `null` and the hook accesses `router.stores.__store` without a guard, which would throw `TypeError: Cannot read properties of null (reading 'stores')` on every render of a sibling. The VERIFICATION report marks prod user-confirmed, so either my analysis is incomplete (possible — this warrants empirical check) or the crash was masked by `Sentry.ErrorBoundary`. Either way, placement is fragile and should be fixed by moving `<ConsentChip />` inside the router tree (e.g. into `__root.tsx`).

All priority checks from the review prompt pass: no `VITE_SENTRY_AUTH_TOKEN` leakage, no `SERVICE_ROLE_KEY` in `loginAs`, no `generateLink`/magicLink helper usage, cron uses dual headers, Sentry plugin is LAST in plugins array with correct `mode`-based disable, no `defaultPreload` on the router, `preload="intent"` present on Topics/Archive and ABSENT on Admin (both Navbar and MobileNav), all 18 esm.sh imports three-digit pinned, `posthog.identify(provider_id)` uses only the Discord snowflake (not email/username/discriminator), `posthog.reset()` fires BEFORE `supabase.auth.signOut()`, and all 15 EFs enforce either `requireAdmin()` or an equivalent gate (cron-secret for close-expired-polls; `getUser()` + `guild_member` + `mfa_verified` for submit-vote).

---

## High

### HI-01: `ConsentChip` renders outside router context but calls `useRouterState`

**Files:** `src/main.tsx:46-55`, `src/components/ConsentChip.tsx:3,25`
**Issue:**
In `src/main.tsx` the JSX tree is:

```tsx
<Sentry.ErrorBoundary ...>
  <PostHogProvider ...>
    <RouterProvider router={router} />   {/* provides routerContext to descendants */}
    <ConsentChip />                       {/* SIBLING — does not inherit router context */}
  </PostHogProvider>
</Sentry.ErrorBoundary>
```

`ConsentChip` calls `useRouterState({ select: (s) => s.location.pathname })` (line 25). React context is propagated only to descendants — siblings of `<RouterProvider>` do **not** see `routerContext`.

In `@tanstack/react-router@1.168.10` (`node_modules/@tanstack/react-router/dist/esm/`):

- `routerContext.js`: `createContext(null)` — default is `null`, not a noop router.
- `useRouter.js`: returns `useContext(routerContext)` with only a dev-mode `console.warn` — no throw, no fallback.
- `useRouterState.js` lines 20-27:
  ```js
  const contextRouter = useRouter({ warn: opts?.router === void 0 })
  const router = opts?.router || contextRouter   // null
  if (isServer ?? router.isServer) { ... }        // isServer is false → short-circuit
  return useStore(router.stores.__store, ...)     // throws: cannot read 'stores' of null
  ```

So in production, `ConsentChip`'s first render should throw `TypeError: Cannot read properties of null (reading 'stores')`. That error is caught by the outer `<Sentry.ErrorBoundary>`, which would then render `<AppErrorFallback />` INSTEAD of the whole app — not just ConsentChip.

The 05-VERIFICATION.md report says production is user-confirmed (OAuth + respond + results all work), which contradicts a boot-time crash. Possibilities:

1. Users hit `localStorage.posthog_consent_chip_dismissed === 'true'` → but that's checked only AFTER the hook runs, so it doesn't help.
2. A different tanstack-router version is actually deployed (check `package-lock.json`).
3. The error was fleeting and masked somehow.
4. My static analysis is wrong and something in production renders ConsentChip inside the router tree.

Either way this is fragile placement. The tests pass only because `ConsentChip.test.tsx` mocks `@tanstack/react-router`:
```tsx
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }) => select({ location: { pathname: currentPathname } }),
}))
```
So the unit test does not exercise the real hook against a missing context — the bug is invisible to the test suite.

**Fix (preferred):** move `<ConsentChip />` into the router tree, inside `src/routes/__root.tsx`, alongside `<Toaster />`:
```tsx
// src/routes/__root.tsx
return (
  <AuthProvider>
    <ThemeProvider ...>
      <div className="min-h-svh bg-background">
        <Navbar />
        <main ...><Outlet /></main>
      </div>
      <Toaster />
      <ConsentChip />     {/* descendant of RouterProvider → routerContext reachable */}
    </ThemeProvider>
  </AuthProvider>
)
```

**Fix (alternative):** keep the sibling placement but replace `useRouterState` with a plain subscription to `window.location.pathname` + a `popstate`/`pushstate` listener. TanStack Router intercepts navigation, so this requires a router event subscription instead, e.g.:
```tsx
const [pathname, setPathname] = useState(() => window.location.pathname)
useEffect(() => {
  const onChange = () => setPathname(window.location.pathname)
  window.addEventListener('popstate', onChange)
  // TanStack Router dispatches 'navigate' via the History API; wrap pushState/replaceState
  return () => window.removeEventListener('popstate', onChange)
}, [])
```
Less clean; option 1 is simpler.

**Rationale:** Even if production is currently masking this (most likely via the ErrorBoundary swallowing the error and the user seeing the app on a second render path I haven't traced), a component that reads router state MUST live inside the router tree. The unit test mocks this away, so regressions won't be caught by CI. Playwright `@smoke` will catch it once it runs in CI against a real build — expect this to surface there.

---

## Medium

### ME-01: CORS fallback echoes `ALLOWED_ORIGINS[0]` to non-allowed origins

**File:** `supabase/functions/_shared/cors.ts:9`
**Issue:**
```ts
const resolvedOrigin = allowedOrigin ?? (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])
```
When an attacker origin is sent (say `https://evil.example.com`), the EF responds with `Access-Control-Allow-Origin: https://polls.wtcsmapban.com`. Browsers correctly reject (the allowed value doesn't match the request origin), so this is not an authentication bypass. But the behavior is confusing and hides misconfiguration: any request from any origin gets a "success-looking" CORS header that happens to be for the prod app.

**Fix:** For a non-matching origin, either return an empty `Access-Control-Allow-Origin` header (let the browser block definitively) or return `'null'`:
```ts
const resolvedOrigin =
  allowedOrigin ??
  (ALLOWED_ORIGINS.includes(origin) ? origin : 'null')
```
`'null'` is the CORS-spec literal for "not allowed; browsers will reject".

**Rationale:** Defense-in-depth clarity. If someone is trying to mount a CSRF/CORS attack from a non-listed origin, we want the log + dev-tools behavior to clearly say "blocked", not "allowed for the wrong origin".

### ME-02: `@sentry/react` is both statically and dynamically imported — Replay collapses into main chunk

**Files:** `src/lib/sentry.ts:1,40`, `src/main.tsx:4`
**Issue:**
Build log emits `INEFFECTIVE_DYNAMIC_IMPORT` warning:
> node_modules/@sentry/react/build/esm/index.js is dynamically imported by src/lib/sentry.ts but also statically imported by src/lib/sentry.ts, src/main.tsx, dynamic import will not move module into another chunk.

Consequence: `replayIntegration` (~40 KB) ends up in the main bundle for every user, not code-split behind the opt-out gate. Runtime guard in `loadSentryReplayIfConsented()` still correctly prevents `replayIntegration()` from being *called* for opt-out users, but the **code** is shipped to them. Main chunk is 593.98 KB (191.11 KB gz) — still under the 400 KB gzipped budget mentioned in the M3 comment, so not a failing KPI, but the M3 goal (code-split Replay) is unmet.

`sentry.ts`:14-16 explicitly acknowledges this tradeoff:
> "The gzipped main-JS budget is held under the plan's 400 KB threshold."

**Fix (if bundle budget ever tightens):** Use a thin wrapper module that re-exports only `replayIntegration` and never import it statically elsewhere:
```ts
// src/lib/sentry-replay.ts  (NEW)
export { replayIntegration } from '@sentry/react'

// src/lib/sentry.ts
const { replayIntegration } = await import('./sentry-replay')
```
Because `sentry-replay.ts` is **only** dynamically imported, Rolldown will put it in its own chunk and tree-shake it out of the main bundle when no consent is given.

**Rationale:** The comment claims runtime code-split but bundler output disproves it. Either strip the stale claim or actually code-split via a lazy wrapper module. Non-blocking because the bundle still fits.

---

## Low

### LO-01: `supabase status --output json` key fallback order is fragile

**File:** `.github/workflows/ci.yml:80-87`
**Issue:**
```bash
ANON_KEY=$(echo "$STATUS" | jq -r '.API.ANON_KEY // .ANON_KEY // empty')
```
Supports two CLI shapes (`.API.*` and flat `.*`). Older/newer shapes are not handled. If neither exists, `empty` → `-z "$ANON_KEY"` → job fails loudly (lines 88-94), which is correct behavior — but the failure mode is vague: "Failed to derive one or more values from supabase status" with no dump of the raw JSON. Debugging a Supabase CLI upgrade break would be painful.

**Fix:** on failure, log the raw JSON (masked):
```bash
if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ] || [ -z "$DB_URL" ]; then
  echo "Failed to derive keys; raw status output:"
  echo "$STATUS" | jq 'keys' || echo "$STATUS"
  ...
fi
```
Log only the top-level keys so we don't leak the actual key material.

### LO-02: `loginAs` rewrites `localStorage` via `addInitScript` — prior session persists in tab memory

**File:** `e2e/helpers/auth.ts:82-87`, usage in `admin-create.spec.ts:43`
**Issue:**
`page.addInitScript` runs on every new page-context (i.e. every `page.goto` AFTER it was called). In `admin-create.spec.ts` the test calls `loginAs(page, adminUser.id)`, navigates/interacts, then calls `loginAs(page, memberUser.id)` and navigates to `/topics`. The second `loginAs` adds ANOTHER init script (page has two stacked scripts). Both fire on `page.goto('/topics')` in insertion order, so the last-written localStorage wins — correct outcome. But any in-flight state in the already-running app (React state, Supabase client cache) from the admin session persists until the next navigation completes. The explicit `await page.goto('/topics')` on line 44 forces navigation, so the final app instance sees member creds. Ok in practice, but fragile against future tests that DO NOT re-navigate after context switch.

**Fix (hardening, not bug):** have `loginAs` clear existing init scripts before re-adding:
```ts
await page.context().clearCookies()  // optional
await page.evaluate(() => window.localStorage.clear())  // if page already loaded
await page.addInitScript(...)
```

### LO-03: `loginAs` race — if awaited `signInWithPassword` and `addInitScript` are interleaved with `page.goto`

**File:** `e2e/helpers/auth.ts:82-87`
**Issue:**
The helper does `await client.auth.signInWithPassword(...)` then `await page.addInitScript(...)`. If a test calls `page.goto()` in parallel (it doesn't today, but could), the init script might not be registered before navigation. Standard Playwright idiom. Spec is that callers always await `loginAs` before `page.goto`, and all four specs do. Fine in current code.

**Fix:** Document in JSDoc that `loginAs` must be awaited before any `page.goto()` or `page.navigate()`. No code change needed.

---

## Advisory

### AD-01: `admin-create.spec.ts` — broad button matcher could select the wrong submit

**File:** `e2e/tests/admin-create.spec.ts:35`
```ts
await page.getByRole('button', { name: /create|publish|submit/i }).last().click()
```
Matches any button containing "create", "publish", or "submit". On `/admin/suggestions/new` the form likely has a Cancel / Back button, maybe "Create choice" action buttons for each choice row, etc. `.last()` picks the last in DOM order, which should be the primary submit (conventionally), but is not guaranteed.

**Suggestion:** Tighten with a data-testid on the submit button (mirroring what you did for the list-screen Create button) — `data-testid="suggestion-form-submit"` — and use that directly.

### AD-02: CORS `Vary` header does not include request-method

**File:** `supabase/functions/_shared/cors.ts:14`
`Vary: Origin` is set. For preflight responses, also setting `Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers` prevents aggressive CDN caches from caching a preflight response tied to a different request shape. Supabase EF gateway likely doesn't cache preflights, but safe to be explicit.

### AD-03: `sentry.ts` M3 comment drifts from actual behavior

**File:** `src/lib/sentry.ts:8-16`
The comment says "the M3 practical guarantee still holds: replayIntegration is tree-shaken from the bundle unless this function is actually reached". Build shows otherwise (see ME-02). Either fix the bundle (ME-02 fix) or soften the comment to "runtime gate prevents Replay execution; bundle code may still ship".

### AD-04: `netlify.toml` Node version as string not numeric

**File:** `netlify.toml:13`
```toml
NODE_VERSION = "22"
```
Netlify resolves this to latest 22.x. For maximum reproducibility, pin to an exact Node version like `"22.11.0"`. Not critical — node 22.x LTS is stable — but future Node patches could introduce breaking V8 behavior.

---

## Priority Checks — Result Summary

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | CORS allowlist correctness / ALLOWED_ORIGIN escape hatch | PASS with ME-01 caveat | `cors.ts:9` — attacker origin gets echoed to `ALLOWED_ORIGINS[0]`, browsers still block |
| 2 | No `VITE_SENTRY_AUTH_TOKEN` leak | PASS | Only `process.env.SENTRY_AUTH_TOKEN` in `vite.config.ts:27`, no `VITE_` prefix anywhere in src/ or netlify.toml |
| 3 | PostHog PII: `identify(provider_id)` only | PASS | `AuthContext.tsx:114-117` reads `user_metadata.provider_id` only; no email/username/avatar passed. `posthog.reset()` at line 138 fires BEFORE `supabase.auth.signOut()` at line 139 |
| 4 | Replay lazy-load (M1) | PASS (runtime) | `sentry.ts:30-47` — reads `analytics_opted_out` at line 36 BEFORE dynamic import at line 40. Not included in `Sentry.init` integrations (`main.tsx:28` has only `browserTracingIntegration`) |
| 5 | Sentry Vite plugin LAST in plugins array | PASS | `vite.config.ts:17-30` — order is `tanstackRouter → react → tailwindcss → sentryVitePlugin`. `disable: mode !== 'production'` uses Vite `mode` param (correct fix vs `process.env.NODE_ENV`) |
| 6 | `preload="intent"` gate — Topics/Archive yes, Admin no; no `defaultPreload` | PASS | `Navbar.tsx:40,47` + `MobileNav.tsx:37,46` have preload=intent. Admin links (`Navbar.tsx:56`, `MobileNav.tsx:58`) omit preload. `grep -rn 'defaultPreload' src/` → 0 matches |
| 7 | Playwright auth: `signInWithPassword` + `addInitScript`, no magicLink, no service-role in `loginAs` | PASS | `auth.ts:63` uses `signInWithPassword`; `auth.ts:82` uses `addInitScript`; `grep 'SERVICE_ROLE' e2e/` → 0 matches in helper (only in CI job env for future use) |
| 8 | Cron dual-header auth | PASS | `cron-sweep.yml:35-36` sends both `X-Cron-Secret` and `Authorization: Bearer SUPABASE_ANON_KEY` |
| 9 | No `npm install` in CI | PASS | `grep -rn 'npm install' .github/workflows/` → 0 matches. Only `npm ci` used (ci.yml:32,50) |
| 10 | EF esm.sh three-digit pins | PASS | 18 imports, all three-digit pinned: `@supabase/supabase-js@2.101.1`, `@upstash/ratelimit@2.0.5`, `@upstash/redis@1.34.6`. 0 bare-major matches |
| 11 | Cross-file / import-graph analysis | 1 FINDING | HI-01: ConsentChip/Router context boundary violation. No circular imports detected. `src/lib/sentry.ts ↔ src/components/ConsentChip.tsx` dependency is linear (ConsentChip imports lazy-loader; loader is self-contained) |
| 12 | `netlify.toml` shell injection via `$COMMIT_REF` | PASS | `$COMMIT_REF` is a Netlify-supplied git SHA `[0-9a-f]+`, no shell metacharacters possible. Build command safe |
| 13 | Deno non-null assertion idioms | PASS with nit | Every `Deno.env.get('X')!` is on a required boot-time secret (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY). If unset, EF crashes loudly — correct fail-fast. Optional secrets (CLOSE_SWEEPER_SECRET in close-expired-polls) correctly check without `!` and return 503 |
| 14 | Rate limiter + Redis fail-closed | PASS | `submit-vote/index.ts:55-61` — Redis down → `ratelimit.limit()` throws → outer `catch` returns 500. Comment at line 53 documents this as "fail-closed" |
| 15 | Service-role + admin-gated coverage for all 15 EFs | PASS | 13 admin EFs call `requireAdmin(...)` from `_shared/admin-auth.ts`. `submit-vote` uses `getUser()` + `profile.guild_member` + `profile.mfa_verified`. `close-expired-polls` uses `X-Cron-Secret` shared-secret header gate. All covered |

---

## Notes on Things That Surprised Me (Positively)

1. **`admin-auth.ts` centralizes the admin gate** with explicit reason codes (`profile_not_found`, `not_admin`, `integrity_failed`, `query_failed`) and a small `adminCheckResponse()` mapper that returns 500 for transport errors and 403 for authz failures. Clean separation.
2. **`submit-vote` uses `INSERT` + `23505` UNIQUE handler** as the race-safe duplicate guard (no TOCTOU). This is the right Postgres idiom and well-commented at line 132-135.
3. **`get-upload-url` forces extension to match validated content-type** (ME-02 mitigation in Phase 4 — the hardening is still intact). SVG explicitly excluded from the allowlist.
4. **`cron-sweep.yml` validates response body with `jq -e`** (`.success == true` AND `has("swept")`) not just HTTP 200, preventing silent-failure modes.
5. **`e2e/fixtures/seed.sql` uses disjoint UUID namespace** (`d0000000-…`, `e0000000-…`) from the dev seed's namespace (`b0000000-…`, `c0000000-…`) — documented at file header. Idempotent via `ON CONFLICT DO NOTHING`. Good hygiene.
6. **`loginAs` helper throws when `VITE_SUPABASE_ANON_KEY` is missing** — fail-loud is better than a silent `undefined` → hard-to-diagnose Playwright timeout.

---

_Reviewed: 2026-04-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (cross-file import-graph analysis)_
