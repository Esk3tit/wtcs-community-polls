# Requirements: WTCS Community Polls

**Defined:** 2026-04-06
**Core Value:** Community members can share opinions on competitive scene proposals with confidence that results are authentic

**Terminology note:** REQ-IDs use internal terminology (POLL, VOTE) for code/DB alignment. User-facing descriptions use "suggestion/topic/response/opinion" per the Design System Brief.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can log in via Discord OAuth and is redirected back to the app
- [ ] **AUTH-02**: User without Discord 2FA enabled is rejected with a clear error message
- [ ] **AUTH-03**: User who is not a member of the official War Thunder esports Discord server is rejected with a clear error message
- [ ] **AUTH-04**: User session persists across browser refresh
- [ ] **AUTH-05**: User can log out from any page

### Admin Management

- [ ] **ADMN-01**: Initial admin accounts are seeded by Discord user ID in the database
- [x] **ADMN-02**: Existing admin can promote another Discord user to admin via in-app button
- [x] **ADMN-03**: Existing admin can demote another admin (except self)
- [x] **ADMN-04**: Admin status is checked server-side on all admin actions

### Suggestion Creation (admin-facing: "poll creation")

- [x] **POLL-01**: Admin can create a suggestion with a title, description, and N configurable choices (with presets: Yes/No binary, 4-choice multiple choice — presets pre-fill choices but admin can always add/remove)
- [x] **POLL-02**: Admin can attach an image to a suggestion (upload to Supabase Storage or paste external URL)
- [x] **POLL-03**: Admin can set a suggestion timer (7 days, 14 days, or custom duration)
- [x] **POLL-04**: Admin can assign a suggestion to a category
- [x] **POLL-05**: Admin can pin/highlight a suggestion to surface it above others
- [x] **POLL-06**: Admin can edit a suggestion before the first response is submitted
- [x] **POLL-07**: Admin can manually close a suggestion at any time

### Suggestion Lifecycle

- [x] **LIFE-01**: Active suggestions auto-close when their timer expires (via pg_cron or equivalent)
- [x] **LIFE-02**: Closed suggestions can be marked with a resolution status: Addressed, Forwarded, or Closed
- [x] **LIFE-03**: Closed suggestions appear in a public archive section

### Responding (internal: "voting")

- [ ] **VOTE-01**: Authenticated user can submit one response per suggestion (enforced by UNIQUE constraint at DB level)
- [ ] **VOTE-02**: Response submission goes through a Supabase Edge Function with server-side validation
- [ ] **VOTE-03**: Response cannot be changed or deleted after submission (no UPDATE/DELETE via RLS)
- [ ] **VOTE-04**: Upstash Redis rate limiting prevents rapid response submissions from a single user

### Results

- [ ] **RSLT-01**: Results are hidden until the user has responded to that suggestion
- [ ] **RSLT-02**: After responding, user sees live percentages and raw response counts per choice
- [ ] **RSLT-03**: Response counts are pre-aggregated via Postgres trigger into a response_counts table
- [ ] **RSLT-04**: Frontend polls response_counts every 5-10 seconds for live updates
- [ ] **RSLT-05**: Only users who responded to a suggestion can see its results (even after it closes)

### Categories & Navigation

- [x] **CATG-01**: Admin can create, rename, and delete categories
- [ ] **CATG-02**: Active suggestions are displayed in a browsable list on the main page
- [ ] **CATG-03**: Users can filter suggestions by category via tabs/pills
- [ ] **CATG-04**: Users can search/filter suggestions by text

### UI & Design

- [ ] **UIDN-01**: App supports light and dark mode via shadcn theme toggle (system preference by default)
- [ ] **UIDN-02**: Mobile-first responsive design — layouts, touch targets, and interactions designed for phone screens first, scaled up for desktop
- [ ] **UIDN-03**: Modern, polished visual design using shadcn/ui Maia style with Neutral preset

### Testing

- [ ] **TEST-01**: Testing infrastructure set up (Vitest + React Testing Library) with CI-ready scripts
- [ ] **TEST-02**: Auth flows have unit/integration tests (login, 2FA rejection, session persistence, logout)
- [ ] **TEST-03**: Response submission and result visibility have unit/integration tests (one-response enforcement, respond-then-reveal, respondents-only results)
- [ ] **TEST-04**: Response integrity checks have tests (server membership rejection, rate limiting)
- [x] **TEST-05**: Admin actions have tests (suggestion CRUD, admin promotion/demotion, server-side auth checks)
- [x] **TEST-06**: E2E smoke tests cover the critical path (login → browse → respond → see results)

### Infrastructure

- [x] **INFR-01**: App is deployed on Netlify at polls.wtcsmapban.com
- [x] **INFR-02**: Supabase free tier keepalive cron pings the database every 3-4 days
- [ ] **INFR-03**: All reads go direct from browser via Supabase JS client with RLS policies
- [ ] **INFR-04**: All response writes go through Supabase Edge Functions

## v2 Requirements

### Notifications

- **NOTF-01**: Discord webhook notification when a new suggestion goes live
- **NOTF-02**: Discord webhook notification when a suggestion closes with results summary

### Verification

- **VERF-01**: War Thunder Discord server membership verification for respondents

### Admin Analytics

- **ANLT-01**: Admin dashboard showing participation trends
- **ANLT-02**: Admin view of per-suggestion engagement metrics

### Abuse Prevention

- **ABSE-01**: Cloudflare Turnstile CAPTCHA for suspicious traffic patterns

## Out of Scope

| Feature | Reason |
|---------|--------|
| Anonymous responses | Destroys accountability; Discord identity is core to response integrity |
| Multiple OAuth providers | Fragments identity, creates duplicate response loopholes |
| Ranked-choice responses | Over-engineered for simple Yes/No and pick-one suggestion topics |
| User-created suggestions | Opens door to spam; admin curation is intentional |
| Comments/discussion | Discussion belongs in Discord where the community lives |
| Real-time WebSockets | HTTP polling sufficient at 20-30 concurrent users |
| Email notifications | Community uses Discord, not email |
| Weighted responses | Creates perceived unfairness in a gaming community |
| Blockchain | Absurd complexity for a 300-person community |
| Response attribution | Showing who responded with what creates social pressure |
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
| ADMN-02 | Phase 4 | Complete |
| ADMN-03 | Phase 4 | Complete |
| ADMN-04 | Phase 4 | Complete |
| POLL-01 | Phase 4 | Complete |
| POLL-02 | Phase 4 | Complete |
| POLL-03 | Phase 4 | Complete |
| POLL-04 | Phase 4 | Complete |
| POLL-05 | Phase 4 | Complete |
| POLL-06 | Phase 4 | Complete |
| POLL-07 | Phase 4 | Complete |
| LIFE-01 | Phase 4 | Complete |
| LIFE-02 | Phase 4 | Complete |
| LIFE-03 | Phase 4 | Complete |
| VOTE-01 | Phase 2 | Pending |
| VOTE-02 | Phase 2 | Pending |
| VOTE-03 | Phase 2 | Pending |
| VOTE-04 | Phase 3 | Pending |
| RSLT-01 | Phase 2 | Pending |
| RSLT-02 | Phase 2 | Pending |
| RSLT-03 | Phase 2 | Pending |
| RSLT-04 | Phase 2 | Pending |
| RSLT-05 | Phase 2 | Pending |
| CATG-01 | Phase 4 | Complete |
| CATG-02 | Phase 2 | Pending |
| CATG-03 | Phase 2 | Pending |
| CATG-04 | Phase 2 | Pending |
| UIDN-01 | Phase 1 | Pending |
| UIDN-02 | Phase 1 | Pending |
| UIDN-03 | Phase 1 | Pending |
| INFR-01 | Phase 1 | Complete |
| INFR-02 | Phase 5 | Complete |
| INFR-03 | Phase 1 | Pending |
| INFR-04 | Phase 2 | Pending |
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Pending |
| TEST-03 | Phase 2 | Pending |
| TEST-04 | Phase 3 | Pending |
| TEST-05 | Phase 4 | Complete |
| TEST-06 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-21 — INFR-02 / TEST-06 marked Completed after Phase 5 verification; INFR-01 status synced; previous touch 2026-04-06 added terminology and status label formalization*
