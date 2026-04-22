/* eslint-disable react-refresh/only-export-components */
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/components/theme-provider'
import { Navbar } from '@/components/layout/Navbar'
import { Toaster } from '@/components/ui/sonner'
import { ConsentChip } from '@/components/ConsentChip'

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
        {/* HI-01 (Phase 5 review): ConsentChip MUST live inside the router
            tree because it calls `useRouterState()`. Previously rendered as
            a sibling of <RouterProvider> in src/main.tsx — that placement
            would crash on first render (TanStack Router's routerContext is
            only propagated to descendants). */}
        <ConsentChip />
      </ThemeProvider>
    </AuthProvider>
  )
}
