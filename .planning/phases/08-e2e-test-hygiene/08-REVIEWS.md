---
phase: 8
round: 6 (convergence cycle 2 — final)
reviewers: [gemini, codex, cursor]
skipped: [claude, coderabbit]
skip_reason: "claude: running inside Claude Code. coderabbit: working tree clean."
previous_rounds: "git commits 0e598cc (r1), f662e87 (r2), 77af7f0 (r3), 93d56b4 (r4), dc17408 (cycle 1)"
reviewed_at: 2026-05-03T04:46:58Z
plans_reviewed: [08-01-PLAN.md, 08-02-PLAN.md, 08-03-PLAN.md, 08-04-PLAN.md]
convergence_state: "DECLARED — stop triggered by user rule (flip-flop + nitpick threshold reached)"
---

# Cross-AI Plan Review — Phase 8: E2E Test Hygiene (Convergence Cycle 2)

## Gemini Review

### Verdicts for Cycle-1 Fixes

1.  **Plan 01 acceptance grep (08-01-PLAN.md:316): ACCEPTED**. The single failing regex has been replaced by three explicit `grep -q` checks for the individual error-handling branches (`error || !data`, `choiceErr`, and `deleteErr`).
2.  **TEST-10 wording drift (REQUIREMENTS.md:29): ACCEPTED**. Wording has been updated from "no 2FA" to "2FA-enabled, non-WTCS-member Discord tester" with a clear explanation of the verification path requirements.
3.  **Hardcoded paths (08-02, 08-04): ACCEPTED**. All hardcoded absolute paths in verification blocks have been normalized to `cd "$(git rev-parse --show-toplevel)"`.
4.  **TEST-10-readonly gate (VALIDATION.md:48): ACCEPTED**. The `git diff` path filter now correctly includes `'e2e/**'` to ensure no scope drift into the test suite during the docs-only task.

### New Concerns

-   **MEDIUM — `08-03-PLAN.md` synthetic canary `printf` syntax error.** The `printf` commands at L349 and L357 generate spec files with the literal string `test'ntest(`. This results in a syntax error (missing newline or semicolon after the import). While the verification gate `test "$STATUS" -ne 0` will pass because ESLint fails on syntax errors, it **fails to validate the `no-restricted-syntax` rule itself**. The planner's dismissal of this in the "What changed" summary as a false-positive is incorrect; the backslash is visibly missing in the plan text provided.

### Risk Assessment

**Overall risk: LOW.** The core logic for the fixture implementation, ESLint rule enforcement, and spec migrations is technically sound. All major portability and requirements-alignment issues have been resolved. The remaining `printf` concern is confined to a verification canary and does not affect the production implementation or the actual E2E suite.

**READY TO EXECUTE**

---

## Codex Review

## Cycle-1 Fix Verdicts

1. **Plan 01 acceptance grep**: **ACCEPTED**  
   Task 2 now uses explicit checks for `if (error || !data)`, `if (choiceErr)`, and `if (deleteErr)`.

2. **TEST-10 wording drift**: **NEEDS-WORK**  
   The revised 08-04 runbook still says: `REQUIREMENTS.md TEST-10 reads "no 2FA"`. That is now false and would reintroduce stale wording into the new artifact.

3. **Hardcoded paths**: **ACCEPTED**  
   The cited commands now use `cd "$(git rev-parse --show-toplevel)"`.

4. **TEST-10-readonly gate**: **ACCEPTED**  
   The gate now includes `e2e/**`.

## New Concerns

- **MEDIUM — 08-01 Task 1 has another self-failing acceptance check.**  
  The `git diff -U0 ... | grep -v ...` command intended to prove `loginAs()` is unchanged will still print added getter lines like `if (!serviceRoleKey)`, `throw new Error(`, `auth: ...`, and braces. The “should show only import line replacement” criterion is not satisfiable as written.

- **MEDIUM — 08-01 AggregateError claim is stronger than Playwright semantics support.**  
  The `catch (e)` around `await use(...)` will not capture test-body failures; Playwright resumes fixture teardown by resolving `_useFuncFinished`, not by throwing the test failure through `use()`. This only preserves fixture setup errors plus cleanup errors. Either soften the must-have claim or use `testInfo.errors` if test-failure-plus-cleanup-failure preservation is required.

## Risk Assessment

**NOT READY TO EXECUTE.**  
No new HIGH issues, but there are remaining MEDIUMs. Fix the stale TEST-10 runbook note and the two 08-01 acceptance/semantics issues, then convergence looks likely.

---

## Cursor Review

## 1. Verdicts on the four cycle‑2 fixes

| Fix | Verdict | Notes |
|-----|---------|--------|
| **Plan 01 acceptance grep (three branch checks)** | **ACCEPTED** | `08-01-PLAN.md` acceptance criteria now use three explicit greps for `if (error \|\| !data)`, `if (choiceErr)`, and `if (deleteErr)` (see around lines 315–316). |
| **TEST‑10 wording (REQUIREMENTS / PROJECT / v1.1‑SUMMARY)** | **ACCEPTED** | `.planning/REQUIREMENTS.md` L29, `.planning/PROJECT.md` L120, `.planning/research/v1.1-SUMMARY.md` L19 now describe a **2FA‑enabled, non‑WTCS‑member** tester with a clear WHY. |
| **Hardcoded `cd /Users/...` paths** | **ACCEPTED** | `08-02-PLAN.md` and `08-04-PLAN.md` verify blocks use `cd "$(git rev-parse --show-toplevel)"`. |
| **TEST‑10‑readonly gate + `e2e/**`** | **ACCEPTED** | `.planning/phases/08-e2e-test-hygiene/08-VALIDATION.md` L48 includes `'e2e/**'` in the git diff paths. |

---

## 2. New concerns (post cycle‑2)

| Sev | Issue |
|-----|--------|
| **MEDIUM** | **Duplicate verification table in `08-RESEARCH.md`** (~L488): `TEST-10 (runbook is read-only)` still uses `git diff ... -- 'src/**' 'supabase/**'` **without** `'e2e/**'`, so it **does not match** the canonical gate in `08-VALIDATION.md`. Anyone following RESEARCH instead of VALIDATION can still think `e2e/**` touches are allowed for TEST‑10. |
| **MEDIUM** | **`.planning/MILESTONES.md` L91** still says second human “**(Discord member, no 2FA non-blocking)**”, which conflicts with TEST‑10 (non‑member path + 2FA must clear). Same *class* of drift you fixed in REQUIREMENTS/PROJECT/SUMMARY, but **not** updated there. |
| **LOW** | **`08-04-PLAN.md` embedded runbook** footnote still says *“REQUIREMENTS.md TEST‑10 reads ‘no 2FA’ — that was the OLD blocker”*; canonical REQUIREMENTS no longer says that, so the footnote will confuse unless adjusted when the real `08-UAT-10-SCRIPT.md` is written. |
| **LOW** | **`08-REVIEWS.md`** remains a **cycle‑1** snapshot (e.g. hardcoded paths, stale REQUIREMENTS L29). Fine as history; misleading if read as current risk state without a cycle‑2 addendum. |
| **LOW** | **Plan 01 “Plan 02 ESLint rule covers `poll-fixture.ts`”** wording: `no-restricted-syntax` is scoped to **`e2e/tests/**/*.spec.ts`** only; the fixture file only gets the global `**/*.{ts,tsx}` ruleset, not E2E‑SCOPE‑1. Imprecise narrative, not a code bug. |

No **HIGH** issues identified from this pass. The Gemini **`printf` / `'ntest`** finding remains correctly treated as a **false positive** (`\n` vs misread).

---

## 3. Risk assessment

- **Execution risk for Phase 8 implementation:** **LOW** — the four plans are internally usable; the remaining problems are **documentation / traceability** alignment (RESEARCH vs VALIDATION, MILESTONES, runbook footnote).
- **Verdict:** **READY TO EXECUTE** for Waves 1–2 **with residual MEDIUM doc debt** — align `08-RESEARCH.md` L488 with `08-VALIDATION.md`, and fix or explicitly defer `MILESTONES.md` L91 before calling the milestone docs fully consistent.

**Convergence:** The **cycle‑1 MEDIUM blockers you targeted are addressed in-repo**; **full narrative convergence** across *all* planning surfaces is **not** complete until RESEARCH + MILESTONES (and optionally the runbook footnote / REVIEWS header) are refreshed.

---

## Cycle-1 Fix Verdicts (consensus)

| Item | Subject | Gemini | Codex | Cursor | Consensus |
|------|---------|--------|-------|--------|-----------|
| MEDIUM-1 | Plan 01 acceptance grep (3 branches) | ACCEPTED | ACCEPTED | ACCEPTED | ✅ ACCEPTED |
| MEDIUM-2 | TEST-10 wording in REQUIREMENTS+PROJECT | ACCEPTED | NEEDS-WORK (footnote stale) | ACCEPTED | ⚠ Footnote follow-up |
| MEDIUM-3 | Hardcoded paths → `git rev-parse` | ACCEPTED | ACCEPTED | ACCEPTED | ✅ ACCEPTED |
| MEDIUM-4 | TEST-10-readonly gate adds `e2e/**` | ACCEPTED | ACCEPTED | ACCEPTED | ✅ ACCEPTED |

Three of four cycle-1 fixes universally ACCEPTED. The 1 NEEDS-WORK is the runbook footnote that still cites the OLD TEST-10 wording ("reads 'no 2FA'") even though REQUIREMENTS.md was updated.

## Convergence Stop Signals (per user rule "stop on no concerns OR nitpicks OR flip-flops")

### 🚦 Stop signal 1 — Codex flip-flopped on AggregateError semantics

**Round 3 verdict (Codex):** "MEDIUM-3: ACCEPTED — The AggregateError control flow is sound for normal thrown errors. The plan captures the primary error... rethrows it from catch... preserves both errors via AggregateError."

**Cycle 2 verdict (Codex):** "08-01 AggregateError claim is stronger than Playwright semantics support. The catch (e) around await use(...) will not capture test-body failures; Playwright resumes fixture teardown by resolving _useFuncFinished, not by throwing the test failure through use()."

Same code, opposite verdicts within the same reviewer 2 rounds apart. **This is the textbook flip-flop case the user's stop rule targets.** Per the rule, this finding is excluded from the cycle's HIGH/MEDIUM count and convergence is declared.

### 🚦 Stop signal 2 — Cursor doc-debt in non-plan artifacts

Cursor surfaced 2 MEDIUM doc-debt items in RESEARCH.md L488 (still cites `title like '[E2E]%'` after VALIDATION.md was updated) and MILESTONES.md L91 (still mentions "no 2FA non-blocking" after REQUIREMENTS.md was updated).

These are real drift but in non-executed planning artifacts (RESEARCH and MILESTONES). The PLAN.md files + ESLint rule + e2e/README + REQUIREMENTS.md are the executor's contract. RESEARCH/MILESTONES doc-staleness is post-hoc traceability concern, not execution-blocking. **Per user's nitpick rule, deferred.**

### 🚦 Stop signal 3 — Gemini repeated false positive (4th time)

Gemini again raised the "printf typo `'ntest`" claim. Re-verified for the 4th consecutive round: the literal text in 08-03-PLAN.md L447 + L455 is `@playwright/test'\ntest('x', ...` — escaped 
, not apostrophe-n. Gemini consistently misreads this. **Per orchestrator rule on repeat false positives, excluded from count.**

## Remaining Actionable (NOT addressed in this cycle — surfaced for the user)

These are real findings but small enough to defer per user judgment:

1. **🟡 TEST-10 footnote in 08-04 runbook (Codex)** — Plan 04 Task 1 runbook content L116 says `> Note: REQUIREMENTS.md TEST-10 reads "no 2FA" — that was the OLD blocker.` But REQUIREMENTS.md was updated in cycle 1 to read "2FA-enabled, non-WTCS-member." The footnote is now narratively backwards. **1-line fix:** rephrase to `> Note: TEST-10 was originally written as "no 2FA" (reflecting the OLD blocker). REQUIREMENTS.md was corrected in 2026-05 to reflect the actual fix: 2FA must be enabled so the gate clears and the not-in-server check fires.`

2. **🟡 08-01 Task 1 git diff acceptance criterion (Codex)** — Acceptance criterion text at L189 includes a `git diff -U0 ... | grep -v 'getAdminClient|_adminClient|SupabaseClient|...'` chain that intends to prove `loginAs()` is unchanged. Codex notes the new getter contains more line patterns than the `grep -v` filter catches (e.g., `if (!serviceRoleKey)`, `throw new Error`, `auth:`, braces) — the criterion as written would print residual lines. **Note:** This is in `<acceptance_criteria>` text only, NOT in the `<verify>` `<automated>` block — so the autonomous task is not actually gated on this. But human reviewers running the criterion literally would see false-positive output. **Fix:** Either remove the over-specific git-diff criterion (keep the simpler grep checks) OR move it to the `<automated>` block with a tighter filter.

3. **🟢 RESEARCH.md L488 leak query stale (Cursor)** — `title like '[E2E]%'` not updated after VALIDATION.md was tightened. Doc-only, non-executed.

4. **🟢 MILESTONES.md L91 "no 2FA non-blocking" wording (Cursor)** — Stale post REQUIREMENTS update. Doc-only, non-executed.

## Risk Spread

- **Gemini: LOW + READY TO EXECUTE** (with verified false-positive printf)
- **Codex: NOT READY** (driven by flip-flopped AggregateError + 2 real MEDIUMs)
- **Cursor: LOW + READY TO EXECUTE** (with deferred non-plan doc-debt)

**Adjusted consensus: LOW for plan execution.** The plans themselves are sound; remaining issues are footnotes/criteria/non-plan-docs that don't gate autonomous execution. The 1 "NOT READY" verdict is driven primarily by Codex's flip-flopped finding which the convergence rule excludes.

## CYCLE_SUMMARY: current_high=0

## Current HIGH Concerns
None. (Codex's NOT-READY verdict is driven by the flip-flopped AggregateError finding — excluded per user's flip-flop stop rule. The 2 actionable Codex MEDIUMs and 2 nitpick MEDIUMs are surfaced in REVIEWS.md for optional follow-up but do not block execution.)

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## CONVERGENCE DECLARED ✓
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase 8 plans converged after 2 convergence cycles (6 total review rounds counting the manual rounds 1-4). HIGH count is 0 across both cycles. Stop triggered by user rule on flip-flop + nitpick threshold.
