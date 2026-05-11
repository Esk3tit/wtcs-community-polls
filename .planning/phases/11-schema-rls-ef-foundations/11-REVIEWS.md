---
phase: 11
review_cycle: 4
reviewers: [gemini, codex]
reviewed_at: 2026-05-11T21:53:38Z
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
  - coderabbit (reviews git working-tree diff, not plan markdown; tree clean at e76786d — nothing to diff)
  - cursor (account hit usage limit on invocation — same as cycles 1, 2, and 3)
  - opencode (not installed)
  - qwen (not installed)
revisions_under_review: commit e76786d (REVIEW-FIX-C3-H1 — audit_log.target_id uuid → text)
cycle_1_high_count: 6
cycle_2_high_count: 7
cycle_3_high_count: 1
cycle_4_high_count: 0
cycle_4_new_high_count: 0
cycle_3_highs_fully_resolved: 1
cycle_3_highs_partially_resolved: 0
cycle_3_highs_unresolved: 0
---

# Cross-AI Plan Review — Phase 11 (Cycle 4 — Final)

Cycle 4 reviews the planner's revision (commit `e76786d`) that addressed the single cycle-3 HIGH-severity concern converged on by both Gemini and Codex: the `audit_log.target_id` type collision (`uuid` declared in Plan 01 vs. Discord snowflake written by Plan 03's `promote-admin` Branch 2 retrofit). Option A was applied — `target_id` column type changed `uuid` → `text` at the schema foundation, with confirmation markers in Plans 02 and 03, acceptance + automated verify enforcement (both `target_id text` present AND `target_id uuid` absent), and a new `T-AUDIT-TYPE-COLLISION` threat-model row documenting the failure mode and mitigation.

**Both cycle-4 reviewers converged: the cycle-3 HIGH is FULLY RESOLVED, no new HIGH-severity concerns introduced, Ready for Execution: YES.** This is the final review cycle.

---

## Gemini Review

# Phase 11 Plan Review — Cycle 4 (Final)

This review verifies the implementation plans for Phase 11 (Schema + RLS + EF Foundations) following the cycle-4 revisions. Cycle 4 focused on resolving the single converged HIGH from cycle 3: the `audit_log.target_id` type collision.

### 1. Cycle-3 HIGH Verification

**Concern:** `audit_log.target_id` type collision (`uuid` vs `text` snowflake).
**Verdict:** **FULLY RESOLVED.**

The planner successfully applied **Option A** (type widening) consistently across the entire plan set:
- **Plan 01 (`11-01-PLAN.md`)**: The `audit_log` DDL and D-02 truth block now declare `target_id text`. The automated `verify` line and acceptance criteria explicitly enforce the presence of `text` and the absence of `uuid` for this column.
- **Plan 02 (`11-02-PLAN.md`)**: The `AuditEntry` interface in the `<interfaces>` block specifies `target_id: string | null`, with a comment confirming it admits both UUIDs and Discord snowflakes.
- **Plan 03 (`11-03-PLAN.md`)**: The `promote-admin` Branch 2 logic is documented as writing the snowflake directly to the `text` column, avoiding the runtime `invalid input syntax for type uuid` error that would have previously occurred.
- **Threat Model**: A new entry `T-AUDIT-TYPE-COLLISION` in Plan 01 captures the failure mode and verifies the mitigation.

### 2. Summary

The cycle-4 plan set is exceptionally robust and ready for execution. The planner has successfully navigated three rounds of rigorous cross-AI review, resolving a complex cluster of interface mismatches, race conditions, and type collisions. The implementation is now deeply grounded in the live source code (verified by specific line numbers for `choices.label`, `create-poll` response shapes, and RLS policy expression logic). The addition of the `target_id text` fix completes the foundation, ensuring the forensic audit trail is reliable across all 13 emitter paths, including the Discord-native pre-authorization branch.

### 3. Strengths

- **Contract Fidelity**: The plans demonstrate a high degree of "repo-awareness," correctly identifying that `create-poll` returns `{ success: true, id: string }` rather than a full row, and that its `choices` field is `string[]` rather than an object array.
- **Defensive Integrity**: The use of a compensating `DELETE` in `create-poll` (REVIEW-FIX-H5) to handle failures in the post-RPC `results_hidden` update is an excellent example of all-or-nothing transactional thinking.
- **True Regression Sentinels**: The TEST-11/TEST-12 suites are not just "smoke tests"; they are designed as real regression detectors. Specifically, the admin-JWT direct-read test (REVIEW-FIX-M7) is correctly set up to fail if the admin-OR-bypass logic is ever accidentally re-introduced.
- **Race-Safe Toggles**: The pivot to a conditional state-change `UPDATE` (REVIEW-FIX-H4) in the toggle EF eliminates the read-modify-write race identified by Codex in cycle 2.

### 4. Concerns

- **No HIGH-severity concerns remain.**
- **MEDIUM**: None.
- **LOW**: The `audit_log.actor_id` foreign key still lacks `ON DELETE SET NULL` (suggested in Cycle 3). While not a blocker for v1.2, a manual profile deletion in the future will be blocked if that user has performed any audited actions. Given the append-only nature of the log, this is acceptable for now but represents a small piece of technical debt.

### 5. Suggestions

- **Consistency**: In `11-03b-PLAN.md`, the planner correctly identified the `at_create` vs `at_creation` drift in action strings and picked a winner. I recommend a quick search-and-replace in `11-CONTEXT.md` D-09 to align it with the implementation (`at_create`) before execution to keep the documentation perfectly in sync.

### 6. Risk Assessment

**Risk Level: LOW**

The phase risk has been downgraded from HIGH (Cycle 2) and MEDIUM (Cycle 3) to LOW. The logic has been triple-checked against the live database and function runtimes. The automated verification strategy is comprehensive, covering the 12-cell RLS matrix which was the primary "P0" security concern for this milestone.

### 7. Ready for Execution

**YES.**

The plans are complete, consistent, and correctly address all previously identified high-severity issues. The transition from planning to execution can proceed with high confidence that the resulting implementation will be secure, idempotent, and correctly aligned with the project's existing architectural patterns.

**Reviewer Verdict:** Converged 0 HIGHs. Proceed to execution.

---

## Codex Review

### Cycle-3 HIGH Verification

**FULLY RESOLVED.** At `e76786d`, the seven plan files consistently resolve the `audit_log.target_id` collision by using `text` for the column and `string | null` for the EF helper contract.

Evidence:
- Plan 01 now specifies `audit_log.target_id text` in the truth block, interfaces block, DDL instructions, acceptance criteria, and automated verify command.
- Plan 02's `AuditEntry.target_id` is `string | null` and explicitly documents UUIDs plus Discord snowflakes.
- Plan 03 keeps `promote-admin` Branch 2 writing `target_id: target_discord_id`, and now correctly depends on Plan 01's `text` column.
- The verify line checks both sides: `target_id\s+text` must exist and `target_id\s+uuid` must not exist.
- `T-AUDIT-TYPE-COLLISION` accurately describes the original failure: Discord snowflake into UUID column, masked by fail-open `writeAudit`.

### Summary

Cycle 4 closes the single Cycle-3 HIGH cleanly. Option A is the right fix for this audit table shape: `target_id` is a polymorphic natural identifier across polls, profiles, categories, and `admin_discord_ids`, so `text` is more accurate than `uuid`. I found **no remaining HIGH-severity blockers** in the seven execution plans.

### Strengths

- The fix is applied at the schema foundation instead of special-casing `promote-admin`.
- The two-plan contract is explicit: Plan 01 declares `text`; Plan 03 writes the snowflake unchanged.
- Acceptance criteria prevent regression back to `uuid`.
- The threat model now documents why this matters specifically with `writeAudit` fail-open behavior.
- Existing UUID-based emitters remain compatible because UUIDs serialize cleanly as text.

### Concerns

- **HIGH:** None.
- **MEDIUM:** Supporting docs still contain stale contradictory examples outside the plan files: `11-RESEARCH.md` still shows `target_id uuid`, old `is_current_user_admin() OR` vote-count policy examples, and old `results_hidden_set_at_creation`; `11-PATTERNS.md` also has stale policy/action examples. The plan bodies override these, but executors are told to read these files, so they should be cleaned before execution.
- **MEDIUM:** There is still no dedicated `promote-admin` Branch 2 integration/deploy smoke assertion proving `admin_preauthorized` writes an audit row with a Discord snowflake `target_id`. Not a blocker after the schema fix, but it is the exact path that caused the prior HIGH.
- **MEDIUM:** `audit_log.actor_id` still lacks `ON DELETE SET NULL`; future profile deletion could be blocked by audit rows. Not Phase-11 blocking, but worth tightening.

### Suggestions

- Update `11-RESEARCH.md` and `11-PATTERNS.md` to match the final plan: `target_id text`, no JWT-admin OR branch on `vote_counts`, and `results_hidden_set_at_create`.
- Add either a small integration test or Plan 05 smoke step for `promote-admin` preauth mode using a fake Discord snowflake and verifying `admin_preauthorized`.
- Consider `actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL`.

### Risk Assessment

**LOW-MEDIUM.** The Cycle-3 blocker is resolved. Residual risk is mostly executor-confusion risk from stale supporting docs and lack of runtime coverage for the preauth audit branch, not a known execution-blocking defect in the plans.

### Ready for Execution

**YES.** No HIGH-severity concerns remain in the seven Phase 11 plans. The stale supporting docs should be cleaned, but they do not invalidate the corrected executable plan contract.

---

## Consensus Summary

Both reviewers converge unequivocally:

| Question | Gemini | Codex |
|:---|:---|:---|
| Cycle-3 HIGH (`target_id` uuid → text) FULLY RESOLVED? | YES | YES |
| New HIGH-severity concerns? | None | None |
| Ready for Execution? | YES | YES |
| Overall risk level | LOW | LOW-MEDIUM |

### Agreed Strengths

- **Schema-level fix is the right cut.** Both reviewers agree applying Option A (column-type widening) at the foundation is preferable to special-casing the `promote-admin` Branch 2 call site. UUIDs serialize cleanly as text, so existing emitters remain compatible.
- **Two-plan contract is explicit and traceable.** Plan 01 declares `target_id text`, Plan 02's `AuditEntry` interface marks the field `string | null`, Plan 03 Branch 2 writes the snowflake unchanged — and the truth blocks in all three reference the same REVIEW-FIX-C3-H1 marker.
- **Acceptance criterion + automated verify prevent regression.** The dual-check `grep -iqE "target_id\s+text" && ! grep -iqE "target_id\s+uuid"` enforces both the presence and absence conditions, blocking any future replan that drifts back to `uuid`.
- **Threat model captures the failure mode.** The new `T-AUDIT-TYPE-COLLISION` row documents how the `uuid`-typed column would have combined with `writeAudit`'s fail-open contract (Plan 02 Pitfall 3) to silently drop audit rows on the exact code path most likely to require a forensic trail.

### Agreed Concerns

- **None at HIGH severity.** Both reviewers explicitly state "No HIGH-severity concerns remain." The phase is cleared for execution.

### Cross-Reviewer MEDIUM (Codex only, surfaced for the planner's awareness)

Codex surfaced three MEDIUM-severity items that do not block execution but are worth tracking:

1. **Stale supporting docs.** `11-RESEARCH.md` and `11-PATTERNS.md` still contain pre-cycle-3 examples (`target_id uuid`, `is_current_user_admin() OR` vote-count policy, `results_hidden_set_at_creation`). The plan bodies are authoritative and override these, but executors read the supporting docs. Recommend a clean-up pass before execution starts.
2. **No dedicated `promote-admin` Branch 2 audit smoke test.** Plan 05 smoke + integration tests don't exercise the exact `admin_preauthorized` write with a Discord snowflake `target_id`. Not a defect post-schema-fix, but it's the precise path that triggered the cycle-3 HIGH.
3. **`audit_log.actor_id` lacks `ON DELETE SET NULL`.** Future profile deletion could be blocked by audit references. Gemini independently noted this as LOW; Codex grades it MEDIUM. Append-only log nature makes this acceptable for v1.2 ship.

### Divergent Views

- **Stale docs severity.** Codex flags this MEDIUM (executor confusion risk); Gemini didn't surface it (treated the plans as authoritative). The MEDIUM/LOW gap is a sensible reviewer-style difference, not a substantive disagreement.
- **Risk level.** Gemini grades LOW; Codex grades LOW-MEDIUM. Both clear the phase for execution; the half-step difference reflects Codex's residual MEDIUM concerns about supporting-doc drift.

### Cycle Progression Summary

| Cycle | HIGHs raised | HIGHs resolved | Outcome |
|:---|:---:|:---:|:---|
| 1 | 6 | 6 | Cycle-2 verifies all 6 resolved |
| 2 | 7 (new, Codex-only) | 7 | Cycle-3 verifies all 7 resolved (BOTH reviewers) |
| 3 | 1 (new, both reviewers converged) | 1 | Cycle-4 verifies resolved (BOTH reviewers) |
| 4 | 0 | n/a | **No new HIGHs. Phase 11 cleared for execution.** |

### Recommendation

**Phase 11 is ready to execute.** Both independent reviewers explicitly say YES with no HIGH-severity reservations. The optional cleanup work (Codex MEDIUMs — stale supporting docs, preauth smoke step, `ON DELETE SET NULL`) can be addressed inline during execution or deferred to follow-up; none block the cycle-4 gate.

To proceed: `/gsd-execute-phase 11`
