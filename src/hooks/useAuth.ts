import { useContext } from 'react'
import { AuthContext } from '@/contexts/AuthContext'
import type { AuthState } from '@/contexts/AuthContext'

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
