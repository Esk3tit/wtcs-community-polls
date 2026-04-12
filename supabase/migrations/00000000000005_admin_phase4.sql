-- =====================================================================
-- Phase 4: Admin Panel & Suggestion Management
-- Bundles: lazy-close view, admin helper, admin-bypass RLS, create-poll
-- RPC, update-poll RPC (transactional -- cross-AI review HIGH #1),
-- poll-images storage bucket, seed admins (incl. retroactive flip)
-- =====================================================================

-- ---------------------------------------------------------------------
-- SECTION 1 -- Lazy-close view (D-12 read path)
-- ---------------------------------------------------------------------
-- D-12: Lazy-close view. Read path uses this; writes still target polls.
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
  status AS raw_status
FROM public.polls;

COMMENT ON VIEW public.polls_effective IS
  'Lazy-close read view: derives effective status by comparing closes_at to now(). Raw status exposed as raw_status for admin UI. D-12 two-layer lazy-then-sweep. INVARIANT: ALL public (non-admin) code paths that care about active/closed status MUST read from this view, never polls.status directly.';

-- A8 mitigation: explicitly mark security_invoker so the view enforces
-- the *caller's* RLS on the underlying polls table (Postgres 15+).
ALTER VIEW public.polls_effective SET (security_invoker = on);


-- ---------------------------------------------------------------------
-- SECTION 2 -- Admin helper function (D-14 + ADMN-04)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

COMMENT ON FUNCTION public.is_current_user_admin IS
  'Returns true if the authenticated caller has profiles.is_admin=true. SECURITY DEFINER so internal lookup bypasses RLS on profiles. STABLE so Postgres can cache within a statement.';


-- ---------------------------------------------------------------------
-- SECTION 3 -- Admin-bypass RLS patches (D-14)
-- ---------------------------------------------------------------------
-- Patch votes SELECT policy: keep "can see own" branch, add "admin bypass" branch.
DROP POLICY IF EXISTS "Users can view own votes" ON public.votes;
CREATE POLICY "Users can view own votes or admin"
  ON public.votes
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_current_user_admin()
  );

-- Patch vote_counts SELECT policy: keep "voter" branch, add "admin bypass" branch.
DROP POLICY IF EXISTS "Vote counts visible to voters" ON public.vote_counts;
CREATE POLICY "Vote counts visible to voters or admin"
  ON public.vote_counts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.votes
      WHERE votes.poll_id = vote_counts.poll_id
      AND votes.user_id = auth.uid()
    )
    OR public.is_current_user_admin()
  );


-- ---------------------------------------------------------------------
-- SECTION 4 -- Transactional create-poll RPC (POLL-01)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_poll_with_choices(
  p_title TEXT,
  p_description TEXT,
  p_category_id UUID,
  p_image_url TEXT,
  p_closes_at TIMESTAMPTZ,
  p_created_by UUID,
  p_choices TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_poll_id UUID;
  choice_text TEXT;
  idx INTEGER := 0;
BEGIN
  IF array_length(p_choices, 1) < 2 OR array_length(p_choices, 1) > 10 THEN
    RAISE EXCEPTION 'Choices must be between 2 and 10';
  END IF;

  INSERT INTO public.polls (title, description, category_id, image_url, closes_at, created_by, status)
  VALUES (p_title, p_description, p_category_id, p_image_url, p_closes_at, p_created_by, 'active')
  RETURNING id INTO new_poll_id;

  FOREACH choice_text IN ARRAY p_choices LOOP
    INSERT INTO public.choices (poll_id, label, sort_order)
    VALUES (new_poll_id, choice_text, idx);
    idx := idx + 1;
  END LOOP;

  RETURN new_poll_id;
END;
$$;

COMMENT ON FUNCTION public.create_poll_with_choices IS
  'Atomic poll + choices insert. Called by create-poll Edge Function via service role. Validates 2..10 choices.';


-- ---------------------------------------------------------------------
-- SECTION 4b -- Transactional update-poll RPC (POLL-06, cross-AI HIGH #1)
-- ---------------------------------------------------------------------
-- Cross-AI review HIGH concern #1: update-poll must NOT perform a non-transactional
-- UPDATE-then-DELETE-then-INSERT sequence. If the reinsert of choices failed after
-- the DELETE, the poll would be left with ZERO choices -- data corruption.
-- This RPC wraps all three operations in a single plpgsql block so any raised
-- exception rolls back the entire statement. The calling Edge Function
-- (update-poll/index.ts in Plan 04-02) MUST call this RPC via supabaseAdmin.rpc(...)
-- and MUST NOT perform the choice replacement via discrete supabase-js chained calls.
CREATE OR REPLACE FUNCTION public.update_poll_with_choices(
  p_poll_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_category_id UUID,
  p_image_url TEXT,
  p_closes_at TIMESTAMPTZ,
  p_choices TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  choice_text TEXT;
  idx INTEGER := 0;
  updated_id UUID;
BEGIN
  IF array_length(p_choices, 1) < 2 OR array_length(p_choices, 1) > 10 THEN
    RAISE EXCEPTION 'Choices must be between 2 and 10';
  END IF;

  -- Defense-in-depth: re-check the edit lock at the DB layer. The Edge Function
  -- also guards this, but this RPC is SECURITY DEFINER so a misbehaving caller
  -- should still be blocked. vote_counts is a cache -- use EXISTS on votes.
  IF EXISTS (SELECT 1 FROM public.votes WHERE poll_id = p_poll_id) THEN
    RAISE EXCEPTION 'Cannot update poll: responses already received';
  END IF;

  UPDATE public.polls
    SET title = p_title,
        description = p_description,
        category_id = p_category_id,
        image_url = p_image_url,
        closes_at = p_closes_at,
        updated_at = now()
    WHERE id = p_poll_id
    RETURNING id INTO updated_id;

  IF updated_id IS NULL THEN
    RAISE EXCEPTION 'Poll not found: %', p_poll_id;
  END IF;

  DELETE FROM public.choices WHERE poll_id = p_poll_id;

  FOREACH choice_text IN ARRAY p_choices LOOP
    INSERT INTO public.choices (poll_id, label, sort_order)
    VALUES (p_poll_id, choice_text, idx);
    idx := idx + 1;
  END LOOP;

  RETURN updated_id;
END;
$$;

COMMENT ON FUNCTION public.update_poll_with_choices IS
  'Atomic poll + choices replace. Called by update-poll Edge Function via service role. Validates 2..10 choices AND re-checks the D-17 edit lock (EXISTS on votes) at the DB layer. Any exception rolls back both the poll UPDATE and the choice replacement so the poll cannot be left in a zero-choices state.';


-- ---------------------------------------------------------------------
-- SECTION 5 -- Storage bucket (D-11)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'poll-images',
  'poll-images',
  true,
  2 * 1024 * 1024,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- No RLS policies on storage.objects for this bucket.
-- SELECT: public bucket, reads via getPublicUrl
-- INSERT/UPDATE/DELETE: only via get-upload-url Edge Function (service_role bypasses RLS)


-- ---------------------------------------------------------------------
-- SECTION 6 -- Seed admins + retroactive flip (D-05)
-- ---------------------------------------------------------------------
INSERT INTO public.admin_discord_ids (discord_id) VALUES
  ('267747104607305738'),  -- Khai (project owner)
  ('290377966251409410')   -- second admin
ON CONFLICT (discord_id) DO NOTHING;

-- Retroactively admin any existing profile whose discord_id is in admin_discord_ids.
-- Safe: only flips false -> true for IDs explicitly in the config table.
UPDATE public.profiles p
SET is_admin = true, updated_at = now()
FROM public.admin_discord_ids a
WHERE p.discord_id = a.discord_id
  AND p.is_admin = false;
