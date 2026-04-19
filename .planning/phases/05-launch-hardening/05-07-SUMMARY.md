---
phase: 05-launch-hardening
plan: 07
subsystem: infra
tags: [github-actions, supabase-cli, cron, dependabot, edge-functions, cicd, workflow-yaml, jq]

requires:
  - phase: 05-launch-hardening
    provides: "Plan 05-02 shipped the 15 Edge Functions (incl. close-expired-polls) that Task 2's cron invokes; 05-01 established the config.toml baseline used by HIGH #3 analysis"
provides:
  - ".github/workflows/deploy-edge-functions.yml — push-to-main deploy of all 15 EFs via `supabase functions deploy --use-api`, CLI pinned to 2.92.1"
  - ".github/workflows/cron-sweep.yml — daily 03:00 UTC POST to close-expired-polls with BOTH X-Cron-Secret and Authorization: Bearer ${SUPABASE_ANON_KEY} headers, plus jq-based response-body validation"
  - ".github/dependabot.yml — weekly Monday grouped PRs for npm + github-actions (double-duty: supply-chain hygiene + scheduled-workflow 60-day-clock reset)"
affects: [05-08-cutover, 05-09-validation, 05-10-readme, future phases touching CI/CD]

tech-stack:
  added:
    - "GitHub Actions scheduled workflows (cron)"
    - "GitHub Actions push-to-main deploy workflow"
    - "supabase/setup-cli@v1 action (pinned to CLI 2.92.1)"
    - "Dependabot v2 grouped-update config"
    - "jq JSON validation in bash (preinstalled on ubuntu-latest)"
  patterns:
    - "Cron EF invocation: dual-header auth (gateway JWT + handler shared-secret) + response-body shape validation"
    - "EF deploy: --use-api flag bypasses Docker race (Pitfall 9); no function-name arg = deploy-all mode"
    - "60-day scheduled-workflow clock kept alive via weekly Dependabot commits (Pitfall 2 mitigation — architecturally significant)"

key-files:
  created:
    - .github/workflows/deploy-edge-functions.yml
    - .github/workflows/cron-sweep.yml
    - .github/dependabot.yml
  modified: []

key-decisions:
  - "Pinned Supabase CLI to 2.92.1 in deploy workflow (D-16 §1 exact pinning rule)"
  - "Cron runs at 03:00 UTC, not 00:00 (Pitfall 1: midnight queue storm causes GH Actions drift)"
  - "Cron sends BOTH Authorization: Bearer and X-Cron-Secret headers (HIGH #3 — config.toml has no per-function verify_jwt override, so gateway default applies + handler still requires its own shared secret)"
  - "Response-body validation uses jq (whitespace-tolerant) not grep (would fail on pretty-printed JSON)"
  - "No continue-on-error on cron — GH email-on-failure fires to repo owner (D-03)"
  - "Dependabot on weekly Monday cadence because it doubles as scheduled-workflow keepalive (Pitfall 2)"

patterns-established:
  - "GH Actions EF deploy template: checkout → setup-cli@v1 with pinned version → supabase functions deploy --use-api"
  - "GH Actions EF cron template: curl -w http_code → non-200 fails → jq -e validates body shape → no secret echo"
  - "Dependabot grouped config: minor-and-patch grouping for npm, all-patterns for github-actions"

requirements-completed: [INFR-02]

duration: ~20min
completed: 2026-04-19
---

# Phase 5 Plan 07: GitHub Actions + Dependabot Summary

**Three committed `.github/` workflow files: push-to-main EF deploy via `--use-api`, daily 03:00 UTC cron that POSTs to close-expired-polls with dual-header auth (gateway JWT + handler shared secret) plus jq response-body validation, and weekly Dependabot PRs that double as scheduled-workflow keepalive.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 (all committed atomically)
- **Files created:** 3
- **Files modified:** 0
- **Lines added:** 121 across three YAML files

## Accomplishments

- `deploy-edge-functions.yml` ships all 15 EFs in one `supabase functions deploy --use-api` run on push-to-main; CLI pinned to 2.92.1; path-filtered to avoid unnecessary runs.
- `cron-sweep.yml` implements the HIGH #3-resolved auth contract: the gateway's default `verify_jwt = true` is satisfied by `Authorization: Bearer ${SUPABASE_ANON_KEY}` and the handler's own gate is satisfied by `X-Cron-Secret: ${CLOSE_SWEEPER_SECRET}`. Response body is checked for `.success == true` AND `has("swept")` via `jq -e`.
- `dependabot.yml` configures weekly Monday PRs for both `npm` and `github-actions` ecosystems with grouped minor-and-patch updates. This is not just supply-chain hygiene — it is the documented Pitfall 2 mitigation (weekly commits reset the 60-day scheduled-workflow inactivity clock).

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-executor requirement):

1. **Task 1: deploy-edge-functions.yml** — `8430f5b` (feat)
2. **Task 2: cron-sweep.yml** — `f26fb1a` (feat)
3. **Task 3: dependabot.yml** — `059c9e3` (feat)

Per parallel-worktree protocol, this executor does NOT update STATE.md or ROADMAP.md — the orchestrator owns those. No `docs(...): complete plan` metadata commit is created by this agent; the orchestrator does that after merging the worktree.

## Files Created/Modified

- `.github/workflows/deploy-edge-functions.yml` — push-to-main EF deploy of all 15 functions via `--use-api` (30 lines)
- `.github/workflows/cron-sweep.yml` — daily 03:00 UTC sweep with dual-header auth + jq body validation (58 lines)
- `.github/dependabot.yml` — weekly Monday grouped PRs for npm + github-actions (33 lines)

## Decisions Made

- **HIGH #3 compliance:** Both headers sent on cron POST, response body validated via `jq -e` (whitespace-tolerant) rather than `grep '"success":true'` which would fail on pretty-printed output.
- **Comment placement:** The phrase `continue-on-error` appears exactly once in `cron-sweep.yml` — in an explanatory comment (`# NO continue-on-error — we want GH's default email-on-failure to fire (D-03).`). It is NOT a YAML key. `grep -E '^\s*continue-on-error\s*:'` against the file returns empty, confirming the D-03 intent.
- **`--use-api` flag:** Used in deploy workflow per Pitfall 9; avoids Docker socket race when deploying multiple EFs in parallel.

## Deviations from Plan

None — plan executed exactly as written. All three workflow files match the canonical YAML in 05-RESEARCH.md Patterns 1, 2, and 10 with the HIGH #3 response-body validation layered into Task 2 per 05-REVIEWS.md.

## Issues Encountered

- **System `python3` lacks PyYAML** — the acceptance criteria invoked `python3 -c "import yaml; yaml.safe_load(...)"` but PyYAML is not installed in the worktree environment. Resolved by using `node -e "const yaml=require('js-yaml'); yaml.load(...)"` instead. All three YAML files parse cleanly under js-yaml, which is a strictly valid alternative validator (both libraries implement YAML 1.1/1.2). No semantic change to the artifacts.

## User Setup Required

This plan produces artifacts only. User setup (GitHub repo secrets) happens in Plan 05-08 (cutover). Secrets that MUST be provisioned before the workflows can succeed:

- `SUPABASE_ACCESS_TOKEN` — for deploy-edge-functions.yml
- `SUPABASE_PROJECT_REF` — for deploy-edge-functions.yml
- `SUPABASE_URL` — for cron-sweep.yml
- `CLOSE_SWEEPER_SECRET` — for cron-sweep.yml (handler gate)
- `SUPABASE_ANON_KEY` — for cron-sweep.yml (gateway verify_jwt; added in this plan per HIGH #3)

No secrets are needed for dependabot.yml — GitHub manages Dependabot tokens internally.

## Next Phase Readiness

- Plan 05-08 (cutover) can now reference these workflow files for the secrets-provisioning checklist. The full secret list for GH repo settings now includes `SUPABASE_ANON_KEY` (previously missing before HIGH #3 review).
- Plan 05-09 (validation) has three falsifiable surfaces to check: `gh workflow view` for each file, a manual `workflow_dispatch` trigger of cron-sweep.yml after secrets are set, and a post-merge confirmation that Dependabot opens at least one PR within a week.
- All tripwires green: no `npm install` in deploy workflow, no midnight cron, no `continue-on-error` YAML key in cron workflow, no secret echoed to logs, CLI pinned.

## Self-Check: PASSED

- `.github/workflows/deploy-edge-functions.yml`: FOUND (commit `8430f5b`)
- `.github/workflows/cron-sweep.yml`: FOUND (commit `f26fb1a`)
- `.github/dependabot.yml`: FOUND (commit `059c9e3`)
- All three YAML files parse via js-yaml
- All acceptance-criteria grep checks pass (with documented comment-only "continue-on-error" false-positive rejected by `grep -E '^\s*continue-on-error\s*:'`)

---
*Phase: 05-launch-hardening*
*Plan: 07*
*Completed: 2026-04-19*
