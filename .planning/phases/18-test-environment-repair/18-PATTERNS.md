# Phase 18: Test-Environment Repair - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 4
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/config.toml` | config | request-response | `supabase/config.toml` existing `[auth.*]` + `[functions.*]` blocks | exact (same file, additive section) |
| `.github/workflows/ci.yml` | config | batch | `.github/workflows/ci.yml` existing `supabase/setup-cli@v2` steps | exact (same file, version string replacement) |
| `e2e/fixtures/seed.sql` | utility | CRUD | `e2e/fixtures/seed.sql` existing guard block + table DDL | exact (same file, new guarded section at end) |
| `e2e/integration/create-poll-results-hidden.test.ts` | test | request-response | `e2e/integration/create-poll-results-hidden.test.ts` existing 4 test cases | exact (same file, append 2 new `it(...)` blocks) |

---

## Pattern Assignments

### `supabase/config.toml` (config, additive section for TEST-18)

**Analog:** Same file — existing `[auth]` and `[auth.external.discord]` sections at lines 14–22.

**Existing [auth] block pattern** (lines 14–22):
```toml
[auth]
enabled = true
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:5173/auth/callback"]

[auth.external.discord]
enabled = true
client_id = "env(SUPABASE_AUTH_DISCORD_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_DISCORD_SECRET)"
```

**Existing [functions.*] block pattern with WHY comment** (lines 24–32):
```toml
# Every EF performs its own JWT validation (requireAdmin in admin-auth.ts,
# getUser for non-admin callers; cron-secret for close-expired-polls). The
# platform-layer JWT check is redundant — and worse, the local edge runtime
# falls back to HS256 verification on user tokens that the auth service
# issued as ES256, returning 401 before the EF can run its own check. The
# production deploys all pass --no-verify-jwt; these entries align the local
# stack so `npm run test:integration` exercises the same auth path as prod.
[functions.toggle-results-visibility]
verify_jwt = false
```

**New section to add** (insert between `[auth.external.discord]` block and the `[functions.*]` comment, i.e. after line 22):
```toml
[auth.email]
# enable_signup = true → GOTRUE_EXTERNAL_EMAIL_ENABLED=true in gotrue container.
# Required so signInWithPassword works for fixture users in the integration suite.
# Default (absent section) = false = email_provider_disabled error on every
# authed mintClients() call. Local-only: production uses Discord OAuth exclusively.
enable_signup = true
# enable_confirmations = false → GOTRUE_MAILER_AUTOCONFIRM=true.
# Fixture users are pre-confirmed in seed.sql (email_confirmed_at = now()).
enable_confirmations = false
```

**Key rule:** The `[functions.*] verify_jwt = false` block at lines 24–69 MUST NOT be touched — it is the TEST-17 workaround alignment and removing it reintroduces the ES256 401 failure.

---

### `.github/workflows/ci.yml` (config, version string replacement for TEST-17)

**Analog:** Same file — two existing `supabase/setup-cli@v2` steps.

**test-integration job — CLI setup step** (lines 60–62):
```yaml
      - uses: supabase/setup-cli@v2
        with:
          version: 2.92.1
```

**e2e job — CLI setup step** (lines 128–130):
```yaml
      # D-16 §1 — Supabase CLI pinned to exact version (matches Plan 05-07
      # deploy-edge-functions.yml and cron-sweep.yml).
      - uses: supabase/setup-cli@v2
        with:
          version: 2.92.1
```

**Pattern:** Both occurrences of `version: 2.92.1` must be updated to the same new pinned version — exact pin, never a range. The surrounding step structure, the `env: PGOPTIONS: -c app.e2e_seed_allowed=true` guard on the fixture seed apply step, and all other steps stay unchanged.

**Anchor comment for test-integration job** (line 59):
```yaml
      # Same pinned Supabase CLI version as the e2e job (avoids local-stack drift).
```
This comment documents the coupling — both jobs must be updated together.

---

### `e2e/fixtures/seed.sql` (utility, new guarded DDL section for TEST-19)

**Analog:** Same file — the existing `app.e2e_seed_allowed` guard block and the existing `INSERT INTO public.polls` DDL.

**Existing guard block pattern** (lines 22–28) — all new DDL must run inside this existing guard or add a second identical check:
```sql
DO $$
BEGIN
  IF current_setting('app.e2e_seed_allowed', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION
      'Refusing to apply e2e/fixtures/seed.sql without app.e2e_seed_allowed=true (LOCAL E2E ONLY)';
  END IF;
END $$;
```

**Existing DDL style** — uses `IF NOT EXISTS` / `ON CONFLICT` for idempotency (lines 44–168). Fault injection DDL follows the same pattern, using `CREATE TABLE IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION` / `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`.

**Existing RLS-disable pattern** — no existing example in seed.sql (all tables use RLS by default). The `test_fault_config` table disables RLS explicitly so the service-role supabase-js client can INSERT/DELETE without a policy:
```sql
ALTER TABLE public.test_fault_config DISABLE ROW LEVEL SECURITY;
```

**New section to append** (place at the very end of the file, after the last `ON CONFLICT` block at line 168):
```sql
-- ============================================================
-- Fault Injection: test_fault_config + BEFORE UPDATE/DELETE triggers on polls
-- LOCAL E2E ONLY — never present in production (guarded by app.e2e_seed_allowed
-- check at top of this file).
-- Wildcard sentinel: row with poll_id = '00000000-0000-0000-0000-000000000000'
-- blocks ALL polls UPDATEs/DELETEs while armed. Test cases MUST disarm before
-- any afterEach cleanup that touches the polls table.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.test_fault_config (
  poll_id        uuid  NOT NULL,
  fail_operation text  NOT NULL CHECK (fail_operation IN ('update', 'delete')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, fail_operation)
);
ALTER TABLE public.test_fault_config DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fault_inject_polls_before_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  -- Fires when poll_id = NEW.id OR wildcard sentinel '00000000-...' is armed.
  -- SECURITY INVOKER: runs with caller's privileges — no privilege escalation.
  IF EXISTS (
    SELECT 1 FROM public.test_fault_config
    WHERE fail_operation = 'update'
      AND (poll_id = NEW.id OR poll_id = '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'fault_inject: deliberate UPDATE failure on poll %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS fault_inject_polls_update ON public.polls;
CREATE TRIGGER fault_inject_polls_update
  BEFORE UPDATE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.fault_inject_polls_before_update();

CREATE OR REPLACE FUNCTION public.fault_inject_polls_before_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.test_fault_config
    WHERE fail_operation = 'delete'
      AND (poll_id = OLD.id OR poll_id = '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'fault_inject: deliberate DELETE failure on poll %', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS fault_inject_polls_delete ON public.polls;
CREATE TRIGGER fault_inject_polls_delete
  BEFORE DELETE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.fault_inject_polls_before_delete();
```

---

### `e2e/integration/create-poll-results-hidden.test.ts` (test, append 2 new `it()` blocks for TEST-19)

**Analog:** Same file — existing 4 test cases at lines 56–163.

**Imports pattern** (lines 16–23) — reuse exactly, no new imports needed:
```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import {
  mintClients,
  invokeEF,
  readAuditLog,
  cleanupPoll,
  type IntegrationClients,
} from './helpers'
```

**describe / state pattern** (lines 25–39) — shared `adminClients` + `createdPollId` + `beforeAll` + `afterEach` already handle audit_log cleanup then poll cleanup. The 2 new test cases set `createdPollId` the same way as existing tests:
```typescript
describe('create-poll results_hidden path', () => {
  let adminClients: IntegrationClients
  let createdPollId: string | null = null

  beforeAll(async () => {
    adminClients = await mintClients({ authAs: 'adminUser' })
  })

  afterEach(async () => {
    if (createdPollId) {
      // audit_log has no FK to polls.id; DELETE explicitly before cleanupPoll.
      await adminClients.serviceRole.from('audit_log').delete().eq('target_id', createdPollId)
      await cleanupPoll({ serviceRole: adminClients.serviceRole, pollId: createdPollId })
      createdPollId = null
    }
  })
```

**buildBody helper pattern** (lines 47–54) — reuse unchanged:
```typescript
const buildBody = (extra: Record<string, unknown>) => ({
  title: `[TEST-M5] ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  description: 'integration test',
  category_id: 'a0000000-0000-0000-0000-000000000001',
  choices: ['option-a', 'option-b'],
  closes_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  ...extra,
})
```

**invokeEF + readAuditLog core pattern** (lines 57–93) — the happy-path test that the new fault-injection tests mirror:
```typescript
const result = await invokeEF({
  client: adminClients.authed,
  name: 'create-poll',
  body: buildBody({ results_hidden: true }),
})
expect(result.status).toBe(200)
// ...
const rows = await readAuditLog({
  serviceRole: adminClients.serviceRole,
  targetId: newPollId,
})
expect(rows).toHaveLength(2)
```

**serviceRole DML pattern** (lines 70–77) — the service-role SELECT used in existing tests; the new tests use the same client for INSERT/DELETE on `test_fault_config`:
```typescript
const { data: pollRow, error: selErr } = await adminClients.serviceRole
  .from('polls')
  .select('results_hidden, results_hidden_changed_at')
  .eq('id', newPollId)
  .single()
```

**Deferral comment to remove** (lines 156–163) — the two new `it()` blocks replace this entire comment block:
```typescript
  // Manual fault-injection deferred: if the post-RPC UPDATE fails when
  // results_hidden=true, the EF still emits the poll_created audit row
  // (written BEFORE the UPDATE attempt — see create-poll/index.ts:158).
  // If the compensating DELETE also fails, a poll_created_orphaned row
  // is emitted alongside. Asserting either branch requires injecting an
  // UPDATE failure (network drop, RLS reject, etc.) which is out of
  // scope for this suite.
```

**New test cases to add in place of the deferral comment:**

Branch (a) — UPDATE fails, compensating DELETE succeeds:
```typescript
  it('results_hidden=true: UPDATE failure rolls back poll; only poll_created audit row emitted', async () => {
    const SENTINEL_ID = '00000000-0000-0000-0000-000000000000'

    // Arm UPDATE sentinel before invoking EF (poll_id unknown until EF runs).
    // The wildcard sentinel blocks ALL polls UPDATEs while armed.
    // Integration suite runs single-worker/sequential — no cross-test interference.
    await adminClients.serviceRole
      .from('test_fault_config')
      .insert({ poll_id: SENTINEL_ID, fail_operation: 'update' })

    const result = await invokeEF({
      client: adminClients.authed,
      name: 'create-poll',
      body: buildBody({ results_hidden: true }),
    })
    expect(result.status).toBe(500)

    // Disarm sentinel before any cleanup — afterEach calls cleanupPoll which
    // DELETEs from polls; the sentinel must not block that cleanup DELETE.
    await adminClients.serviceRole
      .from('test_fault_config')
      .delete()
      .match({ poll_id: SENTINEL_ID, fail_operation: 'update' })

    // poll_created audit row was written BEFORE the UPDATE attempt (create-poll/index.ts:158).
    // Retrieve the actual poll_id from the audit log (the EF wrote it there).
    const { data: recentAudit } = await adminClients.serviceRole
      .from('audit_log')
      .select('*')
      .eq('action', 'poll_created')
      .order('created_at', { ascending: false })
      .limit(1)
    expect(recentAudit).toHaveLength(1)
    const actualPollId = recentAudit![0].target_id as string
    createdPollId = actualPollId

    const rows = await readAuditLog({
      serviceRole: adminClients.serviceRole,
      targetId: actualPollId,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('poll_created')
    expect(rows.find((r) => r.action === 'poll_created_orphaned')).toBeUndefined()

    // Compensating DELETE succeeded — poll must NOT exist in polls table.
    const { data: pollRow } = await adminClients.serviceRole
      .from('polls')
      .select('id')
      .eq('id', actualPollId)
      .maybeSingle()
    expect(pollRow).toBeNull()
  })
```

Branch (b) — UPDATE fails AND compensating DELETE fails:
```typescript
  it('results_hidden=true: UPDATE+DELETE failure emits poll_created + poll_created_orphaned', async () => {
    const SENTINEL_ID = '00000000-0000-0000-0000-000000000000'

    // Arm BOTH sentinels — UPDATE blocked first, then compensating DELETE also blocked.
    await adminClients.serviceRole
      .from('test_fault_config')
      .insert([
        { poll_id: SENTINEL_ID, fail_operation: 'update' },
        { poll_id: SENTINEL_ID, fail_operation: 'delete' },
      ])

    const result = await invokeEF({
      client: adminClients.authed,
      name: 'create-poll',
      body: buildBody({ results_hidden: true }),
    })
    expect(result.status).toBe(500)

    // Disarm BOTH sentinels before cleanup — afterEach cleanupPoll needs to
    // DELETE the orphaned poll from polls table; the delete sentinel must be
    // gone first.
    await adminClients.serviceRole
      .from('test_fault_config')
      .delete()
      .match({ poll_id: SENTINEL_ID })

    // Retrieve actual poll_id from audit log.
    const { data: recentAudit } = await adminClients.serviceRole
      .from('audit_log')
      .select('*')
      .in('action', ['poll_created', 'poll_created_orphaned'])
      .order('created_at', { ascending: false })
      .limit(2)
    const actualPollId = recentAudit![0].target_id as string
    createdPollId = actualPollId

    const rows = await readAuditLog({
      serviceRole: adminClients.serviceRole,
      targetId: actualPollId,
    })
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.action === 'poll_created')).toBeDefined()
    const orphaned = rows.find((r) => r.action === 'poll_created_orphaned')
    expect(orphaned).toBeDefined()
    expect(orphaned!.after).toMatchObject({
      results_hidden_intended: true,
      results_hidden_actual: false,
      reason: 'compensation_delete_failed',
    })

    // Poll DOES exist (DELETE failed — orphaned with results_hidden=false).
    const { data: pollRow } = await adminClients.serviceRole
      .from('polls')
      .select('results_hidden')
      .eq('id', actualPollId)
      .single()
    expect(pollRow!.results_hidden).toBe(false)
    // afterEach will delete audit_log rows then call cleanupPoll to remove
    // the orphaned poll (sentinels already disarmed above).
  })
```

---

## Shared Patterns

### app.e2e_seed_allowed guard
**Source:** `e2e/fixtures/seed.sql` lines 22–28
**Apply to:** `e2e/fixtures/seed.sql` new fault-injection DDL section
```sql
DO $$
BEGIN
  IF current_setting('app.e2e_seed_allowed', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION
      'Refusing to apply e2e/fixtures/seed.sql without app.e2e_seed_allowed=true (LOCAL E2E ONLY)';
  END IF;
END $$;
```
The new DDL section runs after this guard fires — it does not need a second guard because the script aborts at the `DO $$ ... $$` block if the setting is absent.

### afterEach cleanup sequence
**Source:** `e2e/integration/create-poll-results-hidden.test.ts` lines 33–40
**Apply to:** Both new fault-injection test cases
Cleanup order must be: (1) disarm test_fault_config sentinels, (2) let afterEach delete audit_log rows, (3) let afterEach call cleanupPoll. The afterEach already handles steps 2 and 3; step 1 must happen inside the test body before setting `createdPollId`, or in a dedicated `afterEach` that runs before the shared one. Since the shared afterEach is the last registered handler, disarming inside the test body is the safest order.

### Exact CLI version pin pattern
**Source:** `.github/workflows/ci.yml` lines 60–62 and 128–130
**Apply to:** Both `supabase/setup-cli@v2` steps in ci.yml (test-integration + e2e jobs)
```yaml
- uses: supabase/setup-cli@v2
  with:
    version: X.Y.Z   # exact pin — no ranges, no 'latest'
```
Both occurrences must be updated to the same version atomically. The anchor comment at line 59 ("Same pinned Supabase CLI version as the e2e job") documents this coupling.

### WHY-only config comments
**Source:** `supabase/config.toml` lines 24–30
**Apply to:** New `[auth.email]` section comment
Comments explain the env-var mapping and the local-vs-prod alignment rationale — not what the key does mechanically. Follow the same style as the existing JWT-verification comment block.

---

## No Analog Found

None — all four files have exact analogs (themselves, with existing patterns to extend).

---

## Metadata

**Analog search scope:** `supabase/config.toml`, `.github/workflows/ci.yml`, `e2e/fixtures/seed.sql`, `e2e/integration/create-poll-results-hidden.test.ts`
**Files scanned:** 4 (all source files read directly; all are the analogs for their own modifications)
**Pattern extraction date:** 2026-05-31
