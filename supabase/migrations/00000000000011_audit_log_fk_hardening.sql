-- =====================================================================
-- Phase 11 follow-up: audit_log FK + shape hardening
-- Closes Phase 11 code-review W-01 and W-05.
--
-- Migration 10 shipped audit_log with two latent hardening gaps that
-- did not block the v1.2 ship but should be tightened before more
-- audit-writing EFs land:
--
-- 1. actor_id FK defaulted to ON DELETE NO ACTION. If an admin's
--    profile is ever deleted (cascade from auth.users -> profiles is
--    ON DELETE CASCADE per schema.sql), the cascade would be blocked
--    by any audit_log rows referencing that admin. Worse, that block
--    could surface as a 500 against the auth deletion flow.
--    Forensically the audit row MUST survive actor deletion — that is
--    the whole point of an immutable audit trail. Fix: switch the FK
--    to ON DELETE SET NULL so audit rows keep the id-as-tombstone via
--    NULL (matching the cron-actor-null convention) without breaking
--    the actor-FK guarantee.
--
-- 2. target_id is TEXT (admits both UUIDs and Discord snowflakes, per
--    the comment in migration 10). A polymorphic hard FK is not
--    possible. Documenting the intent via a COMMENT plus a CHECK
--    constraint that rejects malformed writes (anything that is neither
--    a UUID nor a Discord snowflake) gives fail-fast on writer bugs
--    while preserving the forensic-survives-delete behaviour that the
--    test cleanup already relies on (toggle-results-visibility.test.ts
--    and create-poll-results-hidden.test.ts both DELETE audit rows
--    explicitly before deleting their polls — proving the awareness of
--    the gap).
--
-- This migration is forward-only and idempotent: re-running it against
-- a DB that already has the new FK or CHECK is safe (DROP CONSTRAINT
-- IF EXISTS + ADD CONSTRAINT IF NOT EXISTS).
-- =====================================================================


-- ---------------------------------------------------------------------
-- SECTION 1 -- W-01: actor_id FK ON DELETE SET NULL
-- ---------------------------------------------------------------------
-- Drop the implicitly-named FK from migration 10 (Postgres derives the
-- name from <table>_<column>_fkey by default). Re-add it with
-- ON DELETE SET NULL so admin-profile deletion does not block on
-- audit_log rows.
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_actor_id_fkey;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_actor_id_fkey
    FOREIGN KEY (actor_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;


-- ---------------------------------------------------------------------
-- SECTION 2 -- W-05: target_id shape CHECK + intent documentation
-- ---------------------------------------------------------------------
-- target_id is intentionally a weak reference (no FK). The audit table
-- is forensically the source of truth, so its rows must survive the
-- deletion of whichever table the target lived in (profile, poll,
-- category). Without a CHECK, malformed writes (typos, accidental
-- empty strings, junk) would silently pollute the column.
--
-- The CHECK admits exactly two shapes:
--   * standard 8-4-4-4-12 lowercase UUID (poll, profile, category ids)
--   * Discord snowflake, 17-19 digits (admin_discord_ids.discord_id)
-- NULL is admitted because cron-actor writes (close-expired-polls
-- variant where the target is the sweep itself, not a single poll)
-- could in principle pass target_id=null. Today only per-row writes
-- exist, but the NOT NULL constraint is deliberately not added so the
-- shape is extensible.
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_target_id_shape;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_target_id_shape CHECK (
    target_id IS NULL
    OR target_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR target_id ~ '^\d{17,19}$'
  );

COMMENT ON COLUMN public.audit_log.target_id IS
  'Weak reference (no FK) intentionally — audit rows survive parent deletion as forensic tombstones. Shape is enforced by audit_log_target_id_shape CHECK: UUID, Discord snowflake (17-19 digits), or NULL. The lookup discipline (target_type + target_id) is the indexed query path; cleanup of stale audit rows is operational, not enforced by DB cascade.';


-- ---------------------------------------------------------------------
-- Rollback notes (Supabase migrations are forward-only -- no down file)
-- ---------------------------------------------------------------------
-- To revert this migration manually against a live DB:
--   1. ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_target_id_shape;
--   2. ALTER TABLE public.audit_log
--        DROP CONSTRAINT audit_log_actor_id_fkey,
--        ADD CONSTRAINT audit_log_actor_id_fkey
--          FOREIGN KEY (actor_id) REFERENCES public.profiles(id);
-- The COMMENT ON COLUMN is informational and need not be reverted.
