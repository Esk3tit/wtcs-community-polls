import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCategories } from '@/hooks/useCategories'
import { useCategoryMutations } from '@/hooks/useCategoryMutations'

interface Props {
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}

const NONE_VALUE = '__none__'
const CREATE_VALUE = '__create__'

export function CategoryPicker({ value, onChange, disabled }: Props) {
  const { categories, refetch } = useCategories()
  const { create, submitting } = useCategoryMutations()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const handleValueChange = (v: string) => {
    if (v === CREATE_VALUE) {
      setDialogOpen(true)
      return
    }
    if (v === NONE_VALUE) onChange(null)
    else onChange(v)
  }

  const handleCreate = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    const r = await create(trimmed)
    if (r.ok && r.category) {
      setDialogOpen(false)
      setNewName('')
      await refetch()
      onChange(r.category.id)
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">Category</h3>
      <Select value={value ?? NONE_VALUE} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Select a category…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>Uncategorized</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
          <SelectItem value={CREATE_VALUE}>+ Create new category…</SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new category</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-category-name">Category name</Label>
            <Input
              id="new-category-name"
              autoFocus
              placeholder="e.g. Balance, Maps, Lineups"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting || !newName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
