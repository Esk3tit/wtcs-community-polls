/**
 * Phase 05-05 — Playwright fixture users.
 *
 * Local-only. These UUIDs + emails + password are meaningful ONLY against
 * the fixture seed in `e2e/fixtures/seed.sql`, which is applied against a
 * local Supabase stack (`supabase start`) — never production. The password
 * is a hardcoded local-only sentinel so Playwright can sign in via the
 * public `signInWithPassword` API without needing the service-role key
 * (HIGH #2 resolution).
 *
 * Do NOT reuse these values in any environment that is not an ephemeral
 * local Supabase started from this repo.
 */

export interface FixtureUser {
  id: string
  email: string
  discord_id: string
}

export const fixtureUsers = {
  memberUser: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'playwright-user-member@test.local',
    discord_id: '100000000000000001',
  },
  adminUser: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'playwright-user-admin@test.local',
    discord_id: '100000000000000002',
  },
  no2faUser: {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'playwright-user-no2fa@test.local',
    discord_id: '100000000000000003',
  },
  notInServer: {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'playwright-user-notmember@test.local',
    discord_id: '100000000000000004',
  },
} as const satisfies Record<string, FixtureUser>

/**
 * Shared fixture password. Local-only; seeded into `auth.users` via
 * `crypt(..., gen_salt('bf'))` in `e2e/fixtures/seed.sql`. Safe to commit —
 * it unlocks nothing outside the local Supabase fixture stack.
 */
export const FIXTURE_PASSWORD = 'playwright-fixture-only-do-not-use-in-prod'
