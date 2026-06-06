---
phase: 21-dependency-hygiene
verified: 2026-06-06T08:40:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
deferred:
  - truth: "vite 8.0.16 and @vitejs/plugin-react 6.0.2 merged as part of the minor+patch group"
    addressed_in: "Future dependabot PR (post Phase 21)"
    evidence: "D-04 isolate-and-flag path executed with operator approval: vite 8.0.16 regresses keepNames on Linux x86_64 (Docker bisect confirmed). Held at 8.0.12/6.0.1; all other 17 packages merged. DEP-01 equivalent-bump clause satisfied — 17-of-19 group merged; remaining 2 tracked as flagged follow-up."
---

# Phase 21: Dependency Hygiene Verification Report

**Phase Goal:** Review, validate, and merge dependabot PRs (minor-and-patch group + lint-staged 16→17).
**Verified:** 2026-06-06T08:40:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | PR #34 (lint-staged 16→17, DEP-02) is merged to main | ✓ VERIFIED | `gh pr view 34 --json mergedAt` → `"2026-06-06T06:56:32Z"`, state MERGED |
| 2   | DEP-01 minor+patch group is merged to main via an equivalent up-to-date bump (PR #47 supersedes #44/#40) | ✓ VERIFIED | `gh pr view 47 --json mergedAt` → `"2026-06-06T15:31:55Z"`, state MERGED; REQUIREMENTS.md DEP-01 explicitly permits "superseded by an equivalent up-to-date bump" |
| 3   | No open dependabot PRs remain for the v1 carry-forward list | ✓ VERIFIED | `gh pr list --author app/dependabot --state open` returns empty |
| 4   | Post-merge build pipeline is green: npm run build exits 0 and node scripts/verify-sourcemap-names.mjs reports 7/7 names OK | ✓ VERIFIED | `node scripts/verify-sourcemap-names.mjs` → "OK: 39 chunk(s) scanned, 7/7 allowlisted names found — keepNames contract holds." dist/ is populated. 403 unit tests pass. |
| 5   | package.json reflects the correct post-merge versions on main: lint-staged 17.0.7, @tanstack/react-router 1.170.13, @supabase/supabase-js 2.107.0, react/react-dom 19.2.7, vite 8.0.12 (held), @vitejs/plugin-react 6.0.1 (held) | ✓ VERIFIED | Live grep of package.json confirms each version exactly; node_modules/lint-staged/package.json confirms `"version": "17.0.7"` is installed |

**Score:** 5/5 truths verified

### Deferred Items

Items not yet met but explicitly tracked as follow-up.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | vite 8.0.16 + @vitejs/plugin-react 6.0.2 | Future dependabot PR | D-04 isolate-and-flag: Linux x86_64 Docker bisect proved vite 8.0.16 rolldown mangles 5 React component names under keepNames. Reverted to 8.0.12/6.0.1 on the PR branch before merge. Operator approved the isolation. Will return as a new dependabot PR; merge gate: `node scripts/verify-sourcemap-names.mjs` in a linux/amd64 container. Not a blocking gap — DEP-01 "equivalent-bump" clause applies to the 17 merged packages. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `package.json` | lint-staged 17.0.7; 17-package minor+patch group bumped; vite held at 8.0.12 | ✓ VERIFIED | Confirmed by live grep: `"lint-staged": "17.0.7"`, `"vite": "8.0.12"`, `"@tanstack/react-router": "1.170.13"`, `"@supabase/supabase-js": "2.107.0"`, `"react": "19.2.7"` |
| `package-lock.json` | Lockfile updated for lint-staged v17 and 17-package group | ✓ VERIFIED | Both merge commits (ff53d72 for PR #34, ad61ec7 for PR #47) modified package-lock.json (144 and 3220 line changes respectively) |
| `.husky/pre-commit` | npx lint-staged invocation present | ✓ VERIFIED | Content: `#!/usr/bin/env sh` / `npx lint-staged` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `package.json` lint-staged config `*.{ts,tsx}` | `.husky/pre-commit` | `npx lint-staged` | ✓ WIRED | `.husky/pre-commit` calls `npx lint-staged`; package.json lint-staged block maps `*.{ts,tsx}` to `eslint --max-warnings 0 --no-warn-ignored` and `bash -c 'tsc -b --noEmit'` |
| PR #34 merge (DEP-02) | main HEAD | merge commit ff53d72 | ✓ WIRED | `git log --oneline` shows ff53d72 on main: "Merge pull request #34 from Esk3tit/dependabot/npm_and_yarn/lint-staged-17.0.5" |
| PR #47 merge (DEP-01 equivalent bump) | main HEAD | merge commit ad61ec7 | ✓ WIRED | `git log --oneline` shows ad61ec7 on main: "Merge pull request #47 from Esk3tit/dependabot/npm_and_yarn/minor-and-patch-8d5579f732" |

### Data-Flow Trace (Level 4)

Not applicable — this phase delivers no components or data-rendering artifacts. All deliverables are package.json/lockfile changes and GitHub PR merges.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Sourcemap keepNames contract intact post-merge | `node scripts/verify-sourcemap-names.mjs` | "OK: 39 chunk(s) scanned, 7/7 allowlisted names found" | ✓ PASS |
| Unit test suite passes post-merge | `npm test -- --run` | 43 test files, 403 tests passed | ✓ PASS |
| Pre-commit hook wiring intact | `.husky/pre-commit` contains `npx lint-staged`; package.json lint-staged block present | Both confirmed by file read | ✓ PASS |

### Probe Execution

No probe scripts exist for this phase. Phase 21 is a GitHub PR merge phase — the verification criteria are GitHub API state + local file state, not script probes.

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No probes defined | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DEP-01 | 21-02-PLAN.md | Minor+patch group (PR #40/#44 / superseded by #47) reviewed, CI-green, merged; no regressions | ✓ SATISFIED | PR #47 merged 2026-06-06T15:31:55Z; 17/19 packages bumped (vite isolated per D-04); `npm test` 403 PASS; `verify-sourcemap-names.mjs` 7/7 OK. DEP-01 "equivalent up-to-date bump" clause satisfied. |
| DEP-02 | 21-01-PLAN.md | PR #34 (lint-staged 16→17) reviewed, config validated, CI-green, merged | ✓ SATISFIED | PR #34 merged 2026-06-06T06:56:32Z; lint-staged 17.0.7 installed (confirmed via node_modules); pre-commit hook intact; 21-01-SUMMARY documents local hook test (npx lint-staged --verbose proved both eslint + tsc tasks ran under v17). |

Both requirements mapped in REQUIREMENTS.md traceability table (Phase 21, previously "Pending") are now satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None found | — | — |

Scan of package.json (the primary file modified by this phase): no TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers. No stub code — this phase's changes are pure dependency-version updates in package.json/package-lock.json via GitHub PR merges.

### Human Verification Required

None. All phase criteria are verifiable programmatically:
- GitHub API merge timestamps: confirmed non-null for PR #34 and PR #47.
- Open dependabot PR count: confirmed zero.
- Installed package versions: confirmed against node_modules.
- Build integrity: confirmed via verify-sourcemap-names.mjs and unit test suite.

The operator merge gate (explicit "approved" typed at each plan's checkpoint:human-verify task) was satisfied during execution and is documented in 21-01-SUMMARY.md and 21-02-SUMMARY.md.

### Gaps Summary

No gaps. All must-haves are verified.

The vite 8.0.16 + @vitejs/plugin-react 6.0.2 deferral is **not a gap** — it is a documented D-04 isolate-and-flag outcome. DEP-01's "equivalent up-to-date bump" clause explicitly covers partial merges where a package in the group is legitimately isolated. The root cause (Linux x86_64 rolldown keepNames regression) was proven by a Docker bisect, the decision was made with operator visibility, the keepNames guard was not weakened, and a clear re-entry criterion exists for the deferred packages (re-validate in a linux/amd64 container before merging the future dependabot PR).

---

_Verified: 2026-06-06T08:40:00Z_
_Verifier: Claude (gsd-verifier)_
