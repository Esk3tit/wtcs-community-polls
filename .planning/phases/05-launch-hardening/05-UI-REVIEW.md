---
phase: 05-launch-hardening
reviewed: 2026-04-19
baseline: .planning/phases/05-launch-hardening/05-UI-SPEC.md (Contracts 1-4) + .planning/DESIGN-SYSTEM.md
overall_score: 22/24
status: approved
screenshots: 4 production captures (docs/screenshots/*.png) reviewed; no live browser session
pillar_scores:
  copywriting: 4
  visuals: 4
  color: 4
  typography: 4
  spacing: 3
  experience_design: 3
---

# Phase 5 — UI Review

**Audited:** 2026-04-19
**Baseline:** 05-UI-SPEC.md (Contracts 1-4) + DESIGN-SYSTEM.md
**Screenshots:** 4 production captures in `docs/screenshots/` reviewed (topics-list, suggestion-with-results, admin-shell, mobile-view); no live browser session required — captures are prod-accurate per 05-09-SUMMARY.

Phase 5 introduced **three new surfaces** (`SuggestionSkeleton`, `AppErrorFallback`, `ConsentChip`) plus a behavioural contract (`preload="intent"` on Topics/Archive links; Admin cold-by-omission) and a public-product README. The audit is tightly scoped to these deliverables; all pre-existing Phase 1-4 surfaces are immutable per UI-SPEC §"Scope Boundary".

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Verbatim UI-SPEC copy; zero "vote" / "poll" / "Oops!" leakage in user-facing surfaces |
| 2. Visuals | 4/4 | Skeleton silhouette perfectly mirrors SuggestionCard; AppErrorFallback uses muted (not destructive) chrome; README hero is centered and composed |
| 3. Color | 4/4 | Neutral/Maia tokens only; accent scoped to Reload button; no hardcoded hex in new components; dark-mode inherited via semantic tokens |
| 4. Typography | 4/4 | Inter stack via shadcn; only spec-declared sizes (`text-xs`, `text-sm`, `text-lg`) used in new surfaces |
| 5. Spacing | 3/4 | Skeleton `p-5` + `space-y-3` match spec exactly; one redundant `max-w-*` in ConsentChip (cosmetic, not a bug); mobile chip edge-safety present |
| 6. Experience Design | 3/4 | Skeleton + preload close the cold-DB lag; AppErrorFallback has recovery path. Minor gaps: ConsentChip dismiss (`×`) vs "Opt out" semantic asymmetry is not signposted to users; preload coverage excludes Navbar's WTCS-logo home-link |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **ConsentChip redundant `max-w-*` classes (spacing nit)** — `src/components/ConsentChip.tsx:53` has both `max-w-xs` and `max-w-[calc(100vw-2rem)]` on the same element. Tailwind's last-wins CSS ordering makes the arbitrary value effective on mobile (correct), but `max-w-xs` becomes dead weight on desktop. **Fix:** replace with single responsive expression: `className="... max-w-[min(20rem,calc(100vw-2rem))] ..."`. Cosmetic, low priority.

2. **ConsentChip `×` dismiss vs "Opt out" semantic asymmetry is invisible to users** — both affordances sit millimetres apart but do very different things (X = accept-and-hide; Opt out = hide + block analytics + block Sentry Replay). Nothing in the visible UI signals that difference; the codex review rationale lives only in the source comment. **Fix (lowest-risk):** add a `title` attribute on the X button (`title="Dismiss (analytics continue)"`) and on the Opt-out button (`title="Turn off usage tracking"`). Zero layout impact; surfaces the semantics on hover. Full disclosure would be a tooltip, out of scope for v1.

3. **Navbar home-logo link has no `preload`** — `src/components/layout/Navbar.tsx:23-33`. The WTCS logo routes to `/` which ultimately redirects to `/topics` (the canonical landing). Users tapping the logo from Archive/Admin hit a cold loader even though Topics/Archive text links have `preload="intent"`. **Fix:** add `preload="intent"` to the logo Link. Not in UI-SPEC's Contract 4 table but aligns with its intent; no security concern (public route, no admin redirect).

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- **PASS — UI-SPEC Contract 2 verbatim.** `src/components/AppErrorFallback.tsx:17-19` renders exactly: heading "Something went wrong." + body "The page hit an unexpected error. Reloading usually helps. If this keeps happening, let us know." Primary CTA is "Reload page", secondary is "Report issue". No "Oops!", no emojis, no exclamation marks. ASVS V7 no-stack-trace invariant holds (no `props.error.*` disclosure).
- **PASS — UI-SPEC Contract 3 verbatim.** `src/components/ConsentChip.tsx:55-59` renders exactly: "Anonymous usage data helps us improve this. Opt out". Banned hypebot copy ("We use cookies…") absent.
- **PASS — DESIGN-SYSTEM terminology discipline.** The entire user-facing surface (topics-list screenshot) uses "Topics", "Active Topics", "responses", "1 total response", "1 response" — zero "votes" / "polls" / "voters" leakage. Admin shell (admin-shell.png) correctly uses "Create suggestion" button copy per UI-SPEC and DESIGN-SYSTEM's "admin internal terminology is a free surface".
- **PASS — README voice.** `README.md` uses "opinions, not binding votes" framing (§4); zero emojis; no Vite scaffold cruft; every CTA is action-oriented (e.g., "Sign in with Discord" not "Sign in to vote"). Shields.io row is four badges, clean.
- **PASS — Skeleton aria copy.** `aria-label="Loading topics"` matches UI-SPEC §"Accessibility" verbatim.

### Pillar 2: Visuals (4/4)

- **PASS — Skeleton silhouette fidelity (Contract 1).** `src/components/suggestions/SuggestionSkeleton.tsx:14-38` renders 3 card shells with `bg-card rounded-xl border p-5` — exactly matching `SuggestionCard` outer classes (`SuggestionCard.tsx:82-86` post-ternary baseline). Three shimmer rows match the real card's Row 1/Row 2/Row 3 layout (badge+meta / title / avatar+creator+responses). CLS on load→mount transition is near-zero. The 6-test regression guard (`SuggestionSkeleton.test.tsx`) locks the silhouette against future drift.
- **PASS — AppErrorFallback restraint.** Icon choice is `AlertCircle` in `text-muted-foreground` (not destructive red). Reloads the user's context; doesn't shout at them.
- **PASS — ConsentChip non-blocking brief.** Fixed bottom-right, `max-w-xs`, never covers primary content. Matches D-13's "non-blocking, not a modal" constraint. Admin routes hidden via `useRouterState` pathname check.
- **PASS — Topics list hero composition (topics-list.png).** Pinned Sinai card leads with amber "Pinned" banner inside `rounded-xl`/`overflow-hidden` (DESIGN-SYSTEM pattern). Category tabs render as horizontal scrollable pills. Search input is prominent and properly spaced.
- **PASS — Mobile layout (mobile-view.png).** Hamburger nav renders, category chips wrap cleanly onto 2 rows at 390px viewport, pinned card expands with proper vertical rhythm.

### Pillar 3: Color (4/4)

- **PASS — Zero hardcoded colors in Phase 5 additions.** Grep of `src/components/{AppErrorFallback,ConsentChip,suggestions/SuggestionSkeleton}.tsx` finds no `#[0-9a-f]{3,8}` or `rgb(` literals. Everything uses semantic tokens (`bg-card`, `bg-muted`, `text-muted-foreground`, `bg-primary`).
- **PASS — Accent scoped to the single declared use.** UI-SPEC §"Color" allows exactly ONE new accent use in Phase 5 (the Reload button). `AppErrorFallback.tsx:22` uses shadcn `<Button>` default variant (primary accent) → compliant. ConsentChip uses `variant="link"` for "Opt out" which inherits primary text color but not background — also compliant.
- **PASS — Destructive NOT used.** UI-SPEC forbids destructive tokens on the error fallback (calming, not alarming). Code matches — `text-destructive` appears zero times in Phase 5 new components.
- **PASS — Dark-mode parity.** All three new components rely on semantic tokens that auto-swap in dark mode. No explicit `dark:` variants needed (and none used).
- **PASS — Status badges in topics-list.png.** "Map Pool" (teal), pinned amber banner, category filter pill contrast all align with DESIGN-SYSTEM §"Status colors" and §"Category badges".

### Pillar 4: Typography (4/4)

- **PASS — Only spec-declared sizes in new surfaces.**
  - `AppErrorFallback.tsx`: `text-lg font-medium` (heading, matches UI-SPEC §Typography), `text-sm text-muted-foreground leading-relaxed` (body, matches spec).
  - `ConsentChip.tsx:55`: `text-xs text-muted-foreground leading-relaxed` (matches UI-SPEC §Typography "Metadata" role).
  - `SuggestionSkeleton.tsx`: no text rendered (visual-only shell) — compliant.
- **PASS — Inter font inherited.** All new surfaces render via the shadcn/Tailwind stack; no per-component `font-family` override.
- **PASS — Uppercase on category pills only.** `topics-list.png` shows "ALL", "LINEUP CHANGES", "MAP POOL", "RULES" in uppercase-tracking-wide — matches DESIGN-SYSTEM's one documented exception to the no-ALL-CAPS rule.
- **PASS — README hierarchy.** README uses Markdown H1 for product name, `<p align="center">` sub-hero tagline, section H2s for every D-15 block. No display-size hacks; plain Markdown renders well on GitHub.

### Pillar 5: Spacing (3/4)

- **PASS — Skeleton spacing matches spec exactly.** Outer: `space-y-3` (list gap); inner shells: `p-5`. Matches UI-SPEC §Spacing Scale row `md`/`lg` usage verbatim.
- **PASS — AppErrorFallback uses spec's `xl` token.** `p-6` on the card per UI-SPEC row 5 (`xl`).
- **PASS — ConsentChip bottom-right placement.** `fixed bottom-4 right-4 z-40` matches UI-SPEC §Contract 3 verbatim.
- **MINOR — Redundant `max-w-*` on ConsentChip** (`ConsentChip.tsx:53`): `max-w-xs max-w-[calc(100vw-2rem)]` — two `max-w-*` utilities co-exist. Tailwind 4's JIT doesn't de-duplicate competing utilities at the same specificity; last-class-wins means the arbitrary value is effective, so `max-w-xs` is dead. Cosmetic only. See Top Fix #1.
- **PASS — Mobile edge safety.** `max-w-[calc(100vw-2rem)]` prevents edge bleed below 640px, matching UI-SPEC §"Mobile" clause.
- **MINOR — Topics-list.png shows generous whitespace between hero title and search bar** — well within DESIGN-SYSTEM's `max-w-2xl` centered pattern; noted for parity, not a flag.

### Pillar 6: Experience Design (3/4)

- **PASS — Skeleton closes the cold-DB lag reported in notes/2026-04-08.** Wrapper has `aria-busy="true"` so screen readers announce loading. Shape-stable transition to real cards prevents CLS jank.
- **PASS — AppErrorFallback recovery path.** Primary action (`Reload page` via `window.location.reload()`) directly addresses the stated failure mode; secondary action (`Report issue` → GitHub Issues) is `target="_blank" rel="noreferrer noopener"` — no window-opener leak.
- **PASS — Preload-on-intent delivers perceived speed.** Navbar + MobileNav wire `preload="intent"` on Topics + Archive Links. Admin is cold-by-omission (HIGH #1 guard); preventing hover-triggered AdminGuard redirect is a clean security-preserving choice. Comment blocks above the Admin link lock the invariant for future plans.
- **PASS — ConsentChip is non-blocking.** Chip does NOT intercept scroll/click on primary content; opt-out is a single click; no first-paint blocker.
- **PASS — Router-context safety (HI-01 resolution).** `ConsentChip` now renders inside `RootLayout` in `src/routes/__root.tsx:28` — under `RouterProvider`. The `useRouterState` call no longer crashes. Mount-effect cardinality is "once per session" (root route is stable; only `<Outlet />` swaps) — `loadSentryReplayIfConsented()` runs exactly once as intended.
- **MINOR — Dismiss vs opt-out semantic asymmetry invisible to users.** The X button keeps analytics running; "Opt out" kills them. Both affordances are ~20px apart with zero visual or textual differentiation of intent. A user reading "I don't want this" might tap whichever is closest. See Top Fix #2.
- **MINOR — Logo Link lacks preload.** `src/components/layout/Navbar.tsx:23` wraps the WTCS logo in a `<Link to="/">` without `preload`. The `/` route in this app redirects to `/topics`, so tapping the logo from Archive is a cold navigation. Low user impact but a small inconsistency with the prefetch contract. See Top Fix #3.
- **INFO — No toast/snackbar confirmation on opt-out.** UI-SPEC didn't require one; the chip simply disappears. On reflection this is the right call for a "non-blocking, not a modal" brief — adding a toast would re-introduce chrome the chip was explicitly designed to avoid. No action recommended.

---

## Registry Safety

**Not applicable.** `components.json` is present but UI-SPEC §"Registry Safety" declares third-party registries: **none**. All blocks used (`<Button>`, `<Card>`, inline Tailwind composition) are from the shadcn official registry. Audit gate: N/A per spec.

---

## Top Fixes (prioritized)

| # | Severity | Area | Fix | Effort |
|---|----------|------|-----|--------|
| 1 | P3 / nit | Spacing — ConsentChip | Replace `max-w-xs max-w-[calc(100vw-2rem)]` with `max-w-[min(20rem,calc(100vw-2rem))]` (one-line change in `ConsentChip.tsx:53`) | ~2 min |
| 2 | P2 / UX clarity | Experience — ConsentChip | Add `title` attrs on X (Dismiss) and Opt-out buttons to surface the behavioural difference on hover | ~5 min |
| 3 | P3 / consistency | Experience — Navbar | Add `preload="intent"` to the WTCS logo `<Link to="/">` in `Navbar.tsx` (and `MobileNav` doesn't have a logo link — desktop only) | ~2 min |

All three are polish, not blockers. Phase 5 can ship as-is; fold these into a future "Phase 6 polish" or a targeted GSD-quick patch.

---

## Files Audited

**Phase 5 new components:**
- `src/components/suggestions/SuggestionSkeleton.tsx` (Contract 1)
- `src/components/AppErrorFallback.tsx` (Contract 2)
- `src/components/ConsentChip.tsx` (Contract 3)

**Phase 5 modifications (preload wiring, HI-01 fix):**
- `src/components/layout/Navbar.tsx`
- `src/components/layout/MobileNav.tsx`
- `src/routes/__root.tsx`

**Reference / silhouette baseline:**
- `src/components/suggestions/SuggestionCard.tsx`

**Public product surface:**
- `README.md`
- `docs/screenshots/{topics-list,suggestion-with-results,admin-shell,mobile-view}.png`

**Planning artifacts (context):**
- `.planning/phases/05-launch-hardening/05-UI-SPEC.md` (baseline)
- `.planning/phases/05-launch-hardening/05-CONTEXT.md` (D-13, D-14)
- `.planning/phases/05-launch-hardening/05-{01,03,04,09,10}-SUMMARY.md`
- `.planning/phases/05-launch-hardening/05-REVIEW.md` (iteration 2 — code review)
- `.planning/DESIGN-SYSTEM.md` (global tokens + terminology)
- `CLAUDE.md` (project constraints)

---

*Audit produced by `/gsd-ui-review` · 2026-04-19*
