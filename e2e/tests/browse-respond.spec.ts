import { test, expect } from '@playwright/test'
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
test('[@smoke] user browses topics, responds, sees live results', async ({ page }) => {
  await loginAs(page, fixtureUsers.memberUser.id)
  await page.goto('/topics')

  // At least one fixture suggestion card rendered.
  const firstCard = page.getByTestId('suggestion-card').first()
  await expect(firstCard).toBeVisible()

  // Open the card (non-pinned cards are collapsible — click expands; pinned
  // cards start open, so a no-op click is still safe).
  await firstCard.click()

  // Pick the first choice in the expanded card. ChoiceButtons tags every
  // choice with data-testid="choice-button" so the selector is stable
  // across SuggestionCard's CollapsibleTrigger button.
  const firstChoice = firstCard.getByTestId('choice-button').first()
  await firstChoice.click()

  // After submit the card transitions to ResultBars — look for the
  // "N total response(s)" string which is only rendered post-submission.
  await expect(firstCard.getByText(/\d+\s+total response/i)).toBeVisible({ timeout: 10_000 })
})
