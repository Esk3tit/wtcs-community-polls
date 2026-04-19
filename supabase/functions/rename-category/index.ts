// supabase/functions/rename-category/index.ts
//
// Admin-gated category rename. Validates name length 1..50.
// Maps 23505 (unique violation) to 409.

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

    let body: { category_id?: unknown; name?: unknown }
    try {
      const parsed = await req.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
      }
      body = parsed
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
    }

    const category_id = typeof body.category_id === 'string' ? body.category_id : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!category_id) {
      return json({ error: 'Missing category_id' }, 400, corsHeaders)
    }
    if (name.length < 1 || name.length > 50) {
      return json({ error: 'Category name must be between 1 and 50 characters' }, 400, corsHeaders)
    }

    // LO-v2-01: mirror create-category's empty-slug guard. A name like "!!!"
    // slugifies to '' which would hit a NOT NULL violation and surface as a
    // generic 500. Reject cleanly with a 400 instead.
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!slug) {
      return json({ error: 'Category name must contain at least one alphanumeric character' }, 400, corsHeaders)
    }
    const { data, error } = await supabaseAdmin
      .from('categories')
      .update({ name, slug })
      .eq('id', category_id)
      .select('id, name, slug')
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        return json({ error: 'Category not found' }, 404, corsHeaders)
      }
      if (error.code === '23505') {
        return json({ error: 'Category already exists' }, 409, corsHeaders)
      }
      console.error('rename-category update failed:', error)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }

    return json({ success: true, category: data }, 200, corsHeaders)
  } catch (err) {
    console.error('rename-category error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
