import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { extractFunctionErrorMessage } from '@/lib/fn-error'

// inflightRef + Switch disabled in caller — rapid-click guard prevents a
// second EF invoke (and a duplicate audit row) for a single user intent.
export function useToggleResultsVisibility() {
  const [submitting, setSubmitting] = useState(false)
  const inflightRef = useRef(false)

  const toggleResultsVisibility = useCallback(
    async (input: { poll_id: string; hidden: boolean; title: string }) => {
      if (inflightRef.current) return { ok: false as const }
      inflightRef.current = true
      setSubmitting(true)
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
        inflightRef.current = false
        setSubmitting(false)
      }
    },
    [],
  )

  return { toggleResultsVisibility, submitting }
}
