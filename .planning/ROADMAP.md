# Roadmap: WTCS Community Polls

## Overview

This roadmap delivers a Discord-authenticated community polling platform for the War Thunder Competitive Scene. The dependency chain is rigid: database schema and auth must exist before any reads, reads before writes, vote integrity before public launch, and admin tools before the platform is self-service. Each phase delivers a vertically complete capability that can be verified independently, building toward a platform where community members vote on competitive scene proposals with confidence that results are legitimate.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Authentication** - Supabase schema with RLS, Discord OAuth, routing scaffold, dark-mode responsive shell, deployment pipeline, testing infrastructure setup with auth tests
- [ ] **Phase 2: Poll Browsing & Voting** - Poll listing with category filtering, vote casting via Edge Function, vote-then-reveal results with live HTTP polling, voting/results tests
- [ ] **Phase 3: Vote Integrity** - Discord server membership verification via Bot API, Upstash Redis rate limiting on vote submissions, integrity tests
- [ ] **Phase 4: Admin Panel & Poll Management** - Admin poll creation with dynamic choices, category management, poll lifecycle (timers, close, archive with resolution status), admin promotion/demotion, admin action tests
- [ ] **Phase 5: Launch Hardening** - Supabase keepalive cron, production deployment at polls.wtcsmapvote.com, E2E smoke tests, end-to-end verification

## Phase Details

### Phase 1: Foundation & Authentication
**Goal**: A logged-in Discord user can access the app, see their identity, and navigate a responsive dark-mode shell -- with the full database schema and security policies already in place underneath
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-04, AUTH-05, ADMN-01, UIDN-01, UIDN-02, UIDN-03, INFR-01, INFR-03, TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. User can click "Login with Discord", complete OAuth, and land back in the app seeing their Discord username and avatar
  2. User whose Discord account does not have 2FA enabled is rejected with a clear error message explaining what to do
  3. User session survives a full browser refresh without requiring re-login
  4. User can log out from any page and is returned to a logged-out landing state
  5. App is mobile-first: layouts, touch targets, and interactions are designed for phone screens first, with dark mode by default
  6. Testing infrastructure (Vitest + React Testing Library) is configured with CI-ready scripts
  7. Auth flows have unit/integration tests covering login, 2FA rejection, session persistence, and logout
**Plans**: TBD
**UI hint**: yes

### Phase 2: Poll Browsing & Voting
**Goal**: Authenticated users can browse active polls, cast one vote per poll through server-validated Edge Functions, and see live-updating results only after voting
**Depends on**: Phase 1
**Requirements**: VOTE-01, VOTE-02, VOTE-03, RSLT-01, RSLT-02, RSLT-03, RSLT-04, RSLT-05, CATG-02, CATG-03, CATG-04, INFR-04, TEST-03
**Success Criteria** (what must be TRUE):
  1. User sees a browsable list of active polls on the main page, filterable by category tabs and searchable by text
  2. User can open a poll, select a choice, and submit a vote -- the vote is persisted and cannot be changed or deleted
  3. Before voting, user sees the poll choices but no results; after voting, user sees live percentages and raw vote counts
  4. Vote counts update automatically every 5-10 seconds without page refresh via HTTP polling
  5. A user who has not voted on a closed poll cannot see its results; only voters can view results even after the poll closes
  6. Poll browsing, voting, and results are fully usable on phone screens (tap-friendly choices, readable results, no horizontal scroll)
  7. Vote casting and result visibility have unit/integration tests (one-vote enforcement, vote-then-reveal, voters-only results)
**Plans**: TBD
**UI hint**: yes

### Phase 3: Vote Integrity
**Goal**: Every vote is verified against Discord server membership and protected from abuse via rate limiting, ensuring only legitimate community members can participate
**Depends on**: Phase 2
**Requirements**: AUTH-03, VOTE-04, TEST-04
**Success Criteria** (what must be TRUE):
  1. User who is not a member of the official War Thunder esports Discord server is rejected with a clear error message when attempting to vote
  2. A user submitting votes in rapid succession is rate-limited and receives an error after exceeding the threshold
  3. Vote integrity checks have tests (server membership rejection, rate limiting behavior)
**Plans**: TBD

### Phase 4: Admin Panel & Poll Management
**Goal**: Admins can create, configure, and manage polls end-to-end through the app -- from creation with dynamic choices and images, through lifecycle management, to archival with resolution status
**Depends on**: Phase 3
**Requirements**: ADMN-02, ADMN-03, ADMN-04, POLL-01, POLL-02, POLL-03, POLL-04, POLL-05, POLL-06, POLL-07, CATG-01, LIFE-01, LIFE-02, LIFE-03, TEST-05
**Success Criteria** (what must be TRUE):
  1. Admin can create a poll with title, description, N configurable choices (with Yes/No and multiple-choice presets), an optional image, a category assignment, and a timer (7 days, 14 days, or custom)
  2. Admin can edit a poll before the first vote is cast, manually close a poll at any time, and pin/highlight important polls
  3. Active polls auto-close when their timer expires; closed polls appear in a public archive with a resolution status (Rejected, Processing, or Implemented)
  4. Admin can promote another Discord user to admin or demote an existing admin (but not themselves), with all admin actions verified server-side
  5. Admin can create, rename, and delete poll categories
  6. Admin panel is usable on phone screens (poll creation form, category management, admin controls)
  7. Admin actions have tests (poll CRUD, admin promotion/demotion, server-side auth checks)
**Plans**: TBD
**UI hint**: yes

### Phase 5: Launch Hardening
**Goal**: The platform is production-ready at polls.wtcsmapvote.com with infrastructure safeguards preventing database pausing and deployment configured for SPA routing
**Depends on**: Phase 4
**Requirements**: INFR-02, TEST-06
**Success Criteria** (what must be TRUE):
  1. Supabase database receives a keepalive ping every 3-4 days via automated cron, preventing free-tier pausing
  2. App is accessible at polls.wtcsmapvote.com with correct SPA routing (deep links and refresh work)
  3. End-to-end flow works in production: login, browse polls, vote, see results, admin creates poll
  4. E2E smoke tests cover the critical path (login → browse → vote → see results)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Authentication | 0/? | Not started | - |
| 2. Poll Browsing & Voting | 0/? | Not started | - |
| 3. Vote Integrity | 0/? | Not started | - |
| 4. Admin Panel & Poll Management | 0/? | Not started | - |
| 5. Launch Hardening | 0/? | Not started | - |
