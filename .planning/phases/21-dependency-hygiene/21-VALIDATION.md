---
phase: 21
slug: dependency-hygiene
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> NOTE: Phase 21 ships **no new application code** — it rebases/merges two dependabot
> PRs (#34 lint-staged 16→17, #44 the 18-package minor+patch group). "Validation" here
> means proving the bumped dependencies pass the existing CI harness plus a local smoke,
> per CONTEXT D-03. No Wave 0 test stubbing is required; the existing suite IS the harness.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit/component) + Playwright (e2e); GitHub Actions CI is the merge-gate harness |
| **Config file** | `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml` (jobs: `lint-and-unit`, `test-integration`, `e2e`) |
| **Quick run command** | `npm run build` (local typecheck + bundle — catches `tsc -b --noEmit` / type-drift) |
| **Full suite command** | `gh pr checks <PR#>` green (lint-and-unit + test-integration + e2e) |
| **Estimated runtime** | CI ~ several min/PR; local `npm run build` ~ tens of seconds |

---

## Sampling Rate

- **After each PR rebase:** Re-run CI; confirm `gh pr checks <PR#>` reports all jobs green.
- **Before each merge:** `npm run build` locally + local app smoke run (both PRs); plus a
  pre-commit hook test for #34 (stage a `.ts`/`.tsx` file, run `npx lint-staged`, confirm
  eslint + `tsc -b --noEmit` both execute under lint-staged v17).
- **Before `/gsd:verify-work`:** Both PRs merged, CI green on `main`, zero open dependabot PRs.
- **Max feedback latency:** one CI run per PR (minutes).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01 (DEP-02 / #34) | 01 | 1 | DEP-02 | — | lint-staged v17 pre-commit hook runs eslint + tsc on staged TS files | ci + manual hook test | `gh pr checks 34` green; `npx lint-staged` on a staged `.ts` | ✅ existing | ⬜ pending |
| 21-02 (DEP-01 / #44) | 02 | 2 | DEP-01 | — | 18 bumped libs typecheck + build + run; no runtime/type regression | ci + build + smoke | `gh pr checks 44` green; `npm run build` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Final planner-authored task IDs may differ; map each plan task to DEP-01 / DEP-02 above.*

---

## Wave 0 Requirements

Existing infrastructure (Vitest + Playwright + CI) covers all phase requirements. No Wave 0
test scaffolding — the bumps are validated by the existing suite, `npm run build`, and a
local smoke. Phases 18/19 already repaired the local test harness, so the baseline is green.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Local app smoke run (both PRs) | DEP-01, DEP-02 | UI/runtime behavior of bumped libs (router, supabase-js, sentry, posthog) not fully covered by unit tests | Check out the PR branch, `npm run build` + `npm run preview` (or `npm run dev`), exercise core flows (load, Discord sign-in path, suggestion list render) |
| lint-staged v17 pre-commit hook | DEP-02 | Hook behavior only observable on a real staged commit, not in CI | Stage a `.ts`/`.tsx` change, run `npx lint-staged`, confirm both `eslint --max-warnings 0 --no-warn-ignored` and `tsc -b --noEmit` execute |

---

## Validation Sign-Off

- [ ] Each plan task maps to DEP-01 or DEP-02 with a CI/build/smoke verify
- [ ] Sampling continuity: every task gated on CI-green + local check (D-03)
- [ ] Wave 0 not required (existing infra covers all requirements)
- [ ] No watch-mode flags
- [ ] Feedback latency = one CI run per PR
- [ ] `nyquist_compliant: true` set in frontmatter (after planner/auditor review)

**Approval:** pending
