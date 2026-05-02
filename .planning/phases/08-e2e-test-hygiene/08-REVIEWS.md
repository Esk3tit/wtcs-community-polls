---
phase: 8
reviewers: [gemini, codex, cursor, coderabbit]
skipped: [claude]
skip_reason: "Running inside Claude Code (CLAUDE_CODE_ENTRYPOINT=cli) — skipped self for independence."
reviewed_at: 2026-05-02T20:51:59Z
plans_reviewed: [08-01-PLAN.md, 08-02-PLAN.md, 08-03-PLAN.md, 08-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 8: E2E Test Hygiene

## Gemini Review

# Phase 8: E2E Test Hygiene — Plan Review

## Summary
The proposed plans for Phase 8 are technically robust and demonstrate a deep understanding of the Playwright fixture system and ESLint's Abstract Syntax Tree (AST). The implementation of the `freshPoll` fixture with automated cascade cleanup (Plan 01) is a high-quality solution for test isolation. However, a significant technical discrepancy exists in the ESLint enforcement strategy: the proposed rule will fail on variable-based locators (like `cards.first()`) in `filter-search.spec.ts` (Plan 03), as AST-based linting cannot track the "filtered" status across variable assignments.

## Strengths
*   **Intelligent Fixture Design:** The `freshPoll` fixture (Plan 01) is correctly test-scoped to avoid cross-test contamination and utilizes a single-statement `DELETE` that relies on verified database-level `CASCADE` triggers, ensuring high performance and zero leaks.
*   **Accurate Selector Logic:** The ESLint rule (Plan 02) uses a sophisticated `:has(...)` walk instead of a brittle direct-child check, correctly handling complex fluent chains like `page.getByTestId('x').filter(...).first()`.
*   **Comprehensive Documentation:** `e2e/README.md` (Plan 02) and the second-human runbook (Plan 04) are detailed, follow established project-voice constraints, and provide actionable "run locally" instructions.
*   **Surgical Spec Patches:** The migration of `browse-respond.spec.ts` (Plan 03) is highly precise, correctly identifying where `eslint-disable` is required for DOM-scoped locators and tightening regex assertions to rule out false positives.

## Concerns
*   **Lint Rule Violation in `filter-search.spec.ts` (HIGH):** Plan 03 Task 2 assumes that filtering the `cards` variable definition makes downstream calls like `cards.first()` and `expect(cards).toHaveCount()` rule-compliant. In reality, the AST for `cards.first()` sees only an `Identifier` and a `MemberExpression`; it does not contain the `filter` CallExpression. This will cause the lint job to fail in CI.
*   **Inconsistent Escape-Hatch Strategy (MEDIUM):** While `browse-respond.spec.ts` is correctly patched with `eslint-disable` for legitimate DOM-scoped calls, `filter-search.spec.ts` is not, despite its variable-based calls being identical violations from the lint rule's perspective.
*   **CI Blocking Risk (MEDIUM):** Since the `lint-and-unit` job blocks the `e2e` job in `ci.yml`, the technical error in Plan 03's migration strategy will prevent the E2E suite from running in CI during verification.

## Suggestions
*   **Chain Locators in `filter-search.spec.ts`:** Update Plan 03 Task 2 to either chain the calls directly (e.g., `await expect(page.getByTestId('card').filter(...).first()).toBeVisible()`) or add the required `eslint-disable-next-line` comments for the variable-based usages.
*   **Add "Lint-First" Verification:** Explicitly add `npm run lint` as a local verification step at the end of Task 2 in Plan 03 to ensure the spec migrations actually clear the rule before the manual checkpoint.
*   **Consolidate `auth.ts` Exports:** Ensure the `getAdminClient` export in Plan 01 Task 1 is added at the bottom of the file as specified to avoid disrupting the pre-existing `loginAs` line numbers, which are referenced in other project documentation.

## Risk Assessment
**MEDIUM.** The underlying test logic and infrastructure (fixtures, client, cleanup) are sound and follow all project decisions (D-01 to D-13). The risk is primarily a workflow bottleneck: the strictness of the new ESLint rule is slightly misaligned with the proposed migration of `filter-search.spec.ts`, which will likely lead to a "Red CI" state on the first attempt. Adjusting the spec to use fluent chains or explicit disables will resolve this.

---

## Codex Review

**Summary**

The plans are well-structured and traceable, but they are not execution-safe as written. The overall approach is right: lazy service-role client, test-scoped `freshPoll`, lint-enforced locator convention, and TEST-10 runbook. The main blocker is the ESLint selector/data-flow mismatch: Plan 03 assumes a filtered locator variable makes later `.first()` / `.toHaveCount()` calls compliant, but the selector can only see `.filter()` in the same AST call expression. As written, `npm run lint` is likely to fail after Plan 03.

**Strengths**

- Strong traceability from ROADMAP requirements to plan tasks, artifacts, and verification gates.
- `freshPoll` is correctly test-scoped, minimal, and aligned with the hybrid seed model.
- FK cascade research is applied correctly for normal parent-row cleanup.
- Lazy `getAdminClient()` avoids service-role env failures for specs that only need `loginAs()`.
- Plan 04 preserves historical skipped UAT records instead of rewriting history.
- Scope boundaries are mostly respected; no schema churn, no full fixture migration, no product features.

**Concerns**

- **HIGH:** ESLint selector only validates same-expression chains. `const cards = page.getByTestId(...).filter(...); await expect(cards.first())...` still fails because the `.first()` call has no `.filter()` descendant. Plan 03’s `filter-search.spec.ts` migration will not clear lint as described.
- **HIGH:** `freshPoll` can leak if poll insert succeeds but choice insert fails, because cleanup only runs after `await use(...)`. The fixture needs `try/finally` around choice insert and `use`.
- **HIGH:** Fixture leak verification is invalid. `title like '[E2E]%' and created_at > now() - interval '5 minutes'` also matches static seed rows and `admin-create.spec.ts`’s newly-created poll.
- **MEDIUM:** `tsconfig.app.json` only includes `src`, so `npx tsc --noEmit -p tsconfig.app.json` does not type-check E2E helpers/fixtures/specs.
- **MEDIUM:** Several verify commands end with `; echo OK`, masking failures. These should use `set -euo pipefail` or direct failing assertions.
- **MEDIUM:** Adding service-role support to `e2e/helpers/auth.ts` makes the existing file comment “Service-role key is NOT used here” false. The plan forbids editing the earlier comment, which creates stale security documentation.
- **MEDIUM:** Plan 04 satisfies D-11’s async artifact decision, but not the literal ROADMAP success criterion requiring actual second-human evidence with executor, timestamp, and pass/fail.
- **LOW:** Plan 03’s manual command starts `npm run dev`, but Playwright’s base URL is `4173` and local `webServer` already runs `build && preview`. This is confusing and unnecessary.
- **LOW:** Exporting `getAdminClient()` from a helper importable by specs is acceptable for test-only code, but a cheap `no-restricted-imports` guard would reduce misuse.

**Suggestions**

- Fix Plan 03’s lint migration by keeping `.filter()` in each flagged call expression. Example:
  ```ts
  const cards = page.getByTestId('suggestion-card')

  await expect(cards.filter({ hasText: /^\[E2E/ }).first()).toBeVisible()
  const initialCount = await cards.filter({ hasText: /^\[E2E/ }).count()
  await expect(cards.filter({ hasText: /^\[E2E/ })).toHaveCount(1, { timeout: 5_000 })
  ```
- Add a negative canary proving filtered aliases still fail, so future authors understand the rule’s limitation.
- Wrap fixture setup/teardown:
  ```ts
  const { data, error } = await admin.from('polls').insert(...).select('id, title').single()
  if (error || !data) throw error ?? new Error('freshPoll insert returned no row')

  try {
    const { error: choiceErr } = await admin.from('choices').insert(...)
    if (choiceErr) throw choiceErr
    await use({ id: data.id, title: data.title })
  } finally {
    const { error: deleteErr } = await admin.from('polls').delete().eq('id', data.id)
    if (deleteErr) throw deleteErr
  }
  ```
- Change leak check to target fixture rows only, e.g. `where description = 'freshPoll fixture row'`, not all `[E2E]%` rows.
- Add `tsconfig.e2e.json` covering `e2e/**/*.ts` and use it in verification.
- Update the top comment in `e2e/helpers/auth.ts` to distinguish `loginAs()` anon auth from the new e2e-only admin getter.
- Treat TEST-10 as “artifact complete, evidence pending” unless the real second-human session is run before closure; update roadmap/status wording accordingly.
- Replace local verification step with `npm run e2e -- --grep @smoke`; let Playwright’s configured webServer handle build/preview.

**Risk Assessment**

**HIGH as written.** The architecture is sound, but the lint-rule/data-flow assumption is a blocker and the cleanup verification is currently misleading. With the selector usage fixed, fixture teardown made `try/finally`, and verification gates tightened, the risk drops to **MEDIUM/LOW** because the remaining work is test-only and well-scoped.

---

## Cursor Review

## Summary

The Phase 8 plan set is strong and mostly execution-ready: it maps cleanly to TEST-07/08/09/10, uses the research-grounded fixture + lint strategy, and keeps deferred scope mostly contained. The biggest risks are process-level rather than technical: a contradiction around `package.json` script changes vs canonical refs, intentional lint breakage in Plan 02 that may conflict with commit/CI gating expectations, and a governance mismatch between ROADMAP success criterion #4 (evidence appended) and D-11’s async carve-out. Technically, the FK cascade and single-delete teardown are correctly applied, and the AST selector is directionally sound but still bypassable/noisy in edge AST shapes.

## Strengths

- Clear decomposition across 4 plans with sensible ownership boundaries (`infra`, `rule/docs`, `spec migration`, `human evidence docs`).
- RESEARCH-driven corrections are incorporated (notably service-role client is new, not re-export).
- D-01 through D-13 are mostly honored, especially:
  - `browse-respond` as the sole `freshPoll` proof consumer (D-01)
  - single-statement teardown via cascade (D-04)
  - lint scope limited to `e2e/tests/**/*.spec.ts` (D-08)
  - async runbook/evidence handling pattern for TEST-10 artifacts (D-11/D-13)
- Good threat modeling coverage for service-role use, fixture leaks, and lint escape-hatch abuse.
- Verification discipline is unusually strong (synthetic lint canary, leak check, CI URL checkpoint).
- Deferred items are explicitly kept out (full fixture rewrite, DB CHECK constraints, prod cleanup).

## Concerns

- **[HIGH] ROADMAP vs D-11 mismatch:** ROADMAP success criterion #4 requires appended second-human evidence with timestamp/executor/result; Plan 04 treats placeholders/runbook as sufficient for Phase 8 closure. This is a formal acceptance-criteria conflict.
- **[MEDIUM] Canonical refs conflict:** context says `package.json` needs no script changes, but Plan 02 adds `scripts.e2e`. Not harmful technically, but it contradicts locked references and may trigger review churn.
- **[MEDIUM] Wave ordering/gating risk:** Plan 02 intentionally introduces lint failures before Plan 03. If your workflow expects every intermediate commit/PR checkpoint green, this causes avoidable friction.
- **[MEDIUM] AST selector can be gamed/noisy:** `:has(CallExpression[callee.property.name='filter'])` accepts any descendant `filter` call, not necessarily locator-chain filter and not necessarily “preceding” in semantic chain.
- **[LOW] Service-role exposure surface:** exporting `getAdminClient()` from a broadly imported helper increases accidental misuse risk in specs; currently mitigated by convention, not enforcement.
- **[LOW] Fixture leak check heuristic:** the “last 5 minutes” query can be noisy because seeded `[E2E]` rows may overlap that window right after seed application.

## Suggestions

- Align acceptance policy explicitly:
  - either update ROADMAP success criterion #4 to accept “artifact now, evidence async,”
  - or make Phase 8 closure conditional on real second-human evidence.
- Decide on `package.json` script policy upfront; if “no new scripts” is locked, remove Plan 02 Task 2 and keep README commands explicit with `npx playwright test ...`.
- Reduce process friction by landing Plan 02 + Plan 03 in one atomic PR/merge unit, or sequence rule activation last in Plan 02.
- Tighten lint enforcement incrementally:
  - keep current selector,
  - add a follow-up guardrail (`no-restricted-imports`) blocking `getAdminClient` imports from `e2e/tests/**`.
- Harden leak verification:
  - tag fresh rows with a deterministic suffix/prefix token and query by that token instead of time window.
- Add one explicit failure-mode test for fixture teardown (simulate delete failure path) or at least document manual cleanup command in README/runbook.
- For AST robustness, consider future refinement with a custom ESLint rule if false positives/negatives appear; current selector is acceptable for v1.1 hygiene scope.

## Risk Assessment

**Overall risk: MEDIUM**

Core implementation risk is low-to-medium (technical approach is solid, cascade logic is correct, and verification is thorough), but delivery/acceptance risk is medium due to criteria contradictions and process-ordering pitfalls. If you resolve the ROADMAP-vs-D-11 acceptance mismatch and the Plan 02 ordering/script-policy inconsistencies, risk drops to **LOW**.

---

## CodeRabbit Review

_Note: CodeRabbit reviews the current git working tree (the planning artifacts as committed), not the synthesized prompt. 33 findings reported._

```text
╔═══════════════════════════════════════════╗
║                                           ║
║   New update available! 0.4.1 -> 0.4.4    ║
║          Run: coderabbit update           ║
║                                           ║
╚═══════════════════════════════════════════╝

Starting CodeRabbit review in plain text mode...

Review directory: /Users/khaiphan/code/wtcs-community-polls

Connecting to review service
Setting up
Summarizing
Reviewing

============================================================================
File: src/__tests__/integrity/rate-limit-toast.test.tsx
Line: 30
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @src/__tests__/integrity/rate-limit-toast.test.tsx at line 30, Extract the duplicate string into a shared constant in the test suite: add a const rateLimitMessage = 'Too many responses too quickly. Please wait a moment and try again.' at the top of the describe block (e.g., immediately after the beforeEach) and then replace the hard-coded literals in both test cases that reference the rate limit toast with this constant (look for the two occurrences in rate-limit-toast.test.tsx). Ensure both tests import/use the same constant name so the message is defined once and reused.

============================================================================
File: .planning/REQUIREMENTS.md
Line: 19
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/REQUIREMENTS.md at line 19, Remove the verbose Round-4 amendment note and the __name(...) vs Rolldown Oxc minifier explanation from the OBSV-02 entry in .planning/REQUIREMENTS.md and instead add or expand that text in the artifact file .planning/closure/OBSV-02-bundle-delta.md; keep the requirement line concise (mention verifying names[] in the built .map and confirming preserved function names in chunks) and ensure any references to "Rolldown/Oxc", "__name(...)", and the names[] verification remain in the artifact file for engineers to inspect.

============================================================================
File: .planning/research/v1.1-PLAYWRIGHT-FIXTURES.md
Line: 26
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/research/v1.1-PLAYWRIGHT-FIXTURES.md at line 26, The comment claiming the rule "catches cards.toHaveCount(N) and cards.first() when not preceded by .filter(...)" is wrong because the current selector implementation (the selector used to detect these patterns) is structurally incorrect; update the selector so it matches CallExpressions whose callee is a MemberExpression with property name "toHaveCount" or "first" on an identifier like "cards" and ensure the chain does NOT include a preceding MemberExpression with property "filter" (i.e., explicitly check the owner/member chain for absence of ".filter" before matching "toHaveCount" or "first"), so the rule reliably detects only unfiltered cards.toHaveCount(...) and cards.first() calls.

============================================================================
File: .planning/STATE.md
Line: 24
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/STATE.md at line 24, Update the state tracking in .planning/STATE.md to remove ambiguity: set "Current focus" to "Phase 08 — observability-hardening" (or the correct phase if planning is complete) to match the "Phase 08 planning complete" note, and split the Phase 07 status into explicit subfields (e.g., "Phase 07 Planning: COMPLETE (verifier PASSED, 0 gaps)" and "Phase 07 Execution: READY TO START" or "Execution: COMPLETE") so "Status: Ready to execute" and "COMPLETE" are not mixed; update the lines that currently read "Current focus: Phase 07", "Phase 07: COMPLETE (verifier PASSED, 0 gaps)" and "Status: Ready to execute" to the new, explicit terminology.

============================================================================
File: .planning/REQUIREMENTS.md
Line: 17
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/REQUIREMENTS.md at line 17, Replace the full Sentry event URL in .planning/REQUIREMENTS.md with an anonymized form to avoid exposing the org slug and event identifiers; locate the literal URL "https://khai-phan.sentry.io/issues/7451487881/events/5100cc65e9b94bc5b5906ab11ab79d3b/" and replace it with a placeholder such as "https://[your-org].sentry.io/issues/[ID]/events/[ID]/" or just the event ID (e.g., "event: 5100cc65e9b94bc5b5906ab11ab79d3b") and optionally add a note about limiting Sentry project permissions.

============================================================================
File: .planning/phases/07-observability-hardening/artifacts/sourcemap-names-excerpt.txt
Line: 26 to 27
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/07-observability-hardening/artifacts/sourcemap-names-excerpt.txt around lines 26 - 27, Update the phrasing that currently reads "top 50 sorted" to clearly indicate alphabetical sampling and sample size — for example change the adjacent descriptor to "50 of 59 (alphabetically sorted)" or "first 50 (alphabetically sorted)"; also append a short rationale like "(showing 50 for readability)" next to that phrase so readers know why only 50 of the 59 PascalCase identifiers in the names[] list are shown; locate the string "top 50 sorted" and the line containing "total unique 5+-char PascalCase identifiers in names[]: 59" to make this edit.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-VALIDATION.md
Line: 64 to 68
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-VALIDATION.md around lines 64 - 68, The "Test Instructions" cell in the "Manual-Only Verifications" table is overly long; shorten the table cell to a concise summary (e.g., "Run 08-UAT-10-SCRIPT.md and paste evidence into Phase 03 UAT under 'Second-Human Verification'") and move the full step-by-step details currently in that cell into a new subsection below the table (or a separate "Detailed Test Instructions" section) that includes the full commands and the target location (08-UAT-10-SCRIPT.md and the destination .planning/phases/03-response-integrity/03-UAT.md under the "## Second-Human Verification" header) so the table remains readable while preserving the full instructions elsewhere.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-VALIDATION.md
Line: 81
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-VALIDATION.md at line 81, Replace the plain approval line "Approval: pending" with the checklist/checkbox style used elsewhere in the document so it matches other items; locate the literal "Approval: pending" text and change it to the unchecked checkbox variant used in the checklist (so it renders as a consistent "Approval" checkbox with the "pending" state).

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-VALIDATION.md
Line: 58
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-VALIDATION.md at line 58, The checklist item mentions "corrects CONTEXT L119" which is unclear; update the text for e2e/helpers/auth.ts and the getAdminClient() mention to either expand "CONTEXT L119" inline (one-sentence summary of what that context contains) or add a short link/reference to the document/section where CONTEXT L119 is defined so readers understand the relation to the lazy getAdminClient() service-role getter; ensure you mention the symbol getAdminClient() and the context reference explicitly in the updated checklist entry.

============================================================================
File: .planning/phases/07-observability-hardening/07-REVIEW-FIX.md
Line: 1 to 72
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/07-observability-hardening/07-REVIEW-FIX.md around lines 1 - 72, Add a single trailing newline at the end of the file so the final line (the footer block containing "_Fixed: 2026-04-30_", "_Fixer: Claude (gsd-code-fixer)_", or the closing YAML frontmatter line status: all_fixed) ends with a newline character; simply edit the file to append a newline to the end and save so POSIX-style tools and linters recognize the terminating newline.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-VALIDATION.md
Line: 48
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-VALIDATION.md at line 48, The git diff verification line contains an unnecessary escaped pipe sequence \| in the command string git diff --name-only $(git merge-base HEAD main)..HEAD -- 'src/' 'supabase/' \| wc -l; remove the backslash so the shell pipe is a normal | (i.e., use ... 'supabase/' | wc -l) so the command executes correctly when copied or run in a shell and still returns the expected count.

============================================================================
File: .planning/phases/07-observability-hardening/07-REVIEW.md
Line: 31
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/07-observability-hardening/07-REVIEW.md at line 31, The file contains a path typo " @sentry/react@build " on the affected line; update that occurrence to use the correct separator " @sentry/react/build " so it matches other usages (e.g., the paths on lines referencing "@sentry/core/build/..." and "@sentry/browser/build/..."). Locate the exact string "@sentry/react@build" in the document (see the diff snippet) and replace it with "@sentry/react/build" preserving surrounding text and spacing.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-VALIDATION.md
Line: 41
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-VALIDATION.md at line 41, The table row for TEST-07 is inconsistent about e2e/fixtures/seed.sql; update the "File Exists" column for TEST-07 (the row containing TEST-07 and the command npx playwright test --config e2e/playwright.config.ts --grep @smoke) to match the reality signaled by TEST-09-cleanup: if e2e/fixtures/seed.sql is a new fixture (Wave 0) then replace "✅ files exist; assertions need patching" with "new (Wave 0); add seed.sql and update assertions", otherwise mark TEST-09-cleanup as not new and set TEST-07 to "✅ files exist; assertions need patching" so both rows consistently reference e2e/fixtures/seed.sql.

============================================================================
File: .planning/ROADMAP.md
Line: 39
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/ROADMAP.md at line 39, Update the progress table row that currently shows "0/TBD" for milestone v1.1 to reflect the completed Phase 7 plans: change the count to "3/TBD" (or update the total to "11+" if you prefer the proposed aggregated view), and ensure the entry references the completed item "Phase 7: Observability Hardening — Wire Sentry React 19 error hooks into createRoot and preserve function names in production sourcemaps" so the table and the checklist are consistent; locate the table block and the Phase 7 checklist (mentioning Phase 7 and Phase 8) and adjust the numeric progress cell accordingly.

============================================================================
File: .planning/phases/07-observability-hardening/07-03-PLAN.md
Line: 68
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/07-observability-hardening/07-03-PLAN.md at line 68, The table row describing MEDIUM-4 (the line containing the jq command jq -r '.names[]' dist/assets/*.js.map | grep -E '^(RenderThrowSmoke|RootLayout|AppErrorFallback)$' and the mention of sourcemap-names-excerpt.txt) appears marked as modified (~) but may not actually have changed; verify by comparing this file's current content against the previous commit, and if the line is unchanged remove the ~ change indicator (or correctly mark it as unchanged) in the Round-2 fixes table, otherwise update the PR summary to mention the actual edit to this MEDIUM-4 row so the AI summary and the ~ annotation are consistent.

============================================================================
File: .planning/phases/07-observability-hardening/07-03-PLAN.md
Line: 89 to 100
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/07-observability-hardening/07-03-PLAN.md around lines 89 - 100, The plan's Round-4 amendment text claiming all __name( references were superseded by a Rolldown-correct check is inconsistent with the body: update each remaining __name( reference (e.g., the grep -o '__name(' in Task 1 step G, creation/consumption of __name-grep.txt, test -s artifacts/__name-grep.txt, the grep -l '__name(' checks in Task 2, the "helper presence" block, and the grep -c '__name(' acceptance) to either (A) replace the command with the Rolldown-correct pattern grep -lE 'function (RootLayout|AppErrorFallback|RenderThrowSmoke|SmokePage)\b' and adjust artifact names accordingly, or (B) mark the old __name( lines with a clear strikethrough/inline note stating they are historical and will not be used, and add the new Rolldown-correct command where the plan claims it should appear so Task steps and acceptance criteria point to the correct check.

============================================================================
File: .planning/closure/OBSV-02-bundle-delta.md
Line: 124 to 125
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/closure/OBSV-02-bundle-delta.md around lines 124 - 125, The sed-based surgical revert that replaces "output: { keepNames: true }," in vite.config.ts is fragile to whitespace/formatting changes; switch to a more robust approach by targeting the whole rolldownOptions block or using a git patch: update the script that currently runs sed -i.bak and instead identify the rolldownOptions block (the token "rolldownOptions") and comment or remove that entire block (so the "output: { keepNames: true }" line is no longer relied upon), or generate/apply a small git patch to modify vite.config.ts atomically; ensure the change is applied idempotently and drop the .bak cleanup accordingly.

============================================================================
File: .planning/phases/07-observability-hardening/07-03-SUMMARY.md
Line: 93 to 94
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/07-observability-hardening/07-03-SUMMARY.md around lines 93 - 94, Update the SUMMARY text to add a short parenthetical after the sentence about canonicalization explaining that this is TanStack Router's own search-parser/serialization behavior (its default search parser JSON-parses typed values from the URL and then serializes/canonicalizes them back into the URL using JSON quoting), that this canonicalization is inherent to TanStack Router (not caused by our String(search.render) coercion in src/routes/[__smoke].tsx or the validateSearch function), and that the browser address bar will show the URL-encoded form (?render=%221%22) because the quote character is percent-encoded.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-04-PLAN.md
Line: 259
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-04-PLAN.md at line 259, The automated verification line hardcodes the repo root with "cd /Users/khaiphan/code/wtcs-community-polls", which breaks portability; replace that hardcoded cd by resolving the repository root dynamically (e.g., use git rev-parse --show-toplevel to set the working directory) or remove the cd and run the rest of the checks relative to the current directory, keeping the rest of the command that references ".planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md" unchanged.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-CONTEXT.md
Line: 105
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-CONTEXT.md at line 105, Reword the sentence to clearly state the actual relationship between fixtureUsers and testInfo.title: if test names embed user handles, state explicitly that freshPoll title-tags derive their handle strings by interpolating values from the fixtureUsers map into testInfo.title; otherwise state that fixtureUsers is only used for authentication/identity and testInfo.title is independently used for poll naming (i.e., no implicit dependency). Update the text referencing fixtureUsers, freshPoll, and testInfo.title to reflect the correct case.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-CONTEXT.md
Line: 42
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-CONTEXT.md at line 42, The document should explicitly record the ESLint AST selector limitation: update the "Common gotchas" section in e2e/README.md (referenced as D-10) to note that the rule D-07 only detects the presence of a preceding .filter() call and does not validate the filter's regex/content (it will not enforce the literal /^\[E2E/), so developers and reviewers must manually verify the filter implementation; add a concise bullet referencing D-07 and .filter() behavior and suggest manual PR review as mitigation.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-04-PLAN.md
Line: 330
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-04-PLAN.md at line 330, The automated shell check contains a hardcoded absolute path "/Users/khaiphan/code/wtcs-community-polls" which breaks portability; update the grep command in the automated block (the long line starting with cd /Users/khaiphan/code/wtcs-community-polls && grep -q ...) to use a portable repo-root or working-dir expression (for example replace the literal path with $(git rev-parse --show-toplevel) or use $PWD or a relative '.'), ensuring the rest of the chained grep checks remain unchanged.

============================================================================
File: .planning/phases/07-observability-hardening/artifacts/sentry-event.json
Line: 17 to 26
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/07-observability-hardening/artifacts/sentry-event.json around lines 17 - 26, Add explicit testing requirements to the proposed_fix metadata: update the JSON object under "_known_bug" to include a "required_tests" field that enumerates precise test changes for the validateSearch change (referencing validateSearch in src/routes/[__smoke].tsx) — for example, add tests that assert ?render=1 (numeric) and ?render=%221%22 (URL-encoded JSON string) both trigger the throw/expected behavior, update any smoke-route integration/unit tests to accept numeric 1, and mention updating ROADMAP.md and 07-CONTEXT.md examples; keep the description concise and actionable so QA/devs know what to validate after implementing the loose-string conversion (String(search.render) === '1' or numeric acceptance).

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-CONTEXT.md
Line: 35 to 37
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-CONTEXT.md around lines 35 - 37, Clarify D-02 to pick a single canonical implementation for the service-role client: state that the service-role admin client must be re-exported from e2e/helpers/auth.ts (do not leave an "or" option) so all fixtures import the same client via auth.ts/loginAs(); update the wording to remove the getter alternative. For D-04, replace the vague "choices table" with the precise schema/table name (e.g. poll_choices) and ensure the teardown example shows the exact deletion call context (adminClient.from('polls').delete().eq('id', data.id')) and a note to rethrow on failure; also add a sentence instructing the planner to implement a multi-step teardown if cascade deletes for votes or poll_choices are absent.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-01-PLAN.md
Line: 311
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-01-PLAN.md at line 311, The grep verification line that checks for phase/comments (grep -E "Phase 8|D-0[1-9]|TEST-0[7-9]|TEST-10|issue #|PR #|Round " e2e/helpers/auth.ts e2e/fixtures/poll-fixture.ts) is correct for portability but should be documented to run from the repository root for consistency with automated checks; update the Plan text near that grep (reference the exact grep command and the target files e2e/helpers/auth.ts and e2e/fixtures/poll-fixture.ts) to add a short note like “Run this command from the repository root” so manual verification matches automation.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-02-PLAN.md
Line: 232
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-02-PLAN.md at line 232, Replace the hardcoded "Playwright 1.59.1" string in the README text with a version-agnostic phrase (e.g., "Playwright") or add a short sync note directing maintainers to update this doc when the dependency in package.json changes; locate the literal "Playwright 1.59.1" in the plan file and either remove the numeric version or append the suggested NOTE referencing package.json's playwright dependency so the README and package.json stay in sync.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-02-PLAN.md
Line: 164
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-02-PLAN.md at line 164, In the  verification shell command that currently uses a hard-coded absolute cd invocation, replace the absolute repository path with a portable form like $(pwd) or a relative path so contributors can run the checks locally; update every occurrence of that absolute path within the same  command and any other similar grep/npm checks elsewhere in the file to use $(pwd) or relative paths as well.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-01-PLAN.md
Line: 170 to 172
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-01-PLAN.md around lines 170 - 172, The verification command contains a hardcoded absolute path in the automated block (the cd /Users/khaiphan/code/wtcs-community-polls part) which will break on other machines/CI; change it to either remove the cd entirely (assume scripts run from the repo root) or replace it with a portable alternative such as a relative path or a dynamic repo-root lookup (e.g., cd "$(git rev-parse --show-toplevel)") so the rest of the grep/npx tsc checks in the  automated command run reliably across environments.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-01-PLAN.md
Line: 267 to 268
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-01-PLAN.md around lines 267 - 268, The automated verify command contains a hardcoded absolute path in the initial cd which breaks portability; update the command in the automated block so it does not use that absolute path (remove the cd or replace it with a repo-root-aware invocation) and ensure the remaining checks (the greps against "e2e/fixtures/poll-fixture.ts" and the final "npx tsc --noEmit -p tsconfig.app.json" check) still run from the repository root or current working directory. Locate the long command in the automated verification section (the line that chains the cd, multiple grep checks for e2e/fixtures/poll-fixture.ts, and the npx tsc invocation) and replace the absolute-path cd with a relative approach so the verification is environment-agnostic.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-03-PLAN.md
Line: 134
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-03-PLAN.md at line 134, Update the instruction sentence that currently reads "Apply the following four edits to e2e/tests/browse-respond.spec.ts" so it correctly states there are six edits; change "four" to "six" in that sentence within the document .planning/phases/08-e2e-test-hygiene/08-03-PLAN.md (the line that begins "Apply the following ... edits") to match the edits labeled Edit 1 through Edit 6.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-03-PLAN.md
Line: 322 to 323
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-03-PLAN.md around lines 322 - 323, Replace the fixed sleep after starting the dev server (the "npm run dev &" step) with a readiness check that polls the server URL or waits for a specific "ready" log line instead of a fixed 5s delay; update the plan text around the "npm run dev &" and "sleep 5" lines to instruct using a loop that curls the baseURL (or use a tool like wait-on) until it returns a healthy response or until a timeout, or alternatively instruct users to confirm the dev server logs include the "ready" message before proceeding to Playwright tests.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-03-PLAN.md
Line: 244
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-03-PLAN.md at line 244, The grep pattern for the regex filter is incorrectly escaped (currently "filter({ hasText: /\^\\\\\[E2E/ })") so update the command that constructs this grep to either use grep -F with the literal substring filter({ hasText: /^\[E2E/ }) or wrap the pattern in single quotes so the shell does not double-escape (e.g., 'filter({ hasText: /^\[E2E/ })'); locate the invocation that builds the grep/regex string (search for the literal filter({ hasText: in the file) and replace the quoted double-quoted pattern with a fixed-string (-F) grep or single-quoted regex so the runtime sees /^\[E2E/ (one backslash) as in the source.

============================================================================
File: .planning/phases/08-e2e-test-hygiene/08-03-PLAN.md
Line: 248
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-e2e-test-hygiene/08-03-PLAN.md at line 248, Update the grep invocation that currently contains the pattern "filter({ hasText: /\\^\\\\\\[E2E/ })" so it uses the same fixed-string form as the other grep (i.e., add the -F flag) and make the pattern literal-escaping identical to that other occurrence; locate the string "filter({ hasText: /\\^\\\\\\[E2E/ })" in the file and replace the quoted regex with the same -F-compatible literal used elsewhere so both grep checks match exactly.

Review completed: 33 findings ✔
```

---

## Consensus Summary

### Agreed Strengths (≥2 reviewers)

- **Architecture is sound** — Lazy service-role client (D-02), single-statement FK-cascade teardown (D-04), and fixture-of-values `{ id, title }` (D-03) are correctly applied. (Gemini, Codex, Cursor)
- **Decision coverage** — D-01 through D-13 are honored across plans 01–04 without contradiction. (Codex, Cursor)
- **Verification is concrete** — Every task has `<acceptance_criteria>` with grep-verifiable conditions; `grep -F` literal-string fix correctly handles the regex-string match. (Gemini, Codex)
- **TEST-10 async carve-out is well-handled** — Plan 04 produces the artifact NOW; runbook is read-only Markdown. (Codex, Cursor)

### Agreed Concerns (≥2 reviewers — highest priority)

- **HIGH — AST selector data-flow blind spot.** The `no-restricted-syntax` rule only sees `.filter()` in the SAME chain expression as `.first()` / `.toHaveCount()`. Variable-based locators like `const cards = page.locator('...').filter(...); cards.first()` will trigger a false positive because the AST walker can't track `cards` back to a filtered locator. Plan 03's `filter-search.spec.ts` migration is at risk; CI lint may go red on first attempt. (Gemini HIGH, Codex HIGH/blocker)
  - Mitigation: Either (a) inline the filter into every chain (`page.locator('...').filter(...).first()`) — verbose but rule-clean; or (b) add an `eslint-disable-next-line` with WHY-justification on legitimate variable-based fluent chains; or (c) tighten the AST selector to allow chained-after-filter patterns (advanced — risk of new false-negatives).

- **MEDIUM — Plan 02 lint-rule activation timing vs Plan 03 spec migrations.** Plans 02 and 03 are in different waves (02 = Wave 1, 03 = Wave 2), but Plan 02 lands the rule which will block any commit in Plan 03 that contains a non-yet-migrated spec. Sequencing within Wave 2 must be tight: migrate spec → lint clean → commit. (Gemini, Codex, Cursor)
  - Mitigation: Confirm Plan 03 Task ordering is per-spec atomic (read + diff + verify-lint + commit per spec, not all-then-lint).

- **MEDIUM — `package.json` `npm run e2e` script addition was a planner discretionary call but introduces a CONTEXT-canonical-refs mismatch.** CONTEXT lists `package.json` as "Read-only awareness" with "no new scripts needed." Adding a script is defensible (RESEARCH §9 symmetry recommendation) but contradicts the stated read-only intent. (Cursor flagged)
  - Mitigation: Either keep the script (and update CONTEXT `<canonical_refs>` to reclassify `package.json`) or drop it and have e2e/README.md cite the raw `npx playwright test ...` command directly. Low cost either way.

- **MEDIUM — Fixture cleanup is single `.delete()` without `try/finally`.** D-04 says "rethrow on failure" — the current shape rethrows on cleanup error but does NOT guarantee cleanup runs if the test body throws after `use(value)`. Playwright's fixture model wraps `use()` in its own try/finally, so this MAY be safe — but Codex flags it as worth verifying. (Codex)
  - Mitigation: Confirm Playwright's contract (`https://playwright.dev/docs/test-fixtures` — "any errors in your test code will not throw out of the fixture"). If guaranteed, document with a 1-line WHY comment in the fixture; if not, wrap in `try/finally`.

- **LOW — ROADMAP success criterion #4 ("have evidence on file") vs D-11 async carve-out.** ROADMAP is verbatim "have evidence on file"; D-11 explicitly defers the actual evidence to a later async session. The `<must_haves>` checks the section EXISTS but not that placeholders are filled. Cursor flagged this as a governance mismatch — the ROADMAP author may interpret #4 as evidence-present, not section-present. (Cursor)
  - Mitigation: Either accept D-11's interpretation (the planner's reading is internally consistent and CONTEXT is the source of truth for Phase 8 scope) or surface as an explicit ROADMAP edit / out-of-scope note.

### Divergent Views

- **Risk Level** — Gemini: MEDIUM; Codex: HIGH (as written, drops to MEDIUM/LOW after fixes); Cursor: MEDIUM (drops to LOW after fixes). All agree the AST selector + Plan 02/03 sequencing are the core concerns; disagreement is on whether they constitute a HIGH blocker or MEDIUM friction.

- **Cursor flagged a contradiction between the planner's `package.json` script addition and CONTEXT's "no new scripts needed"** — Gemini and Codex did not flag this. Cursor's read is correct (it IS a deviation from CONTEXT) but the deviation is low-cost and well-justified by RESEARCH §9.

- **CodeRabbit (33 findings on working tree)** — primarily flags formatting nits, markdownlint warnings, and minor wording issues in the planning docs. Most are non-blocking. The one technical cross-reference: a grep invocation at `08-03-PLAN.md:248` should use `-F` for consistency with the other fixed-string greps. Worth applying as part of any revision pass.

### Top 3 Concerns to Address Before Execution

1. **AST selector data-flow** (HIGH per Codex/Gemini): inline the filter or pre-emptively add eslint-disable + WHY on Plan 03's variable-based locators in `filter-search.spec.ts`. Verify by running `npx eslint e2e/tests/` after Plan 03 Task 2.
2. **Plan 02 → Plan 03 wave sequencing** (MEDIUM): ensure Plan 03 tasks are per-spec atomic so a half-migrated commit doesn't break the lint-blocked CI.
3. **`08-03-PLAN.md:248` grep-F consistency** (LOW per CodeRabbit): one-line fix for symmetry with the rest of the plan.

### How to Apply

Run `/gsd-plan-phase 8 --reviews` to feed REVIEWS.md back to the planner for a targeted revision pass.
