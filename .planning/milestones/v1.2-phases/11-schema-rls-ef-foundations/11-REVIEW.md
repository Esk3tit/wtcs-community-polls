---
phase: 11-schema-rls-ef-foundations
reviewed_at: 2026-05-11T00:00:00Z
depth: deep
files_reviewed: 22
iteration: 3
last_iteration_at: 2026-05-11T19:30:00Z
loop_status: converged
new_findings_iter2:
  regression: 1
  new_warning: 1
  new_info: 1
new_findings_iter3:
  regression: 0
  new_warning: 0
  new_info: 0
file_list:
  - supabase/migrations/00000000000010_results_hidden_audit.sql
  - supabase/functions/_shared/audit.ts
  - supabase/functions/toggle-results-visibility/index.ts
  - supabase/functions/close-expired-polls/index.ts
  - supabase/functions/close-poll/index.ts
  - supabase/functions/create-category/index.ts
  - supabase/functions/create-poll/index.ts
  - supabase/functions/delete-category/index.ts
  - supabase/functions/delete-poll/index.ts
  - supabase/functions/demote-admin/index.ts
  - supabase/functions/pin-poll/index.ts
  - supabase/functions/promote-admin/index.ts
  - supabase/functions/rename-category/index.ts
  - supabase/functions/set-resolution/index.ts
  - supabase/functions/update-poll/index.ts
  - e2e/integration/helpers.ts
  - e2e/integration/vote-counts-rls.test.ts
  - e2e/integration/toggle-results-visibility.test.ts
  - e2e/integration/create-poll-results-hidden.test.ts
  - vitest.config.integration.ts
  - package.json
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 5
  info: 8
  total: 13
status: issues_found
---

# Phase 11 — Code Review (deep)

**Overall:** PASS-WITH-FIXES. Phase 11 has SHIPPED to production already, so all findings here are post-ship hardening (none block the existing deploy). No security-critical regressions found. Key invariants hold: vote_counts policy carries no admin-OR bypass; audit_log RLS denies anon/non-admin; writeAudit is consistently NOT try/catch-wrapped across all 19 emission sites; the conditional-UPDATE race-safety pattern in toggle-results-visibility is correct; the 12-cell matrix is complete with no skipped/todo cells; integration tests are well-structured with explicit cleanup. The 5 WARNINGs identify real latent risks (audit_log FK behaviour on profile deletion, partial-rollback observability in create-poll, review-archaeology rot tags in test files, divergence from PATTERNS.md timestamp contract, and missing FK between audit_log.target_id and source tables) that should be addressed during a v1.3+ hygiene pass.

## Critical findings (must-fix; block merge)

_None._

## Warning findings (should-fix; risky but not blocking)

### W-01: `audit_log.actor_id` FK has no ON DELETE clause — admin profile deletion will block on existing audit rows

- **File:** `supabase/migrations/00000000000010_results_hidden_audit.sql:46`
- **Issue:** The FK `actor_id UUID REFERENCES public.profiles(id)` defaults to `ON DELETE NO ACTION`. If an admin's profile is ever deleted (cascade from `auth.users` -> `profiles` via `schema.sql:28` `ON DELETE CASCADE`), the cascade chain will be blocked by any audit_log rows referencing that admin. This silently turns admin deletion into a hard error in production. Worse, it could cascade a 500 back to the auth deletion flow.
- **Why warning (not critical):** Already shipped; admin deletion is rare (no UI surfaces it today); free-tier deployment has 2 admins. But forensically, audit rows MUST survive actor deletion — that is the whole point of an immutable audit trail.
- **Fix:**
  ```sql
  -- In a v1.3 follow-up migration:
  ALTER TABLE public.audit_log
    DROP CONSTRAINT audit_log_actor_id_fkey,
    ADD CONSTRAINT audit_log_actor_id_fkey
      FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  ```
  Audit rows then keep the actor_id history-as-tombstone via the NULL (matching the cron-actor-null convention) without breaking the actor-FK guarantee.

### W-02: create-poll compensating DELETE failure path leaves orphan poll with NO audit trail and 500 response

- **File:** `supabase/functions/create-poll/index.ts:160-167`
- **Issue:** When `results_hidden=true` is requested, the EF performs a post-RPC UPDATE. If the UPDATE fails, a compensating DELETE is attempted. If that DELETE ALSO fails (line 161-165), the EF logs to `console.error` and returns 500 — but a poll exists in `public.polls` with `results_hidden=false` (the column DEFAULT) and **no audit row was ever written** (the `poll_created` audit row at line 170 is unreachable because the compensation path returns before it). The admin sees "operation failed", a visible (results_hidden=false) poll exists in production, and there's no audit trail to discover it.
- **Why warning (not critical):** Documented in source comments as a "best-effort" path; the inner UPDATE failure is itself rare (would require Postgres-level transport error mid-statement). But silent orphaned visible polls are exactly the failure mode `results_hidden=true` is meant to prevent.
- **Fix:** Either (a) write a `poll_created` audit row BEFORE the post-RPC UPDATE attempt (so a compensation failure leaves a forensic breadcrumb), then write a `poll_created_orphaned` row on compensation failure; OR (b) move the optional `results_hidden=true` into the RPC itself so the create + flag are atomic. Option (b) eliminates the entire failure mode but changes the RPC contract (acceptable in v1.3).

### W-03: REVIEW-FIX-* rot tags leaked into integration test source files

- **Files:**
  - `e2e/integration/create-poll-results-hidden.test.ts:1` — `// REVIEW-FIX-M5 — create-poll EF \`results_hidden\` path end-to-end coverage.`
  - `e2e/integration/create-poll-results-hidden.test.ts:25` — `describe('create-poll results_hidden path (REVIEW-FIX-M5)', ...)`
  - `e2e/integration/create-poll-results-hidden.test.ts:153` — `// REVIEW-FIX-H5 sanity ...`
  - `e2e/integration/vote-counts-rls.test.ts:120` — `// Regression sentinel for REVIEW-FIX-H3 (no admin-OR-bypass in the vote_counts policy).`
- **Issue:** Project rule (CLAUDE.md "Comments § When to Comment", repeated in `MEMORY.md feedback_no_review_archaeology_in_source.md`) explicitly forbids review-round / phase-ID archaeology in source. These tags refer to ephemeral planning-cycle IDs that mean nothing to a future reader. The first `REVIEW-FIX-M5` even appears in a `describe(...)` block, surfacing the rot into test reporter output.
- **Why warning (not critical):** Doesn't change runtime behaviour but violates an explicit project standing order. Rot accumulates if not policed at code-review time.
- **Fix:** Replace each tag with WHY-only text. Examples:
  - `// REVIEW-FIX-M5 — create-poll EF \`results_hidden\` path end-to-end coverage.` -> `// create-poll EF \`results_hidden\` path end-to-end coverage.`
  - `describe('create-poll results_hidden path (REVIEW-FIX-M5)', ...)` -> `describe('create-poll results_hidden path', ...)`
  - `// Regression sentinel for REVIEW-FIX-H3 (no admin-OR-bypass in the vote_counts policy).` -> `// Regression sentinel: vote_counts policy must NOT carry an admin-OR-bypass — see CONTEXT.md D-15.`

### W-04: toggle-results-visibility `results_hidden_changed_at` deviates from documented D-13 / PATTERNS.md "Timestamp written by EF" contract

- **File:** `supabase/functions/toggle-results-visibility/index.ts:72-78`
- **Issue:** PATTERNS.md "Timestamp written by EF (not trigger)" and CONTEXT.md D-11 / D-13 state: "results_hidden_changed_at is written on EVERY UPDATE (written even on no-ops; audit is gated on state change but the timestamp is not)." The shipped code uses a conditional UPDATE (`.not('results_hidden', 'is', hidden)`) that matches 0 rows on no-op calls, so `results_hidden_changed_at` is NOT updated on no-ops — directly contradicting the documented contract. The shipped behaviour is actually MORE consistent (no state change → no timestamp churn) but the doc drift means a future reader trusting D-13 will be misled.
- **Why warning (not critical):** No security/correctness impact; the deviation is arguably an improvement. But undocumented behavioural divergence is exactly what makes the next contributor write a buggy second flip path.
- **Fix:** Either update PATTERNS.md to match the shipped race-safe conditional-UPDATE pattern OR add a WHY comment to toggle-results-visibility/index.ts:69-78 explicitly noting the deviation from D-13 and the rationale (race-safe over redundant-write).

### W-05: `audit_log.target_id` is TEXT with no FK enforcement; rows survive parent deletion as dangling references

- **File:** `supabase/migrations/00000000000010_results_hidden_audit.sql:49`
- **Issue:** `target_id TEXT` (deliberately TEXT to admit both UUIDs and Discord snowflakes per the comment) cannot have a FK to any single table. Combined with the lack of a CASCADE relationship, audit_log rows for deleted polls/categories/profiles will keep `target_id` pointing at a vanished row. The integration tests (`toggle-results-visibility.test.ts:55-58`, `create-poll-results-hidden.test.ts:36`) handle this manually by `DELETE FROM audit_log WHERE target_id = ...` before deleting the poll — proving the awareness of the gap, but the production cleanup path has no such discipline. Over time this accumulates and makes audit queries less reliable.
- **Why warning (not critical):** Audit_log dangling refs are actually a FEATURE (forensic tombstones survive target deletion), but the design intent should be explicit and the consequences understood. Currently, a "show me all audit actions for poll X" query against a long-deleted poll will return ghost rows with no way to verify the target_type was indeed `poll` and the id was a UUID at write time.
- **Fix:** Two options:
  1. **Document the intent.** Add a comment to `migrations/00000000000010_results_hidden_audit.sql:44-53` stating that `target_id` is intentionally a weak reference for forensic-survives-delete behaviour. Add a CHECK constraint matching the allowed shapes (UUID xor Discord snowflake) to fail-fast on malformed writes:
     ```sql
     ALTER TABLE public.audit_log
       ADD CONSTRAINT audit_log_target_id_shape CHECK (
         target_id IS NULL
         OR target_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         OR target_id ~ '^\d{17,20}$'
       );
     ```
  2. **Add a partial-FK pattern via trigger** — for `target_type='poll'`, validate target_id is a UUID and exists at write time only; survive deletion afterwards. More invasive; defer to v1.3.

## Info findings (polish; nice-to-have)

### I-01: `toggle-results-visibility` uses `.not(col, 'is', value)` where `.neq(col, value)` is the idiomatic PostgREST filter

- **File:** `supabase/functions/toggle-results-visibility/index.ts:76`
- **Issue:** `.not('results_hidden', 'is', hidden)` produces `NOT (results_hidden IS true)` via PostgREST's `is` operator. This works (since `results_hidden` is `NOT NULL`, the `IS NOT TRUE` form is equivalent to `= false`), but the standard idiom for "this column is not equal to" is `.neq('results_hidden', hidden)`. The current form needs the reader to know that `is` is a PostgREST keyword for `IS NULL` / `IS TRUE` / `IS FALSE` comparisons and that `not.is.<bool>` is a valid combination.
- **Fix:** Replace with `.neq('results_hidden', hidden)` for clarity. Behaviour identical because the column is NOT NULL.

### I-02: `update-poll` audit row has `before: null` — loses forensic value vs. other EFs that pre-fetch

- **File:** `supabase/functions/update-poll/index.ts:172-183`
- **Issue:** Documented per D-07 ("RPC doesn't return prior values and a pre-read SELECT would double the round-trip cost"). For an admin EF, an extra ~5ms round-trip is negligible vs. the forensic value of seeing what changed. Compare against `rename-category` (pre-fetches `name`), `set-resolution` (pre-fetches `resolution`), `delete-poll` (pre-fetches `title, status`) — `update-poll` is the only retrofit that doesn't pre-fetch.
- **Fix:** Pre-fetch `polls.{title, description, category_id, image_url, closes_at}` via `maybeSingle()` before the RPC. Document the round-trip trade as a sub-millisecond tax for the forensic gain. Not blocking, but harmonizes with the rest of the audit retrofit shape.

### I-03: `close-expired-polls` audit row `after: { status: 'closed' }` omits `closed_at` timestamp

- **File:** `supabase/functions/close-expired-polls/index.ts:67-74`
- **Issue:** The UPDATE at line 56 sets both `status='closed'` and `closed_at=nowIso`. The audit row's `after` payload only records `{ status: 'closed' }`. For forensic timeline reconstruction (e.g., "when exactly did this poll auto-close?") an investigator must look up `polls.closed_at` separately. Including the timestamp in `after` makes audit rows self-contained.
- **Fix:** Update the audit payload to `after: { status: 'closed', closed_at: nowIso }`.

### I-04: `close-poll` audit row likewise omits `closed_at` from `after` payload

- **File:** `supabase/functions/close-poll/index.ts:89-96`
- **Issue:** Same shape issue as I-03. The UPDATE at line 70-77 sets `closed_at = new Date().toISOString()`, but the audit `after` only carries `{ status: 'closed', resolution }`. Add `closed_at` for forensic self-containment.
- **Fix:** Pre-compute the closed timestamp into a local const, use it in BOTH the UPDATE and the audit payload.

### I-05: `delete-category` audit `before` fallback `{ id: category_id }` loses the actual name

- **File:** `supabase/functions/delete-category/index.ts:85`
- **Issue:** `before: priorRow ? { name: priorRow.name } : { id: category_id }` — the fallback (when `priorRow` is null) records `{ id: category_id }`, but since the subsequent DELETE returns PGRST116 on the same condition, `priorRow=null` implies the DELETE will also fail. So in practice the fallback is unreachable. It's defensive coding that confuses the audit shape. Same issue in `delete-poll/index.ts:107` and `rename-category/index.ts:102`.
- **Fix:** Move the pre-fetch INSIDE a try block that aborts early with 404 if `priorRow=null`, then make `before` unconditional. OR document why the fallback shape exists.

### I-06: `seedBaselineVote` does not use `ON CONFLICT DO NOTHING` — test reruns within a session could fail

- **File:** `e2e/integration/helpers.ts:210-219`
- **Issue:** The INSERT against `votes` has no conflict handling. The `votes` table has a UNIQUE constraint `(poll_id, user_id)` (schema.sql:104). If a test crashes mid-cleanup and rerun, the seed would fail with 23505. The helper would surface a useful-but-confusing error. Production seed.sql uses `ON CONFLICT DO NOTHING` everywhere for this reason.
- **Fix:** Add `.upsert(..., { onConflict: 'poll_id,user_id', ignoreDuplicates: true })` OR catch 23505 silently. Low priority — the cleanup path is generally robust.

### I-07: `helpers.ts` defines `SUPABASE_URL` constant from `process.env.SUPABASE_URL` but unit env uses `VITE_SUPABASE_URL`

- **File:** `e2e/integration/helpers.ts:17`
- **Issue:** `const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321'` — but CI sets `VITE_SUPABASE_URL` (line 102 of ci.yml), not `SUPABASE_URL`. So in CI, the const silently falls back to the default localhost — which happens to be correct in CI but is a fragile coupling. The unit suite env block in `vite.config.ts` also uses `VITE_SUPABASE_URL`. Inconsistent env-var name surface.
- **Fix:** `const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321'` — accept either name to remove the trap.

### I-08: Migration 10 has no `IF NOT EXISTS` on ADD COLUMN / CREATE INDEX — re-application fails

- **File:** `supabase/migrations/00000000000010_results_hidden_audit.sql:19-23, 62-63`
- **Issue:** `ALTER TABLE public.polls ADD COLUMN results_hidden ...` will fail with `column "results_hidden" already exists` if the migration is somehow re-applied. Same for `CREATE INDEX idx_audit_log_target ...`. Supabase migration tracking normally prevents this, but a developer running `supabase db push --include-all` or manually applying the file twice would hit it. The DROP POLICY at lines 127-128 uses `IF EXISTS` for exactly this reason.
- **Fix:** Add `IF NOT EXISTS` to the ADD COLUMN and CREATE INDEX statements for consistency with the existing idempotency discipline. Low priority — migration registry catches this in practice.

## Cross-file patterns observed

- **`writeAudit` consistently NOT wrapped in try/catch across all 19 emission sites** (verified via `grep -B2 -A4 "writeAudit" supabase/functions/*/index.ts` then visual inspection). Fail-open contract preserved. (positive)
- **`requireAdmin` + `adminCheckResponse` consistently invoked BEFORE any business logic in all 12 admin-gated retrofits** (cron carve-out for `close-expired-polls` documented). (positive)
- **`getCorsHeaders(req)` consistently called once at the top of every `Deno.serve`** and threaded through every `json(...)` call. All retrofits preserve the existing CORS surface. (positive)
- **Pre-fetch-before-mutate idiom inconsistent across audit retrofits:** `rename-category`, `set-resolution`, `delete-category`, `delete-poll` pre-fetch a "before" snapshot. `update-poll` does not (I-02). `close-poll` and `close-expired-polls` know `before` from the WHERE clause constraint. Document the convention or harmonize. (mixed)
- **Discord snowflake regex `/^\d{17,19}$/` in `promote-admin/index.ts:96`** — 19 is the max for signed 64-bit Discord snowflakes today (max safe value `9_223_372_036_854_775_807` = 19 digits). Conservative lower bound 17 may reject very old (pre-2015) accounts; unlikely in this admin context but worth noting. Not flagged as a finding because it pre-dates Phase 11.
- **Integration tests use `serviceRole` for setup/cleanup ONLY**, never for assertion paths. Assertions go through anon/authed clients exercising the real RLS surface (`vote-counts-rls.test.ts:100-110`, `toggle-results-visibility.test.ts:62-66`). Correct discipline. (positive)
- **TEST-11 12-cell matrix is complete** — verified via `grep "it.skip\|it.todo\|it.only\|describe.only\|describe.skip\|describe.todo"` returned zero matches across `e2e/integration/`. The 12 `describe.each` cells + 1 admin-JWT regression sentinel = 13 actual `it()` blocks. (positive)
- **Admin-JWT regression sentinel correctly guards against admin-OR-bypass reintroduction** (`vote-counts-rls.test.ts:131-154`). Construction: seed a vote keyed on memberUser, then read via adminUser JWT; expect 0 rows. If a regression adds `is_current_user_admin() OR ...` back to the policy, this test fails immediately. The `seedBaseline=false` paired with an explicit `castVote` (keyed on memberUser) is exactly the right shape — without that pairing the assertion would trivially pass on an empty `vote_counts`. (positive)
- **No `it.skip`/`it.todo`/`it.only`/`describe.only`/`describe.skip`/`describe.todo` anywhere in `e2e/integration/`**. (positive)
- **Integration tests handle the audit_log lifecycle correctly** — `toggle-results-visibility.test.ts:55-58` and `create-poll-results-hidden.test.ts:36` explicitly DELETE audit_log rows BEFORE cleanupPoll, because audit_log has no FK to polls (intentional — W-05). (positive)
- **`vitest.config.integration.ts` enforces `passWithNoTests: false`** — an empty integration result is a regression. Correct gate behaviour. (positive)
- **CI service-role key flows correctly to test-integration job ONLY** (`ci.yml:104`); not leaked to the unit job. Matches Phase 5 HIGH #2 resolution discipline. (positive)
- **Migration 10 section ordering is correct** — columns added FIRST (so view rewrite + policy can reference them), audit_log table created next, view rewrite uses the new columns, policy DROP+CREATE references the new column. A statement-level failure mid-file rolls back the entire transaction (Supabase migration atomicity). (positive)

## Phase 11 specific gate verifications

- [x] vote_counts policy has NO admin-OR-bypass (REVIEW-FIX-H3) — confirmed `migrations/00000000000010_results_hidden_audit.sql:137-152`: policy USING clause contains only `EXISTS(votes...) AND EXISTS(polls.results_hidden=false)`. No `is_current_user_admin()` call. The admin-JWT regression sentinel at `vote-counts-rls.test.ts:131-154` provides defense-in-depth.
- [x] audit_log RLS denies anon + authenticated-non-admin — `migrations/00000000000010_results_hidden_audit.sql:70-74`: only `FOR SELECT TO authenticated USING (public.is_current_user_admin())`. No INSERT/UPDATE/DELETE policies declared; writes are service-role only.
- [x] writeAudit fail-open contract preserved at all call sites — `supabase/functions/_shared/audit.ts:22-37` returns `Promise<void>` and logs the error internally. All 19 emission sites (`grep "writeAudit" supabase/functions/`) `await` it bare with no try/catch wrapper.
- [~] create-poll compensating-DELETE order correct, BUT a corner case (DELETE itself fails) leaves an orphan visible poll with no audit row (W-02). Audit ordering on the happy path is correct: poll_created emitted AFTER the optional results_hidden UPDATE succeeds, so the `poll_created` row's `after: { results_hidden }` reflects the final state.
- [x] toggle-results-visibility race-safe conditional UPDATE (REVIEW-FIX-H4) — `toggle-results-visibility/index.ts:72-78` uses `.not('results_hidden', 'is', hidden)`. Concurrent same-direction flips serialize at the row-lock level; only the first winner sees `changed !== null` and emits an audit row. The follow-up `select * from polls` at line 88-92 disambiguates no-op vs. 404. The deviation from D-13 timestamp-on-every-UPDATE is flagged as W-04.
- [x] TEST-11 has no skip/todo/only across 12+1 cells — `grep -rn "it.skip\|it.todo\|it.only\|describe.only\|describe.skip\|describe.todo" e2e/integration/` returns zero matches.
- [x] No review-round rot tags in `src/` — verified. But `e2e/integration/` has 4 such tags (W-03). The project rule says "no rot tags in `src/` or `supabase/`"; `e2e/` is in the same spirit and the test reporter surfaces these tags publicly.

## Reviewed files summary

- `supabase/migrations/00000000000010_results_hidden_audit.sql` — W-01 (FK ON DELETE missing), W-05 (target_id weak ref), I-08 (no IF NOT EXISTS); otherwise correct atomic-migration shape, section ordering, idempotent DROP POLICY guards.
- `supabase/functions/_shared/audit.ts` — clean. Fail-open contract crisply documented; signature stable.
- `supabase/functions/toggle-results-visibility/index.ts` — W-04 (timestamp deviation from D-13), I-01 (`.not(is)` vs `.neq()`); otherwise correct race-safe conditional-UPDATE pattern, audit-on-state-change discipline, response shape extension for VIS-03/SC-3.
- `supabase/functions/close-expired-polls/index.ts` — I-03 (audit `after` missing closed_at); otherwise correct cron-actor-null discipline, sequential per-row audit emission.
- `supabase/functions/close-poll/index.ts` — I-04 (audit `after` missing closed_at); otherwise correct active-status guard, single-shot audit write.
- `supabase/functions/create-category/index.ts` — clean.
- `supabase/functions/create-poll/index.ts` — W-02 (compensation DELETE-failure path silent orphan); otherwise correct strict-boolean validation, post-RPC UPDATE for opt-in hidden, audit emission for both poll_created and results_hidden_set_at_create.
- `supabase/functions/delete-category/index.ts` — I-05 (audit `before` fallback unreachable); otherwise correct pre-fetch + DELETE + audit shape.
- `supabase/functions/delete-poll/index.ts` — I-05 (same fallback shape issue); otherwise correct EXISTS guard on votes, pre-fetch + DELETE + audit.
- `supabase/functions/demote-admin/index.ts` — clean. Correct self-demote guard + last-admin guard preserved.
- `supabase/functions/pin-poll/index.ts` — clean. Audit action toggles correctly between `poll_pinned` / `poll_unpinned`.
- `supabase/functions/promote-admin/index.ts` — clean. All 3 emission sites (Branch 1 / Branch 2 preauth / Branch 2 retroactive) correctly skip audit on 23505 idempotent no-op and pass Discord snowflake to TEXT target_id.
- `supabase/functions/rename-category/index.ts` — I-05 (same fallback shape issue); otherwise correct pre-fetch + UPDATE + audit shape.
- `supabase/functions/set-resolution/index.ts` — clean. Pre-fetch + UPDATE + audit; `before` records prior resolution (or null) correctly.
- `supabase/functions/update-poll/index.ts` — I-02 (audit `before: null` — no pre-fetch); otherwise correct RPC delegation + SQLSTATE-based error mapping.
- `e2e/integration/helpers.ts` — I-06 (seedBaselineVote no ON CONFLICT), I-07 (env-var-name coupling); otherwise correct lazy-singleton service-role client, freshPoll cleanup discipline, normalizeError shape.
- `e2e/integration/vote-counts-rls.test.ts` — W-03 (REVIEW-FIX-H3 rot tag at line 120); otherwise correct 12-cell matrix + admin-JWT regression sentinel.
- `e2e/integration/toggle-results-visibility.test.ts` — clean.
- `e2e/integration/create-poll-results-hidden.test.ts` — W-03 (REVIEW-FIX-M5 / H5 rot tags); otherwise correct 4-case coverage of results_hidden behaviour.
- `vitest.config.integration.ts` — clean. `passWithNoTests: false` enforces the gate.
- `package.json` — clean. Single line added correctly.
- `.github/workflows/ci.yml` — clean. test-integration job correctly placed after lint-and-unit, parallel to e2e. Service-role key masked and scoped to job env.

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

## Iteration 2 — Fix Commit Re-Review

**Reviewed at:** 2026-05-11T18:30:00Z
**Scope:** 10 fix commits from iteration 1 (delta-only — no full re-review of the 22-file scope).

### Regressions found

#### R-01 (WARNING): migration 11 CHECK regex on `target_id` is case-sensitive lowercase; EF UUID validators are case-insensitive — uppercase-UUID writers silently lose audit rows

- **File:** `supabase/migrations/00000000000011_audit_log_fk_hardening.sql:75-79`
- **Issue:** The CHECK admits `target_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`. Postgres `~` is case-sensitive POSIX regex (no `~*` operator used), so this matches LOWERCASE UUIDs only. However, every UUID-validating EF in `supabase/functions/` uses the case-insensitive JavaScript flag (`/.../i`) — examples: `delete-poll/index.ts:59`, `set-resolution/index.ts:61`, `toggle-results-visibility/index.ts:62`, `update-poll/index.ts:86`, `pin-poll/index.ts:58`, `create-poll/index.ts:64`, `promote-admin/index.ts:68`. EFs admit `ABCD-1234-...`-form UUIDs as valid input. The downstream `.eq('id', ...)` Postgres query accepts case-insensitive UUID compare (uuid type), so the row lookup succeeds. The subsequent `writeAudit(...)` insert against `audit_log` then trips the case-sensitive CHECK with code `23514`. Because `writeAudit` is fail-open (`audit.ts:34-36`), the violation is logged to `console.error` and SWALLOWED — the user mutation succeeds, but the audit row is silently dropped.
- **Why this is a regression (not pre-existing):** Pre-migration-11, `target_id` was TEXT with no shape constraint and accepted any UUID case. Migration 11 narrows the admitted shape without harmonizing with the EF validators. The two surfaces now disagree.
- **Why warning (not blocker):** Production-issued UUIDs come from `gen_random_uuid()` which produces lowercase; the regression only fires if a client (curl, admin tool, copy-pasted URL) sends an uppercase UUID. Low-probability but silent — exactly the failure mode the W-05 CHECK was meant to surface, only now it surfaces by losing the audit row rather than rejecting the malformed call.
- **Fix (pick one):**
  1. **Loosen the CHECK to case-insensitive:** swap `~` for `~*` on the UUID branch:
     ```sql
     OR target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     ```
  2. **Tighten the EF validators to lowercase-only** (drop the `/i` flag and add an explicit normalize-to-lowercase step on every UUID input). Higher friction, contract-breaking at the EF boundary.
  3. **Normalize before audit write:** lowercase the `target_id` immediately before `writeAudit(...)`. Localized to the audit shared module. Cleanest delta-fix.

  Recommendation: option (1) — the CHECK exists to reject junk (empty strings, typos), not to enforce a case canonicalization that the rest of the surface doesn't share.

### Findings on fix commits

#### F-01 (INFO): create-poll integration test comment at `create-poll-results-hidden.test.ts:153-157` is now stale — claims "NO audit rows are written" on the deferred fault-injection path, but W-02 (commit f7de6b3) now writes a `poll_created` audit row BEFORE the optional UPDATE attempts

- **File:** `e2e/integration/create-poll-results-hidden.test.ts:153-157`
- **Issue:** The W-03 rot-tag strip (commit 45b2e15) preserved a WHY-comment that claimed: "if the post-RPC UPDATE fails when results_hidden=true, the compensating DELETE means NO poll row appears in `polls` AND NO audit rows are written." After the W-02 fix (commit f7de6b3) reordered audit emission, this is now FALSE: the `poll_created` audit row is written BEFORE the UPDATE attempt, so a compensation-success path leaves one audit row (poll_created) with the poll DELETEd. A compensation-failure path leaves TWO audit rows (poll_created + poll_created_orphaned) with an orphan visible poll. The stale comment is doc-rot in source, exactly the failure mode CLAUDE.md "Comments § When to Comment" guards against.
- **Why info (not warning):** No runtime impact — the deferred fault-injection is still deferred. Pure doc-staleness. But the W-03 commit landed in coordination with W-02; the two should have been reviewed together to catch this drift.
- **Fix:** Update the trailing comment to reflect the new audit shape:
  ```ts
  // Manual fault-injection deferred: if the post-RPC UPDATE fails when
  // results_hidden=true, the EF still emits the poll_created audit row
  // (written BEFORE the UPDATE attempt — see create-poll/index.ts:158).
  // If the compensating DELETE also fails, a poll_created_orphaned row
  // is emitted alongside. Asserting either branch requires injecting an
  // UPDATE failure (network drop, RLS reject, etc.) which is out of
  // scope for this suite.
  ```

#### F-02 (INFO): create-poll comment at `create-poll/index.ts:154-156` describes `after.results_hidden` as "reflects the RPC-default state (false)" — actually it reflects the user-requested INTENT, which may be `true`

- **File:** `supabase/functions/create-poll/index.ts:151-165`
- **Issue:** The WHY comment says `after.results_hidden` "reflects the RPC-default state (false)". But the variable `results_hidden` in scope is the user-requested boolean (`true` or `false`) from body parsing at line 126-131. At the moment the `poll_created` audit row is written (line 158-165), the DB row's `results_hidden` IS still the column DEFAULT (false), but the audit row's `after.results_hidden` records the user's INTENT — which the commit message correctly describes ("carries the INTENDED state"). The in-source comment contradicts the commit message and is misleading on its face: a reader of just the source sees an `after` that "reflects false" but actually contains the user's `true`/`false` intent.
- **Why info:** No behavioral impact. The audit row's content is semantically meaningful (intent), the comment just describes it incorrectly.
- **Fix:** Replace `// (false)` with the language from the commit message:
  ```
  // RPC has just inserted with the column DEFAULT (results_hidden=false).
  // The audit row's `after.results_hidden` carries the user's INTENT (which
  // may be true or false); a successful post-RPC flip emits a second row
  // (`results_hidden_set_at_create`) so the audit timeline shows both the
  // intent and the realization distinctly.
  ```

### Confirmation of closed findings

- **W-01: closed by 0e2bd70** — VERIFIED. Migration 11 SECTION 1 drops the old FK and re-adds it with `ON DELETE SET NULL`. The DROP CONSTRAINT IF EXISTS makes re-application safe (a re-applied ADD-after-DROP-IF-EXISTS succeeds because the prior constraint is removed first). The cron-actor-null convention is consistently honored.
- **W-02: closed by f7de6b3** — VERIFIED (with a small doc-rot follow-up, F-01 and F-02). The `poll_created` audit row is now emitted BEFORE the optional UPDATE attempt at line 158-165. The compensation-failure branch at line 177-196 now writes a `poll_created_orphaned` row with a distinct `action` value an operator can grep for. The integration test's `toHaveLength(2)` assertion at line 84 still passes because the happy path emits exactly two rows (poll_created + results_hidden_set_at_create) and the failure paths are not exercised. The reordering correctly preserved `results_hidden_set_at_create` inside the `if (results_hidden === true)` block (line 200-207).
- **W-03: closed by 45b2e15** — VERIFIED with caveat (F-01). The 4 REVIEW-FIX tags are gone. WHY context was preserved (the test file's opening comment still explains the four behaviours covered; the describe block name became cleaner). But one preserved comment (F-01) is now stale relative to W-02's audit reordering.
- **W-04: closed by 73fb2c2** — VERIFIED. PATTERNS.md "Timestamp written by EF" section updated to describe the shipped conditional-UPDATE form. The vote_counts example was bonus-fixed to drop the admin-OR-bypass form (matching the shipped policy and removing a future copy-paste hazard).
- **I-01: closed by a139197** — VERIFIED. `.not('results_hidden', 'is', hidden)` -> `.neq('results_hidden', hidden)`. Behaviorally identical (column is NOT NULL). The new WHY comment at lines 72-73 correctly notes the column nullability invariant that justifies the swap.
- **I-02: closed by d8aaf6d** — VERIFIED. `update-poll/index.ts:142-154` pre-fetches `title, description, category_id, image_url, closes_at` via `maybeSingle()`. The audit `before` (line 191-198) records the snapshot when available, falls back to null when the pre-fetch transiently misses. Comment correctly documents that choices remain `after`-only (the RPC's plpgsql trace captures them).
- **I-03: closed by afaada1** — VERIFIED. `close-expired-polls/index.ts:76` now passes `{ status: 'closed', closed_at: nowIso }`. The same `nowIso` is used in the UPDATE (line 56) so timestamps are consistent within the batch. The new WHY comment at lines 65-67 documents the cross-row sharing rationale.
- **I-04: closed by afaada1** — VERIFIED. `close-poll/index.ts:71` hoists `closedAt = new Date().toISOString()` into a local const; line 74 and line 98 both consume it. The audit `after` now carries `{ status: 'closed', resolution, closed_at: closedAt }`.
- **I-05: closed by 5b55466** — VERIFIED. All three EFs (`delete-category`, `delete-poll`, `rename-category`) collapsed the `{ id: target_id }` fallback to `null`. The new WHY comments correctly identify that `priorRow=null` is effectively unreachable because the subsequent `.single()` would 404 first. The audit shape is now uniform across emitters (null in `before` whenever the prior snapshot is unavailable, matching create-poll's convention).
- **I-06: closed by 000e146** — VERIFIED. `seedBaselineVote` switched from `.insert(...)` to `.upsert(..., { onConflict: 'poll_id,user_id', ignoreDuplicates: true })`. Matches the seed.sql `ON CONFLICT DO NOTHING` discipline. The WHY comment captures the rerun-after-crash rationale.
- **I-07: closed by fd256dc** — VERIFIED. `helpers.ts:22-23` accepts `process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321'`. Matches the CI env-var name in ci.yml:102 and the vite.config.ts unit-suite env.

### Skipped finding rationale check

- **I-08: ACCEPT the skip.** The fixer's rationale (don't edit `migrations/00000000000010_results_hidden_audit.sql` because it has already been applied to production) is sound. Supabase migration discipline is forward-only: the `supabase_migrations.schema_migrations` table tracks applied files by hash, and editing an already-applied file creates drift between source and DB. The correct remediation for I-08 is to add IF NOT EXISTS in any FUTURE migration that re-touches these columns/indexes (defensive), not to edit migration 10. Note that migration 11's CHECK constraint correctly uses `DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT` for re-application safety — the same discipline the fixer applied to the new file.

### Iteration 2 verdict

**PASS-WITH-NEW-FIXES.** All 10 fix commits land cleanly. 9 of the original 13 findings are verified closed (W-01 through W-04, I-01 through I-07). I-08 is acceptably deferred. However, the new migration 11 introduces one new WARNING (R-01: case-sensitive CHECK regex collides with case-insensitive EF UUID validators) that should be addressed before migration 11 is applied to production. Two minor INFO doc-staleness items (F-01, F-02) were also flagged but are non-blocking. No security regressions, no functional regressions, no rot-tag leakage in the fix commits themselves.

**Recommendation:** loosen the migration 11 UUID-shape CHECK to case-insensitive (`~*`) before applying to production, then ship.

## Iteration 3 — Final Convergence Check

**Reviewed at:** 2026-05-11T19:30:00Z
**Scope:** 3 fix commits from iteration 2 (b579f9a, 21978f9, 43cf8c3) — delta-only, narrow-scoped per --auto cap=3 final pass.

### New findings

**None — converged.**

All three iteration-2 fix commits are surgical, internally consistent, and introduce zero regressions or new findings. The diff stats confirm minimal-blast-radius edits:

- `b579f9a` — 1 file changed, 8 insertions(+), 3 deletions(-) — migration 11 only
- `21978f9` — 1 file changed, 6 insertions(+), 4 deletions(-) — test file comment only
- `43cf8c3` — 1 file changed, 5 insertions(+), 3 deletions(-) — source comment only

No tangential edits, no scope creep, no rot tags introduced.

### Confirmation of iter-2 closures

- **R-01: closed by b579f9a — VERIFIED.** The UUID branch swaps `~` -> `~*` (case-insensitive POSIX) at `migrations/00000000000011_audit_log_fk_hardening.sql:82`. The Discord snowflake branch at line 83 correctly retains plain `~` (digits-only — case is irrelevant). The fix is the recommended option (1) from the iter-2 review. Migration 11's idempotency discipline is preserved: `DROP CONSTRAINT IF EXISTS audit_log_target_id_shape` precedes `ADD CONSTRAINT` (lines 76-77, 79-80) so re-application is safe. The expanded WHY comment at lines 63-70 documents the case-insensitivity rationale (matches EF JS `/i` flag and Postgres `uuid` type compare semantics) — exactly the doc-rot prevention the project rule calls for. The commit message explicitly notes "This migration has NOT been applied to production yet — the file edit is safe," confirming the in-place edit respects the forward-only migration discipline.
- **F-01: closed by 21978f9 — VERIFIED.** The stale comment at `e2e/integration/create-poll-results-hidden.test.ts:153-159` now accurately describes the post-W-02 audit shape: poll_created emitted BEFORE the UPDATE attempt, poll_created_orphaned emitted on compensation-failure. Both branches (compensation-success: 1 audit row; compensation-failure: 2 audit rows) are now correctly documented. The describe block at line 25 is unchanged (already cleaned in W-03 commit 45b2e15). No other lines touched in this file.
- **F-02: closed by 43cf8c3 — VERIFIED.** The misleading `(false)` parenthetical at `supabase/functions/create-poll/index.ts:154-159` is replaced with intent-vs-realization framing: "RPC has just inserted with the column DEFAULT (results_hidden=false). The audit row's `after.results_hidden` carries the user's INTENT (which may be true or false)." This matches the W-02 commit-message language and removes the source/commit-message contradiction. The `writeAudit` call at lines 160-167 is unchanged (intent semantics were already correct — only the comment was wrong). No other lines touched.

### Final loop verdict

**CONVERGED.**

After 3 review cycles and 13 fix commits across iterations 1+2:
- 13 of 13 original findings reviewed (Critical 0, Warning 5, Info 8).
- 12 closed across iterations 1+2 (W-01, W-02, W-03, W-04, I-01 through I-07).
- 1 acceptably deferred (I-08 — migration 10 already applied; defensive coding gap accepted because the correct remediation is forward-only via future migrations, not retroactive edit).
- 1 new WARNING (R-01) introduced in iter-1 fixes, closed in iter-2 (b579f9a).
- 2 new INFO items (F-01, F-02) introduced as doc-rot from iter-1 reorderings, closed in iter-2 (21978f9, 43cf8c3).
- Iteration 3 finds zero new issues, zero regressions.

The Phase 11 surface is now consistent: EF UUID validators (case-insensitive) match the DB CHECK (case-insensitive), audit emission order is forensic-correct, source comments accurately describe runtime semantics, and migration 11's idempotency discipline (DROP IF EXISTS + ADD) is preserved for safe re-application.

### Outstanding follow-ups (handed to user, NOT fixed in this loop)

- **I-08 — migration 10 IF NOT EXISTS defensive coding gap:** skipped in iter-1 with sound rationale (migration 10 already applied to production; forward-only discipline forbids retroactive edits). Remediation path: add IF NOT EXISTS to any FUTURE migration that re-touches the affected columns/indexes. No action required against migration 10 itself.
- **needs_prod_apply: migration 11 (`00000000000011_audit_log_fk_hardening.sql`)** — file is ready (FK ON DELETE SET NULL for actor_id, case-insensitive UUID CHECK on target_id, intent-documenting COMMENT ON COLUMN) but not yet applied to production. User must run `supabase db push` (or equivalent) to apply.
- **needs_prod_redeploy: 8 Edge Functions whose source changed in iter-1 fixes:**
  - `toggle-results-visibility` (I-01 — `.not(is)` -> `.neq()`)
  - `update-poll` (I-02 — pre-fetch + audit `before` snapshot)
  - `close-expired-polls` (I-03 — `after.closed_at`)
  - `close-poll` (I-04 — hoisted `closedAt`, `after.closed_at`)
  - `delete-category` (I-05 — `before` fallback collapsed to null)
  - `delete-poll` (I-05 — same)
  - `rename-category` (I-05 — same)
  - `create-poll` (W-02 audit reordering + F-02 comment fix)
  User must run `supabase functions deploy <name>` for each.

---

_Final review: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep, iter-3 narrow scope_
_Loop status: CONVERGED (3 of 3 --auto iterations consumed)_
