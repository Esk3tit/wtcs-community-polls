# Phase 11: Schema + RLS + EF Foundations — Pattern Map

**Updated 2026-05-17 (Phase 14, DBHY-04)** — original form had admin-OR drift; see REVIEW-FIX-H3.

**Mapped:** 2026-05-11
**Files analyzed:** 7 new, 13 modified (12 EF retrofits + 1 read-only verification + package.json + ci.yml)
**Analogs found:** 7/7 new files have strong analogs; all 12 retrofit targets share one canonical EF skeleton

## File Classification

### New files

| New file | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `supabase/migrations/00000000000010_results_hidden_audit.sql` | migration | schema-DDL | `supabase/migrations/00000000000005_admin_phase4.sql` | exact (view rewrite + ALTER+SET security_invoker), partial RLS-policy DROP+CREATE from `migrations/00000000000001_rls.sql:70-82` |
| `supabase/functions/_shared/audit.ts` | shared utility (Deno) | helper-call | `supabase/functions/_shared/admin-auth.ts` | exact (signature shape, JSDoc style, never-throws contract) |
| `supabase/functions/toggle-results-visibility/index.ts` | controller (Edge Function) | request-response (admin-gated UPDATE) | `supabase/functions/pin-poll/index.ts` | exact (single-boolean flip on `polls`); secondary `close-poll/index.ts` for the `new Date().toISOString()` timestamp precedent (D-13) |
| `e2e/integration/helpers.ts` | test utility | helper-call | `e2e/helpers/auth.ts` (`getAdminClient()` lazy singleton) + `e2e/fixtures/poll-fixture.ts` (try/catch/finally cleanup) | role-match (lifts client minting + freshPoll cleanup shape, drops Playwright `test.extend` machinery) |
| `e2e/integration/vote-counts-rls.test.ts` | test (integration) | RLS-invariant assertion | `src/__tests__/admin/polls-effective-invariant.test.ts` | exact (Vitest + `describe`/`it`; replaces filesystem-scan invariant with 12-cell `describe.each` matrix) |
| `e2e/integration/toggle-results-visibility.test.ts` | test (integration) | request-response assertion | `src/__tests__/admin/polls-effective-invariant.test.ts` + `e2e/fixtures/poll-fixture.ts` cleanup discipline | role-match (Vitest + supabase-js, calls `functions.invoke`, asserts response + audit row) |
| `vitest.config.integration.ts` | config | build/test config | `vite.config.ts` (embedded `test:` block at lines 41-54) | role-match (extract `test:` block, scope `include` to `e2e/integration/`, omit `jsdom` env) |

### Modified files

| Modified file | Role | Modification Pattern | Source of Pattern |
|---------------|------|----------------------|-------------------|
| `supabase/functions/close-expired-polls/index.ts` | controller (cron EF) | append `writeAudit()` loop per closed-poll row in the `data` array (D-05, RESEARCH Pattern 5) | `audit.ts` (NEW) + existing `.select('id')` return at lines 53-58 |
| `supabase/functions/close-poll/index.ts` | controller | append `writeAudit()` after UPDATE success (line 80 area), before `return json({success:true}, 200)` | `audit.ts` (NEW) |
| `supabase/functions/create-category/index.ts` | controller | same retrofit pattern (audit after INSERT success) | `audit.ts` (NEW) |
| `supabase/functions/create-poll/index.ts` | controller | (a) accept optional `results_hidden?: boolean` per D-08/D-10; (b) audit `poll_created`; (c) IF `results_hidden=true` at creation, audit a second `results_hidden_set_at_creation` row (D-09) | `pin-poll/index.ts:53` `typeof === 'boolean'` validation pattern + `audit.ts` |
| `supabase/functions/delete-category/index.ts` | controller | audit after DELETE success (action='category_deleted', before=row snapshot, after=null) | `audit.ts` (NEW) |
| `supabase/functions/delete-poll/index.ts` | controller | audit after DELETE success | `audit.ts` (NEW) |
| `supabase/functions/demote-admin/index.ts` | controller | audit after profile UPDATE success | `audit.ts` (NEW) |
| `supabase/functions/pin-poll/index.ts` | controller | audit after UPDATE success (action='poll_pinned' or 'poll_unpinned' based on `isPinned`) | `audit.ts` (NEW) |
| `supabase/functions/promote-admin/index.ts` | controller | audit after profile UPDATE success | `audit.ts` (NEW) |
| `supabase/functions/rename-category/index.ts` | controller | audit after UPDATE success | `audit.ts` (NEW) |
| `supabase/functions/set-resolution/index.ts` | controller | audit after UPDATE success | `audit.ts` (NEW) |
| `supabase/functions/update-poll/index.ts` | controller | audit after RPC success | `audit.ts` (NEW) |
| `supabase/functions/_shared/admin-auth.ts` | shared utility | **read-only confirm** — no changes, signature `requireAdmin(supabaseAdmin, userId)` reused unchanged | itself |
| `package.json` | config | add `"test:integration": "vitest run --config vitest.config.integration.ts"` to `scripts` block | existing `"test": "vitest run"` entry at package.json line 12 |
| `.github/workflows/ci.yml` | CI config | add `test-integration` job between `lint-and-unit` (line 21) and `e2e` (line 40); reuse `supabase/setup-cli@v1`, `supabase start`, `Derive local Supabase keys`, `Apply fixture seed` steps from existing e2e job (lines 53-132) | existing `e2e` job step block (`.github/workflows/ci.yml:40-132`) |

---

## Pattern Assignments

### `supabase/migrations/00000000000010_results_hidden_audit.sql` (migration, schema-DDL)

**Analogs:**
1. `supabase/migrations/00000000000005_admin_phase4.sql` (sectioned migration; view + ALTER VIEW SET security_invoker; lines 12-39)
2. `supabase/migrations/00000000000001_rls.sql` (vote_counts policy CREATE; lines 70-82)
3. `supabase/migrations/00000000000009_admin_integrity_rls.sql` (`is_current_user_admin()` definition — reuse via call, do NOT redefine)

**Section-header comment pattern (from migration 5, lines 1-9):**

```sql
-- =====================================================================
-- Phase 4: Admin Panel & Suggestion Management
-- Bundles: lazy-close view, admin helper, admin-bypass RLS, create-poll
-- =====================================================================

-- ---------------------------------------------------------------------
-- SECTION 1 -- Lazy-close view (D-12 read path)
-- ---------------------------------------------------------------------
```

Phase 11 mirrors: top banner + numbered SECTION dividers per RESEARCH § "Pattern 1: Atomic Migration 10".

**View rewrite pattern (copy verbatim from `migrations/00000000000005_admin_phase4.sql:12-39`, ADD only the two new columns inside the existing column list and re-apply `ALTER VIEW … SET (security_invoker = on)` immediately after — D-17, D-18):**

```sql
CREATE OR REPLACE VIEW public.polls_effective AS
SELECT
  id, title, description, category_id, image_url,
  CASE WHEN status = 'active' AND closes_at < now() THEN 'closed' ELSE status END AS status,
  resolution, is_pinned, created_by, closes_at, closed_at, created_at, updated_at,
  status AS raw_status,
  results_hidden,                  -- NEW
  results_hidden_changed_at        -- NEW
FROM public.polls;

ALTER VIEW public.polls_effective SET (security_invoker = on);
```

**RLS policy DROP+CREATE pattern (vote_counts) — DROP the v1.0 policy at `migrations/00000000000001_rls.sql:72` and the v1.0.5 admin-bypass policy at `migrations/00000000000005_admin_phase4.sql:75-88` (both superseded). The shipped policy (migration 10, REVIEW-FIX-H3) has NO `is_current_user_admin()` OR-bypass — admin reads go through service-role-backed Edge Functions (which bypass RLS automatically) per the security review's VIS-04 / REVIEW-FIX-H3 decision. D-14, D-15, D-16:**

```sql
DROP POLICY IF EXISTS "Vote counts visible to voters" ON public.vote_counts;
DROP POLICY IF EXISTS "Vote counts visible to voters or admin" ON public.vote_counts;

CREATE POLICY "Vote counts visible to voters when not hidden"
  ON public.vote_counts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.votes
            WHERE votes.poll_id = vote_counts.poll_id
              AND votes.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.polls
                WHERE polls.id = vote_counts.poll_id
                  AND polls.results_hidden = false)
  );
```

**audit_log table + RLS pattern (verbatim from CONTEXT.md D-02 + RESEARCH § Pattern 1 lines 276-301, comment-style mirrors migration 5):**

Use `gen_random_uuid()` default (pgcrypto already loaded in `migrations/00000000000000_schema.sql:8` — do not redeclare).

**Statement order (locked):**
1. SECTION 1 — `ALTER TABLE polls ADD COLUMN results_hidden …` + `… results_hidden_changed_at …`
2. SECTION 2 — `CREATE TABLE audit_log` + indexes + `ENABLE ROW LEVEL SECURITY` + admin-only SELECT policy
3. SECTION 3 — `CREATE OR REPLACE VIEW polls_effective` + `ALTER VIEW … SET (security_invoker = on)`
4. SECTION 4 — `DROP POLICY` (both old names) + `CREATE POLICY` (new) on `vote_counts`

---

### `supabase/functions/_shared/audit.ts` (shared utility, helper-call)

**Analog:** `supabase/functions/_shared/admin-auth.ts` (full file, 48 lines)

**Imports + type-export pattern (lines 1-3 of admin-auth.ts):**

```typescript
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'

export type AdminCheckResult = { ok: true } | { ok: false; reason: string }
```

Copy the import line verbatim (pinned esm.sh version 2.101.1). Define `AuditEntry` interface alongside in the same shape.

**JSDoc-block convention (admin-auth.ts:5-17):**

Top-of-function comment block lists return shape and rationale. Phase 11 helper applies the same style.

**Function signature pattern (admin-auth.ts:18-21) — mirror this verbatim:**

```typescript
export async function writeAudit(
  supabaseAdmin: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
```

**Body pattern (per RESEARCH Pattern 4, lines 554-569 of RESEARCH.md):**

```typescript
const { error } = await supabaseAdmin.from('audit_log').insert({
  actor_id: entry.actor_id,
  action: entry.action,
  target_type: entry.target_type,
  target_id: entry.target_id,
  before: entry.before,
  after: entry.after,
})
if (error) {
  console.error('audit_log INSERT failed:', { entry, error })
}
```

**Contract (deliberate deviation from admin-auth.ts):** `writeAudit` returns `Promise<void>` (admin-auth returns a discriminated union). The deviation is intentional — the audit failure policy is "log + continue" (Pitfall 3 in RESEARCH), and a `Promise<void>` signature makes that policy non-negotiable for callers. Do NOT propagate the insert error.

**Reference to D-05/D-07:** the planner picks `action` strings (e.g., `poll_closed`, `poll_pinned`, `results_hidden_toggled`) and per-EF `before`/`after` JSONB shapes. The helper accepts both as `string` and `unknown` to leave that freedom.

---

### `supabase/functions/toggle-results-visibility/index.ts` (controller, request-response)

**Primary analog:** `supabase/functions/pin-poll/index.ts` (full file, 83 lines)
**Secondary analog (timestamp write precedent — D-13):** `supabase/functions/close-poll/index.ts:73`

**Header comment pattern (pin-poll lines 1-3):**

```typescript
// supabase/functions/<name>/index.ts
//
// Admin-gated <what it does> on polls.
```

Phase 11: `// Admin-gated toggle of polls.results_hidden. Idempotent — writes audit row only on actual state change (D-11).`

**Import block (pin-poll lines 5-7) — copy verbatim and add the new audit helper:**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin, adminCheckResponse } from '../_shared/admin-auth.ts'
import { writeAudit } from '../_shared/audit.ts'  // NEW
```

**`json` helper (pin-poll lines 9-14) — copy verbatim:**

```typescript
function json(body: unknown, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(cors as Record<string, string>), 'Content-Type': 'application/json' },
  })
}
```

**Full admin-gated skeleton (pin-poll lines 16-39) — copy verbatim:**

```typescript
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
```

**Body validation pattern (pin-poll lines 41-62) — same shape, swap field name to `hidden`:**

```typescript
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
const hidden = typeof body.hidden === 'boolean' ? body.hidden : null
if (!poll_id) return json({ error: 'Missing poll_id' }, 400, corsHeaders)
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(poll_id)) {
  return json({ error: 'Invalid poll_id' }, 400, corsHeaders)
}
if (hidden === null) return json({ error: 'Missing or invalid hidden' }, 400, corsHeaders)
```

**Deltas from pin-poll (these distinguish toggle-results-visibility from its analog):**

1. **Pre-read for idempotency (D-11) — NEW pattern, not in any existing EF:** before UPDATE, `SELECT id, results_hidden FROM polls WHERE id = poll_id`. If PGRST116, return 404. Capture `before.results_hidden`.
2. **UPDATE with timestamp (D-13 — copies `close-poll/index.ts:73` `closed_at: new Date().toISOString()` pattern):**

   ```typescript
   const { data: updated, error } = await supabaseAdmin
     .from('polls')
     .update({ results_hidden: hidden, results_hidden_changed_at: new Date().toISOString() })
     .eq('id', poll_id)
     .select('*')        // VIS-03 + SC-3: return the UPDATED poll row, not just {success:true}
     .single()
   ```

3. **Audit only on state change (D-11):**

   ```typescript
   if (before.results_hidden !== hidden) {
     await writeAudit(supabaseAdmin, {
       actor_id: user.id,
       action: 'results_hidden_toggled',
       target_type: 'poll',
       target_id: poll_id,
       before: { results_hidden: before.results_hidden },
       after: { results_hidden: hidden },
     })
   }
   ```

4. **Response shape:** return `json({ poll: updated }, 200, corsHeaders)` (NOT `{ success: true }`). VIS-03 + ROADMAP SC-3 require the updated poll row.

**Error envelope (pin-poll lines 70-82) — copy verbatim, swap log prefix:**

```typescript
if (error) {
  if (error.code === 'PGRST116') return json({ error: 'Poll not found' }, 404, corsHeaders)
  console.error('toggle-results-visibility update failed:', error)
  return json({ error: 'Internal error' }, 500, corsHeaders)
}
// ...
} catch (err) {
  console.error('toggle-results-visibility error:', err)
  return json({ error: 'Internal error' }, 500, corsHeaders)
}
```

---

### `e2e/integration/helpers.ts` (test utility, helper-call)

**Primary analog (client minting, lazy singleton):** `e2e/helpers/auth.ts` (`getAdminClient()` lines 122-138)
**Secondary analog (freshPoll cleanup discipline):** `e2e/fixtures/poll-fixture.ts` (try/catch/finally + AggregateError pattern, lines 81-117)

**Client-minting pattern (auth.ts lines 122-138) — lift verbatim, then add anon + authed minters:**

```typescript
let _adminClient: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY env var required ...')
  }
  _adminClient = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _adminClient
}
```

**Env var resolution pattern (auth.ts lines 26-46) — copy `SUPABASE_URL` defaulting and lazy-getter approach for anon + service-role keys.**

**Authenticated client minting (auth.ts lines 86-95) — pattern for `signInWithPassword` against fixture users:**

```typescript
const client = createClient(SUPABASE_URL, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { data, error } = await client.auth.signInWithPassword({
  email: user.email,
  password: FIXTURE_PASSWORD,
})
if (error || !data.session) throw error ?? new Error('signInWithPassword returned no session')
```

For D-21 `mintClients()` returning `{ anon, authed, serviceRole }`, the `authed` client is one whose `Authorization` header is pre-set to the session's `access_token` (matches the `pin-poll` EF skeleton's `global: { headers: { Authorization: authHeader } } }` pattern at `pin-poll/index.ts:28`). Reuse `fixtureUsers.memberUser` from `e2e/fixtures/test-users.ts:22-26` as the "authenticated test user."

**freshPoll-equivalent setup/teardown (poll-fixture.ts lines 64-118) — lift the try/catch/finally + AggregateError shape, drop the Playwright `provide(...)` step. Substitute Vitest's `beforeEach`/`afterEach`:**

```typescript
// Setup: admin INSERT with title prefix [TEST-11] (RESEARCH Pitfall 6 — deterministic prefix
// makes pre-suite DELETE cleanup safe).
const title = `[TEST-11] ${suiteSlug} ${Date.now()}`
const { data, error } = await admin.from('polls').insert({
  title, description: '...', status: 'active', is_pinned: true,
  category_id: 'a0000000-0000-0000-0000-000000000001',
  created_by: fixtureUsers.adminUser.id,
  closes_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
}).select('id, title').single()
// Teardown rethrow discipline: `if (cleanupErr) throw …` — D-21, mirrors poll-fixture.ts:101-117.
```

**Normalize-error helper (poll-fixture.ts lines 126-136) — copy verbatim for D-21 cleanup-failure rethrow discipline.**

---

### `e2e/integration/vote-counts-rls.test.ts` (test, RLS-invariant assertion)

**Analog:** `src/__tests__/admin/polls-effective-invariant.test.ts` (full file, 95 lines)

**Imports pattern (lines 1-3):**

```typescript
import { describe, it, expect } from 'vitest'
```

For Phase 11, add: `import { mintClients, freshHiddenPoll, freshVisiblePoll } from './helpers'` and `import { fixtureUsers } from '../fixtures/test-users'`.

**`describe`/`it` block shape (lines 39-66):**

```typescript
describe('polls_effective invariant', () => {
  it('no public code path reads from base polls table via from("polls")', () => {
    // ... assertion body
    if (offenders.length > 0) {
      throw new Error(`... explainer ...\n` + offenders.map((o) => `  - ${o}`).join('\n'))
    }
    expect(offenders).toEqual([])
  })
})
```

**For TEST-11, swap the filesystem scan for `describe.each` over the 12-cell matrix (D-20, D-23):**

```typescript
describe('vote_counts RLS 12-cell matrix (TEST-11)', () => {
  const cases = [
    // [role, hidden, voted, expectRows]
    ['anon', false, false, 0],
    ['anon', false, true,  0],
    ['anon', true,  false, 0],
    ['anon', true,  true,  0],
    ['authed', false, false, 0],
    ['authed', false, true,  /* >0 */ true],   // ONLY allowed cell
    ['authed', true,  false, 0],
    ['authed', true,  true,  0],
    ['serviceRole', false, false, true],  // bypass — all 4 cells return rows
    ['serviceRole', false, true,  true],
    ['serviceRole', true,  false, true],
    ['serviceRole', true,  true,  true],
  ] as const

  describe.each(cases)('%s × hidden=%s × voted=%s', (role, hidden, voted, expected) => {
    it(`returns ${expected ? '>0' : '0'} rows`, async () => { /* ... */ })
  })
})
```

**Failure-message convention (lines 56-63 of polls-effective-invariant) — emulate the explanatory error message:** when a cell fails, the error names which (role × hidden × voted) combination was wrong, so a CI failure is debuggable without re-running locally.

---

### `e2e/integration/toggle-results-visibility.test.ts` (test, request-response assertion)

**Analog (Vitest test structure):** `src/__tests__/admin/polls-effective-invariant.test.ts`
**Analog (EF authz expectations):** the 403 / 200 contract enforced by `requireAdmin` in `_shared/admin-auth.ts:44-48`

**Test cells (CONTEXT.md D-24):**

```typescript
describe('toggle-results-visibility (TEST-12)', () => {
  it('non-admin caller returns 403', async () => { /* invoke as memberUser */ })
  it('admin caller returns 200 with updated poll row + non-null results_hidden_changed_at', async () => { /* invoke as adminUser */ })
  it('audit_log row written on state change', async () => { /* before=false → hidden=true */ })
  it('no audit_log row on no-op (idempotency, D-11)', async () => { /* before=true → hidden=true */ })
})
```

**EF invocation pattern (taken from how the React app already calls EFs — see `pin-poll` consumer hooks; planner reads `src/hooks/usePinPoll*.ts` if needed but the supabase-js shape is canonical):**

```typescript
const { data, error } = await authed.functions.invoke('toggle-results-visibility', {
  body: { poll_id, hidden: true },
})
```

**audit_log row assertion (NEW pattern — no existing test reads `audit_log`, but the supabase-js select shape is the same as poll-fixture.ts:66-78):**

```typescript
const { data: rows } = await serviceRole
  .from('audit_log')
  .select('*')
  .eq('target_id', poll_id)
  .eq('action', 'results_hidden_toggled')
expect(rows).toHaveLength(1)
expect(rows[0].actor_id).toBe(fixtureUsers.adminUser.id)
```

---

### `vitest.config.integration.ts` (config, build/test config)

**Analog:** `vite.config.ts` (lines 41-54 — the embedded `test:` block)

**Existing `test:` block to lift:**

```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  css: true,
  passWithNoTests: true,
  exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  env: {
    VITE_SUPABASE_URL: 'http://localhost:54321',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  },
},
```

**Phase 11 deltas (separate config so unit tests don't pick up integration specs and vice-versa, per D-22):**

- `environment: 'node'` (NOT `jsdom` — DB-level invariant test needs no browser/DOM)
- `include: ['e2e/integration/**/*.test.ts']`
- DROP `exclude: ['e2e/**']` (the whole point is to test inside `e2e/`)
- DROP `setupFiles: './src/test/setup.ts'` (no Testing Library / jest-dom needed)
- DROP the `env:` block — integration tests REQUIRE real `SUPABASE_SERVICE_ROLE_KEY` + `VITE_SUPABASE_URL` from the shell environment; do NOT inject placeholders

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['e2e/integration/**/*.test.ts'],
    passWithNoTests: false,  // integration suite MUST run; empty result is a regression
    testTimeout: 30_000,     // DB round-trips inside Supabase local stack
  },
})
```

---

### Audit retrofit of 12 existing EFs (modification pattern)

**Canonical insertion point — between mutation success and response (RESEARCH § Pattern 5 + Pattern 4):**

Every retrofit follows this shape. Example, applied to `pin-poll/index.ts` (delta around line 70-78):

```typescript
// BEFORE (existing code, pin-poll lines 64-78):
const { error } = await supabaseAdmin
  .from('polls')
  .update({ is_pinned: isPinned })
  .eq('id', poll_id)
  .select('id')
  .single()
if (error) { /* 404 or 500 */ }
return json({ success: true }, 200, corsHeaders)

// AFTER (insert one writeAudit call between error-check and return):
const { error } = await supabaseAdmin
  .from('polls')
  .update({ is_pinned: isPinned })
  .eq('id', poll_id)
  .select('id')
  .single()
if (error) { /* unchanged 404 / 500 path */ }

await writeAudit(supabaseAdmin, {
  actor_id: user.id,
  action: isPinned ? 'poll_pinned' : 'poll_unpinned',
  target_type: 'poll',
  target_id: poll_id,
  before: { is_pinned: !isPinned },
  after: { is_pinned: isPinned },
})

return json({ success: true }, 200, corsHeaders)  // unchanged
```

**Per-EF `action` string + `before`/`after` shape (D-07 — planner picks; suggested convention from CONTEXT.md "Claude's Discretion"):**

| EF | `action` | `target_type` | `actor_id` source | `before`/`after` shape note |
|----|----------|---------------|-------------------|------------------------------|
| `close-expired-polls` | `poll_auto_closed` | `poll` | `null` (D-03 cron) | One row per closed poll (RESEARCH Pattern 5) iterating `data` from `.select('id')` at lines 53-58 |
| `close-poll` | `poll_closed` | `poll` | `user.id` | `before: {status:'active'}`, `after: {status:'closed', resolution}` |
| `create-category` | `category_created` | `category` | `user.id` | `before: null`, `after: {name}` |
| `create-poll` | `poll_created` | `poll` | `user.id` | `before: null`, `after: {title, category_id, results_hidden}` |
| `create-poll` (second row, D-09 ONLY when `results_hidden=true` at creation) | `results_hidden_set_at_creation` | `poll` | `user.id` | `before: null`, `after: {results_hidden: true}` |
| `delete-category` | `category_deleted` | `category` | `user.id` | `before: {name}`, `after: null` |
| `delete-poll` | `poll_deleted` | `poll` | `user.id` | `before: {title, status}`, `after: null` |
| `demote-admin` | `admin_demoted` | `profile` | `user.id` | `before: {is_admin: true}`, `after: {is_admin: false}` |
| `pin-poll` | `poll_pinned` / `poll_unpinned` | `poll` | `user.id` | flip the `is_pinned` boolean |
| `promote-admin` | `admin_promoted` | `profile` | `user.id` | `before: {is_admin: false}`, `after: {is_admin: true}` |
| `rename-category` | `category_renamed` | `category` | `user.id` | `before: {name: old}`, `after: {name: new}` |
| `set-resolution` | `resolution_set` | `poll` | `user.id` | `before: {resolution: prior}`, `after: {resolution: new}` |
| `update-poll` | `poll_updated` | `poll` | `user.id` | `after`: only the fields the RPC mutated (D-07 — compact, grep-able) |
| `toggle-results-visibility` (NEW) | `results_hidden_toggled` | `poll` | `user.id` | `before: {results_hidden: prior}`, `after: {results_hidden: new}` — emit only on state change (D-11) |

---

### `package.json` modification

**Existing scripts block (lines 7-15) — add one line:**

```json
"test": "vitest run",
"test:integration": "vitest run --config vitest.config.integration.ts",  // NEW
"test:watch": "vitest",
```

---

### `.github/workflows/ci.yml` modification

**Pattern source:** the existing `e2e` job (lines 40-132) already runs `supabase start` + derives keys + applies fixture seed. The `test-integration` job copies steps 1-12 of `e2e` (everything through "Apply fixture seed"), then runs `npm run test:integration` (instead of building the app + Playwright).

**Skeleton (planner adapts):**

```yaml
test-integration:
  runs-on: ubuntu-latest
  timeout-minutes: 12
  needs: lint-and-unit
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '22', cache: 'npm' }
    - run: npm ci
    - uses: supabase/setup-cli@v1
      with: { version: 2.92.1 }
    - name: Start Supabase local stack
      run: supabase start
    # ... copy Wait for stack ready + Derive local Supabase keys + Apply fixture seed
    # from the e2e job verbatim (lines 61-132)
    - name: Run integration suite
      env:
        VITE_SUPABASE_URL: http://localhost:54321
        VITE_SUPABASE_ANON_KEY: ${{ steps.supabase-keys.outputs.anon_key }}
        SUPABASE_SERVICE_ROLE_KEY: ${{ steps.supabase-keys.outputs.service_role_key }}
      run: npm run test:integration
```

**Placement decision (D-22, planner picks):** parallel to `e2e` (both depend on `lint-and-unit`) is the cheapest option — `e2e` already takes ~10 min, integration adds ~2 min on top, total wall time unchanged.

---

## Shared Patterns

### Admin gate (apply to: `toggle-results-visibility` and all 12 retrofit targets that aren't `close-expired-polls`)

**Source:** `supabase/functions/_shared/admin-auth.ts:18-48` (full file)

```typescript
const adminCheck = await requireAdmin(supabaseAdmin, user.id)
if (!adminCheck.ok) { const r = adminCheckResponse(adminCheck); return json({ error: r.error }, r.status, corsHeaders) }
```

Reused **verbatim** across all retrofits — no signature change, no contract change. CONTEXT.md "Open Question 2 resolved" — reuse as-is.

### CORS handling (apply to: every EF, new + modified)

**Source:** `supabase/functions/_shared/cors.ts:12-33`

Every EF (including the new `toggle-results-visibility`) calls `getCorsHeaders(req)` once at the top of `Deno.serve` and threads it through `json(body, status, corsHeaders)`. No new EF declares CORS inline.

### EF JSON response helper (apply to: every EF)

**Source:** `pin-poll/index.ts:9-14`

```typescript
function json(body: unknown, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(cors as Record<string, string>), 'Content-Type': 'application/json' },
  })
}
```

`close-poll/index.ts:12-17` and `set-resolution/index.ts:12-17` use the identical shape. The new EF copies it verbatim. (`create-poll/index.ts:7-11` uses a slightly different `new Headers(cors)` form — both work, but planner should prefer the pin-poll/close-poll form for consistency on the new EF.)

### Outer try/catch envelope (apply to: every EF body)

**Source:** `pin-poll/index.ts:21-82` + `close-poll/index.ts:24-92`

Outer try/catch with `console.error('<ef-name> error:', err)` log + 500 response. Inner try/catch around `req.json()` for 400 envelope. The new EF + the 12 retrofits keep their existing envelopes unchanged.

### Audit emission (apply to: the 13 emitter EFs per D-05)

**Source:** `supabase/functions/_shared/audit.ts` (NEW; this PR introduces it)

One `await writeAudit(supabaseAdmin, {...})` call per EF, placed AFTER the mutation success check, BEFORE the response. The helper itself never throws — failures log to `console.error` (Supabase Function Logs surface them). The retrofit must NOT add try/catch around the `writeAudit` call (Pitfall 3).

### Timestamp written by EF (not trigger) — D-13 (refined to race-safe form)

**Source:** `close-poll/index.ts:73` — `closed_at: new Date().toISOString()`

`toggle-results-visibility` writes `results_hidden_changed_at: new Date().toISOString()` as part of the same UPDATE statement that flips `results_hidden`. The shipped form uses a conditional UPDATE (`.neq('results_hidden', hidden)`) so the timestamp is only written when the column value actually changes — no-ops match 0 rows and write no timestamp. This is a deliberate refinement of the initial D-13 "write on every UPDATE" spec: the conditional UPDATE both serialises concurrent same-direction flips (race-safe) and avoids redundant timestamp churn. The audit row is also gated on the state change; both fall out of the same matched-rows count.

### Vitest test setup (apply to: TEST-11 + TEST-12)

**Source:** `src/__tests__/admin/polls-effective-invariant.test.ts:1-3, 39-66`

`describe`/`it` shape, `expect(...).toEqual([])` for failure-list assertions, explanatory `throw new Error(...)` messages naming the offenders. TEST-11's 12-cell matrix uses `describe.each` (D-20, D-23).

### Test poll cleanup discipline (apply to: TEST-11 + TEST-12)

**Source:** `e2e/fixtures/poll-fixture.ts:81-117` (try/catch/finally + AggregateError rethrow)

Every integration test creates a poll prefixed `[TEST-11]` or `[TEST-12]` in setup, deletes via `admin.from('polls').delete().eq('id', id)` in teardown, rethrows on cleanup failure (D-21). Cascade in `migrations/00000000000000_schema.sql` handles choices/votes/vote_counts cleanup automatically.

### Fixture users for authenticated tests

**Source:** `e2e/fixtures/test-users.ts:21-42`

- `fixtureUsers.memberUser` — authenticated, non-admin (used for the "authed × …" cells of the 12-cell matrix + the 403 case in TEST-12)
- `fixtureUsers.adminUser` — admin (used for the 200 case in TEST-12 + service-role-bypass comparison)
- Anonymous client = no `signInWithPassword` call; just `createClient(url, anonKey)`.

---

## No Analog Found

Files with no close existing match (planner should follow RESEARCH.md skeletons rather than copying an existing analog):

| File / pattern | Reason | Fallback source |
|----------------|--------|------------------|
| `audit_log` table DDL + RLS | First audit table in the codebase | RESEARCH.md § Pattern 1, lines 276-301 (full DDL) + CONTEXT.md D-02 |
| `describe.each` 12-cell RLS matrix | Existing invariant test uses filesystem scan, not `describe.each` | RESEARCH.md § Pattern 2 (test skeleton) + Vitest docs (`describe.each` API — well-known) |
| Reading `audit_log` from a test (TEST-12) | No existing test touches `audit_log` | Use the standard supabase-js `.select(...).eq(...)` shape — same as `e2e/fixtures/poll-fixture.ts:66-78` reading `polls` |
| Integration vitest config separate from app vitest config | Repo currently has one embedded `test:` block in `vite.config.ts`; no separate vitest config file | Extract the `test:` block to a new `vitest.config.integration.ts` with deltas per D-22 |
| GitHub Actions integration-test job placement | Existing CI has only `lint-and-unit` and `e2e` jobs | Copy the first half of the `e2e` job (steps 1-12 — checkout through fixture seed apply) and swap final step to `npm run test:integration` |

---

## Metadata

**Analog search scope:**
- `supabase/functions/*` (all 16 EFs, _shared/, surveyed in this session)
- `supabase/migrations/*` (10 existing migrations, with detail reads on 5 + 9 + 1)
- `src/__tests__/admin/*` (admin invariant + RLS preflight specs)
- `e2e/helpers/*`, `e2e/fixtures/*`, `e2e/tests/*` (Playwright helpers + fixture-user roster + cleanup discipline)
- `.github/workflows/ci.yml` (existing CI job topology)
- `vite.config.ts` (embedded `test:` block — only vitest config in the repo)
- `package.json` (existing scripts)

**Files scanned in detail:**
- `supabase/functions/_shared/admin-auth.ts` (full, 48 lines)
- `supabase/functions/_shared/cors.ts` (full, 33 lines)
- `supabase/functions/pin-poll/index.ts` (full, 83 lines — primary analog for `toggle-results-visibility`)
- `supabase/functions/close-poll/index.ts` (full, 93 lines — `closed_at` D-13 precedent)
- `supabase/functions/create-poll/index.ts` (full, 140 lines — `results_hidden` extension target + validation precedent)
- `supabase/functions/close-expired-polls/index.ts` (full, 76 lines — cron retrofit pattern, D-03 actor_id=null)
- `supabase/functions/set-resolution/index.ts` (full, 87 lines — confirms admin-EF skeleton consistency)
- `src/__tests__/admin/polls-effective-invariant.test.ts` (full, 94 lines — Vitest invariant test pattern)
- `e2e/helpers/auth.ts` (full, 138 lines — client minting + lazy singleton pattern)
- `e2e/fixtures/poll-fixture.ts` (full, 138 lines — try/catch/finally cleanup + AggregateError)
- `e2e/fixtures/test-users.ts` (full, 49 lines — fixture user roster)
- `supabase/migrations/00000000000005_admin_phase4.sql:1-45` (view + ALTER VIEW SET security_invoker precedent)
- `supabase/migrations/00000000000009_admin_integrity_rls.sql` (full — `is_current_user_admin()` for `audit_log` RLS)
- `supabase/migrations/00000000000001_rls.sql:70-90` (vote_counts policy being replaced)
- `vite.config.ts` (full — `test:` block to fork)
- `package.json:7-15` (scripts to extend)
- `.github/workflows/ci.yml` (full, 186 lines — CI job topology for integration job placement)

**Pattern extraction date:** 2026-05-11
