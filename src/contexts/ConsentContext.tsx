/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { posthog } from '@/lib/posthog-facade'
import { loadSentryReplayIfConsented } from '@/lib/sentry'

// GDPR opt-IN consent state — single source of truth.
// `wtcs_consent` ('allow' | 'decline'; absent = undecided/default-OFF).
// `analytics_opted_out` is the legacy opt-OUT flag from before the rewire;
// migrated once on first read into `wtcs_consent='decline'`.
export type ConsentState = 'undecided' | 'allow' | 'decline'
const STORAGE_KEY = 'wtcs_consent'
const LEGACY_OPT_OUT_KEY = 'analytics_opted_out'

export interface ConsentContextValue {
  state: ConsentState
  allow: () => void
  decline: () => void
}

// Read-only: the render path must stay pure, so this only computes the
// initial state. A legacy opt-OUT user resolves to 'decline' here; the actual
// localStorage migration write is deferred to a mount effect.
function readConsent(): ConsentState {
  if (typeof window === 'undefined') return 'undecided'
  const v = window.localStorage.getItem(STORAGE_KEY)
  if (v === 'allow' || v === 'decline') return v
  if (window.localStorage.getItem(LEGACY_OPT_OUT_KEY) === 'true') return 'decline'
  return 'undecided'
}

export const ConsentContext = createContext<ConsentContextValue | undefined>(undefined)

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConsentState>(() => readConsent())

  // One-shot migration of legacy opt-OUT users to opt-IN-equivalent decline.
  // The write lives in an effect (not the lazy initializer) to keep the render
  // path pure; the initial 'decline' state is already resolved by readConsent().
  useEffect(() => {
    if (
      window.localStorage.getItem(STORAGE_KEY) === null &&
      window.localStorage.getItem(LEGACY_OPT_OUT_KEY) === 'true'
    ) {
      window.localStorage.setItem(STORAGE_KEY, 'decline')
      window.localStorage.removeItem(LEGACY_OPT_OUT_KEY)
    }
  }, [])

  // Cross-tab sync: only fires for OTHER-tab writes, never own-tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const next = e.newValue
      if (next === 'allow' || next === 'decline') setState(next)
      else setState('undecided')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Replay does not support runtime detach — see decline() below for the
  // allow→decline transition that reloads the page to terminate the session.
  useEffect(() => {
    if (state === 'allow') {
      posthog.opt_in_capturing()
      // Surface a rejected Replay load instead of swallowing it. loadSentryReplayIfConsented
      // is async (its body throws become promise rejections, never a synchronous
      // throw), so Promise.resolve(...) routes every error to .catch.
      Promise.resolve(loadSentryReplayIfConsented()).catch((err) =>
        console.error('[consent] sentry replay load failed:', err),
      )
    } else if (state === 'decline') {
      posthog.opt_out_capturing()
    }
  }, [state])

  const allow = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, 'allow')
    setState('allow')
  }, [])

  const decline = useCallback(() => {
    const previous = window.localStorage.getItem(STORAGE_KEY)
    window.localStorage.setItem(STORAGE_KEY, 'decline')
    setState('decline')
    // Reload only on allow→decline so an active Replay session is actually
    // terminated; declines from 'undecided' or 'decline' don't need it.
    if (previous === 'allow') {
      window.location.reload()
    }
  }, [])

  return (
    <ConsentContext.Provider value={{ state, allow, decline }}>
      {children}
    </ConsentContext.Provider>
  )
}
