# Architecture Patterns

**Domain:** Community polling/voting platform (Supabase-backed SPA)
**Researched:** 2026-04-06

## Recommended Architecture

```
+------------------+       +-------------------+       +---------------------+
|   React SPA      |       |  Supabase Edge    |       |  Supabase Postgres  |
|   (Netlify)      |       |  Functions        |       |                     |
|                  |       |                   |       |  +-----------+      |
|  Auth UI --------+------>|  /cast-vote       +------>|  | votes     |      |
|  Poll Views -----+--+   |  /create-poll     +------>|  | polls     |      |
|  Admin Panel     |  |   |  /admin-action    |       |  | choices   |      |
|                  |  |   +-------------------+       |  | profiles  |      |
|                  |  |                               |  +-----------+      |
|                  |  +--- Direct reads (RLS) ------->|  | vote_counts|     |
|                  |       via supabase-js             |  | categories |     |
+------------------+                                  |  +-----------+      |
        |                                             |       |             |
        |          +-------------------+              |  Triggers update    |
        +--------->| Supabase Auth     |              |  vote_counts on     |
         Discord   | (Discord OAuth)   |              |  INSERT to votes    |
         OAuth     +-------------------+              +---------------------+
                                                              |
                                                      +-------+--------+
                                                      | Supabase       |
                                                      | Storage        |
                                                      | (poll images)  |
                                                      +----------------+
```

### System Architecture: Split Read/Write with Server-Side Validation

**Write path (mutations):** Browser -> Edge Function -> Postgres (with service_role key, bypassing RLS)
**Read path (queries):** Browser -> supabase-js client -> Postgres (through RLS policies)

This split is the correct architecture because:
1. Writes need server-side validation (Discord membership, vote eligibility, admin status) that cannot be trusted to the client
2. Reads are simple, cacheable queries that RLS can gate efficiently
3. Edge Functions act as a thin validation+authorization layer, not a full API server

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **React SPA** | UI rendering, routing, client state, HTTP polling loop | Supabase Auth, Edge Functions (writes), Supabase JS (reads) |
| **Supabase Auth** | Discord OAuth flow, JWT issuance, session management | Discord OAuth API, Postgres (auth.users) |
| **Edge Functions** | Vote casting, poll creation, admin actions, Discord membership verification | Postgres (via service_role), Discord API |
| **Postgres + RLS** | Data storage, read authorization, vote count triggers | Edge Functions (writes), SPA (reads) |
| **Supabase Storage** | Poll image uploads | Edge Functions (upload), SPA (public read URLs) |
| **Discord API** | Membership verification, user metadata | Edge Functions (server-to-server) |

### Data Flow

#### Authentication Flow
```
1. User clicks "Login with Discord"
2. supabase.auth.signInWithOAuth({ provider: 'discord' })
3. Redirect to Discord -> authorize -> callback to Supabase
4. Supabase creates/updates auth.users row with Discord metadata
5. JWT issued containing user ID + app_metadata
6. SPA stores session, includes JWT in all subsequent requests
```

Discord metadata available in `auth.users.raw_user_meta_data`:
- `provider_id` (Discord user ID)
- `full_name` (Discord username)
- `avatar_url`
- `custom_claims.mfa_enabled` (2FA status -- verify exact path in Supabase Discord provider docs)

#### Vote Casting Flow (Write Path)
```
1. User selects choice, clicks "Vote"
2. SPA calls Edge Function: POST /cast-vote { poll_id, choice_id }
3. Edge Function:
   a. Extract user from JWT (supabase.auth.getUser())
   b. Verify user profile exists + passes eligibility checks
   c. Verify poll is open (status='active', deadline not passed)
   d. Verify user hasn't already voted (SELECT from votes)
   e. Verify Discord server membership (call Discord API)
   f. INSERT into votes (poll_id, choice_id, user_id)
   g. Postgres trigger fires: increment vote_counts row
   h. Return success
4. SPA updates local state, begins polling for updated counts
```

#### Live Results Flow (Read Path)
```
1. After voting, SPA starts setInterval (5-10 seconds)
2. Each tick: supabase.from('vote_counts').select('*').eq('poll_id', id)
3. RLS policy: allow SELECT on vote_counts WHERE user has voted on this poll
4. SPA renders updated bar chart / percentage display
5. Interval clears when user navigates away or poll closes
```

#### Poll Creation Flow (Admin Write Path)
```
1. Admin fills poll form (title, description, choices, category, deadline)
2. If image attached: upload to Supabase Storage via Edge Function
3. SPA calls Edge Function: POST /create-poll { ...pollData }
4. Edge Function:
   a. Verify admin role from profiles table
   b. Validate inputs (min 2 choices, valid deadline, etc.)
   c. INSERT into polls + INSERT into choices (transaction)
   d. Initialize vote_counts rows (one per choice, count=0)
   e. Return poll ID
```

## Database Schema

### Core Tables

```sql
-- User profiles (synced from auth.users via trigger on signup)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL UNIQUE,
  discord_username TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  mfa_verified BOOLEAN DEFAULT FALSE,
  account_created_at TIMESTAMPTZ,  -- Discord account age
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poll categories (admin-managed)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Polls
CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id),
  image_url TEXT,               -- Supabase Storage URL or external URL
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed')),
  resolution TEXT               -- NULL while active; 'rejected'/'processing'/'implemented' after close
    CHECK (resolution IS NULL OR resolution IN ('rejected', 'processing', 'implemented')),
  is_pinned BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  closes_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,        -- actual close time (manual or auto)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poll choices
CREATE TABLE choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Votes (one per user per poll, enforced by UNIQUE constraint)
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  choice_id UUID NOT NULL REFERENCES choices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (poll_id, user_id)  -- One vote per user per poll
);

-- Pre-aggregated vote counts (maintained by trigger)
CREATE TABLE vote_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  choice_id UUID NOT NULL REFERENCES choices(id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 0,

  UNIQUE (poll_id, choice_id)
);
```

### Indexes

```sql
-- Vote lookups (has user voted on this poll?)
CREATE INDEX idx_votes_poll_user ON votes(poll_id, user_id);

-- Vote counts lookup (get all counts for a poll)
CREATE INDEX idx_vote_counts_poll ON vote_counts(poll_id);

-- Poll listing (active polls, sorted)
CREATE INDEX idx_polls_status_created ON polls(status, created_at DESC);

-- Poll by category
CREATE INDEX idx_polls_category ON polls(category_id);

-- Profile by discord_id (for admin seeding, lookup)
CREATE INDEX idx_profiles_discord_id ON profiles(discord_id);
```

### Vote Count Trigger

```sql
-- Function: increment vote count when a vote is inserted
CREATE OR REPLACE FUNCTION increment_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vote_counts
  SET count = count + 1
  WHERE poll_id = NEW.poll_id AND choice_id = NEW.choice_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: fires AFTER INSERT on votes
CREATE TRIGGER on_vote_inserted
  AFTER INSERT ON votes
  FOR EACH ROW
  EXECUTE FUNCTION increment_vote_count();
```

Note: Votes should never be deleted in normal operation. If vote deletion is ever needed (admin purge), add a corresponding decrement trigger.

### Auto-Close Expired Polls (pg_cron)

```sql
-- Run every minute: close polls past their deadline
SELECT cron.schedule(
  'close-expired-polls',
  '* * * * *',
  $$
    UPDATE polls
    SET status = 'closed', closed_at = NOW(), updated_at = NOW()
    WHERE status = 'active' AND closes_at <= NOW();
  $$
);
```

pg_cron is available on Supabase free tier and runs inside Postgres -- no Edge Function invocation cost.

### Profile Sync Trigger (on auth.users insert)

```sql
-- Automatically create profile when user signs up via Discord OAuth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, discord_id, discord_username, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'provider_id',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Unknown'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

### Row Level Security Policies

```sql
-- Profiles: users can read all profiles, but only Edge Functions write
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT TO authenticated USING (true);

-- Categories: readable by anyone authenticated
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are viewable by authenticated users"
  ON categories FOR SELECT TO authenticated USING (true);

-- Polls: readable by anyone authenticated
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Polls are viewable by authenticated users"
  ON polls FOR SELECT TO authenticated USING (true);

-- Choices: readable by anyone authenticated
ALTER TABLE choices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Choices are viewable by authenticated users"
  ON choices FOR SELECT TO authenticated USING (true);

-- Votes: users can only see their own votes
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own votes"
  ON votes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Vote counts: only visible if user has voted on that poll
ALTER TABLE vote_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vote counts visible to voters"
  ON vote_counts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM votes
      WHERE votes.poll_id = vote_counts.poll_id
      AND votes.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies on any table for authenticated role.
-- All writes go through Edge Functions using service_role key (bypasses RLS).
```

**Important RLS performance note:** The `vote_counts` policy uses a subquery on `votes`. Index `idx_votes_poll_user` on `(poll_id, user_id)` ensures this is a fast index scan, not a sequential scan.

## Edge Function Structure

Use the "fat function" pattern -- fewer functions with method-based routing to reduce cold starts.

```
supabase/
  functions/
    _shared/              # Shared utilities (underscore prefix = not deployed as function)
      cors.ts             # CORS headers helper
      supabase-client.ts  # createClient with service_role
      discord.ts          # Discord API helpers (membership check)
      validation.ts       # Input validation helpers
      auth.ts             # JWT extraction, admin check helpers

    vote/                 # POST: cast vote
      index.ts

    poll/                 # POST: create poll, PATCH: update/close poll, DELETE: delete poll
      index.ts

    admin/                # POST: promote admin, manage categories, set resolution
      index.ts
```

### Edge Function Pattern (vote/index.ts example)

```typescript
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyDiscordMembership } from "../_shared/discord.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Create clients
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Get user from JWT
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Parse + validate input
    const { poll_id, choice_id } = await req.json();
    if (!poll_id || !choice_id) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Business logic checks (poll open, not already voted, etc.)
    // ...

    // 5. Verify Discord server membership
    // ...

    // 6. Insert vote (service_role bypasses RLS)
    const { error: voteError } = await supabaseAdmin
      .from("votes")
      .insert({ poll_id, choice_id, user_id: user.id });

    if (voteError) {
      // UNIQUE constraint violation = already voted
      if (voteError.code === "23505") {
        return new Response(JSON.stringify({ error: "Already voted" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw voteError;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

## Frontend Component Architecture

```
src/
  main.tsx                    # Entry point, providers
  App.tsx                     # Root layout + router outlet

  routes/
    __root.tsx                # Root layout (nav, auth state)
    index.tsx                 # Home: active polls list
    polls/
      $pollId.tsx             # Single poll view (vote + results)
    archive.tsx               # Closed polls with resolution status
    admin/
      index.tsx               # Admin dashboard (create poll, manage categories)
      polls.tsx               # Admin poll management

  components/
    auth/
      LoginButton.tsx         # Discord OAuth trigger
      AuthGuard.tsx           # Redirect if not authenticated
      AdminGuard.tsx          # Redirect if not admin
    polls/
      PollCard.tsx            # Poll summary card for listing
      PollDetail.tsx          # Full poll view with choices
      VoteForm.tsx            # Choice selection + submit
      ResultsChart.tsx        # Bar chart / percentage display
      PollTimer.tsx           # Countdown to close
    admin/
      PollForm.tsx            # Create/edit poll form
      CategoryManager.tsx     # CRUD categories
      AdminManager.tsx        # Promote/demote admins
    layout/
      Header.tsx              # Nav + user avatar + theme toggle
      CategoryTabs.tsx        # Category filter pills

  hooks/
    useAuth.ts                # Auth state, login/logout
    usePoll.ts                # Single poll data + polling
    usePolls.ts               # Poll listing with filters
    useVote.ts                # Vote mutation via Edge Function
    useAdmin.ts               # Admin status check
    usePolling.ts             # Generic setInterval wrapper for HTTP polling

  lib/
    supabase.ts               # Supabase client singleton
    api.ts                    # Edge Function call helpers
    types.ts                  # TypeScript types matching DB schema
```

## Patterns to Follow

### Pattern 1: HTTP Polling with Cleanup
**What:** Use `setInterval` for live vote counts, with proper cleanup.
**When:** After user votes, on active poll detail pages.
```typescript
function usePolling<T>(queryFn: () => Promise<T>, intervalMs: number, enabled: boolean) {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    if (!enabled) return;
    queryFn().then(setData); // immediate fetch
    const id = setInterval(() => queryFn().then(setData), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);

  return data;
}
```

### Pattern 2: Optimistic Vote Update
**What:** Show vote result immediately after casting, before server confirms count propagation.
**When:** Vote submission.
```
1. User clicks vote -> disable button, show spinner
2. Call Edge Function
3. On success: immediately show results view with +1 on chosen option (optimistic)
4. Start polling interval -> real counts replace optimistic within 5-10 seconds
```

### Pattern 3: Auth State as React Context
**What:** Single auth context providing user, profile, isAdmin, and loading state.
**When:** App-wide, consumed by guards and UI components.

### Pattern 4: Edge Function Error Contract
**What:** Consistent error response shape from all Edge Functions.
```typescript
// Success: { success: true, data?: any }
// Error:   { error: string, code?: string }
// HTTP status codes: 400 (bad input), 401 (unauthed), 403 (forbidden),
//                    409 (conflict/already voted), 500 (server error)
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Vote Validation
**What:** Checking vote eligibility in the browser before calling the server.
**Why bad:** Any client check can be bypassed. Users can call the Edge Function directly.
**Instead:** Client checks are UX hints only (hide the button). Server is the source of truth.

### Anti-Pattern 2: Counting Votes on Read
**What:** `SELECT COUNT(*) FROM votes WHERE poll_id = X` on every poll view.
**Why bad:** Gets expensive as votes grow. Every polling tick multiplies the cost.
**Instead:** Pre-aggregated `vote_counts` table maintained by trigger.

### Anti-Pattern 3: Storing Discord Token in Client
**What:** Keeping the Discord access token in the browser for API calls.
**Why bad:** Token could be stolen. Discord rate limits apply per-token.
**Instead:** Edge Functions call Discord API server-to-server using a bot token or the user's token retrieved server-side from Supabase auth metadata.

### Anti-Pattern 4: RLS for Write Authorization
**What:** Using RLS policies to control who can insert votes, create polls, etc.
**Why bad:** RLS cannot call external APIs (Discord membership check), cannot rate-limit, and complex policies are hard to debug.
**Instead:** All writes go through Edge Functions with explicit validation logic.

## Scalability Considerations

| Concern | At 100 users | At 400 users (target) | At 5K users (unlikely) |
|---------|--------------|----------------------|----------------------|
| DB connections | Well within limits | Fine on free tier | May need connection pooling (Supavisor) |
| Vote count polling | Trivial load | ~40 concurrent polls/sec at peak | Consider longer intervals or conditional polling |
| Edge Function cold starts | Imperceptible | Occasional 200-500ms on first call | Use "fat function" pattern to minimize |
| Storage | < 10MB images | < 100MB | Still within 1GB free tier |
| Auth sessions | No concern | No concern | No concern |

At the target scale of 300-400 weekly voters with 20-30 concurrent, this architecture is dramatically over-provisioned. The free tier is more than sufficient.

## Suggested Build Order

Based on component dependencies, the recommended build order is:

```
Phase 1: Foundation
  Supabase project setup (DB schema, RLS policies, triggers)
  Auth (Discord OAuth + profile sync trigger)
  Basic routing (TanStack Router)
  -> Everything depends on auth and schema existing first

Phase 2: Core Polling
  Poll listing page (read path via supabase-js)
  Poll detail + voting (Edge Function for writes)
  Vote count display + HTTP polling
  -> Requires schema + auth from Phase 1

Phase 3: Admin
  Admin guard + role check
  Poll creation (Edge Function)
  Category management
  Poll close/resolution
  -> Requires read/write patterns established in Phase 2

Phase 4: Polish
  Image upload (Supabase Storage)
  Pinned polls
  Archive page with resolution status
  Discord membership verification (can stub in Phase 2)
  Account age + MFA checks
  -> Can be built independently once core exists
```

**Key dependency chain:** Schema -> Auth -> Reads -> Writes -> Admin -> Polish

## Sources

- [Supabase Edge Functions Architecture](https://supabase.com/docs/guides/functions/architecture)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Discord OAuth](https://supabase.com/docs/guides/auth/social-login/auth-discord)
- [Supabase Edge Functions Auth/Security](https://supabase.com/docs/guides/functions/auth)
- [Supabase Triggers Docs](https://supabase.com/docs/guides/database/postgres/triggers)
- [PostgreSQL Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html)
- [Supabase Best Practices](https://www.leanware.co/insights/supabase-best-practices)
- [Trigger-based count optimization](https://paquier.xyz/postgresql-2/reduce-cost-of-select-count-queries-with-trigger-based-method/)

---

*Architecture research: 2026-04-06*
