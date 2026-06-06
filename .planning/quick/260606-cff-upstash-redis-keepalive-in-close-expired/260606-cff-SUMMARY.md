---
quick_id: 260606-cff
slug: upstash-redis-keepalive-in-close-expired
date: 2026-06-06
status: complete
files_modified: [supabase/functions/close-expired-polls/index.ts]
commit: 59a53af
---

# Quick Task 260606-cff: Upstash Redis Keepalive

**Folded a best-effort, self-expiring Upstash write into the daily close-expired-polls cron so one daily run now keeps BOTH Supabase and Upstash warm — averting the free-tier Redis archival Upstash warned about.**

## Problem
Upstash emailed an inactivity notice for the free-tier Redis DB "WTCS Community Poll" (one warning left before archival). Root cause: the rate limiter (`submit-vote`) is the only Redis caller, so during quiet periods (no votes) Redis received zero traffic. Supabase was already kept warm by the daily `cron-sweep.yml` → `close-expired-polls` invocation, but nothing pinged Redis.

## What was done
- Added `keepUpstashWarm()` to `supabase/functions/close-expired-polls/index.ts`: builds a `Redis` client from the existing `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` project secrets (same `@upstash/redis@1.34.6` client `submit-vote` uses) and issues `redis.set('keepalive:close-expired-polls', <ISO now>, { ex: 604800 })` (7-day TTL self-expiry).
- Called `await keepUpstashWarm()` on every **authorized** invocation, **before** the DB sweep and **outside** the sweep's try/catch, so Redis gets traffic regardless of the sweep outcome and a keepalive failure can never alter the sweep's response. Missing vars → `console.warn` + skip.
- Existing poll-closing sweep + audit behavior and all HTTP responses unchanged.

## Approach rationale (Option 2)
Chosen over a GitHub Actions curl step because the Upstash creds already exist as **Supabase project secrets** (zero new secrets) and one existing daily cron now warms both backends. GitHub had no Upstash secrets and local `.env` has none, so reusing the Supabase-side secrets via the Edge Function was strictly easier.

## Deployment & verification (prod)
1. Committed `59a53af` on main; pushed → **Deploy Edge Functions** workflow (run 27066971254) **completed/success** (deploys all functions via `--use-api`).
2. Triggered `cron-sweep.yml` once (run 27066988144, `workflow_dispatch`) → **completed/success**; run log: `HTTP 200: {"success":true,"swept":0,"ids":[]}`.
3. Supabase edge logs confirm `close-expired-polls` **version 11** returned `POST | 200` (836ms); no "skipping Redis keepalive" warning → the Redis write executed. Upstash inactivity clock reset today.

## Commits
1. **Task 1 (code):** `59a53af` — `feat(close-expired-polls): add best-effort Upstash Redis keepalive`
2. **Task 2 (deploy/verify):** no code commit — deploy via CI workflow + manual cron-sweep trigger

## Follow-up / notes
- Future daily sweeps (`0 3 * * *`) now keep both Supabase and Upstash warm automatically — no further action needed.
- Could not read the Redis key directly (no local Upstash creds); confirmation is via the 200 response + version-11 deploy + absence of the missing-vars warning. To eyeball it, check the `keepalive:close-expired-polls` key in the Upstash console.
- If Upstash sends another notice despite this, verify `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are still set as Supabase project secrets and that the daily cron-sweep is succeeding.
