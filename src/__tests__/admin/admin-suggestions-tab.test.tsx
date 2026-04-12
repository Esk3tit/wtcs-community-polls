import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

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
vi.mock('@/hooks/usePinPoll', () => ({
  usePinPoll: () => ({ pinPoll: vi.fn(), submitting: false }),
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
    // LR-04: filter chips now expose role="tab" inside a role="tablist"
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
    // ME-05: vote_counts query is now scoped to visible pollIds via .in(),
    // so the failing query only fires when polls_effective returned
    // at least one row. Seed one poll so the vote_counts call happens.
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
