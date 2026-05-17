---
phase: 14-security-definer-search-path-migration
audited: 2026-05-17
asvs_level: 1
block_on: warning
status: SECURED
threats_total: 10
threats_closed: 10
threats_open: 0
threats_accepted: 1
---

# Phase 14 Security Audit — Threat Mitigation Verification

**Phase:** 14 — Security-Definer Search-Path Lockdown
**Threats Closed:** 10/10 (9 mitigated + 1 accepted)
**ASVS Level:** 1
**Audit Verdict:** SECURED — every declared mitigation is present in implementation or evidence; the one `accept` disposition has a documented rationale.

This audit verifies the threat-mitigation paper trail against the shipped Migration 14
(commit `c94c8f7`, deployed to project `cbjspmwgyoxxqukcccjr` on 2026-05-17). Migration is
live; this is a confirmation pass, not a gating audit. Per `<constraints>` no
implementation files were modified.

---

## Threat Verification Table

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-14-01 | Elevation of Privilege | mitigate | CLOSED | Body-identical rewrite verified mechanically. `evidence/icua-body-identical-diff-prod.txt` line 1: `is_current_user_admin production body-identical diff exit code: 0`. Local equivalent: `evidence/icua-body-identical-diff.txt` exit 0. Source: migration file lines 98-110 (only `SET search_path = ''` differs from migration 9 baseline; `STABLE`, `SECURITY DEFINER`, `RETURNS BOOLEAN`, COALESCE body all preserved). |
| T-14-02 | Tampering | mitigate | CLOSED | Migration line 86: `INSERT INTO public.vote_counts (poll_id, choice_id, count)` — already fully-qualified. `public.choices`, `public.profiles`, `public.admin_discord_ids`, `auth.uid()` similarly qualified in all six function bodies. W0 Check 2 (`evidence/W0-local-checks.md` lines 11-31) confirms zero bare extension calls and zero bare `uid()` references in the 4 source migrations. Local lint post-mig14 (`evidence/local-lint-post-mig14.txt`): "No schema errors found". Production lint (`evidence/post-deploy-lint.txt`): "No schema errors found". |
| T-14-03 | Tampering (ownership drift) | mitigate | CLOSED | Production catalog assertion (`evidence/catalog-assertion-prod.txt` lines 6-11): all 6 functions have `owner=postgres` and `acl={=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` — broad grants preserved. Local equivalent confirms identical owner/ACL (`evidence/catalog-assertion-local.txt` lines 3-8). Migration uses `CREATE OR REPLACE FUNCTION` (not `ALTER`/`DROP+CREATE`) for all 6 retained functions, preserving OID and trigger bindings; `on_vote_inserted`/`on_auth_user_created`/`on_profile_self_update`/`on_vote_validate_choice` continue to bind by OID. Smoke vote round-trip (`evidence/smoke-vote-roundtrip.md`) proves trigger graph still fires post-deploy. |
| T-14-04 | Tampering (partial-push) | mitigate | CLOSED | Every statement in `00000000000014_harden_security_definer_search_path.sql` is `CREATE OR REPLACE FUNCTION` or `DROP FUNCTION IF EXISTS` — idempotent DDL, re-applicable N times. Deploy stdout (`evidence/db-push-output.txt` lines 41-44) shows clean single-migration apply with no error. Rollback artifact `evidence/pre-deploy-functiondef-snapshot.sql` (committed at `a258c94` BEFORE the feat commit `c94c8f7`) provides Studio-pastable CREATE OR REPLACE blocks for fix-forward restore per D-08. |
| T-14-05 | DoS (admin lockout) | mitigate | CLOSED | Pre-deploy production functiondef snapshot exists at `.planning/phases/14-security-definer-search-path-migration/evidence/pre-deploy-functiondef-snapshot.sql` (5.5KB, committed `a258c94` before the feat commit per the D-07 three-commit deploy split). File header lines 6-9 document the rollback procedure: paste any block into Supabase Studio SQL editor and execute under service-role session. Risk did not materialize: UAT Test 5 (`14-UAT.md` lines 65-73) confirmed admin dashboard accessible post-deploy. |
| T-14-06 | Tampering (body drift undetected) | mitigate | CLOSED | `tests/sql/is_current_user_admin_regression.sql` exists (181 lines). Verified: 4 identity branches (admin, non_admin, mfa_false, guild_false) at lines 125, 128, 131, 134 + 2 audit_log RLS branches at lines 148-161 (admin sees canary) and 164-177 (non-admin does not). All SELECTs run under `SET LOCAL ROLE authenticated` (5 occurrences) to prove RLS-correctness, not privileged-bypass. Helper `pg_temp.assert_admin` at lines 106-122. Execution evidence (`evidence/is_current_user_admin_regression.txt`): psql exit 0, 6 PASS notices, 0 FAIL exceptions, transaction `ROLLBACK`. Catalog assertion confirms `volatility=s` (STABLE preserved) on `is_current_user_admin` — `evidence/catalog-assertion-prod.txt` line 8 + `evidence/catalog-assertion-local.txt` line 5. |
| T-14-07 | Tampering (prod-vs-local body drift) | mitigate | CLOSED | Post-deploy functiondef snapshot captured at `evidence/post-deploy-functiondef-snapshot.sql` (4.7KB). Machine-enforced normalized diff vs pre-deploy snapshot recorded at `evidence/icua-body-identical-diff-prod.txt`: `is_current_user_admin production body-identical diff exit code: 0` — zero textual difference after `SET search_path` line normalization. Acceptance documented in 14-01-SUMMARY.md "Production post-deploy evidence" table row 2. |
| T-14-08 | Tampering (extension functions under empty search_path) | mitigate | CLOSED | W0 Check 2 (`evidence/W0-local-checks.md` lines 7-31) ran two `grep` passes against the 4 source migrations referenced by Migration 14 (`00000000000002_triggers.sql`, `00000000000003_guild_membership.sql`, `00000000000004_fix_trigger_rpc_context.sql`, `00000000000009_admin_integrity_rls.sql`). Pattern 1: `gen_random_uuid\|uuid_generate_v4\|::citext\|citext\(` → 0 matches. Pattern 2: bare `uid()` (without `auth.` prefix) → 0 matches. Result documented as "CLEAN" in both subsections. Migration 14 function bodies inspected: all calls are to schema-qualified objects (`public.*`, `auth.uid()`) — no bare extension calls. |
| T-14-09 | Tampering (overload not hardened) | mitigate | CLOSED | W0 Check 1B enumerated all production overloads in `evidence/update_profile_after_auth_overloads.txt`: both 3-param and 4-param overloads existed pre-deploy (OUTCOME U2). 3-param caller audit (lines 21-39) found ZERO 3-param callers across src/ and tests/ — safe to drop. Migration line 17: `DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT);` — unconditional drop per Cycle-3 Option A. Post-deploy catalog assertion (`evidence/catalog-assertion-prod.txt`) shows exactly one row for `update_profile_after_auth` with `num_args=4` and `identity_args=p_mfa_verified boolean, p_discord_username text, p_avatar_url text, p_guild_member boolean` — 3-param overload absent. Same in local catalog (`evidence/catalog-assertion-local.txt` line 7). |
| T-14-SC | Tampering (supply-chain) | accept | CLOSED-as-accepted | No new packages installed during this phase. `package.json` / `package-lock.json` not modified per 14-01-SUMMARY.md "Files Created/Modified" section (only the migration, regression fixture, REQUIREMENTS.md, and 11-PATTERNS.md were touched). Supabase CLI invoked via `npx supabase ...` against the project's existing pinned toolchain (CLI v2.92.1 observed in `evidence/local-lint-post-mig14.txt`). Acceptance rationale is reasonable: zero new attack surface introduced by this phase. |

---

## Disposition Summary

| Disposition | Count | Status |
|-------------|-------|--------|
| mitigate | 9 | All 9 verified CLOSED with cited file/line evidence. |
| accept | 1 | T-14-SC verified — no packages added; documented rationale. |
| transfer | 0 | n/a |

---

## Unregistered Flags

**None.**

`14-01-SUMMARY.md` does not contain a `## Threat Flags` section. The shipped surface
(migration SQL + regression fixture + production deploy) maps cleanly onto the 10
threats registered at plan time per `<config>` `register_authored_at_plan_time: true`.

No new attack surface was introduced during implementation:
- No new packages added (T-14-SC scope).
- No new Edge Functions deployed.
- No new RLS policies authored.
- No new tables / columns / FKs.
- No client-side code changes.
- Only DDL changes are 6 `CREATE OR REPLACE FUNCTION` (semantics preserved, search_path pinned) + 1 `DROP FUNCTION IF EXISTS` (uncalled overload removal).

---

## Cross-Cutting Verification

These checks are not threat-specific but corroborate the per-threat findings:

1. **Linter clean post-deploy** — `evidence/post-deploy-lint.txt`: "No schema errors found".
   Zero `0011_function_search_path_mutable` advisor WARNs. This is the schema-wide proof
   that T-14-02 (search_path) and T-14-08 (extension functions) mitigations succeeded
   simultaneously — the advisor flags both classes of issue.

2. **Smoke vote round-trip live** — `evidence/smoke-vote-roundtrip.md`: production vote on
   "Tes / test" poll rendered "Yes 100% (1) — 1 total response". Exercises 3 of the 6
   hardened functions (`validate_vote_choice`, `increment_vote_count`,
   `is_current_user_admin`) end-to-end through Edge Function → trigger graph → RLS read.

3. **UAT 6/6 PASS** — `14-UAT.md` Tests 1-6: cold-start fixture run, LandingPage render,
   Discord OAuth sign-in, vote round-trip re-confirm, admin dashboard access, clean
   migration history list. The OAuth path (Test 3) and admin dashboard (Test 5) cover the
   2 non-write hardened functions (`handle_new_user`, `update_profile_after_auth`).

4. **Code review converged** — `14-REVIEW.md` Iteration 3 of 3: 0 Critical / 0 Warning /
   0 Info. Cross-file analysis re-verified body-identicality, trigger graph preservation,
   RLS policy binding preservation, and idempotency. No defects.

---

## Accepted Risks Log

- **T-14-SC (Tampering — supply-chain)** — Accepted at plan time. Disposition rationale:
  zero new package installs in Phase 14. Supabase CLI invocations use the project's
  existing pinned toolchain via `npx`. Re-evaluate if a future phase adds a new build- or
  test-time dependency.

---

## Audit Conclusion

All 10 threats in the Phase 14 register resolved:
- **9 of 9 `mitigate` threats** verified CLOSED with implementation citations in the
  migration file, regression fixture, and 6+ evidence artifacts.
- **1 of 1 `accept` threats** verified CLOSED-as-accepted with documented rationale.
- **0 unregistered flags** introduced during implementation.

Phase 14 is **SECURED**. No follow-up security work is required to close this phase.

---

_Audited: 2026-05-17_
_Auditor: Claude (gsd-secure-phase)_
_ASVS Level: 1_
_Block on: warning (no warnings raised)_
