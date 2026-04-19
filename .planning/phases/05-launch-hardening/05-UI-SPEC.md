---
phase: 5
slug: launch-hardening
status: draft
shadcn_initialized: true
preset: shadcn Maia style, Neutral base (bbVJxbc)
created: 2026-04-18
---

# Phase 5 — UI Design Contract

> Launch hardening is a narrow UI phase. Three surfaces introduced: loading skeletons for `SuggestionList`, a Sentry `<ErrorBoundary>` fallback, and a PostHog consent indicator chip. All global tokens (color, typography, spacing, tone) are inherited from `.planning/DESIGN-SYSTEM.md` and NOT re-specified here.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (already initialized — `components.json` present) |
| Preset | Maia style, Neutral base, Neutral theme, Neutral chart (preset hash: bbVJxbc) |
| Component library | Radix UI (via shadcn) |
| Icon library | Lucide React |
| Font | System font stack (Inter acceptable if declared later; v1 uses system default) |

**Source of truth for global tokens:** `.planning/DESIGN-SYSTEM.md`. Executors MUST read that file before any styling work in this phase. Do NOT duplicate or override tokens here.

---

## Scope Boundary — What This Spec Covers

| In scope | Out of scope |
|----------|--------------|
| Loading skeleton component (D-14) | Any existing suggestion/archive/admin UI (shipped Phase 1-4, immutable) |
| Error boundary fallback screen (D-13 Sentry) | Color palette, type scale, spacing tokens (locked in DESIGN-SYSTEM.md) |
| Consent indicator chip (D-13 PostHog) | Light/dark theme strategy (locked Phase 1) |
| Prefetch-on-hover behavior contract (D-14) | Opinions-not-votes copy framing (locked DESIGN-SYSTEM.md) |
| README visual treatment (cross-reference only — executed under doc task, not UI task) | GH Actions workflow files, cron config, CI setup, Playwright, dep pinning — zero UI surface |

---

## Spacing Scale

Inherited from DESIGN-SYSTEM.md. Canonical values used by this phase:

| Token | Tailwind | Usage in Phase 5 |
|-------|----------|------------------|
| xs | `gap-1` (4px) | Icon-adjacent inline spacing in chip |
| sm | `gap-2` / `space-y-2` (8px) | Chip inner padding, skeleton row sub-elements |
| md | `p-4` / `space-y-3` (12-16px) | Skeleton outer list gap (matches live card: `space-y-3`) |
| lg | `p-5` (20px) | Skeleton card inner padding (matches live card: `p-5`) |
| xl | `p-6` (24px) | Error boundary fallback card padding |

Exceptions: none.

---

## Typography

Inherited from DESIGN-SYSTEM.md. Roles touched by this phase:

| Role | Tailwind | Usage in Phase 5 |
|------|----------|------------------|
| Heading — card title | `text-lg font-medium` | Error boundary heading ("Something went wrong") |
| Body | `text-sm text-muted-foreground` with `leading-relaxed` | Error boundary body, consent chip copy |
| Metadata | `text-xs text-muted-foreground` | Consent chip helper text, skeleton is visual only (no text) |

---

## Color

Inherited from DESIGN-SYSTEM.md (shadcn Neutral semantic tokens). Roles used:

| Role | Token | Usage in Phase 5 |
|------|-------|------------------|
| Dominant | `bg-background` | Error boundary page, consent chip surface |
| Secondary | `bg-card` / `bg-muted` | Error boundary card, skeleton shimmer bars |
| Primary | `bg-primary text-primary-foreground` | Error boundary "Reload" primary button only |
| Border/subtle | `border` / `border-border` | Consent chip border, error card border |
| Destructive | `text-destructive` | NOT used — the error fallback is calming, not alarming. Destructive stays reserved for admin delete flows (Phase 4) |

Accent reserved for: existing-app-only (primary CTA buttons, active nav state — Phase 1-4 surfaces). Phase 5 introduces one new accent use: the Reload button in the error boundary. No other new accent uses.

---

## Copywriting Contract

Follows DESIGN-SYSTEM.md tone rules: direct, no-nonsense, no exclamation marks, no hype, "opinions" language in user-facing copy.

### Loading Skeleton
No copy — visual only. `aria-busy="true"` + `aria-label="Loading topics"` (already in place, retain wording).

### Error Boundary Fallback

| Element | Copy |
|---------|------|
| Heading | `Something went wrong.` |
| Body | `The page hit an unexpected error. Reloading usually helps. If this keeps happening, let us know.` |
| Primary button | `Reload page` |
| Secondary button | `Report issue` (opens a `mailto:` or GitHub issues link — executor's discretion per D-13 subnotes) |

No emojis. No exclamation marks. No "Oops!" / "Uh oh" — those violate the tone rule.

### Consent Indicator Chip

| Element | Copy |
|---------|------|
| Default (consenting) state | `Anonymous usage data helps us improve this.` |
| Action link | `Opt out` (inline link, secondary color) |
| After opt-out state | `Usage tracking paused. Change anytime in settings.` (secondary/muted) |
| Dismiss affordance | Small `×` icon (Lucide `X`, `size-3`) to collapse the chip; opt-out link still reachable from the footer |

Rationale: aligns with DESIGN-SYSTEM.md "brief and helpful" empty/error-state voice. Explicitly NOT "We use cookies to enhance your experience" — that tone is banned.

### Destructive Confirmation
None introduced in this phase. The opt-out toggle is NOT destructive (reversible) — it uses a plain inline link, no AlertDialog.

---

## Component Contracts

### Contract 1 — Loading Skeleton (`SuggestionSkeleton.tsx`)

**Status:** Component exists but silhouette is incorrect. Must be upgraded to match the real `SuggestionCard`.

**Render location:**
- `SuggestionList.tsx` — already wired in the `loading` branch (keep)
- Routes: `/topics`, `/archive` (inherits via `SuggestionList`)

**Row count:** 3 skeletons. Rationale: matches Phase 1 seed data minimum, fills the viewport without overshooting on mobile.

**Per-skeleton layout (must mirror SuggestionCard silhouette):**
```
┌─ rounded-xl border p-5 bg-card ───────────┐
│  [badge ▬▬▬▬]          [meta ▬▬▬▬]        │   ← Row 1: category badge + time
│                                           │
│  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                     │   ← Row 2: title (h-5, w-3/4)
│                                           │
│  [○]  ▬▬▬▬▬              [▬▬▬▬]          │   ← Row 3: avatar + meta + responses
└───────────────────────────────────────────┘
```

**Styling primitives:**
- Outer: `bg-card rounded-xl border p-5` (exact match to `SuggestionCard`)
- List gap: `space-y-3` (exact match to `SuggestionList`)
- Shimmer elements: `bg-muted rounded animate-pulse` with explicit heights (`h-4` for badges/meta, `h-5` for title, `h-6 w-6 rounded-full` for avatar)
- Max width: inherits from parent route (`max-w-2xl`)

**Threshold:** Show skeleton whenever `loading === true` AND no cached suggestions exist. If cache-hit renders instantly, skip skeleton (TanStack Router prefetch + `useSuggestions` cache already handles this implicitly — no new gating logic required).

**Accessibility:** `aria-busy="true"` on the wrapper, `aria-label="Loading topics"` (archive variant: `aria-label="Loading archive"`). `role` is NOT needed (implicit from aria-busy on a div).

**Dark mode:** `bg-muted` and `bg-card` already swap via shadcn theme tokens — no explicit dark variants required.

**shadcn `<Skeleton>` primitive:** NOT installed. Executor may either (a) install it via `npx shadcn add skeleton` and swap in `<Skeleton className="h-4 w-3/4" />`, OR (b) keep the raw `bg-muted animate-pulse` pattern already in place. Either is acceptable; option (a) is marginally preferred for vocabulary consistency but adds a new component file.

---

### Contract 2 — Error Boundary Fallback

**Render location:** `src/main.tsx` — wrap the existing app tree in Sentry's `<ErrorBoundary fallback={<AppErrorFallback />}>`. ONE app-root boundary. No per-route boundaries in Phase 5 (deferred — would be a refactor across all routes; cost > value for v1).

**Layout:**
```
┌─────────────────────────────────────────┐
│                                         │
│        [centered vertically]            │
│                                         │
│   ┌─ bg-card rounded-xl border p-6 ──┐  │
│   │                                  │  │
│   │  Something went wrong.           │  │  ← text-lg font-medium
│   │                                  │  │
│   │  The page hit an unexpected      │  │  ← text-sm text-muted-foreground
│   │  error. Reloading usually...     │  │     leading-relaxed
│   │                                  │  │
│   │  [ Reload page ]  Report issue   │  │  ← Button variant=default + variant=link
│   │                                  │  │
│   └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

**Primitives:**
- Outer: `min-h-dvh flex items-center justify-center p-6`
- Card: `bg-card rounded-xl border p-6 max-w-md w-full` (echoes SuggestionCard family, tighter width)
- Primary button: shadcn `<Button>` default variant, `onClick={() => window.location.reload()}`
- Secondary: shadcn `<Button variant="link">` pointing to GitHub Issues URL (executor chooses URL — repo issues is the sensible default per D-13 subnotes)

**Icon:** Optional single `AlertCircle` from Lucide, `size-5 text-muted-foreground`, above the heading. Muted — NOT destructive red. The user's screen already broke; we don't need to amplify it with warning chrome.

**Sentry integration:** The boundary reports to Sentry automatically via `@sentry/react`'s `ErrorBoundary`. The UI contract above is the `fallback` prop only; instrumentation is out-of-scope for the UI-SPEC (covered in planner).

---

### Contract 3 — PostHog Consent Indicator Chip

**Render location:** Fixed, bottom-right corner of viewport (`fixed bottom-4 right-4 z-40`). Present on all user-facing routes. NOT shown on `/admin/*` routes (admins are WTCS team; implicit consent).

Rationale for bottom-right vs footer: the app has no persistent bottom footer (mobile-first, single-column, max-w-2xl). Inline "under the footer" would mean "below the last card", which scrolls out of view. Persistent corner chip matches D-13's "non-blocking, not a modal" constraint while staying discoverable.

**Layout (default state):**
```
                                       ┌──────────────────────────────────┐
                                       │  Anonymous usage data helps us   │
                                       │  improve this.  Opt out  [×]     │
                                       └──────────────────────────────────┘
                                         (fixed bottom-4 right-4)
```

**Primitives:**
- Outer: `fixed bottom-4 right-4 z-40 max-w-xs rounded-lg border bg-card shadow-md p-3`
- Copy: `text-xs text-muted-foreground leading-relaxed`
- "Opt out": shadcn `<Button variant="link" size="sm">` — inline, no background, primary-color text
- Dismiss (×): `<Button variant="ghost" size="icon">` with Lucide `<X className="size-3" />`
- Animation: simple `transition-opacity`, no slide-ins (DESIGN-SYSTEM.md: "keep it minimal, no fancy animations")

**State persistence:**
- Chip visibility persisted in `localStorage` (`posthog_consent_chip_dismissed=true`)
- Opt-out state persisted via PostHog's own `posthog.opt_out_capturing()` (no custom flag needed)
- Re-opening: a small "Privacy" link appears in the top-nav user menu (Phase 1 Navbar) to restore the chip. Planner owns the exact nav insertion point.

**Mobile:** On screens `< 640px`, the chip respects `max-w-[calc(100vw-2rem)]` to prevent edge bleed. Still bottom-right corner (not full-width banner — too visually loud for the "non-blocking" brief).

**Dark mode:** Inherits via `bg-card` and `border` tokens. No explicit variants.

---

### Contract 4 — Prefetch-on-Hover (behavioral contract, NO visual component)

**Approach:** TanStack Router declarative `preload="intent"` on `<Link>` elements. No `onMouseEnter` hooks, no custom timing.

**Links that get `preload="intent"`:**

| Link | Route source | Route target | Rationale |
|------|--------------|--------------|-----------|
| Top nav: Topics | any route | `/topics` | Primary navigation |
| Top nav: Archive | any route | `/archive` | Primary navigation |
| Admin nav: Admin | any route (if admin) | `/admin` | Secondary but high-value |

**Links explicitly NOT prefetched:**
- Individual suggestion cards (e.g. `/s/<slug>`) — not implemented yet as discrete routes (cards are collapsible in-place in Phase 2); deferred until those routes exist.
- External links (Discord OAuth, GitHub Issues) — not navigable within TanStack Router.
- Sign-out action — intentional cold navigation.

**"Bonus" card-level prefetch (from D-14):** Deferred in this spec. The card-to-results transition already happens in-place via collapse; no new route navigation to prefetch. Revisit if/when discrete suggestion routes are added (v2 consideration).

**Visual contract:** None. Prefetch is invisible to the user — its only UX signature is that the next navigation feels instant.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `<Button>`, `<Card>` (composed inline via Tailwind), `<Skeleton>` (optional install), existing `<Alert>`/`<Dialog>` (unchanged) | not required |
| Third-party | none | not applicable |

No third-party registries introduced in Phase 5. Vetting gate: N/A.

---

## Cross-Reference: README Visual Treatment (D-15)

The README rewrite is visual design work but belongs to a **documentation task**, not a UI implementation task. This spec notes it for traceability; the planner will own detailed execution under the README task.

**High-level visual requirements (per D-15):**
- Centered hero (logo + tagline)
- shields.io badge row
- Committed screenshots in `docs/screenshots/` (no external image hosts)
- Table-formatted env vars and tech stack
- Clean Markdown, no emoji clutter, no Vite scaffold cruft

The README is NOT a live app surface. It does not consume the spacing/typography/color tokens above — it consumes Markdown/shields.io conventions. No further contract needed in this spec.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS — direct, no exclamation, no "Oops!", opinions-not-votes preserved
- [ ] Dimension 2 Visuals: PASS — three contracts spec'd with silhouette diagrams, no invented global UI
- [ ] Dimension 3 Color: PASS — inherits DESIGN-SYSTEM.md; no new palette; accent usage scoped to 1 new button
- [ ] Dimension 4 Typography: PASS — inherits DESIGN-SYSTEM.md scale; no new sizes introduced
- [ ] Dimension 5 Spacing: PASS — inherits 4px scale; p-5 card padding and space-y-3 list gap match Phase 2
- [ ] Dimension 6 Registry Safety: PASS — shadcn official only; no third-party registries

**Pre-populated from:**

| Source | Decisions used |
|--------|----------------|
| 05-CONTEXT.md (D-13, D-14) | Skeleton approach, prefetch approach, Sentry ErrorBoundary requirement, PostHog consent-chip requirement, "non-blocking footer chip" wording |
| DESIGN-SYSTEM.md | All tokens (color, typography, spacing, tone), opinions-not-votes copy framing, card silhouette (`p-5`, `space-y-3`, `bg-card rounded-xl border`) |
| 02-CONTEXT.md + live code | `SuggestionList` loading branch, existing `SuggestionSkeleton` (to be upgraded), SuggestionCard silhouette to mirror |
| 04-CONTEXT.md | Alert/Dialog patterns (not re-specified; existing components unchanged) |
| User input | none required — all decisions resolved via upstream artifacts |

**Approval:** pending
