import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useRouterState } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { posthog } from '@/lib/posthog'
import { loadSentryReplayIfConsented } from '@/lib/sentry'

// UI-SPEC Contract 3 — PostHog Consent Indicator Chip.
// Fixed bottom-right overlay; hidden on /admin/* routes (admins are WTCS team;
// implicit consent). Dismissal persists via localStorage.
//
// M1 contract (05-PLAN, codex review):
//  - On mount (not /admin, not already dismissed-as-opt-out) we call
//    loadSentryReplayIfConsented(). That helper itself checks the
//    `analytics_opted_out` flag, so it is safe to call unconditionally.
//  - Opt out click sets BOTH `posthog_consent_chip_dismissed=true` AND
//    `analytics_opted_out=true` so the Replay lazy-loader blocks on next boot.
//  - Dismiss (X) click sets ONLY `posthog_consent_chip_dismissed=true` —
//    analytics continue, Replay already attached if it was going to.

const DISMISS_KEY = 'posthog_consent_chip_dismissed'
const OPT_OUT_KEY = 'analytics_opted_out'

export function ConsentChip() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem(DISMISS_KEY) === 'true'
  })

  useEffect(() => {
    // M1 — lazy-attach Sentry Replay for users who haven't opted out.
    // The helper itself is idempotent and guards on the opt-out flag.
    void loadSentryReplayIfConsented()
  }, [])

  if (dismissed) return null
  if (pathname.startsWith('/admin')) return null

  const handleOptOut = () => {
    posthog.opt_out_capturing()
    window.localStorage.setItem(DISMISS_KEY, 'true')
    window.localStorage.setItem(OPT_OUT_KEY, 'true')
    setDismissed(true)
  }

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 rounded-lg border bg-card shadow-md p-3 max-w-[min(20rem,calc(100vw-2rem))] transition-opacity">
      <div className="flex items-start gap-2">
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">
          Anonymous usage data helps us improve this.{' '}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 align-baseline"
            onClick={handleOptOut}
            title="Stop sending anonymous analytics — persists across sessions"
          >
            Opt out
          </Button>
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={handleDismiss}
          aria-label="Dismiss"
          title="Hide this notice — analytics remain on"
        >
          <X className="size-3" />
        </Button>
      </div>
    </div>
  )
}
