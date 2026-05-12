---
phase: 12
reviewers: [gemini, codex]
attempted_but_failed: [coderabbit, cursor]
reviewed_at: 2026-05-12T09:43:27Z
plans_reviewed:
  - 12-00-PLAN.md
  - 12-01-PLAN.md
  - 12-02-PLAN.md
  - 12-03-PLAN.md
  - 12-04-PLAN.md
  - 12-05-PLAN.md
  - 12-06-PLAN.md
---

# Cross-AI Plan Review — Phase 12

**Phase**: Admin UI + User UI + UIDN-03 Sweep
**Reviewed at**: 2026-05-12T09:43:27Z
**Reviewers invoked**: Gemini CLI, Codex CLI
**Skipped**: Claude CLI (current runtime — independence)
**Failed**: CodeRabbit (reviews git diff only, no working-tree changes for plan files), Cursor (usage limit hit)

---

## Gemini Review

# Phase 12 Plan Review: Admin UI + User UI + UIDN-03 Sweep

This review covers the 7 execution plans (`12-00` through `12-06`) for the integration of admin visibility controls and the final cleanup of native button drifts.

## 1. Summary
The plans for Phase 12 are exceptionally well-structured, demonstrating a deep understanding of the existing codebase and architectural patterns. The strategy of breaking the work into three waves—foundation, implementation, and verification—is logical and minimizes dependency risks. The transition from the original `AlertDialog` requirement to a modern, optimistic `Switch + Toast` pattern is handled correctly at the documentation level (Plan 00) and implementation level (Plan 03). Security (RLS invariants) and accessibility (ARIA roles, touch targets) are treated as first-class citizens throughout the plans.

## 2. Strengths
*   **Foundation First:** Plan 00 ensures that type safety (`database.types.ts`) and UI primitives (`Checkbox`, `Switch`) are in place before feature work begins, preventing compile-time friction.
*   **Pattern Consistency:** The new admin mutation hook (`useToggleResultsVisibility`) and its optimistic wiring in `AdminSuggestionsTab` perfectly mirror the established `usePinPoll` pattern.
*   **Efficient Polling:** The extension of `useVoteCounts` to fetch `results_hidden` via `Promise.all` minimizes network round-trips while ensuring the voter UI stays reactive to admin changes.
*   **A11y-First Refactoring:** The `DropZone` extraction in Plan 05 is a textbook example of resolving dual-role accessibility issues by separating pointer-based drag targets from keyboard-based button triggers.
*   **Robust E2E Strategy:** The multi-context approach in `results-visibility.spec.ts` (Plan 06) and the 12s polling tolerance show high maturity in handling distributed state testing.

## 3. Concerns

*   **UI/UX State Desync (Low Severity):** 
    In `useVoteCounts.ts` (Plan 04), if the `polls_effective` query fails or lags behind the `vote_counts` query, there is a window where a voter might see an empty results bar (due to RLS returning 0 rows) before the "Results Hidden" Alert appears.
    *   *Mitigation:* This is already acknowledged in the Plan 04 threat model (T-12-04-01). Since RLS protects the data, the risk is a minor UX "flicker," not an information leak.

*   **Test Selector Regression (Low Severity):**
    The refactor of `ImageInput.tsx` (Plan 05) removes an outer `div role="region"` wrapper. If existing image-upload tests (unit or E2E) relied on that specific DOM nesting or the `role="region"` being on that specific element, they may need updates.
    *   *Mitigation:* Plan 05 explicitly includes a task to re-run image-upload tests to confirm zero regressions.

## 4. Suggestions
*   **Search Param Consistency:** In Plan 02, for the `Back to admin` links, while the current behavior routes correctly by default, explicitly adding `search={{ tab: 'suggestions' }}` to the `Link` component would ensure the user returns to the exact view they likely came from, even if defaults change in the future.
*   **Loading Feedback on Create:** When an admin creates a poll with `results_hidden = true`, the `create-poll` EF (as of Phase 11) performs a post-RPC update and emits two audit rows. Plan 02 correctly passes the flag, but ensuring the "Saving..." spinner covers the duration of both operations (which it should, as the EF waits for both) is crucial for UX.

## 5. Risk Assessment
**Overall Risk: LOW**

The backend foundations (RLS, Edge Functions, Schema) were successfully shipped and verified in Phase 11. Phase 12 is primarily a "wiring" phase. The plans include comprehensive validation steps (`tsc -b`, `npm run lint`, `npm run test`) at every stage and conclude with a full-loop E2E integration test. The use of optimistic updates with revert logic significantly lowers the risk of UI/Server state divergence.

---
*Reviewer: Gemini CLI*
*Date: 2026-05-12*

---

## Codex Review

## Summary

The plans are thorough and mostly well-sequenced, but I would not approve them as-is. The architecture is sound: Phase 11 owns schema/RLS/EF, Phase 12 wires UI, and the Switch-over-AlertDialog drift is explicitly reconciled. The main risk is that several plans contain internal contradictions or stale assumptions against the current repo, especially VIS-06 form pass-through, `SuggestionCard` call-site wiring, E2E coverage, and verification commands that can mask failing tests.

## Strengths

- Clear wave ordering: foundation first, independent UI slices in Wave 2, E2E/traceability last.
- Good security posture: mutation goes through the admin-gated EF; voter aggregate visibility still relies on RLS, not React branching.
- Strong UI specificity: Switch behavior, mobile label/icon treatment, hidden-state copy, and DropZone semantics are well-defined.
- Good recognition of the canonical spec drift: Plan 00 correctly updates VIS-07 from AlertDialog/Button to Switch/toast.
- UIDN-03 scope is mostly disciplined and avoids pulling deferred list-card cleanup into Phase 12.
- Test IDs are planned for the new cross-surface E2E path, which is the right move for brittle admin/voter flows.

## Concerns

- **HIGH: VIS-06 pass-through is likely broken.** `validateSuggestionForm` currently returns an explicit sanitized object and would drop `results_hidden` unless the return value is updated. Plan 12-02 says the validator can remain unchanged, which conflicts with the must-have that it “accepts and passes it through.”

- **HIGH: Edit-mode visibility checkbox conflicts with current EF behavior.** `update-poll` does not accept or persist `results_hidden`. If the checkbox is enabled in edit mode for no-vote polls, admins can change it, save successfully, and see no actual visibility change. Either hide/disable this checkbox outside create mode or route edit-mode visibility changes through `toggle-results-visibility`.

- **HIGH: TEST-13 does not actually cover the promised happy path.** Plan 12-06 says “admin creates poll” and “voter casts vote,” but the proposed spec uses `freshPoll` plus a service-role vote insert. That bypasses the admin creation UI, the VIS-06 default field, and the voter submit flow.

- **HIGH: TEST-13 final assertion is too weak.** It only checks that the hidden alert disappears after “show,” not that result bars/counts return. A blank/incorrect branch would pass.

- **HIGH: Plan 12-04 omits the actual call-site file.** `SuggestionCard` is rendered by `src/components/suggestions/SuggestionList.tsx`, not directly by route files. That file must be in `files_modified`, and its tests/mocks need updates.

- **HIGH: Several verify commands can mask test failures.** Patterns like `npm run test ... || npx tsc -b` allow a failing test command to be treated as success if typecheck passes. That defeats the verification gate.

- **MEDIUM: Hook-level inflight guard conflicts with per-row pending state.** `useToggleResultsVisibility` has a single `inflightRef`, so one pending row blocks toggles on every other row, despite Plan 12-03 adding a per-row `pendingVisibility` set. Use either per-row guarding or remove the hook-global guard.

- **MEDIUM: Hidden results may still show misleading “0 responses” footer.** When `results_hidden=true`, `vote_counts` returns zero rows. `SuggestionCard` currently derives footer totals from `voteCounts`, so the hidden alert branch may still show `0 responses`, which undermines the hidden-results UX.

- **MEDIUM: Unit test mocks will break.** `SuggestionForm` tests mock `@tanstack/react-router` without `Link`; `SuggestionList` mocks `useVoteCounts` without `resultsHidden`; lucide mocks may need `EyeOff`. The plans do not include test fixture/mock updates.

- **MEDIUM: E2E command is wrong.** `npx playwright test e2e/tests/results-visibility.spec.ts` does not necessarily load `e2e/playwright.config.ts`, so `baseURL`, global setup, and webServer behavior may be missing. Use `npm run e2e -- e2e/tests/results-visibility.spec.ts`.

- **LOW: Source-comment guidance is inconsistent.** Several plans propose comments containing `VIS-06`, `D-13`, `Phase 11`, etc., despite the project rule against phase/plan archaeology in `src/`.

- **LOW: Plan 00 frontmatter omits `package-lock.json`.** The shadcn command will likely update it; include it explicitly.

## Suggestions

- Update Plan 12-02 so `validateSuggestionForm` returns `results_hidden: input.results_hidden === true`, and add unit tests for checked and unchecked create submissions.

- Make VIS-06 create-only unless there is a deliberate edit-mode implementation. If shown in edit mode, it should be read-only or clearly delegated to the admin-list Switch.

- Add `src/components/suggestions/SuggestionList.tsx` and relevant tests to Plan 12-04’s file list.

- In hidden mode, suppress footer aggregate text or derive a hidden-safe footer state so voters do not see fake `0 responses`.

- Replace every `test || tsc` verification command with strict `&&` chains or separate required commands.

- Rework `useToggleResultsVisibility` so the inflight guard is keyed by poll ID, or rely on row-level disabled state only.

- Make TEST-13 either truly perform admin creation and voter vote, or rename/scope it honestly and add a second UI test for VIS-06. The current version is a useful integration test, but it does not satisfy the stated success criteria.

- Strengthen TEST-13’s final visible-state assertion with card-scoped `role="meter"` or `"1 total response"` checks after unhiding.

- Update Vitest mocks as part of the relevant plans, not as incidental fallout.

## Risk Assessment

**Overall risk: HIGH** until the issues above are fixed. The core design is viable, and the security model is mostly solid because RLS/EF boundaries remain intact. The risk is execution quality: the current plans can produce a build/test failure, a silently nonfunctional VIS-06 path, and an E2E test that passes without proving the actual Phase 12 success criteria.

---

## Consensus Summary

Two reviewers (Gemini, Codex) examined the 7 plans plus CONTEXT and UI-SPEC. They agree the architecture is sound — Phase 11 owns schema/RLS/Edge Functions, Phase 12 is the UI wiring — and that the Switch+toast drift from the original AlertDialog requirement is properly reconciled in Plan 00. They diverge sharply on overall risk: Gemini rates the phase LOW risk (a "wiring phase" with solid backend foundations), while Codex rates it HIGH risk citing six specific contradictions between the plans and the current repo that could yield a silently nonfunctional VIS-06 path or an E2E test that passes without proving the success criteria.

### Agreed Strengths

- **Wave ordering is sound**: Wave 1 foundation (types + primitives), Wave 2 parallel UI slices, Wave 3 E2E + traceability — both reviewers approve.
- **Pattern consistency**: New `useToggleResultsVisibility` hook mirrors the established `usePinPoll` optimistic pattern (both reviewers).
- **Security posture intact**: Mutations go through the admin-gated Edge Function; voter aggregate visibility stays on RLS, not React branching (both reviewers).
- **Plan 00 correctly handles canonical drift**: Updates VIS-07 wording from AlertDialog/Button to Switch/toast per CONTEXT D-01 (both reviewers).
- **A11y/UI specificity is strong**: DropZone separation in Plan 05, Switch mobile treatment, hidden-state copy all well-defined (Gemini explicit; Codex implicit).

### Agreed Concerns

The two reviews have minimal overlap in concerns — Gemini found only LOW issues (UI desync flicker, test selector regression), while Codex surfaced execution-quality gaps that Gemini did not catch. There is no concern raised by BOTH reviewers at HIGH severity. However, Codex's HIGH list (below) is highly specific and load-bearing — these are not stylistic objections but concrete contradictions between the plan text and the current codebase state.

### Divergent Views

- **Overall risk**: Gemini LOW vs. Codex HIGH. Resolution: Codex's HIGH concerns are concrete and verifiable against the repo (validator return shape, `update-poll` EF surface, call-site files). They should be treated as gating until verified.
- **VIS-06 validator pass-through**: Gemini did not raise this. Codex flagged HIGH — `validateSuggestionForm` returns a sanitized explicit object and would drop `results_hidden` unless Plan 12-02's "validator unchanged" claim is wrong. **Action**: verify against `src/lib/validation/suggestionForm.ts` (or equivalent).
- **Edit-mode visibility checkbox**: Gemini did not raise this. Codex flagged HIGH — `update-poll` EF does not persist `results_hidden`, so an edit-mode checkbox would silently no-op. **Action**: scope VIS-06 checkbox to create-only OR extend `update-poll` EF.
- **TEST-13 happy-path coverage**: Gemini approved the multi-context E2E approach. Codex flagged HIGH — the `freshPoll` + service-role insert bypasses the admin-creation UI and voter submit flow that the SC4 contract names explicitly. **Action**: either route the test through real UI flows or scope SC4 honestly and add a second test.
- **TEST-13 final assertion strength**: Gemini did not raise. Codex flagged HIGH — checking only that the hidden alert disappears can pass on a blank branch. **Action**: assert count bars/total response footer return.
- **Plan 12-04 call-site coverage**: Gemini did not raise. Codex flagged HIGH — `SuggestionCard` is mounted via `SuggestionList.tsx`, which must appear in `files_modified` with its tests/mocks. **Action**: audit Plan 12-04 `files_modified`.
- **Verify-command masking**: Gemini did not raise. Codex flagged HIGH — `npm run test ... || npx tsc -b` lets a failing test still pass the gate. **Action**: replace `||` with `&&` or split into required steps across all plans.

### Recommended Triage

Block Wave 2 execution until the six Codex HIGH items are either fixed in the plans or explicitly waived with rationale captured in CONTEXT.md:

1. VIS-06 validator return shape (Plan 12-02)
2. Edit-mode VIS-06 checkbox scope (Plan 12-02)
3. TEST-13 admin-create + voter-submit path (Plan 12-06)
4. TEST-13 post-unhide visible-state assertion (Plan 12-06)
5. Plan 12-04 `SuggestionList.tsx` call-site and mock updates
6. Plan-level verify commands using `||` between test and typecheck (audit all 7 plans)

Medium and low items (hook inflight guard granularity, hidden-mode footer copy, mock fixture updates, E2E command form, source-comment archaeology, Plan 00 lockfile entry) can be addressed alongside the HIGH fixes or queued for execution-time follow-up.

---

## How to Use This Review

Incorporate findings into planning:

```
/gsd-plan-phase 12 --reviews
```

Or address the HIGH items manually by editing the affected PLAN.md files and re-running `/gsd-review --phase 12 --all` to confirm convergence.
