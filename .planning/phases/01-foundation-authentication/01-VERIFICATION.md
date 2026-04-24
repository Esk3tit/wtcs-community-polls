---
phase: 01-foundation-authentication
verified: 2026-04-06T16:10:00Z
status: partially_resolved
score: 7/7 must-haves verified (re-verified 2026-04-24)
overrides_applied: 0
re_verification:
  re_verified: 2026-04-24
  re_verifier: Claude (/gsd-audit-uat)
  gaps_closed:
    - "npm run build TS2345 — superseded by Phase 5 shipping to polls.wtcsmapban.com (Netlify main-branch build is green; the TS2345 rpc-arg type mismatch was resolved before or during Phase 2–5 — INFR-01 is no longer blocked)."
    - ".env in .gitignore — verified present in .gitignore (see line `.env` in the current file). The .env portion of the composite gap is resolved."
  gaps_remaining:
    - "src/routeTree.gen.ts entry in .gitignore — RESOLVED-BY-DIFFERENT-DECISION. The file is now tracked in git (`git ls-files src/routeTree.gen.ts` returns hit); the team chose to commit generated routes rather than ignore them. The original Plan 01-01 intent (ignore it) no longer applies. Converting this note to `closed_by_decision` at next verification pass."
  regressions: []
gaps:
  - truth: "npm run build succeeds (deployment pipeline functional)"
    status: resolved
    resolved_at: 2026-04-24
    resolution: "Phase 5 ships production at polls.wtcsmapban.com; Netlify build runs `npm ci && npm run build` on every main push. Live deployment is load-bearing evidence the TS2345 error is fixed. auth-helpers.ts line 129 still calls `supabase.rpc('update_profile_after_auth', {...})` without a type assertion, so the fix was likely via type regeneration or a supabase-js version bump somewhere between Phase 1 and Phase 5."
    original_reason: "TypeScript compilation fails: src/lib/auth-helpers.ts(87,81) TS2345 — supabase.rpc() arg type mismatch with Database Functions type."
  - truth: ".gitignore includes src/routeTree.gen.ts and .env"
    status: partially_resolved
    resolved_at: 2026-04-24
    resolution: ".env is now in .gitignore (line: `.env`). routeTree.gen.ts is intentionally tracked — team decision reversed the original Plan 01-01 intent. Not a gap anymore, a documented decision change."
    original_reason: ".gitignore has *.local (covers .env.local) but does NOT have explicit entries for src/routeTree.gen.ts or .env."
---

# Phase 1: Foundation & Authentication Verification Report

**Phase Goal:** A logged-in Discord user can access the app, see their identity, and navigate a responsive light/dark shell built with shadcn/ui -- with the full database schema and security policies already in place underneath
**Verified:** 2026-04-06T16:10:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can click "Sign in with Discord", complete OAuth, and land back in the app seeing their Discord username and avatar | VERIFIED | LandingPage.tsx has Discord CTA button calling signInWithDiscord(); AuthContext.tsx manages session/profile state with discord_username and avatar_url display; Navbar.tsx renders avatar and username from profile; callback.tsx calls real handleAuthCallback() |
| 2 | User whose Discord account does not have 2FA enabled is rejected with a clear error message | VERIFIED | auth-helpers.ts line 74: `if (!discordUser?.mfa_enabled)` -> signOut + return '2fa-required'; AuthErrorPage.tsx has specific 2FA messaging with Discord setup link; 6 fail-closed test cases in callback-behavior.test.tsx all pass |
| 3 | User session survives a full browser refresh without requiring re-login | VERIFIED | AuthContext.tsx line 53: `supabase.auth.getSession()` on mount restores session; line 64: `onAuthStateChange` subscription handles state changes; auth-provider test verifies session restoration |
| 4 | User can sign out from any page and is returned to a logged-out landing state | VERIFIED | Navbar.tsx line 94: signOut in dropdown menu; AuthContext.tsx signOut clears session/user/profile state; index route shows LandingPage when !user |
| 5 | App is mobile-first with light/dark mode supporting system preference | VERIFIED | MobileNav.tsx uses Sheet component with md:hidden hamburger; Navbar.tsx has hidden md:flex for desktop nav; ThemeProvider has system preference detection + matchMedia listener (R1 fix); index.css has :root and .dark CSS variables; max-w-2xl centered layout in __root.tsx |
| 6 | Testing infrastructure (Vitest + React Testing Library) is configured with CI-ready scripts | VERIFIED | vite.config.ts has test block with jsdom + setupFiles; package.json scripts.test = "vitest run"; src/test/setup.ts imports @testing-library/jest-dom/vitest; `npx vitest run` exits 0 with 37 tests passing across 7 files |
| 7 | Auth flows have unit/integration tests covering login, 2FA rejection, session persistence, and logout | VERIFIED | callback-behavior.test.tsx: 11 tests importing REAL handleAuthCallback, covering null session, missing provider_token, Discord API error, network error, mfa_enabled=false/null, success, Bearer header, RPC call, RPC error; auth-provider.test.tsx: 5 tests for session state; auth-guard.test.tsx: 6 tests; landing-page.test.tsx: 4 tests |

**Score:** 7/7 roadmap success criteria verified

### Additional Plan-Level Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| A1 | npm run build succeeds on a clean checkout | FAILED | `npm run build` fails: TS2345 at src/lib/auth-helpers.ts:87 — supabase.rpc() type mismatch |
| A2 | All 7 tables exist in schema | VERIFIED | 7 CREATE TABLE in schema.sql: profiles, categories, polls, choices, votes, vote_counts, admin_discord_ids |
| A3 | RLS enabled on all tables with default-deny | VERIFIED | 7 ENABLE ROW LEVEL SECURITY + 8 CREATE POLICY in rls.sql |
| A4 | mfa_verified only settable via SECURITY DEFINER RPC | VERIFIED | triggers.sql: profile_self_update_allowed blocks mfa_verified changes; update_profile_after_auth is SECURITY DEFINER |
| A5 | Auth callback FAILS CLOSED | VERIFIED | auth-helpers.ts: 4 explicit rejection paths all call signOut before returning failure |
| A6 | Callback uses RPC not direct profile update | VERIFIED | auth-helpers.ts line 87: `supabase.rpc('update_profile_after_auth', {...})` |
| A7 | Admin route not visible in nav for non-admins | VERIFIED | No "admin" references in Navbar.tsx or MobileNav.tsx; /admin route only accessible directly and protected by AdminGuard |
| A8 | .gitignore includes routeTree.gen.ts and .env | PARTIAL | *.local covers .env.local, but .env and src/routeTree.gen.ts are missing |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vite.config.ts` | Vite + TanStack Router + React + Tailwind + Vitest | VERIFIED | Plugins in correct order (tanstackRouter before react), test block present |
| `components.json` | shadcn/ui config | VERIFIED | style: new-york, baseColor: neutral, all aliases present |
| `src/index.css` | Tailwind v4 + Maia/Neutral CSS vars | VERIFIED | @import "tailwindcss"; :root and .dark blocks; Inter font |
| `src/lib/utils.ts` | cn() utility | VERIFIED | Exports cn using clsx + twMerge |
| `.env.example` | Supabase env template | VERIFIED | VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY |
| `public/_redirects` | Netlify SPA routing | VERIFIED | `/* /index.html 200` |
| `src/test/setup.ts` | Vitest RTL setup | VERIFIED | @testing-library/jest-dom/vitest |
| `supabase/migrations/00000000000000_schema.sql` | 7 tables | VERIFIED | All 7 tables with constraints and indexes |
| `supabase/migrations/00000000000001_rls.sql` | RLS + policies | VERIFIED | 7 ENABLE RLS + 8 policies |
| `supabase/migrations/00000000000002_triggers.sql` | Triggers + RPC | VERIFIED | 4 triggers, update_profile_after_auth RPC, COALESCE chain |
| `supabase/seed.sql` | Admin seed data | VERIFIED | INSERT INTO admin_discord_ids |
| `src/lib/supabase.ts` | Typed Supabase client | VERIFIED | createClient<Database> with env vars |
| `src/lib/auth-helpers.ts` | Extracted callback logic | VERIFIED (logic) | handleAuthCallback with fail-closed 2FA; TS type error on .rpc() call |
| `src/lib/types/database.types.ts` | Database type definitions | VERIFIED | All 7 tables + Functions type for RPC |
| `src/contexts/AuthContext.tsx` | AuthProvider + useAuth | VERIFIED | Single subscription, profile fetch, stale guard |
| `src/hooks/useAuth.ts` | Re-export | VERIFIED | Re-exports useAuth from AuthContext |
| `src/components/theme-provider.tsx` | ThemeProvider + useTheme | VERIFIED | System preference listener, localStorage persistence |
| `src/components/layout/Navbar.tsx` | Desktop nav | VERIFIED | Logo, links, theme toggle, user dropdown, mobile nav |
| `src/components/layout/MobileNav.tsx` | Mobile Sheet nav | VERIFIED | Sheet-based with md:hidden trigger |
| `src/components/auth/AuthGuard.tsx` | Auth guard | VERIFIED | Loading spinner, LandingPage fallback |
| `src/components/auth/AdminGuard.tsx` | Admin guard | VERIFIED | Navigate to / for non-admin |
| `src/components/auth/LandingPage.tsx` | Discord CTA card | VERIFIED | Heading, Discord button, trust badges |
| `src/components/auth/AuthErrorPage.tsx` | Error-specific messaging | VERIFIED | 2FA, session expired, auth failed configs |
| `src/routes/__root.tsx` | Root layout | VERIFIED | AuthProvider > ThemeProvider > Navbar + Outlet |
| `src/routes/auth/callback.tsx` | OAuth callback | VERIFIED | Calls handleAuthCallback, navigates on result |
| `src/routes/auth/error.tsx` | Auth error page | EXISTS | Route renders AuthErrorPage with reason |
| `src/routes/index.tsx` | Landing/redirect | VERIFIED | LandingPage when !user, Navigate to /topics when user |
| `src/routes/topics.tsx` | Topics shell | VERIFIED | AuthGuard wrapped, empty state |
| `src/routes/archive.tsx` | Archive shell | EXISTS | AuthGuard wrapped, empty state |
| `src/routes/admin/index.tsx` | Admin shell | VERIFIED | AdminGuard wrapped, empty state |
| `src/main.tsx` | Entry with RouterProvider | VERIFIED | createRouter + routeTree + RouterProvider |
| `src/components/ui/button.tsx` | shadcn Button | VERIFIED | Exists, substantive |
| `src/components/ui/card.tsx` | shadcn Card | VERIFIED | Exists, substantive |
| `src/components/ui/dropdown-menu.tsx` | shadcn DropdownMenu | VERIFIED | Exists, substantive |
| `src/components/ui/sheet.tsx` | shadcn Sheet | VERIFIED | Exists, substantive |
| `src/components/ui/sonner.tsx` | shadcn Sonner | VERIFIED | Exists, substantive |
| 7 test files | Behavioral tests | VERIFIED | All 7 files exist with 37 passing tests |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| src/lib/auth-helpers.ts | Discord API | fetch with provider_token Bearer header | WIRED | Line 56-57: fetch discord.com/api/users/@me with Authorization: Bearer |
| src/lib/auth-helpers.ts | update_profile_after_auth RPC | supabase.rpc() | WIRED (runtime), TYPE ERROR (compile) | Logic correct but TS2345 prevents build |
| src/routes/__root.tsx | src/contexts/AuthContext.tsx | AuthProvider wraps app | WIRED | Line 13: `<AuthProvider>` wrapping all content |
| src/components/layout/Navbar.tsx | src/hooks/useAuth.ts | useAuth() | WIRED | Line 15: destructures user, profile, signOut, signInWithDiscord |
| src/routes/auth/callback.tsx | src/lib/auth-helpers.ts | handleAuthCallback() | WIRED | Line 3: import, Line 18: await handleAuthCallback() |
| src/routes/index.tsx | src/components/auth/LandingPage.tsx | LandingPage component | WIRED | Line 21: `<LandingPage />` when !user |
| src/__tests__/auth/callback-behavior.test.tsx | src/lib/auth-helpers.ts | import real handleAuthCallback | WIRED | Line 35: import { handleAuthCallback } from '@/lib/auth-helpers' |
| vite.config.ts | src/routes/ | TanStack Router plugin | WIRED | tanstackRouter() plugin generates routeTree.gen.ts |
| package.json | vite.config.ts | build script with tsr generate | WIRED | "build": "tsr generate && tsc -b && vite build" |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tests pass | npx vitest run | 7 files, 37 tests, all passing | PASS |
| Build succeeds | npm run build | TS2345 error at auth-helpers.ts:87 | FAIL |
| Route generation | tsr generate (via npm run build) | routeTree.gen.ts created | PASS |
| cn() utility exports | grep "export function cn" src/lib/utils.ts | Found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| AUTH-01 | 01-03, 01-04 | Discord OAuth login with redirect | SATISFIED | signInWithOAuth in AuthContext, callback route, handleAuthCallback |
| AUTH-02 | 01-03, 01-04 | 2FA rejection with clear error | SATISFIED | Fail-closed in auth-helpers.ts, AuthErrorPage with 2FA messaging, 6 fail-closed tests |
| AUTH-04 | 01-03, 01-04 | Session persists across refresh | SATISFIED | getSession() on mount in AuthProvider, auth-provider tests |
| AUTH-05 | 01-03, 01-04 | Sign out from any page | SATISFIED | signOut in Navbar dropdown, AuthContext.signOut clears state |
| ADMN-01 | 01-02 | Admin seeded by Discord ID | SATISFIED | admin_discord_ids table + seed.sql + handle_new_user trigger derives admin |
| UIDN-01 | 01-03 | Light/dark mode with system preference | SATISFIED | ThemeProvider with system/light/dark, matchMedia listener, CSS variables |
| UIDN-02 | 01-03 | Mobile-first responsive design | SATISFIED | MobileNav Sheet, md:hidden/md:flex breakpoints, max-w-2xl |
| UIDN-03 | 01-01 | shadcn/ui Maia style with Neutral preset | SATISFIED | components.json neutral, CSS variables in index.css, 5 shadcn components |
| INFR-01 | 01-01 | Netlify deployment | BLOCKED | public/_redirects exists, BUT build fails (TS error) preventing deployment |
| INFR-03 | 01-02 | Reads via Supabase JS client with RLS | SATISFIED | supabase.ts creates typed client, RLS policies on all tables |
| TEST-01 | 01-01, 01-04 | Vitest + RTL infrastructure | SATISFIED | vite.config.ts test block, setup file, 37 passing tests |
| TEST-02 | 01-04 | Auth flow tests | SATISFIED | 7 test files covering login, 2FA rejection, session, logout, guards, error pages |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/routes/admin/index.tsx | 15 | "Admin tools coming soon" | Info | Acceptable for shell page -- content comes in Phase 4 |
| .gitignore | - | Missing src/routeTree.gen.ts entry | Warning | Auto-generated file risks being committed |
| src/lib/auth-helpers.ts | 87 | TypeScript type error on .rpc() call | Blocker | Prevents npm run build from succeeding |

### Human Verification Required

### 1. Discord OAuth End-to-End Flow

**Test:** Configure Supabase + Discord OAuth, click "Sign in with Discord", complete OAuth, verify landing in app with username/avatar visible
**Expected:** User sees their Discord username and avatar in the top-right nav dropdown after successful OAuth
**Why human:** Requires real Discord OAuth credentials and Supabase project configuration

### 2. 2FA Rejection Experience

**Test:** Sign in with a Discord account that does NOT have 2FA enabled
**Expected:** User is signed out and redirected to error page with "Two-Factor Authentication Required" heading, Discord setup link, and "Try Signing In Again" button
**Why human:** Requires a real Discord account without 2FA to test the rejection flow

### 3. Mobile Responsive Layout

**Test:** Open app on a phone-width viewport (375px), verify hamburger menu appears, open Sheet nav, navigate between pages
**Expected:** Sticky header with hamburger icon, Sheet slides from top with Topics/Archive links, desktop nav links hidden
**Why human:** Visual layout verification, touch target sizing, animation behavior

### 4. Light/Dark Theme Toggle

**Test:** Toggle between Light, Dark, and System themes via the sun/moon icon dropdown
**Expected:** Theme changes immediately, persists on refresh, System follows OS preference
**Why human:** Visual appearance verification, system preference detection behavior

### Gaps Summary

**One blocker prevents full goal achievement:**

1. **Build Failure (BLOCKER):** `npm run build` fails with TS2345 at `src/lib/auth-helpers.ts:87`. The `supabase.rpc('update_profile_after_auth', {...})` call has a type mismatch where the args object is rejected as "not assignable to parameter of type 'undefined'". This is likely a mismatch between the hand-written `Database` type's `Functions` definition and what `@supabase/supabase-js` v2 expects for `.rpc()` generics. The fix is either: (a) adjust the `Functions` type shape to match supabase-js expectations, (b) add a type assertion (`as any`) on the rpc args, or (c) regenerate types using `supabase gen types typescript`. **This blocks INFR-01 (Netlify deployment) since the build step fails.**

2. **Minor: .gitignore incomplete** — Missing `src/routeTree.gen.ts` and `.env` entries. The auto-generated routeTree file is currently untracked and risks accidental commit.

All 7 roadmap success criteria are logically satisfied (the auth logic, tests, UI, and schema are correct and functional), but the build failure prevents deployment. Tests pass because Vitest uses its own TypeScript handling that is less strict than `tsc -b`.

---

_Verified: 2026-04-06T16:10:00Z_
_Verifier: Claude (gsd-verifier)_
