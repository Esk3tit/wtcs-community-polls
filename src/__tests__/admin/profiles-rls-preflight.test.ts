import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

// Verifies profiles SELECT RLS policy allows reading admin columns for
// authenticated callers. If this fails, add/widen a SELECT policy or
// rewrite AdminsList to use an Edge Function.

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const RLS_PATH = resolve(__dirname, '../../../supabase/migrations/00000000000001_rls.sql')

describe('Profiles SELECT RLS preflight (Plan 04-03 Task 1, cross-AI HIGH #2)', () => {
  it('00000000000001_rls.sql exists', () => {
    expect(existsSync(RLS_PATH)).toBe(true)
  })

  const sql = existsSync(RLS_PATH) ? readFileSync(RLS_PATH, 'utf-8') : ''

  it('declares a broad SELECT policy on profiles for authenticated role', () => {
    expect(sql).toMatch(/CREATE POLICY\s+"[^"]+"\s+ON public\.profiles/i)
    expect(sql).toMatch(/FOR SELECT/i)
    expect(sql).toMatch(/TO authenticated/i)
  })

  it('USING clause is USING (true) — broad read for AdminsList (HIGH #2)', () => {
    expect(sql).toMatch(
      /ON\s+public\.profiles[\s\S]*FOR\s+SELECT[\s\S]*TO\s+authenticated[\s\S]*USING\s*\(\s*true\s*\)/i,
    )
  })
})
