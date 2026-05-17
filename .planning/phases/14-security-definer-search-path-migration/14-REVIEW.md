---
phase: 14-security-definer-search-path-migration
reviewed: 2026-05-17T00:00:00Z
depth: deep
iteration: 2
files_reviewed: 3
files_reviewed_list:
  - supabase/migrations/00000000000014_harden_security_definer_search_path.sql
  - supabase/migrations/00000000000002_triggers.sql
  - tests/sql/is_current_user_admin_regression.sql
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 14: Code Review Report (Iteration 2)

**Reviewed:** 2026-05-17
**Depth:** deep
**Iteration:** 2
**Files Reviewed:** 3
**Status:** issues_found (Info-only — no Critical or Warning findings)

## Summary

Iteration-2 re-review of Phase 14 (SECURITY DEFINER `search_path = ''` hardening). All iteration-1 findings (WR-01, WR-02, IN-01, IN-02, IN-03, IN-05; IN-04 was a no-op observation) are genuinely closed at the right level:

- **WR-01** — Multi-line WHY comment in `00000000000014_harden_security_definer_search_path.sql` lines 22-27 explains the dropped `RAISE WARNING` observability gap and names two concrete future-remediation paths (audit_log INSERT, Sentry breadcrumb). Comment is documentary only — no behavioral suggestion. Production-deploy invariant is respected: comment-only delta, function body byte-identical to the deployed form.
- **WR-02** — Root-cause fix applied at the `auth.users` seed layer (fixture lines 55-60). `raw_user_meta_data->>'provider_id'` now carries the intended snowflake (`900000000000000001..a004`), so `handle_new_user`'s COALESCE chain derives the correct `discord_id` on the trigger-fired profiles INSERT. The fixture's ON CONFLICT SET list correctly omits `discord_id` because the trigger-inserted value is now already correct — no need to override. Verified by re-tracing trigger → handler → INSERT path against the migration-14 live body.
- **IN-01** — Forward-reference NOTE block added at `00000000000002_triggers.sql` lines 85-90 above `handle_new_user`.
- **IN-02** — `:137` line-number suffix dropped from fixture cross-references at lines 29-35 and 63-67.
- **IN-03** — Canary `target_type` renamed to phase-agnostic `'rls-regression-canary'` (fixture line 89).
- **IN-05** — Brittle-dependency WHY comment added above `auth.users` INSERT (fixture lines 48-54), naming `confirmation_token` and `email_change_token_new` as Supabase-upgrade watch-list examples.

The iteration-1 deep cross-file invariants still hold: schema qualification across all six bodies under `search_path = ''`, RLS policy binding preserved (functions re-emitted via `CREATE OR REPLACE` keep their OID), trigger graph intact, 3-param `update_profile_after_auth` cleanly dropped before 4-param re-emit, fixture role/JWT sequencing correct (`SET LOCAL ROLE authenticated` paired with `request.jwt.claims`).

Three new Info-tier observations surfaced during iteration-2 cross-file analysis — all are documentation / catalog-comment drift that does not affect behavior. No new Critical, no new Warning.

## Structural Findings (fallow)

_No structural findings block was supplied with this review request; structural pre-pass was not performed for this phase._

## Narrative Findings (AI reviewer)

## Info

### IN-01: Stale `COMMENT ON FUNCTION` text in catalog after migration 14 re-emit

**File:** `supabase/migrations/00000000000002_triggers.sql:47`, `:148`
**Issue:** Migration 14 uses `CREATE OR REPLACE FUNCTION` for `handle_new_user`, `profile_self_update_allowed`, and `update_profile_after_auth`, but does not re-emit corresponding `COMMENT ON FUNCTION` statements. Per Postgres semantics, `CREATE OR REPLACE FUNCTION` does NOT clear `pg_description` rows, so the original comments from migration 02 persist in the production catalog (`\df+` and `pg_description` queries). Two cases produce real drift:

- Line 148 sets the comment on `public.handle_new_user` to `'... R2 fix: discord_id extracted via COALESCE(provider_id, sub, id) with WARNING on fallback.'` — but the live body re-emitted by migration 14 contains no `RAISE WARNING`. The catalog comment now advertises observability the function no longer provides. This is the same gap WR-01's source comment acknowledges, but it surfaces in a second venue (the function comment) that WR-01's WHY comment does not cover.
- Line 47 sets the comment on `public.profile_self_update_allowed` to `'Guards profile self-update: only discord_username and avatar_url can be changed by the user via RLS. mfa_verified is blocked (R2 security fix) ...'` — but migration 14's live body adds a `current_user = session_user` gate around the protected-column blocks, allowing SECURITY DEFINER callers to bypass. The catalog comment overstates the constraint.

**Fix:** In a follow-up migration (no need to re-deploy migration 14 — purely a catalog refresh), restate the comments to match the live bodies:
```sql
COMMENT ON FUNCTION public.handle_new_user IS
  'Creates or updates profile on signup. Derives admin status from admin_discord_ids. '
  'Discord ID extracted via COALESCE(provider_id, sub, id, NEW.id::TEXT). '
  'Fallback to UUID-as-text is silent; see migration 14 header for observability follow-up.';

COMMENT ON FUNCTION public.profile_self_update_allowed IS
  'Guards profile self-update: blocks id/discord_id/created_at unconditionally; '
  'blocks is_admin/mfa_verified/guild_member only when current_user = session_user '
  '(direct client write). SECURITY DEFINER callers bypass the protected-column checks.';
```

### IN-02: Forward-reference NOTE missing on two other functions superseded by migration 14

**File:** `supabase/migrations/00000000000002_triggers.sql:15-39`, `:56-75`
**Issue:** Iteration-1 IN-01 added a forward-reference NOTE block (lines 85-90) above `handle_new_user` pointing to migration 14's re-emit. The same forward-reference is missing on the two other functions that migration 14 materially modifies:

- `profile_self_update_allowed` (lines 15-39): migration 14 re-emits this with a semantically different body that adds the `current_user = session_user` branch. A reader of migration 02 alone would mis-model the protected-column policy.
- 3-param `update_profile_after_auth` (lines 56-75): migration 14 explicitly `DROP FUNCTION` this overload (migration 14 line 17) and replaces it with a 4-param signature. A reader of migration 02 alone would believe the 3-param overload is callable.

A future-reader following migration order chronologically gets no signal that these definitions are later replaced/dropped — the same code-archaeology gap that iteration-1 IN-01 closed for `handle_new_user`.

**Fix:** Add forward-reference NOTE comments above each affected `CREATE OR REPLACE FUNCTION` block in migration 02, mirroring the style of lines 85-90. Example for `update_profile_after_auth`:
```sql
-- NOTE: this 3-param overload is dropped by the later
-- harden_security_definer_search_path migration and replaced with a 4-param
-- signature including p_guild_member. Preserved here for historical reference.
```
Example for `profile_self_update_allowed`:
```sql
-- NOTE: re-emitted by the later harden_security_definer_search_path migration
-- with a current_user = session_user guard that allows SECURITY DEFINER callers
-- to bypass the is_admin/mfa_verified/guild_member checks. See the later migration
-- for the live body.
```

### IN-03: Fixture comment retains a `:line-range` cross-reference to migration 10

**File:** `tests/sql/is_current_user_admin_regression.sql:84`
**Issue:** Iteration-1 IN-02 dropped the `:137` line-number suffix from the fixture's cross-reference to migration 02 in two places (lines 29-35 and 63-67). The same brittle pattern remains on line 84, which still reads `per migration 10 lines 47-56`. Line numbers in cross-references rot whenever the target file is edited — the same hazard IN-02 fixed elsewhere. The reference was likely present before iteration 1 (not introduced by the fix), but it is in scope for iteration 2 because the same convention is now applied inconsistently within the same file.

**Fix:** Drop the line range; the migration filename pattern and column-list context are sufficient signal:
```sql
-- NOTE: columns are (actor_id, action, target_type, target_id, before, after)
-- per the audit_log migration (00000000000010_*) -- two JSONB diff columns,
-- NOT a single body column.
```

---

## Iteration-1 Fix Verification

| ID | Item | Closed | Notes |
|----|------|--------|-------|
| WR-01 | WHY comment on dropped `RAISE WARNING` | YES | Migration 14 lines 22-27. Documentary only; names two concrete remediation paths. No behavioral suggestion. Production-deploy invariant respected. |
| WR-02 | Fixture seeds `raw_user_meta_data` for trigger COALESCE | YES | Fixture lines 55-60. Root-cause fix at `auth.users` seed — trigger derives intended snowflake on first INSERT, so ON CONFLICT correctly omits `discord_id`. |
| IN-01 | Cross-reference NOTE in `00000000000002_triggers.sql` | YES (partial — see new IN-02 above) | Forward-ref added for `handle_new_user`; same pattern still missing for `profile_self_update_allowed` and 3-param `update_profile_after_auth`. |
| IN-02 | Drop `:137` line-number suffix in fixture | YES (partial — see new IN-03 above) | Two references fixed (lines 29-35, 63-67); one remaining at line 84 referencing migration 10. |
| IN-03 | Rename canary `target_type` to phase-agnostic | YES | `'rls-regression-canary'` at fixture line 89. |
| IN-04 | (No-op acknowledgement of clean header) | N/A | No action was required; still clean. |
| IN-05 | Brittle-dependency WHY on `auth.users` INSERT | YES | Fixture lines 48-54. Names `confirmation_token` / `email_change_token_new` as watch-list examples. |

---

## Cross-File Analysis Notes (deep-depth re-check)

Iteration-1 deep-depth concerns explicitly re-verified — all still CLEAN:

1. **Unqualified references under `search_path = ''`** — all six function bodies in migration 14 use `public.<table>` and `auth.uid()`. No 42P01 risk. Confirmed re-read.

2. **`DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT)`** still targets only the 3-param overload; the 4-param signature `(BOOLEAN, TEXT, TEXT, BOOLEAN)` is a distinct pg_proc row, unaffected. `CREATE OR REPLACE` preserves grants on the 4-param.

3. **`is_current_user_admin` body-identicality** — body normalized matches migration 9's deployed form modulo `SET search_path = ''`. Volatility (`STABLE`), `SECURITY DEFINER`, and `RETURNS BOOLEAN` preserved. OID-preserving `CREATE OR REPLACE` keeps RLS policy binding stable.

4. **`profile_self_update_allowed` divergence from migration 02** — semantically intentional (adds `current_user = session_user` gate). Now flagged as new IN-02 for forward-reference gap. Body matches the migration-04 form modulo `SET search_path = ''`.

5. **`increment_vote_count` / `validate_vote_choice`** — bodies byte-identical to migration 02 modulo `SET search_path = ''`. Tables already qualified.

6. **Idempotency** — every statement is `CREATE OR REPLACE` or `DROP … IF EXISTS`. Re-applicable N times.

7. **Trigger graph preservation** — triggers (`on_auth_user_created`, `on_profile_self_update`, `on_vote_validate_choice`, `on_vote_inserted`) bind by name → pg_proc OID. `CREATE OR REPLACE` preserves OID. Triggers continue to bind.

8. **RLS policy binding preservation** — policies that reference `public.is_current_user_admin()` (migration 5, migration 10's audit_log policy) still bind correctly.

9. **`SET LOCAL ROLE authenticated` sequencing in fixture** — helper `pg_temp.assert_admin` correctly: `set_config(claim)` → `SET LOCAL ROLE authenticated` → call → `RESET ROLE`. Exception path covered by transaction-wide `ROLLBACK` under `ON_ERROR_STOP=1`.

10. **JWT claim wiring** — both `request.jwt.claim.sub` and `request.jwt.claims` are set (defensive — `auth.uid()` reads either form).

11. **`current_setting('role')` trigger guard** — `on_profile_self_update` fires only when `current_setting('role') = 'authenticated'`; fixture's privileged INSERT runs as postgres/supabase_admin (role GUC `'default'`), so the trigger does not fire on fixture seed rows. WR-02's root-cause fix path is safe regardless of `profile_self_update_allowed` body.

12. **WR-02 trace** — re-walked the trigger sequence post-fix:
    - `INSERT INTO auth.users (..., raw_user_meta_data, ...) VALUES (..., '{"provider_id":"900000000000000001"}'::jsonb, ...)`
    - `on_auth_user_created` fires `handle_new_user()` (migration-14 body): `_discord_id := COALESCE(NEW.raw_user_meta_data->>'provider_id', ...)` → `'900000000000000001'` (no fallback to `NEW.id::TEXT`).
    - Trigger INSERTs profile with `discord_id = '900000000000000001'`.
    - Fixture's profiles INSERT hits ON CONFLICT; SET list updates `is_admin/mfa_verified/guild_member/discord_username/avatar_url`. `discord_id` is preserved at `'900000000000000001'` — the snowflake the author intended.
    - `is_current_user_admin()` reads `is_admin AND mfa_verified AND guild_member` — unaffected by `discord_id`, so assertions stand. But the fixture now also has correct `discord_id` values for any future extension. Confirmed: root-cause fix at the right layer.

13. **WR-01 trace** — re-read migration 14 lines 22-27 comment block in context. The comment correctly identifies the silent fallback, the failure mode (UUID-string in `discord_id` after a Supabase Auth claim-shape change), the resulting admin-lookup miss, and the absence of pg log signal. Two remediation paths suggested (audit_log INSERT, Sentry breadcrumb). Comment is anchored immediately above the COALESCE chain, so it remains discoverable when reading the function body. No behavioral change suggested in the comment text itself — it documents an open follow-up. Compliant with CLAUDE.md WHY-only convention.

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Iteration: 2_
