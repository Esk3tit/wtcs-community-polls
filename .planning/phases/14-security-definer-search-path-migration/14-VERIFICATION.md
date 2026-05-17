---
phase: 14-security-definer-search-path-migration
verified: 2026-05-17T00:00:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
nyquist_compliant: N/A
nyquist_rationale: |
  Phase 14 is a database hardening phase — six `CREATE OR REPLACE FUNCTION`
  blocks plus one `DROP FUNCTION IF EXISTS`, no application code changes, no
  Edge Function changes, no client-side changes. Behavioral correctness is
  verified by a direct SQL regression fixture (4 identity branches + 2
  audit_log RLS branches under `SET LOCAL ROLE authenticated`) and by the
  production smoke vote round-trip, both of which exercise the hardened
  functions through their real RLS-gated call sites. The Nyquist sampling
  rule (which governs branch coverage in component/E2E test suites) does
  not apply to DDL hardening — the fixture is exhaustive over the identity
  state space the function reads (`is_admin × mfa_verified × guild_member`),
  not a sample of it.
---

# Phase 14: Security-Definer Search-Path Migration — Verification Report

**Phase Goal:** Migration 14 rewrites the 6 user-owned pre-Phase-11
`SECURITY DEFINER` functions with `SET search_path = ''` and fully-qualified
body references; `supabase db lint --linked` shows zero
`0011_function_search_path_mutable` WARNs; `submit-vote` smoke round-trip
passes post-deploy. Per W0 finding, the original "7 functions" count was
amended to 6 (the 7th, `rls_auto_enable`, is a dashboard-installed event
trigger owned by `postgres` with `SET search_path TO 'pg_catalog'` already
set — carved out as Supabase-managed via DBHY-02 W0 amendment).

**Verified:** 2026-05-17
**Status:** passed
**Re-verification:** No — initial verification (consolidation of inline
execute-phase Task 08b gate evidence + `/gsd-verify-work` UAT + STRIDE
audit; no checks re-run during this pass).

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + DBHY-* requirements)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Migration 14 exists, applies to production, and contains the 6 user-owned `SECURITY DEFINER` function rewrites with `SET search_path = ''` plus an unconditional `DROP` of the stale 3-param `update_profile_after_auth` overload. | VERIFIED | `supabase/migrations/00000000000014_harden_security_definer_search_path.sql` (197 lines). 14-01-SUMMARY.md acceptance table: 6 `CREATE OR REPLACE FUNCTION` + 6 `SECURITY DEFINER` + 6 `SET search_path = ''` + 1 unconditional 3-param DROP. Production deploy: `evidence/db-push-output.txt` shows clean single-migration apply. Production catalog: `evidence/catalog-assertion-prod.txt` confirms exactly 6 rows, all `is_security_definer=t` and `config={"search_path=\"\""}`. |
| 2 | Post-deploy `supabase db lint --linked` reports zero `0011_function_search_path_mutable` WARNs across the schema (DBHY-02). | VERIFIED | `evidence/post-deploy-lint.txt` lines 9-12: `Linting schema: extensions / Linting schema: public / No schema errors found`. CLI v2.85.0 against project `cbjspmwgyoxxqukcccjr`. The `rls_auto_enable` carve-out in DBHY-02 was preserved as documented insurance but was not needed at the post-deploy lint (zero WARNs total, including for `rls_auto_enable`). |
| 3 | `submit-vote` smoke round-trip passes post-deploy on polls.wtcsmapban.com (DBHY-03), exercising `validate_vote_choice` (hardened) + `increment_vote_count` (hardened) + `is_current_user_admin` RLS (hardened) end-to-end. | VERIFIED | `evidence/smoke-vote-roundtrip.md` + `evidence/smoke-vote-roundtrip.png`: vote on "Tes / test" poll rendered "Yes 100% (1) — 1 total response". UAT Test 4 PASS (`14-UAT.md` lines 55-63). Production trigger graph (BEFORE-INSERT validate_vote_choice → INSERT into public.votes → AFTER-INSERT increment_vote_count → write to public.vote_counts → RLS read gated by is_current_user_admin) fully exercised. |
| 4 | `is_current_user_admin()` rewrite is body-identical across the deploy boundary (only `SET search_path` value changes from `'public'` to `''`), preserving admin RLS semantics on every admin-gated table. | VERIFIED | `evidence/icua-body-identical-diff-prod.txt`: `is_current_user_admin production body-identical diff exit code: 0` — `diff -u` of pre-deploy vs post-deploy functiondef snapshots, normalized at the `SET search_path` line, produces zero output. Local equivalent: `evidence/icua-body-identical-diff.txt` exit 0. Catalog assertion confirms `volatility=s` (STABLE preserved) on `is_current_user_admin` (`evidence/catalog-assertion-prod.txt` line 8). Backed by `tests/sql/is_current_user_admin_regression.sql` — 6 PASS / 0 FAIL / psql exit 0 against the local DB applying the migration end-to-end. |
| 5 | Stale 3-param `update_profile_after_auth(BOOLEAN, TEXT, TEXT)` overload has been unconditionally dropped; only the 4-param signature remains. | VERIFIED | `evidence/catalog-assertion-prod.txt` line 10: exactly one row for `update_profile_after_auth` with `num_args=4` and `identity_args=p_mfa_verified boolean, p_discord_username text, p_avatar_url text, p_guild_member boolean`. `evidence/update_profile_after_auth_overloads.txt` records W0 OUTCOME U2 (both overloads existed pre-deploy) + CLEAN 3-param caller audit across src/ and tests/. Migration line 17 emits `DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT);` per Cycle-3 Option A. Discord OAuth callback path verified post-deploy in UAT Test 3 (sign-in flow PASS). |
| 6 | `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-PATTERNS.md` `vote_counts` policy skeleton aligned with shipped REVIEW-FIX-H3 form (DBHY-04 doc fix). | VERIFIED | Commit `7788ec7` (docs) — line 83 prose corrected from "(whichever is current)" to "(both superseded). The shipped policy (migration 10, REVIEW-FIX-H3) has NO `is_current_user_admin()` OR-bypass…". Dated changelog header added at top of file. Doc-only fix; no migration emitted. |

**Score:** 6/6 must-haves verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00000000000014_harden_security_definer_search_path.sql` | 6 `CREATE OR REPLACE FUNCTION` + 1 unconditional DROP; all 6 carry `SECURITY DEFINER` + `SET search_path = ''`; `is_current_user_admin` body-identical to migration 09 modulo search_path value. | VERIFIED | 197 lines. Acceptance grep table in 14-01-SUMMARY.md confirms 6/6/6 counts + 1 DROP + 0 plan-archaeology rot tags. Applied to production (`evidence/db-push-output.txt`). |
| `tests/sql/is_current_user_admin_regression.sql` | Direct SQL regression fixture covering 4 identity branches + 2 audit_log RLS branches under `SET LOCAL ROLE authenticated`. | VERIFIED | 181 lines. Execution evidence (`evidence/is_current_user_admin_regression.txt`): 6 PASS notices (admin/non_admin/mfa_false/guild_false + audit_log/admin canary visible + audit_log/non_admin canary correctly hidden), 0 FAIL exceptions, transaction `ROLLBACK`, psql exit 0. Helper `pg_temp.assert_admin` at lines 106-122. 5 occurrences of `SET LOCAL ROLE authenticated` prove RLS-correctness, not privileged-bypass. |
| `evidence/pre-deploy-functiondef-snapshot.sql` | Service-role-usable rollback artifact, committed BEFORE the feat(db) migration commit per D-08 fix-forward strategy. | VERIFIED | 5.5KB at commit `a258c94` (chore) — feat migration commit is `c94c8f7`, so rollback artifact precedes the schema change in git history. Contains pasteable CREATE OR REPLACE blocks for all 6 pre-deploy function bodies. |
| `evidence/post-deploy-lint.txt` | `supabase db lint --linked` post-deploy stdout. | VERIFIED | "No schema errors found" — zero `0011_function_search_path_mutable` WARNs. |
| `evidence/catalog-assertion-prod.txt` + `evidence/catalog-assertion-local.txt` | `pg_proc` query covering `prosecdef` / `provolatile` / `proconfig` / `proowner` / `proacl` for all 6 functions in both environments. | VERIFIED | Both files show 6 rows with `is_security_definer=t`, `config={"search_path=\"\""}`, owner=postgres, broad-grant ACL preserved, `update_profile_after_auth` num_args=4 only, `is_current_user_admin` volatility=s. |
| `evidence/icua-body-identical-diff-prod.txt` | Machine-enforced body-identical diff for `is_current_user_admin` across the production deploy boundary. | VERIFIED | Exit code 0, zero output (after `SET search_path` line normalization). |
| `evidence/smoke-vote-roundtrip.{md,png}` | Production smoke vote evidence (rendered UI screenshot + narrative). | VERIFIED | Vote on "Tes / test" poll rendered "Yes 100% (1) — 1 total response" on polls.wtcsmapban.com. |
| `evidence/db-push-output.txt` | `supabase db push` stdout for Migration 14 apply to production. | VERIFIED | Clean single-migration apply, no error. |
| `evidence/W0-local-checks.md` + `evidence/W0-prod-queries.sql` + `evidence/update_profile_after_auth_overloads.txt` | W0 pre-flight 5-check gate artifacts (ownership classification, overload enumeration, extension-function audit, pre-deploy functiondef snapshot, local-stack reachability). | VERIFIED | All five checks documented. Extension-function audit (W0 Check 2) returned 0 matches for `gen_random_uuid` / `uuid_generate_v4` / `citext` / bare `uid()` across the 4 source migrations. Overload audit found OUTCOME U2 with CLEAN 3-param caller audit. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Discord OAuth callback (`/auth/callback`) | `auth.users` row creation | `handle_new_user` trigger (hardened) | WIRED | UAT Test 3 PASS — sign-in flow completes post-deploy; new-user trigger writes to `public.profiles` correctly under `search_path = ''` with fully-qualified table references. |
| `useVoteSubmit` hook → Edge Function `submit-vote` | `public.votes` insert + `public.vote_counts` write | `validate_vote_choice` (BEFORE-INSERT) + `increment_vote_count` (AFTER-INSERT) triggers | WIRED | Production smoke vote: "Yes 100% (1) — 1 total response" rendered. UAT Test 4 PASS. Trigger graph preserved (OID-preserving CREATE OR REPLACE per Decision D-Phase-14). |
| `is_current_user_admin()` SECURITY DEFINER call | Admin-gated RLS reads on `audit_log`, `admin_discord_ids`, and admin-only suggestion/category mutations | RLS policies binding by OID | WIRED | Body-identical rewrite (diff exit 0). UAT Test 5 PASS — admin dashboard loads, admin-only UI elements (Create poll, Manage categories, Admins list, Resolution toggle) render. Regression fixture audit_log/admin branch returned 1 canary row visible; audit_log/non_admin branch returned 0 rows (RLS correctly hides). |
| Discord OAuth profile update | `public.profiles` row | `update_profile_after_auth` (4-param, hardened) | WIRED | 3-param overload removed; 4-param surface is the only path. UAT Test 3 PASS confirms callback path executes the 4-param function correctly under `search_path = ''`. |

---

## Requirements Coverage

| Requirement | Source | Status | Evidence |
|-------------|--------|--------|----------|
| DBHY-01: Migration 14 `CREATE OR REPLACE` for 6 user-owned SECURITY DEFINER functions with `SET search_path = ''`, fully-qualified bodies, body-identical `is_current_user_admin`, unconditional 3-param overload DROP | 14-01-PLAN.md `requirements:`, REQUIREMENTS.md line 13 `[x]` | SATISFIED | Migration 14 SQL acceptance table (14-01-SUMMARY.md). Production catalog assertion. Body-identical diff exit 0. 3-param overload absent post-deploy. |
| DBHY-02: Zero `0011_function_search_path_mutable` WARNs for all user-owned target functions; `rls_auto_enable` carve-out permitted | 14-01-PLAN.md `requirements:`, REQUIREMENTS.md line 17 `[x]` | SATISFIED | `evidence/post-deploy-lint.txt`: "No schema errors found" — zero WARNs total. Carve-out preserved as documented insurance per REQUIREMENTS.md DBHY-02 changelog. |
| DBHY-03: `submit-vote` smoke round-trip passes post-Migration-14; parallel RLS regression to confirm `is_current_user_admin()` semantics did not drift | 14-01-PLAN.md `requirements:`, REQUIREMENTS.md line 21 `[x]` | SATISFIED | Production smoke vote PASS (`evidence/smoke-vote-roundtrip.{md,png}`). Regression fixture (`tests/sql/is_current_user_admin_regression.sql`) 6 PASS / 0 FAIL — supersedes the TEST-11 12-cell vitest run (deferred to v1.4+ per local gotrue `email_provider_disabled` block; same precedent as Local ES256 deferral). |
| DBHY-04: `11-PATTERNS.md` `vote_counts` policy skeleton aligned with shipped REVIEW-FIX-H3 form | 14-01-PLAN.md `requirements:`, REQUIREMENTS.md line 24 `[x]` | SATISFIED | Commit `7788ec7` line 83 prose fix + dated changelog header. Doc-only. |

REQUIREMENTS.md checkbox state confirmed: DBHY-01..04 all `[x]`. Traceability table rows (REQUIREMENTS.md lines 119-122) still read "Pending" — those rows are static labels written at plan time and are not the source of truth for completion; the checkbox state and `requirements-completed:` array in 14-01-SUMMARY.md are.

No orphaned requirements: Phase 14 ROADMAP entry maps exclusively to DBHY-01..04, all four declared in the plan's `requirements:` field, all four marked `[x]` in REQUIREMENTS.md, all four cited in 14-01-SUMMARY.md `requirements-completed:`.

---

## Critical Constraints Audit

| Constraint | Status | Evidence |
|------------|--------|----------|
| Migration uses `CREATE OR REPLACE FUNCTION` (not `ALTER` / `DROP+CREATE`) for all 6 retained functions to preserve OID + trigger bindings | PASS | Decision D-Phase-14. Trigger graph (`on_auth_user_created`, `on_profile_self_update`, `on_vote_validate_choice`, `on_vote_inserted`) continues to bind post-deploy — smoke vote round-trip proves the trigger graph still fires. |
| `is_current_user_admin()` rewrite is body-identical (only `SET search_path` value changes from `'public'` to `''`) | PASS | `evidence/icua-body-identical-diff-prod.txt` exit 0. Volatility (`STABLE`), `SECURITY DEFINER`, `RETURNS BOOLEAN`, COALESCE body all preserved. |
| All function bodies under `search_path = ''` use fully-qualified references (`public.<table>`, `auth.<table>`, `auth.uid()`) | PASS | 14-REVIEW.md Cross-File Analysis Note #1 confirms all 6 bodies use schema-qualified objects; no 42P01 risk. W0 Check 2 confirmed 0 bare extension calls and 0 bare `uid()` references. |
| Three-commit deploy split: feat(db) migration + chore evidence + docs(<area>) doc-fix — each independently revertable (D-07) | PASS | Commits `c94c8f7` (feat) / `b4a81e9` (chore — Wave-1 local apply evidence) / `7788ec7` (docs — 11-PATTERNS.md DBHY-04). Pre-deploy snapshot at `a258c94` committed BEFORE the feat commit per Cycle-1 rollback hardening. |
| Production schema_migrations history is clean linear `00..00` → `00..14` post-deploy | PASS | UAT Test 6 PASS — `npx supabase migration list --linked` shows clean linear history; orphan timestamp entries (April–May 2026) repaired via `supabase migration repair --status applied 00000000000005..00000000000013` followed by `--status reverted` on the 9 timestamps. |
| No application/Edge-Function/client-side changes (DDL hardening only) | PASS | 14-01-SUMMARY.md Files Created/Modified: only the migration SQL, regression fixture SQL, REQUIREMENTS.md, and 11-PATTERNS.md were touched. No `src/` or `supabase/functions/` changes. |
| Pre-deploy rollback artifact committed BEFORE feat commit (D-08 fix-forward strategy) | PASS | `evidence/pre-deploy-functiondef-snapshot.sql` committed at `a258c94`; feat commit is `c94c8f7`. Service-role-usable CREATE OR REPLACE blocks for all 6 pre-deploy bodies. |

---

## Anti-Patterns Found

None. Anti-pattern scan against the migration SQL and the regression fixture (the two files Phase 14 created in source-tracked code paths) returned zero matches for `TBD` / `FIXME` / `XXX` / plan-archaeology rot tags (`Cycle-N`, `Round-N`, phase IDs in source comments) / `TODO` / placeholder stubs.

`14-REVIEW.md` iteration 3 (final, converged at `--auto` cap) records **0 Critical / 0 Warning / 0 Info** findings across 5 files reviewed. Iterations 1 and 2 surfaced documentary/cross-reference issues only (IN-01 stale `COMMENT ON FUNCTION` text in migration 02; IN-02 forward-reference NOTE blocks in migrations 03/04; IN-03 line-number suffix in fixture cross-reference) — all closed at iteration 2 and re-verified clean at iteration 3.

`14-SECURITY.md` records **10/10 STRIDE threats CLOSED** (9 `mitigate` verified with cited file/line evidence + 1 `accept` on T-14-SC supply-chain with documented rationale: zero new package installs in Phase 14). Zero unregistered threat flags.

---

## Behavioral Spot-Checks

Spot-checks performed inline during execute-phase Task 08b (post-deploy gate) and re-confirmed during `/gsd-verify-work` UAT:

| Behavior | Command / Path | Result | Status |
|----------|----------------|--------|--------|
| Migration 14 applies cleanly to production | `npx supabase db push` against project `cbjspmwgyoxxqukcccjr` | Single-migration apply, exit 0 (`evidence/db-push-output.txt`) | PASS |
| Post-deploy lint clean | `npx supabase db lint --linked` | "No schema errors found" (`evidence/post-deploy-lint.txt`) | PASS |
| Production catalog state matches expectation | `pg_proc` query in Studio SQL editor | 6 rows, all `is_security_definer=t` + `config={"search_path=\"\""}` + owner=postgres + broad-grant ACL preserved (`evidence/catalog-assertion-prod.txt`) | PASS |
| `is_current_user_admin` body unchanged across deploy boundary | `diff -u` pre-deploy vs post-deploy functiondef snapshots, normalized | exit 0, zero output (`evidence/icua-body-identical-diff-prod.txt`) | PASS |
| Direct SQL regression fixture | `psql ... < tests/sql/is_current_user_admin_regression.sql` | 6 PASS notices, 0 FAIL exceptions, ROLLBACK, exit 0 (`evidence/is_current_user_admin_regression.txt`) | PASS |
| Production smoke vote round-trip | Discord-authed admin votes on "Tes / test" poll on polls.wtcsmapban.com | UI rendered "Yes 100% (1) — 1 total response" (`evidence/smoke-vote-roundtrip.{md,png}`) | PASS |
| Cold-start smoke (local stack from fresh migrations 00..00 → 00..14) | `docker exec ... psql ... < tests/sql/is_current_user_admin_regression.sql` against fresh local DB | 6 PASS / 0 FAIL / exit 0 (UAT Test 1) | PASS |

All spot-checks complete in well under 10s wall-clock individually; cumulative gate cost was the production deploy round-trip (~minutes), not the verification overhead.

---

## Probe Execution

Phase 14 did not declare PLAN-level probes under `scripts/*/tests/probe-*.sh`. The DDL hardening domain is verified by direct SQL regression fixture + production smoke + machine-enforced functiondef diff — all enumerated in Behavioral Spot-Checks above. The fixture (`tests/sql/is_current_user_admin_regression.sql`) serves the same role as a probe and was executed during the verification (output captured at `evidence/is_current_user_admin_regression.txt`).

Step 7c: NO_PROBES_DECLARED — by-design for DDL hardening phases; covered by regression fixture + smoke vote round-trip.

---

## Human Verification Required

None. All six observable truths verified programmatically against shipped evidence:

- Truths 1, 4, 5 verified by `pg_proc` catalog assertion + functiondef-snapshot diff (machine-enforced).
- Truth 2 verified by `supabase db lint --linked` stdout.
- Truth 3 verified by production smoke vote with rendered-UI screenshot (`smoke-vote-roundtrip.png`) — the screenshot has already been captured and committed as evidence, so the verification step is reading the evidence file, not asking the user to re-perform the test.
- Truth 6 verified by file-content grep on `11-PATTERNS.md` line 83 against commit `7788ec7`.

UAT Tests 1-6 (UAT) recorded 6/6 PASS independently during `/gsd-verify-work`. STRIDE audit recorded 10/10 threats CLOSED during `/gsd-secure-phase`. This VERIFICATION.md is a consolidation pass; no further human testing required to close Phase 14.

---

## Gaps Summary

No gaps. All 6 observable truths verified with cited evidence. All four DBHY requirements (DBHY-01..04) marked `[x]` in REQUIREMENTS.md and declared in 14-01-SUMMARY.md `requirements-completed:`. Migration 14 is live in production; lint clean; smoke vote round-trip PASS; body-identical claim mechanically verified; 3-param overload removed; doc-fix shipped. Phase goal achieved.

Two deferred follow-ups carried forward (out of scope for Phase 14 closure):

1. **TEST-11 12-cell vitest run** — local gotrue `email_provider_disabled` blocks the test from running locally. Deferred to v1.4+ per the existing Local ES256 deferral precedent. Task 07b regression fixture (`tests/sql/is_current_user_admin_regression.sql`) provides strictly stronger evidence for the specific is_current_user_admin() correctness question (direct SQL, RLS-asserted under `SET LOCAL ROLE authenticated`, 4 identity branches + 2 audit_log RLS branches).
2. **No paired rollback migration** — D-08 fix-forward strategy. Rollback path is `evidence/pre-deploy-functiondef-snapshot.sql` pasted into Studio SQL editor under a service-role session.

Both deferrals are documented in 14-01-SUMMARY.md "Decisions Made" and "Follow-ups" and are explicit non-scope for Phase 14 closure.

---

_Verified: 2026-05-17_
_Verifier: Claude (gsd-verifier)_
