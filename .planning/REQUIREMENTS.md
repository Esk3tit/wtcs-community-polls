# Requirements — v1.2 Admin Visibility Controls

This document tracks the v1.2 milestone requirements. After v1.0 (43 of 45 reqs) and v1.1 (11 of 11 reqs) shipped — archived at [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) and [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md) — v1.2 adds admin-controlled results visibility (reframed SEED-002) plus closes the v1.1 Path-3 UIDN carry-forwards.

**Note on SEED-002 reframing:** The original [SEED-002](seeds/SEED-002-admin-controlled-results-visibility.md) specified a three-mode enum (`respondents_only` / `public_during` / `public_after_close`) and a one-way reveal. During v1.2 scoping the user reframed the model to a simpler hide-toggle + voters-only model: one boolean (`results_hidden`), two-way toggle, no window restriction, no public/anon mode. The seed file itself is preserved as historical context; the requirements below are the canonical v1.2 spec.

## Scope

### Admin Visibility Controls (SEED-002 reframed)

- [x] **VIS-01**: Each suggestion has a per-row `results_hidden` boolean that gates whether voters who voted can see the vote count breakouts. Default is `false` (visible) for all newly created polls and all existing v1.0/v1.1 polls (backwards compat — preserves RSLT-05 default behavior). DB-enforced via `polls.results_hidden boolean NOT NULL DEFAULT false`. *(Plan 11-01, 2026-05-11)*

- [x] **VIS-02**: Admins can flip `results_hidden` true ↔ false at any point in a poll's lifecycle (before voting starts, during voting, after voting closes — including archived polls). No window restriction. Two-way: admins can hide and unhide. The flip is audited: every change writes a new row to `audit_log` and updates `polls.results_hidden_changed_at`. *(Plan 11-02, 2026-05-11 — EF written; deploy gate in Plan 11-05. REVIEW-FIX-H4 race-safe conditional UPDATE; audit + timestamp written only on actual state change.)*

- [x] **VIS-03**: A new admin-gated Edge Function `toggle-results-visibility` performs the flip. Gated via the existing `requireAdmin` helper (Phase 11 verifies the helper is current; reused as-is if signature still fits). Takes `{ poll_id, hidden: boolean }`, validates, writes the new value + audit row, returns updated poll row. *(Plan 11-02, 2026-05-11 — `supabase/functions/toggle-results-visibility/index.ts` (120 lines). Validates UUID + strict boolean; 401/400/403/404/500/200 paths complete; response shape `{poll: <full row>}` on both state-change and no-op paths.)*

- [x] **VIS-04**: The `vote_counts` SELECT RLS policy is rewritten to honor `results_hidden`. The policy grants SELECT iff: (a) `auth.uid()` has cast a vote on this poll AND (b) `polls.results_hidden = false`. Admin service-role bypass remains. The old policy is `DROP`'d before the new policy is `CREATE`'d (no OR-permissive combination). Non-voters never see results regardless of state (privacy boundary unchanged from v1.0). *(Plan 11-01, 2026-05-11 — REVIEW-FIX-H3: no `is_current_user_admin()` OR-branch; service-role bypass only.)*

- [x] **VIS-05**: An RLS invariant test suite enforces the {voted: yes/no} × {hidden: true/false} × {auth: anon/authenticated/admin} cells. Every cell with non-voter or hidden=true returns 0 rows; only `voted + hidden=false + authenticated` returns vote counts; admin role bypass returns rows in all states. The test runs in `e2e/` against local Supabase and blocks merge if any cell fails. *(Plan 11-04, 2026-05-11 — `e2e/integration/vote-counts-rls.test.ts` (12 describe.each cells + 1 admin-JWT regression sentinel); runtime PASS gated to Plan 11-05.)*

- [x] **VIS-06**: Admin UI — Suggestion creation form gains an optional "Hide results from voters" checkbox (default unchecked = visible). Setting it true at creation creates the poll with `results_hidden = true`. UI uses shadcn `Checkbox` (no new dependency). *(Plan 12-02, 2026-05-12)*

- [x] **VIS-07**: Admin UI — Live + archived admin suggestion cards gain an inline "Hide results" / "Show results" toggle (label flips per current state; mobile sub-`sm` shows a lucide `Eye`/`EyeOff` icon instead of the label). Uses shadcn `Switch` placed between the response-count and the kebab menu on `AdminSuggestionRow`. Click flips optimistically and calls the `toggle-results-visibility` EF in the background — sonner toast confirms ("Results hidden for: {title}" / "Results visible for: {title}"); on failure the Switch reverts and an error toast surfaces. Switch is `disabled` + a small `Loader2` adjacent while the EF is in-flight to suppress double-click no-op writes in `audit_log`. Matches the existing `usePinPoll` optimistic + revert precedent. *(Plan 12-03, 2026-05-12; wording revised in Plan 12-00 per CONTEXT.md A1-D1: AlertDialog confirmation pattern replaced with optimistic Switch + sonner toast.)*

- [x] **VIS-08**: User UI — `SuggestionCard` and the archive view show vote count breakouts only when the user has voted AND `results_hidden = false`. When `results_hidden = true`, voters who already voted see a "Results temporarily hidden by admin" message in place of the count display. Non-voters continue to see the vote form (unchanged from v1.0). *(Plan 12-04, 2026-05-12)*

- [x] **VIS-09**: The `polls_effective` view is updated (`CREATE OR REPLACE VIEW`) to project `results_hidden` and `results_hidden_changed_at` from `polls` so the user-facing read path (`useSuggestions`, `useVoteCounts`, `SuggestionCard`) can branch on the policy without bypassing the view boundary. The `polls_effective` invariant test at `src/__tests__/admin/polls-effective-invariant.test.ts` continues to pass — no new direct `from('polls')` reads in `src/`. `security_invoker = on` re-applied after the view rewrite. *(Plan 11-01, 2026-05-11 — pair re-applied 23 lines after CREATE OR REPLACE; invariant test passes 2/2.)*

### UI Polish Closure (carry-forward from v1.1 Path-3)

- [ ] **UIDN-02**: Mobile-first responsive design closure evidence captured — Lighthouse mobile audit + 6-width breakpoint matrix archived at `.planning/closure/UIDN-02-mobile-evidence.md` (v1.2 rerun). **v1.1 Phase 9 outcome:** Path-3 deferred; F2 hard gate failed (Perf 5/5 routes below 90 target). **v1.2 prerequisites:** (1) `audit-screenshots.mjs` hydration-wait fix (Plan 02 defect — `waitForLoadState('networkidle')` plus authenticated Pass-A for `/topics` and `/archive` using existing `loginAs` from `e2e/helpers/auth.ts`); (2) v1.2 production deploy stabilizes perf budget. After both: rerun audit; flip `Mobile-first responsive design` Key Decision row ⚠️ → ✓ if Perf 5/5 ≥ 90 hits.
  _Carry-forward from v1.1; baseline at `.planning/closure/UIDN-02-mobile-evidence.md` (status: deferred)._

- [x] **UIDN-03**: shadcn polish closure — cleanup of 4 native-`<button>` drifts identified in v1.1 Phase 9 audit and authenticated Pass-A screenshot capture. Replace native buttons with shadcn `Button` (correct `variant=` per drift site) at: `SearchBar.tsx:22` (search-clear-X — `variant="ghost"` icon button), `SuggestionForm.tsx:140` + `:163` (form-action buttons — `variant=` per role: primary/secondary), `ImageInput.tsx:108` (drop-zone trigger — programmatic via `useRef`, may stay native if button role isn't required). Preserve `type="submit"` / `type="button"` to avoid form-submit regressions. Re-run UIDN-03 audit; flip `shadcn/ui new-york + Tailwind CSS v4` Key Decision row ⚠️ → ✓ if 0 FAIL cells. *(Plans 12-01 + 12-02 + 12-05, 2026-05-12 — four-site sweep: SearchBar, SuggestionForm ×2, ImageInput DropZone refactor)*
  _Carry-forward from v1.1; baseline at `.planning/closure/UIDN-03-shadcn-audit.md` (status: deferred)._

### Testing & Validation

- [x] **TEST-11**: RLS invariant test for the `vote_counts` × `results_hidden` matrix (covers VIS-05). Verified via direct Supabase client queries with three role contexts (anon / authenticated / service-role) crossed with two state combinations (hidden=true / hidden=false) and two voter states (voted / not-voted). Lives under `e2e/` (database integration test, not pure unit). Blocks merge if any cell fails. *(Plan 11-04, 2026-05-11 — `e2e/integration/vote-counts-rls.test.ts`: 12 describe.each matrix cells + 1 admin-JWT regression sentinel; lint+typecheck green; runtime PASS gated to Plan 11-05.)*

- [x] **TEST-12**: Admin EF authorization test for `toggle-results-visibility` (covers VIS-03). Asserts: non-admin caller returns 403; admin caller returns 200 with updated poll; audit row written; `results_hidden_changed_at` timestamp set. *(Plan 11-04, 2026-05-11 — `e2e/integration/toggle-results-visibility.test.ts`: 7 cases (4 happy + 3 negative for 400/400/404); beforeEach/afterEach fresh-poll-per-case isolation. Plus `e2e/integration/create-poll-results-hidden.test.ts` (4 cases) for the Plan 11-03b results_hidden create path.)*

- [x] **TEST-13**: Playwright E2E spec covering the admin hide/show happy path. Admin creates a poll, casts a test vote (e.g., via `freshPoll` fixture from Phase 8), confirms results visible, clicks "Hide results" → confirms count display replaced with "hidden by admin" message, clicks "Show results" → confirms count returns. Uses existing `[E2E]`-scoped locators; passes ESLint E2E-SCOPE-1. *(Plan 12-06, 2026-05-12)*

## Future Requirements (deferred to v1.3+)

- **UIDN-03-FOLLOWUP-LIST-CARDS**: AdminsList, CategoriesList, PromoteAdminDialog hand-rolled list containers replaced with shadcn `Card`. v1.1 Phase 9 audit transparency note; not a FAIL cell. Deferred to v1.3 per v1.2 scoping decision (keep v1.2 scope tight).

- **VIS-WINDOW**: Window-of-control enum (`pre_only` / `during` / `post`) restricting WHEN admin can toggle hide state. Initially scoped for v1.2 then dropped — user reframed during scoping to allow admin flip anytime. Captured here for future revisit if admins request guardrails (e.g., "lock visibility once first vote arrives").

- **VIS-PUBLIC-MODE**: Pre-vote public results visibility (non-voters see live counts during voting). Original SEED-002 scope; dropped during v1.2 scoping. The privacy boundary stays voters-only across all states.

## Out of Scope (v1.2)

- **Reveal countdown / scheduled reveal**: Time-based auto-reveal at a specific moment. Admin-triggered is the v1.2 mechanism.
- **Per-choice hide**: Hiding individual choice tallies while showing others. v1.2 hides all-or-nothing.
- **Per-user-tier hide**: Different visibility for different community member tiers. v1.2 is all-voters-or-none.
- **Fake admin Discord ID cleanup in production seed** (v1.0 audit tech_debt, still open). Not in v1.2.
- **Leftover `[E2E] Test:` polls in shared DB** (v1.0 audit tech_debt, still open). Not in v1.2.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| VIS-01 | Phase 11 | Complete (Plan 11-01, 2026-05-11) |
| VIS-02 | Phase 11 | Complete (Plan 11-02, 2026-05-11; deploy in Plan 11-05) |
| VIS-03 | Phase 11 | Complete (Plan 11-02, 2026-05-11; deploy in Plan 11-05) |
| VIS-04 | Phase 11 | Complete (Plan 11-01, 2026-05-11) |
| VIS-05 | Phase 11 | Complete (Plan 11-04, 2026-05-11; runtime PASS gated to Plan 11-05) |
| VIS-06 | Phase 12 | Complete (Plan 12-02, 2026-05-12) |
| VIS-07 | Phase 12 | Complete (Plan 12-03, 2026-05-12; wording revised in Plan 12-00) |
| VIS-08 | Phase 12 | Complete (Plan 12-04, 2026-05-12) |
| VIS-09 | Phase 11 | Complete (Plan 11-01, 2026-05-11) |
| UIDN-02 | Phase 13 | Pending |
| UIDN-03 | Phase 12 | Complete (Plans 12-01 + 12-02 + 12-05, 2026-05-12) |
| TEST-11 | Phase 11 | Complete (Plan 11-04, 2026-05-11; runtime PASS gated to Plan 11-05) |
| TEST-12 | Phase 11 | Complete (Plan 11-04, 2026-05-11; runtime PASS gated to Plan 11-05) |
| TEST-13 | Phase 12 | Complete (Plan 12-06, 2026-05-12) |
