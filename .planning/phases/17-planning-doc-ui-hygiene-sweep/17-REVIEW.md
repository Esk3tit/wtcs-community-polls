---
status: clean
phase: 17
depth: deep
reviewed: 2026-05-30T00:00:00Z
critical_count: 0
warning_count: 0
info_count: 3
files_reviewed: 5
files_reviewed_list:
  - src/components/admin/AdminsList.tsx
  - src/components/admin/CategoriesList.tsx
  - src/components/admin/PromoteAdminDialog.tsx
  - src/__tests__/admin/admins-tab.test.tsx
  - src/__tests__/admin/categories-tab.test.tsx
---

# Phase 17: Code Review Report (iteration 2)

**Reviewed:** 2026-05-30
**Depth:** deep
**Files Reviewed:** 5
**Status:** clean (Info-only) — **loop has CONVERGED**

## Summary

Re-review of the five admin UI-hygiene files after iteration 1's fixes were
applied. All four iteration-1 fixes are correctly in place and introduced no
new defects:

1. **Categories heading regression test (resolves prior WR-01)** — Present at
   `categories-tab.test.tsx:103-110`. Uses
   `findByRole('heading', { level: 2, name: 'Categories' })`, mirroring
   `admins-tab.test.tsx:122-129`. `level: 2` matches `aria-level={2}` on the
   CardTitle (`CategoriesList.tsx:169`). Comment is WHY-only, no plan/phase ID.
   Asserts the correct thing. CORRECT — the test-coverage asymmetry that was the
   sole Warning in iteration 1 is now closed.
2. **Edit-row aria-labels** — `CategoriesList.tsx:273` `Save edit for ${cat.name}`
   and `:283` `Cancel edit for ${cat.name}`, correctly interpolated. CORRECT.
3. **Multi-line Card imports** — `AdminsList.tsx:5-11` and `CategoriesList.tsx:22-28`
   both wrap to multi-line braces; all five names present in both, no name dropped,
   every imported symbol used. CORRECT.
4. **WHY comments above `<Card className="py-0">`** — `AdminsList.tsx:88-89` and
   `CategoriesList.tsx:165-166`. WHY-only (padding override rationale), no
   phase/plan/round archaeology tags — compliant with the project's
   no-review-archaeology rule. CORRECT.

A fresh deep pass (cross-file: Card component contract in `card.tsx`,
test/component aria-level alignment, mock/query shape consistency, error-state
handling, request-sequencing race guards in `AdminsList` refetch, delete-count
guard logic in `CategoriesList`) found **no Critical and no Warning defects**.
Per the convergence rule, the loop has **CONVERGED**.

The three Info items below are the carried-over, acceptable-as-is items
explicitly flagged as non-blocking. They are re-noted for completeness only and
must NOT block convergence.

## Info

### IN-01: Empty-state icon margin mismatch between the two lists

**File:** `src/components/admin/AdminsList.tsx:116` vs `src/components/admin/CategoriesList.tsx:198`
**Issue:** The empty-state icon in `AdminsList` (`<Users className="h-10 w-10 text-muted-foreground" />`)
has no bottom margin, while `CategoriesList` adds `mb-3`
(`<Folder className="h-10 w-10 text-muted-foreground mb-3" />`). Both then add
`mt-4` on the following `<p>`, so AdminsList spaces the icon only via the
paragraph's top margin while CategoriesList stacks `mb-3` + `mt-4`. Purely
cosmetic; the two empty states live on different tabs and are never seen
side-by-side. Acceptable as-is.
**Fix:** For pixel-parity, drop `mb-3` from the Folder icon (the paragraph's
`mt-4` already provides spacing) OR add `mb-3` to the Users icon — pick one and
apply to both.

### IN-02: Duplicated CardTitle "heading" a11y incantation

**File:** `src/components/admin/AdminsList.tsx:92` and `src/components/admin/CategoriesList.tsx:169`
**Issue:** Both files repeat `<CardTitle role="heading" aria-level={2} className="text-base">`
to restore heading semantics that shadcn's `CardTitle` (a plain `<div>`, see
`card.tsx:31-39`) does not provide. The duplication is intentional and small, and
both call sites are correctly covered by the level-2 heading tests. Acceptable
as-is.
**Fix:** Optional — extract a tiny `SectionCardTitle` wrapper if a third admin
list ever appears. Not worth it for two call sites.

### IN-03: Avatar-fallback inconsistency between AdminsList and PromoteAdminDialog

**File:** `src/components/admin/AdminsList.tsx:141-145` vs `src/components/admin/PromoteAdminDialog.tsx:103-105`
**Issue:** When `avatar_url` is null, `AdminsList` renders an initial-letter
fallback (`{(a.discord_username ?? '?')[0]?.toUpperCase()}`), whereas
`PromoteAdminDialog` renders a blank grey circle
(`<div className="h-6 w-6 rounded-full bg-muted" />`) with no initial. Cosmetic
inconsistency only; both are accessible (the avatar is decorative, `alt=""`, and
the username is shown adjacent). Acceptable as-is.
**Fix:** Optional — give the Promote dialog the same initial-letter fallback as
AdminsList for visual consistency.

---

_Reviewed: 2026-05-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
