import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { SuggestionFormInput } from '@/lib/validation/suggestion-form'

type FunctionError = {
  context?: {
    status?: number
    json?: () => Promise<{ error?: string }>
  }
}

async function extractMessage(error: unknown, fallback: string): Promise<{ msg: string; status: number | undefined }> {
  let status: number | undefined
  let msg = fallback
  try {
    const ctx = (error as FunctionError)?.context
    status = ctx?.status
    if (ctx?.json) {
      const body = await ctx.json()
      if (body?.error) msg = body.error
    }
  } catch {
    /* fall through */
  }
  return { msg, status }
}

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
          const { msg, status } = await extractMessage(
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
