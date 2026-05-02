import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => ({ filter: 'all' }),
  useNavigate: () => vi.fn(),
}))

// Build a thenable chain that mimics supabase-js builder semantics.
// Each .select/.order/.eq returns `this`, then awaiting resolves with
// { data, error }.
type MockResult<T = unknown> = { data: T | null; error: Error | null }

function makeThenable<T>(
  resolver: () => Promise<MockResult<T>>,
): PromiseLike<MockResult<T>> & {
  select: () => typeof b
  order: () => typeof b
  eq: () => typeof b
  in: () => typeof b
} {
  const b = {
    select: () => b,
    order: () => b,
    eq: () => b,
    in: () => b,
    then: (onFulfilled: (v: MockResult<T>) => unknown, onRejected?: (e: unknown) => unknown) =>
      resolver().then(onFulfilled, onRejected),
  } as unknown as PromiseLike<MockResult<T>> & {
    select: () => typeof b
    order: () => typeof b
    eq: () => typeof b
    in: () => typeof b
  }
  return b
}

const pollsResolver = vi.fn<() => Promise<MockResult<unknown[]>>>()
const voteCountsResolver = vi.fn<() => Promise<MockResult<Array<{ poll_id: string; count: number }>>>>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (t: string) => {
      if (t === 'polls_effective') return makeThenable(pollsResolver)
      if (t === 'vote_counts') return makeThenable(voteCountsResolver)
      return makeThenable(() => Promise.resolve({ data: null, error: null }))
    },
  },
}))

vi.mock('@/hooks/useClosePoll', () => ({
  useClosePoll: () => ({ closePoll: vi.fn(), submitting: false }),
}))

// NIT-02: pinPoll must be per-test configurable so we can test the
// optimistic pending / success / error flows.
const pinPollMock = vi.fn<
  (input: { poll_id: string; is_pinned: boolean }) => Promise<{ ok: boolean }>
>()
vi.mock('@/hooks/usePinPoll', () => ({
  usePinPoll: () => ({ pinPoll: pinPollMock, submitting: false }),
}))

vi.mock('@/hooks/useDeletePoll', () => ({
  useDeletePoll: () => ({ deletePoll: vi.fn(), submitting: false }),
}))
vi.mock('@/hooks/useSetResolution', () => ({
  useSetResolution: () => ({ setResolution: vi.fn(), submitting: false }),
}))

import { AdminSuggestionsTab } from '@/components/admin/AdminSuggestionsTab'

describe('AdminSuggestionsTab', () => {
  beforeEach(() => {
    pinPollMock.mockReset().mockResolvedValue({ ok: true })
    pollsResolver.mockReset().mockResolvedValue({
      data: [
        {
          id: 'p1',
          title: 'Pinned one',
          status: 'active',
          raw_status: 'active',
          resolution: null,
          is_pinned: true,
          closes_at: null,
          closed_at: null,
          category_id: null,
          created_at: '2026-04-01',
        },
        {
          id: 'p2',
          title: 'Active one',
          status: 'active',
          raw_status: 'active',
          resolution: null,
          is_pinned: false,
          closes_at: null,
          closed_at: null,
          category_id: null,
          created_at: '2026-04-02',
        },
        {
          id: 'p3',
          title: 'Closed one',
          status: 'closed',
          raw_status: 'closed',
          resolution: 'addressed',
          is_pinned: false,
          closes_at: null,
          closed_at: '2026-04-03',
          category_id: null,
          created_at: '2026-04-03',
        },
      ],
      error: null,
    })
    voteCountsResolver.mockReset().mockResolvedValue({ data: [], error: null })
  })

  it('renders filter chips and Create suggestion button', () => {
    render(<AdminSuggestionsTab />)
    // Filter chips expose role="tab" inside a role="tablist"
    expect(screen.getByRole('tablist', { name: /filter suggestions/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Active' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Closed' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create suggestion/i })).toBeInTheDocument()
  })

  it('renders suggestions from polls_effective', async () => {
    render(<AdminSuggestionsTab />)
    await waitFor(() => expect(screen.getByText('Pinned one')).toBeInTheDocument())
    expect(screen.getByText('Active one')).toBeInTheDocument()
    expect(screen.getByText('Closed one')).toBeInTheDocument()
  })
})

describe('AdminSuggestionsTab error state (MEDIUM #7)', () => {
  beforeEach(() => {
    pinPollMock.mockReset().mockResolvedValue({ ok: true })
  })

  it('renders Alert + Retry on polls_effective fetch failure', async () => {
    pollsResolver.mockReset().mockResolvedValue({
      data: null,
      error: new Error('network'),
    })
    voteCountsResolver.mockReset().mockResolvedValue({ data: [], error: null })
    render(<AdminSuggestionsTab />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/couldn't load suggestions/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('renders Alert + Retry on vote_counts fetch failure', async () => {
    // The vote_counts query is scoped to visible pollIds via .in(), so
    // the failing query only fires when polls_effective returned at least
    // one row. Seed one poll so the vote_counts call happens.
    pollsResolver.mockReset().mockResolvedValue({
      data: [
        {
          id: 'p1',
          title: 'Only one',
          status: 'active',
          raw_status: 'active',
          resolution: null,
          is_pinned: false,
          closes_at: null,
          closed_at: null,
          category_id: null,
          created_at: '2026-04-01',
        },
      ],
      error: null,
    })
    voteCountsResolver.mockReset().mockResolvedValue({
      data: null,
      error: new Error('network'),
    })
    render(<AdminSuggestionsTab />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/couldn't load suggestions/i)).toBeInTheDocument()
  })
})

describe('AdminSuggestionsTab optimistic pin (NIT-02)', () => {
  beforeEach(() => {
    pollsResolver.mockReset().mockResolvedValue({
      data: [
        {
          id: 'p1',
          title: 'Pinned one',
          status: 'active',
          raw_status: 'active',
          resolution: null,
          is_pinned: true,
          closes_at: null,
          closed_at: null,
          category_id: null,
          created_at: '2026-04-01',
        },
        {
          id: 'p2',
          title: 'Unpinned one',
          status: 'active',
          raw_status: 'active',
          resolution: null,
          is_pinned: false,
          closes_at: null,
          closed_at: null,
          category_id: null,
          created_at: '2026-04-02',
        },
      ],
      error: null,
    })
    voteCountsResolver.mockReset().mockResolvedValue({ data: [], error: null })
  })

  it('flips the pin badge immediately on click, before the mutation resolves', async () => {
    // Pending promise — pinPoll never resolves during the test body.
    let resolveMut: (v: { ok: boolean }) => void = () => {}
    const pending = new Promise<{ ok: boolean }>((res) => {
      resolveMut = res
    })
    pinPollMock.mockReset().mockReturnValueOnce(pending)

    const user = userEvent.setup()
    render(<AdminSuggestionsTab />)
    await waitFor(() => expect(screen.getByText('Unpinned one')).toBeInTheDocument())

    // Pre-state: p2 has no pin badge
    expect(screen.queryByTestId('pin-badge-p2')).toBeNull()

    // Open the kebab for the unpinned row (p2) and click Pin.
    const kebabs = screen.getAllByRole('button', { name: /suggestion actions/i })
    // Two rows -> two kebabs; kebabs[1] corresponds to the second row (p2)
    await user.click(kebabs[1])
    await user.click(await screen.findByRole('menuitem', { name: /^pin$/i }))

    // Optimistic: p2 pin badge should be present even though the mutation
    // is still pending.
    await waitFor(() =>
      expect(screen.getByTestId('pin-badge-p2')).toBeInTheDocument(),
    )
    expect(pinPollMock).toHaveBeenCalledWith({ poll_id: 'p2', is_pinned: true })

    // Let the pending mutation resolve so React test cleanup doesn't
    // hang on the in-flight promise.
    resolveMut({ ok: true })
  })

  it('reverts the pin on mutation error', async () => {
    pinPollMock.mockReset().mockResolvedValueOnce({ ok: false })

    const user = userEvent.setup()
    render(<AdminSuggestionsTab />)
    await waitFor(() => expect(screen.getByText('Unpinned one')).toBeInTheDocument())

    expect(screen.queryByTestId('pin-badge-p2')).toBeNull()

    const kebabs = screen.getAllByRole('button', { name: /suggestion actions/i })
    await user.click(kebabs[1])
    await user.click(await screen.findByRole('menuitem', { name: /^pin$/i }))

    // After mutation rejects, the badge should be removed again.
    await waitFor(() => expect(screen.queryByTestId('pin-badge-p2')).toBeNull())
    expect(pinPollMock).toHaveBeenCalledWith({ poll_id: 'p2', is_pinned: true })
  })

  it('keeps the pin after mutation success + reconciliation refetch', async () => {
    pinPollMock.mockReset().mockResolvedValueOnce({ ok: true })

    // First fetch returns p2 unpinned; reconciliation fetch returns p2 pinned
    // (server-authoritative state). Both calls come through pollsResolver.
    pollsResolver
      .mockReset()
      .mockResolvedValueOnce({
        data: [
          {
            id: 'p1',
            title: 'Pinned one',
            status: 'active',
            raw_status: 'active',
            resolution: null,
            is_pinned: true,
            closes_at: null,
            closed_at: null,
            category_id: null,
            created_at: '2026-04-01',
          },
          {
            id: 'p2',
            title: 'Unpinned one',
            status: 'active',
            raw_status: 'active',
            resolution: null,
            is_pinned: false,
            closes_at: null,
            closed_at: null,
            category_id: null,
            created_at: '2026-04-02',
          },
        ],
        error: null,
      })
      .mockResolvedValue({
        data: [
          {
            id: 'p1',
            title: 'Pinned one',
            status: 'active',
            raw_status: 'active',
            resolution: null,
            is_pinned: true,
            closes_at: null,
            closed_at: null,
            category_id: null,
            created_at: '2026-04-01',
          },
          {
            id: 'p2',
            title: 'Unpinned one',
            status: 'active',
            raw_status: 'active',
            resolution: null,
            is_pinned: true,
            closes_at: null,
            closed_at: null,
            category_id: null,
            created_at: '2026-04-02',
          },
        ],
        error: null,
      })

    const user = userEvent.setup()
    render(<AdminSuggestionsTab />)
    await waitFor(() => expect(screen.getByText('Unpinned one')).toBeInTheDocument())

    const kebabs = screen.getAllByRole('button', { name: /suggestion actions/i })
    await user.click(kebabs[1])
    await user.click(await screen.findByRole('menuitem', { name: /^pin$/i }))

    // After the mutation resolves and the reconciliation refetch lands,
    // p2 should still be pinned.
    await waitFor(() =>
      expect(screen.getByTestId('pin-badge-p2')).toBeInTheDocument(),
    )
  })
})
