# Phase 4: Admin Panel & Suggestion Management - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the full admin surface for creating, configuring, and managing suggestions end-to-end. This phase covers: suggestion creation (dynamic choices with Yes/No and 4-choice presets, image via upload-or-URL, category, timer), lifecycle management (edit-before-first-response, manual close, pin, auto-close via timer, archive with resolution status), category CRUD, and admin promotion/demotion. All admin actions are server-verified via Edge Functions. This phase also adds the WTCS logo to the app-wide navbar and removes the Phase 3 pg_cron blocker via a lazy-close-on-read + scheduled-sweep design. It does NOT build the Phase 5 deployment/keepalive infrastructure — the daily sweep Edge Function is built here, but hooking it into a real scheduler is Phase 5's job (we can test it via manual invoke in Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Admin Shell & Navigation
- **D-01:** Admin panel is a **single `/admin` route with tabs**: Suggestions, Categories, Admins. Mobile-friendly, matches a small-surface admin tool, fastest to ship. The existing `/admin/index.tsx` stub is replaced.
- **D-02:** Suggestion create/edit uses **dedicated form pages**: `/admin/suggestions/new` and `/admin/suggestions/:id/edit`. Full-screen forms are the only sane layout for the dynamic-choices + image + timer combo on phones. Edit pages are URL-sharable for resume.
- **D-03:** **WTCS logo** goes in the navbar on the left, **app-wide** (public and admin surfaces). Source file is `src/assets/wtcs-logo.png` (9.9 KB). Imported via Vite's asset pipeline (`import logo from '@/assets/wtcs-logo.png'`) so it gets cache-busting hashing on build — not `public/`.

### Admin Promotion, Demotion, and Seeding
- **D-04:** Promote UX is **search existing profiles + paste Discord ID fallback**. The search input does a server-side `ilike` query on `profiles.discord_username` with a min-2-char trigger and a 10-row limit (no scroll-a-list UX). If the target hasn't signed in yet, an admin can paste the raw Discord snowflake to pre-authorize them via `admin_discord_ids` — they become admin the first time they log in.
- **D-05:** **Existing map-vote admins are seeded via a one-time SQL migration** that inserts 2-3 Discord IDs into `admin_discord_ids`. The existing `handle_new_user` trigger already derives `profiles.is_admin` from that table on first login, so zero manual post-deploy steps. **I need the Discord IDs (2-3) during planning.**
- **D-06:** **Self-demotion is blocked in both UI and server.** The `/admin/admins` row hides/disables the Demote button on the acting admin's own row; the `demote-admin` Edge Function rejects any request where `target_user_id == acting_user_id`. Server is the real guard, UI is good UX.

### Suggestion Creation Form UX
- **D-07:** **Choices editor** has two preset buttons at the top — `[Yes/No]` and `[4-choice]` — that pre-fill the choices list. Below: a vertical list of choice inputs with a `[–]` remove button per row and an `[+ Add choice]` button at the bottom. Minimum 2, no hard max (soft cap ~10 enforced at UI). Reorder is not required; if it becomes needed later, add up/down arrow buttons rather than drag.
- **D-08:** **Image input is a two-tab control** inside the form: `[Upload]` (dropzone + file picker → Supabase Storage) and `[Paste URL]` (plain text input for external URL). Either path stores the final URL in `polls.image_url`. A thumbnail preview appears below the tabs once set, with a `[Clear]` button. This matches the PROJECT.md decision to support both sources.
- **D-09:** **Timer picker** is three preset buttons `[7 days]` `[14 days]` `[Custom]`. Custom reveals a date/time picker. The form stores the absolute `closes_at` timestamp in the DB (not a duration).
- **D-10:** **Category picker** is a single `<Select>` dropdown populated from the `categories` table, plus an **inline `+ Create new category…`** action at the bottom of the dropdown list. Selecting that action opens a small inline input (or dialog) to name the new category without leaving the form.

### Image Storage
- **D-11:** Suggestion images uploaded through the form go to a Supabase Storage **public bucket** (e.g., `poll-images`). Client upload uses the signed-upload pattern via a `get-upload-url` Edge Function so RLS/auth is enforced. Exact bucket name, path convention, file size limit, and allowed MIME types are Claude's discretion during planning (targets: ~2 MB max, jpg/png/webp, path `poll-images/{poll_id_or_nonce}/{filename}`).

### Auto-Close & Lifecycle
- **D-12:** **Auto-close uses a two-layer lazy-then-sweep design** — **no pg_cron dependency**, which removes the STATE.md blocker.
  - *Read path (lazy):* All suggestion reads go through a view or `SELECT` that derives effective status from `CASE WHEN closes_at < now() AND status = 'active' THEN 'closed' ELSE status END`. Users never see an expired-but-still-active suggestion.
  - *Write path (sweep):* A `close-expired-polls` Edge Function runs `UPDATE polls SET status='closed', closed_at=now() WHERE status='active' AND closes_at < now()` on invocation. Phase 4 builds this function and tests it via manual invoke; Phase 5 will wire it to a scheduler (Netlify scheduled function or external cron) that calls it daily, reusing the same keepalive cron infrastructure Phase 5 needs.
- **D-13:** **Respondent-only results visibility remains unchanged** after a suggestion closes — existing `vote_counts` RLS ("visible to voters") already enforces it. Phase 2 success criterion 5 stands.
- **D-14:** **Admins bypass the respondent-only rule.** The `vote_counts` and `votes` RLS SELECT policies get an `OR (EXISTS profile is_admin)` branch so admins can monitor sentiment without having to respond. This requires a migration updating those two policies.

### Admin Actions on Suggestions
- **D-15:** **Resolution status is set via a modal on manual close**, with three buttons (Addressed / Forwarded / Closed), and the resolution is required to confirm the close. Afterwards, the resolution is **editable** from the suggestion's row menu. **Auto-closed** suggestions start with `resolution = NULL` and the admin sets it later from the row menu; the `/admin` list should visually flag closed-with-null-resolution rows so admins remember to act on them.
- **D-16:** **Each admin suggestion row has a `⋮` kebab menu** exposing: View results, Edit (disabled/greyed if `vote_count > 0`), Pin/Unpin, Close…, Set resolution…, Delete (disabled/greyed if `vote_count > 0`). Mobile-friendly, keeps rows compact.

### Edit Lock (POLL-06)
- **D-17:** **Once any vote exists, the suggestion is fully immutable** except via admin lifecycle actions (Close, Pin/Unpin, Set resolution). No title/description/timer/image/choices edits. Server enforces this in the `update-poll` Edge Function with a single-query guard: reject the UPDATE if `EXISTS(SELECT 1 FROM votes WHERE poll_id = :id)`. UI greys out the Edit menu item when the row has a non-zero vote count (uses the existing `vote_counts` table).

### Delete Suggestion
- **D-18:** **Delete is hard delete, pre-vote only, with a confirmation dialog.** Available in the kebab menu only when `vote_count = 0`. Once any response exists, Delete is replaced by Close as the only terminal action — protects respondent data. Hard `DELETE FROM polls` cascades to `choices` and the (empty) `vote_counts` row via existing `ON DELETE CASCADE` constraints.

### Pin Display
- **D-19:** **Pinned suggestions float to the top** via `ORDER BY is_pinned DESC, created_at DESC`, with a small 📌 Pinned badge on the card (using the `pin` Lucide icon to match the existing icon set). Multiple pins are allowed; newer pinned rows appear above older pinned rows within the pinned cluster. This applies to both the public feed (Phase 2's topics list) and the admin Suggestions tab.

### Admin Suggestions Tab
- **D-20:** **`/admin` Suggestions tab uses filter chips** at the top: `Active | Closed | All`, defaulting to **Active**. Single flat list below, no nested tabs. The filter is a URL query param so admins can deep-link.

### Category Management
- **D-21:** Categories tab is a **simple inline-editable list**: existing categories as rows with rename (inline edit) and delete (with confirmation) actions, plus an `[+ New category]` button at the top. Backed by three Edge Functions: `create-category`, `rename-category`, `delete-category`. Schema FK is already `ON DELETE SET NULL`, so deleting a category leaves suggestions with `category_id = NULL` (shown as "Uncategorized" on the public feed). The delete-confirmation dialog shows the count of suggestions that will become uncategorized.

### Testing (TEST-05)
- **D-22:** Admin actions have unit/integration tests covering:
  - Suggestion CRUD: create, edit (pre-vote), edit (locked after vote), hard delete (pre-vote), delete (locked after vote), close (sets resolution), auto-close sweep, pin/unpin
  - Resolution status lifecycle (required on manual close, editable after, nullable on auto-close)
  - Admin promotion/demotion (server rejects non-admin caller, server rejects self-demote, UI reflects state)
  - Admin-bypass RLS (admin sees vote_counts for polls they haven't voted on; non-admin without a vote still rejected)
  - Category CRUD + delete cascade behavior (suggestions become uncategorized)
  - Pattern matches Phase 2/3 testing layout (Vitest + React Testing Library for UI, Edge Function behavior tests for server logic).

### Claude's Discretion (not worth asking)
- Exact Supabase Storage bucket name, upload path convention, max file size, allowed MIME types
- Exact form validation rules (min/max choice count, title length limits, description length limits)
- Exact server-side `ilike` query shape for admin search + pagination cap
- Empty-state copy/imagery for /admin Suggestions, Categories, Admins when empty
- Soft cap on number of choices at the UI layer (~10)
- Whether `vote_count = 0` for the edit/delete gate reads from the `vote_counts` table or a direct `COUNT(*)` — both are fine
- Exact Lucide icons for kebab menu items, tab labels, form fields
- Whether the admin search input lives in the Admins tab or in a promote dialog launched from that tab

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 4 Requirements & Project Docs
- `.planning/REQUIREMENTS.md` — ADMN-02/03/04, POLL-01..07, CATG-01, LIFE-01..03, TEST-05
- `.planning/PROJECT.md` — Core value, terminology mapping, key decisions (Storage + URL, HTTP polling, etc.)
- `.planning/DESIGN-SYSTEM.md` — shadcn/ui Maia/Neutral palette, Inter font, user-facing vs internal terminology
- `.planning/ROADMAP.md` — Phase 4 success criteria and dependencies
- `.planning/STATE.md` — pg_cron blocker note (resolved by D-12 here)

### Prior Phase Context (Decisions That Still Apply)
- `.planning/phases/01-foundation-authentication/01-CONTEXT.md` — DB schema and auth patterns
- `.planning/phases/02-browsing-responding/02-CONTEXT.md` — Read patterns, results visibility, topics page
- `.planning/phases/03-response-integrity/03-CONTEXT.md` — Edge Function auth patterns, fail-closed

### Existing Schema & Migrations
- `supabase/migrations/00000000000000_schema.sql` — `polls`, `choices`, `votes`, `vote_counts`, `categories`, `profiles`, `admin_discord_ids` tables (all fields needed for Phase 4 already exist)
- `supabase/migrations/00000000000001_rls.sql` — Existing SELECT policies; Phase 4 adds admin-bypass branches to `vote_counts` and `votes`
- `supabase/migrations/00000000000002_triggers.sql` — `handle_new_user` trigger (derives `is_admin` from `admin_discord_ids` — reused for D-05 seeding)
- `supabase/migrations/00000000000003_guild_membership.sql` — Phase 3 guild-membership column
- `supabase/migrations/00000000000004_fix_trigger_rpc_context.sql`

### Existing Auth & Admin Scaffold
- `src/components/auth/AdminGuard.tsx` — Already gates `/admin/*` via `useAuth.isAdmin`; reused as-is
- `src/routes/admin/index.tsx` — Current stub that this phase replaces with the tabbed shell
- `src/contexts/AuthContext.tsx` — Auth provider; Phase 4 hooks read `isAdmin` from here
- `src/lib/auth-helpers.ts` — `handleAuthCallback` (fail-closed pattern; not modified by Phase 4 but referenced for consistency)

### Existing Edge Function Patterns
- `supabase/functions/submit-vote/index.ts` — Canonical Edge Function shape (auth check, validation, Upstash rate limit, error envelope). Phase 4 Edge Functions mirror its structure.
- `supabase/functions/_shared/cors.ts` — Shared CORS helper

### Existing Client Patterns
- `src/components/suggestions/` — Existing suggestion card components reused by the public feed (pin badge added here)
- `src/routes/topics.tsx` — Public list where pin sort order + badge get applied
- `src/routes/archive.tsx` — Public closed-suggestion archive (resolution status rendered here)
- `src/hooks/useVoteSubmit.ts` — Canonical client-side Edge Function call + toast pattern for Phase 4 admin hooks to mirror
- `src/lib/types/database.types.ts` — Regenerated after Phase 4 migrations

### Phase 5 Forward-Link
- Phase 5 scheduler wires `close-expired-polls` Edge Function to a real cron (Netlify scheduled function or external). Phase 4 builds the function + tests it via manual invoke.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AdminGuard` component** — already gates `/admin/*` routes on `useAuth.isAdmin`. No changes needed; the new tabbed `/admin` page is wrapped in it.
- **`handle_new_user` trigger** — already derives `profiles.is_admin` from `admin_discord_ids` on first login. Seeding map-vote admins is literally just a few rows of INSERT (D-05).
- **`polls` table schema** — all Phase 4 fields already exist: `title`, `description`, `category_id`, `image_url`, `status`, `resolution`, `is_pinned`, `closes_at`, `closed_at`, `created_by`. Zero schema work for the suggestion model itself.
- **`vote_counts` table + existing "visible to voters" RLS** — reused as-is for the edit/delete gate (check `vote_count > 0`) and the admin-bypass RLS patch (D-14).
- **`submit-vote` Edge Function pattern** — canonical shape for Phase 4's admin Edge Functions (`create-poll`, `update-poll`, `close-poll`, `pin-poll`, `delete-poll`, `set-resolution`, `create-category`, `rename-category`, `delete-category`, `promote-admin`, `demote-admin`, `search-admin-targets`, `get-upload-url`, `close-expired-polls`).
- **`useVoteSubmit` hook pattern** — canonical client-side shape: call Edge Function, handle error envelope, fire Sonner toast. Phase 4 admin hooks (`useCreatePoll`, `usePromoteAdmin`, etc.) mirror this.
- **`AuthErrorPage` + Sonner** — error UX primitives; admin errors surface as Sonner toasts, auth errors route through `AuthErrorPage`.
- **`/admin/index.tsx` stub** — replaced with the tabbed shell; `AdminGuard` wrapper pattern carries over.
- **`topics.tsx` + `archive.tsx`** — Phase 2/3 list components extended with pin sort order + 📌 badge + admin kebab menu (when `isAdmin`).

### Established Patterns
- **Edge Functions for all writes** with `service_role` key; RLS has no INSERT/UPDATE/DELETE policies for the `authenticated` role.
- **Fail-closed auth** from Phase 3 — extended to admin checks: every admin Edge Function rejects on missing/invalid `is_admin` server-side; no client-trust.
- **Sonner toasts** for user-visible errors and success feedback.
- **Supabase CLI migrations** (`supabase/migrations/`) for all schema and RLS changes.
- **TanStack Router file-based routes**; new admin subroutes follow the existing pattern.
- **shadcn/ui components** (Dialog, Tabs, Select, Button, Input, DropdownMenu for the ⋮ kebab) for all new UI.
- **Vitest + React Testing Library** for unit/integration tests.

### Integration Points
- **Navbar** (`src/components/layout/`) — logo SVG added here; applies app-wide. Need the logo source file (see open questions).
- **`topics.tsx`** — extend the existing list's `ORDER BY` and card render to honor `is_pinned` + 📌 badge.
- **`archive.tsx`** — render `resolution` pill on each closed suggestion; admin users get a kebab menu to change resolution.
- **`/admin/index.tsx`** — replaced with tabbed shell (Suggestions | Categories | Admins).
- **`/admin/suggestions/new` and `/admin/suggestions/:id/edit`** — new routes hosting the suggestion form.
- **RLS migration** — new migration (probably `00000000000005_admin_bypass_and_seed.sql`) that (a) adds admin-bypass branches to `vote_counts` and `votes` SELECT policies and (b) seeds `admin_discord_ids`.
- **Storage bucket** — new `poll-images` public bucket created via migration or Supabase dashboard, plus a `get-upload-url` Edge Function to hand out signed upload URLs.
- **`close-expired-polls` Edge Function** — new function; Phase 4 tests via manual invoke; Phase 5 schedules it.

### Creative Options the Architecture Enables
- **Admin-bypass RLS via a single OR branch** on existing SELECT policies — no view, no separate endpoint, plays cleanly with the existing read stack.
- **Lazy-close on read via a DB view or RPC** — removes the whole pg_cron dependency chain and means client code doesn't need to special-case "expired but not-yet-swept" rows.
- **Edit/delete gate keyed off `vote_counts`** — reuses an existing aggregate; no extra query.

</code_context>

<specifics>
## Specific Ideas

- **Admin count is tiny (2-3 total).** The seed migration for D-05 is literally a 3-row INSERT. Promote UI design doesn't need to scale to hundreds of admins.
- **WTCS logo is reused from the existing map-vote site** — source file location is an open question (see below). Apply it app-wide in the navbar, left-aligned.
- **Migrating existing map-vote admins is NOT a cross-app data migration.** It's seeding the handful of Discord IDs we already know into `admin_discord_ids`. No email linking, no Convex-to-Supabase sync — identity is Discord-ID-only.
- **Resolution status tone** — the user has already decided (per PROJECT.md) to avoid "Rejected" / "Implemented" framing. Addressed / Forwarded / Closed stands.
- **Close-expired-polls function is built here but scheduled in Phase 5.** Phase 4's acceptance: function exists, manual invoke works, tests pass. Phase 5's acceptance: scheduled and runs daily.

</specifics>

<open_questions>
## Open Questions (Needed During Planning, Not Blocking This Doc)

1. **The 2-3 Discord IDs to seed into `admin_discord_ids`.** Needed before the seed migration can be written. Planner should prompt for them during plan creation if still missing.

</open_questions>

<deferred>
## Deferred Ideas

None — everything the user raised during discussion was folded into the phase scope above. No scope-creep items to defer.

</deferred>

---

*Phase: 04-admin-panel-suggestion-management*
*Context gathered: 2026-04-11*
