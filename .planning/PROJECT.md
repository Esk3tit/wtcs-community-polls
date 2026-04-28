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

**Shipped:** v1.0 — Launch-Ready MVP (2026-04-28)
**Production:** https://polls.wtcsmapban.com
**Code:** 13,602 LOC across 141 .ts/.tsx files, 41 test files, 16 Edge Functions, 10 DB migrations, 378/378 unit tests, 47/50 UAT cases (3 second-human-gated)

## Next Milestone Goals

**v1.1 — Hygiene & Polish** (planning via `/gsd-new-milestone`):
- E2E test fixture/seed cleanup (3 Playwright spec bugs filed under #11, #12, #13)
- Observability robustness — Sentry React 19 ErrorBoundary capture path (#17), Vite/Rolldown sourcemap function-name preservation (#19)
- UI design polish closure — UIDN-02 mobile-first responsive evidence + UIDN-03 shadcn Maia/Neutral polish (#18)
- Planning hygiene backfill — VALIDATION.md frontmatter on phases 01–04, Phase 03 VERIFICATION.md retrospective, 17 SUMMARY frontmatter `requirements-completed` declarations
- 2 deferred UAT items (Phase 03 tests 2+3 — non-member rejection + invite link; Phase 04 test 6a — demote click flow)

GitHub milestone: https://github.com/Esk3tit/wtcs-community-polls/milestone/1

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

### Active (v1.1 — Hygiene & Polish)

- [ ] **UIDN-02**: Mobile-first responsive design — closure evidence (Lighthouse + UI audit) — issue #18
- [ ] **UIDN-03**: Modern polished visual design — shadcn Maia/Neutral closure evidence — issue #18
- [ ] Playwright E2E spec fixture/seed hygiene (issues #11, #12, #13)
- [ ] Sentry React 19 ErrorBoundary capture transport (issue #17)
- [ ] Vite/Rolldown sourcemap function-name preservation (issue #19)
- [ ] VALIDATION.md frontmatter backfill on phases 01–04
- [ ] Phase 03 VERIFICATION.md retrospective
- [ ] 17 SUMMARY frontmatter `requirements-completed` declarations
- [ ] Phase 03 UAT tests 2 + 3 with second human (no 2FA)
- [ ] Phase 04 UAT test 6a once second admin signs in

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
- **Design system**: shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font

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
| shadcn/ui + Tailwind CSS v4 (Maia/Neutral) | Component library for consistent rapid UI development | ⚠️ Revisit (UIDN-03 closure evidence pending — issue #18) |
| Light + dark mode from day one | System preference support via shadcn theme toggle | ✓ Good (v1.0) |
| Status labels: Addressed/Forwarded/Closed | Neutral framing — avoids "Rejected" or "Implemented" | ✓ Good (v1.0) |
| Two separate surfaces (user/admin) | Users never see admin UI | ✓ Good (v1.0 — AdminGuard + admin-route ConsentBanner suppression) |
| Server-side 2FA via SECURITY DEFINER RPC (fail-closed) | Cannot be bypassed by client manipulation | ✓ Good (v1.0) |
| Upstash sliding-window 5 req/60s | Free tier, handles abuse without false positives | ✓ Good (v1.0) |
| `polls_effective` lazy-close view + cron-sweep dual-write | Closes suggestions reliably even on free tier without pg_cron | ✓ Good (v1.0 — invariant test prevents `from('polls')` regressions) |
| GDPR opt-IN consent (Phase 6 rewire from initial opt-OUT) | EU compliance; analytics off until user clicks Allow | ✓ Good (v1.0 — PostHog smoke verified zero pre-Allow events) |
| Sentry error capture unconditional; Replay consent-gated | Error visibility preserved; Replay PII-sensitive only on Allow | ✓ Good (v1.0 — D-05) |
| Russian users expected to use VPN (no geo-gating) | Matches sister-site behavior; ISP-level blocks user-side | ✓ Good (v1.0 — no detection logic) |
| Mobile-first responsive design | Discord users tap links from phones | ⚠️ Revisit (UIDN-02 closure evidence pending — issue #18) |
| Phase numbering: integers + decimal-insertions | Clear insertion semantics for urgent fixes | — Pending (no decimals used in v1.0) |
| Sentry React SDK v10 + ErrorBoundary | Render-phase throws don't ship via ErrorBoundary capture path | ⚠️ Revisit (issue #17 — pivoted to event-handler throw for D-08 verification) |

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
*Last updated: 2026-04-28 after v1.0 milestone (Launch-Ready MVP) shipped*
