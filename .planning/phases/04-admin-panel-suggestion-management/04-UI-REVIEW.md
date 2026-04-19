---
phase: 04
audit_type: retroactive_ui_review
date: 2026-04-11
files_reviewed: 18
overall_score: 19/24
---

# Phase 4 UI Review (Retroactive)

> Source-level audit of the Phase 4 Admin Panel & Suggestion Management UI against `04-UI-SPEC.md`. No dev server was run — Netlify/browser screenshots are not possible from a review task, so findings are code-evidenced. The spec is the authoritative contract; each finding cites the spec row that was or was not met.

## Overall Score: 19 / 24

## Pillar Grades

| Pillar | Grade | Summary |
|---|---|---|
| 1. Visual hierarchy & layout | 3/4 | Spec-aligned overall. Exactly one primary CTA per surface, correct max-widths, correct heading scale. Row min-h, kebab trigger height, and empty-state padding diverge from spec in a few specific places. |
| 2. Typography | 4/4 | Inter is loaded via Phase 1 `index.css`; the four-size ramp (`text-xs / text-sm / text-base / text-2xl`) and two-weight rule (`font-medium`, `font-semibold`) are honoured throughout. No raw arbitrary sizes, no ALL CAPS, no `text-lg`/`text-xl` introductions outside shadcn primitives. |
| 3. Color & contrast | 4/4 | No hardcoded hex values. All tokens come from shadcn semantics (`bg-card`, `bg-muted`, `border`, `text-destructive`, `text-muted-foreground`). The amber pin/needs-resolution palette correctly uses Tailwind `amber-*` with explicit `dark:` variants. Accent is used exactly on the five elements listed in spec §Color Distribution. |
| 4. Interaction & feedback | 3/4 | Loading skeletons, sticky submit footer, optimistic pin, toast coverage, and the required MEDIUM-#7 retry error states on CategoriesList / AdminsList / SuggestionForm / AdminSuggestionsTab are all present. Two interactions fall short of spec: the close-on-resolution dialog lacks the required "can be changed later" copy, and the edit-disabled kebab item renders a native `title` tooltip instead of a Radix Tooltip (less accessible for touch/VoiceOver). |
| 5. Accessibility | 3/4 | Every form `Input`/`Textarea` is paired with a `<Label htmlFor>`; the kebab trigger has `aria-label="Suggestion actions"`; Dialogs are Radix-based so focus trap + Escape + overlay are inherited; icon-only category action buttons have per-row aria labels; retry Alerts have `role="alert"`. Gaps: ChoicesEditor `<Label>Choices</Label>` is not associated with a field, image preview `alt=""` intentionally empty (acceptable) but dropzone tab has no keyboard-dropzone affordance (just an outline Button, which is fine), and the delete/close kebab items use color as the *only* visual signal for "destructive" (`text-destructive` on text) without an icon/label distinction — screen readers still read "Close…"/"Delete" which is OK, but the filter-chip `tablist` role called out in the spec is not applied. |
| 6. Responsive / mobile-first | 2/4 | Form max-widths and admin-shell `max-w-4xl mx-auto px-4 md:px-6` carry through correctly, tabs use `flex-1` for equal width on mobile, and dialogs default to the Radix/shadcn centered sheet. Several mobile concerns: (a) `AdminSuggestionsTab` header row uses `flex items-center justify-between` with three filter chips + a "Create suggestion" button on one line — this **will overflow at 360px**; (b) ResolutionOnClose/ResolutionPicker dialogs hard-code `grid-cols-3` without the spec's `grid-cols-1 sm:grid-cols-3` responsive fallback so the three resolution buttons will be cramped on narrow phones; (c) sticky form footer uses `-mx-4` which assumes a parent with matching `px-4` — the `max-w-2xl mx-auto px-4 md:px-6` wrapper makes this correct on mobile but at `md+` the `-mx-4` will visually under-hang the content box; (d) kebab trigger is `size="icon"` (h-9 w-9 per shadcn default) but spec mandates `h-11 w-11` for WCAG 2.5.8 — touch target is ~36px today, spec requires ≥44px. |

**Overall: 19/24** — solid retroactive result. Passes UI-SPEC for typography + color. Notable mobile and touch-target gaps are recoverable with small class changes.

---

## Findings by severity

### [HIGH] Kebab trigger does not meet WCAG 2.5.8 touch target
**Surface:** Admin Suggestions tab (and row action column)
**File:** `src/components/admin/SuggestionKebabMenu.tsx:58`
```
<Button variant="ghost" size="icon" aria-label="Suggestion actions">
```
**Issue:** Spec §3 (Admin Suggestions Tab) mandates `className="h-11 w-11"` on the kebab trigger specifically so the hit area is 44×44 (WCAG 2.5.8). The shadcn `size="icon"` default resolves to `h-9 w-9` (36×36). Every row in the admin list therefore ships with an under-sized primary action affordance.
**Fix:** `<Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Suggestion actions">` and drop the icon to `h-5 w-5` if needed to keep visual weight in check.

### [HIGH] AdminSuggestionsTab header row overflows the 360px viewport
**Surface:** Admin Suggestions tab header
**File:** `src/components/admin/AdminSuggestionsTab.tsx:70-87`
```
<div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2">
    {/* 3 chips */}
  </div>
  <Button>...Create suggestion</Button>
</div>
```
**Issue:** Spec §12 Responsive ("Below `md`") calls the form content sticky; spec §3 says "Filter chips container: `flex items-center gap-2 mb-4`" and lists the `[+ Create suggestion]` CTA as a separate primary action. The current implementation colocates them on one flex-row without wrap. At ~360px width, three `h-8 px-3 rounded-full` chips (~200px) plus an icon+label `Create suggestion` button (~160px) plus `gap` and container padding (~40px) is ~400px — forces horizontal scroll or chip clipping. Phase 1 Success Criterion 5 prohibits horizontal scroll on phone.
**Fix:** Either (a) `flex flex-wrap gap-2` on the outer row, or (b) stack the CTA above chips on mobile: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`.

### [HIGH] Resolution dialogs lack responsive stack + required body copy
**Surface:** ResolutionOnCloseDialog, ResolutionPickerDialog
**Files:**
- `src/components/admin/ResolutionOnCloseDialog.tsx:45-61`
- `src/components/admin/ResolutionPickerDialog.tsx:59-72`
```
<div className="grid grid-cols-3 gap-2">
```
**Issue 1 (responsive):** Spec §4 and §12 Responsive explicitly require `grid grid-cols-1 sm:grid-cols-3 gap-2` so the Addressed/Forwarded/Closed choices stack vertically below `sm` (<640px). Current implementation is `grid-cols-3` unconditionally. On a 360px phone each button becomes ~95px wide — the word "Forwarded" will wrap/clip and the three buttons share a tight 2px gap.

**Issue 2 (copy drift):** Spec §4 Body text requires: *"Closing will stop accepting new responses. Choose a resolution status — this can be changed later."* The implementation says *"Pick the resolution that best describes how this suggestion was handled. This closes voting immediately."* — this drops the reversibility reassurance ("this can be changed later") which is the whole reason a destructive primary button is safe here, and the word "voting" leaks admin/DB terminology into user-visible copy (spec §Terminology Enforcement: never "vote" in user-visible strings, even admin ones).

**Fix:** Update the grid to `grid grid-cols-1 sm:grid-cols-3 gap-2` in both files, and replace the `ResolutionOnCloseDialog` DialogDescription with the spec copy. Also add the Lucide `CheckCircle2` / `Send` / `XCircle` icons next to each option label per spec §4.

---

### [MEDIUM] Sticky form footer uses `-mx-4` without matching parent
**Surface:** SuggestionForm footer
**File:** `src/components/suggestions/form/SuggestionForm.tsx:207`
```
<div className="sticky bottom-0 bg-background border-t py-4 px-4 -mx-4 flex ...">
```
**Issue:** The parent wrapper at line 147 uses `max-w-2xl mx-auto px-4 md:px-6 py-6`. On mobile the wrapper is `px-4`, so `-mx-4` correctly bleeds the footer to the viewport edge. At `md+` the wrapper switches to `px-6` but the footer still uses `-mx-4`, leaving a visible 8px gap on each side where the border-top ends and the wrapper's extra padding shows. Spec §7 Form Footer: "Sticky on mobile (`sticky bottom-0 bg-background border-t py-4 px-4 -mx-4`)" — note the spec says *on mobile*, implying the bleed behaviour should drop at `md`. At desktop the footer should sit in-flow or at least stop negative-margining.
**Fix:** `sticky bottom-0 bg-background border-t py-4 px-4 -mx-4 md:mx-0 md:px-0 md:border-0 md:relative md:pt-6` (or similar — drop the sticky at `md+` per spec §12 Responsive).

### [MEDIUM] Edit disabled state uses native `title`, not a tooltip
**Surface:** SuggestionKebabMenu (Edit item)
**File:** `src/components/admin/SuggestionKebabMenu.tsx:66-78`, `:105-112`
```
<DropdownMenuItem
  disabled={editDisabled}
  title={editDisabled ? 'Cannot edit after responses received.' : undefined}
```
**Issue:** Spec §3 D-17 states: *"Tooltip on disabled: 'Cannot edit after responses received.'"* — the current implementation uses the native HTML `title` attribute. On touch devices native `title` tooltips are inaccessible (they require hover), and screen readers treat `title` on a `DropdownMenuItem` with `aria-disabled="true"` inconsistently (most skip it). The same gap exists on the Delete item (line 107).
**Fix:** Wrap the disabled item in shadcn `Tooltip` / `TooltipTrigger` / `TooltipContent`, or surface the reason as a `text-xs text-muted-foreground` secondary line below the item label inside the menu.

### [MEDIUM] ChoicesEditor section label not associated with any field
**Surface:** SuggestionForm → ChoicesEditor
**File:** `src/components/suggestions/form/ChoicesEditor.tsx:62-67`
```
<Label>Choices</Label>
<p className="text-xs text-muted-foreground mt-1">
  How should people respond? Minimum 2, maximum 10.
</p>
```
**Issue:** `<Label>` without `htmlFor` is semantically a heading-masquerading-as-a-label, which violates the spec's §Accessibility rule "Every `Input`, `Textarea`, `Select` has an associated `Label` via `htmlFor` + `id`". The individual choice `Input`s at line 91 use `aria-label={\`Choice ${i + 1}\`}` which is correct, but the section label above provides no programmatic association with any field. Screen readers will announce "Choices" as orphan text.
**Fix:** Change `<Label>` to a plain `<h3 className="text-base font-semibold">Choices</h3>` or `<legend>` (wrap the entire block in a `<fieldset>`) so the "Choices" heading is structural, not a misused form label. Same pattern recurs in `ImageInput.tsx:33`, `TimerPicker.tsx:48`, and `CategoryPicker.tsx:60`.

### [MEDIUM] TimerPicker label and display text diverge from spec
**Surface:** SuggestionForm → TimerPicker
**File:** `src/components/suggestions/form/TimerPicker.tsx:48`, `:87`
```
<Label>Close timer</Label>
...
<p className="text-xs text-muted-foreground">Will close {display}</p>
```
**Issue:** Spec §10 copywriting contract:
- Label: **"Closes at"** — actual: "Close timer"
- Helper: **"When should responses stop being accepted?"** — actual: missing
- Display: **"Will close {relative}, {absolute locale}"** (e.g. "in 7 days, Apr 18, 2026 at 2:30 PM") — actual: "Will close {toLocaleString()}" — missing the relative-time portion entirely
- Error text for past date: **"Close time must be in the future."** — delegated to parent validation; flows through as `error` prop, fine, but the preset-custom "Custom reveal" label is missing ("Close date and time").
**Fix:** Match spec labels/helpers verbatim, and add a relative-time computation (`Intl.RelativeTimeFormat` or a tiny formatter).

### [MEDIUM] CategoryPicker placeholder diverges from spec
**Surface:** SuggestionForm → CategoryPicker
**File:** `src/components/suggestions/form/CategoryPicker.tsx:63`
```
<SelectValue placeholder="Uncategorized" />
```
**Issue:** Spec §11 + copywriting contract requires the placeholder to be `"Select a category…"` with an explicit "Uncategorized" option available as a value. Current code uses the string "Uncategorized" as the placeholder AND as the value label — the placeholder should be distinct so admins understand it's a selection prompt, not the current selection.
**Fix:** `placeholder="Select a category…"` on the trigger. The explicit "Uncategorized" `<SelectItem>` at line 66 already covers the null value.

### [MEDIUM] Public view-results link is wrong for pinned/other surfaces
**Surface:** SuggestionKebabMenu → "View results"
**File:** `src/components/admin/SuggestionKebabMenu.tsx:52, :63`
```
const viewHref = status === 'active' ? '/topics' : '/archive'
...
<DropdownMenuItem onClick={() => navigate({ to: viewHref })}>
```
**Issue:** Spec §3 D-16 #1: *"View results — Navigates to the public suggestion detail."* The current implementation navigates to the **list** page (`/topics` or `/archive`), not to the specific suggestion detail. An admin clicking "View results" on row 5 lands on the topics index, not row 5's view. This is functionally a navigation bug that manifests as UX.
**Fix:** Route to `/topics/$id` / `/archive/$id` with the `pollId` param (or whatever the Phase 2 detail route is) instead of the index. If a detail route doesn't yet exist on the public side, expand the matching card via query param (`?focus=<id>`).

---

### [LOW] "Uncategorized" filter/empty copy drift
**Surface:** AdminSuggestionsTab empty state — "Closed" filter
**File:** `src/components/admin/AdminSuggestionsTab.tsx:118`
```
<p className="text-lg font-medium mt-4">
```
**Issue:** Spec §12 Empty State: heading should be `text-lg font-medium text-foreground mt-4`. Actual: `text-lg font-medium mt-4` — missing the explicit `text-foreground` token. It's inherited at runtime but the spec calls for explicit token usage for dark-mode predictability. Minor.

### [LOW] AdminSuggestionRow uses `py-3` instead of spec's `p-4 min-h-[72px]`
**Surface:** Admin suggestion row
**File:** `src/components/admin/AdminSuggestionRow.tsx:32-37`
```
className={cn(
  'flex items-start justify-between gap-3 py-3 px-4 bg-card',
  needsResolution && 'border-l-2 border-amber-500',
)}
```
**Issue:** Spec §3 row layout: `p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors min-h-[72px]`. Actual: `py-3 px-4` (so vertical padding is 12px, not 16px), no `min-h-[72px]`, no `hover:bg-muted/30 transition-colors`, no `border-b` (the `divide-y` on the parent at `AdminSuggestionsTab.tsx:138` gives dividers, so that part is fine). Row hover affordance is missing and rows can compress below 72px on a single-line title.
**Fix:** Switch to `p-4 min-h-[72px] hover:bg-muted/30 transition-colors` (keep the conditional `border-l-2`).

### [LOW] Admin empty-state padding is py-16 (spec) — correct in AdminSuggestionsTab but py-12 in CategoriesList
**Surface:** CategoriesList empty state
**File:** `src/components/admin/CategoriesList.tsx:180`
```
<div className="flex flex-col items-center justify-center py-12 text-center">
```
**Issue:** Spec §13 says empty state is same container pattern as §12: `py-16`. Actual: `py-12`. Inconsistent vertical rhythm between admin tabs.
**Fix:** `py-16` for parity.

### [LOW] AdminsList empty state is flat text, not the structured Folder/Heading/Body block
**Surface:** AdminsList empty state
**File:** `src/components/admin/AdminsList.tsx:93-98`
```
<div className="flex items-center justify-center py-8 text-center">
  <p className="text-sm text-muted-foreground">
    No admins yet. Promote one to get started.
  </p>
</div>
```
**Issue:** Spec §14 admits the state is unreachable but defines a defensive empty state. The spec's empty-state *pattern* (icon + `text-lg font-medium` heading + `text-sm text-muted-foreground` body) is inconsistent with the actual flat-paragraph version. Low impact because the row is unreachable, but breaks visual consistency for anyone testing with an admin-removed database.

### [LOW] Filter chip wrapper is missing the `role="tablist"` semantics
**Surface:** AdminSuggestionsTab filter chips
**File:** `src/components/admin/AdminSuggestionsTab.tsx:71-83`
**Issue:** Spec §Accessibility: *"Filter chips: `role='tablist'` wrapper with `role='tab'` chips + `aria-selected`, arrow-key nav."* Current implementation is three plain `Button` children in a flex row — no tablist role, no aria-selected, no arrow-key navigation.
**Fix:** Either use shadcn `Tabs` primitives here (they already exist from the outer AdminTabs component), or manually wire `role="tablist"` / `role="tab"` / `aria-selected`.

### [LOW] Amber "Needs resolution" label is decorative but conveys information via color alone
**Surface:** AdminSuggestionRow
**File:** `src/components/admin/AdminSuggestionRow.tsx:35, :53-57`
**Issue:** The `border-l-2 border-amber-500` is a color-only status signal. The companion label "Needs resolution" (line 54) mitigates this for sighted users, but the border itself has no ARIA association. A tooltip was called for in spec §3 ("subtle tooltip on hover: 'Needs resolution'") — currently the text is always visible which is actually *better* than the spec. Small deviation, acceptable.

### [LOW] ImageInput lacks the spec dropzone; uses a button-to-file-picker instead
**Surface:** SuggestionForm → ImageInput → Upload tab
**File:** `src/components/suggestions/form/ImageInput.tsx:58-87`
**Issue:** Spec §9 describes a full drag-and-drop Dropzone with `border-2 border-dashed`, `bg-muted/30`, `min-h-[160px]`, `ImagePlus 32px`, drag-over state, error state. Implementation is a single outline `Button` that opens the native file picker. This is functionally fine on mobile (tap → file chooser is the native UX anyway), but drag-and-drop is unavailable on desktop. No error state, no file-size guard surface (`"Max 2 MB"` is in the button label but nothing validates/reacts). Worth tracking as a known intentional simplification.

### [LOW] `useSearchAdminTargets` search is tied to 300ms debounce and the dialog spec, but no `autoFocus` on the input
**Surface:** PromoteAdminDialog
**File:** `src/components/admin/PromoteAdminDialog.tsx:74-80`
**Issue:** Spec §Admin Promote Flow: *"Promote admin click | Dialog opens, Search input auto-focused"*. Current `Input` at line 74 has no `autoFocus`. Radix Dialog focus trap will focus the first focusable element, which is the Dialog close button — so the admin has to Tab once before they can start typing.
**Fix:** Add `autoFocus` to the `Input` or `ref` + `useEffect`-based focus on dialog open.

---

### [NIT] Inconsistent `onClick` async-void patterns
**Files:** `SuggestionKebabMenu.tsx:79` (`onClick={handlePin}` returns a Promise), `PromoteAdminDialog.tsx:108, :140`, `CategoriesList.tsx:200-201, :212, :244, :255, :290`
**Issue:** Some callbacks are bare async functions (`onClick={handlePin}`), others are wrapped with `void` (`onClick={() => void handleSaveNew()}`). This is a lint/style inconsistency — handles don't surface behaviour, but the project uses `noUnusedParameters` / strict TS and will flag `@typescript-eslint/no-misused-promises` if that rule is ever enabled. Tighten to one convention per file.

### [NIT] Pin/Unpin kebab item doesn't optimistically update isPinned
**File:** `src/components/admin/SuggestionKebabMenu.tsx:47-50`
**Issue:** Spec §Pin Flow says "Immediate optimistic update: row moves to top + badge appears". Current behaviour waits for `await pinPoll(...)` then calls `onChanged()` which refetches. This is functionally correct but on slow networks the spec wanted visible optimism. Optional.

### [NIT] CategoriesList delete button uses `variant="ghost"` with only text color for destructive
**File:** `src/components/admin/CategoriesList.tsx:285-293`
**Issue:** `variant="ghost"` with `text-destructive` works but creates lower visual weight than the spec's implicit "red trash icon signals destructive affordance". shadcn has no `variant="destructive-ghost"` — current approach is fine. Just noting the spec could have been more explicit.

---

## Brand & copy audit

### Terminology (polls vs suggestions, votes vs responses)

**Verdict: clean.** Scanned every `src/components/admin/**` and `src/components/suggestions/form/**` file. All user-visible strings use the approved terminology:

- "Create suggestion" / "New suggestion" / "Edit suggestion" ✓
- "response" / "responses" (AdminSuggestionRow.tsx:61) ✓
- "Suggestion actions" (SuggestionKebabMenu.tsx:58 aria-label) ✓
- "No active suggestions." / "No closed suggestions yet." ✓
- "Suggestions will become uncategorized" (CategoriesList.tsx:317) ✓
- "Couldn't load suggestions" / "Couldn't load admins" / "Couldn't load categories" / "Couldn't load this suggestion" ✓
- "View results" ✓ (not "View poll")

**Allowed internal leakage (spec §Terminology Enforcement):**
- `pollId` / `poll_id` as prop and DB column names — allowed, never surfaces to UI.
- `voteCount` / `hasVotes` / `useDeletePoll` / `usePinPoll` / `useClosePoll` hook names — allowed, internal.
- `polls_effective` / `vote_counts` table references in `supabase.from(...)` — allowed.

**Single violation:** `ResolutionOnCloseDialog.tsx:47` says *"This closes voting immediately"*. The word **"voting"** is user-visible. Spec §Terminology Enforcement: "'vote' never surfaces in admin strings". Rewrite to *"this stops accepting new responses"*.

### Navbar alt / WTCS logo
`src/components/layout/Navbar.tsx:30` — `alt="WTCS Community Suggestions"` matches spec §1 exactly. Logo is `h-8 w-auto md:h-9` as spec mandates. Wraps in `<Link to="/">` with `min-h-[44px]` — correct for WCAG 2.5.8. ✓

### Button labels
- "Create suggestion" ✓ (AdminSuggestionsTab.tsx:85, :131; SuggestionForm.tsx:213)
- "Save changes" ✓ (SuggestionForm.tsx:213)
- "New category" ✓ (CategoriesList.tsx:165)
- "Promote admin" ✓ (AdminsList.tsx:77)
- "Close suggestion" ✓ (ResolutionOnCloseDialog.tsx:71)
- "Delete permanently" ✓ (DeleteSuggestionDialog.tsx:45)
- "Demote" ✓ (DemoteAdminDialog.tsx:54)

### Error state copy
- "Couldn't load suggestions / admins / categories / this suggestion" — not in spec as exact strings but consistent apostrophe-style and user-facing tone. ✓
- "Please try again." ✓
- Missing: the "'Cannot edit after responses received.'" tooltip copy is there as a native `title` attribute (spec compliant text) but not rendered as a visible tooltip — see MEDIUM finding above.

---

## Mobile viewport spot-checks

Code-level inspection only — no browser render.

### 360px (iPhone SE portrait)
| Surface | Risk | Evidence |
|---|---|---|
| Global navbar | Low — `max-w-2xl mx-auto px-4` with flex-justify-between — logo + theme + avatar fits | Navbar.tsx:21 |
| /admin tabs | Low — `TabsTrigger flex-1` ensures equal-width distribution | AdminTabs.tsx:35,41,47 |
| /admin Suggestions header row | **HIGH — overflow** | See HIGH finding above |
| /admin Categories row | Low — row is `flex items-center justify-between p-4 gap-3` with input `flex-1` | CategoriesList.tsx:235 |
| /admin Admins row | Low — avatar + name stack + h-9 demote button fits | AdminsList.tsx:106 |
| Resolution dialogs | **HIGH — 3 buttons cramped** | See HIGH finding above |
| Delete dialog | Low — simple stacked buttons in DialogFooter | DeleteSuggestionDialog.tsx:40 |
| SuggestionForm | Medium — single column, but footer `-mx-4` is correct only because wrapper is px-4 at <md | SuggestionForm.tsx:147,207 |
| ChoicesEditor | Low — choice inputs have `flex items-center gap-2` and ghost icon Remove | ChoicesEditor.tsx:90 |
| ImageInput | Low — tabs and a full-width button | ImageInput.tsx:53 |
| TimerPicker | Low — three preset buttons in a flex row; `7 days`/`14 days`/`Custom` are short so they fit | TimerPicker.tsx:49 |
| CategoryPicker | Low — shadcn Select trigger is full-width by default | CategoryPicker.tsx:62 |
| Promote dialog | Low — `sm:max-w-md` but falls back to full-width on `<sm`, search + ID sections stack naturally | PromoteAdminDialog.tsx:61 |
| Kebab trigger hit area | **HIGH — 36×36 vs spec 44×44** | See HIGH finding above |

### 768px (iPad portrait)
Mostly fine. Sticky footer `-mx-4` misalign at `md` as noted (MEDIUM #1).

### 1024px+
All surfaces within max-width containers (`max-w-2xl` for forms, `max-w-4xl` for admin shell). No concerns.

---

## UI-SPEC compliance (row-by-row trace)

| Spec Section | Requirement | Implementation | Status |
|---|---|---|---|
| §Design System | Inter, shadcn Neutral, Lucide | Navbar uses `@/assets/wtcs-logo.png`, shadcn primitives from `@/components/ui/*`, Lucide icons throughout | PASS |
| §Spacing · kebab trigger | `h-11 w-11` | `size="icon"` (h-9 w-9) | FAIL (HIGH #1) |
| §Spacing · row min-h | `min-h-[44px]` row / `min-h-[72px]` admin row | `py-3 px-4` (no explicit min-h) | FAIL (LOW) |
| §Spacing · card padding | `p-4` form field wrapper, `p-5` card | `p-4` in CategoriesList/AdminsList rows | PASS |
| §Spacing · max-widths | `max-w-4xl` admin, `max-w-2xl` form | `max-w-4xl` at index.tsx:27, `max-w-2xl` at SuggestionForm.tsx:147 | PASS |
| §Typography | `text-xs/sm/base/2xl`, `font-medium/semibold` | Verified via grep — no out-of-band sizes | PASS |
| §Color · accent usage | Primary reserved for 5 specific uses | Active tab uses shadcn Tabs default (semantic-correct); filter chip variant=default; primary CTA "Create suggestion"; no leakage | PASS |
| §Color · no hardcoded hex | All tokens semantic | Confirmed — amber is Tailwind palette (not hex), not a token violation per spec §Color | PASS |
| §Component 1 · Navbar logo | h-8/md:h-9, `alt="WTCS Community Suggestions"`, `min-h-[44px]` | All three | PASS |
| §Component 2 · Admin shell tabs | `max-w-4xl`, `text-2xl font-semibold mb-6`, `?tab=` persistence, default suggestions, `flex-1` equal-width | All present | PASS |
| §Component 3 · Filter chips | `h-8 px-3 rounded-full text-xs font-medium`, `?filter=` persistence | PASS for chip styling (AdminSuggestionsTab.tsx:77) | PASS (styling); FAIL (role="tablist" per §Accessibility) |
| §Component 3 · Admin row | `p-4 min-h-[72px] hover:bg-muted/30` | `py-3 px-4 bg-card` — no min-h, no hover | FAIL (LOW) |
| §Component 3 · Pin badge | amber palette with dark variants, `Pin 12px` | `h-3 w-3` ≈ 12px ✓, color classes match | PASS |
| §Component 3 · Null-resolution flag | `border-l-2 border-amber-500` + tooltip | Border ✓, replaced tooltip with always-visible "Needs resolution" label — better than spec | PASS+ |
| §Component 3 · Kebab menu order | View / Edit / Pin / sep / Close / Set resolution / sep / Delete | Matches line 63-112 | PASS |
| §Component 3 · Edit disabled when vote_count>0 | `disabled` + tooltip | `disabled` ✓, tooltip is native `title` | PARTIAL (MEDIUM) |
| §Component 3 · View results nav | "public suggestion detail" | Goes to `/topics` list, not detail | FAIL (MEDIUM) |
| §Component 4 · Resolution-on-Close dialog | `grid-cols-1 sm:grid-cols-3`, icons, "can be changed later" body | `grid-cols-3` unconditional, no icons, wrong body | FAIL (HIGH #3) |
| §Component 5 · Resolution Picker dialog | Same + pre-highlight current | grid-cols-3, pre-highlights via useState(currentResolution) ✓ | PARTIAL |
| §Component 6 · Delete dialog | Title + body + cancel + destructive confirm | All present, body text is on-brand | PASS |
| §Component 7 · SuggestionForm | Back link, heading, sections, sticky footer, locked banner, Loader2+Saving… submit | All present | PASS (except footer at md+) |
| §Component 8 · ChoicesEditor | Preset row, choice rows, remove disabled @ 2, add disabled @ 10, overwrite confirm | All present (line 26-120) | PASS |
| §Component 9 · ImageInput | Dropzone with drag states, Upload + URL tabs, preview with Clear | Button-based upload, no drag — LOW simplification | PARTIAL (LOW) |
| §Component 10 · TimerPicker | "Closes at" label, 7d/14d/Custom, computed display | "Close timer" label (wrong), missing helper, basic toLocaleString | PARTIAL (MEDIUM) |
| §Component 11 · CategoryPicker | "Select a category…" placeholder, Uncategorized, inline Create | "Uncategorized" placeholder (should be prompt), rest present | PARTIAL (MEDIUM) |
| §Component 12 · Empty states (admin suggestions) | Icon + heading + body + CTA when not closed | All three states present (lines 111-135) | PASS |
| §Component 13 · Categories tab | Header with Plus, rows with Pencil/Trash2, inline edit, delete dialog | All present | PASS |
| §Component 13 · Categories empty state | `py-12`? Spec says `py-16` implicitly | `py-12` | FAIL (LOW) |
| §Component 14 · Admins tab | Header, rows with avatar, demote button, self-row "You" | All present (AdminsList.tsx:71-147) | PASS |
| §Component 14 · Promote dialog | Search + Paste ID + auto-focus | Search ✓ Paste ID ✓ auto-focus **missing** | PARTIAL (LOW) |
| §Component 16 · Toasts | Sonner messages per spec | Handled inside hooks (not inspected deeply, but `usePromoteAdmin`/`useClosePoll` etc. are referenced) | ASSUMED PASS |
| §Copywriting · "can be changed later" | in Close dialog body | MISSING | FAIL (HIGH) |
| §Copywriting · "voting" never user-visible | — | "This closes voting immediately" in ResolutionOnCloseDialog.tsx:47 | FAIL (HIGH #3 Issue 2) |
| §Accessibility · Form labels | `htmlFor`+`id` on Input/Textarea/Select | SuggestionForm.tsx:166-186 ✓; ChoicesEditor uses aria-label on Inputs ✓; section `<Label>` misuse (MEDIUM) | PARTIAL |
| §Accessibility · Kebab aria-label | `"Suggestion actions"` | SuggestionKebabMenu.tsx:58 ✓ | PASS |
| §Accessibility · Filter chip `role="tablist"` | — | Missing | FAIL (LOW) |
| §Accessibility · Dialog inherited a11y | shadcn/Radix | All dialogs use shadcn primitives ✓ | PASS |
| §Accessibility · Reduced motion | pulse skeletons only | Skeletons use `animate-pulse` (opacity, not transform) ✓ | PASS |
| §Registry Safety | Only shadcn official Tabs/Dialog/Label/Textarea/Select | No third-party registries, components.json present but not inspected for extra blocks this audit | PASS (no flags raised) |

---

## Recommendations (prioritized)

1. **[HIGH, ~5 min]** Bump kebab trigger to `h-11 w-11` in `SuggestionKebabMenu.tsx:58` — one-line change, unblocks WCAG 2.5.8.
2. **[HIGH, ~10 min]** Wrap AdminSuggestionsTab header in `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3` so filter chips + CTA stack on mobile — prevents 360px horizontal scroll.
3. **[HIGH, ~15 min]** Fix ResolutionOnCloseDialog and ResolutionPickerDialog: `grid grid-cols-1 sm:grid-cols-3 gap-2`, add Lucide icons per spec, rewrite body copy to *"Closing will stop accepting new responses. Choose a resolution status — this can be changed later."* (also eliminates the "voting" terminology leak).
4. **[MEDIUM, ~20 min]** Re-structure SuggestionForm section labels: `ChoicesEditor`, `ImageInput`, `TimerPicker`, `CategoryPicker` — convert `<Label>` without `htmlFor` to `<h3 className="text-base font-semibold">` or `<legend>` inside `<fieldset>`. Adds a11y clarity.
5. **[MEDIUM, ~10 min]** Fix sticky footer bleed at `md+`: `md:mx-0 md:px-0 md:border-0 md:relative md:pt-6` on `SuggestionForm.tsx:207`.
6. **[MEDIUM, ~15 min]** Replace native `title` tooltip on disabled kebab items with shadcn `Tooltip` wrapper, or inline the disabled-reason text as a secondary line.
7. **[MEDIUM, ~10 min]** Fix View results navigation to route to the specific suggestion detail, not the public list index.
8. **[MEDIUM, ~5 min]** TimerPicker: change label to "Closes at", add helper "When should responses stop being accepted?", add relative-time to the display.
9. **[MEDIUM, ~2 min]** CategoryPicker: `placeholder="Select a category…"` on the trigger.
10. **[LOW, cleanup]** Apply spec row styling (`p-4 min-h-[72px] hover:bg-muted/30 transition-colors`) to `AdminSuggestionRow`.
11. **[LOW, cleanup]** Add `role="tablist"` / `role="tab"` / `aria-selected` / arrow-key nav on AdminSuggestionsTab filter chips (or reuse shadcn Tabs).
12. **[LOW, cleanup]** Add `autoFocus` to PromoteAdminDialog search Input.
13. **[LOW, cleanup]** CategoriesList empty state padding `py-12` → `py-16`.

Total effort to close all HIGH + MEDIUM findings: ~90 minutes. No structural rewrites needed.

---

## Go/no-go for PR merge (UI quality)

**Recommendation: go with follow-up.** PR #3 is mergeable from a UI quality standpoint — the foundation (tokens, typography, color, shell structure, retry error states, terminology, a11y base) is solid. The HIGH findings are all small-surface class/copy fixes, not structural issues. Suggest:

- **Block on:** HIGH #1 (touch target — WCAG compliance), HIGH #3 Issue 2 (terminology leak: "voting") — these are explicit spec violations.
- **Ship as follow-up (same sprint):** HIGH #2 (mobile overflow), HIGH #3 Issue 1 (resolution grid stacking), all MEDIUMs.
- **Backlog:** All LOWs and NITs.

Score breakdown confirms the phase is 79% compliant (19/24). Phase 4 is functionally complete and visually consistent; the remaining gaps are easily closed in one short polish pass before or after merge.

---

## Files Reviewed

1. `src/components/layout/Navbar.tsx`
2. `src/routes/admin/index.tsx`
3. `src/components/admin/AdminTabs.tsx`
4. `src/components/admin/AdminSuggestionsTab.tsx`
5. `src/components/admin/AdminSuggestionRow.tsx`
6. `src/components/admin/SuggestionKebabMenu.tsx`
7. `src/components/admin/CategoriesList.tsx`
8. `src/components/admin/AdminsList.tsx`
9. `src/components/admin/PromoteAdminDialog.tsx`
10. `src/components/admin/DemoteAdminDialog.tsx`
11. `src/components/admin/ResolutionOnCloseDialog.tsx`
12. `src/components/admin/ResolutionPickerDialog.tsx`
13. `src/components/admin/DeleteSuggestionDialog.tsx`
14. `src/components/suggestions/form/SuggestionForm.tsx`
15. `src/components/suggestions/form/ChoicesEditor.tsx`
16. `src/components/suggestions/form/ImageInput.tsx`
17. `src/components/suggestions/form/TimerPicker.tsx`
18. `src/components/suggestions/form/CategoryPicker.tsx`

Reference: `.planning/phases/04-admin-panel-suggestion-management/04-UI-SPEC.md`
