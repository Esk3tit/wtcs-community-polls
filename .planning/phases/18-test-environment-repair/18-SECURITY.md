---
phase: 18
slug: test-environment-repair
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-01
---

# Phase 18 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Local Supabase stack → internet | Local stack is not internet-accessible; `config.toml` / `seed.sql` changes cannot reach the hosted project (no `supabase config push` / `db push` in closeout) | Local-only auth + test fixture data |
| CI workflow → GitHub Actions runners | CLI version pin selects which Docker image runs in CI; no new network surface opened | Edge-runtime image tag |
| `test_fault_config` table → `polls` triggers | BEFORE UPDATE/DELETE triggers fire for all connections but only `RAISE` when a row matches the operating poll's `title`; dormant (no-op) when the table is empty; never present in production | Test fault sentinels (title-scoped) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-18-01 | Spoofing | `[auth.email] enable_signup=true` in `config.toml` | accept | Local-only; stack not internet-accessible; prod auth is Discord OAuth only; no `config push` in closeout (verified: zero `config push` refs) | closed |
| T-18-02 | Tampering | Removal of `[functions.*] verify_jwt=false` entries | mitigate | `git diff e12bee9..HEAD -- supabase/config.toml` shows only the `[auth.email]` block added; zero `verify_jwt=false` lines removed | closed |
| T-18-03 | Tampering | CLI bump introduces breaking EF API changes | accept | edge-runtime v1.73→v1.74.0 bugfix-only (research); v1.74.0 confirmed via `docker ps`; integration suite 24→26 pass / 0 fail after bump | closed |
| T-18-04 | Tampering | CI/deploy/package files modified beyond version pin | mitigate | Diffs scoped to 4 pin lines + 2 declared `ON_ERROR_STOP=1` additions (plan 18-03 / T-18-06 scope); `PGOPTIONS: -c app.e2e_seed_allowed=true` guard unchanged; no env-block/structure tampering | closed |
| T-18-SC-02 | Tampering | npm devDependency bump (`supabase` 2.98.2→2.102.0) | accept | Same official publisher, stable release, no prerelease, no new package added | closed |
| T-18-05 | Elevation of Privilege | `fault_inject_polls_before_update/delete` trigger functions | accept | Both declared `SECURITY INVOKER` — run as caller's privileges, no escalation | closed |
| T-18-06 | Tampering | Fault DDL applied to production | mitigate | DDL lives only in `e2e/fixtures/seed.sql`, guarded by `app.e2e_seed_allowed=true`, fail-closed via `\set ON_ERROR_STOP on` + `-v ON_ERROR_STOP=1` on both CI psql calls; `grep test_fault_config supabase/migrations/` → 0; `grep -c ON_ERROR_STOP=1 ci.yml` → 2 | closed |
| T-18-07 | Denial of Service | Armed fault row not disarmed, poisoning later tests | mitigate | Each fault test disarms in a `finally` block; `afterEach` unconditionally clears `test_fault_config` first; rows title-scoped; suite serialized (`fileParallelism: false`) | closed |
| T-18-SC-03 | Tampering | npm/pip/cargo installs in plan 18-03 | accept | No new packages installed (vitest config + SQL + workflow edits only) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-18-01 | T-18-01 | Local-only `[auth.email]` enable_signup; stack not internet-accessible; production auth is Discord OAuth only | Khai Phan | 2026-06-01 |
| AR-18-02 | T-18-03 | edge-runtime v1.74.0 is bugfix-only vs v1.73.x; integration suite green after bump | Khai Phan | 2026-06-01 |
| AR-18-03 | T-18-SC-02 | `supabase` devDependency advanced to stable release from same official publisher; no new package; prereleases rejected | Khai Phan | 2026-06-01 |
| AR-18-04 | T-18-05 | Fault trigger functions use `SECURITY INVOKER`; no privilege escalation possible | Khai Phan | 2026-06-01 |
| AR-18-05 | T-18-SC-03 | Plan 18-03 installs no new packages (config/SQL/workflow edits only) | Khai Phan | 2026-06-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-01 | 9 | 9 | 0 | gsd-security-auditor |

---

## Carry-Forward (informational, non-blocking)

- **CR-01 (code review 18-REVIEW.md):** `submit-vote`, `get-upload-url`, `search-admin-targets` lack a local `verify_jwt = false` override in `config.toml`. Fact-checked as a **pre-existing latent fidelity gap, NOT introduced by Phase 18** (only `[auth.email]` was added; no `verify_jwt` entry removed). No current integration test invokes those functions, so it is not a false-green source. Recommended follow-up if/when those functions gain authed integration tests.
- **WR-01 (code review):** Fault triggers are durable `public.polls` objects gated only by an empty config table. T-18-06's declared mitigation is fully present (DDL seed-only, fail-closed, not in migration), so the threat is CLOSED as dispositioned; an in-trigger GUC check would be additional defense-in-depth, not a missing mitigation.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-01
