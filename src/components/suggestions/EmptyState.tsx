import { SearchX, Inbox, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'

type EmptyStateVariant = 'no-matches' | 'no-active' | 'no-archive'

const VARIANTS: Record<
  EmptyStateVariant,
  { icon: typeof SearchX; heading: string; body: string }
> = {
  'no-matches': {
    icon: SearchX,
    heading: 'No topics match your search',
    body: 'Try a different search term or category.',
  },
  'no-active': {
    icon: Inbox,
    heading: 'No active topics right now.',
    body: 'Topics will appear here when admins post them.',
  },
  'no-archive': {
    icon: Archive,
    heading: 'No archived topics.',
    body: 'Closed topics will appear here with their results.',
  },
}

export function EmptyState({
  variant,
  onClear,
}: {
  variant: EmptyStateVariant
  onClear?: () => void
}) {
  const config = VARIANTS[variant]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Icon className="size-10 text-muted-foreground" />
      <h2 className="text-lg font-medium text-foreground mt-4">
        {config.heading}
      </h2>
      <p className="text-sm text-muted-foreground mt-1">{config.body}</p>
      {variant === 'no-matches' && onClear && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
