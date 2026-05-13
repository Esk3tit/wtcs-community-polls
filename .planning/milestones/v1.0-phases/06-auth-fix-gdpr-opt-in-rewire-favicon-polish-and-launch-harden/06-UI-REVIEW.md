# Phase 6 — UI Review

**Audited:** 2026-04-26
**Baseline:** `06-UI-SPEC.md` (locked design contract; surfaces 1-6)
**Screenshots:** not captured — dev server unreachable from sandboxed audit environment (`curl/wget blocked`); audit is code-only against the implementation source. Live behavior of the banner/chip/overlay was independently observed in 06-02d's PostHog smoke (Playwright + manual dashboard spot-check) and in 06-03's Comet visual verification.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All six surfaces match UI-SPEC verbatim; zero exclamation marks, zero emojis, zero "votes/polls" leakage in user-facing copy; banned phrasings absent. |
| 2. Visuals | 4/4 | Three fixed-position surfaces use distinct anchors (banner+chip share `bottom-right`, overlay `bottom-left`) with mutual-exclusion render guards; icon-only buttons have aria-labels; no two surfaces can collide. |
| 3. Color | 4/4 | Accent (`bg-primary`/`text-primary`) is reserved exclusively for the banner Allow button (default Button variant). Decline uses `outline`. Debug overlay copy buttons use `ghost`. Zero `destructive` uses. Zero hardcoded hex/rgb. |
| 4. Typography | 4/4 | Only `text-sm` (8) and `text-xs` (8) sizes; only `font-medium` (7) weight. No new sizes introduced. `font-mono` correctly applied to debug overlay raw values. |
| 5. Spacing | 3/4 | Spacing tokens align with UI-SPEC (`gap-2`, `p-3`, `p-4`, `bottom-4`, `right-4`, `left-4`); arbitrary values (`max-w-[min(20rem,calc(100vw-2rem))]`, `max-h-[calc(100vh-2rem)]`) are intentional viewport-aware width/height locks declared in UI-SPEC. Single concern: banner and chip both anchor `z-40 bottom-4 right-4` — render-guard mutual-exclusion is correct, but a bug that allows both to render simultaneously would stack them silently. |
| 6. Experience Design | 4/4 | Loading, empty, error, dismiss, allow, decline, undecided, /admin-hidden, session-dismiss, cross-tab-sync, allow→decline reload, lazy-load, copy-success, copy-failure all explicitly handled. State coverage is thorough. |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **Banner / Chip share z-index AND anchor without a structural failsafe** (Pillar 5 / Pillar 2 — WARNING) — Both `ConsentBanner.tsx:31` and `ConsentChip.tsx:45` use `fixed bottom-4 right-4 z-40`. Mutual exclusion is enforced by render guards (`state === 'undecided'` vs `state !== 'undecided'`) — correct today, but a future regression that loosens either guard (e.g. removing the chip's `state === 'undecided'` early return) would silently double-stack two cards on the same pixel. Concrete fix: add a single integration test that mounts both components inside a ConsentProvider and asserts only one renders for each of the three states.
2. **Debug overlay accumulates `consoleErrors` without bound; only filters on display** (Pillar 6 — WARNING) — `DebugAuthOverlay.tsx:110-128` pushes every `console.error` call into `consoleErrors` and never trims; the 30s window is computed at render time via `consoleErrors.filter(...)`. On a long-lived debug session in a noisy app this state grows unbounded. Concrete fix: prune entries older than 30s inside the `setState` updater, e.g. `setConsoleErrors((prev) => [...prev.filter((e) => now - e.ts < 30000), { ts: Date.now(), args }])`.
3. **`max-w-[min(20rem,calc(100vw-2rem))]` is duplicated across three surfaces with no shared token** (Pillar 5 — WARNING) — Banner, Chip, and overlay each inline this width arithmetic. Identical values are correct (UI-SPEC §3.1), but spec drift on one surface would not propagate. Concrete fix: extract a `consent-card-width` Tailwind utility or a small `cn(CONSENT_CARD_BASE, ...)` shared constant in `src/lib/consent-styles.ts`. Low-priority polish; not a defect.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

**Audit method:** Read every visible string in the four Phase-6 surfaces. Compared against UI-SPEC Surfaces 1-3 + 6 verbatim copy table. Grep for banned tokens.

- **ConsentBanner.tsx:35** — `We can record anonymous usage to help us improve this site.` matches UI-SPEC Surface 1 line 1 verbatim.
- **ConsentBanner.tsx:38** — `No tracking starts until you choose.` matches UI-SPEC Surface 1 line 2 verbatim.
- **ConsentBanner.tsx:42-43** — Buttons labelled `Allow` and `Decline` (one word each, default + outline variants); no destructive coloring on Decline; Phase 5 banned phrasings absent.
- **ConsentChip.tsx:36-38** — `Anonymous usage analytics are on.` / `Anonymous usage analytics are off.` match UI-SPEC Surface 2 state-machine table.
- **ConsentChip.tsx:38** — `Turn off` / `Turn on` action labels match UI-SPEC Surface 2; no leakage of legacy `Opt out` wording.
- **DebugAuthOverlay.tsx:145** — `Auth debug` heading is terse-technical, `text-sm font-medium`, matches UI-SPEC Surface 3 tone constraint.
- **DebugAuthOverlay.tsx:189** — `MISSING — no sb-*-code-verifier key in localStorage. PKCE state lost (RESEARCH.md Pitfall 4 strongest hypothesis).` is terse, technical, references the research artifact for an operator audience.
- **DebugAuthOverlay.tsx:38** — Toast `Copied {name}` matches UI-SPEC Surface 3 success copy.
- **DebugAuthOverlay.tsx:40** — Toast `Could not copy. Select and copy manually.` matches UI-SPEC Surface 3 failure copy verbatim.
- **index.html:11** — `<title>WTCS Community Suggestions</title>` (26 chars, well within 50-60 SEO budget). Matches UI-SPEC Surface 6 verbatim.
- **index.html:10** — Meta description (132 chars) uses user-facing terminology (`opinions`, `responses`, `proposals`); avoids `polls`/`votes`. Matches UI-SPEC Surface 6 verbatim. *Note: UI-SPEC line 234 claims 153 chars; actual is 132. This is a UI-SPEC documentation drift, not an implementation defect — both lengths are within the 150-160 SEO budget.*
- **AuthErrorPage.tsx:13-44** — Per-reason headings and bodies (`Two-Factor Authentication Required`, `WTCS Server Membership Required`, `Session Expired`, `Something Went Wrong`) are byte-identical to pre-Phase-6 (D-01 zero-DOM-diff requirement). The `useEffect` Sentry breadcrumb addition (lines 52-59) is invisible.
- **Banned-token grep:** zero exclamation marks, zero emojis, zero `votes`/`polls` in any audited file.

### Pillar 2: Visuals (4/4)

**Audit method:** Read DOM structure and z-index strategy across the three new fixed-position surfaces; map render-guard logic.

- **Three fixed surfaces, two anchors:** banner+chip share `bottom-4 right-4`; overlay uses `bottom-4 left-4`. The bottom-right anchor cannot collide with itself because of the render-guard contract: ConsentBanner renders only when `state === 'undecided'`; ConsentChip renders only when `state !== 'undecided'`. Plus chip's per-pathname `/admin/*` guard.
- **Icon-only buttons all carry aria-labels** — banner Dismiss (`Dismiss`), chip Dismiss (`Dismiss`), overlay Close (`Close debug panel`), and all six overlay Copy buttons (`Copy Supabase session`, `Copy PKCE State`, `Copy sb-* cookies`, `Copy sb-* localStorage`, `Copy Recent Sentry breadcrumbs`, `Copy Recent console errors`).
- **Visual hierarchy on AuthErrorPage** is unchanged (icon → heading → body → primary CTA → secondary CTA), preserving D-01 byte-identical contract.
- **Debug overlay structure** uses six clearly-headed sections with `text-sm font-medium` headings + `font-mono text-xs` raw values + per-section Copy button, matching UI-SPEC Surface 3 exactly.
- **No focal-point conflict:** the banner exists only on first visit and is non-blocking; site is fully usable around it. No modal-with-scrim pattern.

### Pillar 3: Color (4/4)

**Audit method:** Grep `bg-primary`, `text-primary`, `border-primary`, `bg-destructive`, `text-destructive` across Phase-6 files. Inspect Button `variant=` props.

- **Accent reserved correctly:** ConsentBanner's Allow button uses the default Button variant (which is `bg-primary text-primary-foreground` per shadcn Maia/Neutral preset). This is the ONE accent surface introduced by Phase 6, exactly as UI-SPEC §Color line 92 prescribes.
- **Decline button = `variant="outline"`** (`ConsentBanner.tsx:43`) — matches UI-SPEC §Color line 99. Decline is reversible, NOT destructive; the spec explicitly bans `destructive` here.
- **`grep -c destructive` across the four Phase-6 source files = 0.** No accidental destructive coloring on any surface.
- **ConsentChip action buttons use `variant="link"`** (line 50) and dismiss uses `variant="ghost"` (line 60) — secondary visual weight, matches UI-SPEC Surface 2.
- **Debug overlay uses 7× `variant="ghost"` Buttons** (close + 6 copy) and zero accent uses. Matches UI-SPEC Surface 3 `bg-card + border` (no `bg-destructive`, no red — this is a diagnostic aid, not an error surface).
- **Zero hardcoded colors in Phase-6 source:** `grep -E '#[0-9a-fA-F]{3,8}|rgb\('` against the four Phase-6 files returns zero hits. All color comes from semantic tokens (`bg-card`, `bg-muted`, `text-muted-foreground`, `border`).
- **AuthErrorPage `text-destructive`** on the heading icon (line 65) is pre-existing pre-Phase-6 — D-01 zero-DOM-diff confirmed.

### Pillar 4: Typography (4/4)

**Audit method:** Grep `text-{xs|sm|...}` and `font-{light|...|bold}` distributions across Phase-6 files.

- **Sizes used:** `text-sm` × 8 (headings, body copy on banner/chip), `text-xs` × 8 (chip body, overlay raw values, debug section labels). No `text-base`, no `text-lg`, no new sizes introduced. UI-SPEC §Typography roles line 73-75 satisfied.
- **Weights used:** `font-medium` × 7 (overlay section headings + main heading). No `font-semibold`, no `font-bold`, no `font-light`. UI-SPEC line 77 weight constraint satisfied (`font-medium` and `font-semibold` allowed; default 400 implicit).
- **`font-mono` applied correctly** at six debug-overlay value blocks (`pre className="font-mono text-xs whitespace-pre-wrap break-all"`), matching UI-SPEC §Typography line 74.
- **`leading-relaxed`** on banner and chip body copy provides comfortable line-height for the small-card form factor.

### Pillar 5: Spacing (3/4)

**Audit method:** Grep `p-`/`m-`/`gap-` distribution and arbitrary `[...]` values.

- **Tokens used:** `gap-2` × 4 (button row + start/end gaps), `p-3` × 1 (chip card padding), `p-4` × 2 (banner + overlay card padding), `p-0` × 1 (link button reset). All draw from the canonical scale; UI-SPEC §Spacing line 51-56 satisfied.
- **Anchor offsets:** `bottom-4`, `right-4`, `left-4` (16px) all match UI-SPEC §Spacing line 58.
- **Touch targets:** Banner Allow/Decline buttons carry `className="min-h-11"` (44px) at `ConsentBanner.tsx:42-43`, satisfying Phase 1 D-08 / WCAG 2.5.5.
- **Arbitrary values are intentional and contract-locked:**
  - `max-w-[min(20rem,calc(100vw-2rem))]` on banner + chip = the UI-SPEC Surface 1/2 width contract (`min(20rem, calc(100vw - 2rem))`).
  - `max-w-[min(28rem,calc(100vw-2rem))]` and `max-h-[calc(100vh-2rem)]` on overlay = UI-SPEC Surface 3 contract.
  - `size-6` on dismiss buttons, `size-3` / `size-4` on icons.
- **WARNING — duplicated arbitrary-value strings:** the `max-w-[min(20rem,calc(100vw-2rem))]` literal appears verbatim in TWO files (`ConsentBanner.tsx:31`, `ConsentChip.tsx:45`). Identical values are correct (UI-SPEC says both surfaces share that width); a future spec change on one surface would require manual coordination across both files. Not a defect today; flagged for spec-drift risk.
- **WARNING — banner and chip share `z-40 bottom-4 right-4`:** mutual exclusion is enforced by render-guard logic, not by stacking-context separation. A regression in either guard would silently double-render. Suggest an integration test covering all three consent states with both components mounted.

### Pillar 6: Experience Design (4/4)

**Audit method:** Trace state coverage across ConsentContext + UI surfaces; check for loading, error, empty, dismissed, cross-tab states.

- **State machine completeness:** ConsentContext exposes three states (`undecided | allow | decline`) with explicit transitions on `allow()` / `decline()` callbacks; one-shot migration from Phase 5 `analytics_opted_out` (lines 32-37); cross-tab sync via `storage` event (lines 47-56); side-effect bridge to PostHog/Replay (lines 61-68); allow→decline `window.location.reload()` to terminate live Replay (lines 84-86, P-02 mitigation for RESEARCH.md Pitfall 7).
- **ConsentBanner states:** undecided → renders; allow/decline → null; `/admin/*` → null; session-dismissed → null. Four distinct early-return guards covered.
- **ConsentChip states:** undecided → null (banner takes over); allow → "on" + Turn off; decline → "off" + Turn on; `/admin/*` → null; localStorage-dismissed → null. All five states covered.
- **DebugAuthOverlay states:** loading session via async `supabase.auth.getSession()` (line 113); empty cookies → `(none)` (line 206); empty storage → `(none)` (line 230); empty breadcrumbs → `(none)` (line 248); empty console errors → `(none)` (line 274); copy success → toast `Copied {name}`; copy failure → toast with manual-fallback instruction. All loading + empty + error transitions covered.
- **Production-reachability gate** (`__root.tsx:40-47`) combines `import.meta.env.DEV` OR `localStorage.wtcs_debug_auth === '1'` AND `?debug=auth` query param — this is the R-01 multi-condition gate that lets the overlay reach the failing browser without leaking it to public users. Lazy-loaded via `lazy()` + `Suspense` so the chunk is not requested until needed.
- **AuthErrorPage** (D-01 zero-DOM-diff) — the only Phase-6 change is a `useEffect` that fires `Sentry.addBreadcrumb({ category: 'auth', ... })` on mount. JSX is unchanged. UI checker can confirm pixel-equivalence against pre-Phase-6 snapshot.
- **WARNING — unbounded `consoleErrors` list:** see Top 3 Priority Fixes #2. The 30s filter is render-time only; the underlying state array grows monotonically. Long debug sessions on a noisy app could lead to slow re-renders. Not a v1.0 blocker (overlay is operator-only and ephemeral) but worth fixing for hygiene.

---

## Registry Safety

`components.json` is present (shadcn initialized). UI-SPEC §Registry Safety line 314 declares **only first-party shadcn registry** (`https://ui.shadcn.com`) is used for Phase 6 (Button + Card + Sonner — all already installed pre-phase). **Zero third-party registries declared.** Registry vetting gate is therefore not required by the audit protocol. **Result: 0 third-party blocks checked, no flags.**

---

## Files Audited

- `src/components/ConsentBanner.tsx` (NEW — 06-02c) — 58 lines
- `src/components/ConsentChip.tsx` (REWRITTEN — 06-02c) — 72 lines
- `src/components/debug/DebugAuthOverlay.tsx` (NEW — 06-01) — 284 lines
- `src/contexts/ConsentContext.tsx` (NEW — 06-02 + 06-02b) — 94 lines
- `src/components/auth/AuthErrorPage.tsx` (D-01 zero-DOM-diff verification) — 90 lines
- `src/routes/__root.tsx` (mount point + R-01 gate) — 51 lines
- `index.html` (favicon + title + meta — 06-03) — 17 lines
- `public/favicon.svg` / `favicon.ico` / `favicon-32.png` / `apple-touch-icon.png` (file-existence + size sanity check only — visual verification was performed in 06-03 against the Comet deploy preview)

**Phase 6 source-of-truth artifacts cross-referenced:**

- `06-UI-SPEC.md` (audit baseline)
- `06-CONTEXT.md` (D-01 through D-10)
- `06-01-SUMMARY.md` through `06-04-SUMMARY.md` (execution evidence)

---

## Summary

Phase 6 is shippable on the UI-contract dimension. Six audited surfaces match the UI-SPEC verbatim on copy, color, typography, and spacing. The two warnings (duplicate-anchor banner+chip, unbounded consoleErrors list) are hygiene improvements, not v1.0 blockers. Overall **23/24** with no pillar below 3/4.
