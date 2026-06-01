---
phase: 18-test-environment-repair
reviewed: 2026-05-31T00:00:00Z
depth: deep
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
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 18: Code Review Report (DEEP)

**Reviewed:** 2026-05-31
**Depth:** deep
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 18 repairs the integration test environment: it bumps the Supabase CLI pin
2.92.1/2.98.2 → 2.102.0 across all three workflows and `package.json`, adds the
`[auth.email]` block to `config.toml` (so `signInWithPassword` works for fixture
users), hardens both CI psql seed steps with `-v ON_ERROR_STOP=1`, adds an in-file
`\set ON_ERROR_STOP on` guard to `e2e/fixtures/seed.sql`, and introduces the
title-scoped fault-injection infrastructure (table + two BEFORE triggers on
`public.polls`) plus six new test cases in `create-poll-results-hidden.test.ts`.

Cross-file tracing confirms the core call chains are sound: the integration suite
invokes only `create-poll` and `toggle-results-visibility` (verified by grepping
`name:` across all three `e2e/integration/*.test.ts` files), **both of which carry
`verify_jwt = false` in `config.toml`**. The 500-status assertions in the fault
tests correctly map to the create-poll EF contract (post-RPC UPDATE failure →
compensating DELETE → HTTP 500, verified against `supabase/functions/create-poll/index.ts`).
The CI `ON_ERROR_STOP` fail-closed path is now genuinely fail-closed on both the
in-file `\set` and the psql `-v` flag.

**No BLOCKERs.** The prior CR-01 (the three EFs lacking `verify_jwt=false`) is
**downgraded** — see WR-NEW-1 below. The real defects are test-reliability and
shared-DB-state hazards introduced by the new fault infrastructure, plus stale
cross-reference comments that phase 18 edited around without correcting.

## Critical Issues

None.

The prior review's CR-01 does not survive deep analysis. See WR-NEW-1.

## Warnings

### WR-NEW-1: CR-01 downgraded — three EFs missing `verify_jwt=false` is a latent fidelity gap, not a false-green cause

**File:** `supabase/config.toml:41-78`
**Issue:** `submit-vote`, `get-upload-url`, and `search-admin-targets` have no
`[functions.<name>]` block with `verify_jwt = false`. The prior review flagged this
as a BLOCKER (false-green risk). Deep cross-file tracing refutes the BLOCKER
severity on two independent grounds:
1. **Not exercised.** Grepping `name:` across all three integration test files shows
   the suite invokes only `create-poll` and `toggle-results-visibility`. Votes are
   seeded directly via the service-role client (`helpers.ts` `seedBaselineVote` /
   `castVote`), never through `submit-vote`. `get-upload-url` and
   `search-admin-targets` are invoked by neither the integration nor the smoke suite.
2. **Not modified by phase 18.** `git diff e12bee9..HEAD -- supabase/config.toml`
   shows phase 18 added only the `[auth.email]` block; the `[functions.*]` table is
   untouched. This is a pre-existing latent gap, not a regression this phase introduced.

It is still a **real local/prod fidelity gap**: the moment anyone writes an
integration test that invokes `submit-vote` (the rate-limited, highest-risk EF) via
a user JWT, the local edge runtime will reject the ES256 token with 401 *before the
EF runs*, producing a confusing false-red. Worth fixing for completeness, but it is
a WARNING, not a BLOCKER, and not the cause of any current false-green.
**Fix:** Add the three missing blocks so the local override table matches the
deploy-time `--no-verify-jwt` (which already covers all 16 functions):
```toml
[functions.submit-vote]
verify_jwt = false

[functions.get-upload-url]
verify_jwt = false

[functions.search-admin-targets]
verify_jwt = false
```

### WR-01: Fault arm-row INSERTs discard `{ error }`, masking arm failures as EF-behavior failures

**File:** `e2e/integration/create-poll-results-hidden.test.ts:168-170, 229-234`
**Issue:** Both fault tests insert the arm row(s) without checking the returned
`error`:
```ts
await adminClients.serviceRole
  .from('test_fault_config')
  .insert({ fault_title: faultTitle, fail_operation: 'update' })
// no destructure, no error check
```
If the INSERT silently fails (RLS re-enabled by a future migration, CHECK-constraint
drift on `fail_operation`, PK collision, or `test_fault_config` simply absent because
the fixture seed step was skipped), the trigger never fires, `create-poll` returns
200 instead of 500, and the test fails at `expect(result.status).toBe(500)` — but
with a symptom ("EF didn't fail") that points the debugger at the EF, not at the
real cause (the arm never happened). A false-red that wastes investigation time, and
in the symmetric case where the EF *coincidentally* 500s for another reason, a
false-green. Every other service-role call in this suite checks its error; these two
are the exceptions.
**Fix:** Destructure and assert:
```ts
const { error: armErr } = await adminClients.serviceRole
  .from('test_fault_config')
  .insert({ fault_title: faultTitle, fail_operation: 'update' })
expect(armErr).toBeNull()
```

### WR-02: `.single()` audit lookups feed non-null assertions; a missing row throws a raw TypeError instead of a clear assertion

**File:** `e2e/integration/create-poll-results-hidden.test.ts:193-200, 253-260`
**Issue:** Both fault tests resolve the poll id via an audit-log `.single()` whose
`error` is discarded, then immediately apply `!`:
```ts
const { data: createdRow } = await adminClients.serviceRole
  .from('audit_log')
  .select('target_id')
  .eq('action', 'poll_created')
  .eq('after->>title', faultTitle)
  .gte('created_at', startedAt)
  .single()
const actualPollId = createdRow!.target_id as string
```
If `create-poll` returned 500 *before* writing the `poll_created` audit row (e.g., the
RPC itself failed, not the post-RPC UPDATE — the EF returns 500 at index.ts:148
before any audit write), `createdRow` is `null` and `createdRow!.target_id` throws
`Cannot read properties of null`. That surfaces as an opaque TypeError, not as the
diagnostic "expected a poll_created audit row, found none." It also means
`createdPollId` is never set, so `afterEach`'s `cleanupPoll` is skipped and the
orphaned poll (branch B) leaks into the shared DB.
**Fix:** Check the error and the row before dereferencing:
```ts
const { data: createdRow, error: auditErr } = await adminClients.serviceRole...single()
expect(auditErr).toBeNull()
expect(createdRow).not.toBeNull()
const actualPollId = createdRow!.target_id as string
```

### WR-03: Wipe-all `afterEach` on the shared `test_fault_config` makes `fileParallelism: false` load-bearing for correctness, not just defense-in-depth

**File:** `e2e/integration/create-poll-results-hidden.test.ts:38` and
`vitest.config.integration.ts:24`
**Issue:** The `afterEach` unconditionally deletes **every** row in the shared
`test_fault_config` table:
```ts
await adminClients.serviceRole.from('test_fault_config').delete().neq('fault_title', '')
```
The seed comment and the vitest config both describe title-scoping as the correctness
mechanism and serialization as mere "defense-in-depth" (`vitest.config.integration.ts:19-24`).
But this wipe-all is **not** title-scoped: it deletes arm rows belonging to any other
file too. Deep tracing confirms only `create-poll-results-hidden.test.ts` arms faults
today (the other two integration files never touch `test_fault_config`), so the
hazard is dormant. However, the moment a second file arms a fault row and
`fileParallelism` is re-enabled (the config comment explicitly anticipates this:
"Title-scoping provides correctness even if parallelism is later re-enabled"), a
`create-poll` `afterEach` firing mid-flight in file A will delete file B's armed
sentinel and silently disarm B's fault — a false-green. The stated invariant
("serialization is defense-in-depth") is false: serialization is currently
**load-bearing** for this wipe-all.
**Fix:** Scope the cleanup delete to this file's own titles, consistent with the
title-scoped design — e.g. delete only rows whose `fault_title` matches the suite's
`[TEST-M5-FAULT-` prefix:
```ts
await adminClients.serviceRole
  .from('test_fault_config')
  .delete()
  .like('fault_title', '[TEST-M5-FAULT-%')
```
Or document in `vitest.config.integration.ts` that serialization is **required**, not
defense-in-depth, and remove the misleading "even if parallelism is later re-enabled"
claim.

### WR-04: Durable fault triggers on `public.polls` are gated only by an empty config table — every integration poll UPDATE/DELETE now runs an EXISTS subquery, and the safety rests entirely on the table staying empty

**File:** `e2e/fixtures/seed.sql:206-242`
**Issue:** The two BEFORE triggers are unconditionally attached to `public.polls` and
fire `FOR EACH ROW` on every UPDATE and DELETE for all roles. Their only dormancy
guarantee is that `test_fault_config` is empty. Deep tracing shows the blast radius:
`toggle-results-visibility.test.ts` UPDATEs polls and `vote-counts-rls.test.ts` +
both helpers DELETE polls via `cleanupPoll` — so every poll mutation in the entire
integration suite now passes through `fault_inject_polls_before_update/delete` and
executes `SELECT 1 FROM public.test_fault_config`. If any test leaks an arm row
(see WR-01/WR-02 leak paths, or a crash between INSERT and the `finally` disarm), a
**different, unrelated** test that happens to mutate a poll with the same title is
silently failed. The triggers are also durable schema objects living in the same DB
as the dev seed; only the `app.e2e_seed_allowed` guard at the top of the file keeps
them out of a misdirected hosted apply. A defense-in-depth in-trigger GUC check
would make the fault path fail-closed even if the table somehow shipped non-empty.
**Fix:** Add a GUC short-circuit as the first statement in both trigger functions so
an empty/absent GUC makes the trigger a guaranteed no-op regardless of table contents:
```sql
IF current_setting('app.e2e_fault_enabled', true) IS DISTINCT FROM 'true' THEN
  RETURN NEW; -- (RETURN OLD in the delete trigger)
END IF;
```

### WR-05: ci.yml cross-reference comment cites a cron-sweep.yml CLI pin that does not exist; deploy-edge-functions.yml comment says "15 EFs" but there are 16

**File:** `.github/workflows/ci.yml:126-127` and
`.github/workflows/deploy-edge-functions.yml:33`
**Issue:** Two stale cross-references in files phase 18 edited (the CLI version on the
adjacent line was bumped, so these comments were in the diff's blast radius and not
corrected):
1. `ci.yml:126-127` — "Supabase CLI pinned to exact version (matches Plan 05-07
   deploy-edge-functions.yml **and cron-sweep.yml**)." Confirmed via grep:
   `cron-sweep.yml` uses `curl` to hit the close-expired-polls endpoint and contains
   **no `supabase/setup-cli` step and no version pin at all**. The cross-reference is
   to a pin that does not exist, so a future maintainer "keeping them in sync" has
   nothing to sync.
2. `deploy-edge-functions.yml:33` — "No function-name arg = deploy-all mode (all 15
   EFs)." `ls supabase/functions/ | grep -v _shared | wc -l` = **16**. The count drifted
   when a function was added without updating the comment.

These are pre-existing comment-rot items (git blame: April 19-20, before e12bee9),
but they live on lines adjacent to phase-18 edits and are actively misleading.
**Fix:** In `ci.yml`, drop "and cron-sweep.yml" (cron-sweep has no CLI step), leaving
the deploy-edge-functions.yml reference. In `deploy-edge-functions.yml`, change "15
EFs" to "16 EFs" (or, better, "all functions under supabase/functions/" to avoid
re-drifting).

## Info

### IN-01: `submit-vote` rate-limit + service-role write path is documented but never integration-tested

**File:** `e2e/integration/helpers.ts:199-273`
**Issue:** `seedBaselineVote`/`castVote` insert into `votes` directly via service-role,
explicitly bypassing the `submit-vote` EF "to avoid coupling every test to that EF's
rate-limit + validation surface." Reasonable for setup, but it means the one EF with
an external dependency (Upstash Redis sliding window) and the project's core
anti-manipulation guarantee has zero integration coverage. Combined with WR-NEW-1
(no local `verify_jwt=false`), submit-vote is the least-tested high-risk surface.
**Fix:** Track a follow-up to add a `submit-vote` integration test once WR-NEW-1's
config block lands; out of scope for phase 18.

### IN-02: `[functions.*]` override table will silently drift from the deployed function set

**File:** `supabase/config.toml:41-78`
**Issue:** The override table is a hand-maintained list of 13 of 16 functions
(see WR-NEW-1). There is no check that it stays in sync with `supabase/functions/`.
The deploy workflow uses `--no-verify-jwt` globally, so prod is fine; only the local
stack depends on this list, and the only signal of drift is a confusing local 401.
**Fix:** Optional — a lint/test asserting every dir under `supabase/functions/`
(minus `_shared`) has a `verify_jwt = false` block would make drift fail loud.

### IN-03: `npm audit --audit-level=high || true` non-fail-fast is undated

**File:** `.github/workflows/ci.yml:46, 75, 152`
**Issue:** Three `|| true` swallows. The `npm audit` one is documented as
"promotable to blocking once the launch-week advisory noise floor is understood" but
has no date/owner, so it will sit non-blocking indefinitely. The two `supabase status
|| true` calls are diagnostic-only inside a step that then `exit 1`s, so they are
benign (the `|| true` only prevents the diagnostic itself from masking the real
exit-1). Acceptable as-is; flagging only the undated audit TODO.
**Fix:** Add an owner/date or tracking issue to the `npm audit` promotion comment.

### IN-04: Fault-injection trigger functions are `CREATE OR REPLACE` but the table is `DROP TABLE ... CREATE`, an asymmetry worth a one-line note

**File:** `e2e/fixtures/seed.sql:192-242`
**Issue:** The table is `DROP TABLE IF EXISTS ... CREATE TABLE` (described as
"convergent re-seed") while the trigger *functions* are `CREATE OR REPLACE` and the
triggers are `DROP TRIGGER IF EXISTS ... CREATE`. The mix is correct (functions can be
replaced in place; the table is dropped to converge its shape), but the asymmetry
isn't explained and a future editor might "simplify" the table to `CREATE IF NOT
EXISTS` and reintroduce the shape-drift the DROP exists to prevent.
**Fix:** One-line comment: table is dropped (shape may change across runs); functions
are replaced (signature stable).

### IN-05: `TRUNCATE` after `DROP TABLE ... CREATE TABLE` is provably dead

**File:** `e2e/fixtures/seed.sql:202`
**Issue:** `TRUNCATE public.test_fault_config` immediately follows a `DROP TABLE IF
EXISTS ... CREATE TABLE`, so the table is guaranteed empty when TRUNCATE runs — the
statement can never remove a row. The inline comment acknowledges this is deliberate
"belt-and-suspenders" against a future edit that swaps DROP back to `CREATE IF NOT
EXISTS`. Harmless dead code kept intentionally as a guard; noted for completeness.
**Fix:** None required; keep with the IN-04 clarifying comment, or remove if the DROP
is considered permanent.

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
