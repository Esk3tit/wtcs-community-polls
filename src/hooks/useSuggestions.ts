import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type {
  SuggestionWithChoices,
  Category,
  ChoiceSummary,
} from '@/lib/types/suggestions'

// Phase 4 Plan 04 Task 4 + cross-AI MEDIUM #5: public reads MUST go through
// the polls_effective view so lazy-closed polls show as 'closed' without
// waiting for the scheduled sweep. The view is a 1:1 projection over polls
// with a derived status column, so we hydrate categories and choices with
// separate queries (views don't preserve FK relationships for PostgREST
// embedded selects).

export function useSuggestions(status: 'active' | 'closed') {
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState<SuggestionWithChoices[]>([])
  const [userVotes, setUserVotes] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchTrigger, setFetchTrigger] = useState(0)
  const fetchRef = useRef(0)

  useEffect(() => {
    const fetchId = ++fetchRef.current
    let cancelled = false

    async function fetchData() {
      // 1. Read from polls_effective (invariant: public reads never touch
      //    the base polls table; cross-AI MEDIUM #5).
      const { data: polls, error: pollsError } = await supabase
        .from('polls_effective')
        .select('*')
        .eq('status', status)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (pollsError) {
        console.error('Failed to fetch suggestions:', pollsError)
        setError('Failed to load topics. Try refreshing the page.')
        setLoading(false)
        return
      }

      const pollRows = polls ?? []
      const pollIds = pollRows.map((p) => p.id)

      // 2. Hydrate choices (single IN query)
      let choicesByPoll = new Map<string, ChoiceSummary[]>()
      if (pollIds.length > 0) {
        const { data: choices, error: choicesError } = await supabase
          .from('choices')
          .select('id, label, sort_order, poll_id')
          .in('poll_id', pollIds)
          .order('sort_order', { ascending: true })
        if (cancelled) return
        if (choicesError) {
          console.error('Failed to fetch choices:', choicesError)
          setError('Failed to load topics. Try refreshing the page.')
          setLoading(false)
          return
        }
        choicesByPoll = new Map()
        for (const c of (choices ?? []) as Array<ChoiceSummary & { poll_id: string }>) {
          const arr = choicesByPoll.get(c.poll_id) ?? []
          arr.push({ id: c.id, label: c.label, sort_order: c.sort_order })
          choicesByPoll.set(c.poll_id, arr)
        }
      }

      // 3. Hydrate categories (single IN query)
      const catIds = Array.from(
        new Set(pollRows.map((p) => p.category_id).filter((x): x is string => !!x)),
      )
      let catsById = new Map<string, Pick<Category, 'id' | 'name' | 'slug' | 'sort_order'>>()
      if (catIds.length > 0) {
        const { data: cats, error: catsError } = await supabase
          .from('categories')
          .select('id, name, slug, sort_order')
          .in('id', catIds)
        if (cancelled) return
        if (catsError) {
          console.error('Failed to fetch categories:', catsError)
          setError('Failed to load topics. Try refreshing the page.')
          setLoading(false)
          return
        }
        catsById = new Map((cats ?? []).map((c) => [c.id, c]))
      }

      // 4. User votes
      let votesMap = new Map<string, string>()
      if (user) {
        const { data: votes, error: votesError } = await supabase
          .from('votes')
          .select('poll_id, choice_id')
          .eq('user_id', user.id)

        if (cancelled) return

        if (votesError) {
          console.error('Failed to fetch votes:', votesError)
          setError('Failed to load your responses. Try refreshing the page.')
          setLoading(false)
          return
        }

        if (votes) {
          votesMap = new Map(votes.map((v) => [v.poll_id, v.choice_id]))
        }
      }

      // Guard against stale fetches
      if (fetchRef.current !== fetchId) return

      const merged: SuggestionWithChoices[] = pollRows.map((p) => ({
        ...p,
        categories: p.category_id ? catsById.get(p.category_id) ?? null : null,
        choices: choicesByPoll.get(p.id) ?? [],
      })) as unknown as SuggestionWithChoices[]

      setSuggestions(merged)
      setUserVotes(votesMap)
      setError(null)
      setLoading(false)
    }

    fetchData()
    return () => { cancelled = true }
  }, [status, user, fetchTrigger])

  const refetch = useCallback(() => {
    setFetchTrigger(n => n + 1)
  }, [])

  const addOptimisticVote = useCallback((pollId: string, choiceId: string) => {
    setUserVotes(prev => new Map(prev).set(pollId, choiceId))
  }, [])

  return { suggestions, userVotes, loading, error, refetch, addOptimisticVote }
}
