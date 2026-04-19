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
