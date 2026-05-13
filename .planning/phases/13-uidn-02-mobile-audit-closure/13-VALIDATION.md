---
phase: 13
slug: uidn-02-mobile-audit-closure
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-13
updated: 2026-05-13
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
| 13-01-01 | 13-01 | 1 | UIDN-02 SC1 | — | Harness exits 0; "All DOM assertions matched."; "sha256 uniqueness check passed (42 PNGs, 0 collisions)"; sentinel replacement confirmed via grep | Functional (CLI) | `node --check .planning/closure/audit-screenshots.mjs && grep -c 'Toggle color theme' .planning/closure/audit-screenshots.mjs` → 3 | ✅ | ⬜ pending |
| 13-01-02 | 13-01 | 1 | UIDN-02 SC2 | — | Operator pre-flight + harness execution: 42 PNGs in `.planning/closure/artifacts/`; sha256 uniqueness passed; member-fixture session UI in `bp-{w}-topics.png` + `bp-{w}-archive.png` (authenticated, no login redirect) | Behavioral (CLI + PNG inspection) | `ls .planning/closure/artifacts/screenshots/*.png \| wc -l` → 42 | ✅ | ⬜ pending (checkpoint) |
| 13-02-01 | 13-02 | 2 | UIDN-02 SC3 | — | Lighthouse audit completes for all 5 routes; reports archived; exit code 0 (pass) or 1 (miss per D-11 strict floor — both are valid outcomes) | Functional (CLI) | `bash .planning/closure/audit-mobile.sh && ls .planning/closure/artifacts/lighthouse/ \| wc -l` → 10 | ✅ | ⬜ pending |
| 13-02-02 | 13-02 | 2 | UIDN-02 SC3 + SC4 | — | Evidence file `## v1.2 Rerun (2026-05-XX)` section present with actual scores; PROJECT.md row updated per D-17; REQUIREMENTS.md UIDN-02 row + Traceability row reflect outcome; all three docs agree | Cross-doc consistency (CLI) | `grep 'v1.2 Rerun' .planning/closure/UIDN-02-mobile-evidence.md && grep 'Mobile-first' .planning/PROJECT.md && grep 'UIDN-02' .planning/REQUIREMENTS.md` | ✅ | ⬜ pending |
| 13-02-03 | 13-02 | 2 | UIDN-02 SC4 | — | Human verifies cross-doc consistency and authorizes atomic commit | Manual (checkpoint) | — | ✅ | ⬜ pending (checkpoint) |
| 13-02-04 | 13-02 | 2 | UIDN-02 SC1-SC4 | — | Atomic commit covers all 5 changed planning files; zero src/ edits; MANIFEST.json updated | Functional (git) | `git show --name-only HEAD \| grep "src/"` → empty; `git show --name-only HEAD \| grep ".planning"` → 5 files | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs follow 13-NN-MM convention: plan number + sequential task number within the plan.*

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
| Authenticated UI captured (no login redirect, member-fixture session visible) | UIDN-02 SC2 | PNG content is binary; visual recognition that the screenshot shows the post-login `/topics` view, not the unauth redirect to `/` | Open `.planning/closure/artifacts/screenshots/bp-375-topics.png` (or any bp-XXX-topics.png); confirm Navbar shows theme-toggle button visible, suggestion cards rendered (not loading shell), no "Sign in with Discord" CTA as primary content |
| Pass/miss disposition in evidence file Sign-off | UIDN-02 SC4 | Italics-form `*Disposition: ...*` paragraph reflects human judgment on follow-up trigger wording | Read final paragraph of `## v1.2 Rerun` section; confirm wording matches Phase 9 italics convention + D-12 follow-up trigger ("next perf-budget change") |
| Lighthouse score variance interpretation | UIDN-02 SC4 | If any route scores 88–89 (Pitfall 1 ±5–10pp band), human decides per D-11 strict floor | Inspect each route's Performance score; per D-11 the strict-90 floor applies (no D-14 analog this phase) — sub-90 routes flip outcome to miss regardless of variance band |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicitly classified as manual above
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (13-01-01 auto → 13-01-02 checkpoint → 13-02-01 auto → 13-02-02 auto → 13-02-03 checkpoint → 13-02-04 auto)
- [x] Wave 0 covers all MISSING references (none — existing infra covers)
- [x] No watch-mode flags
- [x] Feedback latency < 300s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
