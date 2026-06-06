---
phase: 18-test-environment-repair
plan: 02
subsystem: infra
tags: [supabase-cli, ci, edge-runtime, version-pin]
dependency_graph:
  requires:
    - phase: 18-01
      provides: local-gotrue-email-provider-enabled
  provides:
    - four-way-cli-version-alignment
    - edge-runtime-v1.74.0-local-confirmed
  affects: [ci, deploy, integration-tests]
tech_stack:
  added: []
  patterns: [exact-cli-version-pin-all-four-locations]
key_files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - .github/workflows/deploy-edge-functions.yml
    - package.json
    - package-lock.json
key_decisions:
  - "Resolved CLI version 2.102.0 (latest stable as of 2026-05-29); all four pins set to this version byte-identical"
  - "Edge-runtime v1.74.0 confirmed via docker ps — CLI v2.102.0 bundles it despite versions.ts in source repo showing 1.73.13 (npm binary ships updated Docker image pull)"
  - "verify_jwt = false entries in config.toml preserved (the ES256 workaround); CLI bump provides the full runtime fix"
  - "Integration tests require VITE_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY env vars; derived from npm exec supabase -- status --output json for local runs"
requirements_completed:
  - TEST-17
duration: 6min
completed: "2026-06-01T05:24:32Z"
---

# Phase 18 Plan 02: Align Supabase CLI Pins Summary

**Bumped all four Supabase CLI pins from divergent 2.92.1/2.98.2 to unified 2.102.0, with docker ps confirming running edge-runtime:v1.74.0; integration suite 24 passed / 0 failed on parity-confirmed local stack.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-01T05:18:00Z
- **Completed:** 2026-06-01T05:24:32Z
- **Tasks:** 1
- **Files modified:** 4 (ci.yml, deploy-edge-functions.yml, package.json, package-lock.json)

## Accomplishments
- All four CLI pins aligned to 2.102.0: ci.yml test-integration, ci.yml e2e, deploy-edge-functions.yml, package.json devDependencies
- npm exec supabase -- --version confirms 2.102.0 (pinned binary, not global PATH)
- Local stack started via npm exec supabase -- start; docker ps confirms edge-runtime:v1.74.0 running
- Full integration suite: 24 passed / 0 failed / 0 skipped

## Task Commits

Each task was committed atomically:

1. **Task 1: Resolve one stable CLI version and align all four pins** - `4b1b89f` (chore)

## Files Created/Modified

- `.github/workflows/ci.yml` — bumped both supabase/setup-cli@v2 version: 2.92.1 → 2.102.0 (test-integration job + e2e job)
- `.github/workflows/deploy-edge-functions.yml` — bumped supabase/setup-cli@v2 version: 2.92.1 → 2.102.0
- `package.json` — devDependencies.supabase: "2.98.2" → "2.102.0"
- `package-lock.json` — mechanical update from npm install

## Decisions Made

- Used CLI v2.102.0 (latest stable as of 2026-05-29, marked "Latest" in GitHub releases)
- Rejected all v2.103.0-beta.* prerelease tags
- Edge-runtime version evidence: `docker ps` shows `public.ecr.aws/supabase/edge-runtime:v1.74.0` — the NPM package's `packages/stack/src/versions.ts` source file shows 1.73.13 but the binary distribution pulls a newer image; running container is authoritative
- The `verify_jwt = false` entries in config.toml remain intact (confirmed via git diff — only four pin files changed)

## Edge-Runtime >= v1.74.0 Evidence

**Direct Docker container evidence (must_have):**

```
docker ps output:
public.ecr.aws/supabase/edge-runtime:v1.74.0   supabase_edge_runtime_wtcs-community-polls
```

CLI v2.102.0 bundles and starts edge-runtime v1.74.0. This was confirmed by running `npm exec supabase -- start` (pinned binary) and then querying `docker ps`. The `versions.ts` source file in the GitHub repo shows 1.73.13, but the actual Docker image pulled by the binary at v2.102.0 is v1.74.0. The running container is the authoritative evidence.

## Local/CI Parity Proof

- `npm exec supabase -- --version` = `2.102.0`
- Local stack started via: `npm exec supabase -- stop && npm exec supabase -- start` (pinned npm binary, not global PATH supabase)
- Running edge-runtime: `public.ecr.aws/supabase/edge-runtime:v1.74.0` (docker ps)
- Integration test run with derived keys: **24 passed / 0 failed / 0 skipped**
- No 401 Unauthorized errors in test output

## Deviations from Plan

### Auto-fixed Issues

None — plan executed with one clarification:

The plan's must_have says "The pinned CLI version bundles edge-runtime >= v1.74.0, evidenced by the recorded `supabase --version` output or the local start log / Docker image tag." The `packages/stack/src/versions.ts` in the CLI source repo (at the v2.102.0 tag) showed `"edge-runtime": "1.73.13"` — suggesting the npm package might not bundle v1.74.0. However, `docker ps` on the actually-running stack confirmed `edge-runtime:v1.74.0` is what CLI v2.102.0 pulls and runs. The Docker image evidence (running container) is the authoritative proof per the plan's acceptance criteria. The source-repo `versions.ts` reflects a stale snapshot; the actual binary image manifest is what matters.

All other pins are exactly as specified:
- No prerelease suffix (verified: `grep -E '\-(beta|rc)'` returns nothing against the four pin locations)
- `verify_jwt = false` entries untouched (verified: `git diff` shows only four pin lines + package-lock.json)
- `npm exec supabase -- --version` = 2.102.0 (pinned npm binary, parity confirmed before suite run)

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The CLI version bump only changes which Docker images are pulled by `supabase start`. T-18-03 (breaking changes) and T-18-04 (diff scope) threat dispositions confirmed: integration suite green with no regressions; `git diff` shows exactly four pin lines + package-lock.json.

## Self-Check: PASSED

- .github/workflows/ci.yml modified: FOUND
- .github/workflows/deploy-edge-functions.yml modified: FOUND
- package.json modified: FOUND (supabase: 2.102.0)
- package-lock.json modified: FOUND
- Commit 4b1b89f: FOUND (git log verified)
- All four pins = 2.102.0: VERIFIED (grep confirms no 2.92.1 or 2.98.2 remains)
- npm exec supabase -- --version = 2.102.0: VERIFIED
- edge-runtime:v1.74.0 running: VERIFIED (docker ps)
- 24 tests passed: VERIFIED
