import { Link } from '@tanstack/react-router'
import { Sun, Moon, Monitor, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/components/theme-provider'
import { MobileNav } from '@/components/layout/MobileNav'

export function Navbar() {
  const { user, profile, signOut, signInWithDiscord } = useAuth()
  const { setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-50 bg-card border-b">
      <div className="flex items-center justify-between py-3 px-4 md:px-6 mx-auto max-w-2xl">
        {/* Left: Logo */}
        <Link to="/" className="text-lg font-semibold text-foreground">
          WTCS
        </Link>

        {/* Center: Desktop nav links */}
        {user && (
          <nav className="hidden md:flex items-center gap-4">
            <Link
              to="/topics"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: 'text-foreground' }}
            >
              Topics
            </Link>
            <Link
              to="/archive"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: 'text-foreground' }}
            >
              Archive
            </Link>
          </nav>
        )}

        {/* Right: Theme toggle + User controls */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Toggle color theme">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User controls */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.discord_username}
                      className="rounded-full w-8 h-8"
                    />
                  ) : (
                    <div className="rounded-full w-8 h-8 bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                      {(profile?.discord_username ?? '?')[0].toUpperCase()}
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{profile?.discord_username ?? 'User'}</p>
                </div>
                <DropdownMenuItem variant="destructive" onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={signInWithDiscord}
            >
              Sign in
            </button>
          )}

          {/* Mobile nav */}
          {user && <MobileNav />}
        </div>
      </div>
    </header>
  )
}
