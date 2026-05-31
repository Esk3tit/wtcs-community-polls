# TEST-11 deferred — local-stack block (does not affect Phase 14 outcome)

**Captured:** 2026-05-17 (Phase 14 Task 07a)

## What we tried

After Migration 14 was applied to the local Supabase stack, the plan called for
re-running TEST-11 (`e2e/integration/vote-counts-rls.test.ts`) — the 12-cell
vote_counts RLS matrix — to prove that the body-identical `is_current_user_admin()`
rewrite did not drift admin RLS semantics.

```
$ npm run test:integration -- e2e/integration/vote-counts-rls.test.ts --reporter=verbose
…
 FAIL  e2e/integration/vote-counts-rls.test.ts > vote_counts RLS 12-cell matrix (TEST-11)
AuthApiError: Email logins are disabled
Serialized Error: { __isAuthError: true, status: 422, code: 'email_provider_disabled' }
```

## Root cause

Local Supabase CLI 2.92.1 rejects every `signInWithPassword` call against the
local stack with `email_provider_disabled` (HTTP 422), even though the local
`supabase_auth_*` container env shows `GOTRUE_EXTERNAL_EMAIL_ENABLED=true`.

We attempted to configure `[auth.email]` in `supabase/config.toml`:
- `[auth.email] enable_signup = true` (no effect — same error)
- `[auth.email] enabled = true` (config rejected as invalid key)
- removing `[auth.email]` entirely (same error)

The local stack's `app.e2e_seed_allowed=true`-gated fixture seed runs correctly
and inserts the 4 expected fixture users into `auth.users` — the rows are
present and verifiable. The failure is at the gotrue API layer.

This matches the existing project deferral pattern:

> v1.4+ | Local ES256 bug (1.73.x) | deferred | prod unaffected; awaiting upstream Supabase fix

(STATE.md Deferred Items table.)

## Why this does not block Phase 14

TEST-11 is one of two `is_current_user_admin()` correctness checks the plan
specifies. The other — **Task 07b**, a direct SQL regression fixture — bypasses
the gotrue auth API entirely and tests `is_current_user_admin()` directly
inside the database via `SET LOCAL request.jwt.claims` and `SET LOCAL ROLE
authenticated`. Task 07b is strictly stronger evidence than TEST-11 for the
specific cycle-3 Codex HIGH concern ("TEST-11 is not enough to prove
is_current_user_admin behavior" — see 14-REVIEWS.md).

DBHY-03 retains its post-deploy proof: the production cast-a-vote smoke test
(Task 08b D-01) exercises the full `submit-vote` → `increment_vote_count` →
`public.vote_counts` write path against the deployed Migration 14.

## Action

- TEST-11 local re-run **deferred** to v1.4+ alongside the local ES256 bug.
- Task 07b runs in its place as the local mechanical check.
- Production smoke vote (Task 08b) remains the runtime gate.
