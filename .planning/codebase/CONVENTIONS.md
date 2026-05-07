# Coding Conventions

**Analysis Date:** 2026-05-04 (refreshed post v1.0 ship; supersedes 2026-04-06 Vite-scaffold snapshot)

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

---

*Convention analysis: 2026-05-04 (post v1.0 ship rewrite — replaces 2026-04-06 Vite-scaffold snapshot)*
