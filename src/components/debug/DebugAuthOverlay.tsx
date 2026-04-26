import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import * as Sentry from '@sentry/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

// UI-SPEC Surface 3 + REVIEWS.md R-01 (PKCE State row).
// Read-only diagnostic panel. Activation gate lives in src/routes/__root.tsx;
// the component itself MUST NOT be the gate. On production the gate is
// satisfied only by an explicit `localStorage.setItem('wtcs_debug_auth','1')`
// per-browser opt-in, set in DevTools and cleared in Task 4 disposition.

interface SessionShape {
  user_id: string | null
  expires_at: number | null
  provider: string | null
  access_token: string | null
  refresh_token: string | null
}

interface PkceState {
  found: boolean
  key: string | null
  preview: string | null
  length: number | null
}

interface ConsoleErrorEntry {
  ts: number
  args: unknown[]
}

function copySection(name: string, value: unknown): void {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  navigator.clipboard
    .writeText(text)
    .then(() => toast(`Copied ${name}`))
    .catch(() =>
      toast('Could not copy. Select and copy manually.', { duration: 4000 }),
    )
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.toTimeString().slice(0, 8)
}

function snapshotPkce(): PkceState {
  if (typeof window === 'undefined') {
    return { found: false, key: null, preview: null, length: null }
  }
  const verifierKey = Object.keys(window.localStorage).find((k) =>
    /^sb-.*-code-verifier$/.test(k),
  )
  if (!verifierKey) {
    return { found: false, key: null, preview: null, length: null }
  }
  const value = window.localStorage.getItem(verifierKey) ?? ''
  return {
    found: true,
    key: verifierKey,
    preview: value.slice(0, 8),
    length: value.length,
  }
}

function snapshotCookies(): string[] {
  if (typeof document === 'undefined') return []
  return document.cookie
    .split('; ')
    .filter((c) => c.startsWith('sb-'))
    .map((c) => {
      const eq = c.indexOf('=')
      if (eq === -1) return c
      const name = c.slice(0, eq)
      const val = c.slice(eq + 1)
      return `${name}=${val.slice(0, 16)}…`
    })
}

function snapshotStorageKeys(): Array<{ key: string; preview: string }> {
  if (typeof window === 'undefined') return []
  return Object.keys(window.localStorage)
    .filter((k) => k.startsWith('sb-'))
    .map((key) => ({
      key,
      preview: (window.localStorage.getItem(key) ?? '').slice(0, 16) + '…',
    }))
}

function snapshotBreadcrumbs(): unknown[] {
  const scope = Sentry.getCurrentScope().getScopeData()
  return (scope.breadcrumbs ?? []).slice(-5).map((b) => ({
    category: b.category,
    message: b.message,
    level: b.level,
    timestamp: b.timestamp,
    data: b.data,
  }))
}

export default function DebugAuthOverlay() {
  const [hidden, setHidden] = useState<boolean>(false)
  const [session, setSession] = useState<SessionShape | null>(null)
  const [pkce] = useState<PkceState>(snapshotPkce)
  const [cookies] = useState<string[]>(snapshotCookies)
  const [storageKeys] = useState<Array<{ key: string; preview: string }>>(snapshotStorageKeys)
  const [breadcrumbs] = useState<unknown[]>(snapshotBreadcrumbs)
  const [consoleErrors, setConsoleErrors] = useState<ConsoleErrorEntry[]>([])
  const [, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession({
        user_id: s?.user?.id ?? null,
        expires_at: s?.expires_at ?? null,
        provider: s?.user?.app_metadata?.provider ?? null,
        access_token: s?.access_token ? s.access_token.slice(0, 8) + '…' : null,
        refresh_token: s?.refresh_token ? s.refresh_token.slice(0, 8) + '…' : null,
      })
    })

    const originalConsoleError = console.error
    console.error = (...args: unknown[]) => {
      const ts = Date.now()
      setConsoleErrors((prev) => [
        ...prev.filter((e) => ts - e.ts < 30000),
        { ts, args },
      ])
      originalConsoleError(...args)
    }

    const tick = window.setInterval(() => setNow(Date.now()), 1000)

    return () => {
      console.error = originalConsoleError
      window.clearInterval(tick)
    }
  }, [])

  if (hidden) return null

  return (
    <div className="fixed bottom-4 left-4 z-40 rounded-xl border bg-card shadow-md p-4 max-w-[min(28rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium">Auth debug</h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          aria-label="Close debug panel"
          onClick={() => setHidden(true)}
        >
          <X className="size-4" />
        </Button>
      </div>

      <section className="mt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium mb-1">Supabase session</h3>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Copy Supabase session"
            onClick={() => copySection('Supabase session', session)}
          >
            Copy
          </Button>
        </div>
        <pre className="font-mono text-xs whitespace-pre-wrap break-all">
          {JSON.stringify(session, null, 2)}
        </pre>
      </section>

      <section className="mt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium mb-1">PKCE State</h3>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Copy PKCE State"
            onClick={() => copySection('PKCE State', pkce)}
          >
            Copy
          </Button>
        </div>
        <p className="font-mono text-xs whitespace-pre-wrap break-all">
          {pkce.found
            ? `Found: ${pkce.key} = ${pkce.preview}… (length=${pkce.length})`
            : 'MISSING — no sb-*-code-verifier key in localStorage. PKCE state lost (RESEARCH.md Pitfall 4 strongest hypothesis).'}
        </p>
      </section>

      <section className="mt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium mb-1">sb-* cookies</h3>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Copy sb-* cookies"
            onClick={() => copySection('sb-* cookies', cookies.join('\n'))}
          >
            Copy
          </Button>
        </div>
        <pre className="font-mono text-xs whitespace-pre-wrap break-all">
          {cookies.length === 0 ? '(none)' : cookies.join('\n')}
        </pre>
      </section>

      <section className="mt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium mb-1">sb-* localStorage</h3>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Copy sb-* localStorage"
            onClick={() =>
              copySection(
                'sb-* localStorage',
                storageKeys.map((s) => `${s.key}=${s.preview}`).join('\n'),
              )
            }
          >
            Copy
          </Button>
        </div>
        <pre className="font-mono text-xs whitespace-pre-wrap break-all">
          {storageKeys.length === 0
            ? '(none)'
            : storageKeys.map((s) => `${s.key}=${s.preview}`).join('\n')}
        </pre>
      </section>

      <section className="mt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium mb-1">Recent Sentry breadcrumbs (last 5)</h3>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Copy Recent Sentry breadcrumbs"
            onClick={() => copySection('Recent Sentry breadcrumbs', breadcrumbs)}
          >
            Copy
          </Button>
        </div>
        <pre className="font-mono text-xs whitespace-pre-wrap break-all">
          {breadcrumbs.length === 0
            ? '(none)'
            : breadcrumbs.map((b) => JSON.stringify(b)).join('\n')}
        </pre>
      </section>

      <section className="mt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium mb-1">Recent console errors (last 30s)</h3>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Copy Recent console errors"
            onClick={() =>
              copySection(
                'Recent console errors',
                consoleErrors
                  .map((e) => `[${formatTimestamp(e.ts)}] ${e.args.map(String).join(' ')}`)
                  .join('\n'),
              )
            }
          >
            Copy
          </Button>
        </div>
        <pre className="font-mono text-xs whitespace-pre-wrap break-all">
          {consoleErrors.length === 0
            ? '(none)'
            : consoleErrors
                .map(
                  (e) => `[${formatTimestamp(e.ts)}] ${e.args.map(String).join(' ')}`,
                )
                .join('\n')}
        </pre>
      </section>
    </div>
  )
}
