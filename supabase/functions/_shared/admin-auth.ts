import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type AdminCheckResult = { ok: true } | { ok: false; reason: string }

/**
 * Centralizes the admin gate so every Edge Function reuses the same check.
 * Uses the service-role client so the read bypasses RLS.
 *
 * Returns:
 *   { ok: true }                                — all checks passed
 *   { ok: false, reason: 'profile_not_found' } — no profile row for this user
 *   { ok: false, reason: 'not_admin' }         — profile exists but is_admin is false
 *   { ok: false, reason: 'integrity_failed' }  — admin lost MFA or guild membership
 *   { ok: false, reason: 'query_failed' }      — Supabase query transport/schema error
 *
 * Defense-in-depth: an admin who lost MFA/guild membership shouldn't be privileged.
 */
export async function requireAdmin(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<AdminCheckResult> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('is_admin, guild_member, mfa_verified')
    .eq('id', userId)
    .single()
  if (error) {
    // PGRST116 = "JSON object requested, multiple (or no) rows returned" — i.e. no row
    if (error.code === 'PGRST116') return { ok: false, reason: 'profile_not_found' }
    return { ok: false, reason: 'query_failed' }
  }
  if (!profile) return { ok: false, reason: 'profile_not_found' }
  if (!profile.is_admin) return { ok: false, reason: 'not_admin' }
  if (!profile.mfa_verified || !profile.guild_member) {
    return { ok: false, reason: 'integrity_failed' }
  }
  return { ok: true }
}

/**
 * Maps a failed AdminCheckResult to an HTTP status + message pair.
 * 'query_failed' -> 500 (backend fault), everything else -> 403 (authz).
 */
export function adminCheckResponse(result: AdminCheckResult): { status: number; error: string } {
  if (result.ok) return { status: 200, error: '' }
  if (result.reason === 'query_failed') return { status: 500, error: 'Internal error' }
  return { status: 403, error: 'Forbidden' }
}
