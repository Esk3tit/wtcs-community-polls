# Phase 7: Observability Hardening - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Production Sentry receives every render-phase React error with un-mangled, human-readable stack frames so launch-time error triage is reliable.

**In scope:**
- Wire `Sentry.reactErrorHandler()` into React 19's `createRoot({ onCaughtError, onUncaughtError, onRecoverableError })` (OBSV-01).
- Set `build.rolldownOptions.output.keepNames: true` in `vite.config.ts` (OBSV-02).
- Add `onError` belt-and-suspenders calling `Sentry.captureException` from inside `Sentry.ErrorBoundary` (tags: `boundary: 'app-root'`, contexts: `componentStack`).
- Ship a permanent `RenderThrowSmoke` canary at a dedicated, env-gated `/__smoke` route for re-runnable verification on every release.
- Capture one-shot manual deploy-preview evidence proving both fixes work end-to-end.
- Document the bundle-size cost of `keepNames` against the ≤1.5% gzip target.

**Out of scope:**
- New Sentry features beyond capture-path correctness (PII scrubbing, alert rules, dashboards).
- Replacing `Sentry.ErrorBoundary` with anything else; it stays as fallback UI.
- Changes to `Sentry.init` config, `sentryVitePlugin` config, sourcemap upload pipeline, or release-SHA wiring — all already correct from Phase 6. **AMENDED 2026-04-29 (Round-2 HIGH-1):** the `Sentry.init` `environment` field is the one allowed exception — it is amended to `VITE_NETLIFY_CONTEXT ?? import.meta.env.MODE` so deploy-preview events report `environment: 'deploy-preview'` instead of `'production'`. All other `Sentry.init` settings (DSN, release SHA, integrations, tracesSampleRate, replaysSessionSampleRate) remain untouched from Phase 6.
- Playwright automation of the smoke (deferred to Phase 8 only if it organically fits the fixture work).
- LHCI / bundle-size CI gates (deferred to v1.2 per milestone scope guard).
- Any product feature work (SEED-002 admin visibility belongs in v1.2).

</domain>

<decisions>
## Implementation Decisions

### Smoke component lifecycle
- **D-01:** `RenderThrowSmoke` is a **permanent** observability canary, not a one-shot. Stays in the repo long-term so future regressions to the Sentry capture path or sourcemap function-name preservation can be re-detected with a single deploy-preview click.
- **D-02:** Lives at a **dedicated TanStack route** `/__smoke` (not piggybacked on `/` or another user-facing route). The route reads search param `render` and renders the throw component when `render=1`. Stable, ops-friendly URL; no risk of being lost in a future home-route refactor.
- **D-03:** Smoke component is **lazy-loaded via TanStack `autoCodeSplitting`** (already enabled in `vite.config.ts`). The smoke chunk only downloads when someone visits `/__smoke?render=1` — zero cost on the home-page bundle and no impact on the OBSV-02 bundle-size delta math.

### Smoke trigger gating
- **D-04:** Trigger is **env-gated to non-production builds** (Netlify deploy previews + local dev). Live prod (`polls.wtcsmapban.com`, the `production` Netlify context) suppresses the throw so drive-by traffic cannot pollute Sentry or burn free-tier event quota.
- **D-05:** Gate signal is **`import.meta.env.VITE_NETLIFY_CONTEXT`**, populated from Netlify's built-in `CONTEXT` env var (one of `production` / `deploy-preview` / `branch-deploy` / `dev`). The smoke route allows the throw when `VITE_NETLIFY_CONTEXT !== 'production'`. Env var must be exposed in `netlify.toml` (or wired through Vite config) so it's present at build time. Single source of truth that matches Netlify's own deploy-context model.
- **D-06:** Live-prod requests to `/__smoke?render=1` return **TanStack's standard 404 / not-found page**. Route appears not to exist; zero discoverable attack surface, no leakage that the URL is real.

### Verification approach
- **D-07:** Verification is **manual, one-shot, on the Phase 7 PR's Netlify deploy preview**. No Playwright spec wired in this phase — automation deferred to Phase 8 only if it organically fits the E2E fixture work, never as a Phase 7 dependency.
- **D-08:** Evidence required (all four MUST land in `07-VERIFICATION.md` before the phase is called done):
  1. Sentry event screenshot showing populated `componentStack` and `tags.boundary === 'app-root'` (proves OBSV-01 capture path).
  2. Sentry event screenshot showing top stack frames with un-mangled names (`App`, `RenderThrowSmoke`, route components, etc. — not `xR`/`$M`-style mangled identifiers) (proves OBSV-02 symbolication).
  3. Sentry event permalink + the release SHA the event was captured under, both pinned in VERIFICATION.md so future maintainers can re-open the event.
  4. Built `dist/assets/*.js.map` `names[]` excerpt (via `jq -r '.names[]'`) + literal-function-declaration grep output (`grep -lE 'function (RootLayout|AppErrorFallback|RenderThrowSmoke|SmokePage)\b' dist/assets/*.js`) proving `keepNames: true` mechanically took effect during the build (roadmap success criterion #3). **AMENDED 2026-04-30:** original D-08 said `grep '__name(' dist/assets/*.js | head` based on esbuild's keepNames idiom. Rolldown's Oxc minifier does NOT emit `__name(fn,'orig')` helper calls; instead it preserves literal `function Name(...)` declarations. The literal-function-declaration grep is the Rolldown-correct equivalent and is what the Phase 7 Plan 03 artifact `__name-grep.txt` empirically captured.
- **D-09:** **Solo sign-off** (Khai). OBSV-01/02 are config + wiring, not security/auth gates, and the Sentry event itself is independently verifiable via the permalink. The second-human session pool is reserved for Phase 03 UAT 2+3 carry-forward in Phase 8.
- **D-10:** Screenshots and any binary artifacts archive to `.planning/phases/07-observability-hardening/artifacts/`. Large blobs (>1MB) may be `.gitignore`-d at the planner's discretion; the permalink + the `.map`/grep text excerpts must be committed.

### Bundle-size evidence format
- **D-11:** OBSV-02 bundle-size delta evidence lives in a **dedicated `.planning/closure/OBSV-02-bundle-delta.md`** doc (mirrors v1.1's UIDN-02/UIDN-03 closure-evidence pattern). Persistent, easy to find on audit, survives PR-squash.
- **D-12:** Measurement granularity: **total gzip delta + per-chunk gzip table**. Capture the build output for `main` (baseline, no `keepNames`) and the Phase 7 branch (with `keepNames: true`); record total `dist/` gzipped size for both, plus a per-chunk table (entry chunk, vendor chunk, route chunks) with deltas. Per-chunk view catches surprise hot spots (e.g., one route chunk balloons even if the total is fine).
- **D-13:** Measurement tool: **Vite/Rolldown's built-in build output table** (`vite build` already prints a gzipped column for every chunk). Capture the printed table from each build, paste into the closure doc. No new tooling, numbers are authoritative because they come from the actual build the deploy uploads.
- **D-14:** Overage policy: if the measured total gzip delta exceeds the ≤1.5% target, **document the actual number + ship anyway**. Observability win > 0.x% extra bytes for a $0/mo project on Netlify free tier. The closure doc records the target, the actual delta, and a one-line rationale (e.g., "0.9% — within target" or "1.7% — over target by 0.2 pp; observability gain accepted, revisit if Netlify caching costs become a concern").

### Claude's Discretion
- File names/paths inside `src/` (e.g., `src/routes/__smoke.tsx` vs `src/routes/__smoke/index.tsx` for the TanStack route, `src/components/debug/RenderThrowSmoke.tsx` for the component). Researcher/planner pick what fits the existing route-tree convention.
- Exact wording / structure of the dev-only `console.warn` inside `onUncaughtError` (research suggests including it; planner can keep, simplify, or drop based on local taste).
- How to expose `CONTEXT` from Netlify into Vite at build time (`netlify.toml` `[build.environment]` block vs Netlify dashboard env vars vs Vite `define`). Planner picks the lowest-friction wiring.
- Whether to add a small `tags: { smoke: true }` (or similar) to smoke-triggered Sentry events for filtering. Optional, planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (locked technical fixes)
- `.planning/research/v1.1-SENTRY-ERRORBOUNDARY.md` — root cause + recommended `createRoot` + `ErrorBoundary` rewrite for OBSV-01 (React 19 hooks). Smoke verification pattern.
- `.planning/research/v1.1-VITE-SOURCEMAPS.md` — root cause + `build.rolldownOptions.output.keepNames` fix for OBSV-02. Bundle-size impact (~0.5–1.5% gzip).
- `.planning/research/v1.1-SUMMARY.md` § Cross-Cutting Decisions — "One Netlify deploy-preview smoke pass covers Phase 7" + closure evidence directory convention.

### Files to modify
- `src/main.tsx` — wire React 19 root error hooks; add `onError` belt to `Sentry.ErrorBoundary`. (Sentry.init block stays untouched **except for the `environment` field** — Round-2 HIGH-1 amends it to `VITE_NETLIFY_CONTEXT ?? MODE`; all other Sentry.init settings remain as Phase 6 left them.)
- `vite.config.ts` — add `build.rolldownOptions.output.keepNames: true`. (`build.sourcemap: 'hidden'` and `sentryVitePlugin` block stay untouched.)
- `netlify.toml` (or equivalent Vite `define`) — expose `CONTEXT` to Vite as `VITE_NETLIFY_CONTEXT` so the smoke gate can read it.

### Files to create
- `src/routes/__smoke.tsx` (or TanStack-convention equivalent) — env-gated route; renders 404 on prod, renders `<RenderThrowSmoke />` on non-prod when `render=1`.
- `src/components/debug/RenderThrowSmoke.tsx` — render-phase throw component (lazy-loaded via the smoke route).
- `.planning/phases/07-observability-hardening/07-VERIFICATION.md` — Sentry screenshots + permalink + `.map` evidence (manual, solo sign-off).
- `.planning/closure/OBSV-02-bundle-delta.md` — total + per-chunk gzip table with target check.

### Project-level decisions
- `.planning/PROJECT.md` § Constraints — $0/mo budget; Netlify legacy free tier; Supabase/Upstash free tier.
- `.planning/PROJECT.md` § Key Decisions — Sentry already chosen; sourcemap upload pipeline already configured (Phase 6 D-04); Netlify deploy previews are the canonical pre-prod environment.
- `.planning/REQUIREMENTS.md` § Observability — OBSV-01, OBSV-02 verbatim definitions + GitHub issue links (#17, #19).
- `.planning/ROADMAP.md` § Phase 7 — five Success Criteria are the verification rubric; do not weaken.

### External docs (already cited in research)
- Sentry React 19 integration: https://docs.sentry.io/platforms/javascript/guides/react/features/error-boundary/
- Rolldown `output.keepNames`: https://rolldown.rs/reference/outputoptions.keepnames
- Vite 8 migration (Oxc minifier default): https://vite.dev/guide/migration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/AppErrorFallback.tsx` — already wired as `Sentry.ErrorBoundary` `fallback`. Reused as-is; no changes needed.
- `src/main.tsx` `Sentry.init({...})` block — already correct (DSN, release SHA, browserTracingIntegration, traces/replays sample rates). DO NOT touch — **except for the `environment` field**, which Round-2 HIGH-1 amends to `VITE_NETLIFY_CONTEXT ?? import.meta.env.MODE` so deploy-preview events do not report `environment: 'production'`.
- `vite.config.ts` `sentryVitePlugin({...})` block — already correct (auth token, `disable: mode !== 'production'`, sourcemap upload + delete-after-upload contract). DO NOT touch.
- `vite.config.ts` `build.sourcemap: 'hidden'` — already correct per Sentry contract. DO NOT touch.
- TanStack Router `autoCodeSplitting: true` — already enabled, gives lazy-loading of `/__smoke` for free.
- `ConsentProvider` (`src/contexts/ConsentContext`) — wraps PostHog/Sentry Replay opt-IN gating. Smoke errors sent via `Sentry.captureException` go through Sentry's transport directly and are NOT subject to Replay opt-IN; no changes needed there.

### Established Patterns
- All explanatory comments in `src/main.tsx` are dense, plan-cited (e.g., "HIGH #1 (codex review)…", "Phase 6 D-04…"). New code should follow the same convention so future maintainers can trace decisions.
- Phase 6 D-04 documented Sentry's sourcemap upload contract; Phase 7 builds on that contract — function-name preservation is the LAST piece of correct symbolication.
- Closure-evidence pattern from v1.1 milestone: `.planning/closure/<REQ-ID>-<topic>.md` with artifacts in `.planning/closure/artifacts/`. Phase 7 follows this for OBSV-02 bundle delta.
- Verification-evidence pattern from v1.0 phases: `.planning/phases/NN-slug/NN-VERIFICATION.md` with phase-scoped artifacts under `.planning/phases/NN-slug/artifacts/`.

### Integration Points
- React 19 `createRoot` options object is the new connection point for Sentry capture (was previously the `ErrorBoundary` alone). Five render-time call paths now feed Sentry: `onUncaughtError`, `onCaughtError`, `onRecoverableError` (React-level), `Sentry.ErrorBoundary` `onError` (component-level belt), plus the existing `globalHandlersIntegration` (window-level catch-all).
- Vite `build.rolldownOptions` is the escape hatch for Rolldown-specific options on top of Vite 8's defaults. Touching it must not interfere with the `sentryVitePlugin` (which runs as a plugin, not a Rolldown output option) or with `build.sourcemap: 'hidden'`.
- TanStack Router file-based routing — `__smoke` route lives in `src/routes/`; route generation is automatic (`routeTree.gen.ts`).
- Netlify build env: `netlify.toml` `[build.environment]` block exposes vars to Vite at build time. Vite picks up `VITE_*`-prefixed vars automatically; non-prefixed vars (like `CONTEXT`) need to be re-exported as `VITE_NETLIFY_CONTEXT` to be visible in the browser bundle.

</code_context>

<specifics>
## Specific Ideas

- Smoke component throws from the **render phase**, not from an event handler — research is explicit: event-handler throws hit `globalHandlersIntegration` and would mask the React 19 hook test.
- Smoke component message: a deterministic string like `"RenderThrowSmoke: deliberate render-phase throw for Sentry verification"` so the Sentry event is unambiguously identifiable in search.
- Sentry `mechanism.type` on a successful smoke event should be `react.errorboundary` (preferred) or `generic` (from `reactErrorHandler`). NOT `auto.browser.global_handlers.onerror` — that would indicate the React 19 hooks did NOT route the error and the global handler is masking the real problem.
- Verification env: Netlify deploy preview, production build (`vite build` — not `vite dev`). Roadmap criterion #5 is explicit: dev server / Vitest insufficient because StrictMode masks render-phase capture and the minifier doesn't run in dev.

</specifics>

<deferred>
## Deferred Ideas

- Playwright automation of the `/__smoke` flow + Sentry MCP `search_events` polling. Considered for Phase 7 but explicitly deferred — Phase 8 (E2E Test Hygiene) is already touching the spec suite and adding the `freshPoll` fixture; if a Playwright smoke spec organically fits there, land it then. Otherwise leave it as a potential v1.2 concern.
- LHCI / CI bundle-size gate on the keepNames overage. Out of scope for v1.1 per milestone framing ($0/mo, no new CI services). Deferred to v1.2.
- Sentry alert rules / dashboards / PII scrubbing tuning. New observability capability, not a Phase 7 fix. Belongs in its own future phase if/when scale demands it.
- Token-gated smoke (URL secret) so the smoke could fire on prod too. Considered and rejected — env-gated 404 is simpler and the deploy preview gives sufficient coverage.

</deferred>

---

*Phase: 7-Observability Hardening*
*Context gathered: 2026-04-28*
