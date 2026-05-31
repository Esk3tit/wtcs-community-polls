---
phase: 17
cycle: 2
reviewers: [gemini, codex, cursor]
reviewed_at: 2026-05-30T23:30:00Z
plans_reviewed: [17-01-PLAN.md, 17-02-PLAN.md]
prior_cycle_high: 2
current_high: 0
---

# Cross-AI Plan Review — Phase 17 (Cycle 2)

> **Re-review cycle.** Cycle 1 raised two HIGH concerns (`files_modified` omitted the generated
> `17-0x-SUMMARY.md` outputs; Plan B overstated dialog-ARIA behavioral coverage) and one MEDIUM
> (DOCS-06 frontmatter/body status drift). All three were addressed in the revised plans. This
> cycle confirms resolution and surfaces only MEDIUM/LOW tightening items — no new HIGH concerns.

## Gemini Review

This is a **SECOND CYCLE** review. The plans have been revised to address the concerns raised in the prior review (missing SUMMARY outputs, overstated ARIA verification, and status drift in DOCS-06).

### 1. Summary
The revised plans for Phase 17 are exceptionally thorough and successfully resolve all "High" and "Medium" concerns from the previous cycle. **Plan A** now correctly accounts for live-state drift in the planning archives, ensuring a reconciled and consistent "retrospective" status across both frontmatter and body text. **Plan B** has been significantly strengthened by acknowledging the lack of existing snapshot tests and substituting them with a mandatory behavioral ARIA assertion in the admin test suite. This turns a previously "trust-based" verification into an empirical one. The level of prescription regarding UI decisions (vertical insets and heading semantics) ensures a high-quality, consistent implementation.

### 2. Strengths
- **Empirical ARIA Verification:** Plan B now explicitly adds a `findByRole` assertion to the behavioral test suite, providing actual proof that the Card migration doesn't break Radix dialog semantics.
- **State-Aware Auditing:** Plan A's "Read First" and "Audit-before-edit" instructions are critical for projects with active planning archives where the reality on disk often drifts from the initial context.
- **Decision Finality:** The plans no longer defer styling (vertical padding) or accessibility (heading landmarks) to "executor discretion," instead providing clear defaults (py-0) and requiring documented rationale for deviations.
- **Contextual Accuracy:** Identifying the mis-count of SUMMARY files (15 vs 17) demonstrates a deep understanding of the project's current state.
- **Zero-Snapshot Strategy:** Correctly identifying the absence of `.snap` files prevents the executor from attempting to create unwanted artifacts and shifts focus to behavioral green-light verification.

### 3. Concerns & Status of Prior Issues

| Prior Concern | Severity | Status | Resolution Detail |
| :--- | :--- | :--- | :--- |
| **1. Missing SUMMARY files** | HIGH | **RESOLVED** | Both 17-01 and 17-02 plans now include their respective SUMMARY.md files in `files_modified`. |
| **2. Overstated ARIA verification** | HIGH | **RESOLVED** | Plan B Task 3 now adds `admins-tab.test.tsx` to `files_modified` and implements a real `findByRole('dialog')` assertion. |
| **3. DOCS-06 Status Drift** | MEDIUM | **RESOLVED** | Plan A Task 2 explicitly requires reconciling BOTH frontmatter and body status lines to `retrospective`. |

**New Concerns:**
- **LOW (Plan B):** The "Recommended default" for Card vertical padding is `py-0`, but the plan still allows the executor to choose the native `py-6` if they document it. While the ambiguity is low, ensuring the *first* component migration sets the standard for the other two is key for consistency.

### 4. Suggestions
- **Plan B (Consistency):** Explicitly state that the decision made for `AdminsList` (Task 1) regarding `py-0` vs `py-6` MUST be mirrored in `CategoriesList` and `PromoteAdminDialog` to prevent a fragmented UI.
- **Plan A (Audit Log):** In Task 1, since you expect zero edits to the 15 SUMMARY files, ensure the machine-readable audit block in the final output clearly lists every file and its status to make the "Zero Edits" claim easily auditable.

### 5. Risk Assessment: LOW
The risk is minimal. Both plans are additive or cosmetic. Plan A's changes are confined to the `.planning/` directory, while Plan B's UI changes are protected by a strengthened behavioral test suite and explicit CSS constraints. No schema or Edge Function changes are in scope. The "NIL" risk classification in the roadmap is appropriate.

**Verdict: Approved for execution.**

---

## Codex Review

### Summary
The revised plans materially address the prior review blockers. Plan A is now audit-aware, reconciles live document drift, and includes its generated summary output. Plan B no longer overclaims ARIA coverage; it adds a real runtime dialog-role assertion and correctly includes the test and summary outputs in scope. I see no remaining HIGH blockers. The main residual risks are execution-quality issues: Plan B's `py-0` recommendation is slightly wrong for the live Card primitive, and Plan A's hardest doc task still depends heavily on manual factual accuracy.

### Strengths
- Both plans now include their expected `17-0x-SUMMARY.md` outputs in `files_modified`.
- Plan B explicitly adds `admins-tab.test.tsx` for the new dialog ARIA assertion instead of pretending existing tests cover it.
- Plan A correctly handles the existing `03-VERIFICATION.md` state drift by changing both frontmatter and body status.
- The plans are read-first, state-aware, and mostly avoid blind rewrites.
- Parallel split is sound: Plan A is Markdown-only, Plan B is code/test-only.
- No new dependencies, schema changes, Edge Functions, or production data-flow changes.

### Concerns
- **Prior HIGH — RESOLVED: `files_modified` omitted generated summaries.** Plan A now lists `17-01-SUMMARY.md`; Plan B lists `17-02-SUMMARY.md`.
- **Prior HIGH — RESOLVED: Plan B overstated ARIA behavioral coverage.** The plan now states the current test only uses duplicate text matching at `admins-tab.test.tsx:112`, and requires adding `findByRole('dialog', { name: /promote admin/i })`.
- **Prior MEDIUM — RESOLVED: Plan A DOCS-06 frontmatter/body status drift.** The existing file has both `status: resolved` and `**Status:** resolved` at `03-VERIFICATION.md:4`; the plan now requires changing both.
- **MEDIUM — Plan B's recommended `py-0` Card handling is wrong for header cards.** Live `Card` owns vertical padding via `py-6`, while `CardHeader` only has `px-6` (`card.tsx:10`, `card.tsx:23`). Applying `py-0` to `AdminsList`/`CategoriesList` will remove top padding around the header, despite the plan saying "CardHeader keeps its own padding." That can create a visible regression.
- **MEDIUM — Plan A DOCS-08 factual accuracy is still under-verified.** The v1.1 MILESTONES entry is the hardest doc artifact, but the automated gate mostly checks headings/order/no placeholders. Wrong PR counts, decision outcomes, or deferred-item wording could still pass.
- **LOW — Plan B intentionally drops `<h2>` semantics.** The plan documents the tradeoff, but losing section heading navigation is still an accessibility regression unless explicitly accepted. A cheap compromise would preserve semantics with `role="heading" aria-level={2}` on `CardTitle`.
- **LOW — Plan A has minor count/prose drift.** It says "Up to 6 modified Markdown files," but including `17-01-SUMMARY.md` makes the possible total 7.

### Suggestions
- In Plan B, replace the blanket `py-0` recommendation with: `AdminsList`/`CategoriesList` use `pt-6 pb-0` (preserve header top spacing, flush bottom rows); `PromoteAdminDialog` `py-0` is fine (no header).
- Add a Plan B acceptance check that the header spacing was visually inspected or captured in test output summary.
- For CardTitle semantics, either preserve heading semantics with `role="heading" aria-level={2}` or state the a11y regression is explicitly accepted.
- Strengthen Plan A DOCS-08 by requiring a source-map table in `17-01-SUMMARY.md`: section → source file(s) → counts/PR refs/decision rows verified.
- Fix the Plan A "up to 6 files" prose to include the generated summary.

### Risk Assessment
**Overall risk: LOW to MEDIUM.** There are no remaining HIGH plan blockers and no production/security risk. Plan A's risk is mostly archival accuracy. Plan B's risk is cosmetic/a11y regression from Card spacing and heading semantics. With the `py-0` correction and a stronger DOCS-08 source-verification note, both plans should be safe to execute.

---

## Cursor Review

### 1. Summary
The revised plans are materially stronger than cycle 1 and are **ready to execute** with only minor tightening. All three prior review findings are addressed **in plan text and gates**: SUMMARY outputs are listed in `files_modified`, DOCS-06 explicitly reconciles frontmatter **and** body status, and Plan B stops claiming existing dialog-ARIA coverage—instead it adds a behavioral `getByRole('dialog')` assertion and lists `admins-tab.test.tsx` in scope. Live-repo checks confirm the plans' grounding (no `.snap` files, no dialog-role tests today, `03-VERIFICATION.md` still has dual `resolved` status, all 15 pre-Phase-05 SUMMARYs already populated or confirmed-empty). Remaining risk is concentrated in **manual doc curation quality** (v1.1 MILESTONES entry, migration auth-path narrative) and **visual layout drift** from shadcn Card defaults (`gap-6`, `py-6`), not in plan structure or scope gates.

### 2. Strengths
- **Prior-review feedback integrated precisely** — Each HIGH/MEDIUM item from cycle 1 has an explicit fix, verify gate, and acceptance criterion rather than narrative hand-waving.
- **Live-state awareness** — Plans read current files first (VALIDATION already `complete`, DOCS-07 likely zero-edit audit, 15 not 17 SUMMARYs, no snapshots).
- **`files_modified` self-consistency** — Both plans now include their `17-0x-SUMMARY.md` outputs; Plan B also includes the test file it will modify.
- **DOCS-06 status reconciliation is complete on paper** — Task 2 requires both YAML `status:` and body `**Status:**` → `retrospective`, with automated negated checks for lingering `resolved`.
- **ARIA claim corrected and made testable** — Plan B accurately states the current test only uses `getAllByText(/promote admin/i)` and mandates `findByRole('dialog', { name: /promote admin/i })`.
- **Snapshot myth debunked** — Plan B's CRITICAL TEST REALITY block matches repo reality and re-scopes D-11 to behavioral-green + lint + tsc.
- **Card migration guidance is executor-ready** — Preserve lists, `@/` import convention, CardAction grid pattern, explicit decisions recorded in SUMMARY.
- **Parallel-safe split (D-09)** — File sets are truly disjoint.
- **Automated verify gates are concrete** — Grep/awk checks for every deliverable.

### 3. Concerns

| Prior concern | Status | Notes |
|---------------|--------|-------|
| **HIGH:** `files_modified` omitted `17-0x-SUMMARY.md` | **RESOLVED** | Plan A lists `17-01-SUMMARY.md`; Plan B lists `17-02-SUMMARY.md`. |
| **HIGH:** Plan B overstated ARIA behavioral coverage | **RESOLVED** | Plan adds assertion in Task 3, includes `admins-tab.test.tsx`, greps for it. Codebase confirms no dialog-role tests today. |
| **MEDIUM:** DOCS-06 frontmatter/body status drift | **RESOLVED** | Task 2 action + acceptance + verify gate all require both locations flip. |

**New concerns:**
- **MEDIUM — Phase-level doc drift outside the plans.** ROADMAP success criterion #4 still references `vitest --update-snapshots`; ROADMAP/REQUIREMENTS/PROJECT still say "17 SUMMARY." Plans correct this internally but do not update parent artifacts. Phase-close verification against ROADMAP could falsely fail or confuse executors.
- **MEDIUM — Card `gap-6` layout risk not explicitly decided.** Plan addresses `py-6` but `Card` also ships `gap-6` between `CardHeader` and `CardContent` (`card.tsx:10`). Without an explicit `gap-0`/`gap-4` decision, sections may look more spaced than today even with `py-0`.
- **MEDIUM — DOCS-08 content quality is gate-light.** Task 3 automated verify checks headings/order/placeholders—not factual accuracy of stats, PR refs, counts, or graded outcomes.
- **MEDIUM — Subsequent evolution migration curation is manual and error-prone.** No automated gate validates auth-relevance classifications (mitigated by SUMMARY recording the classification table).
- **LOW — D-05 still over-claims `aria-labelledby` in prose.** The new test proves `role="dialog"` + accessible name; it does not assert `aria-labelledby` directly.
- **LOW — Demote dialog ARIA asymmetry.** Demote flow test checks copy only, not `getByRole('dialog')`.
- **LOW — v1.2 template heading parenthetical may be dropped** (`### Known Tech Debt (not v1.2-caused)` vs generic grep).
- **LOW — UI-SPEC still references nonexistent snapshot paths** (Plan B overrides via CRITICAL TEST REALITY; PLAN > UI-SPEC).
- **LOW — Plan A may ship a very small Markdown diff** (DOCS-05/07 likely zero edits).

### 4. Suggestions
1. Add one sentence to each plan's verification block noting parent ROADMAP/REQUIREMENTS language is stale; phase success is governed by the PLAN's gates.
2. Extend the Card vertical-inset decision to `gap-*` in Plan B (e.g. `py-0 gap-0`).
3. Tighten Plan A Task 3 verify to grep v1.2-specific heading text (`Known Tech Debt (not v1.1-caused)`, `Issues Deferred to v1.2+`).
4. Plan B Task 3: prefer **augment** over replace in the promote-dialog test.
5. Plan A Task 2 output: require the SUMMARY's per-migration table to list **omitted** migrations explicitly.
6. Optional LOW follow-up: add demote-dialog `getByRole('dialog')` in a future hygiene pass.

### 5. Risk Assessment
**Overall: LOW**

| Area | Level | Justification |
|------|-------|---------------|
| Production / security | LOW | Markdown-only + presentational React re-wrap; no schema/EF/auth/dependency changes. |
| Test regression | LOW | Behavioral admin tests + full suite; new dialog assertion closes the prior HIGH gap. |
| Documentation accuracy | MEDIUM (localized) | v1.1 MILESTONES + migration narrative depend on human judgment; gates are structural. |
| UI / a11y regression | LOW–MEDIUM | Structural Card swap with explicit preserve lists; residual is visual spacing + accepted `<h2>` tradeoff. |
| Plan execution / self-gates | LOW | Prior self-fail modes fixed; parallel plans file-disjoint. |

**Verdict:** Approve for execution. No blocking HIGH concerns remain from cycle 1; new items are tightening and parent-doc alignment, not plan redesign.

---

## Consensus Summary

All three reviewers (Gemini, Codex, Cursor) independently confirm the revised plans are **approved for execution** with an overall **LOW** risk. The cycle-1 concerns are unanimously resolved, and no reviewer raised a new HIGH concern.

### Prior-cycle HIGH/MEDIUM resolution (unanimous)
- **HIGH (cycle 1) — `files_modified` omitted `17-0x-SUMMARY.md`:** FULLY RESOLVED by all 3. Plan A line 14, Plan B line 12 now list the generated SUMMARY outputs; both plans' verification sections treat SUMMARY as an expected output.
- **HIGH (cycle 1) — Plan B overstated dialog-ARIA coverage:** FULLY RESOLVED by all 3. Plan B Task 3 now ADDS a real `findByRole('dialog', { name: /promote admin/i })` assertion to `admins-tab.test.tsx` (now in `files_modified`), with accurate "this plan ADDED the assertion" wording and a verify-gate grep that checks the assertion exists.
- **MEDIUM (cycle 1) — DOCS-06 frontmatter/body status drift:** FULLY RESOLVED by all 3. Plan A Task 2 reconciles BOTH the frontmatter `status:` and the body `**Status:**` line to `retrospective`, with negated grep checks against lingering `resolved`.

### Agreed Strengths
- Cycle-1 feedback integrated precisely — each item has a fix + verify gate + acceptance criterion.
- Strong live-state awareness (audit-before-edit; 15-not-17 SUMMARY count; no `.snap` files; VALIDATION already `complete`).
- `files_modified` self-consistency restored; the "no files outside files_modified" gate should now pass.
- Parallel-safe two-plan split (D-09) with truly disjoint file sets.
- Concrete automated verify gates throughout.

### Agreed Concerns (new this cycle — all MEDIUM/LOW, non-blocking)
- **[MEDIUM — Codex + Cursor] Card spacing defaults under-specified.** The `py-0` recommendation removes the header's top padding (Codex: prefer `pt-6 pb-0` for the two header cards), and `Card`'s `gap-6` between header and content is not explicitly decided (Cursor: add a `gap-*` decision). Real but cosmetic; both reviewers note it is execution-quality, not a blocker. `PromoteAdminDialog` (no header) is fine with `py-0`.
- **[MEDIUM — Codex + Cursor] DOCS-08 (v1.1 MILESTONES) factual accuracy is gate-light.** The automated gate checks headings/order/placeholders, not stat/PR-ref/graded-outcome correctness. Recommended mitigation: a source-map table in `17-01-SUMMARY.md`.
- **[MEDIUM — Cursor] Parent-doc staleness.** ROADMAP criterion #4 (`vitest --update-snapshots`) and the "17 SUMMARY" wording in ROADMAP/REQUIREMENTS/PROJECT are stale; the plans correct this internally but do not update the parent artifacts.
- **[LOW] `<h2>` → CardTitle heading-landmark drop** is documented and accepted; Codex offers `role="heading" aria-level={2}` as an optional preservation.
- **[LOW] `aria-labelledby` not directly asserted** (the new test proves role + accessible name, which validates the label chain indirectly).

### Divergent Views
- **Overall risk band:** Cursor and Gemini call it **LOW**; Codex calls it **LOW–MEDIUM** (weighting the Card-spacing and DOCS-08 accuracy items slightly higher). The divergence is about residual execution-quality polish, not plan validity — all three approve execution.
- **`py-0` correctness:** Codex flags the blanket `py-0` recommendation as wrong for the two header cards (would strip header top padding); Gemini treats it only as a LOW consistency nit. Worth adopting Codex's `pt-6 pb-0` refinement for `AdminsList`/`CategoriesList`.

### Recommended pre-execution fixes (all non-blocking)
1. Refine the Card vertical-inset guidance: `pt-6 pb-0` (or `py-0 gap-0` with header padding restored) for `AdminsList`/`CategoriesList`; `py-0` for `PromoteAdminDialog`. Add a `gap-*` decision.
2. Add a DOCS-08 source-map table requirement to `17-01-SUMMARY.md` (section → source → counts/PR refs verified).
3. Note in each plan's verification block that parent ROADMAP/REQUIREMENTS language is stale and the PLAN's gates govern.
4. (Optional) Fix Plan A's "up to 6 files" prose to account for the generated SUMMARY (now up to 7).
