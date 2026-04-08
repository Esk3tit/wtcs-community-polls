# Phase 3: Response Integrity - Research

**Researched:** 2026-04-07
**Domain:** Discord OAuth guild membership verification, Upstash Redis rate limiting, Supabase Edge Functions
**Confidence:** HIGH

## Summary

Phase 3 adds two server-side integrity mechanisms: (1) Discord guild membership verification at login time using the OAuth `guilds` scope and `/users/@me/guilds` endpoint, and (2) per-user rate limiting on the `submit-vote` Edge Function using Upstash Redis. Both integrate into well-established patterns already in the codebase.

The guild check extends the existing `handleAuthCallback()` flow in `auth-helpers.ts`, which already calls the Discord API with `provider_token` for 2FA verification. The guilds check adds a second Discord API call in the same flow. The rate limiter uses `@upstash/ratelimit` with `@upstash/redis`, imported via `esm.sh` in the Deno Edge Function (matching the existing import pattern). Both features follow the project's fail-closed security model.

**Primary recommendation:** Extend the existing auth callback flow with a guilds API call, store membership in the `profiles` table via the existing RPC pattern, and add Upstash rate limiting as the first check in `submit-vote` before any database queries.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Discord server membership is verified at login time only -- alongside the existing 2FA check in `auth-helpers.ts`. The `guilds` scope is added to `signInWithOAuth`, and `/users/@me/guilds` is called using the `provider_token` during sign-in.
- **D-02:** Guild membership status is stored in the `profiles` table so downstream checks (Edge Functions, RLS) can reference it without needing the provider_token again.
- **D-03:** OAuth `guilds` scope approach (not Discord Bot API) -- removes external coordination blocker. Scopes are set in the `signInWithOAuth` call, not on Discord Developer Portal.
- **D-04:** Non-members are blocked at login -- same fail-closed pattern as 2FA rejection. User is signed out immediately with a clear error page.
- **D-05:** Reuse the existing `AuthErrorPage` component with different messaging: "Join the WTCS Discord server to participate" with a Discord invite button/link.
- **D-06:** Error page follows the same layout and UX as the 2FA rejection page for consistency.
- **D-07:** Upstash Redis rate limiting enforced in the `submit-vote` Edge Function, per authenticated user ID.
- **D-08:** Per-user only -- no per-IP secondary layer. Discord identity model makes per-IP redundant.
- **D-09:** Rate limit errors shown as Sonner toast notification: "Too many responses too quickly. Please wait a moment and try again." No countdown timer.
- **D-10:** Consistent with existing error handling pattern in `useVoteSubmit` hook -- the Edge Function returns an error, the hook displays a toast.

### Claude's Discretion
- Exact rate limit threshold and sliding window configuration (e.g., N responses per M seconds) -- Claude picks something reasonable for a ~300-person community with ~20-30 concurrent users at peak.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-03 | User who is not a member of the official War Thunder esports Discord server is rejected with a clear error message | Guild check in `handleAuthCallback()` using `/users/@me/guilds` endpoint, new `'not-in-server'` reason in `AuthCallbackResult`, extended `AuthErrorPage` with invite link |
| VOTE-04 | Upstash Redis rate limiting prevents rapid response submissions from a single user | `@upstash/ratelimit` sliding window in `submit-vote` Edge Function, per user.id, returns 429 |
| TEST-04 | Response integrity checks have tests (server membership rejection, rate limiting behavior) | Vitest unit tests for `handleAuthCallback()` guild scenarios, unit tests for rate limit error handling in `useVoteSubmit` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @upstash/ratelimit | 2.0.8 | Sliding window rate limiting | Purpose-built for serverless/edge, used in official Supabase examples [VERIFIED: npm registry] |
| @upstash/redis | 1.37.0 | HTTP-based Redis client for Edge Functions | REST-based Redis client works in Deno/Edge without TCP sockets [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/supabase-js | ^2.101.1 | Supabase client (already installed) | Auth, DB operations [VERIFIED: package.json] |
| vitest | ^4.1.2 | Test runner (already installed) | All unit/integration tests [VERIFIED: package.json] |
| @testing-library/react | ^16.3.2 | Component testing (already installed) | AuthErrorPage tests [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @upstash/ratelimit | Custom Redis INCR/EXPIRE | Hand-rolling sliding window has edge cases (race conditions, clock drift); library handles these [ASSUMED] |
| OAuth guilds scope | Discord Bot API | Bot approach checks real-time but requires external coordination (adding bot to server). User chose OAuth approach (D-03). |

**Installation (Edge Function only -- no npm install needed):**
Edge Functions import via `esm.sh` URLs in Deno:
```typescript
import { Ratelimit } from 'https://esm.sh/@upstash/ratelimit@2'
import { Redis } from 'https://esm.sh/@upstash/redis@1'
```
[CITED: existing project pattern in `supabase/functions/submit-vote/index.ts` line 1]

**Version verification:**
- `@upstash/ratelimit`: 2.0.8 (verified via `npm view` 2026-04-07)
- `@upstash/redis`: 1.37.0 (verified via `npm view` 2026-04-07)

## Architecture Patterns

### Integration Points Map

```
src/
  contexts/AuthContext.tsx        # Add 'guilds' scope to signInWithOAuth options
  lib/auth-helpers.ts             # Add guilds check after 2FA check, new reason type
  components/auth/AuthErrorPage.tsx  # Add 'not-in-server' error config entry
  routes/auth/error.tsx           # Extend reason type cast to include 'not-in-server'
  routes/auth/callback.tsx        # No changes needed (already handles all reasons)
  hooks/useVoteSubmit.ts          # No changes needed (already handles error toasts)
  __tests__/auth/                 # New guild check tests, extended error page tests
  __tests__/integrity/            # New rate limit error handling tests

supabase/
  functions/submit-vote/index.ts  # Add Upstash rate limit check before processing
  migrations/00000000000003_guild_membership.sql  # Add guild_member column to profiles
```

### Pattern 1: Guild Membership Check (extends existing auth callback)
**What:** After the 2FA check succeeds in `handleAuthCallback()`, make a second Discord API call to `/users/@me/guilds` using the same `provider_token`. Check if the WTCS guild ID is in the returned array.
**When to use:** Every login (SIGNED_IN event with provider_token).
**Example:**
```typescript
// Source: Discord API docs + existing auth-helpers.ts pattern
// After 2FA check passes, before profile RPC update:

const WTCS_GUILD_ID = '<actual-guild-id>' // env var or constant

const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
  headers: { Authorization: `Bearer ${providerToken}` },
})

if (!guildsResponse.ok) {
  console.error('Discord guilds API error:', guildsResponse.status)
  await supabase.auth.signOut()
  return { success: false, reason: 'auth-failed' }
}

const guilds: Array<{ id: string }> = await guildsResponse.json()
const isMember = guilds.some(g => g.id === WTCS_GUILD_ID)

if (!isMember) {
  await supabase.auth.signOut()
  return { success: false, reason: 'not-in-server' }
}
```
[CITED: https://discord.com/developers/docs/resources/user#get-current-user-guilds]

### Pattern 2: Upstash Rate Limiting in Edge Function
**What:** Before processing any vote logic, check the user's rate against Upstash Redis. Return 429 if exceeded.
**When to use:** Every `submit-vote` Edge Function invocation, after auth verification but before any DB queries.
**Example:**
```typescript
// Source: Supabase rate limiting docs + Upstash getting started
import { Ratelimit } from 'https://esm.sh/@upstash/ratelimit@2'
import { Redis } from 'https://esm.sh/@upstash/redis@1'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),  // reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
  limiter: Ratelimit.slidingWindow(5, '60 s'),  // 5 responses per 60 seconds
  prefix: 'wtcs:vote',
})

// After auth verification, before vote processing:
const { success, remaining, reset } = await ratelimit.limit(user.id)
if (!success) {
  return new Response(
    JSON.stringify({ error: 'Too many responses too quickly. Please wait a moment and try again.' }),
    { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```
[CITED: https://supabase.com/docs/guides/functions/examples/rate-limiting, https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted]

### Pattern 3: Extended AuthCallbackResult Type
**What:** Add `'not-in-server'` to the reason union type. This flows through the existing error routing.
**When to use:** When guild check fails.
**Example:**
```typescript
// auth-helpers.ts
export type AuthCallbackResult =
  | { success: true }
  | { success: false; reason: 'auth-failed' | '2fa-required' | 'not-in-server' }
```
[VERIFIED: existing code in `src/lib/auth-helpers.ts` lines 3-5]

### Pattern 4: Extended AuthErrorPage Config
**What:** Add `'not-in-server'` entry to the `errorConfig` object with Discord invite link.
**When to use:** Rendering error page for non-members.
**Example:**
```typescript
// AuthErrorPage.tsx -- new entry in errorConfig
'not-in-server': {
  icon: ShieldAlert,  // or Users from lucide-react
  heading: 'WTCS Server Membership Required',
  body: 'You need to be a member of the official WTCS Discord server to participate in community suggestions.',
  primaryLabel: 'Join the WTCS Discord Server',
  primaryHref: 'https://discord.gg/<WTCS_INVITE_CODE>',  // actual invite link TBD
  secondaryLabel: 'Try Signing In Again',
},
```
[VERIFIED: existing pattern in `src/components/auth/AuthErrorPage.tsx` lines 10-35]

### Pattern 5: Profile Schema Extension
**What:** Add `guild_member BOOLEAN NOT NULL DEFAULT FALSE` column to `profiles` table. Updated by the RPC function after successful guild check.
**When to use:** Stored at login, queryable by Edge Functions and RLS.
**Example:**
```sql
-- New migration
ALTER TABLE public.profiles
  ADD COLUMN guild_member BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.guild_member
  IS 'Set to true by update_profile_after_auth RPC when user is a member of the WTCS Discord server. Checked at login time via OAuth guilds scope.';
```
[VERIFIED: existing schema in `supabase/migrations/00000000000000_schema.sql` lines 27-39]

### Anti-Patterns to Avoid
- **Checking guilds on every page load:** Provider token is only available during sign-in event. Store membership in profiles and check the stored value. [CITED: CONTEXT.md D-01, D-02]
- **Pre-checking then inserting (TOCTOU):** The existing `submit-vote` correctly does direct INSERT with UNIQUE constraint. Rate limiting should be a separate pre-check, not a replacement for DB constraints. [VERIFIED: existing code pattern in submit-vote/index.ts]
- **Rate limiting before auth:** Always verify the user's JWT first, then rate limit by user ID. Rate limiting unauthenticated requests by IP is not needed per D-08.
- **Hardcoding guild ID in client code:** The guild ID should be in `auth-helpers.ts` (or an env var). It's not sensitive but shouldn't be scattered across files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sliding window rate limiting | Custom Redis INCR + EXPIRE logic | `@upstash/ratelimit` `slidingWindow()` | Handles race conditions, clock drift, atomic operations. One function call vs. 20+ lines of error-prone code. [CITED: https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted] |
| HTTP Redis client for Edge | Raw `fetch()` to Redis REST API | `@upstash/redis` `Redis.fromEnv()` | Handles auth, retries, serialization. Required by `@upstash/ratelimit`. [CITED: https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted] |

**Key insight:** Rate limiting in serverless environments requires HTTP-based Redis (no TCP sockets available in Deno Deploy/Supabase Edge). Upstash is the de facto standard for this, with first-class Supabase integration documented in official Supabase docs.

## Common Pitfalls

### Pitfall 1: Provider Token Not Available on Session Refresh
**What goes wrong:** `provider_token` is only present on the initial `SIGNED_IN` event, not on subsequent session refreshes or `TOKEN_REFRESHED` events. Attempting to call Discord API after session refresh will fail with null token.
**Why it happens:** Supabase does not store the OAuth provider token. It's only passed through once during the initial OAuth callback.
**How to avoid:** Only call Discord APIs in `handleAuthCallback()` when `provider_token` is present (already the pattern -- the `onAuthStateChange` handler checks `newSession?.provider_token`). Store guild membership in `profiles` table for later reference.
**Warning signs:** `provider_token` is null in auth callback, or guild check silently passes because it was skipped.
[CITED: Supabase Discord auth docs, project memory file `project_phase3_discord_guilds.md`]

### Pitfall 2: Discord Guilds Endpoint Returns Up to 200 Guilds
**What goes wrong:** The `/users/@me/guilds` endpoint returns up to 200 guilds by default (the max a non-bot user can join). For most users this is fine, but the response can be large.
**Why it happens:** The `guilds` scope returns ALL guilds, not just one specific guild.
**How to avoid:** Use `.some()` to check for the WTCS guild ID rather than iterating. The response is at most ~200 entries which is well within acceptable limits for a single API call.
**Warning signs:** Unexpectedly large response payloads or slow auth callbacks.
[CITED: https://discord.com/developers/docs/resources/user#get-current-user-guilds]

### Pitfall 3: Rate Limit Configuration Too Aggressive or Too Lenient
**What goes wrong:** Too strict = legitimate users blocked when navigating between polls and voting quickly. Too lenient = no practical protection.
**Why it happens:** Hard to predict user behavior patterns without production data.
**How to avoid:** Start with 5 responses per 60 seconds (sliding window). A user responding to 5 different suggestions in 1 minute is reasonable peak activity for ~20-30 concurrent users. This prevents rapid automated submissions while allowing normal browsing-and-voting patterns.
**Warning signs:** User complaints about being blocked, or no rate limit events logged.
[ASSUMED -- threshold is Claude's discretion per CONTEXT.md]

### Pitfall 4: Upstash Environment Variables Missing in Edge Function
**What goes wrong:** `Redis.fromEnv()` throws at runtime because `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` are not set.
**Why it happens:** Supabase Edge Function secrets must be set separately from `.env` files. They don't auto-deploy.
**How to avoid:** Set secrets via `supabase secrets set UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=...` or through the Supabase Dashboard. Verify with `supabase secrets list`.
**Warning signs:** 500 errors from the Edge Function with "missing environment variable" in logs.
[CITED: https://supabase.com/docs/guides/functions/secrets]

### Pitfall 5: OAuth Scopes Not Persisted Across Re-Auth
**What goes wrong:** If the user has previously authorized the app with only `identify email` scopes, Discord may not re-prompt for the `guilds` scope on next login.
**Why it happens:** Discord caches granted scopes. Adding `guilds` to the `scopes` string in `signInWithOAuth` tells Discord to request it, but Discord shows the consent screen only if new scopes are requested.
**How to avoid:** Supabase's `signInWithOAuth` passes scopes to the Discord authorize URL. Discord should show the consent screen for the new `guilds` scope. If not, users may need to deauthorize the app in Discord settings and re-authorize. Test this with a user who already authorized the app.
**Warning signs:** `guilds` endpoint returns 403 or empty despite user being in the server.
[ASSUMED -- based on general OAuth2 behavior]

### Pitfall 6: RPC Function Needs Guild Member Parameter
**What goes wrong:** The existing `update_profile_after_auth` RPC function does not accept a `guild_member` parameter. Calling it without updating the function signature will not persist guild membership.
**Why it happens:** The RPC was created in Phase 1 with only `p_mfa_verified`, `p_discord_username`, `p_avatar_url` parameters.
**How to avoid:** Add `p_guild_member BOOLEAN` parameter to the existing RPC function via migration. Update the call site in `auth-helpers.ts` to pass the new parameter.
**Warning signs:** Profile rows show `guild_member = false` even after successful guild check.
[VERIFIED: existing RPC in `supabase/migrations/00000000000002_triggers.sql` lines 56-77]

## Code Examples

### Discord /users/@me/guilds Response Shape
```typescript
// Each guild object in the response array
// Source: Discord API docs
interface DiscordGuild {
  id: string           // Guild snowflake ID (the one we check)
  name: string         // Guild name
  icon: string | null  // Guild icon hash
  owner: boolean       // Whether the user owns this guild
  permissions: string  // User's permissions in the guild
  features: string[]   // Guild features
}
// Response is DiscordGuild[] -- up to 200 entries
```
[CITED: https://discord.com/developers/docs/resources/user#get-current-user-guilds]

### Upstash Rate Limit Response Shape
```typescript
// Source: @upstash/ratelimit docs
interface RatelimitResponse {
  success: boolean    // Whether the request should be allowed
  limit: number       // Maximum number of requests allowed
  remaining: number   // Remaining requests in current window
  reset: number       // Unix timestamp (ms) when the window resets
  pending: Promise<unknown>  // Background analytics flush
}
```
[CITED: https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted]

### Full Auth Callback Flow After Phase 3
```typescript
// Pseudocode showing the complete handleAuthCallback flow
async function handleAuthCallback(): Promise<AuthCallbackResult> {
  // 1. Get session (existing)
  // 2. Verify provider_token exists (existing)
  // 3. Call /users/@me -- check mfa_enabled (existing)
  // 4. NEW: Call /users/@me/guilds -- check WTCS guild ID
  // 5. Update profile via RPC (extended with guild_member param)
  // 6. Return success
}
```

### Rate Limit Integration Point in submit-vote
```typescript
// Pseudocode showing where rate limit check goes
Deno.serve(async (req) => {
  // CORS preflight (existing)
  // Method check (existing)
  // Auth verification (existing)
  
  // NEW: Rate limit check -- BEFORE any DB queries
  const { success } = await ratelimit.limit(user.id)
  if (!success) {
    return new Response(
      JSON.stringify({ error: 'Too many responses too quickly. Please wait a moment and try again.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  
  // Parse body (existing)
  // Validate poll (existing)
  // Validate choice (existing)
  // Insert vote (existing)
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bot API for guild check | OAuth guilds scope | Phase 3 discussion (D-03) | No external coordination needed, simpler but only checks at login |
| esm.sh imports in Edge Functions | npm: specifier preferred | Supabase 2025 | Project uses esm.sh (existing pattern), both work |

**Not deprecated:**
- `@upstash/ratelimit` v2.x is current and actively maintained [VERIFIED: npm registry, published 3 months ago]
- Discord `/users/@me/guilds` endpoint is stable and not deprecated [CITED: Discord API docs]

## Assumptions Log

> List all claims tagged [ASSUMED] in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 5 responses per 60-second sliding window is a reasonable threshold | Pitfall 3 / Rate Limit Config | Too strict = UX complaints; too lenient = no protection. Easy to adjust post-deploy. |
| A2 | Custom Redis INCR/EXPIRE has edge cases vs. @upstash/ratelimit | Don't Hand-Roll | Low risk -- library is still the better choice regardless |
| A3 | Discord may not re-prompt for guilds scope if user previously authorized without it | Pitfall 5 | Users might fail guild check silently. Testable in development. |

**If this table has entries:** The planner should verify A1 and A3 with the user or flag for testing.

## Open Questions

1. **WTCS Discord Guild ID**
   - What we know: The guild membership check needs a specific guild snowflake ID
   - What's unclear: The actual guild ID value for the official War Thunder esports Discord server
   - Recommendation: This must be provided by the project owner or looked up from the Discord server settings (Server Settings > Widget > Server ID). Store as a constant in `auth-helpers.ts` or as an environment variable.

2. **Discord Invite Link for Error Page**
   - What we know: D-05 specifies a Discord invite button/link on the error page
   - What's unclear: The permanent/vanity invite URL for the WTCS Discord server
   - Recommendation: Use a permanent invite link. The project owner must provide this. Placeholder in code until provided.

3. **Upstash Redis Database Setup**
   - What we know: Need UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN as Edge Function secrets
   - What's unclear: Whether the Upstash Redis database has been created yet
   - Recommendation: Plan should include a setup step for creating the Upstash Redis database (free tier: 500K commands/month, more than sufficient for this scale).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | DB migrations, secrets | Installed (dev dep) | ^2.85.0 | -- |
| Vitest | Tests | Installed (dev dep) | ^4.1.2 | -- |
| Upstash Redis (external) | Rate limiting | Needs setup | -- | See Open Question 3 |
| Discord OAuth guilds scope | Guild check | Available (no approval needed) | -- | -- |

**Missing dependencies with no fallback:**
- Upstash Redis database must be created and secrets set before rate limiting works

**Missing dependencies with fallback:**
- None -- all code-level dependencies are available

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + @testing-library/react 16.3.2 |
| Config file | `vite.config.ts` (test section at lines 21-27) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-03a | Guild check rejects non-member (guilds response missing WTCS ID) | unit | `npx vitest run src/__tests__/auth/callback-behavior.test.tsx -t "guild"` | No -- Wave 0 (extend existing file) |
| AUTH-03b | Guild check passes for member (guilds response includes WTCS ID) | unit | `npx vitest run src/__tests__/auth/callback-behavior.test.tsx -t "guild"` | No -- Wave 0 |
| AUTH-03c | Guild check fails closed on API error | unit | `npx vitest run src/__tests__/auth/callback-behavior.test.tsx -t "guild"` | No -- Wave 0 |
| AUTH-03d | AuthErrorPage renders not-in-server variant | unit | `npx vitest run src/__tests__/auth/auth-error-page.test.tsx -t "server"` | No -- Wave 0 (extend existing file) |
| VOTE-04a | Rate limit error (429) shown as toast | unit | `npx vitest run src/__tests__/integrity/rate-limit-toast.test.tsx` | No -- Wave 0 |
| VOTE-04b | Rate limit error message matches D-09 text | unit | `npx vitest run src/__tests__/integrity/rate-limit-toast.test.tsx` | No -- Wave 0 |
| TEST-04 | All above tests pass | integration | `npm test` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Extend `src/__tests__/auth/callback-behavior.test.tsx` -- new guild check test cases for AUTH-03
- [ ] Extend `src/__tests__/auth/auth-error-page.test.tsx` -- 'not-in-server' rendering test for AUTH-03d
- [ ] Create `src/__tests__/integrity/rate-limit-toast.test.tsx` -- rate limit error toast tests for VOTE-04

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Discord OAuth + 2FA + guild membership (existing + this phase) |
| V3 Session Management | No | Handled by Supabase Auth (existing) |
| V4 Access Control | Yes | Guild membership stored in profiles, checked by RLS/Edge Functions |
| V5 Input Validation | Yes | Rate limit check prevents abuse; vote inputs already validated in submit-vote |
| V6 Cryptography | No | No custom crypto in this phase |

### Known Threat Patterns for Discord OAuth + Edge Functions

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-member voting | Spoofing | Guild membership check at login, stored in profiles, referenced by submit-vote |
| Vote flooding | Denial of Service | Upstash Redis per-user rate limiting (sliding window) |
| Provider token theft | Elevation of Privilege | Token only used server-side in auth callback, never stored, never sent to client |
| Stale guild membership | Spoofing | Accepted trade-off (D-01): only checked at login. User who leaves server can vote until next login. |
| Rate limit bypass via multiple accounts | Spoofing | Mitigated by Discord 2FA requirement + server membership requirement (hard to mass-create verified accounts) |

## Sources

### Primary (HIGH confidence)
- npm registry -- verified @upstash/ratelimit 2.0.8, @upstash/redis 1.37.0
- Existing codebase files: `auth-helpers.ts`, `AuthContext.tsx`, `AuthErrorPage.tsx`, `submit-vote/index.ts`, `useVoteSubmit.ts`, schema migrations
- CONTEXT.md decisions D-01 through D-10

### Secondary (MEDIUM confidence)
- [Supabase Rate Limiting Edge Functions docs](https://supabase.com/docs/guides/functions/examples/rate-limiting) -- official example
- [Upstash Ratelimit Getting Started](https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted) -- official docs
- [Discord User Resource docs](https://discord.com/developers/docs/resources/user) -- /users/@me/guilds endpoint
- [Supabase Discord Auth docs](https://supabase.com/docs/guides/auth/social-login/auth-discord) -- signInWithOAuth scopes
- [Supabase Edge Function Secrets docs](https://supabase.com/docs/guides/functions/secrets) -- environment variable management
- [Upstash Redis Pricing](https://upstash.com/docs/redis/overall/pricing) -- free tier: 500K commands/month

### Tertiary (LOW confidence)
- Rate limit threshold recommendation (5/60s) -- based on community size reasoning, not production data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- npm versions verified, official Supabase integration documented
- Architecture: HIGH -- extends well-understood existing patterns, all integration points identified and code reviewed
- Pitfalls: HIGH -- based on verified API behavior and existing code analysis
- Rate limit threshold: LOW -- educated guess, easy to adjust

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (30 days -- stable stack, no fast-moving changes expected)
