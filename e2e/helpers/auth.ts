import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'
import { fixtureUsers, FIXTURE_PASSWORD } from '../fixtures/test-users'

/**
 * Phase 05-05 — Playwright session injection helper.
 *
 * HIGH #2 resolution: mint sessions via the PUBLIC `signInWithPassword` API
 * against local-only fixture users seeded in `e2e/fixtures/seed.sql`. An
 * earlier draft used an internal admin-only session-minting path whose
 * token layout is not part of Supabase's stable contract and is brittle
 * across upgrades. This helper uses the deterministic public API only.
 *
 * Service-role key is NOT used here (tripwire-guarded). Service-role stays
 * inside seeding contexts; `loginAs` is strictly anon-key + password.
 *
 * Pitfall 7 (05-RESEARCH.md): localStorage session key format is
 * `sb-<project-ref>-auth-token`. The "ref" is derived from the hostname
 * prefix of `VITE_SUPABASE_URL`, which is the same env var the app reads —
 * so the keys inevitably match. If auth fails in tests despite a clean
 * `signInWithPassword` call, first sanity-check `VITE_SUPABASE_URL` parity
 * between the Playwright env and the app's env (DevTools → Application →
 * Local Storage shows the exact key the app expects).
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321'

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0] || 'localhost'
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`

// Lazy ANON_KEY accessor: assertion fires only when loginAs is actually
// invoked. A module-top throw would defeat the early-return that
// global-setup.ts performs for ad-hoc runs that don't need either supabase
// key, blocking the entire suite at import time. Mirrors the lazy pattern
// used by getAdminClient() for SUPABASE_SERVICE_ROLE_KEY.
function getAnonKey(): string {
  const k = process.env.VITE_SUPABASE_ANON_KEY
  if (!k) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY env var required for Playwright auth helper. ' +
        'In local dev, run `supabase status` and export the anon key; in CI, ' +
        'wired from the repo secret LOCAL_ANON_KEY.',
    )
  }
  return k
}

/**
 * Sign a fixture user in and inject the resulting Supabase session into
 * `localStorage` before the app's first paint, so the Vite SPA reads it as
 * an already-authenticated session.
 *
 * **IMPORTANT (LO-03 Phase 5 review):** Callers MUST `await` this helper
 * before any `page.goto(...)` / `page.navigate(...)`. `page.addInitScript`
 * only runs on page contexts created AFTER it is registered. If navigation
 * races ahead of the init-script registration the browser will load the
 * app in a logged-out state and auth-dependent assertions will fail with
 * misleading redirect-to-login errors. See Pitfall 7 in 05-RESEARCH.md.
 *
 * **Context switch between tests (LO-02 Phase 5 review):** Re-running
 * `loginAs` with a different fixture user registers an ADDITIONAL init
 * script on the same page; both fire on the next `page.goto(...)`, in
 * registration order, so the last-written localStorage wins. In-flight
 * React/Supabase state from the prior session persists until the next
 * navigation completes — always follow a re-login with an explicit
 * `page.goto(...)` before asserting on per-user UI.
 *
 * @param page         Playwright Page (obtained from the test fixture)
 * @param fixtureUserId  One of the UUIDs from `fixtureUsers.*.id`
 */
export async function loginAs(page: Page, fixtureUserId: string): Promise<void> {
  const user = Object.values(fixtureUsers).find((u) => u.id === fixtureUserId)
  if (!user) {
    throw new Error(
      `Unknown fixture user id: ${fixtureUserId}. Expected one of: ` +
        Object.values(fixtureUsers)
          .map((u) => u.id)
          .join(', '),
    )
  }

  // Resolve ANON_KEY here (not at module scope) so that callers who never
  // invoke loginAs — e.g. global-setup.ts importing only getAdminClient —
  // are not blocked at import time when the env var is unset.
  const anonKey = getAnonKey()
  const client = createClient(SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: FIXTURE_PASSWORD,
  })
  if (error || !data.session) {
    throw error ?? new Error(`signInWithPassword returned no session for ${user.email}`)
  }

  // Shape the payload to match what @supabase/supabase-js stores under the
  // localStorage key. The app's createClient() will rehydrate from this on load.
  const payload = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    expires_at: data.session.expires_at,
    token_type: data.session.token_type,
    user: data.session.user,
  }

  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value)
    },
    [STORAGE_KEY, JSON.stringify(payload)] as [string, string],
  )
}

// Module-scoped lazy singleton: created on first access, reused across fixtures.
// Service-role bypasses RLS — only used inside e2e/fixtures/* and e2e/helpers/*,
// never inside specs (the loginAs() public API stays anon-only). Lazy so that
// non-fixture-using specs (e.g. auth-errors.spec.ts, which never needs admin)
// can still import this module when SUPABASE_SERVICE_ROLE_KEY is absent.
let _adminClient: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY env var required for E2E admin client. ' +
        'In local dev, run `supabase status` and export it; in CI, ' +
        'derived from supabase status (see .github/workflows/ci.yml).',
    )
  }
  _adminClient = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _adminClient
}
