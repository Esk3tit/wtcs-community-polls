import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Resolution } from '@/hooks/useClosePoll'
import { extractFunctionErrorMessage } from '@/lib/fn-error'

export function useSetResolution() {
  const [submitting, setSubmitting] = useState(false)
  const inflightRef = useRef(false)

  const setResolution = useCallback(
    async (input: { poll_id: string; resolution: Resolution }) => {
      if (inflightRef.current) return { ok: false as const }
      inflightRef.current = true
      setSubmitting(true)
      try {
        const { error } = await supabase.functions.invoke('set-resolution', {
          body: input,
        })
        if (error) {
          toast.error(await extractFunctionErrorMessage(error, 'Could not update resolution. Try again.'))
          return { ok: false as const }
        }
        toast.success('Resolution updated')
        return { ok: true as const }
      } catch {
        toast.error('Could not update resolution. Try again.')
        return { ok: false as const }
      } finally {
        inflightRef.current = false
        setSubmitting(false)
      }
    },
    [],
  )

  return { setResolution, submitting }
}
