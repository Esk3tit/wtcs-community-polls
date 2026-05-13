---
phase: 01-foundation-authentication
plan: 03
subsystem: auth
tags: [supabase, discord-oauth, 2fa, react-context, tanstack-router, shadcn-ui, theme]

requires:
  - phase: 01-01
    provides: Vite + React scaffold, shadcn/ui components, TanStack Router
  - phase: 01-02
    provides: Database schema, RLS policies, update_profile_after_auth RPC
provides:
  - Discord OAuth sign-in with FAIL-CLOSED 2FA enforcement
  - AuthProvider context with single Supabase subscription
  - ThemeProvider with system preference detection
  - Responsive navigation (desktop + mobile)
  - Auth guards (authenticated + admin)
  - Complete route structure (index, topics, archive, admin, auth/callback, auth/error)
affects: [poll-management, admin-dashboard, testing]

tech-stack:
  added: []
  patterns: [context-provider, extracted-testable-functions, fail-closed-auth, rpc-over-direct-update]

key-files:
  created:
    - src/lib/auth-helpers.ts
    - src/contexts/AuthContext.tsx
    - src/hooks/useAuth.ts
    - src/components/auth/AuthGuard.tsx
    - src/components/auth/AdminGuard.tsx
    - src/components/auth/LandingPage.tsx
    - src/components/auth/AuthErrorPage.tsx
    - src/components/theme-provider.tsx
    - src/components/layout/Navbar.tsx
    - src/components/layout/MobileNav.tsx
    - src/routes/auth/callback.tsx
    - src/routes/auth/error.tsx
    - src/routes/index.tsx
    - src/routes/topics.tsx
    - src/routes/archive.tsx
    - src/routes/admin/index.tsx
  modified:
    - src/routes/__root.tsx
    - src/main.tsx
    - src/lib/supabase.ts
    - src/lib/types/database.types.ts

key-decisions:
  - "Auth callback uses update_profile_after_auth RPC (not direct profile update) per R2 security fix"
  - "FAIL-CLOSED: missing provider_token, Discord API failure, or mfa_enabled=false all sign out and redirect"
  - "handleAuthCallback extracted as testable function in auth-helpers.ts"
  - "Single AuthProvider wraps entire app via __root.tsx — all useAuth() calls share one subscription"

patterns-established:
  - "Auth guard pattern: wrap route content with AuthGuard/AdminGuard components"
  - "Extracted callback logic: auth-helpers.ts contains testable pure-ish functions"
  - "Theme persistence: localStorage key 'wtcs-ui-theme' with system/light/dark"

requirements-completed: [AUTH-01, AUTH-02, AUTH-04, AUTH-05, UIDN-01, UIDN-02]

duration: 15min
completed: 2026-04-06
---

# Plan 01-03: Auth Infrastructure & App Shell Summary

**Discord OAuth with FAIL-CLOSED 2FA via server-side RPC, AuthProvider context, ThemeProvider, and responsive navigation shell**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-06T15:30:00Z
- **Completed:** 2026-04-06T15:45:00Z
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments
- Discord OAuth sign-in with FAIL-CLOSED 2FA enforcement using provider_token + Discord API + server-side RPC
- AuthProvider context with single Supabase auth subscription, profile fetching, and stale-fetch protection
- ThemeProvider with system preference listener and localStorage persistence
- Responsive navigation: desktop navbar with dropdown menu, mobile hamburger with Sheet overlay
- Complete route structure: index (landing/redirect), topics, archive, admin, auth/callback, auth/error
- Auth guards: AuthGuard (requires authentication) and AdminGuard (requires is_admin)

## Task Commits

1. **Task 1: Provider token spike** - `b2b5795` (feat) — Supabase client, database types, spike page
2. **Task 2: Auth infrastructure** - `47cd092` (feat) — AuthProvider, callback, guards, routes, LandingPage, AuthErrorPage
3. **Task 3: App shell** - `3ad7db6` (feat) — ThemeProvider, Navbar, MobileNav, __root.tsx wiring

## Files Created/Modified
- `src/lib/auth-helpers.ts` - Extracted callback logic with FAIL-CLOSED 2FA and RPC
- `src/contexts/AuthContext.tsx` - AuthProvider with single subscription + profile state
- `src/hooks/useAuth.ts` - Re-export of useAuth from AuthContext
- `src/components/auth/AuthGuard.tsx` - Redirects unauthenticated users to landing
- `src/components/auth/AdminGuard.tsx` - Blocks non-admin users
- `src/components/auth/LandingPage.tsx` - Discord CTA card with trust badges
- `src/components/auth/AuthErrorPage.tsx` - Error-specific messaging (2FA, expired, general)
- `src/components/theme-provider.tsx` - Theme context with system preference listener
- `src/components/layout/Navbar.tsx` - Desktop nav with user dropdown and theme toggle
- `src/components/layout/MobileNav.tsx` - Sheet-based mobile navigation
- `src/routes/__root.tsx` - Root layout with AuthProvider, ThemeProvider, Navbar, Toaster
- `src/routes/auth/callback.tsx` - OAuth callback using handleAuthCallback
- `src/routes/auth/error.tsx` - Auth error display page
- `src/routes/index.tsx` - Landing page (unauthenticated) or redirect to topics
- `src/routes/topics.tsx` - Topics shell page (content in later phase)
- `src/routes/archive.tsx` - Archive shell page
- `src/routes/admin/index.tsx` - Admin dashboard shell (AdminGuard protected)

## Decisions Made
- Bundled all auth components + routes in Task 2 commit for atomicity
- ThemeProvider, Navbar, MobileNav committed separately as Task 3 (app shell)
- Provider token spike left as documentation (requires manual Supabase + Discord setup to verify)

## Deviations from Plan
None significant — plan executed as written with minor adjustments for TypeScript compatibility.

## Issues Encountered
- Database type compatibility: agent hit issues with Supabase generic types; resolved by adjusting the Database type structure

## User Setup Required
**External services require manual configuration before auth will work:**
- Copy `.env.example` to `.env.local` and fill in Supabase URL + anon key
- Configure Discord OAuth provider in Supabase dashboard
- Push database schema to Supabase (`supabase db push`)
- Run provider token spike to verify PKCE flow provides provider_token

## Next Phase Readiness
- Auth infrastructure complete, ready for behavioral test suite (Plan 01-04)
- All routes and components in place for Phase 2 poll management features
- Provider token spike needs manual verification before production use

---
*Phase: 01-foundation-authentication*
*Completed: 2026-04-06*
