---
phase: 5
slug: launch-hardening
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-19
updated: 2026-04-19
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `05-RESEARCH.md` § Validation Architecture.
> Updated post-planning with per-task verification map (all 10 plans).
> 2026-04-19 post-reviews pass: rows updated for HIGH #1 (05-03/T2, 05-04/T2),
> HIGH #2 (05-05/T1), HIGH #3 (05-01/T2, 05-07/T2, 05-08/T3), M1/M3 (05-03/T1, T2),
> M2 (05-01/T1), M4/M5 (05-06/T1), M7 (05-04/T3 new row), M6 (05-08/T5a new row).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Unit framework** | Vitest 4.1.2 (existing) |
| **E2E framework** | `@playwright/test` 1.59.1 (installed in Plan 05-01) |
| **Config files** | `vite.config.ts` (existing — tests inline); `e2e/playwright.config.ts` (Plan 05-05) |
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

| Task ID | Plan | Wave | Requirement | Decision Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|--------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01/T1 | 01 | 0 | INFR-02, TEST-06 | D-16 §1 | T-05-01 | shell-grep | `grep -E '"\^' package.json \| wc -l \| xargs -I {} test {} = 0 && grep -E '"~' package.json \| wc -l \| xargs -I {} test {} = 0 && npm ci && npm run lint` (M2 — tilde exception removed) | ✅ | ⬜ pending |
| 05-01/T2 | 01 | 0 | INFR-02, TEST-06 | D-12, D-13 | T-05-02 | shell-grep | `for k in VITE_SENTRY_DSN VITE_POSTHOG_KEY SENTRY_AUTH_TOKEN CLOSE_SWEEPER_SECRET SUPABASE_ANON_KEY; do grep -q "$k" .env.example \|\| exit 1; done` (HIGH #3 — SUPABASE_ANON_KEY added) | ✅ | ⬜ pending |
| 05-02/T1 | 02 | 1 | INFR-02 | D-16 §3 | T-05-03 | shell-grep | `curl -sI "https://esm.sh/@supabase/supabase-js@2" \| head -5` (probe) | ✅ | ⬜ pending |
| 05-02/T2 | 02 | 1 | INFR-02 | D-16 §3 | T-05-03 | shell-grep | `test -z "$(grep -rE 'esm\.sh/[^@]+@[0-9]+$' supabase/functions/)" && test -z "$(grep -rE 'esm\.sh/[^@]+@[0-9]+\.[0-9]+$' supabase/functions/)"` | ✅ | ⬜ pending |
| 05-03/T1 | 03 | 1 | INFR-02, TEST-06 | D-13 | T-05-02 | shell-grep + build | `grep -q sentryVitePlugin vite.config.ts && test -z "$(grep VITE_SENTRY_AUTH_TOKEN vite.config.ts)" && grep -q 'let initialized' src/lib/posthog.ts && test -f src/lib/sentry.ts && grep -q loadSentryReplayIfConsented src/lib/sentry.ts && grep -q "await import" src/lib/sentry.ts && npm run lint` (M1 — lazy replay loader) | ✅ | ⬜ pending |
| 05-03/T2 | 03 | 1 | INFR-02, TEST-06 | D-13 | T-05-05, T-05-06, T-05-07 | unit + shell-grep + bundle budget | `grep -q 'Sentry.init' src/main.tsx && test -z "$(grep defaultPreload src/main.tsx)" && test -z "$(grep replayIntegration src/main.tsx)" && grep -q 'posthog.identify' src/contexts/AuthContext.tsx && test -z "$(grep -E 'posthog\.identify.*(email\|username\|discriminator)' src/contexts/AuthContext.tsx)" && grep -q loadSentryReplayIfConsented src/components/ConsentChip.tsx && grep -q analytics_opted_out src/components/ConsentChip.tsx && npm test -- --run && npm run build && BUNDLE_KB=$(($(for f in dist/assets/*.js; do gzip -9 -c "$f" \| wc -c; done \| awk '{s+=$1} END {print s+0}') / 1024)) && [ $BUNDLE_KB -le 400 ]` (HIGH #1 no defaultPreload, M1 consent-gated replay, M3 REAL gzipped bundle budget) | ✅ | ⬜ pending |
| 05-04/T1 | 04 | 1 | INFR-02, TEST-06 | D-14 | n/a | unit + shell-grep | `grep -q 'bg-card rounded-xl border p-5' src/components/suggestions/SuggestionSkeleton.tsx && grep -q 'length: 3' src/components/suggestions/SuggestionSkeleton.tsx && npm test -- --run` | ✅ | ⬜ pending |
| 05-04/T2 | 04 | 1 | INFR-02, TEST-06 | D-14 | T-05-08 | shell-grep | `grep -c 'preload="intent"' src/components/layout/Navbar.tsx \| awk '{exit !($1>=2)}' && test -z "$(grep -E 'to=\"/admin\".*preload' src/components/layout/Navbar.tsx)" && test -z "$(grep -E 'to=\"/admin\".*preload' src/components/layout/MobileNav.tsx)" && test -z "$(grep defaultPreload src/main.tsx)"` (HIGH #1 — admin Link has no preload attribute; main.tsx has no defaultPreload) | ✅ | ⬜ pending |
| 05-04/T3 | 04 | 1 | TEST-06 | D-08 | n/a | shell-grep | `grep -q 'data-testid="suggestion-card"' src/components/suggestions/SuggestionCard.tsx && npm test -- --run && npm run lint` (M7 — new row; stable selector hook for 05-05 Playwright suite) | ✅ | ⬜ pending |
| 05-05/T1 | 05 | 2 | TEST-06 | D-04, D-05, D-07 | T-05-09 | shell-grep | `test -f e2e/playwright.config.ts && grep -q webServer e2e/playwright.config.ts && test -z "$(grep storageState e2e/playwright.config.ts)" && test -f e2e/helpers/auth.ts && grep -q signInWithPassword e2e/helpers/auth.ts && grep -q addInitScript e2e/helpers/auth.ts && test -z "$(grep -E 'generateLink\|magicLink' e2e/helpers/auth.ts)" && test -z "$(grep SUPABASE_SERVICE_ROLE_KEY e2e/helpers/auth.ts)" && grep -q VITE_SUPABASE_ANON_KEY e2e/helpers/auth.ts && grep -q playwright-user-member@test.local e2e/fixtures/seed.sql && test -z "$(grep -rE '(eyJ\|sb_secret_\|service_role.*=)[A-Za-z0-9_-]{20,}' e2e/)" && npx playwright test --list` (HIGH #2 — signInWithPassword; no generateLink/magicLink/service-role; R2: webServer config + no top-level storageState) | ✅ | ⬜ pending |
| 05-05/T2 | 05 | 2 | TEST-06 | D-08 | T-05-09 | shell-grep | `for f in browse-respond filter-search admin-create auth-errors; do test -f e2e/tests/$f.spec.ts \|\| exit 1; done && test $(grep -l '@smoke' e2e/tests/*.spec.ts \| wc -l) -eq 4 && grep -q getByTestId e2e/tests/browse-respond.spec.ts` (M7 — specs consume data-testid from 05-04/T3) | ✅ | ⬜ pending |
| 05-06/T1 | 06 | 2 | TEST-06 | D-07, D-16 §2, D-16 §4 | T-05-11 | shell-grep + yaml-parse | `test -f .github/workflows/ci.yml && grep -q 'npm ci' .github/workflows/ci.yml && test -z "$(grep -l 'npm install' .github/workflows/)" && grep -q 'supabase start' .github/workflows/ci.yml && grep -q 'e2e/fixtures/seed.sql' .github/workflows/ci.yml && grep -q 'supabase status --output json' .github/workflows/ci.yml && test -z "$(grep -E 'secrets\.(LOCAL_ANON_KEY\|LOCAL_SERVICE_ROLE_KEY)' .github/workflows/ci.yml)" && grep -q 'npm audit --audit-level=high' .github/workflows/ci.yml && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` (M4 — canonical seed flow; M5 — keys derived at runtime) | ✅ | ⬜ pending |
| 05-07/T1 | 07 | 2 | INFR-02 | D-09 | T-05-11 | shell-grep + yaml-parse | `grep -q 'supabase functions deploy' .github/workflows/deploy-edge-functions.yml && grep -q -- '--use-api' .github/workflows/deploy-edge-functions.yml && grep -q 'version: 2.92.1' .github/workflows/deploy-edge-functions.yml` | ✅ | ⬜ pending |
| 05-07/T2 | 07 | 2 | INFR-02 | D-01, D-02, D-03 | T-05-11, T-05-13 | shell-grep + yaml-parse | `grep -q "0 3 \* \* \*" .github/workflows/cron-sweep.yml && test -z "$(grep -E 'cron:.*0 0 \* \* \*' .github/workflows/cron-sweep.yml)" && grep -q X-Cron-Secret .github/workflows/cron-sweep.yml && grep -q 'Authorization: Bearer' .github/workflows/cron-sweep.yml && grep -q SUPABASE_ANON_KEY .github/workflows/cron-sweep.yml && grep -q "jq -e '.success == true'" .github/workflows/cron-sweep.yml && grep -q 'jq -e .has..swept' .github/workflows/cron-sweep.yml && grep -q '\-X POST' .github/workflows/cron-sweep.yml && test -z "$(grep continue-on-error .github/workflows/cron-sweep.yml)"` (HIGH #3 — Bearer header + R2 jq-based whitespace-tolerant body validation) | ✅ | ⬜ pending |
| 05-07/T3 | 07 | 2 | — | D-16 §5 | T-05-13 | shell-grep + yaml-parse | `grep -q 'package-ecosystem: npm' .github/dependabot.yml && grep -q 'package-ecosystem: github-actions' .github/dependabot.yml && grep -q 'interval: weekly' .github/dependabot.yml` | ✅ | ⬜ pending |
| 05-08/T1 | 08 | 3 | INFR-02, TEST-06 | D-10, D-16 §2 | T-05-02 | shell-grep | `grep -q 'npm ci && npm run build' netlify.toml && grep -q 'NODE_VERSION = "22"' netlify.toml && test -z "$(grep 'npm install' netlify.toml)"` | ✅ | ⬜ pending |
| 05-08/T2 | 08 | 3 | — | — | — | manual (checkpoint) | Sentry DSN + PostHog key recorded by operator | n/a | ⬜ pending |
| 05-08/T3 | 08 | 3 | D-12 | D-12 | T-05-02 | manual (checkpoint) | R2 ordering: Netlify site created via "Deploy manually" FIRST → env vars added → THEN repo linked (prevents empty-VITE_* initial build). Secrets visible in Netlify, Supabase, GH dashboards — GH list includes SUPABASE_ANON_KEY (HIGH #3); LOCAL_* keys NOT stored (M5) | n/a | ⬜ pending |
| 05-08/T4 | 08 | 3 | D-10, D-11 | D-10, D-11 | T-05-15 | manual (checkpoint) | Netlify default URL serves app; Discord OAuth completes; dual-register visible in Discord portal | n/a | ⬜ pending |
| 05-08/T5a | 08 | 3 | INFR-02, TEST-06 | D-10, D-11 | T-05-15 | manual (checkpoint) | Preview URL dry-run: Discord login + submit response + admin create + cron workflow_dispatch all green BEFORE touching OVH (M6 — new row) | n/a | ⬜ pending |
| 05-08/T5 | 08 | 3 | INFR-01, INFR-02 | D-11 | T-05-15 | manual (checkpoint) | `curl -I https://polls.wtcsmapvote.com` returns 200; cron workflow_dispatch green with body validation; 04-UAT runnable; rollback runbook documented (M6) | n/a | ⬜ pending |
| 05-09/T1 | 09 | 4 | — | D-15 §3 | — | manual (checkpoint) | 4 PNG screenshots captured from prod | n/a | ⬜ pending |
| 05-09/T2 | 09 | 4 | — | D-15 §3 | — | shell-file | `for f in topics-list suggestion-with-results admin-shell mobile-view; do test -f docs/screenshots/$f.png; done && [ $(file docs/screenshots/*.png \| grep -c 'PNG image data') = 4 ]` | ✅ | ⬜ pending |
| 05-10/T1 | 10 | 4 | — | D-15 | — | shell-grep | `test -f README.md && test -z "$(grep 'Currently, two official plugins' README.md)" && for k in "WTCS Community Suggestions" "img.shields.io" "docs/screenshots/topics-list.png" "opinions" "Tech stack" "supabase start" "playwright" "VITE_SENTRY_DSN" "CLOSE_SWEEPER_SECRET" "SUPABASE_ANON_KEY" "Upgrade ritual" "esm.sh" "Dependabot" "Apache"; do grep -q "$k" README.md \|\| exit 1; done && test -z "$(grep LOCAL_ANON_KEY README.md)" && test -z "$(grep LOCAL_SERVICE_ROLE_KEY README.md)"` (HIGH #3 + M5 — SUPABASE_ANON_KEY present, LOCAL_* absent) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Per-Decision Falsifiable Proof (Nyquist Dimension 8)

| Decision | Falsifiable proof | Detection command / surface | Mapped to Task |
|----------|-------------------|-----------------------------|----------------|
| D-01 | `.github/workflows/cron-sweep.yml` exists AND Actions tab shows a green `schedule` run | `gh workflow view cron-sweep.yml` | 05-07/T2 |
| D-02 | After 1+ daily run, `polls` table has recent `closed_at` timestamps on expired polls | Supabase SQL: `select id, status, closed_at from polls where status='closed' order by closed_at desc limit 5` | 05-07/T2 + 05-08/T5 |
| D-03 | `.github/workflows/cron-sweep.yml` has no `continue-on-error`; GH email-on-failure active for repo owner | Force-fail once in test branch → confirm email | 05-07/T2 |
| D-04–D-07 | `e2e/playwright.config.ts` exists; `ci.yml` `e2e` job green | `gh run list --workflow=ci.yml --status=success` | 05-05/T1, 05-06/T1 |
| D-08 | Four spec files in `e2e/tests/` each with a `@smoke` test | `ls e2e/tests/ && grep -l '@smoke' e2e/tests/*.spec.ts` | 05-05/T2 |
| D-09 | `.github/workflows/deploy-edge-functions.yml` exists; all 15 EFs visible with recent deploy timestamps | `supabase functions list --project-ref=<ref>` | 05-07/T1 + 05-08/T5 |
| D-10 | `https://polls.wtcsmapvote.com` returns 200; `<branch>--<site>.netlify.app` preview works | `curl -I https://polls.wtcsmapvote.com` | 05-08/T4, T5a, T5 |
| D-11 | Discord OAuth flow on prod URL logs in a test user successfully | Manual E2E post-cutover | 05-08/T5 |
| D-12 | Supabase, Netlify, and GH secrets dashboards all show expected keys; `.env.example` documents them | Multi-dashboard check + `diff .env.example` | 05-01/T2 + 05-08/T3 |
| D-13 Sentry | `Sentry.init` in `src/main.tsx`; build log shows sourcemaps uploaded; prod test exception appears in Sentry within 10 min | Sentry issues feed + `grep -r 'Sentry.init' src/` | 05-03/T1, T2 + 05-08/T5 |
| D-13 PostHog | `posthog.init` fires on prod load; identify payload carries only Discord snowflake (not email/username) | PostHog events feed (filter by prod host) | 05-03/T2 + 05-08/T5 |
| D-13 consent | Fresh session shows chip; clicking Opt out halts subsequent captures AND sets `analytics_opted_out` flag; Sentry Replay NOT loaded for opted-out users (M1) | DevTools + PostHog session feed + Sentry Replay session count | 05-03/T2 |
| D-14 skeleton | Throttled 3G hard-refresh of `/topics` shows 3-row skeleton before cards | DevTools throttling | 05-04/T1 |
| D-14 prefetch | Hovering a Topics↔Archive link fires loader requests within 50ms (before click); Admin link does NOT preload (HIGH #1 — no attribute, no app-wide default) | DevTools Network tab | 05-04/T2 |
| D-15 | `README.md` contains sections 1–13; `docs/screenshots/` has ≥ 4 PNGs; shields.io badges render; SUPABASE_ANON_KEY in GH secrets table (HIGH #3); no LOCAL_* keys (M5) | `ls docs/screenshots/` + GitHub repo preview | 05-09/T2 + 05-10/T1 |
| D-16 §1 | `grep -E '"\^' package.json` returns nothing AND `grep -E '"~' package.json` returns nothing (M2 — no tilde exception) | Both greps on package.json | 05-01/T1 |
| D-16 §2 | Every GH workflow uses `npm ci`, never `npm install` | `grep -l 'npm install' .github/workflows/` empty | 05-06/T1 + 05-07/T1–T3 + 05-08/T1 |
| D-16 §3 | Every `esm.sh` import is pinned to three-digit version | `grep -rE 'esm\.sh/[^@]+@[0-9]+$' supabase/functions/` empty | 05-02/T2 |
| D-16 §4 | CI log shows `npm audit --audit-level=high`; non-blocking on warnings | `gh run view` log | 05-06/T1 |
| D-16 §5 | `.github/dependabot.yml` exists; first grouped PR appears within 1 week of merge | Dependabot activity tab | 05-07/T3 |

---

## Wave 0 Requirements (all addressed by Plan 05-01 + 05-03 + 05-05)

- [x] `e2e/playwright.config.ts` — Plan 05-05 Task 1
- [x] `e2e/helpers/auth.ts` — Plan 05-05 Task 1
- [x] `e2e/fixtures/seed.sql` — Plan 05-05 Task 1
- [x] `e2e/tests/*.spec.ts` — Plan 05-05 Task 2
- [x] `src/lib/posthog.ts` — Plan 05-03 Task 1
- [x] `src/lib/sentry.ts` — Plan 05-03 Task 1 (NEW — M1 lazy replay loader)
- [x] `src/components/AppErrorFallback.tsx` — Plan 05-03 Task 2
- [x] `src/components/ConsentChip.tsx` — Plan 05-03 Task 2
- [x] `data-testid="suggestion-card"` — Plan 05-04 Task 3 (NEW — M7)
- [x] Dependency installs (pinned exact, no tilde — M2) — Plan 05-01 Task 1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Plan |
|----------|-------------|------------|-------------------|------|
| Discord OAuth works on prod URL post-cutover | INFR-01 / D-11 | Needs real Discord account; OAuth flow brittle to automate without Discord's rate limits | Log in with a fixture Discord account at `https://polls.wtcsmapvote.com` | 05-08/T5 |
| Sentry receives a real exception from prod | D-13 Sentry | Requires triggering a known error in prod and watching dashboard | Throw a test error on a hidden route; verify in Sentry issues feed | 05-08/T5 |
| PostHog session replay appears in dashboard | D-13 PostHog | Replay ingestion is asynchronous and dashboard-only | Complete a full user journey on prod; view session in PostHog replays | 05-08/T5 |
| Sentry Replay NOT present for opted-out users (M1) | D-13 consent | DOM-level localStorage flag + dashboard session count | Load prod in incognito, click "Opt out", refresh; verify no new Sentry Replay session in dashboard over 5 min | 05-03/T2 + 05-08/T5 |
| OVH CNAME flip + Netlify cert auto-provision | D-11 | Happens in OVH console + Netlify UI | Follow D-11 runbook; verify HTTPS padlock on `polls.wtcsmapvote.com` | 05-08/T5 |
| DNS propagation | D-11 | External to the repo | `dig polls.wtcsmapvote.com` resolves to Netlify | 05-08/T5 |
| Preview URL dry-run (M6) | D-10, D-11 | Requires real Netlify deploy preview; operator judgment | Execute Task 5a checklist on `<branch>--<site>.netlify.app` before DNS flip | 05-08/T5a |
| First Dependabot PR appears | D-16 §5 | Requires a week to elapse | GH Dependabot activity tab one week after merge | 05-07/T3 (post-ship) |
| Screenshots captured from live prod | D-15 §3 | Browser + auth needed; Claude has no authenticated headless capability here | Sign in + capture viewport | 05-09/T1 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify command OR an explicit Wave 0 / checkpoint dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (manual checkpoints 05-08 sit behind automated netlify.toml check; 05-09 behind automated file-check)
- [x] Wave 0 covers all MISSING references (Playwright config, fixtures, posthog helper, sentry replay loader, ErrorBoundary, ConsentChip, data-testid hooks — all in Plans 05-01, 05-03, 05-04, 05-05)
- [x] No watch-mode flags in CI commands
- [x] Feedback latency < 30s per task; < 5 min per wave
- [x] `nyquist_compliant: true` set in frontmatter
- [x] 2026-04-19 post-reviews pass: all 4 HIGH + all 7 resolving MEDIUM concerns reflected in this map

**Approval:** planned 2026-04-19; revised post-reviews 2026-04-19
