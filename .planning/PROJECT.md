# WTCS Community Polls

## What This Is

A community suggestion and voting platform for the War Thunder Competitive Scene (WTCS). Admins create polls (e.g. "Remove MiG-29 12-3 from this lineup"), community members vote on them via Discord OAuth. Hosted at polls.wtcsmapvote.com as a sibling to the main WTCS Map Vote/Ban app — fully independent, sharing only admin accounts conceptually.

## Core Value

Community members can vote on competitive scene proposals with confidence that results are legitimate — one verified Discord account, one vote, no manipulation.

## Requirements

### Validated

- ✓ Vite + React 19 + TypeScript SPA scaffold — existing
- ✓ CSS custom properties with light/dark theme support — existing
- ✓ Responsive layout foundations (mobile breakpoint at 1024px) — existing

### Active

- [ ] Discord OAuth login with mandatory 2FA enforcement (reject users without mfa_enabled)
- [ ] Discord account age check (reject accounts < 30 days)
- [ ] Official War Thunder esports Discord server membership verification for voters
- [ ] Discord-native admin system: seed initial admins by Discord ID, admins promote others in-app
- [ ] Admin-only poll creation with N configurable choices
- [ ] Optional image per poll (admin upload to Supabase Storage or external URL)
- [ ] Configurable poll timers (7 days, 2 weeks, custom) with auto-close
- [ ] Manual admin close at any time
- [ ] One vote per Discord account per poll (UNIQUE constraint at DB level)
- [ ] Results hidden until user has voted; then show live percentages + raw vote counts
- [ ] Results visible only to users who voted (even after poll closes)
- [ ] HTTP polling every 5-10 seconds for live vote count updates
- [ ] Dynamic admin-created categories with tabs/pills filtering and search
- [ ] Ability to pin/highlight important polls
- [ ] Public archive of closed polls with status: Rejected / Processing / Implemented
- [ ] Vote writes through Supabase Edge Functions (server-side validation, rate limiting, abuse checks)
- [ ] Direct reads from browser via Supabase JS client + RLS
- [ ] Vote counts aggregated via Postgres trigger into vote_counts table
- [ ] Mobile-first responsive design — phone screens are the primary experience (casual users tapping links from Discord)
- [ ] Supabase free tier keepalive via cron ping every 3-4 days

### Out of Scope

- Discord webhook notifications — v2 feature, not needed for launch
- War Thunder Discord server membership verification for admins — admins don't need to be in the server
- Admin dashboard analytics — defer to v2
- Real-time WebSockets — HTTP polling is sufficient at this scale
- OAuth providers other than Discord — Discord is the community's platform
- Cross-app admin sync with map vote — apps are independent, Discord-native admin model chosen
- Video or rich media in polls — images only, keep it simple
- Anonymous voting — Discord identity is core to vote integrity

## Context

- **Sibling project:** WTCS Map Vote/Ban system at wtcsmapvote.com uses Convex + Vite + React + TanStack Router. This polls app is fully independent but targets the same admin community.
- **Admin context:** Most admins are esports organizers, not technical users. UI/UX must be intuitive with minimal learning curve.
- **Community size:** ~300-400 voters per week, ~20-30 concurrent at peak. Small enough for free tier services.
- **Existing codebase:** Fresh Vite + React 19 + TypeScript scaffold with basic CSS theming. No routing, state management, or backend integration yet.
- **DNS:** CNAME on OVH pointing polls.wtcsmapvote.com to Netlify.

## Constraints

- **Budget**: $0/month — Supabase free tier, Netlify legacy free tier, Upstash Redis free tier
- **Tech stack**: Vite + React + TypeScript + TanStack Router (frontend), Supabase (backend), Netlify (hosting) — all locked decisions
- **Auth**: Discord OAuth only, enforced via Supabase native Discord provider
- **Scale**: Must work within Supabase free tier limits (500MB DB, 1GB storage, 2M Edge Function invocations/month)
- **Hosting**: Netlify legacy free tier — separate site from main WTCS app
- **Rate limiting**: Upstash Redis free tier (if needed for abuse prevention)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Discord-native admin model | Self-contained, no cross-app sync complexity. Admins promote others in-app. | — Pending |
| HTTP polling over WebSockets | Simpler, no Supabase Realtime dependency, sufficient at 20-30 concurrent users | — Pending |
| Vote counts via Postgres trigger | Avoid counting on every read, pre-aggregated for fast polling | — Pending |
| Edge Functions for vote writes | Server-side validation prevents client-side manipulation | — Pending |
| Supabase Storage + external URLs for images | Flexibility for admins — upload or paste a URL | — Pending |
| Results visible only to voters | Encourages participation, prevents lurking on results | — Pending |
| Official WT esports Discord server membership required for voters | Ensures only community members can vote | — Pending |
| Cloudflare Turnstile CAPTCHA optional | Only enable if suspicious traffic detected, not default | — Pending |

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
*Last updated: 2026-04-06 after initialization*
