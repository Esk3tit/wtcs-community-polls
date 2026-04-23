# Phase 5: Launch Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `05-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 05-launch-hardening
**Areas discussed:** Scheduler strategy, E2E smoke tests, Production deploy & secrets, Launch scope extras

---

## Scheduler Strategy

### Q: Which scheduler should we use for both the daily close-expired-polls sweep and the keepalive ping?

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions cron | Free, already part of the WTCS toolchain, good logs + re-run UI, no new vendor. Single workflow with `on.schedule: cron` hits the EF via curl with `X-Cron-Secret` as a repo secret. | ✓ (Recommended) |
| Netlify scheduled functions | Stays on the hosting vendor, free tier allowance, adds a wrapper function that curls the EF. | |
| External cron service | cron-job.org / EasyCron. Nothing to deploy but another account/service holding the sweep secret. | |
| Supabase pg_cron | Runs inside Supabase via pg_cron extension. Phase 3 blocker — free-tier availability unconfirmed. | |

**User's choice:** GitHub Actions cron.

### Q: Do we want one scheduled job (daily close-expired = keepalive), or two separate jobs?

| Option | Description | Selected |
|--------|-------------|----------|
| One daily job, both purposes | Daily call to close-expired-polls EF sweeps expired suggestions AND keeps the DB warm. 7× safety margin over Supabase's 7-day pause threshold. | ✓ (Recommended) |
| Two separate jobs | Daily sweep + separate keepalive every ~3 days. More moving parts; decouples sweep from stay-alive. | |

**User's choice:** One daily job, both purposes.

### Q: What time-of-day should the daily sweep run (UTC)?

| Option | Description | Selected |
|--------|-------------|----------|
| 03:00 UTC | Off-peak for EU and NA. Aligns with typical nightly batch convention. | ✓ (Recommended) |
| 00:00 UTC | Midnight UTC — clean boundary, closer to NA evening primetime. | |
| You decide | Claude picks during planning. | |

**User's choice:** 03:00 UTC.

### Q: How should we know if the cron silently fails?

| Option | Description | Selected |
|--------|-------------|----------|
| GH Actions email on failure | Built-in, zero setup, free, works for the small admin team. | ✓ (Recommended) |
| Discord webhook on failure | Workflow posts to a private admin Discord channel. More visible but requires webhook URL secret. | |
| Defer — monitor manually first month | Ship without alerting; check the Actions tab during launch week. | |

**User's choice:** GH Actions email on failure.

### Q: Move on to E2E smoke tests, or more scheduler questions?

| Option | Description | Selected |
|--------|-------------|----------|
| Next area (E2E smoke tests) | Move on. | |
| More scheduler questions | Stay on scheduler. | |
| Other | Freeform addition. | ✓ |

**User's choice:** Other — "Also scope in updating the README.md into a professional production ready readme that is comprehensive and aesthetically pleasing to look at and read."
**Notes:** Captured as a new Phase 5 scope item (D-15). Moved on to E2E discussion.

---

## E2E Smoke Tests

### Q: Which E2E framework?

| Option | Description | Selected |
|--------|-------------|----------|
| Playwright | Modern, free, parallel by default, Microsoft-backed. Best DX for SPAs, TypeScript-native. | ✓ (Recommended) |
| Cypress | Popular and mature but slower, runs serially in OSS. | |
| Vitest + @testing-library only (no browser) | Skip true E2E; use higher-level integration tests against jsdom. Doesn't satisfy browser-level smoke cleanly. | |

**User's choice:** Playwright.

### Q: How should E2E tests handle Discord OAuth + 2FA?

| Option | Description | Selected |
|--------|-------------|----------|
| Programmatic session injection | Mint a Supabase session for fixture test users via service-role key in test setup; skip OAuth UI entirely. | ✓ (Recommended) |
| Real Discord test account | Account with stored credentials + TOTP secret. Brittle; Discord may flag it. | |
| Mock the Discord response in dev mode | Dev-only feature flag bypassing real Discord. Limits realism, adds production-vs-test branching. | |

**User's choice:** Programmatic session injection.

> **Superseded:** the service-role-key variant of "Programmatic session injection" was replaced during execution by `signInWithPassword` against the public anon key (test-only fixture users seeded into the local Supabase stack). See 05-RESEARCH HIGH #2 and `05-05-SUMMARY.md` — service-role key is **not** used in any test code. Do not copy/paste the original service-role pattern.

### Q: Where do the E2E smoke tests run? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Local dev (`npm run e2e`) | Always available; run against `supabase start` during manual verification. | ✓ (Recommended) |
| CI on every PR | Run against Netlify deploy preview / local Supabase on each PR. Catches regressions before merge. | ✓ (Recommended) |
| Post-deploy prod smoke | After every prod deploy, run a subset against `polls.wtcsmapban.com`. Good safety net but pollutes prod DB. | |

**User's choice:** Local dev + CI on every PR.

### Q: How should we isolate E2E test data (no Supabase preview branches on free tier)?

| Option | Description | Selected |
|--------|-------------|----------|
| Local Supabase in CI via `supabase start` | Full local Supabase stack in GitHub Actions via Docker. Fully isolated, ~1-2 min CI runtime. | ✓ (Recommended) |
| Prod Supabase + namespaced fixtures | Tests hit prod with `__e2e_test_*` prefix. Cleanup before/after. Real pollution risk if cleanup fails. | |
| Local-only (no CI E2E) | Run E2E only on dev machines. Cheapest, loses CI regression safety net. | |

**User's choice:** Local Supabase in CI via `supabase start`.

### Q: Which user journeys are 'critical path' for the smoke suite? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| User: browse → respond → see results | TEST-06 baseline; authenticated user picks a suggestion, submits a response, sees live results. | ✓ (Recommended) |
| User: filter by category + search | Covers CATG-03/04 in the smoke layer. | ✓ (Recommended) |
| Admin: create suggestion → appears in public feed | Satisfies ROADMAP Phase 5 success criterion #3. | ✓ (Recommended) |
| Auth error states (2FA reject, not-in-server reject) | Confirms AuthErrorPage variants render correctly. Already unit-tested; potentially redundant. | ✓ |

**User's choice:** All four journeys.
**Notes:** User chose full coverage including auth error states despite the unit-test overlap. Honor in plan.

---

## Production Deploy & Secrets

### Q: How should Supabase Edge Functions be deployed to production?

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions on push-to-main | Workflow runs `supabase functions deploy` on merges to main, auth via repo secrets. Consistent with cron choice. | ✓ (Recommended) |
| Manual from dev machine | Local CLI deploy whenever EFs change. Couples deploys to one machine. | |
| Hybrid: manual for launch, CI after | Launch manually, add CI later. Pragmatic if CI setup feels heavy. | |

**User's choice:** GitHub Actions on push-to-main.

### Q: Netlify deploy trigger / branching model?

| Option | Description | Selected |
|--------|-------------|----------|
| push-to-main = prod, PR = preview | Standard Netlify workflow; main auto-deploys, each PR gets unique preview URL. | ✓ (Recommended) |
| Manual deploys only | `netlify deploy --prod` from dev machine. More control, less automation. | |

**User's choice:** push-to-main = prod, PR = preview.

### Q: DNS + Discord OAuth cutover sequence?

| Option | Description | Selected |
|--------|-------------|----------|
| Deploy → dual-register OAuth → flip DNS | Netlify deploys first; verify; add both URLs to OAuth; flip CNAME; verify on custom domain. Near-zero-downtime. | ✓ (Recommended) |
| Flip DNS first, then deploy | CNAME points at Netlify before first deploy. Simpler sequence but brief window of broken domain. | |
| You decide during planning | Claude picks. | |

**User's choice:** Deploy → dual-register OAuth → flip DNS.

### Q: Where does each secret live?

| Option | Description | Selected |
|--------|-------------|----------|
| Standard split | Netlify env (client), Supabase secrets (EF runtime), GitHub Actions repo secrets (CI/cron). Documented in `.env.example` + README table. | ✓ (Recommended) |
| Everything via `.env` + Netlify only | Single dashboard; loses runtime separation (EF can't cleanly read Netlify env vars). | |

**User's choice:** Standard split.

---

## Launch Scope Extras

### Q: SEED-001 (Sentry + PostHog) — ship at launch or defer?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship Sentry only at launch | Error visibility from day one; ~1 task's worth. Defer PostHog to post-launch phase. | (Recommended) |
| Ship both Sentry + PostHog at launch | Full observability day one: errors + analytics + session replays. More setup (~3-4 tasks). | ✓ |
| Defer both to a new Phase 6 | Keep Phase 5 minimal; observability becomes dedicated post-launch phase. | |
| Defer both to v2 backlog | Rely on Supabase/Netlify logs + user reports for first weeks. | |

**User's choice:** Ship both Sentry + PostHog at launch.
**Notes:** User opted for the heavier scope over the recommendation. Honor that — full observability on day one.

### Q: UX polish (skeletons + prefetch) — in Phase 5 or defer?

| Option | Description | Selected |
|--------|-------------|----------|
| Include in Phase 5 | First impressions matter at launch; addresses the cold-DB lag. Small self-contained task. | ✓ (Recommended) |
| Defer to v1.1 or polish backlog | Launch without polish; follow up post-launch. Risk: slow first load on launch day. | |

**User's choice:** Include in Phase 5.

### Q: Anything else you want folded into Phase 5 before we write context?

**User's choice:** "Yes, I want to add something."
**Notes:** "Rewrite the README into a production and aesthetically pleasing professional README that is really pleasing to look at for people who are reading about the project. Also pin the dependency version so that we aren't susceptible to supply chain attacks when we're installing the packages for CI/CD or if we have another person working on the project." — captured as D-15 (README) and D-16 (dep pinning).

### Q: How deep should dependency pinning go for Phase 5?

| Option | Description | Selected |
|--------|-------------|----------|
| Full belt-and-suspenders | Strip `^`/`~`, `npm ci` in CI, pin esm.sh imports, `npm audit` in CI, Dependabot, README upgrade ritual. | ✓ (Recommended) |
| npm side only | Pin package.json + `npm ci`. Leave esm.sh as-is (bigger attack surface left open). | |
| esm.sh side only | Pin EF imports only; skip npm pinning. | |
| Add Dependabot/Renovate too | All of "Full belt-and-suspenders" PLUS Dependabot. | |

**User's choice:** Full belt-and-suspenders.
**Notes:** Dependabot was explicitly listed in the recommended option's scope description; final interpretation includes it (see D-16 §5).

### Q: README structure preference?

| Option | Description | Selected |
|--------|-------------|----------|
| Public-product README | Audience: anyone landing on the repo. Hero, badges, screenshots, what/why, tech stack, setup, deploying, env vars, contributing, license. | ✓ (Recommended) |
| Dev-handoff README | Audience: future engineers only. Setup, architecture, runbook, troubleshooting. Less marketing. | |
| You decide during planning | Claude picks based on similar-project survey. | |

**User's choice:** Public-product README.

### Q: Anything else, or ready to write CONTEXT.md?

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context | Write CONTEXT.md with the full scope. | ✓ |
| I want to add or revisit something | Keep discussing. | |

**User's choice:** Ready for context.

---

## Claude's Discretion (deferred to planning)

See `05-CONTEXT.md` §Claude's Discretion for the full list. Summary: exact workflow file structure, Sentry sourcemap mechanism, PostHog event schema, Playwright fixture shape, README screenshot format, prefetch implementation style, `npm audit` ignore list, consent-indicator placement, skeleton dimensions, Sentry/PostHog environment naming.

## Deferred Ideas

See `05-CONTEXT.md` §Deferred for the full list. Summary: Discord webhook alerting, post-deploy prod smoke, real Discord test account, PostHog feature flags, promoting `npm audit` to blocking, separate deploy runbook file.
