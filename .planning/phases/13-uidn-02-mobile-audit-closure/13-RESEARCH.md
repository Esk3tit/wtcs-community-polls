# Phase 13: UIDN-02 Mobile Audit Closure - Research

**Researched:** 2026-05-13
**Domain:** Playwright screenshot harness, Lighthouse CLI audit, closure-evidence file management
**Confidence:** HIGH — all findings verified against live codebase, actual harness code, MANIFEST.json, and running tools

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area 1 — Hydration-wait strength**
- D-01: Strengthen the PR #24 hydration-wait fix with a deterministic sentinel (vs trust-as-is or hard-replace).
- D-02: Wait on an existing always-rendered shell element. Zero `src/` edits — sentinel selector lives only in the harness.
- D-03: Sentinel selector = `[aria-label="Toggle color theme"]` — the theme-toggle Button at `Navbar.tsx:76`. Unconditionally rendered on every route (outside the `{user ? ... : ...}` ternary).
- D-04: Soft 10s timeout, keep `.catch` (vs hard fail on miss, vs PR #24's 5s).
- D-05: Hard-fail sha256 uniqueness check across all 42 PNGs. After the screenshot run, group PNGs by sha256; if any 2+ share a hash, log the offending paths and exit non-zero.
- D-06: Apply the sentinel + dupe-check uniformly to BOTH Pass-A and Pass-B.

**Area 2 — Auth pass for /topics + /archive**
- D-07: Extend Pass-B to 4 sub-routes (reuses existing `signInWithPassword` + `addInitScript` infrastructure).
- D-08: Use TWO Playwright contexts inside Pass-B — `adminUser` for `/admin/suggestions/*`, `memberUser` for `/topics` + `/archive`.
- D-09: Drop unauth `/topics` + `/archive` from Pass-A. Pass-A becomes 3 routes × 6 = 18 PNGs. Pass-B becomes 4 × 6 = 24 PNGs. Total stays 42.
- D-10: Plain naming `bp-{w}-topics.png` / `bp-{w}-archive.png` (no `auth-` prefix).

**Area 3 — Variance disposition**
- D-11: Strict Performance ≥ 90 floor — no D-14 ship-anyway analog.
- D-12: Follow-up trigger if defer = "next perf-budget change lands."
- D-13: Single-run audit policy honored (Phase 9 Pitfall 1).
- D-14: Follow-up trigger lives in BOTH the evidence file Sign-off AND the REQUIREMENTS.md UIDN-02 active row.

**Area 4 — Evidence file shape**
- D-15: Append `## v1.2 Rerun (2026-05-XX)` section to existing `.planning/closure/UIDN-02-mobile-evidence.md`.
- D-16: Frontmatter `status` = `complete-v1.2` (pass) / `deferred-v1.2` (miss).
- D-17: PROJECT.md Key Decisions row update wording mirrors Phase 9 convention with v1.2 tag.
- D-18: v1.2 section adds only NEW cross-refs (Phase 13 CONTEXT/PLAN, harness diff, Phase 12 prod commit `de15e33`).

### Claude's Discretion
- Exact harness diff line count and code style for sentinel + dupe-check insertions.
- Commit/PR shape (single atomic commit vs WAVE-1 + WAVE-2) — Phase 9 Path-3 pattern says atomic.
- MANIFEST.json prune logic verification for dropped Pass-A `/topics` + `/archive` entries.
- Pass-B context cleanup ordering (admin context closes after `/admin/*` loop, member context closes after `/topics + /archive` loop).
- Sign-off paragraph wording in italics-form (matches Phase 9 + OBSV-02 convention).

### Deferred Ideas (OUT OF SCOPE)
- PERF-FOLLOWUP-01 first-class requirement row
- Multi-run Lighthouse averaging / two-run sanity check
- D-14 ship-anywhere analog re-application
- `data-app-ready` attribute via main.tsx useEffect
- Auth-`/admin` Lighthouse audit against prod
- `auth-` filename prefix for auth captures
- New file UIDN-02-mobile-evidence-v1.2.md
- Cross-ref appendix refactor
- CI integration of the dupe check / closure harness
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UIDN-02 | Mobile-first responsive design closure evidence — Lighthouse mobile audit + authenticated 6-width breakpoint matrix archived in `.planning/closure/UIDN-02-mobile-evidence.md` (v1.2 rerun section); flip `Mobile-first responsive design` Key Decision row ⚠️ → ✓ if Perf 5/5 ≥ 90. | Harness sentinel fix (D-01..D-06), two-context auth extension (D-07..D-10), Lighthouse rerun (D-11..D-13), evidence file append (D-15..D-18), PROJECT.md + REQUIREMENTS.md row updates. |
</phase_requirements>

---

## Summary

Phase 13 is a harness-fix + audit-rerun + evidence-file-append phase with zero `src/` edits. The work falls into four sequential stages: (1) modify `audit-screenshots.mjs` to replace the fragile `body.filter({hasText})` hydration-wait with a deterministic `[aria-label="Toggle color theme"]` sentinel, add a member-user second context for `/topics` + `/archive` in Pass-B, drop the by-design duplicate `/topics` + `/archive` unauth routes from Pass-A, and add a sha256 dupe-check that exits non-zero on collision; (2) run the fixed harness to produce clean 42-PNG corpus; (3) run `audit-mobile.sh` unchanged against `https://polls.wtcsmapban.com` for the 5-route Lighthouse scores; (4) append the `## v1.2 Rerun` section to the evidence file, update frontmatter, and flip the PROJECT.md + REQUIREMENTS.md rows per the strict ≥ 90 threshold.

The v1.1 MANIFEST.json confirms the Phase 9 defect is real and significant: all 6 width-breakpoints produce 4-way sha256 collisions across `/`, `/topics`, `/archive`, `/admin` unauth PNGs (24 of 30 unauth PNGs are byte-identical loading shells). The dupe check as designed would correctly detect and fail on this exact pattern. The sentinel fix (10s soft timeout on a stable post-hydration Navbar element) eliminates the root cause — the PR #24 5s text-filter arrived before React hydration on prod's cold Netlify CDN edge.

The Playwright and Lighthouse toolchains are both confirmed available in the project environment. The proof of concept for the two-context Pass-B pattern is directly derived from the existing single-context Pass-B block (lines 100-180 of `audit-screenshots.mjs`) — the second context for memberUser is structurally identical, using the same `signInWithPassword` + `addInitScript` + goto + waitFor pattern with a different fixture user and different route set.

**Primary recommendation:** Single atomic commit following Phase 9 Path-3 pattern — harness fix + clean rerun output (MANIFEST.json update) + evidence append + PROJECT.md row + REQUIREMENTS.md rows all land together in one PR. A WAVE split is justified only if the harness fix needs an intermediate verified-green state before the rerun artifacts are captured.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Screenshot harness execution | `.planning/closure/` script | None | Closure harness lives outside `src/`; no app tier involved |
| Hydration sentinel verification | Browser (Playwright-driven) | — | The sentinel (`[aria-label="Toggle color theme"]`) is a DOM element verified by the Playwright client process |
| sha256 dupe detection | Node.js script (harness) | — | In-process filesystem read + crypto; no server or DB involved |
| Lighthouse mobile audit | Lighthouse CLI (external tool) | prod CDN | Runs against live prod; measures real-world mobile perf delivered by Netlify CDN |
| Auth fixture injection | Playwright context (Pass-B) | local Supabase | `signInWithPassword` against local Supabase; `addInitScript` injects token into browser localStorage |
| Evidence file append | Filesystem (planning artifact) | — | Markdown file edit in `.planning/closure/`; no src/ involvement |
| PROJECT.md / REQUIREMENTS.md row update | Filesystem (planning artifact) | — | Single-row text edits in `.planning/` docs |

---

## Standard Stack

### Core (verified against live project)
| Tool | Version | Purpose | Source |
|------|---------|---------|--------|
| `@playwright/test` | 1.59.1 | Screenshot harness runtime (chromium), `browser.newContext()`, `page.addInitScript()`, `page.locator().waitFor()` | [VERIFIED: `node_modules/@playwright/test/package.json`] |
| `lighthouse` | 13.2.0 | Lighthouse mobile audit; invoked via `npx -y lighthouse@13.2.0` in `audit-mobile.sh` | [VERIFIED: `npx -y lighthouse@13.2.0 --version` → `13.2.0`] |
| `node:crypto` `createHash` | Node.js built-in | sha256 computation for dupe-check and MANIFEST upsert | [VERIFIED: `node -e "require('node:crypto').createHash('sha256')"` → ok] |
| `node:fs/promises` `readdir`, `readFile`, `writeFile`, `stat`, `mkdir`, `rm` | Node.js built-in | Filesystem operations already in use throughout harness | [VERIFIED: harness imports at lines 22-23] |
| `@supabase/supabase-js` | 2.101.1 | `createClient` + `signInWithPassword` for fixture session minting in Pass-B | [VERIFIED: already used in harness line 123; `package.json`] |
| `jq` | 1.7.1 | JSON score extraction from Lighthouse JSON reports in `audit-mobile.sh` | [VERIFIED: `jq --version` → `jq-1.7.1-apple`] |
| `shasum` | 6.02 | sha256 checksum in `audit-mobile.sh` MANIFEST upsert | [VERIFIED: `shasum --version` → `6.02`] |
| Node.js | v24.14.0 | Runtime for `audit-screenshots.mjs` (ESM top-level await) | [VERIFIED: `node --version` → `v24.14.0`] |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `npm run build && npm run preview` | Builds and serves local preview on port 4173 for Pass-B | Required before running `audit-screenshots.mjs` |
| `supabase start` | Starts local Supabase at `http://localhost:54321` for Pass-B fixture auth | Required before Pass-B; provides `VITE_SUPABASE_ANON_KEY` |

---

## Architecture Patterns

### System Architecture Diagram

```
operator shell
    │
    ├─ [Step 1] node .planning/closure/audit-screenshots.mjs
    │     │
    │     ├─ Pass A: chromium context (unauth)
    │     │    ├─ prod CDN (polls.wtcsmapban.com)
    │     │    │    routes: / , /auth/error , /admin (unauth redirect)
    │     │    ├─ waitForLoadState('networkidle')
    │     │    ├─ page.locator('[aria-label="Toggle color theme"]').waitFor({timeout:10000}).catch()  ← NEW sentinel
    │     │    └─ screenshot → ARTIFACTS_DIR/bp-{w}-{name}.png
    │     │
    │     ├─ Pass B (admin context): chromium context (adminUser)
    │     │    ├─ local preview :4173
    │     │    │    routes: /admin/suggestions/new , /admin/suggestions/:id/edit
    │     │    ├─ signInWithPassword(adminUser) → addInitScript(STORAGE_KEY)
    │     │    ├─ page.locator('[aria-label="Toggle color theme"]').waitFor({timeout:10000}).catch()  ← NEW sentinel
    │     │    └─ screenshot → ARTIFACTS_DIR/bp-{w}-{name}.png
    │     │
    │     ├─ Pass B (member context): chromium context (memberUser)  ← NEW
    │     │    ├─ local preview :4173
    │     │    │    routes: /topics , /archive
    │     │    ├─ signInWithPassword(memberUser) → addInitScript(STORAGE_KEY)
    │     │    ├─ page.locator('[aria-label="Toggle color theme"]').waitFor({timeout:10000}).catch()  ← NEW sentinel
    │     │    └─ screenshot → ARTIFACTS_DIR/bp-{w}-{name}.png
    │     │
    │     ├─ sha256 dupe-check (NEW — BEFORE MANIFEST write)
    │     │    ├─ readdir ARTIFACTS_DIR → all .png
    │     │    ├─ createHash('sha256') per file → Map<sha256, paths[]>
    │     │    ├─ find groups with length > 1
    │     │    └─ if dupes: log paths + process.exit(1)
    │     │
    │     └─ MANIFEST.json upsert (existing, unchanged)
    │          └─ prune stale screenshot rows + upsert current PNGs
    │
    └─ [Step 2] bash .planning/closure/audit-mobile.sh  (UNCHANGED)
          ├─ npx lighthouse@13.2.0 × 5 routes → prod CDN
          ├─ jq score extraction → pass/fail per route
          ├─ MANIFEST.json upsert (lighthouse entries)
          └─ exit 1 if any threshold missed
```

### Recommended File Layout (changes only)

```
.planning/closure/
├── audit-screenshots.mjs      # Modified: sentinel, 2nd context, dupe-check
├── audit-mobile.sh            # UNCHANGED
├── UIDN-02-mobile-evidence.md # Append ## v1.2 Rerun section + frontmatter update
└── artifacts/
    ├── MANIFEST.json           # Re-upserted after clean rerun
    └── screenshots/            # 42 new PNGs (gitignored)
.planning/
├── PROJECT.md                 # Single row edit (line 211)
└── REQUIREMENTS.md            # UIDN-02 row + Phase Traceability row edits
```

### Pattern 1: Sentinel Replacement (Lines 80 and 161)

**What:** Replace the PR #24 `body.filter` waitFor with a deterministic sentinel targeting the Navbar theme-toggle button, which is unconditionally rendered on every route.

**When to use:** Both Pass-A (before every `page.screenshot()` in the unauth loop) and Pass-B (before every `page.screenshot()` in both auth context loops).

**Existing code to replace (line 80 and line 161):**
```javascript
// CURRENT (PR #24 — fragile text-filter):
await page.locator('body').filter({ hasText: route.mustSee }).first().waitFor({ timeout: 5000 }).catch(() => {})
```

**Replacement:**
```javascript
// REPLACEMENT — deterministic Navbar sentinel (D-03 / D-04)
// Phase 13: replaced fragile body-text filter with stable post-hydration marker.
// Navbar.tsx:76 renders this button unconditionally (outside the auth ternary).
await page.locator('[aria-label="Toggle color theme"]').waitFor({ timeout: 10000 }).catch(() => {})
```

Source: `[VERIFIED: src/components/layout/Navbar.tsx:76]` — `aria-label="Toggle color theme"` confirmed at line 76, sits inside the `<div className="flex items-center gap-2">` block at line 72, which is BEFORE the `{user ? ... : ...}` ternary block that begins at line 98.

### Pattern 2: Two-Context Pass-B (NEW member context)

**What:** After the existing admin context (lines 143-179), add a parallel second Playwright context using memberUser credentials to capture authenticated `/topics` and `/archive`.

**When to use:** Immediately after `await context.close()` at line 179 (closing admin context), before `await browser.close()` at line 182.

**Pattern (mirrors existing admin context block):**
```javascript
// Pass B (member context) — /topics + /archive with memberUser session
// Phase 13 D-08: separate context captures real voter UI (no Admin link).
{
  const MEMBER_FIXTURE = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'playwright-user-member@test.local',
  }
  const MEMBER_ROUTES = [
    { path: '/topics',  expectedPath: '/topics',  name: 'topics',  mustSee: /topics|polls|suggestions/i },
    { path: '/archive', expectedPath: '/archive', name: 'archive', mustSee: /archive|past|closed/i },
  ]

  const { data: memberData, error: memberError } = await supabase.auth.signInWithPassword({
    email: MEMBER_FIXTURE.email,
    password: FIXTURE_PASSWORD,
  })
  if (memberError || !memberData.session) {
    throw memberError ?? new Error(`signInWithPassword returned no session for ${MEMBER_FIXTURE.email}`)
  }

  const memberPayload = {
    access_token: memberData.session.access_token,
    refresh_token: memberData.session.refresh_token,
    expires_in: memberData.session.expires_in,
    expires_at: memberData.session.expires_at,
    token_type: memberData.session.token_type,
    user: memberData.session.user,
  }

  const memberContext = await browser.newContext()
  const memberPage = await memberContext.newPage()
  // LO-03 sequencing: addInitScript BEFORE any goto.
  await memberPage.addInitScript(
    ([key, value]) => { window.localStorage.setItem(key, value) },
    [STORAGE_KEY, JSON.stringify(memberPayload)],
  )

  for (const width of BREAKPOINTS) {
    await memberPage.setViewportSize({ width, height: 800 })
    for (const route of MEMBER_ROUTES) {
      const url = `${LOCAL_URL}${route.path}`
      console.log(`[auth:member] ${width}px ${url}`)
      await memberPage.goto(url, { waitUntil: 'networkidle' })
      await memberPage.locator('[aria-label="Toggle color theme"]').waitFor({ timeout: 10000 }).catch(() => {})
      await memberPage.screenshot({
        path: `${ARTIFACTS_DIR}/bp-${width}-${route.name}.png`,
        fullPage: true,
      })
      // F6 — DOM + path assertion (warning-only).
      const bodyText = await memberPage.locator('body').innerText().catch(() => '')
      const finalPath = new URL(memberPage.url()).pathname
      const matchesBody = route.mustSee instanceof RegExp ? route.mustSee.test(bodyText) : bodyText.includes(route.mustSee)
      const ok = finalPath === route.expectedPath && matchesBody
      if (!ok) {
        console.warn(`[auth:member] WARN bp-${width}-${route.name}: final=${finalPath} expected=${route.expectedPath} bodyMatch=${matchesBody}`)
        warnings.push(`bp-${width}-${route.name}: final=${finalPath} expected=${route.expectedPath} bodyMatch=${matchesBody}`)
      }
    }
  }
  await memberContext.close()
}
```

Source: `[VERIFIED: .planning/closure/audit-screenshots.mjs:122-179]` — admin context is the structural template; member context is an identical shape with different fixture and routes.

**Key distinction for `mustSee`:** In Pass-B, member routes land at their actual path (auth honored), so `expectedPath: '/topics'` and `expectedPath: '/archive'` are correct — NOT the `'/'` redirect that unauth visitors get.

### Pattern 3: sha256 Dupe-Check Block (NEW — before MANIFEST upsert)

**What:** After all screenshots are captured and before the MANIFEST upsert block (current line 195), add a ~15-line sha256 uniqueness check that exits non-zero on any hash collision.

**When to use:** After `browser.close()` and the warning summary, before the MANIFEST upsert block that starts at current line 198.

**Pattern:**
```javascript
// D-05 — sha256 uniqueness gate (hard fail on loading-shell dupes).
// Phase 9 defect: 24/30 unauth-prod PNGs were byte-identical loading shells.
// This check catches that signature deterministically. Exit non-zero BEFORE
// writing the MANIFEST so a known-bad run does not record a clean manifest.
{
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
  const collisions = [...shaToFiles.values()].filter((paths) => paths.length > 1)
  if (collisions.length > 0) {
    console.error(`\n=== sha256 DUPE FAILURE: ${collisions.length} collision group(s) ===`)
    for (const group of collisions) {
      console.error(`  collision: ${group.join(', ')}`)
    }
    console.error('Hydration sentinel did not prevent loading-shell captures. Fix the harness before re-running.')
    process.exit(1)
  }
  console.log(`sha256 uniqueness check passed (${dupeFiles.length} PNGs, 0 collisions)`)
}
```

Source: `[VERIFIED: MANIFEST.json analysis — 6 dupe sha256 groups confirmed in v1.1 corpus, matching Phase 9 defect description]`

**Note on MANIFEST write on dupe-fail (Claude's Discretion):** Per CONTEXT.md line 140, the check exits non-zero BEFORE the MANIFEST write. The pattern above implements this. The planner may choose to write the MANIFEST anyway for forensics — this is a discretionary call.

### Pattern 4: Pass-A UNAUTH_ROUTES Array Reduction (D-09)

**What:** Remove the two entries for `/topics` and `/archive` from `UNAUTH_ROUTES`.

**Existing array (lines 28-40):** 5 entries. Remove the `/topics` and `/archive` rows.

**Result (3-entry array):**
```javascript
const UNAUTH_ROUTES = [
  { path: '/',           expectedPath: '/',           name: 'home',       mustSee: /WTCS|community|polls|suggestions/i },
  { path: '/auth/error', expectedPath: '/auth/error', name: 'auth-error', mustSee: /sign in|login|error|auth/i },
  { path: '/admin',      expectedPath: '/',           name: 'admin',      mustSee: /sign in|login|discord/i },
]
```

**Rationale for removal:** Unauth `/topics` and `/archive` redirect to `/` via AuthGuard, producing PNGs byte-identical to `/` by design. These would false-positive the new sha256 dupe-check. `[VERIFIED: UIDN-02-mobile-evidence.md § F6 warnings]` — v1.1 evidence file documents this exact behavior.

### Pattern 5: Total Count Log Line Update (Line 183)

**What:** The total count log `const total = BREAKPOINTS.length * (UNAUTH_ROUTES.length + AUTH_ROUTES.length)` is currently tied to `AUTH_ROUTES` array, which will be split into two context-specific constants. The planner must update this line.

**Options:**
```javascript
// Option A: hardcode the known total
console.log(`Wrote 42 screenshots to ${ARTIFACTS_DIR}/`)

// Option B: compute from both route arrays
const total = BREAKPOINTS.length * (UNAUTH_ROUTES.length + ADMIN_ROUTES.length + MEMBER_ROUTES.length)
console.log(`Wrote ${total} screenshots to ${ARTIFACTS_DIR}/`)
```

Option B is preferred — it stays correct if route arrays change. Requires renaming `AUTH_ROUTES` to `ADMIN_ROUTES` in the declaration.

### Anti-Patterns to Avoid

- **Do not use `page.waitForSelector()`** — `page.locator().waitFor()` is the Playwright v1.x idiom. `waitForSelector` is the legacy API. `[CITED: playwright.dev/docs/locators]`
- **Do not modify Navbar.tsx** — sentinel is in the harness only. Zero `src/` edits per D-02.
- **Do not run Lighthouse from audit-screenshots.mjs** — Lighthouse stays in `audit-mobile.sh`. They are separate scripts.
- **Do not reuse the same Playwright context across Pass-B fixtures** — LO-02 from `e2e/helpers/auth.ts` docs: re-using a context with a different `addInitScript` injection on the same `page` means last-write wins but prior React state persists until next `goto`. Separate contexts are cleaner and the documented pattern.
- **Do not place the sha256 dupe-check inside the MANIFEST block** — the check must precede the MANIFEST write so exit(1) fires before recording a bad-run manifest. These are separate scopes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA-256 file fingerprinting | Custom hash implementation | `node:crypto` `createHash('sha256')` | Already in-use in harness line 220; built-in; correct |
| Playwright session injection | Manual cookie/token wrangling | `page.addInitScript([key,val] => localStorage.setItem(...))` | Established pattern from `e2e/helpers/auth.ts` and existing Pass-B; LO-03 sequencing already documented |
| Playwright hydration detection | Polling DOM or timers | `page.locator(sel).waitFor({timeout})` | Playwright's first-class locator API; handles Promises cleanly with `.catch` |
| Auth session minting | Supabase admin-API session creation | `supabase.auth.signInWithPassword({email, password})` | Fixture users are seeded for exactly this; service-role key is NOT needed |

---

## Common Pitfalls

### Pitfall 1: Sentinel Ordering — `addInitScript` AFTER `goto`
**What goes wrong:** If `page.addInitScript()` is called after any `page.goto()`, the script does not run on that page load. The app renders unauthenticated. Auth-dependent routes redirect to `/`, producing loading-shell dupes.
**Why it happens:** LO-03 constraint — `addInitScript` registers for future navigations only. The existing admin context already handles this correctly; the member context must follow the same order.
**How to avoid:** `signInWithPassword` → build `memberPayload` → `browser.newContext()` → `memberPage.addInitScript(...)` → THEN `memberPage.goto(...)`. Never reorder.
**Warning signs:** `[auth:member] WARN bp-320-topics: final=/ expected=/topics` — auth redirect bounce.

### Pitfall 2: Sentinel selector not found → `.catch` swallows → loading shell captured
**What goes wrong:** If the sentinel `[aria-label="Toggle color theme"]` times out at 10s but `.catch` swallows the error, the screenshot proceeds with a loading shell. The dupe-check then catches it at run's end, but the operator loses context on which routes failed.
**Why it happens:** Soft-timeout philosophy (D-04). The dupe-check is the hard backstop.
**How to avoid:** Check operator output carefully — if `sha256 DUPE FAILURE` fires, the sentinel is not appearing within 10s on prod. Possible causes: Netlify CDN cold start, prod deploy not live, JS bundle error. Verify prod site responds before running.
**Warning signs:** `sha256 DUPE FAILURE: N collision group(s)` in output.

### Pitfall 3: Pass-B local preview server not running
**What goes wrong:** The Pitfall 5 probe at lines 104-112 throws `Local preview server not reachable at http://localhost:4173`. The entire Pass-B block (both admin and member contexts) aborts.
**Why it happens:** Pass-B requires a local preview build server — it's a prerequisite documented in the harness header.
**How to avoid:** Before running the harness: `npm run build && npm run preview` in a separate shell. Also `supabase start` for the auth endpoint. Also `export VITE_SUPABASE_ANON_KEY=$(supabase status | grep anon)`.
**Warning signs:** `Error: Local preview server not reachable at http://localhost:4173`.

### Pitfall 4: `setViewportSize` AFTER `goto` (Phase 9 Pitfall 4 carry-forward)
**What goes wrong:** Viewport is set after navigation; the page renders at default viewport (1280×720 or similar) and the screenshot captures the wrong breakpoint.
**Why it happens:** Playwright applies viewport before the next navigation. Setting it after `goto` has no effect on the current page in some configurations.
**How to avoid:** `page.setViewportSize({width, height: 800})` is the OUTER loop in the existing harness — the width-iteration loop wraps the route-iteration loop. This is correct. The member context block must mirror this outer-width / inner-route ordering.
**Warning signs:** All 6 width PNGs for a route look identical — same layout regardless of width.

### Pitfall 5: `memberUser` routes use auth-honored expectedPath
**What goes wrong:** Planner copies the Pass-A `/topics` route entry (which has `expectedPath: '/'` because unauth redirects to `/`). The F6 path assertion fires a WARN for every `/topics` screenshot even though the session worked correctly.
**Why it happens:** Unauth and auth `/topics` have different `expectedPath` values. Unauth = `/` (redirect). Auth = `/topics` (session honored, lands at route).
**How to avoid:** Member context routes: `{ path: '/topics', expectedPath: '/topics', mustSee: ... }`. Not `expectedPath: '/'`.
**Warning signs:** `[auth:member] WARN bp-320-topics: final=/topics expected=/` — inverted paths.

### Pitfall 6: Stale Pass-A screenshots contaminate dupe check
**What goes wrong:** If a prior run's screenshots are still in `ARTIFACTS_DIR` when the new run starts, the dupe check sees the union of old + new PNGs and may fire on the old stale set even if the new run was clean.
**Why it happens:** The `rm -rf ARTIFACTS_DIR` at line 61 prevents this — but only if it runs. If the harness crashes before the rm line, ARTIFACTS_DIR persists from the prior run.
**How to avoid:** The `rm -rf` at line 61 is the first I/O operation in the harness (after `browser.launch`). This is intentional. Do not move it or wrap it in a conditional. If the harness crashes mid-run, manually `rm -rf .planning/closure/artifacts/screenshots/` before re-running.
**Warning signs:** PNG count after rerun is > 42 (stale files not cleaned).

---

## Code Examples

### Verified: Playwright locator waitFor API
```javascript
// Source: [VERIFIED: Playwright 1.59.1 API — locator.waitFor(options)]
// Options: { state: 'visible'|'attached'|'hidden'|'detached', timeout: number }
// Default state is 'visible'. Resolves when the element matches the state.
await page.locator('[aria-label="Toggle color theme"]').waitFor({ timeout: 10000 }).catch(() => {})
```

### Verified: Two-context supabase signInWithPassword shape
```javascript
// Source: [VERIFIED: audit-screenshots.mjs:123-131 — existing admin context]
const supabase = createClient(SUPABASE_URL, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { data, error } = await supabase.auth.signInWithPassword({
  email: MEMBER_FIXTURE.email,
  password: FIXTURE_PASSWORD,
})
if (error || !data.session) {
  throw error ?? new Error(`signInWithPassword returned no session for ${MEMBER_FIXTURE.email}`)
}
```

### Verified: MANIFEST.json sha256 + readFile pattern (existing)
```javascript
// Source: [VERIFIED: audit-screenshots.mjs:218-222]
const buf = await readFile(full)
const sha256 = createHash('sha256').update(buf).digest('hex')
// For dupe check: reuse this pattern for the pre-MANIFEST pass
```

### Verified: Evidence file frontmatter shape
```yaml
# Source: [VERIFIED: .planning/closure/UIDN-02-mobile-evidence.md:1-13]
# Current (v1.1):
status: deferred — Lighthouse Perf 5/5 routes under target + 6 F6 DOM-assertion warnings rooted in Plan 02 harness hydration-wait defect

# Target (v1.2 pass):
status: complete-v1.2

# Target (v1.2 miss):
status: deferred-v1.2 — Lighthouse Perf N/5 routes under target; follow-up tied to next perf-budget change
```

### Verified: Evidence file Sign-off italics pattern (from OBSV-02)
```markdown
Source: [VERIFIED: .planning/closure/OBSV-02-bundle-delta.md:138-141]
_Measured: 2026-04-30T09:48:00Z_
_Method: 3-way same-session git-worktree comparison; ..._
_Disposition: SHIP with keepNames enabled — D-14 ship-anyway policy applied; ..._
```
Phase 13 v1.2 section ends with:
```markdown
_Audited: 2026-05-XX against https://polls.wtcsmapban.com (Lighthouse 13.2.0 + Playwright 1.59.1)_
_Method: 5-route Lighthouse mobile audit + 6-width × 42-PNG matrix; harness at `.planning/closure/audit-{mobile.sh,screenshots.mjs}`_
_Disposition: [PASS — UIDN-02 closed; row flipped ⚠️ → ✓] OR [DEFER — row stays ⚠️ Revisit; follow-up tied to next perf-budget change]_
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `body.filter({hasText}).first().waitFor({timeout:5000}).catch()` (PR #24) | `locator('[aria-label="Toggle color theme"]').waitFor({timeout:10000}).catch()` | Phase 13 (this phase) | Stable post-hydration marker vs fragile text match; eliminates loading-shell captures |
| Pass-B: 2 admin sub-routes (12 PNGs) | Pass-B: 4 sub-routes across 2 contexts (24 PNGs) | Phase 13 (this phase) | Adds authenticated voter UI evidence for `/topics` + `/archive` |
| Pass-A: 5 unauth routes (30 PNGs) | Pass-A: 3 unauth routes (18 PNGs) | Phase 13 (this phase) | Drops by-design redirect dupes that would false-positive dupe check |
| No sha256 dupe-check | Hard-fail sha256 uniqueness gate after screenshot run | Phase 13 (this phase) | Catches Phase 9 defect signature (loading shells) deterministically |
| UIDN-02 status: deferred | status: complete-v1.2 (pass) or deferred-v1.2 (miss) | Phase 13 (this phase) | Records which audit cleared the requirement |

**v1.1 baseline scores (recorded in evidence file — Phase 13 must beat these to flip the row):**

| Route | v1.1 Perf | Gap to 90 | v1.1 A11y | v1.1 BP | v1.1 SEO |
|-------|-----------|-----------|-----------|---------|---------|
| / | 82 | 8pp | 100 | 100 | 92 |
| /topics | 88 | 2pp | 100 | 100 | 92 |
| /archive | 86 | 4pp | 100 | 100 | 92 |
| /auth/error | 85 | 5pp | 100 | 100 | 92 |
| /admin | 86 | 4pp | 100 | 100 | 92 |

Source: `[VERIFIED: .planning/closure/UIDN-02-mobile-evidence.md § "Lighthouse mobile scores"]`

A11y, BP, and SEO all passed at v1.1. Only Performance is the open question for v1.2.

---

## Runtime State Inventory

This section is omitted — Phase 13 is not a rename/refactor/migration phase. No stored data, live service config, OS-registered state, secrets, or build artifacts need updating.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `audit-screenshots.mjs` runtime | ✓ | v24.14.0 | — |
| `@playwright/test` (chromium) | Pass-A + Pass-B screenshot capture | ✓ | 1.59.1 | — |
| `npx lighthouse@13.2.0` | `audit-mobile.sh` Lighthouse CLI | ✓ | 13.2.0 | — |
| `jq` | `audit-mobile.sh` JSON score parsing | ✓ | 1.7.1 | — |
| `shasum -a 256` | `audit-mobile.sh` MANIFEST sha256 | ✓ | 6.02 | — |
| `node:crypto` `createHash` | sha256 dupe-check + MANIFEST upsert | ✓ | built-in | — |
| `https://polls.wtcsmapban.com` (prod site) | Pass-A screenshots + Lighthouse | ✓ | HTTP 200 confirmed | — |
| `supabase start` (local Supabase) | Pass-B `signInWithPassword` | Must be started by operator | — | No fallback — required for Pass-B |
| `npm run build && npm run preview` (port 4173) | Pass-B screenshot base URL | Must be started by operator | — | No fallback — required for Pass-B |
| `VITE_SUPABASE_ANON_KEY` env var | Pass-B `createClient` | Must be exported by operator | — | Hard error in harness (line 114-119) |

**Missing dependencies with no fallback:**
- `supabase start` + `VITE_SUPABASE_ANON_KEY` + `npm run preview` — all three are operator-started prerequisites documented in the harness header. The harness enforces this via the Pitfall 5 probe (line 104) and the `anonKey` guard (line 114). Plans must include an explicit pre-flight checklist task.

**Missing dependencies with fallback:**
- None — all required tools are confirmed available.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | The harness scripts ARE the validation framework for this phase — `audit-screenshots.mjs` (exits 0/1) and `audit-mobile.sh` (exits 0/1) |
| Quick run command | `node .planning/closure/audit-screenshots.mjs` |
| Full suite command | `node .planning/closure/audit-screenshots.mjs && bash .planning/closure/audit-mobile.sh` |

### Phase Requirements → Validation Map
| SC# | Behavior | Validation Type | Automated Command | How to Verify |
|-----|----------|-----------------|-------------------|---------------|
| SC1 | Harness exits 0, zero F6 warnings, sha256 dupe-check passes | Functional | `node .planning/closure/audit-screenshots.mjs` → exit 0 + "All DOM assertions matched." + "sha256 uniqueness check passed (42 PNGs, 0 collisions)" | Check stdout and exit code |
| SC2 | 42 PNGs present, `/topics` + `/archive` captured as authenticated (no login redirect in body) | Behavioral | Inspect `bp-{w}-topics.png` + `bp-{w}-archive.png` for authenticated UI (member username visible, no "Sign in" CTA at hero level) | Manual PNG inspection + MANIFEST entry count = 42 |
| SC3 | Lighthouse scores produced for all 5 routes; archived in evidence file | Evidence | `bash .planning/closure/audit-mobile.sh` → 5 routes in summary table | Compare MANIFEST lighthouse entry count = 10; evidence file has numeric scores for all 5 routes |
| SC4 | PROJECT.md row + REQUIREMENTS.md row reflect same outcome; evidence file frontmatter matches | Cross-doc | Manual diff: `grep "Mobile-first" .planning/PROJECT.md` + `grep "UIDN-02" .planning/REQUIREMENTS.md` + `head -13 .planning/closure/UIDN-02-mobile-evidence.md` | All three documents agree on pass or miss, not mixed |

### Wave 0 Gaps
None — no new test files needed. The validation is the harness execution itself plus manual evidence-file review. Existing `vitest` and Playwright suites are unaffected by this phase (no `src/` changes).

---

## Security Domain

This phase has no security-relevant changes — it modifies a `.planning/closure/` script and three `.planning/*.md` files. No authentication flows, no user-facing surfaces, no API endpoints, no database changes.

ASVS categories V2/V3/V4 do not apply. V5 (input validation) applies only in the sense that the harness validates its own environment (Pitfall 5 probe, ANON_KEY guard) — this is existing behavior, not changed by Phase 13.

---

## Research Findings: Seven Implementation Questions

### Q1: Sentinel selector mechanics

**Finding:** `page.locator('[aria-label="Toggle color theme"]').waitFor({ timeout: 10000 }).catch(() => {})` is the exact replacement for the PR #24 line at lines 80 and 161. `[VERIFIED: Navbar.tsx:76]`

The selector targets `<Button variant="ghost" size="icon" aria-label="Toggle color theme">` inside the `<div className="flex items-center gap-2">` block at line 72 of Navbar.tsx. This block is rendered unconditionally on every route — it is outside and before the `{user ? ... : ...}` ternary that begins at line 98. Confirmed: `src/routes/__root.tsx:27` mounts `<Navbar />` unconditionally inside `RootLayout`, which wraps every route via the root layout.

**Insert position:** Replace the existing `body.filter` line in-place at line 80 (Pass-A) and line 161 (Pass-B admin loop). The sentinel replaces the same position — it is a 1-for-1 line swap, not an addition.

**Confidence:** HIGH `[VERIFIED: source code]`

### Q2: sha256 dupe-check implementation

**Finding:** The dupe-check must perform its own `readdir` + `createHash` pass over `ARTIFACTS_DIR` BEFORE the MANIFEST block. The MANIFEST block (lines 198-228) also computes sha256, but these are in separate script sections. `[VERIFIED: CONTEXT.md line 95, line 140]`

The check cannot reuse the MANIFEST block's sha256 values because the MANIFEST block hasn't run yet (and we want to exit before running it on a bad corpus). The pre-MANIFEST dupe-check block reads all `.png` files from `ARTIFACTS_DIR`, computes sha256 for each, groups by sha256, and calls `process.exit(1)` if any group has more than 1 file.

**MANIFEST write on dupe-fail:** Per CONTEXT.md line 140, the canonical design is "exit non-zero BEFORE writing a manifest from a known-bad run." The planner has discretion to write the MANIFEST anyway for forensics — either approach is valid; the key constraint is that `process.exit(1)` fires.

**Verification:** The v1.1 MANIFEST.json confirms this check would correctly detect the Phase 9 defect: 6 sha256 collision groups across all 6 breakpoints (24 of 30 unauth PNGs are byte-identical loading shells). `[VERIFIED: MANIFEST.json analysis]`

**Confidence:** HIGH `[VERIFIED: MANIFEST.json + source code]`

### Q3: Two-context Pass-B pattern

**Finding:** The existing admin context block (lines 100-179) is the complete template. The member context block is structurally identical with three differences: (1) `MEMBER_FIXTURE` instead of `ADMIN_FIXTURE`, (2) `MEMBER_ROUTES` array = `/topics` + `/archive` with `expectedPath` matching the authenticated route (not `/`), (3) `console.log` prefix `[auth:member]` for log distinguishability.

**Context lifecycle:** Admin context: `browser.newContext()` → `newPage()` → `addInitScript()` → `{width/route loop}` → `context.close()`. Member context follows immediately in a new `{...}` block: `browser.newContext()` → `newPage()` → `addInitScript()` → `{width/route loop}` → `memberContext.close()`. Then `browser.close()`.

**The `supabase` client instance** is already declared in the outer Pass-B block scope (line 123). The member context can reuse it for the second `signInWithPassword` call — no new `createClient` needed if the outer scope is preserved.

**Confidence:** HIGH `[VERIFIED: source code structure + auth.ts pattern]`

### Q4: Lighthouse prod-audit cadence

**Finding:** `audit-mobile.sh` is confirmed UNCHANGED for Phase 13. `[VERIFIED: CONTEXT.md line 94 — "UNCHANGED for Phase 13"]`

The 5-route URL list in the script matches the D-05 locked set: `"/" "/topics" "/archive" "/auth/error" "/admin"`. `[VERIFIED: audit-mobile.sh:14]` Prod site returns HTTP 200. `[VERIFIED: curl check]` No env vars or auth prerequisites are needed for the Lighthouse audit — it runs unauthenticated against prod.

The `--throttling-method=simulate` flag is maintained (Phase 9 D-05 lock). Single-run policy honored (D-13). Thresholds remain `THRESHOLD_PERF=90`, `THRESHOLD_A11Y=95`, `THRESHOLD_BP=95`, `THRESHOLD_SEO=90`.

**Confidence:** HIGH `[VERIFIED: source code]`

### Q5: Evidence file append pattern

**Finding:** The append follows the OBSV-02-bundle-delta.md shape exactly. `[VERIFIED: OBSV-02-bundle-delta.md]`

Structure for the new section:
```markdown
## v1.2 Rerun (2026-05-XX)

[intro paragraph: what changed since v1.1, what was fixed]

### Lighthouse mobile scores (v1.2 production)
[same table shape as v1.1 section]

### Breakpoint matrix (42 PNGs — v1.2)
[updated table: 3 unauth routes in Pass-A, 4 auth routes in Pass-B across 2 contexts]

### Harness changes (Phase 13)
[document sentinel fix, 2nd context, sha256 dupe-check]

### Cross-references
- `.planning/phases/13-uidn-02-mobile-audit-closure/13-CONTEXT.md` — D-01..D-18
- `.planning/phases/13-uidn-02-mobile-audit-closure/13-PLAN.md` — implementation
- GitHub PR #XX — Phase 13 PR
- Phase 12 prod commit `de15e33` — v1.2 deploy audited against

---
_Audited: 2026-05-XX against https://polls.wtcsmapban.com (Lighthouse 13.2.0 + Playwright 1.59.1)_
_Method: 5-route Lighthouse mobile audit + 6-width × 42-PNG matrix (18 unauth-prod + 24 auth-local); harness at `.planning/closure/audit-{mobile.sh,screenshots.mjs}`_
_Disposition: [pass/miss text]_
```

**Frontmatter:** Replace only the `status:` line (line 10 in the current file). Keep all other frontmatter fields unchanged. `[VERIFIED: UIDN-02-mobile-evidence.md:1-13]`

**Confidence:** HIGH `[VERIFIED: OBSV-02-bundle-delta.md + UIDN-02-mobile-evidence.md structure]`

### Q6: PROJECT.md / REQUIREMENTS.md edit precision

**Finding:** `[VERIFIED: grep output]`

- `PROJECT.md` line 211: `| Mobile-first responsive design | Discord users tap links from phones | ⚠️ Revisit (UIDN-02 closure evidence pending — issue #18) |` → replace the third column only.
- `REQUIREMENTS.md` line 31: UIDN-02 active row text + checkbox state. On pass: `[x]` + update wording. On miss: `[ ]` stays, wording records v1.2 rerun outcome and follow-up trigger.
- `REQUIREMENTS.md` line 74: Phase Traceability row: `Pending` → `Complete (Phase 13, 2026-05-XX)` on pass, or `Active (Phase 13 v1.2 rerun complete; pending next perf-budget change)` on miss.

No git conflict risk — these are planning artifacts not touched by any parallel work.

**Idempotency for re-runs:** The harness rewrites MANIFEST.json completely on each run (wipes ARTIFACTS_DIR + re-upserts). The evidence file and PROJECT.md/REQUIREMENTS.md are manual edits — not idempotent scripts. The plan must be executed once with the final scores in hand.

**Confidence:** HIGH `[VERIFIED: grep against live files]`

### Q7: Atomic vs WAVE-split commit shape

**Finding:** Phase 9 Path-3 pattern calls for atomic — harness fix + clean-run artifacts (MANIFEST.json) + evidence append + PROJECT.md + REQUIREMENTS.md in one commit.

**Hard ordering analysis:**
1. Harness fix (`audit-screenshots.mjs`) must be complete before the rerun.
2. The rerun produces MANIFEST.json and score numbers used in the evidence file.
3. Evidence file append, PROJECT.md row, and REQUIREMENTS.md rows all depend on the score numbers from step 2.

Steps 1-2 are sequential (harness fix → rerun). Steps 3+ depend on the rerun output numbers but are purely text edits. There is no reason for a WAVE split — the entire commit can be: (a) edit harness, (b) run harness + Lighthouse, (c) fill in score numbers in evidence file + doc rows, (d) commit all changed files together.

**WAVE-split is justified only if:** the operator wants to commit the harness fix for review before running the expensive Lighthouse + screenshot suite. This is a planner discretionary call, not a technical requirement.

**Files changed in one commit:**
- `.planning/closure/audit-screenshots.mjs` (harness edits)
- `.planning/closure/artifacts/MANIFEST.json` (re-upserted by harness run)
- `.planning/closure/UIDN-02-mobile-evidence.md` (v1.2 section appended)
- `.planning/PROJECT.md` (one row edit)
- `.planning/REQUIREMENTS.md` (two row edits)

**Confidence:** HIGH `[VERIFIED: Phase 9 Path-3 pattern + ordering analysis]`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `memberUser` fixture is seeded in the LOCAL Supabase fixture stack and `signInWithPassword` will succeed against `http://localhost:54321` | Pattern 2, Q3 | Medium — if fixture user seed is stale or local Supabase hasn't been restarted, Pass-B member context throws on auth fail. The harness already hard-fails on session error (line 130 pattern). Operator pre-flight covers this. |
| A2 | v1.2 prod Lighthouse Performance scores are higher than v1.1 baseline (Phase 12 UIDN-03 sweep improved bundle) | Q4, Row flip | Medium — v1.2 deployed Phase 12 UI changes but no explicit perf-budget work. Scores may still be under 90. D-11 (strict floor) means the row stays ⚠️ if so — the plan must handle both pass and miss outcome paths. |
| A3 | The Netlify CDN edge serves the Phase 12 bundle (de15e33 merge) for all 5 routes at time of audit | Q4 | Low — prod confirmed HTTP 200; Netlify auto-deploys on merge to main. Standard propagation time is < 5 minutes. |

**Confirmed claims (NOT assumed):** Sentinel selector location (Navbar.tsx:76), unconditional rendering (outside auth ternary), current dupe count in MANIFEST (6 groups), MANIFEST prune + upsert flow, Playwright version (1.59.1), Lighthouse version (13.2.0), prod site HTTP 200, Node.js crypto/fs availability, all line numbers in audit-screenshots.mjs.

---

## Open Questions

1. **v1.2 Performance scores — pass or miss?**
   - What we know: v1.1 scores were 82-88 for Perf across 5 routes. Phase 12 shipped UIDN-03 native-button replacements + VIS-07-09 UI additions but no explicit perf-budget optimization (no lazy-route splits, no image opt, bundle delta tracked in OBSV-02 baseline but not re-measured).
   - What's unclear: Whether the Phase 12 changes pushed Perf over or under 90.
   - Recommendation: The plan must include branching instructions for both pass-path and miss-path doc edits. Do not assume pass.

2. **`AUTH_ROUTES` constant rename — array split approach**
   - What we know: Current `AUTH_ROUTES` array (lines 41-46) will be replaced by two separate arrays (`ADMIN_ROUTES` + `MEMBER_ROUTES`) when Pass-B is split into two contexts.
   - What's unclear: Whether the planner keeps `AUTH_ROUTES` as an alias for backward compat, or renames it.
   - Recommendation: Rename to `ADMIN_ROUTES` for clarity; declare `MEMBER_ROUTES` inline in the member context block (or at module top alongside `ADMIN_ROUTES`). Update line 183 total-count log to use both.

3. **MANIFEST write on sha256 failure — forensics trade-off**
   - What we know: CONTEXT.md line 140 says planner picks: write manifest anyway, or skip on dupe-fail.
   - What's unclear: Operator preference.
   - Recommendation: Write the MANIFEST even on dupe-fail. The manifest records what was actually captured (including the collision data), which aids debugging. `process.exit(1)` still fires after the write to signal failure. This is safer for iterative harness debugging.

---

## Sources

### Primary (HIGH confidence)
- `[VERIFIED: .planning/closure/audit-screenshots.mjs]` — complete source code read; line numbers confirmed
- `[VERIFIED: src/components/layout/Navbar.tsx]` — sentinel selector at line 76, auth ternary at line 98
- `[VERIFIED: src/routes/__root.tsx]` — `<Navbar />` unconditional mount at line 27
- `[VERIFIED: e2e/helpers/auth.ts]` — `loginAs` pattern, `addInitScript` + `signInWithPassword` shape
- `[VERIFIED: e2e/fixtures/test-users.ts]` — `memberUser.id`, `adminUser.id`, `FIXTURE_PASSWORD`
- `[VERIFIED: .planning/closure/UIDN-02-mobile-evidence.md]` — v1.1 baseline scores, F6 corpus, auth-pass disposition
- `[VERIFIED: .planning/closure/audit-mobile.sh]` — UNCHANGED for Phase 13; 5-route list confirmed
- `[VERIFIED: .planning/closure/OBSV-02-bundle-delta.md]` — Sign-off italics shape, frontmatter convention
- `[VERIFIED: .planning/closure/artifacts/MANIFEST.json]` — 6 sha256 collision groups confirmed; 42 screenshot entries + 10 Lighthouse entries
- `[VERIFIED: curl https://polls.wtcsmapban.com/]` — HTTP 200, prod live
- `[VERIFIED: node --version]` — Node.js v24.14.0
- `[VERIFIED: node_modules/@playwright/test/package.json]` — Playwright 1.59.1
- `[VERIFIED: npx -y lighthouse@13.2.0 --version]` — 13.2.0
- `[VERIFIED: jq --version]` — jq-1.7.1-apple
- `[VERIFIED: shasum]` — available at `/usr/bin/shasum`
- `[VERIFIED: grep PROJECT.md:211]` — Mobile-first row at line 211
- `[VERIFIED: grep REQUIREMENTS.md:31,74]` — UIDN-02 active row + Phase Traceability row

### Secondary (MEDIUM confidence)
- `[CITED: playwright.dev/docs/locators]` — `locator().waitFor()` as the first-class Playwright v1.x API vs deprecated `waitForSelector`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tool versions verified against running binaries and package.json
- Architecture: HIGH — harness source code read in full; all line numbers confirmed
- Pitfalls: HIGH — rooted in Phase 9 evidence file + MANIFEST.json forensics + existing harness code patterns
- Evidence file / doc edits: HIGH — existing file structure read; OBSV-02 analog confirmed

**Research date:** 2026-05-13
**Valid until:** 90 days (stable toolchain; Playwright + Lighthouse versions pinned; prod URL stable)
