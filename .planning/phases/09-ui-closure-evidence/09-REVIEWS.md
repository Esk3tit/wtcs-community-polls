# Phase 9: UI Closure Evidence — Plan Review

## Summary
The implementation plans for Phase 9 are exceptionally thorough, well-structured, and strictly aligned with the project's "Hygiene & Polish" mandate. The strategy correctly prioritizes documentation reconciliation (UIDN-04) as a prerequisite for the visual audit (UIDN-03), ensuring the "ground truth" of the design system matches the shipped artifacts before validation occurs. The use of a standalone, re-runnable audit harness under `.planning/closure/` respects the project's $0 budget and avoids polluting the production `package.json`. The plans maintain the project's high engineering standards by utilizing atomic commits for "flip" operations and following the established Phase 7 `OBSV-02` closure-evidence patterns.

## Strengths
- **Pragmatic Testing Strategy:** The "Two-pass Playwright" approach (Prod for unauth routes, Local Preview for auth routes) is a brilliant trade-off. It allows for authentic performance/UI metrics on public pages while avoiding the significant complexity of Discord OAuth simulation or token-leaking in production.
- **Strict Scope Guarding:** The plans rigorously adhere to the `ROADMAP SC #5` scope guard. By reconciling the `Maia` vs. `new-york` discrepancy through documentation (ADR-001) rather than a component restyle, the phase remains a hygiene task rather than a feature/refactor task.
- **Automation where appropriate:** Using `gsd-tools` for `CLAUDE.md` regeneration and `jq` for Lighthouse score extraction minimizes human error in documentation.
- **Defensive Scripting:** The audit scripts include "local-server probes" (Pitfall 5) and accumulation of failures (Pitfall 1), ensuring that the audit process is robust and provides maximum diagnostic data even if individual routes fail.
- **Atomic-per-row Flips:** Following the Phase 7 precedent for `PROJECT.md` Key Decisions ensures that the state of the codebase always matches the committed evidence, preventing "stale state" windows.

## Concerns
- **Lighthouse Variance (LOW):** As noted in Pitfall 1, Lighthouse scores can be flaky. The plan correctly adopts the `D-14` "ship anyway + document" policy, but if scores are significantly lower than expected (e.g., < 80), it may signal a real regression that needs more than just a footnote.
- **Manual Checklist Load (LOW):** The 84-cell matrix in Plan 04 is a high-volume manual task. While the `human-verify` checkpoint is appropriate, the operator will need to be diligent to ensure consistency across the 7-route × 12-item grid.
- **`npx` Network Dependency (LOW):** Relying on `npx lighthouse@latest` at runtime introduces a network dependency. If the auditor is in a restricted environment, this could fail. However, given the project's $0 budget constraint, this is a necessary trade-off to avoid `devDep` bloat.

## Suggestions
- **`audit-mobile.sh` fallback:** In `09-02-PLAN.md`, consider adding a check for `jq` in the script's preamble and providing a `brew install jq` hint if missing, as it's a hard dependency for the summary block.
- **Auth state verification:** In the `checkpoint:human-verify` for Plan 03, explicitly remind the operator that the `VITE_SUPABASE_ANON_KEY` must come from the **local** `supabase status` to ensure the session injection matches the local preview server.
- **Drift Disposition:** For Plan 04's "Drift findings" section, emphasize that "defer to v1.2" is the preferred disposition for any minor polish items found, to prevent Phase 9 from expanding into a "Phase 9.1" fix-loop.

## Risk Assessment
**Overall Risk: LOW**

The phase is almost entirely documentation and diagnostic tool orchestration. It touches zero application source code (`src/`), zero database migrations, and zero infrastructure configurations. The primary risks are operational (missing pre-requisites for the auth-pass) or administrative (inaccurate checklist filling), both of which are mitigated by clear `human-verify` checkpoints and the single-source-of-truth data blocks in the scripts. The dependency chain is correctly ordered, and the success criteria directly fulfill the ROADMAP requirements.


---

## Codex Review

## Summary

The plans are detailed and mostly aligned with the phase intent: UIDN-04 is documentation-only, UIDN-02 creates audit evidence, and UIDN-03 waits for canonical `new-york` reconciliation. The main risks are not in the doc edits; they are in the audit evidence path. As written, the plans may flip PROJECT.md rows to `✓ Good` even if thresholds or checklist findings fail, and they gitignore the very artifacts the phase says should be archived. The local-auth screenshot flow also needs a stricter setup because Vite bakes Supabase env vars at build time and the additive E2E seed is not applied by `supabase start` alone.

## Strengths

- UIDN-04 scope is well controlled: no `src/`, no `components.json`, no restyle.
- Atomic commits for evidence + PROJECT.md row flips are a good audit pattern.
- UIDN-03 correctly depends on UIDN-04 and UIDN-02.
- Reusing Playwright and the Phase 8 auth pattern is the right direction.
- Avoiding persisted storage-state JSON is good from a security standpoint.
- Lighthouse variance is acknowledged instead of pretending scores are deterministic.

## Concerns

- **HIGH: Artifact policy conflicts with closure evidence.** Plan 02 gitignores `.planning/closure/artifacts/{lighthouse,screenshots}/`, but UIDN-02 requires archived Lighthouse reports and screenshot evidence. If only markdown is committed, future reviewers cannot inspect the actual screenshots or reports.
- **HIGH: Local auth setup is incomplete.** `supabase start` does not apply `e2e/fixtures/seed.sql`; the repo documents a second seed step in [e2e/README.md](/Users/khaiphan/code/wtcs-community-polls/e2e/README.md:104). Also, Vite requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time in [src/lib/supabase.ts](/Users/khaiphan/code/wtcs-community-polls/src/lib/supabase.ts:4), but Plan 03 exports env after `npm run build && npm run preview`.
- **HIGH: Closure gates are too permissive.** Plan 03 allows row flip after threshold failures via a broad D-14 analogy. Plan 04 allows row flip with deferred drift. That can make `✓ Good` mean “known failing but documented,” which weakens the milestone.
- **MEDIUM: Production-only target is blurred.** The plans choose local-preview screenshots for authenticated admin routes. That is pragmatic, but it conflicts with the plain reading of D-03 unless explicitly ratified as “prod for public routes; local preview for authenticated subroutes.”
- **MEDIUM: Screenshot script can produce false positives.** It checks that PNGs exist, but not that auth routes actually rendered admin UI rather than `/`, an error page, or a loading state.
- **MEDIUM: Lighthouse version is not pinned.** The plans cite Lighthouse 13.2.0 but run `lighthouse@latest`, which undermines reproducibility.
- **MEDIUM: Per-run artifacts can accumulate.** The scripts do not clean artifact directories first, while acceptance checks rely on exact file counts.
- **LOW: Summary files are promised but not included in `files_modified` or commit steps.**
- **LOW: Some verification commands are brittle across shells and grep variants.**

## Plan Notes

### 09-01

Risk: **LOW**. This is the strongest plan. Add a branch/dirty-worktree preflight and verify the CLAUDE regeneration diff before committing, since generated blocks can change more than the single expected line.

### 09-02

Risk: **MEDIUM-HIGH**. The harness design is sound, but pin Lighthouse, add `jq`/Chrome preflight checks, clean artifact dirs before runs, and add DOM assertions for authenticated screenshots. Revisit the `.gitignore` decision: storage-state files should be ignored, but audit artifacts probably should not be if the goal is audit-clean closure.

### 09-03

Risk: **HIGH** as written. Fix the local-auth runbook: export Supabase env before build, apply the additive E2E seed, then build/preview from that same environment. Replace curl SPA checks with Supabase/Playwright assertions. Define which Lighthouse failures block closure versus which can be documented.

### 09-04

Risk: **MEDIUM**. The dependency ordering is right, but the checklist evidence needs tightening. If “84 cells with one-line notes” is required, the matrix template and acceptance checks should enforce it. Dark-mode parity should include at least a small committed dark-mode screenshot set or a clear documented manual record.

## Suggestions

- Decide artifact policy explicitly: commit sanitized Lighthouse reports and PNGs, or amend the requirement to “local artifacts + committed manifest with hashes, dimensions, and paths.”
- Pin `npx -y lighthouse@13.2.0`.
- Add preflight: branch name, clean relevant files, `jq`, Chrome, Supabase CLI, additive seed applied, env exported before build.
- Add screenshot assertions: expected URL/path, admin heading/form visible, no loading spinner, no auth redirect.
- Use stricter closure gates: A11y/BP/SEO misses and shadcn drift should block `✓ Good` unless a specific stakeholder decision says otherwise.
- Make Plan 03 depend on 09-01 if the locked phase order is meant literally.

## Overall Risk Assessment

**MEDIUM-HIGH**. The documentation reconciliation is low risk, but the audit/evidence plans currently have enough gaps that the phase could appear closed without durable artifacts or real pass evidence. Fixing artifact retention, local-auth setup, and closure-gating rules would bring the overall risk down to **LOW-MEDIUM**.


---

## CodeRabbit Review

_CodeRabbit reviews the working tree's git diff vs. base branch — 7 findings on the planning artifacts committed in this branch. Output is in coderabbit's prompt-only format (one finding per block) preserved verbatim below._

Starting CodeRabbit review in plain text mode...

Review directory: /Users/khaiphan/code/wtcs-community-polls

Connecting to review service
Setting up
Summarizing
Reviewing

============================================================================
File: .planning/phases/09-ui-closure-evidence/09-PATTERNS.md
Line: 94 to 97
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/09-ui-closure-evidence/09-PATTERNS.md around lines 94 - 97, AUTH_ROUTES contains a literal placeholder in the entry { path: '/admin/suggestions//edit', name: 'admin-suggestions-id-edit' } which will break navigation; update the docs to state that the  must be replaced with a real suggestion ID from test fixtures or the route must be resolved at runtime (e.g., fetch or create a suggestion before navigating), and add a short note referencing AUTH_ROUTES and the '/admin/suggestions//edit' path (place the note after the AUTH_ROUTES block or in the Method section) describing the exact approaches: replace with fixture ID, skip the route, or fetch/create an ID before navigation.

============================================================================
File: .planning/phases/09-ui-closure-evidence/09-PATTERNS.md
Line: 85
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/09-ui-closure-evidence/09-PATTERNS.md at line 85, The LOCAL_URL constant currently uses port 5173 but the document and e2e/playwright.config.ts reference port 4173; update the constant LOCAL_URL to use 'http://localhost:4173' so the pattern example (LOCAL_URL) aligns with the recommendation and the Playwright default; verify any nearby references to LOCAL_URL in this file are consistent with the 4173 preview port.

============================================================================
File: .planning/phases/09-ui-closure-evidence/09-03-PLAN.md
Line: 387
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/09-ui-closure-evidence/09-03-PLAN.md at line 387, The regex used in the grep command (grep -cE with the pattern ^\| [/].[0-9]) is correct but uses the unusual character class [/]; update the pattern to use a normal slash (e.g., ^\| /.[0-9] or escaped ^\| \/. [0-9]) in the grep invocation to improve style/readability—locate the literal pattern string ^\| [/].[0-9] in the file and replace it accordingly.

============================================================================
File: .planning/phases/09-ui-closure-evidence/09-RESEARCH.md
Line: 453 to 456
Type: nitpick

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/09-ui-closure-evidence/09-RESEARCH.md around lines 453 - 456, Replace the inconsistent jq key quoting by using bracket notation for the special-key path and keep other paths consistent: change the bp extraction that currently uses ."categories"."best-practices".score to use .categories["best-practices"].score (referencing the bp variable and its jq expression), and optionally standardize the other extractions (perf, a11y, seo) to either dot-notation or bracket-notation consistently across the four jq expressions for clarity.

============================================================================
File: .planning/phases/09-ui-closure-evidence/09-RESEARCH.md
Line: 488
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/09-ui-closure-evidence/09-RESEARCH.md at line 488, The LOCAL_URL constant is set to the Vite dev port but the decision uses the preview port; update the LOCAL_URL constant (LOCAL_URL = 'http://localhost:5173') to use the preview port ('http://localhost:4173') so examples match the Open Questions §3 resolution (ensure any references to LOCAL_URL elsewhere are consistent with the new port).

============================================================================
File: .planning/phases/09-ui-closure-evidence/09-RESEARCH.md
Line: 237 to 238
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/09-ui-closure-evidence/09-RESEARCH.md around lines 237 - 238, Update the inconsistent comments around AUTH_ROUTES and the $id placeholder to reflect the resolved decision: replace the runtime/administrative instructions ("pick a real $id", "capture admin list page, copy a card href", and "Replace  below at run time") with the agreed hardcoded fixture UUID d0000000-0000-0000-0000-000000000001 (or explicitly state these examples are intentionally pre-resolution), so references in the AUTH_ROUTES examples (the comment mentioning $id and the "Replace  below at run time" note) consistently use the fixture ID or clearly indicate they are illustrative only.

============================================================================
File: .planning/phases/09-ui-closure-evidence/09-RESEARCH.md
Line: 803
Type: potential_issue

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/09-ui-closure-evidence/09-RESEARCH.md at line 803, The current validation line after the shell loop is incorrect and unrelated to the loop output (the UIDN-02 check using the loop that echoes "MISSING: $w $n" and the file pattern .planning/closure/artifacts/bp-$w-$n.png); replace it so the loop's missing-file output is captured and causes failure when non-empty (e.g., assign the loop output to a variable and test if it's empty, printing and exiting non‑zero if not), or replace the whole loop with a find-based count check that asserts there are exactly 42 bp-*.png files; update the UIDN-02 entry to use one of these two valid approaches instead of the existing ls /tmp \| grep MISSING fragment.

Review completed: 7 findings ✔


---

## Cursor Review

## Plan Review: Phase 9 (`09-01` to `09-04`)

### `.planning/phases/09-ui-closure-evidence/09-01-PLAN.md`

**1) Summary**  
This is a strong, tightly scoped UIDN-04 reconciliation plan with good atomicity guarantees and clear anti-scope-creep boundaries. It correctly treats `components.json` as immutable ground truth, updates the two documented “losing surfaces,” and regenerates `CLAUDE.md` from source rather than hand-editing. The plan is execution-ready and directly unblocks UIDN-03 as intended.

**2) Strengths**
- Clear scope guard: docs-only, no `src/`, no restyle, no `components.json` edits.
- Correct ordering intent: UIDN-04 first, and explicitly unblocks UIDN-03.
- Strong atomicity: 3-surface flip in one commit, with explicit acceptance checks.
- Good consistency model: `PROJECT.md` as source of truth for `CLAUDE.md` regeneration.
- ADR block is concrete and auditable, including rationale and consequences.

**3) Concerns**
- **MEDIUM:** Commit execution is embedded in plan steps; if run in a parallelized wave with other plan files touching overlapping docs, atomic assumptions can break unless sequencing is strictly enforced.
- **LOW:** Acceptance check for ADR “5-section shape” is slightly brittle (`grep -c` for headings) and could pass with malformed structure if headings appear elsewhere.
- **LOW:** “Single atomic commit” is good, but there’s no explicit rollback/retry guidance if pre-commit hooks mutate files.

**4) Suggestions**
- Add a guard: “Do not execute 09-01 concurrently with any plan that edits `PROJECT.md` or `CLAUDE.md`.”
- Strengthen ADR validation with a targeted range check around `ADR-001` section.
- Add one verification line asserting `CLAUDE.md` design-system line exactly equals `PROJECT.md` line.

**5) Risk Assessment**  
**Overall risk: LOW.**  
The plan is precise, constrained, and aligned to phase goals. Residual risk is mostly procedural (concurrency/commit hygiene), not design quality.

---

### `.planning/phases/09-ui-closure-evidence/09-02-PLAN.md`

**1) Summary**  
This harness plan is technically detailed and mostly excellent, with robust re-runnability and thoughtful security posture. It implements the intended split (`audit-mobile.sh` + `audit-screenshots.mjs`) and enforces no `package.json` script creep. However, the `.gitignore` strategy conflicts with earlier milestone intent that artifacts are archived under `.planning/closure/artifacts/`, creating a governance mismatch that should be resolved explicitly.

**2) Strengths**
- Strong tooling design: top-of-file data blocks for routes/breakpoints/thresholds.
- Good Lighthouse behavior: run-all-routes + aggregate failures (no fail-fast).
- Good Playwright behavior: resize-then-goto, explicit local preflight probe.
- Security-aware auth pass: in-memory session injection, no persisted storage state.
- Explicitly avoids adding long-lived build wiring (`package.json`) per locked decision.

**3) Concerns**
- **HIGH:** `.gitignore` excludes lighthouse/screenshot artifacts, but phase context repeatedly says artifacts should be archived under `.planning/closure/artifacts/` as closure evidence. This is a direct policy inconsistency across documents.
- **MEDIUM:** `audit-screenshots.mjs` imports `@supabase/supabase-js`, but this plan doesn’t explicitly verify it exists in project dependencies (likely true, but should be enforced).
- **MEDIUM:** Hardcoding fixture password in script is acceptable for local fixture use, but embedding credentials in another file duplicates secret-like material and may normalize bad patterns.
- **LOW:** Command examples use `grep` heavily for acceptance checks; operationally fine, but some checks are brittle to harmless formatting changes.

**4) Suggestions**
- Resolve artifact strategy explicitly before execution: either  
  - commit selected artifacts (recommended for immutable closure evidence), or  
  - keep gitignored artifacts but commit checksums/summary exports plus reproducibility metadata.
- Add dependency check: `node -e "require.resolve('@supabase/supabase-js')"` in preflight.
- Replace hardcoded fixture password with import from a single source or env var fallback to reduce duplication drift.
- Add a manifest file (`artifacts/manifest.json`) capturing run timestamp, URLs, and file list to keep evidence auditable even if binaries are ignored.

**5) Risk Assessment**  
**Overall risk: MEDIUM.**  
Implementation quality is good, but artifact retention policy conflict is material and could undermine “closure evidence” credibility.

---

### `.planning/phases/09-ui-closure-evidence/09-03-PLAN.md`

**1) Summary**  
This UIDN-02 execution plan is comprehensive and correctly links harness run results to closure documentation plus the Mobile-first row flip. It handles human-gated prerequisites well and addresses Lighthouse variance with a documented disposition model. The main risks are operational: dependence on manual preflight and potential ambiguity if artifact binaries are ignored while evidence claims archival.

**2) Strengths**
- Correct dependency usage: depends on `09-02`, aligns to UIDN-04→UIDN-02→UIDN-03 order.
- Good preflight checkpoint with explicit operator steps and sanity checks.
- Strong evidence structure: frontmatter + method + score table + matrix + disposition + cross-refs.
- Atomic commit design for evidence + single PROJECT row flip is excellent.
- Explicit handling of `/admin` redirect interpretation is thoughtful and transparent.

**3) Concerns**
- **MEDIUM:** Relies on local human environment setup (`supabase start`, preview, env vars); failure modes are documented but still fragile for reproducibility.
- **MEDIUM:** If artifacts are gitignored, the closure file can reference non-versioned files, reducing long-term audit traceability.
- **LOW:** Status/sign-off wording assumes “closed” path; if multiple threshold misses occur, reviewers may challenge “ship-anyway analog” without a formal exception criterion.
- **LOW:** Uses temp files in `/tmp`; no fallback if multi-operator or nonstandard shell environment alters expected behavior.

**4) Suggestions**
- Add explicit exception threshold policy (e.g., “up to N minor misses allowed with rationale; otherwise reopen UIDN-02”).
- If artifacts remain ignored, embed key metric snapshots and hashes in the markdown for durable evidence.
- Add one command to validate all referenced artifact paths in the generated markdown before commit.
- Capture tool versions directly into the evidence file from command outputs, not static text.

**5) Risk Assessment**  
**Overall risk: MEDIUM.**  
Goal alignment is strong, but reproducibility/auditability risk depends on artifact retention decision and manual execution quality.

---

### `.planning/phases/09-ui-closure-evidence/09-04-PLAN.md`

**1) Summary**  
This UIDN-03 plan is well-structured and appropriately human-gated for visual/design consistency review. It correctly anchors to ADR-001 and ensures the second Key Decisions flip plus row relabeling happen atomically. The plan is likely to meet phase closure goals, but the matrix process is labor-intensive and may introduce subjective variance unless scoring guidance is tightened.

**2) Strengths**
- Correct dependency chain: depends on 09-01/02/03, preserving locked ordering.
- Good split of automated globals vs human visual checks.
- Strong closure semantics: 84-cell matrix, drift findings, and explicit dispositions.
- Atomic flip+relabel of shadcn row is exactly what’s needed for final table coherence.
- Clear no-restyle boundary retained despite deep checklist coverage.

**3) Concerns**
- **MEDIUM:** PASS/FAIL criteria for some visual items (especially radius and dark-mode parity) remain somewhat subjective between auditors.
- **MEDIUM:** Heavy human process (84 cells + manual dark-mode checks) is error-prone without a normalized rubric/examples.
- **LOW:** `grep`-based heuristics for icon/button/input checks can yield false positives/false negatives depending on component composition patterns.
- **LOW:** Drift handling is open-ended (“fix or defer per finding”) and may produce inconsistent closure rigor unless escalation rules are defined.

**4) Suggestions**
- Add explicit scoring rubric snippets for each visual item (what constitutes PASS/FAIL with concrete examples).
- Require a second reviewer sign-off only when any FAIL is present.
- Add a “minimum evidence” rule for each FAIL entry: route, file/symbol, screenshot path, disposition owner/date.
- Add a final integrity check ensuring both PROJECT rows are `✓ Good` before phase-close summary commit.

**5) Risk Assessment**  
**Overall risk: MEDIUM-LOW.**  
The plan is aligned and complete, with primary risk from subjective/human audit execution rather than technical design flaws.

---

## Cross-Plan Assessment (Overall)

### Summary
The four plans are high quality, deeply specified, and mostly aligned to the locked sequence and phase goal of flipping both Key Decision rows to `✓ Good`. The biggest cross-cutting risk is a policy inconsistency around artifact retention: some context says artifacts should be archived as evidence, while Plan 02/03 operationalize gitignored binaries. Resolve that explicitly before execution to avoid audit disputes later.

### Key Cross-Plan Risks
- **HIGH:** Evidence artifact retention contradiction (`archive under artifacts` vs `gitignored binaries`).
- **MEDIUM:** Manual execution burden and environment sensitivity in Plans 03/04.
- **LOW:** Over-specification brittleness in grep-based acceptance checks.

### Overall Risk Level
**MEDIUM.**  
Execution is likely to succeed technically, but closure credibility and reproducibility hinge on resolving the artifact retention policy mismatch and enforcing consistent human-audit rubric quality.


---

## Consensus Summary

### Agreed Strengths (2+ reviewers)

- **Scope discipline.** Gemini, Codex, and Cursor all praise the strict no-`src/`, no-`components.json`, no-restyle scope guard for UIDN-04. Plan 09-01's docs-only stance is well controlled.
- **Atomic commits for evidence + row flips** are flagged as a good audit pattern by Codex and Cursor (Phase 7 OBSV-02 precedent carried forward).
- **Intra-phase ordering** UIDN-04 → UIDN-02/UIDN-03 correctly encoded by waves and `depends_on` (all 4 reviewers acknowledge).
- **Reusing Phase 8 Playwright auth pattern** (in-memory addInitScript, no storageState JSON) is the right direction for security and reuse (Codex, Cursor).
- **Acknowledging Lighthouse variance** rather than pretending scores are deterministic — Codex calls this out as engineering honesty.

### Agreed Concerns (raised by 2+ reviewers — HIGHEST PRIORITY)

- **`HIGH` — Artifact retention vs. `.gitignore` conflict.** Both Codex and Cursor flag this: the phase's evidence/closure narrative says artifacts are "archived under `.planning/closure/artifacts/`," but Plan 09-02 Task 3 `.gitignore`s `.planning/closure/artifacts/{lighthouse,screenshots}/`. Closure rows would flip to ✓ Good citing artifacts that don't exist in version control. **Fix options:** (a) commit sanitized Lighthouse JSON + PNGs (count cost vs. repo-size budget); (b) keep gitignore, but commit a hash-pinned manifest file (`artifacts.lock.json` with sha256 + dimensions per artifact path) so the closure cite is auditable; (c) explicitly amend the requirement to "local artifacts + committed manifest."
- **`HIGH` — Closure-gating credibility.** Codex and Cursor both note the plans flip PROJECT.md rows to ✓ Good as part of the evidence-file commit, regardless of whether Lighthouse thresholds (Perf≥90 / A11y≥95 / BP≥95 / SEO≥90) actually pass or whether the 12×7 checklist matrix surfaces FAIL cells. **Fix:** Plans 09-03 + 09-04 should explicitly gate the row flip on `audit-mobile.sh` exit==0 AND zero FAIL cells in the matrix (or a stakeholder-signed override line in the evidence file). Otherwise a phase that fails its own thresholds can self-certify ✓ Good.
- **`MEDIUM` — Local-build auth pass setup is brittle.** Codex flags that Vite bakes Supabase env vars at build time, so `npm run preview` against `supabase start` won't see the additive E2E seed unless env is exported BEFORE the build. CodeRabbit independently flags the `/admin/suggestions/<id>/edit` placeholder `<id>` as broken navigation if not resolved at runtime. **Fix:** Plan 09-02 Task 2 should add a preflight step (verify env exported, supabase started, additive seed applied, build artifact fresh) AND Plan 09-04 Task 2 (or wherever the screenshot run happens) must hardcode the fixture UUID `d0000000-0000-0000-0000-000000000001` from RESEARCH Open Question 1 RESOLUTION, not leave `<id>` as a runtime substitution placeholder.
- **`MEDIUM` — `LOCAL_URL` port inconsistency.** CodeRabbit flags two locations (PATTERNS.md line 85, RESEARCH.md line 488) where `LOCAL_URL` still cites `5173` (Vite dev) instead of `4173` (Vite preview) — contradicting RESEARCH Open Question 3 RESOLUTION (`npm run preview, port 4173`). **Fix:** mechanical s/5173/4173 in the two cited locations.
- **`LOW` — Plan 09-03 should depend on 09-01 if the locked phase order is meant literally.** Codex notes that the ROADMAP intra-phase ordering says UIDN-04 → UIDN-02 → UIDN-03, but Plan 09-03's `depends_on` is `[09-02]` only, not `[09-01, 09-02]`. UIDN-02 doesn't cite the canonical preset (UIDN-03 does), so the ordering is technically respected — but the dependency graph doesn't enforce it. **Fix (optional):** add `09-01` to Plan 09-03's `depends_on` for explicit ordering parity.

### Reviewer-Specific (single source) Concerns Worth Investigating

- **Codex — Pin Lighthouse version.** `npx lighthouse` resolves to latest at run time; pin to `npx -y lighthouse@13.2.0` to avoid mid-audit version drift.
- **Codex — Add screenshot assertions.** Don't trust raw PNG capture; assert expected URL/path, admin heading visible, no loading spinner, no auth redirect for the /admin* auth pass.
- **CodeRabbit (RESEARCH.md line 803)** — UIDN-02 validation snippet `ls /tmp | grep MISSING` is wrong: the loop echoes "MISSING: $w $n" but the validation grep targets /tmp instead of capturing the loop output. Replace with a count assertion (`find .planning/closure/artifacts -name 'bp-*-*.png' | wc -l` exactly 42) or capture the loop output into a variable.
- **CodeRabbit (RESEARCH.md line 453-456)** — Inconsistent jq key quoting for `.categories["best-practices"].score` vs. dot-notation for the other three score paths. Standardize.
- **CodeRabbit (PATTERNS.md AUTH_ROUTES placeholder)** — `'/admin/suggestions/<id>/edit'` empty path will fail navigation. Needs the fixture UUID inline OR a runtime resolve.
- **Cursor — Over-specification brittleness in grep-based acceptance checks.** Some checks pin exact regex shapes that would tolerate cosmetic edits but break under formatting changes. Trade-off: precision vs. maintenance.
- **Cursor — Human-audit rubric quality.** The 12-item checklist has objective cells (color-contrast, ripgrep regex) and subjective cells (visual parity). The plan trusts the operator to fill 84 cells consistently; consider per-item PASS criteria notes.

### Divergent Views

- **Overall risk verdict spread is wide.** Gemini=LOW ("phase is almost entirely documentation and diagnostic tool orchestration") vs. Codex=MEDIUM-HIGH ("phase could appear closed without durable artifacts or real pass evidence"). The divergence centers on the artifact-retention and closure-gating questions: if those are tightened (manifest + threshold gate), Codex says risk drops to LOW-MEDIUM, converging with Gemini/Cursor.
