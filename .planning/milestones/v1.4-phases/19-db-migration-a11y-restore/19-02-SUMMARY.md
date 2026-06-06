---
phase: 19-db-migration-a11y-restore
plan: "02"
subsystem: ui-components
tags: [a11y, shadcn, card, heading, semantic-html, aria]
dependency_graph:
  requires: []
  provides: [UIDN-06]
  affects: [src/components/ui/card.tsx, src/components/admin/AdminsList.tsx, src/components/admin/CategoriesList.tsx]
tech_stack:
  added: []
  patterns: [asChild-polymorphism-via-Slot.Root, same-as-button.tsx-badge.tsx]
key_files:
  created: []
  modified:
    - src/components/ui/card.tsx
    - src/components/admin/AdminsList.tsx
    - src/components/admin/CategoriesList.tsx
    - src/__tests__/admin/admins-tab.test.tsx
    - src/__tests__/admin/categories-tab.test.tsx
decisions:
  - "D-06: CardTitle polymorphism via Radix Slot.Root asChild — same pattern as button.tsx and badge.tsx; ARIA role/aria-level workarounds removed"
  - "D-07: Accessibility verified by getByRole('heading', { level: 2 }) in both unit tests — pass because element is a real <h2>, not ARIA-overridden div"
metrics:
  duration: "~7 minutes"
  completed: "2026-06-02T16:02:10Z"
  tasks_completed: 2
  files_modified: 5
requirements_completed: [UIDN-06]
---

# Phase 19 Plan 02: A11y Heading Restore Summary

**One-liner:** Restored semantic `<h2>` headings in `AdminsList` and `CategoriesList` via `CardTitle asChild` + `Slot.Root` polymorphism, removing ARIA workarounds from both call sites.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add asChild to CardTitle primitive in card.tsx | 653f0f8 | src/components/ui/card.tsx |
| 2 | Update call sites in AdminsList and CategoriesList; update test comments | 84aabda | AdminsList.tsx, CategoriesList.tsx, admins-tab.test.tsx, categories-tab.test.tsx |

## What Was Built

### Task 1: CardTitle polymorphism (card.tsx)
- Added `import { Slot } from "radix-ui"` (same pattern as button.tsx and badge.tsx)
- Extended `CardTitle` function signature: `React.ComponentProps<"div"> & { asChild?: boolean }`
- Added `const Comp = asChild ? Slot.Root : "div"` inside function body
- Changed JSX return from hardcoded `<div` to `<Comp`
- Default behavior (no `asChild`) unchanged — still renders a `<div>`

### Task 2: Call-site updates
- `AdminsList.tsx`: replaced `<CardTitle role="heading" aria-level={2} className="text-base">Admins</CardTitle>` with `<CardTitle asChild className="text-base"><h2>Admins</h2></CardTitle>`
- `CategoriesList.tsx`: same transformation with "Categories"
- Both test files: updated stale ARIA workaround comment to "CardTitle asChild renders a native `<h2>` — no ARIA override needed."

## Verification

- `npm run test` — 403/403 tests pass (43 test files)
- `npx tsc -b --noEmit` — no TypeScript errors
- `getByRole('heading', { level: 2, name: 'Admins' })` passes (real `<h2>`, not ARIA div)
- `getByRole('heading', { level: 2, name: 'Categories' })` passes (real `<h2>`, not ARIA div)
- `grep "Slot.Root" src/components/ui/card.tsx` — 1 match
- `grep 'role="heading"' src/components/admin/AdminsList.tsx` — 0 matches
- `grep 'role="heading"' src/components/admin/CategoriesList.tsx` — 0 matches
- Visual rendering: `<h2 data-slot="card-title" class="leading-none font-semibold text-base">` — identical class composition

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] src/components/ui/card.tsx exists and contains `Slot.Root` and `asChild`
- [x] src/components/admin/AdminsList.tsx contains `<CardTitle asChild`, no `role="heading"`
- [x] src/components/admin/CategoriesList.tsx contains `<CardTitle asChild`, no `role="heading"`
- [x] Commit 653f0f8 exists (Task 1)
- [x] Commit 84aabda exists (Task 2)
- [x] 403/403 tests green
- [x] 0 TypeScript errors
