# Phase 20: Live Human UAT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 20-live-human-uat
**Areas discussed:** Existing-evidence verdict, Artifact standard, Cleanup mechanics, Accounts & environment

---

## UAT-01 verdict (Phase 03 tests 2+3 — non-member gate)

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh live run now | Re-execute tests 2+3 on current post-Phase-19 prod with the non-member 2FA account | |
| Accept existing pass | Treat the 2026-05-03 recorded pass as satisfying UAT-01; attach artifact reference | |
| Accept only if gate code unchanged | Diff the membership-gate path since 2026-05-03; accept if untouched, else re-run | ✓ |

**User's choice:** Accept only if gate code unchanged.
**Notes:** Diff performed during discussion → the non-member rejection path is fully client-side (`auth-helpers.ts:191-202`, returns before the `update_profile_after_auth` RPC at line 209) and unchanged since 2026-05-03; error page (`AuthErrorPage.tsx`, `error.tsx`) untouched since April; migrations 14/15 changed only the post-success RPC non-members never reach. Conditional resolved → accept existing pass.

---

## UAT-01 lock (after diff finding)

| Option | Description | Selected |
|--------|-------------|----------|
| Accept — no fresh run | Gate path provably unchanged → 2026-05-03 pass satisfies UAT-01; record diff rationale as acceptance basis | ✓ |
| Fresh run anyway | Re-execute on current prod for max debt-zero confidence | |

**User's choice:** Accept — no fresh run.
**Notes:** Locked as D-01/D-03.

---

## UAT-02 verdict (Phase 04 test 6a — demote flow)

| Option | Description | Selected |
|--------|-------------|----------|
| Backfill existing pass | Formalize the off-record MapCommittee pass into the structured record + clear the deferred marker | ✓ |
| Fresh live run now | Re-execute the demote click flow with a current second admin on post-Phase-19 prod | |

**User's choice:** Backfill existing pass.
**Notes:** Matches PROJECT.md framing of this item as a "backfill". Locked as D-02.

---

## Artifact standard

| Option | Description | Selected |
|--------|-------------|----------|
| Capture fresh screenshots | Operator captures a current screenshot per scenario, stored outside planning docs, referenced by path/URL | |
| Narrative + verdict only | Treat existing detailed notes + verdict as sufficient; soften screenshot wording | |
| You decide per scenario | Planner picks the lightest artifact that satisfies the criterion per scenario | ✓ |

**User's choice:** You decide per scenario.
**Notes:** Captured as D-05 with the hard constraint that original runs are historical events that can't be re-screenshotted — so per scenario: reference existing narrative + optional current confirming screenshot of the reproducible UI state, or document why a literal past-event screenshot is N/A.

---

## Cleanup mechanics (criterion 3)

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve + supersede rollup | Keep historical deferred/skipped rows verbatim; update SUMMARY rollups + add one-line resolution pointers linking to the pass section + Phase 20 | ✓ |
| Rewrite rows to pass | Change the deferred/skipped result rows directly to 'pass' in place | |

**User's choice:** Preserve + supersede rollup.
**Notes:** Honors the files' explicit preserve-history convention (D-10/D-11) AND satisfies debt-zero. Locked as D-04.

---

## Accounts & environment

| Option | Description | Selected |
|--------|-------------|----------|
| No live accounts needed | No fresh runs → no non-member or second-admin account; optional screenshot uses operator's own admin session on prod | ✓ |
| Line up accounts anyway | Keep accounts available in case planner/verifier pushes for a fresh confirming run | |

**User's choice:** No live accounts needed.
**Notes:** Locked as D-06. Live prod only; local stack not used.

---

## Claude's Discretion

- Per-scenario artifact choice (D-05) — planner picks the lightest artifact that satisfies the success criterion.

## Deferred Ideas

None — discussion stayed within phase scope. Pre-existing harmless follow-ups already noted in the UAT files (fake `admin_discord_ids` row cleanup; leftover "Test:" polls in prod) are out of scope for Phase 20.
