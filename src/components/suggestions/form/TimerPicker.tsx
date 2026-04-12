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

function formatRelative(iso: string): string {
  try {
    const target = new Date(iso).getTime()
    if (Number.isNaN(target)) return ''
    const diffMs = target - Date.now()
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    const abs = Math.abs(diffMs)
    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour
    if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute')
    if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour')
    return rtf.format(Math.round(diffMs / day), 'day')
  } catch {
    return ''
  }
}

function formatAbsolute(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function inferMode(iso: string): Mode {
  try {
    const ms = new Date(iso).getTime() - Date.now()
    if (Math.abs(ms - 7 * 86400_000) < 60_000) return '7d'
    if (Math.abs(ms - 14 * 86400_000) < 60_000) return '14d'
    return 'custom'
  } catch {
    return '7d'
  }
}

export function TimerPicker({ value, onChange, disabled, error }: Props) {
  const [mode, setMode] = useState<Mode>(() => inferMode(value))

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

  const relative = formatRelative(value)
  const absolute = formatAbsolute(value)
  const display = relative && absolute ? `${relative}, ${absolute}` : absolute || 'No close time set'

  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">Closes at</h3>
      <p className="text-xs text-muted-foreground">
        When should responses stop being accepted?
      </p>
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
        <div className="space-y-1">
          <Label htmlFor="timer-custom">Close date and time</Label>
          <input
            id="timer-custom"
            type="datetime-local"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={disabled}
            value={toLocalInput(value)}
            onChange={(e) => handleCustom(e.target.value)}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">Will close {display}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
