import { useContext } from 'react'
import { ConsentContext } from '@/contexts/ConsentContext'
import type { ConsentContextValue } from '@/contexts/ConsentContext'

export function useConsent(): ConsentContextValue {
  const context = useContext(ConsentContext)
  if (context === undefined) {
    throw new Error('useConsent must be used within a ConsentProvider')
  }
  return context
}
