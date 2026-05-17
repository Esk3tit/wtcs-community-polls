---
phase: 14-security-definer-search-path-migration
reviewed: 2026-05-17T00:00:00Z
depth: deep
iteration: 3
files_reviewed: 5
files_reviewed_list:
  - supabase/migrations/00000000000014_harden_security_definer_search_path.sql
  - supabase/migrations/00000000000002_triggers.sql
  - supabase/migrations/00000000000003_guild_membership.sql
  - supabase/migrations/00000000000004_fix_trigger_rpc_context.sql
  - tests/sql/is_current_user_admin_regression.sql
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 14: Code Review Report (Iteration 3 — closure)

**Reviewed:** 2026-05-17
**Depth:** deep
**Iteration:** 3 of 3 (final, at `--auto` cap)
**Files Reviewed:** 5
**Status:** clean — iteration loop converged

## Summary

Iteration 3 is the closure pass for Phase 14. All three iteration-2 Info findings are verified closed and the iteration-2 fixes did not introduce any new defects. **No Critical, Warning, or Info findings remain.** The iteration loop has converged within the 3-iteration `--auto` cap.

The expanded file scope (5 files vs. iteration-2's 3) reflects the fixer touching migrations 03 and 04 to address IN-02 iter-2. All four migration files plus the regression fixture are now coherent with respect to:
- The live (deployed) function bodies on production
- Forward-reference signposting for code archaeology
- Catalog-comment text for fresh local-dev re-applies
- Cross-reference brittleness (no surviving `:line` or `lines N-M` suffixes)

The production-deploy invariant is unchanged and respected: migration 14 has shipped; the iteration-2 source edits to migrations 02/03/04 are documentary only. Production `pg_description` still carries the migration-02-era catalog comments for `handle_new_user` and `profile_self_update_allowed` — a known accepted gap that the iter-2 IN-01 fix explicitly preserves (the new source comment is scoped to "fresh re-applies for local dev stacks").

## Structural Findings (fallow)

_No structural findings block was supplied with this review request; structural pre-pass was not performed for this phase._

## Narrative Findings (AI reviewer)

_No findings. All iteration-2 findings verified closed; no new issues surfaced under deep cross-file analysis._

---

## Iteration-2 Fix Verification

| ID (iter-2) | Item | Closed | Notes |
|----|------|--------|-------|
| IN-01 iter-2 | Stale `COMMENT ON FUNCTION` text for `handle_new_user` + `profile_self_update_allowed` | YES | Migration 02 lines 47-60 (`profile_self_update_allowed`) and 161-172 (`handle_new_user`). Both restate the post-migration-14 behavior accurately. Each is preceded by a NOTE block explaining the production-catalog-vs-source gap and why migration 14 source intentionally does not re-emit `COMMENT ON FUNCTION` (would diverge from already-applied prod migration). |
| IN-02 iter-2 | Forward-reference NOTEs on `update_profile_after_auth` (migration 03) + `profile_self_update_allowed` (migration 04) | YES | Migration 03 lines 40-43, migration 04 lines 12-15. Both NOTEs name the later migration explicitly (`harden_security_definer_search_path`) and describe what changes (3-param overload dropped; `SET search_path = ''` added). Style is consistent with the iter-1 NOTE at migration 02 lines 99-103. |
| IN-03 iter-2 | Drop surviving `lines 47-56` from fixture cross-reference | YES | Fixture line 84 now reads `per the audit_log migration (00000000000010_*) -- two JSONB diff columns, NOT a single body column.` No line range. Consistent with the iter-1 convention applied to the migration-02 cross-references at fixture lines 30 and 63. |

---

## Drift Checks on Iteration-2 Fixes

Per iter-3 review goal #2, every iteration-2 fix was probed for new drift it might have introduced. All clean:

1. **`COMMENT ON FUNCTION public.profile_self_update_allowed` (migration 02 lines 57-60)** — verified against migration 14 lines 122-148 line-by-line:
   - "blocks id/discord_id/created_at unconditionally" → matches lines 124-132 (outside the `current_user = session_user` block).
   - "blocks is_admin/mfa_verified/guild_member only when current_user = session_user" → matches lines 137-148 (inside the gate).
   - "SECURITY DEFINER callers bypass the protected-column checks" → matches the runtime semantics: when `update_profile_after_auth` calls UPDATE, `current_user` is the function owner (postgres), `session_user` is `authenticated`, so the gate evaluates FALSE and the inner block is skipped.
   - Result: comment is neither overstated nor understated.

2. **`COMMENT ON FUNCTION public.handle_new_user` (migration 02 lines 169-172)** — verified against migration 14 lines 28-74:
   - "Creates or updates profile on signup" → matches the INSERT … ON CONFLICT (id) DO UPDATE.
   - "Derives admin status from admin_discord_ids" → matches lines 48-50 (`SELECT EXISTS … FROM public.admin_discord_ids`).
   - "Discord ID extracted via COALESCE(provider_id, sub, id, NEW.id::TEXT)" → matches lines 38-46 exactly (chain order + UUID-as-text last-resort).
   - "Fallback to UUID-as-text is silent; see migration 14 header for observability follow-up" → matches migration 14 lines 22-27 WHY comment. Cross-reference is by header location ("migration 14 header"), not line number — not brittle.
   - Result: accurate, and the cross-pointer to the migration-14 header is robust.

3. **Forward-reference NOTE phrasing consistency across migrations 02/03/04** — all five NOTE blocks in the four affected files were collected and read together:
   - Migration 02 line 47 (`profile_self_update_allowed` comment), line 99 (`handle_new_user` body), line 161 (`handle_new_user` comment).
   - Migration 03 line 40 (`update_profile_after_auth` 4-param body).
   - Migration 04 line 12 (`profile_self_update_allowed` body).
   All five reference "the later harden_security_definer_search_path migration" or equivalent ("a later migration that re-emits the function body"). Phrasing varies in detail (some describe the comment-catalog gap, some describe body re-emit, some describe the DROP of the 3-param overload) but the variation tracks what is actually different in each file's case — not style drift. No reader will mis-model the chronology.

4. **Fixture line-offset drift (+1 from new comment line at iter-1)** — the fixture's only remaining cross-references are at lines 30 (`supabase/migrations/00000000000002_triggers.sql` — no line number) and 63 (same target, no line number) and 84 (`00000000000010_*` — no line number). All three are filename-pattern references; no line-number suffixes survive. Future +N line offsets in either target file will not stale these comments. Confirmed by `grep -n "lines\|line "` over the fixture file.

5. **Regression evidence file** — `is_current_user_admin_regression.txt` was refreshed at iter-2 commit 97f5351 to match the new line offsets (NOTICE messages now reference `:125`, `:128`, `:131`, `:134`, `:161`, `:177`). 6 PASS / 0 FAIL / exit 0. The NOTICE line numbers in the evidence file are psql's own location stamps (they shift whenever the fixture grows), not cross-references inside source — they are expected to track the fixture, so the +1 refresh is correct.

---

## Cross-File Analysis Notes (deep-depth, iter-3 re-check)

All iteration-1 and iteration-2 deep-depth invariants re-verified — all still CLEAN:

1. **Unqualified references under `search_path = ''`** — all six function bodies in migration 14 use `public.<table>` and `auth.uid()`. No 42P01 risk.

2. **`DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT)`** still targets only the 3-param overload from migration 02. The 4-param signature `(BOOLEAN, TEXT, TEXT, BOOLEAN)` from migration 03 is a distinct `pg_proc` row, unaffected. `CREATE OR REPLACE` preserves grants on the 4-param.

3. **`is_current_user_admin` body-identicality** — body normalized matches migration 09's deployed form modulo `SET search_path = '' ` (was `public`). Volatility (`STABLE`), `SECURITY DEFINER`, and `RETURNS BOOLEAN` preserved. OID-preserving `CREATE OR REPLACE` keeps RLS policy binding stable.

4. **`profile_self_update_allowed` divergence from migration 02** — semantically intentional (adds `current_user = session_user` gate); body matches migration 04 modulo `SET search_path = ''`. Forward-reference NOTE blocks at migration 02 line 47 and migration 04 line 12 signpost the chain correctly.

5. **`increment_vote_count` / `validate_vote_choice`** — bodies byte-identical to migration 02 modulo `SET search_path = ''`. Tables already qualified.

6. **Idempotency** — every statement in migration 14 is `CREATE OR REPLACE` or `DROP … IF EXISTS`. Re-applicable N times.

7. **Trigger graph preservation** — triggers `on_auth_user_created`, `on_profile_self_update`, `on_vote_validate_choice`, `on_vote_inserted` bind by name → `pg_proc` OID. `CREATE OR REPLACE` preserves OID. Triggers continue to bind.

8. **RLS policy binding preservation** — policies that reference `public.is_current_user_admin()` (migration 05, migration 10's `audit_log` policy) still bind correctly; the fixture's audit_log SELECT under `authenticated` role + admin JWT proves end-to-end.

9. **Fixture role/JWT sequencing** — helper `pg_temp.assert_admin` and the two `DO $$ … $$` blocks follow the correct sequence: `set_config(claim)` → `SET LOCAL ROLE authenticated` → call/SELECT → `RESET ROLE`. Exception path covered by transaction-wide `ROLLBACK` under `ON_ERROR_STOP=1`.

10. **JWT claim wiring** — both `request.jwt.claim.sub` and `request.jwt.claims` are set (defensive — `auth.uid()` reads either form).

11. **`current_setting('role')` trigger guard** — `on_profile_self_update` fires only when `current_setting('role') = 'authenticated'`; fixture's privileged INSERT runs as postgres/supabase_admin so the trigger does not fire on fixture seed rows. The migration-14 body's `current_user = session_user` gate would also skip the protected-column checks in this case (definer-rights bypass) — but the trigger never fires, so the gate is unreached. Path is safe regardless.

12. **WR-02 root-cause fix (iter-1, re-verified iter-3)** — trigger-fired `handle_new_user` INSERT under migration-14 body derives `discord_id = '900000000000000001'` (etc.) from `raw_user_meta_data->>'provider_id'`, so the fixture's profiles ON CONFLICT correctly omits `discord_id` from the SET list. `is_current_user_admin()` is unaffected by `discord_id` (reads `is_admin AND mfa_verified AND guild_member`), but the fixture is now also correctly seeded for any future extension that reads `discord_id`.

13. **Production-deploy invariant (iter-2 IN-01 carry-over)** — explicitly affirmed:
    - Migration 14 has shipped. Its `.sql` file may receive documentary edits (header comments, WHY blocks) without re-deployment risk; bodies are unchanged.
    - The iter-2 IN-01 fix updated `COMMENT ON FUNCTION` strings in migration 02 source only. Production `pg_description` was last written when migration 02 was first applied (years ago) and is not re-written by migration 14 (no `COMMENT ON FUNCTION` statement in migration 14). The accepted gap is documented in two places: the NOTE block above each comment in migration 02, and the iter-1 WHY comment in migration 14 header.
    - The iter-2 IN-02 fixes (NOTE blocks in migrations 03/04) are also documentary only.

14. **Convergence statement** — iteration 3 found zero new findings. The loop has converged at the 3-iteration `--auto` cap. The phase is ready to close.

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Iteration: 3 (final, converged)_
