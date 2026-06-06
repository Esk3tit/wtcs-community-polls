---
phase: 19
slug: db-migration-a11y-restore
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-02
audited: 2026-06-03
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit/component) + vitest integration (`e2e/integration/`, live local Supabase stack) + Playwright (`@smoke` E2E) |
| **Config file** | `vitest.config.ts` (unit) · `vitest.config.integration.ts` (integration) · `e2e/playwright.config.ts` (smoke) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npm run test:integration` |
| **Estimated runtime** | unit ~3.8s (403 tests) · integration ~2.5s (32 tests) · @smoke ~26.5s (6 tests) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && npm run test:integration`
- **Before `/gsd:verify-work`:** Full suite must be green (incl. `@smoke`)
- **Max feedback latency:** ~4s (unit) / ~7s (unit + integration)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | DBHY-05 | T-19-01..06 | Direct client UPDATE to `mfa_verified`/`is_admin`/`guild_member` is rejected; trusted RPC path commits via transaction-local GUC; no GUC leak | integration | `npm run test:integration` | ✅ | ✅ green (6/6) |
| 19-01-02 | 01 | 1 | DBHY-05 | T-19-04/09 | Regression proof exists: gate fires in both directions against the live post-migration DB (cases a–f) | integration | `npm run test:integration` | ✅ | ✅ green |
| 19-02-01 | 02 | 1 | UIDN-06 | T-19-07(a11y) | `CardTitle asChild` emits a native element via `Slot.Root` (polymorphism), not a `div` with ARIA override | unit | `npm run test` | ✅ | ✅ green |
| 19-02-02 | 02 | 1 | UIDN-06 | T-19-07(a11y) | Admins/Categories section titles are real level-2 headings (`getByRole('heading', { level: 2 })`); `role="heading"`/`aria-level` removed | unit | `npm run test` | ✅ | ✅ green |
| 19-03 (gate) | 03 | 2 | DBHY-05 | T-19-09/10 | Migration applies to local stack, advisor lint clean, `@smoke` submit-vote round-trip unaffected | integration + e2e | `supabase db lint --level warning` · `npm run test:integration` · `npx playwright test --grep @smoke` | ✅ | ✅ green (lint clean · 32/32 · 6/6) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Coverage map:**
- **DBHY-05** → `e2e/integration/profile-trigger-gate.test.ts` (6 cases: a/b/c protected-column rejections, d allowed-column sanity, e ordered RPC GUC-bypass proof, f GUC-leak guard) + advisor lint + `@smoke` no-regression. COVERED.
- **UIDN-06** → `src/__tests__/admin/admins-tab.test.tsx:122` + `src/__tests__/admin/categories-tab.test.tsx:103` (`findByRole('heading', { level: 2, name: ... })`). COVERED.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new framework, fixtures, or stubs required — Phase 19 reused the established vitest unit suite, the `e2e/integration/` vitest harness (with `e2e/fixtures/seed.sql` auth fixtures), and the Playwright `@smoke` suite.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production (`--linked`) migration applies cleanly with zero new advisor WARNs | DBHY-05 (SC2 prod half) | DEFERRED to v1.4 milestone ship — not a Phase 19 gate (CONTEXT.md: no live users, ships in normal deploy order). Not testable locally; requires the hosted project. | At milestone ship: `supabase db push --linked` then `supabase db lint --linked --level warning`; confirm no `0011_function_search_path_mutable` WARN on the two functions. |

*Note: the integration suite is automated (`npm run test:integration`) but environment-dependent — it requires the local Supabase stack running and `e2e/fixtures/seed.sql` applied (re-apply after any `supabase db reset`). This is automation with an environment prerequisite, not a manual verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infra sufficient)
- [x] No watch-mode flags
- [x] Feedback latency < 10s (unit ~4s, +integration ~7s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-03

---

## Validation Audit 2026-06-03

| Metric | Count |
|--------|-------|
| Requirements | 2 (DBHY-05, UIDN-06) |
| Covered (automated, green) | 2 |
| Partial | 0 |
| Missing | 0 |
| Manual-only (deferred deploy step) | 1 (SC2 prod-deploy half) |

**Result:** NYQUIST-COMPLIANT. Both phase requirements have automated verification that ran green this session (unit 403/403, integration 32/32 incl. profile-trigger-gate 6/6, advisor lint clean, @smoke 6/6). No test gaps to fill; no test generation required. The one manual-only row is a deferred production-deploy step, not a missing test.
