import { test, expect } from '../fixtures/poll-fixture'
import { loginAs } from '../helpers/auth'
import { fixtureUsers } from '../fixtures/test-users'

/**
 * D-08 journey #1: user browses /topics, picks a suggestion, submits a
 * response, sees the live result bars (role="meter" per 05-04 Task 3
 * M7 decision) + "N responses" text.
 *
 * Selectors:
 *   - data-testid="suggestion-card" (from 05-04 Task 3 — M7 hook)
 *   - data-testid="choice-button" (added per greptile PR #4 review —
 *     was getByRole('button').first() which ambiguously matched the
 *     CollapsibleTrigger button on non-pinned cards, collapsing the
 *     card instead of selecting a choice).
 *   - Result bars render role="meter"; visible text includes "{N}%" and
 *     "N total responses" (confirmed in 05-04 SUMMARY Decisions #2).
 */
test('[@smoke] user browses topics, responds, sees live results', async ({ page, freshPoll }) => {
  await loginAs(page, fixtureUsers.memberUser.id)
  await page.goto('/topics')

  // E2E-SCOPE-1: bind to fixture-inserted poll by exact title match.
  const firstCard = page
    .getByTestId('suggestion-card')
    .filter({ hasText: freshPoll.title })
    .first()
  await expect(firstCard).toBeVisible()

  // Defensive: clicking firstCard's bounding box on a pinned (already-expanded)
  // card may land on an inner choice-button and submit a vote before the
  // explicit firstChoice.click() below. Target the CollapsibleTrigger
  // explicitly and click only when it reports aria-expanded=false.
  // freshPoll is pinned (is_pinned=true), so SuggestionCard does not spread
  // role/aria-expanded onto the wrapper; this branch is normally dead.
  // Kept for resilience if a future fixture flips is_pinned=false (count
  // would then be 1 and the click would fire).
  // eslint-disable-next-line no-restricted-syntax -- DOM-scoped inside fixture card; at most one collapsed trigger exists when card is unpinned.
  const collapsedTrigger = firstCard.getByRole('button', { expanded: false }).first()
  // eslint-disable-next-line no-restricted-syntax -- DOM-scoped variable bound above; .count() probes presence of the at-most-one collapsed trigger.
  if (await collapsedTrigger.count()) {
    await collapsedTrigger.click()
  }

  // Pick the first choice in the expanded card. ChoiceButtons tags every
  // choice with data-testid="choice-button" so the selector is stable
  // across SuggestionCard's CollapsibleTrigger button.
  // eslint-disable-next-line no-restricted-syntax -- DOM-scoped inside fixture card; .first() picks the first choice button.
  const firstChoice = firstCard.getByTestId('choice-button').first()
  await firstChoice.click()

  // After submit the card transitions to ResultBars — look for the
  // "N total response(s)" string which is only rendered post-submission.
  await expect(firstCard.getByText(/[1-9]\d*\s+total response/i)).toBeVisible({ timeout: 10_000 })
})
