# Phase 6: Auth fix, GDPR opt-IN rewire, favicon polish, and launch hardening - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

A v1.0 cleanup pass on top of the Phase 5 launch. Four scope buckets:

1. **Auth regression fix** — diagnose and fix a Discord OAuth login error that reproduces in the user's main browser but NOT in incognito on the same machine. Symptom-only; root cause unknown.
2. **GDPR opt-IN rewire** — invert Phase 5's opt-OUT analytics/Replay consent model. PostHog analytics and Sentry Session Replay must be DISABLED until the user explicitly opts in.
3. **Favicon and title polish** — replace the Vite scaffold favicon and the lowercase-slug `<title>` with WTCS-branded equivalents.
4. **Residual launch-hardening cleanup** — close the only remaining 05-VERIFICATION human-verification item (Sentry sourcemap symbolication) and sync REQUIREMENTS.md status fields against actual phase completion.

**This phase does NOT add product features.** No new suggestion types, no admin tooling, no v2 work. Scope is launch-hardening cleanup only. The 9th Phase 4 UAT test (cross-account verification requiring a second human) is explicitly out of scope — non-blocking, accepted as-is.

</domain>

<decisions>
## Implementation Decisions

### Auth Bug Fix

- **D-01:** **Diagnose-first strategy.** Add Sentry breadcrumbs around the entire auth flow (AuthContext mount, Supabase session resolution, OAuth callback handler, AuthErrorPage render path) and a temporary dev-only `?debug=auth` URL query that surfaces a panel with: current Supabase session shape, all `sb-*` cookies, all `sb-*` localStorage keys, last 5 Sentry breadcrumbs, and any console errors captured in the last 30s. Capture this state from the user's main browser, identify root cause, ship a targeted fix. Do NOT ship a guess. The escape-hatch ("Clear stuck session" button) is explicitly **deferred** — only revisit if root cause turns out to be unfixable in code (e.g., a class of browser extension we can't influence).

- **D-02:** **Manual repro is the FIRST plan task.** Before any code change, the planner must include a manual reproduction checklist in the user's main browser:
  1. Clear cookies + localStorage for `polls.wtcsmapban.com` and the Supabase project URL.
  2. Disable browser extensions one at a time, with priority for privacy/cookie blockers (uBlock Origin, Privacy Badger, Firefox Multi-Account Containers, Brave Shields if applicable).
  3. Check the browser's third-party-cookie setting — Safari ITP and Firefox ETP block third-party cookies aggressively, and Supabase's auth flow uses cross-site cookies between the app domain and the Supabase project domain.
  4. Try a second main-browser profile to rule out account-state corruption.

  If any step in (1)–(4) resolves the symptom, the bug is environmental, not a code defect. In that case the diagnose-first work still ships (Sentry breadcrumbs are launch hygiene regardless), but code-level investigation can be scoped down. The escape-hatch question gets revisited as a deferred idea, NOT folded into Phase 6.

### GDPR Opt-IN Rewire

- **D-03:** **First-visit non-blocking banner + persistent flipped footer chip.** On a user's first visit (no consent decision recorded), show a small non-blocking banner with text along the lines of "We can record anonymous usage to help us improve this site. [Allow] [Decline]." The banner is dismissible and the choice is remembered. After dismissal, the existing `ConsentChip` (built in Phase 5) stays in the footer for users to change their mind — but its wording inverts: from the current "Opt out" framing to a "Manage privacy / Allow analytics" framing depending on current state.

- **D-04:** **Default state is OFF for both PostHog and Sentry Replay until consent.** Neither library may initialize, identify users, capture events, or record replays before the user clicks Allow. This is the structural change behind D-03 — refactor `src/lib/posthog.ts`, `src/lib/sentry-replay.ts`, and `src/main.tsx` so init is gated on a consent-state value, not unconditional. `AuthContext`'s `posthog.identify()` call (Phase 5 D-13) must also gate on consent.

- **D-05:** **Bundled consent — one Allow/Decline covers both.** PostHog event analytics and Sentry Session Replay are governed by a single consent decision. No separate toggles for v1.0. (Sentry **error** capture is NOT gated — error capture is operationally necessary and PII-free since user identifiers were already restricted to a Discord ID hash per Phase 5 D-13.)

- **D-06:** **Global opt-IN — no geo-detection.** Same UX worldwide; same default-OFF state for everyone. Do NOT branch on Netlify country headers, Cloudflare CF-IPCountry, or any geo signal. Rationale: defensible privacy posture, zero geo-detection complexity, no false negatives if EU users are behind VPN/proxy (memory: Russian users routinely use VPN; same architectural assumption applies to EU edge cases). Accept the tradeoff that non-EU users who would have stayed opted-in under the Phase 5 opt-OUT model now don't appear in analytics — at 300-400 weekly users the analytics value is catastrophic-bug detection, not engagement metrics.

### Cleanup Items

- **D-07:** **Favicon replacement.** Replace `public/favicon.svg` with a WTCS-branded favicon set generated from `src/assets/wtcs-logo.png`. Plan should produce: 16x16 + 32x32 PNG variants (or one optimized SVG that renders cleanly at small sizes), 180x180 PNG for `apple-touch-icon`, and updated `<link rel="icon">` tags in `index.html`. If the logo doesn't render on both light and dark browser chrome, generate dark-mode variant via `<link rel="icon" media="(prefers-color-scheme: dark)" ...>`. Source filetype workflow (real-favicon-generator vs hand-crafted SVG) is Claude's discretion.

- **D-08:** **Sentry symbolicated stack-trace verification.** Trigger a real production error (e.g., a one-shot throw behind an admin-only debug route, or a deliberate malformed payload to an EF that bubbles to Sentry), then confirm in the Sentry UI that the resulting issue shows un-minified function names and source-map-resolved line numbers. Closes the only remaining open item in the `05-VERIFICATION` `human_verification` list. Roll back the deliberate-error path immediately after verification — no test artifacts left in main.

- **D-09:** **REQUIREMENTS.md status sync.** Audit `REQUIREMENTS.md` and update the Status column for v1 requirements that actually shipped in Phases 1–5 but were never marked Complete. Likely candidates from a quick scan: AUTH-01/02/04/05, ADMN-01, VOTE-01/02/03, RSLT-01/02/03/04/05, CATG-02/03/04, UIDN-01/02/03, INFR-03/04, TEST-01/02/03/04. Audit happens during planning; status updates are one atomic commit per file. Match against the relevant phase's UAT/VERIFICATION evidence — don't mark Complete on assumption.

- **D-10:** **`index.html` title + meta description polish.** Replace `<title>wtcs-community-polls</title>` (current — a lowercase slug, scaffold-grade) with `<title>WTCS Community Suggestions</title>`. Add a `<meta name="description">` of roughly: "Share opinions on War Thunder Competitive Scene proposals. Verified Discord identity, one response per account, transparent results." Honor PROJECT.md terminology — user-facing surface uses "suggestions/topics/opinions/responses", not "polls/votes". Exact phrasing is Claude's discretion within the ~155-char SEO budget.

### Claude's Discretion

- Exact `?debug=auth` overlay UI (table vs JSON dump vs collapsible panel) and how it gets stripped from production builds (env-gated import vs Vite define vs runtime check).
- Sentry breadcrumb category/level naming for the auth flow (single `category: "auth"` vs sub-categories like `auth.session`, `auth.callback`).
- Banner copy exact wording: "Allow" vs "Yes" vs "Got it" — keep direct, no exclamation marks (PROJECT.md tone).
- Banner dismissal storage mechanism: `localStorage` key vs cookie. Prefer `localStorage` to avoid contributing to the same cross-site-cookie surface this phase is fixing.
- Favicon generation tooling: real-favicon-generator vs `vite-plugin-favicons` vs hand-crafted SVG.
- Whether to add a separate `/privacy` page linked from the consent banner, or keep privacy details inline in the banner copy. Default = inline, no new route.
- Sentry sourcemap-verification trigger mechanism — admin-only debug route vs deliberate EF malformed-payload vs one-time CI smoke test.

### Folded Todos

None — no pending todos matched Phase 6 scope when checked via `gsd-sdk query todo.match-phase 6`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Discord OAuth lock, $0/mo budget, "opinions not votes" framing, user-facing vs internal terminology rules, design system lock (Maia/Neutral/Inter)
- `.planning/REQUIREMENTS.md` — v1 status tracker (D-09 update target)
- `.planning/STATE.md` — Roadmap Evolution entry for Phase 6 (added 2026-04-25)
- `.planning/ROADMAP.md` — Phase 6 entry (Goal/Plans currently TBD)

### Prior Phase Context (Decisions That Carry Forward)
- `.planning/phases/01-foundation-authentication/01-CONTEXT.md` — D-02 (avatar dropdown), D-05/06/07 (auth error tone — direct, no-hype), AuthContext as the single mount point for analytics identify
- `.planning/phases/05-launch-hardening/05-CONTEXT.md` — **D-13 is the direct predecessor of this phase's GDPR work** (the opt-OUT model being inverted). D-12 (env-var layout, including `VITE_SENTRY_DSN` and `VITE_POSTHOG_KEY`) governs how the new gated init reads its config.
- `.planning/phases/05-launch-hardening/05-VERIFICATION.md` — `human_verification:` frontmatter; Sentry sourcemap upload is the only item still open (D-08 target).

### Codebase Maps
- `.planning/codebase/CONVENTIONS.md` — naming patterns, code style, import organization
- `.planning/codebase/STRUCTURE.md` — directory layout, where to add new code
- `.planning/codebase/STACK.md` — installed dependencies and versions
- `.planning/codebase/INTEGRATIONS.md` — external service integration map (Supabase, PostHog, Sentry, Discord, Netlify)

### Auth Bug Investigation Targets
- `src/contexts/AuthContext.tsx` — Supabase session resolution, user identification, primary instrumentation site for D-01 breadcrumbs
- `src/routes/auth/` — OAuth callback handler
- `src/components/auth/AuthErrorPage.tsx` — error variant rendering (NOT modified in v1.0 — escape-hatch deferred per D-01)
- `src/components/auth/AuthGuard.tsx` — route-level auth gate
- `src/hooks/useAuth.ts` — auth state consumer hook
- `src/lib/auth-helpers.ts` — auth utility functions

### GDPR Opt-IN Rewire Targets
- `src/components/ConsentChip.tsx` — flip from opt-OUT to gated opt-IN; primary visible UI change
- `src/lib/posthog.ts` — gate `posthog.init()` behind consent state (D-04)
- `src/lib/sentry.ts` — error capture stays unconditional (D-05); only Replay piece is gated
- `src/lib/sentry-replay.ts` — gate replay integration behind consent state (D-04)
- `src/main.tsx` — relocate PostHog/Replay init/mount behind consent provider (D-04)
- `src/contexts/AuthContext.tsx` — `posthog.identify()` call must check consent before firing (D-04)
- `src/__tests__/components/ConsentChip.test.tsx` — existing test suite to update for inverted state machine

### Favicon + Title Polish Targets
- `public/favicon.svg` — replacement target (D-07)
- `src/assets/wtcs-logo.png` — source image for the favicon set
- `index.html` — `<link rel="icon">` tags (D-07), `<title>` and `<meta name="description">` (D-10)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ConsentChip` component** (Phase 5) — already wired into the footer; this phase inverts its state-machine and copy rather than rebuilding it.
- **`AuthContext`** — already the single mount point for `posthog.identify()` per Phase 5 D-13. Adding a consent gate here is one-touch.
- **`src/assets/wtcs-logo.png`** — already used in the navbar (Phase 1); same source for favicon set.
- **Sentry SDK + breadcrumbs API** — already initialized in `src/lib/sentry.ts` from Phase 5; D-01 only adds breadcrumbs, no new dependency.
- **shadcn `Sonner` toast + Card** — available for any UX surface needed by the consent banner (Card variant) or post-fix verification toasts.

### Established Patterns
- **`VITE_*` env-var prefix** for client-readable config (Phase 5 D-12). No new env vars needed in Phase 6 unless a privacy-policy-page URL becomes a config value.
- **AuthContext as the analytics mount point** — keep this single-source-of-truth pattern when gating `identify()`.
- **`docs/screenshots/` lives in repo** (Phase 5 D-15) — useful if README needs a refreshed screenshot showing the new favicon/title.
- **Husky pre-commit + lint-staged with `--no-warn-ignored`** (Phase 4) — keep it green when adding new tests for the rewired ConsentChip.

### Integration Points
- **Sentry dashboard** (out-of-repo) — D-08 verification happens here, not in code. Plan task includes "Open Sentry issue UI, screenshot, attach to verification entry."
- **PostHog dashboard** (out-of-repo) — confirm zero events flow before consent under D-04. Sanity-check during plan execution.
- **Discord OAuth flow + Supabase Auth UI** — D-02's manual-repro happens against the real prod URL, not local dev (the bug only reproduces against prod cookies).
- **`netlify.toml`** (Phase 5) — does NOT need to change for this phase unless the favicon set introduces new caching headers.

### Creative Options the Architecture Enables
- A consent-state hook (e.g., `useConsent()`) wrapping `localStorage` with a React context could become the single source of truth, then `posthog.ts`/`sentry-replay.ts`/`AuthContext` all subscribe — cleaner than ad-hoc localStorage reads.
- The `?debug=auth` overlay can be a tiny standalone component lazy-loaded only when the query param is present, so it adds zero bundle cost in normal use.

</code_context>

<specifics>
## Specific Ideas

- **Auth bug only reproduces in the user's main browser, not incognito on the same machine.** This is a hard constraint on diagnosis: anything that's identical between the two browser modes (server, network, account, IP) can be ruled out. The differential is necessarily client-side state — cookies, localStorage, service workers, extensions, profile-level settings. The diagnose-first plan must focus there.
- **Phase 4 UAT 9th test is OUT of scope.** Cross-account verification requires a second human; user has accepted this is non-blocking and not Phase 6 work. Do not surface it as a planning gap.
- **GDPR opt-IN is the user's compliance line, not just polish.** Memory `feedback_gdpr_consent.md` makes this explicit — it's a known compliance gap from Phase 5, not a nice-to-have. Treat as a launch-blocker for the v1.0 milestone close.
- **Banner tone follows Phase 1 D-06.** Direct but helpful. No exclamation marks. No hype. Example acceptable wording: "We can record anonymous usage to help us improve this site." Example unacceptable: "Help us make this awesome! 🎉"
- **Russian users use VPN.** No geo-detection in this app, including for consent (D-06). Architectural consistency with the rest of the app — never branch on country.
- **Sentry error capture is NOT gated.** Only Replay is. Errors are PII-free under Phase 5 D-13 (Discord ID hash only) and operationally necessary for the launch.

</specifics>

<deferred>
## Deferred Ideas

- **"Clear stuck session and retry" escape-hatch button on AuthErrorPage** — considered in Area 1 discussion, deferred per D-01. Revisit only if D-01 diagnosis reveals an unfixable-in-code root cause (e.g., a class of browser extension we can't influence).
- **Separate granular toggles for analytics vs replay** — considered in GDPR area, rejected for v1.0 per D-05 in favor of bundled consent. Future v2 candidate if user feedback asks for finer control.
- **EU-only opt-IN with default-ON elsewhere** — considered as an analytics-preserving alternative, rejected per D-06. Architecture would still allow it as a future experiment if global opt-IN drops analytics signal below a usable floor.
- **Discord webhook on auth failure or consent change** — out of scope; aligns with Phase 5 D-03 deferral of all Discord-webhook integrations to a future phase.
- **`/privacy` page as a separate route** — Claude's-discretion call in this phase; default is inline copy in the banner. If planner surfaces value (e.g., for a "Read more" link), they can promote it during planning.

</deferred>

---

*Phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden*
*Context gathered: 2026-04-25*
