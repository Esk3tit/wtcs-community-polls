import { supabase } from '@/lib/supabase'

export type AuthCallbackResult =
  | { success: true }
  | { success: false; reason: 'auth-failed' | '2fa-required' | 'not-in-server' }

/**
 * Verifies Discord 2FA and syncs profile after OAuth sign-in.
 * Called from onAuthStateChange when SIGNED_IN fires with a provider_token.
 *
 * FAIL-CLOSED: If provider_token is missing, Discord API fails, or
 * mfa_enabled is false/missing, the user is signed out immediately.
 */
// Deduplication guard: shared-promise pattern ensures concurrent callers
// (AuthContext onAuthStateChange + callback route) get the same result
// without double-executing verification
let callbackPromise: Promise<AuthCallbackResult> | null = null

export async function handleAuthCallback(): Promise<AuthCallbackResult> {
  if (callbackPromise) return callbackPromise
  callbackPromise = executeAuthCallback()
  try {
    return await callbackPromise
  } finally {
    callbackPromise = null
  }
}

async function executeAuthCallback(): Promise<AuthCallbackResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      await supabase.auth.signOut()
      return { success: false, reason: 'auth-failed' }
    }

    const providerToken = session.provider_token

    // FAIL-CLOSED: No provider_token means we can't verify 2FA
    if (!providerToken) {
      console.error('provider_token is null. Cannot verify Discord 2FA. Failing closed.')
      await supabase.auth.signOut()
      return { success: false, reason: 'auth-failed' }
    }

    // Call Discord API to check 2FA status
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

    // FAIL-CLOSED: mfa_enabled must be true
    if (!discordUser?.mfa_enabled) {
      await supabase.auth.signOut()
      return { success: false, reason: '2fa-required' }
    }

    // Check Discord server membership via guilds endpoint
    // Handles API error, network error, malformed response, and empty guild list
    let guilds: Array<{ id: string }>
    try {
      const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${providerToken}` },
      })

      if (!guildsResponse.ok) {
        console.error('Discord guilds API error:', guildsResponse.status)
        await supabase.auth.signOut()
        return { success: false, reason: 'auth-failed' }
      }

      const guildsData: unknown = await guildsResponse.json()

      // Guard against malformed response (non-array)
      if (!Array.isArray(guildsData)) {
        console.error('Discord guilds API returned non-array:', typeof guildsData)
        await supabase.auth.signOut()
        return { success: false, reason: 'auth-failed' }
      }

      guilds = guildsData as Array<{ id: string }>
    } catch (guildsError) {
      console.error('Failed to check Discord guild membership:', guildsError)
      await supabase.auth.signOut()
      return { success: false, reason: 'auth-failed' }
    }

    const WTCS_GUILD_ID = import.meta.env.VITE_WTCS_GUILD_ID
    if (!WTCS_GUILD_ID) {
      console.error('VITE_WTCS_GUILD_ID is not configured. All guild membership checks will fail.')
      await supabase.auth.signOut()
      return { success: false, reason: 'auth-failed' }
    }

    const isMember = guilds.some(g => g.id === WTCS_GUILD_ID)

    if (!isMember) {
      await supabase.auth.signOut()
      return { success: false, reason: 'not-in-server' }
    }

    // Update profile via RPC (SECURITY DEFINER — sets mfa_verified server-side)
    const avatarUrl = discordUser.avatar && discordUser.id
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null

    const { error: rpcError } = await supabase.rpc('update_profile_after_auth', {
      p_mfa_verified: true,
      p_discord_username: discordUser.global_name || discordUser.username || 'Unknown',
      p_avatar_url: avatarUrl ?? '',
      p_guild_member: true,
    })

    if (rpcError) {
      console.error('Profile update RPC failed:', rpcError.message)
      await supabase.auth.signOut()
      return { success: false, reason: 'auth-failed' }
    }

    return { success: true }
  } catch (err) {
    console.error('Auth callback error:', err)
    try {
      await supabase.auth.signOut()
    } catch {
      // Sign out itself failed
    }
    return { success: false, reason: 'auth-failed' }
  }
}
