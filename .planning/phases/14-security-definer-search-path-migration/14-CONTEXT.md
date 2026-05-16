# Phase 14: Security-Definer Search-Path Migration - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `SET search_path = ''` hardening (via `CREATE OR REPLACE FUNCTION`) to the 7 pre-Phase-11 `SECURITY DEFINER` functions so that `supabase db lint --linked` reports zero `0011_function_search_path_mutable` advisor WARNs against production. Also align the legacy `vote_counts` policy skeleton in archived `11-PATTERNS.md` with the shipped REVIEW-FIX-H3 form (service-role-only bypass; no admin-OR branch).

**In scope:** DBHY-01 (Migration 14), DBHY-02 (advisor zero-WARN proof), DBHY-03 (submit-vote smoke + TEST-11 12-cell RLS matrix re-run), DBHY-04 (doc-only fix to `11-PATTERNS.md`).

**Out of scope:** New product features; perf-budget work (Phase 16); observability hygiene (Phase 15); planning-doc backfill (Phase 17); the local supabase-edge-runtime 1.73.x ES256 bug (transitively covered by Phase 12 UAT).

</domain>

<decisions>
## Implementation Decisions

### DBHY-03 verification approach

- **D-01:** Submit-vote smoke runs as a **production cast-a-vote**. Admin signs in via Discord on `polls.wtcsmapban.com`, casts a vote on a non-prod-impact test poll, and watches the result land. Matches the v1.2 Phase 11 verification style and exercises the exact deployed function (including the `increment_vote_count` trigger).
- **D-02:** TEST-11 12-cell RLS matrix re-run is **automated** — run the existing TEST-11 test file from Phase 11 against the migrated DB. Zero net-new test code; proves the `is_current_user_admin()` body-identical claim mechanically.
- **D-03:** PR / SUMMARY.md evidence artifact = **TEST-11 pass output pasted into SUMMARY.md, plus a screenshot of a Supabase Studio query confirming the cast vote landed in `vote_counts`**. Matches Phase 11 / Phase 12 evidence pattern.
- **D-04:** `supabase db lint --linked` runs **twice for DBHY-02**: once **locally before merge** (proves the SQL is correct as-written against the linked prod project), and once **post-deploy** (confirms zero `0011` WARNs on actual prod state). Two checkpoints, low cost.

### DBHY-04 doc-fix location & form

- **D-05:** Edit-in-place in `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-PATTERNS.md`. The doc is the canonical cross-milestone reference for the `vote_counts` RLS skeleton; archives are not required to be frozen when the doc is still being cited by current work.
- **D-06:** Edit form = **replace the legacy admin-OR-bypass skeleton with the shipped REVIEW-FIX-H3 form (service-role-only bypass; no admin OR-branch)**, plus a short changelog note at the top of `11-PATTERNS.md`: `Updated 2026-05-16 (Phase 14, DBHY-04) — original form had admin-OR drift; see REVIEW-FIX-H3.` Keeps the doc readable and preserves a single-line drift breadcrumb.
- **D-07:** DBHY-04 ships as a **separate commit in the same PR** as the migration: `feat(db): migration 14 — security definer search_path lockdown` and `docs(11-patterns): align vote_counts skeleton with shipped REVIEW-FIX-H3 form`. Easy independent revert if either half causes trouble.

### Rollback / safety net

- **D-08:** Rollback strategy = **fix-forward via Supabase Studio `CREATE OR REPLACE`**. Migration 14 is 7 atomic per-function `CREATE OR REPLACE FUNCTION` statements; if any one breaks, paste the prior body from the source migration (0/1/2/3/4/5/9/10) into Studio SQL editor. No paired rollback migration ships; no PITR plan needed for an advisor-WARN cleanup.
- **D-09:** **Local `supabase start` replay is required before merging**. Run Migration 14 against a local Supabase stack with seed data and cast a local vote before pushing the PR. Catches body-syntax errors (e.g., missing `public.` qualifications on the `increment_vote_count` body rewrite) at the cheapest possible stage.
- **D-10:** Deploy timing = **any time**. `CREATE OR REPLACE FUNCTION` is atomic per-function; no schema lock; vote path keeps working through the swap. WTCS poll traffic is low and asynchronous; no SLO requires a maintenance window. Cast the smoke vote immediately after deploy while watching Supabase logs as a checklist item, not a constraint.

### Migration filename

- **D-11:** Migration filename = **`00000000000014_harden_security_definer_search_path.sql`**. Verb-first ("harden"), explicit subject. Consistent with prior verb-led migration names (`fix_pr_review`, `null_choices_guard`, `audit_log_fk_hardening`, `demote_admin_guarded_advisory_lock`).

### Already locked upstream (not re-asked)

- 7 functions: `update_profile_after_auth`, `handle_new_user`, `validate_vote_choice`, `increment_vote_count`, `is_current_user_admin`, `profile_self_update_allowed`, `rls_auto_enable` (DBHY-01).
- `CREATE OR REPLACE FUNCTION` (not `ALTER FUNCTION`) for OID stability across trigger references (Decision D-Phase-14, PROJECT.md).
- `increment_vote_count` body rewrite: bare `INSERT INTO vote_counts` → `INSERT INTO public.vote_counts` (otherwise 42P01 on every vote post-migrate).
- `is_current_user_admin()` rewrite MUST be body-identical (only the `search_path` value changes from `public` to `''`) to preserve admin RLS semantics across all admin-gated tables.

### Claude's Discretion

- Exact SQL formatting of the 7 `CREATE OR REPLACE FUNCTION` blocks (order, comment blocks, header style) — planner / executor follows established Supabase migration conventions seen in migrations 05, 07, 08, 09, 12, 13.
- Whether the PR description includes a function-body diff table or just cites the migration file (PR aesthetics).
- Whether body-identical claim for `is_current_user_admin()` is proved via a CI grep / `pg_get_functiondef` snapshot or just by manual inspection (planner picks the cheapest credible mechanism).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` § DB Hygiene (DBHY-*) — full text of DBHY-01..04 acceptance criteria.
- `.planning/ROADMAP.md` § Phase 14 (Security-Definer Search-Path Migration) — goal, scope, exclusions.
- `.planning/PROJECT.md` § Current Milestone: v1.3 — Hygiene & Performance — milestone framing, Key Decision D-Phase-14 (`CREATE OR REPLACE FUNCTION` rationale).

### Existing migrations & function bodies

- `supabase/migrations/00000000000000_schema.sql` — original function definitions.
- `supabase/migrations/00000000000001_rls.sql` — RLS-era function rewrites.
- `supabase/migrations/00000000000002_triggers.sql` — triggers that pin `increment_vote_count` (OID stability matters).
- `supabase/migrations/00000000000003_guild_membership.sql` — guild-membership helpers.
- `supabase/migrations/00000000000004_fix_trigger_rpc_context.sql` — context-correctness fixes.
- `supabase/migrations/00000000000005_admin_phase4.sql` — `is_current_user_admin` plus Phase-4 admin functions.
- `supabase/migrations/00000000000009_admin_integrity_rls.sql` — admin integrity RLS plumbing.
- `supabase/migrations/00000000000010_results_hidden_audit.sql` — audit-log helpers.
- `supabase/migrations/00000000000007_fix_pr_review.sql` — **template** for the established `SET search_path` pattern.
- `supabase/migrations/00000000000008_null_choices_guard.sql` — additional `SET search_path` precedent.
- `supabase/migrations/00000000000012_demote_admin_guarded.sql` — recent `SET search_path` precedent.
- `supabase/migrations/00000000000013_demote_admin_guarded_advisory_lock.sql` — most-recent migration; naming + style anchor.

### Patterns reference (target of DBHY-04 doc-fix)

- `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-PATTERNS.md` — legacy `vote_counts` policy skeleton lives here; this is the file edited by DBHY-04. The shipped REVIEW-FIX-H3 form is referenced in this file and in `11-04-PLAN.md`, `11-05-PLAN.md`, `11-05-SUMMARY.md`, and `11-REVIEW.md`.

### Phase 11 RLS test harness (reused for DBHY-03)

- `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/` — TEST-11 12-cell RLS matrix lives in this phase's plan/SUMMARY trail; the test file location is whatever Phase 11 shipped (researcher to confirm and re-run).

### State

- `.planning/STATE.md` § Decisions — D-12, D-13, D-Phase-14 context.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`SET search_path = ''` pattern** already established in migrations 05, 07, 08, 09, 12, 13 — Migration 14 follows the same syntactic form, just applied retroactively to the 7 functions that predate it.
- **TEST-11 12-cell RLS matrix** (from Phase 11) — re-runnable as-is to verify `is_current_user_admin()` body-identical claim mechanically; no new test code required.

### Established Patterns

- **Verb-first migration naming** (`fix_pr_review`, `null_choices_guard`, `audit_log_fk_hardening`, `demote_admin_guarded`, `demote_admin_guarded_advisory_lock`). Phase 14 filename `harden_security_definer_search_path` matches.
- **`CREATE OR REPLACE FUNCTION` (not `ALTER FUNCTION`)** for any function-body change — preserves the OID, which keeps triggers and view definitions pointed at the same function entry.
- **Service-role-only bypass for `vote_counts`** (REVIEW-FIX-H3 shipped form) — the form `11-PATTERNS.md` should be aligned with.
- **`public.<table>` qualified references** inside `SECURITY DEFINER` bodies whenever `search_path = ''` is set. Required for any DML target; missing qualification produces 42P01.

### Integration Points

- Migration 14 → 7 functions called from triggers (`increment_vote_count`), RLS policies (`is_current_user_admin`, `profile_self_update_allowed`), and auth signal handlers (`update_profile_after_auth`, `handle_new_user`). Body-identical rewrite for `is_current_user_admin` is the critical hinge — drift here breaks every admin-gated table at once.
- DBHY-04 → `11-PATTERNS.md` is still referenced by future planning (cross-milestone material) even though it lives inside the archived v1.2 phase dir.
- DBHY-03 → exercises `submit-vote` Edge Function → `increment_vote_count` trigger → `public.vote_counts` write path end-to-end; this is the single highest-confidence post-deploy check.

</code_context>

<specifics>
## Specific Ideas

- DBHY-04 changelog note format: a single line at top of `11-PATTERNS.md` (not a heavyweight CORRIGENDUM block, not a strikethrough). Form: `Updated 2026-05-16 (Phase 14, DBHY-04) — original form had admin-OR drift; see REVIEW-FIX-H3.`
- PR commit split: two commits, one PR. `feat(db): migration 14 — security definer search_path lockdown` carries the SQL; `docs(11-patterns): align vote_counts skeleton with shipped REVIEW-FIX-H3 form` carries the doc-only DBHY-04 fix.
- Production smoke = real Discord login, real vote cast against a non-prod-impact test poll (Phase 11 / Phase 12 verification style).

</specifics>

<deferred>
## Deferred Ideas

- **Paired rollback migration 15** — explicitly rejected for Phase 14 (D-08: fix-forward via Studio is sufficient). If a future risky DDL phase warrants it, that's a different phase's decision.
- **CI-based `supabase db lint` check** — explicitly rejected for Phase 14 (D-04 keeps it as a local + post-deploy manual step). If CI infra is built for another reason, fold this in then.
- **Moving `11-PATTERNS.md` out of the archive directory** — explicitly rejected for Phase 14 (D-05 edits in place). Structural relocation of cross-milestone reference docs belongs to a planning-doc reorganization phase, not a DB hygiene phase.
- **Net-new v1.3-scoped RLS matrix test** — explicitly rejected for Phase 14 (D-02 re-runs existing TEST-11). If TEST-11 has rotted at planning time, planner flags it as a sub-task, not a new requirement.

</deferred>

---

*Phase: 14-security-definer-search-path-migration*
*Context gathered: 2026-05-16*
