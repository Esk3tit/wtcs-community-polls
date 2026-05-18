---
phase: 15
reviewers: [codex, gemini, coderabbit]
reviewed_at: 2026-05-18T05:31:50Z
plans_reviewed:
  - 15-01-PLAN.md
  - 15-02-PLAN.md
  - 15-03-PLAN.md
  - 15-04-PLAN.md
  - 15-05-PLAN.md
unavailable_reviewers:
  - claude (self — running inside Claude Code CLI; skipped for independence)
  - cursor (usage limit hit)
  - opencode (CLI not installed)
  - qwen (CLI not installed)
  - ollama (local server not running)
  - lm_studio (local server not running)
  - llama_cpp (local server not running)
---

# Cross-AI Plan Review — Phase 15

Phase 15 — Observability + E2E Verify & Close — independently reviewed by Codex, Gemini, and CodeRabbit. Cursor reviewer aborted due to usage limit; Claude skipped (self). All three responding reviewers produced substantive feedback; review proceeded as the gsd-review skill requires `at least one DIFFERENT CLI must be available`.

---

## Codex Review

## Summary

The Phase 15 plan set is thorough and mostly aligned with the stated "verify and close" goal: it adds the missing smoke harness, creates a build-time sourcemap regression guard, wires it into CI, captures manual Sentry/CI evidence, and closes the related GitHub issues with traceability. The main risks are not broad scope but a few correctness gaps in the smoke-event surface and evidence rigor. Plan 01 in particular has two blockers that should be fixed before execution.

## Strengths

- Clear phase boundary: no schema changes, no E2E fixture churn, no product feature work.
- Good dependency shape: smoke harness and sourcemap script can land independently; CI wiring waits for the script; evidence waits for all code changes.
- Strong traceability from requirements to artifacts, screenshots, CI run URLs, event IDs, and issue closure comments.
- Good use of existing surfaces: `/__smoke`, Netlify deploy previews, existing Sentry setup, existing CI workflow.
- The sourcemap-name script is appropriately small, zero-dependency, and well scoped to guarding `keepNames: true`.
- Manual Sentry verification is realistic: it checks runtime capture, release artifacts, and real stack-frame names rather than relying only on local build output.

## Concerns

- **HIGH: Plan 01 has an impossible acceptance check.** It requires literal source strings `OBSV-03 render` and `OBSV-05 dedupe`, then requires `grep -nE "Phase 15|OBSV-0[345]|..." src/...` to return zero. That grep will match the required error messages.

- **HIGH: `Sentry.lastEventId()` surfacing is likely placed too low.** The current app-level `Sentry.ErrorBoundary` wraps the router in [src/main.tsx](/Users/khaiphan/code/wtcs-community-polls/src/main.tsx). A render throw from `/__smoke` will cause that boundary to replace the router subtree with `AppErrorFallback`, so a `useEffect` inside `SmokePage` is not a reliable post-catch surface. It may never run for direct visits to `/__smoke?fire=render`.

- **MEDIUM: OBSV-05 evidence does not prove "one event per error."** Two distinct event IDs prove the second scenario was not masked by Dedupe, but they do not prove the triple-handler path collapsed to exactly one event per scenario. Duplicate events for the same message could still exist in Sentry.

- **MEDIUM: Deploy-preview Sentry token scope needs tighter security framing.** Setting `SENTRY_AUTH_TOKEN` for all Netlify deploy previews can expose a release-upload token to any code that runs in preview builds. This is acceptable only if PR sources are trusted or the token is temporary and narrowly scoped.

- **MEDIUM: Sentry release-name assumptions should be explicitly verified.** Runtime events use `VITE_COMMIT_SHA`; the Sentry Vite plugin auto-detects release name from CI/git unless `release.name` or `SENTRY_RELEASE` is set. These should usually match, but Plan 04 should verify event release and artifact release are identical before treating `sentry-cli releases files <sha> list` as authoritative.

- **LOW: Plan 03 may need a CI timeout bump.** Adding `npm run build` to `lint-and-unit` increases runtime; the current 10-minute timeout may be tight under GitHub Actions variance.

- **LOW: Several file lists are stale or incomplete.** Plan 01 may modify `RenderThrowSmoke.tsx` but only lists the route in frontmatter; Plan 05 modifies `.planning/REQUIREMENTS.md` but does not list it.

- **LOW: `npx @sentry/cli@latest` is unnecessarily floating.** For evidence capture, prefer the lockfile/transitive CLI or a pinned version to avoid surprise CLI behavior changes.

## Suggestions

- Fix Plan 01's archaeology grep. Either exclude string literals from the check or remove `OBSV-0[345]` from the forbidden pattern and only ban those IDs in comments.

- Move event-id surfacing to a reliable catch boundary. Best options:
  - Add a local `Sentry.ErrorBoundary` inside `/__smoke` around the throw component and write `eventId` from its `onError`.
  - Or extend `AppErrorFallback` to read `Sentry.lastEventId()` and write the body dataset when the current path is `/__smoke`.
  Avoid relying on `SmokePage.useEffect` after a render-phase throw.

- Strengthen OBSV-05 verification by counting events per message/release in Sentry over a tight timestamp window. Evidence should show exactly one event for `OBSV-03 render` and exactly one event for `OBSV-05 dedupe`, not only two distinct IDs.

- In Plan 04, add an explicit release consistency check: Sentry event release must equal `head_sha`, and `sentry-cli releases files <head_sha> list` must show artifacts for that same release.

- Treat deploy-preview Sentry env vars as temporary or branch-limited if possible. Use a minimal-scope token and remove or rotate it after Phase 15 if previews can be built from untrusted branches.

- Change Plan 04's PR keyword verification from `grep -E "^[1-5]$"` to a strict `^5$` or `^[5-9][0-9]*$`.

- Pin Sentry CLI invocation, for example use the installed transitive CLI if available or `npx @sentry/cli@<known-version>`.

- If branch protection requires a follow-up PR for final `15-EVIDENCE.md`, delay issue closure comments until that evidence PR is merged to `main`.

## Risk Assessment

**Overall risk: MEDIUM.** The phase is operationally low-risk to production data and user-facing behavior, but the verification plan has two correctness blockers in Plan 01 and one evidence gap for OBSV-05. Once the event-id surfacing is moved to an actual catch boundary, the impossible grep is fixed, and Sentry event counting is tightened, the plan drops to LOW risk.

---

## Gemini Review

I have reviewed the implementation plans for **Phase 15: Observability + E2E Verify & Close**. The plans are exceptionally detailed, rigorously aligned with the Research/Context mandates, and provide a robust path to closing the targeted technical debt and GitHub issues.

### 1. Summary
Phase 15 transitions the project from "implementation" to "verification" for the v1.3 hygiene milestone. The strategy centers on two custom-built verification harnesses: a prod-gated smoke route for runtime Sentry verification (D-01/D-02) and a zero-dependency build-time script for sourcemap regression guarding (D-05/D-08). The wave structure correctly sequences the automation landing before the manual evidence capture, culminating in a "freshness-compliant" (D-12) merge and issue-closure cycle. The plan's strength lies in its empirical approach to observability—verifying not just that code exists, but that the observability SaaS (Sentry) actually receives the expected, un-mangled telemetry.

### 2. Strengths
- **Empirical Observability Verification:** Plan 15-01/04 don't just "check code"; they use distinct error messages (`OBSV-03` vs `OBSV-05`) to prove that Sentry's deduplication logic is configured correctly for React 19's multi-handler capture path.
- **Robust Regression Guarding:** The `verify-sourcemap-names.mjs` script (Plan 15-02) is a high-signal, low-cost way to ensure the `keepNames: true` contract never silently regresses—a common failure mode in minified JS environments.
- **Strict Environment Pre-flights:** Task 15-04-T2 correctly identifies the risk of Netlify environment variable scoping (Production vs Deploy-preview) discovered during research, preventing a "false fail" on sourcemap uploads.
- **Traceable Closure:** The use of `document.body.dataset` (D-03) for event ID surfacing and the requirement for post-merge CI citations (D-12) ensures the evidence trail is both machine-readable and chronologically accurate.
- **Kebab-case and PascalCase discipline:** The plans strictly adhere to the project's naming conventions for routes and scripts.

### 3. Concerns
- **CI Runtime (LOW):** Adding `npm run build` to the `lint-and-unit` job (Plan 15-03) will increase CI duration for every push. Given the current project scale, this is acceptable for the benefit of the regression guard, but should be monitored as the bundle grows.
- **Dedupe Timing (LOW):** In Plan 15-01, the `useEffect` reading `Sentry.lastEventId()` relies on the SDK having completed the capture. The suggestion to use `requestAnimationFrame` is good, but if Sentry's transport is slow, there's a theoretical risk of reading `undefined` if checked too early.
- **Allowlist Brittleness (LOW):** The `verify-sourcemap-names.mjs` allowlist is manual. Future refactors that rename `ConsentProvider` to something else will break CI. The failure message appropriately directs developers to update the list, mitigating this risk.

### 4. Suggestions
- **Sentry CLI Scoping:** In Plan 15-04 Task 4, suggest the operator run `npx @sentry/cli info` before the `releases files list` command to verify that the local shell's org/project slugs match the intended target.
- **Fallback Event ID:** In the `useEffect` for `SmokePage` (Plan 15-01), consider adding a small "Retry" button that just refreshes the `Sentry.lastEventId()` reading into the DOM, just in case the initial capture was slow.
- **Step Ordering:** In `ci.yml`, ensure the `npm run build` step for verification doesn't accidentally trigger a Sentry upload if a developer happens to have a `SENTRY_AUTH_TOKEN` in their own fork's secrets (though unlikely in this repo setup).

### 5. Risk Assessment: LOW
The risk is **LOW**. The phase introduces no production schema changes or user-facing behavioral logic. The primary new surface area is a prod-gated debug route and a build-time grep script. The "Manual: false" nature of the evidence tasks (Plans 15-04 and 15-05) ensures a high level of human oversight before the issues are closed and the PR is merged.

---
**Verdict:** The plans are ready for execution. They represent a "Gold Standard" for phase closure and evidence capture.

---

## CodeRabbit Review

CodeRabbit reviews the working tree directly (not via prompt) and produced 14 findings on the Phase 15 plan + supporting docs. Severity in CodeRabbit's taxonomy: `potential_issue` (treated as MEDIUM here), `nitpick` (treated as LOW). All 14 findings reproduced verbatim below.

### Finding 1 — 15-VALIDATION.md L61-68 (potential_issue / MEDIUM)
Update the Wave 0 footnote inside the "Wave 0 Requirements" section by replacing the incorrect script reference `npm run test:e2e -- --list` with the correct script `npm run e2e -- --list` (per RESEARCH.md note); locate the line that currently contains `npm run test:e2e -- --list` and change only the command string so the footnote accurately reflects the runnable script.

### Finding 2 — 15-VALIDATION.md L17-26 (potential_issue / MEDIUM)
Update the Test Infrastructure table to match RESEARCH.md: change "Vitest 4.x" to "Vitest 1.6.x (peer of @vitest/coverage-v8)"; replace the config file entry `vitest.config.ts + playwright.config.ts` with `vite.config.ts (contains vitest section) + e2e/playwright.config.ts`; and remove the non-existent script `npm run test:e2e -- --grep @smoke` and instead list the correct local and CI commands such as `npm run e2e` (local) and `npx playwright test --config e2e/playwright.config.ts --grep @smoke` (CI).

### Finding 3 — ROADMAP.md L206 (potential_issue / MEDIUM)
The Phase 14 progress table entry is stale; update the row for "Phase 14 Security-Definer Search-Path Migration" so the progress columns read `1/1 | Complete | 2026-05-17` (replacing the current `0/TBD | Not started`) to match the detailed notes earlier in the document that show the phase shipped with 1/1 plans complete.

### Finding 4 — 15-04-PLAN.md L115-118 (nitpick / LOW)
Add explicit timeout and fallback guidance to Gate B around the `gh run watch` / `gh run view` steps: state a recommended max wait (e.g., "if status remains in_progress or queued after 30 minutes, investigate logs"), instruct the operator how to abort (e.g., cancel the run or ctrl-c and re-run CI), and suggest using `gh run watch --exit-status` as an optional safer watch mode; update the steps that reference status, `gh run watch`, and `gh run view <id> --json conclusion --jq '.conclusion'` to include these timeout/fallback instructions.

### Finding 5 — 15-04-PLAN.md L222-226 (nitpick / LOW)
Update the resume-signal text to require explicit confirmation that the two captured event IDs are different: when instructing the operator to submit the resume-signal (referencing the existing "resume-signal" and "Step 3 — Fire OBSV-05 dedupe" flow), change it to ask the operator to type a line like `evidence captured: OBSV-03-ID=<id1>, OBSV-05-ID=<id2>` and explicitly state `<id1> ≠ <id2>` (or "confirm `<id1>` ≠ `<id2>`") so the actor must provide both IDs and affirm their distinctness before proceeding to Task 4.

### Finding 6 — 15-02-PLAN.md L145 (nitpick / LOW)
Add an inline clarifying comment next to the RegExp construction that builds `new RegExp(\\bfunction ${name}\\b)` (used with ALLOWLIST) showing an example of the resulting regex literal (e.g., `Produces: /\bfunction ConsentProvider\b/`) so future maintainers can see the actual pattern produced and understand the double-backslash escaping; place this comment immediately above or beside the line that constructs the RegExp in the generated script.

### Finding 7 — 15-03-PLAN.md L111 (potential_issue / MEDIUM)
Update the automated verification to assert ordering by checking that `npm run build` and `verify-sourcemap-names` occur in the section between the step containing `npm test -- --run` and the step containing `npm audit`; modify the test that currently only counts occurrences so it slices the workflow between the `npm test -- --run` and `npm audit` markers and then verifies both `npm run build` and `verify-sourcemap-names` are present in that slice.

### Finding 8 — 15-03-PLAN.md L119 (potential_issue / MEDIUM)
The automated verification command using `grep -E "^\\s<sha>[2-9]"` (the automated line that pipes `grep -A 60 ... | wc -l | grep -E`) only matches a single digit and will fail for counts >= 10; update that check to perform a numeric comparison of the `wc -l` result (e.g. `test $(... | wc -l) -ge 2`) or replace the regex with one that accepts multi-digit numbers (e.g. `^\s<sha>([2-9]|[1-9][0-9]+)$`) so the match-count check correctly allows 2 or more matches.

### Finding 9 — 15-03-PLAN.md L83-84 (potential_issue / MEDIUM)
The probe step currently sets `SENTRY_AUTH_TOKEN`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to empty strings which is different from leaving them unset; update the instruction in 15-03-PLAN.md so the build is run with those env vars truly unset (e.g., use an env-unset approach rather than assigning empty values) and note to verify behavior against `src/lib/supabase.ts` to ensure the module-load check exercises the unset (undefined) case rather than an empty-string case.

### Finding 10 — 15-02-PLAN.md L88-90 (potential_issue / MEDIUM)
The task text currently conditions running the build on the existence of `dist/` ("Run `npm run build` once (if `dist/` does not already exist)"); change this to unconditionally run the build so validation uses fresh artifacts: replace that sentence in Task 1 with a mandate to always run `npm run build` (the project build script: `tsr generate && tsc -b && vite build`) before allowlist checks, and ensure any surrounding wording and acceptance criteria that reference `dist/assets/` reflect that a fresh build is required.

### Finding 11 — 15-05-PLAN.md L228 (potential_issue / MEDIUM)
The step that updates frontmatter `progress.completed_phases` should not hardcode "from 1 → 2"; instead, read the current `progress.completed_phases` value from `.planning/STATE.md`, parse it as an integer, increment it by 1, and write the updated value back into the frontmatter (preserving other fields). Locate the code or instruction that currently references `progress.completed_phases` in the plan and replace the hardcoded update with a read-then-increment-write sequence that validates the parsed number before writing.

### Finding 12 — 15-02-PLAN.md L159 (potential_issue / MEDIUM)
The plan claims "No `eslint-disable` directives needed — `eslint.config.js` already excludes `scripts/`" without verifying it; update the plan to either add a quick verification step that checks `eslint.config.js` actually excludes `scripts/` (e.g., search for "scripts/" or ignore patterns in `eslint.config.js`) or soften the sentence to state that the script should "either pass lint or be excluded per `eslint.config.js` patterns" and keep the acceptance criteria `npm run lint` exits 0; reference `eslint.config.js`, the `scripts/` directory, and the `npm run lint` acceptance check when making the change.

### Finding 13 — 15-04-PLAN.md L252-256 (nitpick / LOW)
Add an explicit pre-condition check at the start of Task 4's block to verify Task 2 checkpoint status: require the operator to confirm Task 2 passed by typing `preview-env-confirmed` or `preview-env-remediated` (or stop if Task 2 was skipped), and abort Task 4 until that confirmation is present; update Task 4's instructions (the step invoking `sentry-cli`) to reference this pre-check so the disambiguation branch in (d)(i) is only reached if the pre-condition was overlooked.

### Finding 14 — 15-01-PLAN.md L161 (potential_issue / MEDIUM)
The acceptance criteria contains a manual verification step (the sentence about visiting `http://localhost:5173/__smoke?fire=render` and checking DevTools for a Sentry event ID) but per template it belongs in a human-check section; move that sentence out of the automated block and into a `<human-check>` block (or annotate the relevant step as a validation step) so the automated section only contains automated/deterministic checks; update the plan to reference the manual check in the new `<human-check>` or the specific task `<human-check>` instead.

---

## Consensus Summary

Three independent reviewers converge on a "ship-with-fixes" verdict: Gemini judged the plans LOW risk and ready, Codex judged them MEDIUM with two HIGH-severity correctness blockers in Plan 01, and CodeRabbit produced 14 line-level findings on the plan docs. No reviewer asked for the phase to be re-scoped or rewritten. The HIGH-severity concerns are scoped to two specific implementation choices in Plan 01 (impossible grep + event-id surfacing location); fixing those drops the phase to LOW risk per Codex's own assessment.

### Agreed Strengths

- **Empirical Sentry verification via distinct error messages** (Codex, Gemini): both note OBSV-03/OBSV-05 use DISTINCT messages so Dedupe can't mask the second event — a deliberate design move that survives independent scrutiny.
- **Zero-dependency, build-time sourcemap regression guard** (Codex, Gemini): `verify-sourcemap-names.mjs` is the right shape — small, hermetic, easily extended, and pinned to the `keepNames: true` contract that Sentry depends on.
- **Strong traceability** (Codex, Gemini): both reviewers explicitly call out the requirement → plan → evidence → issue-closure chain as a strength.
- **Clear phase boundary** (Codex, Gemini): no schema changes, no E2E fixture churn, no production mutations — observation-only phase that fits the "verify and close" mandate.
- **Reasonable use of existing surfaces** (Codex, implicit in Gemini): `/__smoke`, Netlify deploy preview, existing Sentry setup, existing CI workflow — no new infrastructure introduced.

### Agreed Concerns

**HIGH (raised by 1 reviewer, but treated as blocking by Codex):**

1. **Plan 01 has an impossible acceptance grep.** The plan requires literal source strings `OBSV-03 render` / `OBSV-05 dedupe` AND a grep against `src/` for `OBSV-0[345]` returning zero. The two are mutually exclusive. (Codex HIGH)
2. **`Sentry.lastEventId()` surface is placed below the catching error boundary.** A render-phase throw inside `/__smoke` is caught by the app-level `Sentry.ErrorBoundary` which replaces the subtree with `AppErrorFallback`; the `useEffect` in `SmokePage` that writes `document.body.dataset.sentryEventId` never runs on direct visits. Gemini also raised this as a LOW "Dedupe Timing" concern but understated the structural severity. (Codex HIGH; Gemini LOW, weaker form)

**MEDIUM (multiple reviewers or material gaps):**

3. **OBSV-05 evidence does not prove "one event per error".** Distinct IDs prove dedupe didn't mask the second event, but they don't disprove that each scenario emitted N>1 events. Need an explicit per-message event count in Sentry over a tight timestamp window. (Codex MEDIUM)
4. **Deploy-preview Sentry token scoping is under-specified.** `SENTRY_AUTH_TOKEN` on all previews exposes a release-upload token to PR builds. Needs a scope/rotation/branch-limit story. (Codex MEDIUM)
5. **Sentry release-name consistency not explicitly verified.** Runtime events tag release with `VITE_COMMIT_SHA`; the Vite plugin auto-detects release; Plan 04 should assert event release == artifact release == `head_sha` before treating the artifacts query as authoritative. (Codex MEDIUM)
6. **Plan doc accuracy drift** (CodeRabbit Findings 1, 2, 3, 7, 8, 9, 10, 11, 12, 14): mostly correctness fixes to plan/validation docs — wrong script names (`npm run test:e2e` vs `npm run e2e`), stale Vitest version, stale ROADMAP Phase 14 status row, single-digit regex that fails ≥10, env-var unset vs empty-string distinction, unconditional `npm run build` mandate, read-then-increment for `progress.completed_phases`, eslint-ignore claim unverified, manual step misplaced in automated acceptance block.

**LOW:**

7. **CI runtime concern.** Adding `npm run build` to `lint-and-unit` increases per-push CI duration; current 10-min timeout may be tight. (Codex LOW; Gemini LOW)
8. **Allowlist brittleness in `verify-sourcemap-names.mjs`.** Future refactors that rename `ConsentProvider` (etc.) break CI; mitigation present but worth re-flagging. (Gemini LOW)
9. **Stale frontmatter file lists.** Plan 01 likely modifies `RenderThrowSmoke.tsx`; Plan 05 modifies `.planning/REQUIREMENTS.md` — neither listed in frontmatter. (Codex LOW)
10. **`npx @sentry/cli@latest` is unpinned.** Prefer transitive CLI from lockfile or a pinned version. (Codex LOW)
11. **Operator-friendliness gaps in Plan 04** (CodeRabbit Findings 4, 5, 13): missing `gh run watch` timeout guidance, no "confirm `<id1>` ≠ `<id2>`" resume-signal contract, no Task 2 pre-condition check on Task 4.

### Divergent Views

- **Overall risk level diverges.** Gemini rates the phase LOW and ready-to-ship; Codex rates it MEDIUM citing two blockers. Source of divergence: Codex performed a stricter "would the acceptance steps actually pass?" walkthrough and surfaced two correctness gaps that Gemini's high-level assessment missed.
- **`Sentry.lastEventId()` surfacing severity.** Codex calls it HIGH (the `useEffect` never runs because the boundary replaces the subtree); Gemini calls it LOW (just timing-of-transport flush). The Codex framing is structurally correct — once the boundary catches the render throw, the SmokePage component is unmounted; this isn't a timing issue, it's an unreachability issue.
- **Whether the plan is ready as-is.** Gemini: ready ("Gold Standard"). Codex: needs three fixes (grep, event-id surface, OBSV-05 count check) before execution. CodeRabbit: 14 mechanical fixes needed across plan docs.

### Suggested Pre-Execution Fixes (Ranked)

Highest leverage first — addresses HIGH concerns and meaningfully reduces execution risk:

1. **Fix Plan 01 grep self-collision** (Codex HIGH). Either exclude string literals from the archaeology check, or remove `OBSV-0[345]` from the forbidden pattern entirely (those IDs are not "rot tags" when used as Sentry error message strings — they're load-bearing).
2. **Relocate `Sentry.lastEventId()` surface** (Codex HIGH). Either add a local `Sentry.ErrorBoundary` inside `/__smoke` whose `onError` writes the event ID, or extend `AppErrorFallback` to write the dataset when current path is `/__smoke`. Do not rely on `SmokePage.useEffect` after a render-phase throw.
3. **Strengthen OBSV-05 evidence to per-message event count** (Codex MEDIUM). Capture a Sentry events query screenshot showing exactly N=1 events per distinct message in a tight window, not just two distinct IDs.
4. **Plan doc accuracy sweep** (CodeRabbit Findings 1, 2, 3, 7, 8, 9, 10, 11, 12, 14). Mechanical but each is a real correctness gap in plan/validation docs and addressable as a single editorial pass before Wave 1.
5. **Pin Sentry CLI + verify release consistency in Plan 04** (Codex MEDIUM/LOW). One-line `npx @sentry/cli info` pre-check plus a release-name assertion.
6. **Operator-friendliness fixes in Plan 04** (CodeRabbit Findings 4, 5, 13). Add `gh run watch` timeout guidance, resume-signal contract requiring distinct event IDs, and Task 2 pre-condition check on Task 4.

Items 1, 2, and 3 are the only execution-blockers; items 4-6 are quality-of-life upgrades that can be incorporated as the editorial pass before Wave 1 lands.
