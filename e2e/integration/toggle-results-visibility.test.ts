// TEST-12 — toggle-results-visibility Edge Function authorization + audit.
//
// Asserts the admin-only EF's contract:
//   * Non-admin callers get 403 (gated by requireAdmin in _shared/admin-auth.ts).
//   * Admin callers get 200 with the updated poll row and a non-null
//     results_hidden_changed_at timestamp (the EF writes that timestamp on
//     every state-changing UPDATE).
//   * An audit_log row is written on every state-changing call.
//   * No audit_log row is written when before === after (idempotency —
//     the conditional UPDATE matches 0 rows; the EF returns the current
//     row via a follow-up SELECT and emits no audit).
//   * Malformed bodies and non-existent polls return 400/404 deterministically.
//
// Each `it` block creates its own fresh poll via beforeEach + cleans up
// audit_log + polls via afterEach so cases are independent of execution
// order.

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import {
  mintClients,
  createFreshPoll,
  invokeEF,
  readAuditLog,
  cleanupPoll,
  type IntegrationClients,
} from './helpers'
import { fixtureUsers } from '../fixtures/test-users'

describe('toggle-results-visibility (TEST-12)', () => {
  // Clients are stateless after mint — mint once, share across cases.
  let memberClients: IntegrationClients
  let adminClients: IntegrationClients

  // Per-case state: a fresh poll for every it().
  let pollId: string

  beforeAll(async () => {
    memberClients = await mintClients({ authAs: 'memberUser' })
    adminClients = await mintClients({ authAs: 'adminUser' })
  })

  beforeEach(async () => {
    // seedBaseline=false: TEST-12 asserts on `results_hidden_toggled`
    // rows; baseline-vote rows would not collide but they add cleanup
    // noise (votes table) without buying any coverage for this suite.
    const poll = await createFreshPoll({
      hidden: false,
      suiteSlug: 'test-12',
      seedBaseline: false,
    })
    pollId = poll.id
  })

  afterEach(async () => {
    // audit_log has no FK to polls.id (migration 10), so cascade does not
    // clean these — DELETE them explicitly before dropping the poll.
    await adminClients.serviceRole.from('audit_log').delete().eq('target_id', pollId)
    await cleanupPoll({ serviceRole: adminClients.serviceRole, pollId })
  })

  it('non-admin caller returns 403', async () => {
    const result = await invokeEF({
      client: memberClients.authed,
      name: 'toggle-results-visibility',
      body: { poll_id: pollId, hidden: true },
    })
    expect(result.status).toBe(403)

    // Hard-stop assertion: the poll's results_hidden must NOT have
    // flipped. A passing 403 with a side effect would be a partial-execute
    // bug masked by the status assertion alone.
    const { data: pollRow } = await adminClients.serviceRole
      .from('polls')
      .select('results_hidden')
      .eq('id', pollId)
      .single()
    expect(pollRow!.results_hidden).toBe(false)

    // No audit row written for the failed authz attempt.
    const rows = await readAuditLog({
      serviceRole: adminClients.serviceRole,
      targetId: pollId,
      action: 'results_hidden_toggled',
    })
    expect(rows).toHaveLength(0)
  })

  it('admin caller returns 200 with updated poll row + non-null results_hidden_changed_at', async () => {
    const result = await invokeEF({
      client: adminClients.authed,
      name: 'toggle-results-visibility',
      body: { poll_id: pollId, hidden: true },
    })
    expect(result.status).toBe(200)
    const data = result.data as {
      poll: { id: string; results_hidden: boolean; results_hidden_changed_at: string }
    }
    expect(data.poll.id).toBe(pollId)
    expect(data.poll.results_hidden).toBe(true)
    expect(data.poll.results_hidden_changed_at).not.toBeNull()
    // Parseable ISO timestamp within the last 10 seconds. PostgREST emits the
    // timezone as `+00:00` and `Date.toISOString()` emits `Z`; both are UTC,
    // but a byte-equality round-trip would falsely fail on that cosmetic
    // difference. Assert the SAME-INSTANT property instead.
    const ts = new Date(data.poll.results_hidden_changed_at).getTime()
    expect(Number.isFinite(ts)).toBe(true)
    expect(ts).toBeGreaterThan(Date.now() - 10_000)
    expect(ts).toBeLessThanOrEqual(Date.now() + 1_000)
  })

  it('audit_log row written on state change', async () => {
    await invokeEF({
      client: adminClients.authed,
      name: 'toggle-results-visibility',
      body: { poll_id: pollId, hidden: true },
    })
    const rows = await readAuditLog({
      serviceRole: adminClients.serviceRole,
      targetId: pollId,
      action: 'results_hidden_toggled',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].actor_id).toBe(fixtureUsers.adminUser.id)
    expect(rows[0].action).toBe('results_hidden_toggled')
    expect(rows[0].target_type).toBe('poll')
    expect(rows[0].target_id).toBe(pollId)
    expect(rows[0].before).toEqual({ results_hidden: false })
    expect(rows[0].after).toEqual({ results_hidden: true })
  })

  it('no audit_log row on no-op call (idempotency, D-11)', async () => {
    // Direct UPDATE bypasses the EF audit path, so the case can later
    // assert "no audit row" cleanly without baseline noise from the EF
    // itself having written one earlier in the test.
    await adminClients.serviceRole
      .from('polls')
      .update({ results_hidden: true, results_hidden_changed_at: new Date().toISOString() })
      .eq('id', pollId)

    const result = await invokeEF({
      client: adminClients.authed,
      name: 'toggle-results-visibility',
      body: { poll_id: pollId, hidden: true },
    })
    // Idempotent — no 409 on same-state input.
    expect(result.status).toBe(200)

    // Conditional UPDATE matched 0 rows; no audit row was emitted.
    const rows = await readAuditLog({
      serviceRole: adminClients.serviceRole,
      targetId: pollId,
      action: 'results_hidden_toggled',
    })
    expect(rows).toHaveLength(0)
  })

  it('invalid body — missing poll_id returns 400', async () => {
    const result = await invokeEF({
      client: adminClients.authed,
      name: 'toggle-results-visibility',
      body: { hidden: true },
    })
    expect(result.status).toBe(400)
  })

  it('invalid UUID for poll_id returns 400', async () => {
    const result = await invokeEF({
      client: adminClients.authed,
      name: 'toggle-results-visibility',
      body: { poll_id: 'not-a-uuid', hidden: true },
    })
    expect(result.status).toBe(400)
  })

  it('404 for non-existent poll', async () => {
    const result = await invokeEF({
      client: adminClients.authed,
      name: 'toggle-results-visibility',
      body: { poll_id: '00000000-0000-0000-0000-000000000000', hidden: true },
    })
    expect(result.status).toBe(404)
  })
})
