# Phase 15: Observability + E2E Verify & Close - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify-and-close phase for the v1.3 observability + E2E carry-forward debt. All five GitHub issues (#11, #12, #13, #17, #19) get closed via:

1. Smoke-verification of OBSV-03/04/05 on a Netlify deploy preview (Sentry React 19 ErrorBoundary render-phase capture, Vite/Rolldown sourcemap function-name preservation, Dedupe triple-handler collapse).
2. Confirmation that the already-committed Playwright spec fixes for TEST-14/15/16 (admin-create, browse-respond, filter-search) pass in CI on `main`.

**In scope:**
- Small new code: wire `RenderThrowSmoke.tsx` into `/[__smoke]` with two sub-triggers (render-throw + dedupe-check) and an eventId surface on `document.body.dataset.sentryEventId`.
- New `scripts/verify-sourcemap-names.mjs` build-time check, wired into `ci.yml`'s lint-and-unit job.
- Evidence capture (`15-EVIDENCE.md` + committed Sentry/CI screenshots under `artifacts/`).
- GitHub issue closure via PR keywords + per-issue closure comments.

**Out of scope:**
- Behavioral fixes to OBSV-03/04/05 themselves — already in `main` (`reactErrorHandler`, `keepNames: true`, `dedupeIntegration()` pinned).
- Behavioral fixes to the three Playwright specs — already in `main` (Yes/No preset click, `freshPoll` fixture + non-zero regex, `E2E_TITLE` prefix filter).
- E2E spec changes, playwright.config.* changes, e2e/tests/* edits.

**Risk:** LOW — no schema changes, no production mutations, no admin-surface changes. The only new surfaces are dev/preview-only: the prod-gated `/__smoke` route and a build-time grep script.

</domain>

<decisions>
## Implementation Decisions

### Smoke harness wiring

- **D-01:** Mount `RenderThrowSmoke.tsx` on the existing `/[__smoke]` route. The route is already prod-gated via `VITE_NETLIFY_CONTEXT` — reuse that gate instead of introducing a new `?debug=sentry-test` query-param gate or admin-scoped panel.
- **D-02:** Provide two distinct triggers on `/[__smoke]` so OBSV-05's Dedupe smoke can use DISTINCT error messages per scenario:
  - `/__smoke/render-throw` (or equivalent sub-button) fires `new Error('OBSV-03 render')`.
  - `/__smoke/dedupe-check` (or equivalent sub-button) fires `new Error('OBSV-05 dedupe')` and asserts `Sentry.lastEventId()` advanced relative to the previous call.
- **D-03:** Surface `Sentry.lastEventId()` two ways: `console.log` AND `document.body.dataset.sentryEventId = <id>`. Lets a human verifier read the DevTools console and lets a future Playwright check (if ever wired) read the DOM attribute without UI changes.
- **D-04:** Reframe accepted: the smoke harness is *new code* in this phase. It's verification scaffolding, not a behavioral fix to OBSV-03/04/05 themselves. The "all code fixes already on `main`" framing from REQUIREMENTS.md remains accurate for the *fixes*; the *verifiers* land here.

### verify-sourcemap-names script

- **D-05:** Create `scripts/verify-sourcemap-names.mjs`. The script assumes a prior `npm run build`, then greps `dist/assets/*.js` for literal `function X(` declarations and exits non-zero if absent.
- **D-06:** Pass criteria = allowlist of known component names. The allowlist must include at least: `ConsentProvider`, `AuthGate`, `AdminGuard`, `RenderThrowSmoke`, `App` (and any other top-level shell components the planner identifies). Every entry must appear as a literal `function X(` in `dist/assets/*.js`. Threshold counts and `$M`-absence checks are weaker and were rejected.
- **D-07:** OBSV-04(b) Sentry Artifacts evidence form = `sentry-cli releases files <release> list` output, where `<release>` is the current `VITE_COMMIT_SHA` (the same value Netlify exports during build). Requires `SENTRY_AUTH_TOKEN` available locally for the verifier. The raw CLI output gets pasted verbatim into `15-EVIDENCE.md`.
- **D-08:** Wire `verify-sourcemap-names.mjs` into `ci.yml`'s `lint-and-unit` job, running after a build step (or adding one if not present in that job — the planner will confirm). Becomes a permanent regression guard for the `keepNames: true` contract.

### E2E CI verification surface

- **D-09:** TEST-14/15/16 evidence source = latest green CI run on `main`. `ci.yml` already runs the `e2e` job on every `push` to `main` (lines 11–14 of `.github/workflows/ci.yml`), so no new CI mechanism is needed.
- **D-10:** Per-spec evidence is mandatory — capture explicit PASS lines for `admin-create.spec.ts`, `browse-respond.spec.ts`, and `filter-search.spec.ts` from the Playwright report (HTML reporter artifact or `--reporter list` output). Maps 1:1 to TEST-14, TEST-15, TEST-16 and survives future skip/`.only`/fixture-only regressions.
- **D-11:** No changes to `e2e/tests/*` or `playwright.config.*` in this phase. Verify-and-cite only. Tagging the three specs `@verify` was rejected to keep scope tight; a CI summary step was rejected as cosmetic overhead.
- **D-12:** Freshness = re-run after Phase 15 PR merges to `main`. The post-merge CI run URL is the single source of truth for TEST-14/15/16 evidence; it implicitly proves the smoke harness commit did not destabilize the specs. Pre-merge run URL is not cited.

### Evidence + issue closure + preview source

- **D-13:** Deploy-preview source = the Phase 15 PR itself. The PR contains the smoke harness + verify-sourcemap script + draft evidence; Netlify auto-builds a preview from the PR branch. Verifier fires the smokes on THAT preview, finalizes evidence, then merges. Single PR, single preview, single evidence trail.
- **D-14:** Evidence artifact = single `15-EVIDENCE.md` file in the phase directory. Lists each requirement (OBSV-03..05, TEST-14..16) with: trigger steps, Sentry event ID / CI run URL / sentry-cli output, and links to screenshot artifacts.
- **D-15:** Screenshots get committed to `.planning/phases/15-observability-e2e-verify-close/artifacts/`. Suggested names: `sentry-obsv-03-event.png`, `sentry-obsv-04-stack.png`, `sentry-obsv-05-dedupe.png`, `ci-test-14-pass.png`, etc. Small (<200KB) PNGs preferred. External hosting + text-only evidence were both rejected to avoid link-rot and to keep the evidence self-contained.
- **D-16:** Issue closure mechanism = PR body uses GitHub auto-close keywords (`Closes #11, Closes #12, Closes #13, Closes #17, Closes #19`). After merge, post a closure comment on each issue linking to `15-EVIDENCE.md` and the specific evidence anchor (Sentry event ID or CI run URL). Auto-close on merge gives a clean trail; per-issue comment gives a permanent evidence pointer.

### Claude's Discretion

- Naming of the two `/[__smoke]` sub-triggers (sub-routes vs query-params vs in-page buttons) — D-02 picks the shape but leaves the exact mechanism to the planner; whatever is shortest under TanStack Router file-based routing.
- Exact allowlist contents in D-06 — the user picked the *form* (allowlist), planner picks the *contents* (which components must appear). Suggested seed: `ConsentProvider`, `AuthGate`, `AdminGuard`, `RenderThrowSmoke`, `App` — planner is free to add/trim based on what's actually emitted today.
- Whether `scripts/verify-sourcemap-names.mjs` runs `npm run build` itself or assumes the caller has built — planner decides; CI already builds, so the script can probably be build-agnostic.
- Whether `sentry-cli` is added as a devDependency or invoked via `npx`. User had no preference signal.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Observability Hygiene (OBSV-*) — locked acceptance for OBSV-03/04/05.
- `.planning/REQUIREMENTS.md` §Test/E2E Hygiene (TEST-*) — locked acceptance for TEST-14/15/16.
- `.planning/ROADMAP.md` §Phase 15 — goal, success criteria, "evidence capture and issue closure only" framing.

### Smoke harness wiring (D-01..D-04)
- `src/components/debug/RenderThrowSmoke.tsx` — existing render-throw component to mount on `/[__smoke]`.
- `src/routes/[__smoke].tsx` — existing prod-gated route; will receive the new sub-triggers.
- `src/main.tsx` — Sentry init site; documents the triple-handler path (auto-capture + `onError` belt + `onCaughtError` → `reactErrorHandler`) and Dedupe pinning that OBSV-05 verifies.
- `src/components/AppErrorFallback.tsx` — fallback rendered after the throw is caught; relevant to eventId surfacing (D-03).

### verify-sourcemap-names script (D-05..D-08)
- `vite.config.ts` — `keepNames: true` setting whose effect the script verifies.
- `.github/workflows/ci.yml` — `lint-and-unit` job, target wiring site for D-08.
- `.planning/milestones/v1.1-phases/07-observability-hardening/artifacts/sourcemap-names-excerpt.txt` — Phase 7 baseline artifact, for comparison only (NOT the v1.3 evidence).

### E2E CI verification (D-09..D-12)
- `.github/workflows/ci.yml` lines 10–14 — `push: branches: [main]` trigger that makes "latest green run on main" possible.
- `e2e/tests/admin-create.spec.ts` — TEST-14 / issue #11 target spec.
- `e2e/tests/browse-respond.spec.ts` — TEST-15 / issue #12 target spec.
- `e2e/tests/filter-search.spec.ts` — TEST-16 / issue #13 target spec.

### Evidence + closure (D-13..D-16)
- `netlify.toml` — confirms `VITE_COMMIT_SHA` + `VITE_NETLIFY_CONTEXT` shell-substitution; the preview build inherits the same Sentry release tagging.
- GitHub issues #11, #12, #13, #17, #19 (open at phase start) — closed by Phase 15 PR via auto-close keywords.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/debug/RenderThrowSmoke.tsx` — render-phase throw component, already authored; only mount-site is missing.
- `src/routes/[__smoke].tsx` — prod-gated route shell, already authored. Reuse the gate; no new gating logic needed.
- `src/main.tsx` Sentry init — `Sentry.dedupeIntegration()` already pinned; OBSV-05 verifies that contract, not changes it.
- `vite.config.ts` `keepNames: true` — already set; verify-sourcemap-names script protects that setting going forward.
- Netlify `VITE_COMMIT_SHA` → Sentry `release` field — already wired in `netlify.toml`; preview builds inherit this for free, so the Sentry Artifacts API queries (D-07) can target the preview's commit SHA.

### Established Patterns
- Prod-gated debug routes via `VITE_NETLIFY_CONTEXT` (existing `/[__smoke]` route). D-01 extends this pattern instead of introducing a new gate.
- WHY-only comments in `src/` (per `CLAUDE.md` + `feedback_no_review_archaeology_in_source`) — no phase/plan IDs in source. Any comments on the smoke harness should explain WHY (e.g., why two distinct messages, why DOM-attribute eventId) without citing phase 15 or OBSV-NN.
- Test evidence pattern from prior phases (Phase 7 artifacts) — committed under `.planning/.../artifacts/`. D-14/D-15 follows that established pattern.

### Integration Points
- `/[__smoke]` route file gains new sub-trigger surfaces — coordinate file-based routing with TanStack Router conventions (`tsr generate` re-emits `routeTree.gen.ts`).
- `ci.yml` `lint-and-unit` job gains a verify-sourcemap-names step — must run AFTER a build step in that job (planner confirms whether `lint-and-unit` already builds, or whether the script runs in a different job that already builds).
- Phase 15 PR body needs `Closes #11, #12, #13, #17, #19` keywords — coordinate at PR-create time (e.g., via `/gsd-ship` or manual PR body).

</code_context>

<specifics>
## Specific Ideas

- User explicitly anchored the smoke harness on the existing `/[__smoke]` route over a `?debug=sentry-test` global gate — the former is already prod-gated and is a cleaner surface for two sub-triggers.
- User explicitly chose `console.log + DOM hidden attribute` for eventId — both a human path (DevTools console) AND an automation path (DOM dataset). Picked even before any Playwright wiring exists, to keep options open.
- User explicitly chose a single `15-EVIDENCE.md` file over per-requirement artifact files — preference is "one place to look".
- User chose committed PNG screenshots under `artifacts/` over external links — accepts <200KB binary blobs in git as a known cost for evidence permanence.

</specifics>

<deferred>
## Deferred Ideas

- Playwright spec that fires `/[__smoke]/render-throw` and `/[__smoke]/dedupe-check` automatically and asserts Sentry capture (would need network mocking or a Sentry-staging DSN). Out of scope for v1.3 verify-and-close; useful for a future "smoke automation" capability.
- `sentry-cli` as a devDependency vs `npx` invocation — left to planner's discretion; if a preference emerges during planning, capture in PLAN.md.
- `@verify` Playwright tag on the three target specs — rejected to keep Phase 15 scope tight, but a future "test taxonomy" phase could revisit.
- CI summary step printing "Phase 15 verify summary" — rejected as cosmetic; if evidence-anchoring becomes painful in future verify-and-close phases, revisit.

None of these belong in Phase 15 — they're deferred to future hygiene or quality phases.

</deferred>

---

*Phase: 15-Observability + E2E Verify & Close*
*Context gathered: 2026-05-17*
