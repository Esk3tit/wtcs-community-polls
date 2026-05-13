---
requirement: UIDN-02
audited: 2026-05-05
audit_url: https://polls.wtcsmapban.com
targets:
  performance: 90
  accessibility: 95
  best_practices: 95
  seo: 90
status: deferred-v1.2 — 4/5 routes under threshold; follow-up tied to next perf-budget change
audited_v1_2: 2026-05-13
phase: 09-ui-closure-evidence
plan: 03
---

# UIDN-02 Mobile Evidence — Lighthouse + Breakpoint Matrix

Mobile-first responsive design closure evidence for the v1.1 milestone (Issue #18). Captures a Lighthouse 13.2.0 mobile audit on 5 production routes (D-05) and a 6-width × 7-route Playwright screenshot matrix (5 unauth prod + 2 auth local; D-06 + RESEARCH Pattern 2 Option A). The audit ran end-to-end (ROADMAP § Phase 9 Success Criterion #2 satisfied), but the F2 hard gate (zero failed Lighthouse routes AND zero F6 DOM-assertion warnings) did not clear, so the `Mobile-first responsive design` row in PROJECT.md Key Decisions stays at `⚠️ Revisit` per Path 3 (defer). The deferred rerun is queued via the sign-off's follow-up token.

## Method

- **Lighthouse 13.2.0** (`npx -y lighthouse@13.2.0` — pinned per `audit-mobile.sh`) over the 5-route set against `https://polls.wtcsmapban.com` (D-03 — production target). Flags: `--form-factor=mobile --throttling-method=simulate --only-categories=performance,accessibility,best-practices,seo --chrome-flags="--headless=new --no-sandbox"`. Harness: `.planning/closure/audit-mobile.sh`.
- **Playwright 1.59.1** (`@playwright/test` chromium) — two passes per `audit-screenshots.mjs`:
  - **Pass A — unauth prod:** 6 widths (320/375/414/768/1024/1440 px) × 5 routes (`/`, `/topics`, `/archive`, `/auth/error`, `/admin`) = 30 PNGs. `setViewportSize` BEFORE `goto` (Pitfall 4).
  - **Pass B — auth local:** 6 widths × 2 sub-routes (`/admin/suggestions/new`, `/admin/suggestions/d0000000-0000-0000-0000-000000000001/edit` — fixture poll ID) = 12 PNGs. Auth via Phase 8 `loginAs` analog (`signInWithPassword` against local Supabase; in-memory `addInitScript` — no on-disk storage state).
- **Single-run policy** (RESEARCH Pitfall 1): each route audited once. Score variance ±5–10pp is expected; D-14 ship-anyway analog applies if any row falls under threshold by 1–3pp.

## Lighthouse mobile scores (production)

| Route | Perf (≥90) | A11y (≥95) | BP (≥95) | SEO (≥90) | Final URL (after redirects) |
|-------|------------|-------------|-----------|-----------|------------------------------|
| / | 82 | 100 | 100 | 92 | https://polls.wtcsmapban.com/ |
| /topics | 88 | 100 | 100 | 92 | https://polls.wtcsmapban.com/topics |
| /archive | 86 | 100 | 100 | 92 | https://polls.wtcsmapban.com/archive |
| /auth/error | 85 | 100 | 100 | 92 | https://polls.wtcsmapban.com/auth/error?reason=auth-failed |
| /admin | 86 | 100 | 100 | 92 | https://polls.wtcsmapban.com/ |

Reports: `.planning/closure/artifacts/lighthouse/lh-mobile-<name>.report.{html,json}` (gitignored per `.gitignore`; paths above are reproducible by re-running `audit-mobile.sh`).

**Artifacts (sha256-pinned per F1 / Decision A):** see `.planning/closure/artifacts/MANIFEST.json` (un-ignored from `.gitignore` — IS committed). Each Lighthouse report + screenshot has a `{path, sha256, sizeBytes, recordedAt, kind}` entry recorded by the harness scripts. Reviewers can verify a referenced artifact existed at run-time even though the binary is not committed. This run produced 52 manifest entries (10 lighthouse + 42 screenshot). Sample entry:
```json
{ "path": ".planning/closure/artifacts/screenshots/bp-375-home.png",
  "sha256": "<64-char hex>", "sizeBytes": <int>,
  "recordedAt": "<ISO timestamp>", "kind": "screenshot" }
```

**`/admin` redirect note** (RESEARCH Open Q #2): the `/admin` row's final URL is `https://polls.wtcsmapban.com/` — the `AdminGuard` wrapper redirects unauthenticated visitors back to the home route. The Lighthouse score above reflects the redirect target's experience, which IS the public unauthenticated `/admin` UX (D-06). This is expected and does not affect the audit's interpretation; the `/` row separately captures the home route's score directly (P=82 vs the redirect-followed P=86 — variance is within Pitfall 1's ±5–10pp band).

**Pitfall 1 disposition (D-14 ship-anyway analog).** All 5 routes scored under the Performance ≥90 threshold by 2–8pp gaps:
- `/`: P=82 (gap 8pp)
- `/topics`: P=88 (gap 2pp)
- `/archive`: P=86 (gap 4pp)
- `/auth/error`: P=85 (gap 5pp)
- `/admin`: P=86 (gap 4pp, redirect-followed)

Accessibility (≥95), Best-Practices (≥95), and SEO (≥90) all PASS on every route (A11y=100, BP=100, SEO=92 across the board). The Performance misses are within Pitfall 1's single-run variance band for `/topics` and arguably `/archive`/`/admin`/`/auth/error`, but `/`'s 8pp gap exceeds the 1–3pp ship-anyway window. Per the F2 hard gate (`audit-mobile.sh` exit==0 AND zero F6 warnings), this run does NOT clear the gate; the deferred rerun (see Sign-off) queues the audit behind the v1.2 perf budget hit, which is the appropriate scope for an under-target Performance value (vs an isolated ±2pp variance blip).

## Breakpoint matrix (42 PNGs)

| Width | / | /topics | /archive | /auth/error | /admin (unauth) | /admin/suggestions/new (auth, local) | /admin/suggestions/$id/edit (auth, local) |
|-------|---|---------|----------|-------------|-----------------|---------------------------------------|--------------------------------------------|
| 320px  | bp-320-home.png  | bp-320-topics.png  | bp-320-archive.png  | bp-320-auth-error.png  | bp-320-admin.png  | bp-320-admin-suggestions-new.png  | bp-320-admin-suggestions-id-edit.png  |
| 375px  | bp-375-home.png  | bp-375-topics.png  | bp-375-archive.png  | bp-375-auth-error.png  | bp-375-admin.png  | bp-375-admin-suggestions-new.png  | bp-375-admin-suggestions-id-edit.png  |
| 414px  | bp-414-home.png  | bp-414-topics.png  | bp-414-archive.png  | bp-414-auth-error.png  | bp-414-admin.png  | bp-414-admin-suggestions-new.png  | bp-414-admin-suggestions-id-edit.png  |
| 768px  | bp-768-home.png  | bp-768-topics.png  | bp-768-archive.png  | bp-768-auth-error.png  | bp-768-admin.png  | bp-768-admin-suggestions-new.png  | bp-768-admin-suggestions-id-edit.png  |
| 1024px | bp-1024-home.png | bp-1024-topics.png | bp-1024-archive.png | bp-1024-auth-error.png | bp-1024-admin.png | bp-1024-admin-suggestions-new.png | bp-1024-admin-suggestions-id-edit.png |
| 1440px | bp-1440-home.png | bp-1440-topics.png | bp-1440-archive.png | bp-1440-auth-error.png | bp-1440-admin.png | bp-1440-admin-suggestions-new.png | bp-1440-admin-suggestions-id-edit.png |

All paths relative to `.planning/closure/artifacts/screenshots/` (gitignored). Re-runnable via `node .planning/closure/audit-screenshots.mjs`.

**F6 DOM-assertion warnings (6 total).** `audit-screenshots.mjs` emitted six `[unauth] WARN bp-W-archive: page body did not match mustSee=/archive|past|closed/i` lines — one per breakpoint width on the `/archive` route. Inspection of the captured PNGs (and a sha1 cross-check) confirms these are not Archive-page rendering bugs — they are pre-hydration SPA loading shells. All four 320px unauth PNGs (`bp-320-home.png`, `bp-320-topics.png`, `bp-320-archive.png`, `bp-320-admin.png`) share the byte-identical sha1 `54d4f4916284725f214b6649237d7051785b9672`, indicating the harness's `goto`/`waitFor` strategy returned before React hydration completed and captured the same loading-shell HTML for every route (only `bp-320-auth-error.png` differs — the auth-error route is a static error page that renders pre-hydration). This pattern repeats across all 30 unauth-prod PNGs (6 widths × 5 routes).

The `/archive` warnings surface only because that route's `mustSee` regex (`/archive|past|closed/i`) doesn't match the loading-shell DOM, while the home/topics/admin routes' regexes happen to coincidentally match generic shell text. The defect is in Plan 02's harness wait strategy (a hydration-wait fix is required), not in the application's responsive design. The Pass-B (12 auth-local PNGs at `localhost:4173`) appears unaffected by this in stdout (no WARN lines) — likely because the local-preview build's faster TTI lets hydration complete before the screenshot fires — but the 30 unauth-prod PNGs cannot be relied on for visual review until the harness is fixed.

This is the second leg blocking the F2 gate (alongside the Performance misses above). The defer follow-up captures both.

## Auth-pass disposition

Pass-B (`/admin/suggestions/*`) screenshots were captured against a **local preview build** (`npm run preview` on port 4173) using a Phase 8 fixture admin session, NOT against production (RESEARCH Pattern 2 Option A). Rationale: Phase 8's `loginAs` mints sessions via `signInWithPassword` against local Supabase fixture users (`e2e/helpers/auth.ts:71-114`); production uses real Discord OAuth and has no fixture seed. The marginal value of true-prod auth screenshots is low for a polish audit (same Vite bundle, same tokens, same components — no rendering difference between local-build and prod-build for these routes). Caveat: data-driven CSS (e.g. truncation at content-length boundaries) may differ; flagged for Pass-B reviewers.

The 12 auth-local PNGs landed without F6 warnings (the harness's hydration-wait defect that affected Pass-A apparently does not surface on the local preview build at `:4173`, where hydration completes before the screenshot timer fires). The auth-local pass is therefore the sounder evidence subset for visual review of `/admin/suggestions/*` rendering across the 6-width matrix; the 30 unauth-prod PNGs should be re-captured after the Plan 02 harness fix lands.

## Cross-references

- **`.planning/phases/09-ui-closure-evidence/09-CONTEXT.md` D-01..D-06** — locked decisions on closure-evidence shape (D-01/D-02), audit target (D-03 — prod), harness location (D-04 — `.planning/closure/`), Lighthouse 5-route set (D-05), and `/admin` guest-run (D-06).
- **`.planning/phases/09-ui-closure-evidence/09-RESEARCH.md`** — Lighthouse 13.2.0 flag verification (Pitfall 2), score-variance D-14 analog (Pitfall 1 — directly applied above), local-server probe (Pitfall 5), `/admin` redirect documentation (RESOLVED Open Q #2).
- **`.planning/phases/09-ui-closure-evidence/09-PATTERNS.md`** — `UIDN-02-mobile-evidence.md` section reuse pattern from OBSV-02-bundle-delta.md (analog).
- **`.planning/closure/OBSV-02-bundle-delta.md`** — Phase 7 closure-evidence shape analog (italics-form sign-off, frontmatter, method/results/cross-refs/sign-off layout).
- **`.planning/closure/audit-mobile.sh`** — Lighthouse harness; re-run via `bash .planning/closure/audit-mobile.sh`.
- **`.planning/closure/audit-screenshots.mjs`** — Playwright harness; re-run via `node .planning/closure/audit-screenshots.mjs` (with local preview + Supabase up). Hydration-wait fix queued as part of the deferred rerun.
- **`.planning/closure/artifacts/MANIFEST.json`** — sha256-pinned record of all 52 artifacts produced by this run (10 Lighthouse + 42 screenshot).
- **`.planning/ROADMAP.md` § Phase 9** — UIDN-02 Success Criterion #2 (audit ran end-to-end — SATISFIED by this evidence file); Success Criterion #4 (Mobile-first ⚠️ → ✓) is PARTIAL on Path 3 (defer); Success Criterion #5 (no `src/` edits) — SATISFIED (this plan ships zero `src/` changes).
- **GitHub Issue #18** — UIDN-02 + UIDN-03 closure tracking issue.

---
_Audited: 2026-05-05 against https://polls.wtcsmapban.com (Lighthouse 13.2.0 + Playwright 1.59.1)_
_Method: 5-route Lighthouse mobile audit + 6-width × 7-route screenshot matrix; harness at `.planning/closure/audit-{mobile.sh,screenshots.mjs}`_
_Disposition: UIDN-02 deferred — row stays ⚠️ Revisit; rerun audit after v1.2 perf budget hit + Plan 02 harness hydration-wait fix._


## v1.2 Rerun (2026-05-13)

Phase 13 reruns the UIDN-02 audit after Plan 13-01 fixed the Phase 9 Plan 02 harness hydration-wait defect (sentinel swap, member context for authenticated `/topics` + `/archive`, route reduction, sha256 dupe-check with D-19 whitelist). The Lighthouse audit ran once against the v1.2 production deploy (Phase 12 merge commit `de15e33`); per D-13 single-run policy, the numbers below are the only ones recorded.

### Harness changes (Phase 13)

- **Sentinel fix (D-01..D-04):** replaced the fragile `body.locator().filter({hasText}).waitFor()` with a deterministic `[aria-label="Toggle color theme"]` waitFor against the unconditionally-rendered Navbar theme-toggle (Navbar.tsx:76). Soft 10 s timeout with `.catch(() => {})` preserved; sha256 dupe-check is the hard backstop.
- **UNAUTH_ROUTES reduction (D-09):** dropped `/topics` and `/archive` from Pass-A (AuthGuard renders `<LandingPage />` in place for unauth visitors → PNGs byte-identical to `/` unauth at every width). `/admin` retained as Phase 9 D-06 evidence; per-width home↔admin sha256 collision is whitelisted (D-19), not a regression.
- **Member context (D-07/D-08):** added a second Playwright context using `playwright-user-member@test.local` to capture authenticated `/topics` and `/archive` at six widths; admin/`*` auth pass continues to use `playwright-user-admin@test.local`. Constants inline-mirrored from `e2e/fixtures/test-users.ts:21-30` per D-23 (.mjs cannot runtime-import .ts).
- **sha256 uniqueness gate (D-05/D-06/D-19):** rejects any unexpected collision before MANIFEST write; per-width `bp-{W}-home.png ↔ bp-{W}-admin.png` whitelisted as the legitimate Phase 9 D-06 collision. v1.2 run reports `42 PNGs, 6 allowed home↔admin collision pairs per D-19, 0 unexpected collisions`.

### Lighthouse mobile scores (v1.2 production)

| Route | Perf (≥90) | A11y (≥95) | BP (≥95) | SEO (≥90) | Final URL | Status |
|-------|------------|-------------|-----------|-----------|-----------|--------|
| / | 85 | 100 | 100 | 92 | https://polls.wtcsmapban.com/ | FAIL Perf=85 |
| /topics | 86 | 100 | 100 | 92 | https://polls.wtcsmapban.com/topics | FAIL Perf=86 |
| /archive | 88 | 100 | 100 | 92 | https://polls.wtcsmapban.com/archive | FAIL Perf=88 |
| /auth/error | 85 | 100 | 100 | 92 | https://polls.wtcsmapban.com/auth/error?reason=auth-failed | FAIL Perf=85 |
| /admin | 94 | 100 | 100 | 92 | https://polls.wtcsmapban.com/ | PASS |

Single-run record, no rerun (D-13). All four failing routes miss only on Performance; A11y, BP, and SEO clear thresholds on every route. `audit-mobile.sh` exit=1 (4/5 failing routes). Canonical exit log at `.planning/closure/artifacts/lighthouse/audit-mobile.stdout.log` (D-27 mktemp+bash-c+cp capture pattern; final line `exit=1`). Per-route .report.json + .report.html files at `.planning/closure/artifacts/lighthouse/lh-mobile-*.report.{html,json}` (gitignored; sha256-pinned in MANIFEST.json).

(v1.1 baseline for comparison: `/` 82 → 85 (+3); `/topics` 88 → 86 (−2); `/archive` 86 → 88 (+2); `/auth/error` 85 → 85 (=0); `/admin` 86 → 94 (+8). Net: small movement within the ±5–10pp Lighthouse simulate variance band; `/admin` made the only meaningful gain.)

### Breakpoint matrix (42 PNGs — v1.2)

| Width | Pass A — unauth prod (3 routes × 6 widths = 18 PNGs) | Pass B — admin (adminUser, 2 routes × 6 widths = 12 PNGs) | Pass B — member (memberUser, 2 routes × 6 widths = 12 PNGs) |
|-------|-------------------------------------------------------|------------------------------------------------------------|--------------------------------------------------------------|
| 320px  | bp-320-home.png · bp-320-auth-error.png · bp-320-admin.png    | bp-320-admin-suggestions-new.png · bp-320-admin-suggestions-id-edit.png   | bp-320-topics.png · bp-320-archive.png  |
| 375px  | bp-375-home.png · bp-375-auth-error.png · bp-375-admin.png    | bp-375-admin-suggestions-new.png · bp-375-admin-suggestions-id-edit.png   | bp-375-topics.png · bp-375-archive.png  |
| 414px  | bp-414-home.png · bp-414-auth-error.png · bp-414-admin.png    | bp-414-admin-suggestions-new.png · bp-414-admin-suggestions-id-edit.png   | bp-414-topics.png · bp-414-archive.png  |
| 768px  | bp-768-home.png · bp-768-auth-error.png · bp-768-admin.png    | bp-768-admin-suggestions-new.png · bp-768-admin-suggestions-id-edit.png   | bp-768-topics.png · bp-768-archive.png  |
| 1024px | bp-1024-home.png · bp-1024-auth-error.png · bp-1024-admin.png | bp-1024-admin-suggestions-new.png · bp-1024-admin-suggestions-id-edit.png | bp-1024-topics.png · bp-1024-archive.png |
| 1440px | bp-1440-home.png · bp-1440-auth-error.png · bp-1440-admin.png | bp-1440-admin-suggestions-new.png · bp-1440-admin-suggestions-id-edit.png | bp-1440-topics.png · bp-1440-archive.png |

Pass A captured against `https://polls.wtcsmapban.com` (production); Pass B against `http://localhost:4173` (local preview built with `VITE_SUPABASE_URL=http://localhost:54321` so the SPA's supabase-js storage key matches the harness's session injection — see Plan 13-01 SUMMARY operational note). Zero F6 DOM-assertion warnings (`All DOM assertions matched.`); zero unexpected sha256 collisions; 6 expected home↔admin per-width pairs whitelisted per D-19 (Phase 9 D-06 AdminGuard → LandingPage at `/` evidence preserved).

### Cross-references (new for v1.2)

- `.planning/phases/13-uidn-02-mobile-audit-closure/13-CONTEXT.md` — D-01..D-27 locked decisions (sentinel, harness shape, dupe-check whitelist, single-run policy, multi-category MISS wording, zsh+rm-rf-safe log capture)
- `.planning/phases/13-uidn-02-mobile-audit-closure/13-01-PLAN.md` — harness fix implementation
- `.planning/phases/13-uidn-02-mobile-audit-closure/13-02-PLAN.md` — Lighthouse rerun + evidence update
- `.planning/phases/13-uidn-02-mobile-audit-closure/13-REVIEWS.md` — cross-AI review cycles 1-3 (Gemini + Codex) feedback incorporated
- Phase 12 prod commit `de15e33` — v1.2 deploy that this audit measures

---
_Audited: 2026-05-13 against https://polls.wtcsmapban.com (Lighthouse 13.2.0 + Playwright 1.59.1)_
_Method: 5-route Lighthouse mobile audit + 6-width × 42-PNG matrix (18 unauth-prod + 24 auth-local across adminUser + memberUser contexts); harness at `.planning/closure/audit-{mobile.sh,screenshots.mjs}`_
_Disposition: DEFER — row stays ⚠️ Revisit; follow-up tied to next perf-budget change_
