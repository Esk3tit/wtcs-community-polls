---
phase: 12
cycle: 2
reviewers: [gemini, codex]
attempted_but_failed: [coderabbit, cursor]
reviewed_at: 2026-05-12T10:04:44Z
plans_reviewed:
  - 12-00-PLAN.md
  - 12-01-PLAN.md
  - 12-02-PLAN.md
  - 12-03-PLAN.md
  - 12-04-PLAN.md
  - 12-05-PLAN.md
  - 12-06-PLAN.md
---

# Cross-AI Plan Review — Phase 12 (Cycle 2)

**Phase**: Admin UI + User UI + UIDN-03 Sweep
**Reviewed at**: 2026-05-12T10:04:44Z
**Reviewers invoked**: Gemini CLI, Codex CLI
**Skipped**: Claude CLI (current runtime — independence)
**Failed**: CodeRabbit (reviews git diff only, not phase plan files), Cursor (usage limit hit — same failure as cycle 1)

**Cycle context**: Cycle 1 review (`b37296b`) surfaced 6 HIGH-severity concerns. Plans were replanned via `5686ff5` to address them. This cycle 2 review evaluates whether the cycle 1 HIGHs are now resolved and whether the replan introduced any new HIGH-severity concerns.

---

## Gemini Review

This review evaluates implementation plans for Phase 12 of the WTCS Community Polls project. This is **cycle 2** of the review loop. The plans were revised in commit `5686ff5` to address 6 HIGH-severity concerns from cycle 1.

### Summary

The cycle 2 plans are of exceptional quality, demonstrating a deep understanding of the project's architectural constraints and the specific feedback from the previous round. All 6 cycle 1 HIGH concerns have been **FULLY RESOLVED**. The plans provide surgical instructions for complex UI state management, accessibility-first refactoring, and high-fidelity E2E testing using isolated browser contexts. The dependency ordering is correct, and the success criteria for Phase 12 are fully covered.

### Cycle 1 HIGH Triage

| Concern | Status | Evidence / Rationale |
|:---|:---|:---|
| **1. VIS-06 validator pass-through** | **FULLY RESOLVED** | **Plan 12-02 Task 12-02-01 Step 2:** Explicitly instructs to update `validateSuggestionForm` to include `results_hidden` in the sanitized return object, preventing silent stripping. |
| **2. Edit-mode VIS-06 checkbox** | **FULLY RESOLVED** | **Plan 12-02 Task 12-02-02:** Implements a branch in `SuggestionForm.tsx` where the checkbox is editable only in `mode === 'create'`. In `edit` mode, it renders a read-only status row, avoiding no-ops against the `update-poll` EF. |
| **3. TEST-13 happy-path coverage** | **FULLY RESOLVED** | **Plan 12-06 Task 12-06-02:** The spec is rewritten to use real UI flows for both admin-create and voter-submit. It explicitly removes the service-role bypass for the happy path. |
| **4. TEST-13 final assertion strength** | **FULLY RESOLVED** | **Plan 12-06 Task 12-06-02 (Assertion B):** Mandates a "strong post-unhide check" (e.g., verifying `role="meter"` or response count text) to prove the visible results actually returned. |
| **5. Plan 12-04 call-site coverage** | **FULLY RESOLVED** | **Plan 12-04 Task 12-04-02:** Includes `SuggestionList.tsx` in `files_modified` and correctly wires the `resultsHidden` map from the extended hook to the card props. |
| **6. Verify-command masking** | **FULLY RESOLVED** | **All Plans:** The `||` masking issue is gone; plans now use `&&` or sequential commands (e.g., `npm run lint && npx tsc -b`) ensuring failures block the gate. |

### New HIGH/MEDIUM Concerns

None identified. The replan is robust and avoids common pitfalls.

### Strengths

- **E2E Realism:** Plan 12-06 uses separate Playwright browser contexts for the admin and the voter, perfectly simulating real-world cross-user interaction and polling behavior.
- **State Granularity:** Plan 12-03 uses a `Set<string>` in `AdminSuggestionsTab` to track `pendingVisibility` per poll ID, allowing for independent in-flight states in a list view.
- **A11y-First Refactor:** The `DropZone` refactor in Plan 12-05 correctly identifies and fixes a dual-role accessibility anti-pattern (drag target vs. click target) using a region/button split.
- **Traceability:** Plan 12-06 includes detailed instructions for updating `REQUIREMENTS.md` with specific plan IDs and dates, maintaining a high standard of documentation.

### Suggestions

- **Test Mock Locations:** In Plan 12-04, the executor is asked to update `useVoteCounts` mocks. The plan correctly suggests searching via `grep`, which is the right approach given the ambiguity of where the mock might reside (unit vs component test folders).
- **Date Consistency:** As noted in Plan 12-06, the executor should ensure the `2026-MM-DD` placeholders are updated to the actual system date during execution.

### Risk Assessment: LOW

The plans are exhaustive, use standard project idioms (`usePinPoll` as precedent), and include defensive programming (e.g., `Boolean` coercion in maps, strict type regeneration). The risk of regression or failure is minimal.

**Phase 12 is ready for execution.**

---
*Reviewer: Gemini CLI*
*Date: 2026-05-12*

---

## Codex Review

### Summary

Cycle 2 is materially stronger than cycle 1. The plans now address the main VIS-06 pass-through, edit-mode no-op, `SuggestionList` call-site, and TEST-13 assertion gaps. I do still see one HIGH concern around the TEST-13 implementation skeleton being brittle/non-executable as written, plus several MEDIUM issues that will likely surface during `npm run test` or E2E implementation.

### Cycle 1 HIGH Triage

| # | Concern | Status | Evidence |
|---|---|---|---|
| 1 | VIS-06 validator drops `results_hidden` | **FULLY RESOLVED** | Plan 12-02 now says `validateSuggestionForm` "MUST be updated to include `results_hidden: input.results_hidden === true`" and adds true/omitted validator tests. |
| 2 | Edit-mode checkbox silently no-ops | **FULLY RESOLVED** | Plan 12-02 makes the editable checkbox create-only and says edit mode renders a read-only status row: "Toggle from the admin list to change visibility." |
| 3 | TEST-13 bypasses real admin/voter flows | **PARTIALLY RESOLVED** | The must-have now requires "REAL UI flows" and "NO service-role `votes` INSERT bypass," but Plan 12-06 still has stale objective/threat-model text about "freshPoll fixture extension that adds a vote-cast helper" and "Playwright service-role insert into `votes`." Clean this contradiction. |
| 4 | TEST-13 final assertion too weak | **FULLY RESOLVED** | Plan 12-06 now requires hidden alert disappearance **and** a restored result marker: response footer, `role="meter"`, or `100%`. |
| 5 | Plan 12-04 missed `SuggestionList` call site | **FULLY RESOLVED** | Plan 12-04 includes `src/components/suggestions/SuggestionList.tsx` in `files_modified` and explicitly wires `resultsHidden={resultsHidden.get(suggestion.id) ?? false}`. |
| 6 | Verify command masking with `\|\| npx tsc -b` | **FULLY RESOLVED** | Current verification uses `&&` / separate commands; no masked `test \|\| tsc` gate remains. |

### New Concerns

#### HIGH: TEST-13 skeleton is still brittle as written

Plan 12-06 has the right intent, but the provided skeleton is likely to fail or flake:

- `await adminPage.waitForURL(/\/admin/)` can match `/admin/suggestions/new`, the same issue already fixed in `admin-create.spec.ts`.
- The switch ID capture uses `.filter({ has: adminPage.locator('xpath=ancestor::*[...]') })`; `has` should match within the candidate subtree, so ancestor filtering from the switch is unreliable.
- The choice selector ignores the existing stable `data-testid="choice-button"` pattern and uses a broad `.first()` without the existing E2E-SCOPE escape-hatch comments.

This is fixable, but TEST-13 is the phase integration sentinel, so the plan should be concrete and copy the known-good `admin-create.spec.ts` / `browse-respond.spec.ts` selector patterns.

#### MEDIUM: Unit-test mocks are still underplanned

Plan 04 handles `useVoteCounts` mocks, but other mock breakages are likely:

- `src/__tests__/admin/suggestion-form.test.tsx` mocks `@tanstack/react-router` with only `useNavigate`; Plan 12-02 adds `Link`.
- `src/__tests__/suggestions/suggestion-list.test.tsx` mocks `lucide-react` without `EyeOff`; Plan 12-04 imports it.
- Admin suggestion mocks should include `results_hidden` to keep fixtures representative.

`npm run test` will catch this, but the plans should explicitly include these edits.

#### MEDIUM: Admin response counts may be incompatible with Phase 11 RLS

`AdminSuggestionsTab.tsx` still reads `vote_counts` directly from the browser client. Migration 10 says `vote_counts` is visible only to users who voted and when results are not hidden, and notes admin reads should go through service-role-backed paths. That means admin-list response counts can show `0` for admins who have not voted, especially hidden polls. Since Plan 03 touches this area, it should either fix the admin count path or document the accepted regression.

#### MEDIUM: Archive live-update promise is overstated

Plan 12-04 says voter UI auto-updates within ~8s after admin flips, but `SuggestionList` currently sets `enablePolling = status === 'active'`. Archive pages fetch once. Initial archive render will be correct, but live hidden/show flips on archived suggestions will not update within 8s unless polling is enabled there too.

### Strengths

- The VIS-06 validator fix is precise and test-backed.
- The edit-mode VIS-06 no-op is handled pragmatically with a read-only status row.
- `polls_effective` remains the planned read boundary, with invariant tests preserved.
- Plan 12-04 correctly puts `SuggestionList` in the write set.
- TEST-13 now aims at real UI flows and a strong post-unhide assertion.
- UIDN-03 scope stays tight and does not pull in deferred list-card work.

### Suggestions

- Clean Plan 12-06 stale objective/threat-model references to `castVoteOnFreshPoll` and service-role vote inserts.
- Rewrite TEST-13 selectors using existing stable patterns: `admin-create-suggestion`, `suggestion-form-submit`, `suggestion-card` filtered by title, and `choice-button`.
- Capture the UI-created poll ID by querying service role by unique title during cleanup/setup, or add a row-level testid on `AdminSuggestionRow`; avoid ancestor XPath through `has`.
- Add a small automated create-checked assertion for VIS-06, since TEST-13 leaves the checkbox unchecked.
- Add explicit test mock updates for `Link`, `EyeOff`, and `results_hidden` fixtures.

### Risk Assessment

**Overall risk: MEDIUM.** The cycle 1 architectural gaps are mostly fixed, but Plan 12-06 still needs tightening before execution, and there are predictable unit-test/mock failures. No remaining security-boundary issue stands out in the Phase 12 plans, but the admin count/RLS mismatch deserves a decision before shipping.

---
*Reviewer: Codex CLI*
*Date: 2026-05-12*

---

## Consensus Summary

Two reviewers (Gemini, Codex) examined the cycle 2 plans plus CONTEXT and UI-SPEC. They **agree** that cycle 1's 5 of 6 HIGH concerns are fully resolved (validator pass-through, edit-mode no-op, TEST-13 final assertion strength, Plan 12-04 call-site coverage, verify-command masking). They **diverge** on:

- **Cycle 1 #3 (TEST-13 happy-path coverage)** — Gemini marks FULLY RESOLVED ("The spec is rewritten to use real UI flows"). Codex marks PARTIALLY RESOLVED, flagging that Plan 12-06 still contains stale objective/threat-model prose referencing the old `castVoteOnFreshPoll` helper and service-role vote inserts even though the must-have section has been corrected. The contradiction is documentation hygiene, not a functional gap — but Codex's finding is verifiable against the plan text and should be addressed before execution.
- **One NEW HIGH from Codex** — TEST-13 skeleton brittleness (waitForURL regex matches `/admin/suggestions/new`; `has` filter with ancestor XPath unreliable; choice selector ignores stable `data-testid="choice-button"` pattern). Gemini did not raise this.
- **Overall risk** — Gemini LOW, Codex MEDIUM. The MEDIUM rating is driven entirely by execution-quality concerns in Plan 12-06 (TEST-13) plus three MEDIUM concerns (mock updates, admin count RLS mismatch, archive polling promise).

### Agreed Strengths

- All cycle 1 HIGHs except TEST-13 stale prose are confirmed resolved by both reviewers.
- Plan 12-04 `SuggestionList.tsx` call-site coverage is correct (both reviewers).
- Plan 12-02 validator pass-through fix with create-only checkbox + edit-mode read-only row is sound (both reviewers).
- TEST-13 now aims at real UI flows and a strong post-unhide assertion (both reviewers — Codex says intent is right even if skeleton is brittle).
- Verify commands no longer mask test failures (both reviewers).
- UIDN-03 scope stays tight; list-cards deferral to v1.3 is honored (both reviewers).

### Agreed Concerns

No HIGH-severity concerns are raised by both reviewers at HIGH severity. However, Codex's new HIGH (TEST-13 skeleton brittleness) and partial-resolution call on cycle 1 #3 (TEST-13 stale prose) are concrete and verifiable. Both touch Plan 12-06 specifically.

### Divergent Views

- **TEST-13 stale prose in Plan 12-06**: Gemini approved end-to-end. Codex flagged PARTIAL with specific pointers to leftover `castVoteOnFreshPoll` / service-role insert text. **Action**: scrub Plan 12-06 objective + threat-model sections for the contradiction.
- **TEST-13 skeleton selectors (NEW HIGH from Codex only)**: Codex argues `waitForURL(/\/admin/)` over-matches, ancestor XPath via `has:` is unreliable, and choice selector ignores stable `data-testid`. Gemini did not surface these. **Action**: rewrite TEST-13 skeleton to use existing `admin-create.spec.ts` / `browse-respond.spec.ts` selector patterns (`data-testid="admin-create-suggestion"`, `data-testid="suggestion-form-submit"`, `data-testid="choice-button"`).
- **Admin count RLS mismatch (Codex MEDIUM only)**: `AdminSuggestionsTab` reads `vote_counts` from the browser client; Migration 10 says admin reads should use service-role. Could result in admin-list response counts showing `0` for non-voting admins, especially on hidden polls. Gemini did not raise. **Action**: decide explicitly (fix the admin count path OR document the regression in CONTEXT as a known limitation).
- **Archive polling (Codex MEDIUM only)**: `SuggestionList` sets `enablePolling = status === 'active'`; archive polls won't get ~8s live updates after an admin flip. Gemini did not raise. **Action**: either enable polling for archive or scope the "8s auto-update" promise in CONTEXT/REQUIREMENTS to live polls only.
- **Test mock updates (Codex MEDIUM only)**: `Link` mock missing in `suggestion-form.test.tsx`; `EyeOff` mock missing in `suggestion-list.test.tsx`; admin fixtures missing `results_hidden`. Gemini noted Plan 12-04 grep approach but didn't enumerate the other two. **Action**: explicitly add these mock updates to Plans 12-02 and 12-04.

### Recommended Triage

The cycle 1 → cycle 2 transition successfully resolved 5 of 6 architectural HIGHs. **One HIGH remains** (Codex-only, TEST-13 skeleton brittleness) and **one PARTIAL** (Codex-only, TEST-13 stale prose contradicting the must-have). Both live in Plan 12-06.

**Before Wave 3 execution, fix Plan 12-06:**
1. Scrub stale `castVoteOnFreshPoll` + service-role vote insert references from objective and threat-model sections to match the cycle 2 must-have ("REAL UI flows; NO service-role votes INSERT bypass").
2. Rewrite the TEST-13 skeleton to use existing stable `data-testid` patterns (`admin-create-suggestion`, `suggestion-form-submit`, `choice-button`, `suggestion-card` filtered by title) and replace `waitForURL(/\/admin/)` with a tighter regex or pathname check.
3. Capture the UI-created poll ID via service-role title lookup or a new row-level testid on `AdminSuggestionRow` — avoid ancestor XPath through `has:`.

**Address before merge (MEDIUM):**
- Decide admin count RLS path (fix or document).
- Decide archive polling promise (enable or scope to live).
- Add `Link`, `EyeOff`, and `results_hidden` test-mock updates to Plans 12-02 and 12-04.

---

## How to Use This Review

Incorporate findings into planning:

```
/gsd-plan-phase 12 --reviews
```

Or address the HIGH item manually by editing Plan 12-06 and re-running `/gsd-review --phase 12 --all` to confirm convergence.
