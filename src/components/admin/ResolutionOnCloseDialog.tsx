import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useClosePoll, type Resolution } from '@/hooks/useClosePoll'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pollId: string
  onClosed: () => void
}

const OPTIONS: { value: Resolution; label: string }[] = [
  { value: 'addressed', label: 'Addressed' },
  { value: 'forwarded', label: 'Forwarded' },
  { value: 'closed', label: 'Closed' },
]

export function ResolutionOnCloseDialog({ open, onOpenChange, pollId, onClosed }: Props) {
  const { closePoll, submitting } = useClosePoll()
  const [selected, setSelected] = useState<Resolution | null>(null)

  const handleClose = async () => {
    if (!selected) return
    const r = await closePoll({ poll_id: pollId, resolution: selected })
    if (r.ok) {
      onOpenChange(false)
      setSelected(null)
      onClosed()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close this suggestion?</DialogTitle>
          <DialogDescription>
            Pick the resolution that best describes how this suggestion was handled. This closes
            voting immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={selected === opt.value ? 'default' : 'outline'}
              onClick={() => setSelected(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!selected || submitting}
            onClick={handleClose}
          >
            Close suggestion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
