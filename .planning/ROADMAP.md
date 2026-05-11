# Roadmap: WTCS Community Polls

## Overview

This roadmap delivers a Discord-authenticated community suggestion and opinion-gathering platform for the War Thunder Competitive Scene. The dependency chain is rigid: database schema and auth must exist before any reads, reads before writes, response integrity before public launch, and admin tools before the platform is self-service. Each phase delivers a vertically complete capability that can be verified independently, building toward a platform where community members share opinions on competitive scene proposals with confidence that results are authentic.

**Terminology note:** Internal/code terminology (polls, votes) used in phase names and REQ-IDs for code alignment. User-facing descriptions use suggestion/topic/response/opinion per the Design System Brief (`.planning/DESIGN-SYSTEM.md`).

## Milestones

- ✅ **v1.0 — Launch-Ready MVP** — Phases 1–6 (shipped 2026-04-28) — see [MILESTONES.md](MILESTONES.md) and [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 — Hygiene & Polish** — Phases 7–10 (shipped 2026-05-11) — see [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) and [GitHub milestone v1.1](https://github.com/Esk3tit/wtcs-community-polls/milestone/1)
- 🔄 **v1.2 — Admin Visibility Controls** — Phases 11–13 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>✅ <strong>v1.0 — Launch-Ready MVP (Phases 1–6) — SHIPPED 2026-04-28</strong></summary>

- [x] **Phase 1: Foundation & Authentication** (4/4 plans) — Supabase schema with RLS, Discord OAuth with fail-closed 2FA, routing scaffold, light/dark responsive shell (shadcn/ui + Tailwind), deployment pipeline, testing infrastructure with auth tests
- [x] **Phase 2: Browsing & Responding** (4/4 plans) — Suggestion listing with category filtering and search, response submission via Edge Function, respond-then-reveal results with HTTP polling, response/results tests
- [x] **Phase 3: Response Integrity** (2/2 plans) — Discord server membership verification via OAuth guilds scope, Upstash Redis rate limiting on response submissions, integrity tests
- [x] **Phase 4: Admin Panel & Suggestion Management** (5/5 plans) — Admin suggestion creation with dynamic choices, category management, suggestion lifecycle (timers, close, archive with resolution status), admin promotion/demotion, admin action tests
- [x] **Phase 5: Launch Hardening** (10/10 plans) — Supabase keepalive cron, production deployment at polls.wtcsmapban.com, Sentry + PostHog observability, Playwright E2E smoke tests, GH Actions CI + dependabot
- [x] **Phase 6: Auth fix, GDPR opt-IN rewire, favicon polish, and launch hardening** (7/7 plans) — Auth diagnose-first instrumentation, GDPR opt-IN rewire of analytics + Replay (default-OFF until Allow), WTCS-branded favicon and meta polish, REQUIREMENTS sync + Sentry sourcemap symbolication evidence

Full v1.0 phase details (goals, plans, success criteria) preserved in [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

</details>

<details>
<summary>✅ <strong>v1.1 — Hygiene & Polish (Phases 7–10) — SHIPPED 2026-05-11</strong></summary>

- [x] **Phase 7: Observability Hardening** (3/3 plans) — Sentry React 19 error hooks + Rolldown `keepNames` (PR #21 merged 2026-04-30)
- [x] **Phase 8: E2E Test Hygiene** (4/4 plans) — `[E2E]`-scoped locators, ESLint E2E-SCOPE-1 rule, `freshPoll` fixture, Phase 03 UAT 2+3 second-human evidence (PR #22 merged 2026-05-03)
- [x] **Phase 9: UI Closure Evidence** (4/4 plans) — UIDN-04 reconciliation; UIDN-02 + UIDN-03 Path-3 deferred to v1.2 with archived evidence (PR #24 merged 2026-05-06)
- [x] **Phase 10: Planning Hygiene Backfill** (5/5 plans) — VALIDATION frontmatter backfill, retroactive 03-VERIFICATION.md, 9 SUMMARY `requirements-completed` declarations, Phase 04 UAT 6a off-record evidence (PR #25 merged 2026-05-11)

Full v1.1 phase details (goals, plans, decisions, reconciliation) preserved in [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).

</details>

### v1.2 — Admin Visibility Controls (Phases 11–13)

- [ ] **Phase 11: Schema + RLS + EF Foundations** — Migration 10 (`results_hidden` boolean + `results_hidden_changed_at` timestamptz on `polls`, `vote_counts` RLS DROP+CREATE, `polls_effective` view rewrite with `security_invoker = on`), `toggle-results-visibility` Edge Function, 12-cell RLS invariant test suite (TEST-11), admin EF authorization test (TEST-12)
- [ ] **Phase 12: Admin UI + User UI + UIDN-03 Sweep** — VisibilityCheckbox on creation form, "Hide/Show results" toggle button + AlertDialog on admin cards, `canSeeResults` gate in `SuggestionCard`, hidden-state message component, `useVoteCounts` extension, archive view fix, 4 native-button drift cleanup co-landing in `SuggestionForm.tsx`, `SearchBar.tsx`, `ImageInput.tsx`, Playwright E2E happy path (TEST-13)
- [ ] **Phase 13: UIDN-02 Mobile Audit Closure** — `audit-screenshots.mjs` hydration-wait fix (Plan 02 defect), Lighthouse mobile audit rerun with authenticated Pass-A evidence for `/topics` and `/archive`, Key Decision rows flipped ⚠️ → ✓

## Phase Details

### Phase 11: Schema + RLS + EF Foundations
**Goal**: The `results_hidden` policy is enforced at the database layer — RLS on `vote_counts` correctly gates visibility per voter status, and the `toggle-results-visibility` Edge Function is deployed and admin-authorized
**Depends on**: Phase 10 (v1.1 shipped)
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, VIS-09, TEST-11, TEST-12

**Success Criteria** (what must be TRUE):
  1. Migration 10 applies cleanly: `polls.results_hidden boolean NOT NULL DEFAULT false` and `polls.results_hidden_changed_at timestamptz` columns exist; all 14 pre-existing migrations continue to pass
  2. The 12-cell RLS invariant test suite passes in full: every cell where `results_hidden = true` OR the caller has not voted returns 0 rows from `vote_counts`; only `voted + results_hidden = false + authenticated` returns count data; service-role bypasses the policy in all states — **no cell may be skipped; this is a merge blocker**
  3. Admin EF authorization test confirms: non-admin caller receives HTTP 403; admin caller receives HTTP 200 with updated poll row including the new `results_hidden` value and a non-null `results_hidden_changed_at`; an `audit_log` row is written for every toggle
  4. The `polls_effective` view exposes `results_hidden` and `results_hidden_changed_at` to all callers (including the React client via the existing public read path); `security_invoker = on` re-applied; the `polls-effective-invariant.test.ts` continues to pass with zero new `from('polls')` direct reads introduced
  5. `toggle-results-visibility` EF is deployed and reachable: calling it as a non-admin returns 403; calling it as an admin with a valid `{ poll_id, hidden: boolean }` body flips the value and writes the audit row

**Plans**: 7 plans
- [x] 11-00-PLAN.md — Wave 0 integration test fixtures (vitest config, helpers, scaffolds) — complete 2026-05-11
- [x] 11-01-PLAN.md — Migration 10 (polls columns + audit_log + view rewrite + vote_counts policy) — complete 2026-05-11
- [x] 11-02-PLAN.md — Shared audit helper + toggle-results-visibility EF — complete 2026-05-11
- [ ] 11-03-PLAN.md — Audit retrofit of 11 existing mutation admin EFs (excluding create-poll, planned in 11-03b)
- [ ] 11-03b-PLAN.md — create-poll results_hidden extension + audit retrofit (Option A — post-RPC conditional UPDATE)
- [ ] 11-04-PLAN.md — TEST-11 12-cell RLS matrix + TEST-12 admin EF authz tests
- [ ] 11-05-PLAN.md — [BLOCKING] supabase db push + functions deploy + ship
**UI hint**: no

---

### Phase 12: Admin UI + User UI + UIDN-03 Sweep
**Goal**: Admins can hide and show results on any suggestion from the admin UI, users see either live vote counts or a "Results temporarily hidden by admin" message depending on the current state, and all 4 shadcn native-button drift sites are replaced
**Depends on**: Phase 11
**Requirements**: VIS-06, VIS-07, VIS-08, UIDN-03, TEST-13

**Success Criteria** (what must be TRUE):
  1. Admin creation form has a "Hide results from voters" checkbox (default unchecked); creating a poll with it checked produces a row with `results_hidden = true`; creating with it unchecked produces `results_hidden = false`
  2. Live and archived admin suggestion cards show a "Hide results" / "Show results" toggle button that opens an AlertDialog with the suggestion title and an audit-trail note before confirming; confirming calls the `toggle-results-visibility` EF and the card label updates immediately
  3. A logged-in user who has voted on a suggestion with `results_hidden = true` sees "Results temporarily hidden by admin" in place of the vote count breakout; the same user on a suggestion with `results_hidden = false` sees the normal count bars
  4. The Playwright E2E spec (TEST-13) passes end-to-end: admin creates a poll, a test vote is cast, admin hides results, the voter UI shows the hidden message, admin shows results, the voter UI shows count bars again
  5. ESLint and `tsc -b` pass with zero errors after the 4 native-button replacements in `SearchBar.tsx`, `SuggestionForm.tsx` (×2), and `ImageInput.tsx`; `type="submit"` is preserved where applicable; no existing form-submission behavior regresses

**Plans**: TBD
**UI hint**: yes

---

### Phase 13: UIDN-02 Mobile Audit Closure
**Goal**: The Lighthouse mobile audit runs cleanly against v1.2 production (no F6 hydration-wait warnings, authenticated screenshots captured), and the `Mobile-first responsive design` Key Decision row flips ⚠️ → ✓ if Performance ≥ 90 on all 5 routes
**Depends on**: Phase 12 (v1.2 production deploy must be live before Lighthouse scores are meaningful)
**Requirements**: UIDN-02

**Success Criteria** (what must be TRUE):
  1. `audit-screenshots.mjs` runs without F6 DOM-assertion warnings: `waitForLoadState('networkidle')` (or equivalent hydration wait) is applied before screenshot capture; the byte-identical unauthenticated PNG defect is resolved
  2. Authenticated Pass-A screenshots are captured for `/topics` and `/archive` using the existing `loginAs` helper from `e2e/helpers/auth.ts`; the screenshot corpus includes both authenticated and unauthenticated state for all audited routes
  3. Lighthouse mobile audit produces a score for all 5 routes; results are archived in `.planning/closure/UIDN-02-mobile-evidence.md` (v1.2 rerun section) with the raw numeric scores recorded
  4. The `Mobile-first responsive design` Key Decision row in `PROJECT.md` is flipped from ⚠️ Revisit to ✓ Good if Performance ≥ 90 on all 5 routes; if any route scores below 90, the evidence file documents the delta with rationale and the row remains ⚠️ with a follow-up note

**Plans**: TBD
**UI hint**: no

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 11. Schema + RLS + EF Foundations | 0/7 | Planned | - |
| 12. Admin UI + User UI + UIDN-03 Sweep | 0/? | Not started | - |
| 13. UIDN-02 Mobile Audit Closure | 0/? | Not started | - |

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 | 1–6 | 32/32 | ✅ Shipped | 2026-04-28 |
| v1.1 | 7–10 | 16/16 | ✅ Shipped | 2026-05-11 |
| v1.2 | 11–13 | 0/? | 🔄 In progress | - |
</content>
</invoke>
