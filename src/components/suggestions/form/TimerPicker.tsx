import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface Props {
  value: string
  onChange: (iso: string) => void
  disabled?: boolean
  error?: string
}

type Mode = '7d' | '14d' | 'custom'

function toLocalInput(iso: string): string {
  try {
    const d = new Date(iso)
    const off = d.getTimezoneOffset() * 60_000
    return new Date(d.getTime() - off).toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

export function TimerPicker({ value, onChange, disabled, error }: Props) {
  const [mode, setMode] = useState<Mode>('7d')

  const setPreset = (m: Mode) => {
    setMode(m)
    if (m === '7d') onChange(new Date(Date.now() + 7 * 86400_000).toISOString())
    else if (m === '14d') onChange(new Date(Date.now() + 14 * 86400_000).toISOString())
  }

  const handleCustom = (local: string) => {
    if (!local) return
    const d = new Date(local)
    if (!isNaN(d.getTime())) onChange(d.toISOString())
  }

  let display = 'No close time set'
  try {
    display = new Date(value).toLocaleString()
  } catch {
    /* noop */
  }

  return (
    <div className="space-y-2">
      <Label>Close timer</Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={mode === '7d' ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          onClick={() => setPreset('7d')}
        >
          7 days
        </Button>
        <Button
          type="button"
          variant={mode === '14d' ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          onClick={() => setPreset('14d')}
        >
          14 days
        </Button>
        <Button
          type="button"
          variant={mode === 'custom' ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          onClick={() => setMode('custom')}
        >
          Custom
        </Button>
      </div>
      {mode === 'custom' && (
        <input
          type="datetime-local"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          disabled={disabled}
          value={toLocalInput(value)}
          onChange={(e) => handleCustom(e.target.value)}
        />
      )}
      <p className="text-xs text-muted-foreground">Will close {display}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
