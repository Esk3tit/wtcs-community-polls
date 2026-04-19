import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUseAuth = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string } & Record<string, unknown>) => (
    <a href={to} data-to={to} {...props}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}))

vi.mock('@/components/theme-provider', () => ({
  useTheme: () => ({ setTheme: vi.fn() }),
}))

vi.mock('@/components/layout/MobileNav', () => ({
  MobileNav: () => null,
}))

import { Navbar } from '@/components/layout/Navbar'

const defaults = {
  profile: null,
  loading: false,
  signOut: vi.fn(),
  signInWithDiscord: vi.fn(),
  session: null,
}

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Admin link pointing to /admin when user is admin', () => {
    mockUseAuth.mockReturnValue({ ...defaults, user: { id: 'a1' }, isAdmin: true })

    render(<Navbar />)

    const adminLink = screen.getByRole('link', { name: /^admin$/i })
    expect(adminLink).toBeInTheDocument()
    expect(adminLink).toHaveAttribute('data-to', '/admin')
  })

  it('does NOT render the Admin link when user is authenticated but not admin', () => {
    mockUseAuth.mockReturnValue({ ...defaults, user: { id: 'u1' }, isAdmin: false })

    render(<Navbar />)

    expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument()
  })

  it('does NOT render the Admin link when user is unauthenticated', () => {
    mockUseAuth.mockReturnValue({ ...defaults, user: null, isAdmin: false })

    render(<Navbar />)

    expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument()
  })

  it('renders Topics and Archive links when user is present (regression guard)', () => {
    mockUseAuth.mockReturnValue({ ...defaults, user: { id: 'u1' }, isAdmin: false })

    render(<Navbar />)

    expect(screen.getByRole('link', { name: /^topics$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^archive$/i })).toBeInTheDocument()
  })
})
