---
phase: 19
reviewers: [codex, gemini, cursor]
reviewed_at: 2026-06-02T15:41:09Z
plans_reviewed: [19-01-PLAN.md, 19-02-PLAN.md, 19-03-PLAN.md]
self_skipped: claude
unavailable: [opencode, qwen]
coderabbit_skipped: "reviews working-tree diff, not planning artifacts — N/A for plan review"
cycle: 2
cycle_1_highs: 2
current_high: 0
---

# Cross-AI Plan Review — Phase 19: DB Migration + A11y Restore

> **Cycle 2 of convergence loop.** Plans were REPLANNED after cycle 1 to address two HIGH concerns:
> (1) weak RPC success-path proof, and (2) `update_profile_after_auth` trust-boundary residual.
> This cycle re-reviews the updated plans and adjudicates the disposition of both prior HIGHs.
>
> **Outcome: both cycle-1 HIGHs FULLY RESOLVED. Zero open HIGH concerns. All three reviewers approve for execution.**

## Codex Review (gpt-5.5)

## Summary

The updated plans are materially stronger. Cycle-1 HIGH #1 is fully closed: the ordered flip→confirm→RPC→read-back test makes the RPC success path meaningful and prevents a no-op false green. Cycle-1 HIGH #2 is also resolved as a Phase 19 planning HIGH: the plan now makes the RPC grant explicit, documents the trust boundary, and records the caller-supplied MFA/guild-state issue as an accepted residual with rationale. The residual is not technically fixed, but for DBHY-05's stated scope it no longer reads as an unexamined blocker.

## Strengths

- Correct root-cause fix: `current_user = session_user` is fully removed and replaced with a transaction-local GUC discriminator.
- Good pooling safety: `set_config(..., true)` is the right choice for PgBouncer/transaction pooling.
- Strong regression coverage for protected columns: `mfa_verified`, `is_admin`, and `guild_member` direct updates are all covered.
- The RPC proof is now valid: service-role flip to `false`, precondition read-back, RPC write to `true`, postcondition read-back.
- Explicit `REVOKE EXECUTE FROM PUBLIC` + `GRANT EXECUTE TO authenticated` is a real improvement over implicit PUBLIC execute.
- UIDN-06 plan is clean and idiomatic: `CardTitle asChild` via `Slot.Root` matches existing `Button`/`Badge` patterns.
- Plan 03 correctly separates local migration verification from production deploy tracking instead of pretending local push satisfies prod deploy.

## Concerns

- **MEDIUM:** The GUC-leak guard should be folded into the same `it()` as the RPC success proof. If implemented as a separate test after `beforeEach`, it may no longer prove "post-RPC same-client no leak" cleanly.
- **MEDIUM:** Several verification commands pipe through `grep`, `head`, or `tail`, which can mask failing exit codes without `pipefail`. This is especially risky for `npm run test:integration | tail -20` and lint checks.
- **MEDIUM:** Plan 03 still has wording drift between "`supabase db push`" and the safer local command `supabase migration up`. Since target confusion matters for DB migrations, align the plan language to one command.
- **MEDIUM:** The allowed-column sanity test only asserting `error === null` can false-green on a zero-row update. It should read back `discord_username` to prove the allowed update actually applied.
- **LOW:** The plan says unqualified `set_config` / `current_setting` would fail under `SET search_path = ''`; PostgreSQL still searches `pg_catalog` implicitly. The qualification is still good, but the rationale is overstated.
- **LOW:** `getByRole('heading', { level: 2 })` alone would also pass for ARIA role/level. The grep checks cover this, but adding `expect(heading.tagName).toBe('H2')` would make the unit assertion self-contained.

## Suggestions

- Put the post-RPC direct protected-column rejection at the end of the ordered RPC test case itself.
- Change shell verification to preserve failures, e.g. `set -o pipefail` or avoid piping test/lint commands.
- Rename Plan 03 references consistently to `supabase migration up` for local apply, or explicitly require `supabase db push --local` if that is the intended CLI path.
- Add grant verification after migration apply: `anon` cannot execute `update_profile_after_auth`; `authenticated` can.
- In the allowed-column test, read back `discord_username` via service role and assert it changed.
- Keep "no live users" rationale in planning/threat-model docs, not necessarily in the database `COMMENT`, which can become stale.

## Risk Assessment

Overall risk: **MEDIUM-low**.

The core DBHY-05 implementation approach is sound, and the two prior HIGHs are no longer open HIGHs in the current plan. Remaining risk is mostly execution hygiene: making sure verification commands cannot false-green, keeping local/prod migration targets unambiguous, and tightening a couple of tests so they prove what they claim.

---

## Gemini Review

# Phase 19 Plan Review — Cycle 2

The implementation plans for Phase 19 have been revised to address the high-priority concerns from Cycle 1. The focus is on hardening the database security gate (DBHY-05) and restoring semantic heading hierarchy (UIDN-06).

## Summary
The revised plans are high-quality, surgical, and robust. They successfully address the gaps in test validity and trust-boundary documentation identified in the previous cycle. The database migration correctly implements a transaction-local GUC mechanism that is both PgBouncer-safe and resilient to `search_path` hardening. The integration test suite is now significantly more rigorous, providing empirical proof of the security fix. The UI changes follow established polymorphic patterns (`asChild`) to restore accessibility without visual regression.

## Strengths
- **Rigorous RPC Proof:** The integration test now uses an "ordered flip-then-call" assertion. By explicitly forcing the protected columns to a different state via `serviceRole` before the RPC call, the test proves that the RPC actually commits the new values, rather than just returning a no-op success.
- **Trust Boundary Hardening:** The migration now includes an explicit `REVOKE EXECUTE FROM PUBLIC` and `GRANT EXECUTE TO authenticated` for the `update_profile_after_auth` RPC. This, combined with the new `COMMENT ON FUNCTION`, makes the trust boundary auditable and documented.
- **GUC Security:** The use of `is_local = true` (transaction-local) and `pg_catalog` qualification for built-ins (`current_setting`, `set_config`) demonstrates a deep understanding of Postgres security in a hardened `search_path = ''` environment.
- **Leak Protection:** The inclusion of a post-RPC direct update attempt in the same test suite provides a critical guard against GUC leakage across pooled connections.
- **Semantic UI Refactor:** The `asChild` implementation in `CardTitle` uses the existing `Slot.Root` pattern from `Button`/`Badge`, ensuring consistency and providing a clean path to restore `<h2>` semantics.

## Concerns
- **None (High/Medium).** The plans are well-aligned with requirements and previous feedback.
- **LOW: Test Failure Expectation:** The plan correctly notes that `npm run test:integration` will be RED until the push in 19-03. This is a standard part of the Wave structure, but requires the operator to ignore the initial failure during the "Act" phase of Wave 1.

## Suggestions
- **Migration Metadata:** When creating `00000000000015_trusted_profile_update_guc.sql`, ensure the timestamp/numbering follows the exact sequential order of your local migrations folder if there are any un-pushed intermediate files.
- **Test Output:** During `19-03`, pay close attention to the regex match in the rejection assertions to ensure the `RAISE EXCEPTION` messages in the trigger match the `toMatch` patterns in the test.

## Cycle 1 Follow-up

### 1. Weak RPC success-path proof
**Status: FULLY RESOLVED.**
Plan 19-01 Task 2 now implements a three-step proof (flip to known-different state → call RPC → verify change). This eliminates the risk of a "false positive" success where the RPC returns 200 but the trigger silently blocked the write.

### 2. update_profile_after_auth trust-boundary residual
**Status: FULLY RESOLVED.**
The plan now treats the RPC as a hardened, single-writer gateway. It revokes public access, grants authenticated access, adds a `COMMENT ON FUNCTION` documenting that the RPC trusts client-supplied flags, and updates the threat model (T-19-07) to explicitly accept this residual risk for v1.4. This satisfies the mandate to document and harden the trust boundary without expanding scope to a full server-side Discord re-validation refactor.

## Risk Assessment: LOW
The plan is highly surgical and follows established project patterns. The regression tests are comprehensive, covering both the fix validity and potential side effects like GUC leakage.

**Verdict: Approved. Proceed to Execution.**

---

## Cursor Review

# Cross-AI Plan Review — Phase 19 (Cycle 2)

## 1. Summary

The replanned Phase 19 set is **substantially stronger** than cycle 1 and is **ready to execute** with only minor clarifications. **19-01** correctly targets the real bypass (the `current_user = session_user` check is always false inside `SECURITY DEFINER`; see migration 14) and pairs Migration 15 with a regression suite that would have caught today's live behavior. The **ordered RPC proof** (service-role flip → precondition read → RPC → post read-back) plus the **post-RPC GUC-leak guard** fully addresses cycle 1's weak success-path concern. The **trust-boundary residual** on caller-supplied `p_mfa_verified` / `p_guild_member` is no longer an unmitigated HIGH for this phase: it is explicitly granted, commented, threat-modeled as **T-19-07 (accepted)**, and scoped out of DBHY-05 with sound rationale (pre-existing OAuth design, no live users). **19-02** is tight and aligned with existing `Slot.Root` patterns. **19-03** correctly separates local closure from prod deploy and fixes the local-push / linked-lint mismatch from cycle 1.

## 2. Strengths

- **Accurate severity model:** Plans and threat register treat the protected-column branch as **actively bypassed**, not "suspected dead code," matching migration 14 behavior and RLS (`00000000000001_rls.sql` allows authenticated self-UPDATE on all columns; protection is trigger-only).
- **Cycle-1 HIGH #1 closure is sound:** Case (e) cannot pass on a no-op: baseline `memberUser` is `mfa_verified: true`, `guild_member: true`; the test forces `false`, confirms, RPC to `true`, read-back. Case (f) validates transaction-local GUC scope across requests.
- **Implementation discipline:** `pg_catalog` qualification under `SET search_path = ''`, `IS DISTINCT FROM 'on'` (matches `e2e/fixtures/seed.sql:30`), `CREATE OR REPLACE` only, `set_config(..., true)` for transaction locality — all aligned with D-01–D-04 and migration 14 patterns.
- **Grant hardening:** `REVOKE EXECUTE FROM PUBLIC` + `GRANT … TO authenticated` makes the RPC boundary auditable (T-19-06); matches how production actually calls it (`auth-helpers.ts` via authenticated session).
- **Test harness fit:** Reuses `mintClients` / `vote-counts-rls.test.ts` precedent; `vitest.config.integration.ts` already includes `e2e/integration/**/*.test.ts`; `fileParallelism: false` helps `afterAll` cleanup vs sibling suites.
- **Service-role setup is viable:** Trigger is `WHEN (current_setting('role') = 'authenticated')` (`00000000000002_triggers.sql:41–45`), so service-role fixture resets do **not** fire `profile_self_update_allowed` — the ordered RPC test's step-1 flip is valid post-migration.
- **19-02 minimalism:** Polymorphic `CardTitle` mirrors `button.tsx` / `badge.tsx`; call-site change is small; existing `getByRole('heading', { level: 2 })` assertions become true semantic tests after removing ARIA shims.
- **19-03 closure hygiene:** Local apply + local lint + integration green + smoke; prod `--linked` explicitly deferred; separate verification rows for SC2 halves.

## 3. Concerns

| Severity | Concern | Cycle-1 HIGH status |
|----------|---------|---------------------|
| **—** | **#1 Weak RPC success-path proof** | **FULLY RESOLVED** — flip→precondition→RPC→read-back + GUC-leak guard; structural `node -e` checks encode the ordering. |
| **—** | **#2 `update_profile_after_auth` trust boundary** | **FULLY RESOLVED for Phase 19 scope** — not an open plan HIGH. Documented residual (T-19-07), COMMENT, explicit EXECUTE grant, honest deferral of server-side Discord re-validation. Remains a **product/security backlog item** before real users, not a blocker to ship DBHY-05. |
| **MEDIUM** | **19-01 cleanup rationale is slightly imprecise:** It says service-role succeeds because "the GUC-gated protected-column branch only enforces against the authenticated direct-client path." More precisely, the trigger **does not run at all** for `service_role` due to `WHEN (current_setting('role') = 'authenticated')`. Executors who misunderstand this may debug failed flips incorrectly. | N/A |
| **MEDIUM** | **No integration assertion that `anon` cannot call `update_profile_after_auth` after REVOKE** — grant change is migration-only verified by grep; a one-line `clients.anon.rpc(...)` expect-error would lock T-19-06 at runtime. | Partial hardening proof only |
| **MEDIUM** | **`.planning/STATE.md` still claims protected branch is "likely dead code" / RLS blocks direct UPDATE** — contradicts `19-CONTEXT.md` and live schema. Plans don't include a STATE.md touch-up; risks future planners reintroducing wrong assumptions. | N/A |
| **LOW** | **Threat ID collision:** 19-01 uses T-19-06/07 for EXECUTE grant and caller-trust residual; 19-02 reuses T-19-06/07 for CardTitle/ARIA. Cross-plan traceability is muddy. | N/A |
| **LOW** | **19-03 Task 2 verify:** `grep … \|\| echo "LINT CLEAN"` exits 0 when WARN lines exist (grep success). Human acceptance criteria still require zero WARNs — automate with `! grep -q WARN` or parse `supabase db lint` exit code. | N/A |
| **LOW** | **`src/lib/auth-helpers.ts` comment** ("sets mfa_verified server-side") overstates trust — values are client-derived before RPC. Plan documents this in SQL COMMENT but doesn't refresh the TS comment. | N/A |

**Do not re-raise:** SQL NULL bypass on custom GUCs — plan's `IS DISTINCT FROM` + `missing_ok=true` is appropriate defense-in-depth.

## 4. Suggestions

- **19-01 Task 2:** Add one sentence in the test file header (not the forbidden phrase): *"Fixture resets use `serviceRole` because `on_profile_self_update` has `WHEN (current_setting('role') = 'authenticated')`."* Cite `00000000000002_triggers.sql`.
- **19-01 Task 2 (optional):** `it('rejects anon RPC callers', …)` with `mintClients` anon client — cheap proof of REVOKE.
- **19-01 / phase close:** Update `.planning/STATE.md` DBHY-05 blurb to match CONTEXT severity (bypassed branch, not dead code; RLS does not column-restrict).
- **19-03 Task 2 verify:** Replace grep-or-echo with a failing check when WARN/ERROR lines appear, or rely on `supabase db lint` non-zero exit if available.
- **Milestone tracking (outside Phase 19):** Add a v1.4+ requirement or backlog row for "server-side Discord MFA/guild re-validation at RPC or Edge Function" so T-19-07 is not only in SQL COMMENT — especially given v1.4 **debt-zero** framing.
- **19-02:** After `asChild`, optionally assert `data-slot="card-title"` on the `<h2>` in one test — guards Slot merge regressions (not required for UIDN-06).

## 5. Risk Assessment

**Overall: LOW–MEDIUM**

| Area | Level | Justification |
|------|-------|----------------|
| **DB security fix (DBHY-05)** | **Low** once Migration 15 is applied | GUC design matches decisions; regression matrix covers both gate directions, no-op RPC false positives, and cross-request GUC leakage. Trigger `WHEN` clause preserves service-role fixture ergonomics. |
| **Residual RPC spoofing (T-19-07)** | **Medium (accepted)** | Real architectural limit: any authenticated client can call `update_profile_after_auth` with arbitrary booleans. Mitigated for now by no users + documentation; **must** be revisited before meaningful production adoption. **Not** a Phase 19 plan failure. |
| **UIDN-06 (19-02)** | **Low** | Established Radix pattern; tests already assert heading role/level. |
| **Deploy / verify (19-03)** | **Low–Medium** | Human checkpoints and env export are appropriate; prod deferral is explicit. Weak automated lint grep is a process risk, not a security risk. |

**Phase goal attainment:** Plans satisfy ROADMAP SC1 (reachable branch + regression proof), SC3 (semantic `<h2>`), and SC2 **local half** (lint + smoke). SC2 prod half is correctly deferred with tracking rows — no false closure from local-only push.

## Cycle-1 HIGH Verdicts (explicit)

1. **Weak RPC success-path proof** → **FULLY RESOLVED** in current 19-01 Task 2 / must_haves / 19-03 Task 3 failure modes.
2. **`update_profile_after_auth` trust-boundary residual** → **FULLY RESOLVED as an accepted, documented Phase 19 disposition** (not an unresolved HIGH against these plans). Treat as **open MEDIUM project risk** until server-side Discord re-validation ships; do **not** block Phase 19 execution on it given stated scope and "no live users."

**Recommendation:** Approve plans for execution; apply the MEDIUM suggestions (trigger `WHEN` comment, optional anon-RPC test, STATE.md alignment) during Wave 1 if cheap, otherwise at phase verify.

---

## Consensus Summary

All three reviewers (Codex gpt-5.5, Gemini, Cursor) independently approve the cycle-2 plans for execution and agree that **both cycle-1 HIGH concerns are FULLY RESOLVED**. No reviewer raised any new HIGH concern. Overall risk lands LOW to MEDIUM-low.

### Cycle-1 HIGH Disposition

- **HIGH #1 — Weak RPC success-path proof:** **FULLY RESOLVED** (3/3 reviewers). The rewritten 19-01 Task 2 flips protected columns to a known-different state via service-role first, confirms the flip (precondition read-back), calls the RPC, then reads back and asserts the change applied — making a no-op silent block impossible to false-green. The post-RPC GUC-leak guard adds cross-request scope validation.
- **HIGH #2 — `update_profile_after_auth` trust-boundary residual:** **FULLY RESOLVED for Phase 19 scope** (3/3 reviewers). `REVOKE EXECUTE FROM PUBLIC` + `GRANT EXECUTE TO authenticated`, the `COMMENT ON FUNCTION` documenting the trust boundary, and threat entries T-19-06 (explicit grant) / T-19-07 (accepted documented residual) together close this as a Phase 19 planning HIGH. Codex and Cursor note the underlying caller-supplied-flag trust remains an **accepted MEDIUM project risk** (server-side Discord re-validation deferred as a larger auth refactor, justified by no live users) — explicitly NOT a blocker for DBHY-05.

**current_high = 0**

### Agreed Strengths (2+ reviewers)

- Ordered flip→confirm→RPC→read-back test is a rigorous, valid RPC success proof (all 3).
- `REVOKE … FROM PUBLIC` + `GRANT … TO authenticated` makes the trust boundary explicit and auditable (all 3).
- Transaction-local GUC (`set_config(..., true)`) is the correct PgBouncer/pooling-safe choice (all 3).
- `pg_catalog` qualification of built-ins under `search_path = ''` shows correct hardening discipline (all 3).
- Post-RPC GUC-leak guard protects against cross-connection GUC bleed (all 3).
- 19-02 `CardTitle asChild` via `Slot.Root` is idiomatic and matches existing `Button`/`Badge` patterns (all 3).
- 19-03 correctly separates local migration verification from production deploy (Codex, Cursor).

### Agreed Concerns (2+ reviewers) — all MEDIUM or below, none HIGH

- **MEDIUM — Allowed-column sanity test can false-green on a zero-row update:** assert a read-back of `discord_username` rather than only `error === null` (Codex; Cursor via stronger runtime proofs).
- **MEDIUM — No runtime assertion that `anon` cannot call the RPC after REVOKE:** add a one-line `clients.anon.rpc(...)` expect-error to lock T-19-06 at runtime (Codex grant-verification suggestion; Cursor explicit).
- **MEDIUM — Verification-command false-green risk:** piping through `grep`/`head`/`tail` and `grep || echo "LINT CLEAN"` can mask failing exit codes; use `set -o pipefail` or `! grep -q WARN` (Codex, Cursor).
- **LOW — Overstated `search_path=''` rationale:** `pg_catalog` is still searched implicitly; qualification is good practice but the "would fail" justification is too strong (Codex, Cursor).
- **LOW — Heading assertion could be self-contained:** add `expect(heading.tagName).toBe('H2')` / `data-slot` assertion (Codex, Cursor).

### Divergent Views

- **Migration target wording (`supabase db push` vs `supabase migration up` / `--local`):** Codex flags wording drift as MEDIUM and wants one canonical local command; Gemini and Cursor did not raise it (Cursor notes 19-03 already fixed the cycle-1 local-push/linked-lint mismatch). Worth a quick alignment pass during execution.
- **STATE.md staleness:** Cursor uniquely flags that `.planning/STATE.md` still calls the protected branch "likely dead code," contradicting CONTEXT/live schema, and recommends a touch-up. Not raised by Codex/Gemini.
- **Overall risk rating:** Gemini rates LOW; Codex MEDIUM-low; Cursor LOW–MEDIUM. Convergent in substance (execution-hygiene risk only), minor wording difference.
