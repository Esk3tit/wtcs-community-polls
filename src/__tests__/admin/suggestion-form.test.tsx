import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// --- Hoisted mocks ------------------------------------------------------

const createPollMock = vi.fn().mockResolvedValue({ ok: true, id: 'new-poll-1' })
const updatePollMock = vi.fn().mockResolvedValue({ ok: true })

vi.mock('@/hooks/useCreatePoll', () => ({
  useCreatePoll: () => ({ createPoll: createPollMock, submitting: false }),
}))
vi.mock('@/hooks/useUpdatePoll', () => ({
  useUpdatePoll: () => ({ updatePoll: updatePollMock, submitting: false }),
}))
vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [], loading: false, error: null, refetch: vi.fn() }),
}))
vi.mock('@/hooks/useCategoryMutations', () => ({
  useCategoryMutations: () => ({
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    submitting: false,
  }),
}))
vi.mock('@/hooks/useUploadImage', () => ({
  uploadImage: vi.fn().mockResolvedValue('https://example.com/x.jpg'),
}))

const navigateMock = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

// --- Supabase mock (per-test configurable) ------------------------------

const pollEffectiveMock = vi.fn()
const choicesMock = vi.fn()
const voteCountsMock = vi.fn()

vi.mock('@/lib/supabase', () => {
  const makePollsEffective = () => ({
    select: () => ({
      eq: () => ({
        single: () => pollEffectiveMock(),
      }),
    }),
  })
  const makeChoices = () => ({
    select: () => ({
      eq: () => ({
        order: () => choicesMock(),
      }),
    }),
  })
  const makeVoteCounts = () => ({
    select: () => ({
      eq: () => voteCountsMock(),
    }),
  })
  return {
    supabase: {
      from: (t: string) => {
        if (t === 'polls_effective') return makePollsEffective()
        if (t === 'choices') return makeChoices()
        if (t === 'vote_counts') return makeVoteCounts()
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        }
      },
    },
  }
})

// ------------------------------------------------------------------------

import { SuggestionForm } from '@/components/suggestions/form/SuggestionForm'

describe('SuggestionForm (create mode)', () => {
  beforeEach(() => {
    createPollMock.mockClear()
    updatePollMock.mockClear()
    navigateMock.mockClear()
  })

  it('renders the New suggestion heading and primary sections', () => {
    render(<SuggestionForm mode="create" />)
    expect(screen.getByRole('heading', { name: /new suggestion/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create suggestion/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /yes\/no/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /4-choice preset/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^add choice$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /7 days/i })).toBeInTheDocument()
  })

  it('Yes/No preset populates two choices', async () => {
    const user = userEvent.setup()
    render(<SuggestionForm mode="create" />)
    await user.click(screen.getByRole('button', { name: /yes\/no/i }))
    // There is a confirm dialog only if there is existing content. Initial state
    // is two empty strings so preset applies directly.
    expect(screen.getByDisplayValue('Yes')).toBeInTheDocument()
    expect(screen.getByDisplayValue('No')).toBeInTheDocument()
  })

  it('submitting with empty title shows the title-required error', async () => {
    const user = userEvent.setup()
    render(<SuggestionForm mode="create" />)
    await user.click(screen.getByRole('button', { name: /yes\/no/i }))
    await user.click(screen.getByRole('button', { name: /create suggestion/i }))
    expect(await screen.findByText('Title is required.')).toBeInTheDocument()
    expect(createPollMock).not.toHaveBeenCalled()
  })

  it('valid submit invokes createPoll', async () => {
    const user = userEvent.setup()
    render(<SuggestionForm mode="create" />)
    await user.type(screen.getByLabelText('Title'), 'My suggestion')
    await user.click(screen.getByRole('button', { name: /yes\/no/i }))
    await user.click(screen.getByRole('button', { name: /create suggestion/i }))
    await waitFor(() => expect(createPollMock).toHaveBeenCalled())
    const arg = createPollMock.mock.calls[0][0]
    expect(arg.title).toBe('My suggestion')
    expect(arg.choices).toEqual(['Yes', 'No'])
  })
})

describe('SuggestionForm (edit mode, locked by votes)', () => {
  beforeEach(() => {
    pollEffectiveMock.mockReset().mockResolvedValue({
      data: {
        id: 'p1',
        title: 'Existing',
        description: 'desc',
        category_id: null,
        image_url: null,
        status: 'active',
        raw_status: 'active',
        resolution: null,
        is_pinned: false,
        closes_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
        closed_at: null,
        created_at: '2026-04-01',
      },
      error: null,
    })
    choicesMock.mockReset().mockResolvedValue({
      data: [
        { label: 'Yes' },
        { label: 'No' },
      ],
      error: null,
    })
    voteCountsMock.mockReset().mockResolvedValue({
      data: [{ count: 3 }],
      error: null,
    })
  })

  it('Editing is locked banner renders when vote_count > 0; all inputs disabled', async () => {
    render(<SuggestionForm mode="edit" pollId="p1" />)
    await screen.findByText(/editing is locked/i)
    expect(screen.getByLabelText('Title')).toBeDisabled()
    expect(screen.getByLabelText('Description')).toBeDisabled()
    // At least one choice input is disabled
    expect(screen.getByLabelText('Choice 1')).toBeDisabled()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled()
    // Preset buttons disabled
    expect(screen.getByRole('button', { name: /yes\/no/i })).toBeDisabled()
    // TimerPicker preset disabled
    expect(screen.getByRole('button', { name: /7 days/i })).toBeDisabled()
  })
})

describe('SuggestionForm (edit mode, fetch failure — MEDIUM #7)', () => {
  beforeEach(() => {
    pollEffectiveMock.mockReset().mockResolvedValue({
      data: null,
      error: new Error('network'),
    })
    choicesMock.mockReset().mockResolvedValue({ data: [], error: null })
    voteCountsMock.mockReset().mockResolvedValue({ data: [], error: null })
  })

  it("renders a destructive Alert with 'Couldn't load this suggestion' + Retry", async () => {
    render(<SuggestionForm mode="edit" pollId="p1" />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/couldn't load this suggestion/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    // Form body should NOT render when fetch failed
    expect(screen.queryByLabelText('Title')).toBeNull()
  })
})
