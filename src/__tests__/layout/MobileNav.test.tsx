import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

const mockUseAuth = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string } & Record<string, unknown>) => (
    <a href={to} data-to={to} {...props}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}))

// Stub the Sheet primitives so children render inline (no Radix portal) — matches
// the low-friction approach called out in the plan action block.
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetClose: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

import { MobileNav } from '@/components/layout/MobileNav'

const defaults = {
  profile: null,
  loading: false,
  signOut: vi.fn(),
  signInWithDiscord: vi.fn(),
  session: null,
}

describe('MobileNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Admin link pointing to /admin when user is admin', () => {
    mockUseAuth.mockReturnValue({ ...defaults, user: { id: 'a1' }, isAdmin: true })

    render(<MobileNav />)

    const adminLink = screen.getByRole('link', { name: /^admin$/i })
    expect(adminLink).toBeInTheDocument()
    expect(adminLink).toHaveAttribute('data-to', '/admin')
  })

  it('does NOT render the Admin link when user is not admin', () => {
    mockUseAuth.mockReturnValue({ ...defaults, user: { id: 'u1' }, isAdmin: false })

    render(<MobileNav />)

    expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument()
  })

  it('renders Topics and Archive links when isAdmin=false (regression guard)', () => {
    mockUseAuth.mockReturnValue({ ...defaults, user: { id: 'u1' }, isAdmin: false })

    render(<MobileNav />)

    expect(screen.getByRole('link', { name: /^topics$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^archive$/i })).toBeInTheDocument()
  })
})
