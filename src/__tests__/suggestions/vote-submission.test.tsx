import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'

// Mock supabase
const mockInvoke = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}))

// Mock sonner
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

// Mock lucide-react to avoid SVG rendering issues
vi.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="loader-spinner" className={className} />
  ),
}))

// Mock @/components/ui/button
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    disabled,
    onClick,
    ...props
  }: {
    children: React.ReactNode
    disabled?: boolean
    onClick?: (e: React.MouseEvent) => void
    [key: string]: unknown
  }) => (
    <button disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

import { useVoteSubmit } from '@/hooks/useVoteSubmit'
import { ChoiceButtons } from '@/components/suggestions/ChoiceButtons'

describe('Vote submission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Test 1: VOTE-01 -- invokes edge function with correct params
  it('invokes edge function with poll_id and choice_id', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null })
    const addOptimistic = vi.fn()
    const { result } = renderHook(() => useVoteSubmit(addOptimistic))

    await act(async () => {
      await result.current.submitVote('poll-abc', 'choice-xyz')
    })

    expect(mockInvoke).toHaveBeenCalledWith('submit-vote', {
      body: { poll_id: 'poll-abc', choice_id: 'choice-xyz' },
    })
  })

  // Test 2: VOTE-01 -- shows success toast on successful submission
  it('shows success toast on successful submission', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null })
    const addOptimistic = vi.fn()
    const { result } = renderHook(() => useVoteSubmit(addOptimistic))

    await act(async () => {
      await result.current.submitVote('poll-abc', 'choice-xyz')
    })

    expect(mockToastSuccess).toHaveBeenCalledWith('Response recorded')
    expect(addOptimistic).toHaveBeenCalledWith('poll-abc', 'choice-xyz')
  })

  // Test 3: VOTE-02 -- shows error toast on duplicate vote (409 UNIQUE violation)
  it('shows error toast on duplicate vote (409 UNIQUE violation)', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'You have already responded to this topic' },
      error: { message: 'Edge Function returned error' },
    })
    const addOptimistic = vi.fn()
    const { result } = renderHook(() => useVoteSubmit(addOptimistic))

    await act(async () => {
      await result.current.submitVote('poll-abc', 'choice-xyz')
    })

    expect(mockToastError).toHaveBeenCalledWith(
      'You have already responded to this topic.'
    )
    expect(addOptimistic).not.toHaveBeenCalled()
  })

  // Test 4: VOTE-03 -- disables buttons during submission (double-click protection)
  it('disables buttons during submission (double-click protection)', () => {
    const choices = [
      { id: 'c1', label: 'Yes', sort_order: 1, poll_id: 'p1', created_at: '' },
      { id: 'c2', label: 'No', sort_order: 2, poll_id: 'p1', created_at: '' },
    ]

    render(
      <ChoiceButtons
        choices={choices}
        pollId="p1"
        pollStatus="active"
        hasVoted={false}
        onVote={vi.fn()}
        submittingPollId="p1"
        submittingChoiceId="c1"
        totalResponses={5}
      />
    )

    const buttons = screen.getAllByRole('button')
    for (const button of buttons) {
      expect(button).toBeDisabled()
    }
  })

  // Test 5: VOTE-03 -- shows spinner on clicked button during submission
  it('shows spinner on clicked button during submission', () => {
    const choices = [
      { id: 'c1', label: 'Yes', sort_order: 1, poll_id: 'p1', created_at: '' },
      { id: 'c2', label: 'No', sort_order: 2, poll_id: 'p1', created_at: '' },
    ]

    render(
      <ChoiceButtons
        choices={choices}
        pollId="p1"
        pollStatus="active"
        hasVoted={false}
        onVote={vi.fn()}
        submittingPollId="p1"
        submittingChoiceId="c1"
        totalResponses={5}
      />
    )

    expect(screen.getByTestId('loader-spinner')).toBeInTheDocument()
  })

  // Test 6: VOTE-02 -- rejects vote on closed suggestion
  it('rejects vote on closed suggestion', () => {
    const choices = [
      { id: 'c1', label: 'Yes', sort_order: 1, poll_id: 'p1', created_at: '' },
      { id: 'c2', label: 'No', sort_order: 2, poll_id: 'p1', created_at: '' },
    ]

    render(
      <ChoiceButtons
        choices={choices}
        pollId="p1"
        pollStatus="closed"
        hasVoted={false}
        onVote={vi.fn()}
        submittingPollId={null}
        submittingChoiceId={null}
        totalResponses={0}
      />
    )

    expect(
      screen.getByText(
        'This topic is closed. Only respondents can view results.'
      )
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  // Test 7: VOTE-02 -- rejects vote with missing choice_id
  it('rejects vote with missing choice_id (400 error)', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'Missing poll_id or choice_id' },
      error: { message: 'Edge Function returned error' },
    })
    const addOptimistic = vi.fn()
    const { result } = renderHook(() => useVoteSubmit(addOptimistic))

    await act(async () => {
      await result.current.submitVote('poll-abc', '')
    })

    expect(mockToastError).toHaveBeenCalledWith('Missing poll_id or choice_id')
    expect(addOptimistic).not.toHaveBeenCalled()
  })
})
