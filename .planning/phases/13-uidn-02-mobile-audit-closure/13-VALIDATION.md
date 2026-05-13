---
phase: 13
slug: uidn-02-mobile-audit-closure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Closure harnesses ARE the validation framework: `audit-screenshots.mjs` (Playwright 1.59.1, exits 0/1) + `audit-mobile.sh` (Lighthouse 13.2.0, exits 0/1). No vitest/jest changes — phase has zero `src/` edits. |
| **Config file** | None — harness is invoked directly from `.planning/closure/` |
| **Quick run command** | `node .planning/closure/audit-screenshots.mjs` |
| **Full suite command** | `node .planning/closure/audit-screenshots.mjs && bash .planning/closure/audit-mobile.sh` |
| **Estimated runtime** | ~2–4 min for screenshot harness (42 PNGs × 2 passes); ~3–5 min for Lighthouse (5 routes × single run) |

---

## Sampling Rate

- **After every task commit:** Run `node .planning/closure/audit-screenshots.mjs` (verifies harness still exits 0 after each edit)
- **After every plan wave:** Run full suite (`audit-screenshots.mjs && audit-mobile.sh`)
- **Before `/gsd-verify-work`:** Full suite must be green AND evidence file appended AND PROJECT.md/REQUIREMENTS.md rows reflect outcome
- **Max feedback latency:** ~240 seconds (screenshot harness; Lighthouse is gated to end-of-phase per Pitfall 1 single-run policy)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-01 | TBD | 1 | UIDN-02 SC1 | — | Harness exits 0; "All DOM assertions matched."; "sha256 uniqueness check passed (42 PNGs, 0 collisions)" | Functional (CLI) | `node .planning/closure/audit-screenshots.mjs` | ✅ | ⬜ pending |
| TBD-02 | TBD | 1 | UIDN-02 SC2 | — | 42 PNGs in `.planning/closure/artifacts/`; member-fixture session UI in `bp-{w}-topics.png` + `bp-{w}-archive.png` (no Admin link in Navbar) | Behavioral (PNG inspection + count) | `ls .planning/closure/artifacts/*.png \| wc -l` → 42 | ✅ | ⬜ pending |
| TBD-03 | TBD | 2 | UIDN-02 SC3 | — | 5 Lighthouse JSON reports archived; numeric Performance score for each of `/`, `/topics`, `/archive`, `/auth/error`, `/admin` | Functional (CLI) | `bash .planning/closure/audit-mobile.sh` | ✅ | ⬜ pending |
| TBD-04 | TBD | 2 | UIDN-02 SC4 | — | Evidence file `## v1.2 Rerun (2026-05-XX)` section present with scores; PROJECT.md row + REQUIREMENTS.md row mirror outcome | Cross-doc consistency | `grep "v1.2 Rerun" .planning/closure/UIDN-02-mobile-evidence.md && grep "Mobile-first" .planning/PROJECT.md && grep "UIDN-02" .planning/REQUIREMENTS.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders — planner assigns final 13-NN-MM IDs in PLAN.md.*

---

## Wave 0 Requirements

Existing infrastructure covers all phase validations. No new test files, fixtures, or framework installs needed:
- Playwright + Supabase test client already wired into `audit-screenshots.mjs` Pass-B (lines 100-179)
- `e2e/fixtures/test-users.ts` already exports `adminUser` and `memberUser` constants
- `audit-mobile.sh` already shells out to Lighthouse CLI with the locked flag set

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Authenticated UI captured (no login redirect, member-fixture session visible) | UIDN-02 SC2 | PNG content is binary; visual recognition that the screenshot shows the post-login `/topics` view, not the unauth redirect to `/` | Open `.planning/closure/artifacts/bp-390-topics.png` (smallest viewport); confirm Navbar shows member username + signout, no Admin link, suggestion cards visible (not loading shells) |
| Pass/miss disposition in evidence file Sign-off | UIDN-02 SC4 | Italics-form `*Disposition: ...*` paragraph reflects human judgment on follow-up trigger wording | Read final paragraph of `## v1.2 Rerun` section; confirm wording matches Phase 9 italics convention + D-12 follow-up trigger ("next perf-budget change") |
| Lighthouse score variance interpretation | UIDN-02 SC4 | If any route scores 88–89 (Pitfall 1 ±5–10pp band), human decides whether D-11 strict floor or a documented variance note applies | Inspect each route's Performance score; per D-11 the strict-90 floor applies (no D-14 analog this phase) — sub-90 routes flip outcome to miss |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are explicitly classified as manual above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none — existing infra covers)
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner finalizes Task IDs)

**Approval:** pending
