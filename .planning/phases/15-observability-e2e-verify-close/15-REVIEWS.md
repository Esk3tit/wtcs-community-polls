---
phase: 15
review_cycle: 2
reviewers: [codex, gemini, coderabbit]
reviewed_at: 2026-05-18T06:00:51Z
plans_reviewed:
  - 15-01-PLAN.md
  - 15-02-PLAN.md
  - 15-03-PLAN.md
  - 15-04-PLAN.md
  - 15-05-PLAN.md
prior_cycle:
  cycle: 1
  reviewed_at: 2026-05-18T05:31:50Z
  high_concerns_addressed: 2 # HIGH-1 grep self-collision; HIGH-2 useEffect unreachable
unavailable_reviewers:
  - claude (self — running inside Claude Code CLI; skipped for independence)
  - cursor (usage limit — same as cycle 1)
  - opencode (CLI not installed)
  - qwen (CLI not installed)
  - ollama (local server not running)
  - lm_studio (local server not running)
  - llama_cpp (local server not running)
---

# Cross-AI Plan Review — Phase 15 (Cycle 2)

Phase 15 — Observability + E2E Verify & Close — cycle-2 independent review by Codex, Gemini, and CodeRabbit. Cursor reviewer aborted due to usage limit (same as cycle 1); Claude skipped (self). All three responding reviewers produced substantive feedback; review proceeded as the gsd-review skill requires `at least one DIFFERENT CLI must be available`.

The cycle-1 review surfaced two HIGH-severity blockers in Plan 01 (acceptance-grep self-collision; `Sentry.lastEventId()` surface unreachable because the app-level boundary unmounts `SmokePage`). The cycle-2 replan addressed both, plus the cycle-1 MEDIUM concerns (OBSV-05 per-message count strengthening, Netlify env-var pre-flight, Sentry release-name consistency, sentry-cli pinning) and the 14 CodeRabbit mechanical findings. This cycle-2 review evaluates whether those fixes hold.

---

## Codex Review

**Summary**
Cycle 2 resolves the Plan 01 grep self-collision, but I would not ship yet. The local `Sentry.ErrorBoundary` fixes the original `useEffect` unmount problem at the React boundary level, but it introduces a new evidence risk: with React 19 root `onCaughtError` plus `Sentry.dedupeIntegration()`, the event ID surfaced from the local boundary can be a dropped duplicate, while the persisted Sentry event is the root-handler event.

**HIGH-1 / HIGH-2 Verdict**
- **HIGH-1: RESOLVED.** The unscoped forbidden grep is explicitly forbidden, and the required OBSV string literals are excluded from the acceptance check.
- **HIGH-2: PARTIALLY RESOLVED.** The local boundary should catch before the outer app boundary and keep `SmokePage` mounted, but the surfaced `eventId` is not reliably the persisted Sentry event ID under the existing root `onCaughtError` + Dedupe path.

**Strengths**
- Plan 01 correctly preserves the legacy `?render=1` canary and prod-gate while adding distinct `?fire=render` / `?fire=dedupe` messages.
- Installed `@sentry/react@10.53.1` does support `onError(error, componentStack, eventId)` on `Sentry.ErrorBoundary`.
- Plan 02's fresh-build requirement before sourcemap-name verification is the right fix for stale `dist/`.
- Plan 03's CI placement checks are much better scoped than cycle 1.
- Plan 04 now has meaningful operator gates for Netlify env presence, Sentry release consistency, and post-capture evidence.
- Plan 05's `completed_phases` read-then-increment approach is implementable against the current `STATE.md`.

**NEW Concerns Introduced**
- **HIGH — Local boundary event ID can be non-authoritative.** I ran a local React 19 / Sentry 10.53 probe with the current root `onCaughtError` shape: the local boundary `onError` logged one event ID, but `beforeSend` only saw the root `auto.function.react.error_handler` event with a different ID and `boundary: app-root`. Plan 04's "matching captured ID OR matching message" can hide this and let final evidence record an ID that is not in Sentry. Fix by surfacing the accepted dashboard event ID, or by adding an event processor/beforeSend verifier and requiring dashboard `event_id == dataset ID`.
- **MEDIUM — Local boundary does not tag its own capture.** If Dedupe ever keeps the local boundary capture instead of the root handler capture, the event may lack `boundary: app-root`. Add `beforeCapture={(scope) => scope.setTag('boundary', 'app-root')}` to the local boundary if it remains.
- **MEDIUM — Sentry artifact verification may be on a deprecated surface.** Local `@sentry/cli@2.58.5` reports `releases files` as deprecated, while Sentry's current sourcemap model emphasizes Debug IDs/artifact bundles. Plan 04 should verify the upload via the sourcemap/debug-ID artifact surface, or explicitly justify legacy release-file listing.
- **LOW — Plan 04/05 drift between six and seven PNGs.** Must-haves say seven artifacts, but several objective/action/output lines still say six. This can cause the new `sentry-obsv-05-counts.png` to be omitted from commit/evidence.
- **LOW — `timeout 1800` is not portable on this macOS workspace.** `timeout` is absent here. Use a shell loop, `perl`, or document `gtimeout` fallback.
- **LOW — The grep fix still misses some comment archaeology.** Both allowed grep forms can miss `const x = 'OBSV-03 render' // D-01` because the whole line is excluded or does not start with a comment marker.
- **LOW — ESLint directive is syntactically valid but currently unused.** `no-console` is not enabled in this flat config, so the requested disable comment produces an unused-disable warning, though `eslint` still exits 0 today.

**Remaining Cycle-1 MEDIUM/LOW Concerns**
- **Per-message OBSV-05 count: still not fully addressed.** Searching Sentry Issues for `message:"..."` and seeing `N=1` can prove one issue/group, not one event. Use Discover/Event Explorer or event ID lists with a timestamp-bounded query and verify exactly one event per message.
- **Deploy-preview token scoping: partially addressed.** `netlify env:list --context deploy-preview` is a valid context filter, but these are build-time Sentry vars. Netlify docs show `--scope builds --context deploy-preview`; add `--scope builds` to avoid a false pass from vars scoped only to functions/runtime.
- **Sentry CLI pinning: partially addressed.** `@sentry/cli@2` is not the current major as of May 2026, and a major range is not a real pin. Prefer the lockfile transitive `npx --no-install @sentry/cli` if intentionally using v2, or pin an exact tested version.
- **Sentry release consistency: addressed.** `event.release == artifact.release == head_sha` is the right invariant, and it catches `SENTRY_RELEASE` override drift.
- **ROADMAP Phase 14 row: addressed.** Current `.planning/ROADMAP.md` shows Phase 14 complete in the v1.3 progress table.

**Risk Assessment**
**HIGH for ship-readiness.** Runtime blast radius is low, but the evidence plan can produce misleading Sentry event IDs and weak Dedupe proof. I would run cycle 3 focused on Plan 01/04 evidence correctness before executing.

Sources checked: Netlify CLI env context/scope docs, Sentry CLI release/version page, and Sentry Debug IDs docs.

---

## Gemini Review

The Cycle-2 replan for Phase 15 is a robust and highly technical response to the Cycle-1 blockers. It successfully transitions from speculative implementation to a concrete, evidence-driven verification framework. By moving the Sentry event ID capture to a local error boundary and refining the automated verification greps to prevent self-collision, the plan has eliminated the primary risks to execution.

### 1. Cycle-1 HIGH Verdicts

| ID | Title | Verdict | Justification |
| :--- | :--- | :--- | :--- |
| **HIGH-1** | Acceptance Grep Collision | **RESOLVED** | The use of `grep -v` (exclusion) and scoped comment-line greps ensures that the presence of the required strings in the code does not trigger a false failure in the "clean code" check. |
| **HIGH-2** | Sentry ID Reachability | **RESOLVED** | Wrapping triggers in a local `Sentry.ErrorBoundary` and using the `onError` callback to write directly to the `document.body` dataset effectively bypasses the app-level unmounting issue. |

### 2. Plan Strengths

- **Surgical Verification (Plan 01):** The local `ErrorBoundary` strategy is technically superior for "smoke testing" because it allows the test runner to stay on the page and verify state (`dataset.sentryEventId`) without needing to handle a full-page crash UI.
- **Production Simulation (Plan 03):** The use of `env -u` to explicitly strip development environment variables during the CI build is an excellent "trust but verify" pattern that ensures the application doesn't have hidden dependencies on local secrets.
- **Evidence Rigor (Plan 04):** Requiring a fourth screenshot for event counts and cross-referencing `release == artifact == sha` creates a high-integrity audit trail that prevents "false green" reports from stale Sentry data.
- **State Integrity (Plan 05):** The programmatic increment of `completed_phases` using shell-based frontmatter parsing is much safer than manual hardcoding and demonstrates good maintenance of the `.planning/` metadata.

### 3. NEW Concerns (Cycle-2)

- **MEDIUM: `onError` Synchronicity and Render-Phase Throws.** While React 19 boundaries catch children, if the error happens during the *render* phase of the component itself, the local boundary must wrap the *caller* or a child that throws. Plan 01 places the boundary *inside* `SmokePage` wrapping the `RenderThrowSmoke` component. If `RenderThrowSmoke` throws during render, the `onError` of the boundary in `SmokePage` will fire. However, the plan should ensure that the `onError` callback correctly receives the `eventId` *before* any potential navigation or page-level fallback occurs.
- **LOW: `env -u` Portability.** The `env -u` command is standard on Linux/macOS (GitHub runners), but if the developer attempts a local dry-run on a non-POSIX environment, it may fail.
- **LOW: ESLint Flat Config syntax.** The plan assumes `eslint-disable-next-line` works for the `no-console` rule. This is standard, but if the project uses a highly customized flat config where `no-console` is handled via a different plugin or severity, the directive might be ignored.

### 4. Remaining Cycle-1 Concerns (Unaddressed)

- **NONE.** All HIGH, MEDIUM, and CodeRabbit mechanical findings from Cycle-1 appear to have been integrated into the Plan 01-05 sequence.

### 5. Risk Assessment: LOW

The overall risk has been downgraded to **LOW**.

The implementation phase is now focused on adding a single diagnostic route and a verification script. The heavy lifting is shifted to the "Evidence" phase (Plan 04), which is appropriately designated as non-autonomous (operator-led). This "Human-in-the-loop" approach for Sentry dashboard verification is the correct architectural choice for observability tasks that cannot be fully automated via standard CI hooks.

### 6. Final Recommendations

1. **Proceed to Execution (Wave 1):** Start Plan 15-01 and 15-02 in parallel.
2. **Verify Sentry v10 `onError`:** During 15-01 execution, confirm that `@sentry/react` v10 (as used in the project) passes the `eventId` as the *third* argument to `onError`. (Standard Sentry docs confirm this, but a quick check of `node_modules` types is advised).
3. **Netlify Pre-flight:** Pay close attention to the output of `netlify env:list --context deploy-preview` in Plan 04. If the variables are missing, do not proceed to Task 3, as the sourcemaps will fail to upload correctly.

---

## CodeRabbit Review

CodeRabbit reviews the working tree directly (not via prompt) and produced 1 finding on the Phase 15 plan docs. Severity in CodeRabbit's taxonomy: `potential_issue` (minor — treated as LOW here). Finding reproduced verbatim:

### Finding 1 — 15-05-PLAN.md L45 (potential_issue / LOW — minor)

In `.planning/phases/15-observability-e2e-verify-close/15-05-PLAN.md` at line 45, update the plan text to correct the artifact count from six to seven and ensure the renamed evidence file and commit instructions reflect committing seven PNGs: change the phrase "6 PNG artifacts" and "six committed PNGs" to "7 PNG artifacts" / "seven committed PNGs" where mentioned, update the rename step for `15-EVIDENCE-DRAFT.md` → `15-EVIDENCE.md` to include the frontmatter fields `status: closed` and `ci_run_url:`, and ensure the list of PNGs includes the new per-message-count screenshot `sentry-obsv-05-counts.png`; apply the same correction to both occurrences referenced in the plan.

(Note: this finding independently confirms Codex's LOW concern about 6-vs-7 PNG drift introduced by the OBSV-05 per-message-count screenshot being added in Plan 04 but the count not propagated cleanly into Plan 05.)

---

## Consensus Summary

Three independent reviewers converge on a "cycle-1 HIGH fixes hold" verdict, with **one cycle-2 divergence on HIGH-2's persistence as evidence integrity risk**:

- **Gemini**: cycle-2 risk LOW, ready to execute. Both cycle-1 HIGHs fully resolved.
- **Codex**: cycle-2 risk HIGH for ship-readiness, recommends cycle 3. HIGH-1 fully resolved; HIGH-2 partially resolved at the React boundary level but new HIGH evidence-integrity concern emerged.
- **CodeRabbit**: 1 LOW mechanical finding (PNG count drift in Plan 05) — confirms Codex's parallel LOW concern.

The source of divergence between Codex and Gemini: Codex ran a **local React 19 + `@sentry/react@10.53` probe** and observed that the local boundary's `onError` callback can surface an event ID that is NOT the event Sentry actually persists. The root `onCaughtError` (from `src/main.tsx`) fires its own auto-capture with the `boundary: app-root` tag and a DIFFERENT event ID, and `Sentry.dedupeIntegration()` can drop the local boundary's event as a duplicate. Gemini's review was high-level and didn't probe this code path. CodeRabbit doesn't take on this kind of semantic verification.

### Agreed Strengths

- **HIGH-1 (acceptance-grep self-collision): RESOLVED** by all three reviewers. The scoped grep formulations (comment-line scope OR string-literal exclusion) work, and the unscoped form is explicitly forbidden.
- **HIGH-2 architectural switch from `useEffect` to local `Sentry.ErrorBoundary` with `onError(error, stack, eventId)`** is the right shape (Codex + Gemini agree). The local boundary keeps `SmokePage` mounted and writes the dataset synchronously.
- **`env -u` over `VAR= ...`** for the unset-vs-empty-string probe in Plan 03 is the correct distinction (Gemini explicitly praises; Codex implicitly accepts).
- **Per-message event-count screenshot** in Plan 04 strengthens OBSV-05 evidence (Gemini praises; Codex partially accepts but flags weakness).
- **`event.release == artifact.release == head_sha` triple-check** in Plan 04 is the right invariant for catching `SENTRY_RELEASE` override drift (Codex confirms "addressed").
- **Read-then-increment `completed_phases`** in Plan 05 Task 4 is implementable and prevents drift (Gemini + Codex agree).

### Agreed Concerns

**HIGH (raised by 1 reviewer, with empirical backing — this is the cycle-2 ship blocker per Codex):**

1. **Local boundary's surfaced `eventId` may not be the authoritative Sentry-persisted event ID.** Under React 19's `createRoot.onCaughtError` (already wired in `src/main.tsx`) + `Sentry.dedupeIntegration()`, the root handler fires its own auto-capture with `boundary: app-root` tag — the local `Sentry.ErrorBoundary`'s `onError(eventId)` may then surface a duplicate event that Dedupe drops. Final evidence could record an event ID that is NOT findable in the Sentry dashboard. (Codex HIGH, empirically probed; Gemini implicit MEDIUM about onError synchronicity.)

   **Fix options** (Codex suggestion):
   - Surface the accepted Sentry event ID via a `beforeSend` hook that writes to `document.body.dataset.sentryEventId` only when Sentry decides to keep the event, OR
   - Verify dashboard `event_id == dataset ID` as part of Task 3's manual checkpoint and STOP if mismatched, OR
   - Use `beforeCapture={(scope) => scope.setTag('boundary', 'app-root')}` on the local boundary so whichever event survives Dedupe still carries the canonical tag.

**MEDIUM (Codex):**

2. **Sentry artifact verification may target a deprecated CLI surface.** `@sentry/cli@2.58.5` reports `releases files <release> list` as deprecated; Sentry's current sourcemap model is Debug IDs / artifact bundles. Plan 04 Task 4 Step 1 should verify upload via the artifact-bundle surface OR explicitly justify the legacy release-file listing.

3. **Local boundary does not tag its own capture.** If Dedupe ever drops the root handler's event and keeps the local boundary's, the surviving event lacks `boundary: app-root` and OBSV-03's tag-presence acceptance criterion fails. Add `beforeCapture={(scope) => scope.setTag('boundary', 'app-root')}` to the local boundary for robustness.

4. **Per-message OBSV-05 count via `message:"..."` Sentry Issues search proves one issue/group, not one event.** Use Discover/Event Explorer or event-ID lists with a timestamp-bounded query to verify exactly one event per message.

5. **Netlify deploy-preview env scoping needs `--scope builds`.** `netlify env:list --context deploy-preview` is a valid context filter, but Sentry build-time vars are scoped to `builds`. Plan 04 Task 2 Path A should use `netlify env:list --context deploy-preview --scope builds` to avoid a false pass from vars scoped only to functions/runtime.

6. **`@sentry/cli@2` is not a real pin.** `@2` is a major range; sentry-cli has had CLI-flag changes within `2.x`. Prefer `npx --no-install @sentry/cli` (transitive from `@sentry/vite-plugin`'s lockfile entry) or pin an exact tested version.

**LOW (Codex + CodeRabbit + Gemini, ≥2 reviewers on item 7):**

7. **6-vs-7 PNG count drift between Plan 04 and Plan 05.** Plan 04 added `sentry-obsv-05-counts.png` (raising total to 7) but Plan 05 still references "6 committed PNGs" / "six committed PNGs" in must-haves frontmatter and several body sections. Confirmed by both Codex and CodeRabbit independently.

8. **`timeout 1800 gh run watch ...` is not portable on macOS.** `timeout` is absent on stock macOS; the operator either needs `gtimeout` (Homebrew coreutils) or a shell loop / `perl` fallback. Plan 04 Task 1 Step 6 should document this.

9. **`env -u` portability.** Standard on POSIX (Linux/macOS), absent on Windows. Plan 03 Task 1 should note the Windows fallback (`Remove-Item Env:VAR`) — Plan already mentions this once but should emphasize.

10. **The scoped grep formulations in Plan 01 can miss inline-comment archaeology.** A line like `const x = 'OBSV-03 render' // D-01` is excluded entirely by the string-literal exclusion form (because the `grep -v` strips the whole line), and is not caught by the comment-line scope form (because the line doesn't start with `//`). (Codex LOW.)

11. **`eslint-disable-next-line no-console -- intentional ...` is syntactically valid but the project's flat config has no `no-console` rule enabled.** The directive produces an unused-disable warning, not an error, today — but if `no-console` is ever enabled, the directive becomes load-bearing. Plan 01 Task 2 currently treats this as load-bearing already (which is fine, just slightly aspirational). (Codex LOW.)

12. **`@sentry/react` v10 `onError(eventId)` synchronicity in render-phase throws.** Gemini flags this as a MEDIUM to "verify during 15-01 execution"; Codex's probe suggests the surfaced eventId IS delivered but it may not be the persisted one — different concern. Plan 01's acceptance criteria already include the manual DevTools verification step.

### Divergent Views

- **HIGH-2 status (Codex PARTIAL vs Gemini RESOLVED).** Codex's local probe vs Gemini's high-level inspection. Source of divergence: Codex tested with real `@sentry/react@10.53` + React 19 root `onCaughtError` and observed event-ID divergence between the local boundary and the persisted event; Gemini didn't run the probe. **The Codex framing is more rigorous and is the framing this cycle should adopt — the local boundary fixes the unreachability problem (`useEffect` never runs) but introduces a new evidence-integrity problem (the surfaced ID may not be the persisted one).**
- **Overall risk (Codex HIGH for ship vs Gemini LOW).** Codex wants cycle 3 focused on Plan 01/04 evidence correctness; Gemini says proceed to execution.
- **CodeRabbit's reduction from 14 findings (cycle 1) to 1 finding (cycle 2)** confirms the editorial sweep was effective — only the 6-vs-7 PNG drift slipped through.

### Suggested Pre-Execution Fixes (Ranked)

Highest leverage first — addresses HIGH/MEDIUM concerns:

1. **Resolve the local-boundary event-ID authority question** (Codex HIGH). One of three paths:
   - **(Preferred)** Add `beforeCapture={(scope) => scope.setTag('boundary', 'app-root')}` to the local `Sentry.ErrorBoundary` in Plan 01 Task 2 — so whichever event Dedupe keeps still carries the canonical tag. This is a one-line change that survives both Dedupe paths.
   - Add a Plan 01 Task 2 manual verification step: open Sentry dashboard, confirm the event whose `event_id` matches `document.body.dataset.sentryEventId` actually exists. If not, the local boundary's event was dropped and the persisted event has a different ID — surface BOTH or use `beforeSend` to capture the persisted one.
   - Replace the local-boundary surfacing strategy with a `beforeSend` hook in `src/main.tsx` that writes the persisted event_id to the dataset only on a `boundary: app-root` event. (Larger change; touches main.tsx; risks the broader app surface.)
2. **Strengthen OBSV-05 per-message count to use Discover/Event Explorer event-ID lists** instead of Sentry Issues search (Codex MEDIUM).
3. **Add `--scope builds` to Plan 04 Task 2 Path A `netlify env:list` invocation** (Codex MEDIUM).
4. **Pin `@sentry/cli` to a lockfile-resolved exact version** (Codex MEDIUM). Use `npx --no-install @sentry/cli --version` to discover the resolved version; record that version literally in Plan 04 Task 4.
5. **Re-evaluate Sentry `releases files list` for deprecation** (Codex MEDIUM). Either justify legacy use in the plan or switch to artifact-bundle/debug-ID surface.
6. **Fix the 6-vs-7 PNG count drift in Plan 05** (CodeRabbit + Codex LOW). Search-and-replace `six committed PNGs` → `seven committed PNGs` and update the artifact list to include `sentry-obsv-05-counts.png`.
7. **Add macOS `timeout` portability note** to Plan 04 Task 1 Step 6 (Codex LOW).
8. **Tighten the comment-archaeology grep** to also catch `// D-NN` trailing on a code line with a load-bearing literal (Codex LOW).

Items 1, 2, 3 are evidence-correctness blockers per Codex's HIGH framing. Items 4-8 are quality-of-life upgrades.

### Cycle-2 Net Assessment

The cycle-1 HIGH-1 (grep self-collision) is fully resolved. The cycle-1 HIGH-2 (event-id surface unreachable) is structurally resolved at the React boundary level — but Codex's local probe surfaced a new HIGH-severity evidence-integrity concern that is materially the same blast radius: the surfaced event ID may not be the one Sentry persists. The mitigation is small (a `beforeCapture` tag on the local boundary, or a dashboard cross-check in Task 3) but it has not landed yet.

Gemini's "proceed to execution" verdict is defensible if the cycle-2 plan is treated as "behaviorally correct, evidence may have a known weakness that's caught in manual verification." Codex's "run cycle 3" verdict is defensible if the cycle-2 plan is treated as "evidence integrity is load-bearing for this verify-and-close phase and the known weakness should be eliminated before execution."

The convergence loop should run one more cycle (cycle 3) to either:
- Land the `beforeCapture` tag + per-event-ID dashboard cross-check in Plan 01 Task 2 (Codex's preferred fix), AND
- Land the `--scope builds` + lockfile-pin + PNG-count + Discover/event-list strengthenings in Plan 04/05.

OR explicitly accept the residual risk and proceed (Gemini's framing), documenting the known weakness in `15-CONTEXT.md` deferred-ideas section.
