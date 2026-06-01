# Phase 18: Test-Environment Repair - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 18-test-environment-repair
**Areas discussed:** Fault-injection method, Test-user auth fix, Edge-runtime pin, Regression guards

---

## Fault-Injection Method (TEST-19) — technique

| Option | Description | Selected |
|--------|-------------|----------|
| Real DB-level failure | Inject a genuine failure against the real DB (temp trigger/constraint or revoked privilege on polls UPDATE) so the actual EF failure path runs. Highest fidelity. | |
| Mock/stub the UPDATE | Stub the Supabase client so the UPDATE rejects. Simpler/isolated, but simulated — and likely can't reach a server-side EF's internal call. | |
| You decide (recommend) | Recommend during research based on reachability. | ✓ |

**User's choice:** You decide (Claude discretion)
**Notes:** Recommendation recorded: real DB-level injection — the `create-poll` EF runs server-side, so a client mock can't intercept its internal UPDATE; real injection is likely the only reachable path and matches the REAL-repair ethos.

---

## Fault-Injection Method (TEST-19) — coverage depth

| Option | Description | Selected |
|--------|-------------|----------|
| Both branches | Assert UPDATE-fails (`poll_created` persists) AND compensating-DELETE-fails (`poll_created_orphaned`). Full coverage. | |
| Primary branch only | Assert just UPDATE-failure → orphan-row path. Leaves the rarer branch uncovered. | |
| You decide (recommend) | Lean Both; confirm feasibility in research. | ✓ |

**User's choice:** You decide (Claude discretion)
**Notes:** Recommendation recorded: cover both branches — debt-zero favors closing the whole documented gap; second branch is cheap once injection harness exists. Document why if the second branch proves unreachable.

---

## Test-User Auth Fix (TEST-18)

| Option | Description | Selected |
|--------|-------------|----------|
| Autoconfirm config | Fix `[auth.email]` (enable_confirmations=false) so sign-in works without confirmation. Declarative, in config.toml; matches TEST-18 wording. | |
| Service-role pre-confirmed seed | Mint pre-confirmed users via service-role admin API; bypasses email flow in test code. | |
| Inbucket SMTP confirm | Configure local Inbucket and drive real confirmation flow. Highest fidelity, most moving parts. | |
| You decide (recommend) | Lean Autoconfirm config. | ✓ |

**User's choice:** You decide (Claude discretion)
**Notes:** Recommendation recorded: autoconfirm config — most literally satisfies TEST-18, keeps fix in config.toml, and the RLS matrix only needs valid sessions, not real email delivery.

---

## Edge-Runtime Pin (TEST-17)

| Option | Description | Selected |
|--------|-------------|----------|
| Exact pin | Pin the precise version resolving ES256. Max reproducibility/determinism; matches pin-everything habit. | |
| Floating minimum | Allow patched-or-newer. Auto-gets future fixes but reintroduces drift risk. | |
| You decide (recommend) | Lean Exact pin. | ✓ |

**User's choice:** You decide (Claude discretion)
**Notes:** Recommendation recorded: exact pin — reproducibility + "stays repaired" align with debt-zero.

---

## Regression Guards

| Option | Description | Selected |
|--------|-------------|----------|
| No — green suite is enough | The repaired CI suite IS the guard; no extra tooling. Keeps phase tightly scoped. | |
| Yes — add explicit guards | Dedicated assertions (pinned-version check / ES256-email smoke) à la verify-sourcemap-names.mjs. Net-new tooling. | |
| You decide (recommend) | Lean No. | ✓ |

**User's choice:** You decide (Claude discretion)
**Notes:** Recommendation recorded: no bespoke guards — the green CI suite + exact version pin already guard against regression; bespoke scripts would be scope creep on a closeout phase. Research may flag a cheap naturally-emerging guard.

---

## Claude's Discretion

All five decisions delegated by the operator ("you decide"), each with a recommendation recorded inline above and in CONTEXT.md `<decisions>` (D-01…D-05). Planner/researcher refine the exact mechanism within each recommendation; deviations justified against the recorded rationale.

## Deferred Ideas

None — discussion stayed within phase scope. (DBHY-05, UIDN-06, UAT-01/02, DEP-01/02 already mapped to Phases 19–21.)
