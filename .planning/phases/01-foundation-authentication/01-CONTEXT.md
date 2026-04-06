# Phase 1: Foundation & Authentication - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up the complete Supabase database schema with RLS policies, Discord OAuth authentication with 2FA enforcement, TanStack Router routing scaffold, responsive dark-mode app shell, and Netlify deployment pipeline. A logged-in Discord user can access the app, see their identity, and navigate a responsive dark-mode shell with the full database schema and security policies already in place underneath. Testing infrastructure (Vitest + React Testing Library) is set up with auth flow tests.

</domain>

<decisions>
## Implementation Decisions

### App Shell & Navigation
- **D-01:** Top navigation bar with logo, nav links, and user controls. Discord-like horizontal layout.
- **D-02:** Logged-in user's Discord avatar appears top-right with a dropdown menu (logout, settings).
- **D-03:** Four routes created in Phase 1: Home (poll list — empty shell), Auth callback (OAuth redirect handler), Archive (closed polls — empty shell), Admin panel (admin-only — empty shell).
- **D-04:** Mobile navigation approach is Claude's discretion — pick the best option based on number of nav items and mobile-first priority (hamburger menu vs bottom tab bar vs collapsible).

### Auth Error Experience
- **D-05:** Auth error handling approach (full-page error, toast, redirect) is Claude's discretion — pick what works best for non-technical esports community members.
- **D-06:** Tone for all auth errors must be helpful and warm. Example: "To keep voting fair, we require 2FA on your Discord account. Here's how to set it up..." with a direct link to Discord's 2FA setup guide.
- **D-07:** Session expiry and general auth errors should follow the same warm, guiding tone — assume users are non-technical.

### Schema & Data
- **D-08:** Full database schema created upfront in Phase 1 — all tables (profiles, polls, choices, votes, vote_counts, categories, admins) with RLS policies. Phase 2+ just uses what's already there.
- **D-09:** Database managed via Supabase CLI migrations — SQL migration files in `supabase/migrations/` tracked in git.
- **D-10:** Initial admin accounts seeded via migration seed data — hardcode Discord IDs in a seed migration file.
- **D-11:** User's Discord profile (avatar, username, discriminator) synced to profiles table on every login — always fresh data.

### Landing Page
- **D-12:** Logged-out landing page is a splash page with context — brief explanation of what WTCS Community Polls is, why Discord login is required, and a prominent "Login with Discord" button. Builds trust for first-time visitors.
- **D-13:** Visual identity is independent but cohesive with the main WTCS Map Vote site — distinct personality that complements but doesn't copy.

### Claude's Discretion
- Mobile navigation pattern (D-04) — pick best fit for the layout and content density
- Auth error presentation format (D-05) — full-page vs toast vs redirect
- Loading states and skeleton patterns
- Exact color palette and typography within "dark mode, esports-appropriate, modern" direction
- Test structure and organization patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, key decisions
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
- `src/index.css`: CSS custom properties for theming (--text, --accent, --bg, --shadow) with light/dark media query — foundation for dark mode default
- `src/App.css`: Responsive breakpoint at 1024px, animation patterns — can be extended for new components
- `public/icons.svg`: SVG sprite sheet — can be extended with new icons
- `public/favicon.svg`: Existing favicon

### Established Patterns
- Functional React components with hooks (useState)
- Plain CSS with custom properties (no CSS-in-JS, no Tailwind)
- Relative imports, no path aliases
- Default exports for components
- ESLint flat config with TypeScript and React hooks rules

### Integration Points
- `src/main.tsx`: Entry point — will need router provider wrapping
- `src/App.tsx`: Root component — will be replaced/refactored into layout + routes
- `index.html`: Has #root div, script tag for main.tsx — needs Supabase env injection
- `vite.config.ts`: Basic React plugin — may need env variable config

</code_context>

<specifics>
## Specific Ideas

- Dark mode should be DEFAULT (matching Discord's dark theme), not toggled — users coming from Discord expect dark
- Non-technical audience throughout — esports organizers and casual gamers, not developers
- "Modern and classy UI" — user has iterated on design direction in Claude.ai, specifics to come in UI phase
- The splash/landing page should build trust for first-time visitors who click a link from Discord

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-authentication*
*Context gathered: 2026-04-06*
