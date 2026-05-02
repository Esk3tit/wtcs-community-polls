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

# OBSV-02 Bundle Delta — Rolldown `keepNames` cost

Rolldown's `build.rolldownOptions.output.keepNames: true` (Phase 7 OBSV-02 fix) preserves the original `Function.prototype.name` so Sentry stack frames show real component identifiers (`RootLayout`, `RenderThrowSmoke`, `SmokePage`, `AppErrorFallback`, ...) instead of mangled `xR`/`$M` glyphs from Vite 8's default Oxc minifier. This doc records the measured bundle-size cost of that flag.

## Method

3-way same-session build comparison via `git worktree` (RESEARCH Pitfall 6 — eliminates baseline drift; Round-2 MEDIUM-3 — clean per-flag attribution by isolating the keepNames change from the rest of Phase 7's shipping cost):

| Worktree | SHA | vite.config.ts | Smoke route + RenderThrowSmoke | Purpose |
|----------|-----|----------------|-------------------------------|---------|
| W1 — main baseline | `6a0a1e1e` | no `rolldownOptions.output.keepNames` | not present | pre-Phase-7 baseline |
| W2 — phase-7 NO keepNames | `b9afb999` | `keepNames: true` line surgically reverted (sed) | present | isolates the keepNames-only delta |
| W3 — phase-7 WITH keepNames | `b9afb999` | as-shipped (`keepNames: true`) | present | the actual shipping build |

All three worktrees built in the same shell session with `SENTRY_AUTH_TOKEN= npm run build` (the Sentry plugin's `disable: mode !== 'production'` guard short-circuits when no auth token is set, but the production-mode build still runs Oxc minify + Rolldown — sourcemap-upload + delete-after-upload skipped, which is what we want for a measurement-only build). Worktrees removed after each measurement; `node_modules/.vite` cache dropped between builds.

**Round-3 LOW-4 — single source of truth for gzip values:** All gzip cells below come from Vite/Rolldown's printed per-chunk `gzip:` column (the build output table). D-13 specifies "Vite/Rolldown built-in tool"; the alternative `find dist/assets -name '*.js' | xargs gzip -c | wc -c` method (cross-file gzip) was removed from the plan because it produces different numbers. Total = sum of per-chunk gzip values from the printed table.

## Total gzip table

| Build | Chunks | Raw kB | Gzip kB | Δ vs main | Δ vs main (%) |
|-------|--------|--------|---------|-----------|---------------|
| W1 — main baseline | 31 | 1117.33 | **362.20** | (baseline) | (baseline) |
| W2 — phase-7 NO keepNames | 34 | 1120.42 | **363.51** | +1.31 | +0.36% |
| W3 — phase-7 WITH keepNames (shipped) | 35 | 1261.05 | **386.19** | +23.99 | +6.62% |

**Two deltas (Round-2 MEDIUM-3 — clean per-flag attribution):**

- **keepNames-only delta** (W3 − W2): **+22.68 kB gzip = +6.24%** ← OBSV-02 commitment surface; D-14 policy applies here
- **Total Phase 7 delta** (W3 − W1): **+23.99 kB gzip = +6.62%** ← audit-relevant shipping cost (keepNames + smoke route + RenderThrowSmoke component)

The smoke route + RenderThrowSmoke component contribute only +1.31 kB gzip (+0.36%) on their own — almost all of the Phase 7 cost is the keepNames flag.

## Per-chunk gzip table — top 25 deltas (W3 vs W2, matched by chunk name ignoring hash)

| Chunk | W2 gz kB | W3 gz kB | Δ kB | Δ % | Note |
|-------|----------|----------|------|-----|------|
| `index.js` (main bundle) | 207.66 | 221.84 | +14.18 | +6.8% | Primary cost — most app code lives here |
| `sentry.js` (sentry-replay) | 39.67 | 41.74 | +2.07 | +5.2% | Vendor: @sentry/react preserves names too |
| `breadcrumbs.js` (Sentry breadcrumbs deps) | 11.55 | 12.66 | +1.11 | +9.6% | Vendor |
| `supabase.js` (@supabase/supabase-js) | 24.06 | 25.15 | +1.09 | +4.5% | Vendor |
| `button.js` (shadcn button + Radix UI) | 10.23 | 11.18 | +0.95 | +9.3% | Vendor (Radix) |
| `currentScopes.js` (Sentry scope manager) | 6.40 | 7.08 | +0.68 | +10.6% | Vendor |
| `chunk.js` (TanStack Router internal) | 0.00 | 0.63 | +0.63 | NEW | New chunk emerged with keepNames (Rolldown re-grouped) |
| `lazyRouteComponent.js` (TanStack lazy helper) | 8.12 | 8.51 | +0.39 | +4.8% | Vendor |
| `SuggestionForm.js` | 13.03 | 13.29 | +0.26 | +2.0% | App route chunk |
| `useSearch.js` | 2.68 | 2.90 | +0.22 | +8.2% | App hook chunk |
| `admin.js` (admin route) | 7.98 | 8.18 | +0.20 | +2.5% | App route chunk |
| `SuggestionList.js` | 6.31 | 6.48 | +0.17 | +2.7% | App route chunk |
| `dist.js` (zod / vendor deps) | 2.35 | 2.50 | +0.15 | +6.4% | Vendor |
| `jsx.js` (jsx-runtime) | 3.41 | 3.27 | -0.14 | -4.1% | Net negative — Rolldown re-grouped |
| `label.js` (Radix label) | 3.88 | 4.00 | +0.12 | +3.1% | Vendor |
| `___smoke_.js` (smoke route chunk) | 0.62 | 0.71 | +0.09 | +14.5% | App — Phase 7 new |
| `DebugAuthOverlay.js` | 2.11 | 2.18 | +0.07 | +3.3% | App debug component |
| `useNavigate.js` | 0.69 | 0.75 | +0.06 | +8.7% | App hook chunk |
| `react.js` (react-dom client) | 1.56 | 1.61 | +0.05 | +3.2% | Vendor |
| `preload.js` (TanStack preload helper) | 0.90 | 0.95 | +0.05 | +5.6% | Vendor |
| `archive.js` | 0.54 | 0.58 | +0.04 | +7.4% | App route chunk |
| `new.js` | 0.41 | 0.44 | +0.03 | +7.3% | App route chunk |
| `useCategories.js` | 1.09 | 1.12 | +0.03 | +2.8% | App hook chunk |
| `topics.js` | 0.44 | 0.47 | +0.03 | +6.8% | App route chunk |
| `_id.edit.js` | 0.45 | 0.48 | +0.03 | +6.7% | App route chunk |

The dominant contributor is the main `index.js` bundle (+14.18 kB / +6.8%) — that's where the app's component declarations + the bundled vendor code that Rolldown chose not to split out live. Per-chunk deltas in the +5%–+11% range are consistent with Rolldown preserving identifier names that Oxc would otherwise mangle to 1–2 char glyphs, plus a small overhead for the `function Name(...)` declaration form vs the equivalent minified arrow expression.

## Target check (D-14 policy)

D-14 declares: "Overage policy: if the measured total gzip delta exceeds the ≤1.5% target, document the actual number + ship anyway. Observability win > 0.x% extra bytes for a $0/mo project on Netlify free tier. The closure doc records the target, the actual delta, and a one-line rationale."

| Metric | Target | Actual (keepNames-only delta — Round-2 MEDIUM-3 isolated attribution) | Verdict |
|--------|--------|----------------------------------------------------------------------|---------|
| Gzip delta vs phase-7-WITHOUT-keepNames | ≤ 1.5% | **+6.24%** (+22.68 kB gzip, dominated by +14.18 kB on the main `index.js` bundle) | **OVER TARGET by 4.74 pp** |

**Rationale (per D-14 — document + ship):**

1. **The triage cost of *not* having keepNames is concrete and recurring.** Every Sentry alert with mangled `xR`/`$M` stack frames means the on-call engineer has to cross-reference the released sourcemap against the Sentry symbolicator's failed lookup, manually walk the bundle, and guess which component the throw came from. For a launch-week incident on a $0/mo project where the maintainer is also the on-call, a 30-minute triage cycle to disambiguate `xR` is far more expensive than the ~23 kB gzip delta on a 386 kB total bundle.
2. **The 1.5% target was set in v1.1-VITE-SOURCEMAPS.md as an esbuild analog.** The original research cited "esbuild's equivalent `keepNames` flag historically reports ~1% size cost which is the closest analog" — but Rolldown's Oxc minifier mangles more aggressively than esbuild does by default, so the *unminified-vs-keepNames* delta is necessarily larger than esbuild's equivalent. The empirical Rolldown delta on this codebase is 6.24%.
3. **The absolute cost is small in real terms.** +22.68 kB gzip on the wire for a one-time download (Netlify CDN serves brotli-compressed assets with long cache-control). For a project on Netlify legacy free tier with no bandwidth meter, the cost is functionally zero.
4. **No CI/perf regression hard-gate exists.** ROADMAP § Phase 9 explicitly defers LHCI / bundle-size CI gates to v1.2; this overage does not trip any pipeline.
5. **Re-evaluation hook:** if Netlify caching/bandwidth costs become a concern (would require leaving the legacy free tier — not on the v1.2 roadmap), revisit by either (a) configuring Rolldown's `keepNames` to a targeted allowlist via a custom plugin (would lose the at-scale `function PascalCase(...)` preservation but might cut delta by ~3 pp), or (b) accepting it.

**Decision: SHIP with `keepNames: true` enabled.** D-14 policy applied; observability gain (correct Sentry stack frames on every render-phase error) overwhelmingly outweighs the +22.68 kB gzip cost on a $0/mo Netlify free-tier deploy.

## Cross-references

- **`07-VERIFICATION.md`** — `## Required Artifacts` row pointing here as the OBSV-02 closure record; Goal Achievement SC #4 gate ("Bundle-size delta from `keepNames` documented (≤1.5% gzip target)") closes against this doc with the D-14 rationale.
- **`07-CONTEXT.md` D-11..D-14** — the Implementation Decisions block that mandated this dedicated closure doc, per-chunk granularity, single-source-of-truth gzip method, and ship-anyway overage policy.
- **`07-RESEARCH.md` § "OBSV-02"`** — bundle-size cost prediction (~0.5–1.5% gzip) — empirically *understated* by ~5 pp on this codebase. Recorded here for future research-input correction.
- **`v1.1-VITE-SOURCEMAPS.md` § "Bundle-size impact"`** — original research source of the 1.5% target (esbuild analog). Same "empirically understated" note applies.
- **`.planning/phases/07-observability-hardening/artifacts/__name-grep.txt`** — Rolldown-correct mechanical evidence that keepNames took effect (Round-4 amended from the original `__name(` esbuild-idiom check; Rolldown preserves names by leaving literal `function Name(...)` declarations).
- **PR #21** — the Phase 7 PR that this doc accompanies. Branch `gsd/phase-07-observability-hardening` at `b9afb999...` (the SHA all measurements above were taken against).

## Raw build output

Full Vite build logs are not committed (they're large and reproducible from the SHAs above). The complete printed per-chunk tables (sourced for every gzip cell above) lived at:

- `/tmp/p07-bundle-delta/W1-baseline-build.log` — main baseline at `6a0a1e1e`
- `/tmp/p07-bundle-delta/W2-no-keepNames-build.log` — phase-7 with keepNames surgically reverted at `b9afb999`
- `/tmp/p07-bundle-delta/W3-with-keepNames-build.log` — phase-7 as-shipped at `b9afb999`

To regenerate from the SHAs:

```bash
# main baseline
git worktree add /tmp/p07-baseline 6a0a1e1e7c71595cf709d27e9b0f37f331b501fe
cd /tmp/p07-baseline && npm ci && SENTRY_AUTH_TOKEN= npm run build 2>&1 | tee /tmp/W1.log
cd - && git worktree remove /tmp/p07-baseline --force

# phase-7 NO keepNames (surgical revert of vite.config.ts)
git worktree add /tmp/p07-no-kn b9afb9991efbaaae91050c8d25b3d34ac7575b4a
cd /tmp/p07-no-kn
sed -i.bak 's|output: { keepNames: true },|// keepNames intentionally reverted for bundle-delta measurement|' vite.config.ts
rm -f vite.config.ts.bak
npm ci && SENTRY_AUTH_TOKEN= npm run build 2>&1 | tee /tmp/W2.log
cd - && git worktree remove /tmp/p07-no-kn --force

# phase-7 WITH keepNames (as-shipped)
git worktree add /tmp/p07-with-kn b9afb9991efbaaae91050c8d25b3d34ac7575b4a
cd /tmp/p07-with-kn && npm ci && SENTRY_AUTH_TOKEN= npm run build 2>&1 | tee /tmp/W3.log
cd - && git worktree remove /tmp/p07-with-kn --force
```

Sum the `gzip:` column from each log's per-chunk table (regex: `dist/assets/.*\.js\b.*kB.*gzip`) to reproduce the totals above.

---
_Measured: 2026-04-30T09:48:00Z_
_Method: 3-way same-session git-worktree comparison; gzip values from Vite's printed per-chunk column (Round-3 LOW-4 single-source-of-truth)_
_Disposition: SHIP with keepNames enabled — D-14 ship-anyway policy applied; observability gain accepted_
