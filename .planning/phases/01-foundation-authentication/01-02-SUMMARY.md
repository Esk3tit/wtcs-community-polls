---
phase: 01-foundation-authentication
plan: 02
subsystem: database
tags: [supabase, postgres, rls, triggers, schema, security-definer, upsert]

# Dependency graph
requires: []
provides:
  - "Complete 7-table Supabase schema (profiles, categories, polls, choices, votes, vote_counts, admin_discord_ids)"
  - "RLS policies: SELECT-only on data tables, narrow UPDATE on profiles (username/avatar only)"
  - "update_profile_after_auth SECURITY DEFINER RPC for server-side mfa_verified updates"
  - "Profile sync trigger with COALESCE discord_id extraction and admin derivation"
  - "Vote count upsert trigger and choice-poll validation trigger"
  - "Admin seed via admin_discord_ids config table"
affects: [01-03, 01-04, 02-reads, 03-integrity, 04-admin]

# Tech tracking
tech-stack:
  added: [supabase-cli-config]
  patterns: [rls-default-deny, security-definer-rpc, upsert-triggers, admin-config-table]

key-files:
  created:
    - supabase/config.toml
    - supabase/migrations/00000000000000_schema.sql
    - supabase/migrations/00000000000001_rls.sql
    - supabase/migrations/00000000000002_triggers.sql
    - supabase/seed.sql

key-decisions:
  - "admin_discord_ids config table instead of pre-seeded profile rows (R1 FK fix)"
  - "mfa_verified blocked from client writes, only settable via SECURITY DEFINER RPC (R2 fix)"
  - "Discord ID extraction via COALESCE(provider_id, sub, id) with WARNING fallback (R2 fix)"

patterns-established:
  - "RLS default-deny: all tables have RLS enabled, only explicit SELECT policies for authenticated"
  - "SECURITY DEFINER RPC: sensitive column updates go through server-side functions, not client RLS"
  - "Upsert triggers: vote_counts uses INSERT ON CONFLICT for automatic row creation"
  - "Admin derivation: admin status derived at login time from config table, not pre-seeded"

requirements-completed: [ADMN-01, INFR-03]

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 01 Plan 02: Database Schema Summary

**Complete Supabase schema with 7 tables, RLS default-deny policies, SECURITY DEFINER RPC for mfa_verified, and admin derivation via config table**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-06T22:09:38Z
- **Completed:** 2026-04-06T22:11:52Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- Full database schema with 7 tables covering all application needs through Phase 5
- RLS default-deny security: SELECT-only on data tables, narrow profile UPDATE (username/avatar only, mfa_verified blocked)
- SECURITY DEFINER RPC function (update_profile_after_auth) as the only path to set mfa_verified
- Profile sync trigger with COALESCE discord_id extraction chain and admin derivation from admin_discord_ids
- Vote integrity: choice-poll validation trigger and vote count upsert trigger
- Admin seeding via config table (no FK constraint conflicts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database schema migration with tables, indexes, and Supabase config** - `d7cad2e` (feat)
2. **Task 2: Create RLS policies, triggers with RPC function, and admin seed** - `eead623` (feat)

## Files Created/Modified
- `supabase/config.toml` - Supabase CLI project config with Discord OAuth provider
- `supabase/migrations/00000000000000_schema.sql` - All 7 tables with constraints, indexes, comments
- `supabase/migrations/00000000000001_rls.sql` - RLS enabled on all tables, 8 policies (7 SELECT + 1 narrow UPDATE)
- `supabase/migrations/00000000000002_triggers.sql` - 4 triggers + update_profile_after_auth RPC function
- `supabase/seed.sql` - Admin Discord ID seed data with placeholder IDs

## Decisions Made
- Used admin_discord_ids config table instead of pre-seeded profile rows to avoid FK constraint conflicts (R1 review fix)
- Blocked mfa_verified from client writes via trigger guard; only settable via SECURITY DEFINER RPC (R2 review fix)
- Discord ID extracted via COALESCE chain (provider_id, sub, id) with RAISE WARNING fallback (R2 review fix)
- Profile self-update trigger fires only for `authenticated` role via WHEN clause

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Admin Discord IDs in seed.sql need to be replaced with real values before deployment.

## Next Phase Readiness
- Schema is complete and ready for Plan 03 (Supabase project setup + Discord OAuth config)
- Plan 04 (auth callback) can use the update_profile_after_auth RPC function
- All Phase 2+ plans can read from these tables via RLS policies

## Self-Check: PASSED

- All 5 created files verified on disk
- Task 1 commit `d7cad2e` verified in git log
- Task 2 commit `eead623` verified in git log
- Schema: 7 CREATE TABLE statements confirmed
- RLS: 7 ENABLE ROW LEVEL SECURITY, 8 CREATE POLICY confirmed
- Triggers: 4 CREATE TRIGGER confirmed
- RPC: update_profile_after_auth present
- mfa_verified block: exception message confirmed
- COALESCE chain: discord_id extraction confirmed

---
*Phase: 01-foundation-authentication*
*Completed: 2026-04-06*
