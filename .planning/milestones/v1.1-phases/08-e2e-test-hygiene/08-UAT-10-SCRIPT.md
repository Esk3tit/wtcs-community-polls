---
phase: 08-e2e-test-hygiene
artifact: TEST-10 second-human runbook
created: 2026-05-02
target_file: .planning/phases/03-response-integrity/03-UAT.md
target_section: ## Second-Human Verification
---

# Phase 8 / TEST-10 — Second-Human UAT Runbook

> Closes Phase 03 UAT Tests 2 + 3 (`Non-Member Login Rejection` and
> `Error Page Invite Link`), which were skipped at v1.0 ship time because
> the original executor's burner Discord account lacked 2FA (the 2FA gate
> triggered before the not-in-server rejection path could be exercised).
>
> Per D-11: Phase 8 ships the runbook + evidence template synchronously;
> the actual session runs ASYNCHRONOUSLY when a qualified tester is
> available. Phase 8 closure does NOT block on the evidence appearing.

## Tester profile (prerequisites)

The tester MUST satisfy ALL of the following:

- Has a Discord account with 2FA ENABLED. (The 2FA gate must clear so the
  not-in-server rejection path actually fires.)

  > Note: REQUIREMENTS.md TEST-10 reads "no 2FA" — that was the OLD blocker. The FIX requires 2FA enabled so the gate clears and the not-in-server rejection path actually fires.
- Is NOT a member of the WTCS Discord server. (If the tester is already a
  member, leave the server temporarily — or recruit someone who isn't.)
- Is NOT the original Phase 03 UAT executor. (The whole point of TEST-10
  is independent second-human evidence.)
- Has a fresh browser profile or incognito window (no existing
  polls.wtcsmapban.com session cookies).

If any prerequisite is unmet, STOP — recruit a different tester. Do not
work around any prerequisite (e.g., disabling 2FA temporarily) — the
verification only counts when the path was actually exercised.

## Pre-test setup (once)

1. Open the production site in a fresh browser profile or incognito:
   <https://polls.wtcsmapban.com>
2. Open browser DevTools → Application → Storage → Cookies. Confirm zero
   `polls.wtcsmapban.com` cookies are present. (If any exist, clear them.)
3. Have a notepad open to capture: executor Discord handle, exact
   timestamp (UTC), pass/fail observation per test, and any unexpected
   behavior to put in `notes:`.

## Test 2 — Non-Member Login Rejection

**What this verifies:** A Discord user who is NOT in the WTCS Discord
server is rejected at OAuth callback and shown the
`WTCS Server Membership Required` error page. They MUST NOT end up with
an active session.

**Steps:**

1. From the homepage, click the `Sign In` button (or whatever entry-point
   element triggers the Discord OAuth flow on the live site).
2. Complete the Discord OAuth handshake with your non-WTCS-member 2FA
   Discord account. Approve the OAuth scope grant when Discord prompts.
3. Wait for the redirect back to `polls.wtcsmapban.com`.

**Expected observation (PASS criteria — all must hold):**

- The browser lands on a URL containing `/auth/error?reason=not-in-server`.
- The page renders the heading `WTCS Server Membership Required`.
- A button labeled `Join the WTCS Discord Server` is visible.
- The button's `href` resolves to `https://discord.gg/aUe8NGP3U2`.
- DevTools → Application → Storage → Cookies shows NO Supabase auth
  cookie set for `polls.wtcsmapban.com` (i.e. session was rejected).
- Reloading the page does NOT log you in — you stay on the error page.

**Capture:** screenshot the error page; record the URL bar; record the
DevTools cookies pane.

If any expected observation is wrong, this is a FAIL — capture screenshots
and a textual description of what you observed instead.

## Test 3 — Error Page Invite Link

**What this verifies:** From the not-in-server error page (which you
reached at the end of Test 2), the `Join the WTCS Discord Server` and
`Try Signing In Again` controls behave correctly.

**Steps (continues from Test 2 — do not navigate away first):**

1. On the not-in-server error page reached at the end of Test 2, click
   `Join the WTCS Discord Server`.
2. Confirm the link opens (in a new tab or current tab — either is
   acceptable; capture which) at `https://discord.gg/aUe8NGP3U2`.
3. Return to the error page tab. Locate the `Try Signing In Again` button.
4. Click `Try Signing In Again`.

**Expected observation (PASS criteria — all must hold):**

- Step 2 lands on `discord.gg/aUe8NGP3U2` (the WTCS invite URL).
- `Try Signing In Again` is visible and clickable on the error page.
- Clicking `Try Signing In Again` returns the browser to the login flow
  (e.g., back to the homepage or to a Discord OAuth re-prompt).

If any expected observation is wrong, this is a FAIL.

## Recording the evidence

Once both tests are complete, fill in this template and paste it into
`.planning/phases/03-response-integrity/03-UAT.md` under the
`## Second-Human Verification` H2 section (which Phase 8 already
appended). Replace each `<…>` placeholder with your actual values.

    ### Test 2 — Non-Member Login Rejection

    - executor: <Discord handle, e.g. `MapCommittee#1234`>
    - verified-at: <UTC ISO 8601, e.g. `2026-05-09T18:42:00Z`>
    - result: <pass | fail>
    - notes: |
        <≥1 line — describe what was observed; if fail, attach screenshot
        path under .planning/phases/08-e2e-test-hygiene/artifacts/test-10-evidence/>

    ### Test 3 — Error Page Invite Link

    - executor: <Discord handle>
    - verified-at: <UTC ISO 8601>
    - result: <pass | fail>
    - notes: |
        <≥1 line>

## Filled-in example (for shape reference — do NOT paste this verbatim)

    ### Test 2 — Non-Member Login Rejection

    - executor: ExampleTester#0001
    - verified-at: 2026-05-09T18:42:00Z
    - result: pass
    - notes: |
        Logged in via Discord with an account NOT in the WTCS server. After the
        OAuth callback completed, the browser landed on /auth/error?reason=not-in-server
        and the heading "WTCS Server Membership Required" rendered. The "Join the
        WTCS Discord Server" CTA was visible and pointed at discord.gg/aUe8NGP3U2.
        Session was NOT established (no Supabase auth cookie present in DevTools).

    ### Test 3 — Error Page Invite Link

    - executor: ExampleTester#0001
    - verified-at: 2026-05-09T18:44:00Z
    - result: pass
    - notes: |
        From the not-in-server error page reached above, clicked "Join the WTCS
        Discord Server" — opened https://discord.gg/aUe8NGP3U2 in a new tab.
        "Try Signing In Again" button was also present and routed back to /login.

## Post-evidence cleanup

- Optionally bump `updated:` in the `03-UAT.md` frontmatter to the same
  ISO timestamp as `verified-at`. (Not blocking; planning-doc hygiene only.)
- If either test failed, file a follow-up GitHub issue against the v1.1
  milestone capturing the failure mode, screenshots, and a proposed
  remediation. Do NOT silently leave a `result: fail` record without a
  tracking issue.
- Drop a quick note in the project Discord/channel so the maintainer knows
  TEST-10 closure evidence has landed.
