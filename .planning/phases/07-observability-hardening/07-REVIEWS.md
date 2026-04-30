---
phase: 7
reviewers: [gemini, codex, cursor]
reviewed_at: 2026-04-30T00:19:28Z
plans_reviewed: [07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md]
round: 3
prior_reviews: [07-REVIEWS-v1.md, 07-REVIEWS-v2.md]
---

# Cross-AI Plan Review — Phase 7 (Round 3, post-replan-2)

This is the third cross-AI review. Round-1 and Round-2 reviews live in `07-REVIEWS-v1.md` and `07-REVIEWS-v2.md` respectively. Reviewers were asked to verify whether Round-2 fixes were correctly implemented and to flag any NEW concerns the revisions introduced.

**Round-3 Verdict Summary:**

| Reviewer | Risk | Round-2 fixes status | New concerns |
|----------|------|---------------------|--------------|
| Gemini | **LOW** | All 7 RESOLVED + OBE | 1 LOW (curl SPA vacuity, deemed "acceptable") |
| Codex | **MEDIUM** | 5 RESOLVED, 2 PARTIAL, 1 NOT-RESOLVED | 1 MEDIUM (curl SPA vacuity) + 1 MEDIUM (VALIDATION drift) + 3 LOW |
| Cursor | **MEDIUM** | 7 RESOLVED + OBE; Plan 02 Task 3 NOT-RESOLVED | 1 HIGH (curl SPA vacuity) + 2 MEDIUM (reactErrorHandler semantics, VALIDATION drift) + 4 LOW |

---

## Gemini Review

This is the **Round 3 Review** of the Phase 7: Observability Hardening implementation plans.

### Summary

The Round 2 revisions are **excellent**. The plans now exhibit a high degree of technical maturity, particularly in the handling of React 19's error hooks and the isolation of bundle-size deltas. The implementation of the `taggedHandler` factory (Plan 01) successfully addresses the subtle Sentry deduplication risk, and the shift to plugin-disabled inspection builds (Plan 03) ensures mechanical evidence is reliable. The addition of a local production-context smoke gate check (Plan 02) provides a pragmatic safety net. The plans are logically consistent, traceable to requirements, and ready for execution.

### Round-2 Fix Verification

| Concern | Severity | Source | Status | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **HIGH-1** | HIGH | Codex | **RESOLVED** | Plan 01 Task 1 Step 4 patches `Sentry.init` to use `VITE_NETLIFY_CONTEXT ?? MODE`. |
| **HIGH-2** | HIGH | Codex | **RESOLVED** | Plans 01 and 03 now use `npx vite build --mode development` for all sourcemap-dependent inspections. |
| **MEDIUM-1** | MEDIUM | Cons. | **RESOLVED** | Plan 03 Task 1 Step C-7 and Task 2 evidence rows explicitly enforce the two-tier mechanism pass criteria. |
| **MEDIUM-2** | MEDIUM | Codex | **RESOLVED** | Plan 03 Task 2 acceptance criteria removed the contradictory `auto.browser. == 0` grep. |
| **MEDIUM-3** | MEDIUM | Codex | **RESOLVED** | Plan 03 Task 3 detailed a 3-way `git worktree` measurement strategy to isolate `keepNames` impact. |
| **MEDIUM-4** | MEDIUM | Codex | **RESOLVED** | Plan 03 Task 1 Step G-17 uses `jq -r '.names[]'` (with Node fallback) for JSON-aware symbol verification. |
| **MEDIUM-5** | MEDIUM | Cursor | **RESOLVED** | Plan 01 Task 1 Step 2 implements the `taggedHandler` factory with `Sentry.withScope` to preserve the boundary tag. |
| **Route Filename** | HIGH | Cursor | **OBE** | Filename `[__smoke].tsx` confirmed correct by Codex and Gemini; Cursor's concern is overridden. |

### NEW Concerns

#### 1. Plan 02 Task 3 Curl Check Vacuity (LOW)
The logic in Plan 02 Task 3 relies on `curl` to verify the production-context env-gate. However, since this is a Client-Side Rendered (CSR) app, the `curl` output (`index.html`) will be identical whether the gate works or not, as the routing logic executes in the browser.
*   **Impact:** The test is partially vacuous; it proves the server starts and serves the app, but doesn't prove the `beforeLoad` logic blocked the smoke component.
*   **Mitigation:** This is acceptable as a "cheap" sanity check, provided the primary proof remains the manual deploy-preview step in Plan 03.

### Suggestions

*   **Logic Proof via Dead-Code Elimination:** To make Plan 02 Task 3's local verification more robust, the executor could `grep` the built `dist/` for the `RenderThrowSmoke` identifier. If `VITE_NETLIFY_CONTEXT=production` is constant-folded, Oxc should prune the import and the string should be absent from the entry bundle's chunk-loading logic.
*   **Sentry Environment Naming:** In Plan 01 Task 1 Step 4, ensure that `VITE_NETLIFY_CONTEXT` (which Netlify sets to `deploy-preview`, `branch-deploy`, etc.) aligns with the expected environment names in your Sentry alert rules, if any exist. (Informational only, no plan change required).

### Risk Assessment

**Overall Risk: LOW**

The plans have survived two rounds of rigorous peer review and now contain specific mitigations for every high-impact pitfall identified (StrictMode masking, identifier mangling, dedupe tag loss). The dependency chain is clear, and the verification rubric is the most disciplined seen in the project to date.

**The plans are approved for execution.**

---

## Codex Review

### Summary

The Round-2 replan substantially improves Phase 7. The core implementation path is sound: Sentry environment is corrected, sourcemap inspection is mostly moved to plugin-disabled builds, mechanism criteria are much clearer, the keepNames delta is properly isolated, and the tagged-handler approach should preserve `boundary='app-root'` through nested Sentry scopes. I would not call this fully ready yet because the new local production smoke-gate check is mechanically weak, and the Validation Strategy still contains stale Round-2-era commands/criteria.

### Round-2 Fix Verification

| Item | Status | Evidence |
|---|---:|---|
| HIGH-1: `VITE_NETLIFY_CONTEXT ?? MODE` in `Sentry.init` | RESOLVED | Plan 07-01 explicitly patches only the `environment` field and Netlify exports `VITE_NETLIFY_CONTEXT=$CONTEXT`. |
| HIGH-2: sourcemap inspection uses `vite build --mode development` | PARTIALLY-RESOLVED | Plans 07-01/07-03 use `npx vite build --mode development`, but the Validation Strategy still has stale `SENTRY_AUTH_TOKEN= npx vite build`. |
| MEDIUM-1: two-tier mechanism criteria | PARTIALLY-RESOLVED | Plan 07-03 correctly blocks solo `generic`, but the Validation Strategy still lists `generic` as equally acceptable. Also, `auto.function.react.error_boundary` alone proves SDK boundary capture, not specifically root-hook capture. |
| MEDIUM-2: dropped contradictory `auto.browser == 0` grep | RESOLVED | Plan 07-03 removes the hard grep and treats `auto.browser.*` as event-level failure prose. |
| MEDIUM-3: 3-way bundle delta | RESOLVED | Plan 07-03 measures main, Phase 7 without keepNames, and Phase 7 with keepNames in same-session worktrees. |
| MEDIUM-4: parse `.names[]` via `jq` | RESOLVED for primary path | Plan 07-03 uses `jq -r '.names[]'`; however the Node fallback is broken for `.js.map` files. |
| MEDIUM-5: tagged handler sets boundary before `reactErrorHandler` | RESOLVED | The proposed nested `Sentry.withScope` should propagate tags into `reactErrorHandler`'s internal nested scope. Sentry's installed SDK emits `auto.function.react.error_handler`. |
| Plan 02 Task 3: local prod-context smoke gate | NOT-RESOLVED as verification | The task uses `curl` against a SPA shell. That does not execute TanStack Router or React, so it cannot prove `beforeLoad` rendered a 404 or blocked `RenderThrowSmoke`. |

### NEW Concerns

- **MEDIUM:** Plan 02 Task 3 can false-pass. `curl http://localhost:4173/__smoke?render=1` only fetches `index.html`; it will not execute client JS, so the body will contain `<div id="root"></div>` whether the route gates correctly or throws into `AppErrorFallback`.

- **MEDIUM:** `07-VALIDATION.md` is stale relative to the revised plans. It still uses the old `SENTRY_AUTH_TOKEN= npx vite build` pattern, expects `Sentry.reactErrorHandler` count `>= 3` even though the new factory calls it once, and permits `generic` as a peer mechanism.

- **LOW:** The Node fallback for `.map` inspection uses `require('./$f')` on `*.js.map`. Node treats `.map` as JS, not JSON, so this fails. Use `JSON.parse(fs.readFileSync(f, 'utf8'))`.

- **LOW:** Plan 03 Task 1 says `git checkout <release-sha>` in the main worktree. Use a temporary worktree instead to avoid colliding with dirty local files.

- **LOW:** If root-hook proof is strict, accepting only `auto.function.react.error_boundary` as the primary mechanism is weaker than requiring at least one `auto.function.react.error_handler`.

### Suggestions

- Replace Plan 02 Task 3's curl assertion with Playwright against `vite preview`: assert the rendered page shows TanStack not-found UI and does not show `Something went wrong.` from `AppErrorFallback`.

- Add timeout/trap handling around `vite preview`, and avoid hard-coding port `4173` without checking it is free.

- Update `07-VALIDATION.md` to match the revised plans before execution.

- Fix the Node fallback:

```bash
node -e "const fs=require('fs'); for (const f of process.argv.slice(1)) { const m=JSON.parse(fs.readFileSync(f,'utf8')); for (const n of m.names || []) if (/^(RenderThrowSmoke|RootLayout|AppErrorFallback|SmokePage)$/.test(n)) console.log(n + '  ↳ in ' + f) }" dist/assets/*.js.map
```

- If OBSV-01 must prove the root hooks specifically, require one `auto.function.react.error_handler` event; treat `auto.function.react.error_boundary` as acceptable capture-path evidence but not root-hook evidence.

### Risk Assessment

Overall risk: **MEDIUM**.

The implementation architecture is low-risk, but the verification package still has two audit-quality problems: the new local prod-gate check does not actually test the client route, and the Validation Strategy conflicts with the revised plans. After those are corrected, I would rate Phase 7 execution risk **LOW**.

---

## Cursor Review

Here is a concise Round-3 review based on the plans you pasted and a quick check of `vite.config.ts`, `src/main.tsx`, and types in the repo.

### 1. Summary

Round-2 fixes are largely reflected in the plans: **HIGH-1** (`Sentry.init` environment coalesce), **HIGH-2** (`npx vite build --mode development` aligned with `disable: mode !== 'production'` in `vite.config.ts` lines 29–30), **MEDIUM-1** (two-tier mechanism + solo `generic` = partial), **MEDIUM-2** (dropped bogus `auto.browser` doc grep), **MEDIUM-3** (3-way worktree + surgical `keepNames` revert), **MEDIUM-4** (`jq` on `.names[]`), **MEDIUM-5** (`withScope` + `setTag` before `reactErrorHandler`), and **Plan 02 Task 3** (local prod-context gate) are all spelled out clearly. One **serious gap** undermines Plan 02 Task 3: **curl against `vite preview` cannot exercise TanStack `beforeLoad`**, so as written that task does **not** prove the production env-gate. There is also a **risk** that the nested `Sentry.reactErrorHandler(innerCallback)(error, info)` shape does not preserve default capture behavior for `onCaughtError` / `onRecoverableError` when the inner callback is empty—the plan should cite Sentry's exact overload semantics or use the documented `Sentry.reactErrorHandler()` form with tagging done differently. **`07-VALIDATION.md` still describes an older mechanism allowlist** and `SENTRY_AUTH_TOKEN=` for 07-01-T2, so validation docs are slightly out of sync with Plan 03.

### 2. Round-2 Fix Verification

| ID | Status | Evidence |
|----|--------|----------|
| **HIGH-1** | **RESOLVED** in Plan 01 | `environment: import.meta.env.VITE_NETLIFY_CONTEXT ?? import.meta.env.MODE` is specified; matches need to fix deploy-preview events currently using `import.meta.env.MODE` in `src/main.tsx` line 31. |
| **HIGH-2** | **RESOLVED** in Plans 01 & 03 | Repo has `disable: mode !== 'production'` in `vite.config.ts` (lines 24–30). `--mode development` disables the plugin, avoiding `filesToDeleteAfterUpload` on inspection builds. |
| **MEDIUM-1** | **RESOLVED** in Plan 03 | PRIMARY requires `auto.function.react.error_handler` or `auto.function.react.error_boundary`; `generic` is companion-only; solo `generic` blocks sign-off. |
| **MEDIUM-2** | **RESOLVED** in Plan 03 | Contradictory `grep auto.browser == 0` on the markdown file removed; prose may still mention `auto.browser` as failure mode. |
| **MEDIUM-3** | **RESOLVED** in Plan 03 Task 3 | 3-way worktree: main @ merge-base, phase-7 without `keepNames`, phase-7 with `keepNames`; isolated vs total deltas documented. |
| **MEDIUM-4** | **RESOLVED** in Plan 03 | `jq -r '.names[]'` + grep anchored names; Node fallback documented. |
| **MEDIUM-5** | **RESOLVED** in Plan 01 | `taggedHandler` uses `Sentry.withScope` + `scope.setTag('boundary', 'app-root')` before delegating to `reactErrorHandler`; `beforeCapture` on `ErrorBoundary` as well. |
| **Plan 02 Task 3 (Codex gate)** | **NOT RESOLVED as written** | See **NEW HIGH** below: static `curl` of `index.html` does not run client routing / `beforeLoad`. |

### 3. NEW Concerns

#### HIGH — Plan 02 Task 3 does not validate the smoke env-gate

For this SPA, **`vite preview` serves the same `index.html` for every URL**; TanStack `beforeLoad` runs **only in the browser** after JS loads. **`curl` never executes the bundle**, so it never runs `beforeLoad`, never evaluates `import.meta.env.VITE_NETLIFY_CONTEXT === 'production'`, and never lazy-loads `RenderThrowSmoke`. The checks "HTTP 200", "body contains `<div id=\"root\"></div>`", and "body does not contain the smoke error string" are therefore **true for both a working and a broken gate** (the error string would not appear in the initial HTML from `curl` in the success path either).

**Implication:** Replace or augment Task 3 with something that runs the built app in a real browser (Playwright headed, or manual "open preview and confirm 404 UI vs fallback"), or a minimal **Playwright** script that loads `/__smoke?render=1` and asserts DOM (not `curl`). As written, the "Round-2 Codex suggestion APPLIED" claim is overstated.

#### MEDIUM — `taggedHandler` + nested `reactErrorHandler` callback semantics

The factory passes:

```ts
Sentry.reactErrorHandler((err, errInfo) => { /* only console.warn in DEV for uncaught */ })(error, info)
```

For **`onCaughtError` / `onRecoverableError`**, the inner function is a no-op in production. Whether Sentry still performs **default capture** depends on whether this overload means "user hook **in addition to** default reporting" or "**replace** default reporting." If it replaces, you could accidentally **silence** hook capture for caught/recoverable paths while still relying on `ErrorBoundary`—which would make **MEDIUM-1** (require `auto.function.react.error_handler`) fail or pass for the wrong reason.

**Mitigation before execute:** Confirm in `@sentry/react` 10.49 docs/source for `reactErrorHandler`; if in doubt, prefer `Sentry.reactErrorHandler()` with no inner callback and apply tags via `beforeSend` / `Sentry.addEventProcessor`, or use the documented pattern that explicitly preserves default behavior.

#### MEDIUM — `07-VALIDATION.md` / Nyquist table drift vs Plan 03

The pasted **Validation Strategy** still has:

- Manual table: mechanism ∈ `{error_handler, error_boundary, generic}` without the **solo `generic` = partial** rule.
- **07-01-T2** still lists `SENTRY_AUTH_TOKEN= npx vite build` (Round-1 pattern), contradicting **HIGH-2**.

Executors following **07-VALIDATION.md** instead of **07-03-PLAN.md** could do the wrong thing. Align that file with Plan 03 before execution.

#### LOW — Plan 01 text: "`react-dom/client` does not export `ErrorInfo`"

In this repo, `@types/react-dom/client.d.ts` **does** export `interface ErrorInfo` (around line 57). Importing `ErrorInfo` from `'react'` is still fine and consistent with React's `ErrorInfo`; the **rationale sentence in the plan is factually wrong**—cosmetic doc fix only.

#### LOW — Total gzip method vs Vite table (Plan 03 Task 3)

The plan allows `find … | xargs gzip -c | wc -c` vs summing Vite's gzip column. Those can **differ** (what is included, per-file gzip vs Rolldown's reported gzip). Prefer **one method** and state it as the source of truth for `keepnames_isolated_delta_pct` / `total_phase7_delta_pct` to avoid audit confusion.

#### LOW — `jq` on "minimal Linux"

You already document a Node fallback; fine.

#### LOW — PRIMARY mechanism string exactness

Requiring literal `auto.function.react.error_handler` / `error_boundary` is good for audit, but if Sentry renames these in a patch release, sign-off could false-fail. Plan 03 already allows recording observed values; add one line: **if strings differ but clearly indicate React hook / boundary capture, escalate to CONTEXT owner** (optional).

### 4. Suggestions

- **Replace Plan 02 Task 3 `curl` gate** with Playwright (even a 10-line spec in Phase 7 if you allow it) or a **documented manual** step: "Open `vite preview` in browser at `/__smoke?render=1` with prod-context build and confirm TanStack not-found UI vs AppErrorFallback."
- **Resolve `reactErrorHandler` overload** with a one-line pointer to the exact Sentry API contract in the plan or a pre-flight spike note.
- **Refresh `07-VALIDATION.md`** (Manual-Only table + 07-01-T2 command) to match Plan 03 (HIGH-2, MEDIUM-1).
- **Fix the incorrect `ErrorInfo` export claim** in Plan 01 Task 1 `read_first` / action text.
- **Optional:** In Plan 03 Task 3, use **only** Vite's printed gzip column for totals to match D-13 strictly.

### 5. Risk Assessment

**Overall: MEDIUM**, down from Round-2's MEDIUM once execution follows the revised plans, **with two exceptions**:

1. **Plan 02 Task 3** as specified gives **false confidence** (HIGH until fixed or re-scoped as manual/browser-only).
2. **`reactErrorHandler` nesting** needs a quick **API correctness check** (MEDIUM until confirmed).

After fixing Task 3's verification method and confirming `reactErrorHandler` behavior, risk can reasonably drop to **LOW** for the rest (worktree 3-way, jq names, Sentry env, plugin-disabled maps are mechanically sound).

**Bottom line:** Round-2 HIGH/MEDIUM items are **correctly incorporated in the plan text** where it matters for execution. The **largest new issue** is **Plan 02 Task 3's curl-based SPA "gate" proof**, which does not match how client-side routing works; fix that before calling the Codex suggestion satisfied. I have **no further invented blockers** beyond the above.

---

## Consensus Summary

Three reviewers (Gemini, Codex, Cursor) confirm that all 7 in-scope Round-2 HIGH/MEDIUM concerns landed correctly in the revised PLAN.md files. The plan-checker's PASS verdict on the revisions is independently corroborated.

**However, two NEW consensus issues surfaced:**

### CONSENSUS NEW HIGH — Plan 02 Task 3 curl-based SPA assertion is mechanically vacuous

**All three reviewers flag this** (Gemini LOW, Codex MEDIUM, Cursor HIGH). Cursor and Codex independently reason about the underlying mechanism: this is an SPA, `vite preview` serves the same `index.html` for every URL, and TanStack Router's `beforeLoad` only runs after the browser executes the JS bundle. `curl` never executes JS, so the curl-based assertions in Task 3 will pass identically whether the env-gate works or is broken. The check is a **false-positive generator**, not a verification.

**Severity disagreement:** Gemini called it LOW because "the primary proof remains the manual deploy-preview step in Plan 03"; Cursor called it HIGH because Plan 02 Task 3 was added explicitly to satisfy the Codex Round-2 suggestion ("proves the gate works locally"), and as written it does not actually prove that. Codex split the difference at MEDIUM.

**Recommended resolutions** (pick one, not all):
1. **Replace curl with Playwright** — a 10-line spec hitting `vite preview`, asserting TanStack not-found UI is rendered AND `AppErrorFallback` is NOT rendered. Adds ~30 lines of test code but provides real verification.
2. **Replace curl with manual checkpoint** — convert Task 3 to a `<task type="manual">` checkpoint where the developer opens `vite preview` in a real browser and confirms the gate. Cheaper than Playwright but human-gated.
3. **Augment curl with grep-on-dist** (Gemini's suggestion) — confirm `RenderThrowSmoke` identifier is absent from production-context-build chunks (constant-folding proof). Catches a different bug class (the env-gate at code level), not the runtime route-gate.
4. **Demote Task 3 to a deferred backlog item** — acknowledge it as a deferred Codex suggestion requiring browser-based verification, defer to v1.2 or a follow-up phase. Plan 03 deploy-preview verification remains the OBSV-01/02 evidence path.

### CONSENSUS NEW MEDIUM — 07-VALIDATION.md drift relative to revised plans

**Two reviewers (Codex, Cursor) flag this; Gemini did not.** The 07-VALIDATION.md file was sign-off-approved before Round-2 revisions and still carries:
- The old `SENTRY_AUTH_TOKEN= npx vite build` pattern in the per-task verification map (contradicts HIGH-2).
- The 3-value mechanism allowlist `{error_handler, error_boundary, generic}` without the "solo `generic` = PARTIAL" rule (contradicts MEDIUM-1).
- Possibly other drift (Codex mentions `Sentry.reactErrorHandler count >= 3` no longer holds with the factory pattern).

**Risk:** an executor following 07-VALIDATION.md (which is the canonical Validation Strategy doc, and Plan 03 cites it for closure) instead of 07-03-PLAN.md could do the wrong thing.

**Recommended resolution:** refresh 07-VALIDATION.md to match the revised plans before execution. Specifically:
- Replace `SENTRY_AUTH_TOKEN= npx vite build` references with `npx vite build --mode development`.
- Update the Manual-Only mechanism row to reflect the two-tier criterion.
- Update any `Sentry.reactErrorHandler` invocation-count assumptions to reflect the `taggedHandler` factory (called once per hook = 3 invocations of the factory, but `reactErrorHandler` itself is invoked inside the factory body — be precise about what the count assertion is measuring).
- Re-sign-off after the refresh (or note the original sign-off remains because the V2 changes are documentation alignment, not strategy changes).

### Single-Reviewer NEW Concerns (less urgent)

- **Cursor MEDIUM — `taggedHandler` nested `reactErrorHandler` overload semantics:** does `Sentry.reactErrorHandler(innerCallback)(error, info)` add to default capture or replace it? If replace, the no-op inner callback (used in onCaughtError/onRecoverableError) could silence hook-path capture. Cursor recommends a quick `@sentry/react` 10.49 docs/source check before execution. This is a real risk worth a 5-minute mitigation: read the Sentry source for `reactErrorHandler` and confirm the contract, OR switch to the simpler `Sentry.reactErrorHandler()` with tagging via `beforeSend`/`addEventProcessor`.

- **Codex LOW — Node fallback for jq is broken:** the plan's Node fallback uses `require('./$f')` on `.js.map` files. Node treats `.map` as JS, so the require fails. Use `JSON.parse(fs.readFileSync(f, 'utf8'))` instead. Codex provides the corrected snippet inline. Quick fix, mechanically correct.

- **Codex LOW — `git checkout <release-sha>` in main worktree (Plan 03 Task 1 step 13):** could collide with dirty local files. Use a temporary worktree instead. Trivial fix.

- **Cursor LOW — Plan 01 prose claim that "`react-dom/client` does not export `ErrorInfo`":** Cursor checked the local `@types/react-dom/client.d.ts` and reports that `ErrorInfo` IS exported. Importing from `'react'` is still consistent (both export the same type), so the import statement is fine; only the rationale prose is factually wrong. Cosmetic fix.

- **Cursor LOW — Plan 03 Task 3 mixed gzip methods:** the plan accepts both `find ... | xargs gzip -c | wc -c` and Vite's printed gzip column. Pick one as the source of truth for `keepnames_isolated_delta_pct` to prevent audit confusion. D-13 specifies "Vite/Rolldown built-in tool" — favor Vite's column.

- **Cursor LOW / Codex LOW — PRIMARY mechanism string exactness:** if Sentry renames the mechanism strings in a patch release, sign-off could false-fail. Add a one-line escalation rule: "if strings differ but clearly indicate React hook / boundary capture, escalate to CONTEXT owner (Khai) for sign-off override."

- **Codex LOW — `auto.function.react.error_handler` vs `error_boundary` precedence:** if the goal is specifically to prove the React 19 root hooks (not the SDK ErrorBoundary), require at least one `error_handler` event; treat `error_boundary` as acceptable but not root-hook-specific evidence. Tightens MEDIUM-1 further.

### Convergent Strengths (3-of-3)

- All three reviewers confirm the Round-2 fixes for HIGH-1, HIGH-2, MEDIUM-2, MEDIUM-3, MEDIUM-4, MEDIUM-5 are RESOLVED in the plan text.
- All three reviewers explicitly confirm the bracket-escape `[__smoke].tsx` filename is correct (Cursor's Round-2 OBE'd HIGH stays OBE).
- All three reviewers approve the 3-way worktree machinery for keepNames-only delta isolation (MEDIUM-3).
- All three reviewers approve the `taggedHandler` + `Sentry.withScope` pattern for boundary-tag dedupe survival (MEDIUM-5).
- All three reviewers approve the `--mode development` inspection-build pattern for sourcemap preservation (HIGH-2).

---

## Disposition Recommendation

**Round-2 fixes verified resolved.** Two NEW consensus issues require attention before execution:

1. **Plan 02 Task 3 curl assertion** — pick a resolution (replace with Playwright, downgrade to manual, augment with grep-on-dist, or defer). The current curl assertion is a false-positive generator and the "Codex suggestion APPLIED" claim is overstated.

2. **07-VALIDATION.md drift** — refresh to match revised plans. Three specific drift points: SENTRY_AUTH_TOKEN pattern, mechanism allowlist, reactErrorHandler invocation count.

Plus one quick-win MEDIUM:

3. **`reactErrorHandler` overload semantics** — 5-minute Sentry source/docs check to confirm `reactErrorHandler(innerCallback)` doesn't silence default capture for caught/recoverable paths. If unclear, switch to `reactErrorHandler()` (no inner callback) and apply tags via `beforeSend`/`addEventProcessor`.

Plus several quick LOW fixes:

4. Fix Node fallback for jq (`JSON.parse(fs.readFileSync(...))`).
5. Use temporary worktree for `git checkout <release-sha>` step.
6. Drop the incorrect `ErrorInfo` rationale prose from Plan 01.
7. Pick one gzip-total method (Vite column per D-13).
8. Add Sentry-string-rename escalation rule.

**Recommended action:** apply fixes 1, 2, 3 via `/gsd-plan-phase 7 --reviews` (Round-3 replan); fixes 4-8 are individually trivial but should bundle into the same revision pass. Then proceed to execute.

**Alternative:** if user wants to ship now, items 4-8 are LOW enough to defer to in-execution patches; items 2 and 3 could be addressed by a 1-paragraph note in 07-VALIDATION.md and a quick prompt-cache-friendly mini-spike on the Sentry overload contract; item 1 is the only consensus-HIGH and should not be deferred — pick a real resolution.
