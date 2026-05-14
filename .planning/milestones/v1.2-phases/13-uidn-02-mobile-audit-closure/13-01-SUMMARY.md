---
phase: 13-uidn-02-mobile-audit-closure
plan: 01
subsystem: closure
tags: [closure, harness, screenshot, playwright]
status: complete
dependency_graph:
  requires:
    - .planning/phases/13-uidn-02-mobile-audit-closure/13-CONTEXT.md
    - .planning/phases/13-uidn-02-mobile-audit-closure/13-RESEARCH.md
  provides:
    - .planning/closure/audit-screenshots.mjs (fixed harness — sentinel, 2nd context, dupe-check)
  affects:
    - .planning/closure/artifacts/screenshots/ (populated when operator runs harness in Task 2)
    - .planning/closure/artifacts/MANIFEST.json (re-upserted when operator runs harness in Task 2)
tech-stack:
  added: []
  patterns:
    - "Deterministic post-hydration sentinel via Playwright locator().waitFor() against an existing aria-label (D-03)"
    - "Two-context Pass-B: separate adminUser + memberUser Playwright contexts inside one harness (D-08)"
    - "sha256 uniqueness gate with per-width allow-list for intentional collisions (D-19)"
    - "Inline mirroring of TypeScript fixture constants into .mjs harness (D-23 — Node ESM loader cannot import .ts at runtime)"
key-files:
  created: []
  modified:
    - .planning/closure/audit-screenshots.mjs
decisions:
  - "D-01/D-03: sentinel selector = [aria-label='Toggle color theme'] from Navbar.tsx:76 (unconditionally rendered, outside auth ternary)"
  - "D-04: soft 10s timeout with .catch preserved on both passes — sha256 dupe-check is the hard backstop, not the wait itself"
  - "D-05/D-19: sha256 uniqueness gate hard-fails BEFORE MANIFEST upsert; per-width home↔admin pair whitelisted (Phase 9 D-06 intentional collision via AdminGuard Navigate)"
  - "D-07/D-08: Pass-B grows to 4 sub-routes across 2 contexts — adminUser for /admin/suggestions/*, memberUser for /topics + /archive"
  - "D-09: dropped unauth /topics + /archive from Pass-A (AuthGuard renders LandingPage in place; PNGs byte-identical to / unauth at every width)"
  - "D-10: plain naming bp-{w}-topics.png / bp-{w}-archive.png — no auth- prefix"
  - "D-23: MEMBER_FIXTURE inline-mirrored from e2e/fixtures/test-users.ts:21-30 (harness is .mjs; fixture is .ts; Node ESM cannot bridge runtime)"
metrics:
  duration: ~30 minutes (Task 1 + Task 2 incl. local-stack rebuild)
  tasks: 2 of 2 complete
  files: 1 modified
  screenshots_captured: 42
  dom_warnings: 0
  unexpected_collisions: 0
  whitelist_collision_pairs: 6
  completed_date: 2026-05-13
---

# Phase 13 Plan 01: Harness fixes — sentinel, member context, sha256 dupe-check Summary

**One-liner:** Replaced fragile body-text hydration wait with deterministic Navbar theme-toggle sentinel, added memberUser Pass-B context for authenticated /topics + /archive, reduced Pass-A to 3 unauth routes (dropped by-design AuthGuard dupes), and added sha256 uniqueness gate with D-19 home↔admin whitelist that hard-fails before MANIFEST write on any unexpected collision.

## Status

**Task 1 (auto):** COMPLETE — all 9 EDITs applied to `.planning/closure/audit-screenshots.mjs`, committed atomically at **`3b5f9a0`**.

**Task 2 (checkpoint:human-verify):** COMPLETE — operator confirmed harness ran from current session. Resume signal: `harness-ok: 0 warnings`. Pre-requisites: local Supabase stack already running (containers `supabase_db_*` + `supabase_kong_*` + `supabase_auth_*` healthy), API URL responds 200, 4 fixture users seeded (`playwright-user-{admin,member,no2fa,notmember}@test.local`). Operator rebuilt the SPA with `VITE_SUPABASE_URL=http://localhost:54321` + local anon key so Pass-B's `signInWithPassword` + `addInitScript` storage key (`sb-localhost-auth-token`) matches the bundle's supabase-js client (initial build had baked in production URL, so member context never authenticated → flagged as a Phase 13 operational note, NOT a harness defect).

## What Changed (Task 1)

**File:** `.planning/closure/audit-screenshots.mjs` — 154 insertions, 20 deletions in one commit.

### EDIT 1 — File header comment (lines 1-16)
Rewrote the "Two passes" block to document the Phase 13 matrix: Pass A = 3 unauth routes × 6 widths = 18 PNGs; Pass B = 4 auth sub-routes across 2 contexts × 6 widths = 24 PNGs; total 42 PNGs. References D-07/D-08/D-09.

### EDIT 2 — UNAUTH_ROUTES reduced from 5 to 3 entries (D-09)
Removed `/topics` and `/archive` entries. Remaining entries: `/`, `/auth/error`, `/admin`. Comment block explains that AuthGuard renders `<LandingPage />` in place for unauth at `/topics` + `/archive` (NO navigation per `src/components/auth/AuthGuard.tsx:18`), and that `/admin` STAYS because AdminGuard navigates unauth `/admin` → `/` via `Navigate` (Phase 9 D-06 locked evidence; D-19 whitelist handles the resulting sha256 collision).

### EDIT 3 — Renamed AUTH_ROUTES → ADMIN_ROUTES; declared MEMBER_ROUTES (D-08/D-10)
ADMIN_ROUTES keeps the 2 existing admin sub-route entries. MEMBER_ROUTES is new with 2 entries (`/topics`, `/archive`), each carrying `expectedPath` equal to the route path (NOT `/` — session is honored on auth routes per Pitfall 5 in RESEARCH.md). Plain naming per D-10.

### EDIT 4 — Pass-A sentinel swap at line 80 (D-01/D-02/D-03/D-04)
Replaced `await page.locator('body').filter({ hasText: route.mustSee }).first().waitFor({ timeout: 5000 }).catch(...)` with `await page.locator('[aria-label="Toggle color theme"]').waitFor({ timeout: 10000 }).catch(...)`. Comment cites Navbar.tsx:76 (unconditional render outside the auth ternary).

### EDIT 5 — Pass-B admin sentinel swap (D-06)
Identical sentinel applied to the admin context loop. Comment references D-06 (uniform application across both passes).

### EDIT 6 — Pass-B loop references ADMIN_ROUTES
`for (const route of AUTH_ROUTES)` → `for (const route of ADMIN_ROUTES)`. Only one remaining lexical reference to "AUTH_ROUTES" is in the rename comment on the ADMIN_ROUTES declaration (intentional historical pointer).

### EDIT 7 — Member context block added (D-07/D-08/D-23)
New scoped `{...}` block after `await context.close()` (admin context). Contents:
- `MEMBER_FIXTURE = { id: '11111111-1111-1111-1111-111111111111', email: 'playwright-user-member@test.local' }` with D-23 source comment pointing at `e2e/fixtures/test-users.ts:21-30` (no runtime import — .mjs cannot import .ts via Node ESM).
- Reuses outer-scope `supabase` client + `FIXTURE_PASSWORD` + `STORAGE_KEY` constants.
- `signInWithPassword` for memberUser; throws on `memberError` or missing session (matches admin context shape).
- New `memberContext` + `memberPage`; `addInitScript` runs BEFORE any `goto` (LO-03 sequencing).
- Outer loop: `for width of BREAKPOINTS` with `setViewportSize` BEFORE `goto` (Pitfall 4).
- Inner loop: `for route of MEMBER_ROUTES` with sentinel waitFor, `screenshot`, F6 DOM+path probe with `[auth:member]` prefix.
- Closes with `await memberContext.close()`.

### EDIT 8 — Total count log updated
`const total = BREAKPOINTS.length * (UNAUTH_ROUTES.length + ADMIN_ROUTES.length + MEMBER_ROUTES.length)` → computes `6 * (3 + 2 + 2) = 42`.

### EDIT 9 — sha256 dupe-check block with D-19 whitelist (D-05/D-19)
New scoped `{...}` block after the F6 warning summary and BEFORE the MANIFEST upsert. Implementation:
- Imports `readdir` as `readdirForDupe` to avoid name collision with the MANIFEST block's later import.
- Reads all `.png` files from `ARTIFACTS_DIR`, sorted.
- Per file: `readFile` + `createHash('sha256').update(buf).digest('hex')`, grouping into `Map<sha, basenames[]>`.
- Builds D-19 whitelist: per width W in BREAKPOINTS, `new Set(['bp-${W}-home.png', 'bp-${W}-admin.png'])` — 6 expected pairs.
- Iterates collision groups (length > 1): if `groupSet.size === 2` AND members match any whitelist pair → EXPECTED (increment `expectedCount`); else → push to `unexpectedGroups[]`.
- On `unexpectedGroups.length > 0`: `console.error("=== sha256 DUPE FAILURE: N unexpected collision group(s) ===")` + per-group basenames + remediation note explicitly excluding the whitelisted pairs from blame, then `process.exit(1)`.
- On success: `console.log("sha256 uniqueness check passed (N PNGs, M allowed home↔admin collision pairs per D-19, 0 unexpected collisions)")`.
- Comment block explains the whitelist rationale (AdminGuard Navigate → LandingPage at `/`; Phase 9 D-06 evidence; loading-shell would NOT match the home↔admin pair, so the whitelist cannot mask the original defect).

## Verify Results (Task 1)

Automated checks from plan `<verify>`:

| Check | Expected | Actual |
|-------|----------|--------|
| `node --check audit-screenshots.mjs` | exit 0 / "syntax OK" | ✓ syntax OK |
| `grep -c "Toggle color theme"` | 3 | ✓ 3 |
| `grep -c "sha256 DUPE FAILURE"` | 1 | ✓ 1 |
| `grep -cE "D-19\|home↔admin\|whitelist"` | ≥ 1 | ✓ 12 |
| `grep -c "MEMBER_ROUTES"` | ≥ 2 | ✓ 3 (declaration + loop + total) |
| `grep "playwright-user-member"` | non-empty | ✓ MEMBER_FIXTURE email line |
| `grep -cE "topics\|archive"` | ≥ 4 | ✓ 7 |
| AST UNAUTH_ROUTES entry count | 3 | ✓ 3 (Node script returns 3, exit 0) |
| `grep -cE "body.*filter.*hasText"` | 0 | ✓ 0 (old fragile sentinel fully removed) |
| `grep -c "process.exit(1)"` | 1 | ✓ 1 (dupe-check exit, before MANIFEST upsert) |
| `grep -c "ADMIN_ROUTES"` | ≥ 2 | ✓ 3 (declaration + loop + total) |
| `git status --short` | only `audit-screenshots.mjs` | ✓ confirmed; zero src/ edits |

## Task 2 — Operator Pre-Flight + Harness Execution (COMPLETE)

### What ran

Local Supabase stack was already running before invocation; harness pre-reqs were satisfied by:

1. **Supabase stack** — `supabase_db_*` + `supabase_kong_*` + `supabase_auth_*` containers healthy. `curl http://localhost:54321/auth/v1/health` → 200.
2. **Anon key** — pulled from running `supabase_kong_*` container env (`SUPABASE_ANON_KEY=eyJhbGciOi…CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`, well-known local-dev signing).
3. **Rebuild against local stack** — initial `npm run build` (no env override) baked in production `https://cbjspmwgyoxxqukcccjr.supabase.co`, which made the SPA's supabase-js use storage key `sb-cbjspmwgyoxxqukcccjr-auth-token` while the harness writes `sb-localhost-auth-token`. First run failed with 6 unexpected collision groups + 18 F6 warnings (all auth routes redirected to `/` because session token wasn't read). Rebuild with `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=<local-anon> npm run build` aligned the storage keys.
4. **Preview** — `npm run preview` on http://localhost:4173/ serving the local-stack bundle.
5. **Run** — `VITE_SUPABASE_ANON_KEY=<local-anon> node .planning/closure/audit-screenshots.mjs` → exit 0.

### Actual stdout

- 18 `[unauth]` lines (https://polls.wtcsmapban.com/, /auth/error, /admin × 6 widths)
- 12 `[auth]` lines (/admin/suggestions/new, /admin/suggestions/d0000000-…/edit × 6 widths)
- 12 `[auth:member]` lines (/topics, /archive × 6 widths)
- `Wrote 42 screenshots to .planning/closure/artifacts/screenshots/`
- `All DOM assertions matched.` (zero F6 warnings)
- `sha256 uniqueness check passed (42 PNGs, 6 allowed home↔admin collision pairs per D-19, 0 unexpected collisions)`
- `Updated .planning/closure/artifacts/MANIFEST.json (52 total entries)` — 42 new screenshot entries + 10 prior Lighthouse entries

### Verification

| Check | Expected | Actual |
|-------|----------|--------|
| `ls .planning/closure/artifacts/screenshots/*.png \| wc -l` | 42 | ✓ 42 |
| Harness exit code | 0 | ✓ 0 |
| F6 DOM-assertion warning count | 0 ideal | ✓ 0 |
| sha256 unexpected collision count | 0 | ✓ 0 |
| sha256 whitelist (expected) collision pair count | 6 (one per width) | ✓ 6 |
| `shasum -a 256 bp-375-home.png bp-375-admin.png` | identical | ✓ `c4c7925a…1f0f1` for both (Phase 9 D-06 evidence preserved through D-19 whitelist) |
| `bp-375-home.png` vs `bp-375-topics.png` | different | ✓ different (`c4c7925a…` vs `62192fde…`) |
| Spot-check `bp-375-topics.png` | authenticated /topics UI | ✓ "Active Topics" + member Discord avatar + 5+ topic cards + pinned suggestions visible (NOT landing page) |

### Operational note (not a harness defect)

The first run failed because `npm run build` without env overrides bakes in production Supabase. This is correct production behavior — the harness fix is sound — but the plan's Task 2 pre-flight checklist should be updated in any follow-up phase to call out the env-override requirement for local-bundle Pass-B (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` must point at the local stack before the build). Flagged here for v1.3+ harness hygiene; does not block this phase.

**Resume signal received:** `harness-ok: 0 warnings`

## Deviations from Plan

**Pre-flight env-override (operational, not a code change):** Plan Task 2 step 3 only exports `VITE_SUPABASE_ANON_KEY` — it does NOT call out that `npm run build` must also receive `VITE_SUPABASE_URL=http://localhost:54321` (and the same anon key) so that the bundle's supabase-js storage key matches what the harness writes. First run failed for this reason; second run after env-prefixed rebuild passed. Harness code is correct; documentation gap only.

## Commits

| Task | Commit (post-cherry-pick onto phase branch) | Description |
|------|---------------------------------------------|-------------|
| Task 1 | `97d1440` | fix(13-01): replace fragile hydration sentinel + add member context + sha256 dupe-check with D-19 whitelist |
| Task 2 partial summary | `07e6409` | docs(13-01): partial SUMMARY — Task 1 complete, Task 2 awaiting operator pre-flight |
| Task 2 finalization | (this commit) | docs(13-01): finalize SUMMARY — Task 2 harness-ok with 0 warnings, 42 unique PNGs |

(Original worktree commits were `3b5f9a0` + `dd073a2`; cherry-picked to phase branch when worktree was removed at wave end so the operator could run the harness from the main checkout against existing Supabase containers.)

## Self-Check: PASSED

- `[ -f .planning/closure/audit-screenshots.mjs ]` → FOUND
- `git log --oneline | grep -q 97d1440` → FOUND
- `node --check .planning/closure/audit-screenshots.mjs` → exit 0
- `grep -c "Toggle color theme"` → 3 (all three loop sites updated)
- `git status --short` shows clean tree (zero src/ edits)
- Harness exit code → 0
- 42 PNGs captured; 0 unexpected sha256 collisions; 6 whitelisted home↔admin pairs (Phase 9 D-06 evidence preserved)
- 0 F6 DOM-assertion warnings — `All DOM assertions matched.`
- Spot-check `bp-375-topics.png` → authenticated /topics view (Active Topics + member avatar + topic cards)
