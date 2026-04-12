import { useEffect, useState, useCallback, useRef } from 'react'
import { UserMinus, AlertCircle, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { PromoteAdminDialog } from './PromoteAdminDialog'
import { DemoteAdminDialog } from './DemoteAdminDialog'

type Admin = {
  id: string
  discord_id: string
  discord_username: string
  avatar_url: string | null
}

export function AdminsList() {
  const { user } = useAuth()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [demoteTarget, setDemoteTarget] = useState<Admin | null>(null)
  const requestSeq = useRef(0)

  const refetch = useCallback(async () => {
    const requestId = ++requestSeq.current
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('profiles')
        .select('id, discord_id, discord_username, avatar_url')
        .eq('is_admin', true)
        .order('discord_username', { ascending: true })
      if (requestId !== requestSeq.current) return
      if (qErr) {
        setError(new Error(qErr.message))
        setAdmins([])
      } else {
        setAdmins((data ?? []) as Admin[])
      }
    } catch (err) {
      if (requestId !== requestSeq.current) return
      setError(err instanceof Error ? err : new Error('Could not load admins'))
      setAdmins([])
    } finally {
      if (requestId === requestSeq.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    // Defer the initial fetch so the effect body itself doesn't call
    // setState synchronously (react-hooks/set-state-in-effect).
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      void refetch()
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [refetch])

  // MEDIUM #7: fetch-failure error state (NOT a silent empty list)
  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Couldn't load admins</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>Please try again.</span>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Admins</h2>
        <Button onClick={() => setPromoteOpen(true)} size="sm" className="h-9">
          <UserPlus className="h-4 w-4 mr-1" />
          Promote admin
        </Button>
      </div>

      {loading ? (
        <div className="divide-y border rounded-md">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[64px] bg-muted/30 animate-pulse"
              data-testid="admin-skeleton"
            />
          ))}
        </div>
      ) : (
        <div className={admins.length === 0 ? '' : 'divide-y border rounded-md'}>
          {admins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground mt-4">
                No admins yet.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Promote one to get started.
              </p>
            </div>
          ) : (
            admins.map((a) => {
              // D-06 UI guard: hide Demote button on acting admin's own row.
              const isSelf = user?.id === a.id
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-4 min-h-[64px]"
                >
                  <div className="flex items-center gap-3">
                    {a.avatar_url ? (
                      <img
                        src={a.avatar_url}
                        alt=""
                        className="h-6 w-6 rounded-full"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                        {(a.discord_username ?? '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {a.discord_username}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {a.discord_id}
                      </span>
                    </div>
                  </div>
                  {isSelf ? (
                    <span className="text-xs text-muted-foreground italic">
                      You
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => setDemoteTarget(a)}
                    >
                      <UserMinus className="h-3.5 w-3.5 mr-1" />
                      Demote
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      <PromoteAdminDialog
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        onPromoted={() => {
          setPromoteOpen(false)
          void refetch()
        }}
      />
      {demoteTarget && (
        <DemoteAdminDialog
          admin={demoteTarget}
          open={!!demoteTarget}
          onOpenChange={(o) => {
            if (!o) setDemoteTarget(null)
          }}
          onDemoted={() => {
            setDemoteTarget(null)
            void refetch()
          }}
        />
      )}
    </div>
  )
}
