---
phase: 01-foundation-authentication
plan: 04
status: complete
started: 2026-04-06
completed: 2026-04-06
---

# Plan 04 Summary: Behavioral Test Suite

## What Was Built

7 test files with 37 passing tests covering Phase 1 auth flows and UI components.

### Test Files

| File | Tests | Coverage Area |
|------|-------|---------------|
| `src/__tests__/setup/smoke.test.ts` | 2 | Vitest + RTL infrastructure verification |
| `src/__tests__/auth/auth-provider.test.tsx` | 5 | AuthProvider state: loading, user/profile population, isAdmin, signOut, signInWithDiscord |
| `src/__tests__/auth/callback-behavior.test.tsx` | 11 | REAL handleAuthCallback: fail-closed on null session, session error, missing provider_token, Discord API error, network error, mfa_enabled=false, mfa_enabled=null; success on mfa_enabled=true; Bearer header; RPC call; RPC error handling |
| `src/__tests__/auth/auth-guard.test.tsx` | 6 | AuthGuard (loading/unauth/auth) + AdminGuard (non-admin redirect/unauth redirect/admin access) |
| `src/__tests__/auth/landing-page.test.tsx` | 4 | LandingPage: heading, CTA button, trust badges, click handler |
| `src/__tests__/ui/theme-toggle.test.tsx` | 5 | ThemeProvider: default system, dark class, light class, localStorage persist, localStorage restore |
| `src/__tests__/auth/auth-error-page.test.tsx` | 4 | AuthErrorPage: 2FA required messaging + link, session expired, general error |

### Key Design Decisions

1. **Real function testing (R2 fix):** `callback-behavior.test.tsx` imports and calls the actual `handleAuthCallback` from `src/lib/auth-helpers.ts`, not a reimplementation. The Supabase client and `fetch` are mocked at module level.

2. **Component rendering:** All component tests render actual app components via `@testing-library/react`, asserting on DOM output.

3. **matchMedia polyfill:** jsdom does not implement `window.matchMedia`. The theme toggle test adds a mock at module scope to enable ThemeProvider's system theme detection and media query listener.

4. **Mock strategy:** `@/lib/supabase` is mocked at module level for auth tests. `@/hooks/useAuth` is mocked for component tests that need controlled auth state (AuthGuard, AdminGuard, LandingPage, AuthErrorPage). `@tanstack/react-router` is mocked for AdminGuard's `Navigate` component.

## Verification

- `npx vitest run` exits with code 0
- 37 tests across 7 files, all green
- callback-behavior.test.tsx imports from `@/lib/auth-helpers` (real production code)
- All rejection paths verify `signOut` was called
- RPC call and RPC error handling verified (R2 fixes)

## Commits

1. `test(01-04): add smoke test, AuthProvider tests, and callback behavior tests`
2. `test(01-04): add AuthGuard and theme toggle tests`
3. `docs(01-04): complete behavioral test suite summary`
