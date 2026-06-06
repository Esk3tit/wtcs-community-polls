# WTCS Community Polls

## What This Is

A community suggestion and opinion-gathering platform for the War Thunder Competitive Scene (WTCS). Admins create suggestions/topics (e.g. "Remove MiG-29 12-3 from this lineup"), community members share their opinions via Discord OAuth. Hosted at [polls.wtcsmapban.com](https://polls.wtcsmapban.com) as a sibling to the main WTCS Map Vote/Ban app — fully independent, sharing only admin accounts conceptually. Live since 2026-04-28 (v1.0).

**User-facing name:** WTCS Community Suggestions
**Internal/admin name:** WTCS Community Polls (used in code, DB, admin UI)

## Core Value

Community members can share opinions on competitive scene proposals with confidence that results are authentic — one verified Discord account, one response, no manipulation.

## Framing

This platform gathers community **opinions**, not binding votes. Nothing on the site should imply that the most popular option will be implemented or that users are owed any outcome. WTCS is community-run with no direct authority over War Thunder's development — only Gaijin Entertainment can implement game changes. This platform collects and presents organized community feedback that WTCS admins can relay to Gaijin.

**User-facing terminology:** suggestions, topics, opinions, responses, community sentiment
**Avoid (user-facing):** vote, poll, voter, winner, decided, will be implemented

**Admin/internal terminology:** polls, votes — acceptable in admin UI, code, database, and planning docs

## Current State

**Shipped:** v1.3 — Hygiene & Performance (2026-05-31)
**Previous:** v1.2 — Admin Visibility Controls (2026-05-14) · v1.1 — Hygiene & Polish (2026-05-11) · v1.0 — Launch-Ready MVP (2026-04-28)
**Production:** https://polls.wtcsmapban.com — no new user-visible features in v1.3 (security/perf/doc hygiene); the one product-touching delta is the perf-budget pass that closed UIDN-02 (5/5 mobile routes Perf ≥ 90).
**Code (cumulative through v1.3):** v1.0 baseline 13,602 LOC + v1.1/v1.2 deltas + v1.3 delta (+2,768 / −1,793 across 39 non-planning files); 17 Edge Functions (no new EFs in v1.3); 12 DB migrations (Migration 14 = `SECURITY DEFINER` `search_path = ''` hardening on 6 user-owned functions + stale 3-param `update_profile_after_auth` overload drop); zero `0011_function_search_path_mutable` advisor WARNs post-deploy. PostHog moved off the critical-path chunk (~187 KB deferred behind a consent-gated lazy loader); logo served as WebP; `defaultPreload: 'intent'` app-wide.
**Tests:** 401 unit/component tests green (incl. a new `findByRole('dialog')` ARIA assertion from the UIDN-04/05 Card migration); `scripts/verify-sourcemap-names.mjs` build-time `keepNames` regression guard wired into CI; direct SQL regression fixture for `is_current_user_admin()` (6 PASS / 0 FAIL); all five Playwright E2E specs (#11/#12/#13) green in CI.
**v1.3 archives:** [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) · [milestones/v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md) · [milestones/v1.3-MILESTONE-AUDIT.md](milestones/v1.3-MILESTONE-AUDIT.md) (verdict: passed — 23/23 requirements, 4/4 phases, 9/9 seams wired, 3/3 E2E flows, 4/4 Nyquist-compliant)
**v1.2 archives:** [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · [milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md) (no separate v1.2 audit file; pre-close artifact audit + Phase 13 verification covered this)
**v1.1 archives:** [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) · [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md) · [milestones/v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md)

## Current Milestone: v1.4 — Final Closeout

**Goal:** Close every outstanding v1 carry-forward — local test-environment repairs, live human UAT, code/migration debt, and test-completeness gaps — so nothing carries past v1.4. Hard debt-zero mandate: no `tech_debt`/DEFER exits. Excludes all V2 product features.

**Target features:**

- **Test-environment repair (real fix)** — Upgrade/pin local supabase-edge-runtime past the 1.73.x ES256 verification bug so `npm run test:integration` runs green; fix local gotrue `email_provider_disabled` config so the TEST-11 12-cell RLS vitest matrix runs green.
- **Live human UAT** — Execute Phase 03 UAT tests 2+3 (2FA-on, non-WTCS-member Discord tester) and Phase 04 UAT 6a (second-admin demote-click flow); record evidence into `03-UAT.md` / `04-UAT.md`.
- **Code/migration debt** — New migration replacing the undistinguishing `profile_self_update_allowed` `current_user = session_user` gate with a session-GUC trusted-context flag (STATE.md Deferred Items, Option b); restore the two `<h2>` semantic headings demoted to `CardTitle` `<div>`s during the Phase 17 UIDN-04/05 Card migration (17-REVIEW.md WR-01).
- **Test completeness** — Implement the deferred manual fault-injection coverage in `e2e/integration/create-poll-results-hidden.test.ts` (line 156).
- **Dependency hygiene** — Review/merge open dependabot PRs #40 (minor-and-patch group, 15 updates) and #34 (lint-staged 16→17).

**Key context:**

- Phase numbering continues from v1.3 (last phase 17) → v1.4 starts at **Phase 18**.
- This is the "finish line" milestone — structural sibling of v1.1/v1.3 hygiene passes, but with a hard **debt-zero exit** (no DEFER / `tech_debt` verdicts accepted; the explicit operator mandate is "one and done — finish everything before it").
- Environment items are REAL repairs (upgrade/config fix + run the real tests green), not alternative-validation substitutes — operator decision at scoping.
- Human UAT items are executed **live by the operator** this milestone (operator decision); plans must produce exact step-by-step checklists + evidence-recording targets.
- Completeness sweep at scoping confirmed the canonical carry-forward list is exhaustive: zero open GitHub issues, zero skipped tests, no hidden `v1.4`/`v1.5` markers beyond the known TEST-11 deferral. Net-new surfaced: the fault-injection test gap + two dependabot PRs (both folded in).
- v1.3 phase work dirs (14–17) archived to `milestones/v1.3-phases/` at v1.4 open (restoring the per-milestone archival convention the v1.3 close skipped).
- **Out of scope (V2, untouched):** NOTF Discord webhooks, ANLT analytics dashboard, ABSE Turnstile CAPTCHA, VERF-01 (superseded by AUTH-03).

GitHub milestone: TBD on first push.

<details>
<summary>Previous milestone goals (v1.3 — Hygiene & Performance, shipped 2026-05-31)</summary>

## v1.3 — Hygiene & Performance

**Goal:** Close v1.0–v1.2 carry-forward debt (DB / test / observability / planning-doc / UI hygiene) and ship an aggressive perf-budget pass that triggers the UIDN-02 Lighthouse rerun, flipping the "Mobile-first responsive design" Key Decision row if Perf gates clear.

**Target features:**

- **DB hygiene** — `SECURITY DEFINER` + `search_path = ''` on 7 pre-Phase-11 functions (`update_profile_after_auth`, `handle_new_user`, `validate_vote_choice`, `increment_vote_count`, `is_current_user_admin`, `profile_self_update_allowed`, `rls_auto_enable`); clear all WARN-level Supabase advisors; align `11-PATTERNS.md` `vote_counts` skeleton with shipped REVIEW-FIX-H3 form.
- **Test/E2E hygiene** — Close issues #11 (`admin-create.spec.ts` doesn't populate Choice 1/2), #12 (`browse-respond.spec.ts` asserts vote count on zero-vote fixtures), #13 (`filter-search.spec.ts` `toHaveCount()` under two-layer seed). Real fixture/seed fixes, not skip-and-defer.
- **Observability hygiene** — Issue #17 Sentry React 19 ErrorBoundary render-phase throw capture (SDK v10 transport investigation); issue #19 Vite/Rolldown sourcemap function-name preservation (Sentry shows real names, not minified `$M`).
- **Planning-doc + UI hygiene** — VALIDATION.md frontmatter backfill on phases 01–04; Phase 03 VERIFICATION.md retrospective; 17 SUMMARY `requirements-completed` declarations; **v1.1 MILESTONES.md entry backfill** (folded into this cluster); `AdminsList` / `CategoriesList` / `PromoteAdminDialog` hand-rolled containers → shadcn `Card` (UIDN-03-FOLLOWUP-LIST-CARDS).
- **UIDN-02 perf-budget pass (aggressive)** — Bundle audit (rollup-plugin-visualizer) + route-level code split + admin route lazy-load + image format migration (WebP/AVIF) + font subsetting + route prefetch tuning + critical CSS audit. Single Lighthouse rerun per D-13. Accept rerun outcome (could be PASS or DEFER); follow-up trigger stays D-12 if perf still misses.

**Key context:**

- Phase numbering continues from v1.2 (last phase 13) → v1.3 starts at **Phase 14**.
- UIDN-02 closure mode = aggressive change + accept rerun outcome (no hard PASS gate). Strict-floor MISS remains acceptable per D-12.
- No new product features. Mirrors v1.1's "Hygiene & Polish" structural pattern but adds a real product-touching perf-budget axis.
- **Stays deferred (not in v1.3):** Phase 04 UAT 6a + Phase 03 UAT 2+3 (second-human-gated); local supabase-edge-runtime ES256 verification bug (1.73.x; prod unaffected, transitively covered by Phase 12 UAT).
- The five v1.3 work-streams are roughly equal in weight; observability hygiene is diagnose-first (#17 + #19) and may earn its own phase rather than fold into a generic "ops cleanup".

GitHub milestone: TBD on first push.

</details>

<details>
<summary>Previous milestone goals (v1.2)</summary>

## Previous Milestone: v1.2 — Admin Visibility Controls

**Goal:** Give admins per-suggestion control over results visibility ([SEED-002](seeds/SEED-002-admin-controlled-results-visibility.md), Tim's ask), and close the v1.1 Path-3 carry-forward debt for mobile + shadcn so PROJECT.md Key Decision rows can flip ⚠️ Revisit → ✓ Good.

**Target features:**
- **SEED-002 — Admin-controlled results visibility (per-suggestion):** New `polls.results_visibility` enum (`respondents_only` default / `public_during` / `public_after_close`); RLS rewrite on `vote_counts` to honor the new policy; new admin Edge Function for ad-hoc reveal; admin UI selector at creation + "Reveal results now" button on live admin card; user UI conditionally renders results pre-vote when policy allows; RLS invariant tests for each visibility × pre/post-vote × pre/post-close cell; admin UAT for happy paths and ad-hoc reveal.
- **UIDN-02 closure (carry-forward from Phase 9):** Lighthouse mobile-perf rerun after v1.2 perf budget hit + Plan 02 harness hydration-wait fix; flip `Mobile-first responsive design` Key Decision row ⚠️ → ✓.
- **UIDN-03 closure (carry-forward from Phase 9):** Cleanup of 4 native-`<button>` drifts in `SearchBar.tsx`, `SuggestionForm.tsx`, `ImageInput.tsx` + authenticated Pass-A screenshot capture; flip `shadcn/ui new-york + Tailwind CSS v4` Key Decision row ⚠️ → ✓.

**Key context:**
- Phase numbering continues from v1.1 (last phase 10) → v1.2 starts at **Phase 11**.
- SEED-002 spec is medium scope (schema + RLS + EF + 2 UIs + matrix tests) and has a fully detailed seed file with breadcrumbs to v1.0 RSLT-05 (becomes the *default* of three modes, not the only mode) and v1.0 PITFALLS Pitfall 10 (RLS leakage prevention must be re-validated).
- One-way ad-hoc reveal recommended over toggle-back (UX surprise risk; voters who already saw results can't un-see).
- Backwards compat: all v1.0/v1.1 suggestions default to `respondents_only` (zero behavior change for in-flight).
- UIDN-02 and UIDN-03 evidence baselines from Phase 9 stay valid; v1.2 work re-runs the audits against the post-fix codebase rather than starting from scratch.

**Out-of-scope tech debt from v1.0 audit (still open, not in v1.2):**
- Fake admin Discord IDs cleanup in production seed
- Leftover `[E2E] Test:` polls in shared DB (data hygiene)

GitHub milestone: TBD on first push.

</details>

<details>
<summary>Previous milestone goals (v1.1)</summary>

**v1.1 — Hygiene & Polish (shipped 2026-05-11):** Close v1.0 carry-forward debt — observability robustness (OBSV-01/02), E2E test hygiene (TEST-07/08/09/10), UI polish closure evidence (UIDN-02/03/04), and planning artifact backfill (DOCS-01/02/03/04). Phases 7–10, 16/16 plans, 4 PRs (#21/#22/#24/#25). 11/11 in-scope requirements satisfied (UIDN-02 + UIDN-03 deferred to v1.2 within Path-3 plan acceptance pattern). GitHub milestone: https://github.com/Esk3tit/wtcs-community-polls/milestone/1

</details>

## Requirements

### Validated (v1.0)

**Authentication:**
- ✓ Discord OAuth login with redirect (AUTH-01) — v1.0
- ✓ 2FA enforcement via fail-closed SECURITY DEFINER RPC (AUTH-02) — v1.0
- ✓ Discord server membership verification (AUTH-03) — v1.0
- ✓ Session persistence across refresh (AUTH-04) — v1.0
- ✓ Logout from any page (AUTH-05) — v1.0

**Admin Management:**
- ✓ Initial admins seeded by Discord ID (ADMN-01) — v1.0
- ✓ In-app admin promotion (ADMN-02) — v1.0
- ✓ In-app admin demotion with self-guard (ADMN-03) — v1.0
- ✓ Server-side admin gate on all admin actions (ADMN-04) — v1.0

**Suggestion Creation & Lifecycle:**
- ✓ Configurable choices with Yes/No and 4-choice presets (POLL-01) — v1.0
- ✓ Image attach (upload to Supabase Storage or external URL) (POLL-02) — v1.0
- ✓ Configurable timer (7d / 14d / custom) (POLL-03) — v1.0
- ✓ Category assignment (POLL-04) — v1.0
- ✓ Pin/highlight (POLL-05) — v1.0
- ✓ Edit before first response (POLL-06) — v1.0
- ✓ Manual close at any time (POLL-07) — v1.0
- ✓ Auto-close on timer expiry via cron + view (LIFE-01) — v1.0
- ✓ Resolution status: Addressed / Forwarded / Closed (LIFE-02) — v1.0
- ✓ Public archive of closed suggestions (LIFE-03) — v1.0

**Responding (Voting):**
- ✓ One response per user per suggestion (UNIQUE constraint) (VOTE-01) — v1.0
- ✓ Server-side validation via Edge Function (VOTE-02) — v1.0
- ✓ No UPDATE/DELETE on votes via RLS (VOTE-03) — v1.0
- ✓ Upstash sliding-window rate limiting 5 req/60s (VOTE-04) — v1.0

**Results:**
- ✓ Results hidden until user has responded (RSLT-01) — v1.0
- ✓ Live percentages + raw counts after responding (RSLT-02) — v1.0
- ✓ Pre-aggregated `vote_counts` via Postgres trigger (RSLT-03) — v1.0
- ✓ HTTP polling at 8s with visibilityState gate (RSLT-04) — v1.0
- ✓ Results visible only to respondents — even after close (RSLT-05) — v1.0

**Categories & Navigation:**
- ✓ Category CRUD (CATG-01) — v1.0
- ✓ Active suggestions browsable on main page (CATG-02) — v1.0
- ✓ Category tabs/pills filter (CATG-03) — v1.0
- ✓ Debounced text search (CATG-04) — v1.0

**UI & Design:**
- ✓ Light/dark mode with system preference (UIDN-01) — v1.0

**Infrastructure:**
- ✓ Netlify deployment at polls.wtcsmapban.com (INFR-01) — v1.0
- ✓ Supabase keepalive cron every 3-4 days (INFR-02) — v1.0
- ✓ Upstash Redis keepalive — v1.4 (quick task 260606-cff): the daily `cron-sweep.yml` → `close-expired-polls` run now also issues a self-expiring Redis write (`keepalive:close-expired-polls`, 7-day TTL), so one daily cron keeps BOTH Supabase and Upstash warm. Added after Upstash flagged the free-tier Redis DB for inactivity archival (only `submit-vote` touched Redis, so it idled during quiet periods). Reuses existing Supabase project secrets; verified live (key TTL counting down in Upstash console).
- ✓ Direct Supabase reads with RLS (INFR-03) — v1.0
- ✓ Edge Function-only writes (INFR-04) — v1.0

**Testing:**
- ✓ Vitest + React Testing Library + jsdom (TEST-01) — v1.0
- ✓ 30 auth tests (TEST-02) — v1.0
- ✓ 19 voting/results tests (TEST-03) — v1.0
- ✓ 12 integrity tests (TEST-04) — v1.0
- ✓ 16 admin test files / 221 admin assertions (TEST-05) — v1.0
- ✓ 4 Playwright @smoke specs (TEST-06) — v1.0

### Validated (v1.2 — Admin Visibility Controls)

- ✓ Per-row `polls.results_hidden` boolean (VIS-01) — v1.2 (Phase 11 Plan 01)
- ✓ Admin two-way toggle, no window restriction, audited (VIS-02) — v1.2 (Phase 11 Plan 02; race-safe conditional UPDATE)
- ✓ `toggle-results-visibility` Edge Function with `requireAdmin` gate (VIS-03) — v1.2 (Phase 11 Plan 02)
- ✓ `vote_counts` SELECT RLS honors `results_hidden`; service-role-only bypass (VIS-04) — v1.2 (Phase 11 Plan 01; REVIEW-FIX-H3)
- ✓ RLS invariant 12-cell matrix + admin-JWT regression sentinel (VIS-05 / TEST-11) — v1.2 (Phase 11 Plan 04)
- ✓ Admin "Hide results from voters" Checkbox in `SuggestionForm` create flow (VIS-06) — v1.2 (Phase 12 Plan 02)
- ✓ Inline admin `Switch` per row with optimistic + revert-on-error + sonner toast (VIS-07) — v1.2 (Phase 12 Plan 03; D-01 wording revision dropped AlertDialog)
- ✓ `SuggestionCard` + archive view show "hidden by admin" placeholder when voted + `results_hidden=true` (VIS-08) — v1.2 (Phase 12 Plan 04)
- ✓ `polls_effective` view projects `results_hidden` + `results_hidden_changed_at`; `security_invoker = on` re-applied (VIS-09) — v1.2 (Phase 11 Plan 01)
- ✓ UIDN-03 4-site native-`<button>` sweep (SearchBar + 2× SuggestionForm + ImageInput DropZone extraction) — v1.2 (Phase 12 Plans 01 + 02 + 05)
- ✓ TEST-12 toggle EF authz/audit 7-case suite + create-poll results_hidden 4-case suite — v1.2 (Phase 11 Plan 04)
- ✓ TEST-13 Playwright `@smoke` SC4 round-trip — v1.2 (Phase 12 Plan 06)

### Validated (v1.3 — Hygiene & Performance)

**DB Hygiene:**
- ✓ Migration 14 — 6 user-owned `SECURITY DEFINER` functions hardened with `SET search_path = ''` + fully-qualified bodies; stale 3-param `update_profile_after_auth` overload dropped (DBHY-01) — v1.3 (Phase 14)
- ✓ Zero `0011_function_search_path_mutable` advisor WARNs post-deploy (DBHY-02) — v1.3 (Phase 14)
- ✓ `submit-vote` smoke round-trip PASS post-Migration-14 + `is_current_user_admin` SQL regression fixture (DBHY-03) — v1.3 (Phase 14)
- ✓ `11-PATTERNS.md` `vote_counts` skeleton aligned with shipped REVIEW-FIX-H3 form (DBHY-04) — v1.3 (Phase 14)

**Observability + Test Hygiene:**
- ✓ Sentry React 19 ErrorBoundary render-phase capture smoke-verified; issue #17 closed (OBSV-03) — v1.3 (Phase 15)
- ✓ Vite/Rolldown sourcemap function-name preservation verified end-to-end; issue #19 closed (OBSV-04) — v1.3 (Phase 15)
- ✓ `Sentry.dedupeIntegration()` triple-handler collapse smoke-verified (OBSV-05) — v1.3 (Phase 15)
- ✓ `admin-create` / `browse-respond` / `filter-search` Playwright specs green in CI; issues #11/#12/#13 closed (TEST-14/15/16) — v1.3 (Phase 15)

**Perf-Budget Pass (UIDN-02 closure):**
- ✓ `rollup-plugin-visualizer` env-gated bundle-audit workflow + baseline (PERF-01/02) — v1.3 (Phase 16)
- ✓ PostHog dynamic-import behind consent-gated lazy loader; ~187 KB off critical path; GDPR gate preserved (PERF-03) — v1.3 (Phase 16)
- ✓ `manualChunks` `vendor-react` + lazy-only `vendor-posthog` split (PERF-04) — v1.3 (Phase 16)
- ✓ WebP logo in zero-CLS `<picture>` with PNG fallback (PERF-05) — v1.3 (Phase 16)
- ✓ `defaultPreload: 'intent'` app-wide + `preload={false}` on Admin links (PERF-06) — v1.3 (Phase 16)
- ✓ **UIDN-02** — Lighthouse v1.3 rerun 5/5 mobile routes Perf ≥ 90; carry-forward closed (PERF-07) — v1.3 (Phase 16); Mobile-first Key Decision flipped ⚠️ → ✓

**Planning-Doc + UI Hygiene:**
- ✓ VALIDATION.md frontmatter accurate on Phase 01–04 archives (DOCS-05) — v1.3 (Phase 17)
- ✓ Phase 03 VERIFICATION.md retrospective with "Subsequent evolution" naming Migration 14 (DOCS-06) — v1.3 (Phase 17)
- ✓ 15 pre-Phase-05 SUMMARY `requirements-completed` declarations audit-confirmed (DOCS-07) — v1.3 (Phase 17)
- ✓ v1.1 MILESTONES.md entry backfilled at full structural parity (DOCS-08) — v1.3 (Phase 17)
- ✓ **UIDN-04** — `AdminsList` / `CategoriesList` → shadcn `<Card>` — v1.3 (Phase 17)
- ✓ **UIDN-05** — `PromoteAdminDialog` search-results → shadcn `<Card>`; Dialog ARIA verified intact — v1.3 (Phase 17)

### Validated (v1.4 — Final Closeout)

- ✓ TEST-17 — Local supabase-edge-runtime ES256 verification bug fixed via a unified Supabase CLI pin (2.102.0 → edge-runtime v1.74.0) across all four pin locations; local/CI runtime skew closed — Phase 18
- ✓ TEST-18 — Local gotrue `email_provider_disabled` fixed (`[auth.email]` in config.toml); the TEST-11 12-cell RLS vitest matrix runs green (26/26 integration) locally and on CI (PR #43) — Phase 18
- ✓ TEST-19 — Deferred `create-poll` fault-injection coverage implemented (fail-safe, title-scoped, serialized; fail-closed seed guard) — Phase 18
- ✓ DBHY-05 — `profile_self_update_allowed` privilege-escalation gate fixed: Migration 15 replaces the permanently-false `current_user = session_user` check (always false inside a SECURITY DEFINER trigger) with a transaction-local GUC flag (`app.trusted_profile_update`, `set_config(..., is_local=true)`) set by `update_profile_after_auth`; null-safe `IS DISTINCT FROM 'on'` gate, `pg_catalog`-qualified built-ins under `search_path=''`, explicit REVOKE/GRANT EXECUTE. Applied to local stack, advisor lint clean, integration test proves both gate directions (6/6, incl. ordered RPC proof + GUC-leak guard). **Accepted residual (T-19-07):** `update_profile_after_auth` still trusts caller-supplied `p_mfa_verified`/`p_guild_member` (computed client-side from Discord OAuth, not re-derived server-side) — pre-existing since migration 02, not widened by Phase 19, no live users; server-side re-validation (Edge Function with the user's provider token) deferred to a future auth refactor. Tracked in the function's `COMMENT ON FUNCTION` and `19-SECURITY.md`. Prod `--linked` deploy deferred to milestone ship — Phase 19
- ✓ UIDN-06 — Two `<h2>` section headings restored in AdminsList/CategoriesList: CardTitle made polymorphic via `asChild`/`Slot.Root` (same pattern as button.tsx/badge.tsx), replacing the Phase 17 `<div role="heading" aria-level={2}>` ARIA workaround with native `<h2>` — Phase 19

### Active (carry-forward to v1.4+)

- [ ] Backfill Phase 04 UAT test 6a evidence (demote click flow — passed off-record on second admin, needs 04-UAT.md update; second-admin-gated)
- [ ] Phase 03 UAT tests 2 + 3 with second human (2FA-enabled, non-WTCS-member Discord tester — 2FA must be ON so the gate clears and the non-member check fires)

### Scoped for v1.4 (Final Closeout)

v1.4 is now scoped (2026-05-31) as the debt-zero closeout milestone. It absorbs **all** the carry-forwards in **Active** above (test-environment repair, live human UAT, the `profile_self_update_allowed` gate migration, and the Phase 17 a11y heading restore) plus two sweep-surfaced stragglers (the `create-poll-results-hidden.test.ts` fault-injection gap and dependabot PRs #40/#34). REQ-IDs and phase mapping live in `.planning/REQUIREMENTS.md`. As phases complete, these items migrate from **Active** to **Validated (v1.4)**.

### Deferred to v2 (or later)

- **NOTF-01, NOTF-02**: Discord webhook notifications when suggestions go live / close
- **VERF-01**: WT Discord server membership verification for respondents (already shipped as AUTH-03 — duplicate; mark as superseded if v2 begins)
- **ANLT-01, ANLT-02**: Admin analytics dashboard
- **ABSE-01**: Cloudflare Turnstile CAPTCHA for suspicious patterns

### Out of Scope

| Feature | Reason | Audit |
|---------|--------|-------|
| Anonymous responses | Destroys accountability; Discord identity is core to integrity | ✓ Still valid |
| Multiple OAuth providers | Fragments identity, creates duplicate-response loopholes | ✓ Still valid |
| Ranked-choice responses | Over-engineered for simple Yes/No / pick-one topics | ✓ Still valid |
| User-created suggestions | Opens door to spam; admin curation is intentional | ✓ Still valid |
| Comments/discussion | Discussion belongs in Discord where the community lives | ✓ Still valid |
| Real-time WebSockets | HTTP polling at 8s is sufficient at 20-30 concurrent users | ✓ Validated in production |
| Email notifications | Community uses Discord, not email | ✓ Still valid |
| Weighted responses | Creates perceived unfairness in a gaming community | ✓ Still valid |
| Blockchain | Absurd complexity for a 300-person community | ✓ Still valid |
| Response attribution | Showing who responded with what creates social pressure | ✓ Still valid |
| Account age check | Discord 2FA + server membership is sufficient | ✓ Still valid |
| Cross-app admin sync | Apps are independent; Discord-native admin model chosen | ✓ Still valid |
| Geo-gating (Russian users) | Sister-site behavior — VPN handles ISP-level blocks user-side | ✓ Still valid |

## Context

- **Production:** https://polls.wtcsmapban.com (Netlify legacy free tier, custom domain via OVH CNAME)
- **Sibling project:** WTCS Map Vote/Ban system at wtcsmapban.com uses Convex + Vite + React + TanStack Router. This app is fully independent but targets the same admin community.
- **Admin context:** Most admins are esports organizers, not technical users. UI/UX must be intuitive with minimal learning curve.
- **Community size:** ~300-400 respondents per week, ~20-30 concurrent at peak. Fits comfortably in free tier.
- **Primary user flow:** Admin shares a link in Discord → user clicks → lands on suggestion page → authenticates → responds → sees results.
- **Codebase state at v1.0 ship:** 13,602 LOC, 141 .ts/.tsx files, 41 test files, 378/378 unit tests, 16 Edge Functions, 10 DB migrations.
- **Codebase state at v1.3 ship:** 401 unit/component tests green, 17 Edge Functions, 12 DB migrations (Migration 14 = SECURITY DEFINER `search_path` hardening); PostHog lazy-loaded off the critical path (~187 KB deferred); WebP logo; zero `0011` advisor WARNs. No new product features in v1.3 — security/perf/doc hygiene + UIDN-02 closure.
- **Two separate surfaces:** User-facing (no admin awareness) and admin-facing (separate /admin/* routes, AdminGuard + suppressed ConsentBanner/Chip).
- **Observability:** Sentry error tracking unconditional; PostHog event capture and Sentry Replay default-OFF until consent Allow (D-05 + Phase 6 GDPR rewire).

## Constraints

- **Budget**: $0/month — Supabase free tier, Netlify legacy free tier, Upstash Redis free tier (validated through v1.0 ship)
- **Tech stack**: Vite + React 19 + TypeScript + TanStack Router + shadcn/ui + Tailwind CSS v4 (frontend), Supabase (backend), Netlify (hosting) — all locked decisions, all shipped
- **Auth**: Discord OAuth only, enforced via Supabase native Discord provider with mandatory 2FA
- **Scale**: Must work within Supabase free tier limits (500MB DB, 1GB storage, 2M Edge Function invocations/month)
- **Hosting**: Netlify legacy free tier — separate site from main WTCS app
- **Rate limiting**: Upstash Redis free tier — sliding-window 5 req/60s on submit-vote
- **Design system**: shadcn/ui new-york style, Neutral baseColor, Inter font

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Discord-native admin model | Self-contained, no cross-app sync complexity | ✓ Good (v1.0) |
| HTTP polling over WebSockets | Simpler, no Realtime dependency, sufficient at 20-30 concurrent | ✓ Good (v1.0 — visibilityState-gated) |
| Response counts via Postgres trigger | Avoid counting on every read, pre-aggregated for fast polling | ✓ Good (v1.0) |
| Edge Functions for response writes | Server-side validation prevents client-side manipulation | ✓ Good (v1.0 — submit-vote + 14 admin EFs all gated) |
| Supabase Storage + external URLs for images | Flexibility for admins — upload or paste a URL | ✓ Good (v1.0) |
| Results visible only to respondents | Encourages participation, prevents lurking | ✓ Good (v1.0 — RLS-enforced) |
| Official WT esports Discord server membership | Ensures only community members respond | ✓ Good (v1.0 — guilds OAuth scope, fail-closed) |
| Opinions-not-votes framing | WTCS has no authority over game changes; avoids false expectations | ✓ Good (v1.0) |
| shadcn/ui + Tailwind CSS v4 (Maia/Neutral) | Component library for consistent rapid UI development | ✓ Good (v1.2 — UIDN-03 4-site sweep complete in Phase 12) |
| Light + dark mode from day one | System preference support via shadcn theme toggle | ✓ Good (v1.0) |
| Status labels: Addressed/Forwarded/Closed | Neutral framing — avoids "Rejected" or "Implemented" | ✓ Good (v1.0) |
| Two separate surfaces (user/admin) | Users never see admin UI | ✓ Good (v1.0 — AdminGuard + admin-route ConsentBanner suppression) |
| Server-side 2FA via SECURITY DEFINER RPC (fail-closed) | Cannot be bypassed by client manipulation | ✓ Good (v1.0) |
| Upstash sliding-window 5 req/60s | Free tier, handles abuse without false positives | ✓ Good (v1.0) |
| `polls_effective` lazy-close view + cron-sweep dual-write | Closes suggestions reliably even on free tier without pg_cron | ✓ Good (v1.0 — invariant test prevents `from('polls')` regressions) |
| GDPR opt-IN consent (Phase 6 rewire from initial opt-OUT) | EU compliance; analytics off until user clicks Allow | ✓ Good (v1.0 — PostHog smoke verified zero pre-Allow events) |
| Sentry error capture unconditional; Replay consent-gated | Error visibility preserved; Replay PII-sensitive only on Allow | ✓ Good (v1.0 — D-05) |
| Russian users expected to use VPN (no geo-gating) | Matches sister-site behavior; ISP-level blocks user-side | ✓ Good (v1.0 — no detection logic) |
| Mobile-first responsive design | Discord users tap links from phones | ✓ (v1.3 rerun — 5/5 routes Perf ≥ 90; see .planning/closure/UIDN-02-mobile-evidence.md § v1.3 Rerun) |
| Phase numbering: integers + decimal-insertions | Clear insertion semantics for urgent fixes | — Pending (no decimals used in v1.0/v1.1/v1.2) |
| Sentry React SDK v10 + ErrorBoundary | Render-phase throws don't ship via ErrorBoundary capture path | ✓ Good (v1.3 — Phase 15 OBSV-03 smoke-verified render-phase capture with `boundary: app-root` tag on deploy preview; issue #17 closed) |
| Admin per-poll `results_hidden` + two-way toggle (no window restriction) | Tim's ask reframed during v1.2 scoping from 3-mode enum + one-way reveal to single boolean + symmetric toggle for simplicity | ✓ Good (v1.2 — race-safe conditional UPDATE; voters-only privacy preserved) |
| Service-role-only bypass on `vote_counts` SELECT RLS (no admin OR-branch) | Single trust path per RLS principle | ✓ Good (v1.2 — REVIEW-FIX-H3) |
| `audit_log.target_id TEXT` (admits Discord snowflakes) | `promote-admin` Branch 2 needs snowflake support; UUID-only would silently fail-open via writeAudit | ✓ Good (v1.2 — REVIEW-FIX-C3/H1) |
| Optimistic `Switch` + sonner toast (NOT AlertDialog confirm) for VIS-07 | Matches `usePinPoll` precedent; AlertDialog felt heavyweight for a reversible flip | ✓ Good (v1.2 — D-01 wording revision) |
| `<DropZone>` extraction in `ImageInput` (separate drag-region from keyboard-Browse trigger) | Closes UIDN-03 [c] dual-role anti-pattern | ✓ Good (v1.2 — biggest UIDN-03 sweep site) |
| Phase 9 harness sentinel = `[aria-label="Toggle color theme"]` (Navbar unconditional) | Phase 9 Plan 02 networkidle defect produced loading-shell captures; deterministic sentinel + .catch() preserves diagnostic screenshots on timeout | ✓ Good (v1.2 Phase 13 — 42/42 PNGs clean, 0 DOM warnings) |
| D-19 per-width home↔admin sha256 whitelist | AdminGuard navigates unauth `/admin` → `/` (Phase 9 D-06 evidence); intentional collision preserved while loading-shell false-pass still hard-fails | ✓ Good (v1.2 Phase 13 — sha256 uniqueness gate hard-fails before MANIFEST write) |
| Migration 14 via `CREATE OR REPLACE FUNCTION` (not `ALTER`) for SECURITY DEFINER hardening | OID-stable for trigger references; allows body-identical `is_current_user_admin` rewrite | ✓ Good (v1.3 Phase 14 — pre/post `pg_get_functiondef` diff exit 0; zero `0011` WARNs; prod smoke vote PASS) |
| `rls_auto_enable` carved out of Migration 14 as Supabase-managed | Dashboard-installed event trigger outside repo migration history | ✓ Good (v1.3 Phase 14 W0 — post-deploy lint showed zero WARNs anyway; carve-out kept as documented insurance) |
| Fix-forward migration; no paired rollback for Migration 14 | Hardening-only change; rollback path is a functiondef snapshot under a service-role session | — Accepted (v1.3 Phase 14, D-08) |
| PostHog facade-only client + consent-gated `<PostHogGate>` lazy loader (no `PostHogProvider` context) | Lift PostHog off critical path without breaking the GDPR zero-pre-Allow-events invariant; no `usePostHog()` consumers per audit | ✓ Good (v1.3 Phase 16 — ~187 KB deferred; call sites byte-identical after import-path swap) |
| `manualChunks` function form (boundary-anchored regex) for `vendor-react` + lazy-only `vendor-posthog` | Cache-stable vendor splitting without kitchen-sink contamination | ✓ Good (v1.3 Phase 16 — vendor-react incl. scheduler as the React family) |
| `defaultPreload: 'intent'` app-wide + `preload={false}` on Admin links | App-wide hover-preload without leaking the V4 access-control boundary (hover-redirect) | ✓ Good (v1.3 Phase 16) |
| Single Lighthouse rerun on production per milestone (D-13) | Avoid repeated-run thrash; accept the one measured outcome | ✓ Good (v1.3 Phase 16 — 5/5 routes ≥ 90 in one run; UIDN-02 closed) |
| v1.1 MILESTONES entry manually curated, not CLI auto-extracted (DOCS-08) | CLI auto-extraction produces noisy "One-liner:" stubs | ✓ Good (v1.3 Phase 17 — re-confirmed when the v1.3 entry itself was auto-seeded; manual curation closes the gap permanently) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-03 — Phase 19 (DB Migration + A11y Restore) complete: DBHY-05 (Migration 15 session-GUC trusted-context gate, applied to local stack, lint clean, integration 6/6 incl. ordered RPC proof + GUC-leak guard) and UIDN-06 (CardTitle `asChild` polymorphism restoring native `<h2>` headings) validated. Suites green (unit 403/403, integration 32/32, @smoke 6/6); code review 0 blockers. Prod `--linked` migration deploy deferred to v1.4 milestone ship. Next: Phase 20 — Live Human UAT (Phase 03 UAT 2+3 non-member tester + Phase 04 UAT 6a second-admin demote).*
