---
quick_id: 260421-vxb
description: Fix 7 react-refresh/only-export-components lint errors blocking Phase 5 CI
created: 2026-04-22
mode: quick
---

# Quick Task 260421-vxb: Fix 7 react-refresh Lint Errors

## Context

Phase 5's new CI workflow (`.github/workflows/ci.yml`, shipped in plan 05-06) enforces `npm run lint` on every PR. PR #4 is failing because 7 pre-existing `react-refresh/only-export-components` errors were never addressed — Plan 05-01 deferred them as out-of-scope for dependency pinning (`.planning/phases/05-launch-hardening/deferred-items.md`).

All 7 errors are legitimate non-component named exports from framework-canonical patterns:

| File | Line | Export | Framework pattern |
|------|------|--------|-------------------|
| `src/components/theme-provider.tsx` | 75 | `useTheme` hook | React context helper alongside provider |
| `src/components/ui/badge.tsx` | 48 | `badgeVariants` | shadcn/ui `cva()` variant export |
| `src/components/ui/button.tsx` | 64 | `buttonVariants` | shadcn/ui `cva()` variant export |
| `src/routes/__root.tsx` | 12 | (component `RootLayout`) | `export const Route = createRootRoute({ component: ... })` |
| `src/routes/auth/callback.tsx` | 10 | (component) | `export const Route = createFileRoute(...)({ component: ... })` |
| `src/routes/auth/error.tsx` | 16 | (component) | `export const Route = createFileRoute(...)({ component: ... })` |
| `src/routes/index.tsx` | 10 | (component) | `export const Route = createFileRoute(...)({ component: ... })` |

## Research

Verified via web research:

1. **shadcn/ui** ([discussion #5933](https://github.com/shadcn-ui/ui/discussions/5933), [issue #7736](https://github.com/shadcn-ui/ui/issues/7736), [issue #1534](https://github.com/shadcn-ui/ui/issues/1534)): `buttonVariants` / `badgeVariants` constant-exports alongside the component are the documented shadcn pattern. Community consensus: either split files OR disable/whitelist the rule. shadcn's generated code does not split.
2. **TanStack Router** ([createFileRoute docs](https://tanstack.com/router/latest/docs/framework/react/api/router/createFileRouteFunction)): `Route` export is required. `extraHOCs: ['createRootRouteWithContext']` is possible BUT explicitly cautioned against — it masks HMR breakage when route options include non-component props.
3. **eslint-plugin-react-refresh** ([ArnaudBarre/eslint-plugin-react-refresh](https://github.com/ArnaudBarre/eslint-plugin-react-refresh)):
   - `allowConstantExport: true` only covers primitives (string/number/boolean/templateLiteral) — **does NOT help** because `cva()` results and `Route` objects are not primitives.
   - `allowExportNames: [...]` accepts an explicit whitelist of export names. This is the correct fit: targeted, opt-in, no blanket rule disable, no HMR-breakage masking.

## Plan

### Task 1: Add `allowExportNames` override to `eslint.config.js`

**File:** `eslint.config.js`

**Action:** After the `reactRefresh.configs.vite` extension in the flat-config entry, add a `rules` block that overrides `react-refresh/only-export-components` with `allowExportNames` listing the 4 legitimate non-component export names: `Route`, `buttonVariants`, `badgeVariants`, `useTheme`.

**Rationale:**
- Keeps the rule at `error` severity for genuine HMR-breaking exports.
- Whitelists only the 4 names we've confirmed are framework-canonical patterns — not a blanket suppression.
- No inline `// eslint-disable` comments needed (keeps source files clean).
- No file splits (avoids 7+ file churn + import updates).

**Verify:** `npm run lint` exits 0 (zero errors, zero warnings).

**Done when:**
- `eslint.config.js` contains `allowExportNames: ['Route', 'buttonVariants', 'badgeVariants', 'useTheme']`
- `npm run lint` exits 0
- `git diff` shows only `eslint.config.js` modified

## Must-haves

- `npm run lint` exits 0 on the phase-05 branch
- No source files modified — config change only
- The ESLint rule remains `error` severity (not downgraded to `warn`, not removed)
- Whitelist is minimal (4 names, no wildcards)

## Out of scope

- Refactoring shadcn/ui components to split variants into separate files
- Refactoring route files to separate Route const from component
- Broader ESLint config cleanup
- Fixing the `.husky/pre-commit` executable-bit warning (cosmetic, separate issue)
