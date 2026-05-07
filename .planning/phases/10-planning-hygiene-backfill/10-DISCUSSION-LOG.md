# Phase 10: Planning Hygiene Backfill - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 10-planning-hygiene-backfill
**Areas discussed:** VALIDATION schema target, VERIFICATION.md depth, SUMMARY req sourcing, UAT 6a evidence format

---

## VALIDATION schema target (DOCS-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 06 form | `status: complete` + `nyquist_compliant: true` + `wave_0_complete: true` + preserve `created` + add `last_updated`. The truly post-execution production shape; matches actual ship state of phases 01–04. | ✓ |
| Phase 05 form | `status: planned` + `nyquist_compliant: true` + `updated`. Picks up Phase 05's anomalous "planned" status which itself was never flipped post-execution. | |
| Hybrid (closure-aware) | Phase 06 keys but per-phase `nyquist_compliant` based on what was actually validated. Most honest, slightly more bespoke. | |

**User's choice:** Phase 06 form (after a clarifying turn — user asked what VALIDATION.md was for and was given a plain-English explanation before re-asking).
**Notes:** User picked "Just pick the obvious one" after the explainer. Phase 06 form is mechanically obvious because phases 01–04 shipped working code (378/378 tests, 47/50 UAT) — they ARE complete; the original `draft / false / false` frontmatter was stale, never updated post-execution. `nyquist_compliant: true` is a retrospective claim grounded in actual passing tests + audit verdict.

---

## VERIFICATION.md depth (DOCS-02)

| Option | Description | Selected |
|--------|-------------|----------|
| C — Middle | Full structural match to peer phases (01/02/04/05/06), but sections cite/link to existing evidence rather than duplicating. Audit-clean against ROADMAP success criterion #2 wording, low duplication. | ✓ |
| A — Full retrospective | Mirror peer phases top-to-bottom with inline evidence. Most thorough, most duplication. | |
| B — Minimal stub | Short doc citing where the real evidence lives. Smallest delta, won't satisfy "consistent in structure" wording. | |

**User's choice:** C — Middle.
**Notes:** Locks `03-VERIFICATION.md` to a structural mirror of 01/02/04/05/06 with evidence cited via link to: 03-UAT.md (4/4 functional passes), 05-VERIFICATION.md (transitive), REQUIREMENTS.md inline cites (Phase 6 D-09 audit), and v1.0-MILESTONE-AUDIT.md cross-phase integration checks.

---

## SUMMARY req sourcing (DOCS-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-check all three | Pull candidates from VERIFICATION.md traceability + REQUIREMENTS.md inline cites + milestone-audit tech_debt; declare REQ-ID only when ≥2 sources agree. Strongest audit posture, slowest. | ✓ |
| VERIFICATION.md primary | Use each phase's VERIFICATION.md as source of truth; fall back to milestone-audit only when uncovered. Faster, still authoritative. | |
| Milestone-audit primary | Use audit's tech_debt rows directly. Fastest, inherits any audit gaps. | |

**User's choice:** Cross-check all three.
**Notes:** A REQ-ID is declared in `requirements-completed:` only when ≥2 of {VERIFICATION traceability, REQUIREMENTS inline cites, milestone-audit tech_debt} agree. Single-source-only candidates surface as discrepancies in `10-RESEARCH.md` for the user to resolve before write — never silently included. Phase 03's missing VERIFICATION.md is treated as "VERIFICATION source silent" until DOCS-02 lands; for the Phase 03-related SUMMARY in scope (03-02-SUMMARY) the cross-check leans on REQUIREMENTS.md + milestone-audit + (post-DOCS-02) 03-VERIFICATION.md.

---

## UAT 6a evidence format (DOCS-04)

| Option | Description | Selected |
|--------|-------------|----------|
| B — Off-Record Verification section | Append new section, preserve original deferred 6a row untouched. Mirrors Phase 8 D-12 pattern for off-record evidence — same shape across the milestone. | ✓ |
| A — In-place row update | Flip existing 6a row from "deferred" to "passed" with inline cite. Simpler, loses "why deferred originally" history, diverges from Phase 8's pattern. | |
| Both | Flip the row AND add an Off-Record Verification subsection. Belt + suspenders, slight redundancy. | |

**User's choice:** B — Off-Record Verification section.
**Notes:** Sub-block fields match Phase 8 D-12: Test name, Executor (MapCommittee, Discord ID `290377966251409410`), Verified at (UTC ISO 8601 — exact date confirmed from git/audit context, fallback to "during v1.0 → v1.1 transition"), Result (PASS), Notes (≥1 line on what the second admin clicked + observed; pointer to the 13 unit tests covering the source-side demote click flow).

---

## Claude's Discretion

- **Audit re-run mechanism (success criterion #5):** Manual checklist pass against `v1.0-MILESTONE-AUDIT.md § tech_debt` rows for phases 01–04, recorded inline in `10-VERIFICATION.md`. Optional grep-based audit script under `.planning/closure/` if researcher finds it cheap; not required.
- **Commit cadence:** One commit per requirement (DOCS-01..04) is the default; planner MAY squash into a single phase-end commit if PR review is cleaner that way.
- **`CLAUDE.md` line 21 / `.planning/DESIGN-SYSTEM.md` boundary:** Phase 9 deferred `CLAUDE.md` Maia → new-york rewrite as a discretion item. Phase 10 MAY include it ONLY IF `CLAUDE.md` is hand-maintained (not auto-derived from PROJECT.md). If hand-maintained, edit as a fifth atomic commit citing Phase 9 UIDN-04. If auto-generated, leave alone.
- **Phase 10's own VALIDATION.md:** Stub with `status: complete, nyquist_compliant: N/A` OR explicitly omit and note in 10-VERIFICATION.md. Either is acceptable; consistency with how Phase 9 (closure-evidence-only) handled it is the tiebreaker.
- **Phase 10's own SUMMARY frontmatter:** Plan summaries inherit DOCS-03's cross-check rule — declare DOCS-01..04 IDs in their respective plan SUMMARY files.
- **Sign-off / closure-line wording** in `03-VERIFICATION.md` and the new `04-UAT.md` Off-Record Verification section — researcher proposes; planner locks. Consistent with Phase 7/9 dated sign-off precedent.
- **Researcher's parallel discovery:** If wider `requirements-completed:` drift surfaces during cross-check beyond the 17 audit-flagged files, the researcher MAY surface it as deferred work for v1.2, not Phase 10 scope-creep.

## Deferred Ideas

- **Scripted audit-doc-hygiene checker** (`.planning/closure/audit-doc-hygiene.sh` — grep-based frontmatter validator) — Claude's Discretion to include if researcher finds it cheap; otherwise v1.2 candidate.
- **`requirements-completed:` cross-check across ALL phase SUMMARY files** beyond the 17 audit-flagged ones — full sweep is a v1.2 docs task per `v1.0-MILESTONE-AUDIT.md § tech_debt § cross_milestone`.
- **Project-wide ADR convention skill** — Phase 9 introduced an ADR-style note; formalising the format as a project convention is a v1.2 docs task.
- **Phase 03 UAT tests 2 + 3 second-human session** — Phase 8 owns the runbook + template; the actual session is asynchronous and does NOT block Phase 10.
- **Cleanup of fake `admin_discord_ids '123456789012345678'` from prod** (audit § tech_debt § phase_04, low priority, harmless).
- **Cleanup of 7 leftover `[E2E] Test:` polls in prod admin list** (audit § tech_debt § phase_04, separate task).
