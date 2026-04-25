---
status: partially_resolved
trigger: "PR #10 e2e CI run (run 24901691176, 2026-04-24T17:04Z) surfaced 3 failing @smoke specs after the auth-FK seed fix landed: filter-search (fixed in PR #14), admin-create, and browse-respond. The latter two were previously masked because auth blocking prevented test execution from reaching their assertions; the FK fix unmasked them. User wants both fixed in PR #14 if feasible."
created: 2026-04-25
updated: 2026-04-25
goal: find_and_fix
resolution_failure_1: "FIXED in PR #14 — admin-create spec updated to click Yes/No preset before submit, populating the empty choices the validator rejected."
resolution_failure_2: "DEFERRED — submit-vote EF requires Upstash Redis; CI provides no creds; fix needs either production EF graceful-degradation (security review) or CI Redis-compat sidecar (significant infra work). Filed as separate concern."
---

## Current Focus

hypothesis: Both failures diagnosed; only failure 1 was test-only and safe to fix in PR #14
test: Re-running PR #14 CI after fix push will confirm filter-search + admin-create pass; browse-respond will still fail on Upstash absence
expecting: e2e job goes from 3 failing → 1 failing (just browse-respond)
next_action: Push spec fix to PR #14, watch CI, then file separate ticket / debug session for browse-respond Upstash gap

## Symptoms — Failure 1: admin-create.spec.ts

expected: After clicking submit on /admin/suggestions/new, the page should navigate back to /admin (or /admin/suggestions) per the assertion at e2e/tests/admin-create.spec.ts:49 — `expect(page).toHaveURL(/\/admin(?:\/suggestions)?\/?(?:\?.*)?$/, { timeout: 10_000 })`.
actual: 14× retries see the page stuck at `http://localhost:4173/admin/suggestions/new`. Form submission does not navigate.
errors: |
  Error: expect(page).toHaveURL(expected) failed
    - Expect "toHaveURL" with timeout 10000ms
    - 14 × unexpected value "http://localhost:4173/admin/suggestions/new"
    > 49 |   await expect(page).toHaveURL(/\/admin(?:\/suggestions)?\/?(?:\?.*)?$/, { timeout: 10_000 })
        at e2e/tests/admin-create.spec.ts:49:22
reproduction: PR #10 CI run #24901691176, e2e job. Reproduces locally with `supabase db reset && PGOPTIONS='-c app.e2e_seed_allowed=true' psql "$DB_URL" -f e2e/fixtures/seed.sql && npx playwright test admin-create`.
started: 2026-04-24T17:04Z (first run after FK fix in commit 6ef3ab4 unblocked auth)
test_inputs: |
  Test fills only `title` field (line 35: `page.getByLabel(/title/i).fill(uniqueTitle)`) then clicks `data-testid="suggestion-form-submit"` (line 42). It does NOT fill choices, category, timer, or image.
spec_file: e2e/tests/admin-create.spec.ts
key_dependencies:
  - src/components/admin/SuggestionForm.tsx (form component — what fields are required?)
  - src/components/admin/ChoicesEditor.tsx (choice rows — defaults?)
  - src/components/admin/TimerPicker.tsx (timer presets — does it auto-select?)
  - src/components/admin/CategoryPicker.tsx (category — required?)
  - supabase/functions/create-poll/index.ts (server-side validation — would it accept defaults?)

## Symptoms — Failure 2: browse-respond.spec.ts

expected: After logging in as a member, navigating to /topics, expanding a card, and clicking a choice button, the card should transition to result bars showing "N total response(s)" text within 10s. Assertion at e2e/tests/browse-respond.spec.ts:45.
actual: "N total response(s)" element never appears. Test times out with `element(s) not found`.
errors: |
  Error: expect(locator).toBeVisible() failed
    Error: element(s) not found
    > 45 |   await expect(firstCard.getByText(/\d+\s+total response/i)).toBeVisible({ timeout: 10_000 })
        at e2e/tests/browse-respond.spec.ts:45:62
reproduction: Same as failure 1.
started: Same as failure 1.
test_actions: |
  1. loginAs memberUser (UUID 11111111…)
  2. goto /topics
  3. firstCard = first suggestion-card
  4. Click CollapsibleTrigger if aria-expanded=false (skip if already expanded)
  5. Click first `choice-button` inside firstCard
  6. Wait for "N total response(s)" text — fails here
spec_file: e2e/tests/browse-respond.spec.ts
key_dependencies:
  - src/components/suggestions/SuggestionCard.tsx (card with collapsible + result bars)
  - src/components/suggestions/ChoiceButtons.tsx (choice button selectors)
  - src/components/suggestions/ResultBars.tsx (post-vote UI)
  - src/hooks/useSubmitVote.ts (vote mutation)
  - supabase/functions/submit-vote/index.ts (server-side vote handler)
  - useSuggestions ordering: which poll is "first"? With both base seed + e2e fixture applied, ordering depends on is_pinned + created_at. base seed pinned: b0000…01 (MiG-29) AND b0000…02 (Sinai). E2E fixture pinned: d0000…02 (Sinai). So 3 pinned polls, ordered by created_at within is_pinned=true. The "first" card may be the base seed MiG-29 which was created in the same `now()` second as base seed Sinai.

## Eliminated

- hypothesis: Auth FK seed bug
  evidence: Fixed in commit 6ef3ab4 (PR #10 / merged 8577fe8). The 3 failing specs proved auth was unblocked because they reached their respective assertions instead of failing earlier on `loginAs` or page-load auth-redirects.
  timestamp: 2026-04-25

- hypothesis: filter-search MiG-29 collision (failure 3)
  evidence: Already fixed in PR #14 (commit 73ee79d) — fixture rename + spec update to use SMOKE token. Not in scope for this debug session.
  timestamp: 2026-04-25

## Investigation Targets

For Failure 1 (admin-create):
- Read SuggestionForm.tsx to enumerate required fields and confirm what causes submit to silently fail (client validation? toast on missing field? etc.)
- Decide: (a) update spec to fill all required fields (likely correct), or (b) add sensible defaults to SuggestionForm if there's a UX gap

For Failure 2 (browse-respond):
- Determine which card is "first" given the layered seed
- Trace: does the choice-button click reach submit-vote EF? (Network/console logs in Playwright trace)
- Hypothesis A: vote already exists for this user+poll (idempotency state) so EF returns 409, no result bars
- Hypothesis B: submitVote mutation fails for some other reason (e.g. RLS, missing required cols)
- Hypothesis C: result bars render but the text format doesn't match `/\d+\s+total response/i` (case/format drift)

## Constraints

- **Scope:** Both fixes must land on PR branch `fix/e2e-mig29-fixture-collision` (PR #14, currently 1 commit ahead of main). Adding 2 more commits is fine.
- **No prod-affecting changes:** Stay in `e2e/` and `supabase/functions/` (EF source); avoid touching `supabase/seed.sql` (already covered by PR #10) or `supabase/migrations/` (would need migration push).
- **Time:** User said "if we can fix it for this PR we should" — bias toward fixing the test (cheap) over fixing the form/EF (expensive) unless the form/EF is genuinely buggy.
