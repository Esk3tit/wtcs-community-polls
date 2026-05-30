---
status: issues_found
phase: 17
depth: standard
reviewed: 2026-05-30T23:06:50Z
critical_count: 0
warning_count: 1
info_count: 3
---

# Phase 17 Code Review — Plan B UI Card Migration

**Reviewed:** 2026-05-30T23:06:50Z
**Depth:** standard
**Files reviewed:** 4
**Status:** issues_found

## Summary

Plan B was a structural-only migration replacing hand-rolled
`<div className="... border rounded-md">` list containers with the vendored
shadcn `Card` primitive across three admin components, plus one test update.

I diffed `edd0a9c~1..9c28750` (the three migration commits + the test update)
and traced behavior end-to-end. **No props, event handlers, refs, state, copy,
or hooks were dropped or altered** — the migration is faithful on the behavioral
axis. All `Card`/`CardHeader`/`CardTitle`/`CardAction`/`CardContent` usage is
correct, and the `py-0` overrides correctly cancel Card's default `py-6`. The
test change (`getAllByText` length assertion → `findByRole('dialog', { name:
/promote admin/i })`) is a genuine strengthening, not a weakening.

The one real defect is an **accessibility regression**: two semantic `<h2>`
section headings were converted into non-heading `<div>`s (`CardTitle`). The
components mount via `AdminTabs` under `src/routes/admin/index.tsx`, whose only
heading is `<h1>Admin</h1>` (verified `src/routes/admin/index.tsx:13`). These
two `<h2>`s were the page's only second-level headings, so the document outline
collapses to `h1` only. This is an unintended behavior change for a migration
scoped as "no accessibility change."

## Warnings

### WR-01: `<h2>` section headings demoted to non-semantic `<div>` (accessibility regression)

**Files:**
- `src/components/admin/AdminsList.tsx:84`
- `src/components/admin/CategoriesList.tsx:161`

**Issue:**
The pre-migration markup used real heading elements (see diff):

```tsx
<h2 className="text-base font-semibold">Admins</h2>
<h2 className="text-base font-semibold">Categories</h2>
```

The migration replaced these with shadcn `CardTitle`:

```tsx
<CardTitle className="text-base">Admins</CardTitle>
<CardTitle className="text-base">Categories</CardTitle>
```

`CardTitle` (verified `src/components/ui/card.tsx:31-39`) renders a plain
`<div data-slot="card-title">` with **no `role="heading"` and no `aria-level`** —
it only applies `leading-none font-semibold` styling.

These components mount in tab panels under `src/routes/admin/index.tsx`
(`AdminTabs` → `CategoriesList` / `AdminsList`). The page's sole heading is
`<h1>Admin</h1>` (`src/routes/admin/index.tsx:13`); the migrated `<h2>`s were
the only second-level headings beneath it. After the migration the outline
collapses from `h1 → h2 (Categories) / h2 (Admins)` to just `h1`. Screen-reader
users lose heading-based navigation to the "Admins" and "Categories" sections,
and the visual section titles are no longer exposed as headings in the
accessibility tree. Accessibility semantics are behavior, so this contradicts
the phase's "no behavior change" intent.

The new dialog-ARIA test (`admins-tab.test.tsx:119`) guards the *Dialog* title
role but not the *section* heading role, so this regression is untested.

**Fix:**
Keep the `CardTitle` for Card layout but restore the heading role and level.
`CardTitle` spreads `...props` onto its `<div>`, so ARIA attributes pass through:

```tsx
<CardTitle role="heading" aria-level={2} className="text-base">
  Admins
</CardTitle>
```

Apply the identical change to `CategoriesList.tsx:161` (Categories). Add a
regression test, e.g.
`expect(screen.getByRole('heading', { name: 'Admins' })).toBeInTheDocument()`,
mirroring the existing pattern in `suggestion-form.test.tsx:98`.

## Info

### IN-01: Row `rounded-md` dropped from promote search results (minor visual delta)

**File:** `src/components/admin/PromoteAdminDialog.tsx:95`

**Issue:** Pre-migration each result row carried
`hover:bg-accent rounded-md`; the migrated row is `hover:bg-accent` (no
`rounded-md`). With `divide-y` rows inside a rounded `Card`, square-cornered
hover backgrounds are the conventional shadcn look, so this is almost certainly
intentional. Flagged only because it is a style delta in a migration billed as
structure-only.

**Fix:** No code change required if intentional; otherwise re-add `rounded-md`.
Note the deliberate visual change in the phase summary either way.

### IN-02: `(D-05)` plan-ID tag in test comment violates no-archaeology rule

**File:** `src/__tests__/admin/admins-tab.test.tsx:118-119`

**Issue:** The new test comment reads
`// ... — verify this survives the Card migration (D-05).` CLAUDE.md (and user
memory `feedback_no_review_archaeology_in_source`) forbid review-round/plan/
phase-ID archaeology in source comments; tests live under `src/`. The WHY of the
comment is fine — only the `(D-05)` tag is the violation.

**Fix:** Drop the `(D-05)` reference:
`// Radix DialogContent applies role="dialog" + aria-labelledby from the DialogTitle wrapper — verify the Card migration preserves it.`

### IN-03: Card import on a single long line vs. neighboring multi-line style

**Files:**
- `src/components/admin/AdminsList.tsx:5`
- `src/components/admin/CategoriesList.tsx:22`

**Issue:** The new Card import is one long line
(`import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'`),
while the adjacent `Dialog` import in `CategoriesList.tsx:13-20` uses multi-line
braces. Purely cosmetic; uses the correct `@/` alias and the right import group.

**Fix:** Optional — wrap to multi-line braces to match the neighboring block.

---

## Convention adherence (CLAUDE.md)

- `@/` path alias: used for all new imports. PASS
- One named export per file: unchanged (`AdminsList`, `CategoriesList`,
  `PromoteAdminDialog`). PASS
- shadcn new-york `Card` from `src/components/ui/`: correct source. PASS
- `py-0` / `p-0` overrides correct; `CardAction` correctly placed for the header
  grid layout (`has-data-[slot=card-action]:grid-cols-[1fr_auto]`). PASS
- WHY-only comments / no review-round-phase archaeology in `src/`: one violation
  — see IN-02 (`(D-05)` tag in test).

## No issues found in

- Behavioral correctness: all handlers, refs, state, and hook wiring preserved
  across all three components (verified against `edd0a9c~1` diff).
- Empty-state branch in `AdminsList`: the simplified conditional
  (`admins.length === 0`) now frames the empty state inside `CardContent`,
  matching `CategoriesList`; behavior unchanged.
- Security: no new injection/XSS surface; `img` tags retain `alt=""`, snowflake
  validation (`/^\d{17,19}$/`) untouched in `PromoteAdminDialog`.
- Test update (`admins-tab.test.tsx`): strengthened from a text-count assertion
  to a `role="dialog"` accessible-name assertion. Net improvement.
