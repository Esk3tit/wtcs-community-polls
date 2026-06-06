---
phase: 18-test-environment-repair
plan: 01
subsystem: test-environment
tags: [config, gotrue, integration-tests, test-env-repair]
dependency_graph:
  requires: []
  provides: [local-gotrue-email-provider-enabled, vote-counts-rls-test-green]
  affects: [e2e/integration/vote-counts-rls.test.ts, supabase/config.toml]
tech_stack:
  added: []
  patterns: [supabase-config-toml-auth-email-section]
key_files:
  created: []
  modified:
    - supabase/config.toml
decisions:
  - "Added [auth.email] section with enable_signup=true + enable_confirmations=false to fix GOTRUE_EXTERNAL_EMAIL_ENABLED=false default; local-only (production uses Discord OAuth exclusively)"
metrics:
  duration: "3m 9s"
  completed: "2026-06-01T05:15:02Z"
  tasks_completed: 1
  files_modified: 1
requirements_completed:
  - TEST-18
---

# Phase 18 Plan 01: Add [auth.email] to config.toml Summary

**One-liner:** Added `[auth.email]` TOML section setting `enable_signup=true`/`enable_confirmations=false` to fix `GOTRUE_EXTERNAL_EMAIL_ENABLED=false` default that caused `email_provider_disabled` errors in the integration suite — `vote-counts-rls.test.ts` 13 PASS / 0 FAIL.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add [auth.email] section to config.toml | bc7f326 | supabase/config.toml |

## Verification Results

- `vote-counts-rls.test.ts` — 13 PASS / 0 FAIL / 0 skip (12 RLS matrix cells + 1 admin JWT regression)
- No `AuthApiError: Email logins are disabled` / `email_provider_disabled` in output
- Exit code: 0
- `[functions.*] verify_jwt = false` blocks unchanged (git diff confirms only `[auth.email]` block added)
- Exactly 1 `[auth.email]` section (`grep -c '^\[auth.email\]' supabase/config.toml` = 1)
- Fixture seed re-applied after stack restart; `signInWithPassword` succeeds for fixture users

## Deviations from Plan

None — plan executed exactly as written. The edit was applied to the worktree's `supabase/config.toml` (committed to the worktree branch), and separately applied to the main project's working-tree copy so the running local Supabase stack could be restarted with the new config for test verification. The worktree edit will reach the main project's HEAD when the orchestrator merges the worktree branch.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `[auth.email]` config change affects the local Supabase gotrue container only — the production Supabase project is not linked and `supabase config push` is not run as part of this plan's closeout workflow. T-18-01 threat accepted per plan threat model.

## Self-Check: PASSED

- supabase/config.toml modified: FOUND
- Commit bc7f326 present: FOUND (git log verified)
- [auth.email] count = 1: VERIFIED
- vote-counts-rls.test.ts 13 PASS: VERIFIED
