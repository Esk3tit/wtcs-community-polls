import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export function useVoteSubmit(
  addOptimisticVote: (pollId: string, choiceId: string) => void,
  refetchVoteCounts: () => void,
) {
  const [submittingPollId, setSubmittingPollId] = useState<string | null>(null)
  const [submittingChoiceId, setSubmittingChoiceId] = useState<string | null>(null)
  const submittingRef = useRef(false)

  const submitVote = useCallback(async (pollId: string, choiceId: string) => {
    if (submittingRef.current) return // Prevent double-submit (ref-based, race-safe)

    submittingRef.current = true
    setSubmittingPollId(pollId)
    setSubmittingChoiceId(choiceId)

    try {
      const { data, error } = await supabase.functions.invoke('submit-vote', {
        body: { poll_id: pollId, choice_id: choiceId },
      })

      if (error) {
        // Check if body contains specific error
        const body = data as { error?: string } | null
        const message = body?.error ?? 'Could not submit response. Try again.'

        if (message.includes('already responded')) {
          toast.error('You have already responded to this topic.')
        } else {
          toast.error(message)
        }
        return
      }

      // Success: optimistic update + refetch counts
      addOptimisticVote(pollId, choiceId)
      toast.success('Response recorded')

      // Refetch vote counts so results appear immediately
      refetchVoteCounts()
    } catch {
      toast.error('Could not submit response. Try again.')
    } finally {
      submittingRef.current = false
      setSubmittingPollId(null)
      setSubmittingChoiceId(null)
    }
  }, [addOptimisticVote, refetchVoteCounts])

  return { submitVote, submittingPollId, submittingChoiceId }
}
