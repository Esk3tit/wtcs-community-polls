# Phase 2: Browsing & Responding - Research

**Researched:** 2026-04-06
**Domain:** Supabase Edge Functions, React polling, shadcn/ui component patterns, Supabase RLS queries
**Confidence:** HIGH

## Summary

Phase 2 transforms the empty Topics and Archive shell routes into a fully functional suggestion browsing and responding experience. The database schema, RLS policies, and triggers already exist from Phase 1 -- this phase is purely about building the frontend components, creating one Supabase Edge Function for vote submission, extending seed data, and writing tests.

The technical approach is straightforward: query the existing `polls`, `choices`, `categories`, `votes`, and `vote_counts` tables via Supabase JS client (reads go direct with RLS), submit responses through a new Edge Function (bypasses RLS with service_role), and poll `vote_counts` on an interval for live updates. The UI is well-specified in the UI-SPEC with exact component compositions, colors, and interaction states.

**Primary recommendation:** Build the Edge Function first (it's the only backend piece), then the data layer hooks, then the UI components bottom-up (badges/bars -> card -> list -> page), then wire up polling, and finally write tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-20:** Stacked full-width cards within the existing max-w-2xl centered layout. No grid, no separate detail page.
- **D-21:** All content lives inline on the card -- no separate /topics/:id detail route. Cards expand/collapse in place.
- **D-22:** Pinned suggestions are always expanded (full description, image, choices visible). Non-pinned suggestions are collapsed (title + category + meta) and expand on click.
- **D-23:** Card anatomy follows the mockup with pinned banner, category pill, resolution status pill, title, description, image, choice buttons/result bars, footer.
- **D-24:** Click-to-vote -- clicking a choice button submits instantly. No confirmation dialog, no separate submit button. A toast notification confirms "Response recorded."
- **D-25:** Votes are permanent and cannot be changed (enforced by DB constraints).
- **D-26:** Pre-vote state shows choices as side-by-side buttons. Footer shows "{N} votes -- vote to see results".
- **D-27:** Post-vote state replaces choice buttons with inline progress bars showing percentages.
- **D-28:** Results update via HTTP polling every 5-10 seconds (RSLT-04). No WebSockets.
- **D-29:** Closed suggestions with a resolution show the resolution status pill. Results bars always visible for users who voted.
- **D-30:** Category pills/tabs in a horizontal row: "All" + one per category.
- **D-31:** Search bar above category pills. Filters suggestions by title text as user types (debounced). Combined with category filter.
- **D-32:** Empty state when no matches: centered message with "Clear filters" button.
- **D-33:** SQL seed file extended with realistic WTCS sample data.

### Claude's Discretion
- Component file organization and naming within src/
- Custom hook design for data fetching and polling
- Edge Function internal structure and error handling patterns
- Test organization and mock strategy

### Deferred Ideas (OUT OF SCOPE)
- No rate limiting in Phase 2 (VOTE-04 is Phase 3)
- No Discord server membership check (Phase 3)
- No admin CRUD for suggestions (Phase 4) -- seed data only
- No admin category management (Phase 4) -- seed data only
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOTE-01 | Authenticated user can submit one response per suggestion (UNIQUE constraint at DB level) | DB constraint `votes_one_per_user_per_poll` already exists. Edge Function inserts into `votes` table. Client checks `votes` table for existing user vote. |
| VOTE-02 | Response submission goes through Supabase Edge Function with server-side validation | New Edge Function at `supabase/functions/submit-vote/index.ts`. Uses `Deno.serve()`, service_role client, validates poll is active, user hasn't voted, choice belongs to poll. |
| VOTE-03 | Response cannot be changed or deleted after submission (no UPDATE/DELETE via RLS) | Already enforced: RLS has no INSERT/UPDATE/DELETE policies on `votes` for authenticated role. Edge Function uses service_role which bypasses RLS for inserts only. |
| RSLT-01 | Results are hidden until user has responded to that suggestion | RLS policy `"Vote counts visible to voters"` on `vote_counts` already enforces this. Client query returns empty for non-voters. |
| RSLT-02 | After responding, user sees live percentages and raw response counts per choice | Query `vote_counts` table (accessible after voting per RLS). Calculate percentages client-side from count values. |
| RSLT-03 | Response counts are pre-aggregated via Postgres trigger into vote_counts table | Already implemented: `increment_vote_count` trigger on `votes` INSERT upserts into `vote_counts`. |
| RSLT-04 | Frontend polls vote_counts every 5-10 seconds for live updates | Custom `usePolling` hook with `setInterval` at 8-second intervals. Pauses when tab hidden via `document.visibilityState`. |
| RSLT-05 | Only users who responded can see results (even after suggestion closes) | Already enforced by RLS policy on `vote_counts` table. No additional code needed. |
| CATG-02 | Active suggestions displayed in browsable list on main page | Query `polls` table with `status='active'`, join `categories`, `choices`. Display in Topics route. |
| CATG-03 | Users can filter suggestions by category via tabs/pills | Client-side filtering using category_id. Category pills built from `categories` table query. |
| CATG-04 | Users can search/filter suggestions by text | Client-side search with debounced text filter on poll title. Combined with category filter. |
| INFR-04 | All response writes go through Supabase Edge Functions | Edge Function `submit-vote` handles all vote inserts. No direct client writes to `votes` table. |
| TEST-03 | Response submission and result visibility have unit/integration tests | Vitest + RTL tests for: vote submission flow, one-response enforcement, respond-then-reveal, respondents-only results. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.101.1 | Database queries + Edge Function invocation | Already installed, typed client for all Supabase operations [VERIFIED: package.json] |
| React | 19.2.4 | UI framework | Already installed [VERIFIED: package.json] |
| TanStack Router | 1.168.10 | File-based routing | Already installed, routes exist [VERIFIED: package.json] |
| Tailwind CSS | 4.2.2 | Styling | Already installed [VERIFIED: package.json] |
| shadcn/ui (Maia style) | latest | Component primitives | Already partially installed (Button, Card, Sheet, DropdownMenu, Sonner) [VERIFIED: src/components/ui/] |
| Vitest | 4.1.2 | Testing framework | Already installed and configured [VERIFIED: vite.config.ts] |
| @testing-library/react | 16.3.2 | Component testing | Already installed [VERIFIED: package.json] |
| sonner | 2.0.7 | Toast notifications | Already installed, Toaster in root layout [VERIFIED: src/routes/__root.tsx] |
| lucide-react | 1.7.0 | Icons | Already installed [VERIFIED: package.json] |

### New shadcn Components (Phase 2)
| Component | Purpose | Install |
|-----------|---------|---------|
| Badge | Category pills, status badges | `npx shadcn@latest add badge` |
| Collapsible | Card expand/collapse with animation | `npx shadcn@latest add collapsible` |
| Input | Search bar | `npx shadcn@latest add input` |
| Progress | Result bar track (may customize) | `npx shadcn@latest add progress` |

**Install command:** `npx shadcn@latest add badge collapsible input progress` [CITED: 02-UI-SPEC.md Registry Safety section]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| setInterval polling | TanStack Query refetchInterval | TanStack Query adds a dependency; raw setInterval is simpler for this single use case and avoids adding ~40KB to bundle |
| Custom progress bars | shadcn Progress | shadcn Progress is single-color; we need custom styling for user's-choice vs other-choices bars. Use Progress as base, extend with custom className. |
| Client-side filtering | Server-side filtering via Supabase .ilike() | Client-side is simpler, avoids extra queries, and works fine at the expected scale (< 50 active polls) |

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    suggestions/            # New: suggestion-related components
      SuggestionCard.tsx     # Main card (collapsed + expanded states)
      SuggestionList.tsx     # List with filtering/search
      ChoiceButtons.tsx      # Pre-vote choice buttons
      ResultBars.tsx         # Post-vote result display
      CategoryFilter.tsx     # Category pill tabs
      SearchBar.tsx          # Search input with debounce
      PinnedBanner.tsx       # Amber pinned banner
      StatusBadge.tsx        # Category + resolution badges
      EmptyState.tsx         # No results / no topics states
      SuggestionSkeleton.tsx # Loading skeleton cards
    ui/                     # Existing shadcn components
      badge.tsx             # New (Phase 2)
      collapsible.tsx       # New (Phase 2)
      input.tsx             # New (Phase 2)
      progress.tsx          # New (Phase 2)
      button.tsx            # Existing
      card.tsx              # Existing
      ...
  hooks/
    useAuth.ts              # Existing
    useSuggestions.ts       # New: fetch polls + choices + user votes
    useVoteSubmit.ts        # New: invoke Edge Function, optimistic update
    usePolling.ts           # New: interval-based vote_counts refresh
    useCategories.ts        # New: fetch categories
  lib/
    supabase.ts             # Existing client
    types/
      database.types.ts     # Existing generated types
      suggestions.ts        # New: derived types for UI (SuggestionWithChoices, VoteResult, etc.)
    utils.ts                # Existing
    format.ts               # New: time remaining formatter, percentage calc
  routes/
    topics.tsx              # Existing shell -> full implementation
    archive.tsx             # Existing shell -> full implementation
supabase/
  functions/
    submit-vote/
      index.ts              # New: Edge Function for vote submission
    _shared/
      cors.ts               # New: shared CORS headers
  migrations/               # Existing (no new migrations needed)
  seed.sql                  # Extended with sample data (D-33)
```

### Pattern 1: Data Fetching with Supabase Client
**What:** Direct Supabase queries from custom hooks, using the typed client.
**When to use:** All read operations (polls, choices, categories, votes, vote_counts).
**Example:**
```typescript
// Source: Supabase JS client pattern [VERIFIED: existing AuthContext.tsx pattern]
import { supabase } from '@/lib/supabase'

export function useSuggestions(status: 'active' | 'closed') {
  const [suggestions, setSuggestions] = useState<SuggestionWithChoices[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSuggestions() {
      // Fetch polls with their choices and category
      const { data: polls, error } = await supabase
        .from('polls')
        .select(`
          *,
          categories(*),
          choices(*)
        `)
        .eq('status', status)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (!error && polls) {
        setSuggestions(polls)
      }
      setLoading(false)
    }
    fetchSuggestions()
  }, [status])

  return { suggestions, loading }
}
```

### Pattern 2: Edge Function Invocation
**What:** Client invokes Edge Function via `supabase.functions.invoke()`.
**When to use:** Vote submission (the only write operation in Phase 2).
**Example:**
```typescript
// Source: Supabase docs [CITED: supabase.com/docs/reference/javascript/functions-invoke]
const { data, error } = await supabase.functions.invoke('submit-vote', {
  body: { poll_id: pollId, choice_id: choiceId },
})
```

### Pattern 3: HTTP Polling with Visibility API
**What:** Periodic refetch of vote_counts with pause when tab is hidden.
**When to use:** Live result updates for suggestions the user has voted on (RSLT-04).
**Example:**
```typescript
// Source: React polling best practice [CITED: overreacted.io/making-setinterval-declarative-with-react-hooks]
function usePolling(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delay === null) return

    function tick() {
      if (document.visibilityState === 'visible') {
        savedCallback.current()
      }
    }

    const id = setInterval(tick, delay)
    return () => clearInterval(id)
  }, [delay])
}
```

### Pattern 4: Edge Function Structure (Deno)
**What:** Supabase Edge Function with CORS, auth verification, service_role DB access.
**When to use:** The `submit-vote` function.
**Example:**
```typescript
// Source: Supabase Edge Functions docs
// [CITED: supabase.com/docs/guides/functions/cors]
// [CITED: supabase.com/docs/guides/functions/auth]
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization')!
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse and validate body
    const { poll_id, choice_id } = await req.json()
    if (!poll_id || !choice_id) {
      return new Response(JSON.stringify({ error: 'Missing poll_id or choice_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Use service_role client for writes (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Validate poll is active
    const { data: poll } = await supabaseAdmin
      .from('polls')
      .select('id, status')
      .eq('id', poll_id)
      .single()

    if (!poll || poll.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Poll is not active' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Insert vote (DB constraints handle uniqueness + choice validation)
    const { error: voteError } = await supabaseAdmin
      .from('votes')
      .insert({ poll_id, choice_id, user_id: user.id })

    if (voteError) {
      // UNIQUE constraint violation = already voted
      if (voteError.code === '23505') {
        return new Response(JSON.stringify({ error: 'Already voted' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      throw voteError
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### Anti-Patterns to Avoid
- **Direct INSERT from client to votes table:** RLS blocks this by design. All writes go through the Edge Function with service_role. Never add INSERT policies for authenticated users on votes.
- **Computing aggregates client-side:** Don't SELECT COUNT from votes. The `vote_counts` table is pre-aggregated by the `increment_vote_count` trigger. Always read from `vote_counts`.
- **Polling when results are hidden:** Only poll `vote_counts` for suggestions the current user has voted on. For unvoted suggestions, polling is wasteful and RLS would return empty anyway.
- **Separate detail route:** D-21 explicitly says no `/topics/:id` route. All content is inline on the card with expand/collapse.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast system | sonner (already installed) | Handles stacking, auto-dismiss, accessibility, theme integration |
| Expand/collapse with animation | Custom CSS height transitions | shadcn Collapsible (Radix) | Handles aria-expanded, keyboard, animation states, reduced motion |
| CORS headers | Manual header construction | Shared `_shared/cors.ts` pattern | Standard Supabase pattern, ensures all required headers included |
| Debounced search | Manual setTimeout/clearTimeout | `useDebounce` custom hook (tiny) | Avoids stale closure bugs, cleanup on unmount |
| Time remaining display | Manual date math | Utility function with Intl.RelativeTimeFormat or simple math | Edge cases: past dates, timezone handling, "Closes soon" threshold |
| Percentage calculation | Inline math in JSX | Utility function `calcPercentage(count, total)` | Handles division by zero, rounding consistency |

**Key insight:** The UI-SPEC already prescribes exact shadcn components for every element. Follow the spec -- don't invent custom alternatives.

## Common Pitfalls

### Pitfall 1: Stale Polling Callbacks
**What goes wrong:** `setInterval` callback captures stale state values, showing outdated data.
**Why it happens:** JavaScript closures in setInterval capture variables at creation time, not at execution time.
**How to avoid:** Use a `useRef` to hold the latest callback function. Update the ref on every render, but only set the interval once.
**Warning signs:** Vote counts don't update even though the interval is running.

### Pitfall 2: RLS Returns Empty Instead of Error
**What goes wrong:** Query to `vote_counts` for a poll the user hasn't voted on returns empty array, not an error. Developer may interpret this as "no votes exist."
**Why it happens:** Supabase RLS filters rows silently -- it returns the rows the user is allowed to see, which is zero if they haven't voted.
**How to avoid:** Check the user's vote status separately (query `votes` for their user_id + poll_id). Use the vote existence to determine whether to show results UI or choice buttons.
**Warning signs:** Pre-vote and post-vote states show the same thing; results always appear empty.

### Pitfall 3: Race Condition on Vote Submit
**What goes wrong:** User double-clicks a choice button, sending two requests. Second request fails with UNIQUE constraint violation, showing an error toast.
**Why it happens:** No client-side debouncing or optimistic state update.
**How to avoid:** Immediately disable all choice buttons on first click (set loading state). Show spinner on clicked button. Update UI optimistically before server response confirms.
**Warning signs:** Error toasts appearing on vote submission despite the vote succeeding.

### Pitfall 4: Edge Function CORS Preflight Failure
**What goes wrong:** Browser sends OPTIONS preflight request, Edge Function returns 401 or doesn't handle it, blocking the actual POST.
**Why it happens:** OPTIONS handler must be the very first check in the Edge Function, before any auth or body parsing.
**How to avoid:** Always check `req.method === 'OPTIONS'` first and return 200 with CORS headers. Include CORS headers in ALL responses (success and error).
**Warning signs:** Network tab shows CORS errors; function works via curl but not from browser.

### Pitfall 5: Supabase Client Auth Header on Function Invoke
**What goes wrong:** Edge Function receives no auth token, returns 401.
**Why it happens:** The Supabase JS client automatically includes the user's JWT in the `Authorization` header when calling `functions.invoke()`, but only if the user has an active session.
**How to avoid:** Ensure the user is authenticated before calling `functions.invoke()`. The AuthGuard already handles this at the route level, but the hook should also verify `session` exists.
**Warning signs:** Edge Function auth check fails for logged-in users.

### Pitfall 6: Collapsible Animation Without CSS Keyframes
**What goes wrong:** Collapsible content appears/disappears instantly without animation.
**Why it happens:** shadcn Collapsible requires CSS keyframes `collapsible-down` and `collapsible-up` to be defined. These are typically added when you install the component but may need manual addition to Tailwind config.
**How to avoid:** After installing Collapsible, verify the keyframes exist in your CSS or Tailwind config. shadcn's `add` command should handle this, but double-check.
**Warning signs:** Content shows/hides with no transition.

## Code Examples

### Querying Polls with Related Data
```typescript
// Source: Supabase JS select with relations [VERIFIED: database schema has FKs]
const { data, error } = await supabase
  .from('polls')
  .select(`
    *,
    categories!polls_category_id_fkey(id, name, slug, sort_order),
    choices(id, label, sort_order)
  `)
  .eq('status', 'active')
  .order('is_pinned', { ascending: false })
  .order('created_at', { ascending: false })
```

### Checking If User Has Voted
```typescript
// Source: RLS policy allows users to see only their own votes [VERIFIED: RLS migration]
const { data: userVotes } = await supabase
  .from('votes')
  .select('poll_id, choice_id')
  .eq('user_id', userId)

// Creates a Map for O(1) lookup: pollId -> choiceId
const votedPolls = new Map(
  userVotes?.map(v => [v.poll_id, v.choice_id]) ?? []
)
```

### Fetching Vote Counts (Post-Vote Only)
```typescript
// Source: RLS ensures this only returns data for polls user voted on [VERIFIED: RLS migration]
const { data: counts } = await supabase
  .from('vote_counts')
  .select('poll_id, choice_id, count')
  .in('poll_id', votedPollIds)
```

### Shared CORS Headers
```typescript
// supabase/functions/_shared/cors.ts
// Source: Supabase CORS docs [CITED: supabase.com/docs/guides/functions/cors]
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

### Toast on Vote Submission
```typescript
// Source: sonner API [VERIFIED: sonner already installed and configured]
import { toast } from 'sonner'

// Success
toast.success('Response recorded')

// Error
toast.error('Could not submit response. Try again.')

// Already voted
toast.error('You have already responded to this topic.')
```

### Debounce Hook
```typescript
// Simple debounce hook for search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
```

### Time Remaining Formatter
```typescript
// Utility for D-23 time remaining display
function formatTimeRemaining(closesAt: string): string {
  const now = new Date()
  const closes = new Date(closesAt)
  const diffMs = closes.getTime() - now.getTime()

  if (diffMs <= 0) return 'Closed'
  if (diffMs < 60 * 60 * 1000) return 'Closes soon'

  const hours = Math.floor(diffMs / (60 * 60 * 1000))
  if (hours < 24) return `${hours} hours left`

  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} left`
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Deno.serve()` in Edge Functions | Still current standard | Supabase Edge Runtime 1.x+ | Use `Deno.serve()` not deprecated `serve()` from std |
| Manual CORS header lists | Import from `_shared/cors.ts` | Ongoing best practice | Prevents CORS header drift across functions |
| `supabase.functions.invoke()` | Still current in @supabase/supabase-js 2.x | Stable | Auto-includes auth token from active session |
| Radix Collapsible | shadcn wraps Radix via `radix-ui` package | radix-ui 1.4.x unified package | Project uses unified `radix-ui` (verified in package.json) |

**Deprecated/outdated:**
- `serve()` from Deno standard library: replaced by `Deno.serve()` built-in [ASSUMED]
- Legacy `supabase.functions.invoke()` with `headers` option for auth: client auto-injects auth headers now [VERIFIED: Supabase docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Deno.serve()` is the current API (not `serve()` from std/http) | Architecture Patterns | Edge Function would fail to compile; easy to fix by switching to correct import |
| A2 | Supabase CLI `supabase functions new` creates the correct file structure | Architecture Patterns | Would need to manually create `supabase/functions/submit-vote/index.ts`; trivial |
| A3 | Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as automatic env vars in Edge Functions | Code Examples | Would need to set them manually in dashboard; docs indicate they are automatic |
| A4 | PostgreSQL error code `23505` is returned by Supabase for UNIQUE constraint violations | Code Examples | Would need to check actual error format; could be wrapped differently by PostgREST |
| A5 | `collapsible-down` / `collapsible-up` CSS keyframes are auto-added by `npx shadcn@latest add collapsible` | Pitfalls | Would need manual keyframe definition in CSS |

## Open Questions

1. **Edge Function deployment for production**
   - What we know: Edge Functions are deployed via `supabase functions deploy submit-vote` or via Supabase dashboard
   - What's unclear: Whether the production Supabase project has been set up for Edge Functions, and whether there's a CI/CD pipeline
   - Recommendation: Document deployment as a manual step in the plan; production deployment is a Phase 5 concern

2. **Seed data volume and realism**
   - What we know: D-33 requires realistic WTCS sample data with categories, suggestions, choices, and some votes
   - What's unclear: Exact number of seed suggestions and the preferred scenario mix (how many pinned, how many closed, how many with votes)
   - Recommendation: Create 3 categories, 6-8 suggestions (2 pinned, 2 closed with resolutions, rest active), 2-3 choices each, some with simulated votes

3. **Collapsible animation keyframes**
   - What we know: shadcn Collapsible uses Radix's data-state attributes for animation
   - What's unclear: Whether Tailwind CSS v4 + shadcn's install handles keyframe injection automatically or if manual CSS is needed
   - Recommendation: Plan for manual keyframe addition as a fallback step after component installation

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + npm | Build, dev server, tests | Yes | (in use) | -- |
| Docker | Supabase local dev (Edge Functions) | Yes | 24.0.2 | -- |
| Deno CLI | Edge Function development/testing | No | -- | Supabase CLI bundles its own Edge Runtime for `supabase functions serve`; Deno CLI not strictly required |
| Supabase CLI | Edge Function scaffolding + local dev | Yes | 2.85.0 | -- |
| Vitest | Unit/integration tests | Yes | 4.1.2 | -- |

**Missing dependencies with no fallback:**
- None -- all critical dependencies are available.

**Missing dependencies with fallback:**
- Deno CLI is not installed, but Supabase CLI's `functions serve` command uses its own Edge Runtime, so local Edge Function development and testing works without a standalone Deno install. [CITED: supabase.com/docs/guides/functions/architecture]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + @testing-library/react 16.3.2 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npm test` |
| Full suite command | `npm run test:coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOTE-01 | One response per user per suggestion | unit | `npx vitest run src/__tests__/suggestions/vote-submission.test.tsx -t "prevents duplicate"` | Wave 0 |
| VOTE-02 | Response goes through Edge Function | integration | `npx vitest run src/__tests__/suggestions/vote-submission.test.tsx -t "invokes edge function"` | Wave 0 |
| VOTE-03 | Response cannot be changed/deleted | unit | `npx vitest run src/__tests__/suggestions/vote-submission.test.tsx -t "immutable"` | Wave 0 |
| RSLT-01 | Results hidden until user responds | unit | `npx vitest run src/__tests__/suggestions/results-visibility.test.tsx -t "hidden before vote"` | Wave 0 |
| RSLT-02 | Post-vote shows percentages and counts | unit | `npx vitest run src/__tests__/suggestions/results-visibility.test.tsx -t "shows percentages"` | Wave 0 |
| RSLT-05 | Only respondents see results (even after close) | unit | `npx vitest run src/__tests__/suggestions/results-visibility.test.tsx -t "respondents only"` | Wave 0 |
| CATG-02 | Active suggestions in browsable list | unit | `npx vitest run src/__tests__/suggestions/suggestion-list.test.tsx -t "displays active"` | Wave 0 |
| CATG-03 | Filter by category | unit | `npx vitest run src/__tests__/suggestions/suggestion-list.test.tsx -t "filters by category"` | Wave 0 |
| CATG-04 | Search by text | unit | `npx vitest run src/__tests__/suggestions/suggestion-list.test.tsx -t "searches by text"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm run test:coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/suggestions/vote-submission.test.tsx` -- covers VOTE-01, VOTE-02, VOTE-03
- [ ] `src/__tests__/suggestions/results-visibility.test.tsx` -- covers RSLT-01, RSLT-02, RSLT-05
- [ ] `src/__tests__/suggestions/suggestion-list.test.tsx` -- covers CATG-02, CATG-03, CATG-04

### Test Mocking Strategy
Based on the existing test patterns in `src/__tests__/auth/auth-guard.test.tsx`: [VERIFIED: codebase]
- **Mock `useAuth`:** Use `vi.mock('@/hooks/useAuth')` with `vi.fn()` to control auth state per test
- **Mock `supabase`:** Use `vi.mock('@/lib/supabase')` to mock `.from().select()`, `.functions.invoke()` etc.
- **Mock `sonner`:** Use `vi.mock('sonner')` to verify toast calls
- **Pattern:** Module-level `vi.mock()` with `vi.fn()` factories, `beforeEach` clears mocks

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (inherited) | Supabase Auth with Discord OAuth -- user must be authenticated to browse/vote |
| V3 Session Management | Yes (inherited) | Supabase session management -- JWT in Authorization header |
| V4 Access Control | Yes | RLS policies enforce per-user data visibility. Edge Function validates user identity server-side. |
| V5 Input Validation | Yes | Edge Function validates poll_id/choice_id existence, poll status, and choice-poll relationship |
| V6 Cryptography | No | No custom crypto -- Supabase handles JWT signing |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Vote manipulation (bypass client, direct API) | Tampering | Edge Function with service_role validates all constraints server-side. No INSERT RLS policy on votes table. |
| Duplicate voting | Elevation of Privilege | UNIQUE constraint `votes_one_per_user_per_poll` at DB level. Edge Function returns 409 on duplicate. |
| Result snooping (view results without voting) | Information Disclosure | RLS policy on `vote_counts` requires existing vote in `votes` table for same poll_id + user_id. |
| Cross-poll choice injection | Tampering | `validate_vote_choice` trigger ensures choice_id belongs to poll_id. |
| CSRF on vote submission | Tampering | supabase-js includes JWT in Authorization header (not cookie-based), inherently CSRF-resistant. |

## Project Constraints (from CLAUDE.md)

- **Budget:** $0/month -- Supabase free tier, Netlify legacy free tier
- **Tech stack:** Vite + React + TypeScript + TanStack Router + shadcn/ui + Tailwind CSS v4 (locked)
- **Auth:** Discord OAuth only via Supabase native Discord provider
- **Scale:** Must work within Supabase free tier limits (500MB DB, 1GB storage, 2M Edge Function invocations/month)
- **Design system:** shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font
- **Reads:** Direct from browser via Supabase JS client with RLS policies (INFR-03)
- **Writes:** All response writes through Supabase Edge Functions (INFR-04)
- **No unused locals/params:** TypeScript strict mode enforced (`noUnusedLocals`, `noUnusedParameters`)
- **Module syntax:** `verbatimModuleSyntax: true` -- requires explicit `type` imports
- **User-facing terminology:** "suggestion/topic/response/opinion" -- never "vote/poll/voter/winner"

## Sources

### Primary (HIGH confidence)
- Project codebase -- database schema (`supabase/migrations/`), RLS policies, triggers, existing components, test patterns
- `02-CONTEXT.md` -- all locked decisions (D-20 through D-33)
- `02-UI-SPEC.md` -- complete component inventory, colors, spacing, accessibility contract
- `REQUIREMENTS.md` -- full requirement definitions for VOTE-01..03, RSLT-01..05, CATG-02..04, INFR-04, TEST-03
- `package.json` -- verified all dependency versions

### Secondary (MEDIUM confidence)
- [Supabase Edge Functions docs](https://supabase.com/docs/guides/functions) -- function structure, deployment
- [Supabase functions.invoke() reference](https://supabase.com/docs/reference/javascript/functions-invoke) -- client invocation API
- [Supabase CORS docs](https://supabase.com/docs/guides/functions/cors) -- CORS header pattern
- [Supabase Edge Function auth](https://supabase.com/docs/guides/functions/auth) -- JWT verification, user extraction
- [shadcn/ui Collapsible](https://ui.shadcn.com/docs/components/radix/collapsible) -- component API and usage
- [React polling pattern](https://overreacted.io/making-setinterval-declarative-with-react-hooks/) -- useInterval hook pattern

### Tertiary (LOW confidence)
- Deno.serve() being the current standard over std/http serve -- based on training knowledge, not verified against current Deno docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in package.json
- Architecture: HIGH -- database schema, RLS, triggers fully verified in codebase; patterns well-documented
- Pitfalls: HIGH -- based on verified RLS behavior, known CORS patterns, and established React patterns
- Edge Function patterns: MEDIUM -- based on official docs search results, not hands-on Context7 verification
- Collapsible animation: MEDIUM -- shadcn installation behavior with Tailwind v4 not verified hands-on

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (30 days -- stable ecosystem, no fast-moving dependencies)
