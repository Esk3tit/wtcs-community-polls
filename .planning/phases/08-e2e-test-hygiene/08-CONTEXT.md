# Phase 8: E2E Test Hygiene - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The Playwright E2E suite is honest under the canonical two-layer seed (base `supabase/seed.sql` + additive `e2e/fixtures/seed.sql`). Every shared-DB list locator is `[E2E]`-scoped, the convention is lint-enforced, per-test mutable poll/vote state lives in a Playwright test-scoped fixture, and the two second-human-gated Phase 03 UAT cases (Non-Member Login Rejection + Error Page Invite Link) have evidence on file.

**In scope:**
- Apply the `[E2E]`-filter convention to the three currently-failing specs: `admin-create.spec.ts`, `browse-respond.spec.ts`, `filter-search.spec.ts` (TEST-07).
- Update `browse-respond.spec.ts` to assert `[1-9]\d*\s+total response` after casting an in-test vote (TEST-07, ROADMAP success criterion #1).
- Append an ESLint `no-restricted-syntax` rule to `eslint.config.js` that fails the build on un-filtered list locators in `e2e/tests/**/*.spec.ts` (TEST-08).
- Create `e2e/README.md` documenting the rule, freshPoll fixture, two-layer seed, run-locally instructions, and common gotchas (TEST-08).
- Create the `freshPoll` Playwright test-scoped fixture in `e2e/fixtures/poll-fixture.ts`; migrate `browse-respond.spec.ts` to consume it as proof of contract (TEST-09).
- Produce a second-human runbook + evidence-append template; append evidence to `.planning/phases/03-response-integrity/03-UAT.md` whenever the second-human session is run (TEST-10).

**Out of scope:**
- Replacing `Sentry.ErrorBoundary`, modifying `Sentry.init`, or any other observability work (Phase 7 territory).
- DB CHECK constraint enforcing `[E2E]` prefix at the schema level (deferred — adds schema churn).
- Worker-scoped `freshPoll` (defeats the purpose — cross-test contamination risk).
- Moving ALL mutable poll rows out of `e2e/fixtures/seed.sql` (deferred until fixture pattern matures).
- Cleanup of 7 leftover `[E2E] Test:` polls in PROD admin list (separate task per v1.0 milestone audit).
- Full Playwright fixture migration replacing all SQL seeds (explicitly out of scope per v1.1 REQUIREMENTS).
- New product features, LHCI, Sentry React SDK upgrade.

</domain>

<decisions>
## Implementation Decisions

### freshPoll consumer & fixture proof (TEST-09)
- **D-01:** `e2e/tests/browse-respond.spec.ts` is the proof-of-contract consumer of the new fixture. It is the natural fit because issue #12 — the only non-isolation bug class — is "no votes in seed → assertion fails." The fresh poll inserted by the fixture is unambiguously vote-able by the test, eliminating the `[E2E]`-filter trick for this spec while still satisfying TEST-07's vote-precondition + `[1-9]\d*` assertion.
- **D-02:** The service-role admin client used by the fixture is **re-exported from `e2e/helpers/auth.ts`** (or factored into a thin getter colocated there). One client, one env-var path, one place to maintain — `auth.ts` already mints a service-role client for `loginAs()`. The fixture file imports the same client; no duplicate wiring.
- **D-03:** The fixture exposes the **minimal** value shape — `freshPoll: { id: string; title: string }`. Title is auto-tagged `[E2E] {testInfo.title} {Date.now()}`. Specs locate the card by title text. Richer shapes (choice IDs, category ID) are deferred until a second consumer demands them.
- **D-04:** Cleanup is a single `adminClient.from('polls').delete().eq('id', data.id)` after `await use(...)`. **Rethrow on failure** — no try/swallow. Researcher confirms whether existing migrations cascade-delete `votes` (and any choices table) on poll delete; if cascade is missing, the planner adds the multi-step teardown without re-asking the user.

### ESLint rule scope & escape-hatch (TEST-08)
- **D-05:** The `no-restricted-syntax` selector matches calls to `.toHaveCount`, `.first`, `.nth`, `.all`, `.last` (regex `/^(toHaveCount|first|nth|all|last)$/`). Covers the roadmap's explicit list (`.all/.nth/.first`) and the research-suggested counters (`toHaveCount`, `last`) in one rule.
- **D-06:** `eslint-disable-next-line no-restricted-syntax` is **permitted with a required one-line WHY justification comment** immediately above the disable. PR review enforces comment quality. Legitimate non-shared-DB usages (DOM-scoped `getByRole({...}).first()` inside an already-scoped `firstCard`) take the escape-hatch; shared-DB list usages must use `.filter({ hasText: /^\[E2E/ })`.
- **D-07:** The AST selector checks for **any** preceding `.filter()` call — it does NOT require the literal `/^\[E2E/` regex. AST regex matching is brittle to formatting; the regex correctness is enforced by `e2e/README.md` documentation and PR review.
- **D-08:** The rule's flat-config block scopes to `e2e/tests/**/*.spec.ts` — matches ROADMAP success criterion #2 verbatim. Helpers, fixtures, and `playwright.config.ts` are NOT subject to the rule.

### e2e/README.md scope (TEST-08)
- **D-09:** README is targeted (~80–150 lines). **Locked content:** E2E-SCOPE-1 rule statement + rationale ("two-layer seed makes un-filtered list assertions drift") + pointer to `.planning/research/v1.1-PLAYWRIGHT-FIXTURES.md`.
- **D-10:** All four optional sections are included:
  1. **freshPoll fixture usage** — short code snippet importing the fixture, when to reach for it vs the `[E2E]`-filter convention.
  2. **Two-layer seed explainer** — one paragraph on base + additive seeds and why naive `.toHaveCount(N)` is broken-by-design.
  3. **How to run E2E locally** — `supabase start` → apply additive seed → `npm run e2e`; plus headed/single-spec debug tips.
  4. **Common gotchas list** — top 3–5 footguns: un-filtered counting, `.first()` on shared DB, missing vote precondition, FK cascade gaps.

### TEST-10 second-human coordination (TEST-10)
- **D-11:** Phase 8 produces the runbook + evidence-append template **now**. The user runs the actual second-human session **asynchronously** when a non-2FA-blocked, non-WTCS-member Discord tester is available. Phase 8 verification does NOT block on TEST-10 evidence being filled in — the artifact (script + template) is the deliverable; evidence appears later.
- **D-12:** Evidence is appended to `.planning/phases/03-response-integrity/03-UAT.md` as a **new `## Second-Human Verification` section** with one sub-block per test. Sub-block fields: executor Discord handle, verified-at (UTC ISO 8601), result (pass/fail), notes (≥1 line each). The original "skipped + burner-account-2FA reason" records remain untouched — preserves history.
- **D-13:** The runbook script lives at `.planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md`. Phase 8 owns the artifact; Phase 03's directory stays untouched (it is already complete).

### Claude's Discretion
- Verify `e2e/tests/auth-errors.spec.ts` (the 4th existing spec) does not trip the new ESLint rule. If it does, choose between adding `.filter({ hasText: /^\[E2E/ })` (if shared-DB) or applying the eslint-disable escape-hatch with justification (if DOM-scoped) — no user re-ask required.
- Vote-count assertion in `browse-respond.spec.ts` updates from `/\d+\s+total response/i` to `/[1-9]\d*\s+total response/i` per ROADMAP success criterion #1 (rules out the zero-vote case).
- Exact AST selector wording — research-suggested form vs a marginally tightened variant — is the planner's call. Constraint: zero false positives across the four existing specs at landing time.
- `e2e/README.md` writing style — match the direct, concise tone of `.planning/` docs. No exclamations, no marketing voice.
- The freshPoll fixture's `testInfo.title` is the canonical per-test slug source; the planner picks whether to truncate/sanitize for DB-safe length.
- Exact placement of the new flat-config block in `eslint.config.js` (top of array vs bottom) — planner's call; pick whichever reads more naturally with surrounding blocks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements (locked)
- `.planning/ROADMAP.md` § Phase 8: E2E Test Hygiene — goal, dependencies, requirements list, 4 success criteria.
- `.planning/REQUIREMENTS.md` § Testing — TEST-07, TEST-08, TEST-09, TEST-10 verbatim text + GitHub-issue cross-refs (#11, #12, #13).

### Research (locked technical approach)
- `.planning/research/v1.1-PLAYWRIGHT-FIXTURES.md` — TL;DR, E2E-SCOPE-1 convention, ESLint snippet, freshPoll fixture sketch, hybrid-seed rationale, open questions.

### Project decisions that carry forward
- `CLAUDE.md` § Project — $0/mo budget; Vite + React 19 + TypeScript + Playwright stack.
- `.planning/PROJECT.md` § Constraints — $0/mo Supabase + Netlify + Upstash free tier; Discord-native admin model.
- `.planning/PROJECT.md` § Key Decisions — Discord OAuth + 2FA fail-closed; @smoke tag pattern.
- `.planning/phases/05-launch-hardening/05-CONTEXT.md` § E2E Smoke Tests (TEST-06) — D-04 (Playwright chosen), D-05 (session-injection auth bypass), D-07 (canonical two-layer seed flow), D-08 (four critical user journeys).

### Phase 03 UAT to augment (TEST-10)
- `.planning/phases/03-response-integrity/03-UAT.md` § Tests 2 + 3 — current "skipped" records with burner-account 2FA reason; the file Phase 8 appends a Second-Human Verification section to.

### Files to modify (all paths relative to repo root)
- `e2e/tests/admin-create.spec.ts` — add `.filter({ hasText: /^\[E2E/ })` on the suggestion-list count assertion (TEST-07, issue #11).
- `e2e/tests/browse-respond.spec.ts` — migrate to consume freshPoll fixture; tighten vote-count regex to `/[1-9]\d*\s+total response/i` (TEST-07, TEST-09, issue #12).
- `e2e/tests/filter-search.spec.ts` — apply `[E2E]`-filter to shared-DB list assertions; current SMOKE-token search may stay or move to fresh-poll-titled token at planner's choice (TEST-07, issue #13).
- `e2e/tests/auth-errors.spec.ts` — compliance check; rule-adjustment only if it trips (Claude's Discretion).
- `e2e/helpers/auth.ts` — re-export the service-role admin client (or factor into a thin getter the fixture imports).
- `eslint.config.js` — append the `no-restricted-syntax` flat-config block (TEST-08).

### Files to create
- `e2e/fixtures/poll-fixture.ts` — `freshPoll` test-scoped fixture (TEST-09).
- `e2e/README.md` — convention + freshPoll usage + seed explainer + run-locally + gotchas (TEST-08).
- `.planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md` — second-human runbook (TEST-10 D-13).

### Read-only awareness
- `e2e/playwright.config.ts` — testDir, baseURL, projects (no change needed; freshPoll is a test.extend layer).
- `e2e/fixtures/seed.sql` — additive seed (categories + auth users + base mutable rows). Not modified in Phase 8.
- `e2e/fixtures/test-users.ts` — `fixtureUsers` map; the freshPoll fixture title-tags use these handles indirectly via `testInfo.title`.
- `supabase/seed.sql` — base seed; reference for understanding the two-layer architecture.
- `.github/workflows/ci.yml` — runs `eslint .` + `npm run e2e`; the new lint rule activates automatically when `eslint.config.js` is updated.
- `package.json` — `lint`, `e2e` scripts; no new scripts needed.

### User feedback / writing constraints
- `.../.claude/.../memory/feedback_no_review_archaeology_in_source.md` — source comments WHY-only; never cite plan/round/phase IDs in code (rot tags). Plan refs belong in PR/commit messages, not in `src/` or `e2e/`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`e2e/helpers/auth.ts`** — already mints a service-role Supabase client for session-injection (`loginAs(page, userId)`). The freshPoll fixture imports the same client; no new env-var wiring.
- **`e2e/fixtures/test-users.ts`** — `fixtureUsers.memberUser` / `.adminUser` / `.notMemberUser` / `.no2faUser` already exist with stable Discord IDs. Specs continue to use these for auth setup.
- **`e2e/fixtures/seed.sql`** — additive (`d0000000-*` polls, 4 rows). Stays as-is in Phase 8 — moving mutable rows out is a research-deferred follow-up.
- **`eslint.config.js`** — flat-config `defineConfig([...])` pattern with per-glob overrides already in place. The new `no-restricted-syntax` block appends a fifth array element scoped to `e2e/tests/**/*.spec.ts`.
- **`e2e/playwright.config.ts`** — already configured (testDir, baseURL, projects). No structural change needed; the freshPoll fixture is a `test.extend` layer that specs import in place of `@playwright/test`.

### Established Patterns
- **`[@smoke]` test-name prefix** — all four existing specs use it; new/migrated specs continue the pattern.
- **`data-testid="suggestion-card"`** + **`data-testid="choice-button"`** + **`role="meter"` on result bars** — the canonical selector vocabulary (Phase 5 D-08 / 05-04 M7). New code uses these, not custom selectors.
- **`[E2E]`-prefixed titles for E2E-managed polls** — convention applies to BOTH the existing additive-seed rows AND new freshPoll-inserted rows. The lint rule checks for `.filter()` presence; the regex correctness is convention.
- **Two-layer seed flow** — base (`supabase/seed.sql`, idempotent `ON CONFLICT`) + additive (`e2e/fixtures/seed.sql`, applied via `psql`). CI does both in `.github/workflows/ci.yml` per Phase 5 M4.
- **Test-scoped fixture cleanup pattern** — `await use(value); await cleanup()` — Playwright's canonical fixture-of-values shape. Worker-scoped is rejected (research open question #2).

### Integration Points
- **CI lint job** — `.github/workflows/ci.yml` runs `eslint .` (or `npm run lint`); the new rule activates automatically on next CI run after `eslint.config.js` lands.
- **CI e2e job** — runs `supabase start` → applies `e2e/fixtures/seed.sql` via `psql` → `npm run e2e`. The freshPoll fixture's INSERT/DELETE round-trip uses the local stack's service-role key derived at runtime (Phase 5 M5 — never in CI secrets).
- **Local dev workflow** — `npm run e2e` against a local `supabase start` stack. The freshPoll fixture works identically locally and in CI; no env-conditional code paths.
- **Phase 03 UAT.md append** — pure documentation edit; no code paths affected. The runbook script is read-only Markdown.

</code_context>

<specifics>
## Specific Ideas

- **Vote-count regex tightening:** `/[1-9]\d*\s+total response/i` (per ROADMAP success criterion #1). The leading `[1-9]\d*` rules out the zero-vote case where the assertion would otherwise pass against a card with no votes.
- **Fixture title format:** `[E2E] {testInfo.title} {Date.now()}` (verbatim from research sketch). The `[E2E]` prefix means the fixture-managed poll is automatically compatible with the `.filter({ hasText: /^\[E2E/ })` convention even if a future spec accidentally counts un-filtered.
- **Source-comment discipline:** every new comment in `e2e/`, `eslint.config.js`, and the fixture file is WHY-only. No "Round-3 amendment", no "per CR-PR4", no "added for issue #12" — those refs live in commit messages, PR descriptions, and `.planning/`. Reaffirms `feedback_no_review_archaeology_in_source.md`.
- **README writing tone:** direct, concise; match `.planning/` doc style (no exclamation marks, no marketing voice, no hedging).
- **Runbook tone (08-UAT-10-SCRIPT.md):** stepwise + copy-pasteable. Tester reads it from top to bottom, performs each step verbatim, fills in the evidence template at the bottom and pastes the result into 03-UAT.md.
- **Two layers of defense:** the freshPoll fixture's `[E2E]`-tagged title means even a future un-filtered list assertion against fixture-inserted polls remains compatible with the convention. The lint rule + the convention are belt-and-suspenders, not redundant.

</specifics>

<deferred>
## Deferred Ideas

- **DB CHECK constraint on `polls.is_test`** to make `[E2E]` machine-enforceable at the schema level (research open question #1) — schema churn cost outweighs benefit at v1.1; revisit if a third-class drift bug appears.
- **Worker-scoped `freshPoll` fixture** to amortize INSERT cost across tests in a worker (research open question #2) — explicitly REJECTED. Cross-test contamination defeats the per-test-isolation goal.
- **Move ALL mutable poll rows out of `e2e/fixtures/seed.sql`** leaving only categories + auth users (research open question #3) — wait until the fixture pattern has migrated 2+ specs and is empirically stable.
- **Cleanup of 7 leftover `[E2E] Test:` polls in PROD admin list** (per `.planning/milestones/v1.0-MILESTONE-AUDIT.md` line 105) — separate cleanup task; not Phase 8 scope.
- **Full Playwright fixtures migration replacing all SQL seeds** — explicitly deferred per `.planning/REQUIREMENTS.md` "Future Requirements" + "Out of Scope" tables.
- **Sentry React SDK v10 → v11+ upgrade** — out of v1.1 scope; v10 is fine at ship.

None of the above belongs in Phase 8.

</deferred>

---

*Phase: 08-e2e-test-hygiene*
*Context gathered: 2026-05-02*
