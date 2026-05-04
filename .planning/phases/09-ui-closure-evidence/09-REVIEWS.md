---
phase: 9
reviewers: [gemini, codex, cursor]
reviewed_at: 2026-05-04T16:21:30Z
plans_reviewed:
  - 09-01-PLAN.md
  - 09-02-PLAN.md
  - 09-03-PLAN.md
  - 09-04-PLAN.md
note: |
  This is a refresh of the prior REVIEWS.md (committed earlier in Phase 9). The
  plans were revised between rounds to address several HIGH concerns flagged in
  the prior cycle (notably: Lighthouse pinning to 13.2.0, F1 / Decision A
  MANIFEST.json convention, F2 / Decision B Path-1/3/4 hard gate, F3a/F3b
  preflight build-order + additive seed step, DOM-assertion mustSee in the
  screenshot harness). This refresh re-runs Gemini + Codex + Cursor against the
  current plan revisions to confirm closure or surface residual gaps. CodeRabbit
  returned "No files found for review" (clean main branch — no diff to review)
  and is omitted from this refresh.
---

# Cross-AI Plan Review — Phase 9 (UI Closure Evidence)

## Gemini Review

# Cross-AI Plan Review: Phase 9 (UI Closure Evidence)

The proposed plans for Phase 9 are **highly professional, technically robust, and strictly aligned** with the project's "Hygiene & Polish" framing. They demonstrate a sophisticated understanding of the trade-offs between synthetic test variance, security, and project documentation integrity.

### 1. Summary
The Phase 9 implementation plans effectively close the carry-forward debt from v1.0 by producing high-integrity closure evidence. The strategy of "reconcile-then-audit" (Plan 01 before Plan 04) is logically sound, and the decision to keep the audit harness as standalone milestone artifacts respects the $0 budget/minimal-dependency constraint. The hard-gated verification logic for `PROJECT.md` flips ensures that the project state is updated only when the empirical evidence (Lighthouse/Playwright) or a signed-off override exists.

### 2. Strengths
*   **Security Discipline:** The use of the Phase 8 `addInitScript` pattern for in-memory session injection in the screenshot harness is a major security win, preventing sensitive fixture tokens from ever touching the disk.
*   **Audit Integrity:** The SHA256-pinned `MANIFEST.json` is an excellent "Plan A" for documenting gitignored binary artifacts, providing a verifiable audit trail without bloating the repository.
*   **Deterministic Configuration:** Encoding routes and thresholds as top-of-file data blocks in the scripts (Plan 02) ensures re-runnability without the complexity of CLI flag parsing.
*   **Atomic State Transitions:** Committing evidence files atomically with their corresponding `PROJECT.md` row flips (Plans 03 and 04) follows the successful Phase 7 OBSV-02 pattern and maintains documentation consistency.
*   **Scope Protection:** The strict adherence to the "no-restyle" scope guard (ROADMAP SC #5) is maintained throughout, particularly in UIDN-04's documentation-only reconciliation.

### 3. Concerns
*   **Build-Time Environment Sensitivity (MEDIUM):** In Plan 03, the operator must set `VITE_SUPABASE_*` environment variables *before* running `npm run build`. If the build is executed first, the resulting bundle will be baked with `undefined` values, causing the auth-pass screenshots to fail. While Task 0 covers this, it remains a high-friction point for the human operator.
*   **Lighthouse Performance Variance (LOW):** Synthetic audits against production can be influenced by Netlify cold starts or CDN latency. There is a risk that a perfectly responsive UI could "fail" its first run due to infrastructure noise, requiring unnecessary D-14 overrides.
*   **Artifact Manual Toil (LOW):** The 84-cell checklist in Plan 04 is a high-concentration manual task. While necessary for closure evidence, it is the most likely point for human error or inconsistent scoring across routes.

### 4. Suggestions
*   **CDN Warm-up:** Add a simple `curl -sIL` loop for all audited routes at the beginning of `audit-mobile.sh` to ensure the Netlify CDN is warm before the Lighthouse engine begins its first run.
*   **Early Env Validation:** In `audit-screenshots.mjs`, add a check to verify that `process.env.VITE_SUPABASE_URL` does not contain the literal string `"undefined"` or `"null"` to catch build-order sequencing errors before the browser launches.
*   **Detailed Failure Output:** Modify the `results` loop in `audit-mobile.sh` to print the specific sub-score that caused a FAIL (e.g., `FAIL home: P=88 < 90`) to streamline the authoring of D-14 rationale in the evidence file.

### 5. Risk Assessment
**Overall Risk: LOW.**
The technical approach is sound and the safety rails (hard gates, security boundaries, and atomic commits) are well-designed. The primary risk is human error during the manual verification steps (Task 0 build sequencing and Task 2 matrix filling), which is mitigated by clear, check-listed instructions. The plans successfully deliver on the Phase 9 goal of "audit-clean" documentation.

---
**Verdict:** Ready for execution. No structural changes required. Apply the "CDN Warm-up" suggestion to `audit-mobile.sh` for best results.

---

## Codex Review

**Summary**

The phase plan is well scoped and mostly coherent: UIDN-04 is ordered before UIDN-03, production/mobile evidence is separated from shadcn consistency evidence, and the no-restyle constraint is repeated clearly. The main risks are not scope or dependency ordering, but audit durability and gate correctness. As written, the plans can produce "closed" documentation without durable artifacts or with weakly validated evidence, especially around F1/F2 and the UIDN-03 matrix.

**Strengths**

- Clear phase ordering: UIDN-04 → UIDN-02 → UIDN-03 is preserved.
- Strong scope guard against shadcn restyle / preset migration.
- Auth screenshot pass is conceptually aligned with [e2e/helpers/auth.ts](/Users/khaiphan/code/wtcs-community-polls/e2e/helpers/auth.ts:26): same storage key derivation, `signInWithPassword`, and `addInitScript` before navigation.
- Atomic evidence + PROJECT.md row flips are the right audit pattern.
- Production-only Lighthouse target matches the closure goal.
- Security posture is mostly sound: no service-role key, no `storageState` file, fixture password is local-only, artifacts are kept out of normal git status.

**Concerns**

- **HIGH: F1 artifact policy is internally inconsistent.** Plans say `MANIFEST.json` is committed, but Plans 03/04 only `git add` the evidence file and `PROJECT.md`. The manifest will be untracked after the run and not included in the atomic evidence commit. Also, binary artifacts are gitignored, so "archived under `.planning/closure/artifacts/`" is not durable unless there is a committed manifest plus external artifact storage or committed lightweight artifacts.

- **HIGH: Path 3 defer conflicts with "closed" templates and success criteria.** Plans 03/04 allow leaving rows at `⚠️ Revisit`, but the evidence templates still say `UIDN-02 closed` / `UIDN-03 closed`, and success criteria still expect `✓ Good`. That weakens the F2 hard gate and can produce false closure.

- **HIGH: UIDN-03 matrix gate is too easy to satisfy accidentally.** Acceptance checks mostly count 12 rows, not 84 route cells, not column count, and not one-line notes. The FAIL count is read from `/tmp/uidn03-matrix.md`, not the committed evidence file. A malformed or incomplete matrix could pass and flip the shadcn row.

- **HIGH: Atomic commit hygiene misses pre-staged unrelated files.** Plan 01 checks only target file dirtiness. If unrelated files are already staged, `git commit` will include them. Same risk applies to the other plans. This breaks the auditability claim.

- **MEDIUM: Harness reliability needs tightening.** `networkidle` on production pages can hang or become flaky due to analytics/Sentry/network activity. `audit-mobile.sh` assumes `jq`, Chrome, and npm network availability without preflight. The evidence template also says `lighthouse@latest` while the script pins `lighthouse@13.2.0`.

- **MEDIUM: Screenshot auth preflight gives false confidence.** `curl http://localhost:4173/admin/suggestions/.../edit` cannot validate the authenticated SPA route because it has no injected localStorage session. The actual auth model is correct, but the preflight should be a Playwright sanity check using the same `addInitScript` path.

- **MEDIUM: UIDN-04 may under-document the "investigated" requirement.** The plan assumes D-01 (`new-york` canonical) and updates docs, but the REQUIREMENTS wording says the discrepancy is "investigated" via visual diff. If that investigation lives in research, ADR-001 should cite it explicitly.

- **MEDIUM: UIDN-03 dark-mode evidence is not durable.** Item 11 relies on manual DevTools review and Lighthouse contrast, but the screenshot harness captures only normal mode. This is acceptable for a light audit, but weak as closure evidence.

- **LOW: Summary outputs are not actually planned as committed work.** Each plan asks for `09-0x-SUMMARY.md`, but `files_modified`, tasks, and commit commands omit them. Plan 04 also says "5 plan commits" while listing four plan commits.

**Suggestions**

- Commit `.planning/closure/artifacts/MANIFEST.json` in Plans 03 and 04, or explicitly move artifacts to durable external storage and link it. If binaries remain gitignored, the manifest alone should be part of the evidence commit.

- Make F2 terminal states explicit:
  - Pass: row flips to `✓ Good`.
  - Override: row flips to `✓ Good with override`, with ROADMAP-ID.
  - Defer: evidence says "audited, not closed"; PROJECT.md stays `⚠️ Revisit`; success criteria marked partial.

- Add a small validator for UIDN-03 that checks 12 rows, 7 route cells per row, valid `PASS|FAIL|N/A` values, and FAIL count from the committed evidence file.

- Add global commit hygiene before every commit: require `git diff --cached --quiet`, or use `git commit -- path1 path2` with pathspecs.

- Harden scripts with preflight checks for `jq`, `npx`, browser availability, local preview, and env vars. Use `try/finally` around `browser.close()`.

- Replace `networkidle` with `domcontentloaded` plus route-specific selectors or bounded waits. Record final URL per screenshot.

- Fix the `warn_count` command to avoid `0\n0`: use `warn_count=$(grep -c 'WARN bp-' /tmp/uidn02-screenshots.log || true)`.

- For dark mode, either capture a small dark-mode screenshot subset or document item 11 as manual-only with exact reviewed routes and widths.

- Add the summary files to each plan's `files_modified` and commit commands, or remove the output requirement.

**Risk Assessment**

**Overall risk: HIGH as written.** The project scope and sequencing are solid, and the auth-pass model is basically correct. The risk comes from evidence integrity: uncommitted manifest/artifacts, contradictory defer/closed states, weak UIDN-03 matrix validation, and commit hygiene gaps can make the phase appear closed without proving the required closure. With those fixes, the plan would drop to medium or low risk.

---

## Cursor Review

## Summary

Phase 9 planning is strong overall: it is well-scoped to documentation/evidence closure, enforces the critical ordering (`UIDN-04` before `UIDN-03`), and has unusually good auditability via atomic commits, explicit artifacts, and fallback paths (Path 1/3/4). The plans are clearly aligned to the phase goals and constraints (no restyle, no `src/` edits, no LHCI), and the auth-pass model correctly mirrors the Phase 8 in-memory session injection pattern. The main residual risk is operational complexity: many gates rely on brittle log parsing/manual checkpoints, so execution discipline (not design intent) is the likely failure mode.

## Strengths

- Clear dependency choreography: `09-01` canonicalization unblocks `09-04`, and `09-02` harness unblocks both evidence plans.
- Scope guard is consistently enforced (no preset migration/restyle; no `src/` changes in this phase).
- Excellent traceability: requirement IDs, ADR linkage, explicit success criteria, and per-plan verification commands.
- Atomic commit strategy is well-designed for auditability (especially row-flip + evidence-file coupling).
- Security posture is thoughtful for this context: no on-disk `storageState`, auth session injected in-memory via `addInitScript`, artifact binaries gitignored.
- F1/F2 gate framing is good in principle: don't "green" PROJECT decisions without explicit evidence or override.

## Concerns

- **[MEDIUM] Gate enforcement is partly string-fragile.** Path gating in Plans 03/04 depends on grepping specific log phrases (`WARN bp-`, `Failed routes: 0 / 5`). Minor script output changes could falsely pass/fail gates without real semantic change.
- **[MEDIUM] Manifest can silently accumulate stale entries over time.** Current update logic is append/replace by path for current run artifacts but does not prune entries that disappear when route sets change, which weakens "current evidence set" clarity.
- **[MEDIUM] Manual checkpoint load is high and error-prone.** The preflight sequence (env bake order + additive seed + multi-terminal orchestration) is correct, but the number of manual steps increases risk of human drift and rerun churn.
- **[LOW] Some criteria are over-specified to implementation details.** Very strict grep-based acceptance checks may create maintenance noise without improving closure confidence.
- **[LOW] Local-auth screenshot caveat is correct but could be contested later.** You do document this, but reviewers may still challenge "prod-only" interpretation unless the distinction is prominently repeated in final closure text.

## Suggestions

- Add a tiny machine-readable gate summary output from each script (e.g., JSON file with `failedRoutes`, `warnCount`) and gate off that instead of grep on freeform logs.
- Add manifest pruning mode (or explicit `runId`) so evidence consumers can distinguish "this run" from historical entries.
- Introduce one orchestrator script for Plan 03 preflight+run (read-only checks + command hints), even if human-triggered, to reduce operator error.
- In both closure docs, add a one-line "Gate decision record" section (`Path 1/3/4 chosen + why`) so auditors can quickly validate F2 logic.
- For 09-04, require a computed PASS/FAIL/N/A totals line in the document (`84 cells = X PASS / Y FAIL / Z N/A`) to harden adversarial review.

## Risk Assessment

**Overall risk: MEDIUM**

The design itself is solid and likely to achieve the intended phase outcomes, including UIDN-04 reconciliation, UIDN-02 evidence capture, UIDN-03 checklist closure, and decision-row flips with atomic audit trails. The main risk is not architectural but procedural: execution relies on many manual and grep-based checks that are vulnerable to operator variance and output-format drift. With minor hardening of gate signal robustness and run bookkeeping, this could drop to LOW risk quickly.

---

## CodeRabbit Review

CodeRabbit was invoked but returned `No files found for review` because the working tree is clean (Phase 9 plans are already committed; `coderabbit review` reviews the current diff vs base, not arbitrary files). It is omitted from this refresh — to re-include CodeRabbit, run `/gsd-review` from a branch with uncommitted plan edits.

---

## Consensus Summary

This refresh re-runs the cross-AI review against the current Phase 9 plans (post-revisions that addressed Lighthouse pinning, the F1 MANIFEST.json convention, the F2 hard-gate Path-1/3/4 logic, F3a/F3b preflight build-order + additive seed, F6 mustSee DOM assertions, and F7 prior-run cleanup). Two of three reviewers (Gemini, Cursor) now rate the plan LOW–MEDIUM risk. One reviewer (Codex) still rates the plan HIGH risk and identifies four genuine gaps that the prior cycle's revisions did not fully close.

### Agreed Strengths (2+ reviewers)

- **Atomic-commit evidence + PROJECT.md row-flip pattern** (Gemini, Codex, Cursor) — well-suited for auditability; mirrors Phase 7 OBSV-02 precedent.
- **In-memory addInitScript auth session, no on-disk storageState** (Gemini, Codex, Cursor) — security posture is correct.
- **Reconcile-then-audit ordering (UIDN-04 → UIDN-03)** (Gemini, Codex, Cursor) — dependency choreography is right.
- **No-restyle scope guard (ROADMAP SC #5)** (Gemini, Codex, Cursor) — consistently enforced, prevents v1.1 → v1.2 scope creep.
- **MANIFEST.json sha256-pinning concept** (Gemini, Cursor) — good audit-trail design (though Codex flags an implementation gap below).

### Agreed Concerns (raised by 2+ reviewers — HIGHEST PRIORITY)

- **Gate enforcement is grep-/log-fragile** (Codex MEDIUM, Cursor MEDIUM) — Path gating depends on grepping specific log phrases (`Failed routes: 0 / 5`, `WARN bp-`); minor harness output changes could silently flip gate verdicts. Suggestion: emit a small machine-readable JSON gate summary from each script and gate off that.
- **Build-time env / preflight load is high** (Gemini MEDIUM, Cursor MEDIUM) — F3a env-before-build sequencing + F3b additive seed is a correct but high-friction multi-terminal flow; adding an orchestrator/preflight-validator script would reduce operator drift.
- **84-cell UIDN-03 matrix is manual-toil-heavy** (Gemini LOW, Codex HIGH, Cursor LOW) — Codex sharpens this from a "manual diligence" concern (Gemini/Cursor) to a "weak validation" concern: acceptance only checks 12 rows, not 7 route cells per row × 84 total cells; FAIL count read from `/tmp/`, not the committed file.

### Reviewer-Specific (single source) Concerns

#### Codex HIGH — verified against current plans

These are **genuine gaps** in the current plan revisions, confirmed by direct grep of the plan files:

1. **HIGH — MANIFEST.json not in `git add` despite "IS committed" claim.** Plans 03 and 04 explicitly state `MANIFEST.json IS committed` (`09-03-PLAN.md:339`, `09-04-PLAN.md:331`), but the actual `git add` commands stage only the evidence file and `PROJECT.md` (`09-03-PLAN.md:425`, `09-04-PLAN.md:420`). Result: the manifest will be untracked after the run and the atomic-commit promise breaks. **Fix:** add `.planning/closure/artifacts/MANIFEST.json` to the `git add` invocation in both plans.

2. **HIGH — Path 3 (defer) leaves a contradictory state.** When Path 3 is taken (gate fails, row stays ⚠️ Revisit), the evidence sign-off block in both plans still hardcodes `_Disposition: UIDN-02 closed_` (`09-03-PLAN.md:380`) / `_Disposition: UIDN-03 closed_` (`09-04-PLAN.md:374`). The Path-3 instructions tell the operator to keep the row at ⚠️ Revisit but provide no instruction to swap the sign-off line — and the acceptance check `tail -5 ... | grep -q '_Disposition: UIDN-02 closed'` (`09-03-PLAN.md:452`) would force the operator to leave the contradictory "closed" sign-off in place. **Fix:** add explicit Path-3 sign-off wording (e.g., `_Disposition: UIDN-02 audited; row stays ⚠️ Revisit pending follow-up_`) and tri-branch the acceptance check.

3. **HIGH — UIDN-03 matrix gate validates row count but not column count.** The acceptance check `awk '/^## 1\./,/^## 2\./' ... | grep -E '^\| [0-9]+ ' | wc -l ... | grep -q '^12$'` (`09-04-PLAN.md:445`) verifies 12 numbered rows but does NOT verify that each row has 7 route cells with valid `PASS|FAIL|N/A` values. The FAIL count check (`09-04-PLAN.md:448`) reads from `/tmp/uidn03-matrix.md`, not the committed evidence file — so a malformed or incomplete matrix in the committed file could pass the gate. **Fix:** add a validator that asserts `awk -F'|' 'NR matches data row {NF == 10}'` (8 inner cells: # + Item + 7 routes; 10 pipes counting leading/trailing) and enumerates `PASS|FAIL|N/A` cells; recompute FAIL count from the committed file in the acceptance regex.

4. **HIGH — Atomic commit hygiene misses pre-staged unrelated files in Plans 02/03/04.** Plan 01's Task 0 has a worktree-clean preflight for the 3 target files, but Plans 02, 03, 04 do not. The `git commit -m "..."` invocations in those plans (`09-03-PLAN.md:426`, `09-04-PLAN.md:421`) will sweep up ANY currently-staged files, not just those in `git add` lines. **Fix:** add a `git diff --cached --quiet -- <expected-files>` preflight to Plans 02/03/04 before each commit, or use `git commit -- path1 path2` pathspec form (which restricts to those paths).

#### Codex MEDIUM (single-source, worth investigating)

- **`networkidle` flakiness** — production pages with analytics/Sentry can leave `networkidle` waiting indefinitely. Suggestion: prefer `domcontentloaded` + bounded selector waits. (Gemini & Cursor did not flag this.)
- **Evidence template cites `lighthouse@latest` while harness pins `13.2.0`** — `09-03-PLAN.md:325` uses the prose `npx -y lighthouse@latest` in the Method section, but the script pins `13.2.0`. Tighten the evidence prose to match.
- **UIDN-04 ADR-001 doesn't cite the visual-diff investigation.** REQUIREMENTS UIDN-04 wording says "investigated" via visual diff; ADR-001 reasons from `components.json` declarative ground-truth only. If a visual diff was actually performed (likely in research), ADR-001 should cite it.
- **Auth preflight `curl http://localhost:4173/admin/suggestions/.../edit`** at `09-03-PLAN.md:197` returns 200 for the SPA shell regardless of session; this gives false-confidence on session injection. Replace with a Playwright sanity check using the same `addInitScript` path.

#### Gemini LOW (single-source)

- CDN warm-up loop before Lighthouse run (avoids cold-start variance).
- Early validation in `audit-screenshots.mjs` that `process.env.VITE_SUPABASE_URL` is not the literal `"undefined"`.
- Print specific sub-score on FAIL (e.g., `FAIL home: P=88 < 90`) to streamline D-14 rationale authoring.

#### Cursor MEDIUM (single-source, related to "agreed concerns")

- Manifest entries don't get pruned when route sets change — weakens "current evidence set" clarity. Suggestion: add manifest pruning by `runId` or tag entries with the run that produced them.

### Divergent Views

- **Overall risk rating diverges:** Gemini=LOW, Cursor=MEDIUM, Codex=HIGH. The split tracks closely with depth of evidence-integrity scrutiny: Gemini accepts the F1/F2 designs at face value; Cursor flags procedural fragility; Codex stress-tests the wiring between the design intent (manifest committed, gate hard, defer path coherent) and the actual `git add` / acceptance commands and finds four mismatches. Codex's HIGHs are the most actionable blocker class for execution.
- **`networkidle` reliability** — Codex flags as MEDIUM concern; Gemini and Cursor accept it. Worth a one-line fix anyway since the cost is trivial.
- **84-cell matrix risk** — Gemini and Cursor frame as LOW (manual toil, mitigated by checkpoint); Codex frames as HIGH (gate-validation gap). The fix (column-count validation + FAIL count from committed file) addresses both framings simultaneously.

### Recommendation

The four Codex HIGH concerns are surgical fixes to the plan files (no restructuring needed):

1. Add MANIFEST.json to the `git add` line in Plans 03 + 04.
2. Add Path-3 sign-off swap wording + tri-branch the disposition acceptance check in Plans 03 + 04.
3. Tighten the UIDN-03 matrix validator to check column count + FAIL count from committed file.
4. Add worktree-clean / staged-files preflight to Plans 02 + 03 + 04, OR use `git commit -- pathspec` form.

With those fixes, all three reviewers' overall risk drops to LOW–MEDIUM. Gemini's and Cursor's MEDIUM concerns (CDN warm-up, env validation, gate-summary JSON, manifest pruning) are nice-to-haves that can land in the same revision pass or be deferred without blocking execution.
