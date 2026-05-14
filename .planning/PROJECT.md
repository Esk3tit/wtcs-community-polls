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

**Shipped:** v1.2 — Admin Visibility Controls (2026-05-14)
**Previous:** v1.1 — Hygiene & Polish (2026-05-11) · v1.0 — Launch-Ready MVP (2026-04-28)
**Production:** https://polls.wtcsmapban.com — first user-visible feature delta since v1.0 (admin per-poll results-hide toggle + audit trail).
**Code (cumulative through v1.2):** v1.0 baseline 13,602 LOC + v1.1 delta + v1.2 delta (+13,715 / −530 across 337 files in v1.2 commit range; planning-doc-heavy); 17 Edge Functions (one new: `toggle-results-visibility`); 11 DB migrations (Migration 10 = `results_hidden` + `audit_log` + `vote_counts` RLS rewrite); v1.2 added the 12-cell vote_counts RLS matrix (TEST-11) + 7-case toggle EF authz suite (TEST-12) + Playwright SC4 round-trip (TEST-13).
**Tests:** Playwright E2E suite now includes the `@smoke` SC4 round-trip with `role="meter"` post-unhide assertion; integration test scaffolding (Vitest) wired with zero new dependencies.
**v1.2 archives:** [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · [milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md) (no separate v1.2 audit file; pre-close artifact audit + Phase 13 verification covered this)
**v1.1 archives:** [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) · [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md) · [milestones/v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md)

## Next Milestone Goals

**Status:** Awaiting v1.3 scoping (`/gsd-new-milestone` to begin questioning → research → requirements → roadmap).

**Carry-forward debt likely to scope into v1.3:**
- **UIDN-02** — Mobile-first Lighthouse Perf trigger per D-12 (next perf-budget change). Current row stays ⚠️ Revisit; closure file at `.planning/closure/UIDN-02-mobile-evidence.md § v1.2 Rerun`. Open in REQUIREMENTS Phase Traceability as `Active`.
- **UIDN-03-FOLLOWUP-LIST-CARDS** — `AdminsList` / `CategoriesList` / `PromoteAdminDialog` → shadcn `Card` (audit transparency note, not a FAIL cell).
- **7 pre-Phase-11 SECURITY DEFINER advisor warnings** — pre-v1.0, WARN-level. Track for v1.3 hygiene phase.

GitHub milestone: TBD on v1.3 scoping.

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

### Active (carry-forward to v1.3+)

- [ ] **UIDN-02**: Mobile-first Lighthouse Perf threshold — Phase 13 v1.2 rerun complete; 4/5 routes Perf<90 (perf-only); closure trigger per D-12 = next perf-budget change. `Active (Phase 13 v1.2 rerun complete; pending next perf-budget change)` in REQUIREMENTS Phase Traceability.
- [ ] **UIDN-03-FOLLOWUP-LIST-CARDS**: `AdminsList` / `CategoriesList` / `PromoteAdminDialog` hand-rolled containers → shadcn `Card` (audit transparency note, not a FAIL cell)
- [ ] Playwright E2E spec fixture/seed hygiene (issues #11, #12, #13)
- [ ] Sentry React 19 ErrorBoundary capture transport (issue #17)
- [ ] Vite/Rolldown sourcemap function-name preservation (issue #19)
- [ ] VALIDATION.md frontmatter backfill on phases 01–04
- [ ] Phase 03 VERIFICATION.md retrospective
- [ ] 17 SUMMARY frontmatter `requirements-completed` declarations
- [ ] Backfill Phase 04 UAT test 6a evidence (demote click flow — passed off-record on second admin, needs 04-UAT.md update)
- [ ] Phase 03 UAT tests 2 + 3 with second human (2FA-enabled, non-WTCS-member Discord tester — 2FA must be ON so the gate clears and the non-member check fires)
- [ ] 7 pre-Phase-11 SECURITY DEFINER advisor warnings (WARN-level, predates v1.0)
- [ ] Local supabase-edge-runtime ES256 verification bug (1.73.x; affects `npm run test:integration` only; production unaffected)
- [ ] `11-PATTERNS.md` drift: still carries legacy admin-OR-bypass form for `vote_counts` skeleton; shipped form per REVIEW-FIX-H3 differs

### Planned for v1.3 (TBD)

- Awaiting `/gsd-new-milestone` scoping. UIDN-02 perf budget revisit + hygiene cleanup are likely candidates.

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
| Mobile-first responsive design | Discord users tap links from phones | ⚠️ Revisit (v1.2 rerun — 4/5 routes under threshold; follow-up tied to next perf-budget change per D-12; see .planning/closure/UIDN-02-mobile-evidence.md § v1.2 Rerun) |
| Phase numbering: integers + decimal-insertions | Clear insertion semantics for urgent fixes | — Pending (no decimals used in v1.0/v1.1/v1.2) |
| Sentry React SDK v10 + ErrorBoundary | Render-phase throws don't ship via ErrorBoundary capture path | ⚠️ Revisit (issue #17 — pivoted to event-handler throw for D-08 verification) |
| Admin per-poll `results_hidden` + two-way toggle (no window restriction) | Tim's ask reframed during v1.2 scoping from 3-mode enum + one-way reveal to single boolean + symmetric toggle for simplicity | ✓ Good (v1.2 — race-safe conditional UPDATE; voters-only privacy preserved) |
| Service-role-only bypass on `vote_counts` SELECT RLS (no admin OR-branch) | Single trust path per RLS principle | ✓ Good (v1.2 — REVIEW-FIX-H3) |
| `audit_log.target_id TEXT` (admits Discord snowflakes) | `promote-admin` Branch 2 needs snowflake support; UUID-only would silently fail-open via writeAudit | ✓ Good (v1.2 — REVIEW-FIX-C3/H1) |
| Optimistic `Switch` + sonner toast (NOT AlertDialog confirm) for VIS-07 | Matches `usePinPoll` precedent; AlertDialog felt heavyweight for a reversible flip | ✓ Good (v1.2 — D-01 wording revision) |
| `<DropZone>` extraction in `ImageInput` (separate drag-region from keyboard-Browse trigger) | Closes UIDN-03 [c] dual-role anti-pattern | ✓ Good (v1.2 — biggest UIDN-03 sweep site) |
| Phase 9 harness sentinel = `[aria-label="Toggle color theme"]` (Navbar unconditional) | Phase 9 Plan 02 networkidle defect produced loading-shell captures; deterministic sentinel + .catch() preserves diagnostic screenshots on timeout | ✓ Good (v1.2 Phase 13 — 42/42 PNGs clean, 0 DOM warnings) |
| D-19 per-width home↔admin sha256 whitelist | AdminGuard navigates unauth `/admin` → `/` (Phase 9 D-06 evidence); intentional collision preserved while loading-shell false-pass still hard-fails | ✓ Good (v1.2 Phase 13 — sha256 uniqueness gate hard-fails before MANIFEST write) |

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
*Last updated: 2026-05-14 — v1.2 Admin Visibility Controls milestone shipped (13/14 reqs satisfied; UIDN-02 carry-forward to v1.3+); v1.2 archived to `milestones/v1.2-*.md`.*
