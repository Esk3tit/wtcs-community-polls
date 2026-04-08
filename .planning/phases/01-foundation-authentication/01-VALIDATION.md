---
phase: 1
slug: foundation-authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react |
| **Config file** | vitest.config.ts (Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INFR-01 | — | N/A | setup | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | INFR-03 | — | N/A | setup | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | AUTH-01 | T-1-01 | OAuth redirects use PKCE flow | integration | `npx vitest run src/__tests__/auth` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | AUTH-02 | T-1-02 | 2FA check via provider_token | integration | `npx vitest run src/__tests__/auth` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | AUTH-04 | — | Session persists across refresh | integration | `npx vitest run src/__tests__/auth` | ❌ W0 | ⬜ pending |
| 1-02-04 | 02 | 1 | AUTH-05 | — | Sign out clears all tokens | integration | `npx vitest run src/__tests__/auth` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | UIDN-01 | — | N/A | unit | `npx vitest run src/__tests__/ui` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | UIDN-02 | — | N/A | unit | `npx vitest run src/__tests__/ui` | ❌ W0 | ⬜ pending |
| 1-03-03 | 03 | 2 | UIDN-03 | — | N/A | unit | `npx vitest run src/__tests__/ui` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | ADMN-01 | T-1-03 | Admin check uses RLS policies | unit | `npx vitest run src/__tests__/admin` | ❌ W0 | ⬜ pending |
| 1-05-01 | 05 | 3 | TEST-01 | — | N/A | meta | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-05-02 | 05 | 3 | TEST-02 | — | N/A | integration | `npx vitest run src/__tests__/auth` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest configuration with jsdom environment
- [ ] `src/test/setup.ts` — Test setup file with RTL cleanup
- [ ] `package.json` — devDependencies: vitest, @testing-library/react, @testing-library/jest-dom, jsdom

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Discord OAuth redirect flow | AUTH-01 | Requires real Discord OAuth server | Click "Sign in with Discord", verify redirect to Discord, authorize, verify return to app with user info |
| 2FA rejection with real Discord | AUTH-02 | Requires Discord account without 2FA | Attempt login with non-2FA Discord account, verify error card displayed |
| Light/dark mode toggle | UIDN-02 | Visual verification | Toggle system preference, verify theme switches without flash |
| Mobile layout responsive | UIDN-03 | Visual verification | Resize browser to 375px width, verify single-column layout with touch targets ≥44px |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
