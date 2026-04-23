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

  it('switches aria-label to "Loading archive" when isArchive is true', () => {
    const { container } = render(<SuggestionSkeleton isArchive />)
    const wrapper = container.querySelector('[aria-busy="true"]')
    expect(wrapper?.getAttribute('aria-label')).toBe('Loading archive')
  })

  it('renders exactly 3 card silhouette shells with shadow-sm parity with SuggestionCard', () => {
    const { container } = render(<SuggestionSkeleton />)
    // The stricter shadow-sm selector also covers the bare outer-class assertion
    // (every match here is by definition also a .bg-card.rounded-xl.border.p-5).
    const cardShells = container.querySelectorAll(
      '.bg-card.rounded-xl.border.shadow-sm.p-5',
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

  it('renders no <img> tags and no visible text (purely visual; sr-only allowed)', () => {
    const { container } = render(<SuggestionSkeleton />)
    expect(container.querySelector('img')).toBeNull()
    // Allow visually-hidden a11y text (e.g. <span class="sr-only">Loading…</span>)
    // — the aria-busy + aria-label assertions above already cover the screen-reader
    // contract. Strip any .sr-only subtree before checking for visible text.
    const clone = container.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.sr-only').forEach((el) => el.remove())
    expect(clone.textContent?.trim() ?? '').toBe('')
  })
})
