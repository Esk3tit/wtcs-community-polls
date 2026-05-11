// REVIEW-FIX-M5 — create-poll EF `results_hidden` path end-to-end coverage.
//
// Runtime evidence for Plan 11-03b's extensions to create-poll:
//   * results_hidden=true persists via post-RPC UPDATE and emits 2 audit
//     rows (poll_created + results_hidden_set_at_create).
//   * results_hidden=false skips the UPDATE and emits 1 audit row.
//   * Omitted results_hidden falls through to the column DEFAULT (false).
//   * Non-boolean results_hidden (e.g., the string 'true') is rejected
//     with HTTP 400 — strict-boolean validation, no coercion.
//
// The live create-poll EF returns `{ success: true, id: pollId }` on
// success; tests verify the resulting polls row via a service-role SELECT
// because the response does NOT carry the row. The `choices` field is a
// plain `string[]` per the live RPC contract — NOT `{ text }[]`.

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import {
  mintClients,
  invokeEF,
  readAuditLog,
  cleanupPoll,
  type IntegrationClients,
} from './helpers'

describe('create-poll results_hidden path (REVIEW-FIX-M5)', () => {
  let adminClients: IntegrationClients
  let createdPollId: string | null = null

  beforeAll(async () => {
    adminClients = await mintClients({ authAs: 'adminUser' })
  })

  afterEach(async () => {
    if (createdPollId) {
      // audit_log has no FK to polls.id; DELETE explicitly before cleanupPoll.
      await adminClients.serviceRole.from('audit_log').delete().eq('target_id', createdPollId)
      await cleanupPoll({ serviceRole: adminClients.serviceRole, pollId: createdPollId })
      createdPollId = null
    }
  })

  // Build a valid create-poll body. `choices` is a string[] per the live
  // RPC contract (supabase/functions/create-poll/index.ts:88-97). The
  // imagined `{ text: string }[]` shape from earlier review cycles would
  // fail at runtime — locked here so any future regression on the contract
  // surface trips immediately.
  const buildBody = (extra: Record<string, unknown>) => ({
    title: `[TEST-M5] ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: 'integration test',
    category_id: 'a0000000-0000-0000-0000-000000000001',
    choices: ['option-a', 'option-b'],
    closes_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...extra,
  })

  it('create-poll with results_hidden=true emits poll_created + results_hidden_set_at_create audit rows', async () => {
    const result = await invokeEF({
      client: adminClients.authed,
      name: 'create-poll',
      body: buildBody({ results_hidden: true }),
    })
    expect(result.status).toBe(200)
    expect((result.data as { success: boolean }).success).toBe(true)
    const newPollId = (result.data as { id: string }).id
    expect(typeof newPollId).toBe('string')
    createdPollId = newPollId

    // Verify results_hidden persisted via service-role SELECT (response
    // does not carry the row).
    const { data: pollRow, error: selErr } = await adminClients.serviceRole
      .from('polls')
      .select('results_hidden, results_hidden_changed_at')
      .eq('id', newPollId)
      .single()
    expect(selErr).toBeNull()
    expect(pollRow!.results_hidden).toBe(true)
    expect(pollRow!.results_hidden_changed_at).not.toBeNull()

    // Exactly two audit rows: poll_created + results_hidden_set_at_create.
    const rows = await readAuditLog({
      serviceRole: adminClients.serviceRole,
      targetId: newPollId,
    })
    expect(rows).toHaveLength(2)
    const created = rows.find((r) => r.action === 'poll_created')
    const setHidden = rows.find((r) => r.action === 'results_hidden_set_at_create')
    expect(created).toBeDefined()
    expect(setHidden).toBeDefined()
    expect(created!.after).toMatchObject({ results_hidden: true })
    expect(setHidden!.after).toEqual({ results_hidden: true })
  })

  it('create-poll with results_hidden=false emits only poll_created audit row', async () => {
    const result = await invokeEF({
      client: adminClients.authed,
      name: 'create-poll',
      body: buildBody({ results_hidden: false }),
    })
    expect(result.status).toBe(200)
    const newPollId = (result.data as { id: string }).id
    createdPollId = newPollId

    const { data: pollRow } = await adminClients.serviceRole
      .from('polls')
      .select('results_hidden')
      .eq('id', newPollId)
      .single()
    expect(pollRow!.results_hidden).toBe(false)

    const rows = await readAuditLog({
      serviceRole: adminClients.serviceRole,
      targetId: newPollId,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('poll_created')
    expect(rows[0].after).toMatchObject({ results_hidden: false })
  })

  it('create-poll with results_hidden omitted uses column DEFAULT (false)', async () => {
    const result = await invokeEF({
      client: adminClients.authed,
      name: 'create-poll',
      body: buildBody({}),
    })
    expect(result.status).toBe(200)
    const newPollId = (result.data as { id: string }).id
    createdPollId = newPollId

    const { data: pollRow } = await adminClients.serviceRole
      .from('polls')
      .select('results_hidden')
      .eq('id', newPollId)
      .single()
    expect(pollRow!.results_hidden).toBe(false)

    const rows = await readAuditLog({
      serviceRole: adminClients.serviceRole,
      targetId: newPollId,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('poll_created')
  })

  it('create-poll with results_hidden as string returns 400', async () => {
    const result = await invokeEF({
      client: adminClients.authed,
      name: 'create-poll',
      body: buildBody({ results_hidden: 'true' }),
    })
    expect(result.status).toBe(400)
  })

  // REVIEW-FIX-H5 sanity (manual fault-injection deferred): if the
  // post-RPC UPDATE fails when results_hidden=true, the compensating
  // DELETE means NO poll row appears in `polls` AND NO audit rows are
  // written. Asserting this requires injecting an UPDATE failure
  // (network drop, RLS reject, etc.) which is out of scope here —
  // flagged in the SUMMARY for the deploy-gate plan.
})
