import { test, expect } from '@playwright/test'

// MANDATORY GDPR runtime gate: proves the production bundle loads posthog-js
// ONLY after explicit consent — never on the critical path for non-consenting
// visitors. This spec runs against the production build (npm run preview) so it
// catches bundler-graph regressions that unit tests cannot: a unit test proves
// source intent; this spec proves the actual network payload.
//
// Pre-Allow assertion is the load-bearing invariant: zero posthog-js requests
// before the user clicks Allow. Post-Allow assertion confirms the gate opens
// correctly on consent.
//
// Note: if VITE_POSTHOG_KEY is unset in the preview environment, posthog.init
// no-ops and no ingest request fires after Allow. In that case the post-Allow
// assertion checks for the lazy posthog-js chunk fetch under /assets/ instead.

// Returns true for requests that represent the HEAVY posthog-js library or its
// network ingest/decide endpoints — the surface that must stay off the critical
// path for non-consenting visitors.
//
// Keys on artifacts that genuinely represent posthog-js execution rather than a
// filename substring: (a) the PostHog ingest/decide hosts (these only fire if
// posthog-js actually ran), and (b) the vendor-posthog library chunk by its
// stable manualChunks name prefix (vite.config.ts pins posthog-js into
// `vendor-posthog`; Rolldown preserves that name as the emitted file prefix).
// The thin static facade (posthog-facade.ts) uses `import type` only, so
// posthog-js is fully erased from it — its chunk is neither an ingest endpoint
// nor the vendor-posthog file, so it never matches and needs no substring escape.
function isHeavyPosthogRequest(url: string): boolean {
  // Ingest/decide endpoints — these only fire if posthog-js actually ran.
  if (/(\.|\/\/)(i|us|eu)\.posthog\.com/i.test(url)) return true
  // The lazy posthog-js library chunk, matched by its stable name prefix.
  if (/\/assets\/vendor-posthog-[^/]+\.js$/i.test(url)) return true
  return false
}

test('no posthog network requests before consent Allow; fires after', async ({ page }) => {
  const posthogRequests: string[] = []

  // Capture any request that represents the posthog-js library or ingest —
  // excluding the intentional facade shim (see isHeavyPosthogRequest above).
  page.on('request', (req) => {
    if (isHeavyPosthogRequest(req.url())) posthogRequests.push(req.url())
  })

  await page.goto('/')

  // Wait for the consent banner — proves the app shell rendered (no blank page).
  const banner = page.getByRole('region', { name: 'Anonymous usage analytics consent' })
  await expect(banner).toBeVisible()

  // INVARIANT: the posthog-js library must not have been fetched or contacted
  // before the user explicitly opts in. This is the empirical proof that
  // posthog-js is absent from the critical-path bundle for non-consenting users.
  expect(
    posthogRequests,
    `posthog-js library/ingest requests before Allow: ${posthogRequests.join(', ')}`,
  ).toHaveLength(0)

  // INVARIANT: the vendor-posthog chunk must not be in the initial document's
  // <link rel="modulepreload"> set — it is only reachable via the consent-gated
  // PostHogGate, so the browser must never speculatively warm it on load. This
  // verifies the lazy-load graph claim the vite.config.ts manualChunks comment
  // makes but nothing else proves.
  const modulepreloadHrefs = await page.$$eval(
    'link[rel="modulepreload"]',
    (links) => links.map((l) => (l as HTMLLinkElement).href),
  )
  expect(
    modulepreloadHrefs.filter((href) => /\/assets\/vendor-posthog-[^/]+\.js$/i.test(href)),
    `vendor-posthog chunk must be absent from initial modulepreload set: ${modulepreloadHrefs.join(', ')}`,
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
