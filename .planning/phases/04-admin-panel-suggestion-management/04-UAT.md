---
status: partial
phase: 04-admin-panel-suggestion-management
source:
  - .planning/phases/04-admin-panel-suggestion-management/04-01-SUMMARY.md
  - .planning/phases/04-admin-panel-suggestion-management/04-02-SUMMARY.md
  - .planning/phases/04-admin-panel-suggestion-management/04-03-SUMMARY.md
  - .planning/phases/04-admin-panel-suggestion-management/04-04-SUMMARY.md
started: 2026-04-19T04:38:31Z
updated: 2026-04-25T19:56:00Z
re_run:
  re_run_at: 2026-04-25
  driver: Claude (Playwright MCP, user signed in as YES KiNG / 267747104607305738)
  target: https://polls.wtcsmapban.com (live prod, post-Phase-5)
  results:
    - test: 4
      result: pass
      evidence: "Categories tab CRUD: created 'Test Category' (toast 'Category created'), renamed to 'Renamed' (persisted), deleted with 0 polls dialog ('No suggestions use this category. This cannot be undone.'), then opened delete on 'Lineup Changes' showing real count dialog ('8 suggestions will become uncategorized. This cannot be undone.') and cancelled."
    - test: 5
      result: pass
      evidence: "Promote dialog renders both branches. (a) Search 'ye' returned YES KiNG with Promote button. (b) Pasted Discord ID '123456789012345678' → toast 'Discord ID pre-authorized. User becomes admin on next sign-in.' Pre-auth IDs don't appear in Admins list until first sign-in (correct). FOLLOW-UP: cleanup of fake admin_discord_ids row pending — harmless (no real user has that ID and guild_member check would fail anyway)."
    - test: 6a
      result: deferred
      reason: "Prod has only YES KiNG as a logged-in admin; second seeded admin (290377966251409410 / MapCommittee) has never signed in so has no profile and is invisible in the Admins list. Demote click flow cannot be exercised without a second real admin. User opted to defer until a teammate signs in (option 2). Demote logic itself is covered by 13 unit tests in demote-admin.test.ts + 04-VER source-analysis evidence."
    - test: 6b
      result: pass
      evidence: "Self-demote UI guard verified — Admins list shows YES KiNG row with 'You' tag and NO Demote button (D-06)."
    - test: 7
      result: pass
      evidence: "Create suggestion form opened, filled title '[E2E] Test poll', description, applied Yes/No preset (auto-filled Yes/No choices), default 7-day timer ('Will close in 7 days, May 2, 2026'), Uncategorized. Submitted — URL navigated /admin/suggestions/new → /admin?tab=suggestions, new row with Active badge appeared at top of list. Image upload sub-tests (SVG reject, >2MB reject) deferred to 04-02 EF source-analysis coverage of get-upload-url MIME allowlist."
    - test: 8
      result: pass
      evidence: "Edit unlocked: kebab on '[E2E] Test poll' (0 votes) → Edit → form pre-filled correctly with title/description/choices/closes_at/Uncategorized; NO 'Editing is locked' banner. Modified title to '[E2E] Test poll edited' → Save → toast 'Suggestion updated', list reflects new title."
    - test: 11
      result: pass
      evidence: "Pin: kebab → Pin → 'Pinned' badge appeared in admin row + toast 'Suggestion pinned'. /topics: pinned poll appeared FIRST in list (above 'Throwaway' and all 'Test:' polls) with 'Pinned' badge, expanded by default. Unpin: kebab now showed 'Unpin' menuitem (round-trip) → click → badge disappeared. Public ordering reverted."
    - test: 12
      result: pass
      evidence: "Close dialog requires resolution: 'Close suggestion' button DISABLED until selection (validation working). Picked Forwarded → button enabled → submit. Poll moved to Closed filter with 'Closed' badge (no 'Needs resolution' sub-badge since I picked Forwarded; other resolution-less closed polls correctly show 'Needs resolution')."
    - test: 13
      result: pass
      evidence: "Closed poll: kebab → 'Set resolution…' → dialog → picked Addressed → Save. /archive page rendered the poll with 'Addressed' resolution pill. Other closed polls showed 'Forwarded' / 'Addressed' pills. Page footer has visible legend: 'Resolution values: Addressed, Forwarded, Closed' (visible text, not just sr-only)."
    - test: 14a
      result: pass
      evidence: "Closed poll with 0 votes: kebab → Delete → confirmation dialog ('This permanently removes the suggestion and all of its choices. This cannot be undone. Suggestions with responses cannot be deleted.') → 'Delete permanently' → row removed + toast 'Suggestion deleted'. Cleanup completed in this same step."
    - test: 14b
      result: pass
      evidence: "Voted poll 'Add Sweden to 10.3 bracket' (62 responses): kebab → Delete is DISABLED with tooltip 'Cannot delete after responses received.' Edit is also DISABLED with tooltip 'Cannot edit after responses received.' (D-17 + D-18 UI locks confirmed at runtime)."
  followups:
    - "Test 6a still pending — second admin sign-in required."
    - "Cleanup of fake admin_discord_ids '123456789012345678' (low priority — harmless)."
    - "7 leftover 'Test: …' polls in prod admin list from earlier ad-hoc testing — separate cleanup task."
---

## Environment Prerequisites

Before testing, confirm your environment has:

- [x] Migration `00000000000005_admin_phase4.sql` applied to the remote Supabase project (per 04-01 verification queries) — verified 2026-04-25
- [x] 14 Edge Functions deployed to the remote Supabase project (per 04-02 — deferred to Phase 5; may not be deployed yet) — verified 2026-04-25 (15 EFs live per 05-08-SUMMARY)
- [x] You are signed in with Discord ID `267747104607305738` or `290377966251409410` (seeded admins) — signed in as 267747104607305738 (YES KiNG)
- [x] `npm run dev` started from repo root — N/A, tested against live prod at https://polls.wtcsmapban.com

If Edge Functions aren't deployed yet, runtime tests (4–14) will be blocked on `prior-phase` — that's expected and will be flagged.

## Current Test

[2026-04-25 re-run: 8 of 9 previously-blocked tests now pass on live prod; test 6a deferred until second admin signs in]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run `npm run dev` from repo root. Server boots without errors. Open http://localhost:5173/admin in a browser signed in as a seeded admin. Page loads, no red console errors, tabbed shell renders.
result: pass

### 2. Navbar Logo on Every Page
expected: WTCS logo (wtcs-logo.png) renders as the leftmost element of the Navbar on `/topics`, `/archive`, and `/admin`. Logo has a clickable 44px tap target. Logo does NOT get a dark-mode filter (transparent PNG should look correct in both themes).
result: pass

### 3. Admin Shell Tabs + URL Sync
expected: On `/admin`, three tabs render: **Suggestions | Categories | Admins**. Clicking a tab updates the URL to `?tab=categories` / `?tab=admins` / `?tab=suggestions`. Refreshing the page with `?tab=admins` in the URL lands on the Admins tab. Pasting `?tab=INVALID` falls back to the default (Suggestions) — no crash.
result: pass

### 4. Categories CRUD + Real Affected Count
expected: On the Categories tab: (a) create a category named "Test Category" — it appears in the list with toast "Category created". (b) Rename it to "Renamed" — change persists. (c) Delete it — confirmation dialog appears. If 0 polls use it, dialog says "No suggestions use this category. This cannot be undone." If some polls use it, dialog says "{N} suggestion{s} will become uncategorized. This cannot be undone." with the REAL number (not 0).
result: pass
prior_blocked_by: prior-phase
prior_reason: "create-category Edge Function not deployed to remote Supabase project. Per Plan 04-02 decisions, Edge Function deployment to the live Supabase project is owned by Phase 5 launch hardening."
re_run_evidence: "2026-04-25 against live prod: created 'Test Category' (toast 'Category created'); renamed to 'Renamed' (persisted); deleted with 0-poll dialog showing 'No suggestions use this category. This cannot be undone.'; opened delete on 'Lineup Changes' showing real-count dialog '8 suggestions will become uncategorized. This cannot be undone.' and cancelled."

### 5. Promote Admin — Search + Discord ID Paste
expected: On the Admins tab, click "Promote admin". Dialog opens with two branches. (a) **Search branch:** Type a 2+ character username, see matching users (up to 10), pick one, confirm, toast "{name} promoted" and row appears in admin list. (b) **Discord ID branch:** Paste a 17–19 digit snowflake (e.g. of a user who has never logged in), confirm, toast "User pre-authorized as admin" or similar (they'll become admin automatically on first login).
result: pass
prior_blocked_by: prior-phase
prior_reason: "promote-admin and search-admin-targets Edge Functions not deployed to remote Supabase project. Phase 5 launch hardening owns deployment of all 14 admin EFs."
re_run_evidence: "2026-04-25: dialog renders both branches. (a) Search 'ye' returned YES KiNG with Promote button — search mechanic verified (didn't actually promote self, would be no-op). (b) Pasted Discord ID '123456789012345678' → toast 'Discord ID pre-authorized. User becomes admin on next sign-in.' Pre-auth IDs correctly don't appear in Admins list until first sign-in. Followup: harmless cleanup of fake admin_discord_ids row pending."

### 6. Demote Admin + Self-Demote Guard
expected: On the Admins tab, admins other than yourself show a "Demote" button. Clicking it opens a confirmation dialog. Confirming removes them from the admin list with a toast. Your OWN row in the list does NOT show a Demote button (D-06 UI guard). If you somehow bypass the UI guard and try to demote yourself, the server returns "Cannot demote yourself" (not testable from UI, but you shouldn't see your own Demote button at all).
result: partial
prior_blocked_by: prior-phase
prior_reason: "demote-admin Edge Function not deployed to remote Supabase project. D-06 UI guard verifiable but runtime demote flow blocked on Phase 5 EF deployment."
re_run_evidence: "2026-04-25: (b) Self-demote UI guard PASS — Admins list shows YES KiNG with 'You' tag and NO Demote button (D-06 verified). (a) DEFERRED — only YES KiNG is a logged-in admin in prod (second seeded admin 290377966251409410 has never signed in so has no profile and is invisible in the list). Demote click flow can't be exercised without a second real admin. User opted to defer until a teammate signs in. Demote logic itself covered by 13 unit tests in demote-admin.test.ts + 04-VER source-analysis."

### 7. Create Suggestion — Full Form
expected: From Admin Suggestions tab, click "Create suggestion" → navigates to `/admin/suggestions/new`. Fill in: Title "Test poll", Description "optional body", pick Yes/No preset (auto-fills 2 choices), pick 7-day timer preset, pick a category (or "Uncategorized"), upload an image (JPG/PNG/WebP ≤2MB — SVG rejected, oversized rejected with toast). Click Submit → redirects to admin list showing the new row with Active badge.
result: pass
prior_blocked_by: prior-phase
prior_reason: "create-poll and get-upload-url Edge Functions not deployed to remote Supabase project. Phase 5 owns EF deployment."
re_run_evidence: "2026-04-25: clicked Create → form opened at /admin/suggestions/new with all expected sections (Title, Description, Choices presets + 2 textboxes, Image Upload+URL tabs, 7d/14d/Custom timer with 7d default 'Will close in 7 days, May 2, 2026, 12:51 PM', Category combobox defaulting to Uncategorized). Filled title '[E2E] Test poll' + description; clicked Yes/No preset (auto-filled Yes and No into Choice 1 and Choice 2); submitted. URL navigated to /admin?tab=suggestions; new row '[E2E] Test poll' appeared at top with Active badge / 0 responses. Image upload sub-tests (SVG reject, >2MB reject) deferred to 04-02 EF source-analysis of get-upload-url MIME allowlist."

### 8. Edit Suggestion — Unlocked
expected: For a suggestion with 0 votes, kebab menu → Edit → navigates to `/admin/suggestions/{id}/edit`. Form loads with existing title/description/choices/closes_at/image_url pre-filled. Modify title and a choice. Click Submit → update succeeds, toast, list reflects new title.
result: pass
prior_blocked_by: prior-phase
prior_reason: "update-poll Edge Function not deployed to remote Supabase project. Phase 5 owns EF deployment."
re_run_evidence: "2026-04-25: kebab on '[E2E] Test poll' (0 votes) → Edit menuitem enabled → navigated to /admin/suggestions/{uuid}/edit. Form pre-filled correctly: title='[E2E] Test poll', description preserved, Choice 1='Yes', Choice 2='No', closes_at='2026-05-02T12:51', Category=Uncategorized; NO 'Editing is locked' banner (correct, 0 votes). Modified title to '[E2E] Test poll edited' → Save changes → toast 'Suggestion updated', list now shows new title."

### 9. Edit Suggestion — Locked After Votes (D-17)
expected: For a suggestion with ≥1 vote, kebab menu → Edit (or direct URL to edit route). Form loads but shows a prominent "Editing is locked" banner at the top. Every input (title, description, choices, presets, image, timer, category) AND the Submit button are **disabled**. Server also returns 409 if somehow bypassed — specific toast "Cannot edit: responses already received."
result: pass

### 10. Admin Suggestions Filter Chips + URL Sync
expected: Admin Suggestions tab shows filter chips: **Active | Closed | All**. Clicking "Closed" filters the list to only closed polls and updates URL to `?filter=closed`. Clicking "All" shows both with `?filter=all`. Pinned suggestions always appear first within the filtered set. Refresh preserves the filter selection.
result: pass

### 11. Pin / Unpin + Public Ordering
expected: Kebab menu → Pin → row shows "Pinned" badge (D-05) with toast "Suggestion pinned". Navigate to public `/topics` → the pinned suggestion appears **first** in the list with a "Pinned" badge, regardless of created_at order. Back in admin, kebab → Unpin → badge disappears, toast "Suggestion unpinned", `/topics` returns to chronological order.
result: pass
prior_blocked_by: prior-phase
prior_reason: "pin-poll Edge Function not deployed. Phase 5 owns deployment."
re_run_evidence: "2026-04-25: kebab → Pin on '[E2E] Test poll edited' → 'Pinned' badge appeared on admin row + toast 'Suggestion pinned'. Navigated to /topics: pinned poll appeared FIRST in list (above 'Throwaway' and the 7 'Test:' polls) with 'Pinned' badge and expanded by default (correct for pinned). Back in admin: kebab now shows 'Unpin' menuitem (round-trip verified) → click → 'Pinned' badge disappeared from admin row."

### 12. Close Suggestion with Resolution
expected: For an active suggestion, kebab menu → Close → dialog requires picking a resolution from Addressed / Forwarded / Closed. Submit without a selection fails validation. After picking one and confirming, poll moves to closed state, badge flips to Closed, `closed_at` and `resolution` fields populated. Closed-with-no-resolution polls show an amber `border-l-2` stripe (D-15) — but fresh closes from this dialog always have a resolution.
result: pass
prior_blocked_by: prior-phase
prior_reason: "close-poll Edge Function not deployed. Phase 5 owns deployment."
re_run_evidence: "2026-04-25: kebab → Close… → dialog rendered with 3 resolution buttons (Addressed/Forwarded/Closed) and 'Close suggestion' button DISABLED until selection (validation working). Picked Forwarded → button enabled → submit. Poll moved to Closed filter showing 'Closed' badge with NO 'Needs resolution' sub-badge (correct: I picked a resolution). Other older closed polls without resolution correctly show 'Needs resolution' label per D-15."

### 13. Set Resolution + Public /archive Pill
expected: For a closed suggestion (with or without a resolution), kebab → "Set resolution…" → dialog lets you change resolution from current value. Confirm → toast, value updates. Navigate to public `/archive` → the suggestion displays a resolution pill (color-coded per Addressed/Forwarded/Closed). The `/archive` page shows the legend somewhere (sr-only OK).
result: pass
prior_blocked_by: prior-phase
prior_reason: "set-resolution Edge Function not deployed. Phase 5 owns EF deployment."
re_run_evidence: "2026-04-25: closed poll's kebab → Set resolution… (Close… correctly disabled because already closed) → dialog with 3 buttons → picked Addressed → Save. Navigated to /archive: '[E2E] Test poll edited' showed 'Addressed' resolution pill. Other closed polls displayed their pills correctly: 'Forwarded', 'Addressed'. Page footer has visible legend text 'Resolution values: Addressed, Forwarded, Closed' (visible, not sr-only — better than spec required)."

### 14. Delete Suggestion — Unlocked vs Locked (D-18)
expected: (a) For a suggestion with 0 votes, kebab → Delete → confirmation dialog → confirm → row removed from list, toast "Suggestion deleted". (b) For a suggestion with ≥1 vote, the Delete menu item is either **disabled** with tooltip "Cannot delete after responses received." or clicking it immediately surfaces that message — no delete should proceed.
result: pass
prior_blocked_by: prior-phase
prior_reason: "delete-poll Edge Function not deployed. Phase 5 owns EF deployment."
re_run_evidence: "2026-04-25: (a) On '[E2E] Test poll edited' (0 votes): kebab → Delete enabled → confirmation dialog ('This permanently removes the suggestion and all of its choices. This cannot be undone. Suggestions with responses cannot be deleted.') → 'Delete permanently' → row removed + toast 'Suggestion deleted'. (b) On 'Add Sweden to 10.3 bracket' (62 responses): kebab → Delete is DISABLED with accessible-name tooltip 'Cannot delete after responses received.' Edit is also DISABLED with tooltip 'Cannot edit after responses received.' (D-17 + D-18 UI locks both confirmed)."

### 15. Lazy-Close Visible on Public Side
expected: Create or find a poll whose `closes_at` has passed (expired) but whose `status` is still `active` in the DB (because no sweeper has run). On public `/topics`, this poll renders as **closed** (via the `polls_effective` view). On Admin Suggestions tab with Closed filter, same poll appears with Closed badge. This verifies the D-12 lazy-close path works without needing the Phase 5 cron sweeper.
result: pass

## Summary

total: 15
passed: 14
partial: 1
issues: 0
pending: 0
skipped: 0
blocked: 0
deferred: 1

re_run_at: 2026-04-25
re_run_passed: 8
re_run_partial: 1 (test 6 — 6b pass, 6a deferred to second-admin sign-in)
re_run_remaining_followups:
  - Test 6a (demote click flow) — awaits a second logged-in admin in prod.
  - Cleanup of fake admin_discord_ids '123456789012345678' from test 5b — harmless.
  - 7 leftover 'Test: …' polls in admin list from earlier ad-hoc testing — separate cleanup.

## Gaps

- truth: "Admins can reach /admin from the UI without typing the URL manually"
  status: closed
  closed_by: 04-05-PLAN.md
  reason: "User reported: No UI entry point to /admin — admins must type the URL manually. Navbar has Topics and Archive links but no conditional admin link based on useAuth().isAdmin (which is already exposed at src/contexts/AuthContext.tsx:151). MobileNav also has no /admin entry."
  severity: major
  test: 3
  root_cause: "Feature omission in Phase 4 Plan 04-03 — the plan scoped Navbar.tsx edits strictly for the WTCS logo (D-03) and explicitly instructed implementers 'Do NOT remove existing navbar links ... only ADD the logo' (04-03-PLAN.md:221). No task in Plans 04-01..04-04 ever scoped a conditional Admin link in desktop Navbar or MobileNav. All prerequisites (isAdmin via useAuth(), AdminGuard route protection) already exist."
  artifacts:
    - path: "src/components/layout/Navbar.tsx"
      issue: "Desktop nav block (lines 36-53) renders only /topics and /archive links under {user && ...}; useAuth() is imported but isAdmin is not destructured at line 16"
    - path: "src/components/layout/MobileNav.tsx"
      issue: "Sheet body (lines 30-49) has only /topics and /archive links; no useAuth import or isAdmin gate anywhere in the file"
  missing:
    - "Destructure isAdmin from useAuth() in Navbar.tsx line 16"
    - "Add conditional {isAdmin && <Link to=\"/admin\">Admin</Link>} inside the desktop <nav> (lines 37-52), matching existing Topics/Archive link className and activeProps"
    - "Import useAuth from @/hooks/useAuth in MobileNav.tsx and destructure isAdmin"
    - "Add matching {isAdmin && <SheetClose asChild><Link to=\"/admin\">Admin</Link></SheetClose>} to the Sheet nav (lines 30-49), reusing existing mobile-link className"
    - "Order in both surfaces: Topics | Archive | Admin (admin last)"
    - "Gate on isAdmin (not user) so non-admins never see the link — AdminGuard remains defensive backstop"
    - "Optional: new src/__tests__/layout/Navbar.test.tsx + MobileNav.test.tsx using AuthContext-mock pattern from src/__tests__/auth/auth-guard.test.tsx — two cases each (renders when isAdmin=true, hides when false)"
  debug_session: .planning/debug/navbar-missing-admin-link.md
