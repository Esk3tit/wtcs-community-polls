import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAuth } from '@/hooks/useAuth'

const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockSignOut = vi.fn()
const mockSignInWithOAuth = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

function AuthConsumer() {
  const { user, profile, loading, isAdmin } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user-id">{user?.id ?? 'null'}</span>
      <span data-testid="profile-name">{profile?.discord_username ?? 'null'}</span>
      <span data-testid="is-admin">{String(isAdmin)}</span>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })
  })

  it('shows loading=true initially then resolves to false', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('user-id').textContent).toBe('null')
  })

  it('populates user and profile when session exists', async () => {
    const mockSession = {
      access_token: 'test-jwt',
      user: { id: 'user-123', email: 'test@discord.com' },
    }
    const mockProfile = {
      id: 'user-123',
      discord_id: '999',
      discord_username: 'TestUser',
      avatar_url: null,
      is_admin: false,
      mfa_verified: true,
      created_at: '',
      updated_at: '',
    }

    mockGetSession.mockResolvedValue({ data: { session: mockSession } })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
        }),
      }),
    })

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('user-id').textContent).toBe('user-123')
    expect(screen.getByTestId('profile-name').textContent).toBe('TestUser')
  })

  it('shows isAdmin=true when profile has is_admin flag', async () => {
    const mockSession = {
      access_token: 'test-jwt',
      user: { id: 'admin-456' },
    }
    const mockAdminProfile = {
      id: 'admin-456',
      discord_id: '111',
      discord_username: 'AdminUser',
      avatar_url: null,
      is_admin: true,
      mfa_verified: true,
      created_at: '',
      updated_at: '',
    }

    mockGetSession.mockResolvedValue({ data: { session: mockSession } })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
        }),
      }),
    })

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-admin').textContent).toBe('true')
    })
  })

  it('clears user and profile after signOut', async () => {
    const mockSession = {
      access_token: 'test-jwt',
      user: { id: 'user-123' },
    }

    mockGetSession.mockResolvedValue({ data: { session: mockSession } })
    mockSignOut.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-123', discord_id: '999', discord_username: 'Test', avatar_url: null, is_admin: false, mfa_verified: true, created_at: '', updated_at: '' },
            error: null,
          }),
        }),
      }),
    })

    function SignOutButton() {
      const { signOut, user } = useAuth()
      return (
        <>
          <span data-testid="has-user">{user ? 'yes' : 'no'}</span>
          <button data-testid="sign-out" onClick={signOut}>Sign Out</button>
        </>
      )
    }

    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-user').textContent).toBe('yes')
    })

    await act(async () => {
      screen.getByTestId('sign-out').click()
    })

    expect(mockSignOut).toHaveBeenCalledOnce()
    expect(screen.getByTestId('has-user').textContent).toBe('no')
  })

  it('calls signInWithOAuth with discord provider on signInWithDiscord', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null })

    function LoginButton() {
      const { signInWithDiscord } = useAuth()
      return <button data-testid="login" onClick={signInWithDiscord}>Login</button>
    }

    render(
      <AuthProvider>
        <LoginButton />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('login')).toBeInTheDocument()
    })

    await act(async () => {
      screen.getByTestId('login').click()
    })

    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'discord',
        options: expect.objectContaining({
          scopes: 'identify email guilds',
        }),
      })
    )
  })
})
