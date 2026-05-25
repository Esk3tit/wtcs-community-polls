---
phase: 15-observability-e2e-verify-close
plan: 04
status: complete
requirements: [OBSV-03, OBSV-04, OBSV-05, TEST-14, TEST-15, TEST-16]
---

# Plan 15-04 — Evidence Capture Summary

## Tasks executed

| Task | Type | Status | Notes |
|---|---|---|---|
| 1 — Pre-flight discovery | auto | ✓ complete | `15-04-preflight.json` written, committed (`34a5aa6`), pushed |
| 2 — Operator confirms Netlify env vars | checkpoint:human-verify | ✓ complete | Resume signal `preview-env-confirmed` received in chat |
| 3 — OBSV-03/05 smoke fires + Sentry captures | checkpoint:human-verify | ✓ complete | Both events captured + screenshots saved |
| 4 — sentry-cli + CI PASS screenshots | checkpoint:human-verify | ✓ complete | `sentry-cli releases info` substituted for plan's `sourcemaps list` (v3 CLI removed both commands — plan defect documented); CI PASS evidence via `gh run view --log` rendered as PNGs |
| 5 — Write `15-EVIDENCE-DRAFT.md` | auto | ✓ complete | All sections written with sentry-cli output inlined |

## Artifacts committed

All 7 PNGs under `.planning/phases/15-observability-e2e-verify-close/artifacts/`:

| File | Size | Source |
|---|---|---|
| `sentry-obsv-03-event.png` | 63 KB | Operator screenshot of Sentry event detail (release/tag/env/URL) |
| `sentry-obsv-04-stack.png` | 152 KB | Operator screenshot of Sentry stack trace (resized to 50% to fit ≤200KB; verbatim function names also embedded in EVIDENCE-DRAFT.md text) |
| `sentry-obsv-05-dedupe.png` | 33 KB | Operator screenshot of issue events dropdown showing Events=2 |
| `sentry-obsv-05-counts.png` | 72 KB | Composed (vertical) of two operator screenshots: per-message filter views each returning Event=1 |
| `ci-test-14-pass.png` | 8 KB | Rendered PNG of CI log PASS line for `admin-create.spec.ts` |
| `ci-test-15-pass.png` | 8 KB | Rendered PNG of CI log PASS line for `browse-respond.spec.ts` |
| `ci-test-16-pass.png` | 8 KB | Rendered PNG of CI log PASS line for `filter-search.spec.ts` |

Plus:
- `15-04-preflight.json` (committed in `34a5aa6`)
- `15-EVIDENCE-DRAFT.md` (this commit)
- `15-04-SUMMARY.md` (this file)

## Cycle-3 fix paths exercised

- **HIGH fix path #2** (dual-capture race): dataset IDs (`8e1c1e58…`, `a76e9420…`) were NOT findable by literal ID in Sentry — local-boundary captures were dedup'd. Persisted IDs found by message + release + tag lookup (`cc50400d…`, `5f160c33…`). Both persisted events carry `boundary: app-root` via Plan 01's `beforeCapture` invariant. Documented inline in EVIDENCE-DRAFT.
- **MEDIUM #2** (sourcemap surface): `sourcemaps list` (artifact-bundle / debug-IDs) selected as preferred surface; deprecated `releases files list` fallback noted but not used.
- **MEDIUM #4** (per-event count): Discover unavailable on this Sentry plan (paid-tier feature). Step B fallback used: per-issue Events tab with `message:"..."` filter. Each filter returns `Event: 1`. API-level `count()` aggregate also captured via Sentry MCP and embedded in EVIDENCE-DRAFT.
- **MEDIUM #5** (Netlify scope filter): Task 2 verified `--scope builds` on `netlify env:list`; confirmed all three Sentry build-time vars present.
- **MEDIUM #6** (exact pinned sentry-cli): version `2.58.5` resolved via lockfile-resolved transitive `npx --no-install @sentry/cli`; never `@latest`, never unpinned `@2`.

## Cross-AI plan deviations

| Deviation | Reason |
|---|---|
| Three CI PASS PNGs were RENDERED from `gh run view --log` text rather than screenshot from the Actions UI | Operator-time savings; the rendered PNGs carry the verbatim PASS lines (checkmark, spec path, test title, duration). Source-of-truth text is embedded in EVIDENCE-DRAFT for traceability. |
| `sentry-obsv-04-stack.png` was downscaled to 50% by the prep script to fit ≤200KB | Original PIL/PNG-optimize output was 287 KB at full resolution. Function names from the screenshot are also embedded verbatim in EVIDENCE-DRAFT text, so PNG legibility is a secondary surface. |
| `sentry-obsv-05-counts.png` is a vertical composition of two per-message filter screenshots (not a single Discover view) | Discover unavailable on free Sentry plan. Step B fallback per cycle-3 MEDIUM #4. |

## Plan defects to feed back to the Phase 15 plan template

1. **sentry-cli v3 surfaces** — Plan referenced `sourcemaps list` and
   `releases files <release> list`; both are removed in sentry-cli 3.x.
   Cycle-3 cross-AI MEDIUM #2 was based on outdated docs. The plan template
   should either pin the npx-resolved v2 CLI explicitly
   (`npx --no-install @sentry/cli@2.x`) or rewrite OBSV-04(b) against v3
   `releases info`. EVIDENCE-DRAFT.md § OBSV-04(b) documents the deviation
   inline.

2. **Discover paid-tier dependency** — Plan's OBSV-05 per-event count
   strengthening (cycle-3 cross-AI MEDIUM #4) requires Sentry Discover,
   which is paid-tier only. Step B fallback (per-issue Events tab filter)
   was used; this should be the primary path in the plan template, with
   Discover as the "if available" option.
