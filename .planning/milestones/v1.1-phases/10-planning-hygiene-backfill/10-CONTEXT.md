# Phase 10: Planning Hygiene Backfill - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure planning-doc edits across `.planning/phases/01..04/` so v1.0 phase artifacts conform to the post-Phase-05 schema and the v1.0 milestone audit's "tech debt → v1.1" list closes to zero. **Zero code changes** — every plan is a file edit under `.planning/phases/01..04/` and (for DOCS-04) `.planning/phases/04-admin-panel-suggestion-management/04-UAT.md`.

**In scope:**
- DOCS-01: VALIDATION.md frontmatter backfill on phases 01, 02, 03, 04 to the Phase 06 schema (status: complete, nyquist_compliant: true, wave_0_complete: true).
- DOCS-02: Retroactive `03-VERIFICATION.md` mirroring the structure of 01/02/04/05/06 VERIFICATION.md, with sections citing existing evidence rather than duplicating it.
- DOCS-03: `requirements-completed:` array declarations in the 17 SUMMARY files flagged by `.planning/milestones/v1.0-MILESTONE-AUDIT.md § tech_debt` (under phases 02, 03-02, 04-02 / 04-04, 01-04). REQ-IDs cross-checked against three sources before declaration.
- DOCS-04: Phase 04 UAT 6a (live demote-admin click flow) evidence appended to `.planning/phases/04-admin-panel-suggestion-management/04-UAT.md` as a new "Off-Record Verification" section, citing the second-admin pass on Discord ID `290377966251409410` (MapCommittee) during the v1.0 → v1.1 transition.
- Manual re-audit pass against `.planning/milestones/v1.0-MILESTONE-AUDIT.md § tech_debt` rows — success criterion #5 — confirming zero outstanding planning-artifact gaps.

**Out of scope:**
- Any source-code changes (no `src/`, `supabase/functions/`, or `supabase/migrations/` edits).
- Any test additions, deletions, or modifications under `src/__tests__/`, `e2e/`, or `playwright.config.ts`.
- Phase 03 UAT tests 2 + 3 second-human runs (Phase 8 owns the runbook + template; the actual session is async, separate from Phase 10 scope).
- Re-validating phases 01–04 (`status: complete + nyquist_compliant: true` is a retrospective claim grounded in 378/378 unit tests and 47/50 UAT — no new tests are added or re-run in this phase).
- v1.2 product features — SEED-002 admin visibility belongs in v1.2, not here.
- A scripted audit-runner CLI — re-audit is manual against the existing tech_debt list (see Claude's Discretion below).

</domain>

<decisions>
## Implementation Decisions

### DOCS-01 — VALIDATION.md frontmatter target schema
- **D-01:** Phases 01, 02, 03, 04 VALIDATION.md frontmatter conforms to the **Phase 06 form** verbatim:
  ```yaml
  ---
  phase: N
  slug: <existing-slug>
  status: complete
  nyquist_compliant: true
  wave_0_complete: true
  created: <preserve original>
  last_updated: <Phase 10 commit date>
  ---
  ```
  Rationale: phases 01–04 shipped working code (378/378 unit tests, 47/50 UAT, all v1.0 requirements satisfied per `v1.0-MILESTONE-AUDIT.md § scores`). The original `status: draft + nyquist_compliant: false + wave_0_complete: false` values are stale frontmatter that was never updated post-execution, NOT an honest record of validation state. The `nyquist_compliant: true` claim is retrospective and grounded in the actual passing test suite + audit verdict.
- **D-02:** Preserve each phase's existing `created:` date verbatim (originals: 01 = 2026-04-06, 02–04 dates already on file). Set `last_updated:` to the Phase 10 commit date — single source of truth for "when did this VALIDATION become honest."

### DOCS-02 — 03-VERIFICATION.md depth & shape
- **D-03:** Retroactive `03-VERIFICATION.md` matches the **full structural template** of peer phases (01/02/04/05/06): success-criterion verdict rows, requirement traceability table, plan-by-plan verdict, sign-off line. Header sections present so the file is consistent with the family per ROADMAP success criterion #2.
- **D-04:** Sections **cite/link to existing evidence** rather than duplicating it. Authoritative sources to reference inline:
  - `.planning/phases/03-response-integrity/03-UAT.md` — 4/4 functional UAT passes (member login, vote, rate limit, results-respondents-only).
  - `.planning/phases/05-launch-hardening/05-VERIFICATION.md` — transitive re-verification of Phase 03 deliverables during launch hardening.
  - `.planning/REQUIREMENTS.md` § Authentication, Responding, Testing — inline evidence cites for AUTH-03, VOTE-04, TEST-04 added by the Phase 6 D-09 audit.
  - `.planning/milestones/v1.0-MILESTONE-AUDIT.md § cross_phase_integration_checks` — observability/auth/admin pipelines verified end-to-end including Phase 03 surfaces.
- **D-05:** Phase 03 UAT tests 2 + 3 (Non-Member Login Rejection + Error Page Invite Link) remain **deferred** in 03-VERIFICATION.md — call out the deferral explicitly with a pointer to Phase 8 D-13 (`.planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md`) where the second-human runbook lives. Phase 10 does NOT block on those tests being run.
- **D-06:** Sign-off line at end of `03-VERIFICATION.md` follows the dated convention used in Phase 7/9 closure files: `Signed off 2026-05-DD — Phase 03 verification artifact backfilled retroactively; verification work itself was complete at v1.0 ship per cited evidence.`

### DOCS-03 — 17 SUMMARY requirements-completed sourcing rule
- **D-07:** REQ-IDs declared in `requirements-completed:` arrays are sourced by **cross-checking three references**:
  1. `<phase>-VERIFICATION.md` traceability table (per-plan REQ-ID mapping the verifier validated).
  2. `.planning/REQUIREMENTS.md` inline evidence citations (Phase 6 D-09 audit baked these in for every shipped REQ).
  3. `.planning/milestones/v1.0-MILESTONE-AUDIT.md § tech_debt` rows (the audit itself enumerated missing REQ-IDs per file).
- **D-08:** A REQ-ID is declared in a SUMMARY's `requirements-completed:` only when **at least 2 of the 3 sources agree**. Single-source-only candidates (one source claims the REQ, the other two are silent or contradictory) are flagged as discrepancies in `10-RESEARCH.md` for resolution by the user before write — do NOT silently include or exclude them.
- **D-09:** The 17 files in scope are explicitly enumerated in `v1.0-MILESTONE-AUDIT.md § tech_debt` (under `phase_01`, `phase_02`, `phase_03`, `phase_04` rows naming "missing requirements-completed frontmatter"). Researcher pulls the canonical list from there at start of Plan 03; planner double-checks against `find .planning/phases/0[1-4]-*/*-SUMMARY.md` to catch any audit omissions.

### DOCS-04 — Phase 04 UAT 6a evidence format
- **D-10:** Phase 04 UAT 6a evidence is appended to `04-UAT.md` as a new top-level **"Off-Record Verification"** (or "Second-Human Verification" — planner picks heading consistent with Phase 8 D-12 wording) section. The original deferred 6a row stays untouched — preserves the historical reason for deferral. Mirrors Phase 8 D-12 pattern for off-record/second-human evidence so the milestone uses one consistent recording shape.
- **D-11:** Off-Record Verification sub-block fields (matches Phase 8 D-12 schema):
  - **Test:** UAT 6a — Live demote-admin click flow
  - **Executor:** MapCommittee (Discord ID `290377966251409410`)
  - **Verified at:** UTC ISO 8601 timestamp of the off-record session (researcher confirms exact date from git/audit context; falls back to "during v1.0 → v1.1 transition (2026-04-28 → 2026-05-DD)" if no precise timestamp available)
  - **Result:** PASS
  - **Notes:** ≥1-line description of what the second admin clicked + observed, plus a pointer to the 13 unit tests covering the demote click flow source-side.

### Phase 10's own artifacts (doc-only phase)
- **D-12:** Phase 10's own `10-VALIDATION.md` is **N/A or stub** — there is no test infrastructure to validate (zero code, zero test changes). Planner picks between (a) emitting a stub VALIDATION.md with `status: complete, nyquist_compliant: N/A, wave_0_complete: N/A` and a one-line rationale, or (b) explicitly omitting VALIDATION.md and noting the omission in `10-VERIFICATION.md`. Either is acceptable; consistency with how prior doc-only/closure-evidence phases handled it (see Phase 9) is the tiebreaker.
- **D-13:** Phase 10's own `10-VERIFICATION.md` IS produced — it is the artifact certifying success criterion #5 (the manual re-audit). Verdict rows mirror peer phases.

### Claude's Discretion
- **Audit re-run mechanism (success criterion #5):** No shell script exists. Re-audit is a **manual checklist pass** against `v1.0-MILESTONE-AUDIT.md § tech_debt` rows for phases 01–04, recorded inline in `10-VERIFICATION.md`. Researcher MAY propose a small `.planning/closure/audit-doc-hygiene.sh` (grep-based: missing frontmatter keys, draft status, missing requirements-completed arrays) if it is genuinely re-runnable — but this is optional; manual sufficient.
- **Commit cadence:** One commit per requirement (DOCS-01, DOCS-02, DOCS-03, DOCS-04) is the default; planner MAY consolidate into a single squashed phase-end commit if PR review is cleaner that way. No requirement to commit per file.
- **`CLAUDE.md` line 21 / `.planning/DESIGN-SYSTEM.md` boundary:** Phase 9 deferred the `CLAUDE.md` Maia → new-york rewrite to Phase 10 as a discretion item. Phase 10 MAY include it ONLY IF it can be verified that `CLAUDE.md` is hand-maintained (not auto-generated from `PROJECT.md`). If hand-maintained, edit in this phase as a fifth atomic commit, citing UIDN-04 from Phase 9. If auto-generated, leave alone.
- **Phase 10's own SUMMARY frontmatter:** Plan summaries inherit the same `requirements-completed:` rule as DOCS-03 — declare DOCS-01..04 IDs in their respective plan SUMMARY files.
- **Sign-off / closure-line wording** in 03-VERIFICATION.md and (optionally) the new 04-UAT.md Off-Record Verification section — researcher proposes; planner locks. Consistent with Phase 7/9 dated sign-off precedent.
- **Researcher's parallel discovery:** The audit's `tech_debt § cross_milestone` row notes that `requirements-completed` evidence drift was historically widespread before Phase 6 D-09; the researcher MAY surface any additional drift discovered during cross-check (D-08) as deferred work for v1.2, not Phase 10 scope-creep.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements (locked)
- `.planning/ROADMAP.md` § Phase 10: Planning Hygiene Backfill — Goal, dependencies, success criteria (5 items), requirements (DOCS-01..04).
- `.planning/REQUIREMENTS.md` § Documentation — DOCS-01, DOCS-02, DOCS-03, DOCS-04 verbatim text.
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — **primary source of truth** for tech_debt rows that Phase 10 closes; § tech_debt § phase_01..04 enumerate exact files + missing keys; § scores establishes the retrospective `nyquist_compliant: true` basis.

### Schema reference (Phase 06 form for D-01)
- `.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-VALIDATION.md` — **canonical frontmatter shape** to mirror in DOCS-01 backfills (status: complete, nyquist_compliant: true, wave_0_complete: true, last_updated:).

### VERIFICATION.md structural pattern (D-03 source)
- `.planning/phases/01-foundation-authentication/01-VERIFICATION.md` — peer-phase structural template.
- `.planning/phases/02-browsing-responding/02-VERIFICATION.md` — peer-phase structural template.
- `.planning/phases/04-admin-panel-suggestion-management/04-VERIFICATION.md` — peer-phase structural template (largest, most-detailed VERIFICATION; closest analog to what Phase 03 needed at ship time).
- `.planning/phases/05-launch-hardening/05-VERIFICATION.md` — peer-phase template + **transitive re-verification source** for Phase 03 deliverables (cite inline in 03-VERIFICATION.md per D-04).
- `.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-VERIFICATION.md` — peer-phase structural template.

### DOCS-02 evidence sources (cited inline, not duplicated)
- `.planning/phases/03-response-integrity/03-UAT.md` — 4/4 functional UAT passes; the deferred tests 2 + 3 records.
- `.planning/REQUIREMENTS.md` § Authentication (AUTH-03), Responding (VOTE-04), Testing (TEST-04) — inline evidence cites added by Phase 6 D-09 audit.
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md § cross_phase_integration_checks` — auth/admin/observability pipelines verified end-to-end.

### DOCS-03 cross-check sources (D-07, D-08)
- Each `<phase>-VERIFICATION.md` traceability table (phases 01, 02, 04 — Phase 03 only after DOCS-02 lands; if needed, treat its absence as "VERIFICATION source silent" and rely on the other two sources).
- `.planning/REQUIREMENTS.md` — inline evidence cites per REQ-ID.
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md § tech_debt § phase_01..04` — enumerates the 17 SUMMARY files and the REQ-IDs each is missing.

### DOCS-04 evidence-format precedent
- `.planning/phases/08-e2e-test-hygiene/08-CONTEXT.md` § D-12 — "Second-Human Verification section" pattern; preserve original deferred record untouched.
- `.planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md` — runbook + evidence-append template (analogous structure for Phase 04 UAT 6a entry).

### Phase 9 boundary inherited
- `.planning/phases/09-ui-closure-evidence/09-CONTEXT.md` § Claude's Discretion — `CLAUDE.md` line 21 preset cite explicitly handed off to Phase 10 as discretion. Decision: see D-Discretion above.

### Closure-evidence pattern (sign-off-line precedent)
- `.planning/closure/OBSV-02-bundle-delta.md` — Phase 7 closure file; dated sign-off line convention.
- `.planning/closure/UIDN-02-mobile-evidence.md` — Phase 9 closure file (if landed) — Phase 9 sign-off precedent.
- `.planning/closure/UIDN-03-shadcn-audit.md` — Phase 9 closure file (if landed).

### Project decisions that carry forward
- `.planning/PROJECT.md` § Constraints — $0 budget; informs "no new tooling for re-audit script" stance.
- `.planning/PROJECT.md` § Key Decisions — phase-numbering, branch-naming conventions.
- Source-comment rule (WHY-only, no plan-cite archaeology) — N/A in Phase 10 (no `src/` edits) but worth knowing for any researcher who explores adjacent code.

### Branch
- ROADMAP-locked: `gsd/phase-10-planning-hygiene-backfill`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`.planning/phases/06-.../06-VALIDATION.md` frontmatter** — copy-paste-and-adapt source for D-01 backfills. Shape is stable across `phase`, `slug`, `status`, `nyquist_compliant`, `wave_0_complete`, `created`, `last_updated`.
- **`.planning/phases/04-.../04-VERIFICATION.md`** — closest analog for the retroactive `03-VERIFICATION.md`: similar phase-scope shape (admin/data integrity), similar mix of automated + UAT evidence.
- **Phase 8's UAT-10 script + template** (`08-UAT-10-SCRIPT.md`) — DOCS-04 Off-Record Verification section reuses the same field schema (executor handle, verified at, result, notes); rename "Second-Human" → "Off-Record" only if both terms feel inaccurate for an in-house second admin.
- **`.planning/milestones/v1.0-MILESTONE-AUDIT.md` § tech_debt** — already enumerates the 17 SUMMARY files + per-file missing REQ-IDs. Researcher leans on this as the primary work-list, then validates against the other two sources.

### Established Patterns
- **Closure-evidence pattern** (Phase 7/9): `.planning/closure/<topic>.md` with dated sign-off line. Phase 10 does NOT produce a `.planning/closure/` file (DOCS-01..04 are phase-dir backfills, not closure evidence per se), but the dated-sign-off-line pattern carries into `03-VERIFICATION.md` per D-06.
- **Source-comment rule**: WHY-only, no review-round archaeology. N/A in Phase 10 (no `src/` edits).
- **No new package.json scripts for milestone artifacts** (Phase 7/8/9 precedent): if researcher proposes an audit-runner script, it lives under `.planning/closure/` or `.planning/phases/10-.../`, NOT in `package.json`.
- **Atomic-commit-per-requirement** (Phase 9 precedent for UIDN-04): each DOCS-NN gets its own commit unless squash makes review cleaner.
- **Preserve historical/deferred records, append new evidence sections** (Phase 8 D-12): used for DOCS-04 in this phase.

### Integration Points
- `.planning/PROJECT.md` Key Decisions table — does NOT need flipping for this phase (no ⚠️ Revisit rows resolved by DOCS-01..04). Phase 10 leaves PROJECT.md untouched unless the `CLAUDE.md` boundary item lands and a row needs updating.
- `.planning/REQUIREMENTS.md` § Documentation — DOCS-01..04 marked `[ ]` will flip to `[x]` once Phase 10 ships. Atomic with the corresponding requirement's commit.
- `.planning/STATE.md` — milestone progress counters update at phase end.
- `.planning/MILESTONES.md` — v1.1 milestone-completion entry referenced after Phase 10 ships and v1.1 closes.
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md § tech_debt` rows for phases 01–04 — Phase 10's verification recipes itemized re-audit closure against these rows.

</code_context>

<specifics>
## Specific Ideas

- **Branch:** `gsd/phase-10-planning-hygiene-backfill` (ROADMAP-locked).
- **Audit re-run = manual** against `v1.0-MILESTONE-AUDIT.md § tech_debt § phase_01..04` rows; recorded inline in `10-VERIFICATION.md`. A scripted helper is optional, not required.
- **`requirements-completed:` cross-check rule:** ≥2-of-3 sources must agree before declaring a REQ-ID. Single-source-only candidates surface as discrepancies in `10-RESEARCH.md` for the user to resolve before write — never silently included.
- **DOCS-04 evidence cites the second admin by name + Discord ID:** MapCommittee / `290377966251409410`. The pass occurred during the v1.0 → v1.1 transition. Researcher confirms exact date from git history if possible; falls back to a date range otherwise.
- **`nyquist_compliant: true` is a retrospective claim** — grounded in 378/378 unit tests + 47/50 UAT + audit verdict, NOT in re-running validation work. State this rationale in commit message and `10-VERIFICATION.md` so future maintainers know why a phase that never had nyquist_compliant flipped is now claimed compliant.

</specifics>

<deferred>
## Deferred Ideas

- **Scripted audit-doc-hygiene checker** (`.planning/closure/audit-doc-hygiene.sh` — grep-based frontmatter validator) — Claude's Discretion to include if researcher finds it cheap; otherwise v1.2 candidate alongside any LHCI / CI hygiene work.
- **`requirements-completed:` cross-check across ALL phase SUMMARY files** (not just the 17 audit-flagged ones) — `v1.0-MILESTONE-AUDIT.md § tech_debt § cross_milestone` notes wider drift was historical; full sweep is a v1.2 docs task, not Phase 10.
- **Project-wide ADR convention skill** — Phase 9 introduced an ADR-style note in `.planning/DESIGN-SYSTEM.md`; formalising the format as a project convention is a v1.2 docs task, not Phase 10.
- **Phase 03 UAT tests 2 + 3 second-human session** — Phase 8 owns the runbook + template. The actual asynchronous session is independent of Phase 10 and does NOT block this phase. Tracked separately under Phase 8 D-11/D-12.
- **Cleanup of fake `admin_discord_ids '123456789012345678'` from prod** (audit § tech_debt § phase_04, low priority, harmless).
- **Cleanup of 7 leftover `[E2E] Test:` polls in prod admin list** (audit § tech_debt § phase_04, separate task).

</deferred>

---

*Phase: 10-planning-hygiene-backfill*
*Context gathered: 2026-05-07*
