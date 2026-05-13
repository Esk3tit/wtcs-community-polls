---
phase: 4
reviewers: [codex]
reviewed_at: 2026-04-11T23:30:50Z
plans_reviewed: [04-01-PLAN.md, 04-02-PLAN.md, 04-03-PLAN.md, 04-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 4: Admin Panel & Suggestion Management

> Reviewers invoked: **codex** (OpenAI Codex CLI).
> Skipped: `claude` (running inside Claude Code — self-review excluded for independence).
> Unavailable: `gemini`, `opencode`.
> CodeRabbit: attempted but failed with "No files found for review" — CodeRabbit reviews git diff/working tree, and all Phase 4 artifacts are already committed (no uncommitted changes to review).

---

## Codex Review

## Summary

The plan set is strong on traceability, explicit contracts, and sequencing. It maps the phase goals well, keeps server-side enforcement where it belongs, and correctly treats the UI as non-authoritative. The main weaknesses are execution risk from sheer size, a few places where the plan assumes existing RLS/read paths without verifying them enough, and some implementation choices that are a bit too rigid or slightly overbuilt for a small admin surface. Overall, it is a credible Phase 4 plan, but it needs a few guardrails tightened before execution.

## Strengths

- Requirements coverage is explicit and mostly complete across DB, Edge Functions, admin UI, and public surface.
- Dependency ordering is mostly sound:
  - `04-01` establishes DB substrate first.
  - `04-02` builds the server surface on top of that.
  - `04-03` and `04-04` layer UI on top of stable interfaces.
- Security model is mostly correct:
  - Admin actions are enforced server-side.
  - Self-demotion is blocked in UI and server.
  - Upload MIME restrictions exclude SVG, which is the right XSS call.
  - Edit/delete locks are rechecked server-side, not trusted to the client.
- The lazy-close design is pragmatic and removes `pg_cron` as a blocker.
- Using signed upload URLs rather than direct client storage writes is a good fit.
- The plans are unusually testable; source-analysis tests make intended structure hard to accidentally regress.
- The public/admin terminology split is preserved, which matters for this project.

## Concerns

- **HIGH**: `04-01` requires `supabase db push` as a blocking step, but the environment here is non-interactive and approval-free. As written, this can stall the phase even if all local work is correct.
- **HIGH**: The plans assume profile reads for admin UI are allowed via RLS (`AdminsList` direct read from `profiles`), but I do not see that dependency treated as a verified contract. If existing profile SELECT policies are narrower than assumed, Plan 03 breaks.
- **HIGH**: `update-poll` in `04-02` deletes and reinserts choices after a separate poll update rather than using a transaction/RPC. If reinserting choices fails, you can leave the poll updated with missing choices.
- **HIGH**: `close-expired-polls` is intentionally ungated in Phase 4. The blast radius is limited, but it is still a public write-capable endpoint hitting production data. “It only closes expired polls” is acceptable operationally, but still not ideal.
- **MEDIUM**: The plan set is large and brittle. `04-04` alone spans 29 files and multiple behavioral surfaces. That raises merge/review risk and makes “green tests” less meaningful if mocks dominate.
- **MEDIUM**: Heavy reliance on source-analysis tests verifies code shape, not runtime behavior. That is useful, but it can produce false confidence for Supabase query-chain correctness, auth ordering, and route wiring.
- **MEDIUM**: `polls_effective` view plus `vote_counts` fetches may create subtle divergence if some reads are switched and others are not. The plan mentions this, but the implementation burden is spread across many files.
- **MEDIUM**: `AdminsList` directly queries all admins each mount with no explicit ordering or error handling. Small scale makes this fine, but UX could degrade on transient failures.
- **MEDIUM**: Validation is split across client helper, EF logic, and RPC logic. That is defensible, but there is some duplication drift risk.
- **MEDIUM**: The plan uses `vote_counts` as a UI gate and `votes EXISTS` as server truth. That is correct, but the plan should explicitly state that stale aggregates must never drive authoritative decisions.
- **LOW**: The plan sometimes locks into exact implementation text too aggressively. That reduces adaptability if repo realities differ.
- **LOW**: Category delete dialog shows affected count, but Plan 03 appears to fall back to `0` rather than actually querying it. That is a mismatch against the UX decision.

## Suggestions

- Add one explicit preflight item before `04-03`:
  - verify `profiles` SELECT policy supports the Admins tab fields for authenticated admins.
- Change `update-poll` implementation to a transactional path:
  - either add an RPC for update-with-choices,
  - or perform choice replacement in a DB function.
- Add minimal gating to `close-expired-polls` even in Phase 4:
  - a temporary shared secret header is enough.
- Add one integration test per critical admin flow, not just source-analysis:
  - create poll,
  - reject post-vote edit,
  - reject self-demote,
  - signed upload URL creation.
- Reduce `04-04` scope per commit even if not per plan:
  - validator/hooks,
  - form UI/routes,
  - admin suggestions tab/dialogs,
  - public surface.
- Make the category delete affected-count requirement honest:
  - either query the count now,
  - or downgrade the requirement in the plan.
- Add explicit error states for:
  - failed admin list fetch,
  - failed edit-form load,
  - failed category fetch,
  - failed vote-count fetch in admin suggestion list.
- Add an explicit note that `polls_effective` must be the only source for public active/closed reads after this phase.
- Add a verification step after route generation that the actual generated paths match TanStack conventions, since file naming mismatches are common.
- Consider making `close-poll` idempotent and validating status transitions explicitly:
  - active -> closed allowed,
  - closed -> closed harmless,
  - resolution edits go through `set-resolution`.

## Risk Assessment

**Overall risk: MEDIUM**

The architecture is mostly right, and the plans do achieve the phase goals on paper. The biggest risks are not conceptual; they are execution and integration risks: remote DB push dependency, assumed RLS behavior on profile reads, non-transactional update flow for poll edits, and a lot of test coverage that checks source text more than real behavior. If those four areas are tightened, this becomes a low-to-medium risk phase. Without them, it is plausible to “finish the plans” and still ship regressions or get blocked mid-phase.

---

## Consensus Summary

Only one independent reviewer (Codex) completed. The findings below are Codex's alone, but are ordered by severity for planner consumption.

### Single-Reviewer Strengths

- Requirements traceability (DB → EF → UI) is explicit and comprehensive.
- Dependency ordering is correct (04-01 → 04-02 → 04-03 → 04-04).
- Security posture is sound: server-side enforcement, SVG exclusion, edit/delete locks rechecked server-side, self-demote blocked in both layers.
- Lazy-close design is pragmatic and free-tier friendly (no pg_cron).
- Signed upload URLs chosen over direct client writes — correct trade-off.
- Source-analysis tests make structural regressions hard.

### Single-Reviewer HIGH Concerns (action before execute)

1. **[HIGH] Non-interactive `supabase db push` blocker.** Plan 04-01 Task 3 requires `supabase db push` as a gating step, but this can stall in non-interactive environments. Consider: checkpoint with `SUPABASE_ACCESS_TOKEN` env var instructions OR fall-back manual path.
2. **[HIGH] Unverified `profiles` SELECT RLS for AdminsList.** Plan 04-03 `AdminsList` reads directly from `profiles` table. If existing RLS policies are narrower than admin needs, Plan 03 breaks at runtime. Add preflight verification task before Plan 04-03 touches profiles.
3. **[HIGH] `update-poll` non-transactional choice replacement.** Plan 04-02 `update-poll` EF deletes and reinserts choices separately from the poll update. If choice reinsert fails, the poll is left with missing/zero choices. Fix: wrap in an RPC / DB function, or use a single transaction.
4. **[HIGH] `close-expired-polls` is ungated.** Though blast radius is small (only closes already-expired rows), it is still a public write endpoint. Recommended: add a shared-secret header check even in Phase 4.

### Single-Reviewer MEDIUM Concerns

- **[MEDIUM] Plan 04-04 breadth (29 files, 4 tasks).** Density is acknowledged with a per-task commit note, but test coverage is source-analysis heavy — structural correctness verified, runtime behavior not. Consider adding at least one integration test per critical admin flow (create poll, reject post-vote edit, reject self-demote, signed upload URL creation).
- **[MEDIUM] `polls_effective` view adoption is spread across many files.** Risk that some reads switch to the view while others keep reading base `polls`, creating lazy-close divergence. Add explicit rule: post-Phase 4, all public active/closed reads MUST go through `polls_effective`.
- **[MEDIUM] Validation duplication drift.** Same rules encoded in client helper, Edge Function, and RPC. Defensible but document as intentional.
- **[MEDIUM] `vote_counts` is a cache, not truth.** Plan correctly uses `votes EXISTS` on the server for edit/delete locks, but should explicitly state that `vote_counts` is never authoritative for gating decisions.
- **[MEDIUM] Missing error states.** Admin list fetch, edit-form load, category fetch, vote-count fetch in admin suggestion list — all lack explicit failure UI.

### Single-Reviewer LOW Concerns

- **[LOW] Category delete affected-count.** D-21 says "dialog shows count of suggestions that will become uncategorized", but Plan 04-03 falls back to `0` placeholder rather than querying it. Either query it now or downgrade D-21.
- **[LOW] Plans sometimes lock into exact implementation text too aggressively, reducing adaptability if repo realities diverge.**

### Agreed Concerns (N/A — single reviewer)

Only one external reviewer completed; agreement metric not applicable. Re-run `/gsd-review` with `gemini` or `opencode` installed for multi-reviewer consensus.

### Divergent Views (N/A)

Single reviewer — no divergence to analyze.

---

## Top 3 Priorities for Planner

If replanning via `/gsd-plan-phase 4 --reviews`, focus on:

1. **Non-transactional `update-poll` choice replacement** — HIGH severity, concrete data-integrity risk. Wrap in RPC or transaction.
2. **Unverified `profiles` SELECT RLS** — HIGH severity, will cause runtime failure if policies are narrower than assumed. Add preflight grep/query task.
3. **Category delete count vs D-21 contract** — LOW severity but honest mismatch. Either implement the count query (simple) or document the downgrade in CONTEXT.md.

The four other HIGH/MEDIUM concerns (non-interactive push, ungated sweep EF, 04-04 density, polls_effective consistency) are operational/documentation adjustments rather than blockers.
