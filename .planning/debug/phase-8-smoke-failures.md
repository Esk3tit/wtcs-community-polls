---
status: resolved
trigger: "Phase 8 smoke run reveals 2 deterministic Playwright failures (1 worker, isolated repro). Real bugs introduced by Plan 08-03 spec migrations + Plan 08-01 freshPoll fixture defaults. Convergence review missed these because plan-review only ran static grep gates, not live Playwright."
created: 2026-05-02
updated: 2026-05-02
goal: find_and_fix
phase: 08-e2e-test-hygiene
related_session: e2e-pr10-unmasked-failures (resolved; PR #14 — same suite, established the [E2E SMOKE] MiG-29 fixture row + SMOKE search convention)
---

## Symptoms

### Reproduction
```bash
SB_JSON=$(npx supabase status --output json)
export VITE_SUPABASE_URL=$(echo "$SB_JSON" | jq -r .API_URL)
export VITE_SUPABASE_ANON_KEY=$(echo "$SB_JSON" | jq -r .ANON_KEY)
export SUPABASE_SERVICE_ROLE_KEY=$(echo "$SB_JSON" | jq -r .SERVICE_ROLE_KEY)
npx playwright test --config e2e/playwright.config.ts e2e/tests/{browse-respond,filter-search}.spec.ts --grep @smoke --workers=1
```
DB pre-state verified clean: `[E2E SMOKE] Remove MiG-29` (Lineup Changes, active), `[E2E] Add Sinai` (Map Pool, active), `[E2E] Extend round timer` (Rules), `[E2E] Archived Sweden` (Lineup Changes, closed). 3 categories: Lineup Changes (a0000…01), Map Pool (a0000…02), Rules (a0000…03).

### Bug 1 — browse-respond.spec.ts:46 timeout
- **Test:** `[@smoke] user browses topics, responds, sees live results`
- **Error:** `locator.click: Test timeout of 30000ms exceeded` — waiting for `getByTestId('suggestion-card').filter({ hasText: '[E2E] smoke user browses topics responds sees live results <ts>' }).first().getByTestId('choice-button').first()`
- **Page snapshot at timeout:** Only 2 pinned Sinai cards visible above the fold. The freshPoll fixture row (is_pinned=false, category_id=null) is not in the visible region.
- **Earlier in test:** `await expect(firstCard).toBeVisible()` passed. Playwright considers off-screen-but-rendered as visible (non-empty bounding box).
- **Suspect commits:** Plan 08-01 fixture defaults (e2e/fixtures/poll-fixture.ts L41-52); Plan 08-03 Task 1 migration (e2e/tests/browse-respond.spec.ts L19, 23-25, 32, 40, 45).

### Bug 2 — filter-search.spec.ts:66 assertion failure
- **Test:** `[@smoke] user filters by category and searches`
- **Error:** `expect(filteredCount).toBeGreaterThan(0)` — Received: 0
- **Sequence:** click "Lineup Changes" tab → assert Sinai card hidden (PASSES) → count `[E2E]`-prefixed cards (returns 0)
- **DB ground truth:** 2 polls in Lineup Changes — `[E2E SMOKE] Remove MiG-29` (active) + `[E2E] Archived Sweden` (closed). At least one should remain visible after filter.
- **Page snapshot at timeout:** unavailable (error-context.md not produced for this failure — only image + video).
- **Suspect:** Plan 08-03 Task 2 migration (commit 9e809fc) inlined `.filter({hasText:/\[E2E\]/})` into every chain (removed `cards` alias). The `.toBeHidden()` assertion on Sinai may settle before list re-renders. OR active-only filter on /topics excludes archived `[E2E]` and the SMOKE row also doesn't render for a different reason.

### Expected behavior
- browse-respond: fixture freshPoll renders, expand → click first choice → ResultBars show "1 total response" → green
- filter-search: Lineup Changes tab shows ≥1 `[E2E]` card (the SMOKE row); narrowed search "SMOKE" returns exactly 1 → green

### Timeline
- Worked at PR #10 against shared seed (no per-test fixture; static `[E2E SMOKE]` row carried the smoke flow)
- Plan 08-01 introduced freshPoll fixture for per-test isolation
- Plan 08-03 Task 1 migrated browse-respond to consume freshPoll
- Plan 08-03 Task 2 migrated filter-search to inline-filter pattern (no fixture consumer)
- Smoke run BLOCKED on these two failures; phase 8 verifier returned `human_needed` then now `gaps_found`

### Code locations
- e2e/fixtures/poll-fixture.ts (freshPoll fixture — Plan 08-01)
- e2e/tests/browse-respond.spec.ts (Plan 08-03 Task 1)
- e2e/tests/filter-search.spec.ts (Plan 08-03 Task 2)
- e2e/fixtures/seed.sql (the [E2E SMOKE] MiG-29 + [E2E] Sinai/Rules/Sweden rows established in PR #14)
- src/hooks/useSuggestions.ts:78,127 (handles category_id null branch)
- src/routes/topics.tsx (filter UI logic + tab/category filter wiring)
- src/components/suggestions/ChoiceButtons.tsx:48 (choice-button data-testid)
- src/components/suggestions/SuggestionCard.tsx (collapsible/pinned rendering)

### Test artifacts
- test-results/browse-respond--smoke-user-37f5a--responds-sees-live-results-chromium/{video.webm, test-failed-1.png, error-context.md}
- test-results/filter-search--smoke-user-filters-by-category-and-searches-chromium/{video.webm, test-failed-1.png}

## Current Focus

hypothesis: RESOLVED — both root causes confirmed and fixed.

next_action: complete

## Evidence

- timestamp: 2026-05-02T22:50:00Z
  finding: "Both bugs reproduce deterministically with --workers=1 (not parallel-worker contamination)."

- timestamp: 2026-05-02T22:50:00Z
  finding: "DB state verified correct: 4 [E2E]-prefixed polls + base seed Sinai/MiG-29 rows + freshPoll cleanup is clean (0 leak rows)."

- timestamp: 2026-05-02T22:50:00Z
  finding: "browse-respond Page snapshot at timeout shows only 2 pinned Sinai cards visible (one [E2E] Add Sinai pinned, one base seed Sinai pinned). Fixture freshPoll card not in snapshot's visible region."

- timestamp: 2026-05-02T22:50:00Z
  finding: "filter-search test-failed-1.png exists but error-context.md does NOT (cat returned no such file) — visual snapshot only."

- timestamp: 2026-05-02T22:50:00Z
  finding: "Related session e2e-pr10-unmasked-failures established that filter-search.spec.ts already targets the [E2E SMOKE] MiG-29 row (renamed in commit 73ee79d). The migration in 9e809fc only changed locator chaining, NOT what's being searched."

- timestamp: 2026-05-02T23:30:00Z
  finding: "Bug 1 root cause: freshPoll (is_pinned=false) renders SuggestionCard with isOpen=false. The test's collapsedTrigger = firstCard.getByRole('button', { expanded: false }) searches INSIDE firstCard for descendants with role=button and aria-expanded=false. On non-pinned cards, the expand trigger IS the card's outer div itself — not a descendant. So count()=0, if-branch skipped, CollapsibleContent never opens, choice-buttons never render, 30s timeout."

- timestamp: 2026-05-02T23:30:00Z
  finding: "Bug 2 root cause: /\\[E2E\\]/ regex matches only the literal string [E2E] (bracket-E2E-bracket). The [E2E SMOKE] fixture row title contains [E2E SMOKE] — no direct [E2E] substring. After Lineup Changes filter, only [E2E SMOKE] (doesn't match) and base-seed MiG-29 (no [E2E] prefix) are visible. filteredCount=0."

- timestamp: 2026-05-02T23:35:00Z
  finding: "Full @smoke suite (5 tests) passes after both fixes: 5 passed (8.9s)."

## Eliminated

- hypothesis: "Parallel-worker race / fixture cross-contamination."
  evidence: "1-worker isolated repro fails identically. Sequential execution rules out parallelism noise."

- hypothesis: "Database missing seed rows."
  evidence: "Direct psql query confirms [E2E SMOKE] MiG-29 + [E2E] Sinai + [E2E] Sweden + [E2E] Extend round timer all present in correct categories with correct status."

- hypothesis: "freshPoll fixture cleanup is leaking rows that pollute later tests."
  evidence: "Leak query `count(*) where description = 'freshPoll fixture row'` returns 0 after suite. try/catch/finally cleanup works; AggregateError preserves test error."

- hypothesis: "filter-search filteredCount=0 is a timing/render race (toBeHidden resolves before re-render)."
  evidence: "Page snapshot confirms [E2E SMOKE] card IS rendered after Lineup Changes filter. Failure is regex mismatch, not timing."

## Resolution

root_cause: |
  Bug 1: freshPoll fixture inserted with is_pinned=false. SuggestionCard.tsx initializes
  isOpen=useState(suggestion.is_pinned)=false. The test's collapsedTrigger uses
  firstCard.getByRole('button', { expanded: false }) which searches DESCENDANTS of
  firstCard. On non-pinned cards, role="button" is on the card's outer div itself
  (not a descendant), so count()=0, if-branch is skipped, CollapsibleContent stays
  closed, choice-buttons are never in the DOM, 30s timeout.

  Bug 2: filter-search.spec.ts used /\[E2E\]/ (matches only "[E2E]" literally).
  The [E2E SMOKE] seed row title contains "[E2E SMOKE]" — no "[E2E]" substring.
  After Lineup Changes filter, only [E2E SMOKE] and base-seed MiG-29 render;
  neither matches /\[E2E\]/, so filteredCount=0.

fix: |
  Bug 1 (e2e/fixtures/poll-fixture.ts): changed is_pinned: false → true and
  category_id: null → 'a0000000-0000-0000-0000-000000000001' (Lineup Changes).
  Pinned cards initialize isOpen=true so CollapsibleContent renders immediately.

  Bug 2 (e2e/tests/filter-search.spec.ts): changed all 3 occurrences of /\[E2E\]/
  to /\[E2E/ (no closing bracket). Matches both "[E2E]" and "[E2E SMOKE]" prefixes.

verified: "5/5 @smoke tests pass after fixes."
