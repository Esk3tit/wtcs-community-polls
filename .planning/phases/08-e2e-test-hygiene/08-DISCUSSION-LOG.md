# Phase 8: E2E Test Hygiene - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 08-e2e-test-hygiene
**Areas discussed:** freshPoll consumer & fixture proof, ESLint rule scope & escape-hatch policy, e2e/README.md scope, TEST-10 second-human coordination plan

---

## freshPoll consumer & fixture proof

### Q1: Which spec consumes freshPoll as proof of contract?

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate browse-respond | Natural fit — issue #12 is "no votes in seed → assertion fails." Spec doubles as fixture-contract proof. | ✓ |
| New dedicated demo spec | e2e/tests/fresh-poll.spec.ts — cleanest separation; +1 spec to CI runtime. | |
| Migrate browse-respond AND filter-search | Both move to fixture; broader proof, larger refactor. | |
| Migrate filter-search only | Removes SMOKE-token coupling; browse-respond stays on [E2E]-filter. | |

**User's choice:** Migrate browse-respond (Recommended).

### Q2: Where does the admin (service-role) Supabase client live?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse / re-export from e2e/helpers/auth.ts | One env-var path, one auth surface. | ✓ |
| New e2e/helpers/admin-client.ts | Discrete helper file, single responsibility. | |
| Co-locate in e2e/fixtures/poll-fixture.ts | Fewer files; tighter coupling; risks drift from auth.ts. | |

**User's choice:** Reuse / re-export from e2e/helpers/auth.ts (Recommended).

### Q3: Fixture state shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal {id, title} | Match research sketch verbatim; lean. | ✓ |
| Rich {id, title, choiceIds, categoryId} | Specs target choices by id; more setup logic. | |
| Factory function freshPoll({ withVote?, choices? }) | Most flexible; departs from standard fixture-of-values pattern. | |

**User's choice:** Minimal {id, title} (Recommended).

### Q4: Cleanup behavior on failure?

| Option | Description | Selected |
|--------|-------------|----------|
| Single delete, rethrow on failure | Honest signal; researcher confirms cascade behavior. | ✓ |
| Cascade-aware: delete votes/choices first, then poll | Defensive; tolerant of schema gaps. | |
| Best-effort with console warn | Tolerant of CI flake; risks silent leakage. | |

**User's choice:** Single delete, rethrow on failure (Recommended).

---

## ESLint rule scope & escape-hatch policy

### Q1: Which list-locator method names does the rule cover?

| Option | Description | Selected |
|--------|-------------|----------|
| Roadmap + research union: toHaveCount, first, nth, all, last | Maximum prevention, single rule. | ✓ |
| Roadmap-only: all, nth, first | Strict roadmap success criterion #2 wording. | |
| Research-only: toHaveCount, first, nth | Verbatim research file selector. | |

**User's choice:** Roadmap + research union (Recommended).

### Q2: Escape-hatch policy?

| Option | Description | Selected |
|--------|-------------|----------|
| Allow eslint-disable WITH required justification comment | Pragmatic; PR review enforces comment quality. | ✓ |
| Strict no escape-hatch | Forces .filter() on every flagged call. | |
| Allow eslint-disable with no justification | Most permissive; rule erosion risk. | |

**User's choice:** Allow eslint-disable-next-line with required justification (Recommended).

### Q3: Filter regex strictness in the AST selector?

| Option | Description | Selected |
|--------|-------------|----------|
| Any preceding .filter() satisfies | Simple, resilient; regex correctness via doc + review. | ✓ |
| Require literal .filter({ hasText: /^\[E2E/ }) | Stricter; brittle to formatting. | |

**User's choice:** Any preceding .filter() satisfies (Recommended).

### Q4: File glob for the rule?

| Option | Description | Selected |
|--------|-------------|----------|
| e2e/tests/**/*.spec.ts | Matches ROADMAP success criterion #2 verbatim. | ✓ |
| e2e/tests/**/*.ts | Matches research file pattern; non-spec files unaffected today. | |
| e2e/**/*.ts | Broadest — also covers helpers and fixtures. | |

**User's choice:** e2e/tests/**/*.spec.ts (Recommended).

---

## e2e/README.md scope

### Q1: Overall scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Targeted: rule + freshPoll + run-locally | ~60-100 lines; practical onboarding. | ✓ |
| Minimal: rule only | ~15-25 lines; bare-minimum doc. | |
| Comprehensive E2E onboarding | ~200+ lines; big writing task. | |

**User's choice:** Targeted (Recommended).

### Q2: Optional sections to include (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| freshPoll fixture usage example | Code snippet + when to use. | ✓ |
| Two-layer seed explainer | One paragraph on base + additive seeds. | ✓ |
| How to run E2E locally | Commands + headed/single-spec debug tips. | ✓ |
| Common gotchas list | Top 3-5 footguns. | ✓ |

**User's choice:** All four optional sections.

**Notes:** User asked "What does this mean" on the first phrasing of Q2; clarified that the question lists CANDIDATE optional sections beyond the locked rule + rationale + research pointer, then re-asked. User then picked all four.

---

## TEST-10 second-human coordination plan

### Q1: How does TEST-10 fit Phase 8 execution?

| Option | Description | Selected |
|--------|-------------|----------|
| Draft script + evidence template now; user runs whenever | Phase 8 ships the artifact; evidence appears later. | ✓ |
| Draft script + schedule a session inside this phase plan | Phase 8 verification blocks on the second-human session. | |
| Pure async — just append evidence later | No script, no template; lightest planning overhead. | |

**User's choice:** Draft script + evidence template now (Recommended).

### Q2: Evidence format in 03-UAT.md?

| Option | Description | Selected |
|--------|-------------|----------|
| New '## Second-Human Verification' section, per-test sub-blocks | Preserves original "skipped + reason" history. | ✓ |
| Flip existing key/value block in place | Loses original "why skipped" provenance. | |
| Free-form paragraph per test | Readable, less greppable. | |

**User's choice:** New '## Second-Human Verification' section (Recommended).

### Q3: Where does the runbook script live?

| Option | Description | Selected |
|--------|-------------|----------|
| .planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md | Phase 8 owns the artifact; Phase 03 directory untouched. | ✓ |
| .planning/phases/03-response-integrity/03-UAT-RUNBOOK.md | Locality for the reader of 03-UAT.md; pollutes a complete phase dir. | |
| Inline at top of 03-UAT.md | Conflates run-book with evidence record. | |

**User's choice:** .planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md (Recommended).

---

## Claude's Discretion

- Compliance check on `e2e/tests/auth-errors.spec.ts` (the 4th existing spec) — verify it doesn't trip the new ESLint rule; if it does, choose between `.filter()` or eslint-disable based on locator type.
- Vote-count regex update in `browse-respond.spec.ts` from `/\d+\s+total response/i` to `/[1-9]\d*\s+total response/i` per ROADMAP success criterion #1.
- Exact AST selector wording — research-suggested vs slightly tightened — planner's call. Constraint: zero false positives on landing.
- README writing tone — match `.planning/` doc style.
- Whether `e2e/fixtures/seed.sql` is touched at all in Phase 8 (research's open question #3 says "yes, after fixture migration matures" — defer here).
- Truncation/sanitization of `testInfo.title` for DB-safe length when used in the fixture title.
- Placement of the new flat-config block in `eslint.config.js` (top vs bottom of array).

## Deferred Ideas

- DB CHECK constraint on `polls.is_test` — schema churn; revisit if a third drift bug appears.
- Worker-scoped freshPoll fixture — REJECTED; defeats per-test isolation.
- Move all mutable poll rows out of `e2e/fixtures/seed.sql` — wait until fixture pattern is empirically stable.
- Cleanup of 7 leftover `[E2E] Test:` polls in PROD admin list — separate cleanup task per v1.0 milestone audit.
- Full Playwright fixtures migration — explicitly out of v1.1 scope.
- Sentry React SDK v10 → v11+ upgrade — out of v1.1 scope.
