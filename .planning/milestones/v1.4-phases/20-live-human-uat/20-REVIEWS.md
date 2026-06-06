---
phase: 20
reviewers: [gemini, codex, cursor]
reviewed_at: 2026-06-05T20:15:00Z
plans_reviewed: [20-01-PLAN.md, 20-02-PLAN.md, 20-03-PLAN.md]
cycles:
  - cycle: 1
    reviewers: [gemini, codex, cursor]
    plans_reviewed: [20-01-PLAN.md, 20-02-PLAN.md]
    reviewed_at: 2026-06-05T00:00:00Z
    high_concerns_raised: 2
    high_concerns_resolved_next_cycle: 2
  - cycle: 2
    reviewers: [gemini, codex]
    plans_reviewed: [20-01-PLAN.md, 20-02-PLAN.md, 20-03-PLAN.md]
    reviewed_at: 2026-06-05T00:00:00Z
    high_concerns_raised: 2
    high_concerns_resolved_next_cycle: 1
  - cycle: 3
    reviewers: [gemini, codex]
    plans_reviewed: [20-01-PLAN.md, 20-02-PLAN.md, 20-03-PLAN.md]
    reviewed_at: 2026-06-05T00:00:00Z
    high_concerns_raised: 1
    high_concerns_resolved_next_cycle: 1
  - cycle: 4
    reviewers: [gemini, codex]
    plans_reviewed: [20-01-PLAN.md, 20-02-PLAN.md, 20-03-PLAN.md]
    reviewed_at: 2026-06-05T18:38:08Z
    high_concerns_raised: 2
    high_concerns_resolved_next_cycle: 2
  - cycle: 5
    reviewers: [gemini, codex]
    plans_reviewed: [20-01-PLAN.md, 20-02-PLAN.md, 20-03-PLAN.md]
    reviewed_at: 2026-06-05T19:30:00Z
    high_concerns_raised: 2
    high_concerns_resolved_next_cycle: 2
  - cycle: 6
    reviewers: [gemini, codex]
    plans_reviewed: [20-01-PLAN.md, 20-02-PLAN.md, 20-03-PLAN.md]
    reviewed_at: 2026-06-05T20:15:00Z
    high_concerns_raised: 0
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

---
---

# Cross-AI Plan Review — Phase 20 (Cycle 2)

> Reviewers this cycle: **Gemini, Codex**. Claude skipped (review runs inside Claude Code — self-review excluded for independence). **Cursor** was attempted but failed (Pro usage limit hit — empty output); excluded from consensus. **CodeRabbit** not invoked: the working tree is clean (no diff) and this is an unexecuted documentation-only planning phase.
>
> This cycle re-reviews the **revised** plan set after Cycle 1, which now includes the new **20-03-PLAN.md** (milestone-closure plan) and incorporates Cycle 1 fixes. The orchestrator independently re-verified every disputed claim against the live `03-UAT.md` / `04-UAT.md` files and the actual migration SQL before writing the consensus.

## Cycle 1 → Cycle 2: status of prior HIGH concerns

Both prior-cycle HIGHs are **FULLY RESOLVED** in the current plans (independently re-verified):

| Cycle 1 HIGH | Fix landed | Verification |
|--------------|-----------|--------------|
| Grep acceptance criteria false-fail (`result: skipped`/`result: deferred` miscount vs blockquote prose) | Plans now use **anchored / blockquote-excluded** grep patterns; both reviewers this cycle explicitly note "anchored grep checks avoid false positives." | Confirmed — current plan greps are anchored; the unanchored=2 vs anchored=1 split is now documented as expected. |
| 20-02 resolution pointer aimed at wrong row (`### 6` `result: partial` instead of frontmatter `result: deferred`) | 20-02 Change 3 now adds `resolution:` to **both** the frontmatter `re_run.results` test-6a `result: deferred` object **and** the `### 6` `result: partial` body row. | Confirmed in 20-02-PLAN.md (Output line + Change list). |

## Gemini Review (Cycle 2)

# Cross-AI Plan Review: Phase 20 — Live Human UAT

## 1. Summary
The plans for Phase 20 are exceptionally well-reasoned and demonstrate a high degree of "archaeological" precision. By correctly identifying that the required live evidence already exists historically, the plans pivot from redundant execution to high-fidelity reconciliation and "debt-zero" rollup. The approach is surgical, preserving historical records verbatim while satisfying modern v1.4 audit standards through additive resolution pointers and updated aggregate summaries.

## 2. Strengths
- **Rigorous History Preservation:** Adheres strictly to the `D-04`/`D-10`/`D-11` convention of never rewriting historical data rows, using additive `resolution:` pointers instead.
- **Technical Depth (D-03):** 20-01-PLAN correctly anchors the UAT-01 acceptance on a code-level diff of the auth gate.
- **Terminology Alignment:** 20-03-PLAN proactively reconciles the "server-side gate" vs. "client-side check" terminology drift in `REQUIREMENTS.md`.
- **Artifact Completeness:** 20-03-PLAN ensures the "debt-zero" state is reflected globally in `REQUIREMENTS.md` and `ROADMAP.md`.
- **Verification Rigor:** Anchored grep commands (`grep -c "^result: ..."`) prevent false positives from blockquote prose.

## 3. Concerns
- **Success Criteria Alignment (Artifacts) [LOW]:** ROADMAP Success Criterion 1 asks for a "screenshot or screen-recording reference." Plans (via `D-05`) argue historical screenshots are N/A but mention optionally supplementing with a current reproducible-UI screenshot. For a perfect audit these "optional" screenshots should arguably be mandatory light artifacts.
- **Yaml/Markdown Formatting [LOW]:** 20-02 Task 1 appends a sibling key below a `re_run_evidence:` block — safe under standard sibling placement, but care needed if that block is a multi-line literal.

## 4. Suggestions
- Upgrade the "optional" current-UI screenshots (the `/auth/error?reason=not-in-server` page; the current `AdminsList` UI) to mandatory artifacts, satisfying the literal ROADMAP "screenshot" requirement without original test accounts.
- Add an explicit `verify` task in 20-03 to confirm `STATE.md` `Deferred Items` is clear of UAT entries after the phase transition.

## 5. Risk Assessment
**Overall Risk: LOW.** Implementation is restricted to `.planning/` markdown — zero risk to app code, DB schema, or live environment. The primary clerical risk (YAML rollup counts) is mitigated by grep-based verification tasks. **Status: Approved** — proceed Wave 1 (20-01, 20-02) then Wave 2 (20-03).

---

## Codex Review (Cycle 2)

**Summary**

The Phase 20 plan set is directionally sound: it correctly treats this as evidence reconciliation rather than fresh live UAT, preserves historical rows, and adds closure artifacts across the UAT records plus milestone tracking. The main risk is not code/security, but audit integrity: a few verification checks and wording choices could either fail despite correct edits or leave canonical docs internally contradictory.

### 20-01-PLAN.md

**Strengths**
- Good preservation model: keeps historical `result: skipped` rows and adds forward `resolution:` pointers.
- Strong acceptance-basis structure: cites the auth gate, RPC ordering, error route, and post-run migrations.
- Correctly handles the server-side/client-side terminology drift instead of pretending it does not exist.
- Anchored grep checks avoid false positives from blockquotes.

**Concerns**
- **HIGH:** The migration premise is inaccurate. Migrations 14/15 do not "only alter `update_profile_after_auth` internals"; they also touch `profile_self_update_allowed` and other DB functions. The correct claim is narrower: those changes affect DB/RPC/trigger paths that non-members never reach because rejection happens before the RPC.
- **MEDIUM:** The plan cites "unchanged since April/May" but does not explicitly require a `git log --since=2026-05-03 -- ...` verification in Task 1.
- **MEDIUM:** Relying on narrative-only evidence is probably allowed by D-05, but it stretches the original "screenshot or screen-recording reference" criterion. Mark it explicitly as a D-05-accepted exception, not normal evidence parity.

**Suggestions**
- Replace "migrations 14 and 15 only alter `update_profile_after_auth` internals" with "migrations 14/15 alter DB-side profile-update/trusted-context functions reached only after a successful member check."
- Add a required `git log --since=2026-05-03 -- src/lib/auth-helpers.ts ...` verification.
- Cite the actual current anchor: non-member rejection at `auth-helpers.ts` ~lines 193-201, RPC starts ~line 209.

**Risk Assessment: MEDIUM** — markdown-only, no runtime risk; audit risk medium because one acceptance-basis statement is factually too broad.

### 20-02-PLAN.md

**Strengths**
- Correctly identifies the real `result: deferred` row in frontmatter and the separate `result: partial` body row.
- Preserves historical evidence while making rollups debt-zero.
- Handles stale "13 unit tests" carefully by preserving history but using the current count of 8 in the new closure section.
- Good explicit D-05 paragraph for missing timestamp/screenshot.

**Concerns**
- **HIGH:** Acceptance criterion `grep -c "deferred: 0"` returning "at least 2" is likely wrong. The current file has only one `deferred:` aggregate. A correct edit produces exactly one `deferred: 0`.
- **MEDIUM:** Change 1 says "Do NOT change ... re_run block contents," but later changes add a resolution and update a followup inside `re_run`. Internally contradictory.
- **MEDIUM:** Narrative-only evidence is defensible under D-05, but UAT-02 is especially weak (no precise timestamp, no screenshot). Make the artifact exception very explicit.

**Suggestions**
- Change the `deferred: 0` criterion to expect exactly 1 unless the plan intentionally adds another aggregate field.
- Rewrite the Change 1 guard to: "Do not change other frontmatter fields except the re_run updates specified below."
- Optionally reference a current Admins-list/demote UI screenshot path if the operator captures one (non-blocking).

**Risk Assessment: MEDIUM** — conceptually strong, but the bad grep expectation can cause a false failure during execution.

### 20-03-PLAN.md

**Strengths**
- Correctly adds a Wave 2 artifact-close step after UAT records are reconciled.
- Good dependency ordering: validates 20-01/20-02 closure sections before flipping requirement status.
- Sensible STATE.md scope guard if the established workflow owns state transitions.
- Catches an important gap: REQUIREMENTS/ROADMAP would otherwise still say UAT-01/02 are pending.

**Concerns**
- **MEDIUM:** "Append, do not delete original requirement text" may leave REQUIREMENTS.md saying the tests were "executed live by the operator this milestone" while also saying they were closed by accepting prior evidence. That remains contradictory.
- **MEDIUM:** ROADMAP currently says Phase 20 has 2 plans; if 20-03 is added, explicitly bump to 3 and add a Wave 2 entry.
- **MEDIUM:** Leaving STATE untouched is probably right procedurally, but a debt-zero audit may still find stale pending language there unless verify-phase reliably updates it.

**Suggestions**
- Reword the UAT section intro/bullets rather than only appending clauses — remove "this milestone" where it is no longer true.
- Explicitly update ROADMAP Phase 20 to 3 plans and add `20-03-PLAN.md` under Wave 2.
- Add a final verification note: STATE transition expected during verify-phase; audit must confirm no stale UAT Pending remains after phase close.

**Risk Assessment: MEDIUM** — no code risk, but canonical tracking docs could remain inconsistent if wording is only appended.

**Overall Risk: MEDIUM.** Plans achieve the phase goal in principle and are safe from a security/performance standpoint (planning markdown only). Remaining risk is evidence/audit quality: fix the migration wording, the faulty `deferred: 0` check, and the REQUIREMENTS/ROADMAP contradiction before execution.

---

## Consensus Summary (Cycle 2)

Both reviewers agree the **revised reconciliation strategy is sound** and that Cycle 1's two HIGH issues are fixed. Risk remains concentrated in **documentation / audit-integrity precision**, not product or security (markdown-only, null executable surface). Gemini rates the set **LOW / Approved**; Codex rates it **MEDIUM** and surfaces two new HIGHs plus the REQUIREMENTS contradiction. The orchestrator independently verified all three of Codex's primary claims against the live files and **confirms the two new HIGHs are real**.

### Orchestrator verification (re-run against live files)

| Verified claim | Plan assertion | Actual today | Verdict |
|----------------|----------------|--------------|---------|
| 20-01: migrations 14/15 "only alter `update_profile_after_auth` internals" | only that one function | Migration 14 also alters `profile_self_update_allowed`, `handle_new_user`, `is_current_user_admin`, `increment_vote_count`, `validate_vote_choice` | **Plan WRONG** — premise factually too broad (HIGH) |
| 20-02: `grep -c "deferred: 0"` "returns at least 2" | ≥2 | exactly **1** `deferred:` aggregate exists (04-UAT line 170) → correct edit yields exactly 1 | **Plan WRONG** — false-fail on correct execution (HIGH) |
| REQUIREMENTS UAT-01/02 say "executed live by the operator this milestone"; operator table rejects "alternative-validation substitutes" | append "Validated" | wording still present at REQUIREMENTS lines 14/30/32/34/85; plans accept prior off-record evidence instead of fresh live runs | **Contradiction real** (MEDIUM) — append-only wording leaves doc internally inconsistent |

### Agreed Strengths (both reviewers)
- Correct phase framing — reconciliation/backfill, not re-execution (matches operator-locked CONTEXT).
- D-04 verbatim-preserve + rollup-supersede honors history while clearing debt markers.
- Anchored grep checks (the Cycle 1 fix) now avoid blockquote false positives.
- 20-03 closes the milestone-tracking gap Cycle 1 flagged (REQUIREMENTS/ROADMAP flip).
- Documentation-only, null executable surface → low operational/security risk.

### Agreed / Confirmed Concerns

**HIGH (new this cycle — both confirmed by orchestrator verification)**
1. **20-01 migration premise is factually too broad (UNRESOLVED).** Task 1 + Implementation assert migrations 14/15 "only alter `update_profile_after_auth` internals." Migration 14 demonstrably hardens six functions including `profile_self_update_allowed`. Raised by Codex (HIGH); verified true. Fix: reword to "migrations 14/15 alter DB-side profile-update / trusted-context functions reached only after a successful member check — not the pre-RPC non-member rejection path."
2. **20-02 `grep -c "deferred: 0"` expects ≥2 but a correct edit yields exactly 1 (UNRESOLVED).** Same false-fail class as the Cycle 1 grep bug, reintroduced in a new check. Raised by Codex (HIGH); verified true (only one `deferred:` aggregate at 04-UAT line 170). Fix: expect exactly 1, or anchor to the specific aggregate.

**MEDIUM**
3. **REQUIREMENTS/ROADMAP internal contradiction (Codex).** Append-only edits leave "executed live by the operator this milestone" alongside the accept-prior-evidence closure; the operator table explicitly rejects alternative-validation substitutes. Verified the wording is still present. Reword UAT-01/02 to reflect the operator-locked reconciliation pivot rather than only appending "Validated."
4. **20-02 Change 1 guard is self-contradictory (Codex).** "Do NOT change re_run block contents" conflicts with later changes that add a resolution/followup inside `re_run`. Reword the guard to scope-allow the specified `re_run` updates.
5. **Narrative-only artifact exception should be explicit, esp. UAT-02 (Gemini LOW / Codex MEDIUM).** UAT-02 lacks precise timestamp + screenshot; mark the D-05 exception unmistakably, and consider promoting an optional current reproducible-UI screenshot to a mandatory light artifact to satisfy ROADMAP SC-1 literally.
6. **ROADMAP plan-count / STATE staleness (Codex MEDIUM).** Ensure ROADMAP Phase 20 reflects 3 plans + Wave 2, and that verify-phase reliably clears STATE `Deferred Items` UAT entries (20-03 already guards STATE editing to avoid double-ownership — acceptable, but add the audit-confirm note).

### Divergent Views
- **Overall readiness.** Gemini: LOW / Approved, proceed. Codex: MEDIUM, fix migration wording + `deferred: 0` check + REQUIREMENTS contradiction before execution. Orchestrator verification sides with Codex on the two HIGHs — they would either produce a factually wrong audit artifact (migration premise) or false-fail a correct execution (`deferred: 0`), so both should be fixed before execute.
- **Screenshot/D-05 sufficiency.** Gemini treats it LOW; Codex elevates UAT-02's missing artifacts to MEDIUM. Both agree narrative-only is defensible for a non-reproducible historical event if explicitly documented.

### Recommended actions before execution (Cycle 2)
1. Reword 20-01 Task 1 + Implementation: migrations 14/15 alter post-success DB/RPC/trigger functions (not "only `update_profile_after_auth`"); the load-bearing claim is that non-members reject before the RPC.
2. Fix 20-02 `grep -c "deferred: 0"` acceptance to expect exactly **1** (or anchor to the single aggregate line).
3. Reword REQUIREMENTS.md UAT-01/02 (and ROADMAP) to reflect the operator-locked reconciliation pivot instead of appending "Validated" beneath "executed live this milestone."
4. Rewrite 20-02 Change 1 guard to scope-allow the specified `re_run` updates.
5. Make the D-05 narrative-only exception explicit in 20-02's closure; consider promoting an optional current reproducible-UI screenshot to a mandatory light artifact.
6. Confirm ROADMAP Phase 20 reflects 3 plans + Wave 2 and add a verify-phase audit note that STATE `Deferred Items` UAT rows are cleared at close.

---

# Cycle 3 Review

> Reviewers: Gemini, Codex. Claude skipped (self-review excluded — running inside Claude Code). Cursor attempted but failed (account usage limit). CodeRabbit attempted but returned "No files found for review" — the working tree is clean and this is an unexecuted, documentation-only planning phase with no diff to review. The orchestrator independently verified both of Codex's HIGH claims against the live plan and `REQUIREMENTS.md` files before writing the consensus.

## Gemini Review (Cycle 3)

# Phase 20 Implementation Plan Review: Live Human UAT

## Summary
The plan is a high-quality, surgical documentation sweep designed to satisfy the v1.4 debt-zero mandate without requiring redundant live testing. It correctly identifies that the "human execution" requirement has already been met by past events and focuses on aligning the project's tracking artifacts (`03-UAT.md`, `04-UAT.md`, `REQUIREMENTS.md`, `ROADMAP.md`) with this reality. The "preserve history while superseding the rollup" strategy is effectively implemented across all three plans.

## Strengths
- **Adherence to Conventions:** Strictly follows the D-10/D-11 preserve-history convention — historical data rows are not rewritten.
- **Surgical Accuracy:** Correctly distinguishes data rows from aggregate rollups; 20-02 identifies the actual `result: deferred` marker lives in the YAML frontmatter.
- **Empirical Validation:** 20-01 verifies the exact current line numbers in `auth-helpers.ts` before citing them.
- **Terminology Reconciliation:** Proactively addresses the "server-side vs. client-side" drift in REQUIREMENTS.md.
- **Clean Dependency Management:** 20-03 correctly placed in Wave 2.

## Concerns
- **Verification Anchoring (LOW):** Success criteria rely on grep counts; executor must use the exact anchored patterns to avoid false positives.
- **Manual Task Weight (LOW):** Multiple surgical string replacements in complex YAML/Markdown — any whitespace deviation could fail the replace.

## Suggestions
- Note any optional confirming screenshot path explicitly in 20-01-SUMMARY.md for a complete audit trail.
- Cross-check the historical "13" vs current "8" unit-test count to confirm no tests were accidentally deleted.

## Risk Assessment: LOW
No executable code, schema, or infra changes. Primary risk is documentation inconsistency, well-mitigated by exhaustive success criteria. Debt-zero goal achieved.

---

## Codex Review (Cycle 3)

The plan set is directionally sound: it correctly pivots Phase 20 from fresh live UAT to reconciliation of existing live PASS evidence, keeps edits in planning markdown, and adds a needed 20-03 tracking closeout. Main risks are audit accuracy and internal documentation consistency, not app/security/performance.

### 20-01-PLAN.md
**Concerns**
- **HIGH:** Migration language too broad — migration 14 includes `handle_new_user`, which fires from the `auth.users` trigger and is not necessarily "reached only after a successful member check." The safe claim is narrower.
- **MEDIUM:** Records a git-log finding but does not require running `git log` during execution.
- **LOW:** Narrative-only evidence wording should avoid implying a literal screenshot exists.

**Risk Assessment: MEDIUM** — operational risk low, but the migration-order overclaim could undermine the audit basis if copied into 03-UAT.md.

### 20-02-PLAN.md
**Concerns**
- **MEDIUM:** Change 1 says "Do NOT change re_run block contents" but later steps intentionally edit `re_run.results` / `re_run.followups` — instruction conflict.
- **MEDIUM:** UAT-02 evidence remains weaker than UAT-01 (no precise timestamp, no screenshot).
- **LOW:** No verification command for the current 8-test count.
- **LOW:** Grepping only `Test 6a still pending` could miss other stale wording.

**Risk Assessment: LOW to MEDIUM** — intended edits are safe; the contradictory `re_run` instruction should be cleaned up.

### 20-03-PLAN.md
**Concerns**
- **HIGH:** Append-only edits may leave contradictions in `REQUIREMENTS.md` — lines saying UAT was "executed live by the operator this milestone" and that alternatives to live runs are out of scope. Since the decision changed to accepting pre-existing live evidence, those global lines should be rewritten, not merely annotated.
- **MEDIUM:** `ROADMAP.md` says Phase 20 has `2 plans` / `0/2`; adding 20-03 requires `3 plans` / `0/3` plus a Wave 2 entry.
- **MEDIUM:** Checkbox ownership ambiguous (this plan vs phase-close workflow).
- **MEDIUM:** Add a phase-close verification note that STATE.md no longer carries UAT-01/02 as open.

**Risk Assessment: MEDIUM** — necessary plan, but appending closure notes without removing stale global wording/counts leaves the milestone internally inconsistent during audit.

---

## Consensus Summary (Cycle 3)

### Orchestrator verification of Codex's two HIGH claims

| Codex HIGH | Plan/file checked | Verdict |
|---|---|---|
| **20-01 migration wording too broad** (migration 14 / `handle_new_user` not "post-member-check") | `20-01-PLAN.md` lines 65, 73, 117 | **ALREADY RESOLVED in the plan.** The current plan already states the narrow, correct claim verbatim: migration 14 hardens *multiple* SECURITY DEFINER functions (`profile_self_update_allowed, handle_new_user, is_current_user_admin, increment_vote_count, validate_vote_choice, update_profile_after_auth`) — "all DB-side functions reached only AFTER a successful member check" — and the load-bearing point is the narrow one ("the non-member rejection branch returns and signs out BEFORE any post-success DB-side RPC runs"). The plan even explicitly warns: *"Do NOT claim the migrations 'only touch update_profile_after_auth' — that is factually too broad."* This is the Cycle-2 HIGH already fixed; Codex re-flagged it because it reviewed context-free. The `handle_new_user` nuance Codex raises does not break the plan's claim — the plan never asserts these functions are post-member-check *exclusively from the OAuth callback*; it asserts the **non-member rejection path** never reaches them, which is correct. **NOT counted.** |
| **20-03 append-only leaves REQUIREMENTS.md contradiction** | `20-03-PLAN.md` Change 3 (lines 90–95) + live `REQUIREMENTS.md` lines 14, 30, 85, 99–100 | **CONFIRMED REAL / UNRESOLVED.** The plan's Change 3 only *appends* a closure clause to the UAT-01/02 bullets. It does not touch line 14 ("Human UAT items = executed live by the operator this milestone"), line 30 ("Executed live by the operator this milestone with the required test accounts"), or the Out-of-Scope row at line 85 ("Operator chose to run UAT-01/02 live; E2E mocking is not a substitute"). After execution REQUIREMENTS.md would simultaneously read "executed live this milestone" AND "closed by accepting the 2026-05-03 pre-existing PASS (no fresh run)" — a genuine internal contradiction a debt-zero audit would flag. **Counted as the one remaining HIGH.** |

### Agreed Strengths (both reviewers)
- Correct phase framing — reconciliation of pre-existing live PASS evidence, not re-execution.
- Preserve-history + rollup-supersede convention honored across all three plans.
- Anchored grep checks now avoid blockquote false positives.
- 20-01 empirically re-verifies `auth-helpers.ts` line numbers before citing them.
- Documentation-only, null executable surface → low operational/security risk.

### Agreed / Confirmed Concerns

**HIGH (1 remaining, confirmed by orchestrator verification)**
1. **20-03 append-only edits leave a REQUIREMENTS.md internal contradiction (UNRESOLVED).** Change 3 appends a "closed by accepting pre-existing evidence (no fresh run)" clause but leaves the global "executed live by the operator this milestone" framing (REQUIREMENTS.md lines 14, 30) and the Out-of-Scope "Operator chose to run UAT-01/02 live" row (line 85) intact. Raised by Codex (HIGH); independently verified true against the live file. **Fix:** rewrite the global framing lines (14, 30, 85) to reflect the operator-locked pivot — "accepting pre-existing live evidence per D-01/D-02" — instead of only appending a clause beneath the unchanged "executed live this milestone" wording.

**Resolved since Cycle 2**
- **20-01 migration premise too broad — NOW RESOLVED.** Cycle-2 HIGH; the plan now states the narrow, factually-correct migration basis and explicitly forbids the over-broad claim. Codex re-raised it context-free in Cycle 3, but the live plan text already contains the exact fix. Re-verified at 20-01-PLAN.md lines 65/73/117.
- **20-02 `grep -c "deferred: 0"` false-fail — NOW RESOLVED.** Cycle-2 HIGH; not re-raised this cycle. Re-verified the 20-02 acceptance criteria no longer assert the bad count.

**MEDIUM**
2. **ROADMAP plan-count staleness (Codex).** ROADMAP.md still says Phase 20 = `2 plans` (line 165) and `0/2` (line 195); the 20-03 plan does not update these to `3 plans` / `0/3` or add a Wave 2 entry. Verified true against ROADMAP.md.
3. **20-02 Change 1 guard self-contradictory (Codex).** "Do NOT change re_run block contents" conflicts with the intended `re_run.results` / `re_run.followups` edits. Reword the guard to scope-allow the specified updates.
4. **Checkbox / STATE ownership (Codex).** Clarify whether 20-03 or the phase-close workflow flips plan checkboxes, and add a verify-phase note confirming STATE.md no longer carries UAT-01/02 as open.

**LOW**
5. **D-05 narrative-only artifact exception (Gemini LOW / Codex LOW).** UAT-02 lacks a precise timestamp/screenshot; keep the D-05 exception explicit and avoid wording that implies a literal screenshot exists.
6. **Grep/manual-edit fragility (Gemini LOW).** Use the exact anchored patterns and exact target strings to avoid replace-tool failures.

### Divergent Views
- **Overall readiness.** Gemini: LOW / approved, proceed. Codex: MEDIUM, two HIGHs before execution. Orchestrator verification splits Codex's two HIGHs: the 20-01 migration HIGH is already fixed in the plan (NOT counted); the 20-03 REQUIREMENTS contradiction is real and UNRESOLVED (counted). Net: **1 remaining HIGH**.

### Recommended actions before execution (Cycle 3)
1. **(HIGH)** In 20-03, rewrite REQUIREMENTS.md global framing — line 14 ("executed live by the operator this milestone"), line 30 (same), and the Out-of-Scope row at line 85 — to reflect the operator-locked accept-pre-existing-evidence pivot (D-01/D-02), instead of only appending a closure clause to the UAT-01/02 bullets. This closes the internal contradiction a debt-zero audit would catch.
2. **(MEDIUM)** Have 20-03 update ROADMAP.md Phase 20 to `3 plans` / `0/3` and add a Wave 2 entry.
3. **(MEDIUM)** Reword the 20-02 Change 1 guard to scope-allow the specified `re_run` updates.
4. **(MEDIUM)** Clarify plan-checkbox ownership and add a verify-phase note that STATE.md UAT-01/02 entries are cleared at close.
5. **(LOW)** Keep the D-05 narrative-only exception explicit; add the optional `git log` / 8-test verification commands Codex suggested.

### Cycle 2 → Cycle 3: status of prior HIGH concerns
| Cycle 2 HIGH | Status in Cycle 3 |
|---|---|
| 20-01 migration premise too broad | **FULLY RESOLVED** — plan now states the narrow correct basis and forbids the broad claim (20-01-PLAN.md lines 65/73/117). |
| 20-02 `grep -c "deferred: 0"` false-fail | **FULLY RESOLVED** — not re-raised; acceptance criteria corrected. |

**Net remaining HIGH after Cycle 3: 1** (the 20-03 REQUIREMENTS.md global-wording contradiction).

---

# Cycle 4 Review

> Reviewers: Gemini, Codex. Claude skipped (self-review excluded — running inside Claude Code). Cursor attempted but failed again (empty output — consistent with the Cycle 2/3 usage-limit failure). CodeRabbit not invoked: the working tree is clean and this is an unexecuted, documentation-only planning phase with no diff to review. The orchestrator independently verified both of Codex's HIGH claims against the live source/migration/UAT files before writing the consensus.
>
> This cycle re-reviews the plan set after the Cycle 3 fix landed (20-03 Change 3 now REWRITES the three contradictory global REQUIREMENTS.md lines rather than only appending a clause).

## Cycle 3 → Cycle 4: status of the prior HIGH concern

| Cycle 3 HIGH | Status in Cycle 4 | Verification |
|---|---|---|
| 20-03 append-only edits leave a REQUIREMENTS.md internal contradiction (global "executed live this milestone" lines ~14/~30/~85) | **FULLY RESOLVED** | 20-03-PLAN.md Change 3 (lines 101–125) now gives exact REWRITE replacement strings for all three global lines (~14/~30/~85), pivoting them to "satisfied by pre-existing live operator runs / no fresh run this milestone" per D-01/D-02. Both reviewers this cycle confirm the contradiction is removed; orchestrator re-verified the plan instructs a rewrite (not an append) and that the live REQUIREMENTS.md still carries the old wording only because the plan is unexecuted. |

## Gemini Review (Cycle 4)

Gemini assessed all three plans and concluded **all previously raised HIGH-severity concerns are resolved and no new HIGH was identified** — risk LOW, ready for execution.

- **20-01:** Praises the narrow migration claim (forbids the over-broad wording), anchored greps, and D-04 compliance. One LOW: reliance on specific `auth-helpers.ts` line numbers (mitigated by the in-plan re-confirmation step).
- **20-02:** "Highly robust" — correctly resolves both the frontmatter `result: deferred` data row and the `### 6` body `result: partial` row; acknowledges the 13→8 unit-test delta without altering historical text. No concerns raised.
- **20-03:** Calls Change 3's rewrite of the three global lines a complete resolution of the Cycle 3 HIGH; praises the terminology alignment (Change 4) and ROADMAP synchronization. One LOW: the Wave 2 checkbox is left for execute-phase to flip (standard).

Gemini's verdict: **LOW risk, no remaining HIGH, ready for execution.**

## Codex Review (Cycle 4)

Codex confirms the Cycle 3 REQUIREMENTS.md contradiction is resolved by 20-03 Change 3, but raises **two new HIGH concerns**:

- **HIGH #1 — 20-01 migration/path claim around `handle_new_user` is false.** The plan's instructed acceptance-basis text (20-01-PLAN.md lines 73 and 117) says Migration 14/15's touched functions are "reached **only** AFTER a successful member check" and lists `handle_new_user` among them. But `handle_new_user` is wired `AFTER INSERT ON auth.users` (`00000000000002_triggers.sql:160`) and is rewritten by Migration 14 (`00000000000014_...sql:20/28`). It fires during OAuth user creation — **before** the client-side guild check in `auth-helpers.ts` — so it is *not* post-member-check. A first-time non-member's signup would trigger it before rejection.
- **HIGH #2 — 20-02 misses the `## Current Test` deferred-status line.** `04-UAT.md:70` (under `## Current Test`) reads `[2026-04-25 re-run: 8 of 9 previously-blocked tests now pass on live prod; test 6a deferred until second admin signs in]`. 20-02-PLAN.md enumerates the markers it resolves (frontmatter `result_note`, the two "still pending" followups at ~52/~176, `re_run_partial` at ~174) but does **not** touch line 70. After a correct execution, `04-UAT.md` would still carry a current-status assertion that 6a is deferred — failing Phase 20 success criterion 3 and the debt-zero mandate. This is a current-status annotation, **not** a D-04-preserved historical `result:` row, so it must be updated.

Codex rates 20-01 and 20-02 **HIGH until fixed**; 20-03 **LOW** (Cycle 3 HIGH resolved). Two LOWs: hard-coded "2026-06-04" closure date (decision vs execution date), and ROADMAP top-level line uses an appended parenthetical rather than a clean rewrite.

## Consensus Summary (Cycle 4)

### Orchestrator verification of Codex's two HIGH claims

| Codex HIGH | Files checked | Verdict |
|---|---|---|
| **#1 — 20-01 `handle_new_user` "only after member check" claim is false** | `20-01-PLAN.md:73,117`; `00000000000002_triggers.sql:159-162`; `00000000000014_...sql:20,28`; `src/lib/auth-helpers.ts` (guild check at ~130, signOut on non-member, RPC after) | **CONFIRMED REAL / UNRESOLVED.** `handle_new_user` fires `AFTER INSERT ON auth.users` during OAuth user creation, which precedes the client-side guild check that rejects non-members. The plan's instructed wording contains a literally-false clause ("modify only DB-side functions reached AFTER a successful member check") AND lists `handle_new_user` under it. The *load-bearing* clause (non-members never reach the `update_profile_after_auth` RPC / post-success path) is true and sufficient — but the plan would still write the false clause into the 03-UAT.md audit artifact. For a debt-zero audit milestone whose purpose is an accurate trail, encoding a false premise is HIGH. **Distinction from Cycle 3:** in Cycle 3 the orchestrator ruled this NOT-counted because the *load-bearing* claim was narrow; Cycle 4 re-examined the **exact instructed text** and found the over-broad clause is still present verbatim and explicitly enumerates `handle_new_user`. Fix: drop "only…after a successful member check" as applied to the full list; state the narrow truth (non-members never reach the RPC / post-success functions; `handle_new_user` is a signup-time search_path-hardening rewrite that is behavior-identical and not the membership-rejection decision). |
| **#2 — 20-02 misses `## Current Test` line 70** | `04-UAT.md:70`; `20-02-PLAN.md` (resolves lines 4/52/174/176, not 70) | **CONFIRMED REAL / UNRESOLVED.** Line 70 is a current-status annotation asserting "test 6a deferred until second admin signs in." 20-02 does not enumerate it among the markers it clears. A correct execution leaves a visible current-status deferred scenario, violating success criterion 3 ("no remaining pending or deferred scenarios") and the debt-zero mandate. It is not a D-04-preserved `result:` row, so updating it to a Phase 20 closure note is in-scope and required. Fix: add a 20-02 change updating line 70 to a Phase 20 closure note + an acceptance grep (`grep -c "test 6a deferred until second admin signs in"` returns 0). |

### Agreed Strengths (both reviewers)
- The Cycle 3 REQUIREMENTS.md contradiction is fully resolved by 20-03 Change 3's rewrite of the three global lines.
- D-04 history preservation is correct: both non-pass rows in 04-UAT.md get separate forward pointers; no historical `result:` row is rewritten to pass.
- Anchored / blockquote-excluded greps avoid the Cycle 1 false-fail class.
- Server-side vs client-side terminology is reconciled across 03-UAT.md and REQUIREMENTS.md.

### Agreed Concerns (2+ reviewers — highest priority)

**HIGH (2 new this cycle — both raised by Codex, both confirmed by orchestrator verification; Gemini reviewed at higher altitude and did not surface either file-level specific)**
1. **20-01 acceptance-basis text encodes a false migration/path premise (UNRESOLVED).** The instructed wording says Migration 14/15's functions — including `handle_new_user` — are "reached only after a successful member check"; `handle_new_user` is an `auth.users` signup trigger that fires before the non-member rejection. Fix: state only the narrow truth.
2. **20-02 leaves the `## Current Test` line 70 deferred-status annotation unhandled (UNRESOLVED).** A correct execution still leaves "test 6a deferred until second admin signs in" in `04-UAT.md`, failing debt-zero success criterion 3. Fix: add a change + acceptance grep clearing line 70.

### Divergent Views
- **Overall readiness.** Gemini: LOW / approved, no remaining HIGH, proceed. Codex: two HIGHs before execution. Orchestrator verification sides with Codex — both claims are independently true against the live files and both would land an audit-integrity defect (a false premise in 03-UAT.md; a residual deferred scenario in 04-UAT.md) that a v1.4 debt-zero audit would flag. Net: **2 remaining HIGH.**

### Recommended actions before execution (Cycle 4)
1. **(HIGH)** In 20-01 Task 1/Task 2 (lines 73, 117), remove the clause asserting the full Migration-14 function list is "reached only after a successful member check." Replace with the narrow, true claim: non-members never reach the `update_profile_after_auth` RPC / post-success path; `handle_new_user` is a signup-time, behavior-identical search_path-hardening rewrite and is not the membership-rejection decision. Add a review note/grep ensuring the final 03-UAT.md text does not contain the over-broad phrasing.
2. **(HIGH)** In 20-02, add a change updating `04-UAT.md` line 70 (`## Current Test` → "test 6a deferred until second admin signs in") to a Phase 20 closure note, plus an acceptance grep (`grep -c "test 6a deferred until second admin signs in"` returns 0).
3. **(LOW)** Clarify whether the hard-coded "2026-06-04" closure date is the decision date or execution date (execution may land 2026-06-05).
4. **(LOW)** Prefer a clean rewrite of the ROADMAP top-level Phase 20 line over an appended parenthetical.

**Net remaining HIGH after Cycle 4: 2** (20-01 false `handle_new_user` migration premise; 20-02 unhandled `## Current Test` deferred-status line).

---

## Cycle 4 → Cycle 5: status of the prior HIGH concerns

| Cycle 4 HIGH | Status in Cycle 5 | Verification |
|---|---|---|
| **20-01 acceptance-basis text encodes a false migration/path premise** (`handle_new_user` "reached only after a successful member check") | **FULLY RESOLVED** | 20-01-PLAN.md Task 1 (line 65), Task 2 Change 3 (line 119), Task 1 `<done>` (line 84), and success criteria (line 181) now explicitly FORBID the over-broad claim and instruct the narrow true statement: non-members never reach the `update_profile_after_auth` RPC; `handle_new_user` is a signup-time, behavior-identical `search_path`-hardening rewrite that fires `AFTER INSERT ON auth.users` before the guild check, NOT a post-member-check function. The plan cites "review HIGH #1 — Cycle 4" inline. Orchestrator re-verified against live migration 14 (`handle_new_user` at line 28 of 6 hardened functions) and `00000000000002_triggers.sql:159-162` (`AFTER INSERT ON auth.users`). Both Gemini and Codex this cycle confirm RESOLVED. |
| **20-02 leaves the `## Current Test` line 70 deferred-status annotation unhandled** | **FULLY RESOLVED** | 20-02-PLAN.md Change 0 (lines 73-78) now explicitly replaces the `## Current Test` line 70 annotation ("test 6a deferred until second admin signs in") with a Phase 20 closure note, backed by acceptance grep `grep -c "deferred until second admin"` returns 0 (lines 152, 164, 201). Orchestrator re-verified the live line 70 still carries the stale string (so the target is real) and that the plan correctly targets it as a current-status note, not a D-04 historical row. Both reviewers confirm RESOLVED. |

**Both Cycle 4 HIGHs are FULLY RESOLVED in the Cycle 5 plans.**

---

> Reviewers: Gemini, Codex. Claude skipped (self-review excluded — running inside Claude Code). Cursor attempted but failed again (usage-limit — consistent with Cycles 2/3/4). CodeRabbit not invoked: the working tree is clean and this is an unexecuted, documentation-only planning phase with no diff to review. The orchestrator independently verified every grep-count claim against the live `ROADMAP.md` / `04-UAT.md` / plan files before writing the consensus.

## Gemini Review (Cycle 5)

Gemini assessed all three plans and concluded **all previously raised HIGH-severity concerns (Cycle 4 #1/#2 and Cycle 3 #3) are RESOLVED, and no new HIGH or MEDIUM was identified** — risk LOW, ready for execution.

- **20-01:** Praises the narrow Migration-14 security claim, anchored greps, and the server-side/client-side terminology reconciliation. No concerns.
- **20-02:** "Exhaustive sweep" of frontmatter, summary, followups, and body rows; correctly identifies the frontmatter `re_run.results` object as the primary deferred data row; corrects the stale 13→8 unit-test count. No concerns.
- **20-03:** Rewrite-not-append on the three global lines; avoids STATE.md double-ownership; corrects Phase 20 plan counts and Wave structure. No concerns.

Gemini's verdict: **LOW risk, no remaining HIGH or MEDIUM, ready for execution.** (Reviewed at higher altitude — did not execute the acceptance greps against the live files.)

## Codex Review (Cycle 5)

Codex confirms **both Cycle 4 HIGHs are RESOLVED** (20-01 migration claim now narrow and correct; 20-02 Change 0 clears the line-70 annotation), and independently verified 8 `it()` blocks in `demote-admin.test.ts` (matching the plan's corrected count). It then raises **new HIGH concerns confined to verification/acceptance greps** in 20-02 and 20-03 — the plans' own self-checks would false-fail on a correct execution:

- **HIGH (20-03) — `grep -c "Plans\*\*: 3 plans"` expects 1 but is already impossible.** `ROADMAP.md` already contains two `**Plans**: 3 plans` lines (other phases at lines 125 and 143). After Phase 20 flips 2→3, the count becomes 3, not 1. Fix: scope the verifier to the Phase 20 section.
- **HIGH (20-02) — `grep -c "UAT-02 Phase 20 Closure"` expects 1 but the plan writes the phrase 3+ times** (the section heading + the Change 0 Current Test note "See § ... + § UAT-02 Phase 20 Closure" + the 2a resolution pointer "§ UAT-02 Phase 20 Closure below"). Fix: anchor to `grep -c "^## UAT-02 Phase 20 Closure$"`.
- **MEDIUM (20-02) — blockquote-excluded `grep "result: deferred" | grep -vc '^>'` expects 1** but Change 5's closure prose ("the archival `result: deferred` / `result: partial` rows are intentionally preserved") adds a second non-blockquote match. The plan's parallel ANCHORED check `grep -c "^      result: deferred$"` = 1 is robust; the blockquote-excluded variant is redundant and should be dropped.
- **MEDIUM (20-03):** top-level Phase 20 ROADMAP entry is appended-to rather than cleanly rewritten (carry-over LOW/MEDIUM from Cycle 4).

Codex rates 20-01 **LOW**, 20-02 **HIGH-as-written / LOW-after-verifier-fix**, 20-03 **HIGH-as-written / LOW-after-verifier-fix**.

## Consensus Summary (Cycle 5)

### Orchestrator verification of Codex's three new claims

| Codex claim | Files checked | Verdict |
|---|---|---|
| **20-03 `grep -c "Plans\*\*: 3 plans"` expects 1, impossible** | live `ROADMAP.md` lines 125/143/165 | **CONFIRMED REAL / UNRESOLVED (HIGH).** Two pre-existing `**Plans**: 3 plans` lines already exist (lines 125, 143). After Phase 20's line 165 flips 2→3, the count is **3**, so the `= 1` acceptance criterion false-fails on a correct execution. Same false-fail class as Cycle 1. The accompanying progress-row check (`20. Live Human UAT | 0/3`) is correctly scoped, but the plan-count grep is not. **Counted.** |
| **20-02 `grep -c "UAT-02 Phase 20 Closure"` expects 1, plan writes it 3+ times** | `20-02-PLAN.md` Change 0 (line 77), heading (line 129), 2a pointer (line 94) | **CONFIRMED REAL / UNRESOLVED (HIGH).** The plan instructs writing "§ UAT-02 Phase 20 Closure" into the Current Test closure note AND the 2a resolution pointer AND the section heading — a correct execution yields ≥3 matches, not 1. The `= 1` criterion false-fails. Fix: anchor to `^## UAT-02 Phase 20 Closure$`. **Counted.** |
| **20-02 blockquote-excluded `result: deferred` grep expects 1, closure prose adds a match** | `20-02-PLAN.md` Change 5 (line 138) | **CONFIRMED REAL but MEDIUM (not counted as HIGH).** Change 5's success-criterion-3 clarification prose contains a non-blockquote `result: deferred` mention, so the blockquote-excluded variant would return 2. However, the plan ALSO carries the robust anchored check `grep -c "^      result: deferred$"` = 1, which correctly counts the single data row. The defect is a redundant secondary verifier, not a missing/incorrect data edit. Folded into the 20-02 verifier-fix action. |

### Agreed Strengths (both reviewers)
- Both Cycle 4 HIGHs (20-01 migration premise, 20-02 line-70 annotation) are fully and correctly resolved; the substantive documentation edits are sound across all three plans.
- D-04 history preservation remains correct: both 04-UAT.md non-pass rows get separate forward pointers; no historical `result:` row is rewritten to pass.
- 20-01's narrow Migration-14 claim is factually accurate (verified against live migration 14 + trigger wiring).
- 20-03's rewrite-not-append of the three global REQUIREMENTS.md lines holds; the Cycle 3 contradiction stays resolved.
- 20-02 corrects the stale 13→8 unit-test count (Codex independently verified 8 `it()` blocks).

### Agreed / Confirmed Concerns

**HIGH (2 new this cycle — both raised by Codex, both confirmed by orchestrator verification against the live files; Gemini reviewed at higher altitude and did not execute the greps)**
1. **20-03 ROADMAP plan-count verifier false-fails (UNRESOLVED).** `grep -c "Plans\*\*: 3 plans"` expects 1, but two unrelated phases already match (ROADMAP lines 125/143); a correct Phase-20 edit yields 3. Fix: scope the grep to the Phase 20 section (e.g. `awk` the Phase 20 block, or check the specific line) and restate the expected count.
2. **20-02 closure-phrase verifier false-fails (UNRESOLVED).** `grep -c "UAT-02 Phase 20 Closure"` expects 1, but the plan deliberately writes the phrase in the heading + Current Test note + 2a resolution pointer (≥3 matches). Fix: anchor to `grep -c "^## UAT-02 Phase 20 Closure$"` (the heading only).

**MEDIUM**
- **20-02 redundant blockquote-excluded `result: deferred` grep** would also false-fail (closure prose adds a non-blockquote match); the parallel anchored `^      result: deferred$` check is robust — drop or replace the redundant variant.
- **20-03 top-level Phase 20 ROADMAP entry** appended-to rather than cleanly rewritten (carry-over).

### Divergent Views
- **Overall readiness.** Gemini: LOW / approved, no remaining HIGH/MEDIUM, proceed. Codex: two HIGH verifier defects before execution. Orchestrator verification sides with Codex — both grep claims are independently true against the live files and both would block a clean autonomous execution (the plans would fail their own acceptance checks even on a perfectly correct documentation edit). Net: **2 remaining HIGH.**

### Recommended actions before execution (Cycle 5)
1. **(HIGH)** In 20-03 Task 2, replace the unscoped `grep -c "Plans\*\*: 3 plans"` (expects 1) with a Phase-20-scoped check — e.g. extract the Phase 20 ROADMAP block first (`awk '/^### Phase 20:/{f=1} f; /^### Phase 21:/{exit}'`) and assert `**Plans**: 3 plans` appears once within it, or verify the specific line number. Restate the expected count accordingly.
2. **(HIGH)** In 20-02, change the closure-section acceptance grep from `grep -c "UAT-02 Phase 20 Closure"` (expects 1) to the anchored heading-only form `grep -c "^## UAT-02 Phase 20 Closure$"` (expects 1), so the deliberate in-prose references to the section do not inflate the count.
3. **(MEDIUM)** In 20-02, drop the blockquote-excluded `grep "result: deferred" | grep -vc '^>'` check (it will read 2 after the closure prose is added) and rely on the already-correct anchored `grep -c "^      result: deferred$"` = 1.
4. **(MEDIUM)** In 20-03, prefer a clean rewrite of the top-level Phase 20 ROADMAP entry over an appended parenthetical.

**Net remaining HIGH after Cycle 5: 2** (20-03 unscoped ROADMAP plan-count verifier false-fail; 20-02 unanchored `UAT-02 Phase 20 Closure` verifier false-fail). Both are acceptance-grep defects in the plans' self-checks — the substantive documentation edits are correct; the plans would false-fail their own verification on a correct execution unless the greps are scoped/anchored. The two Cycle 4 HIGHs are FULLY RESOLVED.

---

## Cycle 5 → Cycle 6: status of the prior HIGH concerns

| Cycle 5 HIGH | Status in Cycle 6 | Verification |
|---|---|---|
| **20-03 ROADMAP plan-count verifier false-fails** (unscoped `grep -c "Plans\*\*: 3 plans"` expects 1, but Phases 18/19 already match → global count 3) | **FULLY RESOLVED** | 20-03-PLAN.md now scopes the check to the Phase 20 block: `awk '/^### Phase 20:/{f=1} /^### Phase 21:/{f=0} f' ROADMAP.md \| grep -c "Plans\*\*: 3 plans"` expecting 1, plus a paired scoped `"Plans\*\*: 2 plans"` = 0 (PLAN lines 216-217, 266-267, success criterion line 223). The plan explicitly documents "DO NOT use a GLOBAL grep ... Phases 18 and 19 already carry 'Plans**: 3 plans'" and cites "review HIGH — Cycle 5". Orchestrator re-ran against live `ROADMAP.md`: GLOBAL `3 plans` count = 2 today (proving the old verifier was genuinely broken); Phase-20-scoped `3 plans` = 0 / `2 plans` = 1 pre-execution (flips to 1/0 after a correct edit). The scoped verifier is correct. |
| **20-02 closure-phrase verifier false-fails** (unanchored `grep -c "UAT-02 Phase 20 Closure"` expects 1, but the phrase is deliberately written 3×: heading + Current-Test note + 2a pointer) | **FULLY RESOLVED** | 20-02-PLAN.md now anchors the check to the heading only: `grep -c "^## UAT-02 Phase 20 Closure$"` expecting 1 (PLAN lines 147, 158, 199). The plan explicitly notes "the plan deliberately writes the phrase ... in THREE places ... so the UNANCHORED grep returns 3 after a correct edit, NOT 1. Anchor to `^## ...$`" and cites "review HIGH — Cycle 5". Orchestrator re-ran against live `04-UAT.md`: heading-anchored count = 0 pre-execution (correct; section not yet written → 1 post-edit); the anchored data-row check `^      result: deferred$` = 1 matches the plan's stated expectation. Verifier is correct. |

**Both Cycle 5 HIGHs are FULLY RESOLVED in the Cycle 6 plans, independently verified against the live `ROADMAP.md` / `04-UAT.md` files.** The associated Cycle 5 MEDIUMs (20-02 redundant blockquote-excluded `result: deferred` grep; 20-03 append-vs-rewrite ROADMAP wording) are now documented in-plan as expected behavior with the robust anchored check retained — folded down, not blocking.

---

> Reviewers: Gemini, Codex. Claude skipped (self-review excluded — running inside Claude Code CLI). Cursor attempted but failed again (account usage limit — consistent with Cycles 2/3/4/5). CodeRabbit attempted but returned "No files found for review" — the working tree is clean and this is an unexecuted, documentation-only planning phase with no diff to review. The orchestrator independently re-ran every disputed grep/`awk` verifier against the live `ROADMAP.md` / `04-UAT.md` / plan files before writing the consensus.

## Gemini Review (Cycle 6)

Gemini assessed all three plans and concluded the plans are **"exceptionally well-crafted," with correct dependency ordering and an additive supersession strategy that preserves historical integrity** — risk **LOW**, no HIGH or MEDIUM concerns identified.

- **Historical integrity:** Adheres strictly to the preserve-history convention (D-04/D-10/D-11), using resolution pointers rather than destructive edits.
- **Narrow technical claims:** Praises 20-01's research task to re-verify exact line numbers and the correct narrowing of the Migration 14/15 scope (`handle_new_user` is not gated by the membership check).
- **Terminology reconciliation:** Proactively reconciles "server-side gate" (roadmap) vs. "client-side guild check" (implementation).
- **Robust verification:** Calls out the anchored greps and blockquote exclusion as "a sophisticated understanding of how to audit YAML-in-Markdown structures reliably."
- **Concerns (LOW only):** Line-number drift between Task 1 and Task 2; minor regex-verification fragility if manual formatting differs slightly. Suggests `git diff` as a final visual verification step.

Gemini's verdict: **LOW risk, no remaining HIGH or MEDIUM, ready for execution.**

## Codex Review (Cycle 6)

Codex spot-checked the live repo artifacts and states up front: **"I did not find a blocking HIGH issue."** It confirms the plans are "strong and unusually explicit about preserving history while reconciling debt-zero rollups," and raises only audit-consistency MEDIUM/LOW items:

- **20-01 (LOW risk):** MEDIUM — ROADMAP still says "screenshot or screen-recording reference" while the plan chooses narrative+verdict (D-05 allows this, but a strict verifier may question it). LOW — `git log` for gate files not explicitly captured; frontmatter `updated:` stays stale. Confirms live `auth-helpers.ts` non-member branch at lines 191-202, RPC at line 209.
- **20-02 (MEDIUM risk):** MEDIUM — `re_run_partial: 0` while `re_run_passed: 8` / `re_run_at: 2026-04-25` may read inconsistently (the off-record 6a pass was not part of that re-run); preserved `deferred`/`partial`/`pending` prose could confuse a naive grep audit. LOW — frontmatter `updated:` stale.
- **20-03 (MEDIUM risk):** MEDIUM — top-level Phase 20 ROADMAP line is appended-to rather than cleanly rewritten; progress shows `0/3 | Not started` and stays stale unless a later workflow step checks the boxes. LOW — "locked at scoping" rewrites should explicitly say "superseded by D-01/D-02"; `Validated` vs `Complete` vocabulary mix.

Codex rates 20-01 **LOW**, 20-02 **MEDIUM**, 20-03 **MEDIUM** — **no HIGH on any plan.**

## Consensus Summary (Cycle 6)

### Orchestrator verification of the Cycle 5 fixes

| Cycle 5 HIGH fix | Files checked | Verdict |
|---|---|---|
| 20-03 Phase-20-scoped plan-count verifier | live `ROADMAP.md` (lines ~125/143/165) + 20-03-PLAN.md | **FULLY RESOLVED.** GLOBAL `Plans**: 3 plans` = 2 (old unscoped check expecting 1 was genuinely broken); Phase-20-scoped `awk \| grep` correctly isolates the block (3 plans = 0 / 2 plans = 1 pre-execution → 1/0 post-edit). |
| 20-02 heading-anchored closure verifier | live `04-UAT.md` + 20-02-PLAN.md | **FULLY RESOLVED.** `grep -c "^## UAT-02 Phase 20 Closure$"` = 0 pre-execution (correct; → 1 post-edit); plan documents the deliberate 3× unanchored occurrence as expected. Anchored `^      result: deferred$` = 1 matches plan expectation. |

### Agreed Strengths (both reviewers)
- Both Cycle 5 HIGH verifier defects are fully fixed; the acceptance greps are now scoped/anchored and will not false-fail a correct execution.
- The additive "verbatim-preserve + rollup-supersede" strategy (D-04) correctly preserves history while clearing debt-zero markers across all three plans.
- 20-01's narrow Migration-14 claim and live source anchors (auth-helpers.ts non-member branch + RPC) are factually accurate.
- Dependency ordering is correct: 20-03 runs after 20-01/20-02; milestone artifacts updated only after evidence files are reconciled.

### Agreed / Confirmed Concerns

**HIGH:** None. Both reviewers explicitly report zero blocking HIGH concerns this cycle; the two Cycle 5 HIGHs are FULLY RESOLVED and independently re-verified.

**MEDIUM (non-blocking audit-precision items — neither reviewer treats these as execution blockers)**
- 20-02 re-run summary semantics: `re_run_passed: 8` with `re_run_at: 2026-04-25` could read inconsistently against the later off-record 6a pass. Mitigation: a one-line clarifying note (Codex suggestion) — does not affect the substantive edits.
- 20-03 top-level Phase 20 ROADMAP entry appended-to rather than cleanly rewritten (carry-over LOW/MEDIUM since Cycle 4).
- 20-01 ROADMAP "screenshot or screen-recording reference" wording vs. the chosen D-05 narrative+verdict artifact.

**LOW**
- Frontmatter `updated:` dates preserved as original-run metadata (both 03-UAT.md / 04-UAT.md); line-number drift risk between Task 1 re-confirmation and Task 2 edits; `Validated` vs `Complete` status-vocabulary mix in the traceability table.

### Divergent Views
- **Overall readiness.** Gemini: LOW / approved, no remaining HIGH or MEDIUM, proceed. Codex: no blocking HIGH; rates 20-02/20-03 MEDIUM on audit-consistency polish. The orchestrator's verification confirms both Cycle 5 HIGHs are fixed and no new HIGH exists. Net: **0 remaining HIGH.** The MEDIUMs are optional pre-execution polish, not blockers.

### Recommended actions before execution (Cycle 6 — all OPTIONAL, none blocking)
1. **(MEDIUM, optional)** In 20-02, add a one-line clarifier that `re_run_passed: 8` refers to the 2026-04-25 re-run only and the 6a pass was formalized separately via Phase 20 closure.
2. **(MEDIUM, optional)** In 20-03, prefer a clean rewrite of the top-level Phase 20 ROADMAP entry over the appended parenthetical, and confirm a post-plan owner updates the `0/3` progress/checkboxes (verify-phase responsibility, already noted in-plan).
3. **(LOW, optional)** Decide explicitly whether frontmatter `updated:` is preserved-as-original or bumped to the Phase 20 closure date, and whether `Validated`/`Complete` vocabulary is intentional.

**Net remaining HIGH after Cycle 6: 0.** Both Cycle 5 HIGH verifier defects (20-03 unscoped ROADMAP plan-count; 20-02 unanchored `UAT-02 Phase 20 Closure`) are FULLY RESOLVED and independently re-verified against the live files. No new HIGH was raised by either reviewer. Remaining items are optional MEDIUM/LOW audit-precision polish. The plans are execution-ready.
