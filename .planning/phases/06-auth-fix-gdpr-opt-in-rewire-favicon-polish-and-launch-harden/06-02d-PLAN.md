---
phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
plan: 02d
type: execute
wave: 2
depends_on: [06-02c]
files_modified: []
autonomous: false
requirements: []
tags: [D-04, D-06]

must_haves:
  truths:
    - "PostHog dashboard 'Live events' filter for the past 5 minutes shows zero new events from a clean-profile session that has NOT clicked Allow (D-04)"
    - "After the user clicks Allow + reloads, pageview events appear in PostHog within 30s (D-04)"
    - "After a separate clean-profile session clicks Decline, zero events flow (matches pre-Allow behavior; D-04)"
    - "Outcome documented in 06-02d-SUMMARY.md as a '## PostHog smoke' table"
  artifacts:
    - path: ".planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-02d-SUMMARY.md"
      provides: "PostHog dashboard smoke evidence (out-of-repo verification, recorded in summary)"
      contains: "PostHog smoke"
  key_links:
    - from: "polls.wtcsmapban.com (live)"
      to: "PostHog dashboard"
      via: "consent gate enforces zero events pre-Allow"
      pattern: "Live events"
---

<objective>
Phase 4 of the GDPR opt-IN rewire (split per Phase 6 revision). Smoke-test the live deploy against the real PostHog dashboard to confirm zero events flow before the user clicks Allow, and that events do flow after Allow + reload. Document the outcome in 06-02d-SUMMARY.md.

Purpose: Code-only tests prove the consent state machine; this plan proves the network-level outcome. Required by VALIDATION.md "Manual-Only Verifications" row for D-04.

Output: One human-verify checkpoint that records dashboard observations into a SUMMARY file. No source code changes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-CONTEXT.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-VALIDATION.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-02-SUMMARY.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-02b-SUMMARY.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-02c-SUMMARY.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Smoke-test against PostHog dashboard — confirm zero events flow before consent flip</name>
  <read_first>
    - .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-VALIDATION.md ("Manual-Only Verifications" row for D-04 PostHog dashboard)
    - .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-CONTEXT.md (D-04 default-OFF lock; D-06 same UX everywhere)
  </read_first>
  <files>(see <how-to-verify> below — this is a checkpoint task; no source files modified at this step)</files>
  <action>(see <how-to-verify> below — this is a checkpoint task; the action is human-driven verification, not autonomous code change)</action>
  <verify>(see <acceptance_criteria> below)</verify>
  <done>(see <acceptance_criteria> below)</done>
  <what-built>
    Plans 06-02, 06-02b, 06-02c shipped the GDPR opt-IN rewire end-to-end. This checkpoint verifies the change works against the real PostHog dashboard (out-of-repo verification).
  </what-built>
  <how-to-verify>
    1. Deploy the branch to a Netlify preview (gh PR auto-deploys) or merge to main and wait for the deploy.
    2. Open the deployed URL in a clean browser profile (no prior wtcs_consent localStorage key).
    3. Open PostHog project dashboard at https://us.posthog.com (or eu.posthog.com depending on org), filter "Live events" to the past 5 minutes for the `community-polls` app tag.
    4. In the browser, navigate through 2-3 routes (Topics → Archive → back to Topics). Do NOT click Allow on the banner.
    5. After 60s, confirm PostHog dashboard shows ZERO new events from this session.
    6. Click `Allow` on the consent banner.
    7. Reload the page (Replay needs a reload to attach per RESEARCH.md Pitfall 7).
    8. Navigate the same routes again.
    9. Confirm PostHog dashboard now shows pageview events for this session, and the Sentry Replay dashboard shows a replay started.
    10. Open a separate clean browser profile, repeat steps 2-5 but click `Decline`. Confirm zero events flow.
    11. Document outcome by appending a short "## PostHog smoke" section to `.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-02d-SUMMARY.md`.
  </how-to-verify>
  <acceptance_criteria>
    - Network tab during pre-Allow navigation shows ZERO requests to `*.posthog.com/capture` and ZERO Replay envelope POSTs to `*.sentry.io`.
    - PostHog dashboard "Live events" filter for the past 5 minutes shows zero new events from the test session.
    - After Allow + reload: pageview events appear in PostHog within 30s.
    - After Decline (separate profile): zero events flow (matches pre-Allow behavior).
    - Summary section "## PostHog smoke" added to 06-02d-SUMMARY.md with outcome (PASS/FAIL per scenario plus a one-line note).
  </acceptance_criteria>
  <resume-signal>Type "smoke green" or paste the PostHog event-count screenshot to close this task.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → PostHog SaaS | Event capture; gated by consent (D-04) |
| Browser → Sentry SaaS (Replay) | Session recording; gated by consent (D-04) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-19 | Repudiation | Code-only tests pass but live network still leaks events | mitigate | This plan IS the mitigation: dashboard smoke proves zero network egress pre-Allow; failure here forces a fix-forward in a follow-up plan |
</threat_model>

<verification>
- PostHog dashboard smoke confirms zero events pre-Allow
- Allow + reload triggers events within 30s
- Decline (separate profile) keeps events at zero
- Outcome documented in 06-02d-SUMMARY.md
</verification>

<success_criteria>
- D-04 default-OFF semantics observable end-to-end (network level)
- 06-02d-SUMMARY.md contains "## PostHog smoke" section with outcome
</success_criteria>

<output>
After completion, create `.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-02d-SUMMARY.md` with the "## PostHog smoke" section.
</output>
