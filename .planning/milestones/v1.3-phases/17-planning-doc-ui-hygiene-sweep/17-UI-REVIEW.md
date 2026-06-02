---
phase: 17
plan: "02"
scope: UIDN-04 / UIDN-05 admin Card migration only
status: complete
audited: 2026-05-30
auditor: gsd-ui-auditor
---

# Phase 17 — UI Review

**Audited:** 2026-05-30
**Baseline:** 17-UI-SPEC.md (approved design contract)
**Screenshots:** Not captured — no dev server detected on ports 3000 or 5173. Code-only audit.
**Scope:** Plan B (17-02) only — three admin components migrated from hand-rolled `border rounded-md` containers to shadcn Card. Plan A (17-01) is doc-hygiene only, excluded.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All spec-contracted strings match exactly; no generic labels |
| 2. Visuals | 4/4 | Card structure, hierarchy, and anti-pattern guard all correct |
| 3. Color | 4/4 | No hardcoded values; accent used only on spec-declared element |
| 4. Typography | 3/4 | CategoriesList missing heading-landmark regression test (AdminsList has it) |
| 5. Spacing | 4/4 | Spec-prescribed spacing values used throughout; arbitrary values are documented exceptions |
| 6. Experience Design | 4/4 | All states covered; WR-01 accessibility regression found and fixed with behavioral test |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **CategoriesList missing heading regression test** — Screen-reader users depending on heading navigation to the Categories section have no automated safety net. The WR-01 fix added `role="heading" aria-level={2}` to CategoriesList.tsx:161 and AdminsList.tsx:84, but only `src/__tests__/admin/admins-tab.test.tsx` has a corresponding `getByRole('heading', { level: 2, name: 'Admins' })` assertion. `src/__tests__/admin/categories-tab.test.tsx` has no equivalent test for the Categories heading. If a future refactor drops the ARIA attributes from CategoriesList's CardTitle, no test will catch it. Add: `expect(await screen.findByRole('heading', { level: 2, name: 'Categories' })).toBeInTheDocument()` to categories-tab.test.tsx. — WARNING

2. **Edit-row Save/Cancel aria-labels lack action context** — The new-row buttons use descriptive labels (`aria-label="Save new category"`, `aria-label="Cancel new category"`). The edit-row buttons use `aria-label={\`Save ${cat.name}\`}` and `aria-label={\`Cancel ${cat.name}\`}` (CategoriesList.tsx:265, 275). These omit the verb-action context: "Save Foo" does not communicate that the user is saving an edit to the category named Foo, while "Save new category" is unambiguous. The spec Accessibility Contract lists the preserved labels but does not enumerate the edit-row labels; the edit-row labels are a pre-migration inheritance that remains sub-optimal. Recommended fix: `aria-label={\`Save edit for ${cat.name}\`}` and `aria-label={\`Cancel edit for ${cat.name}\`}`. — WARNING (minor UX quality gap, not a regression)

3. **IN-02 (plan-ID archaeology in test comment) is confirmed fixed** — `src/__tests__/admin/admins-tab.test.tsx` no longer contains the `(D-05)` tag in any comment (grep returns empty). This was raised as a WARNING in 17-REVIEW.md and is resolved. No action needed.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

All contracted copy strings verified against 17-UI-SPEC.md Copywriting Contract section.

**AdminsList.tsx** — full pass:
- Section title: "Admins" — line 85. PASS
- Primary CTA: "Promote admin" — line 90. PASS
- Empty state heading: "No admins yet." — line 110. PASS
- Empty state body: "Promote one to get started." — line 113. PASS
- Error heading: "Couldn't load admins" — line 70. PASS
- Error body: "Please try again." — line 72. PASS
- Error retry CTA: "Retry" — line 74. PASS
- Demote button: "Demote" — line 159. PASS
- Self-identifier: "You" — line 149. PASS

**CategoriesList.tsx** — full pass:
- Section title: "Categories" — line 162. PASS
- Primary CTA: "New category" — line 172. PASS
- Empty state heading: "No categories yet." — line 193. PASS (approximate line)
- Empty state body: "Create one to organize suggestions." — line 195. PASS
- Empty state CTA: "New category" — line 199. PASS
- Error heading: "Couldn't load categories" — line 58. PASS
- Input placeholder: "New category name" — line 214. PASS
- Delete dialog title: "Delete category?" — line 325. PASS
- Delete copy (0 affected): "No suggestions use this category. This cannot be undone." — line 329. PASS
- Delete copy (N affected): `${N} suggestion${s} will become uncategorized...` — line 331. PASS
- Delete copy (count error): "Suggestions linked to this category will become uncategorized. This cannot be undone." — line 328. PASS
- Delete confirm CTA: "Delete" — line 339. PASS
- Delete cancel: "Cancel" — line 336. PASS

**PromoteAdminDialog.tsx** — full pass:
- Dialog title: "Promote admin" — line 68. PASS
- Dialog description: "Search for an existing member or paste a Discord ID to pre-authorize." — line 70. PASS
- Search label: "Search by Discord username" — line 76. PASS
- Search placeholder: "Start typing a username..." — line 84. PASS
- No matches: "No matches. Paste a Discord ID instead." — line 129. PASS
- Discord ID label: "Or paste a Discord ID" — line 136. PASS
- Discord ID placeholder: "e.g. 267747104607305738" — line 141. PASS
- Snowflake hint: "Discord IDs are 17-19 digit numbers" — line 146. PASS (renders on invalid input — spec says conditional on `showSnowflakeHint`, confirmed correct)
- Pre-auth helper: "The user becomes admin on their next sign-in." — line 151. PASS
- Search result CTA: "Promote" — line 119. PASS
- Pre-auth CTA: "Pre-authorize" — line 158. PASS

No generic labels ("Submit", "OK", "Click Here") found. No placeholder copy. Full contract compliance.

---

### Pillar 2: Visuals (4/4)

**Card structure contract (UIDN-04):**
- AdminsList: `<Card className="py-0">` → `<CardHeader>` → `<CardTitle role="heading" aria-level={2} className="text-base">Admins</CardTitle>` → `<CardAction><Button>` → `<CardContent className="p-0">`. Matches spec structure exactly.
- CategoriesList: Identical pattern with "Categories" heading and "New category" action. Matches spec.

**Card structure contract (UIDN-05):**
- PromoteAdminDialog: `<Card className="mt-2 max-h-64 overflow-auto py-0"><CardContent className="p-0"><div className="divide-y">`. Matches spec target structure exactly (PromoteAdminDialog.tsx:89-91).

**Anti-pattern guard (D-04):** No individual row is wrapped in its own `<Card>`. One Card per section in all three components. PASS

**Visual hierarchy:** CardHeader provides consistent title-plus-action layout via the `has-data-[slot=card-action]:grid-cols-[1fr_auto]` grid. CardTitle at `text-base font-semibold` (via CardTitle primitive's `font-semibold` + className `text-base`) provides clear section identity. Row content at `text-sm font-medium` (primary) and `text-xs text-muted-foreground` (secondary) creates legible hierarchy. PASS

**Icon-only buttons:** All six icon-only buttons in CategoriesList.tsx carry descriptive `aria-label` attributes (verified above). No unlabeled icon buttons found. PASS

**Visual delta (intentional):** `rounded-xl` + `shadow-sm` replaces `rounded-md` (no shadow). This upgrade aligns with LandingPage and AuthErrorPage Card usage — consistent with design system conventions per D-01. PASS

**IN-01 (row rounded-md removal):** PromoteAdminDialog result rows dropped `rounded-md` from `hover:bg-accent rounded-md`. Per 17-REVIEW.md this is intentional (square-cornered hover inside a rounded Card is the shadcn convention). The spec explicitly notes this as a documented visual delta. PASS

---

### Pillar 3: Color (3/4 originally — upgraded to 4/4)

**Hardcoded values:** None found across all three components. All color references use Tailwind design tokens (`text-muted-foreground`, `bg-muted`, `bg-muted/30`, `bg-accent`, `text-destructive`, `bg-card` via Card primitive, `text-card-foreground` via Card primitive). PASS

**Accent usage:** `hover:bg-accent` appears exactly once — PromoteAdminDialog.tsx:95 on search result rows. This is the only spec-declared accent usage. PASS

**Destructive color:** `text-destructive hover:text-destructive` on delete icon button (CategoriesList.tsx:300-301) and `variant="destructive"` on Delete confirm button (CategoriesList.tsx:339). Both are spec-declared destructive surface usages. PASS

**60/30/10 distribution:** The Card `bg-card` token provides the 30% secondary surface against `--background` (60%). `--accent` is constrained to a single hover interaction. Token discipline is maintained throughout the migration. PASS

**Score note:** Scoring 4/4. No violations found.

---

### Pillar 4: Typography (3/4)

**Font sizes in use:** `text-xs`, `text-sm`, `text-base`, `text-lg` — four distinct sizes across the three components. The spec declares this is acceptable (the scale maps to body/subtext roles). `text-base` appears only on CardTitle headings; `text-lg` appears only on empty-state headings. PASS on size count.

**Font weights in component code:** `font-medium` only — exactly one weight in the component code layer. The CardTitle primitive adds `font-semibold` (weight 600) via `src/components/ui/card.tsx:35`. The spec documents this as "primitive-inherited weight (outside the design palette)" and notes the pre-migration `<h2 className="text-base font-semibold">` already rendered at 600. Net weight count stays at 2 (400 + 500 in component code; 600 inherited from primitive). PASS on weight discipline.

**WR-01 fix — heading semantics restored:**
- AdminsList.tsx:84: `<CardTitle role="heading" aria-level={2} className="text-base">Admins</CardTitle>` — ARIA heading role restored.
- CategoriesList.tsx:161: `<CardTitle role="heading" aria-level={2} className="text-base">Categories</CardTitle>` — ARIA heading role restored.
- The heading hierarchy `h1 (Admin) → h2 (Admins) / h2 (Categories)` is reconstructed without a literal `<h2>` element, using ARIA passthrough via `...props` spread on the `<div>` CardTitle. This is correct and verified.

**Regression test gap (FINDING — WARNING):**
- `src/__tests__/admin/admins-tab.test.tsx:122-129` contains `expect(await screen.findByRole('heading', { level: 2, name: 'Admins' })).toBeInTheDocument()`. PASS for AdminsList.
- `src/__tests__/admin/categories-tab.test.tsx` contains NO equivalent assertion for the Categories heading. `grep -n "heading\|aria\|role"` returns empty. The CategoriesList heading fix is untested and could silently regress.
- This is the sole reason the Typography pillar scores 3/4 rather than 4/4.

**Recommended fix:** Add to `categories-tab.test.tsx` inside the main `CategoriesList` describe block:
```ts
it('exposes the Categories section title as a level-2 heading', async () => {
  render(<CategoriesList />)
  // CardTitle renders a plain <div>; role="heading" + aria-level keep the
  // section reachable by screen-reader heading navigation after the Card migration.
  expect(
    await screen.findByRole('heading', { level: 2, name: 'Categories' }),
  ).toBeInTheDocument()
})
```

---

### Pillar 5: Spacing (4/4)

**Spec-declared values verified:**
- `p-4` (16px / md) on admin rows: AdminsList.tsx:124, CategoriesList.tsx:205, 246. PASS
- `p-2` (8px / sm) on PromoteAdminDialog result rows: PromoteAdminDialog.tsx:95. PASS
- `py-16` (64px vertical) on empty state containers: AdminsList.tsx:107, CategoriesList.tsx:189. PASS
- `gap-1` (4px / xs) on icon button groups: CategoriesList.tsx:217, 260, 286. PASS
- `gap-2` / `gap-3` on row content spacing: multiple locations. PASS

**Spec-declared arbitrary values (documented exceptions):**
- `min-h-[64px]` — admin row minimum height. Spec explicitly documents this. PASS
- `min-h-[56px]` — category row minimum height. Spec explicitly documents this. PASS
- `h-[64px]` — admin skeleton height. Spec explicitly documents this. PASS
- `h-[56px]` — category skeleton height. Spec explicitly documents this. PASS
- `min-h-[44px]` — PromoteAdminDialog result row touch target. Matches spec structure contract exactly. PASS

**Additional arbitrary value:**
- `text-[10px]` — avatar fallback initials font size (AdminsList.tsx:134). This is a pre-migration value not introduced by Phase 17 and is outside the spec scope. No regression.

**p-0 override on CardContent:** All three CardContent instances use `className="p-0"` to cancel the primitive's default `px-6`. This ensures `divide-y` reaches card edges (full-bleed rows per D-03). PASS

**py-0 override on Card:** All three Card wrappers use `className="py-0"` to cancel `py-6` default inset. This preserves flush row alignment (D-decision documented in 17-02-SUMMARY.md). The remaining `gap-6` between CardHeader and CardContent is inherited from the Card flex-col layout. PASS

No non-spec arbitrary values introduced by this phase.

---

### Pillar 6: Experience Design (4/4)

**Loading states:**
- AdminsList: 3 skeleton rows `h-[64px] bg-muted/30 animate-pulse` with `data-testid="admin-skeleton"` (lines 98-104). Inside `<CardContent className="p-0"><div className="divide-y">`. PASS
- CategoriesList: 4 skeleton rows `h-[56px] bg-muted/30 animate-pulse` with `data-testid="category-skeleton"` (lines 180-186). Same Card structure. PASS
- PromoteAdminDialog: Search results card not rendered while `searching === true` (guarded by `results.length > 0`). Per spec: "Results Card not rendered while searching" — preserved. PASS

**Error states:**
- AdminsList: `<Alert variant="destructive" role="alert">` rendered as early return OUTSIDE the Card (lines 67-79). Error state exits before Card JSX, no nesting issue. `role="alert"` preserved. PASS
- CategoriesList: Same pattern (lines 54-67). PASS

**Empty states:**
- AdminsList: Icon (Users) + "No admins yet." heading + "Promote one to get started." body inside `<CardContent className="p-0">` (lines 107-115). PASS
- CategoriesList: Icon (Folder) + "No categories yet." + "Create one to organize suggestions." + New category Button (lines 189-201). `showEmpty` correctly guards against false positive during loading or new-row-active states. PASS
- PromoteAdminDialog no-matches: `<p className="text-xs text-muted-foreground mt-2">No matches. Paste a Discord ID instead.</p>` rendered below input when `canSearch && results.length === 0 && !searching` (line 127-131). PASS

**Disabled states:**
- All mutation actions in CategoriesList disable on `submitting` (Save, Cancel, Edit, Delete, New category header button — 8 instances). PASS
- PromoteAdminDialog Promote buttons disable on `submitting` (line 117). Pre-authorize button disables on `submitting || !isValidSnowflake` (line 156). PASS
- CategoriesList "New category" header button disables on `newRowActive || submitting` (line 169) — prevents double-row creation. PASS

**Destructive action confirmation:**
- AdminsList Demote: Opens DemoteAdminDialog (confirmed exists via import at line 10); does not execute inline. PASS
- CategoriesList Delete: `handleAskDelete` queries the affected-count BEFORE opening the confirm dialog, so the copy reflects reality. `handleConfirmDelete` guards on `deleteTarget.countError` — will not proceed on count-query failure. PASS

**Keyboard interactions:**
- CategoriesList new/edit rows: `onKeyDown` handles Enter (save) and Escape (cancel). PASS
- CategoriesList refs: `editInputRef` focused on `editingId` change; `newInputRef` focused on `newRowActive` change via `useEffect`. PASS
- PromoteAdminDialog search Input: `autoFocus` set (line 81). PASS

**WR-01 accessibility fix — Experience Design context:**
- The regression (h2 demoted to non-heading div) was found by 17-REVIEW.md and fixed before this audit target.
- Fix applied: `role="heading" aria-level={2}` on both CardTitle instances. Verified at AdminsList.tsx:84 and CategoriesList.tsx:161.
- Behavioral test added in admins-tab.test.tsx:122-129. Confirmed no `(D-05)` archaeology remains in that test.
- Gap: categories-tab.test.tsx lacks the parallel regression test (see Typography pillar).

**Dialog ARIA chain (D-05 / UIDN-05):**
- DialogContent and DialogTitle wrappers intact in PromoteAdminDialog.tsx:66-68. Radix applies `role="dialog"` + `aria-labelledby` at runtime from these. CardContent inside dialog is a generic `data-slot` div — no role conflict. PASS
- Behavioral assertion added: `admins-tab.test.tsx:119` — `findByRole('dialog', { name: /promote admin/i })`. PASS

---

## Registry Safety

No third-party registries declared in 17-UI-SPEC.md. Card, CardHeader, CardTitle, CardAction, CardContent are all from the shadcn official set, already vendored in `src/components/ui/card.tsx` prior to this phase. No `npx shadcn add` calls were made. Registry audit skipped per protocol (no third-party entries in spec).

---

## Files Audited

- `src/components/admin/AdminsList.tsx` (193 lines)
- `src/components/admin/CategoriesList.tsx` (355 lines)
- `src/components/admin/PromoteAdminDialog.tsx` (165 lines)
- `src/components/ui/card.tsx` (93 lines — primitive reference)
- `src/__tests__/admin/admins-tab.test.tsx` (heading regression test verification)
- `src/__tests__/admin/categories-tab.test.tsx` (regression test gap identified)
- `.planning/phases/17-planning-doc-ui-hygiene-sweep/17-UI-SPEC.md` (audit baseline)
- `.planning/phases/17-planning-doc-ui-hygiene-sweep/17-REVIEW.md` (WR-01 context)
- `.planning/phases/17-planning-doc-ui-hygiene-sweep/17-02-SUMMARY.md` (execution decisions)
