import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

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

const pathRef = vi.hoisted(() => ({ current: '/' }))
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: pathRef.current } }),
}))

import { ConsentBanner } from '@/components/ConsentBanner'
import { ConsentChip } from '@/components/ConsentChip'
import { ConsentProvider } from '@/contexts/ConsentContext'

const BANNER_COPY = 'We can record anonymous usage to help us improve this site.'
const CHIP_ON_COPY = 'Anonymous usage analytics are on.'
const CHIP_OFF_COPY = 'Anonymous usage analytics are off.'

function renderBoth() {
  return render(
    <ConsentProvider>
      <ConsentBanner />
      <ConsentChip />
    </ConsentProvider>,
  )
}

describe('ConsentBanner + ConsentChip mutual exclusion (UI-REVIEW Fix #1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    pathRef.current = '/'
  })

  it('undecided: only the banner renders, chip is suppressed', () => {
    renderBoth()
    expect(screen.getByText(BANNER_COPY)).toBeInTheDocument()
    expect(screen.queryByText(CHIP_ON_COPY)).not.toBeInTheDocument()
    expect(screen.queryByText(CHIP_OFF_COPY)).not.toBeInTheDocument()
  })

  it('allow: only the chip renders (allow-state copy), banner is suppressed', () => {
    window.localStorage.setItem('wtcs_consent', 'allow')
    renderBoth()
    expect(screen.queryByText(BANNER_COPY)).not.toBeInTheDocument()
    expect(screen.getByText(CHIP_ON_COPY)).toBeInTheDocument()
    expect(screen.queryByText(CHIP_OFF_COPY)).not.toBeInTheDocument()
  })

  it('decline: only the chip renders (decline-state copy), banner is suppressed', () => {
    window.localStorage.setItem('wtcs_consent', 'decline')
    renderBoth()
    expect(screen.queryByText(BANNER_COPY)).not.toBeInTheDocument()
    expect(screen.queryByText(CHIP_ON_COPY)).not.toBeInTheDocument()
    expect(screen.getByText(CHIP_OFF_COPY)).toBeInTheDocument()
  })

  it('admin route: both surfaces are suppressed regardless of consent state', () => {
    window.localStorage.setItem('wtcs_consent', 'allow')
    pathRef.current = '/admin/categories'
    const { container } = renderBoth()
    expect(container).toBeEmptyDOMElement()
  })
})
