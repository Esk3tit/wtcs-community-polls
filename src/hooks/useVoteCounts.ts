import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { usePolling } from '@/hooks/usePolling'

const POLL_INTERVAL = 8000 // 8 seconds (within RSLT-04 5-10s range)

export function useVoteCounts(
  votedPollIds: string[],
  enablePolling: boolean,
) {
  // Map<pollId, Map<choiceId, count>>
  const [voteCounts, setVoteCounts] = useState<Map<string, Map<string, number>>>(new Map())

  const fetchCounts = useCallback(async () => {
    if (votedPollIds.length === 0) {
      setVoteCounts(new Map())
      return
    }

    // RLS enforces respondent-only visibility: this query only returns
    // vote_counts rows for polls where the current user has a vote record.
    // Non-voters get zero rows -- they cannot see any aggregate data.
    const { data: counts } = await supabase
      .from('vote_counts')
      .select('poll_id, choice_id, count')
      .in('poll_id', votedPollIds)

    if (counts) {
      const map = new Map<string, Map<string, number>>()
      for (const row of counts) {
        if (!map.has(row.poll_id)) {
          map.set(row.poll_id, new Map())
        }
        map.get(row.poll_id)!.set(row.choice_id, row.count)
      }
      setVoteCounts(map)
    }
  }, [votedPollIds])

  // Initial fetch
  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  // Poll every 8 seconds if enabled (active suggestions only).
  // For closed suggestions, enablePolling=false so delay=null,
  // which disables the interval (fetch-once-on-mount behavior).
  // Polling pauses when tab is hidden and cleans up on unmount.
  usePolling(fetchCounts, enablePolling ? POLL_INTERVAL : null)

  return { voteCounts, refetchVoteCounts: fetchCounts }
}
