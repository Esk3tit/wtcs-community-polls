---
phase: 11
slug: schema-rls-ef-foundations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 (existing) + `@supabase/supabase-js` 2.101.1 (existing) |
| **Config file** | NEW: `vitest.config.integration.ts` at project root, scoped to `e2e/integration/` |
| **Quick run command** | `npm run test:integration -- --run vote-counts-rls.test.ts` (single file) |
| **Full suite command** | `npm run test:integration` (all integration specs) |
| **Estimated runtime** | ~30 seconds (12-cell matrix + EF authz suite, Vitest run mode) |

Existing unit config (`vitest.config.ts`, scoped to `src/__tests__/`) is unchanged — `npm run test` continues to run unit tests including `polls-effective-invariant.test.ts`.

---

## Sampling Rate

- **After every task commit:** Run `npm run test` (Vitest unit, fast — catches `from('polls')` drift via `polls-effective-invariant.test.ts`)
- **After every plan wave:** Run `npm run test:integration` (TEST-11 12-cell matrix + TEST-12 admin EF authz)
- **Before `/gsd-verify-work`:** Full unit suite + full integration suite green, plus manual `supabase db reset && supabase db push` to confirm migration 10 applies cleanly from scratch
- **Max feedback latency:** 30 seconds (integration); ~5 seconds (unit)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-W0-01 | 00 | 0 | TEST-11, TEST-12 | — | Wave 0 fixture: integration runner config | infrastructure | `npm run test:integration -- --reporter=verbose` (exits 0 with "no test files" before tests land) | ❌ W0 (`vitest.config.integration.ts`) | ⬜ pending |
| 11-W0-02 | 00 | 0 | TEST-11, TEST-12 | — | Wave 0 fixture: integration test helpers | infrastructure | importable from `e2e/integration/helpers.ts` | ❌ W0 (`e2e/integration/helpers.ts`) | ⬜ pending |
| 11-01-01 | 01 | 1 | VIS-01 | T-11-01 (schema drift) | `polls.results_hidden boolean NOT NULL DEFAULT false` + `polls.results_hidden_changed_at timestamptz` exist after migration 10 | DB/integration | `npm run test:integration -- --run vote-counts-rls.test.ts` (column reads succeed in setup) | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | VIS-09 | T-11-02 (`from('polls')` regression) | `polls_effective` projects `results_hidden` + `results_hidden_changed_at`; `security_invoker = on` preserved | unit + repo-scan | `npm run test` (runs `src/__tests__/admin/polls-effective-invariant.test.ts` — existing) | ✅ exists | ⬜ pending |
| 11-02-01 | 02 | 2 | VIS-04, VIS-05, TEST-11 | T-11-03 (RLS leakage at `vote_counts`) | 12-cell matrix invariants hold for anon × authed × service-role × hidden × voted | integration | `npm run test:integration -- --run vote-counts-rls.test.ts` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 2 | VIS-02, VIS-03, TEST-12 | T-11-04 (admin EF authz bypass) | non-admin → 403; admin → 200 + updated poll + `audit_log` row | integration | `npm run test:integration -- --run toggle-results-visibility.test.ts` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 2 | TEST-12 | T-11-05 (audit row missing / no-op double-logged) | no-op call (hidden→hidden) does NOT write an audit row | integration | Same command, dedicated `it()` case | ❌ W0 | ⬜ pending |

*Task IDs are placeholders for the planner; the per-task verification map will be refined in PLAN.md frontmatter. Threat refs (`T-11-NN`) will be locked by the threat model block in PLAN.md.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.integration.ts` — Vitest config scoped to `e2e/integration/`, sources `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` from env
- [ ] `e2e/integration/helpers.ts` — `mintClients()`, `createFreshPoll()`, `castVote()`, `signInAs()`, `invokeEF()`, `readAuditLog()`, `cleanupPoll()`
- [ ] `e2e/integration/vote-counts-rls.test.ts` — TEST-11 12-cell matrix scaffold (file exists, suite skeleton in place)
- [ ] `e2e/integration/toggle-results-visibility.test.ts` — TEST-12 admin EF authz scaffold (file exists, suite skeleton in place)
- [ ] `package.json` script: `"test:integration": "vitest run --config vitest.config.integration.ts"`
- [ ] CI YAML inherits `SUPABASE_SERVICE_ROLE_KEY` + `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` into the `test:integration` job (sequential after `test`, before `e2e`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration 10 applies cleanly against a fresh DB | VIS-01 | Cannot CI-fake a full `supabase db reset` cycle reliably on free tier | Before `/gsd-verify-work`: run `supabase db reset && supabase db push`; confirm no DDL errors and all 10 migrations apply in order |
| `toggle-results-visibility` EF reachable in deployed Supabase project | VIS-03 | Edge Function deploy is out-of-band from Vitest | `supabase functions deploy toggle-results-visibility`; confirm deploy success; smoke `curl` with admin JWT to confirm 200 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (integration runner + helpers + test scaffolds)
- [ ] No watch-mode flags (`vitest run`, not `vitest watch`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
