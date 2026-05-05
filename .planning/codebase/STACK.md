# Technology Stack

**Analysis Date:** 2026-05-04 (refreshed post v1.0 ship; supersedes 2026-04-06 Vite-scaffold snapshot)

## Languages

### Primary
- TypeScript ~6.0.2 — Application code, build configuration, Edge Functions

### Secondary
- JavaScript — ESLint configuration files only

## Runtime

### Environment
- Node.js (development) — Required for tooling and build processes
- Deno (Edge Functions, server-side) — Supabase Functions runtime

### Package Manager
- npm
- Lockfile: `package-lock.json` (committed)

## Frameworks

### Core
- React 19.2.4 — UI library and component framework
- React DOM 19.2.4 — DOM rendering for React
- TanStack Router 1.168.10 — file-based routing with type-safe navigation
- TanStack Router CLI 1.166.25 — `tsr generate` for `routeTree.gen.ts`

### Build / Dev
- Vite 8.0.4 — Build tool and development server
- @vitejs/plugin-react 6.0.1 — React integration with Fast Refresh support
- TypeScript 6.0.2 — Static type checking and compilation
- @sentry/vite-plugin 5.2.0 — Source map upload during build
- @tailwindcss/vite 4.2.2 — Tailwind v4 vite plugin

### Linting / Formatting
- ESLint 9.39.4 — Code linting
- @eslint/js 9.39.4 — Base JavaScript ESLint rules
- typescript-eslint 8.58.0 — TypeScript support for ESLint
- eslint-plugin-react-hooks 7.0.1 — React Hooks best practices
- eslint-plugin-react-refresh 0.5.2 — React Fast Refresh rules
- globals 17.4.0 — Global variable definitions

### Backend / Data
- Supabase JS client 2.101.1 — Auth, Postgres, Edge Functions, Storage
- Supabase Postgres + RLS — primary datastore (free tier 500 MB)
- Supabase Edge Functions — server-side mutation handlers (16 functions at v1.0)
- Upstash Redis (free tier) — sliding-window rate limiting

### Styling
- Tailwind CSS 4.2.2 — utility-first CSS
- shadcn/ui (new-york style, Neutral baseColor) — vendored under `src/components/ui/`
- class-variance-authority 0.7.1 — component variant API used by shadcn primitives
- clsx 2.1.1 + tailwind-merge 3.5.0 — class merging
- next-themes 0.4.6 — light/dark mode toggle
- lucide-react 1.7.0 — icon set
- radix-ui 1.4.3 — accessible primitive dependencies for shadcn components
- sonner 2.0.7 — toast notifications

### Observability / Analytics
- @sentry/react 10.49.0 — error capture + session replay (opt-in)
- posthog-js 1.369.3 — product analytics (opt-in via ConsentContext)

### Testing
- Vitest — unit + component test runner
- @testing-library/react 16.3.2 — React component testing
- @testing-library/user-event 14.6.1 — user-interaction simulation
- @testing-library/jest-dom 6.9.1 — DOM matchers
- @playwright/test 1.59.1 — E2E + visual regression (under `e2e/`)

## Key Dependencies

### Type Definitions
- @types/react 19.2.14 — React type definitions
- @types/react-dom 19.2.3 — React DOM type definitions
- @types/node 24.12.2 — Node.js type definitions

## Configuration

### Environment
- `.env` for local Supabase URL + anon key + Upstash credentials (NOT committed)
- Production env injected via Netlify deploy environment
- Development: `npm run dev` with Vite dev server (default port 5173)
- Build: `tsr generate && tsc -b && vite build`

### Build
- Vite config: `vite.config.ts` — React plugin, Tailwind plugin, Sentry plugin
- TypeScript configs: `tsconfig.json` (root references), `tsconfig.app.json` (ES2023 + JSX + bundler), `tsconfig.node.json` (ES2023 + bundler for build tooling)
- ESLint config: `eslint.config.js` — flat config with React + TypeScript support

## Platform Requirements

### Development
- Node.js with npm — required for tooling
- Modern terminal/IDE with TypeScript support
- Browser with ES2023 support — required for both dev and prod (single shared target)
- Supabase CLI (optional, for local Edge Function development)

### Production
- Browser with ES2023 support (same target as dev)
- Served as static SPA bundle — Netlify legacy free tier
- Supabase project (Postgres + Auth + Edge Functions + Storage) — free tier
- Upstash Redis project (free tier) — for rate limiting

## Build & Run Commands

- `npm install` — Install dependencies
- `npm run dev` — Start Vite development server
- `npm run generate` — Re-emit TanStack Router `routeTree.gen.ts`
- `npm run build` — Production build (`tsr generate && tsc -b && vite build`)
- `npm run preview` — Preview production build locally
- `npm run lint` — Run ESLint checks
- `npm run test` — Run Vitest unit/component tests
- `supabase functions deploy <name>` — Deploy a specific Edge Function

---

*Stack analysis: 2026-05-04 (post v1.0 ship rewrite — replaces 2026-04-06 Vite-scaffold snapshot)*
