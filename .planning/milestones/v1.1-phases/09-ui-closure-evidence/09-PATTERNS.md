# Phase 9: UI Closure Evidence — Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 8 (5 created + 3 modified)
**Analogs found:** 6 / 8 (2 files have no analog — see § "No Analog Found")

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.planning/closure/audit-mobile.sh` | utility (audit harness) | batch / external-CLI loop | RESEARCH.md skeleton (no in-repo bash analog) + `e2e/playwright.config.ts` for env-var-driven config style | role-match (skeleton + config-style) |
| `.planning/closure/audit-screenshots.mjs` | utility (audit harness) | batch / browser automation | `e2e/tests/admin-create.spec.ts` + `e2e/playwright.config.ts` + `e2e/helpers/auth.ts` | exact (Playwright ESM + auth fixture pattern) |
| `.planning/closure/UIDN-02-mobile-evidence.md` | closure-evidence doc | request-response (audit results render) | `.planning/closure/OBSV-02-bundle-delta.md` | exact (Phase 7 closure-evidence shape) |
| `.planning/closure/UIDN-03-shadcn-audit.md` | closure-evidence doc | request-response (checklist results render) | `.planning/closure/OBSV-02-bundle-delta.md` | exact (same closure-evidence shape) |
| `.planning/closure/artifacts/lighthouse/*.{json,html}` | binary/artifact (data) | filesystem write | `.planning/phases/07-observability-hardening/artifacts/__name-grep.txt` (cross-ref convention) | role-match (artifact under phase/closure dir) |
| `.planning/closure/artifacts/screenshots/*.png` | binary/artifact (data) | filesystem write | (same as above) | role-match |
| `.planning/DESIGN-SYSTEM.md` (modify: Style line + ADR append) | doc (design-system brief) | edit-in-place | self (existing brief continues; ADR is novel — first project ADR) | partial (line edit has analog; ADR has none) |
| `.planning/PROJECT.md` (modify: Constraints line + 2 Key Decisions rows) | doc (project meta) | edit-in-place + table-cell flip | `.planning/PROJECT.md` § Key Decisions (existing rows show ⚠️ Revisit / ✓ Good convention) | exact (in-file convention) |
| `CLAUDE.md` (regenerate — auto-derived block) | doc (regenerated) | regeneration | self — `<!-- GSD:project-start source:PROJECT.md -->` block markers | exact (regenerator already exists per RESEARCH §CLAUDE.md disposition) |

---

## Pattern Assignments

### `.planning/closure/audit-mobile.sh` (utility, batch / external-CLI loop)

**Analog:** No in-repo bash script analog (`scripts/` dir does not exist; `.husky/_/husky.sh` is auto-generated husky boilerplate, not a project script). RESEARCH.md § "Code Examples" provides the canonical skeleton, vetted against Lighthouse 13.2.0 `--help`. Use the skeleton verbatim.

**Top-of-file data block pattern** (from RESEARCH.md § Pattern 1, lines 199-217):
```bash
#!/usr/bin/env bash
# .planning/closure/audit-mobile.sh — UIDN-02 Lighthouse harness
# Re-runnable: edit BASE_URL/ROUTES/THRESHOLDS below; nothing else.
set -uo pipefail   # NOT -e — we want all routes to run even if one fails

BASE_URL="https://polls.wtcsmapban.com"
ROUTES=( "/" "/topics" "/archive" "/auth/error" "/admin" )
ROUTE_NAMES=( "home" "topics" "archive" "auth-error" "admin" )
THRESHOLD_PERF=90
THRESHOLD_A11Y=95
THRESHOLD_BP=95
THRESHOLD_SEO=90
ARTIFACTS_DIR=".planning/closure/artifacts"
```

**Lighthouse invocation pattern** (from RESEARCH.md § "Code Examples" lines 437-465):
```bash
for i in "${!ROUTES[@]}"; do
  route="${ROUTES[$i]}"
  name="${ROUTE_NAMES[$i]}"
  out="$ARTIFACTS_DIR/lh-mobile-${name}"

  npx -y lighthouse@latest "${BASE_URL}${route}" \
    --form-factor=mobile \
    --throttling-method=simulate \
    --only-categories=performance,accessibility,best-practices,seo \
    --chrome-flags="--headless=new --no-sandbox" \
    --output=html --output=json \
    --output-path="$out" \
    --quiet || { fail_count=$((fail_count+1)); continue; }

  perf=$(jq -r '.categories.performance.score * 100 | floor' "${out}.report.json")
  a11y=$(jq -r '.categories.accessibility.score * 100 | floor' "${out}.report.json")
  bp=$(jq -r '."categories"."best-practices".score * 100 | floor' "${out}.report.json")
  seo=$(jq -r '.categories.seo.score * 100 | floor' "${out}.report.json")
  # ... threshold check + accumulate ...
done
```

**Error-handling pattern:** `set -uo pipefail` (NOT `-e`) so all 5 routes run; collect failures; non-zero exit at end if any threshold missed. Documented PCT 1 in RESEARCH (Lighthouse score variance — D-14 ship-anyway analog applies).

---

### `.planning/closure/audit-screenshots.mjs` (utility, batch / browser automation)

**Analog 1 (browser automation + auth):** `e2e/tests/admin-create.spec.ts` + `e2e/helpers/auth.ts`
**Analog 2 (Playwright config / launch options):** `e2e/playwright.config.ts`

**Imports + browser launch pattern** (from RESEARCH.md § "Code Examples" lines 484-507; Playwright ESM idiom matching @playwright/test 1.59.1 in devDeps):
```javascript
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE_URL = 'https://polls.wtcsmapban.com'
const LOCAL_URL = 'http://localhost:4173'   // for auth pass (Vite preview port — matches e2e/playwright.config.ts default; RESEARCH Open Q #3 RESOLUTION)
const BREAKPOINTS = [320, 375, 414, 768, 1024, 1440]
const UNAUTH_ROUTES = [
  { path: '/',           name: 'home' },
  { path: '/topics',     name: 'topics' },
  { path: '/archive',    name: 'archive' },
  { path: '/auth/error', name: 'auth-error' },
  { path: '/admin',      name: 'admin' },
]
const AUTH_ROUTES = [
  { path: '/admin/suggestions/new',                                                  name: 'admin-suggestions-new' },
  // Fixture UUID per RESEARCH Open Q #1 RESOLUTION (e2e/fixtures/seed.sql:120-140 — [E2E SMOKE] poll).
  { path: '/admin/suggestions/d0000000-0000-0000-0000-000000000001/edit',            name: 'admin-suggestions-id-edit' },
]
const ARTIFACTS_DIR = '.planning/closure/artifacts'

await mkdir(ARTIFACTS_DIR, { recursive: true })
const browser = await chromium.launch({ headless: true })
```

**Resize-then-navigate pattern** (from RESEARCH.md § Pitfall 4 lines 355-365 — order matters: setViewportSize THEN goto):
```javascript
for (const width of BREAKPOINTS) {
  await page.setViewportSize({ width, height: 800 })
  for (const route of UNAUTH_ROUTES) {
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' })
    await page.screenshot({
      path: `${ARTIFACTS_DIR}/bp-${width}-${route.name}.png`,
      fullPage: true,
    })
  }
}
```

**Auth-pass pattern (Phase 8 fixture reuse, Option A: local-build).** Mirror `e2e/helpers/auth.ts` `loginAs` shape — mint a session via `signInWithPassword` against local Supabase, inject into `localStorage` via `page.addInitScript` BEFORE any `goto`. Critical excerpt from `e2e/helpers/auth.ts:71-114`:
```typescript
export async function loginAs(page: Page, fixtureUserId: string): Promise<void> {
  // ...resolve fixture user...
  const anonKey = getAnonKey()
  const client = createClient(SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: FIXTURE_PASSWORD,
  })
  if (error || !data.session) throw error ?? new Error(...)
  const payload = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    expires_at: data.session.expires_at,
    token_type: data.session.token_type,
    user: data.session.user,
  }
  await page.addInitScript(
    ([key, value]) => { window.localStorage.setItem(key, value) },
    [STORAGE_KEY, JSON.stringify(payload)] as [string, string],
  )
}
```

**Storage-key derivation** (from `e2e/helpers/auth.ts:26-29` — must reproduce in `.mjs` since the `.ts` helper is e2e-scoped):
```typescript
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321'
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0] || 'localhost'
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`
```

**Critical sequencing rule** (from `e2e/helpers/auth.ts:53-66` — IMPORTANT/LO-03 callout):
> Callers MUST `await` `loginAs` BEFORE any `page.goto(...)` / `page.navigate(...)`. `page.addInitScript` only runs on page contexts created AFTER it is registered.

**Local-server probe pattern** (from RESEARCH.md § Pitfall 5 lines 379-389):
```javascript
try {
  await fetch(LOCAL_URL, { signal: AbortSignal.timeout(2000) })
} catch {
  throw new Error(
    `Local dev server not reachable at ${LOCAL_URL}. ` +
    `Start it with \`npm run preview\` before running the auth screenshot pass.`
  )
}
```

**Fixture spec call-shape reference** (`e2e/tests/admin-create.spec.ts:24-31`) — shows the established `loginAs(page, fixtureUsers.adminUser.id)` → `await page.goto(...)` ordering the screenshot script must mirror:
```typescript
test('[@smoke] admin creates suggestion and it appears for users', async ({ page }) => {
  await loginAs(page, fixtureUsers.adminUser.id)
  await page.goto('/admin')
  await page.getByTestId('admin-create-suggestion').click()
  // ...
})
```

---

### `.planning/closure/UIDN-02-mobile-evidence.md` (closure-evidence, request-response)

**Analog:** `.planning/closure/OBSV-02-bundle-delta.md`

**Frontmatter pattern** (lines 1-11):
```markdown
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
For UIDN-02: `requirement: UIDN-02`, `audited: 2026-05-DD`, `targets: P>=90/A11y>=95/BP>=95/SEO>=90`, `phase: 09-ui-closure-evidence`, plus `audit_url: https://polls.wtcsmapban.com`.

**Title + context paragraph pattern** (lines 13-15):
```markdown
# OBSV-02 Bundle Delta — Rolldown `keepNames` cost

Rolldown's `build.rolldownOptions.output.keepNames: true` (Phase 7 OBSV-02 fix) preserves [...]. This doc records the measured bundle-size cost of that flag.
```

**Method section pattern** (lines 17-29) — describes the run, cites the CLI command + flags + pitfalls hit:
```markdown
## Method

3-way same-session build comparison via `git worktree` (RESEARCH Pitfall 6 — eliminates baseline drift; Round-2 MEDIUM-3 — clean per-flag attribution):

| Worktree | SHA | vite.config.ts | ... | Purpose |
|----------|-----|----------------|-----|---------|
| ...      | ... | ...            | ... | ...     |

All three worktrees built in the same shell session with `SENTRY_AUTH_TOKEN= npm run build` [...]
```
For UIDN-02: describe the Lighthouse 13.2.0 + Playwright 1.59.1 runs, the route set, the `--form-factor=mobile` invocation, the 6-width screenshot matrix, and the local-build vs prod split for auth screenshots.

**Results-table pattern** (lines 33-45 — the dominant section; one summary table + one drill-down table):
```markdown
## Total gzip table

| Build | Chunks | Raw kB | Gzip kB | Δ vs main | Δ vs main (%) |
|-------|--------|--------|---------|-----------|---------------|
| W1 — main baseline | 31 | 1117.33 | **362.20** | (baseline) | (baseline) |
[...]

**Two deltas:** [...callout sentences...]
```
For UIDN-02: replace with `## Lighthouse mobile scores` table (5 rows × Perf/A11y/BP/SEO columns) + `## Breakpoint matrix` table (6 widths × 7 routes referencing PNG paths).

**Cross-references pattern** (lines 96-103):
```markdown
## Cross-references

- **`07-VERIFICATION.md`** — `## Required Artifacts` row pointing here as the OBSV-02 closure record [...]
- **`07-CONTEXT.md` D-11..D-14** — the Implementation Decisions block that mandated this dedicated closure doc [...]
```
For UIDN-02: link to `09-CONTEXT.md` D-03..D-06, `audit-mobile.sh`, `audit-screenshots.mjs`, ROADMAP § Phase 9.

**Sign-off footer pattern** (lines 137-141 — italicized 3-line block):
```markdown
---
_Measured: 2026-04-30T09:48:00Z_
_Method: 3-way same-session git-worktree comparison; gzip values from Vite's printed per-chunk column [...]_
_Disposition: SHIP with keepNames enabled — D-14 ship-anyway policy applied; observability gain accepted_
```
RESEARCH.md § "Sign-off line template" proposes a bold-label `## Sign-off` form as an alternative — planner picks. Either form is established.

---

### `.planning/closure/UIDN-03-shadcn-audit.md` (closure-evidence, request-response)

**Analog:** `.planning/closure/OBSV-02-bundle-delta.md` (same shape as UIDN-02)

Reuse all sections above (frontmatter, title, context, method, results-tables, cross-references, sign-off). Differences from UIDN-02:

- **Frontmatter:** `requirement: UIDN-03`, plus `blocked_on: UIDN-04` (cited in research as a hard sequence requirement).
- **Method line:** "12-item per-route shadcn-consistency checklist (new-york preset, Neutral baseColor) across 5 unauth + 2 auth `/admin/*` routes; ripgrep confirms zero raw-color drift in `src/`."
- **Results table:** 12-item × 7-route matrix (84 cells; PASS/FAIL/N/A + one-line note per cell). The 12 items are enumerated in RESEARCH.md § "12-item shadcn checklist (UIDN-03, re-keyed to new-york)".
- **Drift-findings sub-section** (RESEARCH lines 717-723):
  ```markdown
  ## 3. Drift findings + fixes
  - src/components/Navbar.tsx:42 — `bg-gray-100` → `bg-muted` (item 3)
  - src/components/admin/SuggestionForm.tsx:88 — `p-[13px]` → `p-3` (item 7)
  - ... or: <none — all 84 cells PASS>
  ```
- **Sign-off:** flips `shadcn/ui + Tailwind CSS v4 (Maia/Neutral)` row in PROJECT.md Key Decisions; cites UIDN-04 ADR (DESIGN-SYSTEM.md ADR-001) for canonical preset.

---

### `.planning/PROJECT.md` (modify: Constraints line + Key Decisions rows)

**Analog:** self — existing convention in same file.

**Constraints line flip** (line 170 — current text):
```markdown
- **Design system**: shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font
```
New text (from RESEARCH.md § "UIDN-04 Reconciliation Surfaces" line 587):
```markdown
- **Design system**: shadcn/ui new-york style, Neutral baseColor, Inter font
```

**Key Decisions table flip pattern** (line 184 + 194 — current text):
```markdown
| shadcn/ui + Tailwind CSS v4 (Maia/Neutral) | Component library for consistent rapid UI development | ⚠️ Revisit (UIDN-03 closure evidence pending — issue #18) |
[...]
| Mobile-first responsive design | Discord users tap links from phones | ⚠️ Revisit (UIDN-02 closure evidence pending — issue #18) |
```

Existing in-file convention for the "✓ Good" outcome (line 176, 178, 181, etc.):
```markdown
| Discord-native admin model | Self-contained, no cross-app sync complexity | ✓ Good (v1.0) |
```

After Phase 9 closes:
```markdown
| shadcn/ui + Tailwind CSS v4 (new-york/Neutral) | Component library for consistent rapid UI development | ✓ Good (v1.1 — UIDN-03 closure evidence; ADR-001 canonicalizes new-york) |
| Mobile-first responsive design | Discord users tap links from phones | ✓ Good (v1.1 — UIDN-02 closure evidence) |
```

**Atomic-per-row vs phase-end flip:** RESEARCH.md § Pitfall 7 sub-options A/B — recommendation is sub-option A (atomic-per-row, matching Phase 7 OBSV-02 precedent).

---

### `CLAUDE.md` (regenerate — auto-derived block)

**Analog:** self — the file already declares its source-of-truth via HTML-comment markers.

**Marker pattern** (lines 1-22):
```markdown
<!-- GSD:project-start source:PROJECT.md -->
## Project
[...content auto-derived from .planning/PROJECT.md § Constraints / "What This Is" sections...]
- **Design system**: shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
[...]
```

**Regeneration command** (per RESEARCH.md § "CLAUDE.md disposition" lines 605-619 — verified via gsd-tools.cjs source):
```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs generate-claude-md
```
or invoke via the equivalent `/gsd-*` slash command. After regen, line 21's "Maia → new-york" follows from PROJECT.md's flip. Do NOT hand-edit CLAUDE.md — regen will overwrite.

---

## Shared Patterns

### Closure-evidence directory + artifacts convention

**Source:** `.planning/closure/OBSV-02-bundle-delta.md` + `.planning/closure/artifacts/` (Phase 7 precedent).
**Apply to:** Both new `.md` evidence files + the `audit-mobile.sh` `ARTIFACTS_DIR` constant + `audit-screenshots.mjs` `ARTIFACTS_DIR` constant.
```
.planning/closure/<REQ-ID>-<topic>.md
.planning/closure/artifacts/<artifact-name>.<ext>
```
Both audit scripts MUST set `ARTIFACTS_DIR=".planning/closure/artifacts"` (or the project sub-organized `.planning/closure/artifacts/lighthouse/` and `.../screenshots/` per the file list — planner picks; RESEARCH.md leaves the sub-dir split unconstrained).

### Top-of-file data block (re-runnability)

**Source:** RESEARCH.md § Pattern 1 (lines 195-242) — researcher-defined; no in-repo prior.
**Apply to:** Both `audit-mobile.sh` and `audit-screenshots.mjs`.

Constraint: NO CLI flag parsing, NO env-var pivots, NO yargs/commander dep. One source of truth at the top of each script: `BASE_URL`, `ROUTES`, `BREAKPOINTS`, `THRESHOLD_*`, `ARTIFACTS_DIR`. Re-runnability comes from "edit lines 5-15, re-run" — not from a CLI surface.

### Frontmatter on closure-evidence files

**Source:** `.planning/closure/OBSV-02-bundle-delta.md` lines 1-11.
**Apply to:** Both UIDN-02 and UIDN-03 evidence files.

YAML frontmatter block with `requirement:` ID, dated `measured:` / `audited:` field, target/actual values where measurable, `status:` line, `phase:` and `plan:` references, and SHA references where measurement was tied to a specific commit.

### Sign-off footer flips PROJECT.md Key Decisions

**Source:** `.planning/closure/OBSV-02-bundle-delta.md` lines 137-141 (italicized 3-line block).
**Alternative:** RESEARCH.md § "Sign-off line template" lines 675-691 (bold-label `## Sign-off` block).
**Apply to:** Both UIDN-02 and UIDN-03 evidence files.

The sign-off line is the contractual hook — the closure file's existence + a dated sign-off line is what permits the PROJECT.md Key Decisions row to flip ⚠️ Revisit → ✓ Good. Atomic commit (file land + row flip) per Phase 7 precedent.

### `.planning/`-scope comment policy

**Source:** project rule (CLAUDE.md auto-memory: "No review-round archaeology in source comments — source comments WHY-only, never cite plan/round/phase IDs").
**Apply to:** Script files under `.planning/closure/`.

Phase 9 touches no `src/` code. The script files at `.planning/closure/*.{sh,mjs}` are runbook-style — they MAY include phase / round / plan references in comments because they live under `.planning/`, not `src/`. The boundary is the directory (CONTEXT.md `<code_context>` § "Established Patterns" reaffirms).

### No `package.json` script wiring

**Source:** `package.json` (existing scripts: `dev`, `e2e`, `generate`, `build`, `lint`, `preview`, `test`, `test:watch`, `test:coverage`, `prepare` — NONE reference closure or audit harnesses) + Phase 7/8 precedent + D-04.
**Apply to:** `audit-mobile.sh` and `audit-screenshots.mjs`.

Scripts run as `bash .planning/closure/audit-mobile.sh` and `node .planning/closure/audit-screenshots.mjs` directly. Do NOT add `"audit:mobile"` or `"audit:screenshots"` to `package.json` — D-04 explicit forbid; milestone artifact, not permanent build target.

### Playwright env-var-driven baseURL pattern

**Source:** `e2e/playwright.config.ts:28` — `baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'`.
**Apply to:** `audit-screenshots.mjs` for the prod-vs-local switch.

The pattern is "env-var with literal default constant" — no `.env` file, no config object. `audit-screenshots.mjs` should hardcode `BASE_URL` (production) and `LOCAL_URL` (`http://localhost:5173` for `npm run dev` or `:4173` for `npm run preview`) as constants at top of file. Planner picks `dev` vs `preview` per RESEARCH § Open Question #3 (recommendation: `preview`, port 4173, matches Playwright config default).

---

## No Analog Found

Files with no close match in the codebase. Planner uses RESEARCH.md patterns instead.

| File / change | Role | Reason |
|---------------|------|--------|
| `.planning/DESIGN-SYSTEM.md` ADR-001 append | doc / ADR | First ADR in the project. RESEARCH.md § "ADR template" (lines 622-660) proposes the minimal 5-section MADR-style shape (Context / Decision / Reasoning / Consequences / metadata). No prior project ADR convention exists. |
| `.planning/closure/audit-mobile.sh` | utility | No prior project bash script (`scripts/` dir absent; `.husky/_/husky.sh` is auto-generated husky internal). RESEARCH.md provides the canonical skeleton against verified Lighthouse 13.2.0 CLI. |

For both: copy from RESEARCH.md skeletons rather than invent. The skeletons are `[VERIFIED]` against the actual Lighthouse 13.2.0 + Playwright 1.59.1 invocation surfaces (per RESEARCH.md § "Standard Stack" verification log, 2026-05-04).

---

## Metadata

**Analog search scope:** `.planning/closure/`, `e2e/`, `scripts/` (absent), `package.json` scripts, `.husky/`, `.planning/PROJECT.md`, `.planning/DESIGN-SYSTEM.md`, `CLAUDE.md`.
**Files scanned:** 9 (all read-once; no re-reads).
**Pattern extraction date:** 2026-05-04
**Skill loads:** No `.claude/skills/` or `.agents/skills/` directory present in repo (verified via the project `Project Skills` line in CLAUDE.md: "No project skills found").
