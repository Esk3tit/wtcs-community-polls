# Phase 6: Auth fix, GDPR opt-IN rewire, favicon polish, and launch hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
**Areas discussed:** Auth bug strategy, GDPR opt-IN UX pattern, Consent geo-scope, Cleanup scope confirmation

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Auth bug strategy | How aggressive to debug — diagnostics, escape hatch, or full repro | ✓ |
| GDPR opt-IN UX pattern | Banner / footer chip / settings page / hybrid | ✓ |
| Consent geo-scope | Global vs EU-only opt-IN | ✓ |
| Cleanup scope confirmation | Which leftover items get bundled | ✓ |

**User's choice:** All four areas selected.

---

## Auth Bug Strategy

### Question 1: Primary approach

| Option | Description | Selected |
|--------|-------------|----------|
| Diagnose-first, then targeted fix (Recommended) | Sentry breadcrumbs + `?debug=auth` overlay, capture from main browser, identify root cause, ship targeted fix. | ✓ |
| Escape-hatch first, diagnose later | "Clear stuck session" button on AuthErrorPage; users unblocked immediately even if root cause unknown. | |
| Both — escape hatch + diagnosis in same plan | Plan ships both: escape hatch as user-facing fix + diagnostics for root cause. | |

**User's choice:** Diagnose-first.
**Notes:** User wants the cleanest fix, not a guess. Escape hatch deferred unless diagnosis reveals an unfixable-in-code cause.

### Question 2: Manual repro inclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Include in the plan (Recommended) | First plan task = manual repro: clear cookies/localStorage, disable extensions, check 3rd-party cookie blocking. | ✓ |
| I've already tried these — go straight to code investigation | Skip manual-repro task; assume code-level issue. | |
| Not sure — let the researcher decide | Researcher does external scan for known Supabase Discord OAuth gotchas. | |

**User's choice:** Include in the plan.
**Notes:** User has not pre-tried environmental fixes. Manual repro becomes the first plan task to rule out environmental causes before code investigation.

---

## GDPR Opt-IN UX Pattern

### Question 1: Consent surface

| Option | Description | Selected |
|--------|-------------|----------|
| Flipped footer chip + one-time banner (Recommended) | Tiny non-blocking banner first visit, choice remembered, ConsentChip in footer for changing mind. | ✓ |
| Settings page only (no banner) | No banner; analytics OFF by default; user must visit /settings to opt in. | |
| Blocking modal on first visit | Classic GDPR cookie modal; highest opt-in rate but heavy. | |
| Footer chip only, default OFF | No banner, no modal; ConsentChip always present in footer. | |

**User's choice:** Flipped footer chip + one-time banner.
**Notes:** Honors GDPR without feeling heavy. Reuses existing ConsentChip from Phase 5 with inverted wording and default-OFF state.

### Question 2: Replay scope

| Option | Description | Selected |
|--------|-------------|----------|
| Bundled — one consent for both (Recommended) | Single Allow/Decline covers PostHog analytics events and Sentry Replay. | ✓ |
| Separate toggles | Two checkboxes: analytics + replay independent. | |
| Replay always-off, analytics-only opt-IN | Drop session replay entirely from v1.0. | |

**User's choice:** Bundled.
**Notes:** Simpler UX and code. Sentry error capture (separate from Replay) stays unconditional — errors are PII-free under Phase 5 D-13.

---

## Consent Geo-Scope

### Question 1: Geo-targeting

| Option | Description | Selected |
|--------|-------------|----------|
| Global opt-IN — same UX everywhere (Recommended) | Default-OFF analytics for all users; no geo-detection. | ✓ |
| EU-only opt-IN, opt-OUT elsewhere | Detect EU/UK via Netlify country header; preserve analytics from non-EU. | |
| Global opt-IN, but show a "Why?" link | Same as Recommended, plus small "Why we ask" link to privacy note. | |

**User's choice:** Global opt-IN.
**Notes:** Defensible privacy posture, zero geo-detection complexity. Aligns with the "no geo-gating" architectural assumption already in place (memory: Russian users routinely use VPN).

---

## Cleanup Scope Confirmation

### Question 1: Items in Phase 6

| Option | Description | Selected |
|--------|-------------|----------|
| Favicon replace (Recommended) | Replace public/favicon.svg with WTCS-branded set from src/assets/wtcs-logo.png. | ✓ |
| Sentry symbolicated stack-trace verification (Recommended) | Trigger real prod error, confirm Sentry shows un-minified frames + sourcemap line numbers. | ✓ |
| Update PROJECT.md / REQUIREMENTS.md status fields | Mark previously-pending v1 requirements as Complete. | ✓ |
| Index.html title + meta description polish | Replace lowercase-slug `<title>` and add meta description. | ✓ |

**User's choice:** All four items selected (multiSelect).
**Notes:** Full cleanup pass. No items deferred.

---

## Wrap-Up

### Question: Ready for context?

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context (Recommended) | Write 06-CONTEXT.md and surface next-steps prompt. | ✓ |
| Explore more gray areas | Surface 2-3 more gray areas based on what came up. | |
| Revisit one of the areas | Change a decision before locking. | |

**User's choice:** Ready for context.

---

## Claude's Discretion

- Exact `?debug=auth` overlay UI shape (table vs JSON dump vs collapsible panel)
- Sentry breadcrumb category/level naming for the auth flow
- Banner copy exact wording ("Allow"/"Yes"/"Got it")
- Banner dismissal storage mechanism (localStorage preferred over cookie)
- Favicon generation tooling (real-favicon-generator vs vite-plugin-favicons vs hand-crafted SVG)
- Whether to add a separate `/privacy` page or keep privacy details inline
- Sentry sourcemap-verification trigger mechanism (admin-only debug route vs deliberate EF malformed-payload vs CI smoke test)

## Deferred Ideas

- "Clear stuck session and retry" escape-hatch button on AuthErrorPage (revisit if D-01 diagnosis reveals an unfixable-in-code cause)
- Separate granular toggles for analytics vs replay (v2 candidate)
- EU-only opt-IN with default-ON elsewhere (rejected; architecture supports as future experiment)
- Discord webhook on auth failure or consent change (out of scope; aligns with Phase 5 D-03)
- `/privacy` page as a separate route (Claude's-discretion call; default is inline)
