---
phase: 16
reviewers: [gemini, codex]
reviewed_at: 2026-05-28T05:04:36Z
plans_reviewed: [16-01-PLAN.md, 16-02-PLAN.md, 16-03-PLAN.md, 16-04-PLAN.md, 16-05-PLAN.md, 16-06-PLAN.md, 16-07-PLAN.md]
attempted_but_failed: [cursor]
cycle: 6
---

# Cross-AI Plan Review — Phase 16: UIDN-02 Aggressive Perf-Budget Pass (Cycle 6 — Re-Review)

> **Re-review cycle.** Cycle 5 raised TWO NEW HIGHs (16-03 Task 5 precheck `PostHogProvider` substring-matched the new `PostHogProviderInner`; 16-03 Task 5 swapped source imports to `@/lib/posthog-facade` but did not re-point the existing `vi.mock('@/lib/posthog')` tests) plus a NEW MEDIUM (16-06 missed the second `MobileNav` `/admin` preload opt-out) and a NEW LOW (16-07 lacked a stray-root-`PROJECT.md` check). The plans were re-planned at commit `508b609` to fold all four. This pass independently re-checks whether each cycle-5 finding is now FULLY RESOLVED, and scans the re-planned files for NEW defects.
>
> Reviewers invoked: **gemini**, **codex**. `claude` skipped (this review ran inside Claude Code — self-review excluded for independence). `cursor` attempted but FAILED (usage-limit error: "You've hit your usage limit" — consistent with cycles 2–5; excluded to avoid blocking). `coderabbit` not applicable (it reviews the git working tree/diff, which is clean for a plan-stage review).
>
> **All four cycle-5 findings were independently verified FULLY RESOLVED by BOTH reviewers and confirmed empirically against the live repository this pass.** Gemini raised two NEW HIGHs that were empirically DISPROVEN against the actual plan bytes (a claimed "pervasive leading-space defect" and a "triple-quote syntax error") — see Verification Notes. Codex raised no new HIGH; its NEW MEDIUM (5 additional stale `@/lib/posthog` test mocks beyond the two named files) was empirically reproduced and is real.

## Gemini Review

### Summary (Cycle 6)
The architectural logic is sound and all four cycle-5 findings are logically resolved. Gemini then asserted a pervasive formatting/syntax defect (leading spaces in string literals; an escaping error in a verify command) that it rated HIGH. **Independently verified against the live plan bytes this pass: those two NEW HIGHs are FALSE POSITIVES — the cited strings do not exist, and the line Gemini flagged as a broken command is prose, not a runnable command (the real verify command one line below uses correct `'\''…'\''` shell escaping).**

### Prior-Finding Resolution (Gemini)

| Finding | Status | Proof (Plan:Line) |
|---|---:|---|
| HIGH (cycle-5) 16-03 Task 5 precheck substring-match | FULLY RESOLVED | `16-03-PLAN.md:346` + verify `:442` use anchored patterns `usePostHog\(`, `from 'posthog-js/react'`, `<PostHogProvider\b`. |
| HIGH (cycle-5) 16-03 missing test-mock updates | FULLY RESOLVED | `16-03-PLAN.md` Task 5 actions (j)/(k) re-point `vi.mock` + import in `AuthContext.test.tsx` and `ConsentContext.test.tsx` to `@/lib/posthog-facade`. |
| MEDIUM (cycle-5) 16-06 MobileNav preload opt-out | FULLY RESOLVED | `16-06-PLAN.md:10` adds `MobileNav.tsx` to scope; `:157-170` adds `preload={false}`. |
| LOW (cycle-5) 16-07 stray-root-`PROJECT.md` check | FULLY RESOLVED | `16-07-PLAN.md:237` adds `test ! -e PROJECT.md` to the automated verify. |

### Strengths (Gemini)
- 16-01 D-09 production guard checks both `CONTEXT` and `NETLIFY_CONTEXT`; mutex preserves `sentryVitePlugin` last-position invariant.
- 16-02 includes the decoded base64/gzip sensitive-data treemap scan.
- 16-03 sibling-loader pattern (Task 4) correctly fixes the router-blanking bug; mandatory Playwright network gate (Task 6) gives empirical GDPR proof.
- 16-04 boundary-anchored function-form matcher `/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/` correctly excludes `@tanstack/react-router`, `@radix-ui/*`.
- 16-05 logo-render-site precheck + zero-CLS width/height attributes.
- 16-06 Task 2 verify loop checks ALL layout files for the `/admin` preload opt-out.
- 16-07 zsh-safe `PIPESTATUS` capture + `rm -rf` race mitigation + correct stray-`PROJECT.md` check.

### Concerns (Gemini) — both NEW HIGHs DISPROVEN this pass
- **HIGH (Gemini) — "pervasive leading-space defect in search/replace strings" (claimed at 16-03:384,388,396,401,407 and 16-06:104,110). → FALSE POSITIVE.** `grep -n "' @/lib" 16-03-PLAN.md 16-06-PLAN.md` returns ZERO matches; the cited line numbers do not contain the claimed strings (e.g. `16-03:384` is `<files>e2e/tests/posthog-consent-gate.spec.ts</files>`; `16-06:104` is prose about the second `/admin` Link). Hallucinated; no action.
- **HIGH (Gemini) — "triple-quote syntax error in Task 7 verify at 16-03:435". → FALSE POSITIVE.** `16-03:435` is the `(b)` done-criterion **prose** ("Verify with: (1) `grep -rln …`"), not a runnable command. The ACTUAL automated verify is `16-03:442`, which uses the correct `test "$(grep -rln "from '\''@/lib/posthog'\''" src/)" = "src/components/PostHogProviderInner.tsx"` form. `grep "'''" 16-03-PLAN.md` returns ZERO matches — no triple-quote sequence exists. No action.
- MEDIUM (Gemini) — `PATTERNS.md:120` shows `import * as posthog from '@/lib/posthog-facade'` while the facade exports a named `posthog` object; 16-03 Task 5 (h) correctly uses `import { posthog }`. Doc-vs-plan inconsistency, not a plan defect; low risk an implementer follows PATTERNS over the explicit plan. (Doc-hygiene only.)

### Risk Assessment (Gemini): HIGH — but predicated entirely on the two NEW HIGHs that were empirically disproven this pass. Corrected effective read: NONE of Gemini's HIGHs survive verification.

---

## Codex Review

### Summary (Cycle 6)
All four cycle-5 findings are FULLY RESOLVED. No new HIGH found. Remaining risk is verification/scope hygiene: additional stale `@/lib/posthog` test mocks beyond the two named files (MEDIUM), and a few evidence-generation/automation gaps + stale prose (LOWs).

### Prior-Finding Resolution (Codex)

| Finding | Status | Proof (Plan:Line) |
|---|---:|---|
| 16-03 Task 5 precheck substring-match | FULLY RESOLVED | Anchored patterns at `16-03:346`; rationale at `:157/:435/:483/:494`. |
| 16-03 context tests not repointed | FULLY RESOLVED (two named tests) | `files_modified` includes both tests `16-03:14-15`; repoint at `:363-365`; verify asserts no `@/lib/posthog` ref at `:371`. See NEW MEDIUM for tests beyond those two. |
| 16-06 MobileNav `/admin` preload | FULLY RESOLVED | In scope `16-06:10`; both surfaces `:16`; `preload={false}` added `:157-170`; verify loops all layout `/admin` links `:176`. |
| 16-07 stray-root-`PROJECT.md` | FULLY RESOLVED | Targets `.planning/PROJECT.md` `:10/:29-30/:229-232`; `test ! -e PROJECT.md` at `:237`; output confirms no stray root `:285`. |

### Strengths (Codex)
- 16-03 correct sibling-Suspense architecture (`:170-190`); anchored consumer audit (`:346`); strong runtime-import invariant (`:435-442`); required Playwright gate (`:382-425`).
- 16-04 boundary-anchored function matcher (`:81-85`); `vendor-posthog` absent from initial HTML (`:94-99`); keeps `rolldownOptions` (`:79`).
- 16-05 PNG fallback + dimensions preserved (`:95-100`); render-site enumeration (`:91`); build verifies both assets (`:126-133`).
- 16-06 MobileNav fix explicit + verified (`:157-180`); full e2e enforced (`:197-203`).
- 16-07 production-only checkpoint (`:99-114`); zsh/`set -e`-safe stdout capture (`:125-137`); `.planning/PROJECT.md` path + root-stray guard (`:229-237`).

### Concerns (Codex)
- **MEDIUM — 16-03 leaves 5 other stale `vi.mock('@/lib/posthog')` tests out of scope.** Task 5 names only `AuthContext.test.tsx` + `ConsentContext.test.tsx`, but the live tree has additional mocks in tests that mount `ConsentProvider`/`AuthProvider`: `auth/auth-provider.test.tsx:29`, `contexts/AuthContext.verifyingRef.test.tsx:23`, `components/ConsentBanner.test.tsx:4`, `components/ConsentChip.test.tsx:4`, `components/ConsentMutualExclusion.test.tsx:4`. These likely don't FAIL today (the facade queues calls), but their mocks no longer intercept the production import path after the swap. Add a verify like `! rg "vi\.mock\('@/lib/posthog'" src/__tests__` or explicitly justify any remaining mocks. **(Empirically reproduced this pass — see Verification Notes.)**
- **LOW — 16-02 mandatory sensitive-data scan not in automated verify** despite `autonomous: true` (`16-02:100-101` captures only the treemap + asset table; scan specified at `:68-94`). Add the Python scan (incl. `decoded N payload blob(s)` + `CLEAN`) to automated verification or split into its own task.
- **LOW — 16-07 evidence-append verify can false-pass an incomplete section** (`:213-214` greps heading/verdict + tails the file; the 5-row score table at `:187-196` is not asserted). Add a check for all five route rows + verdict/branch consistency.
- **LOW — 16-06 objective/output prose is stale** ("Companion change" singular / "Two files edited" at `:40-45`) after MobileNav was added to scope (`:7-10`). Not execution-blocking; fix wording.
- LOW — 16-01 objective mentions only `NETLIFY_CONTEXT` (`:40`) while the real guard is broader (`CONTEXT` + `NETLIFY_CONTEXT`). Wording only.

### Risk Assessment (Codex): MEDIUM — prior high-risk blockers largely resolved; no new HIGH. Residual risk is verification/scope hygiene (stale mocks beyond the two named files; evidence checks that can pass without proving full artifact contents).

---

## Verification Notes (empirical, this pass)

All four cycle-5 findings verified FULLY RESOLVED. Gemini's two NEW HIGHs were reproduced-against and DISPROVEN. Codex's NEW MEDIUM was reproduced and confirmed real.

### Cycle-5 HIGH A (16-03 precheck substring) — FULLY RESOLVED
`16-03-PLAN.md:346` precheck and `:442` automated verify both use `grep -rnE "usePostHog\(|from 'posthog-js/react'|<PostHogProvider\b" src/`. The `<PostHogProvider\b` word-boundary anchor does not match `<PostHogProviderInner` (no boundary before `Inner`); the import-specifier and hook-call anchors don't match the new loader's import lines. The prose criteria at `:157/:435/:483/:494` were all updated to the anchored form. CLOSED.

### Cycle-5 HIGH B (16-03 test-mock scope) — FULLY RESOLVED (for the two failing tests)
`16-03-PLAN.md:14-15` `files_modified` now lists `src/__tests__/contexts/AuthContext.test.tsx` + `src/__tests__/contexts/ConsentContext.test.tsx`; Task 5 actions (j)/(k) re-point both `vi.mock(...)` and the `ConsentContext.test.tsx:6` top-level `import { posthog }` to `@/lib/posthog-facade`; the automated verify (`:442`/Task-5 verify `:371`) asserts neither test references bare `@/lib/posthog` and both reference `@/lib/posthog-facade`. CLOSED for the two tests that would actually break. (See NEW MEDIUM for the broader mock surface.)

### Cycle-5 MEDIUM (16-06 MobileNav) — FULLY RESOLVED
Live tree confirms `MobileNav.tsx:58` has a second `<Link to="/admin">` with NO `preload` attribute today. `16-06-PLAN.md:10` adds `MobileNav.tsx` to `files_modified`; `:157-170` adds `preload={false}` to that link; `:176` verify loops over EVERY layout file containing `to="/admin"` and fails if any lacks `preload={false}`. CLOSED.

### Cycle-5 LOW (16-07 stray PROJECT.md) — FULLY RESOLVED
`16-07-PLAN.md:237` automated verify begins `test ! -e PROJECT.md || { echo "STRAY root PROJECT.md exists…"; exit 1; }`; the row edit targets `.planning/PROJECT.md` (line 263) on both PASS and DEFER paths. CLOSED.

### Gemini NEW HIGH #1 (space defect) — DISPROVEN (non-defect)
`grep -n "' @/lib" 16-03-PLAN.md 16-06-PLAN.md` → ZERO matches. The lines Gemini cited do not contain the claimed strings (`16-03:384` = `<files>…</files>`; `16-03:388` = prose; `16-06:104` = prose). There is no leading-space-after-quote anywhere in either plan. Hallucination; NOT counted.

### Gemini NEW HIGH #2 (triple-quote syntax error at 16-03:435) — DISPROVEN (non-defect)
`16-03:435` is the `(b)` done-criterion PROSE ("Verify with: (1) `grep -rln …`"), not a runnable command. The ACTUAL `<automated>` verify is `16-03:442` and uses the correct `test "$(grep -rln "from '\''@/lib/posthog'\''" src/)" = "src/components/PostHogProviderInner.tsx"` escaping. `grep "'''" 16-03-PLAN.md` → ZERO matches; no triple-quote sequence exists. Misread prose as a command + hallucinated escaping defect. NOT counted.

### Codex NEW MEDIUM (5 stale `@/lib/posthog` mocks) — REPRODUCED (real)
`grep -rn "vi.mock('@/lib/posthog'" src/__tests__` returns SEVEN files; 16-03 Task 5 re-points only TWO (`AuthContext.test.tsx`, `ConsentContext.test.tsx`). The remaining FIVE — `auth/auth-provider.test.tsx:29`, `contexts/AuthContext.verifyingRef.test.tsx:23`, `components/ConsentBanner.test.tsx:4`, `components/ConsentChip.test.tsx:4`, `components/ConsentMutualExclusion.test.tsx:4` — mock the OLD `@/lib/posthog` specifier and mount `ConsentProvider`/`AuthProvider`. After the source swap to `@/lib/posthog-facade`, those mocks no longer intercept the production path. They likely still PASS (the facade queues calls, so unmocked calls are inert no-ops rather than throwing), which is why this is MEDIUM not HIGH — but the mocks become dead/non-intercepting, a latent hazard. Fix: re-point all 7 (or add `! rg "vi\.mock\('@/lib/posthog'" src/__tests__` to the verify and justify any intentional remainders).

---

## Consensus Summary

Both reviewers agree the **four cycle-5 findings (2 HIGH + 1 MEDIUM + 1 LOW) are FULLY RESOLVED** — independently confirmed empirically this pass. The architecture (sibling-loader `PostHogGate`, facade-only client, env-gated visualizer/Sentry mutex, boundary-anchored `manualChunks`, zero-CLS `<picture>` swap, single-run Lighthouse per D-13) is sound across all seven plans.

The reviewers DIVERGE on new HIGHs: **Gemini** rated overall risk HIGH on the basis of two NEW HIGHs (a "pervasive space defect" and a "triple-quote syntax error"), **both of which were empirically DISPROVEN against the actual plan bytes** (the cited strings do not exist; the flagged "command" is prose and the real command escapes correctly). **Codex** found NO new HIGH and rated overall risk MEDIUM, raising one real NEW MEDIUM (5 stale `@/lib/posthog` test mocks beyond the two named files) and three LOWs (16-02 scan not automated; 16-07 evidence row-count not asserted; 16-06 stale singular prose). Codex's read is the accurate one — Gemini's HIGHs do not survive verification.

**Net: zero unresolved HIGH concerns this cycle.**

### Agreed Strengths
- All four cycle-5 fixes verified resolved: 16-03 anchored precheck, 16-03 two-test mock re-point, 16-06 MobileNav opt-out, 16-07 stray-`PROJECT.md` guard (both reviewers).
- Empirical GDPR network gate (Playwright against the production preview) as the load-bearing PERF-03 proof (both reviewers).
- 16-04 boundary-anchored function-form `manualChunks` (not broad substring) (both reviewers).
- 16-03 runtime-import invariant + `vendor-posthog`-absent-from-`index.html` deterministic HTML assertion (both reviewers).
- 16-01 D-09 production guard (both `CONTEXT` + `NETLIFY_CONTEXT`) preserving the `sentryVitePlugin`-last invariant (both reviewers).
- 16-02 base64/gzip-decoding treemap secret scan; 16-05 zero-CLS width/height (Gemini + Codex respectively).

### Agreed Concerns
- **Verification/scope completeness remains the only residual risk axis** — and it is now MEDIUM, not HIGH. The single material item is the scope-completeness MEDIUM: the source import swap to `@/lib/posthog-facade` is mirrored in only 2 of the 7 dependent test mocks; the other 5 become non-intercepting. (Codex surfaced + reproduced; Gemini did not scan for it but does not contradict it.)

### Divergent Views
- **Overall risk: Gemini HIGH vs Codex MEDIUM.** Gemini's HIGH rests entirely on two NEW HIGHs that this pass empirically disproved (hallucinated space defect; prose misread as a broken command). Codex scanned the re-planned files against the live `src/` tree, found no HIGH, and surfaced a real MEDIUM. Because Gemini's HIGHs do not survive byte-level verification, the accurate effective risk is Codex's MEDIUM.

### HIGH Concerns — Status (0 unresolved this cycle)

**FULLY RESOLVED (verified this pass, NOT counted as open):** both cycle-5 NEW HIGHs (16-03 precheck substring-match; 16-03 two-test mock scope) + the cycle-5 MEDIUM (16-06 MobileNav) + the cycle-5 LOW (16-07 stray-`PROJECT.md`) — plus, by transitive carry-over verified in prior cycles, the cycle-4 NEW HIGH (16-07 indented-summary regex), both cycle-3 NEW HIGHs (16-03 grep false-negative; 16-07 tee-into-deleted-dir), and all 7 cycle-1 HIGHs.

**DISPROVEN this cycle (NOT counted as open — empirically shown to be non-defects):** Gemini's "pervasive space defect" HIGH and Gemini's "triple-quote syntax error" HIGH. Neither corresponds to an actual byte in the plans.

**0 HIGHs remain UNRESOLVED.** No new genuine HIGH was raised this cycle.

### Recommended next step
The 2 cycle-5 HIGHs are fully folded and no genuine new HIGH exists. The plans are execution-ready from a HIGH-severity standpoint. OPTIONAL polish (re-plan or fix-in-flight during execution) for the one real MEDIUM + three LOWs:
- **MEDIUM (16-03 test-mock scope):** re-point ALL 7 `vi.mock('@/lib/posthog')` test files to `@/lib/posthog-facade` (currently 2 of 7 are in scope), or add `! rg "vi\.mock\('@/lib/posthog'" src/__tests__` to the Task 5 verify and justify any intentional remainders.
- **LOW (16-02):** add the base64/gzip sensitive-data scan to the automated verify (or split it into its own task) so the `autonomous: true` run actually executes the mandatory scan.
- **LOW (16-07):** assert the 5-route score table (all route rows present + verdict matches the selected PASS/DEFER branch) in the evidence-append verify.
- **LOW (16-06):** correct the stale objective/output prose ("Companion change" singular / "Two files edited") to reflect the three-file scope.
- Gemini's two HIGHs require NO action (empirically disproven, non-defects); the Gemini PATTERNS.md:120 MEDIUM is doc hygiene (plan text is already correct).
