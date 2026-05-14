---
phase: 12
slug: admin-ui-user-ui-uidn-03-sweep
status: approved
shadcn_initialized: true
preset: new-york / Neutral baseColor (per components.json)
created: 2026-05-12
reviewed_at: 2026-05-12
---

# Phase 12 — UI Design Contract

> Visual and interaction contract for the **Admin UI + User UI + UIDN-03 Sweep** phase. Extends the locked design system established across Phases 1, 2, 4, 5, 6. Built on the WTCS Design System Brief (`.planning/DESIGN-SYSTEM.md`), Phase 12 CONTEXT (`12-CONTEXT.md` — Decisions A1-D1 through A8-D19), and Phase 11 EF contract (`toggle-results-visibility`, idempotent + race-safe).

This phase touches three visible surfaces:
1. **Admin creation form** — `SuggestionForm` gains VIS-06 "Hide results from voters" checkbox.
2. **Admin suggestion list** — `AdminSuggestionRow` gains VIS-07 inline Switch + optimistic toast.
3. **Public/voter UI** — `SuggestionCard` gains VIS-08 hidden-state Alert in the results slot.

Plus the **UIDN-03 four-site native-button sweep** (`SearchBar.tsx:22`, `SuggestionForm.tsx:140 + :163`, `ImageInput.tsx:108`) co-lands in the same touched files.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (new-york style, per `components.json`) |
| Preset | Neutral baseColor, Neutral theme — `components.json` is canonical (ADR-001) |
| Component library | shadcn/ui + Radix primitives |
| Icon library | Lucide React |
| Font (heading + body) | Inter (declared in `src/index.css` body rule) |

**Design direction:** "Warm neutral" — Linear-meets-Discord information density. Phase 12 adds no new design direction; every new affordance composes from existing shadcn primitives and the established color token set.

**Terminology rule (hard, inherited):**
- Public/voter surfaces: "suggestions", "topics", "responses", "community sentiment", **"voters"** ONLY inside the locked VIS-08 copy phrase ("hidden by admin"). Otherwise "voters" stays out of user-facing strings; prefer "people who responded".
- Admin surfaces: internal "poll", "vote" terminology permitted (REQUIREMENTS.md uses "polls" in code, "suggestions" in user copy). VIS-06 checkbox helper text uses "voters" because it is admin-facing and the REQUIREMENTS-verbatim copy ("Hide results from voters") is locked.

**Continuity:** This spec extends `01-UI-SPEC.md`, `02-UI-SPEC.md`, `04-UI-SPEC.md`. All prior tokens, spacing, typography, and color decisions carry forward unchanged. Only Phase 12 additions are specified below.

---

## Spacing Scale

Carries forward the Tailwind 4px base. Phase 12 adds no new spacing tokens — every new element uses existing scale values:

| Tailwind | Value | Phase 12 usage |
|----------|-------|----------------|
| `gap-1` | 4px | Switch label-icon gap on sub-`sm` (Eye/EyeOff + state) |
| `gap-2` | 8px | Switch-to-kebab gap on `AdminSuggestionRow` right cluster; Checkbox-to-Label gap on VIS-06 row |
| `gap-3` | 12px | Vertical space between VIS-06 checkbox row and the `CategoryPicker` row above (`space-y-3` inside form section) |
| `p-4` | 16px | `Alert` internal padding for VIS-08 hidden-state message (shadcn default) |
| `p-5` | 20px | Card padding (carried from Phase 2 SuggestionCard; the Alert renders inside this padding, in the slot where `<ResultBars>` would render) |
| `space-y-2` | 8px | Vertical rhythm inside the VIS-06 checkbox section (Label + helper text below) |
| `space-y-6` | 24px | Vertical rhythm between SuggestionForm sections (Visibility section is a new vertical block in this rhythm) |
| `min-h-[44px]` | 44px | Touch target — applies to the **wrapping label/click region** around the Switch on `AdminSuggestionRow`; the Switch primitive itself is shadcn's default smaller pill but the label+switch cluster meets WCAG 2.5.8 |
| `min-h-[44px]` | 44px | Same constraint for the VIS-06 Checkbox: the click region around the Label + Checkbox is ≥ 44px tall on mobile |
| `h-9` | 36px | DropZone inner Browse button (`Button variant="outline" size="sm"`) — matches the Phase 4 form-secondary button height |

**Drop-zone (UIDN-03 D-13) container sizing carries forward from Phase 4 §9:** `flex flex-col items-center justify-center border-2 border-dashed border-input rounded-md bg-muted/30 p-8 text-center min-h-[160px]`. Inner Browse button is added inside this same container; container dimensions unchanged.

**Exceptions:** none beyond inherited Phase 2 `py-0.5` for badges.

---

## Typography

Extends Phase 1 + Phase 2 + Phase 4. Phase 12 introduces **zero new sizes**. Every new string composes from the inherited 4-size set: `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-2xl` (24px).

| Role | Tailwind class | Phase 12 usage |
|------|---------------|----------------|
| Field label | `text-sm font-medium` | VIS-06 checkbox label "Hide results from voters" |
| Helper text | `text-xs text-muted-foreground` | VIS-06 helper "Voters with responses will see a placeholder instead of counts. Toggle anytime from the admin list." |
| Switch action label | `text-sm font-medium` | "Hide results" / "Show results" inline on `AdminSuggestionRow` right cluster (visible on `sm+`; hidden under `sm` per D-07) |
| Alert title | `text-sm font-medium text-foreground` | VIS-08 hidden-state Alert title — "Results temporarily hidden by admin" (shadcn `Alert` default sizing) |
| Voter's-choice line | `text-sm text-muted-foreground` | "Your response: {label}" above the Alert per D-10 |
| Toast copy | inherited from Phase 4 sonner defaults | "Results hidden for: {title}" / "Results visible for: {title}" |

**2 explicit font weights:** `font-medium` (500), `font-semibold` (600). Regular (400) is the implicit default. No new weights introduced.

**Line heights:** Tailwind defaults. No overrides for Phase 12.

**Constraints (inherited, reaffirmed):**
- No `text-xs` below 12px
- No ALL CAPS (inherited Phase 2 category-pill carveout remains the only exception)
- The locked VIS-08 copy "Results temporarily hidden by admin" is rendered as Alert title, not heading-level — preserves Phase 2 SuggestionCard hierarchy where the suggestion title (`text-lg font-medium`) remains the card's primary type element.

---

## Color

Carries forward Phase 1 + Phase 2 + Phase 4 shadcn semantic tokens. No new raw colors introduced — Phase 12 composes from existing tokens only.

### New Phase 12 Color Applications

| Element | Tokens | Notes |
|---------|--------|-------|
| VIS-08 hidden-state Alert | `bg-card border` (shadcn `Alert` default, variant `default`) | Sits in the same vertical slot as `<ResultBars>`; renders inside the SuggestionCard's `bg-card` so the Alert blends into the card surface |
| VIS-08 EyeOff icon | `text-muted-foreground` | Lucide `EyeOff` 16px adjacent to the Alert title; neutral, not destructive — the hidden state is admin policy, not an error |
| Voter's-choice line (D-10) | `text-muted-foreground` | "Your response: {label}" — muted treatment so it doesn't compete with the Alert title |
| VIS-07 Switch (on / visible) | `bg-primary` (shadcn `Switch` default checked state) | "Results currently visible" — Switch sits in the ON position when `results_hidden = false` (mirrors current state per D-06) |
| VIS-07 Switch (off / hidden) | `bg-input` (shadcn `Switch` default unchecked state) | "Results currently hidden" — Switch sits OFF when `results_hidden = true` |
| VIS-07 inline Loader2 (D-02) | `text-muted-foreground` | `Loader2 className="animate-spin h-4 w-4"` adjacent to the Switch while EF call is in-flight; Switch is `disabled` during this state |
| VIS-07 sub-`sm` Eye/EyeOff (D-07) | `text-foreground` (visible state) / `text-muted-foreground` (hidden state) | Lucide `Eye` when currently visible, `EyeOff` when currently hidden; renders **instead of** the full action label below the `sm` breakpoint |
| VIS-06 Checkbox (unchecked default) | `bg-background border-input` (shadcn `Checkbox` default) | Renders identically to existing form Inputs |
| VIS-06 Checkbox (checked) | `bg-primary text-primary-foreground` | Carries the primary fill on check; matches shadcn `Checkbox` default for the active state |
| UIDN-03 SearchBar X (D-15) | inherits `Button variant="ghost" size="icon"` tokens | No color change — visual parity with existing ghost icon buttons |
| UIDN-03 SuggestionForm back link (D-14) | inherits Phase 4 back link tokens: `text-sm text-muted-foreground hover:text-foreground` | TanStack `<Link>` styled identically to the prior `<button>` — visual zero-delta |
| UIDN-03 DropZone Browse button (D-13) | `Button variant="outline" size="sm"` tokens | Matches Phase 4 form-secondary button styling |
| UIDN-03 DropZone error border (inherited) | `border-destructive bg-destructive/5` | Carried from Phase 4 §9 Dropzone error state — unchanged in Phase 12 |

### Color Distribution (Phase 12 confirmation)

- **60% dominant:** `background` — page background, form pages, admin shell. Unchanged.
- **30% secondary:** `card` + `muted` — SuggestionCard surface (Alert renders inside this), AdminSuggestionRow `bg-card` row, form field backgrounds. Unchanged.
- **10% accent:** `primary` — reserved for the inherited Phase 4 list (active tab underline, active filter chip fill, primary CTA fills, dropzone drag-over, focus rings). **Phase 12 adds two new accent applications:**
  1. **VIS-06 Checkbox checked state** — `bg-primary` fill on the small (`h-4 w-4`) checkbox, only when admin opts in at creation. Low visual weight per pixel-coverage.
  2. **VIS-07 Switch ON state** — `bg-primary` on the Switch track when `results_hidden = false`. Always-visible across the admin list, but each Switch is small (`h-5 w-9` shadcn default). Admin reads list state at a glance via the binary on/off accent.

**Primary is NOT used for:** the VIS-08 hidden-state Alert (uses `bg-card`/neutral — the hidden state is informational, not an alert worth pulling primary attention), the EyeOff icon (neutral muted), the in-flight Loader2 (muted), the Switch in OFF state (neutral input), or the voter's-choice line (muted).

### Destructive Reserved For

Phase 12 introduces **no new destructive actions**. The Switch toggle is non-destructive (two-way per VIS-02; admins can re-flip at any time). Toast failures use Sonner's default error styling — same as the inherited Phase 4 error toasts. The Phase 4 destructive list is unchanged.

**Specifically NOT destructive:**
- VIS-07 Switch flip (either direction): non-destructive, two-way, audited but never irreversible.
- VIS-06 Checkbox at create: optional toggle, default unchecked, no consequence beyond initial row state which can be flipped later.

---

## Component Inventory (Phase 12)

All components are shadcn/ui primitives. Two new primitives must be vendored. UIDN-03 sweep extracts one new local component (`DropZone`) and uses existing `Button` + `Link` primitives at the other three sites.

### Visual Hierarchy & Focal Points

| Surface | Primary focal point | Why |
|---------|---------------------|-----|
| `SuggestionForm` (create) with Phase 12 additions | Page heading ("New suggestion") + Title input — **unchanged from Phase 4** | VIS-06 checkbox slots into the existing top-to-bottom form flow; it is a tertiary affordance, sitting below `CategoryPicker`, not a focal point. Default unchecked = visually identical to prior form at first glance. |
| `/admin?tab=suggestions` populated | Topmost pinned row — **unchanged from Phase 4** | VIS-07 Switch is a per-row inline control, not a header-level action. It supplements the row's existing kebab menu; it does not steal visual hierarchy from the pinned-row anchor. |
| Voter `SuggestionCard` with `results_hidden = true` AND voter has voted | The `<Alert>` block replacing `<ResultBars>` | This IS the focal point of the hidden state — the voter cast their response and is being told why they don't see counts. EyeOff icon + the locked copy carry the meaning. The voter's-choice line above (D-10) is supportive context. |
| Voter `SuggestionCard` with `results_hidden = false` OR voter has not voted | **Unchanged from Phase 2** — either `<ResultBars>` or `<ChoiceButtons>` per existing branch | The hidden state is the only Phase 12 voter-side variant; the visible state and the not-voted state render identically to v1.0. |

Hierarchy preservation: the SuggestionCard's title (`text-lg font-medium`, Phase 2) remains the card's top-line element in every state. The VIS-08 Alert title (`text-sm font-medium`) does not compete with the card title.

### 1. VIS-06 Visibility Checkbox on `SuggestionForm` (D-17)

Adds a single-row vertical block to `SuggestionForm.tsx`, slotted **below** the `CategoryPicker` section (D-17 locks placement).

**Uses:** shadcn `Checkbox` (NEW — vendor via `npx shadcn@latest add checkbox`); existing shadcn `Label`.

| Property | Value |
|----------|-------|
| Section wrapper | `<div className="space-y-2">` — matches the existing form-section vertical rhythm |
| Row layout | `<div className="flex items-start gap-2 min-h-[44px]">` — Checkbox + Label inline; min touch target ≥ 44px on mobile |
| Checkbox | `<Checkbox id="results-hidden" checked={...} onCheckedChange={...} />` (shadcn default sizing `h-4 w-4`) |
| Label | `<Label htmlFor="results-hidden" className="text-sm font-medium cursor-pointer">Hide results from voters</Label>` (REQUIREMENTS-verbatim copy) |
| Helper text | Below the row: `<p className="text-xs text-muted-foreground">Voters with responses will see a placeholder instead of counts. Toggle anytime from the admin list.</p>` |
| Default state | unchecked (`results_hidden = false`) — backwards-compat default per VIS-01 |
| Hidden in edit mode | NO — VIS-02 allows any-lifecycle flip; the checkbox renders in edit mode too. In edit mode it pre-populates from the current row's `results_hidden` value. If `vote_count > 0`, the edit form is locked entirely (existing Phase 4 D-17 behavior — checkbox is also disabled in that lock state); admins flip via the Switch in the admin list instead. |
| Submit wiring | `useCreatePoll` extension: passes `results_hidden?: boolean` to the EF body. Create-poll EF already accepts it (Phase 11 D-08). |
| ARIA | Native `<input type="checkbox">` semantics via shadcn `Checkbox` primitive (Radix-backed); Label has `htmlFor`. No extra `aria-describedby` needed — helper text is decorative. |

### 2. VIS-07 Inline Switch on `AdminSuggestionRow` (D-05, D-06, D-07)

Adds a state-mirroring Switch + label cluster to the right side of `AdminSuggestionRow`, sitting **between** the response-count text and the kebab menu (D-05 locks placement: not inside the kebab menu).

**Uses:** shadcn `Switch` (NEW — vendor via `npx shadcn@latest add switch`); Lucide `Eye`, `EyeOff`, `Loader2`.

| Property | Value |
|----------|-------|
| Row layout change | Existing row is `flex items-start justify-between gap-3 p-4 min-h-[72px]`. The right cluster becomes a flex container holding: `<VisibilitySwitch />` + existing `<SuggestionKebabMenu />`. The two right-side controls sit in `<div className="flex items-center gap-2 shrink-0">`. |
| Switch wrapper | `<label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer select-none">` — wraps Switch + label for keyboard + click ergonomics + WCAG touch target |
| Switch primitive | `<Switch checked={!resultsHidden} onCheckedChange={handleToggle} disabled={isPending} aria-label={'Results currently ' + (resultsHidden ? 'hidden' : 'visible')} />` — D-06 mirrors current state: **ON = visible, OFF = hidden** |
| Switch action label (≥ `sm`) | `<span className="hidden sm:inline text-sm font-medium">{resultsHidden ? 'Show results' : 'Hide results'}</span>` — D-06 action-form, two-state (locks REQUIREMENTS VIS-07 verbiage) |
| Switch icon (< `sm`) | `<span className="sm:hidden inline-flex">{resultsHidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-foreground" />}</span>` — D-07 mobile-only icon, no label below 640px |
| In-flight Loader (D-02) | `{isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}` — renders adjacent to the Switch while the EF call is in-flight; Switch is `disabled` during this state to prevent double-click no-op noise in `audit_log` |
| Coexistence with `needsResolution` flag (D-08) | Switch renders identically regardless of resolution state. Even on a closed-with-null-resolution row (amber left border, "Needs resolution" pill), the Switch coexists in the right cluster without layout change. |
| Optimistic flip (D-01) | On click, local state flips immediately; EF call runs in background; on success, no UI change (state already matches). On failure, revert local state, show error toast. Matches the `usePinPoll` precedent. |
| Toast success copy (D-03) | `'Results hidden for: {title}'` when hiding; `'Results visible for: {title}'` when showing. Sonner via the existing toast singleton. |
| Toast error copy (D-03) | `'Could not update visibility. Try again.'` — matches existing Phase 4 generic admin-error tone (no exclamation, actionable) |
| Audit-log surface (D-04) | Silent — no tooltip, no toast suffix, no UI indicator. `audit_log` is a backend forensics surface in v1.2. |
| ARIA | Switch has `aria-label` reflecting current state (not next state — Radix convention so screen readers announce what is currently true). Wrapping `<label>` provides clickable label area. `aria-busy="true"` on the Switch during in-flight. |

### 3. VIS-08 Hidden-state Alert in `SuggestionCard` (D-09, D-10, D-12)

Adds a branch inside `SuggestionCard.tsx` between the existing `userChoiceId ? <ResultBars> : <ChoiceButtons>` ternary. The new branch fires when **both** conditions hold: `userChoiceId` is set (voter has voted) AND `resultsHidden === true`.

**Uses:** shadcn `Alert` (EXISTING — vendored at `src/components/ui/alert.tsx`, currently used in `SuggestionForm` error state); Lucide `EyeOff`.

| Property | Value |
|----------|-------|
| Branch precedence | New three-way ternary effectively: `userChoiceId && resultsHidden ? <HiddenAlert /> : userChoiceId ? <ResultBars /> : <ChoiceButtons />`. Planner picks the exact JSX expression. |
| Voter's-choice line (D-10) | Above the Alert: `<p className="text-sm text-muted-foreground">Your response: <span className="text-foreground font-medium">{label}</span></p>` where `label` is the choice text the voter selected. Resolves the choice from `userChoiceId` against the suggestion's choices array. |
| Alert variant | shadcn `Alert` default variant (neutral `bg-card border` per the existing alert.tsx); NOT `destructive` variant (the hidden state is policy, not error) |
| Alert icon | `<EyeOff className="h-4 w-4" />` — passed as the icon slot in the Alert children (matches the existing `<Alert>` pattern used in `SuggestionForm` which renders an icon inline) |
| Alert title | `<AlertTitle>Results temporarily hidden by admin</AlertTitle>` — **LOCKED COPY per VIS-08 + D-12** (uniform across live and archived per D-12) |
| Alert description | None. Title alone carries the meaning. Avoid over-explaining; voter context (Your response above) makes the situation legible. |
| Spacing | `<div className="space-y-3">` wrapping the voter's-choice line + the Alert, replacing the slot where `<ResultBars />` would render. Maintains the existing card section rhythm. |
| Live updates (D-11) | When admin flips from hidden → visible, the voter's next `useVoteCounts` poll cycle (~8s) returns `results_hidden = false`; the branch falls back to `<ResultBars />` automatically. No page reload needed. The reverse direction works the same. |
| Archive view (inherited) | Archive uses the same `SuggestionCard` per Phase 2 architecture; no archive-specific component. The Alert renders identically on archived polls (D-12 locks the copy). |

### 4. UIDN-03 Sweep — Four Native-Button Replacements

**4a. `SearchBar.tsx:22` — clear-X button (D-15)**

Replaces a native `<button>` with shadcn `<Button>`.

| Property | Value |
|----------|-------|
| Primitive | `<Button variant="ghost" size="icon" type="button" onClick={() => onChange('')} aria-label="Clear search">` |
| Icon | `<X className="h-4 w-4" />` (Lucide; existing import) |
| Sizing | `size="icon"` gives shadcn default `h-9 w-9`. Planner verifies against the `h-10` Input — may bump to a custom `className="size-8"` if visual fit demands. |
| Placement | Inside the SearchBar relative wrapper, absolutely positioned per existing layout (no layout change beyond swapping the element) |
| Hover state | inherits Button `variant="ghost"` hover token (`hover:bg-accent hover:text-accent-foreground`) — same hover behavior as the existing native `<button>` |
| Show/hide rule | Existing rule unchanged: rendered only when `query.length > 0` |

**4b. `SuggestionForm.tsx:140` and `SuggestionForm.tsx:163` — "Back to admin" links (D-14)**

Replaces two imperative `<button onClick={() => navigate(...)}>` patterns with declarative TanStack `<Link>`. Preserves middle-click / cmd-click / right-click → "Open in new tab" semantics that native buttons cannot provide.

| Property | Value |
|----------|-------|
| Primitive | `<Link to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">` (TanStack Router `Link`) |
| Children (inline-flex span layout preserved) | `<ChevronLeft className="h-4 w-4 mr-1" />Back to admin` |
| Search param disposition (Claude's discretion per D-14) | Planner verifies whether to add `search={{ tab: 'suggestions' }}` for context consistency with the admin shell. If unset, link routes to the default tab — acceptable. |
| Type preservation | The replaced `<button>` had no `type="submit"` — these are pure navigation triggers, so no form-submit regression risk. The two sites at lines 140 and 163 are both "Back to admin" in distinct render paths. |
| Visual delta | Zero — `<Link>` styled identically to the prior `<button>` text. |

**4c. `ImageInput.tsx:108` — DropZone trigger (D-13)**

Largest UIDN-03 refactor: **extracts a new `<DropZone>` component** (likely at `src/components/suggestions/form/DropZone.tsx`; planner verifies file colocation). Resolves the dual-role problem (drag target + click target) by separating concerns: outer `div` is the drag handler + visual surface; inner shadcn `Button` is the keyboard-activatable Browse trigger.

| Property | Value |
|----------|-------|
| Outer container | `<div role="region" aria-label="Image upload" className="flex flex-col items-center justify-center border-2 border-dashed border-input rounded-md p-8 text-center min-h-[160px] transition-colors" + state classes>` carries the drag handlers (`onDragEnter/Over/Leave/Drop`) and the dynamic state styling. Container is NOT a button — it has no `tabIndex`, no `role="button"`. |
| State styling — idle | `bg-muted/30` |
| State styling — drag-over | `bg-muted/60 ring-2 ring-ring` (slightly elevated tint + Tailwind ring; matches shadcn focus-ring convention) |
| State styling — uploading | `bg-muted/30` (no ring; the Browse Button is hidden, replaced by inline Loader2 + label) |
| State styling — error | `border-destructive bg-destructive/5` (carried from Phase 4 §9 dropzone error state) |
| Idle state content | `<ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />` + `<p className="text-sm font-medium">Drop an image here</p>` + `<p className="text-xs text-muted-foreground mt-1">JPG, PNG, or WebP · max 2 MB</p>` + the inner Browse button below the helper text |
| Inner Browse button | `<Button variant="outline" size="sm" type="button" onClick={handleBrowseClick} aria-label="Browse files">Browse files</Button>` — `h-9` (matches Phase 4 secondary buttons); programmatically triggers the hidden `<input type="file">` via `useRef` |
| Uploading state content | `<Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />` + `<p className="text-sm text-muted-foreground">Uploading…</p>` (no Button shown during upload) |
| Error state inline | `<p className="text-xs text-destructive mt-2">{errorMessage}</p>` rendered below the idle content when the file fails validation |
| Hidden file input | `<input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={...} />` — visually hidden but focusable; preserves native file-picker semantics |
| ARIA | The region itself is `role="region"` with `aria-label="Image upload"`. The Browse button has `aria-label="Browse files"` for redundancy with the visible label. The drag-over visual state is decorative; screen readers reach the Button via tab order. |
| Keyboard entry | Tab focuses the Browse button. Enter/Space activates the button → opens file picker. The drag handlers are pointer-only — keyboard users use the button. This is the intentional UIDN-03 fix: separate the two affordances. |
| Helper-text + UIDN-03 footnote [c] | Resolves the footnote by removing the dual-role native button. Outer div is no longer a button (no `aria-label`, no `tabIndex`); only the inner shadcn Button is keyboard-activatable. |
| Test impact | Existing image-upload tests target the file input. Planner re-runs the suite to confirm zero regression. |

---

## Copywriting Contract

### Primary CTAs (Phase 12 — none new)

Phase 12 introduces **no new primary CTAs**. The existing "Create suggestion" / "Save changes" form submit copy is unchanged. The Switch is a toggle, not a CTA. The Checkbox is an option, not a CTA.

### Form Field Labels & Helpers (NEW Phase 12)

| Field | Label | Helper | Lock source |
|-------|-------|--------|-------------|
| VIS-06 Visibility Checkbox | "Hide results from voters" | "Voters with responses will see a placeholder instead of counts. Toggle anytime from the admin list." | REQUIREMENTS-verbatim (label) + D-17 (helper, exact copy locked in CONTEXT) |

### Switch Labels (NEW Phase 12)

| State | Visible copy (≥ `sm`) | Mobile glyph (< `sm`) | ARIA label |
|-------|----------------------|-----------------------|-----------|
| Currently visible (`results_hidden = false`) | "Hide results" | Lucide `Eye` 16px | "Results currently visible" |
| Currently hidden (`results_hidden = true`) | "Show results" | Lucide `EyeOff` 16px | "Results currently hidden" |

D-06 locks the action-form, two-state label. The label describes the **action that will fire**, not the current state. The ARIA label describes the **current state** so screen-reader users get the read-aloud truth without inferring from action verbs.

### VIS-08 Hidden-state Copy (LOCKED)

| Element | Copy | Lock source |
|---------|------|-------------|
| Alert title | "Results temporarily hidden by admin" | VIS-08 + D-12 (verbatim, uniform across live AND archived) |
| Voter's-choice line above the Alert | "Your response: {choice label}" | D-10 |

"Temporarily" stays accurate per VIS-02 — admin can unhide at any point, including after close. D-12 explicitly considered and rejected adaptive copy for closed polls; the uniform locked phrase wins for simplicity.

### Toast Copy (NEW Phase 12)

| Action | Toast type | Message | Lock source |
|--------|-----------|---------|-------------|
| Hide results success | success | "Results hidden for: {title}" | D-03 |
| Show results success | success | "Results visible for: {title}" | D-03 |
| Toggle failure (either direction) | error | "Could not update visibility. Try again." | Phase 4 generic-error tone applied |
| Create poll with `results_hidden = true` success | success | "Suggestion created" (unchanged Phase 4 toast — VIS-06 does NOT add a separate "with hidden results" toast) | Phase 4 inherited |

Sonner duration / position: inherited (3000ms auto-dismiss; bottom-center mobile, bottom-right desktop).

### Empty States (Phase 12 — none new)

Phase 12 adds no new empty states. The hidden-state Alert is **not** an empty state — the voter has voted, the data exists, the admin has chosen to obscure it. The existing Phase 2 not-voted empty state (vote buttons + no result bars) is unchanged.

### Error State Copy (NEW Phase 12)

| Context | Copy | Lock source |
|---------|------|-------------|
| `useToggleResultsVisibility` EF failure (network / 5xx) | "Could not update visibility. Try again." | Phase 4 tone |
| `useToggleResultsVisibility` EF 403 (rare; admin lost role mid-session) | "You do not have permission to perform this action." | Phase 4 inherited literal |
| `useToggleResultsVisibility` EF 404 (poll deleted concurrently) | "Suggestion not found. It may have been deleted." | Phase 4 tone |

All three surfaces via Sonner error toast. No inline form-level error needed — the Switch reverts on failure (optimistic-revert pattern) and the toast is the user-visible signal.

### Destructive Confirmation Copy

Phase 12 has **no destructive actions**. The Switch is two-way and non-destructive (VIS-02 + D-01 explicitly rejected the AlertDialog confirmation pattern from the original VIS-07 wording; **REQUIREMENTS.md VIS-07 wording edit lands in Phase 12** to strip the AlertDialog prose and replace with the optimistic-Switch + toast contract).

### Terminology Enforcement (Phase 12 specific)

- VIS-06 label uses "voters" (REQUIREMENTS-verbatim) — this is admin-facing copy, so the otherwise-public "respondents/responses" preference does not apply.
- VIS-08 voter-facing Alert uses "results" + "admin" — neutral language, no "vote" terminology leak. (The Alert is shown to voters, but only to voters who have already voted — there is no surface where a non-voter sees the Alert.)
- Switch labels "Hide results" / "Show results" inherit REQUIREMENTS VIS-07 verbiage. "Results" (not "votes") is the noun.
- Toast copy "Results hidden/visible for: {title}" — "title" interpolates the suggestion title verbatim (no truncation in the toast; Sonner's own ellipsis applies if needed).

---

## Interaction States

### VIS-06 Create-Poll Visibility Flow

| State | What the admin sees |
|-------|---------------------|
| Form load (new) | Checkbox renders unchecked by default; helper text visible below |
| Click checkbox | Local form state updates immediately; checkbox shows check mark (`bg-primary text-primary-foreground`) |
| Submit | `useCreatePoll` posts `results_hidden: true` (or omits / false) to the EF body |
| Submit success (checkbox checked) | Toast "Suggestion created"; row appears in admin list with Switch in OFF position (visibility hidden by default for this poll) |
| Submit success (checkbox unchecked) | Toast "Suggestion created"; row appears in admin list with Switch in ON position (visibility on by default — backwards-compat) |

### VIS-07 Switch Toggle Flow

| State | What the admin sees |
|-------|---------------------|
| Initial render (visible state) | Switch ON (`bg-primary`), action label "Hide results" (≥ `sm`) or `Eye` icon (< `sm`) |
| Initial render (hidden state) | Switch OFF (`bg-input`), action label "Show results" (≥ `sm`) or `EyeOff` icon (< `sm`) |
| Click Switch | **Optimistic:** Switch flips immediately; label flips immediately; Switch becomes `disabled`; `Loader2` appears adjacent |
| EF in-flight (~50-500ms) | Switch shows new position; disabled; spinner visible |
| EF success | Spinner removed; Switch re-enabled; success toast appears |
| EF failure | Switch reverts to original position; label reverts; spinner removed; Switch re-enabled; error toast appears |
| Rapid-click guard | Switch is `disabled` while in-flight (D-02); a second click during in-flight is a no-op and writes no extra `audit_log` row |

### VIS-08 Voter Hidden-state Flow

| State | What the voter sees |
|-------|---------------------|
| Initial render — voter has not voted | `<ChoiceButtons>` (unchanged from Phase 2). `results_hidden` is irrelevant — the privacy boundary is voter-status-first per VIS-04. |
| Initial render — voter has voted, `results_hidden = false` | `<ResultBars>` (unchanged from Phase 2) |
| Initial render — voter has voted, `results_hidden = true` | Voter's-choice line ("Your response: {label}") + Alert ("Results temporarily hidden by admin") |
| Admin flips visible → hidden (live state change) | Within ~8s (next `useVoteCounts` poll cycle), `<ResultBars>` swaps to the Alert. No page reload. Voter's-choice line appears. |
| Admin flips hidden → visible (live state change) | Within ~8s, the Alert swaps back to `<ResultBars>`. Voter's-choice line is dropped (it is hidden-state-only context). |
| Archived poll, `results_hidden = true` | Same Alert + voter's-choice line. D-12 locks uniform copy (no "permanently" wording). |

### UIDN-03 DropZone Flow (D-13)

| State | What the admin sees |
|-------|---------------------|
| Idle | Dashed border, `bg-muted/30`, `ImagePlus` icon + "Drop an image here" + "JPG, PNG, or WebP · max 2 MB" + Browse button |
| Dragging file over | `bg-muted/60 ring-2 ring-ring` |
| File dropped (or Browse clicked → file selected) | Validates size + MIME → if valid, transitions to Uploading; if invalid, transitions to Error |
| Uploading | `Loader2` spin + "Uploading…", Browse button hidden |
| Upload success | Transitions to preview state (existing Phase 4 §9 thumbnail + filename + Clear button — unchanged) |
| Upload error | Error border + destructive message ("File too large" / "Unsupported format"); Browse button still present for retry |

### Responsive Breakpoints (Phase 12 additions)

| Breakpoint | Phase 12-specific behavior |
|------------|---------------------------|
| `sm` and up (≥ 640px) | VIS-07 Switch shows full action label ("Hide results" / "Show results") inline |
| Below `sm` (< 640px) | VIS-07 Switch shows Eye/EyeOff icon instead of label, conserving row width (D-07). Switch + icon still meet WCAG 2.5.8 (≥ 44px touch target via the wrapping `<label>` element). |
| All breakpoints | VIS-08 Alert renders identically. The card max width (`max-w-2xl` from Phase 2) constrains wrap behavior. |
| All breakpoints | VIS-06 Checkbox renders identically (form is single-column at every breakpoint per Phase 4) |
| All breakpoints | UIDN-03 DropZone renders identically (`min-h-[160px]` carried from Phase 4 §9) |

---

## Accessibility Contract

Carries forward Phase 1, 2, 4, 5, 6 accessibility. Phase 12 additions:

| Requirement | Implementation |
|-------------|----------------|
| VIS-06 Checkbox | shadcn `Checkbox` is Radix-backed: native `<input type="checkbox">` semantics; Label is associated via `htmlFor` + `id`. Tab order: lands on Checkbox after `CategoryPicker` Select trigger, before Cancel/Submit buttons. Space toggles. |
| VIS-07 Switch | shadcn `Switch` is Radix-backed: `role="switch"`, `aria-checked` reflects state. Custom `aria-label` reflects current state ("Results currently visible/hidden") per D-06 ARIA rule. `aria-busy="true"` during in-flight. `disabled` during in-flight (Radix sets `aria-disabled` + skips focus). Wrapping `<label>` element provides clickable label area extending to the action-label text — meets WCAG 2.5.5 (≥ 24×24 CSS px target) and 2.5.8 (≥ 44×44 with the wrapping `min-h-[44px]`). |
| VIS-07 Switch — keyboard | Tab focuses the Switch. Space or Enter activates (Radix default). Disabled state during in-flight is announced via `aria-disabled` and focus is preserved (not lost). |
| VIS-07 toast announcement | Sonner uses `role="status"` + `aria-live="polite"` for success; `aria-live="assertive"` for error. Inherited from Phase 4. |
| VIS-08 Alert | shadcn `Alert` is `role="alert"` (Radix default for the Alert primitive — fires `aria-live` on mount). When the voter's poll cycle flips from `<ResultBars>` to the Alert, screen readers announce "Alert: Results temporarily hidden by admin". The voter's-choice line above is plain text; not announced as an alert. |
| VIS-08 EyeOff icon | Decorative — `aria-hidden="true"` on the Lucide `EyeOff`. The Alert title text carries the semantic meaning. |
| VIS-08 reverse flow | When the Alert is removed and `<ResultBars>` returns, no announcement fires (it's a normal content change, not an alert). Acceptable: the voter sees the visual change. |
| UIDN-03 SearchBar X | `aria-label="Clear search"` preserved from native `<button>`. Tab order unchanged. Activates with Enter (Button primitive). |
| UIDN-03 SuggestionForm back link | TanStack `<Link>` renders an `<a>` element with `href`. Native link semantics: Tab focuses, Enter activates, Cmd/Ctrl+Click and middle-click open in new tab (a regression-blocker the prior `<button>` lacked). No new ARIA needed. |
| UIDN-03 DropZone outer region | `role="region"` + `aria-label="Image upload"`. Not focusable; not announced as a button (resolves the prior dual-role footnote [c]). |
| UIDN-03 DropZone Browse button | Standard shadcn Button accessibility: `<button>` element, focusable, Enter/Space activates, `aria-label="Browse files"`. Tab order: lands on Browse button when reaching the image section. |
| UIDN-03 DropZone hidden file input | `className="sr-only"` keeps it focusable for keyboard users who navigate past the Browse button — but the Browse button is the canonical entry point. |
| Reduced motion | `prefers-reduced-motion: reduce` — Switch animation (track slide) and Loader2 spin both respect this. shadcn primitives handle this via existing CSS. |
| Color contrast | All new color applications use tokens already validated in Phase 1 + Phase 2 (`text-foreground` on `bg-card`, `text-muted-foreground` on `bg-card`, `bg-primary` on `text-primary-foreground`). No new contrast pairs introduced. |

---

## Registry Safety

### Existing Components (Phase 1, 2, 4, 5, 6) — already vendored

| Component | Location | Used by Phase 12 |
|-----------|----------|------------------|
| Button | `src/components/ui/button.tsx` | UIDN-03 D-13 (DropZone Browse), D-14 (none — uses TanStack Link), D-15 (SearchBar X) |
| Alert | `src/components/ui/alert.tsx` | VIS-08 hidden-state message |
| Label | `src/components/ui/label.tsx` | VIS-06 Checkbox label |
| Card, Badge, DropdownMenu, Input, Textarea, Select, Dialog, Tabs, Sheet, Sonner, Progress, Collapsible | (existing) | inherited contexts; unchanged in Phase 12 |

### NEW Components (Phase 12)

| Registry | Component | Install command | Safety Gate |
|----------|-----------|-----------------|-------------|
| shadcn official | Checkbox | `npx shadcn@latest add checkbox` | not required — official shadcn/ui, no third-party vetting |
| shadcn official | Switch | `npx shadcn@latest add switch` | not required — official shadcn/ui, no third-party vetting |

**Combined install:** `npx shadcn@latest add checkbox switch`

Both vendor under `src/components/ui/{checkbox,switch}.tsx` per the established convention.

### Third-Party Registries

**None declared for Phase 12.** No `view + diff` vetting gate applies. Registry vetting gate: **not applicable**.

### Local Component Extracted

| Component | Location (planner verifies) | Phase 12 scope |
|-----------|----------------------------|----------------|
| `DropZone` | `src/components/suggestions/form/DropZone.tsx` (likely; colocated with `ImageInput.tsx`) | UIDN-03 D-13 refactor — extracts the drag surface + Browse button cluster from inline `ImageInput.tsx:108` |

Not a registry component; pure local extraction. No third-party code introduced.

---

## Phase 11 Carry-Forward Contract (read-only references)

Phase 12 consumes the following Phase 11 deliverables without modification:

| Phase 11 deliverable | Phase 12 consumer |
|----------------------|-------------------|
| `polls.results_hidden boolean NOT NULL DEFAULT false` (Migration 10) | `useSuggestions` SELECT, `useVoteCounts` extension, type regen |
| `polls.results_hidden_changed_at timestamptz` (Migration 10) | Not read by Phase 12 UI (audit-log surface deferred to v1.3+ per D-04) |
| `polls_effective` view projection of `results_hidden` + `results_hidden_changed_at` (VIS-09) | `useSuggestions` (existing `SELECT *` picks it up post-type-regen), `useVoteCounts` extension (D-11 explicit re-fetch) |
| `vote_counts` SELECT RLS policy gating by `results_hidden = false` AND `auth.uid()` voted (VIS-04) | Read-path safety — voter UI cannot leak counts even if the UI branch is bypassed |
| `toggle-results-visibility` EF (VIS-03) — idempotent, race-safe, returns full poll row | `useToggleResultsVisibility` hook calls this; trusts the response shape |
| `create-poll` EF accepts optional `results_hidden?: boolean` (Phase 11 D-08) | `useCreatePoll` extension passes the VIS-06 checkbox value through |
| `audit_log` table | Silent in v1.2 UI per D-04; surfaced in v1.3+ admin dashboard |

---

## Phase 12 Type Regeneration (D-18)

Not strictly a UI contract item but blocks the UI work: `src/lib/types/database.types.ts` is stale (does not yet contain `results_hidden`). Regen via:

```bash
supabase gen types typescript --linked > src/lib/types/database.types.ts
```

Plus add `npm run gen:types` script for repeatability. CI drift gate deferred per D-18.

After regen:
- `SuggestionWithChoices` (in `src/lib/types/suggestions.ts`) inherits `results_hidden` + `results_hidden_changed_at` from `Tables<'polls'>` automatically.
- `useSuggestions` (already `SELECT * from polls_effective`) projects the new columns into its return value with zero hook-body changes.
- The `polls-effective-invariant.test.ts` continues to pass (no new `from('polls')` direct reads in `src/`).

---

## Test Surfaces

### TEST-13 — Playwright E2E happy path (D-16)

| Element | Locator strategy |
|---------|------------------|
| Admin login | `[E2E]`-scoped per ESLint E2E-SCOPE-1 (Phase 8 contract) |
| Create-poll form | Existing `[E2E]`-scoped form locators (Phase 4) |
| VIS-06 Checkbox | `[data-testid="visibility-checkbox"]` (planner adds `data-testid`; matches existing Phase 4 form testid pattern) — Phase 12 explicitly adds this testid so the spec can target the checkbox |
| Voter session (vote cast) | Phase 8 `freshPoll` fixture extended with a vote-cast step |
| VIS-07 Switch on `AdminSuggestionRow` | `[data-testid="visibility-switch-{pollId}"]` |
| VIS-08 Alert on `SuggestionCard` | `[data-testid="results-hidden-alert-{pollId}"]` — locked locator so the spec doesn't depend on the locked copy string |

Spec walks SC4 end-to-end as a single `.spec.ts` per D-16. Runs against the same Supabase target as existing `@smoke` specs.

### Existing Invariant — `polls-effective-invariant.test.ts`

Continues to pass — Phase 12 must NOT add any new `from('polls')` direct reads in `src/`. All reads go through `polls_effective` (read path) or the EF (mutation path).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: pending
- [ ] Dimension 2 Visuals: pending
- [ ] Dimension 3 Color: pending
- [ ] Dimension 4 Typography: pending
- [ ] Dimension 5 Spacing: pending
- [ ] Dimension 6 Registry Safety: pending

**Approval:** pending
