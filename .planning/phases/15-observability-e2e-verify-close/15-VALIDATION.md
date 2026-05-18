---
phase: 15
slug: observability-e2e-verify-close
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit) + Playwright 1.59.x (E2E) |
| **Config file** | `vitest.config.ts` + `playwright.config.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npm run test:e2e -- --grep @smoke` |
| **Estimated runtime** | ~120 seconds (unit) + ~180 seconds (E2E targeted) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test` (unit, fast)
- **After every plan wave:** Run targeted Playwright spec (`npx playwright test e2e/tests/<spec>.spec.ts`)
- **Before `/gsd:verify-work`:** Full suite must be green; smoke event captured in Sentry dashboard
- **Max feedback latency:** ~120 seconds (unit); E2E run is per-wave only

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | OBSV-03 / OBSV-04 / OBSV-05 / TEST-14 / TEST-15 / TEST-16 | — | See RESEARCH.md ## Validation Architecture | E2E + smoke + script | Filled in by gsd-planner | ⬜ TBD | ⬜ pending |

> Planner will populate this table per emitted PLAN.md. Each task's `<acceptance_criteria>` block must include the automated command that satisfies the row.

---

## Wave 0 Requirements

- [ ] No new test infrastructure needed — Vitest + Playwright already installed on `main`
- [ ] No new fixtures needed — `freshPoll`, `E2E_TITLE`, and `?debug=sentry-test` overlay landed in prior phases per RESEARCH.md

*Existing infrastructure covers all phase requirements; verify by running `npm run test:e2e -- --list` before any wave starts.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sentry dashboard event capture | OBSV-03 | Requires live Sentry dashboard inspection on Netlify deploy preview release | Trigger `?debug=sentry-test&fire=render` on deploy-preview URL; open Sentry → Issues → filter by release SHA; confirm event with `boundary: app-root` tag |
| Real function names in stack frames | OBSV-04 | Visual confirmation of un-minified identifiers in Sentry stack viewer | Same event as above; expand stack frames; assert presence of `ConsentProvider`/`AuthGate` (not `$M` minified) |
| DedupeIntegration single-event collapse | OBSV-05 | Requires two-trigger smoke with distinct messages, then visual count in Sentry | Fire `?fire=render` then `?fire=dedupe` with distinct error messages; confirm Sentry shows TWO distinct events (one per scenario), not one or three |
| GitHub issue closure | OBSV-03/04/05, TEST-14/15/16 | Issue state lives on github.com, requires `gh issue close` invocation with evidence comment | After all criteria pass: `gh issue close 11 12 13 17 19 --comment "<evidence link to phase artifact>"` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are explicitly flagged Manual-Only above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (planner enforces in PLAN.md)
- [ ] Wave 0 covers all MISSING references (none expected — verify by inspection)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s for unit; E2E gated per wave
- [ ] `nyquist_compliant: true` set in frontmatter (set by gsd-planner after PLAN.md tasks are scored against this table)

**Approval:** pending
