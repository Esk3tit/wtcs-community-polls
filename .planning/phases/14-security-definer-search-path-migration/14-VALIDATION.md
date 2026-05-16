---
phase: 14
slug: security-definer-search-path-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Supabase CLI + Vitest + ad-hoc psql (local Postgres) + `supabase db lint --linked` |
| **Config file** | `supabase/config.toml` (CLI) + `vitest.config.ts` (host repo) |
| **Quick run command** | `supabase db reset --local` (re-applies all 14 migrations against the local stack) |
| **Full suite command** | `npm test -- --run && supabase db reset --local && supabase db lint --linked` |
| **Estimated runtime** | ~60–120 seconds (local reset + lint + unit tests) |

---

## Sampling Rate

- **After every task commit:** Run `supabase db reset --local` to confirm the migration set still applies cleanly. Functions touched by Migration 14 must re-emit without errors.
- **After every plan wave:** Run `supabase db lint --linked` against the local stack and confirm zero `0011_function_search_path_mutable` WARNs for the targeted functions. After Wave 2 (TEST-11 matrix), also run `npm test -- --run` for the host-repo unit tests.
- **Before `/gsd:verify-work`:** Full suite must be green. Production deploy of Migration 14 must show zero `0011_function_search_path_mutable` WARNs in the Supabase advisor dashboard AND one round-trip `submit-vote` must succeed.
- **Max feedback latency:** ~120 seconds (local apply + lint).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-W0 | 01 | 0 | DBHY-01 | — | `rls_auto_enable` ownership confirmed (system-owned vs user-owned) before migration scope is locked | manual + automated | `supabase db dump --linked --schema=public \| grep -A 10 rls_auto_enable` | ✅ existing CLI | ⬜ pending |
| 14-01-01 | 01 | 1 | DBHY-01 | — | Migration 14 file exists and uses `CREATE OR REPLACE FUNCTION` for every target function | unit | `test -f supabase/migrations/00000000000014_security_definer_search_path.sql && grep -c 'CREATE OR REPLACE FUNCTION' supabase/migrations/00000000000014_security_definer_search_path.sql` | ❌ W0 (file created in this task) | ⬜ pending |
| 14-01-02 | 01 | 1 | DBHY-01 | — | `is_current_user_admin` body is byte-identical to migration 9 form, only `SET search_path` value changed; admin RLS preserves identical behavior | unit | `supabase db reset --local && psql "$LOCAL_DB_URL" -c "SELECT pg_get_functiondef('public.is_current_user_admin()'::regprocedure)"` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | DBHY-01 | — | `increment_vote_count` keeps existing `INSERT INTO public.vote_counts` (already qualified per RESEARCH.md); only adds `SET search_path = ''`; trigger still fires on insert | unit | `supabase db reset --local && psql "$LOCAL_DB_URL" -f tests/sql/increment_vote_count_smoke.sql` | ❌ W0 | ⬜ pending |
| 14-01-04 | 01 | 1 | DBHY-01 | — | `update_profile_after_auth` is updated at the 4-param signature (not the 3-param overload); body fully qualified | unit | `supabase db reset --local && psql "$LOCAL_DB_URL" -c "\df+ public.update_profile_after_auth"` | ❌ W0 | ⬜ pending |
| 14-01-05 | 01 | 1 | DBHY-01 | — | Remaining target functions (`handle_new_user`, `validate_vote_choice`, `profile_self_update_allowed`, optionally `rls_auto_enable`) re-emit with fully-qualified bodies and `SET search_path = ''` | unit | `supabase db reset --local && supabase db lint --local 2>&1 \| grep -c 0011_function_search_path_mutable` (expected: 0) | ❌ W0 | ⬜ pending |
| 14-01-06 | 01 | 2 | DBHY-04 | — | Single sentence at `.planning/phases/11-*/11-PATTERNS.md:83` no longer implies the admin-OR policy form may be current; reflects shipped REVIEW-FIX-H3 form | doc | `grep -n 'whichever is current' .planning/phases/11-*/11-PATTERNS.md` (expected: no match) | ✅ existing | ⬜ pending |
| 14-01-07 | 01 | 2 | DBHY-02, DBHY-03 | — | Pre-deploy: `supabase db lint --linked` on staging-equivalent has zero `0011_function_search_path_mutable` WARNs; TEST-11 12-cell RLS matrix re-run shows zero regressions | integration | `supabase db lint --linked` + manual TEST-11 matrix walk per Phase 11 spec | ✅ existing | ⬜ pending |
| 14-01-08 | 01 | 3 | DBHY-02, DBHY-03 | — | Post-deploy on production: Supabase advisor dashboard / `supabase db lint --linked` shows zero `0011_function_search_path_mutable` WARNs; one `submit-vote` round-trip succeeds end-to-end (vote row inserted, trigger fires, `vote_counts` row incremented) | smoke | `supabase db lint --linked` on prod + manual `submit-vote` round-trip with curl/UI; capture evidence | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **`rls_auto_enable` ownership verification** — run `supabase db dump --linked --schema=public | grep -A 10 rls_auto_enable` (or Studio query). Result determines whether Migration 14 targets 6 or 7 functions. **Hard blocker:** the planner MUST NOT freeze the function list until this is answered.
- [ ] **Local stack reachability** — confirm `supabase start` brings up Postgres and that `supabase db reset --local` re-applies migrations 0–13 cleanly before Migration 14 is written. If the local stack is currently broken, fix it before Wave 1.
- [ ] **`tests/sql/increment_vote_count_smoke.sql`** — small smoke fixture: insert a vote row, assert the trigger fires, assert `vote_counts` increments. Used by 14-01-03. Stub may be added in this same wave if not already present in the host repo.

*If none of the above are needed: "Existing infrastructure covers all phase requirements" — but at minimum the `rls_auto_enable` ownership check is mandatory before Migration 14 is written.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase advisor dashboard shows zero `0011_function_search_path_mutable` WARNs post-deploy | DBHY-02 | The advisor dashboard is a hosted Supabase Studio surface — there is no automated assertion path; CLI `db lint --linked` is the closest proxy and is treated as the authoritative automated check, with the dashboard inspected manually for evidence capture | (1) Wait for Migration 14 to apply on production (auto via `supabase db push` or manual via Studio). (2) Open Supabase Dashboard → Project → Database → Advisors → Performance/Security. (3) Confirm there are no entries for `0011_function_search_path_mutable` for any of the 7 (or 6) target functions. (4) Screenshot for the phase evidence folder. |
| Production `submit-vote` round-trip after deploy | DBHY-03 | The Edge Function runs against live production state with a real Discord-authenticated session; full automation would require seeded prod data we do not maintain | (1) Sign in via Discord in a private browser. (2) Cast one vote on an open poll. (3) Verify the UI reflects the vote (count goes up by 1, "you've already responded" state activates). (4) In Studio, run `SELECT * FROM public.votes WHERE user_id = '<your uid>' ORDER BY created_at DESC LIMIT 1` and confirm the row exists. (5) Run `SELECT * FROM public.vote_counts WHERE poll_id = '<poll uid>'` and confirm the count incremented. Capture screenshots/SQL output for the evidence folder. |
| TEST-11 12-cell RLS matrix re-run (pre-deploy on local apply, post-deploy on prod) | DBHY-03 | Phase 11 documents the matrix as a manual walk against the live RLS surface; the test plan is in `11-PLAN.md` and is reused verbatim here | Follow Phase 11 PLAN.md TEST-11 section step-by-step; for each of the 12 cells, run the documented query as the documented role; record pass/fail. Migration 14 must not change any cell outcome. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (manual-only verifies listed above are explicitly excepted and documented)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (W0 → 01–05 are all SQL-asserted; only 06 is doc-only and immediately followed by 07/08 which have CLI + manual hybrid verify)
- [ ] Wave 0 covers all MISSING references (`rls_auto_enable` ownership)
- [ ] No watch-mode flags (`vitest --run` and `supabase db lint` are one-shot)
- [ ] Feedback latency < 120s (local reset + lint)
- [ ] `nyquist_compliant: true` set in frontmatter (planner will flip this on plan write-out if W0 closes the open gap)

**Approval:** pending
