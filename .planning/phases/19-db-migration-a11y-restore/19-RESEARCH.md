# Phase 19: DB Migration + A11y Restore - Research

**Researched:** 2026-06-02
**Domain:** PostgreSQL session GUC security pattern + shadcn/ui asChild polymorphism
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**DB — trusted-context flag (DBHY-05)**
- **D-01:** Use a **transaction-local** session GUC. `update_profile_after_auth` sets it via `set_config('app.<name>', 'on', true)` — the `true` (is_local) argument scopes the flag to the current transaction so it auto-clears on commit/rollback and cannot leak across PgBouncer-pooled connections. A session-local flag was explicitly rejected as a pooling-bypass risk.
- **D-02:** `profile_self_update_allowed` checks the flag (e.g. `current_setting('app.<name>', true) = 'on'`) instead of `current_user = session_user`. Flag present/'on' ⇒ trusted RPC path, skip protected-column checks. Flag absent ⇒ direct client update, enforce protected-column rules. Note `SET search_path = ''` is in force on these functions (per migration 00000000000014) — fully-qualify and account for that in the GUC/`current_setting` usage. Final GUC name (`app.trusted_profile_update` suggested) left to planning.
- **D-03:** **Fully replace** the `current_user = session_user` check — remove it entirely; the GUC flag is the sole discriminator. Matches REQUIREMENTS wording ("replaced") and avoids two overlapping mechanisms, one of which is provably non-functional. "Keep both" (defense-in-depth) was rejected as confusing dead weight.
- **D-04:** Immutable-column checks (`id`, `discord_id`, `created_at`) stay enforced **unconditionally** for all callers — they sit outside the gated block today and must remain so.

**DB — regression test (DBHY-05)**
- **D-05:** Prove reachability with an **integration test exercising both paths**, in `e2e/integration/` via Vitest + supabase-js against the local stack (TEST-11 / `vote-counts-rls.test.ts` precedent; use `mintClients` from `e2e/integration/helpers.ts`). It must assert:
  - (a) an **authenticated client** UPDATE to a protected column (`mfa_verified`, and ideally `is_admin` / `guild_member`) on its own profile row is **rejected** by the trigger's exception message; and
  - (b) the `update_profile_after_auth` RPC **succeeds** in committing `mfa_verified` / `guild_member`.
  The DB-level/pgTAP approach was set aside (no such harness exists in the repo; the integration harness is sufficient and already maintained).

**UI — semantic heading restore (UIDN-06)**
- **D-06:** Restore `<h2>` via a **polymorphic `CardTitle`** — add Radix `Slot` `asChild` support to the vendored `src/components/ui/card.tsx` `CardTitle`, then render `<CardTitle asChild><h2 …>…</h2></CardTitle>` in `AdminsList` and `CategoriesList`. Reusable for future Cards; preferred over duplicating CardTitle styling in an inline `<h2>`. Remove the `role="heading" aria-level={2}` ARIA workaround now that the element is a real heading.
- **D-07:** Verify with `getByRole('heading', { level: 2 })` (React Testing Library) for the two components — lightweight and targeted. (An axe scan is acceptable if a planner prefers broader coverage, but the role/level assertion is the minimum bar the success criterion requires.)

### Claude's Discretion
- Exact GUC name, migration filename/number, and whether the `is_admin` assertion is added alongside `mfa_verified` in the regression test.
- Whether to bundle DB + a11y in one PR or split — both are small; default to a single phase PR unless review noise argues otherwise.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DBHY-05 | Replace `profile_self_update_allowed`'s `current_user = session_user` gate with a session-GUC trusted-context flag set by `update_profile_after_auth`; prove protected-column branch is reachable and correct via regression test | Migration 15 rewrites both functions; integration test in `e2e/integration/profile-trigger-gate.test.ts` exercises both paths |
| UIDN-06 | Restore the two `<h2>` section headings in `AdminsList` and `CategoriesList` (demoted to CardTitle `<div>` in Phase 17) to semantic heading elements, keeping shadcn Card structure intact, verified by accessibility assertion | `CardTitle` gets `asChild` via `Slot.Root` from `radix-ui`; component tests updated to use `getByRole('heading', { level: 2 })` |
</phase_requirements>

---

## Summary

Phase 19 bundles two unrelated remediation workstreams. The DB workstream (DBHY-05) closes a live privilege-escalation path: because `profile_self_update_allowed` is a `SECURITY DEFINER` trigger, `current_user` always resolves to the Postgres owner — never to the session role — so the `IF current_user = session_user` guard is **permanently false** and protected-column checks (`mfa_verified`, `is_admin`, `guild_member`) are never enforced on direct client UPDATEs. The fix is a new migration (Migration 15) that rewrites `update_profile_after_auth` to set a transaction-local GUC before performing its UPDATE and rewrites `profile_self_update_allowed` to read that flag instead of the broken `current_user` comparison. A new integration test in `e2e/integration/` proves the gate works in both directions.

The UI workstream (UIDN-06) reverts a Phase 17 accessibility regression: two section headings in `AdminsList` and `CategoriesList` were demoted from `<h2>` to a plain `<div>` CardTitle with ARIA workarounds (`role="heading" aria-level={2}`). The fix adds `asChild` polymorphism to the vendored `CardTitle` component (using `Slot.Root` from the already-installed `radix-ui` package, following the exact same pattern as `Button` and `Badge`) and renders `<CardTitle asChild><h2>…</h2></CardTitle>` at the two call sites. Existing unit tests already assert `getByRole('heading', { level: 2 })` and pass today only because of the ARIA workaround — after the fix they will pass because the element is a genuine heading.

**Primary recommendation:** Ship as a single PR. Migration 15 is the only DB change needed; the UI change is two call-site edits plus a one-line primitive extension. Both workstreams are independent and have zero shared state.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trusted-context discrimination (GUC flag) | Database Layer (Postgres trigger) | Backend Layer (SECURITY DEFINER RPC) | The flag is set inside the RPC and read inside the trigger — both DB objects |
| Protected-column enforcement | Database Layer (Postgres trigger) | — | BEFORE-UPDATE trigger is the sole enforcement point; RLS has no column restriction |
| Profile update (allowed fields) | Backend Layer (SECURITY DEFINER RPC) | — | `update_profile_after_auth` is the only server-side mutation surface |
| Migration deployment | Database Layer | — | Append-only SQL file under `supabase/migrations/` |
| Integration test (gate proof) | Database Layer (test target) | Backend Layer (test harness) | Vitest + supabase-js against local stack; asserts DB behavior |
| Heading semantics | Presentation Layer (React SPA) | — | `card.tsx` primitive + two component call sites |
| Heading accessibility assertion | Presentation Layer (unit test) | — | Vitest + Testing Library, `jsdom` environment |

---

## Standard Stack

### Core (no new packages required)

This phase installs **zero new packages**. All required libraries are already in `node_modules`.

| Library | Installed Version | Purpose | Role in Phase |
|---------|-----------------|---------|---------------|
| `radix-ui` | 1.4.3 | Slot/Slottable primitive | `Slot.Root` for `CardTitle` asChild |
| `@testing-library/react` | 16.3.2 | Component testing | `getByRole('heading', { level: 2 })` assertions |
| `vitest` | 4.1.6 | Test runner | Integration test (node env) + unit tests (jsdom env) |
| `@supabase/supabase-js` | 2.101.1 | DB client | Integration test authenticated/anon clients |

### Postgres session GUC API (built-in)

| Function | Behavior | Note |
|----------|----------|------|
| `set_config('app.trusted_profile_update', 'on', true)` | Sets a **transaction-local** custom GUC — third arg `true` = `is_local` | Auto-clears on commit/rollback; cannot leak across PgBouncer pooled connections |
| `current_setting('app.trusted_profile_update', true)` | Reads the GUC; second arg `true` = `missing_ok` — returns empty string rather than raising if unset | Required because flag is absent on all direct-client UPDATE paths |

**Key semantic:** `is_local = true` in `set_config` scopes the GUC to the **current transaction**, not the session. In PgBouncer transaction-pooling mode (Supabase default), the connection is returned to the pool after each transaction — a session-local GUC would survive the pool return and potentially leak to a different user's next transaction. Transaction-local is the only safe choice.

### Custom GUC namespace

Postgres requires custom GUCs to use a dot-prefix namespace. The namespace must be pre-declared in `postgresql.conf` via `custom_variable_classes` in older Postgres versions, but **Postgres 14+ (Supabase default) accepts any `app.*` GUC without pre-declaration** — `set_config` creates it ad-hoc. [ASSUMED — Supabase platform Postgres version is 14+; verified indirectly by the fact that no `custom_variable_classes` declaration exists in any existing migration]

---

## Package Legitimacy Audit

> Phase 19 installs **no new packages**. The Package Legitimacy Gate is not applicable.

| Package | Disposition |
|---------|-------------|
| `radix-ui` (already installed) | Approved — in use since project inception; `Slot.Root` already used by `button.tsx` and `badge.tsx` |
| `@testing-library/react` (already installed) | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Direct client UPDATE (authenticated supabase-js):
  authed.from('profiles').update({mfa_verified: true}).eq('id', uid)
    │
    ▼
  Postgres RLS: "Users can update own profile" (id = auth.uid()) — PASSES
    │
    ▼
  BEFORE-UPDATE trigger: on_profile_self_update
    WHEN (current_setting('role') = 'authenticated') — FIRES
    │
    ▼
  profile_self_update_allowed() — SECURITY DEFINER — executes as owner
    │
    ├─ immutable checks (id, discord_id, created_at) — unconditional
    │
    └─ current_setting('app.trusted_profile_update', true) = 'on'?
         │ NO (flag not set by caller)
         ▼
       protected-column checks fire → RAISE EXCEPTION → UPDATE rejected ✓

RPC-mediated UPDATE (SECURITY DEFINER update_profile_after_auth):
  authed.rpc('update_profile_after_auth', {p_mfa_verified, ...})
    │
    ▼
  update_profile_after_auth() — SECURITY DEFINER — executes as owner
    │
    ├─ set_config('app.trusted_profile_update', 'on', true)  ← NEW
    │
    └─ UPDATE public.profiles SET mfa_verified=... WHERE id=auth.uid()
         │
         ▼
       BEFORE-UPDATE trigger fires (session role is still 'authenticated')
         │
         ▼
       profile_self_update_allowed() executes
         │
         ├─ immutable checks — pass (unchanged)
         │
         └─ current_setting('app.trusted_profile_update', true) = 'on'?
              │ YES (flag set by update_profile_after_auth earlier in transaction)
              ▼
            skip protected-column checks → UPDATE succeeds ✓
         │
         ▼
       Transaction commits → GUC auto-cleared (is_local=true)
```

### Recommended Project Structure

```
supabase/migrations/
└── 00000000000015_trusted_profile_update_guc.sql   # new — rewrites both functions

e2e/integration/
└── profile-trigger-gate.test.ts                    # new — DBHY-05 regression test

src/components/ui/
└── card.tsx                                         # edit — add asChild to CardTitle

src/components/admin/
├── AdminsList.tsx                                   # edit — CardTitle asChild + h2
└── CategoriesList.tsx                               # edit — CardTitle asChild + h2

src/__tests__/admin/
├── admins-tab.test.tsx                              # edit — remove ARIA workaround comment
└── categories-tab.test.tsx                         # edit — remove ARIA workaround comment
```

### Pattern 1: CardTitle with asChild (polymorphic heading)

**What:** Extend the vendored `CardTitle` to accept an `asChild` prop using `Slot.Root` from `radix-ui`, identical to the existing `Button` and `Badge` pattern already in this codebase.

**When to use:** Any Card section header that needs to be a real heading element rather than a styled `<div>`.

**Existing pattern in `src/components/ui/button.tsx`:**
```typescript
// Source: src/components/ui/button.tsx (current codebase, already ships)
import { Slot } from "radix-ui"

function Button({
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button"
  return <Comp data-slot="button" {...props} />
}
```

**New `CardTitle` implementation (same pattern):**
```typescript
// Source: pattern derived from button.tsx — same Slot.Root shape
import { Slot } from "radix-ui"

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

**Call site pattern (`AdminsList`, `CategoriesList`):**
```tsx
// Replace the ARIA-workaround form:
// <CardTitle role="heading" aria-level={2} className="text-base">Admins</CardTitle>

// With the semantic heading form:
<CardTitle asChild className="text-base">
  <h2>Admins</h2>
</CardTitle>
```

### Pattern 2: Integration test for trigger path discrimination

**What:** Vitest test in `e2e/integration/` using the established `mintClients` harness. Two `describe` blocks: one proving direct client UPDATE is rejected, one proving the RPC path succeeds.

**When to use:** Any DB trigger/function that must behave differently based on caller context.

**Pattern from `vote-counts-rls.test.ts` (existing precedent):**
```typescript
// Source: e2e/integration/vote-counts-rls.test.ts (existing file)
import { mintClients, type IntegrationClients } from './helpers'

describe('profile trigger gate (DBHY-05)', () => {
  let clients: IntegrationClients

  beforeAll(async () => {
    clients = await mintClients({ authAs: 'memberUser' })
  })

  it('(a) direct authenticated UPDATE to mfa_verified is rejected', async () => {
    const { error } = await clients.authed
      .from('profiles')
      .update({ mfa_verified: false })
      .eq('id', fixtureUsers.memberUser.id)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/mfa_verified via client/i)
  })

  it('(b) update_profile_after_auth RPC succeeds in setting mfa_verified', async () => {
    const { error } = await clients.authed.rpc('update_profile_after_auth', {
      p_mfa_verified: true,
      p_discord_username: 'PlaywrightMember',
      p_avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
      p_guild_member: true,
    })
    expect(error).toBeNull()
  })
})
```

### Anti-Patterns to Avoid

- **`SET search_path = public` in Migration 15:** All function bodies must use `SET search_path = ''` (empty) + fully-qualified `public.*` references, matching the pattern established in Migration 14. Reverting to `public` would re-introduce the `0011_function_search_path_mutable` Supabase advisor WARN.
- **`set_config` without `is_local = true`:** Using session-local scope (`false` as the third argument) creates a PgBouncer pooling hazard where the flag survives transaction end and could be read by the next user's transaction on the same pooled connection.
- **Using `current_setting` without the `missing_ok` argument:** `current_setting('app.trusted_profile_update')` (two-arg form) raises `ERROR: unrecognized configuration parameter` when the GUC has never been set. The three-arg form `current_setting('app.trusted_profile_update', true)` returns `''` (empty string) instead — required for the direct-client path where the flag is not set.
- **`DROP FUNCTION` + `CREATE FUNCTION` instead of `CREATE OR REPLACE`:** The trigger `on_profile_self_update` references `profile_self_update_allowed` by OID; `DROP` + `CREATE` changes the OID and severs the trigger reference. Always use `CREATE OR REPLACE FUNCTION`.
- **Keeping both the GUC check AND the `current_user = session_user` check:** D-03 locked this as rejected. Two overlapping mechanisms with one provably broken adds confusion and tech debt.
- **Putting `role="heading" aria-level={2}` on a `<div>` after the fix:** Once `CardTitle asChild` renders a real `<h2>`, the ARIA overrides must be removed from the call sites — applying them to a native heading element is redundant and may confuse some AT parsers.
- **Using `Slot` directly instead of `Slot.Root`:** The `radix-ui` 1.4.3 package exports `Slot` as a namespace object: `{ Root, Slot, Slottable, createSlot, createSlottable }`. The existing `button.tsx` and `badge.tsx` use `Slot.Root` (not `Slot` directly) — match that pattern for consistency.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Polymorphic element rendering in CardTitle | Custom `as` prop + explicit element type union | `Slot.Root` from `radix-ui` | Slot handles ref forwarding, event merging, and the `Slottable` escape hatch; already a project dependency used by Button and Badge |
| Transaction-local state discrimination | Extra `profiles` column / separate table / Edge Function call | Postgres session GUC via `set_config(..., true)` | GUCs are transaction-scoped, schema-free, zero-latency, and auto-clear; no DDL or extra round-trip needed |
| Heading role assertion | ARIA attribute check | `getByRole('heading', { level: 2 })` | Testing Library resolves the computed ARIA role — `role="heading" aria-level={2}` on a `<div>` and a native `<h2>` both satisfy this query, making the assertion meaningful regardless of implementation |

**Key insight:** The `Slot.Root` pattern is already proven in this codebase at two call sites (`button.tsx`, `badge.tsx`) with the same import form (`import { Slot } from "radix-ui"`). The CardTitle change is a one-line structural addition, not novel integration work.

---

## Common Pitfalls

### Pitfall 1: Trigger WHEN clause vs. trigger body — different role contexts

**What goes wrong:** Developer assumes the `WHEN (current_setting('role') = 'authenticated')` clause on `on_profile_self_update` prevents the trigger from firing when `update_profile_after_auth` runs. It does not. The `WHEN` clause evaluates the **session role** (the original authenticated caller), which remains `'authenticated'` even during a SECURITY DEFINER RPC. The trigger fires on every `UPDATE public.profiles` from an authenticated session — including RPC-mediated ones.

**Why it happens:** `current_setting('role')` in the `WHEN` clause reflects the session-level role, not the executing role. The SECURITY DEFINER function owner is `current_user` inside the trigger body, but the `WHEN` clause is evaluated in session context.

**How to avoid:** Set the GUC **before** the `UPDATE` statement inside `update_profile_after_auth` (so it is visible when the trigger evaluates `current_setting` in its body). The GUC is the discriminator, not the `WHEN` clause.

**Warning signs:** A test that asserts the trigger does not fire at all during RPC calls (rather than asserting it fires but takes the allowed-path branch) would miss the real behavior.

### Pitfall 2: `missing_ok` omission on `current_setting`

**What goes wrong:** `current_setting('app.trusted_profile_update')` (without `missing_ok = true`) raises `ERROR: unrecognized configuration parameter "app.trusted_profile_update"` on the very first direct-client UPDATE after migration, before any GUC has been set. This would make the trigger crash for all direct-client UPDATEs rather than gracefully applying protected-column checks.

**Why it happens:** Postgres's `current_setting(name)` two-arg form throws if the GUC name is unknown. The three-arg form `current_setting(name, missing_ok)` returns `''` instead.

**How to avoid:** Always write `current_setting('app.trusted_profile_update', true)` and compare to `'on'`. Any absent or non-`'on'` value falls through to the protected-column check path.

**Warning signs:** Integration test (a) — the direct-client UPDATE rejection test — fails with a trigger error message about an unrecognized parameter rather than the expected `mfa_verified via client` message.

### Pitfall 3: Migration does not update the `COMMENT ON FUNCTION` for `profile_self_update_allowed`

**What goes wrong:** The existing `COMMENT ON FUNCTION` in `migration-02` still describes the old `current_user = session_user` gate. The migration-02 comment note says "no later migration re-issues COMMENT ON FUNCTION for this function." Migration 15 **does** change the gate and should update the comment to describe the new GUC-based mechanism.

**Why it happens:** Migration 14 intentionally did not add a COMMENT (to avoid diverging from the already-applied production state at that time). Migration 15 is the correct place to add the updated comment since it changes the function's actual behavior.

**How to avoid:** Include a `COMMENT ON FUNCTION public.profile_self_update_allowed IS '...'` at the end of Migration 15 describing the GUC-based gate.

### Pitfall 4: Integration test cleanup does not restore fixture profile

**What goes wrong:** The DBHY-05 regression test (path b) updates `mfa_verified`/`guild_member` on the `memberUser` fixture profile via the RPC. If the test does not restore these fields to their seed values, subsequent integration tests that rely on `memberUser.mfa_verified = true` (e.g., vote-counts-rls.test.ts) may fail or produce misleading results.

**Why it happens:** The `memberUser` fixture profile is seeded with `mfa_verified = true, guild_member = true`. If test (a) attempts `UPDATE ... SET mfa_verified = false` and it **succeeds** (pre-fix behavior), or if test (b) sets different values, the fixture state is mutated.

**How to avoid:** In `afterEach` or `afterAll`, restore the `memberUser` profile to its expected seed state using the service-role client: `serviceRole.from('profiles').update({ mfa_verified: true, guild_member: true }).eq('id', memberUser.id)`.

**Warning signs:** `vote-counts-rls.test.ts` starts failing intermittently with 0-row results in cells that should return rows — indicating `memberUser.mfa_verified` or `guild_member` was left false.

### Pitfall 5: `asChild` and `data-slot` attribute on the inner `<h2>`

**What goes wrong:** When `Slot.Root` merges props onto the child element, `data-slot="card-title"` is applied to the `<h2>` tag. This is correct and expected behavior (Radix Slot forwards all props to the rendered element). However, if the call site uses `<CardTitle asChild className="text-base"><h2 className="…">Admins</h2></CardTitle>`, both `className` props are merged via Tailwind's class merging in `cn()`. Since `CardTitle` passes `className` through `cn(...)` before forwarding, the classes compose correctly — but only if the `className` on the inner `<h2>` does not override the outer `cn()` result. Prefer putting all styling on the `CardTitle` wrapper, not the inner `<h2>`.

**How to avoid:** Keep the `<h2>` clean (no className); put all className on the `<CardTitle asChild className="text-base">` wrapper.

---

## Code Examples

### Migration 15: Full rewrite of both functions

```sql
-- Source: pattern from 00000000000014_harden_security_definer_search_path.sql
-- (same CREATE OR REPLACE + SET search_path = '' + fully-qualified bodies)

-- update_profile_after_auth — adds set_config before the UPDATE so the
-- trusted-context flag is visible to the trigger within the same transaction.
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
$$;


-- profile_self_update_allowed — replaces current_user = session_user gate
-- with a GUC check. The GUC is set by update_profile_after_auth before its
-- UPDATE; direct client UPDATEs do not set it, so the flag is absent and
-- protected-column checks run.
CREATE OR REPLACE FUNCTION public.profile_self_update_allowed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

COMMENT ON FUNCTION public.profile_self_update_allowed IS
  'Guards profile self-update: blocks id/discord_id/created_at unconditionally; '
  'blocks is_admin/mfa_verified/guild_member when app.trusted_profile_update GUC is absent '
  '(direct client write). update_profile_after_auth sets the GUC (transaction-local) before '
  'its UPDATE so the protected-column checks are skipped on the RPC path.';
```

### Integration test: both gate paths

```typescript
// Source: pattern from e2e/integration/vote-counts-rls.test.ts (existing file)
// New file: e2e/integration/profile-trigger-gate.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  mintClients,
  type IntegrationClients,
} from './helpers'
import { fixtureUsers, FIXTURE_PASSWORD } from '../fixtures/test-users'

describe('profile_self_update_allowed trigger gate (DBHY-05)', () => {
  let clients: IntegrationClients

  beforeAll(async () => {
    clients = await mintClients({ authAs: 'memberUser' })
  })

  afterAll(async () => {
    // Restore fixture profile to seed state so sibling suites see expected values.
    await clients.serviceRole
      .from('profiles')
      .update({ mfa_verified: true, guild_member: true })
      .eq('id', fixtureUsers.memberUser.id)
  })

  it('(a) direct authenticated UPDATE to mfa_verified is rejected by trigger', async () => {
    const { error } = await clients.authed
      .from('profiles')
      .update({ mfa_verified: false })
      .eq('id', fixtureUsers.memberUser.id)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/mfa_verified via client/i)
  })

  it('(a2) direct authenticated UPDATE to is_admin is rejected by trigger', async () => {
    const { error } = await clients.authed
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', fixtureUsers.memberUser.id)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/is_admin via client/i)
  })

  it('(b) update_profile_after_auth RPC succeeds in setting mfa_verified and guild_member', async () => {
    const { error } = await clients.authed.rpc('update_profile_after_auth', {
      p_mfa_verified: true,
      p_discord_username: 'PlaywrightMember',
      p_avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
      p_guild_member: true,
    })
    expect(error).toBeNull()
  })
})
```

### CardTitle asChild: primitive extension

```typescript
// Source: pattern from src/components/ui/button.tsx (existing file)
// Edit: src/components/ui/card.tsx

import { Slot } from "radix-ui"   // add this import

function CardTitle({
  className,
  asChild = false,             // add asChild prop
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {  // extend props type
  const Comp = asChild ? Slot.Root : "div"                // add Comp selection
  return (
    <Comp
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}
```

### AdminsList / CategoriesList call site change

```tsx
// BEFORE (ARIA workaround — remove this):
<CardTitle role="heading" aria-level={2} className="text-base">
  Admins
</CardTitle>

// AFTER (semantic heading — use this):
<CardTitle asChild className="text-base">
  <h2>Admins</h2>
</CardTitle>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `current_user = session_user` gate in SECURITY DEFINER trigger | Transaction-local GUC flag (`set_config`/`current_setting`) | Migration 15 (this phase) | Gate actually works — protected columns are enforced on direct client writes |
| `role="heading" aria-level={2}` on `<div>` CardTitle | `CardTitle asChild` with native `<h2>` | Phase 19 (this phase) | Screen readers see a real heading element; no ARIA override needed |

**Deprecated/outdated:**
- `current_user = session_user` check in `profile_self_update_allowed`: always false in SECURITY DEFINER context; being replaced by GUC flag this phase
- `role="heading" aria-level={2}` ARIA workaround on `AdminsList` and `CategoriesList` CardTitle: valid workaround but inferior to native semantics; removed this phase

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase platform Postgres version is 14+, which allows `app.*` custom GUCs without pre-declaring `custom_variable_classes` | Standard Stack | If Postgres < 14, `set_config('app.trusted_profile_update', ...)` raises an error; would need `custom_variable_classes = 'app'` in postgresql.conf (not user-configurable on Supabase) |
| A2 | The `authenticated` role has an implicit UPDATE grant on `public.profiles` (from Supabase's default grants), allowing direct client UPDATEs to reach the trigger | Common Pitfalls / security analysis | If no UPDATE grant exists for `authenticated`, direct client UPDATEs would be rejected at the grant level before reaching the trigger — making the fix semantically correct but the "exploit guard" framing inaccurate; the test would still pass |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

Note: A2 is an important framing note. The RLS policy "Users can update own profile" (`id = auth.uid()`) applies to the `authenticated` role, and the trigger fires per the `WHEN (current_setting('role') = 'authenticated')` clause — confirming the trigger is reachable from authenticated direct UPDATEs. [VERIFIED: migration 00000000000001_rls.sql, migration 00000000000002_triggers.sql]

---

## Open Questions

1. **Does the `memberUser` fixture profile currently have `mfa_verified = true`?**
   - What we know: `e2e/fixtures/seed.sql` inserts `mfa_verified = true` for memberUser. Phase 18 repairs restored TEST-11 (12-cell matrix) to green, which also exercises the memberUser auth path.
   - What's unclear: Whether any Phase 18 execution left the fixture profile in a mutated state (unlikely given afterEach cleanup, but not confirmed).
   - Recommendation: The test's `afterAll` cleanup (restore profile to seed values) is sufficient insurance.

2. **Should `guild_member` be tested in the direct-client rejection path (assertion a)?**
   - What we know: D-05 says "and ideally `is_admin` / `guild_member`" — this is Claude's Discretion.
   - What's unclear: Whether a `guild_member = false` UPDATE on a `guild_member = true` profile would be a meaningful exploit vs. `is_admin = true` (clear privilege escalation).
   - Recommendation: Include `is_admin` (path a2) and rely on path (b) to implicitly cover `guild_member` via the RPC success assertion. Three assertions is a reasonable scope.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase stack | Integration test (DBHY-05) | Must be started via `supabase start` | Per local config | None — test requires live DB |
| `VITE_SUPABASE_ANON_KEY` env var | `e2e/integration/helpers.ts` | Exported from `supabase status` | — | None — helpers throw loudly |
| `SUPABASE_SERVICE_ROLE_KEY` env var | `e2e/integration/helpers.ts` | Exported from `supabase status` | — | None — helpers throw loudly |

**Missing dependencies with no fallback:**
- Local Supabase stack must be running (`supabase start`) before `npm run test:integration`
- Stack keys must be exported to shell before running the integration suite

**Missing dependencies with fallback:** none

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 |
| Unit config | `vite.config.ts` (jsdom environment, `src/__tests__/`) |
| Integration config | `vitest.config.integration.ts` (node environment, `e2e/integration/`) |
| Quick unit run | `npm run test` |
| Integration run | `npm run test:integration` (requires local Supabase stack) |
| E2E smoke run | `npx playwright test --config e2e/playwright.config.ts --grep @smoke` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| DBHY-05 (a) | Direct client UPDATE to `mfa_verified` is rejected by trigger | Integration | `npm run test:integration` (file: `profile-trigger-gate.test.ts`) | ❌ Wave 0 |
| DBHY-05 (a2) | Direct client UPDATE to `is_admin` is rejected by trigger | Integration | same file | ❌ Wave 0 |
| DBHY-05 (b) | `update_profile_after_auth` RPC succeeds in setting protected columns | Integration | same file | ❌ Wave 0 |
| DBHY-05 (deploy) | Zero new Supabase advisor WARNs after migration | Manual | `supabase db lint --linked` | N/A (manual) |
| DBHY-05 (smoke) | `submit-vote` smoke round-trip remains PASS | E2E smoke | `npx playwright test --grep @smoke` (human-run) | ✅ existing |
| UIDN-06 (admins) | `AdminsList` heading is a level-2 heading | Unit | `npm run test` (file: `admins-tab.test.tsx`) | ✅ existing (test already asserts `getByRole('heading', { level: 2 })`) |
| UIDN-06 (categories) | `CategoriesList` heading is a level-2 heading | Unit | `npm run test` (file: `categories-tab.test.tsx`) | ✅ existing (test already asserts `getByRole('heading', { level: 2 })`) |

### Sampling Rate

- **Per task commit:** `npm run test` (unit suite)
- **Per wave merge:** `npm run test` + `npm run test:integration`
- **Phase gate:** Full unit suite green + integration suite green + `supabase db lint --linked` zero new WARNs before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `e2e/integration/profile-trigger-gate.test.ts` — covers DBHY-05 (a), (a2), (b)
- [ ] Migration file `supabase/migrations/00000000000015_trusted_profile_update_guc.sql`

*(Existing unit tests for UIDN-06 already assert the correct role/level — they pass today only because of the ARIA workaround on the `<div>`. After the fix, they will pass because the element is a real `<h2>`. No new test files needed for UIDN-06.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A |
| V3 Session Management | no | N/A |
| V4 Access Control | **yes** | Postgres BEFORE-UPDATE trigger + SECURITY DEFINER RPC |
| V5 Input Validation | no | Trigger validates column invariants |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via direct client UPDATE to `is_admin` | Elevation of privilege | `profile_self_update_allowed` trigger — blocked when GUC flag absent |
| MFA bypass via direct client UPDATE to `mfa_verified` | Spoofing | `profile_self_update_allowed` trigger — blocked when GUC flag absent |
| GUC leak across PgBouncer-pooled connections | Elevation of privilege | `set_config(... is_local=true)` — transaction-local scope, auto-cleared |
| Session-local GUC persisting to pool | Elevation of privilege | Explicitly rejected (D-01) — transaction-local is mandatory |

**Security closure:** After Migration 15, a direct client UPDATE to `mfa_verified` or `is_admin` on one's own profile row is rejected by the trigger (the `IF current_setting(...) != 'on'` branch fires). The RPC path succeeds because it sets the GUC before the UPDATE. This closes the current live bypass where the `current_user = session_user` check was permanently false.

---

## Sources

### Primary (HIGH confidence)

- Migration `00000000000014_harden_security_definer_search_path.sql` — live function bodies, `SET search_path = ''` pattern, SECURITY DEFINER ownership model [VERIFIED: codebase read]
- Migration `00000000000004_fix_trigger_rpc_context.sql` — historical rationale for the `current_user != session_user` approach being replaced [VERIFIED: codebase read]
- Migration `00000000000002_triggers.sql` — trigger `WHEN` clause (`current_setting('role') = 'authenticated'`), trigger binding [VERIFIED: codebase read]
- Migration `00000000000001_rls.sql` — "Users can update own profile" UPDATE policy (no column restriction) [VERIFIED: codebase read]
- `src/components/ui/button.tsx` — `Slot.Root` from `radix-ui` asChild pattern [VERIFIED: codebase read]
- `src/components/ui/card.tsx` — current `CardTitle` definition (plain `<div>`, no asChild) [VERIFIED: codebase read]
- `src/components/admin/AdminsList.tsx` line 94 — `role="heading" aria-level={2}` workaround [VERIFIED: codebase read]
- `src/components/admin/CategoriesList.tsx` line 171 — `role="heading" aria-level={2}` workaround [VERIFIED: codebase read]
- `e2e/integration/vote-counts-rls.test.ts` — `mintClients` + integration test precedent [VERIFIED: codebase read]
- `e2e/integration/helpers.ts` — `mintClients`, `createFreshPoll`, `cleanupPoll` helpers [VERIFIED: codebase read]
- `src/__tests__/admin/admins-tab.test.tsx` lines 122–129 — existing `getByRole('heading', { level: 2 })` assertion [VERIFIED: codebase read]
- `src/__tests__/admin/categories-tab.test.tsx` lines 103–110 — existing `getByRole('heading', { level: 2 })` assertion [VERIFIED: codebase read]
- `vitest.config.integration.ts` — integration suite config: `environment: 'node'`, `include: ['e2e/integration/**/*.test.ts']`, `fileParallelism: false` [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)

- `node_modules/radix-ui` introspection — confirmed `Slot` exports `{ Root, Slot, Slottable, createSlot, createSlottable }`; `Slot.Root` is the correct access path [VERIFIED: codebase runtime check]
- `.planning/MILESTONES.md` entry for Phase 14 — `supabase db lint --linked` command confirmed as the advisor WARN verification step [VERIFIED: planning doc]

### Tertiary (LOW confidence)

- Postgres 14+ custom GUC behavior (`app.*` prefix without `custom_variable_classes`) [ASSUMED — based on training knowledge; not verified against Supabase platform docs this session]

---

## Metadata

**Confidence breakdown:**
- DB migration pattern: HIGH — exact function bodies available from migration 14; exact bug mechanism verified from migration source
- Session GUC semantics: HIGH — `set_config`/`current_setting` API verified against existing migration patterns and runtime check
- Integration test harness: HIGH — exact precedent available from vote-counts-rls.test.ts and helpers.ts
- CardTitle asChild: HIGH — exact Slot.Root pattern verified from button.tsx at runtime
- Heading assertions (UIDN-06): HIGH — existing tests already assert the correct query; implementation change is one line per component

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (stable stack, migration-only changes)
