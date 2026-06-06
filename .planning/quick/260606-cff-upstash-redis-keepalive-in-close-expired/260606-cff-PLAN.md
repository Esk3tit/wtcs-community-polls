---
quick_id: 260606-cff
slug: upstash-redis-keepalive-in-close-expired
date: 2026-06-06
type: quick
files_modified: [supabase/functions/close-expired-polls/index.ts]
---

<objective>
Stop the free-tier Upstash Redis DB ("WTCS Community Poll") from being archived for inactivity by giving it regular traffic. Upstash sent an inactivity notice (one more warning before archival). The Supabase DB is already kept warm by the daily `cron-sweep.yml` → `close-expired-polls` invocation, but Redis is only touched by `submit-vote` (the rate limiter), so it goes idle during quiet periods.

Approach (Option 2 — zero new secrets, one cron warms both backends): fold a cheap, self-expiring Upstash write into the existing daily `close-expired-polls` Edge Function, reusing the project-level `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` secrets already used by `submit-vote`.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Add best-effort Upstash keepalive to close-expired-polls</name>
  <files>supabase/functions/close-expired-polls/index.ts</files>
  <action>
    Import `Redis` from 'https://esm.sh/@upstash/redis@1.34.6' (same version submit-vote uses). Add a `keepUpstashWarm()` helper that reads UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN, and if both are set, issues `redis.set('keepalive:close-expired-polls', <ISO now>, { ex: 604800 })` (7-day TTL self-expiry). If the vars are missing, console.warn and skip (mirror submit-vote's missing-vars handling). Wrap the Redis call in its own try/catch so a keepalive failure never throws into — or alters the response of — the poll-closing sweep. Call `await keepUpstashWarm()` on every AUTHORIZED invocation (after the X-Cron-Secret gate passes, before the DB sweep) so Redis gets traffic regardless of the DB sweep outcome. Leave the existing sweep + audit behavior and all HTTP responses unchanged. WHY-only comment, no plan/phase IDs in source.
  </action>
  <verify><automated>grep -q "keepUpstashWarm" supabase/functions/close-expired-polls/index.ts</automated></verify>
  <done>close-expired-polls performs a best-effort Upstash write on each authorized run; sweep behavior unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Deploy + reset the Upstash inactivity clock now</name>
  <files></files>
  <action>
    Commit + push the change to main (paths supabase/functions/** auto-trigger the Deploy Edge Functions workflow, which deploys all functions via --use-api using the existing SUPABASE_* GH secrets). Confirm the deploy workflow run succeeds. Then trigger the daily sweep once via `gh workflow run cron-sweep.yml`, confirm the run hits close-expired-polls with HTTP 200 (which now also writes the Redis keepalive key) — resetting the Upstash inactivity clock today.
  </action>
  <verify><automated>gh run list --workflow=cron-sweep.yml --limit 1 --json conclusion -q '.[0].conclusion'</automated></verify>
  <done>Deployed; a manual cron-sweep run returned 200; Redis received traffic today; future daily sweeps keep both Supabase and Upstash warm.</done>
</task>

</tasks>

<success_criteria>
- close-expired-polls issues a best-effort Upstash keepalive write on each authorized invocation (self-expiring 7-day key), with no change to the poll-closing sweep behavior or responses
- Deployed to prod via the Deploy Edge Functions workflow
- A manual cron-sweep run returned HTTP 200 today, sending Redis traffic and averting archival
- No new secrets required (reuses existing Supabase project secrets)
</success_criteria>

<output>
Create `.planning/quick/260606-cff-upstash-redis-keepalive-in-close-expired/260606-cff-SUMMARY.md` when done
</output>
