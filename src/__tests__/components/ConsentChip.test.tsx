import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock posthog module — capture opt_out_capturing calls
const mockOptOut = vi.fn()
vi.mock('@/lib/posthog', () => ({
  posthog: {
    opt_out_capturing: (...args: unknown[]) => mockOptOut(...args),
    identify: vi.fn(),
    reset: vi.fn(),
  },
  initPostHog: vi.fn(),
}))

// Mock sentry lazy-loader — must be called exactly once per mount when not opted-out
const mockLoadReplay = vi.fn()
vi.mock('@/lib/sentry', () => ({
  loadSentryReplayIfConsented: () => mockLoadReplay(),
}))

// Mock TanStack Router — useRouterState returns a controllable pathname
let currentPathname = '/'
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: currentPathname } }),
}))

import { ConsentChip } from '@/components/ConsentChip'

describe('ConsentChip (UI-SPEC Contract 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    currentPathname = '/'
  })

  it('renders the default copy verbatim', () => {
    render(<ConsentChip />)
    expect(screen.getByText(/Anonymous usage data helps us improve this\./)).toBeInTheDocument()
  })

  it('renders null when localStorage.posthog_consent_chip_dismissed is already true', () => {
    window.localStorage.setItem('posthog_consent_chip_dismissed', 'true')
    const { container } = render(<ConsentChip />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders null when pathname starts with /admin', () => {
    currentPathname = '/admin/polls'
    const { container } = render(<ConsentChip />)
    expect(container).toBeEmptyDOMElement()
  })

  it('Opt out click: calls posthog.opt_out_capturing() AND sets both localStorage flags (M1 gate for Replay)', () => {
    render(<ConsentChip />)
    fireEvent.click(screen.getByRole('button', { name: /opt out/i }))
    expect(mockOptOut).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('posthog_consent_chip_dismissed')).toBe('true')
    expect(window.localStorage.getItem('analytics_opted_out')).toBe('true')
  })

  it('Dismiss X click: sets ONLY posthog_consent_chip_dismissed (analytics continue)', () => {
    render(<ConsentChip />)
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissBtn)
    expect(window.localStorage.getItem('posthog_consent_chip_dismissed')).toBe('true')
    expect(window.localStorage.getItem('analytics_opted_out')).toBeNull()
    expect(mockOptOut).not.toHaveBeenCalled()
  })

  it('calls loadSentryReplayIfConsented on mount (M1)', () => {
    render(<ConsentChip />)
    expect(mockLoadReplay).toHaveBeenCalledTimes(1)
  })
})
