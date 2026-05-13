---
phase: 04-admin-panel-suggestion-management
plan: 01
subsystem: database
tags: [supabase, postgres, rls, plpgsql, storage, migration, admin]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: polls/choices/votes/vote_counts/profiles/admin_discord_ids tables + base RLS
  - phase: 02-read-path
    provides: seed polls and categories consumed by read path
  - phase: 03-integrity
    provides: guild_membership enforcement plus profile/auth RPC plumbing
provides:
  - polls_effective lazy-close view (D-12 read path, security_invoker=on)
  - is_current_user_admin() SECURITY DEFINER STABLE helper
  - admin-bypass branches on votes and vote_counts SELECT policies
  - create_poll_with_choices RPC (transactional poll+choices insert, 2..10 guard)
  - update_poll_with_choices RPC (transactional update+replace, HIGH #1 fix)
  - poll-images public storage bucket (2 MB JPG/PNG/WebP allowlist)
  - Seed admin discord IDs + retroactive profile flip
affects: [04-02 edge functions, 04-03 admin UI, 04-04 integration, 05-launch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-analysis tests (readFileSync + regex assertions) fixing migration contents in stone"
    - "SECURITY DEFINER + SET search_path = public on all RPCs to avoid schema-search-path injection"
    - "ALTER VIEW ... SET (security_invoker = on) for A8 RLS inheritance"
    - "Transactional plpgsql wrappers for multi-step mutations (update_poll_with_choices)"

key-files:
  created:
    - supabase/migrations/00000000000005_admin_phase4.sql
    - src/__tests__/admin/admin-migration.test.ts
  modified: []

key-decisions:
  - "update_poll_with_choices wraps UPDATE polls + DELETE choices + INSERT choices in a single plpgsql block (cross-AI review HIGH #1 resolution)"
  - "Defense-in-depth: update_poll_with_choices re-checks the D-17 edit lock (EXISTS on votes) at the DB layer in addition to Edge Function gating"
  - "polls_effective view is created with security_invoker=on so it enforces the caller's RLS on the underlying polls table (A8 mitigation)"
  - "poll-images bucket has no RLS policies on storage.objects — uploads go through get-upload-url Edge Function using service_role, reads via public getPublicUrl"
  - "Remote application deferred to user follow-up: SUPABASE_ACCESS_TOKEN not present and supabase CLI not globally installed; Path B (Dashboard SQL editor) instructions surfaced"

patterns-established:
  - "Single bundled phase migration: one SQL file per phase instead of per-concern micro-migrations"
  - "Every RPC is SECURITY DEFINER with SET search_path = public to prevent search-path injection"
  - "Source-analysis tests guard migration files against drift without requiring a live DB connection"

requirements-completed: [ADMN-04, POLL-01, POLL-05, POLL-06, POLL-07, LIFE-01, LIFE-02, LIFE-03, CATG-01]

# Metrics
duration: 3min
completed: 2026-04-12
---

# Phase 4 Plan 1: Admin Panel DB Substrate Summary

**Phase 4 database substrate landed in a single migration: polls_effective lazy-close view, is_current_user_admin helper, admin-bypass RLS patches, transactional create/update poll RPCs, poll-images bucket, and seed admins with retroactive flip.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-12T00:10:05Z
- **Completed:** 2026-04-12T00:12:29Z
- **Tasks:** 2 of 3 complete (Task 3 is a documented human-action gate — see "Deferred to User" below)
- **Files created:** 2

## Accomplishments

- Authored `supabase/migrations/00000000000005_admin_phase4.sql` — a single bundled migration containing seven discrete sections (view, helper, RLS patches, create RPC, update RPC, bucket, seed admins).
- `update_poll_with_choices` RPC wraps UPDATE polls + DELETE choices + INSERT choices in a single plpgsql block — eliminates the non-transactional data-corruption window flagged as cross-AI review HIGH concern #1.
- Re-checked the D-17 edit lock (`EXISTS(votes)`) at the DB layer inside `update_poll_with_choices` for defense-in-depth.
- `polls_effective` view declared with `ALTER VIEW ... SET (security_invoker = on)` so it inherits caller RLS on `polls` (A8 mitigation).
- Authored 11 source-analysis tests in `src/__tests__/admin/admin-migration.test.ts`; they fix the migration contents in stone and were verified RED (before the migration) and GREEN (after).
- `npm run build` remains clean — no TS regressions.
- Seeded two admin Discord IDs (267747104607305738, 290377966251409410) with a retroactive `profiles.is_admin = true` flip for any pre-existing profile rows.

## Task Commits

1. **Task 1: Source-analysis test (RED)** — `546adf2` (test)
2. **Task 2: Phase 4 admin migration (GREEN)** — `60e7835` (feat)
3. **Task 3: Apply migration to remote Supabase** — DEFERRED (see "Deferred to User" below)

**Plan metadata commit:** appended after this SUMMARY.md is written.

## Files Created/Modified

- `supabase/migrations/00000000000005_admin_phase4.sql` — Phase 4 DB substrate: view + helper + RLS patches + 2 RPCs + bucket + seed admins (237 lines).
- `src/__tests__/admin/admin-migration.test.ts` — 11 regex source-analysis assertions guarding every section of the migration.

## Objects Created by the Migration

| Kind     | Name                                         | Notes                                                                 |
| -------- | -------------------------------------------- | --------------------------------------------------------------------- |
| VIEW     | `public.polls_effective`                     | Lazy-close read view; `security_invoker=on`; exposes `raw_status`     |
| FUNCTION | `public.is_current_user_admin()`             | `SECURITY DEFINER STABLE`, reads `profiles.is_admin`                  |
| POLICY   | `Users can view own votes or admin`          | Replaces `Users can view own votes` on `votes`                        |
| POLICY   | `Vote counts visible to voters or admin`     | Replaces `Vote counts visible to voters` on `vote_counts`             |
| FUNCTION | `public.create_poll_with_choices`            | Atomic poll + choices insert, 2..10 guard                             |
| FUNCTION | `public.update_poll_with_choices`            | Atomic update + choices replace, 2..10 guard, re-checks edit lock     |
| BUCKET   | `storage.buckets` row `poll-images`          | Public, 2 MB, `image/jpeg`, `image/png`, `image/webp` allowlist       |
| SEED     | `admin_discord_ids` rows `267747104607305738`, `290377966251409410` | Plus retroactive `profiles.is_admin` flip   |

## Decisions Made

- **Path B manual deferral:** The execution environment has no `SUPABASE_ACCESS_TOKEN` and no global `supabase` CLI. Rather than stall the phase on a blocking checkpoint, the migration file is committed and the Dashboard SQL editor fallback is surfaced to the user. Plans 04-02/03/04 will be blocked until the 5 verification queries pass against the remote DB.
- **No scope creep:** Migration matches the plan SQL byte-for-byte (comment normalization only — en-dashes replaced with double hyphens to keep the SQL file ASCII-safe).

## Deviations from Plan

None — plan executed exactly as written. The only surface change is cosmetic: non-ASCII em-dashes in SQL comments were normalized to `--` so that `psql` and migration tools do not choke on encoding in legacy environments. No executable SQL was altered.

## Deferred to User (Task 3)

**Task 3 is a `checkpoint:human-action` gate and the execution environment is non-interactive.** Per the user's explicit directive ("Do NOT block indefinitely waiting on manual action — commit the migration file, surface instructions, and let the user confirm"), the migration is committed and these instructions are surfaced here.

### Environment probe

- `SUPABASE_ACCESS_TOKEN` — **unset**
- `which supabase` — not found (global)
- `npx supabase --version` — `2.85.0` (available via devDependencies)
- `supabase/config.toml` — present and configured for local development
- Remote project linked state — not verified from this execution shell

### Recommended path: Option 1 — Set token and run db push locally

```bash
# 1. Create an access token at https://supabase.com/dashboard/account/tokens
#    Scope: default. Starts with "sbp_".
export SUPABASE_ACCESS_TOKEN=sbp_...

# 2. From repo root:
npx supabase link --project-ref <your-project-ref>   # one-time, if not already linked
npx supabase db push
```

### Fallback: Option 2 — Dashboard SQL editor

1. Open the SQL editor: https://supabase.com/dashboard/project/_/sql/new
2. Paste the full contents of `supabase/migrations/00000000000005_admin_phase4.sql`
3. Click **Run** and confirm success
4. Then locally: `npx supabase migration repair --status applied 00000000000005`

### Verification queries (run on remote DB after either path)

```sql
-- 1) Expect 3 rows
SELECT proname FROM pg_proc
WHERE proname IN ('is_current_user_admin', 'create_poll_with_choices', 'update_poll_with_choices');

-- 2) Expect 1 row
SELECT viewname FROM pg_views WHERE viewname = 'polls_effective';

-- 3) Expect 1 row: id='poll-images', public=true, file_size_limit=2097152
SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'poll-images';

-- 4) Expect 2 rows
SELECT discord_id FROM public.admin_discord_ids
WHERE discord_id IN ('267747104607305738', '290377966251409410');

-- 5) Expect 2 rows
SELECT polname FROM pg_policy
WHERE polname IN ('Users can view own votes or admin', 'Vote counts visible to voters or admin');
```

Plans 04-02, 04-03, 04-04 cannot begin execution until these 5 queries return the expected row counts.

## Issues Encountered

- **Authentication gate on Task 3:** `SUPABASE_ACCESS_TOKEN` not available in the shell; the `supabase` CLI is not globally installed. This is not a bug — Task 3 is explicitly marked `checkpoint:human-action` and the plan provides Path B as the intended fallback when Path A is unavailable. Per user directive, the gate is documented rather than waited on.

## User Setup Required

See the "Deferred to User (Task 3)" section above for the single remaining manual step: apply the Phase 4 migration to the remote Supabase project and run the 5 verification queries.

## Next Phase Readiness

- **Ready now (local-only consumers):** Plans 04-02/03/04 can be authored and unit-tested offline. Source-analysis tests and Edge Function tests that do not require a live DB will pass.
- **Blocked until remote apply:** Any integration test or live Edge Function invocation that calls `create_poll_with_choices`, `update_poll_with_choices`, `is_current_user_admin`, reads `polls_effective`, or uploads to `poll-images` will fail until the migration is applied remotely.
- **Invariant established:** After this plan, all public (non-admin) code paths reading poll active/closed status MUST read `polls_effective`, never `polls.status`. Plan 04-04 Task 4 will grep-enforce this invariant.

## Self-Check: PASSED

Verified:
- `supabase/migrations/00000000000005_admin_phase4.sql` exists (237 lines)
- `src/__tests__/admin/admin-migration.test.ts` exists (125 lines)
- Commit `546adf2` exists (test RED)
- Commit `60e7835` exists (migration GREEN)
- `npm run test -- --run src/__tests__/admin/admin-migration.test.ts` → 11/11 passing
- `npm run build` → clean
- All 9 grep acceptance criteria satisfied (is_current_user_admin=4, polls_effective=3, create_poll_with_choices=2, update_poll_with_choices=2, DELETE FROM public.choices=1, seed IDs=1 each, poll-images=3, security_invoker=2)

---
*Phase: 04-admin-panel-suggestion-management*
*Completed: 2026-04-12*
