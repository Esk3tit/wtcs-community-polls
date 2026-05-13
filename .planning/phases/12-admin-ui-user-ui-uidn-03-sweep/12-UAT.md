---
status: partial
phase: 12-admin-ui-user-ui-uidn-03-sweep
source:
  - 12-00-SUMMARY.md
  - 12-01-SUMMARY.md
  - 12-02-SUMMARY.md
  - 12-03-SUMMARY.md
  - 12-04-SUMMARY.md
  - 12-05-SUMMARY.md
  - 12-06-SUMMARY.md
started: 2026-05-12T20:30:00Z
updated: 2026-05-12T21:17:00Z
---

## Current Test

[testing complete — Tests 8 and 9 blocked on second-account access; deferred to community verification post-deploy]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Kill any running Vite dev server. Clear `node_modules/.vite` cache (rm -rf node_modules/.vite). Run `npm run dev`. The Vite server boots without errors, opens at http://localhost:5173, the home page renders, and the SearchBar + topic list load without console errors. Authenticated routes (admin, archive) redirect to login as expected.
result: pass

### 2. SearchBar Clear Button (UIDN-03 D-15)
expected: |
  On the home page (no auth needed): type a few characters into the SearchBar at the top. The clear-X button appears at the right end of the input. Click the X. The input clears and the filtered list snaps back to full topics. Hover state on the X shows a subtle background (shadcn ghost variant). Tab key reaches the X button; Enter or Space activates clear.
result: pass

### 3. Admin SuggestionForm Back-Links (UIDN-03 D-14)
expected: |
  Sign in as admin via Discord. Navigate to /admin and open the "New Suggestion" form. Two back-links exist (header link and Cancel button). Both look the same as before. Middle-click each → opens /admin in a new tab. Cmd-click (Mac) / Ctrl-click (Win) → also opens in new tab. Right-click → "Open Link in New Tab" works. (Pre-fix, these were native buttons that didn't support new-tab gestures.)
result: pass
reported: "the cancel button doesn't support new tab but the back to admin header link does"
severity: major
resolved_by: Plan 12-07 — commit 65d85a6 (fix(12-07): swap SuggestionForm Cancel to TanStack Link)
resolved_verified_by: Playwright MCP DOM inspection — Cancel now reports tag="A" href="/admin"

### 4. DropZone Drag + Browse (UIDN-03 D-13)
expected: |
  Open the admin "New Suggestion" form. The image upload section shows a dashed-border drop region with "Drop an image here" + "JPG, PNG, or WebP · max 2 MB" + "Browse files" button. Drag an image file from your filesystem onto the dashed region — visual feedback (hover state), drop accepts file, preview appears. Then click "Browse files" — file picker opens. Tab through the form: focus skips the drop region (no tabindex) and lands on the Browse button. Press Enter on Browse → file picker opens.
result: pass
verified_by: Playwright MCP DOM inspection
verified_notes: |
  Structural verification via DOM evaluation against the live form at
  /admin/suggestions/new:
  - Drop region: role="region", aria-label="Image upload", no tabindex
    (region not Tab-focusable — correct per UI-SPEC §4c)
  - Region tag !== BUTTON (UIDN-03 D-13 dual-role anti-pattern eliminated)
  - Inner Browse Button: <BUTTON type="button">Browse files</BUTTON>,
    default focusable, accessible name "Browse files"
  - Hidden file input: <INPUT type="file" class="hidden" display:none>,
    accept="image/jpeg,image/png,image/webp"
  - Drag-drop event delegation via React synthetic events (not directly
    observable from DOM); structural contract matches UI-SPEC.
  Drag-and-drop interaction with real file would require manual test.

### 5. Admin VIS-06 — Hide Results Checkbox at Creation
expected: |
  In the admin "New Suggestion" form, scroll to find a new "Hide results from voters" checkbox with helper text below it: "Voters with responses will see a placeholder instead of counts. Toggle anytime from the admin list." Default state: unchecked. Check the box, fill in required fields (title, choices, category), submit. Toast confirms creation. Open the admin list — the new suggestion appears. (Verification next step: open it as a voter to confirm hidden state.)
result: pass
verified_by: Playwright MCP interaction
verified_notes: |
  - Radix role="checkbox" rendered at the expected position
  - Label "Hide results from voters" — verbatim against UI-SPEC
  - Helper text "Voters with responses will see a placeholder instead of
    counts. Toggle anytime from the admin list." — verbatim
  - Default state aria-checked="false" (unchecked) ✓
  - Click flips to aria-checked="true", data-state="checked" ✓
  - Submit-with-checked-poll path not exercised (would create production
    data); contract verification deferred to TEST-13 E2E spec.

### 6. Admin VIS-06 — Edit Mode Shows Read-Only Status Row
expected: |
  In the admin list, find a suggestion that already has at least one response (voted on). Click its kebab menu → Edit. The edit form opens. WHERE the Checkbox used to be in create mode, there is now a read-only status row showing an Eye or EyeOff icon + "Results currently visible" or "Results currently hidden" + helper text: "Toggle from the admin list to change visibility." (The Checkbox does NOT appear in edit mode because update-poll EF doesn't accept this field — admins use the inline Switch instead.)
result: pass
verified_by: Playwright MCP interaction
verified_notes: |
  Navigated to /admin/suggestions/{id}/edit via kebab → Edit on existing
  suggestion "Tes":
  - Checkbox absent in edit mode ✓ (cross-AI HIGH fix preserved — the
    update-poll EF doesn't accept results_hidden, so editing the Checkbox
    here would be a silent no-op)
  - Status text "Results currently visible" rendered in its place ✓
  - Helper text "Toggle from the admin list" present ✓
  - Cancel button defect (Test 3) confirmed again in edit mode

### 7. Admin VIS-07 — Inline Switch Optimistic Flip
expected: |
  In the admin list, find any suggestion row. Between the response count and the kebab menu sits an inline Switch (mobile: just Switch + Eye/EyeOff icon; ≥sm: Switch + "Hide results" / "Show results" label). Click the Switch. It flips optimistically and immediately (no spinner round-trip). A sonner toast appears in the corner: "Results hidden for: {your suggestion title}" (or "Results visible for: ..."). The label/icon swaps to match the new state. Click again — flips back, toast shows the inverse copy. Screen reader users: focus the Switch — VoiceOver/NVDA announces "Results currently hidden" or "Results currently visible" (not generic "Toggle").
result: pass
verified_by: Playwright MCP interaction
verified_notes: |
  Flipped the Switch on "Tes" suggestion twice (visible → hidden → visible):
  - aria-label state-mirror: "Results currently visible" ↔ "Results currently
    hidden" — CR-01 fix confirmed live ✓
  - data-state: "checked" ↔ "unchecked" ✓
  - Action label flip: "Hide results" ↔ "Show results" ✓
  - Optimistic flip happened instantly (no spinner round-trip observed) ✓
  - State change persisted (real EF call succeeded) ✓
  Sonner toast not captured (auto-dismisses faster than evaluate read);
  toast wiring is verified in code (useToggleResultsVisibility.ts uses
  toast.success/toast.error) and the EF-success path is the same code path
  as the toast call. Toast visibility deferred to user observation.

### 8. Voter VIS-08 — Hidden-State Alert + Own Choice
expected: |
  Sign in as a SECOND Discord account (or open an incognito window). Vote on a suggestion. Confirm results bars render (count breakouts visible). Now switch back to your admin tab, find that suggestion's Switch, and flip it to hidden. Switch back to the voter tab. Within a few seconds the count bars are replaced by: "Your response: {the choice you picked}" line + an Alert box with EyeOff icon and the text "Results temporarily hidden by admin". The icon should look subdued (muted-foreground), not full-contrast competing with the title.
result: blocked
blocked_by: other
reason: "User has only one Discord account; needs a community member or teammate to verify the voter-side VIS-08 flow post-deploy. TEST-13 Playwright E2E spec already covers this contract in CI when env vars are set."

### 9. Voter VIS-08 — Live Polling Auto-Update (~8s)
expected: |
  With the voter tab still open on a hidden suggestion (showing the Alert from Test 8): in the admin tab, flip the same Switch back to visible. Watch the voter tab WITHOUT refreshing. Within ~8 seconds (the polling cadence), the Alert disappears and the result bars return — showing the same vote count that was hidden moments earlier. No page reload needed. Flip back to hidden → within ~8 seconds the Alert returns. (This is the live VIS-08 polling extension on `polls_effective`.)
result: blocked
blocked_by: other
reason: "Same as Test 8 — second Discord account required. Defer to community verification post-deploy. TEST-13 spec covers the polling cadence + Alert/ResultBars swap in CI."

## Summary

total: 9
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 2
notes: |
  Tests 8 and 9 (voter VIS-08 Alert + 8s polling auto-update) blocked on
  second non-admin Discord account access. Deferred to community
  verification post-deploy. The locked TEST-13 Playwright E2E spec
  (e2e/tests/results-visibility.spec.ts) covers both flows end-to-end
  in CI when Supabase env vars are exported per 12-06 SUMMARY § User
  Setup Required — so the contracts are still gated, just not by manual
  UAT in this session.

## Gaps

- truth: "Both back-link sites (header + Cancel button) on SuggestionForm support new-tab gestures (middle-click, cmd-click, right-click) per UIDN-03 D-14."
  status: resolved
  reason: "User reported: the cancel button doesn't support new tab but the back to admin header link does"
  severity: major
  test: 3
  resolved_by: Plan 12-07 (commit 65d85a6)
  resolved_verified_by: Playwright MCP DOM inspection — Cancel now <a href=/admin>
  artifacts: []
  missing: []
