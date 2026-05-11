-- =====================================================================
-- Phase 11: Schema + RLS + EF Foundations
-- Bundles: polls.results_hidden columns, audit_log table + RLS,
-- polls_effective view rewrite, vote_counts SELECT policy rewrite.
-- Atomic: column adds -> audit_log table+RLS -> view rewrite ->
-- vote_counts policy DROP+CREATE. Splitting these across migrations
-- creates a window where the policy references a column not yet
-- projected through the view.
-- =====================================================================


-- ---------------------------------------------------------------------
-- SECTION 1 -- polls columns (VIS-01)
-- ---------------------------------------------------------------------
-- New row-level flag and timestamp on polls. Default false preserves
-- v1.0/v1.1 RSLT-05 behavior (results visible to voters on closed polls).
-- The timestamp is written by the toggle EF directly (mirrors closed_at
-- precedent in close-poll), not via a DB trigger.
ALTER TABLE public.polls
  ADD COLUMN results_hidden BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.polls
  ADD COLUMN results_hidden_changed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.polls.results_hidden IS
  'When true, the vote_counts RLS policy returns 0 rows even for voters. Flipped by the toggle-results-visibility EF; audit row written on every state change.';
COMMENT ON COLUMN public.polls.results_hidden_changed_at IS
  'Set by the EF on every UPDATE (matches closed_at precedent). NULL until first flip.';


-- ---------------------------------------------------------------------
-- SECTION 2 -- audit_log table + RLS (admin-only SELECT)
-- ---------------------------------------------------------------------
-- Append-only audit trail for admin-gated EFs. pgcrypto is already loaded
-- in 00000000000000_schema.sql so gen_random_uuid() is available without
-- redeclaration. actor_id is NULLABLE so cron-driven writes (e.g.,
-- close-expired-polls) can record rows without a profile context.
-- target_id is TEXT (not uuid) so the column admits both UUIDs (profile,
-- poll, category ids) AND Discord snowflakes (admin_discord_ids.discord_id
-- is TEXT). promote-admin Branch 2 writes a Discord snowflake here when an
-- admin pre-authorizes a user who has not yet signed in -- a uuid-typed
-- column would fail with "invalid input syntax for type uuid" and the
-- writeAudit fail-open contract would silently drop that row.
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_log IS
  'Append-only admin-action audit trail. Written by admin-gated EFs (13 emitters in v1.2). Admins-only SELECT. actor_id NULL on cron-driven writes.';

-- Index choices cover the expected admin-UI query shapes: lookup by
-- target (e.g., all rows for a given poll) and lookup by actor over time.
-- Do NOT index before/after JSONB -- it would balloon free-tier storage
-- with little query benefit at v1.2 scale.
CREATE INDEX idx_audit_log_target ON public.audit_log(target_type, target_id);
CREATE INDEX idx_audit_log_actor_created ON public.audit_log(actor_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admin-only SELECT. is_current_user_admin() is defined in migration 9
-- and enforces is_admin AND mfa_verified AND guild_member so direct
-- PostgREST callers cannot bypass the EF integrity check.
CREATE POLICY "Audit log visible to admins"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());

-- No INSERT/UPDATE/DELETE policies are declared. Writes are service-role
-- only via the admin EFs; service-role bypasses RLS automatically. Any
-- attempt to write via an anon or authenticated JWT will return 0 rows
-- affected because no granting policy exists.


-- ---------------------------------------------------------------------
-- SECTION 3 -- polls_effective view rewrite (VIS-09)
-- ---------------------------------------------------------------------
-- Re-projects every prior column (explicit-column form from migration 5)
-- plus the two new columns from SECTION 1. The lazy-close CASE expression
-- is preserved verbatim. security_invoker = on MUST be re-applied in the
-- SAME migration file immediately after CREATE OR REPLACE VIEW because
-- Postgres 15+ resets the flag on REPLACE -- a split would run the view
-- with definer-rights for one prod-window and bypass RLS on polls.
CREATE OR REPLACE VIEW public.polls_effective AS
SELECT
  id,
  title,
  description,
  category_id,
  image_url,
  CASE
    WHEN status = 'active' AND closes_at < now() THEN 'closed'
    ELSE status
  END AS status,
  resolution,
  is_pinned,
  created_by,
  closes_at,
  closed_at,
  created_at,
  updated_at,
  status AS raw_status,
  results_hidden,
  results_hidden_changed_at
FROM public.polls;

ALTER VIEW public.polls_effective SET (security_invoker = on);

COMMENT ON VIEW public.polls_effective IS
  'Lazy-close read view. v1.2: projects results_hidden + results_hidden_changed_at so the React read path branches on visibility without bypassing the view boundary. INVARIANT: all non-admin code paths MUST read this view, never polls directly.';


-- ---------------------------------------------------------------------
-- SECTION 4 -- vote_counts SELECT policy DROP + CREATE (VIS-04)
-- ---------------------------------------------------------------------
-- DROP both legacy policy names. The migration may apply against a DB
-- that has either depending on apply history (migration 1 created the
-- "voters" name, migration 5 replaced it with "voters or admin").
-- IF EXISTS makes this idempotent.
DROP POLICY IF EXISTS "Vote counts visible to voters" ON public.vote_counts;
DROP POLICY IF EXISTS "Vote counts visible to voters or admin" ON public.vote_counts;

-- Authenticated users see vote_counts iff they have voted on this poll
-- AND results are not hidden. Admin reads of vote_counts in production
-- go through service-role-backed Edge Functions (which bypass RLS
-- automatically) -- no JWT-admin OR-branch (VIS-04). Service-role
-- bypasses RLS by Supabase contract; no explicit service_role policy
-- is added. Anon callers have no granting policy on vote_counts and
-- therefore return 0 rows by absence.
CREATE POLICY "Vote counts visible to voters when not hidden"
  ON public.vote_counts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.votes
      WHERE votes.poll_id = vote_counts.poll_id
        AND votes.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.polls
      WHERE polls.id = vote_counts.poll_id
        AND polls.results_hidden = false
    )
  );


-- ---------------------------------------------------------------------
-- Rollback notes (Supabase migrations are forward-only -- no down file)
-- ---------------------------------------------------------------------
-- To revert this migration manually against a live DB:
--   1. Drop the new vote_counts policy by name, then recreate the
--      migration-5 policy ("Vote counts visible to voters or admin").
--   2. Replace the view with the migration-5 column list (no
--      results_hidden / results_hidden_changed_at) and re-apply
--      security_invoker = on.
--   3. Drop the audit_log table (cascades indexes and policy).
--   4. Drop the two polls columns (results_hidden_changed_at first,
--      then results_hidden).
-- Order matters: drop the view-rewrite consumers (policy + view projection)
-- before dropping the columns.
