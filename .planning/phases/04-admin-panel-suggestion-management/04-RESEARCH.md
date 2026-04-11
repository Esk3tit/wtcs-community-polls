# Phase 4: Admin Panel & Suggestion Management — Research

**Researched:** 2026-04-11
**Domain:** Supabase RLS + Storage signed uploads, TanStack Router auth guards, shadcn/ui forms on Tailwind v4, Edge Function admin actions, lazy-close lifecycle
**Confidence:** HIGH (stack is already fully wired by Phase 1–3; Phase 4 extends known patterns)

## Summary

Phase 4 is **not a greenfield technical phase** — it extends an already-cemented stack. Phase 1 built the full schema with every column Phase 4 needs (`polls.is_pinned`, `polls.resolution`, `polls.closes_at`, `polls.closed_at`, `polls.created_by`). Phase 2 built the canonical Edge Function pattern (`submit-vote`) and the hook pattern (`useVoteSubmit`). Phase 3 added fail-closed auth checks and the `guild_member` column. CONTEXT.md resolved 22 decisions (D-01..D-22) and closed every open question. This research's job is to be **prescriptive**: confirm the patterns Phase 4 must mirror, flag where to copy-paste, and surface the handful of genuinely new things (Supabase Storage signed uploads, shadcn `Tabs`/`Dialog`/`Select`/`Textarea`/`Label` install, lazy-close view design).

**Primary recommendation:** For every new server action, clone `supabase/functions/submit-vote/index.ts` as the skeleton — auth check, service-role client, body parse, validation, error envelope — and add an `is_admin` gate immediately after the existing auth/MFA/guild check. For every new client hook, clone `src/hooks/useVoteSubmit.ts` for the invoke → error envelope → Sonner toast pattern. Use a DB view (`polls_effective`) for the lazy-close read path so client code never has to compute effective status. Build the `close-expired-polls` Edge Function but do NOT schedule it — that is Phase 5's job.

## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from CONTEXT.md `<decisions>`)

**Admin Shell & Navigation**
- **D-01** — Admin panel is a **single `/admin` route with tabs**: Suggestions, Categories, Admins. The existing `/admin/index.tsx` stub is replaced.
- **D-02** — Suggestion create/edit uses **dedicated form pages**: `/admin/suggestions/new` and `/admin/suggestions/:id/edit`.
- **D-03** — **WTCS logo** goes in the navbar on the left, **app-wide**. Source file is `src/assets/wtcs-logo.png` (9.9 KB). Imported via Vite asset pipeline (`import logo from '@/assets/wtcs-logo.png'`) — not `public/`.

**Admin Promotion, Demotion, and Seeding**
- **D-04** — Promote UX is **search existing profiles + paste Discord ID fallback**. Server-side `ilike` on `profiles.discord_username`, min-2-char, 10-row limit.
- **D-05** — **Existing map-vote admins seeded via one-time SQL migration** inserting 2 Discord IDs into `admin_discord_ids`: `267747104607305738` (Khai) and `290377966251409410` (second admin). The existing `handle_new_user` trigger derives `profiles.is_admin` from that table on first login.
- **D-06** — **Self-demotion blocked in both UI and server.** UI hides/disables the Demote button on the acting admin's own row; the `demote-admin` Edge Function rejects any request where `target_user_id == acting_user_id`.

**Suggestion Creation Form UX**
- **D-07** — **Choices editor** has two preset buttons `[Yes/No]` and `[4-choice]`; vertical list of choice inputs with per-row remove + `[+ Add choice]`. Min 2, soft cap ~10.
- **D-08** — **Image input is a two-tab control**: `[Upload]` → Supabase Storage, `[Paste URL]` → plain text URL. Either path stores the final URL in `polls.image_url`.
- **D-09** — **Timer picker** is three preset buttons `[7 days]` `[14 days]` `[Custom]`. Custom reveals a date/time picker. Form stores absolute `closes_at`.
- **D-10** — **Category picker** is a single `<Select>` populated from `categories`, plus an inline `+ Create new category…` action.

**Image Storage**
- **D-11** — Suggestion images go to a Supabase Storage **public bucket** (e.g., `poll-images`). Client upload uses the **signed-upload pattern via a `get-upload-url` Edge Function** so RLS/auth is enforced. Bucket name, path convention, file size limit, and allowed MIME types are Claude's discretion (targets: ~2 MB max, jpg/png/webp, path `poll-images/{poll_id_or_nonce}/{filename}`).

**Auto-Close & Lifecycle**
- **D-12** — **Auto-close uses a two-layer lazy-then-sweep design** — **no pg_cron dependency**, which removes the STATE.md blocker.
  - *Read path (lazy):* All suggestion reads go through a view or `SELECT` that derives effective status from `CASE WHEN closes_at < now() AND status = 'active' THEN 'closed' ELSE status END`.
  - *Write path (sweep):* A `close-expired-polls` Edge Function runs `UPDATE polls SET status='closed', closed_at=now() WHERE status='active' AND closes_at < now()`. Phase 4 builds + tests via manual invoke; Phase 5 wires a scheduler.
- **D-13** — **Respondent-only results visibility remains unchanged** after a suggestion closes.
- **D-14** — **Admins bypass the respondent-only rule.** `vote_counts` and `votes` RLS SELECT policies get an `OR (EXISTS admin profile)` branch. Requires a migration updating those two policies.

**Admin Actions on Suggestions**
- **D-15** — **Resolution status is set via a modal on manual close**, three buttons (Addressed / Forwarded / Closed), required to confirm close. Afterwards, **editable** from row menu. **Auto-closed** suggestions start with `resolution = NULL` and are flagged with `border-l-2 border-amber-500`.
- **D-16** — **Each admin row has a `⋮` kebab menu**: View results, Edit (disabled if `vote_count > 0`), Pin/Unpin, Close…, Set resolution…, Delete (disabled if `vote_count > 0`).

**Edit Lock (POLL-06)**
- **D-17** — **Once any vote exists, the suggestion is fully immutable** except via admin lifecycle actions (Close, Pin/Unpin, Set resolution). Server enforces in `update-poll` Edge Function: reject if `EXISTS(SELECT 1 FROM votes WHERE poll_id = :id)`. UI greys Edit when vote_count > 0.

**Delete Suggestion**
- **D-18** — **Delete is hard delete, pre-vote only, with confirmation.** Available only when `vote_count = 0`. Hard `DELETE FROM polls` cascades via existing `ON DELETE CASCADE`.

**Pin Display**
- **D-19** — **Pinned suggestions float to the top** via `ORDER BY is_pinned DESC, created_at DESC`. 📌 Pinned badge on the card (Lucide `Pin` icon). Applies to public feed and admin Suggestions tab.

**Admin Suggestions Tab**
- **D-20** — **`/admin` Suggestions tab uses filter chips**: `Active | Closed | All`, defaulting to **Active**. Filter stored as URL query param.

**Category Management**
- **D-21** — Categories tab is a **simple inline-editable list**. Backed by `create-category`, `rename-category`, `delete-category` Edge Functions. Schema FK is already `ON DELETE SET NULL`. Delete-confirmation dialog shows count of suggestions that will become uncategorized.

**Testing (TEST-05)**
- **D-22** — Admin actions have unit/integration tests covering: suggestion CRUD (incl. pre/post-vote edit lock), resolution lifecycle, promote/demote (server rejects non-admin, server rejects self-demote), admin-bypass RLS, category CRUD + cascade, pin/unpin. Pattern matches Phase 2/3 (Vitest + React Testing Library for UI, source-analysis tests for Edge Function behavior).

### Claude's Discretion
- Exact Supabase Storage bucket name, upload path convention, max file size, allowed MIME types
- Exact form validation rules (min/max choice count, title length limits, description length limits)
- Exact server-side `ilike` query shape for admin search + pagination cap
- Empty-state copy/imagery for /admin tabs
- Soft cap on number of choices at the UI layer (~10)
- Whether `vote_count = 0` for the edit/delete gate reads from `vote_counts` table or direct `COUNT(*)`
- Exact Lucide icons for kebab menu items
- Whether admin search input lives in the Admins tab or in a dialog launched from that tab

### Deferred Ideas (OUT OF SCOPE)
None — CONTEXT.md resolved all open questions. No scope-creep items to defer.

## Project Constraints (from CLAUDE.md)

- **Budget:** $0/month — Supabase free tier (500 MB DB, 1 GB storage, 2 M Edge Function invocations/mo), Netlify legacy free, Upstash Redis free.
- **Tech stack (locked):** Vite + React 19 + TypeScript + TanStack Router + shadcn/ui + Tailwind v4; Supabase native Discord OAuth.
- **Auth:** Discord OAuth only, Supabase native provider.
- **Design system:** shadcn/ui Maia/Neutral preset (`bbVJxbc`), Inter font, New-York style.
- **Repo conventions (from `components.json`):** `@/components`, `@/lib`, `@/hooks` aliases, Lucide icons, CSS variables enabled, Neutral base color.
- **GSD workflow:** all file-changing work goes through a GSD command; don't bypass.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMN-02 | Existing admin can promote another Discord user via in-app button | `promote-admin` Edge Function; D-04 search + paste flow; existing `admin_discord_ids` seed path for pre-auth |
| ADMN-03 | Existing admin can demote another admin (except self) | `demote-admin` Edge Function; D-06 self-demote guard (UI + server); direct UPDATE on `profiles.is_admin` via service role |
| ADMN-04 | Admin status is checked server-side on all admin actions | Every Edge Function reads `profiles.is_admin` via service-role client after `auth.getUser()`; mirrors `submit-vote` guild/MFA check pattern |
| POLL-01 | Admin creates suggestion with title, description, N configurable choices (Yes/No, 4-choice presets) | `create-poll` Edge Function inserts into `polls` + bulk-inserts into `choices`; existing `polls`/`choices` schema is complete |
| POLL-02 | Admin attaches image (upload or URL) | D-08 two-tab control; D-11 signed-upload pattern via `get-upload-url` Edge Function; `polls.image_url` column already exists |
| POLL-03 | Admin sets timer (7/14/custom) | D-09 preset buttons compute absolute `closes_at`; `polls.closes_at` column already exists |
| POLL-04 | Admin assigns suggestion to category | `polls.category_id` FK already exists with `ON DELETE SET NULL`; Select dropdown populated from `categories` table |
| POLL-05 | Admin pins/highlights suggestion | `polls.is_pinned` column already exists; `pin-poll` Edge Function toggles; sort order `ORDER BY is_pinned DESC, created_at DESC` |
| POLL-06 | Admin edits suggestion before first response | D-17 edit lock; `update-poll` Edge Function with `EXISTS(SELECT 1 FROM votes WHERE poll_id=:id)` guard |
| POLL-07 | Admin can manually close at any time | `close-poll` Edge Function sets `status='closed'`, `closed_at=now()`, required `resolution`; D-15 modal |
| CATG-01 | Admin CRUD categories | Three Edge Functions `create-category` / `rename-category` / `delete-category`; D-21 inline-editable list |
| LIFE-01 | Active suggestions auto-close when timer expires | D-12 lazy read (view) + sweep Edge Function (`close-expired-polls`); built in Phase 4, scheduled in Phase 5 |
| LIFE-02 | Closed suggestions marked with resolution (Addressed/Forwarded/Closed) | `polls.resolution` column with CHECK constraint already exists; D-15 modal required on manual close, editable after |
| LIFE-03 | Closed suggestions appear in public archive | Existing `archive.tsx` route (Phase 2) already renders closed polls; Phase 4 extends card to show resolution pill |
| TEST-05 | Admin actions have tests | D-22 test matrix; Vitest + RTL (already installed); source-analysis pattern for Edge Functions per `rate-limit-edge-function.test.ts` |

## Standard Stack

### Core (all already installed — verified from `package.json`)

| Library | Installed | Purpose | Why Standard |
|---------|-----------|---------|--------------|
| `@supabase/supabase-js` | ^2.101.1 [VERIFIED: package.json] | DB + Auth + Storage + Functions client; latest is 2.103.0 [VERIFIED: `npm view`] — bump is trivial, not required | Already used by every hook and Edge Function |
| `@tanstack/react-router` | ^1.168.10 [VERIFIED: package.json]; latest 1.168.18 | File-based routing; Phase 4 adds `/admin/suggestions/new` and `/admin/suggestions/$id/edit` | Already canonical in project; file-based routes auto-generate `routeTree.gen.ts` via `tsr generate` |
| `@tanstack/router-plugin` | ^1.167.12 [VERIFIED: package.json] | Vite plugin that regenerates route tree on file change | Required by file-based routing |
| `react` / `react-dom` | ^19.2.4 | UI | React 19 is locked |
| `tailwindcss` + `@tailwindcss/vite` | ^4.2.2 | Styling via Vite plugin (Tailwind v4 flow) | New-York shadcn style uses Tailwind v4 with `@theme` block |
| `radix-ui` | ^1.4.3 [VERIFIED: package.json] | Headless primitives under shadcn components | Already installed; Phase 4 new components (`Tabs`, `Dialog`, `Select`, `Label`, `Textarea`) all ride on it |
| `lucide-react` | ^1.7.0 | Icon system | Already canonical (`components.json` declares `iconLibrary: lucide`) |
| `sonner` | ^2.0.7 | Toast notifications | Already installed + registered in `__root.tsx`; Phase 4 uses for every admin action feedback (see UI-SPEC §16) |
| `class-variance-authority` / `clsx` / `tailwind-merge` | installed | shadcn utility stack | Already canonical |

### Supporting — new components to install (D-01, D-07..D-11, UI-SPEC §8-14)

| Component | Registry | Install Command | Used For |
|-----------|----------|-----------------|----------|
| `tabs` | shadcn/ui official | `npx shadcn@latest add tabs` | `/admin` tab shell (Suggestions/Categories/Admins), Image tabs (Upload/URL) |
| `dialog` | shadcn/ui official | `npx shadcn@latest add dialog` | Resolution-on-close, delete confirm, demote confirm, delete-category, preset-overwrite, inline-create category, promote-admin dialogs |
| `label` | shadcn/ui official | `npx shadcn@latest add label` | Every form field in the Suggestion Form |
| `textarea` | shadcn/ui official | `npx shadcn@latest add textarea` | Description field (POLL-01) |
| `select` | shadcn/ui official | `npx shadcn@latest add select` | Category picker (D-10) |

**Single install command (per UI-SPEC §Registry Safety):** `npx shadcn@latest add tabs dialog label textarea select`
[CITED: 04-UI-SPEC.md §Registry Safety "Install command"]

### Form handling — use plain React state, not react-hook-form

**Recommendation:** Build the Suggestion Form with **plain React `useState` + local validation**, NOT react-hook-form.

**Rationale:**
- react-hook-form is not installed (`package.json` confirms none of react-hook-form / zod / @hookform/resolvers is a direct dependency — the zod in node_modules is transitive via Supabase/Tanstack).
- The form has ~7 fields; the dynamic-choice array + file upload + custom datetime control is easier to control with explicit state than with RHF's `useFieldArray` when the rest of the codebase uses no form library.
- Adding a form library now creates a precedent + a bundle-size cost for a one-phase payoff. Phase 2/3 hooks all use plain `useState` + a `useXxxSubmit` hook that mirrors `useVoteSubmit`.
- Validation can live in a small `src/lib/validation/suggestion-form.ts` helper that returns `{ ok: boolean, errors: Record<field, string> }`. Called on submit.

**If the planner disagrees**, react-hook-form@7.72.1 + zod@4.3.6 are the canonical stack [VERIFIED: `npm view` 2026-04-11], but introducing them is out of character for this codebase. Flag it to the user before adding.

### Installation

```bash
# Add new shadcn components (single install):
npx shadcn@latest add tabs dialog label textarea select

# No new runtime dependencies required — everything else reuses existing stack.
# (shadcn CLI will add @radix-ui/react-tabs, @radix-ui/react-dialog, etc. as transitive deps
#  through the 'radix-ui' meta-package already installed.)
```

## Architecture Patterns

### Recommended File Layout (extends existing)

```
src/
├── assets/
│   └── wtcs-logo.png                 # (already present — D-03)
├── components/
│   ├── admin/                        # NEW — all admin-only components
│   │   ├── AdminTabs.tsx             # wrapper around shadcn Tabs + URL param sync
│   │   ├── AdminSuggestionRow.tsx    # custom row used by Suggestions tab
│   │   ├── SuggestionKebabMenu.tsx   # DropdownMenu with 7 items (D-16)
│   │   ├── ResolutionOnCloseDialog.tsx
│   │   ├── ResolutionPickerDialog.tsx
│   │   ├── DeleteSuggestionDialog.tsx
│   │   ├── CategoriesList.tsx        # inline-editable list (D-21)
│   │   ├── AdminsList.tsx            # promote/demote UI (D-04, D-06)
│   │   └── PromoteAdminDialog.tsx    # search + paste fallback
│   ├── suggestions/
│   │   └── form/                     # NEW — Suggestion Form section components
│   │       ├── SuggestionForm.tsx    # top-level form wrapper
│   │       ├── ChoicesEditor.tsx     # D-07
│   │       ├── ImageInput.tsx        # D-08
│   │       ├── TimerPicker.tsx       # D-09
│   │       └── CategoryPicker.tsx    # D-10
│   └── ui/                           # shadcn primitives (existing + 5 new)
├── hooks/
│   ├── useCreatePoll.ts              # NEW — mirrors useVoteSubmit
│   ├── useUpdatePoll.ts              # NEW
│   ├── useClosePoll.ts               # NEW
│   ├── usePinPoll.ts                 # NEW
│   ├── useDeletePoll.ts              # NEW
│   ├── useSetResolution.ts           # NEW
│   ├── useCategoryMutations.ts       # NEW — wraps create/rename/delete
│   ├── usePromoteAdmin.ts            # NEW
│   ├── useDemoteAdmin.ts             # NEW
│   ├── useSearchAdminTargets.ts      # NEW — debounced ilike search
│   └── useUploadImage.ts             # NEW — calls get-upload-url then uploadToSignedUrl
├── lib/
│   └── validation/
│       └── suggestion-form.ts        # NEW — plain TS validator
├── routes/
│   ├── __root.tsx                    # (existing; add logo via Navbar)
│   ├── admin/
│   │   ├── index.tsx                 # REPLACED — tabbed shell (D-01)
│   │   └── suggestions/
│   │       ├── new.tsx               # NEW (D-02)
│   │       └── $id.edit.tsx          # NEW (D-02)
│   ├── topics.tsx                    # extend: pin sort + badge
│   └── archive.tsx                   # extend: resolution pill
└── ...

supabase/
├── functions/
│   ├── _shared/
│   │   ├── cors.ts                   # (existing)
│   │   └── admin-auth.ts             # NEW — shared helper: requireAdmin(req, supabaseAdmin) → user or 403
│   ├── submit-vote/                  # (existing — canonical pattern)
│   ├── create-poll/                  # NEW
│   ├── update-poll/                  # NEW
│   ├── close-poll/                   # NEW
│   ├── pin-poll/                     # NEW
│   ├── delete-poll/                  # NEW
│   ├── set-resolution/               # NEW
│   ├── create-category/              # NEW
│   ├── rename-category/              # NEW
│   ├── delete-category/              # NEW
│   ├── promote-admin/                # NEW
│   ├── demote-admin/                 # NEW
│   ├── search-admin-targets/         # NEW — profile search for promote dialog
│   ├── get-upload-url/               # NEW — returns signed upload URL for poll-images
│   └── close-expired-polls/          # NEW — sweep; Phase 5 schedules
└── migrations/
    └── 00000000000005_admin_phase4.sql  # NEW — bundles all schema/RLS/view/seed changes
```

### Pattern 1: Edge Function skeleton (clone from `submit-vote/index.ts`)

Every Phase 4 Edge Function follows this exact shape. The only variation is what happens inside the admin-gate block. Example for `create-poll`:

```typescript
// supabase/functions/create-poll/index.ts
// Source pattern: supabase/functions/submit-vote/index.ts (verified in codebase)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-auth.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    // 1. Auth: parse JWT, require user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401, corsHeaders)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401, corsHeaders)

    // 2. Service-role client for writes (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 3. Admin gate (ADMN-04): require is_admin on profiles
    const adminCheck = await requireAdmin(supabaseAdmin, user.id)
    if (!adminCheck.ok) return json({ error: 'Forbidden' }, 403, corsHeaders)

    // 4. Parse + validate body
    const body = await req.json().catch(() => null)
    if (!body) return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
    // ... field-level validation, reject on error with 400 ...

    // 5. Perform action (INSERT polls + choices in a single transaction via RPC,
    //    OR two serial inserts with rollback on failure — RPC recommended for atomicity)
    // ... DB work ...

    return json({ success: true, poll_id: '...' }, 200, corsHeaders)
  } catch (err) {
    console.error('create-poll error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})

function json(body: unknown, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify(body),
    { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
```

**Shared helper (new) — `supabase/functions/_shared/admin-auth.ts`:**

```typescript
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Centralizes the admin gate so every Edge Function reuses the same check.
// Uses the service-role client so the read bypasses RLS.
export async function requireAdmin(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('is_admin, guild_member, mfa_verified')
    .eq('id', userId)
    .single()
  if (error || !profile) return { ok: false, reason: 'profile_not_found' }
  if (!profile.is_admin) return { ok: false, reason: 'not_admin' }
  // Defense-in-depth: an admin who lost MFA/guild shouldn't be privileged
  if (!profile.mfa_verified || !profile.guild_member) {
    return { ok: false, reason: 'integrity_failed' }
  }
  return { ok: true }
}
```

**Why this shape:** it mirrors the existing `submit-vote/index.ts` flow exactly — same `auth.getUser()`, same service-role client, same error envelope shape that `useVoteSubmit.ts` knows how to unwrap. Keeping the shape identical means all existing helpers and test patterns apply.

### Pattern 2: Client hook skeleton (clone from `useVoteSubmit.ts`)

```typescript
// src/hooks/useCreatePoll.ts
// Source pattern: src/hooks/useVoteSubmit.ts
import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export interface CreatePollInput {
  title: string
  description: string
  choices: string[]
  category_id: string | null
  image_url: string | null
  closes_at: string // ISO8601
}

export function useCreatePoll() {
  const [submitting, setSubmitting] = useState(false)
  const inflightRef = useRef(false)

  const createPoll = useCallback(async (input: CreatePollInput) => {
    if (inflightRef.current) return { ok: false, id: null }
    inflightRef.current = true
    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke<{ id: string }>('create-poll', {
        body: input,
      })
      if (error) {
        // Same error envelope unwrap pattern as useVoteSubmit
        let message = 'Could not create suggestion. Try again.'
        try {
          const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
          if (ctx?.json) {
            const body = await ctx.json()
            if (body?.error) message = body.error
          }
        } catch { /* fall through */ }
        toast.error(message)
        return { ok: false, id: null }
      }
      toast.success('Suggestion created')
      return { ok: true, id: data?.id ?? null }
    } catch {
      toast.error('Could not create suggestion. Try again.')
      return { ok: false, id: null }
    } finally {
      inflightRef.current = false
      setSubmitting(false)
    }
  }, [])

  return { createPoll, submitting }
}
```

**Every admin hook (update, close, pin, delete, set-resolution, category CRUD, promote, demote) follows this shape.** Copy-paste + change the function name + the body type + the success message from UI-SPEC §16.

### Pattern 3: TanStack Router protected admin routes

The project already has `AdminGuard` (component-level). The question is whether Phase 4 should **also** add route-level `beforeLoad` guards.

**Recommendation: keep `AdminGuard` as the sole gate, do NOT migrate to `beforeLoad`.**

**Rationale:**
- `AuthContext` is a React context, and `beforeLoad` runs outside the React tree. Getting auth into `beforeLoad` requires passing a router context `context: { auth }` at `RouterProvider` level — that's a non-trivial refactor of `main.tsx` and `__root.tsx`.
- `AdminGuard` already covers every path and shows a loading spinner while `useAuth` hydrates, which is the correct UX for an SPA with async auth.
- Phase 4 adds 3 new admin routes: `/admin`, `/admin/suggestions/new`, `/admin/suggestions/$id/edit`. Each wraps its component tree in `<AdminGuard>` exactly like the existing `/admin/index.tsx` stub does today.
- Server-side is the real gate anyway (ADMN-04) — every Edge Function rejects non-admins. Client `AdminGuard` is UX, not security.

**If the planner wants `beforeLoad` later**, the canonical pattern per TanStack docs [CITED: tanstack.com/router — Authenticated Routes] is:

```typescript
// (NOT recommended for Phase 4, shown for completeness)
// router context passed at createRouter({ context: { auth: undefined! } })
// then hydrated in <RouterProvider context={{ auth: useAuth() }} />
export const Route = createFileRoute('/admin')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAdmin) {
      throw redirect({ to: '/', search: { redirect: location.href } })
    }
  },
  component: AdminPage,
})
```

But this requires a Phase 1-scale refactor of `__root.tsx` + `main.tsx` to thread context through `createRouter`. **Do not do this in Phase 4.** Stay with `AdminGuard`.

### Pattern 4: File-based route definitions

New route files follow the existing TanStack Router file-based convention used in `src/routes/`. The `$id` syntax in a filename becomes a path param:

```typescript
// src/routes/admin/suggestions/new.tsx
import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '@/components/auth/AdminGuard'
import { SuggestionForm } from '@/components/suggestions/form/SuggestionForm'

export const Route = createFileRoute('/admin/suggestions/new')({
  component: NewSuggestionPage,
})

function NewSuggestionPage() {
  return (
    <AdminGuard>
      <SuggestionForm mode="create" />
    </AdminGuard>
  )
}
```

```typescript
// src/routes/admin/suggestions/$id.edit.tsx
import { createFileRoute, useParams } from '@tanstack/react-router'
import { AdminGuard } from '@/components/auth/AdminGuard'
import { SuggestionForm } from '@/components/suggestions/form/SuggestionForm'

export const Route = createFileRoute('/admin/suggestions/$id/edit')({
  component: EditSuggestionPage,
})

function EditSuggestionPage() {
  const { id } = Route.useParams()
  return (
    <AdminGuard>
      <SuggestionForm mode="edit" pollId={id} />
    </AdminGuard>
  )
}
```

**Note:** After adding files, run `npm run generate` (or it runs automatically via Vite plugin on dev) to regenerate `routeTree.gen.ts`. The `build` script already does this: `tsr generate && tsc -b && vite build`.

### Pattern 5: Lazy-close on read (D-12) via a view

```sql
-- In 00000000000005_admin_phase4.sql

-- View: polls with effective status derived at read time.
-- Use this in every client read that needs the "is this currently open?" semantic.
-- Writes still target the base `polls` table.
CREATE OR REPLACE VIEW public.polls_effective AS
SELECT
  id,
  title,
  description,
  category_id,
  image_url,
  CASE
    WHEN status = 'active' AND closes_at < now() THEN 'closed'
    ELSE status
  END AS status,
  resolution,
  is_pinned,
  created_by,
  closes_at,
  closed_at,
  created_at,
  updated_at,
  -- expose raw status too, for admin UI that wants to distinguish
  -- "closed because swept" vs "closed because expired-but-not-swept"
  status AS raw_status
FROM public.polls;

-- Views inherit RLS from the base table in Postgres 15+ (Supabase default).
-- Because polls already has "viewable by authenticated" SELECT policy, this view
-- is readable by authenticated users with no additional policy work.

COMMENT ON VIEW public.polls_effective IS
  'Lazy-close read view: derives effective status by comparing closes_at to now(). Raw status exposed as raw_status for admin UI. D-12 two-layer lazy-then-sweep.';
```

**Client usage:** Every public read in `topics.tsx`, `archive.tsx`, and the admin Suggestions tab queries `polls_effective` instead of `polls`. Edge Function writes still target `polls`. The sweep Edge Function UPDATEs `polls` to bring raw_status in line with effective status — but nothing in the UI depends on the sweep running.

### Pattern 6: Signed upload flow (D-11)

```typescript
// supabase/functions/get-upload-url/index.ts (skeleton)
// Admin-gated Edge Function that returns a short-lived signed upload URL.
// Client then uploads directly to Supabase Storage without further auth.

// ... same auth + admin gate as create-poll ...

const body = await req.json() // { filename: string, contentType: string }
// Validate filename + contentType (allowlist: image/jpeg, image/png, image/webp)
// Build path: `${crypto.randomUUID()}/${sanitizedFilename}`
const path = `${crypto.randomUUID()}/${sanitize(body.filename)}`

const { data, error } = await supabaseAdmin
  .storage
  .from('poll-images')
  .createSignedUploadUrl(path)

if (error) return json({ error: 'Could not create upload URL' }, 500, corsHeaders)

// data: { signedUrl, token, path }
return json({ signedUrl: data.signedUrl, token: data.token, path }, 200, corsHeaders)
```

```typescript
// src/hooks/useUploadImage.ts (skeleton)
import { supabase } from '@/lib/supabase'

export async function uploadImage(file: File): Promise<string> {
  // 1. Ask Edge Function for a signed upload URL (admin-gated)
  const { data: urlResponse, error: urlError } = await supabase.functions.invoke<{
    signedUrl: string; token: string; path: string
  }>('get-upload-url', {
    body: { filename: file.name, contentType: file.type },
  })
  if (urlError || !urlResponse) throw new Error('Could not get upload URL')

  // 2. Upload directly to Storage using the token (token is valid for 2 hours)
  const { error: uploadError } = await supabase
    .storage
    .from('poll-images')
    .uploadToSignedUrl(urlResponse.path, urlResponse.token, file, {
      contentType: file.type,
      upsert: false,
    })
  if (uploadError) throw uploadError

  // 3. Compute public URL (bucket is public — D-11)
  const { data: publicData } = supabase
    .storage
    .from('poll-images')
    .getPublicUrl(urlResponse.path)
  return publicData.publicUrl
}
```

**Why this pattern instead of direct client upload:**
- D-11 mandates admin-gating. Direct client upload would require RLS on `storage.objects` that joins to `profiles.is_admin` — possible, but more fragile and harder to test than a single Edge Function gate.
- Signed upload URLs expire in 2 hours [CITED: supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl], plenty of buffer for a user filling out a form.
- The token flow means the `Authorization: Bearer <JWT>` header is not needed for the actual upload — the signed URL carries its own auth. This avoids CORS headaches and works well from a React client.

### Pattern 7: Storage bucket setup via migration

```sql
-- In 00000000000005_admin_phase4.sql

-- Create the public bucket idempotently.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'poll-images',
  'poll-images',
  true,
  2 * 1024 * 1024, -- 2 MB (Claude's discretion per CONTEXT.md D-11)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- No RLS policies on storage.objects for this bucket:
-- - SELECT: bucket is public, so reads work via getPublicUrl
-- - INSERT/UPDATE/DELETE: blocked for `authenticated` role; all writes
--   happen through the get-upload-url Edge Function (service_role, bypasses RLS)
```

**Alternative if the planner wants a stricter setup:** explicit deny policies — but for a public bucket where the only writer is an Edge Function using the service role, no INSERT policy is actively required (the absence of an INSERT policy in an RLS-enabled table denies by default). Document this in the migration comment.

### Pattern 8: Admin-bypass RLS patch (D-14)

```sql
-- In 00000000000005_admin_phase4.sql

-- Helper function: current user is admin.
-- SECURITY DEFINER so the internal read bypasses RLS, avoiding infinite recursion
-- (if it did a plain SELECT on profiles under the caller's role, it would re-trigger
-- whatever profile RLS exists; SECURITY DEFINER runs as function owner).
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

COMMENT ON FUNCTION public.is_current_user_admin IS
  'Returns true if the authenticated caller has profiles.is_admin=true. SECURITY DEFINER so internal lookup bypasses RLS on profiles. Stable so Postgres can cache within a statement.';

-- Patch votes SELECT policy: keep "can see own" branch, add "admin bypass" branch.
DROP POLICY IF EXISTS "Users can view own votes" ON public.votes;
CREATE POLICY "Users can view own votes or admin"
  ON public.votes
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_current_user_admin()
  );

-- Patch vote_counts SELECT policy: keep "voter" branch, add "admin bypass" branch.
DROP POLICY IF EXISTS "Vote counts visible to voters" ON public.vote_counts;
CREATE POLICY "Vote counts visible to voters or admin"
  ON public.vote_counts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.votes
      WHERE votes.poll_id = vote_counts.poll_id
      AND votes.user_id = auth.uid()
    )
    OR public.is_current_user_admin()
  );
```

**Why SECURITY DEFINER:** direct `SELECT is_admin FROM profiles WHERE id = auth.uid()` inside the policy body works but is slower (each row evaluates the subquery under the caller's RLS context). A STABLE SECURITY DEFINER function is the Supabase-blessed pattern for this [CITED: supabase.com/docs/guides/database/postgres/row-level-security]. Marking it STABLE tells the planner it's side-effect-free and can be memoized within a query.

### Pattern 9: Seed admin Discord IDs (D-05)

```sql
-- In 00000000000005_admin_phase4.sql

INSERT INTO public.admin_discord_ids (discord_id) VALUES
  ('267747104607305738'),  -- Khai (project owner)
  ('290377966251409410')   -- second admin
ON CONFLICT (discord_id) DO NOTHING;
```

The existing `handle_new_user` trigger (00000000000002_triggers.sql) already reads `admin_discord_ids` on first login and sets `profiles.is_admin` accordingly. Zero post-deploy steps required.

**Important:** if the user already signed in before the seed runs (i.e., their profile row exists with `is_admin=false`), the trigger will NOT retroactively flip them to admin — the trigger only fires `AFTER INSERT ON auth.users`. For this case the migration should also do:

```sql
-- Retroactively admin any existing profile whose discord_id is in admin_discord_ids
UPDATE public.profiles p
SET is_admin = true, updated_at = now()
FROM public.admin_discord_ids a
WHERE p.discord_id = a.discord_id
  AND p.is_admin = false;
```

This is safe because it only flips false → true for IDs explicitly in the config table.

### Anti-Patterns to Avoid

- **Do NOT put admin writes in RLS INSERT/UPDATE/DELETE policies on `polls`/`choices`/`categories`.** The project's established pattern (from `00000000000001_rls.sql`) is: no write policies on data tables; all writes go through Edge Functions with the service role key. Adding policies now would be a deviation flagged by reviewers.
- **Do NOT use `upsert` on the signed upload URL.** There is a known Supabase issue where `uploadToSignedUrl({ upsert: true })` silently fails [CITED: github.com/supabase/supabase-js/issues/1672]. Use `upsert: false` and generate a fresh path per upload via `crypto.randomUUID()`.
- **Do NOT build a custom rich text editor for the description.** The schema stores plain text; keep it a plain `<Textarea>`. Markdown/rich text is v2 scope.
- **Do NOT rely on `created_at DESC` alone for ordering** when `is_pinned=true` rows exist — it breaks D-19's pinned-first sort. Always `ORDER BY is_pinned DESC, created_at DESC`.
- **Do NOT fetch all polls and filter client-side** for the admin filter chips. Use a URL query param + refetch, or at minimum a WHERE clause in the query, so pagination works later.
- **Do NOT call `create-poll` then navigate before awaiting the response.** The `useCreatePoll` hook must resolve before `navigate()` so the redirect target can read the newly created row.
- **Do NOT trust `vote_count` from the client** for the edit/delete gate. The `update-poll` and `delete-poll` Edge Functions must re-check `EXISTS(SELECT 1 FROM votes WHERE poll_id=:id)` server-side (D-17). UI disable is UX only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Admin route gating | Custom auth middleware in `main.tsx` | Existing `AdminGuard` component wrapped around each route | Already solved; consistent with current codebase |
| Signed URL generation for uploads | Custom JWT/HMAC signing | `supabase.storage.from(bucket).createSignedUploadUrl(path)` [CITED: supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl] | Built-in, 2-hour validity, handles all edge cases |
| Image compression / resize | `browser-image-compression` or canvas-based resize | Accept as-is, enforce 2 MB cap at Edge Function + `file_size_limit` on the bucket | Out-of-scope; admin-only uploads from trusted users; one extra dep for minimal payoff |
| Form state management for the suggestion form | react-hook-form (unless already installed) | Plain `useState` + a `validateSuggestionForm()` helper | Matches existing hook patterns; no new deps |
| Toast notifications | Custom toast system | Sonner (already installed + registered in `__root.tsx`) | Canonical |
| Date/time picker | `react-day-picker` + custom datetime widget | Native `<Input type="datetime-local">` per UI-SPEC §10 | Avoids extra dep; UI-SPEC locks native control |
| Debounced search input for promote dialog | Custom debounce | Existing `src/hooks/useDebounce.ts` | Already in the project |
| Rate-limit for admin Edge Functions | Re-roll Upstash setup | Skip rate limiting on admin actions; volume is low (2 admins) and auth gate is sufficient | 2M Edge Fn invocations/mo budget + tiny admin surface make rate limiting waste |
| Dropdown menu for kebab | Custom popover | shadcn `DropdownMenu` (already installed) | Already used for navbar user menu |
| Admin check inside Edge Functions | Inline SQL in every function | Shared `_shared/admin-auth.ts` → `requireAdmin()` helper | DRY; one place to fix if audit requirements change |
| Category delete cascade logic | Manual UPDATE suggestions SET category_id = NULL | Existing FK `ON DELETE SET NULL` on `polls.category_id` | Schema already correct |
| Vote-count lookup for edit/delete gate | `SELECT COUNT(*) FROM votes WHERE poll_id=:id` | Existing `vote_counts` aggregate row; OR direct `EXISTS(...)` for the edit/delete guard (`EXISTS` is faster than COUNT when you only need "any?") | Reuses Phase 2 infrastructure; minimal cost |

**Key insight:** Phase 4 is **mostly a "extend existing patterns" phase**, not an invention phase. The temptation to introduce new libraries (react-hook-form, zod, date-fns, a state machine for the lifecycle, etc.) should be resisted — every one of those introduces a new precedent for a 2-admin tool. Every problem in the phase has a one-file answer already sitting in the repo.

## Runtime State Inventory

> Not applicable — Phase 4 is a feature-add, not a rename/refactor/migration. No existing runtime state is being renamed or moved. The only "state mutation" is adding 2 new rows to `admin_discord_ids` (D-05), which the existing trigger + RLS already handle cleanly. Explicitly verified: no file renames, no env var renames, no external service reconfiguration, no stored-data collection renames.

## Common Pitfalls

### Pitfall 1: Admin-bypass RLS infinite recursion
**What goes wrong:** If you write `USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin))` directly in a policy, Postgres will re-evaluate the profiles RLS policy on that subquery, and if profiles ever gets an admin-only policy you'll get recursion.
**Why it happens:** RLS policies cascade on all tables touched by the query.
**How to avoid:** Wrap the admin check in a `SECURITY DEFINER STABLE` function (`is_current_user_admin()` shown above). The function runs as its owner, bypassing caller RLS.
**Warning signs:** `infinite recursion detected in policy` error, or a query on `vote_counts` that runs 100× slower than expected.

### Pitfall 2: `uploadToSignedUrl` upsert bug
**What goes wrong:** Passing `{ upsert: true }` to `uploadToSignedUrl` silently fails or behaves non-deterministically.
**Why it happens:** Known bug in `@supabase/supabase-js` [CITED: github.com/supabase/supabase-js/issues/1672].
**How to avoid:** Always generate a fresh path (`crypto.randomUUID() + '/' + filename`) and pass `upsert: false`. Don't try to overwrite.
**Warning signs:** Uploads appear to succeed but the file isn't visible in the bucket browser.

### Pitfall 3: Vote arrives between form load and form submit (edit race)
**What goes wrong:** Admin opens edit form when `vote_count=0`, a user responds, admin submits. If the server check is missing, the edit succeeds and the already-responded vote is now on a different-content suggestion (data integrity violation).
**Why it happens:** Time gap between load and submit; no optimistic locking in the DB.
**How to avoid:** D-17 already mandates the server-side `EXISTS(SELECT 1 FROM votes WHERE poll_id=:id)` guard in `update-poll`. Never rely on UI disable alone. Return a specific error message ("Cannot edit: responses already received") so the client can show the right toast and redirect back to `/admin`.
**Warning signs:** Tests for this race should exist (D-22 covers it).

### Pitfall 4: `closes_at` in the past on create (user typo)
**What goes wrong:** Admin picks a custom datetime in the past; suggestion is created already-expired and never visible as active.
**Why it happens:** No DB CHECK constraint on `closes_at > now()` (and there shouldn't be one — breaks imports/migrations).
**How to avoid:** Client-side validation in `validateSuggestionForm()` + server-side validation in `create-poll` Edge Function (reject with 400 if `closes_at <= now() + 1 minute`).
**Warning signs:** UI-SPEC already covers the inline error "Close time must be in the future."

### Pitfall 5: Auto-close sweep runs during a vote insert
**What goes wrong:** User reads the `polls_effective` view showing `status='active'`, starts the vote flow, the sweep runs and flips `status` to closed, the `submit-vote` Edge Function rejects the vote with "not accepting responses" even though the user saw it as active.
**Why it happens:** Race between lazy read and write path.
**How to avoid:** This is **already handled correctly** by the `submit-vote` Edge Function's existing check: it queries `polls.status` (not the view) and the check `poll.status !== 'active'` rejects the vote. The user sees the standard "not currently accepting responses" toast. The edge case is acceptable — it's identical to any other "closed while I was mid-action" race and the user retries.
**Warning signs:** Only surfaces in logs; no action needed.

### Pitfall 6: shadcn `Select` re-rendering on every form tick
**What goes wrong:** Using `<Select onValueChange={handleChange}>` where `handleChange` is an inline function closes over stale state and re-mounts the portal on every keystroke in other fields.
**Why it happens:** Radix Select portals outside the form; each parent render remounts.
**How to avoid:** Wrap the handler in `useCallback`; keep Select's `value` prop on a stable state slice.
**Warning signs:** Dropdown closes when typing in the Title field.

### Pitfall 7: TanStack Router route tree out of sync
**What goes wrong:** Adding `src/routes/admin/suggestions/new.tsx` but not rerunning `tsr generate` → TypeScript thinks the route doesn't exist, navigation fails at build.
**Why it happens:** `routeTree.gen.ts` is a generated file that only updates when the Vite plugin is running.
**How to avoid:** The dev server's Vite plugin auto-regenerates on file creation. For CI/test runs, `npm run build` already runs `tsr generate` first. Only gotcha: adding a new route and then running `npm test` (which uses Vitest and doesn't regenerate) can show phantom errors. Run `npm run generate` before `npm test` after adding routes.
**Warning signs:** `Cannot find module '/admin/suggestions/new'` in navigation calls.

### Pitfall 8: Seed migration + retroactive admin flag
**What goes wrong:** One of the 2 seed admins already signed in during Phase 1–3 testing; their profile has `is_admin=false`; the seed migration only INSERTs into `admin_discord_ids`, which only affects *new* logins via the `handle_new_user` trigger.
**Why it happens:** `handle_new_user` is an `AFTER INSERT ON auth.users` trigger — it never runs for existing users.
**How to avoid:** The migration also runs the retroactive UPDATE shown in Pattern 9.
**Warning signs:** Seeded admin logs in but sees the public UI, not `/admin`.

## Code Examples

### Example A: `close-expired-polls` Edge Function (D-12 sweep)

```typescript
// supabase/functions/close-expired-polls/index.ts
// Runs on-demand in Phase 4 (manual invoke for test). Phase 5 will schedule it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // NOTE: This function has NO user auth check. It's meant to be invoked:
  //   1. Manually by an admin via the Supabase CLI or dashboard
  //   2. By the Phase 5 scheduler (Netlify cron or Supabase scheduled invocation)
  //      using an internal shared secret header.
  // Phase 4: accept any POST. Phase 5 will add an X-Cron-Secret check.
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await supabaseAdmin
      .from('polls')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('status', 'active')
      .lt('closes_at', new Date().toISOString())
      .select('id')

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, swept: data?.length ?? 0, ids: data?.map(d => d.id) ?? [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('close-expired-polls error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
```

### Example B: `create-poll` full body (transactional via RPC)

```sql
-- Add to 00000000000005_admin_phase4.sql
-- RPC wraps the poll + choices INSERT in a single transaction.
-- Called by the create-poll Edge Function using the service_role client.
CREATE OR REPLACE FUNCTION public.create_poll_with_choices(
  p_title TEXT,
  p_description TEXT,
  p_category_id UUID,
  p_image_url TEXT,
  p_closes_at TIMESTAMPTZ,
  p_created_by UUID,
  p_choices TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_poll_id UUID;
  choice_text TEXT;
  idx INTEGER := 0;
BEGIN
  -- Validate: min 2 choices, max 10
  IF array_length(p_choices, 1) < 2 OR array_length(p_choices, 1) > 10 THEN
    RAISE EXCEPTION 'Choices must be between 2 and 10';
  END IF;

  INSERT INTO public.polls (title, description, category_id, image_url, closes_at, created_by, status)
  VALUES (p_title, p_description, p_category_id, p_image_url, p_closes_at, p_created_by, 'active')
  RETURNING id INTO new_poll_id;

  FOREACH choice_text IN ARRAY p_choices LOOP
    INSERT INTO public.choices (poll_id, label, sort_order)
    VALUES (new_poll_id, choice_text, idx);
    idx := idx + 1;
  END LOOP;

  RETURN new_poll_id;
END;
$$;
```

The Edge Function then calls `supabaseAdmin.rpc('create_poll_with_choices', {...})` — one network hop, atomic write.

### Example C: Promote-admin Edge Function body

```typescript
// supabase/functions/promote-admin/index.ts (body only)
const body = await req.json() // { target_user_id?: string, target_discord_id?: string }

if (body.target_user_id) {
  // Existing user path: flip profiles.is_admin = true
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ is_admin: true, updated_at: new Date().toISOString() })
    .eq('id', body.target_user_id)
  if (error) return json({ error: 'Could not promote' }, 500, corsHeaders)
  return json({ success: true, mode: 'existing' }, 200, corsHeaders)
}

if (body.target_discord_id) {
  // Pre-auth path: insert into admin_discord_ids.
  // If they already exist as a user, also flip profiles.is_admin.
  // Validate snowflake format (17-19 digits)
  if (!/^\d{17,19}$/.test(body.target_discord_id)) {
    return json({ error: 'Invalid Discord ID' }, 400, corsHeaders)
  }
  const { error: insertError } = await supabaseAdmin
    .from('admin_discord_ids')
    .insert({ discord_id: body.target_discord_id })
  // Ignore 23505 (already seeded) as success
  if (insertError && insertError.code !== '23505') {
    return json({ error: 'Could not pre-authorize' }, 500, corsHeaders)
  }
  // Retroactive flip if user already exists
  await supabaseAdmin
    .from('profiles')
    .update({ is_admin: true, updated_at: new Date().toISOString() })
    .eq('discord_id', body.target_discord_id)
  return json({ success: true, mode: 'preauth' }, 200, corsHeaders)
}

return json({ error: 'Missing target' }, 400, corsHeaders)
```

### Example D: Demote-admin self-demote guard (D-06)

```typescript
// supabase/functions/demote-admin/index.ts (admin-gate + body)
const body = await req.json() // { target_user_id: string }

// D-06: server-side self-demote guard.
if (body.target_user_id === user.id) {
  return json({ error: 'Cannot demote yourself' }, 400, corsHeaders)
}

const { error } = await supabaseAdmin
  .from('profiles')
  .update({ is_admin: false, updated_at: new Date().toISOString() })
  .eq('id', body.target_user_id)

if (error) return json({ error: 'Could not demote' }, 500, corsHeaders)
return json({ success: true }, 200, corsHeaders)
```

### Example E: Dynamic choice schema decision

**Question:** Should choices be a normalized `choices` table (current schema) or a JSONB column on `polls`?

**Answer: keep the existing normalized `choices` table. Do not change schema.**

**Rationale:**
- The schema is already normalized (`choices` table with FK to `polls`, `vote_counts` joining on `choice_id`, `votes.choice_id` referencing choices). Phase 1 built it this way deliberately.
- One-vote-per-user enforcement relies on `votes.choice_id` being a real FK — that's what `validate_vote_choice` trigger guards. JSONB choices would lose FK integrity.
- Aggregation via `vote_counts` is keyed on `choice_id` UUID. Refactoring to JSONB would require rewriting the trigger, the aggregate table, and every read query.
- No query complexity benefit from JSONB — the 2–10 choices per poll fit in a tiny join that Postgres handles trivially.
- Deletion cascades are already `ON DELETE CASCADE` from `choices` → `votes` and `choices` → `vote_counts`.

**JSONB would only make sense if:** choices needed per-choice rich metadata (images, long descriptions, nested options). None of that is in scope.

**Verdict:** normalized `choices` table stays; Phase 4 inserts 2-10 rows per `create-poll` call via the RPC shown in Example B.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `supabase-js` v1 chained `.from().insert().then()` | v2 async/await + error object with `.context` for HTTP bodies | v2 release (stable since 2023) | Already used; `useVoteSubmit` demonstrates the `.context.json()` unwrap pattern |
| Tailwind v3 config file + PostCSS plugin | Tailwind v4 via `@tailwindcss/vite` + CSS `@theme` block | 2025-02 [CITED: ui.shadcn.com/docs/changelog/2025-02-tailwind-v4] | Already adopted; `vite.config.ts` uses the vite plugin |
| shadcn/ui "default" style | "new-york" style with `data-slot` attribute per primitive | 2025-02 | Already adopted (`components.json` declares `new-york`) |
| `createClient` v1 with manual headers | v2 with `global.headers.Authorization` for user-context reads in Edge Functions | v2 | Already canonical in `submit-vote` |
| pg_cron for scheduled sweeps | **Lazy close on read + explicit sweep Edge Function scheduled externally** | 2024 (project decision per D-12 — Supabase free tier pg_cron availability is inconsistent and the STATE.md blocker called this out) | Phase 4 builds the sweep; Phase 5 schedules it via Netlify scheduled function |
| Optimistic UI with manual rollback | Sonner error toast + refetch on failure | 2024 canonical for small admin tools | Used in useVoteSubmit already |

**Deprecated / outdated:**
- Do not reach for `react-router-dom` — project is locked on TanStack Router
- Do not reach for Radix components directly — go through shadcn wrappers for styling consistency
- Do not reach for the old `supabase.auth.api` namespace — use `supabase.auth` directly (v2)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@supabase/supabase-js` 2.101.1 (installed) supports `createSignedUploadUrl` and `uploadToSignedUrl` exactly as shown. Latest is 2.103.0 per `npm view` [VERIFIED]. The API surface has been stable since ~2.39. | Pattern 6 | LOW — if somehow broken, bump to 2.103.0 |
| A2 | Supabase free tier supports public Storage buckets up to 1 GB total [ASSUMED — training data]. 2 MB per-file cap means 500 images before hitting the quota. | D-11 discretion | LOW — 500-image headroom is generous for launch; planner should confirm storage quota during Phase 5 deployment |
| A3 | `@upstash/ratelimit` 2.0.8 is in the Edge Function, but Phase 4 admin Edge Functions do NOT need rate limiting. Admin surface is 2 users; Edge Function budget is 2M invocations/month [ASSUMED based on typical Supabase free tier]. | Don't Hand-Roll table | LOW — if admin traffic spikes surprise us, add a generous 60/min limiter per admin |
| A4 | TanStack Router file-based routing with `$id` in filename → `Route.useParams()` is stable in 1.168+ | Pattern 4 | LOW — already used in project |
| A5 | shadcn/ui `Tabs`, `Dialog`, `Select`, `Label`, `Textarea` install cleanly alongside the existing new-york style with Tailwind v4 and React 19 [CITED: ui.shadcn.com/docs/tailwind-v4 confirms v4 + React 19 support] | Standard Stack | LOW |
| A6 | `polls` base table with `is_pinned`, `resolution`, `closes_at`, `closed_at`, `status CHECK`, `resolution CHECK` is sufficient for all Phase 4 features without schema migration. [VERIFIED in 00000000000000_schema.sql] | Architecture Patterns | NONE — verified |
| A7 | The existing `handle_new_user` trigger correctly derives `is_admin` on first login from `admin_discord_ids`. [VERIFIED in 00000000000002_triggers.sql] | Pattern 9 (seed) | NONE — verified |
| A8 | Views in Supabase inherit RLS from base tables automatically (Postgres 15+ default behavior) [ASSUMED — training data]. The `polls_effective` view relies on this. | Pattern 5 | MEDIUM — if views don't inherit, we'd need explicit `ALTER VIEW polls_effective SET (security_invoker = on)` or an explicit policy. Planner should verify on first migration test. |
| A9 | Netlify scheduled functions are the Phase 5 hook for `close-expired-polls`. Phase 4 doesn't schedule anything — so this is Phase 5's problem and doesn't affect Phase 4 planning. | Code Examples Example A | NONE for Phase 4 |
| A10 | Supabase Storage signed upload URL tokens are valid for 2 hours [CITED: WebSearch result summarizing supabase.com docs]. Plenty for admins filling out a form. | Pattern 6 | LOW |

**If the planner is uncomfortable with any MEDIUM assumptions (A8 especially), add a Wave 0 verification task that creates the view and runs a `SELECT` as a non-admin user in a test database.**

## Open Questions

None that block planning. CONTEXT.md resolved all the substantive questions; this research confirms the technical patterns for each locked decision. The only items requiring human judgment during planning are the Claude's Discretion items from CONTEXT.md (bucket name, exact validation limits, soft cap, etc.), which the planner can call.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Local migrations, Edge Function deploy | ✓ (devDep) | supabase ^2.85.0 [VERIFIED: package.json] | — |
| Node.js | Everything | ✓ | 24.14.0 [VERIFIED: `node -v`] | — |
| npm | Package management | ✓ | bundled | — |
| Deno runtime | Edge Functions (local test) | ✓ if Supabase CLI is installed (bundled) | — | Manual invoke via `supabase functions serve` |
| Upstash Redis env vars | (not needed in Phase 4) | N/A | — | — |
| Supabase project (remote) | Migration push, Edge Fn deploy | Assumed ✓ (Phase 1-3 shipped) | — | — |
| Discord OAuth configured | Admin login | Assumed ✓ (Phase 1 shipped) | — | — |

**No missing dependencies.** Phase 3 shipped and merged, which means the full Phase 1–3 infrastructure is live. Phase 4 adds zero new environmental requirements.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + @testing-library/react 16.3.2 [VERIFIED: package.json] |
| Config file | `vite.config.ts` — test block with `environment: 'jsdom'`, `setupFiles: './src/test/setup.ts'` [VERIFIED] |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` (single command — project has one test target) |
| Watch mode | `npm run test:watch` |
| Coverage | `npm run test:coverage` |
| Test location | `src/__tests__/**` following existing Phase 1–3 layout |
| Edge Function testing pattern | Source-analysis via `readFileSync` against `supabase/functions/*/index.ts` — see `src/__tests__/integrity/rate-limit-edge-function.test.ts` as template |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ADMN-02 | Promote existing admin inserts via `promote-admin` EF | EF source analysis | `npm test -- admin-promote` | ❌ Wave 0 (`src/__tests__/admin/promote-admin.test.ts`) |
| ADMN-02 | Promote via Discord ID pre-auth inserts into `admin_discord_ids` | EF source analysis | `npm test -- admin-promote` | ❌ Wave 0 |
| ADMN-03 | Demote another admin flips is_admin=false | EF source analysis | `npm test -- admin-demote` | ❌ Wave 0 (`src/__tests__/admin/demote-admin.test.ts`) |
| ADMN-03 | Demote self rejected by server (400 + "Cannot demote yourself") | EF source analysis | `npm test -- admin-demote` | ❌ Wave 0 |
| ADMN-04 | Every admin EF calls `requireAdmin` before DB writes | EF source analysis | `npm test -- admin-auth` | ❌ Wave 0 (`src/__tests__/admin/admin-auth-coverage.test.ts`) — grep all admin EFs for `requireAdmin` import |
| POLL-01 | SuggestionForm renders with all fields; preset buttons pre-fill choices | RTL component | `npm test -- suggestion-form` | ❌ Wave 0 (`src/__tests__/admin/suggestion-form.test.tsx`) |
| POLL-01 | `create-poll` EF validates 2 ≤ choices ≤ 10 | EF source analysis | `npm test -- create-poll` | ❌ Wave 0 |
| POLL-02 | Upload hook calls `get-upload-url` then `uploadToSignedUrl` | RTL hook | `npm test -- use-upload-image` | ❌ Wave 0 |
| POLL-02 | URL input accepts any valid URL string | RTL component | `npm test -- image-input` | ❌ Wave 0 |
| POLL-03 | Preset buttons compute absolute closes_at correctly | RTL component | `npm test -- timer-picker` | ❌ Wave 0 |
| POLL-03 | Custom datetime in past rejected | RTL component | `npm test -- timer-picker` | ❌ Wave 0 |
| POLL-04 | Category picker renders from categories query; create-new-inline opens dialog | RTL component | `npm test -- category-picker` | ❌ Wave 0 |
| POLL-05 | Pin toggle via `pin-poll` EF | RTL hook | `npm test -- pin-poll` | ❌ Wave 0 |
| POLL-05 | Sort order in admin list: pinned first, then created_at DESC | RTL component | `npm test -- admin-suggestion-list` | ❌ Wave 0 |
| POLL-06 | Edit form disabled when vote_count > 0 | RTL component | `npm test -- suggestion-form-edit` | ❌ Wave 0 |
| POLL-06 | `update-poll` EF rejects when votes exist (source analysis) | EF source analysis | `npm test -- update-poll` | ❌ Wave 0 |
| POLL-07 | Close flow requires resolution before confirm | RTL component | `npm test -- close-dialog` | ❌ Wave 0 |
| POLL-07 | `close-poll` EF sets status='closed' + closed_at + resolution | EF source analysis | `npm test -- close-poll` | ❌ Wave 0 |
| CATG-01 | Category create/rename/delete EFs hit DB correctly | EF source analysis | `npm test -- categories` | ❌ Wave 0 |
| CATG-01 | Category delete dialog shows affected suggestion count | RTL component | `npm test -- categories-tab` | ❌ Wave 0 |
| LIFE-01 | `close-expired-polls` EF UPDATE query filters `status='active' AND closes_at < now()` | EF source analysis | `npm test -- close-expired` | ❌ Wave 0 |
| LIFE-01 | `polls_effective` view derives effective status (manual SQL test via migration) | Integration | Manual smoke | ❌ Wave 0 |
| LIFE-02 | Resolution dialog sets resolution on close | RTL component | `npm test -- resolution-on-close` | ❌ Wave 0 |
| LIFE-02 | Auto-closed rows display null-resolution flag | RTL component | `npm test -- admin-suggestion-list` | ❌ Wave 0 |
| LIFE-03 | Archive renders resolution pill on closed cards | RTL component | `npm test -- archive-resolution` | ❌ Wave 0 |
| TEST-05 | (meta — this table is its own proof) | — | — | — |

### Critical Invariants (MUST be validated)

1. **Non-admin cannot insert suggestions** — even with a valid JWT. Covered by ADMN-04 test: mock JWT of non-admin, call `create-poll`, expect 403.
2. **Admin cannot demote self** — ADMN-03 server-side guard. Test: mock admin JWT, POST demote-admin with `target_user_id = own user id`, expect 400 with "Cannot demote yourself".
3. **Post-vote edit is server-rejected** — POLL-06/D-17. Test: mock admin JWT, seed a poll with one vote, call `update-poll`, expect 400.
4. **Post-vote delete is server-rejected** — D-18. Test: mock admin JWT, seed a poll with one vote, call `delete-poll`, expect 400.
5. **Unique-vote constraint is not bypassed by admin writes** — not a new Phase 4 invariant, but the admin-bypass RLS on `votes` must only extend SELECT, not INSERT/UPDATE/DELETE.
6. **Manual close requires resolution** — LIFE-02/D-15. Test: `close-poll` EF with no resolution → 400. With valid resolution → 200 + resolution persisted.
7. **Auto-close does NOT set resolution** — D-15. Test: `close-expired-polls` sweeps an expired poll; `resolution IS NULL` after.
8. **Category delete cascades to `category_id = NULL`** — existing FK behavior; test by deleting category and asserting suggestions' `category_id` is NULL.
9. **`is_current_user_admin()` returns false for non-admins** — SQL test via direct RPC call.
10. **Admin-bypass RLS on `vote_counts` only extends SELECT** — attempt INSERT as admin and expect failure. (Writes must still go through EFs.)

### Sampling Rate
- **Per task commit:** `npm test` (Vitest runs the whole suite; it's fast enough)
- **Per wave merge:** `npm test` + `npm run lint` + `tsc -b --noEmit`
- **Phase gate:** Full suite green + manual smoke of the admin flow (create → edit → pin → close → set resolution → delete where applicable)

### Wave 0 Gaps
- [ ] `src/__tests__/admin/` directory — does not exist; needs creation
- [ ] `src/__tests__/admin/promote-admin.test.ts` — Edge Function source analysis + hook test
- [ ] `src/__tests__/admin/demote-admin.test.ts` — Edge Function source analysis (self-demote, other-admin demote)
- [ ] `src/__tests__/admin/admin-auth-coverage.test.ts` — asserts every admin EF imports `requireAdmin`
- [ ] `src/__tests__/admin/suggestion-form.test.tsx` — RTL test for create form rendering, choice presets, validation
- [ ] `src/__tests__/admin/suggestion-form-edit.test.tsx` — edit mode + lock
- [ ] `src/__tests__/admin/timer-picker.test.tsx`
- [ ] `src/__tests__/admin/category-picker.test.tsx`
- [ ] `src/__tests__/admin/image-input.test.tsx`
- [ ] `src/__tests__/admin/admin-suggestion-list.test.tsx` — sort, filter chips, kebab menu
- [ ] `src/__tests__/admin/close-dialog.test.tsx`
- [ ] `src/__tests__/admin/resolution-on-close.test.tsx`
- [ ] `src/__tests__/admin/categories-tab.test.tsx`
- [ ] `src/__tests__/admin/archive-resolution.test.tsx` — public archive renders resolution pill
- [ ] `src/__tests__/admin/create-poll.test.ts` — EF source analysis
- [ ] `src/__tests__/admin/update-poll.test.ts` — EF source analysis
- [ ] `src/__tests__/admin/close-poll.test.ts`
- [ ] `src/__tests__/admin/delete-poll.test.ts`
- [ ] `src/__tests__/admin/close-expired.test.ts` — EF source analysis for sweep UPDATE query shape
- [ ] `src/__tests__/admin/categories.test.ts` — EF source analysis for CRUD
- [ ] Framework install: none (Vitest + RTL + jsdom already installed)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V1 Architecture | yes | Edge Functions enforce server-side authZ; client `AdminGuard` is UX only |
| V2 Authentication | yes | Supabase Discord OAuth + MFA verification + guild membership (inherited from Phase 1–3) |
| V3 Session Management | yes | Supabase JWT handled by `@supabase/supabase-js`; no custom session |
| V4 Access Control | **yes — CRITICAL for this phase** | Every admin Edge Function calls `requireAdmin()`; self-demote server-side block; edit-lock server-side block; delete-lock server-side block |
| V5 Input Validation | yes | Zod not used; plain TS validators for form + EF body. Title/desc length caps; choice count 2–10; URL parsing for image URL; snowflake regex `^\d{17,19}$` for Discord ID; MIME allowlist + 2 MB cap for uploads |
| V6 Stored Cryptography | no | No custom crypto; Supabase handles JWT |
| V7 Error Handling & Logging | yes | Standardized error envelope `{ error: string }` with 400/401/403/404/500; never leak DB errors to client |
| V8 Data Protection | yes | No PII beyond Discord ID/username/avatar; already established in Phase 1 |
| V9 Communications | yes | HTTPS-only via Supabase + Netlify |
| V10 Malicious Code | yes | No file execution from uploads; Storage serves raw files via CDN; image MIME allowlist prevents SVG (SVG can host JS) |
| V11 Business Logic | yes | Edit lock, delete lock, self-demote, resolution-required-on-manual-close are all business invariants enforced server-side |
| V12 Files & Resources | **yes — new for this phase** | 2 MB cap, MIME allowlist (jpg/png/webp — NO svg, NO gif), random UUID path prevents enumeration, bucket public for read only, writes via signed URL |
| V13 API & Web Service | yes | CORS via `_shared/cors.ts`; rate limits inherited for user actions, not needed for admin actions |
| V14 Configuration | yes | `.env.local` pattern established; service role key never exposed to client |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client bypasses `AdminGuard` via DevTools | Elevation of Privilege | Every EF re-checks `is_admin` server-side (ADMN-04) |
| Forged JWT | Spoofing | Supabase verifies JWT signature; `auth.getUser()` rejects invalid |
| Direct `UPDATE profiles SET is_admin=true` via RLS | Elevation of Privilege | Existing `profile_self_update_allowed` trigger blocks `is_admin` changes from client |
| Self-demote to bypass self-demote guard | Elevation of Privilege | Server-side check in `demote-admin` (D-06); UI hide is additional |
| Edit-after-vote race (edit content of a poll already answered) | Tampering | `update-poll` re-checks `EXISTS votes` server-side |
| Delete-after-vote (destroy response audit trail) | Repudiation | `delete-poll` re-checks `EXISTS votes` server-side |
| SVG upload with embedded JS (XSS via image) | XSS / RCE-via-viewer | MIME allowlist excludes `image/svg+xml` |
| Upload ZIP bomb / oversized file | DoS | 2 MB hard cap at bucket level (`file_size_limit`) |
| Path traversal in filename | Tampering | Sanitize filename in `get-upload-url`; prefix with random UUID; never use client-supplied path segments |
| Admin-bypass RLS recursion via policy on profiles | DoS (infinite recursion) | `is_current_user_admin()` is SECURITY DEFINER; see Pitfall 1 |
| Promote-admin DoS: admin spams fake snowflakes into `admin_discord_ids` | Tampering / DoS | Snowflake regex validation; admin surface is 2 users, low-risk; could add soft cap later |
| Category rename to SQL injection | Tampering | Parameterized queries via supabase-js (no string concat) |
| XSRF on admin actions | Tampering | Supabase EFs require `Authorization` header; same-origin SPA; no cookies involved |

## Sources

### Primary (HIGH confidence — verified in-repo or via `npm view`)
- `/Users/khaiphan/code/wtcs-community-polls/supabase/functions/submit-vote/index.ts` — canonical Edge Function pattern
- `/Users/khaiphan/code/wtcs-community-polls/src/hooks/useVoteSubmit.ts` — canonical client hook pattern
- `/Users/khaiphan/code/wtcs-community-polls/supabase/migrations/00000000000000_schema.sql` — full schema confirmed complete for Phase 4
- `/Users/khaiphan/code/wtcs-community-polls/supabase/migrations/00000000000001_rls.sql` — RLS patterns and "no write policies" rule
- `/Users/khaiphan/code/wtcs-community-polls/supabase/migrations/00000000000002_triggers.sql` — handle_new_user trigger + profile_self_update_allowed guard
- `/Users/khaiphan/code/wtcs-community-polls/supabase/migrations/00000000000003_guild_membership.sql` — extends the RPC pattern
- `/Users/khaiphan/code/wtcs-community-polls/src/components/auth/AdminGuard.tsx` — client gate pattern
- `/Users/khaiphan/code/wtcs-community-polls/src/__tests__/integrity/rate-limit-edge-function.test.ts` — source-analysis test pattern for EFs
- `/Users/khaiphan/code/wtcs-community-polls/package.json` — version floor
- `/Users/khaiphan/code/wtcs-community-polls/components.json` — shadcn/ui config (new-york, neutral, lucide)
- `/Users/khaiphan/code/wtcs-community-polls/vite.config.ts` — Vitest config (jsdom, setupFiles)
- `npm view` output (2026-04-11): `@supabase/supabase-js@2.103.0`, `@tanstack/react-router@1.168.18`, `shadcn@4.2.0`, `@upstash/ratelimit@2.0.8`, `react-hook-form@7.72.1`, `zod@4.3.6`
- [.planning/phases/04-admin-panel-suggestion-management/04-CONTEXT.md](../.planning/phases/04-admin-panel-suggestion-management/04-CONTEXT.md) — locked decisions
- [.planning/phases/04-admin-panel-suggestion-management/04-UI-SPEC.md](../.planning/phases/04-admin-panel-suggestion-management/04-UI-SPEC.md) — locked UI contract

### Secondary (MEDIUM confidence — WebSearch + docs references)
- [Supabase JS Reference: storage-from-createSignedUploadUrl](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) — signed upload pattern, 2-hour validity, token + path return shape
- [Supabase Storage Access Control docs](https://supabase.com/docs/guides/storage/security/access-control) — RLS on `storage.objects`, service role bypass
- [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — SECURITY DEFINER helper pattern for admin checks
- [TanStack Router Authenticated Routes](https://tanstack.com/router/latest/docs/guide/authenticated-routes) — beforeLoad + router context pattern (not adopting, but documented)
- [shadcn/ui Tailwind v4 changelog](https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4) — Tailwind v4 + React 19 support confirmed
- [shadcn/ui Tabs docs](https://ui.shadcn.com/docs/components/radix/tabs) — component API reference

### Tertiary (LOW confidence — flagged for validation)
- [GitHub: supabase/supabase-js issues/1672](https://github.com/supabase/supabase-js/issues/1672) — known upsert-with-signed-URL bug; pattern avoidance guidance only
- Free-tier storage quotas (1 GB) — from training data; planner should re-verify during Phase 5 if usage grows

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified in `package.json` + `npm view`
- Architecture: HIGH — clones existing Phase 1–3 patterns that are already live in production
- Pitfalls: HIGH — patterns learned from the existing codebase (fail-closed, EXISTS-based locks, upsert-free signed uploads)
- Storage signed-upload flow: HIGH — Supabase API surface is stable since ~2.39, verified via WebSearch → official docs URL
- RLS admin bypass pattern: HIGH — SECURITY DEFINER helper is the Supabase-documented idiom
- Lazy-close view: MEDIUM (A8) — view RLS inheritance assumed from training data; planner should verify in first migration test
- TanStack Router auth: HIGH — we're intentionally NOT using `beforeLoad` and reusing `AdminGuard`

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (30-day window — stack is stable, versions barely drift)
