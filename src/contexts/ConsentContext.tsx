/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { posthog } from '@/lib/posthog'
import { loadSentryReplayIfConsented } from '@/lib/sentry'

// Phase 6 D-04 — GDPR opt-IN consent state, single source of truth.
//
// Storage contract (UI-SPEC Storage table):
// - `wtcs_consent` (this file's STORAGE_KEY) — values: 'allow' | 'decline'.
//   Absent key means 'undecided' (default-OFF state).
// - `analytics_opted_out` (LEGACY_OPT_OUT_KEY) — Phase 5's opt-OUT flag.
//   We migrate it once on first read: if `analytics_opted_out === 'true'`
//   AND `wtcs_consent` absent, we set `wtcs_consent='decline'` (the safe
//   opt-OUT-equivalent under opt-IN semantics) AND remove the legacy key.
//   This is one-shot — subsequent reads see only `wtcs_consent`.

export type ConsentState = 'undecided' | 'allow' | 'decline'
const STORAGE_KEY = 'wtcs_consent'
const LEGACY_OPT_OUT_KEY = 'analytics_opted_out'

export interface ConsentContextValue {
  state: ConsentState
  allow: () => void
  decline: () => void
}

function readConsent(): ConsentState {
  if (typeof window === 'undefined') return 'undecided'
  const v = window.localStorage.getItem(STORAGE_KEY)
  if (v === 'allow' || v === 'decline') return v
  // One-shot migration: Phase 5 opt-OUT users → 'decline' (safe default under opt-IN).
  if (window.localStorage.getItem(LEGACY_OPT_OUT_KEY) === 'true') {
    window.localStorage.setItem(STORAGE_KEY, 'decline')
    window.localStorage.removeItem(LEGACY_OPT_OUT_KEY)
    return 'decline'
  }
  return 'undecided'
}

export const ConsentContext = createContext<ConsentContextValue | undefined>(undefined)

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConsentState>(() => readConsent())

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

  // Side-effect bridge: on 'allow' enable analytics + lazy-attach Replay.
  // On 'decline' disable analytics. (Replay does not detach mid-session;
  // RESEARCH.md Pitfall 7 documents the leak — accepted for v1.0.)
  useEffect(() => {
    if (state === 'allow') {
      posthog.opt_in_capturing()
      void loadSentryReplayIfConsented()
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
    // Phase 6 P-02 (REVIEWS.md): if the user is flipping FROM allow TO decline,
    // reload the page to terminate any active Sentry Replay session.
    // Replay does not support runtime detach (RESEARCH.md Pitfall 7).
    // We only reload when there is actually a live session to kill — a fresh
    // decline from 'undecided' or 'decline' does nothing surprising.
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
