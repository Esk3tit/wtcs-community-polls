import { useState } from 'react'
import { CheckCircle2, Send, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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

const OPTIONS: { value: Resolution; label: string; Icon: LucideIcon }[] = [
  { value: 'addressed', label: 'Addressed', Icon: CheckCircle2 },
  { value: 'forwarded', label: 'Forwarded', Icon: Send },
  { value: 'closed', label: 'Closed', Icon: XCircle },
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
            Closing will stop accepting new responses. Choose a resolution status — this can be
            changed later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {OPTIONS.map(({ value, label, Icon }) => (
            <Button
              key={value}
              type="button"
              variant={selected === value ? 'default' : 'outline'}
              onClick={() => setSelected(value)}
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
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
