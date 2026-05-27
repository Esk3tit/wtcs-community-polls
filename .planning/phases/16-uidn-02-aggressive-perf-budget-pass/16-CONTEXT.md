# Phase 16: UIDN-02 Aggressive Perf-Budget Pass - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Strip PostHog from the critical-path JavaScript chunk via dynamic import, split a small number of vendor chunks for cache stability, convert the WTCS logo from PNG → WebP, enable TanStack Router intent-prefetching app-wide, and run a single mobile Lighthouse audit against production to close (or DEFER) UIDN-02.

**In scope:** PERF-01 (`rollup-plugin-visualizer@7.0.1` devDep + `ANALYZE=true` env-gate + `build:analyze` script), PERF-02 (pre-change bundle audit baseline), PERF-03 (PostHog dynamic-import), PERF-04 (manualChunks for vendor-react + vendor-posthog), PERF-05 (manual PNG→WebP + `<picture>` markup in Navbar), PERF-06 (`createRouter({ defaultPreload: 'intent' })`), PERF-07 (single Lighthouse mobile rerun on production via `audit-mobile.sh`).

**Out of scope:** `vite-imagetools` / `sharp` automated image processing (anti-feature per ROADMAP); broader chunk splitting beyond the two named vendors; A11y/BP/SEO Lighthouse thresholds (Performance category only counts for PASS/DEFER); chunk-load error retry/persistence semantics for the lazy posthog provider.

</domain>

<decisions>
## Implementation Decisions

### PostHog lazy-load architecture (PERF-03)
- **D-01:** Lazy `<PostHogGate>` provider component mounted only when `ConsentContext.state === 'allow'`. The gate uses `React.lazy(() => import(...))` to defer `posthog-js` + `posthog-js/react` out of the critical-path chunk. When state is `'undecided'` or `'decline'`, the gate renders `{children}` directly with no PostHogProvider in the tree — users who never accept never pay the posthog-js bundle cost. Matches the existing `lazy(() => import('@/components/debug/RenderThrowSmoke'))` pattern in `src/routes/__root.tsx`.
- **D-02:** Thin facade module `src/lib/posthog-facade.ts` is statically imported by `AuthContext` (and any future caller of `posthog.identify` / `posthog.reset`). The facade exposes a synchronous `identify(id)` / `reset()` API. Internally it queues calls if `posthog` has not loaded yet and replays them after the dynamic import resolves; if already loaded, it forwards immediately. Keeps AuthContext synchronous and preserves the current product semantics (identify is safe to call even when capturing is opt-out).
- **D-03:** `initPostHog()` retains its current `opt_out_capturing_by_default: true` / `opt_out_persistence_by_default: true` configuration. The GDPR consent semantic (capture off until user clicks Allow) is unchanged — Phase 16 is purely a bundle-size shift, not a consent-correctness change. The opt-in flip in `ConsentContext` `useEffect(() => { if (state === 'allow') posthog.opt_in_capturing(); ... })` becomes async-tolerant via the facade's queue, no behavior change.

### manualChunks shape (PERF-04)
- **D-04:** Stay minimal per ROADMAP. Only two explicitly-named chunks: `vendor-react` (covers `react` and `react-dom` packages only — TanStack Router stays in Rolldown auto-split) and `vendor-posthog` (covers `posthog-js` and `posthog-js/react`). Existing auto-split chunks for `supabase-js` (~213 KB) and `sentry-replay` (~140 KB) are left as auto-split — Rolldown is handling them correctly today and explicit naming risks fighting the bundler. Re-evaluate in a future phase only if cache-busting becomes a real problem.

### Lighthouse PASS threshold + DEFER path (PERF-07)
- **D-05:** PASS criterion = all 5 routes return Performance ≥ 90 on the single mobile audit run. Anything less (4/5, 3/5, etc.) is DEFER. Matches the criterion Phase 13 used. Per D-12, DEFER is an acceptable outcome — not a failure — so the strict threshold is safe.
- **D-06:** Audit target is **production** (`https://polls.wtcsmapban.com`), not the Netlify deploy preview, per D-13 (single Lighthouse rerun per milestone on production). The rerun executes post-merge from `main` once Netlify's production deploy lands.
- **D-07:** On DEFER, `.planning/closure/UIDN-02-mobile-evidence.md` gets a `## v1.3 Rerun` section with per-route scores for all 5 routes plus a verdict line `**v1.3 outcome: DEFER**` plus a one-paragraph rationale. UIDN-02 issue stays **open**; PROJECT.md `Mobile-first responsive design` Key Decision row stays ⚠️. The D-12 follow-up trigger (next perf-budget change) remains the resolution path.
- **D-08:** On PASS, the same evidence file gets the per-route scores plus `**v1.3 outcome: PASS**`; PROJECT.md `Mobile-first responsive design` row flips ⚠️ → ✓; UIDN-02 closes via PR body `Closes #18` keyword.

### Plugin-order safety (PERF-01)
- **D-09:** `vite.config.ts` throws an explicit `Error` at config-load time if `process.env.ANALYZE === 'true' && process.env.NETLIFY_CONTEXT === 'production'`. Error message names the trap directly (e.g., `Refusing production build with ANALYZE=true — sourcemap upload would be skipped, silently breaking the OBSV-04 evidence chain shipped in Phase 15`). The build dies before producing any artifacts, so an accidentally-toggled `ANALYZE` env var in Netlify can never silently ship a release with no sourcemap upload. Covers both Netlify CI and any local `NETLIFY_CONTEXT=production npm run build:analyze` invocation.

### Claude's Discretion
- Exact chunk-matcher function shape inside `manualChunks: { 'vendor-react': (id) => ... }` — research/planner picks the cleanest form (path-includes vs regex vs `Set` lookup) that survives Rolldown updates.
- Internal queue structure for the `posthog-facade` (array of `() => void` thunks vs typed event records). In-memory only — no `sessionStorage` persistence. Replay happens once on lazy-load resolution.
- Wording of the `vite.config.ts` throw message (keep it terse + actionable; include the specific OBSV-04 reference).
- Exact `<picture><source type="image/webp"><img>` markup in `src/components/layout/Navbar.tsx`. Keep the existing `width`/`height` attributes that already prevent CLS.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 16 source-of-truth
- `.planning/ROADMAP.md` §`Phase 16: UIDN-02 Aggressive Perf-Budget Pass` — Goal, 7 PERF requirements, success criteria, depends-on, risk profile
- `.planning/PROJECT.md` `Mobile-first responsive design` Key Decision row — the ⚠️ status this phase flips on PASS

### UIDN-02 closure evidence
- `.planning/closure/UIDN-02-mobile-evidence.md` — existing v1.2 baseline; v1.3 rerun appends `## v1.3 Rerun` section per D-07/D-08
- `.planning/closure/audit-mobile.sh` — Lighthouse mobile audit script (already present from prior UIDN-02 work)
- `.planning/closure/OBSV-02-bundle-delta.md` — analog evidence file pattern (`v1.X Delta` format) for PERF-02/PERF-04 pre/post-change bundle audit reporting

### Phase 15 dependencies (DON'T break)
- `src/main.tsx` — Sentry init + PostHog wrapper + tagged React 19 handlers. Plugin reordering and PostHog-provider relocation must preserve the tagged-handler boundary tag invariant from Phase 15.
- `scripts/verify-sourcemap-names.mjs` — the build-time keepNames regression guard from Phase 15-02. Phase 16's manualChunks change MUST keep all 7 allowlist names visible in `dist/assets/**/*.js`; the recursive readdir fix from PR #37 already handles nested subdirs.
- `.planning/phases/15-observability-e2e-verify-close/15-EVIDENCE.md` §OBSV-04 — the sourcemap-upload evidence chain that the PERF-01 plugin-order safety (D-09) protects.

### Cross-phase decisions in force
- **D-12** (Phase 13): UIDN-02 closure trigger = next perf-budget change; DEFER outcome acceptable
- **D-13** (Phase 13): Single Lighthouse rerun per milestone on production; no repeated runs
- **Phase 6** GDPR opt-IN rewire: `ConsentContext` uses `'allow'/'decline'` state — already shipped; Phase 16 does NOT change consent semantics

### Library docs (read when implementing)
- `vite.config.ts` — current plugin order: `react()` → `tailwindcss()` → `sentryVitePlugin()`. Visualizer goes where sentryVitePlugin currently is (env-gated).
- `src/contexts/ConsentContext.tsx` — `useEffect(() => { if (state === 'allow') posthog.opt_in_capturing(); else posthog.opt_out_capturing() })` flow + the allow→decline page-reload behavior
- `src/lib/posthog.ts` — current `initPostHog()` opt-out-by-default config; PostHog facade builds on the same init shape

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/routes/__root.tsx` `lazy(() => import('@/components/debug/DebugAuthOverlay'))` — direct analog for the new `PostHogGate` lazy pattern. Same `React.lazy()` shape.
- `src/routes/[__smoke].tsx` line 13-17 (post-PR #37 form) — second `lazy(() => import('@/components/debug/RenderThrowSmoke'))` analog. Both use the `@/` alias for the dynamic import; new PostHogGate should follow.
- `.planning/closure/audit-mobile.sh` — Lighthouse mobile script already exists. Reusable as-is; just rerun against production post-merge.
- `.planning/closure/UIDN-02-mobile-evidence.md` v1.2 baseline section — template structure for the new `## v1.3 Rerun` section.

### Established Patterns
- `@/` alias is the project convention for all imports including dynamic (`grep -rE "from ['\"]@/" src` = 272; `from '..'` = 0). The PostHogGate, posthog-facade, and any new modules must use `@/...` imports — direct, not relative.
- Source comments are WHY-only; no plan/round/phase ID archaeology in `src/`. (Per project memory rule, confirmed by Phase 15 PR #37 cleanup.)
- Edge Functions are not touched by Phase 16 (no backend changes — pure frontend bundle + asset work).
- Static imports + opt-out-by-default + opt-in-on-allow is the GDPR-correct shape; Phase 16 preserves it while moving the bundle out of critical path.

### Integration Points
- `src/main.tsx` → currently wraps `<PostHogProvider client={posthog}>...</PostHogProvider>` at top level. Phase 16 replaces with `<PostHogGate>{children}</PostHogGate>` (or moves the gate inside `<ConsentProvider>`, decided by planner).
- `src/contexts/ConsentContext.tsx` line 53-60 `useEffect` switching `opt_in_capturing` / `opt_out_capturing` — uses `posthog` directly today; switches to facade calls after Phase 16.
- `src/contexts/AuthContext.tsx` `posthog.identify(providerId)` + `posthog.reset()` — switches to `posthog-facade` import.
- `src/components/layout/Navbar.tsx` line 33 `<img src={logo}>` (from `import logo from '@/assets/wtcs-logo.png'`) — wraps in `<picture><source type="image/webp" srcSet={...}><img src={logo} width={...} height={...}></picture>`.
- `vite.config.ts` plugins array — env-gate inserts visualizer or sentryVitePlugin (mutually exclusive); throws if `ANALYZE && NETLIFY_CONTEXT === 'production'` per D-09.

</code_context>

<specifics>
## Specific Ideas

- The PostHogGate render-naked-children path when consent is not `'allow'` is non-negotiable — users who decline must not download `posthog-js` at all (the core PERF-03 win).
- D-09's throw message must explicitly reference OBSV-04 + Phase 15's sourcemap-upload chain so a future maintainer reading the error message immediately understands the trap, not just the surface symptom.
- PERF-05 WebP fallback is non-negotiable — keep the PNG; serve via `<source>`-first `<picture>` so Safari 13- (no WebP) gracefully falls back. Don't drop the PNG asset from `dist/`.
- Bundle audit baseline (PERF-02) committed to `.planning/closure/v1.3-bundle-audit-pre.html` as ROADMAP locks; post-change verification (PERF-04 acceptance) re-runs `ANALYZE=true npm run build` and the planner decides whether to commit the post-treemap or report deltas inline.

</specifics>

<deferred>
## Deferred Ideas

- **Broader vendor chunk splitting** (vendor-sentry, vendor-supabase, vendor-radix): considered, rejected for Phase 16 per D-04. Re-evaluate in a future phase if cache-busting becomes a real problem.
- **Allow 4/5-route DEFER as PASS-with-caveat**: considered (would loosen the threshold to allow flipping the PROJECT.md row to ✓ with a footnote), rejected per D-05 — strict 5/5 preserves the original Phase 13 intent. DEFER stays DEFER.
- **CI workflow guard against `ANALYZE=true` on `main`**: considered as an alternative to D-09's vite.config.ts throw, rejected — Netlify CI is a separate workflow from GitHub Actions, and the vite.config.ts throw covers both paths in one check.
- **`vite-imagetools` / `sharp` automated WebP conversion**: explicitly anti-feature per ROADMAP PERF-05. Manual one-time conversion only.
- **WebP fallback for browsers without WebP support beyond `<picture><source>`**: not needed — `<picture>` semantics handle this natively. No JS polyfill, no detection logic.
- **A11y / Best Practices / SEO Lighthouse thresholds**: out of scope. Phase 16 measures Performance only for PASS/DEFER.

</deferred>

---

*Phase: 16-UIDN-02 Aggressive Perf-Budget Pass*
*Context gathered: 2026-05-27*
