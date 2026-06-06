---
phase: 21-dependency-hygiene
plan: 02
subsystem: infra
tags: [dependabot, vite, rolldown, keepNames, sourcemap, tanstack-router, supabase-js, react, sentry, posthog]

requires:
  - phase: 16-perf-budget
    provides: vite.config keepNames + scripts/verify-sourcemap-names.mjs guard (the Sentry-sourcemap contract this plan had to protect)
  - phase: 21-dependency-hygiene
    provides: PR #34 merged first (DEP-02 / D-02 sequencing) before this plan ran
provides:
  - 17-of-19 minor+patch dependency group merged to main via PR #47 (DEP-01 substantially closed)
  - vite 8.0.16 / @vitejs/plugin-react 6.0.2 isolated and deferred (Linux keepNames regression)
  - zero open dependabot PRs in the v1 carry-forward set
affects: [dependency-hygiene, build-toolchain, future-vite-bump]

tech-stack:
  added:
    - "@tanstack/react-router 1.170.13, @supabase/supabase-js 2.107.0, react/react-dom 19.2.7, @types/react 19.2.17, radix-ui 1.5.0, posthog-js 1.381.0, lucide-react 1.17.0, @sentry/react 10.56.0, supabase 2.105.0, eslint 10.4.1, typescript-eslint 8.60.1, vitest 4.1.8, + tanstack router tooling"
  patterns:
    - "D-04 isolate-and-flag: when one package in a dependabot group fails CI, bisect via a platform-matched Docker container, revert only the culprit on the PR branch, merge the rest, flag the deferred package"

key-files:
  created:
    - .planning/phases/21-dependency-hygiene/21-02-SUMMARY.md
  modified:
    - package.json (17-package minor+patch bump; vite/plugin-react held at main versions — via PR #47 merge)
    - package-lock.json (lockfile updated for the 17-package group + vite isolation)

key-decisions:
  - "Plan retargeted from PR #44 to PR #47 — dependabot closed #44 ('updatable in another way') and regenerated the group as #47 (19 pkgs, fresh off post-#34 main). DEP-01's 'equivalent up-to-date bump' clause covers the supersession."
  - "vite 8.0.16 isolated and DEFERRED (D-04). Its bundled rolldown mangles 5 React component function names under keepNames on Linux x86_64 only (passes on macOS arm64), failing scripts/verify-sourcemap-names.mjs in CI. Root cause proven by linux/amd64 Docker bisect; reverting vite to 8.0.12 restored 7/7 names and made CI green. The other 17 packages were merged."
  - "Did NOT weaken the verify-sourcemap-names guard or keepNames config to force the full bump — the guard protects a shipped Phase-16 Sentry-sourcemap deliverable."
  - "Bot gate handled as in Plan 01: CodeRabbit + gemini triggered on the post-fix head 3ee4a89; greptile waived (dependabot exclusion). One gemini HIGH comment (align TanStack Router versions to 1.170.13) declined as non-actionable — that version is unpublished for devtools/cli/plugin and CI green proves no breakage."
  - "Merge bound to the isolated head SHA 3ee4a89 (operator merged via GitHub UI after explicit review/approval)."

patterns-established:
  - "Platform-matched Docker bisect for CI-only build failures: when local (macOS) passes but CI (Linux) fails, reproduce in a linux/amd64 container matching CI's Node version, then bisect the offending package"
  - "SHA-bound dependabot merge gate carried through a force-push: re-validate CI + bot reviews against the new head after any branch modification"

requirements-completed: [DEP-01]

duration: ~95min
completed: 2026-06-06
---

# Phase 21 (Plan 02): Rebase/Supersede & Merge the minor+patch group — DEP-01

**17-of-19 minor+patch dependency group merged to main via PR #47, with vite 8.0.16 isolated and deferred after a Docker bisect proved it regresses keepNames sourcemap names on Linux — zero open dependabot PRs remain**

## Performance

- **Duration:** ~95 min (incl. dependabot supersession wait, Linux Docker bisect, isolation force-push, CI re-validation)
- **Started:** 2026-06-06T06:58Z
- **Completed:** 2026-06-06T15:31:55Z (PR #47 mergedAt)
- **Tasks:** 3 (2 auto + 1 human-verify merge checkpoint)
- **Files modified:** 2 (package.json, package-lock.json — via PR #47 merge)

## Accomplishments
- Closed DEP-01: 17 of the 19 minor+patch packages bumped to latest on main (react-router 1.170.13, supabase-js 2.107.0, react/react-dom 19.2.7, @types/react 19.2.17, radix-ui 1.5.0, posthog-js 1.381.0, lucide-react 1.17.0, @sentry/react 10.56.0, supabase 2.105.0, eslint 10.4.1, typescript-eslint 8.60.1, vitest 4.1.8, + router tooling)
- Diagnosed and isolated a real, CI-only build break: vite 8.0.16's rolldown mangles 5 React component names under keepNames on Linux x86_64 (reproduced + bisected in a linux/amd64 node:22.22.3 Docker container)
- Reverted only vite (8.0.16→8.0.12) + @vitejs/plugin-react (6.0.2→6.0.1) on the PR branch; CI went fully green (lint-and-unit, test-integration, e2e) on the isolated head 3ee4a89
- Resolved the gemini TanStack-version-alignment comment as non-actionable (suggested versions unpublished; CI green)
- Zero open dependabot PRs remain in the v1 carry-forward set

## Task Commits

Dependency changes landed via GitHub PR merge; the only executor-authored commit was the vite isolation on the PR branch:

1. **Task 1: Trigger rebase + wait for CI** — dependabot superseded #44 with #47; no local commit
2. **Task 2: Local validation + vite isolation** — `3ee4a89` on the PR branch (`chore(deps): isolate vite from minor-patch group — keep at 8.0.12`)
3. **Task 3: Operator approval + merge PR #47** — merge commit `ad61ec7` (`Merge pull request #47`), reconciled into local main

**Plan metadata:** this SUMMARY commit (docs: complete plan 21-02)

## Files Created/Modified
- `package.json` — 17-package minor+patch bump; vite 8.0.12 / @vitejs/plugin-react 6.0.1 held at main versions
- `package-lock.json` — lockfile regenerated for the 17-package group + vite isolation

## Decisions Made
- **Retarget #44 → #47**: dependabot closed #44 and regenerated the group as #47 off current main. Treated #47 as the DEP-01 deliverable per the "equivalent up-to-date bump" clause.
- **Isolate-and-flag vite (D-04)**: vite 8.0.16 was the sole CI-failure cause (Linux keepNames/rolldown regression, proven by Docker bisect). Reverted it; merged the other 17.
- **Protect the sourcemap guard**: declined to weaken `verify-sourcemap-names`/keepNames to ship the vite bump.

## Deviations from Plan
The plan assumed #44 would go green after `@dependabot rebase`. Instead:
1. Dependabot **closed #44** and opened **#47** (supersession) — handled via the DEP-01 equivalent-bump clause.
2. #47 had a **real CI failure** (not the stale-base artifact the plan anticipated): vite 8.0.16 → keepNames regression on Linux. Diagnosed via a linux/amd64 Docker bisect (local macOS could not reproduce), then resolved via the plan's D-04 isolate-and-flag path. This is the documented fix-forward contingency, executed with operator approval at each outward-facing step.

## Issues Encountered
- **CI-only failure, local-pass**: PR #47's `verify-sourcemap-names` failed in CI but passed on macOS (Node 22 and 24). Root cause was OS/arch: vite 8.0.16's rolldown native binary mangles names on Linux x86_64. Resolved by reproducing in Docker and isolating vite.
- **dependabot branch supersession**: required retargeting from #44 to #47 mid-plan.

## User Setup Required
None — dependency bumps only.

## 🚩 Deferred / Follow-up
- **vite 8.0.16 + @vitejs/plugin-react 6.0.2 deferred.** Held at 8.0.12 / 6.0.1. Will return as a future dependabot PR; merge it only once the rolldown keepNames regression on Linux is fixed upstream (or after confirming the 5 names survive in a linux/amd64 build). Re-validate with `node scripts/verify-sourcemap-names.mjs` in a Linux container before merging.

## Next Phase Readiness
- DEP-01 and DEP-02 both closed; zero open dependabot PRs. Phase 21 goal achieved (with the documented vite deferral).
- v1.4 final-closeout dependency hygiene is complete modulo the flagged vite bump.

---
*Phase: 21-dependency-hygiene*
*Completed: 2026-06-06*
