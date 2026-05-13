import type { Resolution } from '@/hooks/useClosePoll'

// Shared narrowing for `suggestion.resolution` (typed `string | null` at the
// DB layer but constrained to `Resolution` in app code). Centralized so admin
// and voter surfaces classify unknown future enum values identically: unknown
// raws collapse to `null` rather than lying through an `as` cast.
const VALID_RESOLUTIONS: Resolution[] = ['addressed', 'forwarded', 'closed']

export function normalizeResolution(raw: string | null): Resolution | null {
  if (raw === null) return null
  return VALID_RESOLUTIONS.includes(raw as Resolution) ? (raw as Resolution) : null
}

// Shared narrowing for `suggestion.status`. v1.0 schema constrains the value
// to {'active', 'closed'} but app code reads it as `string`. Unknown future
// statuses (e.g., 'archived', 'draft') default to 'closed' — a read-only
// terminal state — so voting affordances stay safely hidden until app code
// is updated to recognize the new value.
const VALID_POLL_STATUSES = ['active', 'closed'] as const
export type PollStatus = (typeof VALID_POLL_STATUSES)[number]

export function normalizeStatus(raw: string): PollStatus {
  return VALID_POLL_STATUSES.includes(raw as PollStatus) ? (raw as PollStatus) : 'closed'
}
