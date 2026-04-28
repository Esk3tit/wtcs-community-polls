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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~30+ | 6 | Initial process; cross-AI plan review used in Phases 1 + 3; diagnose-first protocol introduced in Phase 6 |

### Cumulative Quality

| Milestone | Unit Tests | UAT | Zero-Dep Additions |
|-----------|-----------|-----|-------------------|
| v1.0 | 378/378 | 47/50 (3 deferred) | n/a (greenfield) |

### Top Lessons (Verified Across Milestones)

*To be filled as cross-milestone patterns emerge.*

1. *(awaiting v1.1)* Refresh validation frontmatter as part of phase-complete checklist, not as separate hygiene pass — surfaced in v1.0; verify in v1.1
2. *(awaiting v1.1)* Track GitHub issues against milestone label/milestone at file-time — surfaced in v1.0; verify in v1.1
