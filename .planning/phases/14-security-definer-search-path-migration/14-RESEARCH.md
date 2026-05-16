# Phase 14: Security-Definer Search-Path Migration — Research

**Researched:** 2026-05-16
**Domain:** Postgres SECURITY DEFINER function hardening, Supabase migration patterns, RLS integrity
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Submit-vote smoke = production cast-a-vote (admin signs in on polls.wtcsmapban.com, votes on a non-prod-impact test poll, watches result land).
- **D-02:** TEST-11 12-cell RLS matrix re-run is automated — existing test file, no new test code.
- **D-03:** PR evidence artifact = TEST-11 pass output pasted into SUMMARY.md + Supabase Studio screenshot confirming the vote row landed in `vote_counts`.
- **D-04:** `supabase db lint --linked` runs twice — once locally before merge, once post-deploy.
- **D-05:** DBHY-04 edit target = `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-PATTERNS.md` (edit-in-place; not frozen).
- **D-06:** DBHY-04 edit form = replace legacy admin-OR-bypass prose with shipped REVIEW-FIX-H3 form + single-line changelog note at top: `Updated 2026-05-16 (Phase 14, DBHY-04) — original form had admin-OR drift; see REVIEW-FIX-H3.`
- **D-07:** Two-commit PR split: `feat(db): migration 14 — security definer search_path lockdown` + `docs(11-patterns): align vote_counts skeleton with shipped REVIEW-FIX-H3 form`.
- **D-08:** Rollback = fix-forward via Supabase Studio `CREATE OR REPLACE`. No paired rollback migration.
- **D-09:** Local `supabase start` replay required before merging.
- **D-10:** Deploy timing = any time (no maintenance window needed; `CREATE OR REPLACE` is atomic per-function).
- **D-11:** Migration filename = `00000000000014_harden_security_definer_search_path.sql`.
- **7 target functions** (upstream lock): `update_profile_after_auth`, `handle_new_user`, `validate_vote_choice`, `increment_vote_count`, `is_current_user_admin`, `profile_self_update_allowed`, `rls_auto_enable`.
- **`CREATE OR REPLACE FUNCTION`** (not `ALTER FUNCTION`) for OID stability across trigger references.
- **`increment_vote_count`** body: `INSERT INTO vote_counts` → `INSERT INTO public.vote_counts` (CONTEXT.md says bare reference; see CRITICAL FINDING below).
- **`is_current_user_admin()`** rewrite MUST be body-identical (only `search_path` value changes `public` → `''`).

### Claude's Discretion

- Exact SQL formatting of the 7 `CREATE OR REPLACE FUNCTION` blocks (order, comment blocks, header style).
- Whether the PR description includes a function-body diff table or just cites the migration file.
- Whether body-identical claim for `is_current_user_admin()` is proved via a CI grep / `pg_get_functiondef` snapshot or by manual inspection.

### Deferred Ideas (OUT OF SCOPE)

- Paired rollback migration 15.
- CI-based `supabase db lint` check.
- Moving `11-PATTERNS.md` out of the archive directory.
- Net-new v1.3-scoped RLS matrix test.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DBHY-01 | Migration 14 `CREATE OR REPLACE FUNCTION` for all 7 pre-Phase-11 `SECURITY DEFINER` functions with `SET search_path = ''` and fully-qualified body references | Section: Function Body Audit; Standard Stack; Architecture Patterns |
| DBHY-02 | `supabase db lint --linked` reports zero `0011_function_search_path_mutable` WARNs after Migration 14 deploys | Section: Verification Commands; Environment Availability |
| DBHY-03 | `submit-vote` smoke round-trip passes after deploy; TEST-11 12-cell RLS matrix re-run confirms `is_current_user_admin()` body-identical claim | Section: TEST-11 location; smoke-test path |
| DBHY-04 | `11-PATTERNS.md` `vote_counts` policy skeleton aligned with shipped REVIEW-FIX-H3 form; doc-only fix | Section: DBHY-04 State Analysis |

</phase_requirements>

---

## Summary

Phase 14 is a surgical Postgres hardening migration. Seven pre-Phase-11 `SECURITY DEFINER` functions were created before the project standardised on `SET search_path = ''`, and the Supabase security advisor flags them all as `0011_function_search_path_mutable` WARNs. The fix is a single migration (`00000000000014_harden_security_definer_search_path.sql`) containing seven `CREATE OR REPLACE FUNCTION` statements — one per function — that add `SET search_path = ''` and confirm all body references are schema-qualified.

There is one CRITICAL FINDING that supersedes the CONTEXT.md and REQUIREMENTS.md assumption about `increment_vote_count`: **the body in migration 2 already uses `INSERT INTO public.vote_counts`** (fully qualified). The prior research that flagged a bare `INSERT INTO vote_counts` was wrong. This means the `increment_vote_count` body rewrite, as described in the locked decisions, is **not actually required** — the body is already safe for `search_path = ''`. Migration 14 can add `SET search_path = ''` to `increment_vote_count` without any body change.

There is also a FINDING on `rls_auto_enable`: this function does not exist in any on-disk migration file. It is almost certainly a Supabase platform system function, not a user-created function. The planner must gate on a dashboard/`supabase db dump` verification step before writing the Migration 14 SQL — if `rls_auto_enable` is a system function, it is not writable by user migration and the effective target count is 6, not 7.

DBHY-04 is narrower than described in CONTEXT.md: the SQL code block in `11-PATTERNS.md` already shows the correct REVIEW-FIX-H3 form (commit 73fb2c2 fixed it in May 2026). The remaining drift is confined to the **prose description at line 83** which still references "the v1.0.5 admin-bypass policy in `migrations/00000000000005_admin_phase4.sql:75-88` (whichever is current)" — implying the admin-OR form might still be live. The fix is prose-only, not a SQL block replacement.

**Primary recommendation:** Write Migration 14 as 7 atomic `CREATE OR REPLACE FUNCTION` blocks following the `SET search_path = ''` pattern established in migrations 07, 08, 09, 12, 13. Perform a local `supabase db reset` replay before pushing. Gate Migration 14 execution on a one-step dashboard check to resolve the `rls_auto_enable` ambiguity.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `SET search_path = ''` on SECURITY DEFINER functions | Database / Storage | — | Postgres function attribute; lives in migration SQL, applied at DB layer |
| Body reference qualification (`public.<table>`) | Database / Storage | — | Body executed at DB layer; qualification is schema-resolution, not app logic |
| Advisor zero-WARN verification (DBHY-02) | Database / Storage | — | `supabase db lint` reads Postgres catalog; no frontend involvement |
| Submit-vote smoke test (DBHY-03) | API / Backend | Browser / Client | EF invoked from browser, trigger fires at DB layer |
| TEST-11 RLS matrix re-run (DBHY-03) | Database / Storage | — | Integration tests run supabase-js against a local/linked Postgres instance |
| `11-PATTERNS.md` doc fix (DBHY-04) | — (docs only) | — | Planning artifact; no code tier involvement |

---

## Function Body Audit

### Authoritative function state (latest migration that defines each function)

This table reflects what is actually on disk and therefore what is live in production after all migrations have applied. Where a function is redefined across multiple migrations, the **latest** definition is the authoritative one.

| Function | Last defined in | `SET search_path` currently | Body references safe for `search_path = ''`? | Notes |
|----------|----------------|-----------------------------|----------------------------------------------|-------|
| `update_profile_after_auth` | `00000000000003_guild_membership.sql` | None | YES — `UPDATE public.profiles … WHERE id = auth.uid()`. All refs qualified. | `auth.uid()` is schema-qualified via `auth.` prefix; safe. |
| `handle_new_user` | `00000000000002_triggers.sql` | None | YES — `public.admin_discord_ids`, `public.profiles` — all DML targets qualified. | `auth.uid()` not used inside; no bare table refs. |
| `validate_vote_choice` | `00000000000002_triggers.sql` | None | YES — `public.choices`, `public.votes` both qualified. | |
| `increment_vote_count` | `00000000000002_triggers.sql` | None | **YES — `INSERT INTO public.vote_counts` already fully qualified.** | **CRITICAL FINDING: REQUIREMENTS.md and CONTEXT.md state this uses bare `INSERT INTO vote_counts`. This is WRONG. The migration 2 body already has `INSERT INTO public.vote_counts`. No body rewrite needed — only add `SET search_path = ''`.** |
| `is_current_user_admin` | `00000000000009_admin_integrity_rls.sql` | `SET search_path = public` | YES — `public.profiles WHERE id = auth.uid()` — qualified. | Needs `search_path` changed from `public` to `''`; body stays identical. |
| `profile_self_update_allowed` | `00000000000004_fix_trigger_rpc_context.sql` | None | YES — no table DML inside body; only column comparisons on `NEW`/`OLD` trigger vars and `current_user`/`session_user` builtins. | `current_user` and `session_user` are Postgres session variables; they resolve regardless of `search_path`. |
| `rls_auto_enable` | **NOT FOUND in any on-disk migration** | Unknown | Unknown | **OPEN GAP: This function does not exist in migrations 0–13. It is listed in the Supabase advisor WARNs and in PROJECT.md as one of the 7 targets, but appears to be a Supabase platform system function, not a user function. Must be verified via `supabase db dump --schema=public` or the dashboard Function inspector before Migration 14 can be written. If it is a system function, Migration 14 targets 6 functions, not 7, and the advisor WARN for it cannot be cleared by user migration.** |

### `is_current_user_admin` — body-identical claim

Latest body (migration 9, authoritative):

```sql
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public      -- <-- change to '' only
AS $$
  SELECT COALESCE(
    (SELECT is_admin AND mfa_verified AND guild_member
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;
```

Migration 14 changes exactly one token: `SET search_path = public` → `SET search_path = ''`. Every other line — signature, return type, language, `STABLE`, body SQL — is copied verbatim. [VERIFIED: read from migration file]

### `increment_vote_count` — body as actually shipped

```sql
CREATE OR REPLACE FUNCTION public.increment_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.vote_counts (poll_id, choice_id, count)
  VALUES (NEW.poll_id, NEW.choice_id, 1)
  ON CONFLICT (poll_id, choice_id) DO UPDATE
  SET count = public.vote_counts.count + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Both the `INSERT INTO` target and the `ON CONFLICT … DO UPDATE SET count = public.vote_counts.count + 1` are already fully qualified. [VERIFIED: read from `00000000000002_triggers.sql` lines 172-188]

---

## Standard Stack

This phase is pure SQL migration + docs. No new packages are installed.

| Tool | Version | Purpose |
|------|---------|---------|
| Supabase CLI (npx) | 2.92.1 (via npx) | `supabase db lint --linked` for advisor WARN check |
| Vitest (integration config) | existing | TEST-11 re-run via `npm run test:integration` |
| Postgres `CREATE OR REPLACE FUNCTION` | Postgres 15+ (Supabase) | Atomic function rewrite preserving OID |

**No new packages to install.** This is a migration-only phase.

---

## Package Legitimacy Audit

Not applicable — no new packages installed in this phase.

---

## Architecture Patterns

### `SET search_path = ''` form — established project convention

Migrations 07, 08, 09, 12, 13 all use `SET search_path = public` or `SET search_path = ''`. The Supabase-recommended form for maximum security hardening is `SET search_path = ''` (empty). Migration 14 uses `''` (empty) for all 7 functions, matching the advisor requirement.

**Why `CREATE OR REPLACE` not `ALTER FUNCTION`:**

`ALTER FUNCTION public.f() SET search_path = ''` changes the function's `search_path` attribute but does NOT update the body. If a body reference is unqualified (e.g., `INSERT INTO vote_counts` without `public.`), ALTER FUNCTION leaves the body broken. `CREATE OR REPLACE FUNCTION` rewrites both the body and the attribute in a single atomic statement. Additionally, `CREATE OR REPLACE` preserves the function OID — triggers like `on_vote_inserted` reference the function by OID, not by name; a DROP+CREATE would break trigger references. [CITED: Postgres 15 docs — `CREATE OR REPLACE FUNCTION` preserves the OID of an existing function with the same name and argument types]

**Why OID matters for this phase:**

Migration 2 creates trigger `on_vote_inserted EXECUTE FUNCTION public.increment_vote_count()`. Trigger definitions store the OID of the target function. `CREATE OR REPLACE FUNCTION` preserves that OID; `DROP FUNCTION … CREATE FUNCTION` generates a new OID and orphans the trigger reference. [ASSUMED — standard Postgres behavior, not independently re-verified via official docs in this session]

### Migration file structure pattern

Following the style of migrations 07, 08, 09, 12, 13:

```sql
-- 00000000000014_harden_security_definer_search_path.sql
--
-- Adds SET search_path = '' to all 7 pre-Phase-11 SECURITY DEFINER
-- functions that were flagged by the Supabase security advisor
-- (0011_function_search_path_mutable). Uses CREATE OR REPLACE FUNCTION
-- to preserve OIDs (trigger references) and update bodies atomically.
--
-- Clears all 7 advisor WARNs. Verified locally via supabase db lint
-- before merge (D-04).

-- =====================================================================
-- FUNCTION 1: update_profile_after_auth
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_profile_after_auth(...)
...
SET search_path = ''
AS $$
...
$$;

-- [repeat for functions 2-7]
```

### Recommended migration section ordering

Order by risk (lowest risk functions first, highest risk last — makes it easier to bisect if something goes wrong during local testing):

1. `validate_vote_choice` — trigger, no body changes needed, no active call surface beyond trigger stack
2. `handle_new_user` — auth signup trigger, rarely fires during testing
3. `profile_self_update_allowed` — trigger with no table DML, safest possible body
4. `update_profile_after_auth` — RPC called by auth callback
5. `is_current_user_admin` — RLS policy function, gates 7+ tables; only `search_path` value changes
6. `increment_vote_count` — hot path trigger; body already safe, but test last in local validation sequence
7. `rls_auto_enable` — only include if confirmed user-owned on dashboard (see open gap)

### `profile_self_update_allowed` — body with `current_user`/`session_user` under `search_path = ''`

The function body uses `current_user = session_user` as a conditional. These are Postgres built-in session variables resolved via `pg_catalog`, not via `search_path`. They continue to work correctly with `search_path = ''`. [ASSUMED — standard Postgres behavior]

The trigger `WHEN (current_setting('role') = 'authenticated')` clause in migration 2's `CREATE TRIGGER` DDL is also fine — trigger WHEN clauses are resolved at DDL time, not at function execution time.

---

## DBHY-04 State Analysis

### What the CONTEXT.md says needs fixing

CONTEXT.md D-06: "replace the legacy admin-OR-bypass skeleton with the shipped REVIEW-FIX-H3 form".

### What is actually in the file today

**Current state of `11-PATTERNS.md` (as on disk after commit 73fb2c2 + archive commit bf6750b):**

The **SQL code block** at lines 85-101 already shows the correct REVIEW-FIX-H3 form — no `is_current_user_admin()` OR-bypass, only the voter EXISTS + results_hidden EXISTS clauses. [VERIFIED: read from file]

The **prose description at line 83** still contains drift:

> "DROP the v1.0 policy … and the v1.0.5 admin-bypass policy in `migrations/00000000000005_admin_phase4.sql:75-88` **(whichever is current)**."

The phrase "whichever is current" implies the admin-bypass form from migration 5 might still be current. It is not — migration 10 replaced it with the REVIEW-FIX-H3 form. This prose is the drift that DBHY-04 fixes.

**What the fix looks like:**

Replace the bolded prose at line 83 with language that:
1. States the shipped policy has NO admin-OR-bypass.
2. Names REVIEW-FIX-H3 as the decision.
3. Removes the "(whichever is current)" ambiguity.
4. Adds the D-06 changelog note at the top of the file.

**Scope:** Prose-only edit at line 83. The SQL block (lines 85-101) is already correct and must not change.

### REVIEW-FIX-H3 canonical location

The shipped vote_counts policy (confirmed at `supabase/migrations/00000000000010_results_hidden_audit.sql:130-155`):

```sql
DROP POLICY IF EXISTS "Vote counts visible to voters" ON public.vote_counts;
DROP POLICY IF EXISTS "Vote counts visible to voters or admin" ON public.vote_counts;

CREATE POLICY "Vote counts visible to voters when not hidden"
  ON public.vote_counts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.votes
      WHERE votes.poll_id = vote_counts.poll_id
        AND votes.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.polls
      WHERE polls.id = vote_counts.poll_id
        AND polls.results_hidden = false
    )
  );
```

No `is_current_user_admin()` call. No admin OR-branch. Service-role bypasses RLS automatically via Postgres contract. [VERIFIED: read from migration file]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Advisor WARN verification | Custom SQL query against pg_catalog | `supabase db lint --linked` | CLI reads the same advisor rules Supabase dashboard uses; single authoritative source |
| OID-safe function rewrite | DROP + CREATE | `CREATE OR REPLACE FUNCTION` | DROP breaks trigger OID references; CREATE OR REPLACE preserves them |
| Rollback migration | Paired down-migration | Studio `CREATE OR REPLACE` pasting prior body | Supabase migrations are forward-only; fix-forward is the project's established pattern (D-08) |

---

## Common Pitfalls

### Pitfall 1: Trusting the CONTEXT.md bare-reference claim for `increment_vote_count`

**What goes wrong:** Planner/executor adds a body change `INSERT INTO vote_counts` → `INSERT INTO public.vote_counts` believing the source migration has a bare reference. This creates unnecessary diff noise and risks a typo in a hot-path trigger.

**Why it happens:** The prior v1.3 FEATURES research (produced before Phase 14 was researched in depth) misread or misremembered the migration 2 body. The REQUIREMENTS.md and CONTEXT.md inherited that error.

**How to avoid:** The executor must read `supabase/migrations/00000000000002_triggers.sql` lines 172-188 directly before writing Migration 14. The INSERT target is already `public.vote_counts` — no body change needed. Only add `SET search_path = ''` between the `SECURITY DEFINER` line and the `AS $$` delimiter.

**Warning signs:** If a reviewer sees a body diff on `increment_vote_count` that adds `public.` to the INSERT target, flag it — the source was already qualified.

### Pitfall 2: Writing Migration 14 for `rls_auto_enable` without verifying it exists

**What goes wrong:** Migration 14 includes a `CREATE OR REPLACE FUNCTION public.rls_auto_enable()` block copied from somewhere, but the function doesn't exist as a user function in `public` schema. This either fails with "function does not exist" or accidentally redefines a system function.

**Why it happens:** `rls_auto_enable` is named in REQUIREMENTS.md and PROJECT.md as one of the 7 targets, but it is not found in migrations 0–13. It may be a Supabase platform function that lives in a system schema, not user-owned.

**How to avoid:** Before writing Migration 14, run one of:
- `supabase db dump --schema=public 2>/dev/null | grep -i rls_auto_enable` against a local stack
- Supabase dashboard → Database → Functions → filter by `rls_auto_enable`
- `npx supabase db dump --linked --schema=public | grep rls_auto_enable` against the linked project

If not found: Migration 14 contains 6 functions. If found with its body: include it and qualify any unqualified references.

**Warning signs:** Any `CREATE OR REPLACE FUNCTION public.rls_auto_enable` in the migration where the executor hasn't confirmed the body from a live source.

### Pitfall 3: `ALTER FUNCTION` instead of `CREATE OR REPLACE FUNCTION`

**What goes wrong:** `ALTER FUNCTION public.increment_vote_count() SET search_path = ''` changes the attribute but leaves the body as-is. Does not rewrite body references. Also, if the body had unqualified references, they would 42P01 at runtime — and with `ALTER FUNCTION`, there is no way to fix both the attribute and the body in one statement.

**How to avoid:** Always use `CREATE OR REPLACE FUNCTION` for Migration 14. This is a locked decision (CONTEXT.md; D-Phase-14 in PROJECT.md).

### Pitfall 4: Missing `SECURITY DEFINER` keyword in the rewrite

**What goes wrong:** `CREATE OR REPLACE FUNCTION` without `SECURITY DEFINER` silently drops the function's SECURITY DEFINER attribute, converting it to `SECURITY INVOKER`. Trigger functions and RLS functions immediately stop working as designed — `handle_new_user` can no longer write to `profiles` at auth time; `is_current_user_admin` can no longer bypass RLS.

**How to avoid:** Every `CREATE OR REPLACE FUNCTION` block in Migration 14 must include `SECURITY DEFINER`. Verify by grep after writing the migration: `grep -c "SECURITY DEFINER" 00000000000014_harden_security_definer_search_path.sql` must equal 6 (or 7 if `rls_auto_enable` is included).

### Pitfall 5: Forgetting to re-apply `STABLE` on `is_current_user_admin`

**What goes wrong:** `is_current_user_admin` is declared `STABLE` in migration 9 (allows Postgres to cache the result within a statement). If the `CREATE OR REPLACE` in Migration 14 omits `STABLE`, the function degrades to `VOLATILE`, which disables per-statement caching and incurs a profile SELECT on every row evaluated in a RLS policy. At low traffic this is unnoticeable; at query scale it matters.

**How to avoid:** Copy the full function signature block from migration 9 verbatim, change only `SET search_path = public` → `SET search_path = ''`.

### Pitfall 6: `supabase db lint --linked` vs `supabase db lint` (local)

**What goes wrong:** `supabase db lint` (without `--linked`) runs against the local Supabase stack started by `supabase start`. Running it before a local apply shows the pre-migration WARNs even when migration 14 is already applied locally.

**How to avoid:** D-04 specifies `--linked` for the pre-merge check (runs against the linked production project, which reflects current production state) and again post-deploy. When running locally to validate the migration SQL, run `supabase db reset` first (applies all migrations including 14), then `supabase db lint` without `--linked` to verify local WARNs clear. The two-step D-04 protocol covers both.

---

## Code Examples

### Pattern: `CREATE OR REPLACE` with `SET search_path = ''` (from migration 9 — direct precedent)

```sql
-- Source: supabase/migrations/00000000000009_admin_integrity_rls.sql
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public          -- Migration 14 changes this to: SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT is_admin AND mfa_verified AND guild_member
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;
```

Migration 14 version (only the search_path line changes):

```sql
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT is_admin AND mfa_verified AND guild_member
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;
```

### Pattern: `increment_vote_count` — add `SET search_path = ''`, no body change

```sql
-- Source: supabase/migrations/00000000000002_triggers.sql lines 172-188
-- Body is already fully qualified — only add SET search_path = '' between SECURITY DEFINER and AS $$
CREATE OR REPLACE FUNCTION public.increment_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.vote_counts (poll_id, choice_id, count)   -- already public.
  VALUES (NEW.poll_id, NEW.choice_id, 1)
  ON CONFLICT (poll_id, choice_id) DO UPDATE
  SET count = public.vote_counts.count + 1;                    -- already public.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

### Pattern: `handle_new_user` — plpgsql LANGUAGE syntax for `SET search_path`

For `plpgsql` functions, `SET search_path = ''` is placed between the closing `$$` delimiter and the `LANGUAGE plpgsql` clause:

```sql
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

Or equivalently as function options before the AS block:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
...
$$;
```

Both forms are valid Postgres syntax. The project convention (from migrations 5, 7, 8) uses the pre-AS-block form. Use that form for consistency. [VERIFIED: read from migration files]

### Pattern: `profile_self_update_allowed` — trigger function with `current_user`/`session_user`

```sql
-- Source: supabase/migrations/00000000000004_fix_trigger_rpc_context.sql
-- current_user and session_user are pg_catalog session variables —
-- they resolve regardless of search_path. Safe with SET search_path = ''.
CREATE OR REPLACE FUNCTION public.profile_self_update_allowed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Always enforce immutable columns
  IF NEW.id != OLD.id THEN RAISE EXCEPTION 'Cannot change profile id'; END IF;
  IF NEW.discord_id != OLD.discord_id THEN RAISE EXCEPTION 'Cannot change discord_id'; END IF;
  IF NEW.created_at != OLD.created_at THEN RAISE EXCEPTION 'Cannot change created_at'; END IF;

  IF current_user = session_user THEN
    IF NEW.is_admin != OLD.is_admin THEN RAISE EXCEPTION 'Cannot change is_admin via client'; END IF;
    IF NEW.mfa_verified != OLD.mfa_verified THEN RAISE EXCEPTION 'Cannot change mfa_verified via client -- use update_profile_after_auth RPC'; END IF;
    IF NEW.guild_member != OLD.guild_member THEN RAISE EXCEPTION 'Cannot change guild_member via client -- use update_profile_after_auth RPC'; END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

---

## Runtime State Inventory

Not applicable — this is a schema DDL phase, not a rename/refactor/migration phase. No stored data, live service config, OS-registered state, secrets, or build artifacts carry strings that are being renamed.

---

## Open Questions

### 1. `rls_auto_enable` — system function or user function?

**What we know:** The function is listed in REQUIREMENTS.md, CONTEXT.md, and PROJECT.md as one of the 7 target functions. It does not appear in any of migrations 0–13. Prior research noted it as "(inferred from `00000000000001_rls.sql`)" but that migration contains only `ENABLE ROW LEVEL SECURITY` DDL, no function definition.

**What's unclear:** Whether the Supabase advisor is flagging a system function (owned by the `supabase_admin` or `postgres` role, living in an internal schema) that happens to appear in the user's advisor output, or whether it is a user function created by a migration that was applied outside the migration history.

**Recommendation:** Wave 0 of the plan must include a single verification step: run `npx supabase db dump --linked --schema=public | grep -A 10 rls_auto_enable` (or equivalent Supabase Studio query: `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'rls_auto_enable'`). If the function exists in `public` schema with a user-writable body, include it in Migration 14. If not found (or found in a non-public schema), Migration 14 targets 6 functions and the advisor WARN for `rls_auto_enable` may require a Supabase support query to resolve.

### 2. `update_profile_after_auth` — which signature is current?

**What we know:** The function is redefined in migrations 2 and 3. Migration 2 has signature `(p_mfa_verified BOOLEAN, p_discord_username TEXT, p_avatar_url TEXT)`. Migration 3 extends it to `(p_mfa_verified BOOLEAN, p_discord_username TEXT, p_avatar_url TEXT, p_guild_member BOOLEAN DEFAULT FALSE)`. Migration 3 is the last definition, so it is current. [VERIFIED: migrations 2 and 3 read directly]

**Implication:** Migration 14 must use the migration-3 signature (4 params) when writing the `CREATE OR REPLACE FUNCTION`. Using the migration-2 signature would create a new function overload (different argument list = different OID) and leave the original 4-param version untouched, clearing zero advisor WARNs for it.

**Recommendation:** Planner must copy the full signature from migration 3 into Migration 14.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (integration config) |
| Config file | `vitest.config.integration.ts` |
| Quick run command | `npm run test:integration` |
| Full suite command | `npm run test:integration` (same — integration suite is the relevant suite for DBHY-03) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DBHY-01 | Migration 14 applies without error on local stack | smoke | `supabase db reset` (local) | N/A — Supabase CLI operation |
| DBHY-02 | Zero `0011_function_search_path_mutable` WARNs | lint | `npx supabase db lint --linked` | N/A — CLI operation |
| DBHY-03 (RLS matrix) | `is_current_user_admin()` body-identical: 12-cell RLS matrix unchanged | integration | `npm run test:integration` | ✅ `e2e/integration/vote-counts-rls.test.ts` |
| DBHY-03 (smoke) | `submit-vote` → `increment_vote_count` trigger → `vote_counts` write | manual | Production Discord login + cast vote | N/A — manual |
| DBHY-04 | `11-PATTERNS.md` prose corrected | doc review | Manual review | ✅ `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-PATTERNS.md` |

### TEST-11 file location (confirmed)

`e2e/integration/vote-counts-rls.test.ts` — confirmed present, line 1 header reads `// TEST-11 — vote_counts RLS 12-cell invariant matrix.`, `describe` block at line 25. [VERIFIED: grep on actual file]

### Sampling Rate

- **Pre-merge local validation:** `supabase db reset` → `npm run test:integration` → `npx supabase db lint`
- **Post-deploy:** `npx supabase db lint --linked` + production smoke vote
- **Phase gate:** Both lint runs clean + TEST-11 pass + smoke vote recorded in SUMMARY.md

### Wave 0 Gaps

None — existing test infrastructure covers all DBHY-03 automated coverage. TEST-11 test file exists and is runnable. No new test files needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI (npx) | DBHY-02 lint check, local db reset | ✅ | 2.92.1 (via npx) | None — required for lint |
| Vitest integration config | DBHY-03 TEST-11 re-run | ✅ | (project-installed) | None |
| Local Supabase stack (`supabase start`) | D-09 local replay | ✅ (assumed — local ES256 bug is a runtime test issue, not a migration-apply issue) | — | If stack won't start, apply migration against linked project with extra care |
| Production Supabase project | DBHY-02 post-deploy lint, D-01 smoke | ✅ | polls.wtcsmapban.com | — |

**Missing dependencies with no fallback:** None.

**Note on local ES256 bug:** The `npm run test:integration` command is affected by the local ES256 supabase-edge-runtime bug (deferred v1.2 carry-forward) only for integration tests that invoke Edge Functions. TEST-11 (`vote-counts-rls.test.ts`) tests direct Postgres RLS via supabase-js, not via Edge Functions — it is NOT affected by the ES256 bug. TEST-11 can be run locally. [ASSUMED — based on reading TEST-11's test structure which uses `supabase.from()` not `supabase.functions.invoke()`]

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | Yes | `is_current_user_admin()` body-identical rewrite preserves all admin RLS gates |
| V5 Input Validation | No | — |
| V6 Cryptography | No | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `search_path` hijacking in SECURITY DEFINER functions | Elevation of Privilege | `SET search_path = ''` + fully-qualified body references (this phase's entire purpose) |
| Admin-OR-bypass in `vote_counts` RLS policy (REVIEW-FIX-H3 drift) | Information Disclosure | DBHY-04 prose fix ensures future readers copy the correct policy form; TEST-11 admin-JWT sentinel provides runtime defense-in-depth |
| OID instability breaking trigger references | Tampering (data integrity) | `CREATE OR REPLACE FUNCTION` preserves OID; never use DROP+CREATE for trigger functions |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | OID is preserved by `CREATE OR REPLACE FUNCTION` — trigger `on_vote_inserted` continues to reference `increment_vote_count` correctly post-migration | Architecture Patterns | Trigger stops firing; every vote fails silently — but this is standard Postgres behavior with strong consensus |
| A2 | `current_user` and `session_user` resolve from `pg_catalog`, unaffected by `SET search_path = ''` | Code Examples | `profile_self_update_allowed` starts throwing errors on all profile updates — low risk; standard Postgres behavior |
| A3 | TEST-11 (`vote-counts-rls.test.ts`) does not invoke Edge Functions and is therefore unaffected by the local ES256 bug | Environment Availability | TEST-11 cannot be run locally; must run against linked project instead — low risk |
| A4 | `rls_auto_enable` is a Supabase system function not writable by user migration | Open Questions | If it IS user-writable, Migration 14 is missing one function and advisor retains one WARN — planner gates on verification step |

---

## Sources

### Primary (HIGH confidence)

- `supabase/migrations/00000000000002_triggers.sql` — authoritative bodies for `handle_new_user`, `validate_vote_choice`, `increment_vote_count`, `profile_self_update_allowed` (original), `update_profile_after_auth` (original)
- `supabase/migrations/00000000000003_guild_membership.sql` — latest `update_profile_after_auth` (4-param signature) + latest `profile_self_update_allowed` (migration 3 version)
- `supabase/migrations/00000000000004_fix_trigger_rpc_context.sql` — latest `profile_self_update_allowed` (authoritative version with `current_user = session_user` guard)
- `supabase/migrations/00000000000009_admin_integrity_rls.sql` — latest `is_current_user_admin` (authoritative version with `mfa_verified AND guild_member`)
- `supabase/migrations/00000000000010_results_hidden_audit.sql` — shipped REVIEW-FIX-H3 vote_counts policy (no admin OR-branch)
- `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-PATTERNS.md` — current state of the DBHY-04 target file
- `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-REVIEW.md` — W-04 closure note confirming commit 73fb2c2 applied PATTERNS.md partial fix
- `git show 73fb2c2 --name-status` — confirmed which file the W-04 fix touched

### Secondary (MEDIUM confidence)

- `.planning/research/v1.3-PITFALLS.md` — prior research on `search_path = ''` semantics and `increment_vote_count` risk (note: bare-reference claim in that doc is contradicted by the actual migration body)
- `.planning/research/v1.3-ARCHITECTURE.md` — function-by-function table; `rls_auto_enable` noted as "inferred, not confirmed"
- `.planning/STATE.md` — current blockers and open gaps as of 2026-05-16

### Tertiary (LOW confidence)

- Standard Postgres documentation (training data) on `CREATE OR REPLACE FUNCTION` OID preservation and `pg_catalog` session variable resolution — both are widely-documented stable behaviors

---

## Metadata

**Confidence breakdown:**
- Function body audit: HIGH — read directly from migration files
- `is_current_user_admin` body-identical claim: HIGH — bodies compared line by line
- `increment_vote_count` already-qualified finding: HIGH — verified from migration 2
- `rls_auto_enable` status: LOW — absent from all on-disk migrations; must be resolved pre-execution
- DBHY-04 drift location: HIGH — grep-confirmed prose at line 83 vs SQL block at lines 85-101
- `SET search_path = ''` semantics: MEDIUM (HIGH for standard cases; MEDIUM for `current_user`/`session_user` edge case)

**Research date:** 2026-05-16
**Valid until:** Stable — Postgres and Supabase migration semantics do not change rapidly. Valid until next schema-touching migration modifies one of the 7 target functions.
