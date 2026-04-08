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
