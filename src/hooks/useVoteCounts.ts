import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { usePolling } from '@/hooks/usePolling'

const POLL_INTERVAL = 8000 // 8 seconds (within RSLT-04 5-10s range)

export function useVoteCounts(
  votedPollIds: string[],
  enablePolling: boolean,
) {
  // Map<pollId, Map<choiceId, count>>
  const [voteCounts, setVoteCounts] = useState<Map<string, Map<string, number>>>(new Map())
  // VIS-08 D-11: results_hidden polled on the same 8s cadence so voter UI auto-updates
  // within ~8s of an admin flip. Targets the polls_effective view (never the base
  // polls table directly) to preserve the polls_effective invariant.
  const [resultsHidden, setResultsHidden] = useState<Map<string, boolean>>(new Map())

  // Stabilize dependency: use serialized string key instead of array reference
  // to prevent unnecessary refetches when the array has the same content but a new reference
  const pollIdsKey = votedPollIds.join(',')
  const pollIdsRef = useRef(votedPollIds)
  pollIdsRef.current = votedPollIds

  const fetchCounts = useCallback(async () => {
    const ids = pollIdsRef.current
    if (ids.length === 0) {
      setVoteCounts(new Map())
      setResultsHidden(new Map())
      return
    }

    // Batch both reads into a single round-trip via Promise.all to keep the
    // free-tier connection load flat. RLS enforces respondent-only visibility on
    // vote_counts: that query only returns rows for polls the current user has
    // voted on AND that are not currently hidden (DB defense layer for VIS-08).
    const [vcResult, hiddenResult] = await Promise.all([
      supabase
        .from('vote_counts')
        .select('poll_id, choice_id, count')
        .in('poll_id', ids),
      supabase
        .from('polls_effective')
        .select('id, results_hidden')
        .in('id', ids),
    ])

    const { data: counts, error } = vcResult
    if (error) {
      console.error('Failed to fetch vote counts:', error)
      // Keep previous counts rather than resetting to empty
    } else if (counts) {
      const map = new Map<string, Map<string, number>>()
      for (const row of counts) {
        if (!map.has(row.poll_id)) {
          map.set(row.poll_id, new Map())
        }
        map.get(row.poll_id)!.set(row.choice_id, row.count)
      }
      setVoteCounts(map)
    }

    const { data: hiddenRows, error: hiddenErr } = hiddenResult
    if (hiddenErr) {
      console.error('Failed to fetch results_hidden:', hiddenErr)
      // Transient blip: keep the previous hidden map rather than flipping the
      // UI to "visible" — preserves the layered defense if the previous tick
      // said "hidden".
    } else if (hiddenRows) {
      const hMap = new Map<string, boolean>()
      for (const row of hiddenRows) {
        // Defensive Boolean coerce: view-level nullability may differ from the
        // underlying NOT NULL column; default to visible (false) on any null.
        hMap.set(row.id, Boolean(row.results_hidden))
      }
      setResultsHidden(hMap)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollIdsKey])

  // Initial fetch
  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  // Poll every 8 seconds if enabled (active suggestions only).
  // For closed suggestions, enablePolling=false so delay=null,
  // which disables the interval (fetch-once-on-mount behavior).
  // Polling pauses when tab is hidden and cleans up on unmount.
  usePolling(fetchCounts, enablePolling ? POLL_INTERVAL : null)

  return { voteCounts, resultsHidden, refetchVoteCounts: fetchCounts }
}
