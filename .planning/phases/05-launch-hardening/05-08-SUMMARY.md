# 05-08 — Production Cutover

## What was built

Completed the Phase 5 production cutover (D-10, D-11, D-12): the app is live at `https://polls.wtcsmapban.com` with Discord OAuth, Sentry, PostHog, and all 15 Edge Functions serving the correct origin.

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | `netlify.toml` with explicit build + security headers | ✓ auto |
| 2 | Sentry + PostHog accounts | ✓ user |
| 3 | Netlify env vars (7) + Supabase secrets (4) + GH repo secrets (5) | ✓ user + Claude (CLI) |
| 4 | Netlify default-URL deploy + Discord dual-register + Supabase Auth URL config | ✓ user |
| 5a | Preview dry-run (app-level) | ✓ user (cron dry-run deferred — see "Known follow-ups") |
| 5 | DNS cutover + cert + prod smoke | ✓ Tim (DNS) + Claude (diagnostics) + user (smoke) |

## Commits

- `d925ec0` — feat(05-08): netlify.toml with explicit build + security headers
- `2a1c56c` — feat(05-08): tag every PostHog event with `app='community-polls'` (shared project with sibling app)
- `c481b9c` — fix(05-03): gate `sentryVitePlugin` on Vite `mode` not `process.env.NODE_ENV` (plugin was silently disabled on Netlify)
- `26c0f74` — fix(05-08): correct Upstash env var names to `_REST_` variants in `.env.example`
- `1668912` — fix(05-08): rename `wtcsmapvote.com` → `wtcsmapban.com` across 22 files (longstanding typo — would have CORS-blocked every EF call from the real prod origin)
- `0091a5a` — fix(05-08): wire `VITE_COMMIT_SHA` via `netlify.toml` build command + document `VITE_WTCS_GUILD_ID` in `.env.example`
- `c1516b0` — fix(05-07): add `--no-verify-jwt` to EF deploy workflow (ES256 gateway compat — matches Phase 3 decision)

## Incidents encountered + resolved

1. **Wrong domain name in 22 files (`wtcsmapvote.com` → `wtcsmapban.com`)**
   Discovered during DNS propagation check — `wtcsmapvote.com` doesn't exist per Verisign whois. Global atomic rename + CORS allowlist fix. Unit tests still green (356).

2. **Sentry sourcemap upload silently disabled**
   `disable: process.env.NODE_ENV !== 'production'` was evaluated at config-load time, before Vite promotes NODE_ENV. Switched to `defineConfig(({ mode }) => ...)` signature.

3. **`VITE_COMMIT_SHA=$COMMIT_REF` pasted literally in Netlify UI**
   Netlify UI env vars don't shell-expand. Moved to `netlify.toml` build command: `VITE_COMMIT_SHA=$COMMIT_REF npm ci && npm run build`.

4. **Missing `VITE_WTCS_GUILD_ID` caused `?reason=auth-failed`**
   Client-side guild check in `src/lib/auth-helpers.ts` fails-closed when unset. Plan's Task 3 checklist only covered the server-side `DISCORD_GUILD_ID`; added the client-side var to `.env.example`.

5. **Upstash Redis secret name collision**
   Plan specified `UPSTASH_REDIS_URL`/`_TOKEN`, but `Redis.fromEnv()` reads `UPSTASH_REDIS_REST_URL`/`_REST_TOKEN`. Removed my erroneously-set duplicates, patched `.env.example`.

6. **15 Edge Functions returning `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM`**
   Bulk CLI deploy defaulted to `verify_jwt=true`, but project signs with ES256 (asymmetric) and gateway only validates HS256. Redeployed all 15 with `--no-verify-jwt` + updated workflow file (`c1516b0`) so post-merge auto-deploys preserve the flag.

## Known follow-ups

- **Sentry sourcemap upload verification** — deferred to post-merge. Sourcemap upload will fire on the first `main`-branch build after Phase 5 merges; watch for `[sentry-vite-plugin] Successfully uploaded source maps to Sentry` in the build log.
- **Cron workflow dispatch dry-run** — deferred to post-merge. `cron-sweep.yml` can't be dispatched until it exists on the default branch. Post-merge: manually run the workflow once via GH Actions → "Run workflow" → expect 200 + `{"success":true,"swept":N}`.
- **04-UAT re-run** — the 9 blocked items (tests 4–8, 11–14) can now run against `polls.wtcsmapban.com`.
- **`SUPABASE_ACCESS_TOKEN` rotation** — token shared during setup is in the chat transcript. User should rotate at https://supabase.com/dashboard/account/tokens once confident the flow is stable; same value lives in `SUPABASE_ACCESS_TOKEN` GH secret, so update both.

## Acceptance criteria

| Must-haves | Status |
|------------|--------|
| `netlify.toml` with `npm ci && npm run build`, `dist`, Node 22 | ✓ |
| 4 VITE_* + 3 SENTRY_* env vars on Netlify | ✓ user |
| 4 Supabase secrets via `supabase secrets set` | ✓ (via `npx supabase` + MCP verify) |
| 5 GH repo secrets (incl. `SUPABASE_ANON_KEY` — HIGH #3) | ✓ (via `gh` CLI) |
| Discord OAuth redirect allowlist contains both Netlify + custom domain | ✓ user |
| Preview URL smoke T5a (app-level) | ✓ user |
| CNAME for `polls.wtcsmapban.com` live | ✓ (Tim/Netlify DNS) |
| HTTPS cert issued | ✓ (Let's Encrypt, valid till 2026-06-01) |
| Prod smoke on `polls.wtcsmapban.com` (Discord OAuth + EF round-trip) | ✓ user |
| Rollback runbook documented | ✓ (Contingencies A/B in plan) |

## Threat model coverage

- **T-05-15 discord-oauth-redirect-hijack** — dual-registration in place; post-launch hardening removes the Netlify default URL from Discord OAuth allowlist.
- **T-05-02 sentry-auth-token-exposure** — `SENTRY_AUTH_TOKEN` not `VITE_`-prefixed; stays server-side at build time.
