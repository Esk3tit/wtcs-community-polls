# Phase 5: Launch Hardening - Research

**Researched:** 2026-04-19
**Domain:** Production launch infrastructure — CI/CD, scheduled jobs, E2E testing, observability, supply-chain hardening, docs
**Confidence:** HIGH (versions/APIs verified against npm + official docs; platform behaviors cited)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-16)
- **D-01** Cron platform = **GitHub Actions scheduled workflow** (not Netlify scheduled fns, not external, not pg_cron). New `.github/workflows/` directory.
- **D-02** One daily job @ 03:00 UTC, dual-purpose: keepalive + sweep. curls `close-expired-polls` EF with `X-Cron-Secret: ${{ secrets.CLOSE_SWEEPER_SECRET }}`. Satisfies INFR-02 (7× safety vs 7-day pause).
- **D-03** Failure visibility = GitHub Actions email-on-failure. No Discord webhook v1.
- **D-04** E2E framework = **Playwright** (not Cypress, not Vitest-only).
- **D-05** OAuth bypass via **programmatic Supabase session injection using service-role key**. No real Discord click-through. _(Superseded during execution — see HIGH #2 below and `05-05-SUMMARY.md`: shipped pattern is `signInWithPassword` against the public anon key, never the service-role key. This research line is preserved as the snapshot at research time.)_
- **D-06** Tests run locally (`npm run e2e` vs `supabase start`) + in CI on every PR. No post-deploy prod smoke.
- **D-07** CI: spin full `supabase start` via Docker in GH Actions, apply migrations, seed fixtures, run against `vite preview`.
- **D-08** Critical-path smoke = 4 journeys: (1) user browse→respond→results, (2) filter+search, (3) admin create suggestion→visible publicly, (4) auth error states.
- **D-09** EF deploy = GH Actions on push-to-main, `supabase functions deploy` for all 15 EFs. Auth via `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`.
- **D-10** Netlify: push-to-main → prod, PR → preview URL. `public/_redirects` already correct.
- **D-11** DNS+OAuth cutover: default Netlify URL first → dual-register both redirect URIs in Discord → flip OVH CNAME → verify.
- **D-12** Secrets split: Netlify `VITE_*` (4 vars: SUPABASE_URL/ANON_KEY/SENTRY_DSN/POSTHOG_KEY), Supabase secrets (CLOSE_SWEEPER_SECRET, UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN, DISCORD_GUILD_ID), GitHub repo secrets (SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, CLOSE_SWEEPER_SECRET).
- **D-13** Ship Sentry (`@sentry/react`) + PostHog (`posthog-js` + `posthog-js/react`) at launch. Non-blocking consent footer chip. Discord ID only — NEVER email/username.
- **D-14** Loading skeletons (shadcn Skeleton silhouette match) + TanStack Router `preload="intent"` on top-nav Topics/Archive/Admin.
- **D-15** Full README rewrite — 13 defined sections, shields.io badges, committed screenshots in `docs/screenshots/`.
- **D-16** Dependency pinning: strip `^`/`~` from package.json, `npm ci` in CI, pin every `esm.sh` import in all 15 EFs to exact version, `npm audit --audit-level=high` non-blocking, enable Dependabot.

### Claude's Discretion
- GH Actions file structure (split vs mega-workflow — default: split into `ci.yml`, `deploy-edge-functions.yml`, `cron-sweep.yml`)
- Sentry sourcemap mechanism (Vite plugin vs CLI — recommended: `@sentry/vite-plugin`)
- PostHog event names, session-replay sampling rate, exact consent UI placement
- Playwright fixture structure, parallelism, cleanup strategy
- README screenshot capture format
- `npm audit` ignore list
- Sentry env naming (`production`/`preview`/`development`)

### Deferred Ideas (OUT OF SCOPE)
- Discord webhook on cron failure
- Post-deploy production smoke
- Real Discord test account for E2E
- PostHog feature flags
- Promoting `npm audit` to blocking
- Separate `docs/deploy.md` runbook (optional)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-02 | Keep Supabase project alive via scheduled job that executes a real DB query | GH Actions cron hits `close-expired-polls` EF → `UPDATE polls …` = real DB write. Daily runs = 7× headroom vs 7-day pause. |
| TEST-06 | E2E smoke tests cover critical path (login → browse → respond → see results) | Playwright 1.59.1 + `supabase/setup-cli@v1` + `supabase start`, OAuth bypassed via service-role-key session injection per Supabase auth-state pattern. |
</phase_requirements>

## Summary

This is a **process/platform-heavy phase** with tiny UI surface (3 small components per UI-SPEC). The real work is YAML, pinned versions, CLI orchestration, and observability plumbing. Every decision is locked; research is therefore prescriptive about versions, file paths, and exact command lines the executor can paste with minimal edits.

**Primary recommendation:** Split into 3 GH Actions workflows (`ci.yml`, `deploy-edge-functions.yml`, `cron-sweep.yml`) + `dependabot.yml`. Use `@sentry/vite-plugin` 5.2.0 for sourcemap upload (not Sentry CLI). Use `npm:@sentry/deno` in Edge Functions (deno.land/x/sentry is deprecated). For Playwright session injection, use `page.addInitScript` to write the `sb-<ref>-auth-token` key to localStorage before navigation (minted offline from the service-role key — never embed the key in test code).

**Biggest landmine:** GitHub Actions cron drift can be 15–60 min at high-load times (midnight UTC is the worst). 03:00 UTC (D-02) is a better slot. Also — **scheduled workflows auto-disable after 60 days of repo inactivity** (commits/PRs/issues — workflow runs themselves do NOT count). This matters for a low-traffic launch.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scheduled sweep / keepalive | CI (GH Actions) | Edge Function (close-expired-polls) | Cron triggers HTTP; EF owns DB mutation. Pure external caller — no in-app responsibility. |
| E2E smoke orchestration | CI (GH Actions) | Playwright runner | CI spins `supabase start` stack and invokes Playwright against `vite preview`. |
| Session injection for tests | Test harness (node globalSetup) | Browser (localStorage via addInitScript) | Service-role key mints JWT server-side; browser receives it via addInitScript — no real OAuth flow. |
| Production SPA hosting | Netlify CDN | Netlify build runner | Push-to-main → build → deploy. SPA fallback served from `public/_redirects`. |
| Edge Function deployment | CI (GH Actions) | Supabase CLI | `supabase functions deploy --project-ref ${PROJECT_REF}` — `--use-api` flag avoids Docker in CI. |
| Client error capture | Browser | Sentry SaaS | `<Sentry.ErrorBoundary>` at root + global handlers via `Sentry.init`. |
| Server error capture | Edge Function (Deno) | Sentry SaaS | `npm:@sentry/deno` + `withScope` per request (Deno.serve has no scope separation — known limitation). |
| Product analytics / session replay | Browser | PostHog SaaS | `posthog-js` + `PostHogProvider`, `identify` fired from `AuthContext`. |
| Prefetch | TanStack Router (client) | — | Declarative `preload="intent"` on `<Link>`. |
| Loading skeleton | Browser (React) | — | Pure render during `loading === true`. |
| Supply-chain defense | Build-time (npm ci + pinned esm.sh) | CI (`npm audit`) + Dependabot | Lockfile-strict install + exact pins + ongoing upgrade bot. |

## Standard Stack

### Core Launch-Hardening Dependencies (npm, verified 2026-04-19)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sentry/react` | **10.49.0** | Client error tracking + ErrorBoundary | `[VERIFIED: npm view @sentry/react]` — official SDK; v10 is current major, Vite-plugin-aware |
| `@sentry/vite-plugin` | **5.2.0** | Sourcemap upload during Vite build | `[VERIFIED: npm view @sentry/vite-plugin]` — official Sentry plugin, supersedes `sentry-cli releases` for modern Vite workflows |
| `@sentry/deno` | **10.49.0** | Edge Function error capture | `[VERIFIED: npm view @sentry/deno]` — import via `npm:@sentry/deno` in Deno. deno.land/x/sentry is deprecated `[CITED: docs.sentry.io/platforms/javascript/guides/deno/]` |
| `posthog-js` | **1.369.3** | Client analytics + session replay | `[VERIFIED: npm view posthog-js]` — stable, single source of truth for web analytics + replays |
| `posthog-js/react` | ships inside `posthog-js` | `<PostHogProvider>` + `usePostHog` hook | `[CITED: posthog.com/docs/libraries/react]` — canonical React integration |
| `@playwright/test` | **1.59.1** | E2E runner | `[VERIFIED: npm view @playwright/test]` — industry standard, TS-native, parallel, storageState caching |

### Supporting CLI / Action Dependencies

| Tool | Version | Purpose | Where |
|------|---------|---------|-------|
| `supabase` (CLI) | **2.92.1** | `supabase functions deploy`, `supabase start`, `supabase secrets set` | `[VERIFIED: npm view supabase]` — already in devDependencies (locked 2.85.0 → bump opportunity, but D-16 §1 says DON'T bump during pinning task) |
| `supabase/setup-cli@v1` | v1 (action) | Install CLI in GH runner | `[CITED: github.com/supabase/setup-cli]` |
| `actions/checkout@v4` | v4 | Repo checkout | GitHub standard |
| `actions/setup-node@v4` | v4 | Node install in CI | GitHub standard |

### Alternatives Considered
| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| `@sentry/vite-plugin` | Sentry CLI in postbuild script | Plugin integrates with Vite's rollup output map, handles auth token natively, auto-sets release. CLI is lower-level; no benefit here. |
| `npm:@sentry/deno` | `https://deno.land/x/sentry` | deno.land port is officially deprecated `[CITED: docs.sentry.io/platforms/javascript/guides/deno/]`. Use npm import. |
| Playwright | Cypress | Cypress is slower, serial in OSS tier; D-04 already locked. |
| Playwright `storageState` (json file) | `page.addInitScript` per test | storageState simpler for one fixture; addInitScript lets us mint fresh JWT per test run. Recommend `storageState` for shared auth + `addInitScript` for edge cases. |

### Installation (one-liner for executor)
```bash
npm install --save-exact @sentry/react@10.49.0 posthog-js@1.369.3
npm install --save-exact --save-dev @sentry/vite-plugin@5.2.0 @playwright/test@1.59.1
npx playwright install --with-deps chromium
```

**Version verification stance:** Recorded 2026-04-19. `package.json` currently shows `^` prefixes on everything (15 deps, 19 devDeps). D-16 §1 = strip ALL prefixes; do NOT bump. For the six libraries introduced in this phase, use `--save-exact` so no `^` lands in the first place.

## Architecture Patterns

### System Architecture — Launch-Hardened Production

```
[Developer push]
      │
      ▼
┌────────────── GitHub main branch ──────────────┐
│                                                 │
│  ┌─ workflow: ci.yml (PR)                       │
│  │   lint → tsc → vitest → supabase start →     │
│  │   vite build → vite preview → playwright     │
│  │                                               │
│  ├─ workflow: deploy-edge-functions.yml (push)  │
│  │   setup-cli → supabase functions deploy      │
│  │     --project-ref $SUPABASE_PROJECT_REF      │
│  │     --use-api (all 15 EFs)                   │
│  │                                               │
│  └─ workflow: cron-sweep.yml (schedule 03:00Z)  │
│      curl -H "X-Cron-Secret: $SECRET" \         │
│        $SUPABASE_URL/functions/v1/              │
│        close-expired-polls                      │
└─────────────┬───────────────────────────────────┘
              │ (on push to main)
              ▼
    ┌─────────────────┐      ┌───────────────────┐
    │ Netlify         │      │ Supabase          │
    │ polls.wtcsmap-  │◄────►│ (DB + Auth +      │
    │ ban.com         │ OAuth│  15 Edge Fns +    │
    │ (SPA + _redir)  │      │  Storage)         │
    └───────┬─────────┘      └────────┬──────────┘
            │                         │
            │ error/event reports     │ EF errors
            ▼                         ▼
    ┌──────────────┐          ┌──────────────┐
    │ Sentry SaaS  │          │ Sentry SaaS  │
    │ PostHog SaaS │          │ (same DSN?)  │
    └──────────────┘          └──────────────┘
            ▲
            │ session replay / event capture
            │
    [End user browser]
         │
         └─ Discord OAuth via Supabase Auth
```

### Recommended New-File Structure
```
.github/
├── workflows/
│   ├── ci.yml                      # PR: lint+test+e2e vs local supabase
│   ├── deploy-edge-functions.yml   # push-to-main: deploy all EFs
│   └── cron-sweep.yml              # schedule 03:00 UTC: hit close-expired-polls
└── dependabot.yml                  # weekly grouped npm + actions

docs/
└── screenshots/                    # README assets (PNG committed, no external hosts)

e2e/
├── playwright.config.ts
├── fixtures/
│   ├── seed.sql                    # reuses supabase/seed.sql or extends
│   └── test-users.ts               # exports {userId, adminUserId, etc.}
├── helpers/
│   └── auth.ts                     # mintSupabaseSession(userId) via service-role key
└── tests/
    ├── browse-respond.spec.ts      # D-08 #1
    ├── filter-search.spec.ts       # D-08 #2
    ├── admin-create.spec.ts        # D-08 #3
    └── auth-errors.spec.ts         # D-08 #4

netlify.toml                        # explicit build config (optional, recommended)
```

### Pattern 1: GH Actions scheduled cron (D-01, D-02)
```yaml
# .github/workflows/cron-sweep.yml
name: Daily close-expired-polls sweep
on:
  schedule:
    - cron: '0 3 * * *'   # 03:00 UTC daily — avoids midnight-UTC queue storm
  workflow_dispatch:       # enable manual trigger for debugging

concurrency:
  group: cron-sweep
  cancel-in-progress: false

jobs:
  sweep:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Invoke close-expired-polls
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          CLOSE_SWEEPER_SECRET: ${{ secrets.CLOSE_SWEEPER_SECRET }}
        run: |
          set -euo pipefail
          response=$(curl -sS -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -H "X-Cron-Secret: ${CLOSE_SWEEPER_SECRET}" \
            "${SUPABASE_URL}/functions/v1/close-expired-polls")
          http_code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')
          echo "HTTP ${http_code}: ${body}"
          if [ "${http_code}" != "200" ]; then exit 1; fi
```
`[CITED: docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions]`

**LANDMINE — cron drift:** Scheduled events can be delayed "several minutes" and dropped under GH Actions high load. Midnight UTC (`0 0 * * *`) is the worst time. 03:00 UTC (D-02) avoids the storm. `[CITED: github.com/orgs/community/discussions/156282]`

**LANDMINE — inactive-repo auto-disable:** Scheduled workflows are disabled after **60 days of repo inactivity** (commits/issues/PRs — workflow runs do NOT count). `[CITED: docs.github.com → scheduled events]` For a low-traffic launch, Dependabot weekly PRs (D-16 §5) double as "activity" to keep the cron alive. That's not accidental — it's architecturally significant.

### Pattern 2: Edge Function CI deploy (D-09)
```yaml
# .github/workflows/deploy-edge-functions.yml
name: Deploy Edge Functions
on:
  push:
    branches: [main]
    paths:
      - 'supabase/functions/**'
      - '.github/workflows/deploy-edge-functions.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: 2.92.1       # exact pin per D-16
      - name: Deploy all functions
        run: supabase functions deploy --project-ref "${SUPABASE_PROJECT_REF}" --use-api
```
`[CITED: supabase.com/docs/guides/functions/examples/github-actions]`

**Key flag:** `--use-api` is recommended for CI — no Docker needed, resolves a known race condition when deploying multiple functions in parallel. `[CITED: supabase.com/changelog + setup-cli README]`

**Without a function name arg**, the CLI deploys every function under `supabase/functions/` (all 15).

### Pattern 3: Playwright + supabase start in CI (D-07, TEST-06)
```yaml
# .github/workflows/ci.yml (relevant job)
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - uses: supabase/setup-cli@v1
        with: { version: 2.92.1 }
      - name: Start Supabase
        run: supabase start
      - name: Wait for ready
        run: |
          for i in {1..30}; do
            if supabase status | grep -q '"status":"running"' 2>/dev/null || supabase status | grep -q 'API URL'; then
              exit 0
            fi
            sleep 2
          done
          exit 1
      - name: Apply seed
        run: supabase db reset --no-seed && psql "$(supabase status | grep 'DB URL' | awk '{print $3}')" -f e2e/fixtures/seed.sql
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - name: Run E2E
        run: npx playwright test
        env:
          VITE_SUPABASE_URL: http://localhost:54321
          VITE_SUPABASE_ANON_KEY: ${{ secrets.LOCAL_ANON_KEY }}
          # Service-role key is LOCAL-ONLY — fixed default from supabase start, safe to check in
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.LOCAL_SERVICE_ROLE_KEY }}
```
`[CITED: github.com/supabase/setup-cli + supabase.com/docs/guides/local-development]`

### Pattern 4: Playwright session injection (D-05)
```typescript
// e2e/helpers/auth.ts
import { createClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0] || 'localhost'

export async function loginAs(page: Page, userId: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  // Mint a session for the fixture user using the service-role key
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: `fixture+${userId}@example.com`,
  })
  if (error) throw error
  // Extract the refresh/access tokens OR use admin.auth.admin.signInWithPassword /
  // signInAnonymously-style minting if your Supabase version supports it.
  // Simplest alternative: use admin.createUser then sign in with password via REST.

  // Write session directly into localStorage before the app loads
  await page.addInitScript(
    ({ ref, session }) => {
      window.localStorage.setItem(
        `sb-${ref}-auth-token`,
        JSON.stringify(session),
      )
    },
    { ref: PROJECT_REF, session: data.properties /* or constructed {access_token, refresh_token, expires_at, user} */ },
  )
}
```
`[CITED: mokkapps.de + bekapod.dev + playwright.dev/docs/auth]`

**Key storage key format:** `sb-<project-ref>-auth-token` holds a JSON-encoded session. For `supabase start` locally, the "ref" portion is `localhost` (or whatever `supabase status` reports). Inspect your running app's localStorage once to confirm the key shape — it's the single most common "why isn't Playwright authenticated?" failure.

### Pattern 5: Sentry `@sentry/react` init in Vite app (D-13)
```typescript
// src/main.tsx — ADD before createRoot
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,   // 'development' | 'production'
  release: import.meta.env.VITE_COMMIT_SHA,  // inject via Netlify env
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

// ... existing code ...
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppErrorFallback />} showDialog={false}>
      <PostHogProvider client={posthog}>
        <RouterProvider router={router} />
      </PostHogProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
```
`[CITED: docs.sentry.io/platforms/javascript/guides/react/]`

### Pattern 6: Sentry Vite plugin for sourcemaps
```typescript
// vite.config.ts — ADD
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    // Sentry plugin MUST be last so it sees the final bundle
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,  // set in CI + Netlify build env
      sourcemaps: { filesToDeleteAfterUpload: './dist/**/*.map' },  // strip from shipped bundle
      disable: process.env.NODE_ENV !== 'production',
    }),
  ],
  build: { sourcemap: 'hidden' },  // generate for upload, don't link in HTML
  // ... existing config ...
})
```
`[CITED: docs.sentry.io/platforms/javascript/guides/react/sourcemaps/uploading/vite/]`

**CRITICAL:** Plugin goes LAST in the plugins array. Tree-shaking can remove Sentry instrumentation if plugin order is wrong.

### Pattern 7: Sentry Deno in Edge Functions
```typescript
// supabase/functions/<name>/index.ts — header block
import * as Sentry from 'npm:@sentry/deno@10.49.0'  // D-16 §3 pin

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('SUPABASE_ENV') ?? 'production',
  defaultIntegrations: false,  // REQUIRED — Deno.serve has no scope separation
  tracesSampleRate: 0,         // EFs are short-lived; skip tracing overhead
})

Deno.serve(async (req) => {
  return await Sentry.withScope(async (scope) => {
    scope.setTag('function', 'close-expired-polls')
    try {
      // ... existing handler body ...
    } catch (err) {
      Sentry.captureException(err, scope)
      throw err  // let EF runtime log it too
    }
  })
})
```
`[CITED: docs.sentry.io/platforms/javascript/guides/deno/ + issue #15229]`

**LANDMINE:** Sentry Deno SDK does NOT support `Deno.serve` instrumentation natively. You MUST `defaultIntegrations: false` and wrap every request in `withScope` — otherwise breadcrumbs/tags leak across concurrent requests. This is on the Sentry issue tracker as a known limitation, not a bug. `[CITED: github.com/getsentry/sentry-javascript/issues/15229]`

### Pattern 8: PostHog init + identify (D-13)
```typescript
// src/lib/posthog.ts
import posthog from 'posthog-js'

let initialized = false
export function initPostHog() {
  if (initialized || typeof window === 'undefined') return posthog
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) return posthog
  posthog.init(key, {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',  // don't create anon profiles
    capture_pageview: 'history_change',
    session_recording: { maskAllInputs: true },
    autocapture: false,  // explicit event model per D-13
  })
  initialized = true
  return posthog
}

// src/main.tsx
import { PostHogProvider } from 'posthog-js/react'
const ph = initPostHog()
// wrap: <PostHogProvider client={ph}>...

// src/contexts/AuthContext.tsx — inside the onAuthStateChange SIGNED_IN branch
import posthog from 'posthog-js'
if (newSession?.user && newSession.user.user_metadata?.provider_id) {
  // provider_id is the Discord snowflake — SAFE. NEVER use email/username.
  posthog.identify(newSession.user.user_metadata.provider_id, {
    // NO email, NO username, NO discriminator
  })
}
// On signOut:
posthog.reset()
```
`[CITED: posthog.com/docs/libraries/react + posthog.com/docs/libraries/js/config]`

**LANDMINE — StrictMode double-init:** `useEffect` fires twice in StrictMode dev. PostHog tolerates re-calls but wastes setup. The `initialized` module-scope guard above prevents it. `[CITED: posthog.com/docs/libraries/react — mentions "initialization handled automatically when you use the PostHogProvider and hook"]` — but the guard is still prudent because we init before Provider mount.

**Consent (UI-SPEC Contract 3):**
```typescript
// On opt-out click:
posthog.opt_out_capturing()
localStorage.setItem('posthog_consent_chip_dismissed', 'true')
// On opt-in (restore):
posthog.opt_in_capturing()
```
`[CITED: posthog.com/docs/privacy/data-collection]`

### Pattern 9: TanStack Router `preload="intent"` (D-14)
```tsx
// Top nav Link components
import { Link } from '@tanstack/react-router'

<Link to="/topics" preload="intent">Topics</Link>
<Link to="/archive" preload="intent">Archive</Link>
<Link to="/admin" preload="intent">Admin</Link>
```
Router config (optional — set app-wide default instead of per-Link):
```typescript
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',           // apply to every Link by default
  defaultPreloadDelay: 50,            // ms before preload fires on hover — docs default is 50
  defaultPreloadStaleTime: 30_000,    // loader data considered fresh for 30s
})
```
`[CITED: tanstack.com/router/latest/docs/guide/preloading]`

**LANDMINE — loader side effects:** `preload="intent"` triggers the route's `beforeLoad` handler on hover. If `beforeLoad` does redirects/navigations (e.g. auth gate that redirects unauth users), those fire on hover. `[CITED: github.com/TanStack/router/issues/1382]` Audit `beforeLoad` on `/admin` (admin-gated) before enabling intent preload there. If it redirects non-admins, either remove `preload="intent"` from the admin Link OR make the gate render a 403 instead of redirecting.

**LANDMINE — preload + state reset:** Older report (`^1.0.5`) of preload causing full-page state reset. We're on 1.168.10 — likely resolved, but keep as a smoke-test checkbox. `[CITED: github.com/TanStack/router/issues/1162]`

### Pattern 10: Dependabot config (D-16 §5)
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
    groups:
      minor-and-patch:
        update-types: [minor, patch]
    open-pull-requests-limit: 5
    labels: [dependencies, automated]

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
      day: monday
    groups:
      actions:
        patterns: ['*']
    open-pull-requests-limit: 3
    labels: [dependencies, ci]
```
`[CITED: docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuring-dependabot-version-updates]`

Dependabot does NOT scan `esm.sh` imports — those are unmanaged strings. D-16 §3 pins them manually; upgrades are manual. README §12 (D-15) documents the ritual.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error boundary | Custom `componentDidCatch` wrapper | `Sentry.ErrorBoundary` from `@sentry/react` | Auto-captures to Sentry; handles reset-on-route-change; fallback-prop API |
| Session replay | rrweb direct | `posthog-js` replay integration | PostHog tunnels replay events through same pipeline; one DSN |
| Dep scanning | `npm audit` in a cron | Dependabot + `npm audit --audit-level=high` in CI | GitHub-native, free, PRs auto-open |
| Supabase session in Playwright | Click-through real Discord OAuth | `page.addInitScript` with service-role-minted JWT | D-05 already locked; Discord flags automated logins |
| Sourcemap upload | `sentry-cli releases files upload-sourcemaps` in postbuild | `@sentry/vite-plugin` | Plugin reads rollup manifest, auto-tags release, can delete local maps |
| Cron retry | Shell loop in workflow | Let GH Actions retry via workflow_dispatch / next-day run | Retries complicate "did it run?" alerting — D-03 is simple email |
| Startup wait for Supabase | `sleep 30` | Poll `supabase status` until "API URL" appears | Deterministic; sleep flakes in CI |

**Key insight:** Every item above has an off-the-shelf solution already in the repo's chosen ecosystem. The phase's value is wiring them together correctly, not inventing.

## Runtime State Inventory

> Rename/refactor section. Phase 5 is **mostly** greenfield (new workflows + new libraries). Two rename-like surfaces exist:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None found. `close-expired-polls` mutates `polls.status` — that's intended sweep behavior, not a rename. | None |
| Live service config | **Discord OAuth redirect URIs** must be dual-registered before CNAME flip (D-11). Supabase Discord provider config stays unchanged. | Manual — portal steps per D-11 |
| OS-registered state | None (no Windows Tasks / launchd / systemd in scope). | None |
| Secrets/env vars | **New keys added:** `CLOSE_SWEEPER_SECRET` (already planted in EF, just needs provisioning), `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`. **No renames.** | Update `.env.example`; document in README §9 |
| Build artifacts | `dist/` will now contain `.map` files during build, uploaded by Sentry plugin, deleted post-upload via `filesToDeleteAfterUpload`. Netlify build cache must NOT keep stale maps. | `netlify.toml` can set `command = "npm ci && npm run build"` to be explicit |

**Nothing found in category (explicit):** No database schema changes this phase. No table renames. No RPC renames. No RLS policy changes.

## Common Pitfalls

### Pitfall 1: GitHub Actions cron silent drop
**What goes wrong:** Schedule fires 15–60 min late, or not at all during high-load windows.
**Why it happens:** GitHub queues schedules globally; under load, some get dropped. `[CITED: github.com/orgs/community/discussions/156282]`
**How to avoid:** (a) Run at 03:00 UTC, not 00:00 (D-02 already does this). (b) Don't depend on exact timing — the sweep is idempotent. (c) Monitor via Actions tab weekly during launch month (D-03).
**Warning signs:** Supabase "paused" email from platform = cron has been missing ≥ 7 days.

### Pitfall 2: Scheduled workflow auto-disabled after 60 days inactivity
**What goes wrong:** Cron stops running silently. Email sent but easy to miss.
**Why it happens:** GitHub policy: scheduled workflows disable on repos with no commits/issues/PRs for 60 days. Workflow runs themselves don't count.
**How to avoid:** Dependabot weekly PRs (D-16 §5) produce commits → resets the 60-day clock automatically. This is not coincidental; it's a meaningful architectural reason Dependabot belongs in this phase.
**Warning signs:** "Disabled scheduled workflows" email from GitHub; Supabase dashboard warns of impending pause.

### Pitfall 3: Sentry Vite plugin strips or fails to upload sourcemaps
**What goes wrong:** Stack traces in Sentry show minified identifiers.
**Why it happens:** Plugin placement wrong (not last), or `build.sourcemap: false`, or `SENTRY_AUTH_TOKEN` missing in Netlify build env.
**How to avoid:** Plugin LAST in plugins array. `build.sourcemap: 'hidden'`. Confirm Netlify has `SENTRY_AUTH_TOKEN` in site env (not a VITE_ prefix — this is build-time only).
**Warning signs:** First Sentry error in production still shows `a.b.c.d` instead of real names.

### Pitfall 4: Sentry Deno — breadcrumbs leak across requests
**What goes wrong:** Error in user A's request shows user B's breadcrumbs.
**Why it happens:** `Deno.serve` has no scope separation; Sentry Deno SDK global scope is shared. `[CITED: github.com/getsentry/sentry-javascript/issues/15229]`
**How to avoid:** `defaultIntegrations: false` + `Sentry.withScope(cb)` wrapper per request. Pattern 7 above shows correct form.
**Warning signs:** PII from one user showing in a different user's error report.

### Pitfall 5: PostHog double-init in StrictMode
**What goes wrong:** Two `init()` calls, occasional duplicate events.
**Why it happens:** React 19 StrictMode double-invokes effects in dev.
**How to avoid:** Module-scope `initialized` guard (Pattern 8) + init in a helper called before Provider mount, not inside `useEffect`.
**Warning signs:** "PostHog initialized twice" console warning.

### Pitfall 6: TanStack Router preload triggers beforeLoad redirect on hover
**What goes wrong:** Hovering `/admin` link redirects non-admins.
**Why it happens:** `preload="intent"` runs `beforeLoad` at hover time; if that handler redirects, so does the hover. `[CITED: github.com/TanStack/router/issues/1382]`
**How to avoid:** Option A — admin link gets NO `preload="intent"` (recommended for v1). Option B — `beforeLoad` throws `redirect(...)` only on actual nav, not during preload; check `options.preload` flag inside beforeLoad.
**Warning signs:** Hovering Admin link in top nav bounces non-admins off the current page.

### Pitfall 7: Playwright auth storage key mismatch
**What goes wrong:** Tests run but app shows logged-out state.
**Why it happens:** `sb-<project-ref>-auth-token` key in localStorage uses the project ref string; local `supabase start` uses literal `localhost` or a fixed ref. Test sets `sb-prod-auth-token`, app reads `sb-localhost-auth-token`. Mismatch.
**How to avoid:** Read the key name from the running app manually once (DevTools → Application → Local Storage). Document the exact key in `e2e/helpers/auth.ts` comments.
**Warning signs:** Every E2E test fails with "redirected to login".

### Pitfall 8: esm.sh "pinned" but still flexible
**What goes wrong:** `https://esm.sh/@supabase/supabase-js@2.101.1` may still fetch updated deps transitively because esm.sh rewrites dependencies server-side.
**Why it happens:** esm.sh is a rewriter, not a lockfile. Even with exact version pin on the top-level, transitive resolutions happen at request time. `[CITED: supabase.com/docs/guides/functions/dependencies]`
**How to avoid:** Pin to exact version (D-16 §3) AND consider `esm.sh/v135/...` immutable build prefix for belt-and-suspenders. Alternative (stronger): migrate EF imports to `npm:` specifiers (supported in modern Deno) + a `deno.json` per function with an importmap. For v1, the exact-version pin is acceptable; note in README §12 that esm.sh is a trust anchor.
**Warning signs:** Mysterious behavior changes in EFs without a code change.

### Pitfall 9: `supabase functions deploy` Docker race in CI
**What goes wrong:** Some of the 15 EFs deploy, others fail with Docker errors.
**Why it happens:** Default deploy uses Docker to bundle; parallel invocations race on Docker socket.
**How to avoid:** Use `--use-api` flag (Pattern 2). Skips Docker entirely for the bundling step. `[CITED: supabase.com/changelog]`
**Warning signs:** "Error response from daemon" in CI logs.

### Pitfall 10: Netlify cert provisioning stalls
**What goes wrong:** After CNAME flip, `https://polls.wtcsmapban.com` serves a cert error for hours.
**Why it happens:** Let's Encrypt HTTP-01 challenge can stall if DNS hasn't fully propagated or if Netlify's verification runs before the CNAME is live.
**How to avoid:** D-11 sequence (verify Netlify default URL first, then dual-register Discord, then CNAME flip) minimizes this. If stall happens, Netlify dashboard has a "Renew certificate" action that re-triggers the provisioning. `[CITED: docs.netlify.com/manage/domains/secure-domains-with-https/]`
**Warning signs:** Netlify dashboard shows "Provisioning certificate" for > 2 hours.

## Code Examples

All primary patterns are inlined in Architecture Patterns §§1–10 above. No need to duplicate here.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sentry CLI in postbuild | `@sentry/vite-plugin` | Sentry v7+ (2023); current v5.2.0 | One plugin vs three CLI commands |
| `deno.land/x/sentry` import | `npm:@sentry/deno` | Sentry Deno SDK docs deprecation (2025) | Better types, same codebase as Node SDK |
| Supabase CLI Docker bundling for EF deploy | `--use-api` flag | Supabase CLI v1.x → v2 era | No Docker in CI; faster; no race condition |
| Cypress for E2E | Playwright | Ecosystem shift 2023–2024 | Parallel, TS native, browser diversity |
| `npm install` in CI | `npm ci` | Long-standing — lockfile-strict | Reproducible installs, fails on drift |

**Deprecated/outdated:**
- `deno.land/x/sentry` — use `npm:@sentry/deno` instead.
- `tsc -b && vite build` sourcemaps without a plugin — hand-uploading is brittle.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase's 7-day free-tier pause threshold is active (repeated from Phase 4 CONTEXT/D-02) | Pattern 1 rationale | `[ASSUMED]` — should verify against current Supabase free-tier docs before launch. If threshold changed, D-02 cadence may be overkill or under-kill. |
| A2 | Running Dependabot weekly produces sufficient repo activity to reset the 60-day scheduled-workflow clock | Pitfall 2 | `[ASSUMED]` — GitHub docs confirm commits reset the clock; Dependabot PRs are commits. HIGH confidence but not tested. |
| A3 | `supabase start` in GH Actions consistently completes in < 2 min with the existing `supabase/config.toml` | Pattern 3 | `[ASSUMED]` — first CI run will confirm. Plan for flakiness; retry-on-setup is reasonable. |
| A4 | Sentry free tier (5K errors/mo) + PostHog free tier (1M events + 5K replays/mo) suffice for v1 traffic | — | `[CITED: blog.sentry.io + posthog.com/pricing]` but traffic estimate unknown. Low-risk assumption for a WTCS community-scale app. |
| A5 | The "provider_id" field on Supabase user metadata from Discord OAuth contains the Discord snowflake ID | Pattern 8 | `[ASSUMED]` — standard Supabase Discord OAuth behavior. Executor should `console.log(user.user_metadata)` once to confirm key name before shipping the `identify()` call. If wrong, fallback is `user.id` (Supabase UUID), which is safe but loses cross-session user merging. |

## Open Questions

1. **Sentry + PostHog consent: should EU users see an additional banner?**
   - What we know: UI-SPEC Contract 3 specifies non-blocking footer chip.
   - What's unclear: Whether WTCS has EU users and whether GDPR requires opt-in (vs the UI-SPEC's opt-out model).
   - Recommendation: Ship opt-out model per UI-SPEC; note in DEFERRED for post-launch review if EU traffic materializes.

2. **Should `CLOSE_SWEEPER_SECRET` rotate on a schedule?**
   - What we know: Current plan is set-once via `supabase secrets set` and mirror to GH repo secrets.
   - What's unclear: Rotation cadence. If leaked, rotate procedure is `supabase secrets set` + update GH secret — not automated.
   - Recommendation: No rotation for v1. Document in README §12 how to rotate if needed.

3. **Sentry release tagging: git SHA from Netlify build env vs Sentry plugin auto-detection?**
   - What we know: `@sentry/vite-plugin` can auto-detect git commit.
   - What's unclear: Netlify passes `COMMIT_REF` env var during build. Which takes precedence?
   - Recommendation: Executor verifies by setting `release` explicitly in `Sentry.init` from `import.meta.env.VITE_COMMIT_SHA` if plugin detection is unreliable. Not a launch blocker.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All builds | ✓ | >= 20 assumed (Vite 8 req) | None — hard requirement |
| npm | All installs | ✓ | bundled with Node | — |
| Docker | `supabase start` (CI + local) | Available on ubuntu-latest runner | — | None — hard requirement for CI job |
| Supabase CLI | Deploy + start + secrets | In devDeps as 2.85.0, latest 2.92.1 | Pin to 2.92.1 per D-16 | None |
| curl | cron-sweep workflow | Pre-installed on runner | — | — |
| GitHub Actions scheduled workflows | D-01 cron | ✓ (free tier) | — | Netlify scheduled fns (deferred per D-01) |
| Sentry account + project | D-13 | To be created (manual) | — | Without: error visibility via browser console only |
| PostHog account + project | D-13 | To be created (manual) | — | Without: no analytics; launch not blocked |
| Netlify site | D-10 | To be linked (manual) | — | — |
| OVH DNS access | D-11 CNAME flip | Assumed available | — | — |
| Discord developer portal access | D-11 redirect URIs | Assumed available | — | — |

**Missing dependencies with no fallback:** Docker in CI (standard on ubuntu-latest — not actually missing).

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework (Nyquist validation — D-16, D-09, D-02, TEST-06)

| Property | Value |
|----------|-------|
| Unit framework | Vitest 4.1.2 (existing) |
| E2E framework | `@playwright/test` 1.59.1 (new) |
| Config files | `vitest.config.ts` (exists in `vite.config.ts`), `e2e/playwright.config.ts` (new — Wave 0) |
| Quick run command | `npm test` (unit) + `npx playwright test --grep @smoke` (fast E2E subset) |
| Full suite command | `npm test && npx playwright test` |
| Phase gate | Full suite green in CI before merge; manual production smoke after deploy (curl health check + Netlify URL load) |

### Per-Decision Falsifiable Proof (seeds Nyquist Dimension 8)

| Decision | Falsifiable proof that it shipped | Detection command / surface |
|----------|------------------------------------|-----------------------------|
| D-01 | `.github/workflows/cron-sweep.yml` exists AND Actions tab shows at least one green run tagged `schedule` | `gh workflow view cron-sweep.yml` shows recent run |
| D-02 | After 1+ daily run, `polls` table has `closed_at` timestamps within last 24h for any polls whose `closes_at` has passed | `select id, status, closed_at from polls where status='closed' order by closed_at desc limit 5` in Supabase SQL editor |
| D-03 | `.github/workflows/cron-sweep.yml` has no `continue-on-error`; default GH email-on-failure is active (this is on by default for repo owners) | Force-fail once (bad secret) in a test branch → confirm email receipt |
| D-04–D-07 | `e2e/playwright.config.ts` exists; CI `ci.yml` job `e2e` runs green | `gh run list --workflow=ci.yml --status=success` shows green runs |
| D-08 | Four spec files exist in `e2e/tests/` and each has at least one `@smoke` test | `ls e2e/tests/` + `grep -l '@smoke' e2e/tests/*.spec.ts` |
| D-09 | `.github/workflows/deploy-edge-functions.yml` exists; Supabase dashboard Functions tab lists all 15 functions with "deployed at" timestamps after this phase commit | Supabase dashboard screen; also `supabase functions list --project-ref=…` |
| D-10 | `https://polls.wtcsmapban.com` returns 200 HTML; preview URL `https://<branch>--<site>.netlify.app` works for a test branch | `curl -I https://polls.wtcsmapban.com` |
| D-11 | Discord OAuth flow from `https://polls.wtcsmapban.com` successfully logs in a test user | Manual E2E on prod after cutover |
| D-12 | Running `supabase secrets list --project-ref=…` shows CLOSE_SWEEPER_SECRET, UPSTASH_*, DISCORD_GUILD_ID; Netlify site env shows 4 VITE_* keys; GH repo secrets page shows the 5 expected keys (SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, CLOSE_SWEEPER_SECRET, **SUPABASE_URL**, **SUPABASE_ANON_KEY** — last two added during 05-07 cron-sweep wiring; see CONTEXT.md D-12 footnote) | Multi-dashboard check; also `.env.example` diff shows all keys documented |
| D-13 (Sentry) | `Sentry.init` visible in `src/main.tsx`; build upload log shows "N sourcemaps uploaded"; Sentry dashboard shows at least one test exception from production URL within 10 min of deploy | Sentry issues feed; `grep -r 'Sentry.init' src/` |
| D-13 (PostHog) | `posthog.init` runs on production load; PostHog dashboard shows at least one session within 10 min; identify event carries a Discord snowflake, NOT email/username | PostHog events feed — filter by production host |
| D-13 (consent) | Fresh-session visitor sees the chip; clicking Opt out disables subsequent captures (verify: PostHog dashboard event count for that session_id stops incrementing) | DevTools + PostHog sessions feed |
| D-14 (skeleton) | Hard-refresh `/topics` on throttled 3G in DevTools shows 3-row skeleton before real cards render | Manual DevTools throttling |
| D-14 (prefetch) | Hover over Topics → Archive link; DevTools Network tab shows loader requests fire within 50ms of hover, before click | DevTools Network |
| D-15 | `README.md` contains sections 1–13 per D-15 list; `docs/screenshots/` has at least 4 committed PNGs; shields.io badges render on GitHub preview | `ls docs/screenshots/`; visual inspection of GitHub repo page |
| D-16 §1 | `grep -E '"[\^~]' package.json` returns NOTHING (excluding `"typescript": "~6.0.2"` — `~` is acceptable if explicitly kept for TS minor-only policy; discuss with executor) | `grep -E '\^' package.json` |
| D-16 §2 | All GH workflows use `npm ci`, not `npm install` | `grep -l 'npm install' .github/workflows/` returns empty |
| D-16 §3 | `grep -r 'esm.sh/@[^@]*@[0-9]' supabase/functions/` shows every import pinned to `@X.Y.Z` (three-digit exact version), no `@2` or `@2.101` | `grep -rE 'esm\.sh/[^@]+@\d+$' supabase/functions/` returns empty |
| D-16 §4 | CI log shows `npm audit --audit-level=high` output; job doesn't fail on warnings | `gh run view` log search |
| D-16 §5 | `.github/dependabot.yml` exists; within 1 week of merge, first Dependabot PR appears | Dependabot activity tab |

### Sampling Rate

- **Per task commit:** `npm test -- --run && npm run lint` (unit + lint, < 30s)
- **Per PR:** Full CI (unit + Playwright smoke subset, ~3–5 min)
- **Per wave merge:** Full Playwright suite + manual prod smoke (curl + login)
- **Phase gate:** Everything green + D-11 live on `polls.wtcsmapban.com` + Sentry/PostHog test events visible

### Wave 0 Gaps

- [ ] `e2e/playwright.config.ts` — create with storageState auth fixture
- [ ] `e2e/helpers/auth.ts` — `loginAs(page, userId)` helper (Pattern 4)
- [ ] `e2e/fixtures/seed.sql` (or reuse/extend `supabase/seed.sql`) — fixture users, categories, suggestions
- [ ] `e2e/tests/*.spec.ts` — four smoke specs per D-08
- [ ] `src/lib/posthog.ts` — init helper + consent helpers
- [ ] `src/components/AppErrorFallback.tsx` — Sentry ErrorBoundary fallback per UI-SPEC Contract 2
- [ ] `src/components/ConsentChip.tsx` — PostHog consent chip per UI-SPEC Contract 3
- [ ] Install commands: `npm install --save-exact @sentry/react@10.49.0 posthog-js@1.369.3`; `npm install --save-exact --save-dev @sentry/vite-plugin@5.2.0 @playwright/test@1.59.1`; `npx playwright install --with-deps chromium`

## Security Domain

### Applicable ASVS Categories

| ASVS | Applies | Standard Control |
|------|---------|------------------|
| V1 Architecture | yes | Documented layered boundaries (Map §1); SPA ↔ EF ↔ DB separation preserved |
| V2 Authentication | yes | Discord OAuth via Supabase; 2FA + guild checks already enforced (Phase 1). This phase adds: Playwright session injection uses service-role LOCALLY only — never in prod |
| V3 Session Management | yes | Supabase session JWT in `localStorage`. Phase 5 touches via Playwright helper only |
| V4 Access Control | yes | `X-Cron-Secret` header auth on `close-expired-polls` — constant-time compare? Currently `===` string compare (timing attack surface is low but noted) |
| V5 Input Validation | partial | EFs already validate; Phase 5 adds no new user input surfaces |
| V6 Cryptography | yes | Sentry/PostHog ingest keys are public client-side (expected — scoped per project); SENTRY_AUTH_TOKEN is build-time secret and MUST NOT be exposed client |
| V7 Error Handling | yes | Sentry ErrorBoundary fallback must NOT render stack traces to users (UI-SPEC copy confirms — shows generic text only) |
| V10 Supply Chain | yes | D-16 pinning + Dependabot + `npm audit` is the ENTIRE point of that decision |
| V14 Configuration | yes | D-12 secret split documents scope boundaries; `.env.example` is the contract |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Leaked `SENTRY_AUTH_TOKEN` in client bundle | Information Disclosure | Don't use `VITE_` prefix; keep as Netlify build env; `filesToDeleteAfterUpload` removes `.map` files from the shipped bundle |
| Cron secret in plaintext in workflow logs | Information Disclosure | `${{ secrets.* }}` references are auto-masked in GH logs; don't echo the header value |
| esm.sh supplier compromise | Supply Chain (Tampering) | D-16 §3 exact version pin reduces window; consider `esm.sh/v135/...` immutable build prefix for stronger guarantee |
| PostHog PII leak via identify | Information Disclosure | ONLY pass Discord snowflake (`provider_id`), never email/username/discriminator — Pattern 8 shows correct form |
| Sentry PII leak in error events | Information Disclosure | `beforeSend` hook can scrub email/tokens; `sendDefaultPii: false` (default in v8+) |
| Service-role key in test code → committed | Information Disclosure | `SUPABASE_SERVICE_ROLE_KEY` in CI secrets only; local fixture uses `supabase status` output (ephemeral key, not sensitive) |
| Discord OAuth redirect hijack during cutover | Tampering | D-11 dual-registration; remove Netlify default URL from Discord portal AFTER cutover stabilizes (1-week grace) |

## Project Constraints (from CLAUDE.md)

- $0/month budget — free tiers only (Sentry free, PostHog free, Netlify free, Supabase free, Upstash free, GH Actions free). All verified as sufficient.
- Tech stack locked — Vite + React 19 + TanStack Router + shadcn + Tailwind v4 + Supabase + Netlify + Upstash. Phase 5 additions (Sentry, PostHog, Playwright, Dependabot, GH Actions) layer cleanly; no conflict.
- GSD workflow enforcement — Phase 5 execution MUST go through `/gsd-execute-phase` (or `/gsd-quick` for micro-fixes). This research doc is consumed by `/gsd-plan-phase`.
- Naming: PascalCase components, camelCase hooks, kebab-case CSS tokens. Phase 5's new components (`AppErrorFallback`, `ConsentChip`, `SuggestionSkeleton` upgrade) follow this.
- ESLint `--max-warnings 0` — Sentry/PostHog type imports must be `import type {}` per `verbatimModuleSyntax: true` setting.

## Sources

### Primary (HIGH confidence)
- npm registry (versions verified 2026-04-19): `@sentry/react@10.49.0`, `@sentry/deno@10.49.0`, `@sentry/vite-plugin@5.2.0`, `posthog-js@1.369.3`, `@playwright/test@1.59.1`, `supabase@2.92.1`
- [Sentry Vite sourcemap docs](https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/uploading/vite/)
- [Sentry Deno SDK docs](https://docs.sentry.io/platforms/javascript/guides/deno/)
- [Supabase GH Actions example](https://supabase.com/docs/guides/functions/examples/github-actions)
- [Supabase setup-cli GitHub Action](https://github.com/supabase/setup-cli)
- [PostHog React docs](https://posthog.com/docs/libraries/react)
- [PostHog data collection / opt-out docs](https://posthog.com/docs/privacy/data-collection)
- [TanStack Router preloading docs](https://tanstack.com/router/latest/docs/guide/preloading)
- [GitHub Actions workflow-syntax docs](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Dependabot configuration reference](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuring-dependabot-version-updates)
- [Netlify HTTPS/SSL docs](https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/)

### Secondary (MEDIUM confidence)
- [GH Actions cron drift discussion](https://github.com/orgs/community/discussions/156282) — community-reported, confirmed by multiple sources
- [Sentry Deno `Deno.serve` scope limitation issue](https://github.com/getsentry/sentry-javascript/issues/15229) — official Sentry issue tracker
- [TanStack Router preload-beforeLoad issue #1382](https://github.com/TanStack/router/issues/1382) — confirmed maintainer response
- [mokkapps.de Supabase + Playwright guide](https://mokkapps.de/blog/login-at-supabase-via-rest-api-in-playwright-e2e-test) — community pattern, matches Playwright docs

### Tertiary (LOW confidence — flagged for validation)
- Specific Supabase free-tier 7-day pause threshold (A1) — assumed from Phase 4 CONTEXT; should be re-verified at launch
- Supabase Discord OAuth `provider_id` field shape (A5) — canonical but executor must confirm in practice with `console.log`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm query 2026-04-19
- Architecture patterns: HIGH — inline code examples sourced from official docs; GH Actions YAML is standard
- Pitfalls: HIGH — 9 of 10 pitfalls have cited source; #10 is anecdotal Netlify community reports
- Security: MEDIUM — ASVS mapping is complete; some controls (constant-time secret compare) are optional hardening, not v1-blocking
- Validation architecture: HIGH — every locked decision has a falsifiable proof surface identified

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days — stable ecosystem; re-verify npm versions if Dependabot lands major bumps in between)
