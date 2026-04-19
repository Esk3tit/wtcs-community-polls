import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDemoteAdmin } from '@/hooks/useDemoteAdmin'

type Admin = {
  id: string
  discord_id: string
  discord_username: string
  avatar_url: string | null
}

type Props = {
  admin: Admin
  open: boolean
  onOpenChange: (open: boolean) => void
  onDemoted: () => void
}

export function DemoteAdminDialog({ admin, open, onOpenChange, onDemoted }: Props) {
  const { demote, submitting } = useDemoteAdmin()

  const handleConfirm = async () => {
    const result = await demote(admin.id, admin.discord_username)
    if (result.ok) {
      onOpenChange(false)
      onDemoted()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Demote this admin?</DialogTitle>
          <DialogDescription>
            {admin.discord_username} will lose admin access immediately.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            Demote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
