import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { CategoriesList } from '@/components/admin/CategoriesList'

// --- Mocks ---------------------------------------------------------------

const useCategoriesMock = vi.fn(() => ({
  categories: [
    { id: 'c1', name: 'Balance', sort_order: 1 },
    { id: 'c2', name: 'Bugs', sort_order: 2 },
  ],
  loading: false,
  error: null,
  refetch: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => useCategoriesMock(),
}))

vi.mock('@/hooks/useCategoryMutations', () => ({
  useCategoryMutations: () => ({
    create: vi.fn().mockResolvedValue({ ok: true, category: { id: 'c3', name: 'New' } }),
    rename: vi.fn().mockResolvedValue({ ok: true }),
    remove: vi.fn().mockResolvedValue({ ok: true }),
    submitting: false,
  }),
}))

// D-21 LOW fix: supabase.from('polls') count query returns 5 by default.
// Individual tests override this mock when needed.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ count: 5, error: null }),
      }),
    }),
    functions: {
      invoke: vi.fn(),
    },
  },
}))

// --- Tests ---------------------------------------------------------------

describe('CategoriesList', () => {
  beforeEach(() => {
    cleanup()
    useCategoriesMock.mockReturnValue({
      categories: [
        { id: 'c1', name: 'Balance', sort_order: 1 },
        { id: 'c2', name: 'Bugs', sort_order: 2 },
      ],
      loading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('renders header with title and New category button', () => {
    render(<CategoriesList />)
    expect(screen.getByText('Categories')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /new category/i }),
    ).toBeInTheDocument()
  })

  it('renders both categories', () => {
    render(<CategoriesList />)
    expect(screen.getByText('Balance')).toBeInTheDocument()
    expect(screen.getByText('Bugs')).toBeInTheDocument()
  })

  it('opens delete dialog with the REAL affected count (D-21 LOW fix)', async () => {
    render(<CategoriesList />)
    const trashButtons = screen.getAllByLabelText(/delete category/i)
    fireEvent.click(trashButtons[0])
    await waitFor(() =>
      expect(screen.getByText('Delete category?')).toBeInTheDocument(),
    )
    // The mocked count query returned 5 — dialog body must show that number.
    expect(
      screen.getByText(/5 suggestions will become uncategorized/i),
    ).toBeInTheDocument()
  })

  it('enters edit mode when pencil button clicked', () => {
    render(<CategoriesList />)
    const editButtons = screen.getAllByLabelText(/edit category/i)
    fireEvent.click(editButtons[0])
    expect(screen.getByDisplayValue('Balance')).toBeInTheDocument()
  })

  it('inserts a blank edit row when New category clicked', () => {
    render(<CategoriesList />)
    fireEvent.click(screen.getByRole('button', { name: /new category/i }))
    expect(
      screen.getByPlaceholderText('New category name'),
    ).toBeInTheDocument()
  })
})

describe('CategoriesList error state (MEDIUM #7)', () => {
  beforeEach(() => {
    cleanup()
  })

  it('renders Alert + Retry button on fetch failure instead of silent empty', () => {
    useCategoriesMock.mockReturnValueOnce({
      categories: [],
      loading: false,
      // @ts-expect-error — runtime shape acceptable, string is fine for the UI branch
      error: 'network',
      refetch: vi.fn(),
    })
    render(<CategoriesList />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/couldn't load categories/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /retry/i }),
    ).toBeInTheDocument()
  })
})
