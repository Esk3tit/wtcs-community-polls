# Phase 21: Dependency Hygiene - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 21-dependency-hygiene
**Areas discussed:** #44 strategy, Merge order, Validation bar, Edge-case handling

---

## #44 strategy (failing 18-package group; CI red but stale)

| Option | Description | Selected |
|--------|-------------|----------|
| Rebase, re-run, then fix | Rebase #44 onto current main, re-run CI; green → merge keeping all 18; red → diagnose & fix root cause on-branch | ✓ |
| Split the group | Merge the green subset now, defer/exclude problematic package(s) | |
| Close & regenerate | Close #44, let dependabot open a fresh group against current main | |

**User's choice:** Rebase, re-run, then fix (keep all 18).
**Notes:** The red CI ran 2026-06-03 on commit `0ddb157`, before Phases 19/20 merged — stale. Re-run before judging.

---

## Merge order

| Option | Description | Selected |
|--------|-------------|----------|
| #34 first, then #44 | Merge the green dev-only lint-staged PR first (closes DEP-02), then tackle #44 | ✓ |
| Both together at the end | Hold #34 until #44 is also green; merge both in one sweep | |

**User's choice:** #34 first, then #44.
**Notes:** #34 is green and independent — quick win.

---

## Validation bar before merging each PR

| Option | Description | Selected |
|--------|-------------|----------|
| CI-green + local smoke | All CI green + npm build + app smoke; pre-commit hook test for #34 | ✓ |
| CI-green is enough | Trust green CI; merge on green + operator OK | |
| + changelog review on key pkgs | CI-green + local smoke + manual changelog skim for tanstack-router/supabase-js/react-dom | |

**User's choice:** CI-green + local smoke (+ pre-commit hook test for #34).
**Notes:** Balanced bar for a $0 hobby-scale prod app.

---

## Claude's Discretion

- **Edge-case handling (D-04):** User selected "You decide (recommend default)." Default applied: fix-forward; if a #44 package is genuinely unfixable on-branch, isolate + defer just that package, merge the rest, and flag the deferred package to the operator — never silently drop, never abandon the whole group. Surface any lint-staged v17 Node-version breaking change rather than auto-bumping CI Node (CI is already Node 22, which satisfies the v17 floor).
- Technical root-cause diagnosis of the #44 `lint-and-unit` failure delegated to researcher/planner/executor.

## Deferred Ideas

None — discussion stayed within phase scope.
