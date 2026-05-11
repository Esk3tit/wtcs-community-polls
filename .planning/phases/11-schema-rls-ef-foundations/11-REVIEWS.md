---
phase: 11
review_cycle: 2
reviewers: [gemini, codex]
reviewed_at: 2026-05-11T21:30:00Z
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
  - cursor (account hit usage limit during invocation, same as cycle 1)
  - opencode (not installed)
  - qwen (not installed)
revisions_under_review: commit 252b4b8 (22 REVIEW-FIX-* markers — 8 HIGH, ~10 MEDIUM, 4 LOW)
cycle_1_high_count: 6
cycle_2_high_count: 7
---

# Cross-AI Plan Review — Phase 11 (Cycle 2)

Cycle 2 reviews the planner's revisions (commit `252b4b8`) that incorporated cycle-1 feedback. The plans now carry 22 `REVIEW-FIX-*` markers (8 HIGH, ~10 MEDIUM, 4 LOW). Both reviewers were prompted to (a) verify the 6 cycle-1 HIGHs are addressed and (b) surface any new concerns introduced by the revisions.

The two reviewers diverged sharply again — Gemini scored the revised plans LOW risk and ready-for-execution; Codex grounded its review against the actual repo schema and EF contracts and surfaced **7 new HIGH-severity correctness gaps** (mostly interface mismatches between the revised plans and the live `create-poll` EF + `choices` table). Codex marked the phase HIGH risk, not execution-ready.

---

## Gemini Review

This is a **Cycle 2** review of the revised implementation plans for Phase 11 (Schema + RLS + EF Foundations). The planner has incorporated a comprehensive set of fixes (`REVIEW-FIX-*`) addressing all 6 HIGH-severity concerns from the previous cycle.

### Phase 11-00-PLAN.md: Integration test fixtures
1. **Summary**: This plan is now fully ready for execution. It correctly establishes a decoupled integration testing environment that mirrors production behaviors while maintaining strict isolation.
2. **Strengths**: The introduction of `REVIEW-FIX-H1` and `H2` ensures that the integration matrix doesn't fail due to empty tables, and `mintClients` provides the necessary role-based contexts for RLS probing.
3. **Concerns**: None.
4. **Suggestions**: None.
5. **Risk Assessment**: **LOW**.

### Phase 11-01-PLAN.md: Migration 10
1. **Summary**: Excellent migration design. The atomicity of the DDL and policy changes prevents any "security windows" during deployment.
2. **Strengths**: `REVIEW-FIX-H3` is a critical correction; removing the JWT admin bypass from RLS ensures the platform follows the principle of least privilege, forcing admins to interact via audited Edge Functions for results access.
3. **Concerns**: None.
4. **Suggestions**: None.
5. **Risk Assessment**: **LOW**.

### Phase 11-02-PLAN.md: Shared audit helper + toggle EF
1. **Summary**: The Edge Function logic is now robust and race-safe.
2. **Strengths**: `REVIEW-FIX-H4` uses a single conditional `UPDATE` with `RETURNING`, which is the industry standard for idempotent, atomic state changes in Postgres. This removes the risk of double-auditing or state inconsistency under high concurrency.
3. **Concerns**: None.
4. **Suggestions**: None.
5. **Risk Assessment**: **LOW**.

### Phase 11-03-PLAN.md: Audit retrofit
1. **Summary**: A thorough and systematic update of the admin API surface.
2. **Strengths**: The per-poll audit loop in the cron sweep (`close-expired-polls`) is a significant observability improvement over a single batch row.
3. **Concerns**: None.
4. **Suggestions**: None.
5. **Risk Assessment**: **LOW**.

### Phase 11-03b-PLAN.md: create-poll retrofit
1. **Summary**: Handles the non-atomic creation-then-hide edge case with appropriate compensation.
2. **Strengths**: `REVIEW-FIX-H5` (Compensating DELETE) ensures that if a poll is intended to be hidden but the visibility flip fails, the visible poll is rolled back. This prevents unintentional data exposure.
3. **Concerns**: None.
4. **Suggestions**: None.
5. **Risk Assessment**: **LOW**.

### Phase 11-04-PLAN.md: TEST-11/TEST-12 implementation
1. **Summary**: The integration suite is now comprehensive and deterministic.
2. **Strengths**: `REVIEW-FIX-M6` (order-independent tests) and `REVIEW-FIX-M7` (admin JWT sanity check) close significant verification gaps. The addition of a dedicated `create-poll-results-hidden.test.ts` provides much-needed coverage for the bootstrap-hidden path.
3. **Concerns**: None.
4. **Suggestions**: None.
5. **Risk Assessment**: **LOW**.

### Phase 11-05-PLAN.md: Deploy + Ship
1. **Summary**: The deployment workflow is now safe and follow established project flags.
2. **Strengths**: `REVIEW-FIX-H7` correctly separates local validation from remote pushing. The addition of `--no-verify-jwt` in `H8` is the correct solution for functions performing internal auth checks.
3. **Concerns**: None.
4. **Suggestions**: None.
5. **Risk Assessment**: **LOW**.

---

### Cycle 1 HIGH Concern Verification

| Concern ID | Description | Status | Evidence |
|:---|:---|:---|:---|
| **TEST-11-HELP** | Helper contract gap (castVote/baseline) | **RESOLVED** | `e2e/integration/helpers.ts` includes `userId` and `seedBaselineVote`. |
| **CREATE-ATOM** | create-poll non-atomic / leak risk | **RESOLVED** | `REVIEW-FIX-H5` implements compensating DELETE on UPDATE failure. |
| **TOGGLE-RACE** | Toggle EF race condition (audit) | **RESOLVED** | `REVIEW-FIX-H4` implements conditional UPDATE with `IS DISTINCT FROM`. |
| **RLS-CONTRA** | RLS admin-OR-branch contradiction | **RESOLVED** | `REVIEW-FIX-H3` removes admin OR-branch from the policy expression. |
| **DB-PUSH-SAFE**| Dangerous Supabase commands | **RESOLVED** | `REVIEW-FIX-H7` removes `db push` from local gate; `H8` adds deploy flags. |
| **TEST-ORDER** | TEST-12 case 3 ordering dependency | **RESOLVED** | `REVIEW-FIX-M6` implements `beforeEach`/`afterEach` for isolation. |

### Overall Phase Risk Assessment: **LOW**
The revised plans are exceptionally high-quality. They anticipate and mitigate production failure modes (compensation DELETEs), concurrency issues (conditional UPDATEs), and security loopholes (admin JWT RLS gating). The verification strategy is now robust enough to act as a hard gate for merging.

### Ready for Execution: **YES**
The phase is ready for execution as written. No further review cycles are required.

---

## Codex Review

I reviewed the plans against the repo's current schema and EF contracts. Net: the revisions fixed several cycle-1 issues, but Phase 11 is **not execution-ready yet** because some revised plans now conflict with actual code interfaces.

### 11-00

**Summary** — Good direction for integration scaffolding, but helper contracts still have execution-breaking schema mismatches.

**Strengths**
- `castVote` now uses service-role and accepts `userId`.
- Baseline vote seeding correctly addresses empty `vote_counts`.
- Integration suite is separated from unit tests.

**Concerns**
- **HIGH:** `createFreshPoll` says choices are inserted with `text`, but the actual table column is `choices.label` in `supabase/migrations/00000000000000_schema.sql:86`. This will break helper setup.
- **MEDIUM:** `createFreshPoll` failure during choices/baseline vote insertion can leak a poll unless the helper internally cleans up partial setup.
- **LOW:** Vitest parsing is not real TypeScript type-checking.

**Suggestions**
- Use `{ poll_id, label, sort_order }` for choices.
- Wrap poll setup in try/catch cleanup before returning.
- Add a tiny helper self-test after migration lands.

**Risk Assessment:** **MEDIUM**

### 11-01

**Summary** — The migration plan is much stronger and resolves the RLS admin-OR contradiction in the actual policy design.

**Strengths**
- Drops both old `vote_counts` policy names before creating the new one.
- Removes JWT-admin bypass and relies only on service-role bypass.
- Re-applies `security_invoker = on`.
- Creates `audit_log` in the same migration.

**Concerns**
- **MEDIUM:** `audit_log.actor_id REFERENCES profiles(id)` has no `ON DELETE SET NULL`; future profile deletion could be blocked by audit rows.
- **LOW:** DB type regeneration is deferred, which is acceptable, but Phase 12 must treat it as a hard prerequisite.

**Suggestions**
- Consider `actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL`.
- Add explicit post-reset SQL checks for policy role/qual.

**Risk Assessment:** **LOW-MEDIUM**

### 11-02

**Summary** — The race fix is conceptually correct, but the plan has internal contradictions and a risky fallback story.

**Strengths**
- Conditional update avoids read-then-update double-audit races.
- No-op path returns 200 without writing audit.
- 404 vs no-op distinction is handled by follow-up SELECT.

**Concerns**
- **MEDIUM:** The RPC fallback would require changing migration 10 after Plan 01, but Plan 01 is treated as closed. Either include the RPC up front or remove fallback.
- **MEDIUM:** Objective/threat model still mention old "pre-read" and "timestamp on every UPDATE" behavior, contradicting the fixed task body.
- **LOW:** Source-comment instructions conflict: task text asks for D/Pitfall references while must-haves forbid decision archaeology.

**Suggestions**
- Lock one implementation: preferably verify `.not('results_hidden', 'is', hidden)` locally and remove RPC fallback.
- Clean stale pre-read/no-op timestamp language.

**Risk Assessment:** **MEDIUM**

### 11-03

**Summary** — The audit retrofit is broadly sound, but a few existing EF shapes need more precise handling.

**Strengths**
- Covers the right mutation EF set except `create-poll`.
- Preserves response shapes.
- Handles cron `actor_id: null`.

**Concerns**
- **HIGH:** `promote-admin` has two branches: `target_user_id` and `target_discord_id`. The plan only cleanly describes profile-target promotion, not pre-auth `admin_discord_ids` insertion and possible multi-profile retroactive flip.
- **MEDIUM:** Added pre-SELECTs for `delete-*`, `rename-category`, and `set-resolution` are not atomic with the mutation, so audit `before` values can drift under concurrent admin actions.
- **MEDIUM:** `demote-admin` currently does not `.single()` after update; a missing target could still produce misleading audit unless tightened.

**Suggestions**
- Specify audit rows separately for both `promote-admin` branches.
- Prefer mutation returns where possible; otherwise document best-effort `before`.
- Tighten zero-row update handling before auditing.

**Risk Assessment:** **MEDIUM-HIGH**

### 11-03b

**Summary** — Compensation improves the non-atomic create path, but this plan now conflicts with the actual `create-poll` EF contract.

**Strengths**
- Adds compensation delete on post-RPC update failure.
- Emits audits only after all mutations succeed.
- Keeps RPC signature unchanged.

**Concerns**
- **HIGH:** Current `create-poll` EF (at `supabase/functions/create-poll/index.ts:135`) returns `{ success: true, id: pollId }`, not `{ poll: ... }`. Plan 04/05 expect `data.poll`.
- **HIGH:** Current `create-poll` expects `choices` as `string[]` (validated at lines 86-97 of the EF), not `{ text }[]`.
- **MEDIUM:** Compensation is not true atomicity; if compensation delete fails, a visible poll can remain.
- **MEDIUM:** Action string is still inconsistent with provided CONTEXT (`_at_creation` vs `_at_create`) until docs are updated.

**Suggestions**
- Decide response contract explicitly. Best option: return `{ success: true, id, poll }` for compatibility.
- Update tests/smoke to send `choices: ['option-a', 'option-b']`.
- Consider extending the RPC instead if true atomicity is required.

**Risk Assessment:** **HIGH**

### 11-04

**Summary** — Test coverage intent is good, but some tests currently would fail or produce false confidence.

**Strengths**
- TEST-12 is order-independent via fresh poll per case.
- No-op audit behavior is directly tested.
- Adds useful negative cases.
- Adds create-poll hidden-at-create coverage.

**Concerns**
- **HIGH:** Admin-JWT sanity test is a false negative. It uses `seedBaseline: false`, so there is no `vote_counts` row. Even with an admin-OR policy regression, the admin read still returns 0.
- **HIGH:** `create-poll-results-hidden.test.ts` sends choices as objects and expects `data.poll`; both conflict with current `create-poll`.
- **MEDIUM:** Full integration test count and comments drift between 24 and other counts.
- **MEDIUM:** `afterEach` should guard null poll IDs before deleting audit rows.

**Suggestions**
- For admin-JWT sanity, create a vote_counts row by a different user, then assert admin JWT with no own vote still gets 0.
- Align create-poll tests with the chosen response contract and `string[]` choices.
- Add `it.only` grep to acceptance.

**Risk Assessment:** **HIGH**

### 11-05

**Summary** — Deploy safety is much improved, but smoke commands inherit the create-poll contract mismatch and contain audit-retention contradictions.

**Strengths**
- Removes local `db push`; local gate is now local-only.
- Production deploy uses explicit project ref.
- Smoke uses a dedicated test poll and checks admin + non-admin probes.

**Concerns**
- **HIGH:** Smoke `create-poll` payload uses `{ text }` choices and reads `.poll.id`; current EF uses `string[]` and returns `.id`.
- **MEDIUM:** Plan says `audit_log` is append-only, but smoke cleanup deletes audit rows. Threat model then says smoke rows persist. This is contradictory.
- **MEDIUM:** `--no-verify-jwt` may be consistent with existing deploy practice, but the stated rationale is inaccurate; service-role usage inside the EF is unrelated to platform JWT verification.
- **LOW:** Local gate should explicitly require/start the local Supabase stack before `db reset` if not already running.

**Suggestions**
- Fix smoke payload/response after resolving 11-03b.
- Either leave smoke audit rows or explicitly document service-role cleanup as an exception.
- Reuse an existing deploy script if the project has one; otherwise keep per-function commands.

**Risk Assessment:** **MEDIUM-HIGH**

### Cycle-1 HIGH Verification

| Concern | Status | Evidence |
|---|---:|---|
| TEST-11 helper contract gap | **PARTIALLY RESOLVED** | `userId` + service-role vote + baseline vote are fixed, but helper still uses wrong `choices.text` column. |
| 11-03b create-poll non-atomic | **PARTIALLY RESOLVED** | Compensation delete added, but not true atomicity and tests/smoke conflict with current EF response. |
| 11-02 toggle EF race | **RESOLVED** | Conditional update removes read-then-update double-audit race. Needs cleanup of stale plan text. |
| 11-01 RLS admin-OR contradiction | **RESOLVED** | New policy has no `is_current_user_admin() OR`; service-role bypass only. |
| 11-05 dangerous Supabase commands | **RESOLVED** | Local gate no longer uses `db push`; prod deploy is explicitly targeted. |
| 11-04 TEST-12 ordering dependency | **RESOLVED** | Fresh poll per case removes implicit ordering dependency. |

### Overall Phase Risk

**HIGH** until the create-poll/helper/test interface mismatches are fixed.

### Ready For Execution?

**No.** To get to "yes":

1. Fix all choice payloads/DB inserts to match actual contracts: DB uses `choices.label`; `create-poll` currently accepts `choices: string[]`.
2. Decide and align the `create-poll` response shape across 11-03b, 11-04, and 11-05.
3. Fix admin-JWT RLS sanity test so it has vote_counts data from another user.
4. Specify both `promote-admin` audit branches.
5. Remove stale contradictory text in 11-02 and 11-05.

---

## Consensus Summary (Cycle 2)

The two reviewers diverged sharply on execution-readiness. Gemini's review scored every plan LOW and concluded "ready for execution as written, no further review cycles required." Codex grounded its review against the live repo and surfaced 7 new HIGH-severity correctness gaps clustered around interface mismatches between the revised plans and the actual `create-poll` EF + `choices` table.

The divergence is the same depth-of-correctness-analysis gap that produced the cycle-1 divergence — Codex caught code-grounded interface bugs that Gemini's structural review did not surface. Of the 6 cycle-1 HIGHs, **4 are fully resolved and 2 are partially resolved** (the partial pair carries an unresolved interface mismatch into cycle 2).

### Cycle-1 HIGH Disposition (consolidated)

| Cycle-1 HIGH | Cycle-2 Status | Verification |
|---|---|---|
| TEST-11 helper contract gap | **PARTIALLY RESOLVED** | `userId` + service-role + baseline vote fixes landed, but the helper writes `choices.text` while the actual column is `choices.label` — execution will fail at helper insert. |
| 11-03b create-poll non-atomic | **PARTIALLY RESOLVED** | Compensating DELETE landed (`REVIEW-FIX-H5`), but compensation is best-effort (DELETE-failure path leaves a visible poll) AND the plan body's create-poll body/response shape contracts conflict with the live EF. |
| 11-02 toggle EF race | **RESOLVED** | Conditional `IS DISTINCT FROM` UPDATE replaces read-then-update; concurrent same-direction toggles can no longer double-audit. Cycle 2: minor stale narrative text to clean up. |
| 11-01 RLS admin-OR contradiction | **RESOLVED** | New `vote_counts` policy excludes the `is_current_user_admin() OR` branch — service-role bypass only, per VIS-04. |
| 11-05 dangerous Supabase commands | **RESOLVED** | Local gate uses `db reset` only (no `db push`); prod deploy commands carry `--project-ref --use-api --no-verify-jwt`. Cycle 2: `--no-verify-jwt` rationale is technically inaccurate but the flag itself is correct. |
| 11-04 TEST-12 ordering dependency | **RESOLVED** | `beforeEach`/`afterEach` give every TEST-12 case a fresh poll; ordering coupling removed. |

### Newly-Surfaced HIGHs (Cycle 2)

1. **11-00 HIGH (Codex):** `createFreshPoll` helper inserts choices as `{text: ...}` but the actual `choices` table column is `label TEXT NOT NULL` (verified at `supabase/migrations/00000000000000_schema.sql:86`). The helper will fail at insert against any post-migration DB.
2. **11-03 HIGH (Codex):** `promote-admin` audit retrofit covers only the profile-target branch; the EF's `target_discord_id` branch (pre-auth `admin_discord_ids` insertion with possible multi-profile retroactive flip) is unspecified.
3. **11-03b HIGH (Codex):** Plan body assumes `create-poll` returns `{ poll: <row> }`; the live EF (at `supabase/functions/create-poll/index.ts:135`) returns `{ success: true, id: pollId }`. Plans 04 and 05 inherit this assumption and would fail at runtime.
4. **11-03b HIGH (Codex):** Plan body assumes `choices` body field is `{text: string}[]`; the live EF (at lines 86–97) expects `string[]`. Plans 04 and 05 inherit this.
5. **11-04 HIGH (Codex):** Admin-JWT RLS sanity test (REVIEW-FIX-M7) uses `seedBaseline: false`, which leaves `vote_counts` empty. Even if a regression re-introduces the admin-OR-branch, the assertion still passes (0 rows from empty source) — a false negative that defeats the test's purpose.
6. **11-04 HIGH (Codex):** `create-poll-results-hidden.test.ts` sends choices as `{text: ...}` objects and asserts `data.poll.id` — both conflict with the live `create-poll` contract (see HIGH #3 + #4 above).
7. **11-05 HIGH (Codex):** Smoke `curl` payload for `create-poll` uses `{text: ...}` choices and reads `.poll.id` — same root cause as HIGH #3 + #4 + #6; production smoke will fail.

Items #1, #3, #4, #6, #7 are five manifestations of the same root cause: the planner authored the plans against an imagined `create-poll` / `choices` contract instead of the live one. Fixing the helper + plan-03b body once, then ripple-propagating to 04 + 05, addresses 5 of the 7 new HIGHs.

### Agreed Strengths (both reviewers)

- `REVIEW-FIX-H3` removes the JWT-admin OR-branch from the `vote_counts` policy — strict service-role-only bypass per VIS-04.
- `REVIEW-FIX-H4` race-safe conditional `IS DISTINCT FROM` UPDATE on the toggle EF — eliminates the double-audit race.
- `REVIEW-FIX-H5` compensating DELETE in `create-poll` — guarantees all-or-nothing semantics on the `results_hidden=true` opt-in path.
- `REVIEW-FIX-H7` local pre-merge gate uses `db reset` only — `db push` correctly deferred to the production deploy task.
- `REVIEW-FIX-H8` deploy commands carry `--project-ref --use-api --no-verify-jwt`.
- `REVIEW-FIX-M6` fresh-poll-per-case in TEST-12 — order-independent assertions.
- `REVIEW-FIX-M7` admin-JWT sanity case for the RLS gate (intent good — see Concerns for the false-negative gap).

### Agreed Concerns

- None of Gemini's surface-level structural review caught the interface-contract mismatches Codex surfaced; Gemini's "no concerns, ready for execution" verdict does not refute Codex's repo-grounded HIGHs.

### Divergent Views

- **Phase risk:** Gemini LOW; Codex HIGH-until-revised. Same gap as cycle 1 — Gemini does not re-ground its review against the live codebase; Codex does and finds bugs every cycle.
- **Whether cycle 1's "create-poll non-atomic" is closed:** Gemini RESOLVED via the compensating DELETE. Codex PARTIALLY RESOLVED — compensation is best-effort (DELETE-failure path leaves a visible poll) AND the plan body's body/response shape contracts conflict with the live EF.

### Recommended Next Step

Run a third planner cycle (`/gsd-plan-phase 11 --reviews`) to address the 7 new HIGHs. Five of the seven share a root cause (the planner imagined a different `create-poll` contract); fix the contract assumption once in Plan 11-03b and propagate to Plans 00, 04, and 05. The other two HIGHs (`promote-admin` two-branch underspec; admin-JWT sanity test false negative) need targeted plan edits in Plans 11-03 and 11-04 respectively.
