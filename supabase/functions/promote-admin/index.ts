// supabase/functions/promote-admin/index.ts
//
// Admin-gated promotion. Two branches:
//   1. target_user_id (existing profile)  -> UPDATE profiles SET is_admin=true
//   2. target_discord_id (pre-auth)       -> INSERT INTO admin_discord_ids
//                                             ON CONFLICT DO NOTHING, then
//                                             retroactively flip any matching
//                                             profile rows.
// snowflake validation: /^\d{17,19}$/

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

    let body: { target_user_id?: unknown; target_discord_id?: unknown }
    try {
      const parsed = await req.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
      }
      body = parsed
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
    }

    const target_user_id = typeof body.target_user_id === 'string' ? body.target_user_id.trim() : ''
    const target_discord_id = typeof body.target_discord_id === 'string' ? body.target_discord_id.trim() : ''

    if (!!target_user_id === !!target_discord_id) {
      return json({ error: 'Must provide exactly one of target_user_id or target_discord_id' }, 400, corsHeaders)
    }

    // Branch 1: existing profile -> flip is_admin to true
    if (target_user_id) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_admin: true })
        .eq('id', target_user_id)
        .select('id')
        .single()
      if (error) {
        if (error.code === 'PGRST116') {
          return json({ error: 'Target profile not found' }, 404, corsHeaders)
        }
        console.error('promote-admin profile update failed:', error)
        return json({ error: 'Internal error' }, 500, corsHeaders)
      }
      return json({ success: true, mode: 'existing' }, 200, corsHeaders)
    }

    // Branch 2: pre-auth via Discord ID -> snowflake validation, then INSERT
    if (!/^\d{17,19}$/.test(target_discord_id)) {
      return json({ error: 'Invalid Discord ID format' }, 400, corsHeaders)
    }

    const { error: insertError } = await supabaseAdmin
      .from('admin_discord_ids')
      .insert({ discord_id: target_discord_id })
    // Ignore PostgreSQL 23505 (already pre-authorized) — operation is idempotent.
    if (insertError && insertError.code !== '23505') {
      console.error('promote-admin admin_discord_ids insert failed:', insertError)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }

    // Retroactively flip any matching profile rows so a returning user is admin.
    const { error: flipError } = await supabaseAdmin
      .from('profiles')
      .update({ is_admin: true })
      .eq('discord_id', target_discord_id)
    if (flipError) {
      console.error('promote-admin retroactive profile flip failed:', flipError)
      // Don't fail the whole request; pre-auth still succeeded.
    }

    return json({ success: true, mode: 'preauth' }, 200, corsHeaders)
  } catch (err) {
    console.error('promote-admin error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
