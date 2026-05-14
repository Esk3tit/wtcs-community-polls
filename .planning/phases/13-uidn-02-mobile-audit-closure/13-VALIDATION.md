---
phase: 13
slug: uidn-02-mobile-audit-closure
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-13
updated: 2026-05-13
audited: 2026-05-13
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
| 13-01-01 | 13-01 | 1 | UIDN-02 SC1 | — | Harness exits 0; "All DOM assertions matched."; "sha256 uniqueness check passed (42 PNGs, 0 collisions)"; sentinel replacement confirmed via grep | Functional (CLI) | `node --check .planning/closure/audit-screenshots.mjs && test "$(grep -c 'Toggle color theme' .planning/closure/audit-screenshots.mjs)" -eq 3` | ✅ | ✅ green |
| 13-01-02 | 13-01 | 1 | UIDN-02 SC2 | — | Operator pre-flight + harness execution: 42 PNGs in `.planning/closure/artifacts/`; sha256 uniqueness passed; member-fixture session UI in `bp-{w}-topics.png` + `bp-{w}-archive.png` (authenticated, no login redirect) | Behavioral (CLI + PNG inspection) | `test "$(ls .planning/closure/artifacts/screenshots/*.png 2>/dev/null \| wc -l)" -eq 42` | ✅ | ✅ green (checkpoint cleared) |
| 13-02-01 | 13-02 | 2 | UIDN-02 SC3 | — | Lighthouse audit completes for all 5 routes; reports archived (10 = 5 × `.report.json` + `.report.html`) + 1 D-27 canonical stdout log = 11 total; exit code 0 (pass) or 1 (miss per D-11 strict floor — both are valid outcomes) | Functional (CLI) | `bash .planning/closure/audit-mobile.sh; audit_status=$?; test "$audit_status" -eq 0 -o "$audit_status" -eq 1; test "$(ls .planning/closure/artifacts/lighthouse/ 2>/dev/null \| wc -l)" -eq 11` | ✅ | ✅ green |
| 13-02-02 | 13-02 | 2 | UIDN-02 SC3 + SC4 | — | Evidence file `## v1.2 Rerun (2026-05-XX)` section present with actual scores; PROJECT.md row updated per D-17; REQUIREMENTS.md UIDN-02 row + Traceability row reflect outcome; all three docs agree | Cross-doc consistency (CLI) | `test "$(grep -c 'v1.2 Rerun' .planning/closure/UIDN-02-mobile-evidence.md)" -ge 1 && test "$(grep -c 'Mobile-first' .planning/PROJECT.md)" -ge 1 && test "$(grep -c 'UIDN-02' .planning/REQUIREMENTS.md)" -ge 1` | ✅ | ✅ green |
| 13-02-03 | 13-02 | 2 | UIDN-02 SC4 | — | Human verifies cross-doc consistency and authorizes atomic commit | Manual (checkpoint) | — | ✅ | ✅ green (checkpoint cleared) |
| 13-02-04 | 13-02 | 2 | UIDN-02 SC1-SC4 | — | Wave-split execution (per Plan 13-02 Task 4 deviation): Wave 1 `97d1440` ships harness fix (1 .planning file); Wave 2 closure `0ab6973` ships 4 .planning files (PROJECT.md + REQUIREMENTS.md + UIDN-02-mobile-evidence.md + MANIFEST.json). Combined: 5 .planning files across both waves; zero src/ edits | Functional (git) | `test "$(git show --name-only --pretty= 0ab6973 \| grep -c '^src/')" -eq 0 && test "$(git show --name-only --pretty= 0ab6973 \| grep -c '^.planning/')" -eq 4 && test "$(git show --name-only --pretty= 97d1440 \| grep -c '^.planning/')" -eq 1` | ✅ | ✅ green |

*Status: ✅ green = passed (all 6/6 tasks); ❌ red and ⚠️ flaky symbols reserved for any future re-run that fails*
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

**Approval:** verified 2026-05-13

---

## Validation Audit 2026-05-13

| Metric | Count |
|--------|-------|
| Tasks total | 6 |
| Green | 6 |
| Pending | 0 |
| Red | 0 |
| Flaky | 0 |
| Gaps found | 0 |
| Resolved | 0 (no gaps) |
| Escalated | 0 |

**Result:** Phase 13 is Nyquist-compliant. All 6 task-level verifications + 3 manual-only items have evidence in the execution artifacts (summaries, commits, UAT).

### Per-task evidence

| Task | Evidence | Commit |
|------|----------|--------|
| 13-01-01 | `node --check` ok; `grep 'Toggle color theme'` → 3; 12/12 plan verify checks pass per 13-01-SUMMARY.md | `97d1440` (harness fix) |
| 13-01-02 | Operator harness execution: 42 PNGs captured; `harness-ok: 0 warnings`; sha256 uniqueness passed (6 whitelisted home↔admin pairs, 0 unexpected); spot-checked bp-375-topics.png shows authenticated voter UI | `9da7988` (finalize SUMMARY + MANIFEST) |
| 13-02-01 | 5 `.report.json` + 5 `.report.html` files in artifacts/lighthouse/; canonical `audit-mobile.stdout.log` final line `exit=1`; jq cross-extraction confirms scores (home=85, topics=86, archive=88, auth-error=85, admin=94) — D-13 single-run honored | `0ab6973` (closure atomic commit — MANIFEST updated by audit-mobile.sh during Task 1) |
| 13-02-02 | All three docs updated: evidence `## v1.2 Rerun` § appended; PROJECT.md Mobile-first row reads `⚠️ Revisit (v1.2 rerun — 4/5 routes under threshold …)`; REQUIREMENTS.md UIDN-02 row + Phase Traceability flipped per D-14/D-20 | `0ab6973` |
| 13-02-03 | Operator approved cross-doc review with `approve` resume signal (UAT Test 3 also confirms cross-doc consistency: pass) | n/a (checkpoint — no commit) |
| 13-02-04 | `git show 0ab6973` covers 4 .planning files; harness fix landed separately at `97d1440` in Wave 1 (cherry-pick deviation documented in 13-02-SUMMARY); zero src/ edits across both commits; MANIFEST.json staged | `0ab6973` + `97d1440` (wave-split deviation per 13-02-SUMMARY § Deviations) |

### Manual-Only items (all confirmed)

| Item | Evidence |
|------|----------|
| Authenticated UI captured | UAT Test 1: `pass` — bp-375-topics.png inspected; Active Topics + member Discord avatar + topic cards visible; NOT landing page |
| Pass/miss disposition in evidence file Sign-off | `_Disposition: DEFER — row stays ⚠️ Revisit; follow-up tied to next perf-budget change_` recorded per D-12 wording |
| Lighthouse score variance interpretation | D-11 strict floor applied: 4 routes Perf 85–88 → DEFER (no D-14 ship-anyway analog this phase); no route at exactly 89 → D-26 footnote not required |

### Cross-references

- 13-UAT.md — 3/3 pass (the 3 tests directly correspond to the 3 Manual-Only items above)
- 13-VERIFICATION.md — `passed` (25/25 codebase truths verified; 3 human_needed items resolved via UAT)
- 13-SECURITY.md — `verified`, 3/3 threats closed, 0 open
- 13-01-SUMMARY.md / 13-02-SUMMARY.md — execution artifacts with per-task evidence
