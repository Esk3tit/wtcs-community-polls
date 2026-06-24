import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Check: () => <span data-testid="check-icon" />,
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="loader-spinner" className={className} />
  ),
  Search: () => <span data-testid="search-icon" />,
  X: () => <span data-testid="x-icon" />,
  ChevronDown: () => <span data-testid="chevron-icon" />,
  Pin: () => <span data-testid="pin-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
  SearchX: () => <span data-testid="search-x-icon" />,
  Inbox: () => <span data-testid="inbox-icon" />,
  Archive: () => <span data-testid="archive-icon" />,
  EyeOff: () => <span data-testid="eye-off-icon" />,
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

// Mock @/lib/format -- use the real calcPercentage
vi.mock('@/lib/format', () => ({
  calcPercentage: (count: number, total: number) => {
    if (total === 0) return 0
    return Math.round((count / total) * 100)
  },
  formatTimeRemaining: () => '7 days left',
}))

// --- Integration harness for the first-paint fail-closed gate ---
// SuggestionList renders SuggestionCard for every voted poll. We drive
// useVoteCounts directly so we can simulate the unknown window (an empty
// resultsHidden map) while voteCounts is already populated — the exact
// condition under which a leak WOULD surface if the gate were fail-open.
const mockUseSuggestions = vi.fn()
vi.mock('@/hooks/useSuggestions', () => ({
  useSuggestions: () => mockUseSuggestions(),
}))

const mockUseCategories = vi.fn()
vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => mockUseCategories(),
}))

const mockUseVoteCounts = vi.fn()
vi.mock('@/hooks/useVoteCounts', () => ({
  useVoteCounts: () => mockUseVoteCounts(),
}))

vi.mock('@/hooks/useVoteSubmit', () => ({
  useVoteSubmit: () => ({
    submitVote: vi.fn(),
    submittingPollId: null,
    submittingChoiceId: null,
  }),
}))

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
}))

vi.mock('@/hooks/usePolling', () => ({
  usePolling: vi.fn(),
}))

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

import { ChoiceButtons } from '@/components/suggestions/ChoiceButtons'
import { ResultBars } from '@/components/suggestions/ResultBars'
import { SuggestionList } from '@/components/suggestions/SuggestionList'

const mockChoices = [
  { id: 'c1', label: 'Yes, remove it', sort_order: 1, poll_id: 'p1', created_at: '' },
  { id: 'c2', label: 'No, keep it', sort_order: 2, poll_id: 'p1', created_at: '' },
]

describe('Results visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Test 1: RSLT-01 -- hides results when user has not voted (pre-vote state)
  it('hides results when user has not voted (pre-vote state)', () => {
    render(
      <ChoiceButtons
        choices={mockChoices}
        pollId="p1"
        pollStatus="active"
        hasVoted={false}
        onVote={vi.fn()}
        submittingPollId={null}
        submittingChoiceId={null}
        totalResponses={10}
      />
    )

    // Choice buttons should be visible
    expect(screen.getByText('Yes, remove it')).toBeInTheDocument()
    expect(screen.getByText('No, keep it')).toBeInTheDocument()
    // No percentage text or meter roles -- results are hidden
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
  })

  // Test 2: RSLT-02 -- shows result bars with percentages after voting
  it('shows result bars with percentages after voting (post-vote state)', () => {
    const voteCounts = new Map<string, number>([
      ['c1', 15],
      ['c2', 5],
    ])

    render(
      <ResultBars
        choices={mockChoices}
        voteCounts={voteCounts}
        userChoiceId="c1"
        totalResponses={20}
      />
    )

    // Labels should be rendered
    expect(screen.getByText('Yes, remove it')).toBeInTheDocument()
    expect(screen.getByText('No, keep it')).toBeInTheDocument()

    // Percentages should be visible
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()

    // Counts should be visible
    expect(screen.getByText('(15)')).toBeInTheDocument()
    expect(screen.getByText('(5)')).toBeInTheDocument()

    // Meter roles should exist
    const meters = screen.getAllByRole('meter')
    expect(meters).toHaveLength(2)
    expect(meters[0]).toHaveAttribute('aria-valuenow', '75')
    expect(meters[1]).toHaveAttribute('aria-valuenow', '25')

    // Total responses footer
    expect(screen.getByText('20 total responses')).toBeInTheDocument()
  })

  // Test 3: RSLT-02 -- highlights user's chosen option with Check icon
  it('highlights user chosen option with Check icon', () => {
    const voteCounts = new Map<string, number>([
      ['c1', 15],
      ['c2', 5],
    ])

    render(
      <ResultBars
        choices={mockChoices}
        voteCounts={voteCounts}
        userChoiceId="c1"
        totalResponses={20}
      />
    )

    // Check icon should be present (user chose c1)
    const checkIcons = screen.getAllByTestId('check-icon')
    expect(checkIcons).toHaveLength(1)

    // The user's choice meter should have aria-label with the choice text
    const userMeter = screen.getByLabelText('Yes, remove it: 75%')
    expect(userMeter).toBeInTheDocument()
  })

  // Test 4: RSLT-05 -- shows closed message for non-respondents on closed topic
  it('shows closed message for non-respondents on closed topic (respondent-only post-close)', () => {
    render(
      <ChoiceButtons
        choices={mockChoices}
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

    // No buttons should be rendered
    expect(screen.queryAllByRole('button')).toHaveLength(0)

    // No result bars
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
  })

  // Test 5: RSLT-05 -- shows result bars for respondents on closed topic
  it('shows result bars for respondents on closed topic (respondent post-close visibility)', () => {
    const voteCounts = new Map<string, number>([
      ['c1', 47],
      ['c2', 12],
    ])

    render(
      <ResultBars
        choices={mockChoices}
        voteCounts={voteCounts}
        userChoiceId="c1"
        totalResponses={59}
      />
    )

    // Result bars should render normally
    expect(screen.getByText('Yes, remove it')).toBeInTheDocument()
    expect(screen.getByText('No, keep it')).toBeInTheDocument()

    // Percentages: 47/59 = 80%, 12/59 = 20%
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()

    // Meters present
    expect(screen.getAllByRole('meter')).toHaveLength(2)

    // Total responses
    expect(screen.getByText('59 total responses')).toBeInTheDocument()
  })

  // Test 6: edge case -- calculates percentages correctly including zero-total
  it('calculates percentages correctly including zero-total edge case', () => {
    // Zero-total case: all counts are 0
    const zeroVoteCounts = new Map<string, number>()

    render(
      <ResultBars
        choices={mockChoices}
        voteCounts={zeroVoteCounts}
        userChoiceId="c1"
        totalResponses={0}
      />
    )

    // Should show 0% without NaN/Infinity
    const percentageTexts = screen.getAllByText('0%')
    expect(percentageTexts.length).toBeGreaterThanOrEqual(2)

    // Counts should be (0)
    const countTexts = screen.getAllByText('(0)')
    expect(countTexts).toHaveLength(2)

    // Meters should have aria-valuenow of 0
    const meters = screen.getAllByRole('meter')
    for (const meter of meters) {
      expect(meter).toHaveAttribute('aria-valuenow', '0')
    }

    // No NaN or Infinity anywhere
    expect(document.body.textContent).not.toContain('NaN')
    expect(document.body.textContent).not.toContain('Infinity')

    // Total responses (singular)
    expect(screen.getByText('0 total responses')).toBeInTheDocument()
  })
})

// First-paint contract: a voted poll whose results_hidden flag has not yet
// resolved (no map entry — the unknown window) must NOT leak vote counts.
// The gate must fail closed: render the censored placeholder, never ResultBars.
describe('Results visibility — first-paint fail-closed gate (RSLT-flash)', () => {
  const votedSuggestion = {
    id: 'poll-1',
    title: 'Remove MiG-29',
    description: 'A test description',
    status: 'active' as const,
    is_pinned: false,
    category_id: 'cat-1',
    categories: { id: 'cat-1', name: 'Rules', slug: 'rules', sort_order: 1, created_at: '' },
    choices: [
      { id: 'c1', label: 'Yes, remove it', sort_order: 1, poll_id: 'poll-1', created_at: '' },
      { id: 'c2', label: 'No, keep it', sort_order: 2, poll_id: 'poll-1', created_at: '' },
    ],
    closes_at: new Date(Date.now() + 86400000).toISOString(),
    closed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'user-1',
    image_url: null,
    resolution: null,
  }

  // Counts are already loaded — so a leak WOULD be visible if the gate were open.
  const populatedVoteCounts = new Map([
    ['poll-1', new Map<string, number>([['c1', 15], ['c2', 5]])],
  ])

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSuggestions.mockReturnValue({
      suggestions: [votedSuggestion],
      // The current user HAS voted (c1) — voted-poll branch is in play.
      userVotes: new Map([['poll-1', 'c1']]),
      loading: false,
      error: null,
      addOptimisticVote: vi.fn(),
    })
    mockUseCategories.mockReturnValue({
      categories: [{ id: 'cat-1', name: 'Rules', slug: 'rules', sort_order: 1, created_at: '' }],
      loading: false,
    })
  })

  it('does not render vote counts before results_hidden resolves (unknown window => hidden)', () => {
    // resultsHidden is EMPTY (map-miss = unknown / not-yet-fetched) while
    // voteCounts is already populated.
    mockUseVoteCounts.mockReturnValue({
      voteCounts: populatedVoteCounts,
      resultsHidden: new Map<string, boolean>(),
      refetchVoteCounts: vi.fn(),
    })

    render(<SuggestionList status="active" />)

    // No counts leaked: ResultBars (meter role + percentages) must NOT render.
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
    expect(screen.queryByText('75%')).not.toBeInTheDocument()
    // The censored placeholder shows instead.
    expect(screen.getByTestId('results-hidden-alert-poll-1')).toBeInTheDocument()
    expect(screen.getByText('Results temporarily hidden by admin')).toBeInTheDocument()
  })

  it('renders ResultBars once results_hidden resolves to false (no regression)', () => {
    mockUseVoteCounts.mockReturnValue({
      voteCounts: populatedVoteCounts,
      resultsHidden: new Map<string, boolean>([['poll-1', false]]),
      refetchVoteCounts: vi.fn(),
    })

    render(<SuggestionList status="active" />)

    // Flag resolved to visible => counts render.
    expect(screen.getAllByRole('meter')).toHaveLength(2)
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.queryByTestId('results-hidden-alert-poll-1')).not.toBeInTheDocument()
  })
})
