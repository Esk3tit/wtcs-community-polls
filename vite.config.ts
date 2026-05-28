import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { visualizer } from 'rollup-plugin-visualizer'

// Sentry plugin must be LAST — tree-shaking landmine.
// When ANALYZE=true, visualizer takes the last-plugin slot instead (mutually exclusive).
// SENTRY_AUTH_TOKEN is intentionally not VITE_*-prefixed (build-time, server-side only).
// `disable` reads Vite's `mode`, not process.env.NODE_ENV: this config loads
// before Vite promotes NODE_ENV, so process.env.NODE_ENV would silently disable
// sourcemap upload on hosts like Netlify that don't pre-set it in the shell.

// Guard against accidentally running an analyze build in Netlify production CI,
// which would displace sentryVitePlugin from last position and skip the OBSV-04
// sourcemap-upload chain established in Phase 15.
// `CONTEXT` is the env var Netlify natively sets to "production" in production deploys
// (verified via netlify.toml). `NETLIFY_CONTEXT` is guarded too for defense-in-depth.
if (
  process.env.ANALYZE === 'true' &&
  (process.env.CONTEXT === 'production' ||
    process.env.NETLIFY_CONTEXT === 'production')
) {
  throw new Error(
    '[OBSV-04] Cannot run bundle analysis in a Netlify production deploy. ' +
      'rollup-plugin-visualizer and sentryVitePlugin are mutually exclusive at the last-plugin ' +
      'position — running both would skip the Phase 15 sourcemap-upload chain and break ' +
      'Sentry stack-frame resolution. Unset ANALYZE or run bundle analysis locally only.',
  )
}

export default defineConfig(({ mode }) => {
  const plugins = [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ]

  if (process.env.ANALYZE === 'true') {
    plugins.push(
      visualizer({
        filename: 'dist/stats.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
    )
  } else {
    plugins.push(
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: { filesToDeleteAfterUpload: './dist/**/*.map' },
        disable: mode !== 'production',
      }),
    )
  }

  return {
    plugins,
    build: {
      sourcemap: 'hidden',
      // Preserve original function/class .name through Oxc minifier so Sentry
      // stack frames show source identifiers instead of mangled glyphs.
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
      // Non-secret placeholders so src/lib/supabase.ts doesn't throw at
      // module-load during tests that transitively import the client. Tests
      // never hit Supabase. CI and fresh clones without .env.local rely on these.
      env: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      },
    },
  }
})
