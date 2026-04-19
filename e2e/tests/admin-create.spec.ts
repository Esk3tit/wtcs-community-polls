import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { fixtureUsers } from '../fixtures/test-users'

/**
 * D-08 journey #3: admin creates a suggestion; a regular user verifies it
 * appears publicly on /topics.
 *
 * Selectors:
 *   - data-testid="admin-create-suggestion" — primary toolbar Create button
 *     (05-04 Task 3 M7 hook; confirmed in 05-04 SUMMARY Decisions #1 that
 *     the hook lives on AdminSuggestionsTab's primary button).
 *   - Admin create button navigates to /admin/suggestions/new where
 *     <SuggestionForm mode="create"> renders.
 *
 * Context switch: re-running `loginAs` with a different fixture user
 * overwrites the localStorage session via `page.addInitScript` on the
 * next navigation.
 */
test('[@smoke] admin creates suggestion and it appears for users', async ({ page }) => {
  // --- Admin side -----------------------------------------------------
  await loginAs(page, fixtureUsers.adminUser.id)
  await page.goto('/admin')

  // Use the M7 stable testid for the primary Create trigger.
  await page.getByTestId('admin-create-suggestion').click()

  // SuggestionForm — fill minimum required fields. The title contains a
  // unique timestamp so the spec is idempotent across re-runs.
  const uniqueTitle = `[E2E] Admin-create ${Date.now()}`
  await page.getByLabel(/title/i).fill(uniqueTitle)

  // Submit. The primary submit is labelled "Create suggestion" / "Create"
  // / "Publish" depending on form variant — match broadly.
  await page.getByRole('button', { name: /create|publish|submit/i }).last().click()

  // After submit we land back on the admin list and the new row is visible.
  await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 })
  await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10_000 })

  // --- Member side ----------------------------------------------------
  // Re-login as the non-admin member user to verify public visibility.
  await loginAs(page, fixtureUsers.memberUser.id)
  await page.goto('/topics')
  await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10_000 })
})
