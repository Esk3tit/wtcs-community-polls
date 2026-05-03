---
status: partial
phase: 08-e2e-test-hygiene
source: [08-VERIFICATION.md]
started: 2026-05-02T23:00:00Z
updated: 2026-05-02T23:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Run full Playwright smoke suite against canonical two-layer seed and verify zero fixture leak (Plan 08-03 Task 4 checkpoint)
expected: |
  - `npx playwright test --config e2e/playwright.config.ts --grep @smoke` exits 0; 4 specs / 4 passed
  - Local Supabase stack is up (`supabase start` + `e2e/fixtures/seed.sql` applied)
  - Leak check SQL returns 0:
    ```sql
    select count(*) from polls
    where description = 'freshPoll fixture row'
      and created_at > now() - interval '5 minutes';
    ```
  - Push branch `gsd/phase-08-e2e-test-hygiene`; CI Playwright `e2e` job goes green
  - Reply `approved <CI_RUN_URL>` once both local and CI pass
result: [pending]

### 2. Second-human Phase 03 UAT Tests 2 + 3 (Non-Member Login Rejection, Error Page Invite Link)
expected: |
  - Recruit a qualified tester: 2FA-enabled Discord account, NOT a WTCS server member, NOT the original executor
  - Tester follows `.planning/phases/08-e2e-test-hygiene/08-UAT-10-SCRIPT.md` step-by-step
  - Tester pastes filled evidence under `## Second-Human Verification` in `.planning/phases/03-response-integrity/03-UAT.md`
  - Both Test 2 and Test 3 result: pass
  - Per D-11, this runs asynchronously and does NOT block Phase 8 closure — current placeholder template is the Phase 8 synchronous deliverable
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
