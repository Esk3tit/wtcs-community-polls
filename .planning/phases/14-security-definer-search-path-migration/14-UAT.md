---
status: complete
phase: 14-security-definer-search-path-migration
source:
  - .planning/phases/14-security-definer-search-path-migration/14-01-SUMMARY.md
started: 2026-05-17T08:17:06Z
updated: 2026-05-17T08:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test (local stack)
expected: |
  Local Supabase stack comes up clean from scratch — migrations 00..00 through
  00..14 all apply in order, exit 0. `tests/sql/is_current_user_admin_regression.sql`
  runs against the local DB and reports 6 PASS, 0 FAIL, psql exit 0. Proves the
  migration sequence is deterministic and reproducible from a fresh checkout.
result: pass
evidence: |
  $ docker exec ... psql ... < tests/sql/is_current_user_admin_regression.sql
  BEGIN
  RESET
  INSERT 0 4 / INSERT 0 4 / INSERT 0 1 / CREATE FUNCTION
  NOTICE: PASS admin: t == t
  NOTICE: PASS non_admin: f == f
  NOTICE: PASS mfa_false: f == f
  NOTICE: PASS guild_false: f == f
  NOTICE: PASS audit_log/admin: 1 canary row(s) visible under authenticated role
  NOTICE: PASS audit_log/non_admin: 0 canary rows visible under authenticated role (RLS correctly hid the row)
  ROLLBACK

### 2. Production LandingPage renders for signed-out visitors
expected: |
  Visit https://polls.wtcsmapban.com in a fresh incognito window. The
  LandingPage card renders (title, subtitle, "Sign in with Discord" button,
  authenticity footer). No console errors. Proves the SPA shell + Auth
  bootstrap path are clean post-Migration-14.
result: pass

### 3. Discord OAuth sign-in flow
expected: |
  From https://polls.wtcsmapban.com, click "Sign in with Discord". Discord
  OAuth opens, you complete the flow (or it auto-redirects if cached), and
  you land back on the site signed in. The MFA gate (mandatory 2FA) still
  honors — if your Discord account lacks 2FA, you're redirected to
  /auth/error with the actionable copy. Proves `handle_new_user` (hardened)
  + `update_profile_after_auth` (4-param only; 3-param dropped) still execute
  correctly under `search_path = ''` on the OAuth callback path.
result: pass

### 4. Production vote round-trip (re-confirm)
expected: |
  Signed in as a community member, cast a vote on any active poll (the same
  "Tes / test" poll from Task 08b smoke vote is fine, OR a different one).
  Vote submits without error. Response count increments visibly. You see your
  vote reflected in the UI. Proves `validate_vote_choice` BEFORE-INSERT trigger
  + `increment_vote_count` AFTER-INSERT trigger + `public.vote_counts` write
  path are intact post-Migration-14.
result: pass

### 5. Admin dashboard accessible
expected: |
  Signed in as an admin (Discord account opted into admin_discord_ids with MFA
  + WTCS guild membership), navigate to /admin. The admin dashboard loads.
  Admin-only UI elements render (e.g., Create poll, Manage categories,
  Admins list, Resolution toggle). Proves `is_current_user_admin()` returns
  TRUE for the (is_admin AND mfa_verified AND guild_member) chain — its
  body-identical rewrite preserved admin RLS semantics.
result: pass

### 6. supabase migration list --linked shows clean history
expected: |
  Run `npx supabase migration list --linked` against the linked production
  project (cbjspmwgyoxxqukcccjr). Output shows a clean linear history:
  `00000000000000` → `00000000000014` on both Local and Remote sides, no
  orphan `20260412…`/`20260512…` timestamp entries. Proves the W3
  migration-history repair (2 `migration repair` commands + `db push`)
  left no residue.
result: pass
evidence: |
  $ npx supabase migration list --linked
     Local          | Remote         | Time (UTC)
    ----------------|----------------|----------------
     00000000000000 | 00000000000000 | 00000000000000
     00000000000001 | 00000000000001 | 00000000000001
     00000000000002 | 00000000000002 | 00000000000002
     00000000000003 | 00000000000003 | 00000000000003
     00000000000004 | 00000000000004 | 00000000000004
     00000000000005 | 00000000000005 | 00000000000005
     00000000000006 | 00000000000006 | 00000000000006
     00000000000007 | 00000000000007 | 00000000000007
     00000000000008 | 00000000000008 | 00000000000008
     00000000000009 | 00000000000009 | 00000000000009
     00000000000010 | 00000000000010 | 00000000000010
     00000000000011 | 00000000000011 | 00000000000011
     00000000000012 | 00000000000012 | 00000000000012
     00000000000013 | 00000000000013 | 00000000000013
     00000000000014 | 00000000000014 | 00000000000014

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
