---
phase: 18-test-environment-repair
fixed_at: 2026-05-31T00:00:00Z
review_path: .planning/phases/18-test-environment-repair/18-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 7
skipped: 4
status: partial
---

# Phase 18: Code Review Fix Report

**Fixed at:** 2026-05-31
**Source review:** .planning/phases/18-test-environment-repair/18-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (6 warnings incl. WR-NEW-1, 5 info — fix_scope=all)
- Fixed: 7
- Skipped: 4

## Fixed Issues

### WR-NEW-1: Three EFs missing `verify_jwt=false` (local/prod fidelity gap)

**Files modified:** `supabase/config.toml`
**Commit:** 455e282
**Applied fix:** Added `[functions.submit-vote]`, `[functions.get-upload-url]`,
and `[functions.search-admin-targets]` blocks (each `verify_jwt = false`) so the
local `[functions.*]` override table now lists all 16 functions, matching the
deploy-time `--no-verify-jwt`. Preserved the existing WHY comment; did not touch
any pre-existing entry.

### WR-01: Fault arm-row INSERTs discard `{ error }`

**Files modified:** `e2e/integration/create-poll-results-hidden.test.ts`
**Commit:** 98cbfb3
**Applied fix:** Destructured `{ error: armErr }` from both fault-arm INSERTs
(single-row branch A and two-row branch B) and added `expect(armErr).toBeNull()`
so a silently-failed arm is reported as an arm failure rather than misattributed
to the EF when the later `toBe(500)` assertion fails.

### WR-02: `.single()` audit lookups feed non-null assertions; missing row throws raw TypeError + orphan-poll leak

**Files modified:** `e2e/integration/create-poll-results-hidden.test.ts`
**Commit:** 89c5d5a
**Applied fix:** Destructured `{ error: auditErr }` from both audit-log `.single()`
lookups and added `expect(auditErr).toBeNull()` + `expect(createdRow).not.toBeNull()`
before the `!` dereference, converting an opaque "Cannot read properties of null"
into a clear diagnostic. `createdPollId` is still assigned immediately on
resolution (branch B) so `afterEach` cleans up the deliberately-orphaned poll
rather than leaking it into the shared DB.

### WR-03: Wipe-all `afterEach` not title-scoped

**Files modified:** `e2e/integration/create-poll-results-hidden.test.ts`
**Commit:** 161baad
**Applied fix:** Replaced the wipe-all `.delete().neq('fault_title', '')` with a
title-scoped `.delete().like('fault_title', '[TEST-M5-FAULT-%')`. All fault titles
in this suite use the `[TEST-M5-FAULT-A]` / `[TEST-M5-FAULT-B]` prefix, so this
deletes exactly this suite's own arm rows and restores the documented invariant
that file serialization is defense-in-depth, not load-bearing. Verified safe:
only this file arms `test_fault_config` rows today, so no currently-passing test
relied on the cross-file wipe.

### WR-05: Stale CI cross-reference comments (nonexistent cron-sweep pin; "15 EFs")

**Files modified:** `.github/workflows/ci.yml`, `.github/workflows/deploy-edge-functions.yml`
**Commit:** 7c4d2ab
**Applied fix:** In `ci.yml`, dropped the "and cron-sweep.yml" reference (cron-sweep
uses curl and has no `setup-cli` step / version pin to sync). In
`deploy-edge-functions.yml`, replaced "all 15 EFs" with "every function under
supabase/functions/" (actual count is 16; future-proof phrasing avoids re-drift).

### IN-03: Undated `npm audit || true` non-blocking TODO

**Files modified:** `.github/workflows/ci.yml`
**Commit:** 1433d3a
**Applied fix:** Added an owner ("project maintainer") and a "review by 2026-07-01"
date to the `npm audit` promotion comment so the `|| true` swallow has an explicit
re-evaluation checkpoint instead of sitting non-blocking indefinitely.

### IN-04: Table-DROP vs function-REPLACE asymmetry unexplained

**Files modified:** `e2e/fixtures/seed.sql`
**Commit:** 27d1645
**Applied fix:** Added a clarifying comment block above the fault-config DDL: the
table is dropped+recreated (shape may change → DROP converges it) while the trigger
functions are CREATE OR REPLACE (signature stable). Explicitly warns against
"simplifying" the table to CREATE IF NOT EXISTS, which would reintroduce the
shape-drift the DROP prevents. This comment also covers IN-05 (the deliberate
post-DROP `TRUNCATE` belt-and-suspenders guard now has the surrounding rationale).

## Skipped Issues

### WR-04: Durable fault triggers gated only by an empty config table (no in-trigger GUC short-circuit)

**File:** `e2e/fixtures/seed.sql:206-242`
**Reason:** skipped — fix would break the currently-green fault suite and requires
the live integration stack to validate. The suggested fix adds
`IF current_setting('app.e2e_fault_enabled', true) IS DISTINCT FROM 'true' THEN
RETURN NEW/OLD; END IF;` as the first statement in both trigger functions. The
existing fault tests arm faults purely by INSERTing into `test_fault_config`; they
never set the `app.e2e_fault_enabled` GUC. With the short-circuit in place, the
trigger becomes a guaranteed no-op unless that GUC is set to 'true' — so the two
fault tests expecting HTTP 500 (branch A and branch B) would instead see the
trigger never fire and the EF return 200, turning the passing suite red. Making
this safe requires the `create-poll` edge runtime's DB connection (not the test's
service-role connection) to set the GUC, which cannot be done from the test and
needs the live stack to verify. Per the phase guidance ("if a fix risks the green
suite or requires running the live integration stack to validate, SKIP it"), this
is left for a future change that lands the GUC-plumbing on the EF connection side
together with this defense-in-depth.
**Original issue:** Both BEFORE triggers fire `FOR EACH ROW` on every poll
UPDATE/DELETE; their only dormancy guarantee is that `test_fault_config` is empty,
so a leaked arm row can silently fail an unrelated test. A GUC short-circuit would
make the fault path fail-closed even if the table shipped non-empty.

### IN-01: `submit-vote` rate-limit path never integration-tested

**File:** `e2e/integration/helpers.ts:199-273`
**Reason:** skipped — explicitly a follow-up, "out of scope for phase 18" per the
finding itself. It requests a NEW integration test for `submit-vote` (gated on
WR-NEW-1's config block, now landed) plus live Upstash Redis coverage. Writing a
new live-stack-dependent test is beyond a review-fix pass and cannot be validated
without the integration stack. Recommend a tracked follow-up now that the
`verify_jwt=false` block for `submit-vote` exists.
**Original issue:** `seedBaselineVote`/`castVote` bypass the `submit-vote` EF, so
the highest-risk anti-manipulation surface has zero integration coverage.

### IN-02: `[functions.*]` override table will silently drift from the deployed function set

**File:** `supabase/config.toml:41-78`
**Reason:** skipped — the finding labels the fix "Optional" and it requires building
NEW lint/test infrastructure (a check asserting every dir under
`supabase/functions/` minus `_shared` has a `verify_jwt = false` block). Creating
net-new tooling is a design judgment call outside the scope of correcting the
reviewed diff, and the immediate drift it guards against was just eliminated by
WR-NEW-1 (the table now lists all 16 functions). Recommend as an optional
follow-up if drift recurs.
**Original issue:** The override table is hand-maintained; the only drift signal is
a confusing local 401.

### IN-05: `TRUNCATE` after `DROP TABLE ... CREATE TABLE` is provably dead

**File:** `e2e/fixtures/seed.sql:202`
**Reason:** skipped — no action required. The finding states "None required; keep
with the IN-04 clarifying comment." The TRUNCATE is intentional belt-and-suspenders
dead code guarding against a future edit that swaps DROP back to CREATE IF NOT
EXISTS. The IN-04 fix (commit 27d1645) now documents that surrounding rationale, so
the intent is captured and the statement is correctly retained as-is.
**Original issue:** `TRUNCATE` immediately follows a `DROP TABLE ... CREATE TABLE`,
so it can never remove a row — harmless intentional guard.

---

_Fixed: 2026-05-31_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
