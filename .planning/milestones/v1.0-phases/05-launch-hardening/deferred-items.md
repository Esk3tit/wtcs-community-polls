# Phase 5 Deferred Items

Out-of-scope discoveries logged during execution. Not fixed by the originating plan.

## From 05-01 (dependency pinning + new deps)

### Pre-existing lint failures on base commit 8f390ef (7 errors)

- `src/routes/__root.tsx`, `src/routes/admin/*.tsx`, `src/routes/auth/error.tsx`, `src/routes/index.tsx`
- Rule: `react-refresh/only-export-components` — non-component exports in route files
- Status: pre-existing on `main` before 05-01 ran (verified via `git stash && npm run lint`)
- Acceptable handler: separate plan or lint ignore; out of scope for the pinning task

### Pre-existing unit-test failures on base commit 8f390ef (4 failures in `src/__tests__/admin/admin-shell.test.tsx`)

- Cause: `src/lib/supabase.ts` throws "Missing Supabase environment variables" when `.env.local` is absent in the test environment
- Status: pre-existing on `main` before 05-01 ran (identical failure count before and after)
- Acceptable handler: test setup must inject mock env vars (separate plan); out of scope for the pinning task

### Advisory (codex M6-adjacent) — `--with-deps` dropped

- `npx playwright install --with-deps chromium` attempts `apt-get`/`dnf` which is incorrect on macOS; plan explicitly permits dropping `--with-deps` locally
- CI is the source of truth; `ubuntu-latest` already ships the required OS deps
- No action needed

## 05-03 observations (pre-existing, NOT caused by this plan)

- `src/__tests__/admin/admin-shell.test.tsx` — 4 failures: "Missing Supabase environment variables. Copy .env.example to .env…" thrown by `src/lib/supabase.ts` when the test imports `useCategoryMutations.ts`. Verified pre-existing via `git stash && npm test` (same 4 failures before Task 2 edits). Out of scope for 05-03 (deviation Rule SCOPE BOUNDARY). Likely wants a Supabase env-var mock in `src/test/setup.ts`, which is a test-infra concern.
- `npm run lint` — 7 pre-existing react-refresh/only-export-components warnings on routes/* and components/ui/* files not in this plan's files_modified. Files I created/modified lint clean.
