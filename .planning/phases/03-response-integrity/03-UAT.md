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

### 3. Error Page Invite Link
expected: On the not-in-server error page, clicking "Join the WTCS Discord Server" opens the WTCS Discord invite (discord.gg/aUe8NGP3U2). "Try Signing In Again" button is also present.
result: skipped
reason: Cannot reach not-in-server error page without 2FA-enabled non-member account

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
passed: 4
issues: 0
pending: 0
skipped: 2

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
