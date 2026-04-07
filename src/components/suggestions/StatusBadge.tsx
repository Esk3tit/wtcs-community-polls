import { getCategoryColor } from '@/lib/types/suggestions'
import type { ResolutionStatus } from '@/lib/types/suggestions'

const RESOLUTION_STYLES: Record<ResolutionStatus, string> = {
  addressed: 'bg-green-50 text-green-700 dark:bg-green-500/25 dark:text-green-300',
  forwarded: 'bg-amber-50 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300',
  closed: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-500/25 dark:text-neutral-400',
}

export function CategoryBadge({ name, index }: { name: string; index: number }) {
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-md ${getCategoryColor(index)}`}
    >
      {name}
    </span>
  )
}

export function ResolutionBadge({ resolution }: { resolution: ResolutionStatus }) {
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-md ${RESOLUTION_STYLES[resolution]}`}
    >
      {resolution.charAt(0).toUpperCase() + resolution.slice(1)}
    </span>
  )
}
