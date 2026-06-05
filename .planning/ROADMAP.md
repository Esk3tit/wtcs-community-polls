# Roadmap: WTCS Community Polls

## Overview

This roadmap delivers a Discord-authenticated community suggestion and opinion-gathering platform for the War Thunder Competitive Scene. The dependency chain is rigid: database schema and auth must exist before any reads, reads before writes, response integrity before public launch, and admin tools before the platform is self-service. Each phase delivers a vertically complete capability that can be verified independently, building toward a platform where community members share opinions on competitive scene proposals with confidence that results are authentic.

**Terminology note:** Internal/code terminology (polls, votes) used in phase names and REQ-IDs for code alignment. User-facing descriptions use suggestion/topic/response/opinion per the Design System Brief (`.planning/DESIGN-SYSTEM.md`).

## Milestones

- ✅ **v1.0 — Launch-Ready MVP** — Phases 1–6 (shipped 2026-04-28) — see [MILESTONES.md](MILESTONES.md) and [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 — Hygiene & Polish** — Phases 7–10 (shipped 2026-05-11) — see [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) and [GitHub milestone v1.1](https://github.com/Esk3tit/wtcs-community-polls/milestone/1)
- ✅ **v1.2 — Admin Visibility Controls** — Phases 11–13 (shipped 2026-05-14) — see [MILESTONES.md](MILESTONES.md) and [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 — Hygiene & Performance** — Phases 14–17 (shipped 2026-05-31) — see [MILESTONES.md](MILESTONES.md) and [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- 🚧 **v1.4 — Final Closeout** — Phases 18–21 (in progress)

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

<details>
<summary>✅ <strong>v1.2 — Admin Visibility Controls (Phases 11–13) — SHIPPED 2026-05-14</strong></summary>

- [x] **Phase 11: Schema + RLS + EF Foundations** (7/7 plans) — Migration 10 (`polls.results_hidden` + `results_hidden_changed_at`, `audit_log` table with TEXT `target_id`, `polls_effective` rewrite, `vote_counts` policy DROP+CREATE), shared `writeAudit` helper, race-safe `toggle-results-visibility` EF, 12 existing admin EFs retrofitted, 12-cell RLS invariant suite (TEST-11), toggle EF authz suite (TEST-12), all deployed to prod (PR #26 merged 2026-05-11)
- [x] **Phase 12: Admin UI + User UI + UIDN-03 Sweep** (8/8 plans) — Vendored shadcn Checkbox + Switch, regenerated types, VIS-06 admin Checkbox, VIS-07 inline admin Switch with optimistic + revert-on-error + sonner toast, VIS-08 voter "hidden by admin" placeholder, UIDN-03 4-site native-`<button>` sweep (SearchBar + 2× SuggestionForm + ImageInput `<DropZone>` extraction), TEST-13 Playwright `@smoke` SC4 round-trip (PR #28 merged 2026-05-12)
- [x] **Phase 13: UIDN-02 Mobile Audit Closure** (2/2 plans) — `audit-screenshots.mjs` hydration-wait fix (Phase 9 Plan 02 defect closed): deterministic Navbar theme-toggle sentinel + two-context Pass-B (admin + member) + sha256 uniqueness gate with D-19 home↔admin whitelist + 42-PNG clean corpus; Lighthouse v1.2 rerun outcome **DEFER** (4/5 routes Perf < 90 — perf-only; A11y/BP/SEO clear); Mobile-first row stays ⚠️ Revisit per D-12 (next perf-budget change). 4 rounds of bot-review fix passes resolved 15/15 threads (PR #29 merged 2026-05-14)

Full v1.2 phase details (goals, plans, decisions, wave structure, success criteria) preserved in [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md).

</details>

<details>
<summary>✅ <strong>v1.3 — Hygiene & Performance (Phases 14–17) — SHIPPED 2026-05-31</strong></summary>

- [x] **Phase 14: Security-Definer Search-Path Migration** (1/1 plan) — Migration 14 hardens the 6 user-owned pre-Phase-11 `SECURITY DEFINER` functions with `SET search_path = ''` (rls_auto_enable carved out as Supabase-managed); drops the stale 3-param `update_profile_after_auth` overload; zero `0011` advisor WARNs post-deploy; prod smoke vote PASS; `is_current_user_admin` body-identical diff exit 0; SQL regression fixture (6 PASS / 0 FAIL).
- [x] **Phase 15: Observability + E2E Verify & Close** (5/5 plans) — `/__smoke?fire=render|dedupe` harness + `boundary: app-root` invariant; `verify-sourcemap-names.mjs` `keepNames` regression guard wired into CI; operator evidence capture; PR #35 auto-closed GitHub issues #11/#12/#13/#17/#19. Shipped 2026-05-25.
- [x] **Phase 16: UIDN-02 Aggressive Perf-Budget Pass** (7/7 plans) — Bundle audit → PostHog consent-gated lazy-load (~187 KB off critical path) → `manualChunks` → WebP logo → `defaultPreload: 'intent'`; single Lighthouse mobile rerun PASS 5/5 routes ≥ 90 → UIDN-02 closed, Mobile-first Key Decision flipped ⚠️ → ✓.
- [x] **Phase 17: Planning-Doc + UI Hygiene Sweep** (2/2 plans) — VALIDATION frontmatter audit (01–04); Phase 03 VERIFICATION retrospective naming Migration 14; 15 SUMMARY `requirements-completed` declarations; v1.1 MILESTONES.md entry; `AdminsList` / `CategoriesList` / `PromoteAdminDialog` → shadcn `Card` with Dialog ARIA intact; 401 tests green.

Full v1.3 phase details (goals, plans, success criteria, wave structure) preserved in [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md).

</details>

### 🚧 v1.4 — Final Closeout (In Progress)

**Milestone Goal:** Close every outstanding v1 carry-forward — local test-environment repairs, live human UAT, code/migration debt, and test-completeness gaps — so nothing carries past v1.4. Hard debt-zero mandate: no `tech_debt`/DEFER exits.

- [x] **Phase 18: Test-Environment Repair** - Fix the two broken local test harnesses (ES256 edge-runtime bug, gotrue email config) and implement the deferred fault-injection test
- [x] **Phase 19: DB Migration + A11y Restore** - Replace the undistinguishing `profile_self_update_allowed` gate with a session-GUC trusted-context flag and restore two `<h2>` semantic headings
- [x] **Phase 20: Live Human UAT** - Execute Phase 03 UAT tests 2+3 (non-member tester) and Phase 04 UAT 6a (second-admin demote) live with required accounts (closed by accepting the pre-existing live evidence; see 03/04-UAT.md closure sections — no fresh run this milestone)
- [ ] **Phase 21: Dependency Hygiene** - Review, validate, and merge dependabot PRs #40 (15-package group) and #34 (lint-staged 16→17)

## Phase Details

<details>
<summary>✅ <strong>v1.0 — Launch-Ready MVP (Phases 1–6) — SHIPPED 2026-04-28</strong></summary>

Full phase details preserved in [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

</details>

<details>
<summary>✅ <strong>v1.1 — Hygiene & Polish (Phases 7–10) — SHIPPED 2026-05-11</strong></summary>

Full phase details preserved in [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).

</details>

<details>
<summary>✅ <strong>v1.2 — Admin Visibility Controls (Phases 11–13) — SHIPPED 2026-05-14</strong></summary>

Full phase details preserved in [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md).

</details>

<details>
<summary>✅ <strong>v1.3 — Hygiene & Performance (Phases 14–17) — SHIPPED 2026-05-31</strong></summary>

Full phase details (goals, requirement summaries, success criteria, plans, wave structure) preserved in [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md).

</details>

### Phase 18: Test-Environment Repair

**Goal**: All local test harnesses run green — the ES256 edge-runtime bug is patched, the TEST-11 RLS vitest matrix executes (12 PASS / 0 FAIL), and the deferred fault-injection test path is implemented and covered
**Depends on**: Phase 17 (v1.3 complete)
**Requirements**: TEST-17, TEST-18, TEST-19
**Success Criteria** (what must be TRUE):

  1. `npm run test:integration` completes with 0 skips and 0 failures on the local stack after the edge-runtime upgrade/pin (TEST-17)
  2. The TEST-11 12-cell RLS invariant vitest matrix runs 12 PASS / 0 FAIL locally and in CI — no xfail, no skip — after the gotrue email_provider_disabled config is resolved (TEST-18)
  3. The fault-injection branch in `e2e/integration/create-poll-results-hidden.test.ts` (post-RPC UPDATE failure path, previously a comment-only deferral at ~line 156) is implemented as an executable test case and passes green (TEST-19)

**Plans**: 3 plans
Plans:

- [x] 18-01-PLAN.md — Add `[auth.email]` section to config.toml; fix gotrue email_provider_disabled (TEST-18)
- [x] 18-02-PLAN.md — Bump Supabase CLI version pin in ci.yml to resolve ES256 edge-runtime bug (TEST-17)
- [x] 18-03-PLAN.md — Implement fault-injection DDL in seed.sql + two new test cases in create-poll-results-hidden.test.ts (TEST-19)

### Phase 19: DB Migration + A11y Restore

**Goal**: The `profile_self_update_allowed` security gate correctly distinguishes RPC-mediated updates from direct client updates via a session-GUC trusted-context flag, and the two semantic `<h2>` headings are restored without regressing the shadcn Card structure
**Depends on**: Phase 18 (repaired TEST-11 matrix available as validator for DBHY-05 regression coverage)
**Requirements**: DBHY-05, UIDN-06
**Success Criteria** (what must be TRUE):

  1. A new migration ships that replaces the `current_user = session_user` gate in `profile_self_update_allowed` with a session-GUC flag set by `update_profile_after_auth` — the protected-column branch is proven reachable and correct via a regression test (not left as suspected dead code) (DBHY-05)
  2. The migration deploys to production with zero new Supabase advisor WARNs and the existing `submit-vote` smoke round-trip remains PASS (DBHY-05)
  3. The two `<h2>` headings in `AdminsList` and `CategoriesList` (demoted to `CardTitle` `<div>` during Phase 17) are restored to semantic heading elements, verified by an accessibility assertion (role or axe query), with the shadcn `<Card>` structure intact (UIDN-06)

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 19-01-PLAN.md — Write Migration 15 SQL + integration test for DBHY-05 gate paths (DBHY-05)
- [x] 19-02-PLAN.md — Add CardTitle asChild polymorphism + restore <h2> call sites + update test comments (UIDN-06)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 19-03-PLAN.md — [BLOCKING] supabase db push + advisor lint + integration test green + smoke verify (DBHY-05)

### Phase 20: Live Human UAT

**Goal**: The operator has executed both second-human-gated UAT scenarios live — non-member server-gate rejection (Phase 03 tests 2+3) and second-admin demote flow (Phase 04 test 6a) — and recorded concrete evidence in the respective UAT files
**Depends on**: Phase 19 (code-stable state before live testing)
**Requirements**: UAT-01, UAT-02
**Success Criteria** (what must be TRUE):

  1. Phase 03 UAT tests 2 and 3 are executed live with a 2FA-on, non-WTCS-member Discord account; the server-side membership gate correctly blocks the non-member; evidence (screenshot or screen-recording reference + pass/fail verdict) is recorded in `03-UAT.md` § Second-Human Verification (UAT-01)
  2. Phase 04 UAT test 6a (demote-click flow) is executed live with a real second admin account; the demote action succeeds and the self-demote guard remains intact; evidence is recorded in `04-UAT.md` (UAT-02)
  3. Both UAT files show no remaining "pending" or "deferred" scenarios after the evidence is recorded
  4. *(Phase 20 closure note)* UAT-01 and UAT-02 are closed by accepting the pre-existing live PASS evidence per D-01/D-02 (UAT-01: 2026-05-03 second-human run; UAT-02: MapCommittee Off-Record 6a PASS during the v1.0→v1.1 transition) with the gate path verified unchanged — no fresh live runs were performed this milestone.

**Plans**: 3 plans
Plans:
**Wave 1** *(both plans are independent — run in parallel)*

- [x] 20-01-PLAN.md — Record D-03 acceptance basis in 03-UAT.md and reconcile skipped: 2 rollup (UAT-01)
- [x] 20-02-PLAN.md — Formalize Off-Record Verification PASS in 04-UAT.md and clear deferred: 1 rollup (UAT-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 20-03-PLAN.md — Flip UAT-01/02 to Validated in REQUIREMENTS.md (rewrite the global "this milestone" framing per D-01/D-02) + ROADMAP closure annotations

### Phase 21: Dependency Hygiene

**Goal**: Both open dependabot PRs are reviewed, validated against breaking-change notes, CI-green, and merged — closing the door on lingering dependency-update debt for the final v1 milestone
**Depends on**: Phase 18 (CI green and test suite healthy before merging dependency bumps)
**Requirements**: DEP-01, DEP-02
**Success Criteria** (what must be TRUE):

  1. Dependabot PR #40 (minor-and-patch group, 15 packages) is merged with lint + typecheck + unit + E2E all green; no build-pipeline regressions (DEP-01)
  2. Dependabot PR #34 (lint-staged 16→17) is merged after the `lint-staged` config is validated against v17 breaking changes; pre-commit hook runs correctly post-merge (DEP-02)
  3. No open dependabot PRs remain for the v1 carry-forward list after both merges

**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 14. Security-Definer Search-Path Migration | 1/1 | Complete | 2026-05-17 |
| 15. Observability + E2E Verify & Close | 5/5 | Shipped | 2026-05-25 |
| 16. UIDN-02 Aggressive Perf-Budget Pass | 7/7 | Complete    | 2026-05-29 |
| 17. Planning-Doc + UI Hygiene Sweep | 2/2 | Complete    | 2026-05-30 |
| 18. Test-Environment Repair | 3/3 | Complete    | 2026-06-02 |
| 19. DB Migration + A11y Restore | 3/3 | Complete    | 2026-06-03 |
| 20. Live Human UAT | 3/3 | Complete   | 2026-06-05 |
| 21. Dependency Hygiene | 0/TBD | Not started | - |

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 | 1–6 | 32/32 | ✅ Shipped | 2026-04-28 |
| v1.1 | 7–10 | 16/16 | ✅ Shipped | 2026-05-11 |
| v1.2 | 11–13 | 17/17 | ✅ Shipped | 2026-05-14 |
| v1.3 | 14–17 | 15/15 | ✅ Shipped | 2026-05-31 |
| v1.4 | 18–21 | 0/TBD | 🚧 In progress | - |
