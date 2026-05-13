import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Plus, Inbox, Archive, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase'
import { usePinPoll } from '@/hooks/usePinPoll'
import { useToggleResultsVisibility } from '@/hooks/useToggleResultsVisibility'
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
  const [pendingVisibility, setPendingVisibility] = useState<Set<string>>(new Set())

  const { pinPoll } = usePinPoll()
  const { toggleResultsVisibility } = useToggleResultsVisibility()
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
        // The generated `vote_counts.count` type is non-null at the table
        // level, but the view-level aggregation can still surface NULL on
        // edge cases (e.g., aggregate functions over empty partitions),
        // so we widen the row type and coalesce to 0 defensively.
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
  // mutation. Revert via functional setItems on failure so concurrent flips
  // against different rows do not trample each other's optimistic state.
  // Post-mutation refetch (success OR failure) is the canonical reconcile.
  const handleTogglePin = useCallback(
    async (pollId: string, nextPinned: boolean) => {
      setItems((cur) =>
        sortAdminSuggestions(
          cur.map((it) => (it.id === pollId ? { ...it, is_pinned: nextPinned } : it)),
        ),
      )
      const res = await pinPoll({ poll_id: pollId, is_pinned: nextPinned })
      if (!res.ok) {
        // Diff-revert only the target row, then re-sort. Other rows'
        // concurrent optimistic flips stay intact. The toast was already
        // surfaced by usePinPoll's error path.
        setItems((cur) =>
          sortAdminSuggestions(
            cur.map((it) => (it.id === pollId ? { ...it, is_pinned: !nextPinned } : it)),
          ),
        )
        // Reconcile against server too — guarantees convergence if a
        // concurrent flip raced us.
        void fetchAll()
        return
      }
      void fetchAll()
    },
    [pinPoll, fetchAll],
  )

  // Optimistic results-visibility flip: results_hidden does not affect list
  // ordering, so no re-sort. Functional setItems diffs only the target row
  // so concurrent flips on other rows stay intact. Per-row pending Set lets
  // multiple rows be in-flight independently. Toast surfaced by hook.
  const handleToggleResultsVisibility = useCallback(
    async (pollId: string, nextHidden: boolean) => {
      // Short-circuit rapid double-click on the same row BEFORE any
      // optimistic flip. The Switch's `disabled={pendingVisibility.has(s.id)}`
      // guards the common case, but the window between the first click's
      // setPendingVisibility and the next render is non-zero (and can
      // stretch under React 19 concurrent-mode load). Without this guard
      // the second handler ran the revert path on the hook's inflight
      // rejection — flickering the Switch B→A→B — and tampered with the
      // first handler's pending marker.
      if (pendingVisibility.has(pollId)) return

      // Read title from current state OUTSIDE the setItems updater. The
      // row is guaranteed to exist because the user just clicked its
      // Switch. Mutating closure-scoped vars inside a setState updater
      // violates React's purity contract (StrictMode double-invokes
      // updaters in dev to surface this).
      const target = items.find((it) => it.id === pollId)
      const title = target?.title ?? 'this suggestion'
      setItems((cur) =>
        cur.map((it) =>
          it.id === pollId ? { ...it, results_hidden: nextHidden } : it,
        ),
      )
      setPendingVisibility((s) => {
        const n = new Set(s)
        n.add(pollId)
        return n
      })
      const res = await toggleResultsVisibility({ poll_id: pollId, hidden: nextHidden, title })
      // Inflight gate trip: the caller-side `pendingVisibility.has` guard
      // missed the React-commit window, so the first handler still owns
      // BOTH the pending marker AND the optimistic flip. Do not touch
      // pendingVisibility (clearing it here would re-enable the Switch
      // while the first EF is still in flight) and do not revert items
      // (first handler's flip is the source of truth).
      if (!res.ok && res.reason === 'inflight') return
      setPendingVisibility((s) => {
        const n = new Set(s)
        n.delete(pollId)
        return n
      })
      if (!res.ok) {
        // Real EF/network error — diff-revert only the target row so
        // concurrent flips on other rows keep their optimistic state.
        setItems((cur) =>
          cur.map((it) =>
            it.id === pollId ? { ...it, results_hidden: !nextHidden } : it,
          ),
        )
        // Reconcile against server too — guarantees convergence if a
        // concurrent flip raced us.
        void fetchAll()
        return
      }
      void fetchAll()
    },
    [items, pendingVisibility, toggleResultsVisibility, fetchAll],
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
              onToggleResultsVisibility={(pid, next) =>
                void handleToggleResultsVisibility(pid, next)
              }
              isPendingVisibility={pendingVisibility.has(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
