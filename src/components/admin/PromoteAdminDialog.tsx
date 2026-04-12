import { useState } from 'react'
import { Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSearchAdminTargets } from '@/hooks/useSearchAdminTargets'
import { usePromoteAdmin } from '@/hooks/usePromoteAdmin'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPromoted: () => void
}

export function PromoteAdminDialog({ open, onOpenChange, onPromoted }: Props) {
  const { query, setQuery, results, searching } = useSearchAdminTargets()
  const { promote, submitting } = usePromoteAdmin()
  const [discordId, setDiscordId] = useState('')

  const handlePromoteTarget = async (target_user_id: string) => {
    const result = await promote({ target_user_id })
    if (result.ok) {
      setQuery('')
      setDiscordId('')
      onPromoted()
    }
  }

  const handlePreauth = async () => {
    const trimmed = discordId.trim()
    if (!trimmed) return
    const result = await promote({ target_discord_id: trimmed })
    if (result.ok) {
      setQuery('')
      setDiscordId('')
      onPromoted()
    }
  }

  const showNoMatches =
    query.length >= 2 && results.length === 0 && !searching

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setQuery('')
          setDiscordId('')
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Promote admin</DialogTitle>
          <DialogDescription>
            Search for an existing member or paste a Discord ID to pre-authorize.
          </DialogDescription>
        </DialogHeader>

        {/* Section 1: search by username */}
        <div className="space-y-2">
          <Label htmlFor="promote-search">Search by Discord username</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="promote-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start typing a username..."
              className="pl-9 h-9 text-sm"
            />
          </div>
          {results.length > 0 && (
            <div className="mt-2 border rounded-md divide-y max-h-64 overflow-auto">
              {results.slice(0, 10).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 p-2 hover:bg-accent rounded-md min-h-[44px]"
                >
                  {r.avatar_url ? (
                    <img
                      src={r.avatar_url}
                      alt=""
                      className="h-6 w-6 rounded-full"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.discord_username}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {r.discord_id}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void handlePromoteTarget(r.id)}
                    disabled={submitting}
                  >
                    Promote
                  </Button>
                </div>
              ))}
            </div>
          )}
          {showNoMatches && (
            <p className="text-xs text-muted-foreground mt-2">
              No matches. Paste a Discord ID instead.
            </p>
          )}
        </div>

        {/* Section 2: paste Discord ID */}
        <div className="mt-4 pt-4 border-t space-y-2">
          <Label htmlFor="promote-discord-id">Or paste a Discord ID</Label>
          <Input
            id="promote-discord-id"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="e.g. 267747104607305738"
            className="h-9 text-sm font-mono"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              The user becomes admin on their next sign-in.
            </p>
            <Button
              size="sm"
              onClick={() => void handlePreauth()}
              disabled={submitting || discordId.trim().length === 0}
            >
              Pre-authorize
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
