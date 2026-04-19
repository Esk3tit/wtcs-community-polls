// supabase/functions/delete-poll/index.ts
//
// Admin-gated hard delete (D-18). Server-side delete lock: rejects 409 if any
// votes exist for the poll (uses EXISTS on the votes table — vote_counts is a
// CACHE and must NEVER be the source of truth for security decisions).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin, adminCheckResponse } from '../_shared/admin-auth.ts'

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

    let body: { poll_id?: unknown }
    try {
      const parsed: unknown = await req.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
      }
      body = parsed as { poll_id?: unknown }
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
    }

    const poll_id = typeof body.poll_id === 'string' ? body.poll_id.trim() : ''
    if (!poll_id) {
      return json({ error: 'Missing poll_id' }, 400, corsHeaders)
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(poll_id)) {
      return json({ error: 'Invalid poll_id' }, 400, corsHeaders)
    }

    // EXISTS guard: refuse to delete if any votes already exist (D-18).
    const { data: voteRow, error: voteCheckError } = await supabaseAdmin
      .from('votes')
      .select('id')
      .eq('poll_id', poll_id)
      .limit(1)
      .maybeSingle()
    if (voteCheckError) {
      console.error('delete-poll vote pre-check failed:', voteCheckError)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }
    if (voteRow) {
      return json({ error: 'Cannot delete: responses already received' }, 409, corsHeaders)
    }

    const { error } = await supabaseAdmin
      .from('polls')
      .delete()
      .eq('id', poll_id)
      .select('id')
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        return json({ error: 'Poll not found' }, 404, corsHeaders)
      }
      console.error('delete-poll failed:', error)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }

    return json({ success: true }, 200, corsHeaders)
  } catch (err) {
    console.error('delete-poll error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
