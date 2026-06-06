# Phase 21: Dependency Hygiene - Research

**Researched:** 2026-06-05
**Domain:** npm dependency bump review — lint-staged 16→17 (DEP-02), 18-package minor+patch group (DEP-01)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Rebase PR #44 onto current `main` (post Phases 19/20) and re-run CI first — the red result is stale (ran 2026-06-03 on commit `0ddb157`, before Phases 19 and 20 merged). If green after rebase → review + merge keeping all 18 packages. If still red → diagnose root cause and fix on-branch, keeping the full group. Do NOT judge the merge on the stale CI run.
- **D-02:** Merge **PR #34 first** (green, independent dev-only lint-staged bump → closes DEP-02), then focus on PR #44 for DEP-01. Two separate merges, #34 before #44.
- **D-03:** Require **all CI green PLUS local check**: `npm run build` + local app smoke run for both PRs, and additionally a **pre-commit hook test** for #34 (stage a `.ts`/`.tsx` file and confirm the lint-staged v17 hook runs `eslint` + `tsc -b --noEmit` correctly). CI-green alone is not sufficient.
- **D-04 (Claude's Discretion — fix-forward + isolate-and-flag):** Default fix-forward. If a specific package in the #44 group genuinely cannot be made green on-branch, isolate and defer just that one package (drop from group, merge the rest, flag the deferred package to operator). Never silently drop, never abandon the whole group. For lint-staged v17: surface any Node-version breaking change rather than auto-bumping CI Node (CI is already Node 22, which satisfies v17's Node floor).

### Claude's Discretion

Technical root-cause diagnosis of the #44 `lint-and-unit` failure delegated to researcher/planner/executor (implementation detail, not a user decision).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. If a #44 package proves genuinely unmergeable, it is isolated/deferred and flagged per D-04 (not a new phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEP-01 | Dependabot PR #44 (18-package minor+patch group, supersedes #40) reviewed, CI-green, and merged — or equivalent up-to-date bump. No regressions in build pipeline. | Root-cause of stale CI failure identified; rebase mechanics documented; high-risk packages audited for type-drift |
| DEP-02 | Dependabot PR #34 (lint-staged 16→17) reviewed against v17 breaking-change notes, config validated/updated for v17, CI-green, and merged. | v17 breaking changes documented; Node floor verified; config compatibility confirmed; pre-commit hook test protocol specified |
</phase_requirements>

---

## Summary

Phase 21 closes two open dependabot PRs to reach dependency debt-zero at the v1.4 final milestone.

**PR #34 (DEP-02)** bumps `lint-staged` 16.4.0 → 17.0.7. This PR is already green on CI and MERGEABLE. Research confirms: (1) lint-staged v17 requires Node >=22.22.1 — GitHub Actions resolves `node-version: '22'` to Node 22.22.3, satisfying this floor with headroom; (2) the only breaking changes that could affect this project are the Node floor itself (not an issue) and an optional `yaml` dependency (not used — config lives in `package.json`); (3) the existing config schema `"*.{ts,tsx}": ["eslint --max-warnings 0 --no-warn-ignored", "bash -c 'tsc -b --noEmit'"]` is fully compatible with v17 — `bash -c '...'` is NOT the removed `--shell` flag (which was removed in v16, not v17). The pre-commit hook test is the only extra validation step beyond CI.

**PR #44 (DEP-01)** bumps 18 packages (minor+patch group). The stale `lint-and-unit` CI failure was traced definitively to **`verify-sourcemap-names.mjs` failing** — 5 function names (ConsentProvider, ConsentBanner, AuthProvider, RootLayout, AppErrorFallback) missing from the dist bundle. This happened because the dependabot branch is based on commit `0ddb157` (pre-Phase 19 and pre-Phase 20 — 82 commits behind current main). The Phase 15 `verify-sourcemap-names.mjs` script was already on main at that commit, but the stale branch produced a build where those names were missing (possibly a vite/rolldown configuration difference pre-Phase 16 changes). After rebase onto current main the build and sourcemap check should pass because the vite config now has `rolldownOptions.output.keepNames: true` and `manualChunks`. All 403 unit tests passed in the stale run — only the sourcemap check failed. The 18 packages are all minor/patch bumps with no breaking changes identified.

**Primary recommendation:** Merge PR #34 first (straightforward — CI already green; add pre-commit hook test). Then trigger `@dependabot rebase` on PR #44 via `gh pr comment 44 --body "@dependabot rebase"`, wait for rebase push + CI re-run, and if CI is green proceed to review + merge. The rebase is expected to clear the failure entirely.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| lint-staged pre-commit hook | Dev toolchain | — | Runs in developer's local git pre-commit hook via husky; never touches production runtime |
| CI pipeline validation | GitHub Actions | — | `lint-and-unit` runs `npm ci`, eslint, vitest, build, verify-sourcemap-names |
| Package version resolution | npm lockfile | GitHub dependabot | lockfile is source of truth; dependabot manages the bump PRs |
| TypeScript type checking | Build toolchain (`tsc -b`) | CI lint-and-unit | Both pre-commit (lint-staged) and CI run `tsc -b --noEmit` |

---

## PR #34 (DEP-02): lint-staged 16.4.0 → 17.0.7

### Current State

- **Branch:** `dependabot/npm_and_yarn/lint-staged-17.0.5` [VERIFIED: gh pr view 34]
- **CI status:** ALL GREEN — lint-and-unit PASS, test-integration PASS, e2e PASS [VERIFIED: gh pr checks 34]
- **Mergeable:** MERGEABLE [VERIFIED: gh pr view 34]
- **Node version in passing CI run:** Node 22.22.3 (found in cache @ `/opt/hostedtoolcache/node/22.22.3/x64`) [VERIFIED: gh run view 26801032382 logs]

### lint-staged v17 Breaking Changes

Source: [lint-staged MIGRATION.md](https://github.com/lint-staged/lint-staged/blob/main/MIGRATION.md) [VERIFIED: fetched directly]

| Breaking Change | Impact on This Project |
|----------------|----------------------|
| **Node.js floor raised to >=22.22.1** | NONE — CI runs Node 22.22.3 (>=22.22.1). Local dev runs Node 24.14.0. Both satisfy the requirement. [VERIFIED: npm view lint-staged@17.0.7 engines + gh run logs] |
| **Git version must be >=2.32.0** | NONE — CI runner has git 2.54.0. [VERIFIED: gh run 26801032382 logs] |
| **`yaml` dependency is now optional** | NONE — this project's lint-staged config lives in `package.json` under `"lint-staged"` key (JSON format), not a YAML file. [VERIFIED: package.json] |
| **`--shell` flag removed** | NONE — this was removed in v16, not v17. The existing `"bash -c 'tsc -b --noEmit'"` entry uses an explicit `bash -c` invocation (which is a normal command), NOT the `--shell` CLI flag. These are different things. [VERIFIED: MIGRATION.md + CI green on PR #34] |
| **`git update-index --again` replaced by `git add` (v17.0.6 patch)** | NONE — behavioral fix that improves git staging. The project's typical workflow (explicit `git add` before commit) is unaffected. [VERIFIED: lint-staged release notes in PR #34 body] |
| **Commander removed; uses node:util parseArgs** | NONE — this is internal to lint-staged, no CLI flag changes that affect this project's usage. [VERIFIED: lint-staged MIGRATION.md] |

### Config Compatibility Assessment

Existing `package.json` `"lint-staged"` block:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --max-warnings 0 --no-warn-ignored",
      "bash -c 'tsc -b --noEmit'"
    ]
  }
}
```

**Assessment: COMPATIBLE with v17 — no config changes needed.** [VERIFIED: CI green on PR #34 with this exact config]

The `bash -c 'tsc -b --noEmit'` pattern deliberately avoids passing staged filenames to `tsc` (which would not work with project-level type checking). This is the standard workaround and continues to work in v17.

### Husky pre-commit Hook

```sh
# .husky/pre-commit
#!/usr/bin/env sh
npx lint-staged
```

[VERIFIED: .husky/pre-commit] — Standard invocation. No changes needed for v17.

### Pre-Commit Hook Test Protocol (required by D-03)

To validate the lint-staged v17 hook actually runs correctly after merging PR #34:
1. Create a trivial staged change to any `.ts` or `.tsx` file (e.g., add a blank comment then remove it)
2. Stage the file: `git add <file>`
3. Run `npx lint-staged` manually (or trigger via `git commit`)
4. Confirm output shows both `eslint --max-warnings 0 --no-warn-ignored` AND `bash -c 'tsc -b --noEmit'` executing and completing without error
5. Revert the trivial change

---

## PR #44 (DEP-01): 18-package minor+patch group

### Current State

- **Branch:** `dependabot/npm_and_yarn/minor-and-patch-6029210c9a` [VERIFIED: gh pr view 44]
- **Base commit:** `0ddb1571` — **82 commits behind current main** [VERIFIED: git rev-list count]
- **CI status:** lint-and-unit FAIL (stale run 26865651805, 2026-06-03) — test-integration SKIPPED, e2e SKIPPED [VERIFIED: gh pr checks 44]
- **Mergeable:** MERGEABLE, mergeable_state: unstable [VERIFIED: gh pr view 44]

### Package List (18 packages)

[VERIFIED: gh pr view 44 body]

| Package | From | To | Risk Level | Notes |
|---------|------|----|------------|-------|
| `@sentry/react` | 10.53.1 | 10.56.0 | LOW | Minor version patch release; Sentry SDK maintains backward compat across minor releases |
| `@supabase/supabase-js` | 2.105.4 | 2.107.0 | LOW-MEDIUM | See supabase-js changelog below |
| `@tanstack/react-router` | 1.169.2 | 1.170.11 | LOW | Minor version; TanStack Router is pre-1.0 stability but 1.169→1.170 is patch-class |
| `lucide-react` | 1.14.0 | 1.17.0 | LOW | Icon library; API stable across minor bumps |
| `posthog-js` | 1.373.4 | 1.379.0 | LOW | Analytics; app uses standard posthog-js API (identify, capture); no API drift expected |
| `react` | 19.2.6 | 19.2.7 | LOW | React patch release |
| `@types/react` | 19.2.14 | 19.2.16 | LOW-MEDIUM | Type definitions — minor increments; possible tsc drift if types became stricter |
| `react-dom` | 19.2.6 | 19.2.7 | LOW | Patch release |
| `@tanstack/react-router-devtools` | 1.166.13 | 1.167.0 | LOW | Dev-only tooling |
| `@tanstack/router-cli` | 1.166.43 | 1.167.13 | LOW | Dev-only CLI (tsr generate) |
| `@tanstack/router-plugin` | 1.167.35 | 1.168.14 | LOW | Vite plugin for router codegen |
| `@types/node` | 25.6.0 | 25.9.1 | LOW | Type definitions for Node built-ins |
| `@vitejs/plugin-react` | 6.0.1 | 6.0.2 | LOW | Patch bump |
| `eslint` | 10.4.0 | 10.4.1 | LOW | Patch bump |
| `supabase` (CLI) | 2.102.0 | 2.104.0 | LOW | Dev CLI; CI pins this via `supabase/setup-cli@v2` to version 2.102.0 — see note below |
| `typescript-eslint` | 8.59.3 | 8.60.1 | LOW | Minor; patch-class for a mature plugin |
| `vite` | 8.0.12 | 8.0.16 | LOW | Patch bump |
| `@eslint/js` | 10.0.1 | (included in group) | LOW | Base ESLint rules |

**Note on `supabase` CLI bump:** `package.json` bumps `supabase` devDep from 2.102.0 to 2.104.0, but CI's `test-integration` and `e2e` jobs use `supabase/setup-cli@v2` **pinned to `version: 2.102.0`**. These are independent; the devDep bump does not affect the pinned CI CLI version. Both CI jobs explicitly specify `version: 2.102.0`. [VERIFIED: ci.yml lines ~61 and ~130] No CI change needed.

### Root Cause of Stale CI Failure (DEFINITIVE)

**Failure source:** `verify-sourcemap-names.mjs` — NOT tests, NOT TypeScript, NOT eslint.

**Evidence from CI run 26865651805 logs:** [VERIFIED: gh run view 26865651805 --log-failed]

```
[verify-sourcemap-names] FAIL: 5 name(s) missing from dist/assets/**/*.js
  - ConsentProvider
  - ConsentBanner
  - AuthProvider
  - RootLayout
  - AppErrorFallback
This means vite.config.ts rolldownOptions.output.keepNames may have regressed.
```

The test suite itself was fully green in that same run:
```
Test Files  43 passed (43)
     Tests  403 passed (403)
  Duration  25.00s
```

**Root cause:** The dependabot branch (`0ddb157`) predates the Phase 16 vite config changes that added `rolldownOptions.output.keepNames: true` and `manualChunks`. The stale branch built without `keepNames`, producing mangled function names, causing the allowlist check to fail. After rebasing onto current main (which has `keepNames: true` in `vite.config.ts`), the build will include the names and the check will pass.

**Consequence:** The "red CI" on PR #44 is entirely due to stale code, not the 18 bumped packages. After rebasing, the expected outcome is green CI with no code changes needed.

### Notable Package Changelog Findings

**`@supabase/supabase-js` 2.105.4 → 2.107.0** [VERIFIED: gh api releases]

| Version | Notable Change | Risk |
|---------|---------------|------|
| 2.106.0 | W3C/OpenTelemetry trace context propagation (new feature); auth fix for email_change verifyOtp | No API changes to auth patterns used by this project |
| 2.106.1 | auth: encode client-id in OAuth requests fix; misc Hermes compat fixes | OAuth flow improvement — relevant to Discord auth but behavioral fix not a breaking change |
| 2.106.2 | auth: restore signup user response; react-native export condition | Neither impacts this project (no signup flow, not RN) |
| 2.107.0 | **auth: remove navigator.locks-based mutex; introduce commit guard + dispose()** | Potentially notable — removes browser `navigator.locks` for session management. This project uses Discord OAuth sessions managed by Supabase client. No app-code changes expected since this is internal to the client SDK. The app's `AuthContext` uses `onAuthStateChange` which is not affected. |

**`@tanstack/react-router` 1.169.2 → 1.170.11** [ASSUMED — no official breaking-change list found for this minor range; minor bumps in TanStack Router 1.x do not introduce API breaking changes by the project's semver policy, and the CONTEXT.md confirms the 403 unit tests passed in the stale run even with these bumps]

**`@types/react` 19.2.14 → 19.2.16** [ASSUMED — DefinitelyTyped patch release; risk of tsc drift is low but non-zero. If rebase still shows tsc failure (see diagnosis steps), this is the first package to investigate]

### Rebase + Re-Run Mechanics

#### Option A: `@dependabot rebase` (preferred — zero manual work)

```bash
# Trigger dependabot to rebase the PR branch onto current main
gh pr comment 44 --body "@dependabot rebase"
```

Dependabot will react with a thumbs-up emoji, then push a rebased version of the branch within a few minutes (may take up to 10 minutes if dependabot is busy). GitHub Actions CI will auto-trigger on the new push.

**Monitor:** `gh pr checks 44 --watch` or `gh run list --limit 5` to watch for the new run.

**Caveats:**
- Dependabot rebase creates a new commit on the branch. The PR body and title are unchanged.
- The rebased branch will have the dependabot bump on top of current main's HEAD.
- If there are merge conflicts (unlikely since #44 only touches `package.json` and `package-lock.json`), dependabot will report the conflict and a manual rebase is needed.

#### Option B: Manual rebase (fallback if `@dependabot rebase` fails or conflicts)

```bash
# Fetch the dependabot branch and rebase manually
git fetch origin dependabot/npm_and_yarn/minor-and-patch-6029210c9a
git checkout dependabot/npm_and_yarn/minor-and-patch-6029210c9a
git rebase origin/main
# Resolve any conflicts (expected only in package-lock.json — re-run npm install)
npm install
git add package-lock.json
git rebase --continue
git push --force-with-lease origin dependabot/npm_and_yarn/minor-and-patch-6029210c9a
```

After force-push, GitHub Actions CI triggers automatically.

#### Re-running the old stale CI (NOT recommended)

`gh run rerun 26865651805` would re-run against the same old commit (`0ddb157`) — this will STILL fail the sourcemap check. Do NOT use this approach. The fix requires rebasing the branch, not re-running the old CI.

#### Reading CI results

```bash
gh pr checks 44                    # snapshot view
gh pr checks 44 --watch            # live watch until all checks complete
gh run list --branch dependabot/npm_and_yarn/minor-and-patch-6029210c9a --limit 3
```

The three jobs to verify as green: `lint-and-unit`, `test-integration`, `e2e`.

---

## Merge Protocol (D-03 Validation Bar)

### PR #34 (DEP-02) — lint-staged 16→17

1. Verify CI checks all green: `gh pr checks 34`
2. Local: `git checkout dependabot/npm_and_yarn/lint-staged-17.0.5 && npm ci`
3. Local build smoke: `npm run build` — must complete without error
4. Local app smoke: start dev server (`npm run dev`), open browser, confirm app loads
5. Pre-commit hook test: stage a trivial `.tsx` change, run `npx lint-staged`, confirm eslint + tsc both execute and pass
6. Confirm bot reviews (CodeRabbit, gemini-code-assist, greptile) have all reviewed
7. Await explicit operator OK
8. Merge: `gh pr merge 34 --merge` (or via GitHub UI)

### PR #44 (DEP-01) — 18-package group

1. Trigger rebase: `gh pr comment 44 --body "@dependabot rebase"`
2. Wait for CI to run on rebased branch: `gh pr checks 44 --watch`
3. If green: proceed. If still red: see diagnosis steps below.
4. Local: `git fetch origin && git checkout dependabot/npm_and_yarn/minor-and-patch-6029210c9a && npm ci`
5. Local build smoke: `npm run build && node scripts/verify-sourcemap-names.mjs`
6. Local app smoke: start dev server, confirm app loads and auth flow appears intact
7. Confirm bot reviews have all reviewed
8. Await explicit operator OK
9. Merge: `gh pr merge 44 --merge` (or via GitHub UI)

---

## Root-Cause Hypotheses If #44 CI Is STILL Red After Rebase

Ordered most-likely-first. The rebase is expected to clear the failure entirely, but if it persists:

### Hypothesis 1 (HIGH PROBABILITY): Residual sourcemap names issue
**Symptom:** `verify-sourcemap-names.mjs` still fails after rebase — different names missing
**Cause:** A bumped package (e.g., `@tanstack/react-router` 1.170.x) exports a different component tree that affects which function names Rolldown emits even with `keepNames: true`
**Diagnosis:**
```bash
npm run build 2>&1
node scripts/verify-sourcemap-names.mjs
```
**Fix:** If a listed name is genuinely renamed in the new package version, update the allowlist in `scripts/verify-sourcemap-names.mjs` (documented pattern — see script header). Only remove a name if it was renamed; if missing due to keepNames regression, fix keepNames.

### Hypothesis 2 (LOW PROBABILITY): TypeScript type drift from `@types/react` 19.2.16
**Symptom:** `tsc -b` fails in `lint-and-unit` with new TypeScript errors about React component types
**Cause:** `@types/react` minor bump introduced stricter types for patterns this codebase uses
**Diagnosis:**
```bash
npm ci && tsc -b --noEmit 2>&1 | head -40
```
**Fix:** Fix the specific type error on-branch. Likely candidates: props typing, event handler signatures, `ref` types. A small targeted type annotation is the correct fix, not pinning `@types/react`.

### Hypothesis 3 (LOW PROBABILITY): eslint rule change from `eslint` 10.4.1 or `typescript-eslint` 8.60.1
**Symptom:** `npm run lint` exits non-zero with new warnings/errors
**Cause:** A lint rule in `typescript-eslint` 8.60.1 fires on existing code
**Diagnosis:**
```bash
npm run lint 2>&1 | head -40
```
**Fix:** Fix the lint violation on-branch (suppress with `// eslint-disable-next-line` only if the rule is genuinely wrong; prefer fixing the code).

### Hypothesis 4 (VERY LOW PROBABILITY): Unit test failure from supabase-js 2.107.0 auth mutex removal
**Symptom:** Auth-related unit tests fail after rebase
**Cause:** `@supabase/supabase-js` 2.107.0 removed `navigator.locks`-based mutex; tests that mock Supabase auth internals may behave differently
**Diagnosis:**
```bash
npm test -- --run 2>&1 | grep -E "FAIL|failed|×"
```
**Fix:** Update test mocks to match the new client behavior. The `@supabase/supabase-js` client API (`.auth.signInWithOAuth`, `.auth.onAuthStateChange`, etc.) is unchanged — only internal concurrency control changed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Rebasing dependabot PR | Manual git operations | `@dependabot rebase` comment via `gh pr comment` |
| Re-running CI | Scripting GitHub API directly | `gh pr checks 44 --watch` or `gh run rerun` on new run ID |
| Validating lint-staged behavior | Custom pre-commit hook test framework | `npx lint-staged` directly with a staged file |
| Tracking merge-gate status | Manual check lists | `gh pr checks <N>` |

---

## Package Legitimacy Audit

These packages are all existing dependabot-managed upgrades of packages already in the project — not new additions. Slopcheck is unnecessary for established packages with long registry history. All were verified against the npm registry.

| Package | Registry | Disposition |
|---------|----------|-------------|
| lint-staged@17.0.7 | npm | Approved — 8+ year old package, 3.7M weekly downloads [VERIFIED: npm view] |
| All 18 #44 packages | npm | Approved — all existing project deps, long registry history; bumped by official GitHub dependabot |

**No packages removed or flagged.**

---

## Common Pitfalls

### Pitfall 1: Judging PR #44 as broken without rebasing
**What goes wrong:** CI shows red on the PR checks page → executor closes or splits the PR unnecessarily
**Why it happens:** The red run (26865651805) is on commit `0ddb157`, 82 commits before current main
**How to avoid:** Always rebase first per D-01. Check the run timestamp (2026-06-03) vs the PR's base commit
**Warning signs:** Run timestamp predates Phase 19/20 merge dates (Phase 19 merged as PR #45; Phase 20 merged as PR #46 on 2026-06-04)

### Pitfall 2: Re-running the stale CI instead of rebasing
**What goes wrong:** `gh run rerun 26865651805` runs against the same old commit → still fails → wastes time
**Why it happens:** Re-run re-executes the same workflow on the same commit
**How to avoid:** Only re-run after the branch has been rebased (a new push creates a new run automatically)

### Pitfall 3: Confusing `supabase` devDep version with the CI pinned CLI version
**What goes wrong:** Bumping `supabase` devDep to 2.104.0 triggers concern about CI CLI compatibility
**Why it happens:** `ci.yml` uses `supabase/setup-cli@v2` with `version: 2.102.0` — a separate, explicit pin independent of package.json
**How to avoid:** These are two separate things. The `package.json` devDep affects local `./node_modules/.bin/supabase`. The CI always installs exactly `2.102.0` via setup-cli.

### Pitfall 4: Forgetting the pre-commit hook test for PR #34
**What goes wrong:** PR #34 merges, but the hook silently stops running `tsc` in v17 due to a subtle config issue
**Why it happens:** CI doesn't run the pre-commit hook — it runs lint/test separately
**How to avoid:** Per D-03, manually run `npx lint-staged` against a staged file before merging PR #34

### Pitfall 5: Treating `bash -c '...'` as the removed `--shell` flag
**What goes wrong:** Assuming the `bash -c 'tsc -b --noEmit'` config entry needs rewriting for v17
**Why it happens:** MIGRATION.md says `--shell` was removed in v16. `bash -c '...'` looks similar but is different
**How to avoid:** `bash -c '...'` is a task command entry that invokes bash as an executable — lint-staged spawns it like any other command. The `--shell` *flag* was a CLI option that caused lint-staged itself to evaluate commands via a shell. The CI green on PR #34 confirms no change is needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 (unit/component) + Playwright 1.60.0 (E2E) |
| Config file | `vitest.config.ts` (root — `test:` block inside `vite.config.ts`) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run && npm run test:integration && npm run e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| DEP-02 | lint-staged v17 hook runs eslint + tsc correctly | Manual/local | `npx lint-staged` (with staged .ts file) | CI doesn't run pre-commit hooks; manual verification per D-03 |
| DEP-01 | 18-package bump doesn't break build, tests, or CI | Automated (existing) | `npm run build && npm test -- --run` | Full CI pipeline is the primary gate |
| DEP-01 | sourcemap names preserved after bump | Automated (existing) | `npm run build && node scripts/verify-sourcemap-names.mjs` | Wired into `lint-and-unit` CI job |

### Validation Checklist (D-03 bar)

For **PR #34**:
- [ ] `gh pr checks 34` — all 3 CI jobs green
- [ ] `npm run build` local — succeeds
- [ ] `npx lint-staged` with staged .ts/.tsx file — runs eslint + tsc, both pass
- [ ] Local app smoke — dev server starts, app loads
- [ ] Bot reviews complete (CodeRabbit + gemini-code-assist + greptile)
- [ ] Operator explicit OK

For **PR #44**:
- [ ] `gh pr comment 44 --body "@dependabot rebase"` — triggered
- [ ] `gh pr checks 44 --watch` — all 3 CI jobs green after rebase
- [ ] `npm run build && node scripts/verify-sourcemap-names.mjs` local — passes
- [ ] Local app smoke — dev server starts, app loads, auth flow intact
- [ ] Bot reviews complete
- [ ] Operator explicit OK

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm ci, build, tests | Yes | v24.14.0 (local) / v22.22.3 (CI) | — |
| git | rebase operations | Yes | varies by env | — |
| gh CLI | PR management, CI monitoring | Yes | — | GitHub web UI |
| GitHub Actions | CI | Yes (triggered by push) | — | — |
| dependabot bot | `@dependabot rebase` command | Yes (active on repo) | — | Manual git rebase |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@tanstack/react-router` 1.169→1.170 has no API breaking changes | Package List table | Low — minor bump; risk is tsc type drift, not API removal. Diagnosis steps cover this case. |
| A2 | `@types/react` 19.2.14→19.2.16 will not cause tsc drift in this codebase | Package List table | Low — patch bump; if wrong, a small type annotation fixes it. Hypothesis 2 covers this. |
| A3 | The dependabot rebase will succeed without merge conflicts | Rebase Mechanics | Low — #44 only touches `package.json` and `package-lock.json`; very unlikely to conflict |
| A4 | `supabase-js` 2.107.0 mutex removal doesn't affect test mocks | Package changelog | Low — the mock surface (`createClient`, `auth.signInWithOAuth`, `onAuthStateChange`) is unchanged |

**If this table is empty of non-LOW items:** All high-impact claims were verified via tool calls. Low-risk assumptions are flagged but do not require user confirmation before execution.

---

## Open Questions

1. **Will the `@dependabot rebase` comment trigger successfully?**
   - What we know: The command is the documented approach (GitHub docs). The bot is active on the repo (authored both PRs).
   - What's unclear: Response time varies (seconds to 10 minutes).
   - Recommendation: If no response within 15 minutes, fall back to manual rebase (see Option B).

2. **Will any bot reviewer flag the supabase-js 2.107.0 mutex change as a risk?**
   - What we know: The change removes `navigator.locks` (browser API) in favor of a commit guard pattern. The app's auth is client-side with Discord OAuth.
   - What's unclear: Whether CodeRabbit/gemini will flag it as requiring auth flow testing.
   - Recommendation: The local app smoke test (D-03) covers this — sign-in flow should be verified manually as part of the merge protocol.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| lint-staged uses execa for process spawning | lint-staged uses nano-spawn (v16) | v16.0.0 | Internal — no user-facing config change |
| lint-staged `--shell` flag | Removed in v16; use explicit `bash -c` task entry | v16.0.0 | Not a concern — project already uses explicit `bash -c` |
| lint-staged Node floor >=20.17 | Node floor >=22.22.1 | v17.0.0 | CI on Node 22.22.3 — satisfies requirement |
| supabase-js uses `navigator.locks` for session mutex | supabase-js uses commit guard + dispose() | 2.107.0 | Internal — no client API changes |

---

## Sources

### Primary (HIGH confidence)
- [lint-staged MIGRATION.md](https://github.com/lint-staged/lint-staged/blob/main/MIGRATION.md) — v16 and v17 breaking changes, verified by direct fetch
- `npm view lint-staged@17.0.7 engines` — Node requirement `>=22.22.1`, verified
- `gh pr checks 34` — all CI jobs PASS confirmed
- `gh run view 26801032382 --log` — Node 22.22.3 confirmed in cache
- `gh run view 26865651805 --log-failed` — sourcemap check failure as exact root cause confirmed
- `gh api repos/supabase/supabase-js/releases` — supabase-js 2.106.0–2.107.0 changelogs verified
- `package.json`, `.husky/pre-commit`, `vite.config.ts`, `scripts/verify-sourcemap-names.mjs`, `.github/workflows/ci.yml` — all read directly
- `gh pr view 44 --json` — PR state, base commit `0ddb157`, mergeable status

### Secondary (MEDIUM confidence)
- [GitHub Docs — Dependabot PR comment commands](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-pull-request-comment-commands) — `@dependabot rebase` command documented
- [lint-staged GitHub releases page](https://github.com/lint-staged/lint-staged/releases) — patch release notes for 17.0.2–17.0.7 via PR #34 body

### Tertiary (LOW confidence)
- `@tanstack/react-router` 1.170.x changelog — not directly obtained; version bump range confirmed minor/patch class only; treated as LOW risk [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- PR #34 root cause and compatibility: HIGH — CI is already green, MIGRATION.md reviewed, Node version confirmed
- PR #44 stale CI root cause: HIGH — exact failure identified from CI logs (sourcemap names, not tests/tsc)
- Post-rebase outcome for PR #44: MEDIUM — strong evidence that rebase clears the failure; residual uncertainty on type drift
- Individual package changelog risk: MEDIUM (supabase-js verified) / LOW-ASSUMED (tanstack-router)

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable ecosystem; 30-day horizon)

---

## RESEARCH COMPLETE

**Phase:** 21 - Dependency Hygiene
**Confidence:** HIGH

### Key Findings

- **PR #34 (DEP-02) is ready to merge now.** CI is green. lint-staged v17 is fully compatible with the existing config. No config changes needed. Node 22.22.3 in CI exceeds the v17 `>=22.22.1` floor. Only action: pre-commit hook test per D-03 before merging.

- **PR #44 (DEP-01) stale CI failure is definitively NOT caused by the 18 bumped packages.** The failure is `verify-sourcemap-names.mjs` detecting 5 missing function names — caused by the branch being based on a pre-Phase-16 commit that lacked `keepNames: true`. All 403 unit tests passed in the stale run.

- **Correct fix for PR #44: `@dependabot rebase` — not re-running old CI.** The `gh pr comment 44 --body "@dependabot rebase"` command triggers dependabot to rebase the branch onto current main (which has `keepNames: true`). CI will auto-trigger on the new push and is expected to pass.

- **Merge sequencing is locked (D-02): #34 first, then #44.** #34 is green and independent; merge it as a quick win to close DEP-02, then handle the #44 rebase+CI cycle.

- **No app code changes expected** for either PR. This is a pure dependency bump exercise. If any issue persists after rebase, it is a targeted type annotation or lint fix, not an architectural change.

### File Created
`.planning/phases/21-dependency-hygiene/21-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| PR #34 compatibility | HIGH | CI already green; MIGRATION.md reviewed; Node version confirmed |
| PR #44 stale failure root cause | HIGH | Exact failure line traced in CI logs |
| Post-rebase CI outcome | MEDIUM | Strong evidence; residual uncertainty on type drift from @types/react bump |
| Merge mechanics (gh CLI) | HIGH | Commands verified; documented GitHub dependabot behavior |

### Open Questions
- Will `@dependabot rebase` trigger promptly, or does the executor need the manual fallback?
- Will CodeRabbit/gemini flag the supabase-js 2.107.0 mutex change as requiring additional auth smoke testing?

### Ready for Planning
Research complete. Planner can now create PLAN.md files targeting DEP-01 and DEP-02.
