# Phase 8: E2E Test Hygiene — Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 10 (7 modify + 3 create)
**Analogs found:** 10 / 10

## File Classification

| File | Action | Role | Data Flow | Closest Analog | Match |
|------|--------|------|-----------|----------------|-------|
| `e2e/tests/admin-create.spec.ts` | modify | e2e-spec | request-response | `e2e/tests/browse-respond.spec.ts` (sibling) | exact |
| `e2e/tests/browse-respond.spec.ts` | modify | e2e-spec | request-response + mutation | `e2e/tests/admin-create.spec.ts` (sibling) | exact |
| `e2e/tests/filter-search.spec.ts` | modify | e2e-spec | request-response | `e2e/tests/browse-respond.spec.ts` (sibling) | exact |
| `e2e/tests/auth-errors.spec.ts` | check-only | e2e-spec | request-response | sibling specs | exact |
| `e2e/helpers/auth.ts` | modify (additive) | helper / DB-client factory | DB CRUD (admin-bypass) | self (existing `loginAs` shape) | exact |
| `eslint.config.js` | modify (append) | config | static-analysis rule | self (existing flat-config blocks) | exact |
| `.planning/phases/03-response-integrity/03-UAT.md` | modify (append section) | UAT evidence doc | docs | other `*-UAT.md` files | role-match |
| `e2e/fixtures/poll-fixture.ts` | create | Playwright test-extend fixture | DB CRUD round-trip (insert→use→delete) | RESEARCH §6 skeleton (no in-repo analog) | research-pointer |
| `e2e/README.md` | create | docs (subdir README) | docs | `.planning/` doc tone (no in-repo subdir-README analog) | tone-pointer |
| `.planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md` | create | runbook | docs | `*-UAT.md` evidence-block shape | role-match |

---

## Pattern Assignments

### `e2e/helpers/auth.ts` (modify — additive `getAdminClient()` getter)

**Current shape (verbatim, lines 1-3, 26-35, 63-77):**

```ts
import { createClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'
import { fixtureUsers, FIXTURE_PASSWORD } from '../fixtures/test-users'
...
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321'
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!ANON_KEY) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY env var required for Playwright auth helper. ' +
      'In local dev, run `supabase status` and export the anon key; in CI, ' +
      'Plan 05-06 wires it from the repo secret LOCAL_ANON_KEY.',
  )
}
...
export async function loginAs(page: Page, fixtureUserId: string): Promise<void> {
  const user = Object.values(fixtureUsers).find((u) => u.id === fixtureUserId)
  ...
  const client = createClient(SUPABASE_URL, ANON_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
```

**Why this matters (RESEARCH §5):** `auth.ts` currently mints **only an anon-key client**, contrary to CONTEXT L119 which (factually wrong) says "already mints a service-role Supabase client." The module-load throw at L29 is anon-only — adding a sibling top-level service-role throw would break specs that don't need admin (e.g., `auth-errors.spec.ts`).

**Target shape (additive, lazy getter — append after `loginAs()` at L103):**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
// (existing import already brings in createClient — extend the existing line
// to add the SupabaseClient type-only import, OR add a separate type import.)

let _adminClient: SupabaseClient | null = null

// Service-role bypasses RLS. Lazy so non-fixture-using specs do not fail
// to import this module when SUPABASE_SERVICE_ROLE_KEY is absent.
export function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient
  const url = process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321'
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY env var required for E2E admin client. ' +
        'In local dev, run `supabase status` and export it; in CI, ' +
        'derived from supabase status (see ci.yml M5).',
    )
  }
  _adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _adminClient
}
```

**Established patterns to respect:**
- Reuse the existing `SUPABASE_URL` constant (do NOT redeclare it inside the getter — RESEARCH §5 example shows redeclaration but the planner should DRY against the existing module-scoped `SUPABASE_URL`).
- Reuse the same `auth: { autoRefreshToken: false, persistSession: false }` shape as `loginAs()` L74-76.
- File comment block at L5-24 is project tone — terse, cites pitfalls and prior rounds where load-bearing. The new getter's WHY comment must follow the same WHY-only discipline; cite SECURITY rationale (service-role bypasses RLS) NOT plan/round IDs.
- `loginAs()` public API is unchanged — no caller updates needed.

---

### `eslint.config.js` (modify — append `no-restricted-syntax` flat-config block)

**Current shape (verbatim, full file, lines 1-38):**

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/routeTree.gen.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': [
        'error',
        { allowExportNames: ['buttonVariants', 'badgeVariants', 'useTheme'] },
      ],
    },
  },
])
```

**Append target — new array element inside `defineConfig([...])`** (placement: after the existing `**/*.{ts,tsx}` block, before the closing `])`). This is the only override block today; the new block is the second element of the array.

**Target shape (verbatim from RESEARCH §3, with WHY comment scrubbed of plan refs):**

```js
{
  files: ['e2e/tests/**/*.spec.ts'],
  rules: {
    // E2E-SCOPE-1: list locators on the shared E2E DB drift unless they
    // filter to [E2E]-prefixed rows. The :has() walk catches a .filter()
    // call anywhere in the chain; bare counters/indexers are flagged.
    'no-restricted-syntax': ['error', {
      selector:
        "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(toHaveCount|first|nth|all|last)$/]" +
        ":not(:has(CallExpression[callee.property.name='filter']))",
      message:
        "E2E-SCOPE-1: filter to [E2E] prefix before counting/indexing list locators. " +
        "Use .filter({ hasText: /^\\[E2E/ }) before .first/.nth/.last/.all/.toHaveCount, " +
        "OR add `// eslint-disable-next-line no-restricted-syntax -- WHY` if the locator " +
        "is already DOM-scoped. See e2e/README.md.",
    }],
  },
},
```

**Established patterns to respect:**
- File uses flat-config `defineConfig([...])` from `eslint/config`. New block is a plain object literal in the array — same shape as the existing block.
- ESLint runtime is 9.39.4 (RESEARCH §3 — `:has()` requires ≥ 8.40, satisfied).
- `files: [...]` pattern uses POSIX globs (existing block uses `'**/*.{ts,tsx}'`); new block uses `'e2e/tests/**/*.spec.ts'` per D-08.
- WHY comment in the rules block is project-tone-compliant: states the SCOPE goal + selector mechanic, NOT "added for issue #13" or "Phase 8 round 2."
- `globalIgnores(...)` stays untouched — fixtures/helpers/playwright-config are already not in the new rule's `files` glob.

---

### `e2e/tests/admin-create.spec.ts` (compliance check + optional cosmetic)

**Verdict (RESEARCH §2a):** Already E2E-SCOPE-1 compliant. No list-count/index assertion exists. The L57 `getByText(uniqueTitle)` matches a globally unique timestamped title (L34 `'[E2E] Admin-create ${Date.now()}'`) — cannot collide with shared-DB rows.

**Current relevant excerpts (verbatim):**

```ts
// L24:
test('[@smoke] admin creates suggestion and it appears for users', async ({ page }) => {

// L34: title pattern that is the established analog for fixture title
const uniqueTitle = `[E2E] Admin-create ${Date.now()}`

// L64-65: post-submit assertion on URL + visible title
await expect(page).toHaveURL(/\/admin(?:\/suggestions)?\/?(?:\?.*)?$/, { timeout: 10_000 })
await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10_000 })
```

**Target action:** No source change required. Run `npm run lint` after the rule lands to confirm zero violations. Optional: add a single-line WHY comment above L24 documenting "globally-unique title pattern is the freshPoll-fixture cousin" — planner's call. NOT required for green.

**Established patterns to respect & propagate:**
- `[@smoke]` test-name prefix (L24).
- `[E2E] {scope} {Date.now()}` title pattern is the **fixture title template** RESEARCH §6 builds on. Keep parity.
- Re-login pattern at L69 (`await loginAs(page, fixtureUsers.memberUser.id)` + `page.goto`) is canonical context-switch and is what other specs replicate.

---

### `e2e/tests/browse-respond.spec.ts` (modify — fixture migration + regex tighten)

**Current shape (verbatim, lines 1, 19, 24-25, 32, 40, 45):**

```ts
// L1 — import to be REPLACED
import { test, expect } from '@playwright/test'

// L19 — keep test name
test('[@smoke] user browses topics, responds, sees live results', async ({ page }) => {

// L23-25 — `firstCard` source to be REPLACED with fixture-bound version
// At least one fixture suggestion card rendered.
const firstCard = page.getByTestId('suggestion-card').first()
await expect(firstCard).toBeVisible()

// L32 — DOM-scoped .first() inside firstCard (rule will fire — needs disable)
const collapsedTrigger = firstCard.getByRole('button', { expanded: false }).first()

// L40 — DOM-scoped .first() inside firstCard (rule will fire — needs disable)
const firstChoice = firstCard.getByTestId('choice-button').first()

// L45 — vote-count regex to TIGHTEN
await expect(firstCard.getByText(/\d+\s+total response/i)).toBeVisible({ timeout: 10_000 })
```

**Target shape (verbatim diffs from RESEARCH §2b):**

```diff
@@ L1 — switch to the fixture re-export of test
-import { test, expect } from '@playwright/test'
+import { test, expect } from '../fixtures/poll-fixture'

@@ test signature — destructure freshPoll from fixtures
-test('[@smoke] user browses topics, responds, sees live results', async ({ page }) => {
+test('[@smoke] user browses topics, responds, sees live results', async ({ page, freshPoll }) => {

@@ L23-25 — bind firstCard to fixture poll by exact title match
-  // At least one fixture suggestion card rendered.
-  const firstCard = page.getByTestId('suggestion-card').first()
+  // E2E-SCOPE-1: bind to fixture-inserted poll by exact title match.
+  const firstCard = page
+    .getByTestId('suggestion-card')
+    .filter({ hasText: freshPoll.title })
+    .first()
   await expect(firstCard).toBeVisible()

@@ L32 — DOM-scoped, requires disable + WHY
+  // eslint-disable-next-line no-restricted-syntax -- DOM-scoped inside fixture card; only one collapsed trigger exists.
   const collapsedTrigger = firstCard.getByRole('button', { expanded: false }).first()

@@ L40 — DOM-scoped, requires disable + WHY
+  // eslint-disable-next-line no-restricted-syntax -- DOM-scoped inside fixture card; .first() picks the first choice button.
   const firstChoice = firstCard.getByTestId('choice-button').first()

@@ L45 — tighten regex (rules out 0-vote false positive)
-  await expect(firstCard.getByText(/\d+\s+total response/i)).toBeVisible({ timeout: 10_000 })
+  await expect(firstCard.getByText(/[1-9]\d*\s+total response/i)).toBeVisible({ timeout: 10_000 })
```

**Established patterns to respect:**
- `[@smoke]` prefix preserved.
- `data-testid="suggestion-card"` and `data-testid="choice-button"` selector vocabulary preserved (Phase 5 D-08 / 05-04 M7).
- WHY-only escape-hatch comments — say WHAT is DOM-scoped and WHY .first() is unambiguous; do NOT cite "Phase 8" or "PR #X" or rule IDs beyond the literal `no-restricted-syntax` token ESLint requires.
- Title-match binding (`filter({ hasText: freshPoll.title })`) is the canonical pattern for any future fixture-consuming spec; RESEARCH §2b shows exact form.

---

### `e2e/tests/filter-search.spec.ts` (modify — single-locator scope change)

**Current shape (verbatim, lines 25-32, 50-52, 61-62):**

```ts
// L25
test('[@smoke] user filters by category and searches', async ({ page }) => {

// L29-32 — base locator, NO filter — rule will fire
// Baseline: at least one card rendered.
const cards = page.getByTestId('suggestion-card')
await expect(cards.first()).toBeVisible()
const initialCount = await cards.count()

// L50-52 — already compliant (`.filter()` precedes `.first()`)
await expect(
  page.getByTestId('suggestion-card').filter({ hasText: /Sinai/i }).first(),
).toBeHidden({ timeout: 5_000 })

// L61-62 — relies on `cards` (will become compliant once L30 is patched)
await page.getByLabel(/search topics/i).fill('SMOKE')
await expect(cards).toHaveCount(1, { timeout: 5_000 })
```

**Target shape (verbatim diff from RESEARCH §2c):**

```diff
@@ L29-30 — scope `cards` to [E2E]-prefixed entries
-  // Baseline: at least one card rendered.
-  const cards = page.getByTestId('suggestion-card')
+  // E2E-SCOPE-1: ignore canonical b0000…* polls; assert only on fixture
+  // d0000…* rows whose titles carry the [E2E] prefix.
+  const cards = page.getByTestId('suggestion-card').filter({ hasText: /^\[E2E/ })
```

Downstream `cards.first()` (L31), `cards.count()` (L32, L53), and `cards.toHaveCount(1, ...)` (L62) all become rule-compliant because the parent locator now has `.filter()` in its chain.

**Existing compliant pattern to keep (L51 verbatim):**
```ts
page.getByTestId('suggestion-card').filter({ hasText: /Sinai/i }).first()
```
Per D-07, ANY `.filter()` is enough — this stays as-is. Optional: add a 1-line WHY above L50 ("Sinai-specific narrowing; fixture-only because parent locator is fixture-scoped via the L30 filter") for durability.

**Do NOT change the SMOKE search token (L61).** RESEARCH §2c: SMOKE relies on the static fixture seed's `[E2E SMOKE]` title prefix; switching to a fresh-poll token would force this spec to consume the freshPoll fixture, which contradicts D-01 (browse-respond is the sole proof-of-contract consumer in this phase).

**Established patterns to respect:**
- `[@smoke]` prefix preserved.
- `data-testid="suggestion-card"` selector vocabulary preserved.
- `.filter({ hasText: /^\[E2E/ })` is the canonical SCOPE-1 form — verbatim regex lives in the e2e/README.md.

---

### `e2e/tests/auth-errors.spec.ts` (compliance check — no edit expected)

**Verdict (RESEARCH §4):** CLEAN. Zero matched call sites. `grep` for `.first()|.nth(|.all()|.last()|.toHaveCount(` returns no hits.

**Current shape (verbatim, lines 19-30):**

```ts
test('[@smoke] auth error page renders 2fa-required variant', async ({ page }) => {
  await page.goto('/auth/error?reason=2fa-required')
  await expect(page.getByRole('heading', { name: /two-factor|2fa/i })).toBeVisible()
})

test('[@smoke] auth error page renders not-in-server variant', async ({ page }) => {
  await page.goto('/auth/error?reason=not-in-server')
  await expect(page.getByRole('heading', { name: /server membership|wtcs server/i })).toBeVisible()
})
```

**Target action:** No edit. Verification = `npm run lint` returns zero diagnostics on this file.

---

### `e2e/fixtures/poll-fixture.ts` (CREATE — `freshPoll` test-scoped fixture)

**Closest in-repo analog:** None. There is no existing `test.extend(...)` file in `e2e/fixtures/` (the directory contains `seed.sql` + `test-users.ts` only). Use **RESEARCH §6's verbatim skeleton** as the canonical reference; it is grounded in `schema.sql` column requirements and the `fixtureUsers.adminUser` shape.

**Pointer (full verbatim skeleton):** `.planning/phases/08-e2e-test-hygiene/08-RESEARCH.md` § 6 (lines ~280-336 in the research file). Planner copies the skeleton directly with one minor adjustment noted below.

**Key shape contracts (extracted from RESEARCH §6):**

```ts
// Top-of-file imports — pattern to copy:
import { test as base, expect } from '@playwright/test'
import { fixtureUsers } from './test-users'
import { getAdminClient } from '../helpers/auth'

type PollFixtures = {
  freshPoll: { id: string; title: string }
}

export const test = base.extend<PollFixtures>({
  freshPoll: async ({}, use, testInfo) => {
    const admin = getAdminClient()
    const slug = testInfo.title.replace(/[^\w\s.-]/g, '').slice(0, 80)
    const title = `[E2E] ${slug} ${Date.now()}`
    // ...insert poll, insert two choices, await use(...), delete poll (cascade)...
  },
})

export { expect }
```

**Established patterns to respect:**
- Title pattern `[E2E] {sanitized testInfo.title} {Date.now()}` matches the existing fixture-poll convention in `e2e/fixtures/seed.sql:122-149` (all four static polls start with `[E2E]` or `[E2E SMOKE]`) and the `admin-create.spec.ts:34` runtime title pattern. Three-way consistency.
- `created_by: fixtureUsers.adminUser.id` — `adminUser.id = '22222222-...'` from `e2e/fixtures/test-users.ts:27-31`. The id is seeded into `auth.users` + `profiles` via `e2e/fixtures/seed.sql` (research-confirmed FK).
- `category_id: null` is allowed (FK is `ON DELETE SET NULL`, RESEARCH §1 L11).
- Cleanup is **single-statement** `admin.from('polls').delete().eq('id', data.id)` — FK cascade verified complete in RESEARCH §1 (no multi-step teardown).
- **Rethrow** on insert/cleanup failure (D-04). NO try/swallow.
- Choices INSERT (Yes/No, sort_order 1/2) is required for `browse-respond.spec.ts` to find a `data-testid="choice-button"` to click (RESEARCH §6 rationale).
- Test-scoped (per-test) NOT worker-scoped — D-09 explicitly rejects worker-scoped.
- WHY comments are SECURITY/RELIABILITY rationale (cascade behavior, RLS bypass scope) — never plan/round IDs.

---

### `e2e/README.md` (CREATE — convention + fixture usage + seed + run-locally + gotchas)

**Closest in-repo analog:** No existing subdirectory README. The repository's only README is the top-level `/README.md` which is marketing-styled (badges, screenshots, hero copy) — wrong tone for an `e2e/` README.

**Tone analog:** `.planning/` doc tone (per CONTEXT specifics). Planner should match the direct, terse, no-marketing voice of `.planning/PROJECT.md`, `.planning/ROADMAP.md`, and the per-phase CONTEXT/RESEARCH files. No exclamation marks. No "🎉". No hedging ("might want to consider").

**Required content (D-09 + D-10, locked):**

| Section | Source / Key Constraint |
|---------|-------------------------|
| **E2E-SCOPE-1 rule statement + rationale** | RESEARCH §3 message; rationale = "two-layer seed makes un-filtered list assertions drift" |
| **Pointer** | `.planning/research/v1.1-PLAYWRIGHT-FIXTURES.md` |
| **freshPoll fixture usage** | Short snippet: `import { test, expect } from '../fixtures/poll-fixture'` + `test('...', async ({ page, freshPoll }) => {...})`. Cite when to reach for it (vote-precondition specs) vs the `[E2E]`-filter convention (read-only list specs). |
| **Two-layer seed explainer** | One paragraph: base `supabase/seed.sql` (idempotent ON CONFLICT) + additive `e2e/fixtures/seed.sql` (applied via `psql`). Explain why naive `.toHaveCount(N)` is broken-by-design. |
| **How to run E2E locally** | Use the EXACT command from RESEARCH §9 — there is **no `npm run e2e` script**. The commands are: `supabase start` → apply additive seed via `psql` → `npx playwright test --config e2e/playwright.config.ts --grep @smoke`. Add headed/single-spec debug variants. |
| **Common gotchas list** | Top 3-5 footguns: un-filtered counting; `.first()` on shared DB; missing vote precondition; FK cascade gaps. |

**Established constraints to respect:**
- Length target ~80-150 lines (D-09).
- Must contain the literal string `E2E-SCOPE-1` and a code block referencing `Locator.filter` (RESEARCH §10 verification command grep targets these tokens).
- Source-comment discipline applies: WHY-only; do NOT cite Phase 8, plan IDs, or PR numbers in the README body. Cite the upstream research document by path only.
- Do NOT cite `npm run e2e` — that script does not exist (RESEARCH §9).
- Recommended (per RESEARCH §9): add `"e2e": "playwright test --config e2e/playwright.config.ts"` to `package.json` for symmetry — planner's call. If added, the README cites `npm run e2e`; if not, the README cites the full `npx ...` command.

---

### `.planning/phases/03-response-integrity/03-UAT.md` (modify — append `## Second-Human Verification` section)

**Current shape (verbatim, lines 19-27 — the records to PRESERVE):**

```markdown
### 2. Non-Member Login Rejection
expected: A Discord user who is NOT in the WTCS Discord server attempts to sign in. After OAuth redirect, they are shown the error page with heading "WTCS Server Membership Required" and a "Join the WTCS Discord Server" button linking to the invite URL. They are NOT signed in.
result: skipped
reason: Burner account lacks 2FA (phone already used on main account); 2FA gate triggers first. Redirect to error page confirmed working. Deferred to team testing.

### 3. Error Page Invite Link
expected: On the not-in-server error page, clicking "Join the WTCS Discord Server" opens the WTCS Discord invite (discord.gg/aUe8NGP3U2). "Try Signing In Again" button is also present.
result: skipped
reason: Cannot reach not-in-server error page without 2FA-enabled non-member account
```

**Target shape (verbatim from RESEARCH §8 — appended AFTER the existing `## Gaps` section):**

```markdown
## Second-Human Verification

> Phase 8 / TEST-10 closure. The original `result: skipped` records above are
> preserved. This section appends executor-by-executor evidence per test.
> Runbook: `.planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md` (D-13).

### Test 2 — Non-Member Login Rejection

- executor: <Discord handle, e.g. `MapCommittee#1234`>
- verified-at: <UTC ISO 8601, e.g. `2026-05-09T18:42:00Z`>
- result: <pass | fail>
- notes: |
    <≥1 line — describe what was observed; if fail, attach screenshot path under
    .planning/phases/08-e2e-test-hygiene/artifacts/test-10-evidence/>

### Test 3 — Error Page Invite Link

- executor: <Discord handle>
- verified-at: <UTC ISO 8601>
- result: <pass | fail>
- notes: |
    <≥1 line>
```

**Established patterns to respect (analog: `*-UAT.md` evidence shape):**
- `## H2` headings for top-level sections (existing file uses `## Tests`, `## Summary`, `## Gaps`). The new section is also H2 — RESEARCH §8 rationale.
- Bullet-list sub-blocks (NOT YAML frontmatter) — matches the file's plain-Markdown body.
- The H3 sub-headings mirror the existing `### 2.` / `### 3.` test labels.
- DO NOT modify the existing `result: skipped` lines — preserve history per D-12.
- Frontmatter `updated:` date: bump only when filled in (deferred per RESEARCH §8); not Phase 8's job.
- Consider re-running Round 04's `04-UAT.md` `re_run:` pattern as a future analog if multi-executor evidence accumulates — out of Phase 8 scope.

---

### `.planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md` (CREATE — second-human runbook)

**Closest in-repo analog:** No existing standalone runbook scripts. The closest shape is the `*-UAT.md` evidence-block format (used in all 7 existing phases) — same H3 per-test structure, same `expected:`/`result:`/`notes:` field set.

**Required content (D-11 + D-13 + RESEARCH §8):**

| Section | Constraint |
|---------|-----------|
| **Header** | Phase / TEST-10 / runbook scope — what this is, who runs it, when. |
| **Prerequisites** | Tester profile: WTCS-member-or-not (depends on test); 2FA-enabled Discord; not the original 03-UAT executor (the WHOLE point is second-human). |
| **Test 2 steps** | Stepwise. Verbatim copy-pastable URLs (`/auth/error?reason=not-in-server` does NOT replicate the test — the test is the actual OAuth flow). Include exact heading/button copy to look for ("WTCS Server Membership Required", "Join the WTCS Discord Server", invite URL `discord.gg/aUe8NGP3U2`). |
| **Test 3 steps** | Stepwise from the not-in-server error page reached in Test 2. |
| **Evidence template** | Copy of the bullet-list block from RESEARCH §8 — tester fills in and pastes into `03-UAT.md`'s new `## Second-Human Verification` section. |
| **Filled-in EXAMPLE** | RESEARCH §8 has a verbatim example with `ExampleTester#0001`, ISO timestamp, and `notes:` rationale lines. Copy it verbatim. |

**Established patterns to respect:**
- Stepwise + copy-pasteable tone (CONTEXT specifics §runbook tone).
- WHY-only comments inside any code blocks; runbook prose is allowed to cite `Phase 8 / TEST-10 / D-13` because this IS a planning-doc runbook (not source code) — per CONTEXT `feedback_no_review_archaeology_in_source.md` the rule is "no rot tags in **source**." `.planning/` docs are exempt.
- Fields the evidence template requires (D-12): `executor`, `verified-at` (UTC ISO 8601), `result` (pass|fail), `notes:` (≥1 line each).
- Phase 8 verification does NOT block on actual evidence being filled in (D-11) — the artifact is the deliverable; evidence appears asynchronously when a tester is available.

---

## Shared Patterns (cross-cutting)

### Source-comment discipline (applies to every modified `e2e/**` file + `eslint.config.js`)

**Rule (CLAUDE.md memory `feedback_no_review_archaeology_in_source.md`):** Source comments are **WHY-only**. Never cite `Phase 8`, `Round 2`, `PR #21`, `D-04`, `TEST-09`, `issue #12` in source files.

**Apply to:** `e2e/helpers/auth.ts`, `e2e/tests/*.spec.ts`, `e2e/fixtures/poll-fixture.ts`, `eslint.config.js`.

**Exempt:** `.planning/**/*.md` (including `08-UAT-10-SCRIPT.md` and the appended `03-UAT.md` section) — planning docs are the correct home for plan/round refs.

**Counter-example to AVOID:**
```ts
// ❌ Phase 8 / Round 2 / TEST-07 / issue #12 fix — added freshPoll fixture per D-01
```

**Correct shape:**
```ts
// E2E-SCOPE-1: bind to fixture-inserted poll by exact title match.
```

ESLint's `no-restricted-syntax` rule message is allowed to mention `E2E-SCOPE-1` — it's a stable convention name, not a rot-tag.

---

### `[@smoke]` test-name prefix

**Source pattern (every existing spec):**
```ts
test('[@smoke] user browses topics, responds, sees live results', async ({ page }) => {
```

**Apply to:** Every modified spec — keep the prefix verbatim. The CI Playwright invocation `--grep @smoke` (RESEARCH §9 / `ci.yml:170`) depends on it.

---

### Selector vocabulary (Phase 5 D-08 / 05-04 M7)

**Canonical selectors to USE (do not invent new ones):**
- `data-testid="suggestion-card"` — list item.
- `data-testid="choice-button"` — vote target.
- `data-testid="admin-create-suggestion"` — admin toolbar Create.
- `data-testid="suggestion-form-submit"` — form submit.
- `role="meter"` — result bars (M7 hook).

**Apply to:** `freshPoll` fixture's downstream consumers; any future spec.

---

### `[E2E]` title prefix convention

**Source pattern (three-way consistency):**
- `e2e/fixtures/seed.sql:122,129,136,143` — static polls all start with `[E2E]` or `[E2E SMOKE]`.
- `e2e/tests/admin-create.spec.ts:34` — runtime `[E2E] Admin-create ${Date.now()}`.
- RESEARCH §6 fixture skeleton — `[E2E] ${slug} ${Date.now()}`.

**Apply to:** Every E2E-managed poll row (seeded OR runtime-inserted). The lint rule's regex `/^\[E2E/` and the `e2e/README.md` documentation depend on this convention.

---

### Two-layer seed flow (read-only awareness)

**Source pattern:** base `supabase/seed.sql` (idempotent `ON CONFLICT`) + additive `e2e/fixtures/seed.sql` (applied via `psql -f`, fail-closed via `app.e2e_seed_allowed=true`). CI does both (`ci.yml:62`, `ci.yml:131`).

**Apply to:** `e2e/README.md`'s "Two-layer seed explainer" section + the README's "How to run E2E locally" section.

**Phase 8 does NOT modify either seed file** — fixture INSERTs are runtime-scoped (RESEARCH §7).

---

### Test-scoped fixture cleanup pattern

**Canonical Playwright shape:**
```ts
fixtureName: async ({}, use, testInfo) => {
  // setup
  const value = await setup()
  await use(value)
  // teardown — rethrow on failure
  await teardown()
},
```

**Apply to:** `e2e/fixtures/poll-fixture.ts`. Worker-scoped explicitly REJECTED (D-09 / CONTEXT `<deferred>`).

---

## No Analog Found (in-repo)

| File | Reason | Fallback |
|------|--------|----------|
| `e2e/fixtures/poll-fixture.ts` | No prior `test.extend(...)` file in repo | RESEARCH §6 verbatim skeleton (file:line-grounded against `schema.sql`) |
| `e2e/README.md` | No subdir README in repo; top-level `/README.md` is wrong tone | `.planning/PROJECT.md` + `.planning/ROADMAP.md` tone (terse, no marketing) |
| `08-UAT-10-SCRIPT.md` | No standalone runbook in repo | `*-UAT.md` H3 evidence-block shape (Test 2 / Test 3 sub-blocks) |

---

## Metadata

**Analog search scope:** `e2e/`, `eslint.config.js`, `.planning/phases/*/`, repo root `*.md`.
**Files scanned:** 8 source files + 7 UAT analogs + 1 top-level README.
**Pattern extraction date:** 2026-05-02.
**Upstream context:** `08-CONTEXT.md` (D-01 through D-13) + `08-RESEARCH.md` (§1-10).

## PATTERN MAPPING COMPLETE
