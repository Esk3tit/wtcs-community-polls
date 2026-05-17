import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { ChevronLeft, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase'
import { ChoicesEditor } from './ChoicesEditor'
import { ImageInput } from './ImageInput'
import { TimerPicker } from './TimerPicker'
import { CategoryPicker } from './CategoryPicker'
import { useCreatePoll } from '@/hooks/useCreatePoll'
import { useUpdatePoll } from '@/hooks/useUpdatePoll'
import { validateSuggestionForm } from '@/lib/validation/suggestion-form'

interface Props {
  mode: 'create' | 'edit'
  pollId?: string
}

export function SuggestionForm({ mode, pollId }: Props) {
  const navigate = useNavigate()
  const { createPoll, submitting: creating } = useCreatePoll()
  const { updatePoll, submitting: updating } = useUpdatePoll()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [choices, setChoices] = useState<string[]>(['', ''])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  // Lazy initializer wraps Date.now() (impure) so the value is computed once
  // at mount, satisfying react-hooks/purity. The +7-day default is a UI
  // affordance — admins can override before submit.
  const [closesAt, setClosesAt] = useState<string>(
    () => new Date(Date.now() + 7 * 86400_000).toISOString(),
  )
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [resultsHidden, setResultsHidden] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [voteCount, setVoteCount] = useState(0)
  const [loaded, setLoaded] = useState(mode === 'create')
  const [loadError, setLoadError] = useState<Error | null>(null)

  const loadPoll = useCallback(async () => {
    if (mode !== 'edit') return
    if (!pollId) {
      setLoadError(new Error('Missing poll id for edit mode'))
      setLoaded(true)
      return
    }
    setLoadError(null)
    setLoaded(false)
    try {
      const { data: poll, error: pollErr } = await supabase
        .from('polls_effective')
        .select('*')
        .eq('id', pollId)
        .single()
      if (pollErr) throw pollErr
      const { data: ch, error: chErr } = await supabase
        .from('choices')
        .select('label')
        .eq('poll_id', pollId)
        .order('sort_order')
      if (chErr) throw chErr
      const { data: vc, error: vcErr } = await supabase
        .from('vote_counts')
        .select('count')
        .eq('poll_id', pollId)
      if (vcErr) throw vcErr

      if (poll) {
        setTitle(poll.title ?? '')
        setDescription(poll.description ?? '')
        setImageUrl(poll.image_url ?? null)
        // LO-v2-04: if the stored closes_at is missing, unparseable, or in
        // the past (lazy-closed no-vote poll reached via direct edit URL),
        // fall back to +7 days so the future-date validator doesn't reject
        // on submit with an unexplained error. 60s margin mirrors the
        // server-side "at least 1 minute in the future" guard.
        const existingCloseMs = poll.closes_at ? Date.parse(poll.closes_at) : NaN
        setClosesAt(
          Number.isFinite(existingCloseMs) && existingCloseMs > Date.now() + 60_000
            ? poll.closes_at
            : new Date(Date.now() + 7 * 86400_000).toISOString(),
        )
        setCategoryId(poll.category_id ?? null)
        setResultsHidden(Boolean(poll.results_hidden))
      }
      if (ch && ch.length > 0) setChoices(ch.map((c: { label: string }) => c.label))
      if (vc)
        setVoteCount(
          (vc as Array<{ count: number | null }>).reduce((s, r) => s + (r.count ?? 0), 0),
        )
      setLoaded(true)
    } catch (err) {
      console.error('Failed to load poll for edit:', err)
      setLoadError(err instanceof Error ? err : new Error(String(err)))
      setLoaded(true)
    }
  }, [mode, pollId])

  useEffect(() => {
    // Mount-fetch pattern for edit mode (no-ops on create). setState happens
    // inside loadPoll on resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- TanStack Query / use() refactor planned for v1.4+
    void loadPoll()
  }, [loadPoll])

  const locked = mode === 'edit' && voteCount > 0
  const submitting = creating || updating

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = validateSuggestionForm({
      title,
      description,
      choices,
      image_url: imageUrl,
      closes_at: closesAt,
      category_id: categoryId,
      results_hidden: resultsHidden,
    })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    if (mode === 'create') {
      const r = await createPoll(result.value)
      if (r.ok) navigate({ to: '/admin', search: { tab: 'suggestions' } })
    } else if (pollId) {
      const r = await updatePoll({ ...result.value, poll_id: pollId })
      if (r.ok) navigate({ to: '/admin', search: { tab: 'suggestions' } })
    }
  }

  if (!loaded) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
    )
  }

  // MEDIUM #7: edit-mode fetch-failure error state
  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
        <Link
          to="/admin"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to admin
        </Link>
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn't load this suggestion</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Please try again.</span>
            <Button size="sm" variant="outline" onClick={() => void loadPoll()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
      <Link
        to="/admin"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4 mr-1" /> Back to admin
      </Link>
      <h1 className="text-2xl font-semibold mb-6">
        {mode === 'create' ? 'New suggestion' : 'Edit suggestion'}
      </h1>
      {locked && (
        <div className="bg-muted border rounded-md p-4 text-sm mb-6">
          This suggestion has received responses. Editing is locked. You can still close, pin,
          or change resolution from the admin list.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            maxLength={120}
            required
            disabled={locked}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={5}
            maxLength={1000}
            disabled={locked}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className="text-xs text-muted-foreground text-right">{description.length}/1000</p>
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description}</p>
          )}
        </div>
        <ChoicesEditor
          value={choices}
          onChange={setChoices}
          disabled={locked}
          error={errors.choices}
        />
        <ImageInput value={imageUrl} onChange={setImageUrl} disabled={locked} />
        <TimerPicker
          value={closesAt}
          onChange={setClosesAt}
          disabled={locked}
          error={errors.closes_at}
        />
        <CategoryPicker value={categoryId} onChange={setCategoryId} disabled={locked} />

        {/* Create-mode renders the editable checkbox; edit-mode renders a read-only
            status row because update-poll EF does not persist results_hidden — admins
            flip it from the admin-list Switch (toggle-results-visibility EF). */}
        <div className="space-y-2">
          {mode === 'create' ? (
            <>
              <div className="flex items-start gap-2 min-h-[44px]">
                <Checkbox
                  id="results-hidden"
                  data-testid="visibility-checkbox"
                  checked={resultsHidden}
                  onCheckedChange={(v) => setResultsHidden(v === true)}
                />
                <Label
                  htmlFor="results-hidden"
                  className="text-sm font-medium cursor-pointer"
                >
                  Hide results from voters
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Voters with responses will see a placeholder instead of counts. Toggle anytime from the admin list.
              </p>
            </>
          ) : (
            <>
              <div
                className="flex items-start gap-2 min-h-[44px]"
                data-testid="visibility-status"
              >
                {resultsHidden ? (
                  <EyeOff
                    className="h-4 w-4 text-muted-foreground mt-0.5"
                    aria-hidden="true"
                  />
                ) : (
                  <Eye
                    className="h-4 w-4 text-foreground mt-0.5"
                    aria-hidden="true"
                  />
                )}
                <span className="text-sm font-medium">
                  {resultsHidden ? 'Results currently hidden' : 'Results currently visible'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Toggle from the admin list to change visibility.
              </p>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-background border-t py-4 px-4 -mx-4 md:static md:mx-0 md:px-0 md:border-0 md:pt-6 flex items-center justify-end gap-2">
          <Button asChild variant="ghost">
            <Link to="/admin">Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={locked || submitting}
            data-testid="suggestion-form-submit"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting ? 'Saving…' : mode === 'create' ? 'Create suggestion' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
