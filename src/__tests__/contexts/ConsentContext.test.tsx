import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ConsentProvider } from '@/contexts/ConsentContext'
import { useConsent } from '@/hooks/useConsent'
import { posthog } from '@/lib/posthog'
import { loadSentryReplayIfConsented } from '@/lib/sentry'

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

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
})

function Consumer() {
  const { state, allow, decline } = useConsent()
  return (
    <div>
      <span data-testid="state">{state}</span>
      <button data-testid="allow-btn" onClick={allow}>
        allow
      </button>
      <button data-testid="decline-btn" onClick={decline}>
        decline
      </button>
    </div>
  )
}

function withProvider(children: ReactNode) {
  return <ConsentProvider>{children}</ConsentProvider>
}

describe('ConsentContext', () => {
  it('starts undecided when localStorage is empty', () => {
    render(withProvider(<Consumer />))
    expect(screen.getByTestId('state').textContent).toBe('undecided')
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled()
    expect(posthog.opt_out_capturing).not.toHaveBeenCalled()
    expect(loadSentryReplayIfConsented).not.toHaveBeenCalled()
  })

  it('reads allow from localStorage on mount and triggers analytics on', () => {
    window.localStorage.setItem('wtcs_consent', 'allow')
    render(withProvider(<Consumer />))
    expect(screen.getByTestId('state').textContent).toBe('allow')
    expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(1)
    expect(loadSentryReplayIfConsented).toHaveBeenCalledTimes(1)
    expect(posthog.opt_out_capturing).not.toHaveBeenCalled()
  })

  it('reads decline from localStorage on mount and triggers analytics off', () => {
    window.localStorage.setItem('wtcs_consent', 'decline')
    render(withProvider(<Consumer />))
    expect(screen.getByTestId('state').textContent).toBe('decline')
    expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1)
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled()
    expect(loadSentryReplayIfConsented).not.toHaveBeenCalled()
  })

  it('migrates analytics_opted_out=true → decline (one-shot)', () => {
    window.localStorage.setItem('analytics_opted_out', 'true')
    render(withProvider(<Consumer />))
    expect(screen.getByTestId('state').textContent).toBe('decline')
    expect(window.localStorage.getItem('wtcs_consent')).toBe('decline')
    expect(window.localStorage.getItem('analytics_opted_out')).toBeNull()
    expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1)
  })

  it('allow() writes wtcs_consent=allow and triggers opt_in + loadSentryReplay', () => {
    render(withProvider(<Consumer />))
    fireEvent.click(screen.getByTestId('allow-btn'))
    expect(screen.getByTestId('state').textContent).toBe('allow')
    expect(window.localStorage.getItem('wtcs_consent')).toBe('allow')
    expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(1)
    expect(loadSentryReplayIfConsented).toHaveBeenCalledTimes(1)
    expect(posthog.opt_out_capturing).not.toHaveBeenCalled()
  })

  it('decline() writes wtcs_consent=decline and triggers opt_out', () => {
    render(withProvider(<Consumer />))
    fireEvent.click(screen.getByTestId('decline-btn'))
    expect(screen.getByTestId('state').textContent).toBe('decline')
    expect(window.localStorage.getItem('wtcs_consent')).toBe('decline')
    expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1)
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled()
    expect(loadSentryReplayIfConsented).not.toHaveBeenCalled()
  })

  it('storage event syncs state across tabs', () => {
    render(withProvider(<Consumer />))
    expect(screen.getByTestId('state').textContent).toBe('undecided')
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'wtcs_consent', newValue: 'allow' }),
      )
    })
    expect(screen.getByTestId('state').textContent).toBe('allow')
    expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(1)
    expect(loadSentryReplayIfConsented).toHaveBeenCalledTimes(1)
  })

  it('useConsent throws outside provider', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumer />)).toThrow(
      'useConsent must be used within a ConsentProvider',
    )
    errSpy.mockRestore()
  })

  it('decline() reloads the page when previous state was allow (P-02 — terminates live Replay)', () => {
    window.localStorage.setItem('wtcs_consent', 'allow')
    const reloadSpy = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    })

    render(withProvider(<Consumer />))
    fireEvent.click(screen.getByTestId('decline-btn'))

    expect(reloadSpy).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('wtcs_consent')).toBe('decline')

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('decline() does NOT reload when previous state was undecided', () => {
    const reloadSpy = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    })

    render(withProvider(<Consumer />))
    fireEvent.click(screen.getByTestId('decline-btn'))

    expect(reloadSpy).not.toHaveBeenCalled()

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })
})
