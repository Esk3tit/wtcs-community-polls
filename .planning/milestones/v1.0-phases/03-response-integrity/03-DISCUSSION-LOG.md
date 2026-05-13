# Phase 3: Response Integrity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 03-response-integrity
**Areas discussed:** Membership check timing, Non-member experience, Rate limiting config, Rate limit feedback

---

## Membership Check Timing

| Option | Description | Selected |
|--------|-------------|----------|
| At login only (Recommended) | Check guilds during sign-in (alongside 2FA check), store result in profiles table. Simple, one Discord API call. Downside: if user leaves server after login, they can still respond until next login. | ✓ |
| At login + re-check on response | Check at login AND re-verify in the Edge Function before each response. Requires storing provider_token or using a Bot token for server-side re-checks. More secure but more complex. | |
| At response time only | Only check when user tries to respond (in Edge Function). Requires Bot token since provider_token isn't available later. Lets non-members browse freely. | |

**User's choice:** At login only (Recommended)
**Notes:** Extends existing auth-helpers.ts pattern. Provider token only available at sign-in, so this is the natural fit for the OAuth guilds approach.

---

## Non-member Experience

### Q1: What should happen when a non-WTCS-server user tries to log in?

| Option | Description | Selected |
|--------|-------------|----------|
| Block at login (Recommended) | Same pattern as 2FA rejection — sign them out immediately with a clear error page. Links to Discord invite. Consistent with existing fail-closed auth approach. | ✓ |
| Allow browse, block responses | Let non-members log in and browse suggestions, but show error when they try to respond. More permissive. | |
| You decide | Claude picks the approach that best fits existing auth patterns. | |

**User's choice:** Block at login (Recommended)
**Notes:** Consistent with fail-closed pattern established in Phase 1.

### Q2: Should the error page reuse AuthErrorPage?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse AuthErrorPage (Recommended) | Same layout as 2FA error page, different copy. Keeps auth error experience consistent. | ✓ |
| Separate page | Distinct error page for server membership, possibly with more context. | |
| You decide | Claude picks based on component structure. | |

**User's choice:** Reuse AuthErrorPage (Recommended)
**Notes:** Different copy: "Join the WTCS Discord server to participate" with Discord invite button.

---

## Rate Limiting Config

### Q1: What rate limit threshold?

| Option | Description | Selected |
|--------|-------------|----------|
| 5 responses per minute (Recommended) | Per-user sliding window. Generous for normal use, tight for automated abuse. | |
| 10 responses per minute | More permissive, harder to accidentally hit. | |
| 3 responses per minute | Stricter, higher false-positive risk. | |
| You decide | Claude picks reasonable threshold for ~300-person community. | ✓ |

**User's choice:** You decide
**Notes:** Claude's discretion on exact threshold and window configuration.

### Q2: Per-user only or per-user + per-IP?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-user only (Recommended) | Rate limit by authenticated user ID. Simple, aligns with Discord identity model. | ✓ |
| Per-user + per-IP | Belt-and-suspenders approach. More complex but catches shared-network edge cases. | |
| You decide | Claude picks based on threat model. | |

**User's choice:** Per-user only (Recommended)
**Notes:** Per-IP adds complexity without much benefit since login is required.

---

## Rate Limit Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Toast with retry hint (Recommended) | Sonner toast: "Too many responses too quickly. Please wait a moment and try again." Consistent with existing error handling in useVoteSubmit. | ✓ |
| Toast with countdown | Toast with specific countdown timer. More precise but requires passing remaining window time from API. | |
| Disable button temporarily | Disable choice buttons for N seconds with subtle countdown. Prevents re-attempts visually. | |
| You decide | Claude picks approach fitting existing error patterns. | |

**User's choice:** Toast with retry hint (Recommended)
**Notes:** Consistent with existing Sonner toast patterns in useVoteSubmit hook.

---

## Claude's Discretion

- Exact rate limit threshold and sliding window configuration (user deferred this decision)

## Deferred Ideas

None — discussion stayed within phase scope.
