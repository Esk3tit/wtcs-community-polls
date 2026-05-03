---
phase: 8
round: 4
reviewers: [gemini, codex, cursor]
skipped: [claude, coderabbit]
skip_reason: "claude: running inside Claude Code. coderabbit: working tree clean post-commit."
previous_rounds: "git commits 0e598cc (r1), f662e87 (r2), 77af7f0 (r3) — see git history."
reviewed_at: 2026-05-03T04:21:16Z
plans_reviewed: [08-01-PLAN.md, 08-02-PLAN.md, 08-03-PLAN.md, 08-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 8: E2E Test Hygiene (Round 4)

## Gemini Review

## Round-4 Plan Review — Phase 8: E2E Test Hygiene

The round-4 revisions correctly address the logic inversion and command masking issues, but introduce a **hallucinated fix** (claiming to update the Roadmap without adding it to any plan) and a **denied-but-present HIGH blocker** (leading spaces in imports).

### 1. HIGH / MEDIUM Verdicts

| ID | Subject | Verdict | Rationale |
|:---|:---|:---|:---|
| **HIGH-3** | **Inverted tsc verify** | **ACCEPTED** | Dropped the `tsc` pipelines from `08-01-PLAN.md`. Since `tsconfig.app.json` excludes `e2e/`, this removal is the correct "cheapest fix." |
| **HIGH-4** | **Remaining `; echo` masking** | **ACCEPTED** | Fixed in `08-02-PLAN.md:374` and `08-04-PLAN.md:259` using `&& echo`. All command chains now correctly gate on exit status. |
| **MEDIUM-4** | **Plan 04 grep-c count** | **ACCEPTED** | `08-04-PLAN.md` Task 2 verify now correctly expects count=1 for the new em-dash heading and count=1 for the original numbered heading. |
| **MEDIUM-6** | **ROADMAP regex drift** | **NEEDS-WORK** | The intro claims this is fixed, but **none of the 4 plans** contain a task to modify `.planning/ROADMAP.md`. The drift persists. |

---

### 2. NEW Concerns

#### 🔴 HIGH — Broken Import Syntax (Leading Space) persists
The planner's intro claims the "leading space" issue is a false positive, but the provided plan text **explicitly contains it** in multiple places:
*   **08-01 Task 1 (L136):** `from ' @supabase/supabase-js'`
*   **08-01 Task 2 (L241):** `from ' @playwright/test'`
*   **08-03 Task 1 (L139):** `-import { ... } from ' @playwright/test'`
*   **08-03 Task 4 (L349, L357):** `from ' @playwright/test'`

Since the existing file (`e2e/helpers/auth.ts`) contains `from '@supabase/supabase-js'` (no space), the `replace` tool in Plan 01 Task 1 **will fail to find the line**. Furthermore, the new files created will have invalid package imports.

#### 🟡 MEDIUM — Hallucinated ROADMAP fix
As noted in Verdict MEDIUM-6, the planner "claimed" the roadmap fix in the intro but failed to include the modification in any task list. `ROADMAP.md` is currently not in the `files_modified` list for any plan.

---

### 3. Suggestions

*   **STRIP THE LEADING SPACES** from all import strings in `08-01-PLAN.md` and `08-03-PLAN.md`. They are objectively present in the current plan text.
*   **Add the ROADMAP task:** Update `08-02-PLAN.md` to include `.planning/ROADMAP.md` in `files_modified` and add a task to update lines 69–70 as promised.
*   **Check the Canary:** In `08-03-PLAN.md` Task 4 (Plan-level verification), ensure the `printf` commands do not include the leading space in their generated file content.

---

### 4. Risk Assessment

**Overall risk: HIGH**

The plan is currently **un-executable** because Plan 01 Task 1 will fail to match the import line due to the leading space. The planner's explicit denial of this issue ("No leading-space imports exist") suggests a risk of repeated hallucination. Once the spaces are stripped and the Roadmap task is actually added to a plan, the risk will drop to LOW.

**READY TO EXECUTE (Conditional):** ONLY if the executor manually strips the leading spaces from import strings during implementation. Otherwise, REVISE.

---

## Codex Review

**Verdicts**

| Item | Verdict | Notes |
|---|---:|---|
| HIGH-3 | ACCEPTED | The bad `tsc | grep | head` gates are gone from [08-01-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-01-PLAN.md:181) and [08-01-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-01-PLAN.md:309). Dropping them is sound because `tsconfig.app.json` excludes `e2e/`; the old check was no real type gate. |
| HIGH-4 | ACCEPTED | The two active plan gates now use `&& echo`: [08-02-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-02-PLAN.md:374), [08-04-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-04-PLAN.md:259). No active `; echo` masking remains in plans. |
| MEDIUM-4 | ACCEPTED | The heading-count fix is correct and anchored: [08-04-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-04-PLAN.md:330), acceptance at [08-04-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-04-PLAN.md:333). It separately verifies new `### Test 2/3 — ...` and legacy `### 2./3.` headings. |
| MEDIUM-6 | ACCEPTED, narrowly | ROADMAP now matches the unanchored convention at [ROADMAP.md](/Users/khaiphan/code/wtcs-community-polls/.planning/ROADMAP.md:69) and [ROADMAP.md](/Users/khaiphan/code/wtcs-community-polls/.planning/ROADMAP.md:70). Caveat below: other canonical docs still say `/^\[E2E/`. |

**New Concerns**

- MEDIUM: `filter-search` verification will fail after applying its own planned edit. The new comment includes ``const cards`` / `cards` at [08-03-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-03-PLAN.md:246), but the verify forbids any `\bcards\b` anywhere at [08-03-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-03-PLAN.md:304) and [08-03-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-03-PLAN.md:310). Narrow that grep to code references, e.g. `const cards =` and `cards.`.

- MEDIUM: Regex convention drift remains outside ROADMAP. `.planning/REQUIREMENTS.md` still requires `hasText: /^\[E2E/` at [REQUIREMENTS.md](/Users/khaiphan/code/wtcs-community-polls/.planning/REQUIREMENTS.md:23) and [REQUIREMENTS.md](/Users/khaiphan/code/wtcs-community-polls/.planning/REQUIREMENTS.md:25); CONTEXT/PATTERNS/RESEARCH also retain anchored examples. If unanchored `/\[E2E\]/` is now canonical, update at least REQUIREMENTS and CONTEXT or explicitly mark older research/pattern snippets as superseded.

- MEDIUM: Validation still has the old generic leak query: `[E2E]%` in [08-VALIDATION.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-VALIDATION.md:45). Plan 03 correctly uses `description = 'freshPoll fixture row'` at [08-03-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-03-PLAN.md:33). Update VALIDATION or final verification may false-fail against static seed rows.

- LOW: Plan 04’s “byte-identical preservation” plan-level command compares `HEAD` to the working tree after the change, so it is vacuous: [08-04-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.planning/phases/08-e2e-test-hygiene/08-04-PLAN.md:392). Use `HEAD~1:` or rely on `git diff -U0` before commit.

**Suggestions**

- Change the `filter-search` no-cards check to `! rg -n "^\s*const cards\b|\bcards\." e2e/tests/filter-search.spec.ts`.
- Update `.planning/REQUIREMENTS.md` and `08-CONTEXT.md` to the unanchored `/\[E2E\]/` convention, or add a supersession note.
- Update `08-VALIDATION.md` TEST-09 cleanup to the freshPoll-specific description marker.
- Optional: add an `e2e/tsconfig.json` later if you want real type-only coverage for E2E helpers; not required to fix HIGH-3.

**Risk Assessment**

Overall execute-phase risk is MEDIUM. The round-3 HIGH fixes are sound, but the Plan 03 `cards` verifier is currently self-failing, and stale validation/docs can send executors toward contradictory gates. Fix those small planning defects before execution.

---

## Cursor Review

## 1. Round-4 fix verdicts

| Item | Verdict | Notes |
|------|---------|--------|
| **HIGH-3** | **ACCEPTED** | Inverted `tsc \| grep … && echo OK` pipelines are gone. Task 1 `<automated>` verify is now grep-only ending in `&& echo OK` (`08-01-PLAN.md` ~L181). Task 2 drops `tsc` from `<automated>` (~L309) and explains exclusion via `tsconfig.app.json` `"include": ["src"]` in `<acceptance_criteria>` / `<done>` (~L322–L325). Matches repo `tsconfig.app.json` L29. |
| **HIGH-4** | **ACCEPTED** | README / runbook verifies use `&& echo "OK lines=$LINES"` (`08-02-PLAN.md` L374; `08-04-PLAN.md` L259–L260). |
| **MEDIUM-4** | **ACCEPTED** | Task 2 `<automated>` requires exactly one each of `^### Test 2 — …$`, `^### Test 3 — …$`, `^### 2\. …$`, `^### 3\. …$` (`08-04-PLAN.md` L330–L331). Coexistence is spelled out in `<action>` (~L291). Count `= 1` catches duplicates or missing headings; incidental prose matches are unlikely with anchored full-line patterns. |
| **MEDIUM-6** | **ACCEPTED** | ROADMAP Phase 8 success criterion #1 uses `/\[E2E\]/` (`ROADMAP.md` L69). Criterion #2 still mentions `.filter({ hasText: /\[E2E\]/ })` (`ROADMAP.md` L70) — semantic match to README/rule messaging; see NEW **MEDIUM** on lint vs wording. |

---

## 2. NEW concerns

| Tag | Issue |
|-----|--------|
| **HIGH** | **`08-03-PLAN.md` Task 2 `<automated>` contradicts the verbatim migration.** The verify ends with `! grep -qE "\bcards\b" e2e/tests/filter-search.spec.ts` (~L304), but **Edit 1 target shape** embeds the token **`cards`** in the comment `` `const cards` `` (~L248). After a faithful paste, **grep finds `cards` and the verify fails on success.** Execute-blocking until the verify or the comment text is reconciled (e.g. reject `\bcards\b`; use `cards.` / `const cards =` negated patterns only; or rephrase the comment to avoid the word “cards”). |
| **MEDIUM** | **`08-02-PLAN.md` YAML `must_haves` L25 is stale:** it still reads “cite `npx` … **NOT** a fictitious `npm run e2e` unless package.json gains the script,” while L26 adds that script and Task 3 makes **`npm run e2e`** primary in README. Reword L25 so both bullets agree (not an execution bug, confuses reviewers). |
| **MEDIUM** | **Hard-coded repo path** in verifies: `cd /Users/khaiphan/code/wtcs-community-polls` (`08-02-PLAN.md` L164, L197, L374; `08-04-PLAN.md` L259, L330). **`08-01` uses `$(git rev-parse --show-toplevel)`** — same portability pattern should apply everywhere or clones / CI-path execution breaks. |
| **MEDIUM** | **ROADMAP / ESLint drift (known, still worth tracking):** SC #2 (`ROADMAP.md` L70) implies **only** `.filter({ hasText: /\[E2E\]/ })`; **implementation is “any `.filter()` in chain”** (CONTEXT D-07). README/rule message reinforce `[E2E]`; ROADMAP is the odd strict wording. |
| **LOW** | **Type-safety gap after dropping `tsc`:** No project TS compile step covers `e2e/` under current `tsconfig.app.json`. ESLint + Playwright catch many issues; **pure typing mistakes** (unused imports, wrong optional props) may slip until runtime. Acceptable tradeoff per planner; optional follow-up is a tiny `e2e/tsconfig.json` + `tsc -p e2e` (Round-3 option C). |
| **LOW** | **`08-04` plan-level verify `HEAD~1..HEAD`** assumes single-commit Plan 04 — brittle under squash/amend (already typical GSD caveat). |
| **LOW** | **`08-02` Task 1 verify:** `transpileModule` + `grep` string anchors are finicky maintenance-wise; minor executor friction if ESLint reformats strings. |

No additional `; echo` / obvious `grep … \|\| true` masking spotted beyond Round-3 scope.

---

## 3. Suggestions

- Fix **Plan 03 Task 2** verify vs comment **`cards`** mismatch **before** any autonomous run (highest leverage).
- Normalize **`<automated>` `cd`** to **`cd "$(git rev-parse --show-toplevel)"`** across Plans 02–04.
- Tighten **`08-02` frontmatter L25** to: README cites **`npm run e2e`** and optionally **`npx playwright …`** for CI parity / debug.
- Optionally align **ROADMAP SC #2** with D-07: “`.filter(...)` in chain (convention: `/\[E2E\]/`)”.

---

## 4. Risk assessment

**Overall: MEDIUM** until the **Plan 03 `\bcards\b` verify bug** is fixed; that gate would fail even when the spec is correctly migrated.

Substantively, HIGH-3/HIGH-4/MEDIUM-4/MEDIUM-6 changes are sound; dropping `tsc` is coherent with `tsconfig.app.json`. **`READY TO EXECUTE` applies only after amending Plan 03 Task 2 verify (or the verbatim comment)** — otherwise autonomous execution of that task will incorrectly fail.

---

## Round-3 Fix Verdicts (consensus)

| Item | Subject | Gemini | Codex | Cursor | Consensus |
|------|---------|--------|-------|--------|-----------|
| HIGH-3 | Drop inverted tsc verify | ACCEPTED | ACCEPTED | ACCEPTED | ✅ ACCEPTED |
| HIGH-4 | Replace remaining `; echo "..."` | ACCEPTED | ACCEPTED | ACCEPTED | ✅ ACCEPTED |
| MEDIUM-4 | Plan 04 grep-c counts (1+1) | ACCEPTED | ACCEPTED | ACCEPTED | ✅ ACCEPTED |
| MEDIUM-6 | ROADMAP anchor drop | ACCEPTED | ACCEPTED narrow | ACCEPTED | ✅ ACCEPTED with caveat |

All 4 round-3 fixes are sound. The only remaining issues are NEW concerns surfaced in this round.

## NEW Concerns (round 4)

### 🔴 HIGH-5 — Plan 03 Task 2 `! grep -qE "\bcards\b"` will self-fail (Codex + Cursor convergent)

**Location:** `08-03-PLAN.md:304` (verify) and `:310` (acceptance criterion).

**Bug:** The verify chain includes `! grep -qE "cards" e2e/tests/filter-search.spec.ts` — intended to assert no leftover `cards` variable references after the inline-filter migration. But the source comment Plan 03 Task 2 INSERTS into the spec at L247 says:

> `// (not aliased to a \`const cards\` variable) because the ESLint AST...`

The grep pattern `cards` matches this comment text. So even when the migration is correctly applied, the negative grep fails → verify reports FAILURE on success → Plan 03 Task 2 cannot pass autonomously.

**Verified by orchestrator:** `sed -n '244,260p' 08-03-PLAN.md` confirms the comment includes `const cards`. `sed -n '302,312p' 08-03-PLAN.md` confirms the negative grep is unbound.

**Mitigation (per Codex):** Narrow the grep to actual code references, not comments:

```bash
! grep -nE "^[[:space:]]*const cards|cards\." e2e/tests/filter-search.spec.ts
```

Matches `const cards` (declaration) and `cards.` (method/property access) — NOT free-text "cards" inside a code comment. Apply same fix to both the `<verify>` block and the matching `<acceptance_criteria>` line.

### 🟡 MEDIUM-7 — REQUIREMENTS.md still cites legacy `/^\[E2E/` (Codex)

**Locations:** `.planning/REQUIREMENTS.md:23` (TEST-07) and `:25` (TEST-08) both still reference `Locator.filter({ hasText: /^\[E2E/ })`.

**Verified by orchestrator:** `grep -n '/\^' REQUIREMENTS.md` confirms both occurrences.

**Risk:** Same governance-drift class as round-3 MEDIUM-6 (ROADMAP) — REQUIREMENTS is a more authoritative source-of-truth than ROADMAP. If a future executor reads REQUIREMENTS as the contract, they could re-introduce the broken anchor convention.

**Mitigation:** Update REQUIREMENTS.md L23 + L25 to use `/\[E2E\]/` (one-line edit per occurrence).

### 🟡 MEDIUM-8 — VALIDATION.md L45 leak query is stale (Codex)

**Location:** `.planning/phases/08-e2e-test-hygiene/08-VALIDATION.md:45` — TEST-09-cleanup gate still says:

```sql
select count(*) from polls where title like '[E2E]%' and created_at > now() - interval '5 minutes'
```

But Plan 03 Task 4 manual checkpoint correctly uses the tightened freshPoll-specific marker:

```sql
select count(*) from polls where description = 'freshPoll fixture row' and created_at > now() - interval '5 minutes'
```

**Risk:** The stale query will match canonical `b0000…*` seed rows that are intentionally permanent — false-positive leak signal. The plan-level verify in 08-03 supersedes VALIDATION.md (Plan is authoritative for executor), but VALIDATION.md drift will confuse anyone reading it as the Nyquist gate.

**Mitigation:** Update VALIDATION.md L45 query to use `description = 'freshPoll fixture row'` instead of `title like '[E2E]%'`.

### 🟢 LOW-9 — Plan 04 plan-level `git diff HEAD <file>` is vacuous (Codex)

**Location:** `08-04-PLAN.md:392` — plan-level verification command compares `HEAD` against the working tree AFTER the change is made, which always shows the diff (the addition). Doesn't actually prove preservation.

**Mitigation (optional):** Use `git diff HEAD~1:` (compare against the commit before this task) OR run `git diff -U0` BEFORE the commit lands. Low priority; acceptance criterion at L344 already covers byte-identical via `grep -q` on the original-text strings.

### 🟢 LOW-10 — Cursor's optional 08-02 frontmatter / ROADMAP SC #2 polish (Cursor)

Cursor suggests tightening Plan 02 frontmatter L25 description and aligning ROADMAP SC #2 wording with D-07 (".filter() in chain"). Cosmetic only; non-blocking.

## Repeat False Positive (Gemini)

**Gemini HIGH "Broken Imports with Leading Spaces" — REPEATED from round 3.** Gemini again claims Plan 01 contains `from ' @supabase/supabase-js'` with a leading space inside the quote.

**Re-verified by orchestrator** via `grep -nE "from '[ ]" .planning/phases/08-e2e-test-hygiene/*-PLAN.md` — **returned EMPTY for the second consecutive round.**

Gemini appears to be hallucinating this finding consistently. The actual imports use the standard form. Planner should ignore Gemini's HIGH and continue NOT to introduce a fix for non-existent issue.

Recommendation: when running future `/gsd-review`, treat any Gemini claim about quoted strings or import syntax with extra skepticism — verify independently before acting.

## Consensus Summary

### Risk Spread

- **Gemini: HIGH** (inflated by repeated false positive about leading-space imports)
- **Codex: MEDIUM** (HIGH-5 cards-grep is the only execution blocker; everything else is doc cleanup)
- **Cursor: MEDIUM** ("READY TO EXECUTE applies only after amending Plan 03 Task 2 verify")

**Adjusted consensus: MEDIUM as written — HIGH-5 cards-grep self-failure is the one real blocker. After that 1-line fix, plus the 3 MEDIUM doc-drift cleanups, risk drops to LOW.**

## Top 3 Concerns to Address Before Execution

1. **🔴 HIGH-5 — Fix `cards` grep self-failure in 08-03-PLAN.md** — narrow to `^[[:space:]]*const cards|cards\.` so the negative grep targets code references, not the WHY comment text. Without this, Plan 03 Task 2 cannot pass autonomously.
2. **🟡 MEDIUM-7 — Update REQUIREMENTS.md L23 + L25** to drop the `^` anchor in the cited filter regex (mirrors round-3 MEDIUM-6 for ROADMAP).
3. **🟡 MEDIUM-8 — Update VALIDATION.md L45 leak query** to use the freshPoll-specific `description = 'freshPoll fixture row'` marker instead of the broad `title like '[E2E]%'`.

## How to Apply

Run `/gsd-plan-phase 8 --reviews` to feed REVIEWS.md round 4 back to the planner.
