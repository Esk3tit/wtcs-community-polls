<!-- GSD:project-start source:PROJECT.md -->
## Project

**WTCS Community Polls**

A community suggestion and opinion-gathering platform for the War Thunder Competitive Scene (WTCS). Admins create suggestions/topics (e.g. "Remove MiG-29 12-3 from this lineup"), community members share their opinions via Discord OAuth. Hosted at [polls.wtcsmapban.com](https://polls.wtcsmapban.com) as a sibling to the main WTCS Map Vote/Ban app — fully independent, sharing only admin accounts conceptually. Live since 2026-04-28 (v1.0).

**User-facing name:** WTCS Community Suggestions
**Internal/admin name:** WTCS Community Polls (used in code, DB, admin UI)

**Core Value:** Community members can share opinions on competitive scene proposals with confidence that results are authentic — one verified Discord account, one response, no manipulation.

### Constraints

- **Budget**: $0/month — Supabase free tier, Netlify legacy free tier, Upstash Redis free tier (validated through v1.0 ship)
- **Tech stack**: Vite + React 19 + TypeScript + TanStack Router + shadcn/ui + Tailwind CSS v4 (frontend), Supabase (backend), Netlify (hosting) — all locked decisions, all shipped
- **Auth**: Discord OAuth only, enforced via Supabase native Discord provider with mandatory 2FA
- **Scale**: Must work within Supabase free tier limits (500MB DB, 1GB storage, 2M Edge Function invocations/month)
- **Hosting**: Netlify legacy free tier — separate site from main WTCS app
- **Rate limiting**: Upstash Redis free tier — sliding-window 5 req/60s on submit-vote
- **Design system**: shadcn/ui new-york style, Neutral baseColor, Inter font
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
### Files
- React components: PascalCase with `.tsx` extension (e.g., `SuggestionCard.tsx`, `AuthGate.tsx`)
- Route files: kebab-case under `src/routes/` (TanStack Router file-based routing — filename IS the route)
- Hooks: camelCase, `use`-prefixed `.ts` (e.g., `useSuggestions.ts`, `useVoteSubmit.ts`)
- Edge Functions: kebab-case directories under `supabase/functions/` (e.g., `submit-vote/`, `create-poll/`)
- Tests: mirror source path under `src/__tests__/` with `.test.ts` / `.test.tsx` suffix
- Styles: Tailwind utility classes inline in JSX; only `src/index.css` for global tokens
### Functions
- React component functions: PascalCase (e.g., `function SuggestionCard()`)
- Custom hooks: camelCase, `use`-prefixed (e.g., `useSuggestions`, `useVoteSubmit`)
- Edge Function handlers: default export of an async `(req: Request) => Response` arrow
- Utilities: camelCase verbs (`formatDate`, `parseSuggestion`, `assertAdmin`)
### Variables
- State variables: camelCase (e.g., `isLoading`, `selectedCategory`)
- React Context values: PascalCase Context + camelCase consumer hook (e.g., `AuthContext` + `useAuth`)
- Boolean flags: positive phrasing, `is`/`has`/`can` prefix (`isAuthenticated`, `hasResponded`)
- Tailwind class names: kebab-case (Tailwind convention)
- DOM IDs: kebab-case where used (mostly avoided in favor of refs)
### Types
- TypeScript strict mode via `tsconfig.app.json` targeting ES2023
- Type aliases: PascalCase (`Suggestion`, `VoteResponse`, `EdgeFunctionError`)
- Generic type params: single uppercase letter or PascalCase descriptor (`T`, `TRow`, `TError`)
- Interface vs type alias: project leans on `type` aliases; `interface` reserved for public extension points
## Code Style
### Formatting
- No `.prettierrc` — formatting governed by ESLint flat config (`eslint.config.js`)
- ECMAScript 2020+ syntax supported; modern features (top-level await, `??`, `?.`) used freely
- Indentation: 2 spaces (ESLint default)
### Linting
- ESLint 9.39.4 with flat config (`eslint.config.js`)
- `@eslint/js` — JavaScript baseline recommendations
- `typescript-eslint` — TypeScript-specific rules
- `eslint-plugin-react-hooks` — React Hooks best practices
- `eslint-plugin-react-refresh` — Vite React refresh compatibility
- Browser globals enabled via `globals.browser`
- ECMAVersion: 2020
### Enforced Constraints
- `noUnusedLocals: true` — Unused variables cause compilation error
- `noUnusedParameters: true` — Unused function parameters cause error
- `erasableSyntaxOnly: true` — Only syntax that can be erased during type-stripping allowed
- `noFallthroughCasesInSwitch: true` — Switch case fallthrough requires explicit handling
- `verbatimModuleSyntax: true` — Requires explicit `import type` / `export type` where applicable
## Import Organization
### Order
- React imports first (e.g., `import { useState } from 'react'`)
- Third-party libraries next (TanStack Router, Supabase, Sentry, etc.)
- Local imports grouped: contexts → hooks → components → utilities → types
- CSS imports last (or only in `main.tsx` for `index.css`)
### Path Aliases
- Not configured — relative imports used throughout `src/`
- Module resolution: `bundler` mode via `tsconfig.app.json`
### Module Syntax
- ESM only (`"type": "module"` in `package.json`)
- `verbatimModuleSyntax: true` — Requires explicit `import type` for type-only imports
- No CommonJS in app code
## Error Handling
### Patterns
- Try/catch wrappers around Supabase calls inside hooks (surface `error` state to UI)
- Edge Functions return structured `{ error: { code, message } }` on failure (4xx/5xx)
- React error boundaries wrap key route subtrees; Sentry captures unhandled errors
- Auth-failure path: explicit redirect to `/auth/error` with actionable copy (e.g., 2FA required)
- Empty catch blocks are forbidden — every catch must log or rethrow
## Logging
### Framework
- Sentry for client-side error capture (opt-in session replay via ConsentContext)
- PostHog for product analytics (opt-in)
- Edge Functions: `console.error` / `console.log` flow to Supabase Function logs
### Patterns
- No verbose `console.log` left in committed code (lint discourages it)
- Sentry breadcrumbs added at major user-action boundaries (sign-in, vote-submit, admin mutations)
## Comments
### When to Comment
- WHY-only — explain rationale and non-obvious constraints, not what the code does
- No review-round / phase-ID archaeology in `src/` (rot tags forbidden — plan refs belong in PR/commit, not src/)
- Edge Function rate-limit logic, auth boundary checks, and RLS-policy assumptions get inline WHY comments
### JSDoc/TSDoc
- Used sparingly on public-facing utilities and hook return shapes
- TypeScript types provide most of the documentation surface
## Function Design
### Size
- Components: keep under ~150 lines; split into sub-components or extract hooks when larger
- Hooks: single responsibility (one read or one mutation per hook)
- Edge Functions: one handler per file under `supabase/functions/<name>/index.ts`
### Parameters
- React components: typed props (single object) — no positional args
- Hooks: minimal positional args; complex inputs as a single options object
- Edge Functions: receive `Request`, parse `body` after validation
### Return Values
- Components return JSX
- Read hooks return `{ data, isLoading, error }` (or similar discriminated union)
- Mutation hooks return `{ mutate, isPending, error, data }` (callable + status)
- Edge Functions return `Response` (JSON body)
## Module Design
### Exports
- One primary named export per file (no default exports for components)
- Edge Functions use `export default` for the handler (Deno/Supabase convention)
- Barrel files (`index.ts` re-exports) avoided — direct imports preferred for tree-shaking clarity
### Barrel Files
- Not used — direct imports from source files
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
### Key Characteristics
- React 19 + TypeScript SPA, file-based routing via TanStack Router (`src/routes/`, `src/routeTree.gen.ts` generated by `tsr generate`)
- Tailwind CSS v4 + shadcn/ui (new-york style, Neutral baseColor) for styling — no CSS modules, no CSS-in-JS
- Supabase (Postgres + Auth + Edge Functions + Storage) as the backend; Discord OAuth via Supabase Auth provider
- Upstash Redis (free tier) for sliding-window rate limiting on submit-vote
- Sentry for error tracking + session replay (opt-in)
- PostHog for product analytics (opt-in, GDPR-aware via ConsentContext)
- Two completely separate user surfaces: public suggestion browsing + admin dashboard (`/admin/*`, role-gated)
## Layers
### Presentation Layer (React SPA)
- Purpose: Render UI, capture input, drive read/mutate flows
- Location: `src/` (143 .ts/.tsx files at v1.0 ship)
- Contains: Route components (`src/routes/`), feature components (`src/components/{auth,admin,suggestions,layout,debug,ui}/`), hooks (`src/hooks/`), contexts (`src/contexts/`), utilities (`src/lib/`)
- Depends on: React 19, TanStack Router, shadcn/ui, Supabase client, Sentry, PostHog
- Used by: Browser/DOM (Netlify static hosting)
### Routing Layer (TanStack Router)
- Purpose: File-based route declaration + type-safe navigation
- Location: `src/routes/` + generated `src/routeTree.gen.ts`
- Contains: `__root.tsx` (app shell), `index.tsx` (home), `topics.tsx`, `archive.tsx`, `auth/` (callback + error), `admin/` (admin index + nested suggestion CRUD), `[__smoke].tsx` (debug-gated)
- Generation: `tsr generate` runs as part of `npm run build` (re-emits `routeTree.gen.ts` from filesystem layout)
### State / Data Layer
- Purpose: Auth state, consent state, server data caching
- Location: `src/contexts/` (AuthContext, ConsentContext), `src/hooks/use*.ts`
- Pattern: React Context for cross-cutting state (auth session, consent flags); custom hooks per domain operation (`useSuggestions`, `useVoteSubmit`, `useCreatePoll`, etc.) — each hook encapsulates a Supabase read or Edge Function POST
- Depends on: Supabase client (`src/lib/supabase.ts`), AuthContext
### Backend Layer (Supabase Edge Functions)
- Purpose: Server-side authorization, validation, rate limiting for all mutations; cron-style cleanup
- Location: `supabase/functions/` (16 functions at v1.0 ship)
- Functions: `submit-vote`, `create-poll`, `update-poll`, `delete-poll`, `close-poll`, `close-expired-polls` (cron), `pin-poll`, `set-resolution`, `create-category`, `rename-category`, `delete-category`, `promote-admin`, `demote-admin`, `search-admin-targets`, `get-upload-url`, plus `_shared/` helpers
- Deployment: `supabase functions deploy` — independent of the frontend Netlify deploy
- Used by: React client via `supabase.functions.invoke('<name>', { body })`
### Database Layer (Postgres + RLS)
- Purpose: Persistent storage with row-level security as the primary auth boundary for reads
- Location: `supabase/migrations/` (versioned schema), `supabase/seed.sql`
- Tables: suggestions/polls, vote responses, categories, admin role assignments, audit logs
- RLS: enforced at the Postgres level — public SELECTs gated by RLS policies; all writes go through Edge Functions (which use the service-role key server-side)
### Asset Layer
- Purpose: Static resources
- Location: `src/assets/`, `public/`
- Contains: SVG icons, favicons, image placeholders, web manifest
## Data Flow
### Public Read Flow (suggestion list, archive)
- Browser loads SPA shell from Netlify (cached static bundle)
- TanStack Router resolves the requested route (`/`, `/topics`, `/archive`, etc.)
- Route component invokes a `useSuggestions`-style hook
- Hook performs a Supabase SELECT against the `suggestions` table (or related views)
- Postgres RLS policy admits the read (anon read on active suggestions, etc.)
- Result is returned to the component and rendered
### Authenticated Mutation Flow (submit-vote, create-poll, etc.)
- User triggers an action (clicks "Share your opinion", saves an admin form)
- Component calls a mutation hook (e.g., `useVoteSubmit`, `useCreatePoll`)
- Hook reads the current Supabase session from AuthContext, then calls `supabase.functions.invoke('<fn>', { body })`
- Edge Function authenticates the JWT, applies authorization checks (role, ownership), validates the body, and (where applicable) consults Upstash Redis for rate-limiting
- On success, the function performs the mutation with the service-role client and returns the new state
- Hook surfaces success/error to the component; UI updates optimistically where appropriate
### Auth Flow (Discord OAuth)
- User clicks "Sign in with Discord" → `supabase.auth.signInWithOAuth({ provider: 'discord' })`
- Browser redirects through Discord → back to `/auth/callback`
- Callback route exchanges the code for a session, persists to local storage (handled by Supabase client)
- AuthContext picks up `onAuthStateChange` and propagates the session app-wide
- 2FA enforcement: failed sessions surface to `/auth/error` with actionable copy
### State Management
- React Context for global cross-cutting state (auth session, consent flags) — NOT Redux, NOT Zustand
- Per-feature custom hooks for server data (no React Query / SWR; hand-rolled `useState` + `useEffect` patterns inside each `use*` hook)
- Local component state via `useState` for form inputs and ephemeral UI state
## Key Abstractions
### TanStack Router Routes
- Purpose: Type-safe file-based routing with auto-generated route tree
- Examples: `src/routes/index.tsx`, `src/routes/admin/index.tsx`, `src/routes/auth/callback.tsx`
- Pattern: One `.tsx` per route; `tsr generate` produces `routeTree.gen.ts`
### Custom Data Hooks
- Purpose: Encapsulate one read or mutation per domain operation; isolate Supabase API surface from components
- Examples: `useSuggestions`, `useVoteSubmit`, `useCreatePoll`, `useCategories`, `useUploadImage`
- Pattern: hand-rolled `useState`/`useEffect` (no react-query); hooks own loading/error state; mutations return a callable + status
### Supabase Client Wrappers
- Purpose: Single source of truth for the Supabase client + auth/session helpers
- Examples: `src/lib/supabase.ts`, AuthContext / `useAuth`
- Pattern: Singleton client; helpers expose only the surface the app uses
### shadcn/ui Component Library
- Purpose: Accessible primitive UI components (Button, Card, Dialog, Sheet, Input, etc.)
- Location: `src/components/ui/` (component code is checked in, not imported from a package)
- Pattern: shadcn/ui new-york style, Neutral baseColor — see DESIGN-SYSTEM.md ADR-001
### ConsentContext (GDPR/EU compliance)
- Purpose: Gate analytics + replay on user opt-in (no implicit collection)
- Location: `src/contexts/ConsentContext.tsx`, `src/hooks/useConsent.ts`
- Pattern: Banner + persistent localStorage flag; PostHog and Sentry replay are conditionally initialized
## Entry Points
### HTML Entry
- Location: `index.html`
- Triggers: Browser page load (Netlify-served static asset)
- Responsibilities: Define DOM root, load favicons, bootstrap the SPA bundle
### JavaScript Entry
- Location: `src/main.tsx`
- Triggers: HTML script tag execution
- Responsibilities: Initialize Sentry, mount the TanStack Router provider, render `<RouterProvider>` into `#root`, wrap with `StrictMode`
### Backend Entry Points
- Location: `supabase/functions/<fn>/index.ts`
- Triggers: HTTPS POST from the React client via `supabase.functions.invoke(...)`
- Responsibilities: Per-function authn/authz, validation, rate-limiting, mutation, response
## Error Handling
### Patterns
- Sentry initialized in `src/main.tsx`; React error boundaries wrap key route trees
- StrictMode active in development for unsafe-lifecycle detection
- Edge Functions return `{ error: { code, message } }` JSON on failure (4xx/5xx); hooks surface user-actionable copy
- Auth-failure path: dedicated `/auth/error` route with explainer copy (e.g., 2FA required)
## Cross-Cutting Concerns
### Auth
- Supabase native Discord OAuth provider with mandatory 2FA
- Session managed by Supabase client; AuthContext exposes session + role to the app
### Rate Limiting
- Upstash Redis sliding-window 5 req/60s on `submit-vote` (validated through v1.0 ship)
### Observability
- Sentry for errors + session replay (opt-in via ConsentContext)
- PostHog for product analytics (opt-in)
- Bundle delta tracked per phase (see `.planning/closure/OBSV-02-bundle-delta.md`)
### Styling
- Tailwind CSS v4 (vite plugin)
- shadcn/ui (new-york, Neutral baseColor) — components vendored under `src/components/ui/`
- next-themes for light/dark mode
- No CSS-in-JS, no CSS modules
### Build
- TypeScript strict checks (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`)
- Build pipeline: `tsr generate && tsc -b && vite build`
- Vite handles bundling, code splitting, asset hashing
- Sentry vite plugin uploads source maps post-build
### Testing
- Vitest + Testing Library for unit/component tests (`src/__tests__/`)
- Playwright for E2E (`e2e/` — outside `src/`); fixtures under `e2e/fixtures/`, helpers under `e2e/helpers/`
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
