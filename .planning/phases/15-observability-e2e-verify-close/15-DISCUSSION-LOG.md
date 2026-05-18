# Phase 15: Observability + E2E Verify & Close - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 15-Observability + E2E Verify & Close
**Areas discussed:** Smoke harness wiring, verify-sourcemap-names script, E2E CI verification surface, Evidence + issue closure + preview source

---

## Smoke harness wiring

### Q1 — Where should RenderThrowSmoke.tsx be wired?

| Option | Description | Selected |
|--------|-------------|----------|
| Existing /[__smoke] route | Mount on prod-gated /__smoke route, reuse VITE_NETLIFY_CONTEXT gate, add three sub-paths or buttons | ✓ |
| ?debug=sentry-test query gate | Add a global query-param listener on the app root — literal match to requirement text but new gating code | |
| Hidden admin debug panel | Place behind /admin route (AdminGuard) — cleanest authz, but requires admin session | |

**User's choice:** Existing /[__smoke] route.
**Notes:** Route already exists and is preview-gated; no new gating logic needed.

### Q2 — How should OBSV-05 produce DISTINCT error messages?

| Option | Description | Selected |
|--------|-------------|----------|
| Two sub-routes / two buttons | Distinct trigger per error message; clearest 1:1 requirement-to-evidence mapping | ✓ |
| One trigger + state-driven nonce | Single button, mutating message per click; smaller surface but less obvious | |
| Playwright-driven script | Expose window.__smokeFire(message); fires distinct messages externally | |

**User's choice:** Two sub-routes / two buttons.
**Notes:** Cleanest mapping requirement to evidence; supports human verifier without automation.

### Q3 — How to surface Sentry.lastEventId()?

| Option | Description | Selected |
|--------|-------------|----------|
| Post-throw banner on the page | Render eventId in AppErrorFallback; cleanest human evidence path | |
| console.log + DOM hidden attribute | Both human (DevTools) and automation (Playwright) paths without UI changes | ✓ |
| Hand-rolled — just check Sentry dashboard | Skip eventId surfacing entirely; lightest, zero new code | |

**User's choice:** console.log + DOM hidden attribute.
**Notes:** Keeps a future Playwright automation path open without locking it in now.

### Q4 — Is new smoke harness code OK given the 'all fixes already on main' framing?

| Option | Description | Selected |
|--------|-------------|----------|
| Reframe: small new code is OK | Acknowledge smoke harness is new *verification* code, not a behavioral fix | ✓ |
| Reuse-only: cite Phase 7 evidence | Don't add code; cite older Phase 7 artifacts. Risk: doesn't satisfy "smoke-verified on Netlify deploy preview" | |
| Use a debug script instead | Playwright spec / dev-tools console snippet; no app code but harder to re-run | |

**User's choice:** Reframe: small new code is OK.
**Notes:** Smoke harness is verification scaffolding; the *fixes* are already on main, but the *verifiers* land here. CONTEXT.md captures this explicit reframe.

---

## verify-sourcemap-names script

### Q1 — Simplest form of the build-time function-name check?

| Option | Description | Selected |
|--------|-------------|----------|
| Write scripts/verify-sourcemap-names.mjs | New Node script greps dist/assets/*.js for literal `function X(`; permanent regression guard | ✓ |
| One-liner in CONTEXT.md + run live | Document a one-shot command, run during phase, paste output; no committed code | |
| Cite Phase 7 artifact only | Use existing sourcemap-names-excerpt.txt; no new check. Risk: stale, no future coverage | |

**User's choice:** Write scripts/verify-sourcemap-names.mjs.
**Notes:** Wanted a permanent regression guard, not a one-time spot check.

### Q2 — Script's pass criteria?

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist of known component names | Grep for hand-picked component names; strongest signal, tied to actual app code | ✓ |
| Threshold count of `function X(` | Count declarations, require >= N; lower maintenance but a single-component regression could slip through | |
| $M absence check | Negative assertion: confirm `function $M(` doesn't appear; simplest, but false negative if placeholder changes | |

**User's choice:** Allowlist of known component names.
**Notes:** Strongest signal — explicit positive assertion on known component identifiers.

### Q3 — OBSV-04(b) Sentry Artifacts API evidence form?

| Option | Description | Selected |
|--------|-------------|----------|
| Sentry CLI list-files + paste output | `sentry-cli releases files <release> list` against current VITE_COMMIT_SHA; authoritative API source | ✓ |
| Sentry dashboard screenshot only | Manual navigation to Releases → Artifacts; quickest but pure-manual | |
| Build log + sentry-vite-plugin success | Build console output showing upload; less authoritative (build-side, not API-side) | |

**User's choice:** Sentry CLI list-files + paste output.
**Notes:** Direct API query is the most authoritative evidence; requires SENTRY_AUTH_TOKEN locally.

### Q4 — CI wiring for verify-sourcemap-names.mjs?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase-15 manual run only | Ship the script but don't wire into CI; cheaper, no regression coverage | |
| Add to ci.yml lint+unit job | Run after `npm run build` in CI on PRs; permanent regression guard | ✓ |
| You decide | Defer to Claude | |

**User's choice:** Add to ci.yml lint+unit job.
**Notes:** Recommended path — converts one-time evidence work into a permanent guard against the `keepNames: true` contract silently breaking in the future.

---

## E2E CI verification surface

### Q1 — Evidence source for TEST-14/15/16?

| Option | Description | Selected |
|--------|-------------|----------|
| Latest green CI run on main | ci.yml already runs `e2e` job on push to main; cite the existing run URL | ✓ |
| Trigger fresh workflow_dispatch run | Add workflow_dispatch trigger, fire manual run; duplicates an already-passing run | |
| Run npm run test:e2e locally | Doesn't satisfy "in CI on main" literal wording | |

**User's choice:** Latest green CI run on main.
**Notes:** Zero new CI work — existing trigger already produces the evidence.

### Q2 — Per-spec or job-level evidence?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-spec evidence (recommended) | Capture explicit PASS lines for the 3 specs from Playwright report | ✓ |
| Job-level evidence only | Cite green `e2e` job URL only; less robust against future skip/.only regressions | |
| Per-spec + job URL | Both; most thorough at slight redundancy cost | |

**User's choice:** Per-spec evidence.
**Notes:** Maps 1:1 to TEST-14/15/16 and survives future skip/`.only`/fixture-only-run regressions.

### Q3 — Any E2E surface changes in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Verify-and-cite only | No changes to e2e/tests/* or playwright.config.* | ✓ |
| Add @verify tag to 3 specs | Playwright tag for closure-verified set; mild scope-creep risk | |
| Add CI summary step | CI step printing 'Phase 15 verify summary'; pure cosmetics | |

**User's choice:** Verify-and-cite only.
**Notes:** Keeps phase scope tight; aligned with the v1.3 "all code on main" reframe.

### Q4 — Freshness of CI run cited as evidence?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-run when Phase 15 PR merges | Post-merge CI run URL; single source of truth, freshest | ✓ |
| Cite pre-PR-15 green run | Faster, can draft evidence early; risk: harness commit could destabilize | |
| Cite both | Strongest; pre-merge AND post-merge URLs | |

**User's choice:** Re-run when Phase 15 PR merges.
**Notes:** Single source of truth and implicitly proves the smoke harness commit didn't destabilize the specs.

---

## Evidence + issue closure + preview source

### Q1 — Where does the deploy-preview URL come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 15 PR itself | Netlify auto-builds a preview from the PR branch; single PR, single preview, single evidence trail | ✓ |
| No-op evidence PR after merge | Two PRs: first merges, second spins up a fresh preview from main | |
| Reuse a recent open PR's preview | Couples Phase 15 closure to an unrelated PR's lifetime | |

**User's choice:** Phase 15 PR itself.
**Notes:** Single PR/preview/evidence trail; smoke harness lands and gets verified in the same PR.

### Q2 — Evidence artifacts committed for OBSV-03/04/05 + TEST-14/15/16?

| Option | Description | Selected |
|--------|-------------|----------|
| Single 15-EVIDENCE.md file | All evidence in one place; requirement-by-requirement | ✓ |
| Per-requirement artifact files | One MD file per requirement; granular but more overhead | |
| Inline in CONTEXT.md or SUMMARY.md | No new file; SUMMARY.md gets long and is harder to cite externally | |

**User's choice:** Single 15-EVIDENCE.md file.
**Notes:** One place to look — preferred for clarity.

### Q3 — Where do Sentry dashboard screenshots get stored?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase artifacts dir (committed) | .planning/phases/15-.../artifacts/*.png; <200KB PNGs in git for permanence | ✓ |
| Linked from external host | Upload to GH issue / S3 / gist; no binary in git but link-rot risk | |
| Text-only evidence (no screenshots) | Sentry event IDs + permalinks + sentry-cli output text; cleanest git, but Sentry retention may purge events | |

**User's choice:** Phase artifacts dir (committed).
**Notes:** Accepts small binary cost for evidence permanence; mirrors prior phase artifact patterns.

### Q4 — How are issues #11, #12, #13, #17, #19 closed?

| Option | Description | Selected |
|--------|-------------|----------|
| PR keywords + closure comment | `Closes #11..#19` in PR body + per-issue closure comment with evidence link | ✓ |
| Manual close after evidence captured | Don't use keywords; manually close each with evidence comment after merge | |
| Close before merge | Close as soon as evidence captured on preview, before PR merges; possible drift | |

**User's choice:** PR keywords + closure comment.
**Notes:** Auto-close on merge for clean trail; per-issue comment for permanent evidence pointer.

---

## Claude's Discretion

- Exact mechanism for the two `/[__smoke]` sub-triggers (sub-routes vs query-params vs in-page buttons) — D-02 picks the shape; planner picks the shortest TanStack Router form.
- Allowlist contents for `verify-sourcemap-names.mjs` (D-06) — user picked the form, planner picks which components must appear. Seed: `ConsentProvider`, `AuthGate`, `AdminGuard`, `RenderThrowSmoke`, `App`.
- Whether the verify-sourcemap-names script runs `npm run build` itself or assumes the caller has built.
- Whether `sentry-cli` is a devDependency or invoked via `npx`.

## Deferred Ideas

- Playwright spec that fires `/[__smoke]/render-throw` and `/[__smoke]/dedupe-check` automatically and asserts Sentry capture — needs Sentry-staging DSN or network mocking.
- `@verify` Playwright tag on the three target specs — possible future "test taxonomy" phase.
- CI summary step printing 'Phase 15 verify summary' — cosmetic; revisit if evidence-anchoring gets painful.
