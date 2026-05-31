# Phase 16: UIDN-02 Aggressive Perf-Budget Pass - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 16-UIDN-02 Aggressive Perf-Budget Pass
**Areas discussed:** PostHog lazy-load architecture, manualChunks shape, Lighthouse PASS threshold, Plugin-order safety for ANALYZE=true

---

## PostHog Lazy-Load Architecture (PERF-03)

### Q1: Which lazy-load architecture do you want for PostHog?

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy provider mounted on consent | Separate `<PostHogGate>` wrapper. `React.lazy()` loads `posthog-js/react` + `posthog-js` only when `state==='allow'`. Renders `{children}` directly otherwise. Matches the existing `lazy(() => import('@/components/debug/RenderThrowSmoke'))` pattern. Cleanest separation; users who never accept never pay the bundle cost. | ✓ |
| Dynamic import inside allow() handler | Move `initPostHog()` call out of main.tsx; inside `ConsentContext.allow()`, dynamic-import + opt-in. Less wrapping but consent flow becomes async; provider mounts after initial render. | |
| useEffect on state==='allow' inside ConsentProvider | Inside `ConsentContext`, `useEffect(() => { if (state === 'allow') import('@/lib/posthog').then(...) }, [state])`. Reactive; runs on hydration if stored consent is `'allow'`. Provider stays in main.tsx but lazy-imports its dependency. | |

**User's choice:** Lazy provider mounted on consent
**Notes:** Aligned with existing project pattern. The "render children naked when consent !== 'allow'" semantic is critical to the PERF-03 win.

### Q2: How should AuthContext's posthog.identify/reset calls be handled given the lazy-load?

| Option | Description | Selected |
|--------|-------------|----------|
| Thin facade module that buffers calls until posthog loads | `src/lib/posthog-facade.ts` with synchronous `identify(id)` / `reset()` API. Statically imported by AuthContext. Internally: forwards if posthog loaded, queues + replays after lazy-import otherwise. Keeps AuthContext synchronous; preserves current "identify safe even when opt-out" semantics. | ✓ |
| Dynamic import inside AuthContext call sites | AuthContext identify/reset paths become async. Simpler than facade; cost: callbacks async, identify delayed if Discord callback completes before posthog loads. | |
| Guard identify/reset behind consent check | AuthContext checks consent state before calling identify/reset. Skips identify if state !== 'allow'. Couples AuthContext to ConsentContext; changes product semantics (today identify is safe under opt-out). | |

**User's choice:** Thin facade module that buffers calls until posthog loads
**Notes:** Preserves current synchronous AuthContext API; no consent-check coupling needed.

---

## manualChunks Shape (PERF-04)

### Q1: How aggressive should manualChunks be?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — just `vendor-react` + `vendor-posthog` | What ROADMAP locked. Rolldown auto-split for supabase + sentry-replay is working; explicit naming risks fighting the bundler. Less code to maintain. | ✓ |
| Comprehensive — also name vendor-sentry + vendor-supabase | Explicit vendor-sentry + vendor-supabase chunks for long-term cache stability. Wider scope; more chunks. | |
| Adaptive — ROADMAP-minimal + cache-stable hashing config | Just the two ROADMAP-named chunks + Rolldown chunk-name hash-stability config. Hybrid. | |

**User's choice:** Minimal — just `vendor-react` + `vendor-posthog`
**Notes:** Stays in scope per ROADMAP. Re-evaluate broader vendor splitting only if cache-busting becomes a real problem in a future phase.

### Q2: What goes into `vendor-react`?

| Option | Description | Selected |
|--------|-------------|----------|
| react + react-dom only | Strict. TanStack Router stays in auto-split. Smallest stable footprint; cache invalidates only on React major/minor bumps. | ✓ |
| react + react-dom + @tanstack/react-router | Bundle TanStack Router with React (always co-loaded). Slightly larger chunk; cache invalidates on TanStack Router updates too. | |
| react + react-dom + react/* + scheduler | Defensive bundle. Most stable cache; more code in the chunk-matcher. | |

**User's choice:** react + react-dom only

---

## Lighthouse PASS Threshold (PERF-07)

### Q1: What counts as PASS for the v1.3 Lighthouse mobile rerun?

| Option | Description | Selected |
|--------|-------------|----------|
| Strict 5/5 routes Performance ≥ 90 | Same criterion Phase 13 used. Anything less = DEFER. Per D-12, DEFER is acceptable. | ✓ |
| Allow 1 route DEFER if documented | PASS if 4/5 routes ≥ 90 AND the 1 below-bar route has a documented reason. Slight scope loosening. | |
| Measurement-only — decide PASS/DEFER on the day | Don't pre-lock the threshold. Most flexible; least predictable for downstream agents. | |

**User's choice:** Strict 5/5 routes Performance ≥ 90

### Q2: If the run gives DEFER, what do we commit on-disk?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-route scores + DEFER outcome line + leave UIDN-02 open | `## v1.3 Rerun` section with full per-route scores, `**v1.3 outcome: DEFER**`, 1-paragraph rationale. UIDN-02 stays open; PROJECT.md row stays ⚠️. D-12 follow-up trigger remains. | ✓ |
| Same as above + auto-close UIDN-02 with DEFER closure comment | Treat DEFER as closure too. PROJECT.md row stays ⚠️ but issue closes; D-12 trigger needs NEW issue. | |
| Same as Option A but flip Mobile-first row to ✓ with caveat | Document DEFER but flip the row anyway with footnote. Risks misrepresenting state. | |

**User's choice:** Per-route scores + DEFER outcome line + leave UIDN-02 open

---

## Plugin-Order Safety for ANALYZE=true (PERF-01)

### Q1: How should we guard against accidental `ANALYZE=true` in production builds?

| Option | Description | Selected |
|--------|-------------|----------|
| vite.config.ts throws on ANALYZE+production combo | If `process.env.ANALYZE === 'true' && process.env.NETLIFY_CONTEXT === 'production'`, throw explicit Error. Build dies before producing artifacts. Covers Netlify CI without separate workflow step. | ✓ |
| Code comment + .env.example warning only | Inline comment + .env.example warning. Lower friction; no runtime enforcement. | |
| Separate CI guard in .github/workflows/ci.yml | CI step that fails if ANALYZE=true on main. Catches GitHub Actions runs but not Netlify (separate CI). | |
| Skip — trust developer judgment | Accept no one will set ANALYZE=true on prod. Smallest scope; failure mode is silent. Not recommended given Phase 15 OBSV-04 evidence chain. | |

**User's choice:** vite.config.ts throws on ANALYZE+production combo
**Notes:** Strongest guard. Throws at config-load before any build work happens. Single check covers both Netlify and local builds. Error message must reference OBSV-04 explicitly so future maintainers immediately understand the trap.

---

## Claude's Discretion

- Exact chunk-matcher function shape inside `manualChunks` (path-includes vs regex vs Set lookup) — research/planner picks the cleanest form.
- Internal queue structure for `posthog-facade` (array of thunks vs typed event records). In-memory only; no sessionStorage persistence.
- Wording of the `vite.config.ts` throw message (terse + actionable + OBSV-04 reference).
- Exact `<picture><source type="image/webp"><img>` markup in `Navbar.tsx`. Keep existing `width`/`height` (CLS-safe).

## Deferred Ideas

- Broader vendor chunk splitting (vendor-sentry, vendor-supabase, vendor-radix) — re-evaluate in future phase only if cache-busting becomes a real problem.
- 4/5-route-with-doc-DEFER as PASS-with-caveat — rejected; strict 5/5 preserves Phase 13 intent.
- CI workflow guard against ANALYZE=true on main — rejected in favor of D-09's vite.config.ts throw (covers Netlify too).
- vite-imagetools / sharp automated WebP conversion — explicit anti-feature per ROADMAP.
- WebP polyfill / JS fallback detection — not needed; `<picture><source>` semantics handle this natively.
- A11y / Best Practices / SEO Lighthouse thresholds — out of scope; Performance only for PASS/DEFER.
