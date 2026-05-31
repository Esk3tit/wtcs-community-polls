---
phase: 15
review_cycle: 3
reviewers: [codex, gemini, coderabbit]
reviewed_at: 2026-05-18T07:30:00Z
plans_reviewed:
  - 15-01-PLAN.md
  - 15-02-PLAN.md
  - 15-03-PLAN.md
  - 15-04-PLAN.md
  - 15-05-PLAN.md
prior_cycle:
  cycle: 2
  reviewed_at: 2026-05-18T06:00:51Z
  high_concerns_addressed: 1 # HIGH cycle-2 evidence-integrity (dual-capture race) — closed via beforeCapture tag + dashboard event_id == dataset ID cross-check
unavailable_reviewers:
  - claude (self — running inside Claude Code CLI; skipped for independence)
  - cursor (usage limit — same as cycles 1 and 2; aborted with "You've hit your usage limit")
  - opencode (CLI not installed)
  - qwen (CLI not installed)
  - ollama (local server not running)
  - lm_studio (local server not running)
  - llama_cpp (local server not running)
---

# Cross-AI Plan Review — Phase 15 (Cycle 3)

Phase 15 — Observability + E2E Verify & Close — cycle-3 independent review by Codex, Gemini, and CodeRabbit. Cursor reviewer aborted due to usage limit (same as cycles 1+2); Claude skipped (self). All three responding reviewers produced substantive feedback; review proceeded as the gsd-review skill requires `at least one DIFFERENT CLI must be available`.

The cycle-2 review surfaced one new HIGH-severity evidence-integrity concern (Codex local probe): under React 19 `createRoot.onCaughtError` + `Sentry.dedupeIntegration()`, the local-boundary `onError`-surfaced event ID may not be the event Sentry actually persists, because Dedupe may drop the local-boundary capture in favor of the root-handler auto-capture (or vice versa). Cycle-3 replan (commit 8d50011) addressed this via:
1. Plan 01 Task 2 — `beforeCapture={(scope) => scope.setTag('boundary', 'app-root')}` on the local `Sentry.ErrorBoundary` so whichever event Dedupe keeps still carries the canonical tag.
2. Plan 04 Task 3 — mandatory dashboard `event_id == dataset ID` cross-check; both dataset and persisted IDs recorded with explicit `match: yes|no` status.

Cycle-3 also addressed cycle-2 MEDIUMs (deprecated `releases files list` → preferred `sourcemaps list`; Netlify `--scope builds` filter; sentry-cli exact-pin resolution; per-message OBSV-05 count via Discover/Event Explorer) and LOWs (6→7 PNG count consistency; macOS timeout portability; tightened comment-archaeology grep; `unused-disable-directive` warning acknowledgement). This cycle-3 review evaluates whether those fixes hold.

---

## Codex Review

**Summary**
Cycle 3 resolves the original evidence-integrity problem: the plan no longer treats the local boundary's surfaced ID as authoritative, and it requires the persisted Sentry event ID plus `boundary: app-root` confirmation. However, I would not execute this exact text yet. I found a few operator/plan-execution issues that are small to fix but material enough to justify a short Cycle 4 cleanup.

**HIGH-2 Verdict — RESOLVED**
The `beforeCapture` tag on the local boundary plus the Plan 04 dashboard cross-check resolves the Cycle 2 HIGH. If Dedupe keeps the local boundary event, it now has `boundary: app-root`; if Dedupe keeps the React root `onCaughtError` event, that already has the same tag. Plan 04 correctly records both dataset and persisted IDs and uses the persisted ID as evidence.

Residual edge: message-based fallback lookup should also require timestamp/window matching the just-fired smoke. Otherwise, a stale same-release event from an earlier retry could be mistaken for the current persisted event.

**Strengths**
- Local boundary fixes the original unreachable `useEffect`/outer-boundary unmount problem.
- Dataset ID is no longer treated as authoritative; persisted ID is explicitly recorded.
- `--scope builds` is correctly added for `netlify env:list`.
- Sentry CLI pinning is much better: lockfile-resolved `npx --no-install @sentry/cli`, fallback to exact package-lock version.
- 7-PNG accounting is now consistent in Plans 04/05.
- OBSV-05 count evidence now uses per-event Discover/Event Explorer rather than Issues grouping.

**New Concerns**
- **MEDIUM — Proposed `eslint-disable-next-line no-console` likely blocks commits.** `npm run lint` may exit 0 with an unused-disable warning, but this repo's pre-commit path runs `lint-staged` with `--max-warnings 0`. I verified the proposed directive fails under that mode. Remove the unused disable for now or explicitly bypass/adjust the hook; do not leave the plan saying it is harmless.
- **MEDIUM — Netlify remediation command uses invalid flag form.** `netlify env:set --help` shows `--scope <scope...>`, not `--scopes`. The widening command should be `--scope builds functions runtime post-processing`, or the UI path should be preferred.
- **MEDIUM — `sourcemaps list` is not supported by the lockfile CLI.** The repo resolves `@sentry/cli` to `2.58.5`; I verified `npx --no-install @sentry/cli sourcemaps list` errors with "unrecognized subcommand 'list'". The fallback is allowed, so not a blocker, but the plan should state that the current expected path is the deprecated `releases files ... list` fallback with justification unless a newer exact CLI/API surface is chosen.
- **LOW — Plan 01 is internally inconsistent about `Sentry.lastEventId()`.** Must-haves say `Sentry.lastEventId()` is surfaced; Task 2 says no `lastEventId()` call is needed and uses the ErrorBoundary `eventId` arg. Pick one wording. The implementation should probably say "Sentry ErrorBoundary event ID" unless you intentionally call `Sentry.lastEventId()` inside `onError`.
- **LOW — Comment-archaeology grep is still partly false-negative.** The "string-literal exclusion" grep would miss `const message = 'OBSV-03 render' // D-01` because the whole line is excluded. Require the comment-line-scope grep only.
- **LOW — Sample code comment violates the plan's own source-comment rule.** The sample `beforeCapture` comment mentions `OBSV-03` inside `src/` code. Executor can avoid copying it, but the plan should not model forbidden comments.

**Carry-Forward Concern Status**
- Acceptance-grep self-collision: **mostly addressed**, but the alternate string-literal exclusion still has the trailing-comment false-negative above.
- Local boundary unreachable event ID: **addressed**.
- Local boundary event ID non-authoritative: **addressed** via persisted-ID cross-check.
- Netlify deploy-preview env scoping: **addressed for list**, but remediation command needs `--scope`, not `--scopes`.
- Sentry CLI pinning: **addressed**.
- Sentry artifact surface deprecation: **partially addressed**; fallback is valid, but current CLI makes fallback the expected path.
- OBSV-05 per-event count: **addressed**.
- 6→7 PNG drift: **addressed**.
- macOS timeout portability: **addressed**.
- Inline comment archaeology: **partially addressed**, because one accepted grep form still misses the inline case.
- `no-console` unused-disable warning: **not fully addressed** because pre-commit treats warnings as fatal.

**Risk Assessment — MEDIUM**
The core Sentry evidence model is now sound. The remaining risk is execution reliability: a commit-hook blocker, one invalid Netlify CLI flag, and stale/unsupported Sentry CLI wording could derail the operator path.

**Recommendation — CYCLE 4**
Do a small Cycle 4 text-only cleanup. No redesign needed: fix the `no-console` directive plan, correct Netlify `--scope`, make the Sentry CLI fallback explicit for `2.58.5`, tighten the grep, and align `lastEventId` wording. Then execute.

---

## Gemini Review

The **Phase 15 Cycle 3** implementation plans are **SHIPPING-READY**. This cycle successfully resolves the high-severity evidence-integrity concerns introduced by React 19's dual-capture behavior and significantly strengthens the verification protocols for Sentry and CI.

### 1. HIGH-2 Verdict: RESOLVED
The "Local boundary event ID can be non-authoritative" concern is fully addressed through a two-layered defense:
- **Tag Invariant (Plan 01 Task 2):** By adding `beforeCapture` to the local `Sentry.ErrorBoundary` and mirroring the canonical `boundary: app-root` tag from `main.tsx`, the plan ensures that regardless of which event `Sentry.dedupeIntegration()` preserves (the local capture or the root auto-capture), the required tag is present.
- **Operator Protocol (Plan 04 Task 3):** The manual verification instructions explicitly acknowledge that the surfaced dataset ID may be deduped. The mandatory "dashboard cross-check" protocol provides a reliable fallback (lookup by message + release + tag) to identify the persisted "survivor" event, ensuring evidence integrity.

### 2. Strengths
- **Robust `sentry-cli` Pinning:** Plan 04 Task 4 implements a strict resolution order (lockfile-transitive → exact pinned version) that avoids the risks of `@latest` drift and CLI-flag changes within the `2.x` major range.
- **Modern Sentry Surfaces:** The preference for `sourcemaps list` (artifact bundles) over the deprecated `releases files list` aligns with current Sentry best practices.
- **Definitive Dedupe Proof:** The addition of `sentry-obsv-05-counts.png` using Sentry Discover/Event Explorer to confirm exactly **N=1 event** per distinct message provides empirical proof that the triple-handler path is correctly collapsing.
- **Platform Portability:** Plan 04 Task 1 provides a shell-loop fallback for the `timeout` command, ensuring the CI-watch logic is portable to macOS (the operator's primary workstation).

### 3. New Concerns
- **None (HIGH/MEDIUM/LOW):** The Cycle 3 changes are surgical and specifically targeted at previous review findings without introducing new regressions.

### 4. Carry-Forward Concern Status
- **MEDIUM-2 (Deprecated surface):** ADDRESSED. Plan 04 Task 4 prefers `sourcemaps list` and requires justification for the fallback.
- **MEDIUM-4 (Issues count vs Event count):** ADDRESSED. Plan 04 Task 3 now requires Discover/Event-Explorer counts (N=1).
- **MEDIUM-5 (Netlify env scope):** ADDRESSED. Plan 04 Task 2 uses the `--scope builds` filter.
- **MEDIUM-6 (CLI Pinning):** ADDRESSED. Plan 04 Task 4 uses exact pins derived from `package-lock.json`.
- **LOW-7 (PNG count drift):** ADDRESSED. Consistent 7-PNG accounting across all plans.
- **LOW-8 (Timeout portability):** ADDRESSED. Shell loop fallback provided.
- **LOW-10 (Grep archaeology):** ADDRESSED. Plan 01 Task 1/2 use a tightened grep that catches trailing inline comments.
- **LOW-11 (Unused eslint-disable):** ADDRESSED. Acknowledged in Plan 01 Task 2 as an intentional, future-proof directive.

### 5. Risk Assessment: LOW
The phase remains a verify-and-close phase with zero schema changes and zero production functional changes. The smoke harness is strictly gated by the existing `beforeLoad` production gate.

### 6. Recommendation: EXECUTE
The Cycle 3 plans hold a high standard for evidence quality and technical accuracy. I recommend proceeding with execution.

**Summary of 7 PNG Artifacts for Plan 05 Tracking:**
1. `sentry-obsv-03-event.png`
2. `sentry-obsv-04-stack.png`
3. `sentry-obsv-05-dedupe.png`
4. `sentry-obsv-05-counts.png` (N=1 Discover proof)
5. `ci-test-14-pass.png`
6. `ci-test-15-pass.png`
7. `ci-test-16-pass.png`

---

## CodeRabbit Review

CodeRabbit reviews the working tree directly (not via prompt) against the diff vs `main`. CodeRabbit produced 3 findings on the Phase 15 cycle-3 working tree: 1 `potential_issue` (minor) on 15-CONTEXT.md status field staleness, 1 `potential_issue` (major) on Plan 02 regex tightening (Plan 02 was unchanged in cycle 3, so this is a carry-over from cycle 1's editorial sweep that was never landed in source — the cycle-2 review didn't pick it up because cycle-2 CodeRabbit scope was different), and 1 `nitpick` (trivial) on an unrelated test file initialization. Findings reproduced verbatim:

### Finding 1 — 15-CONTEXT.md L3-5 (potential_issue / LOW — minor)

In `.planning/phases/15-observability-e2e-verify-close/15-CONTEXT.md` around lines 3-5, update the CONTEXT `Status:` field in the file so it reflects the current phase lifecycle instead of "Ready for planning" — open the .planning CONTEXT markdown, locate the Status: line and replace the stale value with an accurate lifecycle string such as "Planning in progress" or "Planning complete (2026-05-18)"; ensure the surrounding Gathered: and Status: markup remains intact and commit the change.

(Note: this is a docs hygiene finding — CONTEXT.md's `Status: Ready for planning` is stale once Plans 01–05 exist. Not a ship blocker; cosmetic.)

### Finding 2 — 15-02-PLAN.md L145-147 (potential_issue / MEDIUM — major)

In `.planning/phases/15-observability-e2e-verify-close/15-02-PLAN.md` around lines 145-147, the current matcher builds `RegExp` using `\\bfunction ${name}\\b` which can match non-declaration text; update the RegExp construction so it requires the literal opening parenthesis after the function name (e.g., build `new RegExp("\\\\bfunction ${name}\\\\s*\\\\(")` or equivalent) and update the adjacent example inline comment (the resolved regex literal shown next to the ALLOWLIST example) to reflect the tightened pattern; ensure the logic that collects non-matches into `const missing` still uses this new RegExp so only real `function Name(` declarations pass.

(Note: this is about Plan 02's `verify-sourcemap-names.mjs` regex matcher — without `\(` anchor after the name, a docstring or template literal containing the substring `function Foo` could yield a false PASS. Plan 02 was untouched in cycle 3 — this finding was missed in cycles 1+2 CodeRabbit sweeps. Material enough to escalate as MEDIUM since Plan 02 IS load-bearing for the OBSV-04 regression guard.)

### Finding 3 — src/__tests__/admin/polls-effective-invariant.test.ts L23 (nitpick / LOW — trivial)

In `src/__tests__/admin/polls-effective-invariant.test.ts` at line 23, restore the original defensive initialization for the test-local variable by initializing entries to an empty array (e.g., `let entries: string[] = []`) so the variable has a safe fallback; update the declaration of entries in the polls-effective-invariant.test to include the `= []` initializer to keep the test resilient to future changes.

(Note: unrelated to Phase 15 — this is a diff artifact from the chore/deps branch we're on, not a Phase 15 plan finding. Tagged for awareness but explicitly out-of-scope for this review.)

---

## Consensus Summary

Three independent reviewers converge on a "cycle-2 HIGH evidence-integrity concern is RESOLVED" verdict — but **diverge on ship-readiness**:

- **Gemini**: LOW risk, EXECUTE. All cycle-2 MEDIUM/LOW concerns addressed; no new findings.
- **Codex**: MEDIUM risk, **CYCLE 4** (text-only cleanup, no redesign). HIGH-2 fully resolved, but three NEW MEDIUM-severity operator-path concerns surfaced via empirical probes against the actual environment:
  1. `lint-staged` runs `eslint --max-warnings 0 --no-warn-ignored` on staged `.tsx` files (verified in `package.json`) — the proposed `eslint-disable-next-line no-console` directive emits an `unused-disable-directive` warning under the project's flat config (where `no-console` is NOT enabled) and will FAIL the commit hook, not just produce a `npm run lint` warning. Plan 01 Task 2 currently says "lint still exits 0" which is true for `npm run lint` but FALSE for `lint-staged --max-warnings 0`.
  2. Plan 04 Task 2 remediation command uses `--scopes builds,functions,runtime,post-processing` (plural `--scopes`, comma-separated). Verified via `netlify env:set --help`: the flag is `--scope <scope...>` (singular, variadic, space-separated).
  3. `@sentry/cli@2.58.5` (verified resolved version in `package-lock.json`) does NOT support `sourcemaps list` — only `inject`, `resolve`, `upload`, `help`. Plan 04 Task 4's "preferred" surface will fail; the operator hits the fallback (`releases files <release> list`, deprecated) every time. The plan should reframe so the fallback is the expected path and the artifact-bundle surface is only attempted if a future CLI bump enables `sourcemaps list`.
- **CodeRabbit**: 1 MEDIUM/major (Plan 02 regex needs `\(` anchor — a carry-over Plan 02 finding that cycles 1+2 missed) + 1 LOW/minor (CONTEXT.md `Status:` is stale) + 1 LOW/trivial (unrelated test file from chore branch). CodeRabbit does NOT take a ship-readiness position; the regex finding is on Plan 02 which is otherwise unchanged in cycle 3.

The source of divergence between Codex and Gemini: **Codex ran empirical probes against the actual repository state** (`package.json` lint-staged config, `netlify env:set --help`, `npx --no-install @sentry/cli sourcemaps --help`) and observed concrete failure modes; Gemini reviewed the plan text as written and accepted its claims at face value. Codex's three NEW MEDIUMs are all reproducible findings against the current codebase, NOT speculative concerns.

### Agreed Strengths

- **HIGH-2 (local-vs-root dual-capture race): RESOLVED** by both Gemini and Codex. The `beforeCapture` tag on the local boundary makes the tag invariant survive either Dedupe outcome; Plan 04 Task 3's dashboard `event_id == dataset ID` cross-check makes the persisted-event-id authoritative for evidence.
- **Sentry-cli pinning resolution order** (lockfile-resolved transitive → exact `package-lock.json` version → NEVER `@latest`/major-range) is the right shape (Codex + Gemini agree on the form; Codex flags an issue with the surface name only).
- **Netlify `--scope builds` filter on the READ side** (`netlify env:list --context deploy-preview --scope builds`) is correct (Codex + Gemini agree).
- **Per-EVENT OBSV-05 count via Discover / Event Explorer** (NOT Issues search) is the right strengthening for proving the triple-handler path collapses to one persisted event per scenario (Codex + Gemini agree).
- **7-PNG accounting consistent across Plan 04 and Plan 05** (Gemini explicitly confirms; CodeRabbit had no 6→7 finding this cycle, validating that the cycle-3 fix landed).
- **macOS `timeout` portability** with `gtimeout` / GNU `timeout` / shell-loop fallback (Codex + Gemini agree).

### Agreed Concerns

**MEDIUM (Codex empirical findings — these are the cycle-3 ship blockers):**

1. **`lint-staged` `--max-warnings 0` fails on `unused-disable-directive` warning.** The proposed `// eslint-disable-next-line no-console -- intentional eventId surface for smoke verifier` directive in Plan 01 Task 2 is currently a no-op (because `eslint.config.js` doesn't enable `no-console`); ESLint emits an `unused-disable-directive` WARNING. The project's pre-commit hook runs `eslint --max-warnings 0 --no-warn-ignored` on staged `.tsx` files, so the warning will FAIL the commit. Plan 01 Task 2's claim that "lint still exits 0 today" is true for `npm run lint` but FALSE for the actual commit path. **Fix options (Codex suggestion):**
   - Remove the disable directive entirely (since `no-console` isn't enabled, the bare `console.log` lints clean), OR
   - Enable `no-console` project-wide in `eslint.config.js` so the disable directive becomes load-bearing instead of unused, OR
   - Use `// eslint-disable-next-line @typescript-eslint/no-explicit-any` or another genuinely-enforced rule that the line ALSO triggers (none currently fits), OR
   - Configure `lint-staged` to allow `unused-disable-directive` warnings (project-wide config change, lowest preference).
   The simplest fix: **remove the disable directive** (the WHY-comment above the `console.log` still satisfies the "intentional smoke verifier" rationale).

2. **Plan 04 Task 2 remediation uses invalid `--scopes` flag form.** The CLI flag is `--scope <scope...>` (singular, variadic, space-separated). The plan currently shows `--scopes builds,functions,runtime,post-processing` which `netlify env:set` will not accept. **Fix:** change to `--scope builds functions runtime post-processing` (space-separated, singular flag name), or recommend the UI path as primary.

3. **Plan 04 Task 4 preferred surface (`sourcemaps list`) is unsupported by `@sentry/cli@2.58.5`.** The lockfile-resolved CLI has subcommands `inject`, `resolve`, `upload`, `help` — no `list`. The "preferred" path fails with "unrecognized subcommand 'list'" and the operator falls through to the deprecated `releases files <release> list` fallback every time. **Fix options (Codex suggestion):**
   - Reframe Plan 04 Task 4 so the deprecated `releases files list` IS the expected path under `@sentry/cli@2.x` (with a recorded deprecation note + justification), AND `sourcemaps list` is documented as the FUTURE preferred path once `@sentry/cli` ships `sourcemaps list` (Sentry has signalled this for a future major), OR
   - Add a runtime check that probes `npx --no-install @sentry/cli sourcemaps --help` and selects the surface based on what's actually available, OR
   - Bump `@sentry/cli` to a version that supports `sourcemaps list` (Codex did not verify whether any 2.x supports it; out-of-scope for this review).

**LOW (Codex + CodeRabbit):**

4. **Plan 02 regex matcher needs `\(` anchor (CodeRabbit MEDIUM/major).** `\\bfunction ${name}\\b` matches non-declaration text (e.g., `function Foo` inside a string literal or docstring). Tighten to `new RegExp("\\\\bfunction " + name + "\\\\s*\\\\(")` so only literal `function Name(` declarations are accepted. Plan 02 was untouched in cycle 3 — this finding was missed in cycles 1+2 CodeRabbit sweeps. It's a Plan 02 robustness concern, not a Plan 01/04/05 concern; can be fixed in cycle 4 or as a small Plan 02 edit before execution.

5. **Plan 01 internal inconsistency: `Sentry.lastEventId()` vs ErrorBoundary `eventId` arg.** Plan 01 must-haves say `Sentry.lastEventId()` is surfaced; Plan 01 Task 2 says no `lastEventId()` call is needed because the ErrorBoundary `onError(eventId)` arg suffices. The two statements describe the same value (Sentry's last captured event ID at the moment the boundary catches), but the wording inconsistency is real. **Fix:** rewrite the must-have line to "the ErrorBoundary-supplied `eventId` is surfaced both via console.log AND on document.body.dataset.sentryEventId" (matching Task 2's actual implementation). The `Sentry.lastEventId()` API reference can stay in `<interfaces>` for context.

6. **Plan 01 sample `beforeCapture` arrow body contains a comment that violates the source-comment rule.** Lines 200–203 of Plan 01 show:
   ```ts
   beforeCapture={(scope) => {
     // Canonical tag mirrors src/main.tsx Sentry.ErrorBoundary's tag so whichever
     // event Sentry.dedupeIntegration() keeps (this local capture OR the root
     // onCaughtError auto-capture) still carries `boundary: app-root` —
     // OBSV-03's tag-presence acceptance criterion holds either way.
     scope.setTag('boundary', 'app-root')
   }}
   ```
   The reference to `OBSV-03's tag-presence acceptance criterion` is plan-archaeology. If an executor copies this comment verbatim into `src/routes/[__smoke].tsx`, it will be flagged by the plan's OWN comment-archaeology grep (line 248: `grep -nE "Phase 15|OBSV-0[345]|D-0[1-9]|D-1[0-6]" src/routes/\\[__smoke\\].tsx`). **Fix:** rewrite the sample comment to be plan-ID-free, e.g., "Canonical tag mirrors `src/main.tsx`'s root boundary so whichever capture Dedupe keeps carries the tag — render-throw / dedupe smoke evidence stays consistent."

7. **Comment-archaeology grep "string-literal exclusion" form is still false-negative on trailing-comment lines.** A line like `const message = 'OBSV-03 render' // D-01` is excluded entirely by `grep -v "'OBSV-03 render'"` because the whole line is excluded. Plan 01 Task 1+2 offer this form as an alternative to the comment-line-scope grep. **Fix:** drop the string-literal exclusion form; require the comment-line-scope grep (which catches both `^\s*//` AND inline ` // ` patterns per the cycle-3 tightening).

**LOW (CodeRabbit):**

8. **15-CONTEXT.md `Status: Ready for planning` is stale.** Plans 01–05 already exist; update to `Planning complete (2026-05-18)` or equivalent lifecycle marker. Cosmetic; not a ship blocker.

### Divergent Views

- **Ship-readiness (Codex CYCLE 4 vs Gemini EXECUTE).** Codex's empirical probes against the actual repository state (`package.json`, `netlify env:set --help`, `npx @sentry/cli sourcemaps --help`) surface three concrete failure modes in the operator path that Gemini's plan-text review didn't probe. None require a redesign — the cycle-2 HIGH evidence-integrity concern IS fully resolved by the cycle-3 `beforeCapture` + dashboard cross-check — but the operator instructions as written will hit invalid CLI flags and a blocking commit hook. **The Codex framing is more rigorous and is the framing this cycle should adopt** — cycle 3 needs a small text-only cleanup before execution, not a redesign.
- **Plan 02 regex (CodeRabbit MEDIUM/major).** Independent of the cycle-3 changes. Plan 02 was untouched in cycle 3. This finding should be folded into cycle 4 or addressed as a separate small Plan 02 edit.

### Suggested Pre-Execution Fixes (Ranked)

Highest leverage first — addresses MEDIUM concerns:

1. **Remove the `eslint-disable-next-line no-console` directive from Plan 01 Task 2** (Codex MEDIUM #1). The `console.log` is already clean under the current flat config (no `no-console` rule enabled); the directive only adds a warning that fails `lint-staged --max-warnings 0`. WHY-comment above the `console.log` is sufficient to satisfy "intentional smoke verifier" rationale. Update the acceptance grep accordingly.
2. **Fix Plan 04 Task 2 widening command to `--scope <scope...>` (singular, variadic, space-separated)** (Codex MEDIUM #2). Change `--scopes builds,functions,runtime,post-processing` → `--scope builds functions runtime post-processing` everywhere it appears.
3. **Reframe Plan 04 Task 4 so the deprecated `releases files list` IS the expected path under `@sentry/cli@2.x`** (Codex MEDIUM #3). Keep the resolution-order logic, but flip the preference: under `@sentry/cli@2.58.5` (verified lockfile resolution), `sourcemaps list` is not a subcommand — record the deprecation note + justification for using `releases files list`, and document `sourcemaps list` as the FUTURE preferred path once `@sentry/cli` ships `sourcemaps list` (or upgrade `@sentry/cli` in a separate phase).
4. **Tighten Plan 02 regex matcher to require `\(` after the function name** (CodeRabbit MEDIUM). `new RegExp("\\\\bfunction " + name + "\\\\s*\\\\(")` or equivalent — prevents string-literal false-positives in the OBSV-04 build-time gate. Folds into cycle 4 as a Plan 02 edit.
5. **Drop the string-literal-exclusion grep form** in Plan 01 Task 1+2 (Codex LOW #7); require the comment-line-scope grep only.
6. **Rewrite the Plan 01 sample `beforeCapture` arrow body comment** to be plan-ID-free (Codex LOW #6); the sample should not model forbidden comment patterns.
7. **Align Plan 01 wording on `Sentry.lastEventId()` vs ErrorBoundary `eventId`** (Codex LOW #5); rewrite the must-have line to describe the ErrorBoundary-supplied eventId.
8. **Update 15-CONTEXT.md `Status:` to `Planning complete`** (CodeRabbit LOW). Cosmetic.

Items 1, 2, 3 are operator-path blockers per Codex's MEDIUM framing. Item 4 is a Plan 02 robustness upgrade. Items 5–8 are quality-of-life upgrades.

### Cycle-3 Net Assessment

The cycle-2 HIGH evidence-integrity concern (local-vs-root dual-capture race) is **fully resolved**. Both reviewers (Gemini + Codex) explicitly agree: the `beforeCapture` tag invariant makes the `boundary: app-root` acceptance criterion survive either Dedupe outcome, and the Plan 04 Task 3 dashboard cross-check makes the persisted event ID authoritative for evidence. No HIGH-severity concerns remain.

However, **three NEW MEDIUM-severity operator-path concerns emerged from Codex's empirical probes against the actual repository state**:
- `lint-staged --max-warnings 0` blocks commits on the proposed `eslint-disable-next-line no-console` unused-disable warning.
- `netlify env:set` uses `--scope <scope...>` (variadic), NOT `--scopes <csv>`.
- `@sentry/cli@2.58.5` does not support `sourcemaps list` — the "preferred" Plan 04 Task 4 surface always falls through to the deprecated fallback.

Plus 1 MEDIUM/major from CodeRabbit on Plan 02 (regex needs `\(` anchor — Plan 02 was untouched in cycle 3 so this is a carry-over).

**Recommended path forward:** run cycle 4 as a small text-only cleanup. No HIGH-severity replan required. The cycle-2 HIGH fix is durable; the cycle-3 MEDIUMs are all "the operator command doesn't work" issues that resolve with copy edits.

Alternatively, accept Codex's MEDIUMs as known-but-tolerable operator papercuts and proceed to execution with the executor noting the corrections inline during Plan 01/04 execution (Gemini's implicit framing). This is defensible if execution will be hands-on and the operator will recognize and fix the invalid flags / unsupported subcommand on the fly. But it shifts risk from planning to execution, against the project's stated preference for "plan-driven execution" (per ROADMAP/PROJECT.md).

The convergence loop should run one more cycle (cycle 4) to land the text-only corrections, then proceed to execution with cycle 4 as the final plan revision.
