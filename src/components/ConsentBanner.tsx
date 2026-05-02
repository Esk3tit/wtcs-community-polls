import { useState } from 'react'
import { X } from 'lucide-react'
import { useRouterState } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useConsent } from '@/hooks/useConsent'
import { CONSENT_CARD_MAX_W } from '@/lib/consent-styles'

// First-visit non-blocking GDPR opt-IN banner. Renders only when consent is
// 'undecided' and not on /admin/*. Dismiss X is session-scoped so the banner
// re-shows on next page load.

const SESSION_DISMISS_KEY = 'wtcs_consent_banner_dismissed_session'

export function ConsentBanner() {
  const { state, allow, decline } = useConsent()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [sessionDismissed, setSessionDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true'
  })

  if (state !== 'undecided') return null
  if (pathname.startsWith('/admin')) return null
  if (sessionDismissed) return null

  const handleDismiss = () => {
    window.sessionStorage.setItem(SESSION_DISMISS_KEY, 'true')
    setSessionDismissed(true)
  }

  return (
    <div
      role="region"
      aria-label="Anonymous usage analytics consent"
      className={`fixed bottom-4 right-4 z-40 rounded-lg border bg-card shadow-md p-4 ${CONSENT_CARD_MAX_W} transition-opacity`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground leading-relaxed">
            We can record anonymous usage to help us improve this site.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            No tracking starts until you choose.
          </p>
          <div className="flex gap-2 mt-3">
            {/* min-h-11 (44px) meets WCAG 2.5.5 / Apple HIG mobile touch-target minimum; shadcn default Button (~36px) misses it on iOS. */}
            <Button className="min-h-11" onClick={allow}>Allow</Button>
            <Button variant="outline" className="min-h-11" onClick={decline}>Decline</Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X className="size-3" />
        </Button>
      </div>
    </div>
  )
}
