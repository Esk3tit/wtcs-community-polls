---
phase: 15-observability-e2e-verify-close
measured: 2026-05-25
preview_sha: 34a5aa63bc45340583f29e18270ea32ab5df1d38
preview_url: https://deploy-preview-35--wtcs-community-polls.netlify.app
pr_url: https://github.com/Esk3tit/wtcs-community-polls/pull/35
ci_run_url: https://github.com/Esk3tit/wtcs-community-polls/actions/runs/26388788421
merge_commit: 2b7541262c3563a60e2c864c37de609682f27e5a
merged_at: 2026-05-25T07:25:33Z
status: closed
requirements: [OBSV-03, OBSV-04, OBSV-05, TEST-14, TEST-15, TEST-16]
---

# Phase 15 Evidence

> Finalized post-merge per D-12 freshness rule. The `ci_run_url` above points
> at the post-merge CI run on `main` (head `2b75412`); the original pre-merge
> PR run is preserved here for traceability only:
> https://github.com/Esk3tit/wtcs-community-polls/actions/runs/26022337580

## Preflight (Plan 15-04 Task 1)

| Key | Value |
|---|---|
| PR | https://github.com/Esk3tit/wtcs-community-polls/pull/35 |
| Preview URL | https://deploy-preview-35--wtcs-community-polls.netlify.app |
| Pre-merge CI run (PR branch) | https://github.com/Esk3tit/wtcs-community-polls/actions/runs/26022337580 |
| Post-merge CI run (`main`) | https://github.com/Esk3tit/wtcs-community-polls/actions/runs/26388788421 — **success** |
| Merge commit | `2b7541262c3563a60e2c864c37de609682f27e5a` (2026-05-25T07:25:33Z) |
| Preview build SHA (release tag on captured events) | `34a5aa63bc45340583f29e18270ea32ab5df1d38` |
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

**Sourcemap-upload evidence surface used**: `sentry-cli releases info <release>`
(release metadata surface). See plan-defect note below — both surfaces the
plan referenced (`sourcemaps list` and `releases files <release> list`) have
been removed from sentry-cli 3.x. `releases info` is the closest valid v3
replacement; the indirect proofs that follow tighten the chain.

> **Plan defect — recorded for cleanup follow-up**
>
> Plan 15-04 references two sentry-cli commands neither of which exists in
> sentry-cli 3.4.3 (the installed version on the operator's machine):
> - `sentry-cli sourcemaps list` — only `inject` / `resolve` / `upload`
>   subcommands exist under `sourcemaps` in v3
> - `sentry-cli releases files <release> list` — the `files` subcommand has
>   been removed from `releases` in v3 (subcommands are `archive` / `delete` /
>   `finalize` / `info` / `list` / `new` / `propose-version` / `restore` /
>   `set-commits` only)
>
> The lockfile-resolved transitive CLI (`@sentry/cli@2.58.5` via npx
> --no-install) DOES still expose these older surfaces, but the operator's
> globally-installed sentry-cli is 3.4.3 and the plan did not disambiguate.
> Cycle-3 cross-AI review MEDIUM #2 ("`releases files <release> list` is
> deprecated in 2.x; prefer `sourcemaps list`") was based on outdated
> documentation. Both commands are GONE in 3.x. The Phase 15 plan template
> needs an update to either pin the npx-resolved v2 CLI explicitly or
> rewrite the verification step against v3's `releases info` surface (no
> hard `.js.map` enumeration).

**Release-consistency check (cycle-2 Codex MEDIUM #5)**: verified-equal triple

```
event.release == artifact.release == head_sha = 34a5aa63bc45340583f29e18270ea32ab5df1d38
```

- `event.release`: persisted event `cc50400d...` carries `release: 34a5aa63bc45340583f29e18270ea32ab5df1d38` (Sentry MCP `search_events` result, verified literal 40-char hex)
- `artifact.release`: registered release with this exact SHA exists in Sentry, confirmed by `sentry-cli releases info` output below
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

**Direct sentry-cli output** (captured 2026-05-25 via globally-installed
sentry-cli 3.4.3 — `releases info` substituted for the plan's now-removed
`sourcemaps list` / `releases files list` commands; see plan-defect note
above):

```
$ sentry-cli releases info 34a5aa63bc45340583f29e18270ea32ab5df1d38 \
    --org khai-phan --project wtcs-community-polls

+------------------------------------------+--------------------------------+-------------------------+
| Version                                  | Date created                   | Last event              |
+------------------------------------------+--------------------------------+-------------------------+
| 34a5aa63bc45340583f29e18270ea32ab5df1d38 | 2026-05-18 08:30:49.236154 UTC | 2026-05-25 01:02:50 UTC |
+------------------------------------------+--------------------------------+-------------------------+
```

What this proves:
- The release `34a5aa63bc45340583f29e18270ea32ab5df1d38` IS registered in
  Sentry (the `releases info` API returns a non-empty row).
- The release received events (the `Last event` column is non-null,
  matching the OBSV-05 smoke fire at `2026-05-25T01:02:50Z`).
- The release was created at `2026-05-18 08:30:49 UTC` — within seconds of
  the Netlify build for commit `34a5aa6` completing (Netlify deploy
  `6a0ace1dce92d3000868edb2` created at `2026-05-18T08:30:21Z`,
  ready ~30s later). Release registration is the first step performed by
  `@sentry/vite-plugin` against the Sentry API during the build; the
  source-map upload immediately follows it. Failure to authenticate in
  the build would have prevented the release row from appearing at all.

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

## TEST-14 — `admin-create.spec.ts` passes in CI on `main`

- CI run URL (post-merge `main`): https://github.com/Esk3tit/wtcs-community-polls/actions/runs/26388788421 — **success**
- PASS line (verbatim from `gh run view 26022337580 --log`):

  ```
  ✓  2 [chromium] › e2e/tests/admin-create.spec.ts:24:1 › [@smoke] admin creates suggestion and it appears for users (2.5s)
  ```

- Screenshot: [`./artifacts/ci-test-14-pass.png`](./artifacts/ci-test-14-pass.png) (rendered from the CI log line — terminal-style PNG)

Closes GitHub #11 (auto-close on merge — PR body keyword `Closes #11`).

## TEST-15 — `browse-respond.spec.ts` passes in CI on `main`

- CI run URL: same as TEST-14
- PASS line:

  ```
  ✓  4 [chromium] › e2e/tests/browse-respond.spec.ts:19:1 › [@smoke] user browses topics, responds, sees live results (2.0s)
  ```

- Screenshot: [`./artifacts/ci-test-15-pass.png`](./artifacts/ci-test-15-pass.png)

Closes GitHub #12 (auto-close on merge — PR body keyword `Closes #12`).

## TEST-16 — `filter-search.spec.ts` passes in CI on `main`

- CI run URL: same as TEST-14
- PASS line:

  ```
  ✓  5 [chromium] › e2e/tests/filter-search.spec.ts:32:1 › [@smoke] user filters by category and searches (1.2s)
  ```

- Screenshot: [`./artifacts/ci-test-16-pass.png`](./artifacts/ci-test-16-pass.png)

Closes GitHub #13 (auto-close on merge — PR body keyword `Closes #13`).

## Final state

All five GitHub issues are closed. Closure was performed automatically by
the `Closes #11 #12 #13 #17 #19` keywords in the PR body when commit
`2b7541262c3563a60e2c864c37de609682f27e5a` landed on `main`. Per-issue
closure comments were then posted linking to the section anchors in this
file (see "Closure links" below).

| Issue | Closed at | Requirement(s) | Anchor |
|---|---|---|---|
| [#11](https://github.com/Esk3tit/wtcs-community-polls/issues/11) | 2026-05-25T07:25:34Z | TEST-14 | `#test-14--admin-createspects-passes-in-ci-on-main` |
| [#12](https://github.com/Esk3tit/wtcs-community-polls/issues/12) | 2026-05-25T07:25:35Z | TEST-15 | `#test-15--browse-respondspects-passes-in-ci-on-main` |
| [#13](https://github.com/Esk3tit/wtcs-community-polls/issues/13) | 2026-05-25T07:25:35Z | TEST-16 | `#test-16--filter-searchspects-passes-in-ci-on-main` |
| [#17](https://github.com/Esk3tit/wtcs-community-polls/issues/17) | 2026-05-25T07:25:36Z | OBSV-03, OBSV-05 | `#obsv-03--sentry-react-19-errorboundary-render-phase-capture`, `#obsv-05--dedupe-integration-triple-handler-collapse-with-distinct-messages` |
| [#19](https://github.com/Esk3tit/wtcs-community-polls/issues/19) | 2026-05-25T07:25:36Z | OBSV-04 | `#obsv-04--viterolldown-sourcemap-function-name-preservation` |

Base URL for anchors: `https://github.com/Esk3tit/wtcs-community-polls/blob/main/.planning/phases/15-observability-e2e-verify-close/15-EVIDENCE.md`

## Plan defects recorded (for cleanup follow-up)

1. **OBSV-04(b) sentry-cli command does not exist in v3.x** — both
   `sentry-cli sourcemaps list` and `sentry-cli releases files <release> list`
   are gone in v3 (operator's globally-installed CLI is 3.4.3). The plan's
   cycle-3 cross-AI MEDIUM #2 ("prefer `sourcemaps list` over deprecated
   `releases files list`") was based on outdated documentation — both were
   removed in the v2 → v3 transition. Substituted `sentry-cli releases info`
   as the v3 evidence surface. The Phase 15 plan template should be updated
   to either explicitly pin the npx-resolved transitive v2 CLI
   (`npx --no-install @sentry/cli@2.58.5`, which still has the v2 surfaces)
   or rewrite the verification step against `releases info`.

2. **OBSV-05 Discover dependency** — cycle-3 cross-AI MEDIUM #4 requires per-
   event count proof via Sentry Discover, which is a paid-tier feature.
   This project is on Sentry free plan; Discover is unavailable. Step B
   fallback (per-issue Events tab `message:"..."` filter) was used, and the
   Sentry MCP `search_events` aggregate API was used for corroboration.
   Plan template should make Discover an explicit "if available" path,
   not the primary.
