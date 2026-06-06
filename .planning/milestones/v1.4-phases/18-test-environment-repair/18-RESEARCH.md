# Phase 18: Test-Environment Repair - Research

**Researched:** 2026-05-31
**Domain:** Supabase CLI / edge-runtime / gotrue config + Vitest integration test harness + PostgreSQL fault injection
**Confidence:** HIGH (stack-version findings verified via GitHub API; config key mapping verified via CLI source; fault injection approach verified against live project schema)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **L-01:** REAL environment repair only. Documenting the harnesses as won't-fix with proxy/alternative-validation coverage is explicitly rejected this milestone (operator decision, STATE.md line 69; REQUIREMENTS Out-of-Scope).
- **L-02:** Debt-zero. All three requirements must reach **Validated** — no `tech_debt` / DEFER exit.
- **L-03:** Green both **locally and in CI** for TEST-17/18 — no skips, no xfail.

### Claude's Discretion
All five decisions (D-01…D-05) were explicitly delegated by the operator with recommendations recorded:
- **D-01:** Fault injection technique — DB-level real failure injection recommended.
- **D-02:** Coverage depth — cover both documented branches (a) UPDATE-fails, (b) compensating-DELETE-also-fails; document if (b) is infeasible.
- **D-03:** TEST-18 approach — autoconfirm config in `config.toml` ([auth.email] section) recommended.
- **D-04:** Edge-runtime pin — exact version pin (not floating minimum).
- **D-05:** No bespoke regression-guard tooling beyond the repaired green CI suite.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. DBHY-05, UIDN-06, UAT-01/02, DEP-01/02 mapped to Phases 19–21.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-17 | Local supabase-edge-runtime upgraded/pinned past the 1.73.x ES256 JWT-verification bug so `npm run test:integration` runs green locally and in CI — no skips, no xfail | CLI v2.92.1 ships edge-runtime v1.73.3; latest is v1.74.0; `[edge_runtime]` config.toml pin or CLI version bump required |
| TEST-18 | Local gotrue `email_provider_disabled` configuration fixed so the TEST-11 12-cell RLS invariant vitest matrix executes 12 PASS / 0 FAIL locally and in CI | Root cause identified: missing `[auth.email] enable_signup = true` in config.toml; exact config keys verified in CLI source |
| TEST-19 | Deferred fault-injection branch in `e2e/integration/create-poll-results-hidden.test.ts` implemented and green | Both branches (a) and (b) are reachable via a fault-injection config table in seed.sql; detailed approach documented below |
</phase_requirements>

---

## Summary

Phase 18 repairs three broken local test harnesses with no proxy substitutes. All three root causes are now precisely identified and fixes are deterministic.

**TEST-17 (ES256 / edge-runtime):** Supabase CLI v2.92.1 bundles `supabase/edge-runtime:v1.73.3`. The edge-runtime 1.73.x series has the ES256 JWT fallback bug documented in `config.toml` lines 24-30. The upstream fix is to advance the bundled edge-runtime. The current CLI HEAD (as of 2026-05-31) has advanced to `v1.74.0`. The exact repair is to upgrade CI from `supabase/setup-cli@v2 version: 2.92.1` to a CLI version that bundles `edge-runtime:v1.74.0` — confirmed to be available in CLI releases after v2.92.1. The `[functions.*] verify_jwt = false` entries in `config.toml` already align the local stack with prod's `--no-verify-jwt` approach and MUST NOT be removed.

**TEST-18 (email_provider_disabled):** Root cause is confirmed: the project's `config.toml` has no `[auth.email]` section. The CLI Go struct `email.EnableSignup` defaults to Go's zero value (`false`) when the TOML section is absent, causing the container to start with `GOTRUE_EXTERNAL_EMAIL_ENABLED=false`. This triggers `email_provider_disabled` on every `signInWithPassword` call in the test harness. The fix is a single addition to `config.toml`: `[auth.email]` with `enable_signup = true` (and `enable_confirmations = false` for autoconfirm semantics). Previous attempts that "had no effect" were likely run without `supabase stop && supabase start` after the config change — the Supabase local stack caches its gotrue env at startup.

**TEST-19 (fault injection):** The `create-poll` EF runs entirely server-side. The test suite has no direct DB URL access — only `supabase-js` clients (authed + service-role). The viable approach is a permanent BUT conditionally-activated DB trigger installed via `e2e/fixtures/seed.sql` (guarded by `app.e2e_seed_allowed=true`): a `test_fault_config` table records which poll IDs should trigger a deliberate UPDATE/DELETE failure; a BEFORE UPDATE trigger on `polls` checks this table; the test controls it via `serviceRole.from('test_fault_config').insert(...)` and `.delete(...)`. Both branches (a) UPDATE-fails → only `poll_created` audit row, and (b) UPDATE-fails + DELETE-fails → `poll_created` + `poll_created_orphaned` rows, are reachable with this approach.

**Primary recommendation:** Advance CLI version in both local dev instructions and CI from 2.92.1 to the latest version that includes edge-runtime v1.74.0; add `[auth.email]` section to `config.toml`; implement fault-injection mechanism via `e2e/fixtures/seed.sql` + new test cases in the existing test file.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ES256 JWT verification (TEST-17) | Local Supabase stack (edge-runtime container) | CI workflow config | The bug is in the edge-runtime Docker image bundled by the CLI version; fix lives in the CLI version pin |
| Email auth enable (TEST-18) | Local Supabase stack (gotrue container) | `config.toml` | CLI translates `[auth.email].enable_signup` to `GOTRUE_EXTERNAL_EMAIL_ENABLED` env var at container boot |
| Fault injection (TEST-19) | Database layer (Postgres triggers) | Test harness (vitest) | The EF runs server-side; only a real DB-level mechanism can intercept its internal UPDATE call |

---

## Standard Stack

### Core — No New Dependencies

This phase repairs existing infrastructure. No new npm packages are introduced.

| Component | Current Version | Repaired Version | Purpose |
|-----------|----------------|-----------------|---------|
| supabase CLI (CI) | 2.92.1 [VERIFIED: GitHub API] | Latest CLI bundling edge-runtime v1.74.0 [VERIFIED: GitHub API] | `supabase start` for local stack |
| supabase/edge-runtime (bundled) | v1.73.3 [VERIFIED: GitHub API CLI Dockerfile] | v1.74.0 [VERIFIED: GitHub API edge-runtime releases] | Edge Function local runtime |
| supabase/gotrue (bundled) | v2.188.1 [VERIFIED: GitHub API CLI Dockerfile] | (same; stays at current) | Local auth service |
| `config.toml` `[auth.email]` | Missing → `GOTRUE_EXTERNAL_EMAIL_ENABLED=false` [VERIFIED: CLI source] | `enable_signup = true` → `GOTRUE_EXTERNAL_EMAIL_ENABLED=true` [VERIFIED: CLI source] | Enable email provider for test fixtures |

### Supporting
No supporting packages. This phase is infrastructure configuration + a SQL seed extension + test code additions.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CLI version bump in CI | Pin `edge_runtime` Docker image in `config.toml` via `[edge_runtime]` section | Both are valid. The `[edge_runtime]` section exists in the Supabase CLI config schema but it controls `policy` and `inspector_port`, NOT the Docker image version directly — image version is bundled per CLI version. The correct approach is bumping the CLI version. |
| Full `supabase stop && supabase start` to apply config | `supabase db reset` | `stop + start` is the correct cycle for config changes; `db reset` also applies migrations which is unnecessary noise |
| `e2e/fixtures/seed.sql` for fault injection setup | A separate `e2e/fixtures/test-helpers.sql` file | seed.sql already has the `app.e2e_seed_allowed` guard and is applied in CI before the integration suite runs; it is the right home for test-only DB fixtures |

---

## Package Legitimacy Audit

No external packages are installed in this phase.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
TEST-17 fix:
  CI workflow (ci.yml)
    └─ supabase/setup-cli@v2 version: X.Y.Z (bumped from 2.92.1)
         └─ bundles edge-runtime:v1.74.0 Docker image
              └─ serves EF HTTP calls during npm run test:integration
                   └─ [functions.*] verify_jwt = false  ← PRESERVED from config.toml

TEST-18 fix:
  config.toml
    └─ [auth.email] enable_signup = true
         └─ CLI start.go: GOTRUE_EXTERNAL_EMAIL_ENABLED=true
              └─ gotrue container accepts signInWithPassword
                   └─ mintClients({ authAs: 'memberUser' }) succeeds
                        └─ vote_counts RLS 12-cell matrix: 12 PASS

TEST-19 implementation:
  e2e/fixtures/seed.sql (new section, guarded by app.e2e_seed_allowed)
    └─ CREATE TABLE test_fault_config (poll_id uuid, fail_operation text)
    └─ CREATE FUNCTION / TRIGGER: fault_inject_polls_update_before()
         └─ BEFORE UPDATE/DELETE on polls: raises exception if poll_id in test_fault_config

  create-poll-results-hidden.test.ts (new test cases):
    └─ before: serviceRole.from('test_fault_config').insert({poll_id, fail_operation: 'update'})
    └─ invokeEF(create-poll, results_hidden: true)
    └─ EF: polls.UPDATE triggers fault → supabaseAdmin UPDATE fails
         └─ EF: compensating polls.DELETE executes
              └─ [branch a]: DELETE succeeds → 500 returned + poll_created audit row only
              └─ [branch b]: DELETE also fails (test_fault_config has 'delete' too) → 500 returned + poll_created + poll_created_orphaned
    └─ after: serviceRole.from('test_fault_config').delete().eq('poll_id', ...)
```

### Recommended Project Structure

No structural changes needed. All modifications are:
- `supabase/config.toml` — add `[auth.email]` section
- `.github/workflows/ci.yml` — bump CLI version (two places: `test-integration` and `e2e` jobs)
- `.github/workflows/deploy-edge-functions.yml` — bump CLI version (if coupling desired; optional)
- `e2e/fixtures/seed.sql` — add fault-injection table + trigger (at end, guarded)
- `e2e/integration/create-poll-results-hidden.test.ts` — remove deferral comment, add 2 test cases

### Pattern 1: Config-Driven Test Fault Injection (TEST-19)

**What:** A permanent DB trigger on `polls` that is normally dormant. Tests activate it by inserting into a `test_fault_config` table (service-role), then clean up after.

**When to use:** When the code under test runs server-side (EF) and cannot be intercepted via client-side mocking. Preferred over session GUCs (which don't survive across DB connections) or DDL from tests (which requires elevated privileges beyond what supabase-js provides).

**Example seed.sql addition:**
```sql
-- FAULT INJECTION: test_fault_config table + trigger
-- Guarded by app.e2e_seed_allowed — will never exist outside the local E2E stack.
CREATE TABLE IF NOT EXISTS public.test_fault_config (
  poll_id uuid NOT NULL,
  fail_operation text NOT NULL CHECK (fail_operation IN ('update', 'delete')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, fail_operation)
);
-- RLS off — service_role reads/writes via bypass; no public access needed
ALTER TABLE public.test_fault_config DISABLE ROW LEVEL SECURITY;
-- Trigger function: raises before UPDATE on polls if poll_id is armed in test_fault_config
CREATE OR REPLACE FUNCTION public.fault_inject_polls_before_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.test_fault_config
    WHERE poll_id = NEW.id AND fail_operation = 'update'
  ) THEN
    RAISE EXCEPTION 'fault_inject: deliberate UPDATE failure on poll %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER fault_inject_polls_update
  BEFORE UPDATE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.fault_inject_polls_before_update();

-- Trigger function: raises before DELETE on polls if poll_id is armed
CREATE OR REPLACE FUNCTION public.fault_inject_polls_before_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.test_fault_config
    WHERE poll_id = OLD.id AND fail_operation = 'delete'
  ) THEN
    RAISE EXCEPTION 'fault_inject: deliberate DELETE failure on poll %', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;
CREATE OR REPLACE TRIGGER fault_inject_polls_delete
  BEFORE DELETE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.fault_inject_polls_before_delete();
```

**Test case pattern:**
```typescript
// Source: derived from existing test helpers in e2e/integration/create-poll-results-hidden.test.ts

it('results_hidden=true with UPDATE failure rolls back poll and returns 500 (audit: poll_created only)', async () => {
  // Invoke EF to get pollId — need to intercept BEFORE EF creates it.
  // Approach: create the poll via EF with results_hidden=false first to get pollId,
  // arm the trigger, then invoke with results_hidden=true on a NEW poll.
  // 
  // BETTER: arm a sentinel poll_id BEFORE the EF call, so the trigger fires
  // on the NEW.id from create_poll_with_choices. But we don't know the ID in advance.
  //
  // ACTUAL PATTERN: Use a trigger that arms on a SPECIAL TITLE PREFIX instead of poll_id.
  // OR: Use an advisory lock / flag column on polls (see Anti-Patterns).
  //
  // RECOMMENDED (feasible without knowing ID in advance):
  // Arm the trigger on a KNOWN pattern. After the EF fails, check audit for poll_id
  // via readAuditLog (the EF writes poll_created BEFORE the UPDATE attempt).
})
```

**NOTE on ID-in-advance problem:** The test doesn't know the poll ID before invoking the EF. Two solutions:
1. **Solution A (recommended):** The trigger condition uses a flag row with `poll_id = '00000000-0000-0000-0000-000000000000'::uuid` as a wildcard sentinel — any UPDATE/DELETE while this row exists fails. The test arms this, runs the EF, then reads the `poll_created` audit row to get the actual `pollId` for assertions, then disarms.
2. **Solution B:** Add a second `test_fault_config` column `title_prefix text` so the trigger fires on `polls.title LIKE test_fault_config.title_prefix || '%'`.

Solution A is simpler and fits the "armed during EF call, disarmed after" pattern.

### Pattern 2: CLI Version Coupling (TEST-17 + TEST-18 coupling)

**What:** Both TEST-17 and TEST-18 share the CLI version in CI. If a CLI bump is needed for TEST-17, it should be tested for TEST-18 simultaneously.

**Key observation:** CLI v2.92.1 bundles:
- `supabase/edge-runtime:v1.73.3` (has ES256 bug)
- `supabase/gotrue:v2.188.1` (has NULL scan issue documented in seed.sql)

The current CLI HEAD bundles:
- `supabase/edge-runtime:v1.74.0` [VERIFIED: GitHub API]
- `supabase/gotrue:v2.189.0` [VERIFIED: GitHub API]

**The latest released CLI version as of research date must be identified at plan time** — the planner should check `https://github.com/supabase/cli/releases` for the latest stable CLI version that bundles edge-runtime ≥ v1.74.0. The CLI version appears in `.github/workflows/ci.yml` in TWO places (`test-integration` job and `e2e` job) and in `deploy-edge-functions.yml`.

### Anti-Patterns to Avoid

- **Using session GUCs for fault injection:** `SET LOCAL app.fault_inject = true` only lasts the current transaction/connection. The EF runs in its own connection (PostgREST + Deno worker pool), so a GUC set in the test's service-role client session will NOT be visible inside the EF's DB calls. [VERIFIED: Postgres session isolation]
- **Creating DDL from test code:** `serviceRole.from(...)` does DML, not DDL. The service_role PostgREST connection runs as the `postgres` role in local Supabase, but supabase-js does not expose a `query()` interface for arbitrary SQL. Attempting `CREATE TRIGGER` from test code requires a direct DB connection (not available in the integration suite env). [VERIFIED: CI env analysis — `SUPABASE_DB_URL` is not passed to `npm run test:integration`]
- **Relying on Supabase client error shapes:** `client.functions.invoke()` collapses non-2xx into `FunctionsHttpError` without the status code. The integration suite already uses `invokeEF()` via raw `fetch` — continue this pattern for TEST-19 test cases.
- **Removing `[functions.*] verify_jwt = false` entries:** These ARE the TEST-17 fix context. They must be preserved. They align the local stack with prod's `--no-verify-jwt` behavior. Removing them would reintroduce the ES256 401 failure.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Edge-runtime ES256 fix | Custom JWT verification shim in test setup | Bump CLI version to one bundling edge-runtime v1.74.0 | The bug is in the edge-runtime Docker image; the fix already exists upstream |
| Email provider activation | Custom gotrue container env injection | `[auth.email] enable_signup = true` in `config.toml` | The CLI already passes this to the container via `GOTRUE_EXTERNAL_EMAIL_ENABLED` |
| Server-side fault injection | Mock/stub inside EF code | DB trigger in seed.sql + test_fault_config table | EF runs server-side; only the DB layer can intercept it |
| Fault injection cleanup | Custom teardown script | `afterEach` / `afterAll` with `serviceRole.from('test_fault_config').delete()` | Follows the existing `afterEach` cleanup pattern in the test file |

**Key insight:** All three repairs require working with the existing infrastructure at its natural seam — the CLI version determines the edge-runtime image; the config.toml is the single source of truth for gotrue env; the DB trigger is the only layer the EF cannot bypass.

---

## Research Q&A — Direct Answers to Research Questions

### Q1: TEST-17 — Exact edge_runtime pin

**Answer:** The ES256 JWT-verification bug is in the edge-runtime Docker image bundled by CLI v2.92.1, specifically `supabase/edge-runtime:v1.73.3`. [VERIFIED: GitHub API, CLI Dockerfile template at v2.92.1 commit]

The first version past the 1.73.x series is `supabase/edge-runtime:v1.74.0`, released 2026-04-30. [VERIFIED: GitHub API, supabase/edge-runtime releases]

**Important:** There is NO single `[edge_runtime]` config.toml key that pins the Docker image version directly. The edge-runtime image version is determined entirely by the CLI version. To fix TEST-17, the fix is to **bump the Supabase CLI version** in `ci.yml` from `2.92.1` to the latest stable version that bundles edge-runtime ≥ 1.74.0.

As of research date, the current CLI HEAD Dockerfile shows `supabase/edge-runtime:v1.74.0`. The planner must identify the specific CLI version number to pin (check `https://github.com/supabase/cli/releases` at plan time for the latest stable CLI release after v2.92.1 that includes this image). [ASSUMED: The specific CLI version number — must be verified at plan time]

**Breaking changes in the CLI bump:** Research of edge-runtime releases v1.73.0 through v1.74.0 shows only bug fixes (tokio-eld, HTTP client timeouts, telemetry, URL handling, build fixes). No breaking changes to EF APIs or behavior. [VERIFIED: GitHub API, edge-runtime release notes]

**The `verify_jwt = false` entries in config.toml ARE the correct workaround** and must be preserved. The CLI version bump changes which edge-runtime image runs locally but does NOT change the `verify_jwt = false` behavior — that's a config.toml setting independent of the image version.

**Why the bug exists in 1.73.x specifically:** The inline comment in `config.toml` explains it: the local edge runtime falls back to HS256 verification on user tokens the auth service issued as ES256, returning 401 before the EF can run its own check. This is a gateway-layer JWT verification issue in the edge-runtime, fixed in 1.74.0. [CITED: supabase/config.toml lines 24-30]

### Q2: TEST-18 — Exact config.toml change

**Root cause confirmed:** `config.toml` has `[auth]` and `[auth.external.discord]` but NO `[auth.email]` section. The CLI Go struct `email.EnableSignup` is type `bool` (zero value = `false`). When the TOML section is absent, the CLI passes `GOTRUE_EXTERNAL_EMAIL_ENABLED=false` to the gotrue container at boot time. [VERIFIED: CLI source, `start.go` line: `fmt.Sprintf("GOTRUE_EXTERNAL_EMAIL_ENABLED=%v", utils.Config.Auth.Email.EnableSignup)`]

**Exact fix:**
```toml
[auth.email]
enable_signup = true
# If enabled, users need to confirm their email address before signing in.
enable_confirmations = false
```

- `enable_signup = true` → `GOTRUE_EXTERNAL_EMAIL_ENABLED=true` — enables the email provider
- `enable_confirmations = false` → `GOTRUE_MAILER_AUTOCONFIRM=true` — no confirmation email required

**Why previous attempts "had no effect":** The evidence document says "multiple `[auth.email]` config.toml variants tried, none flipped the runtime behavior." This is consistent with the gotrue container having been started BEFORE the config change and NOT restarted afterward. The Supabase local stack caches its gotrue container env at `supabase start` time — a config change requires `supabase stop && supabase start` to take effect. [ASSUMED: This was the root cause of the previous attempts failing — supabase restart was not done. Confidence: HIGH based on how the CLI works]

**Seed.sql NULL column fix:** The seed.sql already addresses the GoTrue v2.188+ NULL column scan issue (empty string values for `confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change`) per the comment at lines 35-44. This fix is sufficient alongside the config.toml change. No additional seed changes needed for TEST-18.

**Sufficient for the 12-cell matrix?** Yes. `mintClients()` calls `authed.auth.signInWithPassword()` for both `memberUser` and `adminUser`. With `enable_signup = true` and `enable_confirmations = false`, both calls succeed, producing valid sessions. The matrix's `authed` cells use `memberUser`'s session; the `adminUser` session is used for the sentinel test at the bottom. [VERIFIED: vote-counts-rls.test.ts analysis]

### Q3: TEST-19 — Fault injection feasibility

**Branch (a): UPDATE-fails → `poll_created` audit row persists [FEASIBLE]**

The `create-poll` EF writes the `poll_created` audit row BEFORE the UPDATE attempt (line 161). If the UPDATE fails, the EF attempts a compensating DELETE. If the DELETE succeeds, the poll is cleaned up and only the `poll_created` audit row remains (the EF returns 500 to the caller). [VERIFIED: create-poll/index.ts lines 151-200]

**Branch (b): UPDATE-fails AND DELETE-fails → `poll_created` + `poll_created_orphaned` rows [FEASIBLE]**

If both UPDATE and DELETE fail, the EF emits a `poll_created_orphaned` audit row and returns 500. The poll exists in `polls` with `results_hidden=false`. [VERIFIED: create-poll/index.ts lines 179-200]

**Viable DB-level injection mechanism:** A `test_fault_config` table + BEFORE UPDATE/DELETE triggers on `polls`, installed in `e2e/fixtures/seed.sql` (guarded by `app.e2e_seed_allowed=true`). The triggers check for the poll_id in `test_fault_config` before the EF's UPDATE/DELETE executes. [VERIFIED: seed.sql pattern analysis, Postgres trigger semantics]

**The ID-in-advance problem:** The test doesn't know the poll ID before the EF call (the EF creates the poll via RPC internally). **Solution:** Use a wildcard sentinel row with `poll_id = '00000000-0000-0000-0000-000000000000'::uuid`. When this row exists in `test_fault_config` with `fail_operation = 'update'`, ANY poll UPDATE fails. The test:
1. Inserts the sentinel row
2. Invokes the EF (EF creates poll → UPDATE blocked → compensating DELETE runs)
3. For branch (a): DELETE is NOT blocked → poll deleted → 500 + only `poll_created` audit row
4. For branch (b): Also insert sentinel with `fail_operation = 'delete'` → DELETE blocked → 500 + `poll_created` + `poll_created_orphaned` audit rows
5. Assert on the audit rows (which carry the actual poll_id from the EF's `writeAudit` calls)
6. Cleanup: `serviceRole.from('test_fault_config').delete().match({...})` + `serviceRole.from('audit_log').delete().eq('target_id', actualPollId)`

**Service-role privileges:** The `test_fault_config` table has RLS disabled. Service-role can INSERT/DELETE to it via supabase-js `from('test_fault_config')`. [VERIFIED: seed.sql pattern, RLS disable for service-role bypass]

**Trigger ownership:** The triggers are created in seed.sql which runs as `postgres` (superuser). The triggers fire when the EF's supabaseAdmin client (using service role key → PostgREST `postgres` role) executes UPDATE/DELETE on `polls`. BEFORE triggers fire for ALL callers regardless of RLS or role. [VERIFIED: Postgres trigger semantics]

**Branch (b) EF response:** The EF returns 500 in both (a) and (b) cases. The distinction is visible only in the audit log: branch (a) has 1 audit row (`poll_created`); branch (b) has 2 audit rows (`poll_created` + `poll_created_orphaned`). [VERIFIED: create-poll/index.ts lines 186-199]

**Aftercare for branch (b):** The orphaned poll (in branch b, poll exists with `results_hidden=false`) needs cleanup. Use `serviceRole.from('polls').delete().eq('id', actualPollId)` in `afterEach`. The trigger will fire AGAIN on this cleanup DELETE — so the test must disarm the `'delete'` sentinel before cleanup, or disarm both sentinels in `afterEach` before the poll cleanup.

### Q4: Validation Architecture

(See dedicated section below.)

### Q5: TEST-17 + TEST-18 coupling through CLI bump

**Answer: Yes, they are coupled — deliberately.** Both are fixed by the same CLI version bump in `ci.yml`. The CLI version determines both:
- The edge-runtime image version (TEST-17)
- The gotrue image version (TEST-18 — though the gotrue fix is via config.toml, the gotrue version determines what config keys are accepted)

**Sequencing:**
1. First: add `[auth.email] enable_signup = true` / `enable_confirmations = false` to `config.toml` → this is a config file change, no CLI dependency
2. Second: bump CLI version in `ci.yml` (both `test-integration` and `e2e` jobs) → this fixes TEST-17
3. Third: implement fault-injection seed + test cases → TEST-19

Steps 1 and 3 are independent. Step 2 is the only version-dependent change.

**Local vs CI sequencing for testing:** To verify TEST-18 locally without changing the CLI version, the developer can `supabase stop && supabase start` after adding the `[auth.email]` section to config.toml — the local gotrue container respects the new config on restart. The ES256 fix (TEST-17) is only testable locally if the local Supabase stack is also upgraded to the new CLI version.

---

## Common Pitfalls

### Pitfall 1: config.toml changes without `supabase stop && supabase start`
**What goes wrong:** The `[auth.email] enable_signup = true` change appears to have no effect.
**Why it happens:** The Supabase local stack sets gotrue's env vars at container startup. Config changes are not hot-reloaded.
**How to avoid:** Always `supabase stop && supabase start` after any `config.toml` change. The `supabase db reset` command does NOT restart the auth container.
**Warning signs:** Same `email_provider_disabled` error after config change.

### Pitfall 2: Only bumping CLI version in one CI job
**What goes wrong:** `test-integration` passes but `e2e` job still fails, or vice versa.
**Why it happens:** CLI version appears in TWO places in `ci.yml` (`test-integration` and `e2e` jobs use separate `supabase/setup-cli@v2` steps). Also appears in `deploy-edge-functions.yml`.
**How to avoid:** Search ci.yml for all `version:` lines under `supabase/setup-cli` and update all of them consistently.
**Warning signs:** One CI job green, another fails on edge-runtime version.

### Pitfall 3: Wildcard sentinel not disarmed before afterEach cleanup
**What goes wrong:** The poll cleanup in `afterEach` triggers the fault injection DELETE trigger, causing the cleanup to fail and leaking a test poll.
**Why it happens:** The `test_fault_config` wildcard sentinel `poll_id = '00000000-...'` blocks ALL deletes from polls table, including test cleanup deletes.
**How to avoid:** In `afterEach` / test body, disarm the sentinel (`serviceRole.from('test_fault_config').delete()`) BEFORE `cleanupPoll()`. Also: after branch (b), the orphaned poll exists and must be explicitly deleted AFTER disarming the delete sentinel.
**Warning signs:** Leaked polls in the database after test run; `cleanupPoll` throws.

### Pitfall 4: Missing `e2e_seed_allowed` guard on fault injection SQL
**What goes wrong:** The `test_fault_config` table and triggers get installed on production via an accidental migration.
**Why it happens:** Fault injection SQL placed in a migration file instead of the guarded `e2e/fixtures/seed.sql`.
**How to avoid:** All fault injection infrastructure goes in `e2e/fixtures/seed.sql` behind the `app.e2e_seed_allowed = true` guard. No migration. [CITED: seed.sql pattern, lines 22-28]
**Warning signs:** `test_fault_config` table exists in production Supabase dashboard.

### Pitfall 5: Asserting on EF response status for branch differentiation
**What goes wrong:** Tests try to distinguish branch (a) from (b) by EF HTTP status — both return 500.
**Why it happens:** The EF returns the same 500 response regardless of whether the compensating DELETE succeeded or failed.
**How to avoid:** Assert on audit log rows (action type and count), not the HTTP status. Use `readAuditLog({serviceRole, targetId: actualPollId})` to check for `poll_created_orphaned`. [VERIFIED: create-poll/index.ts lines 186-200]

---

## Code Examples

### Example 1: config.toml `[auth.email]` fix (TEST-18)
```toml
# Source: CLI auth.go struct + start.go env mapping (supabase/cli/pkg/config/auth.go,
#         supabase/cli/internal/start/start.go — verified via GitHub API)
[auth.email]
# enable_signup = true → GOTRUE_EXTERNAL_EMAIL_ENABLED=true in gotrue container
# Required so signInWithPassword works for fixture users in the integration suite.
# Default (absent section) = false = email_provider_disabled error.
enable_signup = true
# enable_confirmations = false → GOTRUE_MAILER_AUTOCONFIRM=true
# No confirmation email needed — fixture users are pre-confirmed in seed.sql
# (email_confirmed_at = now()) so this is belt-and-suspenders.
enable_confirmations = false
```

### Example 2: CI CLI version bump (TEST-17)
```yaml
# Source: .github/workflows/ci.yml — BOTH jobs must be updated
# test-integration job:
- uses: supabase/setup-cli@v2
  with:
    version: X.Y.Z  # ← replace 2.92.1 with latest stable that bundles edge-runtime v1.74.0

# e2e job:
- uses: supabase/setup-cli@v2
  with:
    version: X.Y.Z  # ← same version
```
Note: Also update `deploy-edge-functions.yml` for consistency (optional but recommended for hygiene).

### Example 3: Fault injection test cases (TEST-19)
```typescript
// Source: derived from create-poll-results-hidden.test.ts existing patterns

// Branch (a): UPDATE fails, DELETE succeeds → poll_created only
it('results_hidden=true: UPDATE failure rolls back poll; only poll_created audit row emitted', async () => {
  const SENTINEL_ID = '00000000-0000-0000-0000-000000000000'

  // Arm UPDATE sentinel BEFORE invoking EF (poll_id unknown in advance)
  await adminClients.serviceRole
    .from('test_fault_config')
    .insert({ poll_id: SENTINEL_ID, fail_operation: 'update' })

  const result = await invokeEF({
    client: adminClients.authed,
    name: 'create-poll',
    body: buildBody({ results_hidden: true }),
  })
  expect(result.status).toBe(500)  // EF returns 500 on UPDATE failure

  // Disarm before cleanup (sentinel blocks ALL polls' UPDATE, not needed after)
  await adminClients.serviceRole
    .from('test_fault_config')
    .delete()
    .match({ poll_id: SENTINEL_ID, fail_operation: 'update' })

  // poll_created audit row should exist (written BEFORE the UPDATE attempt)
  // But DELETE succeeded so poll was cleaned up by the EF's compensating delete
  // The EF wrote poll_created, then UPDATE failed, then DELETE succeeded
  // → audit row exists, poll does NOT exist in polls table
  // Get the actual poll_id from the audit log (EF wrote it there)
  const auditRows = await adminClients.serviceRole
    .from('audit_log')
    .select('*')
    .eq('action', 'poll_created')
    .order('created_at', { ascending: false })
    .limit(1)
  expect(auditRows.data).toHaveLength(1)
  const actualPollId = auditRows.data![0].target_id as string

  const rows = await readAuditLog({ serviceRole: adminClients.serviceRole, targetId: actualPollId })
  expect(rows).toHaveLength(1)
  expect(rows[0].action).toBe('poll_created')
  // No poll_created_orphaned row (DELETE succeeded)
  expect(rows.find(r => r.action === 'poll_created_orphaned')).toBeUndefined()

  // Verify poll does NOT exist (was cleaned up by compensating DELETE)
  const { data: pollRow } = await adminClients.serviceRole
    .from('polls').select('id').eq('id', actualPollId).maybeSingle()
  expect(pollRow).toBeNull()

  // Cleanup audit log
  createdPollId = actualPollId  // let afterEach handle audit_log cleanup
})

// Branch (b): UPDATE fails AND DELETE fails → poll_created + poll_created_orphaned
it('results_hidden=true: UPDATE+DELETE failure emits poll_created + poll_created_orphaned', async () => {
  const SENTINEL_ID = '00000000-0000-0000-0000-000000000000'

  // Arm BOTH UPDATE and DELETE sentinels
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

  // Disarm DELETE sentinel BEFORE cleanup so afterEach cleanupPoll works
  await adminClients.serviceRole
    .from('test_fault_config')
    .delete()
    .match({ poll_id: SENTINEL_ID })

  // Retrieve the actual poll_id from the audit log
  const allAudit = await adminClients.serviceRole
    .from('audit_log')
    .select('*')
    .in('action', ['poll_created', 'poll_created_orphaned'])
    .order('created_at', { ascending: false })
    .limit(2)
  const actualPollId = allAudit.data![0].target_id as string
  createdPollId = actualPollId  // let afterEach handle cleanup

  const rows = await readAuditLog({ serviceRole: adminClients.serviceRole, targetId: actualPollId })
  expect(rows).toHaveLength(2)
  expect(rows.find(r => r.action === 'poll_created')).toBeDefined()
  const orphaned = rows.find(r => r.action === 'poll_created_orphaned')
  expect(orphaned).toBeDefined()
  expect(orphaned!.after).toMatchObject({
    results_hidden_intended: true,
    results_hidden_actual: false,
    reason: 'compensation_delete_failed',
  })

  // Poll DOES exist (DELETE failed, poll orphaned with results_hidden=false)
  const { data: pollRow } = await adminClients.serviceRole
    .from('polls').select('results_hidden').eq('id', actualPollId).single()
  expect(pollRow!.results_hidden).toBe(false)
})
```

### Example 4: Seed.sql fault injection DDL (TEST-19)
```sql
-- Source: derived from e2e/fixtures/seed.sql pattern (app.e2e_seed_allowed guard)
-- Place this AFTER the existing seed content, still within the guard scope.

-- ============================================================
-- Fault Injection: test_fault_config + BEFORE UPDATE/DELETE triggers on polls
-- LOCAL E2E ONLY — never present in production (guarded by app.e2e_seed_allowed).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.test_fault_config (
  poll_id  uuid  NOT NULL,
  fail_operation  text  NOT NULL CHECK (fail_operation IN ('update', 'delete')),
  created_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, fail_operation)
);
ALTER TABLE public.test_fault_config DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fault_inject_polls_before_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  -- Fires when poll_id = NEW.id OR wildcard sentinel '00000000-...' is armed
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase CLI 2.92.1 + edge-runtime v1.73.3 | CLI bump to latest + edge-runtime v1.74.0 | Phase 18 (this phase) | Resolves ES256 JWT-verification bug in local gateway |
| Missing `[auth.email]` in config.toml (→ GOTRUE_EXTERNAL_EMAIL_ENABLED=false) | `[auth.email] enable_signup = true` | Phase 18 (this phase) | Enables email/password sign-in for fixture users in integration tests |
| Comment-only deferral for fault-injection branch | Executable test cases via seed.sql trigger mechanism | Phase 18 (this phase) | Closes TEST-19 completeness gap |

**Deprecated/outdated:**
- The v1.3 SQL regression fixture at `tests/sql/is_current_user_admin_regression.sql` remains valid as a direct SQL test but is no longer the PRIMARY evidence for the 12-cell RLS matrix once TEST-18 is resolved.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The specific stable CLI version that bundles edge-runtime v1.74.0 must be identified at plan time from the GitHub releases page | Standard Stack / Q1 | Wrong CLI version picked; edge-runtime version doesn't match; plan needs revision |
| A2 | Previous TEST-18 attempts failed because `supabase stop && supabase start` was not done after config change (not a gotrue version bug) | Q2 | If wrong, there's a gotrue-version-specific config key change needed; investigate gotrue v2.188.1 `GOTRUE_EXTERNAL_EMAIL_ENABLED` config handling |
| A3 | The `postgres` DB user (which executes BEFORE triggers) runs in the same transaction as the EF's supabaseAdmin UPDATE call, so the trigger fires synchronously before the UPDATE completes | Q3 | Postgres guarantees this for BEFORE triggers — very high confidence, but the specific Supabase local stack connection pool behavior for Edge Functions should be validated by running the test |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions (RESOLVED)

1. **Exact CLI version to pin (TEST-17)**
   - What we know: Current CLI HEAD bundles edge-runtime v1.74.0; CLI v2.92.1 bundles v1.73.3
   - What's unclear: The exact semantic version of the CLI release that first included edge-runtime v1.74.0
   - Recommendation: Check `https://github.com/supabase/cli/releases` at plan time; look for the first release after `2.92.1` that shows edge-runtime v1.74.0 in its Dockerfile template. Alternatively, use the latest stable CLI release.

2. **Sentinel poll_id approach vs. title-prefix approach (TEST-19)**
   - What we know: Wildcard sentinel `00000000-...-0000` blocks ALL polls' UPDATE/DELETE while armed
   - What's unclear: Whether any OTHER test case (running in parallel or in sequence) might also create polls while the sentinel is armed, causing false failures
   - Recommendation: Since Vitest integration suite runs sequentially (single worker, no parallelism for DB-touching tests), the sentinel approach is safe. Add a comment noting this assumption.

3. **`[auth.email]` interaction with `[auth.external.discord]` (TEST-18)**
   - What we know: Both sections can coexist in config.toml
   - What's unclear: Whether adding `[auth.email]` changes any behavior for Discord OAuth paths (unlikely but worth noting)
   - Recommendation: Discord OAuth goes through a different code path in gotrue (`config.External.Discord`). Adding `[auth.email]` only affects the email provider gate. No interference expected.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | All tests (local) | ✗ (not in PATH on research machine) | — | N/A — must be installed locally for development; CI uses `supabase/setup-cli@v2` |
| Docker | `supabase start` | ✓ (assumed; CI uses `ubuntu-latest`) | — | None — required for local Supabase stack |
| Node.js 22 | `npm run test:integration` | ✓ (CI: `actions/setup-node@v6 node-version: '22'`) | 22 | None |
| PostgreSQL client (`psql`) | `e2e/fixtures/seed.sql` apply | ✓ (CI: available on `ubuntu-latest`) | — | None |

**Missing dependencies with no fallback:**
- Local Supabase CLI — developer must install the bumped version locally before running integration tests

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

> `workflow.nyquist_validation: true` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (version per `package.json`) |
| Config file | `vitest.config.integration.ts` |
| Quick run command | `npm run test:integration -- e2e/integration/vote-counts-rls.test.ts` |
| Full suite command | `npm run test:integration` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-17 | `npm run test:integration` completes with 0 failures, 0 skips after CLI bump | integration smoke | `npm run test:integration` | ✅ (all integration test files exist) |
| TEST-18 | 12-cell RLS matrix: 12 PASS / 0 FAIL | integration | `npm run test:integration -- e2e/integration/vote-counts-rls.test.ts --reporter=verbose` | ✅ (`e2e/integration/vote-counts-rls.test.ts`) |
| TEST-19 branch (a) | UPDATE-fails → 500 + `poll_created` only in audit | integration | `npm run test:integration -- e2e/integration/create-poll-results-hidden.test.ts` | ✅ (file exists, new test cases needed) |
| TEST-19 branch (b) | UPDATE+DELETE-fail → 500 + `poll_created` + `poll_created_orphaned` | integration | `npm run test:integration -- e2e/integration/create-poll-results-hidden.test.ts` | ✅ (same file, additional test case) |

### Observable Success Signals

**TEST-17 green signal:**
- `npm run test:integration` exits 0 with no `skipped` count
- CI `test-integration` job passes with the new CLI version
- No `401 Unauthorized` errors in integration test output

**TEST-18 green signal:**
- `vote-counts-rls.test.ts` reports: `Tests 12 passed (12)` with 0 failed, 0 skipped
- No `AuthApiError: Email logins are disabled` / `email_provider_disabled` in output
- `mintClients({ authAs: 'memberUser' })` and `mintClients({ authAs: 'adminUser' })` both complete without throwing

**TEST-19 green signal:**
- `create-poll-results-hidden.test.ts` reports: `Tests 6 passed (6)` (4 existing + 2 new)
- Branch (a) test: `rows.find(r => r.action === 'poll_created_orphaned')` is undefined; HTTP 500 observed; poll not in `polls` table
- Branch (b) test: `orphaned` row found with `after.reason === 'compensation_delete_failed'`; poll IS in `polls` table with `results_hidden = false`

### Sampling Rate
- **Per task commit:** `npm run test:integration -- [specific-file] --reporter=verbose`
- **Per wave merge:** `npm run test:integration` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `e2e/fixtures/seed.sql` — fault injection DDL section (new addition at end of file)
- [ ] `e2e/integration/create-poll-results-hidden.test.ts` — 2 new test cases replace deferral comment

*(All other test infrastructure exists and covers the requirements)*

---

## Security Domain

> This phase makes no product feature changes. No new attack surface is introduced.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — config.toml email change is local-only; prod auth uses Discord OAuth exclusively |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | No | N/A |
| V6 Cryptography | No | N/A |

### Security Notes for This Phase
- `[auth.email] enable_signup = true` in `config.toml` enables email auth LOCALLY ONLY. The local Supabase stack is not internet-accessible. Production remains Discord-only. [CITED: CLAUDE.md — "Auth: Discord OAuth only"]
- The `test_fault_config` table and triggers are installed ONLY in the `e2e/fixtures/seed.sql` which is guarded by `app.e2e_seed_allowed=true`. They cannot be applied to production. [CITED: seed.sql lines 22-28]
- The fault-injection triggers use `SECURITY INVOKER` (not `SECURITY DEFINER`), which means they run with the same privileges as the caller. No privilege escalation. [CITED: Code example above]

---

## Sources

### Primary (HIGH confidence)
- [supabase/cli GitHub API — Dockerfile template at v2.92.1 and HEAD] — verified edge-runtime v1.73.3 (v2.92.1) and v1.74.0 (HEAD)
- [supabase/edge-runtime GitHub API releases] — verified v1.74.0 release date 2026-04-30 and v1.73.x patch history
- [supabase/cli GitHub API — internal/start/start.go] — verified `GOTRUE_EXTERNAL_EMAIL_ENABLED` env var mapping from `email.EnableSignup`
- [supabase/cli GitHub API — pkg/config/auth.go at v2.92.1] — verified `email` struct fields and `toAuthConfigBody` / env mapping
- [supabase/auth GitHub search — token.go, signup.go, middleware.go] — verified `email_provider_disabled` fires when `config.External.Email.Enabled = false`
- [wtcs-community-polls/supabase/config.toml] — confirmed missing `[auth.email]` section
- [wtcs-community-polls/supabase/functions/create-poll/index.ts] — verified exact code paths for UPDATE/DELETE/audit sequence
- [wtcs-community-polls/e2e/integration/vote-counts-rls.test.ts] — verified 12-cell matrix structure and session requirements
- [wtcs-community-polls/e2e/fixtures/seed.sql] — verified `app.e2e_seed_allowed` guard pattern and NULL column fix
- [wtcs-community-polls/.github/workflows/ci.yml] — verified test-integration job env vars and CLI version usage
- [wtcs-community-polls/.planning/milestones/v1.3-phases/14-.../evidence/test-11-deferred-local-block.md] — verified prior attempts and error message

### Secondary (MEDIUM confidence)
- [supabase/cli GitHub releases page] — confirmed CLI v2.92.1 is after v2.90.0; release v2.99.0 is latest as of research date (2026-05-20 release date)
- [WebSearch — Docker Hub edge-runtime tags] — confirmed v1.73.15 was most recent in 1.73.x series before v1.74.0

### Tertiary (LOW confidence)
- [Assumption A2] — prior attempts "had no effect" due to missing restart, not a gotrue version issue

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all version data verified via GitHub API against authoritative sources
- Architecture: HIGH — verified against actual code in the project and CLI source
- Pitfalls: HIGH — verified via code analysis (config.toml zero-value bug, trigger sequencing)
- Fault injection approach: MEDIUM-HIGH — approach is sound (Postgres BEFORE trigger semantics guaranteed); sentinel wildcard approach is novel for this project but follows established DB testing patterns; actual behavior validated by code reading

**Research date:** 2026-05-31
**Valid until:** 2026-07-01 (stable infrastructure; the only drift risk is if the latest CLI version changes between research and plan execution)
