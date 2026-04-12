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
  else if (choices.some((c) => c === '')) errors.choices = 'Choice cannot be empty.'
  else {
    const lower = choices.map((c) => c.toLowerCase())
    const uniq = new Set(lower)
    if (uniq.size !== lower.length) errors.choices = 'Duplicate choice.'
  }

  const closesAtMs = Date.parse(input.closes_at ?? '')
  if (isNaN(closesAtMs) || closesAtMs <= Date.now() + 60_000) {
    errors.closes_at = 'Close time must be in the future.'
  }

  if (input.image_url) {
    try {
      new URL(input.image_url)
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
      category_id: input.category_id ?? null,
      image_url: input.image_url ?? null,
      closes_at: input.closes_at,
    },
  }
}
