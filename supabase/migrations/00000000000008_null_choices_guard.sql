-- 00000000000008_null_choices_guard.sql
--
-- Fix: cardinality(NULL) returns NULL which bypasses the IF guards in both
-- poll RPCs. Wrap cardinality() with COALESCE(..., 0) so a NULL p_choices
-- array is treated as zero choices and correctly rejected.

-- =====================================================================
-- FIX: Recreate create_poll_with_choices with COALESCE(cardinality(), 0)
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
  IF COALESCE(cardinality(p_choices), 0) < 2
     OR COALESCE(cardinality(p_choices), 0) > 10 THEN
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
-- FIX: Recreate update_poll_with_choices with COALESCE(cardinality(), 0)
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
  IF COALESCE(cardinality(p_choices), 0) < 2
     OR COALESCE(cardinality(p_choices), 0) > 10 THEN
    RAISE EXCEPTION 'Choices must be between 2 and 10'
      USING ERRCODE = 'P0004';
  END IF;

  -- Lock current choice rows to serialize against concurrent vote inserts.
  PERFORM 1
  FROM public.choices
  WHERE poll_id = p_poll_id
  FOR UPDATE;

  -- Defense-in-depth: re-check the edit lock at the DB layer.
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

-- Re-apply permission restrictions (CREATE OR REPLACE resets grants)
REVOKE EXECUTE ON FUNCTION public.create_poll_with_choices(TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_poll_with_choices(TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, UUID, TEXT[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_poll_with_choices(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_poll_with_choices(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT[]) TO service_role;
