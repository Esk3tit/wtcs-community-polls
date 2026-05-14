# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Launch-Ready MVP

**Shipped:** 2026-04-28
**Phases:** 6 | **Plans:** 32 | **Tasks:** 41
**Timeline:** 2026-04-06 → 2026-04-28 (22 days, ~3 weeks)
**Code:** 13,602 LOC, 141 .ts/.tsx files, 41 test files, 378/378 unit tests, 47/50 UAT cases

### What Was Built

- Discord-authenticated suggestion platform live at https://polls.wtcsmapban.com
- Discord OAuth with mandatory 2FA enforced server-side via SECURITY DEFINER RPC (fail-closed)
- Discord guild membership verification (OAuth guilds scope) with not-in-server error variant
- Suggestion CRUD with images/timers/categories + lifecycle (auto-close cron + view, manual close, resolution status, archive)
- One-response-per-user enforcement via Edge Function (UNIQUE constraint, 23505→409 mapping) + Upstash sliding-window rate limit (5 req/60s)
- Respond-then-reveal results with 8s HTTP polling (visibilityState-gated) + RLS-enforced respondents-only visibility
- Admin panel: tabbed shell (Suggestions / Categories / Admins) with promote/demote (self-guard) + 14 admin Edge Functions + grep-based RLS preflight
- `polls_effective` lazy-close view + cron-sweep dual-write + CI-locked invariant test against direct `from('polls')` regressions
- Sentry error tracking + sourcemap upload + PostHog analytics (Discord-snowflake-only identify) + GDPR opt-IN consent (default-OFF) + ConsentBanner/Chip with admin-route suppression
- Playwright @smoke E2E suite (4 specs) + GH Actions CI (lint + unit + Supabase + Playwright + audit) + 3-day Supabase keepalive cron + Edge Function deploy workflow + Dependabot

### What Worked

- **Cross-AI plan review** (multiple iterations on Phase 1, Phase 3) caught ambiguities before execution; Round 2 revisions reduced execution churn
- **Decimal-phase reservation** as a concept (even though no decimals used in v1.0) made planning feel safe — urgent insertions weren't catastrophizing
- **Source-analysis tests** for admin EFs (Phase 4) shipped fast without live integration; Phase 5/6 transitively verified the live behavior, so the deferral was strategically correct
- **`polls_effective` lazy-close + invariant test** locked the read boundary at compile-time — caught one near-regression in Phase 5 (CategoriesList allowlist)
- **Diagnose-first auth bug protocol** in Phase 6 (manual repro log + Sentry breadcrumbs + DEV `?debug=auth` overlay) closed a confusing user-reported bug as environmental rather than wasting cycles on a phantom code fix
- **GDPR opt-IN rewire** (Phase 6) was a clean late pivot — initial Phase 5 design was opt-OUT; rewiring through `ConsentContext` + side-effect bridge on `posthog.opt_in/out_capturing()` + window.location.reload() on allow→decline (P-02) shipped without breaking tests
- **Husky chmod recovery** in Phase 6 was a 1-line fix surfaced by audit (chmod -rw on pre-commit/pre-push for the entire milestone) — pure hygiene win
- **Playwright `@smoke` tag + grep filter** kept CI cycle time bounded while letting the spec suite grow

### What Was Inefficient

- **VALIDATION.md frontmatter** on phases 01–04 stayed `status: draft` + `nyquist_compliant: false` for the entire milestone — never refreshed post-execution. The phases shipped working code with 378/378 tests + 47/50 UAT, so the non-compliance was documentation-only, but it forced a backfill candidate into v1.1
- **Phase 03 missing VERIFICATION.md artifact entirely** — work shipped + UAT 4/4 + Phase 05 transitively re-verified deliverables, but the artifact gap is awkward in audit
- **17 SUMMARY frontmatter `requirements-completed` declarations missing** across phases 02 + 03-02 + 04-02/04-04 + 01-04 — required cross-referencing with VERIFICATION.md to confirm coverage during the milestone audit
- **REQUIREMENTS.md status drift** — only 18 of 45 requirements were checked off before Phase 6 D-09 evidence-driven sync; widespread drift was historical, but the mid-milestone correction added Phase 6 scope
- **Sentry React 19 ErrorBoundary capture path silently broken** — Phase 6 D-08 verification needed pivot from render-phase throw to event-handler throw because render-phase throws don't ship via the SDK v10 + React 19 ErrorBoundary integration. Filed as #17, not closed in v1.0
- **Vite/Rolldown sourcemap function-name preservation** — Sentry shows minified `$M` instead of `fireSentrySmoke`; signal quality is reduced for production exception triage. Filed as #19
- **3 Playwright E2E spec bugs filed mid-Phase-5 (#11, #12, #13)** never folded back into the milestone — they're real fixture/seed mismatches that weren't caught during plan review. Carry-forward to v1.1
- **Phase 04 UAT test 6a deferral** (demote click flow) — gated on second admin Discord ID never signing in. Demote logic is source-tested via 13 unit tests, but live two-admin smoke is still pending. Phase 03 UAT tests 2 + 3 (non-member rejection) similarly gated on a second human

### Patterns Established

- **Diagnose-first investigation** for ambiguous user-reported bugs: manual repro log + targeted breadcrumbs + DEV-only debug overlay, before any code change. Closes environmental bugs without wasted cycles
- **Source-analysis tests** as a viable shipping path for Edge Functions: ship handlers with grep-based assertions about their structure, defer live integration to a later phase that exercises them end-to-end
- **CI-locked invariants**: tests that walk source trees (e.g. `polls-effective-invariant.test.ts`) and fail if a regression slips in. Better than runtime checks for boundary discipline
- **Side-effect bridge pattern** in React contexts: `useEffect` deps split between primary auth subscription (deps `[fetchProfile]`) and consent-gated identify (deps `[consentState, user?.id, providerId]`). Avoids consent flips re-running auth subscriptions
- **Decimal-phase numbering** kept in reserve: integer phases for planned work, decimals for urgent insertions. Used 0 times in v1.0 but the reservation made phase planning feel safer
- **Audit verdict taxonomy** (`tech_debt` vs `gaps_found` vs `passed`) — `tech_debt` is a meaningful intermediate state where ship is OK and follow-ups are tracked, distinct from a hard gate failure

### Key Lessons

1. **Refresh validation frontmatter as part of `complete` step, not as separate task.** Phases 01–04 all shipped with `status: draft` + `nyquist_compliant: false`. The work was real, the frontmatter was abandoned. Build the refresh into the phase-completion checklist, not as a separate hygiene pass.
2. **Track GitHub issues against a milestone label/milestone from creation, not retroactively.** v1.0 close discovered 6 OPEN issues, all unmilestoned. Created `v1.1` milestone and assigned all 6 *during* the close — that should have happened at issue-file time.
3. **Render-phase vs event-handler throws behave differently in React 19 ErrorBoundary capture.** Discovered late in Phase 6 D-08 verification. Sentry SDK v10 + React 19 transport breaks render-phase throws silently. Test event-handler errors as the primary capture path; treat render-phase capture as a secondary integration concern.
4. **Source-analysis tests + live transitive verification is a real shipping pattern.** Phase 4 admin EFs shipped with grep-based source assertions; Phase 5 transitively exercised them via UAT and Playwright smoke. Don't gate every phase on full live integration if a downstream phase will provide it.
5. **Consent state changes need page reload to terminate Replay sessions** (no runtime detach API in current SDK v10). `window.location.reload()` on allow→decline is the simplest correct primitive (Phase 6 P-02).
6. **`prefers-color-scheme` system preference is the right default** for theme — adopted in Phase 1, no user complaints, no churn.
7. **Auto-extracted milestone accomplishments from SUMMARY.md files are noisy** — they pick up section headers like "RED phase", "One-liner:", and code-review labels. Curate manually.
8. **Pre-close artifact audit catches metadata drift cheaply.** Five completed quick tasks didn't have `SUMMARY.md` (literal name) — only `<slug>-SUMMARY.md`. Trivial to fix once surfaced; would have been invisible without the audit.

### Cost Observations

- Model mix: predominantly Opus 4.7 (1M context) for planning + execution; Haiku/Sonnet for routine commit messages and status checks
- Sessions: ~30+ across the 22-day milestone (Phase 6 alone spanned ~10 sessions)
- Notable: Phase 6 was the longest phase by session count due to the cross-cutting nature (4 cleanup buckets) + GDPR opt-IN rewire complexity. The cleanup-phase pattern (no new product features, scope explicitly bounded by `D-XX` decisions) prevented scope creep but didn't reduce session count

---

## Milestone: v1.2 — Admin Visibility Controls

**Shipped:** 2026-05-14
**Phases:** 3 (Phases 11–13) | **Plans:** 17 | **Tasks:** 30
**Timeline:** 2026-05-11 → 2026-05-14 (3 days, ~1 working week)
**Code:** +13,715 / −530 LOC across 337 files (planning-doc-heavy); 175 commits; 3 PRs (#26, #28, #29); 1 new Edge Function (`toggle-results-visibility`); 1 new DB migration (Migration 10); 12 existing EFs retrofitted with `writeAudit`

### What Was Built

- **Admin per-poll results visibility (SEED-002 reframed)** — `polls.results_hidden` boolean + `results_hidden_changed_at` timestamptz + `audit_log` table (TEXT `target_id` for Discord snowflakes); `vote_counts` SELECT RLS rewritten to honor `results_hidden` with service-role-only bypass; new `toggle-results-visibility` EF with race-safe conditional UPDATE (audit row only on actual state change)
- **Admin UI** — `<Checkbox>` "Hide results from voters" on `SuggestionForm` create flow + inline `<Switch>` per row on `AdminSuggestionRow` with optimistic flip + revert-on-error + sonner toast (matches `usePinPoll` precedent; replaced earlier AlertDialog design per D-01 wording revision)
- **Voter UI** — `SuggestionCard` + archive view: voters who already voted see "Results temporarily hidden by admin" placeholder when `results_hidden = true`; non-voters continue to see the vote form (privacy boundary unchanged)
- **UIDN-03 4-site native-`<button>` sweep** — `SearchBar` clear-X → shadcn `Button` (ghost icon); 2× `SuggestionForm` back-links → TanStack `<Link>`; `ImageInput` extracted to `<DropZone>` separating drag-region from keyboard-Browse trigger (biggest sweep site)
- **UIDN-02 mobile audit closure** — Phase 9 Plan 02 hydration-wait defect fixed: deterministic Navbar theme-toggle sentinel + two-context Pass-B (admin + member) + sha256 uniqueness gate with D-19 home↔admin whitelist; 42 PNGs captured, 0 DOM warnings, 0 unexpected collisions. Lighthouse rerun outcome **DEFER** (4/5 routes Perf<90 — perf-only)
- **Test coverage adds** — TEST-11 12-cell vote_counts RLS matrix + admin-JWT regression sentinel; TEST-12 7-case toggle EF authz + 4-case create-poll audit; TEST-13 Playwright `@smoke` SC4 round-trip with `role="meter"` post-unhide assertion

### What Worked

- **Wave-based plan dependencies** (Phase 12 explicit Wave 1/2/3/4 in ROADMAP) made parallel-eligible plans obvious — Wave 1 vs Wave 2 sequencing prevented type-regen-blocks-everything stalls
- **REVIEW-FIX-H3 simplification** — cross-AI review caught that `vote_counts` policy didn't need an `is_current_user_admin()` OR-branch; service-role bypass alone is sufficient. Shipped form is cleaner than initial plan
- **Race-safe conditional UPDATE** on the toggle EF (`.not('results_hidden','is',hidden)`) eliminated phantom-audit race under concurrent flips — REVIEW-FIX-H4 caught this before deploy
- **Decision reversal as a feature** — D-01 in Phase 12 dropped the AlertDialog confirmation pattern in favor of optimistic Switch + sonner toast (matching `usePinPoll`). Late-pivot on UX felt right; rewriting REQUIREMENTS.md VIS-07 wording in Plan 12-00 kept the contract aligned
- **Decision-ID-only review-archaeology rule** (formalized as a memory) — kept source comments clean while planning docs and harness files retain D-XX traceability. Surfaces during PR review (the `e2e/fixtures/test-users.ts` SYNC-CHECK was carefully phrased neutrally as a result)
- **Single-run Lighthouse policy (D-13)** — Plan 13-02 ran the audit exactly once; first-run numbers accepted. Removed re-run vs cherry-pick decision overhead. The strict-floor MISS outcome was recorded as-is with the D-12 follow-up trigger
- **D-19 per-width home↔admin whitelist** — preserved the Phase 9 D-06 intentional sha256 collision (AdminGuard → LandingPage at every width) without re-introducing loading-shell false-pass capability
- **PR fix-pass discipline** — 4 successive rounds of coderabbitai bot review (`e5b97a5` → `8d036c0` → `5585e80` → `2522ff2`) each addressed a real consistency issue; round 3's hard-assert conversion exposed a latent count bug (13-02-01 expected 10, actual 11 with D-27 stdout log)

### What Was Inefficient

- **Local supabase-edge-runtime ES256 verification bug** (1.73.x rejects auth-service-issued ES256 JWTs) — affected `npm run test:integration` against local stack throughout Phase 11. Production runtime unaffected (JWKS discovery), so the test suite ran transitively via Phase 12 UAT. The local-runtime gap forced Plan 11-04 to ship with "runtime PASS gated to Plan 05's live-target deploy" caveats
- **zsh `$status` collision** — Plan 13-02 Task 1 tripped on zsh's read-only `$status` builtin while capturing `audit-mobile.sh`'s exit code. The 5 Lighthouse JSON/HTML files were already produced (audit ran exactly once per D-13), but the canonical stdout log had to be reconstructed. Future shell snippets should use `audit_status` / `script_exit`
- **Harness wave-split surprise** — Plan 13-02 Task 4 expected an atomic 5-file commit; reality was a wave split (Wave 1 `97d1440` harness fix + Wave 2 `0ab6973` closure commit). Made the Verifier's third HUMAN-UAT item DEFERRED-BY-DESIGN per D-25 (PR description had to mention the split at PR-open time, not in committed text)
- **MILESTONES.md auto-generated entry quality** — `gsd-sdk query milestone.complete` extracted "One-liner:" stubs from SUMMARY files without the field; produced 4 empty bullets + 1 review-rule leak. Required a full curated rewrite. (Same risk hit v1.1 — its MILESTONES.md entry was never written and remains a gap.)

### Patterns Established

- **D-XX decision IDs as the single review-archaeology surface** — `.planning/` docs and audit harness (`.mjs`) may cite D-XX freely; `src/` and `src`-equivalent fixtures carry neutral forward-pointing SYNC-CHECK or maintenance comments only. The CLAUDE.md memory `feedback_no_review_archaeology_in_source` formalizes this
- **Hard-assert in validation tables** — `... | wc -l → N` is soft (prints, never fails). `test "$(... | wc -l)" -eq N` is hard (exits non-zero on mismatch). All v1.2+ Validation.md "Automated Command" cells should use the hard form
- **Bidirectional SYNC-CHECK breadcrumbs** for cross-file constants that can't be statically linked (Node ESM cannot runtime-import `.ts`). Both sites grep-discoverable from either direction
- **Wave-split commit OK if documented** — for closure phases where the harness fix is a prerequisite and the closure commit consumes its output, a 2-commit wave split is fine. Validation.md must assert both commits; PR body must call out the split (D-25 — at PR-open time, not in committed text)

### Key Lessons

1. **Auto-generated MILESTONES.md entries need a curation pass.** The CLI's accomplishment extractor matched empty `One-liner:` stubs and a review-report rule string. Plan to rewrite the entry section-by-section against the v1.0 entry as the canonical template.
2. **The hard-assert conversion is a real bug-finder.** Round 3 of PR review forced replacing `... | wc -l → N` with `test "$(...)" -eq N` for 5 cells; the conversion alone exposed a latent count mismatch. Adopt the hard form by default in future Validation.md tables.
3. **Strict-floor outcomes are usable.** UIDN-02 closed as DEFER without needing a D-14 ship-anyway analog; the Mobile-first row stays ⚠️ Revisit with a concrete trigger (next perf-budget change per D-12). Strict floors keep the row honest; the follow-up trigger keeps it actionable.
4. **`v1.1 MILESTONES.md entry missing` is technical debt.** When v1.1 archived, ROADMAP collapsed correctly + archive files created, but no v1.1 entry landed in MILESTONES.md. v1.2 hit the same risk. Track for v1.3+ hygiene phase.

### Cost Observations

- **Sessions:** ~15-20 across the 3-day milestone (Phase 11 multi-session for the 7-plan EF retrofit + RLS testing; Phase 12 multi-session for the 8-plan wave structure; Phase 13 ~6-8 sessions including 4 rounds of PR review fix passes)
- **Notable:** Phase 13 was the smallest by plan count (2) but had the longest review-fix tail — 4 successive coderabbitai bot rounds each surfaced a real consistency issue. The PR-review investment paid off in code quality

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~30+ | 6 | Initial process; cross-AI plan review used in Phases 1 + 3; diagnose-first protocol introduced in Phase 6 |
| v1.1 | (entry missing — backfill candidate) | 4 (Phases 7–10) | Path-3 carry-forward pattern introduced for evidence-driven UI closures |
| v1.2 | ~15-20 | 3 (Phases 11–13) | Wave-based plan dependencies in Phase 12; decision-reversal-via-plan-zero pattern (D-01); strict-floor MISS with concrete follow-up trigger (D-12); 4-round PR fix-pass discipline |

### Cumulative Quality

| Milestone | Unit Tests | UAT | Zero-Dep Additions |
|-----------|-----------|-----|-------------------|
| v1.0 | 378/378 | 47/50 (3 deferred) | n/a (greenfield) |
| v1.1 | (entry missing) | — | — |
| v1.2 | TEST-11 (12-cell matrix) + TEST-12 (7+4 cases) + TEST-13 (@smoke SC4) | Phase 12 partial / Phase 13 resolved (0 pending scenarios each) | shadcn `Checkbox` + `Switch` (vendored); Vitest integration scaffolding (no new deps) |

### Top Lessons (Verified Across Milestones)

1. **Refresh validation frontmatter as part of phase-complete checklist** — surfaced in v1.0 hygiene tail; v1.2 still has the same risk (Phase 12 UAT `partial` + Phase 13 `resolved` not flipped to `complete`)
2. **Track GitHub issues against milestone label at file-time** — surfaced in v1.0; v1.2 followed this (3 PRs each tagged)
3. **Auto-generated milestone entries need curation** — surfaced in v1.2; CLI extraction is best-effort but consistently misses one-liner-less SUMMARY files
4. **Hard-assert validation commands by default** — surfaced in v1.2 (round 3 of PR review); the conversion exposed a latent count bug. Soft `... | wc -l → N` is brittle
