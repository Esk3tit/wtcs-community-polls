# Phase 19: DB Migration + A11y Restore - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 19-db-migration-a11y-restore
**Areas discussed:** GUC flag scope, Reachability proof, Old gate handling, <h2> restore approach

---

## GUC flag scope

| Option | Description | Selected |
|--------|-------------|----------|
| Transaction-local | `set_config('app.xxx','on', true)` — local to the current transaction, auto-cleared on commit/rollback; can't leak across PgBouncer-pooled connections. Safest. | ✓ |
| Session-local | `set_config(..., false)` — persists for the DB session; with pooling a stale 'on' flag could leak into a later request and bypass the gate. | |

**User's choice:** Transaction-local
**Notes:** Pooling-leak / bypass risk was the deciding factor for a security-conscious gate.

---

## Reachability proof

| Option | Description | Selected |
|--------|-------------|----------|
| Integration test, both paths | e2e/integration Vitest (TEST-11 precedent): assert authed client UPDATE to a protected col is rejected, and the update_profile_after_auth RPC succeeds. Proves the branch end-to-end through the real RLS+trigger stack. | ✓ |
| DB-level trigger test | SQL/pgTAP-style test invoking the UPDATE as a non-owner role to force the client branch directly. More surgical but new test infra not in the repo. | |
| You decide | Let planning pick the lightest genuine proof, biased to the existing harness. | |

**User's choice:** Integration test, both paths
**Notes:** Confirmed viable after inspecting profiles RLS — the self-UPDATE policy permits the row, so a direct authed UPDATE genuinely reaches the trigger.

---

## Old gate handling

| Option | Description | Selected |
|--------|-------------|----------|
| Fully replace | Remove `current_user = session_user`; the GUC flag is the sole discriminator. Matches REQUIREMENTS ("replaced"). | ✓ |
| Keep both | GUC flag plus the old check as belt-and-suspenders. The old check is provably non-functional here, so it adds confusion without protection. | |

**User's choice:** Fully replace
**Notes:** —

---

## <h2> restore approach

| Option | Description | Selected |
|--------|-------------|----------|
| Polymorphic CardTitle (asChild) | Add Radix Slot `asChild` to the shared CardTitle, render `<CardTitle asChild><h2>…</h2></CardTitle>`. Reusable; touches ui/card.tsx. Verify with getByRole('heading',{level:2}). | ✓ |
| Inline <h2> replacement | Drop CardTitle in these two spots, render a styled `<h2>` directly. Localized but duplicates styling and diverges from the shadcn pattern. | |
| You decide | Let planning pick the smallest clean diff. | |

**User's choice:** Polymorphic CardTitle (asChild)
**Notes:** Verification via getByRole heading-level assertion; remove the existing `role="heading" aria-level={2}` ARIA workaround.

---

## Claude's Discretion

- Exact GUC name, migration filename/number.
- Whether the regression test also asserts `is_admin` alongside `mfa_verified`.
- One combined PR vs split DB/a11y PRs (default: single phase PR).

## Deferred Ideas

None — discussion stayed within phase scope. A severity finding (the protected
branch is currently *bypassed*, not dead — a live privilege-escalation path) was
captured in CONTEXT.md `<specifics>`, including a flag that production may be
exposed and the migration may warrant expedited deployment.
