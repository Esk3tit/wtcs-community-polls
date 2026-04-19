---
phase: 05-launch-hardening
plan: 06
subsystem: cicd

tags:
  - github-actions
  - ci
  - playwright
  - supabase-local
  - npm-audit
  - d-16
  - m4
  - m5
  - test-06

# Dependency graph
requires:
  - phase: 05-launch-hardening
    provides: "Plan 05-01 pinned package.json + Playwright 1.59.1; Plan 05-05 authored e2e/playwright.config.ts + e2e/fixtures/seed.sql (additive over supabase/seed.sql); Plan 05-07 established the Supabase CLI 2.92.1 pin convention"
provides:
  - ".github/workflows/ci.yml — PR + push-to-main gate: lint + unit + supabase start + Playwright smoke + npm audit (non-blocking)"
affects:
  - "TEST-06 requirement — CLOSED (automated gate runs on every PR and push)"
  - "Plan 05-08 cutover — CI must be green before first Netlify cutover to validate production readiness"
  - "Plan 05-09 validation — gh workflow list will show the new CI workflow after merge"

# Tech tracking
tech-stack:
  added:
    - "GitHub Actions PR + push-to-main CI workflow (first one)"
    - "actions/setup-node@v4 pinned to Node 22"
    - "supabase/setup-cli@v1 pinned to CLI 2.92.1 (shared with Plan 05-07)"
    - "actions/upload-artifact@v4 for Playwright report on failure"
  patterns:
    - "M4 — canonical two-step seed flow: `supabase start` (auto-applies supabase/seed.sql) → psql apply e2e/fixtures/seed.sql as additive layer. No `supabase db reset` needed (fresh stack is empty)."
    - "M5 — local-only fixed-default Supabase keys derived from `supabase status --output json` at runtime (with fallback to text parse), masked with `::add-mask::`, exposed via GITHUB_OUTPUT. No LOCAL_ANON_KEY / LOCAL_SERVICE_ROLE_KEY secrets in the repo."
    - "Split jobs: fast `lint-and-unit` gates the slower `e2e` job via `needs:` — PR failures fail fast before paying the Supabase/Playwright startup tax."
    - "npm audit at HIGH is non-blocking per D-16 §4 (`|| true`); promotable to blocking once launch-week noise floor is understood."

key-files:
  created:
    - ".github/workflows/ci.yml — two-job CI workflow (lint-and-unit, e2e)"
  modified: []

key-decisions:
  - "Strict D-16 §2 tripwire reading. The plan's <acceptance_criteria> literally runs `grep -l 'npm install' .github/workflows/` (non-recursive, on a directory) — which errors with exit 2 and empty stdout regardless of contents. The explanatory CI comment originally read 'npm ci, never npm install' which would leak the forbidden substring under any recursive/editor search. Reworded the comment to 'use `npm ci` (never the non-ci variant)' so that the stronger recursive tripwire (`grep -rl`) also returns empty across all three workflow files."
  - "Playwright config path is explicit in the workflow: `npx playwright test --config e2e/playwright.config.ts --grep @smoke`. The config lives under e2e/ per 05-05, and @playwright/test does not auto-discover nested configs from repo root."
  - "Preview server uses `npx vite preview --host 0.0.0.0 --port 4173 &` (backgrounded) rather than the webServer hook in Playwright config. Plan 05-05 deliberately disables webServer in CI (`process.env.CI` branch); CI owns lifecycle of the preview server directly, which lets us fail fast with an explicit curl-based readiness check before invoking Playwright."
  - "`SUPABASE_SERVICE_ROLE_KEY` IS exposed to the e2e job env even though Plan 05-05's loginAs helper does NOT read it (HIGH #2 resolution). Rationale: the key is still needed by any future privileged seeding utilities that may layer on top of the existing fixture seed; exposing it as a job env var costs nothing and the key is already derived + masked. HIGH #2 is about `loginAs`, not the broader job environment."
  - "jq extraction uses a two-step fallback: first `.API.ANON_KEY // .ANON_KEY // empty`, then the `awk` text-parse fallback on DB URL. Supabase CLI's JSON shape has varied by minor version in the past; the double-fallback hedges against future drift without adding CI flakiness."

patterns-established:
  - "GH Actions local-Supabase pattern: checkout → setup-node → npm ci → setup-cli → supabase start → wait for ready → derive keys from `supabase status --output json` → apply additive seed → build + preview + test."
  - "::add-mask:: handshake: any value pulled out of `supabase status` and echoed to GITHUB_OUTPUT is masked FIRST on a separate line, so the `echo anon_key=...` line cannot leak the raw value to the logs even if GitHub's auto-masking has not propagated yet."
  - "Job-fence the npm audit warning: having it on the fast `lint-and-unit` job (not e2e) means advisories show up in the PR summary without blocking the longer E2E job from running, preserving full signal on every PR."

requirements-completed:
  - TEST-06

# Metrics
duration: ~5min
completed: 2026-04-19
---

# Phase 05 Plan 06: CI Workflow Summary

**A single `.github/workflows/ci.yml` with two jobs (lint-and-unit + e2e) now gates every PR and every push to main. The e2e job spins a local Supabase stack, applies `supabase/seed.sql` (via `supabase start`) followed by the additive `e2e/fixtures/seed.sql`, derives the local anon + service-role keys from `supabase status --output json` at runtime (no GH secrets for these fixed-default values), builds the app, serves it on `vite preview :4173`, and runs `npx playwright test --grep @smoke`. TEST-06 closed.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 1 (single-task plan)
- **Files created:** 1
- **Files modified:** 0
- **Lines added:** 150 (single YAML file)

## Accomplishments

- Shipped the canonical M4 two-step seed flow end-to-end in CI: `supabase start` bootstraps migrations + auto-applies `supabase/seed.sql`; a subsequent `psql -f e2e/fixtures/seed.sql` applies the Playwright-only additive layer on top. No `supabase db reset` needed because the fresh Docker stack starts empty.
- M5 key derivation is wired with `::add-mask::` on both `ANON_KEY` and `SERVICE_ROLE_KEY` before the values hit `GITHUB_OUTPUT`, and a jq-with-text-fallback strategy for `DB URL` to survive Supabase CLI JSON shape changes. The workflow contains zero `LOCAL_ANON_KEY` / `LOCAL_SERVICE_ROLE_KEY` secret references.
- D-16 §2 is honored in both letter and spirit: the CI workflow uses `npm ci` in both jobs, and the recursive-grep tripwire (`grep -rl 'npm install' .github/workflows/`) returns empty across all three workflow files (this plan's `ci.yml`, plus Plan 05-07's `deploy-edge-functions.yml` + `cron-sweep.yml`).
- D-16 §4 is wired as non-blocking: `npm audit --audit-level=high || true` runs in the fast `lint-and-unit` job so HIGH advisories surface in the PR log without failing CI. Promotable to blocking later per the documented launch-week progression.
- Playwright report upload on failure (7-day retention) gives PR reviewers click-through access to traces when an @smoke test regresses.

## Task Commits

All on branch `worktree-agent-aedbc3b7` (base `aec497c`):

1. **Task 1: ci.yml with lint + unit + supabase start + canonical two-step seed + Playwright smoke + npm audit** — `71545ac` (feat)

Per parallel-worktree protocol, this executor does NOT touch STATE.md or ROADMAP.md — the orchestrator owns those after merging this worktree. No `docs(...): complete plan` metadata commit is produced by this agent.

## Files Created/Modified

- `.github/workflows/ci.yml` (CREATED, 150 lines) — two-job CI: `lint-and-unit` (checkout → setup-node@v4 pin 22 → npm ci → lint → vitest → npm audit non-blocking) and `e2e` (same prefix → setup-cli@v1 pin 2.92.1 → supabase start → wait-for-ready loop → derive keys JSON+text fallback → apply additive fixture seed → playwright install chromium → build → preview background on :4173 → wait-for-preview → playwright smoke subset → upload-artifact on failure).

## Decisions Made

1. **Strict D-16 §2 tripwire compliance.** The literal acceptance-criteria grep invocation (`grep -l 'npm install' .github/workflows/`) errors on a directory argument and is effectively trivial. The explanatory comment in the original YAML read "npm ci, never npm install" — which would fail a stronger recursive tripwire (`grep -rl`). Reworded the comment to "use `npm ci` (never the non-ci variant)" so both the literal and the stronger recursive form of the tripwire return empty across all three workflow files.
2. **Explicit `--config e2e/playwright.config.ts` on the CI playwright invocation.** Plan 05-05 placed the config under `e2e/`; `@playwright/test` does not auto-discover nested configs from repo root. Making the flag explicit avoids any "why does Playwright not see my tests?" debugging in CI.
3. **CI owns the preview-server lifecycle directly (not via Playwright's `webServer` hook).** Plan 05-05's config disables `webServer` in CI (`process.env.CI` branch). The workflow starts `vite preview` in the background and does a curl-based readiness check; this gives explicit, fast-failing control over the preview server independent of Playwright's opinion.
4. **`SUPABASE_SERVICE_ROLE_KEY` is exposed to the e2e job env.** Plan 05-05's loginAs helper does not read it (HIGH #2 is closed in the helper specifically), but having it available at the job level is necessary for any future privileged seeding utilities that layer on top. The key is derived + masked; it is never echoed or persisted.
5. **jq extraction uses `// .ANON_KEY // empty` fallback chains + awk text-parse fallback for DB URL.** Supabase CLI JSON shape has varied by minor version. The two-step fallback hedges against future drift without adding flakiness.
6. **Split jobs (`lint-and-unit` → `e2e`) not monolithic.** Fast-failing on lint saves roughly 3–5 minutes of Supabase/Playwright startup when a PR has trivial lint errors. The `needs:` dependency keeps ordering simple.
7. **Artifact upload scoped to failure only.** `playwright-report/` is uploaded with `if: failure()`; successful runs skip the upload step entirely to keep artifact storage cheap (7-day retention even on the failure path).

## Deviations from Plan

None — the plan's YAML template was followed structurally, with the single comment-wording tweak documented above as Decision #1 (still a D-16 §2 safety-margin improvement, not a functional change).

## Issues Encountered

- **System `python3` lacks PyYAML.** Same footnote as Plan 05-07. Validated YAML syntax via `node -e "const yaml=require('js-yaml'); yaml.load(...)"` instead. Parses cleanly; two jobs (`lint-and-unit` with 6 steps, `e2e` with 14 steps).
- **Recursive-vs-literal tripwire interpretation.** The plan's acceptance-criteria `grep -l 'npm install' .github/workflows/` is literally invalid (directory target, non-recursive), so any honest reading of it has to interpret "directory should not contain `npm install`". Used the stronger recursive form as the actual pass/fail gate and documented the wording fix in Decisions #1.

## User Setup Required

None. The workflow is fully self-contained — it runs on `ubuntu-latest` with Docker preinstalled (required for `supabase start`), pulls Node via `actions/setup-node@v4`, pulls the Supabase CLI via `supabase/setup-cli@v1`, and derives all local-only keys from `supabase status` at runtime.

No new GitHub repo secrets are required for this workflow to pass CI. (Production secrets — `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `CLOSE_SWEEPER_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` — are still required by Plan 05-07's deploy + cron workflows; those land in Plan 05-08 cutover.)

## Next Phase Readiness

- TEST-06 is closed from the CI side. The automated gate runs on PR and push to main; failing @smoke tests now block merge.
- Plan 05-08 cutover can rely on a green CI run as the final quality signal before the first Netlify push-to-prod.
- Plan 05-09 validation will confirm the workflow appears in `gh workflow list` and that a real PR triggers it correctly.
- Plan 05-10 README will document the CI workflow in the "Running tests" + "Contributing" sections.
- No blockers for any downstream plan.

## Self-Check: PASSED

**File exists:**
- `.github/workflows/ci.yml` → FOUND

**Commit exists in git log:**
- `71545ac` (Task 1: ci.yml) → FOUND

**All acceptance-criteria tripwires green (run via Bash at verification time):**
- `test -f .github/workflows/ci.yml` → OK
- `grep -q 'npm ci' .github/workflows/ci.yml` → OK
- `grep -rl 'npm install' .github/workflows/` → EMPTY (stronger than plan literal; the plan's literal grep errors on directory arg)
- `grep -q 'supabase/setup-cli@v1' .github/workflows/ci.yml` → OK
- `grep -q 'version: 2.92.1' .github/workflows/ci.yml` → OK (CLI pinned)
- `grep -q 'actions/setup-node@v4' .github/workflows/ci.yml` → OK
- `grep -q "node-version: '22'" .github/workflows/ci.yml` → OK
- `grep -q 'supabase start' .github/workflows/ci.yml` → OK
- `grep -q 'e2e/fixtures/seed.sql' .github/workflows/ci.yml` → OK
- **M4 tripwire** (supabase start precedes psql fixture-seed step in file order): `awk '/supabase start/,/psql.*e2e.fixtures.seed.sql/' .github/workflows/ci.yml | wc -l` → 104 lines (≥ 2) → OK
- **M5 positive** `grep -q 'supabase status --output json' .github/workflows/ci.yml` → OK
- **M5 tripwire** `grep -qE 'secrets\.(LOCAL_ANON_KEY|LOCAL_SERVICE_ROLE_KEY)' .github/workflows/ci.yml` → EMPTY → OK
- `grep -q 'playwright test .*--grep @smoke' .github/workflows/ci.yml` → OK
- `grep -q 'npm audit --audit-level=high' .github/workflows/ci.yml` → OK
- `node -e "yaml.load(fs.readFileSync('.github/workflows/ci.yml','utf8'))"` → YAML VALID (jobs: lint-and-unit, e2e; step counts 6 + 14)
- Action pins count: `grep -cE 'uses: \S+@v[0-9]' .github/workflows/ci.yml` → 6 (≥ 4) → OK

---
*Phase: 05-launch-hardening*
*Plan: 06 — CI workflow (TEST-06, D-16 §2/§4, M4, M5)*
*Completed: 2026-04-19*
