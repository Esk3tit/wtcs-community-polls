import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// Sentry plugin MUST be LAST in the plugins array — tree-shaking landmine
// (05-RESEARCH.md Pattern 6). `SENTRY_AUTH_TOKEN` is intentionally NOT
// `VITE_*`-prefixed: it is build-time only and must stay server-side (T-05-02).
//
// `disable` uses Vite's `mode` parameter (not process.env.NODE_ENV) because the
// config is loaded before Vite promotes NODE_ENV to 'production', so reading
// the env var at config-load time silently disables sourcemap upload on hosts
// like Netlify that don't set NODE_ENV=production in the shell.
export default defineConfig(({ mode }) => ({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { filesToDeleteAfterUpload: './dist/**/*.map' },
      disable: mode !== 'production',
    }),
  ],
  build: {
    sourcemap: 'hidden',
    // Phase 7 OBSV-02: preserve original function/class .name so Sentry
    // stack frames show source identifiers (e.g. handleResponseSubmit)
    // instead of mangled `xR`/`$M`. Rolldown's Oxc minifier preserves
    // names by leaving literal `function Name(...)` declarations in the
    // output (NOT by emitting esbuild's `__name(fn,'orig')` helper —
    // amended 2026-04-30 from PR #21 deploy-preview verification; see
    // .planning/phases/07-observability-hardening/artifacts/__name-grep.txt).
    // Function.prototype.name then survives Oxc's mangler (Vite 8 default
    // minifier). Bundle-size cost: ~0.5–1.5% gzip — measured in
    // .planning/closure/OBSV-02-bundle-delta.md.
    // Research: .planning/research/v1.1-VITE-SOURCEMAPS.md
    rolldownOptions: {
      output: { keepNames: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    passWithNoTests: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    // Dummy values so src/lib/supabase.ts doesn't throw at module-load
    // during tests that import hooks transitively touching the client.
    // Tests never hit Supabase — these are non-secret placeholders, not real creds.
    // CI (including dependabot) and fresh clones without .env.local rely on these.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
}))
