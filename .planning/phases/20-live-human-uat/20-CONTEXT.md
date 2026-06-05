# Phase 20: Live Human UAT - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the two second-human-gated UAT carry-forwards (UAT-01, UAT-02) so neither
file retains a "pending"/"deferred" scenario, satisfying the v1.4 debt-zero
mandate.

- **UAT-01** — Phase 03 UAT tests 2 + 3 (non-member server-membership gate +
  error-page invite link).
- **UAT-02** — Phase 04 UAT test 6a (live demote-admin click flow).

**Pivotal context discovered during discussion:** *both* scenarios already have
recorded PASS evidence — they were executed live with real accounts before this
milestone:
- UAT-01: `03-UAT.md` § Second-Human Verification — Test 2 & Test 3 both
  `result: pass`, executed **2026-05-03** by `test-dev-account` (2FA-on,
  non-WTCS-member) on live prod.
- UAT-02: `04-UAT.md` § Off-Record Verification — test 6a **PASS** by
  MapCommittee (`290377966251409410`) during the v1.0→v1.1 transition.

This phase is therefore **evidence reconciliation + rollup cleanup**, NOT new
live test execution. The operator-locked "executed live with real accounts; E2E
mocking is not a substitute" intent is *already met* by the existing runs — the
gap is (a) the v1.4 artifact standard and (b) the historical files still carry
non-pass rollup markers. No new live runs are required (see D-01/D-02).

**Out of scope:** re-running the tests from scratch; any product/code change;
re-validating scenarios beyond UAT-01/UAT-02.
</domain>

<decisions>
## Implementation Decisions

### UAT-01 verdict — accept existing pass (no fresh run)
- **D-01:** Accept the 2026-05-03 second-human PASS as satisfying UAT-01. **No
  fresh live run.** Acceptance basis is a documented gate-path-unchanged diff
  (see D-03) — the path tests 2+3 exercise has not changed since the evidence
  was recorded.

### UAT-01 acceptance basis — gate-path-unchanged diff (already performed)
- **D-03:** The non-member rejection path is **fully client-side and unchanged**
  since 2026-05-03. Evidence captured during discussion:
  - `src/lib/auth-helpers.ts:191-202` returns `{ success: false, reason:
    'not-in-server' }` and signs out **before** the `update_profile_after_auth`
    RPC call (line 209). A non-member never reaches the RPC.
  - Error page + invite link (`src/components/auth/AuthErrorPage.tsx`,
    `src/routes/auth/error.tsx`) untouched since April 2026.
  - Migrations **14 & 15 did land after 2026-05-03**, but they only change
    `update_profile_after_auth` internals (search_path lockdown + trusted-context
    GUC) — the **post-success RPC** path, which non-members never execute.
  - `git log --since=2026-05-03` on the gate files shows the last gate-relevant
    change was 2026-05-01 (a comment-only archaeology strip).
  - **Planner/executor:** record THIS rationale in `03-UAT.md` as the formal
    acceptance basis so the verifier can audit why no fresh run was needed.

### UAT-02 verdict — backfill existing off-record pass
- **D-02:** Formalize the off-record MapCommittee 6a PASS (currently in
  `04-UAT.md` § Off-Record Verification) into the structured record and clear the
  preserved `deferred` marker per the rollup rules in D-04. **No fresh live run.**
  Matches the PROJECT.md framing of this item as a "backfill".

### Cleanup mechanics — preserve history + supersede the rollup
- **D-04:** Honor the files' explicit preserve-history convention (D-10/D-11;
  `03-UAT.md` line ~55, `04-UAT.md` line ~212) AND satisfy criterion 3.
  Mechanism: **keep every historical `result: deferred` / `result: skipped` row
  verbatim**; do NOT rewrite them to `pass`. Instead:
  - **Update the SUMMARY rollups** so no aggregate still reads pending/deferred:
    - `04-UAT.md`: top-level `result: partial` → complete; `deferred: 1` → `0`;
      `partial: 1` reconciled; `re_run_partial` note (line ~174) and the
      "Test 6a still pending / awaits a second logged-in admin" followups
      (lines ~52, ~176) updated to resolved.
    - `03-UAT.md`: reconcile `skipped: 2` (lines ~46-47) — the original Test 2/3
      `result: skipped` rows (lines ~21, ~26) are superseded by the
      § Second-Human Verification pass.
  - **Add a one-line resolution pointer** on each preserved historical row /
    followup that links forward to the formalized pass section + this Phase 20
    closure.
  - Net result: historical rows intact, rollups show debt-zero, criterion 3
    satisfied.

### Evidence artifact standard — planner's discretion per scenario
- **D-05:** Success criteria call for a "screenshot or screen-recording
  reference". The planner picks the **lightest artifact that satisfies the
  criterion, per scenario.** Hard constraint: the original runs are **historical
  events that cannot be re-screenshotted**, so for each scenario the artifact is
  either (a) reference the existing narrative evidence + attach **one current
  confirming screenshot of the reproducible UI state**, or (b) document explicitly
  why a literal screenshot of a past event is N/A and the narrative+verdict
  stands. The reproducible states need no special accounts (see D-06):
  - UAT-01: the `/auth/error?reason=not-in-server` page renders directly from its
    route (reason validated from the URL in `error.tsx`).
  - UAT-02: current Admins-list / demote UI state shows from the operator's own
    admin session.
  - Artifacts, if captured, are stored **outside** the planning markdown (text
    only) and referenced by path/URL.

### Accounts & environment — no live test accounts required
- **D-06:** Because both verdicts are "no fresh run", **no non-member 2FA account
  and no second-admin account are required.** Any optional confirming screenshot
  is captured from the **operator's own admin session on live prod**
  (`https://polls.wtcsmapban.com`). Local stack is not used (the non-member gate
  + real Discord OAuth are prod/real-Discord concerns, and no live execution is
  happening regardless).

### Claude's Discretion
- D-05 explicitly delegates the per-scenario artifact choice to the
  planner/executor (lightest-that-satisfies-the-criterion).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UAT target files (where evidence is recorded + rollups reconciled)
- `.planning/milestones/v1.0-phases/03-response-integrity/03-UAT.md` — UAT-01
  target. § Second-Human Verification already holds the Test 2/3 PASS; record the
  D-03 acceptance basis here and reconcile the `skipped: 2` rollup (D-04).
- `.planning/milestones/v1.0-phases/04-admin-panel-suggestion-management/04-UAT.md`
  — UAT-02 target. § Off-Record Verification holds the 6a PASS; formalize it,
  clear the `deferred` marker, and update the `partial`/`deferred: 1` rollups +
  "still pending" followups (D-02, D-04).

### Requirement & roadmap definitions
- `.planning/REQUIREMENTS.md` — UAT-01 (line ~32), UAT-02 (line ~34) definitions
  and the requirement-status table (both currently "Pending", Phase 20).
- `.planning/ROADMAP.md` § Phase 20 — goal + 3 success criteria (artifact +
  no-remaining-pending/deferred).

### Acceptance-basis source (UAT-01 gate-path diff — D-03)
- `src/lib/auth-helpers.ts` — non-member rejection at lines 191-202 (returns
  before the `update_profile_after_auth` RPC at line 209). The diff anchor.
- `src/components/auth/AuthErrorPage.tsx` — `not-in-server` error copy + invite
  link (Test 3). Unchanged since April 2026.
- `src/routes/auth/error.tsx` — validates `reason` from URL; renders the error
  page directly (basis for the D-05 reproducible screenshot).
- `supabase/migrations/00000000000014_harden_security_definer_search_path.sql`,
  `supabase/migrations/00000000000015_trusted_profile_update_guc.sql` — the
  post-2026-05-03 changes that touch only the post-success RPC (confirm they do
  NOT affect the non-member path).

### 6a source-side coverage (cited in existing evidence)
- `src/__tests__/admin/demote-admin.test.ts` — 13 unit tests cited as the
  source-side coverage backing the 6a flow.

### Established second-human evidence runbook/convention
- `.planning/milestones/v1.1-phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md` —
  the second-human verification runbook (D-13) referenced by `03-UAT.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Append-only evidence-section pattern** — both UAT files already use a
  dedicated appended section (§ Second-Human Verification in 03; § Off-Record
  Verification in 04) that preserves the original row and records the subsequent
  pass. Phase 20 reuses this exact pattern for the rollup-supersede pointers
  (D-04) rather than inventing a new format.
- **`/auth/error` route renders the error page directly** (`error.tsx` validates
  `reason` from the URL) — lets the operator screenshot the `not-in-server` state
  without a real non-member OAuth attempt (D-05).

### Established Patterns
- **Preserve-history convention (D-10/D-11)** — historical `result:` rows are
  never rewritten; supersession is additive. D-04 follows this.
- **Debt-zero rollup expectation (v1.4)** — aggregate/summary fields, not just
  per-test rows, must read zero pending/deferred for the verifier to pass.

### Integration Points
- This phase touches **only** the two archived UAT markdown files under
  `.planning/milestones/v1.0-phases/` — no application code, migrations, or tests
  change. STATE.md requirement-status table (UAT-01/02 → Validated) updates at
  phase close.
</code_context>

<specifics>
## Specific Ideas

- The UAT-01 acceptance hinges on a concrete, already-completed diff: non-member
  rejection lives at `auth-helpers.ts:191-202` and returns *before* the RPC that
  migrations 14/15 changed. The planner should treat this as a settled fact to
  transcribe into `03-UAT.md`, not re-investigate from scratch (though a quick
  re-confirm of the line numbers at execution time is prudent — the file may
  shift).
- Operator-locked intent ("executed live with real accounts; E2E mocking is not a
  substitute") is satisfied by the *existing* runs — do not interpret it as
  mandating new runs.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Pre-existing harmless follow-ups
already noted in the UAT files — e.g. cleanup of the fake `admin_discord_ids`
`123456789012345678` row and leftover "Test:" polls in prod — are NOT part of
UAT-01/UAT-02 and are out of scope for Phase 20 unless the operator folds them in
separately.)

</deferred>

---

*Phase: 20-live-human-uat*
*Context gathered: 2026-06-04*
