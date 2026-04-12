import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

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

export function useDeletePoll() {
  const [submitting, setSubmitting] = useState(false)
  const inflightRef = useRef(false)

  const deletePoll = useCallback(async (input: { poll_id: string }) => {
    if (inflightRef.current) return { ok: false as const }
    inflightRef.current = true
    setSubmitting(true)
    try {
      const { error } = await supabase.functions.invoke('delete-poll', { body: input })
      if (error) {
        const { msg, status } = await extractMessage(
          error,
          'Could not delete suggestion. Try again.',
        )
        if (status === 409) {
          toast.error('Cannot delete: responses already received.')
        } else {
          toast.error(msg)
        }
        return { ok: false as const }
      }
      toast.success('Suggestion deleted')
      return { ok: true as const }
    } catch {
      toast.error('Could not delete suggestion. Try again.')
      return { ok: false as const }
    } finally {
      inflightRef.current = false
      setSubmitting(false)
    }
  }, [])

  return { deletePoll, submitting }
}
