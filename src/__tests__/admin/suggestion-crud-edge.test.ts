/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function efSrc(name: string): string {
  const p = resolve(__dirname, `../../../supabase/functions/${name}/index.ts`)
  return existsSync(p) ? readFileSync(p, 'utf-8') : ''
}

describe('Phase 4 suggestion CRUD Edge Functions (source analysis)', () => {
  describe('create-poll', () => {
    const src = efSrc('create-poll')

    it('exists and is non-empty', () => {
      expect(src.length).toBeGreaterThan(0)
    })

    it('imports and calls requireAdmin', () => {
      expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
      expect(src).toMatch(/requireAdmin\s*\(/)
    })

    it("calls rpc('create_poll_with_choices')", () => {
      expect(src).toMatch(/rpc\(\s*['"]create_poll_with_choices['"]/)
    })

    it('validates title length and choices array bounds', () => {
      // Title bounds 3..120
      expect(src).toMatch(/title/)
      expect(src).toMatch(/120/)
      expect(src).toMatch(/3/)
      // Choices array bounds 2..10
      expect(src).toMatch(/Array\.isArray\(\s*choices\s*\)|choices\.length/)
      expect(src).toMatch(/10/)
      expect(src).toMatch(/2/)
    })

    it('returns 400 on validation failure', () => {
      expect(src).toMatch(/400/)
    })
  })

  describe('update-poll (HIGH #1: transactional RPC path)', () => {
    const src = efSrc('update-poll')

    it('exists and is non-empty', () => {
      expect(src.length).toBeGreaterThan(0)
    })

    it('imports and calls requireAdmin', () => {
      expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
      expect(src).toMatch(/requireAdmin\s*\(/)
    })

    it('runs EXISTS pre-check on votes table before touching anything', () => {
      expect(src).toMatch(/from\(\s*['"]votes['"]\s*\)/)
      expect(src).toMatch(/poll_id/)
    })

    it('returns 409 on edit-lock guard hit', () => {
      expect(src).toMatch(/409/)
    })

    it('calls update_poll_with_choices RPC (HIGH #1: transactional)', () => {
      expect(src).toMatch(/rpc\(\s*['"]update_poll_with_choices['"]/)
    })

    it('does NOT contain a raw choices.delete() chain (HIGH #1)', () => {
      expect(src).not.toMatch(/from\(\s*['"]choices['"]\s*\)\s*\.\s*delete/)
    })

    it('does NOT contain a raw choices.insert() chain (HIGH #1)', () => {
      expect(src).not.toMatch(/from\(\s*['"]choices['"]\s*\)\s*\.\s*insert/)
    })

    it('EXISTS pre-check appears BEFORE the RPC call', () => {
      const votesIdx = src.search(/from\(\s*['"]votes['"]\s*\)/)
      const rpcIdx = src.search(/rpc\(\s*['"]update_poll_with_choices['"]/)
      expect(votesIdx).toBeGreaterThan(-1)
      expect(rpcIdx).toBeGreaterThan(-1)
      expect(votesIdx).toBeLessThan(rpcIdx)
    })
  })

  describe('close-poll', () => {
    const src = efSrc('close-poll')

    it('exists and is non-empty', () => {
      expect(src.length).toBeGreaterThan(0)
    })

    it('imports and calls requireAdmin', () => {
      expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
      expect(src).toMatch(/requireAdmin\s*\(/)
    })

    it('requires resolution field in body and validates allowed values', () => {
      expect(src).toMatch(/resolution/)
      expect(src).toMatch(/addressed/)
      expect(src).toMatch(/forwarded/)
    })

    it("updates polls SET status='closed' with closed_at timestamp", () => {
      expect(src).toMatch(/status:\s*['"]closed['"]/)
      expect(src).toMatch(/closed_at/)
    })

    it('returns 400 on missing/invalid resolution', () => {
      expect(src).toMatch(/400/)
    })
  })

  describe('pin-poll', () => {
    const src = efSrc('pin-poll')

    it('exists and is non-empty', () => {
      expect(src.length).toBeGreaterThan(0)
    })

    it('imports and calls requireAdmin', () => {
      expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
      expect(src).toMatch(/requireAdmin\s*\(/)
    })

    it('toggles is_pinned on polls table', () => {
      expect(src).toMatch(/is_pinned/)
      expect(src).toMatch(/from\(\s*['"]polls['"]\s*\)/)
      expect(src).toMatch(/\.update\(/)
    })
  })

  describe('delete-poll (D-18 server-side delete lock)', () => {
    const src = efSrc('delete-poll')

    it('exists and is non-empty', () => {
      expect(src.length).toBeGreaterThan(0)
    })

    it('imports and calls requireAdmin', () => {
      expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
      expect(src).toMatch(/requireAdmin\s*\(/)
    })

    it('contains EXISTS guard on votes table', () => {
      expect(src).toMatch(/from\(\s*['"]votes['"]\s*\)/)
      expect(src).toMatch(/poll_id/)
    })

    it('returns 409 on guard hit', () => {
      expect(src).toMatch(/409/)
    })

    it('deletes from polls table', () => {
      expect(src).toMatch(/from\(\s*['"]polls['"]\s*\)\s*\.\s*delete/)
    })

    it('vote guard appears BEFORE the delete call', () => {
      const votesIdx = src.search(/from\(\s*['"]votes['"]\s*\)/)
      const deleteIdx = src.search(/from\(\s*['"]polls['"]\s*\)\s*\.\s*delete/)
      expect(votesIdx).toBeGreaterThan(-1)
      expect(deleteIdx).toBeGreaterThan(-1)
      expect(votesIdx).toBeLessThan(deleteIdx)
    })
  })

  describe('set-resolution', () => {
    const src = efSrc('set-resolution')

    it('exists and is non-empty', () => {
      expect(src.length).toBeGreaterThan(0)
    })

    it('imports and calls requireAdmin', () => {
      expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
      expect(src).toMatch(/requireAdmin\s*\(/)
    })

    it('validates resolution against allowed list', () => {
      expect(src).toMatch(/addressed/)
      expect(src).toMatch(/forwarded/)
    })

    it('updates polls SET resolution=', () => {
      expect(src).toMatch(/resolution/)
      expect(src).toMatch(/from\(\s*['"]polls['"]\s*\)/)
      expect(src).toMatch(/\.update\(/)
    })
  })

  describe('get-upload-url', () => {
    const src = efSrc('get-upload-url')

    it('exists and is non-empty', () => {
      expect(src.length).toBeGreaterThan(0)
    })

    it('imports and calls requireAdmin', () => {
      expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
      expect(src).toMatch(/requireAdmin\s*\(/)
    })

    it('validates contentType against jpeg/png/webp allowlist', () => {
      expect(src).toMatch(/image\/jpeg/)
      expect(src).toMatch(/image\/png/)
      expect(src).toMatch(/image\/webp/)
    })

    it('uses crypto.randomUUID for the path', () => {
      expect(src).toMatch(/crypto\.randomUUID/)
    })

    it('calls createSignedUploadUrl on poll-images bucket', () => {
      expect(src).toMatch(/createSignedUploadUrl/)
      expect(src).toMatch(/poll-images/)
    })

    it('returns 400 on disallowed content type', () => {
      expect(src).toMatch(/400/)
    })
  })
})
