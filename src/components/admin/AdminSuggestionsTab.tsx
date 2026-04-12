import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Plus, Inbox, Archive, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase'
import { AdminSuggestionRow, type AdminSuggestion } from './AdminSuggestionRow'

type Filter = 'active' | 'closed' | 'all'

export function AdminSuggestionsTab() {
  const search = useSearch({ strict: false }) as { tab?: string; filter?: Filter }
  const navigate = useNavigate()
  const filter: Filter = search.filter ?? 'active'

  const [items, setItems] = useState<AdminSuggestion[]>([])
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)

  const fetchAll = useCallback(async () => {
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
      setItems(((data ?? []) as unknown) as AdminSuggestion[])

      const { data: vcData, error: vcErr } = await supabase
        .from('vote_counts')
        .select('poll_id, count')
      if (vcErr) throw vcErr
      const counts: Record<string, number> = {}
      for (const r of (vcData ?? []) as Array<{ poll_id: string; count: number | null }>) {
        counts[r.poll_id] = (counts[r.poll_id] ?? 0) + (r.count ?? 0)
      }
      setVoteCounts(counts)
    } catch (err) {
      console.error('Failed to load admin suggestions:', err)
      setLoadError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const setFilter = (f: Filter) =>
    navigate({ to: '/admin', search: { tab: 'suggestions', filter: f } })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {(['active', 'closed', 'all'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className="h-8 px-3 rounded-full text-xs font-medium"
              onClick={() => setFilter(f)}
            >
              {f === 'active' ? 'Active' : f === 'closed' ? 'Closed' : 'All'}
            </Button>
          ))}
        </div>
        <Button onClick={() => navigate({ to: '/admin/suggestions/new' })}>
          <Plus className="h-4 w-4 mr-1" /> Create suggestion
        </Button>
      </div>

      {/* MEDIUM #7: fetch-failure error state */}
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
          <p className="text-lg font-medium mt-4">
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
