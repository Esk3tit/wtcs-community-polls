---
phase: 18-test-environment-repair
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/workflows/deploy-edge-functions.yml
  - e2e/fixtures/seed.sql
  - e2e/integration/create-poll-results-hidden.test.ts
  - package.json
  - supabase/config.toml
  - vitest.config.integration.ts
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-05-31
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the test-environment-repair phase: CI workflow correctness, the fail-closed
fault-injection seed (`e2e/fixtures/seed.sql`), the fault-injection integration test,
`config.toml` auth/per-function `verify_jwt` overrides, the integration vitest config,
and `package.json`.

The fail-closed seed guard, title-scoped triggers, `SECURITY INVOKER` functions, and the
test's `try/finally` disarm logic are well-constructed and the stale-sentinel cleanup
(DROP+CREATE+TRUNCATE) is sound. However the review surfaces one BLOCKER: the
`fault_inject_polls_*` triggers are installed as **permanent objects on `public.polls`**
by a seed that runs against any DB where `app.e2e_seed_allowed=true` is set — and more
importantly, `config.toml` is missing `verify_jwt = false` overrides for three deployed
Edge Functions, which means the integration/E2E auth path for those functions does NOT
match production and will 401 before the function's own auth runs. Several WARNINGs cover
unchecked test setup inserts, a non-fail-fast `supabase start`, and stale/misleading
workflow comments that will mislead future debugging.

## Critical Issues

### CR-01: `config.toml` omits `verify_jwt = false` for three deployed Edge Functions — local auth path diverges from production

**File:** `supabase/config.toml:41-78` (and by omission: `submit-vote`, `get-upload-url`, `search-admin-targets`)
**Issue:**
The file's own header comment (lines 34-40) states the intent: every EF does its own JWT
validation, production deploys all pass `--no-verify-jwt`, and these per-function entries
"align the local stack so `npm run test:integration` exercises the same auth path as prod."

But of the 16 deployable functions under `supabase/functions/`, only 13 have a
`[functions.<name>] verify_jwt = false` block. Three are missing:

- `submit-vote`
- `get-upload-url`
- `search-admin-targets`

`deploy-edge-functions.yml:39` deploys ALL functions with `--no-verify-jwt`, so in
production these three run their own auth. Locally, the gateway defaults to
`verify_jwt = true` for them, and (per the file's own comment) the local edge runtime
falls back to HS256 verification on ES256-issued user tokens and returns **401 before the
function runs**. Any current or future integration/E2E test that invokes these three
functions through an authed client will fail against the local stack for a reason that
does not exist in production — a false-red that masks real regressions, or (if a test is
written to tolerate the 401) a false-green that never exercises the real function. This
is exactly the production/local auth-path divergence the section was added to prevent;
it is incompletely applied.

`submit-vote` is the highest-value gap: it is the rate-limited core mutation and the most
likely next integration-test target.

**Fix:** Add the three missing blocks (alphabetical placement is fine):
```toml
[functions.submit-vote]
verify_jwt = false

[functions.get-upload-url]
verify_jwt = false

[functions.search-admin-targets]
verify_jwt = false
```
Consider adding a CI guard that asserts every directory under `supabase/functions/`
(excluding `_shared`) has a matching `[functions.<name>]` block, so a newly-added EF
cannot silently drift out of alignment again.

## Warnings

### WR-01: Fault-injection triggers become permanent `public.polls` objects, gated only by a runtime GUC, not by environment

**File:** `e2e/fixtures/seed.sql:209-242`
**Issue:**
The `\set ON_ERROR_STOP on` + `app.e2e_seed_allowed` guard prevents the *seed* from
running on a hosted DB. But once it does run (the GUC is just a session setting any
operator could set), it installs `fault_inject_polls_before_update` /
`..._before_delete` as `CREATE OR REPLACE FUNCTION` + `CREATE TRIGGER` on
`public.polls` — these are durable schema objects that persist beyond the psql session,
on every row of every UPDATE/DELETE to `polls`, for the life of the database. They are
dormant only because `test_fault_config` is empty. The fail-closed guard protects the
moment of seeding; it does NOT protect against the triggers being left installed on a DB
that is later promoted, dumped/restored, or pointed at by something other than the
ephemeral CI stack. The defense is "don't seed prod," but the artifact left behind is a
live `RAISE EXCEPTION` trigger on the production-shaped `polls` table.

**Fix:** Either (a) wrap the entire fault-injection block in the same
`app.e2e_seed_allowed` check at *runtime inside the trigger* (cheap guard:
`IF current_setting('app.e2e_seed_allowed', true) IS DISTINCT FROM 'true' THEN RETURN NEW/OLD; END IF;`
as the first statement, so an accidentally-promoted trigger is inert without the GUC), or
(b) document and enforce a teardown that DROPs the triggers/functions/table at end of the
CI run. Option (a) is strongly preferred — it makes the trigger itself fail-safe rather
than relying on the table staying empty.

### WR-02: Fault-row `INSERT` results are never checked — a failed arm produces a misleading false-green/false-red

**File:** `e2e/integration/create-poll-results-hidden.test.ts:168-171, 229-234`
**Issue:**
The two fault tests insert into `test_fault_config` without inspecting the returned
`{ error }`:
```ts
await adminClients.serviceRole
  .from('test_fault_config')
  .insert({ fault_title: faultTitle, fail_operation: 'update' })
```
If this INSERT silently fails (RLS unexpectedly enabled, table renamed by a future seed
edit, PK/CHECK violation, transient error), the trigger never arms, the EF's UPDATE
succeeds, and `expect(result.status).toBe(500)` fails — but with a confusing message that
points at the EF rather than at the un-armed fault. Worse, if the status assertion were
ever loosened, an un-armed run would pass while testing nothing. Supabase-js does not
throw on DB errors; it returns them.

**Fix:** Capture and assert the insert error before invoking the EF:
```ts
const { error: armErr } = await adminClients.serviceRole
  .from('test_fault_config')
  .insert({ fault_title: faultTitle, fail_operation: 'update' })
expect(armErr).toBeNull()
```
Apply to both the FAULT-A single insert and the FAULT-B array insert.

### WR-03: `supabase start` failure is not fail-fast; readiness loop can mask a broken stack as a timeout

**File:** `.github/workflows/ci.yml:64, 135` (and the wait loops at 66-76, 137-153)
**Issue:**
`run: supabase start` has no explicit failure handling, and the subsequent "Wait for
stack ready" step polls `/rest/v1/` for 120s then `exit 1`. If `supabase start` partially
fails (e.g., one container crashes) the job will burn the full 120s and report a generic
"did not become ready" rather than surfacing the actual start error. The `supabase status
|| true` on failure swallows the status exit code. This is a debuggability defect that
will cost real time on a flaky-stack day.

**Fix:** The `supabase start` step already fails the job on a non-zero exit (default
bash `-e` behavior for `run:` single commands), which is fine — but the wait loop's
final diagnostics should not swallow errors. Replace `supabase status || true` with a
real dump (`supabase status` without `|| true`, or `docker ps -a` + container logs) so a
crashed container is visible. Optionally tee `supabase start` output to a log and upload
it on failure, mirroring the preview-log artifact pattern already present (lines 253-260).

### WR-04: `afterEach` ordering depends on an undocumented invariant; a delete-sentinel left armed by a *different* file would still poison cleanup

**File:** `e2e/integration/create-poll-results-hidden.test.ts:33-45`
**Issue:**
`afterEach` clears `test_fault_config` unconditionally first (good), then deletes the
poll. This file's own `try/finally` already disarms per-test, so the `afterEach` clear is
belt-and-suspenders for *this* file. But `vitest.config.integration.ts:24` sets
`fileParallelism: false` "as defense-in-depth," explicitly contemplating future
parallelism. Under parallelism, this `afterEach` does
`.delete().neq('fault_title', '')` — it wipes the ENTIRE shared `test_fault_config`
table, including sentinels a concurrent file legitimately armed. The comment frames this
as a safety feature, but it is actually cross-file interference waiting to happen the
moment `fileParallelism` is flipped back on. The title-scoping correctness argument does
NOT cover this global TRUNCATE-style delete.

**Fix:** Scope the `afterEach` clear to titles this file owns, or document that
`fileParallelism: false` is load-bearing (not merely defense-in-depth) for the
unconditional global delete. Minimal fix: track armed titles in the test and delete only
those, or filter by the file's title prefix (`[TEST-M5`). At minimum, correct the
`vitest.config.integration.ts:19-24` comment to state that serialization is *required*,
not optional, given this global-delete pattern.

### WR-05: Misleading workflow comments reference a CLI pin in `cron-sweep.yml` that does not exist

**File:** `.github/workflows/ci.yml:126-127`, `.github/workflows/deploy-edge-functions.yml:32` (referenced focus: "version pin consistency across the 4 Supabase CLI pins")
**Issue:**
`ci.yml:126-127` says the pin "matches Plan 05-07 deploy-edge-functions.yml and
cron-sweep.yml." `cron-sweep.yml` does **not** use `supabase/setup-cli` and has no
version pin at all — it invokes the function via plain `curl`. There are only **three**
Supabase CLI pins in the repo (ci.yml ×2 sites, deploy-edge-functions.yml ×1) plus the
`package.json` devDependency (`supabase: 2.102.0`), all consistent at `2.102.0`. The
review focus mentions "4 Supabase CLI pins"; the 4th (cron-sweep) does not exist as a CLI
pin. Not a runtime bug, but the comment will send a future maintainer hunting for a
nonexistent pin to keep in sync, and obscures that `package.json` is the actual 4th
version site to track.

**Fix:** Correct the comments to reference the real co-pinned sites: the two `ci.yml`
jobs, `deploy-edge-functions.yml`, and the `package.json` `supabase` devDependency.
Remove the `cron-sweep.yml` reference (it uses curl, no CLI). If keeping all four CLI
versions in lockstep matters, add a CI check comparing `setup-cli` versions against
`package.json`.

## Info

### IN-01: Deploy comment understates the Edge Function count

**File:** `.github/workflows/deploy-edge-functions.yml:33-34`
**Issue:** Comment says "deploy-all mode (all 15 EFs)". There are 16 deployable functions
under `supabase/functions/` (excluding `_shared`). The CLAUDE.md architecture notes also
say "16 functions at v1.0." Stale count.
**Fix:** Update to "all 16 EFs" or drop the explicit count to avoid future drift.

### IN-02: `::add-mask::` on the deterministic DB URL is partially ineffective

**File:** `.github/workflows/ci.yml:98, 190`
**Issue:** Masking the full `db_url` connection string only masks the exact full string;
if any later step logs a substring (host, port, or the `postgres:postgres` credential
alone) it will not be masked. The values are local-stack deterministic defaults so the
exposure is low, and the comment (186-190) acknowledges this. Noted for completeness.
**Fix:** No action required for local-only deterministic creds; if defense-in-depth is
desired, also `::add-mask::` the bare `postgres:postgres` credential fragment.

### IN-03: `fileParallelism: false` comment oversells "defense-in-depth"

**File:** `vitest.config.integration.ts:19-24`
**Issue:** The comment claims title-scoping "provides correctness even if parallelism is
later re-enabled; serialization is defense-in-depth." This is contradicted by the
global-delete pattern in WR-04 — serialization is currently load-bearing for the
unconditional `test_fault_config` wipe in `afterEach`. (Cross-reference WR-04.)
**Fix:** Soften the comment or fix the global delete so the claim becomes true.

### IN-04: `[auth]` redirect allow-list is minimal but correct for local-only

**File:** `supabase/config.toml:14-17`
**Issue:** `site_url` and `additional_redirect_urls` only cover `localhost:5173`. This is
correct for the local stack (E2E/integration run against localhost), and the Discord
provider block reads secrets from env. No defect — flagged only to confirm the auth
section was reviewed and found correct for its local-only scope. The `[auth.email]`
`enable_signup`/`enable_confirmations` settings are appropriately scoped local-only with a
clear WHY comment (24-32).
**Fix:** None.

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
