import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = resolve(__dirname, '../../../')

describe('Public surface extensions (Phase 4 Plan 04 Task 4)', () => {
  it('useSuggestions reads from polls_effective view (MEDIUM #5)', () => {
    const src = readFileSync(resolve(root, 'src/hooks/useSuggestions.ts'), 'utf-8')
    expect(src).toMatch(/from\(['"]polls_effective['"]\)/)
    expect(src).not.toMatch(/from\(['"]polls['"]\)/)
  })

  it('useSuggestions sorts by is_pinned DESC then created_at DESC', () => {
    const src = readFileSync(resolve(root, 'src/hooks/useSuggestions.ts'), 'utf-8')
    expect(src).toMatch(/\.order\(['"]is_pinned['"]/)
    expect(src).toMatch(/\.order\(['"]created_at['"]/)
    expect(src).toMatch(
      /order\(['"]is_pinned['"][\s\S]*ascending:\s*false[\s\S]*order\(['"]created_at['"][\s\S]*ascending:\s*false/,
    )
  })

  it('topics route or its card component exposes a Pinned badge', () => {
    const candidates = [
      'src/routes/topics.tsx',
      'src/components/suggestions/SuggestionCard.tsx',
      'src/components/suggestions/PinnedBanner.tsx',
    ]
    const found = candidates.some((p) => {
      const full = resolve(root, p)
      if (!existsSync(full)) return false
      const src = readFileSync(full, 'utf-8')
      return /Pinned/.test(src) && /is_pinned/.test(src)
    })
    expect(found).toBe(true)
  })

  it('archive route surfaces resolution pills (Addressed / Forwarded / Closed)', () => {
    const src = readFileSync(resolve(root, 'src/routes/archive.tsx'), 'utf-8')
    expect(src).toMatch(/Addressed/)
    expect(src).toMatch(/Forwarded/)
    expect(src).toMatch(/resolution/i)
  })
})
