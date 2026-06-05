---
phase: 20
reviewers: [gemini, codex, cursor]
reviewed_at: 2026-06-05T00:00:00Z
plans_reviewed: [20-01-PLAN.md, 20-02-PLAN.md]
---

# Cross-AI Plan Review — Phase 20: Live Human UAT

> Reviewers: Gemini, Codex, Cursor. Claude was skipped (this review runs inside Claude Code — self-review excluded for independence). CodeRabbit was not invoked: it reviews the working-tree diff, and this is an unexecuted documentation-only planning phase with no relevant diff to review.
>
> The orchestrator independently verified every grep-count claim against the live `03-UAT.md` / `04-UAT.md` files before writing the consensus. Verification results are recorded in the Consensus Summary.

## Gemini Review

# Cross-AI Plan Review: Phase 20 — Live Human UAT

This review evaluates **PLAN 20-01** and **PLAN 20-02**, which aim to reconcile historical UAT evidence for Phase 03 and Phase 04 to satisfy the v1.4 "debt-zero" mandate.

## 1. Summary
The plans are well-structured, documentation-focused, and strictly adhere to the strategic decisions (D-01 through D-06) established in the phase context. Instead of performing fresh live tests, they leverage existing pass evidence, formalizing the "audit trail" through code-path verification (D-03) and rollup reconciliation. This approach is highly efficient for a final "closeout" phase. The "verbatim-preserve + rollup-supersede" mechanism (D-04) is a clever way to maintain historical integrity while clearing the "pending" markers.

## 2. Strengths
- **Rigorous Acceptance Basis**: Plan 20-01 includes a specific task to re-verify line numbers and migration impacts in `src/lib/auth-helpers.ts`, ensuring the "gate-path-unchanged" argument (D-03) is factually supported by the current codebase.
- **Historical Integrity**: Adherence to the `result:` verbatim convention (D-04) prevents rewriting history, which is critical for an audit trail, while using `resolution` pointers to link to the actual pass results.
- **Detailed Rollup Updates**: The plans meticulously identify and update all aggregate fields (frontmatter, Summary YAML blocks, and followup lists).
- **Lightweight Execution**: By recognizing that the "executed live" requirement has already been met historically, the plans minimize turn-intensive tool usage.

## 3. Concerns
- **"Screenshot" Requirement mismatch (LOW)**: The Roadmap success criteria explicitly mention "evidence (screenshot or screen-recording reference...)". Decision D-05 chooses "narrative+verdict" as the lightest artifact. While defensible in a "Final Closeout" context for historical events, there is a minor risk that a strict auditor might see the lack of a *new* or *referenced* image as a criteria miss.
- **Grep Verification Conflict in 20-02 (MEDIUM)**: Plan 20-02 Change 1 says "only update the top-level frontmatter field" and excludes `re_run: { deferred: 1 }`. However, the Acceptance Criteria and Verification both assert "File does NOT contain 'deferred: 1' anywhere". If the `re_run` block contains `deferred: 1`, the verification task will fail.
- **Grep Count Precision (LOW)**: `grep -c "Phase 20"` returns "at least 2". In large markdown files, "Phase 20" might appear in headers or other notes. A more specific pattern (e.g., `resolution:.*Phase 20`) would be safer.

## 4. Suggestions
- **Resolve the `re_run.deferred` inconsistency**: Plan 20-02 should either update the `re_run` block fields to `0` OR the verification grep should be scoped to avoid false failures. Given the "debt-zero" goal, updating the `re_run` block to `0` is recommended.
- **Reference specific historical timestamps**: Ensure the `resolution:` strings consistently include the `(2026-05-03)` and `(MapCommittee, v1.0→v1.1)` anchors.
- **Confirm `AuthErrorPage` reproducibility**: In Plan 20-01 Task 1, briefly verify that `/auth/error?reason=not-in-server` actually displays the expected "Test 3" invite link.

## 5. Risk Assessment: LOW
The overall risk is **LOW**. These are non-destructive, documentation-only changes. The central judgment call—accepting historical evidence over fresh runs—is robustly mitigated by the code-path audit in Task 1 of Plan 20-01. The only significant execution risk is the potential grep failure in Plan 20-02 due to the `re_run` block exclusion.

**Verdict**: The plans are ready for execution, provided the `deferred: 1` grep inconsistency in Plan 20-02 is addressed during execution.

---

## Codex Review

## PLAN 20-01 Review

### Summary
PLAN 20-01 is directionally sound: it treats Phase 20 as reconciliation of already executed live UAT, preserves the historical skipped rows, and adds an audit basis for why no fresh run is required. The central judgment is defensible if the project accepts D-01/D-03 as a formal scope decision. Main issues are brittle/incorrect grep checks and a few audit wording problems.

### Strengths
- Preserves historical `result: skipped` rows instead of rewriting history.
- Adds forward pointers from stale rows to the later PASS evidence.
- Correctly requires re-checking current auth line numbers before citing them.
- The no-fresh-run basis is plausible: `auth-helpers.ts:193` returns `not-in-server` before the RPC at line 209.
- Good scope control: documentation-only, no source changes.

### Concerns
- **HIGH:** `grep -c "result: skipped"` will not return 2. `03-UAT.md:55` already contains prose with `result: skipped`, so the count is currently 3.
- **MEDIUM:** The plan says migrations 14/15 "only alter `update_profile_after_auth` internals." Migration 14 also rewrites several other functions, including `handle_new_user`, `profile_self_update_allowed`, and admin/vote helpers. The defensible claim is narrower: those migrations do not affect the client-side non-member branch because non-members return before the RPC.
- **MEDIUM:** The roadmap phrase "server-side membership gate" conflicts with D-03's "fully client-side" gate-path claim. The acceptance basis should explicitly reconcile that terminology.
- **MEDIUM:** Summary `passed: 6` while preserving two raw `result: skipped` rows is acceptable only if the Summary is clearly labeled as an effective/resolved rollup, not a raw row count.
- **MEDIUM:** `files_modified` and success criteria say only `03-UAT.md` is modified, but `<output>` requires creating `20-01-SUMMARY.md`.
- **LOW:** `grep -c "Phase 20"` does not prove both skipped rows have resolution pointers.

### Suggestions
- Replace grep checks with anchored row checks, e.g. `grep -c '^result: skipped$'`.
- Add explicit wording: "Summary is an effective Phase 20 closure rollup; historical raw rows remain below."
- Reword migration basis to avoid the false "only internals" claim.
- Add `20-01-SUMMARY.md` to `files_modified` or remove it from output expectations.
- Cite the no-fresh-run decision as a formal D-01/D-03 acceptance exception to the literal Phase 20 execution wording.

### Risk Assessment
**LOW-MEDIUM.** The judgment call is mostly defensible because the live non-member test has concrete historical PASS evidence and the current gate path still rejects before the RPC. Risk is mainly audit/verification brittleness, not implementation danger.

## PLAN 20-02 Review

### Summary
PLAN 20-02 is useful but riskier than 20-01. It correctly tries to reconcile an existing live second-admin PASS, but the evidence is "off-record," has no precise timestamp, and the plan leaves literal `result: deferred` / `result: partial` rows in place while claiming debt-zero. That can work, but only with stronger effective-status semantics and corrected verification.

### Strengths
- Preserves historical non-pass records instead of falsifying them.
- Formalizes the MapCommittee PASS into a closure section.
- Updates frontmatter and Summary rollups to reflect effective closure.
- Explicitly distinguishes D-02 from D-01.
- Scope is appropriately limited to planning documentation.

### Concerns
- **HIGH:** `grep -c "result: deferred"` will not return 1. `04-UAT.md:212` already has prose containing `result: deferred`, so the count is currently 2.
- **HIGH:** D-04 says each preserved non-pass row needs a forward pointer. The plan adds a pointer to the main `## Tests` `result: partial` row, but not to the frontmatter `re_run.results` `result: deferred` row at `04-UAT.md:24`.
- **MEDIUM:** The off-record UAT-02 evidence is weaker than UAT-01: no precise UTC timestamp, no screenshot, and no clear source-of-truth record beyond narrative notes.
- **MEDIUM:** Leaving literal `result: deferred` and `result: partial` rows may conflict with success criterion 3 unless the file clearly separates historical raw results from effective unresolved status.
- **MEDIUM:** The frontmatter still has a non-UAT cleanup followup with the word "pending" at `04-UAT.md:52`. If debt-zero audits grep for pending debt broadly, this remains noisy.
- **MEDIUM:** Same summary-file conflict: the plan claims only `04-UAT.md` is modified but requires creating `20-02-SUMMARY.md`.

### Suggestions
- Add a `resolution:` field to the frontmatter `test: 6a` deferred object, indented under that object.
- Use anchored greps: `grep -c '^      result: deferred$'` for frontmatter and `grep -c '^result: partial$'` for the test row.
- Add an explicit "effective unresolved deferred scenarios: 0" marker or equivalent closure rollup.
- Record why screenshot/screen-recording evidence is unavailable for the historical demote event.
- Either resolve/reclassify the unrelated cleanup followups or state they are non-UAT operational cleanup outside UAT-02.
- Add `20-02-SUMMARY.md` to allowed modified files.

### Risk Assessment
**MEDIUM.** The plan probably achieves the practical phase goal if D-02 is accepted, but the audit trail is weaker and the current verification criteria are wrong. This one needs tightening before execution.

## Overall Judgment
Accepting pre-existing live evidence is legitimate here only because the project context explicitly redefines Phase 20 as evidence reconciliation, not fresh execution. The plans should make that scope change unmistakable. D-04 can satisfy "no remaining pending/deferred scenarios" if the Summary is clearly an effective closure rollup and every preserved historical non-pass row has a forward pointer. Current grep checks need correction before either plan is execution-ready.

---

## Cursor Review

## 1. Summary
Both plans are well-scoped documentation reconciliation work that correctly implements the operator-locked pivot in `20-CONTEXT.md`: existing live PASS evidence is accepted (D-01/D-02), gate-path stability is documented (D-03), and debt-zero is achieved via rollup supersession plus forward pointers (D-04), not by rewriting history. **PLAN 20-01 is execution-ready with minor gaps.** **PLAN 20-02 has a HIGH-severity targeting error** (deferred row vs. Test 6 partial row) and **grep acceptance criteria that will false-fail** on the current file layout. Neither plan closes the phase holistically: `REQUIREMENTS.md`, `STATE.md`, and ROADMAP wording remain untouched, so Phase 20 goals are only partially achieved by these two plans alone.

## 2. Strengths
- **Correct phase framing.** Plans match `20-CONTEXT.md`: reconciliation/backfill, not re-execution.
- **D-04 is implemented concretely.** Both plans preserve historical `result: skipped` / `result: deferred` / `result: partial` rows and fix aggregates — the right mechanism for debt-zero without falsifying history.
- **D-03 acceptance basis is sound and verifiable.** Current code confirms the non-member path returns before the RPC (lines 193–201 rejection, 209 RPC). Migrations 14/15 only touch `update_profile_after_auth` internals.
- **PLAN 20-01 Task 1 is prudent.** Re-confirming line numbers before citation avoids stale references.
- **Parallel wave design is correct.** 20-01 and 20-02 touch disjoint files; `depends_on: []` is appropriate.
- **Low operational risk.** Markdown-only edits; threat models correctly identify null executable surface.
- **Existing evidence is substantive.** Both runs meet the *spirit* of "executed live with real accounts."

## 3. Concerns

### HIGH
- **PLAN 20-02 targets the wrong row for the deferred resolution pointer.** The only `result: deferred` data row is in **frontmatter** `re_run.results` (test `6a`, line 25), not under `### 6. Demote Admin`. The Test 6 body row has `result: partial` (line 102). Change 2 instructs editing `re_run_evidence:` under `### 6`, which would add a pointer to the partial row while leaving the actual deferred row without a D-04 forward link.
- **`grep -c "result: deferred"` will not return 1 as asserted.** Today the file has two matches (line 25 actual YAML, line 212 blockquote prose). After edits, both remain → count **2**, not 1.

### MEDIUM
- **Phase closure is incomplete.** `20-CONTEXT.md` says `STATE.md` / `REQUIREMENTS.md` UAT-01/02 → Validated at phase close. Neither plan updates `REQUIREMENTS.md` (still `Pending`, still says "executed live **this milestone**"), `STATE.md` carry-forward table, or `ROADMAP.md` Phase 20 wording. Without a follow-on plan, Phase 20 is artifact-incomplete.
- **D-05 is in 20-01 `must_haves` but not in Task 2 actions.** Must-have requires documenting why a literal screenshot of the 2026-05-03 run is N/A; Change 3 lists gate-path diff only — a must_have ↔ task gap an executor could miss.
- **Roadmap / requirements terminology drift.** Success criteria say "**server-side** membership gate," but the exercised path is a **client-side** OAuth guild check. Evidence is still valid; the label is misleading if not clarified.
- **"13 unit tests" claim is currently inaccurate.** `src/__tests__/admin/demote-admin.test.ts` has **8** `it()` blocks today. PLAN 20-02 Change 5 repeats "13 unit tests" without verification.
- **UAT-02 evidence is thinner than roadmap artifact standard.** Off-Record Verification lacks precise UTC timestamp and has no screenshot/recording. D-02 backfill is defensible, but closure section should explicitly address D-05.

### LOW
- **Git-log anchor in 20-01 Task 2 is unverified.** Task 1 reads source files but does not require `git log --since=2026-05-03` on gate files.
- **Closure date inconsistency.** Plans hard-code `2026-06-04`; execution may land later. Cosmetic.
- **Optional D-06 confirming screenshots are discretionary with no task.**

## 4. Suggestions

### PLAN 20-01
- **Add an explicit D-05 bullet to Change 3** in § UAT-01 Acceptance Basis (original run cannot be re-screenshotted; narrative + verdict is the lightest sufficient artifact).
- **Clarify "client-side gate, pre-RPC"** to reconcile with REQUIREMENTS "server-side" wording.
- **Add a Task 1 verify step** (read-only) running `git log --since=2026-05-03` on the gate files; record commit hash/message in the basis.

### PLAN 20-02
- **Fix Change 2 target.** Add `resolution:` to the **frontmatter** `re_run.results` entry where `test: 6a` / `result: deferred` lives. Separately add a resolution pointer on the `### 6` `result: partial` row.
- **Fix grep acceptance criteria.** Use anchored patterns (e.g. `grep -c '^      result: deferred'`) or exclude blockquotes (`grep 'result: deferred' file | grep -v '^>' | wc -l`).
- **Add D-05 language** to § UAT-02 Phase 20 Closure (imprecise timestamp, no screenshot — narrative PASS stands).
- **Correct unit-test count** to 8. Do not propagate "13" without evidence.
- **Consider a 20-03 plan** (or extend verification): update `REQUIREMENTS.md`, `STATE.md`, ROADMAP Phase 20 text.

### Both plans
- **Add explicit success-criterion-3 language** in closure sections: "debt-zero applies to Summary rollups and followups; archival `result: skipped/deferred/partial` rows are intentionally preserved per D-04." Preempts a strict auditor reading literal row text as outstanding debt.

## 5. Risk Assessment
**Overall: LOW–MEDIUM**

| Dimension | Level | Justification |
|-----------|-------|---------------|
| Product / security | LOW | No code, auth, or data changes. |
| Audit / compliance | MEDIUM | No-fresh-run acceptance is defensible (prod evidence + unchanged gate path). Risk is documentation precision (wrong row edit, false-failing greps, stale "13 tests", unreconciled REQUIREMENTS/ROADMAP). |
| Phase goal achievement | MEDIUM | UAT files reach debt-zero if 20-02 targeting is fixed; milestone-level closure incomplete without REQUIREMENTS/STATE updates. |
| Execution | MEDIUM | PLAN 20-02 may "fail" automated acceptance despite correct intent. |

### Grep-based acceptance criteria correctness
| Check | Plan assertion | Actual behavior |
|-------|----------------|-----------------|
| 20-01 `result: skipped` = 2 | Plan says 2 | **Incorrect — prose at line 55 adds a third match → 3** |
| 20-01 `skipped: 0` / `passed: 6` = 1 each | Correct | Single Summary block |
| 20-02 `result: partial` = 1 | Correct after frontmatter → `complete` | Test 6 row only |
| 20-02 `result: deferred` = 1 | **Incorrect** | Blockquote at line 212 adds second match → 2 |
| 20-02 `deferred: 0` ≥ 2 | Correct | Frontmatter + Summary |
| 20-02 no `deferred: 1` | Correct only if `re_run` block (line 170) is also cleared | Must update both locations |

## Per-plan verdict
| Plan | Ready? | Notes |
|------|--------|-------|
| 20-01 | Yes, with minor additions | Add D-05 to Task 2; fix `result: skipped` grep; optional git-log verify. |
| 20-02 | No — fix before execute | Wrong deferred-row location; broken `result: deferred` grep; frontmatter `6a` + Test 6 `partial` resolutions as separate edits. |

**Bottom line:** The reconciliation strategy is sound and matches operator intent better than forcing redundant live runs. Fix 20-02's row targeting and grep rules, close the REQUIREMENTS/STATE/ROADMAP loop, and tighten artifact language.

---

## Consensus Summary

All three reviewers agree the **reconciliation strategy is sound**: accepting the pre-existing live PASS evidence (rather than forcing redundant fresh runs) is legitimate *because the operator explicitly redefined Phase 20 as evidence reconciliation*, the UAT-01 gate path is verifiably unchanged since the 2026-05-03 run, and the D-04 verbatim-preserve + rollup-supersede mechanism honors the project's history convention. Risk is concentrated entirely in **documentation/verification precision**, not product or security.

The orchestrator independently re-ran every disputed grep against the live files. **The HIGH grep concerns are confirmed real** — the current acceptance criteria will FALSE-FAIL even on a perfectly correct execution:

| Verified claim | Plan assertion | Actual count today | Verdict |
|----------------|----------------|--------------------|---------|
| `03-UAT.md` `grep -c "result: skipped"` | =2 | **3** (rows 21, 26 + prose line 55) | Plan WRONG → false-fail |
| `04-UAT.md` `grep -c "result: deferred"` | =1 | **2** (row 25 + prose line 212) | Plan WRONG → false-fail |
| `04-UAT.md` `grep -c "result: partial"` | =1 | 2 now → **1 after frontmatter→complete** | Plan correct post-edit |
| `04-UAT.md` `deferred: 1` cleared "anywhere" | none remain | also at line 170 (`re_run` block) | Must clear line 170 too |
| `demote-admin.test.ts` "13 unit tests" | 13 | **8 `it()` blocks** | Claim inaccurate |
| `04-UAT.md` `result: deferred` data row location | under `### 6` | actually frontmatter line 25; line 102 is `result: partial` | Change 2 targets wrong row |

### Agreed Strengths (2+ reviewers)
- Correct phase framing — reconciliation/backfill, not re-execution; matches operator-locked intent (all three).
- D-04 verbatim-preserve + rollup-supersede honors history while clearing debt markers — the right mechanism (all three).
- D-03 acceptance basis is technically sound and verifiable: non-member returns before the RPC; migrations 14/15 touch only the post-success path (all three).
- 20-01 Task 1's re-confirm-line-numbers-before-citing step is prudent (Gemini, Codex, Cursor).
- Low operational/security risk — documentation-only, null executable surface (all three).

### Agreed Concerns (2+ reviewers — highest priority)

**HIGH**
1. **Grep acceptance criteria will false-fail on correct execution (UNRESOLVED).** Both `03-UAT.md result: skipped` (asserts 2, actual 3) and `04-UAT.md result: deferred` (asserts 1, actual 2) miscount because prose blockquotes also match. Raised by Codex (both as HIGH) and Cursor (HIGH); independently verified true. Fix: anchor the greps (`grep -c '^result: skipped$'`, `grep -c '^      result: deferred'`) or exclude blockquotes (`grep -v '^>'`), and restate the expected counts.
2. **PLAN 20-02 points the D-04 resolution pointer at the wrong row (UNRESOLVED).** The actual `result: deferred` data row is in frontmatter (`re_run.results`, test 6a, line 25); Change 2 edits the `### 6` body row, which is `result: partial`. As written, the genuine deferred row gets no forward pointer — violating D-04. Raised by Codex and Cursor (both HIGH). Fix: add `resolution:` to the frontmatter 6a object AND separately to the Test 6 partial row.

**MEDIUM**
3. **Milestone-level closure is incomplete.** No plan updates `REQUIREMENTS.md` (UAT-01/02 still "Pending", still says "executed live this milestone"), `STATE.md`, or `ROADMAP.md` Phase 20 wording, though CONTEXT says these flip to Validated at close. (Cursor primary; implied by Codex's "make the scope change unmistakable.") Recommend a 20-03 plan or phase verification step.
4. **"Server-side" vs "client-side" gate terminology drift.** ROADMAP/REQUIREMENTS call it a "server-side membership gate"; the exercised path is a client-side guild check before the RPC. Evidence stays valid, but the acceptance basis should reconcile the label (Codex, Cursor).
5. **`deferred: 1` also lives in the `re_run` block (line 170).** Plan 20-02's "File does NOT contain 'deferred: 1' anywhere" will fail unless that line is cleared too (Gemini, Cursor — verified at line 170).
6. **`20-0X-SUMMARY.md` output conflicts with "only `0X-UAT.md` modified".** Both plans declare a single modified file yet require creating a SUMMARY (Codex, plus Gemini-adjacent). Add the SUMMARY to `files_modified` or note it as a separate phase artifact.
7. **UAT-02 evidence is thinner than UAT-01** (no precise timestamp, no screenshot) and the "13 unit tests" claim is inaccurate (actual 8). The D-05 narrative-only rationale present in 20-01 should be mirrored in 20-02's closure section, and the test count corrected (Codex, Cursor).

### Divergent Views
- **Overall readiness.** Gemini rates risk LOW and calls both plans "ready for execution provided the one grep issue is addressed." Codex rates 20-02 MEDIUM and "needs tightening before execution." Cursor splits the verdict: 20-01 ready-with-minor-additions, 20-02 "No — fix before execute." The orchestrator's grep verification sides with Codex/Cursor: the HIGH grep + wrong-row issues are confirmed real and would block a clean automated pass, so they must be fixed before execution.
- **`03-UAT.md result: skipped` count.** Gemini did not flag it; Codex flagged it HIGH (says 3); Cursor's table initially marked it "correct=2". Direct verification: the count is **3** — Codex is right, this is a genuine false-fail.
- **Screenshot/D-05 sufficiency.** Gemini treats the missing screenshot as LOW; Cursor elevates the D-05 must_have↔task gap to MEDIUM for 20-01. Both agree narrative-only is defensible for a non-reproducible historical event if explicitly documented.

### Recommended actions before execution
1. Fix the grep acceptance criteria in both plans (anchor patterns or exclude `^>` blockquotes; restate expected counts: `result: skipped`→3, `result: deferred`→2, or use anchored row-only counts).
2. Re-target PLAN 20-02 Change 2 to add the `resolution:` pointer to the frontmatter 6a `result: deferred` row, and separately to the `### 6` `result: partial` row.
3. Clear `deferred: 1` at line 170 (`re_run` block) in 04-UAT.md, or scope the "no deferred: 1" assertion.
4. Correct the "13 unit tests" reference to 8 in PLAN 20-02 Change 5.
5. Add an explicit D-05 narrative-artifact paragraph to 20-01 Task 2 and 20-02 closure; reconcile "server-side" vs "client-side" gate terminology in the 03-UAT.md acceptance basis.
6. Add a follow-on step (20-03 or phase verification) to flip `REQUIREMENTS.md`/`STATE.md`/`ROADMAP.md` to Validated, and add `20-0X-SUMMARY.md` to `files_modified`.
