---
phase: 17-planning-doc-ui-hygiene-sweep
plan: "02"
subsystem: admin-ui
tags: [card-migration, uidn-04, uidn-05, a11y, shadcn]
requirements-completed: [UIDN-04, UIDN-05]

dependency_graph:
  requires: []
  provides:
    - AdminsList shadcn Card wrapper
    - CategoriesList shadcn Card wrapper
    - PromoteAdminDialog search-results Card wrapper
    - Dialog ARIA behavioral assertion (getByRole)
  affects:
    - src/components/admin/AdminsList.tsx
    - src/components/admin/CategoriesList.tsx
    - src/components/admin/PromoteAdminDialog.tsx
    - src/__tests__/admin/admins-tab.test.tsx

tech_stack:
  added: []
  patterns:
    - shadcn Card (Card, CardHeader, CardTitle, CardAction, CardContent) from @/components/ui/card
    - CardContent className="p-0" for full-bleed rows inside Card
    - Card className="py-0" to suppress native py-6 inset for flush row alignment

key_files:
  created: []
  modified:
    - src/components/admin/AdminsList.tsx
    - src/components/admin/CategoriesList.tsx
    - src/components/admin/PromoteAdminDialog.tsx
    - src/__tests__/admin/admins-tab.test.tsx

decisions:
  - "D-01: adopted native shadcn Card styling (rounded-xl shadow-sm) — no pixel-parity overrides for old border rounded-md"
  - "D-02: section heading + action Button moved into CardHeader/CardTitle/CardAction in all three components"
  - "D-03: rows full-bleed via CardContent className=p-0; divide-y reaches card border"
  - "D-04: one Card per section, never per row"
  - "D-05: PromoteAdminDialog audit-gated; Card migration confirmed; DialogContent/DialogTitle wrappers intact; ARIA survival proven behaviorally"
  - "Card vertical-inset: py-0 applied to all three Card wrappers for flush alignment (not native py-6)"
  - "Heading semantics: h2 landmark dropped for CardTitle (div) — accepted as app-wide shadcn convention per existing LandingPage/AuthErrorPage consumers"
  - "D-10: WHY-only comments in src/; no UIDN/phase archaeology tags added"
  - "D-11 re-scoped: no .snap files exist; success = behavioral tests green in same commit"

metrics:
  duration: "~4 minutes"
  completed: "2026-05-30T22:45:45Z"
  tasks_completed: 3
  files_modified: 4
---

# Phase 17 Plan 02: UIDN-04/05 Admin UI Card Migration Summary

**One-liner:** Three admin components migrated from hand-rolled `border rounded-md` containers to shadcn Card with CardHeader/CardTitle/CardAction/CardContent; dialog ARIA survival proven by newly-added `findByRole('dialog')` assertion.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | UIDN-04 — Migrate AdminsList.tsx to shadcn Card | edd0a9c | src/components/admin/AdminsList.tsx |
| 2 | UIDN-04 — Migrate CategoriesList.tsx to shadcn Card | a2ccd8f | src/components/admin/CategoriesList.tsx |
| 3 | UIDN-05 — Migrate PromoteAdminDialog + add ARIA test | 9c28750 | src/components/admin/PromoteAdminDialog.tsx, src/__tests__/admin/admins-tab.test.tsx |

## UIDN-05 Audit Confirmation

The UIDN-05 audit flag **still applied** — the `<div className="mt-2 border rounded-md divide-y max-h-64 overflow-auto">` search-results container inside PromoteAdminDialog was a hand-rolled bordered container not using the Card primitive. This was confirmed by reading the source and applying the locked disposition (D-05: migrate it). The container has been replaced with `<Card className="mt-2 max-h-64 overflow-auto py-0"><CardContent className="p-0"><div className="divide-y">`.

## ARIA Survival Verification (D-05)

**Source-level:** The `<DialogContent` and `<DialogTitle` JSX wrappers survive in PromoteAdminDialog.tsx (source grep confirms both at lines 66 and 68 post-migration). No `role=` attribute was hand-added to the Card or CardContent — they are generic `data-slot` divs. Radix applies `role="dialog"` + `aria-labelledby` at runtime from the DialogContent/DialogTitle wrappers.

**Behavioral (ADDED — did not exist before this plan):** The "opens promote dialog" test in `src/__tests__/admin/admins-tab.test.tsx` now asserts:
```ts
expect(await screen.findByRole('dialog', { name: /promote admin/i })).toBeInTheDocument()
```
This proves the Radix-applied `role="dialog"` and accessible name (from `<DialogTitle>Promote admin</DialogTitle>` via `aria-labelledby`) survive the Card migration. The prior test only asserted `getAllByText(/promote admin/i)` count — it did NOT assert runtime dialog ARIA. This plan ADDED the assertion; the prior suite did not assert runtime dialog ARIA.

## Card Vertical-Inset Decision

**Decision applied: `py-0` on all three `<Card>` wrappers.**

Rationale: `Card`'s default `py-6` (24px top/bottom) would inset the first and last rows away from the card border, inconsistent with the old hand-rolled flush containers. `py-0` was added to all three Card wrappers for visual parity. This is an explicit decision, not executor discretion. `CardHeader` retains its own `px-6` padding, so the title row is unaffected.

- AdminsList: `<Card className="py-0">`
- CategoriesList: `<Card className="py-0">`
- PromoteAdminDialog search-results: `<Card className="mt-2 max-h-64 overflow-auto py-0">`

## Heading-Semantics Accepted Tradeoff

`CardTitle` renders a `<div>` (card.tsx line 31), so replacing `<h2 className="text-base font-semibold">` with `<CardTitle>` drops the `<h2>` section heading landmark in AdminsList and CategoriesList. This is intentional and accepted per the app-wide shadcn convention — every other Card consumer (LandingPage, AuthErrorPage) uses CardTitle without an explicit heading. The admin lists are within an already-labeled admin route, so the lost landmark is not a navigation regression in practice. `className="text-base"` was added to CardTitle to preserve the text-base font size from the prior `h2 className="text-base font-semibold"`.

## Test and Build Outcomes

- `npx tsc -b`: exit 0 (all three tasks)
- `npm run lint`: exit 0 (all three tasks)
- `npm run test` (full suite): 43 test files, 401 tests — all passed
- `admins-tab.test.tsx`: 6/6 tests pass (including newly-added `findByRole('dialog')`)
- `categories-tab.test.tsx`: 6/6 tests pass
- `find src -name '*.snap'`: empty — no snapshot files exist or were created (D-11 re-scope honored)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three components render live data from their existing hooks; no placeholder/empty stubs introduced.

## Threat Flags

None — structural-only Card wrapper swap; no new network endpoints, auth paths, or schema changes.

## Self-Check

Files exist:
- [x] src/components/admin/AdminsList.tsx — FOUND
- [x] src/components/admin/CategoriesList.tsx — FOUND
- [x] src/components/admin/PromoteAdminDialog.tsx — FOUND
- [x] src/__tests__/admin/admins-tab.test.tsx — FOUND

Commits exist:
- [x] edd0a9c — Task 1 AdminsList
- [x] a2ccd8f — Task 2 CategoriesList
- [x] 9c28750 — Task 3 PromoteAdminDialog + ARIA test

## Self-Check: PASSED
