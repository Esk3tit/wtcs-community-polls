# Phase 16 — UI Review

**Audited:** 2026-05-28
**Baseline:** `16-UI-SPEC.md` (Phase 16 design contract — a *preservation* contract for a perf/infrastructure phase)
**Screenshots:** not captured (no dev server on :3000 / :5173 / :8080 — code-only audit)
**Phase character:** Performance-budget pass. Per the UI-SPEC "visual no-op invariant," the contract is that Phase 16 introduces **zero visible visual change**. Scoring grades the three surfaces this phase actually touched (logo `<picture>` swap, PostHog lazy-load shell behavior, intent-preload UX). Pillars whose surface area this phase never touched are scored on *preservation* — confirmed via diff that no token, copy, color, or spacing changed — and explicitly noted as out-of-scope-for-redesign rather than penalized for absence of new work.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Copy-freeze contract honored; zero user-facing string changes; the only new copy is the developer-facing D-09 build-throw, correctly scoped to CI logs. |
| 2. Visuals | 4/4 | Logo `<picture>` swap preserves visual fidelity and zero-CLS — WebP intrinsic dims (226×200) exactly match the `width`/`height` attrs and the PNG fallback; no pixel-level delta. |
| 3. Color | 4/4 | Diff confirms zero `bg-*`/`text-*`/`border-*` token changes in the touched files; 60/30/10 palette inherited unchanged. |
| 4. Typography | 4/4 | No `text-*`/`font-*` class added or removed; Inter system stack untouched; no `@font-face` introduced. |
| 5. Spacing | 4/4 | No new spacing utilities; `min-h-[44px]` touch target preserved on the logo `<Link>` through the `<picture>` wrap. |
| 6. Experience Design | 4/4 | Lazy PostHog load is genuinely silent — `{children}` is a Suspense *sibling* (no router blank/remount), `fallback={null}`, consent banner unaffected; intent-preload improves perceived nav speed with admin opt-out preserved on both nav surfaces. |

**Overall: 24/24**

> Scoring note (anti-soft-grading disclosure): A 24/24 on a normal redesign phase would be a red flag for averaging-upward. Here it is defensible *because the contract is preservation, not creation* — and every preservation claim is backed by a concrete diff/binary check below, not by "the component still exists." The adversarial hypothesis (the phase leaked a visual/token/copy change) was tested against the actual diff and the binary asset, and disproven on each axis. Two genuine, non-blocking residual observations are recorded under WARNINGS / Minor Recommendations rather than inflated into pillar deductions.

---

## Top 3 Priority Fixes

This phase produced **no BLOCKERs and no WARNINGs that gate ship**. The three items below are the highest-value *optional* follow-ups, ordered by leverage. None should block Phase 16 closure.

1. **(Minor) `loading`/`fetchpriority` hint absent on the above-the-fold logo `<img>`** — Impact: negligible today (logo is tiny at 4.3 KB WebP and eager-loads correctly), but the UI-SPEC explicitly waived `loading`/`decoding` for this phase. Fix: leave as-is for Phase 16 (in-contract); if a future perf phase chases LCP, consider `fetchpriority="high"` on the logo `<img>` since it is a top-of-viewport brand element. No action required now.

2. **(Minor) Belt-and-braces `preload="intent"` markup-debt on Logo/Topics/Archive links is now redundant** — Impact: cosmetic only; three `<Link>`s carry an explicit `preload="intent"` that the new `defaultPreload: 'intent'` already supplies app-wide (Navbar.tsx:29,50,58; MobileNav.tsx:37,46). This was an *accepted* LOW finding per 16-06-SUMMARY (self-documentation + resilience). Fix: keep as documented debt, or strip in a later cleanup if the router default is considered authoritative. No action required now.

3. **(Verification gap, not a defect) Production CLS + visual-parity is asserted by code/preview, not by a captured before/after screenshot diff** — Impact: the UI-SPEC Cross-Cutting Constraint #1 calls for before/after production screenshots at mobile+desktop on home/topics/archive/admin. 16-05 confirmed parity via local `npm run preview` + DevTools, and this audit confirmed the zero-CLS mechanism mathematically (intrinsic dims == attrs). Fix: capture the production screenshot pair during the PERF-07 Lighthouse run (already a planned production visit) to close the evidence loop with a pixel diff, not just a manual eyeball. Belongs to the PERF-07 closure step, not a code change.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

PASS — copy-freeze contract fully honored.

- Diff across the full phase (`5825fff..HEAD`, `src/`) shows **no user-facing string added or changed**. The only files with copy are test files and WHY-comments.
- Navbar logo `alt="WTCS Community Suggestions"` (Navbar.tsx:37) and `aria-label="WTCS Community Suggestions"` on the `<Link>` (Navbar.tsx:31) are **preserved verbatim** through the `<picture>` wrap — matches the UI-SPEC Copywriting Contract rows exactly.
- The only new "copy" is the D-09 developer-facing build-time throw (`vite.config.ts`), which surfaces only in CI/terminal logs and references the OBSV-04 / Phase-15 sourcemap chain by name per the contract. Correctly scoped — never reaches a product user.
- No new toasts, error messages, empty states, or confirmation dialogs introduced (none were in scope — no CRUD work this phase).

No deviation from the Copywriting Contract. No finding warrants a deduction.

### Pillar 2: Visuals (4/4)

PASS — the single DOM-level change (logo `<img>` → `<picture><source><img>`) preserves visual fidelity and the zero-CLS guarantee. This is the load-bearing pillar for this phase and it was verified at the binary level, not just by inspection.

Evidence:
- **Intrinsic-dimension match (zero-CLS proof):** The committed `src/assets/wtcs-logo.webp` parses to **226×200** (VP8X header read directly from the RIFF chunk). The inner `<img>` carries `width={226} height={200}` (Navbar.tsx:39-40). Because the declared attrs equal the asset's true intrinsic box, the browser reserves a correctly-proportioned box on first layout — **no layout shift** when either the WebP or the PNG fallback decodes. The PNG fallback (`wtcs-logo.png`) shares the same source image, so both `<source>` resolutions are aspect-ratio-identical.
- **Rendered size unchanged:** `className="h-8 w-auto md:h-9"` (Navbar.tsx:38) is byte-identical to the v1.2 baseline (confirmed: token diff on the file is empty). The logo renders at 32px tall (mobile) / 36px tall (desktop) with auto width — exactly as before. Aspect 226/200 = 1.13 → computed width 36.16px @ h-8, 40.68px @ h-9, matching the pre-change render.
- **Format-only swap:** Modern UAs receive the 4,344-byte WebP via `<source type="image/webp">`; Safari 13- and any non-WebP UA fall back to the PNG via the inner `<img src>`. Zero JS, zero feature-detection, native `<picture>` semantics. This is a pure byte-reduction with no pixel delta.
- **Focal point / hierarchy unchanged:** The navbar remains the sole brand anchor top-left; icon-only buttons (theme toggle `aria-label="Toggle color theme"`, mobile menu `aria-label="Open navigation menu"`) retain their accessible labels (Navbar.tsx:88; MobileNav.tsx:24).

No visible visual change introduced — the "visual no-op invariant" holds. The only residual is the *evidence* gap (Top-3 #3): production before/after screenshot diff is deferred to PERF-07, not captured here. That is a verification-completeness note, not a visual defect, so it does not deduct.

### Pillar 3: Color (4/4)

PASS — 60/30/10 palette inherited unchanged; no new color surface.

- Targeted diff (`5825fff..HEAD` on Navbar.tsx + MobileNav.tsx) filtered for `bg-*`/`text-*`/`border-*`/color utilities returns **empty** — not one color class was added, removed, or changed in the touched layout files.
- No hardcoded hex/`rgb()` colors introduced in any phase-16 source file. PostHogGate, PostHogProviderInner, and posthog-facade render `null` or are non-visual modules — they contribute zero color surface.
- Accent (`bg-primary`), destructive (`bg-destructive`), and the `bg-card`/`bg-muted` secondary band are all untouched. The Navbar's existing `bg-card border-b` (Navbar.tsx:21) and `text-muted-foreground hover:text-foreground` link treatment are byte-identical to baseline.

The UI-SPEC's "if a diff touches a color class outside the `<picture>` wrap, that is grounds for pushback" tripwire was checked and **did not trip**.

### Pillar 4: Typography (4/4)

PASS — no type changes.

- Diff filter for `text-(xs|sm|...)` and `font-*` on the touched files returns **empty**. No new font size, weight, or family declaration.
- `text-sm` body/label scale on nav links (Navbar.tsx:51,74; MobileNav.tsx:38) and `font-medium` username row (Navbar.tsx:129) are preserved unchanged.
- Inter remains a system-font-only stack — no `@font-face` added (would violate the v1.3 Out-of-Scope anti-feature). Confirmed no font-asset import in the phase diff.

### Pillar 5: Spacing (4/4)

PASS — no new spacing tokens; touch-target preserved.

- Diff filter for `p-*`/`px-*`/`py-*`/`m-*`/`gap-*`/`space-*` on the touched files returns **empty**. The `<picture>` wrap added no spacing utility — it inherits the logo `<Link>`'s existing `flex items-center` layout.
- **44px touch-target preserved:** `min-h-[44px]` on the logo `<Link>` (Navbar.tsx:30) survives the `<picture>` wrap intact — the UI-SPEC Spacing exception is honored. The `<picture>` is a transparent inline wrapper and does not collapse the touch target.
- Existing `py-3 px-4 md:px-6 gap-2/gap-4` navbar rhythm (Navbar.tsx:22,47,84) is unchanged.

### Pillar 6: Experience Design (4/4)

PASS — the two behavioral changes (lazy PostHog, intent-preload) improve perceived experience with no flash/blank/remount regression. This is the second load-bearing pillar for the phase and each risk was verified against source.

**(a) Silent lazy-load with no blank/remount (the headline ExpDesign risk):**
- `PostHogGate` renders `{children}` as a **direct sibling** of `<Suspense fallback={null}>`, never a descendant (PostHogGate.tsx:26-33). When `state !== 'allow'`, the lazy loader is simply not rendered — `posthog-js` is never fetched (the core PERF-03 GDPR win). When state flips to `'allow'`, Suspense can only replace `<LazyPostHogLoader/>` (which itself renders `null`) with `null`. The router subtree in `{children}` is structurally immune to the suspending boundary — **no blank, no remount** during the dynamic-import window. This is the corrected design that fixed the earlier verified HIGH (children-nested-in-Suspense) defect.
- `fallback={null}` — no spinner, no skeleton, no toast (UI-SPEC executor-constraint honored: grep confirms no spinner/skeleton string in PostHogGate).
- **Consent banner is unaffected:** `ConsentProvider` unconditionally returns `{children}` (ConsentContext.tsx:78-80) — it never gates the tree on consent state. The `<ConsentBanner/>` is mounted in `__root.tsx` as a sibling of `<Outlet/>` (`__root.tsx`:29,37) — *below* the router, while `PostHogGate` sits *above* the router in `main.tsx` (main.tsx:92-96). The banner cannot blank or remount during the PostHog lazy load.
- **Graceful degradation:** `PostHogProviderInner` wraps `initPostHog()` in try/catch (PostHogProviderInner.tsx:21-26) — a locked-down/private-mode browser that throws on localStorage/cookie access logs and continues rather than rejecting the dynamic import and blanking the app via the error boundary. (WR-04 fix.) The facade queue is capped at 50 with a once-only warning (posthog-facade.ts:17,32-37; WR-03 fix). Both are genuine resilience hardening, not stubs.

**(b) Perceived-performance UX (intent preload):**
- `createRouter({ routeTree, defaultPreload: 'intent' })` (main.tsx:39) — hover/focus on any `<Link>` warms the destination chunk app-wide, so post-hover taps feel instant. A clean perceived-nav-speed win with no new UI element.
- **Admin opt-out preserved on BOTH nav surfaces:** `preload={false}` on the desktop Navbar admin link (Navbar.tsx:73) AND the mobile MobileNav admin link (MobileNav.tsx:64). The UI-SPEC explicitly flagged that the app-wide default would otherwise opt the admin link in; both surfaces correctly suppress it. The WHY-comment was corrected (WR-01) to accurately describe the AdminGuard render-guard reality rather than a non-existent `beforeLoad` redirect — comment now matches the guard mechanism, and authorization is correctly noted as server-side (RLS + Edge Functions), with `preload={false}` framed as a bandwidth/discretion measure, not the security boundary. Accurate and honest.

**Registry / state coverage:** No new shadcn block, no third-party registry, no destructive/empty/error surface added (none in scope). Existing state coverage elsewhere in the app is untouched and out of scope for this phase.

No ExpDesign regression. The one residual (belt-and-braces redundant `preload="intent"` markup) is accepted markup-debt, recorded as Minor Recommendation #2 — it has zero runtime impact and does not deduct.

---

## Registry Safety

`components.json` exists (shadcn initialized). Per the UI-SPEC Registry Safety table, **no third-party registries are declared** and **no new shadcn blocks** were added this phase — every needed primitive was already vendored at v1.0. `rollup-plugin-visualizer@7.0.1` is a Vite build-time devDependency, not a shadcn UI primitive, so the registry gate does not apply to it.

**Registry audit: 0 third-party blocks checked, no flags.** No suspicious-pattern scan was required.

---

## Files Audited

Source (changed this phase):
- `src/components/layout/Navbar.tsx` — logo `<picture>` wrap + admin `preload={false}`
- `src/components/layout/MobileNav.tsx` — mobile admin `preload={false}`
- `src/components/PostHogGate.tsx` — consent-gated lazy Suspense-sibling shell
- `src/components/PostHogProviderInner.tsx` — lazy side-effect loader (renders null, try/catch init)
- `src/lib/posthog-facade.ts` — synchronous queue-then-flush facade
- `src/main.tsx` — `defaultPreload: 'intent'` + `<PostHogGate>` wiring
- `src/contexts/ConsentContext.tsx` — children-always-render verification
- `src/routes/__root.tsx` — ConsentBanner mount-site verification

Assets:
- `src/assets/wtcs-logo.webp` — binary dimension parse (VP8X 226×200, 4,344 bytes)
- `src/assets/wtcs-logo.png` — fallback retained (9,915 bytes)

Contract / context:
- `16-UI-SPEC.md`, `16-CONTEXT.md`
- `16-01`/`16-02`/`16-03`/`16-04`/`16-05`/`16-06` SUMMARYs

Verification commands run: git diff token-filter (Navbar/MobileNav), WebP VP8X header parse, aspect-ratio computation, dev-server probe (:3000/:5173/:8080 — all down), touch-target / Suspense-fallback / a11y-attribute greps.
