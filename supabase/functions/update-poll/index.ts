// Admin-gated poll edit. RPC owns choice-table writes; EXISTS pre-check on votes returns 409.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin, adminCheckResponse } from '../_shared/admin-auth.ts'

function json(body: unknown, status: number, cors: HeadersInit) {
  const headers = new Headers(cors)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(body), { status, headers })
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
      poll_id?: unknown
      title?: unknown
      description?: unknown
      category_id?: unknown
      image_url?: unknown
      closes_at?: unknown
      choices?: unknown
    }
    try {
      const parsed: unknown = await req.json()
      if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
        return json({ error: 'JSON body must be an object' }, 400, corsHeaders)
      }
      body = parsed as typeof body
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
    }

    const poll_id = typeof body.poll_id === 'string' ? body.poll_id.trim() : ''
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description : ''
    const categoryIdRaw = typeof body.category_id === 'string' ? body.category_id.trim() : ''
    const category_id = categoryIdRaw === '' ? null : categoryIdRaw
    if (
      category_id !== null &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category_id)
    ) {
      return json({ error: 'category_id must be a valid UUID' }, 400, corsHeaders)
    }
    const image_url = typeof body.image_url === 'string' && body.image_url.trim() !== '' ? body.image_url.trim() : null
    const closes_at = typeof body.closes_at === 'string' ? body.closes_at : ''
    const choicesRaw = body.choices

    if (!poll_id) {
      return json({ error: 'Missing poll_id' }, 400, corsHeaders)
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(poll_id)) {
      return json({ error: 'Invalid poll_id' }, 400, corsHeaders)
    }
    if (title.length < 3 || title.length > 120) {
      return json({ error: 'Title must be between 3 and 120 characters' }, 400, corsHeaders)
    }
    if (description.length > 1000) {
      return json({ error: 'Description must be 1000 characters or fewer' }, 400, corsHeaders)
    }
    if (!Array.isArray(choicesRaw) || choicesRaw.length < 2 || choicesRaw.length > 10) {
      return json({ error: 'Must provide between 2 and 10 choices' }, 400, corsHeaders)
    }
    const choices = (choicesRaw as unknown[]).map((c) =>
      typeof c === 'string' ? c.trim() : '',
    )
    if (choices.some((c) => c.length < 1 || c.length > 200)) {
      return json({ error: 'Each choice must be between 1 and 200 characters' }, 400, corsHeaders)
    }
    const normalizedChoices = choices.map((c) => c.toLowerCase())
    if (new Set(normalizedChoices).size !== normalizedChoices.length) {
      return json({ error: 'Duplicate choice' }, 400, corsHeaders)
    }
    const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
    if (!ISO_WITH_TZ.test(closes_at)) {
      return json({ error: 'closes_at must be ISO-8601 with timezone (e.g. 2024-12-31T23:59:59Z)' }, 400, corsHeaders)
    }
    const closesAtDate = new Date(closes_at)
    if (Number.isNaN(closesAtDate.getTime())) {
      return json({ error: 'closes_at must be a valid ISO date' }, 400, corsHeaders)
    }
    if (closesAtDate.toISOString().slice(0, 10) !== closes_at.slice(0, 10)) {
      return json({ error: 'closes_at contains an impossible date' }, 400, corsHeaders)
    }
    if (closesAtDate.getTime() <= Date.now() + 60_000) {
      return json({ error: 'closes_at must be at least 1 minute in the future' }, 400, corsHeaders)
    }

    // Pre-check: refuse edit if votes exist (409 instead of opaque RPC error).
    const { data: voteRow, error: voteCheckError } = await supabaseAdmin
      .from('votes')
      .select('id')
      .eq('poll_id', poll_id)
      .limit(1)
      .maybeSingle()
    if (voteCheckError) {
      console.error('update-poll vote pre-check failed:', voteCheckError)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }
    if (voteRow) {
      return json({ error: 'Cannot edit: responses already received' }, 409, corsHeaders)
    }

    // Choice replacement delegated to RPC (single transaction).
    const { data: updatedId, error: rpcError } = await supabaseAdmin.rpc('update_poll_with_choices', {
      p_poll_id: poll_id,
      p_title: title,
      p_description: description,
      p_category_id: category_id,
      p_image_url: image_url,
      p_closes_at: closes_at,
      p_choices: choices,
    })
    if (rpcError) {
      // Match SQLSTATE codes (P0002/P0003/P0004) with message-regex fallback.
      const rpcCode = (rpcError as { code?: string }).code
      const rpcMsg = typeof rpcError.message === 'string' ? rpcError.message : ''
      if (rpcCode === 'P0003' || /responses already received/i.test(rpcMsg)) {
        return json({ error: 'Cannot edit: responses already received' }, 409, corsHeaders)
      }
      if (rpcCode === 'P0002' || /Poll not found/i.test(rpcMsg)) {
        return json({ error: 'Poll not found' }, 404, corsHeaders)
      }
      if (rpcCode === 'P0004') {
        return json({ error: 'Must provide between 2 and 10 choices' }, 400, corsHeaders)
      }
      console.error('update_poll_with_choices failed:', rpcError)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }

    return json({ success: true, id: updatedId }, 200, corsHeaders)
  } catch (err) {
    console.error('update-poll error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
