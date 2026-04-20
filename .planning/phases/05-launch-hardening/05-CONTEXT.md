# Phase 5: Launch Hardening - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Take the WTCS Community Polls platform live in production at `polls.wtcsmapban.com`. This phase covers: (1) wiring a daily scheduled job that both sweeps expired suggestions via the existing `close-expired-polls` Edge Function AND keeps the Supabase free-tier project alive (INFR-02); (2) deploying the SPA to Netlify with working DNS, Discord OAuth callback, and SPA routing; (3) deploying all 15 Supabase Edge Functions to production via CI; (4) adding Playwright E2E smoke tests covering the critical path (TEST-06); (5) shipping launch-grade observability via Sentry (errors) and PostHog (analytics + session replays) — closes SEED-001; (6) pre-launch UX polish (loading skeletons + prefetch-on-hover) — closes the `2026-04-08` notes/todo; (7) rewriting the README into a public-product-grade document; (8) hardening the dependency supply chain by pinning npm and `esm.sh` versions exactly. Unblocks the 9 Phase 4 UAT items in `04-UAT.md` that depend on production EF deploy.

This phase does NOT add any new product features (no new suggestion types, no new admin tools, no Discord webhooks, no v2 work). All scope is launch-readiness for the v1 capabilities already shipped in Phases 1–4.

</domain>

<decisions>
## Implementation Decisions

### Scheduler & Cron
- **D-01:** **GitHub Actions scheduled workflow** is the cron platform — chosen over Netlify scheduled functions, external services, and pg_cron. Free, already part of the toolchain, has good logs + re-run UI in the Actions tab, and keeps the cron secret inside the same repo as the code. Workflow file lives in `.github/workflows/` (created in this phase — no `.github/` directory exists yet).
- **D-02:** **One daily job, dual purpose.** A single workflow runs at **03:00 UTC daily**, curling the `close-expired-polls` Edge Function with `X-Cron-Secret: ${{ secrets.CLOSE_SWEEPER_SECRET }}`. Each invocation is a real DB query → satisfies INFR-02 keepalive (7× safety margin over Supabase's 7-day free-tier pause threshold) AND the Phase 4 forward-link (D-12 sweep). No separate keepalive ping needed.
- **D-03:** **Failure visibility = GitHub Actions email-on-failure.** GitHub's built-in workflow-failure email to the repo owner is the v1 alerting path. No Discord webhook for v1 (deferred — can layer in later if needed). Pair with weekly manual glance at the Actions tab during launch month.

### E2E Smoke Tests (TEST-06)
- **D-04:** **Playwright** is the framework — chosen over Cypress (slower, serial in OSS) and a Vitest-only approach (doesn't satisfy true browser-level smoke). TypeScript native, parallel by default, screenshots + video on failure, request mocking, free.
- **D-05:** **Discord OAuth bypassed via programmatic session injection.** Tests do NOT click through Discord. Instead, in test setup, mint a Supabase session for fixture test users via the service-role key (or a dedicated test-only RPC), then drive the app as an already-authenticated user. The OAuth flow itself stays covered by Phase 1's existing unit/integration tests — no value re-running it through a real browser. Robust, fast, no Discord dependency, no 2FA brittleness.
- **D-06:** **Tests run locally + in CI on every PR.** No post-deploy prod smoke. `npm run e2e` runs locally against `supabase start` for dev verification. CI runs the same suite on every PR against a fresh local Supabase stack (see D-07). Eliminates any prod-DB pollution risk.
- **D-07:** **Test data isolation via `supabase start` in CI.** The GitHub Actions PR workflow spins up the full local Supabase stack via Docker, applies migrations, seeds test fixtures, builds the app (`npm run build` or runs `vite preview`), and runs Playwright against `http://localhost:<port>`. Adds ~1–2 min CI runtime; well within free tier. Fully isolated from production. Aligns with `supabase/config.toml` (already in repo).
- **D-08:** **Critical path = four user journeys** (all of these in the smoke suite):
  1. **User: browse → respond → see results** — authenticated user lands on `/topics`, picks a suggestion, submits a response via the EF, sees live percentages + raw counts. Satisfies TEST-06 baseline.
  2. **User: filter by category + search** — switch category tab, type a search term, verify the list narrows. Covers CATG-03 / CATG-04 in the smoke layer.
  3. **Admin: create suggestion → it appears in public feed** — admin (session-injected) opens `/admin`, creates a suggestion (title + 2 choices + category + 7-day timer), then a regular user verifies the suggestion shows up on `/topics`. Satisfies ROADMAP Phase 5 success criterion #3.
  4. **Auth error states** — confirm `AuthErrorPage` renders the right variant for missing-2FA and not-in-server scenarios (driven by setting fixture state, not real Discord rejection).

### Production Deployment
- **D-09:** **Edge Functions deploy via GitHub Actions on push-to-main.** A workflow runs `supabase functions deploy <name>` for every EF in `supabase/functions/` on every merge to `main`, authed by `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` repo secrets. Auditable via CI logs, no dev-machine lock-in, removes "what's deployed?" ambiguity.
- **D-10:** **Netlify = push-to-main → prod, PR → preview.** Standard Netlify Git integration: `main` auto-deploys to `polls.wtcsmapban.com`; each PR gets a unique `<branch>--<site>.netlify.app` preview URL. SPA fallback already provided by `public/_redirects` (`/*  /index.html  200`).
- **D-11:** **DNS + OAuth cutover sequence (near-zero-downtime):**
  1. Netlify deploys the app to its default `<site>.netlify.app` URL first.
  2. Manually verify the deploy on the Netlify URL.
  3. In the Discord developer portal, add **both** `https://<site>.netlify.app/auth/callback` AND `https://polls.wtcsmapban.com/auth/callback` to the OAuth redirect URI allowlist. Dual-registration means OAuth works during cutover.
  4. Flip the OVH CNAME from current target to Netlify.
  5. Verify on `polls.wtcsmapban.com` (DNS propagation, custom-domain HTTPS cert auto-provisioning by Netlify).
- **D-12:** **Secrets layout (canonical split):**
  - **Netlify env vars** (client build, must be `VITE_*` prefixed):
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
  - **Supabase secrets** (Edge Function runtime, set via `supabase secrets set`):
    - `CLOSE_SWEEPER_SECRET` — closes the Phase 4 503 "Sweeper not configured" gap
    - `UPSTASH_REDIS_URL`
    - `UPSTASH_REDIS_TOKEN`
    - `DISCORD_GUILD_ID` — official War Thunder esports Discord server ID (Phase 3)
    - (`SUPABASE_SERVICE_ROLE_KEY` is platform-provided; no manual action)
  - **GitHub Actions repo secrets** (CI/cron):
    - `SUPABASE_ACCESS_TOKEN` — for `supabase functions deploy`
    - `SUPABASE_PROJECT_REF` — project linker for the CLI
    - `CLOSE_SWEEPER_SECRET` — same value as the Supabase secret; the cron uses it as the `X-Cron-Secret` header
  - All variables documented in an updated `.env.example` AND a dedicated env-var table in the new README (D-17).

### Observability — SEED-001 Closure
- **D-13:** **Ship BOTH Sentry and PostHog at launch.** Full observability on day one:
  - **Sentry (`@sentry/react`):** wraps the app in an `<ErrorBoundary>`, captures unhandled errors and promise rejections, instruments Edge Functions (Sentry's Deno SDK or manual `try/catch` + `Sentry.captureException`), uploads sourcemaps in the build step. Free tier: 5K errors/month — sufficient.
  - **PostHog (`posthog-js` + `PostHogProvider`):** identifies the user via the Supabase session in `AuthContext` (Discord ID only — NOT Discord email or username for privacy), tracks key events (`auth.attempt`, `auth.success`, `auth.fail`, `suggestion.respond`, `admin.create_suggestion`, `admin.close_suggestion`), enables session replays at a sampled rate. Free tier: 1M events + 5K replays/month — sufficient.
  - **Consent banner:** session replay requires a minimal, non-blocking footer chip ("We record anonymous usage to improve the platform — [Opt out]"). Not a global modal that blocks first-paint.
  - DSNs/keys: `VITE_SENTRY_DSN` and `VITE_POSTHOG_KEY` added to the Netlify env vars list under D-12.

### Pre-Launch UX Polish
- **D-14:** **Loading skeletons + prefetch-on-hover** (closes the `2026-04-08` notes/todo):
  - **Skeletons:** `SuggestionList` renders a 3–5-row skeleton placeholder during the initial data fetch (covers the cold-DB lag users complained about). Use shadcn's `Skeleton` component, matching the real card silhouette.
  - **Prefetch-on-hover:** TanStack Router's built-in `preload="intent"` (or equivalent) on the navigation links between Topics ↔ Archive. First navigation feels instant after a hover.
  - Bonus: also enable preload on suggestion-card "View results" links so post-respond → results view is snappier.

### Launch Documentation — Public-Product README
- **D-15:** **Full README rewrite as a public-product README.** The current README is the unmodified Vite + TypeScript scaffold default and must be replaced wholesale.
  - **Audience:** anyone landing on the GitHub repo — community admins, potential contributors, curious WTCS members, future Khai. NOT just engineers.
  - **Required sections** (in order):
    1. Hero — centered WTCS logo + one-line tagline ("WTCS Community Suggestions — share opinions on competitive scene proposals with verified Discord identity")
    2. Shields.io badges — build status, license, hosting (Netlify), Supabase, etc.
    3. Live screenshots / GIFs — topics list, a suggestion with results revealed, admin shell, mobile view (the platform IS mobile-first per UIDN-02)
    4. What it is + why it exists (the "opinions not votes" framing per `PROJECT.md`)
    5. Tech stack summary (Vite + React 19 + TanStack Router + shadcn/Tailwind v4 + Supabase + Netlify + Upstash + Sentry + PostHog)
    6. Local development setup (`supabase start`, `npm ci`, `npm run dev`)
    7. Running tests (`npm test`, `npm run e2e`)
    8. Deploying (Netlify push-to-main, EF deploy via GH Actions, env-var setup)
    9. Env-var reference table (mirrors D-12 secrets layout)
    10. Project structure overview
    11. Contributing notes (issues, PRs, scope of v1 vs out-of-scope items)
    12. Upgrade ritual for pinned deps (`npm outdated`, Dependabot PR review)
    13. License (Apache 2.0, already in repo)
  - **Aesthetic:** clean Markdown, table-formatted env vars + tech stack, real screenshots committed to `docs/screenshots/` (not external image hosts), no emoji clutter (use sparingly only where genuinely useful), no Vite scaffold cruft.

### Dependency Pinning — Supply-Chain Hardening
- **D-16:** **Full belt-and-suspenders pinning** (closes the user's explicit launch concern: CI/CD installs and multi-developer onboarding must be reproducible and tamper-resistant):
  1. **Strip `^` and `~` from `package.json`** — every dependency and devDependency is pinned to its exact installed version (e.g., `"@supabase/supabase-js": "2.101.1"`, not `"^2.101.1"`). Run on the version currently installed; do NOT take the opportunity to bump in this same task.
  2. **CI uses `npm ci`** — never `npm install`. `npm ci` refuses to run if `package-lock.json` and `package.json` disagree, and installs from the lockfile only. Update all GitHub Actions workflows accordingly.
  3. **Pin every `esm.sh` import in Edge Functions to an exact version.** The current code imports `https://esm.sh/@supabase/supabase-js@2`, `https://esm.sh/@upstash/ratelimit@2`, and `https://esm.sh/@upstash/redis@1` — these resolve to "latest minor/patch" on every cold start with NO lockfile (the bigger attack surface vs npm). Replace with exact versions across all 15 EFs in `supabase/functions/*/index.ts`.
  4. **Add `npm audit --audit-level=high` to the CI workflow** — initial threshold is non-blocking warning to avoid breaking launch on a transient advisory; can be promoted to blocking once the cadence settles.
  5. **Enable Dependabot** (free, GitHub-native, lives in `.github/dependabot.yml`) — automated upgrade PRs for npm + GitHub Actions ecosystems. Pinned but not abandoned. Weekly schedule, grouped minor/patch updates.
  6. **Document the upgrade ritual in the README** (D-15 §12) — "How to safely upgrade pinned dependencies" walkthrough.

### Claude's Discretion (not worth asking)
- Exact GitHub Actions workflow file structure: one mega-workflow vs split files for cron / EF deploy / CI tests. Default = split (cleaner reasoning, smaller blast radius per failure).
- Exact Sentry sourcemap upload mechanism (Sentry CLI in build vs Vite plugin) and exactly which user attributes to attach (must NOT include Discord email or username — Discord ID hash only).
- Exact PostHog event names and properties; exact session-replay sampling rate.
- Exact Playwright fixture structure: shape of test users, test suggestions, test categories, cleanup between specs, parallelism settings.
- Exact README screenshot capture method and image format (PNG vs WebP); whether GIFs are screen recordings or static.
- Whether prefetch uses TanStack Router's `preload="intent"` (declarative) or a custom `onMouseEnter` hook (imperative).
- Exact `npm audit` ignore list for known-acceptable advisories that can't be patched without ecosystem updates.
- Whether the Sentry + PostHog consent indicator is a footer chip, a toast on first load, or a small persistent UI element near the avatar.
- Skeleton row count and exact dimensions to match the live `SuggestionList` card silhouette.
- Sentry environment naming (`production` vs `preview` vs `development`) and PostHog project mode.

### Folded Todos
- **`Phase 5: Add loading skeletons and/or prefetch-on-hover for navigation`** (from `.planning/notes/2026-04-08_navigation-loading-states.md`) — folded into D-14. Original problem was that the first load felt slow due to cold DB queries while subsequent loads were fast from cache. Both halves of the suggested fix (skeletons + prefetch) are in scope.
- **`SEED-001: Add Sentry error logging and PostHog analytics with session replays`** (dormant seed planted during Phase 2, scoped to trigger at Phase 5) — folded into D-13. The user explicitly chose "Ship both at launch" rather than defer.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 5 Requirements & Project Docs
- `.planning/REQUIREMENTS.md` — INFR-02 (keepalive cron), TEST-06 (E2E smoke critical path), INFR-01 (Netlify deploy at custom domain — already mapped to Phase 1 but must be verified live in Phase 5), AUTH-* / VOTE-* / RSLT-* (smoke test target behaviors)
- `.planning/PROJECT.md` — $0/mo budget, "opinions not votes" framing for the README, terminology mapping (user-facing vs internal), stack lock decisions
- `.planning/ROADMAP.md` — Phase 5 success criteria (4 items), dependency on Phase 4
- `.planning/DESIGN-SYSTEM.md` — shadcn/ui Maia/Neutral palette, Inter font; relevant for README screenshots and skeleton component matching
- `.planning/STATE.md` — Notes that 9 Phase 4 UAT tests are blocked on Phase 5 EF deploy; pg_cron-availability concern (now sidestepped by D-01)

### Prior Phase Context (Decisions That Carry Forward)
- `.planning/phases/01-foundation-authentication/01-CONTEXT.md` — Auth + AuthContext patterns; PostHog `identify()` hook lands here (D-13)
- `.planning/phases/02-browsing-responding/02-CONTEXT.md` — Topics/Archive routing (prefetch targets in D-14), `SuggestionList` (skeleton target in D-14)
- `.planning/phases/03-response-integrity/03-CONTEXT.md` — Edge Function fail-closed patterns; Upstash secrets (D-12)
- `.planning/phases/04-admin-panel-suggestion-management/04-CONTEXT.md` — D-12 forward-link to this phase: `close-expired-polls` exists, needs scheduling. D-05 admin seed pattern. Phase 4 EF/RLS layout that the EF deploy step (D-09) must ship.

### Phase 4 UAT (Unblocked By This Phase)
- `.planning/phases/04-admin-panel-suggestion-management/04-UAT.md` — 9 UAT items currently blocked on prod EF deploy. Phase 5 success means these become runnable; planner should reference this list when defining "deployment verified" acceptance.

### Existing Edge Functions (All Need esm.sh Pinning per D-16, All Need Production Deploy per D-09)
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/admin-auth.ts`
- `supabase/functions/close-expired-polls/index.ts` — the cron target (D-01); already gated by `CLOSE_SWEEPER_SECRET` (returns 503 if unset, per Phase 4 04-02)
- `supabase/functions/submit-vote/index.ts`
- `supabase/functions/create-poll/index.ts`
- `supabase/functions/update-poll/index.ts`
- `supabase/functions/close-poll/index.ts`
- `supabase/functions/delete-poll/index.ts`
- `supabase/functions/pin-poll/index.ts`
- `supabase/functions/set-resolution/index.ts`
- `supabase/functions/get-upload-url/index.ts`
- `supabase/functions/promote-admin/index.ts`
- `supabase/functions/demote-admin/index.ts`
- `supabase/functions/search-admin-targets/index.ts`
- `supabase/functions/create-category/index.ts`
- `supabase/functions/rename-category/index.ts`
- `supabase/functions/delete-category/index.ts`

### Existing Production-Adjacent Files
- `public/_redirects` — already contains `/*  /index.html  200` SPA fallback; no change needed
- `supabase/config.toml` — required for `supabase start` in CI (D-07)
- `package.json` — pinning target (D-16 §1)
- `package-lock.json` — already exists; CI will rely on it via `npm ci` (D-16 §2)
- `.env.example` — extend with the full D-12 layout
- `.husky/` — pre-commit hooks already in place; can layer dep-audit hooks if desired
- `vite.config.ts` — Sentry sourcemap upload likely lands here (D-13 sub-decision)
- `src/main.tsx` — Sentry init + PostHogProvider mount point (D-13)
- `src/contexts/AuthContext.tsx` — PostHog `identify()` call site after Supabase session resolved (D-13)
- `src/components/suggestions/` — `SuggestionList` skeleton target (D-14)
- `src/routes/topics.tsx`, `src/routes/archive.tsx` — TanStack Router prefetch targets (D-14)
- `README.md` — current Vite scaffold default; full rewrite (D-15)

### Folded-In Source Material
- `.planning/seeds/SEED-001-sentry-posthog-observability.md` — Folded into D-13. Mark this seed as "consumed by Phase 5" after CONTEXT.md commits (housekeeping for the seed system).
- `.planning/notes/2026-04-08_navigation-loading-states.md` — Folded into D-14. Note can be archived after this phase ships.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`close-expired-polls` Edge Function** with the `X-Cron-Secret` gate already exists. Phase 5 only provisions `CLOSE_SWEEPER_SECRET` and points the cron at it.
- **`public/_redirects`** already has the SPA fallback. Netlify will pick it up on first deploy with zero edits.
- **`supabase/config.toml`** lets `supabase start` work in CI without additional setup.
- **`package-lock.json`** exists; `npm ci` will work as soon as the workflow is added (D-16 §2).
- **`AuthContext`** is the single mount point for `posthog.identify()` — fires once per authenticated session.
- **shadcn `Skeleton` component** is part of the existing component set; reused for D-14 skeletons (no new dep).
- **TanStack Router** has built-in `preload="intent"` for D-14 prefetch — no new library required.
- **Sonner toast** is already wired everywhere; can surface client-side Sentry capture acknowledgements if desired.

### Established Patterns
- **Fail-closed auth in EFs** (Phase 3) — Sentry instrumentation in EFs (D-13) must NOT swallow errors before the auth gate runs; capture-and-rethrow pattern.
- **Edge Functions use `https://esm.sh/<pkg>@<major>` imports** — every one of these is a D-16 §3 pin target. The pattern is already consistent (good news for the rewrite).
- **`VITE_*` env-var prefix** for client-readable config — applies to the new `VITE_SENTRY_DSN` and `VITE_POSTHOG_KEY` (D-12, D-13).
- **GitHub Actions / GH integrations not yet present** — `.github/` directory does not exist. Phase 5 introduces it cleanly: `workflows/ci.yml`, `workflows/deploy-edge-functions.yml`, `workflows/cron-sweep.yml`, plus `dependabot.yml`. (Final structure is Claude's discretion.)
- **Husky pre-commit hooks** in `.husky/` are working — can extend with dep-audit if planning surfaces value.
- **lint-staged** already wires ESLint → no-warnings — keep this clean when adding the Sentry/PostHog SDK code.

### Integration Points
- **`.github/workflows/`** (new directory) — three workflows: PR CI (lint + unit tests + Playwright against `supabase start`), deploy-edge-functions on push-to-main, scheduled cron at 03:00 UTC daily.
- **`.github/dependabot.yml`** (new) — npm + actions ecosystems, weekly grouped PRs.
- **`netlify.toml`** (new, optional) — explicit build command + publish dir + (future) headers/redirects, even though `public/_redirects` already exists. Cleaner ops + reproducible build env declaration.
- **Netlify dashboard** (out-of-repo) — link to GitHub, set the four `VITE_*` env vars, custom domain, HTTPS auto-cert.
- **Supabase dashboard** (out-of-repo) — `supabase secrets set` for runtime EF env, OAuth Discord provider config (already configured for the WTCS Discord app, but need to add the prod redirect URI).
- **Discord developer portal** (out-of-repo) — dual-register the OAuth redirect URIs per D-11.
- **OVH DNS** (out-of-repo) — flip CNAME for `polls.wtcsmapban.com` to Netlify per D-11.
- **Sentry account + project** (out-of-repo, free tier) — set up project, get DSN, configure sourcemap upload.
- **PostHog account + project** (out-of-repo, free tier) — set up project, get API key, configure session replay.
- **`README.md`** — wholesale replace (D-15).
- **`docs/screenshots/`** (new directory) — committed screenshots for the README (D-15).
- **All 15 EFs in `supabase/functions/*/index.ts`** — `esm.sh` pin sweep (D-16 §3).
- **`package.json`** — strip every `^` and `~` (D-16 §1).
- **`.env.example`** — extend with full D-12 secret list.

### Creative Options the Architecture Enables
- **One CI workflow can spin `supabase start` AND build AND run Playwright** in a single job, sharing the Postgres state across phases — fast and self-contained.
- **A single `cron-sweep.yml` can do both the keepalive ping and the close-expired sweep in one HTTP call** — no need for separate workflows because the EF itself accomplishes both side effects.
- **Sentry's "release" tagging tied to the Git commit SHA** lets us link errors to specific deploys without separate release management.
- **PostHog feature flags** are available on free tier — useful future affordance for gradual rollouts (out of scope here, but worth knowing the architecture supports it without rework).

</code_context>

<specifics>
## Specific Ideas

- **README must be production-grade and aesthetically pleasing for people reading about the project** — user's exact words. Sets the bar above "engineering docs adequate for a contributor" to "documentation as part of the product surface." Treat the README the same care as a landing-page hero.
- **Dependency pinning is explicitly a CI/CD AND multi-developer-onboarding concern** — user's exact phrasing. Reproducible installs are a hard requirement; the threat models named are (a) compromised CI install pulling a malicious patch and (b) a future contributor's `npm install` getting a different transitive tree than what was tested. Both close on D-16 §1 + §2 + §3 together.
- **The `esm.sh` import surface is the BIGGER supply-chain hole than npm** — esm.sh has no lockfile equivalent. Pinning to exact versions there closes the more dangerous path; do not skip that step even if npm pinning feels like the obvious win.
- **Sentry + PostHog ship together at launch.** No staged rollout, no Sentry-first-then-PostHog later. The user wants the full picture from the first real user session. Honor that even though it's a touch more setup work.
- **Skeletons + prefetch are NOT optional polish; they're shipped together at launch.** The cold-DB lag was a real reported pain point in `notes/2026-04-08`. Treat as launch-blocker quality, not a nice-to-have.
- **GitHub Actions email-on-failure is sufficient for v1 cron alerting.** Don't over-engineer; if the cron silently fails for a week, Khai will notice via the email AND the Supabase dashboard's eventual pause-warning AND the next sweep covering it. Three layers of notice is enough.
- **Cutover sequence (D-11) is the most operationally sensitive moment in this phase.** Step ordering matters more than implementation cleverness — keep the documented sequence in the README and in a deploy runbook (could be a `docs/deploy.md` if planning surfaces the need).
- **The 9 blocked UAT items in `04-UAT.md` are an acceptance signal, not a separate test scope.** Phase 5 plans should reference them as "after Phase 5 ships, these become runnable" — not redo or re-scope them.

</specifics>

<deferred>
## Deferred Ideas

- **Discord webhook on cron failure** — considered in D-03; deferred to a later iteration if email-on-failure proves insufficient. Architecture supports adding it as a single workflow step.
- **Post-deploy production smoke tests** — considered in D-06 options; deferred because there's no clean test-data-isolation story against prod under the $0 budget. Revisit if Supabase Pro (preview branches) ever becomes affordable.
- **Real Discord test account for E2E** — considered in D-05; rejected for v1 due to brittleness and Discord's flagging risk. Not on roadmap.
- **PostHog feature flags for gradual rollouts** — architecture supports it but no current need. Roadmap backlog item if v2 work calls for staged feature releases.
- **Promote `npm audit` to blocking in CI** — D-16 §4 starts non-blocking; can promote later once the launch-week noise floor is understood.
- **`docs/deploy.md` as a separate runbook file** — speculatively useful (D-11 cutover ordering deserves a written record), but not strictly required if D-11 is captured well enough in the README. Planner's call.

</deferred>

---

*Phase: 05-launch-hardening*
*Context gathered: 2026-04-19*
