// supabase/functions/delete-category/index.ts
//
// Admin-gated category delete. FK on polls.category_id is ON DELETE SET NULL,
// so deleting a category gracefully unlinks any polls referencing it instead
// of cascading.

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

    let body: { category_id?: unknown }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
    }

    const category_id = typeof body.category_id === 'string' ? body.category_id : ''
    if (!category_id) {
      return json({ error: 'Missing category_id' }, 400, corsHeaders)
    }

    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', category_id)
    if (error) {
      console.error('delete-category failed:', error)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }

    return json({ success: true }, 200, corsHeaders)
  } catch (err) {
    console.error('delete-category error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
