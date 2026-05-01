/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../supabase/migrations/00000000000005_admin_phase4.sql',
)

describe('admin migration 00000000000005', () => {
  it('exists', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
  })

  const sql = existsSync(MIGRATION_PATH)
    ? readFileSync(MIGRATION_PATH, 'utf-8')
    : ''

  it('defines polls_effective view with lazy-close CASE and raw_status passthrough', () => {
    expect(sql).toMatch(/CREATE OR REPLACE VIEW\s+public\.polls_effective/i)
    expect(sql).toMatch(
      /CASE\s+WHEN\s+status\s*=\s*'active'\s+AND\s+closes_at\s*<\s*now\(\)\s+THEN\s+'closed'/i,
    )
    expect(sql).toMatch(/status\s+AS\s+raw_status/i)
    expect(sql).toMatch(
      /ALTER VIEW\s+public\.polls_effective\s+SET\s*\(\s*security_invoker\s*=\s*on\s*\)/i,
    )
  })

  it('defines is_current_user_admin() as SECURITY DEFINER STABLE with search_path', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.is_current_user_admin\(\)/i,
    )
    expect(sql).toMatch(/SECURITY DEFINER/i)
    expect(sql).toMatch(/\bSTABLE\b/i)
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.is_current_user_admin\(\)[\s\S]*SET\s+search_path\s*=\s*public/i,
    )
  })

  it('replaces votes SELECT policy with admin-bypass branch', () => {
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS "Users can view own votes" ON public\.votes/i,
    )
    expect(sql).toMatch(
      /CREATE POLICY "Users can view own votes or admin"\s+ON public\.votes/i,
    )
    expect(sql).toMatch(/OR\s+public\.is_current_user_admin\(\)/i)
  })

  it('replaces vote_counts SELECT policy with admin-bypass branch', () => {
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS "Vote counts visible to voters" ON public\.vote_counts/i,
    )
    expect(sql).toMatch(
      /CREATE POLICY "Vote counts visible to voters or admin"\s+ON public\.vote_counts/i,
    )
    expect(sql).toMatch(/OR\s+public\.is_current_user_admin\(\)/i)
  })

  it('defines create_poll_with_choices RPC with 7 params and 2..10 choice guard', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.create_poll_with_choices/i,
    )
    expect(sql).toMatch(/p_title TEXT/)
    expect(sql).toMatch(/p_description TEXT/)
    expect(sql).toMatch(/p_category_id UUID/)
    expect(sql).toMatch(/p_image_url TEXT/)
    expect(sql).toMatch(/p_closes_at TIMESTAMPTZ/)
    expect(sql).toMatch(/p_created_by UUID/)
    expect(sql).toMatch(/p_choices TEXT\[\]/)
    expect(sql).toMatch(
      /array_length\(p_choices, 1\) < 2 OR array_length\(p_choices, 1\) > 10/,
    )
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.create_poll_with_choices[\s\S]*SET\s+search_path\s*=\s*public/i,
    )
  })

  it('defines update_poll_with_choices RPC transactionally', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.update_poll_with_choices/i,
    )
    expect(sql).toMatch(/p_poll_id UUID/)
    expect(sql).toMatch(/p_title TEXT/)
    expect(sql).toMatch(/p_description TEXT/)
    expect(sql).toMatch(/p_category_id UUID/)
    expect(sql).toMatch(/p_image_url TEXT/)
    expect(sql).toMatch(/p_closes_at TIMESTAMPTZ/)
    expect(sql).toMatch(/p_choices TEXT\[\]/)
    // The RPC body must contain both UPDATE polls and DELETE/INSERT choices inside a single plpgsql block
    expect(sql).toMatch(/UPDATE\s+public\.polls[\s\S]*WHERE\s+id\s*=\s*p_poll_id/i)
    expect(sql).toMatch(
      /DELETE\s+FROM\s+public\.choices[\s\S]*WHERE\s+poll_id\s*=\s*p_poll_id/i,
    )
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.choices/i)
    // 2..10 guard
    expect(sql).toMatch(
      /array_length\(p_choices, 1\) < 2 OR array_length\(p_choices, 1\) > 10/,
    )
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.update_poll_with_choices[\s\S]*SET\s+search_path\s*=\s*public/i,
    )
  })

  it('creates poll-images public bucket with size + mime allowlist', () => {
    expect(sql).toMatch(/INSERT INTO storage\.buckets/i)
    expect(sql).toMatch(/'poll-images'/)
    expect(sql).toMatch(/2\s*\*\s*1024\s*\*\s*1024/)
    expect(sql).toMatch(/'image\/jpeg'/)
    expect(sql).toMatch(/'image\/png'/)
    expect(sql).toMatch(/'image\/webp'/)
    expect(sql).toMatch(/ON CONFLICT \(id\) DO NOTHING/i)
  })

  it('seeds admin discord IDs with ON CONFLICT DO NOTHING', () => {
    expect(sql).toMatch(/INSERT INTO public\.admin_discord_ids/i)
    expect(sql).toContain("'267747104607305738'")
    expect(sql).toContain("'290377966251409410'")
    expect(sql).toMatch(/ON CONFLICT \(discord_id\) DO NOTHING/i)
  })

  it('retroactively flips existing profile rows for seeded admins', () => {
    expect(sql).toMatch(
      /UPDATE public\.profiles[\s\S]*SET is_admin\s*=\s*true[\s\S]*FROM public\.admin_discord_ids/i,
    )
  })

  it('references is_current_user_admin at least 3 times (definition + 2 policies)', () => {
    const count = (sql.match(/is_current_user_admin/g) ?? []).length
    expect(count).toBeGreaterThanOrEqual(3)
  })
})

// Migration 6 replaces update_poll_with_choices to raise stable SQLSTATE
// codes instead of free-form strings. The Edge Function matches on these
// codes; both sides must stay in sync.
const MIGRATION6_PATH = resolve(
  __dirname,
  '../../../supabase/migrations/00000000000006_update_poll_rpc_error_codes.sql',
)

describe('update_poll_with_choices error-code migration', () => {
  it('exists', () => {
    expect(existsSync(MIGRATION6_PATH)).toBe(true)
  })

  const sql6 = existsSync(MIGRATION6_PATH)
    ? readFileSync(MIGRATION6_PATH, 'utf-8')
    : ''

  it('redefines update_poll_with_choices (CREATE OR REPLACE)', () => {
    expect(sql6).toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.update_poll_with_choices/i,
    )
  })

  it('raises P0003 for responses-already-received (edit lock)', () => {
    expect(sql6).toMatch(/responses already received[\s\S]*ERRCODE\s*=\s*'P0003'/i)
  })

  it('raises P0002 for Poll not found', () => {
    expect(sql6).toMatch(/Poll not found[\s\S]*ERRCODE\s*=\s*'P0002'/i)
  })

  it('raises P0004 for choice count out of range', () => {
    expect(sql6).toMatch(/Choices must be between[\s\S]*ERRCODE\s*=\s*'P0004'/i)
  })

  it('preserves the 2..10 choice guard', () => {
    expect(sql6).toMatch(
      /array_length\(p_choices, 1\) < 2 OR array_length\(p_choices, 1\) > 10/,
    )
  })

  it('preserves the defense-in-depth EXISTS votes re-check', () => {
    expect(sql6).toMatch(/EXISTS\s*\(\s*SELECT 1 FROM public\.votes/i)
  })
})

// Migration 7 applies cardinality(), service-role-only EXECUTE,
// FOR UPDATE serialization lock, and bucket ON CONFLICT DO UPDATE.
const MIGRATION7_PATH = resolve(
  __dirname,
  '../../../supabase/migrations/00000000000007_fix_pr_review.sql',
)

describe('admin migration 00000000000007 hardening', () => {
  it('exists', () => {
    expect(existsSync(MIGRATION7_PATH)).toBe(true)
  })

  const sql7 = existsSync(MIGRATION7_PATH)
    ? readFileSync(MIGRATION7_PATH, 'utf-8')
    : ''

  it('uses cardinality() in both poll RPC choice guards', () => {
    expect(sql7).toMatch(/CREATE OR REPLACE FUNCTION\s+public\.create_poll_with_choices[\s\S]*cardinality\(p_choices\)/i)
    expect(sql7).toMatch(/CREATE OR REPLACE FUNCTION\s+public\.update_poll_with_choices[\s\S]*cardinality\(p_choices\)/i)
  })

  it('restricts both RPCs to service_role only', () => {
    expect(sql7).toMatch(/REVOKE EXECUTE ON FUNCTION\s+public\.create_poll_with_choices[\s\S]*FROM PUBLIC, anon, authenticated/i)
    expect(sql7).toMatch(/GRANT EXECUTE ON FUNCTION\s+public\.create_poll_with_choices[\s\S]*TO service_role/i)
    expect(sql7).toMatch(/REVOKE EXECUTE ON FUNCTION\s+public\.update_poll_with_choices[\s\S]*FROM PUBLIC, anon, authenticated/i)
    expect(sql7).toMatch(/GRANT EXECUTE ON FUNCTION\s+public\.update_poll_with_choices[\s\S]*TO service_role/i)
  })

  it('locks current choices before the votes EXISTS check', () => {
    expect(sql7).toMatch(/FROM public\.choices[\s\S]*FOR UPDATE[\s\S]*IF EXISTS \(SELECT 1 FROM public\.votes/i)
  })

  it('converges the poll-images bucket with DO UPDATE', () => {
    expect(sql7).toMatch(/INSERT INTO storage\.buckets/i)
    expect(sql7).toMatch(/ON CONFLICT \(id\) DO UPDATE/i)
  })
})
