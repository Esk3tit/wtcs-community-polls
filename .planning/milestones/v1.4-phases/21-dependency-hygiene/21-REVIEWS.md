---
phase: 21
reviewers: [gemini, codex]
reviewed_at: 2026-06-05T22:40:00Z
plans_reviewed: [21-01-PLAN.md, 21-02-PLAN.md]
cycle: 2
prior_high_count: 2
current_high_count: 0
---

# Cross-AI Plan Review — Phase 21 "Dependency Hygiene" (Cycle 2)

> Convergence cycle 2. Cycle 1 (Codex + Gemini) raised 2 HIGH concerns on Plan 21-02
> (PR #44 dependabot rebase flow): (H1) rebased-head CI freshness not enforced — a stale
> green CI run on the pre-rebase commit could satisfy the merge gate; (H2) bot re-review
> after force-push not required — a review against the pre-rebase commit could satisfy the
> gate. Plan 21-02 was replanned (commit fa6b45a) to close both via OLD_SHA/NEW_SHA head
> binding (threat T-21-11). This cycle re-reviews the CURRENT plans.

## Gemini Review

# Cross-AI Plan Review: Phase 21 "Dependency Hygiene" (CYCLE 2)

## 1. Summary
The Phase 21 operational plans (21-01 and 21-02) represent a highly disciplined, safety-critical approach to dependency management. The workflow explicitly rejects "stale green" results, enforcing a strict binding between validated commit SHAs, bot reviews, and the final merge command. The sequencing of PR #34 before the more complex PR #44 (18-package group) is architecturally sound. The addition of head-SHA binding and active polling for rebase force-pushes significantly hardens the supply-chain threat model against race conditions and stale-state approvals.

## 2. Cycle-1 HIGH Resolution Verdict

*   **(H1) Rebased-head CI freshness enforcement:** **RESOLVED**
    *   **Closing Mechanism:** Plan 21-02, Task 1, Steps 1b, 3a, and 3b. The executor now captures `OLD_SHA` before rebasing, polls `headRefOid` until a `NEW_SHA` is detected, and explicitly binds all CI evaluations and `statusCheckRollup` checks to `NEW_SHA`. Furthermore, Task 3 implements `gh pr merge 44 --merge --match-head-commit <NEW_SHA>`, providing a cryptographic guarantee that the merged commit is exactly the one validated.
*   **(H2) Bot re-review requirement after force-push:** **RESOLVED**
    *   **Closing Mechanism:** Plan 21-02, Task 2, Step 6. The plan now mandates that each required bot (CodeRabbit, gemini-code-assist, greptile) has a review entry where `commit_id` matches `NEW_SHA`. It includes a fallback to `submitted_at` timestamps relative to the force-push event, ensuring that stale reviews against the pre-rebase commit cannot satisfy the merge gate.

## 3. New Concerns

*   **[MEDIUM] `gh` CLI Version Compatibility for `--match-head-commit`**
    *   The `gh pr merge --match-head-commit` flag was introduced in `gh` v2.30.0. While the plan provides a "Manual fallback" (re-reading `headRefOid` immediately before merge), the lack of a version check in the research phase could lead to a minor execution hiccup if the environment uses an older CLI.
*   **[LOW] Bot Review `commit_id` Availability**
    *   Some GitHub Apps/Bots do not always populate the `commit_id` field in the `reviews` JSON response if they submit reviews via the "comment" or "event" streams rather than a formal PR Review object. Step 6's fallback to `submitted_at` is correct but less precise.

## 4. Suggestions

*   **Explicit `gh --version` Check:** Add a quick check in Task 1 of Plan 21-01 to ensure `gh` is >= 2.30.0 to confirm `--match-head-commit` availability.
*   **Discord Sign-in Verification:** In Plan 21-02, Task 3 (How to Verify), explicitly emphasize the Discord sign-in flow smoke test. Since `supabase-js` 2.107.0 changes the internal mutex (navigator.locks), the "Live" OAuth redirect and session resumption is the most critical runtime path to verify.

## 5. Risk Assessment: LOW
The operational risk is now **LOW**. The plans provide comprehensive coverage for the "Dependabot Force-Push Race" (T-21-11) and include robust fail-forwards (D-04) and manual rebase fallbacks. The validation bar (CI + local build + local smoke + hook test) is appropriate for the project's scale and criticality. The sequencing ensures that the dev-tooling win (PR #34) is secured before tackling the 18-package runtime group.

---

## Codex Review

## Summary

Plan 21-02 materially closes the two cycle-1 HIGH holes. The new PR #44 flow now waits for the head SHA to change before judging CI, binds CI/reviews/merge to the post-rebase SHA, and uses `--match-head-commit` at merge time. I do not see a new HIGH blocker, but I do see several operational sharp edges that should be tightened so the executor cannot accidentally satisfy the gates with incomplete `gh` data or weak smoke validation.

## Cycle-1 HIGH Resolution Verdict

**H1: Rebased-head CI freshness — RESOLVED**

Closed by Plan 21-02 Task 1:

- Step 1b captures `OLD_SHA` before `@dependabot rebase`.
- Step 3a polls `headRefOid` until it differs from `OLD_SHA`.
- Step 3b/Step 4 require green CI to be bound to `NEW_SHA`, not stale run `26865651805`.
- Task 3 re-reads `MERGE_SHA` and aborts if it differs from validated `NEW_SHA`.
- Merge uses `gh pr merge 44 --merge --match-head-commit "$MERGE_SHA"`.

This addresses the stale `gh pr checks --watch` latch risk.

**H2: Bot re-review after force-push — RESOLVED, with command hardening recommended**

Closed by Plan 21-02 Task 2 Step 6:

- Requires CodeRabbit, gemini-code-assist, and greptile reviews against the post-rebase `NEW_SHA`.
- Explicitly rejects stale pre-rebase reviews.
- Falls back to `submitted_at` after rebase force-push timestamp if commit ID is unavailable.
- Task 3 requires merge SHA to match the SHA that was both CI-validated and bot-reviewed.

The policy is correct. The plan should add exact `gh api`/GraphQL commands because `gh pr view --json reviews` may not reliably expose review commit IDs in every CLI/version shape.

## New Concerns

- **MEDIUM:** The exact SHA-binding commands are under-specified. `gh pr view --json statusCheckRollup` may not expose `headSha`/commit OID in a convenient form, and `gh pr view --json reviews` may not expose review commit IDs consistently. The plan's logic is correct, but the executor needs deterministic commands.

- **MEDIUM:** The fallback from `--match-head-commit` to plain `gh pr merge 44 --merge` reintroduces a small TOCTOU race. If the local `gh` lacks `--match-head-commit`, the safer fallback is to upgrade `gh` or use the GitHub API with expected head OID, not plain merge.

- **MEDIUM:** PR #34 does not have the same lightweight head-SHA merge protection. It should capture `SHA34`, verify CI/bot reviews/local validation against it, then merge with `--match-head-commit "$SHA34"`.

- **MEDIUM:** The local app smoke is weaker than D-03 says. "Server starts" is not the same as "app loads and auth/suggestion list flows appear intact." CI e2e reduces the risk, but the plan should require a browser/Playwright smoke or make the operator visual smoke mandatory, not optional.

- **MEDIUM:** `gh pr diff 44 -- package.json package-lock.json` is likely not valid `gh pr diff` pathspec syntax. Use local checkout plus `git diff origin/main...HEAD -- package.json package-lock.json`, or a documented `gh api` approach.

- **LOW:** The lint-staged test says "append and immediately remove" a change, which can leave no staged diff and cause lint-staged to skip. Leave a harmless staged change, run `npx lint-staged --verbose`, then restore both index and worktree.

- **LOW:** In D-04/fix-forward paths, recapture and rename the current validated head as `FINAL_SHA` after every push. The plan mostly implies this, but the `NEW_SHA` wording can become stale after fix-forward commits.

- **LOW:** `gh pr list --author app/dependabot --state open` before merging #44 should show PR #44 itself, not empty. Clarify that Task 2 expects "only #44 remains"; post-merge expects empty.

## Suggestions

Add exact commands for CI SHA binding, review SHA binding, and merge SHA protection. Make `--match-head-commit` mandatory for both PRs. Strengthen the app smoke to actually load the UI. Replace the PR diff pathspec command with a local `git diff` command. Record a rebase timestamp or commit date explicitly for the review freshness fallback.

## Risk Assessment

**Overall risk: LOW-MEDIUM.**

The original HIGH stale-CI and stale-review hazards are closed at the policy level. Remaining risk is mostly executor error from ambiguous CLI data extraction and a few weaker validation steps, not a fundamental sequencing or threat-model failure. With the suggested command hardening, this becomes LOW.

---

## Consensus Summary

Both reviewers independently confirm that the two cycle-1 HIGH concerns are now **RESOLVED** at the policy level, and **neither reviewer raised a new HIGH concern**. The convergence loop has reached zero unresolved HIGHs.

### Cycle-1 HIGH Resolution (both reviewers agree)

| Cycle-1 HIGH | Gemini | Codex | Closing mechanism |
|--------------|--------|-------|-------------------|
| H1 — rebased-head CI freshness | RESOLVED | RESOLVED | Plan 21-02 Task 1 Steps 1b/3a/3b: capture OLD_SHA, poll headRefOid until NEW_SHA, bind statusCheckRollup to NEW_SHA; Task 3 `--match-head-commit` |
| H2 — bot re-review after force-push | RESOLVED | RESOLVED | Plan 21-02 Task 2 Step 6: each bot review commit_id == NEW_SHA (submitted_at fallback); stale reviews re-requested |

### Agreed Strengths
- Head-SHA binding (OLD_SHA → NEW_SHA → MERGE_SHA) comprehensively closes the dependabot force-push race (T-21-11) (both).
- `--match-head-commit` at merge gives a hard guarantee the merged commit equals the validated/reviewed commit (both).
- #34-before-#44 sequencing (D-02) is sound — secure the dev-only quick win before the heavier 18-package runtime group (both).
- Validation bar (CI + local build + smoke + hook test) is appropriate for the $0 hobby-scale app (both).

### Agreed Concerns (MEDIUM — non-blocking)
- **`--match-head-commit` robustness** (both): flag requires `gh` >= 2.30.0; the plain-`gh pr merge` fallback reintroduces a small TOCTOU window. Suggest a `gh --version` precheck and prefer a GitHub-API-with-expected-OID fallback over plain merge.
- **SHA-extraction command precision** (Codex, echoed by Gemini's commit_id-availability note): `statusCheckRollup` / `reviews` JSON may not expose commit OIDs in a convenient/consistent shape across `gh` versions; add exact `gh api`/GraphQL commands so the executor cannot satisfy the gate on missing data.

### Divergent Views
- **Local smoke strength:** Codex rates the "server starts" smoke as weaker than D-03's "auth/suggestion list flows appear intact" and recommends a mandatory browser/Playwright smoke; Gemini accepts the current bar as appropriate for project scale (noting CI e2e backstops it) and only asks to emphasize the Discord sign-in path. Treat as a MEDIUM hardening suggestion, not a blocker — CI e2e already exercises these flows.
- **Overall risk rating:** Gemini = LOW; Codex = LOW-MEDIUM (converging to LOW after the command-hardening suggestions). No disagreement on mergeability.

### Non-blocking polish (LOW) worth folding in before execution
- lint-staged hook test: leave a real staged change and use `npx lint-staged --verbose` (an "append then remove" leaves no staged diff and lint-staged would skip).
- Replace `gh pr diff 44 -- package.json package-lock.json` pathspec with a local `git diff origin/main...HEAD -- package.json package-lock.json`.
- Apply the same SHA-binding/`--match-head-commit` protection to PR #34 (currently only #44 has it).
- After any D-04 fix-forward push, recapture the validated head as the new bound SHA (NEW_SHA can go stale after fix-forward commits).
- Clarify the `gh pr list --author app/dependabot --state open` expectation: "only #44 remains" pre-merge, empty post-merge.

### Verdict
**0 unresolved HIGH concerns.** Both cycle-1 HIGHs are resolved; no new HIGHs introduced. The remaining MEDIUM/LOW items are command-precision and smoke-strength hardening that reduce executor-error risk but do not block a safe merge. Convergence loop may exit on HIGH count.
