// supabase/functions/create-poll/index.ts
//
// Admin-gated poll (suggestion) creation. Wraps create_poll_with_choices RPC
// (Plan 04-01) so the polls + choices write is transactional. Body must include
// title, description (optional), category_id (optional), image_url (optional),
// closes_at (ISO string, > now + 60s), and 2..10 choices.

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

    let body: {
      title?: unknown
      description?: unknown
      category_id?: unknown
      image_url?: unknown
      closes_at?: unknown
      choices?: unknown
    }
    try {
      const parsed = await req.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
      }
      body = parsed
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description : ''
    const category_id = typeof body.category_id === 'string' && body.category_id.trim() !== '' ? body.category_id : null
    const image_url = typeof body.image_url === 'string' && body.image_url.trim() !== '' ? body.image_url : null
    const closes_at = typeof body.closes_at === 'string' ? body.closes_at : ''
    const choices = body.choices

    if (title.length < 3 || title.length > 120) {
      return json({ error: 'Title must be between 3 and 120 characters' }, 400, corsHeaders)
    }
    if (description.length > 1000) {
      return json({ error: 'Description must be 1000 characters or fewer' }, 400, corsHeaders)
    }
    if (!Array.isArray(choices) || choices.length < 2 || choices.length > 10) {
      return json({ error: 'Must provide between 2 and 10 choices' }, 400, corsHeaders)
    }
    const trimmedChoices = (choices as unknown[]).map((c) =>
      typeof c === 'string' ? c.trim() : '',
    )
    if (trimmedChoices.some((c) => c.length < 1 || c.length > 200)) {
      return json({ error: 'Each choice must be between 1 and 200 characters' }, 400, corsHeaders)
    }
    const closesAtDate = new Date(closes_at)
    if (Number.isNaN(closesAtDate.getTime()) || closesAtDate.getTime() <= Date.now() + 60_000) {
      return json({ error: 'closes_at must be a valid ISO date at least 1 minute in the future' }, 400, corsHeaders)
    }

    const { data: pollId, error: rpcError } = await supabaseAdmin.rpc('create_poll_with_choices', {
      p_title: title,
      p_description: description,
      p_category_id: category_id,
      p_image_url: image_url,
      p_closes_at: closes_at,
      p_created_by: user.id,
      p_choices: trimmedChoices,
    })
    if (rpcError) {
      console.error('create_poll_with_choices failed:', rpcError)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }

    return json({ success: true, id: pollId }, 200, corsHeaders)
  } catch (err) {
    console.error('create-poll error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
