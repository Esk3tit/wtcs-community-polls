---
phase: 9
reviewers: [gemini, codex, cursor, coderabbit]
reviewed_at: 2026-05-04
cycle: 2
convergence_loop: true
plans_reviewed:
  - 09-01-PLAN.md
  - 09-02-PLAN.md
  - 09-03-PLAN.md
  - 09-04-PLAN.md
self_skipped: claude (running inside Claude Code CLI)
---

# Cross-AI Plan Review — Phase 9 (Cycle 2)

Convergence loop cycle 2. Cycle 1 surfaced 4 HIGHs; all addressed in commit `1c0e00e`. This cycle confirms cycle-1 fixes and surfaces NEW concerns.

**Cycle 2 verdicts:** Gemini=LOW (0 HIGH) · Cursor=MEDIUM-LOW (0 HIGH) · Codex=HIGH (2 NEW HIGH) · CodeRabbit=no findings (likely no diff).

**Cycle-1 HIGH resolution status (all 3 reviewers confirm RESOLVED):**

| Cycle-1 HIGH | Status | Evidence |
|---|---|---|
| F1 — MANIFEST.json in git add | RESOLVED | Plans 03+04 commit step adds MANIFEST.json |
| F2 — Path-3 sign-off contradiction | RESOLVED | Tri-branch sign-off template + tri-branch acceptance grep |
| F-matrix — gate reads /tmp not evidence file | RESOLVED | Plan 04 Step B.2 reads from .planning/closure/UIDN-03-shadcn-audit.md |
| F14 — atomic-commit hygiene | RESOLVED | Plans 02/03/04 each have Task 0 preflight + staging-area assertion |

---

## Gemini Review (LOW · 0 HIGH)

This review covers the cycle-2 revision of implementation plans for **Phase 9: UI Closure Evidence**. The plans have been rigorously updated to address all High-severity concerns from the previous cycle, particularly regarding atomic-commit hygiene and the integrity of the closure-evidence manifest system.

### Summary
The Phase 9 plans provide a robust framework for transitioning the project's UI requirements from "aspirational" to "empirical." The strategy correctly prioritizes documentation reconciliation (UIDN-04) before audit execution (UIDN-02/03) to ensure the checklist baseline is canonical. The cycle-1 feedback has been meticulously integrated: **MANIFEST.json** is now a first-class tracked artifact in the commit chain, sign-off footers are properly parameterized for different closure outcomes (Path 1/3/4), and the **F14 atomic-commit gate** is applied consistently across all execution plans to prevent worktree pollution.

### Strengths
*   **Infrastructure Sanity Gates:** Task 0b in Plan 03 is exceptionally detailed, guarding against subtle build-order race conditions (F3a) and ensuring the additive E2E seed is present (F3b) before the auth-pass audit begins.
*   **Manifest Integrity:** The implementation of a SHA256-pinned `MANIFEST.json` allows for verifiable closure evidence of binary artifacts (screenshots, HTML reports) while keeping the repository bloat-free.
*   **Gated Status Flips:** Plan 04’s verification gate correctly reads FAIL counts from the actual evidence file (Step B.2) rather than transient scratch memory, ensuring the "✓ Good" status in `PROJECT.md` is earned via the committed record.
*   **Re-runnable Harness:** The top-of-file data block pattern in the harness scripts ensures the audit is reproducible with minimal friction.

### Concerns & Suggestions
*   **[LOW] Plan 01 Consistency:** While not explicitly mandated in the cycle-1 feedback for Plan 01, this plan's Task 3 lacks the `expected` vs `staged` staging-area assertion found in Plans 02/03/04. Given that Task 0 in Plan 01 identifies the risk of uncommitted edits being "swept up," adding the assertion to Task 3 would provide a consistent safety blanket across the phase.
*   **[LOW] Script Portability:** In Plan 04 Task 2, the `open` command is used to review screenshots. In headless or Linux-based environments, this will fail. While appropriate for a local macOS dev box, adding a fallback note (e.g., "or browse via file manager") would be helpful.

### Cycle-1 Verification
*   **[RESOLVED] (F1) MANIFEST.json tracked:** Correctly un-ignored in Plan 02 `.gitignore` and included in the `git add` commands of Plans 03/04.
*   **[RESOLVED] (F2) Parameterized sign-off:** Plans 03/04 include the tri-branch sign-off templates (Path 1: closed, Path 3: deferred, Path 4: override) in the evidence file creation tasks.
*   **[RESOLVED] (F-matrix) matrix gate reads from file:** Plan 04 Task 3 Step B.2 correctly counts `FAIL` cells using `awk` on the committed `.md` file.
*   **[RESOLVED] (F14) Commit-hygiene gates:** Plans 02, 03, and 04 all feature a Task 0 `git status` preflight and a commit-step `expected` vs `staged` assertion.

### Risk Assessment: LOW
The overall risk is low. The plans provide a highly structured, defensive path to phase closure. The inclusion of the MANIFEST.json ensures that the "gitignored" artifacts are nonetheless durable and verifiable, which is critical for a project claiming a "Hygiene & Polish" milestone.

**Total HIGH concerns: 0**


---

## Codex Review (HIGH execution risk · 2 NEW HIGH)

**Summary**

I verified the workspace is at commit `1c0e00e`. The cycle-1 fixes are materially present, and the plans are much stronger: manifest evidence, sign-off branching, evidence-file matrix gating, and commit hygiene are all now wired. However, I found **2 remaining/new HIGH concerns** that can block correct execution: the defer Path 3 commit path is still impossible in Plans 03/04, and Plan 04’s matrix column-count assertion is mathematically wrong.

**Cycle-2 Fix Verification**

- **[RESOLVED] F1 — MANIFEST staged in Plans 03/04.**  
  Plan 03 stages `.planning/closure/artifacts/MANIFEST.json` with evidence + `PROJECT.md`; Plan 04 also stages it conditionally. Good.

- **[RESOLVED] F2 — Path-specific sign-off footer.**  
  Plans 03/04 now define separate `closed`, `deferred`, and `closed with override` disposition lines. Sign-off itself is fixed.

- **[RESOLVED] F-matrix — Plan 04 gate reads evidence file, not `/tmp`.**  
  The FAIL count is now computed from `.planning/closure/UIDN-03-shadcn-audit.md`, with `/tmp` only diagnostic. Good.

- **[RESOLVED] F14 — Commit hygiene added.**  
  Plans 02/03/04 each have a Task 0 clean-worktree preflight plus staging-area assertions before commit. Good.

**Strengths**

- Phase ordering is now clear: UIDN-04 canonicalization, harness, UIDN-02 evidence, then UIDN-03 audit.
- The production/local-auth split is explicit and well justified.
- The manifest approach gives durable sha256 evidence while keeping binary artifacts out of git.
- The plans are careful about no `src/` changes, no shadcn restyle, no `components.json` drift, and no persisted auth storage state.
- Plan 04’s gate moving from `/tmp` to committed evidence is the right control.

**Concerns**

- **HIGH — Path 3 defer is still not executable in Plans 03/04.**  
  Even though the sign-off is now parameterized, the commit steps still expect `PROJECT.md` to be staged. On Path 3, the row explicitly stays unchanged, so `git add .planning/PROJECT.md` will not stage it and the exact staging assertion will abort.  
  Affected: [09-03-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/09-ui-closure-evidence/09-03-PLAN.md:502), [09-04-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/09-ui-closure-evidence/09-04-PLAN.md:522).  
  Fix: make the expected staged paths conditional. Path 1/4 should include `PROJECT.md`; Path 3 should commit evidence + manifest only, or explicitly make a different `PROJECT.md` change.

- **HIGH — Plan 04 matrix column-count assertion will reject a valid matrix.**  
  The plan says `1 row-number + 1 item-summary + 7 route columns = 8 cells`, but that is **9 cells**. With leading/trailing pipes, `awk -F'|'` should see `NF == 11`, not `NF == 10`.  
  Affected: [09-04-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/09-ui-closure-evidence/09-04-PLAN.md:569).  
  Fix: update the text and assertion to `NF != 11`. The route-cell loop `i=4..10` is correct.

- **MEDIUM — Override ROADMAP-ID checks are described but not enforced.**  
  Path 4 requires a ROADMAP-ID grep-findable in `.planning/ROADMAP.md`, but the actual acceptance mostly checks only for an `Override YYYY-MM-DD:` line. Add a concrete command that extracts/captures the ID and greps it.

- **MEDIUM — Plan 03 warning-count command is subtly broken.**  
  `warn_count=$(grep -c 'WARN bp-' /tmp/uidn02-screenshots.log || echo 0)` can produce `0 0` when no warnings exist because `grep -c` prints `0` and exits non-zero. Use `warn_count=$(grep -c 'WARN bp-' /tmp/uidn02-screenshots.log || true)`.

- **MEDIUM — Plan 04 asks for “one-line note each” but validates only bare cell tokens.**  
  The acceptance regex only allows `PASS`, `FAIL`, `N/A`, or `GLOBAL` with optional footnotes. Either remove the “one-line note each” requirement or allow notes outside the cells via footnotes/findings.

- **LOW — UIDN-02 evidence method still says `lighthouse@latest`.**  
  The harness is pinned to `lighthouse@13.2.0`; the evidence template should say the same to avoid audit drift.

**Suggestions**

1. Patch Plans 03/04 commit gates to branch expected staged files by Path 1/3/4.
2. Fix Plan 04 matrix NF check to `NF == 11`.
3. Add executable ROADMAP-ID validation for override paths.
4. Replace the Plan 03 warning-count command with a no-duplicate-zero form.
5. Align Plan 03 evidence prose with the pinned Lighthouse version.

**Risk Assessment: HIGH**

The product risk is low because these are planning/documentation-only workflows, but the **execution risk remains HIGH** until the two blockers above are fixed. A valid defer path can currently fail at commit time, and a valid UIDN-03 matrix can fail acceptance due to the wrong column-count assertion.


---

## Cursor Review (MEDIUM-LOW · 0 HIGH)

## Summary

Cycle 2 is a strong revision: the plans are now much more execution-safe, auditable, and explicit about gate logic. The four cycle-1 HIGH findings appear correctly addressed in the plan text, and I do not see a new blocker at HIGH severity introduced by the revisions. The remaining issues are mostly consistency/documentation quality concerns (some objectives/success criteria still written as unconditional “flip to ✓” while the new tri-path gate allows defer/override), which could cause operator confusion but not silent integrity failure.

## Strengths

- Atomicity and hygiene are now deeply wired end-to-end (preflight cleanliness + staged-file assertions before commit).
- Path-dependent decision logic for closure sign-off is now explicit and testable in both Plan 03 and Plan 04.
- Evidence integrity improved materially via MANIFEST hash/size recording and explicit commit coupling.
- Plan 04 matrix gate now correctly anchors on committed evidence content instead of transient `/tmp` scratch data.
- Good separation of concerns across plans/waves; dependencies and ownership are clearer than cycle 1.

## Cycle-2 Verification of Cycle-1 HIGHs

- **(F1) MANIFEST in Plans 03/04 git add**: **[RESOLVED]**  
  Both plans now include `.planning/closure/artifacts/MANIFEST.json` in commit staging logic, with acceptance checks tied to tracking/commit presence (or explicit optionality handling in Plan 04 when unchanged).

- **(F2) Sign-off parameterized by Path 1/3/4**: **[RESOLVED]**  
  Both Plan 03 and Plan 04 now include explicit tri-branch footer templates and corresponding acceptance checks.

- **(F-matrix) Plan 04 gate reads committed evidence, not `/tmp`**: **[RESOLVED]**  
  Gate now computes FAIL cells from `.planning/closure/UIDN-03-shadcn-audit.md` matrix block, with `/tmp` only diagnostic.

- **(F14) Plans 02/03/04 preflight + staging assertions**: **[RESOLVED]**  
  Each plan now has Task 0 preflight and commit-time staging-set validation.

## Concerns

- **MEDIUM** — Some objective/success-criteria statements still imply unconditional row flips to `✓ Good`, but gate logic now allows defer/override paths. This creates internal contradiction and can confuse execution accountability.
- **MEDIUM** — Plan 03 evidence template method line still references `lighthouse@latest` while harness is pinned to `13.2.0`; this can produce audit narration drift.
- **LOW** — A few acceptance checks are brittle (e.g., `tail -10` footer checks) and may fail on harmless formatting shifts.
- **LOW** — The plans are very verification-heavy; operator burden is high and could increase procedural error risk despite strong controls.

## Suggestions

- Normalize all **objective/success criteria** text in Plans 03/04 to reflect tri-path outcomes (Path 1/3/4), not just Path 1.
- In Plan 03 evidence template, change method wording to match actual pinned command (`lighthouse@13.2.0`) for consistency.
- Replace fragile footer checks (`tail -10`) with section-anchored checks (e.g., search within `## Sign-off` block).
- Add a short “authoritative truth source” note per plan: when acceptance and success criteria conflict, acceptance gate wins.

## Risk Assessment

**Overall risk: MEDIUM-LOW.**  
The prior HIGH-risk integrity gaps from cycle 1 are now resolved, and commit/evidence safeguards are substantially improved. Residual risk is mainly operator confusion from a few contradictory narrative statements and brittle validation expressions, not core control failure.


---

## CodeRabbit Review

_CodeRabbit returned no findings on this run (only 'Starting CodeRabbit review' header line). Most likely cause: working tree was clean against the base branch (latest commit was already pushed), so there was no diff to review. Re-running after a future uncommitted edit would surface findings._

---

## Consensus Summary

### Agreed Cycle-1 Resolutions (3 reviewers — Gemini + Codex + Cursor all confirm RESOLVED)

All 4 cycle-1 HIGH concerns are FULLY RESOLVED. No reviewer asks to re-open them.

### NEW Cycle-2 HIGH Concerns (Codex sole-source, but VERIFIED concrete + actionable)

Cursor and Gemini did not surface these but they are concrete, low-controversy bugs in the plans:

**H1 (HIGH) — Path 3 (defer) breaks commit due to expected-staged assertion.**
On Path 3, PROJECT.md is intentionally NOT modified (row stays ⚠️ Revisit). But the commit-step staging-area assertion in Plans 03+04 expects PROJECT.md to be in the staged set. Result: a valid Path-3 defer would abort at the commit gate. Affected lines: 09-03-PLAN.md:502, 09-04-PLAN.md:522.
**Fix:** branch the expected-staged path set by Path 1/3/4. Path 1+4 stage evidence + manifest + PROJECT.md; Path 3 stages evidence + manifest only.

**H2 (HIGH) — Plan 04 matrix column-count assertion off-by-one.**
Plan 04 narrative says "1 row-number + 1 item-summary + 7 route columns = 8 cells" but markdown table with leading/trailing pipes produces NF=11 in awk -F'|' (not 10 as asserted). Result: a valid 12×7 matrix fails column-count acceptance. Affected line: 09-04-PLAN.md:569.
**Fix:** update narrative to "= 9 cells" and assertion to NF == 11.

### MEDIUM Concerns (Codex)

- M1: Override ROADMAP-ID is described but not enforced — add a grep against .planning/ROADMAP.md for the cited ID.
- M2: Plan 03 `warn_count=$(grep -c ... || echo 0)` produces "0 0" when no warnings exist (grep -c prints 0 + exits 1; the || echo 0 appends another 0). Use `|| true`.
- M3: Plan 04 acceptance regex allows only PASS/FAIL/N/A/GLOBAL with optional footnote, but plan body says "one-line note each". Reconcile.

### MEDIUM (Cursor)

- M4: Some objective/success-criteria text in Plans 03/04 still implies unconditional row flips, contradicting the tri-path gate logic. Normalize narrative.
- M5: Plan 03 evidence template method line still says `lighthouse@latest`; harness is pinned to `13.2.0`. Align prose.

### LOW (multiple)

- L1: Plan 01 Task 3 lacks the staging-area assertion that Plans 02/03/04 received in cycle 1 (Gemini). Add for consistency.
- L2: Plan 04 Task 2 uses macOS `open` to review screenshots — fails on Linux/headless (Gemini). Add fallback.
- L3: Some acceptance checks use `tail -N` patterns brittle to formatting shifts (Cursor).

---

## CYCLE_SUMMARY

current_high = **2** (H1 Path-3 staging assertion · H2 NF off-by-one)

Cycle-1 HIGHs (4): all FULLY RESOLVED.
Cycle-2 NEW HIGHs (2): unresolved as of this cycle.
