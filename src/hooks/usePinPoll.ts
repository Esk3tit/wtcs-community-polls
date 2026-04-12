import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

type FunctionError = {
  context?: { json?: () => Promise<{ error?: string }> }
}

async function extractMessage(error: unknown, fallback: string): Promise<string> {
  try {
    const ctx = (error as FunctionError)?.context
    if (ctx?.json) {
      const body = await ctx.json()
      if (body?.error) return body.error
    }
  } catch {
    /* fall through */
  }
  return fallback
}

export function usePinPoll() {
  const [submitting, setSubmitting] = useState(false)
  const inflightRef = useRef(false)

  const pinPoll = useCallback(
    async (input: { poll_id: string; is_pinned: boolean }) => {
      if (inflightRef.current) return { ok: false as const }
      inflightRef.current = true
      setSubmitting(true)
      try {
        const { error } = await supabase.functions.invoke('pin-poll', { body: input })
        if (error) {
          toast.error(await extractMessage(error, 'Could not update pin state. Try again.'))
          return { ok: false as const }
        }
        toast.success(input.is_pinned ? 'Suggestion pinned' : 'Suggestion unpinned')
        return { ok: true as const }
      } catch {
        toast.error('Could not update pin state. Try again.')
        return { ok: false as const }
      } finally {
        inflightRef.current = false
        setSubmitting(false)
      }
    },
    [],
  )

  return { pinPoll, submitting }
}
