---
phase: 18
slug: test-environment-repair
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (version per `package.json`) |
| **Config file** | `vitest.config.integration.ts` |
| **Quick run command** | `npm run test:integration -- e2e/integration/vote-counts-rls.test.ts --reporter=verbose` |
| **Full suite command** | `npm run test:integration` |
| **Estimated runtime** | ~60–120 seconds (local Supabase stack + edge runtime) |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the file touched (`npm run test:integration -- <specific-file> --reporter=verbose`)
- **After every plan wave:** Run `npm run test:integration` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green locally AND in CI (TEST-17/18 require both)
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-XX | TEST-18 (config.toml `[auth.email]`) | 1 | TEST-18 | — | Local email/password sign-in mints valid sessions; `email_provider_disabled` no longer raised | integration | `npm run test:integration -- e2e/integration/vote-counts-rls.test.ts --reporter=verbose` | ✅ | ⬜ pending |
| 18-XX | TEST-17 (CLI / edge-runtime bump) | 2 | TEST-17 | — | ES256 user tokens verify without 401 fallback-to-HS256; `verify_jwt=false` prod-alignment preserved | integration | `npm run test:integration` | ✅ | ⬜ pending |
| 18-XX | TEST-19 fault-injection seed DDL | 2 | TEST-19 | — | Armable BEFORE UPDATE/DELETE triggers on `polls`, guarded by `app.e2e_seed_allowed` | integration | `npm run test:integration -- e2e/integration/create-poll-results-hidden.test.ts` | ❌ W0 | ⬜ pending |
| 18-XX | TEST-19 branch (a) UPDATE-fails | 3 | TEST-19 | — | HTTP 500; `poll_created` audit row persists; no `poll_created_orphaned`; poll absent from `polls` | integration | `npm run test:integration -- e2e/integration/create-poll-results-hidden.test.ts` | ❌ W0 | ⬜ pending |
| 18-XX | TEST-19 branch (b) UPDATE+DELETE-fail | 3 | TEST-19 | — | HTTP 500; `poll_created` + `poll_created_orphaned` (`reason: compensation_delete_failed`); poll remains | integration | `npm run test:integration -- e2e/integration/create-poll-results-hidden.test.ts` | ❌ W0 | ⬜ pending |

*Task IDs finalized by the planner; this map is the requirement→signal contract. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/fixtures/seed.sql` — fault-injection DDL section (`test_fault_config` table + armable BEFORE UPDATE/DELETE triggers on `polls`, guarded by `app.e2e_seed_allowed`)
- [ ] `e2e/integration/create-poll-results-hidden.test.ts` — 2 new executable test cases replace the end-of-file deferral comment

*All other test infrastructure already exists and covers the requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI green on the pinned CLI version | TEST-17, TEST-18 | CI runs on push; cannot be asserted from a local test command alone | After merge, confirm the `test-integration` CI job passes on the bumped CLI version with 0 skips / 0 failures |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (seed DDL + new test cases)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
