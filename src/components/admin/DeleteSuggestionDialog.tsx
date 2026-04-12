import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDeletePoll } from '@/hooks/useDeletePoll'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pollId: string
  onDeleted: () => void
}

export function DeleteSuggestionDialog({ open, onOpenChange, pollId, onDeleted }: Props) {
  const { deletePoll, submitting } = useDeletePoll()

  const handleDelete = async () => {
    const r = await deletePoll({ poll_id: pollId })
    if (r.ok) {
      onOpenChange(false)
      onDeleted()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this suggestion?</DialogTitle>
          <DialogDescription>
            This permanently removes the suggestion and all of its choices. This cannot be
            undone. Suggestions with responses cannot be deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={submitting} onClick={handleDelete}>
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
