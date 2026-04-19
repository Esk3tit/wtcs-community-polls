import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from '@testing-library/react'
import { AdminsList } from '@/components/admin/AdminsList'

// --- Mocks ---------------------------------------------------------------

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'self-uid' },
    profile: null,
    isAdmin: true,
    loading: false,
    signOut: vi.fn(),
    signInWithDiscord: vi.fn(),
  }),
}))

const orderMock = vi.fn()
const eqMock = vi.fn().mockReturnValue({ order: orderMock })

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: eqMock }) }),
    functions: { invoke: vi.fn() },
  },
}))

vi.mock('@/hooks/usePromoteAdmin', () => ({
  usePromoteAdmin: () => ({ promote: vi.fn(), submitting: false }),
}))

vi.mock('@/hooks/useDemoteAdmin', () => ({
  useDemoteAdmin: () => ({ demote: vi.fn(), submitting: false }),
}))

vi.mock('@/hooks/useSearchAdminTargets', () => ({
  useSearchAdminTargets: () => ({
    query: '',
    normalizedQuery: '',
    canSearch: false,
    setQuery: vi.fn(),
    results: [],
    searching: false,
  }),
}))

// --- Tests ---------------------------------------------------------------

describe('AdminsList', () => {
  beforeEach(() => {
    cleanup()
    orderMock.mockReset().mockResolvedValue({
      data: [
        {
          id: 'self-uid',
          discord_id: '111',
          discord_username: 'Khai',
          avatar_url: null,
        },
        {
          id: 'other-uid',
          discord_id: '222',
          discord_username: 'Other',
          avatar_url: null,
        },
      ],
      error: null,
    })
    eqMock.mockReset().mockReturnValue({ order: orderMock })
  })

  it('renders Admins title and Promote button', async () => {
    render(<AdminsList />)
    expect(screen.getByText('Admins')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /promote admin/i }),
    ).toBeInTheDocument()
  })

  it('renders both admin names after fetch', async () => {
    render(<AdminsList />)
    await waitFor(() =>
      expect(screen.getByText('Khai')).toBeInTheDocument(),
    )
    expect(screen.getByText('Other')).toBeInTheDocument()
  })

  it('shows "You" badge on self row and hides Demote button (D-06)', async () => {
    render(<AdminsList />)
    await waitFor(() => expect(screen.getByText('You')).toBeInTheDocument())
    const demoteButtons = screen.queryAllByRole('button', {
      name: /^demote$/i,
    })
    // Only one Demote button should render — for the other-uid row.
    expect(demoteButtons).toHaveLength(1)
  })

  it('opens demote dialog when other-row Demote button clicked', async () => {
    render(<AdminsList />)
    await waitFor(() => expect(screen.getByText('Other')).toBeInTheDocument())
    const demoteButton = screen.getByRole('button', { name: /^demote$/i })
    fireEvent.click(demoteButton)
    expect(screen.getByText('Demote this admin?')).toBeInTheDocument()
  })

  it('opens promote dialog when Promote admin button clicked', async () => {
    render(<AdminsList />)
    await waitFor(() => expect(screen.getByText('Khai')).toBeInTheDocument())
    const promoteBtn = screen.getByRole('button', { name: /promote admin/i })
    fireEvent.click(promoteBtn)
    // Dialog title is also "Promote admin"
    const matches = screen.getAllByText(/promote admin/i)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })
})

describe('AdminsList error state (MEDIUM #7)', () => {
  beforeEach(() => {
    cleanup()
  })

  it('renders Alert + Retry button on fetch failure (not a silent empty list)', async () => {
    orderMock.mockReset().mockResolvedValue({
      data: null,
      error: new Error('network'),
    })
    eqMock.mockReset().mockReturnValue({ order: orderMock })
    render(<AdminsList />)
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument(),
    )
    expect(screen.getByText(/couldn't load admins/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /retry/i }),
    ).toBeInTheDocument()
  })
})
