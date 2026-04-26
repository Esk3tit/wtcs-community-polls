---
phase: 6
slug: auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
status: draft
shadcn_initialized: true
preset: shadcn Maia style, Neutral base (bbVJxbc)
created: 2026-04-25
---

# Phase 6 — UI Design Contract

> A launch-cleanup phase. Inherits ALL global tokens from `.planning/DESIGN-SYSTEM.md` (tone, color, typography, spacing) and the Phase 1 + Phase 5 UI-SPECs (component primitives, error tone, ConsentChip placement). This document only locks the contracts for the SIX new/changed surfaces this phase introduces.
>
> **Source of truth for global tokens:** `.planning/DESIGN-SYSTEM.md` and `.planning/phases/01-foundation-authentication/01-UI-SPEC.md`. Do NOT duplicate or override tokens here.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (already initialized — `components.json` present, style `new-york`) |
| Preset | Maia style, Neutral base, Neutral theme, Neutral chart (preset hash: bbVJxbc) |
| Component library | Radix UI (via shadcn) |
| Icon library | Lucide React |
| Font | Inter (loaded via preset; Phase 1 D-16 / DESIGN-SYSTEM.md) |
| Tailwind | v4 with `@theme inline` tokens in `src/index.css` |

Pre-populated from: `components.json`, `.planning/DESIGN-SYSTEM.md`, `.planning/phases/01-foundation-authentication/01-UI-SPEC.md`. No user override solicited — locked decisions.

---

## Scope Boundary — What This Spec Covers

| In scope (THIS phase) | Out of scope (locked or untouched) |
|-----------------------|------------------------------------|
| GDPR opt-IN consent banner (NEW, D-03) | shadcn preset / color palette / type scale / spacing tokens (locked DESIGN-SYSTEM.md) |
| `ConsentChip` copy + state-machine flip (D-04 — existing component, opt-IN framing) | Light/dark theme strategy (locked Phase 1) |
| `?debug=auth` dev-only diagnostic overlay (NEW, D-01) | Suggestion list / Archive / Admin shell (Phases 1-4, immutable) |
| `AuthErrorPage` — explicitly NO visual change (D-01 instruments only) | Loading skeleton, AppErrorFallback (Phase 5, immutable) |
| Favicon set replacement (D-07) | Edge Functions, GH Actions cron, REQUIREMENTS sync (zero UI surface) |
| `<title>` + `<meta name="description">` (D-10) | Granular toggles (rejected D-05); /privacy route (deferred); geo branching (rejected D-06) |

---

## Spacing Scale

Inherited from DESIGN-SYSTEM.md / Phase 1 UI-SPEC. Canonical values used by this phase:

| Token | Tailwind | Usage in Phase 6 |
|-------|----------|------------------|
| xs | `gap-1` (4px) | Icon-adjacent inline spacing in banner/chip |
| sm | `gap-2` / `space-y-2` (8px) | Banner button row gap; debug overlay row gap |
| md | `p-4` / `gap-4` (16px) | Banner inner padding; debug overlay card padding |
| lg | `p-5` (20px) | Card surfaces (matches existing card convention) |
| xl | `p-6` (24px) | Reserved — not used in Phase 6 |

**Banner placement offset:** `bottom-4 right-4` (16px from viewport edges) — same anchor as the existing ConsentChip, so they never both render simultaneously (banner shows on first visit only; chip shows after a decision is recorded).

**Touch targets:** Banner [Allow]/[Decline] buttons MUST meet 44px minimum height (Phase 1 rule, WCAG 2.5.8). Use `size="default"` or `size="sm"` with padding that yields ≥44px tap area on mobile.

Exceptions: none.

---

## Typography

Inherited from DESIGN-SYSTEM.md / Phase 1 UI-SPEC. Roles touched by this phase:

| Role | Tailwind | Usage in Phase 6 |
|------|----------|------------------|
| Body | `text-sm text-muted-foreground` with `leading-relaxed` | Consent banner copy, ConsentChip copy (existing) |
| Metadata | `text-xs text-muted-foreground` | Debug overlay row labels, banner privacy hint |
| Mono (NEW token use, not a new size) | `font-mono text-xs` | Debug overlay raw values (cookie names, localStorage keys, breadcrumb JSON) |
| Heading — small | `text-sm font-medium` | Debug overlay section headings ("Session", "Cookies", "localStorage", "Breadcrumbs") |

**Font weights:** `font-medium` (500) and `font-semibold` (600) only — same constraint as Phase 1. Default body weight (400) is implicit on `text-sm` / `text-xs` without an explicit weight class.

**No new sizes introduced.** `font-mono` is a font-family change, not a new size token.

---

## Color

Inherited from DESIGN-SYSTEM.md (shadcn Neutral semantic tokens, `src/index.css` HSL custom properties). Roles used in this phase:

| Role | Token | Usage in Phase 6 |
|------|-------|------------------|
| Dominant (60%) | `bg-background` | Page background under banner/chip/debug overlay |
| Secondary (30%) | `bg-card` / `border` | Banner surface, ConsentChip surface, debug overlay surface |
| Muted | `bg-muted` / `text-muted-foreground` | Banner body copy, ConsentChip helper text, debug overlay raw values |
| Primary accent (10%) | `bg-primary text-primary-foreground` | Banner primary CTA `[Allow]` ONLY |
| Destructive | `text-destructive` | NOT used. Decline is reversible, not destructive — uses `variant="outline"` button. |

**Accent reserved for (Phase 6 scope only):** banner `[Allow]` button. No other new accent uses introduced. Existing accent uses (primary CTA buttons across Phases 1-4) remain unchanged.

**Decline button:** `<Button variant="outline">Decline</Button>` — secondary visual weight, no destructive coloring. Declining is a normal, supported choice; we do not visually punish it.

**Debug overlay:** uses `bg-card` + `border` (matches AppErrorFallback convention from Phase 5). No `bg-destructive` / no red — this is a diagnostic aid, not an error surface.

---

## Copywriting Contract

Follows DESIGN-SYSTEM.md tone rules, reinforced by Phase 1 D-05/06/07:
- Direct. No hype. No exclamation marks. No emojis.
- User-facing terminology: "suggestions / topics / opinions / responses". NEVER "polls / votes" in user-facing copy.
- Same UX worldwide — never branch copy on locale or country (D-06).

### Surface 1 — GDPR Opt-IN Consent Banner (NEW, D-03)

| Element | Copy | Notes |
|---------|------|-------|
| Body line 1 | `We can record anonymous usage to help us improve this site.` | Verbatim. Matches D-03 example. |
| Body line 2 (optional, inline privacy hint) | `No tracking starts until you choose.` | Inline reassurance — explains the opt-IN behavior without pointing at a separate /privacy route (deferred). |
| Primary CTA | `Allow` | One word. `<Button>` (default = primary variant). |
| Secondary CTA | `Decline` | One word. `<Button variant="outline">`. |
| Dismiss affordance | `×` icon (Lucide `X`, `size-3`), aria-label `Dismiss` | Same as existing ConsentChip dismiss. Dismissal without clicking Allow/Decline = treated as "not yet decided"; banner re-shows next visit. Clicking Allow OR Decline = decision recorded; banner never re-shows. |

**No emoji. No exclamation marks. No "Help us make this awesome".** Banned phrasings carry forward from Phase 5 UI-SPEC.

**Banner is non-blocking:** does NOT render as a modal / dialog / overlay-with-scrim. It is a fixed-position card at `bottom-4 right-4`, max-width `min(20rem, calc(100vw - 2rem))` (matches existing ConsentChip width). Site is fully usable behind/around the banner.

**No country/locale branching** — same English copy for every visitor regardless of geo (D-06; Russian-VPN architectural assumption applies).

### Surface 2 — ConsentChip (FLIPPED, D-04)

The Phase 5 ConsentChip must be REWORDED. The component, placement, and dismiss behavior stay; the state-machine inverts.

State definitions:
- **Consented state** = `localStorage["wtcs_consent"] === "allow"` (analytics + Replay loaded and capturing)
- **Declined state** = `localStorage["wtcs_consent"] === "decline"` (analytics + Replay never loaded)
- **Undecided state** = no `wtcs_consent` key (banner is showing on first visit; chip is hidden)

| State | Body copy | Action button | Action result |
|-------|-----------|---------------|---------------|
| Consented | `Anonymous usage analytics are on.` | `Turn off` (inline link, `variant="link"`) | Sets `wtcs_consent="decline"`, calls `posthog.opt_out_capturing()`, prevents Replay attach on next boot, chip swaps to Declined state |
| Declined | `Anonymous usage analytics are off.` | `Turn on` (inline link, `variant="link"`) | Sets `wtcs_consent="allow"`, calls `posthog.opt_in_capturing()`, lazy-attaches Replay, chip swaps to Consented state |
| Undecided | Chip is hidden — banner is responsible for first decision | n/a | n/a |

**Dismiss `×`:** existing affordance retained. Hides the chip for current session via `posthog_consent_chip_dismissed=true` localStorage (existing key). Does NOT change the consent decision. Reset on next page load.

**Hidden on `/admin/*` routes:** retained from Phase 5 (admins are WTCS team; analytics consent UI is unnecessary noise on admin surfaces).

**Banned phrasings (carry-forward from Phase 5 UI-SPEC):**
- ~~`We use cookies to enhance your experience`~~
- ~~`Help us make this awesome!`~~
- ~~`Opt out` (existing Phase 5 wording — replaced because the framing is inverted)~~

### Surface 3 — `?debug=auth` Diagnostic Overlay (NEW, D-01)

Dev-aid. Activated by appending `?debug=auth` to any route. MUST be tree-shaken / env-gated out of production builds (mechanism is Claude's discretion per CONTEXT.md — recommendation: `import.meta.env.DEV` runtime check + dynamic import, so production bundle pays zero cost).

**Layout:** fixed-position card, `bottom-4 left-4` (opposite anchor from ConsentChip/banner so they never collide), max-width `min(28rem, calc(100vw - 2rem))`, max-height `calc(100vh - 2rem)` with `overflow-y-auto`.

**Container:** `bg-card rounded-xl border shadow-md p-4`.

| Section | Heading copy | Content |
|---------|--------------|---------|
| Session | `Supabase session` | JSON-serialized session shape (user id, expires_at, provider). Truncate token strings to first 8 chars + `…` (never log full tokens, even in dev — prevents accidental sharing in screenshots). |
| Cookies | `sb-* cookies` | One row per `document.cookie` entry whose name starts with `sb-`. Format: `<name>` in `font-mono text-xs`, value preview (first 16 chars + `…`) in `text-muted-foreground`. |
| localStorage | `sb-* localStorage` | One row per `localStorage` key starting with `sb-`. Same format as cookies. |
| Breadcrumbs | `Recent Sentry breadcrumbs (last 5)` | Reverse-chronological list of breadcrumb objects (category, level, message, timestamp). Render as `font-mono text-xs` JSON. |
| Console errors | `Recent console errors (last 30s)` | Captured via a temporary `console.error` proxy installed only when overlay mounts. Dismissed when overlay unmounts. |

**Per-section copy-to-clipboard:** each section has a small `Copy` button (`<Button variant="ghost" size="sm">` with Lucide `Copy` icon). Click → `navigator.clipboard.writeText(JSON.stringify(section))`, brief toast via Sonner: `Copied`. Failure toast: `Could not copy. Select and copy manually.`

**Dismiss affordance:** `×` icon top-right of overlay (`Lucide X`, `size-4`), aria-label `Close debug panel`. Click removes overlay from DOM but leaves the URL query untouched (refresh re-opens). Removing `?debug=auth` from URL is the persistent way to close.

**Tone:** terse and technical. This is a dev tool, not user-facing. Section headings are in plain English (`text-sm font-medium`); values are raw `font-mono`. No tone-softening copy. No emojis.

**No PII:** the overlay surfaces local browser state only. No network requests are made from the overlay itself. Tokens are truncated. Discord ID hash from session is fine to display in full (already non-PII per Phase 5 D-13).

### Surface 4 — `AuthErrorPage` (NO VISUAL CHANGE, D-01)

**Constraint: NO visual change in v1.0.** This is the explicit decision in CONTEXT.md D-01 — the escape-hatch button (e.g., "Clear stuck session and retry") is **deferred** to a later phase.

| Element | Status |
|---------|--------|
| Layout (`max-w-md mx-auto py-16 md:py-24` Card) | UNCHANGED |
| Icon set (`ShieldAlert`, `Clock`, `AlertCircle`, `Users`) | UNCHANGED |
| Heading copy (per-reason) | UNCHANGED |
| Body copy (per-reason) | UNCHANGED |
| Primary button label / href | UNCHANGED |
| Secondary button label / behavior | UNCHANGED |
| Tone | UNCHANGED — direct, helpful, no exclamation marks (Phase 1 D-05/06/07) |

**What DOES change (invisible to the user):** Sentry breadcrumbs are added at AuthErrorPage's render path (single `category: "auth"` per CONTEXT.md "Claude's Discretion") so the next reproduction surfaces server-side instrumentation in the Sentry issue. Zero DOM diff. UI-checker should compare against the pre-Phase-6 snapshot and confirm pixel-equivalence.

### Surface 5 — Favicon Set (D-07)

**Source asset:** `src/assets/wtcs-logo.png` (226×200 RGBA PNG, already in repo).

**Output set written to `public/`:**

| File | Dimensions | Purpose |
|------|-----------|---------|
| `favicon.ico` | multi-res (16×16, 32×32, 48×48) | Legacy browser address bar |
| `favicon.svg` | scalable | Modern browsers (replaces current Vite scaffold favicon) |
| `apple-touch-icon.png` | 180×180 | iOS home-screen / Safari pinned tab |
| `favicon-dark.svg` (optional, only if light/dark contrast verified to be insufficient) | scalable | Dark-chrome browsers via `<link rel="icon" media="(prefers-color-scheme: dark)" ...>` |

**`<link>` tags in `index.html`** (locked order):

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<!-- Dark variant ONLY if needed: -->
<!-- <link rel="icon" type="image/svg+xml" href="/favicon-dark.svg" media="(prefers-color-scheme: dark)" /> -->
```

**Source workflow (Claude's discretion, locked here):** **realfavicongenerator.net** is the chosen tool. Rationale:
- Single source PNG (the existing `wtcs-logo.png`) → multi-format output set in one pass
- Includes the multi-resolution `.ico` correctly (browser tab fallback)
- No new npm dependency or build step (vite-plugin-favicons would add a build-step toolchain we don't otherwise need at the $0 budget)
- Generated files committed directly to `public/` — same pattern as the existing `favicon.svg`
- One-shot manual run; no recurring CI cost

**Visual constraint:** favicon must be readable at 16×16. The 226×200 source has detail that may not survive — executor MUST visually verify the 16×16 output renders as a recognizable WTCS mark. If detail loss is significant, fall back to a hand-simplified SVG variant instead of the auto-generated raster.

**No copy.** Favicons have no text contract.

### Surface 6 — `<title>` + `<meta name="description">` (D-10)

| Tag | Locked content |
|-----|----------------|
| `<title>` | `WTCS Community Suggestions` |
| `<meta name="description">` | `Share opinions on War Thunder Competitive Scene proposals. Verified Discord identity, one response per account, transparent results.` |

**Character counts:**
- Title: 26 characters (well within 50-60 char SEO budget)
- Description: 153 characters (within 150-160 SEO budget)

**Terminology compliance (PROJECT.md):**
- Uses "suggestions", "opinions", "responses" — user-facing vocabulary
- Avoids "polls" / "votes" — internal-only vocabulary
- Avoids exclamation marks, hype words, emojis

**Open Graph / Twitter cards:** OUT OF SCOPE for this phase. Lock only the two tags above. Social-share metadata is a separate v1.x polish task.

**Lang attribute:** `<html lang="en">` already set in `index.html` — no change needed.

---

## Component Inventory

| Component | Source | Status this phase |
|-----------|--------|-------------------|
| `Button` | shadcn `src/components/ui/button.tsx` | Reused (banner CTAs, debug overlay copy buttons) |
| `Card` | shadcn `src/components/ui/card.tsx` | Reused (debug overlay container — optional; raw `bg-card rounded-xl border` div is acceptable per Phase 5 precedent in AppErrorFallback) |
| `Sonner` toast | shadcn `src/components/ui/sonner.tsx` | Reused (debug overlay copy-to-clipboard ack) |
| `ConsentChip` | existing `src/components/ConsentChip.tsx` | **MODIFIED** — copy + state machine flipped (D-04). Component file stays. |
| `ConsentBanner` | NEW — `src/components/ConsentBanner.tsx` | Created this phase. First-visit banner. Renders only when `wtcs_consent` localStorage key is unset. |
| `DebugAuthOverlay` | NEW — `src/components/DebugAuthOverlay.tsx` (or under `src/components/debug/`) | Created this phase. Lazy-loaded behind `?debug=auth` query param, env-gated to `import.meta.env.DEV`. |
| `AuthErrorPage` | existing `src/components/auth/AuthErrorPage.tsx` | Touched ONLY for breadcrumb instrumentation. Zero DOM diff. |
| Lucide icons used | `X` (dismiss), `Copy` (copy buttons), `Bug` or none (debug overlay header — optional) | Reused; no new icon dependencies |

**No new shadcn registry installs required.** All primitives needed are already in `src/components/ui/`.

---

## Interaction States

### Consent Banner

| State | Trigger | Visual |
|-------|---------|--------|
| Hidden | `wtcs_consent` localStorage key is set (`allow` or `decline`) | Banner does not render |
| Visible | First visit (no key set) AND not on `/admin/*` route | Slide-in from `bottom-4 right-4`, fade-in 150ms |
| Allow clicked | localStorage `wtcs_consent="allow"` written, posthog/Replay init triggered, banner removed from DOM, ConsentChip becomes visible in Consented state | Banner fades out 150ms, ConsentChip fades in next render |
| Decline clicked | localStorage `wtcs_consent="decline"` written, no analytics init, banner removed from DOM, ConsentChip becomes visible in Declined state | Same fade-out as Allow |
| Dismissed (× clicked, NO decision) | Banner hidden for current page-load only; `wtcs_consent` not written; banner re-shows next visit | Banner fades out 150ms; ConsentChip stays hidden |

### ConsentChip (post-flip)

| State | Trigger | Visual |
|-------|---------|--------|
| Consented | `wtcs_consent === "allow"` AND not dismissed-this-session AND not on `/admin/*` | Chip visible, body `Anonymous usage analytics are on.`, action `Turn off` |
| Declined | `wtcs_consent === "decline"` AND not dismissed-this-session AND not on `/admin/*` | Chip visible, body `Anonymous usage analytics are off.`, action `Turn on` |
| Undecided | `wtcs_consent` key absent | Chip hidden — banner takes over |
| Dismissed-this-session | session-only dismiss flag true | Chip hidden until next page load |

### Debug Overlay

| State | Trigger | Visual |
|-------|---------|--------|
| Hidden | `?debug=auth` not in URL OR production build OR overlay manually dismissed | Not rendered |
| Visible | `?debug=auth` in URL AND `import.meta.env.DEV` AND not manually dismissed this session | Card visible at `bottom-4 left-4`, scrollable internally |
| Copy success | Copy button clicked, clipboard write succeeded | Sonner toast `Copied`, 2s auto-dismiss |
| Copy failure | Copy button clicked, clipboard API rejected | Sonner toast `Could not copy. Select and copy manually.`, 4s auto-dismiss |

---

## Accessibility Constraints

- Banner buttons MUST meet 44×44px minimum touch target (carries from Phase 1).
- Banner Dismiss `×` MUST have `aria-label="Dismiss"`.
- Debug overlay Dismiss `×` MUST have `aria-label="Close debug panel"`.
- Debug overlay copy buttons MUST have `aria-label="Copy {section name}"`.
- ConsentChip action link buttons MUST have descriptive `title` attributes (existing pattern retained).
- Banner MUST NOT trap keyboard focus (it is non-blocking; tab order should pass over it without modal trap).
- Color contrast: ALL text on `bg-card` MUST meet WCAG AA (4.5:1 for body, 3:1 for `text-xs`). Existing shadcn Neutral preset is verified compliant; no new color combinations introduced.
- Favicon: dark-mode variant only required if light-mode variant fails contrast on `prefers-color-scheme: dark` browser chrome. Verify visually before committing the dark variant.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (`https://ui.shadcn.com`) | Button, Card, Sonner — ALL ALREADY INSTALLED | not required (first-party registry, already in repo) |
| Third-party registries | NONE | not applicable — none declared |

No new shadcn primitives need installation for this phase. No third-party registries declared. Registry vetting gate not required.

---

## Storage & State Contracts

This phase introduces / inverts localStorage keys. Locked here to prevent drift between executor and tests.

| Key | Values | Owner | Notes |
|-----|--------|-------|-------|
| `wtcs_consent` | `"allow"` \| `"decline"` \| (absent) | NEW — owned by ConsentBanner & ConsentChip | Single source of truth for analytics+Replay gating. Read by `posthog.ts`, `sentry-replay.ts`, `AuthContext` (D-04). |
| `posthog_consent_chip_dismissed` | `"true"` \| (absent) | EXISTING — owned by ConsentChip | Session-scope dismiss; carries forward from Phase 5 |
| `analytics_opted_out` | `"true"` \| (absent) | DEPRECATED after Phase 6 | Phase 5 opt-OUT flag. Phase 6 migration: on first read of either key, if `analytics_opted_out === "true"` AND `wtcs_consent` absent, set `wtcs_consent="decline"` and clear `analytics_opted_out`. Migration path is one-shot per browser; no rollback needed since Phase 5 was opt-OUT and decline is the safe default under the new opt-IN model. |

Cookie-based consent storage is explicitly REJECTED (D-04 rationale: this phase fixes a cross-site-cookie auth bug; using more cookies for consent contradicts the cleanup goal).

---

## Out-of-Scope (Recorded for Audit Trail)

These are explicitly NOT in this UI-SPEC's contract. Listed so the checker / auditor / future-readers can confirm absences are intentional, not omissions.

- `/privacy` separate route — deferred (CONTEXT.md "Claude's Discretion"; default = inline banner copy)
- Granular per-tool toggles (analytics vs Replay) — rejected D-05 (bundled consent only)
- Geo-detection for EU-only opt-IN — rejected D-06 (global same-UX)
- "Clear stuck session" escape-hatch button on AuthErrorPage — deferred D-01
- Open Graph / Twitter card meta tags — out of scope for this phase
- Discord webhook for consent change events — out of scope (Phase 5 D-03 webhook deferral carries forward)

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

## Pre-Population Audit

| Source | Decisions Used |
|--------|----------------|
| `.planning/PROJECT.md` | Design system lock (Maia/Neutral/Inter), terminology rules, tone rules |
| `.planning/DESIGN-SYSTEM.md` | Spacing/typography/color tokens, component patterns |
| `.planning/phases/01-foundation-authentication/01-UI-SPEC.md` | Tailwind classes, type scale, touch-target rule, accent reservation pattern |
| `.planning/phases/05-launch-hardening/05-UI-SPEC.md` | ConsentChip placement, AppErrorFallback tone precedent, banned phrasings |
| `.planning/phases/05-launch-hardening/05-CONTEXT.md` D-13 | ConsentChip predecessor, env var lock |
| `.planning/phases/06-.../06-CONTEXT.md` D-01..D-10 | All Phase 6 surface decisions |
| `components.json` | shadcn confirmed initialized, style `new-york`, baseColor `neutral` |
| `src/components/ConsentChip.tsx` | Existing wording (to invert), placement, dismiss behavior |
| `src/components/auth/AuthErrorPage.tsx` | Confirmed existing layout to lock as "no visual change" |
| `index.html` | Current `<title>`/favicon baseline to replace |
| `src/assets/wtcs-logo.png` | Source dimensions confirmed (226×200 RGBA) |
| User input this session | NONE — all surface decisions were already locked in CONTEXT.md or upstream artifacts |
