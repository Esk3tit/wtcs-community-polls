---
phase: 17-planning-doc-ui-hygiene-sweep
plan: 01
subsystem: planning-docs
tags: [documentation, milestone, validation, verification, hygiene]

requires: []
provides:
  - "DOCS-05: confirmed v1.0 phase 01-04 VALIDATION.md frontmatters at target shape (status: complete + nyquist_compliant: true)"
  - "DOCS-06: 03-VERIFICATION.md status reconciled to retrospective + Subsequent evolution section with per-migration auth-path classification (migrations 3-14)"
  - "DOCS-07: audit-confirmed all 15 pre-Phase-05 SUMMARY requirements-completed fields"
  - "DOCS-08: v1.1 MILESTONES.md entry at full structural parity with v1.2 entry (9 sections, retroactive graded outcomes)"
affects: [planning-archives, milestone-log]

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/17-planning-doc-ui-hygiene-sweep/17-01-SUMMARY.md
  modified:
    - .planning/milestones/v1.0-phases/03-response-integrity/03-VERIFICATION.md
    - .planning/MILESTONES.md

key-decisions:
  - "D-06: v1.1 MILESTONES entry at full structural parity with v1.2 entry (every section reproduced; Decimal Phases explicitly 'None for v1.1')"
  - "D-07: v1.1 Key Decisions table carries retroactive graded ✓/⚠️ outcomes sourced from hindsight (phases 12-16)"
  - "D-08: v1.1 entry is manually curated — no CLI auto-extraction; v1.2 entry used as structural template"
  - "D-09: two-plan split — Plan A = doc hygiene (Markdown-only, file-disjoint from Plan B, parallel-safe)"
  - "D-12: PR merge gate — all configured bots reviewed AND explicit user OK before merge"

requirements-completed: [DOCS-05, DOCS-06, DOCS-07, DOCS-08]

# Metrics
duration: ~45min
completed: 2026-05-30
---

# Phase 17 Plan 01: Planning-Doc Hygiene Sweep Summary

**Doc hygiene sweep (DOCS-05/06/07/08): VALIDATION frontmatter audit-confirmed, 03-VERIFICATION.md status reconciled and Subsequent evolution section appended, 15 SUMMARY requirements-completed audit-confirmed, and v1.1 MILESTONES.md entry written at full structural parity with graded outcomes.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-30T22:45:00Z
- **Completed:** 2026-05-30T23:30:00Z
- **Tasks:** 3 (2 with file edits; 1 audit-only)
- **Files modified:** 2

## Accomplishments

- **DOCS-05**: Audited all 4 VALIDATION.md files (phases 01-04); all already at target shape (`status: complete` + `nyquist_compliant: true`) — no edits required.
- **DOCS-07**: Audit-confirmed all 15 pre-Phase-05 SUMMARY `requirements-completed` fields; 02-04 and 04-05 confirmed-empty with rationale already present; no SUMMARY edited.
- **DOCS-06**: Reconciled 03-VERIFICATION.md `status: resolved` → `status: retrospective` in frontmatter AND body `**Status:**` line; appended `## Subsequent evolution` section with per-migration auth-path classification for migrations 3-14, naming Migration 14 (DBHY-01) as the most recent auth-path change.
- **DOCS-08**: Manually curated v1.1 MILESTONES.md entry at full structural parity with v1.2 entry — all 9 sections present, Key Decisions table with retroactive ✓/⚠️ graded verdicts, `Decimal Phases` explicitly "None for v1.1", sourced from v1.1-ROADMAP.md + subsequent phase evidence.

## Task Commits

1. **Task 1 + 2: DOCS-05/06/07** - `29eb534` (docs)
2. **Task 3: DOCS-08** - `7f06f0d` (docs)
3. **Plan metadata (SUMMARY):** committed after narration

## Files Created/Modified

- `.planning/milestones/v1.0-phases/03-response-integrity/03-VERIFICATION.md` — status reconciled resolved → retrospective; `## Subsequent evolution` section appended
- `.planning/MILESTONES.md` — v1.1 entry inserted between v1.2 and v1.0 entries
- `.planning/phases/17-planning-doc-ui-hygiene-sweep/17-01-SUMMARY.md` — this file (created)

## DOCS-05 Per-File Audit Result

| File | Status Before | Edits Made |
|------|---------------|------------|
| `01-foundation-authentication/01-VALIDATION.md` | `status: complete`, `nyquist_compliant: true` | None — already correct |
| `02-browsing-responding/02-VALIDATION.md` | `status: complete`, `nyquist_compliant: true` | None — already correct |
| `03-response-integrity/03-VALIDATION.md` | `status: complete`, `nyquist_compliant: true` | None — already correct |
| `04-admin-panel-suggestion-management/04-VALIDATION.md` | `status: complete`, `nyquist_compliant: true` | None — already correct |

All four files already matched the target frontmatter shape. DOCS-05 satisfied by audit, no edit required.

## DOCS-07 15-File Audit Log

| SUMMARY file | requirements-completed result |
|---|---|
| 01-01-SUMMARY.md | populated — [UIDN-03, INFR-01, TEST-01] |
| 01-02-SUMMARY.md | populated — [ADMN-01, INFR-03] |
| 01-03-SUMMARY.md | populated — [AUTH-01, AUTH-02, AUTH-04, AUTH-05, UIDN-01, UIDN-02] |
| 01-04-SUMMARY.md | populated — [AUTH-04, AUTH-05, TEST-02] |
| 02-01-SUMMARY.md | populated — [CATG-02, CATG-03, CATG-04] |
| 02-02-SUMMARY.md | populated — [VOTE-01, VOTE-02, VOTE-03, RSLT-01, RSLT-02, RSLT-03, RSLT-04, RSLT-05, INFR-04] |
| 02-03-SUMMARY.md | populated — [TEST-03] |
| 02-04-SUMMARY.md | confirmed-empty — [] with rationale "No v1.0 REQ-ID maps to this gap-closure plan per D-08 cross-check" |
| 03-01-SUMMARY.md | populated — [AUTH-03, TEST-04] |
| 03-02-SUMMARY.md | populated — [VOTE-04] |
| 04-01-SUMMARY.md | populated — [ADMN-04, POLL-01, POLL-05, POLL-06, POLL-07, LIFE-01, LIFE-02, LIFE-03, CATG-01] |
| 04-02-SUMMARY.md | populated — [ADMN-04, ADMN-02, ADMN-03, CATG-01, POLL-02, LIFE-01, TEST-05] |
| 04-03-SUMMARY.md | populated — [ADMN-02, ADMN-03, ADMN-04, CATG-01] |
| 04-04-SUMMARY.md | populated — [POLL-01, POLL-02, POLL-03, POLL-04, POLL-05, POLL-06, POLL-07, LIFE-01, LIFE-02, LIFE-03, TEST-05] |
| 04-05-SUMMARY.md | confirmed-empty — [] with rationale "No v1.0 REQ-ID maps to this gap-closure plan per D-08 cross-check" |

DOCS-07 satisfied by audit: exactly 15 SUMMARYs audited; all requirements-completed fields present; all empty cases carry the confirmed-empty rationale; no SUMMARY edited.

## DOCS-06 Per-Migration Auth-Path Classification

| Migration | Auth-relevant? | Rationale |
|-----------|---------------|-----------|
| 3 — guild_membership | Auth-path | Phase 03's own migration; added guild_member column, updated update_profile_after_auth to 4-param; listed for completeness |
| 4 — fix_trigger_rpc_context | Auth-path | Fixed profile_self_update_allowed to permit update_profile_after_auth writes to mfa_verified/guild_member from SECURITY DEFINER context |
| 5 — admin_phase4 | Auth-path | Introduced is_current_user_admin() (is_admin only at this point); admin-bypass RLS branches; later corrected by migration 9 |
| 6 — update_poll_rpc_error_codes | Non-auth | Poll CRUD RPC error codes only; no auth-path surface |
| 7 — fix_pr_review | Partially auth-path | REVOKE EXECUTE FROM PUBLIC on SECURITY DEFINER RPCs (narrows callable surface) is auth-relevant; cardinality/FOR UPDATE fixes are non-auth |
| 8 — null_choices_guard | Non-auth | Poll input validation only |
| 9 — admin_integrity_rls | Auth-path | is_current_user_admin() rewritten to check is_admin AND mfa_verified AND guild_member; closes RLS bypass for admins who lost guild membership after re-auth |
| 10-13 (v1.2 migrations) | Non-auth | results_hidden/audit_log/demote_admin — noted as out-of-scope in Subsequent evolution section |
| 14 — harden_security_definer_search_path (DBHY-01) | Auth-path (most recent) | Hardened update_profile_after_auth, is_current_user_admin, profile_self_update_allowed, handle_new_user, increment_vote_count, validate_vote_choice with SET search_path = ''; dropped stale 3-param update_profile_after_auth overload |

## DOCS-08 v1.2 Template Parity Sections

| Section | v1.1 populated? | Source |
|---------|----------------|--------|
| Header block (Shipped, Phases, Tag, URL, Deferred items) | Populated | v1.1-ROADMAP.md § Phases header |
| ### Delivered | Populated | v1.1-ROADMAP.md § Overview |
| ### Key Accomplishments | Populated — 4 items (one per phase 7/8/9/10) | v1.1-ROADMAP.md § Phases |
| ### Stats | Populated | v1.1-ROADMAP.md § Git range / code delta |
| ### Decimal Phases | "None for v1.1 — all integer phases (7, 8, 9, 10)." | D-06: explicit, not dropped |
| ### Key Decisions (with outcomes) | Populated — 8 decisions with ✓/⚠️ verdicts | v1.1-ROADMAP.md § Key Decisions; hindsight from phases 12-16 |
| ### Issues Resolved During Milestone | Populated | v1.1-ROADMAP.md § Issues Resolved |
| ### Known Gaps Carried Forward | Populated — UIDN-02 + UIDN-03 carry-forward | v1.1-ROADMAP.md § Issues Deferred |
| ### Known Tech Debt | Populated | Per v1.2 pattern; surfaced OBSV residuals + async-reconciliation pattern |
| ### Issues Deferred to v1.2+ | Populated — UIDN-02, UIDN-03, SEED-002 | v1.1-ROADMAP.md § Issues Deferred |
| Footer | Populated — v1.1-ROADMAP.md + v1.1-REQUIREMENTS.md links | v1.1-ROADMAP.md archive paths |

Source counts used: phases 7-10, 16 plans, 4 PRs (#21, #22, #24, #25), shipped 2026-05-11.

## Decisions Made

- D-06: Full structural parity for v1.1 MILESTONES entry — every section from v1.2 reproduced; empty sections explicitly stated rather than dropped.
- D-07: Retroactive ✓/⚠️ graded outcomes in Key Decisions table — D-14 (bundle overrun) and D-11 (async reconciliation) both graded ⚠️ Revisit based on hindsight from phases 12-16.
- D-08: Manual curation only — no CLI auto-extraction; v1.2 entry used as byte-structural template.
- D-09: This plan is Plan A (doc hygiene, Markdown-only); disjoint from Plan B (UI Card migration).

## Deviations from Plan

None — plan executed exactly as written. Task 1 was audit-confirm (DOCS-05 and DOCS-07); the live state already matched target for all 4 VALIDATION.md files and all 15 SUMMARY files. Task 2 (DOCS-06) edited 03-VERIFICATION.md as specified. Task 3 (DOCS-08) wrote the v1.1 MILESTONES.md entry as specified.

## Issues Encountered

None.

## Self-Check: PASSED

Files exist:
- `.planning/milestones/v1.0-phases/03-response-integrity/03-VERIFICATION.md` — FOUND
- `.planning/MILESTONES.md` — FOUND
- `.planning/phases/17-planning-doc-ui-hygiene-sweep/17-01-SUMMARY.md` — FOUND

Commits exist:
- `29eb534` (DOCS-05/06/07) — FOUND
- `7f06f0d` (DOCS-08) — FOUND

---

*Phase: 17-planning-doc-ui-hygiene-sweep*
*Completed: 2026-05-30*
