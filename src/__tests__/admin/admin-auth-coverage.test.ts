/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Every admin Edge Function must import requireAdmin and gate the request
// before any DB write. close-expired-polls is the documented carve-out:
// it is gated by a shared cron secret instead.
const GATED_EF_PATHS = [
  'create-poll',
  'update-poll',
  'close-poll',
  'pin-poll',
  'delete-poll',
  'set-resolution',
  'create-category',
  'rename-category',
  'delete-category',
  'promote-admin',
  'demote-admin',
  'search-admin-targets',
  'get-upload-url',
] as const

const UNGATED_EF_PATHS = ['close-expired-polls'] as const

function efPath(name: string) {
  return resolve(__dirname, `../../../supabase/functions/${name}/index.ts`)
}

describe('admin-auth coverage source analysis', () => {
  it('shared admin-auth.ts helper exists and exports requireAdmin', () => {
    const helperPath = resolve(
      __dirname,
      '../../../supabase/functions/_shared/admin-auth.ts',
    )
    expect(existsSync(helperPath)).toBe(true)
    const src = readFileSync(helperPath, 'utf-8')
    expect(src).toMatch(/export\s+async\s+function\s+requireAdmin/)
    // Reads is_admin, guild_member, mfa_verified
    expect(src).toMatch(/is_admin/)
    expect(src).toMatch(/mfa_verified/)
    expect(src).toMatch(/guild_member/)
    expect(src).toMatch(/profile_not_found/)
    expect(src).toMatch(/not_admin/)
    expect(src).toMatch(/integrity_failed/)
    expect(src).toMatch(/query_failed/)
  })

  for (const name of GATED_EF_PATHS) {
    describe(`Edge Function: ${name}`, () => {
      const filePath = efPath(name)

      it('exists', () => {
        expect(existsSync(filePath)).toBe(true)
      })

      const src = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : ''

      it('imports requireAdmin from _shared/admin-auth.ts', () => {
        expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
        expect(src).toMatch(/requireAdmin/)
      })

      it('calls requireAdmin and gates on failure via adminCheckResponse', () => {
        expect(src).toMatch(/requireAdmin\s*\(/)
        expect(src).toMatch(/adminCheckResponse/)
      })

      it('checks Authorization header and returns 401 on missing auth', () => {
        expect(src).toMatch(/Authorization/)
        expect(src).toMatch(/401/)
      })

      it('uses service-role client (SUPABASE_SERVICE_ROLE_KEY)', () => {
        expect(src).toMatch(/SUPABASE_SERVICE_ROLE_KEY/)
      })

      it('admin gate occurs before any DB write (requireAdmin call appears before insert/update/delete/rpc)', () => {
        const adminIdx = src.search(/requireAdmin\s*\(/)
        expect(adminIdx).toBeGreaterThan(-1)
        // Find first DB write/RPC after the admin gate location.
        // We just confirm requireAdmin exists; the per-function tests
        // below also pin specific orderings.
        const writeMatch = src.match(/\.(insert|update|delete|rpc)\s*\(/)
        if (writeMatch && writeMatch.index !== undefined) {
          expect(adminIdx).toBeLessThan(writeMatch.index)
        }
      })
    })
  }

  // close-expired-polls is the documented carve-out. It is gated by an
  // X-Cron-Secret header verified against CLOSE_SWEEPER_SECRET, not by a
  // user session.
  for (const name of UNGATED_EF_PATHS) {
    describe(`Edge Function: ${name} (cron-secret carve-out)`, () => {
      const filePath = efPath(name)

      it('exists', () => {
        expect(existsSync(filePath)).toBe(true)
      })

      const src = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : ''

      it('does NOT import requireAdmin (intentional carve-out)', () => {
        expect(src).not.toMatch(/requireAdmin/)
      })

      it('reads CLOSE_SWEEPER_SECRET env var', () => {
        expect(src).toMatch(/Deno\.env\.get\(\s*['"]CLOSE_SWEEPER_SECRET['"]\s*\)/)
      })

      it('checks X-Cron-Secret header and returns 401 on mismatch', () => {
        expect(src).toMatch(/X-Cron-Secret/i)
        expect(src).toMatch(/401/)
      })
    })
  }
})
