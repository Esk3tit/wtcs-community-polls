# Requirements — v1.1 Hygiene & Polish

**Milestone:** v1.1 (post-launch hygiene/polish on v1.0 — Launch-Ready MVP shipped 2026-04-28)
**Status:** Defining (awaiting approval)
**Started:** 2026-04-28

**Goal:** Close v1.0 carry-forward debt — UI polish closure evidence, observability robustness, E2E test hygiene, and planning artifact backfill — so the platform is audit-clean before v1.2 (Admin Visibility Controls — SEED-002) feature work begins.

**Out of scope for v1.1:** New product features (deferred to v1.2 per SEED-002), LHCI in CI (deferred to v1.2 to honor $0 budget), full fixture-to-Playwright-fixtures migration (hybrid approach kept).

---

## v1.1 Requirements

### Observability

- [ ] **OBSV-01**: Sentry captures render-phase errors via the Sentry transport — wire `Sentry.reactErrorHandler()` into React 19's `createRoot({ onCaughtError, onUncaughtError, onRecoverableError })`; keep `Sentry.ErrorBoundary` for fallback UI; add belt-and-suspenders manual `Sentry.captureException` in `onError`. Verified by a render-throw smoke component on a Netlify deploy preview (NOT dev — StrictMode masks).<br>_GitHub: #17 — research: `.planning/research/v1.1-SENTRY-ERRORBOUNDARY.md`_

- [ ] **OBSV-02**: Production Sentry stack frames show original function names (not `xR`-style mangled identifiers) — set `build.rolldownOptions.output.keepNames: true` in `vite.config.ts`. Verified by inspecting a built `.map`'s `names[]` array and confirming `__name(…)` calls in chunks. Bundle-size delta (~0.5–1.5% gzip) documented.<br>_GitHub: #19 — research: `.planning/research/v1.1-VITE-SOURCEMAPS.md`_

### Testing

- [ ] **TEST-07**: Three failing Playwright specs (admin-create, browse-respond, filter-search) pass under the canonical two-layer seed by scoping shared-DB list locators to `[E2E]`-prefixed entries via `Locator.filter({ hasText: /^\[E2E/ })`. browse-respond.spec.ts also casts a vote inside the test before asserting `[1-9]\d*` total responses.<br>_GitHub: #11, #12, #13 — research: `.planning/research/v1.1-PLAYWRIGHT-FIXTURES.md`_

- [ ] **TEST-08**: ESLint `no-restricted-syntax` rule prevents unscoped list locators from landing in `e2e/tests/**/*.spec.ts` — any `page.locator(...).all()` / `.nth(n)` / `.first()` on a shared-DB list without a preceding `.filter({ hasText: /^\[E2E/ })` fails lint. Convention documented in `e2e/README.md` (or equivalent).

- [ ] **TEST-09**: Playwright test-scoped `freshPoll` fixture provides per-test mutable state with cleanup around `await use()` — hybrid model: SQL seeds keep static reference data (categories, auth users), fixtures own per-test poll/vote rows.

- [ ] **TEST-10**: Phase 03 UAT tests 2 + 3 executed with a second human (no 2FA on Discord account) — covers non-member rejection at OAuth callback and invite-link flow. Evidence appended to `.planning/phases/03-response-integrity/03-UAT.md`.

### UI & Design

- [ ] **UIDN-02**: Mobile-first responsive design closure evidence captured — Lighthouse mobile audit (Perf≥90, A11y≥95, BP≥95, SEO≥90) + 6-width breakpoint matrix (320/375/414/768/1024/1440 px) with screenshots per top-level route. Output: `.planning/closure/UIDN-02-mobile-evidence.md`. Flips `Mobile-first responsive design` Key Decision from ⚠️ Revisit → ✓ Good.<br>_GitHub: #18 — research: `.planning/research/v1.1-MOBILE-AUDIT.md`_

- [ ] **UIDN-03**: shadcn polish closure evidence captured — 12-item per-route consistency checklist applied across all top-level routes (token usage, Button variants, spacing scale, etc.). Output: `.planning/closure/UIDN-03-shadcn-audit.md`. Flips `shadcn/ui + Tailwind CSS v4 (Maia/Neutral)` Key Decision from ⚠️ Revisit → ✓ Good. **Blocked on UIDN-04.**

- [ ] **UIDN-04**: shadcn style canonicality investigated and reconciled — `components.json` declares `"new-york"` while `DESIGN-SYSTEM.md` and PROJECT.md Constraints claim `"Maia"`. Discovery task: visually diff installed components against both presets to determine which was actually built against; update the two losing surfaces to match the winner. Output: ADR-style note appended to `DESIGN-SYSTEM.md` documenting the decision. **Blocks UIDN-03.**

### Documentation / Planning Hygiene

- [ ] **DOCS-01**: VALIDATION.md frontmatter backfilled on phases 01, 02, 03, 04 — bring all four legacy phase dirs in line with the post-Phase-05 frontmatter schema used in 05/06.

- [ ] **DOCS-02**: Phase 03 VERIFICATION.md retrospective written — Phase 03 closed without a VERIFICATION.md per the v1.0 audit; backfill so the phase has a closure record consistent with phases 01/02/04/05/06.

- [ ] **DOCS-03**: SUMMARY frontmatter `requirements-completed` declared on the 17 SUMMARY files flagged by the v1.0 milestone audit (`.planning/milestones/v1.0-MILESTONE-AUDIT.md`) — declarations bring these files into traceability table compliance.

- [ ] **DOCS-04**: Phase 04 UAT test 6a (demote click flow) evidence backfilled — test passed off-record on a second admin during v1.0 → v1.1 transition; append the evidence to `.planning/phases/04-admin-panel-suggestion-management/04-UAT.md` and mark complete.

---

## Future Requirements (deferred from v1.1 scoping)

- **LHCI in CI** — Lighthouse Continuous Integration in GitHub Actions for regression detection on every PR. Deferred to v1.2 to honor $0/month constraint (LHCI server hosting + storage cost; one-off CLI is sufficient for v1.1 closure evidence).
- **Full fixture migration** — replacing all SQL seeds with Playwright `test.extend` fixtures. Deferred — hybrid model in TEST-09 is sufficient; full migration would 2x the e2e refactor scope.

## Out of Scope

| Item | Reason |
|------|--------|
| Admin-controlled per-suggestion results visibility (Tim's ask) | Captured as SEED-002, scheduled for v1.2 — not hygiene work |
| New product features generally | v1.1 is hygiene/polish only by design |
| LHCI server / hosted regression dashboards | $0 budget; one-off Lighthouse CLI is sufficient for closure evidence |
| Full Playwright fixture rewrite | Hybrid model in TEST-09 is sufficient; full migration would inflate scope |
| Sentry React SDK upgrade beyond v10 | v10 is current at v1.0 ship; no driver for upgrade in v1.1 |
| shadcn restyle / preset migration (e.g., flipping Maia ↔ new-york wholesale) | UIDN-04 reconciles the documentation discrepancy only — no component restyle |

---

## Traceability

_Populated by roadmapper after ROADMAP.md is approved._

| REQ-ID | Phase | Status |
|--------|-------|--------|
| OBSV-01 | TBD | Pending |
| OBSV-02 | TBD | Pending |
| TEST-07 | TBD | Pending |
| TEST-08 | TBD | Pending |
| TEST-09 | TBD | Pending |
| TEST-10 | TBD | Pending |
| UIDN-02 | TBD | Pending |
| UIDN-03 | TBD | Pending (blocked on UIDN-04) |
| UIDN-04 | TBD | Pending (blocks UIDN-03) |
| DOCS-01 | TBD | Pending |
| DOCS-02 | TBD | Pending |
| DOCS-03 | TBD | Pending |
| DOCS-04 | TBD | Pending |
