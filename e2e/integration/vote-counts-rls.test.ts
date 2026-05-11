// TEST-11 — vote_counts RLS 12-cell invariant matrix.
//
// Enforces that the SELECT policy on `vote_counts` admits exactly one
// non-bypass cell: an authenticated voter on a poll with
// results_hidden=false. Every other (role × hidden × voted) combination
// must return zero rows for anon and authenticated callers. Service-role
// bypasses RLS, so all four of its cells return rows.
//
// This file is a scaffold — bodies are it.todo placeholders. The matrix
// shape and expected outcomes are locked here so the test names show up
// in CI summaries as soon as the integration runner is wired; bodies are
// filled in by the wave that introduces the schema changes the assertions
// depend on.
//
// Why Vitest (not Playwright): RLS invariants need no browser; supabase-js
// against the local stack is the smallest surface that proves the policy
// admits the right rows. Matches the precedent set by
// polls-effective-invariant.test.ts.

import { describe, it } from 'vitest'

describe('vote_counts RLS 12-cell matrix (TEST-11)', () => {
  // [role, hidden, voted, expectRows]
  //   role        — which client minted by mintClients()
  //   hidden      — polls.results_hidden value at the time of the SELECT
  //   voted       — whether the SELECTing user has a row in `votes` for the poll
  //   expectRows  — 0 (RLS rejects) or '>0' (RLS admits / service-role bypass)
  //
  // Locked outcomes per the policy: only the (authed, hidden=false, voted)
  // cell returns rows on the non-bypass path; service-role returns rows in
  // every cell because it bypasses RLS entirely.
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

  describe.each(cases)('%s × hidden=%s × voted=%s', (_role, _hidden, _voted, expected) => {
    it.todo(`returns ${expected} rows`)
  })
})
