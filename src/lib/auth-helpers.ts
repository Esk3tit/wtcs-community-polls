import { supabase } from '@/lib/supabase'

export type AuthCallbackResult =
  | { success: true }
  | { success: false; reason: 'auth-failed' | '2fa-required' }

/**
 * Handles the OAuth callback flow with FAIL-CLOSED 2FA verification.
 * Extracted from the route component so tests can exercise the real logic.
 *
 * Flow:
 * 1. Get session (Supabase processes OAuth code from URL)
 * 2. Check provider_token exists (FAIL CLOSED if missing)
 * 3. Call Discord API to verify mfa_enabled (FAIL CLOSED on any error)
 * 4. Call update_profile_after_auth RPC to set mfa_verified server-side (R2 fix)
 * 5. Return success or failure reason
 */
export async function handleAuthCallback(): Promise<AuthCallbackResult> {
  try {
    // Step 1: Get the session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      await supabase.auth.signOut()
      return { success: false, reason: 'auth-failed' }
    }

    // Step 2: Get the provider_token (Discord access token)
    // ONLY available on initial sign-in, NOT on subsequent getSession calls.
    const providerToken = session.provider_token

    // ============================================================
    // FAIL-CLOSED: If provider_token is missing, we CANNOT verify 2FA.
    // We MUST reject the login rather than allowing unverified users.
    //
    // If PKCE flow consistently fails to provide provider_token,
    // switch to flowType: 'implicit' in supabase.ts.
    // The spike in Task 1 should have verified this works.
    // ============================================================
    if (!providerToken) {
      console.error('provider_token is null. Cannot verify Discord 2FA. Failing closed.')
      await supabase.auth.signOut()
      return { success: false, reason: 'auth-failed' }
    }

    // Step 3: Call Discord API to check 2FA status
    let discordUser: {
      mfa_enabled?: boolean
      id?: string
      username?: string
      global_name?: string
      avatar?: string | null
    } | null = null

    try {
      const discordResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${providerToken}` },
      })

      if (!discordResponse.ok) {
        console.error('Discord API error:', discordResponse.status, discordResponse.statusText)
        await supabase.auth.signOut()
        return { success: false, reason: 'auth-failed' }
      }

      discordUser = await discordResponse.json()
    } catch (fetchError) {
      console.error('Failed to reach Discord API:', fetchError)
      await supabase.auth.signOut()
      return { success: false, reason: 'auth-failed' }
    }

    // Step 4: Check mfa_enabled -- FAIL CLOSED on false, null, or undefined
    if (!discordUser?.mfa_enabled) {
      await supabase.auth.signOut()
      return { success: false, reason: '2fa-required' }
    }

    // Step 5: Update profile via RPC (R2 fix: NOT direct profile update)
    // The update_profile_after_auth function is SECURITY DEFINER and sets
    // mfa_verified server-side. This bypasses the profile_self_update_allowed
    // trigger that blocks client-side mfa_verified changes.
    const avatarUrl = discordUser.avatar && discordUser.id
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null

    const { error: rpcError } = await supabase.rpc('update_profile_after_auth', {
      p_mfa_verified: true,
      p_discord_username: discordUser.global_name || discordUser.username || 'Unknown',
      p_avatar_url: avatarUrl ?? '',
    })

    // R2 FIX: Check RPC result. If it fails, log but still allow login.
    // Rationale: The 2FA check succeeded (mfa_enabled=true from Discord).
    // A profile sync failure means stale display data, not a security issue.
    // The mfa_verified flag may not be set, but the user WAS verified this session.
    if (rpcError) {
      console.error('Profile update RPC failed:', rpcError.message)
      // Do NOT sign out -- the user's 2FA was verified. Profile data is stale but not a blocker.
    }

    return { success: true }
  } catch (err) {
    // Catch-all: any unexpected error -- FAIL CLOSED
    console.error('Auth callback error:', err)
    try {
      await supabase.auth.signOut()
    } catch {
      // Sign out itself failed -- still return error
    }
    return { success: false, reason: 'auth-failed' }
  }
}
