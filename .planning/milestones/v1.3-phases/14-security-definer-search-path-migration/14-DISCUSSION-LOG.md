# Phase 14: Security-Definer Search-Path Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 14-security-definer-search-path-migration
**Areas discussed:** DBHY-03 verification approach, DBHY-04 doc-fix location, Rollback / safety net, Migration filename slug

---

## DBHY-03 verification approach

### Q1: Where does the submit-vote smoke run after Migration 14 deploys?

| Option | Description | Selected |
|--------|-------------|----------|
| Production cast-a-vote | Cast a real vote on polls.wtcsmapban.com via admin Discord login on a non-prod-impact test poll. Highest realism; tests the exact deployed function; matches v1.2 Phase 11 verification style. | ✓ |
| Deploy preview branch | Push to deploy-preview branch with a separate Supabase project. Adds an extra Supabase project on free tier; no staging Supabase set up today. | |
| Local `supabase start` replay | Run migration locally, invoke submit-vote against local stack. Catches body-syntax issues but doesn't prove the prod RLS / service-role-key path. | |
| Existing TEST-11 matrix only | Skip live submit-vote round-trip; rely on TEST-11 RLS matrix re-run as proof. Faster but doesn't exercise `increment_vote_count` trigger end-to-end. | |

**User's choice:** Production cast-a-vote
**Notes:** Matches established Phase 11 / Phase 12 verification style; exercises the trigger path end-to-end.

### Q2: How is the TEST-11 12-cell RLS matrix re-run executed?

| Option | Description | Selected |
|--------|-------------|----------|
| Automated re-run of existing TEST-11 | Run the existing Phase 11 TEST-11 test file against the migrated DB. Zero net-new test code; proves `is_current_user_admin()` body-identical claim mechanically. | ✓ |
| Net-new RLS matrix test for v1.3 | Write a new v1.3-scoped matrix test in the Phase 14 dir. Duplicates work; useful only if TEST-11 has rotted. | |
| Manual 12-cell checklist (Studio SQL) | Hand-walk the 12 cells via Studio SQL editor as admin / non-admin / anon. Slowest and most error-prone. | |
| Skip — DBHY-02 advisor pass is enough | Trust zero-WARN + body-identical diff inspection. Would require updating DBHY-03 in REQUIREMENTS.md. | |

**User's choice:** Automated re-run of existing TEST-11

### Q3: What evidence artifact does the PR / SUMMARY carry to prove DBHY-03 passed?

| Option | Description | Selected |
|--------|-------------|----------|
| Test output + Studio query screenshot | TEST-11 pass output in SUMMARY.md plus a screenshot of a Studio query confirming the cast vote landed in `vote_counts`. Matches Phase 11 / Phase 12 evidence style. | ✓ |
| Test output only | Capture TEST-11 pass output; no production-cast screenshot. Lighter; skips visual proof of trigger fire. | |
| Sentry / Supabase logs link | Cite Sentry submit-vote transaction or Supabase function logs as proof. Requires PostHog/Sentry to be on; relies on log retention. | |
| Commit-only signal | Just commit "smoke passed" with no embedded artifact. Lowest-overhead but breaks the v1.2 evidence pattern. | |

**User's choice:** Test output + Studio query screenshot

### Q4: When does `supabase db lint --linked` run for DBHY-02?

| Option | Description | Selected |
|--------|-------------|----------|
| Local before merge + post-deploy re-run | Run locally against the linked prod project before merging (proves the SQL is correct as-written); re-run after deploy to confirm zero WARNs on actual prod state. | ✓ |
| Local before merge only | Run locally; trust the deploy carries the migration unchanged. Skips the post-deploy snapshot. | |
| Post-deploy only | Skip the pre-merge lint; find out from prod if the migration is bad. | |
| CI-based lint check | New GitHub Actions step. Net-new CI infra; v1.3 doesn't currently have this. | |

**User's choice:** Local before merge + post-deploy re-run

---

## DBHY-04 doc-fix location

### Q1: Where does the DBHY-04 doc fix land?

| Option | Description | Selected |
|--------|-------------|----------|
| Edit-in-place in archive | Update `.planning/milestones/v1.2-phases/11-schema-rls-ef-foundations/11-PATTERNS.md` directly. Pragmatic since it's the canonical cross-milestone reference. | ✓ |
| CORRIGENDUM section at top | Leave original skeleton intact, prepend a CORRIGENDUM block. Preserves historical record. | |
| Move PATTERNS.md out of archive | Relocate to `.planning/patterns/11-PATTERNS.md`. Bigger structural change. | |
| Cite v1.3 SUMMARY as new source of truth | Leave 11-PATTERNS.md alone; correct the skeleton in Phase 14 SUMMARY.md. Lowest-touch but search readers find the legacy form. | |

**User's choice:** Edit-in-place in archive

### Q2: What form does the edit take?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace skeleton + add changelog note | Replace the legacy admin-OR-bypass skeleton with the shipped REVIEW-FIX-H3 form. Add a short note at top: `Updated 2026-05-16 (Phase 14, DBHY-04) — original form had admin-OR drift; see REVIEW-FIX-H3.` | ✓ |
| Replace skeleton only | Replace silently. Cleanest reader-facing result; loses drift-history breadcrumb. | |
| Strikethrough legacy + add new form | Keep legacy form via markdown strikethrough, append the corrected form. Most visually noisy. | |

**User's choice:** Replace skeleton + add changelog note

### Q3: Is DBHY-04 a separate commit from the migration, or folded in?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate commit, same PR | Two atomic commits in one PR: `feat(db): migration 14 — security definer search_path lockdown` and `docs(11-patterns): align vote_counts skeleton with shipped REVIEW-FIX-H3 form`. Easy independent revert. | ✓ |
| Single combined commit | One commit covering both. Simpler git log; harder independent revert. | |
| Separate PR | Doc fix in its own PR. Cleanest isolation; adds review overhead for a tiny change. | |

**User's choice:** Separate commit, same PR

---

## Rollback / safety net

### Q1: What's the rollback strategy if Migration 14 breaks the vote path?

| Option | Description | Selected |
|--------|-------------|----------|
| Fix-forward via Studio `CREATE OR REPLACE` | 7 atomic `CREATE OR REPLACE`s. If one breaks, re-run the prior body via Studio SQL editor (paste from migrations 0/1/2/3/4/5/9/10 source). No separate rollback migration. | ✓ |
| Pre-write rollback migration 15 | Ship a paired `00000000000015_rollback_phase_14.sql`. Belt-and-braces; doubles surface area. | |
| Supabase point-in-time restore | Use Supabase PITR. Free-tier window is limited (24h); risks losing votes/state between deploy and detection. | |
| Phase 14 PR blocks merge until local-dev replay clean | Pre-deploy gate; rollback strategy unchanged. | |

**User's choice:** Fix-forward via Studio CREATE OR REPLACE

### Q2: Is local-dev migration replay required before merging?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — local `supabase start` replay required | Run Migration 14 against local Supabase + cast a local vote before pushing the PR. Catches body-syntax errors at the cheapest stage. | ✓ |
| Yes, but only `supabase db lint` locally | Run the lint check locally; skip a full replay. Faster. | |
| No — rely on prod cast + Studio fix-forward | Push it; smoke on prod; fix-forward if it breaks. Highest blast radius if wrong. | |

**User's choice:** Yes — local `supabase start` replay required

### Q3: Deploy timing for Migration 14?

| Option | Description | Selected |
|--------|-------------|----------|
| Any time — advisor-WARN fix is low-risk | `CREATE OR REPLACE FUNCTION` is atomic per-function; no schema lock; WTCS poll traffic is low and asynchronous. | ✓ |
| Low-traffic window only | Deploy when polls are quiet. Adds scheduling overhead for likely zero-impact fix. | |
| Pair with cast-a-vote in real-time | Deploy then immediately cast the smoke vote watching Supabase logs. Treat as a checklist item, not a constraint. | |

**User's choice:** Any time — advisor-WARN fix is low-risk
**Notes:** Real-time cast-a-vote stays as a checklist item alongside the deploy step, not a hard constraint.

---

## Migration filename slug

### Q1: What's the filename for Migration 14?

| Option | Description | Selected |
|--------|-------------|----------|
| `00000000000014_harden_security_definer_search_path.sql` | Verb-first ("harden"), explicit subject. Matches prior verb-led names like `fix_pr_review`, `null_choices_guard`, `audit_log_fk_hardening`, `demote_admin_guarded_advisory_lock`. | ✓ |
| `00000000000014_function_search_path_lockdown.sql` | Noun-led; emphasizes lockdown framing. Slightly less verb-consistent with prior migrations. | |
| `00000000000014_security_definer_v1_3.sql` | Includes milestone version. Project hasn't used version numbers in migration filenames before. | |
| `00000000000014_set_search_path_empty.sql` | Most literal description; loses SECURITY DEFINER framing context. | |

**User's choice:** `00000000000014_harden_security_definer_search_path.sql`

---

## Claude's Discretion

- Exact SQL formatting of the 7 `CREATE OR REPLACE FUNCTION` blocks (order, comment headers, internal style).
- Whether the PR description embeds a function-body diff table or just cites the migration file.
- Mechanism for proving `is_current_user_admin()` body-identical (CI grep, `pg_get_functiondef` snapshot, or manual inspection — planner picks the cheapest credible option).

## Deferred Ideas

- Paired rollback migration 15 — rejected for Phase 14; future risky DDL phase can revisit.
- CI-based `supabase db lint` check — rejected for Phase 14; revisit when CI infra is built for another reason.
- Moving `11-PATTERNS.md` out of the archive directory — rejected for Phase 14; structural reorganization is its own phase.
- Net-new v1.3-scoped RLS matrix test — rejected for Phase 14; planner flags TEST-11 rot as a sub-task if discovered.
