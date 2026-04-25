---
phase: 6
slug: auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run && npm run lint && npm run build` |
| **Estimated runtime** | ~30s tests + ~15s build |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run` (scoped where possible)
- **After every plan wave:** Run `npm run test -- --run && npm run lint && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Filled in by gsd-planner per plan. Decision IDs (D-NN) used in place of REQ-IDs since Phase 6 has no REQ-IDs assigned (D-09 is itself the requirements-status audit).

| Task ID | Plan | Wave | Decision | Test Type | Automated Command | Status |
|---------|------|------|----------|-----------|-------------------|--------|
| TBD     | TBD  | TBD  | D-01..D-10 | TBD     | TBD               | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update `src/__tests__/components/ConsentChip.test.tsx` to invert state-machine expectations (default = analytics OFF)
- [ ] Add `src/__tests__/lib/consent.test.ts` covering the new consent state hook/module (read default, set allow, set decline, storage event propagation)
- [ ] Add `src/__tests__/components/ConsentBanner.test.tsx` (or co-located) for first-visit banner render + dismiss persistence
- [ ] No new framework install needed — vitest already configured

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Reproduce auth bug in user's main browser | D-01, D-02 | Bug only reproduces in user's main browser, not incognito; differential is client-side state | Follow plan-01 manual repro checklist (clear cookies → disable extensions → check 3P-cookie setting → second profile) |
| Confirm `?debug=auth` overlay surfaces missing PKCE `*-code-verifier` localStorage key | D-01 | Diagnose-first; root-cause hypothesis A1 from RESEARCH.md | Visit `/login?debug=auth` in failing browser, attempt OAuth, screenshot overlay state |
| PostHog dashboard shows zero events before consent flip | D-04 | Out-of-repo verification on PostHog UI | Open PostHog project, filter today's events, expect zero from new sessions until consent allowed |
| Sentry sourcemap-symbolicated stack trace | D-08 | Out-of-repo verification on Sentry UI; closes 05-VERIFICATION human_verification item | Trigger deliberate prod error, open Sentry issue, confirm un-minified function names + source-map line numbers |
| Favicon renders cleanly on light + dark browser chrome | D-07 | Visual quality check at 16/32 px | Load polls.wtcsmapban.com in Chrome (light) + Chrome (dark) + Safari + Firefox; inspect favicon at native size and at 32x32 in tab bar |
| `<title>` and meta description appear in Google SERP preview | D-10 | Real SERP rendering varies; not test-coverable | Use Google's Rich Results Test or paste-into-search check after deploy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter once planner fills the per-task map

**Approval:** pending
