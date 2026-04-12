// supabase/functions/demote-admin/index.ts
//
// Admin-gated demotion. D-06: server-side guard prevents an admin from
// demoting themselves (which would risk locking the system out of admins).

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

    let body: { target_user_id?: unknown }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
    }

    const target_user_id = typeof body.target_user_id === 'string' ? body.target_user_id : ''
    if (!target_user_id) {
      return json({ error: 'Missing target_user_id' }, 400, corsHeaders)
    }

    // D-06: server-side self-demote guard. The literal expression
    // `target_user_id === user.id` is asserted by demote-admin.test.ts.
    if (target_user_id === user.id) {
      return json({ error: 'Cannot demote yourself' }, 400, corsHeaders)
    }

    // Last-admin guard: ensure at least one admin remains after demotion.
    const { count: adminCount } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_admin', true)
    if (adminCount !== null && adminCount <= 1) {
      return json({ error: 'Cannot demote: at least one admin must remain' }, 400, corsHeaders)
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_admin: false })
      .eq('id', target_user_id)
    if (error) {
      console.error('demote-admin update failed:', error)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }

    return json({ success: true }, 200, corsHeaders)
  } catch (err) {
    console.error('demote-admin error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
