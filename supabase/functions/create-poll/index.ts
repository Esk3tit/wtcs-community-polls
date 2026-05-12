// Admin-gated poll creation wrapping create_poll_with_choices RPC.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin, adminCheckResponse } from '../_shared/admin-auth.ts'
import { writeAudit } from '../_shared/audit.ts'

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
      title?: unknown
      description?: unknown
      category_id?: unknown
      image_url?: unknown
      closes_at?: unknown
      choices?: unknown
      results_hidden?: unknown
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
    const categoryIdRaw = typeof body.category_id === 'string' ? body.category_id.trim() : ''
    const category_id = categoryIdRaw === '' ? null : categoryIdRaw
    if (
      category_id !== null &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category_id)
    ) {
      return json({ error: 'category_id must be a valid UUID' }, 400, corsHeaders)
    }
    const image_url = typeof body.image_url === 'string' && body.image_url.trim() !== '' ? body.image_url.trim() : null
    // LO-v2-02: match client-side validation (validateSuggestionForm). Without
    // this guard, a curl request bypassing the form can persist arbitrary
    // strings in polls.image_url and render as a broken <img src>.
    if (image_url !== null) {
      try {
        new URL(image_url)
      } catch {
        return json({ error: 'image_url must be a valid URL' }, 400, corsHeaders)
      }
    }
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
    const normalizedChoices = trimmedChoices.map((choice) => choice.toLowerCase())
    if (new Set(normalizedChoices).size !== normalizedChoices.length) {
      return json({ error: 'Choices must be unique' }, 400, corsHeaders)
    }
    const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
    if (!ISO_WITH_TZ.test(closes_at)) {
      return json({ error: 'closes_at must be ISO-8601 with timezone (e.g. 2024-12-31T23:59:59Z)' }, 400, corsHeaders)
    }
    const closesAtDate = new Date(closes_at)
    if (Number.isNaN(closesAtDate.getTime())) {
      return json({ error: 'closes_at must be a valid ISO date' }, 400, corsHeaders)
    }
    const [datePart] = closes_at.split('T')
    const [year, month, day] = datePart.split('-').map(Number)
    const calendarDate = new Date(Date.UTC(year, month - 1, day))
    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() + 1 !== month ||
      calendarDate.getUTCDate() !== day
    ) {
      return json({ error: 'closes_at contains an impossible date' }, 400, corsHeaders)
    }
    if (closesAtDate.getTime() <= Date.now() + 60_000) {
      return json({ error: 'closes_at must be at least 1 minute in the future' }, 400, corsHeaders)
    }

    // Strict boolean validation: never coerce 'true'/1/null. Default-false admin-bootstrap polls
    // get the column DEFAULT from the polls schema; the rare opt-in (true) is applied via a
    // post-RPC UPDATE below so the RPC contract stays unchanged.
    const results_hidden =
      body.results_hidden === undefined
        ? false
        : typeof body.results_hidden === 'boolean'
          ? body.results_hidden
          : null
    if (results_hidden === null) {
      return json({ error: 'Invalid results_hidden' }, 400, corsHeaders)
    }

    // RPC signature unchanged — results_hidden uses column DEFAULT; rare opt-in flip happens via post-RPC UPDATE below.
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

    // Audit the create BEFORE the optional results_hidden flip. If the
    // flip+compensating-DELETE path falls through to the orphan branch
    // below, this row is the only forensic breadcrumb tying the orphan
    // back to its admin actor. `after.results_hidden` here reflects the
    // RPC-default state (false); a successful flip emits a second row
    // (`results_hidden_set_at_create`) so the audit timeline shows both
    // events distinctly.
    await writeAudit(supabaseAdmin, {
      actor_id: user.id,
      action: 'poll_created',
      target_type: 'poll',
      target_id: pollId,
      before: null,
      after: { title, category_id, results_hidden },
    })

    if (results_hidden === true) {
      const { error: updateError } = await supabaseAdmin
        .from('polls')
        .update({ results_hidden: true, results_hidden_changed_at: new Date().toISOString() })
        .eq('id', pollId)
      if (updateError) {
        // Compensating DELETE so the caller observes all-or-nothing semantics:
        // returning 500 without the DELETE would leave a visible poll in production despite the admin's hidden intent.
        // The CASCADE on choices/vote_counts cleans up any pre-seeded rows.
        const { error: deleteError } = await supabaseAdmin.from('polls').delete().eq('id', pollId)
        if (deleteError) {
          // Orphan branch: poll exists in `public.polls` with results_hidden=false
          // (column DEFAULT) despite the admin's hidden=true intent. The
          // compensating DELETE could not clean it up. Emit a distinct audit
          // action so an operator searching audit_log by action can spot
          // orphans without scanning every poll_created row.
          console.error('create-poll compensation DELETE failed:', { pollId, deleteError, originalUpdateError: updateError })
          await writeAudit(supabaseAdmin, {
            actor_id: user.id,
            action: 'poll_created_orphaned',
            target_type: 'poll',
            target_id: pollId,
            before: null,
            after: {
              results_hidden_intended: true,
              results_hidden_actual: false,
              reason: 'compensation_delete_failed',
            },
          })
        }
        return json({ error: 'Failed to set results_hidden — poll creation rolled back. Retry.' }, 500, corsHeaders)
      }

      await writeAudit(supabaseAdmin, {
        actor_id: user.id,
        action: 'results_hidden_set_at_create',
        target_type: 'poll',
        target_id: pollId,
        before: null,
        after: { results_hidden: true },
      })
    }

    return json({ success: true, id: pollId }, 200, corsHeaders)
  } catch (err) {
    console.error('create-poll error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
