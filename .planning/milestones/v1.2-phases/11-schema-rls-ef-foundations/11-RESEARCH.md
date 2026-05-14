# Phase 11: Schema + RLS + EF Foundations — Research

**Researched:** 2026-05-11
**Domain:** Postgres RLS retrofit on a live voting platform; admin-gated Edge Function + audit log retrofit on 13 EFs
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### audit_log table (new — created in migration 10)
- **D-01:** `audit_log` table is created in migration 10 alongside the `results_hidden` column + view + policy work. Single atomic migration file. The research doc (`v1.2-PITFALLS.md` line 191) incorrectly claimed `audit_log` "already exists from v1.0" — it does not; the 7 v1.0 tables are `admin_discord_ids`, `profiles`, `categories`, `polls`, `choices`, `votes`, `vote_counts`. Phase 11 creates the table and immediately retrofits it across the admin EF surface.
- **D-02:** Schema baseline (planner refines column types/indexes if needed):
  ```sql
  CREATE TABLE public.audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES public.profiles(id),  -- NULLABLE: cron writes with NULL
    action text NOT NULL,
    target_type text NOT NULL,
    target_id uuid,
    before jsonb,
    after jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  ```
- **D-03:** `actor_id` is NULLABLE. Cron-triggered writes (`close-expired-polls`) write rows with `actor_id = NULL`. Admin-initiated writes always supply a real `profiles.id`.
- **D-04:** RLS on `audit_log`: admins-only SELECT (planner picks exact policy expression — likely `is_current_user_admin()` from migration 9). No public reads; no INSERT policy (writes service-role only via the EFs).
- **D-05:** Audit retrofit covers **all 12 mutation admin EFs + the new toggle EF (13 total emitters)**: `close-expired-polls` (cron, `actor_id=NULL`, `action='poll_auto_closed'`), `close-poll`, `create-category`, `create-poll`, `delete-category`, `delete-poll`, `demote-admin`, `pin-poll`, `promote-admin`, `rename-category`, `set-resolution`, `update-poll`, `toggle-results-visibility` (new).
- **D-06:** Audit retrofit **excludes** the two read-only admin EFs: `search-admin-targets` and `get-upload-url`.
- **D-07:** `before`/`after` JSONB shape left to planner per-EF. Convention: include only mutated columns, not the full row.

#### `create-poll` extended to accept `results_hidden` at creation
- **D-08:** `create-poll` EF body extended to accept optional `results_hidden?: boolean` (default `false`). Atomic creation — admin can ship a hidden poll in one EF call.
- **D-09:** When `results_hidden = true` is supplied at creation, `create-poll` writes an audit row with `action='results_hidden_set_at_creation'`, `before=null`, `after={results_hidden: true}`. Omitted/false → no extra audit row beyond the standard `create-poll` audit row (D-05).
- **D-10:** Validation: EF rejects 400 if `results_hidden` is present but not a boolean. Default `false` if absent.

#### `toggle-results-visibility` EF idempotency
- **D-11:** EF is **idempotent and quiet on no-ops**. Sequence: read current `results_hidden`, compare to requested. UPDATE the row (cheap under MVCC) and set `results_hidden_changed_at = now()` always. Write the audit row **only when before ≠ after**. Return 200 with the updated poll row in all cases.
- **D-12:** No 409 Conflict path on no-op — UI carries burden of representing current state; EF tolerates duplicate calls without complaint.
- **D-13:** `results_hidden_changed_at` is written by the EF directly (matches the `closed_at` precedent in `close-poll/index.ts`), not via a DB trigger.

#### `vote_counts` RLS policy (locked by VIS-04)
- **D-14:** New policy DROPs the existing `"Vote counts visible to voters or admin"` policy first, then CREATEs the rewritten policy. No OR-permissive combination.
- **D-15:** Policy expression checks: caller has cast a vote (existing `EXISTS` clause stays in shape) AND `polls.results_hidden = false` (new clause). Service-role bypass remains automatic.
- **D-16:** Planner picks subquery vs JOIN form for the `polls.results_hidden = false` check. Performance is acceptable at the project's 20–30 concurrent user scale.

#### `polls_effective` view rewrite (locked by VIS-09)
- **D-17:** `CREATE OR REPLACE VIEW polls_effective AS ...` re-projects every existing column, **plus** `results_hidden` and `results_hidden_changed_at` from `polls`. `ALTER VIEW polls_effective SET (security_invoker = on)` re-applied immediately.
- **D-18:** Planner reads current view DDL at `supabase/migrations/00000000000005_admin_phase4.sql:12-31` to confirm form (currently explicit columns — confirmed via codebase scout).
- **D-19:** `polls-effective-invariant.test.ts` at `src/__tests__/admin/` continues to pass. No new direct `from('polls')` reads introduced anywhere in `src/`.

#### TEST-11 RLS invariant test runner
- **D-20:** **Vitest** at `e2e/integration/vote-counts-rls.test.ts` using `describe.each` over 12 cells. Matches `polls-effective-invariant.test.ts` precedent.
- **D-21:** New `e2e/integration/helpers.ts` mints three pre-scoped clients (anon / authenticated test user / service-role) and provides freshPoll-equivalent setup/teardown without Playwright's `test.extend` lifecycle.
- **D-22:** New `npm run test:integration` script + new `vitest.config.integration.ts` scoped to `e2e/integration/`. CI job structure is planner decision.
- **D-23:** Test asserts row count from `SELECT * FROM vote_counts WHERE poll_id = $1` for each of 12 cells: 3 roles × 2 hidden states × 2 voter states. **Expected matrix: only `(authenticated, hidden=false, voted)` returns rows; service-role returns rows in all 4 of its cells (bypass); all other cells return 0 rows. Blocks merge if any cell fails.**

#### TEST-12 admin EF authorization test
- **D-24:** Lives alongside TEST-11 under `e2e/integration/` (Vitest, same helpers). Asserts: non-admin → 403; admin → 200 with updated poll row + non-null `results_hidden_changed_at`; `audit_log` row written for every state-changing toggle (not written on no-op per D-11).

### Claude's Discretion
- Migration file packaging within migration 10 (statement order: column ADD → audit_log CREATE TABLE+RLS → polls_effective rewrite → vote_counts policy DROP+CREATE — planner verifies dependency order).
- `audit_log` indexes (likely `(target_type, target_id)` and `(actor_id, created_at)` — planner picks based on expected query shapes).
- `before`/`after` JSONB shape per EF — keep compact (mutated fields only).
- Audit `action` string convention: snake_case verb_phrase (e.g., `results_hidden_toggled`, `poll_pinned`, `category_renamed`) — planner picks exact strings; consistency across EFs matters more than the specific words.
- Whether `close-expired-polls` writes one batch audit row per cron run or one per closed poll — planner picks based on existing batch-close shape.
- Vitest `describe.each` matrix layout (single 12-row table vs nested describe blocks) — D-23 locks the assertions, the test structure is open.

### Deferred Ideas (OUT OF SCOPE)
- Admin audit-log UI — surface `audit_log` rows in the admin dashboard. Deferred to v1.3+.
- `audit_log` retention policy — automatic pruning. Revisit when free-tier 500 MB ceiling is in sight.
- `search-admin-targets` / `get-upload-url` audit — explicitly excluded (read-only).
- Audit on auth events (login / 2FA / signOut) — out of scope; Supabase Auth has its own log surface.
- VIS-WINDOW window-of-control enum and VIS-PUBLIC-MODE pre-vote public visibility — deferred to v1.3+.
- DB trigger for `results_hidden_changed_at` — rejected per D-13 in favor of EF-direct write.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIS-01 | `polls.results_hidden boolean NOT NULL DEFAULT false` column; default for new and existing rows preserves v1.0/v1.1 behavior. | Migration 10 `ALTER TABLE` (see § Migration 10 SQL Skeleton). DEFAULT false matches v1.0 RSLT-05 default behavior. [VERIFIED: codebase] |
| VIS-02 | Admins can flip `results_hidden` true↔false at any lifecycle point; flip is audited (audit_log row + `results_hidden_changed_at` update). | `toggle-results-visibility` EF body + audit retrofit pattern (see § Edge Function Skeletons, § Audit Retrofit Pattern). |
| VIS-03 | New admin-gated EF `toggle-results-visibility`; takes `{ poll_id, hidden: boolean }`; returns updated poll row. | `pin-poll` skeleton + extended response shape (see § toggle-results-visibility skeleton). Reuses `requireAdmin` from `_shared/admin-auth.ts` (verified current). |
| VIS-04 | `vote_counts` SELECT RLS rewritten: SELECT iff caller voted AND `polls.results_hidden = false`. DROP old policy first; no OR-permissive combination. | § RLS Policy Rewrite. Service-role bypass is automatic and intentional. [CITED: supabase.com/docs/guides/troubleshooting/...rls-errors] |
| VIS-05 | RLS invariant test suite (12 cells): every cell with non-voter OR `hidden=true` returns 0 rows; only `voted + hidden=false + authenticated` returns rows; service-role bypasses. Blocks merge if any cell fails. | § TEST-11 Matrix Specification (12-cell table). Vitest runner under `e2e/integration/`. |
| VIS-09 | `polls_effective` view updated (`CREATE OR REPLACE`) to project `results_hidden` and `results_hidden_changed_at`; `security_invoker = on` re-applied; invariant test continues to pass. | § View Rewrite. Current view at migration 5 uses **explicit columns** (verified). [VERIFIED: codebase] [CITED: supabase.com/docs/guides/auth/row-level-security] |
| TEST-11 | 12-cell matrix test (= VIS-05 implementation). | § TEST-11 Matrix Specification. |
| TEST-12 | Admin EF authorization test for `toggle-results-visibility`: non-admin → 403; admin → 200 + updated row + audit row written. | § TEST-12 Specification. Co-located with TEST-11 under `e2e/integration/`. |

**Audit retrofit (D-05) covers 12 existing EFs + 1 new = 13 audit-emitting EFs.** This is in-scope per CONTEXT.md but is not numbered as a REQ-ID. Treat it as a hard scope item; the planner's verifier may need to add an SC for it (CONTEXT.md NB on ROADMAP SCs).
</phase_requirements>

## Summary

Phase 11 lands the database + server-side foundation for admin-controlled per-poll results visibility. The feature surface is small (one boolean column + one timestamp column + one admin EF), but the scope expansion behind the surface is significant: a new `audit_log` table, RLS rewrite on `vote_counts`, view rewrite on `polls_effective`, audit-row retrofit across 12 existing admin EFs + the new toggle EF, and a 12-cell Vitest-based RLS invariant suite that blocks merge.

The work is grouped into one atomic migration (migration 10) plus a fleet of EF edits. Migration 10 contains the column additions, the `audit_log` table + its RLS, the `polls_effective` view rewrite, and the `vote_counts` policy DROP+CREATE. Splitting across migrations creates windows where RLS references columns that don't yet exist in the view — atomicity is the central correctness lever.

The single non-trivial risk is the 12-cell RLS matrix. The new policy must combine two AND clauses (voter-exists AND hidden=false); a misplaced OR or operator-precedence slip leaks pre-aggregated vote counts to non-voters via the Supabase anon key. The matrix test is non-optional and lives in the same PR as the migration.

**Primary recommendation:** Write migration 10 as a single file with `BEGIN; … COMMIT;` statement order — `audit_log` table + RLS first (so the view rewrite + new EFs can safely reference it), then `polls` column adds, then `polls_effective` `CREATE OR REPLACE VIEW` + `security_invoker = on`, then `vote_counts` DROP POLICY + CREATE POLICY. Land the 12-cell Vitest matrix in the same PR. Audit retrofit can land in the same PR as the EF deploys (one PR per EF is too granular; one PR per task-batch is the right shape).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `results_hidden` boolean storage | Database / Postgres | — | Column lives on `polls` table; DB-enforced default + NOT NULL [VERIFIED: codebase migration shape] |
| `results_hidden` access control (read gate) | Database / RLS | — | RLS on `vote_counts` is the authoritative security boundary; React conditional render is UX-only (Phase 12) [VERIFIED: v1.2-PITFALLS.md Pitfall 1, v1.2-SUMMARY.md security gate framing] |
| `results_hidden` flip (write authority) | API / Edge Function | — | Admin-gated mutation; service-role bypasses RLS; auth check via `requireAdmin` [VERIFIED: existing 16-EF pattern] |
| Audit trail emission | API / Edge Function | Database (storage) | EF writes the audit row inline after the mutation succeeds; DB stores it; no trigger [VERIFIED: D-13, matches `closed_at` precedent in `close-poll/index.ts`] |
| `results_hidden` exposure to read path | Database / View (`polls_effective`) | — | View boundary keeps the `polls.status` lazy-close pattern intact and centralizes column projection [VERIFIED: D-17, v1.0 D-12 lazy-close pattern] |
| `results_hidden_changed_at` timestamp authority | API / Edge Function | — | EF writes timestamp directly on every UPDATE (D-13); no DB trigger; mirrors `closed_at` pattern [VERIFIED: `close-poll/index.ts:73`] |
| Visibility test enforcement (merge blocker) | Test / Integration (Vitest) | — | 12-cell matrix runs via `e2e/integration/` against local Supabase; uses 3 minted clients (anon, authenticated, service-role) [VERIFIED: D-20-D-23, `polls-effective-invariant.test.ts` precedent] |

## Standard Stack

### Core (no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.101.1 | EF service-role client; integration test clients | Already locked across 16 existing EFs and `src/lib/supabase.ts` [VERIFIED: package.json + EF imports] |
| `vitest` | 4.1.2 | TEST-11 + TEST-12 runner | Matches `polls-effective-invariant.test.ts` precedent [VERIFIED: package.json] |
| Supabase Postgres native types | 15.x (free tier) | `boolean`, `timestamptz`, `jsonb`, `uuid` | All used in existing migrations [VERIFIED: existing migrations] |
| `_shared/admin-auth.ts` (`requireAdmin`, `adminCheckResponse`) | — | Admin gate for all admin EFs | Already enforces `is_admin AND mfa_verified AND guild_member`; reusable verbatim [VERIFIED: codebase read 2026-05-11] |
| `_shared/cors.ts` (`getCorsHeaders`) | — | CORS for all EFs | Already locked across all 16 EFs [VERIFIED: codebase read] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pgcrypto` (Postgres extension) | 1.x | `gen_random_uuid()` for `audit_log.id` DEFAULT | Already loaded in `00000000000000_schema.sql:8` [VERIFIED: codebase] — no new extension needed |

**Installation:** No new packages. Zero npm or Deno additions for Phase 11. [VERIFIED: CONTEXT.md "Specific Ideas"]

**Version verification (2026-05-11):**
- `@supabase/supabase-js@2.101.1` is the project's pinned version; not refreshing to a newer minor in Phase 11 (out of scope).
- `vitest@4.1.2` is the project's pinned version; no upgrade required.

## Architecture Patterns

### System Architecture Diagram

```
[Admin Browser]                                    [User Browser]
       |                                                  |
       | (1) click "Hide/Show results"                    | (5) read vote_counts via Supabase JS
       v                                                  v
[useToggleResultsVisibility hook (new, Phase 12)]   [useVoteCounts hook (extended Phase 12)]
       |                                                  |
       | (2) supabase.functions.invoke(                   | (6) supabase.from('vote_counts')
       |       'toggle-results-visibility',               |        .select('count, choice_id')
       |       { poll_id, hidden })                       |        .eq('poll_id', P)
       v                                                  v
[toggle-results-visibility EF (NEW)]            [Postgres RLS on vote_counts (REWRITTEN)]
       |                                                  |
       | (3a) requireAdmin(supabaseAdmin, userId)         | (7) USING clause evaluates per-row:
       |        => 403 if not admin                       |     EXISTS(voter row) AND polls.results_hidden = false
       |                                                  |     => 0 rows if either clause false
       | (3b) read current results_hidden                 |     => admin/service-role bypass (automatic)
       | (3c) UPDATE polls SET results_hidden=$1,         |
       |       results_hidden_changed_at = now()          |
       |       WHERE id = $2 RETURNING *                  |
       | (3d) IF (before !== after):                      |
       |        INSERT INTO audit_log (actor_id=userId,   |
       |          action='results_hidden_toggled',        |
       |          target_type='poll', target_id=poll_id,  |
       |          before={results_hidden: before},        |
       |          after={results_hidden: after})          |
       v                                                  |
[polls table]  <--- UPDATE                                |
[audit_log table]  <--- INSERT (only when state changed) |
       |                                                  |
       | (4) return 200 + updated poll row                |
       v                                                  v
[Admin UI re-renders (Phase 12)]                  [Vote counts displayed OR empty array (gated)]
```

For the 12 existing admin EFs in the audit retrofit (D-05), the flow becomes:
```
[Existing admin EF]
       |
       | (a) requireAdmin (unchanged)
       | (b) existing mutation (unchanged)
       | (c) AFTER mutation success, BEFORE response:
       |       INSERT INTO audit_log (actor_id, action='<per-EF string>',
       |         target_type, target_id, before, after)
       | (d) audit INSERT failure → log + continue (do not fail the user-facing response)
       v
[return response — unchanged shape]
```

### Recommended Project Structure

```
supabase/
├── migrations/
│   ├── 00000000000000_schema.sql              # existing
│   ├── ...
│   ├── 00000000000009_admin_integrity_rls.sql # existing
│   └── 00000000000010_results_hidden.sql      # NEW — atomic Phase 11 migration
└── functions/
    ├── _shared/
    │   ├── admin-auth.ts                       # reused verbatim
    │   ├── audit-log.ts                        # NEW — shared audit helper (see Pattern 4)
    │   └── cors.ts                             # reused verbatim
    ├── close-expired-polls/index.ts            # retrofit: audit on each sweep
    ├── close-poll/index.ts                     # retrofit: audit per close
    ├── create-category/index.ts                # retrofit: audit on create
    ├── create-poll/index.ts                    # retrofit: audit on create + optional results_hidden
    ├── delete-category/index.ts                # retrofit: audit on delete
    ├── delete-poll/index.ts                    # retrofit: audit on delete
    ├── demote-admin/index.ts                   # retrofit: audit on demote
    ├── pin-poll/index.ts                       # retrofit: audit on pin/unpin
    ├── promote-admin/index.ts                  # retrofit: audit on promote
    ├── rename-category/index.ts                # retrofit: audit on rename
    ├── set-resolution/index.ts                 # retrofit: audit on set
    ├── toggle-results-visibility/              # NEW — admin-gated boolean flip
    │   └── index.ts
    └── update-poll/index.ts                    # retrofit: audit on update
e2e/
├── integration/                                 # NEW — test:integration root
│   ├── helpers.ts                              # NEW — 3-client minting, freshPoll equivalent
│   ├── vote-counts-rls.test.ts                 # TEST-11 (12-cell matrix)
│   └── toggle-results-visibility.test.ts       # TEST-12 (admin EF authz)
src/
└── __tests__/admin/
    └── polls-effective-invariant.test.ts        # existing; MUST continue to pass after Phase 11
```

**New files:**
- `supabase/migrations/00000000000010_results_hidden.sql`
- `supabase/functions/_shared/audit-log.ts`
- `supabase/functions/toggle-results-visibility/index.ts`
- `e2e/integration/helpers.ts`
- `e2e/integration/vote-counts-rls.test.ts`
- `e2e/integration/toggle-results-visibility.test.ts`
- `vitest.config.integration.ts` (project root)

**Modified files:**
- All 12 admin EFs under `supabase/functions/<name>/index.ts` (audit retrofit)
- `package.json` (`test:integration` script)

### Pattern 1: Atomic Migration 10 (single file, statement-ordered)

**What:** All schema changes for Phase 11 live in one numbered migration file. Statement order matters because the view rewrite references the new columns and the RLS rewrite references the new column.

**When to use:** Always for v1.2 — splitting across migrations creates a window where the policy references a column not yet projected through the view.

**Example (skeleton — planner refines indexes and exact `before`/`after` JSON shape):**

```sql
-- Source: codebase patterns from migrations 00..09 + v1.2-ARCHITECTURE.md atomicity guidance
-- Migration 10: Phase 11 — results visibility + audit log
-- Atomic: column adds → audit_log table+RLS → polls_effective view rewrite → vote_counts policy DROP+CREATE

-- ============================================================
-- SECTION 1 — polls columns
-- ============================================================
ALTER TABLE public.polls
  ADD COLUMN results_hidden BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.polls
  ADD COLUMN results_hidden_changed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.polls.results_hidden IS
  'When true, the vote_counts RLS policy returns 0 rows even for voters. Flipped by the toggle-results-visibility EF; audit row written on every state change.';
COMMENT ON COLUMN public.polls.results_hidden_changed_at IS
  'Set by the EF on every UPDATE (matches closed_at precedent). NULL until first flip.';

-- ============================================================
-- SECTION 2 — audit_log table + RLS (admin-only SELECT)
-- ============================================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id),  -- NULLABLE: cron writes NULL
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_log IS
  'Append-only admin-action audit trail. Written by admin-gated EFs (13 emitters in v1.2). Admins-only SELECT. actor_id NULL on cron-driven writes.';

-- Planner: index choices below — verify against expected query shapes
CREATE INDEX idx_audit_log_target ON public.audit_log(target_type, target_id);
CREATE INDEX idx_audit_log_actor_created ON public.audit_log(actor_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit log visible to admins"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());
-- No INSERT/UPDATE/DELETE policies: writes are service-role only via EFs.

-- ============================================================
-- SECTION 3 — polls_effective view rewrite (preserves explicit-column form)
-- ============================================================
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
  status AS raw_status,
  results_hidden,                  -- NEW
  results_hidden_changed_at        -- NEW
FROM public.polls;

ALTER VIEW public.polls_effective SET (security_invoker = on);

COMMENT ON VIEW public.polls_effective IS
  'Lazy-close read view. v1.2: projects results_hidden + results_hidden_changed_at so the React read path branches on visibility without bypassing the view boundary. INVARIANT: all non-admin code paths MUST read this view, never polls directly.';

-- ============================================================
-- SECTION 4 — vote_counts SELECT policy DROP + CREATE
-- ============================================================
DROP POLICY IF EXISTS "Vote counts visible to voters or admin" ON public.vote_counts;

CREATE POLICY "Vote counts visible to voters when not hidden"
  ON public.vote_counts
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.votes
        WHERE votes.poll_id = vote_counts.poll_id
          AND votes.user_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM public.polls
        WHERE polls.id = vote_counts.poll_id
          AND polls.results_hidden = false
      )
    )
  );
-- Service-role bypasses RLS automatically per Supabase contract.
-- [CITED: supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z]
```

**Notes for the planner:**
- Section order is load-bearing: `audit_log` must exist before the new EF runs against it, but within a single migration that's automatic because the migration is one transaction.
- The `vote_counts` policy uses two `EXISTS` clauses joined by AND. The planner may collapse to a single `EXISTS` with a JOIN; either is acceptable per D-16. The two-EXISTS form is more readable for the 12-cell test reviewer.
- The admin OR-bypass branch is preserved (kept from migration 5). Without it, admins lose the v1.0 ability to read vote_counts for moderation — which the project relies on. Service-role bypass is automatic for EF writes; the admin OR-branch is for admin-authenticated React reads.

### Pattern 2: `toggle-results-visibility` EF skeleton (mirrors `pin-poll` with extended response)

**What:** Single-purpose admin EF. Reads current value, UPDATEs, audits on state change only, returns the updated poll row.

**When to use:** This is the canonical shape for the new EF.

**Example:**

```typescript
// supabase/functions/toggle-results-visibility/index.ts
// Source: pin-poll/index.ts skeleton + close-poll/index.ts timestamp pattern + D-11 idempotency rule.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin, adminCheckResponse } from '../_shared/admin-auth.ts'
import { writeAudit } from '../_shared/audit-log.ts'  // NEW helper, see Pattern 4

function json(body: unknown, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(cors as Record<string, string>), 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401, corsHeaders)

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401, corsHeaders)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const adminCheck = await requireAdmin(supabaseAdmin, user.id)
    if (!adminCheck.ok) {
      const r = adminCheckResponse(adminCheck)
      return json({ error: r.error }, r.status, corsHeaders)
    }

    let body: { poll_id?: unknown; hidden?: unknown }
    try {
      const parsed: unknown = await req.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
      }
      body = parsed as { poll_id?: unknown; hidden?: unknown }
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
    }

    const poll_id = typeof body.poll_id === 'string' ? body.poll_id.trim() : ''
    const hidden = typeof body.hidden === 'boolean' ? body.hidden : null
    if (!poll_id) return json({ error: 'Missing poll_id' }, 400, corsHeaders)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(poll_id)) {
      return json({ error: 'Invalid poll_id' }, 400, corsHeaders)
    }
    if (hidden === null) return json({ error: 'Missing or invalid hidden' }, 400, corsHeaders)

    // Read current state for idempotency check (D-11).
    const { data: before, error: readErr } = await supabaseAdmin
      .from('polls')
      .select('id, results_hidden')
      .eq('id', poll_id)
      .single()
    if (readErr) {
      if (readErr.code === 'PGRST116') return json({ error: 'Poll not found' }, 404, corsHeaders)
      console.error('toggle-results-visibility read failed:', readErr)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }

    const nowIso = new Date().toISOString()
    const { data: after, error: updateErr } = await supabaseAdmin
      .from('polls')
      .update({ results_hidden: hidden, results_hidden_changed_at: nowIso })
      .eq('id', poll_id)
      .select('*')
      .single()
    if (updateErr) {
      console.error('toggle-results-visibility update failed:', updateErr)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }

    // D-11: write audit only when state actually changed.
    if (before.results_hidden !== hidden) {
      await writeAudit(supabaseAdmin, {
        actor_id: user.id,
        action: 'results_hidden_toggled',
        target_type: 'poll',
        target_id: poll_id,
        before: { results_hidden: before.results_hidden },
        after: { results_hidden: hidden },
      })
    }

    return json({ poll: after }, 200, corsHeaders)
  } catch (err) {
    console.error('toggle-results-visibility error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
```

**Notes:**
- Response shape is `{ poll: <updated row> }` — extends `pin-poll`'s `{ success: true }` to match VIS-03 + ROADMAP SC-3.
- `results_hidden_changed_at` is set on every UPDATE (D-13), even on no-ops. The audit row is the only thing skipped on no-ops.
- The UUID regex matches the form used in `pin-poll/index.ts:57`. Reuse it verbatim.

### Pattern 3: `create-poll` audit + optional `results_hidden` extension

**What:** `create-poll` writes its baseline audit row on every successful create. If the request body carries `results_hidden: true`, write a second audit row with `action='results_hidden_set_at_creation'`.

**When to use:** Only in `create-poll/index.ts`; the pattern is unique to this EF.

**Skeleton (delta only — full file is the existing `create-poll/index.ts` plus these inserts):**

```typescript
// After existing body validation, before calling create_poll_with_choices RPC:
const results_hidden = typeof body.results_hidden === 'boolean' ? body.results_hidden : false
if (body.results_hidden !== undefined && typeof body.results_hidden !== 'boolean') {
  return json({ error: 'results_hidden must be boolean' }, 400, corsHeaders)
}

// ... existing RPC call ...

// After successful create, write baseline audit row:
await writeAudit(supabaseAdmin, {
  actor_id: user.id,
  action: 'poll_created',
  target_type: 'poll',
  target_id: pollId,
  before: null,
  after: { title, results_hidden },
})

// D-09: extra audit row when poll was created hidden at creation time:
if (results_hidden) {
  await writeAudit(supabaseAdmin, {
    actor_id: user.id,
    action: 'results_hidden_set_at_creation',
    target_type: 'poll',
    target_id: pollId,
    before: null,
    after: { results_hidden: true },
  })
}
```

**RPC change required:** `create_poll_with_choices(...)` in migration 5 must be extended to accept `p_results_hidden BOOLEAN` and INSERT it. The planner can either (a) add a new parameter to the existing function in migration 10 (`CREATE OR REPLACE FUNCTION ... ADD param`) or (b) skip the RPC param and rely on the column DEFAULT plus a follow-up `UPDATE polls SET results_hidden = $1 WHERE id = $newPollId` in the EF. Option (a) is more atomic; option (b) avoids touching the RPC signature. **Recommendation: option (a)** — extending the RPC keeps the create operation atomic at the DB layer; the cost is one extra parameter and a corresponding INSERT-column.

### Pattern 4: Shared audit helper

**What:** A `_shared/audit-log.ts` helper that all 13 emitter EFs import. Provides a single typed function that does the INSERT, logs on failure, and never throws to the caller.

**When to use:** Always — do not inline the INSERT in each EF. Inlining produces 13 different "is the audit-write failure fatal?" answers, which is exactly the kind of inconsistency the planner verifier will catch.

**Example:**

```typescript
// supabase/functions/_shared/audit-log.ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'

export interface AuditEntry {
  actor_id: string | null
  action: string
  target_type: string
  target_id: string | null
  before: unknown
  after: unknown
}

/**
 * Write an audit row. Never throws — the audit emit must not be able to fail
 * a user-facing mutation that already succeeded. Logs to console.error on
 * failure for Supabase Function Logs visibility.
 */
export async function writeAudit(
  supabaseAdmin: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_log').insert({
    actor_id: entry.actor_id,
    action: entry.action,
    target_type: entry.target_type,
    target_id: entry.target_id,
    before: entry.before,
    after: entry.after,
  })
  if (error) {
    console.error('audit_log INSERT failed:', { entry, error })
  }
}
```

**Notes:**
- This helper centralizes the "audit failure does not fail the user-facing mutation" policy. CONTEXT.md "DB-write ordering" notes that the planner picks the exact policy, but having a single helper means the policy decision is captured once, not 13 times.
- The helper does NOT take a typed `action` enum; CONTEXT.md "Claude's Discretion" leaves the exact `action` strings to the planner. Keeping `action: string` here lets the planner pick the convention.

### Pattern 5: `close-expired-polls` cron audit (special case)

**What:** The cron sweeper writes audit rows with `actor_id = NULL` and a per-poll `action='poll_auto_closed'`. CONTEXT.md leaves "one batch row vs one per poll" open to the planner.

**Recommendation:** One audit row per closed poll. The cron sweep already returns `data` from `.select('id')` after the UPDATE (existing code at `supabase/functions/close-expired-polls/index.ts:53-58`), so emitting one audit row per `data[i].id` is trivial and gives downstream consumers (Phase 12+ audit UI) per-poll granularity. A single "batch" row loses the per-poll target_id, which makes filtering by poll_id useless.

**Skeleton (delta only):**

```typescript
// After the existing UPDATE returns with data:
if (data && data.length > 0) {
  for (const row of data) {
    await writeAudit(supabaseAdmin, {
      actor_id: null,                       // D-03: cron = NULL actor
      action: 'poll_auto_closed',
      target_type: 'poll',
      target_id: row.id,
      before: { status: 'active' },
      after: { status: 'closed' },
    })
  }
}
```

### Anti-Patterns to Avoid

- **Combining old and new `vote_counts` policies with `OR`:** Postgres evaluates multiple policies on a table with `OR` semantics. Leaving the v1.0 policy in place while adding a v1.2 policy produces an overly permissive combined gate — non-voters who satisfied the OLD policy still get rows. **Always `DROP POLICY` first, then `CREATE POLICY`.** (D-14)
- **Writing the audit INSERT inline in each EF:** Produces 13 subtly different policies on "is audit failure fatal?", "should the audit run before or after the response?", "what does the actor_id look like for service-role cron?". Use the shared helper.
- **Letting `audit_log` writes fail the user-facing mutation:** The audit is for forensics, not for transactional integrity. If `audit_log` is unwritable (rare — would imply DB issue), the user's action should still succeed. The helper logs to console.error so Supabase Function Logs surface the issue without breaking the UI.
- **Skipping the no-op idempotency check in `toggle-results-visibility`:** Two admins clicking "Hide results" at the same time should both succeed and produce ONE audit row, not two. D-11 is non-negotiable.
- **Writing the migration as multiple files:** A column add in file A and a policy rewrite in file B creates a window where the policy references a non-existent column on production deploy. Use ONE migration 10 file with all four sections.
- **Querying the base `polls` table from any `src/` code path:** `polls-effective-invariant.test.ts` scans `src/routes`, `src/hooks`, `src/components` and fails on any `from('polls')`. The view rewrite is what makes `results_hidden` visible to the React path; do not introduce a `from('polls')` shortcut.
- **Granting `audit_log` SELECT to anon:** Audit rows include actor identities and JSONB before/after states. Admins-only via `is_current_user_admin()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Admin authentication on the new EF | A custom token check in `toggle-results-visibility/index.ts` | `requireAdmin` + `adminCheckResponse` from `_shared/admin-auth.ts` | Already enforces `is_admin AND mfa_verified AND guild_member`; aligned with migration 9; reused by 14 existing EFs [VERIFIED: codebase read 2026-05-11] |
| CORS handling on the new EF | Inline `Access-Control-Allow-Origin: *` | `getCorsHeaders` from `_shared/cors.ts` | Already handles allowlist, preflight Vary header, and ALLOWED_ORIGIN env escape hatch [VERIFIED: codebase] |
| Service-role bypass in the `vote_counts` policy | Adding an explicit `OR current_role = 'service_role'` clause | Nothing — service-role bypasses RLS automatically | The Supabase contract says service-role clients bypass RLS entirely. Adding a service-role clause to the policy is a no-op at best and a misleading signal at worst. [CITED: supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z] |
| Audit-row UUID generation in app code | `uuidv4()` in the EF | `gen_random_uuid()` as the column DEFAULT | `pgcrypto` is already loaded; defaults are simpler, atomic, and don't drift if the EF logic changes |
| `results_hidden_changed_at` trigger on `polls` | A BEFORE UPDATE trigger that NEW.results_hidden_changed_at = now() | EF writes the timestamp directly | Matches `closed_at` precedent in `close-poll/index.ts:73` (D-13). Triggers add a write path the codebase doesn't currently have; one place to write the timestamp is one place to debug it. |
| RLS invariant testing via Playwright | A new Playwright spec under `e2e/tests/` | Vitest under `e2e/integration/` with directly minted Supabase clients | Playwright machinery (browser context, page fixtures) is unnecessary for a pure DB-level invariant. Vitest is faster, simpler, and matches the `polls-effective-invariant.test.ts` precedent (D-20). |
| Custom audit-log retention/pruning | A scheduled function that DELETEs old rows | Nothing in v1.2 | Deferred to v1.3+ per CONTEXT.md Deferred Ideas. Free-tier 500 MB ceiling is not in sight; revisit later. |

**Key insight:** Phase 11 is a discipline phase, not an invention phase. Every load-bearing pattern (admin gate, CORS, atomic migration, view rewrite + `security_invoker`, EF-direct timestamp writes, Vitest invariant tests) is already established in the codebase. The work is applying these patterns correctly across 13 EFs without drift.

## Common Pitfalls

### Pitfall 1: P0 — RLS leakage in the rewritten `vote_counts` policy

**What goes wrong:** The new policy combines two AND clauses (voter-exists AND `results_hidden = false`). A misplaced OR, wrong operator precedence in the `USING` clause, or a forgotten JOIN to `polls` leaks pre-aggregated vote counts to non-voters via the Supabase anon key. Because `vote_counts` is read-only, there's no write-path protection to fall back on.

**Why it happens:** The rewrite touches two tables (`vote_counts` and `polls`) and combines two conditions. The 12-cell matrix has six "ALLOWED" cells for service-role and three "ALLOWED" cells for authenticated voters with `hidden=false`; everything else must be BLOCKED. Developers test the happy path (voted + visible) and miss the (voted + hidden) cell or the (anon + voted + visible) cell.

**How to avoid:**
- Write the policy with the exact two-EXISTS form shown in § Pattern 1, OR an equivalent JOIN form — but verify the boolean logic by hand-tracing every cell in the 12-cell matrix before committing.
- Land the 12-cell Vitest test in the same PR as the migration. CONTEXT.md D-23 specifies the exact expected matrix: only `(authenticated, hidden=false, voted)` returns rows; service-role returns rows in all 4 of its cells (bypass); all other cells return 0 rows.
- Do not merge Phase 11 if any cell fails — this is a documented merge blocker (REQUIREMENTS.md TEST-11, ROADMAP SC-2, CONTEXT.md P0 callout).
- Recovery if discovered post-merge: emergency `DROP POLICY / CREATE POLICY` via `supabase db push` against production. No data corruption (vote_counts is read-only), but an integrity window exists.

**Warning signs:**
- Any non-admin authenticated user can call `supabase.from('vote_counts').select('*').eq('poll_id', X)` on a `hidden=true` poll and gets rows back.
- The test passes on `hidden=false + voted` but is not exercised against `hidden=true + voted`.
- The migration applied but the test suite reports < 12 cells executed.

[VERIFIED: v1.2-PITFALLS.md Pitfall 1 (re-validation of v1.0 Pitfall 10), CONTEXT.md P0 callout, REQUIREMENTS.md TEST-11 wording]

### Pitfall 2: `polls_effective` view rewrite drops `security_invoker`

**What goes wrong:** `CREATE OR REPLACE VIEW` is the idiomatic way to add columns to an existing view, but `security_invoker` is a view OPTION, not a column. The `OR REPLACE` preserves the SELECT body, but ALTER VIEW options can be lost during the rewrite (per Supabase docs, default for new views is `security_definer`).

**Why it happens:** Developers see the `ALTER VIEW polls_effective SET (security_invoker = on)` in migration 5 and assume it's permanent. After `CREATE OR REPLACE VIEW`, the view defaults can reset depending on Postgres version semantics. With `security_invoker=off`, the view bypasses RLS — non-admin reads of `polls_effective` return ALL rows regardless of policies on the base table.

**How to avoid:**
- Always re-apply `ALTER VIEW public.polls_effective SET (security_invoker = on)` immediately after the `CREATE OR REPLACE VIEW`. Make it the very next statement in Section 3 of migration 10. (D-17)
- Add a comment near the ALTER that says: "INVARIANT — do not remove. Without this, the view becomes a service-definer security boundary bypass."
- Verify post-migration with: `SELECT relname, reloptions FROM pg_class WHERE relname = 'polls_effective';` — the `reloptions` array should contain `security_invoker=on`.

**Warning signs:**
- Authenticated users see polls they shouldn't have access to (this codebase doesn't currently RLS-gate `polls` SELECT, so the symptom won't show — but the defense-in-depth is gone).
- A future migration that ADDs RLS on `polls` SELECT (e.g., per-category gating) fails silently because reads come through the view.

[CITED: supabase.com/docs/guides/auth/row-level-security — "views inherit the RLS policies of the underlying tables if created with security_invoker"; verified via Context7 2026-05-11]

### Pitfall 3: Audit retrofit drift — 13 different "is audit fatal?" answers

**What goes wrong:** Each of the 12 retrofitted EFs is touched by a separate task. Without a shared helper, each EF ends up with its own audit-write block, and the policy on "audit failure → response failure?" diverges. Some EFs return 500 on audit failure; some return 200 and silently log. The system becomes unpredictable; debugging "why did this admin action fail?" requires reading 13 different code paths.

**Why it happens:** Audit retrofit is mechanical, looks trivial, and gets done in 12 parallel tasks. The shared abstraction is "obviously" needed but not enforced.

**How to avoid:**
- Create the shared `_shared/audit-log.ts` helper FIRST (see Pattern 4), before any EF retrofit task runs.
- Make all 12 retrofit tasks import the helper. Plan-checker should flag any retrofit task that inlines an `audit_log` INSERT.
- The helper's `writeAudit` never throws and never returns an error. The contract is: "this call always succeeds from the caller's perspective; failures are logged for Supabase Function Logs." This makes the audit retrofit additive — it cannot break existing EF behavior.

**Warning signs:**
- A code review on the audit retrofit PR includes 12 different `try/catch` blocks around `supabase.from('audit_log').insert(...)`.
- One EF returns 500 because audit_log was momentarily unavailable; same scenario in a different EF returns 200.

### Pitfall 4: `toggle-results-visibility` writes audit on every call (including no-ops)

**What goes wrong:** Two admins simultaneously click "Hide results" on the same poll. Both calls succeed, both write audit rows, the log shows two distinct events for what was actually one state change. Future audit UI shows a phantom flip.

**Why it happens:** The EF unconditionally writes the audit row after the UPDATE. The UPDATE is idempotent at the DB level (UPDATE polls SET results_hidden=true WHERE id=X — second call is a no-op MVCC overwrite), but the audit INSERT is unconditional.

**How to avoid:**
- D-11 mandates an idempotency check: read current `results_hidden` BEFORE the UPDATE, compare to requested, and only write the audit row when `before.results_hidden !== requested.hidden`.
- `results_hidden_changed_at` is still written on every UPDATE (D-11), because tracking "last time someone tried to flip this" is cheap and useful; the audit row tracks "last time the state actually changed."

**Warning signs:**
- TEST-12 includes a no-op test (admin calls toggle with `hidden=true` on a poll that's already hidden). Without the idempotency check, this writes an audit row.

### Pitfall 5: `create-poll` extension leaks unvalidated `results_hidden` into the RPC

**What goes wrong:** `create_poll_with_choices(...)` RPC is extended to accept `p_results_hidden boolean`. If `create-poll/index.ts` passes `body.results_hidden` directly without `typeof === 'boolean'` validation, callers can pass strings, numbers, or `null` and trigger a Postgres type-coercion error or worse, get the column DEFAULT silently.

**Why it happens:** TypeScript types don't enforce runtime validation; the EF body is `unknown`-typed.

**How to avoid:**
- D-10: EF rejects 400 if `results_hidden` is present and not a boolean.
- The validation pattern is already established in `pin-poll/index.ts:53` for `is_pinned`:
  ```typescript
  const isPinned = typeof body.is_pinned === 'boolean' ? body.is_pinned : null
  if (isPinned === null) return json({ error: 'Missing or invalid is_pinned' }, 400, corsHeaders)
  ```
  Apply the same shape to `results_hidden` in `create-poll/index.ts`, with the distinction that `results_hidden` is OPTIONAL (default `false`):
  ```typescript
  if (body.results_hidden !== undefined && typeof body.results_hidden !== 'boolean') {
    return json({ error: 'results_hidden must be boolean' }, 400, corsHeaders)
  }
  const results_hidden = typeof body.results_hidden === 'boolean' ? body.results_hidden : false
  ```

**Warning signs:**
- A request with `results_hidden: "true"` (string) is accepted and produces a poll with the default value, silently.
- A request with `results_hidden: null` triggers a Postgres NOT NULL violation that surfaces as a 500.

### Pitfall 6: TEST-11 helpers don't clean up test polls (DB pollution)

**What goes wrong:** The 12-cell test creates polls in `setup`. If teardown skips for any reason (test failure, process crash), polls accumulate in the local DB. On the next run, polls from the prior run are still there and confuse the next setup phase.

**Why it happens:** Vitest `afterEach` / `afterAll` does not run if the test process is killed mid-run; even with proper cleanup code, a hanging promise or unhandled rejection can prevent teardown.

**How to avoid:**
- Mirror the Phase 8 `freshPoll` cleanup discipline: delete the poll explicitly in `afterEach`, and rethrow if cleanup itself fails (D-21).
- Use a deterministic poll-title prefix (e.g., `[TEST-11]`) so a startup hook can `DELETE FROM polls WHERE title LIKE '[TEST-11]%'` before the suite starts.
- Run the test suite locally via `npm run test:integration` BEFORE pushing — accumulated rows from a half-finished run will surface immediately on the second run.

**Warning signs:**
- Local test suite passes on first run, fails on second run (poll-title uniqueness or row-count assertions tripped).
- `e2e/integration/` poll count in DB grows monotonically across runs.

[VERIFIED: v1.2-SUMMARY.md notes the Phase 8 freshPoll cleanup pattern as the precedent]

## Runtime State Inventory

> Phase 11 is a **schema migration phase**, not a rename/refactor phase. There is no string-replacement work and no rebranding. However, the addition of `audit_log` and the audit retrofit introduce new runtime state that must be tracked.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | NEW: `audit_log` rows on every admin mutation. `polls.results_hidden_changed_at` timestamp on every toggle. | Audit retrofit creates these rows; ensure DB sizing on Supabase free tier (500 MB ceiling) — current free-tier usage is unknown but `audit_log` adds ~150 bytes/row × ~10 admin actions/day → ~1.5 KB/day → negligible at v1.2 scale. Revisit in v1.3 if free-tier usage approaches 80%. |
| Live service config | None — Phase 11 changes apply via migration + EF deploy, no external service config touched. | None. |
| OS-registered state | None — no Windows Task Scheduler / launchd / cron jobs being added or modified. `close-expired-polls` is invoked by an existing external cron caller (Phase 5) with `X-Cron-Secret`; only its code body changes (audit retrofit). | None. |
| Secrets/env vars | No new env vars. Existing: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGIN`, `CLOSE_SWEEPER_SECRET` — all reused unchanged. New `test:integration` job needs `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_URL` in CI, which Phase 5/8 CI already provides. | None — verify CI job inherits existing secrets correctly. |
| Build artifacts | None — TypeScript compiles cleanly; no installed-package artifact carries old name. | None. |

**Why this section appears for a non-refactor phase:** Even though Phase 11 is greenfield-feature-on-an-existing-schema, the audit retrofit creates a new write path on 13 EFs. Confirming "no other runtime state needs migrating" is documentation that the next phase author (Phase 12) doesn't have to re-derive.

## Code Examples

Verified patterns from the existing codebase (paths are absolute repo-relative).

### Existing admin EF skeleton (the template for `toggle-results-visibility`)

```typescript
// Source: supabase/functions/pin-poll/index.ts (full file)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin, adminCheckResponse } from '../_shared/admin-auth.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401, corsHeaders)

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401, corsHeaders)

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const adminCheck = await requireAdmin(supabaseAdmin, user.id)
  if (!adminCheck.ok) {
    const r = adminCheckResponse(adminCheck)
    return json({ error: r.error }, r.status, corsHeaders)
  }

  // ... body validation, mutation, response
})
```

### Existing `requireAdmin` contract (verified in this session)

```typescript
// Source: supabase/functions/_shared/admin-auth.ts (verified 2026-05-11)
export async function requireAdmin(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<AdminCheckResult> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('is_admin, guild_member, mfa_verified')
    .eq('id', userId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return { ok: false, reason: 'profile_not_found' }
    return { ok: false, reason: 'query_failed' }
  }
  if (!profile) return { ok: false, reason: 'profile_not_found' }
  if (!profile.is_admin) return { ok: false, reason: 'not_admin' }
  if (!profile.mfa_verified || !profile.guild_member) {
    return { ok: false, reason: 'integrity_failed' }
  }
  return { ok: true }
}
```

This is aligned with migration 9 (the function already checks `is_admin AND mfa_verified AND guild_member`). **Open Question 2 from STATE.md is resolved: NOT stale; reuse verbatim.**

### Existing `vote_counts` policy (the one being replaced)

```sql
-- Source: supabase/migrations/00000000000005_admin_phase4.sql:75-88 (Section 3)
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

**Resolution of Open Question 1 from STATE.md:** The policy is scoped `TO authenticated`. The anon role has NO policy granting SELECT on `vote_counts`. Therefore:
- **Anon role → 0 rows in ALL 12 cells** (covers 4 cells of the matrix: anon × {voted, not voted} × {hidden=true, hidden=false})
- The "voted" cell for anon is logically unreachable (anon cannot have a `votes.user_id = auth.uid()` row since `auth.uid()` is NULL for anon), but the test should still exercise it to confirm 0 rows.

This matches REQUIREMENTS.md VIS-04 wording exactly: "Non-voters never see results regardless of state (privacy boundary unchanged from v1.0)."

### Existing `polls_effective` view (verified to use explicit columns)

```sql
-- Source: supabase/migrations/00000000000005_admin_phase4.sql:12-31
CREATE OR REPLACE VIEW public.polls_effective AS
SELECT
  id, title, description, category_id, image_url,
  CASE WHEN status = 'active' AND closes_at < now() THEN 'closed' ELSE status END AS status,
  resolution, is_pinned, created_by, closes_at, closed_at, created_at, updated_at,
  status AS raw_status
FROM public.polls;

ALTER VIEW public.polls_effective SET (security_invoker = on);
```

**Resolution of Open Question 3 from STATE.md:** The view uses **explicit columns**, not `SELECT *`. Migration 10's view rewrite must add `results_hidden` and `results_hidden_changed_at` to the explicit column list (D-17).

### Existing fixture users (for TEST-11 / TEST-12)

```typescript
// Source: e2e/fixtures/test-users.ts (verified 2026-05-11)
export const fixtureUsers = {
  memberUser:  { id: '11111111-...', email: 'playwright-user-member@test.local',    discord_id: '100000000000000001' },
  adminUser:   { id: '22222222-...', email: 'playwright-user-admin@test.local',     discord_id: '100000000000000002' },
  no2faUser:   { id: '33333333-...', email: 'playwright-user-no2fa@test.local',     discord_id: '100000000000000003' },
  notInServer: { id: '44444444-...', email: 'playwright-user-notmember@test.local', discord_id: '100000000000000004' },
}
export const FIXTURE_PASSWORD = 'playwright-fixture-only-do-not-use-in-prod'
```

TEST-11 / TEST-12 can sign in as `adminUser` for the admin role and `memberUser` for the authenticated-non-admin role. For the anon role, mint a client without a session.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pre-reframe SEED-002 enum (`respondents_only` / `public_during` / `public_after_close`) | Boolean `results_hidden` (two-way toggle) | 2026-05-11 user reframing during v1.2 scoping | Smaller schema, simpler RLS (no JOIN to `polls.closed_at`), no irreversibility framing |
| One-way "reveal results" | Two-way toggle (hide ↔ show) | 2026-05-11 reframing | Removes the irreversibility pitfall (v1.2-PITFALLS.md Pitfall 4 NO LONGER APPLIES); admin can fix accidental hides |
| Audit log "already exists from v1.0" claim in PITFALLS | `audit_log` table is **new** in migration 10 | Codebase scout confirmed v1.0 has 7 tables, none named `audit_log` | Migration 10 creates the table; audit retrofit applies to 12 existing EFs |
| `pin-poll` minimal response `{ success: true }` | `toggle-results-visibility` returns `{ poll: <updated row> }` | VIS-03 + ROADMAP SC-3 wording | Admin UI can update optimistically without a refetch |

**Deprecated/outdated:**
- The pre-reframe `reveal-poll-results` EF name — REQUIREMENTS.md is now canonical (`toggle-results-visibility`).
- `results_revealed_at` column name from pre-reframe — REQUIREMENTS.md uses `results_hidden_changed_at`.
- PITFALLS line 191 ("`audit_log` already exists from v1.0") — corrected by CONTEXT.md D-01.
- The pre-reframe 12-cell matrix (3 modes × voted/not × open/closed) — replaced by the simpler 12-cell matrix from CONTEXT.md D-23 (3 roles × 2 hidden states × 2 voter states).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pgcrypto` extension is still loaded (used by `gen_random_uuid()` in `audit_log.id`). | § Pattern 1 | Migration fails with "function gen_random_uuid() does not exist." Verified loaded in `00000000000000_schema.sql:8` [VERIFIED: codebase] — not an assumption anymore. Removed. |
| A2 | Free-tier 500 MB ceiling has headroom for `audit_log` growth at v1.2 scale (~10 admin actions/day × 150 bytes ≈ 1.5 KB/day ≈ 500 KB/year). | § Runtime State Inventory | If current free-tier usage is already near 80%, `audit_log` could accelerate the ceiling. No verified figure for current usage. Mitigation: planner adds a follow-up token to monitor in v1.3+. |
| A3 | The two-EXISTS form for the `vote_counts` policy is performant at 20–30 concurrent users. | § Pattern 1, § Pitfall 1 | If concurrent users reach 200+, the correlated subquery could become a hot path. v1.2-PITFALLS.md Performance Traps section accepts this risk at current scale; revisit at 200+. |
| A4 | The planner will pick option (a) — extending `create_poll_with_choices` RPC to accept `p_results_hidden` — rather than option (b) (post-INSERT UPDATE). | § Pattern 3 | If planner picks option (b), the create path becomes two SQL round trips instead of one; a tiny perf cost, but the user-visible behavior is identical. Either is correct. |
| A5 | Audit retrofit on 12 EFs can land in one PR without overwhelming review. | Audit retrofit (D-05) | If reviewers ask for one-PR-per-EF, the planner needs to split into 12 tasks. CONTEXT.md "code_context — DB-write ordering" implies one-shot retrofit; planner verifies with code-review-depth setting (`deep`). |

**If this table is unresolved at plan-phase:** The planner should flag A2 (free-tier headroom unknown) and A5 (audit retrofit PR scope) as decisions to make before task generation. A1 is verified. A3 is accepted-risk per existing research. A4 is a planner discretion item.

## Open Questions

1. **`create_poll_with_choices` RPC signature change vs post-INSERT UPDATE**
   - What we know: D-08 says `create-poll` accepts optional `results_hidden`. The existing RPC at migration 5 doesn't accept it.
   - What's unclear: Whether the planner picks RPC-signature-change (atomic, but touches the RPC) or post-INSERT UPDATE (non-atomic, but doesn't touch RPC).
   - Recommendation: Extend the RPC in migration 10 (option a). The atomic insert is cleaner and the column DEFAULT covers the omitted-from-body case. Single SQL round trip.

2. **`audit_log` index choice**
   - What we know: CONTEXT.md "Claude's Discretion" leaves indexes to the planner. Likely `(target_type, target_id)` + `(actor_id, created_at)`.
   - What's unclear: Whether v1.3+ audit UI query shapes (filter by actor, action, target, date range) need additional indexes (`(action)`, `(created_at)`).
   - Recommendation: Start with the two indexes shown in § Pattern 1. Add more in v1.3 when the audit UI lands and query patterns are concrete.

3. **`close-expired-polls` audit row granularity**
   - What we know: CONTEXT.md leaves this open. Pattern 5 above recommends one row per closed poll, not one batch row.
   - What's unclear: Whether the planner agrees with the per-poll recommendation.
   - Recommendation: Per-poll. Batch rows lose `target_id` granularity, which makes the audit log harder to query for "show me everything that happened to poll X."

4. **CI job placement for `test:integration`**
   - What we know: D-22 leaves "parallel to unit, sequential before E2E, or its own gate" open.
   - What's unclear: Which placement the project's CI conventions prefer.
   - Recommendation: Sequential AFTER `test` (unit) and BEFORE `e2e` (Playwright). Reasoning: integration tests need a running Supabase (slower setup); separating from unit means the fast unit gate fails first on common errors; running before E2E avoids loading the browser stack just to fail a DB-level invariant.

## Environment Availability

> Phase 11 depends on local Supabase + Vitest. No new external dependencies beyond what v1.0/v1.1 already require.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase (`supabase start`) | Migration apply test, TEST-11, TEST-12 | Likely ✓ (used in v1.0–v1.1) | 2.85.0 (npm package) | None — required for local dev and CI |
| `supabase` CLI | `supabase db reset`, `supabase functions deploy` | Likely ✓ | 2.85.0 (devDependency) | None |
| Node.js + npm | All tooling | ✓ (current dev env) | per CLAUDE.md "Modern terminal/IDE" | None |
| Vitest 4.1.2 | TEST-11, TEST-12 | ✓ (package.json) | 4.1.2 | None — already locked |
| `@supabase/supabase-js` 2.101.1 | EF runtime + integration test clients | ✓ (package.json + EF pinning) | 2.101.1 | None — already locked |
| Postgres 15+ | `security_invoker = on` view option (Postgres 15+) | ✓ (Supabase free tier runs Postgres 15+) | 15.x | None — version 15+ is Supabase free-tier baseline [VERIFIED: Context7 supabase docs note "Postgres 15 and above"] |
| `pgcrypto` extension | `gen_random_uuid()` for `audit_log.id` | ✓ (loaded in `00000000000000_schema.sql:8`) | N/A | None — already loaded |

**Missing dependencies with no fallback:** None identified.
**Missing dependencies with fallback:** None.

**Action items:**
- Planner adds a Wave 0 verification task: `supabase db reset && supabase status` to confirm local Supabase is reachable.
- CI environment must have `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` for the new `test:integration` job — Phase 5 CI already provisions these.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 (existing) + `@supabase/supabase-js` 2.101.1 (existing) |
| Config file | NEW: `vitest.config.integration.ts` at project root, scoped to `e2e/integration/` |
| Quick run command | `npm run test:integration -- --run vote-counts-rls.test.ts` (single file) |
| Full suite command | `npm run test:integration` (all integration specs) |
| Existing unit config | `vitest.config.ts` (unchanged, scoped to `src/__tests__/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIS-01 | `polls.results_hidden boolean NOT NULL DEFAULT false` column exists | DB-level | `npm run test:integration -- --run vote-counts-rls.test.ts` (asserts column shape via supabase-js client metadata read OR via direct INSERT/SELECT) | ❌ Wave 0 (new) |
| VIS-02 | Admin can flip true↔false at any lifecycle point | integration | `npm run test:integration -- --run toggle-results-visibility.test.ts` (TEST-12) | ❌ Wave 0 (new) |
| VIS-03 | `toggle-results-visibility` EF returns 200 with updated poll row | integration | `npm run test:integration -- --run toggle-results-visibility.test.ts` (TEST-12) | ❌ Wave 0 (new) |
| VIS-04 | `vote_counts` RLS gates per voter + `results_hidden` | integration | `npm run test:integration -- --run vote-counts-rls.test.ts` (TEST-11) — 12 cells | ❌ Wave 0 (new) |
| VIS-05 | RLS invariant matrix (= TEST-11 implementation) | integration | Same as above | ❌ Wave 0 (new) |
| VIS-09 | `polls_effective` projects `results_hidden` + `results_hidden_changed_at`; invariant test passes | DB + repo-scan | `npm run test` (Vitest unit, runs `polls-effective-invariant.test.ts` — existing) + manual `SELECT * FROM polls_effective LIMIT 1` check | ✅ Exists (`src/__tests__/admin/polls-effective-invariant.test.ts`) — re-runs unchanged after Phase 11 |
| TEST-11 | 12-cell matrix passes | integration | `npm run test:integration -- --run vote-counts-rls.test.ts` | ❌ Wave 0 (new) |
| TEST-12 | Admin EF authz + audit row written | integration | `npm run test:integration -- --run toggle-results-visibility.test.ts` | ❌ Wave 0 (new) |

### TEST-11 Matrix Specification

D-23 locks the 12-cell matrix expectations. The implementation is `e2e/integration/vote-counts-rls.test.ts` using Vitest `describe.each`.

| Role | hidden state | voter state | Expected rows from `SELECT * FROM vote_counts WHERE poll_id = $1` |
|------|--------------|-------------|------------------------------------------------------------------|
| anon | hidden=false | not voted | 0 |
| anon | hidden=false | voted* | 0 (anon cannot vote — but exercise to confirm) |
| anon | hidden=true | not voted | 0 |
| anon | hidden=true | voted* | 0 |
| authenticated (non-admin test user) | hidden=false | not voted | 0 |
| authenticated (non-admin test user) | hidden=false | voted | **N rows** (where N = number of choices on the test poll) |
| authenticated (non-admin test user) | hidden=true | not voted | 0 |
| authenticated (non-admin test user) | hidden=true | voted | 0 |
| service-role | hidden=false | not voted | N rows (bypass) |
| service-role | hidden=false | voted | N rows (bypass) |
| service-role | hidden=true | not voted | N rows (bypass) |
| service-role | hidden=true | voted | N rows (bypass) |

*Anon cannot actually cast a vote (votes RLS gates by `auth.uid()`). The cell exists for completeness; expected result is still 0.

**Test runner shape (skeleton, planner refines):**

```typescript
// e2e/integration/vote-counts-rls.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mintClients, createFreshPoll, castVote, cleanupPoll } from './helpers'

describe('vote_counts RLS 12-cell matrix (TEST-11)', () => {
  const clients = mintClients()  // { anon, authed, serviceRole }
  let pollId: string

  beforeAll(async () => {
    pollId = await createFreshPoll(clients.serviceRole, { results_hidden: false })
    // Test user casts a vote so the "voted" cells have a vote row to find.
    await castVote(clients.authed, pollId)
  })

  afterAll(async () => {
    await cleanupPoll(clients.serviceRole, pollId)
  })

  describe.each([
    { role: 'anon',          hidden: false, voted: false, expectRows: 0 },
    { role: 'anon',          hidden: false, voted: true,  expectRows: 0 },
    { role: 'anon',          hidden: true,  voted: false, expectRows: 0 },
    { role: 'anon',          hidden: true,  voted: true,  expectRows: 0 },
    { role: 'authenticated', hidden: false, voted: false, expectRows: 0 },
    { role: 'authenticated', hidden: false, voted: true,  expectRows: 'N' },
    { role: 'authenticated', hidden: true,  voted: false, expectRows: 0 },
    { role: 'authenticated', hidden: true,  voted: true,  expectRows: 0 },
    { role: 'service-role',  hidden: false, voted: false, expectRows: 'N' },
    { role: 'service-role',  hidden: false, voted: true,  expectRows: 'N' },
    { role: 'service-role',  hidden: true,  voted: false, expectRows: 'N' },
    { role: 'service-role',  hidden: true,  voted: true,  expectRows: 'N' },
  ])('cell: $role × hidden=$hidden × voted=$voted', ({ role, hidden, voted, expectRows }) => {
    it(`returns ${expectRows} rows from vote_counts`, async () => {
      // 1. Set polls.results_hidden via service-role to match this cell.
      await clients.serviceRole.from('polls').update({ results_hidden: hidden }).eq('id', pollId)
      // 2. (voted state is fixed for the suite via beforeAll; the "voted=false" cells use a different test user OR delete the vote — planner picks)
      // 3. Query as the appropriate role.
      const client = clients[role === 'anon' ? 'anon' : role === 'authenticated' ? 'authed' : 'serviceRole']
      const { data } = await client.from('vote_counts').select('*').eq('poll_id', pollId)
      if (expectRows === 0) expect(data).toEqual([])
      else expect((data ?? []).length).toBeGreaterThan(0)
    })
  })
})
```

The planner refines the "voted=false" cell mechanics (separate test user vs vote-delete) — D-23 locks the expectations but not the implementation. The simpler shape is one fixture user who has voted, and a SECOND fixture user who has not — query as user A for "voted" cells, as user B for "not voted" cells.

### TEST-12 Specification

```typescript
// e2e/integration/toggle-results-visibility.test.ts
import { describe, it, expect } from 'vitest'
import { mintClients, createFreshPoll, signInAs, invokeEF, cleanupPoll, readAuditLog } from './helpers'

describe('toggle-results-visibility EF (TEST-12)', () => {
  const clients = mintClients()

  describe('admin caller', () => {
    let pollId: string
    beforeEach(async () => { pollId = await createFreshPoll(clients.serviceRole, { results_hidden: false }) })
    afterEach(async () => { await cleanupPoll(clients.serviceRole, pollId) })

    it('returns 200 with updated poll row when flipping false → true', async () => {
      const session = await signInAs(clients.anon, 'adminUser')
      const res = await invokeEF(session, 'toggle-results-visibility', { poll_id: pollId, hidden: true })
      expect(res.status).toBe(200)
      expect(res.body.poll.results_hidden).toBe(true)
      expect(res.body.poll.results_hidden_changed_at).not.toBeNull()
    })

    it('writes an audit_log row when state changes', async () => {
      const session = await signInAs(clients.anon, 'adminUser')
      await invokeEF(session, 'toggle-results-visibility', { poll_id: pollId, hidden: true })
      const audits = await readAuditLog(clients.serviceRole, { target_id: pollId, action: 'results_hidden_toggled' })
      expect(audits).toHaveLength(1)
      expect(audits[0].before).toEqual({ results_hidden: false })
      expect(audits[0].after).toEqual({ results_hidden: true })
    })

    it('does NOT write an audit row on no-op (already-hidden → hidden)', async () => {
      // First flip to true to set the state.
      const session = await signInAs(clients.anon, 'adminUser')
      await invokeEF(session, 'toggle-results-visibility', { poll_id: pollId, hidden: true })
      // Second call with same value should be a no-op.
      await invokeEF(session, 'toggle-results-visibility', { poll_id: pollId, hidden: true })
      const audits = await readAuditLog(clients.serviceRole, { target_id: pollId, action: 'results_hidden_toggled' })
      expect(audits).toHaveLength(1)  // Only the first flip was logged.
    })
  })

  describe('non-admin caller', () => {
    it('returns 403', async () => {
      const session = await signInAs(clients.anon, 'memberUser')
      const pollId = await createFreshPoll(clients.serviceRole, { results_hidden: false })
      const res = await invokeEF(session, 'toggle-results-visibility', { poll_id: pollId, hidden: true })
      expect(res.status).toBe(403)
      await cleanupPoll(clients.serviceRole, pollId)
    })
  })
})
```

### Sampling Rate

- **Per task commit:** `npm run test` (Vitest unit, fast) — runs `polls-effective-invariant.test.ts` automatically; catches `from('polls')` drift.
- **Per wave merge:** `npm run test:integration` (TEST-11 + TEST-12) — full 12-cell matrix + admin EF authz suite.
- **Phase gate:** Full `npm run test`, full `npm run test:integration`, AND a manual `supabase db reset && supabase db push` to confirm migration 10 applies cleanly from scratch. Then `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `vitest.config.integration.ts` — Vitest config scoped to `e2e/integration/`, sources `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` from env
- [ ] `e2e/integration/helpers.ts` — `mintClients()`, `createFreshPoll()`, `castVote()`, `signInAs()`, `invokeEF()`, `readAuditLog()`, `cleanupPoll()`
- [ ] `e2e/integration/vote-counts-rls.test.ts` — TEST-11 12-cell matrix (REQ VIS-05, TEST-11)
- [ ] `e2e/integration/toggle-results-visibility.test.ts` — TEST-12 admin EF authz + audit row (REQ VIS-03, TEST-12)
- [ ] `package.json` script: `"test:integration": "vitest run --config vitest.config.integration.ts"`
- [ ] Verify CI YAML inherits `SUPABASE_SERVICE_ROLE_KEY` and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` into the `test:integration` job

## Security Domain

> `security_enforcement` is not explicitly set false in config.json — defaults to enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Discord OAuth via Supabase Auth provider (existing). `requireAdmin` enforces `is_admin AND mfa_verified AND guild_member`. No change in Phase 11. |
| V3 Session Management | yes | Supabase JS client handles JWT lifecycle (existing). EFs read JWT from Authorization header. No change in Phase 11. |
| V4 Access Control | **yes — central to Phase 11** | RLS on `vote_counts` (DB layer) + `requireAdmin` on EFs (API layer). The new policy enforces the per-poll visibility gate at the DB. |
| V5 Input Validation | yes | EF body parsing rejects 400 for non-boolean `hidden`, non-UUID `poll_id`. Pattern established in `pin-poll/index.ts`. |
| V6 Cryptography | no (no new crypto in Phase 11) | N/A — `gen_random_uuid()` for IDs uses pgcrypto (built-in). No new key material, no new signing. |
| V7 Error Handling | yes | EF returns structured `{ error: '...' }` for 4xx/5xx (existing pattern); audit-write failures log but do not fail the response. |
| V8 Data Protection | yes | `audit_log.before`/`after` JSONB may contain admin-sensitive data (e.g., who promoted whom). Admins-only SELECT (D-04). |
| V9 Communication | no (no new transport surface) | N/A — all EFs go through Supabase Functions HTTPS endpoint; CORS configured via `_shared/cors.ts`. |
| V10 Malicious Code | no | N/A — no third-party code introduced in Phase 11. |
| V11 Business Logic | yes | `toggle-results-visibility` idempotency (D-11) is a business-logic correctness control. |
| V12 Files & Resources | no | N/A — no file uploads / downloads in Phase 11. |

### Known Threat Patterns for Supabase RLS + EF stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| RLS leakage via incorrect `USING` clause | Information Disclosure | 12-cell matrix test (TEST-11) blocks merge if any cell leaks [VERIFIED: v1.2-PITFALLS.md Pitfall 1] |
| Admin EF called by non-admin (privilege escalation) | Elevation of Privilege | `requireAdmin` first-line check, 403 on failure (TEST-12 verifies) [VERIFIED: codebase] |
| Audit log tampering (admin covers their tracks) | Repudiation | No UPDATE/DELETE policies on `audit_log`; writes are service-role only via EFs. Admins can SELECT but not modify. (D-04) |
| Audit log enumeration by non-admin (privacy leak) | Information Disclosure | `audit_log` RLS: admins-only SELECT via `is_current_user_admin()` (D-04) |
| `audit_log` write fails mid-mutation (inconsistent state) | Tampering / Repudiation | The mutation succeeds; audit write failure is logged to console.error but does not roll back the mutation. Tradeoff: prefer not breaking user-facing actions over perfect audit completeness. Documented in § Pattern 4. |
| Service-role key leak via misconfigured EF | Elevation of Privilege | `SUPABASE_SERVICE_ROLE_KEY` lives in Supabase Function env only; never sent to client; CORS rejects non-allowlisted origins. No change in Phase 11. |
| Idempotency race (double-flip writes two audit rows) | Tampering (audit integrity) | D-11 read-before-write check; TEST-12 no-op test verifies single audit row [VERIFIED: § Pitfall 4] |
| `results_hidden = "true"` (string vs boolean type confusion) | Tampering | EF rejects 400 on non-boolean (D-10); typed body parser pattern from `pin-poll/index.ts:53` [VERIFIED: codebase] |

## Project Constraints (from CLAUDE.md)

| Constraint | Phase 11 Compliance |
|------------|---------------------|
| $0/month budget — Supabase free tier (500 MB DB) | `audit_log` growth at ~1.5 KB/day is negligible; no new paid features |
| Tech stack locked: Vite + React 19 + TS, Supabase, Netlify | No new framework/library introduced |
| Auth: Discord OAuth + mandatory 2FA via `requireAdmin` | Reused verbatim; migration 9 alignment confirmed |
| Source-comment policy: WHY-only, no review-round/phase-ID archaeology in `src/` | Migration 10 + new EF files include WHY comments only; no `Phase 11 R1 fix` style tags in `src/` or `supabase/functions/` (DB migration comments may reference phase since they're not source code per the policy) |
| ESLint `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` | New TS files (helpers, tests) must respect — use `import type { … }` for type-only imports |
| Edge Functions: kebab-case directories, `index.ts` default export | `toggle-results-visibility/index.ts` follows pattern |
| One primary named export per file in `src/` (no default exports for components) | N/A — Phase 11 doesn't touch `src/components/` |
| RLS is the authoritative security gate; React conditional render is UX only | Phase 11 establishes RLS gate; Phase 12 owns the React render |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/00000000000000_schema.sql` — confirmed 7 v1.0 tables, no `audit_log`
- `supabase/migrations/00000000000001_rls.sql` — original `vote_counts` policy
- `supabase/migrations/00000000000005_admin_phase4.sql` — current `polls_effective` view (explicit columns), `is_current_user_admin()` original, current `vote_counts` policy (with admin OR-bypass)
- `supabase/migrations/00000000000009_admin_integrity_rls.sql` — `is_current_user_admin()` updated to enforce `is_admin AND mfa_verified AND guild_member`
- `supabase/functions/_shared/admin-auth.ts` — verified 2026-05-11: `requireAdmin` IS current (not stale); enforces all three checks
- `supabase/functions/_shared/cors.ts` — verified 2026-05-11
- `supabase/functions/pin-poll/index.ts` — skeleton template for `toggle-results-visibility`
- `supabase/functions/close-poll/index.ts` — `closed_at` precedent for D-13 (EF writes timestamp)
- `supabase/functions/create-poll/index.ts` — body validation patterns + RPC call shape
- `supabase/functions/close-expired-polls/index.ts` — cron pattern, returns `data` from UPDATE for per-poll audit emission
- `src/__tests__/admin/polls-effective-invariant.test.ts` — Vitest precedent for D-20
- `e2e/fixtures/test-users.ts` — fixture users for TEST-11/TEST-12
- `e2e/helpers/auth.ts` — `loginAs` pattern (may be reused for integration tests)
- `package.json` — verified Vitest 4.1.2, supabase-js 2.101.1
- `.planning/REQUIREMENTS.md` — locked VIS-01 through VIS-09, TEST-11, TEST-12
- `.planning/ROADMAP.md` — 5 success criteria
- `.planning/STATE.md` — three open questions (all resolved in this research)
- `.planning/phases/11-schema-rls-ef-foundations/11-CONTEXT.md` — 24 user decisions (D-01 through D-24)
- Context7 `/websites/supabase` (resolved 2026-05-11):
  - "CREATE OR REPLACE VIEW security_invoker" — confirmed `ALTER VIEW … SET (security_invoker = on)` is the correct re-apply pattern
  - "RLS service_role bypass" — confirmed service-role bypasses RLS automatically; no explicit policy clause needed [CITED: supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z]

### Secondary (MEDIUM confidence)
- `.planning/research/v1.2-PITFALLS.md` — re-validates v1.0 Pitfall 10 (RLS leakage); contains the 12-cell matrix concept (pre-reframe naming applies caveat)
- `.planning/research/v1.2-SUMMARY.md` — migration-atomicity rationale; pre-reframe naming caveat
- `.planning/research/v1.2-ARCHITECTURE.md` — exact RLS USING clause shape (pre-reframe but translates directly to boolean form)
- `.planning/research/v1.2-STACK.md` — Postgres enum vs CHECK debate (mooted by reframe to boolean); EF skeleton confirmation

### Tertiary (LOW confidence)
- None — all critical claims verified against codebase or Context7.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version, every shared helper signature verified against codebase 2026-05-11
- Architecture: HIGH — all patterns trace to specific files; pre-reframe research translates cleanly to boolean form
- Pitfalls: HIGH — Pitfall 1 is a re-validation of a known v1.0 issue; Pitfall 2 verified via Context7 supabase docs; Pitfalls 3–6 grounded in CONTEXT.md decisions
- Open Questions (STATE.md): RESOLVED — all three answered with verified codebase reads

**Research date:** 2026-05-11
**Valid until:** 2026-06-10 (30 days — codebase patterns are stable; Supabase free-tier limits are stable)
