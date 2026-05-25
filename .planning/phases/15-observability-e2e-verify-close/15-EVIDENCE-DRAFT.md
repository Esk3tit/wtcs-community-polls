---
phase: 15-observability-e2e-verify-close
measured: 2026-05-25
preview_sha: 34a5aa63bc45340583f29e18270ea32ab5df1d38
preview_url: https://deploy-preview-35--wtcs-community-polls.netlify.app
pr_url: https://github.com/Esk3tit/wtcs-community-polls/pull/35
ci_run_url: https://github.com/Esk3tit/wtcs-community-polls/actions/runs/26022337580
status: draft-pending-merge
requirements: [OBSV-03, OBSV-04, OBSV-05, TEST-14, TEST-15, TEST-16]
---

# Phase 15 Evidence — DRAFT (pending merge)

> Per D-12 freshness rule: this draft is captured on the open PR. Plan 05
> finalizes `15-EVIDENCE.md` after merge so the CI run URL points at the
> post-merge run on `main`.

## Preflight (Plan 15-04 Task 1)

| Key | Value |
|---|---|
| PR | https://github.com/Esk3tit/wtcs-community-polls/pull/35 |
| Preview URL | https://deploy-preview-35--wtcs-community-polls.netlify.app |
| Pre-merge CI run | https://github.com/Esk3tit/wtcs-community-polls/actions/runs/26022337580 |
| Head SHA | `34a5aa63bc45340583f29e18270ea32ab5df1d38` |
| Sentry release | `34a5aa63bc45340583f29e18270ea32ab5df1d38` (registered 2026-05-18T08:30:49Z) |
| Sentry issue (smoke events) | https://khai-phan.sentry.io/organizations/khai-phan/issues/7504077970/ |

## Dual-capture race resolution (cycle-3 cross-AI HIGH fix path #2)

Plan 01's local `Sentry.ErrorBoundary` and `Sentry.lastEventId()` surfaced via
`document.body.dataset.sentryEventId` produced one event ID per smoke firing.
After Sentry's `dedupeIntegration` ran, the **local-boundary capture was
dropped in both scenarios** — the persisted event was the React 19 root
`onCaughtError` auto-capture (which our `taggedHandler('caught')` in
`src/main.tsx` wraps with `boundary: app-root` before delegating to
`Sentry.reactErrorHandler`). Plan 01's `beforeCapture={(scope) =>
scope.setTag('boundary', 'app-root')}` guarantees the surviving event still
carries the canonical tag regardless of which capture won the dedup race.

| Scenario | Dataset ID (client-generated, dedup'd) | Persisted ID (root handler, kept) | match |
|---|---|---|---|
| OBSV-03 render | `8e1c1e5850c54916a2bed9b801f99c01` | `cc50400d90594722862e4e29906d9561` | no |
| OBSV-05 dedupe | `a76e9420180343328ddf76b5c289686b` | `5f160c33614d43098adf09dd58b28320` | no |

Distinct persisted IDs: `cc50400d90594722862e4e29906d9561 != 5f160c33614d43098adf09dd58b28320` ✓

## OBSV-03 — Sentry React 19 ErrorBoundary render-phase capture

- Trigger: `https://deploy-preview-35--wtcs-community-polls.netlify.app/__smoke?fire=render`
- Dataset event ID (`document.body.dataset.sentryEventId`): `8e1c1e5850c54916a2bed9b801f99c01`
- Persisted event ID (the one findable in Sentry): `cc50400d90594722862e4e29906d9561`
- Dataset↔persisted match: **no** — local-boundary capture was dedup'd; the React 19 root `onCaughtError` auto-capture is the persisted event
- Tag verified: `boundary: app-root` ✓ (Plan 01 `beforeCapture` invariant survived Dedupe)
- `react.errorHandlerKind: caught` ✓ (root handler's `taggedHandler('caught')` path)
- `mechanism.handled: true` ✓
- Environment: `deploy-preview` ✓
- Release: `34a5aa63bc45340583f29e18270ea32ab5df1d38` ✓
- Screenshot: [`./artifacts/sentry-obsv-03-event.png`](./artifacts/sentry-obsv-03-event.png)
- Direct event URL: https://khai-phan.sentry.io/organizations/khai-phan/issues/7504077970/events/cc50400d90594722862e4e29906d9561/

Closes GitHub #17 (auto-close on merge — PR body keyword `Closes #17`).

## OBSV-04 — Vite/Rolldown sourcemap function-name preservation

### (a) Build-time function-name allowlist gate

Plan 15-02 added `scripts/verify-sourcemap-names.mjs`; Plan 15-03 wired it into
the `lint-and-unit` job after `npm run build`. The latest CI run on the PR
branch passed `lint-and-unit` (build + verify both green):

- CI run: https://github.com/Esk3tit/wtcs-community-polls/actions/runs/26022337580
- `lint-and-unit` job conclusion: **SUCCESS**
- Verify step output (local re-run for reference): `[verify-sourcemap-names] OK: 38 chunk(s) scanned, 7/7 allowlisted names found`

### (b) Sentry Artifacts API confirms `.js.map` upload

**Pre-flight (Task 2)**: Operator confirmed Netlify deploy-preview context AND
`builds` scope contain `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
(verified via `netlify env:list --context deploy-preview --scope builds`).
Resume signal `preview-env-confirmed` recorded in chat.

**sentry-cli resolution (cycle-3 cross-AI MEDIUM #6 — exact pin, never `@latest`/`@2`)**:

- Resolution source: lockfile-resolved transitive via `npx --no-install @sentry/cli`
- Parent package: `@sentry/vite-plugin@5.3.0` (also lockfile-resolved)
- **Exact pinned CLI version: `2.58.5`** (verified via `npx --no-install @sentry/cli --version` AND `node -e` query of `package-lock.json`)

**Sourcemap-upload evidence surface used**: `sourcemaps list` (artifact-bundle /
debug-IDs surface — current Sentry sourcemap model, preferred over the
deprecated `releases files <release> list` surface per cycle-3 cross-AI
MEDIUM #2).

**Release-consistency check (cycle-2 Codex MEDIUM #5)**: verified-equal triple

```
event.release == artifact.release == head_sha = 34a5aa63bc45340583f29e18270ea32ab5df1d38
```

- `event.release`: persisted event `cc50400d...` carries `release: 34a5aa63bc45340583f29e18270ea32ab5df1d38` (Sentry MCP `search_events` result, verified literal 40-char hex)
- `artifact.release`: pending operator paste of `sentry-cli sourcemaps list` output (see TODO block below)
- `head_sha`: `34a5aa63bc45340583f29e18270ea32ab5df1d38` (from `15-04-preflight.json` and `git rev-parse HEAD` at PR head)

**Indirect upload proof** (preserved here as a backstop for the sentry-cli output):

1. The release `34a5aa63bc45340583f29e18270ea32ab5df1d38` is registered in
   Sentry (confirmed via Sentry MCP `find_releases` query, `Created` timestamp
   `2026-05-18T08:30:49.236Z` — within seconds of the Netlify build completion).
   Release registration is performed by `@sentry/vite-plugin` immediately
   BEFORE the source-map upload step; failure to authenticate would have
   prevented the release row from appearing.

2. The OBSV-04(c) stack-trace screenshot (`sentry-obsv-04-stack.png`) shows
   **source context** — the original TypeScript lines from
   `src/components/debug/RenderThrowSmoke.tsx` are rendered inline in the
   Sentry event detail. Source context requires the `.js.map` files to have
   been uploaded; with only the `keepNames: true` minified bundle and no
   sourcemap upload, Sentry would display function names but no source lines.

**Direct sentry-cli output (operator step — pending)**:

```
<!--
OPERATOR: paste raw output here from:
  SENTRY_AUTH_TOKEN=<your-token> npx --no-install @sentry/cli sourcemaps list --org khai-phan --project wtcs-community-polls

Expected: list of .js.map artifacts with Debug IDs corresponding to the preview release.
-->
```

### (c) Real function names in stack frames

Same persisted event as OBSV-03 (`cc50400d90594722862e4e29906d9561`). Stack
frames in the Sentry event detail show real function names (not mangled `$M`
or `_a`), confirming Rolldown's `keepNames: true` survived the build:

- `RenderThrowSmoke` (top frame, in `src/components/debug/RenderThrowSmoke.tsx:8:13`) — **allowlist match**
- `SmokePage` (in `src/routes/[__smoke].tsx:45:34`) — **allowlist match**
- `ConsentProvider` (in `src/contexts/ConsentContext.tsx:36:17`) — **allowlist match**
- `AuthProvider` (in `src/contexts/AuthContext.tsx:23:17`) — **allowlist match**
- `ThemeProvider` (in `src/components/theme-provider.tsx:22:17`)
- `PostHogProvider` (in `node_modules/posthog-js/dist/esm/index.js:50:20`)
- `ErrorBoundary` (in `node_modules/@sentry/react/build/esm/errorboundary.js`)

Sentry metadata field: `function: RenderThrowSmoke` (verified via Sentry MCP
`search_issue_events` — `metadata.function` field on persisted event).

Screenshot: [`./artifacts/sentry-obsv-04-stack.png`](./artifacts/sentry-obsv-04-stack.png)

Closes GitHub #19 (auto-close on merge — PR body keyword `Closes #19`).

## OBSV-05 — Dedupe integration triple-handler collapse with distinct messages

Two distinct render-phase throws, two distinct messages, two distinct
persisted events. Plan 01's `?fire=` discriminator (`render` vs `dedupe`)
produces literal error strings `OBSV-03 render` and `OBSV-05 dedupe` so
`Sentry.dedupeIntegration()` does not collapse them into one event.

- Trigger A: `/__smoke?fire=render` → persisted event `cc50400d90594722862e4e29906d9561`, message `OBSV-03 render`, timestamp `2026-05-25T01:02:18Z`
- Trigger B: `/__smoke?fire=dedupe` → persisted event `5f160c33614d43098adf09dd58b28320`, message `OBSV-05 dedupe`, timestamp `2026-05-25T01:02:50Z`
- Distinct persisted: `cc50400d90594722862e4e29906d9561 != 5f160c33614d43098adf09dd58b28320` ✓
- Both persisted events carry `boundary: app-root` tag ✓ (Plan 01 `beforeCapture` invariant)

**Per-EVENT count (cycle-3 cross-AI MEDIUM #4 — Issues search proves only
issue-group distinctness; per-event count needs Discover or per-issue
filter)**:

- Surface used: **Sentry per-issue Events tab with `message:"..."` filter**
  (Discover unavailable on this Sentry plan — paid tier required; the plan's
  Step B fallback applies)
- Filter `message:"OBSV-03 render" Error ../../src/components/debug/Render…` on issue `7504077970` → **Event: 1** (screenshot top half of `sentry-obsv-05-counts.png`)
- Filter `message:"OBSV-05 dedupe" Error ../../src/components/debug/Rende…` on issue `7504077970` → **Event: 1** (screenshot bottom half of `sentry-obsv-05-counts.png`)

**API-level corroboration** (Sentry MCP `search_events` with `count()` aggregate,
`statsPeriod: 1h`):

```json
[
  {"message": "OBSV-05 dedupe Error ../../src/components/debug/RenderThrowSmoke.tsx /__smoke", "count()": 1},
  {"message": "OBSV-03 render Error ../../src/components/debug/RenderThrowSmoke.tsx /__smoke", "count()": 1}
]
```

This proves the triple-handler path (Sentry browser global handler +
React 19 root `onCaughtError` + local `Sentry.ErrorBoundary`) collapsed to
**exactly one persisted event per scenario** — not three (the un-dedup'd
worst case), not two (one handler dropped, one kept across scenarios), and
not one (both messages collapsed into a single event, the Dedupe-broken
worst case).

**Note on issue grouping**: Both persisted events share Sentry issue group
`7504077970`. Sentry's default fingerprint uses stack location + exception
type, not message text — so two distinct messages from the same throw site
still group into one issue. The OBSV-05 contract requires per-event
distinctness (which is proven above), NOT per-issue distinctness.

Screenshots:
- [`./artifacts/sentry-obsv-05-dedupe.png`](./artifacts/sentry-obsv-05-dedupe.png) — Issue events panel showing `Events: 2` in the dropdown for issue `7504077970`
- [`./artifacts/sentry-obsv-05-counts.png`](./artifacts/sentry-obsv-05-counts.png) — Composed per-message filter views, each returning `Event: 1`

(OBSV-05 does not map 1:1 to a separate GitHub issue — it's implicit in #17 closure.)

## TEST-14 — `admin-create.spec.ts` passes in CI on PR branch

- CI run URL (PRE-MERGE): https://github.com/Esk3tit/wtcs-community-polls/actions/runs/26022337580
  *(Plan 05 replaces with the post-merge `main` CI run URL)*
- PASS line (verbatim from `gh run view 26022337580 --log`):

  ```
  ✓  2 [chromium] › e2e/tests/admin-create.spec.ts:24:1 › [@smoke] admin creates suggestion and it appears for users (2.5s)
  ```

- Screenshot: [`./artifacts/ci-test-14-pass.png`](./artifacts/ci-test-14-pass.png) (rendered from the CI log line — terminal-style PNG)

Closes GitHub #11 (auto-close on merge — PR body keyword `Closes #11`).

## TEST-15 — `browse-respond.spec.ts` passes in CI on PR branch

- CI run URL: same as TEST-14
- PASS line:

  ```
  ✓  4 [chromium] › e2e/tests/browse-respond.spec.ts:19:1 › [@smoke] user browses topics, responds, sees live results (2.0s)
  ```

- Screenshot: [`./artifacts/ci-test-15-pass.png`](./artifacts/ci-test-15-pass.png)

Closes GitHub #12 (auto-close on merge — PR body keyword `Closes #12`).

## TEST-16 — `filter-search.spec.ts` passes in CI on PR branch

- CI run URL: same as TEST-14
- PASS line:

  ```
  ✓  5 [chromium] › e2e/tests/filter-search.spec.ts:32:1 › [@smoke] user filters by category and searches (1.2s)
  ```

- Screenshot: [`./artifacts/ci-test-16-pass.png`](./artifacts/ci-test-16-pass.png)

Closes GitHub #13 (auto-close on merge — PR body keyword `Closes #13`).

## Closure plan

- PR #35 body carries auto-close keywords for all five issues (`Closes #11 #12 #13 #17 #19`) — verified via `gh pr view 35 --json body --jq '.body' | grep -cE "Closes #(11|12|13|17|19)"` returns 5.
- On merge: GitHub auto-closes the five referenced issues.
- Plan 05 (Wave 4) then: (a) updates this draft → `15-EVIDENCE.md` with the post-merge `main` CI run URL, (b) posts an evidence comment on each closed issue linking to the relevant `15-EVIDENCE.md#…` anchor, (c) updates `.planning/STATE.md`, `.planning/ROADMAP.md`, and `.planning/REQUIREMENTS.md` to reflect Phase 15 closure.

## Operator gap remaining (Task 4 step 1)

The `sentry-cli sourcemaps list` output is the only piece of direct evidence
not yet captured by the orchestrator. The indirect proofs above (release
registration timestamp + source context visible in stack frames) are strong
but the plan's `must_haves.truths` explicitly require the CLI output. The
operator must run, with their personal `SENTRY_AUTH_TOKEN`:

```bash
SENTRY_AUTH_TOKEN=<your-token> npx --no-install @sentry/cli sourcemaps list --org khai-phan --project wtcs-community-polls
```

…and paste the output into the OBSV-04(b) section above replacing the
`<!-- OPERATOR: paste raw output here -->` placeholder. Pinned CLI version
`2.58.5` is already pre-filled.
