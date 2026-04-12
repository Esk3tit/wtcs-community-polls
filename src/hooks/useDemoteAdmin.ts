import { useState, useCallback } from 'react'
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

export function useDemoteAdmin() {
  const [submitting, setSubmitting] = useState(false)

  const demote = useCallback(async (target_user_id: string, target_username: string) => {
    setSubmitting(true)
    try {
      const { error } = await supabase.functions.invoke('demote-admin', {
        body: { target_user_id },
      })
      if (error) {
        const msg = await extractMessage(error, 'Could not demote admin. Try again.')
        if (/cannot demote yourself/i.test(msg)) {
          toast.error('Cannot demote yourself.')
        } else {
          toast.error(msg)
        }
        return { ok: false as const }
      }
      toast.success(`${target_username} demoted`)
      return { ok: true as const }
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { demote, submitting }
}
