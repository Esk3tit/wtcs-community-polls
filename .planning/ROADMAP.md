# Roadmap: WTCS Community Polls

## Overview

This roadmap delivers a Discord-authenticated community suggestion and opinion-gathering platform for the War Thunder Competitive Scene. The dependency chain is rigid: database schema and auth must exist before any reads, reads before writes, response integrity before public launch, and admin tools before the platform is self-service. Each phase delivers a vertically complete capability that can be verified independently, building toward a platform where community members share opinions on competitive scene proposals with confidence that results are authentic.

**Terminology note:** Internal/code terminology (polls, votes) used in phase names and REQ-IDs for code alignment. User-facing descriptions use suggestion/topic/response/opinion per the Design System Brief (`.planning/DESIGN-SYSTEM.md`).

## Milestones

- ✅ **v1.0 — Launch-Ready MVP** — Phases 1–6 (shipped 2026-04-28) — see [MILESTONES.md](MILESTONES.md) and [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 📋 **v1.1 — Hygiene & Polish (current)** — Phases 7–10 (planning 2026-04-28) — see [GitHub milestone v1.1](https://github.com/Esk3tit/wtcs-community-polls/milestone/1)

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

<details open>
<summary>📋 <strong>v1.1 — Hygiene & Polish (Phases 7–10) — PLANNING 2026-04-28</strong></summary>

- [ ] **Phase 7: Observability Hardening** — Wire Sentry React 19 error hooks into `createRoot` and preserve function names in production sourcemaps; one Netlify deploy-preview smoke verifies both fixes
- [ ] **Phase 8: E2E Test Hygiene** — Scope all shared-DB list locators to `[E2E]`-prefixed entries (E2E-SCOPE-1), enforce via ESLint, extract `freshPoll` Playwright fixture, and run Phase 03 UAT tests 2+3 with a second human
- [ ] **Phase 9: UI Closure Evidence** — Reconcile shadcn style canonicality (UIDN-04 ADR) before running mobile Lighthouse + 6-width breakpoint matrix (UIDN-02) and 12-item per-route shadcn checklist (UIDN-03); flips two ⚠️ Revisit Key Decisions to ✓ Good
- [ ] **Phase 10: Planning Hygiene Backfill** — Pure planning-doc edits across `.planning/phases/01..04/`: VALIDATION.md frontmatter, Phase 03 VERIFICATION.md retrospective, 17 SUMMARY `requirements-completed` declarations, and Phase 04 UAT 6a evidence — zero code changes, parallelizable with Phases 7–9

</details>

## Phase Details

### Phase 7: Observability Hardening
**Goal**: Production Sentry receives every render-phase React error with un-mangled, human-readable stack frames so launch-time error triage is reliable.
**Depends on**: Nothing (config/wiring localized to `src/main.tsx` + `vite.config.ts`)
**Requirements**: OBSV-01, OBSV-02
**Success Criteria** (what must be TRUE):
  1. A render-phase throw triggered on a Netlify deploy preview (e.g. `?sentry-render-smoke=1`) produces a Sentry event with both the React `componentStack` populated and `error.value` present (proves OBSV-01 capture path).
  2. The same deploy-preview Sentry event's top stack frames show original function/component names (e.g. `App`, `MyButton`) rather than `xR`/`$M`-style mangled identifiers (proves OBSV-02 symbolication).
  3. The built `dist/assets/*.js.map` contains entries in `names[]` for kept identifiers and the corresponding chunks contain `__name(…)` annotation calls (mechanical evidence that `keepNames: true` took effect).
  4. Bundle-size delta from enabling `keepNames` is documented (≤1.5% gzip target) so the cost is recorded against the observability gain.
  5. Verification is performed on a Netlify deploy preview — dev server / Vitest are explicitly insufficient (StrictMode masks render-phase capture; minifier doesn't run).
**Plans**: 3 plans
- [x] 07-01-PLAN.md — Wire React 19 createRoot error hooks + Rolldown keepNames + Netlify VITE_NETLIFY_CONTEXT (Wave 1, autonomous)
- [ ] 07-02-PLAN.md — Create env-gated /__smoke route + RenderThrowSmoke render-phase canary (Wave 2, autonomous, depends on 07-01)
- [ ] 07-03-PLAN.md — Capture D-08 manual deploy-preview evidence + write 07-VERIFICATION.md + .planning/closure/OBSV-02-bundle-delta.md (Wave 3, has human-action checkpoint, depends on 07-01 + 07-02)
**Branch**: `gsd/phase-07-observability-hardening`

### Phase 8: E2E Test Hygiene
**Goal**: Playwright E2E suite is honest under the canonical two-layer seed — every shared-DB list locator is `[E2E]`-scoped, the convention is lint-enforced, per-test mutable state lives in a fixture, and the two second-human-gated Phase 03 UAT cases have evidence on file.
**Depends on**: Nothing (test-only changes plus one second-human session)
**Requirements**: TEST-07, TEST-08, TEST-09, TEST-10
**Success Criteria** (what must be TRUE):
  1. The three previously-failing Playwright specs (`admin-create.spec.ts`, `browse-respond.spec.ts`, `filter-search.spec.ts`) pass green against the canonical two-layer seed in CI, with their list locators filtered via `Locator.filter({ hasText: /^\[E2E/ })`.
  2. An ESLint `no-restricted-syntax` rule fails the build when an `e2e/tests/**/*.spec.ts` file calls `page.locator(...).all()` / `.nth(n)` / `.first()` on a shared-DB list without a preceding `.filter({ hasText: /^\[E2E/ })`; the rule is documented in `e2e/README.md` (E2E-SCOPE-1).
  3. A Playwright test-scoped `freshPoll` fixture exists, provides per-test mutable poll/vote state via `await use(...)`, and cleans up after itself; at least one spec consumes it as proof of contract.
  4. Phase 03 UAT tests 2 (Non-Member Login Rejection) and 3 (Error Page Invite Link) have second-human evidence appended to `.planning/phases/03-response-integrity/03-UAT.md` with timestamp, executor handle, and pass/fail per case.
**Plans**: TBD
**Branch**: `gsd/phase-08-e2e-test-hygiene`

### Phase 9: UI Closure Evidence
**Goal**: UIDN-02 (mobile-first responsive) and UIDN-03 (shadcn Maia/Neutral polish) carry-forward debt is closed with archived evidence so PROJECT.md Key Decisions flip from ⚠️ Revisit → ✓ Good — but only after the shadcn style canonicality discrepancy (UIDN-04) is reconciled in writing.
**Depends on**: Nothing externally; intra-phase ordering is **UIDN-04 → UIDN-02 (parallel) → UIDN-03**
**Requirements**: UIDN-04, UIDN-02, UIDN-03
**Success Criteria** (what must be TRUE):
  1. The shadcn style discrepancy between `components.json` (`"new-york"`) and `DESIGN-SYSTEM.md` / PROJECT.md Constraints (`"Maia"`) is reconciled: the two losing surfaces are updated to match the winner, and an ADR-style note documenting the decision and reasoning is appended to `DESIGN-SYSTEM.md` **before** the UIDN-03 audit checklist runs (UIDN-04 must complete first because UIDN-03 references the canonical preset).
  2. `.planning/closure/UIDN-02-mobile-evidence.md` exists and contains a Lighthouse mobile audit per top-level route hitting Perf≥90 / A11y≥95 / BP≥95 / SEO≥90, plus a 6-width screenshot matrix (320/375/414/768/1024/1440 px) with artifacts archived under `.planning/closure/artifacts/`.
  3. `.planning/closure/UIDN-03-shadcn-audit.md` exists and contains the 12-item per-route consistency checklist (token usage, Button variants, spacing scale, etc.) applied across all top-level routes, with the canonical preset (per UIDN-04 ADR) cited as the audit baseline.
  4. PROJECT.md Key Decisions table is updated: `Mobile-first responsive design` flips from ⚠️ Revisit → ✓ Good (citing UIDN-02 evidence) and `shadcn/ui + Tailwind CSS v4 (Maia/Neutral)` flips from ⚠️ Revisit → ✓ Good (citing UIDN-03 evidence + UIDN-04 ADR).
  5. No shadcn component restyle ships in this phase — UIDN-04 is documentation reconciliation only (scope guard against creeping a preset migration into v1.1).
**Plans**: TBD
**Branch**: `gsd/phase-09-ui-closure-evidence`
**UI hint**: yes

### Phase 10: Planning Hygiene Backfill
**Goal**: All v1.0 phase directories (01–04) are brought up to the post-Phase-05 planning-artifact schema so the project is audit-clean against its own conventions before v1.2 feature work begins. **Zero code changes** — every plan is a file edit under `.planning/phases/01..04/`.
**Depends on**: Nothing (no code, no tests, no infra; can run fully in parallel with Phases 7–9)
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04
**Success Criteria** (what must be TRUE):
  1. `.planning/phases/0[1-4]-*/0[1-4]-VALIDATION.md` files all carry the post-Phase-05 frontmatter schema used in 05/06 (status, nyquist_compliant, requirements-validated, etc.) — no `status: draft` / `nyquist_compliant: false` stragglers.
  2. `.planning/phases/03-response-integrity/03-VERIFICATION.md` exists as a retrospective closure record consistent in structure with phases 01/02/04/05/06 VERIFICATION.md files.
  3. The 17 SUMMARY files flagged by `.planning/milestones/v1.0-MILESTONE-AUDIT.md` (under phases 02, 03-02, 04-02/04-04, 01-04) all declare a `requirements-completed:` array in their frontmatter that maps to v1.0 REQ-IDs.
  4. `.planning/phases/04-admin-panel-suggestion-management/04-UAT.md` is updated to record Phase 04 UAT test 6a (demote click flow) as passed, citing the off-record execution on the second admin (Discord ID 290377966251409410 / MapCommittee) during the v1.0 → v1.1 transition.
  5. Re-running the v1.0 milestone audit script against `.planning/phases/01..04/` reports zero outstanding planning-artifact gaps from the original audit's "tech debt → v1.1" list.
**Plans**: TBD
**Branch**: `gsd/phase-10-planning-hygiene-backfill`

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 | 1–6 | 32/32 | ✅ Shipped | 2026-04-28 |
| v1.1 | 7–10 | 0/TBD | 📋 Planned | — |
