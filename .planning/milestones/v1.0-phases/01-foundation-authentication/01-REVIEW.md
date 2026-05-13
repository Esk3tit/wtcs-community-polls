---
phase: 01-foundation-authentication
reviewed: 2026-04-06T12:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - src/lib/supabase.ts
  - src/lib/auth-helpers.ts
  - src/lib/types/database.types.ts
  - src/lib/utils.ts
  - src/contexts/AuthContext.tsx
  - src/hooks/useAuth.ts
  - src/components/auth/AdminGuard.tsx
  - src/components/auth/AuthErrorPage.tsx
  - src/components/auth/AuthGuard.tsx
  - src/components/auth/LandingPage.tsx
  - src/components/layout/MobileNav.tsx
  - src/components/layout/Navbar.tsx
  - src/components/theme-provider.tsx
  - src/routes/__root.tsx
  - src/routes/index.tsx
  - src/routes/topics.tsx
  - src/routes/archive.tsx
  - src/routes/admin/index.tsx
  - src/routes/auth/callback.tsx
  - src/routes/auth/error.tsx
  - src/main.tsx
  - src/index.css
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-06T12:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

The Phase 01 foundation and authentication implementation is well-structured overall. The auth callback flow correctly implements FAIL-CLOSED 2FA enforcement via Discord's API, the RPC-based profile update avoids client-side mfa_verified tampering, and guard components properly gate routes. However, one critical security issue exists in the auth error route where unsanitized search parameters are cast to a union type without validation, which could allow unexpected values to flow into the error page component. Several warnings address race conditions in the auth context, a missing `useTheme` guard, and type safety gaps.

## Critical Issues

### CR-01: Unsanitized Search Parameter Allows Arbitrary Strings into AuthErrorPage

**File:** `src/routes/auth/error.tsx:5-13`
**Issue:** The `validateSearch` function accepts any string from the URL query parameter `reason` and passes it through to `AuthErrorPage` via an unsafe `as` cast. While `AuthErrorPage` has a fallback (`errorConfig[reason] || errorConfig['auth-failed']`), the `reason` prop type declares it only accepts three specific string literals. The `validateSearch` function does no actual validation -- it accepts any arbitrary string from the URL. This breaks the type contract: TypeScript believes `reason` is always one of three values, but at runtime it can be anything. If `AuthErrorPage` is later modified to trust the type without the `||` fallback (e.g., direct object access without fallback), this becomes an exploitable issue.

**Fix:**
```typescript
validateSearch: (search: Record<string, unknown>) => {
  const validReasons = ['2fa-required', 'session-expired', 'auth-failed'] as const
  const raw = typeof search.reason === 'string' ? search.reason : ''
  const reason = validReasons.includes(raw as typeof validReasons[number])
    ? (raw as typeof validReasons[number])
    : 'auth-failed'
  return { reason }
},
```

Then in the component:
```typescript
function AuthErrorRoute() {
  const { reason } = Route.useSearch()
  return <AuthErrorPage reason={reason} />
}
```

This eliminates both the unsafe cast and the reliance on a runtime fallback inside `AuthErrorPage`.

## Warnings

### WR-01: Race Condition Between Initial getSession and onAuthStateChange Subscription

**File:** `src/contexts/AuthContext.tsx:51-78`
**Issue:** The `useEffect` in `AuthProvider` calls `getSession()` and registers `onAuthStateChange` sequentially. If the auth state changes between the `getSession()` call and the subscription registration, the state update from `onAuthStateChange` could fire and call `fetchProfile` concurrently with the initial `fetchProfile` from `getSession`. Both paths set `loading` to `false` via `.then(() => setLoading(false))`, creating a race where `loading` could become `false` before the profile is actually set. The stale-fetch guard on line 41-43 partially mitigates this, but `setLoading(false)` could still fire prematurely from the losing race.

**Fix:** Use a single source of truth for the loading state transition. One approach: track profile fetch with an AbortController or a monotonically increasing request counter, and only `setLoading(false)` from the latest request:

```typescript
const fetchId = useRef(0)

const fetchProfile = useCallback(async (userId: string) => {
  const currentFetchId = ++fetchId.current
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || currentFetchId !== fetchId.current) return
    setProfile(data as Profile)
  } catch {
    if (currentFetchId === fetchId.current) setProfile(null)
  }
}, [])
```

Then manage `setLoading(false)` in a single coordinated place rather than in two independent `.then()` chains.

### WR-02: useTheme Will Never Throw Because Context Has a Default Value

**File:** `src/components/theme-provider.tsx:11-12, 76-80`
**Issue:** The `useTheme` hook checks `if (context === undefined)` and throws, but `createContext` on line 11 is called with a non-undefined default value (`{ theme: 'system', setTheme: () => null }`). This means `useContext(ThemeProviderContext)` will never return `undefined` -- it will return the default value when used outside a provider. The guard on line 77 is dead code and will never throw. If a component accidentally uses `useTheme` outside the `ThemeProvider`, it will silently receive a no-op `setTheme` function instead of getting a clear error.

**Fix:** Pass `undefined` as the default and adjust the type:

```typescript
const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)
```

This matches the pattern already used correctly in `AuthContext.tsx` (line 17).

### WR-03: signOut Error Not Handled in AuthContext

**File:** `src/contexts/AuthContext.tsx:80-85`
**Issue:** The `signOut` callback calls `supabase.auth.signOut()` with `await` but does not catch errors. If the Supabase signOut call fails (network error, expired session), the promise rejects and the local state (session, user, profile) is never cleared. The user appears stuck in a signed-in state with no way to sign out.

**Fix:**
```typescript
const signOut = useCallback(async () => {
  try {
    await supabase.auth.signOut()
  } catch (err) {
    console.error('Sign out failed:', err)
  } finally {
    // Always clear local state regardless of API success
    setSession(null)
    setUser(null)
    setProfile(null)
  }
}, [])
```

### WR-04: signInWithDiscord Silently Swallows OAuth Initiation Errors

**File:** `src/contexts/AuthContext.tsx:87-95`
**Issue:** The `signInWithDiscord` callback awaits the OAuth call but does not handle errors. If `signInWithOAuth` fails (e.g., network error, misconfigured Supabase URL), the error is swallowed and the user sees no feedback. The function is called from multiple UI components (LandingPage, Navbar, AuthErrorPage) -- none of which handle the returned promise rejection.

**Fix:**
```typescript
const signInWithDiscord = useCallback(async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'identify email',
    },
  })
  if (error) {
    console.error('OAuth initiation failed:', error.message)
    // Optionally: toast notification via sonner (already imported in root)
  }
}, [])
```

### WR-05: Avatar URL Constructed from Unvalidated Discord API Response

**File:** `src/lib/auth-helpers.ts:83-85`
**Issue:** The `discordUser.id` and `discordUser.avatar` values from the Discord API response are interpolated directly into a URL string without validation. While the Discord API is a trusted source, the `discordUser` type is a locally-defined interface (not a validated schema). If the Discord API response shape changes or returns unexpected characters in `id` or `avatar`, this could produce malformed URLs. More importantly, the constructed `avatar_url` is stored in the database and later rendered in an `<img src>` tag in `Navbar.tsx:79`. An attacker who somehow controls the Discord API response (e.g., compromised token, MITM) could inject a `javascript:` or data URI -- though browsers generally do not execute JS from `img.src`, this is still a defense-in-depth concern.

**Fix:** Validate that `id` and `avatar` contain only expected characters (alphanumeric and underscores for Discord):

```typescript
const isValidDiscordId = (s: string) => /^\d{1,20}$/.test(s)
const isValidAvatarHash = (s: string) => /^[a-f0-9_]{32,34}$/.test(s)

const avatarUrl = discordUser.avatar && discordUser.id
  && isValidDiscordId(discordUser.id)
  && isValidAvatarHash(discordUser.avatar)
  ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
  : null
```

## Info

### IN-01: console.error Statements Should Be Replaced with Structured Logging

**File:** `src/lib/auth-helpers.ts:41, 61, 68, 98, 105` and `src/contexts/AuthContext.tsx:34, 46`
**Issue:** Multiple `console.error` calls are used for operational logging. In production, these provide no structured data (no severity levels, no correlation IDs) and may leak sensitive information to the browser console. While acceptable for Phase 01, these should be migrated to a proper logging utility before production launch.

**Fix:** No immediate action needed. Track as a future task to introduce a lightweight logger abstraction that can be silenced or redirected in production.

### IN-02: Non-null Assertion on document.getElementById('root')

**File:** `src/main.tsx:15`
**Issue:** `document.getElementById('root')!` uses a non-null assertion. If the `root` element is missing from `index.html`, this will throw an opaque `Cannot read properties of null` error rather than a descriptive one.

**Fix:**
```typescript
const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found in index.html')
createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
```

### IN-03: Commented-Out Code Note in supabase.ts

**File:** `src/lib/supabase.ts:14-16`
**Issue:** Lines 14-16 contain a comment about potentially switching to implicit flow. This is a development note that should be resolved and removed before production. If the PKCE flow works (which the spike should have confirmed), remove the comment. If not, implement the change.

**Fix:** Resolve the open question and remove the conditional comment. Replace with a brief doc comment explaining the chosen flow type if relevant.

---

_Reviewed: 2026-04-06T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
