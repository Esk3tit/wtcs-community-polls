---
phase: 5
slug: launch-hardening
status: verified
threats_total: 18
threats_closed: 18
threats_open: 0
asvs_level: 2
audit_date: 2026-04-24
created: 2026-04-24
---

# Phase 5 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail for the launch-hardening phase (Plans 05-01 through 05-10).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser ↔ Netlify SPA | User agent fetches static assets + SPA bundle | Public HTML/JS/CSS, public VITE_* env vars |
| Browser ↔ Supabase PostgREST / Edge Functions | Authenticated app calls Supabase REST + EF endpoints | Discord-OAuth JWT, user votes/suggestions |
| Browser ↔ Sentry / PostHog | Observability ingest | Error reports (scrubbed), anonymous/identified (Discord snowflake only) events |
| CI runner ↔ Supabase local stack | Ephemeral Docker Supabase during E2E | Anon/service-role keys derived at runtime (deterministic local-only) |
| GitHub Actions ↔ Supabase prod (cron) | Daily `close-expired-polls` sweep | `CLOSE_SWEEPER_SECRET` header + anon-JWT `Authorization` |
| Build host (Netlify CI) ↔ Sentry | Source-map upload at build time | `SENTRY_AUTH_TOKEN` (never `VITE_*`-prefixed; build-time only) |
| Discord OAuth ↔ Supabase Auth ↔ Netlify site | OAuth redirect round-trip | OAuth `code` exchange for JWT; dual-registered redirect URIs |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation / Status | Evidence |
|-----------|----------|-----------|-------------|---------------------|----------|
| T-05-01 | Tampering | npm deps | mitigate | Exact pins (no `^`/`~`) in package.json | `package.json:17-60` — all dep/devDep versions are exact digits |
| T-05-02 | Info Disclosure | Sentry build token | mitigate | `SENTRY_AUTH_TOKEN` NOT `VITE_*`-prefixed; sourcemaps deleted after upload; `build.sourcemap: 'hidden'` | `vite.config.ts:24-32` `filesToDeleteAfterUpload: './dist/**/*.map'`, `build.sourcemap: 'hidden'`; `disable: mode !== 'production'` |
| T-05-03 (05-01 interp.) | Tampering | lockfile | accept | `package-lock.json` committed; `npm audit` non-blocking in CI | `.github/workflows/ci.yml:37-38` — `npm audit --audit-level=high \|\| true` |
| T-05-03 (05-02 interp.) | Tampering | EF esm.sh imports | mitigate | Exact 3-digit version pins on every `https://esm.sh/...` import across all 15 Edge Functions + `_shared/admin-auth.ts` | `supabase/functions/**/index.ts` — all `@2.101.1`, `@2.0.5`, `@1.34.6` (verified via grep, no `@2`/`@2.x` floats) |
| T-05-04 | Tampering | esm.sh transitive rewrites | accept | Accepted per 05-03 residual risks; README §12 upgrade ritual | `.planning/phases/05-launch-hardening/05-03-SUMMARY.md:108`; README §12 (05-10) |
| T-05-05 | Info Disclosure | PostHog PII | mitigate | `person_profiles: 'identified_only'`, Discord snowflake identifier only, `autocapture: false`, `maskAllInputs: true` | `src/lib/posthog.ts:16-22` |
| T-05-06 | Info Disclosure | Sentry PII | mitigate | No `sendDefaultPii: true`; Sentry.init config has PII defaults off | `src/main.tsx:23-33` — config contains `dsn`, `environment`, `release`, `integrations`, `tracesSampleRate`, `replaysSessionSampleRate`, `replaysOnErrorSampleRate` only; grep for `sendDefaultPii` in `src/` → no matches |
| T-05-07 | Info Disclosure | Error fallback UI | mitigate | Generic copy only; unit test asserts no stack trace text reaches DOM | `src/components/AppErrorFallback.tsx:12-32`; `src/__tests__/components/AppErrorFallback.test.tsx:30-38` — regex checks for `/at [A-Z]/`, `/Error:/`, `/stack trace/i` negative assertions |
| T-05-08 | Info Disclosure | Admin route preload leak | mitigate | Admin `<Link>` has NO `preload` attr; no app-wide `defaultPreload` on router | `src/components/layout/Navbar.tsx:60-68` and `src/components/layout/MobileNav.tsx:54-64` — `to="/admin"` has explicit `// No preload` comment and no preload attr; `src/main.tsx:37` `createRouter({ routeTree })` has no `defaultPreload` |
| T-05-09 | Info Disclosure | E2E helper leaking service-role | mitigate | `e2e/helpers/auth.ts` reads anon key only; no `service_role` reference | `e2e/helpers/auth.ts:26-27` — reads `VITE_SUPABASE_ANON_KEY` only; grep for `service_role`/`SERVICE_ROLE` in `e2e/helpers/auth.ts` → absent |
| T-05-10 | Info Disclosure | E2E fixture seed running in prod | accept | Fail-closed `app.e2e_seed_allowed=true` guard at top of seed; local-only | `e2e/fixtures/seed.sql:15-29` — raises exception unless setting is `'true'`; `ci.yml:124-126` sets via `PGOPTIONS` |
| T-05-11 | Info Disclosure | CI logs leaking keys | mitigate | `::add-mask::` on ANON_KEY, SERVICE_ROLE_KEY, DB_URL; no raw `echo` of key values | `.github/workflows/ci.yml:103-114` — all three derived values masked; values written via `$GITHUB_OUTPUT`, not echoed |
| T-05-12 | Denial of Service | CI flakes | accept | Retry loops with timeouts in "Wait for stack ready" + "Wait for preview" | `.github/workflows/ci.yml:62-72` and `143-153` — 30-iteration polling loops |
| T-05-13 | Denial of Service | cron-sweep workflow auto-disable | mitigate | Dependabot weekly Monday commits reset 60-day inactivity clock; actions pinned | `.github/dependabot.yml` — weekly npm + github-actions schedules; `.github/workflows/cron-sweep.yml:8` comment documents coupling |
| T-05-14 | Info Disclosure | `SUPABASE_ACCESS_TOKEN` scope | accept | Scope-limited GH secret; rotation ritual documented | `.planning/phases/05-launch-hardening/05-08-SUMMARY.md:53` — rotation call-out |
| T-05-15 | Tampering | Discord OAuth redirect hijack | mitigate | Dual-registered redirect URIs (Netlify default + custom domain); AuthContext uses `window.location.origin` | `.planning/phases/05-launch-hardening/05-08-PLAN.md:21,272,495`; `05-08-SUMMARY.md:63,72`; `src/contexts/AuthContext.tsx:149` — `redirectTo: window.location.origin` |
| T-05-16 | Denial of Service | Netlify cert renewal stall | accept | Pitfall 10 renewal playbook + Contingency B rollback | `.planning/phases/05-launch-hardening/05-08-PLAN.md:62,119,363` |
| T-05-17 | Info Disclosure | CSP baseline | accept | Minimal headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS); full CSP deferred post-launch | `netlify.toml:17-38` — headers block; comment documents why full CSP is deferred |
| T-05-18 | Info Disclosure | Screenshots inherently public | accept | Sourced from live site; no private data captured | 05-PLAN residual risks |
| M1-pre-consent-replay | Info Disclosure | Sentry Replay pre-consent capture | mitigate | Replay is NOT in Sentry.init integrations; lazy-loaded via dynamic import gated on `analytics_opted_out` localStorage flag; isolated re-export enables code-split | `src/main.tsx:18-33` (init without Replay); `src/lib/sentry.ts:28-60` (`loadSentryReplayIfConsented` with opt-out guard); `src/lib/sentry-replay.ts:17` (isolated re-export); `src/components/ConsentChip.tsx:31-35,40-45` (mount-effect + opt-out writes both flags) |

*Status: all 18 threats CLOSED (12 mitigate with code/config evidence, 6 accept with documented justification).*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party).*

---

## Unregistered Threat Flags (from SUMMARY.md)

None. 05-03-SUMMARY.md line 157 explicitly states all new surface is covered by existing threat model entries (T-05-02, T-05-05, T-05-06, T-05-07, M1-pre-consent-replay). No unregistered flags detected across any 05-0X-SUMMARY.md.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-03 (lockfile trust) | `package-lock.json` commits + `npm ci` enforces lockfile parity; `npm audit` runs non-blocking in CI to surface advisories without blocking unrelated PRs. Promotable to blocking post-launch. | plan author (05-03) | 2026-04-24 |
| AR-05-02 | T-05-04 (esm.sh transitive) | esm.sh rewrites transitive deps at request time even with top-level exact pin (RESEARCH Pitfall 8). Acceptable for v1; README §12 (Plan 05-10) documents the upgrade ritual and trust anchor. | plan author (05-03) | 2026-04-24 |
| AR-05-03 | T-05-10 (E2E seed in prod) | Fail-closed guard at top of `e2e/fixtures/seed.sql` refuses to run without `app.e2e_seed_allowed=true`. Accidentally pointing at prod is a raised exception, not a silent provision. | CR-PR4 reviewer | 2026-04-24 |
| AR-05-04 | T-05-12 (CI flakes) | CI job has explicit retry loops (30 polls × 2s for Supabase stack; 30 polls × 1s for preview). Transient flakes auto-heal; hard timeouts (`timeout-minutes: 15`) bound the worst case. | plan author (05-07) | 2026-04-24 |
| AR-05-05 | T-05-14 (`SUPABASE_ACCESS_TOKEN` scope) | Token scoped to GH secrets only; documented rotation ritual in 05-08-SUMMARY.md §53 (rotate at https://supabase.com/dashboard/account/tokens after stable launch). | plan author (05-08) | 2026-04-24 |
| AR-05-06 | T-05-16 (Netlify cert stall) | Cert-provisioning stall >2h is pre-documented; Pitfall 10 "Renew certificate" action + Contingency B rollback in 05-08-PLAN line 62,119,363. | plan author (05-08) | 2026-04-24 |
| AR-05-07 | T-05-17 (minimal CSP) | Correct CSP must enumerate connect-src for Sentry, PostHog, Supabase, Discord CDN — any error silently bricks observability. Full CSP rollout belongs in a Report-Only follow-up task. Minimal headers (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy) shipped. | plan author (05-08), greptile-apps PR #4 2026-04-22 | 2026-04-24 |
| AR-05-08 | T-05-18 (public screenshots) | Screenshots captured from the live production site contain no private data beyond what is already visible to any signed-in user. | plan author (05-10) | 2026-04-24 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-24 | 18 | 18 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (8 entries)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-24
