# Phase 07 — UI Review

**Audited:** 2026-04-30
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md for Phase 07; phase scope is observability/instrumentation, not visual design). Cross-checked against `~/.claude/get-shit-done/references/ui-brand.md` for color/spacing/typography expectations.
**Screenshots:** captured (Vite dev server on :5173)

- `/.planning/ui-reviews/07-20260430-232639/smoke-no-render-desktop.png` — `/__smoke` (hint paragraph)
- `/.planning/ui-reviews/07-20260430-232639/smoke-no-render-mobile.png`
- `/.planning/ui-reviews/07-20260430-232639/smoke-render-desktop.png` — `/__smoke?render=1` (rendered blank in dev; see Pillar 6)
- `/.planning/ui-reviews/07-20260430-232639/smoke-render-mobile.png`

**Audit scope:** Phase 07 introduced two visible surfaces — `src/routes/[__smoke].tsx` (hint paragraph + Suspense wrapper around the throw component) and modifications to `src/main.tsx` (Sentry boundary wiring; visible only via `AppErrorFallback` which was unchanged from Phase 5/6). `RenderThrowSmoke.tsx` is render-phase throw only — zero JSX, no UI surface, but is the trigger for the AppErrorFallback path that users would actually see. AppErrorFallback was authored pre-Phase-7 but is the user-visible consequence of the wiring done here, so it is in scope as the "happy path of the unhappy path".

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Hint paragraph is clear and ops-friendly; AppErrorFallback uses the soft-flag string "Something went wrong" which is generic — flagged but contract-acceptable |
| 2. Visuals | 2/4 | Hint paragraph has no icon, no card framing, no visual hierarchy — sits as bare muted text in the page body with no signal it is the route's intentional landing state |
| 3. Color | 4/4 | Zero hardcoded colors, zero accent-token usage in the new surfaces; uses only `text-muted-foreground` (Phase 07 addition) and existing semantic tokens in AppErrorFallback |
| 4. Typography | 4/4 | Phase 07 introduces `text-sm` on a single `<p>` — no proliferation, no weight variants. AppErrorFallback uses text-lg/text-sm + font-medium (within abstract 4/2 limits) |
| 5. Spacing | 4/4 | New route uses zero spacing classes (no margins/padding/gap). AppErrorFallback uses `p-6 / mb-3 / mt-2 / mt-4 / gap-2` — all on the standard scale, no arbitrary values |
| 6. Experience Design | 2/4 | `/__smoke?render=1` rendered BLANK in the dev-server screenshot — Suspense fallback={null} shows nothing while the lazy chunk loads, and the in-dev React error capture path swallowed the throw before AppErrorFallback could render. No loading state, no aria/role on hint paragraph, no `<noscript>`/SEO-hide for `/__smoke` |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **`/__smoke?render=1` renders a blank page in dev — broken developer ergonomics for the canary's primary purpose** — Anyone visiting the smoke route in `npm run dev` to verify Sentry wiring sees nothing on screen and has to open the Network tab to confirm anything fired. Suspense `fallback={null}` is the proximate cause; the throw should still mount AppErrorFallback in production builds, but the dev-mode blank screen makes the canary appear broken to anyone who hasn't read 07-CONTEXT. **Fix:** change `src/routes/[__smoke].tsx:68` from `<Suspense fallback={null}>` to `<Suspense fallback={<p className="text-sm text-muted-foreground">Loading smoke component…</p>}>` so there is at least a momentary render before the throw, AND add a one-liner above the Suspense block (or in a useEffect) explicitly noting "If you see this and no error fallback below, run `npm run build && npm run preview` — StrictMode + dev-mode HMR can swallow render-phase throws that production captures correctly" — guards future maintainers from filing false-positive bugs against the canary.

2. **Hint paragraph at `/__smoke` (no `?render=1`) has no visual hierarchy or context framing** — A flat muted-text sentence floating on the page body provides zero signal that this is an intentional ops surface, not an empty page. Risk is low (route is non-public on prod), but in deploy-preview QA the visual makes Phase 07's verification surface look unfinished. **Fix:** wrap the hint in the same card pattern as AppErrorFallback for visual consistency — `src/routes/[__smoke].tsx:60-65` should render `<div className="min-h-dvh flex items-center justify-center p-6"><div className="bg-card rounded-xl border p-6 max-w-md w-full"><h1 className="text-lg font-medium">Smoke route</h1><p className="text-sm text-muted-foreground mt-2">Append <code>?render=1</code> to trigger a render-phase throw and exercise the Sentry capture path.</p></div></div>` — same component vocabulary, instantly readable as "intentional landing".

3. **AppErrorFallback's `<AlertCircle>` icon has no `aria-hidden` and no accessible name on its container** — The icon is decorative (the `<h1>` carries the semantic message) but lacks `aria-hidden="true"`, so screen readers announce it as "image" with no description. Pillar-6 a11y miss that surfaces every time a user hits the error path. **Fix:** `src/components/AppErrorFallback.tsx:16` change `<AlertCircle className="size-5 text-muted-foreground mb-3" />` to `<AlertCircle className="size-5 text-muted-foreground mb-3" aria-hidden="true" />` and consider wrapping the card in `<div role="alert">` so assistive tech announces the error immediately on mount.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Phase 07 file:** `src/routes/[__smoke].tsx:62-64`
- Copy: `"Smoke route. Append ?render=1 to trigger a render-phase throw."`
- Verdict: Clear, technical, ops-focused. Appropriate for a developer-only route. Inline `<code>` styling on `?render=1` is correct semantic markup.
- Minor: "Smoke route" alone is a sentence fragment. Could be sharpened to "Smoke test route" or "Sentry smoke canary" to immediately disambiguate from a literal smoke test (which has many meanings in software).

**Inherited surface:** `src/components/AppErrorFallback.tsx:17-19`
- Copy: `"Something went wrong."` (h1) and `"The page hit an unexpected error. Reloading usually helps. If this keeps happening, let us know."` (body)
- Verdict: "Something went wrong" matches the agent's `<audit_pillars>` flagged-pattern list (line 204 of the auditor spec). However, in this project the copy is anchored to a UI-SPEC Contract (line-2 comment in AppErrorFallback.tsx says "UI-SPEC Contract 2 — Error Boundary Fallback. Copy is verbatim"), so this is a contractually-frozen string, not lazy default. WARNING but not BLOCKER.
- The CTA pair `Reload page` / `Report issue` is action-oriented and specific — passes.

**No empty/loading-state copy** introduced by Phase 07 (none needed for an instrumentation phase).

### Pillar 2: Visuals (2/4)

**Hint-paragraph surface (`/__smoke`):**
- No focal point. No icon, no card, no border, no header. A single muted-text sentence at the top of an otherwise empty page (see screenshot `smoke-no-render-desktop.png`).
- Visual hierarchy: zero. The page reads as a 404-adjacent half-rendered state to anyone who doesn't recognize the route.
- Mobile (`smoke-no-render-mobile.png`): paragraph wraps onto two lines, still no framing — the text is visually indistinguishable from the page chrome.
- ConsentBanner overlays the bottom of the screen (see all four screenshots). Not Phase-07-introduced, but it appears on `/__smoke` because the route is mounted under the global RootLayout. No conflict — banner is a separate concern.

**Render-1 surface (`/__smoke?render=1`):**
- In dev, page is BLANK except for the global header + ConsentBanner. The Suspense fallback (`{null}`) shows nothing while the lazy chunk loads, and the dev-mode capture path in this run did not surface AppErrorFallback. (Production build behavior is verified in 07-VERIFICATION.md via Playwright MCP intercept; the dev-mode blank is a separate ergonomics concern, not a contract failure.)

**AppErrorFallback (the contract-defined visual):**
- Has focal point (icon + headline + body + CTA cluster), card framing, clear hierarchy. Passes when reached. Not a Phase 07 deliverable but the wiring's user-visible terminus. No issue with the component itself; issue is that Phase 07's dev-mode path doesn't reach it.

### Pillar 3: Color (4/4)

**Audit:** `grep -nE "text-primary|bg-primary|border-primary"` on Phase 07 files: zero matches. `grep -nE "#[0-9a-fA-F]{3,8}|rgb\("`: zero matches.

- `[__smoke].tsx` uses `text-sm text-muted-foreground` — semantic-token, neutral, no accent.
- `RenderThrowSmoke.tsx` has no JSX, no color surface.
- `AppErrorFallback.tsx` uses `bg-card`, `text-muted-foreground`, default Button variant — all theme tokens.

60/30/10 distribution check: the only Phase-07-introduced color is `text-muted-foreground` (a 30%-band neutral). No accent overuse. No hardcoded hex/rgb. Score 4/4.

### Pillar 4: Typography (4/4)

**Audit:**
- `text-` size variants in Phase 07 surfaces: `text-sm` (smoke route), `text-sm` + `text-lg` (AppErrorFallback). Total distinct sizes: 2. Well under the abstract-standard threshold of 4.
- `font-` weight variants: `font-medium` (AppErrorFallback h1 only). Total distinct weights: 1. Under the threshold of 2.
- No arbitrary `text-[...]` or `font-[...]` values.
- `<code>` element on `?render=1` correctly uses the browser default monospace fallback (no override in this codebase) — semantic and visually distinct from the body text.

Score 4/4.

### Pillar 5: Spacing (4/4)

**Audit:**
- `[__smoke].tsx` uses ZERO spacing classes (no `p-`, `m-`, `gap-`, `space-`). The hint paragraph inherits page flow. This is a finding for Pillar 2 (no card framing) but a pass for Pillar 5 (no spacing pollution).
- `AppErrorFallback.tsx` spacing: `p-6` (outer), `p-6` (card), `mb-3`, `mt-2`, `mt-4`, `gap-2`. All on the standard 4px scale (1.5rem / 0.75rem / 0.5rem / 1rem / 0.5rem). No arbitrary `[Npx]` values.
- `grep -nE "\[.*(px|rem)\]"` on Phase 07 surfaces: zero matches.

Score 4/4.

### Pillar 6: Experience Design (2/4)

**State coverage:**
- **Loading state:** Suspense `fallback={null}` (`[__smoke].tsx:68`) renders nothing during the lazy-chunk fetch. For the canary's purpose this is intentional (per Plan 02 acceptance criterion `Suspense in route >= 2`), but it produces the blank-page failure mode shown in `smoke-render-desktop.png`. **WARNING.**
- **Error state:** Sentry.ErrorBoundary → AppErrorFallback. Wired correctly per Plan 01. Verified end-to-end in 07-VERIFICATION.md on the deploy preview, but in dev-server the throw was swallowed (StrictMode + Vite HMR + React 19 onCaughtError can suppress visible fallback during the dev-only re-render cycle). **WARNING — affects local-dev ergonomics, not production.**
- **Empty state:** N/A — the smoke route is binary (404 on prod / hint on non-prod). No data-driven empty UI.
- **Disabled state:** N/A — no inputs.
- **Confirmation for destructive action:** N/A — no destructive action; the throw IS the action.

**Accessibility:**
- `[__smoke].tsx` hint paragraph: no `role`, no `aria-label`. Acceptable for a developer route, but the page has no `<h1>` so the document outline starts with a `<p>`. Screen-reader navigation flat-lines on this route. **WARNING.**
- `AppErrorFallback.tsx`: `<AlertCircle>` icon has no `aria-hidden="true"` (Top-3 fix #3). The `<h1>` is correctly used as the document landmark, but the card itself has no `role="alert"` so the error is not announced on mount. **WARNING.**
- No keyboard-trap concerns — only static text and standard `<a>` / `<button>` elements.

**SEO / discoverability:**
- `/__smoke` is reachable on non-prod builds and has no `noindex` meta. Production gate (`beforeLoad → notFound()`) correctly returns 404 for production crawlers, but deploy-preview URLs (`*.netlify.app`) are crawlable by default. Adding a `<meta name="robots" content="noindex">` head tag (via TanStack `head` option on this route) would prevent accidental indexing of preview deployments. **WARNING — informational.**

**Plan 03 verification covers production behavior** (intercepted Sentry envelope confirms the throw → boundary → AppErrorFallback chain works on Netlify deploy preview). Score 2/4 reflects dev-server ergonomics + accessibility gaps, not the production capture-path correctness which 07-VERIFICATION.md proves.

---

## Registry Safety

`components.json` exists (shadcn initialized). Phase 07 introduced no new shadcn blocks and no new third-party registries. AppErrorFallback uses `Button` from `@/components/ui/button` (shadcn official, installed pre-Phase-5).

**Registry audit: 0 third-party blocks introduced this phase, no flags.**

---

## Files Audited

- `src/routes/[__smoke].tsx` (created Plan 02; modified Plan 03 Round-4 hotfix) — primary Phase 07 UI surface
- `src/components/debug/RenderThrowSmoke.tsx` (created Plan 02) — no UI surface (render-phase throw only); audited for completeness
- `src/main.tsx` (modified Plan 01) — no direct UI surface; audited for the Sentry.ErrorBoundary wiring that drives AppErrorFallback rendering
- `src/components/AppErrorFallback.tsx` (UNCHANGED in Phase 07; in scope as the user-visible terminus of the boundary path) — UI-SPEC Contract 2 component
- `index.html` (read-only, for SEO/meta context)
- `netlify.toml` (read-only, to confirm env-var wiring referenced by the smoke route gate)
- Screenshots captured at `/__smoke` and `/__smoke?render=1` against Vite dev server :5173
