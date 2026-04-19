import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// UI-SPEC Contract 2 — Error Boundary Fallback.
// Rendered by Sentry.ErrorBoundary in src/main.tsx. Copy is verbatim;
// no props.error.* is surfaced to the DOM (T-05-07, ASVS V7).
//
// "Report issue" links to the GitHub Issues tracker. Per UI-SPEC this is at
// the executor's discretion; the repo URL is derived from the project name.
const REPORT_ISSUE_URL = 'https://github.com/wtcs-community/wtcs-community-polls/issues'

export function AppErrorFallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="bg-card rounded-xl border p-6 max-w-md w-full">
        <AlertCircle className="size-5 text-muted-foreground mb-3" />
        <h1 className="text-lg font-medium">Something went wrong.</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mt-2">
          The page hit an unexpected error. Reloading usually helps. If this keeps happening, let us know.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={() => window.location.reload()}>Reload page</Button>
          <Button variant="link" asChild>
            <a href={REPORT_ISSUE_URL} target="_blank" rel="noreferrer noopener">
              Report issue
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
