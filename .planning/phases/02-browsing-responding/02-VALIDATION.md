---
phase: 02
slug: browsing-responding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.1 + React Testing Library |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | CATG-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | VOTE-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | VOTE-02 | T-02-01 | Edge Function validates poll status, choice ownership, uniqueness | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | VOTE-03 | T-02-02 | DB constraint prevents duplicate votes | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | RSLT-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | RSLT-02 | T-02-03 | RLS enforces respond-then-reveal | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | RSLT-04 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-03-04 | 03 | 2 | RSLT-05 | T-02-04 | Only respondents see closed results | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for VOTE-01, VOTE-02, VOTE-03, RSLT-01, RSLT-02, RSLT-04, RSLT-05, CATG-02
- [ ] Mock Supabase client fixture for unit tests
- [ ] Edge Function test helpers (mock Deno.serve context)

*Existing vitest + RTL infrastructure from Phase 1 covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile touch targets | CATG-04 | Visual/tactile check | Open on phone, verify tap targets ≥44px, no horizontal scroll |
| HTTP polling visual update | RSLT-04 | Timing-dependent UI | Vote in tab A, observe tab B updates within 10s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
