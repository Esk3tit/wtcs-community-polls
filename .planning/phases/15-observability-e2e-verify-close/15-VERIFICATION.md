---
phase: 15-observability-e2e-verify-close
verified_by: gsd-verifier agent
verified_at: 2026-05-25
branch: main
merge_commit: 2b7541262c3563a60e2c864c37de609682f27e5a
post_merge_ci: https://github.com/Esk3tit/wtcs-community-polls/actions/runs/26388788421
verdict: SHIPPED-with-deviations
---

# Phase 15 — Verification Report

## Goal alignment

ROADMAP.md line 119 states the Phase 15 goal:

> GitHub issues #17 (Sentry React 19 ErrorBoundary render-phase capture) and #19 (Rolldown
> sourcemap function names) are confirmed fixed via smoke verification on a Netlify deploy
> preview, Playwright specs for issues #11/#12/#13 pass in CI — all five GitHub issues closed.

All five issues are confirmed CLOSED (verified via `gh issue view` for each). Sentry smoke
evidence was captured on the Netlify deploy-preview (`34a5aa6`). The post-merge CI run on
`main` succeeded. The goal is fully delivered.

---

## Per-requirement verdicts

### OBSV-03 — Sentry React 19 ErrorBoundary render-phase capture

**Verdict: ⚠ PASS-with-deviation**

A render-phase throw at `/__smoke?fire=render` produced a persisted Sentry event
(`cc50400d90594722862e4e29906d9561`) carrying `boundary: app-root` tag,
`react.errorHandlerKind: caught`, `mechanism.handled: true`, environment `deploy-preview`,
and release `34a5aa63bc45340583f29e18270ea32ab5df1d38`. All required tag/field
assertions pass.

Deviation: the local `Sentry.ErrorBoundary` dataset event ID (`8e1c1e58…`) does not
match the persisted event ID (`cc50400d…`). The local-boundary capture was dropped by
`Sentry.dedupeIntegration()`; the surviving event is the React 19 root `onCaughtError`
auto-capture. This is the dual-capture race described in the cycle-3 cross-AI HIGH fix
path. Plan 01's `beforeCapture` invariant (`scope.setTag('boundary', 'app-root')`) ensures
the tag survives regardless of which capture wins the dedup race. The OBSV-03 contract
(event with `boundary: app-root` in Sentry) is satisfied. Screenshot:
`./artifacts/sentry-obsv-03-event.png`.

---

### OBSV-04 — Vite/Rolldown sourcemap function-name preservation (a/b/c)

**Verdict: ⚠ PASS-with-deviation**

**(a) Build-time allowlist gate**: `scripts/verify-sourcemap-names.mjs` validates all 7
allowlisted names (`RenderThrowSmoke`, `ConsentProvider`, `ConsentBanner`, `AdminGuard`,
`AuthProvider`, `RootLayout`, `AppErrorFallback`) are present in `dist/assets/*.js`
chunks. CI `lint-and-unit` job runs build + verify on every push; latest CI run:
**success**. Local dry-run: `OK: 38 chunk(s) scanned, 7/7 allowlisted names found`.

**(b) Sentry Artifacts API confirms `.js.map` upload**: The planned evidence surfaces
(`sentry-cli sourcemaps list` and `sentry-cli releases files <release> list`) do not exist
in sentry-cli 3.x (the operator's globally-installed version is 3.4.3). Substituted
`sentry-cli releases info` which confirms the release `34a5aa63…` is registered in Sentry
with a `Last event` timestamp consistent with the smoke fires. Indirect proof: release
registration is the first step `@sentry/vite-plugin` performs; source-map upload follows
it. Failure to authenticate would have prevented the release row from appearing.

**(c) Real function names in stack frames**: The smoke event stack trace shows
`RenderThrowSmoke`, `SmokePage`, `ConsentProvider`, `AuthProvider` as unmangled function
names in frames pointing to original TypeScript source paths. `metadata.function:
RenderThrowSmoke` verified via Sentry MCP `search_issue_events`. Screenshot:
`./artifacts/sentry-obsv-04-stack.png`.

Deviation (plan defect): the two sentry-cli evidence commands specified in Plan 04 for
sub-requirement (b) are absent in sentry-cli v3. Substituted `releases info` as the v3
surface; indirect upload proof chain is complete. Plan template should be updated.

---

### OBSV-05 — Sentry.dedupeIntegration() triple-handler collapse with distinct messages

**Verdict: ⚠ PASS-with-deviation**

Two distinct throws (messages `OBSV-03 render` and `OBSV-05 dedupe`) produced two
distinct persisted events (`cc50400d…` and `5f160c33…`). Sentry MCP `search_events`
aggregate: `count()=1` per message. Per-issue Events tab with `message:"..."` filter
returns `Event: 1` for each (screenshots: `sentry-obsv-05-dedupe.png` — Events=2 in
issue dropdown; `sentry-obsv-05-counts.png` — per-message filter views). The three-handler
path collapsed to exactly one persisted event per scenario. Contract satisfied.

Deviation (plan defect): per-event count strengthening via Sentry Discover (cycle-3
cross-AI MEDIUM #4) is unavailable on the free Sentry plan. Per-issue Events tab filter
fallback (Step B) was used as primary; API aggregate corroborated.

---

### TEST-14 — admin-create.spec.ts passes in CI on main

**Verdict: ✓ PASS**

Post-merge CI run on `main`
(https://github.com/Esk3tit/wtcs-community-polls/actions/runs/26388788421) returned
**success**. Verbatim PASS line from `gh run view --log`:

```
✓  2 [chromium] › e2e/tests/admin-create.spec.ts:24:1 › [@smoke] admin creates suggestion and it appears for users (2.5s)
```

Screenshot: `./artifacts/ci-test-14-pass.png`. GitHub issue #11 auto-closed on merge.

---

### TEST-15 — browse-respond.spec.ts passes in CI on main

**Verdict: ✓ PASS**

Same CI run as TEST-14. Verbatim PASS line:

```
✓  4 [chromium] › e2e/tests/browse-respond.spec.ts:19:1 › [@smoke] user browses topics, responds, sees live results (2.0s)
```

Screenshot: `./artifacts/ci-test-15-pass.png`. GitHub issue #12 auto-closed on merge.

---

### TEST-16 — filter-search.spec.ts passes in CI on main

**Verdict: ✓ PASS**

Same CI run as TEST-14. Verbatim PASS line:

```
✓  5 [chromium] › e2e/tests/filter-search.spec.ts:32:1 › [@smoke] user filters by category and searches (1.2s)
```

Screenshot: `./artifacts/ci-test-16-pass.png`. GitHub issue #13 auto-closed on merge.

---

## Per-success-criterion verdicts

### SC-1: Sentry dashboard event with `boundary: app-root` tag from render-phase throw

**Verdict: ✓ PASS**

Persisted event `cc50400d90594722862e4e29906d9561` carries `boundary: app-root` tag and
`react.errorHandlerKind: caught`. The tag was preserved via Plan 01's `beforeCapture`
invariant, which fires on the local-boundary path before `dedupeIntegration` selects
the surviving event. Sentry dashboard event URL included in EVIDENCE.md.

---

### SC-2: Sentry event stack frames show real function names, not minified

**Verdict: ✓ PASS**

Stack frames on the smoke event show `RenderThrowSmoke` (top frame at
`src/components/debug/RenderThrowSmoke.tsx:8:13`), `SmokePage`, `ConsentProvider`,
`AuthProvider`, and other provider names unmangled. Sentry `metadata.function:
RenderThrowSmoke` confirmed via Sentry MCP. Source context (original TypeScript lines)
rendered inline — this requires uploaded `.js.map` files and confirms the complete
`keepNames: true` + sourcemap-upload chain. Screenshot: `sentry-obsv-04-stack.png`.

---

### SC-3: `npm run test:e2e` (CI equivalent) passes all three specs

**Verdict: ✓ PASS**

Post-merge CI run on `main` concluded **success**. All three specs — `admin-create`,
`browse-respond`, `filter-search` — report PASSED in the E2E job. No skips, no failures
on these three specs. CI run URL:
https://github.com/Esk3tit/wtcs-community-polls/actions/runs/26388788421

---

### SC-4: GitHub issues #11, #12, #13, #17, #19 all in Closed state

**Verdict: ✓ PASS**

All five issues confirmed CLOSED via `gh issue view <N> --json state --jq '.state'`:

| Issue | State |
|-------|-------|
| #11 | CLOSED |
| #12 | CLOSED |
| #13 | CLOSED |
| #17 | CLOSED |
| #19 | CLOSED |

Each issue has a closure comment posted by the orchestrator (via `gh issue comment`) with
the PR URL, merge commit, requirement name, and anchor URL into `15-EVIDENCE.md` on
`main`. Last-comment body verified for #11 (TEST-14 anchor), #17 (OBSV-03 + OBSV-05
anchors), and #19 (OBSV-04 anchor).

---

## Shell check results

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| `git log --oneline -10` — merge commit present | `2b75412` in log | `2b75412 Merge pull request #35` at position 3 | PASS |
| `git log --oneline main..HEAD` | empty (on main, no divergence) | empty output | PASS |
| `gh issue view 11 --json state --jq '.state'` | CLOSED | CLOSED | PASS |
| `gh issue view 12 --json state --jq '.state'` | CLOSED | CLOSED | PASS |
| `gh issue view 13 --json state --jq '.state'` | CLOSED | CLOSED | PASS |
| `gh issue view 17 --json state --jq '.state'` | CLOSED | CLOSED | PASS |
| `gh issue view 19 --json state --jq '.state'` | CLOSED | CLOSED | PASS |
| Issue #11 last comment body | closure language + EVIDENCE.md anchor | "Closed by Phase 15 PR…TEST-14 evidence: https://github.com/…15-EVIDENCE.md#test-14…" | PASS |
| Issue #17 last comment body | closure language + EVIDENCE.md anchor | "Closed by Phase 15 PR…OBSV-03…OBSV-05…" | PASS |
| Issue #19 last comment body | closure language + EVIDENCE.md anchor | "Closed by Phase 15 PR…OBSV-04…" | PASS |
| `ls artifacts/*.png \| wc -l` | 7 | 7 | PASS |
| `find artifacts/ -name "*.png" -size +200k` | 0 lines (no file ≥ 200 KB) | 0 lines — `sentry-obsv-04-stack.png` is 152 KB (downscaled from 287 KB) | PASS |
| `grep "completed_phases:" STATE.md` | 2 | `completed_phases: 2` | PASS |
| `grep -c "OBSV-0[345].*Complete\|TEST-1[456].*Complete" REQUIREMENTS.md` | 6 | 6 | PASS |
| `grep "Phase 15.*Shipped\|Phase 15.*5/5" ROADMAP.md` | ≥1 match | 1 match (checkbox + "5/5 plans…Shipped 2026-05-25") | PASS |

---

## Screenshot evidence inventory

| File | Size | Type | Covers |
|------|------|------|--------|
| `sentry-obsv-03-event.png` | 63 KB | Sentry event detail | OBSV-03: release, boundary tag, env, react.errorHandlerKind |
| `sentry-obsv-04-stack.png` | 152 KB | Sentry stack trace | OBSV-04(c): real function names in frames, source context |
| `sentry-obsv-05-dedupe.png` | 33 KB | Sentry issue events panel | OBSV-05: Events=2 in issue dropdown confirming two distinct events |
| `sentry-obsv-05-counts.png` | 72 KB | Composed per-message filter views | OBSV-05: each message filter returns Event=1 |
| `ci-test-14-pass.png` | 8 KB | CI log PASS line | TEST-14: admin-create.spec.ts PASS |
| `ci-test-15-pass.png` | 8 KB | CI log PASS line | TEST-15: browse-respond.spec.ts PASS |
| `ci-test-16-pass.png` | 8 KB | CI log PASS line | TEST-16: filter-search.spec.ts PASS |

Screenshot type distribution: 4 Sentry + 3 CI = 7 total. Matches expected inventory.

---

## Plan-defect assessment

Two known plan defects were raised by the execution team and are correctly recorded in
both `15-04-SUMMARY.md` and `15-05-SUMMARY.md`.

### Defect 1: sentry-cli v3 removed `sourcemaps list` and `releases files <release> list`

The OBSV-04(b) step in Plan 04 referenced two commands absent in sentry-cli 3.x:
`sentry-cli sourcemaps list` and `sentry-cli releases files <release> list`. The
operator's globally-installed CLI was 3.4.3. The substituted surface (`releases info`)
confirmed the release exists and received events. Indirect proof chain (release row
presence implies authentication succeeded; source context in Sentry event implies `.js.map`
was uploaded) is complete and logically sound.

**Impact**: The direct enumeration of uploaded `.js.map` files is absent. The indirect
proof chain is sufficient for the OBSV-04(b) contract but weaker than a direct listing.
This defect should be corrected in the plan template for any future phase that needs to
verify Sentry artifact uploads.

### Defect 2: OBSV-05 Discover paid-tier dependency

Plan 04 specified Sentry Discover for per-event count proof (cycle-3 cross-AI MEDIUM #4).
Discover is paid-tier only; this project is on the free plan. The per-issue Events tab
`message:"..."` filter was used as the Step B fallback, corroborated by Sentry MCP
`search_events` aggregate. The OBSV-05 contract (two distinct persisted events, one per
message) is satisfied by this evidence.

**Impact**: None to current verification. Plan template should make Discover an "if
available" path, not the primary.

---

## Plan summaries vs. must-haves alignment

| Plan | Must-haves | Delivered | Verdict |
|------|-----------|-----------|---------|
| 15-01 | `?fire=render\|dedupe` discriminator, local `Sentry.ErrorBoundary`, `beforeCapture` tag, `document.body.dataset.sentryEventId`, ESLint override | All delivered per SUMMARY; lint/tsc/build/test all exit 0 | PASS |
| 15-02 | `scripts/verify-sourcemap-names.mjs` with 7-name locked allowlist, happy/sad/no-dist paths, exit codes | All delivered; happy path `7/7` confirmed, sad + no-dist paths exercised | PASS |
| 15-03 | Two steps in `lint-and-unit` CI job (build + verify); no SENTRY_AUTH_TOKEN leaked; YAML valid | Delivered via `684797e`; verified by awk slice + grep checks per SUMMARY; CI run passed | PASS |
| 15-04 | 7 PNGs committed, `15-EVIDENCE-DRAFT.md` written, sentry-cli output captured, preflight JSON committed | Delivered; 7 PNGs confirmed in artifacts/; EVIDENCE-DRAFT.md finalized to EVIDENCE.md in Plan 05; defects documented | PASS-with-deviations |
| 15-05 | PR merged, all 5 issues auto-closed, closure comments posted, STATE/ROADMAP/REQUIREMENTS updated | All delivered: merge commit `2b75412`, issues closed, 5 closure comments at recorded URLs, all three docs updated | PASS |

---

## EVIDENCE.md frontmatter verification

| Field | Required | Actual | OK? |
|-------|----------|--------|-----|
| `status` | `closed` | `closed` | ✓ |
| `ci_run_url` | post-merge run on main | `https://github.com/…/actions/runs/26388788421` (post-merge `main` run) | ✓ |
| `merge_commit` | `2b7541262c3563a60e2c864c37de609682f27e5a` | `2b7541262c3563a60e2c864c37de609682f27e5a` | ✓ |
| All 6 requirement sections | populated with content + screenshots | OBSV-03, OBSV-04(a/b/c), OBSV-05, TEST-14, TEST-15, TEST-16 all populated | ✓ |
| Final state table | all 5 issues with closed timestamps | 5 rows with `closedAt` values and anchor URLs | ✓ |

---

## Phase-level verdict

**SHIPPED-with-deviations**

All six requirements (OBSV-03, OBSV-04a/b/c, OBSV-05, TEST-14, TEST-15, TEST-16) are
Complete in REQUIREMENTS.md. All four success criteria are met. All five GitHub issues are
CLOSED with evidence-anchor closure comments. Post-merge CI on `main` is green. The
deviations are plan defects (sentry-cli v3 surface drift; Discover paid-tier
unavailability) that were correctly identified, documented, and mitigated with logically
sound fallbacks — they do not represent gaps in the delivered observability or E2E
verification.

---

## Recommended next action

Proceed to **Phase 16** planning (Performance — PostHog dynamic import, bundle audit
workflow, WebP logo, route prefetching, Lighthouse v1.3 mobile delta). Before starting,
feed the two plan-defect notes from Phase 15 into the Phase 16 plan template's lessons-
learned section:

1. Always specify `npx --no-install @sentry/cli@<exact-version>` (lockfile-resolved
   transitive) rather than relying on the globally-installed CLI for evidence commands.
2. Mark Sentry Discover steps as "if available (paid plan)" in any OBSV-style plan that
   needs per-event count verification; document the per-issue Events tab filter as the
   primary fallback.
