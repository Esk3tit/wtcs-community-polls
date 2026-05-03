import { getAdminClient } from './helpers/auth'

/**
 * Pre-suite cleanup: delete any orphaned freshPoll fixture rows left over
 * from a prior run whose teardown DELETE failed (transient supabase
 * restart, RLS misconfig, network blip). The fixture body inserts polls
 * with description='freshPoll fixture row' as a deterministic marker so
 * this query targets only fixture-created rows — base seed and additive
 * E2E seed rows carry different descriptions.
 *
 * The cascade on polls.id wipes child choices/votes/vote_counts in one
 * statement (verified at the schema level). If this delete fails the run
 * still proceeds; the fixture's per-test teardown will keep the leak
 * surface bounded and the next run cleans up again.
 */
export default async function globalSetup() {
  // Skip if no service-role key is exported — local non-fixture runs and
  // ad-hoc spec executions should not crash on a missing admin client.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return

  const admin = getAdminClient()
  const { error } = await admin.from('polls').delete().eq('description', 'freshPoll fixture row')
  if (error) {
    // Surface the warning but do not abort the run — the per-test teardown
    // is the primary defense; this is opportunistic recovery only.
    console.warn(
      '[e2e/global-setup] Could not pre-clean freshPoll fixture rows:',
      error.message,
    )
  }
}
