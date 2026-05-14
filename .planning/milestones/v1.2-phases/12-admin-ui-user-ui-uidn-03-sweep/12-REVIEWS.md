---
phase: 12
cycle: 3
reviewers: [gemini, codex]
attempted_but_failed: [coderabbit, cursor]
reviewed_at: 2026-05-12T10:25:28Z
plans_reviewed:
  - 12-00-PLAN.md
  - 12-01-PLAN.md
  - 12-02-PLAN.md
  - 12-03-PLAN.md
  - 12-04-PLAN.md
  - 12-05-PLAN.md
  - 12-06-PLAN.md
---

# Cross-AI Plan Review — Phase 12 (Cycle 3)

**Phase**: Admin UI + User UI + UIDN-03 Sweep
**Reviewed at**: 2026-05-12T10:25:28Z
**Reviewers invoked**: Gemini CLI, Codex CLI
**Skipped**: Claude CLI (current runtime — independence)
**Failed**: CodeRabbit (reviews git diff only, not phase plan files), Cursor (Pro usage limit hit — same failure as cycles 1 and 2)

**Cycle context**: Cycle 2 review (`b120090`) surfaced 2 HIGH-severity concerns in Plan 12-06 (Codex-only — Gemini cleared the plan): TEST-13 skeleton brittleness (`waitForURL(/\/admin/)` over-matches; ancestor-XPath `.filter({ has })` is unreliable; broad choice selector) and TEST-13 stale prose contradicting the cycle 2 must-have (`castVoteOnFreshPoll` + service-role votes INSERT references). Commit `eff1836` rewrote Plan 12-06 to address both. Cycle 3 evaluates the current state of all 7 plans.

---

## Gemini Review

The Phase 12 plans for **Admin UI + User UI + UIDN-03 Sweep** are now in an exceptionally strong state. Commit `eff1836` successfully transformed Plan 12-06 from a brittle, service-role-heavy draft into a high-fidelity integration sentinel that exercises real production code paths.

### 1. Summary

A comprehensive and well-sequenced 7-plan execution strategy. The plans correctly separate foundational work (types/primitives) from parallel implementation waves, culminating in a robust E2E test. The transition from the originally planned `AlertDialog` to an optimistic `Switch` (Plan 12-03) aligns perfectly with existing project idioms like `usePinPoll`. The handling of the UIDN-03 sweep (Plans 12-01, 12-02, 12-05) is surgical and addresses the specific accessibility concerns (dual-role buttons) flagged in the v1.1 audit.

### 2. Cycle 2 HIGH Triage

#### [HIGH] TEST-13 skeleton brittleness (Plan 12-06)
**Status: FULLY RESOLVED**
- **Evidence:** Task 12-06-02 now uses the repo's established "best-of" selector patterns. Brittle XPath `ancestor` walks are replaced with a deterministic service-role title lookup (`[E2E] TEST-13 ${Date.now()}`). The broad `waitForURL(/\/admin/)` is replaced with a tightened regex `/\/admin(?:\/suggestions)?\/?(?:\?.*)?$/` that prevents false-positive matches on the `/new` route. These changes significantly reduce flake risk.

#### [HIGH] TEST-13 stale prose contradicting must-have (Plan 12-06)
**Status: FULLY RESOLVED**
- **Evidence:** The plan objective and threat model have been thoroughly scrubbed of references to `castVoteOnFreshPoll` or service-role INSERT bypasses. The plan now explicitly commits to exercising real UI flows for both creation (VIS-06) and voting (submit-vote EF).

### 3. Review of Codex-only MEDIUMs (Cycle 2)

- **Mock updates (Plan 12-04):** **FULLY RESOLVED.** Must-have 7 and Task 12-04-02 now include explicit instructions to find and update `useVoteCounts` mocks to prevent `undefined.get()` runtime crashes in existing tests.
- **Admin count RLS mismatch (Plan 12-03/04):** **FULLY RESOLVED.** The plans correctly leverage the `polls_effective` view (Phase 11 VIS-09) to read `results_hidden`. This respects the "no-admin-JWT-OR-branch" decision from Phase 11.
- **Archive polling promise (Plan 12-04):** **FULLY RESOLVED.** The uniform "temporarily hidden" copy and the extension of `useVoteCounts` (which `SuggestionList` uses for both topics and archive) ensure the behavior is consistent and reactive.

### 4. Strengths

- **Create-Only Visibility Scope (Plan 12-02):** The decision to render the visibility checkbox as a read-only status in "Edit" mode is a masterful catch. Since the `update-poll` EF does not accept the field, this prevents admins from toggling a UI control that has no effect.
- **Strong E2E Assertions (Plan 12-06):** "Assertion B" (post-unhide check) correctly identifies that the test must prove the results *returned*, not just that the alert *left*. Checking for `role="meter"` or the response-count footer makes this a true integration test.
- **DropZone Refactor (Plan 12-05):** Moving the complex drag-and-drop logic into a standalone component while keeping state in the parent provides a much cleaner A11y story and resolves the "dual-role button" debt.
- **Validator Integrity (Plan 12-02):** Must-have 4 correctly identifies that the `validateSuggestionForm` must be updated to include the new field in its explicit return object, preventing a silent field-stripping bug.

### 5. Suggestions

- **Plan 12-00 (Type Regen):** Note that if the executor is in a CI or non-linked local environment, they will need to ensure `supabase login` and `supabase link` context is available. (Must-have 2 mentions `--linked`, which is appropriate given Phase 11's deployment history).
- **Plan 12-03 (Switch ARIA):** The `aria-label` logic correctly uses current state ("Results currently visible"), which is the Radix standard. This is a subtle but important win for screen-reader UX.

### 6. Risk Assessment

**Overall Risk: LOW**

The dependency waves are correctly structured. Foundation work (12-00) is a prerequisite for all logic. The logic plans (12-02, 12-03, 12-04) are independent of each other but co-dependent for the final E2E check (12-06). The project invariants (specifically VIS-09's no-direct-read rule) are well-protected.

**Conclusion:** The plans are ready for approval and implementation. No new HIGH or MEDIUM concerns were identified in this revision.

---
*Reviewer: Gemini CLI*
*Date: 2026-05-12*

---

## Codex Review

### Summary

Cycle 3 is substantially improved. Plan 12-06 now matches the intended TEST-13 shape: real admin-create UI, real voter-submit UI, tightened post-submit URL assertion, service-role read only for poll-id capture, testid-based Switch/Alert targeting, and a stronger post-unhide assertion requirement. I do not see a new HIGH-severity concern introduced by `eff1836`. There are still several MEDIUM execution risks across the 7 plans, mostly around stale/admin count behavior, archive polling, and plan-command hygiene.

### Cycle 2 HIGH Triage

| Cycle 2 HIGH | Status | Evidence |
|---|---:|---|
| TEST-13 skeleton brittleness | **FULLY RESOLVED** | Plan 12-06 replaces broad `waitForURL(/\/admin/)` with `expect(...).toHaveURL(/\/admin(?:\/suggestions)?\/?(?:\?.*)?$/)`, uses service-role title lookup instead of ancestor-XPath `has`, uses `suggestion-card` + `choice-button` patterns copied from existing specs, and includes collapsed-card resilience. |
| TEST-13 stale prose contradiction | **FULLY RESOLVED** | Objective, must-haves, tasks, threat model, verification, and success criteria consistently say no service-role vote insert and no `castVoteOnFreshPoll`; remaining references are explicitly "do not add" / historical explanation, not contradictory implementation prose. |

### New HIGH/MEDIUM Concerns

**No new HIGHs.**

MEDIUM concerns:

- **Admin count RLS mismatch still open.** `AdminSuggestionsTab` still reads `vote_counts` from the browser client, but Phase 11 removed the admin-JWT OR branch and relies on service-role bypass. Admin users who have not voted may see `0 responses`. This was one of the cycle 2 Codex MEDIUMs and is not resolved by Plans 12-03/12-04.

- **Archive polling promise still open / partially contradicted.** Plan 12-04 promises live hidden-state updates within ~8s, but current `SuggestionList` only enables polling for `status === 'active'`. Archive views fetch once. Either enable polling for voted archived suggestions or narrow the promise.

- **Plan 12-04 threat model overclaims RLS protection against stale client data.** RLS blocks future `vote_counts` fetches after hide, but it cannot retract already-cached counts in React during the up-to-8s polling window.

- **Plan 12-06 skeleton still leaves Assertion B as a "pick one" placeholder.** The must-have is correct, and `ResultBars` does expose `role="meter"`, so the plan should hard-code `await expect(voterCard.locator('[role="meter"]').first()).toBeVisible(...)` instead of leaving executor discretion.

- **Plan verification markup is malformed in 12-03, 12-04, and 12-05.** Several `<automated>` blocks are missing `</automated>`. If the execution workflow parses these tags, this can break automation or confuse agents.

- **Plan 12-00 Radix dependency expectation likely conflicts with repo convention.** Existing shadcn files import from the aggregate `radix-ui` package, not `@radix-ui/react-*`. Plan 12-00 requires `@radix-ui/react-checkbox` and `@radix-ui/react-switch` in `package.json`; adjust verification to match what the current shadcn registry actually generates for this repo.

- **VIS-06 checked-create path remains weakly tested.** TEST-13 leaves the checkbox unchecked. Plan 12-02 has validator coverage and manual DB verification, but no automated UI assertion that checking `visibility-checkbox` creates `results_hidden = true`.

### Strengths

- Plan 12-06 now exercises the right integration surfaces: `SuggestionForm` submit, `submit-vote` via `choice-button`, admin Switch, voter polling, hidden Alert, and visible ResultBars return.
- Selector reuse is grounded in existing specs: `admin-create-suggestion`, `suggestion-form-submit`, `suggestion-card`, `choice-button`, and `role="meter"` all exist.
- Plan 12-02 correctly addresses the validator-strip risk by requiring `results_hidden` on the sanitized return.
- Plan 12-04 correctly moves wiring into `SuggestionList`, not route files, and calls out mocked `useVoteCounts` updates.
- Plan 12-05's DropZone separation is a sound accessibility improvement.

### Suggestions

- Hard-code the post-unhide assertion in Plan 12-06 to `role="meter"`; the source confirms it exists.
- Add an automated UI check for VIS-06 checked create, or explicitly scope TEST-13 to default-visible only and add a Plan 12-02 component/integration test.
- Resolve admin counts after VIS-04 RLS removal, either via a service-role admin EF/view path or a documented replacement query.
- Fix archive polling wording or implementation before marking VIS-08 fully complete.
- Close malformed `<automated>` tags in Plans 12-03/12-04/12-05.
- Update Plan 12-00 to accept the repo's current `radix-ui` aggregate import/dependency pattern.

### Risk Assessment

Overall risk: **MEDIUM**. The two cycle 2 HIGHs are resolved and Plan 12-06 is now directionally executable and idiomatic. Remaining risks are not TEST-13 blockers, but they can cause false verification failures, stale UI behavior, or admin count regressions if left unaddressed.

---
*Reviewer: Codex CLI*
*Date: 2026-05-12*

---

## Consensus Summary

Two reviewers (Gemini, Codex) examined the cycle 3 plans plus CONTEXT and ROADMAP context. They **agree** that the two cycle 2 HIGHs are now **FULLY RESOLVED** by commit `eff1836`, and neither reviewer identifies a new HIGH-severity concern in Plan 12-06's revision. They **diverge** on the residual MEDIUM concerns Codex carried over from cycle 2 (Gemini marks several of them FULLY RESOLVED; Codex still flags them as open).

### Agreed Strengths

- TEST-13 skeleton brittleness (cycle 2 HIGH) is **FULLY RESOLVED** by both reviewers — tightened URL regex, service-role title lookup for poll-ID capture, repo-stable `choice-button` testid + collapsed-trigger resilience, copied verbatim from `admin-create.spec.ts` + `browse-respond.spec.ts`.
- TEST-13 stale prose (cycle 2 HIGH) is **FULLY RESOLVED** by both reviewers — `castVoteOnFreshPoll` and service-role votes INSERT references scrubbed from objective + threat-model; remaining mentions are explicitly negative ("do NOT add") rather than contradictory.
- Plan 12-02 validator pass-through fix with create-only checkbox + edit-mode read-only row is sound (carried forward from cycle 2 consensus).
- Plan 12-04 `SuggestionList.tsx` call-site wiring is correct (carried forward from cycle 2 consensus).
- UIDN-03 four-site sweep stays tight; list-cards deferral to v1.3 honored.
- TEST-13 strong post-unhide Assertion B is the correct integration sentinel.

### Agreed Concerns

**No HIGH-severity concerns are raised by both reviewers.** Cycle 3 successfully closes the two cycle 2 HIGHs without introducing new ones.

### Divergent Views

- **Codex-only carry-forward MEDIUMs (not resolved by Plan 12-06 rewrite; cycle 2 surfaced these and they remain open):**
  - **Admin count RLS mismatch** — `AdminSuggestionsTab` still reads `vote_counts` from the browser client; Phase 11 removed the admin-JWT OR branch. Admin users who haven't voted may see `0 responses`. Codex MEDIUM; Gemini marks "FULLY RESOLVED" (rationale: `polls_effective` view handles `results_hidden` reads — but Codex's concern is specifically about the `vote_counts` count reads, not the visibility flag).
  - **Archive polling promise** — `SuggestionList` sets `enablePolling = status === 'active'`; archive views fetch once. The "within ~8s" auto-update promise (Plan 12-04 D-11) won't hold on archived polls. Codex MEDIUM; Gemini marks "FULLY RESOLVED" (rationale: the uniform copy keeps the UI consistent — but Codex's concern is the *liveness* contract on archive, not the rendering).
  - **Plan 12-04 threat model overclaim** — T-12-04-01 says RLS makes the up-to-8s stale window safe, but RLS cannot retract counts already cached in React from a prior poll cycle. Codex MEDIUM only.
- **Codex-only new MEDIUMs (Codex surfaced these in cycle 3; Gemini did not):**
  - **Assertion B placeholder** — Plan 12-06 leaves Assertion B as a "pick one of three options" placeholder. `ResultBars` source confirms `role="meter"` exists; hard-code that option rather than leaving executor discretion.
  - **Malformed `<automated>` tags** — Plans 12-03, 12-04, 12-05 have `<automated>` blocks without closing `</automated>` tags. If a downstream parser is strict, automation breaks.
  - **Plan 12-00 Radix dependency drift** — Plan 12-00 verify asserts `"@radix-ui/react-checkbox"` + `"@radix-ui/react-switch"` in package.json, but the repo's existing shadcn primitives import from the aggregate `radix-ui` package. The shadcn CLI may emit one or the other depending on version; the verify command should accept either.
  - **VIS-06 checked-create not E2E covered** — TEST-13 leaves the visibility checkbox UNCHECKED. The checked-create path (Plan 12-02 D-17 promises `results_hidden=true` from the form) has only validator unit tests + manual DB-verify guidance — no automated UI smoke.

### Recommended Triage

The cycle 2 → cycle 3 transition successfully **closes both HIGH concerns**. Reviewers agree no new HIGH-severity issues are introduced.

**Both HIGH concerns from cycle 2 are FULLY RESOLVED:**
1. TEST-13 skeleton brittleness — verified by both Gemini and Codex against the rewritten Plan 12-06 Task 12-06-02 skeleton.
2. TEST-13 stale prose contradiction — verified by both Gemini and Codex against the rewritten Plan 12-06 objective + threat-model + key_links sections.

**Open MEDIUMs (Codex-only; not merge blockers, but worth addressing before or during execution):**
- Hard-code Assertion B to `role="meter"` in Plan 12-06 (eliminates executor-time picking from three options).
- Close malformed `<automated>` tags in Plans 12-03, 12-04, 12-05.
- Update Plan 12-00 Radix verification to accept either `radix-ui` (aggregate) or `@radix-ui/react-*` (per-component) packages.
- Decide admin count RLS path: either (a) move `AdminSuggestionsTab` response-count reads through a service-role admin EF/view, or (b) document the regression as a known limitation in CONTEXT.md.
- Decide archive polling: either (a) extend `enablePolling` to cover archived polls the voter has voted on, or (b) narrow the "within ~8s" promise in CONTEXT/REQUIREMENTS to live polls only.
- Add an automated VIS-06 checked-create smoke (component test or a second TEST-13 case) so the create-time path has more than validator unit coverage.
- Reconcile Plan 12-04 threat model T-12-04-01 wording (acknowledge React-state stale cache is the gap; RLS is the next-cycle defense, not the same-cycle defense).

**Status: Cycle 3 converged on HIGH concerns.** No HIGH concerns remain unresolved. Wave 1 execution may begin.

---

## How to Use This Review

Incorporate findings into planning:

```
/gsd-plan-phase 12 --reviews
```

Or proceed directly to Wave 1 execution since no HIGH concerns remain. Address the open MEDIUMs in-flight during execution or in a follow-up plan-touch commit.
