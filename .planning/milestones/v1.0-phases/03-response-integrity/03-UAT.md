---
status: complete
phase: 03-response-integrity
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md]
started: 2026-04-08T03:00:00Z
updated: 2026-04-08T03:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run `npm run dev`. App boots without errors. Open the app in browser. Homepage loads and displays suggestions.
result: pass

### 2. Non-Member Login Rejection
expected: A Discord user who is NOT in the WTCS Discord server attempts to sign in. After OAuth redirect, they are shown the error page with heading "WTCS Server Membership Required" and a "Join the WTCS Discord Server" button linking to the invite URL. They are NOT signed in.
result: skipped
reason: Burner account lacks 2FA (phone already used on main account); 2FA gate triggers first. Redirect to error page confirmed working. Deferred to team testing.
resolution: "Superseded by Second-Human Verification PASS (2026-05-03); Phase 20 closure. See § Second-Human Verification below."

### 3. Error Page Invite Link
expected: On the not-in-server error page, clicking "Join the WTCS Discord Server" opens the WTCS Discord invite (discord.gg/aUe8NGP3U2). "Try Signing In Again" button is also present.
result: skipped
reason: Cannot reach not-in-server error page without 2FA-enabled non-member account
resolution: "Superseded by Second-Human Verification PASS (2026-05-03); Phase 20 closure. See § Second-Human Verification below."

### 4. Member Login Success
expected: A Discord user who IS in the WTCS Discord server and has 2FA enabled can sign in successfully. After OAuth redirect, they land on the homepage with their session active (not redirected to error page).
result: pass

### 5. Vote Submission Works for Members
expected: A logged-in WTCS member can submit a vote on an active suggestion. Vote is recorded, toast shows "Response recorded", and the choice is marked as selected.
result: pass

### 6. Rate Limit on Rapid Submissions
expected: Submit 6+ votes in rapid succession (within 60 seconds). After the 5th, subsequent attempts show a toast: "Too many responses too quickly. Please wait a moment and try again." No optimistic update occurs for rate-limited votes.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]

## Second-Human Verification

> Phase 8 / TEST-10 closure. The original `result: skipped` records above
> are preserved. This section appends executor-by-executor evidence per
> test. Runbook: `.planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md`
> (D-13). Phase 8 closure does NOT block on these fields being filled in
> (D-11) — the artifact (template + runbook) is the deliverable; evidence
> appears asynchronously when a qualified tester is available.

### Test 2 — Non-Member Login Rejection

- executor: test-dev-account (2FA-enabled Discord, non-WTCS-member, separate from original Phase 03 executor)
- verified-at: 2026-05-03T17:58:00Z
- result: pass
- notes: |
    Ran on production https://polls.wtcsmapban.com from incognito profile (zero pre-existing cookies).
    Completed Discord OAuth handshake with test-dev account; redirected back to:
    https://polls.wtcsmapban.com/auth/error?reason=not-in-server
    Error page rendered correctly: heading "WTCS Server Membership Required",
    "Join the WTCS Discord Server" button (black) and "Try Signing In Again" link both visible.
    DevTools cookies pane: no Supabase auth cookies set for polls.wtcsmapban.com.
    Page reload stayed on the error page (no session was created).

### Test 3 — Error Page Invite Link

- executor: test-dev-account (same session as Test 2)
- verified-at: 2026-05-03T17:58:00Z
- result: pass
- notes: |
    Continued from Test 2 error page (no navigation away).
    "Join the WTCS Discord Server" href resolved to https://discord.gg/aUe8NGP3U2.
    Click opened a new tab landing on the WTCS Discord invite page
    ("War Thunder Esports Official Discord — Gaijin", 33,543 online / 93,735 members,
    "Accept Invite" button visible).
    Returned to error page tab; "Try Signing In Again" returned the browser to the
    Discord OAuth approval/auth flow (re-prompted for OAuth scope grant).

## UAT-01 Acceptance Basis

This section records WHY the 2026-05-03 second-human PASS satisfies UAT-01 without a fresh run, per Phase 20 decision D-03 (gate-path-unchanged diff). It documents the specific evidence confirming that the non-member rejection path in production is identical to the path exercised during the second-human verification.

**Client-side guild check (the exercised path).** The non-member rejection is implemented in `src/lib/auth-helpers.ts` at lines 191-202. At line 191 the guild membership is evaluated (`const isMember = guilds.some(g => g.id === WTCS_GUILD_ID)`). If the user is not a member, the `if (!isMember)` block at lines 193-202 calls `supabase.auth.signOut()` and returns `{ success: false, reason: 'not-in-server' }` before any further server interaction. The `update_profile_after_auth` RPC call, which performs the post-success profile write, does not appear until line 209 — after the non-member return. A non-member never reaches that RPC.

**Error surface files unchanged.** `src/components/auth/AuthErrorPage.tsx` and `src/routes/auth/error.tsx` (the `reason` param parsing) are unchanged since April 2026. The error page rendering path exercised by the 2026-05-03 run is identical to the current production code.

**Migration basis (narrow and factually correct).** Migrations 14 and 15 landed after 2026-05-03 and are the only post-run changes that touch server-side auth-adjacent code. Migration 14 (`harden_security_definer_search_path`) applies search_path lockdown to several SECURITY DEFINER functions: `profile_self_update_allowed`, `handle_new_user`, `is_current_user_admin`, `increment_vote_count`, `validate_vote_choice`, and `update_profile_after_auth`. These are behavior-identical security hardening changes — they do not alter the membership-rejection decision logic in any of those functions. Migration 15 (`trusted_profile_update_guc`) changes the trusted-context session GUC for the post-success profile-write RPC `update_profile_after_auth`. The load-bearing, narrow claim is: a non-member never reaches the `update_profile_after_auth` RPC (the post-success profile-write path that migrations 14 and 15 touch), because the client-side guild check in `auth-helpers.ts` rejects and signs out before that RPC runs. It is important to note that `handle_new_user` — one of the functions hardened in migration 14 — fires from the `on_auth_user_created` trigger on `auth.users` during OAuth signup, before the client-side non-member guild check. It is therefore not gated behind member success. The hardening applied to it and the other functions in migration 14 is purely a search_path/security concern, not a change to the membership-rejection path.

**Git-log anchor.** The last gate-relevant change to the auth-helpers.ts gate files was 2026-05-01 (a comment-only archaeology strip), which predates the 2026-05-03 second-human run. No functional change to the non-member rejection path has occurred since that run.

**Conclusion.** The non-member rejection path is fully client-side and unchanged since the second-human run. The migrations that landed after 2026-05-03 do not affect the exercised path. The 2026-05-03 PASS evidence remains valid, and UAT-01 is satisfied without a fresh run per decision D-03.

**Phase 20 formal closure date: 2026-06-04.**

**Server-side vs client-side terminology.** ROADMAP.md and REQUIREMENTS.md describe a "server-side membership gate", but the path Tests 2 and 3 exercise is the client-side OAuth guild check in `auth-helpers.ts` that rejects and signs out before any RPC. Both descriptions refer to the same membership-enforcement outcome: a non-member is denied access. The client-side guild check is the layer the live non-member run actually exercised. The server-side `admin_discord_ids` / RLS layer is a defense-in-depth backstop that the non-member never reaches. The evidence remains valid under either label — this paragraph exists only to remove the terminology drift flagged during cross-AI review.

**D-05 narrative artifact.** A literal screenshot of the original 2026-05-03 run is not available and cannot be reproduced: it was a one-time historical live event run by `test-dev-account` (a 2FA-enabled non-WTCS-member burner account) that cannot be re-screenshotted after the fact. Per decision D-05, the lightest sufficient artifact is the existing narrative evidence and verdict already recorded in § Second-Human Verification above, optionally supplemented by a current confirming screenshot of the reproducible `/auth/error?reason=not-in-server` page (which renders directly from its route per D-06, no special account needed — any operator can visit the URL directly). The narrative and verdict recorded in § Second-Human Verification are accepted as satisfying the success criterion's "screenshot or screen-recording reference" requirement for this non-reproducible historical event.
