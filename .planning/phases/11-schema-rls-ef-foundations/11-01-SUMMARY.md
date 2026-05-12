---
phase: 11-schema-rls-ef-foundations
plan: 01
subsystem: database

tags:
  - migration
  - rls
  - supabase
  - schema
  - audit-log
  - postgres

# Dependency graph
requires:
  - phase: 04-admin-suggestion-mgmt
    provides: polls_effective view (explicit-column form, security_invoker = on); vote_counts admin-bypass policy ("Vote counts visible to voters or admin")
  - phase: 09-admin-integrity-rls (migration 9 within Phase 4 series)
    provides: is_current_user_admin() that enforces is_admin AND mfa_verified AND guild_member
provides:
  - polls.results_hidden boolean column (NOT NULL DEFAULT false)
  - polls.results_hidden_changed_at timestamptz column (NULL until first flip)
  - audit_log table (id, actor_id NULL, action, target_type, target_id TEXT, before JSONB, after JSONB, created_at) + two indexes + admin-only SELECT RLS
  - polls_effective view rewritten to project results_hidden + results_hidden_changed_at, security_invoker = on re-applied in same file
  - vote_counts SELECT policy "Vote counts visible to voters when not hidden" (voter-EXISTS AND results_hidden=false; no admin OR-branch)
affects:
  - 11-02 (toggle-results-visibility EF + audit helper)
  - 11-03 (audit retrofit across 12 admin EFs + create-poll results_hidden support)
  - 11-04 (12-cell vote_counts RLS matrix tests; toggle-results-visibility integration test)
  - 11-05 (BLOCKING: supabase db reset + supabase db push gate)
  - Phase 12 (React read path branches on results_hidden via polls_effective)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic schema migration: column adds + new table + view rewrite + RLS rewrite all in one numbered file (avoids the window where policies reference columns the view does not yet project)"
    - "audit_log.target_id declared TEXT (not uuid) so it admits both UUIDs (profile/poll/category) AND Discord snowflakes (admin_discord_ids.discord_id is TEXT) — locks REVIEW-FIX-C3-H1"
    - "Pitfall 2 enforced: ALTER VIEW … SET (security_invoker = on) re-applied immediately after CREATE OR REPLACE VIEW in the SAME file (Postgres 15+ resets the flag on REPLACE)"
    - "Pitfall 1 enforced: vote_counts policy scoped TO authenticated only; anon returns 0 rows by absence of any granting policy"
    - "Pitfall 6 enforced: audit_log indexes cover (target_type, target_id) + (actor_id, created_at DESC) — NOT before/after JSONB"
    - "REVIEW-FIX-H3 enforced: vote_counts policy has NO is_current_user_admin() OR-branch; service-role bypass (used by all admin EFs) is the only admin read path per VIS-04"

key-files:
  created:
    - supabase/migrations/00000000000010_results_hidden_audit.sql
  modified: []

key-decisions:
  - "Migration 10 written as a single atomic file with four numbered SECTION blocks (per RESEARCH Pattern 1 statement order)"
  - "audit_log.target_id declared TEXT (not uuid) to admit Discord snowflakes — promote-admin Branch 2 audit row would otherwise be silently dropped by writeAudit fail-open contract"
  - "vote_counts SELECT policy omits the is_current_user_admin() OR-branch (REVIEW-FIX-H3); VIS-04 mandates service-role bypass only, not JWT-authenticated admin bypass — admin reads go through service-role-backed EFs"
  - "polls_effective rewritten with explicit column list (not SELECT *) to preserve migration 5 D-12 lazy-close pattern; results_hidden + results_hidden_changed_at appended at end"
  - "security_invoker = on re-applied immediately after the view replace in the same migration file (Pitfall 2)"
  - "audit_log indexes: (target_type, target_id) for per-target lookups + (actor_id, created_at DESC) for per-actor timelines; no JSONB indexes per Pitfall 6"
  - "Rollback documented as a trailing prose comment block (Supabase migrations are forward-only — no down file)"

patterns-established:
  - "Atomic schema migration with section-divider header comments (mirrors migration 5 style)"
  - "RLS policy rewrite: DROP IF EXISTS both legacy names + CREATE new — idempotent against any apply-history state"
  - "View boundary preserves explicit-column projection on every CREATE OR REPLACE (no SELECT *)"
  - "audit_log writes are service-role only — no INSERT/UPDATE/DELETE policies declared so JWT callers are blocked by policy absence"

requirements-completed: [VIS-01, VIS-04, VIS-09]

# Metrics
duration: ~25min
completed: 2026-05-11
---

# Phase 11 Plan 01: Migration 10 — results_hidden + audit_log + vote_counts RLS Summary

**Single atomic migration: polls.results_hidden + results_hidden_changed_at columns, audit_log table (target_id TEXT for Discord-snowflake compat) with admin-only RLS, polls_effective view rewrite (security_invoker = on re-applied), and vote_counts SELECT policy rewrite (voter-EXISTS AND results_hidden=false; no admin OR-branch per VIS-04 + REVIEW-FIX-H3).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-11T22:10:00Z (approximate)
- **Completed:** 2026-05-11T22:35:26Z
- **Tasks:** 1
- **Files created:** 1
- **Files modified:** 0

## Accomplishments

- Migration 10 SQL file lands as a single atomic file at `supabase/migrations/00000000000010_results_hidden_audit.sql` (168 inserted lines)
- Four numbered sections in load-bearing statement order: (1) polls columns, (2) audit_log table + RLS, (3) polls_effective view rewrite, (4) vote_counts policy DROP + CREATE
- `audit_log.target_id` declared TEXT (per REVIEW-FIX-C3-H1) — admits both UUIDs and Discord snowflakes; closes the audit-row-silently-dropped failure mode the writeAudit fail-open contract would otherwise expose on `promote-admin` Branch 2
- vote_counts policy locked to strict voter+hidden AND form with no admin OR-branch (REVIEW-FIX-H3 / VIS-04); the 12-cell matrix in Plan 11-04 will probe this deterministically
- `security_invoker = on` re-applied in the SAME migration file 23 lines after the CREATE OR REPLACE VIEW — Pitfall 2 gate satisfied (Postgres 15+ resets the flag on REPLACE; a split would have run the view definer-rights for one prod window)
- Existing `polls-effective-invariant.test.ts` continues to pass (2/2) — no new `from('polls')` reads in `src/`

## Task Commits

1. **Task 01-01: Migration 10 — column adds + audit_log table + RLS + view rewrite + vote_counts policy** — `c12b55b` (feat)

_Plan metadata commit follows below._

## Files Created/Modified

- `supabase/migrations/00000000000010_results_hidden_audit.sql` (NEW, 168 lines) — atomic migration containing:
  - SECTION 1: `ALTER TABLE public.polls ADD COLUMN results_hidden BOOLEAN NOT NULL DEFAULT FALSE` + `results_hidden_changed_at TIMESTAMPTZ` (NULLABLE) + COMMENT ON COLUMN for both
  - SECTION 2: `CREATE TABLE public.audit_log` (id uuid PK default gen_random_uuid, actor_id uuid FK profiles NULLABLE, action text NOT NULL, target_type text NOT NULL, target_id TEXT, before JSONB, after JSONB, created_at timestamptz NOT NULL DEFAULT now()) + two indexes (`(target_type, target_id)`, `(actor_id, created_at DESC)`) + `ENABLE ROW LEVEL SECURITY` + admin-only SELECT policy gated by `public.is_current_user_admin()` + inline comment documenting no INSERT/UPDATE/DELETE policies
  - SECTION 3: `CREATE OR REPLACE VIEW public.polls_effective` with explicit 17-column list (15 original + 2 new) preserving the migration-5 lazy-close `CASE` expression + `ALTER VIEW … SET (security_invoker = on)` re-applied immediately after + COMMENT ON VIEW
  - SECTION 4: `DROP POLICY IF EXISTS` for both legacy names (`"Vote counts visible to voters"`, `"Vote counts visible to voters or admin"`) + `CREATE POLICY "Vote counts visible to voters when not hidden" ON public.vote_counts FOR SELECT TO authenticated USING (EXISTS voter row AND EXISTS poll row with results_hidden = false)` — no `is_current_user_admin()` OR-branch
  - Trailing prose rollback notes (Supabase forward-only)

## Decisions Made

- **Migration 10 written verbatim per plan body, NOT per PATTERNS.md.** The PATTERNS.md skeleton (lines 89-103) still showed the `public.is_current_user_admin() OR …` form, but the plan body explicitly overrides with REVIEW-FIX-H3 (no admin OR-branch). The plan body wins per gate instructions.
- **Rollback comment block rewritten as plain prose** (not pseudo-SQL with line-leading `CREATE` / `ALTER` keywords) so that future `grep` of executable statements is unambiguous — protects the Pitfall-2 sequencing check from false hits in commented rollback notes.
- **Did NOT run `supabase db reset` or `supabase db push`** per gate instructions — Plan 05 owns the live-apply gate. Local static gates (grep-based AC checks + invariant test) all passed.

## Deviations from Plan

None — plan executed exactly as written. All four sections present in locked order, all wording (policy name, comment text) matches plan body and CONTEXT.md decision references, every acceptance criterion was checked.

## Issues Encountered

None during execution. One minor self-check follow-up: my initial rollback block used line-leading SQL keywords (`CREATE OR REPLACE VIEW`, `ALTER VIEW`) inside `--` comments, which caused secondary `grep`/`awk` runs to report "2 matches" for the view-replace pair. The executable pair is still uniquely at lines 91+114 (delta=23, well within the 30-line Pitfall-2 gate), but to remove the regex-noise risk for downstream readers I rewrote the rollback notes as prose. The functional migration was unchanged by this edit (only comment text shifted).

## Static Verification Evidence

All acceptance criteria checked via grep/awk against the committed file:

| Acceptance Criterion | Check | Result |
|---|---|---|
| `ADD COLUMN results_hidden BOOLEAN NOT NULL DEFAULT FALSE` | `grep -ic` | 1 ✓ |
| `ADD COLUMN results_hidden_changed_at TIMESTAMPTZ` | `grep -ic` | 1 ✓ |
| `actor_id UUID REFERENCES public.profiles(id)` line lacks `NOT NULL` | `grep -nE` | matches at line 46, no NOT NULL ✓ |
| `target_id TEXT` (REVIEW-FIX-C3-H1) | `grep -inE "target_id\\s+text"` | matches at line 49 ✓ |
| `target_id` is NOT declared as `uuid` | `grep -inE "target_id\\s+uuid"` | 0 matches ✓ |
| Two `CREATE INDEX … audit_log` statements | `grep -c` | 2 ✓ |
| No JSONB index on `before`/`after` | `grep -E "CREATE INDEX.*audit_log.*(before\|after)"` | 0 ✓ |
| `ENABLE ROW LEVEL SECURITY` on audit_log | `grep -c` | 1 ✓ |
| Exactly one `CREATE POLICY` for audit_log | manual multi-line scan | 1 ✓ |
| View + ALTER VIEW pair within 30 lines | `awk` | delta=23 ✓ |
| View projects `results_hidden` + `results_hidden_changed_at` | `grep -E "^\\s*results_hidden,?$"` etc. | both present ✓ |
| Both legacy `DROP POLICY IF EXISTS` present | `grep -c` | 1 + 1 ✓ |
| New policy named `Vote counts visible to voters when not hidden` scoped `TO authenticated` | `grep -nA 6` | line 137 + `TO authenticated` at line 140 ✓ |
| USING clause references `polls.results_hidden = false` | `grep -E "polls\\.results_hidden\\s*=\\s*false"` | matches at line 150 ✓ |
| No `TO anon` or `TO public` policy on `vote_counts` (Pitfall 1) | `grep -E "vote_counts.*(TO anon\|TO public)"` | 0 ✓ |
| No review-round / Plan-ID / PR-ID archaeology in comments | `grep -iE "(Round [0-9]\|Plan [0-9]+-[0-9]+\|PR #[0-9]+\|review-round)"` | 0 ✓ |
| REVIEW-FIX-H3 — no `is_current_user_admin` inside the new vote_counts policy block | awk scan policy block | 0 ✓ |
| Existing invariant test passes | `npm run test -- --run polls-effective-invariant.test.ts` | 2/2 PASS ✓ |

**Live-apply evidence (`supabase db reset`):** Deferred to Plan 11-05 BLOCKING task per gate instructions in this plan's prompt. Plan 11-01 executor does NOT run `supabase db reset` or `supabase db push`.

## User Setup Required

None — Plan 11-01 only writes a migration file; no external service configuration required. The live-apply gate is Plan 11-05's responsibility.

## Next Phase Readiness

- **Plan 11-02 (toggle EF + audit helper):** The `audit_log` table and `polls.results_hidden` / `results_hidden_changed_at` columns are defined. The `writeAudit` helper can be implemented against the locked schema. `target_id` is TEXT so the helper can accept either UUID or string identifiers without coercion.
- **Plan 11-03 (12 EF audit retrofit + create-poll `results_hidden` support):** All audit_log columns and the polls columns are present.
- **Plan 11-04 (12-cell vote_counts RLS matrix):** The new policy is in place — the matrix will probe the strict voter+hidden gate with no admin OR-branch.
- **Plan 11-05 (BLOCKING `supabase db reset` gate):** Live-apply confirmation is owed here.
- **Phase 12 (React read path):** `polls_effective.results_hidden` + `polls_effective.results_hidden_changed_at` are projected through the view. Per REVIEW-FIX-M3, `npx supabase gen types typescript --linked > src/lib/database.types.ts` is a Phase 12 Wave 1 prerequisite (intentionally deferred from this phase).

## ROADMAP Discrepancy

ROADMAP SC-1 wording says "all 14 pre-existing migrations continue to pass" but the codebase has only 10 pre-existing migrations (00–09). Plan 11-01 covers all 10 cleanly. Recommend ROADMAP correction during Phase 11 SUMMARY write-up (not in scope for this plan's diff).

## Self-Check: PASSED

- File `supabase/migrations/00000000000010_results_hidden_audit.sql` exists at the recorded path ✓
- Commit `c12b55b` exists in `git log` ✓
- All static acceptance criteria pass (see table above) ✓
- Invariant test passes against post-rewrite migration ✓

---
*Phase: 11-schema-rls-ef-foundations*
*Completed: 2026-05-11*
