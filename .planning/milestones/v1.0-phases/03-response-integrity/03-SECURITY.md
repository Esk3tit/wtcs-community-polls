# Phase 03: Response Integrity -- Security Verification

**Phase:** 03 -- response-integrity
**Verified:** 2026-04-07
**Threats Closed:** 10/10
**ASVS Level:** 1

## Threat Verification

### Plan 01: Guild Membership Verification (T-03-01 through T-03-05)

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-03-01 | Spoofing | mitigate | `src/lib/auth-helpers.ts:38-39` -- provider_token from Supabase session, not user-supplied. Lines 85-86 fetch guilds with Bearer token. Fail-closed on API error (89-92), network error (105-108), malformed response (98-102). |
| T-03-02 | Tampering | mitigate | `supabase/migrations/00000000000003_guild_membership.sql:29-31` -- trigger blocks client `guild_member` writes. `supabase/migrations/00000000000004_fix_trigger_rpc_context.sql:29-39` -- refined with `current_user = session_user` guard. RPC is `SECURITY DEFINER` (migration 3 line 62). |
| T-03-03 | Spoofing | mitigate | `src/lib/auth-helpers.ts:80-123` -- guild membership verified at login via Discord guilds API. `supabase/functions/submit-vote/index.ts:69-82` -- `guild_member` re-checked from profiles table at submission time via service_role client. |
| T-03-04 | Information Disclosure | accept | Guild ID (`VITE_WTCS_GUILD_ID`) is a publicly discoverable identifier for any Discord server. Stored in client env var for deployment flexibility. No sensitive data exposure. See Accepted Risks below. |
| T-03-05 | Elevation of Privilege | mitigate | `src/lib/auth-helpers.ts:38-39,57-58,85-86` -- provider_token read from session, used only for Discord API fetch calls within the auth callback function, never persisted to storage or sent to client-accessible endpoints. |

### Plan 02: Rate Limiting (T-03-06 through T-03-10)

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-03-06 | Denial of Service | mitigate | `supabase/functions/submit-vote/index.ts:8-12` -- Upstash `Ratelimit.slidingWindow(5, '60 s')` with `prefix: 'wtcs:vote'`. Check at line 55 runs after auth (line 44) but before guild check (line 71) and body parsing (line 87). Every attempt counts. |
| T-03-07 | Tampering | mitigate | `supabase/functions/submit-vote/index.ts:55` -- `ratelimit.limit(user.id)` where `user` is from JWT-verified `getUser()` at line 44. Client cannot forge or substitute the rate limit key. |
| T-03-08 | Denial of Service | mitigate | `supabase/functions/submit-vote/index.ts:55` -- `ratelimit.limit()` is inside the outer `try` block (line 30) with no nested try/catch. If Upstash Redis is unavailable, the throw propagates to the outer catch (line 156) which returns HTTP 500 (fail-closed). |
| T-03-09 | Spoofing | accept | Multi-account rate limit bypass is impractical at scale. Requires creating multiple Discord accounts, each with 2FA enabled, each joined to the WTCS Discord server. Existing AUTH-03 (guild membership) and AUTH-01 (2FA) controls make this cost-prohibitive. See Accepted Risks below. |
| T-03-10 | Elevation of Privilege | mitigate | `supabase/functions/submit-vote/index.ts:55` -- rate limit at line 55 runs before body parsing at line 87 and before guild_member check at line 71. Invalid/malformed requests still consume rate limit tokens, preventing abuse via intentionally invalid submissions. |

## Accepted Risks

### T-03-04: WTCS Guild ID is publicly visible

- **Risk:** The Discord guild ID is exposed in client-side environment variable `VITE_WTCS_GUILD_ID`.
- **Rationale:** Discord guild IDs are publicly discoverable for any server (via widgets, invite links, bot APIs). Knowing the guild ID does not grant access -- membership is verified server-side via Discord OAuth.
- **Residual risk:** Minimal. No action required.

### T-03-09: Rate limit bypass via multiple accounts

- **Risk:** An attacker creates multiple Discord accounts to circumvent per-user rate limiting.
- **Rationale:** Each account must (a) enable 2FA on Discord, (b) join the WTCS Discord server, and (c) be accepted/verified by server moderators. The cost of creating and maintaining multiple verified accounts is disproportionate to the value of submitting extra responses to community polls.
- **Residual risk:** Low. Monitored by server admins. If abuse is detected, Discord accounts can be banned from the server, which immediately revokes poll access via guild membership check.

## Unregistered Flags

None. Neither 03-01-SUMMARY.md nor 03-02-SUMMARY.md contain a Threat Flags section.

## Trust Boundaries Verified

| Boundary | Verified In |
|----------|-------------|
| Discord OAuth -> App | `src/lib/auth-helpers.ts` -- provider_token used for Discord API calls, fail-closed |
| Client -> Auth Callback | `src/lib/auth-helpers.ts` -- guild membership and 2FA verified before granting access |
| Stored guild_member -> Edge Functions | `supabase/migrations/00000000000003_guild_membership.sql` -- SECURITY DEFINER RPC + trigger guard |
| Client -> submit-vote Edge Function | `supabase/functions/submit-vote/index.ts` -- rate limit, guild_member, and mfa_verified enforced |
| Edge Function -> Upstash Redis | `supabase/functions/submit-vote/index.ts` -- server-side rate limit via REST API, fail-closed |

## Methodology

Each threat was verified by disposition:
- **mitigate**: Grep/read for declared mitigation pattern in cited implementation files. Pattern found = CLOSED.
- **accept**: Verify documented in this file's Accepted Risks section with rationale and residual risk assessment.
- **transfer**: N/A (no transferred risks in this phase).
