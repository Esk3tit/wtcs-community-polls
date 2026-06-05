# Requirements — v1.4 Final Closeout

**Defined:** 2026-05-31
**Core Value:** Community members can share opinions on competitive scene proposals with confidence that results are authentic — one verified Discord account, one response, no manipulation.

This document tracks the v1.4 milestone requirements. After v1.0 (43 of 45 reqs), v1.1 (11 of 11 reqs), v1.2 (13 of 14 reqs), and v1.3 (23 of 23 reqs) shipped — archived under `milestones/v1.{0,1,2,3}-REQUIREMENTS.md` — **v1.4 is the debt-zero closeout milestone.** It finishes *every* outstanding v1 carry-forward so nothing carries past this milestone.

**Debt-zero mandate (operator directive — "one and done, finish everything before it"):** Unlike v1.1/v1.3, a `tech_debt` or DEFER verdict is **not** an acceptable exit for v1.4. Every requirement below must reach **Validated**. The milestone audit must close at `passed`, not `tech_debt`.

**Scope-completeness sweep (2026-05-31):** Before defining these requirements, a sweep confirmed the canonical carry-forward list is exhaustive — zero open GitHub issues, zero skipped/`.todo` tests, no `v1.4`/`v1.5` markers in source or planning beyond the known TEST-11 deferral. Two net-new stragglers surfaced (the `create-poll-results-hidden.test.ts` fault-injection gap and dependabot PRs #40/#34); both are folded in below.

**Operator closure decisions (locked at scoping):**
- **Environment items = REAL repair**, not alternative-validation substitutes. The local test harnesses must actually run green (upgrade/config fix), not be documented won't-fix with proxy coverage.
- **Human UAT items = satisfied by pre-existing live operator runs**, accepted this milestone per D-01/D-02 (UAT-01 executed live 2026-05-03; UAT-02 executed live during the v1.0→v1.1 transition). No fresh runs were performed this milestone — the operator-locked "executed live with real accounts; not E2E-mocked" intent is met by those existing runs. Plans reconcile that evidence and record concrete acceptance-basis targets.

## v1.4 Requirements

### Test / CI Environment Repair (TEST-*)

Continues from v1.3's TEST-16. These repair the two local test harnesses that prior milestones could not run, plus close a deferred test-completeness gap.

- [x] **TEST-17**: Local supabase-edge-runtime upgraded/pinned past the 1.73.x ES256 JWT-verification bug so `npm run test:integration` runs green locally and in CI — no skips, no xfail. The specific edge-runtime version that resolves ES256 verification is identified during plan-phase research and pinned in the local Supabase config. Closes the "Local ES256 verification bug" carry-forward.

- [x] **TEST-18**: Local gotrue `email_provider_disabled` configuration fixed so the **TEST-11** 12-cell RLS invariant vitest matrix executes green (12 PASS / 0 FAIL) locally and in CI. This supersedes the v1.3 SQL-regression-fixture stopgap for `is_current_user_admin()` by restoring the full matrix as the primary evidence. Closes the "TEST-11 12-cell vitest run" carry-forward.

- [x] **TEST-19**: The deferred manual fault-injection coverage in `e2e/integration/create-poll-results-hidden.test.ts` (line ~156 — post-RPC `UPDATE` failure path) is implemented and green, exercising the documented failure branch rather than leaving it as a comment-only deferral.

### Live Human UAT (UAT-*)

The two second-human-gated UAT items deferred since v1.0/v1.1. Both were executed live by the operator with the required real accounts BEFORE this milestone (UAT-01: 2026-05-03; UAT-02: v1.0→v1.1 transition); v1.4 accepts that pre-existing live evidence as satisfying the requirement (D-01/D-02) — no fresh run was performed this milestone.

- [x] **UAT-01**: Phase 03 UAT tests 2 + 3 executed live with a 2FA-on, non-WTCS-member Discord account (2FA must be ON so the gate clears and the non-member check fires). Evidence — non-member is correctly blocked at the server-side membership gate (enforced client-side via the OAuth guild check before the profile RPC; server-side RLS is a defense-in-depth backstop — same membership-enforcement outcome) — recorded in the Phase 03 UAT record. Closes the "Phase 03 UAT tests 2+3" carry-forward. — Closed Phase 20 (2026-06-04) by accepting the pre-existing 2026-05-03 second-human PASS (no fresh run); gate path verified unchanged (see 03-UAT.md § UAT-01 Acceptance Basis, D-01/D-03).

- [x] **UAT-02**: Phase 04 UAT test 6a (demote-click flow) executed live with a second admin account. Evidence — demote action succeeds with the self-guard intact — recorded in the Phase 04 UAT record. Closes the "Phase 04 UAT 6a backfill" carry-forward. — Closed Phase 20 (2026-06-04) by backfilling the pre-existing Off-Record Verification PASS (MapCommittee, v1.0→v1.1 transition; no fresh run; see 04-UAT.md § UAT-02 Phase 20 Closure, D-02).

### Security / DB Hardening (DBHY-*)

Continues from v1.3's DBHY-04 (Migration 14 family).

- [x] **DBHY-05**: The undistinguishing `profile_self_update_allowed` `current_user = session_user` gate is replaced via a new migration. Because the function runs inside a `SECURITY DEFINER` trigger, `current_user` always resolves to the function owner, so the gate cannot distinguish direct client `UPDATE`s from RPC-mediated ones. Implement STATE.md **Option b**: `update_profile_after_auth` sets an explicit trusted-context flag (session GUC) and `profile_self_update_allowed` checks that flag instead. The protected-column branch is proven reachable and correct via a regression test (not left as suspected dead code). Closes the PR #30 finding carry-forward.

### UI & Design / Accessibility (UIDN-*)

Continues from v1.3's UIDN-05.

- [x] **UIDN-06**: The two `<h2>` section headings demoted to non-semantic `CardTitle` `<div>`s during the Phase 17 UIDN-04/05 Card migration (`AdminsList` / `CategoriesList`; 17-REVIEW.md WR-01) are restored to semantic heading elements without regressing the shadcn `<Card>` structure. Heading hierarchy verified via an accessibility assertion (role/axe). Closes the "Phase 17 accessibility follow-up" carry-forward.

### Dependency Hygiene (DEP-*)

New category. The two open dependabot PRs surfaced by the completeness sweep — closing the door on lingering dependency-update debt for the final v1 milestone.

- [ ] **DEP-01**: Dependabot PR #40 (minor-and-patch group, 15 updates) reviewed, CI-green (lint + typecheck + unit + E2E), and merged — or superseded by an equivalent up-to-date bump. No regressions in the build pipeline.

- [ ] **DEP-02**: Dependabot PR #34 (lint-staged 16 → 17) reviewed against the v17 breaking-change notes, the `lint-staged` config validated/updated for v17, CI-green, and merged.

## v2 Requirements (deferred — NOT in v1.4)

Explicitly out of v1.4 scope per operator directive ("excluding V2 product features"). Tracked for a future v2 milestone.

### Notifications

- **NOTF-01**: Discord webhook notification when a suggestion goes live
- **NOTF-02**: Discord webhook notification when a suggestion closes

### Analytics

- **ANLT-01**: Admin analytics dashboard — engagement/response metrics
- **ANLT-02**: Admin analytics dashboard — per-suggestion drill-down

### Abuse Prevention

- **ABSE-01**: Cloudflare Turnstile CAPTCHA for suspicious response patterns

### Superseded

- **VERF-01**: WT Discord server membership verification for respondents — already shipped as AUTH-03 (v1.0); mark superseded if a v2 milestone begins.

## Out of Scope

Explicitly excluded for v1.4. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Alternative-validation substitutes for TEST-17/18 | Operator chose REAL environment repair; documenting the harnesses as won't-fix with proxy coverage is explicitly rejected this milestone |
| Automating the human UAT / treating E2E mocking as the evidence | UAT-01/02 are closed on pre-existing LIVE operator runs (D-01/D-02); E2E mocking is not a substitute for that second-human evidence. No fresh live run was performed this milestone — none was required, since accepted live evidence already exists. |
| Any new user-facing product feature | v1.4 is a closeout milestone — no new capabilities (all v2 product features deferred above) |
| Net-new dependency upgrades beyond #40/#34 | Only the two already-open dependabot PRs are in scope; speculative version bumps are not |
| Broad dependency major-version migrations | Out of scope unless required to fix TEST-17/18; otherwise deferred |

(The v1.0–v1.3 product Out-of-Scope exclusions in PROJECT.md — anonymous responses, multiple OAuth providers, ranked-choice, user-created suggestions, comments, WebSockets, email, weighted responses, blockchain, response attribution, account-age check, cross-app admin sync, geo-gating — all remain in force.)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-17 | Phase 18 | Complete |
| TEST-18 | Phase 18 | Complete |
| TEST-19 | Phase 18 | Complete |
| UAT-01 | Phase 20 | Validated |
| UAT-02 | Phase 20 | Validated |
| DBHY-05 | Phase 19 | Complete |
| UIDN-06 | Phase 19 | Complete |
| DEP-01 | Phase 21 | Pending |
| DEP-02 | Phase 21 | Pending |

**Coverage:**
- v1.4 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-31 — v1.4 Final Closeout (debt-zero mandate; all 9 must reach Validated).*
*Last updated: 2026-05-31 — traceability table populated after roadmap creation (Phases 18–21).*
