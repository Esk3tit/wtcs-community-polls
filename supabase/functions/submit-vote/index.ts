import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'
import { Ratelimit } from 'https://esm.sh/@upstash/ratelimit@2.0.5'
import { Redis } from 'https://esm.sh/@upstash/redis@1.34.6'
import { getCorsHeaders } from '../_shared/cors.ts'

// Rate limiter: 5 requests per 60-second sliding window, per user.
// Instantiated at module level so it's reused across invocations.
//
// Local/CI degradation: in the Supabase local Docker stack the EF runtime's
// SUPABASE_URL is `http://kong:8000` (Kong service alias on the Docker
// network — see supabase/cli `internal/utils/config.go` KongAliases). CI
// doesn't provision Upstash creds for the local stack.
//
// Implementation note: an earlier version of this file relied on
// `Redis.fromEnv()` throwing when env vars are missing. It does NOT —
// `@upstash/redis@1.34.6` only `console.warn`s and returns a broken
// client (verified against npm tarball nodejs.mjs:91-108). Construction
// "succeeds", and the failure surfaces 4-5 seconds later as a fetch
// timeout on `ratelimit.limit()`. So we MUST check the env vars
// explicitly here and bypass `Redis.fromEnv()` entirely.
//
// Production fail-closed: if the URL is anything other than the local-
// stack pattern (e.g. `https://*.supabase.co` or a custom prod domain)
// AND the Upstash creds are missing, throw at module-load → function
// fails to deploy → loud failure. Local stack falls through to a no-rate-
// limit warn-and-continue path, intentionally reachable only from CI/dev.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const IS_LOCAL_SUPABASE = /^https?:\/\/(kong|localhost|127\.0\.0\.1|host\.docker\.internal)(:\d+)?(\/|$)/.test(
  SUPABASE_URL,
)
const UPSTASH_URL = Deno.env.get('UPSTASH_REDIS_REST_URL')
const UPSTASH_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')

let ratelimit: Ratelimit | null = null
if (UPSTASH_URL && UPSTASH_TOKEN) {
  ratelimit = new Ratelimit({
    redis: new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN }),
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    prefix: 'wtcs:vote',
    // Tighten timeout from the 5s default so a flaky/misconfigured Upstash
    // doesn't add multi-second latency to every vote in production.
    timeout: 1000,
  })
} else if (!IS_LOCAL_SUPABASE) {
  // Production (or any non-local stack) without Upstash creds is a fatal
  // misconfig — refuse to load so the deploy fails visibly.
  throw new Error(
    'submit-vote: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required ' +
      'in non-local environments. Refusing to load to preserve fail-closed posture.',
  )
} else {
  console.warn(
    '[submit-vote] Upstash unconfigured on local stack (SUPABASE_URL=' +
      SUPABASE_URL +
      '); rate-limiting DISABLED. This branch is intentionally only reachable from ' +
      'local Docker / CI.',
  )
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  // Handle CORS preflight -- MUST be first check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Verify user auth via their JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limit check -- per user ID, counts ALL attempts regardless of validation outcome (D-07, D-08)
    // Positioned before guild_member check and body parsing so even invalid requests consume quota.
    // Runtime failure modes:
    //  - ratelimit non-null + Redis healthy: normal path.
    //  - ratelimit non-null + Redis transiently unavailable: ratelimit.limit() throws,
    //    outer catch returns 500 (fail-closed at runtime).
    //  - ratelimit null: only possible on local Supabase stack (see module-load
    //    block above), where rate-limiting is intentionally disabled for CI/dev.
    if (ratelimit) {
      const { success: rateLimitOk } = await ratelimit.limit(user.id)
      if (!rateLimitOk) {
        return new Response(
          JSON.stringify({ error: 'Too many responses too quickly. Please wait a moment and try again.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
        )
      }
    }

    // Use service_role client for writes (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Enforce guild membership and MFA at submission time (not just login)
    // Defense-in-depth: prevents stale sessions or bypasses
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('guild_member, mfa_verified')
      .eq('id', user.id)
      .single()

    if (!profile?.guild_member || !profile?.mfa_verified) {
      return new Response(
        JSON.stringify({ error: 'Your account does not meet the requirements to respond' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse and validate request body
    let poll_id: string, choice_id: string
    try {
      const body = await req.json()
      poll_id = body.poll_id
      choice_id = body.choice_id
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!poll_id || !choice_id) {
      return new Response(
        JSON.stringify({ error: 'Missing poll_id or choice_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate poll exists and is active (reject votes on closed suggestions)
    const { data: poll } = await supabaseAdmin
      .from('polls')
      .select('id, status')
      .eq('id', poll_id)
      .single()

    if (!poll || poll.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'This topic is not currently accepting responses' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate choice belongs to this poll (prevent cross-poll choice injection)
    const { data: choice } = await supabaseAdmin
      .from('choices')
      .select('id')
      .eq('id', choice_id)
      .eq('poll_id', poll_id)
      .single()

    if (!choice) {
      return new Response(
        JSON.stringify({ error: 'Invalid choice for this topic' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Attempt INSERT directly -- DB UNIQUE constraint is the race-safe enforcement.
    // DO NOT check for existing vote first (TOCTOU race condition).
    // The constraint `votes_one_per_user_per_poll` on (poll_id, user_id) guarantees
    // at most one vote per user per poll, even under concurrent requests.
    const { error: voteError } = await supabaseAdmin
      .from('votes')
      .insert({ poll_id, choice_id, user_id: user.id })

    if (voteError) {
      // PostgreSQL error code 23505 = UNIQUE constraint violation = already voted.
      // This is the expected path for duplicate vote attempts and is race-safe.
      if (voteError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'You have already responded to this topic' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw voteError
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('submit-vote error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
