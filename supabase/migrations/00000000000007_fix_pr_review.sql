-- 00000000000007_fix_pr_review.sql
--
-- Fixes from PR #3 review:
--   1. Replace array_length() with cardinality() in both poll RPCs to
--      correctly reject empty arrays (array_length returns NULL for
--      empty arrays, bypassing the 2..10 guard).
--   2. REVOKE EXECUTE FROM PUBLIC on SECURITY DEFINER RPCs and GRANT
--      only to service_role — prevents direct PostgREST calls from
--      authenticated users bypassing the Edge Function admin gate.
--   3. Add FOR UPDATE lock on choices rows in update_poll_with_choices
--      to serialize against concurrent vote inserts (race condition fix).
--   4. Change poll-images bucket ON CONFLICT to DO UPDATE so the
--      migration converges on intended config even if bucket already
--      exists with different settings.

-- =====================================================================
-- FIX 1a: Recreate create_poll_with_choices with cardinality()
-- =====================================================================
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
  IF cardinality(p_choices) < 2 OR cardinality(p_choices) > 10 THEN
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

-- =====================================================================
-- FIX 1b + 3: Recreate update_poll_with_choices with cardinality()
--             and FOR UPDATE lock on choices before vote-exists check
-- =====================================================================
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
  IF cardinality(p_choices) < 2 OR cardinality(p_choices) > 10 THEN
    RAISE EXCEPTION 'Choices must be between 2 and 10'
      USING ERRCODE = 'P0004';
  END IF;

  -- Lock current choice rows to serialize against concurrent vote inserts.
  -- A concurrent submit-vote will block here instead of racing past the
  -- EXISTS check and losing its vote to the subsequent DELETE cascade.
  PERFORM 1
  FROM public.choices
  WHERE poll_id = p_poll_id
  FOR UPDATE;

  -- Defense-in-depth: re-check the edit lock at the DB layer. The Edge Function
  -- also guards this, but this RPC is SECURITY DEFINER so a misbehaving caller
  -- should still be blocked. vote_counts is a cache -- use EXISTS on votes.
  IF EXISTS (SELECT 1 FROM public.votes WHERE poll_id = p_poll_id) THEN
    RAISE EXCEPTION 'Cannot update poll: responses already received'
      USING ERRCODE = 'P0003';
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
    RAISE EXCEPTION 'Poll not found: %', p_poll_id
      USING ERRCODE = 'P0002';
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

COMMENT ON FUNCTION public.create_poll_with_choices IS
  'Atomic poll + choices insert. Called by create-poll Edge Function via service role. Validates 2..10 choices using cardinality() (not array_length which returns NULL for empty arrays).';

COMMENT ON FUNCTION public.update_poll_with_choices IS
  'Atomic poll + choices replace. Called by update-poll Edge Function via service role. Validates 2..10 choices (P0004) using cardinality(). Locks choice rows FOR UPDATE to serialize against concurrent votes, then re-checks the D-17 edit lock (P0003, EXISTS on votes). Returns P0002 if the poll_id does not exist. Any exception rolls back the entire operation.';

-- =====================================================================
-- FIX 2: REVOKE EXECUTE FROM PUBLIC, GRANT to service_role only
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.create_poll_with_choices(TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_poll_with_choices(TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, UUID, TEXT[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_poll_with_choices(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_poll_with_choices(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT[]) TO service_role;

-- =====================================================================
-- FIX 4: Converge poll-images bucket config on intended settings
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'poll-images',
  'poll-images',
  true,
  2 * 1024 * 1024,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
