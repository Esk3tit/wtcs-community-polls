import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { extractFunctionErrorMessage } from '@/lib/fn-error'

type PromoteArgs = {
  target_user_id?: string
  target_discord_id?: string
}

type PromoteResponse = {
  success: true
  mode: 'existing' | 'preauth'
  username?: string
}

export function usePromoteAdmin() {
  const [submitting, setSubmitting] = useState(false)

  const promote = useCallback(async (args: PromoteArgs) => {
    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke<PromoteResponse>(
        'promote-admin',
        { body: args },
      )
      if (error) {
        toast.error(await extractFunctionErrorMessage(error, 'Could not promote admin. Try again.'))
        return { ok: false as const }
      }
      if (!data?.mode) {
        toast.error('Could not promote admin. Try again.')
        return { ok: false as const }
      }
      if (data.mode === 'preauth') {
        toast.success('Discord ID pre-authorized. User becomes admin on next sign-in.')
      } else {
        toast.success(
          data.username
            ? `${data.username} promoted to admin.`
            : 'User promoted to admin.',
        )
      }
      return { ok: true as const, mode: data.mode }
    } catch {
      // ME-06: mirror useCreatePoll — if supabase.functions.invoke throws
      // synchronously (network failure, bad client URL), surface a toast
      // instead of letting the rejection propagate unhandled.
      toast.error('Could not promote admin. Try again.')
      return { ok: false as const }
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { promote, submitting }
}
