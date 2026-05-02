import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Plus, Inbox, Archive, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase'
import { usePinPoll } from '@/hooks/usePinPoll'
import { AdminSuggestionRow, type AdminSuggestion } from './AdminSuggestionRow'

type Filter = 'active' | 'closed' | 'all'

// Visible list ordering must mirror the server ORDER BY (is_pinned DESC,
// created_at DESC) so optimistic pin-flips re-sort locally and the row jumps
// to the pinned section immediately. The post-mutation refetch is the
// authoritative reconciliation step.
function sortAdminSuggestions(rows: AdminSuggestion[]): AdminSuggestion[] {
  return [...rows].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    // created_at DESC
    return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
  })
}

export function AdminSuggestionsTab() {
  const search = useSearch({ strict: false }) as { tab?: string; filter?: Filter }
  const navigate = useNavigate()
  const rawFilter = search.filter
  const filter: Filter =
    rawFilter === 'active' || rawFilter === 'closed' || rawFilter === 'all'
      ? rawFilter
      : 'active'

  const [items, setItems] = useState<AdminSuggestion[]>([])
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)

  const { pinPoll } = usePinPoll()
  const fetchIdRef = useRef(0)

  const fetchAll = useCallback(async () => {
    const id = ++fetchIdRef.current
    setLoading(true)
    setLoadError(null)
    try {
      const base = supabase
        .from('polls_effective')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
      const query = filter === 'all' ? base : base.eq('status', filter)
      const { data, error } = await query
      if (error) throw error
      if (id !== fetchIdRef.current) return // stale response
      const rows = ((data ?? []) as unknown) as AdminSuggestion[]
      setItems(rows)

      // Scope vote_counts to only the poll IDs currently in view; otherwise
      // every filter change pulls the full vote_counts table (O(all-polls-ever)).
      const pollIds = rows.map((r) => r.id)
      const counts: Record<string, number> = {}
      if (pollIds.length > 0) {
        const { data: vcData, error: vcErr } = await supabase
          .from('vote_counts')
          .select('poll_id, count')
          .in('poll_id', pollIds)
        if (vcErr) throw vcErr
        if (id !== fetchIdRef.current) return // stale response
        for (const r of (vcData ?? []) as Array<{ poll_id: string; count: number | null }>) {
          counts[r.poll_id] = (counts[r.poll_id] ?? 0) + (r.count ?? 0)
        }
      }
      setVoteCounts(counts)
    } catch (err) {
      if (id !== fetchIdRef.current) return // stale response
      console.error('Failed to load admin suggestions:', err)
      setLoadError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (id === fetchIdRef.current) setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const setFilter = (f: Filter) =>
    navigate({ to: '/admin', search: { tab: 'suggestions', filter: f } })

  // Optimistic pin: flip is_pinned locally and re-sort before firing the
  // mutation. Revert on failure. Post-mutation refetch reconciles so server
  // state always wins.
  const handleTogglePin = useCallback(
    async (pollId: string, nextPinned: boolean) => {
      const prev = items
      const optimistic = sortAdminSuggestions(
        items.map((it) =>
          it.id === pollId ? { ...it, is_pinned: nextPinned } : it,
        ),
      )
      setItems(optimistic)
      const res = await pinPoll({ poll_id: pollId, is_pinned: nextPinned })
      if (!res.ok) {
        // Revert to the pre-optimistic snapshot. The toast was already
        // surfaced by usePinPoll's error path.
        setItems(prev)
        return
      }
      // Reconciliation — fetch canonical state.
      void fetchAll()
    },
    [items, pinPoll, fetchAll],
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div
          role="tablist"
          aria-label="Filter suggestions"
          className="flex items-center gap-2"
        >
          {(['active', 'closed', 'all'] as const).map((f) => {
            const label = f === 'active' ? 'Active' : f === 'closed' ? 'Closed' : 'All'
            const selected = filter === f
            return (
              <Button
                key={f}
                role="tab"
                aria-selected={selected}
                size="sm"
                variant={selected ? 'default' : 'outline'}
                className="h-8 px-3 rounded-full text-xs font-medium"
                onClick={() => setFilter(f)}
              >
                {label}
              </Button>
            )
          })}
        </div>
        <Button
          data-testid="admin-create-suggestion"
          onClick={() => navigate({ to: '/admin/suggestions/new' })}
        >
          <Plus className="h-4 w-4 mr-1" /> Create suggestion
        </Button>
      </div>

      {loadError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn't load suggestions</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Please try again.</span>
            <Button size="sm" variant="outline" onClick={() => void fetchAll()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loadError && loading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[72px] bg-muted/30 animate-pulse rounded-md" />
          ))}
        </div>
      )}

      {!loadError && !loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {filter === 'closed' ? (
            <Archive className="h-10 w-10 text-muted-foreground" />
          ) : (
            <Inbox className="h-10 w-10 text-muted-foreground" />
          )}
          <p className="text-lg font-medium text-foreground mt-4">
            {filter === 'closed' ? 'No closed suggestions yet.' : 'No active suggestions.'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === 'closed'
              ? 'Closed suggestions will appear here with their resolution status.'
              : 'Create one to get started.'}
          </p>
          {filter !== 'closed' && (
            <Button
              className="mt-4"
              onClick={() => navigate({ to: '/admin/suggestions/new' })}
            >
              Create suggestion
            </Button>
          )}
        </div>
      )}

      {!loadError && !loading && items.length > 0 && (
        <div className="divide-y rounded-md border">
          {items.map((s) => (
            <AdminSuggestionRow
              key={s.id}
              suggestion={s}
              voteCount={voteCounts[s.id] ?? 0}
              onChanged={fetchAll}
              onTogglePin={(pid, next) => void handleTogglePin(pid, next)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
