# WTCS Community Polls

## What This Is

A community suggestion and opinion-gathering platform for the War Thunder Competitive Scene (WTCS). Admins create suggestions/topics (e.g. "Remove MiG-29 12-3 from this lineup"), community members share their opinions via Discord OAuth. Hosted at polls.wtcsmapban.com as a sibling to the main WTCS Map Vote/Ban app — fully independent, sharing only admin accounts conceptually.

**User-facing name:** WTCS Community Suggestions
**Internal/admin name:** WTCS Community Polls (used in code, DB, admin UI)

## Core Value

Community members can share opinions on competitive scene proposals with confidence that results are authentic — one verified Discord account, one response, no manipulation.

## Framing

This platform gathers community **opinions**, not binding votes. Nothing on the site should imply that the most popular option will be implemented or that users are owed any outcome. WTCS is community-run with no direct authority over War Thunder's development — only Gaijin Entertainment can implement game changes. This platform collects and presents organized community feedback that WTCS admins can relay to Gaijin.

**User-facing terminology:** suggestions, topics, opinions, responses, community sentiment
**Avoid (user-facing):** vote, poll, voter, winner, decided, will be implemented

**Admin/internal terminology:** polls, votes — acceptable in admin UI, code, database, and planning docs

## Requirements

### Validated

- ✓ Vite + React 19 + TypeScript SPA scaffold — existing
- ✓ CSS custom properties with light/dark theme support — existing (to be replaced by shadcn/Tailwind)
- ✓ Responsive layout foundations — existing

### Active

- [ ] Discord OAuth login with mandatory 2FA enforcement (reject users without mfa_enabled)
- [ ] Official War Thunder esports Discord server membership verification for users responding
- [ ] Discord-native admin system: seed initial admins by Discord ID, admins promote others in-app
- [ ] Admin-only suggestion/topic creation with N configurable choices
- [ ] Optional image per suggestion (admin upload to Supabase Storage or external URL)
- [ ] Configurable timers (7 days, 2 weeks, custom) with auto-close
- [ ] Manual admin close at any time
- [ ] One response per Discord account per suggestion (enforced by UNIQUE constraint at DB level)
- [ ] Results hidden until user has responded; then show live percentages + raw response counts
- [ ] Results visible only to users who responded (even after suggestion closes)
- [ ] HTTP polling every 5-10 seconds for live response count updates
- [ ] Dynamic admin-created categories with tabs/pills filtering and search
- [ ] Ability to pin/highlight important suggestions
- [ ] Public archive of closed suggestions with status: Addressed / Forwarded / Closed
- [ ] Response writes through Supabase Edge Functions (server-side validation, rate limiting, abuse checks)
- [ ] Direct reads from browser via Supabase JS client + RLS
- [ ] Response counts aggregated via Postgres trigger into a response_counts table
- [ ] Mobile-first responsive design — phone screens are the primary experience (casual users tapping links from Discord)
- [ ] Supabase free tier keepalive via cron ping every 3-4 days
- [ ] shadcn/ui + Tailwind CSS v4 design system (Maia style, Neutral preset)
- [ ] Light and dark mode with system preference support

### Out of Scope

- Discord webhook notifications — v2 feature, not needed for launch
- War Thunder Discord server membership verification for admins — admins don't need to be in the server
- Admin dashboard analytics — defer to v2
- Real-time WebSockets — HTTP polling is sufficient at this scale
- OAuth providers other than Discord — Discord is the community's platform
- Cross-app admin sync with map vote — apps are independent, Discord-native admin model chosen
- Video or rich media in suggestions — images only, keep it simple
- Anonymous responses — Discord identity is core to response integrity
- Comments/discussion — discussion belongs in Discord

## Context

- **Sibling project:** WTCS Map Vote/Ban system at wtcsmapban.com uses Convex + Vite + React + TanStack Router. This app is fully independent but targets the same admin community.
- **Admin context:** Most admins are esports organizers, not technical users. UI/UX must be intuitive with minimal learning curve.
- **Community size:** ~300-400 respondents per week, ~20-30 concurrent at peak. Small enough for free tier services.
- **Primary user flow:** Admin shares a link in Discord → user clicks → lands on suggestion page → authenticates → responds → sees results.
- **Existing codebase:** Fresh Vite + React 19 + TypeScript scaffold. Moving to shadcn/ui + Tailwind CSS v4.
- **DNS:** CNAME on OVH pointing polls.wtcsmapban.com to Netlify.
- **Two separate surfaces:** User-facing (no admin awareness) and admin-facing (separate /admin/* routes).

## Constraints

- **Budget**: $0/month — Supabase free tier, Netlify legacy free tier, Upstash Redis free tier
- **Tech stack**: Vite + React + TypeScript + TanStack Router + shadcn/ui + Tailwind CSS v4 (frontend), Supabase (backend), Netlify (hosting) — all locked decisions
- **Auth**: Discord OAuth only, enforced via Supabase native Discord provider
- **Scale**: Must work within Supabase free tier limits (500MB DB, 1GB storage, 2M Edge Function invocations/month)
- **Hosting**: Netlify legacy free tier — separate site from main WTCS app
- **Rate limiting**: Upstash Redis free tier (if needed for abuse prevention)
- **Design system**: shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Discord-native admin model | Self-contained, no cross-app sync complexity. Admins promote others in-app. | — Pending |
| HTTP polling over WebSockets | Simpler, no Supabase Realtime dependency, sufficient at 20-30 concurrent users | — Pending |
| Response counts via Postgres trigger | Avoid counting on every read, pre-aggregated for fast polling | — Pending |
| Edge Functions for response writes | Server-side validation prevents client-side manipulation | — Pending |
| Supabase Storage + external URLs for images | Flexibility for admins — upload or paste a URL | — Pending |
| Results visible only to respondents | Encourages participation, prevents lurking on results | — Pending |
| Official WT esports Discord server membership required | Ensures only community members can respond | — Pending |
| Opinions-not-votes framing | WTCS has no authority over game changes; avoids false expectations | — Decided |
| shadcn/ui + Tailwind CSS v4 | Maia style, Neutral preset. Component library for consistent, rapid UI development | — Decided |
| Light + dark mode from day one | System preference support via shadcn theme toggle | — Decided |
| Status labels: Addressed/Forwarded/Closed | Neutral framing — no "Rejected" (negative) or "Implemented" (implies authority) | — Decided |
| Two separate surfaces (user/admin) | Users never see admin UI. Admin can use internal terminology freely. | — Decided |

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
*Last updated: 2026-04-06 after design system and terminology formalization*
