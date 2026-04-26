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

import { ConsentBanner } from '@/components/ConsentBanner'
import { ConsentProvider } from '@/contexts/ConsentContext'

function renderBanner() {
  return render(
    <ConsentProvider>
      <ConsentBanner />
    </ConsentProvider>,
  )
}

describe('ConsentBanner (UI-SPEC Surface 1 — first-visit GDPR opt-IN)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    currentPathname = '/'
  })

  it('renders verbatim copy on first visit (undecided state)', () => {
    renderBanner()
    expect(
      screen.getByText('We can record anonymous usage to help us improve this site.'),
    ).toBeInTheDocument()
    expect(screen.getByText('No tracking starts until you choose.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^allow$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^decline$/i })).toBeInTheDocument()
  })

  it('does not render when wtcs_consent === allow', () => {
    window.localStorage.setItem('wtcs_consent', 'allow')
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('does not render when wtcs_consent === decline', () => {
    window.localStorage.setItem('wtcs_consent', 'decline')
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('does not render on /admin/* routes', () => {
    currentPathname = '/admin/categories'
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('Allow click writes wtcs_consent=allow and removes banner from DOM', () => {
    renderBanner()
    fireEvent.click(screen.getByRole('button', { name: /^allow$/i }))
    expect(window.localStorage.getItem('wtcs_consent')).toBe('allow')
    expect(screen.queryByRole('button', { name: /^allow$/i })).not.toBeInTheDocument()
  })

  it('Decline click writes wtcs_consent=decline and removes banner from DOM', () => {
    renderBanner()
    fireEvent.click(screen.getByRole('button', { name: /^decline$/i }))
    expect(window.localStorage.getItem('wtcs_consent')).toBe('decline')
    expect(screen.queryByRole('button', { name: /^decline$/i })).not.toBeInTheDocument()
  })

  it('Dismiss X does NOT write wtcs_consent (banner re-shows on next mount)', () => {
    const { unmount } = renderBanner()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(window.localStorage.getItem('wtcs_consent')).toBeNull()
    unmount()
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
    window.sessionStorage.clear()
    unmount()
    renderBanner()
    expect(
      screen.getByText('We can record anonymous usage to help us improve this site.'),
    ).toBeInTheDocument()
  })

  it('Migrates legacy analytics_opted_out=true to decline (ConsentProvider one-shot)', () => {
    window.localStorage.setItem('analytics_opted_out', 'true')
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
    expect(window.localStorage.getItem('wtcs_consent')).toBe('decline')
    expect(window.localStorage.getItem('analytics_opted_out')).toBeNull()
  })
})
