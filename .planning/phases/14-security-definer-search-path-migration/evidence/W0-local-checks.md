# W0 — local check evidence

**Captured:** 2026-05-17
**Branch:** gsd/phase-14-security-definer-search-path-migration

## CHECK 2 — Extension-function body audit

Grep over the 4 authoritative migration files for `gen_random_uuid`, `uuid_generate_v4`, `::citext`, `citext(`:

```
$ grep -nE 'gen_random_uuid|uuid_generate_v4|::citext|citext\(' \
    supabase/migrations/00000000000002_triggers.sql \
    supabase/migrations/00000000000003_guild_membership.sql \
    supabase/migrations/00000000000004_fix_trigger_rpc_context.sql \
    supabase/migrations/00000000000009_admin_integrity_rls.sql
# (no output — exit 1)
```

Result: **CLEAN** — zero matches. Task 01 bodies do not need `extensions.` prefixing.

Grep over the 3 admin/profile migrations for bare `uid()` (without `auth.` prefix):

```
$ grep -nE '(^|[^.])uid\(\)' \
    supabase/migrations/00000000000003_guild_membership.sql \
    supabase/migrations/00000000000004_fix_trigger_rpc_context.sql \
    supabase/migrations/00000000000009_admin_integrity_rls.sql
# (no output — exit 1)
```

Result: **CLEAN** — all `uid()` references already qualified with `auth.`.

## CHECK 4 — Local stack reachability

```
$ npx supabase db reset --local
… (migrations 00 → 13 applied cleanly)
Seeding data from supabase/seed.sql...
Restarting containers...
Finished supabase db reset on branch gsd/phase-14-security-definer-search-path-migration.
EXIT_CODE=0
```

Result: **OK** — local stack healthy, all 14 pre-Phase-14 migrations apply cleanly.

## CHECK 5 — Fixture directories

```
$ mkdir -p tests/sql .planning/phases/14-security-definer-search-path-migration/evidence
$ ls -d tests/sql .planning/phases/14-security-definer-search-path-migration/evidence
.planning/phases/14-security-definer-search-path-migration/evidence
tests/sql
```

Result: **READY**.

## Pending production-side checks

The following require Supabase Studio SQL editor access (or `npx supabase login` + `npx supabase link --project-ref cbjspmwgyoxxqukcccjr` in an interactive shell):

- **CHECK 1** — rls_auto_enable ownership query (decides R1/R2/R3)
- **CHECK 1B** — update_profile_after_auth overload enumeration (decides U1/U2/U3)
- **CHECK 3** — pre-deploy functiondef snapshot for 6 (or 7) target functions

See parent PLAN.md `<task id="14-01-W0">` for the exact SQL.
