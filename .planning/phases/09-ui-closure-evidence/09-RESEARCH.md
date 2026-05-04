# Phase 9: UI Closure Evidence — Research

**Researched:** 2026-05-04
**Domain:** Static-site UI audit harness (Lighthouse mobile + Playwright breakpoint matrix) + design-system reconciliation ADR
**Confidence:** HIGH

## Summary

Phase 9 is an audit-and-document phase, not a code-change phase. Three closure artifacts must be produced against **production** (`https://polls.wtcsmapban.com`): a UIDN-04 reconciliation (writing-only — `new-york` is canonical because that's what `components.json` declares and what was shipped), a UIDN-02 mobile evidence file (Lighthouse mobile audit on 5 routes + 6-width screenshot matrix on 5 unauth routes plus 2 authenticated `/admin/*` sub-routes via Phase 8 fixture), and a UIDN-03 shadcn-consistency evidence file (12-item per-route checklist re-keyed against the `new-york` preset).

The harness lives under `.planning/closure/` as two standalone scripts (`audit-mobile.sh` for Lighthouse, `audit-screenshots.mjs` for Playwright). No `package.json` script wiring — these are milestone artifacts, not permanent build targets (Phase 7/8 precedent). All scripts MUST encode the route list / threshold list / breakpoint list as a top-of-file data block so re-runs require zero editing.

**Primary recommendation:** Sequence the work as UIDN-04 (atomic ADR + 2-surface flip + CLAUDE.md regenerate) → UIDN-02 (Lighthouse + screenshots in parallel) → UIDN-03 (12-item checklist citing the now-canonical preset) → PROJECT.md Key Decisions flip → phase close. The audit harness is re-runnable but the v1.1 obligation is one prod run, JSON+HTML+PNG artifacts checked into `.planning/closure/artifacts/`, sign-off lines dated.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**UIDN-04 — shadcn style canonicality:**
- **D-01:** `new-york` is canonical. Rationale: components shipped against `new-york` per `components.json`; documentation surfaces (DESIGN-SYSTEM.md, PROJECT.md Constraints) were aspirational. Aligns with v1.1-MOBILE-AUDIT.md § Open questions #1.
- **D-02:** UIDN-04 ADR pass updates **both** losing surfaces atomically: `.planning/DESIGN-SYSTEM.md` UI framework `Style:` line flips Maia → new-york AND `.planning/PROJECT.md` Constraints "shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font" line flips Maia → new-york. ADR-style note appended to `.planning/DESIGN-SYSTEM.md` documenting the discrepancy, the decision (new-york wins because shipped), and the no-restyle scope guard. Single atomic commit.

**UIDN-02 + UIDN-03 — audit target & runner:**
- **D-03:** Audit target is **production only** (`https://polls.wtcsmapban.com`). No deploy preview, no `npm run preview`. Re-runs on UI changes are out of scope.
- **D-04:** Audit harness lives under `.planning/closure/` as standalone scripts: `.planning/closure/audit-mobile.sh` (Lighthouse) and `.planning/closure/audit-screenshots.mjs` (Playwright). No `package.json` scripts.
- **D-05:** Lighthouse route set = 5 routes: `/`, `/topics`, `/archive`, `/auth/error`, `/admin`. Sub-routes `/admin/suggestions/new` and `/admin/suggestions/$id/edit` covered via screenshot+checklist only.
- **D-06:** `/admin` Lighthouse runs **as guest** — captures redirect-to-login. Authenticated `/admin*` screenshots reuse Phase 8 Playwright auth fixture / storage state from `e2e/helpers/auth.ts`.

**UIDN-03 — checklist content:**
- **D-07:** Researcher drafts the 12 checklist items from `.planning/research/v1.1-MOBILE-AUDIT.md § shadcn Maia/Neutral compliance checklist`, **re-keyed against the new-york canonical preset**. Planner reviews and locks. (Drafted in this RESEARCH.md, § "12-item shadcn checklist (UIDN-03, re-keyed to new-york)".)

### Claude's Discretion
- Exact internals of `audit-mobile.sh` and `audit-screenshots.mjs` (loop structure, output-path naming, parallelism). Constrained by D-03 + D-05.
- ADR prose / heading structure inside DESIGN-SYSTEM.md (no project ADR convention exists yet). **This research proposes a minimal ADR template.**
- Whether to also flip `CLAUDE.md` line 21 atomically with UIDN-04. **This research recommends: regenerate CLAUDE.md as part of the UIDN-04 atomic commit** — see § "CLAUDE.md disposition" below for the evidence trail.
- Wave ordering and commit cadence. Required: UIDN-04 → UIDN-02 (parallel) → UIDN-03.
- Sign-off line wording. **This research proposes a concrete template** in § "Sign-off line template".

### Deferred Ideas (OUT OF SCOPE)
- Lighthouse CI (LHCI) in GitHub Actions — v1.2 candidate.
- Lighthouse coverage of authenticated `/admin/*` sub-routes — defer to v1.2 LHCI work where session handling is first-class.
- Component restyle / preset migration to a different shadcn preset — explicit ROADMAP SC #5 scope guard.
- Real `prefers-color-scheme: dark` parity audit — touched by checklist but a deeper dark-mode audit is v1.2 polish.
- Project-wide ADR convention skill — Phase 10 / v1.2 docs task.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UIDN-04 | shadcn style canonicality investigated and reconciled — `components.json` declares `"new-york"` while DESIGN-SYSTEM.md and PROJECT.md Constraints claim Maia. Output: ADR-style note appended to DESIGN-SYSTEM.md. **Blocks UIDN-03.** | § "UIDN-04 reconciliation surfaces" + § "ADR template" + § "CLAUDE.md disposition" |
| UIDN-02 | Mobile-first responsive design closure evidence — Lighthouse mobile audit (Perf≥90 / A11y≥95 / BP≥95 / SEO≥90) + 6-width breakpoint matrix (320/375/414/768/1024/1440) on top-level routes. Output: `.planning/closure/UIDN-02-mobile-evidence.md`. | § "Lighthouse audit harness" + § "Playwright screenshot harness" + § "UIDN-02 evidence file structure" |
| UIDN-03 | shadcn polish closure evidence — 12-item per-route consistency checklist applied across all top-level routes. Output: `.planning/closure/UIDN-03-shadcn-audit.md`. **Blocked on UIDN-04.** | § "12-item shadcn checklist (UIDN-03, re-keyed to new-york)" + § "UIDN-03 evidence file structure" |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lighthouse mobile audit (perf/a11y/bp/seo metrics) | External tool (Lighthouse CLI) against prod CDN | — | Synthetic Chrome run against deployed bundle; no app code touch. |
| Breakpoint screenshot capture | External tool (Playwright) against prod CDN | Phase 8 auth fixture for `/admin/*` | Headless Chrome resize loop; auth-state for protected routes reuses existing fixture infra. |
| 12-item shadcn checklist execution | Human review against rendered prod UI | grep against `src/` for token usage | Mostly visual + grep; no automated runner. Each item PASS/FAIL/N/A per route. |
| UIDN-04 reconciliation (Maia → new-york) | Documentation-only (planning + project root) | — | Three text files: DESIGN-SYSTEM.md, PROJECT.md, CLAUDE.md (regenerated). No `src/` or `components.json` change. |
| Closure-evidence artifacts archive | Filesystem under `.planning/closure/` | git (committed alongside files) | Phase 7 precedent; artifacts/ directory is the source of truth for the audit run. |
| PROJECT.md Key Decisions table flip | Documentation-only, atomic with closure files landing | — | Two rows flip ⚠️ → ✓ once both UIDN-02 and UIDN-03 evidence is signed off. |

**Tier discipline note:** Phase 9 touches **zero** application source files. Anything that would require editing `src/`, `components.json`, `vite.config.ts`, or DB migrations is by definition out of scope (the no-restyle scope guard from ROADMAP SC #5). If the planner finds themselves writing a task that touches those paths, the task belongs in v1.2 or is misplaced.

## Standard Stack

### Core (verified available)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `lighthouse` (CLI) | 13.2.0 (latest, verified via `npx -y lighthouse@latest --version` 2026-05-04) | Mobile audit — Perf/A11y/BP/SEO + LCP/TBT/CLS | Google-maintained reference implementation; this is the tool the score targets are defined against. `[VERIFIED: npx]` |
| `@playwright/test` | 1.59.1 (already in devDeps, verified `npx playwright --version` 2026-05-04) | Headless Chromium for screenshot matrix; reuses Phase 8 fixtures | Already a project dependency from Phase 5 onward. Re-using vs adding `puppeteer` avoids a new devDep. `[VERIFIED: package.json + npx]` |
| Node.js | v24.14.0 (verified) | Runtime for `audit-screenshots.mjs` | Project default. `[VERIFIED: node --version]` |

### Supporting (no install needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Bash 4+ | system default | `audit-mobile.sh` — loop over 5 routes, invoke `npx lighthouse`, write JSON+HTML | Already on macOS (3.2 ships, but the script doesn't need anything beyond POSIX sh + arrays — verified syntax stays compatible) `[VERIFIED: shell available]` |
| `npx` | bundled with npm | Resolves `lighthouse@latest` on demand without a permanent devDep | Phase 7 closure precedent — `lighthouse` is a one-off audit tool, not a build dep `[CITED: v1.1-MOBILE-AUDIT.md § Lighthouse audit setup]` |
| Chrome / Chromium | system or Playwright-bundled | Lighthouse needs a Chrome binary; `--chrome-flags="--headless=new --no-sandbox"` works against the system Chrome on macOS | If system Chrome missing, Lighthouse will surface a clear error; fallback is Playwright's bundled chromium via `CHROME_PATH=$(npx playwright path chromium)` `[CITED: lighthouse --help output]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Standalone bash + node scripts | `package.json` scripts (`npm run audit:mobile`) | Locked out by D-04 — milestone artifact, not permanent build target. Decided. |
| `lighthouse@latest` (`npx`) | Add `lighthouse` to devDependencies | Adds a permanent dep for a one-off audit; honors $0/devDep-bloat constraint by staying out of the lockfile. Decided. |
| Playwright resize loop | Chrome DevTools manual capture | Manual is not re-runnable; Playwright already in devDeps and Phase 8 fixture exists. Decided. |
| Playwright chromium | Puppeteer | Would add a new dep for nothing. Reject. |
| Bash + Node split | Single Node script for both | Bash handles `lighthouse` CLI invocation idiomatically (output redirection, exit-code aggregation); Node handles Playwright's API. Two-script split mirrors the underlying tooling. |

**Installation:** Nothing to install. `lighthouse` resolves via `npx`; Playwright is already a devDep.

**Version verification (2026-05-04):**
- `lighthouse 13.2.0` — `npx -y lighthouse@latest --version` `[VERIFIED]`
- `@playwright/test 1.59.1` — `npx playwright --version` (matches package.json) `[VERIFIED]`
- `node v24.14.0` — `node --version` `[VERIFIED]`

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────┐
│ .planning/closure/       │
│   audit-mobile.sh        │  (data block: ROUTES, THRESHOLDS, BASE_URL)
│   audit-screenshots.mjs  │  (data block: ROUTES, BREAKPOINTS, AUTH_ROUTES)
└────────────┬─────────────┘
             │ invokes
             ▼
   ┌─────────────────────────┐         ┌────────────────────────────┐
   │ npx lighthouse@latest   │         │ Playwright (chromium)      │
   │ --form-factor=mobile    │         │ resize loop × 6 widths     │
   │ --output=html,json      │         │ × 7 routes                  │
   └────────────┬────────────┘         └────────────┬───────────────┘
                │                                    │
                │ HTTP                               │ HTTP
                ▼                                    ▼
        ┌──────────────────────────────────────────────────┐
        │  https://polls.wtcsmapban.com  (Netlify CDN)     │
        │  /, /topics, /archive, /auth/error, /admin       │
        │  (auth: /admin/suggestions/new, .../$id/edit)    │
        └──────────────────────────────────────────────────┘
                │                                    │
                │ JSON + HTML reports                │ PNG files
                ▼                                    ▼
        ┌──────────────────────────────────────────────────┐
        │  .planning/closure/artifacts/                    │
        │    lh-mobile-<route>.report.{html,json}          │
        │    bp-<width>-<route>.png                        │
        └──────────────────────────────────────────────────┘
                │                                    │
                └──────────────────┬─────────────────┘
                                   │ referenced from
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │  .planning/closure/UIDN-02-mobile-evidence.md    │
        │  .planning/closure/UIDN-03-shadcn-audit.md       │
        │  (dated sign-off line at bottom)                 │
        └──────────────────────────────────────────────────┘
                                   │ flips
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │  .planning/PROJECT.md § Key Decisions            │
        │  Mobile-first ⚠️ Revisit → ✓ Good                │
        │  shadcn/ui Maia/Neutral ⚠️ Revisit → ✓ Good      │
        └──────────────────────────────────────────────────┘
```

### Recommended `.planning/closure/` Layout

```
.planning/closure/
├── OBSV-02-bundle-delta.md          # Phase 7 (existing) — analog
├── UIDN-02-mobile-evidence.md       # Phase 9 (new)
├── UIDN-03-shadcn-audit.md          # Phase 9 (new)
├── audit-mobile.sh                  # Phase 9 (new) — Lighthouse harness
├── audit-screenshots.mjs            # Phase 9 (new) — Playwright harness
└── artifacts/
    ├── lh-mobile-home.report.html
    ├── lh-mobile-home.report.json
    ├── lh-mobile-topics.report.html
    ├── lh-mobile-topics.report.json
    ├── lh-mobile-archive.report.html
    ├── lh-mobile-archive.report.json
    ├── lh-mobile-auth-error.report.html
    ├── lh-mobile-auth-error.report.json
    ├── lh-mobile-admin.report.html       # guest-redirect capture
    ├── lh-mobile-admin.report.json
    ├── bp-320-home.png
    ├── bp-320-topics.png
    ├── …                                  # 6 widths × 7 routes = 42 PNGs
    ├── bp-1440-admin-suggestions-new.png  # auth-required, via fixture
    └── bp-1440-admin-suggestions-id-edit.png
```

**Component responsibility:**

| File | Responsibility |
|------|----------------|
| `audit-mobile.sh` | Loop over 5 Lighthouse routes; one `npx lighthouse` per route; write `.report.html` + `.report.json` per route; print PASS/FAIL summary against thresholds; non-zero exit if any route falls below thresholds (does NOT fail-fast — collect all, exit at end). |
| `audit-screenshots.mjs` | Two passes: (1) unauth pass — single browser context, 6 widths × 5 unauth routes = 30 PNGs; (2) auth pass — second context with `loginAs` fixture style, 6 widths × 2 auth sub-routes = 12 PNGs. Total 42 PNGs. |
| `UIDN-02-mobile-evidence.md` | Renders Lighthouse score table + breakpoint matrix table referencing PNG artifact paths + sign-off. |
| `UIDN-03-shadcn-audit.md` | Renders 12-item × 7-route checklist + drift findings list + light/dark screenshot references + sign-off. |

### Pattern 1: Top-of-file data block (re-runnability)

**What:** All routes, thresholds, breakpoints, base URL declared at the top of each script. No CLI flag parsing; no env-var pivots; one source of truth per script.

**When to use:** Every audit script in this phase.

**Example (`audit-mobile.sh`):**
```bash
#!/usr/bin/env bash
# .planning/closure/audit-mobile.sh — UIDN-02 Lighthouse harness
# Re-runnable: edit BASE_URL/ROUTES/THRESHOLDS below; nothing else.
set -uo pipefail   # NOT -e — we want all routes to run even if one fails

BASE_URL="https://polls.wtcsmapban.com"
ROUTES=( "/" "/topics" "/archive" "/auth/error" "/admin" )
ROUTE_NAMES=( "home" "topics" "archive" "auth-error" "admin" )  # for filenames
THRESHOLD_PERF=90
THRESHOLD_A11Y=95
THRESHOLD_BP=95
THRESHOLD_SEO=90
ARTIFACTS_DIR=".planning/closure/artifacts"

mkdir -p "$ARTIFACTS_DIR"
# ... loop, invoke lighthouse, parse JSON, accumulate failures ...
```

**Example (`audit-screenshots.mjs`):**
```javascript
// .planning/closure/audit-screenshots.mjs — UIDN-02 + UIDN-03 screenshot harness
// Re-runnable: edit BASE_URL/ROUTES/BREAKPOINTS below; nothing else.
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE_URL = 'https://polls.wtcsmapban.com'
const BREAKPOINTS = [320, 375, 414, 768, 1024, 1440]
const UNAUTH_ROUTES = [
  { path: '/',           name: 'home' },
  { path: '/topics',     name: 'topics' },
  { path: '/archive',    name: 'archive' },
  { path: '/auth/error', name: 'auth-error' },
  { path: '/admin',      name: 'admin' },              // captures redirect
]
const AUTH_ROUTES = [
  { path: '/admin/suggestions/new', name: 'admin-suggestions-new' },
  // Open Q #1 RESOLUTION: hardcode the fixture UUID — the `[E2E SMOKE]` poll seeded by
  // e2e/fixtures/seed.sql:120-140 (id 'd0000000-0000-0000-0000-000000000001'). The auth
  // pass runs against local preview, so the fixture row is reachable via the seeded admin.
  { path: '/admin/suggestions/d0000000-0000-0000-0000-000000000001/edit', name: 'admin-suggestions-id-edit' },
]
const ARTIFACTS_DIR = '.planning/closure/artifacts'
// ... two passes, write `${ARTIFACTS_DIR}/bp-${width}-${name}.png` ...
```

### Pattern 2: Two-pass Playwright (unauth then auth)

**What:** Run unauth routes with a vanilla browser context; run auth routes with a context seeded by Phase 8's `loginAs` storage-state pattern.

**When to use:** When the route set splits cleanly between guest-accessible and login-gated.

**Constraint (verified):** Phase 8's `loginAs(page, fixtureUserId)` works against **local Supabase** (uses `VITE_SUPABASE_URL` defaulting to `http://localhost:54321` and a fixture password). It mints a session via `signInWithPassword` against fixture users seeded in `e2e/fixtures/seed.sql`. **It will NOT work against production** because (a) production users are real Discord OAuth (no `signInWithPassword`), (b) production has no fixture seed.

**Resolution for Phase 9 auth screenshots:** Two viable options — planner picks:

1. **Option A — local-prod hybrid:** Run the unauth pass against production (the audit target). For the auth pass, run `npm run dev` or `npm run preview` locally with `VITE_SUPABASE_URL` pointed at local Supabase, use Phase 8 `loginAs` to mint a session, capture `/admin/suggestions/new` and `.../edit` screenshots. Document that the auth screenshots are local-build (not prod) in the UIDN-02 evidence file. **Reasoning:** auth-gated UI rendering does not differ between local-build and prod-build for this app — same Vite bundle, same tokens, same components — and capturing it locally avoids requiring a prod admin login. Caveat: data-driven CSS (e.g. truncation at content-length boundaries) may differ; flag in evidence.

2. **Option B — manual prod login + storage state export:** Manually log into prod with the maintainer's admin Discord account; export `localStorage` (the `sb-<ref>-auth-token` key) via DevTools; write it into a Playwright `storageState` JSON; the script loads that state on the auth pass. Captures real prod data. Requires one human step (login + token export) per run. **Phase 8 D-06 chose this pattern** ("Authenticated `/admin*` screenshot capture uses the existing Phase 8 Playwright auth fixture / storage state from `e2e/helpers/auth.ts`").

**RECOMMENDATION:** Option A — local-build for auth screenshots, document that explicitly in the evidence file. CONTEXT.md D-06 references "the existing Phase 8 Playwright auth fixture / storage state" but the fixture is local-only by construction; the realistic interpretation is "use the same fixture mechanism, against local". The marginal value of true-prod auth screenshots is low for a polish audit, and the operational cost (manual login + token export) is high. `[ASSUMED]` — flag for planner/discuss confirmation if Option B is preferred.

### Pattern 3: Lighthouse — guest run captures redirect

**What:** Running Lighthouse on `/admin` without a session captures the redirect-to-login experience as the audit subject. That IS the experience for an unauthenticated visitor.

**When to use:** D-06 mandates this for `/admin`. No `--extra-headers` session injection in this phase.

**Output expectation:** The `/admin` Lighthouse report will show whatever `/admin` redirects to (likely `/auth/error` or a login surface). Score it like any other route. If the redirect target is `/auth/error`, this row may double-up with the standalone `/auth/error` row — that's fine; document the redirect chain in the evidence file's notes column.

### Anti-Patterns to Avoid

- **Hand-rolling a screenshot tool** with `puppeteer` when Playwright is already a devDep. Don't do it.
- **Adding `lighthouse` to `devDependencies`** for a one-off audit. Use `npx -y lighthouse@latest`.
- **Adding `package.json` scripts** like `"audit:mobile"`. D-04 explicitly forbids — these are milestone artifacts, not build targets.
- **Writing artifacts under `dist/` or `public/`** — they go to `.planning/closure/artifacts/` (Phase 7 + Phase 8 precedent + cross-cutting decision in v1.1-SUMMARY.md).
- **Editing `components.json`** in UIDN-04 — the file IS the canonical truth (`new-york`); the docs were aspirational. Editing it would be a restyle, which is out of scope (ROADMAP SC #5). Read-only.
- **Editing `src/index.css`** in UIDN-04 — same reason. Tokens are already neutral-baseColor and unchanged across new-york vs maia (style affects component visual recipe, not the token set). Read-only.
- **Failing fast on first Lighthouse failure.** Run all 5 routes, accumulate, exit non-zero at end. Audits are diagnostic; partial data is more useful than zero data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mobile perf/a11y/bp/seo audit | Custom Chrome DevTools Protocol script | `lighthouse` CLI | Lighthouse IS the score target; rolling your own scoring is meaningless. |
| Headless screenshot loop | Custom Puppeteer install | Playwright (already devDep) | Phase 8 already proved Playwright; reuse. |
| Auth state injection | Re-implement OAuth callback flow | Phase 8 `e2e/helpers/auth.ts` `loginAs` (with Option A above) | Already debugged in Phase 5; new bugs cost weeks. |
| Lighthouse threshold parsing | Hand-grep JSON for category scores | `jq '.categories.performance.score'` on Lighthouse's output JSON | Stable, documented JSON shape. |
| ADR storage | Separate `adr/` directory + custom format | Inline append to DESIGN-SYSTEM.md (D-02) | First ADR — establish minimal convention, defer adr-tools-style infra to v1.2. |
| Closure file structure | New custom layout | Copy OBSV-02-bundle-delta.md (Phase 7 analog) | Established pattern; consistency = audit hygiene. |

**Key insight:** This phase is *almost entirely* tool-orchestration + writing. The only "code" written is glue — bash to loop over routes, JS to loop over breakpoints. Anything beyond glue is creep.

## Runtime State Inventory

> Phase 9 is documentation-and-audit only. No rename, no migration, no string-replacement that could leave stale runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by reviewing scope (audit only, no DB or storage writes). | None |
| Live service config | None — verified by D-04 (no package.json scripts; no Netlify config edits; no env var changes). | None |
| OS-registered state | None — no daemons, cron jobs, or Task Scheduler entries created. | None |
| Secrets/env vars | None — Lighthouse needs no auth; Playwright auth pass uses local Supabase env vars (already documented in `e2e/helpers/auth.ts`); no new secrets. | None |
| Build artifacts | None — Phase 9 produces no built artifacts (no `npm run build`); produced artifacts (`.planning/closure/artifacts/*.{html,json,png}`) are static files committed to git, not built outputs. | None |

**Net:** Pure docs + standalone scripts. Greenfield-from-runtime perspective.

## Common Pitfalls

### Pitfall 1: Lighthouse score variance run-to-run

**What goes wrong:** Lighthouse scores fluctuate ±5–10 points between runs on the same page due to network, CPU, and Chrome state. A single run that hits 87/90/Perf could pass on the next run.

**Why it happens:** Synthetic Chrome runs measure real timing; nothing is deterministic.

**How to avoid:** For closure evidence, run each route ONCE — that's the v1.1 obligation. If a route falls under threshold, document the score, the gap, and a one-line rationale (e.g., "Perf 87 at 2026-05-04 14:30 UTC; LCP=2.7s due to Discord avatar CDN; D-14 ship-anyway analog applies — no perf budget defined yet, defer optimization to v1.2"). The closure file is a *snapshot*, not a guarantee.

**Warning signs:** A surprising failure on a small route. Re-run once locally to see if it's variance vs a real regression. If still failing, document and ship.

**Reference:** Phase 7 OBSV-02 used a "ship-anyway with documented overage" policy (D-14) — same shape applies here if perf falls 1–3 points short.

### Pitfall 2: `lighthouse` CLI flag drift between major versions

**What goes wrong:** v1.1-MOBILE-AUDIT.md cites `--screen-emulation.mobile=true` (kebab-case dotted form). Lighthouse 13.2.0's `--help` output uses `--screenEmulation` (camelCase) for the parent and dotted-camel for sub-flags (e.g. `--screenEmulation.mobile`).

**Why it happens:** Lighthouse moved between yargs flag styles around v11→v12.

**How to avoid:** Use the documented form **for the version you actually invoke**. For v13.2.0, `--screenEmulation.mobile` (camel parent + dotted-camel child) is correct. Better: use `--form-factor=mobile` alone — that auto-sets sensible mobile screen emulation defaults. The minimal incantation is:

```bash
npx -y lighthouse@latest "$BASE_URL$ROUTE" \
  --form-factor=mobile \
  --throttling-method=simulate \
  --only-categories=performance,accessibility,best-practices,seo \
  --chrome-flags="--headless=new --no-sandbox" \
  --output=html --output=json \
  --output-path="$ARTIFACTS_DIR/lh-mobile-${ROUTE_NAME}"
```

`--form-factor=mobile` implies a sane `--screenEmulation` default for v13.2.0. `[VERIFIED: lighthouse 13.2.0 --help, 2026-05-04]`

### Pitfall 3: Lighthouse output-path file naming

**What goes wrong:** `--output-path=foo --output=html --output=json` produces `foo.report.html` and `foo.report.json` (Lighthouse appends `.report.<ext>`). Easy to mis-document the artifact paths.

**Why it happens:** The CLI appends `.report.<ext>` automatically when multiple outputs are requested.

**How to avoid:** In the evidence file, reference `artifacts/lh-mobile-home.report.html` (with `.report.`) — verified against Lighthouse 13.2.0 `--help` text. Single-output mode behaves differently; we use multi-output. `[VERIFIED: --output-path help text]`

### Pitfall 4: Playwright `page.setViewportSize` doesn't trigger media query re-evaluation reliably across all routes

**What goes wrong:** Resizing the viewport mid-navigation can race with React render; some Tailwind responsive utilities don't re-apply until a real layout pass.

**Why it happens:** `setViewportSize` triggers a layout, but React's render cycle may have already painted pre-resize.

**How to avoid:** Either (a) create a fresh browser context with a fixed `viewport` per breakpoint+route combination (heavy, but bulletproof), or (b) call `page.setViewportSize` THEN `page.goto(url)` in that order so navigation happens after resize. **Recommend (b)** for cost efficiency:

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

`waitUntil: 'networkidle'` matters for routes that load Discord avatar images via OAuth callbacks. `[CITED: Playwright docs § page.goto options]`

### Pitfall 5: Authenticated screenshot pass fails silently in CI / unattended runs

**What goes wrong:** If Option A (local-build for auth screenshots) is chosen, the script needs `npm run dev` or `npm run preview` running on the side. Forgetting to start it produces 30+ blank PNGs.

**Why it happens:** Playwright `goto` against `http://localhost:5173` returns immediately with whatever the local server says — including a connection-refused error page.

**How to avoid:** The auth-pass section of `audit-screenshots.mjs` should `fetch(LOCAL_URL)` first and throw with a clear message if the local server isn't responding. The script is a **manual run**, not unattended — operator runs `npm run dev` in tab 1, runs the script in tab 2.

```javascript
// At top of auth pass
try {
  await fetch(LOCAL_URL, { signal: AbortSignal.timeout(2000) })
} catch {
  throw new Error(
    `Local dev server not reachable at ${LOCAL_URL}. ` +
    `Start it with \`npm run dev\` (or \`npm run preview\` against a built bundle) ` +
    `before running the auth screenshot pass. See .planning/closure/UIDN-02-mobile-evidence.md § Auth screenshots.`
  )
}
```

### Pitfall 6: ADR file — first one in the project, no convention to follow

**What goes wrong:** Inventing a heavyweight ADR format (numbered files in `adr/`, MADR template, etc.) for one entry is over-engineering and creates inconsistency vs how UIDN-04 was scoped (inline append, not standalone file).

**Why it happens:** ADR-tools culture pushes formal conventions; project doesn't have any precedent.

**How to avoid:** Use the minimal 5-section template proposed below (§ "ADR template"). Append it inline to DESIGN-SYSTEM.md per D-02. If a second ADR appears later, formalize the convention in v1.2 (deferred-ideas line in CONTEXT.md anticipates this). Don't formalize a convention with N=1.

### Pitfall 7: PROJECT.md Key Decisions table flip — partial commits leave stale state

**What goes wrong:** The Mobile-first row flips when UIDN-02 lands, but UIDN-03 hasn't landed yet, so the shadcn row is still ⚠️. Or vice versa. Reader sees inconsistent state mid-phase.

**Why it happens:** Two requirements, one table; natural to want to flip rows as they close.

**How to avoid:** Two sub-options:
- **Sub-option A (atomic-per-row):** Flip Mobile-first when UIDN-02 evidence lands; flip shadcn when UIDN-03 evidence lands. Each closure file commit also flips its row. Pro: minimal lag; reader sees row state match evidence state. Con: two PROJECT.md edits.
- **Sub-option B (single phase-end flip):** Land both closure files; in a final commit, flip both rows + sign off the phase. Pro: one clean transition. Con: the closure files exist in `main` for a window while PROJECT.md still says ⚠️.

**RECOMMENDATION:** Sub-option A — atomic-per-row. Phase 7's OBSV-02-bundle-delta.md was committed atomically with the verification flip; same shape here. Planner picks final ordering. `[ASSUMED]` — minor preference; either works.

## Code Examples

### Example: `audit-mobile.sh` skeleton

```bash
#!/usr/bin/env bash
# .planning/closure/audit-mobile.sh
# UIDN-02 — Lighthouse mobile audit harness against production.
# Re-runnable: edit BASE_URL / ROUTES / THRESHOLDS below; nothing else.
# Phase 9 / v1.1 / Issue #18.

set -uo pipefail

BASE_URL="https://polls.wtcsmapban.com"
ROUTES=(       "/"     "/topics" "/archive" "/auth/error" "/admin"  )
ROUTE_NAMES=(  "home"  "topics"  "archive"  "auth-error"  "admin"   )
THRESHOLD_PERF=90
THRESHOLD_A11Y=95
THRESHOLD_BP=95
THRESHOLD_SEO=90
ARTIFACTS_DIR=".planning/closure/artifacts"

mkdir -p "$ARTIFACTS_DIR"
fail_count=0
declare -a results

for i in "${!ROUTES[@]}"; do
  route="${ROUTES[$i]}"
  name="${ROUTE_NAMES[$i]}"
  out="$ARTIFACTS_DIR/lh-mobile-${name}"

  echo ">>> Auditing ${BASE_URL}${route} -> ${out}.report.{html,json}"
  npx -y lighthouse@latest "${BASE_URL}${route}" \
    --form-factor=mobile \
    --throttling-method=simulate \
    --only-categories=performance,accessibility,best-practices,seo \
    --chrome-flags="--headless=new --no-sandbox" \
    --output=html --output=json \
    --output-path="$out" \
    --quiet || { echo "  lighthouse exited non-zero on ${route}"; fail_count=$((fail_count+1)); continue; }

  # Parse scores out of the JSON. Scores are 0..1 — multiply by 100.
  perf=$(jq -r '.categories.performance.score * 100 | floor' "${out}.report.json")
  a11y=$(jq -r '.categories.accessibility.score * 100 | floor' "${out}.report.json")
  bp=$(jq -r '.categories["best-practices"].score * 100 | floor' "${out}.report.json")
  seo=$(jq -r '.categories.seo.score * 100 | floor' "${out}.report.json")

  status="PASS"
  if [ "$perf" -lt "$THRESHOLD_PERF" ] || [ "$a11y" -lt "$THRESHOLD_A11Y" ] \
    || [ "$bp" -lt "$THRESHOLD_BP" ] || [ "$seo" -lt "$THRESHOLD_SEO" ]; then
    status="FAIL"
    fail_count=$((fail_count+1))
  fi
  results+=("${status} ${name}: P=${perf} A=${a11y} BP=${bp} SEO=${seo}")
done

echo ""
echo "=== Summary ==="
for r in "${results[@]}"; do echo "  $r"; done
echo "Failed routes: ${fail_count} / ${#ROUTES[@]}"
[ "$fail_count" -eq 0 ] || exit 1
```

`[CITED: lighthouse 13.2.0 --help; jq queries verified against typical Lighthouse JSON shape per Context7 lighthouse docs]`

### Example: `audit-screenshots.mjs` skeleton

```javascript
// .planning/closure/audit-screenshots.mjs
// UIDN-02 — Mobile breakpoint screenshot matrix harness.
// Re-runnable: edit BASE_URL / BREAKPOINTS / *_ROUTES below; nothing else.
// Phase 9 / v1.1 / Issue #18.

import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE_URL = 'https://polls.wtcsmapban.com'
const LOCAL_URL = 'http://localhost:4173'   // for auth pass (Vite preview port — Open Q #3 RESOLUTION; see comment below)
const BREAKPOINTS = [320, 375, 414, 768, 1024, 1440]
const UNAUTH_ROUTES = [
  { path: '/',           name: 'home' },
  { path: '/topics',     name: 'topics' },
  { path: '/archive',    name: 'archive' },
  { path: '/auth/error', name: 'auth-error' },
  { path: '/admin',      name: 'admin' },                // captures redirect
]
const AUTH_ROUTES = [
  { path: '/admin/suggestions/new', name: 'admin-suggestions-new' },
  // Open Q #1 RESOLUTION: hardcode the fixture UUID — `[E2E SMOKE]` poll seeded by
  // e2e/fixtures/seed.sql:120-140 ('d0000000-0000-0000-0000-000000000001').
  { path: '/admin/suggestions/d0000000-0000-0000-0000-000000000001/edit', name: 'admin-suggestions-id-edit' },
]
const ARTIFACTS_DIR = '.planning/closure/artifacts'

await mkdir(ARTIFACTS_DIR, { recursive: true })
const browser = await chromium.launch({ headless: true })

// === Pass 1: unauth routes against PRODUCTION ===
{
  const context = await browser.newContext()
  const page = await context.newPage()
  for (const width of BREAKPOINTS) {
    await page.setViewportSize({ width, height: 800 })
    for (const route of UNAUTH_ROUTES) {
      const url = `${BASE_URL}${route.path}`
      console.log(`[unauth] ${width}px ${url}`)
      await page.goto(url, { waitUntil: 'networkidle' })
      await page.screenshot({
        path: `${ARTIFACTS_DIR}/bp-${width}-${route.name}.png`,
        fullPage: true,
      })
    }
  }
  await context.close()
}

// === Pass 2: auth routes against LOCAL BUILD (preview or dev) ===
// See pitfall 5 — start `npm run preview` (or `npm run dev`) before running this pass.
// See § Pattern 2 Option A — auth screenshots are local-build, documented in evidence file.
{
  // Sanity: probe local server.
  try {
    await fetch(LOCAL_URL, { signal: AbortSignal.timeout(2000) })
  } catch {
    throw new Error(
      `Local server not reachable at ${LOCAL_URL}. ` +
      `Start \`npm run preview\` before the auth pass.`,
    )
  }
  // Use Phase 8's loginAs pattern: mint a local-fixture session via signInWithPassword,
  // inject into localStorage via addInitScript before any navigate.
  // See e2e/helpers/auth.ts for the canonical implementation.
  const context = await browser.newContext()
  // ... loginAs equivalent here (inline, since e2e/helpers/auth.ts is e2e-scoped TS;
  //     OR import via tsx/ts-node — planner picks; minimal: inline-rewrite ~30 LOC) ...
  const page = await context.newPage()
  for (const width of BREAKPOINTS) {
    await page.setViewportSize({ width, height: 800 })
    for (const route of AUTH_ROUTES) {
      const url = `${LOCAL_URL}${route.path}`
      console.log(`[auth] ${width}px ${url}`)
      await page.goto(url, { waitUntil: 'networkidle' })
      await page.screenshot({
        path: `${ARTIFACTS_DIR}/bp-${width}-${route.name}.png`,
        fullPage: true,
      })
    }
  }
  await context.close()
}

await browser.close()
console.log(`Wrote ${BREAKPOINTS.length * (UNAUTH_ROUTES.length + AUTH_ROUTES.length)} screenshots to ${ARTIFACTS_DIR}/`)
```

`[CITED: Playwright 1.59.1 API — chromium.launch, browser.newContext, page.setViewportSize, page.goto waitUntil, page.screenshot fullPage; matches devDeps version]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Lighthouse `--screen-emulation.mobile=true` (dotted-kebab) | `--screenEmulation.mobile` (dotted-camel) OR `--form-factor=mobile` alone | Lighthouse v12+ | Use the v13-correct form; the v1.1-MOBILE-AUDIT.md template needs minor flag-name update. Documented in Pitfall 2. |
| One-off Lighthouse runs | LHCI in CI for every PR | v1.2 candidate (LHCI server cost) | Deferred per CONTEXT.md `<deferred>`. v1.1 is one-off. |
| `Maia` style claim in docs | `new-york` style as actual config | v1.0 ship — `components.json` has shipped with `"new-york"` since Phase 1; docs were aspirational | UIDN-04 reconciles in writing. No restyle. |

**Deprecated/outdated (in our v1.1-MOBILE-AUDIT.md template):**
- `--screen-emulation.mobile=true` flag form — update to `--screenEmulation.mobile` (or drop in favor of `--form-factor=mobile` standalone). Minor; doesn't invalidate the research.

## UIDN-04 Reconciliation Surfaces

Three text surfaces flip Maia → new-york atomically:

| Surface | Line / Section | Current text | New text |
|---------|----------------|--------------|----------|
| `.planning/DESIGN-SYSTEM.md` | § UI framework (line 14) | `- **Style:** Maia (soft rounded corners, generous spacing — consumer-facing warmth)` | `- **Style:** new-york (matches \`components.json\`; canonicalized in ADR below)` |
| `.planning/PROJECT.md` | § Constraints (line 170) | `- **Design system**: shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font` | `- **Design system**: shadcn/ui new-york style, Neutral baseColor, Inter font` |
| `CLAUDE.md` | line 21 (inside `<!-- GSD:project-start source:PROJECT.md -->` block) | `- **Design system**: shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font` | regenerated from PROJECT.md (auto-derived block — see § "CLAUDE.md disposition") |

**Read-only ground truth — DO NOT EDIT in this phase:**
- `components.json` — already declares `"style": "new-york", "tailwind.baseColor": "neutral"`. Read-only.
- `src/index.css` — Neutral token set already present (`:root` and `.dark` blocks). Read-only.
- `src/components/ui/*` — already shipped against new-york. Read-only.

**Implication:** UIDN-04 is a **3-line edit + 1 ADR append + 1 CLAUDE.md regenerate**, all in one atomic commit per D-02.

**Note on `(bbVJxbc)`:** The current Constraints line cites a shadcn preset string `bbVJxbc`. That string was generated at Phase 1 init for a Maia variant. Since `new-york` is canonical and the preset string is no longer the source of truth (the actual config is in `components.json`), the new line drops the preset string. This is intentional and consistent with D-02 ("flip Maia → new-york"). If the planner prefers to retain a preset reference for future re-init, replace with a stub like `(see components.json)` rather than the now-stale `bbVJxbc`. `[ASSUMED]` — wording detail; planner picks.

## CLAUDE.md Disposition

**Question (CONTEXT.md Claude's Discretion):** Flip CLAUDE.md line 21 atomically with UIDN-04, or defer to Phase 10?

**Investigation:**
- CLAUDE.md uses HTML-comment markers: `<!-- GSD:project-start source:PROJECT.md -->` (line 1) and `<!-- GSD:project-end -->` (line 22). The Maia line sits **inside** this block.
- The marker syntax + `source:PROJECT.md` annotation indicates this block is auto-derived from `.planning/PROJECT.md`.
- Verified via `grep "GSD:project" /Users/khaiphan/.claude/get-shit-done/bin/gsd-tools.cjs` — the gsd-tools binary has a `generate-claude-md` command (line 924).
- Workflow file at `~/.claude/get-shit-done/workflows/profile-user.md` and template at `~/.claude/get-shit-done/templates/claude-md.md` confirm a regenerator exists.

**Conclusion:** CLAUDE.md is **regenerated from PROJECT.md**. Editing CLAUDE.md by hand will be overwritten on the next regen.

**RECOMMENDATION:** Atomic with UIDN-04 — but via **regeneration**, not manual edit. The atomic UIDN-04 commit is:
1. Edit `.planning/DESIGN-SYSTEM.md` Style line + append ADR.
2. Edit `.planning/PROJECT.md` Constraints line.
3. Run `gsd-sdk` (or equivalent) to regenerate CLAUDE.md from the updated PROJECT.md. (Planner: confirm exact command — likely `node ~/.claude/get-shit-done/bin/gsd-tools.cjs generate-claude-md` or via a `/gsd-*` slash command.)
4. `git add` all four files; commit with message `docs(09): UIDN-04 reconcile shadcn style — Maia → new-york canonical`.

**Why atomic and not Phase 10:** Phase 10 owns DOCS-01..04 (planning hygiene backfill on phases 01–04), and CONTEXT.md `<out_of_scope>` says "Phase 9 must not touch phases 01–04 directories." CLAUDE.md is at repo root, not under `.planning/phases/01..04/`. It belongs to the same logical edit as PROJECT.md — they're the same content via auto-derivation. Splitting them across phases creates a window where CLAUDE.md (read by every Claude Code session) contradicts PROJECT.md.

`[VERIFIED: HTML comment markers + gsd-tools.cjs source]`

## ADR Template (proposed)

> No prior project ADR convention exists. Researcher proposes the minimal industry-standard 5-section shape. If the planner agrees, append the following block at the end of `.planning/DESIGN-SYSTEM.md`. **This template is the proposed format for ALL future project ADRs** unless a heavier convention is later adopted (see CONTEXT.md `<deferred>` — Phase 10 / v1.2 task).

```markdown
---

## ADR-001: shadcn style canonicalized as `new-york`

**Date:** 2026-05-DD (planner fills in commit date)
**Status:** Accepted
**Phase:** 9 (UIDN-04)
**GitHub:** Issue #18

### Context

`components.json` declared `"style": "new-york"` from Phase 1 init (2026-04-XX). DESIGN-SYSTEM.md and PROJECT.md Constraints both stated "Maia". Components were shipped (Phases 1–4) against the `new-york` recipe — buttons, cards, inputs, dialogs, sheets — and the v1.0 launch on 2026-04-28 was on the `new-york` build. The Maia claim in docs was aspirational and never matched the shipped artifact.

### Decision

`new-york` is the canonical shadcn style for this project. The two losing surfaces (DESIGN-SYSTEM.md `Style:` line and PROJECT.md Constraints) are updated to match. CLAUDE.md is regenerated from PROJECT.md.

### Reasoning

1. Components are already shipped against `new-york` per `components.json` (read-only ground truth).
2. Restyling to Maia would mean re-running `npx shadcn-ui init --style maia` and replacing every component file in `src/components/ui/` — out of scope per ROADMAP SC #5 (no preset migration in v1.1) and per `<deferred>` in CONTEXT.md.
3. The Neutral baseColor + token set is unaffected (style affects component visual recipe — borders, shadows, radius defaults — not the color tokens). Aligns with `src/index.css` `:root` / `.dark` blocks which are valid under either style.
4. Auditing in a different state from what's shipped would invalidate the UIDN-03 closure evidence on first inspection. Reconcile-then-audit is the only honest sequence.

### Consequences

- DESIGN-SYSTEM.md and PROJECT.md now match `components.json`. CLAUDE.md auto-derivation regenerates correctly.
- UIDN-03's 12-item per-route checklist is keyed to `new-york` defaults: `rounded-md` for inputs/buttons, `rounded-lg` for cards/sheets/dialogs (new-york's slightly more conservative radius vs Maia's generous warmth — see § "12-item shadcn checklist").
- Future contributors reading docs see the actual config; surprise gap closed.
- No code change; no user-visible UI change; no token change.
- Establishes a minimal ADR convention for the project (5-section: Context / Decision / Reasoning / Consequences / Date+Status). Heavier ADR tooling is deferred (CONTEXT.md `<deferred>`).
```

**Format rationale:** 5 sections (Context / Decision / Reasoning / Consequences / metadata) is the industry-standard ADR shape (Michael Nygard 2011, MADR template). Inline append (vs separate `adr/0001-*.md` file) is consistent with D-02 ("ADR-style note appended to DESIGN-SYSTEM.md"). Numbering as ADR-001 leaves room for ADR-002+ later without retro-renaming.

`[CITED: industry-standard ADR shape — Nygard 2011; MADR https://adr.github.io/madr/]`

## Sign-off Line Template (proposed)

CONTEXT.md says "research suggests dated sign-off; exact phrasing is open." Phase 7's OBSV-02-bundle-delta.md ended with a 3-line `_italics_` block:

```
_Measured: 2026-04-30T09:48:00Z_
_Method: 3-way same-session git-worktree comparison; …_
_Disposition: SHIP with keepNames enabled — D-14 ship-anyway policy applied; observability gain accepted_
```

**Recommended template for UIDN-02 / UIDN-03 closure files:**

```markdown
---

## Sign-off

**Audited:** 2026-05-DD (production at https://polls.wtcsmapban.com)
**Method:** Lighthouse 13.2.0 mobile audit (5 routes) + Playwright 1.59.1 6-width screenshot matrix (42 PNGs); see `audit-mobile.sh` and `audit-screenshots.mjs` for re-run.
**Disposition:** UIDN-02 closed — `Mobile-first responsive design` flips ⚠️ Revisit → ✓ Good in PROJECT.md Key Decisions.
**Reviewer:** <Discord handle / GitHub handle>
```

For UIDN-03, swap the second line for the checklist+method, the third for the shadcn flip:

```markdown
**Method:** 12-item per-route shadcn-consistency checklist (new-york preset, Neutral baseColor) across 5 unauth + 2 auth `/admin/*` routes; ripgrep confirms zero raw-color drift in `src/`.
**Disposition:** UIDN-03 closed — `shadcn/ui + Tailwind CSS v4 (Maia/Neutral)` flips ⚠️ Revisit → ✓ Good in PROJECT.md Key Decisions, citing UIDN-04 ADR (DESIGN-SYSTEM.md ADR-001) for the canonical preset.
```

The `_italics_` Phase 7 form and the bold-label `## Sign-off` form are equivalent; planner picks. The bold-label form reads more like a record entry, which suits an audit. `[ASSUMED]` — style preference; either works.

## 12-item shadcn checklist (UIDN-03, re-keyed to new-york)

Source: `.planning/research/v1.1-MOBILE-AUDIT.md § shadcn Maia/Neutral compliance checklist`. Items rewritten where Maia-specific assumptions held (specifically: radius defaults differ slightly between Maia and new-york). Items 1, 3–7, 9–12 are preset-agnostic (token/spacing/composition rules). Items 2 and 8 are re-keyed.

Run per route. Each item PASS / FAIL / N/A with one-line note. Total = 7 routes × 12 items = 84 cells.

| # | Item (new-york canonical) | Notes / re-key delta from MOBILE-AUDIT source |
|---|---|---|
| 1 | `components.json` declares `style: "new-york"`, `tailwind.baseColor: "neutral"`, `tailwind.cssVariables: true` (verify once, not per-route). | Identical to source. Now CONFIRMED-TRUE post-UIDN-04. |
| 2 | `src/index.css` defines the full Neutral token set (`--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--card`, `--popover`, sidebar + chart vars) for both `:root` and `.dark`. **Token set is identical between Maia and new-york** — no re-key needed. | Source flagged tokens as Maia-specific; verified here that token names are preset-agnostic (style affects component recipes, not tokens). `[VERIFIED: src/index.css inspection 2026-05-04]` |
| 3 | Every surface uses `bg-background` / `text-foreground` / `bg-card` / `bg-muted` — no raw `bg-white`, `bg-gray-*`, `text-black`, hex literals, or `bg-[#...]` arbitrary values. | Identical to source. Preset-agnostic. |
| 4 | All buttons render through `<Button>` from `@/components/ui/button` using documented `variant` (`default | secondary | destructive | outline | ghost | link`) and `size` props — no ad-hoc `<button className="…">`. | Identical to source. new-york's Button has the same variant set. |
| 5 | Inputs/textareas/selects/labels use `@/components/ui/{input,textarea,select,label}`; no native `<input>` styled inline. | Identical to source. Preset-agnostic. |
| 6 | Cards use `<Card>/<CardHeader>/<CardTitle>/<CardContent>`; no hand-rolled card divs with custom rounded/shadow combos. | Identical to source. Preset-agnostic. |
| 7 | Spacing uses Tailwind scale (`p-2/p-4/p-6/gap-4/space-y-6`) — flag any `p-[13px]`, `m-[27px]`, `w-[331px]` arbitrary values. | Identical to source. Preset-agnostic. |
| 8 | Radius is consistent with new-york defaults: `rounded-md` for buttons/inputs, `rounded-lg` for cards/dialogs/sheets/popovers. **new-york uses slightly more conservative radius than Maia's "generous radius" warmth** — flag any `rounded-xl`/`rounded-2xl` drift on small components, and any `rounded-sm`/`rounded-none` on cards. | RE-KEYED. Source said "Maia warmth = generous radius; verify no `rounded-sm`/`rounded-none` drift." new-york's `--radius: 0.5rem` (verified in `src/index.css`) gives `rounded-md` ≈ 6px, `rounded-lg` = 8px. Drift signal: oversized radius on buttons (e.g. `rounded-xl`) signals Maia drift; undersized on cards (e.g. `rounded-sm`) signals new-york drift. |
| 9 | Typography: Inter loaded and applied via body `font-family` (confirmed in `src/index.css`); headings use Tailwind type scale (`text-xl/2xl/3xl font-semibold`) consistently across `archive.tsx`, `topics.tsx`, `index.tsx`, admin tabs. | Identical to source. Preset-agnostic. |
| 10 | Icons come from `lucide-react` only (per `components.json` `iconLibrary: "lucide"`); sized via `h-4 w-4` / `h-5 w-5` Tailwind classes; no inline SVG one-offs in `Navbar`, `MobileNav`, kebab menus, dialogs. | Identical to source. Preset-agnostic. `iconLibrary: "lucide"` confirmed in `components.json`. `[VERIFIED]` |
| 11 | Dark-mode parity: every route renders cleanly under `.dark` (toggle via `next-themes`); contrast ≥ WCAG AA (Lighthouse `color-contrast` audit confirms). | Identical to source. Preset-agnostic; cross-references UIDN-02 Lighthouse a11y score. |
| 12 | No prop overrides that drift from preset (e.g. `<Button className="bg-blue-500">` overriding `--primary`); only layout/spacing utility additions allowed via `cn()`. | Identical to source. Preset-agnostic. |

**Drift-finding evidence shape (UIDN-03 § 3 in evidence file):**

```markdown
## 3. Drift findings + fixes
- src/components/Navbar.tsx:42 — `bg-gray-100` → `bg-muted` (item 3)
- src/components/admin/SuggestionForm.tsx:88 — `p-[13px]` → `p-3` (item 7)
- ... or: <none — all 84 cells PASS>
```

If drift items are found, the planner must decide whether they're **in-scope for v1.1 fixes** or **logged as v1.2 follow-ups**. The audit's job is to find; the fix decision is per-finding. Phase 9 doesn't pre-commit to fixing all findings (would creep into a restyle).

## State of the Art

(Already covered above in § "State of the Art" — no separate restate.)

## Assumptions Log

> Claims tagged `[ASSUMED]` in this research. The planner / discuss-phase may want to confirm before locking.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 8's `loginAs` fixture works against local Supabase only, not production — therefore auth screenshots must be local-build (Option A) or require manual prod login + storage state export (Option B). | § Pattern 2 | Low — verified by reading e2e/helpers/auth.ts; the constraint is explicit (anon-key + signInWithPassword vs Discord OAuth). Risk: if planner prefers Option B, more manual steps. |
| A2 | Sub-option A (atomic-per-row PROJECT.md flip) preferred over single phase-end flip. | § Pitfall 7 | Trivial — either is correct; preference only. |
| A3 | Drop the `(bbVJxbc)` preset string from PROJECT.md Constraints rather than retain or replace with a new-york equivalent. | § UIDN-04 reconciliation surfaces | Low — `bbVJxbc` was Maia-specific and stale. If planner wants a new-york preset string for future re-init reference, regenerate at ui.shadcn.com/themes and substitute. |
| A4 | Italics-block sign-off (Phase 7 OBSV-02 form) and bold-label `## Sign-off` form are interchangeable; recommend bold-label for audits. | § Sign-off line template | Trivial — formatting preference. |
| A5 | The planner can run `gsd-tools generate-claude-md` (or equivalent) to regenerate CLAUDE.md after PROJECT.md edits. The exact command is not verified — the gsd-tools.cjs `generate-claude-md` case at line 924 was inspected, but the runtime invocation pattern (slash command, gsd-sdk wrapper, manual node invoke) was not exhaustively probed. | § CLAUDE.md disposition | Low — the regenerator exists and the command path is known. Worst case, planner runs `node ~/.claude/get-shit-done/bin/gsd-tools.cjs generate-claude-md` directly. |
| A6 | Top-of-file data block (BASE_URL/ROUTES/THRESHOLDS/BREAKPOINTS) satisfies CONTEXT.md "soft re-runnability requirement" without needing CLI flag parsing. | § Pattern 1 | Trivial — the alternative (yargs-style flag parsing) is overkill for a 2-script harness. |
| A7 | Lighthouse score variance between runs may produce a 1–3 point gap below threshold; documenting + shipping (Phase 7 D-14 analog) is acceptable rather than re-running until thresholds pass. | § Pitfall 1 | Low — D-14 is well-precedented in this project; this is the same shape. Discuss-phase can confirm. |

## Open Questions (RESOLVED)

All four questions below were resolved during Phase 9 planning and incorporated into the plan files (09-02-PLAN.md, 09-03-PLAN.md, 09-04-PLAN.md). Recorded here for traceability.

1. **`/admin/suggestions/$id/edit` — which `$id`?** The auth-screenshot pass needs a real ID. Options: (a) seed a `[E2E]`-prefixed poll via `e2e/fixtures/seed.sql` (already in place from Phase 8) and use that ID; (b) hardcode a placeholder and edit at run time; (c) capture the admin list page first, scrape an href via Playwright, navigate to it. **Recommendation:** (a) — use a Phase 8 fixture poll ID. Planner picks final implementation in `audit-screenshots.mjs`.
   **RESOLVED:** d0000000-0000-0000-0000-000000000001 — `[E2E SMOKE]` fixture poll cited in 09-02-PLAN.md Task 2 `AUTH_ROUTES` and re-used in 09-04-PLAN.md per route table.

2. **`/admin` Lighthouse redirect target.** D-06 says guest-run captures the redirect-to-login experience. What URL does `/admin` actually redirect to in production? Likely `/auth/error` (the AdminGuard's "not signed in" path) or a `?redirectTo=/admin` flow. The Lighthouse output shows only the FINAL URL audited; the report's `requestedUrl` vs `finalDisplayedUrl` fields will document this. Note in evidence file. Not blocking — Lighthouse handles redirects by default. `[CITED: Lighthouse JSON schema — `lhr.requestedUrl` and `lhr.finalDisplayedUrl`]`
   **RESOLVED:** captured via `lhr.finalDisplayedUrl` (and `requestedUrl` for diff). 09-03-PLAN.md Task 1 step 1 emits both via `jq -r '"requested: " + .requestedUrl + "  final: " + .finalDisplayedUrl'`; the `/admin` redirect target lands in the score-table "Final URL" column and is documented in the evidence file's Lighthouse mobile scores section.

3. **Local-build identity for auth screenshots.** If Option A (local-build for auth-pass), should the script run against `npm run dev` (port 5173, fastest iteration) or `npm run preview` (port 4173, production-ish bundle)? **Recommendation:** `npm run preview` — closer to prod, deterministic. Trade-off: requires `npm run build` first. Planner: pin choice in script comments.
   **RESOLVED:** `npm run preview` (port 4173) — pinned as `LOCAL_URL = 'http://localhost:4173'` in 09-02-PLAN.md Task 2 (matches `e2e/playwright.config.ts:28` baseURL default). Pre-req checklist in 09-03-PLAN.md Task 0 `how-to-verify` step 2 calls out `npm run build && npm run preview` explicitly.

4. **What count as "PASS" for items 11 (dark mode) and 12 (prop drift)?** These are visual subjective. Recommendation: item 11 — Lighthouse `color-contrast` audit + manual eyeball. Item 12 — ripgrep for `<Button[^>]*className="[^"]*bg-(?!muted|background|card|primary|secondary|destructive|accent)`. Planner can lock these regex queries into the evidence file's method line.
   **RESOLVED:** Item 11 = Lighthouse `color-contrast` audit pass (a11y category in `lh-mobile-*.report.html`) + manual DevTools `prefers-color-scheme: dark` toggle on prod, per 09-04-PLAN.md Task 2 `how-to-verify` step 2/3. Item 12 = POSIX-ERE-safe two-stage ripgrep pipeline (no PCRE lookahead): `grep -rnE --include='*.tsx' '<Button[^>]*className="[^"]*bg-' src/components/ src/routes/ | grep -vE 'bg-(muted|background|card|primary|secondary|destructive|accent)'`. Locked into 09-04-PLAN.md Task 1 `<action>` and the closure file's Method line.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `audit-screenshots.mjs` | ✓ | v24.14.0 | — |
| npm + npx | `audit-mobile.sh` (lighthouse via npx) | ✓ | bundled | — |
| Bash | `audit-mobile.sh` | ✓ | system default (macOS 3.2+ or modern bash via brew) | — |
| `lighthouse` CLI | `audit-mobile.sh` | ✓ via `npx -y lighthouse@latest` (verified resolves to 13.2.0) | 13.2.0 | — |
| `@playwright/test` | `audit-screenshots.mjs` | ✓ devDep | 1.59.1 | — |
| Chromium (Playwright-bundled) | `audit-screenshots.mjs` | ✓ (Phase 8 already exercised) | bundled with Playwright | system Chrome via `CHROME_PATH` |
| Chrome (system, for Lighthouse) | `audit-mobile.sh` | likely ✓ on macOS dev box; not pre-verified | n/a | `CHROME_PATH=$(npx playwright path chromium)` to fall back to Playwright's chromium |
| `jq` (JSON parsing in bash) | `audit-mobile.sh` summary | likely ✓ on macOS; verify before run | n/a | If missing: `brew install jq`, OR rewrite parse step in node, OR drop the in-script summary (still get JSON files). |
| Production site | both audits | ✓ live (HTTP/2 200 verified on `/`, `/topics`, `/archive`, `/admin`, `/auth/error` 2026-05-04) | n/a | None — D-03 mandates prod. If prod down, abort and re-run later. |
| Local Supabase + `supabase start` | auth-pass screenshots only | conditional — needed only if Option A chosen | n/a | Option B (manual prod login + storage state) |

**Missing dependencies with no fallback:** None — all paths viable.

**Missing dependencies with fallback:**
- `jq` likely-missing on a fresh macOS install. Fallback documented.
- System Chrome — Lighthouse falls back to Chromium-on-PATH or Playwright's bundled chromium via `CHROME_PATH`.

## Validation Architecture

> Phase requires this section — `workflow.nyquist_validation` is enabled (no `.planning/config.json` `false` setting found in the references; treat as enabled).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — Phase 9 has no automated test suite. Validation is via artifact existence + score thresholds. |
| Config file | n/a |
| Quick run command | `bash .planning/closure/audit-mobile.sh` (Lighthouse pass) |
| Full suite command | `bash .planning/closure/audit-mobile.sh && node .planning/closure/audit-screenshots.mjs` (Lighthouse + screenshots) |

### Phase Requirements → Validation Map

| Req ID | Behavior | Validation Type | Automated Command | Manual Step |
|--------|----------|-----------------|-------------------|-------------|
| UIDN-04 | DESIGN-SYSTEM.md + PROJECT.md + CLAUDE.md all say `new-york`; ADR appended | grep | `grep -l "new-york" .planning/DESIGN-SYSTEM.md .planning/PROJECT.md CLAUDE.md && grep -l "ADR-001" .planning/DESIGN-SYSTEM.md` | Read ADR — does it cite Maia→new-york reasoning? |
| UIDN-04 | Maia is GONE from the 3 surfaces | grep | `! grep -l " Maia " .planning/DESIGN-SYSTEM.md .planning/PROJECT.md CLAUDE.md` (allow "Maia" in deferred-ideas / historical refs) | Visual review |
| UIDN-02 | Lighthouse JSON+HTML exists for each of 5 routes | filesystem | `for n in home topics archive auth-error admin; do test -f .planning/closure/artifacts/lh-mobile-$n.report.html && test -f .planning/closure/artifacts/lh-mobile-$n.report.json || exit 1; done` | — |
| UIDN-02 | All 4 thresholds pass per route, OR overage documented | jq | `audit-mobile.sh` exit 0, OR exit 1 + evidence file documents the overage with rationale | Reviewer reads documented overage |
| UIDN-02 | 6 widths × 7 routes = 42 PNGs exist | filesystem | `[ "$(find .planning/closure/artifacts/screenshots -name 'bp-*-*.png' \| wc -l \| tr -d ' ')" = "42" ]` (count assertion — replaces the earlier broken `ls /tmp \| grep MISSING` fragment) | — |
| UIDN-03 | 12-item × 7-route checklist filled (84 cells) | filesystem + grep | `grep -c "^| /" .planning/closure/UIDN-03-shadcn-audit.md` returns 7 (one row per route in the matrix table) | Reviewer reads each row |
| UIDN-03 | Drift findings list present (zero is acceptable) | grep | `grep -l "Drift findings" .planning/closure/UIDN-03-shadcn-audit.md` | — |
| UIDN-03 | Sign-off cites UIDN-04 ADR | grep | `grep -l "ADR-001" .planning/closure/UIDN-03-shadcn-audit.md` | — |
| Phase | PROJECT.md Key Decisions table flipped — Mobile-first ✓ | grep | `grep "Mobile-first responsive design" .planning/PROJECT.md \| grep "✓ Good"` | — |
| Phase | PROJECT.md Key Decisions table flipped — shadcn ✓ | grep | `grep "shadcn/ui + Tailwind" .planning/PROJECT.md \| grep "✓ Good"` | — |

### Sampling Rate

- **Per task commit:** Run the relevant grep checks for the file(s) edited (UIDN-04 atomic commit → `grep new-york` checks; closure file commits → filesystem checks).
- **Per wave merge:** Re-run the harness end-to-end against prod once.
- **Phase gate:** All grep + filesystem checks pass; both PROJECT.md rows green; both closure files end with dated sign-off line.

### Wave 0 Gaps

- [ ] `.planning/closure/audit-mobile.sh` — does not exist; Wave 1 creates it.
- [ ] `.planning/closure/audit-screenshots.mjs` — does not exist; Wave 1 creates it.
- [ ] `.planning/closure/artifacts/` — directory exists (empty); Wave 1+2 populate.
- [ ] `.planning/closure/UIDN-02-mobile-evidence.md` — does not exist; Wave 2 creates it.
- [ ] `.planning/closure/UIDN-03-shadcn-audit.md` — does not exist; Wave 3 creates it.
- [ ] No framework install needed — `lighthouse` resolves via `npx`; Playwright is already installed.

## Project Constraints (from CLAUDE.md)

| Directive | Source line | Phase 9 implication |
|-----------|-------------|----------------------|
| **GSD Workflow Enforcement** — must enter via `/gsd-execute-phase` (planned phase work). | CLAUDE.md § GSD Workflow Enforcement | Phase 9 IS planned phase work; `/gsd-execute-phase` is the entry. |
| `$0/month` budget; Netlify legacy free tier; no LHCI server. | CLAUDE.md § Constraints (line 16) | Honors D-04 (no package.json scripts; no permanent CI add). LHCI deferred to v1.2. |
| Tech stack locked: Vite + React + TS + TanStack Router + shadcn/ui + Tailwind v4. | CLAUDE.md § Constraints (line 17) | Phase 9 changes nothing in stack — confirms it (UIDN-03 audit). |
| Design system: shadcn/ui + Neutral baseColor + Inter font (style: TBD reconcile). | CLAUDE.md line 21 | UIDN-04 reconciles the style line; CLAUDE.md regenerated post-edit. |
| Source comments: WHY-only, no review-round/phase-ID archaeology in `src/`. | CLAUDE.md (per-project memory entry) | Phase 9 touches no `src/` code — rule applies to scripts under `.planning/closure/` (terse runbook-style allowed; this is `.planning/`, not `src/`). |
| Naming patterns: PascalCase components, camelCase functions, kebab-case CSS classes. | CLAUDE.md § Naming Patterns | Not applicable — no React components written. |
| TypeScript strict (`noUnusedLocals`, `verbatimModuleSyntax`, etc.). | CLAUDE.md § Code Style | `audit-screenshots.mjs` is `.mjs` (plain Node JS), not TS. No tsc compile path. If planner prefers TS, use a `.ts` + `tsx` runner; default `.mjs` keeps zero-config. |
| ESLint 9 flat config rules apply to `e2e/**/*.spec.ts`. | CLAUDE.md § ESLint | `.planning/closure/audit-screenshots.mjs` lives outside the lint glob; should be confirmed by inspecting `eslint.config.js` ignorePatterns. Worst case: add `.planning/**` to ignorePatterns or ensure no rule violations. |

## Sources

### Primary (HIGH confidence)
- `components.json` (read-only ground truth) — `style: "new-york"`, `tailwind.baseColor: "neutral"`, `iconLibrary: "lucide"`. `[VERIFIED]`
- `lighthouse@latest --help` output, version 13.2.0 — flag forms verified live 2026-05-04. `[VERIFIED via npx]`
- `@playwright/test` package.json — version 1.59.1 in devDeps. `[VERIFIED]`
- `e2e/helpers/auth.ts` — Phase 8 fixture; `loginAs` is local-Supabase only. `[VERIFIED via inspection]`
- `e2e/playwright.config.ts` — `webServer` runs `npm run build && npm run preview` locally; CI sets its own baseURL. `[VERIFIED]`
- `~/.claude/get-shit-done/bin/gsd-tools.cjs` line 924 (`generate-claude-md` case) — confirms CLAUDE.md auto-derivation. `[VERIFIED via grep + read]`
- `.planning/closure/OBSV-02-bundle-delta.md` — Phase 7 closure-file structural analog. `[VERIFIED]`
- `.planning/research/v1.1-MOBILE-AUDIT.md` — locked technical research (Lighthouse template, breakpoint matrix template, 12-item checklist source, evidence file structures). `[CITED]`
- `.planning/research/v1.1-SUMMARY.md` § Cross-Cutting Decisions — closure directory convention; LHCI deferral. `[CITED]`
- `.planning/PROJECT.md` Constraints + Key Decisions — surfaces to flip. `[CITED]`
- `.planning/DESIGN-SYSTEM.md` § UI framework — surface to flip + ADR appended. `[CITED]`
- `.planning/REQUIREMENTS.md` UIDN-02/03/04 wording. `[CITED]`
- `.planning/ROADMAP.md` § Phase 9 — Goal, Success Criteria, intra-phase ordering. `[CITED]`
- Production HTTP HEAD probes 2026-05-04 — all 5 audit routes return 200 OK on `https://polls.wtcsmapban.com`. `[VERIFIED via curl -sIL]`

### Secondary (MEDIUM confidence)
- Industry-standard ADR shape (Nygard 2011; MADR project) — informs the proposed 5-section ADR template. `[CITED]`
- Playwright `page.goto` `waitUntil` and `setViewportSize` semantics — Playwright docs (cross-referenced via Context7 in Phase 8 research). `[CITED]`

### Tertiary (LOW confidence)
- None — every actionable claim in this RESEARCH.md is verified or cited from canonical-refs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified live (lighthouse 13.2.0, playwright 1.59.1, node 24.14.0).
- Architecture (harness scripts): HIGH — patterns exist in v1.1-MOBILE-AUDIT.md and OBSV-02-bundle-delta.md; this research only adds re-runnability + auth-pass split.
- Pitfalls: HIGH — Lighthouse score variance (Pitfall 1) is well-documented; flag-name drift (Pitfall 2) verified live; Playwright resize+navigate ordering (Pitfall 4) verified against Playwright API docs.
- 12-item checklist re-key: HIGH — items 1, 3–7, 9–12 are token/composition rules unaffected by style; items 2 + 8 re-keyed against `--radius: 0.5rem` confirmed in `src/index.css`.
- CLAUDE.md disposition: HIGH — auto-derivation marker comments are explicit; gsd-tools.cjs has the regenerator.
- ADR template: MEDIUM — first ADR; format is industry-standard but no project precedent.
- Sign-off line: MEDIUM — Phase 7 precedent uses italics; recommended bold form is style preference.
- Auth-screenshot strategy (Option A vs B): MEDIUM — A1 in Assumptions Log; planner / discuss-phase confirms.

**Research date:** 2026-05-04
**Valid until:** 2026-06-03 — Lighthouse minor versions can land monthly; Playwright stays stable; production URL stable. Re-verify if not executed within 30 days.
