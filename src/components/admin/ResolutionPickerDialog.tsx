import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Send, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSetResolution } from '@/hooks/useSetResolution'
import type { Resolution } from '@/hooks/useClosePoll'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pollId: string
  currentResolution: Resolution | null
  onUpdated: () => void
}

const OPTIONS: { value: Resolution; label: string; Icon: LucideIcon }[] = [
  { value: 'addressed', label: 'Addressed', Icon: CheckCircle2 },
  { value: 'forwarded', label: 'Forwarded', Icon: Send },
  { value: 'closed', label: 'Closed', Icon: XCircle },
]

export function ResolutionPickerDialog({
  open,
  onOpenChange,
  pollId,
  currentResolution,
  onUpdated,
}: Props) {
  const { setResolution, submitting } = useSetResolution()
  const [selected, setSelected] = useState<Resolution | null>(currentResolution)
  const prevKey = useRef<string>(`${currentResolution ?? ''}|${open}`)

  useEffect(() => {
    const key = `${currentResolution ?? ''}|${open}`
    if (prevKey.current === key) return
    prevKey.current = key
    const t = setTimeout(() => setSelected(currentResolution), 0)
    return () => clearTimeout(t)
  }, [currentResolution, open])

  const handleSave = async () => {
    if (!selected || selected === currentResolution) return
    const r = await setResolution({ poll_id: pollId, resolution: selected })
    if (r.ok) {
      onOpenChange(false)
      onUpdated()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set resolution status</DialogTitle>
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
            disabled={!selected || selected === currentResolution || submitting}
            onClick={handleSave}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
