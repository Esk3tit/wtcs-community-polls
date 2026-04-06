import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const mockSignInWithDiscord = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: null,
    user: null,
    profile: null,
    loading: false,
    isAdmin: false,
    signOut: vi.fn(),
    signInWithDiscord: mockSignInWithDiscord,
  }),
}))

import { LandingPage } from '@/components/auth/LandingPage'

describe('LandingPage', () => {
  it('renders heading and subheading', () => {
    render(<LandingPage />)

    expect(screen.getByText('WTCS Community Suggestions')).toBeInTheDocument()
    expect(screen.getByText('Share your opinion on proposals that shape competitive War Thunder.')).toBeInTheDocument()
  })

  it('renders Discord CTA button', () => {
    render(<LandingPage />)

    expect(screen.getByText('Sign in with Discord')).toBeInTheDocument()
  })

  it('renders trust badges', () => {
    render(<LandingPage />)

    expect(screen.getByText('2FA Required')).toBeInTheDocument()
    expect(screen.getByText('One Response Per Topic')).toBeInTheDocument()
    expect(screen.getByText('Discord Verified')).toBeInTheDocument()
  })

  it('calls signInWithDiscord when CTA clicked', async () => {
    render(<LandingPage />)

    await act(async () => {
      screen.getByText('Sign in with Discord').closest('button')?.click()
    })

    expect(mockSignInWithDiscord).toHaveBeenCalledOnce()
  })
})
