// supabase/functions/delete-poll/index.ts
//
// Admin-gated hard delete, always allowed at any lifecycle stage. An
// authenticated admin may delete a suggestion before votes, while voting is
// active, or after close. The polls DELETE cascades to votes, vote_counts, and
// choices via ON DELETE CASCADE FKs, so responses are removed with no orphans.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin, adminCheckResponse } from '../_shared/admin-auth.ts'
import { writeAudit } from '../_shared/audit.ts'

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

    // Best-effort capture of pre-DELETE snapshot for the audit `before` payload.
    // maybeSingle() returns null on miss without erroring, so the subsequent
    // DELETE remains the canonical 404 source — the existing PGRST116 envelope
    // is preserved.
    const { data: priorRow } = await supabaseAdmin
      .from('polls')
      .select('title, status')
      .eq('id', poll_id)
      .maybeSingle()

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

    // priorRow is effectively unconditional here: the DELETE above with
    // .single() already 404s via PGRST116 when the row does not exist, so
    // by this line we're guaranteed the row was present pre-DELETE.
    // Record null in `before` on the rare transient miss rather than
    // a synthesised { id } payload — keeps the audit shape uniform.
    await writeAudit(supabaseAdmin, {
      actor_id: user.id,
      action: 'poll_deleted',
      target_type: 'poll',
      target_id: poll_id,
      before: priorRow ? { title: priorRow.title, status: priorRow.status } : null,
      after: null,
    })

    return json({ success: true }, 200, corsHeaders)
  } catch (err) {
    console.error('delete-poll error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
