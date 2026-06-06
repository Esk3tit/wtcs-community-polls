---
phase: 21-dependency-hygiene
plan: 01
subsystem: infra
tags: [lint-staged, dependabot, pre-commit, husky, eslint, tsc, devtooling]

requires:
  - phase: 16-perf-budget
    provides: vite.config keepNames sourcemap guard (unrelated to this dev-only bump)
provides:
  - lint-staged 16.4.0 → 17.0.7 devDependency bump merged to main (DEP-02 closed)
  - Validated lint-staged v17 pre-commit hook compatibility (eslint + tsc -b --noEmit)
affects: [21-02, dependency-hygiene, pre-commit-tooling]

tech-stack:
  added: [lint-staged@17.0.7]
  patterns:
    - "Dependabot PR merge gate: CI green + local build/hook smoke + bot review (with documented greptile dependabot waiver) + explicit operator approval, merged via --match-head-commit SHA binding"

key-files:
  created:
    - .planning/phases/21-dependency-hygiene/21-01-SUMMARY.md
  modified:
    - package.json (lint-staged 16.4.0 → 17.0.7 — via dependabot PR #34 merge)
    - package-lock.json (lockfile updated for lint-staged v17)

key-decisions:
  - "Phase executed directly on main (no phase branch) — deliverable is a GitHub PR merge to main; doc/tracking commits live on main per project convention (operator decision)"
  - "greptile bot review waived for dependabot PRs — greptile.json excludeAuthors:[dependabot[bot]] makes greptile categorically skip dependabot PRs by design; documented intentional waiver (operator decision)"
  - "CodeRabbit and gemini-code-assist do not auto-review bot-authored PRs; both manually triggered via review-request comments and reviewed head 7f8ed06 before merge"
  - "Merge bound to validated SHA 7f8ed06 via --match-head-commit so no unvalidated commit could slip in between validation and merge"

patterns-established:
  - "SHA-pinned dependabot merge: capture VALIDATED_SHA, validate against it, merge with --match-head-commit <SHA>"
  - "lint-staged version validation: stage a real .tsx no-op edit and run `npx lint-staged --verbose` to prove both eslint and tsc tasks execute under the new major version"

requirements-completed: [DEP-02]

duration: ~15min
completed: 2026-06-06
---

# Phase 21 (Plan 01): Validate & Merge PR #34 — lint-staged v17

**lint-staged 16.4.0 → 17.0.7 devDependency bump validated (CI + local build + v17 pre-commit hook test) and merged to main, closing DEP-02**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-06T06:53Z
- **Completed:** 2026-06-06T06:56:32Z (PR #34 mergedAt)
- **Tasks:** 2 (1 auto-validation + 1 human-verify merge checkpoint)
- **Files modified:** 2 (package.json, package-lock.json — via dependabot PR merge)

## Accomplishments
- Confirmed PR #34 CI green on all three jobs (lint-and-unit, test-integration, e2e) at head `7f8ed06`
- Validated lint-staged v17 locally: `npm ci` (installed 17.0.7), `npm run build` exit 0, Vite dev server smoke clean
- Proved v17 pre-commit hook works: `npx lint-staged --verbose` on a staged `.tsx` edit ran **both** `eslint --max-warnings 0 --no-warn-ignored` and `bash -c 'tsc -b --noEmit'` to completion
- Triggered CodeRabbit + gemini reviews on the dependabot PR (they skip bot PRs by default); both reviewed `7f8ed06`
- Merged PR #34 bound to the validated SHA via `--match-head-commit`; DEP-02 closed; only PR #44 remains open

## Task Commits

This plan's "code" change landed via GitHub PR merge, not local task commits:

1. **Task 1: Validate CI + lint-staged v17 hook locally** — no local commit (validation only; test edit reverted)
2. **Task 2: Operator approval + merge PR #34** — merge commit `ff53d72` (`Merge pull request #34 … lint-staged-17.0.5`), reconciled into local main via `13efbc3`

**Plan metadata:** this SUMMARY commit (docs: complete plan 21-01)

## Files Created/Modified
- `package.json` — `lint-staged` 16.4.0 → 17.0.7 (devDependency)
- `package-lock.json` — lockfile regenerated for lint-staged v17 + transitive deps

## Decisions Made
- **Execute on main, no phase branch** — the deliverable is a GitHub merge to main; a feature branch conflicts with the plan's `git checkout main && git pull` flow. Operator confirmed.
- **greptile waived for dependabot** — `greptile.json` has `excludeAuthors:["dependabot[bot]"]`, so greptile will never review dependabot PRs. Operator accepted this as a documented intentional waiver; CI + CodeRabbit + gemini + operator review cover the gate.
- **Manually triggered CodeRabbit + gemini** — both auto-skip bot-authored PRs; review-request comments brought both in to review head `7f8ed06`.

## Deviations from Plan
None in execution mechanics. One planned-for contingency materialized: the bot-review gate could not be met as literally written (all 3 bots) because greptile structurally excludes dependabot. Resolved via operator decision (documented waiver) — consistent with the project merge-gate rule (all *configured/applicable* bots reviewed + explicit operator OK).

## Issues Encountered
- `git pull origin main` initially failed with "Need to specify how to reconcile divergent branches" — local main carried unpushed planning-doc commits while origin gained the #34 merge commit. Resolved with `git pull --no-rebase` (merge), preserving local planning history.

## User Setup Required
None — dev-only devDependency, no external service configuration.

## Next Phase Readiness
- DEP-02 closed; D-02 sequencing satisfied (PR #34 merged before PR #44).
- Wave 2 / Plan 21-02 (PR #44, 18-package group) is now unblocked. Note: the same bot-review handling (trigger CodeRabbit+gemini, waive greptile) applies, plus the `@dependabot rebase` step since #44's head is the stale `0ddb157`.

---
*Phase: 21-dependency-hygiene*
*Completed: 2026-06-06*
