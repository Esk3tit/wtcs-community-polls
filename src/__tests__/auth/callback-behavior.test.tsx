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
}))

// Import the real handleAuthCallback — mocked supabase module above controls its dependencies.
import { handleAuthCallback, __resetAuthCallbackCacheForTests } from '@/lib/auth-helpers'

const WTCS_GUILD_ID = '123456789'

/** Helper: create a URL-aware fetch mock that responds differently for /users/@me vs /users/@me/guilds */
function createGuildAwareFetchMock(
  userResponse: { ok: boolean; json?: () => Promise<unknown>; status?: number; statusText?: string },
  guildsResponse?: { ok: boolean; json?: () => Promise<unknown>; status?: number; statusText?: string } | 'throw',
) {
  return vi.fn((url: string) => {
    if (url === 'https://discord.com/api/users/@me/guilds') {
      if (guildsResponse === 'throw') {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve(guildsResponse ?? { ok: true, json: () => Promise.resolve([{ id: WTCS_GUILD_ID }]) })
    }
    // Default: /users/@me
    return Promise.resolve(userResponse)
  })
}

describe('Auth Callback: Fail-Closed Behavior (REAL handleAuthCallback)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Phase 6 WR-07: clear the result-memo TTL so prior-test results don't leak
    __resetAuthCallbackCacheForTests()
    mockSignOut.mockResolvedValue({ error: null })
    mockRpc.mockResolvedValue({ data: null, error: null })
    // Set WTCS guild ID for tests
    import.meta.env.VITE_WTCS_GUILD_ID = WTCS_GUILD_ID
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

    const mockFetch = createGuildAwareFetchMock(
      { ok: true, json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'MFAUser', global_name: 'MFA User', avatar: 'abc123' }) },
      { ok: true, json: () => Promise.resolve([{ id: WTCS_GUILD_ID }]) },
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await handleAuthCallback()

    expect(result.success).toBe(true)
    expect(mockSignOut).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('calls Discord API with provider_token as Bearer', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: 'u1' }, provider_token: 'my-discord-token' } },
    })

    const mockFetch = createGuildAwareFetchMock(
      { ok: true, json: () => Promise.resolve({ mfa_enabled: true, id: '999' }) },
      { ok: true, json: () => Promise.resolve([{ id: WTCS_GUILD_ID }]) },
    )
    vi.stubGlobal('fetch', mockFetch)

    await handleAuthCallback()

    expect(mockFetch).toHaveBeenCalledWith(
      'https://discord.com/api/users/@me',
      { headers: { Authorization: 'Bearer my-discord-token' } }
    )

    vi.unstubAllGlobals()
  })

  it('calls update_profile_after_auth RPC (not direct profile update)', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: 'u1' }, provider_token: 'discord-token' } },
    })

    const mockFetch = createGuildAwareFetchMock(
      { ok: true, json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'RPCUser', global_name: 'RPC User', avatar: 'abc' }) },
      { ok: true, json: () => Promise.resolve([{ id: WTCS_GUILD_ID }]) },
    )
    vi.stubGlobal('fetch', mockFetch)

    await handleAuthCallback()

    expect(mockRpc).toHaveBeenCalledWith('update_profile_after_auth', {
      p_mfa_verified: true,
      p_discord_username: 'RPC User',
      p_avatar_url: 'https://cdn.discordapp.com/avatars/999/abc.png',
      p_guild_member: true,
    })

    vi.unstubAllGlobals()
  })

  it('FAIL-CLOSED: rejects when RPC returns error (profile sync failure blocks login)', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: 'u1' }, provider_token: 'discord-token' } },
    })
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Profile not found' } })

    const mockFetch = createGuildAwareFetchMock(
      { ok: true, json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'User' }) },
      { ok: true, json: () => Promise.resolve([{ id: WTCS_GUILD_ID }]) },
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await handleAuthCallback()

    // RPC failure must fail closed — user is signed out
    expect(result.success).toBe(false)
    if (!result.success) expect(result.reason).toBe('auth-failed')
    expect(mockSignOut).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})

describe('Auth Callback: Guild Membership Check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Phase 6 WR-07: clear the result-memo TTL so prior-test results don't leak
    __resetAuthCallbackCacheForTests()
    mockSignOut.mockResolvedValue({ error: null })
    mockRpc.mockResolvedValue({ data: null, error: null })
    import.meta.env.VITE_WTCS_GUILD_ID = WTCS_GUILD_ID
  })

  /** Standard session setup for guild tests (mfa passes) */
  function setupSessionWithToken() {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: 'u1' }, provider_token: 'discord-token' } },
    })
  }

  it('rejects when user is not in WTCS guild', async () => {
    setupSessionWithToken()

    const mockFetch = createGuildAwareFetchMock(
      { ok: true, json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'User' }) },
      { ok: true, json: () => Promise.resolve([{ id: '999999' }]) },
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await handleAuthCallback()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.reason).toBe('not-in-server')
    expect(mockSignOut).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('passes when user is in WTCS guild', async () => {
    setupSessionWithToken()

    const mockFetch = createGuildAwareFetchMock(
      { ok: true, json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'User' }) },
      { ok: true, json: () => Promise.resolve([{ id: WTCS_GUILD_ID }]) },
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await handleAuthCallback()

    expect(result.success).toBe(true)
    expect(mockSignOut).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('fails closed when guilds API returns non-ok response', async () => {
    setupSessionWithToken()

    const mockFetch = createGuildAwareFetchMock(
      { ok: true, json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'User' }) },
      { ok: false, status: 403, json: () => Promise.resolve({ message: 'Forbidden' }) },
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await handleAuthCallback()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.reason).toBe('auth-failed')
    expect(mockSignOut).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('fails closed when guilds API throws network error', async () => {
    setupSessionWithToken()

    const mockFetch = createGuildAwareFetchMock(
      { ok: true, json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'User' }) },
      'throw',
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await handleAuthCallback()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.reason).toBe('auth-failed')
    expect(mockSignOut).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('fails closed when guilds API returns malformed JSON (not an array)', async () => {
    setupSessionWithToken()

    const mockFetch = createGuildAwareFetchMock(
      { ok: true, json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'User' }) },
      { ok: true, json: () => Promise.resolve({ message: 'error' }) },
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await handleAuthCallback()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.reason).toBe('auth-failed')
    expect(mockSignOut).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('rejects when guilds API returns empty array (user in zero servers)', async () => {
    setupSessionWithToken()

    const mockFetch = createGuildAwareFetchMock(
      { ok: true, json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'User' }) },
      { ok: true, json: () => Promise.resolve([]) },
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await handleAuthCallback()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.reason).toBe('not-in-server')

    vi.unstubAllGlobals()
  })

  it('calls guilds API with Bearer provider token', async () => {
    setupSessionWithToken()

    const mockFetch = createGuildAwareFetchMock(
      { ok: true, json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'User' }) },
      { ok: true, json: () => Promise.resolve([{ id: WTCS_GUILD_ID }]) },
    )
    vi.stubGlobal('fetch', mockFetch)

    await handleAuthCallback()

    expect(mockFetch).toHaveBeenCalledWith(
      'https://discord.com/api/users/@me/guilds',
      { headers: { Authorization: 'Bearer discord-token' } }
    )

    vi.unstubAllGlobals()
  })

  it('passes p_guild_member=true to RPC on success', async () => {
    setupSessionWithToken()

    const mockFetch = createGuildAwareFetchMock(
      { ok: true, json: () => Promise.resolve({ mfa_enabled: true, id: '999', username: 'User', global_name: 'Test User', avatar: 'abc' }) },
      { ok: true, json: () => Promise.resolve([{ id: WTCS_GUILD_ID }]) },
    )
    vi.stubGlobal('fetch', mockFetch)

    await handleAuthCallback()

    expect(mockRpc).toHaveBeenCalledWith('update_profile_after_auth', expect.objectContaining({
      p_guild_member: true,
    }))

    vi.unstubAllGlobals()
  })
})
