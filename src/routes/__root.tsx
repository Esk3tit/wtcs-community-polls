/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/components/theme-provider'
import { Navbar } from '@/components/layout/Navbar'
import { Toaster } from '@/components/ui/sonner'
import { ConsentBanner } from '@/components/ConsentBanner'
import { ConsentChip } from '@/components/ConsentChip'

// Lazy-loaded but NOT DEV-gated at the import level — the overlay must be
// reachable on production for an explicitly-toggled browser (the auth bug
// only reproduces against the live site, not local dev or incognito).
// Render gating happens below via the activation predicate combining the
// DEV flag with a localStorage opt-in.
const DebugAuthOverlay = lazy(() => import('@/components/debug/DebugAuthOverlay'))

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="system" storageKey="wtcs-ui-theme">
        <div className="min-h-svh bg-background">
          <Navbar />
          <main className="mx-auto max-w-2xl px-4 pt-4 md:px-6 md:pt-6">
            <Outlet />
          </main>
        </div>
        <Toaster />
        {/* ConsentChip MUST live inside the router tree because it calls
            `useRouterState()`. Rendering it as a sibling of <RouterProvider>
            crashes on first render — TanStack Router's routerContext is only
            propagated to descendants. */}
        <ConsentBanner />
        <ConsentChip />
        {typeof window !== 'undefined' &&
          (window.localStorage.getItem('wtcs_debug_auth') === '1' ||
            import.meta.env.DEV) &&
          new URLSearchParams(window.location.search).get('debug') === 'auth' && (
          <Suspense fallback={null}>
            <DebugAuthOverlay />
          </Suspense>
        )}
      </ThemeProvider>
    </AuthProvider>
  )
}
