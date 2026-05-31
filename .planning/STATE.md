---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: — Hygiene & Performance
status: "Phase 17 shipped — PR #42"
stopped_at: Phase 17 UI-SPEC approved
last_updated: "2026-05-31T06:11:12.559Z"
last_activity: 2026-05-30
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 73
  completed_plans: 15
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14 after v1.2 milestone)

**Core value:** Community members can share opinions on competitive scene proposals with confidence that results are authentic
**Current focus:** Milestone complete

## Current Position

Phase: 17
Plan: Not started
Status: Phase 17 shipped — PR #42
Last activity: 2026-05-30

Progress: [██████████] 100% (plans)

## Performance Metrics

**Velocity:**

- Total plans completed: 15
- Average duration: mixed (Phase 14: ~3h; Phase 15: orchestrator-driven multi-session)
- Total execution time: ~3h (Phase 14) + multi-session (Phase 15)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 14 | 1 | ~3h | ~3h |
| 15 | 5 | multi-session | mixed (operator-driven Wave 3) |
| 16 | 7 | - | - |
| 17 | 2 | - | - |

*Updated after each plan completion*
| Phase 16 P16-01 | 15m | 4 tasks | 3 files |
| Phase 16 P02 | 5m | 1 tasks | 1 files |
| Phase 16 P03 | multi-session | 7 tasks | 11 files |
| Phase 16 P04 | 20m | 2 tasks | 1 files |
| Phase 16 P06 | 15min | 3 tasks | 3 files |
| Phase 16 P07 | 10min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Recent decisions affecting v1.3 work (full log in PROJECT.md Key Decisions table):

- D-12: UIDN-02 closure trigger = next perf-budget change (not a hard 5/5-route gate); DEFER outcome is acceptable
- D-13: Single Lighthouse rerun per milestone on production; no repeated runs
- Phase 14: `CREATE OR REPLACE FUNCTION` (not `ALTER FUNCTION`) for Migration 14 — preserves OID stability for trigger references
- Phase 14 W0: `rls_auto_enable` carved out as R2 system-owned (dashboard-installed event trigger, not in repo migration history); DBHY-02 acceptance amended to permit one residual `0011` WARN for it (turned out unnecessary — post-deploy lint showed zero WARNs)
- Phase 14 W0 Check 1B: U2 outcome (3+4-param overloads both in prod); Migration 14 unconditionally drops the 3-param overload (Cycle-3 Option A)
- Phase 15 shipped 2026-05-25: 5 plans (smoke fire triggers + sourcemap-names verify script + CI wiring + operator evidence capture + closure), 5 issues closed (#11, #12, #13, #17, #19), evidence in 15-EVIDENCE.md
- Phase 15 plan-defects recorded for cleanup: (a) sentry-cli v3 removed both `sourcemaps list` and `releases files <release> list` — plan referenced both; (b) OBSV-05 Discover-based per-event count requires paid Sentry tier; per-issue Events filter fallback was used
- [Phase ?]: PostHog facade as namespace-object so AuthContext/ConsentContext call sites are byte-identical after import-path swap
- [Phase ?]: PostHogGate renders children as sibling of Suspense boundary to prevent router blanking during lazy-import window
- [Phase ?]: PostHogProviderInner uses module-scope init so StrictMode double-invoke does not double-flush queue
- [Phase ?]: Function form for manualChunks (not object form) — boundary-anchored regex prevents kitchen-sink contamination
- [Phase ?]: vendor-react includes scheduler (React runtime dep) — cache-stable unit is the React family
- [Phase 16]: defaultPreload: 'intent' added at router level; explicit preload={false} on both Admin links (Navbar + MobileNav) preserves V4 Access Control boundary (hover-redirect leak mitigated)
- [Phase 16]: Task 3 live hover-smoke accepted via static-grep fallback — admin session unavailable locally; plan fallback clause invoked; operator plain-accepted
- [Phase 16-07]: v1.3 Lighthouse rerun PASS — 5/5 mobile routes Perf ≥ 90 (home 90, topics 92, archive 92, auth-error 91, admin 91) against prod merge cd8e7f9; UIDN-02 closed; Mobile-first responsive design Key Decision flipped ⚠️ Revisit → ✓ (D-08 PASS path)

### Blockers/Concerns

- _(Phase 14 HIGH-RISKs resolved — `increment_vote_count` body was already qualified in production; `is_current_user_admin` body-identical diff PASS post-deploy; `rls_auto_enable` carved out per W0 finding)_

## Deferred Items

Items acknowledged and deferred at milestone v1.2 close on 2026-05-14:

| Category | Item | Status | Notes |
|----------|------|--------|-------|
| uat_gaps | Phase 12 12-UAT.md | partial | 0 pending scenarios — file status string drift; live tests all pass |
| uat_gaps | Phase 13 13-HUMAN-UAT.md | resolved | 0 pending scenarios — verifier confirmed UAT 3/3 pass; status field reads `resolved` not `complete` |
| v1.4+ | Phase 04 UAT 6a backfill | deferred | second-admin live test; deferred again at v1.3 scoping |
| v1.4+ | Phase 03 UAT tests 2+3 | deferred | non-member tester gated; deferred again at v1.3 scoping |
| v1.4+ | Local ES256 bug (1.73.x) | deferred | prod unaffected; awaiting upstream Supabase fix |
| v1.4+ | TEST-11 12-cell vitest run | deferred | local gotrue `email_provider_disabled`; same precedent as Local ES256. Phase 14 Task 07b regression fixture covers the is_current_user_admin correctness question with stronger evidence. |
| v1.4+ | `profile_self_update_allowed` `current_user = session_user` gate | deferred | Postgres-semantics finding from coderabbit on PR #30 (declined as out-of-scope for hardening phase). Inside a SECURITY DEFINER trigger, `current_user` always resolves to function owner — gate can't distinguish direct client UPDATEs from RPC-mediated UPDATEs. Function pre-dates Phase 14 (migration 4); preserved verbatim under hardening-only invariant. In practice the protected-column branch is likely dead code because table-level RLS blocks direct client UPDATEs to protected columns. Remediation options: (a) drop SECURITY DEFINER from trigger; (b) pass an explicit trusted-context flag from `update_profile_after_auth` (session GUC) and check that flag instead. Option (b) more robust; needs its own migration. |

## Session Continuity

Last session: 2026-05-30T16:51:58.317Z
Stopped at: Phase 17 UI-SPEC approved
Resume action: orchestrator runs Phase 16 phase-level verification + completion
