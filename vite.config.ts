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

export default defineConfig(({ mode }) => {
  // Guard against running an analyze build whenever the Sentry sourcemap chain
  // would be active, which would displace sentryVitePlugin from last position
  // and silently skip the OBSV-04 sourcemap-upload chain established in Phase 15.
  // The Sentry plugin's own `disable: mode !== 'production'` gates on Vite `mode`,
  // so key the guard on `mode` here so the two cannot diverge — a production-mode
  // build with ANALYZE set always fails loudly instead of silently dropping uploads.
  // `CONTEXT` / `NETLIFY_CONTEXT` are still guarded for defense-in-depth: Netlify
  // natively sets `CONTEXT=production` in production deploys (verified via netlify.toml).
  if (
    process.env.ANALYZE === 'true' &&
    (mode === 'production' ||
      process.env.CONTEXT === 'production' ||
      process.env.NETLIFY_CONTEXT === 'production')
  ) {
    throw new Error(
      '[OBSV-04] Cannot run bundle analysis in a production build. ' +
        'rollup-plugin-visualizer and sentryVitePlugin are mutually exclusive at the last-plugin ' +
        'position — running both would skip the Phase 15 sourcemap-upload chain and break ' +
        'Sentry stack-frame resolution. Unset ANALYZE or run bundle analysis locally only.',
    )
  }

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
      //
      // manualChunks pins two cache-stable vendor chunks:
      //   vendor-react — react + react-dom + scheduler (React's own runtime dep);
      //     all three rarely change and are fetched on every page load, so isolating
      //     them means app-only rebuilds don't bust the browser cache for this family.
      //   vendor-posthog — posthog-js (covers posthog-js/react sub-path too);
      //     kept in its own chunk for cache stability AND to make the lazy-load
      //     graph verifiable: this chunk must NOT appear in the initial HTML
      //     modulepreload set (it's only reachable via the consent-gated PostHogGate).
      // Boundary-anchored function form used (not object form) so the matcher is
      // explicit about which node_modules/<pkg>/ paths land in each chunk —
      // `id.includes('react')` is intentionally avoided because it would catch
      // @tanstack/react-router, @radix-ui/react-*, @sentry/react, etc.
      // supabase-js and sentry-replay are intentionally left to Rolldown auto-split.
      rolldownOptions: {
        output: {
          keepNames: true,
          manualChunks: (id) => {
            if (
              /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)
            )
              return 'vendor-react'
            if (/[\\/]node_modules[\\/]posthog-js[\\/]/.test(id))
              return 'vendor-posthog'
          },
        },
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
