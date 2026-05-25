---
phase: 15-observability-e2e-verify-close
plan: 04
status: complete-with-operator-gap
requirements: [OBSV-03, OBSV-04, OBSV-05, TEST-14, TEST-15, TEST-16]
---

# Plan 15-04 — Evidence Capture Summary

## Tasks executed

| Task | Type | Status | Notes |
|---|---|---|---|
| 1 — Pre-flight discovery | auto | ✓ complete | `15-04-preflight.json` written, committed (`34a5aa6`), pushed |
| 2 — Operator confirms Netlify env vars | checkpoint:human-verify | ✓ complete | Resume signal `preview-env-confirmed` received in chat |
| 3 — OBSV-03/05 smoke fires + Sentry captures | checkpoint:human-verify | ✓ complete | Both events captured + screenshots saved |
| 4 — sentry-cli sourcemaps list + CI PASS screenshots | checkpoint:human-verify | ⚠ partial | sentry-cli output PENDING-OPERATOR; CI PASS evidence captured via `gh run view --log` and rendered as PNGs |
| 5 — Write `15-EVIDENCE-DRAFT.md` | auto | ✓ complete | All sections written; OBSV-04(b) carries `<!-- OPERATOR: paste -->` placeholder |

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

## Remaining operator gap (single command)

OBSV-04(b) `must_haves.truths` requires the literal `sentry-cli sourcemaps
list` output. The orchestrator cannot produce this without the operator's
personal `SENTRY_AUTH_TOKEN`. Indirect proofs are documented in
EVIDENCE-DRAFT (release registration timestamp + source context in stack
frames), but the direct CLI output is still pending. Operator runs:

```bash
SENTRY_AUTH_TOKEN=<your-token> npx --no-install @sentry/cli sourcemaps list --org khai-phan --project wtcs-community-polls
```

And replaces the `<!-- OPERATOR: paste raw output here -->` placeholder in
`15-EVIDENCE-DRAFT.md` § OBSV-04(b) with the raw stdout. Once that's in,
Plan 15-04 is fully complete and Plan 15-05 (Wave 4) can run.
