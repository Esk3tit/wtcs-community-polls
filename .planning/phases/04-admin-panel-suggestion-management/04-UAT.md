---
status: partial
phase: 04-admin-panel-suggestion-management
source:
  - .planning/phases/04-admin-panel-suggestion-management/04-01-SUMMARY.md
  - .planning/phases/04-admin-panel-suggestion-management/04-02-SUMMARY.md
  - .planning/phases/04-admin-panel-suggestion-management/04-03-SUMMARY.md
  - .planning/phases/04-admin-panel-suggestion-management/04-04-SUMMARY.md
started: 2026-04-19T04:38:31Z
updated: 2026-04-19T04:45:00Z
---

## Environment Prerequisites

Before testing, confirm your environment has:

- [ ] Migration `00000000000005_admin_phase4.sql` applied to the remote Supabase project (per 04-01 verification queries)
- [ ] 14 Edge Functions deployed to the remote Supabase project (per 04-02 — deferred to Phase 5; may not be deployed yet)
- [ ] You are signed in with Discord ID `267747104607305738` or `290377966251409410` (seeded admins)
- [ ] `npm run dev` started from repo root

If Edge Functions aren't deployed yet, runtime tests (4–14) will be blocked on `prior-phase` — that's expected and will be flagged.

## Current Test

[testing paused — 9 blocked on Phase 5 Edge Function deployment]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run `npm run dev` from repo root. Server boots without errors. Open http://localhost:5173/admin in a browser signed in as a seeded admin. Page loads, no red console errors, tabbed shell renders.
result: pass

### 2. Navbar Logo on Every Page
expected: WTCS logo (wtcs-logo.png) renders as the leftmost element of the Navbar on `/topics`, `/archive`, and `/admin`. Logo has a clickable 44px tap target. Logo does NOT get a dark-mode filter (transparent PNG should look correct in both themes).
result: pass

### 3. Admin Shell Tabs + URL Sync
expected: On `/admin`, three tabs render: **Suggestions | Categories | Admins**. Clicking a tab updates the URL to `?tab=categories` / `?tab=admins` / `?tab=suggestions`. Refreshing the page with `?tab=admins` in the URL lands on the Admins tab. Pasting `?tab=INVALID` falls back to the default (Suggestions) — no crash.
result: issue
reported: "No UI entry point to /admin — admins must type the URL manually. Navbar has Topics and Archive links but no conditional admin link based on useAuth().isAdmin (which is already exposed at src/contexts/AuthContext.tsx:151). MobileNav also has no /admin entry."
severity: major

### 4. Categories CRUD + Real Affected Count
expected: On the Categories tab: (a) create a category named "Test Category" — it appears in the list with toast "Category created". (b) Rename it to "Renamed" — change persists. (c) Delete it — confirmation dialog appears. If 0 polls use it, dialog says "No suggestions use this category. This cannot be undone." If some polls use it, dialog says "{N} suggestion{s} will become uncategorized. This cannot be undone." with the REAL number (not 0).
result: blocked
blocked_by: prior-phase
reason: "create-category Edge Function not deployed to remote Supabase project. Console: 'Access to fetch at https://cbjspmwgyoxxqukcccjr.supabase.co/functions/v1/create-category ... blocked by CORS policy: Response to preflight request doesn't pass access control check: It does not have HTTP ok status. net::ERR_FAILED.' Per Plan 04-02 decisions, Edge Function deployment to the live Supabase project is owned by Phase 5 launch hardening. All 14 admin EFs are source-only in Phase 4."

### 5. Promote Admin — Search + Discord ID Paste
expected: On the Admins tab, click "Promote admin". Dialog opens with two branches. (a) **Search branch:** Type a 2+ character username, see matching users (up to 10), pick one, confirm, toast "{name} promoted" and row appears in admin list. (b) **Discord ID branch:** Paste a 17–19 digit snowflake (e.g. of a user who has never logged in), confirm, toast "User pre-authorized as admin" or similar (they'll become admin automatically on first login).
result: blocked
blocked_by: prior-phase
reason: "promote-admin and search-admin-targets Edge Functions not deployed to remote Supabase project. Verified via Supabase MCP list_edge_functions: only submit-vote is deployed. Phase 5 launch hardening owns deployment of all 14 admin EFs."

### 6. Demote Admin + Self-Demote Guard
expected: On the Admins tab, admins other than yourself show a "Demote" button. Clicking it opens a confirmation dialog. Confirming removes them from the admin list with a toast. Your OWN row in the list does NOT show a Demote button (D-06 UI guard). If you somehow bypass the UI guard and try to demote yourself, the server returns "Cannot demote yourself" (not testable from UI, but you shouldn't see your own Demote button at all).
result: blocked
blocked_by: prior-phase
reason: "demote-admin Edge Function not deployed to remote Supabase project. D-06 UI guard (hidden Demote button on own row) is still verifiable by rendering the admin list, but the runtime demote flow is blocked on Phase 5 EF deployment."

### 7. Create Suggestion — Full Form
expected: From Admin Suggestions tab, click "Create suggestion" → navigates to `/admin/suggestions/new`. Fill in: Title "Test poll", Description "optional body", pick Yes/No preset (auto-fills 2 choices), pick 7-day timer preset, pick a category (or "Uncategorized"), upload an image (JPG/PNG/WebP ≤2MB — SVG rejected, oversized rejected with toast). Click Submit → redirects to admin list showing the new row with Active badge.
result: blocked
blocked_by: prior-phase
reason: "create-poll and get-upload-url Edge Functions not deployed to remote Supabase project. Form UI loads and validates client-side, but submission hits the same CORS wall as create-category. Phase 5 owns EF deployment."

### 8. Edit Suggestion — Unlocked
expected: For a suggestion with 0 votes, kebab menu → Edit → navigates to `/admin/suggestions/{id}/edit`. Form loads with existing title/description/choices/closes_at/image_url pre-filled. Modify title and a choice. Click Submit → update succeeds, toast, list reflects new title.
result: blocked
blocked_by: prior-phase
reason: "update-poll Edge Function not deployed to remote Supabase project. Form pre-fill works (reads polls_effective directly), but Submit is blocked on EF deployment owned by Phase 5."

### 9. Edit Suggestion — Locked After Votes (D-17)
expected: For a suggestion with ≥1 vote, kebab menu → Edit (or direct URL to edit route). Form loads but shows a prominent "Editing is locked" banner at the top. Every input (title, description, choices, presets, image, timer, category) AND the Submit button are **disabled**. Server also returns 409 if somehow bypassed — specific toast "Cannot edit: responses already received."
result: pass

### 10. Admin Suggestions Filter Chips + URL Sync
expected: Admin Suggestions tab shows filter chips: **Active | Closed | All**. Clicking "Closed" filters the list to only closed polls and updates URL to `?filter=closed`. Clicking "All" shows both with `?filter=all`. Pinned suggestions always appear first within the filtered set. Refresh preserves the filter selection.
result: pass

### 11. Pin / Unpin + Public Ordering
expected: Kebab menu → Pin → row shows "Pinned" badge (D-05) with toast "Suggestion pinned". Navigate to public `/topics` → the pinned suggestion appears **first** in the list with a "Pinned" badge, regardless of created_at order. Back in admin, kebab → Unpin → badge disappears, toast "Suggestion unpinned", `/topics` returns to chronological order.
result: blocked
blocked_by: prior-phase
reason: "pin-poll Edge Function not deployed. Phase 5 owns deployment."

### 12. Close Suggestion with Resolution
expected: For an active suggestion, kebab menu → Close → dialog requires picking a resolution from Addressed / Forwarded / Closed. Submit without a selection fails validation. After picking one and confirming, poll moves to closed state, badge flips to Closed, `closed_at` and `resolution` fields populated. Closed-with-no-resolution polls show an amber `border-l-2` stripe (D-15) — but fresh closes from this dialog always have a resolution.
result: blocked
blocked_by: prior-phase
reason: "close-poll Edge Function not deployed. Phase 5 owns deployment."

### 13. Set Resolution + Public /archive Pill
expected: For a closed suggestion (with or without a resolution), kebab → "Set resolution…" → dialog lets you change resolution from current value. Confirm → toast, value updates. Navigate to public `/archive` → the suggestion displays a resolution pill (color-coded per Addressed/Forwarded/Closed). The `/archive` page shows the legend somewhere (sr-only OK).
result: blocked
blocked_by: prior-phase
reason: "set-resolution Edge Function not deployed. /archive pill rendering (SuggestionCard → ResolutionBadge) is UI-only and would work against existing closed polls, but the set-resolution mutation half is blocked. Phase 5 owns EF deployment."

### 14. Delete Suggestion — Unlocked vs Locked (D-18)
expected: (a) For a suggestion with 0 votes, kebab → Delete → confirmation dialog → confirm → row removed from list, toast "Suggestion deleted". (b) For a suggestion with ≥1 vote, the Delete menu item is either **disabled** with tooltip "Cannot delete after responses received." or clicking it immediately surfaces that message — no delete should proceed.
result: blocked
blocked_by: prior-phase
reason: "delete-poll Edge Function not deployed. D-18 UI lock (disabled Delete item + tooltip) is verifiable from the kebab menu itself, but the delete runtime path is blocked. Phase 5 owns EF deployment."

### 15. Lazy-Close Visible on Public Side
expected: Create or find a poll whose `closes_at` has passed (expired) but whose `status` is still `active` in the DB (because no sweeper has run). On public `/topics`, this poll renders as **closed** (via the `polls_effective` view). On Admin Suggestions tab with Closed filter, same poll appears with Closed badge. This verifies the D-12 lazy-close path works without needing the Phase 5 cron sweeper.
result: pass

## Summary

total: 15
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 9

## Gaps

- truth: "Admins can reach /admin from the UI without typing the URL manually"
  status: failed
  reason: "User reported: No UI entry point to /admin — admins must type the URL manually. Navbar has Topics and Archive links but no conditional admin link based on useAuth().isAdmin (which is already exposed at src/contexts/AuthContext.tsx:151). MobileNav also has no /admin entry."
  severity: major
  test: 3
  artifacts: []
  missing: []
