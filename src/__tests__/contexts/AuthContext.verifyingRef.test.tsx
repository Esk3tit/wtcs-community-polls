// Integration tests for the AuthContext verifyingRef gate — the gate
// gives the OAuth redirect path exclusive control of session state until
// the provider_token has been verified, preventing transient state from
// being committed before verification finishes.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

const {
  mockGetSession,
  mockOnAuthStateChange,
  mockSignOut,
  mockHandleAuthCallback,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSignOut: vi.fn(),
  mockHandleAuthCallback: vi.fn(),
}))

vi.mock('@/lib/posthog', () => ({
  posthog: {
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
  initPostHog: vi.fn(),
}))
vi.mock('@/lib/sentry', () => ({
  loadSentryReplayIfConsented: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      signInWithOAuth: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  },
}))

vi.mock('@/lib/auth-helpers', () => ({
  handleAuthCallback: (...args: unknown[]) => mockHandleAuthCallback(...args),
}))

import { AuthProvider } from '@/contexts/AuthContext'
import { ConsentProvider } from '@/contexts/ConsentContext'
import { useAuth } from '@/hooks/useAuth'

type AuthCallback = (event: AuthChangeEvent, session: Session | null) => Promise<void> | void

function harness(children: ReactNode) {
  return (
    <ConsentProvider>
      <AuthProvider>{children}</AuthProvider>
    </ConsentProvider>
  )
}

function AuthDebug() {
  const { user, loading } = useAuth()
  return (
    <>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user-id">{user?.id ?? 'null'}</span>
    </>
  )
}

describe('AuthContext verifyingRef gate', () => {
  let originalHash: string
  let lastAuthCallback: AuthCallback | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    originalHash = window.location.hash
    lastAuthCallback = null

    mockOnAuthStateChange.mockImplementation((cb: AuthCallback) => {
      lastAuthCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockSignOut.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    // Restore window.location.hash so tests can't pollute siblings.
    if (window.location.hash !== originalHash) {
      window.location.hash = originalHash
    }
  })

  it('isOAuthRedirect=true (hash with access_token) → getSession shortcut is skipped, loading stays true', async () => {
    window.location.hash = '#access_token=fake-token&token_type=bearer'

    render(harness(<AuthDebug />))

    // The auth-subscription effect should have subscribed but NOT called
    // getSession (the OAuth-redirect path skips it intentionally).
    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1)
    })
    expect(mockGetSession).not.toHaveBeenCalled()

    // loading remains true because verifyingRef is initialized to true and
    // no SIGNED_IN event has fired yet.
    expect(screen.getByTestId('loading').textContent).toBe('true')
    expect(screen.getByTestId('user-id').textContent).toBe('null')
  })

  it('SIGNED_IN without provider_token while verifyingRef=true releases the gate', async () => {
    window.location.hash = '#access_token=fake-token&token_type=bearer'

    render(harness(<AuthDebug />))
    await waitFor(() => expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1))
    expect(mockHandleAuthCallback).not.toHaveBeenCalled()

    // SIGNED_IN with no provider_token must release the gate so the
    // session/user populate normally on the next pass.
    const sessionWithoutProviderToken = {
      access_token: 'sb-token',
      refresh_token: 'sb-refresh',
      expires_at: 9999999999,
      provider_token: null,
      user: { id: 'u-no-provider-token', user_metadata: {}, app_metadata: {} },
    } as unknown as Session

    await act(async () => {
      await lastAuthCallback?.('SIGNED_IN' as AuthChangeEvent, sessionWithoutProviderToken)
    })

    // handleAuthCallback must NOT be invoked (no provider_token to verify).
    expect(mockHandleAuthCallback).not.toHaveBeenCalled()

    // The gate released, so user state should now reflect the session.
    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('u-no-provider-token')
    })
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
  })

  it('SIGNED_IN with provider_token while verifying invokes handleAuthCallback exactly once and resumes state on success', async () => {
    window.location.hash = '#access_token=fake-token&token_type=bearer'

    // Resolvable handle so we can hold verification "in flight" and assert
    // state-suppression mid-await.
    let resolveCallback!: (v: { success: true } | { success: false; reason: string }) => void
    mockHandleAuthCallback.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCallback = resolve as typeof resolveCallback
        }),
    )

    render(harness(<AuthDebug />))
    await waitFor(() => expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1))

    const sessionWithProviderToken = {
      access_token: 'sb-token',
      refresh_token: 'sb-refresh',
      expires_at: 9999999999,
      provider_token: 'discord-token',
      user: {
        id: 'u-verifying',
        user_metadata: { provider_id: 'discord-99999' },
        app_metadata: { provider: 'discord' },
      },
    } as unknown as Session

    // Fire SIGNED_IN — fire-and-forget; we resolve verification later.
    let callbackPromise: Promise<unknown> | undefined
    await act(async () => {
      callbackPromise = Promise.resolve(
        lastAuthCallback?.('SIGNED_IN' as AuthChangeEvent, sessionWithProviderToken),
      )
      // yield so handleAuthCallback gets called inside the await
      await Promise.resolve()
    })

    // While the verification promise is pending, state must NOT update.
    expect(mockHandleAuthCallback).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('user-id').textContent).toBe('null')
    expect(screen.getByTestId('loading').textContent).toBe('true')

    // Resolve verification successfully.
    await act(async () => {
      resolveCallback({ success: true })
      await callbackPromise
    })

    // handleAuthCallback was invoked exactly once for this event.
    expect(mockHandleAuthCallback).toHaveBeenCalledTimes(1)

    // Post-resolution: gate releases (finally { verifyingRef.current = false }),
    // then setSession/setUser run and fetchProfile().then(setLoading(false))
    // chain completes. Asserts the full success-path state-update tail, not
    // just the in-flight suppression.
    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('u-verifying')
    })
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
  })
})

describe('handleAuthCallback dedup across rapid /auth/callback double-mount', () => {
  // Exercises the auth-helpers shared-promise dedup directly. We import
  // the REAL handleAuthCallback (vi.importActual bypasses the file-scoped
  // mock above) and drive the supabase boundary mock so we can assert
  // getSession is invoked exactly once even when handleAuthCallback() is
  // called twice in rapid succession — the pattern produced by a
  // StrictMode double-mount of /auth/callback.

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockReset()
    mockSignOut.mockReset()
    mockSignOut.mockResolvedValue({ error: null })
  })

  it('two near-simultaneous handleAuthCallback() calls share one executor invocation', async () => {
    // Hold getSession pending so the second caller arrives before the first resolves.
    let resolveGetSession!: (v: unknown) => void
    mockGetSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetSession = resolve as typeof resolveGetSession
        }),
    )

    // Pull the REAL auth-helpers module despite the file-scoped vi.mock above.
    // This intentionally bypasses the top-level mock so AuthProvider and the
    // dedup case do NOT share module-level state. Safe today because this
    // describe never renders AuthProvider — if a refactor wires AuthProvider
    // into module-level auth-helpers state, split this describe into its own
    // file (no top-level vi.mock) or vi.doUnmock here before importing.
    const real = await vi.importActual<typeof import('@/lib/auth-helpers')>(
      '@/lib/auth-helpers',
    )
    const { handleAuthCallback, __resetAuthCallbackCacheForTests } = real

    // Clear any cached result from prior tests in this worker so the
    // in-flight dedup contract (not the post-resolution memo) is what
    // we're asserting.
    __resetAuthCallbackCacheForTests()

    const first = handleAuthCallback()
    const second = handleAuthCallback()

    // (Note: `handleAuthCallback` is declared `async` so each top-level call
    // wraps the cached executor promise in a fresh promise — first !== second
    // by identity, but they BOTH await the same in-flight executor. The
    // dedup contract is "executor runs once", which we assert below.)

    // Resolve getSession with no session so executeAuthCallback short-circuits.
    resolveGetSession({ data: { session: null } })
    const [r1, r2] = await Promise.all([first, second])

    expect(r1).toEqual({ success: false, reason: 'auth-failed' })
    expect(r2).toEqual({ success: false, reason: 'auth-failed' })

    // Crucial: getSession was invoked exactly once across both callers.
    expect(mockGetSession).toHaveBeenCalledTimes(1)
  })
})
