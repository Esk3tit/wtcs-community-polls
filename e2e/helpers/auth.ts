import { createClient } from '@supabase/supabase-js'
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
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!ANON_KEY) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY env var required for Playwright auth helper. ' +
      'In local dev, run `supabase status` and export the anon key; in CI, ' +
      'Plan 05-06 wires it from the repo secret LOCAL_ANON_KEY.',
  )
}

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0] || 'localhost'
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`

/**
 * Sign a fixture user in and inject the resulting Supabase session into
 * `localStorage` before the app's first paint, so the Vite SPA reads it as
 * an already-authenticated session.
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

  const client = createClient(SUPABASE_URL, ANON_KEY as string, {
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
