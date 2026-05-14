# Roadmap: WTCS Community Polls

## Overview

This roadmap delivers a Discord-authenticated community suggestion and opinion-gathering platform for the War Thunder Competitive Scene. The dependency chain is rigid: database schema and auth must exist before any reads, reads before writes, response integrity before public launch, and admin tools before the platform is self-service. Each phase delivers a vertically complete capability that can be verified independently, building toward a platform where community members share opinions on competitive scene proposals with confidence that results are authentic.

**Terminology note:** Internal/code terminology (polls, votes) used in phase names and REQ-IDs for code alignment. User-facing descriptions use suggestion/topic/response/opinion per the Design System Brief (`.planning/DESIGN-SYSTEM.md`).

## Milestones

- ✅ **v1.0 — Launch-Ready MVP** — Phases 1–6 (shipped 2026-04-28) — see [MILESTONES.md](MILESTONES.md) and [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 — Hygiene & Polish** — Phases 7–10 (shipped 2026-05-11) — see [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) and [GitHub milestone v1.1](https://github.com/Esk3tit/wtcs-community-polls/milestone/1)
- ✅ **v1.2 — Admin Visibility Controls** — Phases 11–13 (shipped 2026-05-14) — see [MILESTONES.md](MILESTONES.md) and [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- 📋 **v1.3 — TBD** — awaiting `/gsd-new-milestone` scoping

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

### 📋 v1.3 — TBD

- Awaiting `/gsd-new-milestone` scoping. Likely candidates from v1.2 carry-forward: UIDN-02 perf-budget revisit, UIDN-03-FOLLOWUP-LIST-CARDS, 7 pre-Phase-11 SECURITY DEFINER advisor warnings, local supabase-edge-runtime ES256 verification bug, PATTERNS.md drift cleanup.

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 | 1–6 | 32/32 | ✅ Shipped | 2026-04-28 |
| v1.1 | 7–10 | 16/16 | ✅ Shipped | 2026-05-11 |
| v1.2 | 11–13 | 17/17 | ✅ Shipped | 2026-05-14 |
| v1.3 | TBD | — | 📋 Planned | — |
