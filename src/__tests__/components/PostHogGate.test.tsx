import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PostHogGate } from '@/components/PostHogGate'

// Mock useConsent so we can drive all three consent states without a real
// ConsentProvider — PostHogGate's only external dependency is this hook.
const mockUseConsent = vi.fn()
vi.mock('@/hooks/useConsent', () => ({
  useConsent: () => mockUseConsent(),
}))

// Mock PostHogProviderInner as a pure side-effect spy that renders null.
// The loader renders null by design, so we assert its MOUNT via the spy rather
// than any DOM output — the spy being called proves the lazy import resolved
// and the component was mounted.
const loaderSpy = vi.fn()
vi.mock('@/components/PostHogProviderInner', () => ({
  PostHogProviderInner: () => {
    loaderSpy()
    return null
  },
}))

beforeEach(() => {
  loaderSpy.mockClear()
})

describe('PostHogGate', () => {
  it('renders children when state is undecided — loader NOT mounted', () => {
    mockUseConsent.mockReturnValue({ state: 'undecided' })
    render(
      <PostHogGate>
        <div data-testid="children">CHILD</div>
      </PostHogGate>,
    )
    expect(screen.getByTestId('children')).toBeInTheDocument()
    expect(loaderSpy).not.toHaveBeenCalled()
  })

  it('renders children when state is decline — loader NOT mounted', () => {
    mockUseConsent.mockReturnValue({ state: 'decline' })
    render(
      <PostHogGate>
        <div data-testid="children">CHILD</div>
      </PostHogGate>,
    )
    expect(screen.getByTestId('children')).toBeInTheDocument()
    expect(loaderSpy).not.toHaveBeenCalled()
  })

  it('renders children synchronously when state is allow — children never blank (HIGH regression guard)', async () => {
    // This is the regression guard for the verified HIGH finding: the original
    // child-wrapping design placed children inside the <Suspense> boundary,
    // causing the router to blank/remount during the lazy import window.
    // With children as a SIBLING of <Suspense>, they must be present on the
    // FIRST synchronous render — before the lazy import resolves.
    mockUseConsent.mockReturnValue({ state: 'allow' })
    render(
      <PostHogGate>
        <div data-testid="children">CHILD</div>
      </PostHogGate>,
    )
    // Synchronous assertion — children must be present immediately, not after an await.
    expect(screen.getByTestId('children')).toBeInTheDocument()
    // Then the loader spy resolves async via the mocked dynamic import.
    await waitFor(() => expect(loaderSpy).toHaveBeenCalled())
  })

  it('mounts the lazy loader only when state is allow — loader spy eventually called', async () => {
    mockUseConsent.mockReturnValue({ state: 'allow' })
    render(
      <PostHogGate>
        <div data-testid="children">CHILD</div>
      </PostHogGate>,
    )
    expect(screen.getByTestId('children')).toBeInTheDocument()
    await waitFor(() => expect(loaderSpy).toHaveBeenCalled())
    expect(loaderSpy).toHaveBeenCalledTimes(1)
  })
})
