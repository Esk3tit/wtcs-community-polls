import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: null,
    user: null,
    profile: null,
    loading: false,
    isAdmin: false,
    signOut: vi.fn(),
    signInWithDiscord: vi.fn(),
  }),
}))

import { AuthErrorPage } from '@/components/auth/AuthErrorPage'

describe('AuthErrorPage', () => {
  it('renders 2FA required messaging', () => {
    render(<AuthErrorPage reason="2fa-required" />)

    expect(screen.getByText('Two-Factor Authentication Required')).toBeInTheDocument()
    expect(screen.getByText(/To keep responses authentic, we require 2FA/)).toBeInTheDocument()
    expect(screen.getByText('Set Up 2FA on Discord')).toBeInTheDocument()
    expect(screen.getByText('Try Signing In Again')).toBeInTheDocument()
  })

  it('2FA setup links to Discord support article', () => {
    render(<AuthErrorPage reason="2fa-required" />)

    const link = screen.getByText('Set Up 2FA on Discord').closest('a')
    expect(link).toHaveAttribute('href', 'https://support.discord.com/hc/en-us/articles/219576828')
  })

  it('renders session expired messaging', () => {
    render(<AuthErrorPage reason="session-expired" />)

    expect(screen.getByText('Session Expired')).toBeInTheDocument()
    expect(screen.getByText(/Your login session has ended/)).toBeInTheDocument()
    expect(screen.getByText('Sign in with Discord')).toBeInTheDocument()
  })

  it('renders general error messaging', () => {
    render(<AuthErrorPage reason="auth-failed" />)

    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument()
    expect(screen.getByText(/Could not complete your login/)).toBeInTheDocument()
    expect(screen.getByText('Try Signing In Again')).toBeInTheDocument()
  })
})
