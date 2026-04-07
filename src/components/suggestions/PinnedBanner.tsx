import { Pin, Clock } from 'lucide-react'
import { formatTimeRemaining } from '@/lib/format'

export function PinnedBanner({ closesAt }: { closesAt: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-2 -mx-5 -mt-5 mb-4 rounded-t-xl bg-amber-50 dark:bg-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-medium">
      <span className="flex items-center gap-1.5">
        <Pin className="size-3.5" />
        Pinned
      </span>
      <span className="flex items-center gap-1.5">
        <Clock className="size-3.5" />
        {formatTimeRemaining(closesAt)}
      </span>
    </div>
  )
}
