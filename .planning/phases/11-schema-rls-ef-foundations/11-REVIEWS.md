---
phase: 11
review_cycle: 3
reviewers: [gemini, codex]
reviewed_at: 2026-05-11T22:30:00Z
plans_reviewed:
  - 11-00-PLAN.md
  - 11-01-PLAN.md
  - 11-02-PLAN.md
  - 11-03-PLAN.md
  - 11-03b-PLAN.md
  - 11-04-PLAN.md
  - 11-05-PLAN.md
attempted_but_skipped:
  - claude (self — running inside Claude Code CLI; skipped for independence)
  - coderabbit (no working-tree diff available; reviews git diff, not plan markdown)
  - cursor (account hit usage limit on invocation — same as cycles 1 and 2)
  - opencode (not installed)
  - qwen (not installed)
revisions_under_review: commit afc7875 (7 REVIEW-FIX-C2-* markers addressing the 7 cycle-2 HIGHs)
cycle_1_high_count: 6
cycle_2_high_count: 7
cycle_3_high_count: 1
cycle_3_new_high_count: 1
cycle_2_highs_fully_resolved: 7
cycle_2_highs_partially_resolved: 0
cycle_2_highs_unresolved: 0
---

# Cross-AI Plan Review — Phase 11 (Cycle 3)

Cycle 3 reviews the planner's revisions (commit `afc7875`) that incorporated the 7 cycle-2 HIGH-severity concerns flagged by Codex. The plans now carry 7 `REVIEW-FIX-C2-*` markers — one per cycle-2 HIGH — and the fixes are grounded against verifiable live-source line numbers in the repo (`supabase/migrations/00000000000000_schema.sql:86` for `choices.label`; `supabase/functions/create-poll/index.ts:135` for the `{success, id}` response shape; `supabase/functions/create-poll/index.ts:86-97` for `choices: string[]` validation; `supabase/functions/promote-admin/index.ts` for the two-branch retrofit shape).

Both reviewers converged on the same verdict this cycle: the 7 cycle-2 HIGHs are FULLY RESOLVED — the interface mismatches that defeated the cycle-2 plans are now correctly aligned with the live repo. However, both reviewers also independently surfaced **one new HIGH-severity concern** introduced by the REVIEW-FIX-C2-H2 fix itself: the new `promote-admin` two-branch audit retrofit attempts to write a Discord snowflake into `audit_log.target_id`, but Plan 01 declares that column as `uuid` — a type mismatch that the live schema (`admin_discord_ids.discord_id TEXT PRIMARY KEY` at `supabase/migrations/00000000000000_schema.sql:16`) confirms is a real runtime failure mode.

---

## Gemini Review

This Cycle 3 review verifies that the planner has successfully addressed all 7 HIGH-severity concerns from Cycle 2 by grounding the implementation plans in the live repository. The revisions in `afc7875` (adding `REVIEW-FIX-C2-*` markers) demonstrate high fidelity to the actual database schema and Edge Function contracts.

### Cycle-2 HIGH Verification Table

| Concern ID | Status | Evidence |
|:---|:---|:---|
| **11-00 HIGH (H1)** | **RESOLVED** | `11-00-PLAN.md` (H1) and `e2e/integration/helpers.ts` use the `label` column for `choices` (matching `00...schema.sql:86`). |
| **11-03 HIGH (H2)** | **RESOLVED** | `11-03-PLAN.md` (H2) specifies a two-branch retrofit for `promote-admin` (profile-target and Discord-ID-target with retroactive flip). |
| **11-03b HIGH (H3)** | **RESOLVED** | `11-03b-PLAN.md` (H3) preserves the `{success, id}` response shape (matching `create-poll/index.ts:135`). |
| **11-03b HIGH (H4)** | **RESOLVED** | `11-03b-PLAN.md` (H4) correctly treats `choices` as `string[]` (matching `create-poll/index.ts:86-97`). |
| **11-04 HIGH (H5)** | **RESOLVED** | `11-04-PLAN.md` (H5) correctly seeds a vote by `memberUser` for the admin-JWT RLS sanity test, creating a true regression sentinel. |
| **11-04 HIGH (H6)** | **RESOLVED** | `11-04-PLAN.md` (H6) aligns integration tests with the `string[]` and `.id` contracts. |
| **11-05 HIGH (H7)** | **RESOLVED** | `11-05-PLAN.md` (H7) aligns smoke `curl` payloads and `jq` parsing with the live contracts. |

### New HIGH-Severity Concerns

1. **11-01 / 11-03 NEW HIGH: Type Mismatch for `audit_log.target_id`**
   - **Description:** `11-01-PLAN.md` (D-02) defines `audit_log.target_id` as type `uuid`. However, `11-03-PLAN.md` (promote-admin Branch 2) attempts to insert a Discord Snowflake (typically `text` or `bigint`) into this column for the `admin_preauthorized` action. This will cause a database error at runtime because a Discord ID is not a valid UUID.
   - **Impact:** Admin promotion by Discord ID (pre-authorization) will fail to execute because the audit log write will crash the Edge Function or the DB transaction.
   - **Recommendation:** Change `audit_log.target_id` to type `text` in Migration 10 to accommodate both UUIDs and Discord Snowflakes, or explicitly leave `target_id` NULL for Discord-target actions and store the snowflake only in the `after` JSONB payload.

### New MEDIUM-Severity Concerns

1. **11-01 NEW MEDIUM: Missing `ON DELETE SET NULL` on `actor_id`**
   - **Description:** The `audit_log.actor_id` foreign key (referencing `profiles(id)`) does not specify an `ON DELETE` clause. By default, this will prevent a profile from being deleted if any audit rows reference it. While profile deletion is rare, append-only logs should ideally not block record management.
   - **Recommendation:** Add `ON DELETE SET NULL` to the `actor_id` column definition in Migration 10.

### New LOW-Severity Concerns

1. **11-03 NEW LOW: Omission of `before` state in `update-poll` audit**
   - **Description:** `11-03-PLAN.md` notes that `update-poll` will have `before: null` if the RPC doesn't return prior values. This reduces the forensic utility of the log for poll edits compared to toggles.
   - **Recommendation:** This is acceptable given the RPC constraints, but should be noted as a "best-effort" audit depth.

### Overall Phase Risk Assessment

**MEDIUM** (Reduced from HIGH in Cycle 2). The interface alignment is now excellent, but the `target_id` UUID constraint is a logic-breaking mismatch that must be fixed before execution.

### Ready for Execution

**NO.** The `audit_log.target_id` type mismatch in Migration 10 will break the `promote-admin` Edge Function. Once `target_id` is changed to `text` or the audit payload is adjusted, the phase will be ready.

### Suggested Action

Apply a targeted fix to `11-01-PLAN.md` (Migration 10) changing `target_id uuid` to `target_id text`. This ensures the foundation can support the full audit surface planned in `11-03`.

---

## Codex Review

I re-reviewed the plans against the live repo, focusing on whether the 7 cycle-2 HIGHs were resolved and whether the revisions introduced new HIGHs. Net: cycle-2 cluster fixed; one new HIGH emerges from REVIEW-FIX-C2-H2's `target_id` choice colliding with Plan 01's `audit_log.target_id uuid` declaration.

### 11-00

**Summary** — The helper plan now matches the live `choices` schema.

**Strengths**
- `choices.label` is correctly used; live schema confirms `label TEXT NOT NULL` at `supabase/migrations/00000000000000_schema.sql:86`.
- Baseline vote seeding and two-choice setup address the prior empty-`vote_counts` test gap.
- Partial setup cleanup is now specified.

**Concerns**
- None HIGH.

**Suggestions**
- Keep the acceptance grep forbidding `text: 'option-*'`.

**Risk Assessment** — LOW

### 11-01

**Summary** — Migration plan is mostly sound and correctly preserves the strict service-role-only bypass model for `vote_counts`.

**Strengths**
- `audit_log.target_id` is explicitly `uuid`, which is important for later review.
- Drops both legacy `vote_counts` policies before creating the new one.
- Re-applies `security_invoker = on` after the view rewrite.

**Concerns**
- MEDIUM: `audit_log.actor_id` lacks `ON DELETE SET NULL`; future profile deletion could be blocked.

**Suggestions**
- Consider `actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL`.

**Risk Assessment** — LOW-MEDIUM

### 11-02

**Summary** — The toggle EF plan's executable instructions are race-safe, but stale narrative remains.

**Strengths**
- Conditional update replaces the prior read-then-update race.
- No-op path returns 200 without writing an audit row.
- 404 vs no-op distinguished via a follow-up SELECT.

**Concerns**
- LOW: Some narrative still references the prior "pre-read" / "timestamp on every UPDATE" design; the conditional UPDATE supersedes both. The executable instructions are correct.

**Suggestions**
- Clean up the stale narrative for executor clarity.

**Risk Assessment** — LOW

### 11-03

**Summary** — Two-branch `promote-admin` retrofit matches the live EF, but the `admin_preauthorized` row's `target_id` choice collides with Plan 01's `audit_log.target_id uuid` type.

**Strengths**
- Branch 1 (`target_user_id`) emits one `admin_promoted` row keyed on the profile UUID — type-compatible with `audit_log.target_id uuid`.
- Branch 2 retroactive flip iterates `promotedProfiles` and emits one `admin_promoted` per row — type-compatible.
- 23505 idempotency guard correctly skips the `admin_preauthorized` row on the already-pre-authorized no-op path.

**Concerns**
- HIGH: Plan 03 writes `target_id: target_discord_id` for `admin_preauthorized`, but Plan 01 defines `audit_log.target_id uuid`, while `admin_discord_ids.discord_id` is `TEXT` at `supabase/migrations/00000000000000_schema.sql:16`. A Discord snowflake (17–19 digit string) cannot insert into a UUID column. Because `writeAudit` never throws, the EF would return success while silently losing the `admin_preauthorized` audit row.
- MEDIUM: "exactly one audit call per state-changing path" frontmatter language conflicts with Branch 2's `1 + N` audit rows.

**Suggestions**
- Option A: change Plan 01's `audit_log.target_id` to `text` (accommodates both UUIDs and snowflakes).
- Option B: for `admin_preauthorized`, set `target_id: null` and store `{ discord_id: target_discord_id }` in `after` only (preserves the uuid column type).
- Option C: leave `target_id: target_discord_id::uuid` is NOT a solution — snowflakes are 17–19 digit numbers, not valid UUIDs.
- Add a runtime/integration or deploy smoke assertion for the pre-auth branch (currently no test exercises this branch end-to-end).

**Risk Assessment** — HIGH

### 11-03b

**Summary** — The create-poll contract mismatches are corrected against live source.

**Strengths**
- Live `choices` validation is `string[]` at `supabase/functions/create-poll/index.ts:86`.
- Live success response is `{ success: true, id: pollId }` at `supabase/functions/create-poll/index.ts:135`.
- Plan preserves RPC signature and adds post-RPC hidden update with compensation.

**Concerns**
- MEDIUM: The plan does not explicitly say to add `results_hidden?: unknown` to the local `body` type, although the current typed body lacks it at `supabase/functions/create-poll/index.ts:38`.

**Suggestions**
- Add the body type update explicitly in Step 2 acceptance.

**Risk Assessment** — MEDIUM

### 11-04

**Summary** — The TEST-11/TEST-12 and create-poll hidden tests now align with live contracts, with one stale behavior block.

**Strengths**
- Admin-JWT sentinel now seeds a `memberUser` vote before admin reads, so it is a real admin-OR regression detector.
- `create-poll-results-hidden` test sends `choices: ['option-a', 'option-b']` and reads `result.data.id`.
- Acceptance criteria forbid `result.data.poll.*`.

**Concerns**
- LOW: Task 04-03 behavior bullets still say `response.poll.results_hidden`; the action and acceptance criteria correctly override this.

**Suggestions**
- Remove those stale behavior bullets to avoid executor confusion.

**Risk Assessment** — LOW-MEDIUM

### 11-05

**Summary** — Deployment smoke is corrected for the live create-poll contract.

**Strengths**
- Smoke payload uses `"choices":["option-a","option-b"]`.
- Smoke parses `.id`, not `.poll.id`.
- Local gate correctly avoids `supabase db push`.

**Concerns**
- MEDIUM: Plan 03 says deploy-time verification smoke-invokes retrofitted EFs, but Plan 05 only meaningfully smokes `create-poll`, `toggle-results-visibility`, and `delete-poll`; it would not catch the new `promote-admin` pre-auth audit failure.

**Suggestions**
- Add a pre-auth `promote-admin` smoke or integration assertion after fixing the `target_id` type mismatch.

**Risk Assessment** — MEDIUM

### Cycle-2 HIGH Verification Table

| Concern ID | Status | Evidence |
|---|---|---|
| REVIEW-FIX-C2-H1 | RESOLVED | Plan 00 uses `{ poll_id, label, sort_order }`; live `choices.label` confirmed at `supabase/migrations/00000000000000_schema.sql:86`. |
| REVIEW-FIX-C2-H2 | RESOLVED (but introduces a new HIGH downstream) | Both `promote-admin` branches now covered, matching live source. New HIGH below tracks the `target_id` type mismatch this fix uncovered. |
| REVIEW-FIX-C2-H3 | RESOLVED | Plan 03b preserves `{ success: true, id: pollId }`; live return at `supabase/functions/create-poll/index.ts:135`. |
| REVIEW-FIX-C2-H4 | RESOLVED | Plan 03b documents `choices: string[]`; live validation at `supabase/functions/create-poll/index.ts:86-97`. |
| REVIEW-FIX-C2-H5 | RESOLVED | Plan 04 now creates a real `vote_counts` row via `memberUser` before admin JWT reads. |
| REVIEW-FIX-C2-H6 | RESOLVED | Plan 04 corrected create-poll tests to `choices: string[]`, `result.data.id`, and service-role `polls` SELECT. |
| REVIEW-FIX-C2-H7 | RESOLVED | Plan 05 smoke uses string-array choices and `jq -r '.id'`. |

### Overall Phase Risk Assessment

HIGH, due to the new `promote-admin` pre-auth audit write mismatch against `audit_log.target_id uuid`.

### Ready For Execution?

NO. The cycle-2 create-poll/choices cluster is fixed, but Plan 03 (or Plan 01) must be revised so `admin_preauthorized` does not write a Discord snowflake into a UUID column.

---

## Consensus Summary (Cycle 3)

The two reviewers converged this cycle — a notable change from cycles 1 and 2 where Gemini ran structural reviews and Codex ran code-grounded reviews and only Codex caught the interface bugs. In cycle 3, both reviewers independently surfaced the same NEW HIGH from independent angles (Gemini from cross-reading the plans; Codex from cross-checking against live source line numbers). The convergence is strong evidence that the cycle-2 fix to REVIEW-FIX-C2-H2 introduced a real type collision that the planner missed because the plans authored the `target_id` value in Plan 03 without re-checking Plan 01's column type declaration.

### Cycle-2 HIGH Disposition (consolidated, both reviewers)

All 7 cycle-2 HIGHs are FULLY RESOLVED:

| Cycle-2 HIGH | Cycle-3 Status | Verification |
|---|---|---|
| REVIEW-FIX-C2-H1 (helper choices column) | **RESOLVED** | Both reviewers: Plan 00 uses `label` not `text`; live schema confirms at `supabase/migrations/00000000000000_schema.sql:86`. |
| REVIEW-FIX-C2-H2 (promote-admin two-branch retrofit) | **RESOLVED** | Both reviewers: two-branch retrofit matches live EF shape. Note: the fix surfaces a downstream type collision (new HIGH below) — the H2 concern itself is resolved; the downstream issue is a new problem. |
| REVIEW-FIX-C2-H3 (create-poll response shape) | **RESOLVED** | Both reviewers: `{success, id}` preserved per live EF line 135. |
| REVIEW-FIX-C2-H4 (create-poll choices contract) | **RESOLVED** | Both reviewers: `string[]` per live EF lines 86–97. |
| REVIEW-FIX-C2-H5 (admin-JWT sentinel false negative) | **RESOLVED** | Both reviewers: Plan 04 seeds a memberUser-keyed vote_counts row before the admin JWT read — real regression sentinel. |
| REVIEW-FIX-C2-H6 (test contract mismatch) | **RESOLVED** | Both reviewers: integration test sends `choices: string[]` and reads `result.data.id`; service-role SELECT verifies `results_hidden`. |
| REVIEW-FIX-C2-H7 (smoke payload mismatch) | **RESOLVED** | Both reviewers: smoke `curl` uses string-array choices and `jq -r '.id'`. |

### Newly-Surfaced HIGH (Cycle 3)

**1. `audit_log.target_id uuid` vs `admin_preauthorized` row's snowflake `target_id` (both reviewers)**

- **Component:** Plans 11-01 + 11-03 (cross-plan contract collision)
- **Description:** Plan 11-01 declares `audit_log.target_id uuid` (D-02, confirmed in Plan 01 truth blocks and `<interfaces>` block). Plan 11-03's REVIEW-FIX-C2-H2 instructs the `promote-admin` Branch 2 retrofit to emit one `admin_preauthorized` audit row with `target_id: target_discord_id` (target_type = 'admin_discord_ids'). However, Discord snowflakes are 17–19 digit numeric strings (live schema declares `admin_discord_ids.discord_id TEXT PRIMARY KEY` at `supabase/migrations/00000000000000_schema.sql:16`) — they are NOT valid UUIDs. INSERTing a snowflake into a `uuid` column will fail at the Postgres layer with `invalid input syntax for type uuid`.
- **Why this is a HIGH (not a MEDIUM):** Combined with the `writeAudit` fail-open contract (Pitfall 3 — helper logs to console.error and never throws), the EF would return HTTP 200 success to the caller while silently dropping the `admin_preauthorized` audit row. This defeats the forensic purpose of the audit_log on the exact code path (pre-authorizing a Discord-only admin) that is most likely to be invoked by an operator and most likely to require an audit trail.
- **Reachability:** The failure path is triggered by every call to `promote-admin` with `target_discord_id` set (Branch 2). The cycle-2 reviewer noted that the plan only covered Branch 1; the cycle-3 fix correctly adds Branch 2 coverage but inherits a column-type mismatch from Plan 01's D-02 schema baseline that pre-dates the H2 fix.
- **Recommended fix (three options, both reviewers converged on A or B):**
  - **Option A (Codex preferred):** Change Plan 01's `audit_log.target_id` column from `uuid` to `text`. This accommodates both UUIDs (profile IDs, poll IDs, category IDs) and snowflakes. Update Plan 01's D-02 truth block + acceptance criteria + the `<interfaces>` block in Plans 01/02/03/03b/04. Migration 10 has not been applied to production yet (Plan 05 is the deploy gate), so the column-type change is free.
  - **Option B (Gemini preferred):** Leave `audit_log.target_id` as `uuid`. For the `admin_preauthorized` row, set `target_id: null` and store `{ discord_id: target_discord_id }` in `after` only. This requires updating Plan 03's REVIEW-FIX-C2-H2 instruction + the acceptance criterion `target_id = target_discord_id`.
  - **Option C (NOT a solution):** A `target_discord_id::uuid` cast does not work — Discord snowflakes are 17–19 digit decimal strings, not UUID hex sequences.
- **Add a deploy-time or integration assertion for the Branch 2 path (Codex):** Plan 05 currently does not smoke `promote-admin` Branch 2 against production. Even after the column-type fix, an integration test (or a deploy smoke `curl`) that pre-authorizes a fake Discord ID and asserts the `admin_preauthorized` audit row landed would catch any future drift.

### Cycle-3 MEDIUM / LOW Concerns (informational, not blockers)

- **Plan 01 MEDIUM (both reviewers):** `audit_log.actor_id` lacks `ON DELETE SET NULL` — future profile deletion could be blocked by audit rows. Recommendation: `actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL`.
- **Plan 02 LOW (Codex):** Stale narrative referencing the prior "pre-read" / "timestamp on every UPDATE" design remains; executable instructions are correct. Cleanup recommended for executor clarity.
- **Plan 03 MEDIUM (Codex):** "Exactly one audit call per state-changing path" frontmatter language conflicts with Branch 2's `1 + N` audit rows. Reword the truth to "one audit row per state-changing emit; Branch 2 of `promote-admin` emits `1 + N` rows where N = `promotedExistingProfiles`."
- **Plan 03 LOW (Gemini):** `update-poll` audit `before: null` if the RPC doesn't return prior values reduces forensic utility. Acceptable given RPC constraints; document as "best-effort audit depth."
- **Plan 03b MEDIUM (Codex):** Plan does not explicitly say to update the local `body` type to include `results_hidden?: unknown` (current typed body lacks it at `supabase/functions/create-poll/index.ts:38`).
- **Plan 04 LOW (Codex):** Task 04-03 behavior bullets still reference `response.poll.results_hidden` (the action body and acceptance criteria override this correctly, but the stale bullet may confuse executors).
- **Plan 05 MEDIUM (Codex):** Smoke meaningfully exercises `create-poll`, `toggle-results-visibility`, and `delete-poll`, but not `promote-admin` Branch 2. Adding a pre-auth promote-admin smoke (after fixing the `target_id` type mismatch) would close this gap.

### Agreed Strengths (both reviewers, cycle 3)

- REVIEW-FIX-C2-H1: live-source-grounded helper schema fix (choices.label not text).
- REVIEW-FIX-C2-H3 + H4 + H6 + H7: end-to-end create-poll contract alignment (response shape, choices type, test reads, smoke payload) — the cycle-2 root cluster is fully closed.
- REVIEW-FIX-C2-H5: admin-JWT sentinel converted from a false negative into a real regression detector.
- The convergence of two independent reviewers on the same NEW HIGH (target_id type mismatch) is strong evidence of the issue's severity.

### Agreed Concerns

- The new HIGH (Plan 01 vs Plan 03 `target_id` type collision) blocks execution-readiness. Both reviewers say NO to "Ready for Execution" pending fix.

### Divergent Views

- **Severity scale of the new HIGH:** Gemini scored the phase MEDIUM overall (improvement from cycle-2 HIGH); Codex scored HIGH. Both flagged the same root cause and both say NOT execution-ready — the disagreement is on the headline severity adjective, not the disposition.

### Recommended Next Step

Run a fourth planner cycle (`/gsd-plan-phase 11 --reviews`) to address the one cycle-3 HIGH. The fix is targeted and small:

- **Quickest path (Option A — Codex preferred):** Change Plan 01's `audit_log.target_id uuid` → `text` in three places: D-02 truth block, the SQL DDL in the migration plan body, and the `<interfaces>` block. Ripple the change to Plans 02/03/03b/04's `<interfaces>` blocks. No code changes; Plan 03's REVIEW-FIX-C2-H2 instructions stand as-is. Migration 10 has not yet been applied to production, so the column-type change is free.
- **Alternative (Option B — Gemini preferred):** Leave the uuid column. Update Plan 03's REVIEW-FIX-C2-H2 to set `target_id: null` for the `admin_preauthorized` row and store `{ discord_id: target_discord_id }` in `after` only. Adjust the acceptance criterion `target_id: target_discord_id` accordingly.

Both options resolve the HIGH; both reviewers expect either fix to clear the phase for execution. After the fix, the convergence loop should converge to `current_high=0` and `/gsd-execute-phase 11` becomes the next action.
