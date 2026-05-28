import { test, expect } from '@playwright/test'

// MANDATORY GDPR runtime gate: proves the production bundle loads posthog-js
// ONLY after explicit consent — never on the critical path for non-consenting
// visitors. This spec runs against the production build (npm run preview) so it
// catches bundler-graph regressions that unit tests cannot: a unit test proves
// source intent; this spec proves the actual network payload.
//
// Pre-Allow assertion is the load-bearing invariant: zero /posthog/ requests
// before the user clicks Allow. Post-Allow assertion confirms the gate opens
// correctly on consent.
//
// Note: if VITE_POSTHOG_KEY is unset in the preview environment, posthog.init
// no-ops and no ingest request fires after Allow. In that case the post-Allow
// assertion checks for the lazy posthog-js chunk fetch under /assets/ instead.

test('no posthog network requests before consent Allow; fires after', async ({ page }) => {
  const posthogRequests: string[] = []

  // Capture any request whose URL contains 'posthog' (covers the lazy JS chunk
  // under /assets/ AND any posthog.com ingest endpoints).
  page.on('request', (req) => {
    if (/posthog/i.test(req.url())) posthogRequests.push(req.url())
  })

  await page.goto('/')

  // Wait for the consent banner — proves the app shell rendered (no blank page).
  const banner = page.getByRole('region', { name: 'Anonymous usage analytics consent' })
  await expect(banner).toBeVisible()

  // INVARIANT: posthog-js must not have been fetched or contacted before the
  // user explicitly opts in. This is the empirical proof that posthog-js is
  // absent from the critical-path bundle for non-consenting users.
  expect(
    posthogRequests,
    `posthog requests before Allow: ${posthogRequests.join(', ')}`,
  ).toHaveLength(0)

  // Opt in — this triggers ConsentProvider → PostHogGate state='allow' →
  // lazy import of PostHogProviderInner → posthog-js chunk loads.
  await banner.getByRole('button', { name: 'Allow' }).click()

  // After consent the lazy chunk and/or ingest endpoint must fire.
  // If VITE_POSTHOG_KEY is unset, only the chunk fetch fires (no ingest).
  await expect
    .poll(() => posthogRequests.length, {
      timeout: 10_000,
      message: 'Expected at least one posthog network request after Allow',
    })
    .toBeGreaterThan(0)
})
