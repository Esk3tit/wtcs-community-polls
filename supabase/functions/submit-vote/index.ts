import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight -- MUST be first check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    // Parse and validate request body
    const { poll_id, choice_id } = await req.json()
    if (!poll_id || !choice_id) {
      return new Response(
        JSON.stringify({ error: 'Missing poll_id or choice_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service_role client for writes (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

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
