---
phase: 18
reviewers: [gemini, codex, cursor]
reviewed_at: 2026-06-01T05:20:00Z
review_cycle: 3
plans_reviewed: [18-01-PLAN.md, 18-02-PLAN.md, 18-03-PLAN.md]
prior_cycle_highs: 1
prior_cycle_highs_resolved: 1
current_cycle_highs_unresolved: 0
---

# Cross-AI Plan Review — Phase 18: Test-Environment Repair

> **Cycle 3 (re-review).** The plans were revised after cycle 2 to resolve the one remaining HIGH
> (H-NEW-1: branch (a) poll-ID resolution made audit-only; `polls` lookup forbidden for id resolution).
> Three external reviewers (Gemini, Codex, Cursor) independently re-reviewed the revised plans.
> Claude (self) was skipped for independence. Load-bearing factual claims were verified against the
> live repo before synthesis.

---

# CYCLE 3 — Re-review of revised plans (2026-06-01)

## Prior-HIGH disposition (consensus: H-NEW-1 FULLY RESOLVED)

| Prior HIGH | Gemini | Codex | Cursor | Synthesis |
|---|---|---|---|---|
| **H-NEW-1** — Branch (a) `actualPollId` resolution ambiguity (`polls` lookup vs audit row) | RESOLVED | RESOLVED | RESOLVED | **FULLY RESOLVED (plan-level).** The cycle-2 ambiguous "or" fallback at old PLAN line 212 is GONE. 18-03 Task 3 now mandates **AUDIT-ONLY** resolution for BOTH branches — `audit_log` filtered on `action='poll_created'` AND `after->>'title'=faultTitle` AND `actor_id` AND `created_at>=startedAt`, with `actualPollId = matchedRow.target_id`. Branch (a) **explicitly forbids** any `from('polls').select()...eq('title', ...)` for id resolution (the poll is absent after the compensating DELETE); `polls` is consulted in branch (a) ONLY to assert absence (`maybeSingle()` null). A grep-checkable acceptance criterion enforces this (PLAN line 232). |

**Live-repo verification of the load-bearing premise (verified by synthesizer, independently re-confirmed by Cursor):**
- `supabase/functions/create-poll/index.ts` `poll_created` audit row sets `target_id = pollId` AND `after = { title, category_id, results_hidden: false }` (lines 161–168). So `after->>'title'` carries the title correlator and `target_id` IS the poll id — branch (a) needs **no** `polls` lookup even though the poll row is gone.
- `poll_created_orphaned` row carries `after = { results_hidden_intended: true, results_hidden_actual: false, reason: 'compensation_delete_failed' }` (lines 189–198) — exactly branch (b)'s assertion.
- `audit_log.after` is `JSONB` (migration `00000000000010_results_hidden_audit.sql:54`), so the `after->>'title'` operator filter is valid SQL.
- `cron-sweep.yml` has NO `setup-cli` step and NO CLI version pin — the cycle-2 Gemini "5th pin" claim (HIGH-4) remains a confirmed **false positive**; there is no 5th pin to align.

H-NEW-1 is **FULLY RESOLVED at the plan level** — the fix is concrete, grep-verifiable, and backed by the verified live EF audit contract. (Repo files are not yet patched — these are plans; the 18-03 Task 4 gate re-verifies after execution.)

---

## Gemini Review (cycle 3)

**Verdict:** Ready for execution. Overall risk LOW.

- **H-NEW-1: RESOLVED.** Cited 18-03 Task 3 Action Step 6 ("AUDIT-ONLY … DO NOT resolve `actualPollId` via a `polls` lookup … `polls` consulted in branch (a) ONLY to assert absence") and the matching acceptance criterion.
- **No new HIGH.** Serialization (`fileParallelism: false`), fail-closed guard (`\set ON_ERROR_STOP on` + CI `-v ON_ERROR_STOP=1`), and convergent schema (`DROP TABLE IF EXISTS` before `CREATE TABLE`) are all present and correct.
- LOW: `afterEach` uses `.delete().neq('fault_title','')` as a global clear — safe under serialization; a title-prefix filter would be marginally more defensive but is not required for correctness.
- Risk: LOW.

## Codex Review (cycle 3)

**Verdict:** Prior HIGH closed; no new HIGH. Overall risk LOW.

- **H-NEW-1: RESOLVED.** Confirmed the plan states `poll_created` carries `target_id=pollId` and `after={title,…}`, branch (a) resolves audit-only on `after->>'title'=T_a` + actor + `created_at>=startedAt`, and the action section explicitly says "DO NOT resolve `actualPollId` via a `polls` lookup." Directly addresses the prior null-after-DELETE failure mode.
- **No new HIGH found.** Concurrency, cleanup, seed fail-closed, version-pin, and audit-row resolution risks all have explicit implementation + verification steps.
- MEDIUM: the executor must use a valid PostgREST/Supabase filter form for `after->>'title'`; the plan is conceptually correct but the acceptance criteria must catch a malformed filter.
- LOW: 18-01 still uses bare `supabase stop && supabase start` while 18-02/18-03 standardize on `npm exec supabase --`; not a blocker because later waves re-establish pinned parity before the gate.
- LOW: `.delete().neq('fault_title','')` is fine given non-empty `NOT NULL` titles.
- Risk: LOW (residual risk is execution correctness, not plan design).

## Cursor Review (cycle 3)

**Verdict:** Proceed with execution; no plan revision required for H-NEW-1. Plan-design risk LOW, execution risk MEDIUM.

- **H-NEW-1: RESOLVED.** Independently re-read `create-poll/index.ts` lines 161–168 and confirmed `target_id` is the poll id and `after.title` is the correlator — no `polls` lookup required. Confirmed the cycle-2 ambiguous "or" at old line 212 is gone; branch (a) forbids the `polls` id lookup, branch (b) uses the same audit-only path "for symmetry," and a grep acceptance rule enforces it.
- **No new HIGH.** Reviewed candidate concerns (stale 18-PATTERNS.md wildcard snippet, unspecified PostgREST JSONB filter form, `actor_id` acquisition, inter-wave PR split) and rated each MEDIUM/LOW — none a verifiable threat to phase goals given current plan text + grep acceptance rules.
- MEDIUM: `18-PATTERNS.md`/`18-RESEARCH.md` still document the obsolete `poll_id` wildcard sentinel + "newest `poll_created`" lookup (copy-paste trap); 18-03 mitigates with "ADAPT, do not copy" but the docs remain.
- MEDIUM: the supabase-js/PostgREST filter form for `after->>'title'` isn't spelled out (e.g. `.filter('after->>title','eq',faultTitle)`); failure mode is loud (no match), not false-green.
- MEDIUM: CI confirmation remains manual (acceptable per VALIDATION.md); inter-wave file-ownership split if waves ship as separate PRs.
- LOW: 18-01 restart command inconsistency; branch (a) `cleanupPoll` on already-deleted poll is harmless.
- Risk: plan-design LOW, execution MEDIUM.

---

## Consensus Summary (cycle 3)

**All three reviewers independently agree H-NEW-1 is FULLY RESOLVED and there are ZERO new HIGH concerns.** The revised 18-03 plan removes the cycle-2 ambiguous `polls`-or-audit fallback and mandates audit-only `actualPollId` resolution for both branches, with a grep-enforced acceptance criterion forbidding the `polls` id lookup in branch (a). The synthesizer verified — and Cursor independently re-confirmed — the load-bearing premise against the live `create-poll` EF: the `poll_created` audit row carries both `target_id` (the poll id) and `after.title` (the correlator), so branch (a) genuinely never needs a `polls` lookup, and `audit_log.after` is JSONB so the filter is valid.

### Agreed Strengths
- H-NEW-1 fix is concrete and grep-verifiable; the audit-only premise is backed by the live EF audit contract — all three reviewers.
- All prior-cycle HIGH mitigations (CLI four-pin alignment + `npm exec` parity, `fileParallelism: false` serialization, title-scoped fault rows, `try/finally` + unconditional `afterEach` clear, `ON_ERROR_STOP` fail-closed guard, convergent `DROP TABLE IF EXISTS` re-seed) remain present with matching acceptance criteria + a Task 4 gate — all three.
- Production safety intact: fault DDL lives only in `seed.sql`, never a migration (`grep` confirms 0 matches in `supabase/migrations/`) — all three.

### Agreed / Highest-Priority Concerns

**HIGH (unresolved): NONE.** No reviewer raised a new HIGH; all three rated plan-design risk LOW.

**MEDIUM (raised by 2+ reviewers):**
- The supabase-js/PostgREST filter form for the `after->>'title'` JSONB lookup is not spelled out in 18-03 Task 3 (Codex, Cursor). Conceptually correct and JSONB-valid; failure mode is a loud no-match, not a false-green. A one-line query-shape snippet in Task 3 would de-risk execution.
- Stale `18-PATTERNS.md` / `18-RESEARCH.md` wildcard + "newest `poll_created`" snippets are a copy-paste trap during Task 3 (Cursor; Gemini-adjacent). 18-03's "ADAPT, do not copy" + grep acceptance (no wildcard / no unfiltered "newest") mitigate it, but the docs remain obsolete.
- Inter-wave file-ownership / CI fail-open window if 18-02 and 18-03 ship as separate PRs — ship 18-01–03 on one phase branch (Cursor).

**LOW:**
- 18-01 uses bare `supabase stop && supabase start` while later waves standardize on `npm exec supabase --` (Codex, Cursor) — re-established before the gate, harmless in wave 1.
- `afterEach` global `.delete().neq('fault_title','')` clear is safe given serialization + `NOT NULL` titles (Gemini, Codex).

### Divergent Views
- **New-HIGH count:** Gemini = 0, Codex = 0, Cursor = 0. **Unanimous.**
- **Overall risk:** Gemini LOW, Codex LOW, Cursor LOW (plan-design) / MEDIUM (execution). The only divergence is whether to surface residual execution-correctness risk as a separate layer — all three agree plan-design risk is LOW and no revision is required.

### Cycle-3 verdict
The one cycle-2 HIGH (**H-NEW-1**) is **FULLY RESOLVED** in the revised plans (1 of 1 closed). **No new HIGH concerns.** All three reviewers recommend proceeding to execution with no further plan revision required; the remaining items are MEDIUM/LOW execution-ergonomics hardening (optional). The 18-03 Task 4 gate re-verifies every mitigation against the live codebase post-execution.

### Recommended Next Step
No plan revision required. Proceed to execution under the debt-zero mandate:

```
/gsd:execute-phase 18
```

Optional (non-blocking) hardening before/during execution: add a one-line PostgREST `after->>'title'` filter-shape snippet to 18-03 Task 3, and mark the wildcard/"newest" block in `18-PATTERNS.md` as obsolete to remove the copy-paste trap.

---

# CYCLE 2 — Re-review of revised plans (2026-06-01)

> **Cycle 2 (re-review).** The plans were revised after cycle 1 to address three HIGH concerns
> (CLI version skew across all four pins; global fault state vs Vitest parallelism;
> fail-safe/fail-closed fault state + seed guard). Three external reviewers (Gemini, Codex, Cursor)
> independently re-reviewed the revised plans. Claude (self) was skipped for independence.
> Load-bearing factual claims were verified against the live repo before synthesis.

## Prior-HIGH disposition (consensus: all three RESOLVED in revised plan text)

| Prior HIGH | Gemini | Codex | Cursor | Synthesis |
|---|---|---|---|---|
| **HIGH-1** — Local/CI CLI version skew (4 divergent pins) | RESOLVED | RESOLVED | RESOLVED | **FULLY RESOLVED (plan-level).** 18-02 resolves ONE stable `RESOLVED_VER` and applies it byte-identically to all four pins (`ci.yml` ×2, `deploy-edge-functions.yml`, `package.json`/lockfile), forbids stale `2.92.1`/`2.98.2`, rejects prereleases, and adds an `npx supabase --version` parity check + edge-runtime ≥ v1.74.0 evidence requirement before trusting local green. |
| **HIGH-2** — Global fault state vs Vitest file parallelism | RESOLVED | RESOLVED | RESOLVED | **FULLY RESOLVED (plan-level).** 18-03 Task 2 adds `fileParallelism: false` to `vitest.config.integration.ts` AND 18-03 Task 1/3 replace the global wildcard sentinel + "newest `poll_created`" lookup with per-test **title-scoped** fault rows + title/actor/time-scoped audit lookup (defense-in-depth). |
| **HIGH-3** — Fault not fail-safe + seed guard not fail-closed under `psql` | RESOLVED | RESOLVED | RESOLVED | **FULLY RESOLVED (plan-level).** 18-03 adds `try/finally` disarm + unconditional `afterEach` clear of `test_fault_config` (first statement, before poll cleanup), `\set ON_ERROR_STOP on` at the top of `seed.sql`, `-v ON_ERROR_STOP=1` on both CI `psql` steps (lines ~107 & ~207), and `TRUNCATE test_fault_config` on re-seed. |

All three cycle-1 HIGHs are **FULLY RESOLVED at the plan level** — concrete, grep-verifiable mitigations now exist in the revised plan text, with explicit acceptance criteria the executor must meet. (Repo files are not yet patched — these are plans, not landed code — but plan-design closure is what this review gate measures; the gate task in 18-03 re-verifies after execution.)

---

## Gemini Review (cycle 2)

**Verdict:** APPROVED WITH CAVEATS.

- HIGH-1/2/3: all RESOLVED (four-pin alignment + parity check; serialization + title-scoping; `try/finally` + `ON_ERROR_STOP` belt-and-suspenders).
- **Raised HIGH-4 (REFUTED on verification):** claimed `.github/workflows/cron-sweep.yml` is a 5th divergent CLI pin omitted from 18-02's alignment, citing the `ci.yml:127` comment that references `cron-sweep.yml`. **Verified against the live repo: FALSE POSITIVE.** `cron-sweep.yml` contains NO `supabase/setup-cli` step and pins NO CLI version — it only `curl`s the `close-expired-polls` EF endpoint with repo secrets. There is no 5th pin to align; the `ci.yml:127` comment is stale historical prose, not an actual pin. HIGH-4 is **not a real concern** and does not count.
- MEDIUM-1: redundant stack restarts across waves 1→2 (latency, not correctness).
- LOW-1: branch (a) audit title resolution could be brittle if the `after` JSONB payload format changes.
- Risk: LOW.

## Codex Review (cycle 2)

**Verdict:** Prior HIGHs RESOLVED; **no new HIGH found.** Execution risk MEDIUM until two sharp edges are tightened.

- HIGH-1/2/3: RESOLVED (single version contract across local+CI+deploy; serialization + title scoping; in-file `ON_ERROR_STOP` + CI flag).
- MEDIUM: 18-02 uses prose `supabase stop && supabase start`; a global Supabase CLI earlier in `PATH` could start the stack with the wrong binary while `npx supabase --version` only proves the npm binary. Use `npm exec supabase -- ...` consistently.
- MEDIUM: 18-03 audit lookup leaves a fallback that could degrade to actor/time-only; the repo's `poll_created.after` DOES carry `title`, so the plan should *require* `after->>'title' = faultTitle` rather than leave fallback ambiguity. (Same root issue Cursor flags as H-NEW-1.)
- MEDIUM: `CREATE TABLE IF NOT EXISTS test_fault_config` is idempotent for clean state but NOT convergent from a partial old wildcard `(poll_id, fail_operation)` table — a stale local table of the wrong shape would survive and break the revised trigger. Add `DROP TABLE IF EXISTS` / schema-convergence before `CREATE TABLE`.
- LOW: `created_at >= startedAt` clock-skew brittleness; `.neq('fault_title','')` vs `.not('fault_title','is',null)`.
- Risk: LOW–MEDIUM. **No new HIGH.**

## Cursor Review (cycle 2)

**Verdict:** Cycle-1 HIGH-1/2/3 RESOLVED in revised plan text. **Recommend approve after one small 18-03 Task 3 clarification.** Flags one NEW HIGH (execution-risk) + one conditional HIGH.

- **H-NEW-1 (HIGH, execution-risk) — Branch (a) poll-ID resolution is ambiguous.** 18-03 Task 3 step 6 offers a fallback to resolve `actualPollId` "by selecting from `polls` where `title = faultTitle` (branch b) **or** from the `poll_created` audit row." But branch (a) requires the poll to be **absent** after the compensating DELETE — an executor following the `polls` fallback literally for branch (a) gets null and either fails or picks the wrong row → false-green or flake. Fix is a one-line clarification: **mandate audit-only resolution for branch (a)** (filter `audit_log` on `action='poll_created'`, `after->>'title'`, `actor_id`, `created_at >= startedAt`) and forbid the `polls` lookup when asserting absence. **VERIFIED** against 18-03-PLAN.md line 212 — the ambiguous "or" fallback clause is present.
- **H-NEW-2 (conditional) — TEST-17 "gateway ES256 verified" vs perpetual `verify_jwt = false`.** Plans keep all nine `verify_jwt = false` entries and require recording edge-runtime ≥ v1.74.0, but no step re-runs a single integration call with gateway JWT verification ON to prove the ES256 fix at the gateway. Cursor explicitly: *"Tag as HIGH only if your bar is 'prove ES256 at gateway'; otherwise MEDIUM."* Under the project's locked definition (prod uses `--no-verify-jwt`, EFs self-validate; TEST-17 = pinned runtime + aligned prod auth path), this is **MEDIUM**, not HIGH.
- MEDIUM: `18-PATTERNS.md` still documents the wildcard/newest lookup (copy-paste risk); inter-wave CI fail-open window if waves ship as separate PRs; manual CI confirmation dependency; trigger surface on `polls` for all roles (mitigated by serialization + title uniqueness + cleanup ordering).
- Risk: plan-design vs cycle-1 HIGHs LOW (once executed); execution/executor-misread MEDIUM–HIGH (H-NEW-1); overall MEDIUM.

---

## Consensus Summary (cycle 2)

**All three reviewers agree the three cycle-1 HIGH concerns are RESOLVED in the revised plans.** The disagreement is only on whether any NEW HIGH exists:

- **Gemini** raised HIGH-4 (`cron-sweep.yml` 5th pin) → **REFUTED on live-repo verification** (no `setup-cli`, no CLI pin in that file). Does not count.
- **Codex** found **no new HIGH** (rates execution risk MEDIUM).
- **Cursor** raised **H-NEW-1** (branch (a) poll-ID resolution ambiguity) as an execution-risk HIGH, and **H-NEW-2** (TEST-17 gateway-vs-runtime evidence) as HIGH-only-if-the-bar-is-gateway-proof (otherwise MEDIUM → MEDIUM under this project's locked TEST-17 definition).

### Agreed Strengths
- Three cycle-1 HIGHs each have concrete, grep-verifiable mitigations in the revised plan text — all three reviewers.
- HIGH-1 fix is complete on paper: the fourth pin (`package.json`) was the missing piece; deploy workflow included; prerelease rejection + edge-runtime evidence required beyond "suite went green" — Gemini + Codex + Cursor.
- HIGH-2 dual mitigation (serialization + title-scoped triggers/audit) is correct given `poll_created.after` already carries `title` — all three.
- HIGH-3 belt-and-suspenders (in-file `\set ON_ERROR_STOP on` + CI `-v ON_ERROR_STOP=1`) + `TRUNCATE` on re-seed clears crashed-run sentinels — all three.
- File-ownership discipline (18-02 does not touch the `psql` lines; 18-03 owns `ON_ERROR_STOP`) and explicit "ADAPT, don't copy the wildcard from 18-PATTERNS" reduce regression risk — Cursor.

### Agreed / Highest-Priority Concerns

**HIGH (unresolved, counts) — H-NEW-1: Branch (a) poll-ID resolution ambiguity (Cursor HIGH; Codex same root issue at MEDIUM). VERIFIED.**
18-03 Task 3 step 6 (PLAN line 212) lets the executor resolve `actualPollId` "by selecting from `polls` where `title = faultTitle` (branch b) **or** from the `poll_created` audit row filtered by actor + `created_at >= startedAt`." For **branch (a)** the poll is intentionally **absent** (compensating DELETE succeeded), so a `polls` lookup returns null and can produce a false-green or a wrong-row assertion. Two of three reviewers independently flagged the audit-lookup fallback as under-specified. **Fix (one-line clarification):** mandate audit-only resolution for branch (a) — `audit_log` filtered on `action='poll_created'`, `after->>'title' = faultTitle`, `actor_id`, `created_at >= startedAt` — and forbid the `polls` lookup when asserting poll absence. Mitigation is NOT yet landed in the plan → this HIGH is **unresolved** this cycle.

**MEDIUM (raised by 2+ reviewers):**
- `npm exec supabase -- ...` vs bare `supabase ...` — a global CLI earlier in `PATH` could start the stack on the wrong binary while the parity check only proves the npm binary (Codex; Cursor-adjacent). Tighten 18-02 to use `npm exec supabase --` for stop/start/version.
- `test_fault_config` DDL is idempotent but not convergent from a partial OLD wildcard `(poll_id, …)` table; add `DROP TABLE IF EXISTS` / schema convergence (Codex).
- Stale `18-PATTERNS.md` wildcard/newest documentation is a copy-paste trap during Task 3 (Cursor); 18-03 mitigates with "ADAPT, don't copy" but the doc remains.
- Inter-wave CI fail-open window (seed without `ON_ERROR_STOP` between 18-02 and 18-03) if waves ship as separate PRs — ship 18-01–03 in one PR (Cursor).
- TEST-17 closure is "pinned runtime + prod-aligned auth path," not "ES256 proven at gateway" — acceptable under the locked TEST-17 definition; flag for milestone audit (Cursor H-NEW-2, downgraded to MEDIUM).

### Divergent Views
- **New-HIGH count:** Gemini = 1 (HIGH-4, refuted); Codex = 0; Cursor = 1 (H-NEW-1) + 1 conditional (H-NEW-2). After live verification: HIGH-4 is a false positive (no CLI pin in `cron-sweep.yml`); H-NEW-2 is MEDIUM under the project's TEST-17 definition. The one real, unresolved HIGH is **H-NEW-1**.
- **Overall risk:** Gemini LOW, Codex LOW–MEDIUM, Cursor MEDIUM — divergence driven by how much weight each puts on the branch (a) execution-trap; all three rate plan-design-vs-cycle-1-HIGHs as LOW once executed.

### Cycle-2 verdict
Cycle-1 HIGH-1, HIGH-2, HIGH-3 → **FULLY RESOLVED** in the revised plans (3 of 3 closed). **One new HIGH remains unresolved: H-NEW-1** (branch (a) audit-only poll-ID resolution — a one-line clarification in 18-03 Task 3). Gemini's HIGH-4 was refuted on verification; Cursor's H-NEW-2 is MEDIUM under the locked TEST-17 definition.

### Recommended Next Step
Feed this review back into planning and apply the H-NEW-1 one-line fix (plus the MEDIUM `npm exec` and `DROP TABLE IF EXISTS` hardening):

```
/gsd:plan-phase 18 --reviews
```

After the branch (a) clarification lands, the phase is clear to execute under the debt-zero mandate; the 18-03 Task 4 gate re-verifies all mitigations against the live codebase post-execution.

---

# CYCLE 1 — Initial review (archived below)

Three external reviewers (Gemini, Codex, Cursor) independently reviewed the three Phase 18 plans. Claude (self) was skipped for independence per the review workflow. Load-bearing factual claims were verified against the live repo before synthesis (see Consensus Summary).

## Gemini Review

# Implementation Plan Review: Phase 18 — Test-Environment Repair

## 1. Summary
This three-wave plan effectively addresses the Phase 18 requirements with a "real-repair" approach that eliminates long-standing test debt. The strategy correctly identifies the root causes: a buggy edge-runtime version in the Supabase CLI, a missing auth configuration section in `config.toml`, and a server-side execution path in the `create-poll` Edge Function that necessitates a DB-level fault injection. The plans are tightly coupled with the project's "debt-zero" mandate and utilize clever, idempotent SQL patterns (like the wildcard sentinel UUID) to solve timing and orchestration challenges between the test runner and the server-side Edge Functions.

## 2. Strengths
- **Deterministic Fixes:** Instead of bypassing issues with mocks or skips, the plans fix the environment at the source (CLI version and container config).
- **Wildcard Sentinel Pattern:** The use of `00000000-0000-0000-0000-000000000000` as a trigger sentinel in 18-03 elegantly solves the "ID-in-advance" problem for server-side fault injection.
- **Strict Ordering:** 18-01 correctly identifies the need for a full stack restart (`stop && start`) to apply GoTrue environment variables, and 18-03 correctly mandates disarming sentinels before `afterEach` cleanup to prevent test-induced leaks.
- **Production Safety:** 18-03 rigorously guards the fault-injection DDL behind the `app.e2e_seed_allowed` check, ensuring these triggers never reach the production database.
- **Infrastructure Alignment:** 18-02 ensures the CLI version is pinned consistently across all CI jobs (integration, E2E, and optionally deployment), maintaining parity between environments.

## 3. Concerns
- **CI Environment Restart (MEDIUM):** Plan 18-01 mentions `supabase stop && supabase start` to apply config. While necessary locally, in CI the stack is typically started fresh for each job. The executor must ensure that the `ci.yml` orchestration (which is modified in 18-02) doesn't result in the config being applied *after* the stack has already booted in CI.
- **CLI Version Stability (LOW):** Plan 18-02 relies on resolving the "latest stable" CLI version at execution time. While proactive, there is a minor risk that the latest version (>= v2.99.0) could introduce unrelated CLI regressions. However, given the local validation gate in 18-03 Task 3, this risk is mitigated.
- **Trigger Interference (LOW):** If multiple integration tests were to run in parallel, the wildcard sentinel in 18-03 could cause cross-test failures. The research correctly identifies that the suite runs sequentially, but this remains a "hidden" dependency on the test runner's configuration.

## 4. Suggestions
- **Explicit CLI Resolution (18-02):** The executor should explicitly verify that the resolved CLI version bundles `edge-runtime >= v1.74.0` by checking the release notes or Dockerfile template during the "Resolve" step, rather than just taking the latest version.
- **Consistency Sweep (18-02):** Make the "optional" update to `deploy-edge-functions.yml` mandatory. Pinned version drift between CI jobs is a common source of "works in integration, fails in E2E" bugs.
- **Logging Injection (18-03):** Consider adding a unique notice to the `RAISE EXCEPTION` message in the trigger (e.g., `[FAULT-INJECT]`) to make it immediately obvious in the Edge Function logs that the 500 error was intentional and not a genuine regression.

## 5. Risk Assessment
**Overall Risk: LOW**

The plans are technically sound and follow the established project patterns. The most complex part (fault injection) is isolated to the E2E/Integration environment and uses standard PostgreSQL triggers. The hard dependency on a CLI version bump is the only external variable, but it is justified by the requirement to fix a known upstream bug. The "debt-zero" mandate is fully satisfied as these plans transition the suite from "skipped/broken" to "green/repaired" without deferrals.

**Verdict:** Proceed with Wave 1 (Plan 18-01).

---

## Codex Review

**Overall**

The plans are directionally solid and mostly minimal, but I would not approve them as debt-zero yet. TEST-18 is low risk, TEST-17 needs tighter local/CI version control, and TEST-19 has real high-severity leak/interference risks unless the fault injection is made fail-safe and non-global. The biggest production-safety issue is that `e2e/fixtures/seed.sql` relies on a `RAISE EXCEPTION` guard, but `psql` continues after errors unless `ON_ERROR_STOP` is set, per PostgreSQL docs. That undermines the claimed fail-closed guarantee.

**PLAN 18-01**

**Summary** — Good narrow fix for TEST-18. Adding `[auth.email]` with `enable_signup = true` and `enable_confirmations = false` matches Supabase CLI config, and Supabase docs explicitly say config changes require `supabase stop` then `supabase start`.

**Strengths**
- Minimal file scope: only `supabase/config.toml`.
- Correctly preserves `[functions.*] verify_jwt = false`.
- Targets the actual GoTrue provider config instead of test workarounds.

**Concerns**
- [MEDIUM] Local verification is not fully deterministic. `supabase stop && supabase start` does not necessarily reapply `e2e/fixtures/seed.sql`, but the Vitest matrix depends on fixture email users.
- [LOW] The plan says "insert" the section, not "add or update"; reruns could duplicate `[auth.email]` if partially applied.
- [LOW] "Local-only cannot affect production" should explicitly assume no `supabase config push` or linked-project auth-config sync path.

**Suggestions**
- After restart, explicitly apply `e2e/fixtures/seed.sql` with `PGOPTIONS='-c app.e2e_seed_allowed=true'`, or document that `supabase db reset` plus fixture seed is required.
- Make the edit idempotent: update an existing `[auth.email]` if present.

**Risk Assessment** — LOW-MEDIUM. The config fix is correct; the main risk is unreliable local validation due to seed state.

**PLAN 18-02**

**Summary** — The CI pin change is necessary, but the plan does not fully satisfy "local AND CI" because it only edits `.github/workflows/ci.yml`. The repo already has an npm `supabase` pin in `package.json`, currently `2.98.2`, so local and CI can still drift.

**Strengths**
- Requires both CI setup-cli uses to match exactly.
- Avoids floating `latest`.
- Keeps `verify_jwt = false` blocks untouched.

**Concerns**
- [HIGH] `npm run test:integration` does not prove the resolved CI CLI version works locally unless the local Supabase stack was started with that exact version. Updating only `ci.yml` can produce false validation.
- [MEDIUM] "latest stable at execution time" is broader than necessary for closeout. Current release listings show stable `v2.102.0` and newer `v2.103.0-beta.*` prereleases; the executor must avoid prereleases and should prefer the smallest verified fixed version if latest stable regresses.
- [MEDIUM] Passing tests with `verify_jwt=false` does not itself prove the ES256 runtime bug is gone. The plan needs direct evidence of the bundled edge-runtime version.
- [LOW] Optional update of `deploy-edge-functions.yml` conflicts with the stated `files_modified` and "exactly two ci.yml lines" acceptance.

**Suggestions**
- Align the npm `supabase` devDependency/package-lock with the chosen exact CLI version, or require local validation through `npx supabase@<resolved-version>` / `npm exec supabase -- --version`.
- Add a verification step that records `supabase --version` and the local start log or Docker image showing `edge-runtime >= v1.74.0`.
- Remove the optional deploy workflow update, or make it an explicit separate consistency change with its own acceptance criteria.

**Risk Assessment** — MEDIUM-HIGH. CI may be fixed, but the current plan can leave local validation on a different CLI/runtime, which violates the phase requirement.

**PLAN 18-03**

**Summary** — The trigger-based approach is the right interception layer for server-side EF behavior, but the current design is not yet safe enough for debt-zero. The wildcard sentinel can affect other integration files, leaked sentinels can poison the database, and the seed guard is weaker than claimed unless `psql` error handling is hardened.

**Strengths**
- Correctly tests real EF failure branches instead of mocking.
- Good branch expectations: UPDATE-fail/DELETE-succeed versus UPDATE+DELETE-fail.
- Correctly recognizes that sentinels must be disarmed before poll cleanup.

**Concerns**
- [HIGH] The wildcard sentinel is global DB state. Vitest integration config does not disable file parallelism in `vitest.config.integration.ts`, so other test files can hit failing `polls` UPDATE/DELETE while the sentinel is armed.
- [HIGH] Disarm is not specified as `try/finally`, and `afterEach` does not unconditionally clear `test_fault_config`. Any assertion or fetch failure before disarm can poison the rest of the suite.
- [HIGH] The claimed `app.e2e_seed_allowed` fail-closed guard is incomplete when run through plain `psql -f`; PostgreSQL documents that `psql` continues after errors unless `ON_ERROR_STOP` is set. Current CI also calls `psql ... -f e2e/fixtures/seed.sql` without `-v ON_ERROR_STOP=1`.
- [MEDIUM] Retrieving `actualPollId` via "newest `poll_created`" is racy. Use the unique title/body token and actor/time filters, not global newest audit state.
- [MEDIUM] `CREATE TABLE IF NOT EXISTS test_fault_config` preserves rows from crashed local runs. Re-seeding should clear stale sentinels.
- [MEDIUM] `SECURITY INVOKER` trigger functions that read `test_fault_config` may fail for non-service-role DML unless privileges are verified. "Dormant when empty" must be tested for every role that can UPDATE/DELETE `polls`.
- [LOW] The file header saying "four behaviours" should be updated when adding two more cases.

**Suggestions**
- Prefer title/token-scoped fault rows over a wildcard UUID. The test knows the poll title before invoking the EF; triggers can match `NEW.title` / `OLD.title` and avoid cross-file interference.
- Add `try/finally` around each armed test and make `afterEach` first delete from `test_fault_config`, then cleanup audit/polls.
- Harden `seed.sql` with `\set ON_ERROR_STOP on` and/or wrap the whole file in one transaction; update CI `psql` calls with `-v ON_ERROR_STOP=1`.
- Add `TRUNCATE public.test_fault_config` after table creation in the fixture seed.
- Query audit rows by unique title, `actor_id`, `action`, and `created_at >= startedAt`.

**Risk Assessment** — HIGH. The concept is correct, but the current plan can fail full-suite CI, leak armed fault state, or fail to enforce the production-safety guard.

**Cross-Wave Verdict** — Do not execute as-is for v1.4 closeout. 18-01 is acceptable with minor validation tightening. 18-02 needs local CLI pin alignment. 18-03 needs the fail-safe and non-global fault-injection fixes before it can satisfy the hard debt-zero mandate.

---

## Cursor Review

# Cross-AI Plan Review — Phase 18: Test-Environment Repair

## 1. Summary

The three plans are **well-researched, correctly sequenced (config → CI CLI → fault tests + gate), and aligned with locked decisions L-01/L-02/D-03/D-04**. They match the repo today: `supabase/config.toml` has no `[auth.email]` block; CI pins CLI `2.92.1` in three workflow files; the deferral comment in `create-poll-results-hidden.test.ts` is exactly at lines 156–163; `create-poll/index.ts` audit ordering matches the planned assertions.

The main gaps are **local/CI CLI parity (D-04 + L-03)**, **Vitest file-level parallelism vs "newest `poll_created`" audit lookup**, and **making optional workflow pins mandatory** for a debt-zero closeout. Without those, you can get **green CI with flaky or misleading local runs**, or **false confidence** on TEST-17.

## 2. Strengths
- **Root-cause mapping is accurate** — Missing `[auth.email]` explains `email_provider_disabled`; CLI-bundled edge-runtime explains TEST-17; DB triggers are the right layer for server-side `create-poll`.
- **18-01 is minimal and safe** — Single-file change, explicit `supabase stop && supabase start`, byte-identical `verify_jwt = false` check, scoped verify on `vote-counts-rls.test.ts`.
- **18-02 execution-time CLI resolution** — "Resolve from releases, don't guess" satisfies D-04 better than hardcoding.
- **18-03 fault design fits the EF** — Wildcard sentinel avoids pre-known poll IDs; disarm-before-cleanup matches `afterEach`; DDL only in seed.sql behind existing guard.
- **Threat models are proportionate** — Local-only email signup, `SECURITY INVOKER`, no migrations for `test_fault_config`.
- **Wave 3 gate** — Full `npm run test:integration` + explicit CI push matches L-02/L-03 and forbids skip/xfail exits.

## 3. Concerns

| Severity | Issue |
|----------|--------|
| **HIGH** | **18-02 does not pin local CLI to the resolved version.** `package.json` already has `"supabase": "2.98.2"` while CI uses `2.92.1`. Plan 18-02 only edits `ci.yml`. Acceptance says local `npm run test:integration` proves "the same CLI version works locally," but the action never requires `npx supabase@<pin>` / updating `package.json` / documenting `supabase --version` parity. L-03 ("green locally **and** in CI") can pass locally on 2.98.2 and fail in CI (or the reverse) until all pins align. |
| **HIGH** | **Fault tests use global "newest `poll_created`" without serializing the integration suite.** `18-PATTERNS.md` asserts "single-worker/sequential," but `vitest.config.integration.ts` does not set `fileParallelism: false` or `pool: { forks: { singleFork: true } }`. With three files, parallel file runs can steal the newest audit row → **flaky CI** on TEST-19. |
| **MEDIUM** | **`deploy-edge-functions.yml` is optional though coupling expects alignment.** Still at `2.92.1`; drift breaks deploy vs test stack and undermines "exact pin" intent. |
| **MEDIUM** | **18-03 seed apply path is easy to get wrong locally.** CI applies `e2e/fixtures/seed.sql` with `PGOPTIONS: -c app.e2e_seed_allowed=true`. `supabase stop && supabase start` alone does **not** re-apply that file. Executor may think Task 1 passed when DDL never landed. |
| **MEDIUM** | **18-02 local verify depends on 18-01 stack restart but doesn't state it.** |
| **MEDIUM** | **Permanent `polls` triggers affect the whole local DB** while armed; no `afterEach` safety net if a test throws before disarm. |
| **LOW** | **18-01 doesn't update README** — fixture-seed instructions; closeout ergonomics. |
| **LOW** | **CLI bump verification is manual-only for CI** — merge-before-green risk if push is skipped. |
| **LOW** | **Branch (b) audit bootstrap** — `.limit(2).order(created_at desc)` assumes both rows share `target_id`; fragile if audit ordering changes. |

## 4. Suggestions
- **18-02:** Treat as **required**, not optional: bump `deploy-edge-functions.yml` and **`package.json` `devDependencies.supabase`** to the **same** resolved semver as both `ci.yml` `setup-cli` steps. Add verify step: `npx supabase --version` matches pin before `npm run test:integration`.
- **18-03 (Task 3 or Task 2):** Add to `vitest.config.integration.ts`: `fileParallelism: false` (or `pool: { forks: { singleFork: true } }`) **or** resolve `actualPollId` via poll title prefix from `buildBody` / actor filter — don't rely on a comment about sequential runs.
- **18-03 Task 1:** Mandate explicit re-seed with `PGOPTIONS='-c app.e2e_seed_allowed=true' psql ... -f e2e/fixtures/seed.sql` (same as CI), not only `db reset`.
- **18-03 fault tests:** `try/finally` around sentinel arm/disarm so thrown assertions don't leave wildcards armed for later files.
- **18-02 Step 1:** Record **evidence** the chosen CLI bundles `edge-runtime >= 1.74.0`, not only "latest stable."
- **18-01:** Add one line to README "Running tests" for `npm run test:integration` + stack restart + `PGOPTIONS` seed (docs-only).
- **18-03 gate:** Keep the `grep -r test_fault_config supabase/migrations/` → empty acceptance check in the gate task.

## 5. Risk Assessment

**Overall: MEDIUM**

**Justification:** Scope is appropriately small and research matches the codebase. Risk is **not** production leakage of fault DDL or email auth (guards and Discord-only prod are sound). Risk **is** operational: **CLI version skew** (local `2.98.2` vs CI `2.92.1` until aligned), **parallel Vitest + global audit queries** (TEST-19 flake), and **seed/CLI restart steps skipped** (false greens). Those can violate L-03/L-02 without careful execution even if plans read well.

**Per plan:** 18-01 LOW · 18-02 MEDIUM–HIGH · 18-03 MEDIUM.

**Debt-zero / green-in-CI:** Achievable if executors treat **CLI triple-pin** (ci ×2 + deploy + npm), **integration serialisation or robust poll ID resolution**, and **explicit e2e seed re-apply** as part of "done," not optional polish.

---

## Consensus Summary (cycle 1)

Three reviewers agree the plans are **well-researched, correctly sequenced, and minimal**, with accurate root-cause mapping and proportionate threat models. The disagreement is on execution rigor for a debt-zero closeout: Gemini rates overall risk LOW and says "proceed"; Codex and Cursor both withhold approval until specific HIGH-severity gaps are closed. All three HIGH concerns below were **verified against the live repo** during synthesis and are confirmed real (not speculative).

### Agreed Strengths
- Real-repair (not mock/skip) approach satisfies the L-01/L-02 debt-zero ethos — all three reviewers.
- 18-01 is minimal, single-file, and correctly preserves the `verify_jwt = false` prod-alignment blocks — all three.
- The wildcard-sentinel DB-trigger design is the correct interception layer for the server-side `create-poll` EF — all three.
- 18-02's execution-time CLI version resolution (don't hardcode) is sound — Gemini + Cursor.
- Production-safety framing (DDL in seed.sql only, no migration, `SECURITY INVOKER`, Discord-only prod) is correct — all three.

### Agreed Concerns (highest priority)

**HIGH-1 — Local/CI CLI version skew (Codex HIGH, Cursor HIGH). VERIFIED.**
`package.json` pins `supabase: 2.98.2` while both `ci.yml` jobs and `deploy-edge-functions.yml` pin `2.92.1`. Plan 18-02 only edits `ci.yml`, so `npm run test:integration` validates against the local `2.98.2` stack while CI runs the bumped pin — the local-green claim in 18-02's acceptance does not prove the CI pin works, directly threatening L-03 ("green locally AND in CI") and D-04 (exact pin). Fix: align all four pins (ci.yml ×2 + deploy-edge-functions.yml + package.json) to the same resolved semver, and add a `supabase --version` parity check + edge-runtime ≥ v1.74.0 evidence to 18-02's acceptance.

**HIGH-2 — Global fault state + Vitest file parallelism → flaky TEST-19 (Codex HIGH, Cursor HIGH). VERIFIED.**
`vitest.config.integration.ts` sets no parallelism control (`fileParallelism: false` / `singleFork` absent), so Vitest's default file-level parallelism is in effect. The wildcard sentinel arms a global BEFORE UPDATE/DELETE trigger on `polls`, and the test resolves `actualPollId` via "newest `poll_created`" audit row — a sibling integration file running concurrently can both (a) hit the armed trigger and fail spuriously, and (b) steal the newest audit row. Fix: serialize the integration suite (`fileParallelism: false` or `pool.forks.singleFork: true`) AND/OR scope the fault row + audit lookup to the unique poll title/actor/timestamp instead of a global wildcard + "newest."

**HIGH-3 — Fault state not fail-safe + seed guard not fail-closed under `psql` (Codex HIGH). VERIFIED.**
The disarm path is not specified as `try/finally` and `afterEach` does not unconditionally `DELETE FROM test_fault_config`, so a thrown assertion before disarm leaves the wildcard armed and poisons the rest of the suite. Separately, the `app.e2e_seed_allowed` guard is a top-of-file `DO $$ ... RAISE EXCEPTION` block, but CI runs `psql -f e2e/fixtures/seed.sql` WITHOUT `-v ON_ERROR_STOP=1` (verified in ci.yml lines 107 and 207) — so per PostgreSQL psql semantics, an unguarded run prints the error and then continues executing the remaining DDL, meaning the guard does not actually fail-closed. 18-03 inherits and amplifies this by appending trigger DDL after the guard. Fix: wrap arm/disarm in `try/finally` + unconditional `afterEach` cleanup of `test_fault_config`; harden the guard with `ON_ERROR_STOP` (or wrap the file in a single transaction) and add `-v ON_ERROR_STOP=1` to the CI psql calls.

**MEDIUM (raised by 2+ reviewers):**
- Local seed re-apply is easy to miss — `supabase stop && supabase start` does not re-apply `e2e/fixtures/seed.sql`; the executor needs the explicit `PGOPTIONS=... psql -f` step or `db reset` + reseed (Codex, Cursor).
- `deploy-edge-functions.yml` left at `2.92.1` — drift between deploy and test stacks; the "optional" update should be mandatory (Gemini, Codex, Cursor).
- 18-02 acceptance ("exactly two ci.yml lines changed") conflicts with the optional `deploy-edge-functions.yml` / `package.json` edits the same plan recommends (Codex, Cursor).

### Divergent Views
- **Overall risk:** Gemini rates the phase LOW risk and recommends proceeding with Wave 1; Codex rates 18-03 HIGH and says "do not execute as-is"; Cursor rates overall MEDIUM. The divergence is explained by depth of repo inspection — Gemini took the plan's "suite runs sequentially" claim at face value, while Codex and Cursor checked `vitest.config.integration.ts` and found no parallelism control. The verified evidence supports the Codex/Cursor position.
- **Trigger interference severity:** Gemini rated parallel-test trigger interference LOW ("research says sequential"); Codex/Cursor rated the same underlying issue HIGH because the config does not enforce sequential execution. The config check resolves this in favor of HIGH.

### Recommended Next Step (cycle 1)
Three HIGH concerns remain unresolved (none addressed yet — plans not revised). Feed this review back into planning:

```
/gsd:plan-phase 18 --reviews
```

Address HIGH-1 (CLI pin alignment across all 4 locations + parity/evidence checks), HIGH-2 (serialize integration suite or scope fault row + audit lookup), and HIGH-3 (fail-safe disarm + `ON_ERROR_STOP` hardening of the seed guard) before executing — each is a direct threat to the L-02/L-03 debt-zero / green-in-CI mandate.
