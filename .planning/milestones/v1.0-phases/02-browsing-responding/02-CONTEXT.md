---
phase: 02-browsing-responding
created: 2026-04-06
decisions: 14
deferred: 0
---

# Phase 2: Browsing & Responding — Context

## Prior Decisions (carry-forward from Phase 1)

- **D-08:** Full database schema exists — polls, choices, votes, vote_counts, categories, profiles, admin_discord_ids tables with RLS
- **D-03:** Topics route exists as empty shell at /topics, Archive at /archive
- **D-01/D-04:** Nav bar with desktop links and mobile hamburger Sheet already in place
- **D-09:** Database managed via Supabase CLI migrations

## Phase 2 Decisions

### Suggestion List Layout

- **D-20:** Stacked full-width cards within the existing max-w-2xl centered layout. No grid, no separate detail page.
- **D-21:** All content lives inline on the card — no separate /topics/:id detail route. Cards expand/collapse in place.
- **D-22:** Pinned suggestions are always expanded (full description, image, choices visible). Non-pinned suggestions are collapsed (title + category + meta) and expand on click.
- **D-23:** Card anatomy follows the mockup:
  - Pinned banner (green) with time remaining
  - Category pill (colored) top-left
  - Resolution status pill top-right (e.g., "Implemented", "Forwarded")
  - Title (bold)
  - Description (visible when expanded)
  - Optional image (visible when expanded)
  - Choice buttons (pre-vote) or result bars (post-vote)
  - Footer: creator avatar + name (left), vote count + status text (right)

### Voting Experience

- **D-24:** Click-to-vote — clicking a choice button submits instantly. No confirmation dialog, no separate submit button. A toast notification confirms "Response recorded."
- **D-25:** Votes are permanent and cannot be changed (enforced by DB constraints). The instant-submit UX is acceptable because the choices are clear and the toast provides feedback.
- **D-26:** Pre-vote state shows choices as side-by-side buttons. Footer shows "{N} votes — vote to see results" to make the respond-then-reveal mechanic clear.

### Results Display

- **D-27:** Post-vote state replaces choice buttons with inline progress bars showing percentages. The user's chosen option is visually highlighted (e.g., accent border or fill).
- **D-28:** Results update via HTTP polling every 5-10 seconds (RSLT-04). No WebSockets — polling the vote_counts table is sufficient for the expected scale.
- **D-29:** Closed suggestions with a resolution show the resolution status pill (e.g., "Implemented", "Forwarded", "Closed"). Results bars are always visible for users who voted.

### Category Filtering & Search

- **D-30:** Category pills/tabs in a horizontal row: "All" + one per category. Selected tab is filled/highlighted, others are outline. Follows the mockup style.
- **D-31:** Search bar appears above the category pills. Filters suggestions by title text as the user types (debounced). Combined with category filter.
- **D-32:** Empty state when no matches: centered message "No suggestions match your search" with option to clear filters.

### Seed Data

- **D-33:** SQL seed file (`supabase/seed.sql`) extended with realistic WTCS sample data — categories (Lineup changes, Map pool, Rules), sample suggestions with choices, some with votes to show results states. Used for development and demo purposes.

## Terminology Mapping

The mockup used "polls/votes" but the project uses:
- "Suggestion" (not poll/topic) — what admins create
- "Response" (not vote) — what users submit
- "Choice" — the options within a suggestion

UI-facing text uses these terms. Internal code/DB may still use `polls`, `votes` tables (schema is fixed from Phase 1).

## What Researchers Should Investigate

- Edge Function patterns for Supabase (vote submission with server-side validation)
- HTTP polling patterns in React (interval-based refetch for vote_counts)
- Accessible expand/collapse card pattern with animation
- shadcn/ui components for progress bars, pills/badges, toast notifications
- Image display within cards (aspect ratio handling, placeholder for missing images)

## What Planners Should Know

- No new routes needed — Topics page gets the full suggestion list, Archive page gets closed suggestions
- Database schema already exists (D-08) — just query it
- vote_counts table is pre-aggregated by trigger — read from it, don't compute
- Edge Function for vote submission (INFR-04) — all writes go through server-side validation
- The expand/collapse behavior means two card variants: compact (title+meta) and expanded (full content)
