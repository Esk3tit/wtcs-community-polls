---
phase: 7
reviewers: [gemini, codex, cursor]
reviewed_at: 2026-04-29T15:47:44Z
plans_reviewed: [07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md]
skipped_reviewers: [claude (running inside Claude Code), opencode (not installed), qwen (not installed), coderabbit (working-tree diff reviewer, not applicable to plan-only review)]
---

# Cross-AI Plan Review — Phase 7 (Observability Hardening)

## Gemini Review

# Phase 7: Observability Hardening — Plan Review

The implementation plans for Phase 7 are technically exhaustive and align perfectly with the React 19 and Vite 8/Rolldown architectural shifts. The strategy correctly prioritizes empirical verification over speculative configuration, using a permanent but env-gated smoke route to ensure the observability chain remains intact across future releases.

### Strengths
*   **Architectural Precision:** Correctly identifies that React 19 render-phase errors must be caught via the new `createRoot` hooks (`onCaughtError`, etc.) and that Sentry's `reactErrorHandler` is the canonical wrapper for these.
*   **Vite 8 / Rolldown Mastery:** Specifically targets `rolldownOptions.output.keepNames` to solve the Oxc-mangled stack trace issue, which is the correct "Vite 8 way" compared to legacy Terser or esbuild flags.
*   **Verification Rigor:** The inclusion of a permanent `RenderThrowSmoke` component is excellent for long-term health. It ensures that observability isn't just "fixed once" but remains verifiable via a single deploy-preview click.
*   **Baseline Drift Mitigation:** Plan 03, Task 3 explicitly mandates measuring the bundle-size delta in a single session by checking out `main`. This prevents unrelated feature additions on the base branch from skewing the `keepNames` cost analysis.
*   **Convention Adherence:** Strict adherence to project-specific patterns like the `/* eslint-disable react-refresh/only-export-components */` pragma, the `type` keyword for imports under `verbatimModuleSyntax`, and the dense, plan-cited comment style.

### Concerns
*   **Sentry Event Duplication (LOW):** As noted in the research, wiring both the React 19 hooks *and* a manual `onError` belt in `Sentry.ErrorBoundary` might produce duplicate events if Sentry's `Dedupe` integration doesn't match the stack traces perfectly.
    *   *Mitigation:* Plan 03's manual verification specifically checks for this. The plan allows for dropping the belt if duplication is observed.
*   **Netlify Context Reliability (LOW):** Relying on `$CONTEXT` in the build command is correct, but locally `VITE_NETLIFY_CONTEXT` will be `undefined`.
    *   *Mitigation:* The route logic `if (VITE_NETLIFY_CONTEXT === 'production')` correctly handles `undefined` as "not production," allowing the smoke route to work in local dev as intended.
*   **Git State for Benchmarking (LOW):** Plan 03 Task 3 involves checking out `main` to measure the baseline.
    *   *Mitigation:* The plan includes `rm -rf dist node_modules/.vite && npm ci` to ensure a clean slate, which is essential for accurate byte-count comparisons.

### Suggestions
*   **Evidence Naming:** When capturing the Sentry `mechanism.type`, consider also noting the `handled: false` state in the JSON, as this confirms the error wasn't just caught and silenced, but properly reported as a crash.
*   **Chunk Inspection:** In the `OBSV-02-bundle-delta.md` per-chunk table, specifically highlight the `vendor` or `react` chunks, as `keepNames` can have a disproportionate effect on libraries that export many small functions.

### Risk Assessment: LOW
The risk is low because the changes are localized to configuration and the addition of a single, unauthenticated debug route that is explicitly 404-gated on production. The "fail-safe" for this phase is that even if the configuration is slightly off, the application functionality remains untouched; only the quality of error reporting in Sentry would be affected. The verification strategy is robust enough to catch configuration errors before they reach `main`.

---

## Codex Review

## Summary

The plans are unusually thorough and mostly aligned with the Phase 7 goal: they keep scope tight, preserve the existing Sentry/sourcemap pipeline, add a reusable smoke surface, and require real deploy-preview evidence. As written, though, they are not execution-ready. I found several concrete blockers in local repo/types: a missing `typecheck` script, an incorrect `ErrorInfo` import that will fail TypeScript, a likely-invalid TanStack route filename for `/__smoke`, and Sentry mechanism assumptions that do not match the installed SDK.

## Strengths

- Clear phase boundary: OBSV-01/02 only, no product-feature creep.
- Good dependency order: bootstrap/config first, smoke route second, deploy-preview evidence last.
- Strong evidence model: deploy preview, Sentry permalink, release SHA, stack-frame screenshots, sourcemap/chunk proof.
- Good preservation of locked surfaces: `Sentry.init`, `sentryVitePlugin`, `sourcemap: 'hidden'`, and Netlify headers stay untouched.
- Security posture is reasonable: production smoke path is gated, no auth/data access is added, and function-name disclosure is explicitly accepted.

## Concerns

- **HIGH:** `npm run typecheck` does not exist in [package.json](/Users/khaiphan/code/wtcs-community-polls/package.json:6). Multiple tasks and validation rows will fail before implementation is tested. Use `tsc -b --noEmit`, `npx tsc -b --noEmit`, or add a `typecheck` script.

- **HIGH:** Plan 07-01 imports `type ErrorInfo` from `react-dom/client`, but `Sentry.reactErrorHandler` expects `React.ErrorInfo`. The local types are incompatible because React permits `componentStack?: string | null`, while `react-dom/client` has `componentStack?: string`. Import from `react` instead, or omit the annotation.

- **HIGH:** `src/routes/__smoke.tsx` is likely the wrong filename for a literal `/__smoke` route. TanStack treats unescaped leading underscores as pathless/layout segments. Use an escaped filename such as `src/routes/[__smoke].tsx` while keeping `createFileRoute('/__smoke')`.

- **HIGH:** Plan 07-03's accepted Sentry mechanism values are probably wrong for the installed SDK. Local `@sentry/react` emits `auto.function.react.error_handler` from `reactErrorHandler` and `auto.function.react.error_boundary` from `ErrorBoundary`; the plan only accepts `react.errorboundary` or `generic`. Reject `auto.browser.global_handlers.onerror`, but accept and document the actual SDK mechanism strings.

- **MEDIUM:** The `onError` belt may not produce the stored event with `tags.boundary='app-root'` if Sentry's Dedupe suppresses the manual `captureException` after the built-in ErrorBoundary capture. Add `beforeCapture` to tag/context the SDK's own ErrorBoundary event, then keep `onError` as the belt.

- **MEDIUM:** Grepping for `"App"` in sourcemaps is brittle; this repo has no `App` component. Use identifiers that actually exist: `RootLayout`, `RenderThrowSmoke`, `SmokePage`, or `AppErrorFallback`.

- **MEDIUM:** `.js.map` inspection may fail in production-mode builds when `filesToDeleteAfterUpload` runs successfully. Add an explicit local inspection build mode/command where Sentry upload deletion is disabled, or capture the map excerpt before deletion.

- **MEDIUM:** Plan 07-03 templates use `___` frontmatter delimiters. Existing planning docs use YAML `---`; using underscores risks breaking traceability tooling.

- **LOW:** Plan 01/02 summaries marking `requirements-completed` before deploy-preview verification may overstate completion. Better to mark them addressed/implemented and reserve completed for Plan 03.

## Suggestions

- Replace Plan 07-01 import with:
  ```ts
  import { type ErrorInfo } from 'react'
  import { createRoot } from 'react-dom/client'
  ```

- Add or use a real typecheck command:
  ```json
  "typecheck": "tsc -b --noEmit"
  ```

- Rename the smoke route file to an escaped literal route filename, then strengthen acceptance:
  ```bash
  grep -c "fullPath: '/__smoke'" src/routeTree.gen.ts
  ```

- Add `beforeCapture` on `Sentry.ErrorBoundary` to guarantee `boundary='app-root'` lands on the SDK-captured event.

- Update mechanism verification to: pass if mechanism is `auto.function.react.error_handler`, `auto.function.react.error_boundary`, or a documented manual-capture generic; fail if it is `auto.browser.global_handlers.onerror`.

- Replace all `"App"` evidence checks with real project symbols.

- Use `---` frontmatter in `07-VERIFICATION.md` and `OBSV-02-bundle-delta.md`.

- Make bundle evidence reproducible without network or branch mutation: compare against a recorded base SHA or merge base, and avoid mandatory `git pull --ff-only`.

## Risk Assessment

**Overall risk: MEDIUM-HIGH as written.** The architecture is sound, but several plan instructions are likely to fail mechanically or reject valid evidence. After fixing the type import, route filename, mechanism allowlist, missing script, and sourcemap evidence path, the phase risk drops to **LOW-MEDIUM**: the remaining uncertainty is mostly Sentry's live event behavior and the real gzip delta from `keepNames`.

---

## Cursor Review

## 07-01-PLAN Review

### 1) Summary
This is a strong, implementation-ready plan with clear boundaries and excellent traceability to requirements (OBSV-01/02), and it correctly prioritizes low-risk wiring changes in `src/main.tsx`, `vite.config.ts`, and `netlify.toml`. It is rigorous and testable, but a few checks are brittle (tooling assumptions around grep/globs and `.map` matching) and the `onError` belt introduces potential duplicate-event behavior that should be explicitly accepted as a tradeoff in the plan output.

### 2) Strengths
- Clear requirement linkage to OBSV-01/02 and decision IDs (D-05, etc.).
- Strong "do not touch" guardrails reduce accidental scope creep.
- Good sequencing: root hooks + keepNames + env exposure before smoke route.
- Validation includes both typecheck and production build, aligned with phase intent.
- Security posture is appropriately minimal and scoped for a hygiene phase.

### 3) Concerns
- **MEDIUM:** Acceptance criteria rely on grep patterns over `dist/assets/*.js.map` that may be brittle if sourcemap shape or filenames vary.
- **MEDIUM:** `onError` + `onCaughtError` duplicate risk is acknowledged, but no explicit remediation trigger is encoded in this plan's done/fail logic.
- **LOW:** Criteria mention route tree regeneration as a pitfall in this plan even though route work is in Plan 02; this can confuse pass/fail ownership.
- **LOW:** Very dense plan may increase execution error rate for humans despite strong detail.

### 4) Suggestions
- Add an explicit contingency in Plan 01: "If duplicate events observed in Plan 03, remove belt or document accepted dedupe behavior."
- Move routeTree-related acceptance checks fully to Plan 02 to keep ownership clean.
- Replace brittle map-string checks with one stable script/check command reused in Plan 03 documentation.
- Add a short "minimum pass gate" subsection (must-pass vs nice-to-have checks).

### 5) Risk Assessment
**Overall risk: LOW-MEDIUM.**
Technically sound and tightly scoped; main residual risk is verification brittleness and duplicate-event ambiguity, not architecture.

---

## 07-02-PLAN Review

### 1) Summary
This is a clean plan that directly implements the canary verification surface with good separation of concerns and proper env gating. It aligns well with D-02..D-06 and avoids over-engineering. The biggest risk is reliance on generated route artifacts and environment assumptions that could fail silently on deploy if not explicitly verified against the deployed preview behavior.

### 2) Strengths
- Correctly uses a dedicated `/__smoke` route and render-phase throw semantics.
- Good non-prod gating model with `beforeLoad` + `notFound()` for prod.
- Lazy loading is appropriate and consistent with `autoCodeSplitting`.
- Explicit prohibition of direct `Sentry.captureException` in smoke path preserves test integrity.
- Strong anti-scope controls (no auth wrapper, no custom 404 UX, no unrelated route edits).

### 3) Concerns
- **MEDIUM:** Dependency on `VITE_NETLIFY_CONTEXT` assumes Plan 01 landed and deploy env substitution works exactly as expected.
- **MEDIUM:** Accepting "RenderThrowSmoke identifier in dist chunk" as proof of lazy split may be non-deterministic depending on bundler output details.
- **LOW:** Potential ambiguity around whether `/__smoke` should exist in local dev when env var is undefined (current plan says yes; that's fine but should be explicitly intentional in final docs).
- **LOW:** Very strict literal-content instructions may reduce adaptability if route conventions change slightly.

### 4) Suggestions
- Add a single deploy-preview smoke sanity check in this plan's output criteria: "`/__smoke` reachable on preview, not on prod."
- Add fallback behavior if `VITE_NETLIFY_CONTEXT` is unexpectedly missing in preview (log + fail verification).
- Replace identifier-based chunk proof with route-level behavior proof plus routeTree inclusion check.
- Add one short note in summary file clarifying local-dev behavior is expected and intentional.

### 5) Risk Assessment
**Overall risk: LOW.**
Well-scoped and likely to succeed; main risk is environment/config coupling, not code complexity.

---

## 07-03-PLAN Review

### 1) Summary
This plan is comprehensive and audit-friendly, and it does what a closure plan should do: convert technical intent into evidence. It strongly enforces D-07/D-08/D-11..D-14. The main risk is operational complexity: it's documentation-heavy with many manual placeholders and strict formatting requirements, making execution error (stale placeholders, incomplete artifacts, inconsistent measurements) more likely than technical failure.

### 2) Strengths
- Excellent evidence model: mechanism type, component stack, un-mangled frames, permalink, release SHA.
- Correctly mandates deploy-preview verification (not dev/Vitest), matching core risk from prior phase.
- Strong bundle-delta methodology with same-session baseline control.
- Good use of explicit pass/fail sentinel (`auto.browser.global_handlers.onerror` as failure).
- Traceability and audit structure are extremely strong.

### 3) Concerns
- **HIGH:** Manual checkpoint introduces significant risk of incomplete/incorrect evidence capture (placeholder leakage, wrong event, wrong release SHA).
- **MEDIUM:** Baseline comparison process (`git checkout main`, pull, rebuild, return) is fragile in active repos and can produce drift despite guidance.
- **MEDIUM:** Screenshot artifact policy (<1MB commit else ignore) could create inconsistent historical evidence quality.
- **LOW:** Creating first `.planning/closure/` convention during this plan can cause minor process friction or naming inconsistency.

### 4) Suggestions
- Add a short "evidence checklist script" to fail fast on placeholder tokens and missing required fields before completion.
- Require explicit event timestamp + environment tag in the verification doc to avoid wrong-event capture.
- Standardize screenshot policy (always keep local + always include permalink + textual extraction in git) rather than size-based branching.
- For bundle delta, record exact `main` commit hash used as baseline in both docs and summary to reduce audit ambiguity.

### 5) Risk Assessment
**Overall risk: MEDIUM.**
Technical risk is low; execution/process risk is moderate due to high manual/documentation load and many required evidence artifacts.

---

## Cross-Plan Overall Assessment (Cursor)

### 1) Summary
The three plans are well-designed, coherent, and correctly staged: Plan 01 wires capture/symbolication prerequisites, Plan 02 adds a stable verification surface, and Plan 03 captures authoritative evidence. Together they should achieve the Phase 7 goals with minimal product risk and no scope creep into v1.2 features. The main systemic risk is not architecture—it is verification ergonomics and manual evidence handling in Plan 03.

### 2) Strengths
- Clear dependency ordering and phase decomposition.
- Strong requirement-to-artifact traceability.
- Explicit anti-scope controls prevent over-engineering.
- Security/performance tradeoffs are acknowledged and bounded.
- Verification strategy aligns with the known React 19/Sentry caveats.

### 3) Concerns
- **MEDIUM:** Some checks are implementation-fragile (grep-based artifact assertions).
- **MEDIUM:** Duplicate-event behavior is acknowledged but not fully operationalized as a deterministic branch in outcomes.
- **LOW:** Plan verbosity may reduce executor throughput and increase clerical mistakes.

### 4) Suggestions
- Introduce a minimal shared verification helper for stable checks used by all plans.
- Add a single explicit "if duplicate/noise exceeds threshold then do X" decision.
- Add a final cross-plan "ready-to-close gate" checklist to prevent Plan 03 paperwork drift.

### 5) Risk Assessment
**Overall phase-plan risk: LOW-MEDIUM.**
High-quality planning with strong technical correctness; residual risk is primarily operational/manual verification error rather than design flaws.

---

## Consensus Summary

### Agreed Strengths (2+ reviewers)
- **Tight scope discipline / clear phase boundary** — All three: zero product-feature creep into OBSV-01/02 only.
- **Correct dependency ordering** — All three: bootstrap/config (01) → smoke surface (02) → evidence capture (03).
- **Strong evidence model** — All three: deploy-preview, Sentry permalink, release SHA, mechanism type, un-mangled frames.
- **Architectural correctness on React 19 + Vite 8/Rolldown** — Gemini and Codex explicitly: `createRoot` hooks via `Sentry.reactErrorHandler` + `rolldownOptions.output.keepNames`.
- **Traceability and "do-not-touch" guardrails** — All three: requirement IDs, decision IDs, locked surfaces preserved.

### Agreed Concerns (2+ reviewers — highest priority)
- **`onError` belt + duplicate-event risk** — Gemini (LOW), Codex (MEDIUM), Cursor (MEDIUM). All three flag that the manual `onError` belt may collide with Sentry's `Dedupe` and either drop the desired tagged event or produce duplicates. Codex's fix (`beforeCapture` on `Sentry.ErrorBoundary` instead of/in addition to `onError`) is the most actionable.
- **Brittle grep-based sourcemap/chunk verification** — Codex (MEDIUM) and Cursor (MEDIUM). The `dist/assets/*.js.map` literal-string assertions are fragile; Codex additionally identifies the specific bug — grepping for `"App"` when no `App` component exists in this codebase.
- **Bundle-baseline `git checkout main` fragility** — Gemini (LOW, mitigated), Cursor (MEDIUM), Codex (suggests recording base SHA instead). Active-repo state and required `git pull` make the same-session baseline non-reproducible in audit.
- **Manual evidence-capture risk in Plan 03** — Cursor (HIGH for Plan 03), Codex (MEDIUM via placeholder/template concerns including `___` vs `---` frontmatter). High clerical surface area = real risk of placeholder leakage, wrong event, wrong release SHA.

### High-severity items unique to a single reviewer (still actionable)
**Codex flagged four mechanical blockers no other reviewer caught:**
1. **`npm run typecheck` script does not exist** in `package.json` — multiple plans assume it. Add `"typecheck": "tsc -b --noEmit"` or update plan commands.
2. **`type ErrorInfo` import source mismatch** — Plan 07-01 imports from `react-dom/client`; Sentry's `reactErrorHandler` expects `React.ErrorInfo`. Import from `react` or drop the annotation.
3. **TanStack route filename `src/routes/__smoke.tsx`** — leading underscore is treated as pathless/layout. Use escaped filename `src/routes/[__smoke].tsx`.
4. **Sentry mechanism allowlist is wrong for installed SDK** — accept `auto.function.react.error_handler` and `auto.function.react.error_boundary`, not just `react.errorboundary`/`generic`.

These four items would cause execution-time failures regardless of architectural correctness — they belong in the next plan revision before `/gsd-execute-phase`.

### Divergent Views (worth investigating)
- **Overall risk verdict spans LOW → MEDIUM-HIGH:**
  - Gemini: **LOW** (architecture sound, fail-safe is benign).
  - Cursor: **LOW-MEDIUM** (process risk in Plan 03 manual evidence).
  - Codex: **MEDIUM-HIGH as written** → **LOW-MEDIUM after fixes** (mechanical blockers).
  - Reconciliation: Gemini reviewed at architecture level; Codex went deepest into the local repo and found execution-blockers; Cursor focused on operational ergonomics. The MEDIUM-HIGH rating is the most conservative and most actionable — adopting Codex's four HIGH fixes would converge all three to LOW-MEDIUM.

- **Smoke route file name:**
  - Gemini and Cursor accepted `src/routes/__smoke.tsx` as-is.
  - Codex flagged it as wrong for TanStack file-based routing semantics.
  - **Action:** verify against TanStack Router docs / generated `routeTree.gen.ts` before execution; this is empirically testable in <60s.

- **Belt-vs-replace strategy on `onError`:**
  - Gemini accepts the current "drop belt if duplicate observed" approach.
  - Codex recommends keeping the belt but adding `beforeCapture` on `Sentry.ErrorBoundary`.
  - Cursor wants explicit deterministic remediation criteria.
  - **Action:** decide between (a) dual-capture with `beforeCapture` to guarantee the tag, or (b) `beforeCapture` only and remove the manual belt entirely. Document the chosen strategy in 07-01-PLAN.

---

## Recommended Next Steps

1. **Apply Codex's four HIGH fixes** to the plans before executing — these are mechanical blockers, not subjective taste calls.
2. **Decide the `onError` strategy** explicitly (with `beforeCapture`) and update Plan 01 + Plan 03 verification logic.
3. **Replace `"App"` symbol checks** with real identifiers (`RootLayout`, `RenderThrowSmoke`, `AppErrorFallback`) across Plan 01 and Plan 03 acceptance criteria.
4. **Stabilize Plan 03 evidence capture** with a placeholder-detection script + recorded base-SHA for bundle delta (no `git checkout main` requirement).
5. **Fix `___` → `---` frontmatter** in Plan 03 templates.
6. Run `/gsd-plan-phase 7 --reviews` to fold this REVIEWS.md back into a revised plan revision.
