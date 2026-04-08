import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

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

import { useVoteSubmit } from '@/hooks/useVoteSubmit'

describe('Rate limit toast display (VOTE-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows exact D-09 rate limit toast once when Edge Function returns 429 error', async () => {
    const d09Message = 'Too many responses too quickly. Please wait a moment and try again.'
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: {
          json: () => Promise.resolve({ error: d09Message }),
        },
      },
    })
    const addOptimistic = vi.fn()
    const { result } = renderHook(() => useVoteSubmit(addOptimistic))

    await act(async () => {
      await result.current.submitVote('poll-abc', 'choice-xyz')
    })

    expect(mockToastError).toHaveBeenCalledTimes(1)
    expect(mockToastError).toHaveBeenCalledWith(d09Message)
  })

  it('does not call addOptimisticVote on rate limit error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: {
          json: () => Promise.resolve({ error: 'Too many responses too quickly. Please wait a moment and try again.' }),
        },
      },
    })
    const addOptimistic = vi.fn()
    const { result } = renderHook(() => useVoteSubmit(addOptimistic))

    await act(async () => {
      await result.current.submitVote('poll-abc', 'choice-xyz')
    })

    expect(addOptimistic).not.toHaveBeenCalled()
  })
})
