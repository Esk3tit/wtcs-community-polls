import { useState } from 'react'
import { X } from 'lucide-react'
import { useRouterState } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useConsent } from '@/hooks/useConsent'

// Phase 6 D-04: persistent footer chip with state-aware copy.
// - 'allow'    → "Anonymous usage analytics are on. Turn off"
// - 'decline'  → "Anonymous usage analytics are off. Turn on"
// - 'undecided'→ null (banner is in charge)
//
// Dismiss X is session-scope (existing posthog_consent_chip_dismissed key
// carries forward) — does NOT change the consent decision.

const DISMISS_KEY = 'posthog_consent_chip_dismissed'

export function ConsentChip() {
  const { state, allow, decline } = useConsent()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem(DISMISS_KEY) === 'true'
  })

  if (state === 'undecided') return null
  if (pathname.startsWith('/admin')) return null
  if (dismissed) return null

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  const isAllow = state === 'allow'
  const body = isAllow
    ? 'Anonymous usage analytics are on.'
    : 'Anonymous usage analytics are off.'
  const actionLabel = isAllow ? 'Turn off' : 'Turn on'
  const actionTitle = isAllow
    ? 'Stop sending anonymous analytics'
    : 'Start sending anonymous analytics'
  const handleAction = isAllow ? decline : allow

  return (
    <div className="fixed bottom-4 right-4 z-40 rounded-lg border bg-card shadow-md p-3 max-w-[min(20rem,calc(100vw-2rem))] transition-opacity">
      <div className="flex items-start gap-2">
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">
          {body}{' '}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 align-baseline"
            onClick={handleAction}
            title={actionTitle}
          >
            {actionLabel}
          </Button>
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={handleDismiss}
          aria-label="Dismiss"
          title="Hide this notice"
        >
          <X className="size-3" />
        </Button>
      </div>
    </div>
  )
}
