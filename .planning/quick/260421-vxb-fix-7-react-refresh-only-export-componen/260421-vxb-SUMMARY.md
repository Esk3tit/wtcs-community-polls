---
quick_id: 260421-vxb
description: Fix 7 react-refresh/only-export-components lint errors blocking Phase 5 CI
status: complete
completed: 2026-04-22
files_modified: 5
---

# Quick Task 260421-vxb: Fix 7 react-refresh Lint Errors

## Result

**Lint passes cleanly.** `npm run lint` exits 0 with zero errors and zero warnings. All 356 unit tests still pass. Phase 5 PR #4's CI lint step will now go green.

## What was done

Applied a two-pronged fix targeting the two distinct failure modes:

### 1. `eslint.config.js` — `allowExportNames` override (3 of 7 errors)

Added a `rules` block to the flat-config entry (after `reactRefresh.configs.vite`) that overrides `react-refresh/only-export-components` with `allowExportNames: ['buttonVariants', 'badgeVariants', 'useTheme']`. This fixes:

- `src/components/ui/badge.tsx:48` — `badgeVariants` (shadcn/ui `cva()` pattern)
- `src/components/ui/button.tsx:64` — `buttonVariants` (shadcn/ui `cva()` pattern)
- `src/components/theme-provider.tsx:75` — `useTheme` (context hook alongside `ThemeProvider`)

Whitelisting by name keeps the rule at `error` severity for genuinely HMR-breaking exports while permitting these framework-canonical named exports. Zero source changes to the shadcn vendor files (preserves upgrade path).

### 2. File-level `/* eslint-disable */` on 4 route files (4 of 7 errors)

Added `/* eslint-disable react-refresh/only-export-components */` as the first line of:

- `src/routes/__root.tsx`
- `src/routes/auth/callback.tsx`
- `src/routes/auth/error.tsx`
- `src/routes/index.tsx`

**This matches the existing project convention** — `src/routes/topics.tsx`, `src/routes/archive.tsx`, `src/routes/admin/index.tsx`, `src/routes/admin/suggestions/$id.edit.tsx`, `src/routes/admin/suggestions/new.tsx`, and `src/contexts/AuthContext.tsx` already use the same file-level disable. The 4 failing routes simply weren't given the same treatment.

## Why not `allowExportNames: ['Route']` or `extraHOCs`?

Both were investigated and ruled out:

- **`allowExportNames: ['Route']`** — whitelists the name but does NOT solve the actual failure mode for route files. The rule flags when an internal (non-exported) route component coexists with non-component exports (like `export const Route = createFileRoute(...)`), regardless of whether `Route` is whitelisted. Verified empirically: after adding `Route` to the list, the 4 route errors still reported (line/column unchanged).
- **`extraHOCs: ['createFileRoute', 'createRootRoute']`** — would technically suppress the warnings, but [TanStack Router docs explicitly caution against it](https://tanstack.com/router/latest/docs/framework/react/api/router/createFileRouteFunction): it masks HMR breakage when route options include non-component props (`validateSearch`, `loader`, `beforeLoad`). This project uses `validateSearch` in `auth/error.tsx`, so the caution applies.
- **`allowConstantExport: true`** — only covers primitives (string/number/boolean/templateLiteral); `cva()` results and `Route` objects are not primitives, so this option doesn't apply.

## Research references

- [shadcn-ui/ui discussion #5933 — react-refresh warning](https://github.com/shadcn-ui/ui/discussions/5933)
- [shadcn-ui/ui issue #7736 — components exporting constants](https://github.com/shadcn-ui/ui/issues/7736)
- [shadcn-ui/ui issue #1534 — export pattern warning](https://github.com/shadcn-ui/ui/issues/1534)
- [TanStack Router createFileRoute docs — ESLint workaround](https://tanstack.com/router/latest/docs/framework/react/api/router/createFileRouteFunction)
- [ArnaudBarre/eslint-plugin-react-refresh — option docs](https://github.com/ArnaudBarre/eslint-plugin-react-refresh)

## Files modified

| File | Change | Lines |
|------|--------|-------|
| `eslint.config.js` | +`rules` block with `allowExportNames` | +15 |
| `src/routes/__root.tsx` | +file-level eslint-disable | +1 |
| `src/routes/auth/callback.tsx` | +file-level eslint-disable | +1 |
| `src/routes/auth/error.tsx` | +file-level eslint-disable | +1 |
| `src/routes/index.tsx` | +file-level eslint-disable | +1 |

Total: 5 files, 19 lines added, 0 removed.

## Verification

- `npm run lint` → exits 0 (zero errors, zero warnings)
- `npm run test` → 356/356 tests pass across 35 files
- `git diff --stat` → matches the plan's "Out of scope" promise (config + 4 route comments only, no refactors, no src/components/ui/* changes)

## Next step

Commit and push to the Phase 5 PR branch. CI lint step should go green on the next push, unblocking PR #4.
