---
phase: 11-schema-rls-ef-foundations
plan: 06-followup
subsystem: database
tags: [supabase, migration, edge-functions, code-review-fix-deploy, audit-log, fk-hardening]

requires:
  - phase: 11-05
    provides: original Phase 11 ship (migration 10 + 13 EFs deployed)
  - phase: 11-code-review
    provides: 14 fix commits closing 5 Warning + 7 Info findings across 3 iterations
provides:
  - migration 11 applied to prod (audit_log_actor_id_fkey ON DELETE SET NULL + audit_log_target_id_shape CHECK constraint)
  - 8 EFs redeployed with code-review-fix source (toggle-results-visibility v2, update-poll v6, close-expired-polls v7, close-poll v6, delete-category v6, delete-poll v6, rename-category v6, create-poll v6)
affects: []

tech-stack:
  added: []
  patterns: [forward-only schema hardening migration with DROP IF EXISTS + ADD discipline]

key-files:
  created: []
  modified: []

key-decisions:
  - "audit_log.actor_id FK switched from ON DELETE NO ACTION (default) to ON DELETE SET NULL. This unblocks admin profile deletion while preserving audit row immutability — the actor_id becomes NULL (matching the cron-actor-null convention from close-expired-polls), keeping the row as a forensic tombstone."
  - "audit_log.target_id remains TEXT (no hard FK possible — admits both UUIDs and Discord snowflakes). Polymorphic FK isn't supported by Postgres. Instead, a CHECK constraint enforces shape: standard 8-4-4-4-12 UUID (case-insensitive via ~*), Discord snowflake (17-19 digits, ~), or NULL. Junk writes fail fast; well-formed writes succeed regardless of UUID case."
  - "Smoke-tested both directions: uppercase UUID, lowercase UUID, snowflake, and NULL all admitted; junk 'not-a-uuid' rejected by CHECK (raises check_violation)."

patterns-established:
  - "Schema hardening as a follow-up migration: DO NOT modify the originally-applied migration file (creates local/prod drift). Instead, write a forward-only migration N+1 with DROP IF EXISTS + ADD discipline so the new constraints are idempotent against any DB state."

requirements-completed: []  # All Phase 11 requirements closed in 11-05; this followup is hygiene only.

duration: ~15 min (apply migration 11 + 8 EF redeploys + smoke + advisor scan)
completed: 2026-05-11
---

# Phase 11 — Code Review Fix Deploy Followup

**Migration 11 (audit_log FK + CHECK hardening) applied to prod + 8 EFs redeployed with code-review-fix source. Closes the code-review loop end-to-end: branch fixes are now reflected in production runtime.**

## What landed in prod

### Migration

- `audit_log_fk_hardening` registered in `supabase_migrations.schema_migrations`
- `audit_log.actor_id` FK now `ON DELETE SET NULL` (was NO ACTION)
- `audit_log.target_id` now has CHECK constraint `audit_log_target_id_shape` admitting UUID (case-insensitive) / snowflake / NULL
- `COMMENT ON COLUMN public.audit_log.target_id` explains the no-FK + CHECK design

### Edge Functions redeployed

| EF | Old → New | Code-review findings closed |
|---|---|---|
| `toggle-results-visibility` | v1 → v2 | I-01 (.not→.neq) + F-02 (stale comment) |
| `update-poll` | v5 → v6 | I-02 (audit `before` snapshot enrichment) |
| `close-expired-polls` | v6 → v7 | I-03 (audit `after.closed_at` enrichment) |
| `close-poll` | v5 → v6 | I-04 (audit `after.closed_at` enrichment) |
| `delete-category` | v5 → v6 | I-05 (before-snapshot enrichment) |
| `delete-poll` | v5 → v6 | I-05 (before-snapshot enrichment) |
| `rename-category` | v5 → v6 | I-05 (before-snapshot enrichment) |
| `create-poll` | v5 → v6 | W-02 (compensation audit breadcrumb) + F-01 (stale test comment) |

All 8 EFs deployed with `verify_jwt = false` (matches prod baseline). All 8 passed OPTIONS preflight from `https://polls.wtcsmapban.com` immediately after deploy.

## Verification

### Migration 11 — schema gates (one consolidated `execute_sql`)

| Gate | Result |
|---|---|
| `migration_11_applied` | ✓ true |
| `actor_fk_on_delete_set_null` (`confdeltype = 'n'`) | ✓ true |
| `check_is_case_insensitive` (qual contains `~*`) | ✓ true |
| `phase_11_migrations_count` (10 + 11 both present) | 2 |
| `leftover_smoke_rows` | 0 |
| `total_migrations` | 12 (10 pre-existing + migration 10 + migration 11) |

### Migration 11 — behavior smoke (insert + check + delete)

- Uppercase UUID (`6ABA5218-A89B-4EC6-9E09-A06F6E6C4FF4`): accepted ✓
- Lowercase UUID: accepted ✓
- Snowflake (`123456789012345678`): accepted ✓
- NULL: accepted ✓
- Junk (`'not-a-uuid'`): **rejected with check_violation** (smoke caught via PL/pgSQL DO block raising NOTICE on the expected check_violation)
- All 4 valid smoke rows cleaned up via DELETE; 0 leftover

### EF redeploy — sanity

- All 8 EFs status `ACTIVE`
- All 8 EFs `verify_jwt: false`
- All 8 EFs returned 200 on OPTIONS preflight from `https://polls.wtcsmapban.com`
- New version numbers match expected v+1 across the board

### Advisors

`get_advisors(security)` post-deploy: **23 WARN-level findings, all pre-existing** (same as the post-original-ship scan in `11-05-SUMMARY.md`). **Zero new findings caused by migration 11 or the 8 EF redeploys.**

Pre-existing tech debt unchanged:
- `function_search_path_mutable` × 6 (pre-v1.0 functions)
- `anon_security_definer_function_executable` × 7 (pre-v1.0 SECURITY DEFINER functions)
- `authenticated_security_definer_function_executable` × 7 (same set under authenticated role)
- `auth_leaked_password_protection` × 1 (auth setting, project-level)

## Decisions Made

- **Forward-only migration 11** rather than mutating migration 10. Migration 10 is already in `schema_migrations`; modifying its file would create local/prod drift. Migration 11 uses `DROP IF EXISTS + ADD` discipline so re-application is safe.
- **CHECK over FK** for `target_id`. A polymorphic FK isn't possible. The CHECK gives fail-fast on writer bugs while preserving the "forensic survives parent delete" property that test cleanup already relies on.
- **NULL admitted** for `target_id`. The cron-actor-null convention from `close-expired-polls` keeps the column extensible to future "sweep target" writes that have no single target row.

## Outstanding (post-followup)

The code-review loop's **one deliberate deferral remains**:
- **I-08** (migration 10 `IF NOT EXISTS` defensive coding gap): cannot be fixed without modifying the applied migration 10 file. Defensive-only gap; migration registry catches re-application in practice. Not a runtime bug.

No other Phase 11 follow-ups outstanding.

## Production state snapshot (after this followup)

- **Migrations**: 12 total (pre-existing 00–09 + migration 10 `results_hidden_audit` + migration 11 `audit_log_fk_hardening`)
- **Edge Functions**: 17 total (3 unrelated to Phase 11 unchanged; 14 in Phase 11 scope — toggle-results-visibility v2 + 12 retrofitted, all current with branch source)
- **Schema invariants**: results_hidden default = false; vote_counts policy = strict voter+hidden=false AND (no admin-OR); polls_effective with security_invoker=on projecting new columns; audit_log RLS admin-only SELECT, target_id CHECK shape-enforced, actor_id FK ON DELETE SET NULL

Phase 11 + code-review loop is fully closed.

---
*Phase: 11-schema-rls-ef-foundations*
*Followup completed: 2026-05-11*
