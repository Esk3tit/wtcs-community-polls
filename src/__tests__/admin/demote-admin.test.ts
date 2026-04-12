/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DEMOTE_PATH = resolve(
  __dirname,
  '../../../supabase/functions/demote-admin/index.ts',
)

describe('Phase 4 demote-admin Edge Function (source analysis)', () => {
  it('exists', () => {
    expect(existsSync(DEMOTE_PATH)).toBe(true)
  })

  const src = existsSync(DEMOTE_PATH) ? readFileSync(DEMOTE_PATH, 'utf-8') : ''

  it('imports and calls requireAdmin', () => {
    expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
    expect(src).toMatch(/requireAdmin\s*\(/)
  })

  it('contains literal target_user_id === user.id self-demote guard (D-06)', () => {
    expect(src).toMatch(/target_user_id\s*===\s*user\.id/)
  })

  it('returns 400 with "Cannot demote yourself" message', () => {
    expect(src).toMatch(/Cannot demote yourself/)
    expect(src).toMatch(
      /Cannot demote yourself[\s\S]{0,250}400|400[\s\S]{0,250}Cannot demote yourself/,
    )
  })

  it('last-admin guard fails closed on null adminCount', () => {
    // The guard must use `adminCount === null || adminCount <= 1` (fail-closed)
    // not `adminCount !== null && adminCount <= 1` (fail-open on null).
    expect(src).toMatch(/adminCount\s*===\s*null\s*\|\|\s*adminCount\s*<=\s*1/)
    expect(src).not.toMatch(/adminCount\s*!==\s*null\s*&&\s*adminCount\s*<=\s*1/)
  })

  it('updates profiles SET is_admin=false', () => {
    expect(src).toMatch(/from\(\s*['"]profiles['"]\s*\)/)
    expect(src).toMatch(/\.update\(/)
    expect(src).toMatch(/is_admin/)
    expect(src).toMatch(/false/)
  })

  it('self-demote guard appears BEFORE the profiles.update() call', () => {
    const guardIdx = src.search(/target_user_id\s*===\s*user\.id/)
    const updateIdx = src.search(/from\(\s*['"]profiles['"]\s*\)\s*\.\s*update/)
    expect(guardIdx).toBeGreaterThan(-1)
    expect(updateIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(updateIdx)
  })
})
