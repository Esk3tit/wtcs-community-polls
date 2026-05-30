# Roadmap: WTCS Community Polls

## Overview

This roadmap delivers a Discord-authenticated community suggestion and opinion-gathering platform for the War Thunder Competitive Scene. The dependency chain is rigid: database schema and auth must exist before any reads, reads before writes, response integrity before public launch, and admin tools before the platform is self-service. Each phase delivers a vertically complete capability that can be verified independently, building toward a platform where community members share opinions on competitive scene proposals with confidence that results are authentic.

**Terminology note:** Internal/code terminology (polls, votes) used in phase names and REQ-IDs for code alignment. User-facing descriptions use suggestion/topic/response/opinion per the Design System Brief (`.planning/DESIGN-SYSTEM.md`).

## Milestones

- ✅ **v1.0 — Launch-Ready MVP** — Phases 1–6 (shipped 2026-04-28) — see [MILESTONES.md](MILESTONES.md) and [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 — Hygiene & Polish** — Phases 7–10 (shipped 2026-05-11) — see [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) and [GitHub milestone v1.1](https://github.com/Esk3tit/wtcs-community-polls/milestone/1)
- ✅ **v1.2 — Admin Visibility Controls** — Phases 11–13 (shipped 2026-05-14) — see [MILESTONES.md](MILESTONES.md) and [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- 🔄 **v1.3 — Hygiene & Performance** — Phases 14–17 (in progress)

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

### v1.3 — Hygiene & Performance (Phases 14–17)

- [x] **Phase 14: Security-Definer Search-Path Migration** (1/1 plan) — Migration 14 hardens the 6 user-owned pre-Phase-11 `SECURITY DEFINER` functions with `SET search_path = ''` (rls_auto_enable carved out per W0 finding as Supabase-managed); unconditionally drops stale 3-param `update_profile_after_auth` overload; `supabase db lint --linked` shows zero `0011` WARNs post-deploy; smoke vote round-trip on polls.wtcsmapban.com PASS. is_current_user_admin body-identical diff PASS via machine-enforced pre-vs-post pg_get_functiondef compare. Direct SQL regression fixture added for is_current_user_admin (4 identity branches + 2 audit_log RLS branches).
- [x] **Phase 15: Observability + E2E Verify & Close** (5/5 plans) — Smoke harness landed at `/__smoke?fire=render|dedupe` with local `Sentry.ErrorBoundary` + `beforeCapture` `boundary: app-root` invariant (Plan 01); `scripts/verify-sourcemap-names.mjs` zero-dep build-time `keepNames: true` regression guard + CI `lint-and-unit` wiring (Plans 02, 03); operator-driven evidence capture: 4 Sentry PNGs + 3 CI PASS PNGs + `15-EVIDENCE.md` (Plan 04 — sentry-cli output captured via v3 `releases info` after plan-defect deviation documented; Discover unavailable on free plan, per-issue Events filter fallback used); merge PR #35 auto-closed all 5 GitHub issues #11, #12, #13, #17, #19 with per-issue evidence-anchor closure comments (Plan 05). Shipped 2026-05-25.
- [ ] **Phase 16: UIDN-02 Aggressive Perf-Budget Pass** - Bundle audit → PostHog lazy-load (~180–200 KB off critical path) → `manualChunks` → WebP logo → `defaultPreload: 'intent'` → single Lighthouse mobile rerun; accept PASS-or-DEFER per D-12
- [ ] **Phase 17: Planning-Doc + UI Hygiene Sweep** - VALIDATION.md frontmatter backfill phases 01–04; Phase 03 VERIFICATION.md retrospective; 17 SUMMARY `requirements-completed` declarations; v1.1 MILESTONES.md entry (HARD REQ); `AdminsList` / `CategoriesList` / `PromoteAdminDialog` → shadcn `Card`

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

---

### Phase 14: Security-Definer Search-Path Migration

**Goal**: All 7 pre-Phase-11 `SECURITY DEFINER` Postgres functions have `SET search_path = ''` and fully-qualified body references, Supabase advisor reports zero `0011_function_search_path_mutable` WARNs, and `submit-vote` continues to work end-to-end after the migration
**Depends on**: Phase 13 (v1.2 shipped)
**Risk**: HIGH — `increment_vote_count` body has `INSERT INTO vote_counts` (bare, not `public.vote_counts`) which 42P01-errors on every vote submission under `search_path = ''`; `is_current_user_admin()` gates all admin RLS policies across 7+ tables and must receive a body-identical rewrite (only the `search_path` value changes from `public` to `''`)
**Requirements**: DBHY-01, DBHY-02, DBHY-03, DBHY-04

**Requirement summaries:**

- DBHY-01: `supabase/migrations/00000000000014_security_definer_search_path.sql` using `CREATE OR REPLACE FUNCTION` (not `ALTER FUNCTION`) for all 7 functions (`update_profile_after_auth`, `handle_new_user`, `validate_vote_choice`, `increment_vote_count`, `is_current_user_admin`, `profile_self_update_allowed`, `rls_auto_enable`) with `SET search_path = ''` and fully-qualified body references. `increment_vote_count`: `INSERT INTO vote_counts` → `INSERT INTO public.vote_counts`. `is_current_user_admin`: body-identical rewrite, search_path value only.
- DBHY-02: `supabase db lint --linked` (CLI 2.98.2+) reports zero `0011_function_search_path_mutable` advisor WARNs after Migration 14 applies to production.
- DBHY-03: `submit-vote` smoke round-trip passes after Migration 14 deploys to production. Parallel TEST-11 12-cell RLS matrix re-run confirms `is_current_user_admin()` body rewrite did not drift admin RLS behavior.
- DBHY-04: `.planning/phases/11-*/11-PATTERNS.md` `vote_counts` policy skeleton aligned with shipped REVIEW-FIX-H3 form (service-role-only bypass; no admin OR-branch). Doc-only fix — no code change required.

**Success Criteria** (what must be TRUE):

  1. `supabase db lint --linked` output (or Supabase dashboard advisor) shows zero `0011_function_search_path_mutable` WARNs — all 7 target functions clear
  2. A `submit-vote` round-trip on production after Migration 14 deploys succeeds: vote row is inserted, the `increment_vote_count` trigger fires without error, and the corresponding `vote_counts` row is incremented correctly
  3. The TEST-11 12-cell RLS matrix re-run passes with zero regressions — admin-gated cells return rows for admin callers, voter-only cells gate correctly — confirming `is_current_user_admin()` body rewrite preserved identical semantics
  4. `supabase/migrations/00000000000014_security_definer_search_path.sql` exists in the repository, uses `CREATE OR REPLACE FUNCTION` for every modified function, and local `supabase db reset` applies all 14 migrations cleanly

**Plans**: 1 plan
Plans:

- [x] 14-01-PLAN.md — Migration 14 shipped: 6-function SECURITY DEFINER hardening (rls_auto_enable carved out as Supabase-managed per W0), stale 3-param `update_profile_after_auth` overload dropped (Cycle-3 Option A), DBHY-04 `11-PATTERNS.md` prose fix shipped, local/prod lint clean, TEST-11 deferred to v1.4+ (local gotrue `email_provider_disabled`); replaced by Task 07b direct SQL regression fixture (psql exit 0, 6 PASS / 0 FAIL on 4 identity branches + 2 audit_log RLS branches), production smoke vote on polls.wtcsmapban.com PASS

**UI hint**: no

---

### Phase 15: Observability + E2E Verify & Close

**Goal**: GitHub issues #17 (Sentry React 19 ErrorBoundary render-phase capture) and #19 (Rolldown sourcemap function names) are confirmed fixed via smoke verification on a Netlify deploy preview, Playwright specs for issues #11/#12/#13 pass in CI — all five GitHub issues closed
**Depends on**: Phase 14
**Risk**: LOW — no schema changes, no production mutations; all underlying code fixes already committed to `main`; this phase is evidence capture and issue closure only
**Requirements**: OBSV-03, OBSV-04, OBSV-05, TEST-14, TEST-15, TEST-16

**Requirement summaries:**

- OBSV-03: Sentry React 19 ErrorBoundary render-phase throw smoke-verified on Netlify deploy preview. Trigger render-phase throw via `?debug=sentry-test` overlay; confirm Sentry dashboard receives event with `boundary: app-root` tag and real stack frame names present. Close GitHub issue #17.
- OBSV-04: Vite/Rolldown sourcemap function-name preservation verified end-to-end: (a) run `verify-sourcemap-names.mjs` confirming production build emits literal `function Name(...)` declarations; (b) confirm Sentry Artifacts API shows uploaded source maps for current release; (c) inspect smoke-test Sentry event stack frames and confirm real function names, not minified `$M`. Close GitHub issue #19.
- OBSV-05: `Sentry.dedupeIntegration()` behavior smoke-verified — triple-handler path (`createRoot.onCaughtError` + `ErrorBoundary.onError` + auto-capture) collapses to one event per error; verification uses DISTINCT error messages per scenario to prevent Dedupe masking the second event; `Sentry.lastEventId()` confirms capture independent of transport flush.
- TEST-14: `e2e/tests/admin-create.spec.ts` passes in CI on `main`. Confirms committed Yes/No preset click fix resolves the "doesn't populate Choice 1/2" issue. Close GitHub issue #11.
- TEST-15: `e2e/tests/browse-respond.spec.ts` passes in CI on `main`. Confirms committed `freshPoll` fixture + `[1-9]\d*` non-zero regex resolves the "asserts vote count on zero-vote fixtures" issue. Close GitHub issue #12.
- TEST-16: `e2e/tests/filter-search.spec.ts` passes in CI on `main`. Confirms committed `E2E_TITLE` prefix filter on `toHaveCount()` resolves the "two-layer seed count" issue. Close GitHub issue #13.

**Success Criteria** (what must be TRUE):

  1. Sentry dashboard (on the deploy-preview release) shows a captured event with `boundary: app-root` tag triggered by a render-phase throw via the debug overlay — confirming `reactErrorHandler` + `onCaughtError` path works under React 19
  2. A Sentry event's stack frames show real function names (e.g., `ConsentProvider`, `AuthGate`) rather than minified identifiers like `$M` — confirming `keepNames: true` + sourcemap upload works end-to-end
  3. `npm run test:e2e` (or equivalent CI invocation) exits 0 with `admin-create.spec.ts`, `browse-respond.spec.ts`, and `filter-search.spec.ts` all reporting PASSED — no skips, no failures on these three specs
  4. GitHub issues #11, #12, #13, #17, and #19 are all in Closed state on the repository

**Plans**: 5 plans
Plans:

- [x] 15-01-PLAN.md — Smoke harness extension to /__smoke route (two distinct render-phase throw triggers + local Sentry.ErrorBoundary + dataset.sentryEventId surface)
- [x] 15-02-PLAN.md — scripts/verify-sourcemap-names.mjs (zero-dep Node ESM allowlist guard for keepNames: true; 7-name allowlist)
- [x] 15-03-PLAN.md — Wire verify-sourcemap-names into CI lint-and-unit job (build + verify steps)
- [x] 15-04-PLAN.md — Operator-driven evidence capture on Netlify preview (4 Sentry + 3 CI PNGs + 15-EVIDENCE-DRAFT.md; sentry-cli plan defect documented — v3 removed both `sourcemaps list` and `releases files list`, `releases info` substituted)
- [x] 15-05-PLAN.md — Merge PR #35 (auto-closed 5 issues), finalize 15-EVIDENCE.md with post-merge CI run URL, 5 per-issue closure comments posted

**COMPLETED 2026-05-25** — Phase 15 PR #35 merged (merge commit `2b75412`). All 5 GitHub issues closed (#11 TEST-14, #12 TEST-15, #13 TEST-16, #17 OBSV-03+05, #19 OBSV-04) via auto-close keywords. Finalized evidence: `.planning/phases/15-observability-e2e-verify-close/15-EVIDENCE.md` on `main` (status: closed; post-merge CI run https://github.com/Esk3tit/wtcs-community-polls/actions/runs/26388788421 success). Plan-defects recorded in STATE/15-04-SUMMARY for cleanup follow-up: (a) sentry-cli v3 surface drift; (b) OBSV-05 Discover paid-tier dependency.
**UI hint**: no

---

### Phase 16: UIDN-02 Aggressive Perf-Budget Pass

**Goal**: PostHog is removed from the critical-path chunk via dynamic import, the build has a documented bundle-audit workflow, the logo is served as WebP, route prefetching is enabled app-wide, and a single Lighthouse mobile rerun records the v1.3 post-change delta — with the `Mobile-first responsive design` Key Decision row flipping ⚠️ → ✓ on PASS or remaining ⚠️ on DEFER
**Depends on**: Phase 15
**Risk**: MEDIUM — PostHog lazy-load must preserve GDPR consent-gate timing (PostHog must not fire any capture events before user Allow); `vite.config.ts` plugin ordering must keep `sentryVitePlugin` last in production builds (not displaced by `rollup-plugin-visualizer`); Lighthouse outcome may not improve sufficiently (acceptable per D-12)
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, PERF-07

**Requirement summaries:**

- PERF-01: `rollup-plugin-visualizer@7.0.1` added as devDep; env-gated via `ANALYZE=true` in `vite.config.ts` `plugins[]`; `npm run build:analyze` script added; visualizer and `sentryVitePlugin` are mutually exclusive via env-gate (both require last position — never both active).
- PERF-02: Bundle audit baseline captured via `ANALYZE=true npm run build` against current `main`. Treemap evidence written to `.planning/closure/v1.3-bundle-audit-pre.html`. Confirms PostHog (`posthog-js/dist/module.full.js`, ~420 KB unminified) is in the main critical-path chunk; establishes pre-change baseline for delta measurement.
- PERF-03: PostHog converted to a dynamic `import('@/lib/posthog')` (transitively loading `posthog-js`) inside a consent-gated lazy loader (`<PostHogGate>` mounting a `<Suspense>`-wrapped side-effect loader). Preserves: (a) GDPR consent-gate fires before any PostHog capture events are sent; (b) the analytics client surface stays available via the synchronous facade (`src/lib/posthog-facade.ts`) — FACADE-ONLY client, no React `PostHogProvider` context in the tree (no `usePostHog()` consumers). Bundle audit post-change confirms ~180–200 KB removed from critical-path chunk.
- PERF-04: `build.rolldownOptions.output.manualChunks` configured in `vite.config.ts` to split `vendor-react` and `vendor-posthog` into named cache-stable chunks. Verified via re-run of `ANALYZE=true npm run build`.
- PERF-05: `src/assets/wtcs-logo.png` converted to `wtcs-logo.webp` (manual conversion; `vite-imagetools`/`sharp` are explicit Out-of-Scope per research anti-feature determination). `<picture><source type="image/webp"><img>` added in `src/components/layout/Navbar.tsx` with explicit `width`/`height` to prevent CLS. PNG fallback retained for non-WebP user agents.
- PERF-06: `createRouter({ defaultPreload: 'intent' })` added in `src/main.tsx`. One-line change; covers all `<Link>` navigation app-wide.
- PERF-07: Single Lighthouse mobile rerun executed via `audit-mobile.sh` per D-13 (single-run policy). Per-route delta vs v1.2 baseline recorded in `.planning/closure/UIDN-02-mobile-evidence.md § v1.3 Rerun`. On PASS (5/5 routes Perf ≥ 90): PROJECT.md `Mobile-first responsive design` row flips ⚠️ → ✓; UIDN-02 closes. On DEFER: row stays ⚠️; follow-up trigger remains D-12. Either outcome acceptable.

**Success Criteria** (what must be TRUE):

  1. `npm run build:analyze` (with `ANALYZE=true`) produces a bundle treemap showing `posthog-js` in a separate deferred chunk rather than the main critical-path entry chunk — confirming dynamic import landed correctly
  2. The main JS entry chunk in the production build is measurably smaller than the PERF-02 pre-change baseline (target: ~180–200 KB reduction in unminified chunk size as confirmed by the post-change treemap)
  3. The Netlify deploy-preview app root loads without downloading the `posthog-js` bundle on initial page load — the GDPR consent gate fires before any PostHog events are sent (zero PostHog network requests before user clicks Allow)
  4. `Navbar.tsx` renders `<picture><source type="image/webp" ...><img src="wtcs-logo.png" ...>` with explicit `width` and `height` attributes; the `wtcs-logo.webp` asset is present in the production `dist/` output
  5. Lighthouse mobile audit results are recorded in `.planning/closure/UIDN-02-mobile-evidence.md § v1.3 Rerun` with per-route scores for all 5 routes; PROJECT.md `Mobile-first responsive design` Key Decision row is updated to reflect the PASS-or-DEFER outcome

**Plans**: 7 plans
Plans:
**Wave 1**

- [x] 16-01-PLAN.md — PERF-01: rollup-plugin-visualizer devDep + env-gated mutex with sentryVitePlugin + D-09 production-trap throw + build:analyze script

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 16-02-PLAN.md — PERF-02: capture pre-change bundle baseline at .planning/closure/v1.3-bundle-audit-pre.html (must land before PERF-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 16-03-PLAN.md — PERF-03: posthog-facade + PostHogProviderInner + PostHogGate (lazy + consent-gated) + main.tsx provider-tree inversion + 2 Wave 0 tests (posthog-facade.test.ts, PostHogGate.test.tsx)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 16-04-PLAN.md — PERF-04: vite.config.ts manualChunks (function form) for vendor-react (react + react-dom + scheduler runtime family) + vendor-posthog (lazy-only reachable)
- [x] 16-05-PLAN.md — PERF-05: manual cwebp PNG→WebP + Navbar.tsx <picture><source><img width/height> wrap with zero-CLS contract

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 16-06-PLAN.md — PERF-06: createRouter defaultPreload intent + Navbar Admin Link preload={false} (Pitfall 6 hover-redirect mitigation)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 16-07-PLAN.md — PERF-07: production Lighthouse rerun + UIDN-02-mobile-evidence.md v1.3 Rerun section + PROJECT.md row flip on PASS (or stay ⚠️ on DEFER)

**Wave map** (sequencing is load-bearing — PERF-02 baseline must capture pre-change `posthog-js` in the critical-path chunk):

- W1: 16-01 (PERF-01) · W2: 16-02 (PERF-02 baseline) · W3: 16-03 (PERF-03) · W4: 16-04 ∥ 16-05 (parallel, disjoint files) · W5: 16-06 (after 16-05 — both edit `Navbar.tsx`) · W6: 16-07 (post-merge, operator-driven)
- Cross-cutting constraints: preserve Phase 15 `sentryVitePlugin`-last invariant + 7-name `keepNames` allowlist; zero `posthog-js` network requests before consent='allow'; Navbar `<picture>` swap must be zero-CLS (explicit width/height); PERF-07 single-run on production per D-13.

**UI hint**: yes

---

### Phase 17: Planning-Doc + UI Hygiene Sweep

**Goal**: VALIDATION.md frontmatter is accurate on all pre-Phase-05 phase archives, the Phase 03 VERIFICATION.md retrospective exists with a "Subsequent evolution" section that includes Migration 14, all 17 SUMMARY `requirements-completed` declarations are backfilled, the v1.1 MILESTONES.md entry is written, and `AdminsList`/`CategoriesList`/`PromoteAdminDialog` use shadcn `Card` wrappers
**Depends on**: Phase 16 (Phase 03 VERIFICATION.md retrospective names Migration 14 as the most recent auth-path change — must be written after Phase 14 ships)
**Risk**: NIL — no production schema changes, no Edge Function changes; Card migration is cosmetic and covered by snapshot update pass; all doc work is additive-only
**Requirements**: DOCS-05, DOCS-06, DOCS-07, DOCS-08, UIDN-04, UIDN-05

**Requirement summaries:**

- DOCS-05: VALIDATION.md frontmatter refreshed on Phase 01, 02, 03, 04 archives — `status: complete`, `nyquist_compliant: true`. Phase 05/06 already complete. Surfaces from v1.0 RETROSPECTIVE Lesson 1.
- DOCS-06: Phase 03 VERIFICATION.md retrospective written with `status: retrospective`. Captures: Phase 03 deliverables (guild membership + rate limiting) shipped + UAT 4/4 + Phase 05 transitive re-verification. Includes "Subsequent evolution" section listing migrations 3–9 plus Migration 14 (DBHY-01 — `update_profile_after_auth` + `is_current_user_admin` rewrite) as the most recent auth-path change post-Phase-03.
- DOCS-07: 17 SUMMARY frontmatter `requirements-completed` declarations backfilled across phases 02 + 03-02 + 04-02/04-04 + 01-04. Cross-referenced against VERIFICATION.md / archive REQUIREMENTS to confirm REQ-ID coverage.
- DOCS-08 (HARD REQ): v1.1 MILESTONES.md entry written. Manual curation using v1.2 MILESTONES.md entry as canonical template — no CLI auto-extraction (lesson from v1.2 RETROSPECTIVE). Closes the "entry never written" gap permanently.
- UIDN-04: `AdminsList.tsx` + `CategoriesList.tsx` outer hand-rolled `<div>` containers replaced with shadcn `<Card>/<CardHeader>/<CardTitle>/<CardContent>` wrappers. One `<Card>` per list section; rows inside `<CardContent>` with `divide-y`. Do NOT wrap each row in its own `<Card>` (over-segmentation anti-pattern). Snapshot tests updated in same commit; diffs reviewed for className-only changes before committing.
- UIDN-05: `PromoteAdminDialog.tsx` search-results inner container replaced with `<Card>/<CardContent>` if Phase 17 audit confirms original UIDN-03 flag still applies. Same Card composition pattern as UIDN-04. ARIA check: confirm dialog roles + `aria-labelledby` survive migration (Card primitive uses generic `<div>` — no role conflict with parent Dialog). May close as no-op if audit shows flag no longer applies.

**Success Criteria** (what must be TRUE):

  1. `MILESTONES.md` contains a complete v1.1 entry matching the v1.2 entry structure (phases, plans, key accomplishments, stats table, key decisions, issues resolved) — manually curated, not auto-extracted
  2. All four phase archives (01, 02, 03, 04) have VALIDATION.md with `status: complete` and `nyquist_compliant: true` in their frontmatter
  3. Phase 03 has a VERIFICATION.md with `status: retrospective`, covering Phase 03 deliverables and including a "Subsequent evolution" section that names Migration 14 (DBHY-01) as the most recent auth-path change
  4. `AdminsList.tsx` and `CategoriesList.tsx` render shadcn `<Card>` wrappers — `npm run lint` and `tsc -b` pass with zero errors; `vitest --update-snapshots` produces only className-level diffs in snapshot files with no structural regressions
  5. `PromoteAdminDialog.tsx` search-results container uses `<Card>/<CardContent>` OR is confirmed to already meet the pattern (UIDN-05 closed as no-op after audit), with ARIA roles verified intact in either case

**Plans**: 2 plans
Plans:
- [x] 17-01-PLAN.md — Doc hygiene sweep (DOCS-05/06/07/08): VALIDATION frontmatter audit, 03-VERIFICATION retrospective + Subsequent evolution, SUMMARY requirements-completed backfill, v1.1 MILESTONES entry
- [x] 17-02-PLAN.md — UI Card migration (UIDN-04/05): AdminsList + CategoriesList + PromoteAdminDialog hand-rolled containers → shadcn Card
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 14. Security-Definer Search-Path Migration | 1/1 | Complete | 2026-05-17 |
| 15. Observability + E2E Verify & Close | 5/5 | Shipped | 2026-05-25 |
| 16. UIDN-02 Aggressive Perf-Budget Pass | 7/7 | Complete    | 2026-05-29 |
| 17. Planning-Doc + UI Hygiene Sweep | 2/2 | Complete   | 2026-05-30 |

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 | 1–6 | 32/32 | ✅ Shipped | 2026-04-28 |
| v1.1 | 7–10 | 16/16 | ✅ Shipped | 2026-05-11 |
| v1.2 | 11–13 | 17/17 | ✅ Shipped | 2026-05-14 |
| v1.3 | 14–17 | 6/8 | 🔄 In progress | - |
