// TEST-12 — toggle-results-visibility Edge Function authorization + audit.
//
// Asserts the admin-only EF's contract:
//   * Non-admin callers get 403 (gated by requireAdmin in _shared/admin-auth.ts).
//   * Admin callers get 200 with the updated poll row and a non-null
//     results_hidden_changed_at timestamp (the EF writes that timestamp on
//     every UPDATE, not just on state-changing ones — same pattern as
//     close-poll's closed_at write).
//   * An audit_log row is written on every state-changing call.
//   * No audit_log row is written when before === after (idempotency —
//     the EF UPDATEs the row but skips the audit emission).
//
// Scaffold only — it.todo placeholders. Bodies will be wired against
// ./helpers.ts (mintClients, createFreshPoll, invokeEF, readAuditLog,
// cleanupPoll) once the EF + audit_log table land.

import { describe, it } from 'vitest'

describe('toggle-results-visibility (TEST-12)', () => {
  it.todo('non-admin caller returns 403')
  it.todo('admin caller returns 200 with updated poll row + non-null results_hidden_changed_at')
  it.todo('audit_log row written on state change')
  it.todo('no audit_log row on no-op call (idempotency, D-11)')
})
