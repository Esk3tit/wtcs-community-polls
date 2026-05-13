---
phase: 4
slug: admin-panel-suggestion-management
status: draft
shadcn_initialized: true
preset: bbVJxbc
created: 2026-04-11
---

# Phase 4 — UI Design Contract

> Visual and interaction contract for the Admin Panel & Suggestion Management phase. Extends the Phase 1 and Phase 2 contracts. Built on the WTCS Design System Brief (`.planning/DESIGN-SYSTEM.md`) and Phase 4 CONTEXT (`04-CONTEXT.md`).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (new-york style, per `components.json`) |
| Preset | `bbVJxbc` (Neutral base, Neutral theme, Medium radius) |
| Component library | shadcn/ui + Radix primitives |
| Icon library | Lucide React |
| Font (heading + body) | Inter (declared in `src/index.css`) |

**Design direction:** "Warm neutral" — Linear-meets-Discord information density. Admin surface uses the same tokens as the public surface (D-03 brings the WTCS logo app-wide so public and admin share one shell).

**Terminology rule (hard):**
- Public/user surfaces: "suggestions", "topics", "responses", "community sentiment"
- Admin surfaces (this phase): internal "polls", "votes" terminology is permitted per DESIGN-SYSTEM.md. Admin UI uses "Suggestions" as the tab label (consistent user-facing framing even inside /admin), but toast messages, field labels, and error strings may reference "poll" internally where clarity demands it. Default to "suggestion" unless the code-level object is directly exposed.

**Continuity:** This spec extends `01-UI-SPEC.md` and `02-UI-SPEC.md`. All prior tokens, spacing, typography, and color decisions carry forward unchanged. This document specifies only new or extended contracts for Phase 4.

---

## Spacing Scale

Tailwind 4px base carried forward. Phase 4 adds admin-form and table-row spacing:

| Tailwind | Value | Usage |
|----------|-------|-------|
| `gap-1` | 4px | Icon-to-label gap in kebab menu items, badge internals |
| `gap-2` | 8px | Tab trigger inner padding, form field label-to-input gap |
| `gap-3` | 12px | Between form fields inside a section |
| `gap-4` | 16px | Between form sections (Title block, Choices block, Image block, etc.) |
| `gap-6` | 24px | Between major form groups on desktop |
| `p-4` | 16px | Form field wrapper padding, table row vertical padding |
| `p-5` | 20px | Card padding (matches Phase 2 suggestion cards) |
| `p-6` | 24px | Dialog content padding (shadcn default) |
| `px-3 py-2` | 12×8 | Kebab menu item padding |
| `px-4 py-3` | 16×12 | Admin tab content padding on mobile |
| `py-8` | 32px | Empty-state vertical padding inside admin tabs |
| `mb-6` | 24px | Spacing below page heading on admin screens |
| `h-10` | 40px | Form input height (matches shadcn Input default) |
| `h-11` | 44px | Primary submit button height + kebab menu trigger (WCAG 2.5.8 touch target) |
| `h-9` | 36px | Secondary/tertiary button height inside forms (Cancel, preset buttons) |
| `min-h-[44px]` | 44px | Minimum hit area for every table row tap target and kebab trigger |

**Touch targets:** Minimum 44px height for all tappable elements per WCAG 2.5.8 (kebab menu trigger, row action hit area, primary CTAs). Icon-only 32px buttons are acceptable only inside a 44px padded wrapper.

**Max widths:**
- Public surfaces (carried from Phase 2): `max-w-2xl` (672px)
- Admin form pages: `max-w-2xl` (672px) — same comfortable reading width, single column on mobile
- Admin tab content (list/table views): `max-w-4xl` (896px) — wider to host row actions + metadata without wrap

**Exceptions:** `py-0.5` (2px) on category/resolution badges carried from Phase 2.

---

## Typography

Extends Phase 1 + Phase 2. New roles for Phase 4 admin surfaces:

| Role | Tailwind Class | Usage |
|------|---------------|-------|
| Page heading | `text-2xl font-semibold` | `/admin` page heading ("Admin"), form page headings ("New suggestion", "Edit suggestion") |
| Section heading | `text-base font-semibold` | Form section labels ("Choices", "Image", "Timer", "Category") |
| Body/form input text | `text-sm` | Input values, select trigger text, textarea content |
| Field label | `text-sm font-medium` | Form field labels above inputs |
| Helper text | `text-xs text-muted-foreground` | Field hints, character counters, upload constraints |
| Error text | `text-xs text-destructive` | Inline validation errors below fields |
| Table row primary | `text-sm font-medium text-foreground` | Suggestion title in admin row, category name in categories list |
| Table row meta | `text-xs text-muted-foreground` | Row secondary info (response count, closes-at, category on admin row) |
| Kebab menu item | `text-sm` | DropdownMenuItem label text |
| Tab trigger | `text-sm font-medium` | Admin tab triggers (Suggestions, Categories, Admins) |
| Filter chip | `text-xs font-medium` | Active/Closed/All filter chips on admin Suggestions tab |

**4 sizes total (matches Phase 2):** `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-2xl` (24px). No new sizes introduced.

**2 explicit font weights:** `font-medium` (500), `font-semibold` (600). Regular (400) is the implicit default.

**Line heights:** Default Tailwind. `leading-relaxed` (1.625) on suggestion description textarea preview. `leading-tight` (1.25) on page headings.

**Constraints:**
- No `text-xs` below 12px
- No ALL CAPS except inherited category filter pills from Phase 2
- Form labels are `text-sm font-medium`, never uppercase

---

## Color

Carries forward Phase 1 + Phase 2 shadcn semantic tokens. No new raw colors introduced — all admin UI composes from existing tokens.

### New Phase 4 Color Applications

| Element | Tokens | Notes |
|---------|--------|-------|
| Admin tab trigger (active) | `bg-background text-foreground border-b-2 border-primary` | Active tab uses accent (primary) as the underline indicator |
| Admin tab trigger (inactive) | `text-muted-foreground hover:text-foreground` | No fill, subtle hover |
| Filter chip (active) | `bg-primary text-primary-foreground` | Matches Phase 2 category filter active state |
| Filter chip (inactive) | `variant="outline"` — `border bg-background text-muted-foreground` | |
| Form input (default) | `bg-background border-input` | shadcn Input default |
| Form input (error) | `border-destructive focus-visible:ring-destructive` | Inline validation |
| Form input (disabled) | `bg-muted text-muted-foreground cursor-not-allowed` | Used on locked fields in edit mode |
| Kebab menu item (default) | `text-foreground hover:bg-accent hover:text-accent-foreground` | shadcn DropdownMenu default |
| Kebab menu item (destructive) | `text-destructive hover:bg-destructive/10 hover:text-destructive` | Delete, Close…, Demote |
| Kebab menu item (disabled) | `text-muted-foreground opacity-50 cursor-not-allowed` | Edit/Delete when `vote_count > 0` |
| Pin badge on card | `bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300` | Matches Phase 2 pinned banner palette |
| Null-resolution flag row | `border-l-2 border-amber-500` | Left border accent on admin rows where auto-closed but `resolution IS NULL` |
| Dropzone (idle) | `border-2 border-dashed border-input bg-muted/30` | Image upload tab |
| Dropzone (drag-over) | `border-primary bg-primary/5` | |
| Dropzone (error) | `border-destructive bg-destructive/5` | File too large, wrong MIME |
| Dialog overlay | `bg-black/50` | shadcn Dialog default |

### Color Distribution (Phase 4 confirmation)

- **60% dominant:** `background` — page background behind admin shell, form pages, dialog surfaces
- **30% secondary:** `card` + `muted` — tab content panels, form field backgrounds, table row hover, empty-state backgrounds
- **10% accent:** `primary` — reserved for:
  1. Active tab underline indicator (`/admin` tabs)
  2. Active filter chip fill (Suggestions tab: Active/Closed/All)
  3. Primary CTA button fills ("Create suggestion", "Save changes", "Promote admin")
  4. Dropzone drag-over highlight
  5. Focus ring on form inputs (carried from shadcn default)

**Primary is NOT used for:** inactive tabs, kebab menu items (except focus ring), form input borders in default state, table row backgrounds, pin badge (uses amber), resolution badges (use green/amber/neutral per Phase 2).

### Destructive Reserved For

Per phase: all confirmation dialogs for destructive actions, plus destructive kebab menu items. Specific list:
1. Delete suggestion (dialog + menu item) — pre-vote only
2. Demote admin (dialog + button) — never self
3. Delete category (dialog + button)
4. Manual close suggestion (dialog confirm button — semi-destructive, uses destructive styling because it's terminal)

---

## Component Inventory (Phase 4)

All components use shadcn/ui primitives. New components added this phase must run through the registry gate (see below). Existing Phase 1/2 components (Card, Button, Input, Sonner, DropdownMenu, Collapsible, Badge, Progress, Sheet) are reused.

### Visual Hierarchy & Focal Points

Each primary Phase 4 surface has an explicit first-glance anchor so the executor doesn't have to guess visual priority:

| Surface | Primary focal point | Why |
|---------|---------------------|-----|
| `/admin` → Suggestions tab (empty) | The `[+ Create suggestion]` primary CTA in the empty state | When there's nothing to manage, the only meaningful action is "create one". Empty-state CTA uses `primary` fill so it wins vs. surrounding neutral shell. |
| `/admin` → Suggestions tab (populated) | The topmost pinned row (📌 badge + row card), OR the first active row if nothing is pinned | Pinned = "admin judged this most important"; surfacing it first matches that intent. Filter chips and `[+ New suggestion]` sit above but are secondary — they're navigation, not content. |
| `/admin` → Categories tab | The `[+ New category]` button top-right of the list | Category CRUD is lightweight; the create affordance is the expected first action when the list is short. |
| `/admin` → Admins tab | The `[+ Promote admin]` button above the admin list | With 2-3 admins at launch, the list itself is low-information; the action to add another is the clear anchor. |
| `/admin/suggestions/new` and `/edit` | Page heading ("Create suggestion" / "Edit suggestion") + the Title input immediately below | Forms flow top-to-bottom; the heading sets context, the first required field is where fill-in actually begins. `text-2xl font-semibold` heading wins hierarchy against body-sized field labels. |
| Public `/topics` (pin-aware) | The topmost pinned card (📌 badge, elevated via sort order) | Phase 2's focal point was the first-active card; pinning now promotes admin-flagged rows above the default sort. No layout change — the sort itself surfaces the anchor. |

In all cases, `primary` color, larger type (`text-2xl font-semibold` for headings, `text-base font-medium` for primary CTAs), and sort order — not weight alone — carry the hierarchy. Within a tab, only ONE primary-filled button is visible at a time, so there's never ambiguity about "which is the main action here".

### 1. Navbar with Logo (D-03, app-wide)

Existing `src/components/layout/Navbar.tsx` gains a left-aligned WTCS logo. Applies to public and admin surfaces.

| Property | Value |
|----------|-------|
| Logo source | `src/assets/wtcs-logo.png` (9.9 KB, imported via `import logo from '@/assets/wtcs-logo.png'`) |
| Logo size | `h-8 w-auto` (32px tall) on mobile, `h-9` (36px) on `md+` |
| Logo placement | Leftmost element in navbar, followed by existing nav links. Wraps in `<Link to="/">` so clicking returns home. |
| Alt text | `"WTCS Community Suggestions"` |
| Touch target | Logo wrapper is `min-h-[44px] flex items-center` to meet WCAG 2.5.8 |
| Dark mode | No filter/invert — PNG has transparent background; if logo dark-mode variant is needed later, swap via CSS `dark:` modifier. For v1, single asset works across themes. |

### 2. Admin Shell (`/admin` tabbed page, D-01)

Replaces the existing `/admin/index.tsx` stub. Three tabs: Suggestions, Categories, Admins.

**Uses:** shadcn `Tabs` (new — install required).

| Property | Value |
|----------|-------|
| Wrapper | `<AdminGuard>` already present; wraps the whole page |
| Container | `max-w-4xl mx-auto px-4 md:px-6 py-6` |
| Page heading | `text-2xl font-semibold mb-6` — "Admin" |
| Tab layout | shadcn `Tabs` with `TabsList` horizontal, full-width on mobile |
| Tab trigger style | `text-sm font-medium px-4 py-2 min-h-[44px]`; active tab gets `border-b-2 border-primary text-foreground`; inactive tabs `text-muted-foreground` |
| Tab persistence | Active tab stored as URL search param `?tab=suggestions\|categories\|admins` so admins can deep-link |
| Default tab | `suggestions` |
| Tab content padding | `pt-6` on tab panel |
| Mobile responsive | Tab triggers stretch to equal width (`flex-1`) below `sm`; stacked label below 360px if needed (falls back to icon + label) |

### 3. Admin Suggestions Tab (D-16, D-20)

Filter chips + list of admin rows with kebab menu per row.

**Uses:** shadcn `Button` (chip variant), `DropdownMenu`, existing `SuggestionCard` patterns repurposed as `AdminSuggestionRow`.

| Property | Value |
|----------|-------|
| Filter chips container | `flex items-center gap-2 mb-4` |
| Filter chip (3 total) | "Active" / "Closed" / "All" — each a `Button` with chip styling (see color section) |
| Chip size | `h-8 px-3 rounded-full text-xs font-medium` |
| Default chip | "Active" (URL param `?filter=active`) |
| Filter persistence | URL query param `?filter=active\|closed\|all` |
| Row layout | Custom `AdminSuggestionRow` component — flex row, `p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors min-h-[72px]` |
| Row left content | Title (`text-sm font-medium`) on line 1; meta row (`text-xs text-muted-foreground`) on line 2 showing: category name • "{N} responses" • `closes_at` time remaining or `closed_at` date |
| Row right content | Pin indicator (if pinned): Lucide `Pin` 14px; status badge (Active/Closed); kebab trigger |
| Pin sort (D-19) | `ORDER BY is_pinned DESC, created_at DESC`. Pinned rows render first inside the filter result, above unpinned. |
| Null-resolution flag (D-15) | Rows where `status='closed' AND resolution IS NULL` render with `border-l-2 border-amber-500` left accent and a subtle tooltip on hover: "Needs resolution" |
| Kebab trigger | `Button variant="ghost" size="icon" className="h-11 w-11"` with Lucide `MoreVertical` 18px icon. `aria-label="Suggestion actions"` |
| Kebab menu items | See row below |
| Loading state | 3 skeleton rows: `h-[72px] bg-muted/30 animate-pulse rounded-md` |
| Empty state | See Empty States section |

**Kebab menu items (D-16):** In this order, separated by `<DropdownMenuSeparator/>` where noted:

1. **View results** — Lucide `BarChart3` 16px. Navigates to the public suggestion detail. Always enabled.
2. **Edit** — Lucide `Pencil` 16px. Navigates to `/admin/suggestions/:id/edit`. Disabled (greyed via `disabled` prop) when `vote_count > 0` (D-17). Tooltip on disabled: "Cannot edit after responses received."
3. **Pin / Unpin** — Lucide `Pin` / `PinOff` 16px. Toggles `is_pinned`. Always enabled.
4. *(separator)*
5. **Close…** — Lucide `Lock` 16px. Opens Resolution-on-Close dialog. Disabled if `status != 'active'`. Destructive styling.
6. **Set resolution…** — Lucide `Flag` 16px. Opens Resolution Picker dialog. Only enabled when `status = 'closed'`.
7. *(separator)*
8. **Delete** — Lucide `Trash2` 16px. Opens Delete Confirm dialog. Disabled (greyed) when `vote_count > 0` (D-18). Destructive styling. Tooltip on disabled: "Cannot delete after responses received."

### 4. Resolution-on-Close Dialog (D-15)

Modal that appears when admin clicks "Close…" on an active suggestion. Requires resolution before confirming.

**Uses:** shadcn `Dialog` (new — install required).

| Property | Value |
|----------|-------|
| Trigger | "Close…" kebab item |
| Title | "Close this suggestion?" (`text-lg font-semibold`) |
| Body text | `text-sm text-muted-foreground` — "Closing will stop accepting new responses. Choose a resolution status — this can be changed later." |
| Resolution picker | Three-button row (equal width, `grid grid-cols-1 sm:grid-cols-3 gap-2`): `Addressed` / `Forwarded` / `Closed` — each a `Button variant="outline"`; selected one switches to `variant="default"` |
| Button icons | Lucide `CheckCircle2` / `Send` / `XCircle` respectively, 16px, to the left of label |
| Footer actions | Secondary: "Cancel" (`variant="ghost"`). Primary: "Close suggestion" (`variant="destructive"`) — disabled until a resolution is selected. |
| Width | `sm:max-w-md` |
| Close on success | Dialog closes, Sonner toast confirms |

### 5. Resolution Picker Dialog (D-15, editable path)

Modal for editing resolution after close (or setting resolution on an auto-closed suggestion with `resolution IS NULL`).

| Property | Value |
|----------|-------|
| Title | "Set resolution status" |
| Body | Same three-button resolution picker as above. Current selection pre-highlighted. |
| Footer actions | "Cancel" / "Save" (`variant="default"`) — disabled until a change is made |

### 6. Delete Confirm Dialog (D-18)

Modal for hard-deleting a pre-vote suggestion.

| Property | Value |
|----------|-------|
| Title | "Delete this suggestion?" |
| Body | "This cannot be undone. The suggestion has no responses yet, so deleting is safe." |
| Footer | "Cancel" / "Delete permanently" (`variant="destructive"`) |

### 7. Suggestion Form Page (D-02, D-07..D-10, POLL-01..06)

Full-screen form at `/admin/suggestions/new` and `/admin/suggestions/:id/edit`. Single column, max-w-2xl.

**Uses:** shadcn `Input`, `Textarea` (new), `Label` (new), `Select` (new), `Tabs` (new — same install as admin shell), `Button`, `Dialog`.

| Section | Components & Layout |
|---------|---------------------|
| Page heading | `text-2xl font-semibold` — "New suggestion" or "Edit suggestion" |
| Back link | Lucide `ChevronLeft` 16px + "Back to admin" — `text-sm text-muted-foreground hover:text-foreground mb-4` |
| Form wrapper | `<form>` with `space-y-6` between sections |
| Title field | `Label` "Title" + `Input` (`maxLength=120`, required). Helper text: "Short and specific. What does the community think?" |
| Description field | `Label` "Description" + `Textarea` (`rows=5`, `maxLength=1000`). Helper text shows "{chars}/1000" right-aligned below textarea |
| Choices section | See Section 8 below |
| Image section | See Section 9 below |
| Timer section | See Section 10 below |
| Category section | See Section 11 below |
| Footer | Sticky on mobile (`sticky bottom-0 bg-background border-t py-4 px-4 -mx-4`) — two buttons: `Cancel` (`variant="ghost"`) left, `Create suggestion` / `Save changes` (`variant="default"` primary) right |
| Edit mode lock (D-17) | If editing and `vote_count > 0`, entire form is disabled (all inputs `disabled`), with a prominent info banner at the top: `bg-muted border rounded-md p-4 text-sm` — "This suggestion has received responses. Editing is locked. You can still close, pin, or change resolution from the admin list." |
| Validation | Inline `text-xs text-destructive` below each field on blur/submit. Submit button disabled until form is valid. |
| Submitting state | Submit button shows Lucide `Loader2` 16px `animate-spin` + "Saving…" text. Cancel remains enabled. |

### 8. Choices Editor (D-07)

Nested inside the Suggestion Form.

| Property | Value |
|----------|-------|
| Section label | "Choices" (`text-base font-semibold`) + helper `text-xs text-muted-foreground` "How should people respond? Minimum 2, maximum 10." |
| Preset row | `flex gap-2 mb-3` — two buttons: `[Yes/No]` and `[4-choice]`, each `variant="outline" size="sm"`. Clicking replaces existing choices (confirm dialog if any non-empty choices exist). |
| Preset button icons | Lucide `SquareCheck` 14px next to labels |
| Choices list | `space-y-2` vertical list |
| Choice row | `flex items-center gap-2` — `Input` (`flex-1`, `placeholder="Choice {n}"`, `maxLength=60`) + remove button (`Button variant="ghost" size="icon" h-10 w-10` with Lucide `Trash2` 16px, `aria-label="Remove choice {n}"`) |
| Remove disabled | When only 2 choices remain (minimum), remove buttons are disabled with tooltip "Minimum 2 choices required" |
| Add button | Below list, full width: `Button variant="outline" className="w-full h-10"` with Lucide `Plus` 16px + "Add choice". Disabled at soft cap (10 choices) with helper text "Maximum 10 choices." |
| Soft cap reached | Add button disabled + `text-xs text-muted-foreground` "Maximum 10 choices." below it |
| Duplicate validation | If two choices have identical text, the second gets `border-destructive` and inline error "Duplicate choice." |

### 9. Image Input (D-08)

Two-tab control: Upload or Paste URL.

**Uses:** shadcn `Tabs` (same install).

| Property | Value |
|----------|-------|
| Section label | "Image (optional)" (`text-base font-semibold`) |
| Tab list | Two tabs: `[Upload]` / `[Paste URL]`. Tab triggers: `text-sm font-medium h-10` |
| Upload tab content | Dropzone: `flex flex-col items-center justify-center border-2 border-dashed border-input rounded-md bg-muted/30 p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors min-h-[160px]` |
| Dropzone icon | Lucide `ImagePlus` 32px `text-muted-foreground mb-2` |
| Dropzone text | "Drop an image or click to upload" (`text-sm`) + helper "JPG, PNG, or WebP. Max 2 MB." (`text-xs text-muted-foreground mt-1`) |
| Dropzone drag-over | `border-primary bg-primary/5` |
| Dropzone error | `border-destructive bg-destructive/5` + error text below: "File too large" or "Unsupported format" |
| URL tab content | `Input type="url" placeholder="https://..."` with helper "Paste a direct image URL." Validation: must parse as URL + end in `.jpg/.jpeg/.png/.webp` or accept any URL with soft warning |
| Preview | After image set (either path): `flex items-center gap-3` — thumbnail (`w-24 h-16 rounded-md object-cover bg-muted`) + filename/URL truncated + `Button variant="ghost" size="sm"` "Clear" |
| Upload progress | During upload: thumbnail placeholder with Lucide `Loader2` `animate-spin` + `text-xs` "{percent}%" |

### 10. Timer Picker (D-09)

Three preset buttons + custom date/time picker.

**Uses:** shadcn `Button`, `Input type="datetime-local"` (native for v1 — avoids extra dependency).

| Property | Value |
|----------|-------|
| Section label | "Closes at" (`text-base font-semibold`) + helper "When should responses stop being accepted?" |
| Preset row | `flex gap-2` — three `Button variant="outline"` (size `h-10`): `[7 days]` / `[14 days]` / `[Custom]` |
| Selected preset | Switches to `variant="default"` (filled primary) |
| Custom reveal | Clicking `[Custom]` reveals an `Input type="datetime-local"` below the preset row with label "Close date and time" |
| Computed value stored | Always store the absolute `closes_at` timestamp in DB. Preset buttons compute `now() + 7d` / `now() + 14d` on click. |
| Display | Below selected preset/picker: `text-xs text-muted-foreground` — "Will close {relative time}, {absolute time in user locale}" (e.g., "Will close in 7 days, Apr 18, 2026 at 2:30 PM") |
| Validation | Custom date must be in the future. If past: `text-xs text-destructive` "Close time must be in the future." |

### 11. Category Picker (D-10)

Select dropdown with inline "Create new category…" action.

**Uses:** shadcn `Select` (new — install required), shadcn `Dialog` (reused for inline creation).

| Property | Value |
|----------|-------|
| Section label | "Category" (`text-base font-semibold`) + helper "Assign this suggestion to a category (optional)." |
| Select trigger | shadcn `SelectTrigger` `h-10` with placeholder "Select a category…" |
| Select items | Populated from `categories` table. Each item: `SelectItem` with category name. |
| Uncategorized option | First item: "Uncategorized" (value `null`) |
| Inline create action | Last item in dropdown: `SelectItem` with Lucide `Plus` 14px + "Create new category…" — clicking opens the inline-create dialog (does not submit a category selection) |
| Inline create dialog | Title "New category" + single `Input` field + Cancel / Create buttons. On success: dialog closes, new category auto-selected in the parent Select. |
| Error | If duplicate name: inline error in dialog `text-xs text-destructive` "Category already exists." |

### 12. Admin Suggestions Empty State

| Filter | Empty state |
|--------|-------------|
| Active, 0 rows | Icon: Lucide `Inbox` 40px. Heading: "No active suggestions." Body: "Create one to get started." Action: `Button` "Create suggestion" primary, links to `/admin/suggestions/new`. |
| Closed, 0 rows | Icon: Lucide `Archive` 40px. Heading: "No closed suggestions yet." Body: "Closed suggestions will appear here with their resolution status." |
| All, 0 rows | Same as "Active, 0 rows" (fresh install state) |

Container: `flex flex-col items-center justify-center py-16 text-center`. Heading: `text-lg font-medium text-foreground mt-4`. Body: `text-sm text-muted-foreground mt-1`.

### 13. Categories Tab (D-21)

Inline-editable list of categories.

**Uses:** shadcn `Button`, `Input`, `Dialog`.

| Property | Value |
|----------|-------|
| Header | `flex items-center justify-between mb-4` — section title "Categories" (`text-base font-semibold`) + `Button` "New category" (`variant="default"` size `sm` `h-9`) with Lucide `Plus` 14px |
| List | `divide-y` vertical list, each row `flex items-center justify-between p-4 min-h-[56px]` |
| Row default | Category name (`text-sm font-medium`) left; `flex gap-1` right with two icon buttons: Edit (Lucide `Pencil` 16px) and Delete (Lucide `Trash2` 16px, `text-destructive`) |
| Row edit mode | Input replaces label inline (`flex-1 mr-2`), two buttons right: Save (Lucide `Check` 16px, primary) / Cancel (Lucide `X` 16px, ghost) |
| Inline input | `h-9 text-sm`, auto-focus on enter edit mode, Enter submits, Escape cancels |
| New category flow | Clicking "New category" inserts a new blank row at top in edit mode |
| Delete dialog | Title "Delete category?" Body: "{N} suggestions will become uncategorized. This cannot be undone." Footer: Cancel / Delete (destructive). |
| Loading state | 4 skeleton rows `h-[56px] bg-muted/30 animate-pulse` |
| Empty state | Lucide `Folder` 40px + "No categories yet." + "Create one to organize suggestions." + primary action "New category" |

### 14. Admins Tab (D-04, D-05, D-06)

Admin list with promote-search dialog and demote buttons.

**Uses:** shadcn `Dialog`, `Input`, `Button`, existing avatar pattern from navbar.

| Property | Value |
|----------|-------|
| Header | `flex items-center justify-between mb-4` — "Admins" title + `Button` "Promote admin" primary (opens promote dialog) |
| Admin list | `divide-y` vertical, each row `flex items-center justify-between p-4 min-h-[64px]` |
| Row left content | Avatar (24px `rounded-full` from Discord) + name (`text-sm font-medium`) + Discord ID (`text-xs text-muted-foreground font-mono`) stacked |
| Row right content | Demote button `Button variant="outline" size="sm" h-9` with Lucide `UserMinus` 14px + "Demote". Destructive styling on hover. |
| Self-row | Demote button hidden (D-06 — UI guard). Row shows `text-xs text-muted-foreground italic` "You" badge instead. |
| Promote dialog | Title "Promote admin" |
| Dialog body | Two sections: (1) Search existing profiles, (2) Paste Discord ID (fallback) |
| Search section | Label "Search by Discord username" + `Input` with Lucide `Search` 14px left icon. Debounced 300ms. Min 2 chars. Max 10 results shown as list below. |
| Search result row | `flex items-center gap-2 p-2 hover:bg-accent rounded-md cursor-pointer min-h-[44px]` — avatar + name + `Button` "Promote" `size="sm"` |
| No results | `text-xs text-muted-foreground py-2 text-center` "No matches. Paste a Discord ID instead." |
| Paste ID section | `mt-4 pt-4 border-t` — Label "Or paste a Discord ID" + `Input` (placeholder `"e.g. 267747104607305738"`) + `Button` "Pre-authorize" |
| Pre-authorize helper | `text-xs text-muted-foreground` "The user becomes admin on their next sign-in." |
| Dialog width | `sm:max-w-md` |
| Demote confirm dialog | Title "Demote this admin?" Body: "{Username} will lose admin access immediately." Footer: Cancel / Demote (destructive) |
| Empty state | Not realistic (there's always at least 1 admin — the current user), but defensive: "No admins yet." |

### 15. Pin Badge on Public Suggestion Card (D-19)

Extends Phase 2 `SuggestionCard`. Already has pinned-banner; Phase 4 adds the 📌 badge variant used on the admin row AND on non-expanded public cards.

| Property | Value |
|----------|-------|
| Badge element | Small inline badge next to category badge on Row 1 |
| Style | `inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300` |
| Icon | Lucide `Pin` 12px |
| Label | "Pinned" |
| Where shown | Public topics list collapsed cards (supplements the amber banner shown on expanded pinned cards), and admin Suggestions tab rows (replaces the amber banner on compact rows) |

### 16. Sonner Toasts (extended for Phase 4)

All admin action feedback uses Sonner (already installed Phase 2). New toast messages:

| Action | Toast type | Message |
|--------|-----------|---------|
| Create suggestion success | success | "Suggestion created" |
| Create suggestion error | error | "Could not create suggestion. Try again." |
| Save edit success | success | "Suggestion updated" |
| Edit locked (server rejected) | error | "Cannot edit: responses already received." |
| Close success | success | "Suggestion closed" |
| Pin success | success | "Suggestion pinned" |
| Unpin success | success | "Suggestion unpinned" |
| Delete success | success | "Suggestion deleted" |
| Delete rejected (has votes) | error | "Cannot delete: responses already received." |
| Set resolution success | success | "Resolution updated" |
| Category create success | success | "Category created" |
| Category rename success | success | "Category renamed" |
| Category delete success | success | "Category deleted. {N} suggestions are now uncategorized." |
| Promote admin success | success | "{username} promoted to admin" |
| Pre-authorize success | success | "Discord ID pre-authorized. They become admin on next sign-in." |
| Demote admin success | success | "{username} demoted" |
| Demote self rejected | error | "Cannot demote yourself." |
| Generic server error | error | "Something went wrong. Try again." |
| Image upload success | success | "Image uploaded" |
| Image too large | error | "Image too large. Max 2 MB." |
| Image wrong format | error | "Unsupported format. Use JPG, PNG, or WebP." |

Duration: 3000ms auto-dismiss. Position: `bottom-center` on mobile, `bottom-right` on desktop (carried from Phase 2).

---

## Copywriting Contract

### Primary CTAs (Phase 4)

| Context | Copy |
|---------|------|
| Admin Suggestions tab header action | "Create suggestion" |
| Suggestion form submit (new) | "Create suggestion" |
| Suggestion form submit (edit) | "Save changes" |
| Admin Categories tab header action | "New category" |
| Admin Admins tab header action | "Promote admin" |
| Close-on-resolution dialog confirm | "Close suggestion" |
| Delete confirm dialog confirm | "Delete permanently" |
| Demote confirm dialog confirm | "Demote" |

### Navigation Copy

| Element | Copy |
|---------|------|
| Navbar logo alt text | "WTCS Community Suggestions" |
| Admin page heading | "Admin" |
| Admin tab: suggestions | "Suggestions" |
| Admin tab: categories | "Categories" |
| Admin tab: admins | "Admins" |
| Admin filter chip: active | "Active" |
| Admin filter chip: closed | "Closed" |
| Admin filter chip: all | "All" |
| Form heading (create) | "New suggestion" |
| Form heading (edit) | "Edit suggestion" |
| Back link | "Back to admin" |

### Form Field Labels & Helpers

| Field | Label | Helper |
|-------|-------|--------|
| Title | "Title" | "Short and specific. What does the community think?" |
| Description | "Description" | "{chars}/1000" (live counter, right-aligned) |
| Choices section | "Choices" | "How should people respond? Minimum 2, maximum 10." |
| Choice input | (no visible label, placeholder only) | placeholder: "Choice {n}" |
| Image section | "Image (optional)" | (none — dropzone text speaks for itself) |
| Dropzone idle | (no label) | "Drop an image or click to upload" + "JPG, PNG, or WebP. Max 2 MB." |
| URL input | "Image URL" | "Paste a direct image URL." |
| Timer section | "Closes at" | "When should responses stop being accepted?" |
| Timer custom input | "Close date and time" | (native datetime hint) |
| Timer computed display | (inline) | "Will close {relative}, {absolute locale}" |
| Category section | "Category" | "Assign this suggestion to a category (optional)." |
| Category placeholder | (Select trigger) | "Select a category…" |

### Empty State Copy

| Surface | Heading | Body | Action |
|---------|---------|------|--------|
| /admin Suggestions (Active, 0 rows) | "No active suggestions." | "Create one to get started." | "Create suggestion" |
| /admin Suggestions (Closed, 0 rows) | "No closed suggestions yet." | "Closed suggestions will appear here with their resolution status." | (none) |
| /admin Categories (0 rows) | "No categories yet." | "Create one to organize suggestions." | "New category" |
| /admin Admins (unreachable) | "No admins yet." | "Promote an admin to get started." | "Promote admin" |
| Promote dialog: search no results | (inline) "No matches. Paste a Discord ID instead." | | |

### Error State Copy

| Context | Copy |
|---------|------|
| Title too long | "Title must be 120 characters or fewer." |
| Title empty | "Title is required." |
| Description too long | "Description must be 1000 characters or fewer." |
| Fewer than 2 choices | "At least 2 choices required." |
| Duplicate choice | "Duplicate choice." |
| Choice empty | "Choice cannot be empty." |
| Close time in past | "Close time must be in the future." |
| Image too large | "File too large. Max 2 MB." |
| Image wrong format | "Unsupported format. Use JPG, PNG, or WebP." |
| Invalid image URL | "Must be a valid image URL." |
| Invalid Discord ID | "Discord ID must be a numeric snowflake (17–19 digits)." |
| Duplicate category | "Category already exists." |
| Edit locked info banner | "This suggestion has received responses. Editing is locked. You can still close, pin, or change resolution from the admin list." |
| Server generic | "Something went wrong. Try again." |
| Not authorized (non-admin) | "You do not have permission to perform this action." |

### Destructive Confirmation Copy (all destructive actions require confirm)

| Action | Dialog title | Dialog body | Primary button |
|--------|-------------|-------------|----------------|
| Delete suggestion | "Delete this suggestion?" | "This cannot be undone. The suggestion has no responses yet, so deleting is safe." | "Delete permanently" |
| Close suggestion (manual) | "Close this suggestion?" | "Closing will stop accepting new responses. Choose a resolution status — this can be changed later." | "Close suggestion" |
| Delete category | "Delete category?" | "{N} suggestions will become uncategorized. This cannot be undone." | "Delete category" |
| Demote admin | "Demote this admin?" | "{username} will lose admin access immediately." | "Demote" |
| Preset choice overwrite | "Replace existing choices?" | "Using this preset will clear your current choices. Continue?" | "Replace" |

### Terminology Enforcement (Phase 4 specific)

- Admin UI uses **"Suggestions"** as the tab label and primary noun, not "Polls". Internal code/types may continue to use `polls` table name.
- Admin UI uses **"responses"** in public-facing copy paths (counts on cards) but **"responses"** also in admin row meta — the `/admin` surface is still read by admins who may share screenshots; "vote" never surfaces in admin strings even though the `votes` table is referenced in code.
- Exception: database error envelopes may include `poll_id` in log contexts; these never surface to UI.
- "Close" and "Closed" are the only terminal-state verbs. Never "Finalize", "Decide", or "Conclude".

---

## Interaction States

### /admin Page Load

| State | What the admin sees |
|-------|---------------------|
| Initial load | Tabs with default "Suggestions" active, filter chip "Active" selected, 3 skeleton rows loading |
| Suggestions loaded, 0 rows (Active) | Empty state with "Create suggestion" CTA |
| Suggestions loaded, N rows | List with pinned rows at top, then by `created_at DESC` |
| Tab switch | URL param updates, content re-renders, no full page reload |
| Filter chip change | URL param updates, list re-filters (client-side if dataset small, otherwise refetch) |

### Suggestion Create Flow

| State | What the admin sees |
|-------|---------------------|
| Entry (click "Create suggestion") | Navigate to `/admin/suggestions/new` |
| Form load | Empty form, Title field auto-focused |
| Preset click (choices) | Choices list pre-filled; if existing non-empty choices, overwrite-confirm dialog first |
| Image upload in progress | Thumbnail placeholder with spinner + percent |
| Image upload success | Thumbnail with filename + Clear button |
| Submit click | Button shows spinner, all inputs disabled |
| Submit success | Toast "Suggestion created", navigate back to `/admin?tab=suggestions&filter=active` |
| Submit error | Toast "Could not create suggestion. Try again.", button re-enabled |
| Validation fail | Inline errors under fields, focus moves to first error |

### Suggestion Edit Flow

| State | What the admin sees |
|-------|---------------------|
| Entry (click Edit in kebab) | Navigate to `/admin/suggestions/:id/edit` |
| Load (pre-vote) | Form populated with current values, all fields enabled |
| Load (post-vote, locked) | Form populated but all fields disabled, prominent info banner at top |
| Submit click | Same as create |
| Server rejects (race: vote came in between load and submit) | Toast "Cannot edit: responses already received.", redirect to `/admin` |

### Close Flow

| State | What the admin sees |
|-------|---------------------|
| Kebab "Close…" click | Resolution-on-Close dialog opens |
| No resolution selected | "Close suggestion" button disabled |
| Resolution selected | "Close suggestion" enabled |
| Confirm click | Button spinner, dialog closes on success |
| Success | Toast "Suggestion closed", row re-renders with Closed status badge |

### Pin Flow

| State | What the admin sees |
|-------|---------------------|
| Kebab "Pin" click | Immediate optimistic update: row moves to top + badge appears |
| Success | Toast "Suggestion pinned" |
| Server error | Row reverts, toast "Something went wrong. Try again." |

### Delete Flow

| State | What the admin sees |
|-------|---------------------|
| Kebab "Delete" click (enabled) | Delete Confirm dialog |
| Confirm click | Spinner, row removed on success |
| Success | Toast "Suggestion deleted" |
| Kebab "Delete" click (disabled) | Tooltip "Cannot delete after responses received." |

### Category CRUD

| State | What the admin sees |
|-------|---------------------|
| New category click | Blank row appears at top in edit mode, Input auto-focused |
| Rename click | Row switches to edit mode, Input pre-filled with current name, auto-focused |
| Save (Enter or check) | Row returns to read mode with new name |
| Cancel (Escape or X) | Row reverts |
| Delete click | Delete confirmation dialog with count of affected suggestions |
| Delete success | Row removed, toast with count |

### Admin Promote Flow

| State | What the admin sees |
|-------|---------------------|
| Promote admin click | Dialog opens, Search input auto-focused |
| Search typing (< 2 chars) | No results shown yet |
| Search typing (>= 2 chars) | Debounced 300ms, then results populate (max 10) |
| Result click Promote | Row shows spinner, dialog closes on success |
| Paste ID + Pre-authorize | Validates numeric snowflake, submits, dialog closes on success |
| Success (existing user) | Toast "{username} promoted to admin", admin list refreshes |
| Success (pre-auth) | Toast "Discord ID pre-authorized. They become admin on next sign-in." |

### Admin Demote Flow

| State | What the admin sees |
|-------|---------------------|
| Demote click (other admin) | Demote confirm dialog |
| Confirm click | Spinner, row removed on success |
| Self-demote (server fallback) | Toast "Cannot demote yourself." (UI already hides the button) |

### Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `md` and up (>= 768px) | Admin content `max-w-4xl`, form content `max-w-2xl`, tab triggers natural width, form footer non-sticky |
| Below `md` (< 768px) | Full-width with `px-4`, tab triggers stretch equal-width, form footer sticky to bottom with top border |
| Below `sm` (< 640px) | Resolution picker dialog stacks buttons vertically (`grid-cols-1`), promote dialog takes full width |

---

## Accessibility Contract

Carries forward Phase 1 + Phase 2 accessibility. New Phase 4 requirements:

| Requirement | Implementation |
|-------------|----------------|
| Admin tabs | shadcn `Tabs` built on Radix uses `role="tablist"`, `role="tab"`, `aria-selected`, arrow-key navigation. Inherited. |
| Kebab menu | `DropdownMenu` trigger has `aria-label="Suggestion actions"`. Menu items are keyboard-navigable (arrow keys, Enter to activate, Escape to close). |
| Kebab menu disabled items | Use `disabled` prop so Radix applies `aria-disabled="true"` and skips focus. |
| Form labels | Every `Input`, `Textarea`, `Select` has an associated `Label` via `htmlFor` + `id`. |
| Inline errors | Errors use `role="alert"` and are referenced via `aria-describedby` from the input. |
| Dropzone | Has `role="button"` and `tabIndex={0}`, `aria-label="Upload image"`. Activates on Enter/Space. Native file input is visually hidden but focusable. |
| Dialogs | shadcn `Dialog` built on Radix: focus trapped, Escape closes, `aria-labelledby` + `aria-describedby`. |
| Destructive confirmation | Destructive primary button has `data-variant="destructive"` + receives initial focus (per Radix default), so keyboard users confirm with Enter — but destructive copy is clear enough that this is not a footgun. |
| Toast notifications | Sonner uses `role="status"` and `aria-live="polite"`. Destructive variants use `aria-live="assertive"`. |
| Admin list rows | Row is not a button; row-level actions live in the explicit kebab button, so row is `role="listitem"` inside `role="list"`. |
| Filter chips | `role="tablist"` wrapper with `role="tab"` chips + `aria-selected`, arrow-key nav. |
| Form submit while loading | Submit button has `aria-busy="true"` and `aria-disabled="true"`. |
| Reduced motion | `prefers-reduced-motion: reduce` disables dialog slide animation, kebab open/close animation, toast slide. Skeletons keep opacity pulse (not transform). |
| Image alt | Suggestion image rendered in form preview has alt text derived from filename or "Suggestion image". Final alt on public card is "Illustration for: {title}". |
| Keyboard form nav | Tab order: Title → Description → Preset buttons → Choice 1 → Remove 1 → Choice 2 → Remove 2 → … → Add choice → Image tabs → Image content → Timer presets → Custom input → Category select → Cancel → Submit |

---

## Registry Safety

### Existing Components (from Phase 1 + Phase 2)

| Component | Status |
|-----------|--------|
| Button | Installed |
| Card | Installed |
| Badge | Installed |
| Collapsible | Installed |
| DropdownMenu | Installed |
| Input | Installed |
| Progress | Installed |
| Sheet | Installed |
| Sonner | Installed |

### New Components (Phase 4)

| Registry | Component | Safety Gate |
|----------|-----------|-------------|
| shadcn official | Tabs | PASS — official shadcn/ui, no vetting required |
| shadcn official | Dialog | PASS — official shadcn/ui, no vetting required |
| shadcn official | Label | PASS — official shadcn/ui, no vetting required |
| shadcn official | Textarea | PASS — official shadcn/ui, no vetting required |
| shadcn official | Select | PASS — official shadcn/ui, no vetting required |
| Third-party | none | not applicable |

**Install command:** `npx shadcn@latest add tabs dialog label textarea select`

**Note:** Only official shadcn/ui components. No third-party registries declared for this phase. Registry vetting gate: not applicable.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: pending
- [ ] Dimension 2 Visuals: pending
- [ ] Dimension 3 Color: pending
- [ ] Dimension 4 Typography: pending
- [ ] Dimension 5 Spacing: pending
- [ ] Dimension 6 Registry Safety: pending

**Approval:** pending
