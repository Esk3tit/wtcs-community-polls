-- ============================================================
-- Row Level Security Policies
-- All data writes go through Edge Functions with service_role key
-- or SECURITY DEFINER RPC functions.
-- Only SELECT policies exist for authenticated on data tables.
-- Exception: profiles has a narrow self-update policy for
-- discord_username and avatar_url ONLY.
-- CRITICAL (R2 fix): mfa_verified is NOT in the self-update policy.
-- It is set exclusively via the update_profile_after_auth RPC.
-- ============================================================

-- Admin Discord IDs: readable by authenticated (for client-side admin check)
ALTER TABLE public.admin_discord_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin Discord IDs are viewable by authenticated users"
  ON public.admin_discord_ids
  FOR SELECT
  TO authenticated
  USING (true);

-- Profiles: all authenticated users can read all profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Profiles: users can update ONLY their own row, ONLY specific columns
-- The column restriction is enforced by the profile_self_update_allowed
-- trigger (see triggers migration). Allowed: discord_username, avatar_url.
-- NOT allowed: id, discord_id, is_admin, mfa_verified, created_at.
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Categories: all authenticated users can read categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are viewable by authenticated users"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (true);

-- Polls: all authenticated users can read polls
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Polls are viewable by authenticated users"
  ON public.polls
  FOR SELECT
  TO authenticated
  USING (true);

-- Choices: all authenticated users can read choices
ALTER TABLE public.choices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Choices are viewable by authenticated users"
  ON public.choices
  FOR SELECT
  TO authenticated
  USING (true);

-- Votes: users can only see their own votes
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own votes"
  ON public.votes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Vote counts: only visible if user has voted on that poll
ALTER TABLE public.vote_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vote counts visible to voters"
  ON public.vote_counts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.votes
      WHERE votes.poll_id = vote_counts.poll_id
      AND votes.user_id = auth.uid()
    )
  );

-- ============================================================
-- IMPORTANT: No INSERT or DELETE policies for authenticated role
-- on any table. All data mutations go through Supabase Edge
-- Functions using the service_role key, which bypasses RLS.
-- The ONLY UPDATE policy is the narrow profile self-update above,
-- which is guarded by the profile_self_update_allowed trigger to
-- block changes to protected columns (including mfa_verified).
-- ============================================================
