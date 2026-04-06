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

export function MobileNav() {
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
              className="py-3 text-sm text-foreground hover:text-foreground/80 transition-colors"
              activeProps={{ className: 'font-medium' }}
            >
              Topics
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              to="/archive"
              className="py-3 text-sm text-foreground hover:text-foreground/80 transition-colors"
              activeProps={{ className: 'font-medium' }}
            >
              Archive
            </Link>
          </SheetClose>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
