import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import { SuggestionSkeleton } from '@/components/suggestions/SuggestionSkeleton'

/**
 * UI-SPEC Contract 1 — SuggestionSkeleton silhouette must mirror
 * the real SuggestionCard outer shell (bg-card rounded-xl border p-5)
 * and render exactly 3 card-silhouette rows with multiple shimmer elements.
 */
describe('SuggestionSkeleton (UI-SPEC Contract 1)', () => {
  it('renders an outer wrapper with aria-busy and aria-label', () => {
    const { container } = render(<SuggestionSkeleton />)
    const wrapper = container.querySelector('[aria-busy="true"]')
    expect(wrapper).not.toBeNull()
    expect(wrapper?.getAttribute('aria-label')).toBe('Loading topics')
  })

  it('renders exactly 3 card silhouette shells matching SuggestionCard outer classes', () => {
    const { container } = render(<SuggestionSkeleton />)
    const cardShells = container.querySelectorAll(
      '.bg-card.rounded-xl.border.p-5',
    )
    expect(cardShells.length).toBe(3)
  })

  it('uses space-y-3 gap on the list wrapper', () => {
    const { container } = render(<SuggestionSkeleton />)
    const wrapper = container.querySelector('[aria-busy="true"]')
    expect(wrapper?.className).toMatch(/\bspace-y-3\b/)
  })

  it('contains a circular avatar placeholder (rounded-full h-6 w-6) on each card', () => {
    const { container } = render(<SuggestionSkeleton />)
    const avatars = container.querySelectorAll('.rounded-full.h-6.w-6')
    expect(avatars.length).toBe(3)
  })

  it('has at least 6 shimmer elements with animate-pulse (multiple rows per card)', () => {
    const { container } = render(<SuggestionSkeleton />)
    const shimmers = container.querySelectorAll('.animate-pulse')
    expect(shimmers.length).toBeGreaterThanOrEqual(6)
  })

  it('renders no <img> tags and no text content (purely visual)', () => {
    const { container } = render(<SuggestionSkeleton />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent?.trim() ?? '').toBe('')
  })
})
