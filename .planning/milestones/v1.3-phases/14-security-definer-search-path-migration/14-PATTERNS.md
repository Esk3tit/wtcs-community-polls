# Phase 14: Security-Definer Search-Path Migration — Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 2 (1 new SQL migration + 1 doc edit)
**Analogs found:** 2 / 2

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/00000000000014_harden_security_definer_search_path.sql` | migration (DDL) | schema-DDL | `supabase/migrations/00000000000009_admin_integrity_rls.sql` + `00000000000007_fix_pr_review.sql` + `00000000000013_demote_admin_guarded_advisory_lock.sql` | exact (same `CREATE OR REPLACE FUNCTION … SET search_path` form, same section-header comment style) |
| `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-PATTERNS.md` (DBHY-04 prose fix) | doc (planning artifact) | n/a | `11-PATTERNS.md` line 83 (the drift line itself) | exact — prose-only substitution at a known line number |

---

## Pattern Assignments

### `supabase/migrations/00000000000014_harden_security_definer_search_path.sql` (migration, schema-DDL)

**Primary analog:** `supabase/migrations/00000000000009_admin_integrity_rls.sql` (function rewrite with `SET search_path`)
**Style anchor:** `supabase/migrations/00000000000013_demote_admin_guarded_advisory_lock.sql` (most-recent migration — file-level header comment form)
**Section-divider style:** `supabase/migrations/00000000000007_fix_pr_review.sql` (multi-section `=====` banners with `FIX N:` labels)

---

#### File-level header comment pattern

From `supabase/migrations/00000000000013_demote_admin_guarded_advisory_lock.sql` (lines 1-36):

```sql
-- =====================================================================
-- Phase 11 follow-up #4: demote_admin_guarded — advisory-lock serialization
-- ...rationale prose...
--
-- This is a forward-only migration that uses CREATE OR REPLACE to swap
-- the function body in place. The function signature and error codes
-- are unchanged, so the demote-admin Edge Function does not need to be
-- redeployed.
-- =====================================================================
```

**Copy form for Migration 14:**

```sql
-- 00000000000014_harden_security_definer_search_path.sql
--
-- Adds SET search_path = '' to the 6 pre-Phase-11 SECURITY DEFINER
-- functions flagged by the Supabase security advisor
-- (0011_function_search_path_mutable). Uses CREATE OR REPLACE FUNCTION
-- to preserve OIDs (trigger references) and update bodies atomically.
-- ALTER FUNCTION is not used because it cannot update body references
-- in the same statement.
--
-- Clears advisor WARNs for: validate_vote_choice, handle_new_user,
-- profile_self_update_allowed, update_profile_after_auth,
-- is_current_user_admin, increment_vote_count.
-- (rls_auto_enable excluded — verify via dashboard before adding.)
--
-- Verified locally via supabase db reset + supabase db lint (D-04).
```

---

#### Per-function section divider pattern

From `supabase/migrations/00000000000007_fix_pr_review.sql` (lines 16-18 and 57-60):

```sql
-- =====================================================================
-- FIX 1a: Recreate create_poll_with_choices with cardinality()
-- =====================================================================
```

**Copy form for Migration 14 sections:**

```sql
-- =====================================================================
-- FUNCTION 1: validate_vote_choice
-- =====================================================================
```

---

#### `SET search_path = ''` placement — sql LANGUAGE functions

From `supabase/migrations/00000000000009_admin_integrity_rls.sql` (lines 11-23 — the single most important analog):

```sql
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public          -- Migration 14 changes this line to: SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT is_admin AND mfa_verified AND guild_member
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;
```

**Migration 14 form (only the `search_path` value changes):**

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

The `STABLE` keyword must be retained verbatim — omitting it degrades the function from `STABLE` to `VOLATILE` and disables per-statement RLS caching.

---

#### `SET search_path = ''` placement — plpgsql LANGUAGE functions

The project convention (migrations 3, 4) places function options (`SECURITY DEFINER`, `SET search_path`) before the `AS $$` block, not after the closing `$$`. Use this pre-AS form for all `plpgsql` rewrites in Migration 14.

**Analog — `profile_self_update_allowed` (authoritative body from `supabase/migrations/00000000000004_fix_trigger_rpc_context.sql` lines 12-45):**

```sql
CREATE OR REPLACE FUNCTION public.profile_self_update_allowed()
RETURNS TRIGGER AS $$
BEGIN
  -- Always enforce immutable columns regardless of caller
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Migration 14 form (add `SET search_path = ''`, no body change):**

```sql
CREATE OR REPLACE FUNCTION public.profile_self_update_allowed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- body verbatim from migration 4 --
END;
$$;
```

Note the signature block style change: Migration 14 moves `LANGUAGE plpgsql SECURITY DEFINER` to the pre-AS option list so `SET search_path = ''` can sit cleanly alongside them. The trailing `$$ LANGUAGE plpgsql SECURITY DEFINER;` form used in migrations 2–4 does not allow inserting `SET search_path` cleanly — the pre-AS form is the established project style (see migrations 5, 7, 8, 9, 12, 13 all using pre-AS placement).

---

#### `increment_vote_count` — trigger function (plpgsql, post-`$$` style in source)

**Source (authoritative): `supabase/migrations/00000000000002_triggers.sql` lines 172-181:**

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

**CRITICAL: Both `INSERT INTO public.vote_counts` and `public.vote_counts.count` are already fully qualified. No body change is needed. CONTEXT.md's claim of a bare reference is incorrect (RESEARCH.md CRITICAL FINDING). Only `SET search_path = ''` is added.**

**Migration 14 form:**

```sql
CREATE OR REPLACE FUNCTION public.increment_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.vote_counts (poll_id, choice_id, count)
  VALUES (NEW.poll_id, NEW.choice_id, 1)
  ON CONFLICT (poll_id, choice_id) DO UPDATE
  SET count = public.vote_counts.count + 1;
  RETURN NEW;
END;
$$;
```

---

#### `update_profile_after_auth` — 4-param signature (authoritative)

**Source (authoritative): `supabase/migrations/00000000000003_guild_membership.sql` lines 41-62. Migration 3 is the last definition; use the 4-param signature or `CREATE OR REPLACE` will create a new OID-diverging overload.**

```sql
CREATE OR REPLACE FUNCTION public.update_profile_after_auth(
  p_mfa_verified BOOLEAN,
  p_discord_username TEXT,
  p_avatar_url TEXT,
  p_guild_member BOOLEAN DEFAULT FALSE
)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET
    mfa_verified = p_mfa_verified,
    discord_username = p_discord_username,
    avatar_url = p_avatar_url,
    guild_member = p_guild_member,
    updated_at = NOW()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for current user';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Migration 14 form (pre-AS option block, `SET search_path = ''` added, no body change):**

```sql
CREATE OR REPLACE FUNCTION public.update_profile_after_auth(
  p_mfa_verified BOOLEAN,
  p_discord_username TEXT,
  p_avatar_url TEXT,
  p_guild_member BOOLEAN DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET
    mfa_verified = p_mfa_verified,
    discord_username = p_discord_username,
    avatar_url = p_avatar_url,
    guild_member = p_guild_member,
    updated_at = NOW()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for current user';
  END IF;
END;
$$;
```

`auth.uid()` resolves via the `auth` schema prefix, not via `search_path` — safe with `search_path = ''`.

---

#### `handle_new_user` and `validate_vote_choice` — authoritative bodies

Both bodies are already fully qualified. Source: `supabase/migrations/00000000000002_triggers.sql` lines 86-159.

`handle_new_user` uses: `public.admin_discord_ids`, `public.profiles` — both qualified.
`validate_vote_choice` uses: `public.choices` — qualified.

Migration 14 adds `SET search_path = ''` in the pre-AS option block with no body changes, following the same structural form shown for `profile_self_update_allowed` above.

---

#### Recommended section ordering in Migration 14

Order from lowest-risk to highest-risk (matches RESEARCH.md recommendation). Makes local bisection easier if a syntax error is introduced:

1. `validate_vote_choice` — trigger, no external table DML besides SELECT on `public.choices`
2. `handle_new_user` — auth signup trigger; rarely fires during testing
3. `profile_self_update_allowed` — trigger, no table DML (only NEW/OLD comparisons + `current_user`/`session_user`)
4. `update_profile_after_auth` — RPC called by auth callback; 4-param signature critical
5. `is_current_user_admin` — RLS policy function (gates 7+ tables); only `search_path` value changes
6. `increment_vote_count` — hot path trigger; last in sequence for local validation
7. `rls_auto_enable` — **include only if confirmed user-owned** via dashboard Function inspector or `pg_get_functiondef` before writing Migration 14. If absent from `public` schema, omit entirely. This is an open gate (RESEARCH.md Open Question 1).

---

#### Post-function REVOKE pattern

From `supabase/migrations/00000000000007_fix_pr_review.sql` lines 136-140 and `00000000000013_demote_admin_guarded_advisory_lock.sql` lines 88-90:

```sql
-- Re-apply the REVOKE because CREATE OR REPLACE FUNCTION can reset some
-- function attributes; explicit REVOKE keeps the function off the
-- PostgREST surface for non-service-role callers.
REVOKE EXECUTE ON FUNCTION public.demote_admin_guarded(uuid) FROM anon, authenticated, public;
```

**Apply to Migration 14:** Only the functions that already have `REVOKE` grants in earlier migrations need re-application here. For the 6 core trigger/RLS functions (`validate_vote_choice`, `handle_new_user`, `profile_self_update_allowed`, `update_profile_after_auth`, `is_current_user_admin`, `increment_vote_count`) — check whether earlier migrations applied `REVOKE EXECUTE`. If none did, do not add new REVOKEs in Migration 14 (this migration's sole purpose is `search_path` hardening, not privilege changes).

---

#### Verification grep pattern

After writing Migration 14, verify with:

```bash
grep -c "SECURITY DEFINER" supabase/migrations/00000000000014_harden_security_definer_search_path.sql
# Must equal 6 (or 7 if rls_auto_enable confirmed and included)

grep -c "SET search_path = ''" supabase/migrations/00000000000014_harden_security_definer_search_path.sql
# Must equal 6 (or 7)
```

---

### `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-PATTERNS.md` (DBHY-04 doc fix)

**Role:** planning artifact (doc-only edit)
**Analog:** The file itself — surgical prose replacement at a confirmed line number.

---

#### Changelog note — placement

Add as the **second line** of the file, immediately after the `# Phase 11:…` H1 heading (before the `**Mapped:**` metadata block). D-06 canonical form:

```
Updated 2026-05-16 (Phase 14, DBHY-04) — original form had admin-OR drift; see REVIEW-FIX-H3.
```

Current file top (lines 1-5 from the file as-read):

```markdown
# Phase 11: Schema + RLS + EF Foundations — Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 7 new, 13 modified ...
**Analogs found:** 7/7 new files have strong analogs ...
```

After edit:

```markdown
# Phase 11: Schema + RLS + EF Foundations — Pattern Map

Updated 2026-05-16 (Phase 14, DBHY-04) — original form had admin-OR drift; see REVIEW-FIX-H3.

**Mapped:** 2026-05-11
...
```

---

#### Prose drift — exact location and substitution

**Current prose at line 83** (the drift, confirmed by RESEARCH.md grep):

```
**RLS policy DROP+CREATE pattern (vote_counts) — DROP the v1.0 policy at `migrations/00000000000001_rls.sql:72` and the v1.0.5 admin-bypass policy in `migrations/00000000000005_admin_phase4.sql:75-88` (whichever is current). The shipped policy has NO `is_current_user_admin()` OR-bypass — admin reads go through service-role-backed Edge Functions (which bypass RLS automatically) per the security review's VIS-04 / REVIEW-FIX-H3 decision. D-14, D-15, D-16:**
```

The phrase "**and the v1.0.5 admin-bypass policy in `migrations/00000000000005_admin_phase4.sql:75-88` (whichever is current)**" is the drift. It implies the admin-OR form from migration 5 might still be the current policy. It is not — migration 10 replaced it with REVIEW-FIX-H3.

**Replacement prose (line 83):**

```
**RLS policy DROP+CREATE pattern (vote_counts) — DROP the v1.0 policy at `migrations/00000000000001_rls.sql:72` and the v1.0.5 admin-bypass policy at `migrations/00000000000005_admin_phase4.sql:75-88` (both superseded). The shipped policy (migration 10, REVIEW-FIX-H3) has NO `is_current_user_admin()` OR-bypass — admin reads go through service-role-backed Edge Functions (which bypass RLS automatically) per the security review's VIS-04 / REVIEW-FIX-H3 decision. D-14, D-15, D-16:**
```

**The SQL code block at lines 85-101 is already correct and must not change.**

---

#### Shipped REVIEW-FIX-H3 canonical form (for planner reference)

Source: `supabase/migrations/00000000000010_results_hidden_audit.sql` lines 130-155 (VERIFIED):

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

No `is_current_user_admin()` call. No admin OR-branch. Service-role bypasses RLS via Postgres contract automatically.

---

## Shared Patterns

### `CREATE OR REPLACE FUNCTION` with `SET search_path = ''` (cross-cutting)

**Applies to:** All 6 function blocks in Migration 14.

Every `CREATE OR REPLACE FUNCTION` block in Migration 14 must include all four of:
1. `SECURITY DEFINER` — never omit; its absence silently converts to `SECURITY INVOKER`
2. `SET search_path = ''` — the entire purpose of the migration
3. Fully-qualified body references (`public.<table>` on every DML target and SELECT target) — all 6 bodies are already qualified; no changes needed per RESEARCH.md Function Body Audit
4. Complete function signature matching the **latest** migration that defined the function — using an older signature creates a new overload with a different OID, leaving the original function (and its `search_path` WARN) untouched

**Source precedent:** `supabase/migrations/00000000000009_admin_integrity_rls.sql` (lines 11-26) — only migration in the project that already uses `SET search_path` on a function that Migration 14 also targets; the form is verbatim-copyable.

### Migration file header comment style

**Source:** `supabase/migrations/00000000000013_demote_admin_guarded_advisory_lock.sql` (lines 1-36)
**Applies to:** Migration 14 file-level header block.

Convention: multi-line `--` block, describes the problem being fixed, names the solution strategy, and calls out any edge cases. Does not include plan/phase IDs in the source file (project rule: rot tags forbidden in `supabase/migrations/`).

### Section divider style

**Source:** `supabase/migrations/00000000000007_fix_pr_review.sql` (lines 16-18)
**Applies to:** Each function block in Migration 14.

```sql
-- =====================================================================
-- FUNCTION N: <function_name>
-- =====================================================================
```

---

## No Analog Found

None — both target artifacts have clear analogs in the existing codebase.

---

## TEST-11 Reuse (DBHY-03)

**Existing test file:** `e2e/integration/vote-counts-rls.test.ts` (CONFIRMED present on disk)

This file is **not modified** in Phase 14. It is re-run as-is (`npm run test:integration`) to verify `is_current_user_admin()` body-identical claim after Migration 14 deploys. The test header at line 1 reads `// TEST-11 — vote_counts RLS 12-cell invariant matrix.`. No new test code is required.

The test uses `supabase.from()` (direct Postgres RLS), not `supabase.functions.invoke()`. It is unaffected by the local ES256 supabase-edge-runtime bug (RESEARCH.md Environment Availability note).

---

## Open Gate Before Execution

**`rls_auto_enable` verification (RESEARCH.md Open Question 1):**

Before writing Migration 14, the executor must run one of:

```sql
-- In Supabase Studio SQL editor or via supabase db dump:
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace;
```

- If result is found with a user-writable body: include as Function 7 in Migration 14, applying `SET search_path = ''` and qualifying any bare references.
- If not found (or found in a non-public schema): Migration 14 contains 6 functions. The advisor WARN for `rls_auto_enable` may not be clearable by user migration; flag for Supabase support if it persists post-deploy.

---

## Metadata

**Analog search scope:** `supabase/migrations/` (migrations 0–13), `e2e/integration/`, `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/`
**Files read:** 8 migration files + 11-PATTERNS.md (target section) + e2e directory listing
**Pattern extraction date:** 2026-05-16
