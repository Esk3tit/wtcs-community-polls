// supabase/functions/toggle-results-visibility/index.ts
//
// Admin-gated toggle of polls.results_hidden. Idempotent — writes an audit
// row only on actual state change. Concurrent same-direction toggles are
// serialized by a conditional UPDATE (WHERE results_hidden != target) so
// only the first race winner produces a phantom-free audit row.

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

    let body: { poll_id?: unknown; hidden?: unknown }
    try {
      const parsed: unknown = await req.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
      }
      body = parsed as { poll_id?: unknown; hidden?: unknown }
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
    }

    const poll_id = typeof body.poll_id === 'string' ? body.poll_id.trim() : ''
    // Strict boolean check — string 'true' and number 1 must 400, not coerce.
    const hidden = typeof body.hidden === 'boolean' ? body.hidden : null
    if (!poll_id) {
      return json({ error: 'Missing poll_id' }, 400, corsHeaders)
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(poll_id)) {
      return json({ error: 'Invalid poll_id' }, 400, corsHeaders)
    }
    if (hidden === null) {
      return json({ error: 'Missing or invalid hidden' }, 400, corsHeaders)
    }

    // Race-safe conditional UPDATE: matches only rows where the current
    // value differs from the target. Postgres row-locking serializes two
    // concurrent flips — the loser sees 0 rows and emits no audit row.
    const { data: changed, error: updErr } = await supabaseAdmin
      .from('polls')
      .update({ results_hidden: hidden, results_hidden_changed_at: new Date().toISOString() })
      .eq('id', poll_id)
      .not('results_hidden', 'is', hidden)
      .select('*')
      .maybeSingle()
    if (updErr) {
      console.error('toggle-results-visibility update failed:', updErr)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }

    if (changed === null) {
      // 0 rows matched: either the poll is already at the target state
      // (no-op idempotent return) or the poll does not exist (404).
      // A follow-up SELECT disambiguates without writing an audit row.
      const { data: current, error: selErr } = await supabaseAdmin
        .from('polls')
        .select('*')
        .eq('id', poll_id)
        .maybeSingle()
      if (selErr) {
        console.error('toggle-results-visibility select failed:', selErr)
        return json({ error: 'Internal error' }, 500, corsHeaders)
      }
      if (current === null) return json({ error: 'Poll not found' }, 404, corsHeaders)
      return json({ poll: current }, 200, corsHeaders)
    }

    // State actually changed: write the audit row. The conditional UPDATE
    // guarantees before === !hidden because it only matched rows where the
    // current value differed from the target. writeAudit is intentionally
    // unwrapped — its fail-open contract handles its own errors and must
    // not be silenced at the call site.
    await writeAudit(supabaseAdmin, {
      actor_id: user.id,
      action: 'results_hidden_toggled',
      target_type: 'poll',
      target_id: poll_id,
      before: { results_hidden: !hidden },
      after: { results_hidden: hidden },
    })

    return json({ poll: changed }, 200, corsHeaders)
  } catch (err) {
    console.error('toggle-results-visibility error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
