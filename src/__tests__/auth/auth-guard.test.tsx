import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUseAuth = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown>) => <a {...props}>{children as React.ReactNode}</a>,
  useNavigate: () => vi.fn(),
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}))

import { AuthGuard } from '@/components/auth/AuthGuard'
import { AdminGuard } from '@/components/auth/AdminGuard'

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null, loading: true, isAdmin: false, signOut: vi.fn(), signInWithDiscord: vi.fn() })

    render(<AuthGuard><div>Protected Content</div></AuthGuard>)

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('shows LandingPage when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null, loading: false, isAdmin: false, signOut: vi.fn(), signInWithDiscord: vi.fn() })

    render(<AuthGuard><div>Protected Content</div></AuthGuard>)

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(screen.getByText('WTCS Community Suggestions')).toBeInTheDocument()
  })

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, profile: null, loading: false, isAdmin: false, signOut: vi.fn(), signInWithDiscord: vi.fn() })

    render(<AuthGuard><div>Protected Content</div></AuthGuard>)

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})

describe('AdminGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to / when user is not admin', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, profile: null, loading: false, isAdmin: false, signOut: vi.fn(), signInWithDiscord: vi.fn() })

    render(<AdminGuard><div>Admin Content</div></AdminGuard>)

    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/')
  })

  it('redirects to / when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null, loading: false, isAdmin: false, signOut: vi.fn(), signInWithDiscord: vi.fn() })

    render(<AdminGuard><div>Admin Content</div></AdminGuard>)

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/')
  })

  it('renders children when user is admin', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'a1' }, profile: null, loading: false, isAdmin: true, signOut: vi.fn(), signInWithDiscord: vi.fn() })

    render(<AdminGuard><div>Admin Content</div></AdminGuard>)

    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })
})
