import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/posthog', () => ({
  posthog: {
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
  initPostHog: vi.fn(),
}))
vi.mock('@/lib/sentry', () => ({
  loadSentryReplayIfConsented: vi.fn(),
}))

let currentPathname = '/'
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: currentPathname } }),
}))

import { ConsentChip } from '@/components/ConsentChip'
import { ConsentProvider } from '@/contexts/ConsentContext'

function renderChip() {
  return render(
    <ConsentProvider>
      <ConsentChip />
    </ConsentProvider>,
  )
}

describe('ConsentChip (UI-SPEC Surface 2 — flipped opt-IN state machine)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    currentPathname = '/'
  })

  it('renders null when consent state is undecided (banner is in charge)', () => {
    const { container } = renderChip()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders allow-state copy when wtcs_consent === allow', () => {
    window.localStorage.setItem('wtcs_consent', 'allow')
    renderChip()
    expect(screen.getByText('Anonymous usage analytics are on.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /turn off/i })).toBeInTheDocument()
  })

  it('renders decline-state copy when wtcs_consent === decline', () => {
    window.localStorage.setItem('wtcs_consent', 'decline')
    renderChip()
    expect(screen.getByText('Anonymous usage analytics are off.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /turn on/i })).toBeInTheDocument()
  })

  it('Turn off click in allow state writes wtcs_consent=decline', () => {
    window.localStorage.setItem('wtcs_consent', 'allow')
    renderChip()
    fireEvent.click(screen.getByRole('button', { name: /turn off/i }))
    expect(window.localStorage.getItem('wtcs_consent')).toBe('decline')
  })

  it('Turn on click in decline state writes wtcs_consent=allow', () => {
    window.localStorage.setItem('wtcs_consent', 'decline')
    renderChip()
    fireEvent.click(screen.getByRole('button', { name: /turn on/i }))
    expect(window.localStorage.getItem('wtcs_consent')).toBe('allow')
  })

  it('renders null when pathname starts with /admin', () => {
    window.localStorage.setItem('wtcs_consent', 'allow')
    currentPathname = '/admin/polls'
    const { container } = renderChip()
    expect(container).toBeEmptyDOMElement()
  })

  it('Dismiss X click sets posthog_consent_chip_dismissed only (no consent flip)', () => {
    // WR-05: dismiss writes to sessionStorage (matches banner tier — chip
    // re-appears on next tab/window) and never touches localStorage.
    window.localStorage.setItem('wtcs_consent', 'allow')
    renderChip()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(window.sessionStorage.getItem('posthog_consent_chip_dismissed')).toBe('true')
    expect(window.localStorage.getItem('posthog_consent_chip_dismissed')).toBeNull()
    expect(window.localStorage.getItem('wtcs_consent')).toBe('allow')
  })
})
