import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { fixtureUsers } from '../fixtures/test-users'

/**
 * D-08 journey #2: user filters by category tab + narrows with search.
 *
 * Selectors:
 *   - data-testid="suggestion-card" counts the visible list (M7 hook from
 *     05-04 Task 3).
 *   - CategoryFilter renders <Button role="tab">Category Name</Button>.
 *   - SearchBar renders <Input aria-label="Search topics"> with
 *     placeholder "Search topics..." — use the aria-label for stability.
 *
 * Fixture data (e2e/fixtures/seed.sql):
 *   - 3 active polls: MiG-29 (Lineup Changes), Sinai (Map Pool), Timer (Rules)
 *   - 1 closed poll (Sweden bracket) — filtered out of /topics
 *
 * Note on collision avoidance: the base supabase/seed.sql also seeds a
 * "Remove MiG-29 12-3 from 11.3 lineup" poll (UUID b0000…01), so naive
 * search for "MiG-29" returns 2 cards in CI. Fixture poll titles carry a
 * unique "SMOKE" token; the search assertion below narrows on SMOKE
 * (uniquely the fixture) rather than MiG-29 (matches base + fixture).
 */
test('[@smoke] user filters by category and searches', async ({ page }) => {
  await loginAs(page, fixtureUsers.memberUser.id)
  await page.goto('/topics')

  // Baseline: at least one card rendered.
  const cards = page.getByTestId('suggestion-card')
  await expect(cards.first()).toBeVisible()
  const initialCount = await cards.count()
  expect(initialCount).toBeGreaterThan(0)

  // Filter by a category tab. Lineup Changes is a fixture category and
  // contains the MiG-29 fixture poll.
  await page.getByRole('tab', { name: /lineup changes/i }).click()
  // CR-PR4 + gemini-PR14: wait for a deterministic post-filter signal
  // before reading the count. Asserting that a SMOKE poll becomes visible
  // is racy because SMOKE polls are also visible in the default "All"
  // tab — toBeVisible resolves immediately even if the DOM hasn't yet
  // re-rendered the filtered list. Instead, wait for a NON-Lineup-Changes
  // poll (Sinai, Map Pool category) to become hidden — that's only true
  // AFTER the filter has actually applied. `.first()` disambiguates the
  // multi-element locator (Sinai appears in both the base seed and the
  // e2e fixture) and toBeHidden passes when the element is either
  // detached from the DOM or visually hidden.
  await expect(page.getByText(/Sinai/i).first()).toBeHidden({ timeout: 5_000 })
  const filteredCount = await cards.count()
  expect(filteredCount).toBeGreaterThan(0)
  expect(filteredCount).toBeLessThanOrEqual(initialCount)

  // Narrow further with a search term that uniquely matches the fixture
  // title ("[E2E SMOKE] Remove MiG-29 12-3 from 11.3 lineup"). The base
  // supabase/seed.sql poll has the same MiG-29 substring but no SMOKE
  // token, so this matches exactly one card.
  await page.getByLabel(/search topics/i).fill('SMOKE')
  await expect(cards).toHaveCount(1, { timeout: 5_000 })
})
