# Technology Stack

**Project:** WTCS Community Polls
**Researched:** 2026-04-06
**Overall Confidence:** HIGH

## Recommended Stack

### Core Framework (Locked)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React | 19.x (installed: 19.2.4) | UI library | Already installed. React 19 brings improved Suspense, use() hook, and Actions — all useful for auth flows and data fetching. | HIGH |
| TypeScript | ~6.0 (installed: 6.0.2) | Type safety | Already installed. | HIGH |
| Vite | 8.x (installed: 8.0.4) | Build tool | Already installed. Fast HMR, native ESM, excellent plugin ecosystem. | HIGH |

### Routing (Locked)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @tanstack/react-router | ^1.168 | Client-side routing | Locked decision. Fully type-safe routing, file-based route generation, built-in code splitting with `autoCodeSplitting`. Matches sibling WTCS Map Vote app's stack. | HIGH |
| @tanstack/router-plugin | ^1.167 | Vite plugin for file-based routing | Generates route tree from filesystem. Import as `@tanstack/router-plugin/vite` in vite.config.ts. Required for file-based routing. | HIGH |
| @tanstack/react-router-devtools | ^1.166 | Router debugging (dev only) | Visual route tree inspection during development. Install as dev dependency. | HIGH |

**Setup pattern:** File-based routing with flat file naming (dots instead of directories). Configure in vite.config.ts with `autoCodeSplitting: true`. Initialize router in main.tsx with `defaultPreload: 'intent'` for hover-based preloading.

### Data Fetching & Server State

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @tanstack/react-query | ^5.96 | Server state management, HTTP polling | Built-in `refetchInterval` for polling vote counts every 5-10s. Automatic cache invalidation, background refetching, and stale-while-revalidate. The standard for React data fetching in 2025-2026. | HIGH |
| @tanstack/react-query-devtools | ^5.96 | Query debugging (dev only) | Inspect cache state, active queries, and refetch behavior during development. | HIGH |

**HTTP polling pattern:**
```typescript
// Poll active poll results every 5 seconds
const { data: voteCounts } = useQuery({
  queryKey: ['voteCounts', pollId],
  queryFn: () => supabase.from('vote_counts').select('*').eq('poll_id', pollId),
  refetchInterval: (query) => {
    // Stop polling if poll is closed
    return query.state.data?.is_active ? 5000 : false;
  },
  refetchIntervalInBackground: false, // Save resources when tab inactive
});
```

### Backend & Auth (Locked)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @supabase/supabase-js | ^2.101 | Supabase client (DB, Auth, Storage, Edge Functions) | Locked decision. Single SDK for all backend needs. Direct browser reads with RLS, Edge Function calls for writes. | HIGH |

**Discord OAuth integration:**

Supabase has native Discord provider support. Call `signInWithOAuth({ provider: 'discord' })` with custom scopes. Key details:

- **Default scopes:** `identify` and `email`
- **Required additional scopes:** `guilds` (for server membership verification) and `guilds.members.read` (for specific server membership check)
- **MFA check:** Discord's `/users/@me` endpoint returns `mfa_enabled` boolean in the user object. Access this via the provider token after auth.
- **Provider token:** Available from `supabase.auth.getSession()` as `session.provider_token`. NOT stored in Supabase DB by design (security). Must be used immediately after login or stored client-side in session.
- **Guild membership verification:** Use provider token to call Discord API `GET /users/@me/guilds` and check for the WT esports server ID.

```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'discord',
  options: {
    scopes: 'identify email guilds',
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

**Critical caveat:** The provider_token is only available on the initial auth callback. Store guild membership result in a Supabase `profiles` table or verify on each login via an Edge Function that receives the provider token.

### Client State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| zustand | ^5.0 | Lightweight client state | Minimal API, no boilerplate, 1.2KB gzipped. Perfect for small SPA state: auth state, UI state (modals, theme, active filters). Server state lives in TanStack Query, so zustand only handles the thin client layer. | HIGH |

**Why zustand over alternatives:**
- **Over Redux:** Massive overkill for this app's ~5 pieces of global state (user, theme, active category filter, modal state).
- **Over Jotai:** Zustand's centralized store is simpler to reason about for a small team. Jotai's atomic model adds unnecessary complexity here.
- **Over React Context:** Context causes full subtree re-renders. Zustand uses external stores with selector-based subscriptions — only components using specific state slices re-render.

### Form Handling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| react-hook-form | ^7.72 | Admin poll creation forms | Uncontrolled component approach = minimal re-renders. 12KB gzipped (vs Formik's 44KB). Zero dependencies. Only needed for the admin poll creation form (title, choices, timer, image). Voting itself is just a button click — no form library needed. | HIGH |

**Why not skip a form library entirely:** The admin poll creation form has dynamic fields (N configurable choices), validation requirements (min 2 choices, max title length, valid timer), and image upload state. react-hook-form handles this cleanly with `useFieldArray` for dynamic choices.

### UI & Styling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| CSS Custom Properties | N/A | Theming, styling | Already set up with light/dark theme support. No CSS framework needed — the app is small enough that plain CSS with custom properties is simpler and faster than adding Tailwind or a component library. | HIGH |
| clsx | ^2.1 | Conditional CSS class names | 228 bytes. Simple `clsx('base', { 'active': isActive })` pattern for conditional classes. | HIGH |
| lucide-react | ^1.7 | Icons | Tree-shakeable SVG icons. Each icon is an individual ESM import — only ships what you use. Better than FontAwesome (huge bundle) or heroicons (less variety). | MEDIUM |
| sonner | ^2.0 | Toast notifications | 6KB. Opinionated, beautiful defaults. Used by shadcn/ui, Vercel, Cursor. Perfect for "Vote recorded", "Poll created", error states. Simple API: `toast.success('Vote recorded')`. | MEDIUM |

**Why no component library (shadcn/ui, Radix, etc.):** The app has ~6 unique views. A component library adds bundle weight and learning curve for minimal benefit. Build the few components needed (Button, Card, Modal, Select, Tabs) from scratch with CSS custom properties. If the app grows significantly in v2, reconsider.

### Rate Limiting (Edge Functions)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @upstash/redis | ^1.37 | Redis client for Edge Functions | HTTP-based Redis client designed for serverless/edge. Works in Deno (Supabase Edge Functions runtime). | HIGH |
| @upstash/ratelimit | ^2.0 | Rate limiting logic | Provides sliding window, fixed window, and token bucket algorithms. Built on @upstash/redis. Official Supabase integration example exists. | HIGH |

**Setup:** Create a Global-type Redis database on Upstash (minimizes edge latency). Store `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as Supabase Edge Function secrets.

**Important:** Supabase counts Edge Function invocations before your code runs. Rate limiting with Upstash stops expensive work (DB writes, Discord API calls) but the invocation is still counted against the free tier's 2M/month limit. At 300-400 voters/week, this is not a concern (~2000 invocations/week at most).

### CAPTCHA (Optional)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @marsidev/react-turnstile | ^1.5 | Cloudflare Turnstile widget | Cloudflare-recommended React wrapper. Privacy-first (no tracking/cookies). Invisible mode available. Only enable if suspicious traffic detected — not default per project requirements. | HIGH |

**Server-side verification:** Turnstile token validation happens in Supabase Edge Functions. POST the token to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with your secret key. Free tier: unlimited verifications.

### Date Handling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| date-fns | ^4.1 | Date formatting & manipulation | Tree-shakeable, functional API. Needed for poll timer display ("Closes in 3 days"), poll creation (date picker for custom timers), archive date formatting. ~5KB for typical usage. | MEDIUM |

### Infrastructure (Locked)

| Technology | Purpose | Tier | Why | Confidence |
|------------|---------|------|-----|------------|
| Supabase | Database, Auth, Storage, Edge Functions | Free (500MB DB, 1GB storage, 2M edge invocations/month) | Locked decision. Full BaaS with Postgres, built-in Discord OAuth, Edge Functions for server-side validation, Storage for poll images. | HIGH |
| Netlify | Static hosting, SPA routing | Legacy free tier | Locked decision. `_redirects` file for SPA routing. CNAME from polls.wtcsmapvote.com. | HIGH |
| Upstash Redis | Rate limiting in Edge Functions | Free (10K commands/day, 256MB) | HTTP-based Redis, works in Deno edge runtime. 10K commands/day is plenty for ~400 voters/week. | HIGH |
| Cloudflare Turnstile | Bot protection (optional) | Free (unlimited) | Privacy-first CAPTCHA. Only activate if abuse detected. | HIGH |

### Development Tools

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| supabase (CLI) | latest | Local Supabase development, migrations, Edge Function testing | `npx supabase init`, `npx supabase start` for local Postgres + Auth. Essential for testing Edge Functions locally before deploy. | HIGH |
| @tanstack/react-router-devtools | ^1.166 | Route debugging | Visual route tree in dev mode. | HIGH |
| @tanstack/react-query-devtools | ^5.96 | Query/cache debugging | Inspect polling state, cache entries, refetch timing. | HIGH |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Routing | TanStack Router | React Router v7 | TanStack Router is the locked decision. Also: superior type safety, matches sibling app stack. |
| Server State | TanStack Query | SWR | TanStack Query has better refetchInterval support, devtools, and broader feature set for polling patterns. |
| Client State | Zustand | Jotai | Jotai's atomic model is overkill for ~5 pieces of global state. Zustand's centralized store is simpler. |
| Client State | Zustand | React Context | Context re-renders entire subtrees. Zustand uses external store with selectors. |
| Forms | react-hook-form | Formik | Formik is 3.5x larger, has 9 dependencies, and is not actively maintained (last commit 1+ year ago). |
| Forms | react-hook-form | TanStack Form | TanStack Form is newer with smaller ecosystem. react-hook-form is battle-tested with extensive docs. |
| Icons | lucide-react | react-icons | react-icons bundles all icon sets; lucide-react is tree-shakeable per-icon. |
| Toasts | sonner | react-hot-toast | sonner has better defaults, smoother animations, and is the 2025 standard (30M+ weekly npm downloads). |
| CSS | CSS Custom Properties | Tailwind CSS | App is small (~6 views). Tailwind adds build complexity and learning curve for minimal benefit. CSS custom properties already set up with theme support. |
| Component Library | None (custom) | shadcn/ui | Only ~10 components needed. Custom CSS components are lighter and simpler for this scale. |
| Date | date-fns | dayjs | date-fns is tree-shakeable and functional; dayjs requires plugins for common operations. Both work fine. |
| CAPTCHA | Cloudflare Turnstile | reCAPTCHA | Turnstile is privacy-first (no cookies/tracking), free with no quotas, and simpler to integrate. |
| Realtime | HTTP polling (TanStack Query) | Supabase Realtime (WebSockets) | HTTP polling is simpler, avoids Realtime connection limits on free tier, and is sufficient at 20-30 concurrent users. |

## Installation

```bash
# Core dependencies
npm install @tanstack/react-router @tanstack/react-query @supabase/supabase-js zustand react-hook-form clsx lucide-react sonner date-fns

# Vite plugin for file-based routing
npm install -D @tanstack/router-plugin

# Dev tools (dev only)
npm install -D @tanstack/react-router-devtools @tanstack/react-query-devtools

# Supabase CLI (global or npx)
npm install -D supabase

# Optional: Cloudflare Turnstile (install only when needed)
# npm install @marsidev/react-turnstile

# Edge Function dependencies (in supabase/functions/)
# These are imported via URL in Deno, not npm:
# import { Redis } from "https://deno.land/x/upstash_redis/mod.ts"
# import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit"
```

**Note on Edge Functions:** Supabase Edge Functions run on Deno, not Node.js. Dependencies are imported via URL (esm.sh, deno.land/x, or skypack). The `@upstash/redis` and `@upstash/ratelimit` npm versions listed above are for reference — in Edge Functions, use the Deno-compatible URL imports as shown in Supabase's official examples.

## Edge Function Dependency Imports (Deno)

```typescript
// In supabase/functions/cast-vote/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://deno.land/x/upstash_redis/mod.ts";
import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit@2";
```

## Key Integration Notes

### TanStack Router + TanStack Query
These integrate naturally. Use TanStack Router's `loader` functions with TanStack Query's `ensureQueryData` for route-level data loading:

```typescript
// routes/polls/$pollId.tsx
export const Route = createFileRoute('/polls/$pollId')({
  loader: ({ context: { queryClient }, params: { pollId } }) =>
    queryClient.ensureQueryData(pollQueryOptions(pollId)),
  component: PollDetail,
});
```

### Supabase Client Setup
Create a singleton client in `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types'; // Generated types

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### Auth State in Zustand
Bridge Supabase auth events into zustand for reactive UI updates:

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.getState().setSession(session);
});
```

## Sources

- [TanStack Router - File-Based Routing](https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing) - Official docs
- [@tanstack/react-router npm](https://www.npmjs.com/package/@tanstack/react-router) - v1.168.10
- [@tanstack/react-query npm](https://www.npmjs.com/package/@tanstack/react-query) - v5.96.2
- [Supabase Discord OAuth](https://supabase.com/docs/guides/auth/social-login/auth-discord) - Official docs
- [Supabase signInWithOAuth](https://supabase.com/docs/reference/javascript/auth-signinwithoauth) - Scope configuration
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) - v2.101.1
- [Supabase Rate Limiting with Upstash](https://supabase.com/docs/guides/functions/examples/rate-limiting) - Official example
- [Supabase Upstash Redis Example](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/upstash-redis-ratelimit) - GitHub
- [@upstash/ratelimit npm](https://www.npmjs.com/package/@upstash/ratelimit) - v2.0.8
- [@upstash/redis npm](https://www.npmjs.com/package/@upstash/redis) - v1.37.0
- [@marsidev/react-turnstile npm](https://www.npmjs.com/package/@marsidev/react-turnstile) - v1.5.0, Cloudflare recommended
- [Cloudflare Turnstile Community Resources](https://developers.cloudflare.com/turnstile/community-resources/) - Official recommendation
- [zustand npm](https://www.npmjs.com/package/zustand) - v5.0.12
- [react-hook-form npm](https://www.npmjs.com/package/react-hook-form) - v7.72.1
- [sonner npm](https://www.npmjs.com/package/sonner) - v2.0.7
- [lucide-react npm](https://www.npmjs.com/package/lucide-react) - v1.7.0
- [TanStack Query refetchInterval](https://tanstack.com/query/v4/docs/framework/react/examples/auto-refetching) - Polling pattern
- [Zustand vs Jotai Performance 2025](https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025) - Comparison
- [React Hook Form vs Formik](https://www.digitalogy.co/blog/react-hook-form-vs-formik/) - Comparison
