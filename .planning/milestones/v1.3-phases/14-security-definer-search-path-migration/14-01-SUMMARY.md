---
phase: 14-security-definer-search-path-migration
plan: 01
subsystem: database

tags:
  - migration
  - security-definer
  - search-path
  - supabase
  - postgres
  - hygiene
  - 0011-advisor

# Dependency graph
requires:
  - phase: 02-browsing-responding (migration 2 triggers)
    provides: increment_vote_count, validate_vote_choice, handle_new_user
  - phase: 03-response-integrity (migration 3)
    provides: update_profile_after_auth (4-param) + stale 3-param overload
  - phase: 04-admin-suggestion-mgmt (migration 4)
    provides: profile_self_update_allowed
  - phase: 09-admin-integrity-rls (migration 9, archived in v1.2-phases)
    provides: is_current_user_admin
  - phase: 11-schema-rls-ef-foundations (migration 10, archived in v1.2-phases)
    provides: audit_log (admin-gated table used by Task 07b RLS regression)
provides:
  - supabase/migrations/00000000000014_harden_security_definer_search_path.sql — pins SET search_path = '' on 6 user-owned SECURITY DEFINER functions
  - Unconditional DROP of stale 3-param update_profile_after_auth overload
  - tests/sql/is_current_user_admin_regression.sql — direct SQL fixture exercising 4 identity branches + 2 audit_log RLS branches
  - DBHY-02 acceptance amended with rls_auto_enable carve-out (W0 finding)
  - 11-PATTERNS.md vote_counts skeleton aligned with shipped REVIEW-FIX-H3 form (DBHY-04 doc-fix)
affects:
  - All admin-gated RLS reads (gated by is_current_user_admin — body-identical rewrite preserves semantics)
  - Discord OAuth callback path (update_profile_after_auth — only 4-param signature remains)
  - Vote write path (submit-vote → increment_vote_count → public.vote_counts)
  - Phase 15+ (no further migrations expected for the hardened functions)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER functions pin `SET search_path = ''` and rely on fully-qualified body references (public.<table>, auth.<table>) — established by migrations 5, 7, 8, 9, 12, 13 and now applied retroactively to the 6 pre-Phase-11 functions"
    - "CREATE OR REPLACE FUNCTION (not ALTER FUNCTION) preserves OID and keeps trigger/policy references intact (Decision D-Phase-14)"
    - "Body-identical hardening rule for is_current_user_admin — only the search_path value changes from 'public' to '' so admin RLS semantics are preserved across all admin-gated tables"
    - "Pre-deploy production functiondef snapshot captured as `evidence/pre-deploy-functiondef-snapshot.sql` and committed BEFORE the feat(db) migration commit — service-role-usable rollback artifact per D-08 fix-forward strategy"
    - "Machine-enforced body-identical diff: pre-deploy vs post-deploy is_current_user_admin functiondef, normalized at the SET search_path line, then `diff -u` — exit 0 = zero body drift"
    - "Catalog-assertion pattern: pg_proc query covering prosecdef / provolatile / proconfig / proowner / proacl detects missing SECURITY DEFINER, stripped STABLE, missing search_path, drifted ownership, and accidental overload count in one query"
    - "Unconditional `DROP FUNCTION IF EXISTS public.<name>(<types>);` at the top of the migration cleans stale overloads — Cycle-3 Option A makes the SQL identical between U1 and U2 outcomes of the overload-enumeration check"

key-files:
  created:
    - supabase/migrations/00000000000014_harden_security_definer_search_path.sql
    - tests/sql/is_current_user_admin_regression.sql
    - .planning/phases/14-security-definer-search-path-migration/evidence/* (full Wave 0 → Wave 3 artifact set)
  modified:
    - .planning/REQUIREMENTS.md (DBHY-01 function count 7→6 + 3-param overload DROP note; DBHY-02 rls_auto_enable carve-out)
    - .planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-PATTERNS.md (DBHY-04 prose drift fix at line 83 + dated changelog header)

key-decisions:
  - "rls_auto_enable carved out as R2 system-owned by user decision at the W0 gate — function is not present in any local migration file, is owned by `postgres` (Supabase-internal role), and already has `SET search_path TO 'pg_catalog'`. The strict Cycle-3 multi-signal rule resolved to R1 mechanically (only `proowner=postgres` fires, no corroborating signal from (a)/(b)/(d)/(e)) but R2 was chosen for safety: the function is an event trigger on DDL — taking ownership of dashboard-installed infrastructure carries more risk than the residual advisor finding."
  - "update_profile_after_auth — W0 Check 1B found OUTCOME U2 (3+4-param both present in production). 3-param caller audit was CLEAN (only 4-param sites in src/ + tests). Migration 14 issues an unconditional `DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT);` per Cycle-3 Option A — the same SQL applies under U1 and U2 outcomes."
  - "Production functiondef bodies (W0 Check 3 snapshot) used verbatim as the source of truth for the 6 function bodies — handle_new_user's production body lacks the RAISE WARNING line present in migration-2 source; preserving the production body avoids re-introducing removed behavior. Migration 14 is a hardening pass, not a behavioral change."
  - "TEST-11 local re-run deferred to v1.4+ — local gotrue rejects signInWithPassword with email_provider_disabled (HTTP 422) despite `GOTRUE_EXTERNAL_EMAIL_ENABLED=true` in the auth container env; multiple [auth.email] config.toml variants tried, none flipped the runtime behavior. Same precedent as the existing Local ES256 deferral. Task 07b regression fixture provides strictly stronger evidence for the is_current_user_admin() correctness question (direct SQL, 4 identity branches + 2 audit_log RLS branches)."
  - "Migration history bookkeeping reconciliation — production `schema_migrations` had 9 orphan timestamp-format entries (April–May 2026) from earlier migrations that were renamed locally to 00..0N format but kept their timestamp version IDs in remote. Resolved with `supabase migration repair --status applied 00000000000005..00000000000013` followed by `--status reverted` on the 9 timestamps, then `supabase db push` — clean linear `00..00` → `00..14` history afterward."

patterns-established:
  - "Pre-flight 5-check W0 gate before any production-touching DDL: (1) ownership classification with multi-signal rule for ambiguous functions, (2) overload enumeration per signature, (3) extension-function audit (gen_random_uuid / uuid_generate_v4 / citext / bare uid()), (4) pre-deploy functiondef snapshot committed BEFORE the feat commit, (5) local stack reachability"
  - "Local apply + lint + machine-enforced body-identical diff + catalog assertion + signature check before pushing to production"
  - "Three-commit deploy split (per D-07): feat(db) migration + chore evidence + docs(<area>) doc-fix — each independently revertable"
  - "Direct SQL regression fixture for SECURITY DEFINER + RLS gating: BEGIN/ROLLBACK wrapper, FK-correct seed order (auth.users before public.profiles), ON CONFLICT DO UPDATE to override trigger-inserted defaults, SET LOCAL ROLE authenticated around every RLS-asserting SELECT to prevent privileged-bypass false-greens, top-level PERFORM avoided (use SELECT set_config or DO blocks)"

requirements-completed: [DBHY-01, DBHY-02, DBHY-03, DBHY-04]

# Metrics
duration: ~3h (incl. blocking checkpoint waits, prod query round-trips, migration-history repair)
completed: 2026-05-17
---

# Phase 14 Plan 01: Security-Definer Search-Path Lockdown Summary

**Migration 14 rewrites 6 pre-Phase-11 `SECURITY DEFINER` functions to pin `SET search_path = ''` with fully-qualified body references; unconditionally drops a stale 3-param `update_profile_after_auth` overload; adds a direct SQL regression fixture for `is_current_user_admin()`; aligns the legacy `11-PATTERNS.md` `vote_counts` skeleton with the shipped REVIEW-FIX-H3 form; and amends DBHY-02 with an `rls_auto_enable` carve-out for a dashboard-installed event trigger that falls outside the repo migration history.**

## Performance

- **Duration:** ~3h (planning + W0 prod-query round-trip + production deploy + post-deploy verification)
- **Started:** 2026-05-17 (after W0 production catalog queries returned)
- **Completed:** 2026-05-17 (post-deploy smoke vote PASS on polls.wtcsmapban.com)
- **Tasks executed:** W0, 01, 02-05, 06, 07a (deferred), 07b, 08a, 08b, 09
- **Files created:** 2 (migration + regression fixture) + 18 evidence artifacts
- **Files modified:** 2 (REQUIREMENTS.md, 11-PATTERNS.md)

## Accomplishments

- **Migration 14** (`supabase/migrations/00000000000014_harden_security_definer_search_path.sql`) authored, applied locally, applied to production. All 6 user-owned target functions now carry `SET search_path = ''` with fully-qualified body references. `0011_function_search_path_mutable` advisor: zero WARNs across the schema.
- **`is_current_user_admin()` body-identical** rewrite verified mechanically — pre-deploy production snapshot vs post-deploy snapshot, normalized at the `SET search_path` line, `diff -u` exit 0, zero output. Admin RLS semantics across every admin-gated table preserved.
- **`update_profile_after_auth` 3-param overload** unconditionally dropped — production now has only the 4-param signature. Caller audit (`git grep`) found zero 3-param invocations across src/ and tests/.
- **`is_current_user_admin` regression fixture** (`tests/sql/is_current_user_admin_regression.sql`) authored and passing locally — 4 identity branches (admin/non-admin/mfa_false/guild_false) + 2 audit_log RLS branches (admin sees canary row; non-admin does not). Runs under `SET LOCAL ROLE authenticated` to prove RLS-correctness, not privileged-bypass behavior. psql exit 0, 6 PASS notices, 0 FAIL exceptions, ROLLBACK at end.
- **DBHY-04 prose drift** in `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-PATTERNS.md` line 83 corrected — "(whichever is current)" → "(both superseded). The shipped policy (migration 10, REVIEW-FIX-H3) has NO `is_current_user_admin()` OR-bypass...". Dated changelog header added at top.
- **DBHY-02 acceptance** amended to permit one residual `0011` WARN for `rls_auto_enable` (W0 finding — function is dashboard-installed, not in repo migration history). Carve-out is documented insurance — at the time of the post-deploy lint run, the advisor reported zero WARNs total, so the carve-out wasn't even needed.
- **Production smoke vote** (DBHY-03) PASS — admin signed in via Discord on https://polls.wtcsmapban.com, cast a vote on the "Tes / test" poll, UI rendered "Yes 100% (1) — 1 total response". This exercises `validate_vote_choice` (hardened) → INSERT into public.votes → `increment_vote_count` (hardened) → write to `public.vote_counts` → RLS read gated by `is_current_user_admin()` (hardened).
- **Migration history bookkeeping** reconciled — 9 orphan timestamp-format entries in remote `schema_migrations` resolved via `migration repair --status applied` (for the 00..05..00..13 local versions) + `--status reverted` (for the 9 timestamps). Remote history is now a clean linear `00..00` → `00..14` sequence.

## Task Commits

1. **STATE.md start state** — `fd9406c` (chore)
2. **DBHY-02 amendment (rls_auto_enable carve-out)** — `130ece3` (docs)
3. **W0 pre-flight evidence** — `a258c94` (chore) — pre-deploy functiondef snapshot in git history BEFORE the feat commit per Cycle-1 rollback hardening
4. **Migration 14 SQL** — `c94c8f7` (feat)
5. **Wave-1 local apply evidence** — `b4a81e9` (chore) — local lint, local functiondef snapshot, body-identical diff, catalog assertion
6. **DBHY-04 11-PATTERNS.md** — `7788ec7` (docs)
7. **Wave-2 regression fixture + TEST-11 deferral** — `255084d` (chore)
8. Migration applied to production via `supabase db push` (no commit — remote DB state change)

## Files Created/Modified

### Created

- `supabase/migrations/00000000000014_harden_security_definer_search_path.sql` (197 lines)
  - Unconditional `DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT);` at the top
  - 6 `CREATE OR REPLACE FUNCTION` blocks — handle_new_user, increment_vote_count, is_current_user_admin (body-identical, search_path value only), profile_self_update_allowed, update_profile_after_auth (4-param), validate_vote_choice
  - Every block carries `SECURITY DEFINER` + `SET search_path = ''`
- `tests/sql/is_current_user_admin_regression.sql` (regression fixture, see acceptance grep table below)
- 18 evidence artifacts under `.planning/phases/14-security-definer-search-path-migration/evidence/` — Wave 0 → Wave 3 covering pre-deploy snapshots, local + production catalog assertions, body-identical diffs, lint outputs, regression fixture output, db push output, and the smoke-vote screenshot.

### Modified

- `.planning/REQUIREMENTS.md` — DBHY-01 function count 7→6 + Cycle-3 Option A DROP note; DBHY-02 amended with rls_auto_enable carve-out and dated changelog entry
- `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-PATTERNS.md` — line 83 prose fix + dated changelog header (DBHY-04)

## Decisions Made

- **rls_auto_enable as R2** (Supabase-managed carve-out) — see key-decisions for the multi-signal classification trace.
- **Production-body verbatim for all 6 functions** — used the W0 pre-deploy snapshot as the body source of truth rather than re-deriving from migration files (handle_new_user's migration source has a RAISE WARNING line that production lacks; preserving the production body is consistent with the "Migration 14 is a hardening pass, not a behavioral change" framing).
- **TEST-11 deferred to v1.4+** — local gotrue email-provider issue blocks the test from running locally. Task 07b regression fixture provides strictly stronger evidence for the specific Codex HIGH concern about is_current_user_admin() correctness on admin-gated tables. Production smoke vote covers the runtime DBHY-03 gate.
- **Unconditional DROP of 3-param overload** (Cycle-3 Option A) — same SQL applies under U1 and U2 outcomes; 3-param caller audit was CLEAN so the DROP is non-destructive.
- **rls_auto_enable carve-out kept in DBHY-02 wording** even after the post-deploy lint showed zero WARNs — documented insurance against future Supabase advisor changes that might tighten the rule.

## Deviations from Plan

- **TEST-11 12-cell vitest run skipped** (planned in Task 07a) — local gotrue blocks signInWithPassword. Deferred per the existing Local ES256 precedent. Task 07b runs in its place.
- **Pre-deploy lint baseline not captured locally** — the user ran `supabase db lint --linked` off-band only post-deploy (showed "No schema errors found", which is the post-deploy gate). The pre-deploy WARN baseline of 7 (or 6) `0011` entries is implied by the production catalog showing 6 user-owned functions without `search_path` set, but no explicit pre-deploy lint stdout was captured.
- **Migration history bookkeeping repair** — not anticipated in the plan. Resolved at the 08a checkpoint via `supabase migration repair` (2 commands) followed by `supabase db push`. Bookkeeping-only operation; zero DDL change from the repair commands themselves.

## Issues Encountered

- **Email-provider-disabled local gotrue** — see decision above. Decision to defer rather than fight the local stack config.
- **Migration history mismatch** — production `schema_migrations` had 9 orphan timestamp entries from when migrations 5-13 were originally pushed under timestamp naming. Resolved with `migration repair` per the supabase CLI's own recommended commands.

## Static + Runtime Verification Evidence

### Migration 14 SQL acceptance (Task 01)

| Check | Expected | Result |
|---|---|---|
| `CREATE OR REPLACE FUNCTION` count | 6 | 6 ✓ |
| `SECURITY DEFINER` count | 6 (no rot tags in comments) | 6 ✓ |
| `SET search_path = ''` count | 6 | 6 ✓ |
| `DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT)` | 1 | 1 ✓ |
| `INSERT INTO public.vote_counts` | 1 (already qualified per W0) | 1 ✓ |
| `STABLE` present on is_current_user_admin | 1 | 1 ✓ |
| `p_guild_member` (4-param signature) | ≥ 2 | 2 ✓ |
| Plan archaeology rot tags | 0 | 0 ✓ |

### Local Wave 1 evidence (Tasks 02-05)

- `evidence/local-lint-post-mig14.txt` — `supabase db lint --local`: "No schema errors found"
- `evidence/local-functiondef-post-mig14.sql` — 6 functions, all with `SET search_path TO ''`, 3-param overload absent
- `evidence/catalog-assertion-local.txt` — all 6 functions: `prosecdef=t`, `proconfig={"search_path=\"\""}`, owner preserved, ACL preserved, is_current_user_admin volatility=s
- `evidence/icua-body-identical-diff.txt` — pre-deploy vs local-post-mig14 normalized diff: exit 0

### Regression fixture acceptance (Task 07b)

| Check | Expected | Result |
|---|---|---|
| `INSERT INTO auth.users` (FK seed) | ≥ 1 | 2 ✓ |
| `before, after` columns | ≥ 1 | 2 ✓ |
| `payload` column (anti-pattern) | 0 | 0 ✓ |
| Top-level `PERFORM` (invalid SQL) | 0 | 0 ✓ |
| `SET LOCAL ROLE authenticated` (RLS-correctness) | ≥ 3 | 5 ✓ |
| `ON CONFLICT (id) DO UPDATE` (trigger collision) | ≥ 1 | 4 ✓ |
| psql exit code | 0 | 0 ✓ |
| PASS notices | 6 | 6 ✓ |
| FAIL exceptions | 0 | 0 ✓ |

### Production post-deploy evidence (Task 08b)

| Check | Result |
|---|---|
| 1. Post-deploy `supabase db lint --linked` | "No schema errors found" — zero `0011` WARNs |
| 2. is_current_user_admin body-identical diff (pre-deploy vs post-deploy, normalized) | `diff -u` exit 0, zero output |
| 3. Post-deploy catalog assertion (6 functions) | All 6: `is_security_definer=t`, `config={"search_path=\"\""}`, owner=postgres, broad ACL preserved, STABLE preserved on is_current_user_admin, 4-param only for update_profile_after_auth |
| 4. Smoke vote round-trip (polls.wtcsmapban.com) | "Yes 100% (1) — 1 total response" rendered; exercises validate_vote_choice + increment_vote_count + is_current_user_admin RLS |
| 5. Advisor evidence | Captured via CLI `db lint --linked` output (same authoritative source as Studio Database → Advisors → Security) |

### Evidence index

`.planning/phases/14-security-definer-search-path-migration/evidence/`:

- W0: `W0-local-checks.md`, `W0-prod-queries.sql`, `pre-deploy-functiondef-snapshot.sql`, `update_profile_after_auth_overloads.txt`
- Wave 1 local: `local-lint-post-mig14.txt`, `local-functiondef-post-mig14.sql`, `catalog-assertion-local.txt`, `icua-body-identical-diff.txt`, `icua-functiondef-pre-normalized.sql`, `icua-functiondef-post-mig14-normalized.sql`
- Wave 2 regression: `is_current_user_admin_regression.txt`, `test-11-deferred-local-block.md`
- Wave 3 deploy + post-deploy: `db-push-output.txt`, `post-deploy-lint.txt`, `post-deploy-functiondef-snapshot.sql`, `catalog-assertion-prod.txt`, `icua-functiondef-pre-deploy-normalized.sql`, `icua-functiondef-post-deploy-normalized.sql`, `icua-body-identical-diff-prod.txt`, `smoke-vote-roundtrip.md`, `smoke-vote-roundtrip.png`

## Follow-ups

- v1.4+ deferred: TEST-11 12-cell vitest run blocked by local gotrue `email_provider_disabled`. Already documented alongside the existing Local ES256 deferral.
- No paired rollback migration ships (D-08 fix-forward via Studio). The pre-deploy functiondef snapshot in `evidence/` is the rollback source.
