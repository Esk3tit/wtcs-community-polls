# Phase 21: Dependency Hygiene - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Close out v1.4 by reviewing, validating, and merging the **two remaining open dependabot PRs** so the project carries zero dependency-update debt at the final milestone. After this phase, no open dependabot PRs remain for the v1 carry-forward list.

The two PRs (verified open 2026-06-05, both authored by `app/dependabot`):
- **PR #34 (DEP-02)** — `lint-staged` 16.4.0 → 17.0.7 (devDependency). CI currently **green**. Config in `package.json`: `"*.{ts,tsx}": ["eslint --max-warnings 0 --no-warn-ignored", "bash -c 'tsc -b --noEmit'"]`.
- **PR #44 (DEP-01)** — `chore(deps): bump the minor-and-patch group, 18 updates`. This **supersedes PR #40** (the 15-package group cited in REQUIREMENTS/ROADMAP); REQUIREMENTS DEP-01 explicitly allows satisfaction by "an equivalent up-to-date bump." CI currently **red** on `lint-and-unit`, **but** that CI run is stale — it ran 2026-06-03 on commit `0ddb157`, *before* Phases 19 and 20 merged to main. Packages in the group include `@tanstack/react-router` 1.169.2→1.170.11, `@supabase/supabase-js` 2.105.4→2.107.0, `react`/`react-dom` 19.2.6→19.2.7, `@types/react` 19.2.14→19.2.16, `@sentry/react` 10.53.1→10.56.0, `posthog-js` 1.373.4→1.379.0, `lucide-react` 1.14.0→1.17.0, plus the `@tanstack/router-*` cli/plugin/devtools tooling.

**Out of scope:** any application feature/code change beyond what's needed to make the bumped dependencies pass CI; broader dependency audits, pinning policy changes, or major-version bumps not already in these two PRs.
</domain>

<decisions>
## Implementation Decisions

### PR #44 strategy (the failing 18-package group)
- **D-01:** Rebase PR #44 onto current `main` (post Phases 19/20) and re-run CI first — the red result is on a stale pre-19/20 commit and may clear. If green after rebase → review + merge keeping all 18 packages. If still red → diagnose the genuine root cause and fix it **on-branch**, keeping the full group. Do NOT judge the merge on the stale CI run.

### Merge sequencing
- **D-02:** Merge **PR #34 first** — it is green, independent (dev-only `lint-staged` bump), and closes DEP-02 as a quick win. Then focus on the #44 group for DEP-01. Two separate merges, #34 before #44.

### Validation bar before each merge
- **D-03:** Require **all CI green PLUS a local check**: `npm run build` + a local app smoke run for both PRs, and additionally a **pre-commit hook test** for #34 (stage a `.ts`/`.tsx` file and confirm the lint-staged v17 hook runs `eslint` + `tsc -b --noEmit` correctly). CI-green alone is not sufficient; CI + local smoke is the bar (appropriate for a $0 hobby-scale prod app).

### Claude's Discretion
- **D-04 (fix-forward + isolate-and-flag):** Operator delegated edge-case handling. Default: **fix-forward**. If a specific package in the #44 group genuinely cannot be made green on-branch (a real breaking change that isn't quickly fixable), the executor **isolates and defers just that one package** (drops it from the group), merges the remaining packages, and **flags the deferred package to the operator** — never silently drops it and never abandons the whole group. For the lint-staged v17 bump, **surface any Node-version breaking change** rather than auto-bumping CI Node (CI is already Node 22, which satisfies lint-staged v17's Node 20.17+/22.9+ floor — so this is expected to be a non-issue, but surface it if it arises).
- Researcher/planner own the technical root-cause diagnosis of the #44 `lint-and-unit` failure (likely a `tsc`/eslint type drift from `@types/react`, `@tanstack/react-router`, or `@supabase/supabase-js`, or stale CI) — that's an implementation detail, not a user decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §DEP-01 (line ~52), §DEP-02 (line ~54), and the requirement-status table (lines ~103-104, both currently "Pending"). NOTE: DEP-01 text still cites PR #40 (15 updates) — read as superseded by PR #44 (18 updates) per the "or superseded by an equivalent up-to-date bump" clause.
- `.planning/ROADMAP.md` §Phase 21 — goal + 3 success criteria. NOTE: success criteria 1 & 2 cite PR #40 — same supersession applies (#40 → #44).

### Live PRs (GitHub — the actual targets)
- PR #34 — `gh pr view 34` / `gh pr checks 34` (lint-staged 16→17, DEP-02). Branch `dependabot/npm_and_yarn/lint-staged-17.0.5`.
- PR #44 — `gh pr view 44` / `gh pr checks 44` (18-package minor+patch group, DEP-01). Branch `dependabot/npm_and_yarn/minor-and-patch-6029210c9a`. Stale red CI: run `26865651805` on commit `0ddb157` (pre-19/20).

### Config & CI (validation anchors)
- `package.json` — `lint-staged` config block (`*.{ts,tsx}` → eslint + `tsc -b --noEmit`); the bumped dependency versions live here too.
- `.github/workflows/ci.yml` — jobs `lint-and-unit`, `test-integration`, `e2e`; Node version `'22'` (lines ~28/57/124). Node 22 satisfies lint-staged v17's Node floor.

### Project decisions in play
- `.planning/PROJECT.md` — tech-stack lock + $0 budget constraint (informs "minor/patch + green CI + local smoke" validation bar).
- `.planning/STATE.md` §"v1.4 operator decisions" + §"Deferred Items" (DEP-01 row updated #40→#44).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- CI pipeline (`.github/workflows/ci.yml`) already runs lint + unit + integration + e2e on every PR — this IS the primary validation harness for the bumps. No new test infra needed.
- Phases 18/19 repaired the local test harnesses (ES256 edge-runtime, gotrue email config, migration 15) — the test suite is healthy on current main, so a clean rebase of #44 should run against a green baseline (Phase 21 depends on Phase 18 per ROADMAP).

### Established Patterns
- **PR merge gate (project convention):** never merge until all configured review bots (CodeRabbit, gemini-code-assist, greptile) have reviewed AND the operator explicitly approves. Applies to both #34 and #44.
- **Planning docs live on main per-phase:** Phase 21's `.planning/` artifacts merge to main; the dependency bumps themselves are code PRs from dependabot (separate from the planning history).
- **v1.4 = final milestone, fix inline:** no new milestones/phases — fix tractable dependency issues directly on the dependabot branch.

### Integration Points
- The bumps touch load-bearing libs (`@tanstack/react-router`, `@supabase/supabase-js`, `react`/`react-dom`, `@sentry/react`, `posthog-js`). Any TS/lint breakage surfaces in `lint-and-unit` (`tsc -b --noEmit` + eslint max-warnings 0). The `@types/react` bump is the most likely source of `tsc` drift.

</code_context>

<specifics>
## Specific Ideas

- Operator wants the executor/orchestrator to drive the GitHub operations directly (rebase, re-run CI, merge) — consistent with prior phases where the orchestrator drove CLI/CI work rather than handing off to the user. The merge itself still waits for the explicit operator OK per the merge gate.
- The stale-CI insight is load-bearing: do NOT report #44 as "failing" without first rebasing onto current main and re-running — the 2026-06-03 run predates Phases 19/20.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (If a #44 package proves genuinely unmergeable, it is isolated/deferred and flagged per D-04, not folded into a new phase — v1.4 is the final milestone.)

</deferred>

---

*Phase: 21-dependency-hygiene*
*Context gathered: 2026-06-05*
