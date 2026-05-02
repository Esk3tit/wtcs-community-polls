---
phase: 8
round: 2
reviewers: [gemini, codex, cursor]
skipped: [claude, coderabbit]
skip_reason: "claude: running inside Claude Code (CLAUDE_CODE_ENTRYPOINT=cli). coderabbit: working tree clean post-commit, nothing to review locally."
previous_round: "git commit 0e598cc (round 1 — see git history for prior REVIEWS.md)"
reviewed_at: 2026-05-02T21:13:15Z
plans_reviewed: [08-01-PLAN.md, 08-02-PLAN.md, 08-03-PLAN.md, 08-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 8: E2E Test Hygiene (Round 2)

Round 2 reviews the **revised** plans (post R-1 through R-5 fixes). Round 1 REVIEWS.md is preserved in git commit `0e598cc`.

## Gemini Review

## Round-2 Plan Review: Phase 8 — E2E Test Hygiene

The revised plans are semantically sound and provide a robust implementation strategy that directly addresses all Round-1 action items. The adoption of the inline-filter approach in `filter-search.spec.ts` (R-1) and the addition of a deterministic `description` leak marker (R-4) significantly harden the execution phase.

### R-1 through R-5 Verdicts

| ID | Issue | Verdict | Citation |
|:---|:---|:---|:---|
| **R-1** | AST blind spot (HIGH) | **ACCEPTED** | **Plan 03 (Task 2:200-240)**: Correctly inlines the `.filter()` chain for every list-locator call in `filter-search.spec.ts`, removing the variable-alias risk entirely. |
| **R-2** | Wave sequencing (MEDIUM) | **ACCEPTED** | **Plan 03 (Task 1:125-130)**: Enforces a per-spec atomic protocol (lint + test + commit per spec) ensuring intermediate commits are CI-safe. |
| **R-3** | grep -F usage (LOW) | **ACCEPTED** | **Plan 03 (Task 1:179, Task 2:244)**: All fixed-string verifications now use the `-F` flag for literal matching. |
| **R-4** | try/finally (MEDIUM) | **ACCEPTED** | **Plan 01 (Task 2:238-257)**: Setup wrapped in `try/finally`; **Plan 01 (Task 2:199)**: Adds deterministic `description: 'freshPoll fixture row'` leak marker. |
| **R-5** | package.json (MEDIUM) | **ACCEPTED** | **08-CONTEXT.md (L94-102)**: Correctly reclassifies `package.json` to "Files to modify" and acknowledges the script addition. |

### NEW Concerns

*   **Spaces in package import strings (LOW)**
    *   **Description**: In Plan 01 (L136, L241) and Plan 03 (L139), code snippets use strings like `' @playwright/test'` and `' @supabase/supabase-js'` (with a leading space inside the quote). The existing codebase uses `'@playwright/test'` (no space). 
    *   **Risk**: This may cause the `replace` tool to fail if used for surgical line replacement, or introduce trivial lint/formatting noise if applied as-is.
*   **Leak-check time window (LOW)**
    *   **Description**: Plan 03 (L327) uses `interval '5 minutes'` for the post-suite leak check.
    *   **Risk**: While the smoke suite is fast, slower CI runners or concurrent builds might occasionally exceed this window, leading to a false "count 0" (ignoring a leak that happened 6 minutes ago). A 10-minute window is safer.

### Suggestions

*   **Strip the leading spaces** from the package name strings (e.g., change `' @playwright/test'` to `'@playwright/test'`) in all code blocks during execution to match the established style in `package.json`.
*   **Relax the leak-check interval** in Plan 03 Task 4 from 5 minutes to 10 or 15 minutes to provide more head-room for CI runner latency.

### Risk Assessment

**Overall risk: LOW**

The planner has successfully mitigated the high-severity AST blind spot and established a clear, atomic migration sequence. The inclusion of synthetic canaries (synthetic violations) in the Plan 03 verification phase ensures the new lint rule is genuinely active and understood before the phase closes. The remaining concerns are minor formatting and interval adjustments.

**Ready to execute.**

---

## Codex Review

**R-1 Through R-5 Verdicts**
- **R-1: ACCEPTED** — Plan 03 now documents the AST alias blind spot and uses inline filters instead of `const cards` reuse (`08-03-PLAN.md:27-28`, `68`, `231-291`). This fixes the lint false-positive class.
- **R-2: NEEDS-WORK** — Per-spec atomic intent is present (`08-03-PLAN.md:34`, `195`, `297`, `339`), but the verify commands end with `; echo OK`, so failed lint/Playwright commands can still exit 0 (`08-03-PLAN.md:202`, `304`, `342`). The gate is not reliable yet.
- **R-3: ACCEPTED** — The changed filter-pattern checks use fixed-string `grep -F` where it matters (`08-03-PLAN.md:202`, `304`, `307-312`).
- **R-4: ACCEPTED** — The fixture now wraps choices insert + `use()` in `try/finally` and deletes in `finally` (`08-01-PLAN.md:22`, `54`, `268-283`). Leak marker is present (`08-01-PLAN.md:26`, `257`; `08-03-PLAN.md:392-397`).
- **R-5: ACCEPTED** — `package.json` is now in Plan 02 frontmatter and task scope (`08-02-PLAN.md:7-10`, `180-205`), and CONTEXT reclassifies it under Files to modify (`08-CONTEXT.md:89-96`, `170`).

**New Concerns**
- **HIGH — `[E2E]` inline filter may not match actual cards.** Plan 03 uses `filter({ hasText: /^\[E2E/ })` on `suggestion-card` (`08-03-PLAN.md:246-258`, `286-288`), but `SuggestionCard` renders category/time before title (`src/components/suggestions/SuggestionCard.tsx:47-74`). Playwright’s `hasText` regex is evaluated against the element text, so the card text likely starts with category text, not `[E2E]`. Use a title-scoped filter, e.g. `filter({ has: page.getByRole('heading', { name: /^\[E2E/ }) })`, or relax the documented convention.
- **HIGH — verify commands mask failures.** Multiple `<automated>` commands use `... && failing-command ; echo OK`, which returns success after `echo OK` even if the prior command failed (`08-01-PLAN.md:181`, `294`; `08-02-PLAN.md:164`, `374`; `08-03-PLAN.md:202`, `304`, `342`; `08-04-PLAN.md:259`, `330`). Replace with `set -euo pipefail; ...; echo OK`.
- **MEDIUM — E2E TypeScript is not actually checked.** Plan 01 relies on `npx tsc --noEmit -p tsconfig.app.json` for E2E fixture typing (`08-01-PLAN.md:181`, `294`, `306`, `337`, `347`), but `tsconfig.app.json` only includes `src` (`tsconfig.app.json:29`). Add `tsconfig.e2e.json` or use `tsc --noEmit --allowJs false ...` with `e2e/**/*.ts`.
- **MEDIUM — cleanup failure masks test-body failure.** If `await use(...)` throws and the delete also fails, the `deleteErr` throw in `finally` replaces the original test failure (`08-01-PLAN.md:278-283`). Capture both and throw an `AggregateError`, or preserve the primary error while reporting cleanup failure.
- **LOW — stale context/source comments remain.** CONTEXT still says `e2e/helpers/auth.ts` already mints a service-role client (`08-CONTEXT.md:118-119`), and the existing source comment says service-role is not used in that file (`e2e/helpers/auth.ts:14-15`) while Plan 01 forbids edits before line 103 (`08-01-PLAN.md:176-178`). Update those comments to distinguish `loginAs()` anon auth from the new lazy admin getter.

**Suggestions**
- Replace all `; echo OK` verify blocks with `set -euo pipefail` wrappers.
- Change `[E2E]` scoping to target the title/heading, not whole-card text.
- Add an E2E TypeScript config and make Plan 01/03 use it.
- Preserve both test and cleanup errors with `AggregateError`.
- Remove or correct stale CONTEXT claims around admin-create edits and service-role reuse.

**Risk Assessment**
**MEDIUM-HIGH** for execute-phase until the verify commands and `[E2E]` card-filter semantics are fixed. The architecture is solid, and the R-1/R-4 revisions are directionally right, but current verification can falsely pass and the main filter pattern may fail against the real card DOM. Once those two are corrected, risk drops to **LOW-MEDIUM** because the remaining work is test-only and tightly scoped.

---

## Cursor Review

## R-1 to R-5 Verdicts

- **R-1 (AST blind spot)** — **ACCEPTED**  
  `08-03-PLAN.md` now explicitly adopts inline-filter mitigation and removes alias-based flow (`L28`, `L68`, `L231`, `L246-L259`, `L271-L289`, `L309-L310`), which addresses the data-flow blind spot called out in round 1.

- **R-2 (wave sequencing / atomicity)** — **NEEDS-WORK**  
  The intent is fixed (`L34`, `L70`, `L195-L196`, `L297`), but execution is inconsistent in Task 3: it handles two specs in one task (`L322-L323`) with one chained verify command (`L342`), which violates the stated “ONE spec file per task” atomic rule (`L34`).

- **R-3 (`grep -F` consistency)** — **ACCEPTED**  
  Fixed-string grep usage is now consistently applied for filter-pattern checks where it matters (`L72`, `L208`, `L210`, `L304`, `L307`, `L311-L312`).

- **R-4 (fixture partial-setup leak via try/finally)** — **ACCEPTED**  
  Plan 01 now wraps setup/use in `try/finally` and keeps single-statement delete in `finally` (`08-01-PLAN.md L22`, `L54`, `L268-L284`). Leak-marker narrowing is also wired (`L26`, `L212`, `L257`; `08-03-PLAN.md L33`, `L392-L397`).

- **R-5 (`package.json` reclassification mismatch)** — **ACCEPTED**  
  Context and plan now align: `package.json` is explicitly in modify set and has a concrete task (`08-CONTEXT.md L89-L97`; `08-02-PLAN.md L7-L10`, `L181-L206`).

## New Concerns

- **MEDIUM — Cleanup error can mask real test failure in fixture finally**  
  In `08-01-PLAN.md`, `finally` throws on delete error (`L282-L284`). If test/assertion fails and cleanup also fails, JS will surface cleanup error and hide the primary test failure. This is not a leak regression, but it is a diagnosability regression.

- **MEDIUM — Internal inconsistency on “per-spec atomic” contract**  
  Plan 03 claims each task targets one spec (`L34`), but Task 3 targets two files (`L323`) and verifies both in one chain (`L342`). This weakens rollback/isolation guarantees the revision was trying to enforce.

- **LOW — Context still conflicts with plan on `admin-create.spec.ts` modification expectation**  
  `08-CONTEXT.md` still says `admin-create.spec.ts` should add `[E2E]` filter (`L90`), while revised Plan 03 says no source change needed (`08-03-PLAN.md L29`, `L77`). This can mislead executors/reviewers even if implementation choice is correct.

## Suggestions

- Split `08-03` Task 3 into **Task 3a** (`admin-create`) and **Task 3b** (`auth-errors`) with separate verify blocks and commits.
- In fixture cleanup, preserve original failure context when delete fails (e.g., capture primary error and throw aggregate/cause-style error in `finally`).
- Update `08-CONTEXT.md` canonical file list to remove/clarify the stale `admin-create` “must modify” instruction.
- Keep the leak query marker (`description = 'freshPoll fixture row'`) as-is; it is materially tighter than title-prefix matching.

## Risk Assessment

**Overall execute-phase risk: MEDIUM.**  
The round-1 fixes are mostly solid and materially improve correctness (AST mitigation, try/finally leak guard, package/script consistency). Remaining risk is execution hygiene and debug clarity: one atomicity inconsistency in Plan 03 and potential error masking in fixture teardown can slow incident triage or produce confusing failures, but neither is a fundamental design blocker.

---

## CodeRabbit Review

_Skipped: working tree was clean after committing R-1 through R-5 revisions. `coderabbit review` reviews uncommitted local changes only and exits early when none exist. The round-1 CodeRabbit pass (commit `0e598cc`) covered the planning artifacts at first commit; subsequent revisions are doc-level edits._

---

## Round-1 Fix Verdicts (consensus across reviewers)

| Item | Subject | Gemini | Codex | Cursor | Consensus |
|------|---------|--------|-------|--------|-----------|
| R-1 | AST blind spot (inline-filter approach) | ACCEPTED | ACCEPTED | ACCEPTED | ✅ ACCEPTED |
| R-2 | Per-spec atomic Tasks 1/2/3 | ACCEPTED | **NEEDS-WORK** | NEEDS-WORK | ⚠ Partial — see HIGH below |
| R-3 | grep -F on filter-pattern checks | ACCEPTED | ACCEPTED | ACCEPTED | ✅ ACCEPTED |
| R-4 | try/finally + leak marker in fixture | ACCEPTED | ACCEPTED | ACCEPTED | ✅ ACCEPTED |
| R-5 | package.json reclassification | ACCEPTED | ACCEPTED | ACCEPTED | ✅ ACCEPTED |

Three of five round-1 fixes are unambiguously sound. R-2 lands the *intent* (per-spec atomic tasks) but has an execution flaw exposed in this round.

## NEW Concerns (round 2)

### 🔴 HIGH — `[E2E]` inline filter does NOT match the actual card DOM (Codex; verified by orchestrator)

**Finding:** `Locator.filter({ hasText: /^\[E2E/ })` requires the element's text content to **start with** `[E2E`. But `src/components/suggestions/SuggestionCard.tsx:43-74` renders the `CategoryBadge` (e.g., "Aviation") and time-remaining text BEFORE the title `<h3>{suggestion.title}</h3>`. The card's text content order is:

1. PinnedBanner (if pinned)
2. `CategoryBadge` name ("Aviation", "Ground", etc.)
3. ResolutionBadge (if resolved)
4. Time-remaining ("5d remaining")
5. **Title `[E2E] ...`** ← only the title carries the prefix

So `page.locator('[data-testid="suggestion-card"]').filter({ hasText: /^\[E2E/ })` will FAIL because the regex anchor `^` won't match — the card text starts with the category name.

**Verified by orchestrator:** `grep -n "data-testid=\"suggestion-card\"" -A 30 src/components/suggestions/SuggestionCard.tsx` — confirmed render order at lines 47-74.

**Impact:** This is the **central convention** Phase 8 is introducing. 8 occurrences across the plans and the e2e/README docs all use `/^\[E2E/`. If the convention is wrong, TEST-07 cannot pass.

**Mitigation options (planner's call):**
- **(A) Drop the `^` anchor:** `filter({ hasText: /\[E2E\]/ })` — matches `[E2E]` anywhere in the card text. Risk: matches nested elements that happen to contain the literal `[E2E]`. Low risk in practice for this app.
- **(B) Title-scoped filter:** `filter({ has: page.getByRole('heading', { name: /^\[E2E/ }) })` — anchors against the heading text only. More precise, more verbose.
- **(C) Add a `data-testid="suggestion-title"` on the `<h3>` and filter via title locator:** cleanest semantically; small UI-tier change.

Recommended: **(A)** — drop the anchor. `[E2E]` in any other element's text would itself be a bug worth catching.

**This invalidates parts of RESEARCH §3 and PATTERNS.md as well** — both should be revised to remove the `^` anchor or document the chosen mitigation.

### 🔴 HIGH — `; echo OK` pattern in 7 `<automated>` blocks masks failures (Codex; verified by orchestrator)

**Finding:** Multiple `<automated>` verification blocks end with the pattern `... && cmd-N ; echo OK`. Bash semantics: `A && B ; C` is parsed as `(A && B) ; C`, and `;` terminates a command without affecting exit status. The pipeline's exit status is whatever `echo OK` returns — which is **always 0**.

**Impact:** A failing `npx eslint`, `npx playwright test`, or grep check exits non-zero, the chain breaks, but `echo OK` runs and the `<automated>` block reports success. The executor will mark the task done despite the verification having failed.

**Verified by orchestrator:** `grep -n "; echo OK" .planning/phases/08-e2e-test-hygiene/*-PLAN.md | wc -l` → 7 occurrences in 08-01 (×2), 08-02 (×1), 08-03 (×3), 08-04 (×1).

**Mitigation:** Replace every `; echo OK` ending with one of:
- **(A) Drop `echo OK` entirely** — let the chain's exit status propagate. Most direct fix.
- **(B) Wrap in subshell:** `(set -euo pipefail; A && B && C) && echo OK` — guarantees the chain fails fast AND `echo OK` only runs on success.
- **(C) Use `&&` instead of `;`:** `A && B && C && echo OK` — only echoes OK if everything passed.

Recommended: **(C)** for minimum-diff fix. Apply to all 7 occurrences.

### 🟡 MEDIUM — `AggregateError` for cleanup-during-test-failure (Codex)

When the test body throws AND cleanup also throws, only the cleanup error is rethrown by the current finally block — the original test failure is lost. Use `AggregateError` to preserve both:
```ts
try { await use(value) }
catch (testErr) { try { await admin.from('polls').delete().eq('id', data.id) } catch (cleanupErr) { throw new AggregateError([testErr, cleanupErr]) } throw testErr }
finally { /* runs only if try completed without throw */ }
```
Or simpler: keep try/finally and add a check that captures the test error first. Low-priority refinement; debug-clarity nice-to-have.

### 🟡 MEDIUM — Stale CONTEXT.md claims (Codex)

Codex notes some CONTEXT lines about admin-create.spec.ts edits and service-role reuse may now be stale post-revision. Worth a brief CONTEXT cleanup pass.

### 🟢 LOW — E2E TypeScript config (Codex suggestion)

An `e2e/tsconfig.json` separate from `tsconfig.app.json` would let Plan 01/03 run `npx tsc --noEmit -p e2e/tsconfig.json` without the `grep -v "e2e/"` workaround currently in 08-01-PLAN.md:181. Quality-of-life only.

## Consensus Summary

### Agreed Strengths

- All three reviewers ACCEPT R-1 inline-filter approach as the correct fix for the AST data-flow blind spot.
- All three reviewers ACCEPT R-3 `grep -F` and R-5 `package.json` reclassification.
- Gemini and Cursor judge overall risk as LOW/MEDIUM after fixes; Codex's harsher MEDIUM-HIGH is driven by the two NEW HIGH findings above.

### Agreed Concerns

- **R-2 (per-spec atomic) is intent-correct but execution-broken** because the verify chains use `; echo OK`. Both Codex and Cursor flagged this; Cursor noted it as "atomicity inconsistency in Plan 03" — the diagnosis converges on the same root cause.
- **Verify commands need to actually fail loudly.** This is the single most impactful fix to ship before execute-phase.

### Divergent Views

- **Risk level:** Gemini LOW, Cursor MEDIUM, Codex MEDIUM-HIGH. The divergence comes from how each reviewer weighted the `; echo OK` and card-text findings — Codex was the only one to surface them concretely.
- **Filter convention bug (the `^` anchor problem):** Only Codex flagged this. Gemini and Cursor read the convention as semantically valid without verifying against the live card DOM. The orchestrator independently verified Codex is correct.

## Top 3 Concerns to Address Before Execution

1. **🔴 HIGH — Drop the `^` anchor from the `/^\[E2E/` filter convention** (or switch to title-scoped `has: page.getByRole('heading', ...)`). Update RESEARCH §3, PATTERNS.md, e2e/README, and all 8 occurrences across plans. Without this, TEST-07 cannot pass.
2. **🔴 HIGH — Replace 7 `; echo OK` occurrences with `&& echo OK`** so verify failures actually surface. Without this, the per-spec atomic guarantee from R-2 is illusory.
3. **🟡 MEDIUM — Use `AggregateError` (or test-error-first capture) in the fixture cleanup** so test-body errors aren't masked by cleanup errors during teardown.

## How to Apply

Run `/gsd-plan-phase 8 --reviews` to feed REVIEWS.md round 2 back to the planner for a targeted revision pass.
