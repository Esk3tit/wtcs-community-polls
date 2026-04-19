import { test, expect } from '@playwright/test'

/**
 * D-08 journey #4: AuthErrorPage renders the correct variant for each
 * rejection reason.
 *
 * Driven by the route's `?reason=…` search param, NOT by a real Discord
 * OAuth rejection (D-05 rationale: real Discord rejection is covered by
 * Phase 1 unit tests; the E2E layer only asserts the rendered surface).
 *
 * Route validates `reason ∈ {2fa-required, session-expired, auth-failed,
 * not-in-server}` — see src/routes/auth/error.tsx. An unknown reason
 * falls back to `auth-failed`, so the spec uses the exact valid tokens.
 *
 * These two tests do NOT call `loginAs` because AuthErrorPage renders
 * without an authenticated session (it's the pre-auth rejection surface).
 */

test('[@smoke] auth error page renders 2fa-required variant', async ({ page }) => {
  await page.goto('/auth/error?reason=2fa-required')
  // Heading copy from src/components/auth/AuthErrorPage.tsx:
  // "Two-Factor Authentication Required"
  await expect(page.getByRole('heading', { name: /two-factor|2fa/i })).toBeVisible()
})

test('[@smoke] auth error page renders not-in-server variant', async ({ page }) => {
  await page.goto('/auth/error?reason=not-in-server')
  // Heading copy: "WTCS Server Membership Required"
  await expect(page.getByRole('heading', { name: /server membership|wtcs server/i })).toBeVisible()
})
