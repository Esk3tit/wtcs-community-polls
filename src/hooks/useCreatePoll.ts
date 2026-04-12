import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { SuggestionFormInput } from '@/lib/validation/suggestion-form'
import { extractFunctionErrorMessage } from '@/lib/fn-error'

export function useCreatePoll() {
  const [submitting, setSubmitting] = useState(false)
  const inflightRef = useRef(false)

  const createPoll = useCallback(async (input: SuggestionFormInput) => {
    if (inflightRef.current) return { ok: false as const, id: null }
    inflightRef.current = true
    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke<{ id: string }>(
        'create-poll',
        { body: input },
      )
      if (error) {
        const msg = await extractFunctionErrorMessage(error, 'Could not create suggestion. Try again.')
        toast.error(msg)
        return { ok: false as const, id: null }
      }
      if (!data?.id) {
        toast.error('Could not create suggestion. Try again.')
        return { ok: false as const, id: null }
      }
      toast.success('Suggestion created')
      return { ok: true as const, id: data.id }
    } catch {
      toast.error('Could not create suggestion. Try again.')
      return { ok: false as const, id: null }
    } finally {
      inflightRef.current = false
      setSubmitting(false)
    }
  }, [])

  return { createPoll, submitting }
}
