import { createContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { handleAuthCallback } from '@/lib/auth-helpers'
import type { Profile } from '@/lib/types/suggestions'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
  signInWithDiscord: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Failed to fetch profile:', error.message)
        setProfile(null)
        return
      }

      // Guard against stale fetches: only set if user ID still matches
      const profileData = data as Profile | null
      setProfile((prev) => {
        if (profileData && profileData.id !== userId) return prev
        return profileData
      })
    } catch (err) {
      console.error('Profile fetch error:', err)
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    // Detect fresh OAuth redirect — tokens in URL hash mean verification is pending.
    // Skip getSession() shortcut so loading stays true until onAuthStateChange
    // completes the 2FA/guild verification. Prevents dashboard flash before error redirect.
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const isOAuthRedirect = hashParams.has('access_token') ||
      new URLSearchParams(window.location.search).has('code')

    if (!isOAuthRedirect) {
      // Normal page load — use cached session
      supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
        if (initialSession?.user) {
          fetchProfile(initialSession.user.id).then(() => setLoading(false))
        } else {
          setLoading(false)
        }
      })
    }
    // OAuth redirect: loading stays true, onAuthStateChange handles everything below

    // Block all state updates while auth verification is in progress.
    // Prevents intermediate events (INITIAL_SESSION, TOKEN_REFRESHED) from
    // setting session state and flashing the dashboard before error redirect.
    const verifyingRef = { current: false }

    // Single auth subscription for the entire app
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // On initial sign-in, verify Discord 2FA before allowing access
        if (event === 'SIGNED_IN' && newSession?.provider_token) {
          verifyingRef.current = true
          const result = await handleAuthCallback()
          verifyingRef.current = false
          if (!result.success) {
            // Redirect immediately — don't update React state, page is navigating away.
            // Changing state would cause a re-render that briefly flashes the login screen.
            window.location.href = `/auth/error?reason=${result.reason}`
            return
          }
        }

        // Don't update state while verification is in progress
        if (verifyingRef.current) return

        setSession(newSession)
        setUser(newSession?.user ?? null)
        if (newSession?.user) {
          fetchProfile(newSession.user.id).then(() => setLoading(false))
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
  }, [])

  const signInWithDiscord = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: window.location.origin,
        scopes: 'identify email guilds',
      },
    })
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        isAdmin: profile?.is_admin ?? false,
        signOut,
        signInWithDiscord,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// useAuth hook lives in src/hooks/useAuth.ts to satisfy react-refresh/only-export-components
export { AuthContext }
export type { AuthState }
