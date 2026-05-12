import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { usePolling } from '@/hooks/usePolling'
import { deferSetState } from '@/lib/deferSetState'

// 8s polling cadence balances perceived freshness against the free-tier
// connection budget. Below ~5s pressures the connection pool; above ~10s
// makes admin hide/show flips feel laggy.
const POLL_INTERVAL = 8000

export function useVoteCounts(
  votedPollIds: string[],
  enablePolling: boolean,
) {
  // Map<pollId, Map<choiceId, count>>
  const [voteCounts, setVoteCounts] = useState<Map<string, Map<string, number>>>(new Map())
  // results_hidden is polled on the same 8s cadence as vote_counts so the
  // voter UI auto-updates within ~8s of an admin flip. Query targets the
  // polls_effective view (never the base polls table) to preserve the
  // single-read-path invariant enforced by polls-effective-invariant.test.ts.
  const [resultsHidden, setResultsHidden] = useState<Map<string, boolean>>(new Map())

  // Stabilize dependency: serialize to a sorted, pipe-joined key so the SET
  // of poll IDs drives refetches — not their iteration order. `userVotes`
  // is a Map whose iteration order can shift across refetches in
  // useSuggestions; an order-sensitive join here would rebuild
  // fetchCounts on every reorder and reset the polling timer. The `|`
  // separator avoids any collision risk with future ID formats (UUIDs
  // never contain `|`).
  const pollIdsKey = useMemo(
    () => [...votedPollIds].sort().join('|'),
    [votedPollIds],
  )

  const fetchCounts = useCallback(async () => {
    // Derive ids from the stable key inside the callback rather than
    // closing over the array reference — avoids render-time ref mutation
    // (React 19 concurrent-mode hazard) and keeps the source of truth
    // single (the key).
    const ids = pollIdsKey ? pollIdsKey.split('|') : []
    if (ids.length === 0) {
      // Empty input is the logged-out / no-votes path. Reset both maps so
      // a sign-out clears stale results from the UI. (If the caller
      // briefly passes [] mid-refetch, that's a useSuggestions concern —
      // see SuggestionList.tsx where votedPollIds is derived only from
      // already-loaded userVotes.)
      setVoteCounts(new Map())
      setResultsHidden(new Map())
      return
    }

    // Batch both reads into a single round-trip via Promise.all to keep the
    // free-tier connection load flat. RLS enforces respondent-only visibility on
    // vote_counts: that query only returns rows for polls the current user has
    // voted on AND that are not currently hidden (DB-layer defense against
    // count leakage when admin hide-policy is set).
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
      // Keep previous counts rather than resetting to empty: a transient
      // network blip should not blank the UI mid-poll.
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
  }, [pollIdsKey])

  // Initial fetch — defer so the effect body itself doesn't call setState
  // synchronously (satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    const handle = deferSetState(() => {
      void fetchCounts()
    })
    return handle.cancel
  }, [fetchCounts])

  // Poll every 8 seconds if enabled (active suggestions only).
  // For closed suggestions, enablePolling=false so delay=null,
  // which disables the interval (fetch-once-on-mount behavior).
  // Polling pauses when tab is hidden and cleans up on unmount.
  usePolling(fetchCounts, enablePolling ? POLL_INTERVAL : null)

  return { voteCounts, resultsHidden, refetchVoteCounts: fetchCounts }
}
