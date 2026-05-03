import { test as base, expect } from '@playwright/test'
import { fixtureUsers } from './test-users'
import { getAdminClient } from '../helpers/auth'

// Per-test mutable poll state. Inserts one poll + two choices before the test
// runs, deletes the poll after (FK cascade on polls.id wipes the choices,
// votes, and vote_counts rows in one statement — verified at the schema level
// in supabase/migrations/00000000000000_schema.sql).
//
// Test-scoped (NOT worker-scoped) on purpose: cross-test contamination
// defeats the per-test isolation goal that motivated this fixture.
//
// Title pattern `[E2E] {sanitized testInfo.title} {Date.now()}` keeps the
// row compatible with the E2E-SCOPE-1 list-locator convention even if a
// future spec accidentally counts un-filtered.
//
// The literal `description: 'freshPoll fixture row'` is a deterministic
// leak-detection marker — verification queries target this exact string
// rather than a `[E2E]%` LIKE which would also match static seed rows.
//
// try/catch/finally guards the partial-setup leak window: Playwright's
// fixture runner does NOT auto-invoke teardown if the fixture body throws
// before reaching await provide(...). Without this guard, a polls.insert
// success followed by a choices.insert failure would leak the polls row.
// The catch block captures the test error so the finally block can
// preserve it via AggregateError if cleanup also throws.
//
// is_pinned=true: ensures SuggestionCard initializes isOpen=true so
// CollapsibleContent renders immediately — choice-buttons are in the DOM
// without needing a click-to-expand step. category_id uses the Lineup
// Changes seed category so the card is visible after category filtering.
type PollFixtures = {
  freshPoll: { id: string; title: string }
}

export const test = base.extend<PollFixtures>({
  // Empty destructure required by Playwright's fixture signature; freshPoll
  // has no upstream fixture deps but must accept the deps object positionally.
  // eslint-disable-next-line no-empty-pattern
  freshPoll: async ({}, provide, testInfo) => {
    const admin = getAdminClient()

    // Sanitize testInfo.title for cosmetic readability when it surfaces in
    // the rendered card title. polls.title is TEXT with no length cap so
    // truncation is purely UX. Strip [@grep-tag] annotations first so test
    // names like "[@smoke] user browses..." don't bleed tokens (e.g. "smoke")
    // into the fixture title — those tokens collide with sibling specs that
    // search for them as unique seed identifiers (e.g. filter-search SMOKE).
    const slug = testInfo.title
      .replace(/\[@\S+?\]/g, '')
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
    // Append workerIndex to disambiguate parallel workers that could
    // otherwise produce identical titles within the same millisecond.
    // polls.title has no UNIQUE constraint, but the spec's `.filter({
    // hasText: freshPoll.title })` would match BOTH cards and `.first()`
    // becomes non-deterministic. workerIndex is stable per worker
    // process and effectively zero-cost.
    const title = `[E2E] ${slug} ${Date.now()}-${testInfo.workerIndex}`

    const { data, error } = await admin
      .from('polls')
      .insert({
        title,
        description: 'freshPoll fixture row',
        status: 'active',
        is_pinned: true,
        category_id: 'a0000000-0000-0000-0000-000000000001',
        created_by: fixtureUsers.adminUser.id,
        closes_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id, title')
      .single()
    if (error || !data) throw error ?? new Error('freshPoll insert returned no row')

    let testErr: unknown
    let deleteErr: unknown
    try {
      // Two choices so the consuming spec can vote — choices.poll_id has
      // ON DELETE CASCADE so they get cleaned up automatically by the
      // single-statement teardown in the finally block below.
      const { error: choiceErr } = await admin.from('choices').insert([
        { poll_id: data.id, label: 'Yes', sort_order: 1 },
        { poll_id: data.id, label: 'No', sort_order: 2 },
      ])
      if (choiceErr) throw choiceErr

      await provide({ id: data.id, title: data.title })
    } catch (e) {
      // Capture the test error so the finally block can preserve it if
      // cleanup also throws — otherwise the failing test is masked.
      testErr = e
    } finally {
      // Single statement: cascade handles choices, votes, vote_counts.
      const { error: cleanupErr } = await admin.from('polls').delete().eq('id', data.id)
      deleteErr = cleanupErr ?? undefined
    }

    // Re-throw logic runs after finally to satisfy no-unsafe-finally.
    // Preserve both errors so the failing test isn't masked by cleanup churn.
    // Coerce non-Error throws (null, undefined, plain strings) into Error
    // instances so Playwright's reporter renders the failure usefully.
    if (testErr !== undefined && deleteErr !== undefined) {
      throw new AggregateError(
        [normalizeError(testErr), normalizeError(deleteErr)],
        'fixture cleanup failed after test failure',
      )
    }
    if (deleteErr !== undefined) throw normalizeError(deleteErr)
    if (testErr !== undefined) throw normalizeError(testErr)
  },
})

// Coerce arbitrary thrown values (null, undefined, strings, supabase error
// shapes) into Error so the test reporter has a stack/message to render.
function normalizeError(e: unknown): Error {
  return e instanceof Error ? e : new Error(`Non-Error throw: ${String(e)}`)
}

export { expect }
