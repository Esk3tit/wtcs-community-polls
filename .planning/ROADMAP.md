# Roadmap: WTCS Community Polls

## Overview

This roadmap delivers a Discord-authenticated community suggestion and opinion-gathering platform for the War Thunder Competitive Scene. The dependency chain is rigid: database schema and auth must exist before any reads, reads before writes, response integrity before public launch, and admin tools before the platform is self-service. Each phase delivers a vertically complete capability that can be verified independently, building toward a platform where community members share opinions on competitive scene proposals with confidence that results are authentic.

**Terminology note:** Internal/code terminology (polls, votes) used in phase names and REQ-IDs for code alignment. User-facing descriptions use suggestion/topic/response/opinion per the Design System Brief (`.planning/DESIGN-SYSTEM.md`).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Authentication** - Supabase schema with RLS, Discord OAuth, routing scaffold, light/dark responsive shell (shadcn/ui + Tailwind), deployment pipeline, testing infrastructure setup with auth tests
- [x] **Phase 2: Browsing & Responding** - Suggestion listing with category filtering, response submission via Edge Function, respond-then-reveal results with live HTTP polling, response/results tests
- [x] **Phase 3: Response Integrity** - Discord server membership verification via OAuth guilds scope, Upstash Redis rate limiting on response submissions, integrity tests
- [ ] **Phase 4: Admin Panel & Suggestion Management** - Admin suggestion creation with dynamic choices, category management, suggestion lifecycle (timers, close, archive with resolution status), admin promotion/demotion, admin action tests
- [ ] **Phase 5: Launch Hardening** - Supabase keepalive cron, production deployment at polls.wtcsmapvote.com, E2E smoke tests, end-to-end verification

## Phase Details

### Phase 1: Foundation & Authentication
**Goal**: A logged-in Discord user can access the app, see their identity, and navigate a responsive light/dark shell built with shadcn/ui -- with the full database schema and security policies already in place underneath
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-04, AUTH-05, ADMN-01, UIDN-01, UIDN-02, UIDN-03, INFR-01, INFR-03, TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. User can click "Sign in with Discord", complete OAuth, and land back in the app seeing their Discord username and avatar
  2. User whose Discord account does not have 2FA enabled is rejected with a clear error message explaining what to do
  3. User session survives a full browser refresh without requiring re-login
  4. User can sign out from any page and is returned to a logged-out landing state
  5. App is mobile-first: layouts, touch targets, and interactions are designed for phone screens first, with light/dark mode supporting system preference
  6. Testing infrastructure (Vitest + React Testing Library) is configured with CI-ready scripts
  7. Auth flows have unit/integration tests covering login, 2FA rejection, session persistence, and logout
**Plans**: 4 plans (revised after cross-AI review Round 2)
Plans:
- [x] 01-01-PLAN.md -- Project infrastructure (dependencies, Vite config, shadcn/ui, Vitest, clean-checkout safe build)
- [x] 01-02-PLAN.md -- Database schema (7 tables, RLS, server-side RPC for mfa_verified, COALESCE discord_id extraction, upsert triggers)
- [x] 01-03-PLAN.md -- Provider token spike + auth infrastructure + app shell (RPC-based callback, AuthProvider, ThemeProvider, Navbar, pages)
- [x] 01-04-PLAN.md -- Behavioral tests with real handleAuthCallback + human verification (RPC verification, fail-closed tests, UI tests)
**UI hint**: yes

### Phase 2: Browsing & Responding
**Goal**: Authenticated users can browse active suggestions, submit one response per suggestion through server-validated Edge Functions, and see live-updating results only after responding
**Depends on**: Phase 1
**Requirements**: VOTE-01, VOTE-02, VOTE-03, RSLT-01, RSLT-02, RSLT-03, RSLT-04, RSLT-05, CATG-02, CATG-03, CATG-04, INFR-04, TEST-03
**Success Criteria** (what must be TRUE):
  1. User sees a browsable list of active suggestions on the main page, filterable by category tabs and searchable by text
  2. User can open a suggestion, select a choice, and submit their response -- the response is persisted and cannot be changed or deleted
  3. Before responding, user sees the choices but no results; after responding, user sees live percentages and raw response counts
  4. Response counts update automatically every 5-10 seconds without page refresh via HTTP polling
  5. A user who has not responded to a closed suggestion cannot see its results; only respondents can view results even after the suggestion closes
  6. Suggestion browsing, responding, and results are fully usable on phone screens (tap-friendly choices, readable results, no horizontal scroll)
  7. Response submission and result visibility have unit/integration tests (one-response enforcement, respond-then-reveal, respondents-only results)
**Plans**: 4 plans (3 original + 1 gap closure)
Plans:
- [x] 02-01-PLAN.md -- Types, hooks, UI components for suggestion browsing (cards, filtering, search, expand/collapse)
- [x] 02-02-PLAN.md -- Edge Function for vote submission, voting hooks, choice buttons, result bars, polling, archive page
- [x] 02-03-PLAN.md -- Seed data with WTCS sample content, unit/integration tests for voting, results, and browsing
- [x] 02-04-PLAN.md -- Gap closure: restore topics.tsx and archive.tsx route wiring (regression from Plan 03)
**UI hint**: yes

### Phase 3: Response Integrity
**Goal**: Every response is verified against Discord server membership and protected from abuse via rate limiting, ensuring only legitimate community members can participate
**Depends on**: Phase 2
**Requirements**: AUTH-03, VOTE-04, TEST-04
**Success Criteria** (what must be TRUE):
  1. User who is not a member of the official War Thunder esports Discord server is rejected with a clear error message when attempting to respond
  2. A user submitting responses in rapid succession is rate-limited and receives an error after exceeding the threshold
  3. Response integrity checks have tests (server membership rejection, rate limiting behavior)
**Plans**: 2 plans (revised after cross-AI review)
Plans:
- [x] 03-01-PLAN.md -- Guild membership verification (migration, auth callback guilds check, downstream enforcement in submit-vote, AuthErrorPage not-in-server variant, comprehensive failure-mode auth tests, schema push checkpoint)
- [x] 03-02-PLAN.md -- Upstash Redis rate limiting on submit-vote Edge Function, client-side toast tests, server-side Edge Function behavior tests, Upstash setup checkpoint

### Phase 4: Admin Panel & Suggestion Management
**Goal**: Admins can create, configure, and manage suggestions end-to-end through the app -- from creation with dynamic choices and images, through lifecycle management, to archival with resolution status
**Depends on**: Phase 3
**Requirements**: ADMN-02, ADMN-03, ADMN-04, POLL-01, POLL-02, POLL-03, POLL-04, POLL-05, POLL-06, POLL-07, CATG-01, LIFE-01, LIFE-02, LIFE-03, TEST-05
**Success Criteria** (what must be TRUE):
  1. Admin can create a suggestion with title, description, N configurable choices (with Yes/No and multiple-choice presets), an optional image, a category assignment, and a timer (7 days, 14 days, or custom)
  2. Admin can edit a suggestion before the first response is submitted, manually close a suggestion at any time, and pin/highlight important suggestions
  3. Active suggestions auto-close when their timer expires; closed suggestions appear in a public archive with a resolution status (Addressed, Forwarded, or Closed)
  4. Admin can promote another Discord user to admin or demote an existing admin (but not themselves), with all admin actions verified server-side
  5. Admin can create, rename, and delete suggestion categories
  6. Admin panel is usable on phone screens (suggestion creation form, category management, admin controls)
  7. Admin actions have tests (suggestion CRUD, admin promotion/demotion, server-side auth checks)
**Plans**: TBD
**UI hint**: yes

### Phase 5: Launch Hardening
**Goal**: The platform is production-ready at polls.wtcsmapvote.com with infrastructure safeguards preventing database pausing and deployment configured for SPA routing
**Depends on**: Phase 4
**Requirements**: INFR-02, TEST-06
**Success Criteria** (what must be TRUE):
  1. Supabase database receives a keepalive ping every 3-4 days via automated cron, preventing free-tier pausing
  2. App is accessible at polls.wtcsmapvote.com with correct SPA routing (deep links and refresh work)
  3. End-to-end flow works in production: login, browse suggestions, respond, see results, admin creates suggestion
  4. E2E smoke tests cover the critical path (login -> browse -> respond -> see results)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Authentication | 4/4 | Complete | - |
| 2. Browsing & Responding | 4/4 | Complete | - |
| 3. Response Integrity | 0/2 | Planned | - |
| 4. Admin Panel & Suggestion Management | 0/? | Not started | - |
| 5. Launch Hardening | 0/? | Not started | - |
