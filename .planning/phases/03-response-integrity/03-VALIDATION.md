---
phase: 3
slug: response-integrity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | AUTH-03 | T-03-01 | Non-member rejected at login with error page | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | AUTH-03 | T-03-01 | Guild check uses provider_token, not bot API | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | VOTE-04 | T-03-02 | Rate-limited user gets 429 with toast message | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | TEST-04 | — | All integrity tests pass | integration | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/__tests__/auth/callback-behavior.test.tsx` — AUTH-03 guild membership verification (8 tests)
- [x] `src/__tests__/integrity/rate-limit-edge-function.test.ts` — VOTE-04 rate limiting behavior (10 tests)
- [x] `src/__tests__/integrity/rate-limit-toast.test.tsx` — VOTE-04 client-side toast display (2 tests)

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Discord OAuth with guilds scope returns guild list | AUTH-03 | Requires real Discord OAuth flow | Sign in with test Discord account, verify guilds scope is requested |
| Upstash Redis rate limit persists across requests | VOTE-04 | Requires live Upstash connection | Submit responses rapidly, verify rate limit triggers |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
