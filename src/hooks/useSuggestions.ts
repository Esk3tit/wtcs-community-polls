import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { SuggestionWithChoices } from '@/lib/types/suggestions'

export function useSuggestions(status: 'active' | 'closed') {
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState<SuggestionWithChoices[]>([])
  const [userVotes, setUserVotes] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  const fetchSuggestions = useCallback(async () => {
    // SERVER-SIDE filter: .eq('status', status) ensures only matching polls are returned
    const { data: polls, error } = await supabase
      .from('polls')
      .select(`
        *,
        categories!polls_category_id_fkey(id, name, slug, sort_order),
        choices(id, label, sort_order)
      `)
      .eq('status', status)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch suggestions:', error)
    }
    if (polls) {
      setSuggestions(polls)
    }

    // Fetch user's votes (RLS ensures only own votes visible)
    if (user) {
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, choice_id')
        .eq('user_id', user.id)

      if (votes) {
        setUserVotes(new Map(votes.map(v => [v.poll_id, v.choice_id])))
      }
    }

    setLoading(false)
  }, [status, user])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  const addOptimisticVote = useCallback((pollId: string, choiceId: string) => {
    setUserVotes(prev => new Map(prev).set(pollId, choiceId))
  }, [])

  return { suggestions, userVotes, loading, refetch: fetchSuggestions, addOptimisticVote }
}
