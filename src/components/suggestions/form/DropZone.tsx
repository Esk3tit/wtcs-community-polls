// Drag-region (outer div with role="region") and keyboard-Browse entry
// (inner shadcn Button) are split so screen readers don't announce a
// dual-role landing zone — see DESIGN-SYSTEM.md for the accessibility
// rationale.
import { ImagePlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type DropZoneProps = {
  disabled?: boolean
  uploading: boolean
  dragOver: boolean
  onDrop: (file: File) => void
  onBrowseClick: () => void
  onDragStateChange: (over: boolean) => void
}

export function DropZone({
  disabled,
  uploading,
  dragOver,
  onDrop,
  onBrowseClick,
  onDragStateChange,
}: DropZoneProps) {
  const inert = disabled || uploading

  return (
    <div
      role="region"
      aria-label="Image upload"
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (inert) return
        onDragStateChange(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (inert) return
        onDragStateChange(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        // Suppress spurious leave events when the pointer crosses into a
        // child element — without this guard the highlight ring flickers.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        onDragStateChange(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragStateChange(false)
        if (inert) return
        const f = e.dataTransfer?.files?.[0]
        if (f) onDrop(f)
      }}
      className={cn(
        'flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed bg-muted/30 px-4 py-8 text-sm transition-colors',
        dragOver && !uploading && 'bg-muted/60 ring-2 ring-ring',
        inert && 'opacity-60 cursor-not-allowed',
      )}
    >
      {uploading ? (
        <>
          <Loader2
            className="h-6 w-6 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">Uploading…</p>
        </>
      ) : (
        <>
          <ImagePlus
            className="h-8 w-8 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm font-medium">Drop an image here</p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, or WebP · max 2 MB
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onBrowseClick}
            aria-label="Browse files"
            className="mt-2"
          >
            Browse files
          </Button>
        </>
      )}
    </div>
  )
}
