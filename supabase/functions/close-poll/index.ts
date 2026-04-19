// supabase/functions/close-poll/index.ts
//
// Admin-gated manual close (D-15). Body MUST include resolution
// in ['addressed','forwarded','closed']; the EF rejects 400 otherwise.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin, adminCheckResponse } from '../_shared/admin-auth.ts'

const ALLOWED_RESOLUTIONS = ['addressed', 'forwarded', 'closed'] as const

function json(body: unknown, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(cors as Record<string, string>), 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401, corsHeaders)

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401, corsHeaders)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const adminCheck = await requireAdmin(supabaseAdmin, user.id)
    if (!adminCheck.ok) { const r = adminCheckResponse(adminCheck); return json({ error: r.error }, r.status, corsHeaders) }

    let body: { poll_id?: unknown; resolution?: unknown }
    try {
      const parsed = await req.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
      }
      body = parsed
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
    }

    const poll_id = typeof body.poll_id === 'string' ? body.poll_id : ''
    const resolution = typeof body.resolution === 'string' ? body.resolution : ''
    if (!poll_id) {
      return json({ error: 'Missing poll_id' }, 400, corsHeaders)
    }
    if (!resolution || !ALLOWED_RESOLUTIONS.includes(resolution as typeof ALLOWED_RESOLUTIONS[number])) {
      return json({ error: 'Invalid resolution' }, 400, corsHeaders)
    }

    // ME-v2-01 / LO-01: guard on status='active' so double-close or close on
    // a lazy-closed (closes_at<now but raw_status='active') poll does NOT
    // overwrite closed_at/resolution. PGRST116 here means either the poll
    // doesn't exist OR it is already closed — both are safe no-ops from the
    // audit-trail perspective, so we return a clearer collapsed message.
    const { error } = await supabaseAdmin
      .from('polls')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        resolution,
      })
      .eq('id', poll_id)
      .eq('status', 'active')
      .select('id')
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        return json({ error: 'Poll not found or already closed' }, 404, corsHeaders)
      }
      console.error('close-poll update failed:', error)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }

    return json({ success: true }, 200, corsHeaders)
  } catch (err) {
    console.error('close-poll error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
