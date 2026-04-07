---
phase: 2
slug: browsing-responding
status: draft
shadcn_initialized: true
preset: bbVJxbc
created: 2026-04-06
updated: 2026-04-06
---

# Phase 2 — UI Design Contract

> Visual and interaction contract for the Browsing & Responding phase. Extends the Phase 1 contract. Built on the WTCS Design System Brief (`.planning/DESIGN-SYSTEM.md`).

---

## Design System

| Property | Value |
|----------|-------|
| Component library | shadcn/ui (Maia style) |
| CSS framework | Tailwind CSS v4 |
| Preset | `bbVJxbc` (Neutral base, Neutral theme, Medium radius) |
| Icon library | Lucide React (ships with shadcn) |
| Font (heading + body) | Inter (via preset, declared in `index.css`) |

**Design direction:** "Warm neutral" -- professional but not cold. Linear meets Discord. Clean information density with personality.

**Source:** `.planning/DESIGN-SYSTEM.md` -- canonical design brief for all phases.

**Continuity:** This spec extends Phase 1 UI-SPEC (`01-UI-SPEC.md`). All Phase 1 tokens, spacing, typography, and color decisions carry forward unchanged. This document specifies only new or extended contracts for Phase 2.

---

## Spacing

Carries forward Phase 1 spacing scale (Tailwind 4px-based). New Phase 2 additions:

| Tailwind | Value | Usage |
|----------|-------|-------|
| `p-5` | 20px | Suggestion card padding (horizontal + vertical) |
| `space-y-3` | 12px | Gap between suggestion cards in list |
| `space-y-4` | 16px | Gap between sections within an expanded card |
| `gap-2` | 8px | Gap between choice buttons, gap between category pills |
| `gap-3` | 12px | Gap between search bar and category filter row |
| `px-4` | 16px | Mobile content padding (carried from Phase 1) |
| `px-6` | 24px | Desktop content padding (carried from Phase 1) |
| `py-2` | 8px | Category pill vertical padding, search input vertical padding |
| `px-3` | 12px | Category pill horizontal padding |
| `mt-4` | 16px | Space between page heading and search/filter area |
| `mt-6` | 24px | Space between filter area and suggestion list |

**Touch targets:** Minimum 44px height on all tappable elements (choice buttons, category pills, card expand trigger). Per WCAG 2.5.8.

**Max width:** `max-w-2xl` (672px) centered -- consistent with Phase 1.

---

## Typography

Extends Phase 1 typography. New roles for Phase 2:

| Role | Tailwind Class | Usage |
|------|---------------|-------|
| Page heading | `text-2xl font-semibold` | "Active Topics", "Archive" (carried from Phase 1) |
| Suggestion title | `text-lg font-medium` | Card title text (D-23) |
| Body/description | `text-sm text-muted-foreground` | Suggestion description, search placeholder |
| Label/meta | `text-xs text-muted-foreground` | Timestamps, response counts, creator name, time remaining |
| Result percentage | `text-xl font-medium` | Large percentage number on result bars |
| Result count | `text-xs text-muted-foreground` | Raw count next to percentage (e.g., "42 responses") |
| Badge text | `text-xs font-medium` | Category pills, status badges |
| Choice button text | `text-sm font-medium` | Pre-vote choice button labels |
| Pinned banner text | `text-xs font-medium` | "Pinned" label and time remaining text |

**5 sizes total:** `text-xs` (12px), `text-sm` (14px), `text-lg` (18px), `text-xl` (20px), `text-2xl` (24px).

**2 explicit font weights:** `font-medium` (500) and `font-semibold` (600). Regular weight (400) is the implicit default on `text-sm`/`text-xs` without a weight class.

**Constraints (carried from Phase 1):**
- No `text-xs` below 12px. Body stays `text-sm` (14px) minimum.
- No ALL CAPS except category filter pills (`uppercase tracking-wide text-xs`).
- Letter spacing: Default Tailwind values. No custom tracking except pill uppercase.

---

## Color

Carries forward Phase 1 color contract. All shadcn semantic tokens unchanged. New Phase 2 color applications:

### Status Colors (now active, established in Phase 1)

| Status | Light Mode | Dark Mode | Usage |
|--------|-----------|-----------|-------|
| Active/Open | `bg-blue-50 text-blue-700 border-blue-200` | `bg-blue-950 text-blue-300 border-blue-800` | Active suggestion status badge |
| Pinned | `bg-amber-50 text-amber-800 border-amber-200` | `bg-amber-950 text-amber-300 border-amber-800` | Pinned banner bar across card top |
| Addressed | `bg-green-50 text-green-700 border-green-200` | `bg-green-950 text-green-300 border-green-800` | Resolution badge on closed suggestions |
| Forwarded | `bg-amber-50 text-amber-700 border-amber-200` | `bg-amber-950 text-amber-300 border-amber-800` | Resolution badge on closed suggestions |
| Closed | `bg-neutral-100 text-neutral-600` | `bg-neutral-800 text-neutral-400` | Resolution badge on closed suggestions |

### Category Badge Colors

Fixed palette of 4 category colors. Each category is assigned one deterministically (by index or hash).

| Category Slot | Light Mode | Dark Mode |
|---------------|-----------|-----------|
| Slot 1 (e.g., Lineup changes) | `bg-blue-50 text-blue-700` | `bg-blue-950 text-blue-300` |
| Slot 2 (e.g., Map pool) | `bg-teal-50 text-teal-700` | `bg-teal-950 text-teal-300` |
| Slot 3 (e.g., Rules) | `bg-purple-50 text-purple-700` | `bg-purple-950 text-purple-300` |
| Slot 4 (e.g., General) | `bg-rose-50 text-rose-700` | `bg-rose-950 text-rose-300` |

Badge style: `text-xs font-medium px-2 py-0.5 rounded-md`.

### Choice Button Colors

| State | Style |
|-------|-------|
| Pre-vote (default) | `variant="outline"` -- `border bg-background hover:bg-accent` |
| Pre-vote (hover) | `hover:bg-accent hover:text-accent-foreground` |
| Post-vote (user's choice) | `bg-primary text-primary-foreground border-primary` |
| Post-vote (other choices) | `bg-muted text-muted-foreground border-border` |

### Result Bar Colors

| Element | Style |
|---------|-------|
| Bar background | `bg-muted` (full width track) |
| Bar fill (user's choice) | `bg-primary` |
| Bar fill (other choices) | `bg-muted-foreground/20` (subtle neutral fill) |

### Color Distribution (Phase 2 confirmation)

- **60% dominant:** `background` -- page background behind card list
- **30% secondary:** `card` surfaces -- suggestion cards, search input, filter bar area
- **10% accent:** `primary` -- reserved for:
  1. User's selected choice highlight (post-vote)
  2. Result bar fill for user's choice
  3. Active category filter pill
  4. Active navigation indicator (carried from Phase 1)

**Primary is NOT used for:** pre-vote choice button fills, card borders in default state, body text, decorative elements.

---

## Component Inventory (Phase 2)

All components use shadcn/ui primitives where available. Custom components use Tailwind + shadcn design tokens.

### 1. Search Bar

Text input for filtering suggestions by title. Positioned above category filter row.

**Uses:** shadcn `Input` (to be installed).

| Property | Value |
|----------|-------|
| Wrapper | Full width within `max-w-2xl` content area |
| Input | shadcn `Input` with `placeholder="Search topics..."` |
| Icon | Lucide `Search` 16px inside input left side, `text-muted-foreground` |
| Height | `h-10` (40px, meets 44px touch target with padding) |
| Debounce | 300ms debounce on input change before filtering |
| Clear | Lucide `X` button appears at right when input has text, `text-muted-foreground hover:text-foreground` |

### 2. Category Filter Bar

Horizontal row of pill-shaped filter buttons below search bar.

**Uses:** shadcn `Button` (variant="outline" and variant="default").

| Property | Value |
|----------|-------|
| Layout | `flex flex-wrap gap-2` -- wraps on mobile when many categories |
| First pill | "All" -- always present |
| Active pill | `bg-primary text-primary-foreground` (filled, selected) |
| Inactive pill | `variant="outline"` -- `border bg-background text-muted-foreground` |
| Pill text | `text-xs font-medium uppercase tracking-wide` |
| Pill size | `h-8 px-3 rounded-full` (override default rounded-md) |
| Touch target | 32px height -- acceptable as pills have `py-1.5` and are supplementary navigation |
| Behavior | Click sets active category. Combined with search text for compound filtering. |

### 3. Suggestion Card -- Collapsed State (default for non-pinned)

Compact card showing only essential info. Expands on click.

**Uses:** shadcn `Card`, `Collapsible` (to be installed).

| Property | Value |
|----------|-------|
| Container | `bg-card rounded-xl border cursor-pointer hover:border-foreground/20 transition-colors` |
| Padding | `p-5` |
| Layout | Single flex column |
| Row 1 | `flex items-center justify-between gap-2` -- Category badge (left), status/time meta (right) |
| Row 2 | `mt-2` -- Suggestion title (`text-lg font-medium text-foreground`) |
| Row 3 | `mt-3 flex items-center justify-between` -- Footer: creator info (left), response count (right) |
| Creator info | Avatar (24px `rounded-full`) + name (`text-xs text-muted-foreground ml-2`) |
| Response count | `text-xs text-muted-foreground` -- "{N} responses" |
| Expand indicator | Lucide `ChevronDown` 16px `text-muted-foreground` at right end of footer, rotates 180deg when expanded |
| Click area | Entire card is clickable to expand (except already-interactive elements) |
| Transition | `data-[state=open]` from Collapsible. Content slides down with `animate-collapsible-down` / `animate-collapsible-up`. |

### 4. Suggestion Card -- Expanded State (default for pinned)

Full card showing all content including description, image, and choices/results.

**Uses:** shadcn `Card`, `Collapsible`, `Button`.

| Property | Value |
|----------|-------|
| Container | Same as collapsed + expanded content area |
| Pinned banner | `bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-5 py-2 -mx-5 -mt-5 mb-4 rounded-t-xl` with Lucide `Pin` 14px + "Pinned" + time remaining right-aligned |
| Row 1 | Category badge (left) + resolution status badge if closed (right) |
| Row 2 | Title (`text-lg font-medium`) |
| Row 3 | Description (`text-sm text-muted-foreground mt-2 leading-relaxed`) -- full text visible |
| Row 4 (optional) | Image -- `mt-3 rounded-md overflow-hidden max-h-64 object-cover w-full bg-muted` |
| Row 5 | Choices area -- `mt-4` -- either pre-vote buttons or post-vote result bars |
| Row 6 | Footer -- `mt-4 flex items-center justify-between` -- creator info (left), response count + status text (right) |

### 5. Pre-Vote Choice Buttons (VOTE-01, D-24, D-26)

Displayed when user has NOT responded to this suggestion. Click submits instantly.

**Uses:** shadcn `Button` variant="outline".

| Property | Value |
|----------|-------|
| Layout | `grid gap-2` -- 2 columns for 2 choices, single column for 3+ choices |
| Button | `variant="outline" w-full h-11 text-sm font-medium justify-start px-4` |
| Hover | Standard outline hover: `hover:bg-accent hover:text-accent-foreground` |
| Click behavior | Instant submit (D-24). No confirmation dialog. Triggers Edge Function call. |
| Loading state | Clicked button shows Lucide `Loader2` 16px `animate-spin` replacing text. Other buttons disabled with `opacity-50`. |
| Footer text | `text-xs text-muted-foreground` -- "{N} responses -- respond to see results" |
| Disabled (closed, not responded) | Buttons hidden. Show `text-sm text-muted-foreground italic` -- "This topic is closed. Only respondents can view results." |

### 6. Post-Vote Result Bars (RSLT-01, RSLT-02, D-27)

Displayed after user has responded. Shows percentages and counts.

**Uses:** shadcn `Progress` (to be installed), custom result bar component.

| Property | Value |
|----------|-------|
| Layout | `flex flex-col gap-3` |
| Per choice | Stacked: label row + progress bar |
| Label row | `flex items-center justify-between` -- Choice text (`text-sm font-medium`) left, percentage (`text-xl font-medium`) right |
| Count | `text-xs text-muted-foreground` below percentage -- "({N})" |
| Bar track | `h-2 rounded-full bg-muted w-full` |
| Bar fill (user's choice) | `h-2 rounded-full bg-primary transition-all duration-300` width set to percentage |
| Bar fill (other choices) | `h-2 rounded-full bg-muted-foreground/20 transition-all duration-300` width set to percentage |
| User's choice indicator | Choice label row has `text-foreground` (not muted). Bar uses `bg-primary`. Small Lucide `Check` 14px `text-primary` before choice text. |
| Footer text | `text-xs text-muted-foreground` -- "{N} total responses" |
| Polling | Results refresh every 8 seconds (within RSLT-04 5-10s range). Bar widths transition smoothly on update. |

### 7. Pinned Banner

Amber banner bar at top of pinned suggestion cards.

| Property | Value |
|----------|-------|
| Background | `bg-amber-50 dark:bg-amber-950` |
| Text | `text-amber-800 dark:text-amber-300 text-xs font-medium` |
| Layout | `flex items-center justify-between px-5 py-2` |
| Left content | Lucide `Pin` 14px + "Pinned" label |
| Right content | Lucide `Clock` 14px + time remaining text (e.g., "3 days left") |
| Position | Inside card, above all other content. Uses negative margin to bleed to card edges: `-mx-5 -mt-5 rounded-t-xl` |

### 8. Status Badge (Category)

Pill badge showing the suggestion's category.

| Property | Value |
|----------|-------|
| Element | `<span>` with category-specific colors from the 4-slot palette |
| Style | `text-xs font-medium px-2 py-0.5 rounded-md` |
| Color assignment | Deterministic by category ID modulo 4, mapping to the category badge color slots |

### 9. Resolution Status Badge

Pill badge showing closed suggestion resolution (Addressed, Forwarded, Closed).

| Property | Value |
|----------|-------|
| Addressed | `bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 text-xs font-medium px-2 py-0.5 rounded-md` |
| Forwarded | `bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-xs font-medium px-2 py-0.5 rounded-md` |
| Closed | `bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 text-xs font-medium px-2 py-0.5 rounded-md` |

### 10. Toast Notification (D-24)

Confirmation feedback after submitting a response.

**Uses:** shadcn `Sonner` (already installed).

| Property | Value |
|----------|-------|
| Trigger | Successful response submission |
| Message | "Response recorded" |
| Duration | 3000ms auto-dismiss |
| Position | `bottom-center` on mobile, `bottom-right` on desktop |
| Style | Default Sonner styling (inherits shadcn theme tokens) |
| Error toast | "Could not submit response. Try again." -- `variant="destructive"` equivalent via Sonner `error()` |

### 11. Empty States

Shown when no suggestions match the current filter/search combination.

**Filter empty state (D-32):**

| Property | Value |
|----------|-------|
| Layout | Centered in card list area, `py-16` |
| Icon | Lucide `SearchX` 40px `text-muted-foreground` |
| Heading | "No topics match your search" -- `text-lg font-medium text-foreground mt-4` |
| Body | "Try a different search term or category." -- `text-sm text-muted-foreground mt-1` |
| Action | shadcn `Button` variant="outline" size="sm" -- "Clear filters" -- resets search + category to defaults |

**No active topics (carried from Phase 1, updated):**

| Property | Value |
|----------|-------|
| Icon | Lucide `Inbox` 40px `text-muted-foreground` |
| Heading | "No active topics right now." -- `text-lg font-medium text-foreground mt-4` |
| Body | "Topics will appear here when admins post them." -- `text-sm text-muted-foreground mt-1` |

**No archived topics (carried from Phase 1):**

| Property | Value |
|----------|-------|
| Icon | Lucide `Archive` 40px `text-muted-foreground` |
| Heading | "No archived topics." -- `text-lg font-medium text-foreground mt-4` |
| Body | "Closed topics will appear here with their results." -- `text-sm text-muted-foreground mt-1` |

### 12. Loading States

| Context | Behavior |
|---------|----------|
| Initial suggestion list load | 3 skeleton cards: `bg-muted rounded-xl h-24 animate-pulse` stacked with `space-y-3` |
| Response submission | Clicked choice button shows spinner, other buttons disabled |
| Result polling refresh | No visible loading indicator -- bars update silently in background |
| Image loading | `bg-muted` placeholder visible until image loads, no layout shift (fixed aspect ratio container `aspect-video`) |

---

## Copywriting Contract

### New Copy (Phase 2)

| Element | Copy |
|---------|------|
| Page heading (topics) | "Active Topics" |
| Page heading (archive) | "Archive" |
| Search placeholder | "Search topics..." |
| Category filter: all | "All" |
| Pre-vote footer | "{N} responses -- respond to see results" |
| Pre-vote footer (0 responses) | "Be the first to respond" |
| Post-vote footer | "{N} total responses" |
| Toast: success | "Response recorded" |
| Toast: error | "Could not submit response. Try again." |
| Toast: already responded | "You have already responded to this topic." |
| Closed + not responded | "This topic is closed. Only respondents can view results." |
| Pinned label | "Pinned" |
| Time remaining | "{N} days left" / "{N} hours left" / "Closes soon" (< 1 hour) |
| Empty: no matches heading | "No topics match your search" |
| Empty: no matches body | "Try a different search term or category." |
| Empty: no matches action | "Clear filters" |
| Empty: no active heading | "No active topics right now." |
| Empty: no active body | "Topics will appear here when admins post them." |
| Empty: no archived heading | "No archived topics." |
| Empty: no archived body | "Closed topics will appear here with their results." |
| Resolution: addressed | "Addressed" |
| Resolution: forwarded | "Forwarded" |
| Resolution: closed | "Closed" |

### Terminology Rules (carried from Phase 1)

User-facing copy never uses "vote", "poll", "voter", "winner". Uses "opinion", "response", "suggestion", "topic" instead. See `.planning/DESIGN-SYSTEM.md` > Tone & copy for the complete list.

---

## Interaction States

### Suggestion Browsing

| State | What the user sees |
|-------|-------------------|
| Loading (initial) | 3 skeleton cards with pulse animation |
| Topics loaded, no pinned | Cards sorted by recency, all collapsed |
| Topics loaded, with pinned | Pinned cards first (expanded, amber banner), then non-pinned (collapsed, sorted by recency) |
| Card collapsed | Title + category badge + meta. Entire card clickable. Chevron points down. |
| Card expanded | Full content: description, image, choices/results, footer. Chevron points up. |
| Category filter active | Selected pill filled (`bg-primary`), list filtered. "All" pill resets. |
| Search active | Input has text, list filtered by title match. Combined with category. |
| No matches | Empty state with "Clear filters" button |

### Response Submission Flow

| State | What the user sees |
|-------|-------------------|
| Pre-vote | Choice buttons (outline style). Footer: "{N} responses -- respond to see results" |
| Button hover | Standard outline hover state |
| Button clicked (submitting) | Clicked button shows spinner. All buttons disabled. |
| Submission success | Buttons replaced by result bars. Toast: "Response recorded". User's choice highlighted with check icon and `bg-primary` bar. |
| Submission error | Toast: "Could not submit response. Try again." Buttons re-enabled. |
| Already responded (revisit) | Result bars shown. User's choice highlighted. No buttons. |
| Closed + responded | Result bars shown (same as above). Resolution badge visible. |
| Closed + not responded | No buttons, no results. Message: "This topic is closed. Only respondents can view results." |

### Results Polling (RSLT-04)

| State | Behavior |
|-------|----------|
| Active, user responded | Poll `vote_counts` every 8 seconds. Update bar widths + percentages with CSS transition (300ms). |
| Active, user not responded | No polling (results hidden). |
| Closed, user responded | Poll once on load. No ongoing polling (suggestion is final). |
| Tab/window hidden | Pause polling (use `document.visibilityState`). Resume on focus. |
| Poll error | Silent retry on next interval. No user-visible error. |

### Archive Page

| State | What the user sees |
|-------|-------------------|
| Loaded | Same card layout as topics. All cards show resolution badge. Cards with responses from current user show result bars. |
| No archived topics | Empty state: "No archived topics." |
| Search/filter | Same search + category filter bar as topics page. |

### Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `md` and up (>= 768px) | Desktop padding `px-6`. Choice buttons in 2-col grid for binary choices. |
| Below `md` (< 768px) | Mobile padding `px-4`. Choice buttons stack to single column. Category pills wrap. |

---

## Accessibility Contract

Carries forward Phase 1 accessibility contract. New Phase 2 additions:

| Requirement | Implementation |
|-------------|----------------|
| Card expand/collapse | `Collapsible` uses `aria-expanded`. Trigger has `role="button"`. Content has `role="region"`. |
| Choice buttons | Each button has `aria-label="{choice text}"`. Disabled state uses `aria-disabled="true"`. |
| Results (post-vote) | Result bars use `role="meter"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="{choice}: {percent}%"`. |
| Search input | `<label>` associated via `htmlFor` or `aria-label="Search topics"`. Clear button has `aria-label="Clear search"`. |
| Category pills | `role="tablist"` wrapper. Each pill is `role="tab"` with `aria-selected`. |
| Toast notifications | Sonner uses `role="status"` and `aria-live="polite"` by default. |
| Loading skeletons | Skeleton container has `aria-busy="true"` and `aria-label="Loading topics"`. |
| Focus management | After response submission, focus moves to the result area of the same card. |
| Reduced motion | Collapsible animation respects `prefers-reduced-motion: reduce` -- instant show/hide, no slide. Result bar transitions also disabled. |
| Keyboard | Cards expandable via Enter/Space. Choice buttons focusable and activatable via Enter/Space. Category pills navigable via arrow keys within tablist. |

---

## Registry Safety

### Existing Components (from Phase 1)

| Component | Status |
|-----------|--------|
| Button | Installed |
| Card | Installed |
| DropdownMenu | Installed |
| Sheet | Installed |
| Sonner | Installed |

### New Components (Phase 2)

| Registry | Component | Safety Gate |
|----------|-----------|-------------|
| shadcn official | Badge | PASS -- official shadcn/ui |
| shadcn official | Collapsible | PASS -- official shadcn/ui |
| shadcn official | Input | PASS -- official shadcn/ui |
| shadcn official | Progress | PASS -- official shadcn/ui |
| Third-party | none | not applicable |

**Install command:** `npx shadcn@latest add badge collapsible input progress`

**Note:** Only official shadcn/ui components. No third-party component registries.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: pending
- [ ] Dimension 2 Visuals: pending
- [ ] Dimension 3 Color: pending
- [ ] Dimension 4 Typography: pending
- [ ] Dimension 5 Spacing: pending
- [ ] Dimension 6 Registry Safety: pending

**Approval:** pending
