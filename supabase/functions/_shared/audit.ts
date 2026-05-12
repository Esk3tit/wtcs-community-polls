import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'

export type AuditEntry = {
  actor_id: string | null
  action: string
  target_type: string
  target_id: string | null
  before: unknown
  after: unknown
}

/**
 * Append-only audit row writer used by every admin-action Edge Function.
 *
 * Contract: NEVER throws. On audit_log INSERT failure, logs the entry and
 * the underlying error to console.error and returns. Callers MUST NOT wrap
 * this in try/catch — audit-write failures must never fail a user-facing
 * mutation that already succeeded. Failing-open is a deliberate trade: a
 * dropped audit row is recoverable from Function Logs; a 500 on a real
 * state change is not.
 */
export async function writeAudit(
  supabaseAdmin: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_log').insert({
    actor_id: entry.actor_id,
    action: entry.action,
    target_type: entry.target_type,
    target_id: entry.target_id,
    before: entry.before,
    after: entry.after,
  })
  if (error) {
    console.error('audit_log INSERT failed:', { entry, error })
  }
}
