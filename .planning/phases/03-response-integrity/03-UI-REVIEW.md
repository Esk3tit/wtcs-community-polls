# Phase 3 -- UI Review

**Audited:** 2026-04-07
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md)
**Screenshots:** Not captured (Playwright browsers not installed)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Context-specific error messages with clear CTAs; no generic labels |
| 2. Visuals | 3/4 | Good hierarchy throughout; avatar placeholder in card footer lacks labeling |
| 3. Color | 4/4 | All colors use design system tokens; zero hardcoded hex/rgb values |
| 4. Typography | 4/4 | Clean set of 4 sizes (xs/sm/lg/2xl) and 2 weights (medium/semibold) |
| 5. Spacing | 4/4 | Consistent Tailwind scale; no arbitrary pixel/rem values in app code |
| 6. Experience Design | 3/4 | Strong state coverage; clickable card missing aria-expanded for screen readers |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **SuggestionCard clickable div missing `aria-expanded`** -- Screen readers cannot communicate expand/collapse state to users -- Add `aria-expanded={isOpen}` and `aria-label={suggestion.title}` to the div with `role="button"` at SuggestionCard.tsx:81-96
2. **SuggestionCard footer avatar placeholder has no accessible label** -- The `w-6 h-6 rounded-full bg-muted` div at SuggestionCard.tsx:148 conveys no meaning -- Add `aria-hidden="true"` since it is decorative, or add a tooltip/aria-label if it will become functional
3. **AuthErrorPage destructive icon has no accessible label** -- The `Icon` at AuthErrorPage.tsx:54 is purely decorative but lacks `aria-hidden="true"` -- Add `aria-hidden="true"` to the icon element to prevent screen readers from announcing an unlabeled SVG

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Phase 03 introduced well-crafted, context-specific copy:

- **AuthErrorPage.tsx:11-42** -- Four distinct error variants with specific headings and body text:
  - "Two-Factor Authentication Required" with guidance: "It takes about a minute to set up"
  - "WTCS Server Membership Required" with clear context about why
  - "Session Expired" with concise recovery instruction
  - "Something Went Wrong" with escalation path: "let us know in the Discord server"
- **AuthErrorPage.tsx:17,25** -- CTAs are specific to context: "Set Up 2FA on Discord", "Join the WTCS Discord Server" (not generic "Learn More")
- **ChoiceButtons.tsx:27-29** -- Closed-poll message is informative: "This topic is closed. Only respondents can view results."
- **ChoiceButtons.tsx:65-67** -- Response count with contextual guidance: "Respond to see results"

No instances of generic labels (Submit, Click Here, OK, Cancel) found in Phase 03 files.

### Pillar 2: Visuals (3/4)

Visual hierarchy is well-structured across Phase 03 components:

- **AuthErrorPage.tsx:51-77** -- Clear focal path: icon (h-10 w-10) -> heading (text-2xl) -> body (text-sm) -> primary CTA (w-full, mt-6) -> optional secondary CTA (ghost variant, mt-2). Card centered at max-w-md with generous py-16/py-24 breathing room.
- **SuggestionCard.tsx:43-76** -- Header establishes hierarchy: category badge + meta -> title (text-lg font-medium) -> collapsible detail
- **SuggestionCard.tsx:160-165** -- ChevronDown icon rotates 180deg on open, providing clear visual affordance for expand/collapse state
- **Navbar.tsx:51** -- Theme toggle icon-only button correctly includes `aria-label="Toggle color theme"`

**Issues:**
- **SuggestionCard.tsx:148** -- Avatar placeholder (`div.w-6.h-6.rounded-full.bg-muted`) with "Community" label has no tooltip or contextual hint about what it represents

### Pillar 3: Color (4/4)

All Phase 03 components use design system semantic tokens exclusively:

- Text colors: `text-foreground`, `text-muted-foreground`, `text-destructive`
- Background colors: `bg-card`, `bg-muted`
- Border colors: `border` (default), `border-foreground/20` (hover state)
- Destructive usage is appropriate and limited:
  - **AuthErrorPage.tsx:54** -- Error icon uses `text-destructive` (correct for error states)
  - **Navbar.tsx:94** -- Sign-out menu item uses `variant="destructive"` (correct for destructive actions)

Zero hardcoded hex or rgb values found in any `.tsx` file across the entire `src/` directory. The Neutral preset HSL values in `index.css` are properly abstracted through CSS custom properties.

### Pillar 4: Typography (4/4)

Phase 03 files use a disciplined typography scale:

**Font sizes used (4 distinct sizes):**
- `text-xs` -- Metadata, badges, timestamps (ChoiceButtons.tsx:64, SuggestionCard.tsx:64,149,155)
- `text-sm` -- Body text, buttons, nav links (AuthErrorPage.tsx:56, ChoiceButtons.tsx:27,49, Navbar.tsx:31,38)
- `text-lg` -- Card titles (SuggestionCard.tsx:72, Navbar.tsx:22)
- `text-2xl` -- Page headings (AuthErrorPage.tsx:55)

**Font weights used (2 distinct weights):**
- `font-medium` -- Card titles, button labels, nav items (SuggestionCard.tsx:72, ChoiceButtons.tsx:49, Navbar.tsx:84,92)
- `font-semibold` -- Page headings, logo (AuthErrorPage.tsx:55, Navbar.tsx:22)

This is within the recommended ceiling of 4 sizes and 2 weights for a component-level application.

### Pillar 5: Spacing (4/4)

Spacing is consistent and uses the Tailwind scale without arbitrary values:

**Phase 03 component spacing patterns:**
- **AuthErrorPage.tsx** -- `p-8` card padding, `mt-4` heading, `mt-2` body, `mt-6` primary CTA, `mt-2` secondary CTA
- **SuggestionCard.tsx** -- `p-5` card padding, `mt-2`/`mt-3`/`mt-4` vertical rhythm, `gap-2` flex gaps
- **ChoiceButtons.tsx** -- `gap-2` grid gap, `h-11` button height, `px-4` button padding, `mt-3` footer text
- **Navbar.tsx** -- `py-3 px-4 md:px-6` responsive header padding, `gap-2`/`gap-4` element spacing

Only arbitrary spacing values found are in shadcn UI primitives (e.g., `ring-[3px]` in button.tsx, dropdown-menu.tsx), which is standard for the component library and not authored in Phase 03.

### Pillar 6: Experience Design (3/4)

State coverage is comprehensive across Phase 03:

**Loading states:**
- **ChoiceButtons.tsx:56-58** -- `Loader2` spinner shown on the specific choice being submitted
- **ChoiceButtons.tsx:50** -- All choice buttons disabled during submission (`disabled={isSubmittingThisPoll}`)
- Skeleton loading component exists for suggestion list (SuggestionSkeleton.tsx)

**Error states:**
- **AuthErrorPage.tsx** -- Four distinct error variants with specific recovery paths
- **SuggestionList.tsx:72** -- Error message displayed with `text-destructive` styling

**Empty states:**
- **EmptyState component** handles three variants: no-matches, no-active, no-archive
- **SuggestionList.tsx:92-97** -- Conditional empty state rendering based on filter context

**Interactive feedback:**
- **SuggestionCard.tsx:83-84** -- Hover effects: `hover:shadow-md`, `hover:border-foreground/20`
- **SuggestionCard.tsx:88-95** -- Keyboard support: Enter and Space key handlers for card expansion
- **index.css:5-12** -- Global `cursor: pointer` rule for all interactive elements
- **dropdown-menu.tsx:75** -- `cursor-pointer` class on menu items

**Accessibility gaps:**
- **SuggestionCard.tsx:86-96** -- The clickable div has `role="button"` and `tabIndex={0}` (good), but is missing `aria-expanded={isOpen}` to communicate state to assistive technology. Also missing `aria-label` to describe what the button does.
- **AuthErrorPage.tsx:54** -- Decorative error icon lacks `aria-hidden="true"`

---

## Registry Safety

Registry audit: shadcn/ui initialized (components.json present). No UI-SPEC.md with third-party registry declarations found. Only official shadcn components detected. No third-party blocks to audit.

---

## Files Audited

- `src/components/auth/AuthErrorPage.tsx` -- Error page with 4 variants including not-in-server
- `src/routes/auth/error.tsx` -- Route handler with search param validation
- `src/components/suggestions/ChoiceButtons.tsx` -- Vote buttons with loading/disabled states
- `src/components/suggestions/SuggestionCard.tsx` -- Collapsible card with full-card click
- `src/components/layout/Navbar.tsx` -- Navigation with sign-out and theme toggle
- `src/components/ui/dropdown-menu.tsx` -- shadcn dropdown with cursor-pointer fix
- `src/index.css` -- Global styles, cursor-pointer rule, design system tokens
