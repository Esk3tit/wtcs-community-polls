---
phase: 14
slug: security-definer-search-path-migration
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-16
plan_alignment: 14-01-PLAN.md
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

> **Plan alignment note (2026-05-16):** `14-01-PLAN.md` bundles verification tasks 14-01-02 through 14-01-05 into a single executor task (`14-01-02-05`) that runs `supabase db reset --local`, `pg_get_functiondef` diff, `\df+ update_profile_after_auth`, and `supabase db lint --local` in sequence. Task IDs below remain the Nyquist sampling checkpoints; the executor task covers all four in one wave. Task 14-01-08 in the plan is split into 14-01-08-push (human-action: `supabase db push`) and 14-01-08 (human-verify: post-deploy checks) for clarity, but both map to the 14-01-08 row below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-W0 | 01 | 0 | DBHY-01 | — | `rls_auto_enable` ownership confirmed (system-owned vs user-owned) before migration scope is locked | manual + automated | `supabase db dump --linked --schema=public \| grep -A 10 rls_auto_enable` | ✅ existing CLI | ⬜ pending |
| 14-01-01 | 01 | 1 | DBHY-01 | — | Migration 14 file exists and uses `CREATE OR REPLACE FUNCTION` for every target function | unit | `test -f supabase/migrations/00000000000014_harden_security_definer_search_path.sql && grep -c 'CREATE OR REPLACE FUNCTION' supabase/migrations/00000000000014_harden_security_definer_search_path.sql` | ❌ W0 (file created in this task) | ⬜ pending |
| 14-01-02 | 01 | 1 | DBHY-01 | T-14-01 | `is_current_user_admin` body is byte-identical to migration 9 form, only `SET search_path` value changed; admin RLS preserves identical behavior | unit | `supabase db reset --local && psql "$LOCAL_DB_URL" -c "SELECT pg_get_functiondef('public.is_current_user_admin()'::regprocedure)"` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | DBHY-01 | T-14-02 | `increment_vote_count` keeps existing `INSERT INTO public.vote_counts` (already qualified per RESEARCH.md); only adds `SET search_path = ''`; trigger still fires on insert | unit | `grep -n 'INSERT INTO' supabase/migrations/00000000000014_harden_security_definer_search_path.sql` (expected: only `INSERT INTO public.vote_counts` line) | ❌ W0 | ⬜ pending |
| 14-01-04 | 01 | 1 | DBHY-01 | — | `update_profile_after_auth` is updated at the 4-param signature (not the 3-param overload); body fully qualified | unit | `supabase db reset --local && psql "$LOCAL_DB_URL" -c "\df+ public.update_profile_after_auth"` | ❌ W0 | ⬜ pending |
| 14-01-05 | 01 | 1 | DBHY-01 | — | Remaining target functions (`handle_new_user`, `validate_vote_choice`, `profile_self_update_allowed`, optionally `rls_auto_enable`) re-emit with fully-qualified bodies and `SET search_path = ''` | unit | `supabase db reset --local && npx supabase db lint --local 2>&1 \| grep -c 0011_function_search_path_mutable` (expected: 0) | ❌ W0 | ⬜ pending |
| 14-01-06 | 01 | 2 | DBHY-04 | — | Prose at line 83 of `11-PATTERNS.md` no longer implies the admin-OR policy form may be current; REVIEW-FIX-H3 named as shipped form; changelog note at top of file | doc | `grep -c 'whichever is current' .planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-PATTERNS.md` (expected: 0) | ✅ existing | ⬜ pending |
| 14-01-07 | 01 | 2 | DBHY-02, DBHY-03 | T-14-01 | Pre-deploy: `supabase db lint --linked` captures baseline WARN count; TEST-11 12-cell RLS matrix re-run shows zero regressions on local stack with Migration 14 applied | integration | `npm run test:integration 2>&1 \| tee evidence/test-11-pre-deploy.txt && npx supabase db lint --linked 2>&1 \| tee evidence/pre-deploy-lint.txt` | ✅ existing | ⬜ pending |
| 14-01-08 | 01 | 3 | DBHY-02, DBHY-03 | T-14-04 | Post-deploy on production: `supabase db lint --linked` shows zero `0011_function_search_path_mutable` WARNs for user-owned functions; one `submit-vote` round-trip succeeds end-to-end (vote row inserted, trigger fires, `vote_counts` row incremented) | smoke | `npx supabase db lint --linked 2>&1 \| grep -c '0011_function_search_path_mutable'` (expected: 0) + manual submit-vote + Studio queries | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **`rls_auto_enable` ownership verification** — run `supabase db dump --linked --schema=public | grep -A 10 rls_auto_enable` (or Studio query). Result determines whether Migration 14 targets 6 or 7 functions. **Hard blocker:** the executor MUST NOT write Migration 14 until this is answered.
- [ ] **Local stack reachability** — confirm `supabase start` brings up Postgres and that `npx supabase db reset --local` re-applies migrations 0–13 cleanly before Migration 14 is written. If the local stack is currently broken, fix it before Wave 1.
- [ ] **`tests/sql/increment_vote_count_smoke.sql`** — reference SQL fixture for increment_vote_count body inspection. Create `tests/sql/` directory if absent. The fixture is used as a reference artifact for task 14-01-03 (grep assertion), not a runnable psql integration test (requires seeded data not available in local stack without setup).

*If none of the above are needed: "Existing infrastructure covers all phase requirements" — but at minimum the `rls_auto_enable` ownership check is mandatory before Migration 14 is written.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase advisor dashboard shows zero `0011_function_search_path_mutable` WARNs post-deploy | DBHY-02 | The advisor dashboard is a hosted Supabase Studio surface — there is no automated assertion path; CLI `db lint --linked` is the closest proxy and is treated as the authoritative automated check, with the dashboard inspected manually for evidence capture | (1) Wait for Migration 14 to apply on production (via `supabase db push`). (2) Open Supabase Dashboard → Project → Database → Advisors → Performance/Security. (3) Confirm there are no entries for `0011_function_search_path_mutable` for any of the target functions. (4) Screenshot to evidence folder. |
| Production `submit-vote` round-trip after deploy | DBHY-03 | The Edge Function runs against live production state with a real Discord-authenticated session; full automation would require seeded prod data we do not maintain | (1) Sign in via Discord in a private browser at polls.wtcsmapban.com. (2) Cast one vote on an open poll. (3) Verify the UI reflects the vote (count goes up by 1, "you've already responded" state activates). (4) In Studio, run `SELECT * FROM public.votes WHERE user_id = '<your uid>' ORDER BY created_at DESC LIMIT 1` and confirm the row exists. (5) Run `SELECT * FROM public.vote_counts WHERE poll_id = '<poll uid>'` and confirm the count incremented. Capture screenshots/SQL output to evidence folder. |
| TEST-11 12-cell RLS matrix re-run (automated via `npm run test:integration` — see task 14-01-07) | DBHY-03 | Automated via Vitest; manual review of output required to confirm zero regressions and correct test file ran | `npm run test:integration 2>&1 | tee evidence/test-11-pre-deploy.txt` — confirm vote-counts-rls.test.ts describe block shows all 12 cells passing. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or checkpoint gates (manual-only verifies above are explicitly excepted and documented)
- [x] Sampling continuity: W0 (checkpoint) → 01 (grep gate) → 02-05 (db reset + psql + lint) → 06 (grep gate) → 07 (CLI + npm test) → 08 (lint + smoke) — no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (`rls_auto_enable` ownership is a blocking checkpoint)
- [x] No watch-mode flags (`npm run test:integration` and `supabase db lint` are one-shot)
- [x] Feedback latency < 120s (local reset + lint)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (executor to flip to approved after Wave 0 completes)
