import { useState, useRef, useEffect } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Folder,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase'
import { useCategories } from '@/hooks/useCategories'
import { useCategoryMutations } from '@/hooks/useCategoryMutations'

type DeleteTarget = {
  id: string
  name: string
  affectedCount: number | null
  countError: boolean
}

export function CategoriesList() {
  const { categories, loading, error, refetch } = useCategories()
  const { create, rename, remove, submitting } = useCategoryMutations()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [newRowActive, setNewRowActive] = useState(false)
  const [newRowValue, setNewRowValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const newInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  useEffect(() => {
    if (newRowActive) newInputRef.current?.focus()
  }, [newRowActive])

  // MEDIUM #7: fetch-failure error state (NOT a silent empty list)
  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Couldn't load categories</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>Please try again.</span>
          <Button size="sm" variant="outline" onClick={() => void refetch?.()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const handleStartEdit = (cat: { id: string; name: string }) => {
    setEditingId(cat.id)
    setEditValue(cat.name)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const handleSaveEdit = async (catId: string) => {
    const trimmed = editValue.trim()
    if (!trimmed) return
    const result = await rename(catId, trimmed)
    if (result.ok) {
      handleCancelEdit()
      await refetch?.()
    }
  }

  const handleStartNew = () => {
    setNewRowActive(true)
    setNewRowValue('')
  }

  const handleCancelNew = () => {
    setNewRowActive(false)
    setNewRowValue('')
  }

  const handleSaveNew = async () => {
    const trimmed = newRowValue.trim()
    if (!trimmed) return
    const result = await create(trimmed)
    if (result.ok) {
      handleCancelNew()
      await refetch?.()
    }
  }

  const handleAskDelete = async (cat: { id: string; name: string }) => {
    // LOW fix (D-21): query the REAL affected count BEFORE showing the dialog.
    try {
      const { count, error: countError } = await supabase
        .from('polls')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', cat.id)
      if (countError) {
        console.error('Failed to count affected suggestions:', countError)
        setDeleteTarget({
          id: cat.id,
          name: cat.name,
          affectedCount: null,
          countError: true,
        })
        return
      }
      setDeleteTarget({
        id: cat.id,
        name: cat.name,
        affectedCount: count ?? 0,
        countError: false,
      })
    } catch (err) {
      console.error('Exception during affected-count query:', err)
      setDeleteTarget({
        id: cat.id,
        name: cat.name,
        affectedCount: null,
        countError: true,
      })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const result = await remove(deleteTarget.id, deleteTarget.affectedCount ?? 0)
    if (result.ok) {
      setDeleteTarget(null)
      await refetch?.()
    }
  }

  const showEmpty =
    !loading && !error && categories.length === 0 && !newRowActive

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Categories</h2>
        <Button
          size="sm"
          className="h-9"
          onClick={handleStartNew}
          disabled={newRowActive || submitting}
        >
          <Plus className="h-4 w-4 mr-1" />
          New category
        </Button>
      </div>

      {loading ? (
        <div className="divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[56px] bg-muted/30 animate-pulse"
              data-testid="category-skeleton"
            />
          ))}
        </div>
      ) : showEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Folder className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-lg font-medium text-foreground mt-4">
            No categories yet.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Create one to organize suggestions.
          </p>
          <Button className="mt-4" size="sm" onClick={handleStartNew}>
            <Plus className="h-4 w-4 mr-1" />
            New category
          </Button>
        </div>
      ) : (
        <div className="divide-y border rounded-md">
          {newRowActive && (
            <div className="flex items-center justify-between p-4 min-h-[56px] gap-3">
              <Input
                ref={newInputRef}
                value={newRowValue}
                onChange={(e) => setNewRowValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSaveNew()
                  if (e.key === 'Escape') handleCancelNew()
                }}
                placeholder="New category name"
                className="h-9 text-sm"
              />
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="default"
                  className="h-9 w-9"
                  aria-label="Save new category"
                  onClick={() => void handleSaveNew()}
                  disabled={submitting}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  aria-label="Cancel new category"
                  onClick={handleCancelNew}
                  disabled={submitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          {categories.map((cat) => {
            const isEditing = editingId === cat.id
            return (
              <div
                key={cat.id}
                className="flex items-center justify-between p-4 min-h-[56px] gap-3"
              >
                {isEditing ? (
                  <>
                    <Input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveEdit(cat.id)
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      className="h-9 text-sm"
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="default"
                        className="h-9 w-9"
                        aria-label={`Save ${cat.name}`}
                        onClick={() => void handleSaveEdit(cat.id)}
                        disabled={submitting}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        aria-label={`Cancel ${cat.name}`}
                        onClick={handleCancelEdit}
                        disabled={submitting}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium">{cat.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        aria-label={`Edit category ${cat.name}`}
                        onClick={() => handleStartEdit(cat)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-destructive hover:text-destructive"
                        aria-label={`Delete category ${cat.name}`}
                        onClick={() => void handleAskDelete(cat)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.countError
                ? 'Suggestions linked to this category will become uncategorized. This cannot be undone.'
                : deleteTarget?.affectedCount === 0
                  ? 'No suggestions use this category. This cannot be undone.'
                  : `${deleteTarget?.affectedCount ?? 0} suggestion${deleteTarget?.affectedCount === 1 ? '' : 's'} will become uncategorized. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={submitting}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
