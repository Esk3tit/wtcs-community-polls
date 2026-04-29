---
phase: 7
reviewers: [gemini, codex, cursor]
reviewed_at: 2026-04-29T17:24:52Z
plans_reviewed: [07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md]
round: 2
prior_review: 07-REVIEWS-v1.md
---

# Cross-AI Plan Review — Phase 7 (Round 2, post-replan)

This is a re-review of the post-replan Phase 7 plans. Round 1 reviews live in `07-REVIEWS-v1.md` and were incorporated into the replan committed in `ea40bea`.

## Gemini Review

The implementation plans for **Phase 7: Observability Hardening** are exceptionally well-structured, technically precise, and rigorously aligned with the project's "Hygiene & Polish" goal. The strategy of combining mechanical config changes with a permanent, env-gated verification surface ensures that observability wins are not only achieved but also defensible and re-testable.

### Strengths
- **Rigorous Verification Logic:** The use of `mechanism.type` in Sentry as the ultimate "truth" for OBSV-01 shows a deep understanding of how React 19's error routing differs from previous versions.
- **Professional Measurement Technique:** Utilizing `git worktree` in Plan 03-T3 to capture the bundle-size baseline without mutating the branch or relying on network state is an excellent mitigation against baseline drift (Pitfall 6).
- **Surgical Integration:** The wiring in `src/main.tsx` (Plan 01-T1) correctly balances the new React 19 hooks with the existing `Sentry.ErrorBoundary` and `ConsentProvider` positioning, maintaining the complex wrapping order established in earlier phases.
- **Technical Accuracy:** Correctly identifying that `ErrorInfo` must be imported from `react` (not `react-dom/client`) and using the `[__smoke].tsx` bracket-escaping for TanStack Router demonstrates high technical competence with the specific stack.
- **Defense-in-Depth:** The combination of `reactErrorHandler` hooks, the `ErrorBoundary` `onError` belt, and the `beforeCapture` scope tagging ensures that even if one path is deduped, the resulting Sentry event will be enriched with the necessary context.

### Concerns
- **None (LOW):** There are no high or medium severity concerns. The plans address every pitfall identified in research (StrictMode masking, Oxc mangling, codegen requirements) with specific tasks.

### Suggestions
- **Sentry Event Grouping:** While a deterministic message string is used, you might consider ensuring the `RenderThrowSmoke` error is tagged as a "test" or "smoke" event in the `beforeCapture` hook or via a tag in the component, making it easier to filter out of real production alerts (though the env-gate already protects live production).
- **TanStack Codegen:** Ensure that the `npm run build` command in Plan 02-T2 actually updates the *committed* `routeTree.gen.ts`. Since the file is currently tracked in the repo, CI will fail if the local developer forgets to commit the regenerated version.

### Risk Assessment: LOW
The risk is low because:
1. **Isolation:** The changes are confined to app bootstrap, build config, and a new, lazy-loaded debug route.
2. **Env-Gating:** The `VITE_NETLIFY_CONTEXT` gate prevents the smoke component from ever being reachable or throwing on live production.
3. **No New Deps:** The phase uses only existing, pinned dependencies.
4. **Audit Trail:** The inclusion of the `OBSV-02-bundle-delta.md` and the detailed `07-VERIFICATION.md` ensures that the "cost" of observability is fully transparent to the project maintainers.

The plans are ready for execution.

---

## Codex Review

### Summary

The replanned Phase 7 is directionally strong: the implementation sequence is coherent, scope is mostly controlled, and the core OBSV-01/OBSV-02 approach should work. The remaining risk is less in the code wiring and more in verification correctness. Two validation assumptions need fixing before execution: deploy-preview Sentry events will likely still have `environment: production` because [src/main.tsx](src/main.tsx:29) uses `import.meta.env.MODE`, and `SENTRY_AUTH_TOKEN= npx vite build` will not reliably preserve `.js.map` files because the Sentry plugin deletion hook can still run.

### Strengths

- Dependency order is sensible: Plan 07-01 wires capture and build config, Plan 07-02 adds the canary surface, Plan 07-03 verifies on deploy preview.
- The React 19 Sentry wiring is well scoped and uses the right local package API: `Sentry.reactErrorHandler()` and `Sentry.ErrorBoundary` support the proposed hooks/props.
- Good correction to use `ErrorInfo` from `react`, not `react-dom/client`, for the Sentry callback type.
- `src/routes/[__smoke].tsx` is the right TanStack filename choice. I verified locally that `[__smoke].tsx` resolves to static `/__smoke`, while unescaped `__smoke.tsx` is treated as pathless layout.
- Production smoke gating through Netlify `CONTEXT` is pragmatic and avoids adding auth or a URL secret.
- Permanent canary is a good fit for observability regression checks.
- Manual deploy-preview evidence is appropriate for OBSV-01; dev/Vitest would not prove minified production behavior.

### Concerns

- **HIGH:** Plan 07-03 expects Sentry event environment to be non-production, but current `Sentry.init` uses `environment: import.meta.env.MODE`. A Netlify deploy preview running `vite build` will probably report `production`, not `deploy-preview`. Either change Sentry environment to use `VITE_NETLIFY_CONTEXT` or remove that verification requirement.
- **HIGH:** The sourcemap inspection command is mechanically unsound. `SENTRY_AUTH_TOKEN= npx vite build` skips upload, but the plugin's delete-artifacts hook can still delete maps because `filesToDeleteAfterUpload` remains configured in [vite.config.ts](vite.config.ts:24). Use a plugin-disabled build mode instead.
- **MEDIUM:** Bundle delta attribution is muddied. Comparing `main` to the Phase 7 branch includes the new smoke route/chunk, not just `keepNames`. That does not strictly document the bundle-size delta from enabling `keepNames`.
- **MEDIUM:** Grepping the whole `.js.map` for `"RenderThrowSmoke"` can false-positive from `sourcesContent`. It does not prove the identifier is in `names[]`.
- **MEDIUM:** The `boundary='app-root'` evidence may be flaky with Sentry dedupe. If the `reactErrorHandler` event survives and the ErrorBoundary/manual event is deduped, the surviving event may lack the boundary tag.
- **MEDIUM:** Accepting `mechanism.type === generic` as a full pass weakens proof that the React 19 root hooks captured the error. It proves the manual belt, not necessarily `reactErrorHandler`.
- **MEDIUM:** Plan 07-03's template mentions `auto.browser.*` as a failure mode, but its acceptance check requires `grep -c 'auto\.browser\.'` to return 0. That will fail against the provided template.
- **LOW:** Several automated verify commands use semicolon chains and pipelines without `set -euo pipefail`, so a failed build can be masked by later successful greps.
- **LOW:** Roadmap SC #1 asks for `error.value` present, but the manual evidence steps do not explicitly verify `exception.values[0].value`.

### Suggestions

- Change Plan 07-03 environment evidence to one of:
  - Update `Sentry.init` to `environment: import.meta.env.VITE_NETLIFY_CONTEXT ?? import.meta.env.MODE`, and mark that as an intentional scope addition.
  - Or keep `Sentry.init` untouched and verify deploy-preview provenance by URL, release SHA, event timestamp, and smoke message, not Sentry environment.
- Replace sourcemap inspection with a plugin-disabled production build, for example: `npm run generate && npx tsc -b --noEmit && npx vite build --mode development`, since `disable: mode !== 'production'` disables the Sentry plugin while still running a Vite build.
- Parse source maps as JSON and inspect `map.names`, not raw grep over the whole file.
- Measure `keepNames` delta on the same Phase 7 code with only the flag toggled, then optionally document total shipping delta separately.
- Strengthen mechanism evidence: require at least one event with `auto.function.react.error_handler` or `auto.function.react.error_boundary`; treat `generic` as belt evidence only.
- Fix the 07-03 grep checks so failure-mode documentation can mention `auto.browser.*` without failing acceptance.
- Add an explicit check for `exception.values[0].value` matching the deterministic smoke error message.
- Add a production-context local smoke gate check: build with `VITE_NETLIFY_CONTEXT=production`, preview locally, and confirm `/__smoke?render=1` returns the TanStack 404.

### Risk Assessment

Overall risk: **MEDIUM**.

The implementation plan is likely to achieve OBSV-01 and OBSV-02 after minor corrections. The main risk is audit quality: as written, Plan 07-03 can either fail on a false assumption (`environment !== production`) or produce weak mechanical evidence (`grep` over `.map`, non-isolated bundle delta). Fixing those before execution should reduce the phase to low implementation risk.

---

## Cursor Review

### Summary

The post-replan Phase 7 plans are strong overall: they are traceable to requirements (`OBSV-01`, `OBSV-02`), preserve scope discipline, and include a clear wave dependency chain (`07-01` wiring/config → `07-02` smoke surface → `07-03` manual evidence + closure docs). The verification intent is especially good, with explicit deploy-preview-only validation and concrete artifact expectations. The main residual risk is not conceptual but execution fragility: a few implementation details (notably route filename semantics and mechanism-type assumptions) could cause false negatives or unnecessary churn if the framework/tool behavior differs from assumptions.

### Strengths

- Clear requirement mapping: each plan explicitly ties tasks to `OBSV-01`/`OBSV-02` and success criteria.
- Good dependency ordering: Wave 1 unblocks Wave 2/3 correctly; Wave 3 is appropriately human-gated.
- Strong anti-regression design: permanent smoke canary route enables repeatable checks for future releases.
- Verification rigor is high: deploy-preview requirement is correctly enforced (avoids dev/StrictMode false confidence).
- Mechanical evidence for `keepNames` is well thought out (`__name(` + sourcemap `names[]` + Sentry frame readability).
- Closure documentation quality is excellent: dedicated bundle-delta doc + structured verification report supports audits.

### Concerns

- **HIGH**: Route filename convention risk (`src/routes/[__smoke].tsx`) may be incorrect for TanStack file routing and could generate an unexpected route or fail registration.
- **MEDIUM**: Mechanism-type acceptance is still assumption-heavy (`auto.function.react.*` vs `generic`); if SDK emits a different valid type, plan may fail on rubric mismatch rather than real behavior.
- **MEDIUM**: Dual-capture design (`beforeCapture` + `onError` + root hooks) is robust but complex; duplicate-event behavior depends on dedupe internals that are assumed rather than asserted from current SDK behavior.
- **LOW**: Plan is somewhat over-specified with many grep-based acceptance checks; this can increase friction without improving confidence proportionally.
- **LOW**: Bundle comparison method is sound, but reproducibility could still drift if dependency resolution or environment differs between baseline worktree and phase tree (despite same-session mitigation).

### Suggestions

- Validate TanStack route naming before implementation freeze: add a short pre-check in plan text confirming exact file-path semantics for literal `__smoke` route.
- Relax mechanism-type pass criteria to prioritize outcome signals first (`componentStack`, boundary tag, unmangled frames), and treat mechanism string as secondary diagnostic evidence.
- Simplify duplicate-event strategy: keep either root hooks + boundary `beforeCapture`, and only retain manual `onError` capture if required after first evidence run.
- Add one explicit rollback path in Plan 03 for "event captured but frames still mangled" (e.g., verify uploaded sourcemap/debug ID linkage before code changes).
- Keep the excellent evidence discipline, but trim non-critical grep checks to reduce execution noise.

### Risk Assessment

**Overall risk: MEDIUM**

Justification: the architecture and verification strategy are solid and likely to achieve both observability goals, but there are a few high-impact implementation-assumption points (especially route file semantics and event-mechanism strictness) that could derail execution even when underlying fixes are correct. With small guardrail adjustments, this can drop to **LOW** quickly.

---

## Consensus Summary

Three external reviewers (Gemini, Codex, Cursor) examined the replanned Phase 7. Risk verdicts: **Gemini LOW, Codex MEDIUM, Cursor MEDIUM**. All three agree the architecture and dependency ordering are sound; the residual concerns cluster on **verification rigor** and **acceptance-criterion brittleness** in Plan 07-03, not on the wiring itself.

### Agreed Strengths

- **Dependency ordering is sound** (Gemini, Codex, Cursor): Plan 01 wiring → Plan 02 smoke surface → Plan 03 deploy-preview verification.
- **Manual deploy-preview verification is the right call** (Codex, Cursor, Gemini implicit): dev/StrictMode would mask the real capture path; this avoids false confidence.
- **Permanent env-gated smoke canary is well-designed** (Gemini, Cursor): repeatable for future releases, env-gating prevents prod exposure.
- **`ErrorInfo` import correction from `react` not `react-dom/client`** (Gemini, Codex): correctly catches a React 19 type subtlety.
- **`git worktree` baseline measurement** (Gemini, Codex implicit, Cursor implicit): clean way to isolate the keepNames bundle delta.
- **Closure documentation discipline** (Gemini, Cursor): `OBSV-02-bundle-delta.md` + `07-VERIFICATION.md` produces an auditable trail.

### Agreed Concerns (highest priority — raised by 2+ reviewers)

1. **Mechanism-type acceptance is over-strict / brittle** (Codex MEDIUM + Cursor MEDIUM)
   - Plan 07-03 accepts `{auto.function.react.error_handler, auto.function.react.error_boundary, generic}` as the allow-list. Both reviewers worry this can fail on rubric mismatch even when the underlying capture is correct, OR (Codex) accepting `generic` weakens proof that the React 19 root hooks did the capture (vs the manual belt).
   - **Suggestion convergence:** prioritize outcome signals (componentStack populated, un-mangled frames, boundary tag) as primary evidence; treat mechanism.type as secondary diagnostic. If keeping the strict allowlist, require *at least one* event with `auto.function.react.*` — don't pass on `generic` alone.

2. **Dual-capture / Sentry dedupe assumption is unverified** (Codex MEDIUM + Cursor MEDIUM)
   - The `reactErrorHandler` hooks + `ErrorBoundary.beforeCapture` + `onError` belt produces multiple capture paths. Dedupe behavior is assumed, not asserted from SDK source. Codex specifically flags that if the hook's event survives and the boundary's event is deduped, the surviving event may lack `tags.boundary='app-root'`.
   - **Suggestion convergence:** Cursor proposes simplifying to root hooks + `beforeCapture` only, dropping the `onError` belt unless first-run evidence demands it. Codex proposes hardening: ensure the boundary tag lands on whichever event survives.

3. **Bundle-delta attribution is muddied / reproducibility risk** (Codex MEDIUM + Cursor LOW)
   - Comparing `main` to Phase 7 branch includes the new smoke route chunk, not just `keepNames`. Codex flags this as MEDIUM; Cursor flags reproducibility drift as LOW.
   - **Suggestion convergence:** measure the `keepNames` delta on the same Phase 7 code with only the flag toggled, then document total shipping delta separately. Pinning `base_sha` in the closure doc helps but doesn't isolate the flag's effect.

### Round-2 New HIGH Concerns (single-reviewer, but worth flagging)

4. **Sentry environment is `import.meta.env.MODE`, not `VITE_NETLIFY_CONTEXT`** (Codex HIGH — Gemini/Cursor did not flag)
   - `src/main.tsx:29` `Sentry.init({ environment: import.meta.env.MODE })` will report `production` on a deploy-preview build. If Plan 07-03 verification asks the auditor to confirm "environment !== production" in the Sentry event, that verification will fail even when everything else works.
   - **Recommended fix:** Either (a) extend `Sentry.init` to `environment: import.meta.env.VITE_NETLIFY_CONTEXT ?? import.meta.env.MODE` (intentional scope addition, since D-05 already makes the variable available), OR (b) verify deploy-preview provenance by URL/release-SHA/timestamp/smoke-message rather than Sentry's environment tag.
   - **Action required:** confirm Plan 07-03 evidence template doesn't depend on Sentry environment tag; if it does, pick (a) or (b) before execution.

5. **`SENTRY_AUTH_TOKEN= npx vite build` does NOT preserve sourcemaps** (Codex HIGH — Gemini/Cursor did not flag)
   - The Sentry Vite plugin's `filesToDeleteAfterUpload` hook still runs even when the auth token is empty, deleting `.js.map` files before the proposed `names[]` inspection can run.
   - **Recommended fix:** Use plugin-disabled build instead — `npx vite build --mode development` — since the plugin is wired with `disable: mode !== 'production'`, this disables the plugin (and its delete hook) while still producing a real Vite build. Document this in Plan 07-03 Task 3 explicitly.

### Divergent Views (worth investigating)

- **Cursor flagged route filename `src/routes/[__smoke].tsx` as HIGH risk** ("may be incorrect for TanStack file routing"). **Codex explicitly verified locally** that `[__smoke].tsx` resolves to static `/__smoke` while unescaped `__smoke.tsx` is treated as a pathless layout. **Gemini independently confirmed** the bracket-escape is correct. **Verdict:** Cursor's HIGH concern is OBE — the bracket convention is correct per two independent confirmations. Plan stays as-is.

- **Gemini saw zero non-LOW concerns**, while Codex and Cursor both rated MEDIUM. The gap is not architectural — Gemini reviewed the wiring/structure (which is solid) while Codex and Cursor went deeper into Plan 07-03's evidence-template mechanics. The MEDIUM rating reflects audit fragility, not implementation risk.

### Other Worthwhile Suggestions (non-consensus, single-reviewer)

- **Codex MEDIUM:** `grep "RenderThrowSmoke" .js.map` can false-positive on `sourcesContent`. Recommendation: parse the map JSON and inspect `map.names` directly rather than greppping the full file.
- **Codex MEDIUM:** Plan 07-03 documents `auto.browser.*` as a failure mode but its acceptance grep requires `grep -c 'auto\.browser\.'` to return 0 — these contradict each other in a template that mentions the failure mode.
- **Codex LOW:** Several verify-block command chains use `;` without `set -euo pipefail`; a failed build can be masked by later successful greps.
- **Codex LOW:** Roadmap SC #1 ("`error.value` present") is not verified by any explicit check on `exception.values[0].value`.
- **Codex Suggestion:** Add a local smoke-gate check — build with `VITE_NETLIFY_CONTEXT=production`, preview locally, confirm `/__smoke?render=1` returns the TanStack 404. This proves the gate before deploy-preview.
- **Cursor Suggestion:** Add a rollback path for "event captured but frames still mangled" — verify sourcemap/debug-ID linkage before assuming `keepNames` is broken.
- **Cursor Suggestion:** Trim non-critical grep checks to reduce execution noise.
- **Gemini Suggestion:** Tag `RenderThrowSmoke` events as "smoke" via `beforeCapture` for filterability (env-gate already protects prod, so low priority).
- **Gemini Suggestion:** Confirm `routeTree.gen.ts` is committed after `npm run build` in Plan 02-T2 (else CI fails).

---

## Disposition Recommendation

This is a Round-2 review of plans that already incorporated Round-1 feedback. **Two new HIGH concerns** surfaced from Codex that were not visible in Round 1:

1. Sentry environment tag mismatch (`MODE` vs `VITE_NETLIFY_CONTEXT`) — needs a Plan 07-03 evidence-template adjustment OR a `Sentry.init` patch in Plan 07-01.
2. `filesToDeleteAfterUpload` deletes sourcemaps even with empty `SENTRY_AUTH_TOKEN` — needs Plan 07-03 Task 3 to switch to `vite build --mode development`.

Both fixes are local to Plan 07-03 (and possibly a one-line add to Plan 07-01 for option 1a). They do not require restructuring waves.

**Recommended action:** apply the two HIGH fixes via `/gsd-plan-phase 7 --reviews` (a third replan loop), then proceed to execute. The MEDIUM concerns about mechanism-type strictness and dual-capture dedupe should be addressed in the same revision pass:
- Tighten mechanism evidence (require ≥1 `auto.function.react.*` event; `generic` alone insufficient).
- Document the dedupe assumption explicitly OR simplify per Cursor's recommendation.

Cursor's HIGH on route filename is OBE (verified by Codex + Gemini); ignore.
