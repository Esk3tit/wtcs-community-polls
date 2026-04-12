export type SuggestionFormInput = {
  title: string
  description: string
  choices: string[]
  category_id: string | null
  image_url: string | null
  closes_at: string // ISO8601
}

export type ValidationResult =
  | { ok: true; value: SuggestionFormInput }
  | { ok: false; errors: Record<string, string> }

export function validateSuggestionForm(input: SuggestionFormInput): ValidationResult {
  const errors: Record<string, string> = {}
  const title = (input.title ?? '').trim()
  if (!title) errors.title = 'Title is required.'
  else if (title.length < 3) errors.title = 'Title must be at least 3 characters.'
  else if (title.length > 120) errors.title = 'Title must be 120 characters or fewer.'

  const description = input.description ?? ''
  if (description.length > 1000) errors.description = 'Description must be 1000 characters or fewer.'

  const choices = (input.choices ?? []).map((c) => (c ?? '').trim())
  if (choices.length < 2) errors.choices = 'At least 2 choices required.'
  else if (choices.length > 10) errors.choices = 'Maximum 10 choices.'
  else if (choices.some((c) => c.length < 1 || c.length > 200)) {
    errors.choices = 'Each choice must be between 1 and 200 characters.'
  } else {
    const lower = choices.map((c) => c.toLowerCase())
    const uniq = new Set(lower)
    if (uniq.size !== lower.length) errors.choices = 'Duplicate choice.'
  }

  const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
  const closesAtStr = input.closes_at ?? ''
  if (!ISO_WITH_TZ.test(closesAtStr)) {
    errors.closes_at = 'Close time must be ISO-8601 with timezone.'
  } else {
    const closesAtDate = new Date(closesAtStr)
    const closesAtMs = closesAtDate.getTime()
    if (isNaN(closesAtMs)) {
      errors.closes_at = 'Close time must be a valid date.'
    } else if (closesAtDate.toISOString().slice(0, 10) !== closesAtStr.slice(0, 10)) {
      errors.closes_at = 'Close time contains an impossible date.'
    } else if (closesAtMs <= Date.now() + 60_000) {
      errors.closes_at = 'Close time must be at least 1 minute in the future.'
    }
  }

  const categoryId = input.category_id?.trim() ? input.category_id.trim() : null
  const imageUrl = input.image_url?.trim() ? input.image_url.trim() : null

  if (imageUrl) {
    try {
      new URL(imageUrl)
    } catch {
      errors.image_url = 'Must be a valid image URL.'
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      title,
      description,
      choices,
      category_id: categoryId,
      image_url: imageUrl,
      closes_at: input.closes_at,
    },
  }
}
