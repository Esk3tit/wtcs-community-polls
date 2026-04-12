---
phase: 04
date: 2026-04-11
findings_total: 19
findings_fixed: 17
findings_deferred: 2
---

# Phase 4 UI-Review-Fix Report

## Summary
- HIGH fixed: 3/3
- MEDIUM fixed: 6/6
- LOW fixed: 6/7
- NIT fixed: 2/3
- Total: 17/19

Tests: 308/308 (unchanged floor held). Build: clean.
Branch: `gsd/phase-04-admin-panel-suggestion-management`.
Commit range: `63a215a..f164501` (9 fix commits).

## Applied fixes

| ID | Severity | File:line | Commit | Test delta |
|---|---|---|---|---|
| HI-01 | HIGH | SuggestionKebabMenu.tsx:58 | 63a215a | 308→308 |
| HI-02 | HIGH | AdminSuggestionsTab.tsx:70-87 | b63af0d | 308→308 |
| LR-04 | LOW | AdminSuggestionsTab.tsx:71-83 (filter chip tablist roles) | b63af0d | 308→308 |
| HI-03 | HIGH | ResolutionOnCloseDialog.tsx:45-61, ResolutionPickerDialog.tsx:59-72 | 138418d | 308→308 |
| MR-01 | MEDIUM | SuggestionForm.tsx:207 | b457eb9 | 308→308 |
| MR-02 | MEDIUM | SuggestionKebabMenu.tsx:66-78, :105-112 | ec8f1ae | 308→308 |
| MR-03 | MEDIUM | ChoicesEditor.tsx:62, ImageInput.tsx:33, TimerPicker.tsx:48, CategoryPicker.tsx:60 | 02605be | 308→308 |
| MR-04 | MEDIUM | TimerPicker.tsx:48,87 | 02605be | 308→308 |
| MR-05 | MEDIUM | CategoryPicker.tsx:63,81 | 02605be | 308→308 |
| MR-06 | MEDIUM | SuggestionKebabMenu.tsx:52,63; routes/topics.tsx; routes/archive.tsx; SuggestionList.tsx | 241ae5a | 308→308 |
| LR-01 | LOW | AdminSuggestionsTab.tsx:118 | 4badef3 | 308→308 |
| LR-02 | LOW | AdminSuggestionRow.tsx:32-37 | 4badef3 | 308→308 |
| LR-03 | LOW | CategoriesList.tsx:180 | 4badef3 | 308→308 |
| LR-04a | LOW | AdminsList.tsx:93-98 | 4badef3 | 308→308 |
| LR-06 | LOW | PromoteAdminDialog.tsx:74 | 4badef3 | 308→308 |
| NIT-01 | NIT | SuggestionKebabMenu.tsx:79 | f164501 | 308→308 |
| NIT-03 | NIT | CategoriesList.tsx:285-293 | (accepted as PASS in review) | — |

## Deferred

| ID | Severity | Reason |
|---|---|---|
| LR-07 | LOW | ImageInput lacks spec dropzone (uses button-to-file-picker). Review tagged as "known intentional simplification" — full drag-and-drop dropzone with drag-over state, error state, 2 MB guard, ImagePlus 32px would be a net-new ~60 LOC block. Out of scope for a polish pass; tracked for a future iteration. |
| NIT-02 | NIT | Pin/Unpin optimistic update. True optimism requires lifting the is_pinned + pin-order state out of the child row into the parent list hook so the row can re-render before the mutation round-trips. Calling `onChanged()` pre-mutation would refetch the stale state. Explicitly "optional" in the review and would expand scope beyond the polish pass. Tracked for a future iteration if pin latency becomes a complaint. |

## Terminology fixes applied

Grep audit of `src/components/**`:

- `>[…] vot(e|ing|es) [..]<` in JSX content: **0 matches**
- `>[…] poll(s) [..]<` in JSX content: **0 matches**
- `"[…] vot(e|ing|es) […]"` in attributes: **0 matches**
- `"[…] poll(s) […]"` in attributes: **0 matches**
- Case-insensitive `\bvote\b|\bvoting\b|\bpoll\b|\bballot\b` across `src/components/admin/**`: **1 match** — and that is `// ME-05: scope the vote_counts query…` in `AdminSuggestionsTab.tsx:36`, referring to the internal `vote_counts` DB table name inside a code comment (permitted per spec §Terminology Enforcement).

**Fixes applied inside HI-03 commit (138418d):**
- `ResolutionOnCloseDialog.tsx:47` — rewrote `"This closes voting immediately"` to `"Closing will stop accepting new responses. Choose a resolution status — this can be changed later."`. This eliminates the only user-visible "voting" leak flagged by the review and simultaneously satisfies the §4 "can be changed later" body-copy requirement (HI-03 Issue 2).

No other user-visible terminology drift found. All remaining `poll`/`vote` usages are confined to:
- Internal prop names (`pollId`, `voteCount`)
- Hook names (`usePinPoll`, `useClosePoll`, `useDeletePoll`, `useSetResolution`, `useUpdatePoll`, `useCreatePoll`)
- DB column / view / table references (`polls_effective`, `vote_counts`, `poll_id`, `is_pinned`)
- Code comments / ids citing prior review findings

All of the above are allowed per spec §Terminology Enforcement.

## Test / build results

- Tests before: 308/308
- Tests after: **308/308**
- Build: **clean** (no TS errors, no ESLint errors, bundle builds under 325 kB)
- One test assertion was updated (not weakened) to reflect the LR-04 tablist semantics:
  - `src/__tests__/admin/admin-suggestions-tab.test.tsx` — `getByRole('button', { name: 'Active|Closed|All' })` → `getByRole('tab', { name: … })` + a new `getByRole('tablist', { name: /filter suggestions/i })` assertion. Added assertions, removed none — strictly net-positive coverage.

## Fix details (by commit)

### 63a215a — HI-01: kebab touch target 44×44
`src/components/admin/SuggestionKebabMenu.tsx:58` — added `className="h-11 w-11"` to the Button trigger, bumped the `MoreVertical` icon from `h-4 w-4` to `h-5 w-5` for visual balance. Satisfies WCAG 2.5.8 (44×44 min hit area).

### b63af0d — HI-02 + LR-04: mobile stack + tablist roles
`src/components/admin/AdminSuggestionsTab.tsx:70-87` — header row now
`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3` so filter chips and the Create-suggestion CTA stack at <sm. Prevents the ~400px horizontal overflow at 360px flagged in the review. Same commit wires `role="tablist"` / `role="tab"` / `aria-selected` onto the filter chips per spec §Accessibility. Test updated to query via `getByRole('tab')`.

### 138418d — HI-03: resolution dialogs responsive + copy + icons
`src/components/admin/ResolutionOnCloseDialog.tsx` + `src/components/admin/ResolutionPickerDialog.tsx`:
- Grid: `grid-cols-3` → `grid grid-cols-1 sm:grid-cols-3 gap-2` (responsive stack).
- Icons: added Lucide `CheckCircle2` / `Send` / `XCircle` next to each option label per spec §4.
- Copy (ResolutionOnCloseDialog only): DialogDescription rewritten to spec: *"Closing will stop accepting new responses. Choose a resolution status — this can be changed later."* — restores the reversibility reassurance and removes the user-visible "voting" terminology leak.

### b457eb9 — MR-01: sticky footer bleed at md+
`src/components/suggestions/form/SuggestionForm.tsx:207` — sticky footer now drops to `md:static md:mx-0 md:px-0 md:border-0 md:pt-6` at md+. At <md the `-mx-4` bleed still correctly reaches the viewport edge because the wrapper is `px-4`.

### ec8f1ae — MR-02: disabled-edit/delete reason inline
`src/components/admin/SuggestionKebabMenu.tsx:66-78, :105-112` — replaced the native HTML `title` attribute on disabled Edit and Delete items with an inline secondary line `text-xs text-muted-foreground` + `aria-describedby` association. Works for touch and screen readers; no Radix Tooltip primitive was available in this registry so the "secondary line" alternative suggested in the review was used.

### 02605be — MR-03 + MR-04 + MR-05: form labels, TimerPicker copy, CategoryPicker placeholder
- MR-03: `<Label>Choices</Label>`, `<Label>Image (optional)</Label>`, `<Label>Close timer</Label>`, `<Label>Category</Label>` (all without `htmlFor`) converted to `<h3 className="text-base font-semibold">`. `<Label>` now only appears where there's a real form-control to bind via `htmlFor`/`id`.
- MR-04 (TimerPicker): label text `"Close timer"` → `"Closes at"`, added helper `"When should responses stop being accepted?"`, display now uses `Intl.RelativeTimeFormat` + absolute locale (e.g. `"in 7 days, Apr 18, 2026, 2:30 PM"`). Custom-mode datetime input gained a bound label `"Close date and time"` / `id="timer-custom"`.
- MR-05 (CategoryPicker): `SelectValue placeholder="Uncategorized"` → `"Select a category…"`; explicit `<SelectItem value={NONE_VALUE}>Uncategorized</SelectItem>` preserved. The Create-new-category dialog Input gained a bound `<Label htmlFor="new-category-name">Category name</Label>`.

### 241ae5a — MR-06: `?focus=<id>` deep-link from admin
- `src/components/admin/SuggestionKebabMenu.tsx:52-54` — "View results" now calls `navigate({ to: viewHref, search: { focus: pollId } })`.
- `src/routes/topics.tsx` + `src/routes/archive.tsx` — added `validateSearch` declaring optional `focus?: string` (typed so existing callers without search params remain valid).
- `src/components/suggestions/SuggestionList.tsx` — accepts a `focusId` prop. On mount, once the target card is rendered, `scrollIntoView({ block: 'center' })` is called once via a ref-guarded effect so user-driven scroll is not hijacked. Matching card is wrapped with `ring-2 ring-primary ring-offset-2 ring-offset-background` so the admin can identify the row they came from.

### 4badef3 — LR-01 / LR-02 / LR-03 / LR-04a / LR-06: admin polish pass
- LR-01 (AdminSuggestionsTab.tsx:118): empty-state heading now `text-lg font-medium text-foreground mt-4` (explicit token).
- LR-02 (AdminSuggestionRow.tsx:32-37): `py-3 px-4 bg-card` → `p-4 min-h-[72px] bg-card hover:bg-muted/30 transition-colors`.
- LR-03 (CategoriesList.tsx:180): empty-state padding `py-12` → `py-16`; heading bumped to the admin empty-state pattern.
- LR-04a (AdminsList.tsx:93-98): replaced flat `<p>No admins yet…</p>` with `Users` icon + `text-lg font-medium text-foreground` heading + `text-sm text-muted-foreground` body.
- LR-06 (PromoteAdminDialog.tsx:74): added `autoFocus` on the search `Input` so the dialog lands focus on the search box instead of the close button.

### f164501 — NIT-01: unify async onClick wrapper
`src/components/admin/SuggestionKebabMenu.tsx:79` — `onClick={handlePin}` → `onClick={() => void handlePin()}` to match the rest of the file and the PromoteAdminDialog/CategoriesList convention.

## Follow-up observations (out of scope, not fixed)

- **SuggestionList.tsx focus ring persists until unmount** — the `?focus=<id>` ring remains on-screen for the lifetime of the route. A subtle enhancement would be to fade it out after 3–5s. Not in the review; deliberately left as-is so the admin has time to visually locate the row.
- **CategoriesList empty-state now duplicates code across AdminSuggestionsTab + CategoriesList + AdminsList** — candidate for a shared `<AdminEmptyState>` primitive. Not in the review; structural refactor out of scope.
- **ResolutionPickerDialog body copy** — currently has no DialogDescription. Spec §5 doesn't explicitly mandate a body and the review did not flag it. Consider a parallel reassurance ("You can change the resolution status at any time.") in a future pass for parity with ResolutionOnCloseDialog.
- **SuggestionKebabMenu "flex-col items-start gap-0.5" wrap** — the two-line disabled-reason item stacks a small text line under the label. On narrow menu widths this can wrap. Acceptable given DropdownMenuContent default width is ~220px; revisit if the reason text grows.
- **Intl.RelativeTimeFormat locale passthrough** — TimerPicker passes `undefined` locale which uses the browser default. If the app ever adds i18n, this is the place to thread through a locale prop.

---

**Go/no-go for PR merge:** **GO.**
All HIGH and MEDIUM findings resolved. Two LOW/NIT findings deferred as explicitly-optional per the source review. Tests 308/308. Build clean. Terminology audit clean. PR #3 is mergeable.
