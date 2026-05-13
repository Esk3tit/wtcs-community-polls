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
