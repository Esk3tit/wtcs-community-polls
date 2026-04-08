---
phase: 3
reviewers: [codex]
reviewed_at: 2026-04-07
plans_reviewed: [03-01-PLAN.md, 03-02-PLAN.md]
---

# Cross-AI Plan Review — Phase 3

## Codex Review (GPT-5.4)

### Plan 01: Guild Membership Verification at Login

#### Summary
This plan is directionally solid and aligns well with the phase decisions: verify Discord guild membership during login, persist the result in `profiles`, and reuse the existing auth rejection flow. It is appropriately scoped for `AUTH-03` and mostly achieves the intended fail-closed model. The main risk is not the core approach, but whether the implementation fully handles OAuth callback failure modes, stale membership state, and the boundary between login-time verification and downstream authorization checks.

#### Strengths
- Uses Discord `guilds` scope and `/users/@me/guilds` at login, which matches the chosen architecture and avoids introducing bot infrastructure.
- Fail-closed behavior is explicit, which is correct for an integrity-sensitive requirement.
- Persists guild membership status in `profiles`, which gives downstream systems a stable server-side signal.
- Reuses existing `AuthErrorPage` and route patterns, reducing UI complexity and regression risk.
- Threat model is sensible and acknowledges the accepted stale-membership tradeoff.
- Includes callback tests and error-page tests, which is good coverage for the main flow.

#### Concerns
- `MEDIUM`: The plan does not explicitly say whether response submission paths will check stored `guild_member` status or rely purely on successful login. If downstream checks are absent, users with legacy sessions or edge-case callback bypasses may slip through.
- `MEDIUM`: OAuth callback error handling is underspecified. Cases like missing `provider_token`, Discord API timeout, partial Supabase session creation, or malformed guild response need explicit behavior.
- `MEDIUM`: "Updated RPC" is mentioned but not justified in the plan summary. If the RPC change affects unrelated auth/profile flows, this may widen regression surface.
- `LOW`: The accepted stale-membership risk is fine given the decision, but it should be documented as a product limitation, not only as a threat-model note.
- `LOW`: "6 callback tests" may still be too shallow if they only cover happy path plus one rejection case. The risky part is failure-mode behavior, not rendering.

#### Suggestions
- Add an explicit downstream authorization check that response submission requires `profiles.guild_member = true`, even if login-time verification remains the primary gate.
- Define exact callback behavior for these cases: missing `provider_token`, Discord API non-200, empty guild list, guild ID misconfiguration, and profile update failure.
- Ensure logout/session cleanup is atomic enough that a rejected non-member cannot retain a usable session after callback failure.
- Narrow the RPC/schema change to only what is required for this phase; if the RPC change is optional, avoid it.
- Expand tests to include fail-closed scenarios, especially Discord API failure and profile persistence failure.

#### Risk Assessment
**MEDIUM**. The core design is correct and likely sufficient, but the plan leaves some ambiguity around callback failure handling and downstream enforcement. Those are manageable gaps, but they matter for an integrity phase.

---

### Plan 02: Upstash Redis Rate Limiting

#### Summary
This plan is appropriately scoped and fits the chosen architecture well: enforce a per-user sliding-window limit inside `submit-vote` and surface errors through the existing client hook/toast path. The main weakness is test completeness and operational definition. The plan likely achieves `VOTE-04`, but only if environment/configuration failures, Redis unavailability, and limit response semantics are handled explicitly.

#### Strengths
- Places rate limiting in the Edge Function, which is the correct trust boundary.
- Keys on authenticated user ID from JWT, avoiding client-controlled identifiers.
- Sliding window `5/60s` is simple, defensible, and adequate for the stated traffic level.
- Keeps scope tight by avoiding per-IP logic and preserving the existing client error-handling pattern.
- Includes a checkpoint for external setup, which is appropriate because Upstash/env configuration is a real deployment dependency.

#### Concerns
- `HIGH`: The test plan appears incomplete for `TEST-04`. "3 client-side toast tests" does not cover actual server-side rate-limit behavior, keying logic, or fail-closed semantics in the Edge Function.
- `MEDIUM`: The checkpoint bundles unrelated items: Upstash setup, schema push, and guild ID configuration. Schema push and guild ID belong to Plan 01, not this plan. That creates dependency confusion.
- `MEDIUM`: Fail-closed on Upstash outage is defensible, but returning a generic `500` may produce poor UX and make rate-limit outages indistinguishable from server faults.
- `MEDIUM`: The plan does not specify whether the limit is per vote attempt, per successful submission, or per request regardless of validation outcome. That affects abuse resistance and false positives.
- `LOW`: No mention of response headers or structured error codes. Without a distinct machine-readable error, client handling may become brittle.
- `LOW`: No explicit consideration of retry bursts caused by network flakiness or duplicate submits, which can be common in browser clients.

#### Suggestions
- Add Edge Function tests that verify: requests 1-5 succeed and 6th is blocked within 60 seconds, limit key uses authenticated user ID, Redis failure triggers the intended fail-closed path, window resets correctly after time elapses.
- Separate the human checkpoint so this plan only blocks on Upstash/env setup. Guild ID configuration and schema push belong in Plan 01.
- Return a distinct status/code for rate limiting, ideally `429`, and preserve the chosen toast message on the client.
- Clarify whether invalid submissions also consume quota. Usually counting all submission attempts is better for abuse control.
- Consider structured logging around rate-limit denials and Redis errors so operational issues can be diagnosed.

#### Risk Assessment
**MEDIUM**. The implementation path is straightforward, but the current test scope is too client-heavy for a server-enforced integrity control. With stronger server-side testing and cleaner dependency boundaries, this drops to low risk.

---

## Consensus Summary

### Agreed Strengths
- Architecture is sound: guild check at login + rate limiting in Edge Function is the correct trust boundary model
- Good alignment with all 10 user decisions (D-01 through D-10) — no scope creep
- Fail-closed security model is correctly applied to both auth and rate limiting
- Reuse of existing patterns (AuthErrorPage, useVoteSubmit error handling) reduces regression risk

### Agreed Concerns
- **TEST-04 coverage gap (HIGH):** Server-side behavior testing is insufficient — plans rely heavily on client-side/UI tests for server-enforced integrity controls. Need Edge Function-level and auth callback failure-mode tests.
- **Checkpoint boundary blur (MEDIUM):** Plan 02's checkpoint bundles Plan 01 dependencies (schema push, guild ID). Setup items should be scoped to the plan that owns them.
- **Downstream enforcement ambiguity (MEDIUM):** Plans don't explicitly address whether `guild_member` is checked at response submission time, only at login. Should clarify the enforcement boundary.

### Divergent Views
None — single reviewer (Codex). Concerns are internally consistent.
