# Domain Pitfalls

**Domain:** Community polling/voting platform (esports, Discord-authenticated, Supabase backend)
**Researched:** 2026-04-06

## Critical Pitfalls

Mistakes that cause rewrites, data integrity failures, or complete loss of community trust.

### Pitfall 1: RLS Disabled or Misconfigured on Vote Tables

**What goes wrong:** Supabase tables have Row Level Security disabled by default. If you forget to enable RLS or write policies incorrectly, the `anon` key (visible in client-side JavaScript) gives anyone full read/write access to your entire database -- including the ability to insert, modify, or delete votes directly.
**Why it happens:** Developers focus on building features first and assume "I'll add security later." Supabase returns empty results (not errors) when RLS is enabled without policies, which silently breaks queries and tempts developers to disable RLS to "fix" it.
**Consequences:** Anyone can inspect your frontend bundle, extract the Supabase URL and anon key, and use `curl` or Postman to read all votes, insert fake votes, delete real votes, or modify poll results. Complete destruction of vote integrity.
**Prevention:**
- Enable RLS on every table immediately upon creation -- before writing any application code.
- Write explicit SELECT, INSERT, UPDATE, DELETE policies per table. Test that unauthenticated requests return empty/denied.
- Never expose the `service_role` key in client-side code. It bypasses all RLS.
- Use `security_invoker = true` on any database views to prevent them from bypassing RLS.
- Test RLS policies by making requests with the anon key directly (not through your app) to verify they block unauthorized access.
**Detection:** Run a query against each table using only the anon key with no auth token. If you get data back, RLS is broken.
**Phase:** Must be addressed in the very first backend/database phase. Non-negotiable foundation.

### Pitfall 2: Vote Duplication via Race Conditions

**What goes wrong:** Two near-simultaneous requests from the same user (double-click, network retry, malicious replay) both pass application-level "has this user voted?" checks and insert duplicate votes.
**Why it happens:** Application code checks "does a vote exist?" then inserts. Between the check and the insert, a second request also sees "no vote exists" and inserts. This is the classic TOCTOU (time-of-check-to-time-of-use) race condition.
**Consequences:** Users can accidentally or intentionally cast multiple votes, undermining the one-vote-per-user guarantee that is the core value proposition of this platform.
**Prevention:**
- Add a `UNIQUE` constraint on `(poll_id, user_id)` in the `votes` table. This is the single most important line of DDL in the entire project. The database will reject duplicates regardless of application logic.
- Use `INSERT ... ON CONFLICT DO NOTHING` to handle the constraint gracefully without error responses.
- Do NOT rely on application-level checks alone (checking before inserting). The database constraint is the source of truth.
- Aggregate vote counts via a Postgres trigger that fires on insert, not by counting rows on every read.
**Detection:** Attempt to vote twice rapidly using `curl` or a script. If both succeed, the constraint is missing.
**Phase:** Database schema design phase -- the UNIQUE constraint must exist from the first migration.

### Pitfall 3: Client-Side Vote Validation Only

**What goes wrong:** Vote submission logic (eligibility checks, one-vote enforcement, poll-open verification) runs in the browser. Users bypass it by calling the Supabase API directly.
**Why it happens:** Developers build the happy path in React, adding checks like "is the poll still open?" and "has the user already voted?" in component logic. They forget that Supabase's REST API is publicly accessible.
**Consequences:** Users can vote on closed polls, vote multiple times (if no DB constraint), vote on polls they shouldn't have access to, or submit invalid vote options.
**Prevention:**
- Route ALL vote writes through Supabase Edge Functions that perform server-side validation: poll is open, user hasn't voted, vote option is valid, user meets eligibility criteria (Discord server membership, account age, MFA).
- Block direct inserts to the `votes` table from the client by making the RLS INSERT policy require a specific claim or role that only the Edge Function's service role has.
- Never trust any data from the client -- re-validate everything server-side.
**Detection:** Try to insert a vote directly via the Supabase REST API (bypassing the Edge Function). If it succeeds, your validation is bypassable.
**Phase:** Must be implemented alongside the voting feature. Never ship client-side-only vote submission, even for "testing."

### Pitfall 4: Discord Server Membership Verification Architecture

**What goes wrong:** The project requires voters to be members of the official War Thunder esports Discord server. Checking guild membership via Discord's OAuth `guilds` scope returns ALL guilds the user is in (privacy concern, slow), and more critically, OAuth tokens expire. If you only check membership at login time, a user who leaves the server can still vote until their session expires.
**Why it happens:** The `guilds` scope seems like the obvious solution, but it's invasive (users see "this app wants to know all your servers") and only captures a snapshot at auth time. The proper guild member lookup endpoint requires a Bot token, not a user OAuth token.
**Consequences:** Users refuse to grant the `guilds` scope (losing voters), or users who leave the Discord server retain voting rights, or the verification check is so slow it degrades login UX.
**Prevention:**
- Use a Discord Bot (added to the WTCS server) to verify membership via the `GET /guilds/{guild_id}/members/{user_id}` endpoint using a Bot token. This checks one specific server without requesting the invasive `guilds` scope from users.
- Check membership at vote time (not just login time) via an Edge Function that calls the Discord API with the Bot token. Cache the result for a short TTL (5-15 minutes) to avoid hammering Discord's API.
- Store the Bot token as a Supabase secret, never in client code.
- Handle the "user is not in the server" case gracefully with a clear error message and link to join.
**Detection:** Have a test user leave the Discord server and attempt to vote. If they can still vote, the check is stale or missing.
**Phase:** Auth/verification phase. This needs to be designed before building the voting flow because it affects the Edge Function architecture.

### Pitfall 5: Supabase Free Tier Database Pausing

**What goes wrong:** Supabase pauses free-tier projects after 7 days of inactivity. After 90 days of being paused, the project cannot be restored from the dashboard. Your entire database -- polls, votes, user data -- becomes inaccessible or lost.
**Why it happens:** The WTCS community may have off-seasons or quiet periods where no one visits the site for a week. The database silently pauses.
**Consequences:** Users visit the site and get errors or infinite loading. If paused for 90+ days without intervention, data loss. Even a brief pause means the first visitor after the pause experiences a cold start delay of 30-60 seconds.
**Prevention:**
- Set up a GitHub Actions cron job (runs every 3-4 days) that pings a Supabase Edge Function or makes a simple database query. This costs ~0.22% of GitHub's free plan monthly allowance.
- Alternative: Use Upstash's free-tier cron to hit a keepalive Edge Function.
- Monitor for the pause by checking the Supabase dashboard periodically or setting up a simple uptime check (e.g., UptimeRobot free tier).
- Have a documented recovery procedure in case the project does get paused.
**Detection:** Site returns errors or takes 30+ seconds to respond after a quiet period.
**Phase:** Infrastructure/deployment phase. Set up the keepalive before going live, not after the first pause.

## Moderate Pitfalls

### Pitfall 6: Exposing Vote Choices in Network Responses

**What goes wrong:** The API returns individual vote records (who voted for what) instead of only aggregate counts. Even if the UI only shows percentages, anyone inspecting network traffic can see how each user voted.
**Prevention:**
- RLS policies on the `votes` table should only allow a user to SELECT their own vote (to show "you voted for X").
- Serve aggregate results from a separate `vote_counts` table (populated by trigger) that only contains `poll_id`, `option_id`, and `count`.
- Never return a list of vote records to any client query.
**Phase:** Database schema and RLS policy design.

### Pitfall 7: Poll Timer Drift and Timezone Confusion

**What goes wrong:** Poll close times are stored or compared using local time, browser time, or inconsistent timezone handling. A poll that should close at midnight closes at different times for different users, or the Edge Function and database disagree on whether a poll is still open.
**Prevention:**
- Store all timestamps as `timestamptz` in Postgres (UTC).
- Compare poll close times server-side only (in the Edge Function), never trust the client's clock.
- Display times to users in their local timezone using `Intl.DateTimeFormat`, but always transmit and store UTC.
- Use Postgres `now()` in triggers and RLS policies, not application-level timestamps.
**Phase:** Database schema design and Edge Function implementation.

### Pitfall 8: HTTP Polling Overload at Scale

**What goes wrong:** The app polls every 5-10 seconds for live vote counts. With 20-30 concurrent users, that's 120-360 requests per minute. During a contentious poll, users refresh more aggressively or open multiple tabs.
**Prevention:**
- Poll the `vote_counts` aggregate table (one row per option), not the raw `votes` table.
- Increase polling interval when the tab is not focused (use `document.visibilityState`).
- Add `Cache-Control` headers or use Supabase's built-in caching to reduce database hits.
- Set a minimum polling interval that the client cannot override.
- At 300-400 weekly voters with 20-30 concurrent peak, the free tier's 500K Edge Function invocations per month provides ample headroom, but monitor usage.
**Phase:** Frontend implementation of live updates.

### Pitfall 9: Discord OAuth Token Refresh Failures

**What goes wrong:** Discord OAuth access tokens expire. If Supabase's token refresh fails silently, users appear logged out mid-session or their vote submission fails after they've already selected an option.
**Prevention:**
- Use Supabase's built-in `onAuthStateChange` listener to detect session expiry and prompt re-login.
- Handle the "session expired" case in the vote submission flow specifically -- don't just show a generic error. Save their vote choice in memory and re-submit after re-authentication.
- Set reasonable session durations. Discord tokens typically last 7 days with refresh tokens valid for 30 days.
**Phase:** Auth implementation and voting UX.

### Pitfall 10: Results Visibility Logic Leaking Through RLS

**What goes wrong:** The project requires that results are only visible to users who have voted. If this is enforced only in the React UI, users can query the `vote_counts` table directly and see results without voting.
**Prevention:**
- Enforce results visibility in RLS policies: the SELECT policy on `vote_counts` should check that a corresponding vote exists in the `votes` table for `auth.uid()` and the given `poll_id`.
- For closed polls, the RLS policy should still only allow voters to see results (per the project requirements).
- Test by querying `vote_counts` with an authenticated user who has NOT voted on a poll.
**Phase:** Database RLS policy design -- must be designed alongside the vote_counts schema.

## Minor Pitfalls

### Pitfall 11: Admin Privilege Escalation via Direct API

**What goes wrong:** Admin status is checked in the UI but not enforced at the database level. A regular user calls the Supabase API directly to create polls, close polls, or modify admin status.
**Prevention:**
- Store admin status in a database table with RLS policies that only allow existing admins to insert new admins.
- Poll creation/modification should go through Edge Functions that verify admin status server-side.
- Seed initial admins via a database migration, not through the API.
**Phase:** Admin system implementation.

### Pitfall 12: Missing Account Age and MFA Checks at Vote Time

**What goes wrong:** Account age and MFA status are checked at login but not rechecked at vote time. Discord accounts can disable MFA after logging in, or the check only ran during the initial OAuth flow.
**Prevention:**
- Store `mfa_enabled` and `account_created_at` from Discord's user object in your profiles table at login.
- Re-verify at vote time in the Edge Function, or at minimum verify against the stored profile data.
- Consider that account age is immutable (creation date doesn't change), so storing it once is sufficient. MFA status could change, so decide on an acceptable staleness window.
**Phase:** Edge Function vote validation logic.

### Pitfall 13: Image Upload Storage Limits

**What goes wrong:** Admins upload high-resolution images for polls. Supabase free tier provides 1GB storage. With unoptimized images (5-10MB each), 100-200 polls exhaust storage.
**Prevention:**
- Resize and compress images on upload (client-side before upload, or via Edge Function).
- Set a maximum file size (e.g., 1MB).
- Prefer external image URLs over uploads where possible.
- Monitor storage usage in the Supabase dashboard.
**Phase:** Poll creation feature implementation.

### Pitfall 14: Supabase Anon Key Confused with Secret

**What goes wrong:** Developers see "anon key" and think it's safe to use for everything, or conversely, they use the `service_role` key in client code thinking it's needed for authenticated operations.
**Prevention:**
- The anon key is public and safe for client-side use -- it's a JWT that identifies the project but grants only what RLS allows.
- The service_role key bypasses all RLS and must ONLY be used in Edge Functions (server-side).
- Add the service_role key to `.gitignore` and never import it in frontend code.
**Phase:** Initial project setup.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Database schema design | Missing UNIQUE constraint on votes | Add `UNIQUE(poll_id, user_id)` in the first migration. Test with concurrent inserts. |
| Database schema design | RLS disabled on new tables | Enable RLS immediately on every table. Test with anon key. |
| Database schema design | Results visibility leak | RLS on `vote_counts` must check voter status. Design policies alongside schema. |
| Auth/Discord OAuth | Guild membership check architecture | Use Bot token for server-specific checks, not `guilds` OAuth scope. Design before building voting. |
| Auth/Discord OAuth | Token refresh UX | Handle session expiry gracefully in the vote submission flow. |
| Vote submission | Client-side only validation | Edge Functions for all write operations. Block direct table inserts via RLS. |
| Vote submission | Race condition duplicates | Database UNIQUE constraint is the source of truth, not application logic. |
| Live updates | Polling frequency overhead | Poll aggregate table, reduce frequency when tab unfocused. |
| Admin system | Privilege escalation | Server-side admin verification. Seed admins via migration. |
| Deployment | Database pausing | GitHub Actions keepalive cron job before go-live. |
| Deployment | Storage exhaustion | Image size limits and compression. |

## Sources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase RLS Best Practices - Precursor Security](https://www.precursorsecurity.com/blog/row-level-recklessness-testing-supabase-security)
- [Supabase Edge Function Limits](https://supabase.com/docs/guides/functions/limits)
- [Supabase Rate Limiting Edge Functions](https://supabase.com/docs/guides/functions/examples/rate-limiting)
- [Supabase Auth Rate Limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase Pause Prevention - GitHub](https://github.com/travisvn/supabase-pause-prevention)
- [Preventing Supabase Pausing - DEV Community](https://dev.to/jps27cse/how-to-prevent-your-supabase-project-database-from-being-paused-using-github-actions-3hel)
- [PostgreSQL Race Conditions - DEV Community](https://dev.to/mistval/winning-race-conditions-with-postgresql-54gn)
- [Discord OAuth2 Documentation](https://discord.com/developers/docs/topics/oauth2)
- [Hacker's Guide to Online Voting Systems - Intigriti](https://www.intigriti.com/blog/news/a-hackers-guide-to-online-voting-systems)
- [Vote Bot Prevention - FraudBlocker](https://fraudblocker.com/articles/bots/votebots-how-to-make-em-and-how-to-stop-em)
- [Supabase RLS Common Issues - VibeAppScanner](https://vibeappscanner.com/supabase-row-level-security)
