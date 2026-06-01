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

> **Authoritative source:** `18-03-PLAN.md` Task 1. The excerpts below were updated after cross-AI plan convergence to the **title-scoped, fail-closed** design (REVIEWS HIGH-2/HIGH-3). The earlier global-wildcard sentinel (`poll_id = '00000000-…'`) is **superseded** — do not reintroduce it. If this file and the PLAN ever disagree, the PLAN wins.

**Analog:** Same file — the existing `app.e2e_seed_allowed` guard block and the existing `INSERT INTO public.polls` DDL.

**Existing guard block pattern** (lines 22–28) — all new DDL runs after this existing guard:
```sql
DO $$
BEGIN
  IF current_setting('app.e2e_seed_allowed', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION
      'Refusing to apply e2e/fixtures/seed.sql without app.e2e_seed_allowed=true (LOCAL E2E ONLY)';
  END IF;
END $$;
```

**Fail-closed hardening (REVIEWS HIGH-3):** the guard above only ABORTS the file when psql stops on error. Add `\set ON_ERROR_STOP on` as the first line of `seed.sql` (before the guard), and pass `-v ON_ERROR_STOP=1` on both CI `psql -f e2e/fixtures/seed.sql` steps — otherwise `psql -f` prints the `RAISE EXCEPTION` and CONTINUES past it, defeating fail-closed.

**Existing DDL style** — uses `IF NOT EXISTS` / `ON CONFLICT` for idempotency (lines 44–168). Fault injection DDL follows the same pattern, using `CREATE TABLE IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION` / `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`.

**Existing RLS-disable pattern** — no existing example in seed.sql (all tables use RLS by default). The `test_fault_config` table disables RLS explicitly so the service-role supabase-js client can INSERT/DELETE without a policy:
```sql
ALTER TABLE public.test_fault_config DISABLE ROW LEVEL SECURITY;
```

**New section to append** (place at the very end of the file, after the last `ON CONFLICT` block at line 168). Fault rows key on the poll's unique **title token** (`fault_title`), NOT a global poll-UUID wildcard — so a concurrent file arming a different title is unaffected, and `DROP TABLE IF EXISTS` makes the re-seed convergent against a stale wildcard-shaped table:
```sql
-- ============================================================
-- Fault Injection: test_fault_config + BEFORE UPDATE/DELETE triggers on polls
-- LOCAL E2E ONLY — never present in production (guarded by app.e2e_seed_allowed
-- check at top of this file; that guard is fail-closed via \set ON_ERROR_STOP on).
-- Title-scoped: a test arms a row keyed by the unique poll title it is about to
-- create, so the trigger fires ONLY for that poll and concurrent files with other
-- titles are unaffected. Test cases MUST disarm (try/finally) before any afterEach
-- cleanup that touches the polls table.
-- ============================================================
-- DROP first: a prior run may have created the table with the OLD wildcard shape
-- (poll_id, fail_operation); dropping guarantees the current (fault_title, ...)
-- shape on every apply (convergent re-seed, not just idempotent).
DROP TABLE IF EXISTS public.test_fault_config;
CREATE TABLE public.test_fault_config (
  fault_title    text  NOT NULL,
  fail_operation text  NOT NULL CHECK (fail_operation IN ('update', 'delete')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fault_title, fail_operation)
);
TRUNCATE public.test_fault_config;  -- clear stale sentinels (belt-and-suspenders)
ALTER TABLE public.test_fault_config DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fault_inject_polls_before_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  -- Fires only when a row matches this poll's title. Empty table = no-op for all
  -- roles. SECURITY INVOKER: runs with caller's privileges — no escalation.
  IF EXISTS (
    SELECT 1 FROM public.test_fault_config
    WHERE fail_operation = 'update' AND fault_title = NEW.title
  ) THEN
    RAISE EXCEPTION '[FAULT-INJECT] deliberate UPDATE failure on poll %', NEW.id;
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
    WHERE fail_operation = 'delete' AND fault_title = OLD.title
  ) THEN
    RAISE EXCEPTION '[FAULT-INJECT] deliberate DELETE failure on poll %', OLD.id;
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

> **Authoritative source:** `18-03-PLAN.md` Task 3. The excerpts below were updated after cross-AI plan convergence to the **title-scoped + `try/finally` + audit-only-resolution** design (REVIEWS HIGH-2/HIGH-3/H-NEW-1). The earlier wildcard sentinel (`SENTINEL_ID = '00000000-…'`) and "newest `poll_created`" lookup are **superseded** — do not reintroduce them. If this file and the PLAN ever disagree, the PLAN wins.

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

**describe / state pattern** (lines 25–39) — the shared `afterEach` is HARDENED (REVIEWS HIGH-3): its FIRST statement unconditionally clears `test_fault_config`, so a thrown assertion can never leave a fault row armed for the next test. Only then does it run the existing audit + poll cleanup:
```typescript
describe('create-poll results_hidden path', () => {
  let adminClients: IntegrationClients
  let createdPollId: string | null = null

  beforeAll(async () => {
    adminClients = await mintClients({ authAs: 'adminUser' })
  })

  afterEach(async () => {
    // Clear any armed fault row FIRST and unconditionally — a test that threw
    // before its finally ran must not poison the next test. (.neq('') satisfies
    // supabase-js's "delete needs a filter" rule = delete all rows.)
    await adminClients.serviceRole.from('test_fault_config').delete().neq('fault_title', '')
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
    // Unique title token THIS test arms against — trigger matches NEW.title/OLD.title,
    // so concurrent files with other titles are unaffected (no global wildcard).
    const faultTitle = `[TEST-M5-FAULT-A] ${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const startedAt = new Date().toISOString()

    try {
      await adminClients.serviceRole
        .from('test_fault_config')
        .insert({ fault_title: faultTitle, fail_operation: 'update' })

      const result = await invokeEF({
        client: adminClients.authed,
        name: 'create-poll',
        body: buildBody({ title: faultTitle, results_hidden: true }),
      })
      expect(result.status).toBe(500)
    } finally {
      // Disarm even if the assertion above threw — a stuck fault row would block
      // afterEach's cleanup DELETE and poison the rest of the suite (REVIEWS HIGH-3).
      await adminClients.serviceRole
        .from('test_fault_config')
        .delete()
        .eq('fault_title', faultTitle)
    }

    // Resolve the poll id AUDIT-ONLY (REVIEWS H-NEW-1): the poll is ABSENT here after
    // the compensating DELETE, so a polls lookup would return null → false-green.
    // The poll_created audit row (written BEFORE the UPDATE attempt) carries both the
    // title (after->>'title') and the id (target_id = pollId). Filter by title + actor
    // + time window — never "newest poll_created" (REVIEWS HIGH-2).
    const { data: createdRow } = await adminClients.serviceRole
      .from('audit_log')
      .select('target_id')
      .eq('action', 'poll_created')
      .eq('after->>title', faultTitle)
      .gte('created_at', startedAt)
      .single()
    const actualPollId = createdRow!.target_id as string
    createdPollId = actualPollId

    const rows = await readAuditLog({
      serviceRole: adminClients.serviceRole,
      targetId: actualPollId,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('poll_created')
    expect(rows.find((r) => r.action === 'poll_created_orphaned')).toBeUndefined()

    // Compensating DELETE succeeded — poll must NOT exist. (polls is consulted ONLY
    // for this absence assertion, never to resolve the id.)
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
    const faultTitle = `[TEST-M5-FAULT-B] ${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const startedAt = new Date().toISOString()

    try {
      // Arm BOTH operations for THIS title — UPDATE blocked first, then the
      // compensating DELETE also blocked.
      await adminClients.serviceRole
        .from('test_fault_config')
        .insert([
          { fault_title: faultTitle, fail_operation: 'update' },
          { fault_title: faultTitle, fail_operation: 'delete' },
        ])

      const result = await invokeEF({
        client: adminClients.authed,
        name: 'create-poll',
        body: buildBody({ title: faultTitle, results_hidden: true }),
      })
      expect(result.status).toBe(500)
    } finally {
      // Disarm both even if the assertion threw (REVIEWS HIGH-3). The delete
      // sentinel MUST be gone before afterEach's cleanupPoll DELETEs the orphan.
      await adminClients.serviceRole
        .from('test_fault_config')
        .delete()
        .eq('fault_title', faultTitle)
    }

    // Audit-only id resolution — same path as branch (a) for symmetry (REVIEWS
    // H-NEW-1), scoped by title + time window (not "newest").
    const { data: createdRow } = await adminClients.serviceRole
      .from('audit_log')
      .select('target_id')
      .eq('action', 'poll_created')
      .eq('after->>title', faultTitle)
      .gte('created_at', startedAt)
      .single()
    const actualPollId = createdRow!.target_id as string
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
    // afterEach unconditionally clears test_fault_config, then deletes audit_log
    // rows and calls cleanupPoll to remove the orphaned poll.
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
The new DDL section runs after this guard, AND the guard is made fail-closed: `\set ON_ERROR_STOP on` is the first line of `seed.sql` and both CI `psql -f` steps pass `-v ON_ERROR_STOP=1`, so the `RAISE EXCEPTION` aborts the whole file instead of psql continuing past it (REVIEWS HIGH-3).

### afterEach cleanup sequence
**Source:** `e2e/integration/create-poll-results-hidden.test.ts` lines 33–40
**Apply to:** Both new fault-injection test cases
Two layers of safety (REVIEWS HIGH-3):
1. **In-test `try/finally`:** each fault test disarms its own `fault_title` rows in a `finally` block, so a thrown assertion mid-test still releases the fault before anything else runs.
2. **Hardened shared `afterEach`:** its FIRST statement unconditionally deletes ALL `test_fault_config` rows, BEFORE the `if (createdPollId)` audit-delete + `cleanupPoll` block. This is the backstop if a test threw before its `finally` was reached.

Resulting order on every test: (1) `finally` disarms this test's fault rows → (2) afterEach unconditionally clears `test_fault_config` → (3) afterEach deletes `audit_log` rows → (4) afterEach `cleanupPoll`. The orphaned-poll DELETE in step 4 can never be blocked by a stale `delete` fault row.

### single-thread integration runner
**Source:** `vitest.config.integration.ts` (`test` block)
**Apply to:** TEST-19 (defense-in-depth alongside title-scoping)
Add `fileParallelism: false` (or `pool: 'forks'` + `poolOptions.forks.singleFork: true`) so integration files sharing the one real Postgres DB run one at a time. Title-scoping already prevents cross-file collisions; serialization removes the race window entirely (REVIEWS HIGH-2).

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
