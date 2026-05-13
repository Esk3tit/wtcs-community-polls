---
status: complete
phase: 02-browsing-responding
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-04-07T14:00:00Z
updated: 2026-04-07T14:00:00Z
---

## Current Test

[testing complete]
expected: |
  Navigate to /topics while logged in. You should see a list of active suggestions (from seed data). Each suggestion appears as a card with a category badge, title, and time remaining. Pinned suggestions appear at the top with an amber banner.
awaiting: user response

## Tests

### 1. Topics page loads with suggestion list
expected: Navigate to /topics while logged in. You should see a list of active suggestions (from seed data). Each suggestion appears as a card with a category badge, title, and time remaining. Pinned suggestions appear at the top with an amber banner.
result: pass
note: Dark mode colors are off — badges and UI elements retain light mode colors instead of adapting. Logged as separate cosmetic issue.

### 2. Category filtering works
expected: On /topics, you see category filter pills (e.g. "All", plus seed categories). Clicking a category pill filters the list to only show suggestions in that category. Clicking "All" shows everything again.
result: pass

### 3. Search filters suggestions by text
expected: Type a keyword from a seed suggestion title into the search bar. The list filters in real-time (with slight debounce delay). Clearing the search restores the full list.
result: pass

### 4. Suggestion card expands to show choices
expected: Click on a non-pinned suggestion card. It expands to reveal the choice buttons (e.g. "Yes", "No" or multiple options). Pinned cards are already expanded by default.
result: pass

### 5. Vote submission works (respond-then-reveal)
expected: On an active suggestion you haven't voted on, click a choice button. A spinner appears briefly, then a success toast. After voting, choice buttons are replaced by result bars showing percentages with your choice highlighted by a check icon.
result: pass
note: Required deploying Edge Function first. CORS fix updated to allow localhost origin for dev.

### 6. Cannot vote twice on same suggestion
expected: After voting on a suggestion, refreshing the page still shows your vote and result bars instead of choice buttons. You cannot submit another vote.
result: pass

### 7. Live polling updates results
expected: After voting, result counts should update automatically every ~8 seconds without refreshing the page (visible if another user votes in the meantime, or counts remain stable).
result: pass
note: Confirmed via Network tab — three 200 GET requests to vote_counts at regular ~8s intervals, no errors.

### 8. Archive page shows closed suggestions
expected: Navigate to /archive. You see closed/resolved suggestions. If you previously responded to a closed suggestion, you can see its result bars. If you did not respond, you see a "This topic is closed" message instead of results.
result: pass

### 9. Mobile responsiveness
expected: View /topics on a phone-width screen (~375px). Cards stack vertically, choice buttons are tap-friendly, result bars are readable, and there is no horizontal scroll.
result: pass
note: Toast/modal for "response recorded" is see-through — distracting with cards visible behind it. Logged as cosmetic fix.

### 10. Empty state displays correctly
expected: If all suggestions are filtered out (e.g. search for gibberish text), an empty state message appears with an option to clear the search.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
