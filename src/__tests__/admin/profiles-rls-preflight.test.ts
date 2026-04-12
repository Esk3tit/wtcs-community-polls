import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

// Cross-AI review HIGH #2 (Plan 04-03 Task 1):
//
// AdminsList reads directly from the profiles table via
//   supabase.from('profiles').select('id, discord_id, discord_username, avatar_url').eq('is_admin', true)
//
// That only works if the existing profiles SELECT RLS policy grants read access
// to every authenticated caller. This test grep-verifies the existing migration
// so a narrowing edit would fail BEFORE Plan 04-03 Task 4 wires the Admins tab.
//
// If this test ever fails, either:
//   (a) Write a new migration widening (or adding) a SELECT policy that covers
//       the admin columns for authenticated callers, OR
//   (b) Rewrite AdminsList.tsx to call a new admin-only list-admins Edge Function.
//
// Do NOT proceed with Plan 04-03 Tasks 2-4 while this test is red.

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const RLS_PATH = resolve(__dirname, '../../../supabase/migrations/00000000000001_rls.sql')

describe('Profiles SELECT RLS preflight (Plan 04-03 Task 1, cross-AI HIGH #2)', () => {
  it('00000000000001_rls.sql exists', () => {
    expect(existsSync(RLS_PATH)).toBe(true)
  })

  const sql = existsSync(RLS_PATH) ? readFileSync(RLS_PATH, 'utf-8') : ''

  it('declares a broad SELECT policy on profiles for authenticated role', () => {
    expect(sql).toMatch(/CREATE POLICY\s+"Profiles are viewable by authenticated users"\s+ON public\.profiles/i)
    expect(sql).toMatch(/FOR SELECT/i)
    expect(sql).toMatch(/TO authenticated/i)
  })

  it('USING clause is USING (true) — broad read for AdminsList (HIGH #2)', () => {
    // If this ever narrows to e.g. USING (id = auth.uid()) OR to an is_admin gate,
    // AdminsList.tsx breaks at runtime. A new migration must widen the policy (or
    // add a column-restricted admin-only select) BEFORE Plan 04-03 Task 4 runs.
    expect(sql).toMatch(
      /"Profiles are viewable by authenticated users"[\s\S]*USING\s*\(\s*true\s*\)/,
    )
  })
})
