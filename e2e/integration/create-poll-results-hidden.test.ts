// create-poll EF `results_hidden` path end-to-end coverage.
//
// Locks in four behaviours of the EF:
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

import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import {
  mintClients,
  invokeEF,
  readAuditLog,
  cleanupPoll,
  type IntegrationClients,
} from './helpers'

describe('create-poll results_hidden path', () => {
  let adminClients: IntegrationClients
  let createdPollId: string | null = null

  beforeAll(async () => {
    adminClients = await mintClients({ authAs: 'adminUser' })
  })

  afterEach(async () => {
    // Clear any armed fault row FIRST and unconditionally — a test that threw
    // before its finally ran must not leave a sentinel that blocks cleanup DELETEs
    // on the next test. Scope the wipe to THIS suite's own title prefix so the
    // cleanup stays title-scoped (the design invariant): a future second file
    // arming its own sentinels with `fileParallelism` re-enabled must not have its
    // rows deleted by a create-poll afterEach firing mid-flight here.
    await adminClients.serviceRole
      .from('test_fault_config')
      .delete()
      .like('fault_title', '[TEST-M5-FAULT-%')
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
    // poll_created records ACTUAL post-insert state (column DEFAULT=false),
    // never user intent. The transition to true is captured by the second
    // row so the timeline reflects realized state, not aspirational state.
    expect(created!.after).toMatchObject({ results_hidden: false })
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

  it('results_hidden=true: UPDATE failure rolls back poll; only poll_created audit row emitted', async () => {
    // Unique title token this test arms against — the trigger matches NEW.title/
    // OLD.title, so concurrent files with different titles are unaffected.
    const faultTitle = `[TEST-M5-FAULT-A] ${Date.now()}-${randomUUID().slice(0, 8)}`
    const startedAt = new Date().toISOString()

    try {
      const { error: armErr } = await adminClients.serviceRole
        .from('test_fault_config')
        .insert({ fault_title: faultTitle, fail_operation: 'update' })
      // Assert the arm landed: a silent INSERT failure (RLS drift, CHECK-constraint
      // change, missing table) leaves the trigger dormant, so create-poll would 200
      // and the 500 assertion below would fail pointing at the EF, not the real cause.
      expect(armErr).toBeNull()

      const result = await invokeEF({
        client: adminClients.authed,
        name: 'create-poll',
        body: buildBody({ title: faultTitle, results_hidden: true }),
      })
      expect(result.status).toBe(500)
    } finally {
      // Disarm even if the assertion above threw — a stuck update-sentinel would
      // block afterEach's cleanupPoll DELETE and poison the rest of the suite.
      await adminClients.serviceRole
        .from('test_fault_config')
        .delete()
        .eq('fault_title', faultTitle)
    }

    // Resolve the poll id AUDIT-ONLY: the poll is ABSENT here after the compensating
    // DELETE, so a polls lookup returns null and would produce a false-green or
    // wrong-row assertion. The poll_created audit row (written BEFORE the UPDATE
    // attempt) carries both the title (after->>'title') and the id (target_id).
    // Filter by title + time window — not "newest poll_created" — to avoid
    // stealing rows from a concurrent file.
    const { data: createdRow, error: auditErr } = await adminClients.serviceRole
      .from('audit_log')
      .select('target_id')
      .eq('action', 'poll_created')
      .eq('after->>title', faultTitle)
      .gte('created_at', startedAt)
      .single()
    // Diagnose a missing poll_created row clearly instead of letting the `!`
    // below throw an opaque "Cannot read properties of null". A missing row means
    // create-poll 500'd before writing the audit row (RPC failure, not post-RPC
    // UPDATE) — surface that, don't mask it as a TypeError.
    expect(auditErr).toBeNull()
    expect(createdRow).not.toBeNull()
    // Fail closed if the audit row exists but target_id is null/empty — otherwise
    // createdPollId would be set to a falsy value, afterEach cleanup would no-op,
    // and the orphaned poll could leak (false pass). create-poll writes target_id
    // = pollId only after the RPC succeeds, so a null here is a real anomaly.
    expect(createdRow!.target_id).toBeTruthy()
    const actualPollId = createdRow!.target_id as string
    // afterEach will delete the audit row and call cleanupPoll using this id.
    createdPollId = actualPollId

    const rows = await readAuditLog({
      serviceRole: adminClients.serviceRole,
      targetId: actualPollId,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('poll_created')
    expect(rows.find((r) => r.action === 'poll_created_orphaned')).toBeUndefined()

    // Compensating DELETE succeeded — poll must NOT exist. The polls table is
    // consulted here ONLY for the absence assertion, never to resolve the id.
    const { data: pollRow } = await adminClients.serviceRole
      .from('polls')
      .select('id')
      .eq('id', actualPollId)
      .maybeSingle()
    expect(pollRow).toBeNull()
  })

  it('results_hidden=true: UPDATE+DELETE failure emits poll_created + poll_created_orphaned', async () => {
    const faultTitle = `[TEST-M5-FAULT-B] ${Date.now()}-${randomUUID().slice(0, 8)}`
    const startedAt = new Date().toISOString()

    try {
      // Arm BOTH operations for this title — UPDATE blocked first, then the
      // compensating DELETE also blocked.
      const { error: armErr } = await adminClients.serviceRole
        .from('test_fault_config')
        .insert([
          { fault_title: faultTitle, fail_operation: 'update' },
          { fault_title: faultTitle, fail_operation: 'delete' },
        ])
      // Both sentinels must land, else the trigger never fires and the 500
      // assertion below would misattribute the failure to the EF.
      expect(armErr).toBeNull()

      const result = await invokeEF({
        client: adminClients.authed,
        name: 'create-poll',
        body: buildBody({ title: faultTitle, results_hidden: true }),
      })
      expect(result.status).toBe(500)
    } finally {
      // Disarm both even if the assertion threw. The delete sentinel MUST be
      // gone before afterEach's cleanupPoll DELETEs the orphaned poll.
      await adminClients.serviceRole
        .from('test_fault_config')
        .delete()
        .eq('fault_title', faultTitle)
    }

    // Audit-only id resolution — same path as branch (a) for symmetry,
    // scoped by title + time window (not "newest").
    const { data: createdRow, error: auditErr } = await adminClients.serviceRole
      .from('audit_log')
      .select('target_id')
      .eq('action', 'poll_created')
      .eq('after->>title', faultTitle)
      .gte('created_at', startedAt)
      .single()
    // A missing poll_created row here would mean the DELETE-failure branch never
    // created the (now orphaned) poll — fail with a clear message rather than an
    // opaque TypeError on the `!` below. When the row IS present, set createdPollId
    // FIRST (before the absence/state assertions further down) so afterEach always
    // cleans up the orphaned poll this branch deliberately leaves behind.
    expect(auditErr).toBeNull()
    expect(createdRow).not.toBeNull()
    // Fail closed if the audit row exists but target_id is null/empty — otherwise
    // createdPollId would be set to a falsy value, afterEach cleanup would no-op,
    // and the orphaned poll could leak (false pass). create-poll writes target_id
    // = pollId only after the RPC succeeds, so a null here is a real anomaly.
    expect(createdRow!.target_id).toBeTruthy()
    const actualPollId = createdRow!.target_id as string
    createdPollId = actualPollId

    const rows = await readAuditLog({
      serviceRole: adminClients.serviceRole,
      targetId: actualPollId,
    })
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.action === 'poll_created')).toBeDefined()
    const orphaned = rows.find((r) => r.action === 'poll_created_orphaned')
    expect(orphaned).toBeDefined()
    expect(orphaned!.after).toMatchObject({
      results_hidden_intended: true,
      results_hidden_actual: false,
      reason: 'compensation_delete_failed',
    })

    // Poll DOES exist — DELETE failed, leaving it orphaned with results_hidden=false.
    // afterEach unconditionally clears test_fault_config, then deletes audit rows
    // and calls cleanupPoll to remove the orphaned poll.
    const { data: pollRow } = await adminClients.serviceRole
      .from('polls')
      .select('results_hidden')
      .eq('id', actualPollId)
      .single()
    expect(pollRow!.results_hidden).toBe(false)
  })
})
