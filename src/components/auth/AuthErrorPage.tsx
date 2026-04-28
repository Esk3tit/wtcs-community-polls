import { useEffect } from 'react'
import { ShieldAlert, Clock, AlertCircle, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import * as Sentry from '@sentry/react'

interface AuthErrorPageProps {
  reason: '2fa-required' | 'session-expired' | 'auth-failed' | 'not-in-server'
}

const errorConfig = {
  '2fa-required': {
    icon: ShieldAlert,
    heading: 'Two-Factor Authentication Required',
    body: 'To keep responses authentic, we require 2FA on your Discord account. It takes about a minute to set up.',
    primaryLabel: 'Set Up 2FA on Discord',
    primaryHref: 'https://support.discord.com/hc/en-us/articles/219576828',
    secondaryLabel: 'Try Signing In Again',
  },
  'not-in-server': {
    icon: Users,
    heading: 'WTCS Server Membership Required',
    body: 'You need to be a member of the official WTCS Discord server to participate in community suggestions.',
    primaryLabel: 'Join the WTCS Discord Server',
    primaryHref: 'https://discord.gg/aUe8NGP3U2',
    secondaryLabel: 'Try Signing In Again',
  },
  'session-expired': {
    icon: Clock,
    heading: 'Session Expired',
    body: 'Your login session has ended. Sign in again to continue.',
    primaryLabel: 'Sign in with Discord',
    primaryHref: null,
    secondaryLabel: null,
  },
  'auth-failed': {
    icon: AlertCircle,
    heading: 'Something Went Wrong',
    body: 'Could not complete your login. Try again in a moment. If it keeps happening, let us know in the Discord server.',
    primaryLabel: 'Try Signing In Again',
    primaryHref: null,
    secondaryLabel: null,
  },
}

export function AuthErrorPage({ reason }: AuthErrorPageProps) {
  const { signInWithDiscord } = useAuth()
  const config = errorConfig[reason] || errorConfig['auth-failed']
  const Icon = config.icon

  useEffect(() => {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'AuthErrorPage rendered',
      level: 'warning',
      data: { reason },
    })
  }, [reason])

  return (
    <div className="max-w-md mx-auto py-16 md:py-24">
      <Card className="bg-card rounded-xl border p-8">
        <div className="text-center">
          <Icon className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-center mt-4">{config.heading}</h1>
          <p className="text-sm text-muted-foreground text-center mt-2">{config.body}</p>

          {config.primaryHref ? (
            <Button asChild className="w-full mt-6">
              <a href={config.primaryHref} target="_blank" rel="noopener noreferrer">
                {config.primaryLabel}
              </a>
            </Button>
          ) : (
            <Button className="w-full mt-6" onClick={signInWithDiscord}>
              {config.primaryLabel}
            </Button>
          )}

          {config.secondaryLabel && (
            <Button variant="ghost" className="w-full mt-2" onClick={signInWithDiscord}>
              {config.secondaryLabel}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
