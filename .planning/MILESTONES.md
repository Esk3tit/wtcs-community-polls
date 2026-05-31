# Milestones

## v1.2 — Admin Visibility Controls

**Shipped:** 2026-05-14
**Phases:** 11 → 13 (3 phases, 17 plans, 30 tasks)
**Tag:** `v1.2`
**Production URL:** https://polls.wtcsmapban.com (continuous since v1.0)
**Known deferred items at close:** 2 (see STATE.md Deferred Items)

### Delivered

Admin-controlled per-poll results visibility (`results_hidden` boolean + audit trail) with race-safe two-way toggle and voters-only privacy preserved, plus the v1.1 carry-forward UIDN closures (UIDN-03 shadcn-button sweep complete; UIDN-02 mobile audit rerun outcome DEFER per strict-floor MISS — Mobile-first Key Decision stays ⚠️ Revisit, follow-up trigger tied to next perf-budget change per D-12). 13 of 14 v1.2 requirements satisfied; UIDN-02 the one open row (deferred-by-design).

### Key Accomplishments

1. **Schema + RLS + EF foundations (Phase 11, 7 plans)** — Single atomic Migration 10: `polls.results_hidden` + `results_hidden_changed_at` columns, `audit_log` table (`target_id TEXT` for Discord-snowflake compat) with admin-only RLS, `polls_effective` view rewrite with `security_invoker = on` re-applied, and `vote_counts` SELECT policy rewrite (voter-EXISTS AND `results_hidden = false`; no admin OR-branch per VIS-04 + REVIEW-FIX-H3). Shared `writeAudit(...)` fail-open helper + admin-gated `toggle-results-visibility` EF with race-safe conditional UPDATE (audit row only on actual state change, per REVIEW-FIX-H4). 12 existing admin EFs retrofitted with `writeAudit` calls (no response-shape changes); `create-poll` extended to accept optional `results_hidden` body. 12-cell vote_counts RLS invariant matrix + admin-JWT regression sentinel (TEST-11) + 7-case toggle-EF authz suite (TEST-12) + 4-case create-poll audit suite. Migration 10 + 13 EFs deployed to production Supabase (`cbjspmwgyoxxqukcccjr`).

2. **Admin UI + User UI + UIDN-03 sweep (Phase 12, 8 plans)** — Vendored shadcn `Checkbox` + `Switch` primitives, regenerated `database.types.ts` for the Phase 11 schema deltas, added `npm run gen:types`. Admin-side: "Hide results from voters" `Checkbox` in `SuggestionForm` create flow (EF pass-through via strict-true coercion); inline `Switch` per admin row (`AdminSuggestionRow`) with state-mirroring + adaptive mobile/desktop + in-flight `Loader2` + symmetric sonner toast + revert-on-error, matching the `usePinPoll` precedent. Voter-side: `SuggestionCard` + archive view show breakouts only when voted **and** `results_hidden = false`; voters who voted see "Results temporarily hidden by admin" otherwise. **UIDN-03 sweep complete** — 4 native-`<button>` drift sites refactored (`SearchBar` clear, two `SuggestionForm` back-links → TanStack `<Link>`, `ImageInput` extracted to `<DropZone>` with shadcn `<Button variant="outline">` keyboard trigger separated from the `role="region"` drag target — closes the audit footnote [c] dual-role anti-pattern). TEST-13 Playwright `@smoke` spec: full SC4 round-trip (admin create → voter vote → admin Switch hide/show with `role="meter"` post-unhide assertion). Five REQUIREMENTS.md traceability marks (VIS-06/07/08, UIDN-03, TEST-13) flipped Pending → Complete.

3. **UIDN-02 mobile audit closure (Phase 13, 2 plans)** — Phase 9 Plan 02 harness defect fixed: fragile body-text hydration wait replaced with deterministic Navbar theme-toggle sentinel (`aria-label="Toggle color theme"` — unconditional render outside auth ternary); two-context Pass-B adds `memberUser` for authenticated `/topics` + `/archive` capture; Pass-A reduced to 3 unauth routes (AuthGuard renders `LandingPage` in place — by-design dupes dropped); sha256 uniqueness gate hard-fails before MANIFEST write with D-19 per-width home↔admin whitelist (Phase 9 D-06 intentional collision preserved). Result: 42 PNGs captured (18 unauth + 12 admin + 12 member), 0 DOM warnings, 0 unexpected sha256 collisions. Lighthouse audit ran once against v1.2 production (commit `de15e33`); 4/5 routes scored Perf < 90 (`/` 85, `/topics` 86, `/archive` 88, `/auth/error` 85, `/admin` 94) — outcome **MISS** per D-11 strict floor (perf-only failures; A11y / BP / SEO clear everywhere). `Mobile-first responsive design` Key Decision row stays ⚠️ Revisit; UIDN-02 Phase Traceability flips Pending → `Active (Phase 13 v1.2 rerun complete; pending next perf-budget change)`.

### Stats

| Metric | Value |
|--------|-------|
| Phases | 3 |
| Plans | 17 |
| Tasks | 30 |
| Files changed | 337 |
| Lines added / removed | +13,715 / −530 |
| Total commits (incl. fix passes) | 175 |
| PRs merged | 3 (#26, #28, #29) |
| Edge Functions added | 1 (`toggle-results-visibility`) |
| Edge Functions retrofitted | 12 (writeAudit) |
| DB Migrations | 1 (Migration 10) |
| Timeline | 2026-05-11 → 2026-05-14 (3 days) |

### Decimal Phases

None for v1.2 — all integer phases (11, 12, 13).

### Key Decisions (with outcomes)

| Decision | Outcome |
|----------|---------|
| Per-row `polls.results_hidden` boolean + two-way toggle (no window restriction) | ✓ Good — admins flip pre-/during-/post-voting; backwards compat (default `false`) preserves v1.0 RSLT-05 behavior |
| Service-role-only bypass on `vote_counts` (no admin OR-branch) | ✓ Good — REVIEW-FIX-H3 simplification; matches RLS principle of single trust path |
| Race-safe conditional UPDATE on toggle EF (`.not('results_hidden','is',hidden)`) | ✓ Good — REVIEW-FIX-H4 eliminates phantom-audit race under concurrent flips |
| `audit_log.target_id TEXT` (admits Discord snowflakes for promote-admin) | ✓ Good — REVIEW-FIX-C3/H1 avoids `writeAudit` fail-open silent drop |
| Optimistic `Switch` + sonner toast (NOT AlertDialog confirm) for VIS-07 | ✓ Good — D-01 wording revision; matches `usePinPoll` precedent for UX consistency |
| `<DropZone>` extraction for `ImageInput` (separate drag-region from keyboard-Browse trigger) | ✓ Good — closes UIDN-03 [c] dual-role anti-pattern; biggest UIDN-03 sweep site |
| Harness sentinel = `[aria-label="Toggle color theme"]` (Navbar unconditional) | ✓ Good — D-01/D-03; 42/42 PNGs clean, 0 DOM warnings, replaces Phase 9 networkidle defect |
| D-19 per-width home↔admin sha256 whitelist | ✓ Good — preserves Phase 9 D-06 intentional collision (AdminGuard → LandingPage at every width) without re-introducing loading-shell false-pass |
| Strict floor MISS for UIDN-02 Lighthouse (no D-14 ship-anyway) | ⚠️ Revisit — 4/5 routes Perf < 90 (perf-only); follow-up trigger = next perf-budget change per D-12 |
| `Mobile-first responsive design` Key Decision | ⚠️ Revisit — UIDN-02 closure-by-defer; row stays ⚠️ until perf-budget rerun lands |
| `shadcn/ui new-york + Tailwind CSS v4` Key Decision | ✓ Good — UIDN-03 4-site sweep complete; row flipped ⚠️ → ✓ in Phase 12 |

### Issues Resolved During Milestone

- Pre-existing local supabase-edge-runtime ES256 verification bug surfaced (1.73.x rejects auth-service-issued ES256 JWTs) — production unaffected (JWKS discovery); Phase 11 Plan 04 ran partial pass; full suite re-verified post-deploy via Phase 12 UAT
- `polls-effective-invariant` regex matched a WHY comment — Phase 12 review-fix re-tightened the boundary check
- Phase 9 Plan 02 hydration-wait defect (`waitForLoadState('networkidle')` + body-text filter) — closed by Phase 13 Plan 01 sentinel + two-context Pass-B
- D-23 inline-mirror sync hazard for `MEMBER_FIXTURE` — closed via bidirectional `// SYNC-CHECK:` breadcrumbs in audit-screenshots.mjs + e2e/fixtures/test-users.ts
- Per-task validation commands using soft `... | wc -l → N` could mark bad runs green — converted all 5 to `test "$(... | wc -l)" -eq N` hard-asserts (also surfaced + fixed a latent count bug: Task 13-02-01 expected 10 but actual is 11 including D-27 stdout log)

### Known Gaps Carried Forward

- **UIDN-02** — Mobile-first Lighthouse Perf threshold not yet met (4/5 routes < 90, all perf-only). Closure trigger per D-12 = next perf-budget change. REQUIREMENTS.md Phase Traceability row reads `Active (Phase 13 v1.2 rerun complete; pending next perf-budget change)`.

### Known Tech Debt (not v1.2-caused)

- 7 pre-Phase-11 SECURITY DEFINER advisor warnings on `update_profile_after_auth`, `handle_new_user`, `validate_vote_choice`, `increment_vote_count`, `is_current_user_admin`, `profile_self_update_allowed`, `rls_auto_enable`. WARN-level, predates v1.0. Track for v1.3+ hygiene phase.
- Local supabase-edge-runtime ES256 verification bug — affects `npm run test:integration` against local stack; prod unaffected.
- `11-PATTERNS.md` carries the legacy admin-OR-bypass form for the `vote_counts` policy skeleton; shipped form per REVIEW-FIX-H3 differs. Align in a future cleanup.
- `audit-mobile.sh` zsh `$status` collision (read-only builtin) — flagged in 13-02-SUMMARY.md; future shell snippets should use `audit_status` / `script_exit` instead.
- Phase 12 UAT status field reads `partial` and Phase 13 HUMAN-UAT reads `resolved` (both with 0 pending scenarios — see STATE.md Deferred Items for the acknowledgement note).

### Issues Deferred to v1.3+

Per `REQUIREMENTS.md` § Future Requirements (now archived):

- **UIDN-03-FOLLOWUP-LIST-CARDS** — `AdminsList` / `CategoriesList` / `PromoteAdminDialog` hand-rolled containers → shadcn `Card`. v1.1 Phase 9 audit transparency note (not a FAIL cell). Deferred per v1.2 scope-tight decision.
- **VIS-WINDOW** — Window-of-control enum (`pre_only` / `during` / `post`) restricting WHEN admin can toggle. Captured for future revisit if admins request guardrails.
- **VIS-PUBLIC-MODE** — Pre-vote public results visibility (non-voters see live counts). Dropped during v1.2 scoping; privacy boundary stays voters-only across all states.

---

*ROADMAP archive: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)*
*REQUIREMENTS archive: [milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md)*

---

## v1.1 — Hygiene & Polish

**Shipped:** 2026-05-11
**Phases:** 7 → 10 (4 phases, 16 plans)
**Tag:** `v1.1`
**Production URL:** https://polls.wtcsmapban.com (continuous since v1.0)
**Known deferred items at close:** 2 (UIDN-02 + UIDN-03 deferred via Path-3; carry-forward tokens tracked in v1.1-ROADMAP.md § Issues Deferred)

### Delivered

A maintenance/closure cycle with no new user-visible features. Production at https://polls.wtcsmapban.com is functionally identical to v1.0. The four phases tightened observability (OBSV-01/02), fixed E2E test honesty (TEST-07/08/09/10), captured deferred UI closure evidence (UIDN-04), and reconciled all v1.0 milestone-audit planning-artifact tech debt (DOCS-01/02/03/04). Two requirements (UIDN-02 mobile-first audit, UIDN-03 shadcn audit) were intentionally deferred to v1.2 via Path-3 acceptance — evidence captured, decision rows stay ⚠️ Revisit. 11/11 in-scope requirements satisfied (UIDN-02 + UIDN-03 deferred-accepted within Path-3).

### Key Accomplishments

1. **Observability hardening (Phase 7, 3 plans)** — React 19 `createRoot` error hooks wired to capture render-phase throws; Rolldown `keepNames: true` configured so sourcemap `names[]` arrays preserve function identifiers (eliminates Sentry's minified `$M` frames); env-gated `/__smoke` route + `RenderThrowSmoke` canary; deploy-preview Sentry event confirmed `mechanism.type === 'auto.function.react.error_handler'` + manual belt capture. OBSV-01 + OBSV-02 closed. Bundle cost +6.24% gzip (D-14 ship-anyway: observability gain outweighs free-tier bandwidth).

2. **E2E test hygiene (Phase 8, 4 plans)** — Three failing Playwright specs fixed: `admin-create.spec.ts`, `browse-respond.spec.ts`, `filter-search.spec.ts` migrated to `[E2E]`-scoped locators; `freshPoll` Playwright test-scoped fixture with try/catch/finally + AggregateError cleanup; ESLint `no-restricted-syntax` rule (E2E-SCOPE-1) prevents unscoped list locators; `e2e/README.md` + `npm run e2e` added. Second-human evidence for Phase 03 UAT tests 2+3 appended to `03-UAT.md` (test-dev-account, 2FA-enabled non-member, 2026-05-03). TEST-07/08/09/10 all closed.

3. **UI closure evidence (Phase 9, 4 plans)** — UIDN-04 atomic reconciliation: `components.json` `"new-york"` declared canonical, `DESIGN-SYSTEM.md` ADR-001 + PROJECT.md Constraints updated in one atomic commit. UIDN-02 and UIDN-03 selected Path-3 (defer to v1.2) — evidence archived at `.planning/closure/` with sha256-pinned MANIFEST. UIDN-02 hard-gate: Lighthouse Perf 5/5 routes below 90. UIDN-03 hard-gate: 4 native-`<button>` FAIL cells in `SearchBar.tsx`, `SuggestionForm.tsx`, `ImageInput.tsx`. Follow-up tokens set for v1.2.

4. **Planning hygiene backfill (Phase 10, 5 plans)** — All v1.0 phase directories (01–04) brought to post-Phase-05 planning-artifact schema: VALIDATION.md frontmatter migrated from `status: draft` to `status: complete`; retroactive `03-VERIFICATION.md` written; 9 SUMMARY `requirements-completed` declarations backfilled (≥2-of-3-sources D-08 cross-check); Phase 04 UAT 6a off-record demote-admin evidence appended. DOCS-01/02/03/04 closed.

### Stats

| Metric | Value |
|--------|-------|
| Phases | 4 |
| Plans | 16 |
| Non-planning files changed | 64 |
| Lines added / removed (non-planning) | +1,148 / −575 |
| Planning files changed | 197 |
| Lines added / removed (planning) | +23,502 / −1,006 |
| Total commits | 196 |
| PRs merged | 4 (#21, #22, #24, #25) |
| Edge Functions added | 0 |
| DB Migrations | 0 |
| Timeline | 2026-04-29 → 2026-05-11 (13 days) |

### Decimal Phases

None for v1.1 — all integer phases (7, 8, 9, 10). No urgent fixes required mid-cycle insertion semantics.

### Key Decisions (with outcomes)

| Decision | Outcome |
|----------|---------|
| D-08 (Phase 7): Manual deploy-preview evidence over CI-automated Sentry assertion | ✓ Good — single deploy-preview event closed OBSV-01 + OBSV-02; $0/mo budget constraint makes CI Sentry provisioning impractical |
| D-09 (Phase 7): OBSV-02 acceptance amended from `__name(...)` grep to literal-function-declaration grep | ✓ Good — Rolldown's Oxc minifier preserves names via literal `function Name(...)` (not esbuild helper idiom); verified empirically |
| D-14 (Phase 7): Ship-anyway on bundle-size overrun (+6.24% gzip vs 1.5% target) | ⚠️ Revisit — observability gain justified at v1.1; but bundle growth continued into v1.2/v1.3, triggering an aggressive perf-budget pass in v1.3 (Phase 16 UIDN-02 aggressive split + Lighthouse rerun) |
| D-11 (Phase 8): Async second-human evidence not blocking for Phase 8 closure | ⚠️ Revisit — async reconciliation gap discovered in v1.1 milestone audit (TEST-07..10 REQUIREMENTS.md checkboxes + 08-03-SUMMARY frontmatter never updated when evidence arrived); closed inline 2026-05-11; the pattern recurred in v1.2 (async evidence + deferred reconciliation) |
| Tri-branch Path-3 (Phase 9 plans 03/04): plan acceptance = clean pass / defer / override | ✓ Good — UIDN-02 and UIDN-03 deferred cleanly to v1.2 with carry-forward tokens; both eventually closed in v1.2 (UIDN-03 Phase 12 sweep) and v1.3 (UIDN-02 Lighthouse rerun PASS) |
| D-05 (Phase 10): Phase 10 does NOT close TEST-10 | ✓ Good — clear ownership boundary enforced (Phase 8 D-13); Phase 8 reconciliation closed inline in v1.1 audit |
| D-07/D-08 (Phase 10): REQ-ID declared in SUMMARY only when ≥2 of 3 sources agree | ✓ Good — surfaced 2 single-source VOTE-* candidates for explicit user resolution; prevents fabricated REQ-IDs |
| UIDN-04 ADR-001 (Phase 9 D-01): shadcn style canonicality = `new-york` per `components.json` | ✓ Good — 3-surface atomic flip unblocked UIDN-03; ADR-001 documents the reasoning for future readers; still canonical at v1.3 |

### Issues Resolved During Milestone

- **OBSV-01** (Sentry render-phase capture) — React 19 `createRoot` error hooks wired; deploy-preview event confirms capture path (issue #17 partially closed; residual transport investigation carried to v1.3 Phase 15)
- **OBSV-02** (un-mangled stack frames) — Rolldown `keepNames: true` configured; sourcemap `names[]` preserve identifiers; bundle delta documented (issue #19 partially closed; full sourcemap-names verification carried to v1.3 Phase 15)
- **TEST-07** (3 failing Playwright specs) — `admin-create` / `browse-respond` / `filter-search` migrated to `[E2E]`-scoped locators; CI green (issues #11, #12, #13 closed)
- **TEST-08** (ESLint E2E-SCOPE-1 rule) — `no-restricted-syntax` rule prevents unscoped list locators landing in `e2e/tests/`
- **TEST-09** (freshPoll fixture) — Playwright test-scoped fixture with try/catch/finally + AggregateError cleanup
- **TEST-10** (Phase 03 UAT 2+3 second-human evidence) — test-dev-account ran both tests on production 2026-05-03; evidence appended to `03-UAT.md` § Second-Human Verification
- **UIDN-04** (shadcn canonicality discrepancy) — `components.json` `"new-york"` declared canonical; ADR-001 authored; PROJECT.md + CLAUDE.md propagated atomically
- **DOCS-01** (VALIDATION frontmatter on phases 01-04) — 4 files migrated from `status: draft` to `status: complete + nyquist_compliant: true`
- **DOCS-02** (retroactive 03-VERIFICATION.md) — Full peer-template closure record written for Phase 03
- **DOCS-03** (9 SUMMARY `requirements-completed` declarations) — All 9 in-scope SUMMARY files declare REQ-IDs per ≥2-of-3-sources cross-check; 2 VOTE-* discrepancies surfaced and resolved by user sign-off (2026-05-07)
- **DOCS-04** (Phase 04 UAT 6a off-record evidence) — Demote-admin click flow PASS recorded via MapCommittee (Discord 290377966251409410)
- v1.1 milestone audit async-reconciliation gap closed inline (TEST-07..10 REQUIREMENTS.md + 08-03-SUMMARY frontmatter — commit `3dc02ff`)

### Known Gaps Carried Forward

- **UIDN-02** — Lighthouse Perf 5/5 routes below 90 target (mobile-first). Path-3 defer. Follow-up: "v1.2 perf budget hit + Plan 02 harness hydration-wait fix". Evidence: `.planning/closure/UIDN-02-mobile-evidence.md`.
- **UIDN-03** — 4 native-`<button>` FAIL cells (`SearchBar.tsx`, `SuggestionForm.tsx`, `ImageInput.tsx`). Path-3 defer. Follow-up: "v1.2 cleanup of 4 native-button drifts + authenticated Pass-A capture". Evidence: `.planning/closure/UIDN-03-shadcn-audit.md`.

### Known Tech Debt

- OBSV-01 residual: Sentry React 19 ErrorBoundary render-phase transport question not fully closed — the deploy-preview event confirmed the current hook path works, but the full SDK v10 transport investigation (issue #17 full scope) is carried to v1.3 Phase 15.
- OBSV-02 residual: Vite/Rolldown sourcemap function-name preservation (issue #19 full scope) carried to v1.3 Phase 15 for automated verification.
- Async reconciliation pattern: Phase 8 + Phase 10 both experienced async-evidence / deferred-frontmatter-update drift, caught and closed in the v1.1 audit. The pattern recurred in v1.2. v1.3 Phase 17 DOCS-07 added a systematic requirements-completed audit to prevent future drift.
- Out-of-scope from v1.0 audit tech_debt: fake admin Discord IDs in prod seed + leftover `[E2E] Test:` polls remain OPEN (data hygiene, not planning-artifact scope).

### Issues Deferred to v1.2+

- **UIDN-02** — Mobile-first Lighthouse Perf rerun after v1.2 perf-budget hit. Harness hydration-wait fix is the immediate prerequisite. Carry-forward token set.
- **UIDN-03** — v1.2 cleanup of 4 native-`<button>` drifts + authenticated Pass-A screenshot capture so `shadcn/ui new-york + Tailwind CSS v4` Key Decision row can flip ⚠️ → ✓.
- **Admin Visibility Controls (SEED-002)** — Per-suggestion results visibility toggle for admins (Tim's ask). Captured in `.planning/seeds/SEED-002-admin-controlled-results-visibility.md`; planned for v1.2.

---

*ROADMAP archive: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)*
*REQUIREMENTS archive: [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)*

---

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
