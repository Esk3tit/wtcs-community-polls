import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

type PromoteArgs = {
  target_user_id?: string
  target_discord_id?: string
}

type PromoteResponse = {
  success: true
  mode: 'existing' | 'preauth'
  username?: string
}

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
        toast.error(await extractMessage(error, 'Could not promote admin. Try again.'))
        return { ok: false as const }
      }
      if (data?.mode === 'preauth') {
        toast.success('Discord ID pre-authorized. User becomes admin on next sign-in.')
      } else {
        toast.success(
          data?.username
            ? `${data.username} promoted to admin.`
            : 'User promoted to admin.',
        )
      }
      return { ok: true as const, mode: data?.mode }
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { promote, submitting }
}
