import { Link } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuth } from '@/hooks/useAuth'

export function MobileNav() {
  const { isAdmin } = useAuth()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="top">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col px-4 pb-4">
          <SheetClose asChild>
            <Link
              to="/topics"
              preload="intent"
              className="py-3 text-sm text-foreground hover:text-foreground/80 transition-colors"
              activeProps={{ className: 'font-medium' }}
            >
              Topics
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              to="/archive"
              preload="intent"
              className="py-3 text-sm text-foreground hover:text-foreground/80 transition-colors"
              activeProps={{ className: 'font-medium' }}
            >
              Archive
            </Link>
          </SheetClose>
          {isAdmin && (
            // preload={false}: the route is render-guarded by <AdminGuard>
            // (client-side <Navigate>), not by a route beforeLoad. Preloading
            // the admin component chunk on hover wastes bandwidth and exposes
            // the chunk's existence in the network tab. Authorization itself is
            // enforced server-side via RLS + Edge Functions; this flag is a
            // bandwidth/discretion measure, not the boundary.
            <SheetClose asChild>
              <Link
                to="/admin"
                preload={false}
                className="py-3 text-sm text-foreground hover:text-foreground/80 transition-colors"
                activeProps={{ className: 'font-medium' }}
              >
                Admin
              </Link>
            </SheetClose>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
