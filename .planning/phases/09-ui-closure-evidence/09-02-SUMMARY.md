---
phase: 09-ui-closure-evidence
plan: 02
subsystem: closure-evidence
type: execute
wave: 1
tags: [audit, harness, lighthouse, playwright, scripts]
requirements: [UIDN-02, UIDN-03]
dependency_graph:
  requires: []
  provides:
    - ".planning/closure/audit-mobile.sh"
    - ".planning/closure/audit-screenshots.mjs"
    - ".gitignore-rules-for-audit-artifacts"
  affects:
    - "Plan 09-03 (UIDN-02 mobile evidence — invokes audit-mobile.sh + audit-screenshots.mjs Pass A)"
    - "Plan 09-04 (UIDN-03 shadcn audit — invokes audit-screenshots.mjs Pass B)"
tech-stack:
  added:
    - "Lighthouse 13.2.0 (invoked via npx -y; NOT added to devDependencies — D-04)"
  patterns:
    - "Two-pass Playwright (unauth prod + auth local) mirrored from e2e/helpers/auth.ts loginAs"
    - "addInitScript-before-goto sequencing (LO-03 — Phase 8 fixture pattern)"
    - "Top-of-file data block — re-runnable without flag parsing"
    - "rm -rf prior-run artifacts dir (F7 — clean baseline for count-based acceptance)"
    - "MANIFEST.json sha256 + size + recordedAt per binary artifact (F1 / Decision A)"
key-files:
  created:
    - ".planning/closure/audit-mobile.sh (84 lines, executable)"
    - ".planning/closure/audit-screenshots.mjs (203 lines)"
  modified:
    - ".gitignore (+8 lines — closure/artifacts subdir ignores + MANIFEST.json un-ignore)"
decisions:
  - "D-03/D-04 compliance: prod-only Lighthouse target; standalone scripts (no package.json wiring)"
  - "D-05 route inventory: 5 routes for Lighthouse; 7 routes (5 unauth + 2 auth) for screenshot matrix"
  - "D-06 alignment: /admin Lighthouse runs as guest; auth pass uses Phase 8 loginAs pattern (NOT --extra-headers)"
  - "Auth pass = local-build (RESEARCH Pattern 2 Option A) — Plan 09-03 evidence file MUST document this explicitly"
  - "FIXTURE_PASSWORD literal copied verbatim from e2e/fixtures/test-users.ts:49; if upstream rotates, regenerate"
metrics:
  duration: "~6 minutes"
  completed: "2026-05-05"
  tasks_completed: 4
  files_changed: 3
  commits: 1
---

# Phase 9 Plan 02: UIDN-02/03 Audit Harness Summary

**One-liner:** Built standalone Lighthouse + Playwright audit harness under `.planning/closure/` — re-runnable via direct path, no `package.json` wiring (D-04), Phase 8 fixture reused for auth pass (T-09-06 — no on-disk session JSON).

## Scripts and Data Blocks

### `.planning/closure/audit-mobile.sh` (UIDN-02 — Lighthouse mobile)

Top-of-file data block (the only thing a re-runner edits):

| Variable | Value |
| -------- | ----- |
| `BASE_URL` | `https://polls.wtcsmapban.com` (D-03 prod-only) |
| `ROUTES` | `/`, `/topics`, `/archive`, `/auth/error`, `/admin` (D-05) |
| `THRESHOLD_PERF` / `_A11Y` / `_BP` / `_SEO` | 90 / 95 / 95 / 90 |
| `ARTIFACTS_DIR` | `.planning/closure/artifacts/lighthouse` |

Behavior:
- Pinned `npx -y lighthouse@13.2.0` (F5 — no `lighthouse@latest` drift).
- `--form-factor=mobile --throttling-method=simulate` (Pitfall 2 — verified flag form for v13.2.0).
- `set -uo pipefail` (NOT `-e`) — accumulates failures across all 5 routes; exits non-zero at the end if any threshold missed.
- `jq` parses `.report.json` for each category score; PASS/FAIL summary printed at end.
- `rm -rf "$ARTIFACTS_DIR"` before run (F7 — clean baseline).
- Updates `.planning/closure/artifacts/MANIFEST.json` with sha256/size/recordedAt for every `.report.html` and `.report.json` (F1 / Decision A).

### `.planning/closure/audit-screenshots.mjs` (UIDN-02 + UIDN-03 — Playwright matrix)

Top-of-file data block:

| Variable | Value |
| -------- | ----- |
| `BASE_URL` | `https://polls.wtcsmapban.com` (Pass A — unauth prod) |
| `LOCAL_URL` | `http://localhost:4173` (Pass B — npm run preview default; matches `e2e/playwright.config.ts:28`) |
| `BREAKPOINTS` | `[320, 375, 414, 768, 1024, 1440]` (UIDN-02 6-width matrix) |
| `UNAUTH_ROUTES` | 5 routes with `mustSee` regex per route (F6 — DOM assertion warning aggregator) |
| `AUTH_ROUTES` | `/admin/suggestions/new`, `/admin/suggestions/d0000000-0000-0000-0000-000000000001/edit` |
| `ARTIFACTS_DIR` | `.planning/closure/artifacts/screenshots` |

Behavior:
- Total: 6 widths × (5 unauth + 2 auth) = 42 PNGs per re-run.
- **Pass A (unauth prod)** — `chromium.newContext()` → `setViewportSize` → `goto(networkidle)` → `screenshot(fullPage)` → DOM `mustSee` probe (warn-only, never aborts).
- **Pass B (auth local)** — Pitfall 5 fetch-probe of `LOCAL_URL` first (clear error if `npm run preview` not running); requires `VITE_SUPABASE_ANON_KEY` env var (clear error if missing); mints fixture admin session via `signInWithPassword` against local Supabase; injects session into `localStorage` via `addInitScript` BEFORE any `goto` (LO-03 sequencing rule from `e2e/helpers/auth.ts:71-114`).
- `mustSee` per auth route asserts session was honored AND not redirected to `/auth/error` (otherwise warning).
- `rm(ARTIFACTS_DIR, { recursive: true, force: true })` before run (F7).
- Updates `MANIFEST.json` with sha256/size/recordedAt for every PNG (F1 / Decision A).

## Auth Pass = Local-Build (Pattern 2 Option A)

**Plan 09-03 evidence file MUST call this out explicitly:** the authenticated `/admin/suggestions/*` screenshots come from a local production-mode build (`npm run build && npm run preview`), NOT from prod. This is the documented Pattern 2 Option A from `09-RESEARCH.md`. Rationale: prod is Discord-OAuth-only (no password flow), so no in-memory session can be minted against prod's Supabase project. Local preview is the only place the Phase 8 fixture user can authenticate.

The decision trade-off (recorded for the evidence file):
- **What we lose:** auth-route screenshots are not against the real Netlify CDN bundle.
- **What we keep:** UI/component layout fidelity (same Vite build pipeline, same Tailwind v4 output, same React 19 hydration). What changes between local-preview and prod is network/CDN latency — which is captured by the unauth Pass A against prod for the public routes that ARE Lighthouse-audited.

## Phase 8 Fixture Reuse (No New Login Implementation)

The `.mjs` does NOT import from `e2e/helpers/auth.ts` (e2e/ is TS-only and lives under a different `tsconfig`). Instead, the equivalent ESM-JS is inlined verbatim:

| Phase 8 source (`e2e/helpers/auth.ts`) | Inlined in `audit-screenshots.mjs` |
| -------------------------------------- | ---------------------------------- |
| Storage-key derivation (lines 26-29) | `STORAGE_KEY = \`sb-${PROJECT_REF}-auth-token\`` |
| Session payload shape (lines 100-107) | Same 6-key payload (access/refresh/expires_in/expires_at/token_type/user) |
| `addInitScript` before goto (LO-03) | Same — invoked once after context creation, before BREAKPOINTS loop |
| `signInWithPassword` against `http://localhost:54321` | Same — same `createClient` config |

The `FIXTURE_PASSWORD` string `'playwright-fixture-only-do-not-use-in-prod'` is copied verbatim from `e2e/fixtures/test-users.ts:49`. If upstream rotates that constant, this script must be regenerated.

**Security gate honored:** No on-disk `storageState` JSON is written (T-09-06). The session lives only in the in-memory page context.

## .gitignore Additions

8 lines appended after the existing `.netlify` / `.agents/` / `.claude/` / `.playwright-mcp/` block:

```
# Phase 9 audit harness artifacts (per-run binary outputs — not committed).
# The summary .md evidence files in .planning/closure/UIDN-0[23]-*.md ARE committed.
# F1 / Decision A: MANIFEST.json IS committed (sha256-pinned record of every
# binary artifact); only the binary subdirs themselves are ignored.
.planning/closure/artifacts/lighthouse/
.planning/closure/artifacts/screenshots/
!.planning/closure/artifacts/MANIFEST.json
```

Verified at commit time:
- `git check-ignore .planning/closure/artifacts/lighthouse/lh-mobile-home.report.html` → ignored
- `git check-ignore .planning/closure/artifacts/screenshots/bp-320-home.png` → ignored
- `git check-ignore .planning/closure/artifacts/MANIFEST.json` → NOT ignored (un-ignore rule wins)
- `git check-ignore .planning/closure/UIDN-02-mobile-evidence.md` → NOT ignored (Plan 03's commit target)
- `git check-ignore .planning/closure/audit-mobile.sh` → NOT ignored (the harness IS committed)

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 0 | Worktree-clean preflight (F14) | (no commit — gate only) | — |
| 1 | Create audit-mobile.sh + Lighthouse loop + jq summary | `2e887ba` | `.planning/closure/audit-mobile.sh` |
| 2 | Create audit-screenshots.mjs two-pass Playwright harness | `2e887ba` | `.planning/closure/audit-screenshots.mjs` |
| 3 | Update .gitignore + atomic commit of harness | `2e887ba` | `.gitignore`, both scripts (atomic 3-file commit) |

All four tasks landed in a single atomic `feat(09)` commit at HEAD `2e887ba` (per the plan's atomic-commit gate — no per-task commits for Plan 02; the 3-file commit is the unit of work).

## Verification Results

All `<acceptance_criteria>` blocks across the four tasks were verified by direct shell checks before the atomic commit. Highlights:

- `bash -n .planning/closure/audit-mobile.sh` → exit 0
- `node --check .planning/closure/audit-screenshots.mjs` → exit 0
- 5 unauth route greps + 2 auth route greps → all match
- `lighthouse@13.2.0` pinned exactly once (F5)
- `set -uo pipefail` (no `-e`) confirmed
- `addInitScript` + `signInWithPassword` both present
- `FIXTURE_PASSWORD` literal matches `e2e/fixtures/test-users.ts:49` exactly
- `! grep storageState:` → no on-disk session (T-09-06)
- `! grep "audit:mobile\|audit:screenshots\|lighthouse" package.json` → D-04 honored
- F1 manifest emission present in BOTH scripts (sha256/size/path/recordedAt/kind)
- F6 `mustSee` + `warnings.push` present
- F7 `rm -rf "$ARTIFACTS_DIR"` / `rm(ARTIFACTS_DIR, ...)` present in both
- F14 staging-area drift gate: `git diff --cached --name-only | sort` matched expected set exactly before commit
- Post-commit deletion check: `git diff --diff-filter=D --name-only HEAD~1 HEAD` → empty (no unintended deletions)
- `git diff HEAD~1 --name-only | grep '^src/'` → empty (zero src/ touched)

## Deviations from Plan

None — plan executed exactly as written. All four tasks completed without invoking Rules 1-4. The plan's `<action>` blocks contained verbatim file contents and the F14 staging-area gate was already pre-built into Task 3, so there was nothing to auto-fix or escalate.

## Authentication Gates

None encountered. This plan only **builds** the harness; it never **runs** the audits. Pass B's auth flow (signInWithPassword against local Supabase, env-var requirement for `VITE_SUPABASE_ANON_KEY`, local-server probe) is a runtime concern owned by Plans 09-03 and 09-04. The script's own auth-pass error messages are designed so a future operator gets a clear, actionable error if they invoke the script without the prerequisites.

## Known Stubs

None. The harness is production-ready end-to-end. Plans 09-03 and 09-04 will invoke it without further code changes.

## Threat Flags

None. The plan's `<threat_model>` (T-09-04 through T-09-08) covers all surface introduced. No new endpoints, schemas, file-access patterns, or trust boundaries beyond what the threat register already enumerates.

## Self-Check: PASSED

- `[ -f .planning/closure/audit-mobile.sh ]` → FOUND
- `[ -f .planning/closure/audit-screenshots.mjs ]` → FOUND
- `[ -x .planning/closure/audit-mobile.sh ]` → FOUND (executable bit set)
- `git log --oneline | grep -q 2e887ba` → FOUND
- `.gitignore` contains both ignore lines + MANIFEST un-ignore → FOUND
- Working tree clean post-commit → CONFIRMED
