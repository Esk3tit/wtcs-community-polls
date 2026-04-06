# Requirements: WTCS Community Polls

**Defined:** 2026-04-06
**Core Value:** Community members can vote on competitive scene proposals with confidence that results are legitimate

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can log in via Discord OAuth and is redirected back to the app
- [ ] **AUTH-02**: User without Discord 2FA enabled is rejected with a clear error message
- [ ] **AUTH-03**: User who is not a member of the official War Thunder esports Discord server is rejected with a clear error message
- [ ] **AUTH-04**: User session persists across browser refresh
- [ ] **AUTH-05**: User can log out from any page

### Admin Management

- [ ] **ADMN-01**: Initial admin accounts are seeded by Discord user ID in the database
- [ ] **ADMN-02**: Existing admin can promote another Discord user to admin via in-app button
- [ ] **ADMN-03**: Existing admin can demote another admin (except self)
- [ ] **ADMN-04**: Admin status is checked server-side on all admin actions

### Poll Creation

- [ ] **POLL-01**: Admin can create a poll with a title, description, and N configurable choices (with presets: Yes/No binary, 4-choice multiple choice — presets pre-fill choices but admin can always add/remove)
- [ ] **POLL-02**: Admin can attach an image to a poll (upload to Supabase Storage or paste external URL)
- [ ] **POLL-03**: Admin can set a poll timer (7 days, 14 days, or custom duration)
- [ ] **POLL-04**: Admin can assign a poll to a category
- [ ] **POLL-05**: Admin can pin/highlight a poll to surface it above others
- [ ] **POLL-06**: Admin can edit a poll before the first vote is cast
- [ ] **POLL-07**: Admin can manually close a poll at any time

### Poll Lifecycle

- [ ] **LIFE-01**: Active polls auto-close when their timer expires (via pg_cron or equivalent)
- [ ] **LIFE-02**: Closed polls can be marked with a resolution status: Rejected, Processing, or Implemented
- [ ] **LIFE-03**: Closed polls appear in a public archive section

### Voting

- [ ] **VOTE-01**: Authenticated user can cast one vote per poll (enforced by UNIQUE constraint at DB level)
- [ ] **VOTE-02**: Vote submission goes through a Supabase Edge Function with server-side validation
- [ ] **VOTE-03**: Vote cannot be changed or deleted after submission (no UPDATE/DELETE via RLS)
- [ ] **VOTE-04**: Upstash Redis rate limiting prevents rapid vote submissions from a single user

### Results

- [ ] **RSLT-01**: Results are hidden until the user has voted on that poll
- [ ] **RSLT-02**: After voting, user sees live percentages and raw vote counts per choice
- [ ] **RSLT-03**: Vote counts are pre-aggregated via Postgres trigger into a vote_counts table
- [ ] **RSLT-04**: Frontend polls vote_counts every 5-10 seconds for live updates
- [ ] **RSLT-05**: Only users who voted on a poll can see its results (even after the poll closes)

### Categories & Navigation

- [ ] **CATG-01**: Admin can create, rename, and delete categories
- [ ] **CATG-02**: Active polls are displayed in a browsable list on the main page
- [ ] **CATG-03**: Users can filter polls by category via tabs/pills
- [ ] **CATG-04**: Users can search/filter polls by text

### UI & Design

- [ ] **UIDN-01**: App supports dark mode via CSS custom properties (default to dark, matching Discord)
- [ ] **UIDN-02**: Mobile-first responsive design — layouts, touch targets, and interactions designed for phone screens first, scaled up for desktop
- [ ] **UIDN-03**: Modern, polished visual design appropriate for an esports community

### Testing

- [ ] **TEST-01**: Testing infrastructure set up (Vitest + React Testing Library) with CI-ready scripts
- [ ] **TEST-02**: Auth flows have unit/integration tests (login, 2FA rejection, session persistence, logout)
- [ ] **TEST-03**: Vote casting and result visibility have unit/integration tests (one-vote enforcement, vote-then-reveal, voters-only results)
- [ ] **TEST-04**: Vote integrity checks have tests (server membership rejection, rate limiting)
- [ ] **TEST-05**: Admin actions have tests (poll CRUD, admin promotion/demotion, server-side auth checks)
- [ ] **TEST-06**: E2E smoke tests cover the critical path (login → browse → vote → see results)

### Infrastructure

- [ ] **INFR-01**: App is deployed on Netlify at polls.wtcsmapvote.com
- [ ] **INFR-02**: Supabase free tier keepalive cron pings the database every 3-4 days
- [ ] **INFR-03**: All reads go direct from browser via Supabase JS client with RLS policies
- [ ] **INFR-04**: All vote writes go through Supabase Edge Functions

## v2 Requirements

### Notifications

- **NOTF-01**: Discord webhook notification when a new poll goes live
- **NOTF-02**: Discord webhook notification when a poll closes with results summary

### Verification

- **VERF-01**: War Thunder Discord server membership verification for voters

### Admin Analytics

- **ANLT-01**: Admin dashboard showing voter participation trends
- **ANLT-02**: Admin view of per-poll engagement metrics

### Abuse Prevention

- **ABSE-01**: Cloudflare Turnstile CAPTCHA for suspicious traffic patterns

## Out of Scope

| Feature | Reason |
|---------|--------|
| Anonymous voting | Destroys accountability; Discord identity is core to vote integrity |
| Multiple OAuth providers | Fragments identity, creates duplicate voting loopholes |
| Ranked-choice voting | Over-engineered for simple Yes/No and pick-one governance polls |
| User-created polls | Opens door to spam; admin curation is intentional |
| Comments/discussion | Discussion belongs in Discord where the community lives |
| Real-time WebSockets | HTTP polling sufficient at 20-30 concurrent users |
| Email notifications | Community uses Discord, not email |
| Weighted voting | Creates perceived unfairness in a gaming community |
| Blockchain voting | Absurd complexity for a 300-person community |
| Voter list visibility | Showing who voted for what creates social pressure |
| Account age check | Discord 2FA + server membership is sufficient filtering |
| Cross-app admin sync | Apps are independent; Discord-native admin model chosen |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 3 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| ADMN-01 | Phase 1 | Pending |
| ADMN-02 | Phase 4 | Pending |
| ADMN-03 | Phase 4 | Pending |
| ADMN-04 | Phase 4 | Pending |
| POLL-01 | Phase 4 | Pending |
| POLL-02 | Phase 4 | Pending |
| POLL-03 | Phase 4 | Pending |
| POLL-04 | Phase 4 | Pending |
| POLL-05 | Phase 4 | Pending |
| POLL-06 | Phase 4 | Pending |
| POLL-07 | Phase 4 | Pending |
| LIFE-01 | Phase 4 | Pending |
| LIFE-02 | Phase 4 | Pending |
| LIFE-03 | Phase 4 | Pending |
| VOTE-01 | Phase 2 | Pending |
| VOTE-02 | Phase 2 | Pending |
| VOTE-03 | Phase 2 | Pending |
| VOTE-04 | Phase 3 | Pending |
| RSLT-01 | Phase 2 | Pending |
| RSLT-02 | Phase 2 | Pending |
| RSLT-03 | Phase 2 | Pending |
| RSLT-04 | Phase 2 | Pending |
| RSLT-05 | Phase 2 | Pending |
| CATG-01 | Phase 4 | Pending |
| CATG-02 | Phase 2 | Pending |
| CATG-03 | Phase 2 | Pending |
| CATG-04 | Phase 2 | Pending |
| UIDN-01 | Phase 1 | Pending |
| UIDN-02 | Phase 1 | Pending |
| UIDN-03 | Phase 1 | Pending |
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 5 | Pending |
| INFR-03 | Phase 1 | Pending |
| INFR-04 | Phase 2 | Pending |
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Pending |
| TEST-03 | Phase 2 | Pending |
| TEST-04 | Phase 3 | Pending |
| TEST-05 | Phase 4 | Pending |
| TEST-06 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after testing requirements added*
