import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

// Integration test — real @/components/ui/sheet (Radix Dialog) primitives,
// portal behavior exercised. Unit tests in MobileNav.test.tsx stub the sheet
// for speed/determinism; this test is the backstop that catches regressions
// in the real Sheet integration (portal mount, open/close wiring,
// SheetClose ref forwarding).

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

import { MobileNav } from '@/components/layout/MobileNav'

const defaults = {
  profile: null,
  loading: false,
  signOut: vi.fn(),
  signInWithDiscord: vi.fn(),
  session: null,
}

describe('MobileNav (integration — real Radix Sheet)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the sheet and surfaces the Admin link inside the portal when user is admin', async () => {
    mockUseAuth.mockReturnValue({ ...defaults, user: { id: 'a1' }, isAdmin: true })

    render(<MobileNav />)

    // Sheet is closed — Admin link is not yet mounted in the portal.
    expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument()

    // Open the sheet via the real Radix trigger.
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))

    // After opening, Radix portals SheetContent into document.body —
    // findByRole waits for async portal mount.
    const adminLink = await screen.findByRole('link', { name: /^admin$/i })
    expect(adminLink).toHaveAttribute('data-to', '/admin')

    // Sibling links land in the same portal in the expected order.
    expect(screen.getByRole('link', { name: /^topics$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^archive$/i })).toBeInTheDocument()
  })

  it('opens the sheet without an Admin link when user is not admin', async () => {
    mockUseAuth.mockReturnValue({ ...defaults, user: { id: 'u1' }, isAdmin: false })

    render(<MobileNav />)

    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))

    await screen.findByRole('link', { name: /^topics$/i })
    expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument()
  })
})
