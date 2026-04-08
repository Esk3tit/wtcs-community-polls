import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { SUGGESTIONS_SELECT } from '@/lib/types/suggestions'
import type { SuggestionWithChoices } from '@/lib/types/suggestions'

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
      const { data: polls, error: pollsError } = await supabase
        .from('polls')
        .select(SUGGESTIONS_SELECT)
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
          votesMap = new Map(votes.map(v => [v.poll_id, v.choice_id]))
        }
      }

      // Guard against stale fetches
      if (fetchRef.current !== fetchId) return

      if (polls) setSuggestions(polls)
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
