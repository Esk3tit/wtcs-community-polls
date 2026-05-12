# Phase 11: Schema + RLS + EF Foundations - Context

**Gathered:** 2026-05-11
**Status:** Shipped (2026-05-11)

<domain>
## Phase Boundary

Database + server-side foundation for admin-controlled results visibility (SEED-002 reframed). Migration 10 introduces `polls.results_hidden` + `polls.results_hidden_changed_at`, rewrites the `vote_counts` SELECT RLS policy, rewrites `polls_effective` to project the new columns, and **also creates a new `audit_log` table**. A new admin-gated Edge Function `toggle-results-visibility` performs the flip, write-audited. **Phase 11 also retrofits 12 existing mutation admin EFs** to write audit rows, raising total audit-emitting EFs to 13. The 12-cell RLS invariant test (TEST-11) ships as a Vitest spec under `e2e/integration/`. The admin EF authorization test (TEST-12) ships alongside `toggle-results-visibility`.

**In scope (Phase 11 boundary):**
- Migration 10: ADD COLUMN `polls.results_hidden boolean NOT NULL DEFAULT false`, ADD COLUMN `polls.results_hidden_changed_at timestamptz`, CREATE TABLE `audit_log`, DROP+CREATE `vote_counts` SELECT policy, CREATE OR REPLACE VIEW `polls_effective` (with `security_invoker = on` re-applied)
- New EF `toggle-results-visibility` (audit-emitting, idempotent, returns updated poll row)
- create-poll EF extended to accept optional `results_hidden` at creation (audit-emitted only when set true at creation)
- Audit retrofit of 12 existing mutation admin EFs (close-expired-polls, close-poll, create-category, create-poll, delete-category, delete-poll, demote-admin, pin-poll, promote-admin, rename-category, set-resolution, update-poll)
- TEST-11: Vitest at `e2e/integration/vote-counts-rls.test.ts` — 12-cell matrix
- TEST-12: admin EF authorization test for `toggle-results-visibility`
- New `npm run test:integration` script + Vitest config scoped to `e2e/integration/`

**Out of scope (Phase 12+ owns these):**
- Phase 12 admin UI: `Switch` toggle on admin cards (replaces VIS-07's locked Button), `Checkbox` on creation form (VIS-06 unchanged), `useVoteCounts` extension, hidden-state user message (VIS-08), archive view fix
- Phase 12 also: VIS-07 wording edit in REQUIREMENTS.md (Button → Switch); decide whether AlertDialog confirmation stays or drops with the Switch UX
- Phase 12 UIDN-03 sweep, Phase 13 UIDN-02 mobile audit
- Admin audit-log UI (browse audit entries) — deferred to v1.3+
- search-admin-targets and get-upload-url audit retrofit (read-only EFs, no state change)

</domain>

<decisions>
## Implementation Decisions

### audit_log table (new — created in migration 10)
- **D-01:** `audit_log` table is created in migration 10 alongside the `results_hidden` column + view + policy work. Single atomic migration file. The research doc (`v1.2-PITFALLS.md` line 191) incorrectly claimed `audit_log` "already exists from v1.0" — it does not; the 7 v1.0 tables are `admin_discord_ids`, `profiles`, `categories`, `polls`, `choices`, `votes`, `vote_counts`. Phase 11 creates the table and immediately retrofits it across the admin EF surface.
- **D-02:** Schema baseline (planner refines column types/indexes if needed):
  ```sql
  CREATE TABLE public.audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES public.profiles(id),  -- NULLABLE: cron writes with NULL
    action text NOT NULL,                          -- e.g. 'results_hidden_toggled', 'poll_closed'
    target_type text NOT NULL,                     -- e.g. 'poll', 'category', 'profile'
    target_id text,                                -- nullable; text (not uuid) to admit both UUIDs and Discord snowflakes per REVIEW-FIX-C3-H1 (Plan 11-01)
    before jsonb,                                  -- prior state (nullable for create actions)
    after jsonb,                                   -- new state (nullable for delete actions)
    created_at timestamptz NOT NULL DEFAULT now()
  );
  ```
- **D-03:** `actor_id` is **NULLABLE**. Cron-triggered writes (specifically `close-expired-polls`) write rows with `actor_id = NULL` representing system actions. Admin-initiated writes always supply a real `profiles.id`.
- **D-04:** RLS on `audit_log`: admins-only SELECT (planner picks the exact policy expression — likely `is_current_user_admin()` from migration 9). No public reads; no INSERT policy (writes are service-role only via the EFs).
- **D-05:** Audit retrofit covers **all 12 mutation admin EFs + the new toggle EF (13 total emitters)**:
  - `close-expired-polls` (cron, `actor_id=NULL`, `action='poll_auto_closed'`)
  - `close-poll`, `create-category`, `create-poll`, `delete-category`, `delete-poll`, `demote-admin`, `pin-poll`, `promote-admin`, `rename-category`, `set-resolution`, `update-poll`
  - `toggle-results-visibility` (new)
- **D-06:** Audit retrofit **excludes** the two read-only admin EFs: `search-admin-targets` and `get-upload-url`. They don't change state, so no audit row.
- **D-07:** `before`/`after` JSONB shape is left to the planner per-EF (different EFs change different fields). Convention: include only the columns the EF mutated, not the full row, to keep the log compact and grep-able.

### `create-poll` extended to accept `results_hidden` at creation
- **D-08:** The existing `create-poll` EF body is extended to accept an optional `results_hidden?: boolean` (default `false`). Atomic creation — admin can ship a hidden poll in one EF call rather than create-then-toggle (2 calls, 2 audit rows).
- **D-09:** When `results_hidden = true` is supplied at creation, `create-poll` writes an audit row with `action='results_hidden_set_at_creation'`, `before=null`, `after={results_hidden: true}`. When omitted or `false`, no extra audit row beyond the standard `create-poll` audit row (D-05).
- **D-10:** Validation: EF rejects 400 if `results_hidden` is present but not a boolean. Default `false` if absent (column DEFAULT covers this; EF can omit the field from the INSERT).

### `toggle-results-visibility` EF idempotency
- **D-11:** EF is **idempotent and quiet on no-ops**. Sequence: read current `results_hidden`, compare to requested. UPDATE the row (cheap under MVCC) and set `results_hidden_changed_at = now()` always. Write the audit row **only when before ≠ after**. Return 200 with the updated poll row in all cases.
- **D-12:** No 409 Conflict path on no-op — UI carries the burden of representing current state, EF tolerates duplicate calls (network retries, two-admin races) without complaint.
- **D-13:** `results_hidden_changed_at` is written by the EF directly (matches the `closed_at` precedent in `close-poll/index.ts`), not via a DB trigger. Same pattern across the codebase keeps the timestamp authority in the EF that's already taking responsibility for the audit row.

### `vote_counts` RLS policy (locked by VIS-04, planner picks the exact JOIN form)
- **D-14:** New policy DROPs the existing `"Vote counts visible to voters"` policy first, then CREATEs the rewritten policy. No OR-permissive combination. Locked by VIS-04 wording.
- **D-15:** Policy expression checks both: caller has cast a vote (existing `EXISTS (SELECT 1 FROM votes ...)` clause stays in shape) AND `polls.results_hidden = false` (new clause). Service-role bypass remains automatic (Supabase service-role bypasses RLS by default — the existing pattern across `vote_counts` does not need an explicit policy for service_role).
- **D-16:** Planner picks subquery vs JOIN form for the `polls.results_hidden = false` check. Research (`v1.2-PITFALLS.md` § Performance Traps) confirms PK-lookup overhead is acceptable at the project's 20–30 concurrent user scale; revisit at 200+.

### `polls_effective` view rewrite (locked by VIS-09)
- **D-17:** `CREATE OR REPLACE VIEW polls_effective AS ...` re-projects every existing column (D-12 lazy-close pattern from migration 5 stays), **plus** `results_hidden` and `results_hidden_changed_at` from `polls`. `ALTER VIEW polls_effective SET (security_invoker = on)` is re-applied immediately after.
- **D-18:** Planner reads the current view DDL at `supabase/migrations/00000000000005_admin_phase4.sql:12-31` to confirm whether existing form uses explicit columns or `SELECT *`, then preserves the same form (currently explicit columns — confirmed via codebase scout).
- **D-19:** `polls-effective-invariant.test.ts` at `src/__tests__/admin/` continues to pass. No new direct `from('polls')` reads introduced anywhere in `src/`.

### TEST-11 RLS invariant test runner
- **D-20:** **Vitest** at `e2e/integration/vote-counts-rls.test.ts` using `describe.each` over 12 cells. Matches the precedent set by `polls-effective-invariant.test.ts` (Vitest + supabase-js for RLS invariants). No browser, no Playwright fixture machinery.
- **D-21:** New `e2e/integration/helpers.ts` mints three pre-scoped clients (anon / authenticated test user / service-role) and provides a freshPoll-equivalent setup/teardown that does not depend on Playwright's `test.extend` lifecycle. Cleanup deletes the poll on test exit; rethrows on teardown failure (matches the Phase 8 freshPoll cleanup discipline).
- **D-22:** New `npm run test:integration` script + new `vitest.config.integration.ts` scoped to `e2e/integration/` (so the existing `npm run test` still runs only `src/__tests__/`). CI job structure (separate job vs folded into existing) is a planner decision.
- **D-23:** Test asserts the row count returned from `SELECT * FROM vote_counts WHERE poll_id = $1` for each of the 12 cells:
  - 3 roles: anon, authenticated (test user), service-role
  - 2 hidden states: `results_hidden = true`, `results_hidden = false`
  - 2 voter states: voted, not voted
  - Expected matrix: only `(authenticated, hidden=false, voted)` returns rows; service-role returns rows in all 4 of its cells (bypass); all other cells return 0 rows. **Blocks merge** if any cell fails (per TEST-11 wording).

### TEST-12 admin EF authorization test
- **D-24:** TEST-12 lives alongside TEST-11 under `e2e/integration/` (Vitest, same helpers). Asserts: non-admin caller → 403; admin caller → 200 with updated poll row including new `results_hidden` value and a non-null `results_hidden_changed_at`; an `audit_log` row written for every state-changing toggle (and **not** written on no-op calls per D-11).

### Claude's Discretion
- Migration file packaging within migration 10 (statement order: column ADD → audit_log CREATE TABLE+RLS → polls_effective rewrite → vote_counts policy DROP+CREATE — but planner verifies dependency order).
- `audit_log` indexes (likely `(target_type, target_id)` and `(actor_id, created_at)` — planner picks based on expected query shapes).
- `before`/`after` JSONB shape per EF — keep compact (mutated fields only), but exact key choice is per-EF.
- Audit `action` string convention: snake_case verb_phrase (e.g., `results_hidden_toggled`, `poll_pinned`, `category_renamed`) — planner picks the exact strings; consistency across EFs matters more than the specific words.
- Whether `close-expired-polls` writes one batch audit row per cron run or one per closed poll — planner picks based on the existing batch-close shape.
- Vitest `describe.each` matrix layout (single 12-row table vs nested describe blocks) — D-23 locks the assertions, the test structure is open.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements (locked)
- `.planning/REQUIREMENTS.md` § "Admin Visibility Controls (SEED-002 reframed)" — VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, VIS-09 are **locked verbatim**; planner does not re-derive
- `.planning/REQUIREMENTS.md` § "Testing & Validation" — TEST-11 (12-cell matrix, blocks merge), TEST-12 (admin EF authz)
- `.planning/ROADMAP.md` § "Phase 11: Schema + RLS + EF Foundations" — 5 success criteria locked; **NB: Phase 11 audit retrofit (D-05) materially expands scope beyond the 5 SCs as written; planner verifier must goal-backward analyze and may need to add an SC**

### Research (caveat — pre-reframe)
- `.planning/research/v1.2-SUMMARY.md` — useful for migration-atomicity rationale and EF skeleton recommendations; **but uses pre-reframe enum design (`results_visibility` / `reveal-poll-results` / `results_revealed_at`) that does NOT match the locked REQUIREMENTS.md** (boolean / `toggle-results-visibility` / `results_hidden_changed_at`). Translate names when reading.
- `.planning/research/v1.2-PITFALLS.md` § "Pitfall 10 — RLS Leakage" — JOIN/subquery performance characteristic at scale; UI/security mistakes table; **NB: line 191's claim that `audit_log` "already exists from v1.0" is FALSE — corrected by D-01**
- `.planning/research/v1.2-FEATURES.md` — feature prioritization; pre-reframe naming applies the same caveat
- `.planning/research/v1.2-ARCHITECTURE.md`, `.planning/research/v1.2-STACK.md` — read for system-level context; pre-reframe naming caveat

### Seed origin
- `.planning/seeds/SEED-002-admin-controlled-results-visibility.md` — original Tim ask; **superseded by REQUIREMENTS.md reframing** (boolean instead of enum, two-way toggle instead of one-way reveal). Read for historical "why," not for spec.

### Schema reference (Phase 11 must read at plan start)
- `supabase/migrations/00000000000000_schema.sql` — all 7 tables; `polls` definition (column to extend)
- `supabase/migrations/00000000000001_rls.sql` § lines 72–82 — current `"Vote counts visible to voters"` policy (the one being DROP+CREATE'd)
- `supabase/migrations/00000000000002_triggers.sql` — trigger pattern (none on `polls.closed_at`; EF writes timestamps directly per D-13)
- `supabase/migrations/00000000000005_admin_phase4.sql` § lines 12–38 — existing `polls_effective` view DDL (explicit columns; `security_invoker = on`)
- `supabase/migrations/00000000000009_admin_integrity_rls.sql` — current `is_current_user_admin()` (aligned with EF integrity check; reusable for `audit_log` RLS per D-04)

### Edge Function patterns (planner reuses these skeletons)
- `supabase/functions/_shared/admin-auth.ts` — `requireAdmin(supabaseAdmin, userId)` + `adminCheckResponse(result)`; reuse as-is
- `supabase/functions/_shared/cors.ts` — `getCorsHeaders(req)`; reuse as-is
- `supabase/functions/pin-poll/index.ts` — closest skeleton for `toggle-results-visibility` (admin-gated, single-field UPDATE, returns minimal response — note that VIS-03+ROADMAP SC-3 require returning the **updated poll row**, so the response shape extends pin-poll's `{ success: true }`)
- `supabase/functions/close-poll/index.ts` — `closed_at` write pattern (`new Date().toISOString()`); precedent for D-13 (EF writes timestamp, no DB trigger)
- `supabase/functions/create-poll/index.ts` — body parser, validation, transactional INSERT pattern; needs the `results_hidden?: boolean` extension per D-08

### Existing invariant test pattern (TEST-11 mirrors this)
- `src/__tests__/admin/polls-effective-invariant.test.ts` — Vitest + supabase-js RLS invariant; D-20 follows this pattern but at `e2e/integration/`

### E2E fixtures (NOT reused for TEST-11; reference only)
- `e2e/fixtures/freshPoll.ts` (or wherever Phase 8's freshPoll lives) — Playwright `test.extend` lifecycle; D-21 reimplements equivalent setup/teardown for Vitest
- `e2e/helpers/auth.ts` — Playwright `loginAs` + service-role client; D-21 may reuse the service-role client minting logic via direct import

### Project decisions that carry forward
- `.planning/PROJECT.md` § Constraints — $0/mo budget; Supabase free tier (audit_log adds rows, monitor for 500 MB ceiling)
- `.planning/PROJECT.md` § Key Decisions — Discord OAuth + 2FA fail-closed; admin = Discord-native (audit_log.actor_id maps to profiles.id, which links to Discord identity)
- `.planning/phases/05-launch-hardening/05-CONTEXT.md` — established two-layer seed flow (D-07, D-08) and Playwright auth-bypass (D-05) — informs CI structure for the new test:integration script
- Source-comment policy: WHY-only, no review-round / phase-ID archaeology in `src/` or `supabase/` (project rule)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`_shared/admin-auth.ts` `requireAdmin` + `adminCheckResponse`** — already aligns with migration 9's `is_current_user_admin()` (checks `is_admin AND mfa_verified AND guild_member`). `toggle-results-visibility` and the audit retrofit of all 12 EFs reuse this verbatim.
- **`_shared/cors.ts` `getCorsHeaders`** — every new/modified EF reuses.
- **Migration 9 `is_current_user_admin()` SECURITY DEFINER STABLE function** — usable for the `audit_log` RLS SELECT policy per D-04.
- **`pin-poll` EF skeleton** — closest analog for `toggle-results-visibility` (single boolean flip on `polls`, admin-gated). Needs response-shape extension to return the updated poll row.
- **`close-poll` EF `closed_at` precedent** — confirms D-13 pattern (EF writes timestamp directly, no DB trigger).
- **`polls-effective-invariant.test.ts` (Vitest)** — pattern mirror for TEST-11 (RLS invariant via supabase-js); D-21 lifts the client-minting and DB-cleanup approach without Playwright machinery.
- **Existing `polls_effective` view at migration 5** — explicit columns + `security_invoker = on`; D-17 preserves this form when re-creating with `results_hidden` projected.

### Established Patterns
- **EF skeleton** — anon-key client for `auth.getUser()`, then service-role client for the admin check + write. Locked across all 16 existing EFs; new EF + 12 retrofitted EFs follow.
- **Atomic migration files** — every prior migration is one file with multiple statements run in transaction order. Migration 10 follows this pattern (column → audit_log CREATE → view rewrite → policy DROP+CREATE).
- **EF response shape baseline** — current admin EFs return `{ success: true }` minimal. VIS-03 + ROADMAP SC-3 require the new EF to return the updated poll row instead. This is a deliberate one-EF deviation; the audit retrofit of the other 12 EFs does not change their response shape.
- **DB-write ordering** — admin EFs UPDATE → return. Audit retrofit slots the audit-row INSERT between the UPDATE success check and the response (per D-05; failure of audit write logs but does not fail the user-facing response — planner picks the exact policy).
- **Vitest unit tests at `src/__tests__/`** — fast, in-CI on every PR. The new `npm run test:integration` is intentionally separate so service-role credentials don't leak into the unit job.

### Integration Points
- **`useVoteCounts` / `SuggestionCard` (Phase 12)** — these branch on `results_hidden` from `polls_effective` (per D-17); Phase 11 ensures the column is projected through the view boundary so Phase 12 doesn't introduce a new direct `from('polls')` read.
- **`audit_log` consumers (none in v1.2)** — Phase 11 lands the table + writes; no UI surface reads it. Future v1.3+ admin audit-log UI is the next consumer (per existing `Future Requirements` in REQUIREMENTS.md).
- **Migration apply order** — Migration 10 must apply cleanly on top of all 10 existing migrations (00000000000000–00000000000009). Run `supabase db reset` locally to verify before pushing.
- **CI job structure** — new `test:integration` job needs `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_URL` env. Planner picks job placement (parallel to unit, sequential before E2E, or its own gate).

</code_context>

<specifics>
## Specific Ideas

- **audit_log schema baseline (D-02)** — user explicitly confirmed the previewed schema (id / actor_id / action / target_type / target_id / before / after / created_at). Planner refines column types and indexes if needed but should not redesign the field set.
- **Switch UI for Phase 12 toggle** — user picked shadcn `Switch` over the locked-VIS-07 `Button`. Phase 12 also gets the VIS-07 wording update in REQUIREMENTS.md. AlertDialog confirmation status (keep / drop with the Switch UX) is a Phase 12 question.
- **No new dependencies** — Phase 11 introduces zero npm or Deno additions; everything reuses existing surfaces (vitest, supabase-js, _shared helpers).

</specifics>

<deferred>
## Deferred Ideas

- **Admin audit-log UI** — surface `audit_log` rows in the admin dashboard (filter by actor, action, target). Not blocking v1.2; deferred to v1.3+ (already noted in REQUIREMENTS.md `Future Requirements` as `Admin audit log UI`).
- **`audit_log` retention policy** — automatic pruning of rows older than N months. Not a v1.2 concern; revisit when free-tier 500 MB ceiling is in sight.
- **search-admin-targets / get-upload-url audit** — explicitly excluded from Phase 11 retrofit (D-06, read-only EFs). Revisit if security-forensics use case emerges.
- **Audit on auth events (login / 2FA / signOut)** — out of `audit_log` scope; Supabase Auth has its own log surface. If we ever want unified, that's a future cross-cutting phase.
- **VIS-WINDOW window-of-control enum** and **VIS-PUBLIC-MODE pre-vote public visibility** — already deferred in REQUIREMENTS.md `Future Requirements` (v1.3+).
- **DB trigger for `results_hidden_changed_at`** — considered, rejected per D-13 in favor of EF-direct write (matches `closed_at` precedent). Revisit if/when multiple write paths land for `results_hidden` (currently only `toggle-results-visibility` and `create-poll`).

</deferred>

---

*Phase: 11-schema-rls-ef-foundations*
*Context gathered: 2026-05-11*
