---
phase: 7
reviewers: [gemini, codex, cursor]
reviewed_at: 2026-04-30T00:36:00Z
plans_reviewed: [07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md, 07-VALIDATION.md]
round: 4
prior_reviews: [07-REVIEWS-v1.md, 07-REVIEWS-v2.md, 07-REVIEWS-v3.md]
disposition: SHIP (3-of-3 reviewers; 2 clerical fixes applied inline, no replan loop)
---

# Cross-AI Plan Review — Phase 7 (Round 4, post-replan-3)

This is the fourth cross-AI review. Round-1, Round-2, and Round-3 reviews live in their respective archived files. Reviewers were asked to verify Round-3 fixes were applied correctly AND identify NEW concerns, with explicit guidance to NOT invent fresh issues.

**Round-4 Verdict Summary:**

| Reviewer | Risk | Round-3 fixes status | New concerns | Ship? |
|----------|------|---------------------|--------------|-------|
| Gemini | **LOW** | All 10 RESOLVED | **None** | **SHIP** |
| Codex | **MEDIUM** (LOW after 2 patches) | 9 RESOLVED, 1 PARTIALLY-RESOLVED (gzip self-contradiction) | 2 MEDIUM (clerical) | Apply 2 patches, then ship |
| Cursor | **LOW** | All 10 RESOLVED | 1 LOW (commit-SHA placeholder) | **SHIP as-is** |

**Disposition:** SHIP. Codex's 2 clerical defects (Plan 03 gzip-template self-contradiction and missing 07-REVIEWS.md alias) **applied inline in commit `<round-4-commit>`**, plus the round-3 SHA placeholder `31c7d66` filled. NO further replan loop required.

---

## Gemini Review

This is the **Round 4 Review** of the Phase 7: Observability Hardening implementation plans.

### 1. Summary

The Round 3 revisions have been applied with meticulous attention to detail. The plans now correctly address every consensus and single-reviewer concern from the previous round, most notably the conversion of the local smoke gate check to a manual browser-based verification, which eliminates the false-positive risk of the prior `curl` approach. The technical mechanics—including the additive semantics of `Sentry.reactErrorHandler`, the use of `git worktree` for clean measurements, and the JSON-aware sourcemap inspection—are now robust and audit-ready. The `07-VALIDATION.md` strategy has been fully realigned with the execution plans.

**I have no new concerns. The plans are ready to ship.**

### 2. Round-3 Fix Verification

| Fix | Status | Evidence |
| :--- | :--- | :--- |
| **Fix 1:** Plan 02 Task 3 manual browser checkpoint | **RESOLVED** | Plan 02 Task 3 is now a `checkpoint:human-verify` with four specific visual/network assertions in a real browser. |
| **Fix 2:** 07-VALIDATION.md `--mode development` | **RESOLVED** | Row `07-01-T2` in the verification map now uses the `--mode development` flag for inspection builds. |
| **Fix 3:** Two-tier mechanism allowlist | **RESOLVED** | 07-VALIDATION.md and Plan 03 Task 1 Step C now explicitly define PRIMARY, SECONDARY, PARTIAL, and FAILURE tiers. |
| **Fix 4:** `scope.setTag` boundary count | **RESOLVED** | 07-VALIDATION.md `07-01-T1` and Plan 01 Task 1 AC now assert `scope.setTag` count >= 2. |
| **Fix 5:** `reactErrorHandler` is ADDITIVE | **RESOLVED** | Plan 01 Task 1 `read_first` and Step 2 comments cite the `@sentry/react` source and JSDoc confirming additive semantics. |
| **Fix 6:** Node fallback uses `JSON.parse` | **RESOLVED** | Plan 03 Task 1 Step G-17 Node fallback rewritten to use `JSON.parse(fs.readFileSync(...))`. |
| **Fix 7:** `git worktree` for release-sha inspection | **RESOLVED** | Plan 03 Task 1 Step G-14 now uses a temporary worktree instead of `git checkout` to avoid dirty tree collisions. |
| **Fix 8:** `ErrorInfo` export prose | **RESOLVED** | Plan 01 Task 1 Step 1 prose corrected to acknowledge export from both `react` and `react-dom/client`. |
| **Fix 9:** Unified gzip source (Vite column) | **RESOLVED** | Plan 03 Task 3 Step B-5 and `OBSV-02-bundle-delta.md` frontmatter now specify Vite's printed column as the single source of truth. |
| **Fix 10:** Sentry-string-rename escalation | **RESOLVED** | Plan 03 Task 1 Step C-7 and 07-VALIDATION.md include the explicit Khai-sign-off override rule for future Sentry renames. |

### 3. NEW Concerns

**None.**
The plans are technically sound, logically consistent, and provide a high-fidelity verification path for the OBSV requirements.

### 4. Suggestions

**None.**
The plans have been refined through three rounds of peer review and are currently at peak quality.

### 5. Risk Assessment

**Overall Risk: LOW**

The implementation is surgical and localized to bootstrap wiring and build configuration. The primary risks (deduplication behavior, identifier mangling, and environment masking) have been mitigated with specific, re-runnable verification patterns. The use of temporary worktrees and plugin-disabled builds ensures that the evidence captured for the audit record is mechanically accurate and reproducible.

### 6. Ship Recommendation

**Execution is recommended.** All Round-3 items are resolved, and the plans provide a comprehensive closure path for the v1.1 observability requirements.

_Reviewer: Gemini_
_Round: 4 (Final)_
_Disposition: **SHIP**_

---

## Codex Review

### Summary

I reviewed the actual workspace plan files. The Round-3 substantive fixes are mostly applied correctly: the SPA curl gate was replaced with a real browser checkpoint, validation now uses the two-tier mechanism rule, `reactErrorHandler` semantics are documented, and the Plan 03 mechanics are much tighter. I found no new OBSV-01/OBSV-02 implementation-design concerns. I did find two execution/documentation blockers that should be patched before running the plans.

### Round-3 Fix Verification

| Fix | Status | Evidence |
|---|---|---|
| Plan 02 Task 3 is blocking manual browser checkpoint, not curl assertion | RESOLVED | `07-02-PLAN.md:368`, `431`, `433`; curl remains only as preview health check. |
| `07-VALIDATION.md` replaced `SENTRY_AUTH_TOKEN=` pattern with `--mode development` | RESOLVED | `07-VALIDATION.md:22`, `57`; old string appears only as historical "replaced" prose. |
| `07-VALIDATION.md` mechanism rule is two-tier | RESOLVED | `07-VALIDATION.md:24`, `86`: PRIMARY `auto.function.react.*`, solo `generic` PARTIAL, `auto.browser.*` FAILURE. |
| Validation uses `scope.setTag('boundary', 'app-root')` count, not `reactErrorHandler >= 3` | RESOLVED | `07-VALIDATION.md:23`, `56`. |
| Plan 01 confirms `reactErrorHandler` is ADDITIVE by source citation | RESOLVED | `07-01-PLAN.md:75`, `188`. |
| Plan 03 Node fallback uses `JSON.parse(fs.readFileSync())` | RESOLVED | `07-03-PLAN.md:247`, also noted at `79`. |
| Plan 03 release-SHA inspection uses `git worktree`, not `git checkout` | RESOLVED | `07-03-PLAN.md:220-223`. |
| Plan 01 prose says `ErrorInfo` is exported from both `react` and `react-dom/client` | RESOLVED | `07-01-PLAN.md:201`. |
| Plan 03 Task 3 uses only Vite's printed gzip column | PARTIALLY-RESOLVED | The method chooses Vite's gzip column (`07-03-PLAN.md:492`, `498`, `533`), but the closure-doc template still includes literal `find ... xargs ... gzip` text while acceptance requires zero such matches (`07-03-PLAN.md:626`, `637`). |
| Plan 03 has Sentry string rename escalation rule | RESOLVED | `07-03-PLAN.md:182`, `280`, `466`. |

### NEW Concerns

- **MEDIUM — `07-REVIEWS.md` is referenced but does not exist in the workspace.**
  The plans and validation repeatedly reference `.planning/phases/07-observability-hardening/07-REVIEWS.md`, but the directory contains `07-REVIEWS-v1.md`, `07-REVIEWS-v2.md`, and `07-REVIEWS-v3.md`; no `07-REVIEWS.md`. This can break `@.../07-REVIEWS.md` context loading during execution. Fix by either copying/renaming `07-REVIEWS-v3.md` to `07-REVIEWS.md` or updating references to `07-REVIEWS-v3.md`.

- **MEDIUM — Plan 03 gzip-method verification is self-contradictory.**
  The plan correctly makes Vite's printed gzip column the source of truth, but the output template still tells the executor to include explanatory `find ... | xargs gzip ...` text, while the acceptance check requires `grep -c "find.*xargs.*gzip..."` to return `0`. A correct closure doc can fail its own verification.

### Suggestions

- Add the missing `07-REVIEWS.md` alias or update all references to `07-REVIEWS-v3.md`.
- In Plan 03 Task 3, remove the literal forbidden gzip command from the generated closure-doc template, or change the grep to detect only an "accepted alternative method" phrase rather than any historical mention.
- Fill the `{round-3 commit SHA}` placeholder in `07-VALIDATION.md` after commit; low priority.

### Risk Assessment

Overall risk is **MEDIUM as-is**, but only because of execution/doc-contract issues, not because of the OBSV design. After the two small patches above, risk drops to **LOW**. The core capture-path and symbolication plans are ready.

### Ship Recommendation

Do not run another full review cycle. Apply the two clerical fixes, then execute Phase 7. Another substantive revision pass would not add proportional value.

---

## Cursor Review

### Summary

Round-3 fixes are applied correctly across `07-01-PLAN.md`, `07-02-PLAN.md`, `07-03-PLAN.md`, and `07-VALIDATION.md`. The key blockers from Round 3 (vacuous curl gate and validation drift) are genuinely resolved, and the remaining updates (ADDITIVE `reactErrorHandler` semantics, Node fallback fix, worktree safety, single gzip source-of-truth, rename escalation policy) are present and internally consistent. I see no new material risk to OBSV-01/OBSV-02 execution.

### Round-3 Fix Verification

| Fix | Status | Evidence |
|---|---|---|
| Plan 02 Task 3 is manual checkpoint, not curl proof | **RESOLVED** | `07-02-PLAN.md` has `<task type="checkpoint:human-verify" gate="blocking">` and explicit browser/DevTools assertions; curl is only used for preview health check. |
| `07-VALIDATION.md` uses `--mode development` (not `SENTRY_AUTH_TOKEN=` pattern) | **RESOLVED** | Per-task row `07-01-T2` now uses `npx vite build --mode development` and explains plugin disable behavior. |
| `07-VALIDATION.md` mechanism logic is two-tier | **RESOLVED** | Manual-only mechanism row defines PRIMARY / PARTIAL / FAILURE semantics and blocks solo `generic`. |
| `07-VALIDATION.md` moved from `reactErrorHandler` count to boundary tag assertion | **RESOLVED** | Per-task row `07-01-T1` uses `grep -c "scope.setTag('boundary', 'app-root')"... >= 2` and explicitly says old count rule was replaced. |
| Plan 01 confirms ADDITIVE `reactErrorHandler` semantics via source citation | **RESOLVED** | `07-01-PLAN.md` Round-3 table cites `@sentry/react` source + d.ts JSDoc and states no replacement/silencing behavior. |
| Plan 03 Node fallback uses `JSON.parse(fs.readFileSync())` | **RESOLVED** | `07-03-PLAN.md` Round-3 LOW-1 section and command snippet use JSON parse fallback; old `require('./$f')` called out as removed. |
| Plan 03 release-sha inspection uses `git worktree`, not `git checkout` | **RESOLVED** | `07-03-PLAN.md` explicitly instructs temporary worktree for release SHA inspection and cleanup. |
| Plan 01 prose says `ErrorInfo` exported from both `react` and `react-dom/client` | **RESOLVED** | `07-01-PLAN.md` Round-3 LOW-3 language states both exports exist; canonical import remains from `react`. |
| Plan 03 Task 3 uses only Vite printed gzip column | **RESOLVED** | `07-03-PLAN.md` marks Vite gzip column as SINGLE source-of-truth and states the legacy `find` → `xargs` → `gzip` pipeline was removed. |
| Plan 03 includes Sentry string rename escalation rule | **RESOLVED** | `07-03-PLAN.md` includes explicit LOW-5 override/escalation policy with required recording in `07-VERIFICATION.md`. |

### NEW Concerns

- **LOW (non-blocking):** `07-VALIDATION.md` still contains a literal placeholder in the Round-3 alignment note: `{round-3 commit SHA — leave placeholder; will be filled when this revision is committed}`.
  - Impact: documentation polish/traceability only; no effect on execution quality.

### Suggestions

- Fill the Round-3 commit SHA placeholder in `07-VALIDATION.md` when the revision commit exists.
- Otherwise, no further plan changes needed before execution.

### Risk Assessment

**Overall risk: LOW.**
The prior consensus HIGH/MEDIUM issues are addressed with concrete procedural corrections, and the verification logic now matches SPA/runtime realities and Sentry semantics.

### Ship Recommendation

Execute **as-is**.
Another revision pass is unlikely to add proportional value; this is ready to ship into execution.

---

## Consensus Summary

All three reviewers confirm Round-3 fixes correctly applied. Two clerical defects identified by Codex (with one corroborated by Cursor as LOW) — both fixed inline in this review's commit. **No replan loop triggered.**

### Agreed Round-3 Resolutions (3-of-3)

- Plan 02 Task 3 curl-assertion → manual browser checkpoint (`<task type="checkpoint:human-verify" gate="blocking">`).
- 07-VALIDATION.md drift fully refreshed (SENTRY_AUTH_TOKEN, mechanism allowlist, scope.setTag count).
- reactErrorHandler ADDITIVE confirmed by source citation (`@sentry/react/build/esm/error.js:90-105`).
- 5 LOW fixes correctly applied (Node fallback, git worktree, ErrorInfo prose, Vite gzip column, Sentry rename escalation).

### Clerical Defects (fixed inline this commit)

1. **Plan 03 closure-doc template self-contradiction** (Codex MEDIUM). Closure-doc template at lines 533, 540, 550, 614 contained literal `find ... xargs ... gzip` text inside the template that the executor copies; acceptance grep at line 637 requires zero such matches. Template would fail its own verification.
   - **Fix applied:** Removed the literal alternative-method strings from the template prose at those lines. The template now states "Vite's printed per-chunk gzip column is the single source of truth per D-13" without naming the alternative. Audit-trail justification (mentioning the alternative in PLAN-level prose) remains untouched — only the closure-doc TEMPLATE was sanitized.

2. **Missing `07-REVIEWS.md` canonical filename** (Codex MEDIUM). The plan files reference `@.../07-REVIEWS.md` for cross-loading; the directory only had `-v1.md`, `-v2.md`, `-v3.md`. Auto-resolved by writing this round-4 REVIEWS at the canonical path.

3. **`{round-3 commit SHA}` placeholder in VALIDATION.md** (Cursor LOW). Filled with `31c7d66` (the round-3 replan commit). Cross-reference also updated from `07-REVIEWS.md` to `07-REVIEWS-v3.md` to point at the round-3 review (this round-4 doc is the new `07-REVIEWS.md`).

### NEW Material Concerns

**None.** Two reviewers explicitly stated they have no new concerns; Codex's two MEDIUMs are clerical (template hygiene + missing alias), not substantive.

---

## Disposition

**SHIP.** All three reviewers recommend execution. Codex's two clerical defects fixed inline this commit; no replan loop required.

The plans have now survived four rounds of independent cross-AI peer review. Round 1 caught wiring + verification rigor concerns. Round 2 caught two HIGHs (Sentry env tag + sourcemap deletion). Round 3 caught the curl-SPA vacuity HIGH. Round 4 confirmed clean — only two clerical defects remained, both fixable inline.

Further review rounds are unlikely to add proportional value for OBSV-01 / OBSV-02 outcomes. Ship to execution.

```
/clear
/gsd-execute-phase 7
```
