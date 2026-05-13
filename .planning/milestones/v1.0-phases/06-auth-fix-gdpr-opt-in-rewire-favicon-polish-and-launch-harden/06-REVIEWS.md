---
phase: 6
slug: auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
generated: 2026-04-25
reviewers: [gemini, codex, cursor, coderabbit]
summary_risk_distribution: { LOW: 1, MEDIUM: 2, HIGH_BLOCKERS: 2 }
---

# Phase 6 — Cross-AI Plan Reviews

Four external reviewers independently assessed the seven Phase 6 plans (06-01, 06-02, 06-02b, 06-02c, 06-02d, 06-03, 06-04).

## Risk Verdicts

| Reviewer | Overall Risk | Critical Findings |
|----------|--------------|-------------------|
| Gemini | LOW | Sentry Replay mid-session leak, AuthContext identify timing, Sentry smoke admin-gate |
| Codex | HIGH (2 blockers) | DEV-gated debug overlay can't run in production; effect-throw not caught by ErrorBoundary; smoke trigger merged to main |
| Cursor | MEDIUM | Manual-verification reliability; prod smoke-error governance; AuthContext effect coupling |
| CodeRabbit | N/A | Tool reviews git diffs; nothing to compare against post-commit |

## Cross-Reviewer Consensus

**HIGH-severity issues raised by 2+ reviewers:**

1. **Sentry smoke trigger (06-04 Task 1) — production governance and ErrorBoundary catch behavior.** Codex flags HIGH (effect-throw is not reliably caught by React ErrorBoundary; merging deliberate-error code to main even temporarily is risky). Cursor flags HIGH (prod governance). Gemini flags MEDIUM (admin-gate ordering). All three agree this needs hardening.
2. **AuthContext consent coupling (06-02b Task 4) — effect dependency churn.** Codex flags HIGH (re-running auth subscription effect can re-trigger session resolution). Cursor and Gemini flag MEDIUM (timing/idempotency risk). Suggestion: separate analytics-identify effect from auth-subscription effect.

**Codex-only HIGH (worth confirming):**

3. **DEV-gated debug overlay (06-01) cannot diagnose the production bug.** Codex notes `import.meta.env.DEV` is false on Netlify prod builds — yet the bug ONLY reproduces on `polls.wtcsmapban.com` per CONTEXT.md. **This is potentially a major blocker** if true: the diagnostic tool can't reach the failing environment. Recommend an opt-in prod gate (e.g. `VITE_AUTH_DEBUG_OVERLAY` env var settable on a Netlify deploy preview, or a localStorage toggle) so the overlay is reachable on the failing browser without exposing it to the public.

## Recommended Actions

Three items warrant a revision pass via `/gsd-plan-phase 6 --reviews`:

- **R-01 (HIGH):** Fix 06-01 debug-overlay availability — replace pure DEV gate with a Netlify-preview-or-localStorage-toggle gate so it's reachable in the failing browser. The user's main browser hits prod, not local dev.
- **R-02 (HIGH):** Re-architect 06-04 D-08 verification — don't ship deliberate throw to main. Options: (a) Netlify deploy-preview-only smoke route, (b) controlled render-phase throw inside an admin-only smoke component rendered ONLY post-AdminGuard via dedicated route, or (c) Sentry's own `captureException` test from an admin-only debug button. Verify the chosen mechanism actually triggers the ErrorBoundary path.
- **R-03 (MEDIUM):** Split 06-02b Task 4 analytics-identify into its own `useEffect([consentState, user])` separate from the auth-subscription effect, so consent flips don't churn the auth subscription.

**LOW/MEDIUM polish (optional):**
- Highlight PKCE `*-code-verifier` localStorage key as a dedicated row in the debug overlay (Gemini)
- Force `window.location.reload()` when consent flips allow→decline to terminate live Replay (Gemini, Codex Pitfall 7)
- Use opaque background for `apple-touch-icon.png` (Gemini)
- Verify shadcn button height meets 44px touch target on banner Allow/Decline (Codex)
- Add service-worker/cache-clear step to D-02 manual repro checklist (Cursor)
- Add a regression test: "user already signed in, consent flips to allow → identify fires once" (Codex, Cursor)

## Full Reviewer Outputs

### Gemini

# Phase 6 Plan Review: WTCS Community Polls

This review covers plans **06-01** through **06-04**, addressing auth diagnostics, GDPR opt-IN conversion, asset polish, and requirements hardening.

## 1. Summary
The Phase 6 implementation plan is an exceptionally thorough and defensive cleanup strategy. It prioritizes a "diagnose-first" approach for the reported auth regression and implements a privacy-first (opt-IN) analytics model that satisfies strict GDPR compliance. The plan is well-structured into logical waves, utilizing Vite's build-time optimizations (tree-shaking) for debug tools and ensuring that the project's terminology and branding are unified for the v1.0 release.

## 2. Strengths
*   **Defensive Debugging (06-01):** The use of `import.meta.env.DEV` combined with dynamic imports for the `?debug=auth` overlay ensures that diagnostic tools provide high visibility during development without adding any weight or security risk to the production bundle.
*   **Granular GDPR Transition (06-02 Series):** Splitting the GDPR rewire into Foundation (06-02), Wiring (06-02b), UI (06-02c), and Smoke (06-02d) prevents context overflow and allows for isolated testing of the state machine before the UI is even visible.
*   **Native PostHog Compliance:** Leveraging `opt_out_capturing_by_default: true` is the correct, supported way to handle GDPR in PostHog-js, avoiding brittle manual initialization logic.
*   **Evidence-Based Requirements Sync (06-04):** The mandate to cite specific phase artifacts (UAT/VERIFICATION files) for each requirement status flip ensures the `REQUIREMENTS.md` file remains a source of truth rather than a best-guess document.
*   **Zero-Regressed Instrumentation:** Adding Sentry breadcrumbs (06-01) across the auth lifecycle provides long-term observability for edge-case login failures without mutating existing logic.

## 3. Concerns

*   **Sentry Replay "Leak" (06-02):** As noted in **Pitfall 7**, Sentry Replay does not support runtime detachment. If a user clicks "Allow" and then later clicks "Turn off" via the `ConsentChip`, the replay will continue for that session until a page reload occurs.
    *   *Severity:* **LOW**.
    *   *Risk:* Users who revoke consent mid-session might still have that session recorded. Given the small community size and the nature of the data, this is acceptable for v1.0 but should be documented.

*   **AuthContext `identify()` Timing (06-02b):** In Task 4, the plan adds `consentState` to the `useEffect` dependencies in `AuthContext`. If a user is already logged in (session present) but currently "Undecided," clicking "Allow" on the banner will trigger the effect.
    *   *Severity:* **LOW**.
    *   *Risk:* The effect must be truly idempotent to avoid double-processing the session. The plan correctly identifies that `subscription.unsubscribe` and `verifyingRef` handle this, but it requires precise execution.

*   **Sentry Smoke Trigger Location (06-04):** Placing a `throw` in `AdminTabs.tsx` (Task 1) assumes `AdminGuard` is a hard gate.
    *   *Severity:* **MEDIUM**.
    *   *Risk:* If the router or component tree changes such that `AdminTabs` mounts before authorization is confirmed, the smoke test could impact non-admin users. The plan mitigates this by using `useEffect` (mount-time only) and a specific query param.

## 4. Suggestions
*   **For 06-01 (Auth Overlay):** Explicitly check for the presence of the `sb-<project>-code-verifier` key in the localStorage section of the overlay. Since this is the primary hypothesis (Pitfall 4), having a dedicated "PKCE State" row or highlight would speed up manual diagnosis.
*   **For 06-02b (Wiring):** Consider adding a `window.location.reload()` call inside the `decline` callback within `ConsentContext.tsx` *only if* `state` was previously `allow`. This would forcibly terminate any active Sentry Replay session, solving the Pitfall 7 leak at the cost of a single refresh.
*   **For 06-03 (Favicon):** Ensure the `apple-touch-icon.png` is generated with a solid background (typically white or black) rather than transparency, as iOS can sometimes render transparent icons with unpredictable black backgrounds or artifacts.

## 5. Risk Assessment
**Overall Risk: LOW**

The plan is inherently low-risk because it avoids adding new product features and focuses on instrumentation and polish. The most complex technical change—the GDPR state machine—is covered by a heavy test suite (23+ assertions). The auth bug investigation follows a "do no harm" diagnostic path. The deliberate-error trigger for sourcemap verification is well-gated by admin authorization and a query parameter, with a mandated atomic rollback.

**Dependency Ordering Check:**
The Wave 2 chain (`06-02` → `06-02b` → `06-02c` → `06-02d`) is logically sound and follows a standard "Engine → Plumbing → Interior → Testing" sequence. All `depends_on` fields are correctly mapped.

---

### Codex

## 06-01 — Auth Diagnose-First

**Summary:** Strong diagnostic intent, but the plan has one major contradiction: the `?debug=auth` overlay is required for the failing production browser, while the plan gates it behind `import.meta.env.DEV`, which means it will not exist in Netlify preview or production builds.

**Strengths**
- Correctly prioritizes manual browser-state differential diagnosis before code changes.
- Good auth lifecycle breadcrumb coverage.
- Explicitly prevents token/PII logging and AuthErrorPage UX drift.

**Concerns**
- **HIGH:** DEV-only overlay cannot be used on `polls.wtcsmapban.com`; Vite preview/prod builds set `import.meta.env.DEV === false`.
- **MEDIUM:** Manual repro before instrumentation may not capture the most useful state if the bug is transient.
- **LOW:** Grep checks for raw tokens may false-positive on legitimate existing auth code references.

**Suggestions**
- Add a safe preview-only debug gate, e.g. `VITE_AUTH_DEBUG_OVERLAY=true` for a Netlify deploy preview, plus an allowlist/check that is impossible on production main.
- Keep production Sentry breadcrumbs; make overlay available only on local/preview diagnostic builds.
- Narrow token grep checks to breadcrumb/debug render payloads.

**Risk Assessment:** **HIGH** until the overlay availability contradiction is fixed; otherwise medium.

## 06-02 — ConsentContext Foundation

**Summary:** Solid single-source consent model with good migration and test coverage. This is the right architectural anchor for the GDPR rewire.

**Strengths**
- Clear `undecided | allow | decline` state model.
- Good one-shot migration from `analytics_opted_out`.
- Cross-tab sync and hook misuse tests are included.

**Concerns**
- **MEDIUM:** On initial mount with stored `allow`, `loadSentryReplayIfConsented()` runs immediately, but PostHog init ordering depends on 06-02b.
- **MEDIUM:** `opt_in_capturing()` fires whenever a provider mounts in tests/StrictMode; likely harmless but noisy.
- **LOW:** `sessionStorage` vs `localStorage` dismissal semantics differ between banner/chip later; acceptable but should be intentional.

**Suggestions**
- Make side-effect tests resilient to React StrictMode double effects.
- Consider tracking previous consent state in a ref to avoid repeated opt-in/out calls on remounts.

**Risk Assessment:** **LOW-MEDIUM**; architecture is sound.

## 06-02b — Runtime Consent Wiring

**Summary:** Correct dependency on 06-02 and addresses the critical SDK gates. The main risk is AuthContext coupling to `ConsentProvider`.

**Strengths**
- Uses PostHog native opt-out-by-default flags instead of conditional init.
- Keeps Sentry error capture unconditional while gating Replay.
- Correct provider ordering: `PostHogProvider > ConsentProvider > RouterProvider`.

**Concerns**
- **HIGH:** Re-running the whole AuthContext auth subscription effect when `consentState` changes can re-trigger session resolution and auth callbacks. The plan assumes idempotence, but this is a risky place to add a dependency.
- **MEDIUM:** Gating `identify()` only inside `onAuthStateChange` may miss identifying an already-signed-in user when they later click Allow unless the effect re-run path actually covers it.
- **LOW:** Tests may need more than wrapper changes if AuthContext behavior changes.

**Suggestions**
- Prefer a separate effect for analytics identity: `useEffect([consentState, user])`, leaving the auth subscription effect dependencies unchanged.
- Add/require a test for “user already signed in, then consent flips to allow, identify fires once.”

**Risk Assessment:** **MEDIUM** due to AuthContext effect coupling.

## 06-02c — Banner And Chip UI

**Summary:** Good UI scope and copy discipline. It cleanly separates first decision from later management.

**Strengths**
- Banner/chip mutual exclusion is well-defined.
- Good tests for first visit, allow, decline, admin hide, dismissal, and migration.
- Avoids geo branching and destructive styling for Decline.

**Concerns**
- **MEDIUM:** Banner `Allow`/`Decline` buttons may not meet 44px touch target depending on shadcn default button height.
- **LOW:** Chip dismissal uses `localStorage`, so “session-scope” wording is inaccurate unless cleared later.
- **LOW:** Banner fixed bottom-right may overlap mobile browser UI or footer content.

**Suggestions**
- Use explicit `min-h-11` or equivalent on banner buttons.
- Either change chip dismissal to `sessionStorage` or update wording/tests to say persistent dismiss.
- Add a mobile screenshot/manual check for banner placement.

**Risk Assessment:** **LOW-MEDIUM**.

## 06-02d — PostHog Smoke

**Summary:** Valuable manual verification, but it needs sharper distinction between SDK-load requests and event/replay capture requests.

**Strengths**
- Correctly validates real network behavior, not just unit tests.
- Covers pre-consent, Allow, and Decline scenarios.
- Documents evidence in summary.

**Concerns**
- **MEDIUM:** “ZERO requests to `*.posthog.com/capture`” may not cover all PostHog ingestion paths; SDK initialization may still contact PostHog for config/feature flags unless disabled.
- **MEDIUM:** “Replay needs reload to attach” conflicts with 06-02 allowing lazy attach immediately after consent.
- **LOW:** Dashboard timing can be flaky.

**Suggestions**
- Validate network by endpoint classes: no event capture, no session recording, no identify before consent. Allow non-capture SDK/config requests only if documented and privacy-safe.
- Add browser Network HAR/screenshot evidence, not only dashboard observation.
- Clarify whether Replay should attach immediately after Allow or only after reload.

**Risk Assessment:** **MEDIUM** because external dashboard checks are inherently noisy.

## 06-03 — Favicon And Title

**Summary:** Mostly straightforward launch polish. The plan is adequate but has filename inconsistencies with the UI spec/research.

**Strengths**
- Keeps scope tight: favicon, title, description only.
- No new build dependency.
- Includes production visual verification.

**Concerns**
- **MEDIUM:** Uses `favicon-32.png`, while research examples mention `favicon-32x32.png` / `favicon.png`; inconsistency can cause broken links if generator output is not renamed exactly.
- **MEDIUM:** realfavicongenerator may emit metadata/webmanifest suggestions that the plan deletes; fine, but manual renames are error-prone.
- **LOW:** The grep `vote|poll` in `index.html` could false-positive if URLs or comments appear later.

**Suggestions**
- Standardize one filename in all docs and plan artifacts, preferably `favicon-32x32.png`.
- Add a simple `test -f public/...` check before editing `index.html`.
- Include `curl -I` validation for each final asset.

**Risk Assessment:** **LOW-MEDIUM**.

## 06-04 — Sentry Symbolication And Requirements Sync

**Summary:** Covers the right cleanup items, but the Sentry smoke workflow is operationally heavy and the REQUIREMENTS audit has brittle numeric gates.

**Strengths**
- Strong insistence on rolling back deliberate error code.
- Admin-gated smoke path is safer than a public throw.
- Evidence-driven requirements sync is the right discipline.

**Concerns**
- **HIGH:** “Throw inside `useEffect` caught by ErrorBoundary” is not reliable. React error boundaries do not catch async/event/effect errors the same way they catch render/lifecycle errors. This may not render `AppErrorFallback`.
- **HIGH:** The temporary smoke trigger is merged to main before rollback; even query-gated admin-only code in production is risky.
- **MEDIUM:** REQUIREMENTS gate of `>=29` checked boxes is arbitrary and can pressure false completion.
- **MEDIUM:** Inline HTML comments on every requirement may make REQUIREMENTS noisy.

**Suggestions**
- Use a controlled render-phase throw inside an admin-only smoke component rendered only after `AdminGuard` success, or a one-time admin-only route removed immediately after verification.
- Prefer Netlify deploy preview with production build + sourcemap upload if Sentry release mapping supports it, avoiding main exposure.
- Replace numeric completion threshold with exact audited list plus “left pending” table.
- Keep evidence in a compact audit table rather than inline comments on every row.

**Risk Assessment:** **HIGH** until the effect-throw and main-merge smoke approach are tightened.

## Overall

The phase is well decomposed, and the Wave 2 dependency chain `06-02 → 06-02b → 06-02c → 06-02d` is correct. The biggest blockers are operational: the auth debug overlay cannot diagnose production while DEV-gated, and the Sentry smoke trigger may not behave as assumed. Fix those two and the remaining plans are mostly solid launch-hardening work.

---

### Cursor

## 06-01-PLAN Review

**Summary**  
Strong diagnose-first structure aligned with D-01/D-02, and it correctly prioritizes manual differential checks before code guesses. The instrumentation coverage is thorough and likely to make auth failures explainable. Biggest risk is operational: the plan mixes human-only checkpoints with implementation in one plan, which can stall or lead to partial completion.

**Strengths**
- Forces D-02 manual repro before edits; this is exactly right for “works in incognito, fails in main profile.”
- Breadcrumb placement is comprehensive across context, callback, helper branches, and error page.
- Explicit six-key Sentry breadcrumb schema and token/PII guardrails are excellent.
- DEV-only overlay + tree-shaking verification is well designed and security-aware.
- Clear closure path: either targeted fix or environmental conclusion, both documented.

**Concerns**
- **MEDIUM:** Very prescriptive “paste verbatim” instructions may drift from actual code shape and cause brittle edits.
- **MEDIUM:** Task 4 expects root-cause closure in the same plan; real-world auth issues may need multiple repro cycles.
- **LOW:** `console.error` proxy and timer logic in overlay can add test/runtime complexity for a dev-only tool.
- **LOW:** Some verification commands assume exact text patterns and could false-fail after minor wording changes.

**Suggestions**
- Split into two explicit outcomes: “instrumentation complete” vs “root-cause fixed,” with allowed carry-over if unresolved.
- Add one small automated test for breadcrumb helper behavior (or extract helper), reducing manual-only confidence.
- Add service worker/cache clearing to repro checklist (common profile-only differential).

**Risk Assessment**  
**MEDIUM** — technically solid and likely to find signal, but execution depends heavily on human steps and environmental variability.

---

## 06-02-PLAN Review

**Summary**  
Excellent foundational plan for consent state centralization. It cleanly introduces a single source of truth, migration from legacy opt-out, and cross-tab synchronization. This is the right architectural base for Phase 6 GDPR rewiring.

**Strengths**
- Consent context + hook split matches existing project conventions.
- One-shot migration from `analytics_opted_out` is explicit and test-covered.
- Correctly avoids PostHog’s `has_opted_out_capturing()` ambiguity.
- Side-effect bridge (`opt_in`, `opt_out`, Replay load) is centralized.
- Strong test coverage plan (8 targeted behaviors) including “hook outside provider” errors.

**Concerns**
- **MEDIUM:** Side effects on initial mount (state read) may trigger opt-in/out calls immediately; acceptable but should be intentional/documented.
- **LOW:** Exporting `ConsentContextValue` interface from context file may trigger lint style differences depending on rule config.
- **LOW:** No explicit handling for corrupted localStorage values beyond fallback to `undecided` (mostly fine).

**Suggestions**
- Add an idempotence guard in effect to avoid duplicate calls in StrictMode dev double-invocation.
- Add one test for malformed `wtcs_consent` value.
- Document Replay “cannot detach mid-session” in code comments near effect.

**Risk Assessment**  
**LOW-MEDIUM** — strong plan and tests; minor runtime nuance risk in effect behavior.

---

## 06-02b-PLAN Review

**Summary**  
This is the critical wiring plan and mostly excellent. It correctly preserves unconditional Sentry error capture while gating Replay and identify behavior by consent. Dependency on 06-02 is appropriate.

**Strengths**
- PostHog config uses native GDPR-safe defaults (`opt_out_capturing_by_default`, persistence off, DNT).
- Replay gate migration from legacy key to `wtcs_consent==='allow'` is precise.
- Provider order in `main.tsx` is correct and explicit.
- Auth identify gate tied to consent is essential and correctly scoped.
- Calls out test wrapper changes needed once `AuthProvider` depends on consent context.

**Concerns**
- **MEDIUM:** `AuthContext` effect dependency changes could alter auth event timing/subscription churn if not carefully done.
- **MEDIUM:** No explicit regression test added for “consent flips to allow while already logged in triggers identify.”
- **LOW:** Full-suite reliance may hide missing targeted assertions for new behavior.

**Suggestions**
- Add/require a focused AuthContext test for retroactive identify on consent flip.
- Ensure effect cleanup/subscription logic is reviewed for duplicate subscriptions after adding `consentState`.
- Include a minimal integration test for provider composition in `main.tsx` (or snapshot-like route render test).

**Risk Assessment**  
**MEDIUM** — high-value changes in core auth/runtime path; good plan, but regression risk is non-trivial.

---

## 06-02c-PLAN Review

**Summary**  
Good UX implementation plan with strong adherence to copy/tone and state-machine inversion. It avoids scope creep and keeps UI changes focused. Tests are thorough enough for confidence.

**Strengths**
- Banner/chip mutual exclusivity is explicitly encoded.
- Correctly keeps `/admin/*` hidden behavior.
- Copy is locked and terminology-compliant with project framing.
- Removes old direct side effects from chip (good separation of concerns).
- Test rewrite/addition is comprehensive and aligned with new semantics.

**Concerns**
- **MEDIUM:** Session dismiss behavior uses `sessionStorage` for banner and `localStorage` for chip dismiss; mixed semantics may confuse future maintenance.
- **LOW:** Fixed bottom-right for both surfaces is fine due to guards, but brief transitions during state changes could overlap in edge render timing.
- **LOW:** Hardcoded strings in tests are brittle against approved copy tweaks.

**Suggestions**
- Define dismiss-key policy in one shared constants file to avoid drift.
- Add a tiny test asserting banner and chip never co-render.
- Consider a small fade transition test or remove transition reliance if flaky.

**Risk Assessment**  
**LOW-MEDIUM** — mostly straightforward UI/state work with good tests.

---

## 06-02d-PLAN Review

**Summary**  
Appropriate manual smoke gate for proving real network behavior (pre-consent silence, post-allow flow). It complements unit tests well. Main risk is reproducibility and observer bias from dashboard timing/filtering.

**Strengths**
- Validates real dashboard outcomes, not just mocks.
- Includes both allow and decline paths, plus clean-profile requirement.
- Captures replay/event behavior expectations in production-like conditions.
- Keeps scope narrow (verification only, no extra code).

**Concerns**
- **MEDIUM:** “Zero events in 60s” can be noisy due to ingestion delays/filter mismatch.
- **LOW:** Depends on human dashboard interpretation; no deterministic artifact standard beyond summary text.
- **LOW:** No explicit instruction to isolate by distinct_id/session could cause ambiguity in shared environments.

**Suggestions**
- Require capturing request logs (Network tab screenshots) alongside dashboard evidence.
- Add explicit PostHog filter criteria (app tag + timestamp + unique test marker if available).
- Define retry window (e.g., 3-minute observation) before failing.

**Risk Assessment**  
**MEDIUM** — correct verification intent, but inherently manual and timing-sensitive.

---

## 06-03-PLAN Review

**Summary**  
Good polish plan with clear boundaries and minimal technical risk. It avoids over-engineering by using one-time favicon generation and straightforward `index.html` updates. The manual generation step is the main operational dependency.

**Strengths**
- Scope is tight: favicon set + title/meta only.
- Terminology and SEO copy are locked and aligned with project language rules.
- Includes dist-level verification and production visual checks.
- Explicitly avoids OG/Twitter scope creep.
- Sensible optional dark-mode handling strategy.

**Concerns**
- **LOW:** Reliance on manual file generation introduces inconsistency risk.
- **LOW:** Filename convention (`favicon-32.png`) is uncommon; easy to mismatch generator defaults.
- **LOW:** Browser favicon cache can create false negatives in verification.

**Suggestions**
- Commit a short README note in `public/` describing favicon source/workflow for reproducibility.
- Add checksum or dimensions check script in plan to avoid accidental wrong assets.
- Consider keeping generator output names standard unless there is a strong reason to rename.

**Risk Assessment**  
**LOW** — mostly static asset/document edits with limited failure blast radius.

---

## 06-04-PLAN Review

**Summary**  
Important closure plan with strong intent, especially around direct Sentry symbolication proof and REQUIREMENTS drift correction. However, this plan carries the highest governance and operational risk due to deliberate prod error injection and documentation bulk edits.

**Strengths**
- Directly addresses the last human-verification gap from Phase 5.
- Requires rollback of smoke trigger and evidence preservation.
- D-09 audit is evidence-driven and explicitly forbids assumption-based completion.
- Includes traceability-sync checks between checklist and table.
- Clearly keeps out-of-scope UAT-9 unchanged.

**Concerns**
- **HIGH:** Deliberate production throw, even admin-gated, is still risky operationally and can affect real admins if URL leaks or is revisited.
- **MEDIUM:** “Same commit rollback” language conflicts with preceding step flow (temp commit + merge + second PR rollback) and may be interpreted inconsistently.
- **MEDIUM:** Bulk REQUIREMENTS flips with inline comments can create long-term doc noise and merge conflicts.
- **MEDIUM:** Numeric threshold gates (`>=29`) risk incentivizing checkbox flips over strict evidence quality.
- **LOW:** Acceptance checks rely on grep heuristics that may miss semantic mismatches.

**Suggestions**
- Prefer staging-only environment for symbolication test if available; if not, add explicit timebox and coordination window.
- Clarify rollback policy as “same PR as verification doc update” instead of “same commit.”
- Replace hard count threshold with per-REQ evidence checklist artifact (machine-readable table).
- Keep evidence links in a dedicated audit section instead of inline per-row comments to reduce clutter.

**Risk Assessment**  
**MEDIUM-HIGH** — essential work but highest operational/process risk among plans.

---

## Cross-Plan Assessment (Wave/Scope/Security)

**Summary**  
Wave 2 dependency chain (`06-02 -> 06-02b -> 06-02c -> 06-02d`) is correct and logically sequenced. GDPR approach (bundled consent + global no-geo + default-off) is defensible and aligned with user constraints. Main residual risks are manual-verification reliability and deliberate-production-error handling.

**Strengths**
- Strong separation of concerns across foundation, wiring, UI, and smoke verification.
- Minimal scope creep overall; stays launch-hardening focused.
- Security posture mostly improved (DEV-only debug, token truncation, no new secrets/env).
- Plans generally map cleanly to D-01..D-10 must-haves.

**Top Risks**
- **HIGH:** Prod smoke-error procedure governance in `06-04`.
- **MEDIUM:** Manual auth root-cause closure might remain inconclusive despite good instrumentation.
- **MEDIUM:** GDPR “no events before consent” depends on runtime checks and manual dashboard confirmation; automation is limited.

**Overall Phase Risk**  
**MEDIUM** — well-designed plans with strong compliance intent and ordering, but success depends on careful execution of manual gates and disciplined handling of the D-08 production verification path.

---

### CodeRabbit

> CodeRabbit reviews git diffs against the working tree. Phase 6 plans were already committed cleanly (commit `662a978`), so the working tree was empty and CodeRabbit produced no review. To get CodeRabbit feedback, stage the plan changes locally without committing first, or run `/gsd-review --phase 6 --coderabbit` immediately after the next code-modifying commit during execution.

Raw output:

```
╔═══════════════════════════════════════════╗
║                                           ║
║   New update available! 0.4.1 -> 0.4.3    ║
║          Run: coderabbit update           ║
║                                           ║
╚═══════════════════════════════════════════╝

Starting CodeRabbit review in plain text mode...

Review directory: /Users/khaiphan/code/wtcs-community-polls

```
