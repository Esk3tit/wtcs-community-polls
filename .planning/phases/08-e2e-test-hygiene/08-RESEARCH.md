# Phase 8: E2E Test Hygiene — Research

**Researched:** 2026-05-02
**Domain:** Playwright E2E hygiene under Supabase two-layer seed
**Confidence:** HIGH (all critical claims are file:line-grounded; `[ASSUMED]` empty)

---

## TL;DR

- **FK cascade is COMPLETE.** `polls.id` cascades to `choices`, `votes`, `vote_counts` via `ON DELETE CASCADE` (schema.sql L85, L99, L100, L115, L116). D-04's single-step `delete().eq('id', data.id)` is correct — no multi-step teardown needed. `categories.id` does NOT cascade into polls (it uses `ON DELETE SET NULL` at L63), but that direction is irrelevant here.
- **The 3 failing specs are surgical.** `admin-create.spec.ts` is already E2E-SCOPE-1-clean (no list-count assertions); `browse-respond.spec.ts` needs L24 + L45 patched and L24 replaced by `freshPoll`; `filter-search.spec.ts` needs L30 patched. Specific diffs in §2.
- **`auth-errors.spec.ts` is rule-clean.** Zero matched call sites — no eslint-disable or filter additions needed.
- **The research-suggested AST selector is too narrow on its own.** `>` is a direct-child combinator and `:not(...)` only blocks the immediate `filter` parent — it does NOT scan the full chain. A tightened selector + the eslint-disable escape-hatch (D-06) is what makes the rule honest. See §3 for the exact selector and AST trace.
- **Service-role client must be NEW.** `e2e/helpers/auth.ts` does NOT currently mint a service-role client — CONTEXT line 119 (and the Domain → Existing Code Insights bullet) are wrong on this. `auth.ts` uses ONLY `ANON_KEY` (L27). The fixture cannot "import the same client." The planner must add a new module-scoped service-role client export to `auth.ts` (or factor into a sibling helper) — see §5.
- **CI is gap-free for the new lint rule.** `npm run lint` runs as a precondition to e2e (lint-and-unit gate at ci.yml L23–34, e2e `needs: lint-and-unit` at L37). The fixture seed is applied via `psql … -f e2e/fixtures/seed.sql` after `supabase start` (L131). One small documentation gap: there is **no `npm run e2e` script** — CI invokes `npx playwright test --config e2e/playwright.config.ts --grep @smoke` directly. README must use the same incantation, NOT a fictitious `npm run e2e`.

---

## Background

The high-level technical approach for Phase 8 is locked by `.planning/research/v1.1-PLAYWRIGHT-FIXTURES.md` (E2E-SCOPE-1 convention, ESLint snippet, freshPoll fixture sketch, hybrid-seed rationale) and the 13 D-decisions in `08-CONTEXT.md`. This file does NOT re-derive that approach — it answers the 10 specific verification questions the planner needs to write deep, executable plans, and flags one important factual error in the upstream context bullet.

---

## Specific Findings

### 1. FK cascade verification (D-04 anchor)

**Verdict:** **Cascade is complete in the polls → children direction.** D-04's single-step `delete().eq('id', data.id)` IS correct.

**Evidence (`supabase/migrations/00000000000000_schema.sql`):**

```
L70:  created_by UUID NOT NULL REFERENCES public.profiles(id),     -- polls → profiles (no cascade direction matters here; not deleting profiles)
L85:  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,   -- choices.poll_id → polls
L99:  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,   -- votes.poll_id → polls
L100: choice_id UUID NOT NULL REFERENCES public.choices(id) ON DELETE CASCADE, -- votes.choice_id → choices
L115: poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,   -- vote_counts.poll_id → polls
L116: choice_id UUID NOT NULL REFERENCES public.choices(id) ON DELETE CASCADE, -- vote_counts.choice_id → choices
```

`grep -rn 'CASCADE\|REFERENCES.*polls' supabase/migrations/` confirms no other table references `polls.id` and no later migration adds a non-cascading FK. Migrations 1–9 add only RLS, triggers, and RPCs — no schema-altering FK additions.

**What teardown actually does:** `adminClient.from('polls').delete().eq('id', data.id)` removes the poll row, which cascades to (a) all `choices` for that poll, (b) all `votes` for that poll (also cascade-redundant via choice → vote chain), and (c) all `vote_counts` for that poll. Single statement, atomic at the FK level.

**Planner action:** Plan can specify the single-line cleanup verbatim. NO need for a multi-step teardown, NO need to delete from `votes` or `vote_counts` first. The first plan task can be a 5-line scratch script (`select count(*) from votes where poll_id = '<inserted-id>'` before/after a manual insert+delete) to mechanically prove cascade, but it is documentation/confidence work — not a behavior fix.

---

### 2. Existing failing-spec diagnosis (per-spec exact diffs)

#### 2a. `e2e/tests/admin-create.spec.ts` — **already E2E-SCOPE-1 compliant; no list-count assertion exists**

This spec was already fixed in commit `7ef6c82` (Yes/No preset click — L50). The remaining assertions are:

```
L64-65: await expect(page).toHaveURL(/\/admin(?:\/suggestions)?\/?(?:\?.*)?$/, { timeout: 10_000 })
        await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10_000 })
L71:    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10_000 })
```

`uniqueTitle = '[E2E] Admin-create ${Date.now()}'` (L34) is globally unique by timestamp; `getByText(uniqueTitle)` cannot collide with shared-DB rows.

**No code change needed.** Issue #11's actual fix (Yes/No preset) already shipped. Spec is currently failing in CI for a different reason — needs a re-run after the other two specs are green to confirm it's actually green now (the v1.1-PLAYWRIGHT-FIXTURES.md research confirmed this in the §11 paragraph).

**Optional cosmetic:** add a single-line E2E-SCOPE-1 reference comment above L64 per the research diff. Not required.

#### 2b. `e2e/tests/browse-respond.spec.ts` — **2 line changes (one becomes a fixture migration)**

Diffs:

```diff
@@ L19 — keep test name
 test('[@smoke] user browses topics, responds, sees live results', async ({ page }) => {
   await loginAs(page, fixtureUsers.memberUser.id)
   await page.goto('/topics')

@@ L24 — REPLACE with freshPoll fixture consumer
-  const firstCard = page.getByTestId('suggestion-card').first()
+  // E2E-SCOPE-1: bind to fixture-inserted poll by exact title match.
+  const firstCard = page
+    .getByTestId('suggestion-card')
+    .filter({ hasText: freshPoll.title })
+    .first()
   await expect(firstCard).toBeVisible()

@@ L45 — TIGHTEN regex from \d+ to [1-9]\d*
-  await expect(firstCard.getByText(/\d+\s+total response/i)).toBeVisible({ timeout: 10_000 })
+  // After our own vote, count must be >= 1. Rules out the 0-vote false positive.
+  await expect(firstCard.getByText(/[1-9]\d*\s+total response/i)).toBeVisible({ timeout: 10_000 })
```

Plus the `import { test, expect } from '@playwright/test'` at L1 must change to `import { test, expect } from '../fixtures/poll-fixture'` (the fixture file re-exports `test` extended; standard Playwright fixture composition pattern).

**The L24 + L40 DOM-scoped `.first()` calls inside `firstCard`** (`firstCard.getByRole('button', { expanded: false }).first()` L32, `firstCard.getByTestId('choice-button').first()` L40) — these are scoped to a single fixture card. They will trip the lint rule and need eslint-disable + WHY comment. See §4.

#### 2c. `e2e/tests/filter-search.spec.ts` — **single-locator scope change**

Diff:

```diff
@@ L30 — scope `cards` to [E2E]-prefixed entries
-  const cards = page.getByTestId('suggestion-card')
+  // E2E-SCOPE-1: ignore canonical b0000…* polls; assert only on fixture d0000…* rows.
+  const cards = page.getByTestId('suggestion-card').filter({ hasText: /^\[E2E/ })
```

Downstream `cards.first()` (L31), `cards.count()` (L32, L53), and `cards.toHaveCount(1, …)` (L62) all become correct because the base locator is now filtered.

The `page.getByTestId('suggestion-card').filter({ hasText: /Sinai/i }).first()` at L51 is already E2E-SCOPE-1 compliant (it has `.filter(...)` immediately before `.first()`) — but the filter is on `/Sinai/i`, not `/^\[E2E/`. Per D-07, the rule does NOT require the literal `[E2E]` regex — any `.filter(...)` is enough. So L51 stays as-is, but the planner should add a WHY comment ("Sinai-specific narrowing; fixture-only because the parent locator is fixture-scoped via the filter on L30") to make the intent durable.

The `'SMOKE'` search token (L61) currently relies on the fixture's `[E2E SMOKE]` title prefix at `e2e/fixtures/seed.sql:122`. That is preserved in the canonical seed; no change needed. (The CONTEXT D-09/D-10 leave the SMOKE-vs-fresh-poll-token choice to the planner; recommend keeping SMOKE — a fresh-poll token would force the search assertion to depend on the freshPoll fixture, which is the wrong consumer per D-01.)

---

### 3. ESLint AST selector — exact form, with AST trace

**Recommended selector** (slight tightening of the research draft):

```js
// eslint.config.js — append after existing flat-config entries
{
  files: ['e2e/tests/**/*.spec.ts'],
  rules: {
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

**AST trace — why this works:**

For `cards.first()`:
```
CallExpression
└── callee: MemberExpression
    ├── object: Identifier "cards"
    └── property: Identifier "first"
```
The selector matches: `CallExpression` whose `callee.type='MemberExpression'` and `callee.property.name='first'`. The `:not(:has(CallExpression[callee.property.name='filter']))` checks for any descendant `CallExpression` whose property is `filter`. `cards` is a bare identifier — no `filter` CallExpression descendant — **rule fires.** ✓

For `cards.filter({hasText: /^\[E2E/}).first()`:
```
CallExpression                              ← outer .first()
└── callee: MemberExpression
    ├── object: CallExpression              ← .filter({...})
    │   └── callee: MemberExpression
    │       └── property: "filter"
    └── property: "first"
```
The outer CallExpression matches the property-name regex. `:has(...)` walks descendants and finds the inner `CallExpression[callee.property.name='filter']` inside `callee.object`. `:not(:has(...))` excludes — **rule does NOT fire.** ✓

For `page.getByTestId('x').filter({...}).first()` — same as above, the `.filter()` CallExpression is a descendant of the outer `.first()` CallExpression. **Rule does NOT fire.** ✓

For `firstCard.getByRole('button', { expanded: false }).first()` (DOM-scoped, browse-respond.spec.ts:32):
```
CallExpression                              ← outer .first()
└── callee: MemberExpression
    ├── object: CallExpression              ← .getByRole(...)
    │   └── callee: MemberExpression
    │       └── property: "getByRole"       ← NOT "filter"
    └── property: "first"
```
No `filter` descendant — **rule fires.** This is a true positive that requires the eslint-disable + WHY comment per D-06.

**Why NOT the research-original selector** `CallExpression[...] > :not(CallExpression[callee.property.name='filter'])`: ESLint's `>` is the **direct child** combinator and `:not(...)` only excludes the IMMEDIATE child of the matched CallExpression. It does NOT walk the chain. For `cards.first()`, the direct children of the outer CallExpression are its `callee` (MemberExpression — not filter) and `arguments` (none). The `:not(CallExpression[callee.property.name='filter'])` matches the `callee` MemberExpression (which is not a filter CallExpression), so the rule fires. So far so good. But for `cards.filter(...).first()`, the direct children of the outer CallExpression are STILL the `callee` MemberExpression and `arguments` — the `.filter(...)` CallExpression is a grandchild via `callee.object`, not a direct child. The original selector misses this and the rule fires anyway → false positive on a compliant call. The `:has(...)` traversal in the recommended form fixes this.

**Zero false positives across the four existing specs after migration:**

| Spec | Match site | Compliant? | Action |
|------|------------|-----------|--------|
| admin-create | (none) | n/a | no change |
| browse-respond | L24 `getByTestId(...).first()` (post-migration: `getByTestId(...).filter(freshPoll.title).first()`) | yes (filter present) | no disable |
| browse-respond | L32 `firstCard.getByRole(...).first()` (DOM-scoped) | no (DOM-scoped, fixture-card-bound) | eslint-disable + WHY |
| browse-respond | L40 `firstCard.getByTestId(...).first()` (DOM-scoped) | no (DOM-scoped) | eslint-disable + WHY |
| filter-search | L31 `cards.first()` (post-migration: cards is now `.filter(...)`-bound) | yes (filter present in chain) | no disable |
| filter-search | L51 `getByTestId(...).filter(/Sinai/i).first()` | yes (filter present) | no disable |
| filter-search | L62 `cards.toHaveCount(1, ...)` (post-migration) | yes (filter present in chain) | no disable |
| auth-errors | (none) | n/a | no change |

**Caveat — `:has(...)` requires ESLint ≥ 8.40.** Repo runs ESLint 9.39.4 (`package.json` L48). ✓

---

### 4. `auth-errors.spec.ts` compliance check

**Verdict: CLEAN. Zero matched call sites.**

`grep -n '\.first()\|\.nth(\|\.all()\|\.last()\|\.toHaveCount('  e2e/tests/auth-errors.spec.ts` returns nothing. The spec's only assertions are `expect(page.getByRole('heading', { name: ... })).toBeVisible()` (L23, L29) — `toBeVisible` is not in the rule regex, and `getByRole(...)` already implicitly indexes by name match.

**Planner action:** No change to `auth-errors.spec.ts`. CONTEXT's "Claude's Discretion" item ("verify auth-errors does not trip the rule") resolves to no-op — confirm with `npm run lint` after the rule lands.

**Inventory across all four specs (search results from `grep -n '\.first()\|\.nth(\|\.all()\|\.last()\|\.toHaveCount('`):**

```
admin-create.spec.ts:54:  // ... PR #4 review): tightened from ... `.last()` against any   ← comment-only
browse-respond.spec.ts:13: // ... was getByRole('button').first() which ambiguously matched the   ← comment-only
browse-respond.spec.ts:24: const firstCard = page.getByTestId('suggestion-card').first()   ← shared-DB → filter
browse-respond.spec.ts:32: const collapsedTrigger = firstCard.getByRole('button', {expanded:false}).first()   ← DOM-scoped → disable
browse-respond.spec.ts:40: const firstChoice = firstCard.getByTestId('choice-button').first()   ← DOM-scoped → disable
filter-search.spec.ts:31: await expect(cards.first()).toBeVisible()   ← shared-DB (until L30 patched) → filter via L30
filter-search.spec.ts:47: // ... `.first()` disambiguates ...   ← comment-only
filter-search.spec.ts:51: page.getByTestId('suggestion-card').filter({...}).first()   ← already compliant
filter-search.spec.ts:62: await expect(cards).toHaveCount(1, {timeout: 5_000})   ← shared-DB (until L30 patched) → filter via L30
```

ESLint inspects code only, not comments, so the comment-only matches are irrelevant.

---

### 5. Service-role client export shape

**Critical correction to upstream CONTEXT:** `e2e/helpers/auth.ts` does **NOT** currently mint a service-role client. CONTEXT.md L119 ("`e2e/helpers/auth.ts` already mints a service-role Supabase client for session-injection") is **factually wrong**.

**Evidence (`e2e/helpers/auth.ts`):**
- L26: `const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321'`
- L27: `const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY`
- L29-35: throws if `ANON_KEY` is missing
- L74-75: `createClient(SUPABASE_URL, ANON_KEY as string, {...})` — **anon key only**
- File comment L13: "Service-role key is NOT used here (tripwire-guarded). Service-role stays inside seeding contexts; `loginAs` is strictly anon-key + password."

The service-role key DOES exist in CI env (`ci.yml` L165 `SUPABASE_SERVICE_ROLE_KEY: ${{ steps.supabase-keys.outputs.service_role_key }}` — exposed to the e2e job env per the comment "Any future seeding-style test utilities that need privileged DB access will read it from here") — but no helper currently reads it. The planner is establishing this wiring for the first time.

**Recommended export shape** — add to `e2e/helpers/auth.ts`, beneath the existing exports:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Module-scoped lazy singleton: created on first access, reused across fixtures.
// Service-role bypasses RLS — only used inside e2e/fixtures/* and e2e/helpers/*,
// never inside specs (the loginAs() public API stays anon-only).
let _adminClient: SupabaseClient | null = null

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

Why a getter, not a top-level const: `loginAs()` already throws at module-load time when `VITE_SUPABASE_ANON_KEY` is missing (L29-35). Adding a second module-load throw on `SUPABASE_SERVICE_ROLE_KEY` would make ALL specs fail to import the module — including `auth-errors.spec.ts`, which doesn't need the service-role client. A getter defers the env-var check until the freshPoll fixture actually requests the client, so non-fixture-using specs stay unaffected. (The existing anon-key throw at L29 is acceptable because every spec calls `loginAs()`.)

**The fixture imports it as:**

```ts
import { getAdminClient } from '../helpers/auth'
// ...
const admin = getAdminClient()
const { data, error } = await admin.from('polls').insert({...}).select().single()
```

**`loginAs()` public API is unchanged.** No spec needs to update its `loginAs` import.

---

### 6. Playwright `freshPoll` fixture-of-values skeleton

**File:** `e2e/fixtures/poll-fixture.ts`

```ts
import { test as base, expect } from '@playwright/test'
import { fixtureUsers } from './test-users'
import { getAdminClient } from '../helpers/auth'

// Per-test mutable poll state. Inserts before the test runs, deletes after.
// Cascade via FK (polls.id → choices/votes/vote_counts ON DELETE CASCADE) means
// a single DELETE wipes all child rows in one statement — see 08-RESEARCH §1.
type PollFixtures = {
  freshPoll: { id: string; title: string }
}

export const test = base.extend<PollFixtures>({
  freshPoll: async ({}, use, testInfo) => {
    const admin = getAdminClient()

    // Title: [E2E] {sanitized testInfo.title} {Date.now()} — guaranteed unique
    // and prefix-compatible with E2E-SCOPE-1 (`.filter({ hasText: /^\[E2E/ })`).
    // polls.title is TEXT NOT NULL with no length cap (schema.sql L61) so no
    // hard truncation is required, but trim to a sane bound so report titles
    // stay readable.
    const slug = testInfo.title.replace(/[^\w\s.-]/g, '').slice(0, 80)
    const title = `[E2E] ${slug} ${Date.now()}`

    const { data, error } = await admin
      .from('polls')
      .insert({
        title,
        description: 'freshPoll fixture row',
        status: 'active',
        is_pinned: false,
        category_id: null,                                                 // FK is ON DELETE SET NULL; null is allowed
        created_by: fixtureUsers.adminUser.id,                             // FK to public.profiles; admin fixture user is seeded
        closes_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id, title')
      .single()
    if (error || !data) throw error ?? new Error('freshPoll insert returned no row')

    // Two choices so the spec can vote — choices.poll_id has ON DELETE CASCADE.
    const { error: choiceErr } = await admin.from('choices').insert([
      { poll_id: data.id, label: 'Yes', sort_order: 1 },
      { poll_id: data.id, label: 'No',  sort_order: 2 },
    ])
    if (choiceErr) throw choiceErr

    await use({ id: data.id, title: data.title })

    // Cleanup. Cascade handles choices/votes/vote_counts in one statement.
    // Rethrow on failure per D-04 — leaking rows pollutes shared DB.
    const { error: deleteErr } = await admin.from('polls').delete().eq('id', data.id)
    if (deleteErr) throw deleteErr
  },
})

export { expect }
```

**Why the choices INSERT is included in the fixture:** `browse-respond.spec.ts` votes by clicking a `data-testid="choice-button"` (L40). A poll with zero choices renders no choice buttons, the click hangs, the test fails. D-03 says "minimal value shape" but the fixture's POSTCONDITION must be a vote-able poll, otherwise the proof-of-contract consumer (D-01) cannot exercise its happy path.

**Title sanitization rationale:** `testInfo.title` for a Playwright test is exactly the string passed to `test('...')`. The browse-respond test name is `'[@smoke] user browses topics, responds, sees live results'`. Direct interpolation into a polls.title is fine (TEXT, no length cap, no charset constraint), but the `[@smoke]` token plus brackets makes the regex `/^\[E2E/` ambiguous — the title would start with `[E2E] [@smoke] user...`. The regex only checks the first 4 chars (`[E2E`), which still matches. So sanitization is cosmetic only. Recommended `.replace(/[^\w\s.-]/g, '')` strips brackets/at-signs/punctuation; `.slice(0, 80)` keeps the rendered card title readable. The `Date.now()` suffix preserves uniqueness across re-runs.

---

### 7. Two-layer seed integrity check

**`e2e/fixtures/seed.sql` does NOT have an existing poll matching the freshPoll title pattern.**

All four fixture polls are static-titled (`[E2E SMOKE] Remove MiG-29 …`, `[E2E] Add Sinai …`, `[E2E] Extend round timer …`, `[E2E] Archived Sweden …` — L122/129/136/143). None has the `[E2E] {testname} {ms-timestamp}` shape that the freshPoll fixture inserts. **Zero collision risk.**

**`supabase/seed.sql` is fully idempotent.** Every `INSERT` ends in `ON CONFLICT (id) DO NOTHING` (admin_discord_ids L17, categories L26, auth.users L57, polls L98, choices L107/114/120/127/135/141/148, vote_counts L160/167) or `ON CONFLICT (id) DO UPDATE SET …` (profiles L77).

**`e2e/fixtures/seed.sql` is also idempotent** — same `ON CONFLICT DO NOTHING` / `DO UPDATE SET` across auth.users (L66), profiles (L95), admin_discord_ids (L109), polls (L149), choices (L168). Plus the `app.e2e_seed_allowed=true` fail-closed guard at L22-28.

**Phase 8 seed changes:** **None.** The fixture INSERTs are runtime, not seed-time. The static seed stays as-is per CONTEXT D-09 ("Out of scope: moving ALL mutable poll rows out of `e2e/fixtures/seed.sql`").

---

### 8. TEST-10 evidence template structure

`.planning/phases/03-response-integrity/03-UAT.md` is currently structured as `### N. Title` with `expected:` / `result:` / (optionally) `reason:` lines. Tests 2 and 3 are both `result: skipped` with `reason:` text (L20-22, L25-27).

**Per D-12, the new section is appended (does not modify existing records).** Recommended template:

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

**Filled-in EXAMPLE block (placeholder values for the runbook to lift verbatim):**

```markdown
### Test 2 — Non-Member Login Rejection

- executor: ExampleTester#0001
- verified-at: 2026-05-09T18:42:00Z
- result: pass
- notes: |
    Logged in via Discord with an account NOT in the WTCS server. After the
    OAuth callback completed, the browser landed on /auth/error?reason=not-in-server
    and the heading "WTCS Server Membership Required" rendered. The "Join the
    WTCS Discord Server" CTA was visible and pointed at discord.gg/aUe8NGP3U2.
    Session was NOT established (no Supabase auth cookie present in DevTools).

### Test 3 — Error Page Invite Link

- executor: ExampleTester#0001
- verified-at: 2026-05-09T18:44:00Z
- result: pass
- notes: |
    From the not-in-server error page reached above, clicked "Join the WTCS
    Discord Server" — opened https://discord.gg/aUe8NGP3U2 in a new tab.
    "Try Signing In Again" button was also present and routed back to /login.
```

**Why bullet-list (not YAML frontmatter) sub-blocks:** the rest of the file is plain Markdown — embedding a YAML block would force readers to mentally context-switch. Bullet syntax also reads cleanly when rendered on GitHub.

**Why a `## Second-Human Verification` H2 (not H3):** parallels the file's other H2 (`## Tests`, `## Summary`, `## Gaps`). Frontmatter `updated:` should also be bumped when this section is filled in — out-of-scope-for-Phase-8-research but worth flagging in the runbook.

---

### 9. CI integration check

`.github/workflows/ci.yml` analysis (full file inspected):

| Required step | Present | Location |
|---------------|---------|----------|
| `npm run lint` runs | ✓ | L33 (lint-and-unit job) |
| e2e job blocks on lint | ✓ | L37 `needs: lint-and-unit` |
| `supabase start` applies migrations + base seed | ✓ | L62 |
| `e2e/fixtures/seed.sql` applied via psql | ✓ | L131 (`psql "$db_url" -f e2e/fixtures/seed.sql`) |
| `app.e2e_seed_allowed=true` set for fail-closed guard | ✓ | L130 (`PGOPTIONS: -c app.e2e_seed_allowed=true`) |
| Service-role key exposed to e2e job env | ✓ | L165 (`SUPABASE_SERVICE_ROLE_KEY: ${{ steps.supabase-keys.outputs.service_role_key }}`) |
| Playwright invocation | ✓ | L170 (`npx playwright test --config e2e/playwright.config.ts --grep @smoke`) |

**No CI gaps that would prevent the new lint rule from firing.** When `eslint.config.js` lands with the new rule, the next CI run executes `npm run lint` → `eslint .` (per `package.json` L11) → the rule activates against `e2e/tests/**/*.spec.ts`. Lint failures block the e2e job.

**One documentation gotcha for `e2e/README.md` (D-09 scope):** there is **no `npm run e2e` script**. The README's "How to run E2E locally" section MUST cite the actual command:

```bash
# After supabase start + seed:
npx playwright test --config e2e/playwright.config.ts --grep @smoke

# Single spec (debug):
npx playwright test --config e2e/playwright.config.ts e2e/tests/browse-respond.spec.ts --headed
```

Citing a fictitious `npm run e2e` would mislead. Adding `"e2e": "playwright test --config e2e/playwright.config.ts"` to `package.json` is a 1-line plan task if the planner wants to honor the convention used elsewhere in the codebase (`npm run lint`, `npm test`) — recommend doing this for symmetry.

---

### 10. Open issue cross-refs (gh CLI)

GitHub issues #11, #12, #13 fetched via `gh issue view <n> --repo Esk3tit/wtcs-community-polls`. All three confirm the v1.1-PLAYWRIGHT-FIXTURES.md analysis verbatim:

- **#11** ("admin-create.spec.ts doesn't populate Choice 1/2 before submit"): Root cause = Choice 1/2 textboxes empty when submit clicked → form validation blocks → URL never changes. Fix already shipped in `7ef6c82` (Yes/No preset click). `playwright report from CI run 24877484418` cited.
- **#12** ("browse-respond.spec.ts asserts vote count on fixture polls with zero votes"): Root cause = `e2e/fixtures/seed.sql` seeds polls + choices but no votes; UI correctly renders no "N total response" text. Issue author lists "Cast a vote in the test itself" as preferred fix — exactly D-01.
- **#13** ("filter-search.spec.ts toHaveCount() doesn't account for two-layer seed"): Root cause = test computes counts against one seed layer while CI applies both. Issue author lists "Disambiguate via the `[E2E]` title prefix" as preferred fix — exactly E2E-SCOPE-1.

**No new information beyond what `v1.1-PLAYWRIGHT-FIXTURES.md` already encoded.** All three issues are open with milestone `v1.1`; closing them is part of Phase 8's PR description.

---

## Validation Architecture

Per `nyquist_validation` enabled (no explicit `false` in `.planning/config.json` per inspection — config not present, so default-on). Lift these requirements verbatim into PLAN frontmatter `must_haves` and execute-phase verification commands.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright `1.59.1` (`package.json` L36) |
| Config file | `e2e/playwright.config.ts` |
| Quick run command | `npx playwright test --config e2e/playwright.config.ts --grep @smoke -x` |
| Full suite command | `npx playwright test --config e2e/playwright.config.ts --grep @smoke` |
| Lint rule check | `npm run lint` (runs `eslint .` per `package.json` L11) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-07 | All 3 previously-failing specs pass green under two-layer seed | e2e | `npx playwright test --config e2e/playwright.config.ts --grep @smoke` (run after `supabase start` + `psql -f e2e/fixtures/seed.sql`) | ✅ files exist; assertions need patching |
| TEST-08 (rule fires on violation) | ESLint flags `cards.first()` w/o `.filter()` | unit (synthetic) | `printf "import { test } from '@playwright/test'\ntest('x', async ({ page }) => { await page.getByTestId('y').first() })\n" > e2e/tests/_lint-canary.spec.ts && npx eslint e2e/tests/_lint-canary.spec.ts; rm e2e/tests/_lint-canary.spec.ts` (expect non-zero exit) | ❌ Wave 0 — canary spec generated/torn-down per run |
| TEST-08 (rule does NOT fire on compliant code) | ESLint passes on the four updated specs | unit | `npx eslint e2e/tests/` (expect zero exit) | ✅ files exist post-Wave 1 |
| TEST-08 (README documents rule) | `e2e/README.md` exists, ≥80 lines, contains literal string `E2E-SCOPE-1` and a code block referencing `Locator.filter` | docs | `[ -f e2e/README.md ] && [ "$(wc -l < e2e/README.md)" -ge 80 ] && grep -q 'E2E-SCOPE-1' e2e/README.md && grep -q 'Locator.filter' e2e/README.md` | ❌ Wave 0 — file to be created |
| TEST-09 (fixture inserts + cleans up exactly 1 row) | Row-count delta around `await use(...)` is +1 then -1 | integration | After spec run: `psql "$DB_URL" -c "select count(*) from polls where title like '[E2E]%' and created_at > now() - interval '5 minutes'"` (expect 0; non-zero indicates leak) | ❌ Wave 0 — fixture file to be created |
| TEST-09 (proof-of-contract consumer green) | `browse-respond.spec.ts` passes using `freshPoll` fixture | e2e | `npx playwright test --config e2e/playwright.config.ts e2e/tests/browse-respond.spec.ts --grep @smoke` | ✅ file exists; needs migration |
| TEST-10 (runbook + template exist) | `08-UAT-10-SCRIPT.md` exists, `03-UAT.md` has `## Second-Human Verification` section | docs | `[ -f .planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md ] && grep -q '^## Second-Human Verification' .planning/phases/03-response-integrity/03-UAT.md` | ❌ Wave 0 — files to be created/edited |
| TEST-10 (runbook is read-only) | No source-code paths touched by TEST-10 work | git diff | After plan completes: `git diff --name-only $(git merge-base HEAD main)..HEAD -- 'src/**' 'supabase/**' | grep -v '^$' | wc -l` should be 0 for the TEST-10 plan task only | ✅ enforceable via plan task scoping |

### Sampling Rate

- **Per task commit:** `npm run lint` (always) + `npx playwright test --config e2e/playwright.config.ts e2e/tests/<changed-spec>.spec.ts --grep @smoke` (the spec(s) touched in this commit)
- **Per wave merge:** `npm run lint` + `npx playwright test --config e2e/playwright.config.ts --grep @smoke` (all 4 specs)
- **Phase gate:** Full suite green in CI on the PR before `/gsd-verify-work` (CI runs both lint-and-unit + e2e per `ci.yml`)

### Wave 0 Gaps

- [ ] `e2e/fixtures/poll-fixture.ts` — covers TEST-09; new file
- [ ] `e2e/README.md` — covers TEST-08 documentation; new file
- [ ] `.planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md` — covers TEST-10 runbook; new file
- [ ] `eslint.config.js` — append flat-config block; existing file edit (covers TEST-08 enforcement)
- [ ] Service-role getter in `e2e/helpers/auth.ts` — see §5; existing file edit (prerequisite for TEST-09 fixture)
- [ ] Existing test infra (Playwright + ESLint + CI) is already in place — no framework install needed.

---

## Project Constraints (from CLAUDE.md)

- **Budget $0/mo:** every Phase 8 task uses tooling already in `package.json` — no new deps, no paid services.
- **GSD workflow enforcement:** all file edits go through a GSD command. The planner produces PLAN.md files under `.planning/phases/08-e2e-test-hygiene/`; no direct repo edits outside that flow.
- **No review-round archaeology in source comments** (`feedback_no_review_archaeology_in_source.md`): every WHY comment in the new fixture, README, and patched specs cites the WHY (e.g., "DOM-scoped — already inside fixture-card boundary") and NEVER the plan/round/PR ID. Plan refs go in commit messages and PR descriptions only.
- **Tech stack lock:** Vite + React 19 + TypeScript + Playwright + ESLint flat config — Phase 8 stays inside this perimeter; no framework changes.

---

## Recommendations to the Planner

1. **First plan task = service-role client getter in `e2e/helpers/auth.ts`** (§5 code). This is the prerequisite for the freshPoll fixture; without it the fixture can't be implemented. Trivial change, isolated, can be reviewed in 60 seconds.

2. **Second plan task = freshPoll fixture in `e2e/fixtures/poll-fixture.ts`** (§6 code). Depends on task 1. Verify cascade behavior with a one-off `psql` script as part of the verification step (DELETE returns 1 row affected; pre/post `select count(*) from votes/choices/vote_counts where poll_id = ...` shows 0 children remain).

3. **Third plan task = ESLint rule + e2e/README.md** (§3 + §9). Order: rule first (will FAIL on the 3 unmigrated specs — that's expected), then README, then spec migrations to make the rule pass. Or land the rule LAST after spec migrations land — planner's call. Recommendation: rule **first** (with a TODO/skip-list if needed) so the spec-migration tasks are guaranteed to clear it.

4. **Fourth plan task = spec migrations** (§2a/2b/2c). Order doesn't matter; can be a single commit or three. browse-respond is the most invasive (changes import line, replaces locator construction, adds 2 eslint-disables, retightens regex).

5. **Fifth plan task = TEST-10 runbook + 03-UAT.md append** (§8). Pure docs; can run in parallel with any other task. Per D-11, this lands the artifact NOW; the second-human evidence appears asynchronously when a tester is available.

6. **Do NOT propose:** DB CHECK constraint on `polls.title` for `[E2E]` prefix (deferred per D-09); worker-scoped fixture (rejected per D-09); deleting `e2e/fixtures/seed.sql` static rows (deferred per D-09); cleanup of PROD `[E2E] Test:` polls (separate task, not Phase 8).

7. **Anchor verification command for the planner's `must_haves`:** `npm run lint && supabase start && PGOPTIONS='-c app.e2e_seed_allowed=true' psql "$DB_URL" -f e2e/fixtures/seed.sql && npx playwright test --config e2e/playwright.config.ts --grep @smoke`. If this is green on CI, all four success criteria from ROADMAP § Phase 8 are satisfied (with TEST-10's #4 having an async-evidence carve-out per D-11).

---

## Assumptions Log

> Empty — every claim above is grounded in a file:line citation, gh CLI fetch,
> or AST trace. No `[ASSUMED]` tags were needed.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | — | — | — |

---

## Open Questions

None genuinely unresolved. All 10 numbered questions in the research scope are answered with file:line evidence, AST traces, or GH issue confirmation. CONTEXT.md L119's claim that `e2e/helpers/auth.ts` "already mints a service-role client" is empirically false (§5) — the planner should treat the service-role getter as a NEW addition, not a re-export.

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/00000000000000_schema.sql` L28-132 — FK definitions, polls/choices/votes/vote_counts table shape
- `e2e/helpers/auth.ts` L26-103 — anon-key-only client; service-role NOT used
- `e2e/tests/{admin-create,browse-respond,filter-search,auth-errors}.spec.ts` — all four spec files inspected line-by-line
- `e2e/fixtures/seed.sql` L122-149 — fixture poll titles; no `[E2E] {test} {ms}` collision
- `eslint.config.js` L1-38 — flat-config shape, ESLint 9.39.4 runtime
- `package.json` L11, L36, L48 — `lint` script, `@playwright/test 1.59.1`, `eslint 9.39.4`
- `.github/workflows/ci.yml` L23-170 — full lint+e2e pipeline
- `.planning/phases/03-response-integrity/03-UAT.md` L19-27 — Tests 2/3 skipped records (preservation target)
- `gh issue view 11/12/13` — GitHub CLI fetched all three issue bodies

### Secondary (MEDIUM confidence)
- `.planning/research/v1.1-PLAYWRIGHT-FIXTURES.md` — upstream technical research (LOCKED per CONTEXT)
- `.planning/phases/08-e2e-test-hygiene/08-CONTEXT.md` — D-01 through D-13 (LOCKED user decisions)
- ESLint `no-restricted-syntax` `:has(...)` selector behavior — established ESLint API; `:has()` requires v8.40+ which 9.39.4 satisfies

### Tertiary (LOW confidence)
- (none — all critical claims verified at HIGH)

---

## Metadata

**Confidence breakdown:**
- FK cascade: HIGH — direct schema.sql citation
- Spec diagnosis: HIGH — direct file:line inspection
- AST selector: HIGH — manual trace through Playwright API call patterns
- Service-role wiring: HIGH — `auth.ts` source contradicts CONTEXT bullet
- Fixture skeleton: HIGH — column requirements verified against schema.sql + RPC patterns
- CI integration: HIGH — full ci.yml inspected
- TEST-10 template: MEDIUM — template structure is a recommendation, not a verifiable fact

**Research date:** 2026-05-02
**Valid until:** 2026-06-01 (stable test/lint stack; CI workflow rarely churns)

## RESEARCH COMPLETE
