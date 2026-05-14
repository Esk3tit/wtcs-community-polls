---
phase: 13
reviewers: [gemini, codex]
reviewers_skipped:
  - claude (running inside Claude Code CLI — skipped for independence)
  - coderabbit (reviews diffs, not plan prompts)
  - cursor (usage limit reached)
cycle: 3
cycles_run: 3
reviewed_at: 2026-05-13T17:18:10Z
plans_reviewed:
  - 13-01-PLAN.md
  - 13-02-PLAN.md
replan_commit: 377ceac
---

# Cross-AI Plan Review — Phase 13 (Convergence Loop)

This file aggregates three review cycles. Cycle 1 raised 3 HIGHs (all resolved in cycle 2
replan). Cycle 2 raised 1 new HIGH (zsh PIPESTATUS + rm -rf race in Plan 13-02 Task 1 log
capture). The plan was updated at commit 377ceac with D-27 (mktemp + bash -c + cp pattern).
Cycle 3 verifies whether that HIGH is resolved and whether any new HIGHs were introduced.

## Convergence Status

| Metric | Cycle 1 | Cycle 2 | Cycle 3 |
|--------|---------|---------|---------|
| HIGH concerns (Gemini) | 0 | 0 | 0 |
| HIGH concerns (Codex) | 3 | 1 (new) | 0 |
| HIGH concerns total (unique) | 3 | 1 (new) | 0 |
| Cycle-(N-1) HIGHs unresolved | n/a | 0 (all 3 RESOLVED) | 0 (1 RESOLVED) |
| Overall risk (Gemini) | LOW | LOW | LOW |
| Overall risk (Codex) | HIGH | HIGH (until fix) | LOW |

**Convergence verdict (Cycle 3):** CONVERGED. Both Gemini and Codex independently confirm
the Cycle-2 HIGH (zsh PIPESTATUS + rm -rf race) is FULLY RESOLVED by D-27's mktemp +
`bash -c` + post-run cp pattern. No new HIGHs identified by either reviewer. Remaining
concerns are MEDIUM (D-22 self-check regex expected-count text) and LOW (stale CONTEXT/RESEARCH
wording, audit-mobile.sh stale comment, fallback-language framing).

---

# Cycle 3 — Review of 377ceac replan (D-27)

## Cycle 3 — Gemini Review

# Cross-AI Plan Review — Phase 13 (CYCLE 3)

## 1. Summary
The Phase 13 Cycle 3 implementation plans are technically mature and provide a comprehensive resolution to the `UIDN-02` mobile audit closure. The plans successfully incorporate all preceding review feedback, most notably the **D-27** shell-safety pattern which robustly handles the log capture in a zsh environment while avoiding race conditions with directory cleanup. By whitelisting intentional `home` ↔ `admin` collisions (**D-19**) and enforcing a strict single-run policy with report-based verification (**D-22**), the plans maintain high forensic integrity. The branching documentation logic for pass/miss outcomes is exceptionally thorough, ensuring project state artifacts (`PROJECT.md`, `REQUIREMENTS.md`) remain accurate regardless of the Lighthouse results.

## 2. Strengths
- **Robust Shell Safety (D-27):** The `mktemp` + `bash -c` wrapper + `cp` pattern perfectly addresses the Cycle 2 HIGH by ensuring log persistence and correct exit-code capture in zsh.
- **Collision Integrity (D-19):** Whitelisting the intentional per-width `home` ↔ `admin` pairs prevents false-positive dupe-check failures while still catching loading-shell defects.
- **Verification Rigor (D-22):** The transition to report-based verification (`jq`) instead of re-running the audit protects the single-run policy.
- **Thorough Branching Logic:** Clear, copy-pasteable wording for both PASS and MISS outcomes ensures document consistency.
- **Zero Source Edits (D-02):** Adherence to the Phase 9 invariant prevents accidental production regressions.
- **AST-Style Verification:** Using a Node.js one-liner to verify the `UNAUTH_ROUTES` array length is a significant improvement over brittle line-grep counts.

## 3. Concerns
- **None.** All previously raised HIGHs are fully resolved, and no new high-severity risks were identified in this cycle.

## 4. Suggestions
- **None.** The plans are highly prescriptive and ready for autonomous execution.

## 5. Risk Assessment: LOW
The risk is **LOW**. The plans are grounded in empirical research, include multiple layers of validation (sentinel, `sha256` dupe-check, cross-doc consistency), and strictly follow the established closure methodology. The inclusion of a D-22 "plan-invariant" check using Python regex demonstrates an exceptionally high level of self-correcting detail.

## 6. Cycle-2 HIGH Verification
The Cycle-2 HIGH (zsh `PIPESTATUS` + `rm -rf` race) is **FULLY RESOLVED**.
- **Log Persistence:** The use of `mktemp` ensures the log is written to a location outside the artifacts directory before the audit script runs its `rm -rf` cleanup.
- **Shell Compatibility:** The `bash -c` wrapper correctly forces Bash semantics for the pipe, ensuring `${PIPESTATUS[0]}` is correctly expanded and recorded in the log footer regardless of the executor's shell (zsh).
- **Canonical Record:** The verification logic in Plan 13-02 Task 1 correctly identifies a valid `exit=0` or `exit=1` record, ensuring the audit's "truth" is preserved.

**Verdict:** Converged. Ready for execution.

---

## Cycle 3 — Codex Review

**Summary**
The Cycle-3 plans are materially converged. The Cycle-2 HIGH is fully resolved by D-27: Plan 13-02 now logs to `mktemp`, runs the pipeline under `bash -c` so `${PIPESTATUS[0]}` is valid, copies the log back after `audit-mobile.sh` recreates the artifacts directory, and verifies the final `exit=0|1` record. I found no remaining or newly introduced HIGH concerns.

**Strengths**
- D-27 directly fixes both prior defects: zsh `PIPESTATUS` incompatibility and the `rm -rf "$ARTIFACTS_DIR"` log deletion race.
- D-22 remains intact: verify blocks inspect existing Lighthouse reports with `jq` and do not re-run `audit-mobile.sh`.
- D-19 is the right compromise for sha256 checking: expected `/` ↔ unauth `/admin` collisions are whitelisted, unexpected loading-shell collisions still hard-fail.
- D-20 correctly handles non-Performance category failures with generic “under threshold” wording and per-route category diagnosis.
- D-23/D-24/D-25 cleanly avoid `.mjs`→`.ts` imports, summary-file commit drift, and PR placeholder rot.
- The plans cover all Phase 13 success criteria: harness fix, 42-PNG corpus, authenticated `/topics` + `/archive`, Lighthouse archive, evidence/doc row updates.

**Concerns**
- **No HIGH concerns.**
- **MEDIUM:** The D-22 self-check regex in [13-02-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.claude/worktrees/agent-af9d46c4baaed7c96/.planning/phases/13-uidn-02-mobile-audit-closure/13-02-PLAN.md:378) is fragile. It reports `of 6 total` in the current file because prose mentions literal `<verify>...</verify>` tags, while the expected text says `of 4 total`. It still confirms no re-run, but the expected-count text should be corrected or removed.
- **LOW:** Stale context/research wording remains outside the operational plans: `13-RESEARCH.md` still contains older strict “any 2+ share a hash” and `GitHub PR #XX` examples, while `13-CONTEXT.md` still has one “planner imports these constants” line. The plans override these, but cleanup would reduce executor confusion.
- **LOW:** `audit-mobile.sh` still has the old D-14 ship-anyway comment. Execution behavior and Plan 13-02 enforce strict D-11, so this is documentation drift only.
- **LOW:** The fallback language “abort and rerun ONCE” on report/log disagreement should explicitly classify that as an invalid infrastructure attempt, not a score rerun, to preserve D-13’s forensic framing.

**Suggestions**
- Update the D-22 Python check expected text from `of 4 total` to either the actual count or just require `PASS`.
- Clean stale `13-RESEARCH.md` and `13-CONTEXT.md` wording for D-19/D-23/D-25 consistency.
- Reword the mismatch branch as: “do not use this run as canonical; document infra failure, fix capture, then run the single canonical audit.”
- Optionally add a visual spot-check for one `/admin` PNG as well as `/topics`, since `/admin` is intentionally in the sha whitelist.

**Risk Assessment**
LOW. The prior execution blocker is fixed, and I do not see a remaining path that would corrupt the canonical Lighthouse log or silently re-run the audit. Remaining issues are verification/documentation hygiene, not phase-blocking risks.

**Cycle-2 HIGH Verification**
FULLY RESOLVED. The D-27 pattern in [13-02-PLAN.md](/Users/khaiphan/code/wtcs-community-polls/.claude/worktrees/agent-af9d46c4baaed7c96/.planning/phases/13-uidn-02-mobile-audit-closure/13-02-PLAN.md:216) fixes both parts:

- `mktemp` writes outside `.planning/closure/artifacts/lighthouse`, so `audit-mobile.sh` line 28 cannot delete the live log.
- `bash -c '... | tee "$1"; exit "${PIPESTATUS[0]}"'` forces bash semantics, so the script exit is captured correctly even when the caller shell is zsh.
- The log is copied back only after the audit script recreates the directory, and verification requires final line `exit=0` or `exit=1`.

Verdict: no HIGHs remain; no new HIGHs introduced.

---

## Consensus Summary — Cycle 3

Both reviewers independently confirm the Cycle-2 HIGH is **FULLY RESOLVED**:

- **mktemp** writes the log outside `.planning/closure/artifacts/lighthouse/`, so `audit-mobile.sh`'s
  `rm -rf "$ARTIFACTS_DIR"` cannot delete the live log mid-run.
- **`bash -c '... | tee "$1"; exit "${PIPESTATUS[0]}"'`** forces bash semantics for the pipe,
  so `${PIPESTATUS[0]}` correctly expands regardless of the executor's shell (zsh, bash, etc.).
- The log is **copied back via `cp`** only after `audit-mobile.sh` recreates the directory at
  `audit-mobile.sh:29`, ensuring the canonical record survives.
- The verify block correctly requires `exit=0` or `exit=1` as the final line.

### Agreed Strengths (Cycle 3)

- **D-27 mktemp + bash -c + cp** robustly handles both prior defects (zsh PIPESTATUS, rm -rf race).
- **D-22** verification rigor preserved (jq-based report inspection, no audit re-run).
- **D-19** per-width whitelist correctly handles intentional home↔admin sha256 collisions.
- **D-20** generic "under threshold" wording handles non-Performance category failures.
- **D-23 / D-24 / D-25** cleanly resolved (no .mjs→.ts imports, summary-file commit drift, PR placeholder rot).
- Plans cover all Phase 13 success criteria: harness fix, 42-PNG corpus, authenticated /topics + /archive,
  Lighthouse archive, evidence/doc row updates.

### Agreed Concerns (Cycle 3)

- **None at HIGH severity** — both reviewers explicitly state no HIGHs remain or were introduced.

### Cycle 3 — Remaining Non-Blocking Concerns

Codex surfaced four non-HIGH items; Gemini surfaced none. Sorted by severity:

1. **MEDIUM (Codex)** — D-22 self-check regex in Plan 13-02 fragile re: expected `of 4 total` text.
   File currently mentions inline `<verify>...</verify>` tags in prose; live count is 6, regex
   expects 4. The check still confirms no re-run, but the expected-count text should be corrected
   or relaxed to just require PASS. Not blocking — verification still detects audit-mobile.sh
   re-invocation correctly.

2. **LOW (Codex)** — `13-RESEARCH.md` retains older "any 2+ share a hash" and `GitHub PR #XX`
   example wording; `13-CONTEXT.md` retains one "planner imports the constant" line. Plans
   override, but cleanup would reduce executor confusion.

3. **LOW (Codex)** — `audit-mobile.sh` still has the old D-14 ship-anyway comment; documentation
   drift only, execution behavior is correct per Plan 13-02 strict D-11.

4. **LOW (Codex)** — Fallback language "abort and rerun ONCE" on report/log disagreement could
   be re-framed explicitly as an "invalid infrastructure attempt, not a score rerun" to preserve
   D-13's forensic framing.

### Divergent Views (Cycle 3)

- **Gemini:** zero concerns, ready to execute (LOW risk).
- **Codex:** zero HIGH concerns + 1 MEDIUM + 3 LOW (cleanup/clarity items). Overall risk LOW.

The divergence is **non-substantive**: Codex's items are documentation hygiene and forensic-framing
refinements, not execution blockers. Both reviewers agree the plan is executable as written.

### Recommended Actions Before Execute (Cycle 3 — optional)

These items are NON-BLOCKING; the plan is converged and executable. They are recommended only
if a Cycle-4 polish pass is desired:

1. **(MEDIUM)** Update the D-22 Python check expected text from `of 4 total` to either the
   actual count or just require `PASS`.
2. **(LOW)** Clean stale `13-RESEARCH.md` and `13-CONTEXT.md` wording for D-19 / D-23 / D-25
   consistency.
3. **(LOW)** Reword the report/log mismatch branch as "do not use this run as canonical;
   document infra failure, fix capture, then run the single canonical audit."
4. **(LOW)** Optionally add a visual spot-check for one `/admin` PNG (since `/admin` is
   intentionally in the sha256 whitelist).

---

# Cross-AI Plan Review — Phase 13 (Convergence Loop)

This file aggregates two review cycles. Cycle 1 (review at f2c0a91 / b01d9d4) raised three
HIGH-severity concerns; Cycle 2 (review of the e0a7a5e replan) verifies whether those HIGHs
are resolved and surfaces any new HIGHs introduced by the replan.

## Convergence Status

| Metric | Cycle 1 | Cycle 2 |
|--------|---------|---------|
| HIGH concerns (Gemini) | 0 | 0 |
| HIGH concerns (Codex) | 3 | 1 (new) |
| HIGH concerns total (unique) | 3 | 1 (new) |
| Cycle-1 HIGHs unresolved | n/a | 0 (all 3 RESOLVED) |
| Overall risk (Gemini) | LOW | LOW |
| Overall risk (Codex) | HIGH | HIGH (until fix) |

**Convergence verdict (Cycle 2):** NOT CONVERGED — 1 new HIGH raised. The three Cycle-1 HIGHs
are FULLY RESOLVED by D-19, D-21, D-22, but Codex's empirical inspection of the e0a7a5e replan
identified a new HIGH-severity execution blocker in Plan 13-02 Task 1's Lighthouse capture
command (zsh PIPESTATUS + rm -rf race). Gemini missed this defect.

---

# Cycle 2 — Review of e0a7a5e replan

## Cycle 2 — Gemini Review

### 1. Summary
The Phase 13 replan is an exceptionally high-integrity document that successfully resolves all three HIGH-severity concerns raised in Cycle 1. By introducing a per-width whitelist for intentional `home` ↔ `admin` collisions (D-19), the plan fixes the `sha256` dupe-check false-fail. The Lighthouse single-run policy is now strictly enforced in the verification steps (D-22) by using `jq` to inspect existing artifacts instead of re-invoking the audit. Finally, all paths have been converted to repo-relative formats (D-21), eliminating workspace drift. The plan is rigorous, grounded in the actual codebase (correcting the `AuthGuard` navigation vs. in-place render logic), and provides clear branching instructions for both PASS and MISS outcomes.

### 2. Cycle-1 HIGH Resolution

| Concern | Status | Evidence |
|:---|:---|:---|
| **sha256 dupe-check false-fail** | **RESOLVED** | **D-19** whitelists the intentional `bp-{W}-home.png` ↔ `bp-{W}-admin.png` collision pair per width. Plan 13-01 Task 1 Edit 9 implements this logic, ensuring the harness only fails on *unexpected* collisions (loading-shell captures). |
| **Lighthouse re-invocation** | **RESOLVED** | **D-22** prohibits re-running `audit-mobile.sh` in verify blocks. Plan 13-02 Task 1 verify block uses `jq` on existing reports, and Task 2 verify block includes a Python script check to confirm no re-invocation occurs. |
| **Absolute path drift** | **RESOLVED** | **D-21** mandates repo-relative paths. All `<read_first>`, `<files>`, and `<action>` blocks in 13-01-PLAN and 13-02-PLAN now use repo-relative paths (e.g., `.planning/...`). |

### 3. Strengths
- **Deterministic Hydration Sentinel:** Replacing fragile text-based waits with the unconditionally rendered `[aria-label="Toggle color theme"]` (D-03) provides a stable post-hydration marker without requiring `src/` edits.
- **Voter-UI Fidelity:** The two-context Pass-B strategy (D-08) ensures high-fidelity evidence by capturing the actual voter UI (no Admin link) for `/topics` and `/archive`.
- **Integrity-First Documentation:** The plan provides exhaustive, copy-pasteable wording for both PASS and MISS scenarios (D-11, D-14, D-17), ensuring project state remains honest regardless of the audit outcome.
- **Fail-Fast Integrity Gate:** The `sha256` uniqueness check (D-05) is positioned before the `MANIFEST.json` write, preventing corrupted runs from being recorded as valid.
- **Technical-Miss Disposition:** Acknowledging the 89-Perf score as a "technical miss" (D-26) demonstrates high technical maturity by accounting for Lighthouse noise while maintaining a strict floor.

### 4. New Concerns
- **None.** The replan addressed all identified edge cases, including the `AuthGuard` vs `AdminGuard` behavior correction and the ESM/TypeScript runtime import limitation.

### 5. Suggestions
- **None.** The current level of detail is optimal for autonomous execution.

### 6. Risk Assessment: LOW
The risk is **LOW**. The plans are prescriptive, well-researched, and include robust validation gates (sentinel waitFor, `sha256` dupe-check, cross-doc consistency checks). By explicitly excluding application source edits (D-02), the plan eliminates the risk of production regressions while ensuring the quality of the closure evidence.

---

## Cycle 2 — Codex Review

### Summary

Cycle-1 HIGHs are materially addressed in the replanned plans: D-19 fixes the sha256 false-fail, D-22 removes Lighthouse re-invocation from verify blocks, and D-21 moves operational paths to repo-relative form. I would not execute yet, though: Plan 13-02 introduces a new execution blocker in the Lighthouse log/exit-code capture command.

### Cycle-1 HIGH Resolution

| Prior HIGH | Status | Evidence |
|---|---|---|
| sha256 dupe-check false-fail | **RESOLVED** | D-19 whitelists the intentional per-width `bp-{w}-home.png` ↔ `bp-{w}-admin.png` collision, and Plan 13-01 explicitly fails only unexpected collision groups. Good correction. |
| Lighthouse verify-step re-invocation | **RESOLVED** | Plan 13-02 Task 1 runs `audit-mobile.sh` only in `<action>`; `<verify>` inspects existing `.report.json` files with `jq`. D-22 is properly reflected. |
| Absolute path drift | **RESOLVED** | Operational paths in `<read_first>`, `<files>`, `<action>`, and `<verify>` are repo-relative. Remaining `/Users/...` mentions are rule/context statements, not execution paths. |

### Strengths

- D-19 is the right fix: it preserves `/admin` unauth evidence while avoiding a false-positive collision failure.
- D-20 improves the plan beyond the original review by handling non-Performance category failures consistently.
- D-22's report-inspection approach protects the single-run Lighthouse policy.
- D-23 fixes the `.mjs`/`.ts` fixture import mismatch with inline-mirrored constants.
- D-24 and D-25 cleanly resolve summary-file commit scope and PR-placeholder rot.

### New Concerns

- **HIGH:** The Plan 13-02 Lighthouse capture command is not reliable in the actual zsh environment and races with `audit-mobile.sh` cleanup. The command uses Bash-only `${PIPESTATUS[0]}` from the caller shell, but the environment shell is zsh, where it expands blank. Also, it writes `audit-mobile.stdout.log` inside `.planning/closure/artifacts/lighthouse/`, while `audit-mobile.sh` immediately `rm -rf`s that directory. Result: the canonical log may be missing/truncated and the final line may be `exit=` instead of `exit=0|1`.

- **MEDIUM:** Plan 13-02 still contains a direct contradictory instruction to include `GitHub PR #XX` in the evidence cross-references, then later requires no PR placeholder. D-25 is clear, but this line can make execution self-conflicting.

- **LOW:** `13-CONTEXT.md` still has stale pre-D-19 / pre-D-20 wording: strict "any 2+ share a hash" and miss wording "under 90." D-19/D-20 override it, and the plans mostly use the corrected wording, but cleanup would reduce drift.

- **LOW:** `13-CONTEXT.md` still says "planner imports the constant" for `memberUser`, conflicting with D-23's inline-mirror decision. Plan 13-01 is correct; context has stale text.

### Suggestions

- Replace the Lighthouse capture command with a shell-safe form that writes outside the directory cleaned by the script, then copies the log back after the run. Example pattern:

```bash
tmp_log="$(mktemp)"
bash -c 'bash .planning/closure/audit-mobile.sh 2>&1 | tee "$1"; exit "${PIPESTATUS[0]}"' _ "$tmp_log"
status=$?
mkdir -p .planning/closure/artifacts/lighthouse
cp "$tmp_log" .planning/closure/artifacts/lighthouse/audit-mobile.stdout.log
echo "exit=$status" >> .planning/closure/artifacts/lighthouse/audit-mobile.stdout.log
```

- Remove `GitHub PR #XX` from Plan 13-02 Task 2's required cross-reference list.
- Clean stale CONTEXT wording so D-19/D-20/D-23 are not contradicted elsewhere.
- Add an explicit "Lighthouse infra failure" branch: fewer than 5 JSON reports means fix environment and rerun as a failed audit attempt, not as score gaming.

### Risk Assessment

**HIGH until the Plan 13-02 capture command is fixed.** The original three HIGHs are resolved, and the overall architecture is sound, but the current Lighthouse run command can fail verification or lose the official run log in this zsh worktree. After that command is corrected, I'd drop the plan risk to **LOW-MEDIUM**.

---

## Cycle 2 — Empirical Verification of Codex's New HIGH

The reviewer (Claude, running this cross-AI cycle) independently verified Codex's HIGH claim
against the actual runtime environment because the issue is empirically testable and material
to whether the plan can execute as written:

**Test 1 — zsh PIPESTATUS expansion** (Bash tool runs commands via zsh in this environment):

```
$ zsh -c 'true | false; echo "PIPESTATUS[0]=${PIPESTATUS[0]} pipestatus[1]=${pipestatus[1]}"'
PIPESTATUS[0]= pipestatus[1]=0
$ bash -c 'true | false; echo "PIPESTATUS[0]=${PIPESTATUS[0]}"'
PIPESTATUS[0]=0
```

In zsh, the variable is **lowercase `pipestatus`** and **1-indexed**. The plan's
`${PIPESTATUS[0]}` expands to empty string in zsh, so the appended canonical record would read
`exit=` (no value), and the verify block check `Expected: log file exists and the final line is
'exit=0' or 'exit=1'` would FAIL on the very command meant to capture the audit's truth.
Confirmed: HIGH is valid in this environment.

**Test 2 — `rm -rf` race with tee output:**

`audit-mobile.sh` line 28 executes `rm -rf "$ARTIFACTS_DIR"` (where `$ARTIFACTS_DIR=.planning/closure/artifacts/lighthouse`)
near the start of the script. The plan tees the script's stdout into `${ARTIFACTS_DIR}/audit-mobile.stdout.log`.
Simulation:

```
$ ( bash -c 'echo "line1"; sleep 0.2; rm -rf /tmp/race-test; echo "line2"; mkdir /tmp/race-test; echo "line3"; exit 7' \
       2>&1 | tee /tmp/race-test/captured.log; echo "exit=${pipestatus[1]}" )
line1
line2
line3
exit=7
$ cat /tmp/race-test/captured.log
cat: /tmp/race-test/captured.log: No such file or directory
```

The captured log does not survive the `rm -rf`. Confirmed: HIGH is valid.

**Verdict on Codex's new HIGH:** GENUINE, REPRODUCIBLE, BLOCKS EXECUTION as written.
Recommendation: adopt Codex's suggested mktemp + post-run cp pattern, OR write the log
OUTSIDE the directory that `audit-mobile.sh` cleans (e.g., `.planning/closure/audit-mobile.stdout.log`
at the parent level), AND replace `${PIPESTATUS[0]}` with `${pipestatus[1]}` (or run the pipeline
explicitly under bash via `bash -c 'pipeline; exit ${PIPESTATUS[0]}'`).

---

## Consensus Summary — Cycle 2

Both reviewers agree that **D-19, D-21, D-22 fully resolve the three Cycle-1 HIGHs**. The
substantive divergence in Cycle 2 is whether the replan introduced a new HIGH:

- Gemini: zero new HIGHs, ready to execute.
- Codex: one new HIGH in Plan 13-02 Task 1's log capture command (zsh shell incompatibility +
  rm -rf race). Risk remains HIGH until fixed.

This reviewer's empirical tests **side with Codex**: the issue is real, reproducible in the
actual runtime shell (zsh), and would silently corrupt the canonical Lighthouse exit-code
record. The single fix is mechanical (mktemp + cp pattern, or write log outside the cleaned
directory, and use zsh-compatible `${pipestatus[1]}` or wrap in `bash -c`).

### Agreed Strengths (Cycle 2)

- **D-19 whitelist correctly fixes the sha256 false-fail** while preserving `/admin` unauth evidence.
- **D-22 properly enforces Lighthouse single-run policy** via report-inspection (jq) in verify blocks.
- **D-21 eliminates absolute-path drift** by moving operational paths to repo-relative form.
- **D-20 multi-category MISS wording** properly handles non-Performance threshold failures.
- **D-23 inline-mirrored fixture constants** correctly avoids the .mjs-cannot-import-.ts trap.
- **D-25 + D-24 atomic-commit hygiene** keeps PR placeholders out of committed text and scopes
  the closure commit to the 5 evidence artifacts.

### Agreed Concerns (Cycle 2)

- **None universally agreed.** Gemini did not surface any concerns; Codex's new HIGH and 3
  follow-up MEDIUM/LOW items are unique to Codex.

### Divergent Views (Cycle 2)

- **Plan 13-02 log capture command (Codex HIGH; Gemini silent)** — Codex inspected the actual
  shell and `audit-mobile.sh` rm -rf behavior; Gemini accepted the command at face value.
  Independent verification (above) sides with Codex.
- **Overall risk (Gemini LOW; Codex HIGH-until-fix)** — Driven by the above divergence.

### Outstanding Cycle-2 Items Before Execute

1. **(HIGH)** Replace Plan 13-02 Task 1 log capture command — use zsh-compatible `${pipestatus[1]}`
   or `bash -c` wrapping AND write the log outside `.planning/closure/artifacts/lighthouse/` to
   avoid the `audit-mobile.sh` rm -rf race. Codex's mktemp + cp pattern is the cleanest fix.
2. **(MEDIUM)** Remove the `GitHub PR #XX` reference from Plan 13-02 Task 2's required
   cross-reference list to align with D-25.
3. **(LOW)** Tidy `13-CONTEXT.md` stale wording — replace "any 2+ share a hash" with D-19
   whitelist semantics; replace "under 90" with D-20 "under threshold"; replace "planner imports
   the constant" with D-23 inline-mirror language.

---

# Cycle 1 — Original Review (preserved for traceability)

## Cycle 1 — Gemini Review

### 1. Summary
The implementation plans for Phase 13 are exceptionally rigorous, providing a deterministic path to closing the `UIDN-02` mobile audit requirement. The strategy effectively addresses the "Plan 02" harness defect (loading-shell captures) by replacing fragile text-based waits with a stable Navbar sentinel and a fail-fast sha256 uniqueness gate. The dual-context approach for authenticated screenshots ensures high-fidelity evidence of the voter UI. The plans are notable for their meticulous handling of outcome-conditional documentation updates, ensuring the project's state remains "honest" regardless of whether the Lighthouse Performance target is met.

### 2. Strengths
*   **Deterministic Hydration Sentinel:** Utilizing the `[aria-label="Toggle color theme"]` selector is an excellent solution that adheres to the "zero-src/-edits" constraint while providing a stable post-hydration marker.
*   **Fail-Fast Integrity Gate:** The addition of the sha256 uniqueness check directly targets the signature of the previous failure mode (identical loading shells), preventing bad data from being recorded in the manifest.
*   **Voter-UI Fidelity:** Splitting Pass-B into two Playwright contexts (`adminUser` vs. `memberUser`) correctly captures the distinct UI states (e.g., presence/absence of the Admin link), which is critical for audit accuracy.
*   **Robust Branching Logic:** Plan 13-02 provides exhaustive, copy-pasteable wording for both PASS and MISS scenarios, significantly reducing the risk of inconsistent documentation across `PROJECT.md`, `REQUIREMENTS.md`, and the evidence file.
*   **Environmental Awareness:** The "Human-verify" checkpoint in Plan 13-01 Task 2 correctly identifies and mitigates the risk of the local preview/Supabase server dependency.

### 3. Concerns
*   **Strict Floor Variance (LOW):** The decision to enforce a strict ≥ 90 floor (D-11) without a variance buffer (D-14 analog) is a high-integrity choice, but given Lighthouse's inherent volatility (±5–10pp), there is a non-negligible chance of a "technical miss" (e.g., 89) that requires a follow-up. The plan handles the *documentation* of this well, but it may result in the requirement staying active longer than necessary if scores oscillate.
*   **Harness Forensics (LOW):** The plan calls for `process.exit(1)` *before* the `MANIFEST.json` write on a dupe-fail. While this keeps the manifest clean, it may make debugging harder for the operator if they want to see the hash collisions recorded in a structured way. *Mitigation: The console output lists the collision groups explicitly.*
*   **Local Secret/Env Dependency (MEDIUM):** The harness requires `VITE_SUPABASE_ANON_KEY`. If the operator's local environment differs from the expected `supabase status` output format, the `export` command provided in the checkpoint might fail.

### 4. Suggestions
*   **Artifact Cleanup Verification:** In Plan 13-01 Task 2, explicitly verify that the `screenshots/` directory is empty *before* the run starts to ensure no stale files from crashed previous attempts contaminate the dupe-check (though the code does `rm -rf`, a manual check adds safety).
*   **Lighthouse Performance Context:** If a "MISS" occurs, it would be beneficial to add a small note in the evidence file's `### Lighthouse mobile scores` section comparing the v1.2 scores to the v1.1 baseline to show if the trend is improving, even if the target hasn't been hit.
*   **Manifest Atomic Check:** In Plan 13-02 Task 4, add a verification step to ensure `git diff --cached` includes `MANIFEST.json` specifically, as it is the primary record of the audit run's validity.

### 5. Risk Assessment: LOW
The risk is classified as **LOW**. The plans are prescriptive, well-researched, and include built-in validation gates. The primary "risks" are environmental (Lighthouse scores or local setup issues), both of which are anticipated and handled through branching logic and interactive checkpoints. The plan does not touch production source code, eliminating the risk of application regressions.

---

## Cycle 1 — Codex Review

### Summary

The plans are detailed, well-scoped to planning artifacts, and mostly aligned with the Phase 13 goal. The main structure is sound: fix the screenshot harness, produce a clean 42-PNG corpus, run the locked Lighthouse audit once, then update evidence and decision rows. However, there are two serious execution risks: the proposed global sha256 uniqueness gate will likely fail on an intentional `/` vs unauth `/admin` duplicate, and Plan 13-02's automated verify step appears to rerun Lighthouse, directly violating the single-run policy.

### Strengths

- Strong dependency ordering: harness fix before screenshot rerun, screenshot evidence before Lighthouse/doc updates.
- Good preservation of scope: no `src/` edits, no CI expansion, no Lighthouse flag tuning.
- The sentinel choice is grounded in existing code. The Navbar theme toggle is present at `src/components/layout/Navbar.tsx:74`.
- Two-context Pass-B design is correct for separating admin and member UI evidence.
- Evidence disposition handles both pass and miss outcomes instead of assuming scores will clear 90.
- `audit-mobile.sh` already upserts Lighthouse report hashes into `MANIFEST.json`, which supports the artifact trail.

### Concerns (Cycle 1)

#### Plan 13-01

- **HIGH:** The global sha256 dupe check will likely false-fail because unauth `/admin` redirects to `/`, while `/` unauth also renders the landing page. `AdminGuard` returns `<Navigate to="/" />` for unauth users at `src/components/auth/AdminGuard.tsx:17`, and `/` renders `LandingPage` for unauth users at `src/routes/index.tsx:22`. Keeping `/admin` while requiring all 42 PNGs to be unique is probably incompatible. **[RESOLVED Cycle 2 via D-19]**
- **MEDIUM:** The plan text says `/topics` and `/archive` "redirect" unauth users to `/`, but `AuthGuard` renders `LandingPage` in place without navigation at `src/components/auth/AuthGuard.tsx:17`. Dropping them is still reasonable, but the rationale and evidence language should be corrected. **[RESOLVED Cycle 2]**
- **MEDIUM:** The must-have says fixture constants should be imported from `e2e/fixtures/test-users.ts`, while the task says not to import and to inline them. Since this is a `.mjs` script and the fixture file is TypeScript, inline-with-source-comment is probably the right implementation, but the acceptance text should stop saying "imported." **[RESOLVED Cycle 2 via D-23]**
- **MEDIUM:** The soft sentinel `.catch(() => {})` can still allow a shell screenshot if the sentinel never appears. The dupe check is useful, but it is not route-specific and may miss single-route shell captures. Sentinel misses should be logged into `warnings[]` at minimum.
- **LOW:** The `grep -A 10 "const UNAUTH_ROUTES" ... | grep -c "path:"` validation is brittle once comments are added. It can undercount or pass for the wrong reason. **[RESOLVED Cycle 2 — replaced with structural Node regex]**

#### Plan 13-02

- **HIGH:** Task 1's verify command runs `bash audit-mobile.sh` again. That violates D-13 single-run policy and can change the official scores. Verification should inspect the reports produced by the one action run, not execute the audit again. **[RESOLVED Cycle 2 via D-22]**
- **HIGH:** Many plan paths point to `/Users/khaiphan/code/wtcs-community-polls/...`, but the active workspace is the worktree under `.claude/worktrees/...`. Following those absolute paths risks editing the wrong checkout or failing under workspace-write permissions. **[RESOLVED Cycle 2 via D-21]**
- **MEDIUM:** PASS/MISS logic is underspecified if Performance passes but A11y, Best Practices, or SEO fails. `audit-mobile.sh` fails any category below threshold at `.planning/closure/audit-mobile.sh:54`, while the doc wording focuses on Perf ≥ 90. **[RESOLVED Cycle 2 via D-20]**
- **MEDIUM:** Both plans require `13-01-SUMMARY.md` and `13-02-SUMMARY.md`, but those files are not included in `files_modified` or the atomic commit file list. Either commit them or remove them as required outputs. **[RESOLVED Cycle 2 via D-24]**
- **LOW:** `audit-mobile.sh` still has a stale comment saying the D-14 ship-anyway analog applies at `.planning/closure/audit-mobile.sh:7`. Leaving the script unchanged is acceptable, but the comment conflicts with Phase 13's strict-floor policy.
- **LOW:** `GitHub PR #XX` is not knowable before push/PR creation. Avoid committing a placeholder unless there is a follow-up step to replace it. **[RESOLVED Cycle 2 via D-25 — but see Cycle 2 MEDIUM: stale instruction remains in Plan 13-02 Task 2 cross-reference list]**

### Risk Assessment (Cycle 1)

Overall risk: **HIGH** until the dupe-check and Lighthouse rerun issues are fixed.

---

## Cycle 1 — Consensus Summary (preserved)

Gemini rated overall risk **LOW** while Codex rated it **HIGH**, primarily because Codex grounded its review in the actual codebase (route guards, audit-mobile.sh internals) and identified two execution-blocking defects that Gemini's higher-level read missed. Both reviewers agreed the plans were well-scoped, dependency-ordered, and rigorous in documentation handling; both flagged environmental fragility around local Supabase env vars; and both endorsed the sentinel + sha256 strategy in principle. The substantive divergence was in execution mechanics, where Codex's source-level evidence carried more weight.

### Recommended Actions From Cycle 1 (all addressed in e0a7a5e replan)

1. **Resolve dupe-check rule** → D-19 (per-width whitelist for home↔admin collision)
2. **Replace Plan 13-02 verify command** → D-22 (jq inspection of existing reports)
3. **Switch absolute plan paths to repo-relative** → D-21
4. **Correct unauth-route rationale wording** → Plan 13-01 wording updated (AuthGuard renders in place; AdminGuard navigates)
5. **Define multi-category MISS branch** → D-20
6. **Add 13-NN-SUMMARY.md to atomic commit (or drop)** → D-24 (drop — separate optional commit)
7. **Reconsider strict floor vs variance buffer** → D-26 (technical-miss acknowledgement in evidence)
