---
phase: 13
reviewers: [gemini, codex]
reviewers_skipped:
  - claude (running inside Claude Code CLI — skipped for independence)
  - coderabbit (no diff to review — clean working tree)
  - cursor (usage limit reached)
reviewed_at: 2026-05-13T16:42:01Z
plans_reviewed:
  - 13-01-PLAN.md
  - 13-02-PLAN.md
---

# Cross-AI Plan Review — Phase 13

## Gemini Review

# Phase 13 Plan Review: UIDN-02 Mobile Audit Closure

## 1. Summary
The implementation plans for Phase 13 are exceptionally rigorous, providing a deterministic path to closing the `UIDN-02` mobile audit requirement. The strategy effectively addresses the "Plan 02" harness defect (loading-shell captures) by replacing fragile text-based waits with a stable Navbar sentinel and a fail-fast sha256 uniqueness gate. The dual-context approach for authenticated screenshots ensures high-fidelity evidence of the voter UI. The plans are notable for their meticulous handling of outcome-conditional documentation updates, ensuring the project's state remains "honest" regardless of whether the Lighthouse Performance target is met.

## 2. Strengths
*   **Deterministic Hydration Sentinel:** Utilizing the `[aria-label="Toggle color theme"]` selector is an excellent solution that adheres to the "zero-src/-edits" constraint while providing a stable post-hydration marker.
*   **Fail-Fast Integrity Gate:** The addition of the sha256 uniqueness check directly targets the signature of the previous failure mode (identical loading shells), preventing bad data from being recorded in the manifest.
*   **Voter-UI Fidelity:** Splitting Pass-B into two Playwright contexts (`adminUser` vs. `memberUser`) correctly captures the distinct UI states (e.g., presence/absence of the Admin link), which is critical for audit accuracy.
*   **Robust Branching Logic:** Plan 13-02 provides exhaustive, copy-pasteable wording for both PASS and MISS scenarios, significantly reducing the risk of inconsistent documentation across `PROJECT.md`, `REQUIREMENTS.md`, and the evidence file.
*   **Environmental Awareness:** The "Human-verify" checkpoint in Plan 13-01 Task 2 correctly identifies and mitigates the risk of the local preview/Supabase server dependency.

## 3. Concerns
*   **Strict Floor Variance (LOW):** The decision to enforce a strict ≥ 90 floor (D-11) without a variance buffer (D-14 analog) is a high-integrity choice, but given Lighthouse's inherent volatility (±5–10pp), there is a non-negligible chance of a "technical miss" (e.g., 89) that requires a follow-up. The plan handles the *documentation* of this well, but it may result in the requirement staying active longer than necessary if scores oscillate.
*   **Harness Forensics (LOW):** The plan calls for `process.exit(1)` *before* the `MANIFEST.json` write on a dupe-fail. While this keeps the manifest clean, it may make debugging harder for the operator if they want to see the hash collisions recorded in a structured way. *Mitigation: The console output lists the collision groups explicitly.*
*   **Local Secret/Env Dependency (MEDIUM):** The harness requires `VITE_SUPABASE_ANON_KEY`. If the operator's local environment differs from the expected `supabase status` output format, the `export` command provided in the checkpoint might fail.

## 4. Suggestions
*   **Artifact Cleanup Verification:** In Plan 13-01 Task 2, explicitly verify that the `screenshots/` directory is empty *before* the run starts to ensure no stale files from crashed previous attempts contaminate the dupe-check (though the code does `rm -rf`, a manual check adds safety).
*   **Lighthouse Performance Context:** If a "MISS" occurs, it would be beneficial to add a small note in the evidence file's `### Lighthouse mobile scores` section comparing the v1.2 scores to the v1.1 baseline to show if the trend is improving, even if the target hasn't been hit.
*   **Manifest Atomic Check:** In Plan 13-02 Task 4, add a verification step to ensure `git diff --cached` includes `MANIFEST.json` specifically, as it is the primary record of the audit run's validity.

## 5. Risk Assessment: LOW
The risk is classified as **LOW**. The plans are prescriptive, well-researched, and include built-in validation gates. The primary "risks" are environmental (Lighthouse scores or local setup issues), both of which are anticipated and handled through branching logic and interactive checkpoints. The plan does not touch production source code, eliminating the risk of application regressions.

---

## Codex Review

## Summary

The plans are detailed, well-scoped to planning artifacts, and mostly aligned with the Phase 13 goal. The main structure is sound: fix the screenshot harness, produce a clean 42-PNG corpus, run the locked Lighthouse audit once, then update evidence and decision rows. However, there are two serious execution risks: the proposed global sha256 uniqueness gate will likely fail on an intentional `/` vs unauth `/admin` duplicate, and Plan 13-02's automated verify step appears to rerun Lighthouse, directly violating the single-run policy.

## Strengths

- Strong dependency ordering: harness fix before screenshot rerun, screenshot evidence before Lighthouse/doc updates.
- Good preservation of scope: no `src/` edits, no CI expansion, no Lighthouse flag tuning.
- The sentinel choice is grounded in existing code. The Navbar theme toggle is present at `src/components/layout/Navbar.tsx:74`.
- Two-context Pass-B design is correct for separating admin and member UI evidence.
- Evidence disposition handles both pass and miss outcomes instead of assuming scores will clear 90.
- `audit-mobile.sh` already upserts Lighthouse report hashes into `MANIFEST.json`, which supports the artifact trail.

## Concerns

### Plan 13-01

- **HIGH:** The global sha256 dupe check will likely false-fail because unauth `/admin` redirects to `/`, while `/` unauth also renders the landing page. `AdminGuard` returns `<Navigate to="/" />` for unauth users at `src/components/auth/AdminGuard.tsx:17`, and `/` renders `LandingPage` for unauth users at `src/routes/index.tsx:22`. Keeping `/admin` while requiring all 42 PNGs to be unique is probably incompatible.
- **MEDIUM:** The plan text says `/topics` and `/archive` "redirect" unauth users to `/`, but `AuthGuard` renders `LandingPage` in place without navigation at `src/components/auth/AuthGuard.tsx:17`. Dropping them is still reasonable, but the rationale and evidence language should be corrected.
- **MEDIUM:** The must-have says fixture constants should be imported from `e2e/fixtures/test-users.ts`, while the task says not to import and to inline them. Since this is a `.mjs` script and the fixture file is TypeScript, inline-with-source-comment is probably the right implementation, but the acceptance text should stop saying "imported."
- **MEDIUM:** The soft sentinel `.catch(() => {})` can still allow a shell screenshot if the sentinel never appears. The dupe check is useful, but it is not route-specific and may miss single-route shell captures. Sentinel misses should be logged into `warnings[]` at minimum.
- **LOW:** The `grep -A 10 "const UNAUTH_ROUTES" ... | grep -c "path:"` validation is brittle once comments are added. It can undercount or pass for the wrong reason.

### Plan 13-02

- **HIGH:** Task 1's verify command runs `bash audit-mobile.sh` again. That violates D-13 single-run policy and can change the official scores. Verification should inspect the reports produced by the one action run, not execute the audit again.
- **HIGH:** Many plan paths point to `/Users/khaiphan/code/wtcs-community-polls/...`, but the active workspace is the worktree under `.claude/worktrees/...`. Following those absolute paths risks editing the wrong checkout or failing under workspace-write permissions.
- **MEDIUM:** PASS/MISS logic is underspecified if Performance passes but A11y, Best Practices, or SEO fails. `audit-mobile.sh` fails any category below threshold at `.planning/closure/audit-mobile.sh:54`, while the doc wording focuses on Perf ≥ 90.
- **MEDIUM:** Both plans require `13-01-SUMMARY.md` and `13-02-SUMMARY.md`, but those files are not included in `files_modified` or the atomic commit file list. Either commit them or remove them as required outputs.
- **LOW:** `audit-mobile.sh` still has a stale comment saying the D-14 ship-anyway analog applies at `.planning/closure/audit-mobile.sh:7`. Leaving the script unchanged is acceptable, but the comment conflicts with Phase 13's strict-floor policy.
- **LOW:** `GitHub PR #XX` is not knowable before push/PR creation. Avoid committing a placeholder unless there is a follow-up step to replace it.

## Suggestions

- Revise the dupe-check rule before execution. Either drop unauth `/admin`, or whitelist the intentional `bp-{width}-home.png` plus `bp-{width}-admin.png` collision and fail all other collisions.
- Correct the unauth route rationale: `/topics` and `/archive` render the landing page in place; `/admin` navigates to `/`.
- Replace Plan 13-02's verify command with report inspection, for example `jq` over existing `.report.json` files and `ls` counts. Do not invoke `audit-mobile.sh` in `<verify>`.
- Capture the single Lighthouse run output with `tee` while preserving exit status, or save stdout manually. Then use that saved output for evidence.
- Change all absolute plan paths to repo-relative paths or `$PWD/...` rooted in the current worktree.
- Align fixture wording: "inline constants mirrored from `e2e/fixtures/test-users.ts`" rather than "imported."
- Define a separate branch for infra failure: if Lighthouse crashes or fewer than 5 JSON reports exist, fix the environment and rerun; that is not score gaming.
- Add summaries to the final commit list if they are required artifacts.

## Risk Assessment

Overall risk: **HIGH** until the dupe-check and Lighthouse rerun issues are fixed.

The product/security risk is low because the work is confined to closure scripts and planning docs. The execution/evidence risk is high: the current plan can fail the screenshot harness on an intentional duplicate, and the Lighthouse verification step can invalidate the single-run audit policy. Once those two issues are corrected, the plan drops to medium-low risk.

---

## Consensus Summary

Gemini rates overall risk **LOW** while Codex rates it **HIGH**, primarily because Codex grounded its review in the actual codebase (route guards, audit-mobile.sh internals) and identified two execution-blocking defects that Gemini's higher-level read missed. Both reviewers agree the plans are well-scoped, dependency-ordered, and rigorous in documentation handling; both flag environmental fragility around local Supabase env vars; and both endorse the sentinel + sha256 strategy in principle. The substantive divergence is in execution mechanics, where Codex's source-level evidence carries more weight.

### Agreed Strengths

- **Deterministic sentinel choice** — both reviewers endorse `[aria-label="Toggle color theme"]` as a stable, zero-src-edit post-hydration marker grounded in existing Navbar code.
- **sha256 fail-fast gate** — both reviewers endorse the integrity check as the right antidote to the v1.1 loading-shell defect (Gemini explicitly; Codex implicitly via accepting the strategy and only contesting the rule).
- **Two-context Pass-B (admin/member)** — both flag this as correct for capturing distinct authenticated voter-UI states.
- **PASS/MISS outcome branching** — both reviewers praise the dual-disposition wording in Plan 13-02 as integrity-preserving regardless of Lighthouse outcome.
- **Tight scope discipline** — no `src/` edits, no CI expansion, no Lighthouse flag tuning; dependency ordering (harness fix → screenshots → audit → docs) is sound.

### Agreed Concerns

- **Local environment fragility (MEDIUM, both reviewers)** — Plan 13-01's reliance on `VITE_SUPABASE_ANON_KEY` from `supabase status` is brittle if the operator's local shell differs from the expected format. Gemini explicitly MEDIUM; Codex implicitly via the human-verify checkpoint discussion.

### Divergent Views

- **Overall risk (LOW vs HIGH)** — The single largest divergence. Gemini sees the plans as ready to execute; Codex identifies two HIGH-severity defects that would cause the plan to fail or violate locked decisions on first run. Worth resolving before execution.
- **sha256 dupe-check rule (Codex HIGH; Gemini silent)** — Codex grounds the concern in actual route-guard source code (`AdminGuard.tsx:17` redirects unauth `/admin` to `/`, which also renders `LandingPage`). The intentional `bp-{width}-home.png` vs `bp-{width}-admin.png` collision would fail a strict global uniqueness check. Gemini did not catch this because it did not inspect the auth-guard code.
- **Lighthouse single-run violation (Codex HIGH; Gemini silent)** — Codex flags that Plan 13-02's `<verify>` block invokes `bash audit-mobile.sh` again, which violates D-13 single-run policy and could change official scores. Gemini did not detect this defect.
- **Absolute path drift (Codex HIGH; Gemini silent)** — Codex notes that plan paths point to `/Users/khaiphan/code/wtcs-community-polls/...` while the active workspace is the `.claude/worktrees/...` checkout. Following them risks editing the wrong checkout. Gemini did not surface this.
- **Multi-category PASS/MISS underspec (Codex MEDIUM; Gemini silent)** — Codex notes the doc wording focuses on Performance ≥ 90 but `audit-mobile.sh` fails any category below threshold, leaving A11y/Best Practices/SEO miss handling underspecified.
- **Plan 13-NN-SUMMARY.md commit list gap (Codex MEDIUM; Gemini silent)** — Codex notes the summaries are required outputs but missing from the atomic commit `files_modified` list.

### Recommended Actions Before Execute

1. **Resolve dupe-check rule** — Either remove unauth `/admin` from `UNAUTH_ROUTES`, or whitelist the intentional `bp-{width}-home.png` ↔ `bp-{width}-admin.png` collision pair and fail on all others.
2. **Replace Plan 13-02 verify command** — Inspect existing `.report.json` files with `jq` instead of re-invoking `audit-mobile.sh`; preserve single-run policy.
3. **Switch absolute plan paths to repo-relative** — Use `$PWD/...` or `.planning/...` paths so the plan executes correctly inside any worktree.
4. **Correct unauth-route rationale wording** — `/topics` and `/archive` render `LandingPage` in place (no navigation); only `/admin` navigates to `/`.
5. **Define multi-category MISS branch** — Specify behavior when Perf ≥ 90 but a non-Perf category fails the threshold.
6. **Add `13-01-SUMMARY.md` and `13-02-SUMMARY.md` to the Plan 13-02 atomic commit `files_modified` list** (or drop them as required outputs).
7. **Reconsider strict floor vs variance buffer** (Gemini LOW) — Acknowledge in evidence file that a 89 is a "technical miss" so future cycles do not chase noise.
