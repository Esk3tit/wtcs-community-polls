# Phase 19: DB Migration + A11y Restore - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 7 (2 new, 3 modified, 2 test edits)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/00000000000015_trusted_profile_update_guc.sql` | migration | CRUD / transform | `supabase/migrations/00000000000014_harden_security_definer_search_path.sql` | exact |
| `e2e/integration/profile-trigger-gate.test.ts` | test (integration) | request-response | `e2e/integration/vote-counts-rls.test.ts` | exact |
| `src/components/ui/card.tsx` (CardTitle edit) | component (primitive) | request-response | `src/components/ui/button.tsx` + `src/components/ui/badge.tsx` | exact |
| `src/components/admin/AdminsList.tsx` (call-site edit) | component | request-response | `src/components/admin/CategoriesList.tsx` | exact (sibling) |
| `src/components/admin/CategoriesList.tsx` (call-site edit) | component | request-response | `src/components/admin/AdminsList.tsx` | exact (sibling) |
| `src/__tests__/admin/admins-tab.test.tsx` (comment edit) | test (unit) | request-response | `src/__tests__/admin/categories-tab.test.tsx` | exact (sibling) |
| `src/__tests__/admin/categories-tab.test.tsx` (comment edit) | test (unit) | request-response | `src/__tests__/admin/admins-tab.test.tsx` | exact (sibling) |

---

## Pattern Assignments

### `supabase/migrations/00000000000015_trusted_profile_update_guc.sql` (migration, CRUD/transform)

**Analog:** `supabase/migrations/00000000000014_harden_security_definer_search_path.sql`

**File header comment pattern** (lines 1–14 of migration 14):
```sql
-- Hardens pre-existing definer-rights functions by pinning
-- search_path = '' and ensuring all references are schema-qualified.
-- Clears `0011_function_search_path_mutable` advisor WARNs for the
-- 6 user-owned functions targeted here.
--
-- Bodies match the production pg_get_functiondef output captured
-- before this migration was authored — ...
```

**`CREATE OR REPLACE FUNCTION` header pattern** — apply to both functions (lines 116–121 and 158–167 of migration 14):
```sql
CREATE OR REPLACE FUNCTION public.profile_self_update_allowed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
```
```sql
CREATE OR REPLACE FUNCTION public.update_profile_after_auth(
  p_mfa_verified BOOLEAN,
  p_discord_username TEXT,
  p_avatar_url TEXT,
  p_guild_member BOOLEAN DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
```

**Current live body of `profile_self_update_allowed` to replace** (lines 122–153 of migration 14):
```sql
BEGIN
  -- Always enforce immutable columns regardless of caller
  IF NEW.id != OLD.id THEN
    RAISE EXCEPTION 'Cannot change profile id';
  END IF;
  IF NEW.discord_id != OLD.discord_id THEN
    RAISE EXCEPTION 'Cannot change discord_id';
  END IF;
  IF NEW.created_at != OLD.created_at THEN
    RAISE EXCEPTION 'Cannot change created_at';
  END IF;

  -- Skip protected-column checks when invoked through a definer-rights
  -- function (e.g., update_profile_after_auth RPC). In that context,
  -- current_user is the function owner (e.g., postgres), not the session role.
  IF current_user = session_user THEN                          -- THIS GATE IS BROKEN
    IF NEW.is_admin != OLD.is_admin THEN
      RAISE EXCEPTION 'Cannot change is_admin via client';
    END IF;
    IF NEW.mfa_verified != OLD.mfa_verified THEN
      RAISE EXCEPTION 'Cannot change mfa_verified via client -- use update_profile_after_auth RPC';
    END IF;
    IF NEW.guild_member != OLD.guild_member THEN
      RAISE EXCEPTION 'Cannot change guild_member via client -- use update_profile_after_auth RPC';
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
```

**Replacement body for `profile_self_update_allowed`** — GUC gate replaces `current_user = session_user`:
```sql
BEGIN
  -- Always enforce immutable columns regardless of caller
  IF NEW.id != OLD.id THEN
    RAISE EXCEPTION 'Cannot change profile id';
  END IF;
  IF NEW.discord_id != OLD.discord_id THEN
    RAISE EXCEPTION 'Cannot change discord_id';
  END IF;
  IF NEW.created_at != OLD.created_at THEN
    RAISE EXCEPTION 'Cannot change created_at';
  END IF;

  -- Check trusted-context flag set by update_profile_after_auth.
  -- missing_ok=true returns '' when the GUC is absent (direct client path).
  -- is_local=true on set_config ensures the flag auto-clears after commit.
  IF current_setting('app.trusted_profile_update', true) != 'on' THEN
    -- Direct client update — enforce protected column restrictions
    IF NEW.is_admin != OLD.is_admin THEN
      RAISE EXCEPTION 'Cannot change is_admin via client';
    END IF;
    IF NEW.mfa_verified != OLD.mfa_verified THEN
      RAISE EXCEPTION 'Cannot change mfa_verified via client -- use update_profile_after_auth RPC';
    END IF;
    IF NEW.guild_member != OLD.guild_member THEN
      RAISE EXCEPTION 'Cannot change guild_member via client -- use update_profile_after_auth RPC';
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
```

**Current live body of `update_profile_after_auth` to replace** (lines 169–183 of migration 14):
```sql
BEGIN
  UPDATE public.profiles
  SET
    mfa_verified = p_mfa_verified,
    discord_username = p_discord_username,
    avatar_url = p_avatar_url,
    guild_member = p_guild_member,
    updated_at = NOW()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for current user';
  END IF;
END;
```

**Replacement body for `update_profile_after_auth`** — adds `set_config` before the UPDATE:
```sql
BEGIN
  -- Mark this transaction as trusted so profile_self_update_allowed
  -- skips protected-column checks. is_local=true scopes to this
  -- transaction only — auto-clears on commit/rollback, safe under
  -- PgBouncer transaction pooling.
  PERFORM set_config('app.trusted_profile_update', 'on', true);

  UPDATE public.profiles
  SET
    mfa_verified = p_mfa_verified,
    discord_username = p_discord_username,
    avatar_url = p_avatar_url,
    guild_member = p_guild_member,
    updated_at = NOW()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for current user';
  END IF;
END;
```

**`COMMENT ON FUNCTION` pattern** — must be updated in migration 15 to describe the new GUC gate (migration 02, lines 60–63 of `00000000000002_triggers.sql` shows the pattern; migration 15 supersedes it):
```sql
COMMENT ON FUNCTION public.profile_self_update_allowed IS
  'Guards profile self-update: blocks id/discord_id/created_at unconditionally; '
  'blocks is_admin/mfa_verified/guild_member when app.trusted_profile_update GUC is absent '
  '(direct client write). update_profile_after_auth sets the GUC (transaction-local) before '
  'its UPDATE so the protected-column checks are skipped on the RPC path.';
```

**Critical constraints from migration 14 (do not violate):**
- Always `CREATE OR REPLACE FUNCTION` — never `DROP` + `CREATE` (trigger references function by OID; drop severs the binding)
- Always `SET search_path = ''` on every function header — required to keep `0011_function_search_path_mutable` advisor WARNs clear
- Always fully qualify schema: `public.profiles`, `auth.uid()`, etc.
- `current_setting('app.trusted_profile_update', true)` — the three-arg form with `missing_ok = true` is mandatory; the two-arg form raises an error when the GUC has never been set

---

### `e2e/integration/profile-trigger-gate.test.ts` (integration test, request-response)

**Analog:** `e2e/integration/vote-counts-rls.test.ts`

**Imports pattern** (lines 1–23 of `vote-counts-rls.test.ts`):
```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mintClients,
  createFreshPoll,
  castVote,
  cleanupPoll,
  type IntegrationClients,
} from './helpers'
import { fixtureUsers } from '../fixtures/test-users'
```

For the trigger-gate test, the relevant subset is:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  mintClients,
  type IntegrationClients,
} from './helpers'
import { fixtureUsers } from '../fixtures/test-users'
```

**`mintClients` call pattern** (lines 35–40 of `vote-counts-rls.test.ts`):
```typescript
beforeAll(async () => {
  const clients: IntegrationClients = await mintClients({ authAs: 'memberUser' })
  anon = clients.anon
  authed = clients.authed
  serviceRole = clients.serviceRole
})
```

Simpler form without destructuring (acceptable per precedent):
```typescript
let clients: IntegrationClients

beforeAll(async () => {
  clients = await mintClients({ authAs: 'memberUser' })
})
```

**Cleanup pattern using serviceRole** (modeled on `afterEach` in `vote-counts-rls.test.ts` lines 42–47, adapted for profile restoration):
```typescript
afterAll(async () => {
  // Restore fixture profile to seed state so sibling suites see expected values.
  await clients.serviceRole
    .from('profiles')
    .update({ mfa_verified: true, guild_member: true })
    .eq('id', fixtureUsers.memberUser.id)
})
```

**Direct-client UPDATE assertion pattern** (modeled on lines 103–116 of `vote-counts-rls.test.ts`):
```typescript
it('(a) direct authenticated UPDATE to mfa_verified is rejected by trigger', async () => {
  const { error } = await clients.authed
    .from('profiles')
    .update({ mfa_verified: false })
    .eq('id', fixtureUsers.memberUser.id)
  expect(error).not.toBeNull()
  expect(error!.message).toMatch(/mfa_verified via client/i)
})
```

**RPC success assertion pattern** — `supabase-js` `.rpc()` call:
```typescript
it('(b) update_profile_after_auth RPC succeeds in setting mfa_verified and guild_member', async () => {
  const { error } = await clients.authed.rpc('update_profile_after_auth', {
    p_mfa_verified: true,
    p_discord_username: 'PlaywrightMember',
    p_avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    p_guild_member: true,
  })
  expect(error).toBeNull()
})
```

**Error surface pattern** (lines 108–111 of `vote-counts-rls.test.ts` — `if (error) throw error` is NOT used for the trigger-gate test because the error IS the assertion; that pattern is for unexpected errors only):
```typescript
// In vote-counts-rls.test.ts, schema/availability errors are surfaced loudly:
if (error) throw error
// Do NOT use this pattern in profile-trigger-gate — error on path (a) is expected.
```

**`fixtureUsers` usage** (lines 94–96 of `vote-counts-rls.test.ts`):
```typescript
import { fixtureUsers } from '../fixtures/test-users'
// fixtureUsers.memberUser.id is the UUID used in .eq() filters
```

---

### `src/components/ui/card.tsx` — CardTitle edit (component, request-response)

**Analog:** `src/components/ui/button.tsx` (exact — same Slot.Root pattern)
**Second analog:** `src/components/ui/badge.tsx` (confirms pattern consistency)

**Import addition** — add `Slot` import (from `button.tsx` line 3):
```typescript
import { Slot } from "radix-ui"
```
Card.tsx currently has only `import * as React from "react"` and `import { cn } from "@/lib/utils"`. Add `import { Slot } from "radix-ui"` as the third import, between those two.

**Current `CardTitle` definition to replace** (`src/components/ui/card.tsx` lines 31–39):
```typescript
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}
```

**`asChild` pattern from `button.tsx`** (lines 41–62):
```typescript
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      ...
    />
  )
}
```

**`asChild` pattern from `badge.tsx`** (lines 29–46 — simpler, closer in shape to CardTitle since no variants):
```typescript
function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}
```

**Replacement `CardTitle` definition** — apply badge/button pattern (no variants, so minimal extension):
```typescript
function CardTitle({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div"
  return (
    <Comp
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}
```

**Note on `Slot.Root` vs `Slot`:** `radix-ui` 1.4.3 exports `Slot` as a namespace object. Both `button.tsx` (line 51) and `badge.tsx` (line 36) use `Slot.Root` — not `Slot` directly. The CardTitle change must match: `const Comp = asChild ? Slot.Root : "div"`.

---

### `src/components/admin/AdminsList.tsx` — call-site edit (component, request-response)

**Analog (sibling):** `src/components/admin/CategoriesList.tsx`

**Current ARIA-workaround form to remove** (`AdminsList.tsx` line 94):
```tsx
<CardTitle role="heading" aria-level={2} className="text-base">
  Admins
</CardTitle>
```

**Replacement semantic heading form:**
```tsx
<CardTitle asChild className="text-base">
  <h2>Admins</h2>
</CardTitle>
```

**Surrounding context preserved** (lines 92–103 of `AdminsList.tsx`):
```tsx
<Card className="py-0 overflow-hidden">
  <CardHeader>
    <CardTitle asChild className="text-base">
      <h2>Admins</h2>
    </CardTitle>
    <CardAction>
      <Button onClick={() => setPromoteOpen(true)} size="sm" className="h-9">
        <UserPlus className="h-4 w-4 mr-1" />
        Promote admin
      </Button>
    </CardAction>
  </CardHeader>
```

**Do NOT add `className` to the inner `<h2>`** — per RESEARCH.md Pitfall 5, all styling belongs on the `<CardTitle asChild className="...">` wrapper; the inner `<h2>` stays attribute-free.

---

### `src/components/admin/CategoriesList.tsx` — call-site edit (component, request-response)

**Analog (sibling):** `src/components/admin/AdminsList.tsx`

**Current ARIA-workaround form to remove** (`CategoriesList.tsx` line 171):
```tsx
<CardTitle role="heading" aria-level={2} className="text-base">
  Categories
</CardTitle>
```

**Replacement semantic heading form:**
```tsx
<CardTitle asChild className="text-base">
  <h2>Categories</h2>
</CardTitle>
```

**Surrounding context preserved** (lines 169–185 of `CategoriesList.tsx`):
```tsx
<Card className="py-0 overflow-hidden">
  <CardHeader>
    <CardTitle asChild className="text-base">
      <h2>Categories</h2>
    </CardTitle>
    <CardAction>
      <Button
        size="sm"
        className="h-9"
        onClick={handleStartNew}
        disabled={newRowActive || submitting}
      >
        <Plus className="h-4 w-4 mr-1" />
        New category
      </Button>
    </CardAction>
  </CardHeader>
```

---

### `src/__tests__/admin/admins-tab.test.tsx` — comment edit (unit test)

**No behavioral change — comment text only.**

**Current comment on the heading test** (lines 122–129 of `admins-tab.test.tsx`):
```typescript
it('exposes the Admins section title as a level-2 heading', async () => {
  render(<AdminsList />)
  // CardTitle renders a plain <div>; role="heading" + aria-level keep the
  // section reachable by screen-reader heading navigation after the Card migration.
  expect(
    await screen.findByRole('heading', { level: 2, name: 'Admins' }),
  ).toBeInTheDocument()
})
```

**Updated comment after the fix** — assertion stays identical; only the stale ARIA-workaround explanation changes:
```typescript
it('exposes the Admins section title as a level-2 heading', async () => {
  render(<AdminsList />)
  // CardTitle asChild renders a native <h2> — no ARIA override needed.
  expect(
    await screen.findByRole('heading', { level: 2, name: 'Admins' }),
  ).toBeInTheDocument()
})
```

**Import pattern** (lines 1–8 of `admins-tab.test.tsx` — no change needed):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from '@testing-library/react'
import { AdminsList } from '@/components/admin/AdminsList'
```

---

### `src/__tests__/admin/categories-tab.test.tsx` — comment edit (unit test)

**No behavioral change — comment text only.**

**Current comment on the heading test** (lines 103–110 of `categories-tab.test.tsx`):
```typescript
it('exposes the Categories section title as a level-2 heading', async () => {
  render(<CategoriesList />)
  // CardTitle renders a plain <div>; role="heading" + aria-level keep the
  // section reachable by screen-reader heading navigation after the Card migration.
  expect(
    await screen.findByRole('heading', { level: 2, name: 'Categories' }),
  ).toBeInTheDocument()
})
```

**Updated comment after the fix:**
```typescript
it('exposes the Categories section title as a level-2 heading', async () => {
  render(<CategoriesList />)
  // CardTitle asChild renders a native <h2> — no ARIA override needed.
  expect(
    await screen.findByRole('heading', { level: 2, name: 'Categories' }),
  ).toBeInTheDocument()
})
```

---

## Shared Patterns

### SECURITY DEFINER function structure
**Source:** `supabase/migrations/00000000000014_harden_security_definer_search_path.sql`
**Apply to:** Both functions in migration 15
```sql
CREATE OR REPLACE FUNCTION public.<name>(...)
RETURNS <type>
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- body with fully-qualified public.* references
END;
$$;
```

### `set_config` / `current_setting` GUC pair
**Source:** RESEARCH.md (verified against Postgres built-in API)
**Apply to:** `update_profile_after_auth` (writer) + `profile_self_update_allowed` (reader)
```sql
-- Writer (update_profile_after_auth): MUST use is_local=true (third arg)
PERFORM set_config('app.trusted_profile_update', 'on', true);

-- Reader (profile_self_update_allowed): MUST use missing_ok=true (second arg)
IF current_setting('app.trusted_profile_update', true) != 'on' THEN
  -- protected-column checks
END IF;
```

### `Slot.Root` asChild primitive
**Source:** `src/components/ui/button.tsx` lines 3, 45, 51 and `src/components/ui/badge.tsx` lines 3, 32, 36
**Apply to:** `CardTitle` in `src/components/ui/card.tsx`
```typescript
import { Slot } from "radix-ui"
// Inside function body:
const Comp = asChild ? Slot.Root : "div"
```

### `mintClients` integration test harness
**Source:** `e2e/integration/helpers.ts` (exported function `mintClients`)
**Apply to:** `e2e/integration/profile-trigger-gate.test.ts`
```typescript
import { mintClients, type IntegrationClients } from './helpers'
import { fixtureUsers } from '../fixtures/test-users'
// mintClients({ authAs: 'memberUser' }) returns { anon, authed, serviceRole }
// fixtureUsers.memberUser.id is the UUID for .eq() filters
```

### serviceRole profile restoration in `afterAll`
**Source:** Pattern from `e2e/integration/vote-counts-rls.test.ts` `afterEach` + `helpers.ts` serviceRole usage
**Apply to:** `e2e/integration/profile-trigger-gate.test.ts`
```typescript
afterAll(async () => {
  await clients.serviceRole
    .from('profiles')
    .update({ mfa_verified: true, guild_member: true })
    .eq('id', fixtureUsers.memberUser.id)
})
```

### `getByRole('heading', { level: 2 })` assertion
**Source:** `src/__tests__/admin/admins-tab.test.tsx` line 127, `src/__tests__/admin/categories-tab.test.tsx` line 108
**Apply to:** Both test files (assertion is unchanged — only the stale comment changes)
```typescript
expect(
  await screen.findByRole('heading', { level: 2, name: 'Admins' }),
).toBeInTheDocument()
```

---

## No Analog Found

None — all files have exact or strong role-match analogs in the codebase.

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `e2e/integration/`, `src/components/ui/`, `src/components/admin/`, `src/__tests__/admin/`
**Files read for pattern extraction:** 9
- `supabase/migrations/00000000000014_harden_security_definer_search_path.sql`
- `supabase/migrations/00000000000002_triggers.sql`
- `e2e/integration/vote-counts-rls.test.ts`
- `e2e/integration/helpers.ts`
- `src/components/ui/button.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/card.tsx`
- `src/components/admin/AdminsList.tsx` (lines 85–130)
- `src/components/admin/CategoriesList.tsx` (lines 162–186)
- `src/__tests__/admin/admins-tab.test.tsx` (lines 1–40 and 115–130)
- `src/__tests__/admin/categories-tab.test.tsx` (lines 1–40 and 95–111)
**Pattern extraction date:** 2026-06-02
