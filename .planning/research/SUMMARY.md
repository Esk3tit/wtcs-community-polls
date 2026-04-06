# Project Research Summary

**Project:** WTCS Community Polls
**Domain:** Discord-authenticated community polling platform (esports governance)
**Researched:** 2026-04-06
**Confidence:** HIGH

## Executive Summary

WTCS Community Polls is a purpose-built governance voting tool for a competitive esports community (~300-400 weekly voters). Unlike generic polling platforms, it enforces verified identity: users must authenticate via Discord OAuth, belong to the official War Thunder esports server, have 2FA enabled, and have a Discord account older than 30 days. These constraints — combined with server-side vote validation via Supabase Edge Functions and a pre-aggregated vote count trigger — make vote manipulation dramatically harder than anything achievable with Discord native polls, EasyPoll, or StrawPoll. The recommended architecture is a React SPA on Netlify backed entirely by Supabase (Postgres + Auth + Edge Functions + Storage), with Upstash Redis for rate limiting. The stack is already partially in place (React 19, TypeScript, Vite), and the remaining dependencies are well-established libraries with strong community support.

The single most important architectural decision is the split read/write path: direct Supabase JS reads for poll listing and browsing (gated by RLS policies), and Edge Function writes for vote casting, poll creation, and admin actions (validated server-side with the service_role key). This is not optional — client-side validation can be bypassed by calling the Supabase REST API directly. Vote integrity rests on three layers: a database `UNIQUE(poll_id, user_id)` constraint (prevents duplicates regardless of application logic), RLS policies on `vote_counts` that only expose results to voters, and Edge Function eligibility checks at vote time (Discord server membership, MFA, account age). Build these three layers in Phase 1 or do not ship.

The primary risk is a security oversight during development: forgetting to enable RLS on a table, exposing individual vote records, or checking Discord membership only at login rather than at vote time. The secondary risk is infrastructure: Supabase pauses free-tier projects after 7 days of inactivity, requiring a keepalive cron job before go-live. At the target scale, cost and performance are non-issues — the entire infrastructure runs on free tiers with headroom to spare.

## Key Findings

### Recommended Stack

The stack is a tight, modern TypeScript React SPA with TanStack Router (file-based, type-safe routing) and TanStack Query (HTTP polling for live vote counts). Supabase is the entire backend: Postgres with RLS and triggers, Discord OAuth via native provider, Edge Functions (Deno runtime) for server-side writes, and Storage for poll images. Upstash Redis handles rate limiting within Edge Functions. Zustand manages thin client state (auth, UI), and react-hook-form handles the admin poll creation form. No component library or CSS framework is needed — the app has ~6 views, and CSS custom properties with dark mode are already wired up.

HTTP polling via `refetchInterval` in TanStack Query is the explicit recommendation over Supabase Realtime WebSockets. At 20-30 concurrent users, polling every 5-10 seconds is indistinguishable from real-time and avoids Realtime connection limits on the free tier.

**Core technologies:**
- React 19 + TypeScript + Vite: already installed; foundation is done
- TanStack Router v1: locked decision; type-safe file-based routing with `autoCodeSplitting`
- TanStack Query v5: server state and HTTP polling via `refetchInterval`
- Supabase JS v2: single SDK for Postgres reads, Discord OAuth, Edge Function calls, Storage
- Supabase Edge Functions (Deno): all write operations — vote casting, poll creation, admin actions
- Zustand v5: client state (auth session, UI state); replaces Context to avoid full-subtree re-renders
- react-hook-form v7: admin poll creation form only; `useFieldArray` for dynamic choices
- Upstash Redis + @upstash/ratelimit: sliding-window rate limiting inside Edge Functions
- Cloudflare Turnstile: optional bot protection, activate only if abuse is detected

### Expected Features

The key insight from feature research is that the platform's differentiators are NOT cosmetic — they are integrity features that cannot be retrofitted after launch. Vote-then-reveal results, server membership verification, and results restricted to voters only must be designed into the data model and RLS policies from day one, not added afterward.

**Must have (table stakes):**
- Discord OAuth with one-vote-per-user enforcement — core integrity; nothing works without it
- Multiple choice options per poll — every polling tool has this
- Poll timer with auto-close via pg_cron — users expect polls to end
- Results display (percentages + counts) — baseline expectation
- Mobile-responsive design — 60-70% of Discord users are on mobile
- Admin-only poll creation — prevents spam and troll polls
- Poll listing and browsing with categories — users need to find polls
- Dark mode — Discord users expect it

**Should have (differentiators that must be built early):**
- Discord server membership verification — the strongest anti-manipulation feature; use Bot token, not OAuth `guilds` scope
- 2FA enforcement — rejects throwaway/bot accounts; no polling tool does this
- Account age check (30-day minimum) — prevents sockpuppet accounts
- Vote-then-reveal results — prevents bandwagon voting; enforced in RLS, not just UI
- Results restricted to voters only — even after close; enforced in RLS on `vote_counts`
- Server-side vote validation via Edge Functions — mandatory; client-side checks can be bypassed
- Pre-aggregated vote counts via Postgres trigger — prevents COUNT(*) on every read

**Defer (v2+):**
- Poll images — nice-to-have; text polls work fine for launch
- Poll archive with Rejected/Processing/Implemented status labels — can ship with open/closed only initially
- Pin/highlight — simple DB flag, add in a fast follow
- Search — not needed until 50+ polls exist
- Discord webhook notifications — explicitly out of scope for v1

**Explicit anti-features (never build):**
- Anonymous voting, multiple OAuth providers, ranked-choice voting, user-created polls, comments/discussion, detailed analytics, email notifications, weighted voting, blockchain voting

### Architecture Approach

The architecture follows a split read/write pattern. Reads go directly from the React SPA through the Supabase JS client to Postgres via RLS policies — these are simple, cacheable, and can be secured without server intermediaries. Writes (votes, poll creation, admin actions) always go through Edge Functions that use the `service_role` key to bypass RLS and perform validations that RLS cannot: Discord API calls, rate limit checks, complex business logic. The `vote_counts` table is maintained by a Postgres trigger on INSERT to `votes`, making every read of vote counts a simple indexed lookup rather than an expensive COUNT aggregate. pg_cron handles poll auto-close internally, with no Edge Function invocation cost.

**Major components:**
1. React SPA (Netlify) — routing, UI rendering, HTTP polling loop, auth state via Zustand; direct Supabase JS reads
2. Supabase Auth — Discord OAuth flow, JWT issuance, session management; `provider_token` available only at callback
3. Supabase Edge Functions (Deno) — vote casting, poll creation, admin actions, Discord membership verification; use service_role
4. Supabase Postgres + RLS — 6 core tables with explicit policies; `votes` and `vote_counts` are the integrity core
5. Upstash Redis — rate limiting within Edge Functions via sliding-window algorithm
6. Discord Bot API — server membership verification server-to-server; Bot token stored as Supabase secret

### Critical Pitfalls

1. **RLS disabled or misconfigured on vote tables** — Enable RLS on every table immediately upon creation, before writing any application code. The anon key is in client-side JavaScript; without RLS, anyone can read or manipulate the entire database. Test by querying tables directly with the anon key.

2. **No UNIQUE constraint on votes(poll_id, user_id)** — This single DDL line is the most important in the project. Application-level duplicate checks are vulnerable to race conditions (TOCTOU). The database constraint must exist from the first migration. Use `INSERT ... ON CONFLICT DO NOTHING`.

3. **Client-side-only vote validation** — Supabase's REST API is publicly accessible. All vote eligibility checks (poll open, not already voted, Discord membership, account age, MFA) must run in Edge Functions. Never ship client-side-only vote submission, even for testing.

4. **Wrong Discord membership verification architecture** — The OAuth `guilds` scope is invasive (users see all their servers) and only checks at login time. Use a Discord Bot token to call `GET /guilds/{guild_id}/members/{user_id}` at vote time, cached for 5-15 minutes. The Bot must be added to the WTCS server.

5. **Supabase free-tier database pausing** — After 7 days of inactivity, the project pauses. After 90 days paused, data is unrecoverable. Set up a GitHub Actions keepalive cron job (every 3-4 days) before go-live, not after the first incident.

## Implications for Roadmap

Based on research, the dependency chain is rigid: Schema -> Auth -> Reads -> Writes -> Admin -> Polish. Any deviation from this order creates rework. The security architecture (RLS, UNIQUE constraint, Edge Function validation) cannot be bolted on after features are built — it must be the foundation.

### Phase 1: Foundation and Security Core

**Rationale:** Everything depends on auth and schema. RLS policies and the UNIQUE constraint on votes must exist before any application code touches vote data. Building these correctly from the start prevents rewrites — retrofitting security onto an existing app is significantly more expensive than doing it right first.
**Delivers:** Supabase project with full schema, RLS policies, database triggers, Discord OAuth working, user profile sync, admin seeding. A logged-in user can see their session; an admin can be identified.
**Addresses:** All table-stakes auth features — Discord OAuth, one-vote-per-user constraint, dark mode (already done), mobile-responsive foundation
**Avoids:** Pitfalls 1 (RLS misconfiguration), 2 (vote duplication race condition), 5 (database pausing — keepalive setup here), 14 (anon vs service_role key confusion)
**Stack used:** Supabase (schema + RLS + triggers + pg_cron + Auth), TanStack Router (basic routing scaffold), Zustand (auth state), Supabase CLI (local dev)

### Phase 2: Core Poll Listing and Voting

**Rationale:** The read path (poll listing, browsing by category) is simpler than the write path and establishes patterns for the rest of the app. Once reads work, voting via Edge Function follows naturally. Results display must be built alongside voting — vote-then-reveal cannot be added later without changing data contracts.
**Delivers:** Working poll listing page with category tabs, poll detail view, vote casting via Edge Function, live vote count HTTP polling, vote-then-reveal results, results restricted to voters only.
**Addresses:** Poll listing/browsing, single-choice voting, vote-then-reveal, live results, server-side validation, pre-aggregated vote counts, HTTP polling
**Avoids:** Pitfalls 3 (client-side validation), 6 (exposing individual vote records), 7 (timezone handling — use timestamptz throughout), 8 (polling overload — poll vote_counts not raw votes), 10 (results visibility RLS leak)
**Stack used:** TanStack Query (refetchInterval polling), Supabase Edge Functions (cast-vote), supabase-js (read path), Zustand, sonner (vote success/error toasts)

### Phase 3: Auth Integrity Layer

**Rationale:** Discord server membership verification, 2FA enforcement, and account age checks are the platform's core differentiators. They belong in Phase 3 (after the basic vote flow works) rather than Phase 1 because they require a Discord Bot setup and add complexity to the Edge Function. However, they must be in place before any public launch — stub them in Phase 2 with a feature flag, implement fully in Phase 3.
**Delivers:** Discord Bot configured and added to WTCS server. `/cast-vote` Edge Function fully validates: server membership (Bot token, cached 5-15 min), MFA enabled, account age ≥ 30 days. Graceful error states for failing checks. Upstash Redis rate limiting on vote submission.
**Addresses:** Discord server membership verification, 2FA enforcement, account age check, rate limiting
**Avoids:** Pitfall 4 (wrong guild membership architecture — use Bot token, not guilds OAuth scope), Pitfall 12 (MFA/age checks must run at vote time, not just login)
**Stack used:** Discord Bot API, Upstash Redis + @upstash/ratelimit, Supabase Edge Functions (_shared/discord.ts helper)

### Phase 4: Admin Panel

**Rationale:** Admin features require the read/write patterns established in Phases 2-3. Admin privilege must be server-side verified (Edge Function checks profiles.is_admin, not client UI). Poll creation is the most complex write operation (multiple DB inserts in a transaction, optional image upload, category assignment).
**Delivers:** Admin guard (route-level and Edge Function-level), poll creation form with dynamic choices, category management, poll close with resolution status, admin promotion/demotion, poll pin/highlight.
**Addresses:** Admin-only poll creation, categories, poll timer/auto-close, resolution status (Rejected/Processing/Implemented), pinned polls
**Avoids:** Pitfall 11 (admin privilege escalation — server-side verification mandatory), Pitfall 13 (image size limits: max 1MB, client-side compression before upload)
**Stack used:** react-hook-form + useFieldArray (dynamic choices), Supabase Storage (poll images), Supabase Edge Functions (create-poll, admin), AdminGuard component

### Phase 5: Polish and Deployment Hardening

**Rationale:** Once core functionality works, remaining features are additive and independently deployable. This phase also addresses operational concerns (keepalive, monitoring) that must be in place before going public.
**Delivers:** Poll archive page with resolution status display, search (if poll count warrants), image upload for polls, optional Cloudflare Turnstile if abuse detected, GitHub Actions keepalive cron, UptimeRobot monitoring, Netlify deploy with `_redirects` for SPA routing, CNAME to polls.wtcsmapvote.com.
**Addresses:** Poll archive, optional CAPTCHA, deployment infrastructure
**Avoids:** Pitfall 5 (database pausing — keepalive cron job), Pitfall 9 (Discord OAuth token refresh — test session expiry UX before launch)
**Stack used:** Cloudflare Turnstile (optional), GitHub Actions, Netlify, date-fns (archive date formatting)

### Phase Ordering Rationale

- Schema and RLS cannot follow auth — they must be simultaneous. A profile sync trigger on `auth.users` requires the profiles table to exist before the first OAuth login.
- Vote-then-reveal and results-restricted-to-voters are RLS policies, not UI features. They must be designed in Phase 2 alongside the schema additions, not added in Polish.
- Discord Bot membership verification (Phase 3) is separated from basic auth (Phase 1) because it requires external coordination (adding a Bot to the server) and is safely stubbable behind a feature flag during Phase 2 development.
- Admin panel (Phase 4) depends on established Edge Function patterns from Phase 2-3. Attempting to build admin creation before the vote write path is proven leads to inconsistent patterns.
- The keepalive cron (Phase 5) must be deployed before any public announcement, not after the first pause incident.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Auth Integrity):** Discord Bot API setup, guild member endpoint behavior, provider_token availability after initial callback — verify exact Supabase Discord metadata field paths (`mfa_enabled` location in `raw_user_meta_data`). The STACK.md notes this path needs verification.
- **Phase 1 (Foundation):** pg_cron availability on free tier — confirmed available but verify current Supabase dashboard UI for enabling it. Local Supabase CLI setup for Edge Function testing needs walkthrough.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Core Polling):** TanStack Query + Supabase read patterns are extremely well-documented. HTTP polling with `refetchInterval` is a solved problem.
- **Phase 4 (Admin Panel):** react-hook-form with `useFieldArray` is standard; Supabase Storage upload patterns are well-documented.
- **Phase 5 (Deployment):** Netlify SPA routing with `_redirects` is a one-liner. GitHub Actions cron is straightforward.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core libraries are already installed or have locked decisions. Versions are current as of research date. TanStack Router + Query integration patterns verified from official docs. |
| Features | HIGH | Competitive landscape well-researched. Anti-feature decisions are well-reasoned for the domain. MVP scope is clearly defined. |
| Architecture | HIGH | Split read/write pattern is the documented Supabase best practice. DB schema is complete with correct constraints, triggers, and RLS. Edge Function patterns sourced from official Supabase examples. |
| Pitfalls | HIGH | Security pitfalls sourced from Supabase RLS breach reports and PostgreSQL race condition documentation. Discord OAuth behavior verified against Discord developer docs. |

**Overall confidence:** HIGH

### Gaps to Address

- **MFA field path in Supabase Discord metadata:** STACK.md notes `custom_claims.mfa_enabled` as the likely path but flags it as needing verification against current Supabase Discord provider docs. Verify before writing the auth/profile sync trigger.
- **Discord Bot token vs OAuth provider_token for membership check:** Research recommends Bot token approach (Phase 3), but the exact implementation of passing the Discord user ID from the JWT to the Bot API call needs to be worked out during Phase 3 planning. The provider_token from OAuth is not stored by Supabase by design.
- **pg_cron on free tier:** Confirmed available but UI steps to enable it in the current Supabase dashboard should be verified during Phase 1.
- **Upstash free tier limits for rate limiting:** 10K commands/day is stated as sufficient for ~400 voters/week, but the per-vote command count (typically 2-3 commands per sliding-window check) should be confirmed during Phase 3.

## Sources

### Primary (HIGH confidence)
- [TanStack Router - File-Based Routing](https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing) — routing setup, autoCodeSplitting
- [TanStack Query - Auto Refetching](https://tanstack.com/query/v4/docs/framework/react/examples/auto-refetching) — refetchInterval polling pattern
- [Supabase Discord OAuth](https://supabase.com/docs/guides/auth/social-login/auth-discord) — OAuth scopes, provider_token behavior
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions) — Deno runtime, deployment, auth patterns
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) — policy syntax, security_invoker
- [Supabase Rate Limiting with Upstash](https://supabase.com/docs/guides/functions/examples/rate-limiting) — official Upstash integration example
- [Supabase Triggers Docs](https://supabase.com/docs/guides/database/postgres/triggers) — vote count trigger pattern
- [Discord OAuth2 Documentation](https://discord.com/developers/docs/topics/oauth2) — guild membership verification, scopes

### Secondary (MEDIUM confidence)
- [EasyPoll vs Discord Native](https://easypoll.bot/vs-discord-polls) — feature gap analysis
- [PollBotPlus](https://pollbotplus.com/) — hidden results feature comparison
- [Intigriti: Hackers' Guide to Online Voting](https://www.intigriti.com/blog/news/a-hackers-guide-to-online-voting-systems) — vote manipulation techniques
- [Supabase RLS Best Practices - Precursor Security](https://www.precursorsecurity.com/blog/row-level-recklessness-testing-supabase-security) — RLS misconfiguration failure modes
- [Supabase Pause Prevention](https://github.com/travisvn/supabase-pause-prevention) — keepalive implementation reference
- [PostgreSQL Race Conditions](https://dev.to/mistval/winning-race-conditions-with-postgresql-54gn) — TOCTOU constraint approach

### Tertiary (LOW confidence)
- [Zustand vs Jotai Performance 2025](https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025) — state management comparison
- [StrawPoll manipulation analysis](https://technofaq.org/posts/2019/09/how-straw-poll-votes-can-be-manipulated/) — IP-only protection inadequacy

---
*Research completed: 2026-04-06*
*Ready for roadmap: yes*
