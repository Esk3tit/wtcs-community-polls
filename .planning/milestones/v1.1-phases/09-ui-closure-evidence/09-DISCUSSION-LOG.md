# Phase 9: UI Closure Evidence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 9-UI Closure Evidence
**Areas discussed:** UIDN-04 winner, Audit URL target, Audit route scope + auth gating, 12-item shadcn checklist content

---

## UIDN-04 winner (canonical shadcn style)

| Option | Description | Selected |
|--------|-------------|----------|
| new-york (update docs to match code) | Update DESIGN-SYSTEM.md + PROJECT.md Constraints to reflect 'new-york'. Zero code change. ADR explains 'shipped against new-york; docs were aspirational'. | ✓ |
| Maia (re-init shadcn, restyle components) | Treat docs as ground truth, re-init with Maia preset, manually re-port every shadcn component. Violates Phase 9 SC #5 no-restyle scope guard. | |
| Neither / hybrid (custom WTCS preset) | Document a project-specific blend, define WTCS preset as canonical going forward. Adds maintenance surface. | |

**User's choice:** new-york (update docs to match code)
**Notes:** Aligns with v1.1-MOBILE-AUDIT.md § Open questions #1 — components are already shipped, docs are the cheaper surface to flip.

### Follow-up — ADR scope

| Option | Description | Selected |
|--------|-------------|----------|
| DESIGN-SYSTEM.md only + ADR appended | Update style line in DESIGN-SYSTEM.md and append ADR. Leave PROJECT.md Constraints stale until Phase 10. | |
| DESIGN-SYSTEM.md + PROJECT.md Constraints + ADR | Single atomic reconciliation: flip both losing surfaces, append ADR. | ✓ |
| Above + CLAUDE.md design-system mention | Also update CLAUDE.md preset reference. | |

**User's choice:** DESIGN-SYSTEM.md + PROJECT.md Constraints + ADR
**Notes:** CLAUDE.md line 21 cites Maia too — left to Claude's Discretion (may be auto-derived from PROJECT.md, planner verifies).

---

## Audit URL target

| Option | Description | Selected |
|--------|-------------|----------|
| Production only | polls.wtcsmapban.com canonical artifact set. Re-runnable post-merge. No GH Actions burn. | ✓ |
| Production + deploy preview snapshot | Prod for canonical artifacts plus a one-shot preview run for the Phase 9 PR as a regression check. Doubles Lighthouse runs. | |
| Deploy preview only | Audit Phase 9 PR's preview URL. Bundle differs from prod; Phase 9 has no UI code change so prod is what we want to certify. | |
| Local `npm run preview` | Fastest iteration. Perf scores not representative of real-user network conditions. | |

**User's choice:** Production only
**Notes:** Matches research TL;DR exactly.

### Follow-up — re-runnable audit script

| Option | Description | Selected |
|--------|-------------|----------|
| Shell script in .planning/closure/ | Commit `.planning/closure/audit-mobile.sh` + `.planning/closure/audit-screenshots.mjs`. No package.json scripts. | ✓ |
| package.json npm scripts | Add `npm run audit:lighthouse` + `npm run audit:screenshots`. Pollutes scripts/ for a one-off milestone artifact. | |
| Inline commands in evidence .md only | Document the exact commands as a runbook section. Re-runs require copy-paste. | |

**User's choice:** Shell script in .planning/closure/
**Notes:** Consistent with Phase 7/8 precedent for milestone-scoped tooling.

---

## Audit route scope + auth gating

| Option | Description | Selected |
|--------|-------------|----------|
| Public UI only: /, /topics, /archive, /auth/error | 4 routes. Lightest audit. /admin/* gets only screenshot+checklist. | |
| Public + admin index: + /admin | 5 routes for full audit. /admin/* sub-routes via screenshot+checklist only. Skip /__smoke and /auth/callback. | ✓ |
| Everything with UI | 7 routes including /admin/suggestions/new + $id/edit. Requires solving auth-gated Lighthouse. | |
| Just /, /topics, /archive | 3 user-facing pages only. /auth/error and /admin/* dropped entirely. | |

**User's choice:** Public + admin index: /, /topics, /archive, /auth/error, /admin
**Notes:** /admin/suggestions/new + $id/edit have very limited audience and authenticated Lighthouse adds complexity not justified at v1.1.

### Follow-up — /admin Lighthouse mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Run as guest, capture redirect | Lighthouse hits /admin unauthenticated; captures redirect-to-login. That IS the experience for a non-admin. | ✓ |
| Inject session via --extra-headers | Stage a Discord-auth'd Supabase session token. Token leakage risk if commit hygiene slips; complex setup. | |
| Skip Lighthouse for /admin, screenshot+checklist only | Score 4 public/error routes for Perf/A11y; cover /admin only via screenshot+checklist. | |

**User's choice:** Run as guest, capture redirect
**Notes:** Authenticated screenshot capture uses the existing Phase 8 Playwright auth fixture from e2e/helpers/auth.ts.

---

## 12-item shadcn checklist content

| Option | Description | Selected |
|--------|-------------|----------|
| Researcher drafts from v1.1-MOBILE-AUDIT.md | Researcher converts the existing compliance checklist into 12 locked items, citing canonical preset (new-york). Planner reviews. | ✓ |
| Lock the 12 items now in CONTEXT.md | I propose 12 items now, user approves verbatim. | |
| User authors the 12 items | User writes the 12 items directly into the audit doc during execution. | |

**User's choice:** Researcher drafts from v1.1-MOBILE-AUDIT.md
**Notes:** Re-key against new-york canonical preset (per UIDN-04 D-01).

---

## Claude's Discretion

- Exact internals of `audit-mobile.sh` and `audit-screenshots.mjs` (loop structure, output naming, parallelism).
- ADR prose / heading structure inside DESIGN-SYSTEM.md (no prior project ADR convention).
- Whether to flip CLAUDE.md line 21 atomically with UIDN-04 in Phase 9, or defer to Phase 10 docs sweep.
- Sign-off line wording at the end of each closure evidence file.
- Wave ordering within Phase 9 (UIDN-04 → 02 → 03 is locked; commit cadence inside that is open).

## Deferred Ideas

- Lighthouse CI (LHCI) in GitHub Actions — v1.2 candidate.
- Lighthouse coverage of `/admin/suggestions/new` and `/admin/suggestions/$id/edit` — needs session injection; defer to v1.2 LHCI.
- Component restyle / preset migration — out of scope by ROADMAP SC #5.
- Deeper dark-mode (`prefers-color-scheme`) audit — v1.2 polish.
- Project-wide ADR convention skill — Phase 10 or v1.2 docs task.
