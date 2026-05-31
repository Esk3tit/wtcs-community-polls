# DBHY-03 smoke vote round-trip — PASS

**Captured:** 2026-05-17 at https://polls.wtcsmapban.com
**Screenshot:** smoke-vote-roundtrip.png

## What was exercised

Admin signed in via Discord OAuth on the production site, cast a vote on the
"Tes / test" poll (Yes), and watched the UI render the result.

The vote round-trip exercises the entire post-Migration-14 write path:

1. Browser → `submit-vote` Edge Function (RPC; user JWT)
2. `submit-vote` validates and INSERTs into `public.votes`
3. `validate_vote_choice` BEFORE-INSERT trigger fires (Migration 14 hardened
   — `SET search_path = ''`) — accepts the (poll_id, choice_id) tuple.
4. `increment_vote_count` AFTER-INSERT trigger fires (Migration 14 hardened
   — `SET search_path = ''`, body already qualified `INSERT INTO
   public.vote_counts`) — writes/updates the running count.
5. Client polls the polls_effective view; row visibility passes RLS
   (`is_current_user_admin()` hardened in Migration 14 — body-identical,
   only search_path value changed from 'public' to '').
6. UI renders: "Yes 100% (1) — 1 total response — 1 community response".

## Result

| Phase 14 hardened function | Exercised by this round-trip? |
|-----------------------------|--------------------------------|
| handle_new_user             | (not exercised — only fires on signup) |
| increment_vote_count        | YES — trigger fired to write vote_counts |
| is_current_user_admin       | YES — RLS gate on vote_counts read |
| profile_self_update_allowed | (not exercised — profile write path) |
| update_profile_after_auth   | (not exercised — sign-in path; re-validated on next admin login) |
| validate_vote_choice        | YES — trigger fired to accept the choice |

3 of the 6 hardened functions are touched directly by this single user action.
Zero errors. Vote count rendered correctly. DBHY-03 satisfied.
