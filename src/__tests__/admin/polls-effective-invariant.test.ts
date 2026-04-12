import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { describe, it, expect } from 'vitest'

// Cross-AI review MEDIUM #5: After Phase 4, ALL public reads of poll
// active/closed status MUST go through the `polls_effective` view, never
// the base `polls` table. This test scans every *.ts and *.tsx file under
// src/routes, src/hooks, and src/components for direct `from('polls')`
// accesses and fails if it finds any outside the allowlist.

const root = resolve(__dirname, '../../../')
const SCAN_DIRS = ['src/routes', 'src/hooks', 'src/components']

// Files allowed to reference the base `polls` table for admin-only,
// non-status reads (e.g. category FK count queries). Any addition here
// must be an ADMIN-ONLY code path that does NOT filter by polls.status.
const ALLOWLIST = new Set<string>([
  // Admin-only: counts suggestions by category_id for the delete-category
  // confirmation dialog (D-21 LOW fix). Reads no status column.
  'src/components/admin/CategoriesList.tsx',
])

function walk(dir: string): string[] {
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  const out: string[] = []
  for (const e of entries) {
    const full = resolve(dir, e)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(e)) out.push(full)
  }
  return out
}

describe('polls_effective invariant (Phase 4 cross-AI MEDIUM #5)', () => {
  it('no public code path reads from base polls table via from("polls")', () => {
    const offenders: string[] = []
    for (const d of SCAN_DIRS) {
      const abs = resolve(root, d)
      const files = walk(abs)
      for (const f of files) {
        const rel = relative(root, f).replace(/\\/g, '/')
        if (ALLOWLIST.has(rel)) continue
        const src = readFileSync(f, 'utf-8')
        // Match both `from('polls')` and `from("polls")`. The regex
        // explicitly looks for the literal 'polls' string inside `from(...)`
        // — `polls_effective` has additional characters and does not match.
        if (/from\(\s*['"]polls['"]\s*\)/.test(src)) {
          offenders.push(rel)
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `polls_effective invariant violated — the following files read the base polls table directly.\n` +
          `Public reads MUST go through polls_effective (cross-AI review MEDIUM #5):\n` +
          offenders.map((o) => `  - ${o}`).join('\n') +
          `\nFix: replace supabase.from('polls') with supabase.from('polls_effective').`,
      )
    }
    expect(offenders).toEqual([])
  })

  it('no public code path filters polls.status via a chained .eq("status", ...) pattern', () => {
    const offenders: string[] = []
    for (const d of SCAN_DIRS) {
      const abs = resolve(root, d)
      const files = walk(abs)
      for (const f of files) {
        const rel = relative(root, f).replace(/\\/g, '/')
        if (ALLOWLIST.has(rel)) continue
        const src = readFileSync(f, 'utf-8')
        // Lenient regex: `from('polls')` within 500 chars of `.eq('status'`.
        // Catches the "selects from polls then filters by status" pattern.
        const pattern = /from\(\s*['"]polls['"]\s*\)[\s\S]{0,500}\.eq\(\s*['"]status['"]/
        if (pattern.test(src)) {
          offenders.push(rel)
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `polls.status filter in non-admin code path (cross-AI MEDIUM #5):\n` +
          offenders.map((o) => `  - ${o}`).join('\n') +
          `\nFix: read from polls_effective which already carries the effective status column.`,
      )
    }
    expect(offenders).toEqual([])
  })
})
