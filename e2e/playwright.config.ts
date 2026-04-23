import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config — Phase 05-05.
 *
 * Per-test session injection: each spec calls `loginAs(page, userId)` which
 * mints a Supabase session via `signInWithPassword` and writes it into
 * localStorage via `page.addInitScript` before navigation. Sessions are
 * minted per-test in the helper; no top-level shared-auth fixture file.
 * See e2e/helpers/auth.ts (HIGH #2 resolution).
 *
 * v1 is chromium-only by design — scope is smoke, not cross-browser matrix.
 * Wave 3 CI (Plan 05-06) starts `supabase start` then runs `vite preview`
 * separately, so `webServer` only fires locally (CI sets its own baseURL).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run build && npm run preview',
        url: 'http://localhost:4173',
        // CR-PR4: this branch only runs when !CI, so reuseExistingServer is
        // tautologically true here. Hardcode for clarity.
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
