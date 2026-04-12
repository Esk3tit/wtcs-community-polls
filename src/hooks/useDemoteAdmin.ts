import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { extractFunctionErrorMessage } from '@/lib/fn-error'

export function useDemoteAdmin() {
  const [submitting, setSubmitting] = useState(false)

  const demote = useCallback(async (target_user_id: string, target_username: string) => {
    setSubmitting(true)
    try {
      const { error } = await supabase.functions.invoke('demote-admin', {
        body: { target_user_id },
      })
      if (error) {
        const msg = await extractFunctionErrorMessage(error, 'Could not demote admin. Try again.')
        if (/cannot demote yourself/i.test(msg)) {
          toast.error('Cannot demote yourself.')
        } else {
          toast.error(msg)
        }
        return { ok: false as const }
      }
      toast.success(`${target_username} demoted`)
      return { ok: true as const }
    } catch {
      // ME-06: mirror useCreatePoll — catch synchronous throws from
      // supabase.functions.invoke so the caller never sees an unhandled
      // rejection when the client is in a bad state.
      toast.error('Could not demote admin. Try again.')
      return { ok: false as const }
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { demote, submitting }
}
