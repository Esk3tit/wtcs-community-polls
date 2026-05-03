---
phase: 8
round: 5 (convergence cycle 1)
reviewers: [gemini, codex, cursor]
skipped: [claude, coderabbit]
skip_reason: "claude: running inside Claude Code. coderabbit: working tree clean."
previous_rounds: "git commits 0e598cc (r1), f662e87 (r2), 77af7f0 (r3), 93d56b4 (r4)"
reviewed_at: 2026-05-03T04:38:45Z
plans_reviewed: [08-01-PLAN.md, 08-02-PLAN.md, 08-03-PLAN.md, 08-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 8: E2E Test Hygiene (Convergence Cycle 1)

## Gemini Review

## Plan Review — Phase 8, Convergence Cycle 1

### 1. HIGH / MEDIUM Verdicts

| ID | Subject | Verdict | Rationale |
|:---|:---|:---|:---|
| **HIGH-5** | **cards-grep self-failure** | **ACCEPTED** | `08-03-PLAN.md` L304 + L310 now use `! grep -qE "^[[:space:]]*const cards\b|\bcards\."`. This correctly anchors the declaration check and targets method access, avoiding the "const cards" text inside the descriptive WHY comments. |
| **MEDIUM-7** | **REQUIREMENTS.md drift** | **ACCEPTED** | `.planning/REQUIREMENTS.md` L23 + L25 have been updated to drop the `^` anchor, bringing the requirements into alignment with the established convention. |
| **MEDIUM-8** | **VALIDATION.md stale query** | **ACCEPTED** | `.planning/phases/08-e2e-test-hygiene/08-VALIDATION.md` L45 now correctly uses the `description = 'freshPoll fixture row'` marker for leak detection, preventing false positives from static seed rows. |

---

### 2. NEW Concerns

#### 🟡 MEDIUM — Hardcoded paths in `<verify>` blocks
`08-02-PLAN.md` (L164, L197, L374) and `08-04-PLAN.md` (L259, L330) still use the hardcoded absolute path `cd /Users/khaiphan/code/wtcs-community-polls`. These will fail in CI or any environment other than the specific user's machine. They should be normalized to `cd "$(git rev-parse --show-toplevel)"` as seen in `08-01-PLAN.md`.

#### 🟡 MEDIUM — `08-03-PLAN.md` canary `printf` typo
The synthetic canary `printf` commands at `08-03-PLAN.md` L349 and L357 contain a typo: `'ntest` instead of `'\ntest`.
*   Current: `printf "import ... test'ntest('x', ..."`
*   Expected: `printf "import ... test\ntest('x', ..."`
The current version will generate files with syntax errors. While `npx eslint` will still likely exit with a non-zero status, it will be due to the syntax error rather than the `no-restricted-syntax` rule, potentially masking a failure of the lint rule itself.

---

### 3. Risk Assessment

**Overall risk: MEDIUM**

The core logic and spec migrations are sound, and the round-4 blockers have been addressed. However, the hardcoded paths remain an execution risk for portability, and the `printf` typo degrades the reliability of the automated verification gates.

**READY TO EXECUTE (Conditional):** Only after normalizing the `cd` paths to use `git rev-parse` and fixing the `printf` syntax in the canary tests.

---

## Codex Review

**Verdicts**

- **HIGH-5: ACCEPTED** — narrowed grep is present in [08-03-PLAN.md:304](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-03-PLAN.md:304) and [08-03-PLAN.md:310](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-03-PLAN.md:310). It avoids self-matching the comment text while still catching `const cards` declarations and `cards.` method access.
- **MEDIUM-7: ACCEPTED** — REQUIREMENTS now uses unanchored `/\[E2E\]/` in TEST-07 and TEST-08 at [REQUIREMENTS.md:23](/Users/khaiphan/code/wtcs-community-polls/.planning/REQUIREMENTS.md:23) and [REQUIREMENTS.md:25](/Users/khaiphan/code/wtcs-community-polls/.planning/REQUIREMENTS.md:25).
- **MEDIUM-8: ACCEPTED** — VALIDATION leak query now targets `description = 'freshPoll fixture row'` at [08-VALIDATION.md:45](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-VALIDATION.md:45), matching the fixture insert marker in [08-01-PLAN.md:261](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-01-PLAN.md:261).

**New Concerns**

- **MEDIUM** — Plan 01 has a self-failing acceptance criterion. The fixture code uses `if (error || !data)`, `if (choiceErr)`, and `if (deleteErr)` at [08-01-PLAN.md:270](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-01-PLAN.md:270), [08-01-PLAN.md:281](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-01-PLAN.md:281), and [08-01-PLAN.md:292](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-01-PLAN.md:292), but the grep criterion at [08-01-PLAN.md:316](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-01-PLAN.md:316) only matches one of those. Replace it with explicit greps for the three branches.
- **MEDIUM** — TEST-10 remains semantically wrong in REQUIREMENTS: “no 2FA on Discord account” at [REQUIREMENTS.md:29](/Users/khaiphan/code/wtcs-community-polls/.planning/REQUIREMENTS.md:29) conflicts with the runbook’s required `2FA ENABLED` prerequisite at [08-04-PLAN.md:113](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-04-PLAN.md:113) and its own correction note at [08-04-PLAN.md:116](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-04-PLAN.md:116). Update REQUIREMENTS to say 2FA-enabled/non-WTCS-member.
- **LOW** — Plan 04’s byte-identical preservation check uses `git show HEAD` at [08-04-PLAN.md:392](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-04-PLAN.md:392), which can compare the file to itself after commit. Use pre-plan ref / merge-base instead.

**Risk Assessment**

Overall risk: **MEDIUM**. Targeted fixes landed, but the Plan 01 acceptance grep and stale TEST-10 requirement should be corrected before execution.

---

## Cursor Review

## 1. Prior-fix verdicts

| ID | Verdict | Evidence |
|----|---------|----------|
| **HIGH-5** | **ACCEPTED** | `08-03-PLAN.md` L304 + L310 use `! grep -qE "^[[:space:]]*const cards\b|\bcards\."` — scopes to `const cards` declarations and `cards.` member access, avoiding free-text “cards” in comments. (Repo uses `grep -qE`, not `-nE`; behavior equivalent for pass/fail gates.) |
| **MEDIUM-7** | **ACCEPTED** | `.planning/REQUIREMENTS.md` L23–L25 use `/\[E2E\]/` in `Locator.filter({ hasText: … })` — aligned with ESLint message / README style. |
| **MEDIUM-8** | **ACCEPTED** | `08-VALIDATION.md` L45 uses `where description = 'freshPoll fixture row' …` — matches Plan 01 marker and avoids seed-title false positives. |

---

## 2. New concerns

| Severity | Issue |
|----------|--------|
| **MEDIUM** | **TEST-10 wording in canonical requirements** — `.planning/REQUIREMENTS.md` L29 still says second human **“(no 2FA on Discord account)”**, while Phase 8 runbook design (and `08-04-PLAN.md` verbatim runbook) requires **2FA enabled** so the gate clears; only the runbook footnote admits the mismatch. Same stale phrase appears in `.planning/PROJECT.md` L120 and `.planning/research/v1.1-SUMMARY.md` L19. Executors reading REQUIREMENTS first get the wrong tester profile. |
| **MEDIUM** | **`TEST-10-readonly` gate is incomplete in `08-VALIDATION.md` L48** — table says only `src/**` and `supabase/**`; `08-04-PLAN.md` success criteria require **no `e2e/**`** touches. A commit that only changed `e2e/` would still show `wc -l` → 0 for that command, so the documented gate under-checks vs the plan’s stated bar. |
| **LOW** | **`08-03-PLAN.md` L310** cites WHY-comment at **“L248”** while `e2e/tests/filter-search.spec.ts` is far shorter (~64 lines pre-migration) — stale line reference; confusing for reviewers, not execution-blocking. |
| **LOW** | **Plan 02 Task 1 verify** (`08-02-PLAN.md`) uses `require('typescript').transpileModule` on `eslint.config.js` — brittle if the verify environment ever lacks `typescript` on `NODE_PATH` (usually fine with npm devDeps). |

---

## 3. Risk assessment

**Overall: LOW** for executing Phase 8 implementation: HIGH-5 / MEDIUM-7 / MEDIUM-8 fixes are sound in-repo; ESLint `:has(filter)` / inline-filter strategy / `freshPoll` marker / cascade story are consistent.

**Remaining MEDIUM items are documentation/gate alignment** (TEST-10 tester wording; TEST-10-readonly including `e2e/**`), not structural flaws in the four plans.

**READY TO EXECUTE** — addressing the two MEDIUM doc/gate items before calling Phase 8 “audit-clean” on requirements/traceability is advisable but not a blocker to starting Waves 1–2 code work.

---

## Round-4 Fix Verdicts (consensus)

| Item | Subject | Gemini | Codex | Cursor | Consensus |
|------|---------|--------|-------|--------|-----------|
| HIGH-5 | Narrowed cards-grep | ACCEPTED | ACCEPTED | ACCEPTED | ✅ ACCEPTED |
| MEDIUM-7 | REQUIREMENTS.md anchor drop | ACCEPTED | ACCEPTED | ACCEPTED | ✅ ACCEPTED |
| MEDIUM-8 | VALIDATION.md leak query | ACCEPTED | ACCEPTED | ACCEPTED | ✅ ACCEPTED |

All 3 round-4 fixes universally ACCEPTED. No regressions.

## NEW Concerns (cycle 1)

### 🔴 HIGH-equivalent — Plan 01 acceptance grep self-failing (Codex MEDIUM, orchestrator-elevated)

**Location:** `08-01-PLAN.md:316`. Acceptance criterion: `grep -c "if (.* error" e2e/fixtures/poll-fixture.ts` returns **at least 3**.

**Bug:** The fixture has 3 error-handling branches:
- L270: `if (error || !data) throw error ?? ...` — matches the pattern ("error" is space-prefixed)
- L281: `if (choiceErr) throw choiceErr` — `choiceErr` is camelCase, NO space-prefixed "error"
- L292: `if (deleteErr)` — `deleteErr` is camelCase, NO space-prefixed "error"

Pattern `if (.* error` (BRE) matches only L270. Returns **1**, criterion expects **≥3** → self-failing.

**Severity rationale:** Same self-failing-acceptance pattern as round-4 HIGH-5 (cards-grep). Codex labeled MEDIUM but it's HIGH-equivalent because Plan 01 Task 2 cannot pass autonomously.

**Fix:** Replace single grep with three explicit branches:
```bash
grep -q 'if (error || !data)' e2e/fixtures/poll-fixture.ts && \
  grep -q 'if (choiceErr)' e2e/fixtures/poll-fixture.ts && \
  grep -q 'if (deleteErr)' e2e/fixtures/poll-fixture.ts
```

### 🟡 MEDIUM — TEST-10 wording drift in REQUIREMENTS / PROJECT (Cursor + Codex convergent)

**Locations:** `.planning/REQUIREMENTS.md:29` ("no 2FA on Discord account"), `.planning/PROJECT.md:120`, `.planning/research/v1.1-SUMMARY.md:19` — all carry the OLD blocker phrasing. Plan 04 runbook + L116 footnote correctly explain the inversion (2FA must be ENABLED so the gate clears and the not-in-server check fires).

**Risk:** Executor reading REQUIREMENTS first gets wrong tester profile.

**Fix:** Update REQUIREMENTS.md L29 + PROJECT.md L120 + v1.1-SUMMARY.md L19 to read "2FA-enabled, non-WTCS-member Discord tester" with a brief WHY note.

### 🟡 MEDIUM — Hardcoded `cd /Users/khaiphan/...` paths in 5 verify blocks (Gemini)

**Locations:** `08-02-PLAN.md` L164, L197, L374; `08-04-PLAN.md` L259, L330. CodeRabbit flagged this in round 1 but it was deferred. Real CI portability issue.

**Fix:** Replace with `cd "$(git rev-parse --show-toplevel)"` (already used in 08-01). 5 line edits.

### 🟡 MEDIUM — `TEST-10-readonly` gate incomplete in VALIDATION.md L48 (Cursor)

**Location:** `.planning/phases/08-e2e-test-hygiene/08-VALIDATION.md:48` — gate command says `-- 'src/**' 'supabase/**'` but Plan 04 success criteria require **no `e2e/**`** touches either. A commit that only changed e2e/ would still show wc -l → 0 for that command.

**Fix:** Add `'e2e/**'` to the path filter.

### 🟢 LOW — Plan 03 stale L248 line reference (Cursor)

**Location:** 08-03-PLAN.md:310 cites WHY-comment at "L248" but `e2e/tests/filter-search.spec.ts` is shorter than that. Cosmetic; not execution-blocking.

### 🟢 LOW — Plan 04 byte-identical `git show HEAD` (Codex — repeat)

Same finding as round 3 LOW-9. Compares file to itself post-commit. Use `git show HEAD~1:` or pre-commit `git diff -U0` instead.

### 🟢 LOW — Plan 02 transpileModule brittleness (Cursor)

Brittle if verify environment lacks typescript on NODE_PATH. Usually fine with npm devDeps.

## Repeat False Positive (Gemini)

**Gemini MEDIUM "printf typo `'ntest`"** — Gemini misread the literal `\ntest` (escaped newline + 'test') as `'ntest` (apostrophe + 'ntest'). The actual printf source is correct (`@playwright/test'\ntest('x', ...` — escaped 
 separates the import line from the test() call).

**Verified by orchestrator:** `grep -nE "printf|ntest" 08-03-PLAN.md` shows the correct `
` escape on L447 and L455. **Gemini's 3rd verified false positive across 5 review rounds.**

Per orchestrator counting rule: this false positive is EXCLUDED from the cycle's HIGH/MEDIUM count.

## Consensus Summary

### Risk Spread

- **Gemini: MEDIUM** (hardcoded paths real; printf typo false-positive)
- **Codex: MEDIUM** (Plan 01 grep self-failure + TEST-10 wording — both real)
- **Cursor: LOW + READY TO EXECUTE** (only 2 doc-alignment MEDIUMs, no plan structural flaws)

**Adjusted consensus: MEDIUM as written.** No reviewer raised HIGH. Plan 01 acceptance-grep self-failure (Codex MEDIUM) is HIGH-equivalent in execution impact (autonomous task can't pass). After that 1-line fix + 3 doc-alignment fixes, risk drops to LOW with no remaining concerns.

## CYCLE_SUMMARY: current_high=0

## Current HIGH Concerns
None. (Codex's MEDIUM "Plan 01 acceptance grep self-failing" is severity-equivalent to a HIGH but not labeled as such by any reviewer; the orchestrator surfaces it for one more revision pass per the user's "keep going until no concerns or just nitpicks" rule.)
