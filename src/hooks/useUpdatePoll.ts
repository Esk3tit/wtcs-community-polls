import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { SuggestionFormInput } from '@/lib/validation/suggestion-form'
import { extractFunctionError } from '@/lib/fn-error'

export function useUpdatePoll() {
  const [submitting, setSubmitting] = useState(false)
  const inflightRef = useRef(false)

  const updatePoll = useCallback(
    async (input: SuggestionFormInput & { poll_id: string }) => {
      if (inflightRef.current) return { ok: false as const }
      inflightRef.current = true
      setSubmitting(true)
      try {
        const { error } = await supabase.functions.invoke('update-poll', { body: input })
        if (error) {
          const { msg, status } = await extractFunctionError(
            error,
            'Could not update suggestion. Try again.',
          )
          if (status === 409) {
            toast.error('Cannot edit: responses already received.')
          } else {
            toast.error(msg)
          }
          return { ok: false as const }
        }
        toast.success('Suggestion updated')
        return { ok: true as const }
      } catch {
        toast.error('Could not update suggestion. Try again.')
        return { ok: false as const }
      } finally {
        inflightRef.current = false
        setSubmitting(false)
      }
    },
    [],
  )

  return { updatePoll, submitting }
}
