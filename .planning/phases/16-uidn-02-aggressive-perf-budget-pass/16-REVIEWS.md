---
phase: 16
reviewers: [gemini, codex]
reviewed_at: 2026-05-27T21:10:00Z
plans_reviewed: [16-01-PLAN.md, 16-02-PLAN.md, 16-03-PLAN.md, 16-04-PLAN.md, 16-05-PLAN.md, 16-06-PLAN.md, 16-07-PLAN.md]
attempted_but_failed: [cursor]
cycle: 3
---

# Cross-AI Plan Review — Phase 16: UIDN-02 Aggressive Perf-Budget Pass (Cycle 3 — Re-Review)

> **Re-review cycle.** Cycle 1 raised 7 verified HIGH concerns; cycle 2 confirmed 6 fully resolved and left 1 residual HIGH (prior HIGH #3 — shell-verification correctness: the D-09 trap was inverted by `pipefail` on an expected-failure command in 16-01, plus two unguarded `tail` pipes in 16-03). The plans were re-planned to fold those fixes. This pass independently re-checks whether the residual HIGH is now FULLY resolved and surfaces any NEW defects introduced by the re-plan.
>
> Reviewers invoked: **gemini**, **codex**. `claude` skipped (this review ran inside Claude Code — self-review excluded for independence). `cursor` attempted but failed again ("You've hit your usage limit" — empty output, same as cycle 2). `coderabbit` not applicable (it reviews the git working tree/diff, which is clean for a plan-stage review).
>
> **The two NEW HIGH findings below were independently verified empirically against the live repository during this pass** (the 16-03 grep false-negative was reproduced returning `3` instead of the asserted `1` for a correct implementation; the 16-07 `tee`-into-deleted-directory race was reproduced losing the entire `=== Summary ===` block, leaving only `EXIT_CODE=0` in the committed log). See **Verification Notes**.

## Gemini Review

### Final Assessment: Cycle 3
The implementation plans are now technically sound, highly defensive, and rigorously verified. The architecture correctly balances aggressive performance optimizations with strict GDPR compliance. The addition of mandatory, human-confirmed empirical gates for GDPR network proof and production Lighthouse audits makes this a low-risk set of changes.

### Key Resolution (Residual HIGH #3)
The shell-verification correctness concern has been resolved by:
1. Converting all success-path pipe commands to use `bash -o pipefail` to prevent error masking.
2. Rewriting the expected-failure trap verification in **Task 16-01-04** to capture exit status and output separately, ensuring that a correctly-firing trap is never reported as a false-negative.

### Summary of Resolved HIGHs (Gemini)
1. **`build:analyze` broken:** Fixed to `"ANALYZE=true npm run build"` (16-01).
2. **D-09 production trap env-var:** Correctly keys on Netlify-native `CONTEXT` (16-01).
3. **Shell-verification correctness:** Resolved via `pipefail` and separate status capture (16-01/16-03).
4. **Suspense blanking app-root:** Switched to sibling-loader pattern (16-03).
5. **GDPR network check optional:** Now a mandatory blocking Playwright gate (16-03).
6. **Wrong 16-07 deploy assertion:** Correctly asserts `vendor-posthog` absence from initial HTML (16-07).
7. **Wrong `PROJECT.md` path:** All references updated to `.planning/PROJECT.md` (16-07).

### Risk Assessment (Gemini): LOW
The plans are ready for approval and execution. (Note: Gemini re-checked only the 7 prior HIGHs and did not independently scan for new defects; it did not contradict the two new HIGHs Codex raised.)

---

## Codex Review

**Summary**
The residual Cycle 2 HIGH is resolved: the D-09 expected-failure check now captures status/output separately, and the two 16-03 `tail` pipes now run under `pipefail`. The phase architecture is sound, but I found two new execution defects in verification/evidence capture that should be fixed before handing these plans to an implementer.

**Strengths**
- D-09 now correctly guards both `CONTEXT=production` and `NETLIFY_CONTEXT=production`.
- The prior inverted `pipefail` trap check is fixed in 16-01.
- The two previously unguarded 16-03 `tail` pipes are now guarded.
- PostHog lazy-load design is now facade-only, sibling-mounted, and avoids router blanking/remounting.
- GDPR proof is mandatory via Playwright, not optional.
- 16-02 now decodes visualizer payloads before sensitive-data scanning.
- 16-04 threat model now matches function-form `manualChunks` and includes `scheduler`.

**Concerns**
- **HIGH — 16-03-PLAN.md:435 has a new false-negative grep in the runtime-import invariant.** The regex `from .@/lib/posthog.` also matches `from '@/lib/posthog-facade'`, so after the correct AuthContext/ConsentContext edits it will count facade imports and fail a correct implementation.
- **HIGH — 16-07-PLAN.md:122-123 tees `audit-mobile.sh` output directly into `.planning/closure/artifacts/lighthouse/`, but `audit-mobile.sh:28` begins by deleting that directory.** This can unlink the log while `tee` is writing it, leaving no summary or only the later `EXIT_CODE=` line.
- **MEDIUM — The planned stdout log path is ignored by `.gitignore:49`.** `git check-ignore` confirms `.planning/closure/artifacts/lighthouse/audit-mobile.stdout.log` will not be committed unless force-added or moved.
- **LOW — 16-06's Admin hover smoke should state the operator must be signed in as an admin;** the Admin link is hidden behind `isAdmin`.
- **LOW — Minor doc drift remains:** 16-04's objective still says `react + react-dom only`, while the executable task correctly includes `scheduler`.

**Suggestions**
- Replace the 16-03 import invariant with an exact matcher, e.g. `rg -n "from ['\"]@/lib/posthog['\"]" src`, and assert the single match is `PostHogProviderInner.tsx`.
- In 16-07, tee Lighthouse output to `mktemp` outside the artifacts directory, append `EXIT_CODE`, then copy it into place after `audit-mobile.sh` finishes.
- Either move `audit-mobile.stdout.log` outside the ignored `lighthouse/` directory or explicitly require `git add -f`.
- Add `grep -q '^EXIT_CODE='` to 16-07 Task 2 verification.
- Add the admin-login precondition to the 16-06 hover smoke.

**Risk Assessment**
**MEDIUM.** The product/security architecture is now low-risk, and the original residual HIGH is fixed. Remaining risk is execution integrity: one verify command can falsely block a correct PERF-03 implementation, and the final Lighthouse evidence log can be lost or omitted from git.

**Prior-HIGH Resolution Table (Codex)**

| Prior HIGH | Status | Justification |
|---|---:|---|
| 1. Broken `build:analyze` script | RESOLVED | Uses `ANALYZE=true npm run build`; env reaches `vite build`. |
| 2. D-09 wrong Netlify env var | RESOLVED | Guards `CONTEXT=production` plus legacy `NETLIFY_CONTEXT=production`. |
| 3. Shell verification correctness | RESOLVED | Cycle-2 defects fixed: D-09 no longer pipes expected failure under `pipefail`, and 16-03 `tail` pipes are guarded. New shell defects below are separate. |
| 4. Suspense blanks router | RESOLVED | Children are rendered outside Suspense; loader is a sibling returning `null`. |
| 5. GDPR network check optional | RESOLVED | Playwright zero-PostHog-before-Allow gate is mandatory. |
| 6. 16-07 expected `vendor-posthog` in initial HTML | RESOLVED | Now requires `vendor-react` present and `vendor-posthog` absent. |
| 7. Wrong `PROJECT.md` path | RESOLVED | Targets `.planning/PROJECT.md`; guards against root `PROJECT.md`. |

---

## Cursor Review

_Cursor agent invocation failed again: "You've hit your usage limit." No review produced. Excluded from consensus (same outcome as cycle 2)._

---

## Verification Notes (empirical, this pass)

Both NEW HIGH findings were reproduced against the live repository — they are not speculative.

### NEW HIGH A — 16-03 runtime-import invariant grep is a false-negative (16-03-PLAN.md:435)

The Task 7 automated verify asserts `test "$(grep -rl "from .@/lib/posthog." src/ | grep -v posthog-facade | xargs grep -l "from .@/lib/posthog." 2>/dev/null | wc -l | tr -d " ")" = "1"`.

Reproduced against a correct post-PERF-03 source layout (AuthContext + ConsentContext import ONLY `@/lib/posthog-facade`; `PostHogProviderInner.tsx` is the sole runtime importer of `@/lib/posthog`; the facade uses `import type`):

```
PIPELINE_COUNT=3   (the verify asserts this must == "1")
files surviving `grep -v posthog-facade`:
  src/contexts/ConsentContext.tsx
  src/contexts/AuthContext.tsx
  src/components/PostHogProviderInner.tsx
```

Root cause: the unanchored pattern `from .@/lib/posthog.` matches `from '@/lib/posthog-facade'` (the trailing `.` matches the `-`). The `grep -v posthog-facade` filter operates on FILENAMES emitted by `grep -rl`, not on matched lines, so AuthContext/ConsentContext (which import the facade only) survive the filter and are counted. A CORRECTLY-implemented PERF-03 therefore fails Task 7's automated gate (`= "1"` is false; the pipeline yields `3`). This is the same verification-correctness defect class as the cycle-2 residual HIGH #3 — a false-negative reintroduced in the "corrected" grep. **Fix (Codex):** use an anchored exact matcher, e.g. `grep -rn "from ['\"]@/lib/posthog['\"]" src/` (anchored with closing quote so `-facade` does not match), and assert the single match is `PostHogProviderInner.tsx`.

### NEW HIGH B — 16-07 tees the Lighthouse stdout log into a directory the audit script deletes (16-07-PLAN.md:122-123)

The Task 2 invocation is:
```
mkdir -p .planning/closure/artifacts/lighthouse
bash -c 'set -o pipefail; bash .planning/closure/audit-mobile.sh 2>&1 | tee .planning/closure/artifacts/lighthouse/audit-mobile.stdout.log; AUDIT_EXIT=${PIPESTATUS[0]}; echo "EXIT_CODE=${AUDIT_EXIT}" >> .planning/closure/artifacts/lighthouse/audit-mobile.stdout.log'
```

But `audit-mobile.sh:28` runs `rm -rf "$ARTIFACTS_DIR"` (where `ARTIFACTS_DIR=".planning/closure/artifacts/lighthouse"`) as its FIRST action, then `mkdir -p` recreates it. Reproduced with a stub audit script that emits the real `=== Summary ===` / per-route / `Failed routes:` lines:

```
committed audit-mobile.stdout.log contents AFTER the run:
  EXIT_CODE=0
```

The entire `=== Summary ===` block and all 5 per-route Performance scores are LOST. `tee` opens the log before the script runs; the script's `rm -rf` unlinks that inode mid-run; the script's summary is written into the freshly-recreated directory while `tee` keeps writing to the now-orphaned inode; only the final `echo "EXIT_CODE=..." >>` (which runs after the script exits and re-creates/appends to the path) survives in the committed file. This:
- **Destroys the PERF-07 evidence the entire phase exists to produce** (per-route Lighthouse Perf scores for the v1.3 Rerun section + PASS/DEFER verdict).
- **Breaks Task 2's own verify** (16-07-PLAN.md:133): `grep -q '=== Summary ===' ... && [ $(grep -cE '^(PASS|FAIL) ...') -eq 5 ]` would fail because neither the Summary block nor the 5 per-route lines survive.

**Fix (Codex):** tee to a `mktemp` path OUTSIDE the artifacts directory, append `EXIT_CODE` there, then copy the complete log into place AFTER `audit-mobile.sh` finishes (and `git add -f` it, since `.gitignore:49` ignores the whole `lighthouse/` subtree — the MEDIUM below).

### MEDIUM confirmed — committed log path is gitignored (16-07; .gitignore:49)

`git check-ignore -v .planning/closure/artifacts/lighthouse/audit-mobile.stdout.log` →
```
.gitignore:49:.planning/closure/artifacts/lighthouse/    .planning/closure/artifacts/lighthouse/audit-mobile.stdout.log
```
The log the plan says it commits is inside the ignored `lighthouse/` subtree. Even if NEW HIGH B is fixed, the log won't be committed without `git add -f` or relocating it (e.g. to `.planning/closure/` directly, alongside the un-ignored `MANIFEST.json` exception at `.gitignore:51`).

---

## Consensus Summary

Both reviewers agree the **cycle-2 residual HIGH #3 (shell-verification correctness) is now FULLY RESOLVED**: 16-01's D-09 trap captures status+output separately (no `pipefail` inversion on the expected-failure build), and 16-03's two previously-unguarded `tail` pipes now run under `bash -o pipefail -e -c`. All 7 cycle-1 HIGHs are now closed.

The reviewers diverge on whether NEW defects exist: **Gemini** re-checked only the prior 7 HIGHs and rated the plans LOW (ready to execute). **Codex** independently scanned the re-planned files and surfaced **two NEW HIGH execution defects** (16-03 grep false-negative; 16-07 tee-into-deleted-dir log loss) plus a MEDIUM (gitignored log path) and two LOWs. Both NEW HIGHs were **empirically reproduced this pass** (see Verification Notes) — they are real, not speculative, so the effective risk for execution is Codex's MEDIUM read, not Gemini's LOW. Both are verification/evidence-integrity defects of the same family as the prior HIGH #3 (a verify command that blocks a correct implementation; an evidence-capture command that loses the data the phase must produce) — NOT product-architecture defects.

### Agreed Strengths
- D-09 trap now keys on Netlify-native `CONTEXT` (+ legacy `NETLIFY_CONTEXT`) and is fixed against the cycle-2 `pipefail` inversion (Gemini + Codex).
- `build:analyze` correctly propagates `ANALYZE=true` via the `npm run build` wrapper (Gemini + Codex).
- PostHog sibling-loader Suspense pattern (children outside the boundary; `PostHogProviderInner` renders `null`) fixes the blanking/remount defect; mandatory Playwright GDPR network gate (Gemini + Codex).
- 16-07 deploy check asserts `vendor-react` present AND `vendor-posthog` absent, targeting `.planning/PROJECT.md` (Gemini + Codex).
- 16-02 decodes the gzip/base64 visualizer payload before the sensitive-data scan; 16-04 threat register matches the function-form `scheduler`-inclusive matcher (Codex — both were cycle-2 hygiene items, now folded).

### Agreed Concerns
- **Verification/evidence-capture integrity is still the residual risk axis.** Codex raises two NEW HIGHs (both empirically confirmed); Gemini did not scan for them but does not contradict them. The architecture is sound; the failure mode is a verify command that falsely blocks a correct PERF-03 build (NEW HIGH A) and an evidence-capture command that loses the PERF-07 Lighthouse scores (NEW HIGH B).

### Divergent Views
- **Overall risk: Gemini LOW vs Codex MEDIUM.** Gemini reasons from the prior-HIGH closure (all 7 resolved → LOW). Codex reasons from the two new execution defects it found by scanning the re-plan. Because both new defects were empirically reproduced, the execution risk is Codex's MEDIUM: as written, Task 7 of 16-03 would falsely fail a correct implementation, and Task 2 of 16-07 would discard the per-route Lighthouse evidence (and break its own verify gate).

### HIGH Concerns — Status (2 NEW UNRESOLVED; 7 prior FULLY RESOLVED)

**All 7 prior HIGHs are FULLY RESOLVED** (verified this pass): #1 build:analyze, #2 D-09 env var, #3 shell-verification correctness (the cycle-2 residual — now closed), #4 Suspense blanking, #5 mandatory GDPR gate, #6 16-07 deploy assertion, #7 16-07 PROJECT.md path. These are closed and NOT counted as open HIGHs.

**2 NEW HIGHs remain UNRESOLVED (raised this cycle, empirically verified, no fix landed yet):**

1. **16-03-PLAN.md:435 — runtime-import invariant grep is a false-negative.** The unanchored pattern `from .@/lib/posthog.` matches `posthog-facade`, and the `grep -v posthog-facade` filter is filename-level not line-level, so a CORRECT PERF-03 implementation yields `3` against the asserted `= "1"` — the automated Task 7 gate would block a correct build. **Fix:** anchor the matcher (`grep -rn "from ['\"]@/lib/posthog['\"]" src/`) so `-facade` cannot match, and assert the single match is `PostHogProviderInner.tsx`.

2. **16-07-PLAN.md:122-123 — Lighthouse stdout log is teed into a directory `audit-mobile.sh:28` deletes mid-run.** Reproduced: only `EXIT_CODE=0` survives in the committed log; the `=== Summary ===` block and all 5 per-route Performance scores are lost — destroying the PERF-07 evidence the phase exists to produce AND failing Task 2's own verify (line 133). **Fix:** tee to a `mktemp` path outside `.planning/closure/artifacts/lighthouse/`, append `EXIT_CODE` there, copy the complete log into place after the script finishes, and `git add -f` (or relocate it out of the gitignored subtree per the MEDIUM below).

### Recommended next step
Re-plan with `/gsd:plan-phase 16 --reviews` to fold the two NEW HIGH fixes plus the supporting MEDIUM/LOW items:
- **HIGH A (16-03 Task 7):** anchor the runtime-import grep so `@/lib/posthog-facade` cannot match the `@/lib/posthog` invariant; assert the single surviving match is `PostHogProviderInner.tsx`.
- **HIGH B (16-07 Task 2):** capture `audit-mobile.sh` stdout to a `mktemp` outside the `rm -rf`-ed `artifacts/lighthouse/` dir, then copy into place after the script exits.
- **MEDIUM (16-07 / .gitignore:49):** relocate the committed `audit-mobile.stdout.log` outside the gitignored `lighthouse/` subtree (e.g. directly under `.planning/closure/`) or require `git add -f`; otherwise the evidence log is silently never committed.
- **LOW (16-06):** state the admin-login precondition for the Admin-link hover smoke (the link is `isAdmin`-gated).
- **LOW (16-04):** align the objective wording (`react + react-dom only`) with the executable task that correctly includes `scheduler`.
