import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase module BEFORE importing handleAuthCallback
const mockGetSession = vi.fn()
const mockSignOut = vi.fn().mockResolvedValue({ error: null })
const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null })

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithOAuth: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
  typedRpc: (...args: unknown[]) => mockRpc(...args),
}))

// R2 FIX: Import the REAL handleAuthCallback function.
// This is the actual production code from auth-helpers.ts, not a reimplementation.
// The mocked supabase module above controls its dependencies.
import { handleAuthCallback } from '@/lib/auth-helpers'

describe('Auth Callback: Fail-Closed Behavior (REAL handleAuthCallback)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({ error: null })
    mockRpc.mockResolvedValue({ data: null, error: null })
  })

  it('rejects when session is null', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

    const result = await handleAuthCallback()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.reason).toBe('auth-failed')
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('rejects when getSession returns error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: new Error('session error') })

    const result = await handleAuthCallback()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.reason).toBe('auth-failed')
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('FAIL-CLOSED: rejects when provider_token is missing', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: 'u1' }, provider_token: null } },
    })

    const result = await handleAuthCallback()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.reason).toBe('auth-failed')
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('FAIL-CLOSED: rejects when Discord API returns error status', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: 'u1' }, provider_token: 'discord-token' } },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    }))

    const result = await handleAuthCallback()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.reason).toBe('auth-failed')
    expect(mockSignOut).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('FAIL-CLOSED: rejects when Discord API network error', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: 'u1' }, provider_token: 'discord-token' } },
    })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const result = await handleAuthCallback()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.reason).toBe('auth-failed')
    expect(mockSignOut).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('FAIL-CLOSED: rejects when mfa_enabled is false', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: 'u1' }, provider_token: 'discord-token' } },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ mfa_enabled: false, id: '999', username: 'NoMFA' }),
    }))

    const result = await handleAuthCallback()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.reason).toBe('2fa-required')
    expect(mockSignOut).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('FAIL-CLOSED: rejects when mfa_enabled is null/undefined', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: 'u1' }, provider_token: 'discord-token' } },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: '999', username: 'NoField' }),
    }))

    const result = await handleAuthCallback()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.reason).toBe('2fa-required')
    expect(mockSignOut).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('allows login when mfa_enabled is true', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: 'u1' }, provider_token: 'discord-token' } },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'MFAUser', global_name: 'MFA User', avatar: 'abc123' }),
    }))

    const result = await handleAuthCallback()

    expect(result.success).toBe(true)
    expect(mockSignOut).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('calls Discord API with provider_token as Bearer', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ mfa_enabled: true, id: '999' }),
    })

    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: 'u1' }, provider_token: 'my-discord-token' } },
    })

    vi.stubGlobal('fetch', mockFetch)

    await handleAuthCallback()

    expect(mockFetch).toHaveBeenCalledWith(
      'https://discord.com/api/users/@me',
      { headers: { Authorization: 'Bearer my-discord-token' } }
    )

    vi.unstubAllGlobals()
  })

  it('R2: calls update_profile_after_auth RPC (not direct profile update)', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: 'u1' }, provider_token: 'discord-token' } },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'RPCUser', global_name: 'RPC User', avatar: 'abc' }),
    }))

    await handleAuthCallback()

    expect(mockRpc).toHaveBeenCalledWith('update_profile_after_auth', {
      p_mfa_verified: true,
      p_discord_username: 'RPC User',
      p_avatar_url: 'https://cdn.discordapp.com/avatars/999/abc.png',
    })

    vi.unstubAllGlobals()
  })

  it('R2: still succeeds when RPC returns error (profile sync is non-fatal)', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: 'u1' }, provider_token: 'discord-token' } },
    })
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Profile not found' } })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'User' }),
    }))

    const result = await handleAuthCallback()

    // Login should still succeed -- 2FA was verified, profile sync is non-fatal
    expect(result.success).toBe(true)
    expect(mockSignOut).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})
