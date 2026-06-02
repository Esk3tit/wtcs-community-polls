# Phase 18: Test-Environment Repair - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Make all three broken/incomplete local test harnesses run green **for real** — no proxy coverage, no won't-fix:

1. **TEST-17** — Upgrade/pin the local supabase-edge-runtime past the 1.73.x ES256 JWT-verification bug so `npm run test:integration` (`vitest run --config vitest.config.integration.ts`) runs green locally and in CI with 0 skips / 0 xfail.
2. **TEST-18** — Fix the local gotrue `email_provider_disabled` configuration so the TEST-11 12-cell RLS invariant vitest matrix executes 12 PASS / 0 FAIL locally and in CI (supersedes the v1.3 SQL-regression-fixture stopgap).
3. **TEST-19** — Implement the deferred fault-injection branch in `e2e/integration/create-poll-results-hidden.test.ts` (post-RPC `UPDATE` failure path, currently a comment-only deferral at end of file) as an executable, green test.

**This phase is HOW-to-repair only.** No new test capabilities, no new product features. Scope is fixed by ROADMAP Phase 18 + REQUIREMENTS v1.4 (TEST-17/18/19).

</domain>

<decisions>
## Implementation Decisions

### Locked carry-forwards (from REQUIREMENTS.md + STATE.md — do NOT revisit)
- **L-01:** REAL environment repair only. Documenting the harnesses as won't-fix with proxy/alternative-validation coverage is explicitly rejected this milestone (operator decision, STATE.md line 69; REQUIREMENTS Out-of-Scope).
- **L-02:** Debt-zero. All three requirements must reach **Validated** — no `tech_debt` / DEFER exit.
- **L-03:** Green both **locally and in CI** for TEST-17/18 — no skips, no xfail.

### Fault-Injection Method (TEST-19)
- **D-01 (Claude discretion):** Technique left to research. Recommendation: **real DB-level failure injection** (temporary trigger/constraint or revoked privilege on the `polls` UPDATE) so the actual EF code path hits a genuine error. Rationale: the `create-poll` EF runs server-side, so a client-side Supabase mock cannot intercept the EF's internal UPDATE call — a real injection is likely the only reachable approach, and it matches the "authentic / REAL repair" ethos. Research confirms feasibility before planning.
- **D-02 (Claude discretion):** Coverage depth left to research. Recommendation: **cover both documented branches** — (a) UPDATE-fails → `poll_created` audit row persists (written before the UPDATE), and (b) compensating-DELETE-also-fails → `poll_created_orphaned` row emitted alongside. Rationale: debt-zero favors closing the whole documented gap; the second branch is cheap once the injection harness exists. If the second branch proves unreachable/infeasible, document why rather than silently dropping it.

### Test-User Auth Fix (TEST-18)
- **D-03 (Claude discretion):** Approach left to research. Recommendation: **autoconfirm config in `config.toml`** (fix the local `[auth.email]` provider with confirmations disabled) so email/password sign-in works without a confirmation step. Rationale: most literally satisfies TEST-18's "fix the `email_provider_disabled` config" wording, keeps the fix declarative and in `config.toml`, and the RLS matrix only needs valid sessions — not real email delivery. Service-role pre-confirmed seed and Inbucket SMTP confirm flow were considered and not preferred (the former bypasses rather than fixes config; the latter adds moving parts the RLS matrix doesn't need).

### Edge-Runtime Pin (TEST-17)
- **D-04 (Claude discretion):** Pin strategy left to research-identified version, but strategy is **exact pin** (precise edge_runtime image tag/version that resolves ES256). Rationale: reproducibility + deterministic CI + "stays repaired" align with debt-zero, and it matches the project's pin-everything habit. Floating-minimum rejected (reintroduces drift / silent re-break risk).

### Regression Guards
- **D-05 (Claude discretion):** **No bespoke regression-guard tooling** beyond the repaired green CI suite. Rationale: once the harnesses run green in CI, the suite itself is the guard (ES256/email/fault-injection regressions fail the affected tests), and the exact version pin (D-04) is itself a durable guard. Bespoke guard scripts (à la `verify-sourcemap-names.mjs`) would be net-new tooling beyond the three requirements — scope creep on a closeout phase. Research may flag a cheap, naturally-emerging guard if one appears, but none is required.

### Claude's Discretion
All five decisions above (D-01…D-05) were explicitly delegated by the operator ("you decide") with the recommendations recorded inline. Planner/researcher have latitude to refine the exact mechanism within each recorded recommendation; deviations from the recommended direction should be justified against the rationale noted.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & milestone constraints
- `.planning/REQUIREMENTS.md` § Test / CI Environment Repair — TEST-17/18/19 full text; debt-zero mandate; Out-of-Scope (no proxy substitutes).
- `.planning/ROADMAP.md` § Phase 18 — goal + 3 success criteria.
- `.planning/STATE.md` lines 68–90 — locked v1.4 operator decisions + Deferred Items table mapping each carry-forward to TEST-17/18/19.

### Test harness code (the actual repair targets)
- `e2e/integration/create-poll-results-hidden.test.ts` — TEST-19 target; the deferral is a comment block at end of file (post-RPC UPDATE failure path; references `create-poll/index.ts:158`).
- `supabase/functions/create-poll/index.ts` (~line 158) — the EF whose post-RPC UPDATE / compensating-DELETE behavior TEST-19 must exercise (`poll_created` vs `poll_created_orphaned` audit rows).
- `supabase/config.toml` — TEST-17 (edge_runtime pin) + TEST-18 (`[auth.email]` autoconfirm) live here; existing ES256/`--no-verify-jwt` commentary at lines ~24–30 explains the local-vs-prod auth-path alignment.
- `vitest.config.integration.ts` — config behind `npm run test:integration` (TEST-17 green target).
- `.github/workflows/deploy-edge-functions.yml` (~lines 35–37) — ES256 / verify_jwt context; informs the "green in CI" requirement.
- TEST-11 RLS matrix file — locate during research among `src/__tests__/admin/polls-effective-invariant.test.ts`, `e2e/integration/vote-counts-rls.test.ts`, `e2e/integration/toggle-results-visibility.test.ts` (the 12-cell invariant suite TEST-18 must make green).

### Stale — do NOT trust
- `.planning/codebase/TESTING.md` is dated 2026-04-06 and predates the entire test suite ("No testing framework installed"). Ignore it; read the live test files instead.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `create-poll-results-hidden.test.ts` already has `invokeEF`, `buildBody`, `readAuditLog`, and `adminClients` (authed + serviceRole) helpers — TEST-19 can build the fault-injection case on top of these rather than new scaffolding.
- The integration suite has an established pattern of authed + service-role client pairs; TEST-18's user-provisioning fix must produce sessions these clients can use.

### Established Patterns
- `config.toml` already aligns the local stack with prod's `--no-verify-jwt` so `test:integration` exercises the same auth path as prod — the ES256 fix (TEST-17) must preserve that alignment, not bypass it.
- Project convention is to pin/lock infrastructure versions deterministically (supports D-04 exact pin).

### Integration Points
- `npm run test:integration` → `vitest run --config vitest.config.integration.ts` — the green gate for TEST-17.
- CI must run the same green suite (TEST-17/18 require local **and** CI green).

</code_context>

<specifics>
## Specific Ideas

- The TEST-19 deferral comment itself documents the exact branches to cover: "the EF still emits the `poll_created` audit row (written BEFORE the UPDATE attempt — see `create-poll/index.ts:158`). If the compensating DELETE also fails, a `poll_created_orphaned` row is emitted alongside." Use this as the assertion spec.
- Root cause of the ES256 bug is recorded inline in `config.toml`: the local edge runtime falls back to HS256 verification on user tokens the auth service issued as ES256, returning 401 before the EF runs its own check.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (DBHY-05, UIDN-06, UAT-01/02, DEP-01/02 are already mapped to Phases 19–21 in ROADMAP.md; not Phase 18 concerns.)

</deferred>

---

*Phase: 18-test-environment-repair*
*Context gathered: 2026-05-31*
