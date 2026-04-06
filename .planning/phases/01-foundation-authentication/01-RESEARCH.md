# Phase 1: Foundation & Authentication - Research

**Researched:** 2026-04-06
**Domain:** Supabase Discord OAuth, shadcn/ui + Tailwind CSS v4, TanStack Router, Vitest, database schema design
**Confidence:** HIGH

## Summary

Phase 1 establishes the complete project foundation: Supabase database schema with RLS policies, Discord OAuth authentication with 2FA enforcement, TanStack Router file-based routing, a responsive shadcn/ui app shell with light/dark mode, and Vitest testing infrastructure.

The most critical technical finding is that **Supabase's Discord provider does NOT store `mfa_enabled` in `raw_user_meta_data`**. The Discord `/users/@me` endpoint does return `mfa_enabled` (boolean) when the `identify` scope is granted, but Supabase's Go implementation only extracts `id`, `username`, `discriminator`, `global_name`, `email`, `avatar`, and `verified`. To enforce 2FA, the app must capture the Discord `provider_token` from the OAuth callback session (available only on the initial `SIGNED_IN` event), call `https://discord.com/api/users/@me` with that token to read `mfa_enabled`, and store the result in the `profiles` table. This must happen in the auth callback handler before the user proceeds into the app.

The rest of the stack is well-documented and straightforward: shadcn/ui has official Vite + Tailwind CSS v4 installation docs, TanStack Router's file-based routing generates route trees automatically, and Vitest integrates natively with Vite's config.

**Primary recommendation:** Build the auth callback handler as the highest-priority task since everything else depends on a working auth flow, and the 2FA check requires careful implementation using the Discord `provider_token` which is only available once per sign-in.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Top navigation bar with logo, nav links, and user controls. Simple horizontal layout.
- **D-02:** Logged-in user's Discord avatar appears top-right with a shadcn DropdownMenu (sign out).
- **D-03:** Four routes created in Phase 1: Topics (suggestion list -- empty shell), Auth callback (OAuth redirect handler), Archive (closed suggestions -- empty shell), Admin panel (admin-only -- empty shell, separate surface).
- **D-04:** Mobile navigation uses hamburger menu with shadcn Sheet component (slide-down panel with stacked nav links).
- **D-05:** Auth errors use full-page card layout (shadcn Card) -- auth failures are blocking and non-technical users need clear guidance.
- **D-06:** Tone for all auth errors is direct but helpful. Example: "To keep responses authentic, we require 2FA on your Discord account. It takes about a minute to set up."
- **D-07:** Session expiry and general auth errors follow the same direct, actionable tone.
- **D-08:** Full database schema created upfront in Phase 1 -- all tables (profiles, polls, choices, votes, vote_counts, categories, admins) with RLS policies. Phase 2+ just uses what's already there.
- **D-09:** Database managed via Supabase CLI migrations -- SQL migration files in `supabase/migrations/` tracked in git.
- **D-10:** Initial admin accounts seeded via migration seed data -- hardcode Discord IDs in a seed migration file.
- **D-11:** User's Discord profile (avatar, username, discriminator) synced to profiles table on every login -- always fresh data.
- **D-12:** Logged-out landing page is a centered shadcn Card with "WTCS Community Suggestions" heading, subheading about sharing opinions, prominent "Sign in with Discord" CTA, and trust badges. Builds trust for first-time visitors clicking links from Discord.
- **D-13:** Visual identity uses shadcn/ui Maia style with Neutral preset (bbVJxbc) -- warm neutral, independent but cohesive with the WTCS ecosystem.
- **D-14:** shadcn/ui + Tailwind CSS v4 replaces plain CSS. Maia style, Neutral base/theme.
- **D-15:** Light and dark mode from day one, respecting system preference via shadcn theme toggle.
- **D-16:** Inter font (from preset). 4-size type scale: text-xs, text-sm, text-lg, text-2xl.
- **D-17:** User-facing copy uses "suggestions/topics/opinions/responses" -- never "polls/votes/voters". Admin UI can use internal terminology freely.
- **D-18:** Status labels for closed suggestions: Addressed, Forwarded, Closed (not Rejected/Processing/Implemented).
- **D-19:** Two separate surfaces: user-facing (no admin awareness) and admin-facing (/admin/* routes). No admin links visible to non-admins.
- **D-20:** max-w-2xl (672px) centered content width. Mobile-first, single column.

### Claude's Discretion
- Loading states and skeleton patterns
- Test structure and organization patterns
- Exact shadcn component choices for edge cases

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in via Discord OAuth and is redirected back to the app | Supabase `signInWithOAuth({ provider: 'discord' })` with redirect to callback route. Provider token available on `SIGNED_IN` event. |
| AUTH-02 | User without Discord 2FA enabled is rejected with clear error message | Discord `/users/@me` returns `mfa_enabled` boolean via `identify` scope. Must be checked using `provider_token` at callback time since Supabase does NOT store this field. |
| AUTH-04 | User session persists across browser refresh | Supabase auth-js handles session persistence via localStorage automatically. `onAuthStateChange` fires `INITIAL_SESSION` on page load. |
| AUTH-05 | User can log out from any page | `supabase.auth.signOut()` clears session. DropdownMenu with "Sign out" per D-02. |
| ADMN-01 | Initial admin accounts seeded by Discord user ID | Seed via `supabase/seed.sql` with hardcoded Discord IDs. Admin check via `is_admin` column in `profiles` table. |
| UIDN-01 | Light and dark mode via shadcn theme toggle | shadcn Vite ThemeProvider pattern (React Context + `classList` manipulation). Three states: Light, Dark, System. |
| UIDN-02 | Mobile-first responsive design | Tailwind CSS v4 responsive utilities. Breakpoint `md` (768px). Sheet component for mobile nav. |
| UIDN-03 | Modern polished design using shadcn/ui Maia style | shadcn/ui init with preset `bbVJxbc`. Neutral base, Neutral theme. |
| INFR-01 | App deployed on Netlify at polls.wtcsmapvote.com | Vite build to `dist/`, `_redirects` file in `public/` for SPA routing. |
| INFR-03 | All reads via Supabase JS client with RLS policies | RLS enabled on all tables. SELECT policies gate access per authenticated user role. |
| TEST-01 | Testing infrastructure (Vitest + React Testing Library) with CI-ready scripts | Vitest 4.1.2 + @testing-library/react 16.3.2 + jsdom 29.0.1. Config in `vite.config.ts` test block. |
| TEST-02 | Auth flows have unit/integration tests | Mock Supabase client, test login trigger, 2FA rejection, session restore, logout. |
</phase_requirements>

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI library | Already installed. React 19 with improved Suspense and Actions. [VERIFIED: package.json] |
| React DOM | 19.2.4 | DOM rendering | Already installed. [VERIFIED: package.json] |
| TypeScript | ~6.0.2 | Type safety | Already installed. [VERIFIED: package.json] |
| Vite | 8.0.4 | Build tool | Already installed. Fast HMR, native ESM. [VERIFIED: package.json] |

### Core (To Install)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.101.1 | Supabase client (DB, Auth) | Single SDK for auth + database reads via RLS. Locked decision. [VERIFIED: npm registry] |
| @tanstack/react-router | 1.168.10 | File-based routing | Type-safe routing with file-based route generation. Locked decision. [VERIFIED: npm registry] |
| @tanstack/router-plugin | 1.167.12 | Vite plugin for route generation | Generates route tree from filesystem. Required for file-based routing. [VERIFIED: npm registry] |
| tailwindcss | 4.2.2 | CSS framework | Locked decision. v4 uses `@import "tailwindcss"` and Vite plugin. [VERIFIED: npm registry] |
| @tailwindcss/vite | 4.2.2 | Tailwind CSS v4 Vite integration | Replaces PostCSS setup from Tailwind v3. Official Vite plugin. [VERIFIED: npm registry] |
| lucide-react | 1.7.0 | Icons | Tree-shakeable SVG icons. Ships with shadcn/ui. [VERIFIED: npm registry] |
| clsx | 2.1.1 | Conditional CSS classes | 228 bytes. Used by shadcn cn() utility. [VERIFIED: npm registry] |
| tailwind-merge | 3.5.0 | Tailwind class deduplication | Merges conflicting Tailwind classes. Used by shadcn cn() utility. [VERIFIED: npm registry] |
| class-variance-authority | 0.7.1 | Component variant API | Used by shadcn Button and other variant-based components. [VERIFIED: npm registry] |
| sonner | 2.0.7 | Toast notifications | Lightweight toast library. Used by shadcn Sonner component. [VERIFIED: npm registry] |

### Radix UI Primitives (shadcn dependencies -- install as needed per component)

| Library | Version | Purpose |
|---------|---------|---------|
| @radix-ui/react-dropdown-menu | 2.1.16 | DropdownMenu primitive (user avatar menu) [VERIFIED: npm registry] |
| @radix-ui/react-dialog | 1.1.15 | Dialog/Sheet primitive (mobile nav) [VERIFIED: npm registry] |
| @radix-ui/react-slot | 1.2.4 | Slot primitive (Button asChild) [VERIFIED: npm registry] |

### Dev Dependencies

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-router-devtools | 1.166.11 | Route debugging | Visual route tree in dev mode. [VERIFIED: npm registry] |
| vitest | 4.1.2 | Test runner | Native Vite integration, zero-config with vite.config.ts. [VERIFIED: npm registry] |
| @testing-library/react | 16.3.2 | React component testing | Standard for React component tests. [VERIFIED: npm registry] |
| @testing-library/jest-dom | 6.9.1 | DOM assertion matchers | toBeInTheDocument(), toHaveTextContent(), etc. [VERIFIED: npm registry] |
| @testing-library/user-event | 14.6.1 | User interaction simulation | click(), type(), etc. More realistic than fireEvent. [VERIFIED: npm registry] |
| jsdom | 29.0.1 | DOM environment for tests | Standard browser emulation for Vitest. [VERIFIED: npm registry] |
| supabase | 2.85.0 | Supabase CLI (local dev, migrations) | Database migrations, type generation. [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsdom | happy-dom | happy-dom is faster but has less complete DOM API. jsdom is the safer default for a new project. |
| clsx + tailwind-merge | just clsx | tailwind-merge prevents conflicting Tailwind classes (e.g., `p-2 p-4` -> `p-4`). Required for shadcn cn() utility. |
| Custom ThemeProvider | next-themes | next-themes works in Vite but is designed for Next.js. shadcn docs recommend a custom ThemeProvider for Vite. |

**Installation:**

```bash
# Core dependencies
npm install @supabase/supabase-js @tanstack/react-router lucide-react clsx tailwind-merge class-variance-authority sonner

# Tailwind CSS v4
npm install tailwindcss @tailwindcss/vite

# Dev dependencies
npm install -D @tanstack/router-plugin @tanstack/react-router-devtools vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom supabase
```

Note: Radix UI primitives are installed automatically when adding shadcn components via `npx shadcn@latest add <component>`.

## Architecture Patterns

### Recommended Project Structure

```
src/
  routes/
    __root.tsx              # Root layout: nav, auth state, ThemeProvider, Outlet
    index.tsx               # Redirect to /topics or show landing page
    topics.tsx              # Topics page (empty shell)
    archive.tsx             # Archive page (empty shell)
    admin/
      index.tsx             # Admin panel (empty shell, guarded)
    auth/
      callback.tsx          # OAuth callback handler (2FA check happens here)
      error.tsx             # Auth error display page
  components/
    ui/                     # shadcn/ui components (Button, Card, DropdownMenu, Sheet, etc.)
    layout/
      Navbar.tsx            # Top nav: logo, links, user controls, theme toggle
      MobileNav.tsx         # Sheet-based mobile navigation
    auth/
      AuthGuard.tsx         # Redirect to landing if not authenticated
      AdminGuard.tsx        # Redirect to home if not admin
      LandingPage.tsx       # Logged-out card with Discord CTA
      AuthErrorPage.tsx     # Error cards (2FA, session expired, general)
  hooks/
    useAuth.ts              # Auth state from Supabase onAuthStateChange
    useTheme.ts             # Re-export from ThemeProvider (if needed)
  lib/
    supabase.ts             # Supabase client singleton
    utils.ts                # cn() utility (clsx + tailwind-merge)
    types/
      database.types.ts     # Generated by supabase gen types
  routeTree.gen.ts          # Auto-generated by TanStack Router plugin (DO NOT EDIT)
supabase/
  config.toml               # Supabase local dev config
  migrations/
    00000000000000_schema.sql    # Full database schema
    00000000000001_rls.sql       # RLS policies
    00000000000002_triggers.sql  # Triggers (profile sync, vote counts)
  seed.sql                  # Admin seed data (Discord IDs)
public/
  _redirects                # Netlify SPA routing
  favicon.svg               # Existing favicon
```

### Pattern 1: Discord OAuth with 2FA Verification

**What:** Complete auth flow from "Sign in with Discord" to verified session.
**When to use:** Every login.

```typescript
// Source: Supabase Discord OAuth docs + Discord API docs
// [VERIFIED: discord.com/developers/docs, supabase.com/docs]

// Step 1: Trigger OAuth (in LandingPage or sign-in button)
const handleLogin = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'identify email', // identify scope returns mfa_enabled
    },
  });
};

// Step 2: Auth callback handler (routes/auth/callback.tsx)
// After Supabase processes the OAuth callback, the session is established.
// The provider_token (Discord access token) is available ONLY on
// the SIGNED_IN event and is NOT persisted by Supabase.

// In the callback component:
const { data: { session } } = await supabase.auth.getSession();

if (session?.provider_token) {
  // Step 3: Check Discord 2FA status using provider_token
  const discordUser = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${session.provider_token}` },
  }).then(r => r.json());

  if (!discordUser.mfa_enabled) {
    // Sign out the user and redirect to 2FA error page
    await supabase.auth.signOut();
    navigate({ to: '/auth/error', search: { reason: '2fa-required' } });
    return;
  }

  // Step 4: Update profile with fresh Discord data
  // (Via direct Supabase update or Edge Function)
  // Store mfa_verified = true, fresh avatar/username
}
```

**Critical detail:** The `provider_token` is a Discord access token, NOT the Supabase JWT. It is only available on the initial `SIGNED_IN` callback and is NOT stored by Supabase in the database. You must use it immediately in the callback handler. [VERIFIED: Supabase docs, GitHub issues #131]

### Pattern 2: Supabase Auth State Management

**What:** Bridge Supabase auth events into React state for reactive UI.
**When to use:** App-wide, in the root route.

```typescript
// Source: Supabase auth docs [VERIFIED: supabase.com/docs]
// hooks/useAuth.ts

import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}
```

### Pattern 3: TanStack Router File-Based Setup

**What:** File-based routing with auto code splitting.
**When to use:** Project setup.

```typescript
// Source: TanStack Router docs [VERIFIED: tanstack.com/router]

// vite.config.ts
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { ThemeProvider } from '@/components/theme-provider';
import { Navbar } from '@/components/layout/Navbar';

export const Route = createRootRoute({
  component: () => (
    <ThemeProvider defaultTheme="system" storageKey="wtcs-ui-theme">
      <div className="min-h-svh bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 pt-4 md:px-6 md:pt-6">
          <Outlet />
        </main>
      </div>
    </ThemeProvider>
  ),
});
```

### Pattern 4: shadcn/ui Initialization

**What:** Initialize shadcn/ui with the Maia preset.
**When to use:** Project setup (one time).

```bash
# Source: ui.shadcn.com/docs/installation/vite [VERIFIED: official docs]

# Initialize shadcn/ui (interactive prompt)
npx shadcn@latest init

# When prompted:
# - Style: New York (closest to Maia -- then apply preset)
# - Base color: Neutral
# - CSS variables: Yes

# Apply Maia preset afterward by visiting:
# https://ui.shadcn.com/themes and selecting Maia style + Neutral preset
# Copy the CSS variables into src/index.css

# Add required Phase 1 components:
npx shadcn@latest add button card dropdown-menu sheet
```

Note: The `npx shadcn@latest init` command will create `components.json`, set up the `@/` path alias in CSS, create `src/lib/utils.ts` with the `cn()` function, and configure the CSS theme variables. [CITED: ui.shadcn.com/docs/installation/vite]

### Pattern 5: Profile Sync Trigger

**What:** Auto-create/update profile row when user signs in via Discord.
**When to use:** Database migration.

```sql
-- Source: Supabase triggers docs [VERIFIED: supabase.com/docs]
-- This trigger fires on BOTH insert (first login) and update (subsequent logins)

-- Handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, discord_id, discord_username, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'provider_id',
    COALESCE(
      NEW.raw_user_meta_data->>'custom_claims'::jsonb->>'global_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      'Unknown'
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    discord_username = EXCLUDED.discord_username,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### Anti-Patterns to Avoid

- **Checking 2FA client-side only:** The 2FA check must happen at the callback, using the provider_token. If you only check in React state, users can bypass it.
- **Storing provider_token for later use:** The Discord access token is ephemeral. Do not store it in localStorage. Use it immediately in the callback, then discard.
- **Relying on `raw_user_meta_data` for mfa_enabled:** Supabase's Discord provider does NOT store this field. You must call the Discord API directly.
- **Disabling RLS to "fix" empty query results:** RLS returns empty results when no policy matches. This is correct behavior, not a bug. Write proper policies.
- **Using `service_role` key in client code:** The service_role key bypasses all RLS. It belongs only in Edge Functions and migrations, never in browser code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component variants | Custom CSS class logic | class-variance-authority (cva) | Handles compound variants, defaults, responsive variants correctly |
| CSS class merging | String concatenation | clsx + tailwind-merge (cn()) | Properly deduplicates conflicting Tailwind classes |
| Theme toggle | Manual dark class manipulation | shadcn ThemeProvider pattern | Handles system preference, localStorage persistence, SSR flash prevention |
| OAuth flow | Custom Discord API integration | Supabase signInWithOAuth | Handles redirect, token exchange, session creation, PKCE |
| Session management | Custom JWT storage | Supabase auth-js | Handles refresh tokens, session persistence, tab sync |
| Database migrations | Manual SQL via dashboard | Supabase CLI migrations | Version-controlled, reproducible, supports local dev |
| Toast notifications | Custom toast component | sonner (via shadcn Sonner) | Animation, stacking, auto-dismiss, accessibility built in |
| Mobile slide-out nav | Custom drawer component | shadcn Sheet (Radix Dialog) | Focus trapping, keyboard navigation, animation, accessibility |
| Dropdown menus | Custom menu component | shadcn DropdownMenu (Radix) | Keyboard navigation, submenu support, accessibility |

## Common Pitfalls

### Pitfall 1: Discord 2FA Field Not in Supabase Metadata

**What goes wrong:** Developer assumes `mfa_enabled` is available in `raw_user_meta_data` or `user.user_metadata` after Discord OAuth. It is NOT.
**Why it happens:** Supabase's Discord provider extracts only `id`, `username`, `discriminator`, `global_name`, `email`, `avatar`, `verified`. The `mfa_enabled` field from the Discord User object is ignored.
**How to avoid:** Use the `provider_token` (Discord access token) from the session on the initial `SIGNED_IN` callback to call `https://discord.com/api/users/@me` and read `mfa_enabled` directly. Store the result in the `profiles` table.
**Warning signs:** Checking `session.user.user_metadata.mfa_enabled` returns `undefined`.
**Confidence:** HIGH [VERIFIED: supabase/auth GitHub source code -- discord.go, Discord API docs]

### Pitfall 2: Provider Token Disappears After Initial Callback

**What goes wrong:** Developer tries to access `session.provider_token` on a page refresh or subsequent `getSession()` call. It returns `null`.
**Why it happens:** Supabase does not persist the Discord access token in the database or session storage. It is only available in the `onAuthStateChange` callback for the `SIGNED_IN` event (the initial OAuth redirect). There is no `provider_refresh_token` for Discord.
**How to avoid:** Capture and use the `provider_token` immediately in the auth callback route handler. Perform all Discord API calls (2FA check, profile sync) in that single callback flow.
**Warning signs:** `session.provider_token` is `null` after page refresh.
**Confidence:** HIGH [VERIFIED: Supabase docs on sessions, GitHub issue auth-js#131]

### Pitfall 3: RLS Default-Open on New Tables

**What goes wrong:** Tables are created without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. The anon key provides full read/write access to the entire table.
**Why it happens:** RLS is disabled by default on new Postgres tables. Supabase returns empty results (not errors) when RLS is enabled without policies, which tempts developers to disable RLS.
**How to avoid:** Enable RLS immediately on every table in the migration file. Write explicit SELECT policies. Test with the anon key (no auth token) to verify access is blocked.
**Warning signs:** Unauthenticated queries return data.
**Confidence:** HIGH [CITED: supabase.com/docs/guides/database/postgres/row-level-security]

### Pitfall 4: TanStack Router Plugin Order in Vite Config

**What goes wrong:** Routes are not generated or the route tree file is empty/stale.
**Why it happens:** The `tanstackRouter()` plugin must be placed BEFORE `react()` in the Vite plugins array. If placed after, the route tree generation does not trigger correctly.
**How to avoid:** Always order: `tanstackRouter()`, then `react()`, then `tailwindcss()`.
**Warning signs:** `routeTree.gen.ts` not updating when new route files are added.
**Confidence:** HIGH [VERIFIED: TanStack Router docs emphasize "before other framework plugins"]

### Pitfall 5: Tailwind CSS v4 Setup Differences from v3

**What goes wrong:** Developer uses Tailwind v3 configuration patterns (tailwind.config.js, PostCSS plugin) which don't apply to v4.
**Why it happens:** Most tutorials and training data reference Tailwind v3. v4 uses `@tailwindcss/vite` plugin instead of PostCSS, `@import "tailwindcss"` instead of `@tailwind` directives, and `@theme` directive instead of `tailwind.config.js`.
**How to avoid:** Use the official shadcn/ui Vite installation guide which targets v4 specifically. No `tailwind.config.js` or `postcss.config.js` needed.
**Warning signs:** Tailwind classes not being applied, build warnings about unknown at-rules.
**Confidence:** HIGH [VERIFIED: ui.shadcn.com/docs/installation/vite, tailwindcss v4.2.2 on npm]

### Pitfall 6: `verbatimModuleSyntax` and Type-Only Imports

**What goes wrong:** TypeScript compilation errors when importing types without the `type` keyword.
**Why it happens:** The project has `verbatimModuleSyntax: true` in tsconfig.app.json, which requires `import type { ... }` for type-only imports.
**How to avoid:** Always use `import type { Session, User } from '@supabase/supabase-js'` for types. Use `import { type X, Y } from 'module'` for mixed imports.
**Warning signs:** TypeScript error: "This import is never used as a value and must use 'import type'."
**Confidence:** HIGH [VERIFIED: tsconfig.app.json in codebase]

### Pitfall 7: routeTree.gen.ts Linting/Formatting

**What goes wrong:** ESLint or Prettier modifies the auto-generated route tree file, causing route generation to break on the next run.
**Why it happens:** The generated file doesn't follow project lint rules and gets auto-fixed.
**How to avoid:** Add `routeTree.gen.ts` to `.eslintignore` or ESLint config's ignores array. Also ignore in Prettier config if added later.
**Warning signs:** Route tree file shows git changes after linting.
**Confidence:** HIGH [VERIFIED: TanStack Router docs explicitly warn about this]

## Code Examples

### Supabase Client Singleton

```typescript
// src/lib/supabase.ts
// Source: Supabase docs [VERIFIED: supabase.com/docs]
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

### cn() Utility (shadcn standard)

```typescript
// src/lib/utils.ts
// Source: shadcn/ui docs [VERIFIED: ui.shadcn.com]
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Vitest Configuration

```typescript
// In vite.config.ts (add test block)
// Source: Vitest docs [VERIFIED: vitest.dev]
export default defineConfig({
  plugins: [/* ... */],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});

// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

### Netlify SPA Redirect

```
# public/_redirects
# Source: Netlify docs [VERIFIED: docs.netlify.com]
/*    /index.html   200
```

### Environment Variables

```bash
# .env.local (git-ignored)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

### Database Schema (Corrected from ARCHITECTURE.md research)

The resolution column values must use the terminology from D-18: `addressed`, `forwarded`, `closed` (not `rejected`/`processing`/`implemented`).

```sql
-- polls table correction
resolution TEXT
  CHECK (resolution IS NULL OR resolution IN ('addressed', 'forwarded', 'closed')),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind CSS v3 (PostCSS + tailwind.config.js) | Tailwind CSS v4 (@tailwindcss/vite + @theme directive) | 2025 | No config files needed. CSS-first configuration. |
| `@tailwind base/components/utilities` | `@import "tailwindcss"` | Tailwind v4 | Single import replaces three directives. |
| shadcn/ui init (v3-era) | `npx shadcn@latest init` with Tailwind v4 support | Late 2025 | CLI handles v4 setup automatically. |
| TanStack Router code-based routes | File-based routing with autoCodeSplitting | TanStack Router v1.x | Routes auto-generated from filesystem. |
| Supabase gotrue-js | @supabase/supabase-js v2 (unified SDK) | 2023 | Single package for all Supabase features. |
| React Router | TanStack Router | N/A (project decision) | Full type safety, file-based routing, built-in code splitting. |

**Deprecated/outdated:**
- `@supabase/gotrue-js`: Merged into `@supabase/supabase-js`. Do not install separately.
- `tailwind.config.js` / `postcss.config.js`: Not used with Tailwind CSS v4 + Vite plugin.
- `@tailwind base; @tailwind components; @tailwind utilities;`: Replaced by `@import "tailwindcss"` in v4.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `provider_token` is available in `session` object during the `SIGNED_IN` event in `onAuthStateChange` for PKCE flow (SPA) | Architecture Patterns - Pattern 1 | HIGH -- if provider_token is not available in SPA PKCE flow, the entire 2FA check approach fails. Must verify during implementation. |
| A2 | `npx shadcn@latest init` supports Tailwind CSS v4 with the Maia preset string | Architecture Patterns - Pattern 4 | LOW -- shadcn docs confirm v4 support. Worst case: apply preset CSS manually. |
| A3 | Supabase profile sync trigger on `auth.users` INSERT will fire for Discord OAuth signups | Architecture Patterns - Pattern 5 | MEDIUM -- need to verify trigger fires correctly with OAuth provider, not just email/password signup. |
| A4 | Discord API `/users/@me` endpoint will return `mfa_enabled: true/false` (not null) for OAuth-authenticated users | Common Pitfalls - Pitfall 1 | HIGH -- Discord docs say the field is optional. If it returns `null` for OAuth users, 2FA check is impossible via this method. |
| A5 | The `SIGNED_IN` event fires on the callback page after OAuth redirect, with `provider_token` present | Architecture Patterns - Pattern 1 | HIGH -- critical for 2FA check. If it only fires with `INITIAL_SESSION` event instead, the code flow changes. |

## Open Questions

1. **Provider token availability in SPA PKCE flow**
   - What we know: Supabase docs mention `provider_token` on `session` object. GitHub issues confirm it's ephemeral.
   - What's unclear: Whether the PKCE flow (default for SPAs in Supabase v2) provides `provider_token` on the callback, or if it's only available in the implicit flow. Supabase switched SPAs to PKCE by default.
   - Recommendation: Test during implementation. If PKCE doesn't provide `provider_token`, switch to `flowType: 'implicit'` in the Supabase client config for this project specifically. Implicit flow is less secure but may be the only way to get the Discord token. [ASSUMED]

2. **Discord `mfa_enabled` field value for OAuth users**
   - What we know: Discord User object docs say `mfa_enabled` is an optional boolean. The `identify` scope is required.
   - What's unclear: Whether `mfa_enabled` is always present (non-null) when the `identify` scope is granted via OAuth, or if it can be `null/undefined` even with the right scope.
   - Recommendation: Test with a real Discord account during implementation. Have a fallback behavior for `null` (treat as 2FA not enabled). [ASSUMED]

3. **Profile sync trigger on subsequent logins**
   - What we know: The trigger on `auth.users` INSERT fires on first signup. Decision D-11 requires syncing on EVERY login.
   - What's unclear: Whether Supabase fires an UPDATE on `auth.users` for subsequent OAuth logins that would trigger an ON UPDATE trigger.
   - Recommendation: Implement the profile update in the auth callback handler (client-side or via Edge Function) rather than relying solely on a database trigger. Use the trigger for initial creation only, and update via callback for subsequent logins. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, dev server | Yes | 24.14.1 | -- |
| npm | Package management | Yes | 9.6.2 | -- |
| Supabase CLI | DB migrations, type gen | Yes | 2.85.0 | -- |
| Docker | Supabase local dev | Needs check | -- | Use remote Supabase project directly |

**Missing dependencies with no fallback:**
- None identified.

**Missing dependencies with fallback:**
- Docker (for `supabase start` local development) -- if not available, develop against a remote Supabase project. Migrations can be pushed directly with `supabase db push`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + @testing-library/react 16.3.2 |
| Config file | `vite.config.ts` (test block) -- created in Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Discord OAuth login triggers redirect | unit | `npx vitest run src/test/auth/login.test.ts -t "triggers OAuth"` | Wave 0 |
| AUTH-02 | 2FA rejection when mfa_enabled=false | unit | `npx vitest run src/test/auth/mfa-check.test.ts -t "rejects without 2FA"` | Wave 0 |
| AUTH-04 | Session persists across refresh | integration | `npx vitest run src/test/auth/session.test.ts -t "restores session"` | Wave 0 |
| AUTH-05 | Sign out from any page | unit | `npx vitest run src/test/auth/logout.test.ts -t "signs out"` | Wave 0 |
| UIDN-01 | Theme toggle works (light/dark/system) | unit | `npx vitest run src/test/theme/toggle.test.ts` | Wave 0 |
| TEST-01 | Vitest + RTL configured and passing | smoke | `npx vitest run` | Wave 0 |
| TEST-02 | Auth flow tests exist and pass | integration | `npx vitest run src/test/auth/` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vite.config.ts` -- add `test` block with jsdom environment and setup file
- [ ] `src/test/setup.ts` -- import `@testing-library/jest-dom/vitest`
- [ ] `package.json` -- add `"test"` and `"test:watch"` scripts
- [ ] `.eslintrc` / `eslint.config.js` -- ignore `routeTree.gen.ts`
- [ ] All test files listed above -- none exist yet

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth with Discord OAuth + 2FA enforcement via provider_token check |
| V3 Session Management | Yes | Supabase auth-js handles session tokens, refresh, and storage automatically |
| V4 Access Control | Yes | RLS policies on all tables. Admin check via `is_admin` column. No admin links visible to non-admins. |
| V5 Input Validation | No (Phase 1 has no user input forms) | Deferred to Phase 2+ |
| V6 Cryptography | No (handled by Supabase infrastructure) | Supabase manages JWT signing, PKCE, token encryption |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anon key direct DB access | Tampering | RLS enabled on all tables, no INSERT/UPDATE/DELETE for authenticated role on sensitive tables |
| Session hijacking | Spoofing | Supabase auth-js uses secure httpOnly refresh tokens, PKCE flow |
| Admin impersonation | Elevation of Privilege | `is_admin` checked server-side in RLS policies and Edge Functions, not client-side |
| OAuth callback manipulation | Spoofing | Supabase validates OAuth state parameter. Redirect URL must match configured value. |
| 2FA bypass via direct API | Tampering | Profile `mfa_verified` flag set only during callback. Future Edge Functions should check this flag. |

## Project Constraints (from CLAUDE.md)

- **Budget:** $0/month -- Supabase free tier, Netlify legacy free tier
- **Tech stack:** Vite + React + TypeScript + TanStack Router + shadcn/ui + Tailwind CSS v4 (all locked)
- **Auth:** Discord OAuth only via Supabase native Discord provider
- **TypeScript strict:** `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`
- **Module syntax:** ESM only (`"type": "module"`)
- **Naming:** PascalCase components, camelCase variables, kebab-case CSS/DOM
- **No path aliases currently:** Relative imports used. Phase 1 introduces `@/` alias (required by shadcn/ui).
- **Design system:** shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font

## Sources

### Primary (HIGH confidence)
- [Supabase Discord OAuth Docs](https://supabase.com/docs/guides/auth/social-login/auth-discord) -- auth flow, scopes
- [Discord User Object API](https://docs.discord.com/developers/resources/user) -- `mfa_enabled` field definition, `identify` scope
- [Supabase Auth Source (discord.go)](https://github.com/supabase/auth/blob/master/internal/api/provider/discord.go) -- confirms `mfa_enabled` NOT extracted
- [shadcn/ui Vite Installation](https://ui.shadcn.com/docs/installation/vite) -- complete setup with Tailwind v4
- [shadcn/ui Vite Dark Mode](https://ui.shadcn.com/docs/dark-mode/vite) -- ThemeProvider implementation
- [TanStack Router Vite Installation](https://tanstack.com/router/latest/docs/installation/with-vite) -- plugin setup
- [TanStack Router Manual Setup](https://tanstack.com/router/latest/docs/installation/manual) -- entry point and root route patterns
- [Vitest Getting Started](https://vitest.dev/guide/) -- configuration
- [Netlify Vite Deployment](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/) -- SPA routing

### Secondary (MEDIUM confidence)
- [Supabase Auth Sessions](https://supabase.com/docs/guides/auth/sessions) -- session lifecycle
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks) -- custom access token hook
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) -- policy design
- [Supabase CLI Migrations](https://supabase.com/docs/guides/deployment/database-migrations) -- migration workflow
- [GitHub issue auth-js#131](https://github.com/supabase/auth-js/issues/131) -- provider_token persistence limitations

### Tertiary (LOW confidence)
- [Supabase Discussion #5210](https://github.com/orgs/supabase/discussions/5210) -- raw_user_meta_data shape (inconclusive)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified via npm registry, installation docs confirmed
- Architecture: HIGH -- patterns verified via official docs, source code review for Discord provider
- Auth/2FA approach: MEDIUM -- core approach verified but provider_token availability in PKCE flow needs runtime verification (see Open Question 1)
- Pitfalls: HIGH -- verified via official docs, source code, and community reports
- Testing: HIGH -- standard Vitest + RTL setup, well-documented

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable ecosystem, 30-day window appropriate)
