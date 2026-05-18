---
phase: 15
slug: observability-e2e-verify-close
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-17
updated: 2026-05-17
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit) + Playwright 1.59.x (E2E) |
| **Config file** | `vitest.config.ts` + `playwright.config.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npm run test:e2e -- --grep @smoke` |
| **Estimated runtime** | ~120 seconds (unit) + ~180 seconds (E2E targeted) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test` (unit, fast)
- **After every plan wave:** Run targeted Playwright spec (`npx playwright test e2e/tests/<spec>.spec.ts`)
- **Before `/gsd:verify-work`:** Full suite must be green; smoke event captured in Sentry dashboard
- **Max feedback latency:** ~120 seconds (unit); E2E run is per-wave only

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-T1 | 15-01 | 1 | OBSV-03, OBSV-05 | T-15-01 | Prod-gated `/__smoke` admits two distinct render-phase throws (`OBSV-03 render` / `OBSV-05 dedupe`); prod-gate unchanged; no plan/phase/D-NN archaeology in src/ | Build + lint + src-grep | `npm run lint && npm run build && ! grep -rnE "Phase 15\|OBSV-0[345]\|D-0[1-9]\|D-1[0-6]" src/routes/ src/components/debug/` | ✓ | ✓ scoped |
| 15-01-T2 | 15-01 | 1 | OBSV-03 | T-15-02 | `Sentry.lastEventId()` surfaced both via `console.log` (with `eslint-disable-next-line no-console` + WHY) and `document.body.dataset.sentryEventId`; no `src/main.tsx` modifications | Build + lint + grep | `npm run lint && npm run build && grep -c "dataset.sentryEventId" src/routes/\[__smoke\].tsx` | ✓ | ✓ scoped |
| 15-02-T1 | 15-02 | 1 | OBSV-04 | T-15-03, T-15-04 | Final ALLOWLIST cross-checked against fresh `dist/assets/*.js`; replacements documented | Build artifact probe | `npm run build && ls dist/assets/*.js \| head -3` | ⚠ discovery (no tracked file) | ✓ scoped |
| 15-02-T2 | 15-02 | 1 | OBSV-04 | T-15-03, T-15-04 | Script exits 0 on clean build, non-zero with structured failure on miss/no-dist; zero npm deps; ≥5 names | Script execution + lint | `npm run build && node scripts/verify-sourcemap-names.mjs && npm run lint` | ✓ `scripts/verify-sourcemap-names.mjs` | ✓ scoped |
| 15-03-T1 | 15-03 | 2 | OBSV-04 | T-15-05, T-15-06 | `lint-and-unit` job gains `npm run build` + `node scripts/verify-sourcemap-names.mjs` steps between `npm test` and `npm audit`; no `e2e` job changes; D-08/OBSV-04 cited in YAML comment | YAML grep | `grep -A 60 "lint-and-unit:" .github/workflows/ci.yml \| grep -E "npm run build\|verify-sourcemap-names.mjs" \| wc -l \| grep -E "^\s*[2-9]"` | ✓ `.github/workflows/ci.yml` | ✓ scoped |
| 15-04-T1 | 15-04 | 3 | OBSV-03, OBSV-04, OBSV-05, TEST-14, TEST-15, TEST-16 | — | Pre-flight discovery emits PR URL, deploy-preview URL, CI run URL, head SHA into a tracked JSON file; PR body contains auto-close keywords for #11/#12/#13/#17/#19 | gh + file check | `test -f .planning/phases/15-observability-e2e-verify-close/15-04-preflight.json && gh pr view --json body --jq '.body' \| grep -cE "Closes #(11\|12\|13\|17\|19)" \| grep -E "^[1-5]$"` | ✓ `15-04-preflight.json` | ✓ scoped |
| 15-04-T2 | 15-04 | 3 | OBSV-04 | T-15-07 | Operator confirms Netlify deploy-preview context has `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` set BEFORE running sentry-cli; if missing, surfaces remediation | Manual — see Manual-Only Verifications | Manual — see Manual-Only Verifications | (operator state) | ✓ scoped |
| 15-04-T3 | 15-04 | 3 | OBSV-03, OBSV-04, OBSV-05 | T-15-08, T-15-09 | Three Sentry PNGs exist (`sentry-obsv-03-event.png`, `sentry-obsv-04-stack.png`, `sentry-obsv-05-dedupe.png`); OBSV-03 event ID ≠ OBSV-05 event ID; both events carry `boundary: app-root` | Filesystem + manual | `test -f .planning/phases/15-observability-e2e-verify-close/artifacts/sentry-obsv-03-event.png && test -f .planning/phases/15-observability-e2e-verify-close/artifacts/sentry-obsv-04-stack.png && test -f .planning/phases/15-observability-e2e-verify-close/artifacts/sentry-obsv-05-dedupe.png` | ✓ artifacts/*.png | ✓ scoped |
| 15-04-T4 | 15-04 | 3 | OBSV-04, TEST-14, TEST-15, TEST-16 | T-15-07, T-15-08 | Three CI PASS-line PNGs exist (`ci-test-14-pass.png`, `ci-test-15-pass.png`, `ci-test-16-pass.png`); sentry-cli output captured into chat with `.js.map` files listed for preview release SHA | Filesystem + manual | `test -f .planning/phases/15-observability-e2e-verify-close/artifacts/ci-test-14-pass.png && test -f .planning/phases/15-observability-e2e-verify-close/artifacts/ci-test-15-pass.png && test -f .planning/phases/15-observability-e2e-verify-close/artifacts/ci-test-16-pass.png` | ✓ artifacts/*.png | ✓ scoped |
| 15-04-T5 | 15-04 | 3 | OBSV-03, OBSV-04, OBSV-05, TEST-14, TEST-15, TEST-16 | — | `15-EVIDENCE-DRAFT.md` exists with six per-requirement sections, frontmatter (phase/measured/preview_sha/preview_url/ci_run_url/status: draft-pending-merge/requirements), all five issue numbers (#11/#12/#13/#17/#19) referenced, sentry-cli output in fenced code block | File + grep | `test -f .planning/phases/15-observability-e2e-verify-close/15-EVIDENCE-DRAFT.md && grep -cE "^## (OBSV-0[345]\|TEST-1[456])" .planning/phases/15-observability-e2e-verify-close/15-EVIDENCE-DRAFT.md \| grep -E "^6$"` | ✓ `15-EVIDENCE-DRAFT.md` | ✓ scoped |
| 15-05-T1 | 15-05 | 4 | OBSV-03, OBSV-04, OBSV-05, TEST-14, TEST-15, TEST-16 | T-15-10, T-15-11 | PR merged into `main`; all five GitHub issues transitioned to `closed` (via auto-close keywords or fallback) | Manual — see Manual-Only Verifications | Manual — see Manual-Only Verifications | (GitHub state) | ✓ scoped |
| 15-05-T2 | 15-05 | 4 | TEST-14, TEST-15, TEST-16 | T-15-12 | Post-merge CI run on `main` is green; `15-EVIDENCE.md` exists on `main` with `status: closed` + post-merge `ci_run_url` + `merged_at` + `merge_commit` frontmatter; no `draft-pending-merge` markers remain | File + grep | `test -f .planning/phases/15-observability-e2e-verify-close/15-EVIDENCE.md && grep -q 'status: closed' .planning/phases/15-observability-e2e-verify-close/15-EVIDENCE.md` | ✓ `15-EVIDENCE.md` | ✓ scoped |
| 15-05-T3 | 15-05 | 4 | OBSV-03, OBSV-04, OBSV-05, TEST-14, TEST-15, TEST-16 | T-15-12 | Five closure comments posted (one per closed issue: #11/#12/#13/#17/#19); each comment links to the correct section anchor in `15-EVIDENCE.md` on `main` | Manual — see Manual-Only Verifications | Manual — see Manual-Only Verifications | (GitHub state) | ✓ scoped |
| 15-05-T4 | 15-05 | 4 | OBSV-03, OBSV-04, OBSV-05, TEST-14, TEST-15, TEST-16 | — | `STATE.md` reflects Phase 15 of 17 complete; `ROADMAP.md` Phase 15 entry checked + 5/5 Shipped row; `REQUIREMENTS.md` Traceability table flips OBSV-03/04/05 + TEST-14/15/16 Pending → Complete | grep | `grep -c "Phase 15.*Shipped\|Phase 15.*5/5" .planning/ROADMAP.md && grep -c "OBSV-03.*Complete\|OBSV-04.*Complete\|OBSV-05.*Complete\|TEST-14.*Complete\|TEST-15.*Complete\|TEST-16.*Complete" .planning/REQUIREMENTS.md` | ✓ STATE/ROADMAP/REQUIREMENTS | ✓ scoped |

> Auto tasks: the "Automated Command" column copies the literal `<verify><automated>...</automated>` from each PLAN.md task. Operator-checkpoint tasks (`checkpoint:human-verify`) point to the Manual-Only Verifications table below.

---

## Wave 0 Requirements

- [x] No new test infrastructure needed — Vitest + Playwright already installed on `main`
- [x] No new fixtures needed — `freshPoll`, `E2E_TITLE`, and `/__smoke` route landed in prior phases per RESEARCH.md
- [x] No `MISSING` automated commands in any task — every auto task has a runnable `<verify><automated>...</automated>` block; every operator checkpoint has a `<human-check>` block

*Existing infrastructure covers all phase requirements; verify by running `npm run test:e2e -- --list` before any wave starts.*

---

## Manual-Only Verifications

| Behavior | Requirement | Plan Task | Why Manual | Test Instructions |
|----------|-------------|-----------|------------|-------------------|
| Netlify deploy-preview env-var inheritance (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`) | OBSV-04(b) pre-flight | 15-04-T2 | Netlify env-var scoping (Production vs Deploy preview vs Branch) is visible only via `netlify env:list --context deploy-preview` or the Netlify UI; not derivable from repo files | Operator runs `netlify env:list --context deploy-preview` (or inspects Netlify UI → Site settings → Environment variables → "Deploy previews" scope) and confirms all three vars are present. If any is missing, sets it in Netlify UI, waits for the next deploy-preview build, then retries. |
| Sentry dashboard event capture (OBSV-03 render-phase) | OBSV-03 | 15-04-T3 (Step 1) | Requires live Sentry dashboard inspection on Netlify deploy preview release | Trigger `?fire=render` on deploy-preview URL; open Sentry → Issues → filter by release SHA; confirm event with `boundary: app-root` tag and message `OBSV-03 render`; screenshot to `artifacts/sentry-obsv-03-event.png`. |
| Real function names in stack frames (OBSV-04(c)) | OBSV-04 | 15-04-T3 (Step 2) | Visual confirmation of un-minified identifiers in Sentry stack viewer | Same event as Step 1; expand stack frames; assert presence of an allowlist component name (`RenderThrowSmoke`, `SmokePage`, etc.) not mangled `$M`; screenshot to `artifacts/sentry-obsv-04-stack.png`. |
| DedupeIntegration single-event collapse (OBSV-05) | OBSV-05 | 15-04-T3 (Step 3) | Requires two-trigger smoke with distinct messages, then visual count in Sentry | Fire `?fire=render` then `?fire=dedupe` with distinct error messages; confirm Sentry shows TWO distinct events (OBSV-03 + OBSV-05) under same release; screenshot to `artifacts/sentry-obsv-05-dedupe.png`. |
| sentry-cli `releases files` Artifacts API listing | OBSV-04(b) | 15-04-T4 (Step 1) | Requires operator's local `SENTRY_AUTH_TOKEN` (PAT with `project:read` scope) — never committed, never in CI | Operator runs `npx @sentry/cli@latest releases files "<head-SHA>" list` with `SENTRY_AUTH_TOKEN` set in local env; output (verbatim) must list `.js.map` files for the preview release SHA. If empty, run Q2 disambiguation tree: (1) re-verify Plan 04 Task 2 pre-flight env, (2) retry with explicit `--org`/`--project`, (3) if still empty, capture full error to `15-EVIDENCE-DRAFT.md` and treat as blocker. |
| CI PASS-line capture for TEST-14/15/16 | TEST-14, TEST-15, TEST-16 | 15-04-T4 (Step 2) | Playwright list-reporter output lives in GitHub Actions log artifacts; must be visually screenshotted with spec name + PASSED status + duration visible | Visit CI run URL → `e2e` job logs (or HTML reporter); for each of `admin-create.spec.ts`, `browse-respond.spec.ts`, `filter-search.spec.ts` capture PASS line text and screenshot to `artifacts/ci-test-1{4,5,6}-pass.png`, each under ~200 KB. |
| Phase 15 PR merge + auto-close fire | All 6 reqs | 15-05-T1 | `gh pr merge` is operator-credentialed; merge timing not deterministic from planner | Operator stages 6 PNGs + draft EVIDENCE, commits, pushes, marks PR ready, runs `gh pr merge`; verifies five issues report `state: CLOSED` via `gh issue view <N> --json state`. Fallback: `gh issue close <N>` for any issue that didn't auto-close. |
| Post-merge CI run URL capture + EVIDENCE finalize | TEST-14/15/16 | 15-05-T2 | Post-merge CI run completes ~5-10 minutes after merge; URL not knowable in advance | Operator runs `gh run watch` (or polls `gh run list --branch main`); on green, captures URL; renames `15-EVIDENCE-DRAFT.md` → `15-EVIDENCE.md`; updates frontmatter (`status: closed`, post-merge `ci_run_url`, `merged_at`, `merge_commit`); commits on main (or via small follow-up PR if branch protection forbids direct push). |
| Per-issue closure comments with evidence anchors | All 6 reqs | 15-05-T3 | GitHub comment state lives on github.com; requires per-issue `gh issue comment` with anchor-URL verification | Operator runs `gh issue comment <N>` on each of #11/#12/#13/#17/#19, linking to `15-EVIDENCE.md` section anchor on main; clicks each link to confirm anchor resolves; on slug mismatch, edits via `gh issue comment <N> --edit-last`. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicitly flagged Manual-Only above
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (Plans 01–03 are all-auto; Plan 04 has auto T1 + T5 bookending the operator checkpoints; Plan 05 has T4 auto closing out the operator checkpoints)
- [x] Wave 0 covers all MISSING references (none — verified by inspection of every PLAN.md `<verify><automated>` block)
- [x] No watch-mode flags
- [x] Feedback latency < 120s for unit; E2E gated per wave
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete
