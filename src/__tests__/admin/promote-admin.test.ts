/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROMOTE_PATH = resolve(
  __dirname,
  '../../../supabase/functions/promote-admin/index.ts',
)

const SEARCH_PATH = resolve(
  __dirname,
  '../../../supabase/functions/search-admin-targets/index.ts',
)

describe('promote-admin Edge Function source analysis', () => {
  it('exists', () => {
    expect(existsSync(PROMOTE_PATH)).toBe(true)
  })

  const src = existsSync(PROMOTE_PATH) ? readFileSync(PROMOTE_PATH, 'utf-8') : ''

  it('imports and calls requireAdmin', () => {
    expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
    expect(src).toMatch(/requireAdmin\s*\(/)
  })

  it('handles target_user_id branch (existing profile)', () => {
    expect(src).toMatch(/target_user_id/)
  })

  it('handles target_discord_id branch (pre-auth)', () => {
    expect(src).toMatch(/target_discord_id/)
  })

  it('contains snowflake regex /^\\d{17,19}$/', () => {
    expect(src).toMatch(/\/\^\\d\{17,19\}\$\//)
  })

  it('updates profiles SET is_admin=true on existing-user path', () => {
    expect(src).toMatch(/from\(\s*['"]profiles['"]\s*\)/)
    expect(src).toMatch(/is_admin/)
    expect(src).toMatch(/true/)
  })

  it('inserts into admin_discord_ids on pre-auth path', () => {
    expect(src).toMatch(/admin_discord_ids/)
    expect(src).toMatch(/\.insert\(/)
  })

  it('ignores PostgreSQL 23505 (duplicate) on insert', () => {
    expect(src).toMatch(/23505/)
  })

  it('returns 400 on invalid input', () => {
    expect(src).toMatch(
      /(status\s*:\s*400\b|new\s+Response\s*\([^)]*400\b|json\s*\([^)]*400\b)/,
    )
  })
})

describe('search-admin-targets Edge Function source analysis', () => {
  it('exists', () => {
    expect(existsSync(SEARCH_PATH)).toBe(true)
  })

  const src = existsSync(SEARCH_PATH) ? readFileSync(SEARCH_PATH, 'utf-8') : ''

  it('imports and calls requireAdmin', () => {
    expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
    expect(src).toMatch(/requireAdmin\s*\(/)
  })

  it('uses ilike on profiles.discord_username', () => {
    expect(src).toMatch(/from\(\s*['"]profiles['"]\s*\)/)
    expect(src).toMatch(/\.ilike\(\s*['"]discord_username['"]/)
  })

  it('enforces min 2-char query length', () => {
    expect(src).toMatch(/length\s*[<>=]|\.length/)
    expect(src).toMatch(/length[\s\S]{0,50}2|2[\s\S]{0,50}length/)
  })

  it('limits results to 10', () => {
    expect(src).toMatch(/\.limit\(\s*10\s*\)/)
  })
})
