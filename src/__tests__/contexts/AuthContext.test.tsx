import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

// Vitest hoists `vi.mock(...)` calls to the top of the file before module
// initialization, so any `vi.fn()` referenced inside the factory must be
// declared via `vi.hoisted()` to also lift to that top.
const { mockIdentify, mockGetSession, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockIdentify: vi.fn(),
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
}))

vi.mock('@/lib/posthog', () => ({
  posthog: {
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    identify: mockIdentify,
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
      signOut: vi.fn().mockResolvedValue({ error: null }),
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

import { AuthProvider } from '@/contexts/AuthContext'
import { ConsentProvider } from '@/contexts/ConsentContext'
import { useConsent } from '@/hooks/useConsent'
import { useAuth } from '@/hooks/useAuth'

function ConsentTrigger() {
  const { allow } = useConsent()
  return <button onClick={allow}>flip-allow</button>
}

function UserGate() {
  const { user } = useAuth()
  return <span data-testid="user-id">{user?.id ?? 'null'}</span>
}

function harness(children: ReactNode) {
  return (
    <ConsentProvider>
      <AuthProvider>{children}</AuthProvider>
    </ConsentProvider>
  )
}

describe('AuthContext — retroactive identify on consent flip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'u-1',
            user_metadata: { provider_id: 'discord-12345' },
            app_metadata: { provider: 'discord' },
          },
          provider_token: 'fake',
          access_token: 'fake',
          refresh_token: 'fake',
          expires_at: 9999999999,
        },
      },
    })
  })

  it('user already signed in, consent flips undecided → allow, identify fires exactly once with the correct providerId', async () => {
    render(harness(
      <>
        <ConsentTrigger />
        <UserGate />
      </>
    ))

    // Wait for getSession() promise + auth-subscription effect to populate user
    // before consent flips. Without this, the consent flip races against the
    // initial getSession() resolve and identify may fire with a null user.
    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('u-1')
    })

    expect(mockIdentify).not.toHaveBeenCalled()

    // Flip consent undecided → allow.
    await act(async () => {
      fireEvent.click(screen.getByText('flip-allow'))
    })

    expect(mockIdentify).toHaveBeenCalledTimes(1)
    expect(mockIdentify).toHaveBeenCalledWith('discord-12345')
  })

  it('does NOT identify when consent stays undecided', async () => {
    render(harness(<UserGate />))
    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('u-1')
    })
    expect(mockIdentify).not.toHaveBeenCalled()
  })
})
