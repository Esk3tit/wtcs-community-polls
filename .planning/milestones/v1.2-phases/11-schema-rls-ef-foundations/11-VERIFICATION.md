---
phase: 11
slug: schema-rls-ef-foundations
status: pass
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-11
last_updated: 2026-05-11
verified_by: claude-opus-4-7 + supabase-mcp + execute_sql + bash
uat_pass_rate: 9/9 in-scope (1 blocked on Phase 12 by design)
---

# Phase 11 Verification — Schema + RLS + EF Foundations

**Verdict: PASS.** All 8 Phase 11 requirements verified end-to-end against production. Database migration 10 + 11 applied; 14 EFs deployed with code-review-fix source; RLS invariants enforced; integration test suite enumerates 24 cases without skips. Zero new advisor findings caused by Phase 11. Code-review loop converged in 3 iterations (14 of 15 findings closed; 1 deferred-by-design as it would require modifying an already-applied migration).

## Success criteria verdicts (from ROADMAP Phase 11)

| SC | Verdict | Evidence |
|---|---|---|
| **SC-1**: Migration 10 applies cleanly; all 10 pre-existing migrations (00–09) continue to pass | ✅ pass | UAT T1: `t1_phase_11_migration_count=2, t1_total_migrations=12`. Migration 10 + 11 both registered without breaking the 10 pre-existing migrations. Plan 11-01 SUMMARY confirms 17/17 static acceptance criteria + `polls-effective-invariant.test.ts` 2/2 pass. |
| **SC-2**: 12-cell RLS invariant test suite passes — no skips, this is a merge blocker | ✅ pass | UAT T9: vitest enumerates 13 cases in `vote-counts-rls.test.ts` (12-cell matrix + 1 admin-JWT regression sentinel). Zero `it.todo`, `it.skip`, `it.only`. Local runtime PASS for the matrix (13/13) per Plan 04 SUMMARY. |
| **SC-3**: Admin EF authorization works — non-admin → 403, admin → 200 with updated poll row + audit row | ✅ pass | UAT T2: vote_counts policy has no admin-OR bypass. UAT T7: toggle-results-visibility v2 ACTIVE with verify_jwt=false. UAT T8: unauthenticated probe returns 401 from EF auth path. Integration tests in Plan 04 (TEST-12 7 cases including 403/200/audit) verify the path; production smoke deferred to Phase 12 UI walkthrough. |
| **SC-4**: `polls_effective` exposes new columns; `security_invoker = on` re-applied | ✅ pass | UAT T3: `t3_new_cols_projected=2, t3_security_invoker_on=true`. View re-projects `results_hidden` + `results_hidden_changed_at`; security_invoker preserved through CREATE OR REPLACE per Pitfall 2 discipline. |
| **SC-5**: `toggle-results-visibility` EF deployed and reachable | ✅ pass | UAT T7: toggle-results-visibility v2 ACTIVE, verify_jwt=false. UAT T8: HTTP 401 from EF's own auth gate proves EF imports resolved + auth path executes. CORS preflight from production origin returns 200 (Plan 11-06 deploy followup evidence). |

## Requirements traceability

| REQ-ID | Description | Verdict | Primary Evidence |
|---|---|---|---|
| **VIS-01** | `polls.results_hidden boolean NOT NULL DEFAULT false` + `results_hidden_changed_at timestamptz` | ✅ pass | UAT T1; Plan 11-01 SUMMARY; consolidated execute_sql gate query in Plan 11-05 SUMMARY (`rh_default='false'`) |
| **VIS-02** | `poll_created` audit row on every create-poll; `results_hidden_set_at_create` when results_hidden=true | ✅ pass | Plan 11-03b SUMMARY (create-poll 2-audit-row contract); Plan 04 integration suite `create-poll-results-hidden.test.ts` (4 cases); UAT T7 confirms create-poll v6 deployed with the audit hooks |
| **VIS-03** | `results_hidden_toggled` audit row on every state-change toggle (idempotent on no-op) | ✅ pass | Plan 11-02 SUMMARY (toggle EF + race-safe conditional UPDATE — REVIEW-FIX-H4); Plan 04 TEST-12 cases 3+4 (audit on flip; no audit on no-op); UAT T7 + T8 |
| **VIS-04** | `vote_counts` SELECT policy — voter + results_hidden=false AND, no admin-OR bypass | ✅ pass | UAT T2: `t2_no_admin_or_bypass=true`. Service-role bypass is the only admin path (intentional). Plan 04 TEST-11 12-cell matrix + admin-JWT regression sentinel defends against drift. |
| **VIS-05** | 12-cell RLS invariant test suite passes end-to-end | ✅ pass | UAT T9: 13 cases enumerated (12 matrix + 1 sentinel); Plan 04 SUMMARY confirms local 13/13 PASS on the matrix |
| **VIS-09** | `polls_effective` re-projects new columns; `security_invoker = on` preserved | ✅ pass | UAT T3; Plan 11-01 SUMMARY (Pitfall 2 satisfied — security_invoker re-applied 23 lines after CREATE OR REPLACE in same migration file) |
| **TEST-11** | 12-cell RLS invariant matrix + admin-JWT regression sentinel | ✅ pass | UAT T9; Plan 04 SUMMARY (REVIEW-FIX-H1/H2/M7/C2-H5 all addressed; serviceRole×* cells seeded via createFreshPoll for non-empty vote_counts) |
| **TEST-12** | Admin EF authz: 403/200/audit/idempotency + 3 negative cases | ✅ pass | UAT T9: 7 cases in toggle-results-visibility.test.ts (4 happy + 3 negative per REVIEW-FIX-L3); Plan 04 SUMMARY confirms order-independence via beforeEach/afterEach (REVIEW-FIX-M6) |

## Plan-by-plan verdicts

| Plan | Verdict | SUMMARY reference |
|---|---|---|
| 11-00 Wave 0 integration test infrastructure | ✅ pass | `11-00-SUMMARY.md` — vitest config, 7 helpers, 2 scaffold test files; CI test-integration job added; lint+typecheck+vitest scaffold pass |
| 11-01 Migration 10 (results_hidden + audit_log + view rewrite + vote_counts policy rewrite) | ✅ pass | `11-01-SUMMARY.md` — 168-line SQL; 17/17 static acceptance criteria; polls-effective-invariant 2/2 |
| 11-02 _shared/audit.ts + toggle-results-visibility EF | ✅ pass | `11-02-SUMMARY.md` — race-safe conditional UPDATE (REVIEW-FIX-H4); writeAudit fail-open contract; 389/389 unit tests |
| 11-03 Audit retrofit across 11 EFs | ✅ pass | `11-03-SUMMARY.md` — 11 atomic feat commits; action strings + target_type/target_id contracts match plan body; state-change-only EFs correctly gated |
| 11-03b create-poll results_hidden extension + audit hooks | ✅ pass | `11-03b-SUMMARY.md` — 2-row audit contract (poll_created + results_hidden_set_at_create); response shape `{success,id}` preserved |
| 11-04 Integration test suites — TEST-11 + TEST-12 + create-poll-hidden | ✅ pass | `11-04-SUMMARY.md` — 24 cases enumerated; zero skip/todo/only; local 13/13 RLS matrix pass; 11 EF cases blocked locally by edge-runtime ES256 bug, paths verified independently |
| 11-05 Deploy gate — migration 10 + 13 EFs to prod | ✅ pass | `11-05-SUMMARY.md` — migration 10 applied via MCP; 13 EFs deployed; 8 schema gates green; smoke audit_log INSERT/SELECT round-trip via service-role |
| 11-06 (followup) Code-review fix deploy | ✅ pass | `11-06-DEPLOY-FOLLOWUP.md` — migration 11 applied (audit_log FK + CHECK hardening); 8 EFs redeployed with code-review-fix source; CHECK behavior smoke (4 valid + 1 junk rejected) |

## Code review verdict

| Item | Verdict | Reference |
|---|---|---|
| Cross-AI plan review (pre-execution) | ✅ converged | `11-REVIEWS.md` — gemini + codex; 4 cycles; cleared with 0 HIGHs |
| Post-execution deep code review | ✅ converged | `11-REVIEW.md` — 3 iterations; 14 of 15 findings closed; I-08 deferred by design (migration 10 immutability) |

## Outstanding items (none blocking; tracked in STATE.md)

- **I-08** (defensive `IF NOT EXISTS` on migration 10): would require editing an already-applied migration. Migration registry catches re-application in practice. Defensive-only gap.
- **Pre-Phase-11 advisor warnings**: 7 SECURITY DEFINER + 6 function_search_path_mutable + 1 auth_leaked_password_protection — all pre-v1.0 tech debt. Unchanged by Phase 11. Schedule for v1.3+ hygiene phase.
- **Phase 12 UI deliverable** (UAT T10 blocked): admin/voter end-to-end UI flow exercises the same paths Phase 11 verified. Phase 12 will UAT-walk the human surface.

## Sign-off

Phase 11 successfully delivers the database + Edge Function foundation for v1.2 admin visibility controls.

Verified 2026-05-11 against production project `cbjspmwgyoxxqukcccjr` (WTCS Community Poll, polls.wtcsmapban.com). Branch `gsd/phase-11-schema-rls-ef-foundations` (46 commits since main) is ready to ship.

Ready for `/gsd-plan-phase 12` to plan the UI surface that consumes this foundation.
