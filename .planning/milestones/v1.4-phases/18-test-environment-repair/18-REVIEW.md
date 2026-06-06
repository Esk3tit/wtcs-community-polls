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
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 18: Code Review Report (DEEP — re-review, --auto iteration 2)

**Reviewed:** 2026-05-31
**Depth:** deep
**Files Reviewed:** 7
**Status:** clean

## Summary

This is the iteration-2 re-review of phase 18 after a fixer applied 7 fixes
(commits `455e282`..`27d1645`) addressing the iteration-1 findings (0 BLOCKER /
5 WARNING / 5 INFO). All seven fix commits are present on HEAD. Each previously-open
fixable finding is confirmed resolved, and deep cross-file tracing finds **no new
defect introduced by the fix diffs**. Four findings were carried as intentional,
documented skips (WR-04, IN-01, IN-02, IN-05); per the re-review brief these are
accepted design decisions / out-of-scope items, not open defects, and are not
re-flagged here.

With every fixable Critical/Warning resolved and no regressions, the status is
**clean**.

### Verification of applied fixes

- **WR-NEW-1 (config.toml verify_jwt) — RESOLVED.** `supabase/config.toml` now
  carries 16 `[functions.*]` blocks, all `verify_jwt = false`. Verified the count
  matches the 16-function prod deploy set exactly: `ls supabase/functions | grep -v
  _shared | wc -l` = 16, `grep -c '\[functions\.' config.toml` = 16. The three
  previously-missing blocks (`submit-vote`, `get-upload-url`, `search-admin-targets`)
  are present at lines 80-87. The local override table now mirrors the deploy-time
  `--no-verify-jwt` (which is global), closing the local/prod fidelity gap. No
  duplicate or malformed blocks introduced.

- **WR-01 (arm-row INSERT error checks) — RESOLVED.** Both fault tests now
  destructure `{ error: armErr }` and `expect(armErr).toBeNull()`: branch A at
  lines 173-179, branch B at lines 244-252 (the latter inserts a 2-row array and
  asserts the single returned error). An arm failure now fails with a diagnostic
  pointing at the arm, not a misattributed EF-500 assertion.

- **WR-02 (audit `.single()` deref guards) — RESOLVED.** Both branches now capture
  `{ data: createdRow, error: auditErr }`, then `expect(auditErr).toBeNull()` +
  `expect(createdRow).not.toBeNull()` BEFORE the `createdRow!.target_id` deref
  (branch A lines 202-215, branch B lines 271-285). Critically, `createdPollId =
  actualPollId` is set immediately after the guards and before the downstream
  state assertions, so `afterEach`'s `cleanupPoll` always runs for the
  deliberately-orphaned poll in branch B even if a later `expect` throws. The
  orphaned-poll leak path identified in iteration 1 is closed.

- **WR-03 (afterEach wipe scoping) — RESOLVED, no regression.** The `afterEach`
  delete is now title-scoped: `.like('fault_title', '[TEST-M5-FAULT-%')`
  (lines 40-43) instead of the prior wipe-all `.neq('fault_title', '')`. Deep
  check of the LIKE semantics: SQL/PostgREST `LIKE` treats only `%` and `_` as
  wildcards; the leading `[` is a literal, so the pattern matches exactly the
  `[TEST-M5-FAULT-A]…` / `[TEST-M5-FAULT-B]…` titles this suite arms. **Coverage
  regression check:** every row this suite can ever insert uses the
  `[TEST-M5-FAULT-` prefix (verified — both `buildBody` fault titles are
  prefix-derived), and `grep` confirms no other integration file touches
  `test_fault_config`, so the narrower scope still cleans 100% of rows this suite
  can leak. The serialization invariant is now genuinely defense-in-depth rather
  than load-bearing, matching the `vitest.config.integration.ts` comment. No
  leaked-row survival path introduced.

- **WR-05 (stale CI comments) — RESOLVED.** `ci.yml:127-129` now correctly states
  cron-sweep.yml has no `setup-cli` step (uses curl) so there is nothing to sync,
  dropping the nonexistent-pin cross-reference. `deploy-edge-functions.yml:32-33`
  drops the hardcoded "15 EFs" and instead says "all/every function under
  supabase/functions/" — a self-correcting phrasing that cannot re-drift on the
  next function add.

- **IN-03 (undated npm-audit TODO) — RESOLVED.** `ci.yml:43-45` now carries
  "Owner: project maintainer; review by 2026-07-01."

- **IN-04 (DROP-vs-REPLACE asymmetry) — RESOLVED.** `seed.sql:189-197` documents
  why the table is DROP+CREATE (shape may change → converge) while trigger
  functions are CREATE OR REPLACE (stable signature), with an explicit warning not
  to "simplify" the table to `CREATE IF NOT EXISTS`.

### Intentional skips (accepted, not re-flagged as defects)

Per the re-review brief and `18-REVIEW-FIX.md`, the following are documented design
decisions / out-of-scope and are treated as accepted:
- **WR-04** — in-trigger GUC short-circuit deferred (would break the green fault
  suite, which arms via INSERT without setting the GUC; needs live EF-connection
  GUC plumbing). The triggers remain dormant-by-empty-table, guarded by
  `app.e2e_seed_allowed` against misdirected hosted apply.
- **IN-01** — net-new live `submit-vote` integration test, out of scope for phase 18.
- **IN-02** — optional lint/test asserting `[functions.*]` ↔ filesystem parity.
- **IN-05** — `TRUNCATE` after `DROP TABLE … CREATE TABLE` kept as deliberate
  belt-and-suspenders guard; self-classified "none required."

## Critical Issues

None.

## Warnings

None. All five iteration-1 warnings (WR-NEW-1, WR-01, WR-02, WR-03, WR-05) are
confirmed resolved; WR-04 is an accepted documented skip.

## Info

None open. IN-03 and IN-04 resolved; IN-01, IN-02, IN-05 are accepted skips.

### New-regression scan (fix diffs)

Traced each fix diff for introduced defects — none found:
- config.toml: 16/16 blocks, no duplicate keys, no malformed TOML.
- Test file: the new error guards short-circuit before any deref; `createdPollId`
  is assigned before downstream assertions so cleanup is never skipped; branch-A
  `finally` disarms by exact title before the scoped `afterEach` runs, so no
  double-delete hazard and `cleanupPoll`'s DELETE never trips the (already
  disarmed) delete trigger.
- `.like()` pattern: bracket is a LIKE literal, matches the intended titles only.
- ci.yml / deploy-edge-functions.yml: comment-only edits, no behavioral change.

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
