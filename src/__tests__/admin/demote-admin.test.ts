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

describe('demote-admin Edge Function source analysis', () => {
  it('exists', () => {
    expect(existsSync(DEMOTE_PATH)).toBe(true)
  })

  const src = existsSync(DEMOTE_PATH) ? readFileSync(DEMOTE_PATH, 'utf-8') : ''

  it('imports and calls requireAdmin', () => {
    expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
    expect(src).toMatch(/requireAdmin\s*\(/)
  })

  it('contains literal target_user_id === user.id self-demote guard', () => {
    expect(src).toMatch(/target_user_id\s*===\s*user\.id/)
  })

  it('returns 400 with "Cannot demote yourself" message', () => {
    expect(src).toMatch(/Cannot demote yourself/)
    expect(src).toMatch(
      /Cannot demote yourself[\s\S]{0,250}400|400[\s\S]{0,250}Cannot demote yourself/,
    )
  })

  it('last-admin guard delegated to demote_admin_guarded RPC with P0003 mapping', () => {
    // The guard now lives in the migration-12 SQL function (atomic with row
    // locks — closes the prior count-then-update race). The EF must call
    // that RPC and map its P0003 error code to the "at least one admin must
    // remain" message so non-admin observers still see the same 400.
    expect(src).toMatch(/\.rpc\(\s*['"]demote_admin_guarded['"]/)
    expect(src).toMatch(/P0003/)
    expect(src).toMatch(/at least one admin must remain/)
  })

  it('demotion goes through demote_admin_guarded RPC, not direct profiles.update()', () => {
    // Profile UPDATE happens inside the RPC under row locks. A direct
    // `from('profiles').update(...)` in the EF would reintroduce the race.
    expect(src).toMatch(/\.rpc\(\s*['"]demote_admin_guarded['"]/)
    expect(src).not.toMatch(/from\(\s*['"]profiles['"]\s*\)\s*\.\s*update\(/)
  })

  it('self-demote guard appears BEFORE the RPC call', () => {
    const guardIdx = src.search(/target_user_id\s*===\s*user\.id/)
    const rpcIdx = src.search(/\.rpc\(\s*['"]demote_admin_guarded['"]/)
    expect(guardIdx).toBeGreaterThan(-1)
    expect(rpcIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(rpcIdx)
  })

  it('maps RPC error codes P0001/P0002/P0003 to 404/409/400', () => {
    expect(src).toMatch(/P0001[\s\S]{0,200}404/)
    expect(src).toMatch(/P0002[\s\S]{0,200}409/)
    expect(src).toMatch(/P0003[\s\S]{0,200}400/)
  })
})
