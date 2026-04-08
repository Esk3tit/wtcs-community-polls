import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock hooks
const mockUseSuggestions = vi.fn()
vi.mock('@/hooks/useSuggestions', () => ({
  useSuggestions: () => mockUseSuggestions(),
}))

const mockUseCategories = vi.fn()
vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => mockUseCategories(),
}))

const mockUseAuth = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/hooks/useVoteCounts', () => ({
  useVoteCounts: () => ({
    voteCounts: new Map(),
    refetchVoteCounts: vi.fn(),
  }),
}))

vi.mock('@/hooks/useVoteSubmit', () => ({
  useVoteSubmit: () => ({
    submitVote: vi.fn(),
    submittingPollId: null,
    submittingChoiceId: null,
  }),
}))

// Mock useDebounce to return value immediately (no delay)
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
}))

// Mock usePolling to no-op
vi.mock('@/hooks/usePolling', () => ({
  usePolling: vi.fn(),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Search: () => <span data-testid="search-icon" />,
  X: () => <span data-testid="x-icon" />,
  ChevronDown: () => <span data-testid="chevron-icon" />,
  Pin: () => <span data-testid="pin-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
  Check: () => <span data-testid="check-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
  SearchX: () => <span data-testid="search-x-icon" />,
  Inbox: () => <span data-testid="inbox-icon" />,
  Archive: () => <span data-testid="archive-icon" />,
}))

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    role,
    'aria-selected': ariaSelected,
  }: {
    children: React.ReactNode
    onClick?: (e: React.MouseEvent) => void
    role?: string
    'aria-selected'?: boolean
  }) => (
    <button onClick={onClick} role={role} aria-selected={ariaSelected}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}))

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/format', () => ({
  formatTimeRemaining: () => '7 days left',
  calcPercentage: (count: number, total: number) => {
    if (total === 0) return 0
    return Math.round((count / total) * 100)
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

import { SuggestionList } from '@/components/suggestions/SuggestionList'

// Helper to create mock suggestion objects
const mockSuggestion = (overrides: Record<string, unknown> = {}) => ({
  id: 'poll-1',
  title: 'Test Suggestion',
  description: 'A test description',
  status: 'active' as const,
  is_pinned: false,
  category_id: 'cat-1',
  categories: { id: 'cat-1', name: 'Rules', slug: 'rules', sort_order: 1, created_at: '' },
  choices: [
    { id: 'c1', label: 'Yes', sort_order: 1, poll_id: 'poll-1', created_at: '' },
    { id: 'c2', label: 'No', sort_order: 2, poll_id: 'poll-1', created_at: '' },
  ],
  closes_at: new Date(Date.now() + 86400000).toISOString(),
  closed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'user-1',
  image_url: null,
  resolution: null,
  ...overrides,
})

const mockCategories = [
  { id: 'cat-1', name: 'Rules', slug: 'rules', sort_order: 1, created_at: '' },
  { id: 'cat-2', name: 'Map Pool', slug: 'map-pool', sort_order: 2, created_at: '' },
]

describe('SuggestionList', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseAuth.mockReturnValue({
      user: { id: 'u1' },
      profile: null,
      loading: false,
      isAdmin: false,
      signOut: vi.fn(),
      signInWithDiscord: vi.fn(),
    })

    mockUseCategories.mockReturnValue({
      categories: mockCategories,
      loading: false,
    })
  })

  // Test 1: CATG-02 -- displays active suggestions from server-filtered query
  it('displays active suggestions from server-filtered query', () => {
    const suggestions = [
      mockSuggestion({ id: 'poll-1', title: 'Remove MiG-29' }),
      mockSuggestion({ id: 'poll-2', title: 'Add Sinai' }),
    ]

    mockUseSuggestions.mockReturnValue({
      suggestions,
      userVotes: new Map(),
      loading: false,
      addOptimisticVote: vi.fn(),
    })

    render(<SuggestionList status="active" />)

    expect(screen.getByText('Remove MiG-29')).toBeInTheDocument()
    expect(screen.getByText('Add Sinai')).toBeInTheDocument()
    expect(screen.getByText('Active Topics')).toBeInTheDocument()
  })

  // Test 2: CATG-03 -- filters by category when pill is clicked
  it('filters by category when pill is clicked', async () => {
    const suggestions = [
      mockSuggestion({
        id: 'poll-1',
        title: 'Rules Suggestion',
        category_id: 'cat-1',
        categories: mockCategories[0],
      }),
      mockSuggestion({
        id: 'poll-2',
        title: 'Map Pool Suggestion',
        category_id: 'cat-2',
        categories: mockCategories[1],
      }),
    ]

    mockUseSuggestions.mockReturnValue({
      suggestions,
      userVotes: new Map(),
      loading: false,
      addOptimisticVote: vi.fn(),
    })

    render(<SuggestionList status="active" />)

    // Both visible initially
    expect(screen.getByText('Rules Suggestion')).toBeInTheDocument()
    expect(screen.getByText('Map Pool Suggestion')).toBeInTheDocument()

    // Click "Map Pool" category pill (use role=tab to target the filter, not the badge)
    const tabs = screen.getAllByRole('tab')
    const mapPoolTab = tabs.find((t) => t.textContent === 'Map Pool')!
    fireEvent.click(mapPoolTab)

    // Only Map Pool suggestion should be visible
    expect(screen.queryByText('Rules Suggestion')).not.toBeInTheDocument()
    expect(screen.getByText('Map Pool Suggestion')).toBeInTheDocument()
  })

  // Test 3: CATG-04 -- searches by text with debounced input
  it('searches by text with debounced input', async () => {
    const suggestions = [
      mockSuggestion({ id: 'poll-1', title: 'Remove MiG-29' }),
      mockSuggestion({ id: 'poll-2', title: 'Add Sinai' }),
    ]

    mockUseSuggestions.mockReturnValue({
      suggestions,
      userVotes: new Map(),
      loading: false,
      addOptimisticVote: vi.fn(),
    })

    render(<SuggestionList status="active" />)

    // Both visible initially
    expect(screen.getByText('Remove MiG-29')).toBeInTheDocument()
    expect(screen.getByText('Add Sinai')).toBeInTheDocument()

    // Type in search
    const searchInput = screen.getByLabelText('Search topics')
    fireEvent.change(searchInput, { target: { value: 'MiG' } })

    // Only matching suggestion visible (debounce is mocked to be instant)
    expect(screen.getByText('Remove MiG-29')).toBeInTheDocument()
    expect(screen.queryByText('Add Sinai')).not.toBeInTheDocument()
  })

  // Test 4: CATG-04 -- shows no-matches empty state when filters exclude all
  it('shows no-matches empty state when filters exclude all suggestions', () => {
    const suggestions = [
      mockSuggestion({ id: 'poll-1', title: 'Remove MiG-29' }),
    ]

    mockUseSuggestions.mockReturnValue({
      suggestions,
      userVotes: new Map(),
      loading: false,
      addOptimisticVote: vi.fn(),
    })

    render(<SuggestionList status="active" />)

    // Search for something that matches nothing
    const searchInput = screen.getByLabelText('Search topics')
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

    expect(screen.getByText('No topics match your search')).toBeInTheDocument()
  })

  // Test 5: CATG-02 -- shows no-active empty state when no suggestions exist
  it('shows no-active empty state when no suggestions exist', () => {
    mockUseSuggestions.mockReturnValue({
      suggestions: [],
      userVotes: new Map(),
      loading: false,
      addOptimisticVote: vi.fn(),
    })

    render(<SuggestionList status="active" />)

    expect(screen.getByText('No active topics right now.')).toBeInTheDocument()
  })

  // Test 6: combined category + search filtering
  it('combined category + search filtering works correctly', () => {
    const suggestions = [
      mockSuggestion({
        id: 'poll-1',
        title: 'Remove MiG-29 from lineup',
        category_id: 'cat-1',
        categories: mockCategories[0],
      }),
      mockSuggestion({
        id: 'poll-2',
        title: 'Add Sinai map',
        category_id: 'cat-2',
        categories: mockCategories[1],
      }),
      mockSuggestion({
        id: 'poll-3',
        title: 'Allow mixed nations in rules',
        category_id: 'cat-1',
        categories: mockCategories[0],
      }),
    ]

    mockUseSuggestions.mockReturnValue({
      suggestions,
      userVotes: new Map(),
      loading: false,
      addOptimisticVote: vi.fn(),
    })

    render(<SuggestionList status="active" />)

    // All three visible initially
    expect(screen.getByText('Remove MiG-29 from lineup')).toBeInTheDocument()
    expect(screen.getByText('Add Sinai map')).toBeInTheDocument()
    expect(screen.getByText('Allow mixed nations in rules')).toBeInTheDocument()

    // Click "Rules" category filter (use role=tab to target the filter, not badges)
    const tabs = screen.getAllByRole('tab')
    const rulesTab = tabs.find((t) => t.textContent === 'Rules')!
    fireEvent.click(rulesTab)

    // Only Rules suggestions visible (poll-1 and poll-3)
    expect(screen.getByText('Remove MiG-29 from lineup')).toBeInTheDocument()
    expect(screen.queryByText('Add Sinai map')).not.toBeInTheDocument()
    expect(screen.getByText('Allow mixed nations in rules')).toBeInTheDocument()

    // Now also search for "MiG"
    const searchInput = screen.getByLabelText('Search topics')
    fireEvent.change(searchInput, { target: { value: 'MiG' } })

    // Only poll-1 matches both Rules category AND "MiG" search
    expect(screen.getByText('Remove MiG-29 from lineup')).toBeInTheDocument()
    expect(screen.queryByText('Allow mixed nations in rules')).not.toBeInTheDocument()
    expect(screen.queryByText('Add Sinai map')).not.toBeInTheDocument()
  })
})
