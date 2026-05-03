# E2E Tests

Playwright `1.59.1` end-to-end suite for WTCS Community Polls. Runs against a
local Supabase stack in CI and locally; produces the four critical-journey
@smoke tests cited in `.planning/research/v1.1-PLAYWRIGHT-FIXTURES.md`.

## E2E-SCOPE-1 — list locators must filter to `[E2E]` rows

The CI database is seeded in two layers (see "Two-layer seed" below). Naive
list assertions like `page.getByTestId('suggestion-card').first()` or
`.toHaveCount(N)` drift the moment either layer adds a row. The convention:

- **Always** use `Locator.filter({ hasText: /\[E2E\]/ })` before any of
  `.toHaveCount`, `.first`, `.nth`, `.last`, `.all` on a shared-DB list.
- **Or** consume the `freshPoll` fixture (below) for vote-precondition specs.

ESLint enforces this in `eslint.config.js`:

```
no-restricted-syntax (e2e/tests/**/*.spec.ts):
  CallExpression matching .toHaveCount/.first/.nth/.last/.all
  without a preceding .filter() anywhere in the chain → error.
```

The rule walks the call chain via `:has(...)`, so
`page.getByTestId('x').filter({ hasText: /\[E2E\]/ }).first()` passes and
`page.getByTestId('x').first()` fails.

### Escape hatch (DOM-scoped locators)

Inside a locator that is already bound to a single fixture row (e.g. a card
returned by `firstCard.getByRole('button').first()`), the rule false-positives.
Annotate the line with a one-line WHY justification:

```ts
// eslint-disable-next-line no-restricted-syntax -- DOM-scoped inside fixture card; only one collapsed trigger exists.
const collapsedTrigger = firstCard.getByRole('button', { expanded: false }).first()
```

PR review enforces the WHY quality. Do NOT use the escape-hatch on a shared-DB
list locator — that defeats the rule's purpose.

## `freshPoll` fixture — per-test mutable state

`e2e/fixtures/poll-fixture.ts` exports a Playwright test-scoped fixture that
inserts a poll + two choices before the test, deletes the poll after (FK
cascade wipes choices/votes/vote_counts in one statement). Use it when the
spec needs to vote — without it you're asserting against shared seed rows
that may have zero votes.

```ts
import { test, expect } from '../fixtures/poll-fixture'
import { loginAs } from '../helpers/auth'
import { fixtureUsers } from '../fixtures/test-users'

test('[@smoke] user votes on a fresh poll', async ({ page, freshPoll }) => {
  await loginAs(page, fixtureUsers.memberUser.id)
  await page.goto('/topics')
  const card = page
    .getByTestId('suggestion-card')
    .filter({ hasText: freshPoll.title })
    .first()
  await expect(card).toBeVisible()
  // ...vote, then assert /[1-9]\d*\s+total response/i
})
```

When to reach for which:
- **Vote-precondition specs** (assert non-zero counts after voting) → `freshPoll`.
- **Read-only list specs** (filter/search/visibility) → static
  `e2e/fixtures/seed.sql` rows + the `.filter({ hasText: /\[E2E\]/ })`
  convention.

## Two-layer seed

Two SQL files seed the test DB:

1. **Base** — `supabase/seed.sql`. Idempotent (every INSERT ends in
   `ON CONFLICT (id) DO NOTHING` or `DO UPDATE SET …`). Applied automatically
   by `supabase start` / `supabase db reset`. Mirrors the production seed.
2. **Additive** — `e2e/fixtures/seed.sql`. Idempotent. Applied via
   `psql "$db_url" -f e2e/fixtures/seed.sql` with
   `PGOPTIONS='-c app.e2e_seed_allowed=true'` (fail-closed guard prevents
   accidental application against non-local databases). Adds the four `[E2E]`
   prefixed fixture polls + the test-user `auth.users`/`profiles` rows.

Because both layers contribute rows, `expect(cards).toHaveCount(N)` against
the unfiltered list is broken-by-design — the count depends on which layers
ran. The E2E-SCOPE-1 filter narrows assertions to the `[E2E]`-prefixed rows
the test owns.

## Run locally

Prereq: Supabase CLI installed and a local stack started.

```bash
# 1. Start the local stack (applies migrations + base seed):
supabase start

# 2. Apply the additive E2E fixture seed:
PGOPTIONS='-c app.e2e_seed_allowed=true' \
  psql "$(supabase status --output json | jq -r .DB_URL)" \
  -f e2e/fixtures/seed.sql

# 3. Export the env vars Playwright needs:
export VITE_SUPABASE_URL="$(supabase status --output json | jq -r .API_URL)"
export VITE_SUPABASE_ANON_KEY="$(supabase status --output json | jq -r .ANON_KEY)"
export SUPABASE_SERVICE_ROLE_KEY="$(supabase status --output json | jq -r .SERVICE_ROLE_KEY)"

# 4. Run the suite:
npm run e2e -- --grep @smoke

# Headed / single spec for debug:
npm run e2e -- e2e/tests/browse-respond.spec.ts --headed
```

## Common gotchas

- **Un-filtered list counting** — see E2E-SCOPE-1 above. The lint rule blocks
  this at PR time.
- **`.first()` on a shared-DB list** — same issue. Use `.filter()` first or
  consume `freshPoll`.
- **Missing vote precondition** — asserting `\d+\s+total response` against a
  fixture poll with zero votes always passes (zero matches `\d+`). Use the
  `[1-9]\d*` regex AND cast a vote in the test (or use `freshPoll`).
- **FK cascade** — deleting a `polls` row cascades to `choices`, `votes`, and
  `vote_counts`. The fixture relies on this; do NOT add manual child-row
  cleanup before the parent DELETE.
- **Re-running `loginAs`** — adds a new init-script; the LAST one wins on the
  next `page.goto(...)`. Always navigate after a context switch before
  asserting on per-user UI.

## References

- Convention research: `.planning/research/v1.1-PLAYWRIGHT-FIXTURES.md`
- CI workflow: `.github/workflows/ci.yml` (`lint-and-unit` + `e2e` jobs)
- Selector vocabulary: `data-testid="suggestion-card"`,
  `data-testid="choice-button"`, `data-testid="admin-create-suggestion"`,
  `data-testid="suggestion-form-submit"`, `role="meter"`.
