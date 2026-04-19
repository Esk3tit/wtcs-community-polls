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

describe('Phase 4 category CRUD Edge Functions (source analysis)', () => {
  describe('create-category', () => {
    const src = efSrc('create-category')

    it('exists', () => {
      expect(src.length).toBeGreaterThan(0)
    })

    it('imports and calls requireAdmin', () => {
      expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
      expect(src).toMatch(/requireAdmin\s*\(/)
    })

    it('inserts into categories', () => {
      expect(src).toMatch(/from\(\s*['"]categories['"]\s*\)/)
      expect(src).toMatch(/\.insert\(/)
    })

    it('validates name length 1..50', () => {
      expect(src).toMatch(/50/)
      expect(src).toMatch(/name/)
    })

    it('handles 23505 unique violation as 409', () => {
      expect(src).toMatch(/23505/)
      expect(src).toMatch(/409/)
    })
  })

  describe('rename-category', () => {
    const src = efSrc('rename-category')

    it('exists', () => {
      expect(src.length).toBeGreaterThan(0)
    })

    it('imports and calls requireAdmin', () => {
      expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
      expect(src).toMatch(/requireAdmin\s*\(/)
    })

    it('updates categories SET name= WHERE id=', () => {
      expect(src).toMatch(/from\(\s*['"]categories['"]\s*\)/)
      expect(src).toMatch(/\.update\(/)
      expect(src).toMatch(/name/)
      expect(src).toMatch(/\.eq\(\s*['"]id['"]/)
    })

    it('validates name length 1..50', () => {
      expect(src).toMatch(/50/)
    })
  })

  describe('delete-category', () => {
    const src = efSrc('delete-category')

    it('exists', () => {
      expect(src.length).toBeGreaterThan(0)
    })

    it('imports and calls requireAdmin', () => {
      expect(src).toMatch(/from\s+['"]\.\.\/_shared\/admin-auth\.ts['"]/)
      expect(src).toMatch(/requireAdmin\s*\(/)
    })

    it('deletes from categories WHERE id=', () => {
      expect(src).toMatch(/from\(\s*['"]categories['"]\s*\)\s*\.\s*delete/)
      expect(src).toMatch(/\.eq\(\s*['"]id['"]/)
    })
  })
})
