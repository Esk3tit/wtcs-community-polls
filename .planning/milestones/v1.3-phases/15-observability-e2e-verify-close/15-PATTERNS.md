# Phase 15: Observability + E2E Verify & Close — Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 7 (1 MOD route, 1 NEW script, 1 MOD CI workflow, 1 NEW evidence doc, 1 NEW artifacts/ dir, 1 PR-body keyword block, 1 closure-comment helper)
**Analogs found:** 6 / 7 (closure-comment helper is documented as "no analog — manual `gh issue close`")

---

## File Classification

| File | Status | Role | Data Flow | Closest Analog | Match |
|------|--------|------|-----------|----------------|-------|
| `src/routes/[__smoke].tsx` | MOD | route-component (env-gated, debug surface) | request-response (search-param read → conditional render of two distinct triggers) | self (existing `?render=1` body) | exact (extend in place) |
| `scripts/verify-sourcemap-names.mjs` | NEW | build-time verification script (Node ESM, no deps) | file-I/O (read `dist/assets/*.js`, regex-match allowlist, exit 0/1) | `.planning/closure/audit-screenshots.mjs` (existing repo-root `.mjs` script; same shebang-less ESM-by-extension + `node:fs/promises` imports + `process.exit(1)` on failure) | exact (structural; data flow simpler — no Playwright needed) |
| `.github/workflows/ci.yml` | MOD | CI workflow (GitHub Actions) | build-then-verify (sequential `run:` steps inside `lint-and-unit` job) | self (existing `lint-and-unit` job at lines 21–38; existing `Build app` step at lines 202–206 in the `e2e` job is the closest existing `npm run build` invocation to model) | exact (structural) |
| `.planning/phases/15-observability-e2e-verify-close/15-EVIDENCE.md` | NEW | doc / phase closure evidence (per-requirement table → Sentry event IDs + CI run URL + sentry-cli output + screenshot links) | n/a | `.planning/closure/OBSV-02-bundle-delta.md` (existing `.planning/closure/` evidence doc with YAML frontmatter + per-method table + screenshot embeds) | role-match (closure evidence) |
| `.planning/phases/15-observability-e2e-verify-close/artifacts/` | NEW | doc / committed PNG screenshots (< 200 KB each) | n/a | `.planning/milestones/v1.1-phases/07-observability-hardening/artifacts/` (committed `sentry-componentstack.png` + `sentry-event.json` + `sourcemap-names-excerpt.txt` + `__name-grep.txt` — same kind of evidence at same depth) | exact (structural; same v1.1 closure pattern) |
| Phase 15 PR body (`Closes #11, #12, #13, #17, #19` keyword block) | NEW | git/PR layer (PR description) | n/a — text-only artifact rendered by GitHub | No analog in `.planning/`. GitHub's auto-close keyword feature is the canonical mechanism. | first-instance |
| Per-issue closure comment (`gh issue close N --comment "..."` after merge) | NEW | git/PR layer (manual operator step) | n/a | **No analog** — no `gh issue close` script exists under `scripts/` or `.planning/`. The phrase is referenced only in `15-VALIDATION.md` line 63 as a manual instruction. Document as a manual operator step in the EVIDENCE doc. | none |

---

## Pattern Assignments

### `src/routes/[__smoke].tsx` (MOD — add a second distinct render-phase throw trigger)

**Analog:** self. The file already validates a `render?: '1'` search param, prod-gates via `beforeLoad`, and lazy-loads `RenderThrowSmoke`. Phase 15 D-02 adds a SECOND distinct trigger so OBSV-05's Dedupe smoke can fire DISTINCT messages per scenario.

**Existing route body — current shape (lines 1–46) to extend in place:**

```typescript
/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'

interface SmokeSearch {
  render?: '1'
}

const RenderThrowSmoke = lazy(() =>
  import('@/components/debug/RenderThrowSmoke').then(m => ({
    default: m.RenderThrowSmoke,
  }))
)

export const Route = createFileRoute('/__smoke')({
  // TanStack's default search parser is parseSearchWith(JSON.parse), which
  // coerces a bare `?render=1` to the number 1. Accept both forms.
  validateSearch: (search: Record<string, unknown>): SmokeSearch => {
    const r = search.render
    if (r === '1' || r === 1) return { render: '1' }
    return {}
  },
  beforeLoad: () => {
    if (import.meta.env.VITE_NETLIFY_CONTEXT === 'production') {
      throw notFound()
    }
  },
  component: SmokePage,
})

function SmokePage() {
  const { render } = Route.useSearch()
  if (render !== '1') {
    return (
      <p className="text-sm text-muted-foreground">
        Smoke route. Append <code>?render=1</code> to trigger a render-phase throw.
      </p>
    )
  }
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading smoke component…</p>}>
      <RenderThrowSmoke />
    </Suspense>
  )
}
```

**Existing throw component (`src/components/debug/RenderThrowSmoke.tsx` — lines 1–8):**

```typescript
// Permanent observability canary. Throws from render (not a handler) so the
// React 19 hooks + Sentry.ErrorBoundary capture path is exercised end-to-end.
// `: never` is intentional and subtypes ReactNode for JSX use.
export function RenderThrowSmoke(): never {
  throw new Error(
    'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'
  )
}
```

**Divergence (Phase 15 D-02 / D-03 — pattern to apply):**

- **Two-button shape, single route** (planner discretion under D-02 — sub-routes vs query-params vs in-page buttons). Shortest mechanism under TanStack file-based routing is to **add a second search-param value** to the existing `SmokeSearch` interface: `fire?: 'render' | 'dedupe'`. No new route file, no `routeTree.gen.ts` re-emit churn. Mirrors the existing `render?: '1'` validator shape (lines 5–22).
- **Distinct error messages per scenario** — Dedupe collapses on stacktrace + fingerprint + message. Per RESEARCH.md `<phase_requirements>` row OBSV-05, the two messages must be literally different: `new Error('OBSV-03 render')` vs `new Error('OBSV-05 dedupe')`. Implementation: extend `RenderThrowSmoke` to accept a `message` prop, OR introduce a second sibling throw component (`DedupeCheckSmoke`) — planner picks based on which keeps the component count smallest. Either way, the throw lives INSIDE the React render tree so `Sentry.ErrorBoundary` catches it (RESEARCH.md `<architectural_responsibility_map>` row "Render-phase `throw` capture path").
- **Surface `Sentry.lastEventId()` two ways (D-03)** — `console.log(Sentry.lastEventId())` AND `document.body.dataset.sentryEventId = Sentry.lastEventId() ?? ''`. The console line is for human verifiers reading DevTools; the DOM dataset attribute is for a future Playwright spec to read without UI changes. Both must fire AFTER the throw is caught — which means they cannot live inside `RenderThrowSmoke` (component never returns). The right surface is either:
  - (a) an effect in `SmokePage` that runs AFTER the boundary catches and re-renders (would require boundary `onError` to broadcast eventId — complex); OR
  - (b) a button/effect that runs the throw imperatively from a `useEffect` so eventId can be read post-throw via `Sentry.lastEventId()` on the next tick.
  - Planner decides; both shapes are research-supported. The DOM dataset write must be wrapped in a guard so a future Playwright spec sees it AFTER the throw (e.g., `requestAnimationFrame` or `queueMicrotask`).
- **WHY-only comments** — per CLAUDE.md + memory `feedback_no_review_archaeology_in_source`: do NOT cite "Phase 15", "OBSV-03/04/05", or "D-02" in `src/`. Explain WHY ("two distinct messages so Dedupe doesn't collapse the second event"; "eventId surfaced to DOM dataset for future automation"). Plan IDs belong in commit messages and PR body, never in `src/`.
- **eslint-disable for `console.log`** — CLAUDE.md says "No `console.log` left in committed app code". D-03 requires it. Apply an inline `// eslint-disable-next-line no-console` with a WHY comment ("intentional eventId surfacing for human verifiers").
- **Preserve `beforeLoad` prod gate** (D-01) — the existing `VITE_NETLIFY_CONTEXT === 'production' && throw notFound()` block (lines 23–27) stays untouched. No new gate, no admin guard.
- **Preserve `lazy()` + `Suspense`** — the existing lazy-load pattern (lines 9–13, 40–44) is correct; extend it for the second throw component if you add one.

---

### `scripts/verify-sourcemap-names.mjs` (NEW — Node ESM script, no deps, exits non-zero on missing literal `function Name(`)

**Analog:** `.planning/closure/audit-screenshots.mjs`. Same `.mjs` ESM-by-extension convention, same `node:fs/promises` imports, same `process.exit(1)` failure shape. Phase 15's script is structurally simpler — no Playwright, no Supabase, just read + grep + exit.

**Imports pattern** (from `.planning/closure/audit-screenshots.mjs` lines 27–30):

```javascript
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdir, rm, writeFile, stat as fsStat, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
```

**Adapt for `verify-sourcemap-names.mjs`** — strip Playwright + Supabase, keep only `node:fs/promises`:

```javascript
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
```

**Failure-exit pattern** (from `.planning/closure/audit-screenshots.mjs` lines 320–327):

```javascript
if (unexpectedGroups.length > 0) {
  console.error(`\n=== sha256 DUPE FAILURE: ${unexpectedGroups.length} unexpected collision group(s) ===`)
  for (const group of unexpectedGroups) {
    console.error(`  collision: ${group.join(', ')}`)
  }
  console.error('Hydration sentinel did not prevent loading-shell captures. Fix the harness before re-running. ...')
  process.exit(1)
}
console.log(`sha256 uniqueness check passed (${dupeFiles.length} PNGs, ${expectedCount} allowed home↔admin collision pairs per D-19, 0 unexpected collisions)`)
```

**File-scan pattern** (also from `.planning/closure/audit-screenshots.mjs` lines 294–304):

```javascript
const { readdir: readdirForDupe } = await import('node:fs/promises')
const pathForDupe = await import('node:path')
const dupeFiles = (await readdirForDupe(ARTIFACTS_DIR)).filter((f) => f.endsWith('.png')).sort()
const shaToFiles = new Map()
for (const f of dupeFiles) {
  const full = pathForDupe.join(ARTIFACTS_DIR, f)
  const buf = await readFile(full)
  const sha = createHash('sha256').update(buf).digest('hex')
  if (!shaToFiles.has(sha)) shaToFiles.set(sha, [])
  shaToFiles.get(sha).push(f)
}
```

**Allowlist source-of-truth pattern** (`.planning/milestones/v1.1-phases/07-observability-hardening/artifacts/__name-grep.txt` lines 16–25):

```text
# Rolldown-correct mechanical evidence — literal function declarations preserved:
  function RenderThrowSmoke           → present in 1 chunk(s)  (e.g., RenderThrowSmoke-XCbSANRV.js)
  function SmokePage                  → present in 1 chunk(s)  (e.g., ___smoke_-DYnw_MRs.js)
  function RootLayout                 → present in 1 chunk(s)  (e.g., index-B_e1sr_E.js)
  function AppErrorFallback           → present in 1 chunk(s)  (e.g., index-B_e1sr_E.js)
  function ConsentChip                → present in 1 chunk(s)  (e.g., index-B_e1sr_E.js)
  function ConsentBanner              → present in 1 chunk(s)  (e.g., index-B_e1sr_E.js)
  function LandingPage                → present in 1 chunk(s)  (e.g., LandingPage-Bym6UGzO.js)
  function AdminPage                  → present in 1 chunk(s)  (e.g., admin-BUzFcT9l.js)
  function AuthProvider               → present in 1 chunk(s)  (e.g., index-B_e1sr_E.js)
  function ThemeProvider              → present in 1 chunk(s)  (e.g., index-B_e1sr_E.js)
```

This Phase-7 baseline is the source-of-truth for D-06's "allowlist of known component names". The phase-15 allowlist must include AT LEAST D-06's seed (`ConsentProvider`, `AuthGate`, `AdminGuard`, `RenderThrowSmoke`, `App`) but should be cross-checked against THIS baseline + a fresh `npm run build` on the phase-15 branch (the baseline is Phase 7; component names may have shifted).

**Divergence (Phase 15 D-05 / D-06 / D-08 — pattern to apply):**

- **Script body**: read all `dist/assets/*.js` (use `readdir` + filter `.js` extension — mirrors `audit-screenshots.mjs` `dupeFiles` filter); concatenate or iterate chunks; for each name in allowlist, regex-match `/\bfunction Name\b/` (literal `function ` followed by the name and a word boundary so `functionNameInferred` doesn't false-positive); collect misses; exit `process.exit(1)` with a list of missing names if any. Match the `audit-screenshots.mjs` error-shape (heading line + bulleted misses + actionable resolution sentence).
- **No deps**: pure Node `node:fs/promises` + `node:path`. No npm install required. Runs on Node 22 (CI's `actions/setup-node@v6 with node-version: '22'`).
- **Build-agnostic** (Claude's discretion in CONTEXT.md): script ASSUMES `dist/` exists. CI step orders `npm run build` BEFORE the verify step, so the script does not need to invoke build itself. If `dist/assets/` is missing, exit `1` with "run `npm run build` first" guidance.
- **Empty `catch` forbidden** (CLAUDE.md) — any `try/catch` around `readFile`/`readdir` must log + rethrow or exit non-zero. Pattern matches `audit-screenshots.mjs` line 127–134 (probe + structured throw).
- **WHY-only comment header** — file header explains WHY (preserve `keepNames: true` contract; sourcemap-name regression guard). May cite the requirement ID `OBSV-04` since this is `scripts/`, NOT `src/`. CLAUDE.md's "no review-round archaeology" rule applies to `src/`, not `scripts/` — but keep header lean.

---

### `.github/workflows/ci.yml` (MOD — add verify-sourcemap step to `lint-and-unit` job after a new build step)

**Analog:** self. Two existing patterns in this file inform the diff:

**Existing `lint-and-unit` job (lines 21–38) — current shape (target wiring site for D-08):**

```yaml
jobs:
  lint-and-unit:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '22'
          cache: 'npm'
      # D-16 §2 — use `npm ci` (never the non-ci variant). Fails fast if
      # lockfile and package.json disagree; installs from the lockfile only.
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --run
      # D-16 §4 — non-blocking supply-chain check. Promotable to blocking
      # once the launch-week advisory noise floor is understood.
      - name: npm audit (non-blocking)
        run: npm audit --audit-level=high || true
```

**Critical observation:** `lint-and-unit` does NOT currently run `npm run build`. The only existing `npm run build` invocation in this workflow is in the `e2e` job at lines 202–206 (which needs Supabase env vars baked in — that path is wrong for our verifier).

**Existing `Build app` step in `e2e` job (lines 202–206) — model for the new build step:**

```yaml
- name: Build app
  env:
    VITE_SUPABASE_URL: http://localhost:54321
    VITE_SUPABASE_ANON_KEY: ${{ steps.supabase-keys.outputs.anon_key }}
  run: npm run build
```

**Divergence (Phase 15 D-08 — pattern to apply):**

- **Add a build step BEFORE the verify step in `lint-and-unit`** (CONTEXT.md `<integration_points>` says "must run AFTER a build step in that job"). The build does NOT need Supabase env vars because `scripts/verify-sourcemap-names.mjs` only inspects `dist/assets/*.js` for literal function-name preservation — it does not exercise runtime Supabase wiring. Use the minimal form:
  ```yaml
  - name: Build (for sourcemap-names verify)
    run: npm run build
  - name: Verify sourcemap function names preserved
    run: node scripts/verify-sourcemap-names.mjs
  ```
- **Step order**: insert AFTER `npm test -- --run` (line 34) and BEFORE `npm audit` (lines 37–38), so a failing verify aborts the job at a meaningful spot. Alternative: place at the very end (after audit) so unit tests still surface even if verify fails — planner picks based on which signal matters more on red.
- **No env-var bleed**: build runs without `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`. Vite's `vitest.config.ts` already supplies test-env placeholders (line 52–55 of `vite.config.ts`), but production `vite build` reads from real env. `src/lib/supabase.ts` throws at module-load if these are missing — if the production build chokes on missing env, the planner may need to supply non-secret placeholders in the env block (mirroring the e2e job pattern). Verify by running `SENTRY_AUTH_TOKEN= npm run build` locally with empty `VITE_SUPABASE_*` first.
- **No new job**: D-08 explicitly says "wire into `lint-and-unit`". Do NOT create a new `verify-sourcemap` job (would add a needs-graph edge and slow PR feedback).
- **Comment style**: existing `D-07`, `D-16 §2`, `D-16 §4` markers in the file (lines 3, 30, 37) show the convention — CI workflow comments cite decision IDs (this is NOT `src/`, so plan-archaeology rule does not apply). Cite `D-08` and the requirement (`OBSV-04(a)`).
- **No changes to `e2e` job** — D-11 explicitly out of scope for E2E surface; D-09/D-10/D-12 confirm the `e2e` job already runs the `@smoke` filter on every push to `main` (line 237).

---

### `.planning/phases/15-observability-e2e-verify-close/15-EVIDENCE.md` (NEW — single-file phase evidence doc)

**Analog:** `.planning/closure/OBSV-02-bundle-delta.md`. Same closure-evidence shape: YAML frontmatter (requirement + measured date + base SHA + phase SHA + status) → method narrative → per-method table → discussion. The Phase 15 evidence doc is broader (covers 6 requirements: OBSV-03/04/05 + TEST-14/15/16) so it leans on a table-per-requirement layout, not OBSV-02's single-flag focus.

**Frontmatter pattern** (from `.planning/closure/OBSV-02-bundle-delta.md` lines 1–11):

```yaml
---
requirement: OBSV-02
measured: 2026-04-30
target_pct: 1.5
actual_pct: 6.24
status: over-target — D-14 ship-anyway policy applied
phase: 07-observability-hardening
plan: 03
base_sha: 6a0a1e1e7c71595cf709d27e9b0f37f331b501fe
phase7_sha: b9afb9991efbaaae91050c8d25b3d34ac7575b4a
---
```

**Per-requirement table pattern** (extrapolate from OBSV-02 line 33–37 + this phase's RESEARCH.md `<phase_requirements>` table at lines 75–82):

Phase 15 EVIDENCE.md should emit ONE table row per requirement (6 rows: OBSV-03, OBSV-04, OBSV-05, TEST-14, TEST-15, TEST-16) with columns: `Requirement` | `Trigger / Source` | `Evidence Anchor` (Sentry event ID OR CI run URL OR `sentry-cli` output snippet) | `Screenshot` (link to `artifacts/*.png`) | `Issue Closed`.

**Divergence (Phase 15 D-14 — pattern to apply):**

- **Single file** (D-14): one `15-EVIDENCE.md`, not per-requirement files. OBSV-02 chose one file per OBSV-NN; D-14 deliberately consolidates.
- **YAML frontmatter** — include `phase: 15-observability-e2e-verify-close`, `measured: <date>`, `preview_sha: <VITE_COMMIT_SHA from Netlify preview build>`, `ci_run_url: <post-merge CI run URL>`, `status: closed-pending-merge` initially, flipped to `closed` after merge + per-issue comments posted.
- **Sentry-cli output verbatim** (D-07): paste the raw `npx @sentry/cli@latest releases files "$VITE_COMMIT_SHA" list` output inside a fenced code block (no truncation, no reformat) — matches OBSV-02's "Total gzip table" verbatim-from-tool convention.
- **Screenshot links use relative paths** to `./artifacts/<file>.png` — mirrors how OBSV-02 references files in the same directory.
- **Per-spec PASS-line capture** (D-10): for TEST-14/15/16, paste the explicit PASS line from the Playwright `--reporter list` output for each spec (e.g., `✓  e2e/tests/admin-create.spec.ts:23:5 › [@smoke] admin-create › creates a Yes/No poll (12.4s)`). One block per spec.
- **Freshness rule (D-12)**: the cited CI run URL MUST be the POST-merge run on `main`, not the pre-merge PR run. EVIDENCE.md is therefore landed in two passes: (a) drafted in the PR with placeholders; (b) finalized in a follow-up commit after PR merges and the post-merge run goes green.

---

### `.planning/phases/15-observability-e2e-verify-close/artifacts/` (NEW directory — committed PNG screenshots)

**Analog:** `.planning/milestones/v1.1-phases/07-observability-hardening/artifacts/`. Same depth, same kind of evidence, same `< 200 KB` PNG policy.

**Existing artifact directory contents** (Phase 7):

```
artifacts/
├── __name-grep.txt          ← text evidence of preserved function names
├── sentry-componentstack.png ← Sentry dashboard screenshot
├── sentry-event.json         ← raw Sentry event payload
└── sourcemap-names-excerpt.txt ← sourcemap text excerpt
```

**Divergence (Phase 15 D-15 — pattern to apply):**

Suggested file naming (per D-15):

```
.planning/phases/15-observability-e2e-verify-close/artifacts/
├── sentry-obsv-03-event.png     ← OBSV-03 Sentry event with boundary:app-root tag
├── sentry-obsv-04-stack.png     ← OBSV-04 expanded stack frames with real names
├── sentry-obsv-05-dedupe.png    ← OBSV-05 two events (not one, not three)
├── ci-test-14-pass.png          ← admin-create PASS line in Playwright report
├── ci-test-15-pass.png          ← browse-respond PASS line
└── ci-test-16-pass.png          ← filter-search PASS line
```

- **PNG size**: < 200 KB each (D-15). Crop in DevTools/macOS screenshot tool to relevant viewport before committing.
- **No `.gitignore` carve-out needed** for this directory (unlike `.planning/closure/artifacts/screenshots/`, which IS gitignored per `audit-screenshots.mjs` line 332 commentary). Phase 15 commits the binaries directly.
- **No `MANIFEST.json`** — Phase 9 invented `MANIFEST.json` (lines 332–364 of `audit-screenshots.mjs`) for byte-level integrity on a gitignored screenshot tree. Phase 15 commits the PNGs themselves; the commit hash IS the manifest. Do NOT introduce a manifest file here — it would be over-engineering for 6 static PNGs.

---

### Phase 15 PR body — `Closes #11, #12, #13, #17, #19` keyword block (NEW — PR-layer artifact)

**Analog:** None inside `.planning/`. GitHub's auto-close feature is the canonical mechanism per D-16.

**Pattern to apply (D-16):**

PR body MUST include literal text matching GitHub's auto-close keyword grammar:

```markdown
Closes #11
Closes #12
Closes #13
Closes #17
Closes #19
```

(Each on its own line, or comma-separated on one line. Both work. Avoid combined `Closes #11-#13` syntax — GitHub does not parse ranges.)

- The PR body is authored at PR-create time by `/gsd-ship` or the operator. NOT a file in the repo.
- Once the PR merges into `main`, GitHub automatically transitions all five issues to `closed`.

---

### Per-issue closure comment after merge (NEW — manual operator step)

**Analog:** **None**. No `gh issue close` helper exists under `scripts/` or `.planning/`. The phrase appears only in `15-VALIDATION.md` line 63 as an instruction (`gh issue close 11 12 13 17 19 --comment "<evidence link to phase artifact>"`).

**Pattern to apply (D-16):**

After merge, for each of the five issues (#11, #12, #13, #17, #19), the operator runs ONE command. Two viable forms:

- **Combined** (matches VALIDATION.md text): `gh issue close 11 12 13 17 19 --comment "Closed by Phase 15 PR — see .planning/phases/15-observability-e2e-verify-close/15-EVIDENCE.md"`
- **Per-issue** (allows distinct anchors per requirement): five separate `gh issue close N --comment "..."` invocations, each linking to the relevant Sentry event ID (OBSV-03/04/05) or CI run URL (TEST-14/15/16).

D-16 says "per-issue closure comment" → use the per-issue form so each closure comment carries the specific evidence anchor for that issue. Note that since auto-close keywords (above) already close the issues on merge, this `gh issue close` call effectively just **adds the closure comment** — the issue is already in `closed` state. The operator may prefer `gh issue comment N --body "..."` for clarity (does not attempt to re-close an already-closed issue).

- **Document this as a manual step** in EVIDENCE.md's "Closure" section, not as a script. D-15 / D-16 do not ask for a script; the operator is expected to run this once.
- **Reference anchor format** — link to the EVIDENCE.md file at a specific markdown heading anchor (e.g., `https://github.com/<owner>/<repo>/blob/main/.planning/phases/15-observability-e2e-verify-close/15-EVIDENCE.md#obsv-03`). Anchors require deterministic heading slugs — keep section headings stable.

---

## Shared Patterns

### WHY-only comments in `src/`

**Source:** `CLAUDE.md` "Comments" section + memory `feedback_no_review_archaeology_in_source`
**Apply to:** `src/routes/[__smoke].tsx`, and any extension to `src/components/debug/RenderThrowSmoke.tsx`

```typescript
// Permanent observability canary. Throws from render (not a handler) so the
// React 19 hooks + Sentry.ErrorBoundary capture path is exercised end-to-end.
// `: never` is intentional and subtypes ReactNode for JSX use.
export function RenderThrowSmoke(): never {
  throw new Error(
    'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'
  )
}
```

The existing `RenderThrowSmoke.tsx` header is the gold standard: explains WHY ("React 19 hooks + Sentry.ErrorBoundary capture path"), cites no phase/plan IDs, names no decision IDs. New code in `src/routes/[__smoke].tsx` for Phase 15 must follow the same shape.

### Comment style outside `src/`

**Source:** `.github/workflows/ci.yml` (existing) + `.planning/closure/audit-screenshots.mjs` (existing)
**Apply to:** `.github/workflows/ci.yml` MOD, `scripts/verify-sourcemap-names.mjs`, `.planning/phases/15-observability-e2e-verify-close/15-EVIDENCE.md`

```yaml
# D-07 — PR gate: lint + unit + E2E smoke against a local Supabase stack.
# D-16 §2 — npm ci only; §4 — npm audit non-blocking at HIGH.
```

```javascript
// .planning/closure/audit-screenshots.mjs — UIDN-02 + UIDN-03 screenshot matrix harness
// Phase 9 / v1.1 / Issue #18 — updated Phase 13 (D-07/D-08/D-09).
```

Outside `src/`, decision-ID citations (D-NN) are expected and helpful. Cite the relevant decision IDs from CONTEXT.md (`D-05`, `D-06`, `D-08`, `D-13`, etc.) in script headers, CI step `name:` fields, and EVIDENCE doc frontmatter.

### Failure-exit shape for Node scripts

**Source:** `.planning/closure/audit-screenshots.mjs` lines 320–328
**Apply to:** `scripts/verify-sourcemap-names.mjs`

```javascript
if (unexpectedGroups.length > 0) {
  console.error(`\n=== sha256 DUPE FAILURE: ${unexpectedGroups.length} unexpected collision group(s) ===`)
  for (const group of unexpectedGroups) {
    console.error(`  collision: ${group.join(', ')}`)
  }
  console.error('Hydration sentinel did not prevent loading-shell captures. Fix the harness before re-running. ...')
  process.exit(1)
}
console.log(`sha256 uniqueness check passed (${dupeFiles.length} PNGs, ... 0 unexpected collisions)`)
```

Pattern: structured failure heading → bulleted list of misses → actionable resolution sentence → `process.exit(1)`. Success line emits a single summary line with counts. Mirror this exact shape in `verify-sourcemap-names.mjs` so CI logs are scannable.

### CI step ordering convention

**Source:** `.github/workflows/ci.yml` `lint-and-unit` job (existing) + `e2e` job's `Build app` → `Run Playwright` ordering
**Apply to:** `.github/workflows/ci.yml` MOD for D-08

```yaml
- run: npm ci
- run: npm run lint
- run: npm test -- --run
- name: npm audit (non-blocking)
  run: npm audit --audit-level=high || true
```

```yaml
- name: Build app
  env:
    VITE_SUPABASE_URL: http://localhost:54321
    VITE_SUPABASE_ANON_KEY: ${{ steps.supabase-keys.outputs.anon_key }}
  run: npm run build
- name: Start preview server
  run: nohup npx vite preview --host 0.0.0.0 --port 4173 > preview.log 2>&1 &
```

Pattern: bare `run:` for one-liners (`npm ci`, `npm run lint`, `npm test -- --run`); `name: + run:` when the step needs a human-readable label (e.g., `Build (for sourcemap-names verify)`, `Verify sourcemap function names preserved`). Multi-line `run: |` with `for i in {1..60}` polling is reserved for waits — not needed here.

### `verbatimModuleSyntax` + `erasableSyntaxOnly`

**Source:** `tsconfig.app.json` + `src/main.tsx` line 1 (`import { StrictMode, type ErrorInfo } from 'react'`)
**Apply to:** any new TypeScript in `src/routes/[__smoke].tsx` (`.mjs` script is JavaScript — exempt)

Existing example:

```typescript
import { StrictMode, type ErrorInfo } from 'react'
```

Phase 15 code must use `import type` for type-only imports. If you add a `DedupeCheckSmoke` sibling component, type-only imports of its prop interface require the `type` keyword.

---

## No Analog Found

| File / Artifact | Role | Reason | Planner Guidance |
|-----------------|------|--------|------------------|
| Per-issue closure comment helper (`gh issue close …`) | git/PR layer (manual operator step) | No `gh issue close` script exists under `scripts/` or `.planning/`. `15-VALIDATION.md` line 63 references it as a manual instruction. | Document as a manual operator step inside EVIDENCE.md's "Closure" section. Do NOT introduce a helper script — D-15/D-16 do not call for one. Operator runs `gh issue close N --comment "..."` once per issue after merge. |

---

## Metadata

**Analog search scope:**
- `scripts/` (does not exist — no prior `.mjs` scripts at that path)
- repo-root `.mjs` files (none found via `find -maxdepth 2 -name "*.mjs"`)
- `.planning/closure/` (found `audit-screenshots.mjs` — the strongest analog for the new Node ESM script)
- `.planning/milestones/v1.1-phases/07-observability-hardening/artifacts/` (found `__name-grep.txt` — Phase 7 baseline for the allowlist contents)
- `.github/workflows/ci.yml` (read in full for `lint-and-unit` job + `e2e` job's `Build app` pattern)
- `src/routes/[__smoke].tsx` (read in full — extend in place)
- `src/components/debug/RenderThrowSmoke.tsx` (read in full — the throw component)
- `src/main.tsx` (read in full — Sentry init + `Sentry.ErrorBoundary` + React 19 hook factories)
- `vite.config.ts` (read in full — `keepNames: true` setting, line 34)
- `.planning/closure/OBSV-02-bundle-delta.md` (read first 60 lines — closure-evidence shape)
- `.planning/milestones/v1.1-phases/07-observability-hardening/07-PATTERNS.md` (read first 80 lines — prior PATTERNS.md structure reference)

**Files scanned (read or grep'd):** ~12

**Pattern extraction date:** 2026-05-17
