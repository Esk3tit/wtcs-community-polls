# Milestones

## v1.0 — Launch-Ready MVP

**Shipped:** 2026-04-28
**Phases:** 1 → 6 (6 phases, 32 plans, 41 tasks)
**Tag:** `v1.0`
**Production URL:** https://polls.wtcsmapban.com
**Audit:** [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) — verdict `tech_debt` (no merge-blockers, no integration breaks, no broken flows)

### Delivered

A Discord-authenticated community suggestion and opinion-gathering platform for the War Thunder Competitive Scene, live at polls.wtcsmapban.com with 43 of 45 v1 requirements satisfied (UIDN-02 mobile + UIDN-03 Maia polish carried forward as evidence-driven closure under issue #18).

### Key Accomplishments

1. **Discord OAuth + DB foundation (Phase 1)** — Discord OAuth with mandatory 2FA enforced server-side via SECURITY DEFINER RPC (fail-closed), session persistence, full Supabase schema (7 tables, RLS default-deny), responsive light/dark app shell with shadcn/ui Maia preset + Tailwind CSS v4 + TanStack Router. 30 auth tests covering login, 2FA rejection, session, signOut.

2. **Browse + respond + reveal (Phase 2)** — Browsable suggestion list with category filtering and debounced text search; one-response-per-user enforcement via submit-vote Edge Function (UNIQUE constraint, 23505→409 mapping); respond-then-reveal results with HTTP polling at 8s; archive route for closed suggestions. 19 tests across vote-submission, results-visibility, suggestion-list.

3. **Response integrity (Phase 3)** — Discord guild membership verification at login via OAuth guilds scope (fail-closed AuthErrorPage with not-in-server variant) + Upstash Redis sliding-window rate limiting (5 req/60s) on submit-vote. 12 tests across 8 guild-callback failure modes + rate-limit EF + rate-limit toast.

4. **Admin panel end-to-end (Phase 4)** — Suggestion CRUD with images/timers/categories, lifecycle (auto-close via cron + polls_effective view, manual close, resolution status, archive with resolution badges), category CRUD, admin promote/demote with self-demote guard (D-06), 14 admin Edge Functions gated by shared `requireAdmin` helper, polls_effective view boundary CI-locked by invariant test that walks `src/routes` + `src/hooks` + `src/components`. 16 admin test files / 221 admin assertions.

5. **Production launch (Phase 5)** — polls.wtcsmapban.com live with Netlify SPA routing; Sentry error tracking with sourcemap upload; PostHog analytics with Discord-snowflake-only identify; Playwright @smoke E2E suite (4 specs); GH Actions CI (lint + unit + Supabase + Playwright + npm audit); Edge Function deploy workflow + 3-day Supabase keepalive cron + Dependabot.

6. **GDPR opt-IN + launch hardening (Phase 6)** — PostHog event capture and Sentry Replay default-OFF until user clicks Allow on the new opt-IN ConsentBanner (Sentry **error** capture remains unconditional per D-05); ConsentChip footer state-aware control with admin-route suppression; WTCS-branded favicon + meta polish; evidence-driven REQUIREMENTS sync (43 of 45 v1 reqs flipped to Complete with inline citations); auth bug closed as environmental (site-data clear restored login on Comet) via DEV-only `?debug=auth` overlay. 23+ new test assertions across ConsentContext + ConsentBanner + ConsentChip.

### Stats

| Metric | Value |
|--------|-------|
| Phases | 6 |
| Plans | 32 |
| Tasks | 41 |
| Source files (.ts/.tsx) | 141 |
| Lines of code | 13,602 |
| Test files | 41 |
| Unit tests | 378/378 passing |
| UAT cases | 47/50 passing (3 deferred — second-human-gated) |
| Edge Functions | 16 |
| DB Migrations | 10 |
| Total commits | 413 |
| Timeline | 2026-04-06 → 2026-04-28 (22 days) |

### Decimal Phases

None for v1.0 — all integer phases (1, 2, 3, 4, 5, 6). Phase 6 was added late as a cleanup phase (auth bug fix, GDPR opt-IN rewire, favicon polish, REQUIREMENTS sync) but uses integer numbering, not insertion semantics.

### Key Decisions (with outcomes)

| Decision | Outcome |
|----------|---------|
| Discord-native admin model (no cross-app sync) | ✓ Good — promote/demote in-app with server-side `requireAdmin`; self-demote UI guard |
| HTTP polling at 8s over WebSockets | ✓ Good — visibilityState-gated, sufficient at 20-30 concurrent |
| Pre-aggregated `vote_counts` via Postgres trigger | ✓ Good — fast read path, RLS-gated |
| Edge Functions for all writes; direct Supabase reads with RLS | ✓ Good — `polls_effective` view boundary CI-locked |
| Server-side 2FA verification via SECURITY DEFINER RPC | ✓ Good — fail-closed, enforced for every login |
| Upstash sliding-window 5 req/60s rate limit | ✓ Good — handles abuse without false positives |
| `polls_effective` lazy-close view + cron-sweep dual-write | ✓ Good — invariant test prevents direct `from('polls')` regressions |
| GDPR opt-IN consent (rewire from initial opt-OUT) | ✓ Good — PostHog smoke verified zero pre-Allow events |
| Sentry error capture unconditional (D-05); Replay consent-gated | ✓ Good — error visibility preserved without surveillance concern |
| Russian users expected to use VPN (no geo-gating) | ✓ Good — matches sister-site behavior; ISP-level blocks user-side |
| shadcn/ui Maia + Neutral preset + Tailwind v4 | ⚠️ Revisit — UIDN-03 closure evidence pending under issue #18 |
| Mobile-first responsive design | ⚠️ Revisit — UIDN-02 closure evidence pending under issue #18 |

### Issues Resolved During Milestone

- pg_cron concern resolved — Phase 5 used GH Actions cron instead (D-01)
- shadcn install path mismatch (Phase 1) — pinned in 01-01
- Husky pre-commit + pre-push hooks chmod restored (closed in Phase 6 commit a177f7c)
- Pre-existing 7 react-refresh/only-export-components lint errors (closed in quick-task 260421-vxb)
- Phase 6 UI-REVIEW priority items (closed in quick-task 260426-cty)
- DebugAuthOverlay Sentry breadcrumb merge bug (closed in quick-task 260427-dgh)

### Known Tech Debt → v1.1 (GitHub milestone)

**GitHub issues assigned to v1.1 milestone:**
- #11 — e2e: admin-create.spec.ts doesn't populate Choice 1/2 before submit
- #12 — e2e: browse-respond.spec.ts asserts vote count on fixture polls with zero votes
- #13 — e2e: filter-search.spec.ts toHaveCount() doesn't account for two-layer seed
- #17 — Sentry React SDK v10 + React 19 ErrorBoundary capture path silently broken
- #18 — UIDN-02 + UIDN-03 closure evidence (mobile-first responsive + shadcn Maia/Neutral polish)
- #19 — Vite/Rolldown sourcemap omits function names — Sentry shows minified `$M`

**Planning hygiene (no GitHub issue):**
- VALIDATION.md frontmatter stale on phases 01-04 (`status: draft`, `nyquist_compliant: false` — never refreshed post-execution); Phase 05 `status: planned`; Phase 06 `status: complete + nyquist_compliant: true`
- Phase 03 VERIFICATION.md retrospective backfill (work shipped + UAT 4/4 + Phase 05 transitively re-verified — pure documentation gap)
- 17 SUMMARY frontmatter `requirements-completed` declarations missing across phases 02 + 03-02 + 04-02/04-04 + 01-04
- Phase 04 UAT test 6a re-run once second admin (Discord ID 290377966251409410 / MapCommittee) signs in — demote click flow source-tested via 13 unit tests
- Phase 03 UAT tests 2 + 3 (Non-Member Login Rejection + Error Page Invite Link) re-run with second human (Discord member, no 2FA non-blocking)
- Cleanup: fake `admin_discord_ids` row '123456789012345678' in prod (harmless)
- Cleanup: 7 leftover '[E2E] Test:' polls in prod admin list

### Issues Deferred to v2

Per `REQUIREMENTS.md` v2 section (now archived): NOTF-01, NOTF-02 (Discord webhook notifications), VERF-01 (additional verification), ANLT-01, ANLT-02 (admin analytics), ABSE-01 (Cloudflare Turnstile).

---

*Milestone audit: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)*
*ROADMAP archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)*
*REQUIREMENTS archive: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)*
*GitHub v1.1 milestone: https://github.com/Esk3tit/wtcs-community-polls/milestone/1*
