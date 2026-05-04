---
phase: 09
slug: ui-closure-evidence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | filesystem + grep + lighthouse JSON probe (no test framework — closure evidence phase) |
| **Config file** | none — phase produces audit harness scripts under `.planning/closure/` |
| **Quick run command** | `ls .planning/closure/artifacts/ && grep -q "Signed off" .planning/closure/UIDN-0[23]-*.md` |
| **Full suite command** | `bash .planning/closure/audit-mobile.sh && node .planning/closure/audit-screenshots.mjs` |
| **Estimated runtime** | ~3-5 min (Lighthouse 5 routes × ~30s) + ~2 min (Playwright 6 widths × 7 routes) |

---

## Sampling Rate

- **After every task commit:** Verify the modified file exists and has expected content (grep / file-exists check).
- **After every plan wave:** Re-run the relevant audit pass for that wave (UIDN-04 docs check, UIDN-02 lighthouse, UIDN-03 checklist).
- **Before `/gsd-verify-work`:** Both audit scripts must run end-to-end, producing artifacts under `.planning/closure/artifacts/`, and PROJECT.md Key Decisions rows must show ✓ Good.
- **Max feedback latency:** ~30s per task (filesystem checks); audit runs are run-on-demand.

---

## Per-Task Verification Map

*Populated by `gsd-planner` once plans are written. Each task gets:*
- Filesystem check (file path exists with expected content)
- For audit-output tasks: artifact directory check + lighthouse JSON score parse
- For doc-flip tasks: grep for new wording (e.g., `grep -q "new-york" .planning/PROJECT.md` not `Maia`)

---

## Wave 0 Requirements

- [ ] `.planning/closure/artifacts/` directory exists (created by harness on first run)
- [ ] `e2e/helpers/auth.ts` reachable from `.planning/closure/audit-screenshots.mjs` (relative path resolves)

*Closure-evidence phase reuses Phase 8 Playwright fixtures — no new framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production reachability of all 5 audit routes | UIDN-02 | Audit target is prod (D-03); curl probe is the only practical pre-flight | `for r in / /topics /archive /auth/error /admin; do curl -sf -o /dev/null -w "%{http_code} $r\n" "https://polls.wtcsmapban.com$r"; done` — expect all 200 |
| Visual review of breakpoint matrix screenshots | UIDN-02 | Layout regressions need human eyes (mobile responsive correctness) | Open `.planning/closure/artifacts/screenshots/` and scan the 6×N grid for clipping, overflow, layout breaks |
| Visual review of dark/light parity per route | UIDN-03 (item 11) | Theme parity is a perception check | Compare paired screenshots (light vs dark) per route at 375px and 1024px |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s for filesystem/grep checks
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
