# WTCS Community Polls — Design System Brief

## Design direction: "Warm neutral"

Professional but not cold. Warm grays, subtle surface layering, muted accent colors.
Adapts to light/dark mode naturally. Feels trustworthy for a competitive esports community
without being corporate or generic. Think Linear meets Discord — clean information density
with personality.

## UI framework

- **Component library:** shadcn/ui (with Tailwind CSS v4)
- **Style:** Maia (soft rounded corners, generous spacing — consumer-facing warmth)
- **Base color:** Neutral
- **Theme:** Neutral
- **Chart color:** Neutral
- **Preset:** Configure at ui.shadcn.com/create with the above settings, copy preset string
- **Icons:** Lucide React (ships with shadcn)

## Color system

### Semantic colors (use shadcn theme tokens)
- **Primary:** Muted blue — used for vote buttons, active states, primary CTAs
- **Secondary:** Warm gray — used for secondary actions, inactive states
- **Destructive:** Muted red — used for admin destructive actions only
- **Accent:** Warm neutral — used for hover states, subtle highlights

### Status colors (for poll states)
- **Active/Open:** Blue badge (`bg-blue-50 text-blue-700` / dark: `bg-blue-950 text-blue-300`)
- **Pinned/Important:** Amber/Warning banner bar across top of card
- **Addressed:** Green badge (Gaijin acted on it)
- **Forwarded:** Amber/Yellow badge (shared with Gaijin, awaiting response)
- **Closed:** Neutral/Gray badge (not being pursued, no negative connotation)

### Category badges
- Use muted, low-contrast pill badges for categories (e.g., "Lineup changes", "Map pool", "Rules")
- Each category gets a consistent color from a small palette (blue, teal, purple, coral)
- Badge style: `text-xs font-medium px-2 py-0.5 rounded-md` with subtle bg tint

## Typography

- **Font:** System font stack (Inter if custom font desired, but system default is fine for v1)
- **Suggestion title:** text-lg font-medium (17px equivalent)
- **Body/description:** text-sm text-muted-foreground, line-height relaxed
- **Metadata (response count, dates, creator):** text-xs text-muted-foreground
- **Badge text:** text-xs font-medium
- **Percentage numbers (results):** text-xl font-medium (large, prominent)
- No ALL CAPS except category filter pills (uppercase tracking-wide text-xs)

## Spacing

- **Card padding:** p-5 (1.25rem) horizontal, p-5 vertical
- **Card gap (in list):** space-y-3 (12px between poll cards)
- **Inner element gap:** space-y-4 (16px between sections within a card)
- **Page max width:** max-w-2xl centered (keeps reading width comfortable on desktop, full-width mobile)

## Access model

### Two completely separate surfaces
- **User-facing:** Browseable suggestion list + individual suggestion pages (via share links from Discord).
  Simple top nav, category filters, active suggestions, and a public archive of past suggestions with results.
  No awareness that an admin UI exists. No links to admin routes. No admin-only elements visible.
- **Admin-facing:** Completely separate routes (e.g., /admin/*), protected by admin auth.
  Admin UI can use "poll", "vote", and internal terminology freely — users never see it.

### Primary user flow
1. Admin shares a link in Discord (e.g., `polls.wtcsmapban.com/s/remove-mig29`)
2. User clicks link → lands on suggestion page
3. If not authenticated → Discord OAuth → redirect back to suggestion
4. User reads suggestion, responds, sees results
5. User can optionally browse other active suggestions or view the archive

### Discovery
- **Primary:** Share links posted in Discord channels by admins
- **Secondary:** Authenticated users can browse all active/archived suggestions on the site directly

## Component patterns

### Suggestion card (core element)
- Container: `bg-card rounded-xl border` (shadcn card)
- Pinned suggestions: Amber/warning banner bar across top of card (inside border-radius, using overflow-hidden)
- Image area: Optional, rounded-md, bg-muted placeholder when no image
- Opinion buttons: Grid 2-col (or N-col for multi-choice), outlined style, medium padding
- Results (after responding): Side-by-side metric cards with large % number + thin progress bar
- Footer: Flex between creator avatar+name and response count/date

### Category filter bar
- Horizontal scrollable row of pill-shaped buttons at top of suggestion list
- Active pill: `bg-background border-border` (elevated, selected look)
- Inactive pill: `bg-muted text-muted-foreground` (recessed, unselected)

### Suggestion list page
- Category filter bar (sticky top on scroll)
- Pinned suggestions first (with pinned indicator)
- Then active suggestions sorted by recency
- Then closed/archived suggestions (collapsed by default or separate "Archive" tab)

### Archive view
- Same card layout but muted/reduced visual weight
- Status badge prominently shown (Addressed / Forwarded / Closed)
- Results always visible (suggestion is closed)

### Login page
- Centered card with Discord OAuth button
- Brief explainer: "Sign in with Discord to share your opinion. 2FA must be enabled."
- If user lacks 2FA: clear error message explaining how to enable it

### Admin dashboard
- Separate route, same design system
- Table or card list of all suggestions with status, response count, actions
- Create suggestion form: title, description, choices (dynamic add/remove), image upload/URL, category select/create, timer duration
- Admin actions: close suggestion, set status (Addressed / Forwarded / Closed), pin/unpin
- NOTE: Admin-facing UI can use "poll" and "vote" terminology internally — the framing constraint is user-facing only

## Layout

- **Mobile-first responsive design**
- Single column on mobile, max-w-2xl centered on desktop
- No sidebar — simple top nav with logo, category filters inline
- Dark mode support via shadcn theme toggle (respect system preference by default)

## Animation & interaction

- Keep it minimal. No page transitions, no fancy animations.
- Subtle hover states on cards and buttons (shadcn defaults are fine)
- Vote button: On click, immediately show optimistic result (user sees their response counted instantly)
- Progress bars: No animation on load, just static width

## Tone & copy

### Critical framing rule: Opinions, not votes
The platform gathers community OPINIONS, not binding votes. Nothing on the site
should imply that the most popular option will be implemented or that users are
owed any outcome. This is feedback collection, not a democracy.

**Terminology to USE:**
- "Share your opinion" / "Give feedback"
- "Community suggestions" / "Community feedback"
- "What does the community think?"
- "Responses" (not "votes")
- "Results" or "Community sentiment" (not "winner" or "outcome")
- "Closed" (not "decided" or "finalized")

**Terminology to AVOID:**
- "Vote" / "Voting" / "Voter" (anywhere user-facing)
- "Poll" (use "suggestion" or "topic" instead in user-facing copy)
- "Winner" / "Winning option" / "Majority"
- "Decided" / "The community has decided"
- "Will be implemented" / "Will happen"

**Example transformations:**
- Button: "Share your opinion" not "Vote"
- Results header: "Community sentiment" not "Vote results"
- Count: "247 responses" not "247 votes"
- Status: "Forwarded" not "Under review" or "Processing"
- Empty state: "No active topics right now." not "No active polls."
- Login CTA: "Sign in to share your opinion" not "Sign in to vote"
- Page title: "WTCS Community Suggestions" not "WTCS Polls"

**Why this matters (context for developers, not user-facing):**
WTCS is a community-run competitive scene with no direct authority over War
Thunder's development. Only Gaijin Entertainment can implement game changes.
This platform exists to collect and present organized community feedback that
WTCS admins can then relay to Gaijin. Using "vote" language would create a
false expectation that the community is deciding outcomes, when in reality
this is an opinion-gathering tool. This framing must be consistent across
every user-facing surface.

### General tone
- Direct, no-nonsense. This is for competitive esports players.
- Button labels: Short and clear. "Submit" not "Submit your response".
- Empty states: Brief and helpful. "No active topics right now."
- Error states: Clear and actionable. "Discord 2FA required. Enable it in Discord Settings > My Account."
- No exclamation marks, no hype language, no "exciting" or "awesome"
