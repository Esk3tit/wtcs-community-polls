// TEST-11 — vote_counts RLS 12-cell invariant matrix.
//
// Enforces that the SELECT policy on `vote_counts` admits exactly one
// non-bypass cell: an authenticated voter on a poll with
// results_hidden=false. Every other (role × hidden × voted) combination
// must return zero rows for anon and authenticated callers. Service-role
// bypasses RLS, so all four of its cells return rows.
//
// Why Vitest (not Playwright): RLS invariants need no browser; supabase-js
// against the local stack is the smallest surface that proves the policy
// admits the right rows. Matches the precedent set by
// polls-effective-invariant.test.ts.

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

describe('vote_counts RLS 12-cell matrix (TEST-11)', () => {
  // Module-scope clients minted once. The authed client carries a
  // memberUser JWT; the matrix's `voted` cells insert votes keyed on
  // memberUser.id so auth.uid() matches the votes.user_id row and the
  // voter-EXISTS clause in the policy admits the row.
  let anon: SupabaseClient
  let authed: SupabaseClient
  let serviceRole: SupabaseClient
  let currentPollId: string | null = null

  beforeAll(async () => {
    const clients: IntegrationClients = await mintClients({ authAs: 'memberUser' })
    anon = clients.anon
    authed = clients.authed
    serviceRole = clients.serviceRole
  })

  afterEach(async () => {
    if (currentPollId) {
      await cleanupPoll({ serviceRole, pollId: currentPollId })
      currentPollId = null
    }
  })

  // [role, hidden, voted, expectRows]
  //   role        — which client minted by mintClients()
  //   hidden      — polls.results_hidden value at the time of the SELECT
  //   voted       — whether the SELECTing user has a row in `votes` for the poll
  //   expectRows  — 0 (RLS rejects) or '>0' (RLS admits / service-role bypass)
  //
  // Locked outcomes per the policy: only the (authed, hidden=false, voted)
  // cell returns rows on the non-bypass path; service-role returns rows in
  // every cell because it bypasses RLS entirely. Service-role cells observe
  // the baseline `vote_counts` row that `createFreshPoll` seeds via
  // `seedBaselineVote` (adminUser's vote on option-a) — without that seed
  // the four service-role cells would silently return 0 rows from an empty
  // vote_counts source.
  const cases = [
    ['anon',        false, false, 0],
    ['anon',        false, true,  0],
    ['anon',        true,  false, 0],
    ['anon',        true,  true,  0],
    ['authed',      false, false, 0],
    ['authed',      false, true,  '>0'],
    ['authed',      true,  false, 0],
    ['authed',      true,  true,  0],
    ['serviceRole', false, false, '>0'],
    ['serviceRole', false, true,  '>0'],
    ['serviceRole', true,  false, '>0'],
    ['serviceRole', true,  true,  '>0'],
  ] as const

  describe.each(cases)('%s × hidden=%s × voted=%s', (role, hidden, voted, expected) => {
    it(`returns ${expected} rows`, async () => {
      const poll = await createFreshPoll({
        hidden,
        suiteSlug: `rls-${role}`,
        seedBaseline: true,
      })
      currentPollId = poll.id

      if (voted) {
        // Insert a memberUser-keyed vote on option-b (not option-a — that's
        // the baseline seed slot from createFreshPoll). userId is the
        // memberUser fixture so the authed client's auth.uid() matches
        // votes.user_id and the voter-EXISTS clause in the policy admits
        // the row for the authed-voted cells.
        await castVote({
          pollId: poll.id,
          userId: fixtureUsers.memberUser.id,
          choiceId: poll.choiceIds[1],
          serviceRole,
        })
      }

      const client: SupabaseClient =
        role === 'anon' ? anon : role === 'authed' ? authed : serviceRole

      const { data, error } = await client
        .from('vote_counts')
        .select('*')
        .eq('poll_id', poll.id)

      // RLS denies via "returns no rows", not via error. A real error here
      // is a schema/availability problem — surface it loudly.
      if (error) throw error

      if (expected === 0) {
        expect(data ?? []).toHaveLength(0)
      } else {
        expect((data ?? []).length).toBeGreaterThan(0)
      }
    })
  })

  // Regression sentinel: the vote_counts policy must NOT carry an
  // admin-OR-bypass. Seed a vote_counts row keyed on memberUser.id, then
  // read via an admin JWT. The voter-EXISTS clause matches
  // `votes.user_id = auth.uid()` — auth.uid() is adminUser.id and no votes
  // row exists for them on this poll, so the clause is false and the read
  // returns 0 rows. If a regression re-introduces
  // `is_current_user_admin() OR ...`, admin would see memberUser's row and
  // this assertion fails. seedBaseline=false here is deliberate AND paired
  // with an explicit castVote keyed on memberUser — without that pairing
  // vote_counts would be empty and the assertion would pass trivially
  // (false negative).
  it('admin JWT direct-read of vote_counts is gated by the same voter+hidden rule (no admin-OR-bypass)', async () => {
    const adminClients = await mintClients({ authAs: 'adminUser' })
    const poll = await createFreshPoll({
      hidden: false,
      suiteSlug: 'admin-jwt-sentinel',
      seedBaseline: false,
    })
    currentPollId = poll.id

    await castVote({
      pollId: poll.id,
      userId: fixtureUsers.memberUser.id,
      choiceId: poll.choiceIds[0],
      serviceRole: adminClients.serviceRole,
    })

    const { data, error } = await adminClients.authed
      .from('vote_counts')
      .select('*')
      .eq('poll_id', poll.id)

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })
})
