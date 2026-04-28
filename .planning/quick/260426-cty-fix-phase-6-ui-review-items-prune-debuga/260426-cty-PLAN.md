---
quick_id: 260426-cty
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/debug/DebugAuthOverlay.tsx
  - src/lib/consent-styles.ts
  - src/components/ConsentBanner.tsx
  - src/components/ConsentChip.tsx
  - src/__tests__/components/ConsentMutualExclusion.test.tsx
autonomous: true
requirements:
  - UI-REVIEW-FIX-1
  - UI-REVIEW-FIX-2
  - UI-REVIEW-FIX-3

must_haves:
  truths:
    - "DebugAuthOverlay's consoleErrors state is bounded — entries older than 30s are pruned inside the setState updater on every push, not only at render time."
    - "The shared consent-card max-w token (`min(20rem, calc(100vw - 2rem))`) lives in exactly ONE source location; ConsentBanner and ConsentChip both consume it without inlining the literal."
    - "An integration test asserts mutual exclusion of ConsentBanner + ConsentChip across all three consent states (undecided → only banner; allow → only chip; decline → only chip)."
    - "Zero visual / DOM regressions: copy, layout, anchor (`bottom-4 right-4`), z-index (`z-40`), padding, and accent reservation are byte-equivalent before and after."
    - "All existing Phase-6 tests (ConsentBanner.test, ConsentChip.test, ConsentContext.test, AuthErrorPage.test) still pass."
  artifacts:
    - path: "src/lib/consent-styles.ts"
      provides: "Shared consent-card width Tailwind class constant"
      exports: ["CONSENT_CARD_MAX_W"]
    - path: "src/__tests__/components/ConsentMutualExclusion.test.tsx"
      provides: "Mutual-exclusion integration test for banner + chip"
      contains: "describe('ConsentBanner + ConsentChip mutual exclusion'"
  key_links:
    - from: "src/components/ConsentBanner.tsx"
      to: "src/lib/consent-styles.ts"
      via: "named import of CONSENT_CARD_MAX_W"
      pattern: "import.*CONSENT_CARD_MAX_W.*consent-styles"
    - from: "src/components/ConsentChip.tsx"
      to: "src/lib/consent-styles.ts"
      via: "named import of CONSENT_CARD_MAX_W"
      pattern: "import.*CONSENT_CARD_MAX_W.*consent-styles"
    - from: "src/components/debug/DebugAuthOverlay.tsx"
      to: "consoleErrors setState updater"
      via: "filter(now - e.ts < 30000) inside updater"
      pattern: "setConsoleErrors\\(\\(prev\\)"
---

<objective>
Close the 3 priority items from `06-UI-REVIEW.md` (Phase 6 UI audit, score 23/24).

Purpose: Each item is hygiene / drift-prevention, not a v1.0 functional defect. All three are PURE refactors + 1 test addition with ZERO behavioral / visual change. The audit explicitly locks UI-SPEC contracts (anchors, z-index, copy, accent) — none may be regressed.

Output:
- Bounded `consoleErrors` accumulator inside the setState updater.
- Single shared source for the consent-card `max-w` token.
- Mutual-exclusion integration test guarding against future render-guard regressions.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-UI-REVIEW.md

<interfaces>
<!-- Extracted from current source — executor uses these directly, no exploration. -->

src/lib/utils.ts (existing helper, do NOT modify):
```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]): string
```

src/contexts/ConsentContext.tsx (existing, do NOT modify):
```ts
export type ConsentState = 'undecided' | 'allow' | 'decline'
export interface ConsentContextValue {
  state: ConsentState
  allow: () => void
  decline: () => void
}
export function ConsentProvider({ children }: { children: ReactNode }): JSX.Element
// Storage contract: localStorage key `wtcs_consent` ∈ {'allow','decline'}; absent ⇒ 'undecided'.
// Legacy migration: `analytics_opted_out === 'true'` + absent `wtcs_consent` ⇒ writes 'decline'.
```

src/components/debug/DebugAuthOverlay.tsx — current consoleErrors logic (lines 110-140):
```tsx
const [consoleErrors, setConsoleErrors] = useState<ConsoleErrorEntry[]>([])
const [now, setNow] = useState<number>(() => Date.now())

useEffect(() => {
  // ...
  const originalConsoleError = console.error
  console.error = (...args: unknown[]) => {
    setConsoleErrors((prev) => [...prev, { ts: Date.now(), args }])  // ← unbounded
    originalConsoleError(...args)
  }
  // ...
}, [])

// Render-time filter only:
const recentConsoleErrors = consoleErrors.filter((e) => now - e.ts < 30000)
```

ConsentBanner / ConsentChip current width literals (verbatim, MUST stay equivalent):
- ConsentBanner.tsx:31 — `... max-w-[min(20rem,calc(100vw-2rem))] ...`
- ConsentChip.tsx:45  — `... max-w-[min(20rem,calc(100vw-2rem))] ...`

Note: DebugAuthOverlay uses a DIFFERENT width (`min(28rem,calc(100vw-2rem))`) — DO NOT
collapse it into the shared constant. Shared token is for the 20rem consent surfaces only.

Test pattern (existing, follow this exactly — see ConsentBanner.test.tsx / ConsentChip.test.tsx):
```ts
vi.mock('@/lib/posthog', () => ({ posthog: { opt_in_capturing: vi.fn(), opt_out_capturing: vi.fn(), identify: vi.fn(), reset: vi.fn() }, initPostHog: vi.fn() }))
vi.mock('@/lib/sentry', () => ({ loadSentryReplayIfConsented: vi.fn() }))
let currentPathname = '/'
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }) => select({ location: { pathname: currentPathname } }),
}))
```

Locked UI-SPEC contracts that MUST NOT change:
- ConsentBanner anchor: `fixed bottom-4 right-4 z-40`
- ConsentChip anchor:   `fixed bottom-4 right-4 z-40`
- Banner padding: `p-4`. Chip padding: `p-3`.
- Banner Allow = default Button variant (accent). Decline = `variant="outline"`.
- All copy is verbatim; do NOT touch text content.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Bound DebugAuthOverlay consoleErrors inside setState updater</name>
  <files>src/components/debug/DebugAuthOverlay.tsx</files>
  <action>
In the `useEffect` that monkey-patches `console.error` (around line 124-128 of `src/components/debug/DebugAuthOverlay.tsx`), change the `setConsoleErrors` updater so it prunes entries older than 30s INSIDE the updater itself instead of relying on the render-time filter.

EXACT change:

Before:
```tsx
console.error = (...args: unknown[]) => {
  setConsoleErrors((prev) => [...prev, { ts: Date.now(), args }])
  originalConsoleError(...args)
}
```

After:
```tsx
console.error = (...args: unknown[]) => {
  const ts = Date.now()
  setConsoleErrors((prev) => [
    ...prev.filter((e) => ts - e.ts < 30000),
    { ts, args },
  ])
  originalConsoleError(...args)
}
```

Then DELETE the now-redundant render-time filter line (`const recentConsoleErrors = consoleErrors.filter((e) => now - e.ts < 30000)`) and rename the variable so the JSX consumes `consoleErrors` directly.

> **Correction (post-implementation note):** Re-renders driven by the `now` ticker do NOT prune stale entries on their own — if error traffic stops, the JSX would hold stale rows until the next `console.error`. The shipped fix therefore prunes inside the 1 s tick (`setConsoleErrors((prev) => prev.filter((e) => e.ts >= ts - 30000))`) in addition to the on-write filter. See `src/components/debug/DebugAuthOverlay.tsx:139-157`.

Constraints:
- Do NOT change the `ConsoleErrorEntry` interface.
- Do NOT change the `useEffect` dependency array.
- Do NOT touch any other section of the overlay (session, pkce, cookies, storage, breadcrumbs).
- Preserve the `originalConsoleError(...args)` passthrough exactly.

Per UI-REVIEW Top-3 Fix #2.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__ 2>&1 | tail -20</automated>
  </verify>
  <done>
- `setConsoleErrors` updater includes `prev.filter((e) => ts - e.ts < 30000)`.
- Render-time filter expression `consoleErrors.filter((e) => now - e.ts < 30000)` is removed (or replaced by direct use of bounded state).
- `npm test` passes (no new failures); existing 378-test suite is green.
- `tsc -b --noEmit` clean (lint-staged gate would catch otherwise).
  </done>
</task>

<task type="auto">
  <name>Task 2: Extract CONSENT_CARD_MAX_W shared constant</name>
  <files>src/lib/consent-styles.ts, src/components/ConsentBanner.tsx, src/components/ConsentChip.tsx</files>
  <action>
Create `src/lib/consent-styles.ts` exporting a single named constant for the consent-card max-width Tailwind class shared by ConsentBanner and ConsentChip. Then replace both inline literals.

Step 1 — Create `src/lib/consent-styles.ts`:
```ts
// Phase 6 UI-REVIEW Fix #3 — shared width token for the consent-card surfaces
// (ConsentBanner + ConsentChip). UI-SPEC §3.1 locks both surfaces to
// `min(20rem, calc(100vw - 2rem))`. Centralizing prevents spec drift.
//
// NOTE: DebugAuthOverlay uses `min(28rem, ...)` and is intentionally NOT
// covered by this token — it is a different surface with a different width.

export const CONSENT_CARD_MAX_W = 'max-w-[min(20rem,calc(100vw-2rem))]' as const
```

Step 2 — In `src/components/ConsentBanner.tsx`:
- Add `import { CONSENT_CARD_MAX_W } from '@/lib/consent-styles'` to the import block.
- On line 31, replace the inline `max-w-[min(20rem,calc(100vw-2rem))]` substring with `${CONSENT_CARD_MAX_W}` (template-literal interpolation of the existing className string), OR convert the className to a `cn(...)` call from `@/lib/utils`. The OUTPUT class string MUST be byte-equivalent to before (twMerge does not collapse the token because there is no conflicting `max-w-*`).

Recommended exact form for ConsentBanner.tsx line 31:
```tsx
<div className={`fixed bottom-4 right-4 z-40 rounded-lg border bg-card shadow-md p-4 ${CONSENT_CARD_MAX_W} transition-opacity`}>
```

Step 3 — In `src/components/ConsentChip.tsx`:
- Add `import { CONSENT_CARD_MAX_W } from '@/lib/consent-styles'` to the import block.
- On line 45, apply the identical substitution:
```tsx
<div className={`fixed bottom-4 right-4 z-40 rounded-lg border bg-card shadow-md p-3 ${CONSENT_CARD_MAX_W} transition-opacity`}>
```

Constraints (UI-SPEC locked — DO NOT REGRESS):
- Final emitted className must contain ALL these tokens in some order: `fixed`, `bottom-4`, `right-4`, `z-40`, `rounded-lg`, `border`, `bg-card`, `shadow-md`, `p-4` (banner) or `p-3` (chip), `max-w-[min(20rem,calc(100vw-2rem))]`, `transition-opacity`.
- Do NOT touch DebugAuthOverlay (different width — `min(28rem,...)`).
- Do NOT change anchor, z-index, padding, or any other class on either component.
- Do NOT change copy or button variants.

Per UI-REVIEW Top-3 Fix #3.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/components/ConsentBanner.test.tsx src/__tests__/components/ConsentChip.test.tsx 2>&1 | tail -20 &amp;&amp; grep -c 'max-w-\[min(20rem,calc(100vw-2rem))\]' src/components/ConsentBanner.tsx src/components/ConsentChip.tsx</automated>
  </verify>
  <done>
- `src/lib/consent-styles.ts` exists and exports `CONSENT_CARD_MAX_W`.
- ConsentBanner.tsx and ConsentChip.tsx both `import { CONSENT_CARD_MAX_W } from '@/lib/consent-styles'`.
- The literal `max-w-[min(20rem,calc(100vw-2rem))]` no longer appears as inline source text in ConsentBanner.tsx or ConsentChip.tsx (it is now sourced from the constant).
- `grep -r "max-w-\[min(20rem" src/` returns hits only in `src/lib/consent-styles.ts` (single source of truth).
- DebugAuthOverlay.tsx still contains its own `max-w-[min(28rem,calc(100vw-2rem))]` (untouched).
- ConsentBanner.test.tsx and ConsentChip.test.tsx pass — copy + behavior unchanged.
- `tsc -b --noEmit` clean.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add ConsentBanner + ConsentChip mutual-exclusion integration test</name>
  <files>src/__tests__/components/ConsentMutualExclusion.test.tsx</files>
  <action>
Create a new Vitest integration test that mounts BOTH `ConsentBanner` and `ConsentChip` together inside a single `<ConsentProvider>` and asserts that exactly one of them renders for each consent state.

Test plan:
1. **State `undecided`** (no localStorage write): banner copy `We can record anonymous usage to help us improve this site.` IS in DOM; chip copies `Anonymous usage analytics are on.` and `Anonymous usage analytics are off.` are NOT in DOM.
2. **State `allow`** (`localStorage.setItem('wtcs_consent','allow')` BEFORE render): banner copy NOT in DOM; chip allow-state copy `Anonymous usage analytics are on.` IS in DOM.
3. **State `decline`** (`localStorage.setItem('wtcs_consent','decline')` BEFORE render): banner copy NOT in DOM; chip decline-state copy `Anonymous usage analytics are off.` IS in DOM.

Use the same mock setup as the existing ConsentBanner.test.tsx / ConsentChip.test.tsx (mock `@/lib/posthog`, `@/lib/sentry`, `@tanstack/react-router`).

EXACT file content:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/posthog', () => ({
  posthog: {
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
  initPostHog: vi.fn(),
}))
vi.mock('@/lib/sentry', () => ({
  loadSentryReplayIfConsented: vi.fn(),
}))

let currentPathname = '/'
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: currentPathname } }),
}))

import { ConsentBanner } from '@/components/ConsentBanner'
import { ConsentChip } from '@/components/ConsentChip'
import { ConsentProvider } from '@/contexts/ConsentContext'

const BANNER_COPY = 'We can record anonymous usage to help us improve this site.'
const CHIP_ON_COPY = 'Anonymous usage analytics are on.'
const CHIP_OFF_COPY = 'Anonymous usage analytics are off.'

function renderBoth() {
  return render(
    <ConsentProvider>
      <ConsentBanner />
      <ConsentChip />
    </ConsentProvider>,
  )
}

describe('ConsentBanner + ConsentChip mutual exclusion (UI-REVIEW Fix #1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    currentPathname = '/'
  })

  it('undecided: only the banner renders, chip is suppressed', () => {
    renderBoth()
    expect(screen.getByText(BANNER_COPY)).toBeInTheDocument()
    expect(screen.queryByText(CHIP_ON_COPY)).not.toBeInTheDocument()
    expect(screen.queryByText(CHIP_OFF_COPY)).not.toBeInTheDocument()
  })

  it('allow: only the chip renders (allow-state copy), banner is suppressed', () => {
    window.localStorage.setItem('wtcs_consent', 'allow')
    renderBoth()
    expect(screen.queryByText(BANNER_COPY)).not.toBeInTheDocument()
    expect(screen.getByText(CHIP_ON_COPY)).toBeInTheDocument()
    expect(screen.queryByText(CHIP_OFF_COPY)).not.toBeInTheDocument()
  })

  it('decline: only the chip renders (decline-state copy), banner is suppressed', () => {
    window.localStorage.setItem('wtcs_consent', 'decline')
    renderBoth()
    expect(screen.queryByText(BANNER_COPY)).not.toBeInTheDocument()
    expect(screen.queryByText(CHIP_ON_COPY)).not.toBeInTheDocument()
    expect(screen.getByText(CHIP_OFF_COPY)).toBeInTheDocument()
  })

  it('admin route: both surfaces are suppressed regardless of consent state', () => {
    window.localStorage.setItem('wtcs_consent', 'allow')
    currentPathname = '/admin/categories'
    const { container } = renderBoth()
    expect(container).toBeEmptyDOMElement()
  })
})
```

Constraints:
- Use `screen.queryByText` (not `getByText`) for negative assertions — avoid throw-on-not-found.
- Test file path MUST be `src/__tests__/components/ConsentMutualExclusion.test.tsx` to match existing convention.
- Do NOT add new mocks beyond the three already used in sibling tests.
- Do NOT modify `ConsentBanner.tsx`, `ConsentChip.tsx`, or `ConsentContext.tsx`.

Per UI-REVIEW Top-3 Fix #1.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/components/ConsentMutualExclusion.test.tsx 2>&1 | tail -15</automated>
  </verify>
  <done>
- File `src/__tests__/components/ConsentMutualExclusion.test.tsx` exists.
- All 4 test cases pass (undecided, allow, decline, admin route).
- Full `npm test` suite passes — no regressions in existing 378 tests.
- `npx eslint src/__tests__/components/ConsentMutualExclusion.test.tsx --max-warnings 0` clean.
  </done>
</task>

</tasks>

<verification>
After all 3 tasks:

1. `npm test` — full suite passes (existing 378 + ~4 new mutual-exclusion cases).
2. `npm run lint` — zero warnings/errors.
3. `tsc -b --noEmit` — clean.
4. `grep -r "max-w-\[min(20rem" src/` — exactly one source-of-truth hit (in `src/lib/consent-styles.ts`).
5. `grep -n "setConsoleErrors" src/components/debug/DebugAuthOverlay.tsx` — the `prev.filter((e) => ts - e.ts < 30000)` prune appears inside the updater.
6. Manual visual check (optional, dev server): `npm run dev`, clear localStorage, reload `/` — banner appears at `bottom-4 right-4` exactly as before; click Allow → banner disappears, chip appears at same anchor with on-state copy. No layout shift, no double-render.
</verification>

<success_criteria>
- [ ] DebugAuthOverlay's `consoleErrors` is bounded inside the setState updater (no longer monotonically grows).
- [ ] `src/lib/consent-styles.ts` is the single source of truth for `CONSENT_CARD_MAX_W`.
- [ ] ConsentBanner.tsx and ConsentChip.tsx import the shared token; no inline `max-w-[min(20rem,...)]` literal remains in either component file.
- [ ] DebugAuthOverlay's separate `min(28rem,...)` width is untouched (different surface).
- [ ] ConsentMutualExclusion.test.tsx exists and asserts exactly one of (banner | chip) is in the DOM per consent state.
- [ ] All existing tests pass; no DOM/visual regression on banner, chip, or overlay.
- [ ] No UI-SPEC locked decisions changed (anchor, z-index, padding, copy, accent reservation, button variants).
</success_criteria>

<output>
After completion, create `.planning/quick/260426-cty-fix-phase-6-ui-review-items-prune-debuga/260426-cty-SUMMARY.md` summarizing:
- File diffs (3 files modified, 2 files created).
- Test results (existing + 4 new cases).
- Confirmation that no UI-SPEC contract was touched.
- Note that fix #1 (mutual-exclusion test) is the highest-value addition — it locks the render-guard contract against future regressions.
</output>
