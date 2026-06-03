---
phase: 19-db-migration-a11y-restore
plan: "03"
subsystem: database
tags:
  - db-migration
  - security
  - integration-test
  - smoke-e2e
  - DBHY-05
dependency_graph:
  requires:
    - "supabase/migrations/00000000000015_trusted_profile_update_guc.sql"
    - "e2e/integration/profile-trigger-gate.test.ts"
  provides:
    - "Migration 15 applied to LOCAL Supabase stack (apply confirmed)"
  affects:
    - "public.profile_self_update_allowed (live local DB function)"
    - "public.update_profile_after_auth (live local DB function)"
tech_stack:
  added: []
  patterns:
    - "Local-only apply + lint (same target) for phase closure; prod --linked deploy deferred to milestone ship"
key_files:
  created: []
  modified: []
decisions:
  - "Used `supabase migration up --local` (running local stack) — no project link required; lint run against same local target (no local-apply/linked-lint mismatch)"
  - "Task 1 human-action checkpoint (start stack + export keys) satisfied by orchestrator: local CLI is node_modules/.bin/supabase v2.102.0, Docker running, stack already up"
  - "Phase 19 closure proves LOCAL apply only; production --linked push remains a milestone-ship step (CONTEXT.md: no live users, ships in normal order) — SC2 prod half NOT marked satisfied"
metrics:
  duration: "~8m (orchestrator-driven)"
  completed_date: "2026-06-03T21:13:18Z"
  tasks_completed: 4
  files_created: 0
  files_modified: 0
requirements:
  - DBHY-05
---

# Phase 19 Plan 03: Apply Migration 15 to Local Stack + Verify Summary

**One-liner:** Migration 15 applied to the local Supabase stack, advisor lint clean, DBHY-05 gate proven green in both directions against the live DB, and submit-vote smoke round-trip unaffected.

## What Was Done

### Task 1: Local stack ready (checkpoint:human-action)

`supabase status` confirmed the local stack running (Studio `http://127.0.0.1:54323`, API `http://127.0.0.1:54321`, DB `54322`). Docker daemon running. CLI resolved to local devDependency `node_modules/.bin/supabase` v2.102.0. Stack keys (`API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`) exported to the run session for the integration suite — fresh from `supabase status -o json`, avoiding the stale-`.env.local` false-failure trap.

### Task 2: Migration 15 applied + advisor lint (auto)

`supabase migration up --local` applied `00000000000015_trusted_profile_update_guc.sql` (exit 0). `supabase migration list --local` confirmed `00000000000015` present in the local migrations set. `supabase db lint --level warning` (same local target) reported **"No schema errors found"** — the `0011_function_search_path_mutable` WARN did **not** reappear for `profile_self_update_allowed` or `update_profile_after_auth` (the `SET search_path = ''` on both functions prevents it). Push target = lint target = local (no mismatch).

### Task 3: Integration tests (auto)

`npm run test:integration` — **32/32 PASS across 4 files**, exit 0:

- `profile-trigger-gate.test.ts` — **6/6 PASS** (DBHY-05 regression proof):
  - (a)(b)(c) direct authenticated UPDATE to `mfa_verified` / `is_admin` / `guild_member` — all rejected by trigger
  - (d) direct authenticated UPDATE to `discord_username` (non-protected) — allowed
  - (e) `update_profile_after_auth` RPC ordered proof (flip → call → read-back) — protected columns actually commit via GUC bypass
  - (f) GUC-leak guard — transaction-local flag does not persist after RPC completes
- `vote-counts-rls.test.ts` — **13/13 PASS** (12-cell anon/authed/serviceRole × hidden × voted matrix + admin no-bypass) — no regression from the migration's `afterAll`/`beforeEach` cleanup
- `create-poll-results-hidden.test.ts` — 6/6 PASS
- `toggle-results-visibility.test.ts` — 7/7 PASS

### Task 4: Smoke E2E (checkpoint:human-verify)

`npx playwright test --config e2e/playwright.config.ts --grep @smoke` — **6/6 PASS** (26.5s), exit 0. Includes both submit-vote round-trips: `browse-respond` ("user browses topics, responds, sees live results") and `results-visibility` ("admin creates, voter votes, admin hide/show roundtrip end-to-end", 17.2s). Migration 15 touches only the profile-update trigger path, not vote submission — confirmed no regression.

## Deviations from Plan

- **Task 1 driven by orchestrator, not the user.** The plan framed Task 1 as a human-action checkpoint because the `supabase` CLI was assumed to live only in the user's interactive shell. It is in fact available as a project devDependency (`node_modules/.bin/supabase`), and Docker + the local stack were already up, so the orchestrator completed all four tasks directly. User explicitly authorized this ("you do all of it for me").
- **`migration up` over `db push`.** Plan offered either; used `supabase migration up --local` against the running local stack (the plan's stated preferred local-apply command). Lint kept on the same local target as required.

## Scope Boundary (SC2)

Phase 19 closure proves the **LOCAL** apply + lint + integration + smoke. The production (`--linked`) deploy is a normal milestone-ship step (CONTEXT.md: no live users, ships in standard deploy order). The SC2 prod-deploy half is **explicitly deferred** and is NOT marked satisfied by this local apply.

| Item | Phase 19 status |
|------|-----------------|
| Local migration applied | DONE (Phase 19 closure) |
| Prod (`--linked`) migration applied | DEFERRED to milestone ship |

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes beyond Migration 15 (created in Plan 01, threat-modeled there). T-19-09 (gate correctness) is now proven by the live integration run; T-19-10 (advisor WARN regression) confirmed clean by the local lint. No new threat flags.

## Self-Check: PASSED

Migration 15 applied to local DB (confirmed via `migration list`). Lint clean. Integration 32/32 green, smoke 6/6 green. No source files created/modified by this plan (verification-only plan).
