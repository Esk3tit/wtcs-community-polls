import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { extractFunctionErrorMessage } from '@/lib/fn-error'
import type { ResolutionStatus } from '@/lib/types/suggestions'

// Re-exported alias so callers can `import type { Resolution } from '@/hooks/useClosePoll'`
// while the canonical declaration lives in the lib type module (lib must not depend on hooks).
export type Resolution = ResolutionStatus

export function useClosePoll() {
  const [submitting, setSubmitting] = useState(false)
  const inflightRef = useRef(false)

  const closePoll = useCallback(
    async (input: { poll_id: string; resolution: Resolution }) => {
      if (inflightRef.current) return { ok: false as const }
      inflightRef.current = true
      setSubmitting(true)
      try {
        const { error } = await supabase.functions.invoke('close-poll', { body: input })
        if (error) {
          toast.error(await extractFunctionErrorMessage(error, 'Could not close suggestion. Try again.'))
          return { ok: false as const }
        }
        toast.success('Suggestion closed')
        return { ok: true as const }
      } catch {
        toast.error('Could not close suggestion. Try again.')
        return { ok: false as const }
      } finally {
        inflightRef.current = false
        setSubmitting(false)
      }
    },
    [],
  )

  return { closePoll, submitting }
}
