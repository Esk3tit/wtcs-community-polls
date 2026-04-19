// supabase/functions/close-expired-polls/index.ts
//
// HIGH #4 resolution (cross-AI review):
// This function has NO user-session admin gate. It is the documented
// carve-out from the Phase 4 admin-auth coverage rule, instead enforcing a
// shared-secret header gate. It is meant to be invoked either:
//   1. Manually for Phase 4 testing via
//      `curl -H "X-Cron-Secret: $CLOSE_SWEEPER_SECRET"`
//   2. By the Phase 5 scheduler (Netlify cron, Supabase scheduled invocation,
//      or external cron) which sets the same header.
//
// Phase 5 responsibilities (not Phase 4):
//   - Generate a secret and set CLOSE_SWEEPER_SECRET via `supabase secrets set`
//   - Wire the cron caller to include the X-Cron-Secret header
//
// Phase 4 responsibility: plant the check so there is NO window where the
// sweep exists without a gate. If CLOSE_SWEEPER_SECRET is not yet set in the
// environment, the function returns 503 "Sweeper not configured" to make the
// "secret missing" state loud and visible.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

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

  const expectedSecret = Deno.env.get('CLOSE_SWEEPER_SECRET')
  if (!expectedSecret) {
    console.warn('close-expired-polls invoked but CLOSE_SWEEPER_SECRET not set (Phase 5 will provision)')
    return json({ error: 'Sweeper not configured' }, 503, corsHeaders)
  }

  const providedSecret = req.headers.get('X-Cron-Secret')
  if (!providedSecret || providedSecret !== expectedSecret) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders)
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const nowIso = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('polls')
      .update({ status: 'closed', closed_at: nowIso })
      .eq('status', 'active')
      .lt('closes_at', nowIso)
      .select('id')
    if (error) {
      console.error('close-expired-polls sweep failed:', error)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }
    return json(
      {
        success: true,
        swept: data?.length ?? 0,
        ids: (data ?? []).map((d: { id: string }) => d.id),
      },
      200,
      corsHeaders,
    )
  } catch (err) {
    console.error('close-expired-polls error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
