import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  error?: string
}

const YESNO_PRESET = ['Yes', 'No']
const FOUR_PRESET = ['Option 1', 'Option 2', 'Option 3', 'Option 4']

export function ChoicesEditor({ value, onChange, disabled, error }: Props) {
  const [pendingPreset, setPendingPreset] = useState<string[] | null>(null)

  const applyPreset = (preset: string[]) => {
    const hasContent = value.some((c) => (c ?? '').trim().length > 0)
    if (hasContent) {
      setPendingPreset(preset)
    } else {
      onChange(preset)
    }
  }

  const confirmPreset = () => {
    if (pendingPreset) onChange(pendingPreset)
    setPendingPreset(null)
  }

  const updateChoice = (i: number, next: string) => {
    const copy = [...value]
    copy[i] = next
    onChange(copy)
  }

  const addChoice = () => {
    if (value.length >= 10) return
    onChange([...value, ''])
  }

  const removeChoice = (i: number) => {
    if (value.length <= 2) return
    const copy = [...value]
    copy.splice(i, 1)
    onChange(copy)
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Choices</Label>
        <p className="text-xs text-muted-foreground mt-1">
          How should people respond? Minimum 2, maximum 10.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => applyPreset(YESNO_PRESET)}
        >
          Yes/No
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => applyPreset(FOUR_PRESET)}
        >
          4-choice preset
        </Button>
      </div>
      <div className="space-y-2">
        {value.map((choice, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              aria-label={`Choice ${i + 1}`}
              value={choice}
              onChange={(e) => updateChoice(i, e.target.value)}
              disabled={disabled}
              placeholder={`Choice ${i + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove choice ${i + 1}`}
              disabled={disabled || value.length <= 2}
              onClick={() => removeChoice(i)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={disabled || value.length >= 10}
        onClick={addChoice}
      >
        <Plus className="h-4 w-4 mr-1" /> Add choice
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <Dialog open={pendingPreset !== null} onOpenChange={(o) => !o && setPendingPreset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace existing choices?</DialogTitle>
            <DialogDescription>
              Using this preset will clear your current choices. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingPreset(null)}>
              Cancel
            </Button>
            <Button onClick={confirmPreset}>Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
