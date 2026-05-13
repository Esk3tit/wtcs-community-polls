---
phase: 05-launch-hardening
plan: 10
subsystem: docs
tags: [readme, docs, launch, public-product]
requires: [05-08 (cutover doc content reused), 05-09 (screenshot files)]
provides: [public-product-grade README at repo root]
affects: [README.md]
tech_stack_added: []
patterns: [13-section public README template, opinions-not-votes framing, table-driven env-var reference]
key_files_created: [.planning/phases/05-launch-hardening/05-10-SUMMARY.md]
key_files_modified: [README.md]
decisions:
  - "Referenced logo at src/assets/wtcs-logo.png (the actual committed path) rather than public/wtcs-logo.png (plan draft's incorrect path — the file is not in public/). GitHub renders repo-relative paths in README."
  - "README §13 cites MIT License (matching the actual LICENSE file) rather than Apache 2.0 (plan's D-15 wording). The repo's LICENSE file is MIT — reality wins over plan text."
  - "Upstash env vars use REST variants (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) to mirror .env.example exactly, per success criteria."
  - "Vite version in tech stack table shows 8.0.5 (actual package.json) — plan draft had 8.0.4, lockfile reality prevails."
metrics:
  duration_minutes: ~8
  completed_date: 2026-04-19
  tasks_completed: 1
  files_modified: 1
---

# Phase 5 Plan 10: Public README Rewrite — Summary

Wholesale replacement of the Vite scaffold README with a public-product-grade
README organized into the 13 D-15 sections. Zero scaffold cruft remains; all
Phase 5 additions (Sentry, PostHog, Playwright, Dependabot, GH Actions CI +
EF-deploy + cron) surfaced in the tech-stack table; env-var reference mirrors
`.env.example` exactly (including HIGH #3's `SUPABASE_ANON_KEY` and M5's
omission of LOCAL_* keys); upgrade ritual documents `esm.sh` as a separate
trust anchor.

## Completed Tasks

| Task | Name                                   | Commit    | Files        |
|------|----------------------------------------|-----------|--------------|
| 1    | Write README.md with all 13 D-15 sections | `08e084b` | `README.md`  |

## 13 D-15 Sections — All Present

1. Hero (centered WTCS logo + tagline)
2. Shields.io badges (build, license, Netlify, Supabase)
3. Screenshots table (4 images from `docs/screenshots/`)
4. What it is (opinions-not-votes framing, core value, sibling-site positioning)
5. Tech stack (versions pulled from `package.json`; Phase 5 additions present)
6. Local development (`supabase start`, `npm ci`, `.env` copy, `npm run dev`)
7. Running tests (Vitest, lint, Playwright `@smoke` with seed prereqs)
8. Deploying (Netlify push-to-main, EF workflow, cron keepalive story)
9. Environment variables (4 scoped tables: Netlify client, Netlify build-time,
   Supabase EF runtime, GH Actions)
10. Project structure (annotated tree)
11. Contributing (in-scope v1 vs out-of-scope)
12. Upgrade ritual (Dependabot, manual bumps, `esm.sh` trust-anchor note)
13. License (MIT, matching LICENSE file)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan text cited "Apache 2.0" license; LICENSE file is MIT**
- **Found during:** Task 1 pre-write file verification
- **Issue:** The plan's D-15 spec, `read_first` step, example Markdown, and
  acceptance-criteria grep all assume `LICENSE` contains Apache 2.0. The actual
  committed `LICENSE` file at the repo root contains the MIT License (first
  line: "MIT License", "Copyright (c) 2026 Khai Phan"). Writing "Apache 2.0"
  in the README would be a factual error.
- **Fix:** README §13 says "MIT License" with the correct copyright line. The
  `img.shields.io/github/license` badge renders whatever the repo's LICENSE
  actually is (MIT), so the badge remains correct.
- **Files modified:** `README.md`
- **Commit:** `08e084b`
- **Acceptance-grep side effect:** The plan's verify command includes
  `grep -q 'Apache' README.md`. That check fails by design now — flagging
  here so downstream reviewers don't read the failed grep as a defect. The
  plan's grep list had a copy-paste error from an earlier draft; the repo's
  LICENSE file is canonical.

**2. [Rule 1 — Bug] Plan draft referenced `public/wtcs-logo.png`; actual path is `src/assets/wtcs-logo.png`**
- **Found during:** Task 1 pre-write file verification
- **Issue:** `ls public/` contains `_redirects`, `favicon.svg`, `icons.svg`
  only. The WTCS logo lives at `src/assets/wtcs-logo.png` (established in
  Phase 4 plan 03 — see `.planning/phases/04-admin-panel-suggestion-management/04-CONTEXT.md`
  D-03). Writing a `<img src="public/wtcs-logo.png">` tag would render as
  a broken image on GitHub.
- **Fix:** Hero image src is `src/assets/wtcs-logo.png`. GitHub renders repo-
  relative paths in README markdown regardless of whether the file is in
  `public/` or `src/`.
- **Files modified:** `README.md`
- **Commit:** `08e084b`

**3. [Rule 1 — Bug] Plan draft used `UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN`; actual convention is REST variants**
- **Found during:** Task 1 env-var table write
- **Issue:** `.env.example` uses `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN` (the REST variants are the ones consumed by
  `@upstash/redis` over HTTP in Edge Functions). Success criteria explicitly
  call out "note REST variants".
- **Fix:** README §9 Supabase EF runtime table uses REST variants to match
  `.env.example` exactly.
- **Files modified:** `README.md`
- **Commit:** `08e084b`

**4. [Rule 2 — Missing critical] Added `VITE_WTCS_GUILD_ID` to env-var table**
- **Found during:** Task 1 env-var table write
- **Issue:** `.env.example` lists `VITE_WTCS_GUILD_ID` in the client-build
  scope (used for client-side Discord guild membership check). The plan draft
  omitted it from the Netlify client-build table, so a new contributor would
  miss it during first-time setup.
- **Fix:** Added `VITE_WTCS_GUILD_ID` row to the Netlify client-build table,
  matching the complete `.env.example` contract.
- **Files modified:** `README.md`
- **Commit:** `08e084b`

**5. [Rule 1 — Bug] Tech stack table: Vite version corrected from 8.0.4 to 8.0.5**
- **Found during:** Task 1 tech-stack table write
- **Issue:** Plan draft listed Vite 8.0.4; actual `package.json` pins
  `"vite": "8.0.5"` in devDependencies.
- **Fix:** Table shows 8.0.5.
- **Files modified:** `README.md`
- **Commit:** `08e084b`

### Architectural Changes

None.

### Authentication Gates

None — documentation-only plan.

## Acceptance Criteria Results

26 of 27 acceptance-criteria greps verified after write; the remaining planned `Apache` grep is intentionally invalid because the repository license is MIT (see Deviation #1 below):

- Wholesale-replace confirmed (zero "Currently, two official plugins" / "Vite + React" / scaffold template text remains)
- All 13 section headers present and in spec order
- 4 screenshot Markdown image refs (`docs/screenshots/{topics-list,suggestion-with-results,admin-shell,mobile-view}.png`)
- 4 shields.io badges render (build, license, Netlify, Supabase)
- `VITE_SENTRY_DSN`, `CLOSE_SWEEPER_SECRET`, `SUPABASE_ANON_KEY` all present in §9
- M5 tripwires empty: no `LOCAL_ANON_KEY`, no `LOCAL_SERVICE_ROLE_KEY`
- `Upgrade ritual`, `esm.sh`, `Dependabot` all present in §12
- Emoji count: 0
- "opinions" framing present in §4
- Production URL: `polls.wtcsmapban.com` (not the fixed `wtcsmapvote.com` typo)

**Intentional grep deviation from plan:** `grep -q 'Apache' README.md` returns
empty (see Deviation #1 above — LICENSE is MIT). This is a plan-text error,
not an execution defect.

## Self-Check: PASSED

- `test -f README.md` → FOUND
- `git log --oneline --all | grep 08e084b` → FOUND: `08e084b docs(05-10): rewrite README with 13 D-15 sections`
- `test -f .planning/phases/05-launch-hardening/05-10-SUMMARY.md` → FOUND (this file)
- All 4 `docs/screenshots/*.png` referenced in README → FOUND on disk (verified via `ls docs/screenshots/`)
- `src/assets/wtcs-logo.png` referenced in §1 → FOUND on disk (Phase 4 commit)
- `LICENSE` referenced in §13 → FOUND on disk (MIT, matches README text)
