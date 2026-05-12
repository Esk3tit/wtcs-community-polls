import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fixtureUsers, FIXTURE_PASSWORD, type FixtureUser } from '../fixtures/test-users'

// Vitest-only integration helpers — no Playwright imports anywhere in this
// module. Service-role bypasses RLS, so it is used ONLY for deterministic
// test setup (creating polls, seeding baseline votes, reading audit_log,
// teardown). Test assertions go through anon / authed clients to exercise
// the real RLS surface.
//
// Env var resolution is lazy (per-getter) so a developer running an
// unrelated test never trips on a missing key at import time. The unit
// suite has its own placeholder env in vite.config.ts; this module
// deliberately refuses to fall back to placeholders — a missing
// SUPABASE_SERVICE_ROLE_KEY MUST be a loud failure, not a silent
// false-green RLS test.

// Accept either SUPABASE_URL (canonical name in supabase docs) or
// VITE_SUPABASE_URL (the name vite.config.ts injects for the unit
// suite, and the name the CI test-integration job exports). Falling
// through to the localhost default keeps `npm run test:integration`
// working out of the box for the local Supabase stack.
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321'

function getAnonKey(): string {
  const k = process.env.VITE_SUPABASE_ANON_KEY
  if (!k) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY env var required for integration helpers. ' +
        'In local dev, run `supabase status` and export the anon key; in CI, ' +
        'derived from supabase status (see .github/workflows/ci.yml test-integration job).',
    )
  }
  return k
}

function getServiceRoleKey(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!k) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY env var required for integration helpers. ' +
        'In local dev, run `supabase status` and export it; in CI, ' +
        'derived from supabase status (see .github/workflows/ci.yml test-integration job).',
    )
  }
  return k
}

// Lazy singleton service-role client — reused across mintClients() calls so
// every test that needs admin-level DB access shares one HTTP keepalive
// pool. Lifted from e2e/helpers/auth.ts:122-138 (the Playwright variant);
// drops the Playwright Page dependency entirely.
let _serviceRoleClient: SupabaseClient | null = null

function getServiceRoleClient(): SupabaseClient {
  if (_serviceRoleClient) return _serviceRoleClient
  _serviceRoleClient = createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _serviceRoleClient
}

export type IntegrationClients = {
  anon: SupabaseClient
  authed: SupabaseClient
  serviceRole: SupabaseClient
}

/**
 * Mint three pre-scoped supabase-js clients for an integration test.
 *
 * - `anon` — anon-key only, no session attached.
 * - `authed` — anon-key + Authorization header pre-set to the fixture user's
 *   access_token. Pass `opts.authAs` to switch between memberUser (default,
 *   non-admin) and adminUser.
 * - `serviceRole` — lazy singleton, bypasses RLS. Used for deterministic
 *   test setup and audit_log reads only; never for the assertion path.
 */
export async function mintClients(opts?: {
  authAs?: 'memberUser' | 'adminUser'
}): Promise<IntegrationClients> {
  const anonKey = getAnonKey()
  const fixtureKey = opts?.authAs ?? 'memberUser'
  const user: FixtureUser = fixtureUsers[fixtureKey]

  const anon = createClient(SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Mint the authed client by signing the fixture user in via the public
  // signInWithPassword path (lifted from e2e/helpers/auth.ts:86-95), then
  // attach the resulting access_token as the Authorization header so EFs
  // and RLS see a real user. autoRefreshToken/persistSession are both off
  // to keep the test deterministic.
  const signInClient = createClient(SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await signInClient.auth.signInWithPassword({
    email: user.email,
    password: FIXTURE_PASSWORD,
  })
  if (error || !data.session) {
    throw error ?? new Error(`signInWithPassword returned no session for ${user.email}`)
  }
  const authed = createClient(SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  })

  return { anon, authed, serviceRole: getServiceRoleClient() }
}

/**
 * Create a fresh poll + two choices (label='option-a', label='option-b').
 *
 * - Two choices so `castVote()` can target option-b without colliding with
 *   the baseline vote seeded on option-a.
 * - When `seedBaseline` is undefined or true (default), seeds one baseline
 *   vote by adminUser on option-a so service-role × * cells and the
 *   `authed × hidden=false × voted` cell observe real vote_counts rows.
 * - `opts.hidden` is only included in the INSERT payload when explicitly
 *   set — until migration 10 lands, the `results_hidden` column does not
 *   exist on `polls` and PostgREST returns 400 on unknown columns. Wave 3
 *   tests pass `hidden: true|false` explicitly after migration 10 ships.
 *
 * On any post-poll-INSERT failure (choices INSERT, baseline-vote seed),
 * deletes the orphan poll via service-role before rethrowing so the suite
 * never leaks a half-built poll.
 */
export async function createFreshPoll(opts: {
  hidden?: boolean
  suiteSlug: string
  seedBaseline?: boolean
}): Promise<{ id: string; title: string; choiceIds: [string, string] }> {
  const serviceRole = getServiceRoleClient()
  // 4-char random suffix to remove the same-millisecond collision risk
  // inside a single worker (the older `${Date.now()}` form would tie
  // when two helpers ran inside the same event-loop tick).
  const title = `[TEST-11] ${opts.suiteSlug} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  const basePayload = {
    title,
    description: 'integration-helper poll',
    status: 'active' as const,
    is_pinned: true,
    category_id: 'a0000000-0000-0000-0000-000000000001',
    created_by: fixtureUsers.adminUser.id,
    closes_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }
  // Conditional spread so the unknown-column 400 doesn't fire pre-migration.
  const pollPayload = {
    ...basePayload,
    ...(opts.hidden !== undefined ? { results_hidden: opts.hidden } : {}),
  }

  const { data: pollRow, error: pollErr } = await serviceRole
    .from('polls')
    .insert(pollPayload)
    .select('id, title')
    .single()
  if (pollErr || !pollRow) {
    throw pollErr ?? new Error('createFreshPoll: polls insert returned no row')
  }
  const pollId = pollRow.id as string

  try {
    // Live schema column name is `label` (supabase/migrations/00000000000000_schema.sql:86).
    // The earlier `text` column-name draft would fail at INSERT.
    const { data: choiceRows, error: choiceErr } = await serviceRole
      .from('choices')
      .insert([
        { poll_id: pollId, label: 'option-a', sort_order: 0 },
        { poll_id: pollId, label: 'option-b', sort_order: 1 },
      ])
      .select('id, sort_order')
      .order('sort_order', { ascending: true })
    if (choiceErr || !choiceRows || choiceRows.length !== 2) {
      throw choiceErr ?? new Error('createFreshPoll: choices insert returned wrong row count')
    }
    const choiceIds: [string, string] = [choiceRows[0].id as string, choiceRows[1].id as string]

    const seedBaseline = opts.seedBaseline ?? true
    if (seedBaseline) {
      await seedBaselineVote({
        pollId,
        userId: fixtureUsers.adminUser.id,
        choiceId: choiceIds[0],
        serviceRole,
      })
    }

    return { id: pollId, title: pollRow.title as string, choiceIds }
  } catch (e) {
    // Rollback the orphan poll so the suite doesn't leak partial state.
    // Cascade in migration 0 handles choices/votes/vote_counts cleanup.
    await serviceRole.from('polls').delete().eq('id', pollId)
    throw normalizeError(e)
  }
}

/**
 * Seed a baseline vote via service-role.
 *
 * The `votes` table has no INSERT RLS policy — production writes go
 * through the `submit-vote` Edge Function which uses service-role.
 * Integration setup mirrors that write path for determinism (the alt of
 * routing setup through `submit-vote` would couple every test to that
 * EF's rate-limit + validation surface).
 */
export async function seedBaselineVote(opts: {
  pollId: string
  userId: string
  choiceId: string
  serviceRole: SupabaseClient
}): Promise<void> {
  // upsert with ignoreDuplicates: a prior test run that crashed mid-cleanup
  // could leave the (poll_id, user_id) row behind. The plain INSERT would
  // surface 23505 (unique violation on the natural key) and trip the test
  // with a useful-but-confusing error. Treat seed as idempotent — mirrors
  // the ON CONFLICT DO NOTHING discipline already used in supabase/seed.sql.
  const { error } = await opts.serviceRole.from('votes').upsert(
    {
      poll_id: opts.pollId,
      user_id: opts.userId,
      choice_id: opts.choiceId,
    },
    { onConflict: 'poll_id,user_id', ignoreDuplicates: true },
  )
  if (error) {
    throw new Error(
      `seedBaselineVote insert failed for poll=${opts.pollId} user=${opts.userId}: ${error.message}`,
    )
  }
}

/**
 * Cast a vote for a test — INSERTs into `votes` via service-role.
 *
 * `userId` defaults to memberUser; `choiceId` defaults to the `option-b`
 * choice of the given poll (so the baseline vote on option-a from
 * createFreshPoll() is not collided with). Both are overridable.
 */
export async function castVote(opts: {
  pollId: string
  userId?: string
  choiceId?: string
  serviceRole: SupabaseClient
}): Promise<void> {
  const userId = opts.userId ?? fixtureUsers.memberUser.id

  let choiceId = opts.choiceId
  if (!choiceId) {
    const { data, error } = await opts.serviceRole
      .from('choices')
      .select('id')
      .eq('poll_id', opts.pollId)
      .eq('label', 'option-b')
      .single()
    if (error || !data) {
      throw error ?? new Error(`castVote: could not resolve option-b choice for poll ${opts.pollId}`)
    }
    choiceId = data.id as string
  }

  const { error } = await opts.serviceRole.from('votes').insert({
    poll_id: opts.pollId,
    user_id: userId,
    choice_id: choiceId,
  })
  if (error) {
    throw new Error(
      `castVote insert failed for poll=${opts.pollId} user=${userId}: ${error.message}`,
    )
  }
}

/**
 * Invoke an Edge Function via `fetch` so the HTTP status code is recoverable.
 *
 * `client.functions.invoke()` collapses non-2xx responses into a generic
 * FunctionsHttpError without exposing the literal status — TEST-12
 * requires asserting 403 vs 200 directly, so we go through `fetch`
 * against `/functions/v1/<name>` with the Authorization header taken
 * from the client's current session.
 *
 * Returns `{ status, data, error }` where `data` is the parsed JSON body
 * on success and `error` is the parsed JSON body on non-2xx.
 */
export async function invokeEF(opts: {
  client: SupabaseClient
  name: string
  body: unknown
}): Promise<{ status: number; data: unknown; error: unknown }> {
  const { data: sessionData } = await opts.client.auth.getSession()
  const accessToken = sessionData.session?.access_token
  const anonKey = getAnonKey()

  // apikey + Authorization both required by the Supabase functions gateway.
  // When the client is anon-only (no session), fall back to the anon key
  // for Authorization so the gateway accepts the request and the EF itself
  // is the one that returns 401 (which is what TEST-12 wants to assert
  // on the non-authenticated path).
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${accessToken ?? anonKey}`,
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${opts.name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(opts.body),
  })

  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (response.ok) {
    return { status: response.status, data: parsed, error: null }
  }
  return { status: response.status, data: null, error: parsed }
}

export type AuditRow = {
  id: string
  actor_id: string | null
  action: string
  target_type: string
  target_id: string | null
  before: unknown
  after: unknown
  created_at: string
}

/**
 * Read audit_log rows for a target via service-role (admin-only RLS
 * SELECT would also work for an admin-authed caller, but service-role
 * is the canonical read surface for tests).
 *
 * `action` is optional — omit to read all actions for the target.
 */
export async function readAuditLog(opts: {
  serviceRole: SupabaseClient
  targetId: string
  action?: string
}): Promise<AuditRow[]> {
  let query = opts.serviceRole.from('audit_log').select('*').eq('target_id', opts.targetId)
  if (opts.action) query = query.eq('action', opts.action)
  const { data, error } = await query
  if (error) {
    throw new Error(`readAuditLog failed for target=${opts.targetId}: ${error.message}`)
  }
  return (data ?? []) as AuditRow[]
}

/**
 * Delete a test poll via service-role. Migration 0's ON DELETE CASCADE
 * handles choices / votes / vote_counts cleanup in one statement.
 *
 * Rethrows on delete error (no silent swallow) — a leaked poll surfaces
 * as fixture pollution across the suite and must fail loud.
 */
export async function cleanupPoll(opts: {
  serviceRole: SupabaseClient
  pollId: string
}): Promise<void> {
  const { error } = await opts.serviceRole.from('polls').delete().eq('id', opts.pollId)
  if (error) {
    throw normalizeError(error)
  }
}

// Coerce arbitrary thrown values (PostgrestError shapes, plain strings,
// null/undefined) into a real Error so the test reporter has a useful
// stack/message to render. Lifted from e2e/fixtures/poll-fixture.ts:126-136
// without the Playwright-specific wording.
function normalizeError(e: unknown): Error {
  if (e instanceof Error) return e
  if (typeof e === 'object' && e !== null) {
    const message = 'message' in e && typeof e.message === 'string' ? e.message : undefined
    const code = 'code' in e && typeof e.code === 'string' ? ` (code: ${e.code})` : ''
    const details =
      'details' in e && typeof e.details === 'string' && e.details ? ` — ${e.details}` : ''
    if (message) return new Error(`${message}${code}${details}`)
  }
  return new Error(`Non-Error throw: ${String(e)}`)
}
