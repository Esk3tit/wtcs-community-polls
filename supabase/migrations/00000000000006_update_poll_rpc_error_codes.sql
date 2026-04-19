-- 00000000000006_update_poll_rpc_error_codes.sql
--
-- ME-01 from phase 04 code review: replace free-form RAISE EXCEPTION
-- messages in update_poll_with_choices with stable SQLSTATE codes so the
-- update-poll Edge Function can match on rpcError.code instead of
-- fragile /responses already received/i regex on rpcError.message.
--
-- Error code allocation (P0001 is reserved for raise_exception default;
-- we use custom codes in the PostgreSQL user-defined SQLSTATE range
-- 'P0xxx' — the 5-char code must not collide with documented codes):
--   P0002 -> poll not found
--   P0003 -> responses already received (edit lock)
--   P0004 -> choice count out of range (2..10)
--
-- This migration is append-only — we DROP + CREATE the function to
-- replace its body in place. Signature and semantics are unchanged
-- except for the exception metadata.

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
    RAISE EXCEPTION 'Choices must be between 2 and 10'
      USING ERRCODE = 'P0004';
  END IF;

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

COMMENT ON FUNCTION public.update_poll_with_choices IS
  'Atomic poll + choices replace. Called by update-poll Edge Function via service role. Validates 2..10 choices (P0004) AND re-checks the D-17 edit lock (P0003, EXISTS on votes) at the DB layer. Returns P0002 if the poll_id does not exist. Any exception rolls back both the poll UPDATE and the choice replacement so the poll cannot be left in a zero-choices state.';
