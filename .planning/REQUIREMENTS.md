# Requirements — v1.3 Hygiene & Performance

This document tracks the v1.3 milestone requirements. After v1.0 (43 of 45 reqs), v1.1 (11 of 11 reqs), and v1.2 (13 of 14 reqs) shipped — archived at [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md), [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md), and [milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md) — v1.3 closes carry-forward debt across DB, observability, test, planning-doc, and UI hygiene plus ships an aggressive perf-budget pass for UIDN-02.

**Note on v1.3 scope reframe (post-research):** Pre-research framing assumed observability hygiene (#17, #19), E2E hygiene (#11, #12, #13), and TanStack Router lazy splitting were *implementation* work. Research found these are **already shipped in source code** — Sentry `reactErrorHandler` is wired in `src/main.tsx`, Rolldown `keepNames: true` is set in `vite.config.ts`, all three Playwright spec fixes are committed, `autoCodeSplitting: true` is on, and ESLint E2E-SCOPE-1 already lives in `eslint.config.js`. v1.3 reframes these as **verify-and-close** work (smoke-test, evidence-capture, GitHub issue closure). The two anti-features (font subsetting, critical CSS) confirmed no-ops are explicit Out-of-Scope below.

**Note on D-12 / Mobile-first Key Decision row:** UIDN-02 closure mode for v1.3 = aggressive change + accept Lighthouse rerun outcome. No hard PASS gate (no "5/5 routes ≥ 90 or milestone doesn't close"). If the rerun comes back DEFER, the row stays ⚠️ Revisit and the follow-up trigger remains the next perf-budget change. Decision: ship the perf work because it's the right work; accept the measurement outcome whatever it is.

## Scope

### DB Hygiene (DBHY-*)

- [ ] **DBHY-01**: Migration 14 `CREATE OR REPLACE FUNCTION` for the 6 user-owned pre-Phase-11 `SECURITY DEFINER` functions with `SET search_path = ''` and fully-qualified body references. Functions: `update_profile_after_auth`, `handle_new_user`, `validate_vote_choice`, `increment_vote_count`, `is_current_user_admin`, `profile_self_update_allowed`. `rls_auto_enable` is carved out per W0 finding (system-owned; see DBHY-02 changelog). `increment_vote_count` body is already qualified (`INSERT INTO public.vote_counts`) per W0 production functiondef snapshot — only `SET search_path = ''` is added. `is_current_user_admin()` rewrite MUST be body-identical (only `search_path` value changes from `public` to `''`) to preserve admin RLS semantics across all admin-gated tables. Migration 14 additionally issues `DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT);` unconditionally (Cycle-3 Option A) to remove the stale 3-param overload found in production by W0 Check 1B.
  - Updated 2026-05-17 (Phase 14, W0 finding) — function count 7 → 6 (rls_auto_enable carve-out); 3-param `update_profile_after_auth` overload drop added.

- [ ] **DBHY-02**: Zero `0011_function_search_path_mutable` WARNs for all user-owned target functions; one residual WARN for `rls_auto_enable` is permitted if and only if it is extension-owned or system-owned per Phase 14 W0 finding (multi-signal classification per W0 Check 1). Confirmed via `supabase db lint --linked` (CLI 2.98.2+) post-deploy.
  - Updated 2026-05-17 (Phase 14, W0 finding) — explicit carve-out for system-owned `rls_auto_enable`.

- [ ] **DBHY-03**: `submit-vote` smoke round-trip passes after Migration 14 deploys. Verifies `increment_vote_count` trigger still resolves `public.vote_counts` correctly post-`search_path = ''`. Includes a parallel TEST-11 12-cell RLS matrix re-run to confirm `is_current_user_admin()` body rewrite did not drift admin RLS behavior.

- [ ] **DBHY-04**: `.planning/phases/.../11-PATTERNS.md` `vote_counts` policy skeleton aligned with shipped REVIEW-FIX-H3 form (service-role-only bypass; no admin OR-branch). Doc-only fix; PATTERNS.md lives inside the v1.2 phase archive but should be updated for future cross-milestone reference.

### Observability Hygiene (OBSV-*)

Continues from v1.1's OBSV-01 (Sentry sourcemap upload) + OBSV-02 (bundle delta tracking).

- [ ] **OBSV-03**: Sentry React 19 ErrorBoundary render-phase throw capture smoke-verified on Netlify deploy preview. Verification = trigger a render-phase throw via `?debug=sentry-test` overlay (or equivalent), confirm Sentry dashboard receives event with `boundary: app-root` tag, confirm stack frame names are present (cross-check OBSV-04). Close GitHub issue #17.

- [ ] **OBSV-04**: Vite/Rolldown sourcemap function-name preservation verified end-to-end. (a) Run `verify-sourcemap-names.mjs` (or equivalent build-time check) confirming production build emits literal `function Name(...)` declarations, not minified `$M`. (b) Confirm Sentry Artifacts API shows uploaded source maps for the current release. (c) Inspect a smoke-test Sentry event's stack frames in the dashboard and confirm real function names appear, not `$M`. Close GitHub issue #19.

- [ ] **OBSV-05**: `Sentry.dedupeIntegration()` behavior smoke-verified — triple-handler path (`createRoot.onCaughtError` + `ErrorBoundary.onError` + auto-capture) collapses to one event per error, but verification scenarios use DISTINCT error messages per case (`new Error('OBSV-03 render')`, `new Error('OBSV-04 sourcemap')`) to prevent Dedupe from masking the second event. Verification uses `Sentry.lastEventId()` to confirm capture independent of transport flush.

### Test/E2E Hygiene (TEST-*)

Continues from v1.2's TEST-13 (Playwright @smoke SC4 round-trip).

- [ ] **TEST-14**: `e2e/tests/admin-create.spec.ts` passes in CI on `main`. Confirms the committed Yes/No preset click fix resolves the original "doesn't populate Choice 1/2" issue (#11). Close GitHub issue #11.

- [ ] **TEST-15**: `e2e/tests/browse-respond.spec.ts` passes in CI on `main`. Confirms the committed `freshPoll` fixture + `[1-9]\d*` non-zero regex resolves the original "asserts vote count on fixture polls with zero votes" issue (#12). Close GitHub issue #12.

- [ ] **TEST-16**: `e2e/tests/filter-search.spec.ts` passes in CI on `main`. Confirms the committed `E2E_TITLE` prefix filter on `toHaveCount()` resolves the original "two-layer seed count" issue (#13). Close GitHub issue #13.

### Perf-Budget Pass (PERF-*)

UIDN-02 carry-forward perf-budget trigger work. Implements the 5 surviving perf-pass changes after research rejected font subsetting and critical CSS as anti-features. Concludes with a single Lighthouse rerun per D-13.

- [ ] **PERF-01**: `rollup-plugin-visualizer@7.0.1` added as dev-dependency. Integrated in `vite.config.ts` `plugins[]` env-gated via `ANALYZE=true` — when set, visualizer runs and Sentry vite plugin is disabled (both require last position, so they're mutually exclusive). Never always-on. `npm run build:analyze` script added.

- [ ] **PERF-02**: Bundle audit baseline captured via `ANALYZE=true npm run build` against the current `main`. Treemap evidence written to `.planning/closure/v1.3-bundle-audit-pre.html` (or similar). Confirms PostHog (`posthog-js/dist/module.full.js`, ~420 KB unminified) is in the main critical-path chunk and that admin routes are already split. Establishes the baseline against which PostHog lazy-load + manualChunks deltas will be measured.

- [ ] **PERF-03**: PostHog converted to dynamic `import('posthog-js/react')` inside `ConsentProvider` (or equivalent lazy-load location). Refactor preserves: (a) the GDPR consent-gate fires before any PostHog capture events are sent, (b) `PostHogProvider` is still available to the component tree once the consent allow path resolves. Bundle audit post-change confirms ~180–200 KB removed from the critical-path chunk.

- [ ] **PERF-04**: `build.rolldownOptions.output.manualChunks` configured in `vite.config.ts` to split `vendor-react` and `vendor-posthog` into named cache-stable chunks. Verifies via re-run of `ANALYZE=true npm run build` that the chunks land at the expected sizes and the app-only chunks don't bloat.

- [ ] **PERF-05**: `src/assets/wtcs-logo.png` converted to `wtcs-logo.webp` (manual conversion — `vite-imagetools`/`sharp` are explicit Out-of-Scope per anti-feature research). `<picture><source type="image/webp"><img></picture>` added in `src/components/layout/Navbar.tsx` (and any other site that renders the logo) with explicit width/height to prevent CLS. PNG fallback retained for Safari < 14 / non-WebP user agents (negligible at current Discord-user base but trivial cost).

- [ ] **PERF-06**: `createRouter({ defaultPreload: 'intent' })` added in `src/main.tsx` (or wherever the router is instantiated). One-line change covers all `<Link>` navigation app-wide.

- [ ] **PERF-07**: Single Lighthouse mobile rerun executed against the v1.3-post-deploy production build via `audit-mobile.sh` per D-13 (single-run policy). Per-route delta vs the v1.2 baseline recorded in `.planning/closure/UIDN-02-mobile-evidence.md § v1.3 Rerun`. Outcome = PASS (5/5 routes Perf ≥ 90) or DEFER (any route below). On PASS: PROJECT.md `Mobile-first responsive design` Key Decision row flips ⚠️ → ✓; UIDN-02 carry-forward closes. On DEFER: row stays ⚠️ Revisit; follow-up trigger remains D-12 (next perf-budget change). Either outcome is acceptable.

### Documentation Hygiene (DOCS-*)

Continues from v1.1's DOCS-01 through DOCS-04.

- [ ] **DOCS-05**: VALIDATION.md frontmatter refreshed on Phase 01, 02, 03, 04 archives — `status: complete`, `nyquist_compliant: true`. Phase 05/06 already complete. Surfaces from v1.0 RETROSPECTIVE Lesson 1 ("Refresh validation frontmatter as part of `complete` step").

- [ ] **DOCS-06**: Phase 03 VERIFICATION.md retrospective written. Status `retrospective`. Captures: Phase 03 deliverables (guild membership + rate limiting) shipped + UAT 4/4 + Phase 05 transitive re-verification. Includes a "Subsequent evolution" section listing migrations 3–9 that touched the auth path post-Phase 03 (most recently Migration 14 from DBHY-01 — `update_profile_after_auth` + `is_current_user_admin` rewrite — for accuracy at write-time).

- [ ] **DOCS-07**: 17 SUMMARY frontmatter `requirements-completed` declarations backfilled across phases 02 + 03-02 + 04-02/04-04 + 01-04. Cross-referenced against VERIFICATION.md / archive REQUIREMENTS to confirm REQ-ID coverage. Surfaces from v1.0 RETROSPECTIVE Lesson 1.

- [ ] **DOCS-08**: v1.1 MILESTONES.md entry written. Manual curation — `gsd-sdk query milestone.complete` auto-extraction produces noisy stubs (lesson from v1.2 RETROSPECTIVE). Uses v1.2 MILESTONES.md entry as the canonical template. Closes the v1.1-shaped "entry never written" gap permanently (RETROSPECTIVE flagged as v1.3+ hygiene candidate).

### UI Hygiene (UIDN-*)

Continues from v1.0's UIDN-01..03. UIDN-03-FOLLOWUP-LIST-CARDS from v1.1 audit transparency note.

- [ ] **UIDN-04**: `AdminsList.tsx` + `CategoriesList.tsx` outer hand-rolled `<div>` containers replaced with shadcn `<Card>/<CardHeader>/<CardTitle>/<CardContent>` wrappers. Card composition follows shadcn's documented pattern — one `<Card>` per list section, rows inside `<CardContent>` with `divide-y` for visual separation. Anti-pattern: do NOT wrap each row in its own `<Card>` (creates over-segmentation). Snapshot tests will churn (className-only diffs from utility-class additions); update snapshots in the same commit; review diffs explicitly to confirm no structural regressions.

- [ ] **UIDN-05**: `PromoteAdminDialog.tsx` search-results inner container replaced with shadcn `<Card>/<CardContent>` (if Phase 17 audit confirms the original UIDN-03 flag still applies). Same Card composition pattern as UIDN-04. Accessibility check: confirm dialog ARIA roles + `aria-labelledby` survive the migration (Card primitive uses generic `<div>` — no role conflict with the parent Dialog).

## Future Requirements (deferred to v1.4+)

- **Phase 04 UAT 6a backfill** — demote click flow second-admin live test (gated on second admin Discord ID signing in with 2FA enabled). Demote source-tested via 13 unit tests; live two-admin smoke still pending. v1.0 carry-forward; deferred again per v1.3 scoping decision.
- **Phase 03 UAT tests 2 + 3 backfill** — non-member rejection + invite link with second human (2FA-enabled, non-WTCS-member Discord tester). Gated on tester availability. v1.0 carry-forward; deferred again.
- **Local supabase-edge-runtime ES256 verification bug** — 1.73.x rejects auth-service-issued ES256 JWTs; affects `npm run test:integration` only; production unaffected (JWKS discovery). Awaiting upstream Supabase fix; v1.2 carry-forward; deferred again.

## Out of Scope (v1.3)

- **Font subsetting via `@fontsource/inter` or equivalent** — Inter is currently a system-font-only stack (no `@font-face`, no Google Fonts `<link>` in `index.html`); adding a web-font download would introduce LCP regression where none exists. Research-confirmed no-op. (See `v1.3-FEATURES.md` § Work-stream 1 anti-features.)

- **Critical CSS extraction via `rollup-plugin-critical` / `vite-plugin-critical`** — empty `<div id="root">` SPA has no crawlable above-fold content for extraction; Tailwind v4 already tree-shakes to only-used utility classes. Research-confirmed no-op.

- **`vite-imagetools` / `sharp` native binary** — disproportionate (~50 MB install) for a single 12 KB logo conversion. Manual WebP conversion in PERF-05 is the right tool.

- **ESLint E2E-SCOPE-1 `no-restricted-syntax` rule addition** — verified present in `eslint.config.js` (added in v1.1 Phase 8 per `v1.1-PLAYWRIGHT-FIXTURES.md` prescription). No work needed in v1.3.

- **`reveal-poll-results` / VIS-WINDOW / VIS-PUBLIC-MODE** — v1.2 deferred items; still deferred. No new admin visibility surfaces in v1.3.

- **NOTF-01, NOTF-02 (Discord webhook notifications)** — v2 territory; out of v1.3.

- **ANLT-01, ANLT-02 (Admin analytics dashboard)** — v2 territory; out of v1.3.

- **ABSE-01 (Cloudflare Turnstile CAPTCHA)** — v2 territory; out of v1.3.

- **Geo-gating for Russian users** — sister-site behavior; VPN handles ISP-level blocks user-side. Permanently out of scope per PROJECT.md Out of Scope table.

- **Fake admin Discord IDs cleanup in production seed** — v1.0 audit tech_debt; still open; not in v1.3 (separate data-hygiene task, low-stakes).

- **Leftover `[E2E] Test:` polls cleanup in shared DB** — v1.0 audit tech_debt; still open; not in v1.3 (separate data-hygiene task, low-stakes).

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| DBHY-01 | Phase 14 | Pending |
| DBHY-02 | Phase 14 | Pending |
| DBHY-03 | Phase 14 | Pending |
| DBHY-04 | Phase 14 | Pending |
| OBSV-03 | Phase 15 | Pending |
| OBSV-04 | Phase 15 | Pending |
| OBSV-05 | Phase 15 | Pending |
| TEST-14 | Phase 15 | Pending |
| TEST-15 | Phase 15 | Pending |
| TEST-16 | Phase 15 | Pending |
| PERF-01 | Phase 16 | Pending |
| PERF-02 | Phase 16 | Pending |
| PERF-03 | Phase 16 | Pending |
| PERF-04 | Phase 16 | Pending |
| PERF-05 | Phase 16 | Pending |
| PERF-06 | Phase 16 | Pending |
| PERF-07 | Phase 16 | Pending |
| DOCS-05 | Phase 17 | Pending |
| DOCS-06 | Phase 17 | Pending |
| DOCS-07 | Phase 17 | Pending |
| DOCS-08 | Phase 17 | Pending |
| UIDN-04 | Phase 17 | Pending |
| UIDN-05 | Phase 17 | Pending |

*(UIDN-05 may close as no-op if Phase 17 audit confirms PromoteAdminDialog already meets the Card pattern.)*

---

*Last updated: 2026-05-14 — v1.3 roadmap created. 23 requirements across 6 categories (DBHY ×4 / OBSV ×3 / TEST ×3 / PERF ×7 / DOCS ×4 / UIDN ×2) mapped to 4 phases: Phase 14 (DB hygiene) → Phase 15 (obs+E2E verify) → Phase 16 (perf pass) → Phase 17 (docs+UI sweep). Coverage: 23/23.*
