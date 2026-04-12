import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminTabs } from '@/components/admin/AdminTabs'

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}))

// Stub out the admins/categories list children so this test stays focused on
// the shell; their own test files exercise them end-to-end.
vi.mock('@/components/admin/CategoriesList', () => ({
  CategoriesList: () => <div data-testid="stub-categories-list" />,
}))

vi.mock('@/components/admin/AdminsList', () => ({
  AdminsList: () => <div data-testid="stub-admins-list" />,
}))

describe('AdminTabs', () => {
  it('renders all three tab triggers', () => {
    render(<AdminTabs />)
    expect(screen.getByRole('tab', { name: 'Suggestions' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Categories' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Admins' })).toBeInTheDocument()
  })

  it('defaults to Suggestions tab when no ?tab= search param is present', () => {
    render(<AdminTabs />)
    expect(screen.getByRole('tab', { name: 'Suggestions' })).toHaveAttribute(
      'data-state',
      'active',
    )
  })
})

describe('admin hook modules', () => {
  it('exports useCategoryMutations', async () => {
    const mod = await import('@/hooks/useCategoryMutations')
    expect(typeof mod.useCategoryMutations).toBe('function')
  })
  it('exports usePromoteAdmin', async () => {
    const mod = await import('@/hooks/usePromoteAdmin')
    expect(typeof mod.usePromoteAdmin).toBe('function')
  })
  it('exports useDemoteAdmin', async () => {
    const mod = await import('@/hooks/useDemoteAdmin')
    expect(typeof mod.useDemoteAdmin).toBe('function')
  })
  it('exports useSearchAdminTargets', async () => {
    const mod = await import('@/hooks/useSearchAdminTargets')
    expect(typeof mod.useSearchAdminTargets).toBe('function')
  })
})
