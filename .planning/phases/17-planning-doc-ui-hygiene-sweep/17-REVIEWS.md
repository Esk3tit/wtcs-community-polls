---
phase: 17
reviewers: [gemini, codex, cursor]
reviewed_at: 2026-05-30T22:07:34Z
plans_reviewed: [17-01-PLAN.md, 17-02-PLAN.md]
---

# Cross-AI Plan Review — Phase 17

Reviewers invoked: **Gemini**, **Codex** (gpt-5.5), **Cursor**. (Claude skipped — this review ran inside Claude Code, skipped for reviewer independence. OpenCode and Qwen not installed.)

## Gemini Review

This review covers **Plan A (Doc hygiene sweep)** and **Plan B (UI Card migration)** for Phase 17.

### 1. Summary
The plans for Phase 17 are exceptionally well-structured and reflect a deep understanding of the project's current state and technical debt. Plan A adopts a prudent "audit-then-reconcile" strategy to handle state drift in the planning archives, ensuring accuracy without unnecessary churn. Plan B executes a precise structural refactor of the admin UI, correctly identifying the absence of snapshots in the repository and re-scoping verification to behavioral integrity. Both plans strictly adhere to the established architectural decisions (D-01 through D-12) and maintain high standards for accessibility and documentation.

### 2. Strengths
*   **State Drift Awareness:** Plan A's requirement to read live files first (Task 1 & 2) prevents regression or "blind overwrites" of already-partially-backfilled documentation.
*   **Accurate Scope Analysis:** Task 1 correctly identifies that there are 15 SUMMARY files in the v1.0 archives, resolving the "17 SUMMARY" mis-count found in the original phase goals.
*   **Technical Precision:** Plan B's detailed composition of the `Card` primitive (using `CardAction` for header buttons and `p-0` for full-bleed rows) ensures high-quality UI output that matches the project's visual target.
*   **Pragmatic Re-scoping:** Plan B's adjustment regarding the lack of `.snap` files—pivoting to behavioral test green-status—avoids wasted effort attempting to update non-existent artifacts.
*   **Accessibility Focus:** Task 3 in Plan B explicitly verifies the survival of Radix-applied ARIA roles in the `PromoteAdminDialog`, mitigating risks to screen-reader support during the structural swap.

### 3. Concerns
*   **Task 3 Verify Command (Plan B):** [LOW] The verification command `npx tsc -b && npm run lint && npm run test` runs the *entire* test suite. While thorough, this may be time-consuming in the final task.
*   **Card Vertical Padding (Plan B):** [LOW] The plan notes that `py-6` lives on the `Card` itself. When combined with `p-0` on `CardContent` for full-bleed rows, the top/bottom rows will have a 24px gap from the border. If the design requires true edge-to-edge verticality, the `py-6` on `Card` may need an override (e.g., `py-0`), though the plan defers this to "Claude's Discretion" based on the live render.

### 4. Suggestions
*   **Plan B Task 1/2 Refinement:** In `AdminsList` and `CategoriesList`, consider adding `pt-0` or `pb-0` to the `CardContent` if the live render shows excessive whitespace between the `CardHeader` and the first list item when using the full-bleed pattern.
*   **Plan A Milestone Name:** For DOCS-08, ensure the v1.1 milestone name "Hygiene & Polish" is used consistently in the header, as it's the primary name used in the ROADMAP.

### 5. Risk Assessment: LOW
*   **Justification:** The changes are either purely documentation (Plan A) or cosmetic structural swaps in role-gated admin components (Plan B). No business logic, schema migrations, or public-facing data flows are modified. The reliance on existing behavioral tests and a manual ARIA audit provides sufficient safety gates for the UI migration.

---

## Codex Review

## Overall

Both plans are well-scoped and mostly achieve Phase 17 goals. The biggest recurring issue is metadata/gate inconsistency: both plans require creating a `17-0x-SUMMARY.md` file but omit that file from `files_modified`, while also asserting no files outside `files_modified` may change. Plan B also overclaims existing ARIA test coverage.

## Plan A

### Summary

Plan A is a strong doc-hygiene plan with good live-state awareness and a conservative audit-first approach. It should close DOCS-05 through DOCS-08, but it needs tighter verification and corrected metadata before execution.

### Strengths

- Correctly treats DOCS-07 as an audit-confirm task, not unnecessary churn.
- Handles the 15-summary reality instead of chasing the roadmap's stale "17 SUMMARY" wording.
- Good "read live file first" guidance, especially for existing `03-VERIFICATION.md`.
- v1.1 `MILESTONES.md` parity requirements are explicit and anchored to the v1.2 template.
- NIL production risk classification is accurate.

### Concerns

- **HIGH:** `files_modified` omits `.planning/phases/17-planning-doc-ui-hygiene-sweep/17-01-SUMMARY.md`, but the output requires creating it. The plan's own "no files outside files_modified" gate would fail.
- **MEDIUM:** DOCS-07 automated verification does not assert `n == 15` or detect SUMMARY files missing `requirements-completed:` entirely.
- **MEDIUM:** "Decision traceability" mislabels D-06 as the Phase 03 Migration 14 narrative; D-06 is the v1.1 MILESTONES structural parity decision.
- **LOW:** The v1.1 parity verification only greps a subset of required headings. It does not enforce all nine parity sections or absence of placeholders.
- **LOW:** The "migrations 3–9 touched auth path" claim should be carefully sourced per migration to avoid overbroad retrospective wording.

### Suggestions

- Add `17-01-SUMMARY.md` to `files_modified`, or explicitly exempt generated plan summaries from the "no files outside" gate.
- Strengthen DOCS-07 verification to assert exactly 15 summaries, exactly 15 `requirements-completed:` declarations, and zero unconfirmed empty lists.
- Correct the D-06 traceability text.
- Add explicit greps for all nine v1.1 parity headings and a placeholder check such as `rg 'TBD|<\.\.\.|TODO' .planning/MILESTONES.md`.
- For `Subsequent evolution`, list migration numbers with names and only claim "auth-path" where the source supports it.

### Risk Assessment

**LOW.** This is Markdown-only work with no production path. The main risks are audit-truth drift and execution-gate false failures, not runtime regressions.

## Plan B

### Summary

Plan B is a solid structural UI migration plan and accurately targets the flagged admin containers. It preserves most behavior well, but it needs accessibility tightening, clearer visual-layout intent around shadcn Card defaults, and corrected summary-file metadata.

### Strengths

- Correctly uses the repo's `@/components/ui/card` import convention.
- Preserves important behavioral hooks like skeleton test IDs, error alerts, dialogs, handlers, and labels.
- Correctly avoids per-row Cards and snapshot work that does not exist.
- Good consolidation gate with `tsc`, lint, and full test suite.
- Security scope is appropriately limited: no dependencies, schema, auth, or data-flow changes.

### Concerns

- **HIGH:** `files_modified` omits `.planning/phases/17-planning-doc-ui-hygiene-sweep/17-02-SUMMARY.md`, but the output requires creating it. This also weakens the "code-only" claim.
- **MEDIUM:** Replacing `<h2>` with local `CardTitle` loses semantic heading markup because `CardTitle` renders a `div` in `card.tsx`.
- **MEDIUM:** The plan says the behavioral suite asserts runtime dialog ARIA, but current admin tests only assert text/opening behavior, not `getByRole('dialog')`, accessible name, or `aria-labelledby`.
- **MEDIUM:** There is tension between "native Card styling" and "rows full-bleed to card border": the Card primitive has `py-6` and `gap-6`, so `CardContent className="p-0"` alone only solves horizontal padding.
- **LOW:** Categories aria-label preservation is under-specified. There are more than four relevant icon-button labels, including edit-row save/cancel labels.
- **LOW:** Behavioral tests will not catch visual regressions from the Card spacing change.

### Suggestions

- Add `17-02-SUMMARY.md` to `files_modified`, or define plan summaries as allowed out-of-band artifacts.
- Preserve heading semantics, for example by keeping an `h2` inside `CardTitle` or adding an equivalent accessible heading.
- Add one focused test after opening Promote Admin dialog: `screen.getByRole('dialog', { name: /promote admin/i })`, plus an `aria-labelledby` assertion if stable.
- Make the Card spacing decision explicit: native vertical padding accepted, or targeted `Card` class override accepted. Do not leave it to executor discretion if D-03 is strict.
- Update Categories acceptance criteria to preserve all existing icon-button aria labels.
- Add a lightweight visual/manual check for the Admins and Categories tabs after migration.

### Risk Assessment

**LOW to MEDIUM.** Production/security risk is low because this is presentational and well-tested behaviorally. The medium portion is accessibility and visual-regression risk, mainly from heading semantics, unverified dialog ARIA claims, and Card spacing ambiguity.

---

## Cursor Review

# Cross-AI Plan Review — Phase 17 (Plans A & B)

## 1. Summary

Both plans are unusually well-grounded in live repo state: they explicitly reconcile against current files (VALIDATION frontmatter already `complete`, DOCS-07 likely audit-only, no `.snap` files, `@/` Card imports) and honor the D-09 two-plan split with truly disjoint file sets. Plan A is low-risk documentation hygiene with strong automated grep gates; its main weakness is that most deliverables may require zero edits, so value depends heavily on SUMMARY audit logs and the manually curated v1.1 MILESTONES entry (DOCS-08). Plan B is a focused structural migration with clear preserve/don't-touch lists, but it **overstates test coverage for Dialog ARIA** — no test in the repo asserts `role="dialog"` or `aria-labelledby`, so D-05 verification currently reduces to source grep plus Radix trust, not behavioral proof. Overall the phase goals are achievable; the highest execution risks are factual accuracy in the v1.1 retrospective (Plan A Task 3) and visual/layout drift from `Card`'s default `py-6` (Plan B).

---

## 2. Strengths

**Shared / phase-level**
- **Live-state-first discipline** — Both plans instruct executors to read current files and avoid blind rewrites; this matches reality (all four `VALIDATION.md` files already pass DOCS-05, both empty SUMMARYs already carry rationale comments).
- **Correct scope correction** — DOCS-07 correctly scopes to **15** pre-Phase-05 SUMMARYs (phases 01–04), not a fictional 17.
- **Clean parallelization (D-09)** — Plan A touches only `.planning/` Markdown; Plan B touches only three admin components. No file overlap, no ordering dependency.
- **Decision traceability** — D-01 through D-12 are mapped to concrete task actions and acceptance criteria, not just listed in frontmatter.
- **NIL production risk is credible** — No schema, Edge Functions, migrations, or new packages; threat models are proportionate.

**Plan A**
- **Audit-then-edit pattern for DOCS-05/07** — "Leave byte-identical if correct" avoids cosmetic churn and false progress.
- **Automated verify gates** — Task 1 shell script encodes DOCS-07 empty-list rationale check; Task 2/3 greps are deterministic.
- **DOCS-06 is extend-in-place** — Appending `## Subsequent evolution` adjacent to `## Cross-Phase Integration` preserves the existing retroactive artifact rather than rewriting it.
- **DOCS-08 sourcing is explicit** — v1.2 entry as structural template + `v1.1-ROADMAP.md` as content source + D-07 hindsight from phases 12–16 is the right curation model.
- **Threat model honesty** — STRIDE entries dispositioned `accept` with git-review rationale is appropriate for Markdown-only work.

**Plan B**
- **Precise structural contract** — CardHeader/CardAction/CardContent composition, `p-0` full-bleed rows, one Card per section (D-04), error Alert and dialogs outside Card — all match current component structure in `AdminsList.tsx`, `CategoriesList.tsx`, and `PromoteAdminDialog.tsx`.
- **Import convention locked** — `@/components/ui/card` matches existing admin component imports and `components.json` alias setup.
- **D-11 re-scope is accurate** — Confirmed: zero `.snap` files and zero `toMatchSnapshot` usage in the repo; behavioral admin tests are the right gate.
- **Preserve lists are exhaustive** — `data-testid` skeletons, self-demotion guard, aria-labels on category icon buttons, snowflake validation, Dialog shell untouched.
- **Incremental verification** — Per-component tsc/lint/test in Tasks 1–2, full suite consolidation in Task 3 is sensible.
- **17-PATTERNS.md alignment** — Documents `Card`'s `py-6` vs `CardContent p-0` tension and CardAction grid behavior from live `card.tsx`.

---

## 3. Concerns

| Severity | Plan | Concern |
|----------|------|---------|
| **HIGH** | B | **ARIA verification claim is overstated.** Task 3 says "behavioral test suite asserts runtime ARIA" and threat T-17B-01 cites the same. In reality, `admins-tab.test.tsx` only checks duplicate "Promote admin" text after click — no `getByRole('dialog')`, no `aria-labelledby` assertion anywhere under `src/__tests__/`. D-05 survival is **not** proven by existing tests. |
| **MEDIUM** | B | **`Card py-6` vertical gap is acknowledged but not gated.** With `CardContent className="p-0"`, list rows will still sit inside Card's default `py-6` (24px top/bottom). Plan delegates fix to executor discretion without an acceptance criterion or visual check — risk of shipping a visibly "padded" list inconsistent with old flush containers. |
| **MEDIUM** | A | **DOCS-06 body/frontmatter drift.** Task 2 changes frontmatter `status: resolved` → `retrospective`, but the document body still contains `**Status:** resolved` (line 22). Plan doesn't require reconciling inline status — readers will see conflicting status values. |
| **MEDIUM** | A | **DOCS-08 factual accuracy risk.** Manual curation with retroactive ✓/⚠️ grading from phases 12–16 hindsight is the hardest task (HARD REQ). v1.1 Key Decisions in `v1.1-ROADMAP.md` already carry outcomes; re-grading against v1.2/v1.3 reality (UIDN-02/03 arcs, Migration 14, etc.) requires careful cross-reading — easy to misstate counts, PR numbers, or decision outcomes. |
| **MEDIUM** | A | **Migration 3–9 auth-path narrative accuracy.** DOCS-06 asks for a chronological list of migrations touching the auth path. Not all migrations 3–9 are auth-centric (e.g., 08 null choices, 06 RPC error codes). Executor must curate accurately or the retrospective becomes misleading audit fiction. |
| **MEDIUM** | B | **Heading semantics regression (unaddressed).** `<h2 className="text-base font-semibold">` → `<CardTitle>` (a `<div>` per `card.tsx`). UI-SPEC covers font weight parity but not landmark/heading hierarchy. Acceptable if intentional shadcn pattern, but worth noting for admin page outline. |
| **LOW** | A | **DOCS-05/07 may produce zero file edits.** Plans handle this correctly, but phase "completion" is mostly SUMMARY audit logging unless DOCS-06/08 land edits. Risk of perceived no-op if SUMMARY quality is thin. |
| **LOW** | A | **Automated parity check is shallow.** Task 3 `grep`/`awk` confirms section headings exist and v1.1 sits between v1.2 and v1.0 — not content quality, graded outcomes, or stats accuracy. |
| **LOW** | B | **LandingPage is a weak CardHeader analog.** `LandingPage.tsx` uses bare `<Card className="... p-8">` without CardHeader/CardTitle — first CardHeader usage will be admin lists; pattern doc in 17-PATTERNS is the real reference, not LandingPage. |
| **LOW** | B | **Task 3 runs full `npm run test`.** Appropriate safety net, but slower and unrelated failures could block a cosmetic change; plan doesn't distinguish infra flakes from migration regressions. |

---

## 4. Suggestions

**Plan A**
- **DOCS-06:** Add acceptance criterion to sync body `**Status:**` (and any other inline status references) when frontmatter changes to `retrospective`, or explicitly document "frontmatter canonical; body retains historical resolved label."
- **DOCS-06:** Provide a seed list of auth-touching migrations with one-line descriptions (e.g., 03 guild membership, 04 trigger RPC context, 09 admin integrity RLS, 14 search_path hardening) so the executor doesn't invent scope for migrations 5–8.
- **DOCS-08:** Add a pre-flight checklist: phase/plan counts from `v1.1-ROADMAP.md` header (4 phases, 16 plans), PR refs (#21–#25), shipped date 2026-05-11, and cross-check Key Decision re-grades against v1.2 MILESTONES deferred items (UIDN-02/03-FOLLOWUP-LIST-CARDS explicitly names these three components).
- **DOCS-08:** Require SUMMARY to list which v1.2 template sections were populated vs "None for v1.1" — makes D-06 parity auditable beyond grep.
- **DOCS-07:** Consider emitting the 15-file audit table as a machine-readable block in SUMMARY (filename → REQ-IDs or `confirmed-empty`) — the plan asks for this; make it a must_have artifact path.

**Plan B**
- **D-05 ARIA:** Replace "behavioral suite asserts runtime ARIA" with an explicit verification step, e.g. add to Task 3 acceptance: `screen.getByRole('dialog')` when promote dialog opens (could be a 3-line test addition in `admins-tab.test.tsx`), **or** downgrade language to "source-level preservation verified via grep; runtime ARIA unchanged by Radix composition (no test currently asserts dialog role)."
- **Card py-6:** Add acceptance criterion: either `className="py-0"` (or equivalent) on `<Card>` when full-bleed list content is desired, **or** SUMMARY documents intentional vertical inset with rationale. UI-SPEC already flags the lever — promote it to a gate.
- **CardTitle size:** If visual parity matters, specify `className="text-base"` on `CardTitle` since old `<h2>` had `text-base` and CardTitle primitive does not.
- **Task ordering:** Task 2 correctly references Task 1's migrated AdminsList as pattern — keep sequential execution within Plan B (already implied; worth stating in plan header to prevent parallel task dispatch).
- **PromoteAdminDialog scroll nesting:** Target structure nests `divide-y` div inside `CardContent` inside scrollable `Card` — confirm overflow behavior doesn't clip Card border radius; low risk but worth a quick manual open-dialog check in SUMMARY.

---

## 5. Risk Assessment

| Plan | Level | Justification |
|------|-------|---------------|
| **Plan A** | **LOW** | Markdown-only, no runtime surface. Residual risk is **documentation accuracy** (v1.1 MILESTONES curation, migration narrative), not production breakage. Automated gates catch structural gaps; they won't catch wrong stats or mis-graded decisions. |
| **Plan B** | **LOW–MEDIUM** | Structural-only UI change with good preserve lists and lint/tsc/test gates. Elevated slightly because (1) ARIA verification is weaker than documented, (2) `Card py-6` may cause unintended visual regression, (3) first CardHeader composition in admin UI. No auth/data/security impact. |
| **Combined phase** | **LOW** | Parallel plans are file-disjoint; merging both achieves phase goals (DOCS-05–08 + UIDN-04/05). D-12 human+bots merge gate is the right final control for a hygiene milestone. |

---

## Phase Goal Alignment

| Requirement | Plan | Achievable? |
|-------------|------|-------------|
| DOCS-05 | A Task 1 | Yes — likely audit-only (all four files already compliant) |
| DOCS-06 | A Task 2 | Yes — clear edit spec; watch body/frontmatter consistency |
| DOCS-07 | A Task 1 | Yes — audit-only with strong automated gate |
| DOCS-08 (HARD) | A Task 3 | Yes — but highest human curation effort and accuracy risk |
| UIDN-04 | B Tasks 1–2 | Yes — well-specified Card migration |
| UIDN-05 | B Task 3 | Yes — flag still applies (`border rounded-md` container present in live `PromoteAdminDialog.tsx`); ARIA claim should be corrected |

**Bottom line:** Execute as written with two fixes to plan language before execution: (1) correct Plan B's ARIA verification story, and (2) add DOCS-06 body status sync or an explicit exception.

---

## Consensus Summary

Three reviewers (Gemini, Codex, Cursor) agree the plans are **above-average GSD hygiene plans** — strong live-state awareness, accurate scope corrections (15 not 17 SUMMARYs; no `.snap` files), clean D-09 file-disjoint parallelization, and proportionate NIL-risk threat models. Overall phase risk is **LOW**. No reviewer recommends blocking; the asks are plan-language tightening, not redesign.

### Agreed Strengths
- **Live-state-first discipline** (all 3) — read current files, reconcile drift, no blind rewrites; matches reality (VALIDATION already `complete`, both empty SUMMARYs already carry rationale).
- **Accurate scope correction** (all 3) — DOCS-07 correctly handles the 15-SUMMARY reality vs the roadmap's stale "17".
- **D-11 re-scope is correct** (all 3) — zero `.snap` files in repo; behavioral admin tests are the right gate.
- **Precise Card composition contract** (all 3) — CardHeader/CardAction/CardContent + `p-0` full-bleed + one-Card-per-section (D-04), with exhaustive preserve lists.
- **Proportionate security/threat modeling** (all 3) — no schema/EF/auth/dependency changes; STRIDE `accept`/`mitigate` dispositions are appropriate.

### Agreed Concerns (highest priority)
- **[HIGH — Codex + Cursor] Plan B overstates ARIA test coverage.** Task 3 and threat T-17B-01 claim "the behavioral test suite asserts runtime ARIA," but no test under `src/__tests__/` asserts `getByRole('dialog')` or `aria-labelledby`. D-05 survival currently reduces to a source grep + trust in Radix, NOT behavioral proof. Two reviewers flag this independently as the single most important fix.
- **[MEDIUM — Gemini + Codex + Cursor] `Card py-6` vertical gap is acknowledged but not gated.** `CardContent p-0` only removes horizontal padding; Card's own `py-6` leaves a 24px top/bottom inset, risking a visibly padded list inconsistent with the old flush containers. All three want this promoted from "executor discretion" to an explicit acceptance criterion (`py-0` override) or a documented intentional-inset rationale.
- **[MEDIUM — Codex + Cursor] `CardTitle` renders a `<div>`, dropping `<h2>` heading semantics.** The migration silently removes the page's section heading landmark. Both suggest preserving an accessible heading (e.g. `h2` inside CardTitle) or explicitly accepting the shadcn-pattern tradeoff.

### Divergent Views
- **`files_modified` omits the `17-0x-SUMMARY.md` outputs (both plans).** Codex rates this **HIGH** (the plan's own "no files outside files_modified" gate would self-fail). Gemini and Cursor did not raise it. Assessment: this is a real internal inconsistency but a process/gate technicality with NIL production impact — SUMMARY files are generated execution artifacts, not deliverable scope. Recommend the cheap fix (add the SUMMARY paths to `files_modified`, or exempt generated summaries from the gate) but it does not block execution. Treated as MEDIUM for the cycle count, not a runtime HIGH.
- **DOCS-06 frontmatter/body status drift** — only Cursor caught that the body retains `**Status:** resolved` while the frontmatter flips to `retrospective`. Worth a one-line acceptance criterion to sync or explicitly exempt.
- **Migration 3–9 auth-path accuracy** — Codex (LOW) and Cursor (MEDIUM) both flag that not every migration 3–9 touched the auth path; Gemini did not. Curate the list accurately rather than asserting all of 3–9.

### Recommended pre-execution fixes (non-blocking)
1. **Plan B (HIGH):** Correct the D-05 ARIA verification language — either add a 3-line `getByRole('dialog', { name: /promote admin/i })` test, or downgrade the claim to "source-level grep preservation; runtime ARIA unchanged by Radix, no test currently asserts dialog role." This is the only HIGH that touches real verification honesty.
2. **Plan B (MEDIUM):** Promote the `Card py-6` full-bleed decision to an acceptance criterion (`py-0` or documented intentional inset).
3. **Plan B (MEDIUM):** Decide and document heading-semantics handling for `<h2>` → `CardTitle`.
4. **Plan A (MEDIUM):** Add a DOCS-06 body-status sync criterion (or explicit exemption).
5. **Both plans (process):** Add `17-0x-SUMMARY.md` to `files_modified` or exempt generated summaries from the no-outside-files gate.
6. **Plan A (LOW):** Curate the migration 3–9 auth-path list per-migration; tighten the DOCS-07 gate to assert exactly 15 summaries.
