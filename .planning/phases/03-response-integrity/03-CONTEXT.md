# Phase 3: Response Integrity - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure only legitimate WTCS Discord community members can submit responses, and protect the platform from abuse via rate limiting. This phase adds Discord server membership verification at login time and Upstash Redis rate limiting on the `submit-vote` Edge Function. Integrity tests cover both server membership rejection and rate limiting behavior.

</domain>

<decisions>
## Implementation Decisions

### Membership Check Timing
- **D-01:** Discord server membership is verified at login time only — alongside the existing 2FA check in `auth-helpers.ts`. The `guilds` scope is added to `signInWithOAuth`, and `/users/@me/guilds` is called using the `provider_token` during sign-in.
- **D-02:** Guild membership status is stored in the `profiles` table so downstream checks (Edge Functions, RLS) can reference it without needing the provider_token again.
- **D-03:** OAuth `guilds` scope approach (not Discord Bot API) — removes external coordination blocker. Scopes are set in the `signInWithOAuth` call, not on Discord Developer Portal.

### Non-member Experience
- **D-04:** Non-members are blocked at login — same fail-closed pattern as 2FA rejection. User is signed out immediately with a clear error page.
- **D-05:** Reuse the existing `AuthErrorPage` component with different messaging: "Join the WTCS Discord server to participate" with a Discord invite button/link.
- **D-06:** Error page follows the same layout and UX as the 2FA rejection page for consistency.

### Rate Limiting Configuration
- **D-07:** Upstash Redis rate limiting enforced in the `submit-vote` Edge Function, per authenticated user ID.
- **D-08:** Per-user only — no per-IP secondary layer. Discord identity model makes per-IP redundant.

### Rate Limit Feedback
- **D-09:** Rate limit errors shown as Sonner toast notification: "Too many responses too quickly. Please wait a moment and try again." No countdown timer.
- **D-10:** Consistent with existing error handling pattern in `useVoteSubmit` hook — the Edge Function returns an error, the hook displays a toast.

### Claude's Discretion
- Exact rate limit threshold and sliding window configuration (e.g., N responses per M seconds) — Claude picks something reasonable for a ~300-person community with ~20-30 concurrent users at peak.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authentication & Auth Patterns
- `src/lib/auth-helpers.ts` — Existing `handleAuthCallback()` with fail-closed Discord API call pattern (2FA check). Extend this for guilds check.
- `src/contexts/AuthContext.tsx` — Auth provider with sign-in/sign-out flow, `onAuthStateChange` handling
- `src/components/auth/AuthErrorPage.tsx` — Existing error page component to reuse for non-member rejection

### Response Submission
- `supabase/functions/submit-vote/index.ts` — Existing Edge Function for response submission. Rate limiting gets added here.
- `src/hooks/useVoteSubmit.ts` — Client-side hook that calls the Edge Function and handles error toasts

### Database & Schema
- `src/lib/types/database.types.ts` — Generated Supabase types (profiles table will need guild membership column)
- `supabase/migrations/` — Migration files for schema changes

### Project Context
- `.planning/DESIGN-SYSTEM.md` — Terminology mapping (suggestion/response vs poll/vote)
- `.planning/REQUIREMENTS.md` — AUTH-03, VOTE-04, TEST-04 requirement details

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuthErrorPage` component: Already handles 2FA rejection — extend with a "not-in-server" error reason
- `handleAuthCallback()` in `auth-helpers.ts`: Already calls Discord API with `provider_token` for 2FA — add guilds check in the same flow
- `useVoteSubmit` hook: Already handles Edge Function errors with Sonner toasts — rate limit errors flow through the same path
- `supabase/functions/_shared/cors.ts`: Shared CORS config for Edge Functions

### Established Patterns
- Fail-closed auth: If any check fails, user is signed out immediately (no partial access)
- Edge Function for writes: All response submissions go through `submit-vote` (server-side validation)
- Sonner toasts for user feedback on errors
- Supabase CLI migrations for schema changes

### Integration Points
- `signInWithOAuth` call in AuthContext — needs `guilds` scope added to scopes string
- `handleAuthCallback()` — needs guilds API call added after 2FA check
- `profiles` table — needs column for guild membership status
- `submit-vote` Edge Function — needs Upstash Redis rate limit check before processing

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-response-integrity*
*Context gathered: 2026-04-07*
