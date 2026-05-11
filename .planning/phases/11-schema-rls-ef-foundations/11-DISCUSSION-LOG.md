# Phase 11: Schema + RLS + EF Foundations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 11-schema-rls-ef-foundations
**Areas discussed:** audit_log table strategy, create-poll accepts results_hidden, Idempotency semantics + Phase 12 UI shape, TEST-11 runner

---

## audit_log table strategy

**Discovery during context-load:** REQUIREMENTS.md VIS-02 + ROADMAP success criterion 3 + TEST-12 all assume an `audit_log` table exists. Codebase scout confirmed it does NOT — `grep -rn 'audit_log' supabase/` returned zero matches; the 7 v1.0 tables are `admin_discord_ids`, `profiles`, `categories`, `polls`, `choices`, `votes`, `vote_counts`. The `v1.2-PITFALLS.md` research doc (line 191) incorrectly stated "audit_log table already exists from v1.0."

### Question 1: How to handle the missing audit_log table?

| Option | Description | Selected |
|--------|-------------|----------|
| Create audit_log in migration 10 | Add the audit_log table DDL to the same migration file as the results_hidden column + view + policy. Phase 11 scope expands by ~30-50 LOC (table + index). All future admin EFs gain a place to write audit rows. Aligns with what REQUIREMENTS.md/ROADMAP/TEST-12 already assume. | ✓ |
| Descope the audit row write | Drop 'writes audit row' from VIS-02 + ROADMAP SC-3 + TEST-12. Phase 11 only updates results_hidden + results_hidden_changed_at. Timestamp + Supabase Edge Function logs become the only paper trail. REQUIREMENTS.md needs an edit; defer audit_log to its own future phase if/when needed. | |
| JSONB on polls + EF logs | Append to a new polls.results_hidden_history jsonb column inside the same UPDATE statement (one DB write). Plus structured console.log in the EF. No new table. Lower scope cost than (A); fewer integrity guarantees. The 'audit row' in TEST-12 becomes 'jsonb array length increased'. | |

**User's choice:** Create audit_log in migration 10, with the previewed schema baseline.
**Notes:** User explicitly approved the previewed schema (id / actor_id / action / target_type / target_id / before / after / created_at / RLS admins-only).

### Question 2: Audit retrofit scope across existing admin EFs

| Option | Description | Selected |
|--------|-------------|----------|
| Only toggle-results-visibility writes | Phase 11 ships the table; only the new EF writes to it. Existing EFs keep their current no-audit behavior. Lowest scope. | |
| Also retrofit destructive EFs | Add audit writes to delete-poll, demote-admin, promote-admin, set-resolution. ~5 EF edits. Higher scope; gives the table real value on day one. | |
| Retrofit all 14 admin EFs | Wire audit_log into every requireAdmin-gated EF. Largest scope; full coverage from day one. Risk of inflating Phase 11. | ✓ |

**User's choice:** Retrofit all admin EFs.
**Notes:** User opted for full coverage. Significant Phase 11 scope expansion beyond the 5 ROADMAP SCs as written; CONTEXT.md flags this for the planner verifier.

### Question 3: actor_id nullability

| Option | Description | Selected |
|--------|-------------|----------|
| NOT NULL (admin actions only) | Every audit row requires a real authenticated admin. Cron EF (close-expired-polls) doesn't write audit rows. Cleaner constraints. | |
| Nullable (allow system actions) | actor_id REFERENCES profiles(id) — nullable. Cron EFs write a system row with actor_id = NULL. Schema is more permissive; queries must handle the NULL case. | ✓ |

**User's choice:** Nullable.
**Notes:** Enables `close-expired-polls` cron EF to participate in the audit retrofit (D-05).

### Question 4: Skip read-only EFs from retrofit?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip read-only EFs | Audit only the 12 mutation EFs + the new toggle = 13 audit-emitting EFs. search-admin-targets and get-upload-url don't change state. Cleaner model (audit_log = "who changed what"). | ✓ |
| Audit reads too | All 15 EFs write audit rows including read-only ones (action='admin_search' / 'upload_url_minted'). Higher noise; useful for security forensics. | |

**User's choice:** Skip read-only EFs (final retrofit count: 13 audit-emitting EFs).

---

## create-poll accepts results_hidden

| Option | Description | Selected |
|--------|-------------|----------|
| create-poll accepts results_hidden | Extend create-poll EF body with optional results_hidden: boolean (default false). Atomic creation; Phase 12 form gets a "Hide results" checkbox. No separate toggle needed for the create flow. | |
| Strict two-step (toggle EF only) | create-poll body unchanged; results_hidden always false at creation. To create a hidden poll, admin creates then immediately toggles (2 round-trips, 2 audit rows). Cleanest separation; matches a strict reading of VIS-03. | |
| create-poll accepts + write audit row | Like option A, but if results_hidden is true at creation, also write an audit row (action='results_hidden_set_at_creation'). Atomic AND audited. | ✓ |

**User's choice:** create-poll accepts + writes audit row when results_hidden=true at creation.
**Notes:** Phase 12 admin form gets a "Hide results" checkbox alongside other fields (VIS-06 already specifies Checkbox).

---

## Idempotency semantics + Phase 12 UI shape

User declined the initial idempotency framing and clarified that the UI shape (radio group vs button toggle) drives idempotency at the UI layer. We re-framed as one combined decision: pick the Phase 12 UI pattern, then pick the Phase 11 EF behavior in that context.

### Question 1: Phase 12 UI pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Switch (binary toggle) | shadcn Switch. Stable label ('Hide results from voters'); switch position shows current state. Best fit for binary boolean. Requires VIS-07 edit in Phase 12 (Button → Switch). | ✓ |
| Radio group | shadcn RadioGroup with two options (Visible / Hidden). Stable labels = current state. Slightly more visual real estate than Switch. Requires VIS-07 edit. | |
| Toggle button (keep VIS-07 as-is) | Keep the locked VIS-07 design: button label flips per state ('Hide results' ↔ 'Show results'), AlertDialog confirms each click. | |

**User's choice:** Switch.
**Notes:** Phase 12 also gets the VIS-07 wording update in REQUIREMENTS.md (Button → Switch); decision on whether AlertDialog confirmation stays or drops with the Switch UX is left to Phase 12.

### Question 2: EF no-op behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Silent no-op (200, no audit) | EF reads current value; if hidden===requested, return 200 with the current poll row but skip the UPDATE and skip the audit row. Quietest log; saves 2 DB writes per no-op. | |
| Always 200 + always audit | Always UPDATE (with same value) and always write an audit row, even on no-ops. Simplest EF code. Audit log shows every API call regardless of state change. | |
| 200 + audit only on state change | EF reads current value; UPDATE always (cheap), but only writes the audit row when before ≠ after. Quiet log; one extra DB read but matches 'audit_log = state changes' semantics cleanly. | ✓ |

**User's choice:** 200 + audit only on state change (D-11 in CONTEXT.md).
**Notes:** UI Switch shape makes UI no-ops trivially preventable; EF still defensively idempotent for network retries / cross-admin races.

---

## TEST-11 runner

User declined the initial framing and asked Claude's recommendation, with the reasoning that Playwright is for browser-based E2E and TEST-11 is pure DB integration. Claude confirmed the reasoning and recommended Vitest. User then confirmed the lock.

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest at e2e/integration/ | Plain Vitest spec at e2e/integration/vote-counts-rls.test.ts using @supabase/supabase-js with three pre-minted clients. Fast (~1s), no browser overhead. Mirrors polls-effective-invariant.test.ts pattern. New e2e/integration/helpers.ts for clients + freshPoll-equivalent. New npm run test:integration script with Vitest config scoped to e2e/integration/. | ✓ |
| Switch to Playwright after all | Override the recommendation. Playwright spec at e2e/tests/ reusing freshPoll + loginAs from Phase 8. Slower (~3-5s) but stays inside the existing e2e tagging/lint discipline. | |

**User's choice:** Vitest at e2e/integration/.
**Notes:** User reasoned correctly that Playwright is for browser tests and TEST-11 doesn't need a browser. The closest precedent (polls-effective-invariant.test.ts) is also Vitest. CI job structure (separate vs folded into existing) is a planner decision.

---

## Claude's Discretion

Areas the user delegated to Claude / planner judgment:
- Migration 10 statement order within the single file (D-22 Claude's Discretion area in CONTEXT.md)
- audit_log indexes (likely (target_type, target_id) and (actor_id, created_at) — planner picks)
- before/after JSONB shape per EF — keep compact; exact key choice per EF
- Audit `action` string convention (snake_case verb_phrase; consistency matters more than specific words)
- Whether close-expired-polls writes one batch audit row per cron run or one per closed poll
- Vitest describe.each matrix layout for TEST-11 (single 12-row table vs nested describe)
- vote_counts policy expression form (subquery vs JOIN to polls — research confirms PK-lookup acceptable at scale)
- Audit-write failure policy (does a failed audit INSERT fail the user-facing response, or log-and-continue? — planner picks)

---

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:
- Admin audit-log UI (browse audit entries) — v1.3+
- audit_log retention/pruning policy — revisit at 500MB ceiling
- search-admin-targets / get-upload-url audit retrofit — explicit Phase 11 exclusion (D-06)
- Audit on auth events (login / 2FA / signOut) — out of scope
- VIS-WINDOW window-of-control enum, VIS-PUBLIC-MODE pre-vote public visibility — already deferred in REQUIREMENTS.md
- DB trigger for results_hidden_changed_at — considered, rejected per D-13 (EF-direct write matches closed_at precedent)

## Phase 12 Carry-Forward Notes (for Phase 12 plan-phase intake)

- VIS-07 wording in REQUIREMENTS.md needs an edit in Phase 12: Button → Switch.
- AlertDialog confirmation status (keep / drop with Switch) is a Phase 12 UX decision.
- VIS-06 (creation form Checkbox) interacts with create-poll EF extension (D-08): Phase 12 wires the Checkbox to the new optional `results_hidden` field in the create-poll body.
