// supabase/functions/search-admin-targets/index.ts
//
// Admin-gated profile search for the promote-admin dialog. ilike on
// discord_username, min 2-char query, hard limit of 10 results.
// Only returns public profile fields.

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

    let body: { query?: unknown }
    try {
      const parsed = await req.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
      }
      body = parsed
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
    }

    const query = typeof body.query === 'string' ? body.query.trim() : ''
    if (query.length < 2) {
      return json({ error: 'Query must be at least 2 characters' }, 400, corsHeaders)
    }

    // Escape LIKE special characters so they are matched literally.
    const escapedQuery = query.replace(/[%_\\]/g, '\\$&')

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, discord_id, discord_username, avatar_url')
      .ilike('discord_username', `%${escapedQuery}%`)
      .limit(10)
    if (error) {
      console.error('search-admin-targets query failed:', error)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }

    return json({ results: data ?? [] }, 200, corsHeaders)
  } catch (err) {
    console.error('search-admin-targets error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
