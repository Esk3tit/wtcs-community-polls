# Phase 7: Observability Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `07-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 7-observability-hardening
**Areas discussed:** Smoke component lifecycle, Smoke trigger gating, Verification approach, Bundle-size evidence format

---

## Smoke component lifecycle

### Q1 — Permanence

| Option | Description | Selected |
|--------|-------------|----------|
| Permanent canary (Recommended) | Keep RenderThrowSmoke + smoke route long-term — re-runnable on every release/deploy preview, catches regressions if Sentry wiring or sourcemap config breaks later. ~50 LOC + a public URL forever. | ✓ |
| Temporary, delete after evidence | Land for Phase 7 verification, then delete in follow-up. Zero permanent surface, but no future safety net. | |
| You decide | Pick whichever default for $0/mo hygiene project at v1.1 launch. | |

**User's choice:** Permanent canary
**Notes:** Treats the smoke as permanent observability infrastructure rather than one-shot evidence.

### Q2 — Route placement

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated route `/__smoke` (Recommended) | New TanStack route reads search param and renders RenderThrowSmoke when `render=1`. Isolated, predictable URL. | ✓ |
| Piggyback on `/` via query param | Read `?sentry-render-smoke=1` on root route. Matches research/roadmap literal URL but couples smoke logic to home route. | |
| Piggyback on a less-trafficked route (e.g. `/about` or 404) | Same as option 2 on quieter route. | |

**User's choice:** Dedicated route `/__smoke`
**Notes:** Isolation chosen over matching the verbatim URL from the roadmap success criteria.

### Q3 — Code-splitting

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy-load via TanStack autoCodeSplitting (Recommended) | `/__smoke` becomes its own chunk via existing `autoCodeSplitting: true`. Zero cost on home bundle. | ✓ |
| Eagerly bundle into main | Simpler. ~1KB gzip on main bundle; visible in OBSV-02 delta math. | |

**User's choice:** Lazy-load via TanStack autoCodeSplitting
**Notes:** Keeps smoke component out of the OBSV-02 bundle-size measurement entirely.

---

## Smoke trigger gating

### Q1 — Production exposure

| Option | Description | Selected |
|--------|-------------|----------|
| Env-gated: deploy-preview + dev only (Recommended) | `import.meta.env.MODE` / Netlify `CONTEXT` gate; production renders 404. Prevents drive-by Sentry pollution. Verification still works because deploy previews are also production builds. | ✓ |
| Allow on live prod too | Anyone hitting URL on live site triggers a real Sentry event. Pollutes Sentry / wastes free-tier event quota. | |
| Token-gated (URL secret) | `?token=<env-var>` matching `VITE_SMOKE_TOKEN`. More flexible, adds env-var management. | |

**User's choice:** Env-gated: deploy-preview + dev only
**Notes:** Cost of gating outweighed by Sentry-quota / abuse-resistance gain.

### Q2 — Gate implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Netlify `CONTEXT` env var via Vite define (Recommended) | `CONTEXT=deploy-preview` for PR previews, `CONTEXT=production` for live. Pipe through Vite as `VITE_NETLIFY_CONTEXT`. Single source of truth matching Netlify's docs. | ✓ |
| Custom `VITE_SMOKE_ENABLED` flag | Dedicated env var per Netlify deploy context. More explicit, new knob to forget. | |
| Hostname check at runtime | `window.location.hostname` !== `polls.wtcsmapban.com`. Brittle, runtime-only. | |

**User's choice:** Netlify `CONTEXT` env var via Vite define
**Notes:** Aligns with platform convention rather than introducing project-specific flag.

### Q3 — Blocked-response UX

| Option | Description | Selected |
|--------|-------------|----------|
| TanStack 404 / not-found page (Recommended) | Standard 404 on prod. Looks like URL never existed. Zero attack surface. | ✓ |
| Friendly "smoke disabled in prod" page | Explainer copy. Useful for ops, exposes route exists. | |
| Redirect to `/` | Quietly bounce home. Cleanest UX, no signal. | |

**User's choice:** TanStack 404 / not-found page
**Notes:** Treats smoke route as undiscoverable on prod.

---

## Verification approach

### Q1 — Manual vs automated

| Option | Description | Selected |
|--------|-------------|----------|
| Manual deploy-preview check + archived evidence (Recommended) | Manual smoke on Phase 7 PR preview; screenshots + permalink committed to VERIFICATION.md. Cheap, definitive, one-time. | ✓ |
| Playwright E2E + Sentry MCP `search_events` (automated) | Re-runnable. Cost: deploy-preview URL plumbing, Sentry token in CI, Phase 8 fixture work hasn't landed. | |
| Both — manual now, automate in Phase 8 | Manual evidence in Phase 7; Playwright spec in Phase 8 since it's already touching E2E suite. | |

**User's choice:** Manual deploy-preview check + archived evidence
**Notes:** Phase 8 may pick up automation organically, but it's not a Phase 7 dependency.

### Q2 — Required evidence (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| Sentry event screenshot — populated componentStack + boundary tag (Recommended) | Proves OBSV-01 capture path. | ✓ |
| Sentry event screenshot — un-mangled top frame names (Recommended) | Proves OBSV-02 symbolication end-to-end. | ✓ |
| Sentry event permalink + release SHA pin (Recommended) | Future maintainers can re-open the event. | ✓ |
| Built `.map` `names[]` + chunk `__name(...)` grep output (Recommended) | Mechanical evidence keepNames took effect — roadmap success criterion #3 requires this. | ✓ |

**User's choice:** All four
**Notes:** Full evidence rubric — Sentry-side screenshots + permalink + build-side mechanical grep, no shortcuts.

### Q3 — Sign-off

| Option | Description | Selected |
|--------|-------------|----------|
| Solo sign-off (you) (Recommended) | OBSV-01/02 are config + wiring; Sentry permalink is independently verifiable. Reserve second-human pool for Phase 03 UAT 2+3. | ✓ |
| Two-human gated like Phase 03 UAT 2+3 | Mirrors second-human convention. Adds delay for marginal extra confidence. | |

**User's choice:** Solo sign-off
**Notes:** Second-human session pool kept for Phase 8 carry-forward UAT.

---

## Bundle-size evidence format

### Q1 — Evidence location

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated `.planning/closure/OBSV-02-bundle-delta.md` (Recommended) | Mirrors v1.1 closure-evidence pattern (UIDN-02/UIDN-03). Persistent, survives PR-squash. | ✓ |
| Inline in 07-VERIFICATION.md | Less filesystem sprawl. Mixes phase verification with cross-milestone closure. | |
| PR description only | Cheapest. Evidence vanishes when PR is squashed/archived. | |

**User's choice:** Dedicated `.planning/closure/OBSV-02-bundle-delta.md`
**Notes:** Aligns with the milestone's closure-evidence convention.

### Q2 — Measurement granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Total gzip delta + per-chunk gzip table (Recommended) | Total + per-chunk view catches surprise hot spots. | ✓ |
| Total gzip delta only | Just record overall gzipped `dist/` before/after. Loses per-chunk signal. | |
| Total + per-chunk + raw (uncompressed) sizes | More data, mostly redundant for $0/mo project where gzip-on-the-wire is what matters. | |

**User's choice:** Total gzip delta + per-chunk gzip table

### Q3 — Measurement tool

| Option | Description | Selected |
|--------|-------------|----------|
| Vite/Rolldown's built-in build output table (Recommended) | `vite build` already prints gzipped column per chunk. No new tooling, authoritative. | ✓ |
| Add `vite-bundle-visualizer` or similar plugin | HTML treemap. New dep for one-time measurement. Overkill. | |
| Shell script: `gzip -c dist/assets/*.js \| wc -c` | Manual gzip pass. Less authoritative — different algorithm/level than Netlify serves. | |

**User's choice:** Vite/Rolldown's built-in build output table

### Q4 — Overage policy

| Option | Description | Selected |
|--------|-------------|----------|
| Document the overage + ship anyway (Recommended) | Observability win > 0.x% extra bytes for $0/mo. Record actual delta + ship. | ✓ |
| Treat overage as a blocker — investigate before merging | Higher rigor. Probably overkill given Rolldown's empirical 0.5–1.5% range. | |
| Hard-cap at exactly 1.5% — fail PR if exceeded | CI/PR gate. Out of scope for hygiene phase. | |

**User's choice:** Document the overage + ship anyway
**Notes:** $0/mo budget context drives the policy — observability gain dominates the cost.

---

## Claude's Discretion

- Exact filenames/paths inside `src/` for the smoke route + smoke component.
- Whether to include a dev-only `console.warn` inside `onUncaughtError` (research suggests it; planner's call).
- Exact wiring of Netlify `CONTEXT` into Vite build env (`netlify.toml` vs dashboard env vars vs `define`).
- Whether to tag smoke-triggered Sentry events with `tags: { smoke: true }` (or similar) for filtering.

## Deferred Ideas

- Playwright + Sentry MCP automation of the `/__smoke` flow — deferred to Phase 8 only if it organically fits the E2E fixture work; otherwise to v1.2.
- LHCI / CI bundle-size gate — deferred to v1.2 per milestone budget framing.
- Sentry alert rules / dashboards / PII scrubbing tuning — own future phase if/when scale demands it.
- Token-gated smoke (URL secret) so the smoke could fire on prod too — considered and rejected in favor of env-gated 404.
