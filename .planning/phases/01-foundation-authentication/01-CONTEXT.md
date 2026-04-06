# Phase 1: Foundation & Authentication - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up the complete Supabase database schema with RLS policies, Discord OAuth authentication with 2FA enforcement, TanStack Router routing scaffold, responsive light/dark app shell using shadcn/ui + Tailwind CSS v4, and Netlify deployment pipeline. A logged-in Discord user can access the app, see their identity, and navigate a responsive shell with the full database schema and security policies already in place underneath. Testing infrastructure (Vitest + React Testing Library) is set up with auth flow tests.

</domain>

<decisions>
## Implementation Decisions

### App Shell & Navigation
- **D-01:** Top navigation bar with logo, nav links, and user controls. Simple horizontal layout.
- **D-02:** Logged-in user's Discord avatar appears top-right with a shadcn DropdownMenu (sign out).
- **D-03:** Four routes created in Phase 1: Topics (suggestion list — empty shell), Auth callback (OAuth redirect handler), Archive (closed suggestions — empty shell), Admin panel (admin-only — empty shell, separate surface).
- **D-04:** Mobile navigation uses hamburger menu with shadcn Sheet component (slide-down panel with stacked nav links).

### Auth Error Experience
- **D-05:** Auth errors use full-page card layout (shadcn Card) — auth failures are blocking and non-technical users need clear guidance.
- **D-06:** Tone for all auth errors is direct but helpful. Example: "To keep responses authentic, we require 2FA on your Discord account. It takes about a minute to set up."
- **D-07:** Session expiry and general auth errors follow the same direct, actionable tone.

### Schema & Data
- **D-08:** Full database schema created upfront in Phase 1 — all tables (profiles, polls, choices, votes, vote_counts, categories, admins) with RLS policies. Phase 2+ just uses what's already there.
- **D-09:** Database managed via Supabase CLI migrations — SQL migration files in `supabase/migrations/` tracked in git.
- **D-10:** Initial admin accounts seeded via migration seed data — hardcode Discord IDs in a seed migration file.
- **D-11:** User's Discord profile (avatar, username, discriminator) synced to profiles table on every login — always fresh data.

### Landing Page
- **D-12:** Logged-out landing page is a centered shadcn Card with "WTCS Community Suggestions" heading, subheading about sharing opinions, prominent "Sign in with Discord" CTA, and trust badges. Builds trust for first-time visitors clicking links from Discord.
- **D-13:** Visual identity uses shadcn/ui Maia style with Neutral preset (bbVJxbc) — warm neutral, independent but cohesive with the WTCS ecosystem.

### Design System (from Design System Brief)
- **D-14:** shadcn/ui + Tailwind CSS v4 replaces plain CSS. Maia style, Neutral base/theme.
- **D-15:** Light and dark mode from day one, respecting system preference via shadcn theme toggle.
- **D-16:** Inter font (from preset). 4-size type scale: text-xs, text-sm, text-lg, text-2xl.
- **D-17:** User-facing copy uses "suggestions/topics/opinions/responses" — never "polls/votes/voters". Admin UI can use internal terminology freely.
- **D-18:** Status labels for closed suggestions: Addressed, Forwarded, Closed (not Rejected/Processing/Implemented).
- **D-19:** Two separate surfaces: user-facing (no admin awareness) and admin-facing (/admin/* routes). No admin links visible to non-admins.
- **D-20:** max-w-2xl (672px) centered content width. Mobile-first, single column.

### Claude's Discretion
- Loading states and skeleton patterns
- Test structure and organization patterns
- Exact shadcn component choices for edge cases

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `.planning/DESIGN-SYSTEM.md` — Canonical design brief: colors, typography, spacing, component patterns, terminology rules, tone & copy guidelines
- `.planning/phases/01-foundation-authentication/01-UI-SPEC.md` — Phase 1 UI design contract: component inventory, copywriting, interaction states

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, key decisions, framing rules
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-05, ADMN-01, UIDN-01 through UIDN-03, INFR-01, INFR-03, TEST-01, TEST-02

### Research
- `.planning/research/STACK.md` — Recommended libraries (TanStack Router, TanStack Query, Zustand, supabase-js)
- `.planning/research/ARCHITECTURE.md` — Database schema patterns, Edge Function structure, RLS policy design
- `.planning/research/PITFALLS.md` — RLS default-open danger, Discord provider_token availability, free tier pausing risk

### Codebase
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, code style, import organization
- `.planning/codebase/STRUCTURE.md` — Directory layout, where to add new code
- `.planning/codebase/STACK.md` — Current installed dependencies and versions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `public/favicon.svg`: Existing favicon
- `public/icons.svg`: SVG sprite sheet (may be replaced by Lucide icons from shadcn)

### Established Patterns
- Functional React components with hooks (useState)
- ESLint flat config with TypeScript and React hooks rules
- Relative imports, no path aliases

### Integration Points
- `src/main.tsx`: Entry point — will need router provider + theme provider wrapping
- `src/App.tsx`: Root component — will be replaced/refactored into layout + routes
- `index.html`: Has #root div, script tag for main.tsx — needs Supabase env injection
- `vite.config.ts`: Basic React plugin — needs Tailwind CSS v4 + path alias config

### Notes
- Plain CSS files (`index.css`, `App.css`) will be replaced by Tailwind + shadcn styling
- Existing CSS custom properties (--text, --accent, --bg) superseded by shadcn theme tokens

</code_context>

<specifics>
## Specific Ideas

- "Warm neutral" design direction: Linear meets Discord — clean information density with personality
- Primary user flow is link-sharing from Discord: admin posts link → user clicks → lands on suggestion → authenticates → responds
- Non-technical audience throughout — esports organizers and casual gamers, not developers
- Direct, no-nonsense tone — no exclamation marks, no hype language
- The landing page builds trust for first-time visitors clicking a link from Discord

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-authentication*
*Context gathered: 2026-04-06*
*Updated: 2026-04-06 after design system and terminology formalization*
