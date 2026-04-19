/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SWEEP_PATH = resolve(
  __dirname,
  '../../../supabase/functions/close-expired-polls/index.ts',
)

describe('Phase 4 close-expired-polls Edge Function (HIGH #4 — cron-secret gate)', () => {
  it('exists', () => {
    expect(existsSync(SWEEP_PATH)).toBe(true)
  })

  const src = existsSync(SWEEP_PATH) ? readFileSync(SWEEP_PATH, 'utf-8') : ''

  it('does NOT import requireAdmin (intentional carve-out)', () => {
    expect(src).not.toMatch(/requireAdmin/)
  })

  it("reads Deno.env.get('CLOSE_SWEEPER_SECRET') (HIGH #4)", () => {
    expect(src).toMatch(/Deno\.env\.get\(\s*['"]CLOSE_SWEEPER_SECRET['"]\s*\)/)
  })

  it('checks the X-Cron-Secret request header (HIGH #4)', () => {
    expect(src).toMatch(/X-Cron-Secret/i)
  })

  it('returns 401 on missing/mismatched secret (HIGH #4)', () => {
    expect(src).toMatch(
      /Unauthorized[\s\S]{0,300}401|401[\s\S]{0,300}Unauthorized/,
    )
  })

  it('returns 503 when CLOSE_SWEEPER_SECRET is not configured', () => {
    expect(src).toMatch(
      /Sweeper not configured[\s\S]{0,300}503|503[\s\S]{0,300}Sweeper not configured/,
    )
  })

  it('updates polls table filtering on status active and closes_at lt now', () => {
    expect(src).toMatch(/from\(\s*['"]polls['"]\s*\)/)
    expect(src).toMatch(/\.update\(/)
    expect(src).toMatch(/\.eq\(\s*['"]status['"]\s*,\s*['"]active['"]\s*\)/)
    expect(src).toMatch(/\.lt\(\s*['"]closes_at['"]/)
  })

  it("sets status='closed' and closed_at to ISO string", () => {
    expect(src).toMatch(/status:\s*['"]closed['"]/)
    expect(src).toMatch(/closed_at/)
    expect(src).toMatch(/toISOString\(\)/)
  })

  it('uses service-role client (SUPABASE_SERVICE_ROLE_KEY)', () => {
    expect(src).toMatch(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('header check appears BEFORE the polls.update() call', () => {
    const headerIdx = src.search(
      /req\.headers\.get\(\s*['"]X-Cron-Secret['"]\s*\)/,
    )
    const updateIdx = src.search(
      /\.from\(\s*['"]polls['"]\s*\)[\s\S]{0,120}\.update\(/,
    )
    expect(headerIdx).toBeGreaterThan(-1)
    expect(updateIdx).toBeGreaterThan(-1)
    expect(headerIdx).toBeLessThan(updateIdx)
  })
})
