---
phase: 21
reviewers: [gemini, codex]
reviewed_at: 2026-06-05T22:25:00Z
plans_reviewed: [21-01-PLAN.md, 21-02-PLAN.md]
---

# Cross-AI Plan Review — Phase 21 (Dependency Hygiene)

> Operational phase — ships NO new application code. Merges two open dependabot PRs
> (#34 lint-staged 16→17 = DEP-02; #44 the 18-package minor+patch group = DEP-01).
> Reviewers were asked to judge operational correctness of the gh CLI rebase/merge flow,
> decision coverage (D-01..D-04), the D-03 validation bar, the supply-chain threat model,
> and the #34-before-#44 sequencing — NOT source-code bugs.
>
> Cursor was invoked but failed (exit 1, empty output — CLI auth/mode). Two independent
> reviewers (Gemini, Codex) completed and are synthesized below.

## Gemini Review

### 1. Summary
The implementation plans for Phase 21 are operationally sound, highly disciplined, and accurately address the complexities of the current workspace state. The strategy of merging the independent, green `lint-staged` PR (#34) before tackling the stale, 18-package group PR (#44) minimizes risk and adheres to the sequencing requirements. The diagnosis of the stale CI failure on #44 (attributing it to missing `keepNames` configurations from Phase 16) is technically robust and justifies the "rebase-first" approach. The inclusion of local validation steps (pre-commit hook tests and sourcemap verification) ensures a significantly higher quality bar than CI-green alone.

### 2. Strengths
- **Logical Sequencing:** Explicitly enforces D-02 by making Plan 21-02 dependent on the successful completion (non-null `mergedAt`) of Plan 21-01.
- **Precise Root-Cause Analysis:** The identification of the `verify-sourcemap-names.mjs` failure on #44 as a "stale branch" issue rather than a dependency regression is excellent. This prevents wasted time on unnecessary troubleshooting.
- **Validation Depth:** Plan 21-01 goes beyond simple builds to perform a practical test of the `lint-staged` v17 hook, which is critical for a dev-tooling upgrade.
- **Clear Fallback Logic:** Plan 21-02 provides a structured hypothesis-driven path (H1-H4) and a manual rebase fallback if the Dependabot automation fails to trigger.
- **Strategic Use of GH CLI:** The plans make efficient use of `gh pr checks --watch` and comment-based triggers, which is the most idiomatic way to interact with Dependabot.
- **Comprehensive Threat Model:** The STRIDE registers correctly identify the supply-chain risks inherent in bulk dependency updates and provide appropriate mitigations (author verification, legitimacy audits, and tripwire CI).

### 3. Concerns
- **Dependabot Rebase Latency (MEDIUM):** When Plan 21-02 triggers a rebase via comment, there is often a 30-120 second delay before Dependabot actually force-pushes. `gh pr checks --watch` might accidentally pick up the *previous* (stale) run if it hasn't been superseded yet.
- **Background Process Smoke Tests (LOW):** The "local app smoke" via `npm run dev` can be tricky in a CLI-only environment. Ensure the agent knows to look for a specific log string (e.g., "Vite ready") and then terminate the process rather than hanging.
- **Force-Push / Force-with-Lease (LOW):** While the manual fallback uses `--force-with-lease`, if the agent performs a manual rebase, it might inadvertently clear the "Review required" status on some branch-protected repositories, requiring a re-trigger of the bot reviews.

### 4. Suggestions
- **Commit-Hash Verification:** In Plan 21-02 Task 1, after commenting for a rebase, the agent should poll `gh pr view 44 --json headRefOid` until the hash changes. This ensures the "NEW CI run" being watched is actually associated with the rebased code.
- **Race Condition Mitigation:** Before the final `gh pr merge` in both plans, the agent should perform one last `gh pr checks` call to ensure a new commit wasn't pushed by Dependabot *during* the local smoke test phase.
- **Clean Slate:** Add a step to run `git clean -fdx` or at least `rm -rf node_modules` between the two plans (or before `npm ci` in each) to ensure that stale artifacts from the previous dependency state don't pollute the validation of the next merge.

### 5. Risk Assessment
**Overall Risk: LOW**

The risk is low because: (1) the changes are limited to devDependencies and minor/patch updates of existing, audited packages; (2) the validation suite (403 tests) is currently healthy (as of Phase 18); (3) the plan explicitly prohibits "silent drops" and requires operator approval before final merges; (4) the rebase-first strategy for #44 is the correct technical remedy for the observed sourcemap failures. The main operational risk is CI flakiness or GitHub API latency, both addressed by manual fallbacks and watching/polling strategies.

**Plan Status: APPROVED for Execution (incorporate Suggestions for maximum robustness).**

---

## Codex Review

### PLAN 21-01 Review

**Summary**
Plan 21-01 is operationally sound for DEP-02 and correctly treats PR #34 as a low-risk, dev-only dependency bump that still requires more than CI green. It covers D-02 and D-03 well, includes the specific lint-staged v17 compatibility checks, and preserves the required human approval gate before merge. Main weakness: the bot-review and merge-readiness checks should be tied to the current PR head SHA to avoid approving stale reviews after any dependabot push.

**Strengths**
- Correct sequencing: #34 before #44.
- Good validation bar: CI, local `npm ci`, build, dev startup smoke, and explicit lint-staged/pre-commit validation.
- Correct lint-staged v17 interpretation: Node floor surfaced, `bash -c` not confused with removed `--shell`.
- Human approval checkpoint is explicit and blocking.
- Supply-chain framing is appropriate for a devDependency hook tool.

**Concerns**
- **MEDIUM:** Bot review verification via `gh pr view 34 --json reviews` may not prove all required bots reviewed the latest head commit.
- **MEDIUM:** Plan should verify PR author/head repo before checkout/merge, not only in the threat model.
- **LOW:** `npx lint-staged` tests lint-staged behavior, but it is not exactly the Git pre-commit hook path unless the hook itself is also invoked or inspected.
- **LOW:** `gh pr merge 34 --merge` can still race with a new commit pushed after approval unless head SHA is checked immediately before merging.

**Suggestions**
- Capture `headRefOid` before validation and re-check it before merge.
- Add `gh pr view 34 --json author,headRefName,headRepositoryOwner,baseRefName,headRefOid,mergeStateStatus`.
- Verify reviews/checks are for the same `headRefOid`.
- Prefer testing the actual hook path if practical (a controlled commit attempt that is aborted/reset afterward, or at least verify the hook invokes lint-staged).
- Use `gh pr merge 34 --merge --match-head-commit <sha>` if available; otherwise manually re-check `headRefOid` immediately before merge.

**Risk Assessment**
**LOW.** The bump is narrow and dev-only, validation is strong, and the approval gate is explicit. Remaining risk is mostly operational race/staleness around reviews and PR head changes.

### PLAN 21-02 Review

**Summary**
Plan 21-02 correctly implements the key operational decision: merge #34 first, then rebase #44 instead of judging stale CI. The stale-CI diagnosis is coherent given the described sourcemap-name failure and the missing `keepNames` base change. The plan's fallback path is reasonable, but it needs tighter race controls around dependabot rebasing, CI run freshness, bot re-review after new commits, and lockfile/version drift after rebase.

**Strengths**
- Correctly enforces dependency on #34 being merged first.
- Correctly avoids rerunning the stale failed commit.
- `@dependabot rebase` as preferred path is appropriate and lower-risk than manual force-push.
- Local validation includes build, sourcemap verification, and app startup smoke.
- D-04 is represented: fix-forward first, isolate only a genuinely blocking package, and flag it.
- Threat model includes force-push risk and package-group tampering.

**Concerns**
- **HIGH:** After `@dependabot rebase`, the plan must explicitly wait for the PR head SHA to change and ensure CI results correspond to that new SHA.
- **HIGH:** Bot reviews must be revalidated after the rebase/force-push. Prior bot reviews on the stale commit should not satisfy the merge gate.
- **MEDIUM:** Dependabot rebase may update the lockfile to newer package patch versions than the originally reviewed diff. The plan should compare package and lockfile deltas after rebase.
- **MEDIUM:** Manual fallback with `git rebase origin/main + npm install + force-with-lease` is valid, but should include author/branch verification and final diff review before pushing.
- **MEDIUM:** `gh pr checks 44 --watch` may return checks from the current visible head, but the plan should still verify check conclusions against `headRefOid` to avoid timing ambiguity.
- **LOW:** If CI does not auto-trigger after rebase, the plan needs an explicit fallback such as closing/reopening, empty commit, or manual workflow dispatch if supported.
- **LOW:** `gh pr list --author app/dependabot --state open` before merge is useful, but the zero-open-dependabot criterion only matters after both merges.

**Suggestions**
- Record old and new `headRefOid`; proceed only after rebase produces the expected new head.
- Validate `statusCheckRollup`/checks against the new head SHA, not just PR number.
- Require fresh bot review after the final #44 head commit.
- Add a post-rebase diff check: compare `package.json`, compare `package-lock.json`, confirm the 18-package group is still the intended set, flag any unexpected version drift.
- Use `gh pr merge 44 --merge --match-head-commit <sha>` where supported.
- If D-04 isolation is triggered, require a new CI cycle and bot/operator review on the reduced package set.
- Add an explicit merge-conflict branch: if dependabot rebase fails, inspect conflicts, prefer mechanical lockfile regeneration, avoid hand-editing package-lock beyond npm output.

**Risk Assessment**
**MEDIUM.** The plan is directionally correct and likely to work, especially given the stale sourcemap diagnosis. Risk remains around rebased-head freshness, bot re-review timing, and possible lockfile/version drift introduced by dependabot during rebase.

### Overall Assessment
The two-plan sequence correctly implements D-01 through D-04 and respects the required #34-before-#44 ordering. The validation bar is appropriate for this operational phase: CI green plus local build/smoke, with the special lint-staged hook test for #34. The biggest improvement is to make every approval, review, CI result, and merge action explicitly bound to the final PR head SHA. That closes most race conditions: dependabot pushing mid-review, stale bot reviews, stale checks, and accidental merge of a different dependency diff than the operator approved.

---

## Cursor Review

Cursor CLI was invoked (`cursor agent -p --mode ask --trust`) but exited non-zero with empty output (likely an auth/headless-mode limitation in this environment). No review produced. Skipped per the workflow's continue-on-failure policy.

---

## Consensus Summary

Both reviewers independently conclude the two-plan sequence is **operationally sound and correctly implements D-01 through D-04** with the required #34-before-#44 ordering. The stale-CI root-cause diagnosis (the `verify-sourcemap-names.mjs` failure traces to the pre-Phase-16 base lacking `keepNames:true`, NOT the 18 bumped packages) is judged technically robust by both, validating the rebase-first approach. The single dominant, agreed-upon weakness is **head-SHA binding**: every review/CI-result/merge action should be explicitly tied to the final PR head commit to eliminate races introduced by dependabot's force-push during rebase.

### Agreed Strengths
- Correct #34-before-#44 sequencing (D-02), with Plan 21-02 hard-gated on #34's non-null `mergedAt`.
- Sound, definitive stale-CI root-cause diagnosis (keepNames / Phase-16 base) — rebase-first is the right remedy (D-01).
- Strong D-03 validation bar: CI green PLUS local `npm ci` + `npm run build` + app-startup smoke, with the dedicated lint-staged v17 pre-commit hook test for #34.
- Explicit, blocking human-approval merge gate on both PRs.
- D-04 fix-forward-then-isolate-and-flag path is represented with ordered fallback hypotheses (H1–H4) and a manual-rebase fallback.
- Reasonable supply-chain STRIDE registers (author verification, legitimacy audit, CI tripwire, force-with-lease).

### Agreed Concerns (highest priority — race conditions around the dependabot rebase)
1. **[HIGH — Codex; MEDIUM — Gemini] Rebased-head freshness for #44.** After `@dependabot rebase`, `gh pr checks 44 --watch` can latch onto the pre-rebase (stale) run. The plan must poll `gh pr view 44 --json headRefOid` until the head SHA changes, then bind all CI evaluation to that new SHA — not merely "a run ID different from 26865651805."
2. **[HIGH — Codex] Bot re-review after force-push on #44.** A rebase force-pushes a new head; prior bot reviews (CodeRabbit / gemini-code-assist / greptile) were against the stale commit and should NOT satisfy the merge gate. The plan must require fresh bot reviews bound to the final #44 head SHA.
3. **[MEDIUM — both] Merge-time race / head-SHA binding on both PRs.** Between operator "approved" and `gh pr merge`, dependabot (or a security bump) could push a new commit. Re-check `headRefOid` immediately before merge; prefer `gh pr merge --merge --match-head-commit <sha>` where the local `gh` supports it.
4. **[MEDIUM — Codex] Post-rebase package/lockfile drift on #44.** Dependabot's rebase can advance package/lockfile versions beyond what was originally reviewed. Add a post-rebase diff of `package.json` + `package-lock.json` to confirm the 18-package set is unchanged and flag unexpected drift.
5. **[LOW — both] Operational hygiene:** background smoke-server termination (watch for "ready" string then kill), `rm -rf node_modules` / clean slate between the two `npm ci` runs, and an explicit fallback if CI does not auto-trigger after rebase (empty commit / close-reopen / workflow dispatch).

### Divergent Views
- **Overall risk rating for Plan 21-02:** Gemini rates the whole phase **LOW**; Codex rates Plan 21-02 **MEDIUM** (21-01 LOW) specifically because of the rebased-head-freshness and bot-re-review timing. The divergence is one of severity weighting on the same root issue (head-SHA binding), not a substantive disagreement about facts — Gemini surfaces the identical race as a MEDIUM concern + suggestion, while Codex elevates two facets of it to HIGH.
- No reviewer disputed the stale-CI diagnosis, the decision coverage, or the sequencing.

### Recommended Plan Edits (to clear the HIGH concerns before execution)
- **21-02 Task 1:** capture `OLD_SHA=$(gh pr view 44 --json headRefOid -q .headRefOid)` before the rebase comment; after `@dependabot rebase`, poll until `headRefOid != OLD_SHA`; only then watch CI, and assert the green `statusCheckRollup` belongs to the new head SHA.
- **21-02 Task 2:** require bot reviews submitted against the post-rebase head SHA (compare each review's commit/submittedAt to the new head); stale-commit reviews do not count.
- **21-02 Task 1 (after rebase):** diff `package.json` and `package-lock.json` vs. the originally-reviewed state; confirm exactly the intended 18-package set; flag any version drift to the operator checkpoint.
- **Both plans, merge step:** re-read `headRefOid` immediately before `gh pr merge`; use `--match-head-commit <sha>` if supported, else abort and re-validate if the head changed since approval.
