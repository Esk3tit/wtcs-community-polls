# Phase 1: Foundation & Authentication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 01-Foundation & Authentication
**Areas discussed:** App shell & navigation, Auth error experience, Schema scope, Landing page

---

## App Shell & Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Top nav bar | Horizontal bar at top with logo, nav links, login/avatar. Clean, Discord-like. Works great on mobile as hamburger menu. | ✓ |
| Minimal header + sidebar | Slim header for branding, sidebar for categories/filters. More app-like, but heavier on mobile. | |
| Minimal header only | Just a header bar with logo and login. Navigation happens via content (cards, tabs). Lightest possible. | |

**User's choice:** Top nav bar
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Top-right avatar + dropdown | Discord avatar in nav bar, click for dropdown (logout, settings). Standard pattern. | ✓ |
| Persistent sidebar profile | Avatar + username visible in a sidebar at all times | |
| You decide | Claude picks the best fit for the layout chosen above | |

**User's choice:** Top-right avatar + dropdown
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Home (poll list) | Main page showing active polls — empty shell in Phase 1, populated in Phase 2 | ✓ |
| Auth callback | Discord OAuth redirect handler — required for login flow | ✓ |
| Archive | Closed polls page — empty shell in Phase 1, populated in Phase 4 | ✓ |
| Admin panel | Admin-only section — empty shell in Phase 1, built in Phase 4 | ✓ |

**User's choice:** All four routes
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Hamburger menu | Collapse nav links into a hamburger icon, slide-out or dropdown menu | |
| Bottom tab bar | Move key navigation to bottom of screen like a mobile app (thumb-friendly) | |
| You decide | Claude picks based on the number of nav items and mobile-first priority | ✓ |

**User's choice:** You decide
**Notes:** Claude's discretion based on nav item count and mobile-first priority

---

## Auth Error Experience

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly error page | Full-page explaining what 2FA is, why it's required, and a link to Discord's 2FA setup guide. Warm tone. | |
| Toast/banner + redirect | Brief error message at top of the page, then redirect back to login. Quicker but less hand-holding. | |
| You decide | Claude picks the approach that works best for non-technical esports community members | ✓ |

**User's choice:** You decide
**Notes:** Claude's discretion for non-technical audience

| Option | Description | Selected |
|--------|-------------|----------|
| Helpful and warm | "To keep voting fair, we require 2FA. Here's how to set it up in Discord" | ✓ |
| Direct and minimal | "2FA required. Enable it in Discord Settings > My Account." | |
| You decide | Claude matches tone to the non-technical audience | |

**User's choice:** Helpful and warm
**Notes:** Non-technical audience, guide them through with links

---

## Schema Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full schema upfront (Recommended) | Create all tables (profiles, polls, choices, votes, vote_counts, categories, admins) with RLS policies. Phase 2+ just uses them. | ✓ |
| Auth-only first | Only profiles and admins tables now. Add polls/votes/etc in Phase 2. Smaller Phase 1 but migration overhead later. | |
| You decide | Claude picks the approach that minimizes rework across phases | |

**User's choice:** Full schema upfront
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase CLI migrations | SQL migration files in supabase/migrations/ tracked in git. Standard Supabase workflow. | ✓ |
| Dashboard + seed script | Create schema in Supabase Dashboard, keep a seed.sql for reproducibility. | |
| You decide | Claude picks based on team size and project complexity | |

**User's choice:** Supabase CLI migrations
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Migration seed data | Hardcode Discord IDs in a seed migration file. Simple, reproducible, but requires a new migration to add admins before the in-app promote feature. | ✓ |
| Environment variable | Store admin Discord IDs in Supabase env vars, read by Edge Function. Easy to update without code changes. | |
| You decide | Claude picks the simplest approach for a small team | |

**User's choice:** Migration seed data
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| On every login | Always fresh data, but slightly slower auth flow | ✓ |
| On first login only | Faster subsequent logins, but stale if user changes Discord name/avatar | |
| You decide | Claude picks based on community size and freshness needs | |

**User's choice:** On every login
**Notes:** None

---

## Landing Page

| Option | Description | Selected |
|--------|-------------|----------|
| Splash with context | Brief explanation of what WTCS Community Polls is, why Discord login is needed, prominent Login button. Builds trust for first-time visitors. | ✓ |
| Login-only minimal | Just the logo, tagline, and a big 'Login with Discord' button. No explanation. Fast and clean. | |
| See polls, prompt login | Show active polls (titles only, no results), but prompt login when they try to interact. Gives a preview before committing. | |

**User's choice:** Splash with context
**Notes:** Builds trust for first-time visitors clicking links from Discord

| Option | Description | Selected |
|--------|-------------|----------|
| Shared branding | Same logo, color scheme, and overall feel as wtcsmapban.com. Feels like one ecosystem. | |
| Independent but cohesive | Distinct visual identity that complements but doesn't copy the main site. Own personality. | ✓ |
| You decide | Claude designs something appropriate for an esports voting platform | |

**User's choice:** Independent but cohesive
**Notes:** Distinct personality that complements the main WTCS Map Vote site

---

## Claude's Discretion

- Mobile navigation pattern (hamburger vs bottom tabs)
- Auth error presentation format (full-page vs toast/banner)
- Loading states and skeleton patterns
- Color palette and typography
- Test structure and organization

## Deferred Ideas

None — discussion stayed within phase scope
