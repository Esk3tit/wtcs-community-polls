---
phase: 02
reviewers: [codex]
reviewed_at: 2026-04-06
plans_reviewed: [02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md]
---

# Cross-AI Plan Review — Phase 2

## Codex Review (GPT-5.4)

### Plan 02-01 Review

#### Summary
Plan 02-01 is a reasonable first wave: it isolates browsing UX, filtering, search, and the card-based interaction model before any write-path logic lands. The decomposition is mostly sound and aligns with the phase's UI-heavy requirements, but the plan appears slightly under-specified around data shape ownership, expand/collapse state behavior, and how active-only visibility is enforced in queries. It will likely produce the visible shell of the feature, but by itself it risks creating UI contracts that Wave 2 has to bend around unless the suggestion/result state model is nailed down now.

#### Strengths
- Separates browsing concerns from voting concerns, which reduces coupling and keeps Wave 1 deliverable-focused.
- Covers the core UX decisions from `D-20` through `D-32`, especially stacked cards, in-place expansion, category pills, and debounced search.
- Centralizing fetching in hooks (`useSuggestions`, `useCategories`) is the right shape for later polling and vote-state enrichment.
- Adding skeletons, empty state, and format utilities suggests reasonable attention to perceived performance and UX polish.
- Wiring the Topics page early gives a concrete integration point before vote logic is introduced.

#### Concerns
- **HIGH**: "Active suggestions in browsable list" is a requirement, but the plan summary does not explicitly say whether `useSuggestions` filters server-side by active/open status or relies on client filtering. If this is not query-level constrained, Wave 1 may expose archived/closed items incorrectly.
- **HIGH**: The card contract appears incomplete for post-vote state. `SuggestionCard` is being designed before `ChoiceButtons` and `ResultBars` exist, but the plan does not say whether the card API already accounts for "pre-vote vs post-vote vs closed-with-results-if-responded" states. That can force rework in Wave 2.
- **MEDIUM**: Expand/collapse defaults are called out in decisions (`D-22`), but the plan does not mention where expansion state lives, how pinned vs non-pinned ordering is determined, or whether filters preserve expansion state.
- **MEDIUM**: Category filtering and search are specified, but the interaction between them is not. Missing details around combined filtering, no-match behavior, and filter reset behavior often produce edge-case regressions.
- **MEDIUM**: Threat model looks too dismissive. "RLS handles security" may be true for reads, but query shaping still matters for leakage of fields like aggregated counts or user-response indicators.
- **LOW**: Nineteen files for what is effectively browse/search/filter UI may be a little fragmented, especially with 8 new components.

#### Suggestions
- Define a single `SuggestionListItem`/view-model contract now that includes all state Wave 2 will need.
- Make server/query-level active filtering explicit in the plan, not just UI filtering.
- Specify sorting rules now: pinned first, then whatever secondary ordering applies.
- Add explicit handling for empty search results, no active suggestions, loading, and query failure states.
- Keep expansion state design simple and documented.

#### Risk Assessment
**MEDIUM**. The wave is directionally correct, but its biggest risk is interface drift.

---

### Plan 02-02 Review

#### Summary
Plan 02-02 contains the real phase-critical logic and is the most important of the three. It covers the required write path through an Edge Function, respondent-gated results, and polling against pre-aggregated counts, which matches the phase goal well. The main risk is that the plan summary leaves too many correctness details implicit: idempotency, duplicate-vote race handling, authorization rules for viewing results, polling lifecycle, and archive-vs-topics data separation.

#### Strengths
- Correctly routes writes through a server-validated Edge Function, which matches `VOTE-02` and `INFR-04`.
- Separates vote submission, vote count fetching, and polling into distinct hooks.
- Uses pre-aggregated counts rather than live aggregation, matching `RSLT-03`.
- Includes auth, validation, and CORS in the Edge Function.
- Explicitly addresses live updates via HTTP polling rather than overcomplicating with Realtime/WebSockets.

#### Concerns
- **HIGH**: `VOTE-01` and `D-25` require one permanent vote enforced server-side and by DB constraints. The plan mentions validation but not the exact race-safe enforcement path. App-level "check then insert" is insufficient; duplicate submissions under concurrency must be safe at the database layer.
- **HIGH**: `RSLT-01` and `RSLT-05` are easy to get wrong. The plan does not state how read authorization for `vote_counts` is gated to respondents only.
- **HIGH**: The plan says it "wires Archive page," but it is unclear whether Archive is being added too early or introduces cross-page complexity before Topics is complete.
- **MEDIUM**: Polling details are missing. Without visibility-based pausing, cleanup on unmount, and backoff/failure handling, this can create unnecessary load and noisy errors.
- **MEDIUM**: Click-to-vote instant submit is correct UX, but the plan does not mention pending/disabled state on choice buttons.
- **MEDIUM**: CORS is listed, but CSRF being "not applicable" is only safe if auth is strictly bearer-token based. The rationale should be explicit.
- **MEDIUM**: The plan does not mention how the user's own selected choice is returned after voting for `D-27` highlighting.
- **LOW**: If `useVoteCounts` and `usePolling` are separate abstractions, there is a risk of redundant complexity.

#### Suggestions
- Make DB-level uniqueness explicit, including how Edge Function handles unique-constraint violations and returns a stable "already voted" result.
- Define the full submit flow: authenticate, validate active, validate choice belongs to suggestion, insert atomically, return user vote state.
- Be explicit about result-read authorization via RLS policy.
- Add client protections for instant voting: disable buttons while pending, prevent repeat submits.
- Specify polling behavior: interval, stop when tab hidden, cleanup timers, degrade on network failure.
- Ensure the response model includes both aggregate counts and the current user's selected option.

#### Risk Assessment
**MEDIUM-HIGH**. This wave carries the highest correctness and security risk.

---

### Plan 02-03 Review

#### Summary
Plan 02-03 is appropriately small and focused. Including realistic seed data plus tests is the right final wave. The main issue is adequacy: for a phase centered on server-enforced voting rules and gated visibility, 15 tests across 3 files may be enough only if they are very deliberately chosen.

#### Strengths
- Defers seed data and tests until the main implementation shape exists, which avoids churn.
- Realistic WTCS seed data is valuable for UX validation and manual acceptance testing.
- Includes coverage for the three most important areas: submission, results visibility, and browsing.
- Keeps scope contained.

#### Concerns
- **HIGH**: Test coverage may be too thin for the rules that matter most. The summary does not clearly include duplicate-vote rejection, closed-suggestion rejection, invalid-choice rejection, unauthorized access, and post-close respondent-only visibility.
- **MEDIUM**: Seed data with sample votes can accidentally mask bugs if tests depend on seeded aggregate counts instead of verifying actual flows.
- **MEDIUM**: If the Edge Function is central to the phase, tests should state whether they exercise it directly, mock it, or only test client hooks.
- **MEDIUM**: Threats are fully accepted here, but test plans should treat regression risk as something to actively mitigate.
- **LOW**: Only 3 categories and 7 suggestions may be too small to meaningfully expose filtering edge cases.

#### Suggestions
- Expand the test matrix around the non-negotiable rules (one vote per user, no changes/deletes, hidden before vote, visible after, respondents only after close, invalid choice rejected, closed cannot be voted on).
- Include at least one integration-style test that exercises the Edge Function contract.
- Seed data should intentionally cover edge cases.
- Verify polling behavior at least minimally.

#### Risk Assessment
**MEDIUM**. The main risk is false confidence if tests stop at happy-path client behavior.

---

### Overall Cross-Plan Assessment

#### Summary
The three-wave breakdown is sensible and mostly aligned with the phase goal. The plans are strongest on feature decomposition and weakest on explicit correctness contracts. The largest cross-plan risk is that the data model, UI state model, and security model are being described separately rather than as one end-to-end contract.

#### Cross-Plan Strengths
- Dependency ordering is broadly correct: UI shell first, write/read rules second, verification last.
- The plans avoid obvious over-engineering and stay within budget constraints.
- Polling over HTTP, pre-aggregated counts, and Edge Functions are all appropriate technical choices.
- The work appears partitioned cleanly enough for phased delivery and review.

#### Cross-Plan Concerns
- **HIGH**: The respondent-gated read model is the most important requirement after vote integrity, and it is still too implicit across the plans.
- **HIGH**: There is no clearly stated end-to-end source of truth for suggestion state, user vote state, and result visibility state.
- **MEDIUM**: Threat modeling looks lightweight and sometimes too quickly accepted.
- **MEDIUM**: Archive page wiring in Wave 2 may add complexity before the core flow is stabilized.
- **MEDIUM**: The plans do not explicitly call out failure UX: network errors, auth expiry, duplicate submissions, and partial loading states.

#### Cross-Plan Suggestions
- Add a concise phase-level contract covering suggestion lifecycle states, when results are visible, how user vote state is determined, what each hook returns, and what the Edge Function guarantees.
- Tighten Wave 2 around DB-enforced uniqueness and respondent-only result access.
- Ensure Wave 1's card API already supports the full pre-vote/post-vote/closed state machine.
- Raise the testing bar in Wave 3 to focus on invariants, not just UI behavior.

#### Overall Risk Assessment
**MEDIUM**. The plans are well-shaped and likely executable, but they are not yet explicit enough around the two hardest parts: race-safe permanent voting and airtight respondent-only result visibility. If those contracts are clarified before implementation, risk drops substantially.

---

## Consensus Summary

*Single reviewer (Codex/GPT-5.4) — consensus based on repeated themes across per-plan reviews.*

### Agreed Strengths
- Feature decomposition into browse/vote/test waves is sound
- Technical choices (Edge Functions, HTTP polling, pre-aggregated counts) are appropriate for scale and budget
- Hook-based data fetching architecture enables clean separation and testability
- Dependency ordering is correct across all 3 waves

### Agreed Concerns
1. **DB-enforced vote uniqueness must be explicit** — the exact race-safe enforcement path (UNIQUE constraint, 23505 handling) needs to be visible in the plan, not left implicit (raised for Plans 02-02 and 02-03)
2. **Respondent-gated result visibility is the highest-risk requirement** — RLS policy on vote_counts must be clearly stated as the enforcement mechanism (raised across all plans)
3. **Card state machine should be designed upfront** — Wave 1's SuggestionCard API must account for pre-vote/post-vote/closed states to avoid Wave 2 rework (raised for Plan 02-01)
4. **Test coverage may miss critical invariants** — duplicate-vote rejection, closed-suggestion rejection, and respondent-only visibility need explicit test cases (raised for Plan 02-03)

### Divergent Views
*N/A — single reviewer. Consider adding Gemini CLI for a second perspective.*

### Mitigations Already in Plans (context the reviewer lacked)
Many HIGH concerns are actually addressed in the full plan text that the reviewer didn't see in the summary:
- `useSuggestions(status)` already takes `'active' | 'closed'` parameter for server-side filtering
- `SuggestionCard` already has `userChoiceId`, `onVote`, `voteCounts` props for all states
- Edge Function explicitly handles UNIQUE constraint violation (code 23505 -> 409 response)
- RLS on `vote_counts` requires existing vote record (verified in RESEARCH.md)
- `usePolling` includes `document.visibilityState` pause
- ChoiceButtons includes `disabled` state during submission with spinner
- Tests include duplicate vote handling (409) test case
