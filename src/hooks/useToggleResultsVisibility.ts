import { useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { extractFunctionErrorMessage } from '@/lib/fn-error'

// Per-poll inflight Set + Switch disabled in caller — rapid-click guard
// prevents a second EF invoke (and a duplicate audit row) for the SAME row
// while letting different rows be in-flight independently. A singleton
// inflight gate would silently swallow concurrent flips on other rows.
// No `submitting` state is exposed: the caller tracks per-row pending
// state via its own Set, which is the actual loading-state surface.
export function useToggleResultsVisibility() {
  const inflightRef = useRef<Set<string>>(new Set())

  const toggleResultsVisibility = useCallback(
    async (input: { poll_id: string; hidden: boolean; title: string }) => {
      if (inflightRef.current.has(input.poll_id)) return { ok: false as const }
      inflightRef.current.add(input.poll_id)
      try {
        const { error } = await supabase.functions.invoke('toggle-results-visibility', {
          body: { poll_id: input.poll_id, hidden: input.hidden },
        })
        if (error) {
          toast.error(
            await extractFunctionErrorMessage(error, 'Could not update visibility. Try again.'),
          )
          return { ok: false as const }
        }
        toast.success(
          input.hidden
            ? `Results hidden for: ${input.title}`
            : `Results visible for: ${input.title}`,
        )
        return { ok: true as const }
      } catch {
        toast.error('Could not update visibility. Try again.')
        return { ok: false as const }
      } finally {
        inflightRef.current.delete(input.poll_id)
      }
    },
    [],
  )

  return { toggleResultsVisibility }
}
