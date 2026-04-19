---
phase: 5
slug: launch-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `05-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Unit framework** | Vitest 4.1.2 (existing) |
| **E2E framework** | `@playwright/test` 1.59.1 (new — Wave 0 install) |
| **Config files** | `vite.config.ts` (existing — tests inline); `e2e/playwright.config.ts` (new) |
| **Quick run command** | `npm test -- --run && npm run lint` |
| **Smoke E2E command** | `npx playwright test --grep @smoke` |
| **Full suite command** | `npm test -- --run && npx playwright test` |
| **Estimated runtime** | ~30s unit+lint; ~3–5 min full E2E suite |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run && npm run lint` (< 30s)
- **After every plan wave:** Run `npm run build && npx playwright test --grep @smoke`
- **Before `/gsd-verify-work`:** Full suite green + manual production smoke (curl https://polls.wtcsmapvote.com + Discord OAuth login)
- **Max feedback latency:** 30s per task commit; 5 min per wave merge

---

## Per-Task Verification Map

> Populated during planning. Each task must map to either an automated command or an explicit Wave 0 dependency that unblocks verification. Falsifiable proofs per locked decision are listed in § Per-Decision Falsifiable Proof below.

| Task ID | Plan | Wave | Requirement | Decision Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|--------------|-----------------|-----------|-------------------|-------------|--------|
| _TBD by planner_ | _TBD_ | _TBD_ | INFR-02 / TEST-06 | D-01..D-16 | _see 05-RESEARCH § Security Domain_ | unit / e2e / manual | _see falsifiable-proof table_ | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Per-Decision Falsifiable Proof (Nyquist Dimension 8)

| Decision | Falsifiable proof | Detection command / surface |
|----------|-------------------|-----------------------------|
| D-01 | `.github/workflows/cron-sweep.yml` exists AND Actions tab shows a green `schedule` run | `gh workflow view cron-sweep.yml` |
| D-02 | After 1+ daily run, `polls` table has recent `closed_at` timestamps on expired polls | Supabase SQL: `select id, status, closed_at from polls where status='closed' order by closed_at desc limit 5` |
| D-03 | `.github/workflows/cron-sweep.yml` has no `continue-on-error`; GH email-on-failure active for repo owner | Force-fail once in test branch → confirm email |
| D-04–D-07 | `e2e/playwright.config.ts` exists; `ci.yml` `e2e` job green | `gh run list --workflow=ci.yml --status=success` |
| D-08 | Four spec files in `e2e/tests/` each with a `@smoke` test | `ls e2e/tests/ && grep -l '@smoke' e2e/tests/*.spec.ts` |
| D-09 | `.github/workflows/deploy-edge-functions.yml` exists; all 15 EFs visible with recent deploy timestamps | `supabase functions list --project-ref=<ref>` |
| D-10 | `https://polls.wtcsmapvote.com` returns 200; `<branch>--<site>.netlify.app` preview works | `curl -I https://polls.wtcsmapvote.com` |
| D-11 | Discord OAuth flow on prod URL logs in a test user successfully | Manual E2E post-cutover |
| D-12 | Supabase, Netlify, and GH secrets dashboards all show expected keys; `.env.example` documents them | Multi-dashboard check + `diff .env.example` |
| D-13 Sentry | `Sentry.init` in `src/main.tsx`; build log shows sourcemaps uploaded; prod test exception appears in Sentry within 10 min | Sentry issues feed + `grep -r 'Sentry.init' src/` |
| D-13 PostHog | `posthog.init` fires on prod load; identify payload carries only Discord snowflake (not email/username) | PostHog events feed (filter by prod host) |
| D-13 consent | Fresh session shows chip; clicking Opt out halts subsequent captures | DevTools + PostHog session feed |
| D-14 skeleton | Throttled 3G hard-refresh of `/topics` shows 3-row skeleton before cards | DevTools throttling |
| D-14 prefetch | Hovering a Topics↔Archive link fires loader requests within 50ms (before click) | DevTools Network tab |
| D-15 | `README.md` contains sections 1–13; `docs/screenshots/` has ≥ 4 PNGs; shields.io badges render | `ls docs/screenshots/` + GitHub repo preview |
| D-16 §1 | `grep -E '"\^' package.json` returns nothing (tilde for `typescript` is an explicit exception, if kept) | `grep -E '"\^' package.json` |
| D-16 §2 | Every GH workflow uses `npm ci`, never `npm install` | `grep -l 'npm install' .github/workflows/` empty |
| D-16 §3 | Every `esm.sh` import is pinned to three-digit version | `grep -rE 'esm\.sh/[^@]+@\d+$' supabase/functions/` empty |
| D-16 §4 | CI log shows `npm audit --audit-level=high`; non-blocking on warnings | `gh run view` log |
| D-16 §5 | `.github/dependabot.yml` exists; first grouped PR appears within 1 week of merge | Dependabot activity tab |

---

## Wave 0 Requirements

- [ ] `e2e/playwright.config.ts` — Playwright config with `storageState` auth fixture
- [ ] `e2e/helpers/auth.ts` — `loginAs(page, userId)` helper using service-role JWT injection
- [ ] `e2e/fixtures/seed.sql` (or `supabase/seed.sql` extension) — fixture users, categories, suggestions
- [ ] `e2e/tests/*.spec.ts` — four smoke specs per D-08 (user browse, filter+search, admin-create → user-sees, auth error states)
- [ ] `src/lib/posthog.ts` — init helper + consent helpers
- [ ] `src/components/AppErrorFallback.tsx` — Sentry ErrorBoundary fallback per UI-SPEC Contract 2
- [ ] `src/components/ConsentChip.tsx` — PostHog consent chip per UI-SPEC Contract 3
- [ ] Dependency installs (pinned exact versions):
  - `npm install --save-exact @sentry/react@10.49.0 posthog-js@1.369.3`
  - `npm install --save-exact --save-dev @sentry/vite-plugin@5.2.0 @playwright/test@1.59.1`
  - `npx playwright install --with-deps chromium`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Discord OAuth works on prod URL post-cutover | INFR-01 / D-11 | Needs real Discord account; OAuth flow brittle to automate without Discord's rate limits | Log in with a fixture Discord account at `https://polls.wtcsmapvote.com` |
| Sentry receives a real exception from prod | D-13 Sentry | Requires triggering a known error in prod and watching dashboard | Throw a test error on a hidden route; verify in Sentry issues feed |
| PostHog session replay appears in dashboard | D-13 PostHog | Replay ingestion is asynchronous and dashboard-only | Complete a full user journey on prod; view session in PostHog replays |
| OVH CNAME flip + Netlify cert auto-provision | D-11 | Happens in OVH console + Netlify UI | Follow D-11 runbook; verify HTTPS padlock on `polls.wtcsmapvote.com` |
| DNS propagation | D-11 | External to the repo | `dig polls.wtcsmapvote.com` resolves to Netlify |
| First Dependabot PR appears | D-16 §5 | Requires a week to elapse | GH Dependabot activity tab one week after merge |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify command OR an explicit Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Playwright config, fixtures, posthog helper, ErrorBoundary, ConsentChip)
- [ ] No watch-mode flags in CI commands
- [ ] Feedback latency < 30s per task; < 5 min per wave
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills per-task map

**Approval:** pending
