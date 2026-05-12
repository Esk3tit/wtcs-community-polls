import { defineConfig } from 'vitest/config'

// Integration suite — separate config so the unit suite stays scoped to
// src/__tests__/ and never picks up DB-touching specs. Runs against a real
// local Supabase stack (started via `supabase start`); env vars MUST come
// from the shell (no placeholders injected here — a missing service-role
// key has to fail loud, not silently produce false-green RLS assertions).
//
// passWithNoTests: false — an empty integration result is a regression
// (the suite is the gate; nothing to run means the gate was bypassed).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['e2e/integration/**/*.test.ts'],
    passWithNoTests: false,
    testTimeout: 30_000,
  },
})
